/**
 * What the `bonkers` server function does with a request from a signed-in pupil (docs/BONKERS-PLAN.md, stage B.1). The
 * function (supabase/functions/bonkers/handler.ts) checks the sign-in and the rate first; the preview's trial backend
 * calls this with services kept in the browser (memoryServices.ts), so both run exactly the same rules. Built like
 * Toon Flap (shared/toonflap/server.ts).
 *
 *   load    the pupil's hero and progress, adventures waiting, today's two quests and any adventure still going;
 *   hero    picks the class (once: kept all season) and the look (can change any time);
 *   start   uses up an adventure (not while the teacher's "Unlimited today" is on), makes the fights from a fresh seed
 *           and 80 questions from the pupil's own focus (way A, always 4 choices), and keeps them; the browser gets the
 *           fights and only the question to show now;
 *   answer  marks the next question once (in order), with the special move if it was used, records it, and sends the
 *           next question; the browser replays the marks with the same rules (engine.ts) to show the fight;
 *   finish  replays the whole adventure from the server's marks, saves the stars, level, gear and stickers, gives points.
 *
 * Nothing that counts comes from the browser: not the marks, the damage, the stars or the chest.
 */
import type { FactAnswer } from '../maths/leitner';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, type MathsContext, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { nzDate } from '../kit/dayArc';
import { MAX_ANSWER_MS, QUESTIONS_AN_ADVENTURE } from './config';
import {
  adventuresWaiting, emptyProgress, isHeroClass, isLook, makeAdventure, parseQuest, questOptions, replay, rewardsFor,
  type Adventure, type Mark, type Progress, type Quest, type Rewards,
} from './engine';

export interface Saved {
  progress: Progress;
  /** Goes up by one on every save; a save is kept only if it still matches (0: never played). */
  version: number;
}

export const unplayed = (): Saved => ({ progress: emptyProgress(), version: 0 });

export interface Settings {
  enabled: boolean;
  /** The teacher's "Unlimited today" switch for Bonkers Quest: adventures aren't used up. Missing means off. */
  unlimited?: boolean;
}

/** An adventure as it's kept: everything needed to mark and replay it. */
export interface KeptAdventure {
  seed: string;
  adventure: Adventure;
  questions: Question[];
  marks: Mark[];
  open: boolean;
}

export interface BonkersServices {
  now(): number;
  random(): number;
  settings(player: string): Promise<Settings | null>;
  load(player: string): Promise<Saved | 'busy'>;
  maths(player: string): Promise<MathsContext | 'busy'>;
  /** The pupil's open adventure, if there is one. */
  current(player: string): Promise<KeptAdventure | null | 'busy'>;
  /** Saves the hero. False if the version moved on. */
  saveHero(player: string, version: number, progress: Progress): Promise<boolean | 'busy'>;
  /**
   * Keeps a new adventure and saves the progress (an adventure used up), together. False if the pupil has used this
   * seed, already has one open, or the version moved on.
   */
  start(player: string, version: number, progress: Progress, kept: Omit<KeptAdventure, 'marks' | 'open'>): Promise<boolean | 'busy'>;
  /** Adds the mark for `slot` (it must be the next one). False if it isn't next or the adventure is closed. */
  mark(player: string, seed: string, slot: number, mark: Mark): Promise<boolean | 'busy'>;
  /** Closes the open adventure and saves the progress, together. False if it was closed or the version moved on. */
  finish(player: string, seed: string, version: number, progress: Progress, result: FinishedAdventure): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Points inside the hub's daily cap (once per `once`). A failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  /** Achievements are checked again. A failure is only logged. */
  progressChanged(player: string): Promise<void>;
}

