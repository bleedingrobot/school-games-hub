/**
 * Which question an attack asks. The attacking monster's topic, at the band for the area's
 * difficulty. EASY TO EDIT: each topic has twelve numbers, one for each half-area
 * (area 1 near town, area 1 far side and Tower, area 2 near, ...). A number is that topic's
 * band (times tables: campaign level 1-10; the others: band 1-4 or 1-5).
 */
import type { TopicId } from '../maths/skillPacks';

export const AREA_COUNT = 6;

export const BAND_TABLE: Record<TopicId, readonly number[]> = {
  //                  area1  area2  area3  area4  area5  area6
  'place-value':  [1, 1,  1, 2,  2, 2,  3, 3,  3, 4,  4, 4],
  'add-sub':      [1, 1,  1, 2,  2, 2,  3, 3,  3, 4,  4, 4],
  'times-tables': [1, 2,  3, 4,  4, 5,  6, 7,  8, 9,  9, 10],
  division:       [1, 1,  2, 2,  3, 3,  4, 4,  4, 5,  5, 5],
  fractions:      [1, 1,  1, 2,  2, 2,  3, 3,  3, 4,  4, 4],
  decimals:       [1, 1,  1, 2,  2, 2,  3, 3,  3, 4,  4, 4],
};

/** The band for a topic in an area (1 to 6). `far` is the far half of the area and its Tower. */
export function bandFor(topic: TopicId, area: number, far: boolean): number {
  const a = Math.min(Math.max(Math.round(area), 1), AREA_COUNT);
  return BAND_TABLE[topic][(a - 1) * 2 + (far ? 1 : 0)];
}

/** Wild monster levels in each area [lowest, highest]. Tower trainers use the highest + 2. */
export const AREA_LEVELS: readonly (readonly [number, number])[] = [
  [2, 6], [7, 12], [13, 19], [20, 27], [28, 36], [37, 45],
];

/**
 * A correct answer within this many seconds counts as quick. Judged by how hard the question is
 * (topic and band), not as a race against anyone: base + perBand × (band − 1).
 */
export const QUICK_SECONDS: Record<TopicId, { base: number; perBand: number }> = {
  'place-value': { base: 6, perBand: 2 },
  'add-sub': { base: 5, perBand: 3 },
  'times-tables': { base: 3.5, perBand: 0.8 },
  division: { base: 5, perBand: 2.5 },
  fractions: { base: 8, perBand: 3 },
  decimals: { base: 7, perBand: 3 },
};

export const quickSeconds = (topic: TopicId, band: number) =>
  QUICK_SECONDS[topic].base + QUICK_SECONDS[topic].perBand * (band - 1);
