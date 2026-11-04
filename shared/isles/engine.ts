/**
 * Sky Isles' rules (docs/ISLES-RULES.md, docs/ISLES-COSY-PLAN.md), as pure functions: the same island, choices and
 * random numbers always give the same next turn. The server plays every turn with these; the preview runs the same
 * functions in the browser.
 *
 * A turn, in order: collect (with the fair wind if the sky pilot's question was right), the pupil's building (each
 * choice checked against the island as it stands at that moment), then the end of the turn (islanders moving in, lucky
 * weather). Nothing ever goes wrong: there is no food to run out, nobody leaves and the weather is only ever good.
 * Collect has no luck in it, so the browser can show it before the pupil builds; only the end of the turn uses `random`.
 */
import {
  ARCH_BOOST, ARRIVE_SHARE, BUILD_COINS, CHUNK_PRICE, COINS, DECORATION_PLACES, DECORATIONS, DRIFT_PER_DAY, FAIR_WIND,
  GARDEN_PLACES, GEESE_COINS, GRAND_ISLE, HOUSE_ROOM, LEVEL_CRYSTALS, LEVEL_TIMES, LIGHTHOUSE, MAX_LEVEL, MOST_DRIFT_SAVED,
  MOST_TURNS_SAVED, OTHER_ROOM, PLOT_KINDS, RAINBOW_CRYSTALS, SMALL_ISLAND, START, START_BOATS, BASES, TRAVELLER_ISLANDERS,
  TURNS_PER_DAY, WEATHER, WEATHER_CHANCE, WORKSHOP_CRYSTALS,
  type DecorationId, type PlotKind, type PlotOrEmpty, type Weather,
} from './config';

/** One building spot. An empty spot is level 0; a building is level 1 to MAX_LEVEL. */
export interface Spot {
  kind: PlotOrEmpty;
  level: number;
}

/** A decoration the island owns, and the decoration place it stands on (null: back on the shelf). */
export interface Decoration {
  id: DecorationId;
  place: number | null;
}

export interface Island {
  /** Turns played this season. */
  turn: number;
  /** Building spots, in the order they were claimed (the art draws spot n on the base's clearing n). */
  spots: Spot[];
  coins: number;
  /** Sky crystals, in steps of a quarter (a Workshop makes a quarter a turn); whole ones are shown. */
  crystals: number;
  /** They arrive while there's room and never leave. */
  islanders: number;
  decorations: Decoration[];
  /** Sky Lighthouse stages built (0 to 4). */
  lighthouse: number;
  /** A warm breeze blew: the next race gets a head start. */
  breeze: boolean;
  /** Today: turns left and chunks left in the drift. */
  turnsLeft: number;
  driftLeft: number;
  /** Sky Races today (shared/isles/race.ts): races started, races won, classmates raced (island ids), times this
   * island was challenged by classmates, and the turn of the last race (one race a turn; -1 for none yet). */
  racesToday: number;
  winsToday: number;
  racedWith: string[];
  challengedToday: number;
  racedTurn: number;
  /** Races won this season. */
  racesWon: number;
}

/** What a turn collected, for the browser's sum line: coins from each kind of building, the fair wind's extra coins
 * on top of their total, and sky crystals. */
export interface Collected {
  coins: Record<PlotKind, number>;
  /** The fair wind's extra: 15% of the buildings' coins, rounded down (0 with no wind). */
  wind: number;
  crystals: number;
  /** Was the fair wind blowing (a right answer)? */
  windy: boolean;
}

export type Action =
  | { kind: 'anchor' }
  | { kind: 'build'; spot: number; plot: PlotKind }
  | { kind: 'raise'; spot: number }
  | { kind: 'decorate'; id: DecorationId; place: number }
  | { kind: 'move'; decoration: number; place: number | null }
  | { kind: 'lighthouse' };

export type Problem =
  | 'no-turns'
  | 'not-enough-coins'
  | 'not-enough-crystals'
  | 'no-drift'
  | 'no-such-spot'
  | 'same-plot'
  | 'nothing-to-raise'
  | 'top-level'
  | 'no-such-place'
  | 'place-taken'
  | 'already-have'
  | 'not-grand-yet'
  | 'lighthouse-done'
  | 'bad-choice';

export interface TurnReport {
  collected: Collected;
  arrived: number;
  weather: Weather | null;
  /** What the weather brought (crystals, coins or islanders; 0 for a warm breeze). */
  weatherAmount: number;
}

