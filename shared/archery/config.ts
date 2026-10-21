/**
 * Every tuning number for Archery Challenge's rules, in one place (docs/ARCHERY-PLAN.md, section 2).
 *
 * The rules only ever add, subtract, multiply, divide, take a square root and floor a number.
 * Those give identical answers in every browser and on the server. `Math.sin`, `Math.cos`,
 * `Math.atan2`, `Math.pow` and `Math.hypot` can differ slightly between Chrome and Safari, so
 * nothing in this folder uses them while a fight runs. Aim directions come from the fixed table
 * in `aim.ts` instead.
 *
 * James (21 Oct 2026): hilly land like Scorched Earth, no aiming help of any kind, and special
 * arrows that are scarce. Retune here.
 */
import type { WorldId } from './types';

// ——— The field ———
/** The logical field, in pixels (16:9). Screens draw it scaled. */
export const FIELD_W = 960;
export const FIELD_H = 540;
/** The land is a grid of square cells this many pixels across. */
export const CELL = 3;
export const COLS = FIELD_W / CELL; // 320
export const ROWS = FIELD_H / CELL; // 180

// ——— Time ———
/** The rules always move forward this many steps a second. */
export const STEPS_PER_SECOND = 240;
export const DT = 1 / STEPS_PER_SECOND;
/** An arrow still flying after this long (20 s) is a miss, so a replay always ends. */
export const MAX_FLIGHT_STEPS = STEPS_PER_SECOND * 20;
/** The flight path keeps one point every this many steps (60 a second). It's only for drawing. */
export const PATH_EVERY = 4;

// ——— Shots ———
/** Gravity pulls arrows down at this many px/s². */
export const GRAVITY = 300;
/** Power runs 0–100 in whole numbers. Speed = power × this (px/s), so full power is 600 px/s. */
export const MAX_POWER = 100;
export const POWER_TO_SPEED = 6;
/** Angles are whole degrees: 0 points right, 90 straight up, 180 left. */
export const MAX_ANGLE = 180;
/** The arrow starts this far from the archer's hands, along its direction. */
export const LAUNCH_OFFSET = 4;
/** How far past the left or right edge an arrow can go before it counts as gone. */
export const SIDE_MARGIN = 0;

// ——— Wind ———
/** The wind is a whole number from −n to +n, new each round. This is the usual n; each world has its own (WORLD_WIND_MAX). */
export const WIND_MAX = 10;
/** Each point of wind pushes arrows sideways at this many px/s² (10 points = 20% of gravity). */
export const WIND_ACCEL = 6;

// ——— Archers ———
/** An archer's box, in pixels. The archer stands with their feet at (x, y), in the middle of the box's bottom edge. */
export const ARCHER_W = 12;
export const ARCHER_H = 24;
/** Where the arrow leaves from: this high above the feet. */
export const HANDS_HEIGHT = 15;
export const START_HEALTH = 100;
/** Falling costs 1 health per cell fallen, never more than this per fall. */
export const FALL_DAMAGE_PER_CELL = 1;
export const FALL_DAMAGE_CAP = 25;
/** A fall shorter than this many cells does nothing (stepping off a little lip). */
export const FALL_SAFE_CELLS = 2;

// ——— Damage ———
/** A direct hit on an archer's box adds this to that archer's damage. */
export const DIRECT_HIT_BONUS = 10;
/**
 * Most one shot can ever take from one archer (shield and health together, falling included).
 * Below START_HEALTH, so no single arrow can knock out a full-health archer.
 */
export const MAX_SHOT_DAMAGE = 70;

// ——— Turns, rounds and fights ———
/** A fight is best of this many rounds (first to 2 wins). */
export const ROUNDS_TO_WIN = 2;
/** At most this many rounds (draws can stretch a fight), then whoever won more rounds wins. */
export const MAX_ROUNDS = 5;
/** After this many shots in one round, the archer with more health wins it (so a round always ends). */
export const MAX_SHOTS_PER_ROUND = 60;

// ——— The land (James, 21 Oct 2026: big jagged cliffs, deep narrow valleys) ———
/** Midpoint displacement: the first split moves the middle by up to this share of the field's height… */
export const LAND_START_ROUGHNESS = 0.65;
/** …and each later split by this share of the one before (a little over half keeps the edges jagged). */
export const LAND_ROUGHNESS_DECAY = 0.58;
/** The highest peak can reach this share of the field's height (measured from the bottom). */
export const LAND_MAX_HEIGHT = 0.75;
/** Land whose highest peak is lower than this share of the height is stretched up to LAND_MAX_HEIGHT. */
export const LAND_MIN_PEAK = 0.65;
/** The lowest valley floor stays at least this share of the height above the bottom. */
export const LAND_MIN_HEIGHT = 0.08;
/** The two ends start at a random height between these shares of the field's height. */
export const LAND_END_LOW = 0.2;
export const LAND_END_HIGH = 0.6;
/** The left archer stands somewhere in this share of the width, the right one mirrored. */
export const ARCHER_ZONE_FROM = 0.06;
export const ARCHER_ZONE_TO = 0.3;
/** The highest land between the two archers must be at least this many px above the higher one's feet. */
export const HILL_MIN_RISE = 40;
/** If the land fails the checks (archers can see each other, or no real hill), try the next seed, up to this many times. */
export const LAND_TRIES = 40;

