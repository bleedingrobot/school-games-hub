/**
 * The Mine Runner server function. Three jobs:
 *
 *   start   hands out a seed with a stamp (made for this pupil, level, flight mode and maths choice). If the run has maths
 *           it also makes the run's question list (kept here, where pupils can't read it) and sends back only what to show;
 *   answer  marks one question against the stored list (a slot is marked once) and records it;
 *   finish  checks the stamp, replays the recorded inputs itself, and saves the run and the pupil's best.
 *
 * The time is never taken from the browser: shared/mine/save.ts replays the inputs and refuses a run that did not reach
 * the exit, or that is faster than the real time since the seed was handed out. A door or pad that opened by an answer
 * needs a right answer marked here for that very door or pad, and the wrong-answer penalties in the run must match the
 * wrong answers marked at question doors, so a made-up run can neither open a door it did not earn nor skip a penalty.
 * The same seed can only be saved once.
 */
import type { FactAnswer } from '../../../shared/maths/leitner';
import { publicQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';
import { MINE_POINTS_BEST, MINE_POINTS_FIRST } from '../../../shared/mine/config';
import { makeLevel, recipeById } from '../../../shared/mine/level';
import { medalFor, type Medal } from '../../../shared/mine/medals';
import { addGateChoices, makeRunQuestions, markQuestion, questionPlan, sameAnswer, type MathsContext, type QuestionPlan, type StartReply } from '../../../shared/mine/maths';
import {
  isCountedLevel,
  judgeRun,
  makeMineSeed,
  mineSeedProblem,
  mineStampText,
  MINE_RUNS_PER_DAY,
  parseMineReport,
  type FlightMode,
  type JudgedRun,
  type MineRunReport,
} from '../../../shared/mine/save';
import type { MathsSwitch } from '../../../shared/space/mathsSwitch';
import { bearerToken, corsHeaders } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** 'too-many' (the daily limit), 'refused' (the database said no) and 'busy' (couldn't reach it). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'too-many' | 'refused' | 'busy' };

/** 'first' is a pupil's first finish of a mine, 'best' a better time than their last, 'saved' a slower one. */
export type SaveResult = 'first' | 'best' | 'saved' | 'duplicate';

/** The question list kept for a run with maths, and the answers marked so far. */
export interface StoredRun {
  level: string;
  questions: Question[];
  answered: Record<string, { value: number; right: boolean }>;
}

export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Signs some text (null if the server has no secret). */
  stamp(text: string): Promise<string | null>;
  /** The teacher's switches for this pupil's class: is the game on, and who gets maths (null if they can't be read). */
  settings(player: string): Promise<{ enabled: boolean; maths: MathsSwitch } | null>;
  /** The pupil's records, the class's question settings and their focus (null if they can't be read). */
  mathsContext(player: string): Promise<MathsContext | null>;
  /** How many runs this pupil has saved in the last day, or 'busy' if the database can't be reached. */
  runsToday(player: string): Promise<number | 'busy'>;
  /** Keeps a run's questions. */
  storeRun(player: string, seed: string, level: string, questions: Question[]): Promise<boolean>;
  /** A run's questions: null if it had no maths, 'busy' if they couldn't be read. */
  loadRun(player: string, seed: string): Promise<StoredRun | null | 'busy'>;
  /** Marks a slot answered, once. False if it was already answered; 'busy' if the database could not be reached. */
  claimAnswer(player: string, seed: string, slot: number, value: number, right: boolean): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). The run goes on if this fails. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Saves a replayed run, with the medal its time earns (null if none). */
  record(player: string, report: MineRunReport, run: JudgedRun, medal: Medal | null): Promise<Outcome<SaveResult>>;
  /** Gives points (once per `once`, inside the hub's daily cap). The run is already saved: a failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  /** Says the pupil's counts changed, so their achievements are checked. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
  /** Milliseconds since 1970. */
  now(): number;
  /** Random bytes as hex text. */
  randomHex(bytes: number): string;
}

/** Requests one pupil may make a minute (a run is a start, a handful of answers and a finish). */
export const MAX_REQUESTS_PER_MINUTE = 60;
/** The biggest request this function accepts: a 15-minute run is about 190 KB of inputs (the shared helper stops at 64 KB). */
export const MAX_BODY_BYTES = 220 * 1024;
const TOO_MANY = "That's a lot of mining today! Have a break and come back tomorrow.";
const MAX_ANSWER_MS = 120_000;

export { MINE_RUNS_PER_DAY };

