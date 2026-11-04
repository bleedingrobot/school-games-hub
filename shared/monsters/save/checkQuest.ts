/**
 * The quest part of the save check (docs/MONSTERS-QUESTS-PLAN.md, Q.5): flags, bits, the quest log,
 * the notice board, crafting and eggs. Like the rest of the check it asks "could honest play have
 * done this?", not "replay every step":
 *  - every flag is a real one, and flags never go away (apart from a nest's old weekly flag);
 *  - bits can't grow by more than the battles in this save and the new prizes gave, and whatever was
 *    spent has to pay for what was made (wake-up items, egg warmers, potions and balls);
 *  - a new egg comes from a quest, puzzle or nest the pupil has just done, holds a monster that kind
 *    of egg can hold, and was found on a day of play the database has counted;
 *  - a hatched egg had all its days (counted by the database, never the Chromebook's clock), and
 *    eggs gone cold (EGGS.coldAfter days without a battle) can't be kept or hatched;
 *  - a giant is woken only by beating or catching it in this save.
 * Items the new prizes give, items crafting may have made, and the monsters hatched are handed back
 * to checkSave, which counts them in with the battles.
 */
import type { Bag } from '../engine';
import { makeMonster, type Monster } from '../rules';
import { TYPES, type TypeId } from '../types';
import { BITS, bitsForWin, RECIPES } from '../quests/bits';
import { coldEggs, eggPool, EGGS, isReady } from '../quests/eggs';
import { GIANTS } from '../quests/giants';
import { PUZZLES, puzzleById } from '../quests/puzzles';
import { jobsFor, questById, questPoints, QUESTS } from '../quests/quests';
import { emptyQuestSave, type Bits, type Egg, type EggKind, type QuestSave, type Reward } from '../quests/types';
import { weekOf } from '../world/questWorld';
import type { GameMap, WorldState } from '../world/types';

/** What the server knows that the save can't be trusted for. */
export interface QuestFacts {
  /** The player's id (the board's jobs are picked with it). */
  player: string;
  /** Today in New Zealand, by the server's clock. */
  today: string;
  /** The NZ day the save says it was made (its device time; already checked against the server's clock). */
  saveDay: string;
  /** Days of play the database has counted, before this save and including it. */
  playDaysBefore: number;
  playDays: number;
}

/** A battle as the quest check needs it (the battles themselves are replayed by checkSave). */
export interface QuestBattle {
  outcome: string;
  foes: string[];
  trainer?: string;
  giant?: string;
}

export interface QuestChecked {
  /** Items the new quest and job prizes gave. */
  prizeItems: Bag;
  /** How many potions, balls, repels and great balls crafting could have made, in all. */
  craftable: number;
  /** Monsters that may have hatched (each may turn up in the team or box once). */
  hatched: Monster[];
  questPoints: number;
}

export const CRAFTED_ITEMS = ['potion', 'ball', 'repel', 'great-ball'] as const;
/** The cheapest crafted item costs this many bits. */
const CHEAPEST = 3;
const WARMER_COST = 10;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isInt = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const EGG_KINDS: readonly EggKind[] = ['leafy', 'water', 'warm', 'cold', 'glowing', 'stony'];

const REWARD_FLAGS = new Set(QUESTS.flatMap((q) => (q.reward.flag ? [q.reward.flag] : [])));
const RECIPE_FLAGS = new Set(RECIPES.flatMap((r) => (r.flag ? [r.flag] : [])));

/** Is this a flag the game can set? */
function knownFlag(f: string, maps: Record<string, GameMap>): boolean {
  if (REWARD_FLAGS.has(f) || RECIPE_FLAGS.has(f)) return true;
  const [kind, ...rest] = f.split(':');
  const id = rest.join(':');
  switch (kind) {
    case 'quest-done': return !!questById(id);
    case 'woke': return GIANTS.some((g) => g.id === id);
    case 'solved': return !!puzzleById(id);
    case 'hatched': return EGG_KINDS.includes(id as EggKind);
    case 'egg': case 'owed': return eggRefOk(id, maps);
    case 'nest': {
      // "nest:<thing id>:<week>"; a thing id has a colon in it ("map:name").
      const cut = id.lastIndexOf(':');
      return cut > 0 && isNestThing(id.slice(0, cut), maps) && /^\d{1,6}$/.test(id.slice(cut + 1));
    }
    case 'pod': {
      // "pod:<puzzle>:<thing id>": a pod bush on a map that belongs to that puzzle.
      const [puzzle, ...thing] = rest;
      const thingId = thing.join(':');
      return PUZZLES.some((p) => p.id === puzzle && p.kind === 'pods')
        && Object.values(maps).some((m) => m.things.some((t) => t.id === thingId && t.kind === 'puzzle' && t.puzzle === puzzle));
    }
    default: return false;
  }
}

