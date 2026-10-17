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

const RAW: Record<string, unknown> = {
  'harbour-town': harbourTown,
  'healing-centre': healingCentre,
  'kauri-bush': kauriBush,
};

export const WORLD_MAPS: Readonly<Record<string, GameMap>> = Object.fromEntries(
  Object.entries(RAW).map(([id, raw]) => [id, parseMap(id, raw as TiledMap)]),
);

/** The raw Tiled files too: the screen reads their tile sets (and which tiles animate). */
export const RAW_MAPS = RAW as Record<string, TiledMap>;
