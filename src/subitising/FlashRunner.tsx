import { useCallback, useEffect, useRef, useState } from 'react';
import { FRAME_CAPACITY, SUBITISING_CONFIG as CONFIG } from '../../shared/subitising/config';
import { isStruggling } from '../../shared/subitising/engine';
import { groupSizes } from '../../shared/subitising/patterns';
import type { Trial } from '../../shared/subitising/trials';
import { speak, stopSpeaking } from '../speech';
import { Friend } from './Friend';
import { BlankPicture, PictureSvg } from './PictureSvg';
import { flashFeedback, gapFeedback, gapWords, helpedPrompt, PROMPTS, VOICE_FOLDER } from './voiceLines';

export interface AnswerResult {
  given: number;
  correct: boolean;
  /** From the buttons unlocking to the tap. 0 when the picture stayed on screen. */
  thinkingMs: number;
  /** The picture stayed on screen with help (after a struggle), so it doesn't count towards a stage. */
  helped: boolean;
  /** "Keep the picture on the screen" was on: practice only, so it doesn't count towards a stage either. */
  guided: boolean;
  peeked: boolean;
}

interface Props {
  total: number;
  /** Pictures never flash: they stay until the student answers. The answers are practice only (`guided` on each). */
  guidedMode: boolean;
  /** The starting check: no help pictures and no peeking, so the check shows where the student really is. */
  checking?: boolean;
  /** The next picture, made from the student's answers so far. */
  next: (index: number, last: Trial | null) => Trial;
  onAnswer: (trial: Trial, result: AnswerResult) => void;
  onFinish: () => void;
  /** Read the prompts aloud (never the answer before it has been given). Undefined = no read-aloud button at all. */
  readAloud?: { on: boolean; onChange: (on: boolean) => void };
  /** Replaces the question heading while answering (the demo before the starting check). Read aloud like the other prompts. */
  intro?: string;
  /** The starting check can end early: true once its tests are decided. Then the last button says "Finish". */
  over?: () => boolean;
}

type Phase = 'ready' | 'show' | 'answer' | 'peek' | 'feedback';

/** The line said after an answer. It names the answer, so it is only used once the student has answered. */
function feedbackText(trial: Trial, result: AnswerResult): string {
  if (trial.activity === 'gap') return gapFeedback(trial.n, trial.answer, FRAME_CAPACITY[trial.type] ?? 0, result.correct);
  return flashFeedback(result.correct, trial.answer, groupSizes(trial.picture));
}

/** A small empty square, beside the Missing Spots question. */
function EmptySquareIcon() {
  return (
    <svg className="sb-empty-icon" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false" style={{ verticalAlign: '-5px', marginLeft: 4 }}>
      <rect x="3" y="3" width="20" height="20" rx="2" fill="#fff3c4" stroke="#1f2a37" strokeWidth="2.5" />
    </svg>
  );
}

/** The question for a picture that is not a help picture or the demo. A review picture says so first. */
function questionPrompt(trial: Trial, guidedMode: boolean): string {
  const gap = trial.activity === 'gap';
  if (trial.review) return gap ? PROMPTS.reviewGap : guidedMode ? PROMPTS.reviewGuided : PROMPTS.reviewFlash;
  return gap ? PROMPTS.gap : guidedMode ? PROMPTS.guided : PROMPTS.flash;
}

