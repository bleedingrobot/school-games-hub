/**
 * Real-life Four Corners' part of the Class Live server (docs/JAIL-PLAN.md). Any device that has joined the room is a
 * jail station: it sends steps `as` a pupil on the class list, who need not have joined (or own a device). The first time
 * a pupil taps their name they join the room on that station, so their points and maths go to them.
 *
 * Steps (all with `as`): `play {do: 'in' | 'undo'}`, `ask`, `answer {slot, answer, ms}`. server.ts hands in its helpers
 * (`JailKit`), so this file only imports types from it.
 */
import { liveNames } from '../liveNames';
import type { PublicQuestion } from '../maths/serverQuestions';
import { markQuestion, sameAnswer } from '../maths/serverQuestions';
import type { Busy, ClassLiveServices, RoomRow, RoomView, Session, Step, StepReply } from './server';
import { answer, freshJailMine, goIn, jailed, onRoster, undo, type JailGame, type Need } from './jail';
import type { CornerMap } from './corners';

/** What pupils of the class may read: the class list (names, for the stations) and who is in jail. No scores. */
export interface JailPublic {
  kind: 'jail';
  map: CornerMap;
  need: Need;
  roster: { id: string; name: string }[];
  /** Pupils in jail now, first in first. */
  inJail: string[];
  /** Comebacks so far. */
  backs: number;
  /** Maths Mingle (docs/MINGLE-PLAN.md): same stations, own big screen. */
  mode?: 'mingle';
  level?: JailGame['level'];
  twists?: boolean;
}

/** The station's own row (the signed-in device): nothing of its own to show. */
export interface JailPlayer {
  kind: 'jail';
}

/** One pupil at a station (in replies only, to that station). */
export interface JailKid {
  id: string;
  name: string;
  inJail: boolean;
  right: number;
  need: Need;
  backs: number;
}

export const rosterNames = (g: JailGame) => liveNames(Object.fromEntries(g.roster.map((p) => [p.id, p.name])));

export function jailPublic(g: JailGame): JailPublic {
  const names = rosterNames(g);
  return {
    kind: 'jail', map: g.map, need: g.need, roster: g.roster.map((p) => ({ id: p.id, name: names[p.id] ?? 'A player' })).sort((a, b) => a.name.localeCompare(b.name)),
    inJail: jailed(g), backs: g.backs.length,
    ...(g.mode ? { mode: g.mode, level: g.level, twists: g.twists } : {}),
  };
}

export function kidOf(g: JailGame, id: string): JailKid {
  const m = g.mine[id] ?? freshJailMine();
  return { id, name: rosterNames(g)[id] ?? 'A player', inJail: m.inAt !== null, right: m.right, need: g.need, backs: m.backs };
}

export interface JailKit {
  sv: ClassLiveServices;
  mutate<T>(sv: ClassLiveServices, room: number, step: Step<T>): Promise<{ reply: T; row: RoomRow; session: Session } | { refuse: StepReply }>;
  nextQuestion(sv: ClassLiveServices, row: RoomRow, who: string): Promise<PublicQuestion | null | Busy>;
  roomView(s: Session, startedAt: number | null, now?: number): RoomView;
  ok(body: Record<string, unknown>): StepReply;
  no(status: number, error: string, reason?: string): StepReply;
  busy(): StepReply;
  maxAnswerMs: number;
  maxPlayers: number;
}

/** Puts a pupil from the class list into the room (they tapped their name on someone's station). */
function joinFor(s: Session, g: JailGame, kid: string, t: number) {
  if (s.players[kid]) return;
  const p = g.roster.find((x) => x.id === kid);
  if (!p) return;
  s.players[kid] = { id: kid, name: p.name, joinedAt: t, colour: s.order.length % 12 };
  s.order.push(kid);
}

export async function jailStep(k: JailKit, cur: RoomRow, body: Record<string, unknown>): Promise<StepReply> {
  const { sv, mutate, ok, no, busy } = k;
  const room = cur.id;
  const s0 = cur.session;
  if (s0.game.kind !== 'jail') return no(400, 'This game has no jail.');
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const kid = body.as;
  if (!onRoster(s0.game, kid)) return no(400, 'Tap your name.', 'who');
  const reply = (s: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: k.roomView(s, startedAt, sv.now()), kid: kidOf(s.game as JailGame, kid), now: sv.now(), ...extra });

  if (body.action === 'play') {
    const what = body.do;
    if (what !== 'in' && what !== 'undo') return no(400, "That couldn't be read.");
    const done = await mutate(sv, room, (s, t) => {
      if (s.state !== 'live' || s.game.kind !== 'jail') return { refuse: no(409, 'This one has finished.', 'over') };
      if (what === 'undo') return { reply: null, events: undo(s.game, kid, t) };
      if (!s.players[kid] && s.order.length >= k.maxPlayers) return { refuse: no(409, 'This room is full.', 'full') };
      joinFor(s, s.game, kid, t);
      return { reply: null, events: goIn(s.game, kid, t) };
    });
    if ('refuse' in done) return done.refuse;
    if (what === 'undo') return reply(done.session, done.row.startedAt);
    const question = await k.nextQuestion(sv, { ...done.row, session: done.session }, kid);
    return reply(done.session, done.row.startedAt, question && question !== 'busy' ? { question } : {});
  }

  if (body.action === 'ask') {
    const m = s0.game.mine[kid];
    if (!m || m.inAt === null) return reply(s0, cur.startedAt);
    const question = await k.nextQuestion(sv, cur, kid);
    if (question === 'busy') return busy();
    if (!question) return no(503, "We couldn't make a question just now.");
    return reply(s0, cur.startedAt, { question });
  }

  // answer
  const slot = body.slot;
  const value = body.answer;
  if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) return no(400, "That answer couldn't be read.");
  const kept = await sv.loadQuestion(room, kid, slot as number);
  if (kept === 'busy') return busy();
  const marked = kept ? markQuestion(kept.question) : null;
  if (!kept || !marked) return no(400, "That answer couldn't be marked.");
  if (kept.answered) return no(409, "You've already answered that one.", 'answered');
  const right = sameAnswer(value, marked.answer);
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : k.maxAnswerMs, k.maxAnswerMs));
  const done = await mutate(sv, room, (s, t) => {
    if (s.state !== 'live' || s.game.kind !== 'jail') return { refuse: no(409, 'This one has finished.', 'over') };
    const out = answer(s.game, kid, right, t);
    if (!out.ok) return { refuse: no(409, out.reason === 'too_soon' ? 'One at a time!' : 'You are back in the game!', out.reason) };
    return { reply: out.back, events: out.events, claim: { player: kid, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  try {
    await sv.recordAnswers(kid, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  const next = done.reply ? null : await k.nextQuestion(sv, { ...done.row, session: done.session }, kid);
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer, back: done.reply, ...(next && next !== 'busy' ? { question: next } : {}) });
}