/** What's saved with a finished adventure, for the teacher and for checking. */
export interface FinishedAdventure {
  fightsWon: number;
  fights: number;
  rights: number;
  questions: number;
  questDone: boolean;
  trainerMet: boolean;
  trainerWon: boolean;
  stars: number;
  level: number;
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

/** An adventure as the browser sees it: the fights, the marks so far, and the question to show now (null: all done). */
export interface AdventureView {
  seed: string;
  adventure: Adventure;
  marks: Mark[];
  question: PublicQuestion | null;
}

export interface LoadReply {
  enabled: boolean;
  progress: Progress;
  today: string;
  /** Adventures waiting (null: Unlimited today is on). */
  waiting: number | null;
  quests: [Quest, Quest];
  current: AdventureView | null;
}

export interface AnswerReply {
  correct: boolean;
  answer: number;
  marks: Mark[];
  question: PublicQuestion | null;
  /** Asked again: the first mark stands. */
  again?: boolean;
}

export interface FinishReply extends Rewards {
  waiting: number | null;
  quests: [Quest, Quest];
}

const busy = (): Reply => ({ status: 503, body: { error: 'The server is busy. Try again in a moment.', code: 'busy' } });
const bad = (why = 'That couldn’t be read.'): Reply => ({ status: 400, body: { error: why, code: 'bad' } });
const ok = (body: object): Reply => ({ status: 200, body: body as Record<string, unknown> });

const seedText = (random: () => number) => `${Math.floor(random() * 1e9)}${Math.floor(random() * 1e9)}`.padStart(12, '0').slice(0, 18);
const isSeed = (v: unknown): v is string => typeof v === 'string' && /^[0-9]{6,18}$/.test(v);

/** The question for a slot (the list is longer than any adventure needs; it goes round again just in case). */
const questionAt = (kept: Pick<KeptAdventure, 'questions'>, slot: number): Question | undefined =>
  kept.questions.length ? kept.questions[slot % kept.questions.length] : undefined;

export function view(kept: KeptAdventure): AdventureView {
  const r = replay(kept.adventure, kept.marks);
  const q = r.phase === 'done' ? undefined : questionAt(kept, kept.marks.length);
  return { seed: kept.seed, adventure: kept.adventure, marks: kept.marks, question: q ? publicQuestion(q, kept.marks.length) : null };
}

const quests = (player: string, today: string, p: Progress) => questOptions(player, today, p.level, p.stats.adventures);

export async function handleBonkers(services: BonkersServices, player: string, body: Record<string, unknown>): Promise<Reply> {
  const action = body.action;
  const today = nzDate(new Date(services.now()));

  if (action === 'load') {
    const [settings, saved, current] = await Promise.all([services.settings(player), services.load(player), services.current(player)]);
    if (!settings || saved === 'busy' || current === 'busy') return busy();
    const reply: LoadReply = {
      enabled: settings.enabled,
      progress: saved.progress,
      today,
      waiting: settings.unlimited ? null : adventuresWaiting(saved.progress, today),
      quests: quests(player, today, saved.progress),
      current: current?.open ? view(current) : null,
    };
    return ok(reply);
  }

  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return { status: 403, body: { error: 'Bonkers Quest isn’t switched on for your class yet.', code: 'off' } };

  if (action === 'hero') {
    const { cls, look } = body;
    if (!isHeroClass(cls) || !isLook(look)) return bad();
    const saved = await services.load(player);
    if (saved === 'busy') return busy();
    const had = saved.progress.hero;
    // The class is kept all season (James, 27 Nov 2026); the look can change.
    if (had && had.cls !== cls) return { status: 409, body: { error: 'Your hero class stays the same all season.', code: 'locked' } };
    const progress: Progress = { ...saved.progress, hero: { cls, look } };
    const done = await services.saveHero(player, saved.version, progress);
    if (done === 'busy') return busy();
    if (!done) return { status: 409, body: { error: 'Try again.', code: 'again' } };
    return ok({ progress });
  }

  if (action === 'start') {
    const quest = parseQuest(body.quest);
    if (!quest) return bad();
    const [saved, current] = await Promise.all([services.load(player), services.current(player)]);
    if (saved === 'busy' || current === 'busy') return busy();
    if (current?.open) return ok({ current: view(current) });
    const p = saved.progress;
    if (!p.hero) return { status: 409, body: { error: 'Pick your hero first.', code: 'no-hero' } };
    if (!quests(player, today, p).some((q) => q.id === quest.id)) return { status: 409, body: { error: 'Granny Jetpack has new quests now. Pick again!', code: 'stale' } };
    const waiting = adventuresWaiting(p, today);
    if (!settings.unlimited && waiting < 1) return { status: 429, body: { error: 'That’s today’s adventure done. Come back next school day!', code: 'done-today' } };
    const context = await services.maths(player);
    if (context === 'busy') return busy();
    const seed = seedText(services.random);
    const adventure = makeAdventure(Number(seed.slice(-9)), quest, p);
    // Always 4 choices: Years 2 to 4, quick on iPads.
    const questions = makeRunQuestions({ ...context, settings: { ...context.settings, multipleChoice: true } }, QUESTIONS_AN_ADVENTURE, services.random);
    if (!questions.length) return busy();
    const progress: Progress = settings.unlimited ? p : { ...p, credits: waiting - 1, creditDay: today };
    const kept = await services.start(player, saved.version, progress, { seed, adventure, questions });
    if (kept === 'busy') return busy();
    if (!kept) return { status: 409, body: { error: 'Try again.', code: 'again' } };
    return ok({ current: view({ seed, adventure, questions, marks: [], open: true }), progress, waiting: settings.unlimited ? null : waiting - 1 });
  }

  if (action === 'answer') {
    const { seed, slot, value, ms } = body;
    if (!isSeed(seed) || !Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value)) return bad();
    const kept = await services.current(player);
    if (kept === 'busy') return busy();
    if (!kept || kept.seed !== seed) return { status: 404, body: { error: 'That adventure isn’t going now.', code: 'not-yours' } };
    const n = slot as number;
    const q = questionAt(kept, n);
    const marked = markQuestion(q);
    if (!marked) return bad();
    // Asked again (a retry): the first mark stands and nothing is recorded twice.
    if (n < kept.marks.length) {
      const v = view(kept);
      return ok({ correct: kept.marks[n].right, answer: marked.answer, marks: kept.marks, question: v.question, again: true } satisfies AnswerReply);
    }
    if (n !== kept.marks.length || !kept.open) return { status: 409, body: { error: 'That question has gone.', code: 'order' } };
    if (replay(kept.adventure, kept.marks).phase === 'done') return { status: 409, body: { error: 'That adventure is finished.', code: 'ended' } };
    const right = sameAnswer(value, marked.answer);
    const mark: Mark = { right, special: body.special === true };
    const claimed = await services.mark(player, seed, n, mark);
    if (claimed === 'busy') return busy();
    if (!claimed) return { status: 409, body: { error: 'That question has gone.', code: 'order' } };
    const time = typeof ms === 'number' && Number.isFinite(ms) ? Math.max(0, Math.min(MAX_ANSWER_MS, Math.round(ms))) : MAX_ANSWER_MS;
    await services.recordAnswers(player, `${seed}:${n}`, [{ key: marked.key, correct: right, ms: time, at: services.now(), ...(right ? {} : { given: value }) }]);
    const next = view({ ...kept, marks: [...kept.marks, mark] });
    return ok({ correct: right, answer: marked.answer, marks: next.marks, question: next.question } satisfies AnswerReply);
  }

