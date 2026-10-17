/**
 * The six areas in the order you walk them, and what each one is about. Area N's maths topic is
 * its type's topic (section 4 of the plan), its badge is the type's name, and its Topic Tower is
 * two small rooms (a hall, then the top floor where the Tower trainer waits).
 */
import type { TypeId } from '../types';

export interface AreaInfo {
  area: number;
  /** The outdoor map. */
  map: string;
  name: string;
  /** The type this area leans on, and the badge its Tower gives (the same word). */
  type: TypeId;
  badge: string;
  towerHall: string;
  towerTop: string;
}

export const AREAS: readonly AreaInfo[] = [
  { area: 1, map: 'kauri-bush', name: 'Kauri Bush', type: 'leaf', badge: 'leaf', towerHall: 'tower-1-hall', towerTop: 'tower-1-top' },
  { area: 2, map: 'shell-beach', name: 'Shell Beach', type: 'water', badge: 'water', towerHall: 'tower-2-hall', towerTop: 'tower-2-top' },
  { area: 3, map: 'fire-mountain', name: 'Fire Mountain', type: 'fire', badge: 'fire', towerHall: 'tower-3-hall', towerTop: 'tower-3-top' },
  { area: 4, map: 'snowy-peaks', name: 'Snowy Peaks', type: 'ice', badge: 'ice', towerHall: 'tower-4-hall', towerTop: 'tower-4-top' },
  { area: 5, map: 'glowworm-caves', name: 'Glowworm Caves', type: 'spark', badge: 'spark', towerHall: 'tower-5-hall', towerTop: 'tower-5-top' },
  { area: 6, map: 'harbour-city', name: 'Harbour City', type: 'stone', badge: 'stone', towerHall: 'tower-6-hall', towerTop: 'tower-6-top' },
];

/** The badge names, in the order you earn them. */
export const BADGE_ORDER: readonly string[] = AREAS.map((a) => a.badge);

export const areaInfo = (area: number) => AREAS[area - 1];
