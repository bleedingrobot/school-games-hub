/**
 * Gems: what each one does, and combining two into one stronger gem.
 *
 * Four colours in v1, each with its own shape so they can be told apart without colour:
 * red triangle (area damage), blue circle (slow), green hexagon (poison), yellow star (critical hits).
 * Two gems of the same grade make one gem of the next grade. Two different colours make a
 * mixed gem with every effect of both, each a bit weaker.
 */
import { EFFECTS, GEM, TOWER } from './config';

export const COLOURS = ['red', 'blue', 'green', 'yellow'] as const;
export type Colour = (typeof COLOURS)[number];

export interface Gem {
  id: number;
  grade: number;
  /** One colour, or more for a mixed gem. Always in COLOURS order, no repeats. */
  colours: Colour[];
}

/** What a gem in a tower of this level does with one shot. */
export interface ShotStats {
  damage: number;
  /** Shots a second. */
  rate: number;
  /** Tiles. */
  range: number;
  /** 0 when the gem doesn't have that colour. */
  splashRadius: number;
  splashShare: number;
  slow: number;
  slowSeconds: number;
  poisonShare: number;
  poisonSeconds: number;
  critChance: number;
  critMultiplier: number;
}

export function shotStats(gem: Gem, towerLevel: number): ShotStats {
  const g = gem.grade;
  const has = (c: Colour) => gem.colours.includes(c);
  const strength = gem.colours.length > 1 ? GEM.mixedStrength : 1;
  const { red, blue, green, yellow } = EFFECTS;
  return {
    damage: GEM.damage * GEM.damagePerGrade ** (g - 1),
    rate: (GEM.rate + GEM.ratePerGrade * (g - 1)) * TOWER.rateBonus[towerLevel - 1],
    range: GEM.range + GEM.rangePerGrade * (g - 1) + TOWER.rangeBonus[towerLevel - 1],
    splashRadius: has('red') ? red.radius + red.radiusPerGrade * (g - 1) : 0,
    splashShare: has('red') ? red.share * strength : 0,
    slow: has('blue') ? Math.min(blue.maxSlow, blue.slow + blue.slowPerGrade * (g - 1)) * strength : 0,
    slowSeconds: blue.seconds,
    poisonShare: has('green') ? (green.share + green.sharePerGrade * (g - 1)) * strength : 0,
    poisonSeconds: green.seconds,
    critChance: has('yellow') ? (yellow.chance + yellow.chancePerGrade * (g - 1)) * strength : 0,
    critMultiplier: yellow.multiplier,
  };
}

/** Why two gems can't be combined, or null if they can. */
export function combineProblem(a: Gem, b: Gem): 'same-gem' | 'different-grades' | 'max-grade' | null {
  if (a.id === b.id) return 'same-gem';
  if (a.grade !== b.grade) return 'different-grades';
  if (a.grade >= GEM.maxGrade) return 'max-grade';
  return null;
}

export const combineCost = (grade: number) => GEM.combineCost[grade - 1];

/** The gem two gems make. Check `combineProblem` first. */
export function combined(a: Gem, b: Gem, id: number): Gem {
  return { id, grade: a.grade + 1, colours: COLOURS.filter((c) => a.colours.includes(c) || b.colours.includes(c)) };
}
