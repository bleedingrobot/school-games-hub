import { useCallback, useEffect, useRef, useState } from 'react';
import { FRAME_CAPACITY, SUBITISING_CONFIG as CONFIG } from '../../shared/subitising/config';
import { isStruggling } from '../../shared/subitising/engine';
import { groupSizes } from '../../shared/subitising/patterns';
import type { Trial } from '../../shared/subitising/trials';
import { speak } from '../speech';
import { BlankPicture, PictureSvg } from './PictureSvg';

export interface AnswerResult {
  given: number;
  correct: boolean;
  /** From the buttons unlocking to the tap. 0 when the picture stayed on screen. */
  thinkingMs: number;
  /** The picture stayed on screen with help (after a struggle), so it doesn't count towards a stage. */
  helped: boolean;
  peeked: boolean;
}

interface Props {
  total: number;
  /** Pictures never flash: they stay until the student answers. Answers still count. */
  guidedMode: boolean;
  /** The starting check: no help pictures and no peeking, so the check shows where the student really is. */
  checking?: boolean;
  /** The next picture, made from the student's answers so far. */
  next: (index: number, last: Trial | null) => Trial;
  onAnswer: (trial: Trial, result: AnswerResult) => void;
  onFinish: () => void;
  /** Read the prompts aloud (never the answer before it has been given). Undefined = no read-aloud button at all. */
  readAloud?: { on: boolean; onChange: (on: boolean) => void };
}

type Phase = 'ready' | 'show' | 'answer' | 'peek' | 'feedback';

/** "5 and 3", from the natural groups of a picture (nothing when it is just one group). */
function partsText(trial: Trial): string {
  const sizes = groupSizes(trial.picture);
  return sizes.length > 1 ? sizes.join(' and ') : '';
}

/** The line said after an answer. It names the answer, so it is only used once the student has answered. */
function feedbackText(trial: Trial, result: AnswerResult): string {
  const parts = partsText(trial);
  if (trial.activity === 'gap') {
    return `${trial.n} counters and ${trial.answer} empty squares make ${FRAME_CAPACITY[trial.type] ?? 0}.`;
  }
  return result.correct ? `Yes! ${trial.answer}${parts ? `: ${parts}` : ''}.` : `Let me show you again. It was ${trial.answer}${parts ? `: ${parts}` : ''}.`;
}

