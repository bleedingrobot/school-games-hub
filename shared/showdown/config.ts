/**
 * Every Class Showdown tuning number (docs/SHOWDOWN-PLAN.md). Times are in milliseconds from the start of the round.
 * Boss health per class size and round length is tuned by the simulator and lives in `bossHealth.ts`.
 */
export const SHOWDOWN = {
  /** Round lengths the teacher can pick, in minutes (plan: 5, 10 or 15; default 10). */
  lengths: [5, 10, 15] as const,
  defaultLength: 10,

  /** One marked answer every 4 seconds per pupil at most, and a 2-second wait after a wrong one. */
  paceMs: 4000,
  wrongWaitMs: 2000,

  /** Points for a correct answer: the same for every pupil and every role (no speed bonus). */
  pointsPerCorrect: 10,
  /** Streaks: 3 in a row = 1.5x, 5 in a row = 2x, capped there. A wrong answer only resets the streak. */
  streaks: [
    { from: 5, times: 2 },
    { from: 3, times: 1.5 },
  ],

  /** Damage to the boss for one correct answer, before streak and event multipliers. */
  damage: { striker: 1, guard: 0.5, healer: 0.5 },

  /** Boss wind-up (shield check). */
  windUp: {
    /** How long pupils have to hold the shield. */
    ms: 15000,
    /**
     * Enough = this many correct answers per pupil playing (per team in team modes) within the 15 seconds; a pupil can
     * count more than once. The plan said "60% of the pupils", but with 15 seconds nearly every class managed that, so
     * the simulator tuned it to answers instead: a typical class holds about 2 shields in 3 to 4 in 5 (bigger classes more).
     */
    perPupil: 2.0,
    /** In solo, fewer than this share holding their own shield heals the boss. */
    soloHealShare: 0.6,
    /** A Guard's answer counts this many times. */
    guardCounts: 2,
    /** Outside a wind-up, each Guard answer banks this much towards the next one, up to `bankCap` of the target. */
    bankPerGuardAnswer: 0.25,
    bankCap: 0.1,
    /** A broken shield heals the boss by this share of its full health. */
    healShare: 0.1,
  },

  /** Dazed: stars spin for at most 5 seconds; a Healer's correct answer wakes a classmate at once. */
  dazedMs: 5000,

  /** Weak spot: hits count double for 10 seconds. */
  weakSpot: { ms: 10000, times: 2, catchUpTimes: 2.5 },

  /** Golden question: once a round, every pupil's next question is golden (their easiest skill), worth 3 hits. */
  golden: { ms: 20000, times: 3, boxes: [3, 4] as const },

  /** The boss changes form at these shares of its health left. */
  phases: [0.66, 0.33],
  /** After a phase change pupils may swap roles for this long. */
  roleSwapMs: 15000,

  /** The last 30 seconds: drumroll, glowing bars, last-hit camera. */
  finalMs: 30000,

  /** Teacher's enrage button: 20 seconds of angry boss, at most once a minute. */
  enrage: { ms: 20000, cooldownMs: 60000, times: 1.5, windUpMs: 10000, weakSpotMs: 15000 },

  /** The big-event schedule: one about every 60 to 90 seconds, none in the last 40 seconds. */
  schedule: { firstMs: [40000, 60000], gapMs: [60000, 90000], quietEndMs: 40000, goldenAt: [0.4, 0.7] },

  /** Catch-up help (never shown as help): the bottom quarter in solo, or the trailing team, gets lucky chests. */
  catchUp: { bottomShare: 0.25, chestEvery: 6, chestPoints: 10 },

  /** Pupils who haven't answered or joined in this long don't count towards the shield target. */
  idleMs: 60000,

  /** 4 teams: the boss turns to a new leader only when it's this many points ahead, and at most this often. */
  chase: { margin: 20, minMs: 15000 },

  /** 2 teams: how far one answer's damage can move the boss on the bridge is smoothed by this many damage points. */
  tugSoftness: 20,
  /** A tug event for the projector each time the boss moves this far. */
  tugStep: 0.1,

  /** Ranks are snapshot this often for the "best comeback" award (after the first minute). */
  rankEveryMs: 30000,

  /** Recap: 6 to 8 shout-outs to different pupils when possible. */
  awards: { min: 6, max: 8, carefulMinAnswers: 5, comebackMinPlaces: 3 },

  teams: { 2: ['red', 'blue'], 4: ['red', 'blue', 'gold', 'green'] } as const,
} as const;
