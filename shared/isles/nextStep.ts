/**
 * Pip's next step (docs/ISLES-PLAN.md, section 6.7): the one thing a pupil should do now, in one short sentence with
 * real names and numbers, worked out fresh from the island each time it changes. The first rule that fits wins.
 * `target` names the button it means (a `data-pip` name on screen), so "Show me" can light it up.
 *
 * Words are kept plain, for a 9-year-old reading on their own.
 */
import {
  BUILD_COINS, DOCK_HAPPY, DOCK_LOW, FARM_FOOD, FIRST_WIN_PRIZE, HOUSE_ROOM, LIGHTHOUSE, MARKET_BUY_EXTRA, MARKET_PRICE, MINE_COINS, UPGRADE_BOOST,
  UPGRADES, type PlotKind,
} from './config';
import { chunkPrice, collect, count, foodNeeded, has, isGrandIsle, raisePrice, room, type Island } from './engine';
import { GULL_RIDERS, raceProblem } from './race';

export interface NextStep {
  say: string;
  /** The button to light up: `spot-<n>`, `drift`, `upgrade-<id>`, `lighthouse`, `market`, `race` or `end-turn`. */
  target?: string;
}

export const KIND_NAME: Record<PlotKind, string> = {
  farm: 'Farm', mine: 'Mine', dock: 'Dock', house: 'House', workshop: 'Workshop', library: 'Library',
};

const coins = (n: number) => `${n.toLocaleString('en-NZ')} coin${n === 1 ? '' : 's'}`;
const turns = (n: number) => (n <= 1 ? 'next turn' : `in ${n} turns`);

/** Food grown in a turn (no fair wind) minus food eaten: below nothing, the store goes down. */
function foodEachTurn(island: Island): number {
  return collect(island, false).food - foodNeeded(island);
}

/** The turn the food runs out on (1 = next turn), or null if it doesn't. */
export function foodRunsOutIn(island: Island): number | null {
  const net = foodEachTurn(island);
  return net >= 0 ? null : Math.floor(island.food / -net) + 1;
}

const isFull = (island: Island) => room(island) - island.people <= 2;

/** What to build on an empty spot. */
function wantedKind(island: Island): PlotKind {
  if (foodEachTurn(island) < 2) return 'farm';
  if (isFull(island)) return 'house';
  if (count(island, 'library') === 0) return 'library';
  if (count(island, 'workshop') === 0) return 'workshop';
  return island.happiness >= 60 && count(island, 'dock') <= count(island, 'mine') ? 'dock' : 'mine';
}

/** "on your empty spot", or "on an empty spot" when there are more. */
function emptyWords(island: Island): string {
  return count(island, 'empty') === 1 ? 'your empty spot' : 'an empty spot';
}

/** "your Mine", or "a Mine" when there are more. */
function buildingWords(island: Island, kind: PlotKind): string {
  return count(island, kind) === 1 ? `your ${KIND_NAME[kind]}` : `a ${KIND_NAME[kind]}`;
}

/** What raising a building to `level` does, in a few words. */
function raiseGain(island: Island, kind: PlotKind, level: number): string {
  const was = level - 1;
  switch (kind) {
    case 'farm':
      return `it will grow ${FARM_FOOD * level * (has(island, 'ploughs') ? UPGRADE_BOOST : 1)} food a turn instead of ${FARM_FOOD * was * (has(island, 'ploughs') ? UPGRADE_BOOST : 1)}`;
    case 'mine':
      return `it will dig ${MINE_COINS * level} coins a turn instead of ${MINE_COINS * was}`;
    case 'dock': {
      const each = Math.floor((DOCK_LOW + (DOCK_HAPPY * island.happiness) / 100) * (has(island, 'lanterns') ? UPGRADE_BOOST : 1));
      return `it will earn about ${each * level} coins a turn instead of ${each * was}`;
    }
    case 'house': {
      const each = has(island, 'bunk-beds') ? Math.round(HOUSE_ROOM * UPGRADE_BOOST) : HOUSE_ROOM;
      return `it will have room for ${each * level} people instead of ${each * was}`;
    }
    case 'workshop':
      return level === 2 ? 'it will make sky-boats and goods twice as fast' : 'it will make sky-boats and goods three times as fast';
    case 'library':
      return level === 2 ? 'it will think of ideas twice as fast' : 'it will think of ideas three times as fast';
  }
}

/** The spot whose building is best to raise now, among those the island can pay for, and its price. */
function bestRaise(island: Island, kinds: readonly PlotKind[]): { spot: number; coins: number; goods: number } | null {
  let best: { spot: number; coins: number; goods: number } | null = null;
  let bestScore = Infinity;
  island.spots.forEach((here, spot) => {
    if (here.kind === 'empty' || !kinds.includes(here.kind)) return;
    const price = raisePrice(island, spot);
    if (!price || price.coins > island.coins || price.goods > island.goods) return;
    // Cheapest first, with the kinds listed first a little ahead.
    const score = price.coins * (1 + kinds.indexOf(here.kind) * 0.15);
    if (score < bestScore) [best, bestScore] = [{ spot, ...price }, score];
  });
  return best;
}

