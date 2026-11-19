/**
 * What the Goblin Storm screens need from a server (docs/GOBLINSTORM-PLAN.md, "Server"). The real one is the
 * `goblinstorm` function (liveBackend.ts), which makes and marks the questions (way A) and replays the run itself. The
 * stand-in below is for the preview: it lives in the browser, uses a fixed pretend focus and never calls the live site.
 */
import { CHOICES, HEROES, MAPS, QUESTIONS_PER_RUN, type HeroId } from '../../../shared/goblinstorm/config';
import { replayRun, choicesFor, decodeSteering } from '../../../shared/goblinstorm/replay';
import type { RunSummary } from '../../../shared/goblinstorm/engine';
import { AUTO_FOCUS, type MathsFocus } from '../../../shared/maths/focus';
import { quickMsForPack } from '../../../shared/maths/config';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, seededRandom, type PublicQuestion } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';

import { factText, type Mark } from '../../../shared/goblinstorm/server';

export { factText, type Mark };

export interface StartReply {
  seed: number;
  hero: HeroId;
  map: number;
  /** Up to 40 questions, one per level-up slot (never their answers). */
  questions: PublicQuestion[];
  quickMs: number;
}

export interface AnswerReply { mark: Mark; correct: boolean; answer: number; fact: string }

export interface FinishReply { valid: boolean; summary: RunSummary }

export interface GoblinStormBackend {
  start(hero: HeroId, map: number): Promise<StartReply>;
  answer(seed: number, slot: number, value: number, ms: number): Promise<AnswerReply>;
  finish(seed: number, steering: string, picks: number[]): Promise<FinishReply>;
}

/** The preview's pretend focus: the times tables, as if the teacher had set them. */
export const PREVIEW_FOCUS: MathsFocus = { ...AUTO_FOCUS, source: 'teacher-class', skills: ['times-tables'], onlyThese: false };

interface Kept { hero: HeroId; map: number; questions: Question[]; marks: (Mark | null)[] }

/** The stand-in server: makes questions from the pretend focus, marks them once, and replays the run like the real one will. */
export function standInBackend(focus: MathsFocus = PREVIEW_FOCUS, multipleChoice = false): GoblinStormBackend {
  const runs = new Map<number, Kept>();
  const quickMs = quickMsForPack(null);
  return {
    async start(hero, map) {
      const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      const questions = makeRunQuestions({ facts: [], settings: { multipleChoice }, focus }, QUESTIONS_PER_RUN, seededRandom(`goblinstorm:${seed}`));
      runs.set(seed, { hero, map, questions, marks: questions.map(() => null) });
      return { seed, hero, map, questions: questions.map((q, i) => publicQuestion(q, i)), quickMs };
    },
    async answer(seed, slot, value, ms) {
      const run = runs.get(seed);
      const q = run?.questions[slot];
      const marked = markQuestion(q);
      if (!run || !q || !marked) return { mark: 'wrong', correct: false, answer: NaN, fact: '' };
      const correct = sameAnswer(value, marked.answer);
      // Only the first answer to a slot counts.
      const mark: Mark = run.marks[slot] ?? (correct ? (ms <= quickMs ? 'quick' : 'right') : 'wrong');
      run.marks[slot] = mark;
      return { mark, correct: mark !== 'wrong', answer: marked.answer, fact: factText(q.parts, marked.answer) };
    },
    async finish(seed, steering, picks) {
      const run = runs.get(seed);
      const dirs = decodeSteering(steering);
      const hero = HEROES.find((h) => h.id === run?.hero);
      const map = run ? MAPS[run.map] : undefined;
      if (!run || !dirs || !hero || !map) throw new Error('No such run');
      // A slot with no question (the focus ran short) gives the "right" 3 cards, as the play screen does.
      const choices = Array.from({ length: QUESTIONS_PER_RUN }, (_, i) => (i < run.questions.length ? choicesFor(run.marks[i] ?? 'wrong') : CHOICES.right));
      const r = replayRun({ setup: { seed, hero, map, shop: {} }, steering: dirs, picks, choices });
      return { valid: r.valid, summary: r.summary };
    },
  };
}

/** A refusal from the server, with its words for the pupil and its code ('done-today', 'locked', 'game-off' …). */
export class GoblinStormError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

type Send = (body: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> }>;

/** The screens' backend over any server that answers like the `goblinstorm` function (shared/goblinstorm/server.ts). */
export function fromServer(send: Send): GoblinStormBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new GoblinStormError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    start: async (hero, map) => (await ask({ action: 'start', hero, map })) as unknown as StartReply,
    answer: async (seed, slot, value, ms) => (await ask({ action: 'answer', seed, slot, value, ms })) as unknown as AnswerReply,
    finish: async (seed, steering, picks) => (await ask({ action: 'finish', seed, steering, picks })) as unknown as FinishReply,
  };
}
