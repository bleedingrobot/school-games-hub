/**
 * The Battle Cry: once a round, before the members move, one maths question for the whole
 * clan. A right answer earns the bonus the player picked (more damage, or a heal); a wrong
 * answer or "No thanks" is a normal round that shows the worked answer. No timer, nothing lost.
 *
 * The question for each round comes from the fight's seed and the round number (and the
 * teacher's topics and year band), not from the fight's own dice. So the server can rebuild
 * exactly the question the child saw, mark the recorded answer itself, and replay the fight
 * to the same result, and asking questions never changes how a fight plays out.
 */
import type { FactAnswer } from '../maths/leitner';
import { markAnswer, pickQuestion, type PracticalQuestion, type PracticalSettings, type YearBand } from '../maths/practical';
import { playRound, type Cry, type FightState, type Order } from './fight';
import { nextFloat } from './rng';
import { newFight } from './fight';
import type { Member } from './types';

/** What a right answer is spent on. */
export type CryReward = Exclude<Cry, null>;

/** The question the clan faces before `round` of a fight started from `seed`. Null if the teacher has every topic off. */
export function cryQuestion(seed: number, round: number, settings: PracticalSettings): PracticalQuestion | null {
  const dice = { rng: Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(round + 1, 0x85ebca6b) };
  // Warm up, so neighbouring seeds and rounds don't give look-alike first numbers.
  nextFloat(dice);
  nextFloat(dice);
  return pickQuestion(settings, () => nextFloat(dice));
}

/** The question for the round about to be played. */
export const nextCryQuestion = (state: FightState, settings: PracticalSettings) => cryQuestion(state.seed, state.round + 1, settings);

/** What the player did with the Battle Cry this round. `null` for the whole thing means "No thanks". */
export interface CryAnswer {
  /** The number typed or tapped; null if they gave up and asked to see the answer. */
  answer: number | null;
  /** What to spend a right answer on. */
  reward: CryReward;
}

export interface CryResult {
  /** Did the player take the question (not "No thanks")? */
  answered: boolean;
  correct: boolean;
  /** The bonus played this round: null for a wrong answer or "No thanks". */
  cry: Cry;
  /** The right answer and the worked steps, to show when the answer was wrong or skipped. */
  question: PracticalQuestion | null;
}

/** Mark the player's Battle Cry answer. */
export function markCry(question: PracticalQuestion | null, given: CryAnswer | null): CryResult {
  if (!question) return { answered: false, correct: false, cry: null, question: null };
  const correct = !!given && markAnswer(question, given.answer);
  return { answered: !!given, correct, cry: correct ? given!.reward : null, question };
}

/** One round as it was played, small enough to keep: the orders given and what was done with the Battle Cry. */
export interface RecordedRound {
  orders: (Order | undefined)[];
  /** Null = "No thanks" (or no question that round). */
  cry: CryAnswer | null;
}

/** Play a round with the Battle Cry marked: the one place a round and its question meet. */
export function playCryRound(state: FightState, settings: PracticalSettings, orders: (Order | undefined)[], given: CryAnswer | null): CryResult {
  if (state.result) return { answered: false, correct: false, cry: null, question: null };
  const result = markCry(nextCryQuestion(state, settings), given);
  playRound(state, orders, result.cry);
  return result;
}

/** Replay a whole recorded fight from its seed. The server uses this to check what the browser reports. */
export function replayFight(
  members: Member[],
  depth: number,
  seed: number,
  boss: boolean,
  rounds: RecordedRound[],
  settings: PracticalSettings,
): { state: FightState; cries: CryResult[] } {
  const state = newFight(members, depth, seed, boss);
  const cries: CryResult[] = [];
  for (const r of rounds) {
    if (state.result) break;
    cries.push(playCryRound(state, settings, r.orders, r.cry));
  }
  return { state, cries };
}

/**
 * A Battle Cry answer in the shape the other games save maths answers (see Gem Keep's
 * `answers` items), so the same private records can hold it later. The key names the kind and
 * the year band; nobody but the student and the teacher ever sees these.
 */
export function cryRecord(question: PracticalQuestion, band: YearBand, correct: boolean, ms: number, at: number): FactAnswer {
  return { key: factKey(band, question.kind), correct, ms, at };
}

/** The key a question kind is kept under in the teacher's private maths records: the kind and the year band, never the numbers. */
export const factKey = (band: YearBand, kind: string) => `clan:y${band}:${kind}`;

/** The pack Clan Quest's answers are kept in (the same table Gem Keep and Dragon Maths use). */
export const FACT_PACK = 'clan-quest';

/** The server cannot know how long a child took, so every answer is kept as a slow one: it counts as tried and right, never as "fluent". */
export const UNTIMED_MS = 60_000;
