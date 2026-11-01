/**
 * Sky Isles' rules (docs/ISLES-RULES.md), as pure functions: the same island, choices and random numbers always give
 * the same next turn. The server plays every turn with these; the preview runs the same functions in the browser.
 *
 * A turn, in order: collect (with the fair wind if the sky pilot's question was right), feed, the pupil's spending
 * (each choice checked against the island as it stands at that moment), then the end of the turn (food going off,
 * people moving in or out, happiness, weather). Collect and feed have no luck in them, so the browser can show them
 * before the pupil spends; only the end of the turn uses `random`.
 */
import {
  ARRIVE_SHARE, BOAT_WORK, BREEZE_HAPPINESS, BUILD_COINS, CHUNK_BASE, CHUNK_PER_SPOT, CROWDED_LEAVE, DOCK_HAPPY,
  DOCK_LOW, DRIFT_PER_DAY, LEVEL_GOODS, LEVEL_TIMES, MAX_LEVEL, MOST_DRIFT_SAVED, FAIR_WIND, FARM_FOOD, FESTIVAL_COINS, FESTIVAL_HAPPINESS, FOOD_PER_PERSON, GEESE_COINS,
  GOODS_WORK, GRAND_ISLE, HAPPY_DRIFT, HAPPY_REST, HIGH_TAX_ARRIVALS, HOUSE_ROOM, HUNGRY_HAPPINESS, HUNGRY_LEAVE,
  LIBRARY_IDEAS, LIGHTHOUSE, MARKET_BUY_EXTRA, MINE_COINS, MOST_TURNS_SAVED, OTHER_ROOM, PEOPLE_PER_TAX_COIN,
  PLOT_KINDS, RAINBOW_FOOD, SMALL_ISLAND, SPOIL, START, STORE_BASE, STORE_PER_FARM, STORM_FOOD, TRAVELLER_PEOPLE,
  TURNS_PER_DAY, UNHAPPY_BELOW, WORKSHOP_WORK, UNHAPPY_LEAVE, UPGRADE_BOOST, UPGRADES, WEATHER, WEATHER_CHANCE,
  type PlotKind, type PlotOrEmpty, type TaxLevel, type UpgradeId, type Weather,
} from './config';

/** One building spot. An empty spot is level 0; a building is level 1 to MAX_LEVEL. */
export interface Spot {
  kind: PlotOrEmpty;
  level: number;
}

export interface Island {
  /** Turns played this season. */
  turn: number;
  /** Building spots, in the order they were claimed (the art draws spot n on the base's clearing n). */
  spots: Spot[];
  coins: number;
  food: number;
  people: number;
  /** 0 to 100. */
  happiness: number;
  /** Ideas from Libraries, in halves. */
  ideas: number;
  boats: number;
  goods: number;
  /** Workshop work towards the next sky-boat. */
  boatWork: number;
  tax: TaxLevel;
  /** Share of workshop work going to sky-boats: 0, 25, 50, 75 or 100. */
  boatShare: number;
  upgrades: UpgradeId[];
  /** Sky Lighthouse stages built (0 to 4). */
  lighthouse: number;
  /** Today: turns left, chunks left in the drift, and whether a festival has been held. */
  turnsLeft: number;
  driftLeft: number;
  festivalToday: boolean;
}

/** What a turn collected, for the browser's sum line. */
export interface Collected {
  food: number;
  mine: number;
  dock: number;
  tax: number;
  boats: number;
  goods: number;
  ideas: number;
  /** Was the fair wind blowing (a right answer)? */
  windy: boolean;
}

export type Action =
  | { kind: 'anchor' }
  | { kind: 'build'; spot: number; plot: PlotKind }
  | { kind: 'raise'; spot: number }
  | { kind: 'tax'; level: TaxLevel }
  | { kind: 'workshop'; boatShare: number }
  | { kind: 'festival' }
  | { kind: 'upgrade'; id: UpgradeId }
  | { kind: 'lighthouse' }
  | { kind: 'sell'; good: 'food' | 'goods'; amount: number }
  | { kind: 'buy'; good: 'food' | 'goods'; amount: number };

