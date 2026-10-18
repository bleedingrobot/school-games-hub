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

/** Type a 1-digit, 2-digit and 3-digit number you can see. This is what gets taken off your answer times. */
export function TypingCheck({ first, autoSubmit, onDone }: Props) {
  const targets = useMemo(() => [pick(2, 9), pick(11, 99), pick(101, 144)], []);
  const samples = useRef<TypingSample[]>([]);
  const [index, setIndex] = useState(0);
  return (
    <TypingStep
      key={index}
      target={targets[index]}
      position={index + 1}
      total={targets.length}
      first={first}
      autoSubmit={autoSubmit}
      onTyped={(ms) => {
        samples.current.push({ digits: String(targets[index]).length, ms });
        if (index + 1 >= targets.length) onDone(samples.current);
        else setIndex(index + 1);
      }}
    />
  );
}

function TypingStep({ target, position, total, first, autoSubmit, onTyped }: { target: number; position: number; total: number; first: boolean; autoSubmit: boolean; onTyped: (ms: number) => void }) {
  const { ready, shownAt } = useShown();
  const [tries, setTries] = useState(0);
  return (
    <section className="tr-screen">
      <p className="tr-small">
        {position === 1 && first ? 'First, a quick warm-up so we know how fast you type.' : 'Quick warm-up: type the number you see.'}
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
          else setTries(tries + 1); // wrong key: just try again, the clock keeps running
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