  if (action === 'finish') {
    const { seed } = body;
    if (!isSeed(seed)) return bad();
    const [kept, saved] = await Promise.all([services.current(player), services.load(player)]);
    if (kept === 'busy' || saved === 'busy') return busy();
    if (!kept || kept.seed !== seed || !kept.open) return { status: 409, body: { error: 'That adventure is already saved.', code: 'ended' } };
    const r = replay(kept.adventure, kept.marks);
    if (r.phase !== 'done') return { status: 422, body: { error: 'That adventure isn’t finished yet.', code: 'not-done' } };
    const got = rewardsFor(saved.progress, r);
    const fights = r.results.filter((x) => !x.trainer);
    const done = await services.finish(player, seed, saved.version, got.progress, {
      fightsWon: fights.filter((x) => x.outcome === 'won').length,
      fights: fights.length,
      rights: r.results.reduce((s, x) => s + x.rights, 0),
      questions: kept.marks.length,
      questDone: r.questDone,
      trainerMet: r.trainerMet,
      trainerWon: r.trainerWon,
      stars: r.stars,
      level: got.progress.level,
    });
    if (done === 'busy') return busy();
    if (!done) return { status: 409, body: { error: 'That adventure is already saved.', code: 'ended' } };
    if (got.points > 0) await services.awardPoints(player, got.points, `bonkers:${seed}`);
    await services.progressChanged(player);
    const reply: FinishReply = {
      ...got,
      waiting: settings.unlimited ? null : adventuresWaiting(got.progress, today),
      quests: quests(player, today, got.progress),
    };
    return ok(reply);
  }

  return bad();
}
