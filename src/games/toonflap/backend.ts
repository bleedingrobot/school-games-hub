/**
 * What Toon Flap's screens need from a server, and the trial backend that plays the server's part in the browser for the
 * preview (docs/TOON-FLAP-PLAN.md, stage F.2). The real one (stage F.3) calls the `toonflap` function with the same shapes.
 * The trial backend uses the shared rules exactly as the server will: it makes the questions (way A), keeps the answers to
 * itself, replays the flaps and works out the time, medal and unlocks.
 */
import { addRun, emptyProgress, type Progress, type Unlocks } from '../../../shared/toonflap/collection';
import { READ_TIME_LEVELS } from '../../../shared/toonflap/config';
import { decodeFlaps, medalFor, replayRun, scoreRun, type Medal, type Score } from '../../../shared/toonflap/engine';
import { buildCourse, levelById, LEVELS } from '../../../shared/toonflap/levels';
import { gapLabels, gapsRight, rightGaps, slotPlan } from '../../../shared/toonflap/maths';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, type PublicQuestion } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';

/** An answer sign: a short sum, and the number on each gap (bottom to top). Which one is right stays on the server. */
export interface GapSign {
  slot: number;
  parts: string[];
  spoken: string;
  labels: number[];
}

export interface Picks {
  flyer: string;
  trail: string | null;
}

export interface Loaded {
  progress: Progress;
  /** The teacher's maths switch: off means checks are plain rests and gaps show arrows. */
  maths: boolean;
  picks: Picks;
}

export interface StartReply {
  seed: string;
  level: string;
  gentle: boolean;
  maths: boolean;
  /** One question per check (perch), in order. Empty with maths off. */
  checks: PublicQuestion[];
  /** One per answer sign, in order. Empty with maths off. */
  signs: GapSign[];
  /** Pause at each sign until Go (levels 3 to 5 by default). */
  readTime: boolean;
}

export interface CheckMark {
  correct: boolean;
  answer: number;
}

export interface FinishReply {
  valid: boolean;
  score: Score;
  medal: Medal;
  unlocks: Unlocks;
  progress: Progress;
  /** Each answer sign with its answer and the gap that was right, for the results screen. */
  signs: Array<{ parts: string[]; answer: number; right: number; picked: number | null }>;
}

export interface ToonFlapBackend {
  load(): Promise<Loaded>;
  savePicks(picks: Picks): Promise<void>;
  start(level: string, gentle: boolean): Promise<StartReply>;
  /** Marks a check's answer once; asking again for the same slot gives the first mark. */
  answer(seed: string, slot: number, value: number, ms: number): Promise<CheckMark>;
  /** `flaps` is encodeFlaps() of the step numbers. */
  finish(seed: string, flaps: string, potionUsed: boolean): Promise<FinishReply>;
}

interface Kept {
  progress: Progress;
  picks: Picks;
  maths: boolean;
}

interface Pending {
  level: string;
  gentle: boolean;
  maths: boolean;
  questions: Question[];
  marks: Map<number, boolean>;
  labels: number[][];
}