/** Reads a JSON request body. Null if it's missing, unreadable or bigger than MAX_BODY_BYTES. */
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return null;
    const body = JSON.parse(text) as unknown;
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const plans = new Map<string, QuestionPlan>();
/** Which slot belongs to which question door or pad, for a level (made once; building a mine takes a moment). */
function planFor(levelId: string): QuestionPlan | null {
  const known = plans.get(levelId);
  if (known) return known;
  const recipe = recipeById(levelId);
  if (!recipe) return null;
  const plan = questionPlan(makeLevel(recipe));
  plans.set(levelId, plan);
  return plan;
}

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleMine(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = await readBody(request);
    if (!body) return reply(400, { error: "That couldn't be read." });
    const nowSeconds = Math.floor(services.now() / 1000);

    /** Null if the seed is fresh and its stamp is the one this server made for this pupil, level, flight mode and maths choice. */
    const stampProblem = async (level: string, mode: FlightMode, maths: boolean, seed: string, given: string): Promise<string | null> => {
      const expected = await services.stamp(mineStampText(player, level, mode, maths, seed));
      return mineSeedProblem(seed, nowSeconds) ?? (expected && sameText(expected, given) ? null : 'bad stamp');
    };

    if (body.action === 'start') {
      const { level, mode } = body;
      if (!isCountedLevel(level) || (mode !== 'steady' && mode !== 'free')) return reply(400, { error: "That mine couldn't be found." });
      const wantsMaths = body.maths === true;

      // The teacher's switches decide whether the game is on and whether this run has maths. If they can't be read, nothing starts.
      const settings = await services.settings(player);
      if (!settings) return reply(503, { error: "The mine couldn't start just now." });
      if (!settings.enabled) return reply(403, { error: 'Mine Runner is not switched on for your class.', code: 'game-off' });
      const allowed = settings.maths;
      if (wantsMaths && allowed === 'off') {
        return reply(403, { error: 'Maths is switched off for your class. You can fly this mine without questions.', code: 'maths-off' });
      }
      if (!wantsMaths && allowed === 'on') {
        return reply(403, { error: 'Your teacher has switched maths on for everyone, so this mine has questions.', code: 'maths-on' });
      }

      const today = await services.runsToday(player);
      if (today === 'busy') return reply(503, { error: "The mine couldn't start just now." });
      if (today >= MINE_RUNS_PER_DAY) return reply(429, { error: TOO_MANY, code: 'too-many' });

      const seed = makeMineSeed(nowSeconds, services.randomHex(12));
      const stamp = await services.stamp(mineStampText(player, level, mode, wantsMaths, seed));
      if (!stamp) return reply(500, { error: "The mine couldn't start just now." });

      const started: StartReply = { seed, stamp, maths: wantsMaths, questions: [] };
      if (wantsMaths) {
        const plan = planFor(level) as QuestionPlan;
        const context = await services.mathsContext(player);
        const made = context ? makeRunQuestions(context, plan.total, seededRandom(seed)) : [];
        const list = addGateChoices(made, plan, seededRandom(`${seed}:gates`));
        if (list.length < plan.total || !(await services.storeRun(player, seed, level, list))) {
          return reply(503, { error: "The questions couldn't be made just now." });
        }
        started.questions = list.map((q, slot) => publicQuestion(q, slot));
      }
      return reply(200, started);
    }

    if (body.action === 'answer') {
      const { level, mode, seed, stamp, slot, value } = body;
      if (!isCountedLevel(level) || (mode !== 'steady' && mode !== 'free') || typeof seed !== 'string' || typeof stamp !== 'string' || seed.length > 80 || stamp.length > 200) {
        return reply(400, { error: "That answer couldn't be read." });
      }
      if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000) {
        return reply(400, { error: "That answer couldn't be read." });
      }
      const problem = await stampProblem(level, mode, true, seed, stamp);
      if (problem) {
        // Logs say what was wrong, never who sent it.
        console.warn(`mine: refused an answer (${problem})`);
        return reply(400, { error: "That answer couldn't be marked." });
      }
      const run = await services.loadRun(player, seed);
      if (run === 'busy') return reply(503, { error: "We couldn't check your answer just now." });
      const at = slot as number;
      const marked = run && run.level === level && at >= 0 ? markQuestion(run.questions[at]) : null;
      const plan = planFor(level);
      if (!run || !marked || !plan || at >= plan.total) {
        console.warn('mine: refused an answer (no such question)');
        return reply(400, { error: "That answer couldn't be marked." });
      }
      // The same answer sent again (the first reply was lost) gets the same reply, and is not counted twice.
      const before = run.answered[String(at)];
      if (before) {
        if (sameAnswer(before.value, value)) return reply(200, { correct: before.right, answer: marked.answer });
        return reply(400, { error: "You've already answered that one." });
      }
      const correct = sameAnswer(value, marked.answer);
      const claimed = await services.claimAnswer(player, seed, at, value, correct);
      if (claimed === 'busy') return reply(503, { error: "We couldn't check your answer just now." });
      if (!claimed) return reply(400, { error: "You've already answered that one." });
      const claimedMs = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS;
      const ms = Math.round(Math.min(claimedMs, MAX_ANSWER_MS));
      await safeRecord(services, player, `${seed}:${at}`, [{ key: marked.key, correct, ms, at: services.now() }]);
      return reply(200, { correct, answer: marked.answer });
    }

    if (body.action === 'finish') {
      const report = parseMineReport(body);
      if (!report) return reply(400, { error: "That run couldn't be read." });
      const problem = await stampProblem(report.level, report.mode, report.maths, report.seed, report.stamp);
      if (problem) {
        console.warn(`mine: refused a run (${problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      const judged = judgeRun(report, nowSeconds);
      if (!judged.ok) {
        console.warn(`mine: refused a run (${judged.problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      const stored = report.maths ? await services.loadRun(player, report.seed) : null;
      if (stored === 'busy') return reply(503, { error: "We couldn't save your run just now." });
      const plan = planFor(report.level) as QuestionPlan;
      if (!answersMatch(report.maths, stored, plan, judged.run)) {
        console.warn('mine: refused a run (doors, pads or penalties that the answers do not account for)');
        return reply(400, { error: "That run couldn't be saved." });
      }
      const medal = medalFor(report.level, judged.run.steps);
      const saved = await services.record(player, report, judged.run, medal);
      if (!saved.ok) {
        if (saved.why === 'too-many') return reply(429, { error: TOO_MANY, code: 'too-many' });
        return saved.why === 'refused' ? reply(400, { error: "That run couldn't be saved." }) : reply(503, { error: "We couldn't save your run just now." });
      }
      if (saved.value !== 'duplicate') await rewardRun(services, player, report.level, saved.value, nowSeconds);
      return reply(200, { result: saved.value, steps: judged.run.steps, deaths: judged.run.deaths, medal });
    }

    return reply(400, { error: "That couldn't be read." });
  };
}

/**
 * Do the doors, pads and reactor unlocks that came from answers, and the wrong-answer penalties, match the answers marked here?
 *  - every right answer a run used needs a right answer marked for that very door, pad or reactor console;
 *  - the penalties in the run must be exactly the wrong answers marked at question doors and the reactor console (a pad
 *    costs nothing, and leaving a penalty out would be a way to cut the time);
 *  - a run without maths has no answers, so no grants and no penalties.
 */
export function answersMatch(maths: boolean, stored: StoredRun | null, plan: QuestionPlan, run: JudgedRun): boolean {
  if (!maths || !stored) return !maths && run.grants.length === 0 && run.penalties === 0;
  const answers = Object.entries(stored.answered).map(([slot, a]) => ({ slot: Number(slot), right: a.right === true }));
  const inTarget = (t: QuestionPlan['targets'][number], slot: number) => slot >= t.first && slot < t.first + t.count;
  // Each right answer the run used needs its own right answer marked for that very door, pad or console.
  for (const target of plan.targets) {
    const used = run.grants.filter((id) => id === target.id).length;
    if (answers.filter((a) => a.right && inTarget(target, a.slot)).length < used) return false;
  }
  if (run.grants.some((id) => !plan.targets.some((t) => t.id === id))) return false;
  const costly = plan.targets.filter((t) => t.kind !== 'pad');
  const wrongAtCosts = answers.filter((a) => !a.right && costly.some((t) => inTarget(t, a.slot))).length;
  return run.penalties === wrongAtCosts;
}

/** The day in New Zealand (UTC+13 in summer; an hour out in winter, which only moves when "once a day" rolls over). */
const nzDay = (nowSeconds: number) => new Date((nowSeconds + 13 * 3600) * 1000).toISOString().slice(0, 10);

/**
 * Points and achievements for a saved run: 2 for the first finish of a mine, 1 for beating your own best (once a day for
 * each mine), nothing for right answers. Never throws: the run is already saved, so a problem here is only logged.
 */
async function rewardRun(services: Services, player: string, level: string, result: SaveResult, nowSeconds: number): Promise<void> {
  try {
    if (result === 'first') await services.awardPoints(player, MINE_POINTS_FIRST, `mine-first:${level}`);
    else if (result === 'best') await services.awardPoints(player, MINE_POINTS_BEST, `mine-best:${level}:${nzDay(nowSeconds)}`);
    await services.progressChanged(player);
  } catch {
    console.error('mine: points or achievements could not be updated');
  }
}

/** The maths records are a bonus: if they can't be updated the game goes on (a run is never lost over them). */
async function safeRecord(services: Services, player: string, once: string, answers: FactAnswer[]): Promise<void> {
  try {
    await services.recordAnswers(player, once, answers);
  } catch {
    console.error('mine: the maths records could not be updated');
  }
}

/** Compares two stamps without stopping at the first difference, so timing gives nothing away. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type { MineRunReport, JudgedRun };
