/**
 * A pupil's Diamond Drop progress, as pure functions (docs/DIAMOND-PLAN.md, sections 3.4 and 6): which levels they may
 * start today (one new level a day, by the New Zealand date), adding up a level's stars, coins and Gem Book entries,
 * boosts, and what New Season clears and keeps. The server runs exactly these before saving.
 */
import {
  ACHIEVEMENTS, ACHIEVEMENT_NEEDS, BOOSTS, CAVERNS, FIRST_CAVERN, GEMS, LAST_CAVERN, LAST_LEVEL, POINTS, RARE_GEMS, RARE_IDS, REPLAY_COIN_SHARE,
  boostsFor, isCavern, priceLevel,
  type AchievementMeasure, type BoostId, type GemId, type MonsterMeasure, type RareId, type RareMeasure, type Slot,
} from './config';
import { bookHas, bookKinds, bookShinies, bookTotal, type MonsterBook } from './caverns';
import { EXTRA_TURN_POINTS } from '../unlimited';
import type { LevelResult } from './engine';
import { WORKSHOP_ITEMS } from './workshopItems';

/** The New Zealand date ('YYYY-MM-DD') of a moment. Days roll over at New Zealand midnight. */
export function nzDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((x) => x.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export interface GemPage {
  count: number;
  /** New Zealand date of the first catch this season. */
  first: string;
}

export interface Player {
  // ---- This season (New Season clears these) ----
  /** The deepest level passed (0 = none yet). */
  deepest: number;
  /** New Zealand date the deepest level was first passed. */
  newLevelDate: string | null;
  coins: number;
  /** Best stars on each level (index 0 = level 1). */
  stars: number[];
  gemBook: Partial<Record<GemId, GemPage>>;
  /** A free boost from a mystery sack, for the next level played. */
  freeBoost: BoostId | null;
  /**
   * The Monster Dig this season (missing in saves from before it): the deepest cavern passed (0 to 10, cavern 1 is
   * level 11), the date one was first passed, and best stars on each. One new cavern a day, like the levels.
   */
  caves?: { deepest: number; newDate: string | null; stars: number[] };
  /**
   * The field seed of each level (by level number) whose last go was left unfinished. The next go of that level digs
   * the same field, so leaving and coming in again never rerolls the rare gem or the monsters (James, 26 Nov 2026).
   * A level's entry goes when one of its goes ends.
   */
  fields?: Partial<Record<string, number>>;
  // ---- Kept for good ----
  /** Workshop upgrades bought or earned. */
  owned: string[];
  /** The upgrade worn in each slot. */
  worn: Partial<Record<Slot, string>>;
  /** Totals for achievements (which survive New Season). */
  lifetime: {
    plays: number;
    gems: number;
    grips: number;
    found: number;
    kinds: GemId[];
    bestLevel: number;
    bestStars: number;
    /** The rare gems' Gem Book pages, kept for good (missing in saves from before rare gems). */
    rare?: Partial<Record<RareId, GemPage>>;
    /** The Monster Book, kept for good (missing in saves from before the Monster Dig). */
    monsters?: MonsterBook;
  };
}

export function newPlayer(): Player {
  return {
    deepest: 0, newLevelDate: null, coins: 0, stars: Array(LAST_LEVEL).fill(0), gemBook: {}, freeBoost: null,
    owned: [], worn: {}, lifetime: { plays: 0, gems: 0, grips: 0, found: 0, kinds: [], bestLevel: 0, bestStars: 0, rare: {} },
  };
}

/** Does this pupil get the guided first go (they have never played a level)? */
export const needsStarter = (p: Player) => p.lifetime.plays === 0;

/** The Monster Dig opens for good once a pupil has caught the Heart Diamond, in any season (James, 25 Nov 2026). */
export const digOpen = (p: Player) => p.lifetime.found > 0;
export const freshCaves = () => ({ deepest: 0, newDate: null, stars: Array(CAVERNS.length).fill(0) as number[] });
const cavesOf = (p: Player) => p.caves ?? freshCaves();

/** Which caverns a pupil may start now (as level numbers 11 to 20), by the same one-new-a-day rule as the levels. */
export function cavernsOpen(p: Player, now: Date, unlimited = false): LevelsOpen {
  if (!digOpen(p)) return { replays: [], next: null, nextOpen: false };
  const c = cavesOf(p);
  const replays = Array.from({ length: c.deepest }, (_, i) => FIRST_CAVERN + i);
  const next = c.deepest < CAVERNS.length ? FIRST_CAVERN + c.deepest : null;
  return { replays, next, nextOpen: next !== null && (unlimited || c.newDate !== nzDate(now)) };
}

export interface LevelsOpen {
  /** Levels already passed, open to replay. */
  replays: number[];
  /** The next new level (null once level 10 is passed). */
  next: number | null;
  /** Can the next level be tried today? */
  nextOpen: boolean;
}

/**
 * Which levels a pupil may start now. Passed levels are always open. The next one is open unless a new level was
 * already passed today (New Zealand date): then it opens tomorrow. Tries at today's level are unlimited.
 * On an unlimited day (the teacher's switch) the next new level is always open.
 */
export function levelsOpen(p: Player, now: Date, unlimited = false): LevelsOpen {
  const replays = Array.from({ length: p.deepest }, (_, i) => i + 1);
  const next = p.deepest < LAST_LEVEL ? p.deepest + 1 : null;
  return { replays, next, nextOpen: next !== null && (unlimited || p.newLevelDate !== nzDate(now)) };
}

export function canStart(p: Player, level: number, now: Date, unlimited = false): boolean {
  if (!Number.isInteger(level) || level < 1 || level > LAST_CAVERN) return false;
  if (isCavern(level)) {
    if (!digOpen(p)) return false;
    if (level < FIRST_CAVERN + cavesOf(p).deepest) return true;
    const open = cavernsOpen(p, now, unlimited);
    return level === open.next && open.nextOpen;
  }
  if (level <= p.deepest) return true;
  const open = levelsOpen(p, now, unlimited);
  return level === open.next && open.nextOpen;
}

export function boostPrice(id: BoostId, level: number): number {
  const b = BOOSTS.find((x) => x.id === id)!;
  return b.base + b.perLevel * priceLevel(level);
}

/**
 * Boosts for the level about to start: at most one of each, the sack's free boost costs nothing, and the rest must be
 * affordable. Gives the player after paying, or why not.
 */
export function takeBoosts(p: Player, level: number, ids: readonly BoostId[]): { ok: true; player: Player; cost: number } | { ok: false; reason: 'twice' | 'unknown' | 'coins' } {
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'twice' };
  if (ids.some((id) => !boostsFor(level).some((b) => b.id === id))) return { ok: false, reason: 'unknown' };
  let cost = 0;
  let freeUsed = false;
  for (const id of ids) {
    if (!freeUsed && id === p.freeBoost) { freeUsed = true; continue; }
    cost += boostPrice(id, level);
  }
  if (cost > p.coins) return { ok: false, reason: 'coins' };
  return { ok: true, cost, player: { ...p, coins: p.coins - cost, freeBoost: freeUsed ? null : p.freeBoost } };
}

