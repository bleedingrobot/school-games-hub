/**
 * Basic facts training in the hub: the same screens as the preview (src/training/), with the
 * student's records saved to the database. Only students; signed in is already checked by the router.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { dayString, type TrainingState } from '../../shared/training/records';
import type { AnswerEvent } from '../../shared/training/save';
import { useAuth } from '../auth/AuthContext';
import { addAnswer, enqueueStudent, flushQueue, loadTraining } from '../data/training';
import { TrainingApp } from '../training/TrainingApp';

/** Send what's waiting after this many answers, as well as at the end of a session and on leaving. */
const FLUSH_EVERY = 8;

export default function TrainingPage() {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role !== 'student') {
    return (
      <div className="page">
        <p>Training is for students. Teachers see each student’s training on their page, soon.</p>
        <Link to="/">Back to the hub</Link>
      </div>
    );
  }
  return <StudentTraining player={profile.id} />;
}

function StudentTraining({ player }: { player: string }) {
  const [loaded, setLoaded] = useState<{ state: TrainingState; offline: boolean } | null>(null);
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
  return <Loaded player={player} start={loaded.state} offline={loaded.offline} />;
}

function Loaded({ player, start, offline }: { player: string; start: TrainingState; offline: boolean }) {
  const [state, setState] = useState(start);
  const stateRef = useRef(start);
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

  const onState = (next: TrainingState) => {
    const before = stateRef.current;
    stateRef.current = next;
    setState(next);
    // Typing check times, the auto-submit choice and the sessions count are saved when they change.
    if (next.typing !== before.typing || next.autoSubmit !== before.autoSubmit || next.sessionsDone !== before.sessionsDone) {
      enqueueStudent(player, { type: 'student', typing: next.typing, autoSubmit: next.autoSubmit, sessionsDone: next.sessionsDone });
      if (next.sessionsDone !== before.sessionsDone) flush();
    }
  };

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
      <TrainingApp state={state} onState={onState} today={today} onAnswered={onAnswered} />
    </>
  );
}
