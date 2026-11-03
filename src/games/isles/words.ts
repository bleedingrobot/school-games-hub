/**
 * What Sky Isles' screens say, worked out from the shared rules (shared/isles/engine.ts) so the numbers are always the
 * ones the server plays: what a building makes, why a button is greyed out, the collect sum and the island report.
 * Words are kept plain, for a 9-year-old reading on their own.
 */
import {
  BREEZE_SPEED, BUILD_COINS, COINS, GIFTS, GRAND_ISLE, HOUSE_ROOM, LIGHTHOUSE, WORKSHOP_CRYSTALS, type DecorationId,
  type GiftId, type PlotKind,
} from '../../../shared/isles/config';
import {
  beforeBuilding, chunkPrice, decoration, raisePrice, wholeCrystals, type Action, type Island, type Problem, type TurnReport,
} from '../../../shared/isles/engine';
import { KIND_NAME } from '../../../shared/isles/nextStep';
import type { RaceProblem } from '../../../shared/isles/race';
import { PROBLEM_TEXT, type NewsItem } from '../../../shared/isles/server';
import type { PostShown } from './backend';

export { KIND_NAME };

export const n = (v: number) => Math.round(v).toLocaleString('en-NZ');
export const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${Math.round(count) === 1 ? one : many}`;

/** Sky crystals in words, in quarters: "¾ of a sky crystal", "1¼ sky crystals". */
export function crystalWords(amount: number): string {
  const whole = Math.floor(amount);
  const part = ['', '¼', '½', '¾'][Math.round((amount - whole) * 4) % 4];
  if (!whole) return part ? `${part} of a sky crystal` : '0 sky crystals';
  return `${n(whole)}${part} sky crystal${whole === 1 && !part ? '' : 's'}`;
}

/** One line on what each kind of building is for. */
export const KIND_JOB: Record<PlotKind, string> = {
  farm: 'crops for coins',
  mine: 'the steady coin-maker',
  dock: '+1 sky-boat: a little faster in Sky Races',
  house: 'room for islanders to move in',
  workshop: 'slowly makes sky crystals',
  library: 'a pretty building that earns well',
};

/** A little picture for each decoration, used until its painting is in. */
export const DECOR_EMOJI: Record<DecorationId, string> = {
  flowers: '🌷', bench: '🪑', lantern: '🏮', cherry: '🌸', chimes: '🎐', bridge: '🌉', fountain: '⛲', balloon: '🎈',
  rainbow: '🌈', flags: '🚩', arch: '🌿', telescope: '🔭',
};

/** What the building on this spot makes each turn (with no fair wind). */
export function makes(island: Island, spot: number): string {
  const here = island.spots[spot];
  if (!here || here.kind === 'empty') return 'nothing yet: build something here';
  const coins = plural(COINS[here.kind] * here.level, 'coin');
  switch (here.kind) {
    case 'house':
      return `${coins} a turn, and room for ${HOUSE_ROOM * here.level} islanders`;
    case 'dock':
      return `${coins} a turn, and +${plural(here.level, 'sky-boat')}: a little faster in Sky Races`;
    case 'workshop':
      return `${coins} and ${crystalWords(WORKSHOP_CRYSTALS * here.level)} a turn`;
    default:
      return `${coins} a turn`;
  }
}

/** Coins and crystals, in words ("85 coins", "600 coins and 10 sky crystals"). */
export const priceWords = (coins: number, crystals: number) => (crystals ? `${n(coins)} coins and ${plural(crystals, 'sky crystal')}` : `${n(coins)} coins`);

/** What a choice costs: coins and crystals, or null for a free one. */
export function priceOf(island: Island, action: Action): { coins: number; crystals: number } | null {
  switch (action.kind) {
    case 'anchor':
      return { coins: chunkPrice(island), crystals: 0 };
    case 'build':
      return { coins: BUILD_COINS[action.plot], crystals: 0 };
    case 'raise':
      return raisePrice(island, action.spot);
    case 'decorate': {
      const d = decoration(action.id);
      return d ? { coins: d.coins, crystals: d.crystals } : null;
    }
    case 'lighthouse': {
      const stage = LIGHTHOUSE[island.lighthouse];
      return stage ? { coins: stage.coins, crystals: stage.crystals } : null;
    }
    default:
      return null;
  }
}

/** What a choice costs, in words, or null for a free one. */
export function costOf(island: Island, action: Action): string | null {
  const price = priceOf(island, action);
  return price ? priceWords(price.coins, price.crystals) : null;
}

/** Why a button is greyed out, with the numbers where there are some ("Needs 85 coins. You have 40."). */
export function whyNot(island: Island, action: Action, problem: Problem | RaceProblem): string {
  const price = priceOf(island, action);
  if (problem === 'not-enough-coins' && price) return `Needs ${plural(price.coins, 'coin')}. You have ${n(island.coins)}.`;
  if (problem === 'not-enough-crystals' && price) return `Needs ${plural(price.crystals, 'sky crystal')}. You have ${n(wholeCrystals(island))}.`;
  return PROBLEM_TEXT[problem];
}

/** The collect of a turn as sum lines: the working shown, never a question. */
export function collectLines(island: Island, windy: boolean): string[] {
  const { collected: c } = beforeBuilding(island, windy);
  const lines: string[] = [];
  const parts = (Object.keys(KIND_NAME) as PlotKind[]).filter((kind) => c.coins[kind]).map((kind) => `${n(c.coins[kind])} from ${KIND_NAME[kind]}s`);
  const made = parts.length ? (Object.values(c.coins) as number[]).reduce((a, b) => a + b, 0) : 0;
  if (parts.length > 1) lines.push(`Coins: ${parts.join(' + ')} = ${plural(made, 'coin')}`);
  else if (parts.length) lines.push(`Coins: ${parts[0]}`);
  if (c.wind) lines.push(`Fair wind: ${n(made)} + ${n(c.wind)} extra = ${plural(made + c.wind, 'coin')}`);
  if (c.crystals) lines.push(`Workshops: ${crystalWords(c.crystals)}`);
  if (!lines.length) lines.push('Nothing to collect yet. Build something!');
  return lines;
}
const WEATHER_TEXT = {
  rainbow: (a: number) => `A rainbow over the island! +${crystalWords(a)}.`,
  geese: (a: number) => `Golden geese flew by and dropped ${plural(a, 'coin')}!`,
  traveller: (a: number) => `${plural(a, 'lost traveller')} came to live on your island.`,
  breeze: () => `A warm breeze: +${BREEZE_SPEED} speed in your next Sky Race.`,
} as const;

/** The island report: what happened as the last turn ended. */
export function reportLines(report: TurnReport | undefined): string[] {
  if (!report) return [];
  const lines: string[] = [];
  if (report.weather) lines.push(WEATHER_TEXT[report.weather](report.weatherAmount));
  if (report.arrived) lines.push(`${plural(report.arrived, 'islander')} moved in.`);
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
    case 'decorate':
      return `Put up ${decoration(action.id)?.name ?? 'a decoration'}`;
    case 'move': {
      const placed = island.decorations[action.decoration];
      const name = (placed && decoration(placed.id)?.name) ?? 'a decoration';
      return action.place === null ? `Put ${name} on the shelf` : `Move ${name} to place ${action.place + 1}`;
    }
    case 'lighthouse':
      return `Build stage ${island.lighthouse + 1} of the Sky Lighthouse`;
  }
}

/** A little picture for each gift, used until its painting is in. */
export const GIFT_EMOJI: Record<GiftId, string> = { flowers: '💐', cake: '🎂', lantern: '🏮' };
export const giftName = (gift: GiftId) => GIFTS.find((g) => g.id === gift)?.name ?? 'a gift';

/** A gift or a classmate's race, as opened from the post. */
export function postLine(p: PostShown): string {
  if (p.kind === 'gift') return `${p.fromName} left you ${giftName(p.gift)}! +${plural(p.coins, 'coin')}`;
  return p.homeWin
    ? `${p.fromName} raced your island, and your island won at home! +${plural(p.coins, 'coin')} for racing well.`
    : `${p.fromName} raced your island. +${plural(p.coins, 'coin')} for racing well.`;
}

/** A line on the class news board: good news only. */
export function newsLine(item: NewsItem): string {
  const who = item.me ? 'You' : item.name;
  const whose = item.me ? 'your' : `${item.name}'s`;
  switch (item.kind) {
    case 'spots':
      return item.spots >= GRAND_ISLE ? `${item.me ? 'Your' : whose} island is a Grand Isle!` : `${item.me ? 'Your' : whose} island reached ${item.spots} building spots!`;
    case 'lighthouse':
      return `${who} lit the Sky Lighthouse!`;
    case 'decoration':
      return `New on ${whose} island: ${decoration(item.id)?.name ?? 'a decoration'}!`;
    case 'race':
      return item.gullRiders ? `${who} won a Sky Race against the Gull Riders!` : `${who} won a Sky Race!`;
  }
}

/** "today", "yesterday" or "3 days ago". */
export const daysAgo = (day: number, today: number) => (today - day <= 0 ? 'today' : today - day === 1 ? 'yesterday' : `${today - day} days ago`);
