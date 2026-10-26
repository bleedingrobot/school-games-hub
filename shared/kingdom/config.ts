/**
 * Every number in Kingdom Keeper (docs/KINGDOM-PLAN.md, section 2), so the rules, How to play and the simulator all
 * read the same ones. The starting city and the rules are Hamurabi's (Doug Dyment 1968, David Ahl 1973; public domain).
 */

/** Years in a reign. */
export const YEARS = 10;

/** Riverstone at the first report: 95 people plus 5 who came, 2,800 bushels, 1,000 acres, a harvest of 3 an acre, rats ate 200. */
export const START = { people: 95, newcomers: 5, grain: 2800, land: 1000, harvestPerAcre: 3, ratsAte: 200 } as const;

/** Bushels one person eats in a year. */
export const FOOD_PER_PERSON = 20;
/** Acres one bushel of seed plants. */
export const ACRES_PER_BUSHEL = 2;
/** Acres one person can farm. */
export const ACRES_PER_PERSON = 10;

/** Land costs PRICE_LOW to PRICE_LOW + PRICE_SPREAD - 1 bushels an acre (17 to 26). */
export const PRICE_LOW = 17;
export const PRICE_SPREAD = 10;
/** A harvest is 1 to HARVEST_MOST bushels an acre. */
export const HARVEST_MOST = 5;
/** Chance of sickness in a year. Half the people leave until it passes. */
export const SICKNESS_CHANCE = 0.15;
/** More than this share of the people going hungry in one year brings a warning; the second time it ends the reign. */
export const HUNGRY_LIMIT = 0.45;

/** Council questions a year, each asked by a different adviser. */
export const COUNCIL_SIZE = 3;
/** The reeve's boon: bushels an acre added to the harvest. */
export const HARVEST_BOON = 1;
/** The trader's boon: bushels an acre off when buying land, and on when selling. */
export const TRADE_BOON = 2;
/** The builder's boon: newcomers are multiplied by this. */
export const BUILD_BOON = 1.5;

/** The most a pupil may type for one decision (it stops silly numbers reaching the server). */
export const MOST_TYPED = 1_000_000;

/**
 * The end-of-reign rating, from the average share of people who went hungry each year (as a percent, Hamurabi's own
 * thresholds) and the people in the city at the end. Hamurabi used acres a person instead, but then every council boon
 * that grows the city (fewer leave to sickness, more newcomers) made the rating worse: the simulator showed more right
 * answers giving fewer Legendary reigns. The first rating whose two tests both pass is given.
 */
export const RATINGS = [
  { id: 'legendary', name: 'Legendary ruler', hungryAtMost: 3, peopleAtLeast: 150 },
  { id: 'good', name: 'Good ruler', hungryAtMost: 10, peopleAtLeast: 100 },
  { id: 'fair', name: 'Fair ruler', hungryAtMost: 33, peopleAtLeast: 60 },
] as const;
export const HARD_TIMES = { id: 'hard', name: 'Hard times' } as const;

/** Points: finishing a reign, the extra for a Good (or better) and a Legendary reign, and a reign that ended early. */
export const POINTS = { finish: 3, good: 1, legendary: 1, early: 1 } as const;
/** Reigns a day that give points. */
export const POINT_REIGNS_PER_DAY = 3;

/** A people count at the end of a reign that earns the Great city achievement (kept in the migration too). */
export const GREAT_CITY = 200;