// --- Small helpers ---------------------------------------------------------------------------------------------------

export function spotCount(island: Island): number {
  return island.spots.length;
}

/** The levels of every building of this kind added up: what the island's Farms (or Mines...) make, in level 1 Farms. */
export function levels(island: Island, kind: PlotKind): number {
  return island.spots.reduce((sum, spot) => (spot.kind === kind ? sum + spot.level : sum), 0);
}

/** How many buildings of this kind (or empty spots) there are, whatever their levels. */
export function count(island: Island, kind: PlotOrEmpty): number {
  return island.spots.filter((spot) => spot.kind === kind).length;
}

export function isGrandIsle(island: Island): boolean {
  return spotCount(island) >= GRAND_ISLE;
}

/** Does the island own this decoration (on a place or on the shelf)? The helps work either way. */
export function owns(island: Island, id: DecorationId): boolean {
  return island.decorations.some((d) => d.id === id);
}

export function decoration(id: DecorationId) {
  return DECORATIONS.find((d) => d.id === id);
}

/** Which of the five island bases the art draws for this many spots (0 Little to 4 Grand). */
export function baseOf(island: Island): number {
  const i = BASES.findIndex((most) => spotCount(island) <= most);
  return i < 0 ? BASES.length - 1 : i;
}

/** Does the island have its sky garden (the Lighthouse is lit)? */
export function hasGarden(island: Island): boolean {
  return island.lighthouse >= LIGHTHOUSE.length;
}

/** Decoration places now: they grow with the base, and the sky garden's come after the island's. */
export function placeCount(island: Island): number {
  return DECORATION_PLACES[baseOf(island)] + (hasGarden(island) ? GARDEN_PLACES : 0);
}

/** Sky-boats for racing: one for every Dock level, plus the two every island starts with. */
export function boatsOf(island: Island): number {
  return START_BOATS + levels(island, 'dock');
}

/** What the next chunk of land costs: always the same. */
export function chunkPrice(_island?: Island): number {
  return CHUNK_PRICE;
}

/** What raising the building on this spot one level costs, or null if it can't be raised. */
export function raisePrice(island: Island, spot: number): { coins: number; crystals: number } | null {
  const here = island.spots[spot];
  if (!here || here.kind === 'empty' || here.level >= MAX_LEVEL) return null;
  const next = here.level + 1;
  return { coins: BUILD_COINS[here.kind] * LEVEL_TIMES[next], crystals: LEVEL_CRYSTALS[next] };
}

/** Islanders the island has room for. */
export function room(island: Island): number {
  return levels(island, 'house') * HOUSE_ROOM + (spotCount(island) - count(island, 'house')) * OTHER_ROOM;
}

/** Whole sky crystals (they're kept in quarters). */
export const wholeCrystals = (island: Island) => Math.floor(island.crystals);

// --- A new island and a new day --------------------------------------------------------------------------------------

export function newIsland(): Island {
  return {
    turn: 0,
    spots: START.spots.map((kind) => ({ kind, level: kind === 'empty' ? 0 : 1 })),
    coins: START.coins,
    crystals: START.crystals,
    islanders: START.islanders,
    decorations: [],
    lighthouse: 0,
    breeze: false,
    turnsLeft: TURNS_PER_DAY,
    driftLeft: DRIFT_PER_DAY,
    racesToday: 0,
    winsToday: 0,
    racedWith: [],
    challengedToday: 0,
    racedTurn: -1,
    racesWon: 0,
  };
}

/**
 * The first time an island is seen on a new New Zealand day: fresh turns (unused ones pile up to MOST_TURNS_SAVED) and
 * more drift (unused chunks wait, up to MOST_DRIFT_SAVED; the Star telescope adds one a day and lets one more wait).
 * `classMiddle` is the middle spot count of the class's islands: an island under SMALL_ISLAND (0.7) of it gets an
 * extra chunk, so a late joiner can catch up.
 */
export function newDay(island: Island, daysSince: number, classMiddle: number): Island {
  const days = Math.max(1, daysSince);
  const turnsLeft = Math.min(MOST_TURNS_SAVED, island.turnsLeft + TURNS_PER_DAY * days);
  const small = spotCount(island) < classMiddle * SMALL_ISLAND ? 1 : 0;
  const telescope = owns(island, 'telescope') ? 1 : 0;
  const most = MOST_DRIFT_SAVED + small + telescope;
  const driftLeft = Math.min(most, island.driftLeft + (DRIFT_PER_DAY + telescope) * days + small);
  return { ...island, turnsLeft, driftLeft, racesToday: 0, winsToday: 0, racedWith: [], challengedToday: 0 };
}

