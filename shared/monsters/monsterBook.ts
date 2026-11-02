/**
 * The monster book: 18 families (3 per type), each growing twice, so 54 entries, plus the rare
 * ones added for quests and eggs (docs/MONSTERS-QUESTS-PLAN.md section 6): 6 rare families and 3
 * sleeping giants with 2 forms each, and 3 ultra rares with one form and two types. 75 in all.
 * ALL THE MONSTER DATA LIVES HERE, so it is easy to edit: names, stats, attacks, evolve levels.
 *
 *  - `stats` are the stage-1 base numbers; a grown monster gets them times STAGE_BOOST.
 *  - Every monster has its type's basic attack, then its family's two own attacks as it grows,
 *    and the type's big attack once it is fully grown. (Attacks: name, power, animation id.)
 *  - `evolveAt` is the level each growth happens at: [stage 1 → 2, stage 2 → 3].
 */
import type { TypeId } from './types';

/** How often a monster turns up. Common and uncommon are the first 18 families; rare and ultra rare are new. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'ultra';
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'ultra'];

export interface Attack {
  name: string;
  /** How hard it hits before levels and types (about 35 to 80). */
  power: number;
  /** Which attack effect the screens play, e.g. "leaf-1". */
  anim: string;
  /** Only for a monster with two types: which type this attack is (and so its question's topic). Otherwise the monster's type. */
  type?: TypeId;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
}

export interface Species {
  id: string;
  name: string;
  type: TypeId;
  /** Ultra rares only: their second type (they have attacks of both). */
  type2?: TypeId;
  family: string;
  rarity: Rarity;
  /** 1 = first form, 2 and 3 = grown. */
  stage: 1 | 2 | 3;
  /** The last form of its family (stage 3 for the first 18 families, stage 2 for rare ones, stage 1 for ultra rares). */
  final: boolean;
  stats: Stats;
  attacks: Attack[];
  /** The species this grows into, and the level it happens at. */
  evolvesTo?: string;
  evolveAt?: number;
}

/** What a grown monster's base stats are multiplied by. */
export const STAGE_BOOST = [1, 1.25, 1.55] as const;

/**
 * Rare and ultra rare monsters are a little stronger (James, 2 Nov 2026): their base stats are
 * multiplied by this on top of the stage boost, so a grown rare is about as strong as a fully grown
 * common, and never so strong that answering questions stops mattering.
 */
export const RARITY_BOOST: Record<Rarity, number> = { common: 1, uncommon: 1, rare: 1.12, ultra: 1.2 };

export const TYPE_ATTACKS: Record<TypeId, { basic: Attack; big: Attack }> = {
  leaf: { basic: { name: 'Leaf Count', power: 35, anim: 'leaf-1' }, big: { name: 'Forest Sum', power: 80, anim: 'leaf-3' } },
  water: { basic: { name: 'Splash Add', power: 35, anim: 'water-1' }, big: { name: 'Tidal Total', power: 80, anim: 'water-3' } },
  fire: { basic: { name: 'Spark Times', power: 35, anim: 'fire-1' }, big: { name: 'Multiply Blaze', power: 80, anim: 'fire-3' } },
  ice: { basic: { name: 'Frost Share', power: 35, anim: 'ice-1' }, big: { name: 'Blizzard Split', power: 80, anim: 'ice-3' } },
  spark: { basic: { name: 'Zap Part', power: 35, anim: 'spark-1' }, big: { name: 'Thunder Whole', power: 80, anim: 'spark-3' } },
  stone: { basic: { name: 'Pebble Toss', power: 35, anim: 'stone-1' }, big: { name: 'Boulder Point', power: 80, anim: 'stone-3' } },
};

interface Family {
  type: TypeId;
  names: [string, string, string];
  stats: Stats;
  /** The family's two own attacks: learned at stage 1 and stage 2. */
  moves: [string, string];
  evolveAt: [number, number];
}

/** A rare family or sleeping giant: two forms. A giant's second type is only for its look and its egg. */
interface RareFamily {
  type: TypeId;
  names: [string, string];
  stats: Stats;
  moves: [string, string];
  evolveAt: number;
  giant?: true;
}

/** An ultra rare: one form, two types, an attack of each type's own plus both big attacks. */
interface UltraMonster {
  type: TypeId;
  type2: TypeId;
  name: string;
  stats: Stats;
  moves: [string, string];
}

