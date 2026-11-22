/**
 * The Circuit Racer server function (docs/CIRCUIT-PLAN.md, sections 7 and 8). Four jobs:
 *
 *   load    the pupil's own roads (best time, medal, stars), how many of today's 5 finishes are left, and the maths switch;
 *   start   hands out a seed with a stamp (made for this pupil and road) for one go at an open road, unless today's 5
 *           finishes are used up. With maths on (the teacher's `circuit_maths`), it makes one question per recharge port
 *           and data gate from the pupil's focus (way A), keeps them where pupils can't read them, and sends only what to
 *           show. If anything can't be read, the road goes ahead without maths;
 *   answer  marks a recharge port's answer against the kept question, once, and records it (`recordMathsAnswers`);
 *   finish  checks the stamp, replays the recorded inputs itself (shared/circuit/game.ts `judgeFinish`) with each port's
 *           refill from the marked answers (unanswered = half) and each gate's right lane, and saves only what the replay
 *           says: the time, medal and battery star. A hard-mode finish is replayed with Auto-Pilot off and the count-down
 *           clock, and kept apart as a hard finish (Stage 4). The lane taken at each data gate is read from the replay, marked and
 *           recorded once. The 6th finish of a New Zealand day is refused unless the class has "Unlimited today" (the
 *           database counts and refuses, so two tabs can't sneak one in).
 *
 * Every job checks sign-in and the teacher's switch (`settings_of`): while it is off, nothing is handed out or saved.
 * Logic only, with the database passed in (`Services`), so handler.test.ts and the preview run it without Deno.
 */
import { finishesLeft, judgeFinish, makeSeed, parseFinish, roadById, roadNeeds, roadOpen, seedProblem, stampText, type CircuitSave, type JudgedFinish, type RoadProgress } from '../../../shared/circuit/game';
import { GATE_MS, gateLayout, gateValue, refillsFor, runMaths, slotPlan, type RunMaths } from '../../../shared/circuit/maths';
import type { Road } from '../../../shared/circuit/road';
import type { FactAnswer } from '../../../shared/maths/leitner';
import { makeRunQuestions, markQuestion, sameAnswer, type MathsContext } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';
import type { MathsSwitch } from '../../../shared/space/mathsSwitch';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

export type SaveStatus = 'best' | 'saved' | 'duplicate' | 'done-today' | 'locked';

export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Signs some text (null if the server has no secret). */
  stamp(text: string): Promise<string | null>;
  /** The class's switch, "Unlimited today" and maths switch for this pupil; null if they can't be read. */
  settings(player: string): Promise<{ enabled: boolean; unlimited: boolean; maths: MathsSwitch } | null>;
  /** The pupil's maths records, the class's question settings and their focus (null if they can't be read: no maths then). */
  mathsContext(player: string): Promise<MathsContext | null>;
  /** Keeps a go's questions where pupils can't read them. False if they couldn't be kept (the go has no maths then). */
  storeQuestions(player: string, seed: string, questions: Question[]): Promise<boolean>;
  /** A go's questions and the answers marked so far: null if the go had no maths, 'busy' if they couldn't be read. */
  loadQuestions(player: string, seed: string): Promise<StoredGo | null | 'busy'>;
  /** Marks a slot answered, once. False if it was answered already. */
  claimAnswer(player: string, seed: string, slot: number, value: number, right: boolean): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (counted once by `once`). Never stops a go if it fails. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** A random number from 0 up to 1 (the question pack). */
  random(): number;
  /** The pupil's roads and finishes today (NZ day). */
  load(player: string): Promise<{ roads: Record<string, RoadProgress>; today: number } | 'busy'>;
  /**
   * Saves a replayed finish in one locked step: refuses a 6th finish today unless `unlimited`, refuses a road that isn't open
   * (`needs`: `count` of these roads finished, from roadNeeds), counts a seed once, keeps the best and the hard finishes, and
   * gives the hub points.
   */
  record(player: string, finish: { road: string; needs: { roads: string[]; count: number } | null; seed: string; inputs: string; unlimited: boolean } & JudgedFinish): Promise<{ status: SaveStatus; today: number } | 'busy'>;
  now(): number;
  randomHex(bytes: number): string;
}

