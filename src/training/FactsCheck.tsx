/**
 * The basic facts check (shared/training/check.ts): the same 24 facts every 4 weeks. A typing warm-up first (so typing time
 * comes off, as in Training), then each fact once, with no right/wrong shown, no picture help and no clock on screen. "Not
 * sure yet" moves on, and so does waiting 30 seconds. The server marks it again from the set.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHECK_CONFIG,
  CHECK_FACTS,
  CHECK_VERSION,
  checkDoneLine,
  checkOrder,
  scoreCheck,
  type CheckAnswer,
  type CheckItem,
} from '../../shared/training/check';
import { digitsOf } from '../../shared/training/facts';
import { recordTyping, type TrainingState } from '../../shared/training/records';
import { typingMsFor } from '../../shared/training/speed';
import { AnswerEntry } from './AnswerEntry';
import { TypingCheck } from './TypingCheck';
import { useShown } from './useShown';

interface Props {
  state: TrainingState;
  /** The pupil's last check, for the friendly line at the end. */
  last: { right: number; quick: number } | null;
  /** Typing times from the warm-up (saved like Training's). */
  onState: (state: TrainingState) => void;
  onDone: (item: CheckItem) => void;
  onHome: () => void;
  /** Made by the page (crypto.randomUUID); tests pass their own. */
  newId?: () => string;
}

type Step = 'intro' | 'typing' | 'ask' | 'done';

export function FactsCheck({ state, last, onState, onDone, onHome, newId = () => crypto.randomUUID() }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [typing, setTyping] = useState(state.typing);
  const order = useMemo(() => checkOrder(Math.floor(Math.random() * 2 ** 31)), []);
  const answers = useRef<CheckAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ right: number; quick: number } | null>(null);

  const answered = (given: number | null, rawMs: number) => {
    const i = order[index];
    const ms = Math.min(Math.round(rawMs), CHECK_CONFIG.questionMs);
    answers.current[i] = { given, ms, typingMs: given === null ? 0 : typingMsFor(digitsOf(CHECK_FACTS[i].answer), typing) };
    if (index + 1 < order.length) {
      setIndex(index + 1);
      return;
    }
    const item: CheckItem = { type: 'check', id: newId(), version: CHECK_VERSION, at: Date.now(), answers: answers.current };
    const s = scoreCheck(item.answers);
    setResult({ right: s.right, quick: s.quick });
    setStep('done');
    onDone(item);
  };

  if (step === 'intro') {
    return (
      <section className="tr-screen">
        <h2>Facts check</h2>
        <p>
          Every few weeks: the same {CHECK_FACTS.length} facts, so you and your teacher can see your facts grow. It takes about
          2 minutes.
        </p>
        <p className="tr-small">Answer the ones you know. If you’re not sure, tap “Not sure yet”: that’s fine.</p>
        <button type="button" className="tr-btn tr-btn-primary tr-big" onClick={() => setStep('typing')}>
          Start the check
        </button>
      </section>
    );
  }
  if (step === 'typing') {
    return (
      <TypingCheck
        first={Object.keys(state.typing).length === 0}
        autoSubmit={state.autoSubmit}
        onDone={(samples) => {
          let next = state;
          for (const s of samples) next = recordTyping(next, s.digits, s.ms);
          onState(next);
          setTyping(next.typing);
          setStep('ask');
        }}
      />
    );
  }
  if (step === 'ask') {
    return (
      <section className="tr-screen">
        <div className="tr-progress" aria-hidden>
          <span style={{ width: `${(index / order.length) * 100}%` }} />
        </div>
        <Ask key={index} prompt={CHECK_FACTS[order[index]].prompt} digits={digitsOf(CHECK_FACTS[order[index]].answer)} autoSubmit={state.autoSubmit} onAnswer={answered} />
      </section>
    );
  }
  return (
    <section className="tr-screen tr-summary">
      <h2>Facts check done!</h2>
      {result && (
        <>
          <p>
            You got {result.right} of {CHECK_FACTS.length} right.
          </p>
          <p>{checkDoneLine(result, last)}</p>
        </>
      )}
      <button type="button" className="tr-btn tr-btn-primary" onClick={onHome}>
        Back to Training
      </button>
    </section>
  );
}

function Ask({ prompt, digits, autoSubmit, onAnswer }: { prompt: string; digits: number; autoSubmit: boolean; onAnswer: (given: number | null, ms: number) => void }) {
  const { ready, shownAt } = useShown();
  const done = useRef(false);
  const send = (given: number | null) => {
    if (done.current) return;
    done.current = true;
    onAnswer(given, performance.now() - shownAt.current);
  };
  // Waiting too long moves on, as not answered.
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => send(null), CHECK_CONFIG.questionMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return (
    <>
      <div className="tr-question" aria-live="polite">
        {prompt} = ?
      </div>
      <AnswerEntry digits={digits} autoSubmit={autoSubmit} ready={ready} onSubmit={(value) => send(value)} />
      <button type="button" className="tr-btn" disabled={!ready} onClick={() => send(null)}>
        Not sure yet
      </button>
    </>
  );
}
