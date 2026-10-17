/**
 * Saving a Wormholes & Black Holes game against bots.
 *
 * Before a game, the server hands out a seed with a stamp (a signature only the server can
 * make). The browser plays the whole game from that seed. At the end it sends the seed,
 * the stamp, the settings and the student's own actions, and the server replays the game
 * here before saving it. The stamp means the seed really came from the server; the replay
 * means the result really came from that seed. Points are the same win or lose, so there's
 * nothing to gain from cheating anyway.
 */
import { isBotLevelId, isClaimedEnding, type BotLevel, type ClaimedEnding, type Outcome } from '../botGame';
import { STAR_KINDS, type StarKind } from './board';
import { isDesignedBoardId, type BoardChoice } from './boards';
import type { FactAnswer } from '../maths/leitner';
import { solveQuestion } from '../maths/skillPacks/timesTables';
import type { SpaceAction, SpaceEvent, SpaceState, Settings } from './engine';
import { parseGalaxyCode } from './galaxy';
import { isItemKind } from './items';
import { replaySolo, type SoloSetup } from './replay';

/** Games where the student had fewer turns than this earn nothing. Lower than chess's 10
 * moves, because a quick-board game is only about 10 rounds. */
export const MIN_TURNS_TO_COUNT = 5;
/** How long a seed can be used for. A real game takes minutes; a forgotten tab, hours. */
export const SEED_LIFETIME_SECONDS = 12 * 60 * 60;
/** The most actions a save can carry (bot_games keeps up to 1,000; a long game is ~200). */
export const MAX_SAVED_ACTIONS = 1000;

const SEED_PATTERN = /^s1-(\d{10})-[0-9a-f]{24}$/;
const SEAT_NAMES = ['first', 'second', 'third', 'fourth'] as const;

// ---------- Seeds ----------

/** A new seed: when it was made and 12 random bytes. */
export function makeSeed(nowSeconds: number, randomHex: string): string {
  return `s1-${String(Math.floor(nowSeconds)).padStart(10, '0')}-${randomHex}`;
}

/** What the server signs: the seed and who it was given to, so a seed can't be shared. */
export function stampText(player: string, seed: string): string {
  return `space-seed:v1:${player}:${seed}`;
}

/** Null if the seed is well made and still fresh, else what's wrong. */
export function seedProblem(seed: string, nowSeconds: number): string | null {
  const match = SEED_PATTERN.exec(seed);
  if (!match) return 'not a server seed';
  const age = nowSeconds - Number(match[1]);
  if (age < -300) return 'seed from the future';
  if (age > SEED_LIFETIME_SECONDS) return 'seed too old';
  return null;
}

// ---------- Actions, written as short text ----------

/** "roll", "charge:1" (right) or "charge:0", "choose:1", "use:booster", "use:tractor-beam@2", "use:navigator=6". */
export function encodeAction(action: SpaceAction): string {
  switch (action.kind) {
    case 'roll':
      return 'roll';
    case 'charge':
      return action.right ? 'charge:1' : 'charge:0';
    case 'timeout':
      return 'timeout';
    case 'choose':
      return `choose:${action.option}`;
    case 'use-item':
      return `use:${action.item}${action.target !== undefined ? `@${action.target}` : ''}${action.value !== undefined ? `=${action.value}` : ''}`;
  }
}

/** The opposite of encodeAction. Null for anything it wouldn't make (timeouts too: solo games have no timer). */
export function decodeAction(text: string): SpaceAction | null {
  if (text === 'roll') return { kind: 'roll' };
  if (text === 'charge:1' || text === 'charge:0') return { kind: 'charge', right: text === 'charge:1' };
  const choose = /^choose:([0-3])$/.exec(text);
  if (choose) return { kind: 'choose', option: Number(choose[1]) };
  const use = /^use:([a-z-]{1,20})(?:@([0-3]))?(?:=([1-6]))?$/.exec(text);
  if (use && isItemKind(use[1])) {
    return {
      kind: 'use-item',
      item: use[1],
      ...(use[2] !== undefined ? { target: Number(use[2]) } : {}),
      ...(use[3] !== undefined ? { value: Number(use[3]) } : {}),
    };
  }
  return null;
}

// ---------- Mission Control maths answers ----------

