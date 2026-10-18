import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { FactStats } from '../../../shared/maths/leitner';
import type { AnswerResult, Question, SkillPack } from '../../../shared/maths/skillPack';
import { EXTRA_PACKS, makeExtraPack, makePack, type ExtraTopicId, type TopicId } from '../../../shared/maths/skillPacks';
import { momentTopics, type MomentId } from '../../../shared/lord/maths';
import { questionLevel, type Proof } from '../../../shared/lord/proof';
import { QuestionModal, type ShownQuestion } from '../../maths/QuestionModal';

/** How a question went: the proof the server will check, and whether it was right (for the pupil's own feedback only). */
export interface Answer {
  proof: Proof;
  correct: boolean;
}
/** Null: the pupil chose not to answer. The server then treats it as no answer, never as wrong. */
export type Asked = Answer | null;

export interface AskOptions {
  title: string;
  note?: string;
  /** Lets the player say "no thanks" (the answer then counts as skipped, never as wrong). */
  closeLabel?: string;
  /** Force one kind of question (a forest event's own topic). */
  pack?: TopicId | ExtraTopicId;
}

interface Pending {
  question: Question;
  pack: SkillPack;
  packId: TopicId | ExtraTopicId;
  level: number;
  given: { value: number; ms: number } | null;
  hinted: boolean;
  options: AskOptions;
  resolve: (result: Asked) => void;
}

const isExtra = (id: string): id is ExtraTopicId => id in EXTRA_PACKS;

/**
 * Asks maths questions in the dragon game. `ask(moment, options)` shows a question box and hands back a proof of
 * how it went; `modal` is what to render. Questions come from the shared packs; the server rebuilds each one from
 * its numbers and marks it itself, so what the browser thinks is right only decides what the pupil sees.
 */
export function useAsk(heroLevel: number, facts: (FactStats & { pack: string })[] = [], topicsOn?: readonly string[]) {
  const packs = useRef(new Map<string, SkillPack>());
  const [pending, setPending] = useState<Pending | null>(null);
  // The topics the teacher has left on. A ref, so a change never makes a question box in use start again.
  const on = useRef(topicsOn);
  on.current = topicsOn;

  const packOf = (id: TopicId | ExtraTopicId): SkillPack => {
    let pack = packs.current.get(id);
    if (!pack) {
      const saved = facts.filter((f) => f.pack === id);
      pack = isExtra(id) ? makeExtraPack(id, saved) : makePack(id, saved);
      packs.current.set(id, pack);
    }
    return pack;
  };

  const ask = useCallback(
    (moment: MomentId, options: AskOptions): Promise<Asked> => {
      const topics = momentTopics(moment, on.current as (TopicId | ExtraTopicId)[] | undefined);
      const chosen = options.pack ?? (topics.length ? topics[Math.floor(Math.random() * topics.length)] : null);
      if (!chosen) return Promise.resolve(null);
      const pack = packOf(chosen);
      const level = questionLevel(chosen, heroLevel);
      const question = pack.nextQuestion({ level });
      if (!question) return Promise.resolve(null);
      return new Promise<Asked>((resolve) => setPending({ question, pack, packId: chosen, level, given: null, hinted: false, options, resolve }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroLevel, facts],
  );

  const finish = (result: Asked) => {
    pending?.resolve(result);
    setPending(null);
  };

  const modal: ReactNode = pending && (
    <QuestionModal
      question={pending.question as ShownQuestion & { answer: number }}
      title={pending.options.title}
      note={pending.options.note}
      closeLabel={pending.options.closeLabel}
      onHint={() => {
        pending.hinted = true;
      }}
      onClose={pending.options.closeLabel ? () => finish(null) : undefined}
      onSubmit={(answer, ms): AnswerResult & { answer: number } => {
        pending.given = { value: answer, ms };
        return { ...pending.pack.recordAnswer(pending.question, answer, ms), answer: pending.question.answer };
      }}
      onDone={(r) => {
        const q = pending.question;
        const given = pending.given ?? { value: Number.NaN, ms: 0 };
        finish({
          correct: r.correct,
          proof: { pack: pending.packId, key: q.factKey, kind: q.kind, params: q.params, level: pending.level, given: given.value, ms: given.ms, ...(pending.hinted ? { hinted: true } : {}) },
        });
      }}
    />
  );

  return { ask, modal };
}
