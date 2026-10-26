/**
 * Kingdom Keeper's rules (docs/KINGDOM-PLAN.md, section 2), as pure functions: the same city, decisions, boons and
 * random numbers always give the same next year. The server turns every year with these; the preview runs the same
 * functions in the browser.
 *
 * The rules are Hamurabi's, in its own order: each year the ruler buys or sells land, feeds the people and plants;
 * then the harvest comes in, rats may get into the granary, newcomers arrive, the people who weren't fed leave, and
 * sickness may come. Our own words and code, with gentler endings (nobody dies: people leave).
 */
import {
  ACRES_PER_BUSHEL, ACRES_PER_PERSON, BUILD_BOON, COUNCIL_SIZE, FOOD_PER_PERSON, HARD_TIMES, HARVEST_BOON, HARVEST_MOST,
  HUNGRY_LIMIT, MOST_TYPED, POINTS, PRICE_LOW, PRICE_SPREAD, RATINGS, SICKNESS_CHANCE, START, TRADE_BOON, YEARS,
} from './config';

/** The five advisers. Each asks one council question a year (three of them come each year); a right answer gives their boon. */
export const ADVISERS = ['reeve', 'ratcatcher', 'trader', 'healer', 'builder'] as const;
export type Adviser = (typeof ADVISERS)[number];

export type RatingId = (typeof RATINGS)[number]['id'] | typeof HARD_TIMES.id;

/** What the steward reports at the start of a year: what happened last year, and the city now. */
export interface YearReport {
  /** The year about to be ruled (1 to 10), or YEARS + 1 for the report after the last year. */
  year: number;
  /** People who went hungry and left last year. */
  hungry: number;
  newcomers: number;
  /** Did sickness come (half the people left until it passed)? */
  sickness: boolean;
  /** People who left because of the sickness. */
  sickLeft: number;
  harvestPerAcre: number;
  /** Bushels brought in. */
  harvested: number;
  ratsAte: number;
  /** The boons the council won last year, as they were used. */
  boons: Adviser[];
  /** Too many went hungry last year, for the first time: the people warned the ruler (next time the reign ends). */
  warning: boolean;
}

export interface City {
  /** The year being ruled now (1 to 10). After the last year it stays at 10 and `status` is 'done'. */
  year: number;
  people: number;
  grain: number;
  land: number;
  /** Bushels an acre of land costs this year (before the trader's boon). */
  price: number;
  report: YearReport;
  /** Each year's share of the people who went hungry, as a whole percent (for the rating). */
  hungryPct: number[];
  /** People who went hungry and left, over the whole reign. */
  hungryTotal: number;
  /** Have the people warned the ruler already? */
  warned: boolean;
  /** 'ended': more than 45% went hungry in a year for the second time (the people asked for a new ruler), or the city emptied. */
  status: 'playing' | 'done' | 'ended';
}

export interface Decisions {
  buy: number;
  sell: number;
  feed: number;
  plant: number;
}

export type Problem =
  | 'not-numbers'
  | 'buy-and-sell'
  | 'grain-for-land'
  | 'not-enough-land'
  | 'grain-for-food'
  | 'land-to-plant'
  | 'grain-for-seed'
  | 'people-to-plant'
  | 'over';

/** What each problem means, for the pupil. */
export const PROBLEM_TEXT: Record<Problem, string> = {
  'not-numbers': 'Those numbers need to be whole numbers, 0 or more.',
  'buy-and-sell': 'Buy land or sell land this year, not both.',
  'grain-for-land': "There isn't enough grain in the store to buy that much land.",
  'not-enough-land': "The city doesn't own that much land to sell.",
  'grain-for-food': "There isn't enough grain left to feed that much.",
  'land-to-plant': "The city doesn't own that many acres to plant.",
  'grain-for-seed': "There isn't enough grain left for that much seed.",
  'people-to-plant': "There aren't enough people to farm that many acres.",
  over: 'This reign is over.',
};

/** A random number from 0 up to (not including) 1. */
export type Random = () => number;

const whole = (random: Random, count: number) => Math.min(count - 1, Math.floor(random() * count));

/** This year's land price, before the trader's boon. */
export const rollPrice = (random: Random): number => PRICE_LOW + whole(random, PRICE_SPREAD);

