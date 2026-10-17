/**
 * Maths Monsters saving: what the website sends the `monster` server function, and the checks the
 * function makes before accepting it. Shared, so the website and the server agree.
 *
 * A save is the whole `WorldState` plus the battles fought since the last save (each with its
 * actions, the maths questions answered and the random numbers the rules drew). It is a
 * plausibility check, not a replay of the whole game (same reasoning as Gem Keep): each reported
 * battle IS replayed with `replayBattle`'s own rules, and the new world must be what those battles
 * (and nothing else) could have produced from the last good save.
 *
 * What is checked, in plain words:
 *  - the shape of everything (a team of 1 to 6, real monsters, levels that match their exp, a tile
 *    you can stand on, only real items, badges, chests and trainers);
 *  - exp and levels: the monsters you hold now (team + box together, ignoring order and health) are
 *    exactly the ones you held before, with the exp the replayed battles gave, plus what you caught.
 *    So levels cannot jump, and nothing is invented or lost;
 *  - every fight or catch in a battle carries a maths question that is made again here and marked,
 *    and the right / quick-right / wrong result has to agree with it;
 *  - a badge needs a won Tower battle against that Tower's trainer, a trainer pays only once, a chest
 *    opens only once, and you cannot be in an area you have not opened;
 *  - the bag can only hold what you had, plus the chests and prizes that are new, minus what battles used;
 *  - the monster book (seen, owned) and the badges, chests and paid trainers only ever grow;
 *  - answers per minute and steps per second must be something a person can do.
 * A save that fails any of these is refused as a whole (see supabase/functions/monster/handler.ts).
 */
import type { FactAnswer } from '../../maths/leitner';
import { quickSeconds } from '../bands';
import {
  MAX_TEAM, newBattle, play, questionFor, type Bag, type BattleAction, type BattleSetup, type BattleState, type ItemId,
} from '../engine';
import { WORLD_MAPS } from '../maps';
import { formAt, speciesOf } from '../monsterBook';
import { expForLevel, makeMonster, maxHpOf, TUNING, type Monster } from '../rules';
import { TYPES, type TypeId } from '../types';
import { BADGE_ORDER } from '../world/areas';
import { ENCOUNTERS, wildLevels, wildSpecies } from '../world/encounters';
import { isBlocked } from '../world/walking';
import { addToBag, ITEM_ORDER, LOOT } from '../world/rewards';
import { startTeam } from '../world/start';
import type { GameMap, Thing, WorldState } from '../world/types';
import { newWorld, refreshBook } from '../world/world';
import { markQuestion, type QuestionReport } from './verify';

// ------------------------------------------------------------------ what is sent

export interface BattleStep {
  action: BattleAction;
  /** The maths question: needed for a fight or a catch, never for anything else. */
  q?: QuestionReport;
  /** The random numbers the rules drew for this step, in order. */
  randoms: number[];
}

export type BattleOutcome = 'won' | 'lost' | 'ran' | 'caught';

export interface BattleReport {
  /** Made by the browser (a UUID). */
  id: string;
  /** The map it happened on. */
  map: string;
  /** The trainer's id, for a trainer battle. */
  trainer?: string;
  setup: BattleSetup;
  steps: BattleStep[];
  outcome: BattleOutcome;
}

export interface SaveItem {
  /** Made when the save was made (a UUID): the same save is only kept once. */
  saveId: string;
  /** 1 for the first save, then one more each time: a save must follow the one before it. */
  seq: number;
  /** When it was made (milliseconds since 1970, the device's clock). */
  at: number;
  /** A new game's first save says which two types the player started with. */
  start?: [TypeId, TypeId];
  world: WorldState;
  /** The battles since the last save, in order. */
  battles: BattleReport[];
}

/** What the server remembers about the last good save. */
export interface Stored {
  world: WorldState;
  /** The device time of that save. */
  at: number;
}

