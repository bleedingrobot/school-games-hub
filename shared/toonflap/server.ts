/**
 * What the `toonflap` server function does with a request from a signed-in pupil (docs/TOON-FLAP-PLAN.md, stage F.3). The
 * function (supabase/functions/toonflap/handler.ts) checks the sign-in and the rate first; the preview's trial backend
 * calls this with services kept in the browser (memoryServices.ts), so both run exactly the same rules. Built like
 * Robin's Berry Basket (shared/robin/server.ts).
 *
 *   load    the pupil's progress (levels, medals, flyers, trails, potions), their flyer and trail, and the class's switches;
 *   picks   saves the flyer and trail (only ones the pupil has unlocked);
 *   start   makes the run's questions from the pupil's own focus (way A) with a fresh seed and keeps them: one per check,
 *           and a short confidence-builder fact per answer sign (with its gap labels; the right gap comes from the seed);
 *           the browser gets only what to show;
 *   answer  marks a check's answer once and records it;
 *   finish  replays the flaps on the kept run (it must reach the nest, no faster than real time allows), marks the answer
 *           gaps from the replay, works out the time and medal, saves the run with the new progress (unlocks, potions)
 *           and gives points for the first runs of the day.
 *
 * Nothing that counts comes from the browser: not the time, the gaps flown through, the checks, or the potions held.
 */
import type { FactAnswer, FactStats } from '../maths/leitner';
import type { MathsFocus } from '../maths/focus';
import { readyLevel } from '../maths/selector';
import { markQuestion, publicQuestion, sameAnswer, type PublicQuestion } from '../maths/serverQuestions';
import type { Question, SkillPack } from '../maths/skillPack';
import { TimesTables } from '../maths/skillPacks/timesTables';
import { nzDate } from '../kit/dayArc';
import { makeSpacePack, pickSpaceQuestion, type MathsQuestionSettings } from '../space/mathsQuestion';
import { addRun, emptyProgress, flyersUnlocked, levelOpen, trailsUnlocked, type Progress, type Unlocks } from './collection';
import { BREAK_AFTER_RUNS, POINT_RUNS_A_DAY, POINTS, READ_TIME_LEVELS, SIGN_SECONDS, STEPS_PER_SECOND } from './config';
import { decodeFlaps, medalFor, replayRun, scoreRun, type Medal, type Score } from './engine';
import { buildCourse, levelById, type Course } from './levels';
import { gapLabels, gapsRight, rightGaps, slotPlan } from './maths';

export interface Picks {
  flyer: string;
  trail: string | null;
}

export interface Saved {
  progress: Progress;
  picks: Picks;
  /** Goes up by one on every save; a save is kept only if it still matches (0: never played). */
  version: number;
}

export const unplayed = (): Saved => ({ progress: emptyProgress(), picks: { flyer: 'fantail', trail: null }, version: 0 });

export interface Settings {
  enabled: boolean;
  /** The teacher's maths switch: anything but 'off' means checks ask questions and answer gaps have numbers. */
  maths: boolean;
  /** Pause at each answer sign until Go: on for levels 3 to 5 unless the teacher turns it off. */
  readTime: boolean;
}

export interface MathsContext {
  facts: FactStats[];
  focus: MathsFocus | null;
  settings: MathsQuestionSettings;
}

/** A run as it's kept: everything needed to mark and replay it. */
export interface KeptRun {
  level: string;
  gentle: boolean;
  maths: boolean;
  questions: Question[];
  /** The numbers on each answer wall's gaps (bottom to top). */
  labels: number[][];
  /** Each check marked so far, by slot. */
  marks: Record<string, boolean>;
  open: boolean;
  /** When it started, ms since 1970 (by the server's clock). */
  startedAt: number;
}

export interface FinishedRun {
  flaps: string;
  seconds: number;
  medal: Medal;
  bumps: number;
  checksRight: number;
  gapsRight: number;
  potion: boolean;
}

