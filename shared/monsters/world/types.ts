/**
 * What a loaded Maths Monsters map looks like, and the one plain object that holds a game in
 * progress (`WorldState`). No browser, no screens: this is all plain data.
 */
import type { Bag } from '../engine';
import type { Monster } from '../rules';

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
export const DELTA: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Things you can talk to. They all block walking. */
export type ThingKind = 'sign' | 'person' | 'nurse' | 'box' | 'book' | 'closed' | 'trainer';

export interface TrainerMonster {
  species: string;
  level: number;
}

export interface Thing {
  kind: ThingKind;
  /** Unique across the whole world (map id + object name), so a beaten trainer can be remembered. */
  id: string;
  name: string;
  x: number;
  y: number;
  facing: Dir;
  /** Which Tiny Dungeon picture draws a person (people only). */
  sprite?: number;
  /** What they say, one page per tap. */
  pages: string[];
  /** Trainers only. */
  team?: TrainerMonster[];
  /** How many tiles ahead a trainer can see you. */
  sight?: number;
  /** What a trainer says after you beat them. */
  winPages?: string[];
}

export interface Warp {
  id: string;
  x: number;
  y: number;
  /** The map you arrive in, the tile, and the way you face. */
  to: string;
  toX: number;
  toY: number;
  facing: Dir;
}

/** A named place on a map (the start, where you wake up, and spots the test page can teleport to). */
export interface Spot {
  name: string;
  x: number;
  y: number;
  facing: Dir;
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 0 for towns, 1 to 6 for an area: which wild levels and question bands the grass uses. */
  area: number;
  /** Tile numbers (Tiled "gid"), width × height, row by row. 0 = nothing. */
  ground: number[];
  walls: number[];
  grass: number[];
  /** Per tile: can't walk here (a tile on the walls layer, or a person or sign stands there). */
  blocked: boolean[];
  isGrass: boolean[];
  /** The far half of the area: higher wild levels and harder questions. */
  far: boolean[];
  things: Thing[];
  warps: Warp[];
  spots: Spot[];
  /** Wild monsters in this map's long grass (species ids, first forms). */
  wild: string[];
}

export interface HealSpot {
  map: string;
  x: number;
  y: number;
  facing: Dir;
}

/**
 * A game in progress. Plain data: `JSON.stringify` it and `JSON.parse` it back and nothing
 * changes, so saving it later (stage N.6) needs no rewrite.
 */
export interface WorldState {
  version: 1;
  map: string;
  x: number;
  y: number;
  facing: Dir;
  team: Monster[];
  box: Monster[];
  bag: Bag;
  /** Trainers beaten on this visit to the map (cleared when you go to another map). */
  beaten: string[];
  /** Where you wake up after a lost battle: the last healing spot. */
  heal: HealSpot;
  /** The random number generator's position, so the same seed always gives the same walk. */
  seed: number;
  /** Long-grass steps left before the next wild battle. */
  grassSteps: number;
  /** Steps of "Repel" left (the item comes later; this is where it plugs in). */
  repel: number;
  /** Steps taken in all. */
  steps: number;
}
