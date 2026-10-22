/**
 * For games whose server makes the maths questions and marks them itself (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.2 A):
 * a random number generator made from a text seed, so the server can make the same questions again, and the part of a
 * question the browser may see (never its answer).
 *
 * `seededRandom` gives exactly the same numbers as Marble Rush's own copy (shared/marble/maths.ts on its branch), so
 * Marble can switch to this one without any run changing.
 */
import type { Question } from './skillPack';

function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small seeded random number generator (numbers from 0 up to 1). The same text always gives the same numbers. */
export function seededRandom(text: string): () => number {
  let a = hashSeed(text);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the browser is told about a question: enough to show it (with `QuestionModal`), never its answer or record. */
export interface PublicQuestion {
  /** Which question of the round this is; the browser sends it back with the answer. */
  slot: number;
  parts: string[];
  spoken: string;
  prompt?: string;
  choices?: number[];
  choiceLabels?: string[];
  input?: 'whole' | 'decimal';
  maxLength?: number;
}

export function publicQuestion(q: Question, slot: number): PublicQuestion {
  return {
    slot,
    parts: q.parts,
    spoken: q.spoken,
    ...(q.prompt ? { prompt: q.prompt } : {}),
    ...(q.choices ? { choices: q.choices } : {}),
    ...(q.choiceLabels ? { choiceLabels: q.choiceLabels } : {}),
    ...(q.input ? { input: q.input } : {}),
    ...(q.maxLength ? { maxLength: q.maxLength } : {}),
  };
}
