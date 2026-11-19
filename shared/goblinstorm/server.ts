/**
 * What the `goblinstorm` server function does with a request from a signed-in pupil (docs/GOBLINSTORM-PLAN.md, "Server,
 * data and cost"). The function (supabase/functions/goblinstorm/handler.ts) checks the sign-in and the rate first; the
 * tests run this with services kept in memory (memoryServices.ts), so both use exactly the same rules.
 *
 *   start   checks the teacher's switch, the hero and map are open and the 5-runs-a-day limit, stamps a seed, and makes
 *           and keeps up to 14 level-up questions from the pupil's own focus (way A). Sends them without answers.
 *   answer  marks one level-up question against the kept one, once (the first answer counts), records it for the maths
 *           records and says wrong, right or quick.
 *   finish  decodes the steering and replays the run with the cards the server's own marks gave and the shop kept at
 *           start, refuses a run sent faster than it could be played, and saves only what the replay says. The
 *           database gives the hub points (normal turns only) as it saves.
 *
 * Nothing that counts comes from the browser: the seed, the questions, the marks and the result are the server's.
 */
import type { FactAnswer } from '../maths/leitner';
import { quickMsForPack } from '../maths/config';
import { packIdOfKey } from '../maths/ladder';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, seededRandom, type MathsContext } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { CHOICES, HEROES, MAPS, QUESTIONS_PER_RUN, STEPS_PER_SECOND, type HeroId, type ShopLevels, type UnlockId, UNLOCK_AT } from './config';
import type { RunSummary } from './engine';
import { choicesFor, decodeSteering, replayRun } from './replay';

export type Mark = 'wrong' | 'right' | 'quick';

/** Runs a day on normal turns (James, 19 Nov 2026). The teacher's "Unlimited today" lifts it. */
export const RUNS_A_DAY = 5;
/** A run's real time must be at least this share of its played time (pauses only add time). */
export const REAL_TIME_SHARE = 0.95;
/** The longest an answer is said to have taken, for the maths records. */
const MAX_ANSWER_MS = 120_000;
/** More level-ups than a run could ever have. */
const MAX_PICKS = 200;

/** The pupil's save as the server keeps it (stage 3: what start needs; the shop and unlocks come in stages 4 and 5). */
export interface Save {
  gold: number;
  shop: ShopLevels;
  /** Heroes unlocked beyond the free ones. */
  heroes: HeroId[];
  /** Map indexes whose boss has been beaten. */
  bosses: number[];
  /** Monsters beaten in all finished runs (for the Barbarian). */
  kills: number;
}

/** One answered level-up question: the value given, how long it took and its mark. */
export interface Answered { value: number; ms: number; mark: Mark }

/** A run as the server keeps it: the questions (with answers) never leave the server. */
export interface KeptRun {
  seed: number;
  hero: HeroId;
  map: number;
  questions: Question[];
  /** Answers so far, by slot. */
  answers: Record<string, Answered>;
  /** The shop levels when the run started: the browser plays with these, so the replay uses them too. */
  shop: ShopLevels;
  /** When `start` kept it (ms since 1970). */
  startedAt: number;
  open: boolean;
  /** What the replay said, once finished. */
  summary?: RunSummary;
}

export interface RunToKeep {
  seed: number;
  hero: HeroId;
  map: number;
  questions: Question[];
  /** The save's shop at start, kept with the run (buying in another tab mid-run can't change the replay). */
  shop: ShopLevels;
  /** The NZ date it counts against. */
  day: string;
  /** Past the normal turns, on an "Unlimited today" day. */
  extra: boolean;
}

export interface Finished {
  steering: string;
  picks: number[];
  summary: RunSummary;
}

export interface GoblinStormServices {
  /** Is the game switched on for this pupil's class? Null if it can't be read. */
  enabled(player: string): Promise<boolean | null>;
  /** Has the teacher switched on "Unlimited today"? */
  unlimited(player: string): Promise<boolean>;
  /** The pupil's maths records, the class's question settings and their focus (null if they can't be read). */
  mathsContext(player: string): Promise<MathsContext | null>;
  /** The save (a fresh one if they've never played). */
  load(player: string): Promise<Save | 'busy'>;
  /** Runs started on this NZ date (finished or not). */
  runsOn(player: string, day: string): Promise<number | 'busy'>;
  /** Keeps a new run. False if the pupil has used this seed before. */
  start(player: string, run: RunToKeep): Promise<boolean | 'busy'>;
  /** One of this pupil's runs by its seed (null: not theirs, or never started). */
  run(player: string, seed: number): Promise<KeptRun | null | 'busy'>;
  /** Marks a slot of an open run, once. False if it was already marked or the run has ended. */
  claim(player: string, seed: number, slot: number, answered: Answered): Promise<boolean | 'busy'>;
  /** Closes an open run with the replay's result and adds it to the save, together. False if it was already closed. */
  finish(player: string, seed: number, finished: Finished): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  random(): number;
  now(): number;
}

