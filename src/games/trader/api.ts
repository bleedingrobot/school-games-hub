/**
 * What Star Trader's screens need from the server for maths: a question from the pupil's focus, and a mark for the
 * answer. Questions come only from the shared maths focus (`makeFocusPack`), and the answer is marked by whoever made
 * the question. The preview's `trialApi` does it in the browser; the real one (stage T.3) asks the `trader` function.
 */
import { AUTO_FOCUS, makeFocusPack } from '../../../shared/maths/focus';
import { seededRandom } from '../../../shared/maths/serverQuestions';
import type { ShownQuestion } from '../../maths/QuestionModal';

export type AskKind = 'trade' | 'laser' | 'junk';

export interface Asked {
  question: ShownQuestion;
  /** Mark the pupil's answer. `answer` is the right one, for showing the working. */
  mark(value: number, ms: number): Promise<{ correct: boolean; answer: number }>;
}

export interface TraderApi {
  ask(kind: AskKind): Promise<Asked | null>;
}

/** The preview's maths: the ladder's first questions for a pretend pupil with no records, marked in the browser. */
export function trialApi(seed = 'trader-preview'): TraderApi {
  const pack = makeFocusPack([], AUTO_FOCUS, {}, seededRandom(seed));
  return {
    async ask() {
      const q = pack.nextQuestion({ multipleChoice: false });
      if (!q) return null;
      const { answer: _answer, factKey: _factKey, ...shown } = q;
      void _answer;
      void _factKey;
      return {
        question: shown as ShownQuestion,
        mark: async (value) => ({ correct: value === q.answer, answer: q.answer }),
      };
    },
  };
}
