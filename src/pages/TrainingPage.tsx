/**
 * Basic facts training in the hub: the same screens as the preview (src/training/), with the
 * student's records saved to the database. Students and teachers (teachers have their own practice records); signed in is already checked by the router.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SUBITISING_CONFIG } from '../../shared/subitising/config';
import { dayString, type TrainingState } from '../../shared/training/records';
import type { AnswerEvent } from '../../shared/training/save';
import { useAuth } from '../auth/AuthContext';
import { addAnswer, enqueueStudent, flushQueue, loadTraining, type QuickLoad } from '../data/training';
import type { QuickAnswerEvent } from '../subitising/SubitisingApp';
import { settingsOf, toTrainingAnswer } from '../subitising/saving';
import { emptySubState, type SubState } from '../subitising/store';
import { TrainingApp } from '../training/TrainingApp';

/** Send what's waiting after this many answers, as well as at the end of a session and on leaving. */
const FLUSH_EVERY = 8;

export default function TrainingPage() {
  const { profile } = useAuth();
  if (!profile) return null;
  return <StudentTraining player={profile.id} />;
}

function StudentTraining({ player }: { player: string }) {
  const [loaded, setLoaded] = useState<{ state: TrainingState; offline: boolean; quick?: QuickLoad } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    loadTraining(player)
      .then((result) => current && setLoaded(result))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [player]);

  if (failed) return <p role="alert" className="panel__empty">We couldn’t open Training just now. Please try again in a moment.</p>;
  if (!loaded) {
    return (
      <div className="loading" role="status">
        Getting your facts ready…
      </div>
    );
  }
  return <Loaded player={player} start={loaded.state} offline={loaded.offline} quickStart={loaded.quick} />;
}

/** Quick looks as the page keeps it: the saved answers and settings, with the session count worked out from the answers. */
function subStateFrom(quick: QuickLoad | undefined): SubState {
  if (!quick) return emptySubState();
  const q = quick.settings;
  return {
    ...emptySubState(),
    answers: quick.answers,
    placed: q?.placed ?? false,
    startStage: q?.startStage ?? 1,
    finished: q?.finished ?? 0,
    guidedMode: q?.guided ?? false,
    sessionsDone: Math.floor(quick.answers.length / SUBITISING_CONFIG.sessionTrials),
  };
}

function Loaded({ player, start, offline, quickStart }: { player: string; start: TrainingState; offline: boolean; quickStart?: QuickLoad }) {
  const [state, setState] = useState(start);
  const stateRef = useRef(start);
  const [quick, setQuick] = useState(() => subStateFrom(quickStart));
  const quickRef = useRef(quick);
  const sinceSend = useRef(0);
  const [today] = useState(() => dayString(new Date()));

  const flush = useCallback((keepalive = false) => void flushQueue(player, keepalive), [player]);

  // Send when the Wi-Fi comes back, and when the student leaves or switches away.
  useEffect(() => {
    const away = () => document.visibilityState === 'hidden' && flush(true);
    const leaving = () => flush(true);
    const online = () => flush();
    document.addEventListener('visibilitychange', away);
    window.addEventListener('pagehide', leaving);
    window.addEventListener('online', online);
    flush();
    return () => {
      document.removeEventListener('visibilitychange', away);
      window.removeEventListener('pagehide', leaving);
      window.removeEventListener('online', online);
      flush(true);
    };
  }, [flush]);

  // Quick looks settings only go with the student once they have used Quick looks (so nothing new is saved for anyone else).
  const [usedQuick, setUsedQuick] = useState(() => !!quickStart?.settings);
  const usedQuickRef = useRef(usedQuick);

  /** The typing times, settings and (once used) Quick looks settings, saved together: the newest replaces the older. */
  const saveStudent = () => {
    const t = stateRef.current;
    const q = quickRef.current;
    enqueueStudent(player, {
      type: 'student',
      typing: t.typing,
      autoSubmit: t.autoSubmit,
      sessionsDone: t.sessionsDone,
      ...(usedQuickRef.current ? { quick: settingsOf(q) } : {}),
    });
  };

  const onState = (next: TrainingState) => {
    const before = stateRef.current;
    stateRef.current = next;
    setState(next);
    // Typing check times, the auto-submit choice and the sessions count are saved when they change.
    if (next.typing !== before.typing || next.autoSubmit !== before.autoSubmit || next.sessionsDone !== before.sessionsDone) {
      saveStudent();
      if (next.sessionsDone !== before.sessionsDone) flush();
    }
  };

  const onQuickState = (next: SubState) => {
    const before = quickRef.current;
    quickRef.current = next;
    setQuick(next);
    if (next.placed !== before.placed || next.startStage !== before.startStage || next.finished !== before.finished || next.guidedMode !== before.guidedMode) {
      usedQuickRef.current = true;
      setUsedQuick(true);
      saveStudent();
    }
  };

  const onQuickAnswered = (a: QuickAnswerEvent) => onAnswered(toTrainingAnswer(a));

  const onAnswered = (answer: AnswerEvent) => {
    addAnswer(player, answer);
    if (++sinceSend.current >= FLUSH_EVERY) {
      sinceSend.current = 0;
      flush();
    }
  };

  return (
    <>
      {offline && (
        <p className="tr-note" role="status">
          We can’t reach the internet right now. You can still practise: your answers will be saved when it’s back.
        </p>
      )}
      <TrainingApp
        state={state}
        onState={onState}
        today={today}
        onAnswered={onAnswered}
        quick={{ state: quick, onState: onQuickState, onAnswered: onQuickAnswered, onSessionEnd: () => flush() }}
      />
    </>
  );
}
