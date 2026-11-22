/**
 * Every tuning number for Circuit Racer's physics, in one place (docs/CIRCUIT-PLAN.md, section 2).
 *
 * Units are plain: 1 lane = 1.0 wide, 1 row = 1.0 long, heights in the same units, time in seconds.
 * Speeds are per second and the physics turns them into per-step amounts itself.
 *
 * The physics only adds, subtracts, multiplies, divides and floors numbers. Those give the same
 * answers in every browser and on the server (no Math.sin and friends), so a run replays exactly.
 */

/** The physics always moves forward this many steps a second, whatever the screen is doing. */
export const STEPS_PER_SECOND = 30;
export const DT = 1 / STEPS_PER_SECOND;
/** Each step moves in this many small pieces, so nothing thin can be jumped through. */
export const SUBSTEPS = 4;

/** Lanes across a road. Lane 0 is on the left; the racer starts in the middle of lane 3. */
export const LANES = 7;
export const START_X = 3.5;
export const START_Z = 0.5;

/** How tall the blocks are: `1`, `2` and `3` in a road. */
export const BLOCK_HEIGHTS = { '1': 0.5, '2': 0.75, '3': 1.0 } as const;
/** A floor tile is a slab this thick (its top is at height 0). */
export const FLOOR_THICKNESS = 0.25;
/** A tunnel (data cable) has a roof this high, this thick: jump inside and you bump your head. */
export const TUNNEL_ROOF = 1.2;
export const TUNNEL_ROOF_THICKNESS = 0.2;

/** Forward speed, rows a second. */
export const TOP_SPEED = 12;
export const ACCEL = 7;
export const BRAKE = 10;
/** Below this speed braking is gentler (this share of BRAKE), so a racer never stalls by accident. */
export const LOW_SPEED = 2.5;
export const LOW_BRAKE_SHARE = 0.4;
/** Overclock tiles push the speed up, resistor tiles drag it down (rows a second, each second on them). */
export const OVERCLOCK_ACCEL = 16;
export const RESISTOR_DRAG = 16;

/**
 * Steering, lanes a second at top speed (OpenRoads' grip plus 20% for kids). Sideways speed grows with forward
 * speed, from TURN_AT_REST of it when stopped, so a stopped racer can still edge sideways.
 */
export const TURN_RATE = 3.6;
export const TURN_AT_REST = 0.4;
/** Steering works on the ground, and in the air only for this many steps after take-off. */
export const AIR_STEER_STEPS = 4;

/** Jump speed, units a second upwards. */
export const JUMP_SPEED = 6;
/** Gravity per world, units a second each second (world 1 a little lighter for longer hang time). */
export const GRAVITY = { motherboard: 16, graphics: 18, memory: 26, cloud: 11, quantum: 9 } as const;
export type World = keyof typeof GRAVITY;
/** At or above this gravity there is no jumping at all. */
export const NO_JUMP_GRAVITY = 40;
/** Falling never gets faster than this. */
export const MAX_FALL_SPEED = 14;

/** Hit a wall face faster than this and the racer explodes; slower is just a bonk (OpenRoads: a third, ours: a half). */
export const CRASH_SPEED = TOP_SPEED / 2;
/** Clip a block's corner and you are pushed sideways this far instead of stopping. */
export const WALL_NUDGE = 0.25;
/** Steering into a block's side costs this much speed each step you scrape it. */
export const SCRAPE_SLOW = 0.4;
/** Half the racer's width: it checks for floor this far either side, for the ledge slip. */
export const HALF_WIDTH = 0.3;
/** Half-over an edge, the racer slides off it, faster each second (lanes a second, each second). */
export const LEDGE_SLIP = 6;
/**
 * Bouncing on hard landings is OFF (James, 23 Nov 2026: "I don't really like the bounce after the jump, it feels strange"):
 * every landing sticks. With it on, landing faster than BOUNCE_MIN bounces back up at BOUNCE of the speed.
 */
export const BOUNCE_ON = false;
export const BOUNCE_MIN = 4.5;
export const BOUNCE = 0.5;
/** Below this height the racer has fallen off the road. */
export const FALL_LIMIT = -2;

/** Battery and signal run from FULL down to 0. */
export const FULL = 100;
/**
 * Battery drain by speed. A road's `battery` is how many seconds it lasts at top speed; slower driving drains it
 * by this mix of the speed share and its square, so a careful racer goes further on one charge.
 */
export const BATTERY_LINEAR = 0.25;
export const BATTERY_SQUARED = 0.75;
/** A road's `signal` is how many seconds it lasts; it drains with time whatever you do. */

/** Auto-Pilot: when a jump would miss, it tries changing steering, then speed, by these shares until it would land. */
export const AUTO_PILOT_TRIES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] as const;
/** It checks once a jump, when the upward speed has dropped to this share of the jump speed. */
export const AUTO_PILOT_AT = 0.4;
/** How far ahead it looks when checking a jump, in steps. */
export const AUTO_PILOT_LOOK = 90;

/** After a crash, a fall or running flat, the road restarts after this many steps (1.5 s). */
export const RESTART_DELAY_STEPS = Math.round(1.5 * STEPS_PER_SECOND);
/** The longest run the server will replay (10 minutes). */
export const MAX_RUN_STEPS = 10 * 60 * STEPS_PER_SECOND;
/** Inputs are recorded by distance: each row is cut into this many slots. */
export const SLOTS_PER_ROW = 8;
/** The most input changes a recorded run may have. */
export const MAX_INPUT_CHANGES = 6000;