export interface ToonFlapServices {
  now(): number;
  random(): number;
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  maths(player: string): Promise<MathsContext | 'busy'>;
  /** Runs this pupil started and finished on this NZ day. */
  runsToday(player: string, day: string): Promise<{ started: number; finished: number } | 'busy'>;
  /** Keeps a new run (and closes any other open one). False if the pupil has used this seed before. */
  start(player: string, seed: string, run: Omit<KeptRun, 'marks' | 'open' | 'startedAt'>): Promise<boolean | 'busy'>;
  /** One of this pupil's runs by its seed; null if it isn't theirs. */
  run(player: string, seed: string): Promise<KeptRun | null | 'busy'>;
  /** Marks a check once. False if that slot was already marked or the run is closed. */
  claim(player: string, seed: string, slot: number, right: boolean): Promise<boolean | 'busy'>;
  /** Closes an open run with its result and saves the progress, together. False if it was closed or the version moved on. */
  finish(player: string, seed: string, version: number, progress: Progress, result: FinishedRun): Promise<boolean | 'busy'>;
  savePicks(player: string, picks: Picks): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Points inside the hub's daily cap (once per `once`). A failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  /** Achievements are checked again. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

/** An answer sign as the browser sees it: the sum to show and the number on each gap. */
export interface GapSign {
  slot: number;
  parts: string[];
  spoken: string;
  labels: number[];
}

export interface StartReply {
  seed: string;
  level: string;
  gentle: boolean;
  maths: boolean;
  checks: PublicQuestion[];
  signs: GapSign[];
  readTime: boolean;
}

export interface FinishReply {
  valid: boolean;
  score: Score;
  medal: Medal;
  unlocks: Unlocks;
  progress: Progress;
  signs: Array<{ parts: string[]; answer: number; right: number; picked: number | null }>;
}

const MAX_ANSWER_MS = 120_000;
const busy = (): Reply => ({ status: 503, body: { error: 'The server is busy. Try again in a moment.', code: 'busy' } });
const bad = (why = 'That couldn’t be read.'): Reply => ({ status: 400, body: { error: why, code: 'bad' } });

/** A question short enough for a sign read while flying: no instructions, no picture labels, a plain number answer. */
export function fitsSign(q: Question | null | undefined): q is Question {
  if (!q || q.prompt || q.choiceLabels || !markQuestion(q)) return false;
  if (!Number.isFinite(q.answer) || q.answer < 0 || Math.round(q.answer * 100) !== q.answer * 100) return false;
  return q.parts.join(' ').length <= 16 && !q.parts.some((p) => p.includes('/'));
}

function confidence(pack: SkillPack, s: MathsQuestionSettings): Question | null {
  const ctx = { enabledTables: s.enabledTables, division: s.division, missingFactor: s.missingFactor, multipleChoice: false, boxes: [3, 4] };
  if (pack instanceof TimesTables) return pack.nextQuestion({ level: readyLevel(pack.stats(), s.enabledTables), ...ctx });
  return pack.nextQuestion(ctx);
}

/**
 * A run's questions: one per check from the focus pack as it comes (60% focus, 30% review, 10% stretch), then one per
 * answer sign from the pupil's confidence builders that fits a sign (falling back to any that fits). Every one can be marked.
 */
export function makeRunQuestions(context: MathsContext, course: Course, random: () => number): Question[] {
  const plan = slotPlan(course);
  const pack = makeSpacePack(context.facts, context.focus, context.settings, random);
  const out: Question[] = [];
  const seen = new Set<string>();
  for (let tries = 0; out.length < plan.checks && tries < plan.checks * 10; tries++) {
    const q = pickSpaceQuestion(pack, context.settings);
    if (!q || !markQuestion(q)) continue;
    if (seen.has(q.factKey) && tries < plan.checks * 6) continue;
    seen.add(q.factKey);
    out.push({ ...q, id: out.length });
  }
  for (let g = 0; g < plan.gaps; g++) {
    let q: Question | null = null;
    for (let tries = 0; tries < 12 && !fitsSign(q); tries++) q = tries < 6 ? confidence(pack, context.settings) : pickSpaceQuestion(pack, context.settings);
    if (!fitsSign(q)) q = new TimesTables().nextQuestion({ level: 1, multipleChoice: false });
    if (q) out.push({ ...q, id: out.length });
  }
  return out;
}

const seedText = (random: () => number) => `${Math.floor(random() * 1e9)}${Math.floor(random() * 1e9)}`.padStart(12, '0').slice(0, 18);
const isSeed = (v: unknown): v is string => typeof v === 'string' && /^[0-9]{6,18}$/.test(v);
const isFlyer = (v: unknown): v is string => typeof v === 'string' && /^[a-z-]{2,30}$/.test(v);

export async function handleToonFlap(services: ToonFlapServices, player: string, body: Record<string, unknown>): Promise<Reply> {
  const action = body.action;
  if (action === 'load') {
    const [settings, saved] = await Promise.all([services.settings(player), services.load(player)]);
    if (!settings || saved === 'busy') return busy();
    return { status: 200, body: { enabled: settings.enabled, maths: settings.maths, readTime: settings.readTime, progress: saved.progress, picks: saved.picks } };
  }

  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return { status: 403, body: { error: 'Toon Flap isn’t switched on for your class yet.', code: 'off' } };

  if (action === 'picks') {
    const saved = await services.load(player);
    if (saved === 'busy') return busy();
    const flyer = body.flyer;
    const trail = body.trail === null ? null : body.trail;
    if (!isFlyer(flyer) || (trail !== null && !isFlyer(trail))) return bad();
    if (!flyersUnlocked(saved.progress).includes(flyer) || (trail !== null && !trailsUnlocked(saved.progress).includes(trail))) {
      return { status: 409, body: { error: 'That one isn’t unlocked yet.', code: 'locked' } };
    }
    const ok = await services.savePicks(player, { flyer, trail });
    return ok === 'busy' ? busy() : { status: 200, body: { picks: { flyer, trail } } };
  }

  if (action === 'start') {
    const def = typeof body.level === 'string' ? levelById(body.level) : undefined;
    if (!def) return bad();
    const gentle = body.gentle === true;
    const [saved, today] = await Promise.all([services.load(player), services.runsToday(player, nzDate(new Date(services.now())))]);
    if (saved === 'busy' || today === 'busy') return busy();
    if (!levelOpen(saved.progress, def.n)) return { status: 409, body: { error: 'Finish the level before first.', code: 'locked' } };
    if (today.started >= BREAK_AFTER_RUNS) return { status: 429, body: { error: 'Time for a break? Your wings need a rest. Come back tomorrow!', code: 'break' } };
    const course = buildCourse(def, gentle);
    const seed = seedText(services.random);
    let questions: Question[] = [];
    if (settings.maths) {
      const context = await services.maths(player);
      if (context === 'busy') return busy();
      questions = makeRunQuestions(context, course, services.random);
    }
    const plan = slotPlan(course);
    const right = rightGaps(course, seed);
    const labels = course.signs.map((sign, i) => {
      const q = questions[plan.checks + i];
      return q ? gapLabels(q.answer, course.walls[sign.wall].gaps.length, right[i], seed, q.choices) : [];
    });
    const kept = await services.start(player, seed, { level: def.id, gentle, maths: settings.maths, questions, labels });
    if (kept === 'busy') return busy();
    if (!kept) return { status: 409, body: { error: 'Try again.', code: 'again' } };
    const reply: StartReply = {
      seed,
      level: def.id,
      gentle,
      maths: settings.maths,
      checks: questions.slice(0, plan.checks).map((q, slot) => publicQuestion(q, slot)),
      signs: settings.maths
        ? course.signs.map((_, i) => {
          const q = questions[plan.checks + i];
          return { slot: plan.checks + i, parts: q?.parts ?? [], spoken: q?.spoken ?? '', labels: labels[i] };
        })
        : [],
      readTime: settings.readTime && READ_TIME_LEVELS.includes(def.n),
    };
    return { status: 200, body: reply as unknown as Record<string, unknown> };
  }

  if (action === 'answer') {
    const { seed, slot, value, ms } = body;
    if (!isSeed(seed) || !Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value)) return bad();
    const run = await services.run(player, seed);
    if (run === 'busy') return busy();
    if (!run) return { status: 404, body: { error: 'That run isn’t yours.', code: 'not-yours' } };
    const def = levelById(run.level);
    const n = slot as number;
    if (!def || n < 0 || n >= slotPlan(buildCourse(def, run.gentle)).checks) return bad();
    const marked = markQuestion(run.questions[n]);
    if (!marked) return bad();
    const right = sameAnswer(value, marked.answer);
    const claimed = await services.claim(player, seed, n, right);
    if (claimed === 'busy') return busy();
    // Asked again (a retry): the first mark stands and nothing is recorded twice.
    if (!claimed) return { status: 200, body: { correct: run.marks[String(n)] ?? false, answer: marked.answer, again: true } };
    const time = typeof ms === 'number' && Number.isFinite(ms) ? Math.max(0, Math.min(MAX_ANSWER_MS, Math.round(ms))) : MAX_ANSWER_MS;
    await services.recordAnswers(player, `${seed}:${n}`, [{ key: marked.key, correct: right, ms: time, at: services.now() }]);
    return { status: 200, body: { correct: right, answer: marked.answer } };
  }

