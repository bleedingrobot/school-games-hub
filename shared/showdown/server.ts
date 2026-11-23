/**
 * Class Showdown's server steps (docs/SHOWDOWN-PLAN.md section 6), with the database passed in (`ShowdownServices`), so
 * the edge function (supabase/functions/showdown), its tests and the `?pretend=30` preview all run the same code.
 *
 * The server holds the truth: a room keeps the whole Stage 1 `Round` (hidden from pupils), and every step loads it,
 * applies ONE engine call with the time since the round started (`now - startedAt`), and saves it with the version it
 * was loaded at. If another iPad saved in between, the save is refused ('stale') and the step runs again on the newer
 * round (compare-and-swap: Supabase's API can't hold a row lock across calls, so this stands in for `select ... for
 * update`; at 30 pupils x one answer every 4 seconds a retry is rare and cheap).
 *
 * Every event the engine returns goes to the projector's feed straight away, in the same save, with the names it needs
 * (no batching, so hits never arrive in clumps). Wrong answers are never in the feed: only the pupil's own reply has them.
 *
 * Teacher steps: open, view, teams, start, tick, enrage, pause, end, again. Pupil steps: join, choose, ask, answer.
 *
 * When a round ends, every pupil's reward (hub points and a Showdown chest, shared/showdown/bosses.ts) is put on their row in
 * the same save, and `finishRound` pays it out and records the class's roster (once per round, however often it's called).
 */
