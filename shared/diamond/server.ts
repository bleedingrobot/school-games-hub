/**
 * What the `diamond` server function does with a request from a signed-in pupil (docs/DIAMOND-PLAN.md, section 5).
 * The function (supabase/functions/diamond/handler.ts) checks the sign-in and the rate first; the preview's trial
 * backend calls this with services that keep everything in the browser, so both run exactly the same rules.
 *
 *   load        the pupil's progress (a new pupil starts at level 1) and the server's clock;
 *   levelStart  checks the level may start today, charges the boosts, makes the level's Hold on! questions (way A, from
 *               the pupil's focus) and keeps them with a fresh seed; sends the questions without their answers;
 *   answer      marks one Hold on! answer against the stored question, once, and records it for the maths records;
 *   levelEnd    replays the level from its seed, the recorded Drop ticks and the server's own marks, and saves what the
 *               replay says (a level ends once); gives points;
 *   buy, wear   the Claw Workshop.
 *
 * Nothing that counts comes from the browser: the seed, the questions and the marks are the server's, and the result is
 * the replay's. Progress is saved only if nothing else saved it in between (a version number), so two tabs can't both
 * spend the same coins.
 */
import type { FactAnswer } from '../maths/leitner';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, seededRandom, type MathsContext } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { BOOST_IDS, LAST_LEVEL, SLOTS, questionCap, type BoostId, type Slot } from './config';
import { playLevel, type LevelResult } from './engine';
import { applyResult, canStart, needsStarter, newPlayer, takeBoosts, type Player } from './progress';
import { buy, wear } from './workshop';

export type DiamondAction = 'load' | 'levelStart' | 'answer' | 'levelEnd' | 'buy' | 'wear';

/** A level as the server keeps it: the questions (with answers) never leave the server. */
export interface StoredLevel {
  seed: number;
  level: number;
  boosts: BoostId[];
  starter: boolean;
  questions: Question[];
}

export interface OpenLevel extends StoredLevel {
  /** The mark for each question slot answered so far (null: not answered). */
  marks: (boolean | null)[];
  /** Still waiting for its levelEnd. */
  open: boolean;
}

export interface Saved {
  player: Player;
  /** Goes up by one on every save; a save is kept only if it still matches. */
  version: number;
}

export interface DiamondServices {
  /** Is the game switched on for this pupil's class? Null if it can't be read. */
  enabled(player: string): Promise<boolean | null>;
  /** The pupil's maths records, the class's question settings and their focus (null if they can't be read). */
  mathsContext(player: string): Promise<MathsContext | null>;
  /** The pupil's progress (version 0 and a new player if they've never played). */
  load(player: string): Promise<Saved | 'busy'>;
  /**
   * Saves the progress after paying for boosts and keeps the new level (any other open level is closed). False if the
   * version moved on or the seed was used before.
   */
  start(player: string, version: number, state: Player, level: StoredLevel): Promise<boolean | 'busy'>;
  /** One of this pupil's levels by its seed (null: not theirs, or never started). */
  level(player: string, seed: number): Promise<OpenLevel | null | 'busy'>;
  /** Marks a question slot of an open level, once (false if it was already, or the level has ended). */
  answer(player: string, seed: number, slot: number, right: boolean): Promise<boolean | 'busy'>;
  /**
   * Closes an open level with what its replay said and saves the progress, together. False if the level was already
   * closed or the version moved on.
   */
  end(player: string, seed: number, version: number, state: Player, ending: { drops: number[]; finish: number | null; result: LevelResult }): Promise<boolean | 'busy'>;
  /** Saves the progress (the Workshop). False if the version moved on. */
  save(player: string, version: number, state: Player): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Gives hub points (once per `once`). A failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  /** Tells the hub the pupil's achievement counts may have changed. */
  progressChanged(player: string): Promise<void>;
  random(): number;
  now(): number;
}

export interface DiamondReply {
  status: number;
  body: Record<string, unknown>;
}

/** The longest an answer is said to have taken, for the maths records. */
const MAX_ANSWER_MS = 120_000;
/** No level runs longer than this many ticks (playLevel stops here whatever it's sent). */
const MAX_TICK = 18_000;
/** More Drop presses than a level could ever count. */
const MAX_DROPS = 400;
/** Tries at a save before giving up (another request saved in between). */
const TRIES = 4;

const ok = (body: Record<string, unknown>): DiamondReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): DiamondReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, 'The mine couldn’t be reached just now. Try again in a moment.');
const unreadable = () => no(400, 'That couldn’t be read.');

const isSeed = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 2 ** 32;
const isTick = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_TICK;

function readBoosts(v: unknown): BoostId[] | null {
  if (!Array.isArray(v) || v.length > BOOST_IDS.length) return null;
  if (!v.every((b) => typeof b === 'string' && (BOOST_IDS as readonly string[]).includes(b))) return null;
  return new Set(v).size === v.length ? (v as BoostId[]) : null;
}

/** The level's questions: the pupil's own focus, made from the level's seed. Null if their maths can't be read. */
async function questionsFor(services: DiamondServices, player: string, seed: number, level: number): Promise<Question[] | null> {
  const context = await services.mathsContext(player);
  if (!context) return null;
  const questions = makeRunQuestions(context, questionCap(level), seededRandom(`diamond-${seed}`));
  return questions.length ? questions : null;
}