/** THE NAMES FOR JAMES TO OK are in the `names` of each family. */
export const FAMILIES: Record<string, Family> = {
  digibud:     { type: 'leaf',  names: ['Digibud', 'Tensprout', 'Thousandtree'],    stats: { hp: 42, atk: 11, def: 11 }, moves: ['Digit Dart', 'Value Vine'],         evolveAt: [16, 32] },
  roundroot:   { type: 'leaf',  names: ['Roundroot', 'Nearestree', 'Rounderoak'],   stats: { hp: 50, atk: 9,  def: 13 }, moves: ['Round Up', 'Root Round'],           evolveAt: [15, 31] },
  placepetal:  { type: 'leaf',  names: ['Placepetal', 'Valuebloom', 'Millibloom'],  stats: { hp: 38, atk: 13, def: 9 },  moves: ['Petal Place', 'Bloom Value'],       evolveAt: [17, 34] },
  plusplash:   { type: 'water', names: ['Plusplash', 'Sumsplash', 'Totalwave'],     stats: { hp: 40, atk: 11, def: 11 }, moves: ['Plus Puddle', 'Sum Surge'],         evolveAt: [16, 32] },
  minnowus:    { type: 'water', names: ['Minnowus', 'Minusfin', 'Minusharker'],     stats: { hp: 36, atk: 13, def: 9 },  moves: ['Take Bite', 'Minus Current'],       evolveAt: [16, 33] },
  carrycrab:   { type: 'water', names: ['Carrycrab', 'Regroupcrab', 'Kingcarrab'],  stats: { hp: 48, atk: 10, def: 13 }, moves: ['Carry Claw', 'Borrow Snap'],        evolveAt: [18, 35] },
  factorch:    { type: 'fire',  names: ['Factorch', 'Factoblaze', 'Factoinferno'],  stats: { hp: 38, atk: 13, def: 9 },  moves: ['Factor Flame', 'Table Torch'],      evolveAt: [16, 32] },
  multipup:    { type: 'fire',  names: ['Multipup', 'Multihound', 'Multiplosion'],  stats: { hp: 42, atk: 11, def: 11 }, moves: ['Times Nip', 'Product Pounce'],      evolveAt: [15, 30] },
  squaremander: { type: 'fire', names: ['Squaremander', 'Cubemander', 'Powermander'], stats: { hp: 46, atk: 10, def: 12 }, moves: ['Square Singe', 'Cube Scorch'],  evolveAt: [18, 36] },
  divvy:       { type: 'ice',   names: ['Divvy', 'Quotipeng', 'Emperor Quotient'], stats: { hp: 40, atk: 11, def: 11 }, moves: ['Divide Dive', 'Quotient Slide'],    evolveAt: [16, 32] },
  remaindeer:  { type: 'ice',   names: ['Remaindeer', 'Remainstag', 'Remaindreign'], stats: { hp: 44, atk: 12, def: 10 }, moves: ['Left-over Leap', 'Antler Chill'], evolveAt: [17, 34] },
  sharebear:   { type: 'ice',   names: ['Sharebear', 'Splitbear', 'Polarsplit'],    stats: { hp: 50, atk: 9,  def: 13 }, moves: ['Fair Share', 'Equal Swipe'],        evolveAt: [16, 31] },
  fractopus:   { type: 'spark', names: ['Fractopus', 'Fractoshock', 'Fractostorm'], stats: { hp: 40, atk: 12, def: 10 }, moves: ['Half Zap', 'Quarter Charge'],       evolveAt: [16, 32] },
  numeratot:   { type: 'spark', names: ['Numeratot', 'Numerator', 'Numeratron'],    stats: { hp: 36, atk: 13, def: 9 },  moves: ['Top Spark', 'Count Current'],       evolveAt: [15, 31] },
  denomibolt:  { type: 'spark', names: ['Denomibolt', 'Denomivolt', 'Denominator'], stats: { hp: 46, atk: 10, def: 12 }, moves: ['Bottom Bolt', 'Equal Parts'],       evolveAt: [17, 34] },
  pebblepoint: { type: 'stone', names: ['Pebblepoint', 'Decimound', 'Decimountain'], stats: { hp: 48, atk: 10, def: 12 }, moves: ['Point Pelt', 'Tenth Tumble'],     evolveAt: [16, 32] },
  coinrock:    { type: 'stone', names: ['Coinrock', 'Dollarock', 'Goldilith'],      stats: { hp: 42, atk: 11, def: 11 }, moves: ['Coin Clunk', 'Change Crush'],       evolveAt: [16, 33] },
  centipebble: { type: 'stone', names: ['Centipebble', 'Centipillar', 'Centurock'], stats: { hp: 38, atk: 13, def: 9 },  moves: ['Cent Skip', 'Hundredth Hit'],       evolveAt: [17, 34] },
};