/** What a checked save adds up to (the database turns this into points, achievements and the board). */
export interface SaveSummary {
  wildWins: number;
  trainerWins: number;
  newBadges: string[];
  catches: number;
  questions: number;
  right: number;
  /** Monster-book entries owned, seen, badges held, and final-form monsters on the team. */
  owned: number;
  seen: number;
  badges: number;
  finalInTeam: number;
}

export interface CheckedSave {
  item: SaveItem;
  summary: SaveSummary;
  /** Every answer given, by topic (= the pack the records are kept in), oldest first. */
  answers: Partial<Record<string, FactAnswer[]>>;
}

export type Checked = { ok: true; save: CheckedSave } | { ok: false; problem: string };

// ------------------------------------------------------------------ the limits

/** Easy to edit: what a person can do. */
export const LIMITS = {
  /** Battles one save may carry. */
  maxBattles: 40,
  /** Steps in one battle (a long Tower fight is about 40). */
  maxSteps: 250,
  /** Questions answered in any 60 seconds. */
  answersPerMinute: 24,
  /** The quickest an answer can be, in milliseconds. */
  minAnswerMs: 250,
  /** Walking is about 5 tiles a second; this leaves room for a slow clock. */
  stepsPerSecond: 6,
  /** Steps allowed on top (a save just after another has no time between them). */
  stepSlack: 40,
  /** A save made after this long without an earlier one is checked as if this long had passed (a first save). */
  firstSaveSeconds: 3600,
  /** The newest a save may be, ahead of the server's clock (clocks are never quite right). */
  clockAheadMs: 60_000,
  /** The oldest a save may be. */
  oldestMs: 60 * 86_400_000,
  /** Box size. */
  maxBox: 300,
  /** Most of one item the bag may hold. */
  maxItem: 999,
  /** Gap allowed between one answer ending and the next starting, in milliseconds (clock rounding). */
  answerSlackMs: 1500,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIRS = ['up', 'down', 'left', 'right'];
const ITEMS: readonly string[] = ITEM_ORDER;

const isInt = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isStringArray = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string' && s.length <= 80);
const fail = (problem: string): { ok: false; problem: string } => ({ ok: false, problem });

// ------------------------------------------------------------------ what the maps know

const MAPS = WORLD_MAPS;
const things = (m: GameMap) => m.things;
const ALL_THINGS: Thing[] = Object.values(MAPS).flatMap(things);
const CHEST_IDS = new Set(ALL_THINGS.filter((t) => t.kind === 'chest').map((t) => t.id));
const CHEST_LOOT = new Map(ALL_THINGS.filter((t) => t.kind === 'chest').map((t) => [t.id, t.loot ?? '']));
const TRAINERS = new Map(ALL_THINGS.filter((t) => t.kind === 'trainer').map((t) => [t.id, t]));
const TRAINER_MAP = new Map(Object.values(MAPS).flatMap((m) => m.things.filter((t) => t.kind === 'trainer').map((t) => [t.id, m.id] as const)));
const PAYING_TRAINERS = new Set([...TRAINERS.values()].filter((t) => t.loot).map((t) => t.id));
const SPECIES_ID = /^[a-z]+-[123]$/;

/** The highest area your badges open: area 1 is open, and each badge opens the next. */
export function maxAreaFor(badges: readonly string[]): number {
  let n = 0;
  while (n < BADGE_ORDER.length && badges.includes(BADGE_ORDER[n])) n += 1;
  return n + 1;
}

// ------------------------------------------------------------------ monsters

function monsterOk(m: unknown): m is Monster {
  if (!isObject(m)) return false;
  if (typeof m.species !== 'string' || !SPECIES_ID.test(m.species)) return false;
  let species;
  try {
    species = speciesOf(m.species);
  } catch {
    return false;
  }
  if (!isInt(m.level, 1, TUNING.maxLevel) || !isInt(m.exp, 0, 10_000_000)) return false;
  // Its level has to be the one its exp makes (and it cannot be grown further than its level allows).
  if (m.exp < expForLevel(m.level) || (m.level < TUNING.maxLevel && m.exp >= expForLevel(m.level + 1))) return false;
  if (species.stage > speciesOf(formAt(species.family, m.level)).stage) return false;
  if (!isInt(m.hp, 0, maxHpOf(m as unknown as Monster))) return false;
  if (m.shiny !== undefined && m.shiny !== true) return false;
  return Object.keys(m).every((k) => ['species', 'level', 'exp', 'hp', 'shiny'].includes(k));
}

/** One monster as the pool counts it: who, and how much exp. Health and order don't matter. */
const signature = (m: Monster) => `${m.species}:${m.exp}${m.shiny ? ':s' : ''}`;
const poolOf = (team: readonly Monster[], box: readonly Monster[]) => [...team, ...box].map(signature).sort();
const samePool = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i]);