/** Achievement measures (counts_fn in Stage 4). */
export function measures(p: Player): Record<AchievementMeasure | RareMeasure | MonsterMeasure | 'diamond_gems' | 'diamond_level', number> {
  const rare = p.lifetime.rare ?? {};
  const book = p.lifetime.monsters ?? {};
  return {
    diamond_monster_kinds: bookKinds(book),
    diamond_monster_total: bookTotal(book),
    diamond_monster_shiny: bookShinies(book),
    diamond_monster_giant: bookHas(book, 'giant') ? 1 : 0,
    diamond_monster_ultra: bookHas(book, 'ultra') ? 1 : 0,
    diamond_rare_kinds: RARE_IDS.filter((id) => rare[id]).length,
    diamond_rare_total: RARE_IDS.reduce((n, id) => n + (rare[id]?.count ?? 0), 0),
    diamond_phoenix: rare.phoenixGem?.count ?? 0,
    diamond_gems: p.lifetime.gems,
    diamond_grips: p.lifetime.grips,
    diamond_level: p.lifetime.bestLevel,
    diamond_kinds: p.lifetime.kinds.filter((k) => k !== 'heartDiamond' && GEMS.some((g) => g.id === k)).length,
    diamond_found: p.lifetime.found,
    diamond_stars: p.lifetime.bestStars,
  };
}

/** The hub achievements a change of progress has just earned (for the level end's celebration). */
export function newAchievements(before: Player, after: Player): (typeof ACHIEVEMENTS)[number][] {
  const was = measures(before);
  const now = measures(after);
  return ACHIEVEMENTS.filter((a) => was[a.measure] < a.goal && now[a.measure] >= a.goal);
}

/** Workshop upgrades this pupil has earned but doesn't have yet. */
export function newlyEarned(p: Player): string[] {
  const m = measures(p);
  return WORKSHOP_ITEMS.filter((it) => it.earnedBy && m[it.earnedBy] >= (it.needs ?? ACHIEVEMENT_NEEDS[it.earnedBy as AchievementMeasure]) && !p.owned.includes(it.id)).map((it) => it.id);
}

export interface Applied {
  player: Player;
  /** Coins kept (full for a new level passed; a share otherwise). */
  coins: number;
  /** Hub points earned (first pass, new stars, the diamond). */
  points: number;
  /** A new level passed for the first time. */
  newLevel: boolean;
  /** Workshop upgrades just earned. */
  earned: string[];
  /** Rare gems caught for the very first time (new Gem Book pages). */
  newRare: RareId[];
  /** Monster Book pages filled for the first time (species ids; a shiny page as "<id>-shiny"). */
  newMonsters: string[];
}

/**
 * Add a finished level to the pupil's progress. The caller has checked `canStart` when the level began; a pass only
 * moves the pupil deeper if it was the next level and it was still open (so two passes in one day can't both count).
 */
