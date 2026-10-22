import { useCallback, useState, type ReactNode } from 'react';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { AskKind, Asked, TraderApi } from './api';

interface Pending {
  asked: Asked;
  title: string;
  note: string;
  resolve: (right: boolean | null) => void;
}

/**
 * Asking a maths question over the game. `ask` gives back true (right), false (wrong) or null (no question could be made,
 * or the pupil said "No thanks"). A wrong answer costs nothing: the box shows the working and the game goes on.
 */
export function useAsk(api: TraderApi): { ask: (kind: AskKind, title: string, note: string) => Promise<boolean | null>; modal: ReactNode; asking: boolean } {
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = useCallback(
    async (kind: AskKind, title: string, note: string) => {
      const asked = await api.ask(kind);
      if (!asked) return null;
      return new Promise<boolean | null>((resolve) => setPending({ asked, title, note, resolve }));
    },
    [api],
  );
  const modal = pending ? (
    <QuestionModal
      question={pending.asked.question}
      title={pending.title}
      note={pending.note}
      closeLabel="No thanks"
      onClose={() => {
        pending.resolve(null);
        setPending(null);
      }}
      onSubmit={async (value, ms): Promise<MarkedAnswer> => {
        const r = await pending.asked.mark(value, ms);
        return { correct: r.correct, fact: '', boxBefore: 0, boxAfter: 0, answer: r.answer };
      }}
      onDone={(result) => {
        pending.resolve(result.correct);
        setPending(null);
      }}
    />
  ) : null;
  return { ask, modal, asking: pending !== null };
}
