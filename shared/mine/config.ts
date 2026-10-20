/**
 * Every tuning number for Mine Runner's rules, in one place (docs/MINE-PLAN.md, section 4).
 *
 * The rules only ever add, subtract, multiply, divide, take a square root and floor a number.
 * Those give identical answers in every browser and on the server. `Math.sin` and friends can
 * differ slightly between Chrome and Safari, so nothing in this folder uses them.
 *
 * James asked for the shooting to be "classic but tougher" (20 Oct 2026): the rebuild costs
 * 20 seconds, robots hit hard and shoot back often. Retune here.
 */

/** The rules always move forward this many steps a second, whatever the screen is doing. */
export const STEPS_PER_SECOND = 30;
export const DT = 1 / STEPS_PER_SECOND;
/** The longest run a replay accepts (15 minutes), so a server can't be made to work for ever. */
export const MAX_RUN_STEPS = STEPS_PER_SECOND * 60 * 15;

/** Size of one block of the mine, in world units. The mine is a grid of these. */
export const CELL = 1;
/** Rooms sit on a coarse grid this many blocks apart. */
export const ROOM_SPACING = 18;
/** Tunnels are this many blocks across (odd, so they have a middle). */
export const TUNNEL_WIDTH = 5;
/** A room is 7 or 9 blocks across each way (half of it, not counting the middle block). */
export const ROOM_HALF_SIZES = [3, 4] as const;

// ——— The ship ———
export const SHIP_RADIUS = 0.45;
/** How hard the pilot can push, units/s². */
export const ACCEL = 24;
/** The share of speed lost each step. Top speed is about ACCEL × DT ÷ DRAG = 10 units/s. */
export const DRAG = 0.08;
export const MAX_SPEED = 10;
/** Each unit of turn input turns the ship by this many radians a step. Inputs go from −TURN_MAX to TURN_MAX. */
export const TURN_UNIT = 0.012;
export const TURN_MAX = 6;
export const ROLL_UNIT = 0.03;
/** In steady flight the ship can look up or down this far (the vertical part of "forward") before it stops. */
export const STEADY_PITCH_LIMIT = 0.97;

export const MAX_SHIELD = 100;
export const MAX_ENERGY = 100;
export const START_MISSILES = 4;
export const MAX_MISSILES = 12;

// ——— The ship's weapons ———
export const LASER_COST = 4;
export const LASER_COOLDOWN = 4;
export const LASER_SPEED = 40 * DT;
export const LASER_DAMAGE = 8;
export const LASER_LIFE = 40;
export const ENERGY_REGEN = 0.3;
export const MISSILE_COOLDOWN = 20;
export const MISSILE_SPEED = 18 * DT;
export const MISSILE_DAMAGE = 50;
export const MISSILE_SPLASH = 2.5;
export const MISSILE_LIFE = 90;
/** A projectile moves in this many small steps, so a fast one can't skip over a thin wall or a robot. */
export const PROJECTILE_SUBSTEPS = 3;

// ——— Robots ———
export type RobotType = 'drone' | 'hunter' | 'turret' | 'brute';
export interface RobotSpec {
  hp: number;
  /** Units a second. */
  speed: number;
  radius: number;
  /** Damage a shot does to the ship's shield. */
  damage: number;
  /** Steps between shots. */
  cooldown: number;
  /** It only sees, and shoots at, the ship this close. */
  sight: number;
  /** Chasers stop this close, so they hover and shoot instead of ramming. */
  keepAway: number;
  /** How far a shot can miss by, as a share of the distance. */
  spread: number;
  shotSpeed: number;
}
export const ROBOTS: Record<RobotType, RobotSpec> = {
  drone: { hp: 24, speed: 3.2, radius: 0.6, damage: 9, cooldown: 36, sight: 18, keepAway: 5, spread: 0.12, shotSpeed: 14 * DT },
  hunter: { hp: 48, speed: 5.2, radius: 0.7, damage: 13, cooldown: 26, sight: 22, keepAway: 6, spread: 0.08, shotSpeed: 18 * DT },
  turret: { hp: 70, speed: 0, radius: 0.8, damage: 15, cooldown: 22, sight: 24, keepAway: 0, spread: 0.06, shotSpeed: 20 * DT },
  /** A slow, heavy digger: lots of armour, a hard hit, a slow shot. Best dealt with from a distance. */
  brute: { hp: 110, speed: 2.4, radius: 1, damage: 22, cooldown: 50, sight: 20, keepAway: 7, spread: 0.1, shotSpeed: 12 * DT },
};
export const ROBOT_TYPES: readonly RobotType[] = ['drone', 'hunter', 'turret', 'brute'];
/** How often (in steps) a robot looks for the ship. Robots take turns, so they don't all look at once. */
export const SIGHT_EVERY = 5;
/** A robot that has lost sight of the ship for this many steps goes back to sleep. */
export const LOSE_SIGHT_STEPS = 90;
export const ROBOT_SHOT_LIFE = 80;
/** After a rebuild, robots this close to the ship's new spot go back to sleep. */
export const CALM_RADIUS = 12;

// ——— Reactor, exit, doors, pickups ———
export const REACTOR_HP = 160;
export const REACTOR_RADIUS = 1.2;
export const EXIT_RADIUS = 2.5;
/** The escape timer: the way back at this speed (units a second), times the level's factor, plus a little extra. */
export const ESCAPE_SPEED = 6;
export const ESCAPE_EXTRA_SECONDS = 20;
/** A key door opens by itself when the ship has its key and is this close. */
export const KEY_DOOR_RANGE = 3;
/** A question door or power-up pad can be used from this close (a right answer sends a GRANT). */
export const USE_RANGE = 5;
export const PICKUP_RADIUS = 1.4;
export const KEY_RADIUS = 1.4;
export const SHIELD_PICKUP = 30;
export const ENERGY_PICKUP = 40;
export const MISSILE_PICKUP = 3;
/** A power-up pad, answered right: its refill, and a little off the clock (at most MAX_PAD_BONUSES a run). */
export const PAD_SHIELD = 100;
export const PAD_ENERGY = 100;
export const PAD_MISSILES = 6;
export const PAD_BONUS_STEPS = 5 * STEPS_PER_SECOND;
export const MAX_PAD_BONUSES = 3;

// ——— Mistakes ———
/** Shield lost and time added for a wrong answer at a question door (James, 20 Oct 2026). The shield never goes below 1 this way. */
export const WRONG_ANSWER_DAMAGE = 20;
export const WRONG_ANSWER_STEPS = 6 * STEPS_PER_SECOND;
/** A wrecked ship is rebuilt in the last room it entered, with this added to the clock and this much shield. */
export const REBUILD_PENALTY_STEPS = 20 * STEPS_PER_SECOND;
export const REBUILD_SHIELD = 70;

/** The most doors and pads a level may have (a GRANT input names one by number). */
export const MAX_TARGETS = 64;
