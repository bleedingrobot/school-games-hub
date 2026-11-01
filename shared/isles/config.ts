/**
 * Every number in Sky Isles (docs/ISLES-PLAN.md, docs/ISLES-RULES.md), so the rules, How to play and the simulator all
 * read the same ones. An original game: none of these come from Immortal Barons or Barren Realms Elite. Tuned with
 * `npm run isles:sim`.
 */

/** The six kinds of building, plus an empty spot waiting to be built on. Each building has levels 1 to MAX_LEVEL. */
export const PLOT_KINDS = ['farm', 'mine', 'dock', 'house', 'workshop', 'library'] as const;
export type PlotKind = (typeof PLOT_KINDS)[number];
export type PlotOrEmpty = PlotKind | 'empty';

export type TaxLevel = 'low' | 'fair' | 'high';

/** A new island at the start of a season: its building spots, in the order they were claimed (the art draws them in
 * that order on the base's clearings), every building at level 1. */
export const START = {
  spots: ['farm', 'house', 'mine', 'farm', 'dock', 'empty'] as PlotOrEmpty[],
  coins: 150,
  food: 60,
  people: 30,
  happiness: 70,
  boats: 2,
  goods: 0,
  tax: 'fair' as TaxLevel,
  /** Share of the workshops' work that goes to sky-boats (the rest makes goods), in steps of 25. */
  boatShare: 50,
} as const;

/** Turns a day, and how many unused turns can pile up (today's plus two missed days). */
export const TURNS_PER_DAY = 6;
export const MOST_TURNS_SAVED = 18;

// --- Collect, each turn ---------------------------------------------------------------------------------------------

// Every amount below is for a level 1 building; a level 2 building makes twice as much and a level 3 three times.

/** Food one Farm grows. */
export const FARM_FOOD = 10;
/** Coins one Mine digs (always the same). */
export const MINE_COINS = 6;
/** Coins one Dock earns: DOCK_LOW at no happiness up to DOCK_LOW + DOCK_HAPPY at full happiness. */
export const DOCK_LOW = 2;
export const DOCK_HAPPY = 10;
/** People it takes to pay one coin of tax, at each level. */
export const PEOPLE_PER_TAX_COIN: Record<TaxLevel, number> = { low: 3, fair: 2, high: 1.5 };
/** Work one Workshop does. A sky-boat takes BOAT_WORK; one goods takes GOODS_WORK. */
export const WORKSHOP_WORK = 10;
export const BOAT_WORK = 30;
export const GOODS_WORK = 10;
/** Ideas one Library thinks of each turn. */
export const LIBRARY_IDEAS = 0.5;
/** A right answer to the sky pilot's question: everything collected this turn is multiplied by this. */
export const FAIR_WIND = 1.15;

// --- Feed and people -------------------------------------------------------------------------------------------------

/** Food one person eats a turn. */
export const FOOD_PER_PERSON = 0.5;
/** People a House holds, and people any other spot holds (a few live by every building). */
export const HOUSE_ROOM = 30;
export const OTHER_ROOM = 2;
/** Each turn people move this share of the way to the room there is, scaled by happiness (see engine). */
export const ARRIVE_SHARE = 0.15;
/** High tax: newcomers are multiplied by this. */
export const HIGH_TAX_ARRIVALS = 0.5;
/** People over the room there is: this share leave each turn. */
export const CROWDED_LEAVE = 0.1;
/** Happiness below this: this share of the people leave each turn. */
export const UNHAPPY_BELOW = 30;
export const UNHAPPY_LEAVE = 0.05;
/** Not enough food: this share of the hungry people leave to stay with a neighbour. */
export const HUNGRY_LEAVE = 0.5;

// --- Happiness (0 to 100) --------------------------------------------------------------------------------------------

/** Happiness moves this share of the way to the tax level's resting point each turn. */
export const HAPPY_REST: Record<TaxLevel, number> = { low: 90, fair: 70, high: 40 };
export const HAPPY_DRIFT = 0.2;
/** A turn without enough food. */
export const HUNGRY_HAPPINESS = -12;
/** A festival: coins, once a day. */
export const FESTIVAL_HAPPINESS = 15;
export const FESTIVAL_COINS = 40;

// --- Food store ------------------------------------------------------------------------------------------------------

/** Food that keeps: STORE_BASE plus STORE_PER_FARM for each Farm level (doubled by Cool Cellars). Over that, SPOIL goes off a turn. */
export const STORE_BASE = 40;
export const STORE_PER_FARM = 20;
export const SPOIL = 0.1;

// --- Spend -----------------------------------------------------------------------------------------------------------

/** Chunks of land the wind brings past each island in a day (each is one new building spot), and how many can wait. */
export const DRIFT_PER_DAY = 1;
export const MOST_DRIFT_SAVED = 3;
/** A chunk costs CHUNK_BASE + CHUNK_PER_SPOT for every spot the island already has. */
export const CHUNK_BASE = 0;
export const CHUNK_PER_SPOT = 85;
/** Building on a spot (or changing what's there, which starts again at level 1). */
export const BUILD_COINS: Record<PlotKind, number> = { farm: 25, mine: 30, dock: 30, house: 25, workshop: 35, library: 50 };
/** The top level, and what raising a building to each level costs: the build price times LEVEL_TIMES, plus goods. */
export const MAX_LEVEL = 3;
export const LEVEL_TIMES: Record<number, number> = { 2: 4, 3: 9 };
export const LEVEL_GOODS: Record<number, number> = { 2: 0, 3: 6 };

