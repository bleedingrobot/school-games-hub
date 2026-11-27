/**
 * Floor is Lava's part of the Class Live server (docs/LAVA-PLAN.md): what pupils and the projector see of the game, and
 * the pupil steps (`play` with grab / build / rescue, `ask` and `answer`). server.ts calls in here with its own helpers
 * (passed in, so the two files don't import each other's values).
 */
import { markQuestion, sameAnswer, type PublicQuestion } from '../maths/serverQuestions';
import {
  ANSWER_GAP_MS, climbAt, lavaAnswered, lavaBooted, lavaBoosted, lavaBuild, lavaGrab, lavaPodium, lavaQuestionFor, lavaRescue, RAFT_RIGHT,
  type LavaGame, type LavaItem, type LavaMap, type LavaPower, type LavaRound, type Spot,
} from './lava';
import type { ClassLiveServices, Event, RoomRow, RoomView, PlayerView, Session, StepReply } from './server';

export type LavaPublicRound = Omit<LavaRound, 'items' | 'fell' | 'booted'> & { items: Omit<LavaItem, 'by'>[]; ended: boolean; fell: number };

/** What any pupil of the class may read: the floor and the round (no names). */
export interface LavaPublic {
  kind: 'lava';
  map: LavaMap;
  sunk: number[];
  round: LavaPublicRound | null;
  rafted: number;
  up: number;
}

export interface LavaPlayer {
  kind: 'lava';
  up: number;
  score: number;
  raft: boolean;
  raftRight: number;
  held: LavaPower | null;
  bricks: number;
  boost: boolean;
  boots: boolean;
  double: boolean;
  fellLast: boolean;
  bootedLast: boolean;
  placed: number;
  spot: Spot;
  nextAt: number;
  place: 1 | 2 | 3 | null;
  climbAt: number | null;
  speedLeft: number;
  stats: { right: number; wrong: number; bestStreak: number; built: number; rescues: number; grabs: number; powers: number; climbs: number; falls: number };
}

export function lavaPublic(g: LavaGame, players: number): LavaPublic {
  const rafted = Object.values(g.mine).filter((m) => m.raftIn !== null).length;
  const r = g.round;
  const round: LavaPublicRound | null = r
    ? (() => {
        const { items, fell, booted: _b, ...rest } = r;
        return { ...rest, items: items.filter((x) => !x.by).map(({ by: _by, ...x }) => x), ended: fell !== null, fell: fell?.length ?? 0 };
      })()
    : null;
  return { kind: 'lava', map: g.map, sunk: g.sunk, round, rafted, up: players - rafted };
}

export function lavaPlayer(s: Session, g: LavaGame, id: string, fresh: () => LavaGame['mine'][string]): LavaPlayer {
  const m = g.mine[id] ?? fresh();
  const r = g.round;
  const n = r?.n ?? 0;
  return {
    kind: 'lava', up: m.up, score: m.score, raft: m.raftIn !== null, raftRight: m.raftRight, held: m.held, bricks: m.bricks,
    boost: lavaBoosted(m, n), boots: lavaBooted(m, n), double: !!r && m.doubleIn === n,
    fellLast: !!r?.fell?.includes(id), bootedLast: !!r?.booted.includes(id), placed: m.placed, spot: m.spot, nextAt: m.lastAt + ANSWER_GAP_MS,
    place: s.state === 'over' ? (lavaPodium(g, s.order).find((x) => x.player === id)?.place ?? null) : null,
    climbAt: climbAt(g, m), speedLeft: m.speedTo !== null && n <= m.speedTo ? m.speedTo - n + 1 : 0,
    stats: { right: m.right, wrong: m.wrong, bestStreak: m.bestStreak, built: m.built, rescues: m.rescues, grabs: m.grabs, powers: m.powersUsed, climbs: m.climbs, falls: m.falls },
  };
}

type Mutate = <T>(sv: ClassLiveServices, room: number, step: (s: Session, t: number, row: RoomRow) =>
  { reply: T; events: Event[]; players?: string[]; claim?: { player: string; slot: number; value: number; right: boolean } } | { refuse: StepReply }) =>
  Promise<{ reply: T; row: RoomRow; session: Session } | { refuse: StepReply }>;

