/**
 * Pipi's magic shells along the high-tide line: one shell changes on each NZ day a child finishes the challenge, bronze
 * for days 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/PIPI-PLAN.md section 1). Days are counted, not
 * dates, so a missed day loses nothing. Everything here comes from the count of finished days alone.
 *
 * Copied from Hop's Glow-worm Pond (shared/hop/progress.ts), as docs/EARLY-GAMES-PLAN.md section 7 says. When a third
 * early game needs it, the three can share one file.
 */

export const SHELLS = 10;
export const METALS = ['sand', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten shells, three changes each: thirty finished days to a Golden Pearl. */
export const DAYS_PER_PEARL = SHELLS * (METALS.length - 1);

/**
 * Whose beach it is, in order: Pipi first, then a new New Zealand friend's beach after each pearl (plan section 7). The
 * friends after Pipi are painted later, so these names can still change.
 */
export const FRIENDS = ['pipi', 'korora', 'tuatara', 'weta', 'kiwi', 'tui'] as const;
export type Friend = (typeof FRIENDS)[number];

/**
 * How much the sand helps (plan section 4): on bronze days the pipi sit in a five- or ten-frame and the hiding ones
 * leave an outline; on silver days the frame is gone and the outlines are faint; on gold days there are no outlines.
 */
export type Help = 'full' | 'faint' | 'none';

export interface Beach {
  /** Golden Pearls won so far. */
  pearls: number;
  friend: Friend;
  /** Finished days on this beach, 0 to 29. */
  day: number;
  /** Each shell's colour, left to right. */
  shells: Metal[];
  /** The kind of day the next challenge is. */
  today: Exclude<Metal, 'sand'>;
  help: Help;
}

const wholeCount = (n: number) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Bad day count ${n}`);
  return n;
};

export function beachAfter(daysDone: number): Beach {
  const pearls = Math.floor(wholeCount(daysDone) / DAYS_PER_PEARL);
  const day = daysDone % DAYS_PER_PEARL;
  const round = Math.floor(day / SHELLS);
  // In each round of ten days the shells change from the left.
  const shells = Array.from({ length: SHELLS }, (_, i) => METALS[round + (i < day % SHELLS ? 1 : 0)]);
  return {
    pearls,
    friend: FRIENDS[pearls % FRIENDS.length],
    day,
    shells,
    today: (['bronze', 'silver', 'gold'] as const)[round],
    help: (['full', 'faint', 'none'] as const)[round],
  };
}

/** NZ calendar day ('2026-11-04') of a moment, by the server clock. The same as Lord's `nzDate`. */
export const nzDate = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export interface FinishResult {
  daysDone: number;
  /** The NZ day the last shell changed. */
  lastShellDay: string | null;
  /** Which shell changed (0 is the left one), or null when a shell already changed today. */
  shellChanged: number | null;
  /** True when this finish turned the last shell gold. */
  pearl: boolean;
}

/** A finished challenge: one shell changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastShellDay: string | null, today: string): FinishResult {
  if (lastShellDay === today) return { daysDone: wholeCount(daysDone), lastShellDay, shellChanged: null, pearl: false };
  const next = wholeCount(daysDone) + 1;
  return { daysDone: next, lastShellDay: today, shellChanged: daysDone % SHELLS, pearl: next % DAYS_PER_PEARL === 0 };
}
