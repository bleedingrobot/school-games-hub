/**
 * Archery Challenge's hub points (docs/ARCHERY-PLAN.md, section 8), given by the server function through the hub's
 * add_game_points (inside the shared daily cap). The lines on How points work are in the migration's
 * archery_point_rules(): change both together.
 */

/** Finishing a fight against a bot, and winning it. */
export const FIGHT_POINTS = 2;
export const WIN_POINTS = 3;
/** A speed round with POINT_AT (speed.ts) or more right. */
export const ROUND_POINTS = 1;
