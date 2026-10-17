#!/usr/bin/env node
/**
 * Makes the Maths Monsters maps (shared/monsters/maps/*.json) in the Tiled format.
 * The maps are written as a few easy steps (fill, path, tree, house, sign, chest, gate...) and
 * come out as normal Tiled JSON, so you can also open the JSON in the Tiled editor and change it there.
 * The toolbox is scripts/monster-maps/lib.mjs; the maps are the other files in that folder.
 * Run: node scripts/make-monster-maps.mjs
 */
import { harbourTown, healingCentre } from './monster-maps/town.mjs';
import { kauriBush } from './monster-maps/area1.mjs';
import { fireMountain, glowwormCaves, harbourCity, shellBeach, snowyPeaks } from './monster-maps/areas.mjs';

harbourTown();
healingCentre();
kauriBush();
shellBeach();
fireMountain();
snowyPeaks();
glowwormCaves();
harbourCity();