export type Problem =
  | 'no-turns'
  | 'not-enough-coins'
  | 'not-enough-food'
  | 'not-enough-goods'
  | 'not-enough-ideas'
  | 'no-drift'
  | 'no-such-spot'
  | 'same-plot'
  | 'nothing-to-raise'
  | 'top-level'
  | 'festival-done'
  | 'already-have'
  | 'not-grand-yet'
  | 'lighthouse-done'
  | 'bad-amount'
  | 'bad-choice';

/** Today's class market prices (coins for one). */
export interface Prices {
  food: number;
  goods: number;
}

export interface TurnReport {
  collected: Collected;
  /** Food eaten, and people who left because there wasn't enough. */
  eaten: number;
  hungryLeft: number;
  spoiled: number;
  arrived: number;
  left: number;
  weather: Weather | null;
  /** What the weather did (food, coins, happiness or people; a storm's food and fog's coins are negative). */
  weatherAmount: number;
}

// --- Small helpers ---------------------------------------------------------------------------------------------------

export function has(island: Island, id: UpgradeId): boolean {
  return island.upgrades.includes(id);
}

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

/** What the next chunk of land costs. Bigger islands pay more, so small ones catch up. */
export function chunkPrice(island: Island): number {
  return CHUNK_BASE + CHUNK_PER_SPOT * spotCount(island);
}

/** What raising the building on this spot one level costs, or null if it can't be raised. */
export function raisePrice(island: Island, spot: number): { coins: number; goods: number } | null {
  const here = island.spots[spot];
  if (!here || here.kind === 'empty' || here.level >= MAX_LEVEL) return null;
  const next = here.level + 1;
  return { coins: BUILD_COINS[here.kind] * LEVEL_TIMES[next], goods: LEVEL_GOODS[next] };
}

/** People the island has room for. */
export function room(island: Island): number {
  const houseRoom = has(island, 'bunk-beds') ? Math.round(HOUSE_ROOM * UPGRADE_BOOST) : HOUSE_ROOM;
  return levels(island, 'house') * houseRoom + (spotCount(island) - count(island, 'house')) * OTHER_ROOM;
}

/** Food that keeps before some goes off. */
export function store(island: Island): number {
  const size = STORE_BASE + STORE_PER_FARM * levels(island, 'farm');
  return has(island, 'cellars') ? size * 2 : size;
}

export function foodNeeded(island: Island): number {
  return Math.ceil(island.people * FOOD_PER_PERSON);
}

