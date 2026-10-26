/**
 * A round of maths questions in the game: one for the Gem Forge, three at the Wave Gate,
 * five for the Keep Shield, ten for the Level Key, up to ten at the Mana Well. Asks them
 * one after another and reports how many were right and which facts were missed.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Question, QuestionContext, SkillPack } from '../../../../shared/maths/skillPack';
import { QuestionModal, type MarkedAnswer } from '../../../maths/QuestionModal';

export interface RoundResult {
  asked: number;
  right: number;
  /** Facts answered wrongly, written out: "7 × 8 = 56". */
  missed: string[];
}

export function MathsRound({
  pack,
  ctx,
  count,
  title,
  note,
  onMarked,
  onFinish,
  onClose,
  closeLabel,
  timeScale,
}: {
  pack: SkillPack;
  ctx: QuestionContext;
  count: number;
  title: string;
  note?: (asked: number, right: number) => string;
  /** Called with every marked answer; returns what it earned ("+15 mana"), if anything. */
  onMarked?: (result: MarkedAnswer) => string | undefined;
  onFinish: (result: RoundResult) => void;
  onClose?: (result: RoundResult) => void;
  closeLabel?: string;
  timeScale?: number;
}) {
  const [question, setQuestion] = useState<Question | null>(() => pack.nextQuestion(ctx));
  const [tally, setTally] = useState<RoundResult>({ asked: 0, right: 0, missed: [] });

  // No question possible (every table switched off): never block the game.
  useEffect(() => {
    if (!question) onFinish({ asked: count, right: count, missed: [] });
  }, [question, count, onFinish]);

  const done = useCallback(
    (result: MarkedAnswer) => {
      const next = {
        asked: tally.asked + 1,
        right: tally.right + (result.correct ? 1 : 0),
        missed: result.correct ? tally.missed : [...tally.missed, result.fact],
      };
      setTally(next);
      if (next.asked >= count) onFinish(next);
      else setQuestion(pack.nextQuestion(ctx));
    },
    [tally, count, onFinish, pack, ctx],
  );

  if (!question) return null;
  return (
    <QuestionModal
      question={question}
      title={title}
      note={note?.(tally.asked, tally.right)}
      onSubmit={(answer, ms) => {
        const result: MarkedAnswer = pack.recordAnswer(question, answer, ms);
        return { ...result, reward: onMarked?.(result) };
      }}
      onDone={done}
      onClose={onClose && (() => onClose(tally))}
      closeLabel={closeLabel}
      // Gem Keep's rounds are ones the player chose to start, so "Well done" and "Cancel" stay with the skip switch off (James).
      closeIsSkip={false}
      timeScale={timeScale}
    />
  );
}
