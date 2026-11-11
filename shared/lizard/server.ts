/**
 * What the `lizard` server function does with a request from a signed-in pupil (docs/LIZARD-PLAN.md, Lizard's Bundles).
 * The function (supabase/functions/lizard/handler.ts) checks the sign-in and the rate first; the preview's trial backend
 * calls this with services that keep everything in the browser, so both run exactly the same rules. Copied from
 * Weka's Stepping Stones (shared/weka/server.ts).
 *
 *   load    the pupil's den (a new pupil has none), their step and help level, the class's help setting and today's
 *           NZ date by the server's clock;
 *   start   reads the pupil's maths records, makes today's ten goes from a fresh seed (the ways from their step, the
 *           pictures from their help level and the teacher's setting, tying ten sticks first on the very first challenge; a
 *           child who already knows Tūī's "ten and" facts starts at step 2 or 3 with less help) and keeps the round;
 *   finish  replays the taps on the kept round, records each fact once (right only if the first try was right),
 *           changes a bundle on the first finish of the NZ day and, on that counted finish only, moves the help level
 *           and the step by how many goes were right at the first tap.
 *
 * Nothing that counts comes from the browser. A challenge finishes once.
 */
import { kindsFromFacts, mergeSeen, readKinds, type SeenServices } from '../kit/seen';
import type { FactAnswer, FactStats } from '../maths/leitner';
import { replay, type Tap } from './play';
import { finishChallenge, nzDate } from './progress';
import { isSeed, kindOfKey, makeRound, MAX_SEED, placeAfter, startFor, type HelpSetting, type Place, type Round } from './round';
import { fadeByKind, ROUND_OF_TEN, type KindLevels } from '../kit/help';
import { MAX_PICK, TOP_LEVEL } from './config';

export type LizardAction = 'load' | 'start' | 'finish' | 'seen';

/** Every kind of go the game has, so every one can be remembered, whether or not it has a demo. */
export const KINDS = ['build', 'read', 'bundle', 'swap', 'more'];

/** A pupil's den as it is saved. */
export interface Progress extends Place {
  daysDone: number;
  /** The NZ day ('2026-11-04') a bundle last changed. */
  lastDay: string | null;
  /** The help level of each kind of go (a kind not here yet starts at the child's own level). */
  kindLevels: KindLevels;
}

export interface Saved extends Progress {
  /** Goes up by one on every save; a save is kept only if it still matches (0: never saved). */
  version: number;
}

export const unplayed = (): Saved => ({ daysDone: 0, lastDay: null, step: 1, level: TOP_LEVEL as Place['level'], goodInRow: 0, goodAtStep: 0, kindLevels: {}, version: 0 });

export { HELP_SETTINGS } from './round';

export interface Settings {
  enabled: boolean;
  /** The teacher's picture help: 'fade' (follows the child), 'always' (the labelled mat, no counts) or 'off' (numbers only, no Peek). */
  help: HelpSetting;
}

export interface LizardServices extends SeenServices {
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** The pupil's maths records (all packs; only the "ten and" facts matter here). */
  facts(player: string): Promise<FactStats[] | 'busy'>;
  /**
   * Keeps a new challenge and closes any other open one. On the pupil's first go it makes their den, starting at the
   * round's step and help level (step 3, level 2 for a child who already knew it). False if the pupil has used this seed before.
   */
  start(player: string, round: Round): Promise<boolean | 'busy'>;
  /** One of this pupil's challenges by its seed, as kept. Null: not theirs, or never started. */
  round(player: string, seed: number): Promise<{ open: boolean; round: Round } | null | 'busy'>;
  /** Closes an open challenge and saves the progress, together. False if it was already closed or the version moved on. */
  finish(player: string, seed: number, version: number, progress: Progress, ending: { taps: Tap[]; mistakes: number; firstRight: number; slips: string[] }): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Tells the hub the pupil's Golden Rafts went up, so it gives the achievement. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
  random(): number;
  now(): number;
}

export interface LizardReply {
  status: number;
  body: Record<string, unknown>;
}

