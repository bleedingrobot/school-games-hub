/**
 * What the `kingdom` server function does with a request from a signed-in pupil (docs/KINGDOM-PLAN.md, section 5).
 * The function (supabase/functions/kingdom/handler.ts) checks the sign-in and the rate first; the preview's trial
 * backend calls this with services that keep everything in the browser, so both run exactly the same rules.
 *
 *   load    the open reign (if any) and the pupil's record;
 *   start   a new reign with a fresh seed (any open one is left), and year 1's council;
 *   answer  marks one council answer against the stored question, once, and records it for the maths records;
 *   decide  checks the year's decisions, turns the year with the reign's own random numbers and the boons the server
 *           marked, keeps it, and makes next year's council. At the end it rates the reign and gives points.
 *
 * Nothing that counts comes from the browser: the questions and answers are the server's, the random numbers are the
 * seed's, and a year is turned once (sent twice, the second gets the reign as it now is).
 */
import type { FactAnswer } from '../maths/leitner';
import { makeRunQuestions, markQuestion, sameAnswer, type MathsContext } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { COUNCIL_SIZE, POINT_REIGNS_PER_DAY } from './config';
import { pointsFor, problemWith, PROBLEM_TEXT, ratingOf, readDecisions, turnYear, type City, type RatingId } from './engine';
import {
  boonsOf, isLook, makeCouncil, newCity, publicCouncil, yearRandom,
  type Council, type KingdomRecord, type Look, type PublicReign, type StoredReign,
} from './reign';

export type KingdomAction = 'load' | 'start' | 'answer' | 'decide';

export interface KingdomServices {
  /** Is the game switched on for this pupil's class? Null if it can't be read. */
  enabled(player: string): Promise<boolean | null>;
  /** The pupil's maths records, the class's question settings and their focus (null if they can't be read). */
  mathsContext(player: string): Promise<MathsContext | null>;
  /** The pupil's open reign, their record, and how many reigns they've finished in the last day. */
  load(player: string): Promise<{ reign: StoredReign | null; record: KingdomRecord; finishedToday: number } | 'busy'>;
  /** Leaves any open reign and keeps a new one. Its id, or 'busy'. */
  start(player: string, seed: string, look: Look, city: City, council: Council | null): Promise<number | 'busy'>;
  /** Marks a council slot answered, once (false if it was already, or the year has moved on). */
  answer(player: string, reign: number, year: number, slot: number, value: number, right: boolean): Promise<boolean | 'busy'>;
  /**
   * Keeps a turned year, only if the reign is still open and still on `fromYear` with this many years turned (false
   * if it isn't: the year was already turned).
   */
  turn(player: string, reign: number, fromYear: number, turned: number, city: City, council: Council | null, end: { rating: RatingId; points: number } | null): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Gives hub points (once per `once`). A failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  /** Tells the hub the pupil's achievement counts may have changed. */
  progressChanged(player: string): Promise<void>;
  randomHex(bytes: number): string;
  random(): number;
  now(): number;
}

export interface KingdomReply {
  status: number;
  body: Record<string, unknown>;
}

/** The longest an answer is said to have taken, for the maths records. */
const MAX_ANSWER_MS = 120_000;

const ok = (body: Record<string, unknown>): KingdomReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): KingdomReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, "Riverstone's steward couldn't be reached just now. Try again in a moment.");

const answerOf = (q: Question) => markQuestion(q)?.answer ?? null;

/** What the browser is shown of a reign. */
export function publicReign(reign: StoredReign, end?: { rating: RatingId; points: number }): PublicReign {
  return { id: reign.id, look: reign.look, city: reign.city, council: publicCouncil(reign.council, answerOf), ...(end ?? {}) };
}

async function councilFor(services: KingdomServices, player: string, seed: string, year: number): Promise<Council | null> {
  const context = await services.mathsContext(player);
  const questions = context ? makeRunQuestions(context, COUNCIL_SIZE, () => services.random()) : [];
  return makeCouncil(seed, year, questions);
}