/** A go's kept questions and the answers marked so far ({ "<slot>": { value, right } }). */
export interface StoredGo {
  questions: Question[];
  answered: Record<string, { value: number; right: boolean }>;
}

/** Requests one pupil may make a minute (a road is a start, a few port answers and a finish). */
export const MAX_REQUESTS_PER_MINUTE = 60;
const MAX_ANSWER_MS = 60_000;

/** Maths happens when the teacher says "on", or "students choose" and this pupil chose it. */
export function mathsWanted(mode: MathsSwitch, chosen: unknown): boolean {
  return mode === 'on' || (mode === 'choose' && chosen === true);
}
export const DONE_TODAY = 'All done for today. See you tomorrow!';
const OFF = 'Circuit Racer is switched off for your class.';

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleCircuit(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return reply(400, { error: "That couldn't be read." });
    const nowSeconds = Math.floor(services.now() / 1000);

    // The teacher's switch, checked on every request. If it can't be read nothing is handed out.
    const settings = await services.settings(player);
    if (!settings) return reply(503, { error: "We couldn't reach the circuit just now." });
    if (!settings.enabled) return reply(403, { error: OFF, code: 'off' });

    if (body.action === 'load') {
      const saved = await services.load(player);
      if (saved === 'busy') return reply(503, { error: "We couldn't load your roads just now." });
      const save: CircuitSave = { ...saved, left: finishesLeft(saved.today, settings.unlimited), maths: settings.maths };
      return reply(200, save);
    }

    if (body.action === 'start') {
      const roadId = typeof body.road === 'string' ? body.road : '';
      if (!roadById(roadId)) return reply(400, { error: "That road couldn't be found." });
      const saved = await services.load(player);
      if (saved === 'busy') return reply(503, { error: "We couldn't start the road just now." });
      if (!roadOpen(saved.roads, roadId)) return reply(409, { error: 'That road isn’t open yet.', code: 'locked' });
      const left = finishesLeft(saved.today, settings.unlimited);
      if (left === 0) return reply(409, { error: DONE_TODAY, code: 'done-today' });
      const seed = makeSeed(nowSeconds, services.randomHex(12));
      const stamp = await services.stamp(stampText(player, roadId, seed));
      if (!stamp) return reply(500, { error: "The road couldn't start." });
      const road = roadById(roadId) as Road;
      let maths: RunMaths | null = null;
      const plan = slotPlan(road);
      if (plan.total > 0 && mathsWanted(settings.maths, body.maths)) {
        const context = await services.mathsContext(player);
        const questions = context ? makeRunQuestions(context, plan.total, () => services.random()) : [];
        if (questions.length >= plan.total && (await services.storeQuestions(player, seed, questions))) maths = runMaths(road, seed, questions);
      }
      return reply(200, { seed, stamp, left, maths });
    }

    if (body.action === 'answer') {
      const { road: roadId, seed, stamp, slot, answer } = body;
      const road = typeof roadId === 'string' ? roadById(roadId) : undefined;
      if (!road || typeof seed !== 'string' || typeof stamp !== 'string' || seed.length > 80 || stamp.length > 200 || !Number.isInteger(slot)) {
        return reply(400, { error: "That answer couldn't be read." });
      }
      if (typeof answer !== 'number' || !Number.isFinite(answer) || answer < 0 || answer > 1_000_000) return reply(400, { error: "That answer couldn't be read." });
      const expected = await services.stamp(stampText(player, road.def.id, seed));
      const problem = seedProblem(seed, nowSeconds) ?? (expected && sameText(expected, stamp) ? null : 'bad stamp');
      if (problem) {
        console.warn(`circuit: refused an answer (${problem})`);
        return reply(400, { error: "That answer couldn't be marked." });
      }
      const stored = await services.loadQuestions(player, seed);
      if (stored === 'busy') return reply(503, { error: "We couldn't check your answer just now." });
      const at = slot as number;
      // Only ports are answered here; a gate is answered by the lane taken, read from the replay at the finish.
      const marked = stored && at >= 0 && at < slotPlan(road).ports ? markQuestion(stored.questions[at]) : null;
      if (!marked) {
        console.warn('circuit: refused an answer (no such question)');
        return reply(400, { error: "That answer couldn't be marked." });
      }
      const right = sameAnswer(answer, marked.answer);
      const claimed = await services.claimAnswer(player, seed, at, answer, right);
      if (claimed === 'busy') return reply(503, { error: "We couldn't check your answer just now." });
      if (!claimed) return reply(400, { error: "You've already answered that one.", code: 'answered' });
      const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS, MAX_ANSWER_MS));
      await safeRecord(services, player, `${seed}:${at}`, [{ key: marked.key, correct: right, ms, at: services.now(), given: answer }]);
      return reply(200, { right, answer: marked.answer });
    }

    if (body.action === 'finish') {
      const report = parseFinish(body);
      if (!report) return reply(400, { error: "That run couldn't be read." });
      const expected = await services.stamp(stampText(player, report.road, report.seed));
      const problem = seedProblem(report.seed, nowSeconds) ?? (expected && sameText(expected, report.stamp) ? null : 'bad stamp');
      if (problem) {
        // Logs say what was wrong, never who sent it.
        console.warn(`circuit: refused a finish (${problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      // A go with maths replays with its marks: each port's refill (unanswered = half) and each gate's right lane.
      const road = roadById(report.road);
      const stored = road ? await services.loadQuestions(player, report.seed) : null;
      if (stored === 'busy') return reply(503, { error: "We couldn't save your run just now." });
      const layout = road && stored ? gateLayout(road, report.seed, stored.questions) : [];
      const judged = judgeFinish(report, nowSeconds, road && stored ? { refills: refillsFor(road, stored.answered), gateRight: layout.map((l) => l.rightLane) } : {});
      if (!judged.ok) {
        console.warn(`circuit: refused a finish (${judged.problem})`);
        return reply(400, { error: "That run couldn't be saved." });
      }
      const saved = await services.record(player, { road: report.road, needs: roadNeeds(report.road), seed: report.seed, inputs: report.inputs, unlimited: settings.unlimited, ...judged.run });
      if (saved === 'busy') return reply(503, { error: "We couldn't save your run just now." });
      if (saved.status === 'done-today') return reply(409, { error: DONE_TODAY, code: 'done-today' });
      if (saved.status === 'locked') return reply(409, { error: 'That road isn’t open yet.', code: 'locked' });
      if (road && stored && saved.status !== 'duplicate') await recordGates(services, player, road, report.seed, stored, layout, judged.choices);
      const { steps, medal, clean, charged, battery, hard } = judged.run;
      return reply(200, { result: saved.status, steps, medal, clean, charged, battery, hard, left: finishesLeft(saved.today, settings.unlimited) });
    }

    return reply(400, { error: "That couldn't be read." });
  };
}

/**
 * The answer at each data gate is the lane the racer was in at its split row (from the replay). Each is marked against the
 * kept question and counted once, even if the finish is sent twice. A lane with no sign (or no lane) is no answer.
 */
async function recordGates(services: Services, player: string, road: Road, seed: string, stored: StoredGo, layout: ReturnType<typeof gateLayout>, choices: readonly number[]): Promise<void> {
  const answers: FactAnswer[] = [];
  for (const gate of layout) {
    const value = gateValue(road, gate, choices[gate.gate] ?? -1);
    const marked = markQuestion(stored.questions[gate.slot]);
    if (value === null || !marked) continue;
    const right = sameAnswer(value, marked.answer);
    const claimed = await services.claimAnswer(player, seed, gate.slot, value, right);
    if (claimed === true) answers.push({ key: marked.key, correct: right, ms: GATE_MS, at: services.now(), given: value });
  }
  if (answers.length) await safeRecord(services, player, `${seed}:gates`, answers);
}

/** The maths records are a bonus: if they can't be updated the go is still saved. */
async function safeRecord(services: Services, player: string, once: string, answers: FactAnswer[]): Promise<void> {
  try {
    await services.recordAnswers(player, once, answers);
  } catch {
    console.error('circuit: the maths records could not be updated');
  }
}

/** Compares two stamps without stopping at the first difference, so timing gives nothing away. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
