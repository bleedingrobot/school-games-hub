/**
 * Colour Clash's server parts (docs/CLASH-PLAN.md), kept out of server.ts so the other Class Live games built at the
 * same time touch different files. server.ts calls these at a few hooks: the clock (`clashTick` in mutate), joining,
 * the views, and the pupil steps (`clashStep`).
 */
import {
  advance, answered, canAsk, champions, clashDone, freshMine, grab, needsTiles, nextDeadline, painting, standings, startSpot, teamFor, ANSWER_GAP_MS,
  type ClashGame, type ClashItem, type ClashMap, type ClashPower, type ClashRound, type Team,
} from './clash';
import type { Spot } from './corners';
import { markQuestion, sameAnswer } from '../maths/serverQuestions';
import type { ClassLiveServices, Event, PlayerView, RoomRow, Session, StepReply } from './server';
import { mutateRoom, nextQuestionFor, playerView, roomSpots, roomView } from './server';

type Busy = 'busy';

/** What any pupil of the class may read of a Colour Clash game (no names, no tiles: those come from the database). */
export interface ClashPublic {
  kind: 'clash';
  map: ClashMap;
  teams: 2 | 3 | 4;
  /** Epoch ms of the start (pads line their clock up with the database's paint window). */
  zeroMs: number | null;
  round: (Omit<ClashRound, 'items'> & { items: Omit<ClashItem, 'by'>[] }) | null;
  wins: number[];
  totals: number[];
  history: ClashGame['history'];
  /** Pupils in each team (index = team). */
  sizes: number[];
}

export interface ClashPlayer {
  kind: 'clash';
  team: Team;
  painted: number;
  bombs: number;
  right: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  held: ClashPower | null;
  brushTo: number | null;
  speedTo: number | null;
  nextAt: number;
  placed: number;
  spot: Spot;
  /** Their team's place at the end (1 = won), or null while it runs. */
  place: number | null;
  grabs: number;
  powers: number;
}

export function clashPublic(g: ClashGame): ClashPublic {
  const sizes = [0, 0, 0, 0, 0];
  for (const m of Object.values(g.mine)) sizes[m.team]++;
  return {
    kind: 'clash', map: g.map, teams: g.teams, zeroMs: g.zeroMs,
    round: g.round ? { ...g.round, items: g.round.items.filter((x) => !x.by).map(({ by: _by, ...x }) => x) } : null,
    wins: g.wins, totals: g.totals, history: g.history, sizes,
  };
}

export function clashPlayer(s: Session, g: ClashGame, id: string): ClashPlayer {
  const m = g.mine[id] ?? freshMine(1);
  const place = s.state === 'over' ? (standings(g).find((x) => x.team === m.team)?.place ?? null) : null;
  return {
    kind: 'clash', team: m.team, painted: m.painted, bombs: m.bombs, right: m.right, wrong: m.wrong, streak: m.streak, bestStreak: m.bestStreak,
    held: m.held, brushTo: m.brushTo, speedTo: m.speedTo, nextAt: m.lastAt + ANSWER_GAP_MS, placed: m.placed ?? 0, spot: m.spot ?? startSpot(m.team, g.teams, 0),
    place, grabs: m.grabs, powers: m.powersUsed,
  };
}

/** A pupil joins: the smallest team, at its side of the board. */
export function clashJoin(g: ClashGame, who: string) {
  const team = teamFor(g);
  const m = freshMine(team);
  const same = Object.values(g.mine).filter((x) => x.team === team).length;
  m.spot = startSpot(team, g.teams, same);
  m.placed = 0;
  g.mine[who] = m;
}

/**
 * The clock (from mutate): count a round when painting ends (the board from the database), start the next. Each new
 * round puts every pupil back at their team's side (`placed` bumps; mutate saves the spots).
 */
export async function clashTick(sv: ClassLiveServices, room: number, s: Session, t: number, last: boolean): Promise<Event[] | Busy> {
  const g = s.game as ClashGame;
  const r = g.round;
  let board: { tiles: string; painted: Record<string, number> } | null = null;
  if (r && needsTiles(g, t)) {
    const got = await sv.clashBoard(room, r.n);
    if (got === 'busy') return 'busy';
    board = got;
  }
  const events: Event[] = advance(g, t, s.order, board, () => sv.random(), last);
  for (const e of events) {
    if (e.type !== 'clash_round') continue;
    const count = [0, 0, 0, 0, 0];
    for (const id of s.order) {
      const m = g.mine[id];
      if (!m) continue;
      m.spot = startSpot(m.team, g.teams, count[m.team]++);
      m.placed = (m.placed ?? 0) + 1;
    }
  }
  if (last && clashDone(g, t)) {
    s.state = 'over';
    events.push({ type: 'over', t, why: 'time' });
  }
  return events;
}

export const clashDeadline = (g: ClashGame, startedAt: number | null) => nextDeadline(g, startedAt);

