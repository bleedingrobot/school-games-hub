import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { STAGES, SUBITISING_CONFIG as CONFIG } from '../../shared/subitising/config';
import { growth, progressFrom, type SubAnswer } from '../../shared/subitising/engine';
import { finishedInARow } from '../../shared/subitising/saved';
import { placementTrial, startStageFrom } from '../../shared/subitising/placement';
import { buildTrial, type Trial } from '../../shared/subitising/trials';
import { useReadAloud } from '../speech';
import { FlashRunner, type AnswerResult } from './FlashRunner';
import { Garden } from './Garden';
import type { SubState } from './store';
import './subitising.css';

type Screen = 'home' | 'check' | 'checked' | 'session' | 'summary';

/** One answer as the real page will save it (the next step). */
export interface QuickAnswerEvent {
  key: string;
  given: number;
  correct: boolean;
  helped: boolean;
  /** Milliseconds since 1970 and the student's own date, "YYYY-MM-DD". */
  at: number;
  day: string;
  seed: number;
}

interface Props {
  state: SubState;
  onState: (state: SubState) => void;
  today: string;
  onAnswered?: (answer: QuickAnswerEvent) => void;
  /** Extra buttons only the preview shows. */
  tools?: ReactNode;
  /** In Training: a way back to the Training home. Also means the hub's own page frame is around this (no second main area, no full-height box). */
  onBack?: () => void;
  /** Called when a session or the starting check ends, so the real page can save at once. */
  onSessionEnd?: () => void;
  /** Called (before onSessionEnd) when a whole round of pictures was done, not stopped early: it counts for Training before games. */
  onRoundFinished?: (seed: number) => void;
  /** Shown on the home and end-of-round screens: whether the games are open (Training before games). */
  gateNote?: ReactNode;
}

const seedFor = (today: string, n: number): number => {
  let h = 29;
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) % 1_000_003;
  return h * 37 + n * 101 + 7;
};

