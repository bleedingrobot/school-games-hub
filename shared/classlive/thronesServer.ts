/**
 * Musical Thrones' part of the Class Live server (docs/THRONES-PLAN.md): what pupils may read of the game, each pupil's
 * own row, and the pupil steps (`play` with `sit` or `grab`, `ask`/`answer` for the courtyard and power-ups). server.ts
 * hands in its helpers (`ThronesKit`), so this file only imports types from it.
 */
import type { PublicQuestion } from '../maths/serverQuestions';
import { markQuestion, sameAnswer } from '../maths/serverQuestions';
import type { Busy, ClassLiveServices, PlayerView, RoomRow, RoomView, Session, Step, StepReply } from './server';
import {
  answered, bite, boosted, COURT_RIGHT, EAR_MS, freeAt, freshMine, ghostly, grab, podium, questionFor, sit, ANSWER_GAP_MS,
  type Hall, type ThroneItem, type ThronePower, type ThroneRound, type ThronesGame,
} from './thrones';
import type { Spot } from './corners';

/** What pupils of the class may read: the round with thrones marked taken or not (never by whom). */
export interface ThronesPublic {
  kind: 'thrones';
  hall: Hall;
  /** The hall's width (height 1); missing in older games (square). */
  w?: number;
  round: (Omit<ThroneRound, 'thrones' | 'mimics' | 'items' | 'standing' | 'dancers'> & {
    thrones: { id: number; x: number; y: number; golden: boolean; taken: boolean }[];
    /** Trick thrones with eyes: how many each has eaten, never whom. */
    mimics: { id: number; x: number; y: number; ate: number }[];
    items: Omit<ThroneItem, 'by'>[];
    /** How many were left standing (once the scramble is over), or null. */
    standing: number | null;
  }) | null;
  court: number;
  playing: number;
}

export interface ThronesPlayer {
  kind: 'thrones';
  crowns: number;
  sat: number;
  /** The throne they sit on this round, or null. */
  seat: number | null;
  court: boolean;
  courtRight: number;
  /** Back from the courtyard at this session time (all right answers in), or null. */
  freeAt: number | null;
  held: ThronePower | null;
  boost: boolean;
  ghost: boolean;
  steal: boolean;
  shield: boolean;
  double: boolean;
  seatPower: boolean;
  /** Golden ear: buzz at this session time, or null. */
  earAt: number | null;
  stoodLast: boolean;
  danced: boolean;
  placed: number;
  spot: Spot;
  nextAt: number;
  place: 1 | 2 | 3 | null;
  speedLeft: number;
  ghostLeft: number;
  stats: { right: number; wrong: number; bestStreak: number; steals: number; stolen: number; golden: number; dances: number; powers: number; escapes: number; grabs: number; eaten: number };
}

export function thronesPublic(g: ThronesGame, players: number): ThronesPublic {
  const court = Object.values(g.mine).filter((m) => m.courtIn !== null).length;
  const r = g.round;
  return {
    kind: 'thrones', hall: g.hall, ...(g.w ? { w: g.w } : {}), court, playing: players - court,
    round: r ? {
      ...r, thrones: r.thrones.map((th) => ({ id: th.id, x: th.x, y: th.y, golden: th.golden, taken: th.by !== null })),
      mimics: (r.mimics ?? []).map((mm) => ({ id: mm.id, x: mm.x, y: mm.y, ate: mm.ate.length })),
      items: r.items.filter((x) => !x.by).map(({ by: _by, ...x }) => x), standing: r.standing ? r.standing.length : null,
    } : null,
  };
}

export function thronesPlayer(g: ThronesGame, order: string[], id: string, over: boolean): ThronesPlayer {
  const m = g.mine[id] ?? freshMine(order.indexOf(id), g.w ?? 1);
  const r = g.round;
  const n = r?.n ?? 0;
  return {
    kind: 'thrones', crowns: m.crowns, sat: m.sat, seat: m.seat, court: m.courtIn !== null, courtRight: m.courtRight, freeAt: freeAt(g, m),
    held: m.held, boost: boosted(m, n), ghost: ghostly(m, n), steal: !!r && m.stealIn === n, shield: !!r && m.shieldIn === n,
    double: !!r && m.doubleIn === n, seatPower: !!r && m.seatIn === n, earAt: r && m.earIn === n ? r.musicEnd - EAR_MS : null,
    stoodLast: !!r?.standing?.includes(id), danced: !!r?.dancers.includes(id), placed: m.placed, spot: m.spot,
    nextAt: m.lastAt + ANSWER_GAP_MS, place: over ? (podium(g, order).find((x) => x.player === id)?.place ?? null) : null,
    speedLeft: m.speedTo !== null && n <= m.speedTo ? m.speedTo - n + 1 : 0, ghostLeft: m.ghostTo !== null && n <= m.ghostTo ? m.ghostTo - n + 1 : 0,
    stats: {
      right: m.right, wrong: m.wrong, bestStreak: m.bestStreak, steals: m.steals, stolen: m.stolen, golden: m.golden, dances: m.dances,
      powers: m.powersUsed, escapes: m.escapes, grabs: m.grabs, eaten: m.eaten ?? 0,
    },
  };
}

