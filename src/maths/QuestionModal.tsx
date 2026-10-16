/**
 * One maths question in a box over the game. The fact is shown big and clear; the student
 * types the answer (number pad or keyboard) or, in multiple-choice mode, taps one of four.
 *
 * Right: a sparkle and "Correct!", then it closes. Wrong: no buzzer, nothing taken away,
 * just the whole fact ("7 × 8 = 56") for 2 seconds, then it closes. The game decides what a
 * right answer earns. Reusable by any hub game: it only knows about a `Question`.
 */
import { useEffect, useRef, useState } from 'react';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { NumberPad } from './NumberPad';
import './maths.css';

/** How long the feedback shows, in milliseconds. */
export const FEEDBACK_MS = { right: 800, wrong: 2000 };
const MAX_DIGITS = 3;

export function QuestionModal({
  question,
  title,
  note,
  onSubmit,
  onDone,
  timeScale = 1,
}: {
  question: Question;
  /** What the question is for, e.g. "Mana Well". */
  title: string;
  /** A line under the title, e.g. "Correct answers give mana". */
  note?: string;
  /** Marks the answer (the game records it). */
  onSubmit: (answer: number, ms: number) => AnswerResult;
  /** Called after the feedback has been shown. */
  onDone: (result: AnswerResult) => void;
  /** Tests set 0 to skip the feedback pause. */
  timeScale?: number;
}) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const shownAt = useRef(performance.now());
  const box = useRef<HTMLDivElement>(null);
  const titleId = `question-${question.id}-title`;

  // A new question: clear the answer and start the clock.
  useEffect(() => {
    setTyped('');
    setResult(null);
    shownAt.current = performance.now();
    box.current?.focus();
  }, [question.id]);

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => onDone(result), (result.correct ? FEEDBACK_MS.right : FEEDBACK_MS.wrong) * timeScale);
    return () => window.clearTimeout(timer);
  }, [result, onDone, timeScale]);

  function submit(answer: number) {
    if (result) return;
    setResult(onSubmit(answer, Math.round(performance.now() - shownAt.current)));
  }

  const addDigit = (d: string) => setTyped((t) => (t.length >= MAX_DIGITS || (t === '0' && d === '0') ? t : t === '0' ? d : t + d));
  const back = () => setTyped((t) => t.slice(0, -1));
  const enter = () => typed !== '' && submit(Number(typed));

  function keys(event: React.KeyboardEvent) {
    if (result || question.choices) return;
    // Enter on a focused button (keyboard users tabbing round the pad) presses that button.
    if (event.key === 'Enter' && event.target instanceof HTMLButtonElement) return;
    if (/^[0-9]$/.test(event.key)) addDigit(event.key);
    else if (event.key === 'Backspace') back();
    else if (event.key === 'Enter') enter();
    else return;
    event.preventDefault();
  }

  const blank = typed === '' ? '?' : typed;
  return (
    <div className="question-backdrop">
      <div
        ref={box}
        className="question"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={keys}
        data-result={result ? (result.correct ? 'right' : 'wrong') : undefined}
      >
        <h2 id={titleId} className="question__title">
          {title}
        </h2>
        {note && <p className="question__note">{note}</p>}
        <p className="question__fact" aria-label={question.spoken}>
          {question.parts.map((part, i) =>
            part === '?' ? (
              <span key={i} className="question__blank" data-empty={typed === '' || undefined}>
                {result ? (result.correct ? blank : question.answer) : blank}
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </p>
        <p className="question__feedback" role="status">
          {result?.correct && (
            <>
              <span className="question__sparkle" aria-hidden="true">
                ✦
              </span>{' '}
              Correct!
            </>
          )}
          {result && !result.correct && <>{result.fact}</>}
        </p>
        {question.choices ? (
          <div className="question__choices" role="group" aria-label="Choose an answer">
            {question.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                className="question__choice"
                disabled={!!result}
                data-answer={result && choice === question.answer ? true : undefined}
                onClick={() => submit(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {typed ? `Your answer: ${typed}` : ''}
            </p>
            <NumberPad onDigit={addDigit} onBack={back} onEnter={enter} canEnter={typed !== ''} disabled={!!result} />
          </>
        )}
      </div>
    </div>
  );
}
