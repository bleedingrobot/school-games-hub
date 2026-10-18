/**
 * The Marble Rush server function. Three jobs:
 *
 *   start   hands out a seed with a stamp (made for this student, course and mode). If the run has maths it also makes
 *           the run's question list (kept here, where students can't read it) and says which shortcut doors are open;
 *   answer  marks one pit-stop or rescue answer against the stored list (a slot is marked once) and records it;
 *   save    checks the stamp, replays the recorded inputs itself, and saves the run.
 *
 * The time is never taken from the browser: shared/marble/save.ts replays the inputs and refuses a run that did not
 * finish, or that is faster than the real time since the seed was handed out. The same seed can only be saved once.
 * The tunnel chosen at each answer gate is read from the replay, never sent; bonuses and refunds in the inputs are only
 * allowed as far as right answers were marked.
 */
import { courseById } from '../../../shared/marble/courses';
import type { Course } from '../../../shared/marble/course';
import { doorMask, doorsForSeed, gateLayout, runSetup, slotPlan, type GateLayout, type StartReply } from '../../../shared/marble/maths';
import { makeRunQuestions, markQuestion, sameAnswer, type MathsContext } from '../../../shared/marble/questions';
import {
  judgeRun,
  makeMarbleSeed,
  marbleSeedProblem,
  marbleStampText,
  MARBLE_RUNS_PER_DAY,
  parseMarbleReport,
  type JudgedRun,
  type MarbleRunReport,
} from '../../../shared/marble/save';
import type { FactAnswer } from '../../../shared/maths/leitner';
import type { Question } from '../../../shared/maths/skillPack';
import { parseMathsSwitch, type MathsSwitch } from '../../../shared/space/mathsSwitch';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** 'too-many' (the daily limit), 'refused' (the database said no) and 'busy' (couldn't reach it). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'too-many' | 'refused' | 'busy' };

export type SaveResult = 'best' | 'saved' | 'duplicate';

/** The teacher's maths switches for a student's class. */
export interface MarbleSettings {
  maths: MathsSwitch;
  /** Rescue questions after a fall (their own switch). */
  rescue: boolean;
}

/** The question list kept for a run with maths, and the answers marked so far. */
export interface StoredRun {
  rescue: boolean;
  questions: Question[];
  answered: Record<string, { value: number; right: boolean }>;
}

export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Signs some text (null if the server has no secret). */
  stamp(text: string): Promise<string | null>;
  /** The teacher's switches for this student (null if they can't be read: maths then stays off). */
  settings(player: string): Promise<MarbleSettings | null>;
  /** The student's records, the class's question settings and their focus (null if they can't be read). */
  mathsContext(player: string): Promise<MathsContext | null>;
  /** Keeps a run's questions. */
  storeRun(player: string, seed: string, rescue: boolean, questions: Question[]): Promise<boolean>;
  /** A run's questions: null if it had no maths, 'busy' if they couldn't be read. */
  loadRun(player: string, seed: string): Promise<StoredRun | null | 'busy'>;
  /** Marks a slot answered, once. False if it was already answered; 'busy' if the database could not be reached. */
  claimAnswer(player: string, seed: string, slot: number, value: number, right: boolean): Promise<boolean | 'busy'>;
  /** Adds answers to the student's maths records (sent twice, counted once, by `once`). The run goes on if this fails. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Saves a replayed run. */
  record(player: string, report: MarbleRunReport, run: JudgedRun, extra: { maths: boolean; doors: number }): Promise<Outcome<SaveResult>>;
  /** Milliseconds since 1970. */
  now(): number;
  /** Random bytes as hex text. */
  randomHex(bytes: number): string;
  /** A random number from 0 up to (not including) 1. */
  random(): number;
}

/** Requests one student may make a minute (a run is a start, a few answers and a save). */
export const MAX_REQUESTS_PER_MINUTE = 60;
const TOO_MANY = "That's a lot of rolling today! Have a break and come back tomorrow.";
/** How long a gate answer is said to have taken. The server can't time a roll through a tunnel, so it is slow enough not to count as quick. */
const GATE_MS = 8000;
const MAX_ANSWER_MS = 60_000;