/** The pretend server for the preview. Everything is kept in this browser (`storageKey`), so a reload carries on. */
export function trialBackend(opts: { storageKey: string; random?: () => number }) {
  const random = opts.random ?? Math.random;
  const read = (): Kept => {
    try {
      const raw = localStorage.getItem(opts.storageKey);
      if (raw) return JSON.parse(raw) as Kept;
    } catch {
      // A private window: start fresh.
    }
    return { progress: emptyProgress(), picks: { flyer: 'fantail', trail: null }, maths: true };
  };
  let kept = read();
  const save = () => {
    try {
      localStorage.setItem(opts.storageKey, JSON.stringify(kept));
    } catch {
      // Nothing to do: it lasts until the page closes.
    }
  };
  const runs = new Map<string, Pending>();

  const backend: ToonFlapBackend = {
    load: async () => ({ progress: kept.progress, maths: kept.maths, picks: kept.picks }),
    savePicks: async (picks) => {
      kept = { ...kept, picks };
      save();
    },
    start: async (level, gentle) => {
      const def = levelById(level) ?? LEVELS[0];
      const course = buildCourse(def, gentle);
      const seed = `trial-${Math.floor(random() * 1e9)}`;
      const plan = slotPlan(course);
      const questions = kept.maths ? makeRunQuestions({ facts: [], settings: {} }, plan.total, random) : [];
      const right = rightGaps(course, seed);
      const labels = course.signs.map((sign, i) => {
        const q = questions[plan.checks + i];
        const n = course.walls[sign.wall].gaps.length;
        return q ? gapLabels(q.answer, n, right[i], seed, q.choices) : [];
      });
      runs.set(seed, { level: def.id, gentle, maths: kept.maths, questions, marks: new Map(), labels });
      return {
        seed,
        level: def.id,
        gentle,
        maths: kept.maths,
        checks: questions.slice(0, plan.checks).map((q, slot) => publicQuestion(q, slot)),
        signs: kept.maths ? course.signs.map((_, i) => {
          const q = questions[plan.checks + i];
          return { slot: plan.checks + i, parts: q?.parts ?? [], spoken: q?.spoken ?? '', labels: labels[i] };
        }) : [],
        readTime: READ_TIME_LEVELS.includes(def.n),
      };
    },
    answer: async (seed, slot, value) => {
      const run = runs.get(seed);
      const marked = markQuestion(run?.questions[slot]);
      if (!run || !marked) return { correct: false, answer: NaN };
      if (!run.marks.has(slot)) run.marks.set(slot, sameAnswer(value, marked.answer));
      return { correct: run.marks.get(slot) as boolean, answer: marked.answer };
    },
    finish: async (seed, flapText, potionUsed) => {
      const run = runs.get(seed);
      const def = levelById(run?.level ?? '') ?? LEVELS[0];
      const course = buildCourse(def, run?.gentle ?? false);
      const flaps = decodeFlaps(flapText);
      const replay = replayRun(course, flaps ?? []);
      const right = rightGaps(course, seed);
      const plan = slotPlan(course);
      const checks = course.perches.slice(0, replay.state.perches).map((_, slot) => run?.marks.get(slot) === true);
      const potion = potionUsed && kept.progress.potions > 0;
      const gapsOk = run?.maths ? gapsRight(replay.state.picks, right) : 0;
      const score = scoreRun(replay.state, { checksRight: checks.filter(Boolean).length, gapsRight: gapsOk, potion });
      const valid = !!run && !!flaps && replay.valid && replay.state.outcome === 'finished';
      const medal = medalFor(course, score.seconds, run?.maths ?? false, run?.gentle ?? false);
      let unlocks: Unlocks = { flyers: [], trails: [], potion: false, newGold: false, firstFinish: false, newBest: false };
      if (valid && run) {
        const added = addRun(kept.progress, { level: def.id, maths: run.maths, seconds: score.seconds, medal, bumps: replay.state.bumps, checks, rightGaps: gapsOk, potionUsed: potion });
        kept = { ...kept, progress: added.progress };
        unlocks = added.unlocks;
        save();
        runs.delete(seed);
      }
      return {
        valid,
        score,
        medal,
        unlocks,
        progress: kept.progress,
        signs: course.signs.map((_, i) => ({
          parts: run?.questions[plan.checks + i]?.parts ?? [],
          answer: run?.questions[plan.checks + i]?.answer ?? NaN,
          right: right[i],
          picked: replay.state.picks[i],
        })),
      };
    },
  };

  /** Preview-only buttons. */
  const tools = {
    openAll: () => {
      const levels = { ...kept.progress.levels };
      for (const l of LEVELS) levels[l.id] = { finishes: Math.max(levels[l.id]?.finishes ?? 0, 1), best: levels[l.id]?.best ?? null, bestPlain: levels[l.id]?.bestPlain ?? null, medal: levels[l.id]?.medal ?? 'bronze' };
      kept = { ...kept, progress: { ...kept.progress, levels } };
      save();
    },
    unlockAll: () => {
      const levels = { ...kept.progress.levels };
      for (const l of LEVELS) levels[l.id] = { finishes: 3, best: levels[l.id]?.best ?? null, bestPlain: levels[l.id]?.bestPlain ?? null, medal: 'gold' };
      kept = { ...kept, progress: { ...kept.progress, levels, checksRight: 20, cleanFlights: 3, potions: 3 } };
      save();
    },
    setMaths: (on: boolean) => {
      kept = { ...kept, maths: on };
      save();
    },
    maths: () => kept.maths,
    restart: () => {
      kept = { progress: emptyProgress(), picks: { flyer: 'fantail', trail: null }, maths: kept.maths };
      save();
    },
  };
  return { backend, tools };
}