export interface GoblinStormReply {
  status: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): GoblinStormReply => ({ status: 200, body });
const no = (status: number, error: string, code?: string): GoblinStormReply => ({ status, body: { error, ...(code ? { code } : {}) } });
const busy = () => no(503, 'The storm couldn’t be reached just now. Try again in a moment.');
const unreadable = () => no(400, 'That couldn’t be read.');

const isSeed = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 2 ** 32;

/** Today's date in New Zealand, 'YYYY-MM-DD'. */
export const nzDay = (now: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));

/** The questions a run asks: the pupil's own focus, made from the run's seed. */
export function runQuestions(context: MathsContext, seed: number): Question[] {
  return makeRunQuestions(context, QUESTIONS_PER_RUN, seededRandom(`goblinstorm:${seed}`));
}

/** Quick for this question: its own pack's quick time. */
export const quickMsFor = (key: string): number => quickMsForPack(packIdOfKey(key));

/** "6 × 7 = 42": a whole fact with its answer in place of the '?'. */
export function factText(parts: readonly string[], answer: number): string {
  return parts.some((p) => p.includes('?')) ? parts.map((p) => p.replace('?', String(answer))).join(' ') : `${parts.join(' ')} = ${answer}`;
}

/** Is this hero open to the pupil? */
export const heroOpen = (save: Save, hero: HeroId): boolean =>
  HEROES.some((h) => h.id === hero && (h.unlock === 'free' || save.heroes.includes(hero)));

/** Is this map open? The first always; each next one once the boss before it is beaten. */
export const mapOpen = (save: Save, map: number): boolean => map === 0 || save.bosses.includes(map - 1);

/** The map whose boss opens the Cleric (the Goblin King) and the Frost Witch (the Ice Dragon). */
export const UNLOCK_BOSS_MAP = { boss1: 0, boss4: 3 } as const;

/**
 * Has this run (the replay's summary, on map `map`) met this unlock? `killsBefore` is the save's total before the
 * run. The database's record_goblinstorm_run uses the same rules (migration 20261119000900): keep them together.
 */
export function unlockMet(unlock: UnlockId, run: Pick<RunSummary, 'level' | 'kills' | 'bossBeaten' | 'evolved' | 'longestNoHitSeconds'>, map: number, killsBefore: number): boolean {
  switch (unlock) {
    case 'free': return true;
    case 'level': return run.level >= UNLOCK_AT.level;
    case 'kills': return killsBefore + run.kills >= UNLOCK_AT.kills;
    case 'boss1': return run.bossBeaten && map === UNLOCK_BOSS_MAP.boss1;
    case 'nohit': return run.longestNoHitSeconds >= UNLOCK_AT.noHitSeconds;
    case 'boss4': return run.bossBeaten && map === UNLOCK_BOSS_MAP.boss4;
    case 'evolve3': return run.evolved.length >= UNLOCK_AT.evolutions;
  }
}

/** Heroes this finished run unlocks that the save doesn't have yet, in the order of HEROES. */
export function newUnlocks(save: Save, run: Pick<RunSummary, 'level' | 'kills' | 'bossBeaten' | 'evolved' | 'longestNoHitSeconds'>, map: number): HeroId[] {
  return HEROES.filter((h) => h.unlock !== 'free' && !save.heroes.includes(h.id) && unlockMet(h.unlock, run, map, save.kills)).map((h) => h.id);
}

/** Cards for each level-up: a slot with a question uses its mark (unanswered: wrong); past the last question, right. */
export function choicesOf(run: Pick<KeptRun, 'questions' | 'answers'>): number[] {
  return Array.from({ length: QUESTIONS_PER_RUN }, (_, i) =>
    i < run.questions.length ? choicesFor(run.answers[String(i)]?.mark ?? 'wrong') : CHOICES.right);
}

