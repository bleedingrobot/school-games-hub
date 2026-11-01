/**
 * What Bolt remembers on this device (docs/TRADER-HINTS-PLAN.md, section 8): never sent to the server. One key, wrapped
 * in try/catch like prefs.ts, so a locked-down browser just forgets.
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

export interface CoachMemory {
  /** First Flight finished or skipped on this device. */
  flight: 'done' | 'skipped' | null;
  run: FlightRun | null;
}

const EMPTY: CoachMemory = { flight: null, run: null };

export function loadCoach(): CoachMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CoachMemory> | null;
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    const flight = raw.flight === 'done' || raw.flight === 'skipped' ? raw.flight : null;
    const r = raw.run;
    const run = r && typeof r.good === 'number' && typeof r.planet === 'number' && typeof r.credits === 'number' && typeof r.jumps === 'number'
      ? { good: r.good, planet: r.planet, credits: r.credits, jumps: r.jumps, acks: Array.isArray(r.acks) ? r.acks.filter((a) => typeof a === 'string') : [] }
      : null;
    return { flight, run };
  } catch {
    return { ...EMPTY };
  }
}

export function saveCoach(m: CoachMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Not remembered, that's all.
  }
}