export function FlashRunner({ total, guidedMode, checking = false, next, onAnswer, onFinish, readAloud }: Props) {
  const [index, setIndex] = useState(0);
  const [trial, setTrial] = useState<Trial>(() => next(0, null));
  const [phase, setPhase] = useState<Phase>(() => (guidedMode ? 'answer' : 'ready'));
  const [locked, setLocked] = useState(!guidedMode);
  const [helped, setHelped] = useState(false);
  const [peekAllowed, setPeekAllowed] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);

  const unlockedAt = useRef(0);
  const recent = useRef<boolean[]>([]);
  const lastThinking = useRef<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const staticPicture = helped || guidedMode;

  useEffect(() => {
    if (phase === 'ready') {
      const t = window.setTimeout(() => setPhase('show'), CONFIG.readyMs);
      return () => window.clearTimeout(t);
    }
    if (phase === 'show') {
      // Start the clock once the picture is on screen, not when we asked for it.
      let t = 0;
      const frame = requestAnimationFrame(() => {
        t = window.setTimeout(() => setPhase('answer'), trial.flashMs);
      });
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(t);
      };
    }
    if (phase === 'peek') {
      const t = window.setTimeout(() => setPhase('answer'), CONFIG.peekMs);
      return () => window.clearTimeout(t);
    }
    if (phase === 'answer' && locked) {
      const t = window.setTimeout(() => {
        setLocked(false);
        unlockedAt.current = performance.now();
      }, CONFIG.answerLockMs);
      return () => window.clearTimeout(t);
    }
  }, [phase, locked, trial]);

  const choose = useCallback(
    (value: number) => {
      if (phase !== 'answer' || locked) return;
      const thinkingMs = staticPicture ? 0 : Math.max(0, performance.now() - unlockedAt.current);
      const r: AnswerResult = { given: value, correct: value === trial.answer, thinkingMs, helped, peeked };
      setResult(r);
      setPhase('feedback');
      if (helped) {
        // A help picture starts again: the next one is judged on its own.
        recent.current = [];
        lastThinking.current = null;
      } else {
        recent.current = [...recent.current, r.correct].slice(-CONFIG.stepBackWindow);
        lastThinking.current = guidedMode ? null : thinkingMs;
      }
      onAnswer(trial, r);
    },
    [phase, locked, staticPicture, trial, helped, peeked, guidedMode, onAnswer],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key) && trial.choices.includes(Number(e.key))) choose(Number(e.key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, trial]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [index]);

  // Read the words out loud for students who can't read them yet. The answer is only ever said in the
  // feedback line, after the student has answered.
  const reading = readAloud?.on ?? false;
  useEffect(() => {
    if (!reading) return;
    if (phase === 'ready') speak('Get ready');
    else if (phase === 'answer') speak(helped ? 'Take your time. Can you see smaller groups?' : trial.activity === 'gap' ? 'How many empty squares?' : 'How many did you see?');
  }, [reading, phase, helped, trial]);
  useEffect(() => {
    if (reading && phase === 'feedback' && result) speak(feedbackText(trial, result));
  }, [reading, phase, result, trial]);

  const advance = () => {
    if (index + 1 >= total) {
      onFinish();
      return;
    }
    const i = index + 1;
    const struggling = !guidedMode && !checking && isStruggling(recent.current, lastThinking.current);
    const t = next(i, trial);
    setTrial(t);
    setIndex(i);
    setResult(null);
    setPeeked(false);
    setHelped(struggling);
    setPeekAllowed(helped && !struggling && !guidedMode && !checking);
    setLocked(!(struggling || guidedMode));
    setPhase(struggling || guidedMode ? 'answer' : 'ready');
  };

  const gap = trial.activity === 'gap';
  const prompt = gap ? 'How many empty squares?' : 'How many did you see?';
  const showing = phase === 'show' || phase === 'peek' || (phase === 'answer' && staticPicture) || phase === 'feedback';
  const mode = phase === 'feedback' ? (result?.correct ? 'right' : 'help') : helped && phase === 'answer' ? 'help' : 'plain';
  const label =
    phase === 'feedback' ? `The picture again. ${gap ? `${trial.n} counters and ${trial.answer} empty` : `${trial.answer}`}.` : phase === 'ready' ? 'Get ready' : phase === 'answer' && !staticPicture ? 'The picture has gone' : 'A picture is showing';

  const feedback = result ? feedbackText(trial, result) : '';

  return (
    <section className="sb-screen" aria-label="Quick looks">
      <h1 ref={heading} tabIndex={-1} className="sb-prompt">
        {phase === 'ready' ? 'Get ready…' : helped && phase === 'answer' ? 'Take your time. Can you see smaller groups?' : prompt}
      </h1>
      <div className="sb-stage">
        {showing ? <PictureSvg picture={trial.picture} mode={mode} ghosts={gap && phase === 'feedback'} label={label} /> : <BlankPicture label={label} />}
      </div>
      <div className="sb-live" role="status" aria-live="polite">
        {phase === 'answer' && !staticPicture ? 'The picture has gone. How many?' : phase === 'feedback' ? feedback : ''}
      </div>

      {phase === 'feedback' ? (
        <>
          <p className={result?.correct ? 'sb-good' : 'sb-calm'}>{feedback}</p>
          <button type="button" className="sb-btn sb-btn-primary sb-big" onClick={advance}>
            {index + 1 >= total ? 'Finish' : 'Next'}
          </button>
        </>
      ) : (
        <>
          <div className="sb-choices" role="group" aria-label="Answers">
            {trial.choices.map((c) => (
              <button key={c} type="button" className="sb-choice" disabled={phase !== 'answer' || locked} onClick={() => choose(c)}>
                {c}
              </button>
            ))}
          </div>
          {phase === 'answer' && peekAllowed && !peeked && !staticPicture && (
            <button
              type="button"
              className="sb-btn"
              onClick={() => {
                setPeeked(true);
                setPhase('peek');
              }}
            >
              Peek again
            </button>
          )}
        </>
      )}

      <div className="sb-progress" role="img" aria-label={`Picture ${index + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < index || (i === index && phase === 'feedback') ? 'on' : ''} />
        ))}
      </div>
      {readAloud && (
        <button type="button" className="sb-btn sb-btn-quiet" aria-pressed={readAloud.on} onClick={() => readAloud.onChange(!readAloud.on)}>
          <span aria-hidden="true">{readAloud.on ? '🔊 ' : '🔇 '}</span>
          {readAloud.on ? 'Reading out loud: on' : 'Reading out loud: off'}
        </button>
      )}
      <button type="button" className="sb-btn sb-btn-quiet" onClick={onFinish}>
        Finish for now
      </button>
    </section>
  );
}
