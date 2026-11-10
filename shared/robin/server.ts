/**
 * What the `robin` server function does with a request from a signed-in pupil (docs/ROBIN-PLAN.md, Robin's Berry Basket).
 * The function (supabase/functions/robin/handler.ts) checks the sign-in and the rate first; the preview's trial backend
 * calls this with services that keep everything in the browser, so both run exactly the same rules. Copied from
 * Parrot's See-saw (shared/parrot/server.ts).
 *
 *   load    the pupil's baskets (a new pupil has none), their step and help level, the class's help setting and today's
 *           NZ date by the server's clock;
 *   start   reads the pupil's maths records, makes today's ten goes from a fresh seed (the keys from their step, the
 *           help from their help level and the teacher's setting, "give me four" first on the very first challenge;
 *           everyone starts at step 1, help level 5) and keeps the round;
 *   finish  replays the taps on the kept round, records each key once (right only if the first tap was right),
 *           changes a basket on the first finish of the NZ day and, on that counted finish only, moves the help level
 *           and the step by how many goes were right at the first tap.
 *
 * Nothing that counts comes from the browser. A challenge finishes once.
 */
import type { FactAnswer, FactStats } from '../maths/leitner';
import { replay, slipsOf, type Tap } from './play';
import { finishChallenge, nzDate, placeAfter } from './progress';
import { fadeByKind, HELP_SETTINGS, ROUND_OF_TEN, type HelpSetting, type KindLevels } from '../kit/help';
import { TOP_LEVEL, type HelpLevel, type Step } from './config';
import { goKindOf, isSeed, makeRound, MAX_SEED, startFor, type Round, type Slip } from './round';
import { kindsFromFacts, mergeSeen, readKinds } from '../kit/seen';

export { HELP_SETTINGS };

/** Where a child is: their step, help level and the good challenges counted towards the next change. */
export interface Place {
  step: Step;
  level: HelpLevel;
  goodInRow: number;
  goodAtStep: number;
}
const moved = (p: Place, right: number): Place => placeAfter(p, right) as Place;

export type RobinAction = 'load' | 'start' | 'finish' | 'seen';

/** Every kind of go this game has (not only the ones with a demo); kind names never change once shipped. */
export const ALLOWED_KINDS = ['give', 'howmany', 'counton'] as const;

/** A pupil's baskets as it is saved. */
export interface Progress extends Place {
  daysDone: number;
  /** The NZ day ('2026-11-04') a basket last changed. */
  lastDay: string | null;
  /** The help level and good rounds in a row for each kind of go; a kind not here starts at the whole-child level. */
  kindLevels: KindLevels;
}

export interface Saved extends Progress {
  /** Goes up by one on every save; a save is kept only if it still matches (0: never saved). */
  version: number;
}

export const unplayed = (): Saved => ({ daysDone: 0, lastDay: null, step: 1, level: TOP_LEVEL, goodInRow: 0, goodAtStep: 0, kindLevels: {}, version: 0 });


export interface Settings {
  enabled: boolean;
  /** The teacher's picture help: 'fade' (follows the child), 'always' (numbered slots) or 'off' (a free pile, no Peek). */
  help: HelpSetting;
}

export interface RobinServices {
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** The pupil's maths records (all packs; the counting keys decide which are asked first). */
  facts(player: string): Promise<FactStats[] | 'busy'>;
  /**
   * Keeps a new challenge and closes any other open one. On the pupil's first go it makes their baskets, starting at the
   * round's step and help level (always step 1, level 5). False if the pupil has used this seed before.
   */
  start(player: string, round: Round): Promise<boolean | 'busy'>;
  /** One of this pupil's challenges by its seed, as kept. Null: not theirs, or never started. */
  round(player: string, seed: number): Promise<{ open: boolean; round: Round } | null | 'busy'>;
  /** Closes an open challenge and saves the progress, together. False if it was already closed or the version moved on. */
  finish(player: string, seed: number, version: number, progress: Progress, ending: { taps: Tap[]; mistakes: number; firstRight: number; slips: (Slip | null)[] }): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Tells the hub the pupil's Golden Berry Feasts went up, so it gives the achievement. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
  /** The kinds of go this pupil has seen (a demo played, or a go of the kind finished). */
  seen(player: string): Promise<string[] | 'busy'>;
  /** Adds kinds to that list and returns the new list. */
  markSeen(player: string, kinds: string[]): Promise<string[] | 'busy'>;
  random(): number;
  now(): number;
}

