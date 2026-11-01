/**
 * What Sky Isles' screens say, worked out from the shared rules (shared/isles/engine.ts) so the numbers are always the
 * ones the server plays: what a building makes, why a button is greyed out, the collect sum and the island report.
 * Words are kept plain, for a 9-year-old reading on their own.
 */
import { BUILD_COINS, FESTIVAL_COINS, LIGHTHOUSE, UPGRADES, type PlotKind } from '../../../shared/isles/config';
import {
  beforeSpending, chunkPrice, collect, raisePrice, room, type Action, type Island, type Problem, type TurnReport,
} from '../../../shared/isles/engine';
import { KIND_NAME } from '../../../shared/isles/nextStep';
import type { RaceProblem } from '../../../shared/isles/race';
import { PROBLEM_TEXT } from '../../../shared/isles/server';

export { KIND_NAME };

export const n = (v: number) => Math.round(v).toLocaleString('en-NZ');
export const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${Math.round(count) === 1 ? one : many}`;

/** One line on what each kind of building is for. */
export const KIND_JOB: Record<PlotKind, string> = {
  farm: 'grows food',
  mine: 'digs coins',
  dock: 'earns coins when your people are happy',
  house: 'gives people room to live',
  workshop: 'builds sky-boats and goods',
  library: 'thinks of ideas for upgrades',
};

/** What the building on this spot makes each turn (with no fair wind), worked out by the rules themselves. */
export function makes(island: Island, spot: number): string {
  const here = island.spots[spot];
  if (!here || here.kind === 'empty') return 'Nothing yet: build something here.';
  const without = { ...island, spots: island.spots.map((s, i) => (i === spot ? { kind: 'empty' as const, level: 0 } : s)) };
  const a = collect(island, false);
  const b = collect(without, false);
  switch (here.kind) {
    case 'farm':
      return `${plural(a.food - b.food, 'food', 'food')} a turn`;
    case 'mine':
      return `${plural(a.mine - b.mine, 'coin')} a turn`;
    case 'dock':
      return `about ${plural(a.dock - b.dock, 'coin')} a turn (more when people are happy)`;
    case 'house':
      return `room for ${plural(room(island) - room(without), 'person', 'people')}`;
    case 'workshop':
      return `work towards sky-boats and goods each turn`;
    case 'library':
      return `${a.ideas - b.ideas === 0.5 ? 'half an idea' : plural(a.ideas - b.ideas, 'idea')} a turn`;
  }
}

/** What a choice costs, in words ("85 coins", "120 coins and 6 goods"). */
export function costOf(island: Island, action: Action): string | null {
  const both = (coins: number, goods: number) => (goods ? `${n(coins)} coins and ${n(goods)} goods` : `${n(coins)} coins`);
  switch (action.kind) {
    case 'anchor':
      return both(chunkPrice(island), 0);
    case 'build':
      return both(BUILD_COINS[action.plot], 0);
    case 'raise': {
      const price = raisePrice(island, action.spot);
      return price ? both(price.coins, price.goods) : null;
    }
    case 'festival':
      return both(FESTIVAL_COINS, 0);
    case 'upgrade': {
      const u = UPGRADES.find((x) => x.id === action.id);
      return u ? plural(u.ideas, 'idea') : null;
    }
    case 'lighthouse': {
      const stage = LIGHTHOUSE[island.lighthouse];
      return stage ? both(stage.coins, stage.goods) : null;
    }
    default:
      return null;
  }
}

/** Why a button is greyed out, with the numbers where there are some ("Needs 85 coins. You have 40."). */
export function whyNot(island: Island, action: Action, problem: Problem | RaceProblem): string {
  const need = (what: string, needed: number, have: number, many = `${what}s`) => `Needs ${plural(needed, what, many)}. You have ${n(have)}.`;
  if (problem === 'not-enough-coins') {
    const cost =
      action.kind === 'anchor' ? chunkPrice(island)
      : action.kind === 'build' ? BUILD_COINS[action.plot]
      : action.kind === 'raise' ? raisePrice(island, action.spot)?.coins
      : action.kind === 'festival' ? FESTIVAL_COINS
      : action.kind === 'lighthouse' ? LIGHTHOUSE[island.lighthouse]?.coins
      : undefined;
    if (cost !== undefined) return need('coin', cost, island.coins);
  }
  if (problem === 'not-enough-goods') {
    const goods = action.kind === 'raise' ? raisePrice(island, action.spot)?.goods : action.kind === 'lighthouse' ? LIGHTHOUSE[island.lighthouse]?.goods : undefined;
    if (goods !== undefined) return need('goods', goods, island.goods, 'goods');
  }
  if (problem === 'not-enough-ideas' && action.kind === 'upgrade') {
    const u = UPGRADES.find((x) => x.id === action.id);
    if (u) return need('idea', u.ideas, island.ideas);
  }
  return PROBLEM_TEXT[problem];
}

/** The collect and feed of a turn as sum lines, so the planning is real maths too. */
export function collectLines(island: Island, windy: boolean): string[] {
  const { collected: c, eaten, hungryLeft } = beforeSpending(island, windy);
  const lines: string[] = [];
  const coinParts = [
    c.mine ? `${n(c.mine)} from Mines` : '',
    c.dock ? `${n(c.dock)} from Docks` : '',
    c.tax ? `${n(c.tax)} tax` : '',
  ].filter(Boolean);
  if (coinParts.length) lines.push(`Coins: ${coinParts.join(' + ')} = ${plural(c.mine + c.dock + c.tax, 'coin')}`);
  lines.push(`Food: ${n(c.food)} grown − ${n(eaten)} eaten = ${c.food - eaten >= 0 ? '+' : '−'}${n(Math.abs(c.food - eaten))}`);
  if (c.goods || c.boats) lines.push(`Workshops: ${[c.boats ? plural(c.boats, 'new sky-boat') : '', c.goods ? plural(c.goods, 'goods', 'goods') : ''].filter(Boolean).join(' and ')}`);
  if (c.ideas) lines.push(`Libraries: ${c.ideas === 0.5 ? 'half an idea' : plural(c.ideas, 'idea')}`);
  if (hungryLeft) lines.push(`There wasn't enough food, so ${plural(hungryLeft, 'person', 'people')} went to stay with a neighbour.`);
  return lines;
}