// ——— The worlds (docs/ARCHERY-PLAN.md, section 3: each plays differently from the start) ———
/** Each world's wind runs from −n to +n (the wind stays the same all round). The Forest is calm, the Desert strong. */
export const WORLD_WIND_MAX: Readonly<Record<WorldId, number>> = { forest: 6, desert: 14, snow: 10, city: 10 };

/** How each world's land is made: the hilliness numbers above, except where a world changes them. */
export interface LandStyle {
  startRoughness: number;
  roughnessDecay: number;
  maxHeight: number;
  minPeak: number;
}
export const LAND_STYLE: Readonly<Record<WorldId, LandStyle>> = {
  forest: { startRoughness: LAND_START_ROUGHNESS, roughnessDecay: LAND_ROUGHNESS_DECAY, maxHeight: LAND_MAX_HEIGHT, minPeak: LAND_MIN_PEAK },
  // Dunes: a little smoother than rock, still big.
  desert: { startRoughness: LAND_START_ROUGHNESS, roughnessDecay: 0.52, maxHeight: LAND_MAX_HEIGHT, minPeak: LAND_MIN_PEAK },
  snow: { startRoughness: LAND_START_ROUGHNESS, roughnessDecay: LAND_ROUGHNESS_DECAY, maxHeight: LAND_MAX_HEIGHT, minPeak: LAND_MIN_PEAK },
  // The City's ground is lower and gentler: the buildings make its height.
  city: { startRoughness: 0.45, roughnessDecay: 0.5, maxHeight: 0.5, minPeak: 0.4 },
};

// Forest: trees stand on the land and stop arrows until they're blasted away.
/** How many trees a Forest round has. */
export const TREES_MIN = 5;
export const TREES_MAX = 8;
/** A tree's height and half its width, in cells (a tree 9 cells wide has half-width 4). */
export const TREE_HEIGHT_MIN = 12;
export const TREE_HEIGHT_MAX = 24;
export const TREE_HALF_MIN = 2;
export const TREE_HALF_MAX = 4;
/** Trees keep at least this many cells away from an archer's box. */
export const TREE_CLEARANCE = 6;
/** Trees are easy to blast away: a blast clears tree cells this many times further than dirt. */
export const TREE_BLAST_SCALE = 1.4;

// Desert: sand slides. After a blast, loose sand slumps sideways into slopes as well as falling.
/** Sand slides off a column that stands more than this many cells above its neighbour. */
export const SAND_MAX_STEP = 2;
/** Sand can slide this many columns either side of what a blast touched. */
export const SAND_REACH = 12;
/** At most this many cells of sand move after one shot (so a shot always finishes quickly). */
export const SAND_MAX_MOVES = 4000;

// Snow: slippery. An archer on a slope slides downhill, and ice blocks bounce an arrow once.
/** An archer slides at most this many cells in one go. */
export const SNOW_SLIDE_MAX = 40;
/** How many ice blocks a Snow round has, and their size in cells. */
export const ICE_BLOCKS_MIN = 3;
export const ICE_BLOCKS_MAX = 6;
export const ICE_W_MIN = 4;
export const ICE_W_MAX = 8;
export const ICE_H_MIN = 3;
export const ICE_H_MAX = 6;
/** Ice blocks keep at least this many cells away from an archer's box. */
export const ICE_CLEARANCE = 5;
/** An arrow keeps this share of its speed when it bounces off ice. */
export const ICE_BOUNCE = 0.6;

// City: buildings are tough blocks. A blast only chips them (James, 21 Oct 2026).
/** A blast clears building cells only this share of its radius from the middle. */
export const BUILDING_CHIP = 0.3;
/** Buildings' widths, the gaps between them (streets), and how tall they stand above the ground, in cells. */
export const BUILDING_W_MIN = 10;
export const BUILDING_W_MAX = 22;
export const BUILDING_GAP_MIN = 0;
export const BUILDING_GAP_MAX = 8;
export const BUILDING_H_MIN = 10;
export const BUILDING_H_MAX = 50;
/** Roughly this share of the street gets no building at all (an open lot). */
export const BUILDING_SKIP = 0.2;
/**
 * Buildings within this many cells of an archer are cut down to at most BUILDING_NEAR_RISE cells above the
 * archer's feet (a low wall to shelter behind), so an archer is never stuck at the bottom of a tall,
 * narrow street with no shot out (Stage 2's simulator found that on almost half the City lands).
 */
export const BUILDING_NEAR = 20;
export const BUILDING_NEAR_RISE = 3;

// ——— Stage 3: the Armory's arrows, shields, helpers and bows (docs/ARCHERY-PLAN.md, section 4) ———
/** An arrow that hits land this soon after leaving the bow (a buried archer digging out) never hurts its own archer. */
export const DIG_OUT_STEPS = 12;

