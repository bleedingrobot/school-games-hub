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
/** Finishing a fight against a classmate, and winning it (the server played every shot). Nobody gets these if
 * someone leaves or the timer ends it (James, 22 Oct 2026). */
export const DUEL_POINTS = 3;
export const DUEL_WIN_POINTS = 4;
