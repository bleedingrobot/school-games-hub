/**
 * The Teacher page's switch for Training before games (James, 22 Oct 2026), per class, off to start. With it on, a student in
 * the class does one Training session before the games open, and they stay open for 6 hours. Teachers are never locked.
 */
import { useEffect, useState } from 'react';
import { TRAINING_CONFIG } from '../../shared/training/config';
import { FriendlyError } from '../data/profile';
import { fetchTrainingFirst, saveTrainingFirst } from '../data/trainingGate';
import { useTeacherClass } from '../teacher/TeacherClass';

export function TrainingFirstSwitch() {
  const { classId, ready } = useTeacherClass();
  const [on, setOn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setOn(null);
    setStatus(null);
    fetchTrainingFirst(classId).then(setOn, () => setStatus('We couldn’t load this setting.'));
  }, [ready, classId]);

  async function change(next: boolean) {
    setStatus('Saving…');
    try {
      await saveTrainingFirst(next, classId);
      setOn(next);
      setStatus(`Training before games: ${next ? 'On' : 'Off'}.`);
    } catch (error) {
      setStatus(error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const hours = TRAINING_CONFIG.gate.gamesOpenHours;
  return (
    <section className="panel teacher__switch" aria-labelledby="training-first-title">
      <h2 id="training-first-title" className="panel__title">
        Training before games
      </h2>
      <p>
        Students do one Basic facts training session before any game opens: a whole “Today’s session” or a whole round of Quick looks,
        whichever they like. The games then stay open for {hours} hours. A game a student already has open carries on when the time runs out;
        only starting a new one waits for the next session. Teachers are never asked.
      </p>
      {on !== null && (
        <p>
          <strong>Training before games:</strong> {on ? 'On for this class.' : 'Off for this class.'}{' '}
          {on ? (
            <button type="button" className="button button--danger" onClick={() => void change(false)}>
              Switch Training before games off
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => void change(true)}>
              Switch Training before games on
            </button>
          )}
        </p>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}
