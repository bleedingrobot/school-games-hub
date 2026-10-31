/**
 * A reign as the server keeps it (docs/KINGDOM-PLAN.md, section 5): the city, the seed its years are rolled from, the
 * ruler's look, and this year's council (its questions, which pupils never see, and the answers marked so far).
 */
import { seededRandom, publicQuestion, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { councilFor, startCity, type Adviser, type City, type RatingId } from './engine';

/** The rulers a pupil can pick (painted pictures in src/games/kingdom/art/rulers/). */
export const LOOKS = [
  'ruler-girl-1', 'ruler-boy-1', 'ruler-girl-2', 'ruler-boy-2', 'ruler-girl-3', 'ruler-boy-3', 'ruler-girl-4', 'ruler-boy-4',
] as const;
export type Look = (typeof LOOKS)[number];
export const isLook = (v: unknown): v is Look => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);

/** A reign's seed: hex, as the server makes it. */
export const isSeed = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{16,64}$/.test(v);

/** Each part of a reign has its own random numbers from the seed, so a year can be turned again and give the same result. */
export const startRandom = (seed: string) => seededRandom(`${seed}:start`);
export const yearRandom = (seed: string, year: number) => seededRandom(`${seed}:year:${year}`);
export const councilRandom = (seed: string, year: number) => seededRandom(`${seed}:council:${year}`);

export interface MarkedAnswer {
  value: number;
  right: boolean;
}

/** A year's council as the server keeps it. `questions[i]` is asked by `advisers[i]`. */
export interface Council {
  year: number;
  advisers: Adviser[];
  questions: Question[];
  /** { "<slot>": answer } */
  answered: Record<string, MarkedAnswer>;
}

/** What the browser is shown of a council: the questions without their answers, and how the answered ones went. */
export interface PublicCouncil {
  year: number;
  advisers: Adviser[];
  questions: PublicQuestion[];
  answered: Record<string, { right: boolean; answer: number }>;
}

export interface StoredReign {
  id: number;
  seed: string;
  look: Look;
  city: City;
  council: Council | null;
}

export interface PublicReign {
  id: number;
  look: Look;
  city: City;
  council: PublicCouncil | null;
  /** Once the reign is over. */
  rating?: RatingId;
  points?: number;
}

/** The pupil's record over all their reigns. */
export interface KingdomRecord {
  /** Reigns finished (all ten years). */
  reigns: number;
  legendary: number;
  /** The most people at the end of a finished reign. */
  best: number;
}

/** A new reign's city. */
export const newCity = (seed: string): City => startCity(startRandom(seed));

/**
 * A year's council: the advisers the seed picks, each given one of the questions the server made from the pupil's maths
 * focus. With fewer questions (the maths couldn't be read) fewer advisers come; with none, there's no council that year.
 */
export function makeCouncil(seed: string, year: number, questions: Question[]): Council | null {
  const advisers = councilFor(councilRandom(seed, year)).slice(0, questions.length);
  return advisers.length ? { year, advisers, questions: questions.slice(0, advisers.length), answered: {} } : null;
}

/** The advisers whose question was marked right: the boons for the year. */
export function boonsOf(council: Council | null, year: number): Adviser[] {
  if (!council || council.year !== year) return [];
  return council.advisers.filter((_, slot) => council.answered[String(slot)]?.right === true);
}

export function publicCouncil(council: Council | null, answerOf: (q: Question) => number | null): PublicCouncil | null {
  if (!council) return null;
  const answered: PublicCouncil['answered'] = {};
  for (const [slot, a] of Object.entries(council.answered)) {
    const answer = answerOf(council.questions[Number(slot)]);
    if (answer !== null) answered[slot] = { right: a.right, answer };
  }
  return { year: council.year, advisers: council.advisers, questions: council.questions.map((q, slot) => publicQuestion(q, slot)), answered };
}
