/**
 * Every tuning number for Toon Flap, in one place (docs/TOON-FLAP-PLAN.md, sections 1, 2 and 5a).
 *
 * The physics only adds, subtracts, multiplies and divides, so it gives identical answers in every browser and on the
 * server (no Math.sin: moving walls use a smoothed triangle wave). Distances are in "units": the sky is `SKY` units tall,
 * from the ground (0) to the top (SKY). Speeds are units a second, accelerations units a second squared.
 */

/** The physics always moves forward this many steps a second, whatever the screen is doing. */
export const STEPS_PER_SECOND = 60;
export const DT = 1 / STEPS_PER_SECOND;

/** Height of the sky, ground to top. The screen shows all of it. */
export const SKY = 10;
/** How much of the course shows ahead of the bird, so the screen can be any width. */
export const VIEW_AHEAD = 12;
/** The bird's hit box: a square this big. Every flyer uses it, whatever its picture (plan section 5a). */
export const BIRD_SIZE = 0.6;
export const BIRD_HALF = BIRD_SIZE / 2;
/** How wide a wall is. */
export const WALL_WIDTH = 1.3;
/** Where the course starts and the bird first hovers. */
export const START_X = 2;
export const START_Y = SKY / 2;
/** Distance from the start to the first wall, in seconds of flying. */
export const LEAD_IN_SECONDS = 2.2;
/** Distance from the last wall to the nest. */
export const NEST_AFTER = 4;

/** A bump costs this much time (plan: +3 s), and the bird hovers again just before the wall it hit. */
export const BUMP_PENALTY_STEPS = 3 * STEPS_PER_SECOND;
/** After a bump the bird comes back this far in front of the wall it hit (a share of the gap to the wall before). */
export const RESPAWN_BACK = 0.55;
/** …and this far below the middle of the opening, since the flap that sets off lifts it. */
export const RESPAWN_LOW = 0.45;
/** A right check takes this much off. */
export const CHECK_BONUS_STEPS = 3 * STEPS_PER_SECOND;
/** Flying through the right answer gap: a tailwind, this much off. */
export const TAILWIND_STEPS = 2 * STEPS_PER_SECOND;
/** The answer sign shows this long before its wall. */
export const SIGN_SECONDS = 4;
/** Read time (on by default for levels 3 to 5): the game waits for Go at the sign, up to this long. */
export const READ_TIME_MAX_SECONDS = 10;
export const READ_TIME_LEVELS: readonly number[] = [3, 4, 5];
/** A run longer than this (flying steps) is stopped: nobody needs 5 minutes for one level. */
export const MAX_RUN_STEPS = 5 * 60 * STEPS_PER_SECOND;

/** Gentle wings (per pupil, any level): slower, slightly bigger gaps. Finishing counts; gold needs normal wings. */
export const GENTLE_SPEED = 0.8;
export const GENTLE_GAP = 1.15;

/** Flying feel at each speed. "Floaty" early: less gravity and a softer lift. */
export const WINGS = {
  slow: { speed: 3, gravity: 15, lift: 5.4, maxFall: 7 },
  medium: { speed: 3.5, gravity: 17, lift: 5.8, maxFall: 7.5 },
  'medium-fast': { speed: 3.9, gravity: 18.5, lift: 6.1, maxFall: 8 },
  fast: { speed: 4.3, gravity: 20, lift: 6.4, maxFall: 8.5 },
} as const;
export type Pace = keyof typeof WINGS;

/** Bubble Reef's underwater flaps: gentler gravity and fall. */
export const UNDERWATER = { gravity: 0.7, lift: 0.8, maxFall: 0.7 };

/** Answer walls: 2 or 3 gaps spread up the sky, each this tall at least. */
export const ANSWER_GAP_MIN = { 2: 2.6, 3: 2.2 } as const;

/**
 * Flyers: finish a level this many times (any medal) to unlock its flyer. More on the easy levels, so flyers take a
 * while (James, 11 Nov 2026: 15 on easy levels, 10 on harder ones).
 */
export const UNLOCK_RUNS = { easy: 15, hard: 10 } as const;
/** Levels up to this one count as easy for unlocking. */
export const EASY_LEVELS = 5;
/** Revive potions (rare, about one a week; the sim checks): earned for this many checks right in a row (the run of right answers carries on between levels, since no level has 5 checks) or a first gold on a level. */
export const POTION_STREAK = 10;
export const POTIONS_MAX = 3;
/** At most this many potions in one run (each cancels one bump). */
export const POTIONS_PER_RUN = 1;
/** Sky Dash (the one-touch mode, stage F.7) opens after this level. */
export const SKY_DASH_AFTER = 5;

/** Points (plan section 5): only the first runs of a day earn points; a break is suggested after many runs. */
export const POINTS = { finish: 2, firstFinish: 5, newGold: 3 } as const;
export const POINT_RUNS_A_DAY = 10;
export const BREAK_AFTER_RUNS = 30;

/** Medal times: how many bumps silver allows (each bump is 3 s plus flying back), on top of a perfect run. */
export const SILVER_BUMPS = 2;
/** Silver also allows this many wrong checks or gaps. */
export const SILVER_MISSES = 1;
