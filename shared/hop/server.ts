/**
 * What the `hop` server function does with a request from a signed-in pupil (docs/HOP-PLAN.md, section 4). The function
 * (supabase/functions/hop/handler.ts) checks the sign-in and the rate first; the preview's trial backend calls this with
 * services that keep everything in the browser, so both run exactly the same rules.
 *
 *   load    the pupil's pond (a new pupil has none), the step they count in next, the class's step-label setting and
 *           today's NZ date by the server's clock;
 *   start   reads the pupil's maths records, makes today's ten hops from a fresh seed (the step by the 70% rule, counting
 *           back on gold days) and keeps the round itself (any other open challenge is closed);
 *   finish  replays the taps on the kept round, records each hop for the maths records (right only if the first glow-worm
 *           picked was right), changes a pad on the first finish of the NZ day, and keeps the furthest step reached.
 *           Load and finish also say whether the top step is secure, for the finish screen's signpost on (R8).
 *           A Golden Glow Jar is an achievement (Stage 4's migration counts jars from the finished days).
 *
 * Nothing that counts comes from the browser: the seed and the round are the server's, the day is the server's clock, and
 * the pads come from the saved count of finished days. A challenge finishes once.
 */
import { juniorAfterAnswer } from '../juniorQuick';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { kindsFromFacts, mergeSeen, readKinds } from '../kit/seen';
import { replay, type Tap } from './play';
import { finishChallenge, nzDate, pondAfter } from './progress';
import { HOP_KINDS, isSeed, isStep, kindOfKey, makeRound, MAX_SEED, stepFor, topSecure, type HopStep, type Round } from './round';

export type HopAction = 'load' | 'start' | 'finish' | 'seen';

/** A pupil's pond as it is saved. */
export interface Progress {
  daysDone: number;
  /** The NZ day ('2026-11-04') a pad last changed. */
  lastPadDay: string | null;
  /** The furthest step reached: the child never drops back below it. */
  reached: HopStep;
}

export interface Saved extends Progress {
  /** Goes up by one on every save; a save is kept only if it still matches (0: never saved). */
  version: number;
}

export const unplayed = (): Saved => ({ daysDone: 0, lastPadDay: null, reached: 10, version: 0 });

/** The class's settings for the game (null if they can't be read). */
export interface Settings {
  enabled: boolean;
  /** The teacher can turn the hops' step labels ("+2") off for the class. */
  labels: boolean;
}

export interface HopServices {
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** The pupil's maths records (all packs; only the skip-counting ones matter here). */
  facts(player: string): Promise<FactStats[] | 'busy'>;
  /** Keeps a new challenge (making the pupil's pond on their first go) and closes any other open one. False if the pupil has used this seed before. */
  start(player: string, round: Round): Promise<boolean | 'busy'>;
  /** One of this pupil's challenges by its seed, as kept. Null: not theirs, or never started. */
  round(player: string, seed: number): Promise<{ open: boolean; round: Round } | null | 'busy'>;
  /** Closes an open challenge and saves the progress, together. False if it was already closed or the version moved on. */
  finish(player: string, seed: number, version: number, progress: Progress, ending: { taps: Tap[]; mistakes: number }): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Tells the hub the pupil's Golden Glow Jars went up, so it gives the achievement. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
  /** The kinds of hop this pupil has seen (a demo played, or a hop of the kind finished). */
  seen(player: string): Promise<string[] | 'busy'>;
  /** Adds kinds to that list and returns the new list. */
  markSeen(player: string, kinds: string[]): Promise<string[] | 'busy'>;
  random(): number;
  now(): number;
}

export interface HopReply {
  status: number;
  body: Record<string, unknown>;
}

/** More taps than a child could make in one challenge (10 right hops and lots of wobbles). */
export const MAX_TAPS = 200;
/** The longest a tap is said to have taken (the maths records keep at most two minutes anyway). */
const MAX_TAP_MS = 600_000;
/** Tries at a save before giving up (another request saved in between). */
const TRIES = 4;

const ok = (body: Record<string, unknown>): HopReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): HopReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, 'The pond couldn’t be reached just now. Try again in a moment.');
const unreadable = () => no(400, 'That couldn’t be read.');

const isWhole = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;