const WEATHER_TEXT = {
  rainbow: (a: number) => `A rainbow over the island! +${n(a)} food.`,
  geese: (a: number) => `Golden geese flew by and dropped ${plural(a, 'coin')}!`,
  fog: (a: number) => (a ? `Fog rolled in, and the Docks lost ${plural(-a, 'coin')} of visitors.` : 'Fog rolled in, but the Docks were quiet anyway.'),
  storm: (a: number) => (a ? `A storm blew ${plural(-a, 'food', 'food')} away.` : 'A storm blew past, and your Wind Wall kept the food safe.'),
  breeze: (a: number) => `A warm breeze: happiness +${n(a)}.`,
  traveller: (a: number) => `${plural(a, 'lost traveller')} came to live on your island.`,
} as const;

/** The island report: what happened as the last turn ended. */
export function reportLines(report: TurnReport | undefined): string[] {
  if (!report) return [];
  const lines: string[] = [];
  if (report.weather) lines.push(WEATHER_TEXT[report.weather](report.weatherAmount));
  if (report.arrived) lines.push(`${plural(report.arrived, 'newcomer')} moved in.`);
  if (report.left) lines.push(`${plural(report.left, 'person', 'people')} moved away.`);
  if (report.hungryLeft) lines.push(`${plural(report.hungryLeft, 'person', 'people')} left because food ran short.`);
  if (report.spoiled) lines.push(`${plural(report.spoiled, 'food', 'food')} went off in the store.`);
  if (!lines.length) lines.push('A calm turn. Everything went smoothly.');
  return lines;
}

/** A choice, as a line on the "Your choices" list. */
export function actionText(island: Island, action: Action): string {
  switch (action.kind) {
    case 'anchor':
      return 'Anchor a chunk of land';
    case 'build':
      return `Build a ${KIND_NAME[action.plot]} on spot ${action.spot + 1}`;
    case 'raise': {
      const here = island.spots[action.spot];
      return `Raise the ${here && here.kind !== 'empty' ? KIND_NAME[here.kind] : 'building'} on spot ${action.spot + 1}`;
    }
    case 'tax':
      return `Tax: ${action.level[0].toUpperCase()}${action.level.slice(1)}`;
    case 'workshop':
      return `Workshops: ${action.boatShare}% sky-boats`;
    case 'festival':
      return 'Hold a festival';
    case 'upgrade':
      return `Unlock ${UPGRADES.find((u) => u.id === action.id)?.name ?? 'an upgrade'}`;
    case 'lighthouse':
      return `Build stage ${island.lighthouse + 1} of the Sky Lighthouse`;
    case 'sell':
      return `Sell ${n(action.amount)} ${action.good}`;
    case 'buy':
      return `Buy ${n(action.amount)} ${action.good}`;
  }
}