export interface LavaHelpers {
  mutate: Mutate;
  nextQuestion(sv: ClassLiveServices, row: RoomRow, who: string): Promise<PublicQuestion | null | 'busy'>;
  roomView(s: Session, startedAt: number | null, now?: number): RoomView;
  playerView(s: Session, id: string): PlayerView;
  ok(body: Record<string, unknown>): StepReply;
  no(status: number, error: string, reason?: string): StepReply;
  busy(): StepReply;
}

const MAX_ANSWER_MS = 120_000;

/** Floor is Lava's pupil steps. */
export async function lavaStep(sv: ClassLiveServices, cur: RoomRow, who: string, body: Record<string, unknown>, h: LavaHelpers): Promise<StepReply> {
  const { ok, no, busy } = h;
  const room = cur.id;
  const s0 = cur.session;
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const spotOf = async (): Promise<Spot | undefined | 'busy'> => {
    const all = await (s0.edge && sv.edge ? sv.edge.positions(room) : sv.positions(room));
    if (all === 'busy') return 'busy';
    return all[who];
  };
  const reply = (session: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: h.roomView(session, startedAt, sv.now()), me: h.playerView(session, who), now: sv.now(), ...extra });

  if (body.action === 'play') {
    const at = body.grab !== undefined || body.build !== undefined ? await spotOf() : undefined;
    if (at === 'busy') return busy();
    const done = await h.mutate<null>(sv, room, (s, t) => {
      if (s.state !== 'live' || s.game.kind !== 'lava') return { refuse: no(409, 'This one has finished.', 'over') };
      const g = s.game;
      const mine = g.mine[who];
      if (body.rescue !== undefined) {
        const out = lavaRescue(g, who, s.order, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'no_bricks' ? `You need ${2} bricks.` : out.reason === 'nobody' ? 'Nobody needs rescuing!' : 'Not now!', out.reason) };
        return { reply: null, events: out.events, players: [who, out.friend] };
      }
      if (body.build !== undefined) {
        const out = lavaBuild(g, who, body.build, at ?? mine?.spot, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'no_bricks' ? 'Answer a question for a brick!' : out.reason === 'far' ? 'Get closer!' : out.reason === 'solid' ? "That tile isn't lava." : 'Not now!', out.reason) };
        return { reply: null, events: out.events, players: [who] };
      }
      const out = lavaGrab(g, who, body.grab, at ?? mine?.spot, t);
      if (!out.ok) return { refuse: no(409, out.reason === 'full' ? 'You are already carrying one!' : out.reason === 'far' ? 'Get closer!' : 'Too late!', out.reason) };
      return { reply: null, events: out.events, players: [who] };
    });
    if ('refuse' in done) return done.refuse;
    return reply(done.session, done.row.startedAt);
  }

  const g0 = s0.game as LavaGame;
  if (body.action === 'ask') {
    const purpose = lavaQuestionFor(g0, who);
    if (!purpose) return no(409, 'No question right now.', 'not_now');
    const question = await h.nextQuestion(sv, cur, who);
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
  // The spot matters for an Ice blast (it cools the tiles around you).
  const at = await spotOf();
  if (at === 'busy') return busy();
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS, MAX_ANSWER_MS));
  const done = await h.mutate<'raft' | 'power' | 'brick'>(sv, room, (s, t) => {
    if (s.state !== 'live' || s.game.kind !== 'lava') return { refuse: no(409, 'This one has finished.', 'over') };
    const m = s.game.mine[who];
    if (m && at && m.raftIn === null) m.spot = { x: at.x, y: at.y };
    const out = lavaAnswered(s.game, who, right, s.order, t, typeof body.ms === 'number' ? ms : undefined);
    if (!out.ok) return { refuse: no(409, out.reason === 'too_soon' ? 'One at a time!' : 'No question right now.', out.reason) };
    const freed = out.events.flatMap((e) => (e.type === 'lava_power' && e.freed ? [e.freed] : []));
    return { reply: out.purpose, events: out.events, players: [who, ...freed], claim: { player: who, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  try {
    await sv.recordAnswers(who, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  // On the raft, the next question straight away (until 5 right).
  const g1 = done.session.game as LavaGame;
  const more = done.reply === 'raft' && g1.mine[who]?.raftIn !== null && (g1.mine[who]?.raftRight ?? 0) < RAFT_RIGHT;
  const next = more ? await h.nextQuestion(sv, { ...done.row, session: done.session }, who) : null;
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer, purpose: done.reply, ...(next && next !== 'busy' ? { question: next } : {}) });
}
