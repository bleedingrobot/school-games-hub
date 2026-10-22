import { useMemo, useRef, useState } from 'react';
import { AnswerEntry } from './AnswerEntry';
import { useShown } from './useShown';

export interface TypingSample {
  digits: number;
  ms: number;
}

interface Props {
  first: boolean;
  autoSubmit: boolean;
  onDone: (samples: TypingSample[]) => void;
}

const pick = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

/**
 * Type a 1-digit, 2-digit and 3-digit number you can see. This is what gets taken off your answer times. The very first time,
 * one practice number comes first and isn't timed, so reading what to do doesn't count as typing.
 */
export function TypingCheck({ first, autoSubmit, onDone }: Props) {
  const practice = first ? 1 : 0;
  const targets = useMemo(() => [...(first ? [pick(2, 9)] : []), pick(2, 9), pick(11, 99), pick(101, 144)], [first]);
  const samples = useRef<TypingSample[]>([]);
  const [index, setIndex] = useState(0);
  return (
    <TypingStep
      key={index}
      target={targets[index]}
      position={index + 1}
      total={targets.length}
      practice={index < practice}
      autoSubmit={autoSubmit}
      onTyped={(ms) => {
        if (index >= practice) samples.current.push({ digits: String(targets[index]).length, ms });
        if (index + 1 >= targets.length) onDone(samples.current);
        else setIndex(index + 1);
      }}
    />
  );
}

function TypingStep({ target, position, total, practice, autoSubmit, onTyped }: { target: number; position: number; total: number; practice: boolean; autoSubmit: boolean; onTyped: (ms: number) => void }) {
  const { ready, shownAt } = useShown();
  const [tries, setTries] = useState(0);
  return (
    <section className="tr-screen">
      <p className="tr-small">
        {practice
          ? 'First, a quick warm-up so we know how fast you type. This one is just for practice: type the number you see.'
          : 'Quick warm-up: type the number you see.'}
      </p>
      <div className="tr-question" aria-live="polite">
        {target}
      </div>
      <AnswerEntry
        key={tries}
        digits={String(target).length}
        autoSubmit={autoSubmit}
        ready={ready}
        hint="type it"
        onSubmit={(value) => {
          const ms = performance.now() - shownAt.current;
          if (value === target) onTyped(ms);
          else {
            // Wrong key: just try again, timed from now (a slip is not typing time).
            shownAt.current = performance.now();
            setTries(tries + 1);
          }
        }}
      />
      <div className="tr-dots" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < position ? 'on' : ''} />
        ))}
      </div>
    </section>
  );
}