export { MARBLE_RUNS_PER_DAY };

/** Maths happens when the teacher says "on", or says "students choose" and this student chose it. */
export function mathsWanted(mode: MathsSwitch, chosen: unknown): boolean {
  return mode === 'on' || (mode === 'choose' && chosen === true);
}

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleMarble(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return reply(400, { error: "That couldn't be read." });
    const nowSeconds = Math.floor(services.now() / 1000);

    /** Null if the seed is fresh and its stamp is the one this server made for this student, course and mode. */
    const stampProblem = async (course: string, mode: 'up' | 'down', seed: string, given: string): Promise<string | null> => {
      const expected = await services.stamp(marbleStampText(player, course, mode, seed));
      return marbleSeedProblem(seed, nowSeconds) ?? (expected && sameText(expected, given) ? null : 'bad stamp');
    };

    if (body.action === 'start') {
      const mode = body.mode;
      const course = typeof body.course === 'string' ? courseById(body.course) : undefined;
      if (!course || (mode !== 'up' && mode !== 'down')) return reply(400, { error: "That course couldn't be found." });
      const seed = makeMarbleSeed(nowSeconds, services.randomHex(12));
      const stamp = await services.stamp(marbleStampText(player, course.def.id, mode, seed));
      if (!stamp) return reply(500, { error: "The run couldn't start." });

      // Maths only if the teacher allows it (checked now, for every run). If anything can't be read, the run goes ahead without it.
      let questions: Question[] | null = null;
      let rescue = false;
      if (course.gates.length) {
        const settings = await services.settings(player);
        const mathsMode = parseMathsSwitch(settings?.maths);
        if (settings && mathsWanted(mathsMode, body.maths)) {
          const context = await services.mathsContext(player);
          const list = context ? makeRunQuestions(context, slotPlan(course).total, () => services.random()) : [];
          if (list.length >= slotPlan(course).total) {
            rescue = settings.rescue;
            if (await services.storeRun(player, seed, rescue, list)) questions = list;
          }
        }
      }
      const started: StartReply = { seed, stamp, ...runSetup(course, seed, questions, rescue) };
      return reply(200, started);
    }

    if (body.action === 'answer') {
      const course = typeof body.course === 'string' ? courseById(body.course) : undefined;
      const mode = body.mode;
      const { seed, stamp, slot, answer } = body;
      if (!course || (mode !== 'up' && mode !== 'down') || typeof seed !== 'string' || typeof stamp !== 'string' || seed.length > 80 || stamp.length > 200) {
        return reply(400, { error: "That answer couldn't be read." });
      }
      if (!Number.isInteger(slot) || typeof answer !== 'number' || !Number.isFinite(answer) || answer < 0 || answer > 1_000_000) {
        return reply(400, { error: "That answer couldn't be read." });
      }
      const problem = await stampProblem(course.def.id, mode, seed, stamp);
      if (problem) {
        console.warn(`marble: refused an answer (${problem})`);
        return reply(400, { error: "That answer couldn't be marked." });
      }
      const run = await services.loadRun(player, seed);
      if (run === 'busy') return reply(503, { error: "We couldn't check your answer just now." });
      const plan = slotPlan(course);
      const at = slot as number;
      // Only pit stops and (if the teacher allows them) rescues are answered here; a gate is answered by rolling through a tunnel.
      const allowed = at >= plan.pitStart && at < plan.rescueStart + (run?.rescue ? plan.rescues : 0);
      if (!run || !allowed) {
        console.warn('marble: refused an answer (no such question)');
        return reply(400, { error: "That answer couldn't be marked." });
      }
      const marked = markQuestion(run.questions[at]);
      if (!marked) return reply(400, { error: "That answer couldn't be marked." });
      const right = sameAnswer(answer, marked.answer);
      const claimed = await services.claimAnswer(player, seed, at, answer, right);
      if (claimed === 'busy') return reply(503, { error: "We couldn't check your answer just now." });
      if (!claimed) return reply(400, { error: "You've already answered that one." });
      const claimedMs = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS;
      const ms = Math.round(Math.min(claimedMs, MAX_ANSWER_MS));
      await safeRecord(services, player, `${seed}:${at}`, [{ key: marked.key, correct: right, ms, at: services.now() }]);
      return reply(200, { right, answer: marked.answer });
    }

    if (body.action === 'save') {
      const report = parseMarbleReport(body);
      if (!report) return reply(400, { error: "That run couldn't be read." });
      const problem = await stampProblem(report.course, report.mode, report.seed, report.stamp);
      if (problem) {
        // Logs say what was wrong, never who sent it.
        console.warn(`marble: refused a run (${problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      const course = courseById(report.course) as Course;
      // A run that had maths has a stored question list; the doors that were open come from it and the seed.
      const stored = await services.loadRun(player, report.seed);
      if (stored === 'busy') return reply(503, { error: "We couldn't save your run just now." });
      const doors = doorsForSeed(course, report.seed, stored?.questions ?? null);
      const judged = judgeRun(report, nowSeconds, doors);
      if (!judged.ok) {
        console.warn(`marble: refused a run (${judged.problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      // A bonus or a refund in the inputs is only allowed for a right answer that was marked (and a pit stop or fall that really happened).
      const plan = slotPlan(course);
      const rightIn = (from: number, to: number) =>
        Object.entries(stored?.answered ?? {}).filter(([slot, a]) => a.right && Number(slot) >= from && Number(slot) < to).length;
      const bonusesAllowed = Math.min(rightIn(plan.pitStart, plan.rescueStart), judged.run.pitStops);
      const refundsAllowed = stored?.rescue ? Math.min(rightIn(plan.rescueStart, plan.total), judged.run.falls) : 0;
      if (judged.run.bonuses > bonusesAllowed || judged.run.refunds > refundsAllowed) {
        console.warn('marble: refused a run (more bonuses than right answers)');
        return reply(400, { error: "That run couldn't be saved." });
      }
      const saved = await services.record(player, report, judged.run, { maths: stored !== null, doors: doorMask(doors) });
      if (!saved.ok) {
        if (saved.why === 'too-many') return reply(429, { error: TOO_MANY });
        return saved.why === 'refused' ? reply(400, { error: "That run couldn't be saved." }) : reply(503, { error: "We couldn't save your run just now." });
      }
      if (stored && saved.value !== 'duplicate') await recordGateAnswers(services, player, course, report.seed, stored, judged.run);
      return reply(200, { result: saved.value, steps: judged.run.steps, falls: judged.run.falls });
    }

    return reply(400, { error: "That couldn't be read." });
  };
}

/**
 * The student's answer at each gate is the tunnel they rolled into first (read from the replay). Each is marked
 * against the stored list and counted once, even if the run is sent twice. If the records can't be updated the run is still saved.
 */
async function recordGateAnswers(services: Services, player: string, course: Course, seed: string, stored: StoredRun, run: JudgedRun): Promise<void> {
  const layout: GateLayout[] = gateLayout(course, seed, stored.questions);
  const answers: FactAnswer[] = [];
  for (const gate of layout) {
    const choice = run.gateChoices[gate.gate];
    const marked = markQuestion(stored.questions[gate.slot]);
    if (choice === undefined || choice < 0 || !marked || !gate.values) continue;
    const value = gate.values[choice];
    const right = sameAnswer(value, marked.answer);
    const claimed = await services.claimAnswer(player, seed, gate.slot, value, right);
    if (claimed === true) answers.push({ key: marked.key, correct: right, ms: GATE_MS, at: services.now() });
  }
  if (answers.length) await safeRecord(services, player, `${seed}:gates`, answers);
}

/** The maths records are a bonus: if they can't be updated the game goes on (a run is never lost over them). */
async function safeRecord(services: Services, player: string, once: string, answers: FactAnswer[]): Promise<void> {
  try {
    await services.recordAnswers(player, once, answers);
  } catch {
    console.error('marble: the maths records could not be updated');
  }
}

/** Compares two stamps without stopping at the first difference, so timing gives nothing away. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
