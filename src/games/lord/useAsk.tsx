import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { MomentId } from '../../../shared/lord/maths';
import type { AskTicket, LordAction, LordReply } from '../../../shared/lord/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal } from '../../maths/QuestionModal';

/** How a question went: the ticket naming the question the server marked, and whether it was right (for the pupil's own feedback). */
export interface Answer {
  proof: AskTicket;
  correct: boolean;
}
/** Null: the pupil chose not to answer (or the question couldn't be had). The server then treats it as no answer, never as wrong. */
export type Asked = Answer | null;

export interface AskOptions {
  title: string;
  note?: string;
  /** Lets the player say "no thanks" (the answer then counts as skipped, never as wrong). */
  closeLabel?: string;
  /** The next question of the same `ask` (a master's trial asks three at once): 0, or left out, asks the server for new ones. */
  slot?: number;
}

type Send = (action: LordAction) => Promise<Extract<LordReply, { ok: true }> | null>;

interface Pending {
  /** New for every question, so the box starts fresh even when one question follows straight on from another. */
  id: number;
  no: number;
  slot: number;
  shown: PublicQuestion;
  moment: MomentId;
  marked: { correct: boolean } | null;
  options: AskOptions;
  resolve: (result: Asked) => void;
}

/**
 * Asks maths questions in the dragon game, the same ladder questions as the other games (docs/game-guide/4-maths.md, way A).
 * `ask(moment, options)` gets the question from the server (`ask`: made from the pupil's maths focus and kept there), shows
 * it, has the server mark the answer (`ask-check`, which records it), and hands back a ticket for the action it was for.
 * `send` is the game's own request function (a ref, as the game makes it after this hook).
 */
export function useAsk(send: RefObject<Send | null>) {
  const [pending, setPending] = useState<Pending | null>(null);
  const last = useRef<{ moment: MomentId; no: number; questions: PublicQuestion[] } | null>(null);
  const nextId = useRef(0);

  const ask = useCallback(
    async (moment: MomentId, options: AskOptions): Promise<Asked> => {
      const slot = options.slot ?? 0;
      let set = last.current;
      if (slot === 0 || !set || set.moment !== moment) {
        const reply = await send.current?.({ action: 'ask', moment });
        const r = reply?.result as { no?: number; questions?: PublicQuestion[] } | undefined;
        if (!r || typeof r.no !== 'number' || !r.questions?.length) return null;
        set = { moment, no: r.no, questions: r.questions };
        last.current = set;
      }
      const shown = set.questions[slot];
      if (!shown) return null;
      const no = set.no;
      return new Promise<Asked>((resolve) => setPending({ id: ++nextId.current, no, slot, shown, moment, marked: null, options, resolve }));
    },
    [send],
  );

  const finish = (result: Asked) => {
    pending?.resolve(result);
    setPending(null);
  };

  const modal: ReactNode = pending && (
    <QuestionModal
      key={pending.id}
      question={{ ...pending.shown, id: pending.id }}
      title={pending.options.title}
      spot={pending.moment}
      note={pending.options.note}
      closeLabel={pending.options.closeLabel}
      onClose={pending.options.closeLabel ? () => finish(null) : undefined}
      onSubmit={async (given, ms) => {
        const reply = await send.current?.({ action: 'ask-check', no: pending.no, slot: pending.slot, answer: given, ms });
        const r = reply?.result as { correct?: boolean; answer?: number } | undefined;
        if (!r || typeof r.correct !== 'boolean' || typeof r.answer !== 'number') throw new Error('We couldn’t check that one. Try again.');
        pending.marked = { correct: r.correct };
        const fact = pending.shown.parts.join(' ').replace('?', String(r.answer));
        return { correct: r.correct, boxBefore: 0, boxAfter: 0, fact, answer: r.answer };
      }}
      onDone={() => {
        const marked = pending.marked;
        finish(marked ? { correct: marked.correct, proof: { no: pending.no, slot: pending.slot } } : null);
      }}
    />
  );

  return { ask, modal };
}