// Arrow Rain: splits at the top of its flight into RAIN_PIECES arrows, spread sideways by this many px/s each.
export const RAIN_PIECES = 5;
export const RAIN_SPREAD = 28;

// Rolling Log: rolls along the land a column at a time; when it runs out of speed it rolls back into the dip. Its speed grows going downhill (a cell dropped adds
// one), shrinks by LOG_FRICTION a column and by a cell climbed; it can climb at most one cell a column.
export const LOG_START_SPEED = 4;
/** Each 40 px/s of the arrow's sideways speed when it lands adds 1 to the log's start speed. */
export const LOG_SPEED_FROM_FLIGHT = 40;
export const LOG_FRICTION = 0.25;
export const LOG_MAX_SPEED = 30;
export const LOG_MAX_COLS = 320;

// Mole Arrow: digs a tunnel this deep (px) and this wide (radius px) straight down from where it lands.
export const MOLE_DEPTH = 96;
export const MOLE_RADIUS = 7;

// Sneaky Mole: tunnels from where it lands toward the other archer (at most this far, px), then pops up under them.
export const SNEAKY_RANGE = 150;
export const SNEAKY_RADIUS = 5;
/** It pops up this many px below the target's feet. */
export const SNEAKY_UNDER = 4;

// Skipping Arrow: after landing it hops forward again, SKIP_HOPS times, with a blast each time, growing.
export const SKIP_BLASTS: readonly { r: number; peak: number }[] = [{ r: 16, peak: 14 }, { r: 20, peak: 18 }, { r: 26, peak: 24 }];
/** Each hop keeps this share of the sideways speed (at least SKIP_MIN_VX px/s) and leaves at this share of the fall speed (at least SKIP_MIN_UP). */
export const SKIP_KEEP_VX = 0.7;
export const SKIP_MIN_VX = 60;
export const SKIP_UP = 0.45;
export const SKIP_MIN_UP = 120;

// Sticky Goo: no crater. The goo runs downhill (at most GOO_RUN columns) and pools GOO_CELLS cells deep in the dip.
export const GOO_RUN = 60;
export const GOO_CELLS = 70;
/** A puddle rises at most this many rows, and is never wider than GOO_MAX_WIDTH columns (it stops before it spills over). */
export const GOO_MAX_RISE = 8;
export const GOO_MAX_WIDTH = 30;
/** On flat ground it spreads this many columns either side, a thin film. */
export const GOO_FLAT_HALF = 6;
/** Anyone standing in a puddle loses GOO_DAMAGE at the end of every shot, for GOO_SHOTS shots (two turns each). */
export const GOO_DAMAGE = 8;
export const GOO_SHOTS = 4;

// Earth Shaker: shakes the land SHAKER_REACH columns either side of where it lands. Cliffs crumble into
// slopes (any step over SHAKER_STEP cells slides, at most SHAKER_MOVES cells), and archers on a slope tumble down.
export const SHAKER_REACH = 45;
export const SHAKER_STEP = 1;
export const SHAKER_MOVES = 6000;

// Owl Arrow: while coming down, it steers toward an archer whose middle is within OWL_SENSE px, at OWL_PULL px/s².
export const OWL_SENSE = 90;
export const OWL_PULL = 3000;

// Firework Arrow: 5 pops around where it lands (offsets in px), one every FIREWORK_GAP steps.
export const FIREWORK_POPS: readonly [number, number][] = [[0, 0], [30, -14], [-30, -14], [18, 20], [-18, 20]];
export const FIREWORK_GAP = 14;

// Crossbow Bolt: straight and fast, no drop and no wind. It flies BOLT_RANGE_MIN + power × BOLT_RANGE_PER px,
// then pops. It cuts through dirt (a tunnel BOLT_CUT_RADIUS px wide), at most BOLT_CUT_MOST px of it.
export const BOLT_SPEED = 600;
export const BOLT_RANGE_MIN = 60;
export const BOLT_RANGE_PER = 3.2;
export const BOLT_CUT_RADIUS = 4.5;
export const BOLT_CUT_MOST = 90;

// The Glass Arrow (the pupil's own; James, 21 Oct 2026). Shards sting GLASS_STING at the end of the stabbed
// archer's next turn if they hit back; if they don't, they pop.
export const GLASS_STING = 12;

// Shields (they last the whole fight, then break). Wind Charm: an arrow coming down within CHARM_RANGE px (sideways) of the
// wearer is lifted (CHARM_LIFT px/s² against gravity) and pushed away (CHARM_PUSH px/s²) while the charm holds.
export const CHARM_RANGE = 70;
export const CHARM_LIFT = 350;
export const CHARM_PUSH = 250;
/** Bubble Shield: the first arrow each round that comes within BUBBLE_R px of the wearer's middle bounces off, keeping BUBBLE_KEEP of its speed. */
export const BUBBLE_R = 24;
export const BUBBLE_KEEP = 0.7;

// Helpers.
export const APPLE_HEALTH = 15;
