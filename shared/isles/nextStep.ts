/**
 * Pip's next step (docs/ISLES-COSY-PLAN.md, section 13): the one thing a pupil should do now, in one short sentence
 * with real names and numbers, worked out fresh from the island each time it changes. The first rule that fits wins.
 * `target` names the button it means (a `data-pip` name on screen), so "Show me" can light it up.
 *
 * Words are kept plain, for a 9-year-old reading on their own.
 */
import { BUILD_COINS, COINS, DECORATIONS, FIRST_WIN_PRIZE, HOUSE_ROOM, LIGHTHOUSE, WORKSHOP_CRYSTALS, type PlotKind } from './config';
import { chunkPrice, count, isGrandIsle, landCanCome, owns, placeCount, raisePrice, room, wholeCrystals, type Island } from './engine';
import { GULL_RIDERS, raceProblem } from './race';

export interface NextStep {
  say: string;
  /** The button to light up: `spot-<n>`, `drift`, `decorate`, `lighthouse`, `race` or `end-turn`. */
  target?: string;
}

export const KIND_NAME: Record<PlotKind, string> = {
  farm: 'Farm', mine: 'Mine', dock: 'Dock', house: 'House', workshop: 'Workshop', library: 'Library',
};

const coins = (n: number) => `${n.toLocaleString('en-NZ')} coin${n === 1 ? '' : 's'}`;
const crystals = (n: number) => `${n} sky crystal${n === 1 ? '' : 's'}`;
const price = (p: { coins: number; crystals: number }) => (p.crystals ? `${coins(p.coins)} and ${crystals(p.crystals)}` : coins(p.coins));

/** What to build on an empty spot: a House when the island is nearly full, one Workshop for crystals, and otherwise
 * null: the pupil's choice (the coin buildings earn about the same, so it doesn't matter which; James, 16 Nov 2026). */
export function wantedKind(island: Island): PlotKind | null {
  if (room(island) - island.islanders <= 2) return 'house';
  if (count(island, 'workshop') === 0) return 'workshop';
  return null;
}

/** The cheapest building: enough coins for this builds something. */
export const CHEAPEST_BUILD = Math.min(...Object.values(BUILD_COINS));

/** What building `kind` costs (null: any building, so the cheapest). */
export const buildPrice = (kind: PlotKind | null) => (kind ? BUILD_COINS[kind] : CHEAPEST_BUILD);

/** "your empty spot", or "an empty spot" when there are more. */
function emptyWords(island: Island): string {
  return count(island, 'empty') === 1 ? 'your empty spot' : 'an empty spot';
}

/** "your Mine", or "a Mine" when there are more. */
function buildingWords(island: Island, kind: PlotKind): string {
  return count(island, kind) === 1 ? `your ${KIND_NAME[kind]}` : `a ${KIND_NAME[kind]}`;
}

/** What raising a building to `level` does, in a few words. */
function raiseGain(kind: PlotKind, level: number): string {
  const was = level - 1;
  switch (kind) {
    case 'house':
      return `it will have room for ${HOUSE_ROOM * level} islanders instead of ${HOUSE_ROOM * was}`;
    case 'workshop':
      return `it will make a sky crystal every ${Math.round(1 / (WORKSHOP_CRYSTALS * level) * 10) / 10} turns`;
    case 'dock':
      return `it will earn ${COINS.dock * level} coins a turn and bring another sky-boat`;
    default:
      return `it will make ${COINS[kind] * level} coins a turn instead of ${COINS[kind] * was}`;
  }
}

/** The spot whose building is cheapest to raise now, among those the island can pay for. */
function bestRaise(island: Island): { spot: number; coins: number; crystals: number } | null {
  let best: { spot: number; coins: number; crystals: number } | null = null;
  island.spots.forEach((_, spot) => {
    const p = raisePrice(island, spot);
    if (!p || p.coins > island.coins || p.crystals > island.crystals) return;
    if (!best || p.coins < best.coins) best = { spot, ...p };
  });
  return best;
}

/** The dearest decoration the island can pay for and has a free place for (helps first, once each). */
function decorationToBuy(island: Island) {
  const placed = island.decorations.filter((d) => d.place !== null).length;
  if (placed >= placeCount(island)) return null;
  const can = DECORATIONS.filter((d) => !('help' in d && owns(island, d.id)) && d.coins <= island.coins && d.crystals <= island.crystals);
  return can.find((d) => 'help' in d) ?? can.sort((a, b) => b.coins - a.coins)[0] ?? null;
}

