/**
 * Archery Challenge on the teacher page (docs/ARCHERY-PLAN.md, section 7, Stage 7): the game's on/off switch for the
 * class, the Classmate fights switch beside it (on to start: James, 22 Oct 2026), and a small summary of the class's
 * week (counts only). Per class, like the other game switches. The server checks both switches on every request, so
 * nobody can play while the game is off, or fight a classmate while classmate fights are.
 */
import { useEffect, useState } from 'react';
import { DUEL_POINTS, DUEL_WIN_POINTS, FIGHT_POINTS, ROUND_POINTS, WIN_POINTS } from '../../shared/archery/points';
import { POINT_AT } from '../../shared/archery/speed';
import {
  fetchArcheryDuels, fetchArcheryEnabled, fetchArcherySummary, saveArcheryDuels, saveArcheryEnabled, type ArcherySummary,
} from '../data/archery';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from '../teacher/TeacherClass';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ArcheryTeacherPanel() {
  const { classId, ready } = useTeacherClass();
  const [on, setOn] = useState<boolean | null>(null);
  const [duels, setDuels] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<ArcherySummary | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setOn(null);
    setDuels(null);
    setSummary(null);
    setStatus(null);
    fetchArcheryEnabled(classId).then(setOn, () => setStatus('We couldn’t load this setting.'));
    fetchArcheryDuels(classId).then(setDuels, () => setStatus('We couldn’t load this setting.'));
    // The summary is a bonus: if it can't be read, the switches still work.
    fetchArcherySummary(classId).then(setSummary, () => setSummary(null));
  }, [ready, classId]);

  async function changeOn(next: boolean) {
    setStatus('Saving…');
    try {
      await saveArcheryEnabled(next, classId);
      setOn(next);
      setStatus(`Archery Challenge: ${next ? 'On' : 'Off'}.`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  async function changeDuels(next: boolean) {
    setStatus('Saving…');
    try {
      await saveArcheryDuels(next, classId);
      setDuels(next);
      setStatus(`Classmate fights: ${next ? 'On' : 'Off'}.`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel teacher__switch" aria-labelledby="archery-teacher-title">
      <h2 id="archery-teacher-title" className="panel__title">
        Archery Challenge
      </h2>
      <p>
        Two archers on hills take turns aiming (angle and power, with wind) and shooting over-the-top arrows. Coins come only from maths speed
        rounds, which follow each pupil’s maths focus, and buy arrows, shields and bows in the Armory. There’s no aiming help: pupils try
        and adjust. A New Season wipes everyone’s coins and gear.
      </p>
      <p>
        Points: finishing a bot fight {FIGHT_POINTS} ({WIN_POINTS} for a win), finishing a fight against a classmate {DUEL_POINTS} (
        {DUEL_WIN_POINTS} for a win), and {ROUND_POINTS} for {POINT_AT} or more right in a speed round, all inside the daily points cap.
      </p>
      {on !== null && (
        <p>
          <strong>Archery Challenge:</strong> {on ? 'On for this class.' : 'Off for this class (pupils don’t see it).'}{' '}
          {on ? (
            <button type="button" className="button button--danger" onClick={() => void changeOn(false)}>
              Switch Archery Challenge off
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => void changeOn(true)}>
              Switch Archery Challenge on
            </button>
          )}
        </p>
      )}
      {duels !== null && (
        <>
          <h3>Classmate fights</h3>
          <p>
            Pupils can challenge someone in their own class who has the game open, for a one-round fight, one turn each, through the school’s
            server. A fight someone leaves gives nobody points. Switching this off stops any fights being played (everyone gets their unused
            arrows back) and leaves fights against the bots.
          </p>
          <p>
            <strong>Classmate fights:</strong>{' '}
            {duels ? 'On for this class.' : 'Off for this class.'}
            {on === false && ' This only matters while Archery Challenge is on.'}{' '}
            {duels ? (
              <button type="button" className="button button--danger" onClick={() => void changeDuels(false)}>
                Switch classmate fights off
              </button>
            ) : (
              <button type="button" className="button button--primary" onClick={() => void changeDuels(true)}>
                Switch classmate fights on
              </button>
            )}
          </p>
        </>
      )}
      {summary && (
        <>
          <h3>This week</h3>
          <ul aria-label="Archery Challenge this week">
            <li>
              {summary.played} of {plural(summary.pupils, 'pupil')} played in the last 7 days.
            </li>
            <li>
              {plural(summary.botFights, 'fight')} against the bots and {plural(summary.duels, 'fight')} between classmates finished.
            </li>
            <li>{plural(summary.rounds, 'speed round')} in the last day.</li>
          </ul>
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