import { recap, type Recap } from './awards';
import { SHOWDOWN } from './config';
import { advance, answer, chooseRole, enrage, goldenNext, join, moveToTeam, newRound, roundMs, start } from './engine';
import { reshuffle } from './teams';
import { chooseSeam, diggersAt, openSeamsOf } from './goldrush';
import { shoreAt, spotOf } from './island';
import { contenders } from './hill';
import { AUCTION, bid, coinsOf, openLot, vaultOf, type BidRefusal, type TreasureKind } from './auction';
import { pickBoss, rewardFor, roster, type BossId, type ChestGame, type Reward, type RosterRow } from './bosses';
import type { Arena, Mode, Player, Role, Round, ShowdownEvent, TeamId } from './types';
import { ladderProgress } from '../maths/ladder';
import type { FactAnswer } from '../maths/leitner';
import { markQuestion, publicQuestion, sameAnswer, seededRandom, type MathsContext, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { makeSpacePack, pickSpaceQuestion } from '../space/mathsQuestion';
import { isUntimed } from '../maths/untimed';
import { TimesTables } from '../maths/skillPacks/timesTables';

export const MODES: readonly Mode[] = ['class', 'teams2', 'teams4', 'solo'];
export const ROLES: readonly Role[] = ['striker', 'guard', 'healer'];
/** Arenas a room can be opened as (each arena's rules: goldrush.ts, skyclimb.ts, island.ts, hill.ts, auction.ts). */
export const ARENAS = ['boss', 'goldrush', 'skyclimb', 'island', 'hill', 'auction'] as const satisfies readonly Arena[];

/** What pupils (their class's room row) and the projector see of a room: no names, no maths. */
export interface RoomView {
  state: Round['state'];
  mode: Mode;
  arena: Arena;
  /** The boss of the roster this round fights. */
  bossId: BossId;
  /** Gold Rush: the open seams, with how many pupils are digging at each (no names). Empty in Boss Bounty. */
  seams: { id: number; kind: 'gold' | 'gem' | 'rich'; x: number; y: number; left: number; size: number; diggers: number }[];
  /** Shrinking Island: the shoreline now (1 = where it started) and where each pupil stands, by id: [degrees round, distance
   *  from the middle, 0 on the island or 1 + swim strokes so far on a rock]. No names. Null in the other arenas. */
  island: { shore: number; spots: Record<string, [number, number, number]> } | null;
  /** King of the Hill: who wears the crown (a pupil id, or a team; null = up for grabs) since when, the top 3 by points in
   *  the last 30 seconds, and how long each holder has worn it (ms). No names. Null in the other arenas. */
  crown: { holder: string | null; team: boolean; since: number; nextAt: number; contenders: [string, number][]; held: Record<string, number> } | null;
  /** Auction House: the treasure on sale (its value null while a mystery box is on sale; the leading bidder by id), when
   *  the next goes up, every treasure sold so far (who bought it, by id) and the top 5 fortunes by id. Null in the other arenas. */
  auction: {
    lot: { id: number; kind: TreasureKind; value: number | null; min: number; endsAt: number; top: number; topBy: string | null; topTeam: TeamId | null; bids: number } | null;
    nextAt: number | null;
    sold: { id: number; kind: TreasureKind; value: number; bid: number; by: string; team: TeamId | null }[];
    rich: { id: string; fortune: number; vault: number }[];
    steps: readonly number[];
  } | null;
  /** How many pupils have each role, in the whole class ('all') and in each team, so every screen can call for more Guards. */
  roles: Record<string, Record<Role, number>>;
  lengthMin: number;
  /** Server time (ms since 1970) the round started, or null in the lobby. Times below are ms from that. */
  startedAt: number | null;
  /** Server time the teacher paused it, or null. */
  pausedAt: number | null;
  t: number;
  players: number;
  boss: Round['boss'];
  teams: TeamId[];
  teamPoints: Round['teamPoints'];
  teamDamage: Round['teamDamage'];
  tug: number;
  facing: TeamId | null;
  weakSpotUntil: number;
  goldenFrom: number | null;
  goldenUntil: number;
  enrageUntil: number;
  roleSwapUntil: number;
  finalStarted: boolean;
  windUp: { endsAt: number; enraged: boolean; groups: Record<string, { needed: number; got: number; done: 'held' | 'broke' | null }> } | null;
  result: Round['result'];
  showNames: boolean;
}

/** One pupil's own row (their iPad listens to it). Times are ms from the round's start. */
export interface PlayerView {
  player: string;
  name: string;
  team: TeamId | null;
  role: Role;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  wrong: number;
  shields: number;
  revives: number;
  nextAt: number;
  dazedUntil: number;
  /** Solo only: true while this pupil is in the top 10 (the only place a pupil is ever told). */
  topTen: boolean;
  /** Set when the round is over: what this pupil got (hub points and the Showdown chest). */
  reward: Reward | null;
  /** Gold Rush: the seam this pupil digs at. */
  seam: number | null;
  /** Auction House: coins to spend, and what this pupil's treasures are worth (score = the two together). */
  coins: number;
  vault: number;
}

/** A feed row for the projector: the engine's event, plus the first names of every pupil it mentions. */
export type FeedEvent = (ShowdownEvent | { type: 'recap'; t: number; recap: Recap } | { type: 'pause' | 'resume' | 'ended'; t: number } | { type: 'again'; t: number; boss: BossId }) & {
  names?: Record<string, string>;
};

export interface RoomRow {
  id: number;
  classId: string;
  teacher: string;
  arena: Arena;
  version: number;
  startedAt: number | null;
  pausedAt: number | null;
  showNames: boolean;
  round: Round;
}

/** A pupil's kept question (pupils can't read these). */
export interface StoredQuestion {
  slot: number;
  question: Question;
  golden: boolean;
  answered: boolean;
}

export interface Change {
  round: Round;
  view: RoomView;
  startedAt: number | null;
  pausedAt: number | null;
  players: PlayerView[];
  events: FeedEvent[];
  /** Marks this question answered in the same save (refused as 'answered' if it already was). */
  claim?: { player: string; slot: number; value: number; right: boolean };
}

export type Busy = 'busy';

export interface ShowdownServices {
  now(): number;
  random(): number;
  /** Does this teacher teach this class, and is Class Showdown switched on for it? Null if they don't teach it. */
  teacherClass(teacher: string, classId: string): Promise<{ enabled: boolean; showNames: boolean } | null | Busy>;
  /** A pupil's class, first name and switch. Null if they aren't a pupil in a class. */
  pupil(player: string): Promise<{ classId: string; name: string; enabled: boolean } | null | Busy>;
  mathsContext(player: string): Promise<MathsContext | null>;
  /** Makes a room (any other open room of the class is closed). */
  openRoom(classId: string, teacher: string, arena: Arena, round: Round, view: RoomView): Promise<number | Busy>;
  loadRoom(room: number): Promise<RoomRow | null | Busy>;
  /** The class's open room (lobby, live or just over), newest first. */
  classRoom(classId: string): Promise<RoomRow | null | Busy>;
  /** Saves a step if the room is still at `version`. */
  save(room: number, version: number, change: Change): Promise<'ok' | 'stale' | 'answered' | Busy>;
  /** The pupil's question not yet answered (the newest), or null. */
  openQuestion(room: number, player: string): Promise<StoredQuestion | null | Busy>;
  loadQuestion(room: number, player: string, slot: number): Promise<StoredQuestion | null | Busy>;
  /** Keeps a new question at the pupil's next slot, unless one is still open: then that one comes back. */
  keepQuestion(room: number, player: string, question: Question, golden: boolean): Promise<StoredQuestion | Busy>;
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** All the pupils' rows of a room, for the projector after a refresh. */
  roomPlayers?(room: number): Promise<PlayerView[] | Busy>;
  /** The bosses this class has beaten, with its best time (ms) for each. */
  classRoster(classId: string): Promise<Partial<Record<BossId, number>> | Busy>;
  /** Each pupil's own favourite game that a Showdown chest can pay into. */
  chestGames(players: string[]): Promise<Record<string, ChestGame>>;
  /** Pays out a finished round (points, chests, achievement counts) and records the roster. Once per round (room + seed). */
  finishRound(room: number, done: FinishedRound): Promise<void>;
}

/** A finished round, for `finishRound`. */
export interface FinishedRound {
  classId: string;
  seed: number;
  boss: BossId;
  beaten: boolean;
  /** False in Gold Rush: a win there doesn't beat a boss. */
  roster: boolean;
  /** How long the round took (ms). */
  ms: number;
  players: { player: string; points: number; game: ChestGame; amount: number; beaten: boolean; lastHit: boolean; shields: number; revives: number; bestStreak: number; correct: number }[];
}

export type StepReply = { status: number; body: Record<string, unknown> };

const MAX_TRIES = 8;
const MAX_ANSWER_MS = 60_000;
const OFF = 'Class Showdown is switched off for your class.';
const ok = (body: Record<string, unknown>): StepReply => ({ status: 200, body });
const no = (status: number, error: string, code?: string): StepReply => ({ status, body: { error, ...(code ? { code } : {}) } });
const busy = (): StepReply => no(503, "We couldn't reach the showdown just now.");

/** The time in the round (ms from its start) right now: frozen while paused, 0 in the lobby. */
export function roundTime(row: Pick<RoomRow, 'startedAt' | 'pausedAt'>, now: number): number {
  if (row.startedAt === null) return 0;
  return Math.max(0, (row.pausedAt ?? now) - row.startedAt);
}

export function roomView(row: Pick<RoomRow, 'arena' | 'startedAt' | 'pausedAt' | 'showNames'>, r: Round): RoomView {
  return {
    state: r.state, mode: r.mode, arena: row.arena, bossId: r.bossId ?? 'river-titan',
    seams: openSeamsOf(r).map((x) => ({ id: x.id, kind: x.kind, x: x.x, y: x.y, left: Math.round(x.left), size: x.size, diggers: diggersAt(r, x.id).length })), lengthMin: r.lengthMin, startedAt: row.startedAt, pausedAt: row.pausedAt, t: r.t,
    players: r.order.length, boss: { ...r.boss }, teams: [...r.teams], teamPoints: { ...r.teamPoints },
    teamDamage: Object.fromEntries(Object.entries(r.teamDamage).map(([k, v]) => [k, Math.round((v ?? 0) * 10) / 10])),
    tug: Math.round(r.tug * 1000) / 1000, facing: r.facing, weakSpotUntil: r.weakSpotUntil, goldenFrom: r.goldenFrom, goldenUntil: r.goldenUntil,
    enrageUntil: r.enrageUntil, roleSwapUntil: r.roleSwapUntil, finalStarted: r.finalStarted,
    windUp: r.windUp
      ? { endsAt: r.windUp.endsAt, enraged: r.windUp.enraged, groups: Object.fromEntries(Object.entries(r.windUp.groups).map(([k, g]) => [k, { needed: g.needed, got: g.got, done: g.done }])) }
      : null,
    result: r.result, showNames: row.showNames,
    island: r.arena === 'island' ? islandView(r) : null,
    roles: roleCounts(r),
    auction: r.arena === 'auction' && r.auction ? auctionView(r) : null,
    crown: r.arena === 'hill' && r.crown ? { holder: r.crown.holder, team: r.crown.team, since: r.crown.since, nextAt: r.crown.nextAt, contenders: contenders(r).slice(0, 3), held: { ...r.crown.held } } : null,
  };
}

function roleCounts(r: Round): RoomView['roles'] {
  const out: RoomView['roles'] = { all: { striker: 0, guard: 0, healer: 0 } };
  for (const id of r.order) {
    const p = r.players[id];
    out.all[p.role]++;
    if (p.team) (out[p.team] ??= { striker: 0, guard: 0, healer: 0 })[p.role]++;
  }
  return out;
}

function auctionView(r: Round): NonNullable<RoomView['auction']> {
  const a = r.auction!;
  const lot = openLot(r);
  const sold = a.lots.filter((l) => l.end === 'sold' && l.topBy).map((l) => ({ id: l.id, kind: l.kind, value: l.value, bid: l.top, by: l.topBy!, team: r.players[l.topBy!]?.team ?? null }));
  const rich = r.order.map((id) => r.players[id]).filter((p) => p.score > 0).sort((x, y) => y.score - x.score).slice(0, 5).map((p) => ({ id: p.id, fortune: p.score, vault: vaultOf(p) }));
  return {
    lot: lot ? { id: lot.id, kind: lot.kind, value: lot.kind === 'mystery' ? null : lot.value, min: lot.min, endsAt: lot.endsAt, top: lot.top, topBy: lot.topBy, topTeam: lot.topBy ? r.players[lot.topBy]?.team ?? null : null, bids: lot.bids } : null,
    nextAt: a.nextAt, sold, rich, steps: AUCTION.steps,
  };
}

function islandView(r: Round): NonNullable<RoomView['island']> {
  const spots: Record<string, [number, number, number]> = {};
  for (const id of r.order) {
    const s = spotOf(r, r.players[id]);
    spots[id] = [s.a, Math.round(s.d * 1000) / 1000, s.rock ? 1 + s.swim : 0];
  }
  return { shore: Math.round(shoreAt(r) * 1000) / 1000, spots };
}

/** Solo: the ids of the top 10 by score (pupils with no points yet never count). */
function topTenOf(r: Round): Set<string> {
  if (r.mode !== 'solo') return new Set();
  return new Set(r.order.map((k) => r.players[k]).filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 10).map((p) => p.id));
}

