/**
 * Game kit: the day arc of a junior game (docs/plans/GAME-KIT-PLAN.md). A row of items (stones, pads, flowers): one changes
 * on each NZ day a child finishes the challenge, bronze for the first time along the row, then silver, then gold, then a
 * golden reward and a new friend. Days are counted, not dates, so a missed day loses nothing. The calendar is for rewards
 * and looks only, never for how much help a child gets (LEARNING-DESIGN rule 5).
 *
 * Games wrap these in their own words (`streamAfter`, `lastStoneDay`) and pass the row's length, what an item is before it
 * has changed, and the friends.
 */

export const DAY_METALS = ['bronze', 'silver', 'gold'] as const;
export type DayMetal = (typeof DAY_METALS)[number];

/** Finished days to a golden reward: once along the row for each metal. */
export const daysPerReward = (items: number): number => items * DAY_METALS.length;

/** NZ calendar day ('2026-11-04') of a moment, by the server clock. The same as Lord's `nzDate`. */
export const nzDate = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const wholeCount = (n: number) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Bad day count ${n}`);
  return n;
};

export interface ArcShape<Base, Friend> {
  /** How many items in the row. */
  items: number;
  /** What an item is before it has changed. */
  base: Base;
  /** Who comes next after each golden reward, in order; goes round again after the last. */
  friends: readonly Friend[];
}

export interface Arc<Base, Friend> {
  /** Golden rewards won so far. */
  rewards: number;
  friend: Friend;
  /** Finished days since the last reward. */
  day: number;
  /** Each item's colour, first item first. */
  row: (Base | DayMetal)[];
  /** The kind of day the next challenge is. */
  today: DayMetal;
}

/** Everything about the arc, from the count of finished days alone. */
export function arcAfter<Base, Friend>(daysDone: number, shape: ArcShape<Base, Friend>): Arc<Base, Friend> {
  const perReward = daysPerReward(shape.items);
  const rewards = Math.floor(wholeCount(daysDone) / perReward);
  const day = daysDone % perReward;
  const round = Math.floor(day / shape.items);
  const metals = [shape.base, ...DAY_METALS];
  return {
    rewards,
    friend: shape.friends[rewards % shape.friends.length],
    day,
    row: Array.from({ length: shape.items }, (_, i) => metals[round + (i < day % shape.items ? 1 : 0)]),
    today: DAY_METALS[round],
  };
}

export interface DayFinish {
  daysDone: number;
  /** The NZ day an item last changed. */
  lastDay: string | null;
  /** Which item changed (0 is the first), or null when one already changed today. */
  changed: number | null;
  /** True when this finish turned the last item gold. */
  reward: boolean;
}

/** A finished challenge: one item changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishDay(daysDone: number, lastDay: string | null, today: string, items: number): DayFinish {
  if (lastDay === today) return { daysDone: wholeCount(daysDone), lastDay, changed: null, reward: false };
  const next = wholeCount(daysDone) + 1;
  return { daysDone: next, lastDay: today, changed: daysDone % items, reward: next % daysPerReward(items) === 0 };
}