/** More taps than a child could make in one challenge (10 right goes and lots of wobbles). */
export const MAX_TAPS = 200;
const MAX_TAP_MS = 600_000;
const TRIES = 4;

const ok = (body: Record<string, unknown>): LizardReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): LizardReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, 'The den couldn’t be reached just now. Try again in a moment.');
const unreadable = () => no(400, 'That couldn’t be read.');

const isWhole = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;

function readTaps(v: unknown): Tap[] | null {
  if (!Array.isArray(v) || v.length > MAX_TAPS) return null;
  const taps: Tap[] = [];
  for (const t of v) {
    if (!t || typeof t !== 'object') return null;
    const { pick, ms } = t as Record<string, unknown>;
    if (!isWhole(pick, MAX_PICK) || !isWhole(ms, MAX_TAP_MS)) return null;
    taps.push({ pick, ms });
  }
  return taps;
}

/** Where a pupil is: their saved place, or (never played) where their records say they start. */
function placeOf(s: Saved, facts: FactStats[]): Place {
  if (s.version > 0) return { step: s.step, level: s.level, goodInRow: s.goodInRow, goodAtStep: s.goodAtStep };
  return { ...startFor(facts), goodInRow: 0, goodAtStep: 0 };
}

export async function handleLizard(services: LizardServices, player: string, body: Record<string, unknown>): Promise<LizardReply> {
  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return no(403, 'Lizard’s Bundles is not switched on for your class.', { code: 'game-off' });
  const today = () => nzDate(new Date(services.now()));

  if (body.action === 'load') {
    const [s, facts, saved] = await Promise.all([services.load(player), services.facts(player), services.seen(player)]);
    if (s === 'busy' || facts === 'busy' || saved === 'busy') return busy();
    const place = placeOf(s, facts);
    // Children who have played for weeks have already done what a demo would show.
    const seen = mergeSeen(saved, kindsFromFacts(facts, kindOfKey));
    return ok({ daysDone: s.daysDone, lastDay: s.lastDay, today: today(), step: place.step, level: place.level, kindLevels: s.kindLevels ?? {}, help: settings.help, seen });
  }

  if (body.action === 'seen') {
    const kinds = readKinds(body.kinds, KINDS);
    if (!kinds) return unreadable();
    const saved = await services.markSeen(player, kinds);
    if (saved === 'busy') return busy();
    return ok({ seen: saved });
  }

  if (body.action === 'start') {
    const [s, facts] = await Promise.all([services.load(player), services.facts(player)]);
    if (s === 'busy' || facts === 'busy') return busy();
    const { step, level } = placeOf(s, facts);
    const guided = s.daysDone === 0 && s.lastDay === null;
    for (let tries = 0; tries < TRIES; tries++) {
      const seed = Math.floor(services.random() * (MAX_SEED + 1));
      const round = makeRound(seed, facts, { step, level, help: settings.help, guided, kindLevels: s.kindLevels ?? {} });
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
      const place = result.bundleChanged === null ? before : placeAfter(before, played.firstRight);
      // The help for each kind of go moves on the same day's first finish only; later that day the saved map stays as it is.
      const stored = s.kindLevels ?? {};
      // A new step starts every kind afresh at the new whole-child level (rule 5: a new step starts with full help).
      const kindLevels =
        result.bundleChanged === null ? stored : place.step !== before.step ? {} : fadeByKind(stored, played.goes, { ...ROUND_OF_TEN, topLevel: TOP_LEVEL }, before.level);
      const progress: Progress = { daysDone: result.daysDone, lastDay: result.lastDay, ...place, kindLevels };
      const saved = await services.finish(player, seed, s.version, progress, { taps, mistakes: played.mistakes, firstRight: played.firstRight, slips: played.slips.flatMap((s) => (s.slip === 'other' ? [] : [s.slip])) });
      if (saved === 'busy') return busy();
      if (saved) {
        // One answer a fact, once per challenge, so a finish sent again never counts twice.
        await services.recordAnswers(player, `lizard:${seed}`, answers);
        if (result.goldenRaft) await services.progressChanged(player);
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