export function SubitisingApp({ state, onState, today, onAnswered, tools, onBack, onSessionEnd, onRoundFinished, gateNote }: Props) {
  const reading = useReadAloud();
  const readAloud = reading.available ? { on: reading.on, onChange: reading.setOn } : undefined;
  const [screen, setScreen] = useState<Screen>('home');
  const [seed, setSeed] = useState(1);
  const [before, setBefore] = useState<ReturnType<typeof progressFrom> | null>(null);
  const [looked, setLooked] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionAnswers = useRef<SubAnswer[]>([]);
  const checkAnswers = useRef<boolean[]>([]);

  const progress = useMemo(() => progressFrom(state.answers, state.startStage, undefined, state.finished), [state.answers, state.startStage, state.finished]);

  const startSession = () => {
    setSeed(seedFor(today, state.sessionsDone));
    sessionAnswers.current = [];
    setBefore(progress);
    setLooked(0);
    setScreen('session');
  };
  const startCheck = () => {
    setSeed(seedFor(today, state.sessionsDone + 500));
    checkAnswers.current = [];
    setScreen('check');
  };

  const nextPractice = useCallback(
    (i: number, last: Trial | null) => buildTrial(progressFrom(stateRef.current.answers, stateRef.current.startStage, undefined, stateRef.current.finished), seed, i, last),
    [seed],
  );
  const nextCheck = useCallback((_i: number, _last: Trial | null) => placementTrial(checkAnswers.current, seed), [seed]);

  const onPracticeAnswer = (trial: Trial, r: AnswerResult) => {
    const at = Date.now();
    const answer: SubAnswer = { key: trial.key, correct: r.correct, at, helped: r.helped || undefined };
    sessionAnswers.current.push(answer);
    const answers = [...stateRef.current.answers, answer];
    const finished = Math.max(
      stateRef.current.finished,
      finishedInARow(progressFrom(answers, stateRef.current.startStage, undefined, stateRef.current.finished)),
    ) as SubState['finished'];
    onState({ ...stateRef.current, answers, finished });
    setLooked((n) => n + 1);
    onAnswered?.({ key: trial.key, given: r.given, correct: r.correct, helped: r.helped, at, day: today, seed });
  };

  const finishSession = () => {
    // A helped answer is a second go at the same picture, so the pictures looked at are the answers without help.
    if (sessionAnswers.current.filter((a) => !a.helped).length >= CONFIG.sessionTrials) onRoundFinished?.(seed);
    onState({ ...stateRef.current, sessionsDone: stateRef.current.sessionsDone + 1 });
    onSessionEnd?.();
    setScreen('summary');
  };

  const finishCheck = () => {
    const start = startStageFrom(checkAnswers.current);
    onState({ ...stateRef.current, placed: true, startStage: start });
    onSessionEnd?.();
    setScreen('checked');
  };

  const grown = before ? STAGES.filter((s) => growth(progress.stages[s.id - 1]) > growth(before.stages[s.id - 1])) : [];
  const finishedNow = before ? STAGES.filter((s) => progress.stages[s.id - 1].finished && !before.stages[s.id - 1].finished) : [];
  const allDone = progress.stages.every((s) => s.finished);

  const Frame = onBack ? 'div' : 'main';
  return (
    <Frame className={onBack ? 'sb-app sb-app--hub' : 'sb-app'}>
      {screen === 'home' && (
        <section className="sb-screen">
          <h1>Quick looks</h1>
          <p>A picture flashes. Tap how many you saw. No clock, no score: just you and your garden.</p>
          {gateNote}
          <Garden progress={progress} />
          {state.placed ? (
            <>
              <button type="button" className="sb-btn sb-btn-primary sb-big" onClick={startSession}>
                Start looking
              </button>
              <button type="button" className="sb-btn sb-btn-quiet" onClick={startCheck}>
                Do the starting check again
              </button>
            </>
          ) : (
            <>
              <p className="sb-small">First, a few quick pictures so we know where to start.</p>
              <button type="button" className="sb-btn sb-btn-primary sb-big" onClick={startCheck}>
                Start with a quick check
              </button>
            </>
          )}
          {reading.available && (
            <label className="sb-toggle">
              <input type="checkbox" checked={reading.on} onChange={(e) => reading.setOn(e.target.checked)} />
              Read the words out loud to me
            </label>
          )}
          <label className="sb-toggle">
            <input type="checkbox" checked={state.guidedMode} onChange={(e) => onState({ ...state, guidedMode: e.target.checked })} />
            Keep the picture on the screen (no flashing)
          </label>
          {onBack && (
            <button type="button" className="sb-btn sb-btn-quiet" onClick={onBack}>
              Back to Training
            </button>
          )}
          {tools}
        </section>
      )}
      {screen === 'check' && <FlashRunner key={`check-${seed}`} checking total={CONFIG.placementTrials} guidedMode={state.guidedMode} next={nextCheck} onAnswer={(_t, r) => void checkAnswers.current.push(r.correct)} onFinish={() => (checkAnswers.current.length ? finishCheck() : setScreen('home'))} readAloud={readAloud} />}
      {screen === 'checked' && (
        <section className="sb-screen">
          <h1>All done!</h1>
          <p>
            You’ll start with <strong>{STAGES[state.startStage - 1].name}</strong>. Pictures get a bit harder as you go.
          </p>
          <button type="button" className="sb-btn sb-btn-primary sb-big" onClick={startSession}>
            Start looking
          </button>
          <button type="button" className="sb-btn" onClick={() => setScreen('home')}>
            Back to my garden
          </button>
        </section>
      )}
      {screen === 'session' && <FlashRunner key={`session-${seed}`} total={CONFIG.sessionTrials} guidedMode={state.guidedMode} next={nextPractice} onAnswer={onPracticeAnswer} onFinish={finishSession} readAloud={readAloud} />}
      {screen === 'summary' && (
        <section className="sb-screen">
          <h1>Nice looking!</h1>
          <p>You looked at {looked} {looked === 1 ? 'picture' : 'pictures'} today.</p>
          {finishedNow.map((s) => (
            <p key={s.id} className="sb-week">You finished {s.name}!</p>
          ))}
          {grown.filter((s) => !finishedNow.includes(s)).map((s) => (
            <p key={s.id} className="sb-week">{s.name} grew!</p>
          ))}
          {allDone && <p className="sb-small">Every plant is in flower. More pictures are coming soon.</p>}
          {gateNote}
          <Garden progress={progress} />
          <button type="button" className="sb-btn sb-btn-primary sb-big" onClick={() => setScreen('home')}>
            Back to my garden
          </button>
        </section>
      )}
    </Frame>
  );
}
