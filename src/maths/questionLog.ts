/**
 * Notes about each question the question box showed: answered, or closed without an answer (a skip). See
 * docs/QUESTION-SKIPS-PLAN.md.
 *
 * The box only notes; where the notes go is set once by the website (src/data/questionLog.ts sends them to the server). In
 * tests and previews nothing is set, so nothing is sent.
 */

export interface QuestionNote {
  /** The kind of question, e.g. "Pit stop", "Mana Well". */
  spot: string;
  /** True if the box closed without an answer: a skip button, Escape, the time ran out, or the game moved on. */
  skipped: boolean;
  /** How long the question was on screen. */
  ms: number;
}

export type QuestionSink = (note: QuestionNote & { at: number }) => void;

/**
 * A box gone in less time than this was never really seen (React's development double-render, or a game swapping one
 * question straight for another), so it isn't counted as a skip.
 */
export const MIN_SHOWN_MS = 300;

let sink: QuestionSink | null = null;

export function setQuestionSink(next: QuestionSink | null): void {
  sink = next;
}

export function noteQuestion(note: QuestionNote): void {
  if (!sink || (note.skipped && note.ms < MIN_SHOWN_MS)) return;
  try {
    sink({ spot: note.spot, skipped: note.skipped, ms: Math.round(note.ms), at: Date.now() });
  } catch {
    // A note is never worth breaking a game.
  }
}

/** The kind of question from a box's title: "Power-up pad: Shield" → "Power-up pad"; numbers left out. */
export function spotFromTitle(title: string): string {
  const spot = title.split(':')[0].replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return spot || 'Question';
}