const bagOk = (bag: unknown): boolean =>
  isObject(bag) && Object.entries(bag).every(([k, v]) => ITEMS.includes(k) && isInt(v, 0, LIMITS.maxItem));

// ------------------------------------------------------------------ the world

function worldShape(w: unknown): string | null {
  if (!isObject(w) || w.version !== 1) return 'world';
  const world = w as unknown as WorldState;
  if (typeof world.map !== 'string' || !MAPS[world.map]) return 'map';
  if (!isInt(world.x, 0, 200) || !isInt(world.y, 0, 200) || !DIRS.includes(world.facing)) return 'tile';
  if (!Array.isArray(world.team) || world.team.length < 1 || world.team.length > MAX_TEAM || !world.team.every(monsterOk)) return 'team';
  if (!Array.isArray(world.box) || world.box.length > LIMITS.maxBox || !world.box.every(monsterOk)) return 'box';
  if (!bagOk(world.bag)) return 'bag';
  for (const key of ['beaten', 'badges', 'seen', 'owned', 'chests', 'paid'] as const) if (!isStringArray(world[key])) return 'sets';
  if (new Set(world.badges).size !== world.badges.length || !world.badges.every((b) => BADGE_ORDER.includes(b))) return 'badges';
  if (!isObject(world.heal) || typeof world.heal.map !== 'string' || !MAPS[world.heal.map] || !isInt(world.heal.x, 0, 200) || !isInt(world.heal.y, 0, 200) || !DIRS.includes(world.heal.facing)) return 'heal';
  if (!isInt(world.seed, 0, 0xffffffff) || !isInt(world.grassSteps, 0, 100) || !isInt(world.repel, 0, 1000) || !isInt(world.steps, 0, 1e9)) return 'counters';
  const sorted = (a: string[]) => a.every((s, i) => i === 0 || a[i - 1] < s);
  if (!sorted(world.seen) || !sorted(world.owned) || !world.seen.every((s) => SPECIES_ID.test(s)) || !world.owned.every((s) => SPECIES_ID.test(s))) return 'book';
  if (!world.seen.every(speciesKnown) || !world.owned.every(speciesKnown)) return 'book';
  if (!world.chests.every((c) => CHEST_IDS.has(c)) || new Set(world.chests).size !== world.chests.length) return 'chests';
  if (!world.paid.every((p) => PAYING_TRAINERS.has(p)) || new Set(world.paid).size !== world.paid.length) return 'paid';
  const here = MAPS[world.map];
  if (!world.beaten.every((b) => TRAINER_MAP.get(b) === here.id)) return 'beaten';
  // You can only be in an area you have opened, standing on a tile you can stand on.
  if (here.area > maxAreaFor(world.badges)) return 'area-locked';
  if (isBlocked(here, world.x, world.y, world.badges) || here.things.some((t) => t.x === world.x && t.y === world.y)) return 'tile';
  // The last healing spot is next to a nurse.
  const healMap = MAPS[world.heal.map];
  if (!healMap.things.some((t) => t.kind === 'nurse' && Math.abs(t.x - world.heal.x) + Math.abs(t.y - world.heal.y) <= 2)) return 'heal';
  return null;
}

function speciesKnown(id: string): boolean {
  try {
    speciesOf(id);
    return true;
  } catch {
    return false;
  }
}

const isSubset = (small: readonly string[], big: readonly string[]) => small.every((s) => big.includes(s));
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((s, i) => s === b[i]);