/** Coins one Dock earns at this happiness. */
export function dockCoins(island: Island): number {
  const coins = DOCK_LOW + (DOCK_HAPPY * island.happiness) / 100;
  return has(island, 'lanterns') ? coins * UPGRADE_BOOST : coins;
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

// --- A new island and a new day --------------------------------------------------------------------------------------

export function newIsland(): Island {
  return {
    turn: 0,
    spots: START.spots.map((kind) => ({ kind, level: kind === 'empty' ? 0 : 1 })),
    coins: START.coins,
    food: START.food,
    people: START.people,
    happiness: START.happiness,
    ideas: 0,
    boats: START.boats,
    goods: START.goods,
    boatWork: 0,
    tax: START.tax,
    boatShare: START.boatShare,
    upgrades: [],
    lighthouse: 0,
    turnsLeft: TURNS_PER_DAY,
    driftLeft: DRIFT_PER_DAY,
    festivalToday: false,
  };
}

/**
 * The first time an island is seen on a new New Zealand day: fresh turns (unused ones pile up to MOST_TURNS_SAVED) and
 * more drift (unused chunks wait, up to MOST_DRIFT_SAVED). `classMiddle` is the middle spot count of the class's islands: an island under half of it gets an extra
 * chunk, so a late joiner can catch up.
 */
export function newDay(island: Island, daysSince: number, classMiddle: number): Island {
  const turnsLeft = Math.min(MOST_TURNS_SAVED, island.turnsLeft + TURNS_PER_DAY * Math.max(1, daysSince));
  const days = Math.max(1, daysSince);
  const small = spotCount(island) < classMiddle * SMALL_ISLAND ? 1 : 0;
  const most = MOST_DRIFT_SAVED + small + (has(island, 'star-map') ? 1 : 0);
  const driftLeft = Math.min(most, island.driftLeft + (DRIFT_PER_DAY + (has(island, 'star-map') ? 1 : 0)) * days + small);
  return { ...island, turnsLeft, driftLeft, festivalToday: false };
}

// --- Collect and feed (no luck) --------------------------------------------------------------------------------------

export function collect(island: Island, windy: boolean): Collected {
  const wind = windy ? FAIR_WIND : 1;
  const farm = has(island, 'ploughs') ? FARM_FOOD * UPGRADE_BOOST : FARM_FOOD;
  const work = levels(island, 'workshop') * WORKSHOP_WORK * wind;
  const boatWork = island.boatWork + (work * island.boatShare) / 100;
  return {
    food: Math.floor(levels(island, 'farm') * farm * wind),
    mine: Math.floor(levels(island, 'mine') * MINE_COINS * wind),
    dock: Math.floor(levels(island, 'dock') * dockCoins(island) * wind),
    tax: Math.floor((island.people / PEOPLE_PER_TAX_COIN[island.tax]) * wind),
    boats: Math.floor(boatWork / BOAT_WORK),
    goods: Math.floor((work * (100 - island.boatShare)) / 100 / GOODS_WORK),
    ideas: levels(island, 'library') * LIBRARY_IDEAS * wind,
    windy,
  };
}

function applyCollect(island: Island, c: Collected): Island {
  const work = levels(island, 'workshop') * WORKSHOP_WORK * (c.windy ? FAIR_WIND : 1);
  const boatWork = island.boatWork + (work * island.boatShare) / 100 - c.boats * BOAT_WORK;
  return {
    ...island,
    food: island.food + c.food,
    coins: island.coins + c.mine + c.dock + c.tax,
    boats: island.boats + c.boats,
    goods: island.goods + c.goods,
    ideas: Math.round((island.ideas + c.ideas) * 2) / 2,
    boatWork,
  };
}

function feed(island: Island): { island: Island; eaten: number; hungryLeft: number } {
  const need = foodNeeded(island);
  if (island.food >= need) return { island: { ...island, food: island.food - need }, eaten: need, hungryLeft: 0 };
  const hungry = Math.ceil((need - island.food) / FOOD_PER_PERSON);
  const hungryLeft = Math.ceil(hungry * HUNGRY_LEAVE);
  return {
    island: {
      ...island,
      food: 0,
      people: Math.max(0, island.people - hungryLeft),
      happiness: clamp(island.happiness + HUNGRY_HAPPINESS, 0, 100),
    },
    eaten: island.food,
    hungryLeft,
  };
}

/**
 * The island after collecting and feeding, before the pupil spends: what the browser shows on the spend screen, and
 * what `playTurn` checks the choices against.
 */
export function beforeSpending(island: Island, windy: boolean) {
  const collected = collect(island, windy);
  const fed = feed(applyCollect(island, collected));
  return { island: fed.island, collected, eaten: fed.eaten, hungryLeft: fed.hungryLeft };
}

// --- Spending --------------------------------------------------------------------------------------------------------

const buyPrice = (price: number) => Math.ceil(price * MARKET_BUY_EXTRA);

/** Why this choice can't be made on this island now, or null if it can. */
export function problemWith(island: Island, action: Action, prices: Prices): Problem | null {
  switch (action.kind) {
    case 'anchor':
      if (island.driftLeft < 1) return 'no-drift';
      return island.coins < chunkPrice(island) ? 'not-enough-coins' : null;
    case 'build': {
      if (!PLOT_KINDS.includes(action.plot)) return 'bad-choice';
      const here = island.spots[action.spot];
      if (!Number.isInteger(action.spot) || !here) return 'no-such-spot';
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
      return island.goods < price.goods ? 'not-enough-goods' : null;
    }
    case 'tax':
      return ['low', 'fair', 'high'].includes(action.level) ? null : 'bad-choice';
    case 'workshop':
      return [0, 25, 50, 75, 100].includes(action.boatShare) ? null : 'bad-choice';
    case 'festival':
      if (island.festivalToday) return 'festival-done';
      return island.coins < FESTIVAL_COINS ? 'not-enough-coins' : null;
    case 'upgrade': {
      const upgrade = UPGRADES.find((u) => u.id === action.id);
      if (!upgrade) return 'bad-choice';
      if (has(island, action.id)) return 'already-have';
      return island.ideas < upgrade.ideas ? 'not-enough-ideas' : null;
    }
    case 'lighthouse': {
      if (!isGrandIsle(island)) return 'not-grand-yet';
      const stage = LIGHTHOUSE[island.lighthouse];
      if (!stage) return 'lighthouse-done';
      if (island.coins < stage.coins) return 'not-enough-coins';
      return island.goods < stage.goods ? 'not-enough-goods' : null;
    }
    case 'sell':
    case 'buy': {
      if (action.good !== 'food' && action.good !== 'goods') return 'bad-choice';
      if (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > 10_000) return 'bad-amount';
      if (action.kind === 'sell') {
        if (island[action.good] < action.amount) return action.good === 'food' ? 'not-enough-food' : 'not-enough-goods';
        return null;
      }
      return island.coins < action.amount * buyPrice(prices[action.good]) ? 'not-enough-coins' : null;
    }
    default:
      return 'bad-choice';
  }
}

/** Makes one choice. Call problemWith first: this doesn't check. */
export function apply(island: Island, action: Action, prices: Prices): Island {
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
        goods: island.goods - price.goods,
        spots: island.spots.map((spot, i) => (i === action.spot ? { ...spot, level: spot.level + 1 } : spot)),
      };
    }
    case 'tax':
      return { ...island, tax: action.level };
    case 'workshop':
      return { ...island, boatShare: action.boatShare };
    case 'festival':
      return {
        ...island,
        coins: island.coins - FESTIVAL_COINS,
        festivalToday: true,
        happiness: clamp(island.happiness + FESTIVAL_HAPPINESS, 0, 100),
      };
    case 'upgrade': {
      const upgrade = UPGRADES.find((u) => u.id === action.id)!;
      return { ...island, ideas: island.ideas - upgrade.ideas, upgrades: [...island.upgrades, action.id] };
    }
    case 'lighthouse': {
      const stage = LIGHTHOUSE[island.lighthouse];
      return { ...island, coins: island.coins - stage.coins, goods: island.goods - stage.goods, lighthouse: island.lighthouse + 1 };
    }
    case 'sell':
      return { ...island, [action.good]: island[action.good] - action.amount, coins: island.coins + action.amount * prices[action.good] };
    case 'buy':
      return {
        ...island,
        [action.good]: island[action.good] + action.amount,
        coins: island.coins - action.amount * buyPrice(prices[action.good]),
      };
  }
}

