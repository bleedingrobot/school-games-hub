/**
 * Every number in Sky Isles (docs/ISLES-COSY-PLAN.md, docs/ISLES-RULES.md), so the rules, How to play and the
 * simulator all read the same ones. The cosy version (James, 3 Nov 2026): coins, sky crystals and islanders, nothing
 * ever goes wrong. An original game: none of these come from Immortal Barons or Barren Realms Elite. Tuned with
 * `npm run isles:sim`.
 */

/** The six kinds of building, plus an empty spot waiting to be built on. Each building has levels 1 to MAX_LEVEL. */
export const PLOT_KINDS = ['farm', 'mine', 'dock', 'house', 'workshop', 'library'] as const;
export type PlotKind = (typeof PLOT_KINDS)[number];
export type PlotOrEmpty = PlotKind | 'empty';

/** A new island at the start of a season: its building spots, in the order they were claimed (the art draws them in
 * that order on the base's clearings), every building at level 1. */
export const START = {
  spots: ['farm', 'house', 'mine', 'farm', 'dock', 'empty'] as PlotOrEmpty[],
  coins: 150,
  islanders: 20,
  crystals: 0,
} as const;

/** Turns a day, and how many unused turns can pile up (today's plus two missed days). */
export const TURNS_PER_DAY = 6;
export const MOST_TURNS_SAVED = 18;

// --- Collect, each turn ---------------------------------------------------------------------------------------------

// Every amount below is for a level 1 building; a level 2 building makes twice as much and a level 3 three times.

/** Coins each kind of building makes a turn. */
export const COINS: Record<PlotKind, number> = { farm: 6, mine: 8, dock: 4, house: 3, workshop: 2, library: 7 };
/** Sky crystals one Workshop makes a turn (kept in quarters). */
export const WORKSHOP_CRYSTALS = 0.25;
/** A right answer to the sky pilot's question: everything collected this turn is multiplied by this. */
export const FAIR_WIND = 1.15;

// --- Islanders (they never leave) -----------------------------------------------------------------------------------

/** Islanders a House has room for, and islanders any other spot has room for (a few live by every building). */
export const HOUSE_ROOM = 20;
export const OTHER_ROOM = 2;
/** Each turn islanders move this share of the way to the room there is (at least one while there's room). */
export const ARRIVE_SHARE = 0.15;

// --- Sky-boats -------------------------------------------------------------------------------------------------------

/** Sky-boats for racing: START_BOATS plus one for every Dock level. */
export const START_BOATS = 2;

// --- Spend -----------------------------------------------------------------------------------------------------------

/** Chunks of land the wind brings past each island in a day (each is one new building spot), and how many can wait. */
export const DRIFT_PER_DAY = 1;
export const MOST_DRIFT_SAVED = 3;
/** Every chunk costs the same. The drift, not the price, sets the pace. */
export const CHUNK_PRICE = 300;
/** Building on a spot (or changing what's there, which starts again at level 1). */
export const BUILD_COINS: Record<PlotKind, number> = { farm: 25, mine: 35, dock: 30, house: 25, workshop: 35, library: 40 };
/** The top level, and what raising a building to each level costs: the build price times LEVEL_TIMES, plus crystals. */
export const MAX_LEVEL = 3;
export const LEVEL_TIMES: Record<number, number> = { 2: 4, 3: 9 };
export const LEVEL_CRYSTALS: Record<number, number> = { 2: 0, 3: 6 };

// --- Decorations (instead of upgrades) -------------------------------------------------------------------------------

/**
 * Bought in the Build step and put on one of the island's decoration places. Most are just pretty; three have one
 * small help (`help`), and an island can have only one of each of those. `does` is in words a 9-year-old reads easily.
 */
export const DECORATIONS = [
  { id: 'flowers', name: 'Flower beds', coins: 40, crystals: 0, does: 'pretty' },
  { id: 'bench', name: 'Picnic bench', coins: 60, crystals: 0, does: 'pretty' },
  { id: 'lantern', name: 'Stone lantern', coins: 80, crystals: 0, does: 'pretty' },
  { id: 'cherry', name: 'Cherry blossom tree', coins: 120, crystals: 0, does: 'pretty' },
  { id: 'chimes', name: 'Wind chimes', coins: 150, crystals: 0, does: 'pretty' },
  { id: 'bridge', name: 'Little bridge', coins: 200, crystals: 0, does: 'pretty' },
  { id: 'fountain', name: 'Fountain', coins: 300, crystals: 0, does: 'pretty' },
  { id: 'balloon', name: 'Hot-air balloon', coins: 500, crystals: 5, does: 'pretty' },
  { id: 'rainbow', name: 'Rainbow arch', coins: 800, crystals: 10, does: 'pretty' },
  { id: 'flags', name: 'Sail flags', coins: 250, crystals: 0, does: 'your sky-boats race a little faster', help: true },
  { id: 'arch', name: 'Welcome arch', coins: 200, crystals: 0, does: 'islanders arrive twice as fast', help: true },
  { id: 'telescope', name: 'Star telescope', coins: 600, crystals: 5, does: 'one more chunk of land drifts by each day', help: true },
] as const;
export type DecorationId = (typeof DECORATIONS)[number]['id'];
/** Decoration places on each island base (the same order as BASES): spots round the edges and along the paths. */
export const DECORATION_PLACES = [4, 6, 8, 10, 12] as const;
/** Once the Sky Lighthouse is lit, a little sky garden floats alongside with this many more decoration places, so
 * there's always something to make prettier (James, 3 Nov 2026). */
