/**
 * The campaign: 10 levels, in order. Each is a JSON file in this folder that can be edited
 * by hand (docs/gem-keep/LEVELS.md explains the format; `npm test` checks every level).
 */
import type { LevelData } from '../level';
import level01 from './level-01.json';
import level02 from './level-02.json';
import level03 from './level-03.json';
import level04 from './level-04.json';
import level05 from './level-05.json';
import level06 from './level-06.json';
import level07 from './level-07.json';
import level08 from './level-08.json';
import level09 from './level-09.json';
import level10 from './level-10.json';

export const CAMPAIGN: LevelData[] = [level01, level02, level03, level04, level05, level06, level07, level08, level09, level10] as LevelData[];

/** The level with this id, and its number (1–10). */
export function findLevel(id: string): { level: LevelData; number: number } | null {
  const i = CAMPAIGN.findIndex((l) => l.id === id);
  return i < 0 ? null : { level: CAMPAIGN[i], number: i + 1 };
}