const ok = (body: Record<string, unknown>): StepReply => ({ status: 200, body });
const no = (status: number, error: string, reason?: string): StepReply => ({ status, body: { error, ...(reason ? { reason } : {}) } });
const busyReply = () => no(503, 'Class Live is very busy. Try again!', 'busy');
const MAX_ANSWER_MS = 120_000;
const timeOf = (row: Pick<RoomRow, 'startedAt'>, now: number) => (row.startedAt === null ? 0 : Math.max(0, now - row.startedAt));

/** Colour Clash's pupil steps: `play` with `grab`, `ask` and `answer` (a right answer drops a paint bomb). */
export async function clashStep(sv: ClassLiveServices, cur: RoomRow, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const room = cur.id;
  const s0 = cur.session;
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const spotOf = async (): Promise<Spot | undefined | Busy> => {
    const all = await roomSpots(sv, s0, room);
    if (all === 'busy') return 'busy';
    return all[who];
  };
  const reply = (session: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: roomView(session, startedAt, sv.now()), me: playerView(session, who), now: sv.now(), ...extra });

  if (body.action === 'play') {
    const at = await spotOf();
    if (at === 'busy') return busyReply();
    const done = await mutateRoom(sv, room, (s, t) => {
      if (s.state !== 'live' || s.game.kind !== 'clash') return { refuse: no(409, 'This one has finished.', 'over') };
      const out = grab(s.game, who, body.grab, at ?? s.game.mine[who]?.spot, t);
      if (!out.ok) return { refuse: no(409, out.reason === 'full' ? 'You are already carrying one!' : out.reason === 'far' ? 'Get closer!' : 'Too late!', out.reason) };
      return { reply: null, events: out.events, players: [who] };
    });
    if ('refuse' in done) return done.refuse;
    return reply(done.session, done.row.startedAt);
  }

  const g0 = s0.game as ClashGame;
  if (body.action === 'ask') {
    if (!canAsk(g0, who, timeOf(cur, sv.now()))) return no(409, 'Wait for the paint to start!', 'not_now');
    const question = await nextQuestionFor(sv, cur, who);
    if (question === 'busy') return busyReply();
    if (!question) return no(503, "We couldn't make a question just now.");
    return ok({ room, question, now: sv.now() });
  }
  const slot = body.slot;
  const value = body.answer;
  if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) return no(400, "That answer couldn't be read.");
  const kept = await sv.loadQuestion(room, who, slot as number);
  if (kept === 'busy') return busyReply();
  const marked = kept ? markQuestion(kept.question) : null;
  if (!kept || !marked) return no(400, "That answer couldn't be marked.");
  if (kept.answered) return no(409, "You've already answered that one.", 'answered');
  const right = sameAnswer(value, marked.answer);
  const at = await spotOf();
  if (at === 'busy') return busyReply();
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS, MAX_ANSWER_MS));
  let bomb: { round: number; team: Team; tiles: number[] } | null = null;
  const done = await mutateRoom(sv, room, (s, t) => {
    if (s.state !== 'live' || s.game.kind !== 'clash') return { refuse: no(409, 'This one has finished.', 'over') };
    const g = s.game;
    const out = answered(g, who, right, at ?? g.mine[who]?.spot, t);
    if (!out.ok) return { refuse: no(409, out.reason === 'too_soon' ? 'One at a time!' : 'Wait for the paint to start!', out.reason) };
    bomb = out.tiles.length && g.round ? { round: g.round.n, team: g.mine[who].team, tiles: out.tiles } : null;
    return { reply: null, events: out.events, players: [who], claim: { player: who, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  const b = bomb as { round: number; team: Team; tiles: number[] } | null;
  if (b) {
    try {
      await sv.clashBomb(room, b.round, b.team, who, b.tiles);
    } catch {
      console.error(`classlive: clash bomb in room ${room} failed`);
    }
  }
  try {
    await sv.recordAnswers(who, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  const g1 = done.session.game as ClashGame;
  const next = done.session.state === 'live' && painting(g1.round, timeOf(done.row, sv.now())) ? await nextQuestionFor(sv, { ...done.row, session: done.session }, who) : null;
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer, ...(next && next !== 'busy' ? { question: next } : {}) });
}

/** Rewards: the class "goal" is their team winning; extra totals for the trophies. */
export function clashReward(g: ClashGame, id: string): { did: boolean; won: boolean; extra: Record<string, number> } {
  const m = g.mine[id];
  const won = !!m && champions(g).includes(m.team);
  return {
    did: !!m && (m.painted > 0 || m.right > 0),
    won,
    extra: { clash_tiles: m?.painted ?? 0, clash_bombs: m?.bombs ?? 0, clash_wins: won ? 1 : 0, clash_games: m ? 1 : 0 },
  };
}

export type { PlayerView };