  if (action === 'finish') {
    const { seed } = body;
    if (!isSeed(seed) || typeof body.flaps !== 'string') return bad();
    const flaps = decodeFlaps(body.flaps);
    if (!flaps) return bad();
    const [run, saved] = await Promise.all([services.run(player, seed), services.load(player)]);
    if (run === 'busy' || saved === 'busy') return busy();
    if (!run) return { status: 404, body: { error: 'That run isn’t yours.', code: 'not-yours' } };
    if (!run.open) return { status: 409, body: { error: 'That run is already saved.', code: 'ended' } };
    const def = levelById(run.level);
    if (!def) return bad();
    const course = buildCourse(def, run.gentle);
    const replay = replayRun(course, flaps);
    if (!replay.valid || replay.state.outcome !== 'finished') return { status: 422, body: { error: 'That run couldn’t be checked.', code: 'not-done' } };
    // Real time can't be shorter than the flying (hovering only adds time), so a made-up run can't be quicker than playing.
    if (services.now() - run.startedAt < (replay.state.t / STEPS_PER_SECOND) * 1000 * 0.95) {
      return { status: 422, body: { error: 'That run couldn’t be checked.', code: 'too-fast' } };
    }
    const plan = slotPlan(course);
    const right = rightGaps(course, seed);
    const checks = course.perches.slice(0, replay.state.perches).map((_, slot) => run.marks[String(slot)] === true);
    const gapsOk = run.maths ? gapsRight(replay.state.picks, right) : 0;
    const potion = body.potion === true && saved.progress.potions > 0 && replay.state.bumps > 0;
    const score = scoreRun(replay.state, { checksRight: checks.filter(Boolean).length, gapsRight: gapsOk, potion });
    const medal = medalFor(course, score.seconds, run.maths, run.gentle);
    const added = addRun(saved.progress, { level: def.id, maths: run.maths, seconds: score.seconds, medal, bumps: replay.state.bumps, checks, rightGaps: gapsOk, potionUsed: score.potion });
    const today = await services.runsToday(player, nzDate(new Date(services.now())));
    const done = await services.finish(player, seed, saved.version, added.progress, {
      flaps: body.flaps, seconds: score.seconds, medal, bumps: replay.state.bumps, checksRight: checks.filter(Boolean).length, gapsRight: gapsOk, potion: score.potion,
    });
    if (done === 'busy') return busy();
    if (!done) return { status: 409, body: { error: 'That run is already saved.', code: 'ended' } };
    // The answer gaps count as maths answers too (picked while flying, so counted as steady, not quick).
    if (run.maths) {
      const gapAnswers: FactAnswer[] = [];
      course.signs.forEach((_, i) => {
        const marked = markQuestion(run.questions[plan.checks + i]);
        const picked = replay.state.picks[i];
        if (marked && picked !== null) gapAnswers.push({ key: marked.key, correct: picked === right[i], ms: SIGN_SECONDS * 1000, at: services.now() });
      });
      if (gapAnswers.length) await services.recordAnswers(player, `${seed}:gaps`, gapAnswers);
    }
    const finishedToday = today === 'busy' ? POINT_RUNS_A_DAY : today.finished;
    if (finishedToday < POINT_RUNS_A_DAY) {
      const points = POINTS.finish + (added.unlocks.firstFinish ? POINTS.firstFinish : 0) + (added.unlocks.newGold ? POINTS.newGold : 0);
      await services.awardPoints(player, points, `toonflap:${seed}`);
    }
    await services.progressChanged(player);
    const reply: FinishReply = {
      valid: true,
      score,
      medal,
      unlocks: added.unlocks,
      progress: added.progress,
      signs: course.signs.map((_, i) => ({
        parts: run.questions[plan.checks + i]?.parts ?? [],
        answer: run.questions[plan.checks + i]?.answer ?? NaN,
        right: right[i],
        picked: replay.state.picks[i],
      })),
    };
    return { status: 200, body: reply as unknown as Record<string, unknown> };
  }

  return bad();
}