export async function handleKingdom(services: KingdomServices, player: string, body: Record<string, unknown>): Promise<KingdomReply> {
  const on = await services.enabled(player);
  if (on === null) return busy();
  if (!on) return no(403, 'Kingdom Keeper is not switched on for your class.', { code: 'game-off' });

  if (body.action === 'load') {
    const s = await services.load(player);
    if (s === 'busy') return busy();
    return ok({ reign: s.reign ? publicReign(s.reign) : null, record: s.record, pointReignsLeft: Math.max(0, POINT_REIGNS_PER_DAY - s.finishedToday) });
  }

  if (body.action === 'start') {
    if (!isLook(body.look)) return no(400, "That ruler couldn't be found.");
    const seed = services.randomHex(16);
    const city = newCity(seed);
    const council = await councilFor(services, player, seed, city.year);
    const id = await services.start(player, seed, body.look, city, council);
    if (id === 'busy') return busy();
    return ok({ reign: publicReign({ id, seed, look: body.look, city, council }) });
  }

  if (body.action !== 'answer' && body.action !== 'decide') return no(400, "That couldn't be read.");
  const { reign: reignId, year } = body;
  if (!Number.isInteger(reignId) || !Number.isInteger(year)) return no(400, "That couldn't be read.");
  const s = await services.load(player);
  if (s === 'busy') return busy();
  const reign = s.reign;
  // Only the pupil's own open reign can be played (another pupil's reign, or an old one, is never found here).
  if (!reign || reign.id !== reignId) return no(409, 'That reign is over. Open Kingdom Keeper again to carry on.', { code: 'gone' });

  if (body.action === 'answer') {
    const { slot, value } = body;
    const council = reign.council;
    if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) {
      return no(400, "That answer couldn't be read.");
    }
    const q = council && council.year === year && reign.city.year === year ? council.questions[slot as number] : undefined;
    const marked = markQuestion(q);
    if (!council || !marked) return no(400, "That answer couldn't be marked.");
    const right = sameAnswer(value, marked.answer);
    const claimed = await services.answer(player, reign.id, year as number, slot as number, value, right);
    if (claimed === 'busy') return busy();
    if (!claimed) return no(400, "You've already answered that one.");
    const ms = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? Math.min(body.ms, MAX_ANSWER_MS) : MAX_ANSWER_MS;
    try {
      await services.recordAnswers(player, `kingdom:${reign.seed}:${year}:${slot}`, [{ key: marked.key, correct: right, ms: Math.round(ms), at: services.now() }]);
    } catch {
      // The maths records are a bonus: the game goes on without them.
    }
    return ok({ right, answer: marked.answer, adviser: council.advisers[slot as number] });
  }

  // decide
  if (year !== reign.city.year) return ok({ reign: publicReign(reign), already: true });
  const decisions = readDecisions(body.decisions);
  if (!decisions) return no(400, "Those decisions couldn't be read.");
  const boons = boonsOf(reign.council, reign.city.year);
  const problem = problemWith(reign.city, decisions, boons);
  if (problem) return no(400, PROBLEM_TEXT[problem], { code: problem });
  const city = turnYear(reign.city, decisions, boons, yearRandom(reign.seed, reign.city.year));
  const over = city.status !== 'playing';
  const council = over ? null : await councilFor(services, player, reign.seed, city.year);
  const points = over && s.finishedToday < POINT_REIGNS_PER_DAY ? pointsFor(city) : 0;
  const end = over ? { rating: ratingOf(city), points } : null;
  const kept = await services.turn(player, reign.id, reign.city.year, reign.city.hungryPct.length, city, council, end);
  if (kept === 'busy') return busy();
  if (!kept) {
    const again = await services.load(player);
    if (again === 'busy') return busy();
    return again.reign ? ok({ reign: publicReign(again.reign), already: true }) : no(409, 'That reign is over.', { code: 'gone' });
  }
  if (end) {
    if (points > 0) await services.awardPoints(player, points, `kingdom:${reign.id}`);
    await services.progressChanged(player);
  }
  return ok({ reign: publicReign({ ...reign, city, council }, end ?? undefined) });
}
