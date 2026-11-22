/**
 * What the Goblin Storm screens need from a server (docs/GOBLINSTORM-PLAN.md, "Server"). The real one is the
 * `goblinstorm` function (liveBackend.ts), which makes and marks the questions (way A) and replays the run itself. The
 * stand-in below is for the preview: it lives in the browser, uses a fixed pretend focus and never calls the live site.
 */
import { CHOICES, HEROES, LEGENDARY, MAPS, QUESTIONS_PER_RUN, type HeroId, type LegendaryId, type ShopId, type ShopLevels } from '../../../shared/goblinstorm/config';
import { buy as buyLevel, buyLegend } from '../../../shared/goblinstorm/shop';
import { replayRun, choicesFor, decodeSteering } from '../../../shared/goblinstorm/replay';
import type { RunSummary } from '../../../shared/goblinstorm/engine';
import { AUTO_FOCUS, type MathsFocus } from '../../../shared/maths/focus';
import { quickMsForPack } from '../../../shared/maths/config';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, seededRandom, type PublicQuestion } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';

import { factText, freshSave, newUnlocks, RUNS_A_DAY, type Mark, type Save } from '../../../shared/goblinstorm/server';

export { factText, type Mark };

/** The pupil's own save, as `my_goblinstorm()` gives it: what's open, plus totals for the screens. */
export interface MySave extends Save {
  /** Weapons evolved (the Codex's evolution pages). */
  codex: string[];
  /** Every weapon ever picked up (the Codex's weapon pages). */
  weapons: string[];
  runs: number;
  /** The most gold from one run (shown instead of gold once the shop is all bought). */
  bestGold: number;
  /** Runs started today (NZ date). */
  today: number;
  /** Has had the guided first go (or skipped it), on any device. */
  guideSeen: boolean;
}

export const emptySave = (): MySave => ({ ...freshSave(), codex: [], weapons: [], runs: 0, today: 0, bestGold: 0, guideSeen: false });

export interface StartReply {
  seed: number;
  hero: HeroId;
  map: number;
  /** Up to 40 questions, one per level-up slot (never their answers). */
  questions: PublicQuestion[];
  quickMs: number;
  /** The shop this run plays with, kept by the server at start (buying mid-run changes nothing). */
  shop: ShopLevels;
  /** Normal runs left today after this one; null on an Unlimited day (the stand-in leaves it out). */
  runsLeft?: number | null;
}

/** The answer to a shop purchase: the gold and shop now, and why not if it wasn't bought. */
export interface BuyReply {
  bought: boolean;
  /** 'locked': a Legendary upgrade before the whole shop is bought. */
  reason: null | 'gold' | 'top' | 'none' | 'locked';
  gold: number;
  shop: ShopLevels;
}

export interface AnswerReply { mark: Mark; correct: boolean; answer: number; fact: string }

export interface FinishReply {
  valid: boolean;
  summary: RunSummary;
  /** Heroes this run opened (worked out on the server from the replay). */
  unlocked?: HeroId[];
}

export interface GoblinStormBackend {
  /** The pupil's own save: which heroes and maps are open. */
  me(): Promise<MySave>;
  start(hero: HeroId, map: number): Promise<StartReply>;
  answer(seed: number, slot: number, value: number, ms: number): Promise<AnswerReply>;
  finish(seed: number, steering: string, picks: number[]): Promise<FinishReply>;
  /** Buys the next level of one shop item with the pupil's own gold (live: the `buy_goblinstorm()` database function). */
  buy(item: ShopId | LegendaryId): Promise<BuyReply>;
  /** Notes that the pupil has had the guided first go (live: the `goblinstorm_guide_seen()` database function). */
  guideSeen(): Promise<void>;
}

/** The preview's pretend focus: the times tables, as if the teacher had set them. */
export const PREVIEW_FOCUS: MathsFocus = { ...AUTO_FOCUS, source: 'teacher-class', skills: ['times-tables'], onlyThese: false };

interface Kept { hero: HeroId; map: number; questions: Question[]; marks: (Mark | null)[]; shop: ShopLevels }