/** One family of each type turns up less often in the grass (green ring in the book). No new pictures needed. */
export const UNCOMMON: ReadonlySet<string> = new Set(['placepetal', 'carrycrab', 'squaremander', 'remaindeer', 'denomibolt', 'centipebble']);

/** THE NEW NAMES FOR JAMES TO OK (Q.1). Rare families: one per type, found in the bonus areas and in eggs. */
export const RARE_FAMILIES: Record<string, RareFamily> = {
  kilokiwi:   { type: 'leaf',  names: ['Kilokiwi', 'Megakiwi'],         stats: { hp: 46, atk: 12, def: 12 }, moves: ['Thousand Peck', 'Million Dash'],   evolveAt: 24 },
  plustoise:  { type: 'water', names: ['Plustoise', 'Totaltoise'],      stats: { hp: 52, atk: 10, def: 14 }, moves: ['Shell Sum', 'Grand Total'],        evolveAt: 25 },
  arraydillo: { type: 'fire',  names: ['Arraydillo', 'Arraymadillo'],   stats: { hp: 44, atk: 13, def: 11 }, moves: ['Row Roll', 'Column Blaze'],        evolveAt: 24 },
  shareseal:  { type: 'ice',   names: ['Shareseal', 'Divisorca'],       stats: { hp: 48, atk: 12, def: 11 }, moves: ['Ice Share', 'Orca Split'],         evolveAt: 25 },
  quarterowl: { type: 'spark', names: ['Quarterowl', 'Wholeowl'],       stats: { hp: 42, atk: 13, def: 11 }, moves: ['Quarter Hoot', 'Whole Flash'],     evolveAt: 24 },
  tuatenth:   { type: 'stone', names: ['Tuatenth', 'Hundredthara'],     stats: { hp: 50, atk: 11, def: 13 }, moves: ['Tenth Tail', 'Hundredth Crush'],   evolveAt: 25 },
  // The sleeping giants. The first form only hatches from an egg; the giant you wake is the second form.
  dozepebble: { type: 'stone', names: ['Dozepebble', 'Snorumble'],      stats: { hp: 60, atk: 12, def: 14 }, moves: ['Snore Tumble', 'Rumble Nap'],      evolveAt: 28, giant: true },
  napsea:     { type: 'water', names: ['Napsea', 'Drowsea'],            stats: { hp: 58, atk: 12, def: 13 }, moves: ['Sleepy Wave', 'Deep Dream Tide'],  evolveAt: 28, giant: true },
  blinkberg:  { type: 'ice',   names: ['Blinkberg', 'Yawnberg'],        stats: { hp: 58, atk: 13, def: 12 }, moves: ['Yawn Freeze', 'Glacier Snooze'],   evolveAt: 28, giant: true },
};

/** Ultra rares: from ultra rare eggs and the finale only. */
export const ULTRA_MONSTERS: Record<string, UltraMonster> = {
  infinitail: { type: 'fire',  type2: 'spark', name: 'Infinitail', stats: { hp: 50, atk: 14, def: 12 }, moves: ['Endless Flame', 'Forever Bolt'] },
  primerald:  { type: 'leaf',  type2: 'stone', name: 'Primerald',  stats: { hp: 54, atk: 13, def: 13 }, moves: ['Prime Vine', 'Prime Gem'] },
  equalizard: { type: 'water', type2: 'ice',   name: 'Equalizard', stats: { hp: 52, atk: 13, def: 13 }, moves: ['Balance Wave', 'Equal Frost'] },
};

/** Moves' power: the type's basic attack is 35, then the family's two own attacks. */
const OWN_POWER = [45, 60] as const;

const scaled = (stats: Stats, by: number): Stats => ({ hp: Math.round(stats.hp * by), atk: Math.round(stats.atk * by), def: Math.round(stats.def * by) });

