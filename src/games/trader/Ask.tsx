import { useCallback, useState, type ReactNode } from 'react';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';

/** A question the server sent (no answer in it), as the question box wants it. */
export function shownOf(q: PublicQuestion): ShownQuestion {
  return {
    id: q.slot,
    parts: q.parts,
    spoken: q.spoken,
    ...(q.prompt ? { prompt: q.prompt } : {}),
    ...(q.choices ? { choices: q.choices } : {}),
    ...(q.choiceLabels ? { choiceLabels: q.choiceLabels } : {}),
    ...(q.input ? { input: q.input } : {}),
    ...(q.maxLength ? { maxLength: q.maxLength } : {}),
  };
}

/** What marking an answer gives back (the server marked it). */
export interface Verdict {
  right: boolean;
  answer: number;
}

interface Pending {
  question: PublicQuestion;
  title: string;
  note: string;
  send: (value: number, ms: number) => Promise<Verdict>;
  resolve: (outcome: 'answered' | 'skipped') => void;
}

/**
 * Asking a maths question over the game. The pupil answers; `send` carries the answer to the server (which marks it) and
 * gives the verdict back for the box to show. `ask` gives 'answered', or 'skipped' if the pupil said "No thanks". A wrong
 * answer costs nothing: the box shows the working and the game goes on.
 */
export function useAsk(): {
  ask: (question: PublicQuestion, title: string, note: string, send: Pending['send']) => Promise<'answered' | 'skipped'>;
  modal: ReactNode;
  asking: boolean;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = useCallback(
    (question: PublicQuestion, title: string, note: string, send: Pending['send']) =>
      new Promise<'answered' | 'skipped'>((resolve) => setPending({ question, title, note, send, resolve })),
    [],
  );
  const modal = pending ? (
    <QuestionModal
      question={shownOf(pending.question)}
      title={pending.title}
      note={pending.note}
      closeLabel="No thanks"
      onClose={() => {
        pending.resolve('skipped');
        setPending(null);
      }}
      onSubmit={async (value, ms): Promise<MarkedAnswer> => {
        const v = await pending.send(value, ms);
        return { correct: v.right, fact: '', boxBefore: 0, boxAfter: 0, answer: v.answer };
      }}
      onDone={() => {
        pending.resolve('answered');
        setPending(null);
      }}
    />
  ) : null;
  return { ask, modal, asking: pending !== null };
}