/** One maths question the student answered: how it was shown, what they typed, how long, when. */
export interface SpaceMathsAnswer {
  parts: string[];
  given: number;
  ms: number;
  at: number;
}

/** More answers than a game could ever ask. */
export const MAX_SAVED_ANSWERS = 300;

function parseAnswers(input: unknown): SpaceMathsAnswer[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > MAX_SAVED_ANSWERS) return null;
  const answers: SpaceMathsAnswer[] = [];
  for (const raw of input) {
    const a = (raw ?? {}) as Record<string, unknown>;
    if (!Array.isArray(a.parts) || a.parts.length !== 5 || !a.parts.every((p) => typeof p === 'string' && p.length <= 4)) return null;
    const whole = (n: unknown, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
    if (!whole(a.given, 1000) || !whole(a.ms, 3_600_000) || !whole(a.at, 4_102_444_800_000)) return null;
    answers.push({ parts: a.parts as string[], given: a.given, ms: a.ms, at: a.at });
  }
  return answers;
}

// ---------- The report the browser sends ----------

export interface SpaceGameReport {
  game: 'space';
  seed: string;
  stamp: string;
  board: BoardChoice;
  settings: Settings;
  bots: number;
  level: BotLevel;
  /** The student's actions, from encodeAction. */
  actions: string[];
  ending: ClaimedEnding;
  /** Mission Control maths: one for each question the student answered, in order. */
  answers?: SpaceMathsAnswer[];
}

const isBool = (value: unknown): value is boolean => typeof value === 'boolean';

export function parseBoard(input: unknown): BoardChoice | null {
  if (typeof input !== 'object' || input === null) return null;
  const b = input as Record<string, unknown>;
  if ('id' in b) return isDesignedBoardId(b.id) && Object.keys(b).length === 1 ? { id: b.id } : null;
  if (typeof b.galaxy !== 'string' || b.galaxy.length > 40 || (b.size !== 100 && b.size !== 50)) return null;
  const galaxy = parseGalaxyCode(b.galaxy);
  return galaxy ? { galaxy, size: b.size } : null;
}

export function parseSettings(input: unknown): Settings | null {
  if (typeof input !== 'object' || input === null) return null;
  const s = input as Record<string, unknown>;
  if (s.mode !== 'classic' && s.mode !== 'cosmic') return null;
  if (s.finish !== 'any' && s.finish !== 'exact') return null;
  if (!isBool(s.rollAgainOnSix) || !isBool(s.cosmicEvents)) return null;
  if (!isBool(s.maths)) return null;
  return { mode: s.mode, finish: s.finish, rollAgainOnSix: s.rollAgainOnSix, cosmicEvents: s.cosmicEvents, maths: s.maths };
}

/** Checks the shape of a report that came from outside (e.g. the browser). */
export function parseSpaceReport(input: unknown): SpaceGameReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (r.game !== 'space') return null;
  if (typeof r.seed !== 'string' || r.seed.length > 64) return null;
  if (typeof r.stamp !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(r.stamp)) return null;
  const board = parseBoard(r.board);
  const settings = parseSettings(r.settings);
  if (!board || !settings) return null;
  if (r.bots !== 1 && r.bots !== 2 && r.bots !== 3) return null;
  if (!isBotLevelId(r.level) || !isClaimedEnding(r.ending) || r.ending === 'resigned') return null;
  if (!Array.isArray(r.actions) || r.actions.length > MAX_SAVED_ACTIONS) return null;
  if (!r.actions.every((a) => typeof a === 'string' && a.length <= 40)) return null;
  const answers = parseAnswers(r.answers);
  if (!answers) return null;
  return {
    game: 'space',
    seed: r.seed,
    stamp: r.stamp,
    board,
    settings,
    bots: r.bots,
    level: r.level,
    actions: r.actions as string[],
    ending: r.ending,
    answers,
  };
}

// ---------- Judging ----------

/** What the student did in one game, for the space achievements. */
export interface SpaceStats {
  wormholes: number;
  /** Black holes blocked by a Force Field. */
  blocks: number;
  /** The kinds of star they landed on. */
  stars: StarKind[];
  /** They reached the space station. */
  docked: boolean;
}

