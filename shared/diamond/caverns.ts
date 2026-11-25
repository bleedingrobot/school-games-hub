/**
 * The Monster Dig (docs/DIAMOND-MONSTERS-PLAN.md): 10 caverns below the Heart Diamond where the claw catches Maths
 * Monsters. Which monsters live in each tier, how often each tier turns up, how hard each wriggles, and the cavern's
 * goal. The monsters themselves (names, types, pictures) come from Maths Monsters' book (shared/monsters/monsterBook.ts),
 * read only: catching one here never changes a pupil's Maths Monsters game (James, 25 Nov 2026).
 */
import { MONSTER_BOOK, type Species } from '../monsters/monsterBook';
import { DIG_TIERS, MONSTER_LURE, levelSpec, type CavernGoal, type CavernSpec, type DigTier, type Weight } from './config';
import type { Random } from './random';

/** The sleeping giants' families (two forms each). */
const GIANTS: ReadonlySet<string> = new Set(['dozepebble', 'napsea', 'blinkberg']);

/** A monster's Monster Dig tier: first forms common, second forms uncommon, third forms and rare families rare. */
export function tierOf(s: Species): DigTier {
  if (s.rarity === 'ultra') return 'ultra';
  if (GIANTS.has(s.family)) return 'giant';
  if (s.rarity === 'rare' || s.stage === 3) return 'rare';
  return s.stage === 2 ? 'uncommon' : 'common';
}

export interface DigTierRule {
  name: string;
  /** Chance a monster spot is this tier, before a cavern's favour and the Lure (they add up to 1). */
  chance: number;
  /** Chance it wriggles on the way up (ultras always wriggle twice). */
  wriggle: number;
  weight: Weight;
  /** Coins it pays when brought up (a shiny pays twice). */
  coins: number;
  /** How it moves: still, walking there and back (field units a tick), or popping out and burrowing away. */
  move: 'still' | { walk: [number, number] } | { pop: { on: number; off: number } };
  r: number;
}

export const TIER_RULES: Record<DigTier, DigTierRule> = {
  common: { name: 'Common', chance: 0.55, wriggle: 0.1, weight: 'light', coins: 5, move: 'still', r: 24 },
  uncommon: { name: 'Uncommon', chance: 0.27, wriggle: 0.25, weight: 'light', coins: 10, move: { walk: [0.6, 1.2] }, r: 24 },
  rare: { name: 'Rare', chance: 0.14, wriggle: 0.4, weight: 'medium', coins: 20, move: { walk: [1.2, 2] }, r: 25 },
  // Seconds above and below ground, in ticks (30 a second).
  giant: { name: 'Super rare', chance: 0.035, wriggle: 0.55, weight: 'heavy', coins: 40, move: { pop: { on: 180, off: 150 } }, r: 30 },
  ultra: { name: 'Ultra rare', chance: 0.005, wriggle: 1, weight: 'heavy', coins: 80, move: { pop: { on: 120, off: 210 } }, r: 28 },
};
/** Ultras only turn up from this cavern down. */
export const ULTRA_FROM = 18;
/** Chance any monster is shiny (rolled after its tier). A shiny wriggles a little more. */
export const SHINY_CHANCE = 1 / 64;
export const SHINY_WRIGGLE = 0.1;
/** Ultras wriggle twice, at these shares of the way up. */
export const ULTRA_WRIGGLES: readonly [number, number][] = [[0.65, 0.8], [0.25, 0.4]];

/** Every monster the Monster Dig can bury, in book order, by tier. */
export const DIG_MONSTERS: readonly Species[] = MONSTER_BOOK;
export const DIG_PAGES = DIG_MONSTERS.length;
const BY_TIER: Record<DigTier, Species[]> = { common: [], uncommon: [], rare: [], giant: [], ultra: [] };
for (const s of DIG_MONSTERS) BY_TIER[tierOf(s)].push(s);
export const digTierOf = (species: string): DigTier => tierOf(DIG_MONSTERS.find((s) => s.id === species)!);
export const isDigMonster = (species: string) => DIG_MONSTERS.some((s) => s.id === species);

