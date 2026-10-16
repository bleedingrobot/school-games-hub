/**
 * A Gem Keep level: the map, the path(s) enemies walk, and the waves. Levels are plain data
 * (JSON in Phase 4), checked by `checkLevel` before they're played.
 */
import { GRID_COLUMNS, GRID_ROWS, type EnemyKind, ENEMIES } from './config';

/** A tile, as [column, row]. Column 0 is the left edge, row 0 the top. */
export type Tile = [number, number];

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  /** Seconds between each one. */
  gap: number;
  /** Seconds after the wave starts before the first one. Default 0. */
  delay?: number;
  /** Which path they walk (index into `paths`). Default: take turns on every path. */
  path?: number;
}

export interface LevelData {
  id: string;
  name: string;
  /** One line shown on the campaign map. */
  intro?: string;
  /** Multiplies every enemy's health (default 1). How later levels get harder. */
  toughness?: number;
  /**
   * One string per row, one letter per tile: '.' grass (you can build here), '^' rocks and
   * '~' water (you can't). Path tiles are worked out from `paths`, so draw them as '.'.
   */
  map: string[];
  /**
   * Each path is a list of corners, joined by straight lines across or down the grid. The
   * first corner may be one tile off the edge (where enemies come in); the last is the Keep.
   */
  paths: Tile[][];
  startMana?: number;
  waves: { groups: WaveGroup[] }[];
}

/** A path ready to walk: its corners as points (tile centres) and its length. */
export interface PathShape {
  points: { x: number; y: number }[];
  /** Distance from the start to each point. */
  at: number[];
  length: number;
}

export function pathShape(corners: Tile[]): PathShape {
  const points = corners.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
  const at = [0];
  for (let i = 1; i < points.length; i++) {
    at.push(at[i - 1] + Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y));
  }
  return { points, at, length: at[at.length - 1] };
}

/** Where on the map something is, this far along a path. Past the end means at the Keep. */
export function pointAlong(path: PathShape, distance: number): { x: number; y: number } {
  const { points, at } = path;
  if (distance <= 0) return points[0];
  for (let i = 1; i < points.length; i++) {
    if (distance <= at[i]) {
      const t = (distance - at[i - 1]) / (at[i] - at[i - 1] || 1);
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
    }
  }
  return points[points.length - 1];
}

/** Every tile a path covers, in order, including its corners. */
export function pathTiles(corners: Tile[]): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 1; i < corners.length; i++) {
    const [c0, r0] = corners[i - 1];
    const [c1, r1] = corners[i];
    const steps = Math.abs(c1 - c0) + Math.abs(r1 - r0);
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      tiles.push([c0 + Math.sign(c1 - c0) * s, r0 + Math.sign(r1 - r0) * s]);
    }
  }
  return tiles;
}

export const onGrid = ([c, r]: Tile) => c >= 0 && c < GRID_COLUMNS && r >= 0 && r < GRID_ROWS;

/** What's on each tile, as a grid [row][column]. */
export type Ground = 'grass' | 'rock' | 'water' | 'path' | 'keep';

export function groundOf(level: LevelData): Ground[][] {
  const ground: Ground[][] = level.map.map((row) =>
    [...row].map((ch) => (ch === '^' ? 'rock' : ch === '~' ? 'water' : 'grass')),
  );
  for (const corners of level.paths) {
    for (const tile of pathTiles(corners)) if (onGrid(tile)) ground[tile[1]][tile[0]] = 'path';
    const [kc, kr] = corners[corners.length - 1];
    ground[kr][kc] = 'keep';
  }
  return ground;
}

/** Everything wrong with a level, in plain words. Empty means it's fine to play. */
export function checkLevel(level: LevelData): string[] {
  const problems: string[] = [];
  if (level.map.length !== GRID_ROWS) problems.push(`The map needs ${GRID_ROWS} rows, not ${level.map.length}.`);
  level.map.forEach((row, r) => {
    if (row.length !== GRID_COLUMNS) problems.push(`Row ${r + 1} needs ${GRID_COLUMNS} tiles, not ${row.length}.`);
    if (/[^.^~]/.test(row)) problems.push(`Row ${r + 1} has a letter that isn't . ^ or ~.`);
  });
  if (problems.length) return problems;
  if (level.paths.length === 0) problems.push('There are no paths.');
  const keeps = new Set<string>();
  level.paths.forEach((corners, p) => {
    const name = `Path ${p + 1}`;
    if (corners.length < 2) return problems.push(`${name} needs at least two corners.`);
    corners.forEach(([c, r], i) => {
      if (!Number.isInteger(c) || !Number.isInteger(r)) problems.push(`${name} corner ${i + 1} isn't a whole tile.`);
      const offByOne = c >= -1 && c <= GRID_COLUMNS && r >= -1 && r <= GRID_ROWS;
      if (i === 0 ? !offByOne : !onGrid([c, r])) problems.push(`${name} corner ${i + 1} is off the map.`);
      if (i > 0 && corners[i - 1][0] !== c && corners[i - 1][1] !== r) {
        problems.push(`${name} goes diagonally between corners ${i} and ${i + 1}.`);
      }
    });
    for (const tile of pathTiles(corners)) {
      if (onGrid(tile) && level.map[tile[1]][tile[0]] !== '.') problems.push(`${name} crosses rock or water at ${tile}.`);
    }
    keeps.add(String(corners[corners.length - 1]));
  });
  if (keeps.size > 1) problems.push('Every path must end at the same Keep.');
  if (level.waves.length === 0) problems.push('There are no waves.');
  if (level.toughness !== undefined && !(level.toughness > 0 && level.toughness <= 5)) problems.push('Toughness must be between 0 and 5.');
  level.waves.forEach((wave, w) => {
    if (wave.groups.length === 0) problems.push(`Wave ${w + 1} has no enemies.`);
    for (const g of wave.groups) {
      if (!(g.kind in ENEMIES)) problems.push(`Wave ${w + 1} has an unknown enemy "${g.kind}".`);
      if (!(g.count >= 1) || !(g.gap >= 0)) problems.push(`Wave ${w + 1} has a bad count or gap.`);
      if (g.path !== undefined && !(g.path >= 0 && g.path < level.paths.length)) problems.push(`Wave ${w + 1} uses a path that doesn't exist.`);
    }
  });
  return problems;
}
