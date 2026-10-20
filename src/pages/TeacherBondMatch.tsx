import { useEffect, useState } from 'react';
import { BOND_SETS } from '../../shared/bond-match/bonds';
import { fetchBondMatchEnabled, fetchStudentBondMatch, saveBondMatchEnabled, type StudentBondMatch } from '../data/bondMatch';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from '../teacher/TeacherClass';
import './teacher-bond-match.css';

const SIZES = ['small', 'medium', 'large'] as const;
const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

/** Bond Match on the teacher page: the switch for the picked class. */
export function BondMatchTeacherPanels() {
  const { classId, ready } = useTeacherClass();
  const [on, setOn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let current = true;
    setOn(null);
    setStatus(null);
    fetchBondMatchEnabled(classId)
      .then((v) => current && setOn(v))
      .catch((error) => current && setStatus(errorText(error)));
    return () => {
      current = false;
    };
  }, [ready, classId]);

  async function change(next: boolean) {
    const before = on;
    setOn(next);
    setStatus('Saving…');
    try {
      await saveBondMatchEnabled(next, classId);
      setStatus(next ? 'Bond Match is on.' : 'Bond Match is off.');
    } catch (error) {
      setOn(before);
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="bm-settings-title">
      <h2 id="bm-settings-title" className="panel__title">
        Bond Match
      </h2>
      <p>
        A memory card game where two cards match when they make a number together (to 10, 100, 1, and more). Alone, with a
        partner on one Chromebook, or against the computer. Switched off, it is hidden from students and nothing is saved.
      </p>
      {on !== null && (
        <>
          <p>{on ? 'On: students can play it from the dashboard.' : 'Off: students can’t see it yet.'}</p>
          {on ? (
            <button type="button" className="button button--danger" onClick={() => void change(false)}>
              Switch Bond Match off
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => void change(true)}>
              Switch Bond Match on
            </button>
          )}
        </>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}
const SIZE_LETTER = { small: 'S', medium: 'M', large: 'L' } as const;

/**
 * A student's Bond Match stars, per bond set and board size. Shows nothing at all until the student has played
 * a game (so nothing appears on the teacher page while Bond Match is switched off), and nothing if it can't load.
 */
export function BondMatchStudentPanel({ student }: { student: string }) {
  const [data, setData] = useState<StudentBondMatch | null>(null);

  useEffect(() => {
    let current = true;
    fetchStudentBondMatch(student)
      .then((d) => current && setData(d))
      .catch(() => current && setData(null));
    return () => {
      current = false;
    };
  }, [student]);

  if (!data || data.games === 0) return null;
  const rows = BOND_SETS.map((set) => ({ set, mine: data.bests.filter((b) => b.bondId === set.id) })).filter((r) => r.mine.length > 0);
  const stars = data.bests.reduce((n, b) => n + b.stars, 0);
  return (
    <div className="bmt">
      <h3 className="bmt__heading">
        Bond Match: {data.games} game{data.games === 1 ? '' : 's'} played, {stars} star{stars === 1 ? '' : 's'} across {data.bests.length} board{data.bests.length === 1 ? '' : 's'}
      </h3>
      <ul className="bmt__list" aria-label="Bond Match stars">
        {rows.map(({ set, mine }) => (
          <li key={set.id}>
            <span className="bmt__name">{set.label}</span>
            <span className="bmt__sizes">
              {SIZES.map((size) => {
                const best = mine.find((b) => b.size === size);
                return (
                  <span key={size} aria-label={`${size} ${best ? `${best.stars} stars, ${best.flips} flips` : 'not played'}`}>
                    {SIZE_LETTER[size]} {best ? '★'.repeat(best.stars) : '–'}
                  </span>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
