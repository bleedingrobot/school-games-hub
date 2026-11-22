/**
 * A test road for the maths (Stage 3): a recharge port, a 3-lane data gate and a 4-lane one, on a wide straight road, and
 * (Stage 4) a checkpoint between the gates: driving straight down the middle falls off at the second gate and restarts there.
 * Data gates start in world 2 (James, 22 Nov 2026), so no world-1 road has one. This road is never a pupil's road: only
 * the preview (`?test=1`) and the tests add it, with `allowTestRoad`.
 */
import { GRAVITY } from '../config';
import type { RoadDef } from '../road';

export const TEST_ROAD: RoadDef = {
  id: 'test-gates',
  name: 'Test: port and gates',
  world: 'motherboard',
  gravity: GRAVITY.motherboard,
  battery: 40,
  signal: 70,
  rows: [
    '------- x14',
    '..+++.. x3',
    '------- x40',
    '.?.?.?. x14',
    '------- x40 @',
    '.??.??. x14',
    '------- x16',
  ],
};