export type SpaceReason = 'docked' | 'out-of-fuel' | 'abandoned';

export interface JudgedSpaceGame {
  /** Won means 1st place (ties included); every other place is "lost". */
  outcome: Outcome;
  reason: SpaceReason;
  /** 1st, 2nd…; null if the student left before the end. */
  place: number | null;
  rockets: number;
  /** Where the student was in the turn order: 'first' to 'fourth'. */
  playerSide: (typeof SEAT_NAMES)[number];
  studentTurns: number;
  countsForPoints: boolean;
  stats: SpaceStats;
  /** The student's maths answers, checked, ready for their times-table records. */
  answers: FactAnswer[];
}

export type SpaceJudgement = { ok: true; game: JudgedSpaceGame } | { ok: false; problem: string };

/** Replays the game from its seed and works out the result. The stamp is checked separately. */
export function judgeSpaceGame(report: SpaceGameReport): SpaceJudgement {
  const actions: SpaceAction[] = [];
  for (const text of report.actions) {
    const action = decodeAction(text);
    if (!action) return { ok: false, problem: 'unreadable action' };
    actions.push(action);
  }
  const setup: SoloSetup = {
    seed: report.seed,
    board: report.board,
    settings: report.settings,
    bots: report.bots,
    level: report.level,
  };
  const events: SpaceEvent[] = [];
  // Every answer to a maths question must match the question shown and the choice made.
  const given = report.answers ?? [];
  const answers: FactAnswer[] = [];
  let mathsProblem: string | null = null;
  const checkAnswer = (before: SpaceState, action: SpaceAction) => {
    const asked = action.kind === 'choose' && before.pending?.kind === 'question';
    if (mathsProblem || (!asked && action.kind !== 'charge')) return;
    const claimedRight = action.kind === 'charge' ? action.right : action.kind === 'choose' && action.option === 1;
    const a = given[answers.length];
    const solved = a ? solveQuestion(a.parts) : null;
    if (!a || !solved) mathsProblem = 'missing maths answer';
    else if ((a.given === solved.answer) !== claimedRight) mathsProblem = 'maths answer does not match';
    else answers.push({ key: solved.key, correct: claimedRight, ms: a.ms, at: a.at });
  };
  let replayed: ReturnType<typeof replaySolo>;
  try {
    replayed = replaySolo(setup, actions, (batch) => events.push(...batch), checkAnswer);
  } catch {
    return { ok: false, problem: 'replay failed' };
  }
  if (!replayed.ok) return { ok: false, problem: replayed.reason };
  if (mathsProblem) return { ok: false, problem: mathsProblem };
  if (answers.length !== given.length) return { ok: false, problem: 'extra maths answers' };
  const { state, studentSeat, studentTurns, finished } = replayed;
  // A game the student says they finished must really be over. One they say they left
  // may have ended anyway (e.g. the page closed during the last animation): then it's finished.
  if (!finished && report.ending === 'finished') return { ok: false, problem: 'game not over' };

  const mine = events.filter((e): e is SpaceEvent & { seat: number } => 'seat' in e && e.seat === studentSeat);
  const stars = new Set(mine.flatMap((e) => (e.kind === 'star' ? [e.star] : [])));
  const stats: SpaceStats = {
    // With maths on, a wormhole ride is a 'question' event (right or wrong) instead.
    wormholes: mine.filter((e) => e.kind === 'wormhole' || (e.kind === 'question' && (e.moment ?? 'wormhole') === 'wormhole')).length,
    blocks: mine.filter((e) => e.kind === 'force-field').length,
    stars: STAR_KINDS.filter((k) => stars.has(k)),
    docked: mine.some((e) => e.kind === 'docked'),
  };
  const place = finished ? (state.places?.[studentSeat] ?? null) : null;
  return {
    ok: true,
    game: {
      outcome: place === 1 ? 'won' : 'lost',
      reason: !finished ? 'abandoned' : state.ending === 'mission-clock' ? 'out-of-fuel' : 'docked',
      place,
      rockets: report.bots + 1,
      playerSide: SEAT_NAMES[studentSeat],
      studentTurns,
      countsForPoints: finished && studentTurns >= MIN_TURNS_TO_COUNT,
      stats,
      answers,
    },
  };
}
