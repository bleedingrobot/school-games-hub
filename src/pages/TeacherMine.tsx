/**
 * Mine Runner on the teacher page: the game's on/off switch for the class, and (docs/MINE-PLAN.md, section 7) who gets the
 * questions at the question doors and power-up pads. Per class, like the other game switches. The server checks both at
 * the start of every run, so nobody can start a dive while the game is off, or a maths dive while maths is off.
 */
import { useEffect, useState } from 'react';
import type { MathsSwitch } from '../../shared/space/mathsSwitch';
import { fetchMineEnabled, fetchMineMaths, saveMineEnabled, saveMineMaths } from '../data/mine';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from '../teacher/TeacherClass';

const CHOICES: { value: MathsSwitch; label: string; detail: string }[] = [
  { value: 'off', label: 'Off', detail: 'No maths questions in Mine Runner. The question doors are open and the power-up pads do nothing. Times go on separate “without maths” boards.' },
  { value: 'choose', label: 'Students choose', detail: 'Each student picks maths on or off before they fly. Times with and without maths have separate boards.' },
  { value: 'on', label: 'On for everyone', detail: 'Every dive has maths questions, with no way to turn them off.' },
];

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function MineTeacherPanel() {
  const { classId, ready } = useTeacherClass();
  const [mode, setMode] = useState<MathsSwitch | null>(null);
  const [on, setOn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setMode(null);
    setOn(null);
    setStatus(null);
    fetchMineMaths(classId).then(setMode, () => setStatus('We couldn’t load this setting.'));
    fetchMineEnabled(classId).then(setOn, () => setStatus('We couldn’t load this setting.'));
  }, [ready, classId]);

  async function changeOn(next: boolean) {
    setStatus('Saving…');
    try {
      await saveMineEnabled(next, classId);
      setOn(next);
      setStatus(`Mine Runner: ${next ? 'On' : 'Off'}.`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  async function change(next: MathsSwitch) {
    setStatus('Saving…');
    try {
      await saveMineMaths(next, classId);
      setMode(next);
      setStatus(`Mine Runner maths: ${CHOICES.find((c) => c.value === next)?.label}.`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel teacher__switch" aria-labelledby="mine-maths-title">
      <h2 id="mine-maths-title" className="panel__title">
        Mine Runner
      </h2>
      <p>
        Fly a ship through twisting mines, find keys, blow up the reactor and race to the exit. Each pupil’s best times go on a board for
        your school only (display names and avatars, nothing else). Finishing a mine for the first time earns 2 points, and beating your own
        best earns 1 point once a day for each mine.
      </p>
      {on !== null && (
        <p>
          <strong>Mine Runner:</strong> {on ? 'On for this class.' : 'Off for this class (pupils don’t see it).'}{' '}
          {on ? (
            <button type="button" className="button button--danger" onClick={() => void changeOn(false)}>
              Switch Mine Runner off
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => void changeOn(true)}>
              Switch Mine Runner on
            </button>
          )}
        </p>
      )}
      <h3>Maths</h3>
      <p>
        Question doors and power-up pads. The questions follow each student’s maths focus (the Maths focus page) and their own records, and
        what they answer goes into those records. A wrong answer at a question door costs a little shield and a few seconds, never the
        whole run. At a pad a wrong answer costs nothing.
      </p>
      {mode !== null && (
        <fieldset className="level-picker">
          <legend>Who gets the questions</legend>
          <div className="level-picker__options">
            {CHOICES.map((choice) => (
              <label key={choice.value} className="level-picker__option">
                <input type="radio" name="mine-maths-switch" checked={mode === choice.value} onChange={() => void change(choice.value)} />
                <span>
                  <strong>{choice.label}:</strong> {choice.detail}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {status && (
        <p role="status" className="teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}