/** Each tier's real chance per monster spot in this cavern (favour and Lure applied, then scaled to add up to 1). */
export function tierChances(level: number, lure = false): Record<DigTier, number> {
  const spec = levelSpec(level).cavern!;
  const out = {} as Record<DigTier, number>;
  let sum = 0;
  for (const t of DIG_TIERS) {
    let c = TIER_RULES[t].chance * (spec.favour?.[t] ?? 1);
    if (t === 'ultra' && level < ULTRA_FROM) c = 0;
    if (lure && (t === 'rare' || t === 'giant' || t === 'ultra')) c *= MONSTER_LURE;
    out[t] = c;
    sum += c;
  }
  for (const t of DIG_TIERS) out[t] /= sum;
  return out;
}

const livesIn = (s: Species, habitat: CavernSpec['habitat']) => habitat === 'all' || s.type === habitat || s.type2 === habitat;

/** Roll one monster for a spot: the rarest tier first (so the table is the real odds), then a monster of that tier living here. */
export function rollMonster(rng: Random, level: number, lure: boolean): { species: string; tier: DigTier; shiny: boolean } {
  const spec = levelSpec(level).cavern!;
  const chances = tierChances(level, lure);
  const roll = rng.fraction();
  let tier: DigTier = 'common';
  let upTo = 0;
  for (let i = DIG_TIERS.length - 1; i >= 0; i--) {
    upTo += chances[DIG_TIERS[i]];
    if (roll < upTo) { tier = DIG_TIERS[i]; break; }
  }
  const home = BY_TIER[tier].filter((s) => livesIn(s, spec.habitat));
  const pool = home.length ? home : BY_TIER[tier];
  const species = pool[rng.int(pool.length)].id;
  return { species, tier, shiny: rng.fraction() < SHINY_CHANCE };
}

export interface Caught {
  species: string;
  shiny: boolean;
}

/** Has a cavern's goal been met by these catches? */
export function goalMet(goal: CavernGoal, caught: readonly Caught[]): boolean {
  const n = goal.kinds ? new Set(caught.map((c) => c.species)).size : caught.length;
  if (n < goal.count) return false;
  if (!goal.atLeast) return true;
  const need = DIG_TIERS.indexOf(goal.atLeast);
  return caught.some((c) => DIG_TIERS.indexOf(digTierOf(c.species)) >= need);
}

/** The goal as a pupil reads it. */
export function goalWords(goal: CavernGoal): string {
  const base = goal.kinds ? `Catch ${goal.count} different monsters` : `Catch ${goal.count} monsters`;
  return goal.atLeast ? `${base}, one of them ${TIER_RULES[goal.atLeast].name.toLowerCase()} or rarer` : base;
}

/** Coins a caught monster pays. */
export const monsterCoins = (c: Caught) => TIER_RULES[digTierOf(c.species)].coins * (c.shiny ? 2 : 1);

/** A page of the Monster Book: kept for good. */
export interface MonsterPage {
  count: number;
  /** New Zealand date of the first catch. */
  first: string;
  /** Shiny ones caught, and the first date. */
  shiny?: number;
  shinyFirst?: string;
}
export type MonsterBook = Partial<Record<string, MonsterPage>>;

/** Kinds caught. Any catch fills the plain page; a shiny one fills its shiny page too. */
export const bookKinds = (book: MonsterBook) => DIG_MONSTERS.filter((s) => (book[s.id]?.count ?? 0) > 0).length;
export const bookShinies = (book: MonsterBook) => DIG_MONSTERS.filter((s) => (book[s.id]?.shiny ?? 0) > 0).length;
export const bookTotal = (book: MonsterBook) => DIG_MONSTERS.reduce((n, s) => n + (book[s.id]?.count ?? 0), 0);
export const bookHas = (book: MonsterBook, tier: DigTier) => DIG_MONSTERS.some((s) => tierOf(s) === tier && (book[s.id]?.count ?? 0) > 0);
