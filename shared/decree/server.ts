/**
 * What the `decree` server function does with a request from a signed-in pupil (docs/DECREE-PLAN.md, section 5).
 * The function (supabase/functions/decree/handler.ts) checks the sign-in first; the preview's trial backend calls this
 * with services that keep everything in the browser, so both run exactly the same rules.
 *
 *   load    the open reign (if any) and the pupil's album;
 *   start   a new reign with a fresh seed (any open one is left) and its riddles, made from the pupil's maths focus;
 *   answer  marks one riddle against the stored question, once, and records it for the maths records;
 *   save    replays the moves since the last save from the stored reign, using only riddle answers the server marked,
 *           and keeps the result. When the reign ends it gives points.
 *
 * The browser plays ahead with the same rules for instant feedback and saves at the end of each year and at the end.
 * Nothing that counts comes from the browser: the deck comes from the seed, the riddles are the server's, and a save
 * is kept once (sent twice, the second gets the reign as it now is).
 */
import type { FactAnswer } from '../maths/leitner';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, type MathsContext, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { CARDS_IN_REIGN, POINT_REIGNS_PER_DAY } from './config';
import { CARDS, RIDDLES } from './cards';
import { newReign, playAll, pointsFor, RIDDLES_IN_REIGN, type Deck, type EndingId, type Move, type Reign } from './engine';

export const DECK: Deck = { cards: CARDS, riddles: RIDDLES };

/** The rulers a pupil can pick (Kingdom Keeper's painted rulers, copied into src/games/decree/art/rulers/). */
export const LOOKS = [
  'ruler-girl-1', 'ruler-boy-1', 'ruler-girl-2', 'ruler-boy-2', 'ruler-girl-3', 'ruler-boy-3', 'ruler-girl-4', 'ruler-boy-4',
] as const;
export type Look = (typeof LOOKS)[number];
export const isLook = (v: unknown): v is Look => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);

export interface MarkedAnswer {
  value: number;
  right: boolean;
}

/** A reign as the server keeps it. */
export interface StoredReign {
  id: number;
  look: Look;
  reign: Reign;
  /** Every move saved so far. */
  moves: Move[];
  questions: Question[];
  /** { "<slot>": answer } */
  answered: Record<string, MarkedAnswer>;
}

/** What the browser is shown: the riddles without their answers, and how the answered ones went. */
export interface PublicReign {
  id: number;
  look: Look;
  reign: Reign;
  questions: PublicQuestion[];
  answered: Record<string, { right: boolean; answer: number }>;
  /** Once the reign is over. */
  points?: number;
}

/** The pupil's Royal Album, over all their reigns. */
export interface Album {
  reigns: number;
  /** Reigns lived through to the end. */
  full: number;
  /** The most cards lived through in one reign. */
  best: number;
  endings: EndingId[];
  met: string[];
}

export interface DecreeServices {
  /** Is the game switched on for this pupil's class? Null if it can't be read. */
  enabled(player: string): Promise<boolean | null>;
  mathsContext(player: string): Promise<MathsContext | null>;
  /** The open reign, the album, and how many reigns ended in the last day. */
  load(player: string): Promise<{ reign: StoredReign | null; album: Album; finishedToday: number } | 'busy'>;
  /** Leaves any open reign and keeps a new one. Its id, or 'busy'. */
  start(player: string, look: Look, reign: Reign, questions: Question[]): Promise<number | 'busy'>;
  /** Marks a riddle slot answered, once (false if it already was). */
  answer(player: string, id: number, slot: number, value: number, right: boolean): Promise<boolean | 'busy'>;
  /**
   * Keeps a reign after more moves, only if it is still open with `fromTurn` cards played (false if not: already
   * saved). `end` is given when the reign is over.
   */
  save(player: string, id: number, fromTurn: number, reign: Reign, moves: Move[], end: { points: number } | null): Promise<boolean | 'busy'>;
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  awardPoints(player: string, points: number, once: string): Promise<void>;
  progressChanged(player: string): Promise<void>;
  randomHex(bytes: number): string;
  random(): number;
  now(): number;
}

export interface DecreeReply {
  status: number;
  body: Record<string, unknown>;
}

const MAX_ANSWER_MS = 120_000;
const ok = (body: Record<string, unknown>): DecreeReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): DecreeReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, "The castle couldn't be reached just now. Try again in a moment.");

