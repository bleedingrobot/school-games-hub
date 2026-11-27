/**
 * Rocket Relay's part of the Class Live server (docs/ROCKET-PLAN.md). Each team has a station iPad (any device that
 * joined the room); it sends steps `as` the team's runner, with `team`. The runner need not have joined (or own a
 * device): the first time they check in they join the room on that station, so their points and maths go to them.
 *
 * Steps (all with `as` and `team`): `play {do: 'here' | 'skip'}`, `ask`, `answer {slot, answer, ms}`.
 * server.ts hands in its helpers (JailKit), so this file only imports types from it.
 */
import { liveNames } from '../liveNames';
import type { PublicQuestion } from '../maths/serverQuestions';
import { markQuestion, sameAnswer } from '../maths/serverQuestions';
import type { JailKit } from './jailServer';
import type { RoomRow, Session, StepReply } from './server';
import { answer, checkIn, nextOf, runnerOf, skip, TEAM_WORDS, type PerRun, type RocketGame } from './rocket';

export interface RocketPublicTeam {
  name: string;
  colour: string;
  height: number;
  size: number;
  /** Who runs now (or is at the iPad: `active`), and who is next. */
  runner: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  active: boolean;
  /** The running order, names only (for the station's team list). */
  order: { id: string; name: string }[];
}

/** What pupils of the class may read: teams, running order and rocket heights. No answers or scores of pupils. */
export interface RocketPublic {
  kind: 'rocket';
  perRun: PerRun;
  moon: number;
  winner: number | null;
  teams: RocketPublicTeam[];
}

export interface RocketPlayer {
  kind: 'rocket';
}

/** The runner at a station (in replies only, to that station). */
export interface RocketKid {
  id: string;
  name: string;
  team: number;
  /** Checked in at the iPad now. */
  here: boolean;
  runRight: number;
  perRun: PerRun;
  secondTry: boolean;
}

const rosterNames = (g: RocketGame) => liveNames(Object.fromEntries(g.roster.map((p) => [p.id, p.name])));

export function rocketPublic(g: RocketGame): RocketPublic {
  const names = rosterNames(g);
  const who = (id: string | null) => (id ? { id, name: names[id] ?? 'A player' } : null);
  return {
    kind: 'rocket', perRun: g.perRun, moon: g.moon, winner: g.winner,
    teams: g.teams.map((t, i) => ({
      name: TEAM_WORDS[i % TEAM_WORDS.length].name, colour: TEAM_WORDS[i % TEAM_WORDS.length].colour, height: t.height, size: t.order.length,
      runner: who(runnerOf(t)), next: t.order.length > 1 ? who(nextOf(t)) : null, active: t.active !== null,
      order: t.order.map((id) => ({ id, name: names[id] ?? 'A player' })),
    })),
  };
}

function kidOf(g: RocketGame, team: number, id: string): RocketKid {
  const t = g.teams[team];
  return { id, name: rosterNames(g)[id] ?? 'A player', team, here: t?.active === id, runRight: t?.runRight ?? 0, perRun: g.perRun, secondTry: t?.secondTry ?? false };
}

function joinFor(s: Session, g: RocketGame, kid: string, t: number) {
  if (s.players[kid]) return;
  const p = g.roster.find((x) => x.id === kid);
  if (!p) return;
  s.players[kid] = { id: kid, name: p.name, joinedAt: t, colour: s.order.length % 12 };
  s.order.push(kid);
}

const WORDS: Record<string, string> = {
  team: 'Pick your team.', not_you: "It isn't your turn yet.", not_here: "Tap I'm here first.", won: 'The race is over!', too_soon: 'One at a time!',
};

export async function rocketStep(k: JailKit, cur: RoomRow, body: Record<string, unknown>): Promise<StepReply> {
  const { sv, mutate, ok, no, busy } = k;
  const room = cur.id;
  const s0 = cur.session;
  if (s0.game.kind !== 'rocket') return no(400, 'This game has no rockets.');
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const g0 = s0.game;
  const team = body.team;
  if (!Number.isInteger(team) || !g0.teams[team as number]) return no(400, 'Pick your team.', 'team');
  const tm = team as number;
  const kid = body.as;
  if (typeof kid !== 'string' || !g0.teams[tm].order.includes(kid)) return no(400, 'That runner is not on this team.', 'who');
  const reply = (s: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: k.roomView(s, startedAt, sv.now()), kid: kidOf(s.game as RocketGame, tm, kid), now: sv.now(), ...extra });

  if (body.action === 'play') {
    const what = body.do;
    if (what !== 'here' && what !== 'skip') return no(400, "That couldn't be read.");
    const done = await mutate(sv, room, (s, t) => {
      if (s.state !== 'live' || s.game.kind !== 'rocket') return { refuse: no(409, 'This one has finished.', 'over') };
      if (what === 'skip') {
        if (runnerOf(s.game.teams[tm]) !== kid) return { refuse: no(409, "It isn't their turn now.", 'not_you') };
        return { reply: null, events: skip(s.game, tm, t) };
      }
      if (!s.players[kid] && s.order.length >= k.maxPlayers) return { refuse: no(409, 'This room is full.', 'full') };
      const out = checkIn(s.game, tm, kid);
      if (!out.ok) return { refuse: no(409, WORDS[out.reason], out.reason) };
      joinFor(s, s.game, kid, t);
      // No event, but the runner's row changed: without this the check-in isn't saved.
      return { reply: null, events: [], players: [kid] };
    });
    if ('refuse' in done) return done.refuse;
    if (what === 'skip') return reply(done.session, done.row.startedAt);
    const question = await k.nextQuestion(sv, { ...done.row, session: done.session }, kid);
    return reply(done.session, done.row.startedAt, question && question !== 'busy' ? { question } : {});
  }

  if (body.action === 'ask') {
    if (g0.teams[tm].active !== kid) return reply(s0, cur.startedAt);
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
    if (s.state !== 'live' || s.game.kind !== 'rocket') return { refuse: no(409, 'This one has finished.', 'over') };
    const out = answer(s.game, tm, kid, right, t);
    if (!out.ok) return { refuse: no(409, WORDS[out.reason], out.reason) };
    return { reply: { runOver: out.runOver, boost: out.boost }, events: out.events, claim: { player: kid, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  try {
    await sv.recordAnswers(kid, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  const res = done.reply ?? { runOver: true, boost: 0 };
  const next: PublicQuestion | null | 'busy' = res.runOver ? null : await k.nextQuestion(sv, { ...done.row, session: done.session }, kid);
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer, runOver: res.runOver, boost: res.boost, ...(next && next !== 'busy' ? { question: next } : {}) });
}
