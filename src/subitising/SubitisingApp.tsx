import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STAGES, SUBITISING_CONFIG as CONFIG } from '../../shared/subitising/config';
import { growth, progressFrom, type SubAnswer } from '../../shared/subitising/engine';
import { finishedInARow } from '../../shared/subitising/saved';
import { placementTrial, startStageFrom } from '../../shared/subitising/placement';
import { buildTrial, type Trial } from '../../shared/subitising/trials';
import { speak, useReadAloud } from '../speech';
import { FlashRunner, type AnswerResult } from './FlashRunner';
import { Garden } from './Garden';
import { GardenScene } from './Scene';
import type { SubState } from './store';
import { PROMPTS, VOICE_FOLDER } from './voiceLines';
import './subitising.css';

type Screen = 'home' | 'demo' | 'check' | 'checked' | 'session' | 'summary';

/** The demo before a new student's first starting check: an easy stage 1 picture (seed 2 makes a line of 3 dots). */
const DEMO_SEED = 2;
const demoTrial = (): Trial => buildTrial(progressFrom([], 1), DEMO_SEED, 0, null, { ...CONFIG, reviewShare: 0 });

/** One answer as the real page will save it (the next step). */
export interface QuickAnswerEvent {
  key: string;
  given: number;
  correct: boolean;
  /** With help after a struggle, or with "keep the picture on the screen" on: saved under the helped key. */
  helped: boolean;
  /** From the buttons unlocking to the tap, in milliseconds (0 when the picture stayed on screen). */
  thinkingMs: number;
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
  const reading = useReadAloud({ defaultOn: true });
  const readAloud = reading.available ? { on: reading.on, onChange: reading.setOn } : undefined;
  const [screen, setScreen] = useState<Screen>('home');
  const [seed, setSeed] = useState(1);
  const [before, setBefore] = useState<ReturnType<typeof progressFrom> | null>(null);
  const [looked, setLooked] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const checkAnswers = useRef<boolean[]>([]);
  /** Pictures looked at this round: a help picture is a second go at the same one, so it isn't counted. */
  const roundPictures = useRef(0);
  const demoAnswered = useRef(false);

  const progress = useMemo(() => progressFrom(state.answers, state.startStage, undefined, state.finished), [state.answers, state.startStage, state.finished]);

  const startSession = () => {
    setSeed(seedFor(today, state.sessionsDone));
    roundPictures.current = 0;
    setBefore(progress);
    setLooked(0);
    setScreen('session');
  };
  const startCheck = () => {
    setSeed(seedFor(today, state.sessionsDone + 500));
    checkAnswers.current = [];
    demoAnswered.current = false;
    // A new student sees how it works first; "Do the starting check again" goes straight to the check.
    setScreen(state.placed ? 'check' : 'demo');
  };

  const nextPractice = useCallback(
    (i: number, last: Trial | null) => buildTrial(progressFrom(stateRef.current.answers, stateRef.current.startStage, undefined, stateRef.current.finished), seed, i, last),
    [seed],
  );
  const nextCheck = useCallback((_i: number, _last: Trial | null) => placementTrial(checkAnswers.current, seed), [seed]);

  const onPracticeAnswer = (trial: Trial, r: AnswerResult) => {
    const at = Date.now();
    // Help pictures and "keep the picture on the screen" are practice only: saved as helped, so no stage moves.
    const helped = r.helped || r.guided;
    const answer: SubAnswer = { key: trial.key, correct: r.correct, at, helped: helped || undefined };
    const answers = [...stateRef.current.answers, answer];
    const finished = Math.max(
      stateRef.current.finished,
      finishedInARow(progressFrom(answers, stateRef.current.startStage, undefined, stateRef.current.finished)),
    ) as SubState['finished'];
    onState({ ...stateRef.current, answers, finished });
    if (!r.helped) roundPictures.current += 1;
    setLooked((n) => n + 1);
    onAnswered?.({ key: trial.key, given: r.given, correct: r.correct, helped, thinkingMs: r.thinkingMs, at, day: today, seed });
  };

  const finishSession = () => {
    if (roundPictures.current >= CONFIG.sessionTrials) onRoundFinished?.(seed);
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

  const guidedSummary = screen === 'summary' && state.guidedMode;
  const readingOn = reading.on;
  useEffect(() => {
    if (guidedSummary && readingOn) speak(PROMPTS.guidedSummary, VOICE_FOLDER);
  }, [guidedSummary, readingOn]);

  const practising = screen === 'demo' || screen === 'check' || screen === 'session';
  const Frame = onBack ? 'div' : 'main';
  return (
    <Frame className={onBack ? 'sb-app sb-app--hub' : 'sb-app'}>
      <GardenScene className={practising ? 'sb-scene--faint sb-scene--nobeds' : 'sb-scene--nobeds'} />
      {screen === 'home' && (
        <>
        <section className="sb-screen">
          <h1>Quick looks</h1>
          <p>A picture flashes. Tap how many you saw. No clock, no score: just you and your garden.</p>
          {gateNote}
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
        <Garden progress={progress} />
        </>
      )}
      {screen === 'demo' && (
        <FlashRunner
          key="demo"
          checking
          total={1}
          guidedMode
          intro={PROMPTS.demo}
          next={demoTrial}
          onAnswer={() => void (demoAnswered.current = true)}
          onFinish={() => setScreen(demoAnswered.current ? 'check' : 'home')}
          readAloud={readAloud}
        />
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
        <>
        <section className="sb-screen">
          <h1>Nice looking!</h1>
          <p>You looked at {looked} {looked === 1 ? 'picture' : 'pictures'} today.</p>
          {guidedSummary && <p className="sb-small">{PROMPTS.guidedSummary}</p>}
          {finishedNow.map((s) => (
            <p key={s.id} className="sb-week">You finished {s.name}!</p>
          ))}
          {grown.filter((s) => !finishedNow.includes(s)).map((s) => (
            <p key={s.id} className="sb-week">{s.name} grew!</p>
          ))}
          {allDone && <p className="sb-small">Every plant is in flower. More pictures are coming soon.</p>}
          {gateNote}
          <button type="button" className="sb-btn sb-btn-primary sb-big" onClick={() => setScreen('home')}>
            Back to my garden
          </button>
        </section>
        <Garden progress={progress} grew={grown.map((s) => s.id)} />
        </>
      )}
    </Frame>
  );
}
