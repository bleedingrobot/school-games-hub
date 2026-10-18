/**
 * One maths question in a box over the game. The fact is shown big and clear; the student
 * types the answer (number pad or keyboard) or, in multiple-choice mode, taps one of four.
 *
 * Right: a sparkle and "Correct!", then it closes. Wrong: no buzzer, nothing taken away,
 * just the whole fact ("7 × 8 = 56") for 2 seconds, then it closes. The game decides what a
 * right answer earns. Reusable by any hub game: it only knows about a `Question`.
 *
 * Parts like '3/4' are drawn as fractions ('?/8' has the blank on top), parts with words are
 * drawn smaller, and decimal questions get a point key.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { spokenFraction } from '../../shared/maths/banded';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { NumberPad } from './NumberPad';
import './maths.css';

/** How long the feedback shows, in milliseconds. */
export const FEEDBACK_MS = { right: 800, wrong: 2000 };
const MAX_DIGITS = 3;

const FRACTION = /^(?:(\d+|\?) )?(\d+|\?)\/(\d+|\?)$/;

/** One part of the question: a fraction, a word, or a plain number or sign. `blank` stands in for '?'. */
function Part({ text, blank }: { text: string; blank: ReactNode }) {
  const fill = (piece: string) => (piece === '?' ? blank : piece);
  const f = FRACTION.exec(text);
  if (f) {
    return (
      <span className="qfrac">
        {f[1] !== undefined && <span className="qfrac__whole">{fill(f[1])}</span>}
        <span className="qfrac__stack">
          <span className="qfrac__top">{fill(f[2])}</span>
          <span className="qfrac__bottom">{fill(f[3])}</span>
        </span>
      </span>
    );
  }
  if (text === '?') return <>{blank}</>;
  if (/[a-z]/i.test(text)) return <span className="question__word">{text}</span>;
  return <span>{text}</span>;
}

/** What a screen reader says for the digits typed so far: "4.15" is "4 point 1 5", "4." is "4 point". */
function spokenTyped(typed: string): string {
  const [whole, fraction] = typed.split('.');
  return typed.includes('.') ? `${whole} point ${fraction.split('').join(' ')}`.trim() : whole;
}

/** A choice button's text: fractions drawn as fractions. */
const choiceText = (label: string) => (FRACTION.test(label) ? <Part text={label} blank={null} /> : label);


/** What the box needs of a question. `answer` is missing when the game's server keeps it secret until marked. */
export type ShownQuestion = Pick<Question, 'id' | 'parts' | 'spoken' | 'choices' | 'choiceLabels' | 'maxLength' | 'input'> & { answer?: number };

/**
 * A marked answer, plus what it earned, e.g. "+15 mana" (shown under "Correct!"). `answer` is
 * the right answer, for when the game's server marked it (so the box didn't know it before).
 */
export type MarkedAnswer = AnswerResult & { reward?: string; answer?: number };