/** The class market's normal prices (the server moves them a little). Buying costs MARKET_BUY_EXTRA more. */
export const MARKET_PRICE = { food: 2, goods: 6 } as const;
export const MARKET_BUY_EXTRA = 1.5;

// --- Upgrades (ideas from Libraries) ---------------------------------------------------------------------------------

/** `does` is what it does, in words a 9-year-old reads easily (Pip's next step and the Upgrades screen use it). */
export const UPGRADES = [
  { id: 'ploughs', name: 'Better Ploughs', ideas: 4, does: 'Farms grow more food' },
  { id: 'cellars', name: 'Cool Cellars', ideas: 4, does: 'food keeps longer' },
  { id: 'bunk-beds', name: 'Bunk Beds', ideas: 6, does: 'Houses hold more people' },
  { id: 'lanterns', name: 'Welcome Lanterns', ideas: 6, does: 'Docks earn more coins' },
  { id: 'wind-wall', name: 'Wind Wall', ideas: 6, does: 'storms blow no food away' },
  { id: 'swift-sails', name: 'Swift Sails', ideas: 8, does: 'your sky-boats race faster' },
  { id: 'sky-bridge', name: 'Sky Bridge', ideas: 8, does: 'friendship ropes help twice as much' },
  { id: 'star-map', name: 'Star Map', ideas: 10, does: 'one more chunk of land drifts by each day' },
] as const;
export type UpgradeId = (typeof UPGRADES)[number]['id'];
/** Better Ploughs, Bunk Beds and Welcome Lanterns multiply Farm food, House room and Dock coins by this. */
export const UPGRADE_BOOST = 1.5;

// --- The big goal ----------------------------------------------------------------------------------------------------

/** Building spots for Grand Isle. */
export const GRAND_ISLE = 16;
/** The five island bases the art draws, and the most spots each holds (Little, Growing, Big, Large, Grand). */
export const BASES = [6, 8, 10, 13, 16] as const;
/** The Sky Lighthouse's four stages, each paid in coins and goods once the island is a Grand Isle. */
export const LIGHTHOUSE = [
  { coins: 600, goods: 10 },
  { coins: 750, goods: 15 },
  { coins: 900, goods: 20 },
  { coins: 1100, goods: 25 },
] as const;

// --- Weather (about one turn in 8) -----------------------------------------------------------------------------------

export const WEATHER_CHANCE = 1 / 8;
export const WEATHER = ['rainbow', 'geese', 'fog', 'storm', 'breeze', 'traveller'] as const;
export type Weather = (typeof WEATHER)[number];
/** Rainbow: food. Golden geese: coins. Storm: share of the food blown away. Warm breeze: happiness. Traveller: people. */
export const RAINBOW_FOOD = 15;
export const GEESE_COINS = 25;
export const STORM_FOOD = 0.1;
export const BREEZE_HAPPINESS = 10;
export const TRAVELLER_PEOPLE = 3;

// --- Sky Races -------------------------------------------------------------------------------------------------------

/** Races an island may start in a day (one a turn). The day's first win brings coins and goods (goods help raise
 * buildings to level 3); a later win brings coins. The other side gets a small "well raced" gift, win or lose. */
export const RACES_PER_DAY = 2;
export const FIRST_WIN_PRIZE = { coins: 30, goods: 5 } as const;
export const LATER_WIN_PRIZE = { coins: 15, goods: 0 } as const;
export const WELL_RACED_COINS = 5;
/** An island can be challenged by classmates this many times a day (the Gull Riders don't count). */
export const MOST_CHALLENGED = 3;
/** The calm start: an island that has played fewer turns than this can't be challenged by classmates. */
export const CALM_TURNS = 12;
/** Questions in a race; each right answer is one gust. */
export const RACE_QUESTIONS = 3;

/**
 * A boat's speed is RACE_BASE plus its sky-boats, Swift Sails, happiness, gusts and luck. Sky-boats count as
 * BOAT_SPEED × the square root of the boats (up to MOST_BOATS), so a big fleet helps less and less and a small island
 * with its questions right can still win.
 */
export const RACE_BASE = 30;
export const BOAT_SPEED = 3;
export const MOST_BOATS = 16;
export const SAILS_SPEED = 3;
/** Speed at full happiness (scaled down with happiness). */
export const HAPPY_SPEED = 4;
/** One right answer. */
export const GUST_SPEED = 5;
/** The side that wasn't asked questions (an island at home, or the Gull Riders) gets this much wind instead: one
 * gust's worth. Against an even match, no right answers wins about 1 race in 6 (James, 2 Nov 2026), one wins half,
 * two about 5 in 6, and three nearly always. */
export const HOME_WIND = 5;
/** Luck: each side adds a random amount from 0 up to this. */
export const RACE_LUCK = 12;
/** The race animation is this many legs long. */
export const RACE_LEGS = 8;
/** The Gull Riders' happiness. Their boats and sails match the challenger's, so a race against them is decided by the
 * gusts and a little luck. */
export const GULL_HAPPINESS = 70;
/** The first race (turn 2's guide): the Gull Riders finish this share of the way behind, from STARTER_LOW up to
 * STARTER_LOW + STARTER_SPREAD of the pupil's speed, so it is close but can't be lost. */
export const STARTER_LOW = 0.86;
export const STARTER_SPREAD = 0.1;

// --- Small islands catch up ------------------------------------------------------------------------------------------

/** An island under this share of its class's middle size gets one extra chunk in its drift. */
export const SMALL_ISLAND = 0.7;
