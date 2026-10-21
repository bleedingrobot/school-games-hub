import { useState, type ReactNode } from 'react';
import { recordTyping, type TrainingState } from '../../shared/training/records';
import type { AnswerEvent } from '../../shared/training/save';
import type { SessionSummary } from '../../shared/training/summary';
import { greenThisWeek, weekLine } from '../../shared/training/week';
import { SubitisingApp, type QuickAnswerEvent } from '../subitising/SubitisingApp';
import type { SubState } from '../subitising/store';
import { FactsMap } from './FactsMap';
import { SessionRunner } from './SessionRunner';
import { Summary } from './Summary';
import { TypingCheck } from './TypingCheck';
import './training.css';

type Screen = 'home' | 'typing' | 'session' | 'summary' | 'map' | 'quick';

interface Props {
  state: TrainingState;
  onState: (state: TrainingState) => void;
  /** Today's date as "YYYY-MM-DD" (the preview can pretend it's tomorrow). */
  today: string;
  /** Called with each answer so the real page can save it. */
  onAnswered?: (answer: AnswerEvent) => void;
  /** Extra buttons only the preview shows. */
  tools?: ReactNode;
  /** Open straight into Quick looks (the dashboard card does this). Ignored when there is no Quick looks. */
  openQuick?: boolean;
  /** Quick looks (the picture half of Training). Without this there is no Quick looks button. */
  quick?: {
    state: SubState;
    onState: (state: SubState) => void;
    onAnswered: (answer: QuickAnswerEvent) => void;
    onSessionEnd: () => void;
  };
  /** A whole session (or Quick looks round) was finished, with its seed: it counts for Training before games. */
  onSessionFinished?: (kind: 'facts' | 'quick', seed: number) => void;
  /** Shown on the home and end-of-session screens: whether the games are open (Training before games). */
  gateNote?: ReactNode;
}

function seedFor(today: string, n: number): number {
  let h = 17;
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) % 1_000_003;
  return h * 31 + n;
}

export function TrainingApp({ state, onState, today, onAnswered, tools, quick, openQuick, onSessionFinished, gateNote }: Props) {
  const [screen, setScreen] = useState<Screen>(openQuick && quick ? 'quick' : 'home');
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [sessionState, setSessionState] = useState<TrainingState>(state);
  const [seed, setSeed] = useState(1);

  const start = () => {
    setSeed(seedFor(today, state.sessionsDone));
    setScreen('typing');
  };

  // Quick looks has its own page frame (and its own main area), so it is shown instead of this one.
  if (screen === 'quick' && quick) {
    return (
      <SubitisingApp
        state={quick.state}
        onState={quick.onState}
        today={today}
        onAnswered={quick.onAnswered}
        onSessionEnd={quick.onSessionEnd}
        onRoundFinished={(s) => onSessionFinished?.('quick', s)}
        gateNote={gateNote}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <main className="tr-app">
      {screen === 'home' && (
        <section className="tr-screen">
          <h1>Basic facts training</h1>
          <p>A few minutes a day. No clock, no score: just you and your facts.</p>
          <p className="tr-week">{weekLine(greenThisWeek(state.records, today))}</p>
          {gateNote}
          <button type="button" className="tr-btn tr-btn-primary tr-big" onClick={start}>
            Today’s session
          </button>
          {quick && (
            <button type="button" className="tr-btn tr-btn-primary" onClick={() => setScreen('quick')}>
              Quick looks
            </button>
          )}
          <button type="button" className="tr-btn" onClick={() => setScreen('map')}>
            My facts map
          </button>
          <label className="tr-toggle">
            <input type="checkbox" checked={state.autoSubmit} onChange={(e) => onState({ ...state, autoSubmit: e.target.checked })} />
            Send my answer by itself when I’ve typed enough digits
          </label>
          {tools}
        </section>
      )}
      {screen === 'typing' && (
        <TypingCheck
          first={Object.keys(state.typing).length === 0}
          autoSubmit={state.autoSubmit}
          onDone={(samples) => {
            let next = state;
            for (const s of samples) next = recordTyping(next, s.digits, s.ms);
            onState(next);
            setSessionState(next);
            setScreen('session');
          }}
        />
      )}
      {screen === 'session' && (
        <SessionRunner
          state={sessionState}
          today={today}
          seed={seed}
          onState={onState}
          onAnswered={onAnswered}
          onFinish={(finalState, s) => {
            // Before the sessions count goes up (which sends the queue), so the finish goes in the same send.
            onSessionFinished?.('facts', seed);
            const done = { ...finalState, sessionsDone: finalState.sessionsDone + 1 };
            onState(done);
            setSummary(s);
            setScreen('summary');
          }}
        />
      )}
      {screen === 'summary' && summary && (
        <Summary summary={summary} state={state} onHome={() => setScreen('home')} onMap={() => setScreen('map')} note={gateNote} />
      )}
      {screen === 'map' && <FactsMap state={state} today={today} onBack={() => setScreen('home')} />}
    </main>
  );
}
