/**
 * What the `pigeon` server function does with a request from a signed-in pupil (docs/PIGEON-PLAN.md, Pigeon's Number Line).
 * The function (supabase/functions/pigeon/handler.ts) checks the sign-in and the rate first; the preview's trial backend
 * calls this with services that keep everything in the browser, so both run exactly the same rules. Copied from
 * Weka's Stepping Stones (shared/weka/server.ts).
 *
 *   load    the pupil's branch (a new pupil has none), their step and help level, the class's help setting and today's
 *           NZ date by the server's clock;
 *   start   reads the pupil's maths records, makes today's ten goes from a fresh seed (the ways from their step, the
 *           pictures from their help level and the teacher's setting, 10 and 2 first on the very first challenge; a
 *           child who already knows most facts starts at step 3, help level 2) and keeps the round;
 *   finish  replays the taps on the kept round, records each fact once (right only if the first tap was right),
 *           changes a berry cluster on the first finish of the NZ day and, on that counted finish only, moves the help level
 *           and the step by how many goes were right at the first tap.
 *
 * Nothing that counts comes from the browser. A challenge finishes once.
 */
import type { FactAnswer, FactStats } from '../maths/leitner';
import { replay, type Tap } from './play';
import { finishChallenge, nzDate } from './progress';
import { isSeed, kindOfKey, makeRound, MAX_SEED, placeAfter, startFor, type HelpSetting, type Place, type Round } from './round';
import { TOP_LEVEL } from './config';
import { kindsFromFacts, mergeSeen, readKinds } from '../kit/seen';

export type PigeonAction = 'load' | 'start' | 'finish' | 'seen';

/** Every kind of go this game has (not only the one with a demo); kind names never change once shipped. */
export const ALLOWED_KINDS = ['place', 'read', 'tens', 'near', 'zoom'] as const;

/** A pupil's tree as it is saved. */
export interface Progress extends Place {
  daysDone: number;
  /** The NZ day ('2026-11-04') a flower last changed. */
  lastDay: string | null;
}

export interface Saved extends Progress {
  /** Goes up by one on every save; a save is kept only if it still matches (0: never saved). */
  version: number;
}

export const unplayed = (): Saved => ({ daysDone: 0, lastDay: null, step: 1, level: TOP_LEVEL as Place['level'], goodInRow: 0, goodAtStep: 0, version: 0 });

export { HELP_SETTINGS } from './round';

export interface Settings {
  enabled: boolean;
  /** The teacher's picture help: 'fade' (follows the child), 'always' (every berry) or 'off' (numbers only, no Peek). */
  help: HelpSetting;
}

export interface PigeonServices {
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** The pupil's maths records (all packs; only the "ten and" facts matter here). */
  facts(player: string): Promise<FactStats[] | 'busy'>;
  /**
   * Keeps a new challenge and closes any other open one. On the pupil's first go it makes their branch, starting at the
   * round's step and help level (step 3, level 2 for a child who already knew it). False if the pupil has used this seed before.
   */
  start(player: string, round: Round): Promise<boolean | 'busy'>;
  /** One of this pupil's challenges by its seed, as kept. Null: not theirs, or never started. */
  round(player: string, seed: number): Promise<{ open: boolean; round: Round } | null | 'busy'>;
  /** Closes an open challenge and saves the progress, together. False if it was already closed or the version moved on. */
  finish(player: string, seed: number, version: number, progress: Progress, ending: { taps: Tap[]; mistakes: number; firstRight: number }): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** The kinds of go this pupil has seen (a demo played, or a go of the kind finished). */
  seen(player: string): Promise<string[] | 'busy'>;
  /** Adds kinds to that list and returns the new list. */
  markSeen(player: string, kinds: string[]): Promise<string[] | 'busy'>;
  /** Tells the hub the pupil's Golden Nests went up, so it gives the achievement. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
  random(): number;
  now(): number;
}

export interface PigeonReply {
  status: number;
  body: Record<string, unknown>;
}

/** More taps than a child could make in one challenge (10 right goes and lots of wobbles). */
export const MAX_TAPS = 200;
const MAX_TAP_MS = 600_000;
const TRIES = 4;

const ok = (body: Record<string, unknown>): PigeonReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): PigeonReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, 'The branch couldn’t be reached just now. Try again in a moment.');
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

/** Where a pupil is: their saved place, or (never played) where their records say they start. */
function placeOf(s: Saved, facts: FactStats[]): Place {
  if (s.version > 0) return { step: s.step, level: s.level, goodInRow: s.goodInRow, goodAtStep: s.goodAtStep };
  return { ...startFor(facts), goodInRow: 0, goodAtStep: 0 };
}

export async function handlePigeon(services: PigeonServices, player: string, body: Record<string, unknown>): Promise<PigeonReply> {
  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return no(403, 'Pigeon’s Number Line is not switched on for your class.', { code: 'game-off' });
  const today = () => nzDate(new Date(services.now()));

  if (body.action === 'load') {
    const [s, facts, saved] = await Promise.all([services.load(player), services.facts(player), services.seen(player)]);
    if (s === 'busy' || facts === 'busy' || saved === 'busy') return busy();
    const place = placeOf(s, facts);
    // A child who has played for weeks has seen what their records show, so gets no demo for it.
    const seen = mergeSeen(saved, kindsFromFacts(facts, kindOfKey));
    return ok({ daysDone: s.daysDone, lastDay: s.lastDay, today: today(), step: place.step, level: place.level, help: settings.help, seen });
  }

  if (body.action === 'seen') {
    const kinds = readKinds(body.kinds, ALLOWED_KINDS);
    if (!kinds) return unreadable();
    const seen = await services.markSeen(player, kinds);
    if (seen === 'busy') return busy();
    return ok({ seen });
  }

  if (body.action === 'start') {
    const [s, facts] = await Promise.all([services.load(player), services.facts(player)]);
    if (s === 'busy' || facts === 'busy') return busy();
    const { step, level } = placeOf(s, facts);
    const guided = s.daysDone === 0 && s.lastDay === null;
    for (let tries = 0; tries < TRIES; tries++) {
      const seed = Math.floor(services.random() * (MAX_SEED + 1));
      const round = makeRound(seed, facts, { step, level, help: settings.help, guided });
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
    for (let tries = 0; tries < TRIES; tries++) {
      const s = await services.load(player);
      if (s === 'busy') return busy();
      const before: Place = { step: s.step, level: s.level, goodInRow: s.goodInRow, goodAtStep: s.goodAtStep };
      const result = finishChallenge(s.daysDone, s.lastDay, today());
      // Only the day's first finish moves the help and the step; play-again goes later that day never do.
      const place = result.clusterChanged === null ? before : placeAfter(before, played.firstRight);
      const progress: Progress = { daysDone: result.daysDone, lastDay: result.lastDay, ...place };
      const saved = await services.finish(player, seed, s.version, progress, { taps, mistakes: played.mistakes, firstRight: played.firstRight });
      if (saved === 'busy') return busy();
      if (saved) {
        // One answer a fact, once per challenge, so a finish sent again never counts twice.
        await services.recordAnswers(player, `pigeon:${seed}`, answers);
        if (result.goldenBranch) await services.progressChanged(player);
        return ok({ ...result, firstRight: played.firstRight, step: place.step, level: place.level, stepBefore: before.step, levelBefore: before.level });
      }
      const again = await services.round(player, seed);
      if (again === 'busy') return busy();
      if (!again?.open) return no(409, 'That challenge has finished.', { code: 'ended' });
    }
    return busy();
  }

  return unreadable();
}