function readTaps(v: unknown): Tap[] | null {
  if (!Array.isArray(v) || v.length > MAX_TAPS) return null;
  const taps: Tap[] = [];
  for (const t of v) {
    if (!t || typeof t !== 'object') return null;
    const { pick, ms } = t as Record<string, unknown>;
    if (!isWhole(pick, 1000) || !isWhole(ms, MAX_TAP_MS)) return null;
    taps.push({ pick, ms });
  }
  return taps;
}

/** The records after this challenge's answers, the way record_fact_answers will change them (early-facts' quick time). */
export function withAnswers(facts: readonly FactStats[], answers: readonly FactAnswer[]): FactStats[] {
  const byKey = new Map(facts.map((s) => [s.key, s]));
  for (const a of answers) byKey.set(a.key, juniorAfterAnswer(byKey.get(a.key) ?? newStats(a.key), a.correct, a.ms, a.at));
  return [...byKey.values()];
}

export async function handleHop(services: HopServices, player: string, body: Record<string, unknown>): Promise<HopReply> {
  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return no(403, 'Hop’s Glow-worm Pond is not switched on for your class.', { code: 'game-off' });
  const today = () => nzDate(new Date(services.now()));

  if (body.action === 'load') {
    const [s, facts, saved] = await Promise.all([services.load(player), services.facts(player), services.seen(player)]);
    if (s === 'busy' || facts === 'busy' || saved === 'busy') return busy();
    // A child who has played for weeks has seen what their records show, so gets no demo for it.
    const seen = mergeSeen(saved, kindsFromFacts(facts, kindOfKey));
    return ok({ daysDone: s.daysDone, lastPadDay: s.lastPadDay, today: today(), step: s.reached, topSecure: topSecure(facts, s.reached), labels: settings.labels, seen });
  }

  if (body.action === 'seen') {
    const kinds = readKinds(body.kinds, HOP_KINDS);
    if (!kinds) return unreadable();
    const seen = await services.markSeen(player, kinds);
    if (seen === 'busy') return busy();
    return ok({ seen });
  }

  if (body.action === 'start') {
    const [s, facts] = await Promise.all([services.load(player), services.facts(player)]);
    if (s === 'busy' || facts === 'busy') return busy();
    const gold = pondAfter(s.daysDone).gold;
    for (let tries = 0; tries < TRIES; tries++) {
      const seed = Math.floor(services.random() * (MAX_SEED + 1));
      const round = makeRound(seed, facts, { step: s.reached, gold });
      const kept = await services.start(player, round);
      if (kept === 'busy') return busy();
      if (kept) return ok({ round });
    }
    return busy();
  }

  if (body.action === 'finish') {
    const seed = body.seed;
    const taps = readTaps(body.taps);
    if (!isSeed(seed) || !taps) return unreadable();
    const kept = await services.round(player, seed);
    if (kept === 'busy') return busy();
    if (!kept) return no(409, 'That isn’t one of your challenges.', { code: 'not-yours' });
    if (!kept.open) return no(409, 'That challenge has finished.', { code: 'ended' });
    let played;
    try {
      played = replay(kept.round, taps);
    } catch {
      return unreadable();
    }
    if (!played.done) return no(400, 'That challenge isn’t finished yet.', { code: 'not-done' });
    const at = services.now();
    const answers = played.answers.map((a) => ({ ...a, at }));
    // The step for next time, from the records as this challenge leaves them. If they can't be read, it stays.
    const facts = await services.facts(player);
    for (let tries = 0; tries < TRIES; tries++) {
      const s = await services.load(player);
      if (s === 'busy') return busy();
      const stepBefore = isStep(kept.round.step) ? kept.round.step : s.reached;
      const result = finishChallenge(s.daysDone, s.lastPadDay, today());
      // The level moves only on the day's first finish. A replay still saves its answers, but keeps the level as it was: facts
      // improved on a replay can still count at the next day's first finish.
      const reached = facts === 'busy' || result.padChanged === null ? s.reached : stepFor(withAnswers(facts, answers), stepBefore);
      const progress = { daysDone: result.daysDone, lastPadDay: result.lastPadDay, reached };
      const saved = await services.finish(player, seed, s.version, progress, { taps, mistakes: played.mistakes });
      if (saved === 'busy') return busy();
      if (saved) {
        // One answer a hop, once per challenge, so a finish sent again never counts twice.
        await services.recordAnswers(player, `hop:${seed}`, answers);
        if (result.jar) await services.progressChanged(player);
        const secureNow = facts === 'busy' ? false : topSecure(withAnswers(facts, answers), reached);
        return ok({ ...result, step: reached, stepBefore, topSecure: secureNow });
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
