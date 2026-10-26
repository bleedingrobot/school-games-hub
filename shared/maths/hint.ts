/**
 * One hint for any question, with no extra content to write per topic. Pick-one questions lose two wrong
 * choices. Typed questions say which small stretch of numbers the answer is in ("between 50 and 60").
 * It never gives the answer away, and the same question always gets the same hint.
 */
import type { Question } from './skillPack';

export interface Hint {
  /** One plain sentence to show. */
  text: string;
  /** Choices to grey out (pick-one questions only). */
  remove: number[];
}

const clean = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** The stretch the answer is in: wide enough that it is a nudge, narrow enough to help. */
function stretch(answer: number): [number, number] {
  const size = Math.abs(answer);
  const step = !Number.isInteger(answer) ? (size < 10 ? 1 : 5) : size >= 200 ? 50 : size >= 40 ? 20 : size >= 12 ? 10 : 5;
  const low = Math.floor(answer / step) * step;
  return [low, low + step];
}

export function hintFor(q: Pick<Question, 'answer' | 'choices' | 'parts'>): Hint {
  if (q.choices && q.choices.length > 2) {
    // Take away two wrong choices: the ones furthest from the answer first, so the hint is fair but not a giveaway.
    const wrong = q.choices.filter((c) => c !== q.answer).sort((a, b) => Math.abs(b - q.answer) - Math.abs(a - q.answer) || a - b);
    const remove = wrong.slice(0, 2);
    return { text: 'Two of the choices were wrong. They are greyed out.', remove };
  }
  const [low, high] = stretch(q.answer);
  const money = q.parts.includes('$');
  const show = (n: number) => (money ? `$${n.toFixed(2)}` : clean(n));
  return { text: `The answer is between ${show(low)} and ${show(high)}.`, remove: [] };
}