export async function handleDiamond(services: DiamondServices, player: string, body: Record<string, unknown>): Promise<DiamondReply> {
  const on = await services.enabled(player);
  if (on === null) return busy();
  if (!on) return no(403, 'Diamond Drop is not switched on for your class.', { code: 'game-off' });
  const now = () => new Date(services.now());

  if (body.action === 'load') {
    const s = await services.load(player);
    if (s === 'busy') return busy();
    return ok({ player: s.player, now: services.now() });
  }

  if (body.action === 'levelStart') {
    const level = body.level;
    const boosts = readBoosts(body.boosts ?? []);
    if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > LAST_LEVEL || !boosts) return unreadable();
    for (let tries = 0; tries < TRIES; tries++) {
      const s = await services.load(player);
      if (s === 'busy') return busy();
      if (!canStart(s.player, level as number, now())) {
        return no(409, (level as number) > s.player.deepest + 1 ? 'That level is still locked.' : 'That level opens tomorrow.', { code: 'not-open' });
      }
      const paid = takeBoosts(s.player, level as number, boosts);
      if (!paid.ok) return no(400, paid.reason === 'coins' ? 'Not enough coins for those boosts.' : 'Those boosts can’t be used.');
      const seed = Math.floor(services.random() * 2 ** 32);
      const questions = await questionsFor(services, player, seed, level as number);
      if (!questions) return busy();
      const starter = level === 1 && needsStarter(s.player);
      const kept = await services.start(player, s.version, paid.player, { seed, level: level as number, boosts, starter, questions });
      if (kept === 'busy') return busy();
      if (kept) {
        return ok({ seed, level, boosts, starter, questions: questions.map((q, slot) => publicQuestion(q, slot)), player: paid.player });
      }
    }
    return busy();
  }

  if (body.action === 'answer') {
    const { seed, slot, value } = body;
    if (!isSeed(seed) || !Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) {
      return no(400, 'That answer couldn’t be read.');
    }
    const lvl = await services.level(player, seed);
    if (lvl === 'busy') return busy();
    // Only the pupil's own open level (another pupil's seed is never found here).
    if (!lvl || !lvl.open) return no(409, 'That level has ended.', { code: 'gone' });
    const marked = markQuestion(lvl.questions[slot as number]);
    if (!marked) return no(400, 'That answer couldn’t be marked.');
    const right = sameAnswer(value, marked.answer);
    const claimed = await services.answer(player, seed, slot as number, right);
    if (claimed === 'busy') return busy();
    if (!claimed) return no(400, 'You’ve already answered that one.', { code: 'answered' });
    const ms = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? Math.min(body.ms, MAX_ANSWER_MS) : MAX_ANSWER_MS;
    try {
      await services.recordAnswers(player, `diamond:${seed}:${slot}`, [{ key: marked.key, correct: right, ms: Math.round(ms), at: services.now() }]);
    } catch {
      // The maths records are a bonus: the game goes on without them.
    }
    return ok({ correct: right, answer: marked.answer });
  }

  if (body.action === 'levelEnd') {
    const { seed, drops, finish } = body;
    if (!isSeed(seed) || !Array.isArray(drops) || drops.length > MAX_DROPS || !drops.every(isTick) || !(finish === null || finish === undefined || isTick(finish))) {
      return unreadable();
    }
    for (let tries = 0; tries < TRIES; tries++) {
      const lvl = await services.level(player, seed);
      if (lvl === 'busy') return busy();
      if (!lvl) return no(409, 'That level couldn’t be found.', { code: 'gone' });
      if (!lvl.open) return no(409, 'That level has already ended.', { code: 'ended' });
      const s = await services.load(player);
      if (s === 'busy') return busy();
      // The server's replay: its own seed, boosts and marks, and only the Drop ticks from the browser.
      const result = playLevel({
        level: lvl.level, seed, drops: drops as number[], finish: (finish ?? null) as number | null,
        boosts: lvl.boosts, marks: lvl.marks.map((m) => m === true), starter: lvl.starter,
      });
      const applied = applyResult(s.player, result, now());
      const kept = await services.end(player, seed, s.version, applied.player, { drops: drops as number[], finish: (finish ?? null) as number | null, result });
      if (kept === 'busy') return busy();
      if (kept) {
        if (applied.points > 0) await services.awardPoints(player, applied.points, `diamond:${seed}`);
        await services.progressChanged(player);
        return ok({ result, coins: applied.coins, points: applied.points, newLevel: applied.newLevel, earned: applied.earned, player: applied.player });
      }
    }
    return busy();
  }

  if (body.action === 'buy' || body.action === 'wear') {
    const { id, slot } = body;
    if (body.action === 'buy' ? typeof id !== 'string' : !(SLOTS as readonly unknown[]).includes(slot) || !(id === null || typeof id === 'string')) {
      return unreadable();
    }
    for (let tries = 0; tries < TRIES; tries++) {
      const s = await services.load(player);
      if (s === 'busy') return busy();
      const next = body.action === 'buy' ? buy(s.player, id as string, now()) : wear(s.player, slot as Slot, id as string | null);
      if (!next) return no(400, body.action === 'buy' ? 'You can’t buy that one yet.' : 'That upgrade isn’t yours yet.');
      const kept = await services.save(player, s.version, next);
      if (kept === 'busy') return busy();
      if (kept) return ok({ player: next });
    }
    return busy();
  }

  return unreadable();
}

/** A fresh pupil, as `load` sees one who has never played. */
export const unplayed = (): Saved => ({ player: newPlayer(), version: 0 });
