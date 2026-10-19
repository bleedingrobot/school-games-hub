/**
 * Every tuning number for Marble Rush's physics, in one place (docs/MARBLE-PLAN.md, section 4).
 *
 * The physics only ever adds, subtracts, multiplies, divides, takes a square root and floors a
 * number. Those give identical answers in every browser and on the server. `Math.sin` and friends
 * can differ slightly between Chrome and Safari, so nothing here (or in engine.ts) uses them.
 */

/** The physics always moves forward this many steps a second, whatever the screen is doing. */
export const STEPS_PER_SECOND = 60;
export const DT = 1 / STEPS_PER_SECOND;

/** How high one height level is, in tile widths. 0.5 means a slope that drops one level over one tile is a gentle hill. */
export const LEVEL = 0.5;

export const BALL_RADIUS = 0.3;

/** Gravity along a slope: a slope that drops `LEVEL` per tile pulls this much × LEVEL tiles/s². */
export const SLOPE_GRAVITY = 9;
/** Gravity pulling a marble down in the air, tiles/s². */
export const AIR_GRAVITY = 18;

/** How hard the player can push, tiles/s², and the speed limit. */
export const STEER = 9;
export const MAX_SPEED = 4.5;
/** The marble can climb or drop this much (in tiles) in one go without it counting as a wall or a cliff. */
export const STEP_UP = 0.3;
export const STEP_DOWN = 0.3;

/** Sticky and slippery floors. `steer` multiplies the push, `drag` is the share of speed lost each step, `max` the speed limit. */
export const SURFACES = {
  normal: { steer: 1, drag: 0.012, max: MAX_SPEED },
  ice: { steer: 0.3, drag: 0.0015, max: MAX_SPEED },
  mud: { steer: 1.3, drag: 0.06, max: 2.5 },
} as const;
export type Surface = keyof typeof SURFACES;

/** In the air the player can only nudge the marble. */
export const AIR_STEER = 0.3;
/** A bounce off a wall keeps this share of the speed. */
export const BOUNCE = 0.45;

/** Jump pads throw the marble up this fast, tiles/s. */
export const JUMP_SPEED = 7;
/** Landing harder than this (tiles/s downwards) is an "ouch": back to the checkpoint. */
export const OUCH_SPEED = 9;

/** Bumpers push the marble out of a circle this big, at this speed. */
export const BUMPER_RADIUS = 0.45;
export const BUMPER_SPEED = 3.5;

/** Falling off or an ouch: back onto the track near where it happened (see `SAFE_SPOT_AGE`), and the clock gains this much (James: about 3 seconds). */
export const FALL_PENALTY_STEPS = 3 * STEPS_PER_SECOND;
/**
 * After a fall the marble goes back to the last safe tile it was rolling on at least this long before (James, 20 Oct 2026:
 * "put you back on track near where you fell off", instead of the last checkpoint). A safe tile is flat, not ice, and not
 * anything that moves or pushes. Going back a little stops the marble being put right on the edge it just went over.
 */
export const SAFE_SPOT_AGE = 1 * STEPS_PER_SECOND;
/** How many recent safe tiles are remembered (more than enough to cover `SAFE_SPOT_AGE` at top speed). */
export const SAFE_SPOTS_KEPT = 16;
/** Tiles a marble is never put back on: gaps, walls, the finish, and anything timed, bouncy or pushing. */
export const UNSAFE_TILES = '.=fqtgjbewno';
/** A right pit-stop answer takes this much off the clock. */
export const PIT_BONUS_STEPS = 2 * STEPS_PER_SECOND;
/** Number gems: each right gem takes this much off the clock, up to `MAX_GEM_BONUSES` a run. */
export const GEM_BONUS_STEPS = 1 * STEPS_PER_SECOND;
export const MAX_GEM_BONUSES = 5;
/** The marble picks a gem up when it is this close to it (tiles). */
export const GEM_PICKUP_RADIUS = 0.5;
/** A fall asks a rescue question at most once in this many steps of play. */
export const RESCUE_GAP_STEPS = 20 * STEPS_PER_SECOND;
/** Below the lowest floor by this much, a falling marble is gone. */
export const KILL_BELOW = 1.5;

/** Hard mode: each new checkpoint adds this much time. */
export const CHECKPOINT_BONUS_STEPS = 5 * STEPS_PER_SECOND;
/** A run that takes longer than this (count-up) is stopped. */
export const MAX_RUN_STEPS = 5 * 60 * STEPS_PER_SECOND;

/** Conveyor belts push a marble along at this rate, tiles/s². */
export const CONVEYOR_PUSH = 6;

/**
 * Timed hazards. Everything is worked out from the step number, so the same run always meets the same hazard
 * at the same moment (no randomness, nothing to remember). Times are in steps (60 a second).
 */
export const TIMED = {
  /** A geyser puffs every `period` steps; for the first `warn` it only steams (a warning), then for `active` it throws the marble up. */
  geyser: { period: 180, warn: 15, active: 30, boost: 1.2 },
  /** A trapdoor is solid for `solid` steps out of every `period`, then drops away. It flickers for the last `warn` steps before. */
  trapdoor: { period: 240, solid: 170, warn: 25 },
  /** A gate (a sweeping arm) is open for `open` steps out of every `period`, then shuts. */
  gate: { period: 210, open: 120, warn: 25 },
} as const;
