/**
 * Kingdom Keeper on the teacher page (docs/KINGDOM-PLAN.md, section 7): the game's on/off switch for the class. The maths
 * each adviser asks follows each pupil's focus, set on the shared Set focus page. The server checks the switch on every
 * request, so nobody can play while it is off.
 */
import { useEffect, useState } from 'react';
import { COUNCIL_SIZE, POINT_REIGNS_PER_DAY, POINTS, YEARS } from '../../shared/kingdom/config';
import { fetchKingdomEnabled, saveKingdomEnabled } from '../data/kingdom';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from '../teacher/TeacherClass';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function KingdomTeacherPanel() {
  const { classId, ready } = useTeacherClass();
  const [on, setOn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setOn(null);
    setStatus(null);
    fetchKingdomEnabled(classId).then(setOn, () => setStatus('We couldn’t load this setting.'));
  }, [ready, classId]);

  async function change(next: boolean) {
    setStatus('Saving…');
    try {
      await saveKingdomEnabled(next, classId);
      setOn(next);
      setStatus(`Kingdom Keeper: ${next ? 'On' : 'Off'}.`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  const most = POINTS.finish + POINTS.good + POINTS.legendary;
  return (
    <section className="panel teacher__switch" aria-labelledby="kingdom-teacher-title">
      <h2 id="kingdom-teacher-title" className="panel__title">
        Kingdom Keeper
      </h2>
      <p>
        Pupils rule the city of Riverstone for {YEARS} years, deciding each year how much land to buy or sell, how much grain to feed the
        people and how many acres to plant (the classic game Hamurabi). Each year {COUNCIL_SIZE} advisers ask a maths question from the
        pupil’s own focus; a right answer wins a boon for the year, and a wrong one just doesn’t. Nobody is ranked.
      </p>
      <p>
        Points: {POINTS.finish} for ruling all {YEARS} years ({most} for a Legendary reign), {POINTS.early} for a reign that ends early, from
        each pupil’s first {POINT_REIGNS_PER_DAY} reigns a day, inside the daily points cap.
      </p>
      {on !== null && (
        <p>
          <strong>Kingdom Keeper:</strong> {on ? 'On for this class.' : 'Off for this class (pupils don’t see it).'}{' '}
          {on ? (
            <button type="button" className="button button--danger" onClick={() => void change(false)}>
              Switch Kingdom Keeper off
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => void change(true)}>
              Switch Kingdom Keeper on
            </button>
          )}
        </p>
      )}
      {status && (
        <p role="status" className="teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}