export function QuestionModal({
  question,
  title,
  note,
  onSubmit,
  onDone,
  onClose,
  closeLabel = 'Close',
  timeScale = 1,
  inline = false,
  secondsLeft = null,
}: {
  question: ShownQuestion;
  /** What the question is for, e.g. "Mana Well". */
  title: string;
  /** A line under the title, e.g. "Correct answers give mana". */
  note?: string;
  /** Marks the answer (the game records it). May take a moment, if the game's server does the marking. */
  onSubmit: (answer: number, ms: number) => MarkedAnswer | Promise<MarkedAnswer>;
  /** Called after the feedback has been shown. */
  onDone: (result: MarkedAnswer) => void;
  /** If given, the student may stop (a button, and Escape) before answering. */
  onClose?: () => void;
  closeLabel?: string;
  /** Tests set 0 to skip the feedback pause. */
  timeScale?: number;
  /** A card in the page, not a pop-up over it: no dimmed backdrop, no focus grab. */
  inline?: boolean;
  /** A countdown to show, when the game gives the question a time limit. */
  secondsLeft?: number | null;
}) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<MarkedAnswer | null>(null);
  const [checking, setChecking] = useState(false);
  const [trouble, setTrouble] = useState('');
  const shownAt = useRef(performance.now());
  const box = useRef<HTMLDivElement>(null);
  const titleId = `question-${question.id}-title`;

  // A new question: clear the answer and start the clock.
  useEffect(() => {
    setTyped('');
    setResult(null);
    setChecking(false);
    setTrouble('');
    shownAt.current = performance.now();
    if (!inline) box.current?.focus();
  }, [question.id, inline]);

  // Each answer is reported exactly once, however often the parent re-renders.
  const reportDone = useRef(onDone);
  reportDone.current = onDone;
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => reportDone.current(result), (result.correct ? FEEDBACK_MS.right : FEEDBACK_MS.wrong) * timeScale);
    return () => window.clearTimeout(timer);
  }, [result, timeScale]);

  function submit(answer: number) {
    if (result || checking) return;
    const marked = onSubmit(answer, Math.round(performance.now() - shownAt.current));
    if (!('then' in marked)) {
      setResult(marked);
      return;
    }
    // The server is marking it: wait for it, and let the student try again if it didn't answer.
    setChecking(true);
    setTrouble('');
    marked.then(
      (done) => {
        setChecking(false);
        setResult(done);
      },
      (error: unknown) => {
        setChecking(false);
        setTrouble(error instanceof Error && error.message ? error.message : 'We couldn’t check that one. Try again.');
      },
    );
  }

  const maxLength = question.maxLength ?? MAX_DIGITS;
  const decimal = question.input === 'decimal';
  const addDigit = (d: string) =>
    setTyped((t) => {
      if (t.length >= maxLength) return t;
      if (d === '.') return !decimal || t.includes('.') ? t : t === '' ? '0.' : t + '.';
      return t === '0' ? (d === '0' ? t : d) : t + d;
    });
  const back = () => setTyped((t) => t.slice(0, -1));
  const enter = () => typed !== '' && submit(Number(typed));

  function keys(event: React.KeyboardEvent) {
    if (event.key === 'Escape' && onClose && !result) {
      event.preventDefault();
      onClose();
      return;
    }
    if (result || checking || question.choices) return;
    // Enter on a focused button (keyboard users tabbing round the pad) presses that button.
    if (event.key === 'Enter' && event.target instanceof HTMLButtonElement) return;
    if (/^[0-9.]$/.test(event.key)) addDigit(event.key);
    else if (event.key === 'Backspace') back();
    else if (event.key === 'Enter') enter();
    else return;
    event.preventDefault();
  }

  const blank = typed === '' ? '?' : typed;
  // Money answers are shown with cents: 4.1 → 4.10.
  const rightAnswer = result?.answer ?? question.answer ?? 0;
  const answerText = question.parts.includes('$') ? rightAnswer.toFixed(2) : String(rightAnswer);
  const blankBox = (
    <span className="question__blank" data-empty={typed === '' || undefined}>
      {result ? (result.correct ? blank : answerText) : blank}
    </span>
  );
  return (
    <div className={inline ? undefined : 'question-backdrop'}>
      <div
        ref={box}
        className={inline ? 'question question--inline' : 'question'}
        role={inline ? 'group' : 'dialog'}
        aria-modal={inline ? undefined : true}
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={keys}
        data-result={result ? (result.correct ? 'right' : 'wrong') : undefined}
      >
        <h2 id={titleId} className="question__title">
          {title}
        </h2>
        {note && <p className="question__note">{note}</p>}
        <p className="question__fact" aria-label={question.spoken} data-long={question.parts.join('').length > 12 || undefined}>
          {question.parts.map((part, i) => (
            <Part key={i} text={part} blank={blankBox} />
          ))}
        </p>
        {secondsLeft !== null && !result && (
          <p className="question__timer" role="timer" aria-label={`${secondsLeft} seconds left`}>
            ⏱ {secondsLeft}
          </p>
        )}
        {/* The timer above isn't read out every second; screen readers hear a warning at 10 and 5. */}
        <p className="sr-only" aria-live="polite">
          {secondsLeft !== null && !result && (secondsLeft === 10 || secondsLeft === 5) ? `${secondsLeft} seconds left` : ''}
        </p>
        <p className="question__feedback" role="status">
          {checking && 'Checking…'}
          {trouble && !checking && !result && trouble}
          {result?.correct && (
            <>
              <span className="question__sparkle" aria-hidden="true">
                ✦
              </span>{' '}
              Correct!{result.reward && <span className="question__reward"> {result.reward}</span>}
            </>
          )}
          {result && !result.correct && <>{result.fact}</>}
        </p>
        {question.choices ? (
          <div className="question__choices" role="group" aria-label="Choose an answer">
            {question.choices.map((choice, i) => (
              <button
                key={choice}
                type="button"
                className="question__choice"
                aria-label={question.choiceLabels ? spokenFraction(question.choiceLabels[i]) : undefined}
                disabled={!!result || checking}
                data-answer={result && choice === (result.answer ?? question.answer) ? true : undefined}
                onClick={() => submit(choice)}
              >
                {question.choiceLabels ? choiceText(question.choiceLabels[i]) : choice}
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {typed ? `Your answer: ${spokenTyped(typed)}` : ''}
            </p>
            <NumberPad onDigit={addDigit} onBack={back} onEnter={enter} canEnter={typed !== '' && typed !== '0.'} disabled={!!result || checking} decimal={decimal} />
          </>
        )}
        {onClose && (
          <button type="button" className="question__close" disabled={!!result || checking} onClick={onClose}>
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  );
}