export function publicReign(s: StoredReign, points?: number): PublicReign {
  const answered: PublicReign['answered'] = {};
  for (const [slot, a] of Object.entries(s.answered)) {
    const marked = markQuestion(s.questions[Number(slot)]);
    if (marked) answered[slot] = { right: a.right, answer: marked.answer };
  }
  return {
    id: s.id, look: s.look, reign: s.reign,
    questions: s.questions.map((q, slot) => publicQuestion(q, slot)),
    answered,
    ...(points === undefined ? {} : { points }),
  };
}

const readMoves = (v: unknown): Move[] | null =>
  Array.isArray(v) && v.length <= CARDS_IN_REIGN && v.every((m) => m === 'yes' || m === 'no' || m === 'riddle') ? (v as Move[]) : null;

export async function handleDecree(services: DecreeServices, player: string, body: Record<string, unknown>): Promise<DecreeReply> {
  const on = await services.enabled(player);
  if (on === null) return busy();
  if (!on) return no(403, 'Royal Decree is not switched on for your class.', { code: 'game-off' });

  if (body.action === 'load') {
    const s = await services.load(player);
    if (s === 'busy') return busy();
    return ok({ reign: s.reign ? publicReign(s.reign) : null, album: s.album, pointReignsLeft: Math.max(0, POINT_REIGNS_PER_DAY - s.finishedToday) });
  }

  if (body.action === 'start') {
    if (!isLook(body.look)) return no(400, "That ruler couldn't be found.");
    const reign = newReign(services.randomHex(16));
    const context = await services.mathsContext(player);
    // No maths can be read: the riddles are skipped (the villager just says thanks), and the game goes on.
    const questions = context ? makeRunQuestions(context, RIDDLES_IN_REIGN, () => services.random()) : [];
    const id = await services.start(player, body.look, reign, questions);
    if (id === 'busy') return busy();
    return ok({ reign: publicReign({ id, look: body.look, reign, moves: [], questions, answered: {} }) });
  }

  if (body.action !== 'answer' && body.action !== 'save') return no(400, "That couldn't be read.");
  const s = await services.load(player);
  if (s === 'busy') return busy();
  const stored = s.reign;
  // Only the pupil's own open reign can be played (another pupil's, or an old one, is never found here).
  if (!stored || stored.id !== body.reign) return no(409, 'That reign is over. Open Royal Decree again to carry on.', { code: 'gone' });

  if (body.action === 'answer') {
    const { slot, value } = body;
    if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) {
      return no(400, "That answer couldn't be read.");
    }
    const marked = markQuestion(stored.questions[slot as number]);
    if (!marked) return no(400, "That answer couldn't be marked.");
    const right = sameAnswer(value, marked.answer);
    const claimed = await services.answer(player, stored.id, slot as number, value, right);
    if (claimed === 'busy') return busy();
    if (!claimed) return no(400, "You've already answered that one.");
    const ms = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? Math.min(body.ms, MAX_ANSWER_MS) : MAX_ANSWER_MS;
    try {
      await services.recordAnswers(player, `decree:${stored.reign.seed}:${slot}`, [{ key: marked.key, correct: right, ms: Math.round(ms), at: services.now(), ...(right ? {} : { given: value }) }]);
    } catch {
      // The maths records are a bonus: the game goes on without them.
    }
    return ok({ right, answer: marked.answer });
  }

  // save
  const fromTurn = body.from;
  const moves = readMoves(body.moves);
  if (!Number.isInteger(fromTurn) || !moves) return no(400, "Those moves couldn't be read.");
  if (fromTurn !== stored.reign.turn) return ok({ reign: publicReign(stored), already: true });
  const reign = playAll(stored.reign, DECK, moves, (slot) => stored.answered[String(slot)]?.right === true);
  if (!reign) return no(400, "Those moves don't fit this reign.", { code: 'bad-moves' });
  const over = reign.status !== 'playing';
  const points = over && s.finishedToday < POINT_REIGNS_PER_DAY ? pointsFor(reign) : 0;
  const kept = await services.save(player, stored.id, stored.reign.turn, reign, [...stored.moves, ...moves], over ? { points } : null);
  if (kept === 'busy') return busy();
  if (!kept) {
    const again = await services.load(player);
    if (again === 'busy') return busy();
    return again.reign ? ok({ reign: publicReign(again.reign), already: true }) : no(409, 'That reign is over.', { code: 'gone' });
  }
  if (over) {
    if (points > 0) await services.awardPoints(player, points, `decree:${stored.id}`);
    await services.progressChanged(player);
  }
  return ok({ reign: publicReign({ ...stored, reign, moves: [...stored.moves, ...moves] }, over ? points : undefined) });
}
