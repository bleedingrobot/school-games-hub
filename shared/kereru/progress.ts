/**
 * The ten berry clusters on the great branch at Kererū's Number Line: one cluster changes on each NZ day a child finishes
 * the challenge, bronze for days 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/KERERU-PLAN.md). Days are counted,
 * not dates, so a missed day loses nothing. Everything here comes from the count of finished days alone. The rules are the
 * game kit's day arc (shared/kit/dayArc.ts), in Kererū's words.
 */
import { arcAfter, daysPerReward, finishDay } from '../kit/dayArc';
import { BERRY_CLUSTERS } from './config';

export { nzDate } from '../kit/dayArc';

export const CLUSTERS = BERRY_CLUSTERS;
export const METALS = ['green', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten clusters, three changes each: thirty finished days to a Golden Berry Branch. */
export const DAYS_PER_BRANCH = daysPerReward(CLUSTERS);

/** Who flies the branch, in order: Kererū first, then a new friend's branch after each Golden Berry Branch. */
export const FRIENDS = ['kereru', 'tui', 'piwakawaka', 'korimako', 'kaka'] as const;
export type Friend = (typeof FRIENDS)[number];

export const FRIEND_NAMES: Record<Friend, string> = { kereru: 'Kererū', tui: 'Tūī', piwakawaka: 'Pīwakawaka', korimako: 'Korimako', kaka: 'Kākā' };

export interface Branch {
  /** Golden Berry Branches won so far. */
  prizes: number;
  friend: Friend;
  /** Finished days on this branch, 0 to 29. */
  day: number;
  /** Each cluster's colour, first cluster first. */
  clusters: Metal[];
  /** The kind of day the next challenge is: it sets the light (dawn, noon, golden evening). */
  today: Exclude<Metal, 'green'>;
}

export function branchAfter(daysDone: number): Branch {
  const { rewards, friend, day, row, today } = arcAfter<'green', Friend>(daysDone, { items: CLUSTERS, base: 'green', friends: FRIENDS });
  return { prizes: rewards, friend, day, clusters: row, today };
}

export interface FinishResult {
  daysDone: number;
  /** The NZ day the last cluster changed. */
  lastDay: string | null;
  /** Which cluster changed (0 is the first), or null when one already changed today. */
  clusterChanged: number | null;
  /** True when this finish turned the last cluster gold: a Golden Berry Branch. */
  goldenBranch: boolean;
}

/** A finished challenge: one cluster changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastDay: string | null, today: string): FinishResult {
  const { daysDone: done, lastDay: last, changed, reward } = finishDay(daysDone, lastDay, today, CLUSTERS);
  return { daysDone: done, lastDay: last, clusterChanged: changed, goldenBranch: reward };
}