function build(): Species[] {
  const out: Species[] = [];
  for (const [family, f] of Object.entries(FAMILIES)) {
    const rarity: Rarity = UNCOMMON.has(family) ? 'uncommon' : 'common';
    const { basic, big } = TYPE_ATTACKS[f.type];
    const own = f.moves.map((name, i): Attack => ({ name, power: OWN_POWER[i], anim: `${f.type}-2` }));
    const idOf = (i: number) => `${family}-${i + 1}`;
    f.names.forEach((name, i) => {
      const stage = (i + 1) as 1 | 2 | 3;
      const boost = STAGE_BOOST[i];
      out.push({
        id: idOf(i),
        name,
        type: f.type,
        family,
        rarity,
        stage,
        final: stage === 3,
        stats: scaled(f.stats, boost),
        attacks: stage === 1 ? [basic, own[0]] : stage === 2 ? [basic, own[0], own[1]] : [basic, own[0], own[1], big],
        ...(stage < 3 ? { evolvesTo: idOf(i + 1), evolveAt: f.evolveAt[i] } : {}),
      });
    });
  }
  // Rare families: the first form knows the basic attack and its first move; the grown form has all four.
  for (const [family, f] of Object.entries(RARE_FAMILIES)) {
    const { basic, big } = TYPE_ATTACKS[f.type];
    const own = f.moves.map((name, i): Attack => ({ name, power: OWN_POWER[i], anim: `${f.type}-2` }));
    f.names.forEach((name, i) => {
      const stage = (i + 1) as 1 | 2;
      out.push({
        id: `${family}-${stage}`,
        name,
        type: f.type,
        family,
        rarity: 'rare',
        stage,
        final: stage === 2,
        stats: scaled(f.stats, STAGE_BOOST[i * 2] * RARITY_BOOST.rare),
        attacks: stage === 1 ? [basic, own[0]] : [basic, own[0], own[1], big],
        ...(stage === 1 ? { evolvesTo: `${family}-2`, evolveAt: f.evolveAt } : {}),
      });
    });
  }
  // Ultra rares: one own move of each type and the big attack of each type, so a pupil picks which topic to answer.
  for (const [family, u] of Object.entries(ULTRA_MONSTERS)) {
    out.push({
      id: `${family}-1`,
      name: u.name,
      type: u.type,
      type2: u.type2,
      family,
      rarity: 'ultra',
      stage: 1,
      final: true,
      stats: scaled(u.stats, STAGE_BOOST[2] * RARITY_BOOST.ultra),
      attacks: [
        { name: u.moves[0], power: OWN_POWER[1], anim: `${u.type}-2`, type: u.type },
        { name: u.moves[1], power: OWN_POWER[1], anim: `${u.type2}-2`, type: u.type2 },
        { ...TYPE_ATTACKS[u.type].big, type: u.type },
        { ...TYPE_ATTACKS[u.type2].big, type: u.type2 },
      ],
    });
  }
  return out;
}

/** The type an attack is: its own for an ultra rare's attacks, otherwise its monster's. */
export const attackType = (species: Species, attack: Attack): TypeId => attack.type ?? species.type;

/** Every family with forms that grow by level (the first 18 and the rare ones), for the wild lists and eggs. */
const GROWTH: Record<string, number[]> = {
  ...Object.fromEntries(Object.entries(FAMILIES).map(([id, f]) => [id, f.evolveAt])),
  ...Object.fromEntries(Object.entries(RARE_FAMILIES).map(([id, f]) => [id, [f.evolveAt]])),
};

/** Is this a family name (as a map's wild list or an egg uses them), rather than one fixed species? */
export const isFamily = (id: string) => id in GROWTH || id in ULTRA_MONSTERS;

/** All 75 entries, family by family, first form to last: the first 18 families, the rare ones, then the ultra rares. */
export const MONSTER_BOOK: readonly Species[] = build();

const BY_ID = new Map(MONSTER_BOOK.map((s) => [s.id, s]));

/** The form of a family a monster of this level has (first form below its first growth level, and so on). */
export function formAt(family: string, level: number): string {
  if (family in ULTRA_MONSTERS) return `${family}-1`;
  const at = GROWTH[family];
  if (!at) throw new Error(`No monster family "${family}" in the monster book`);
  return `${family}-${1 + at.filter((l) => level >= l).length}`;
}

export function speciesOf(id: string): Species {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`No monster "${id}" in the monster book`);
  return s;
}

/** The first forms (the ones found in the wild at low levels), optionally of one type. */
export const firstForms = (type?: TypeId) => MONSTER_BOOK.filter((s) => s.stage === 1 && (!type || s.type === type));
