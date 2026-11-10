/**
 * What the `beanstalk` server function does with a request from a signed-in pupil (docs/BEANSTALK-PLAN.md, section 5).
 * The function (supabase/functions/beanstalk/handler.ts) checks the sign-in and the rate first; the preview's trial
 * backend calls this with services that keep everything in the browser, so both run exactly the same rules.
 *
 *   load    the pupil's beanstalk (a new pupil has none), their dots help, the class's dots setting and today's NZ date by the server's clock;
 *   choose  be Jack or Jill;
 *   start   makes today's challenge from a fresh seed, the child's stage and their maths records, and keeps the round itself
 *           (any other open challenge is closed);
 *   finish  replays the taps on the kept round (its sums are the child's stage, with a few older pairs last), records
 *           the first tap of each go for the maths records (a wrong pair counts against the first leaf's pair; taps
 *           after it in the go are not scored, maths review R5), and changes a leaf on
 *           the first finish of the NZ day, and moves the child's dots help on that same finish (placeAfter, R6). A Golden Egg is an
 *           achievement (Stage 4's migration counts eggs from the finished days).
 *
 * The sum follows the child, not the calendar (S21): a saved stage moves up after two good days with the sum secure, and back
 * after two hard days (progress.ts: afterDay). The leaves, the egg and the friend still come from the count of finished days.
 *
 * Nothing that counts comes from the browser: the seed and the round are the server's, the day is the server's clock, and
 * the leaves come from the saved count of finished days. A challenge finishes once.
 */
import { juniorAfterAnswer, thoughtOf } from '../juniorQuick';
import { afterDay, finishChallenge, nzDate, placeAfter, START_STEPS, sumSecure, type FinishResult, type HelpLevel, type Steps } from './progress';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { readKinds, type SeenServices } from '../kit/seen';
import { isMissingGo, makeRound, makeStageRound, MAX_SEED, isSeed, replay, stageTarget, TARGETS, type Round, type Tap } from './round';

/** Who the child plays as: they choose on their first go (James, 4 Nov 2026). */
export type Child = 'jack' | 'jill';
export const isChild = (c: unknown): c is Child => c === 'jack' || c === 'jill';

export type BeanstalkAction = 'load' | 'choose' | 'start' | 'finish' | 'seen';

/** Every kind of go this game has a demo for: `missing`, the missing leaf ("7 + ? = 10"). */
export const KINDS: readonly string[] = ['missing'];

/** A pupil's beanstalk as it is saved. */
export interface Progress extends Steps {
  child: Child | null;
  daysDone: number;
  /** The NZ day ('2026-11-04') a leaf last changed. */
  lastLeafDay: string | null;
  /** The leaves' dots for this child: 0 full, 1 small, 2 none (R6). Moves with how the day's first challenge went. */
  help: HelpLevel;
  /** Good challenges in a row so far (two take the dots down a step). */
  goodInRow: number;
  /** The same two for the missing-leaf goes (S35); `help` and `goodInRow` are the pair goes. Old rows start equal to the pair kind. */
  helpMissing: HelpLevel;
  goodInRowMissing: number;
}

/** What `finish` replies: the leaf and egg news, and the dots for the next challenge. */
export interface FinishReply extends FinishResult {
  /** Goes right at the first tap (not a guess, the think floor), out of ten: the finish words follow it. */
  firstRight: number;
  help: HelpLevel;
  helpMissing: HelpLevel;
  /** The stage for the next challenge, and 1 if this finish moved the child up, -1 back, 0 stayed. */
  stage: Steps['stage'];
  moved: -1 | 0 | 1;
}

export interface Saved extends Progress {
  /** Goes up by one on every save; a save is kept only if it still matches (0: never saved). */
  version: number;
}

export const unplayed = (): Saved => ({ child: null, daysDone: 0, lastLeafDay: null, help: 0, goodInRow: 0, helpMissing: 0, goodInRowMissing: 0, ...START_STEPS, version: 0 });

/** The class's settings for the game (null if they can't be read). */
export interface Settings {
  enabled: boolean;
  /** The teacher can turn the leaves' ten-frame dots off for the class. */
  dots: boolean;
}