/** The city at its first report. */
export function startCity(random: Random): City {
  return {
    year: 1,
    people: START.people + START.newcomers,
    grain: START.grain,
    land: START.land,
    price: rollPrice(random),
    report: {
      year: 1, hungry: 0, newcomers: START.newcomers, sickness: false, sickLeft: 0,
      harvestPerAcre: START.harvestPerAcre, harvested: START.harvestPerAcre * START.land, ratsAte: START.ratsAte, boons: [], warning: false,
    },
    hungryPct: [],
    hungryTotal: 0,
    warned: false,
    status: 'playing',
  };
}

/** The three advisers who come to this year's council, in the order they speak. Picked by the reign's own random numbers. */
export function councilFor(random: Random): Adviser[] {
  const left: Adviser[] = [...ADVISERS];
  const out: Adviser[] = [];
  while (out.length < COUNCIL_SIZE && left.length) out.push(left.splice(whole(random, left.length), 1)[0]);
  return out;
}

/** What an acre costs to buy, and gives when sold, this year with these boons. */
export function landPrices(city: City, boons: readonly Adviser[]): { buy: number; sell: number } {
  const trade = boons.includes('trader') ? TRADE_BOON : 0;
  return { buy: Math.max(1, city.price - trade), sell: city.price + trade };
}

/** Bushels of seed to plant this many acres (a part bushel counts as a whole one). */
export const seedFor = (acres: number) => Math.ceil(acres / ACRES_PER_BUSHEL);
/** People fed by this many bushels. */
export const fedBy = (bushels: number) => Math.floor(bushels / FOOD_PER_PERSON);

/** The sums the planner shows as the pupil decides. Every number the screen shows comes from here. */
export interface Plan {
  buyPrice: number;
  sellPrice: number;
  /** Grain paid for land (or got for it, as a negative number). */
  landCost: number;
  landAfter: number;
  /** Grain in the store after the land is bought or sold. */
  grainAfterLand: number;
  /** Bushels that would feed everyone. */
  feedEveryone: number;
  fed: number;
  hungry: number;
  grainAfterFood: number;
  seed: number;
  /** People needed to farm the planted acres. */
  farmers: number;
  /** The most acres that could be planted: by land, by people and by the grain left after food. */
  plantMost: number;
  grainAfterSeed: number;
}

export function plan(city: City, d: Decisions, boons: readonly Adviser[]): Plan {
  const prices = landPrices(city, boons);
  const landCost = d.buy * prices.buy - d.sell * prices.sell;
  const landAfter = city.land + d.buy - d.sell;
  const grainAfterLand = city.grain - landCost;
  const fed = Math.min(city.people, fedBy(d.feed));
  const grainAfterFood = grainAfterLand - d.feed;
  const seed = seedFor(d.plant);
  return {
    buyPrice: prices.buy,
    sellPrice: prices.sell,
    landCost,
    landAfter,
    grainAfterLand,
    feedEveryone: city.people * FOOD_PER_PERSON,
    fed,
    hungry: city.people - fed,
    grainAfterFood,
    seed,
    farmers: Math.ceil(d.plant / ACRES_PER_PERSON),
    plantMost: Math.max(0, Math.min(landAfter, city.people * ACRES_PER_PERSON, Math.max(0, grainAfterFood) * ACRES_PER_BUSHEL)),
    grainAfterSeed: grainAfterFood - seed,
  };
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MOST_TYPED;

/** Reads decisions sent from the browser (null if they aren't four whole numbers). */
export function readDecisions(value: unknown): Decisions | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return isCount(v.buy) && isCount(v.sell) && isCount(v.feed) && isCount(v.plant)
    ? { buy: v.buy, sell: v.sell, feed: v.feed, plant: v.plant }
    : null;
}

/** Null if the decisions can be carried out, or the first thing wrong with them, checked in Hamurabi's order. */
export function problemWith(city: City, d: Decisions, boons: readonly Adviser[]): Problem | null {
  if (city.status !== 'playing') return 'over';
  if (![d.buy, d.sell, d.feed, d.plant].every(isCount)) return 'not-numbers';
  if (d.buy > 0 && d.sell > 0) return 'buy-and-sell';
  const p = plan(city, d, boons);
  if (p.grainAfterLand < 0) return 'grain-for-land';
  if (d.sell > city.land) return 'not-enough-land';
  if (p.grainAfterFood < 0) return 'grain-for-food';
  if (d.plant > p.landAfter) return 'land-to-plant';
  if (p.grainAfterSeed < 0) return 'grain-for-seed';
  if (d.plant > city.people * ACRES_PER_PERSON) return 'people-to-plant';
  return null;
}