export async function handleGoblinStorm(services: GoblinStormServices, player: string, body: Record<string, unknown>): Promise<GoblinStormReply> {
  const on = await services.enabled(player);
  if (on === null) return busy();
  if (!on) return no(403, 'Goblin Storm is not switched on for your class.', 'game-off');

  if (body.action === 'start') {
    const { hero, map } = body;
    if (typeof hero !== 'string' || !HEROES.some((h) => h.id === hero) || !Number.isInteger(map) || !MAPS[map as number]) return unreadable();
    const [save, unlimited] = await Promise.all([services.load(player), services.unlimited(player)]);
    if (save === 'busy') return busy();
    if (!heroOpen(save, hero as HeroId)) return no(409, 'That hero is still locked.', 'locked');
    if (!mapOpen(save, map as number)) return no(409, 'That map is still locked.', 'locked');
    const day = nzDay(services.now());
    const today = await services.runsOn(player, day);
    if (today === 'busy') return busy();
    if (today >= RUNS_A_DAY && !unlimited) return no(409, 'All done for today. See you tomorrow!', 'done-today');
    const context = await services.mathsContext(player);
    if (!context) return busy();
    for (let tries = 0; tries < 3; tries++) {
      const seed = Math.floor(services.random() * 2 ** 32);
      const questions = runQuestions(context, seed);
      const shop = save.shop ?? {};
      const kept = await services.start(player, { seed, hero: hero as HeroId, map: map as number, questions, shop, day, extra: today >= RUNS_A_DAY });
      if (kept === 'busy') return busy();
      if (kept) {
        return ok({
          seed, hero, map, shop,
          questions: questions.map((q, slot) => publicQuestion(q, slot)),
          quickMs: quickMsForPack(null),
          runsLeft: unlimited ? null : Math.max(0, RUNS_A_DAY - today - 1),
        });
      }
    }
    return busy();
  }

  if (body.action === 'answer') {
    const { seed, slot, value } = body;
    if (!isSeed(seed) || !Number.isInteger(slot) || (slot as number) < 0 || (slot as number) >= QUESTIONS_PER_RUN
      || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) {
      return no(400, 'That answer couldn’t be read.');
    }
    const run = await services.run(player, seed);
    if (run === 'busy') return busy();
    // Only the pupil's own open run: another pupil's seed is never found here.
    if (!run || !run.open) return no(409, 'That run has ended.', 'gone');
    const q = run.questions[slot as number];
    const marked = markQuestion(q);
    if (!q || !marked) return no(400, 'That answer couldn’t be marked.');
    const fact = factText(q.parts, marked.answer);
    // The first answer counts: sent again, the same mark comes back and nothing is recorded twice.
    const before = run.answers[String(slot)];
    if (before) return ok({ mark: before.mark, correct: before.mark !== 'wrong', answer: marked.answer, fact, already: true });
    const ms = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? Math.round(Math.min(body.ms, MAX_ANSWER_MS)) : MAX_ANSWER_MS;
    const correct = sameAnswer(value, marked.answer);
    const mark: Mark = !correct ? 'wrong' : ms <= quickMsFor(marked.key) ? 'quick' : 'right';
    const claimed = await services.claim(player, seed, slot as number, { value, ms, mark });
    if (claimed === 'busy') return busy();
    if (!claimed) {
      // Another request got there first: send back what it saved.
      const again = await services.run(player, seed);
      const first = again !== 'busy' ? again?.answers[String(slot)] : undefined;
      if (!first) return no(409, 'That run has ended.', 'gone');
      return ok({ mark: first.mark, correct: first.mark !== 'wrong', answer: marked.answer, fact, already: true });
    }
    try {
      await services.recordAnswers(player, `${seed}:${slot}`, [{ key: marked.key, correct, ms, at: services.now(), ...(correct ? {} : { given: value }) }]);
    } catch {
      // The maths records are a bonus: the run goes on without them.
    }
    return ok({ mark, correct, answer: marked.answer, fact });
  }

  if (body.action === 'finish') {
    const { seed, steering, picks } = body;
    if (!isSeed(seed) || typeof steering !== 'string' || !Array.isArray(picks) || picks.length > MAX_PICKS
      || !picks.every((p) => Number.isInteger(p) && p >= 0 && p < 8)) {
      return unreadable();
    }
    const dirs = decodeSteering(steering);
    if (!dirs) return unreadable();
    const [run, save] = await Promise.all([services.run(player, seed), services.load(player)]);
    if (run === 'busy' || save === 'busy') return busy();
    if (!run) return no(404, 'That run isn’t yours.', 'not-yours');
    // Sent twice: the first save stands.
    if (!run.open) return run.summary ? ok({ valid: true, summary: run.summary, already: true }) : no(409, 'That run has already ended.', 'ended');
    // Real time can't be shorter than the playing (pauses only add time), so a made-up run can't be quicker than playing.
    if (services.now() - run.startedAt < (dirs.length / STEPS_PER_SECOND) * 1000 * REAL_TIME_SHARE) {
      return no(422, 'That run couldn’t be checked.', 'too-fast');
    }
    const hero = HEROES.find((h) => h.id === run.hero);
    const map = MAPS[run.map];
    if (!hero || !map) return unreadable();
    // The shop as it was at start (kept with the run), not as it is now: the browser played with that one.
    const replay = replayRun({ setup: { seed, hero, map, shop: run.shop ?? {} }, steering: dirs, picks: picks as number[], choices: choicesOf(run) });
    if (!replay.valid) return no(422, 'That run couldn’t be checked.', 'not-valid');
    const kept = await services.finish(player, seed, { steering, picks: picks as number[], summary: replay.summary });
    if (kept === 'busy') return busy();
    if (!kept) return no(409, 'That run has already ended.', 'ended');
    // The database saved the unlocks by the same rules; this only tells the pupil which are new.
    return ok({ valid: true, summary: replay.summary, unlocked: newUnlocks(save, replay.summary, run.map) });
  }

  return unreadable();
}

/** A pupil who has never played. */
export const freshSave = (): Save => ({ gold: 0, shop: {}, heroes: [], bosses: [], kills: 0 });
