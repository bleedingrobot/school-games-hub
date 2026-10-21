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
/** The wind is a whole number from −WIND_MAX to +WIND_MAX, new each round. */
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