function raiseStep(island: Island, r: { spot: number; coins: number; goods: number }, why = ''): NextStep {
  const here = island.spots[r.spot];
  const kind = here.kind as PlotKind;
  const cost = r.goods ? `${coins(r.coins)} and ${r.goods} goods` : coins(r.coins);
  return {
    say: `${why}Raise ${buildingWords(island, kind)} to level ${here.level + 1} for ${cost}: ${raiseGain(island, kind, here.level + 1)}.`,
    target: `spot-${r.spot}`,
  };
}

export function nextStep(island: Island): NextStep {
  if (island.turnsLeft < 1) return { say: 'Your island is resting. See you tomorrow!' };

  const empty = island.spots.findIndex((spot) => spot.kind === 'empty');

  // Food running out.
  const runsOut = foodRunsOutIn(island);
  if (runsOut !== null && runsOut <= 3) {
    const why = `Your food runs out ${turns(runsOut)}: `;
    if (empty >= 0 && island.coins >= BUILD_COINS.farm) return { say: `${why}build a Farm on ${emptyWords(island)}.`, target: `spot-${empty}` };
    const farm = bestRaise(island, ['farm']);
    if (farm) return raiseStep(island, farm, why.replace(': ', '. '));
    if (island.coins >= Math.ceil(MARKET_PRICE.food * MARKET_BUY_EXTRA)) return { say: `${why}buy some food at the market.`, target: 'market' };
    return { say: `${why}save ${coins(BUILD_COINS.farm)} for a new Farm.` };
  }

  // No room for more people.
  if (isFull(island)) {
    const why = `Your island is full (${island.people} people, room for ${room(island)}): `;
    if (empty >= 0 && island.coins >= BUILD_COINS.house) return { say: `${why}build a House on ${emptyWords(island)}.`, target: `spot-${empty}` };
    const house = bestRaise(island, ['house']);
    if (house) return { ...raiseStep(island, house), say: `${why}raise ${buildingWords(island, 'house')} to level ${island.spots[house.spot].level + 1} for ${coins(house.coins)}.` };
  }

  // An empty spot to build on.
  if (empty >= 0) {
    const kind = wantedKind(island);
    if (island.coins >= BUILD_COINS[kind]) {
      return { say: `You have an empty spot: build a ${KIND_NAME[kind]} on it for ${coins(BUILD_COINS[kind])}.`, target: `spot-${empty}` };
    }
  }

  // An upgrade ready (the cheapest one first).
  const ready = UPGRADES.filter((u) => !has(island, u.id) && island.ideas >= u.ideas).sort((a, b) => a.ideas - b.ideas)[0];
  if (ready) {
    return { say: `You have ${Math.floor(island.ideas)} ideas: unlock ${ready.name}, so ${ready.does}!`, target: `upgrade-${ready.id}` };
  }

  // The Sky Lighthouse.
  const stage = isGrandIsle(island) ? LIGHTHOUSE[island.lighthouse] : undefined;
  if (stage && island.coins >= stage.coins && island.goods >= stage.goods) {
    return {
      say: `Build stage ${island.lighthouse + 1} of the Sky Lighthouse for ${coins(stage.coins)} and ${stage.goods} goods!`,
      target: 'lighthouse',
    };
  }

  // A chunk of land waiting in the drift.
  const chunk = chunkPrice(island);
  if (island.driftLeft > 0 && island.coins >= chunk && (!isGrandIsle(island) || !stage)) {
    return { say: `A chunk of land is drifting by: anchor it for ${coins(chunk)} to get a new spot.`, target: 'drift' };
  }

  // A building worth raising (never spending what the next chunk or Lighthouse stage needs).
  const saveFor = stage ? stage.coins : island.driftLeft > 0 ? chunk : 0;
  const raise = bestRaise(island, ['dock', 'mine', 'farm', 'library', 'workshop', 'house']);
  if (raise && (saveFor === 0 || island.coins - raise.coins >= saveFor / 2)) return raiseStep(island, raise);

  // A race.
  if (island.racesToday === 0 && !raceProblem(island, GULL_RIDERS, '')) {
    return { say: `Try a Sky Race! Your first win today brings ${coins(FIRST_WIN_PRIZE.coins)} and ${FIRST_WIN_PRIZE.goods} goods, and nobody loses anything.`, target: 'race' };
  }

  // Saving up.
  if (stage) {
    const need = [
      stage.coins > island.coins ? `${stage.coins - island.coins} more coins` : '',
      stage.goods > island.goods ? `${stage.goods - island.goods} more goods` : '',
    ].filter(Boolean);
    return {
      say: `Save up for stage ${island.lighthouse + 1} of the Sky Lighthouse: you need ${need.join(' and ')}.`,
      target: 'end-turn',
    };
  }
  if (empty >= 0) {
    const kind = wantedKind(island);
    return { say: `Save up ${coins(BUILD_COINS[kind])} to build a ${KIND_NAME[kind]} on ${emptyWords(island)} (you have ${coins(island.coins)}).`, target: 'end-turn' };
  }
  if (island.driftLeft > 0) {
    return { say: `A chunk of land is drifting by. Save up ${coins(chunk)} to anchor it (you have ${coins(island.coins)}).`, target: 'end-turn' };
  }
  return { say: 'Press End turn to collect what your island makes.', target: 'end-turn' };
}
