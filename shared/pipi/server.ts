/**
 * What the `pipi` server function will do with a request from a signed-in pupil (docs/PIPI-PLAN.md section 3, and
 * docs/EARLY-GAMES-PLAN.md section 7). The function (Stage 4) checks the sign-in and the rate first; the preview's trial
 * backend calls this with services that keep everything in the browser, so both run exactly the same rules.
 *
 *   load    the pupil's beach (a new pupil has none), the level they play next, the class's help setting and today's
 *           NZ date by the server's clock;
 *   start   reads the pupil's maths records, makes today's ten goes from a fresh seed (the level by the 70% rule, the
 *           kinds of go by the day's colour, the guided go first on the very first challenge) and keeps the round itself
 *           (any other open challenge is closed);
 *   finish  replays the taps on the kept round, records each go for the maths records (right only if the first shell
 *           picked was right), changes a shell on the first finish of the NZ day, and keeps the furthest level reached.
 *           A Golden Pearl is an achievement.
 *
 * Nothing that counts comes from the browser: the seed and the round are the server's, the day is the server's clock, and
 * the shells come from the saved count of finished days. A challenge finishes once.
 */
import { juniorAfterAnswer } from '../juniorQuick';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { replay, type Tap } from './play';
import { kindsFromDays } from './seen';
import { mergeSeen, readKinds, type SeenServices } from '../kit/seen';
import { beachAfter, finishChallenge, nzDate } from './progress';
import { isLevel, isSeed, levelFor, makeRound, MAX_SEED, topSecure, type Level, type Round } from './round';

export type PipiAction = 'load' | 'start' | 'finish' | 'seen';

/** Every kind of go this game has (not only the ones that have a demo). */
export const KINDS = ['hiding', 'altogether', 'twoTides'] as const;

/** A pupil's beach as it is saved. */
export interface Progress {
  daysDone: number;
  /** The NZ day ('2026-11-04') a shell last changed. */
  lastShellDay: string | null;
  /** The furthest level reached: the child never drops back below it. */
  reached: Level;
  /** Challenges finished, any day (0: the next one starts with the guided go). */
  played: number;
}

export interface Saved extends Progress {
  /** Goes up by one on every save; a save is kept only if it still matches (0: never saved). */
  version: number;
}

export const unplayed = (): Saved => ({ daysDone: 0, lastShellDay: null, reached: 1, played: 0, version: 0 });

/** The class's settings for the game (null if they can't be read). */
export interface Settings {
  enabled: boolean;
  /** The teacher can turn the help in the sand (the frame and the outlines) off for the class. */
  help: boolean;
}

export interface PipiServices extends SeenServices {
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  /** The pupil's maths records (all packs; only the part-whole ones matter here). */
  facts(player: string): Promise<FactStats[] | 'busy'>;
  /** Keeps a new challenge (making the pupil's beach on their first go) and closes any other open one. False if the pupil has used this seed before. */
  start(player: string, round: Round): Promise<boolean | 'busy'>;
  /** One of this pupil's challenges by its seed, as kept. Null: not theirs, or never started. */
  round(player: string, seed: number): Promise<{ open: boolean; round: Round } | null | 'busy'>;
  /** Closes an open challenge and saves the progress, together. False if it was already closed or the version moved on. */
  finish(player: string, seed: number, version: number, progress: Progress, ending: { taps: Tap[]; mistakes: number }): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Tells the hub the pupil's Golden Pearls went up, so it gives the achievement. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
  random(): number;
  now(): number;
}

export interface PipiReply {
  status: number;
  body: Record<string, unknown>;
}

/** More taps than a child could make in one challenge (10 right goes and lots of wobbles). */
export const MAX_TAPS = 200;
/** The longest a tap is said to have taken (the maths records keep at most two minutes anyway). */
const MAX_TAP_MS = 600_000;
/** Tries at a save before giving up (another request saved in between). */
const TRIES = 4;

const ok = (body: Record<string, unknown>): PipiReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): PipiReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, 'The beach couldn’t be reached just now. Try again in a moment.');
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

export async function handlePipi(services: PipiServices, player: string, body: Record<string, unknown>): Promise<PipiReply> {
  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return no(403, 'Pipi’s Hidden Shells is not switched on for your class.', { code: 'game-off' });
  const today = () => nzDate(new Date(services.now()));

  if (body.action === 'load') {
    const [s, facts] = await Promise.all([services.load(player), services.facts(player)]);
    if (s === 'busy' || facts === 'busy') return busy();
    const saved = await services.seen(player);
    if (saved === 'busy') return busy();
    // A go's kind is not in the maths records, so children who have played for weeks are known by their days.
    const seen = mergeSeen(saved, kindsFromDays(s.daysDone, s.played));
    return ok({ daysDone: s.daysDone, lastShellDay: s.lastShellDay, today: today(), level: s.reached, help: settings.help, guided: s.played === 0, seen });
  }

  if (body.action === 'seen') {
    const kinds = readKinds(body.kinds, KINDS);
    if (!kinds) return unreadable();
    const seen = await services.markSeen(player, kinds);
    if (seen === 'busy') return busy();
    return ok({ seen });
  }

  if (body.action === 'start') {
    const [s, facts] = await Promise.all([services.load(player), services.facts(player)]);
    if (s === 'busy' || facts === 'busy') return busy();
    const colour = beachAfter(s.daysDone).today;
    for (let tries = 0; tries < TRIES; tries++) {
      const seed = Math.floor(services.random() * (MAX_SEED + 1));
      const round = makeRound(seed, facts, { level: s.reached, colour, guided: s.played === 0 });
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
    // The level for next time, from the records as this challenge leaves them. If they can't be read, it stays.
    const facts = await services.facts(player);
    for (let tries = 0; tries < TRIES; tries++) {
      const s = await services.load(player);
      if (s === 'busy') return busy();
      const levelBefore: Level = isLevel(kept.round.level) ? (Math.max(kept.round.level, s.reached) as Level) : s.reached;
      const result = finishChallenge(s.daysDone, s.lastShellDay, today());
      // The level moves only on the day's first finish. A replay still saves its answers, but keeps the level as it was:
      // facts improved on a replay can still count at the next day's first finish.
      const reached = facts === 'busy' || result.shellChanged === null ? s.reached : levelFor(withAnswers(facts, answers), levelBefore);
      const progress = { daysDone: result.daysDone, lastShellDay: result.lastShellDay, reached, played: s.played + 1 };
      const saved = await services.finish(player, seed, s.version, progress, { taps, mistakes: played.mistakes });
      if (saved === 'busy') return busy();
      if (saved) {
        // One answer a go, once per challenge, so a finish sent again never counts twice.
        await services.recordAnswers(player, `pipi:${seed}`, answers);
        if (result.pearl) await services.progressChanged(player);
        // The "what's next" card: the top level's records are secure once these answers are in.
        return ok({ ...result, firstRight: played.firstRight, level: reached, levelBefore: kept.round.level, topSecure: facts !== 'busy' && topSecure(withAnswers(facts, answers)) });
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