export function applyResult(before: Player, r: LevelResult, now: Date, unlimited = false): Applied {
  const today = nzDate(now);
  const p: Player = {
    ...before,
    stars: [...before.stars],
    gemBook: { ...before.gemBook },
    lifetime: { ...before.lifetime, kinds: [...before.lifetime.kinds], rare: { ...(before.lifetime.rare ?? {}) }, monsters: { ...(before.lifetime.monsters ?? {}) } },
    owned: [...before.owned],
  };
  const newRare: RareId[] = [];
  const newMonsters: string[] = [];
  let points = 0;
  let newLevel = false;
  let extra = false;
  const cave = isCavern(r.level);
  if (cave) {
    // The Monster Dig: its own deepest, date and stars, by the same rules as the levels.
    const c = { ...cavesOf(before), stars: [...cavesOf(before).stars] };
    const open = cavernsOpen(before, now, unlimited);
    if (r.passed && r.level === open.next && open.nextOpen) {
      extra = c.newDate === today;
      c.deepest++;
      c.newDate = today;
      newLevel = true;
      points += POINTS.firstPass;
    }
    const i = r.level - FIRST_CAVERN;
    if (i < c.deepest && r.stars > c.stars[i]) {
      points += (r.stars - c.stars[i]) * POINTS.newStar;
      c.stars[i] = r.stars;
    }
    p.caves = c;
    const book = p.lifetime.monsters!;
    for (const m of r.monsters ?? []) {
      const page = book[m.species];
      if (!page) { newMonsters.push(m.species); if (bookKinds(book) === 0) points += POINTS.firstMonster; }
      const next = { count: (page?.count ?? 0) + 1, first: page?.first ?? today, ...(page?.shiny ? { shiny: page.shiny, shinyFirst: page.shinyFirst } : {}) };
      if (m.shiny) {
        if (!page?.shiny) newMonsters.push(`${m.species}-shiny`);
        next.shiny = (page?.shiny ?? 0) + 1;
        next.shinyFirst = page?.shinyFirst ?? today;
      }
      book[m.species] = next;
    }
  } else if (r.passed && r.level === before.deepest + 1 && levelsOpen(before, now, unlimited).nextOpen) {
    // A new level when one was already passed today is an extra one (only possible on an unlimited day).
    extra = before.newLevelDate === today;
    p.deepest = r.level;
    p.newLevelDate = today;
    newLevel = true;
    points += POINTS.firstPass;
  }
  // Full coins only for passing a new level; replays and tries that fall short keep a share (so falling short on purpose isn't a coin farm).
  const coins = newLevel ? r.coins : Math.floor(r.coins * REPLAY_COIN_SHARE);
  p.coins += coins;
  // Stars count only on levels passed (a level beyond the deepest that didn't count earns none).
  if (!cave && r.level <= p.deepest && r.stars > p.stars[r.level - 1]) {
    points += (r.stars - p.stars[r.level - 1]) * POINTS.newStar;
    p.stars[r.level - 1] = r.stars;
  }
  if (r.diamond) {
    if (p.lifetime.found === 0) points += POINTS.diamond;
    p.lifetime.found++;
  }
  for (const g of GEMS) {
    const n = r.caught[g.id] ?? 0;
    if (!n) continue;
    const page = p.gemBook[g.id];
    p.gemBook[g.id] = { count: (page?.count ?? 0) + n, first: page?.first ?? today };
    p.lifetime.gems += n;
    if (!p.lifetime.kinds.includes(g.id)) p.lifetime.kinds.push(g.id);
  }
  for (const g of RARE_GEMS) {
    const n = r.caught[g.id] ?? 0;
    if (!n) continue;
    const page = p.lifetime.rare![g.id];
    if (!page) newRare.push(g.id);
    p.lifetime.rare![g.id] = { count: (page?.count ?? 0) + n, first: page?.first ?? today };
  }
  p.lifetime.grips += r.held;
  p.lifetime.plays++;
  p.lifetime.bestLevel = Math.max(p.lifetime.bestLevel, p.deepest);
  p.lifetime.bestStars = Math.max(p.lifetime.bestStars, p.stars.reduce((a, b) => a + b, 0));
  if (r.freeBoost && !p.freeBoost) p.freeBoost = r.freeBoost;
  const earned = newlyEarned(p);
  p.owned.push(...earned);
  // Extra new levels give everything but hub points.
  return { player: p, coins, points: extra ? EXTRA_TURN_POINTS : points, newLevel, earned, newRare, newMonsters };
}

/**
 * New Season: back to level 1 (and cavern 1) with no coins, stars or Gem Book. Workshop upgrades, what's worn,
 * achievement totals, the rare gems and the Monster Book stay, and so does the way into the Monster Dig.
 */
export function newSeason(p: Player): Player {
  const fresh = newPlayer();
  return {
    ...fresh, owned: [...p.owned], worn: { ...p.worn },
    lifetime: { ...p.lifetime, kinds: [...p.lifetime.kinds], rare: { ...(p.lifetime.rare ?? {}) }, monsters: { ...(p.lifetime.monsters ?? {}) } },
  };
}
