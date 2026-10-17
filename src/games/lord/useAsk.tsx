import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { AnswerResult } from '../../../shared/maths/skillPack';
import type { SkillPack } from '../../../shared/maths/skillPack';
import { EXTRA_PACKS, makeExtraPack, makePack, type ExtraTopicId, type TopicId } from '../../../shared/maths/skillPacks';
import { MOMENT_TOPICS, defaultBand, type MomentId } from '../../../shared/lord/maths';
import type { Result } from '../../../shared/lord/maths';
import { QuestionModal, type ShownQuestion } from '../../maths/QuestionModal';

export type Asked = Result | 'skipped';

export interface AskOptions {
  title: string;
  note?: string;
  /** Lets the player say "no thanks" (the answer then counts as skipped, never as wrong). */
  closeLabel?: string;
  /** Force one kind of question (a forest event's own topic). */
  pack?: TopicId | ExtraTopicId;
}

interface Pending {
  question: ShownQuestion & { answer: number };
  pack: SkillPack;
  options: AskOptions;
  resolve: (result: Asked) => void;
  full: Parameters<SkillPack['recordAnswer']>[0];
}

const isExtra = (id: string): id is ExtraTopicId => id in EXTRA_PACKS;
/** Times tables use campaign levels (1-10), the other packs use bands (1-4). */
const levelFor = (pack: string, band: number) => (pack === 'times-tables' ? [1, 3, 6, 9][band - 1] ?? 1 : band);

/**
 * Asks maths questions in the dragon game. `ask(moment, options)` shows a question box and says how it went;
 * `modal` is what to render. Questions come from the shared packs and nothing is saved yet (trial).
 */
export function useAsk(heroLevel: number, enabled?: readonly string[]) {
  const packs = useRef(new Map<string, SkillPack>());
  const [pending, setPending] = useState<Pending | null>(null);

  const packOf = (id: TopicId | ExtraTopicId): SkillPack => {
    let pack = packs.current.get(id);
    if (!pack) {
      pack = isExtra(id) ? makeExtraPack(id) : makePack(id);
      packs.current.set(id, pack);
    }
    return pack;
  };

  const ask = useCallback(
    (moment: MomentId, options: AskOptions): Promise<Asked> => {
      const topics = (MOMENT_TOPICS[moment] as (TopicId | ExtraTopicId)[]).filter((t) => !enabled || enabled.includes(t));
      const chosen = options.pack ?? (topics.length ? topics[Math.floor(Math.random() * topics.length)] : null);
      if (!chosen) return Promise.resolve('skipped');
      const pack = packOf(chosen);
      const question = pack.nextQuestion({ level: levelFor(chosen, defaultBand(heroLevel)) });
      if (!question) return Promise.resolve('skipped');
      return new Promise<Asked>((resolve) => setPending({ question, pack, options, resolve, full: question }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroLevel, enabled],
  );

  const finish = (result: Asked) => {
    pending?.resolve(result);
    setPending(null);
  };

  const modal: ReactNode = pending && (
    <QuestionModal
      question={pending.question}
      title={pending.options.title}
      note={pending.options.note}
      closeLabel={pending.options.closeLabel}
      onClose={pending.options.closeLabel ? () => finish('skipped') : undefined}
      onSubmit={(answer, ms): AnswerResult & { answer: number } => ({ ...pending.pack.recordAnswer(pending.full, answer, ms), answer: pending.question.answer })}
      onDone={(r) => finish(r.correct ? 'right' : 'wrong')}
    />
  );

  return { ask, modal };
}
