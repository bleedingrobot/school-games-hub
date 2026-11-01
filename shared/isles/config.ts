/**
 * Every number in Sky Isles (docs/ISLES-PLAN.md, docs/ISLES-RULES.md), so the rules, How to play and the simulator all
 * read the same ones. An original game: none of these come from Immortal Barons or Barren Realms Elite. Tuned with
 * `npm run isles:sim`.
 */

/** The six kinds of plot, plus an empty plot waiting to be built on. */
export const PLOT_KINDS = ['farm', 'mine', 'dock', 'house', 'workshop', 'library'] as const;
export type PlotKind = (typeof PLOT_KINDS)[number];
export type PlotOrEmpty = PlotKind | 'empty';

export type TaxLevel = 'low' | 'fair' | 'high';

/** A new island at the start of a season. */
export const START = {
  plots: { farm: 2, mine: 1, dock: 1, house: 2, workshop: 1, library: 0, empty: 1 },
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
/** People a House holds, and people any other plot holds (a few live on every plot). */
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

/** Food that keeps: STORE_BASE plus STORE_PER_FARM for each Farm (doubled by Cool Cellars). Over that, SPOIL goes off a turn. */
export const STORE_BASE = 40;
export const STORE_PER_FARM = 20;
export const SPOIL = 0.1;

// --- Spend -----------------------------------------------------------------------------------------------------------

/** Chunks of land the wind brings past each island in a day. */
export const DRIFT_PER_DAY = 3;
/** A chunk costs CHUNK_BASE + CHUNK_PER_PLOT for every plot the island already has. */
export const CHUNK_BASE = 0;
export const CHUNK_PER_PLOT = 22;
/** Building (or changing) a plot. */
export const BUILD_COINS: Record<PlotKind, number> = { farm: 25, mine: 30, dock: 30, house: 25, workshop: 35, library: 50 };

/** The class market's normal prices (the server moves them a little). Buying costs MARKET_BUY_EXTRA more. */
export const MARKET_PRICE = { food: 2, goods: 6 } as const;
export const MARKET_BUY_EXTRA = 1.5;

// --- Upgrades (ideas from Libraries) ---------------------------------------------------------------------------------

export const UPGRADES = [
  { id: 'ploughs', name: 'Better Ploughs', ideas: 4 },
  { id: 'cellars', name: 'Cool Cellars', ideas: 4 },
  { id: 'tall-houses', name: 'Tall Houses', ideas: 6 },
  { id: 'bright-docks', name: 'Bright Docks', ideas: 6 },
  { id: 'wind-wall', name: 'Wind Wall', ideas: 6 },
  { id: 'swift-sails', name: 'Swift Sails', ideas: 8 },
  { id: 'sky-bridge', name: 'Sky Bridge', ideas: 8 },
  { id: 'star-map', name: 'Star Map', ideas: 10 },
] as const;
export type UpgradeId = (typeof UPGRADES)[number]['id'];
/** Better Ploughs, Tall Houses and Bright Docks multiply Farm food, House room and Dock coins by this. */
export const UPGRADE_BOOST = 1.5;

// --- The big goal ----------------------------------------------------------------------------------------------------

/** Plots for Grand Isle. */
export const GRAND_ISLE = 40;
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

// --- Sky Races (the rules for a race itself come in stage S.1) ------------------------------------------------------

/** Races an island may start in a day, and how many of the wins in a day bring a prize chunk (the rest bring coins). */
export const RACES_PER_DAY = 2;
export const PRIZE_CHUNKS_PER_DAY = 1;

// --- Small islands catch up ------------------------------------------------------------------------------------------

/** An island under this share of its class's middle size gets one extra chunk in its drift. */
export const SMALL_ISLAND = 0.5;
