/**
 * Every number in Royal Decree (docs/DECREE-PLAN.md), so the rules, How to play and the simulator read the same ones.
 */

/** The four things a ruler keeps an eye on. */
export const METERS = ['food', 'gold', 'happy', 'safe'] as const;
export type Meter = (typeof METERS)[number];

export const METER_NAME: Record<Meter, string> = { food: 'Food', gold: 'Gold', happy: 'Happiness', safe: 'Safety' };

/** Each meter runs 0 to METER_MOST. A meter reaching 0 ends the reign. */
export const METER_MOST = 10;
export const METER_START = 5;

/** Seasons in a year, and years in a full reign. A full reign is SEASONS × YEARS cards. */
export const SEASONS = 4;
export const YEARS = 6;
export const CARDS_IN_REIGN = SEASONS * YEARS;

/** Every RIDDLE_EVERY-th card (3rd, 6th, …) is a villager asking for help with a maths question. */
export const RIDDLE_EVERY = 3;
/** A right answer to a riddle adds this much to the villager's meter. A wrong or skipped one changes nothing. */
export const RIDDLE_BONUS = 2;

/** At the start of each new year, everyone has eaten through winter: food goes down by this much. */
export const WINTER_FOOD = 1;

/** The most a single choice may move a meter (the card tests check this). */
export const EFFECT_MOST = 3;

/** Points: 1 for any reign, +1 for each year lived through (beyond the first), +1 for a full reign; at most 5. */
export const POINTS = { played: 1, perYear: 1, yearsCounted: 3, full: 1 } as const;
/** Reigns a day that give points. */
export const POINT_REIGNS_PER_DAY = 5;