export interface BeanstalkServices extends SeenServices {
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** Saves who they play as (making their beanstalk if it's their first go). */
  choose(player: string, child: Child): Promise<boolean | 'busy'>;
  /** The pupil's maths records (the same ones every maths game reads). */
  facts(player: string): Promise<FactStats[] | 'busy'>;
  /** Keeps a new challenge, with its round, and closes any other open one. False if the pupil has used this seed before. */
  start(player: string, round: Round): Promise<boolean | 'busy'>;
  /**
   * One of this pupil's challenges by its seed: is it still open, and the round it was started with? Null: not theirs, or
   * never started. The round is null for a challenge started before rounds were kept.
   */
  round(player: string, seed: number): Promise<{ open: boolean; round: Round | null } | null | 'busy'>;
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

/** The records after this challenge's answers, the way record_fact_answers will change them (the juniors' quick time). */
export function withAnswers(facts: readonly FactStats[], answers: readonly FactAnswer[]): FactStats[] {
  const byKey = new Map(facts.map((f) => [f.key, f]));
  for (const a of answers) byKey.set(a.key, juniorAfterAnswer(byKey.get(a.key) ?? newStats(a.key), a.correct, a.ms, a.at));
  return [...byKey.values()];
}

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
    const seen = await services.seen(player);
    if (seen === 'busy') return busy();
    return ok({
      seen,
      child: s.child, daysDone: s.daysDone, lastLeafDay: s.lastLeafDay, today: today(), help: s.help, helpMissing: s.helpMissing, dots: settings.dots,
      stage: s.stage, stageDays: s.stageDays,
    });
  }

  if (body.action === 'seen') {
    const kinds = readKinds(body.kinds, KINDS);
    if (!kinds) return unreadable();
    const seen = await services.markSeen(player, kinds);
    if (seen === 'busy') return busy();
    return ok({ seen });
  }

  if (body.action === 'choose') {
    if (!isChild(body.child)) return unreadable();
    const done = await services.choose(player, body.child);
    if (done === 'busy' || !done) return busy();
    return ok({ child: body.child });
  }

  if (body.action === 'start') {
    const [s, facts] = await Promise.all([services.load(player), services.facts(player)]);
    if (s === 'busy' || facts === 'busy') return busy();
    if (!s.child) return no(409, 'Choose Jack or Jill first.', { code: 'no-child' });
    for (let tries = 0; tries < TRIES; tries++) {
      const seed = Math.floor(services.random() * (MAX_SEED + 1));
      const round = makeStageRound(seed, s.stage, facts);
      const kept = await services.start(player, round);
      if (kept === 'busy') return busy();
      if (kept) return ok({ seed, round });
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
      // The round is the one kept at the start. A challenge already open when rounds began to be kept has none: it is made
      // again from its seed on the child's stage (the same as the calendar's sum at that moment: migration back-fill).
      const kept = round.round ?? makeRound(seed, stageTarget(s.stage));
      let played;
      try {
        played = replay(kept, taps);
      } catch {
        return unreadable();
      }
      if (!played.done) return no(400, 'That challenge isn’t finished yet.', { code: 'not-done' });
      const result = finishChallenge(s.daysDone, s.lastLeafDay, today());
      const at = services.now();
      const answers = played.answers.map((a) => ({ ...a, at }));
      // Right at the first tap (and not a guess: the think floor), counted for the whole day and for each kind of go (S35).
      const isRight = (a: { correct: boolean; ms: number }) => a.correct && thoughtOf(a.ms);
      const rightFirst = played.answers.filter(isRight).length;
      const rightMissing = played.answers.filter((a, go) => isMissingGo(go) && isRight(a)).length;
      const rightPairs = rightFirst - rightMissing;
      // Which stage next: two good days with the sum secure move up, two hard days step back (progress.ts: afterDay). If the
      // records can't be read, nobody moves up (the child stays; a hard patch still steps back).
      const facts = await services.facts(player);
      const secure = facts !== 'busy' && sumSecure(withAnswers(facts, answers), TARGETS[s.stage]);
      const steps = afterDay(s, rightFirst, result.leafChanged !== null, secure);
      // The dots follow the child: counted from the pairs right at the first tap, on the day's first finish only, and start full on a new sum.
      // Pair goes and missing-leaf goes each have their own dots (S35); a new sum starts both at full.
      const counted = { leafChanged: result.leafChanged, stageChanged: steps.moved !== 0 };
      const place = placeAfter({ help: s.help, goodInRow: s.goodInRow }, rightPairs, counted, 'pair');
      const placeMissing = placeAfter({ help: s.helpMissing, goodInRow: s.goodInRowMissing }, rightMissing, counted, 'missing');
      const { moved, ...savedSteps } = steps;
      const progress = {
        child: s.child, daysDone: result.daysDone, lastLeafDay: result.lastLeafDay, ...place,
        helpMissing: placeMissing.help, goodInRowMissing: placeMissing.goodInRow, ...savedSteps,
      };
      const saved = await services.finish(player, seed, s.version, progress, { taps, mistakes: played.mistakes });
      if (saved === 'busy') return busy();
      if (saved) {
        // One answer a go (its first tap), as bonds to 10, 20, 100 or 1000: once per challenge, so a finish sent again never counts twice.
        await services.recordAnswers(player, `beanstalk:${seed}`, answers);
        if (result.egg) await services.progressChanged(player);
        return ok({ ...result, firstRight: rightFirst, help: place.help, helpMissing: placeMissing.help, stage: steps.stage, moved });
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