// --- The end of a turn (the only luck) -------------------------------------------------------------------------------

function endOfTurn(island: Island, dockCoinsThisTurn: number, random: () => number) {
  let next = { ...island };

  const spoiled = next.food > store(next) ? Math.ceil((next.food - store(next)) * (has(next, 'cellars') ? SPOIL / 2 : SPOIL)) : 0;
  next.food -= spoiled;

  // Happiness drifts towards the tax level's resting point.
  const rest = HAPPY_REST[next.tax];
  next.happiness = clamp(Math.round(next.happiness + (rest - next.happiness) * HAPPY_DRIFT), 0, 100);

  // People move towards the room there is: faster when happy, slower with High tax. Over the room, some leave.
  let arrived = 0;
  let left = 0;
  const space = room(next) - next.people;
  if (space > 0) {
    const pull = ARRIVE_SHARE * (0.5 + next.happiness / 100) * (next.tax === 'high' ? HIGH_TAX_ARRIVALS : 1);
    arrived = Math.max(next.happiness >= UNHAPPY_BELOW ? 1 : 0, Math.floor(space * pull));
    arrived = Math.min(arrived, space);
  } else if (space < 0) {
    left = Math.ceil(-space * CROWDED_LEAVE);
  }
  if (next.happiness < UNHAPPY_BELOW) left += Math.ceil(next.people * UNHAPPY_LEAVE);
  next.people = Math.max(0, next.people + arrived - left);

  let weather: Weather | null = null;
  let weatherAmount = 0;
  if (random() < WEATHER_CHANCE) {
    weather = WEATHER[Math.floor(random() * WEATHER.length)];
    switch (weather) {
      case 'rainbow':
        weatherAmount = RAINBOW_FOOD;
        next.food += weatherAmount;
        break;
      case 'geese':
        weatherAmount = GEESE_COINS;
        next.coins += weatherAmount;
        break;
      case 'storm':
        weatherAmount = has(next, 'wind-wall') ? 0 : -Math.floor(next.food * STORM_FOOD);
        next.food += weatherAmount;
        break;
      case 'breeze':
        weatherAmount = BREEZE_HAPPINESS;
        next.happiness = clamp(next.happiness + weatherAmount, 0, 100);
        break;
      case 'traveller':
        weatherAmount = TRAVELLER_PEOPLE;
        next.people += weatherAmount;
        break;
      case 'fog':
        // Fog rolled in and half the Docks' visitors turned back: half this turn's Dock coins are lost.
        weatherAmount = -Math.min(next.coins, Math.floor(dockCoinsThisTurn / 2));
        next.coins += weatherAmount;
        break;
    }
  }

  next = { ...next, turn: next.turn + 1, turnsLeft: next.turnsLeft - 1 };
  return { island: next, spoiled, arrived, left, weather, weatherAmount };
}