/**
 * The stand-in server: makes questions from the pretend focus, marks them once, and replays the run like the real one
 * will. It keeps a pretend save in the page (gone on reload), opening heroes and maps the way the server does.
 */
export function standInBackend(focus: MathsFocus = PREVIEW_FOCUS, multipleChoice = false, start: MySave = emptySave()): GoblinStormBackend {
  const runs = new Map<number, Kept>();
  const quickMs = quickMsForPack(null);
  const save: MySave = { ...start, heroes: [...start.heroes], bosses: [...start.bosses], codex: [...start.codex], weapons: [...start.weapons], shop: { ...start.shop } };
  return {
    async me() {
      return { ...save, heroes: [...save.heroes], bosses: [...save.bosses], codex: [...save.codex], weapons: [...save.weapons], shop: { ...save.shop } };
    },
    async start(hero, map) {
      // The same 5-a-day rule as the server (no Unlimited today in the preview).
      if (save.today >= RUNS_A_DAY) throw new GoblinStormError('All done for today. See you tomorrow!', 'done-today');
      const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      const questions = makeRunQuestions({ facts: [], settings: { multipleChoice }, focus }, QUESTIONS_PER_RUN, seededRandom(`goblinstorm:${seed}`));
      runs.set(seed, { hero, map, questions, marks: questions.map(() => null), shop: { ...save.shop } });
      save.today++;
      return { seed, hero, map, questions: questions.map((q, i) => publicQuestion(q, i)), quickMs, shop: { ...save.shop }, runsLeft: RUNS_A_DAY - save.today };
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
      const r = replayRun({ setup: { seed, hero, map, shop: run.shop }, steering: dirs, picks, choices });
      if (!r.valid) return { valid: false, summary: r.summary };
      runs.delete(seed);
      const unlocked = newUnlocks(save, r.summary, run.map);
      save.heroes.push(...unlocked);
      if (r.summary.bossBeaten && !save.bosses.includes(run.map)) save.bosses.push(run.map);
      save.gold += r.summary.gold;
      save.kills += r.summary.kills;
      save.runs++;
      save.codex = [...new Set([...save.codex, ...r.summary.evolved])].sort();
      save.weapons = [...new Set([...save.weapons, ...r.summary.weapons])].sort();
      save.bestGold = Math.max(save.bestGold, r.summary.gold);
      return { valid: true, summary: r.summary, unlocked };
    },
    async buy(item) {
      const done = item in LEGENDARY ? buyLegend(save, item as LegendaryId) : buyLevel(save, item as ShopId);
      if (typeof done === 'string') return { bought: false, reason: done, gold: save.gold, shop: { ...save.shop } };
      save.gold = done.gold;
      save.shop = done.shop;
      return { bought: true, reason: null, gold: save.gold, shop: { ...save.shop } };
    },
    async guideSeen() {
      save.guideSeen = true;
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

/**
 * The screens' backend over any server that answers like the `goblinstorm` function (shared/goblinstorm/server.ts).
 * `loadSave` reads the pupil's own save (live: the `my_goblinstorm()` database function) and `buy` spends its gold
 * (live: `buy_goblinstorm()`, which needs no replay, so it isn't a server action). `guideSeen` notes the guided first
 * go (live: `goblinstorm_guide_seen()`).
 */
export function fromServer(send: Send, loadSave: () => Promise<Partial<MySave>>, buy: (item: ShopId | LegendaryId) => Promise<BuyReply>, guideSeen: () => Promise<void>): GoblinStormBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new GoblinStormError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    me: async () => ({ ...emptySave(), ...(await loadSave()) }),
    start: async (hero, map) => (await ask({ action: 'start', hero, map })) as unknown as StartReply,
    answer: async (seed, slot, value, ms) => (await ask({ action: 'answer', seed, slot, value, ms })) as unknown as AnswerReply,
    finish: async (seed, steering, picks) => (await ask({ action: 'finish', seed, steering, picks })) as unknown as FinishReply,
    buy,
    guideSeen,
  };
}
