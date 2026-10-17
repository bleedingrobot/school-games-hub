/**
 * The monster book: 18 families (3 per type), each growing twice, so 54 entries.
 * ALL THE MONSTER DATA LIVES HERE, so it is easy to edit: names, stats, attacks, evolve levels.
 *
 *  - `stats` are the stage-1 base numbers; a grown monster gets them times STAGE_BOOST.
 *  - Every monster has its type's basic attack, then its family's two own attacks as it grows,
 *    and the type's big attack once it is fully grown. (Attacks: name, power, animation id.)
 *  - `evolveAt` is the level each growth happens at: [stage 1 → 2, stage 2 → 3].
 */
import type { TypeId } from './types';

export interface Attack {
  name: string;
  /** How hard it hits before levels and types (about 35 to 80). */
  power: number;
  /** Which attack effect the screens play, e.g. "leaf-1". */
  anim: string;
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
  family: string;
  /** 1 = first form, 2 and 3 = grown. */
  stage: 1 | 2 | 3;
  stats: Stats;
  attacks: Attack[];
  /** The species this grows into, and the level it happens at. */
  evolvesTo?: string;
  evolveAt?: number;
}

/** What a grown monster's base stats are multiplied by. */
export const STAGE_BOOST = [1, 1.25, 1.55] as const;

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

/** Moves' power: the type's basic attack is 35, then the family's two own attacks. */
const OWN_POWER = [45, 60] as const;

function build(): Species[] {
  const out: Species[] = [];
  for (const [family, f] of Object.entries(FAMILIES)) {
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
        stage,
        stats: { hp: Math.round(f.stats.hp * boost), atk: Math.round(f.stats.atk * boost), def: Math.round(f.stats.def * boost) },
        attacks: stage === 1 ? [basic, own[0]] : stage === 2 ? [basic, own[0], own[1]] : [basic, own[0], own[1], big],
        ...(stage < 3 ? { evolvesTo: idOf(i + 1), evolveAt: f.evolveAt[i] } : {}),
      });
    });
  }
  return out;
}

/** All 54 entries, family by family, first form to last. */
export const MONSTER_BOOK: readonly Species[] = build();

const BY_ID = new Map(MONSTER_BOOK.map((s) => [s.id, s]));

export function speciesOf(id: string): Species {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`No monster "${id}" in the monster book`);
  return s;
}

/** The first forms (the ones found in the wild at low levels), optionally of one type. */
export const firstForms = (type?: TypeId) => MONSTER_BOOK.filter((s) => s.stage === 1 && (!type || s.type === type));