export function playerView(p: Player, top: Set<string> = new Set()): PlayerView {
  return {
    topTen: top.has(p.id),
    reward: p.reward ?? null,
    seam: p.seam ?? null,
    coins: coinsOf(p), vault: vaultOf(p),
    player: p.id, name: p.name, team: p.team, role: p.role, score: p.score, streak: p.streak, bestStreak: p.bestStreak, correct: p.correct,
    wrong: p.wrong, shields: p.shields, revives: p.revives, nextAt: p.nextAt, dazedUntil: p.dazedUntil,
  };
}

/** Every pupil id an event names, so the feed can carry their first names. */
function pupilsIn(e: FeedEvent): string[] {
  const out: string[] = [];
  const x = e as Record<string, unknown>;
  for (const k of ['pupil', 'woke', 'lastHit']) if (typeof x[k] === 'string') out.push(x[k] as string);
  for (const k of ['guards', 'dazed', 'pupils']) if (Array.isArray(x[k])) out.push(...(x[k] as string[]));
  if (e.type === 'recap') {
    out.push(...e.recap.awards.map((a) => a.pupil), ...e.recap.top.map((t) => t.pupil));
    if (e.recap.winner && 'pupil' in e.recap.winner) out.push(e.recap.winner.pupil);
  }
  return out;
}

