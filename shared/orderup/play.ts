/**
 * Replays one bag from the pupil's taps (docs/ORDERUP-PLAN.md). The browser and the server run the same function, so
 * the server never takes the browser's word for what was right.
 *
 * A go is a list of events: a pick ({ p: [ids] }, one number with an exponent or two numbers) or an answer ({ a: n }) for
 * the picked step. When only one step is left it is picked for the pupil (the doc), so the last answer needs no pick.
 */
import { ORDERUP } from './config';
import { applyStep, isNum, isReady, parse, type Node } from './expr';
import { answerMistake, checkPick, type AnswerMistake, type PickMistake } from './mistakes';

export interface BagEvent {
  /** The number ids picked. */
  p?: number[];
  /** The answer typed for the picked step. */
  a?: number;
  ms: number;
}

export interface BagResult {
  done: boolean;
  wrongPicks: number;
  wrongAnswers: number;
  /** The most wrong picks on any one step: 2 or more means "Let's look together" showed, 3 or more that the pair glowed. */
  mostWrongOnAStep: number;
  /** Each wrong pick's and answer's kind, in order. */
  mistakes: (PickMistake | AnswerMistake)[];
  /** Each wrong answer as typed (for "Often answers …"). */
  given: number[];
  ms: number;
  /** Solved with no wrong pick and no wrong answer. */
  clean: boolean;
  /** Counts towards passing the set (ORDERUP.passWrongPicks wrong picks at most, one wrong answer at most). */
  good: boolean;
}

/** The step picked for the pupil when only one is left (the whole expression is one ready step). */
export const autoStep = (root: Node): Node | null => (isReady(root) ? root : null);

/** Replays a bag. Throws on an event that couldn't happen (a pick while a step is picked, an answer with none). */
export function replayBag(text: string, events: readonly BagEvent[]): BagResult {
  let root = parse(text);
  let step: Node | null = autoStep(root);
  let wrongHere = 0;
  const r: BagResult = { done: false, wrongPicks: 0, wrongAnswers: 0, mostWrongOnAStep: 0, mistakes: [], given: [], ms: 0, clean: false, good: false };
  for (const e of events) {
    if (isNum(root)) throw new Error('Event after the bag was finished');
    r.ms += e.ms;
    if (e.p) {
      if (step) throw new Error('Pick while a step is picked');
      const check = checkPick(root, e.p);
      if (check.ok) step = check.step;
      else {
        r.wrongPicks++;
        wrongHere++;
        r.mostWrongOnAStep = Math.max(r.mostWrongOnAStep, wrongHere);
        r.mistakes.push(check.mistake);
      }
    } else if (typeof e.a === 'number') {
      if (!step) throw new Error('Answer with no step picked');
      const right = applyStep(root, step.id);
      const value = (findValue(right, step.id) ?? NaN) as number;
      if (e.a === value) {
        root = right;
        step = autoStep(root);
        wrongHere = 0;
      } else {
        r.wrongAnswers++;
        r.mistakes.push(answerMistake(step, e.a));
        r.given.push(e.a);
      }
    } else throw new Error('Unknown event');
  }
  r.done = isNum(root);
  r.clean = r.done && r.wrongPicks === 0 && r.wrongAnswers === 0;
  r.good = r.done && r.wrongPicks <= ORDERUP.passWrongPicks && r.wrongAnswers <= 1;
  return r;
}

function findValue(root: Node, id: number): number | null {
  if (root.id === id && isNum(root)) return root.value;
  if (root.kind === 'bin') return findValue(root.left, id) ?? findValue(root.right, id);
  if (root.kind === 'pow') return findValue(root.base, id);
  if (root.kind === 'group') return findValue(root.inner, id);
  return null;
}
