/**
 * Wild battles in long grass, and trainers who spot you. All the numbers a person might want to
 * change are in ENCOUNTERS. No browser, no clock: random numbers come from a seeded `Dice`.
 */
import { AREA_LEVELS } from '../bands';
import { FAMILIES, formAt } from '../monsterBook';
import { makeMonster, type Monster } from '../rules';
import type { Dice } from './rng';
import { DELTA, type GameMap, type Thing, type WorldState } from './types';
import { isBlocked } from './walking';

/** EASY TO EDIT: how often grass starts a battle. */
export const ENCOUNTERS = {
  /** A wild battle starts after this many steps in long grass (a number from the low to the high, both included). */
  steps: { min: 12, max: 20 },
  /** The test page's "More battles" switch. */
  fastSteps: { min: 2, max: 3 },
  /** How many tiles ahead a trainer sees you unless the map says otherwise. */
  trainerSight: 4,
};

export function nextGrassSteps(dice: Dice, fast: boolean): number {
  const r = fast ? ENCOUNTERS.fastSteps : ENCOUNTERS.steps;
  return dice.int(r.min, r.max);
}

/** The wild levels for an area: its range cut in half, the near half (by town) then the far half. */
export function wildLevels(area: number, far: boolean): [number, number] {
  const [low, high] = AREA_LEVELS[Math.min(Math.max(area, 1), AREA_LEVELS.length) - 1];
  const mid = Math.round((low + high) / 2);
  return far ? [mid, high] : [low, mid];
}

/** The species a wild list entry gives at a level: a family grows with the level, a fixed species stays. */
export const wildSpecies = (entry: string, level: number) => (FAMILIES[entry] ? formAt(entry, level) : entry);

/** A wild monster for a tile of long grass: one of the map's monsters, at a level in the area's range. */
export function wildFor(map: GameMap, x: number, y: number, dice: Dice): Monster | null {
  if (!map.wild.length) return null;
  const far = map.far[y * map.width + x];
  const [low, high] = wildLevels(map.area, far);
  const entry = map.wild[dice.int(0, map.wild.length - 1)];
  const level = dice.int(low, high);
  return makeMonster(wildSpecies(entry, level), level, () => dice.next());
}

export interface Sighting {
  trainer: Thing;
  /** The tiles the trainer walks over to reach you, in order. The last is right next to you. Empty if already next to you. */
  path: [number, number][];
}

/**
 * A trainer who hasn't fought you yet sees you if you stand in the line of tiles they face,
 * within their sight, with nothing in the way.
 */
export function findSighting(map: GameMap, state: Pick<WorldState, 'x' | 'y' | 'beaten'> & { badges?: string[] }): Sighting | null {
  for (const t of map.things) {
    if (t.kind !== 'trainer' || state.beaten.includes(t.id) || (t.badge && state.badges?.includes(t.badge))) continue;
    const [dx, dy] = DELTA[t.facing];
    const path: [number, number][] = [];
    for (let k = 1; k <= (t.sight ?? ENCOUNTERS.trainerSight); k++) {
      const x = t.x + dx * k;
      const y = t.y + dy * k;
      if (x === state.x && y === state.y) return { trainer: t, path };
      if (isBlocked(map, x, y, state.badges)) break;
      path.push([x, y]);
    }
  }
  return null;
}
