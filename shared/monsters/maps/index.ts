/**
 * All the maps in the game, loaded and checked. To add a map: make its JSON (in Tiled, or with
 * scripts/make-monster-maps.mjs), import it here, and add it to RAW. `npm test` then checks that
 * every door leads somewhere and you can walk to everything.
 */
import { parseMap, type TiledMap } from '../world/mapLoader';
import type { GameMap } from '../world/types';
import harbourTown from './harbour-town.json';
import healingCentre from './healing-centre.json';
import kauriBush from './kauri-bush.json';
import shellBeach from './shell-beach.json';
import fireMountain from './fire-mountain.json';
import snowyPeaks from './snowy-peaks.json';
import glowwormCaves from './glowworm-caves.json';
import harbourCity from './harbour-city.json';
import tower1Hall from './tower-1-hall.json';
import tower1Top from './tower-1-top.json';
import tower2Hall from './tower-2-hall.json';
import tower2Top from './tower-2-top.json';
import tower3Hall from './tower-3-hall.json';
import tower3Top from './tower-3-top.json';
import tower4Hall from './tower-4-hall.json';
import tower4Top from './tower-4-top.json';
import tower5Hall from './tower-5-hall.json';
import tower5Top from './tower-5-top.json';
import tower6Hall from './tower-6-hall.json';
import tower6Top from './tower-6-top.json';

const RAW: Record<string, unknown> = {
  'harbour-town': harbourTown,
  'healing-centre': healingCentre,
  'kauri-bush': kauriBush,
  'shell-beach': shellBeach,
  'fire-mountain': fireMountain,
  'snowy-peaks': snowyPeaks,
  'glowworm-caves': glowwormCaves,
  'harbour-city': harbourCity,
  'tower-1-hall': tower1Hall,
  'tower-1-top': tower1Top,
  'tower-2-hall': tower2Hall,
  'tower-2-top': tower2Top,
  'tower-3-hall': tower3Hall,
  'tower-3-top': tower3Top,
  'tower-4-hall': tower4Hall,
  'tower-4-top': tower4Top,
  'tower-5-hall': tower5Hall,
  'tower-5-top': tower5Top,
  'tower-6-hall': tower6Hall,
  'tower-6-top': tower6Top,
};

export const WORLD_MAPS: Readonly<Record<string, GameMap>> = Object.fromEntries(
  Object.entries(RAW).map(([id, raw]) => [id, parseMap(id, raw as TiledMap)]),
);

/** The raw Tiled files too: the screen reads their tile sets (and which tiles animate). */
export const RAW_MAPS = RAW as Record<string, TiledMap>;
