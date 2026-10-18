import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  /** Digits in the right answer: auto-submit fires when this many have been typed. */
  digits: number;
  autoSubmit: boolean;
  /** False until the question is fully on screen. Keys pressed before then are ignored. */
  ready: boolean;
  onSubmit: (value: number) => void;
  /** Optional line shown above the pad's display (kept calm). */
  hint?: string;
}

const MAX_DIGITS = 3;

/** Big number pad with the number keys, Backspace and Enter working too. */
export function AnswerEntry({ digits, autoSubmit, ready, onSubmit, hint }: Props) {
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const done = useRef(false);

  const submit = useCallback(
    (text: string) => {
      if (!text || done.current) return;
      done.current = true;
      onSubmit(Number(text));
    },
    [onSubmit],
  );

  const set = useCallback((text: string) => {
    typedRef.current = text;
    setTyped(text);
  }, []);

  const press = useCallback(
    (d: string) => {
      if (!ready || done.current) return;
      const next = (typedRef.current + d).slice(0, MAX_DIGITS);
      if (next === typedRef.current) return;
      set(next);
      if (autoSubmit && next.length >= digits) submit(next);
    },
    [ready, autoSubmit, digits, submit, set],
  );
  const back = useCallback(() => {
    if (!done.current) set(typedRef.current.slice(0, -1));
  }, [set]);
  const enter = useCallback(() => {
    if (ready) submit(typedRef.current);
  }, [ready, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') enter();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, back, enter]);

  return (
    <div className="tr-entry">
      <div className="tr-display" aria-live="polite" aria-label="Your answer">
        {typed || <span className="tr-placeholder">{hint ?? '?'}</span>}
      </div>
      <div className="tr-pad" role="group" aria-label="Number pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="tr-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="tr-key tr-key-soft" onClick={back} aria-label="Delete">
          ⌫
        </button>
        <button type="button" className="tr-key" onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="tr-key tr-key-ok" onClick={enter} disabled={!typed} aria-label="Done">
          ✓
        </button>
      </div>
    </div>
  );
}