// --- A whole turn ----------------------------------------------------------------------------------------------------

export type TurnResult = { ok: true; island: Island; report: TurnReport } | { ok: false; problem: Problem; at: number };

/**
 * Plays one turn. `windy` is whether the sky pilot's question was answered right (the server knows; the browser
 * doesn't decide). Every choice is checked in order against the island as it is then; one impossible choice refuses
 * the whole turn, and `at` says which.
 */
export function playTurn(island: Island, windy: boolean, actions: Action[], prices: Prices, random: () => number): TurnResult {
  if (island.turnsLeft < 1) return { ok: false, problem: 'no-turns', at: -1 };
  const fed = beforeSpending(island, windy);
  const { collected } = fed;
  let next = fed.island;
  for (let i = 0; i < actions.length; i++) {
    const problem = problemWith(next, actions[i], prices);
    if (problem) return { ok: false, problem, at: i };
    next = apply(next, actions[i], prices);
  }
  const end = endOfTurn(next, collected.dock, random);
  return {
    ok: true,
    island: end.island,
    report: {
      collected,
      eaten: fed.eaten,
      hungryLeft: fed.hungryLeft,
      spoiled: end.spoiled,
      arrived: end.arrived,
      left: end.left,
      weather: end.weather,
      weatherAmount: end.weatherAmount,
    },
  };
}

/** What a finished island is worth, for the Hall of the Skies (never anything about maths). */
export function islandWorth(island: Island): number {
  const allLevels = island.spots.reduce((sum, spot) => sum + spot.level, 0);
  return spotCount(island) * 10 + allLevels * 5 + island.people + island.upgrades.length * 15 + island.lighthouse * 50;
}
