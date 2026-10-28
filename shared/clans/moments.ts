/**
 * The maths moments in the shop, the Training Hall, the Church, on a building plan and at the barracks.
 * Each takes the real numbers (the actual price, tax, level, member count) and makes the
 * question from them, or returns null when the teacher has that topic switched off.
 *
 * A wrong answer never blocks anything: the caller shows the working and carries on with the
 * right amount, which is always `question.answer` (the tests check it matches what the engine
 * really charges). Maths here is how you check the bill, not a gate.
 */
import { buildQuestion, topicAvailable, topicOf, type PracticalKind, type PracticalQuestion, type PracticalSettings } from '../maths/practical';
import { CONFIG } from './config';
import { usableBonus } from './character';
import { planOf } from './empire';
import type { ItemDef, Member, VillageBuilding } from './types';

function moment(settings: PracticalSettings, kind: PracticalKind, nums: number[], labels?: [string, string], item?: string, about?: 'followers' | 'loot'): PracticalQuestion | null {
  if (!topicAvailable(settings, topicOf(kind))) return null;
  return buildQuestion(kind, nums, { labels, item, about });
}

/** Market: "Sword 240 gold, +10% tax: what do you pay?" The answer is the shop price. */
export const marketTotal = (settings: PracticalSettings, price: number, tax: number = CONFIG.shopTax, item?: string) => moment(settings, 'price-with-tax', [price, tax], undefined, item);

/** Market: what it costs to look at an item's real stats (25% of the price, rounded up). */
export const examineCostQuestion = (settings: PracticalSettings, price: number) => moment(settings, 'percent-of', [CONFIG.examinePercent, price]);

/** The note you pay with: 1,000 gold, or the next thousand if the bill is bigger. */
export const noteFor = (bill: number) => Math.max(1000, Math.ceil(bill / 1000) * 1000);

/** Market: change from 1,000 (or the next thousand up) for one or more things. */
export const marketChange = (settings: PracticalSettings, ...bills: number[]) => moment(settings, 'change', [noteFor(bills.reduce((t, b) => t + b, 0)), ...bills]);

/** The same, for one named thing you just bought ("the Dagger that costs 22 gold"). */
export const marketChangeFor = (settings: PracticalSettings, item: string, bill: number) => moment(settings, 'change', [noteFor(bill), bill], undefined, item);

/** What an item adds up to for "which is the better buy": the total of its usable bonuses (stats it gives). */
export const itemPoints = (member: Member, item: ItemDef) => Object.values(usableBonus(member, item)).reduce((t, v) => t + (v ?? 0), 0);

/** Market: which of two items is cheaper per point of bonus? Null if either gives nothing or they cost the same per point. */
export function betterBuy(settings: PracticalSettings, a: { name: string; price: number; points: number }, b: { name: string; price: number; points: number }): PracticalQuestion | null {
  if (a.points < 1 || b.points < 1 || a.price * b.points === b.price * a.points) return null;
  return moment(settings, 'better-buy', [a.price, a.points, b.price, b.points], [a.name, b.name]);
}

/** Training Hall: how many can you buy, and what is left over. Null if you can't afford even one. */
export function trainingBuy(settings: PracticalSettings, points: number, cost: number): { howMany: PracticalQuestion; leftOver: PracticalQuestion } | null {
  if (points < cost || cost < 1) return null;
  const howMany = moment(settings, 'share-whole', [points, cost]);
  const leftOver = moment(settings, 'share-left', [points, cost]);
  return howMany && leftOver ? { howMany, leftOver } : null;
}

/** Church: the bill for waking the members who have to pay (levels of those after any free wake-up). Null if nobody pays. */
export const churchBill = (settings: PracticalSettings, levels: number[]) => (levels.length === 0 || levels.length > 7 ? null : moment(settings, 'church-bill', [CONFIG.churchPerLevel, ...levels]));

/** Upgrade: the area of a building's plan, and the fence round it. The plan grows with the level it is being taken up to (`planOf`). */
export function landPlot(settings: PracticalSettings, building: VillageBuilding, level: number): { width: number; length: number; area: PracticalQuestion; fence: PracticalQuestion } | null {
  const { width, length } = planOf(building, level);
  const area = moment(settings, 'area', [width, length]);
  const fence = moment(settings, 'perimeter', [width, length]);
  return area && fence ? { width, length, area, fence } : null;
}

/** Barracks: how many do you need for this many troops? */
export const barracksNeeded = (settings: PracticalSettings, troops: number, capacity: number) => moment(settings, 'round-up', [troops, capacity]);

/** Troop costs: what a mixed bunch of troops costs. */
export const troopBill = (settings: PracticalSettings, footmen: number, axemen: number, knights: number) => moment(settings, 'troop-cost', [footmen, axemen, knights]);

/** Worker energy: how much of today's 100% is left after these buildings. (No longer used by the game: there is no worker energy in My Village.) */
export const energyLeft = (settings: PracticalSettings, ...used: number[]) => moment(settings, 'budget-left', [1, 100, ...used]);

/** Followers and the draft: "50 followers, 20% are drafted: how many join?" (No longer used by the game: followers join by themselves.) */
export const draftJoin = (settings: PracticalSettings, followers: number, percent: number) => (followers >= 1 && followers <= 5000 ? moment(settings, 'percent-of', [percent, followers], undefined, undefined, 'followers') : null);

/** Raids: "the treasury holds 600 gold and you ask for 10%: how much do you take?" The answer is what the raid really takes. */
export const lootShare = (settings: PracticalSettings, treasury: number, percent: number) => (treasury >= 1 && treasury <= 5000 && percent > 0 ? moment(settings, 'percent-of', [percent, treasury], undefined, undefined, 'loot') : null);

/** Fame: the points table going below zero (Year 6 only, since the topic only exists there). */
export const fameChange = (settings: PracticalSettings, start: number, change: number) => moment(settings, 'negative', [start, change]);

/** A troop ratio: "for every 2 axemen there are 3 footmen". */
export const troopRatio = (settings: PracticalSettings, axemen: number, footmen: number, haveAxemen: number) => moment(settings, 'ratio', [0, axemen, footmen, haveAxemen]);