/**
 * Turns the year: the decisions are carried out, then the harvest, the rats, the newcomers, the hungry and the
 * sickness, each using the next random number in that order (so the server can turn the same year again and get
 * the same answer). `boons` are the advisers whose questions the server marked right this year.
 * The decisions must have passed `problemWith`.
 */
export function turnYear(city: City, d: Decisions, boons: readonly Adviser[], random: Random): City {
  const p = plan(city, d, boons);
  const used = ADVISERS.filter((a) => boons.includes(a));
  let grain = p.grainAfterSeed;
  const land = p.landAfter;

  const harvestPerAcre = 1 + whole(random, HARVEST_MOST) + (boons.includes('reeve') ? HARVEST_BOON : 0);
  const harvested = d.plant * harvestPerAcre;

  // Rats get in two years in five (Hamurabi: when a roll of 1 to 5 is even), eating a half or a quarter of the store.
  const ratRoll = 1 + whole(random, HARVEST_MOST);
  const ratsAte = ratRoll % 2 === 0 && !boons.includes('ratcatcher') ? Math.floor(grain / ratRoll) : 0;
  grain = grain - ratsAte + harvested;

  const comeRoll = 1 + whole(random, HARVEST_MOST);
  const newcomersBase = Math.floor((comeRoll * (FOOD_PER_PERSON * land + grain)) / city.people / 100 + 1);
  const newcomers = boons.includes('builder') ? Math.floor(newcomersBase * BUILD_BOON) : newcomersBase;

  const sicknessRoll = random();
  const price = rollPrice(random);

  const hungry = p.hungry;
  const hungryPct = [...city.hungryPct, Math.round((hungry * 100) / city.people)];
  const hungryTotal = city.hungryTotal + hungry;
  // The first time too many go hungry the people warn the ruler; the second time they ask for a new one.
  const tooHungry = hungry > HUNGRY_LIMIT * city.people;
  const warning = tooHungry && !city.warned;
  const asked = tooHungry && city.warned;

  let people = city.people - hungry + newcomers;
  const sickness = !asked && sicknessRoll < SICKNESS_CHANCE && !boons.includes('healer');
  const sickLeft = sickness ? people - Math.floor(people / 2) : 0;
  people -= sickLeft;

  const report: YearReport = { year: city.year + 1, hungry, newcomers, sickness, sickLeft, harvestPerAcre, harvested, ratsAte, boons: used, warning };
  const status: City['status'] = asked || people <= 0 ? 'ended' : city.year >= YEARS ? 'done' : 'playing';
  return {
    year: status === 'playing' ? city.year + 1 : city.year,
    people: Math.max(0, people),
    grain,
    land,
    price,
    report,
    hungryPct,
    hungryTotal,
    warned: city.warned || warning,
    status,
  };
}

/** The average share of people who went hungry each year, as a percent (0 if no year has turned). */
export function averageHungry(city: City): number {
  return city.hungryPct.length ? city.hungryPct.reduce((a, b) => a + b, 0) / city.hungryPct.length : 0;
}

/** How the reign is remembered. A reign that ended early is always Hard times. */
export function ratingOf(city: City): RatingId {
  if (city.status === 'ended') return HARD_TIMES.id;
  const hungry = averageHungry(city);
  return RATINGS.find((r) => hungry <= r.hungryAtMost && city.people >= r.peopleAtLeast)?.id ?? HARD_TIMES.id;
}

export const ratingName = (id: RatingId): string => RATINGS.find((r) => r.id === id)?.name ?? HARD_TIMES.name;

/** Points for a reign that is over (0 while it's still being played). */
export function pointsFor(city: City): number {
  if (city.status === 'playing') return 0;
  if (city.status === 'ended') return POINTS.early;
  const rating = ratingOf(city);
  return POINTS.finish + (rating === 'good' || rating === 'legendary' ? POINTS.good : 0) + (rating === 'legendary' ? POINTS.legendary : 0);
}

/** How big the city looks (the picture of it): a village, a town, a city or a great city. */
export function citySize(people: number): 1 | 2 | 3 | 4 {
  return people < 60 ? 1 : people < 120 ? 2 : people < 200 ? 3 : 4;
}