/** Events for the feed: not wrong answers (iPad only), each with the names it needs; a recap when the round ends. */
export function feedOf(r: Round, events: ShowdownEvent[], wasOver: boolean): FeedEvent[] {
  const out: FeedEvent[] = events.filter((e) => e.type !== 'wrong');
  if (!wasOver && r.state === 'over') out.push({ type: 'recap', t: r.t, recap: recap(r) });
  return out.map((e) => {
    const ids = [...new Set(pupilsIn(e))].filter((id) => r.players[id]);
    return ids.length ? { ...e, names: Object.fromEntries(ids.map((id) => [id, r.players[id].name])) } : e;
  });
}

/** The players whose own rows changed in this step. */
function changedPlayers(before: Record<string, string>, r: Round): PlayerView[] {
  const top = topTenOf(r);
  return r.order.map((id) => playerView(r.players[id], top)).filter((v) => before[v.player] !== JSON.stringify(v));
}

const snapshot = (r: Round) => {
  const top = topTenOf(r);
  return Object.fromEntries(r.order.map((id) => [id, JSON.stringify(playerView(r.players[id], top))]));
};

/** Ladder place (count of secure skills), only to mix teams fairly. Never shown. */
function ladderOf(context: MathsContext | null): number {
  if (!context) return 0;
  try {
    return ladderProgress(context.facts, { enabledTables: context.settings.enabledTables, division: context.settings.division }).secureCount;
  } catch {
    return 0;
  }
}

/** The pupil's next question from their own focus pack (way A), or the golden one from their easiest skill. */
/**
 * A question for one pupil. Whole-class games leave out the ladder's untimed skills (James, 23 Nov 2026): rounding, order of
 * operations, number lines and the like take working out, and a live round is quick recall. A pupil whose skill is all
 * untimed still gets their review facts, and times tables if nothing else comes.
 */
export function makeQuestion(context: MathsContext, seed: string, golden: boolean): Question | null {
  for (let attempt = 0; attempt < 16; attempt++) {
    const random = seededRandom(`${seed}:${attempt}`);
    const pack = makeSpacePack(context.facts, context.focus, context.settings, random);
    let q: Question | null = null;
    if (golden) {
      q = pack.nextQuestion({
        enabledTables: context.settings.enabledTables, division: context.settings.division, missingFactor: context.settings.missingFactor,
        multipleChoice: context.settings.multipleChoice, boxes: [...SHOWDOWN.golden.boxes],
      }) ?? null;
    }
    q ??= pickSpaceQuestion(pack, context.settings);
    if (q && !isUntimed(q.factKey) && markQuestion(q)) return q;
  }
  const q = new TimesTables([], seededRandom(`${seed}:tt`)).nextQuestion({ level: 1 });
  return q && markQuestion(q) ? q : null;
}

type Mutation<T> = (r: Round, t: number, row: RoomRow) => { reply: T; events: ShowdownEvent[]; startedAt?: number | null; pausedAt?: number | null; claim?: Change['claim']; extra?: FeedEvent[] } | { refuse: StepReply };

/**
 * Loads the room, applies one step, saves it if nobody else saved first (else runs again on the newer round). Returns
 * the step's reply, the saved row, or a refusal.
 */