/** "Build a House on your empty spot for 25 coins so more islanders can move in." (fixed words, so Bella can read it)
 * With no kind: build whatever they like. */
export function buildLine(kind: PlotKind | null, oneEmpty: boolean): string {
  if (!kind) return `Build any building you like on ${oneEmpty ? 'your empty spot' : 'an empty spot'}. They all help your island!`;
  const why = kind === 'house' ? ' so more islanders can move in' : kind === 'workshop' ? ' to make sky crystals' : '';
  return `Build a ${KIND_NAME[kind]} on ${oneEmpty ? 'your empty spot' : 'an empty spot'} for ${coins(BUILD_COINS[kind])}${why}.`;
}

export const RESTING_LINE = 'Your island is resting. See you tomorrow!';
export const RACE_LINE = `Try a Sky Race! Your first win today brings ${coins(FIRST_WIN_PRIZE.coins)} and ${crystals(FIRST_WIN_PRIZE.crystals)}, and nobody loses anything.`;
export const END_TURN_LINE = 'Press End turn to collect what your island makes.';

/** `racesOn`: the class's teacher has Sky Races switched on (Pip never suggests a race that can't be had). */
export function nextStep(island: Island, racesOn = true): NextStep {
  if (island.turnsLeft < 1) return { say: RESTING_LINE };

  // An empty spot to build on.
  const empty = island.spots.findIndex((spot) => spot.kind === 'empty');
  if (empty >= 0) {
    const kind = wantedKind(island);
    if (island.coins >= buildPrice(kind)) {
      return { say: buildLine(kind, count(island, 'empty') === 1), target: `spot-${empty}` };
    }
  }

  // A chunk of land drifting by.
  const chunk = chunkPrice(island);
  const drifting = island.driftLeft > 0 && landCanCome(island);
  if (drifting && island.coins >= chunk) {
    return { say: `A chunk of land is drifting by: anchor it for ${coins(chunk)} to get a new spot.`, target: 'drift' };
  }

  // The Sky Lighthouse.
  const stage = isGrandIsle(island) ? LIGHTHOUSE[island.lighthouse] : undefined;
  if (stage && island.coins >= stage.coins && island.crystals >= stage.crystals) {
    return { say: `Build stage ${island.lighthouse + 1} of the Sky Lighthouse for ${price(stage)}!`, target: 'lighthouse' };
  }

  // A building worth raising (never spending what the next chunk or Lighthouse stage needs).
  const saveFor = stage ? stage.coins : drifting ? chunk : 0;
  const raise = bestRaise(island);
  if (raise && (saveFor === 0 || island.coins - raise.coins >= saveFor / 2)) {
    const here = island.spots[raise.spot];
    const kind = here.kind as PlotKind;
    return { say: `Raise ${buildingWords(island, kind)} to level ${here.level + 1} for ${price(raise)}: ${raiseGain(kind, here.level + 1)}.`, target: `spot-${raise.spot}` };
  }

  // A race.
  if (racesOn && island.racesToday === 0 && !raceProblem(island, GULL_RIDERS, '')) {
    return { say: RACE_LINE, target: 'race' };
  }

  // Coins to spare: something pretty (only when nothing above is being saved for).
  const pretty = saveFor === 0 ? decorationToBuy(island) : null;
  if (pretty) {
    const does = 'help' in pretty ? `: ${pretty.does}` : '';
    return { say: `You could put up a ${pretty.name} for ${price(pretty)}${does}.`, target: 'decorate' };
  }

  // Saving up.
  if (stage) {
    const need = [
      stage.coins > island.coins ? `${stage.coins - island.coins} more coins` : '',
      stage.crystals > island.crystals ? `${stage.crystals - wholeCrystals(island)} more sky crystals` : '',
    ].filter(Boolean);
    return { say: `Save up for stage ${island.lighthouse + 1} of the Sky Lighthouse: you need ${need.join(' and ')}.`, target: 'end-turn' };
  }
  if (empty >= 0) {
    const kind = wantedKind(island);
    const what = kind ? `a ${KIND_NAME[kind]}` : 'something';
    return { say: `Save up ${coins(buildPrice(kind))} to build ${what} on ${emptyWords(island)} (you have ${coins(island.coins)}).`, target: 'end-turn' };
  }
  if (drifting) {
    return { say: `A chunk of land is drifting by. Save up ${coins(chunk)} to anchor it (you have ${coins(island.coins)}).`, target: 'end-turn' };
  }
  return { say: END_TURN_LINE, target: 'end-turn' };
}
