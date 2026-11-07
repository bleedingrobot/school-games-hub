/**
 * What the `beanstalk` server function does with a request from a signed-in pupil (docs/BEANSTALK-PLAN.md, section 5).
 * The function (supabase/functions/beanstalk/handler.ts) checks the sign-in and the rate first; the preview's trial
 * backend calls this with services that keep everything in the browser, so both run exactly the same rules.
 *
 *   load    the pupil's beanstalk (a new pupil has none), their dots help, the class's dots setting and today's NZ date by the server's clock;
 *   choose  be Jack or Jill;
 *   start   makes today's challenge from a fresh seed and keeps it (any other open challenge is closed);
 *   finish  replays the taps on the server's own round (its sum, 10, 100 or 1000, from the saved beanstalk), records
 *           the first tap of each go for the maths records (a wrong pair counts against the first leaf's pair; taps
 *           after it in the go are not scored, maths review R5), and changes a leaf on
 *           the first finish of the NZ day, and moves the child's dots help on that same finish (placeAfter, R6). A Golden Egg is an
 *           achievement (Stage 4's migration counts eggs from the finished days).
 *
 * Nothing that counts comes from the browser: the seed is the server's, the round is made again from it, the day is the
 * server's clock, and the leaves come from the saved count of finished days. A challenge finishes once.
 */
import type { FactAnswer } from '../maths/leitner';
import { finishChallenge, nzDate, placeAfter, stalkAfter, type FinishResult, type HelpLevel } from './progress';
import { makeRound, MAX_SEED, isSeed, replay, type Tap } from './round';

/** Who the child plays as: they choose on their first go (James, 4 Nov 2026). */
export type Child = 'jack' | 'jill';
export const isChild = (c: unknown): c is Child => c === 'jack' || c === 'jill';

export type BeanstalkAction = 'load' | 'choose' | 'start' | 'finish';

/** A pupil's beanstalk as it is saved. */
export interface Progress {
  child: Child | null;
  daysDone: number;
  /** The NZ day ('2026-11-04') a leaf last changed. */
  lastLeafDay: string | null;
  /** The leaves' dots for this child: 0 full, 1 small, 2 none (R6). Moves with how the day's first challenge went. */
  help: HelpLevel;
  /** Good challenges in a row so far (two take the dots down a step). */
  goodInRow: number;
}

/** What `finish` replies: the leaf and egg news, and the dots for the next challenge. */
export interface FinishReply extends FinishResult {
  help: HelpLevel;
}

export interface Saved extends Progress {
  /** Goes up by one on every save; a save is kept only if it still matches (0: never saved). */
  version: number;
}

export const unplayed = (): Saved => ({ child: null, daysDone: 0, lastLeafDay: null, help: 0, goodInRow: 0, version: 0 });

/** The class's settings for the game (null if they can't be read). */
export interface Settings {
  enabled: boolean;
  /** The teacher can turn the leaves' ten-frame dots off for the class. */
  dots: boolean;
}

export interface BeanstalkServices {
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** Saves who they play as (making their beanstalk if it's their first go). */
  choose(player: string, child: Child): Promise<boolean | 'busy'>;
  /** Keeps a new challenge and closes any other open one. False if the pupil has used this seed before. */
  start(player: string, seed: number): Promise<boolean | 'busy'>;
  /** One of this pupil's challenges by its seed: is it still open? Null: not theirs, or never started. */
  round(player: string, seed: number): Promise<{ open: boolean } | null | 'busy'>;
  /**
   * Closes an open challenge and saves the progress, together. False if it was already closed or the version moved on.
   */
  finish(player: string, seed: number, version: number, progress: Progress, ending: { taps: Tap[]; mistakes: number }): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Tells the hub the pupil's Golden Eggs went up, so it gives the achievement. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
  random(): number;
  now(): number;
}

export interface BeanstalkReply {
  status: number;
  body: Record<string, unknown>;
}

/** More taps than a child could make in one challenge (10 right pairs and lots of wobbles). */
export const MAX_TAPS = 200;
/** The longest a pair is said to have taken (the maths records keep at most two minutes anyway). */
const MAX_TAP_MS = 600_000;
/** Tries at a save before giving up (another request saved in between). */
const TRIES = 4;

const ok = (body: Record<string, unknown>): BeanstalkReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): BeanstalkReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, 'The beanstalk couldn’t be reached just now. Try again in a moment.');
const unreadable = () => no(400, 'That couldn’t be read.');