// ------------------------------------------------------------------ battles

interface ReplayedBattle {
  report: BattleReport;
  final: BattleState;
  answers: { q: QuestionReport; correct: boolean }[];
  wild: boolean;
}

/** Plays one reported battle with the rules, checking each question and each random number. Returns a problem code or the result. */
function replay(report: unknown, pool: string[], allowance: Bag): ReplayedBattle | string {
  if (!isObject(report) || typeof report.id !== 'string' || !UUID.test(report.id)) return 'battle';
  const r = report as unknown as BattleReport;
  const map = typeof r.map === 'string' ? MAPS[r.map] : undefined;
  if (!map) return 'battle-map';
  if (!isObject(r.setup) || !Array.isArray(r.steps) || r.steps.length > LIMITS.maxSteps || !['won', 'lost', 'ran', 'caught'].includes(r.outcome)) return 'battle';
  const setup = r.setup;

  // Where the battle was: the foes must be the ones this map can give.
  if (setup.kind === 'wild') {
    if (r.trainer !== undefined || map.area < 1 || !map.wild.length) return 'battle-setup';
    if (setup.area !== map.area || typeof setup.far !== 'boolean' || !Array.isArray(setup.foes) || setup.foes.length !== 1) return 'battle-setup';
    const foe = setup.foes[0];
    const [low, high] = wildLevels(map.area, setup.far);
    if (!isObject(foe) || !isInt(foe.level, low, high)) return 'battle-foe';
    const allowed = map.wild.map((entry) => wildSpecies(entry, foe.level));
    if (!allowed.includes(foe.species)) return 'battle-foe';
    // A wild monster arrives fresh (it may be a shiny).
    const fresh = makeMonster(foe.species, foe.level);
    if (foe.exp !== fresh.exp || foe.hp !== fresh.hp || (foe.shiny !== undefined && foe.shiny !== true)) return 'battle-foe';
  } else if (setup.kind === 'trainer') {
    const trainer = typeof r.trainer === 'string' ? TRAINERS.get(r.trainer) : undefined;
    if (!trainer || TRAINER_MAP.get(trainer.id) !== map.id) return 'battle-setup';
    if (setup.area !== Math.max(map.area, 1) || setup.far !== true) return 'battle-setup';
    const expected = (trainer.team ?? []).map((m) => makeMonster(m.species, m.level));
    if (!Array.isArray(setup.foes) || JSON.stringify(setup.foes) !== JSON.stringify(expected)) return 'battle-foe';
  } else return 'battle-setup';

  if (!Array.isArray(setup.team) || !setup.team.every(monsterOk) || (setup.box !== undefined && (!Array.isArray(setup.box) || !setup.box.every(monsterOk)))) return 'battle-setup';
  if (setup.bag !== undefined && !bagOk(setup.bag)) return 'battle-setup';
  // It starts with exactly the monsters you held after the battle before, and no more items than you could have.
  if (!samePool(poolOf(setup.team, setup.box ?? []), pool)) return 'pool-mismatch';
  for (const id of ITEM_ORDER) if ((setup.bag?.[id] ?? 0) > (allowance[id] ?? 0)) return 'bag';

  let state: BattleState;
  try {
    state = newBattle(setup).state;
  } catch {
    return 'battle-setup';
  }
  const answers: ReplayedBattle['answers'] = [];
  for (const step of r.steps) {
    if (!isObject(step) || !isObject(step.action) || !Array.isArray(step.randoms) || step.randoms.length > 40) return 'battle-step';
    const draws = step.randoms;
    if (!draws.every((n) => typeof n === 'number' && n >= 0 && n < 1)) return 'battle-random';
    const action = step.action as unknown as BattleAction;
    const asks = action.kind === 'fight' || action.kind === 'catch';
    if (asks) {
      if (state.phase === 'replace') return 'battle-step';
      const spec = questionFor(state, action);
      if (!spec || step.q === undefined) return 'battle-answer';
      const marked = markQuestion(step.q, state.area, state.far);
      if (!marked.ok) return marked.problem;
      const q = step.q;
      if (!isInt(q.ms, LIMITS.minAnswerMs, 3_600_000)) return 'battle-answer';
      // The result the rules were given has to agree with the marked answer. Quick means right, and within the question's time.
      const result = action.answer;
      const quickOk = q.ms <= quickSeconds(q.topic, q.band) * 1000;
      if (marked.correct ? !(result === 'right' || (result === 'quick-right' && quickOk)) : result !== 'wrong') return 'battle-answer';
      answers.push({ q, correct: marked.correct });
    } else if (step.q !== undefined) return 'battle-answer';

    let used = 0;
    const random = () => {
      if (used >= draws.length) throw new RangeError('out of random numbers');
      return draws[used++];
    };
    try {
      state = play(state, action, random).state;
    } catch (e) {
      return e instanceof RangeError ? 'battle-random' : 'battle-replay';
    }
    // Every number reported has to have been needed.
    if (used !== draws.length) return 'battle-random';
  }
  if (!['won', 'lost', 'ran', 'caught'].includes(state.phase) || state.phase !== r.outcome) return 'battle-outcome';
  return { report: r, final: state, answers, wild: setup.kind === 'wild' };
}