// --- Collect (no luck) -----------------------------------------------------------------------------------------------

export function collect(island: Island, windy: boolean): Collected {
  const wind = windy ? FAIR_WIND : 1;
  const coins = Object.fromEntries(PLOT_KINDS.map((kind) => [kind, levels(island, kind) * COINS[kind]])) as Record<PlotKind, number>;
  // The wind goes on the total, so the sum line reads "buildings + fair wind" with whole numbers.
  const made = PLOT_KINDS.reduce((sum, kind) => sum + coins[kind], 0);
  // Crystals go in steps of a quarter, so round down to one.
  const crystals = Math.floor(levels(island, 'workshop') * WORKSHOP_CRYSTALS * wind * 4) / 4;
  return { coins, wind: Math.floor(made * (wind - 1) + 1e-9), crystals, windy };
}

export const coinsCollected = (c: Collected) => PLOT_KINDS.reduce((sum, kind) => sum + c.coins[kind], c.wind);

/** The island after collecting, before the pupil builds: what the browser shows on the Build step, and what
 * `playTurn` checks the choices against. */
export function beforeBuilding(island: Island, windy: boolean) {
  const collected = collect(island, windy);
  return { island: { ...island, coins: island.coins + coinsCollected(collected), crystals: island.crystals + collected.crystals }, collected };
}

// --- Building --------------------------------------------------------------------------------------------------------

/** The decoration standing on this place, if any (its index in `decorations`). */
const onPlace = (island: Island, place: number) => island.decorations.findIndex((d) => d.place === place);

const goodPlace = (island: Island, place: unknown): place is number =>
  Number.isInteger(place) && (place as number) >= 0 && (place as number) < placeCount(island);

/** Why this choice can't be made on this island now, or null if it can. */
export function problemWith(island: Island, action: Action): Problem | null {
  switch (action.kind) {
    case 'anchor':
      if (island.driftLeft < 1) return 'no-drift';
      return island.coins < chunkPrice(island) ? 'not-enough-coins' : null;
    case 'build': {
      if (!PLOT_KINDS.includes(action.plot)) return 'bad-choice';
      const here = Number.isInteger(action.spot) ? island.spots[action.spot] : undefined;
      if (!here) return 'no-such-spot';
      if (action.plot === here.kind) return 'same-plot';
      return island.coins < BUILD_COINS[action.plot] ? 'not-enough-coins' : null;
    }
    case 'raise': {
      const here = Number.isInteger(action.spot) ? island.spots[action.spot] : undefined;
      if (!here) return 'no-such-spot';
      if (here.kind === 'empty') return 'nothing-to-raise';
      const price = raisePrice(island, action.spot);
      if (!price) return 'top-level';
      if (island.coins < price.coins) return 'not-enough-coins';
      return island.crystals < price.crystals ? 'not-enough-crystals' : null;
    }
    case 'decorate': {
      const d = decoration(action.id);
      if (!d) return 'bad-choice';
      if ('help' in d && owns(island, action.id)) return 'already-have';
      if (!goodPlace(island, action.place)) return 'no-such-place';
      if (onPlace(island, action.place) >= 0) return 'place-taken';
      if (island.coins < d.coins) return 'not-enough-coins';
      return island.crystals < d.crystals ? 'not-enough-crystals' : null;
    }
    case 'move': {
      if (!Number.isInteger(action.decoration) || !island.decorations[action.decoration]) return 'bad-choice';
      if (action.place === null) return null;
      if (!goodPlace(island, action.place)) return 'no-such-place';
      const there = onPlace(island, action.place);
      return there >= 0 && there !== action.decoration ? 'place-taken' : null;
    }
    case 'lighthouse': {
      if (!isGrandIsle(island)) return 'not-grand-yet';
      const stage = LIGHTHOUSE[island.lighthouse];
      if (!stage) return 'lighthouse-done';
      if (island.coins < stage.coins) return 'not-enough-coins';
      return island.crystals < stage.crystals ? 'not-enough-crystals' : null;
    }
    default:
      return 'bad-choice';
  }
}