export function FlashRunner({ total, guidedMode, checking = false, next, onAnswer, onFinish, readAloud, intro, over }: Props) {
  const [index, setIndex] = useState(0);
  const [trial, setTrial] = useState<Trial>(() => next(0, null));
  const [phase, setPhase] = useState<Phase>(() => (guidedMode ? 'answer' : 'ready'));
  const [locked, setLocked] = useState(!guidedMode);
  const [helped, setHelped] = useState(false);
  const [peekAllowed, setPeekAllowed] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  /** The wrong first answer on this picture, while the student has their one second try. */
  const [tried, setTried] = useState<number | null>(null);

  const unlockedAt = useRef(0);
  const recent = useRef<boolean[]>([]);
  /** When the question stopped being spoken. Infinity while it is being said, so the thinking clock never starts early. */
  const voiceEnd = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const choicesBox = useRef<HTMLDivElement>(null);
  const refocusChoices = useRef(false);

  const staticPicture = helped || guidedMode;

  useEffect(() => {
    if (phase === 'ready') {
      const t = window.setTimeout(() => setPhase('show'), trial.activity === 'gap' ? Math.max(CONFIG.readyMs, CONFIG.gapReadyMs) : CONFIG.readyMs);
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
      const t = window.setTimeout(() => {
        // Thinking time starts again once the peek is over.
        unlockedAt.current = performance.now();
        refocusChoices.current = true;
        setPhase('answer');
      }, CONFIG.peekMs);
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
      if (value === tried) return;
      const correct = value === trial.answer;
      if (tried !== null) {
        // The second try: only the feedback changes. It is not saved and moves nothing.
        setResult({ given: value, correct, thinkingMs: 0, helped, guided: guidedMode, peeked });
        setPhase('feedback');
        return;
      }
      // The thinking clock starts once the question has been spoken (and the buttons have unlocked).
      const thinkingMs = staticPicture ? 0 : Math.max(0, performance.now() - Math.max(unlockedAt.current, voiceEnd.current));
      const r: AnswerResult = { given: value, correct, thinkingMs, helped, guided: guidedMode, peeked };
      if (helped) {
        // A help picture starts again: the next one is judged on its own.
        recent.current = [];
      } else {
        recent.current = [...recent.current, r.correct].slice(-CONFIG.stepBackWindow);
      }
      // Only the first tap is saved, so the records stay honest.
      onAnswer(trial, r);
      if (correct) {
        setResult(r);
        setPhase('feedback');
      } else {
        // One more go: the picture comes back for a moment (or stays, if it is already staying).
        setTried(value);
        if (!staticPicture) setPhase('peek');
      }
    },
    [phase, locked, staticPicture, trial, helped, peeked, guidedMode, onAnswer, tried],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        // The 0 key answers 10.
        const value = e.key === '0' ? 10 : Number(e.key);
        if (trial.choices.includes(value)) choose(value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, trial]);

  // The buttons that were focused have gone: keep focus somewhere useful.
  useEffect(() => {
    if (phase === 'feedback') nextButton.current?.focus({ preventScroll: true });
  }, [phase]);
  useEffect(() => {
    if (phase !== 'answer' || locked || !refocusChoices.current) return;
    refocusChoices.current = false;
    choicesBox.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [phase, locked]);

  // Stop any read-aloud still queued when this screen goes.
  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [index]);

  // Read the words out loud for students who can't read them yet. The answer is only ever said in the
  // feedback line, after the student has answered.
  const reading = readAloud?.on ?? false;
  useEffect(() => {
    if (!reading) return;
    if (phase === 'ready') speak(trial.activity === 'gap' ? PROMPTS.readyGap : PROMPTS.readyFlash, VOICE_FOLDER);
    else if (phase === 'answer') {
      const line = tried !== null ? PROMPTS.retry : (intro ?? (helped ? helpedPrompt(trial.activity, trial.answer) : questionPrompt(trial, guidedMode)));
      voiceEnd.current = Infinity;
      speak(line, VOICE_FOLDER, () => {
        voiceEnd.current = performance.now();
      });
    }
  }, [reading, phase, helped, trial, guidedMode, intro, tried]);
  useEffect(() => {
    if (reading && phase === 'feedback' && result) speak(feedbackText(trial, result), VOICE_FOLDER);
  }, [reading, phase, result, trial]);

  const advance = () => {
    if (index + 1 >= total || over?.()) {
      onFinish();
      return;
    }
    const i = index + 1;
    const struggling = !guidedMode && !checking && isStruggling(recent.current);
    const t = next(i, trial);
    setTrial(t);
    setIndex(i);
    setResult(null);
    setTried(null);
    voiceEnd.current = 0;
    setPeeked(false);
    setHelped(struggling);
    setPeekAllowed(helped && !struggling && !guidedMode && !checking);
    setLocked(!(struggling || guidedMode));
    setPhase(struggling || guidedMode ? 'answer' : 'ready');
  };

  const gap = trial.activity === 'gap';
  const one = !gap && trial.answer === 1;
  const lookBack = trial.review ? 'A look back. ' : '';
  const prompt = gap ? (
    <span>
      {lookBack}How many <strong>empty squares</strong>? <EmptySquareIcon />
    </span>
  ) : (
    `${lookBack}${guidedMode ? 'How many can you see?' : 'How many did you see?'}`
  );
  const showing = phase === 'show' || phase === 'peek' || (phase === 'answer' && staticPicture) || phase === 'feedback';
  const mode = phase === 'feedback' ? (result?.correct ? 'right' : 'help') : helped && phase === 'answer' ? 'help' : 'plain';
  const label =
    phase === 'feedback' ? `The picture again. ${gap ? gapWords(trial.n, trial.answer) : `${trial.answer}`}.` : phase === 'ready' ? (gap ? 'Get ready: how many empty squares?' : 'Get ready: how many dots?') : phase === 'answer' && !staticPicture ? 'The picture has gone' : 'A picture is showing';

  const feedback = result ? feedbackText(trial, result) : '';

  return (
    <section className="sb-screen" aria-label="Quick looks">
      <h1 ref={heading} tabIndex={-1} className="sb-prompt">
        {phase === 'ready' ? (gap ? 'Get ready: how many empty squares?' : 'Get ready: how many dots?') : tried !== null && phase === 'answer' ? PROMPTS.retry : intro && phase === 'answer' ? intro : helped && phase === 'answer' ? helpedPrompt(trial.activity, trial.answer) : prompt}
      </h1>
      <div className="sb-stage">
        <div className="sb-board">
          {showing ? <PictureSvg picture={trial.picture} mode={mode} ghosts={gap && phase === 'feedback'} tintEmpty={gap} label={label} /> : <BlankPicture label={label} />}
        </div>
      </div>
      <div className="sb-live" role="status" aria-live="polite">
        {phase === 'answer' && !staticPicture
          ? gap
            ? 'The picture has gone. How many empty squares?'
            : 'The picture has gone. How many?'
          : phase === 'answer'
            ? `The picture is staying on the screen. ${gap ? 'How many empty squares?' : one ? 'Look carefully. How many?' : 'Look for the groups. How many?'}`
            : phase === 'feedback'
              ? feedback
              : ''}
      </div>

      {phase === 'feedback' ? (
        <>
          <div className="sb-feedback">
            <Friend happy={result?.correct ?? false} />
            <p className={result?.correct ? 'sb-good' : 'sb-calm'}>{feedback}</p>
          </div>
          <button ref={nextButton} type="button" className="sb-btn sb-btn-primary sb-big" onClick={advance}>
            {index + 1 >= total || over?.() ? 'Finish' : 'Next'}
          </button>
        </>
      ) : (
        <>
          <div ref={choicesBox} className="sb-choices" role="group" aria-label="Answers">
            {trial.choices.map((c) => (
              <button key={c} type="button" className={c === tried ? 'sb-choice sb-wobble' : 'sb-choice'} disabled={phase !== 'answer' || locked || c === tried} onClick={() => choose(c)}>
                {c}
              </button>
            ))}
          </div>
          {phase === 'answer' && peekAllowed && !peeked && !staticPicture && tried === null && (
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

      {over ? (
        // The starting check is 9 to 12 pictures: the dots could not say how long it is.
        <p className="sr-only" role="status" aria-live="off">{`Picture ${index + 1}`}</p>
      ) : (
        <div className="sb-progress" role="img" aria-label={`Picture ${index + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < index || (i === index && phase === 'feedback') ? 'on' : ''} />
          ))}
        </div>
      )}
      <div className="sb-row">
        {readAloud && (
          <button type="button" className="sb-btn sb-btn-quiet" aria-pressed={readAloud.on} onClick={() => readAloud.onChange(!readAloud.on)}>
            <span aria-hidden="true">{readAloud.on ? '🔊 ' : '🔇 '}</span>
            {readAloud.on ? 'Reading out loud: on' : 'Reading out loud: off'}
          </button>
        )}
        <button type="button" className="sb-btn sb-btn-quiet" onClick={onFinish}>
          Finish for now
        </button>
      </div>
    </section>
  );
}