const isNestThing = (id: string, maps: Record<string, GameMap>) => Object.values(maps).some((m) => m.things.some((t) => t.id === id && t.kind === 'nest'));

/** "nest:<thing id>:<week>:<kind>" split up (the thing id itself has a colon in it, "map:name"). */
function nestRef(ref: string): { thing: string; week: string; kind: string } | undefined {
  const parts = ref.split(':');
  if (parts[0] !== 'nest' || parts.length < 4) return undefined;
  return { thing: parts.slice(1, -2).join(':'), week: parts[parts.length - 2], kind: parts[parts.length - 1] };
}

/** "quest:<id>:<kind>", "puzzle:<id>:<kind>" or "nest:<thing>:<week>:<kind>": a place an egg can come from. */
function eggRefOk(ref: string, maps: Record<string, GameMap>): boolean {
  const parts = ref.split(':');
  const kind = parts[parts.length - 1] as EggKind;
  if (parts[0] === 'quest' && parts.length === 3) return questById(parts[1])?.reward.egg === kind;
  if (parts[0] === 'puzzle' && parts.length === 3) {
    const p = puzzleById(parts[1]);
    return !!p && 'egg' in p.prize && p.prize.egg === kind;
  }
  const nest = nestRef(ref);
  if (nest) {
    return /^\d{1,6}$/.test(nest.week) && Object.values(maps).some((m) => m.things.some((t) => t.id === nest.thing && t.kind === 'nest' && t.egg === kind));
  }
  return false;
}

function bitsOk(b: unknown): b is Bits {
  return isObject(b) && Object.entries(b).every(([k, v]) => TYPES.includes(k as TypeId) && isInt(v, 0, BITS.max));
}

function eggOk(e: unknown, maps: Record<string, GameMap>): e is Egg {
  if (!isObject(e) || typeof e.id !== 'string' || !eggRefOk(e.id, maps)) return false;
  const kind = e.kind as EggKind;
  if (!EGG_KINDS.includes(kind) || !e.id.endsWith(`:${kind}`)) return false;
  const pool = eggPool(kind);
  if (typeof e.species !== 'string' || ![...pool.uncommon, ...pool.rare, ...pool.ultra].includes(e.species)) return false;
  if (!isInt(e.found, 0, 100_000) || (e.shiny !== undefined && e.shiny !== true) || (e.warmed !== undefined && e.warmed !== true)) return false;
  return Object.keys(e).every((k) => ['id', 'kind', 'species', 'shiny', 'found', 'warmed'].includes(k));
}

/** The shape of a save's quest part. Null if it's fine. */
export function questShape(raw: unknown, maps: Record<string, GameMap>): string | null {
  if (raw === undefined) return null;
  if (!isObject(raw)) return 'quest';
  const q = raw as unknown as QuestSave;
  if (!Array.isArray(q.flags) || q.flags.length > 600 || !q.flags.every((f) => typeof f === 'string' && f.length <= 80 && knownFlag(f, maps))) return 'quest-flags';
  if (new Set(q.flags).size !== q.flags.length) return 'quest-flags';
  if (!bitsOk(q.bits)) return 'quest-bits';
  if (!isObject(q.quests)) return 'quest-log';
  for (const [id, st] of Object.entries(q.quests)) {
    const quest = questById(id);
    if (!quest || !isObject(st) || !isInt(st.step, 0, quest.steps.length - 1) || !isInt(st.n, 0, 999)) return 'quest-log';
    if ((st.ready !== undefined && st.ready !== true) || !Object.keys(st).every((k) => ['step', 'n', 'ready'].includes(k))) return 'quest-log';
  }
  if (q.board !== undefined) {
    const b = q.board;
    if (!isObject(b) || typeof b.day !== 'string' || !DAY.test(b.day) || !Array.isArray(b.n) || b.n.length > 3 || !b.n.every((n) => isInt(n, 0, 999))) return 'quest-board';
    if (!Array.isArray(b.paid) || !b.paid.every((i) => isInt(i, 0, 2)) || new Set(b.paid).size !== b.paid.length) return 'quest-board';
  }
  if (!Array.isArray(q.eggs) || q.eggs.length > EGGS.basket || !q.eggs.every((e) => eggOk(e, maps)) || new Set(q.eggs.map((e) => e.id)).size !== q.eggs.length) return 'quest-eggs';
  if (q.lastDay !== undefined && (typeof q.lastDay !== 'string' || !DAY.test(q.lastDay))) return 'quest-day';
  return Object.keys(q).every((k) => ['flags', 'bits', 'quests', 'board', 'eggs', 'lastDay'].includes(k)) ? null : 'quest';
}

