/**
 * One practical maths question (from shared/maths/practical.ts) in the question box's look: the
 * question in words, an answer box with the number pad (with a minus key when the topic has
 * negatives), or big buttons to tap for "which is better". No timer. The parent decides what a
 * right answer earns and what to show after; this only collects the answer.
 */
import { useEffect, useRef, useState } from 'react';
import type { PracticalQuestion } from '../../shared/maths/practical';
import { NumberPad } from './NumberPad';
import { noteQuestion, spotFromTitle } from './questionLog';
import './maths.css';

const MAX_CHARS = 6;

export function PracticalAsk({
  question,
  title,
  note,
  onSubmit: submitAnswer,
  onNoThanks: noThanksGiven,
  noThanksLabel = 'No thanks',
}: {
  question: PracticalQuestion;
  title: string;
  note?: string;
  /** The number typed or the choice tapped. */
  onSubmit: (answer: number) => void;
  /** If given, a button to skip the question without answering. */
  onNoThanks?: () => void;
  noThanksLabel?: string;
}) {
  const [typed, setTyped] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const negatives = question.topic === 'integers';
  const titleId = `ask-${question.kind}-title`;

  useEffect(() => {
    setTyped('');
    box.current?.focus();
  }, [question]);

  // Each question shown is noted once for the teacher (questionLog.ts): answered, or skipped ("No thanks", or the box going away
  // without an answer).
  const noted = useRef<PracticalQuestion | null>(null);
  const spot = useRef('');
  spot.current = spotFromTitle(title);
  useEffect(() => {
    const started = performance.now();
    return () => {
      if (noted.current !== question) noteQuestion({ spot: spot.current, skipped: true, ms: performance.now() - started });
    };
  }, [question]);
  const shownAt = useRef(performance.now());
  useEffect(() => {
    shownAt.current = performance.now();
  }, [question]);
  const record = (skipped: boolean) => {
    if (noted.current === question) return;
    noted.current = question;
    noteQuestion({ spot: spot.current, skipped, ms: performance.now() - shownAt.current });
  };
  const onSubmit = (answer: number) => {
    record(false);
    submitAnswer(answer);
  };
  const onNoThanks = noThanksGiven && (() => {
    record(true);
    noThanksGiven();
  });

  const addDigit = (d: string) => setTyped((t) => (t.replace('-', '').length >= MAX_CHARS || (t.replace('-', '') === '0' && d === '0') ? t : t.replace('-', '') === '0' ? t.replace('0', d) : t + d));
  const back = () => setTyped((t) => t.slice(0, -1));
  const minus = () => setTyped((t) => (t.startsWith('-') ? t.slice(1) : `-${t}`));
  const enter = () => {
    const n = Number(typed);
    if (typed !== '' && typed !== '-' && Number.isFinite(n)) onSubmit(n);
  };

  function keys(event: React.KeyboardEvent) {
    if (question.choices) return;
    if (event.key === 'Enter' && event.target instanceof HTMLButtonElement) return;
    if (/^[0-9]$/.test(event.key)) addDigit(event.key);
    else if (event.key === '-' && negatives) minus();
    else if (event.key === 'Backspace') back();
    else if (event.key === 'Enter') enter();
    else return;
    event.preventDefault();
  }

  return (
    <div ref={box} className="question question--inline question--practical" role="group" aria-labelledby={titleId} tabIndex={-1} onKeyDown={keys}>
      <h2 id={titleId} className="question__title">
        {title}
      </h2>
      {note && <p className="question__note">{note}</p>}
      <p className="question__text">{question.text}</p>
      {question.choices ? (
        <div className="question__choices" role="group" aria-label="Tap an answer">
          {question.choices.map((c) => (
            <button key={c.value} type="button" className="question__choice question__choice--label" onClick={() => onSubmit(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="question__answer" aria-live="polite">
            <span className="question__blank" data-empty={typed === '' || undefined}>
              {typed === '' ? '?' : typed.replace('-', '−')}
            </span>
            {question.unit && <span className="question__unit"> {question.unit}</span>}
          </p>
          <NumberPad onDigit={addDigit} onBack={back} onEnter={enter} canEnter={typed !== '' && typed !== '-'} onMinus={negatives ? minus : undefined} />
        </>
      )}
      {onNoThanks && (
        <button type="button" className="question__close" onClick={onNoThanks}>
          {noThanksLabel}
        </button>
      )}
    </div>
  );
}

/** The worked answer, one step per line, after a wrong answer or "No thanks". */
export function Working({ question }: { question: PracticalQuestion }) {
  return (
    <div className="working" role="status">
      <p className="working__answer">
        The answer is <strong>{question.choices ? (question.choices.find((c) => c.value === question.answer)?.label ?? question.answer) : question.answer}</strong>
        {question.unit && !question.choices ? ` ${question.unit}` : ''}.
      </p>
      <ol className="working__steps">
        {question.working.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </div>
  );
}
