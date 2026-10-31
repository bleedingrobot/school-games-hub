import { useEffect, useState } from 'react';
import { BOND_SETS } from '../../shared/bond-match/bonds';
import { fetchStudentBondMatch, type StudentBondMatch } from '../data/bondMatch';
import './teacher-bond-match.css';

const SIZES = ['small', 'medium', 'large'] as const;
const SIZE_LETTER = { small: 'S', medium: 'M', large: 'L' } as const;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One line for the student's folded Games row: "5 games, 6 stars", or null before their first game. */
export async function bondMatchSummary(student: string): Promise<string | null> {
  const data = await fetchStudentBondMatch(student);
  if (data.games === 0) return null;
  return `${plural(data.games, 'game')}, ${plural(data.bests.reduce((n, b) => n + b.stars, 0), 'star')}`;
}

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