const isWhole = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;

function readTaps(v: unknown): Tap[] | null {
  if (!Array.isArray(v) || v.length > MAX_TAPS) return null;
  const taps: Tap[] = [];
  for (const t of v) {
    if (!t || typeof t !== 'object') return null;
    const { a, b, ms } = t as Record<string, unknown>;
    if (!isWhole(a, 1000) || !isWhole(b, 1000) || !isWhole(ms, MAX_TAP_MS)) return null;
    taps.push({ a, b, ms });
  }
  return taps;
}

export async function handleBeanstalk(services: BeanstalkServices, player: string, body: Record<string, unknown>): Promise<BeanstalkReply> {
  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return no(403, 'Kiwi’s Beanstalk is not switched on for your class.', { code: 'game-off' });
  const today = () => nzDate(new Date(services.now()));

  if (body.action === 'load') {
    const s = await services.load(player);
    if (s === 'busy') return busy();
    return ok({ child: s.child, daysDone: s.daysDone, lastLeafDay: s.lastLeafDay, today: today(), help: s.help, dots: settings.dots });
  }

  if (body.action === 'choose') {
    if (!isChild(body.child)) return unreadable();
    const done = await services.choose(player, body.child);
    if (done === 'busy' || !done) return busy();
    return ok({ child: body.child });
  }

  if (body.action === 'start') {
    const s = await services.load(player);
    if (s === 'busy') return busy();
    if (!s.child) return no(409, 'Choose Jack or Jill first.', { code: 'no-child' });
    for (let tries = 0; tries < TRIES; tries++) {
      const seed = Math.floor(services.random() * (MAX_SEED + 1));
      const kept = await services.start(player, seed);
      if (kept === 'busy') return busy();
      if (kept) return ok({ seed });
    }
    return busy();
  }

  if (body.action === 'finish') {
    const seed = body.seed;
    const taps = readTaps(body.taps);
    if (!isSeed(seed) || !taps) return unreadable();
    const round = await services.round(player, seed);
    if (round === 'busy') return busy();
    if (!round) return no(409, 'That isn’t one of your challenges.', { code: 'not-yours' });
    if (!round.open) return no(409, 'That challenge has finished.', { code: 'ended' });
    for (let tries = 0; tries < TRIES; tries++) {
      const s = await services.load(player);
      if (s === 'busy') return busy();
      // The sum comes from the saved beanstalk. It is the same as when the challenge started: starting one closes any
      // other, so no other finish can move the days on in between.
      let played;
      try {
        played = replay(makeRound(seed, stalkAfter(s.daysDone).target), taps);
      } catch {
        return unreadable();
      }
      if (!played.done) return no(400, 'That challenge isn’t finished yet.', { code: 'not-done' });
      const result = finishChallenge(s.daysDone, s.lastLeafDay, today());
      // The dots follow the child: counted from the pairs right at the first tap, on the day's first finish only.
      const place = placeAfter({ help: s.help, goodInRow: s.goodInRow }, played.answers.filter((a) => a.correct).length, result);
      const progress = { child: s.child, daysDone: result.daysDone, lastLeafDay: result.lastLeafDay, ...place };
      const kept = await services.finish(player, seed, s.version, progress, { taps, mistakes: played.mistakes });
      if (kept === 'busy') return busy();
      if (kept) {
        // One answer a go (its first tap), as bonds to 10, 100 or 1000: once per challenge, so a finish sent again never counts twice.
        const at = services.now();
        await services.recordAnswers(player, `beanstalk:${seed}`, played.answers.map((a) => ({ ...a, at })));
        if (result.egg) await services.progressChanged(player);
        return ok({ ...result, help: place.help });
      }
      // Closed by another request in between (sent twice), or another save moved the version on: look again.
      const again = await services.round(player, seed);
      if (again === 'busy') return busy();
      if (!again?.open) return no(409, 'That challenge has finished.', { code: 'ended' });
    }
    return busy();
  }

  return unreadable();
}