// ------------------------------------------------------------------ the whole save

/**
 * Checks one save against the last good one (null for a student's first save). `nowMs` is the
 * server's clock. Returns what to keep, or the first thing wrong, as a short code (it goes in the
 * server's log and on the teacher page, never to the student).
 */
export function checkSave(prev: Stored | null, raw: unknown, nowMs: number): Checked {
  if (!isObject(raw)) return fail('item');
  const item = raw as unknown as SaveItem;
  if (typeof item.saveId !== 'string' || !UUID.test(item.saveId)) return fail('save-id');
  if (!isInt(item.seq, 1, 1e7) || !isInt(item.at, 0, 1e14)) return fail('item');
  if (!Array.isArray(item.battles) || item.battles.length > LIMITS.maxBattles) return fail('battles');
  const w = item.world;
  const shape = worldShape(w);
  if (shape) return fail(shape);

  // The save before this one. A first save is a new game: the two starters, and what the town gives.
  let before: Stored;
  if (prev) {
    if (item.start !== undefined) return fail('start');
    before = prev;
  } else {
    const s = item.start;
    if (!Array.isArray(s) || s.length !== 2 || !s.every((t) => TYPES.includes(t as TypeId))) return fail('start');
    before = { world: newWorld({ maps: MAPS }, startTeam(s as [TypeId, TypeId]), w.seed), at: item.at - LIMITS.firstSaveSeconds * 1000 };
  }
  const was = before.world;

  // Time.
  if (item.at > nowMs + LIMITS.clockAheadMs || item.at < nowMs - LIMITS.oldestMs || item.at < before.at) return fail('time');
  const seconds = Math.max(0, (item.at - before.at) / 1000);

  // Sets only grow; steps only count up.
  if (w.steps < was.steps) return fail('steps');
  if (!isSubset(was.badges, w.badges) || !isSubset(was.chests, w.chests) || !isSubset(was.paid, w.paid) || !isSubset(was.owned, w.owned) || !isSubset(was.seen, w.seen)) return fail('shrank');
  // The book: what you own is what you hold (and the earlier forms), on top of what you owned before; you have seen all you own.
  const bookExpected = refreshBook({ ...w, owned: was.owned, seen: was.seen });
  if (!sameList(w.owned, bookExpected.owned) || !isSubset(bookExpected.seen, w.seen)) return fail('owned');

  // Battles, in order. Each one starts with exactly the monsters you held after the one before.
  let pool = poolOf(was.team, was.box);
  const newChests = w.chests.filter((c) => !was.chests.includes(c));
  const newPaid = w.paid.filter((p) => !was.paid.includes(p));
  const newBadges = w.badges.filter((b) => !was.badges.includes(b));
  // Items you can have had: before + what the new chests and prizes gave, less what battles use.
  let allowance = { ...was.bag };
  for (const c of newChests) allowance = addToBag(allowance, LOOT[CHEST_LOOT.get(c) ?? ''] ?? {});
  for (const p of newPaid) allowance = addToBag(allowance, LOOT[TRAINERS.get(p)!.loot ?? ''] ?? {});

  const answers: CheckedSave['answers'] = {};
  const timeline: { q: QuestionReport; correct: boolean }[] = [];
  const summary: SaveSummary = { wildWins: 0, trainerWins: 0, newBadges, catches: 0, questions: 0, right: 0, owned: 0, seen: 0, badges: 0, finalInTeam: 0 };
  const wonTrainers = new Set<string>();
  let wildBattles = 0;
  const seenIds = new Set<string>();
  for (const raw of item.battles) {
    const out = replay(raw, pool, allowance);
    if (typeof out === 'string') return fail(out);
    if (seenIds.has(out.report.id)) return fail('battle');
    seenIds.add(out.report.id);
    const { setup } = out.report;
    for (const id of ITEM_ORDER) {
      const used = (setup.bag?.[id] ?? 0) - (out.final.bag[id] ?? 0);
      if (used > 0) allowance[id as ItemId] = (allowance[id as ItemId] ?? 0) - used;
    }
    pool = poolOf(out.final.team, out.final.box);
    if (out.wild) wildBattles += 1;
    if (out.report.outcome === 'won') {
      if (out.wild) summary.wildWins += 1;
      else {
        summary.trainerWins += 1;
        wonTrainers.add(out.report.trainer!);
      }
    }
    if (out.report.outcome === 'caught') summary.catches += 1;
    for (const a of out.answers) {
      timeline.push(a);
      summary.questions += 1;
      if (a.correct) summary.right += 1;
    }
  }

  // The world you ended with holds exactly the monsters the battles left you.
  if (!samePool(poolOf(w.team, w.box), pool)) return fail('pool-mismatch');
  for (const id of ITEM_ORDER) if ((w.bag[id] ?? 0) > (allowance[id] ?? 0)) return fail('bag');
  // A new badge is a won Tower battle; a new prize is a won trainer battle.
  for (const b of newBadges) {
    const won = [...wonTrainers].some((id) => TRAINERS.get(id)?.badge === b);
    if (!won) return fail('badge');
  }
  for (const p of newPaid) if (!wonTrainers.has(p)) return fail('paid');
  // Chests are in areas you have opened.
  for (const c of newChests) {
    const map = Object.values(MAPS).find((m) => m.things.some((t) => t.id === c))!;
    if (map.area > maxAreaFor(w.badges)) return fail('area-locked');
  }
  // A Tower battle can only be won in its own map, which the badge must be the right one for (the loader already ties them).

  // Time: steps, wild battles and answers have to fit in the time between saves.
  const newSteps = w.steps - was.steps;
  if (newSteps > LIMITS.stepsPerSecond * seconds + LIMITS.stepSlack) return fail('speed');
  if (wildBattles > newSteps / ENCOUNTERS.steps.min + 2) return fail('pace');
  let windowStart = 0;
  let lastAt = prev ? before.at - 10_000 : nowMs - LIMITS.oldestMs;
  const ats: number[] = [];
  for (const { q, correct } of timeline) {
    if (!isInt(q.at, 0, 1e14) || q.at < nowMs - LIMITS.oldestMs || q.at > item.at + 30_000) return fail('answer-time');
    if (q.at < lastAt + q.ms - LIMITS.answerSlackMs) return fail('answer-time');
    lastAt = q.at;
    ats.push(q.at);
    while (ats[ats.length - 1] - ats[windowStart] >= 60_000) windowStart += 1;
    if (ats.length - windowStart > LIMITS.answersPerMinute) return fail('answer-pace');
    (answers[q.topic] ??= []).push({ key: q.key, correct, ms: q.ms, at: q.at });
  }

  summary.owned = w.owned.length;
  summary.seen = w.seen.length;
  summary.badges = w.badges.length;
  summary.finalInTeam = w.team.filter((m) => speciesOf(m.species).stage === 3).length;
  return { ok: true, save: { item, summary, answers } };
}