/** Makes one choice. Call problemWith first: this doesn't check. */
export function apply(island: Island, action: Action): Island {
  switch (action.kind) {
    case 'anchor':
      return {
        ...island,
        coins: island.coins - chunkPrice(island),
        driftLeft: island.driftLeft - 1,
        spots: [...island.spots, { kind: 'empty', level: 0 }],
      };
    case 'build':
      return {
        ...island,
        coins: island.coins - BUILD_COINS[action.plot],
        spots: island.spots.map((spot, i) => (i === action.spot ? { kind: action.plot, level: 1 } : spot)),
      };
    case 'raise': {
      const price = raisePrice(island, action.spot)!;
      return {
        ...island,
        coins: island.coins - price.coins,
        crystals: island.crystals - price.crystals,
        spots: island.spots.map((spot, i) => (i === action.spot ? { ...spot, level: spot.level + 1 } : spot)),
      };
    }
    case 'decorate': {
      const d = decoration(action.id)!;
      return {
        ...island,
        coins: island.coins - d.coins,
        crystals: island.crystals - d.crystals,
        decorations: [...island.decorations, { id: action.id, place: action.place }],
      };
    }
    case 'move':
      return { ...island, decorations: island.decorations.map((d, i) => (i === action.decoration ? { ...d, place: action.place } : d)) };
    case 'lighthouse': {
      const stage = LIGHTHOUSE[island.lighthouse];
      return { ...island, coins: island.coins - stage.coins, crystals: island.crystals - stage.crystals, lighthouse: island.lighthouse + 1 };
    }
  }
}

// --- The end of a turn (the only luck) -------------------------------------------------------------------------------

/** Islanders who would arrive at the end of a turn on this island (before any weather). */
export function arriving(island: Island): number {
  const space = room(island) - island.islanders;
  if (space <= 0) return 0;
  const share = ARRIVE_SHARE * (owns(island, 'arch') ? ARCH_BOOST : 1);
  return Math.min(space, Math.max(1, Math.floor(space * share)));
}

function endOfTurn(island: Island, random: () => number) {
  const arrived = arriving(island);
  const next = { ...island, islanders: island.islanders + arrived };

  let weather: Weather | null = null;
  let weatherAmount = 0;
  if (random() < WEATHER_CHANCE) {
    weather = WEATHER[Math.floor(random() * WEATHER.length)];
    switch (weather) {
      case 'rainbow':
        weatherAmount = RAINBOW_CRYSTALS;
        next.crystals += weatherAmount;
        break;
      case 'geese':
        weatherAmount = GEESE_COINS;
        next.coins += weatherAmount;
        break;
      case 'traveller':
        weatherAmount = TRAVELLER_ISLANDERS;
        next.islanders += weatherAmount;
        break;
      case 'breeze':
        next.breeze = true;
        break;
    }
  }

  return { island: { ...next, turn: next.turn + 1, turnsLeft: next.turnsLeft - 1 }, arrived, weather, weatherAmount };
}

// --- A whole turn ----------------------------------------------------------------------------------------------------

export type TurnResult = { ok: true; island: Island; report: TurnReport } | { ok: false; problem: Problem; at: number };

/**
 * Plays one turn. `windy` is whether the sky pilot's question was answered right (the server knows; the browser
 * doesn't decide). Every choice is checked in order against the island as it is then; one impossible choice refuses
 * the whole turn, and `at` says which.
 */
export function playTurn(island: Island, windy: boolean, actions: Action[], random: () => number): TurnResult {
  if (island.turnsLeft < 1) return { ok: false, problem: 'no-turns', at: -1 };
  const ready = beforeBuilding(island, windy);
  let next = ready.island;
  for (let i = 0; i < actions.length; i++) {
    const problem = problemWith(next, actions[i]);
    if (problem) return { ok: false, problem, at: i };
    next = apply(next, actions[i]);
  }
  const end = endOfTurn(next, random);
  return { ok: true, island: end.island, report: { collected: ready.collected, arrived: end.arrived, weather: end.weather, weatherAmount: end.weatherAmount } };
}

/** What a finished island is worth, for the Hall of the Skies (never anything about maths): 10 a spot, 5 a building
 * level, 1 for every 5 islanders, a tenth of each decoration's coin price, 50 a Lighthouse stage. */
export function islandWorth(island: Island): number {
  const allLevels = island.spots.reduce((sum, spot) => sum + spot.level, 0);
  const decorated = island.decorations.reduce((sum, d) => sum + Math.floor((decoration(d.id)?.coins ?? 0) / 10), 0);
  return spotCount(island) * 10 + allLevels * 5 + Math.floor(island.islanders / 5) + decorated + island.lighthouse * 50;
}