export interface ThronesKit {
  sv: ClassLiveServices;
  mutate<T>(sv: ClassLiveServices, room: number, step: Step<T>): Promise<{ reply: T; row: RoomRow; session: Session } | { refuse: StepReply }>;
  nextQuestion(sv: ClassLiveServices, row: RoomRow, who: string): Promise<PublicQuestion | null | Busy>;
  roomView(s: Session, startedAt: number | null, now?: number): RoomView;
  playerView(s: Session, id: string): PlayerView;
  timeOf(row: Pick<RoomRow, 'startedAt'>, now: number): number;
  ok(body: Record<string, unknown>): StepReply;
  no(status: number, error: string, reason?: string): StepReply;
  busy(): StepReply;
  maxAnswerMs: number;
}

const SIT_WORDS = { not_now: 'Wait for the music to stop!', gone: 'That throne has gone.', far: 'Get closer!', taken: 'Someone got there first!', seated: 'You are already sitting!' } as const;

export async function thronesStep(k: ThronesKit, cur: RoomRow, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const { sv, ok, no, busy } = k;
  const room = cur.id;
  const s0 = cur.session;
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const spotOf = async (): Promise<Spot | undefined | Busy> => {
    const all = await sv.positions(room);
    if (all === 'busy') return 'busy';
    return all[who];
  };
  const reply = (session: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: k.roomView(session, startedAt, sv.now()), me: k.playerView(session, who), now: sv.now(), ...extra });

  if (body.action === 'play') {
    const at = await spotOf();
    if (at === 'busy') return busy();
    const done = await k.mutate(sv, room, (s, t) => {
      if (s.state !== 'live' || s.game.kind !== 'thrones') return { refuse: no(409, 'This one has finished.', 'over') };
      const g = s.game;
      const mine = g.mine[who];
      if (body.bite !== undefined) {
        const out = bite(g, who, body.bite, at ?? mine?.spot, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'far' ? 'Get closer!' : out.reason === 'seated' ? "You're on a throne!" : 'Too late!', out.reason) };
        return { reply: null, events: out.events, players: [who] };
      }
      if (body.sit !== undefined) {
        const out = sit(g, who, body.sit, at ?? mine?.spot, t);
        if (!out.ok) return { refuse: no(409, SIT_WORDS[out.reason], out.reason) };
        return { reply: null, events: out.events, players: out.bumped ? [who, out.bumped] : [who] };
      }
      const out = grab(g, who, body.grab, at ?? mine?.spot, t);
      if (!out.ok) return { refuse: no(409, out.reason === 'full' ? 'You are already carrying one!' : out.reason === 'far' ? 'Get closer!' : 'Too late!', out.reason) };
      return { reply: null, events: out.events, players: [who] };
    });
    if ('refuse' in done) {
      const now = await sv.loadRoom(room);
      if (!now || now === 'busy') return done.refuse;
      return { ...done.refuse, body: { ...done.refuse.body, view: k.roomView(now.session, now.startedAt, sv.now()), me: k.playerView(now.session, who), now: sv.now() } };
    }
    return reply(done.session, done.row.startedAt);
  }

  const g0 = s0.game as ThronesGame;
  const t0 = k.timeOf(cur, sv.now());
  if (body.action === 'ask') {
    const purpose = questionFor(g0, who, t0);
    if (!purpose) return no(409, 'No question right now.', 'not_now');
    const question = await k.nextQuestion(sv, cur, who);
    if (question === 'busy') return busy();
    if (!question) return no(503, "We couldn't make a question just now.");
    return ok({ room, question, purpose, now: sv.now() });
  }
  const slot = body.slot;
  const value = body.answer;
  if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) return no(400, "That answer couldn't be read.");
  const kept = await sv.loadQuestion(room, who, slot as number);
  if (kept === 'busy') return busy();
  const marked = kept ? markQuestion(kept.question) : null;
  if (!kept || !marked) return no(400, "That answer couldn't be marked.");
  if (kept.answered) return no(409, "You've already answered that one.", 'answered');
  const right = sameAnswer(value, marked.answer);
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : k.maxAnswerMs, k.maxAnswerMs));
  const done = await k.mutate(sv, room, (s, t) => {
    if (s.state !== 'live' || s.game.kind !== 'thrones') return { refuse: no(409, 'This one has finished.', 'over') };
    const purpose = questionFor(s.game, who, t);
    if (!purpose) return { refuse: no(409, 'The music has stopped!', 'not_now') };
    const out = answered(s.game, who, right, purpose, t, typeof body.ms === 'number' ? ms : undefined);
    if (!out.ok) return { refuse: no(409, out.reason === 'too_soon' ? 'One at a time!' : 'No question right now.', out.reason) };
    return { reply: purpose, events: out.events, players: [who], claim: { player: who, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  try {
    await sv.recordAnswers(who, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  // In the courtyard, the next question straight away (until 3 right).
  const g1 = done.session.game as ThronesGame;
  const m1 = g1.mine[who];
  const more = done.reply === 'court' && !!m1 && m1.courtIn !== null && m1.courtRight < COURT_RIGHT;
  const next = more ? await k.nextQuestion(sv, { ...done.row, session: done.session }, who) : null;
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer, purpose: done.reply, ...(next && next !== 'busy' ? { question: next } : {}) });
}