async function mutate<T>(s: ShowdownServices, room: number, step: Mutation<T>, opts: { saveIfQuiet?: boolean } = {}): Promise<{ reply: T; row: RoomRow; saved: boolean } | { refuse: StepReply }> {
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const row = await s.loadRoom(room);
    if (row === 'busy') return { refuse: busy() };
    if (!row) return { refuse: no(404, "That showdown couldn't be found.", 'gone') };
    const r = row.round;
    const wasOver = r.state === 'over';
    const before = snapshot(r);
    const t = roundTime(row, s.now());
    const out = step(r, t, row);
    if ('refuse' in out) return out;
    // The round has just ended: put each pupil's reward on their row, in this same save.
    if (!wasOver && r.state === 'over') await giveRewards(s, r);
    const startedAt = out.startedAt !== undefined ? out.startedAt : row.startedAt;
    const pausedAt = out.pausedAt !== undefined ? out.pausedAt : row.pausedAt;
    const events = [...feedOf(r, out.events, wasOver), ...(out.extra ?? [])];
    const players = changedPlayers(before, r);
    // Nothing happened (a projector tick between events): no save, no version bump.
    if (!events.length && !players.length && !out.claim && out.startedAt === undefined && out.pausedAt === undefined && !opts.saveIfQuiet) {
      return { reply: out.reply, row, saved: false };
    }
    const next = { ...row, startedAt, pausedAt };
    const saved = await s.save(room, row.version, { round: r, view: roomView(next, r), startedAt, pausedAt, players, events, claim: out.claim });
    if (saved === 'busy') return { refuse: busy() };
    if (saved === 'answered') return { refuse: no(409, "You've already answered that one.", 'answered') };
    if (saved === 'ok') {
      const savedRow = { ...next, version: row.version + 1, round: r };
      if (!wasOver && r.state === 'over') await finish(s, savedRow);
      return { reply: out.reply, row: savedRow, saved: true };
    }
    // 'stale': someone else saved first. Wait a moment (a little random, so iPads don't collide again) and run again.
    await new Promise((done) => setTimeout(done, 5 + Math.floor(s.random() * 25 * (tries + 1))));
  }
  return { refuse: no(503, 'The showdown is very busy. Try again!', 'busy') };
}

/** Sets every pupil's reward for the round just ended (their favourite game's chest, points). */
async function giveRewards(s: ShowdownServices, r: Round) {
  const games = r.order.length ? await s.chestGames(r.order).catch(() => ({}) as Record<string, ChestGame>) : {};
  for (const id of r.order) {
    const p = r.players[id];
    p.reward = rewardFor(games[id] ?? 'archery', r.result === 'beaten', p.correct);
  }
}

/** Pays out a finished round. A failure is only logged: the round is saved, and `view` tries again (once per round). */
async function finish(s: ShowdownServices, row: RoomRow) {
  const r = row.round;
  if (r.state !== 'over') return;
  const beaten = r.result === 'beaten';
  const done: FinishedRound = {
    // The other arenas pay the same, but only a beaten boss goes on the roster.
    classId: row.classId, seed: r.seed, boss: r.bossId ?? 'river-titan', beaten, roster: (r.arena ?? 'boss') === 'boss', ms: Math.round(r.t),
    players: r.order.map((id) => r.players[id]).filter((p) => p.reward).map((p) => ({
      player: p.id, points: p.reward!.points, game: p.reward!.chest.game, amount: p.reward!.chest.amount, beaten,
      lastHit: r.lastHit === p.id, shields: p.shields, revives: p.revives, bestStreak: p.bestStreak, correct: p.correct,
    })),
  };
  try {
    await s.finishRound(row.id, done);
  } catch (e) {
    console.error('showdown finishRound failed', row.id, e);
  }
}

/** The class's roster for the projector. */
async function rosterOf(s: ShowdownServices, classId: string): Promise<RosterRow[] | null> {
  const beaten = await s.classRoster(classId);
  return beaten === 'busy' ? null : roster(beaten);
}

const readRoom = (v: unknown): number | null => (Number.isSafeInteger(v) && (v as number) > 0 ? (v as number) : null);