const addInto = (into: Bits, more: Bits | undefined) => {
  for (const t of TYPES) if (more?.[t]) into[t] = (into[t] ?? 0) + more[t]!;
};
const addItems = (into: Bag, more: Bag | undefined) => {
  for (const [k, v] of Object.entries(more ?? {})) into[k as keyof Bag] = (into[k as keyof Bag] ?? 0) + (v ?? 0);
};
const sumBits = (b: Bits) => TYPES.reduce((n, t) => n + (b[t] ?? 0), 0);
const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const maxAreaOf = (badges: readonly string[]) => Math.min(6, badges.length + 1);

/**
 * Checks the quest part of a save against the one before (`was`). `battles` are this save's battles
 * (replayed separately). Returns a problem code, or what the prizes and crafting allow.
 */
export function checkQuest(was: WorldState, w: WorldState, battles: readonly QuestBattle[], facts: QuestFacts): QuestChecked | string {
  const before = was.quest ?? emptyQuestSave();
  const now = w.quest ?? emptyQuestSave();
  const newFlags = now.flags.filter((f) => !before.flags.includes(f));
  // Flags only grow (each nest keeps only this week's flag).
  if (!before.flags.every((f) => f.startsWith('nest:') || now.flags.includes(f))) return 'quest-shrank';
  const has = (f: string) => now.flags.includes(f);

  // The day of the last battle: never in the future, never earlier, and moved only by a battle.
  const tomorrow = new Date(Date.parse(`${facts.today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  if (now.lastDay !== undefined && (now.lastDay > tomorrow || (before.lastDay !== undefined && now.lastDay < before.lastDay))) return 'quest-day';
  if (now.lastDay !== before.lastDay && !battles.length) return 'quest-day';

  // New flags need their reason.
  const prizeItems: Bag = {};
  const earned: Bits = {};
  for (const f of newFlags) {
    const [kind, id] = [f.slice(0, f.indexOf(':')), f.slice(f.indexOf(':') + 1)];
    if (kind === 'quest-done') {
      const quest = questById(id)!;
      if ((quest.badges ?? 0) > w.badges.length || !(quest.needs ?? []).every(has)) return 'quest-done';
      if (quest.reward.flag && !has(quest.reward.flag)) return 'quest-done';
      addItems(prizeItems, quest.reward.items);
      addInto(earned, quest.reward.bits);
    } else if (kind === 'woke') {
      const g = GIANTS.find((x) => x.id === id)!;
      if (!battles.some((b) => b.giant === g.id && (b.outcome === 'won' || b.outcome === 'caught'))) return 'woke';
    } else if (kind === 'solved') {
      const p = puzzleById(id)!;
      if (p.kind === 'pods' && now.flags.filter((x) => x.startsWith(`pod:${p.id}:`)).length < p.count) return 'solved';
      if ('bits' in p.prize) addInto(earned, { [p.prize.bits]: p.prize.n });
    } else if (kind === 'egg') {
      // An egg from a quest or puzzle needs it done; a nest egg is this week's (or last week's, near midnight on Sunday).
      const parts = id.split(':');
      if (parts[0] === 'quest' && !has(`quest-done:${parts[1]}`)) return 'egg-source';
      if (parts[0] === 'puzzle' && !has(`solved:${parts[1]}`)) return 'egg-source';
      const nest = nestRef(id);
      if (parts[0] === 'nest' && (!nest || ![weekOf(facts.today), weekOf(facts.today) - 1].includes(Number(nest.week)))) return 'egg-source';
    } else if (kind === 'made') {
      if (!RECIPES.some((r) => r.flag === f && (r.needs ?? []).every(has))) return 'made';
    }
  }

  // The board: today's (or yesterday's) jobs, and a prize for each newly paid one.
  const board = now.board;
  if (board && board.day !== before.board?.day && board.day !== facts.today && board.day !== dayBefore(facts.today) && board.day !== tomorrow) return 'quest-board';
  const newPaid = board ? board.paid.filter((i) => board.day !== before.board?.day || !before.board.paid.includes(i)) : [];
  if (board && newPaid.length) {
    // The jobs depend on how many badges you had, which may have changed during the save: allow either list.
    const lists = [maxAreaOf(was.badges), maxAreaOf(w.badges)].map((maxArea) => jobsFor(board.day, facts.player, { maxArea }));
    for (const i of newPaid) {
      const best: Reward = {};
      for (const list of lists) {
        const r = list[i]?.reward;
        if (!r) continue;
        if (sumBits(r.bits ?? {}) > sumBits(best.bits ?? {})) best.bits = r.bits;
        const items: Bag = { ...(best.items ?? {}) };
        for (const [k, v] of Object.entries(r.items ?? {})) items[k as keyof Bag] = Math.max(items[k as keyof Bag] ?? 0, v ?? 0);
        best.items = items;
      }
      addItems(prizeItems, best.items);
      addInto(earned, best.bits);
    }
  }

  // Bits: no more than before plus what was won and given; what was spent pays for what was made.
  for (const b of battles) if (b.outcome === 'won') addInto(earned, bitsForWin(b.foes, !!b.trainer));
  let spent = 0;
  for (const t of TYPES) {
    const most = Math.min(BITS.max, (before.bits[t] ?? 0) + (earned[t] ?? 0));
    if ((now.bits[t] ?? 0) > most) return 'quest-bits';
    spent += Math.max(0, (before.bits[t] ?? 0) + (earned[t] ?? 0) - (now.bits[t] ?? 0));
  }
  for (const f of newFlags) {
    const r = RECIPES.find((x) => x.flag === f);
    if (r) spent -= sumBits(r.cost);
  }

  // Eggs gone cold (by the day the save was made) can't be kept or hatched.
  const cold = coldEggs(before, facts.saveDay).lost.map((e) => e.id);
  const hatched: Monster[] = [];
  const hatchedKinds = new Set<string>();
  for (const egg of before.eggs) {
    const still = now.eggs.find((e) => e.id === egg.id);
    if (still) {
      if (cold.includes(egg.id)) return 'egg-cold';
      if (still.kind !== egg.kind || still.species !== egg.species || still.found !== egg.found || still.shiny !== egg.shiny || (egg.warmed && !still.warmed)) return 'egg-changed';
      if (still.warmed && !egg.warmed) spent -= WARMER_COST;
    } else if (!cold.includes(egg.id) && isReady(egg, facts.playDays) && has(`hatched:${egg.kind}`)) {
      // Gone from the basket and ready: it may have hatched (checkSave looks for the monster).
      hatched.push({ ...makeMonster(egg.species, EGGS.hatchLevel), ...(egg.shiny ? { shiny: true } : {}) });
      hatchedKinds.add(egg.kind);
    }
  }
  for (const egg of now.eggs) {
    if (before.eggs.some((e) => e.id === egg.id)) continue;
    // Found now: its flag is new, and its day is one the database has counted (a page left open a day or two may lag behind).
    if (!newFlags.includes(`egg:${egg.id}`)) return 'egg-new';
    if (egg.found > facts.playDays || egg.found < facts.playDaysBefore - 2) return 'egg-day';
    if (egg.warmed) spent -= WARMER_COST;
  }
  if (spent < 0) return 'quest-bits';
  // A new "hatched" flag needs a ready egg of that kind that has gone from the basket.
  for (const f of newFlags) if (f.startsWith('hatched:') && !hatchedKinds.has(f.slice(8))) return 'hatched';

  return { prizeItems, craftable: Math.floor(spent / CHEAPEST), hatched, questPoints: questPoints(before, now) };
}
