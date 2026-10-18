/**
 * Marble Rush maths on the teacher page (docs/MARBLE-PLAN.md, section 7.3): who gets the questions, and a separate
 * switch for the rescue questions after a fall. Per class, like the other game switches. The server checks both at the
 * start of every run, so nobody can start a maths run while the switch is off.
 */
import { useEffect, useState } from 'react';
import type { MathsSwitch } from '../../shared/space/mathsSwitch';
import { fetchMarbleSwitches, saveMarbleMaths, saveMarbleRescue } from '../data/marble';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from '../teacher/TeacherClass';

const CHOICES: { value: MathsSwitch; label: string; detail: string }[] = [
  { value: 'off', label: 'Off', detail: 'No maths questions in Marble Rush. The gates just show arrows and the shortcut is open for everyone.' },
  { value: 'choose', label: 'Students choose', detail: 'Each student picks maths on or off before they roll.' },
  { value: 'on', label: 'On for everyone', detail: 'Every run has maths questions, with no way to turn them off.' },
];

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function MarbleTeacherPanel() {
  const { classId, ready } = useTeacherClass();
  const [mode, setMode] = useState<MathsSwitch | null>(null);
  const [rescue, setRescue] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setMode(null);
    setStatus(null);
    fetchMarbleSwitches(classId).then(
      (s) => {
        setMode(s.maths);
        setRescue(s.rescue);
      },
      () => setStatus('We couldn’t load this setting.'),
    );
  }, [ready, classId]);

  async function changeMode(next: MathsSwitch) {
    setStatus('Saving…');
    try {
      await saveMarbleMaths(next, classId);
      setMode(next);
      setStatus(`Marble Rush maths: ${CHOICES.find((c) => c.value === next)?.label}.`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  async function changeRescue(next: boolean) {
    setStatus('Saving…');
    try {
      await saveMarbleRescue(next, classId);
      setRescue(next);
      setStatus(`Rescue questions: ${next ? 'On' : 'Off'}.`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel teacher__switch" aria-labelledby="marble-maths-title">
      <h2 id="marble-maths-title" className="panel__title">
        Marble Rush maths
      </h2>
      <p>
        Answer gates, where the right tunnel is the shortcut, and pit stops at checkpoints. The questions follow each student’s maths focus
        (the Maths focus page) and their own records, and what they answer goes into those records. A wrong answer only means a longer way
        round, never a penalty.
      </p>
      {mode !== null && (
        <>
          <fieldset className="level-picker">
            <legend>Who gets the questions</legend>
            <div className="level-picker__options">
              {CHOICES.map((choice) => (
                <label key={choice.value} className="level-picker__option">
                  <input type="radio" name="marble-maths-switch" checked={mode === choice.value} onChange={() => void changeMode(choice.value)} />
                  <span>
                    <strong>{choice.label}:</strong> {choice.detail}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p>
            <strong>Rescue questions:</strong>{' '}
            {mode === 'off'
              ? 'Off (maths is off).'
              : rescue
                ? 'On: after a fall, a right answer takes back the time the fall cost.'
                : 'Off: falls just cost their few seconds, with no question.'}
          </p>
          {mode !== 'off' &&
            (rescue ? (
              <button type="button" className="button button--danger" onClick={() => void changeRescue(false)}>
                Switch rescue questions off
              </button>
            ) : (
              <button type="button" className="button button--primary" onClick={() => void changeRescue(true)}>
                Switch rescue questions on
              </button>
            ))}
        </>
      )}
      {status && (
        <p role="status" className="teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}