/** One request from a signed-in person (`who`). */
export async function showdownStep(s: ShowdownServices, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const action = body.action;

  // ---- Teacher steps ----
  if (action === 'open') {
    const classId = typeof body.classId === 'string' && /^[0-9a-f-]{36}$/i.test(body.classId) ? body.classId : null;
    const mode = MODES.find((m) => m === body.mode) ?? 'class';
    const length = typeof body.length === 'number' && (SHOWDOWN.lengths as readonly number[]).includes(body.length) ? body.length : SHOWDOWN.defaultLength;
    if (!classId) return no(400, 'Pick a class first.');
    const teach = await s.teacherClass(who, classId);
    if (teach === 'busy') return busy();
    if (!teach) return no(403, "That isn't one of your classes.", 'not-yours');
    if (!teach.enabled) return no(403, OFF, 'off');
    const beaten = await s.classRoster(classId);
    if (beaten === 'busy') return busy();
    const arena: Arena = ARENAS.find((a) => a === body.arena) ?? 'boss';
    const round = newRound({ seed: Math.floor(s.random() * 2 ** 31), mode, lengthMin: length });
    round.bossId = pickBoss(beaten, body.boss);
    if (arena !== 'boss') round.arena = arena;
    const view = roomView({ arena, startedAt: null, pausedAt: null, showNames: teach.showNames }, round);
    const id = await s.openRoom(classId, who, arena, round, view);
    if (id === 'busy') return busy();
    return ok({ room: id, view, roster: roster(beaten) });
  }

  if (action === 'view' || action === 'tick' || action === 'teams' || action === 'start' || action === 'enrage' || action === 'pause' || action === 'end' || action === 'again') {
    const room = readRoom(body.room);
    if (!room) return no(400, "That showdown couldn't be found.");
    const row = await s.loadRoom(room);
    if (row === 'busy') return busy();
    if (!row || row.teacher !== who) {
      // Only the teacher who opened it (and still teaches the class) runs the projector.
      return no(403, "That isn't your showdown.", 'not-yours');
    }
    const teach = await s.teacherClass(who, row.classId);
    if (teach === 'busy') return busy();
    if (!teach) return no(403, "That isn't one of your classes.", 'not-yours');
    if (!teach.enabled && action !== 'view' && action !== 'end') return no(403, OFF, 'off');

    if (action === 'view') {
      // The projector after a load or refresh: the room, every pupil and the recap if it's over. It also brings the round up to now.
      const done = await mutate(s, room, (r, t) => ({ reply: null, events: row.pausedAt === null ? advance(r, t) : [] }));
      if ('refuse' in done) return done.refuse;
      const r = done.row.round;
      // A round that ended without being paid out (the server stopped in between) is paid now: finishRound runs once per round.
      if (r.state === 'over' && !done.saved) await finish(s, done.row);
      const rosterRows = await rosterOf(s, row.classId);
      return ok({
        room, view: roomView(done.row, r), now: s.now(), version: done.row.version,
        players: r.order.map((id) => playerView(r.players[id], topTenOf(r))),
        ...(r.state === 'over' ? { recap: recap(r) } : {}),
        ...(rosterRows ? { roster: rosterRows } : {}),
      });
    }

    if (action === 'again') {
      // "Again?": the same room, mode, length and teams, the next boss (or the one asked for). Pupils stay in.
      const beaten = await s.classRoster(row.classId);
      if (beaten === 'busy') return busy();
      const done = await mutate(s, room, (r) => {
        if (r.state !== 'over') return { refuse: no(409, 'Finish this round first.', 'not-now') };
        const fresh = newRound({ seed: Math.floor(s.random() * 2 ** 31), mode: r.mode, lengthMin: r.lengthMin });
        const bossRound = (r.arena ?? 'boss') === 'boss';
        fresh.bossId = bossRound ? pickBoss(beaten, body.boss, r.bossId ?? 'river-titan') : r.bossId;
        if (!bossRound) fresh.arena = r.arena;
        const events: ShowdownEvent[] = [];
        for (const id of r.order) {
          const old = r.players[id];
          const out = join(fresh, { id, name: old.name, ladder: old.ladder }, 0);
          if (!out.ok) continue;
          events.push(...out.events);
          if (old.team && fresh.teams.includes(old.team)) moveToTeam(fresh, id, old.team);
          fresh.players[id].role = old.role;
        }
        fresh.teamsByHand = r.teamsByHand;
        for (const k of Object.keys(r) as (keyof Round)[]) delete r[k];
        Object.assign(r, fresh);
        return { reply: null, events, startedAt: null, pausedAt: null, extra: [{ type: 'again', t: 0, boss: fresh.bossId }] as FeedEvent[] };
      });
      if ('refuse' in done) return done.refuse;
      const r = done.row.round;
      return ok({ room, view: roomView(done.row, r), now: s.now(), players: r.order.map((id) => playerView(r.players[id], topTenOf(r))), roster: roster(beaten) });
    }

    const done = await mutate(s, room, (r, t, cur) => {
      if (action === 'tick') return { reply: null, events: cur.pausedAt === null ? advance(r, t) : [] };
      if (action === 'teams') {
        if (body.reshuffle === true) {
          if (!reshuffle(r, (r.seed + Math.floor(s.random() * 1e6)) >>> 0)) return { refuse: no(409, 'Teams can only be mixed before the start.', 'not-now') };
          r.teamsByHand = false;
          return { reply: null, events: r.order.map((id) => ({ type: 'team_move' as const, t: r.t, pupil: id, team: r.players[id].team as TeamId })) };
        }
        const team = r.teams.find((k) => k === body.team);
        if (typeof body.pupil !== 'string' || !team) return { refuse: no(400, 'Pick a pupil and a team.') };
        const out = moveToTeam(r, body.pupil, team);
        if (!out.ok) return { refuse: no(409, "That move couldn't be made.", out.reason) };
        return { reply: null, events: out.events };
      }
      if (action === 'start') {
        const out = start(r);
        if (!out.ok) return { refuse: no(409, 'It has already started.', 'not-now') };
        return { reply: null, events: out.events, startedAt: s.now(), pausedAt: null };
      }
      if (action === 'enrage') {
        if (cur.pausedAt !== null) return { refuse: no(409, 'It is paused.', 'paused') };
        const out = enrage(r, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'cooldown' ? 'The boss is still calming down.' : 'Not now.', out.reason) };
        return { reply: null, events: out.events };
      }
      if (action === 'pause') {
        if (r.state !== 'live') return { refuse: no(409, 'Not now.', 'not-now') };
        const resume = body.resume === true;
        if (resume === (cur.pausedAt === null)) return { reply: null, events: [] };
        if (!resume) {
          const events = advance(r, t);
          return { reply: null, events, pausedAt: s.now(), extra: [{ type: 'pause', t: r.t }] };
        }
        // Resume: the clock carries on from where it stopped (the start moves on by the time spent paused).
        const startedAt = (cur.startedAt ?? s.now()) + (s.now() - (cur.pausedAt as number));
        return { reply: null, events: [], startedAt, pausedAt: null, extra: [{ type: 'resume', t: r.t }] };
      }
      // end: stop now (time up), or close the lobby.
      if (r.state === 'over') return { reply: null, events: [] };
      const events = r.state === 'live' && cur.pausedAt === null ? advance(r, t) : [];
      // (advance may have ended it already)
      if ((r.state as Round['state']) !== 'over') {
        const wasLive = r.state === 'live';
        r.state = 'over';
        r.result = 'time';
        if (wasLive) events.push({ type: 'time_up', t: r.t });
      }
      return { reply: null, events, pausedAt: null, extra: [{ type: 'ended', t: r.t }] };
    });
    if ('refuse' in done) return done.refuse;
    const r = done.row.round;
    return ok({ room, view: roomView(done.row, r), now: s.now(), ...(r.state === 'over' ? { recap: recap(r) } : {}) });
  }

  // ---- Pupil steps ----
  if (action === 'join' || action === 'choose' || action === 'ask' || action === 'answer' || action === 'look') {
    const me = await s.pupil(who);
    if (me === 'busy') return busy();
    if (!me) return no(403, 'Class Showdown is for pupils in a class.', 'no-class');
    if (!me.enabled) return no(403, OFF, 'off');
    let room: number | null;
    if (action === 'join') {
      const open = await s.classRoom(me.classId);
      if (open === 'busy') return busy();
      if (!open || open.round.state === 'over') return no(404, 'There is no showdown on in your class right now.', 'none');
      room = open.id;
    } else room = readRoom(body.room);
    if (!room) return no(400, "That showdown couldn't be found.");
    const cur = await s.loadRoom(room);
    if (cur === 'busy') return busy();
    if (!cur || cur.classId !== me.classId) return no(403, "That showdown isn't in your class.", 'not-yours');

    if (action === 'join') {
      const context = cur.round.players[who] ? null : await s.mathsContext(who);
      const ladder = ladderOf(context);
      const done = await mutate(s, room, (r, t, row) => {
        const out = join(r, { id: who, name: me.name, ladder }, row.pausedAt === null ? t : r.t);
        if (!out.ok) return { refuse: no(409, 'This showdown has finished.', 'over') };
        return { reply: null, events: out.events };
      });
      if ('refuse' in done) return done.refuse;
      const r = done.row.round;
      const question = r.state === 'live' ? await nextQuestion(s, done.row, who, context) : null;
      if (question === 'busy') return busy();
      return ok({ room, view: roomView(done.row, r), me: playerView(r.players[who], topTenOf(r)), now: s.now(), ...(question ? { question } : {}) });
    }

    if (!cur.round.players[who]) return no(409, 'Join the showdown first.', 'not-playing');

    // look: the room and this pupil, read only. The iPads ask every couple of seconds rather than each listening to every
    // change of the room row: with a class of iPads that fan-out went over Realtime's messages-per-second limit, changes
    // were dropped, and pupils never saw the round end (24 Nov 2026).
    if (action === 'look') return ok({ room, view: roomView(cur, cur.round), me: playerView(cur.round.players[who], topTenOf(cur.round)), now: s.now() });

    if (action === 'choose' && typeof body.seam === 'number') {
      const seam = body.seam;
      const done = await mutate(s, room, (r, t, row) => {
        if (r.arena !== 'goldrush' || r.state !== 'live') return { refuse: no(409, 'Pick a seam once the Gold Rush starts.', 'not-now') };
        const events = row.pausedAt === null ? advance(r, t) : [];
        if (r.players[who]?.seam === seam) return { reply: null, events };
        if (!chooseSeam(r, who, seam)) return { refuse: no(409, 'That seam has run dry. Pick another!', 'dry') };
        // Picking counts as digging, so the seam's count of diggers shows it straight away.
        r.players[who].lastActive = r.t;
        return { reply: null, events: [...events, { type: 'seam_pick' as const, t: r.t, pupil: who, seam }] };
      });
      if ('refuse' in done) return done.refuse;
      return ok({ room, me: playerView(done.row.round.players[who], topTenOf(done.row.round)), view: roomView(done.row, done.row.round), now: s.now() });
    }

    if (action === 'choose' && typeof body.bid === 'number') {
      const amount = body.bid;
      const said: Record<BidRefusal, string> = {
        no_lot: 'Bidding has closed. Wait for the next treasure!',
        too_low: 'Someone bid more! Try a higher bid.',
        too_poor: "You haven't got that many coins. Answer more to earn them!",
        own_team: 'Your team is already winning this one!',
        already_top: "You're already the top bid!",
      };
      const done = await mutate(s, room, (r, t, row) => {
        if (r.arena !== 'auction' || r.state !== 'live') return { refuse: no(409, 'Bid once the auction starts.', 'not-now') };
        const events = row.pausedAt === null ? advance(r, t) : [];
        if (row.pausedAt !== null) return { refuse: no(409, 'Paused. Look at the teacher.', 'paused') };
        const refused = bid(r, who, amount, events);
        if (refused) return { refuse: no(409, said[refused], refused) };
        return { reply: null, events };
      });
      if ('refuse' in done) return done.refuse;
      return ok({ room, me: playerView(done.row.round.players[who], topTenOf(done.row.round)), view: roomView(done.row, done.row.round), now: s.now() });
    }

    if (action === 'choose') {
      const role = ROLES.find((k) => k === body.role);
      if (!role) return no(400, 'Pick Striker, Guard or Healer.');
      const done = await mutate(s, room, (r, t, row) => {
        const out = chooseRole(r, who, role, row.pausedAt === null ? t : r.t);
        if (!out.ok) return { refuse: no(409, 'Roles can be changed at the start and after the boss changes form.', out.reason) };
        return { reply: null, events: out.events };
      });
      if ('refuse' in done) return done.refuse;
      return ok({ room, me: playerView(done.row.round.players[who], topTenOf(done.row.round)), now: s.now() });
    }

    if (action === 'ask') {
      if (cur.round.state !== 'live') {
        // With the room as it is, so the iPad moves on to the finish screen (or the lobby) straight away.
        const refuse = no(409, cur.round.state === 'lobby' ? 'Wait for the start!' : 'This showdown has finished.', cur.round.state === 'lobby' ? 'lobby' : 'over');
        return { ...refuse, body: { ...refuse.body, view: roomView(cur, cur.round), me: playerView(cur.round.players[who], topTenOf(cur.round)) } };
      }
      const question = await nextQuestion(s, cur, who, null);
      if (question === 'busy') return busy();
      if (!question) return no(503, "We couldn't make a question just now.");
      return ok({ room, question, now: s.now() });
    }

    // answer: mark it against the kept question, then the engine's answer, then the claim, all in one save.
    const slot = body.slot;
    const value = body.answer;
    if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) {
      return no(400, "That answer couldn't be read.");
    }
    const kept = await s.loadQuestion(room, who, slot as number);
    if (kept === 'busy') return busy();
    const marked = kept ? markQuestion(kept.question) : null;
    if (!kept || !marked) return no(400, "That answer couldn't be marked.");
    if (kept.answered) return no(409, "You've already answered that one.", 'answered');
    const right = sameAnswer(value, marked.answer);
    const done = await mutate(s, room, (r, t, row) => {
      if (row.pausedAt !== null) return { refuse: no(409, 'The teacher has paused the showdown.', 'paused') };
      const out = answer(r, who, right, t, { golden: kept.golden });
      if (!out.ok) {
        const words: Record<string, string> = { too_soon: 'Wait for the ring to fill!', dazed: "You're dazed! Wait for the stars to stop.", not_live: 'This showdown has finished.' };
        const refuse = no(409, words[out.reason] ?? 'Not now.', out.reason);
        // A round that has just ended: the room comes back too, so the iPad shows the finish screen at once.
        return { refuse: out.reason === 'not_live' ? { ...refuse, body: { ...refuse.body, view: roomView(row, r), me: playerView(r.players[who], topTenOf(r)) } } : refuse };
      }
      return { reply: out.events, events: out.events, claim: { player: who, slot: slot as number, value, right } };
    });
    if ('refuse' in done) {
      // Refused for pace or daze: say when to try again, so the ring can show it.
      const p = cur.round.players[who];
      return { ...done.refuse, body: { ...done.refuse.body, nextAt: p.nextAt, dazedUntil: p.dazedUntil, now: s.now() } };
    }
    const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS, MAX_ANSWER_MS));
    try {
      await s.recordAnswers(who, `showdown:${room}:${cur.round.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: s.now(), given: value }]);
    } catch {
      // The maths records are a bonus: the hit still counts.
    }
    const r = done.row.round;
    const mine = (done.reply ?? []).filter((e) => ('pupil' in e && e.pupil === who) || e.type === 'shield_broke' || e.type === 'revive');
    const question = r.state === 'live' ? await nextQuestion(s, done.row, who, null) : null;
    return ok({
      room, right, answer: marked.answer, me: playerView(r.players[who], topTenOf(r)), events: mine, view: roomView(done.row, r), now: s.now(),
      ...(question && question !== 'busy' ? { question } : {}),
    });
  }

  return no(400, "That couldn't be read.");
}

/** The pupil's open question, or a new one (golden when the engine says so). Null if none could be made. */
async function nextQuestion(s: ShowdownServices, row: RoomRow, who: string, context: MathsContext | null): Promise<(PublicQuestion & { golden: boolean }) | null | Busy> {
  const open = await s.openQuestion(row.id, who);
  if (open === 'busy') return 'busy';
  if (open) return { ...publicQuestion(open.question, open.slot), golden: open.golden };
  const ctx = context ?? (await s.mathsContext(who));
  if (!ctx) return null;
  const t = roundTime(row, s.now());
  const golden = goldenNext(row.round, who, t);
  const q = makeQuestion(ctx, `${row.round.seed}:${who}:${row.round.players[who]?.correct ?? 0}:${row.round.players[who]?.wrong ?? 0}:${golden}`, golden);
  if (!q) return null;
  const kept = await s.keepQuestion(row.id, who, q, golden);
  if (kept === 'busy') return 'busy';
  return { ...publicQuestion(kept.question, kept.slot), golden: kept.golden };
}

/** Is the round's time over (for the projector's clock)? */
export const timeLeft = (view: Pick<RoomView, 'lengthMin' | 't'>) => Math.max(0, view.lengthMin * 60000 - view.t);
export { roundMs };
