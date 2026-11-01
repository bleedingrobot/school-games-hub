/**
 * What Bolt remembers on this device (docs/TRADER-HINTS-PLAN.md, section 8): never sent to the server. One key, wrapped
 * in try/catch like prefs.ts, so a locked-down browser just forgets.
 *
 * First Flight is kept for good. Everything else belongs to one season (`season`): a New Season is a new galaxy and a new
 * game, so the tips, the deal count, the buy prices and the last day played start again.
 */
const KEY = 'sgh-trader-coach';

/** First Flight in progress: the trade Bolt picked and where the pupil started from. */
export interface FlightRun {
  /** The good and planet Bolt picked for the first trade. */
  good: number;
  planet: number;
  /** Credits and jumps made when First Flight began (to work out the profit and spot the jump). */
  credits: number;
  jumps: number;
  /** Steps that end with a button press ("Let's go", "Got it"). */
  acks: string[];
}

/** What the goods in the hold cost: the price paid for each one (an average if bought in lots) and the planet. */
export interface Bought {
  each: number;
  from: number;
}

export interface CoachMemory {
  /** First Flight finished or skipped on this device. */
  flight: 'done' | 'skipped' | null;
  run: FlightRun | null;
  /** The season the rest belongs to. */
  season: number | null;
  /** First-time tips already shown (section 4). */
  tips: string[];
  /** Friendly-trader deals seen; after 3, Bolt's verdict waits behind "Help me decide" (5.4). */
  deals: number;
  /** What each good in the hold cost, by good (for the trip summary, 5.6). */
  boughtAt: Record<number, Bought>;
  /** The last NZ day played on this device (for the new-day welcome). */
  day: number | null;
}

export const EMPTY_COACH: CoachMemory = { flight: null, run: null, season: null, tips: [], deals: 0, boughtAt: {}, day: null };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function loadCoach(): CoachMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CoachMemory> | null;
    if (!raw || typeof raw !== 'object') return { ...EMPTY_COACH };
    const flight = raw.flight === 'done' || raw.flight === 'skipped' ? raw.flight : null;
    const r = raw.run;
    const run = r && num(r.good) && num(r.planet) && num(r.credits) && num(r.jumps)
      ? { good: r.good, planet: r.planet, credits: r.credits, jumps: r.jumps, acks: Array.isArray(r.acks) ? r.acks.filter((a) => typeof a === 'string') : [] }
      : null;
    const boughtAt: Record<number, Bought> = {};
    if (raw.boughtAt && typeof raw.boughtAt === 'object') {
      for (const [good, b] of Object.entries(raw.boughtAt)) {
        if (b && num(b.each) && num(b.from)) boughtAt[Number(good)] = { each: b.each, from: b.from };
      }
    }
    return {
      flight,
      run,
      season: num(raw.season) ? raw.season : null,
      tips: Array.isArray(raw.tips) ? raw.tips.filter((x) => typeof x === 'string') : [],
      deals: num(raw.deals) ? raw.deals : 0,
      boughtAt,
      day: num(raw.day) ? raw.day : null,
    };
  } catch {
    return { ...EMPTY_COACH };
  }
}

export function saveCoach(m: CoachMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Not remembered, that's all.
  }
}

/** The memory for this season: a new season keeps First Flight and starts the rest again. (No season yet: it's this one.) */
export function forSeason(m: CoachMemory, season: number): CoachMemory {
  if (m.season === season) return m;
  return m.season === null ? { ...m, season } : { ...EMPTY_COACH, flight: m.flight, run: m.run, season };
}

/**
 * Keep the buy prices up to date after the hold changed from `before` to `after`. A good bought at `price` each joins
 * what was already there at its average price (if that price is known); a good that has all gone is forgotten. A good
 * whose price isn't known (bought on another device) stays unknown until the hold is empty of it.
 */
export function noteHold(boughtAt: Record<number, Bought>, before: readonly number[], after: readonly number[], prices: Record<number, number>, planet: number): Record<number, Bought> {
  const next: Record<number, Bought> = { ...boughtAt };
  after.forEach((now, good) => {
    const was = before[good] ?? 0;
    if (now <= 0) {
      delete next[good];
      return;
    }
    if (now <= was) return;
    const price = prices[good];
    if (price === undefined) return;
    const old = next[good];
    if (was > 0 && !old) return;
    const each = was > 0 && old ? (old.each * was + price * (now - was)) / now : price;
    next[good] = { each, from: was > 0 && old && old.from !== planet ? old.from : planet };
  });
  return next;
}