export interface RobinReply {
  status: number;
  body: Record<string, unknown>;
}

/** More taps than a child could make in one challenge (10 right goes and lots of wobbles). */
export const MAX_TAPS = 200;
const MAX_TAP_MS = 600_000;
const TRIES = 4;

const ok = (body: Record<string, unknown>): RobinReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): RobinReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, 'The berry basket couldn’t be reached just now. Try again in a moment.');
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

export async function handleRobin(services: RobinServices, player: string, body: Record<string, unknown>): Promise<RobinReply> {
  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return no(403, 'Robin’s Berry Basket is not switched on for your class.', { code: 'game-off' });
  const today = () => nzDate(new Date(services.now()));

  if (body.action === 'load') {
    const [s, facts, saved] = await Promise.all([services.load(player), services.facts(player), services.seen(player)]);
    if (s === 'busy' || facts === 'busy' || saved === 'busy') return busy();
    const place = placeOf(s, facts);
    // A child who has played for weeks has seen what their records show, so gets no demo for it.
    const seen = mergeSeen(saved, kindsFromFacts(facts, goKindOf));
    return ok({ daysDone: s.daysDone, lastDay: s.lastDay, today: today(), step: place.step, level: place.level, kindLevels: s.kindLevels ?? {}, help: settings.help, seen });
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
    const kindLevels = s.kindLevels ?? {};
    const guided = s.daysDone === 0 && s.lastDay === null;
    for (let tries = 0; tries < TRIES; tries++) {
      const seed = Math.floor(services.random() * (MAX_SEED + 1));
      const round = makeRound(seed, facts, { step, level, help: settings.help, guided, kindLevels });
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
    const slips = slipsOf(kept.round, taps);
    // Each go and whether it was right at the first tap (no slip), for the help of each kind.
    const wentRight = kept.round.goes.map((g, i) => ({ kind: goKindOf(g.key) ?? 'give', right: slips[i] === null }));
    const at = services.now();
    const answers = played.answers.map((a) => ({ ...a, at }));
    for (let tries = 0; tries < TRIES; tries++) {
      const s = await services.load(player);
      if (s === 'busy') return busy();
      const before: Place = { step: s.step, level: s.level, goodInRow: s.goodInRow, goodAtStep: s.goodAtStep };
      const result = finishChallenge(s.daysDone, s.lastDay, today());
      // Only the day's first finish moves the help and the step; play-again goes later that day never do.
      const place = result.changed === null ? before : moved(before, played.firstRight);
      // The help for each kind of go moves on the same day's first finish only, and a later finish keeps what is stored.
      const stored = s.kindLevels ?? {};
      const kindLevels =
        result.changed === null
          ? stored
          : fadeByKind(stored, wentRight, { ...ROUND_OF_TEN, topLevel: TOP_LEVEL }, before.level);
      const progress: Progress = { daysDone: result.daysDone, lastDay: result.lastDay, ...place, kindLevels };
      const saved = await services.finish(player, seed, s.version, progress, { taps, mistakes: played.mistakes, firstRight: played.firstRight, slips });
      if (saved === 'busy') return busy();
      if (saved) {
        // One answer a fact, once per challenge, so a finish sent again never counts twice.
        await services.recordAnswers(player, `robin:${seed}`, answers);
        if (result.feast) await services.progressChanged(player);
        return ok({ ...result, firstRight: played.firstRight, step: place.step, level: place.level, kindLevels, stepBefore: before.step, levelBefore: before.level });
      }
      const again = await services.round(player, seed);
      if (again === 'busy') return busy();
      if (!again?.open) return no(409, 'That challenge has finished.', { code: 'ended' });
    }
    return busy();
  }

  return unreadable();
}