export const GARDEN_PLACES = 20;
/** The Welcome arch multiplies islanders arriving by this. */
export const ARCH_BOOST = 2;

// --- The big goal ----------------------------------------------------------------------------------------------------

/** Building spots for Grand Isle. */
export const GRAND_ISLE = 16;
/** The five island bases the art draws, and the most spots each holds (Little, Growing, Big, Large, Grand). */
export const BASES = [6, 8, 10, 13, 16] as const;
/** The Sky Lighthouse's four stages, each paid in coins and sky crystals once the island is a Grand Isle. */
export const LIGHTHOUSE = [
  { coins: 600, crystals: 10 },
  { coins: 750, crystals: 15 },
  { coins: 900, crystals: 20 },
  { coins: 1100, crystals: 25 },
] as const;

// --- Lucky weather (about one turn in 8, good only) ------------------------------------------------------------------

export const WEATHER_CHANCE = 1 / 8;
export const WEATHER = ['rainbow', 'geese', 'traveller', 'breeze'] as const;
export type Weather = (typeof WEATHER)[number];
/** Rainbow: a sky crystal. Golden geese: coins. Lost traveller: islanders. Warm breeze: a head start in the next race. */
export const RAINBOW_CRYSTALS = 1;
export const GEESE_COINS = 25;
export const TRAVELLER_ISLANDERS = 3;
export const BREEZE_SPEED = 2;

// --- Sky Races -------------------------------------------------------------------------------------------------------

/** Races an island may start in a day (one a turn). The day's first win brings coins and sky crystals; a later win
 * brings coins. The other side gets a small "well raced" gift, win or lose. */
export const RACES_PER_DAY = 2;
export const FIRST_WIN_PRIZE = { coins: 30, crystals: 5 } as const;
export const LATER_WIN_PRIZE = { coins: 15, crystals: 0 } as const;
export const WELL_RACED_COINS = 5;
/** An island can be challenged by classmates this many times a day (the Gull Riders don't count). */
export const MOST_CHALLENGED = 3;
/** The calm start: an island that has played fewer turns than this can't be challenged by classmates. */
export const CALM_TURNS = 12;
/** Questions in a race; each right answer is one gust. */
export const RACE_QUESTIONS = 3;

/**
 * A boat's speed is RACE_BASE plus its sky-boats, Sail flags, a warm breeze, gusts and luck. Sky-boats count as
 * BOAT_SPEED × the square root of the boats (up to MOST_BOATS), so a big fleet helps less and less and a small island
 * with its questions right can still win.
 */
export const RACE_BASE = 30;
export const BOAT_SPEED = 3;
export const MOST_BOATS = 16;
export const SAILS_SPEED = 3;
/** One right answer. */
export const GUST_SPEED = 5;
/** The side that wasn't asked questions (an island at home, or the Gull Riders) gets this much wind instead: one
 * gust's worth. */
export const HOME_WIND = 5;
/** With no answers right the challenger never wins (James, 3 Nov 2026): the other side's luck is always at least
 * enough to finish this much ahead of the challenger's speed without gusts. */
export const NO_ANSWER_GAP = 0.5;
/** Luck: each side adds a random amount from 0 up to this. */
export const RACE_LUCK = 12;
/** The race animation is this many legs long. */
export const RACE_LEGS = 8;

// --- Sky Keepers -------------------------------------------------------------------------------------------------------

/** The Sky Keeper portraits a pupil can choose from (src/games/isles/art/keepers/): 20 boys and 20 girls. Just for fun:
 * a keeper has no powers. The server only saves an id from this list. */
export const KEEPERS = [
  ...Array.from({ length: 20 }, (_, i) => `b${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 20 }, (_, i) => `g${String(i + 1).padStart(2, '0')}`),
] as readonly string[];

// --- Small islands catch up ------------------------------------------------------------------------------------------

/** An island under this share of its class's middle size gets one extra chunk in its drift. */
export const SMALL_ISLAND = 0.7;
