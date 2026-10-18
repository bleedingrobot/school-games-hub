import { useEffect, useMemo, useRef, useState } from 'react';
import { digitsOf } from '../../shared/training/facts';
import { TRAINING_CONFIG } from '../../shared/training/config';
import { recordAnswer, type TrainingState } from '../../shared/training/records';
import type { AnswerEvent } from '../../shared/training/save';
import { buildSession, nextQuestionIndex, type SessionQuestion } from '../../shared/training/session';
import { summarise, type SessionSummary } from '../../shared/training/summary';
import { AnswerEntry } from './AnswerEntry';
import { ArrayPicture } from './ArrayPicture';
import { useShown } from './useShown';

interface Props {
  state: TrainingState;
  today: string;
  seed: number;
  /** Called after every answer so progress is kept even if the page is closed. */
  onState: (state: TrainingState) => void;
  /** Called with each answer (not Fix-it ones) so the real page can save it. The preview doesn't need it. */
  onAnswered?: (answer: AnswerEvent) => void;
  onFinish: (state: TrainingState, summary: SessionSummary) => void;
}

/** Rows and columns for the picture of a fact. */
function arrayFor(q: SessionQuestion): { rows: number; cols: number } {
  const [x, y] = q.prompt.split(/ [×÷] /).map(Number);
  return q.kind === 'mul' ? { rows: x, cols: y } : { rows: y, cols: q.answer };
}

export function SessionRunner({ state: startState, today, seed, onState, onAnswered, onFinish }: Props) {
  const session = useMemo(() => buildSession(startState, today, seed), [startState, today, seed]);
  const startRecords = useRef(startState.records);
  const stateRef = useRef(startState);
  const startedAt = useRef<number | null>(null);
  const practised = useRef<string[]>([]);
  const [index, setIndex] = useState(0);
  const [fixing, setFixing] = useState<SessionQuestion | null>(null);
  const q = session.questions[index];

  const advance = () => {
    const next = nextQuestionIndex(index, session.questions.length, performance.now() - (startedAt.current ?? performance.now()));
    if (next === null) {
      onFinish(stateRef.current, summarise(startRecords.current, stateRef.current.records, practised.current));
      return;
    }
    setFixing(null);
    setIndex(next);
  };

  const answered = (value: number, rawMs: number) => {
    // Whole milliseconds, and no longer than we keep: the same number is used here and saved.
    const answerMs = Math.min(Math.round(rawMs), TRAINING_CONFIG.storage.longestAnswerMs);
    const { state, answer, typedMs } = recordAnswer(stateRef.current, q.factKey, value, q.answer, answerMs, today);
    stateRef.current = state;
    onAnswered?.({ key: q.factKey, given: value, ms: answerMs, typingMs: typedMs, at: Date.now(), day: today, seed });
    practised.current.push(q.factKey);
    onState(state);
    if (answer.correct) advance();
    else setFixing(q);
  };

  return (
    <section className="tr-screen">
      <div className="tr-progress" aria-hidden>
        <span style={{ width: `${(index / session.questions.length) * 100}%` }} />
      </div>
      {fixing ? (
        <FixIt key={`fix-${index}`} q={fixing} autoSubmit={startState.autoSubmit} onDone={advance} />
      ) : (
        <Ask
          key={index}
          q={q}
          autoSubmit={startState.autoSubmit}
          onFirstShown={(at) => {
            if (startedAt.current === null) startedAt.current = at;
          }}
          onAnswer={answered}
        />
      )}
    </section>
  );
}

function Ask({ q, autoSubmit, onFirstShown, onAnswer }: { q: SessionQuestion; autoSubmit: boolean; onFirstShown: (at: number) => void; onAnswer: (value: number, ms: number) => void }) {
  const { ready, shownAt } = useShown();
  useEffect(() => {
    if (ready) onFirstShown(shownAt.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return (
    <>
      <div className="tr-question" aria-live="polite">
        {q.prompt} = ?
      </div>
      <AnswerEntry digits={digitsOf(q.answer)} autoSubmit={autoSubmit} ready={ready} onSubmit={(value) => onAnswer(value, performance.now() - shownAt.current)} />
    </>
  );
}

/** After a wrong answer: the right answer, a picture, and the student types it in. It does not count. */
function FixIt({ q, autoSubmit, onDone }: { q: SessionQuestion; autoSubmit: boolean; onDone: () => void }) {
  const { ready } = useShown();
  const [tries, setTries] = useState(0);
  const { rows, cols } = arrayFor(q);
  return (
    <>
      <p className="tr-small tr-fix-title">Let’s look at that one together.</p>
      <div className="tr-question tr-fix">
        {q.prompt} = <strong>{q.answer}</strong>
      </div>
      <ArrayPicture rows={rows} cols={cols} />
      <p className="tr-small">
        {rows} rows of {cols} makes {q.answer}. Type {q.answer} to carry on.
      </p>
      <AnswerEntry
        key={tries}
        digits={digitsOf(q.answer)}
        autoSubmit={autoSubmit}
        ready={ready}
        hint="type it"
        onSubmit={(value) => (value === q.answer ? onDone() : setTries(tries + 1))}
      />
    </>
  );
}
