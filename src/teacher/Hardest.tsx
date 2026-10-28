/**
 * The class's hardest questions from every game in one table (docs/TEACHER-VIEW-PLAN.md, section 4.4 and stage 5), on the Maths
 * tab, plus the three hardest for Today. Each game gives its own rows through `teacher.hardest`; this page only merges them.
 */
import { useEffect, useMemo, useState } from 'react';
import { ALL_GAMES } from '../games/registry';
import type { GameDefinition, HardestRow } from '../games/types';
import { useTeacherClass } from './TeacherClass';
import './hardest.css';

export interface MergedRow extends HardestRow {
  game: string;
  gameName: string;
}

export interface MergedHardest {
  rows: MergedRow[];
  /** Games whose rows couldn't be loaded, by name. */
  failed: string[];
}

const shareRight = (r: HardestRow) => (r.attempts > 0 ? r.correct / r.attempts : 1);

/** Hardest first: the lowest share right, then the most often asked. */
export function mergeHardest(parts: { game: GameDefinition; rows: HardestRow[] }[]): MergedRow[] {
  return parts
    .flatMap(({ game, rows }) => rows.map((r) => ({ ...r, game: game.id, gameName: game.name })))
    .sort((a, b) => shareRight(a) - shareRight(b) || b.attempts - a.attempts);
}

/** Every game's hardest questions for the class, merged. Null while loading. */
export function useHardest(classId: string, games: GameDefinition[] = ALL_GAMES): MergedHardest | null {
  const [result, setResult] = useState<MergedHardest | null>(null);
  useEffect(() => {
    let current = true;
    setResult(null);
    const withRows = games.filter((g) => g.teacher?.hardest);
    void Promise.allSettled(withRows.map((g) => g.teacher!.hardest!(classId))).then((settled) => {
      if (!current) return;
      const parts: { game: GameDefinition; rows: HardestRow[] }[] = [];
      const failed: string[] = [];
      settled.forEach((s, i) => {
        if (s.status === 'fulfilled') parts.push({ game: withRows[i], rows: s.value });
        else failed.push(withRows[i].name);
      });
      setResult({ rows: mergeHardest(parts), failed });
    });
    return () => {
      current = false;
    };
  }, [classId, games]);
  return result;
}

export const percentRight = (r: HardestRow) => (r.attempts > 0 ? `${Math.round((100 * r.correct) / r.attempts)}%` : '–');

/** /teacher/:classId/maths/hardest */
export function HardestQuestions({ games }: { games?: GameDefinition[] }) {
  const { classId, current } = useTeacherClass();
  if (!classId) return null;
  return <HardestTable key={classId} classId={classId} className={current?.name ?? 'this class'} games={games} />;
}

function HardestTable({ classId, className, games }: { classId: string; className: string; games?: GameDefinition[] }) {
  const merged = useHardest(classId, games);
  const [game, setGame] = useState('');
  const gamesShown = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of merged?.rows ?? []) seen.set(r.game, r.gameName);
    return [...seen];
  }, [merged]);
  const rows = merged?.rows.filter((r) => !game || r.game === game) ?? [];

  return (
    <section className="panel hardest" aria-labelledby="hardest-title">
      <h2 id="hardest-title" className="panel__title">
        Hardest questions in {className}
      </h2>
      <p>Questions this class most often gets wrong, from every game, hardest first.</p>
      {!merged ? (
        <p className="panel__empty">Loading…</p>
      ) : (
        <>
          {gamesShown.length > 1 && (
            <label className="hardest__filter">
              Game{' '}
              <select value={game} onChange={(e) => setGame(e.target.value)}>
                <option value="">Every game</option>
                {gamesShown.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {merged.rows.length === 0 ? (
            <p className="panel__empty">Not enough answers yet.</p>
          ) : (
            <div className="hardest__scroll" tabIndex={0} role="group" aria-label="Hardest questions">
              <table className="stats-table hardest__table">
                <caption className="sr-only">Hardest questions in {className}</caption>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Game</th>
                    <th scope="col">Topic</th>
                    <th scope="col">Right</th>
                    <th scope="col">Asked</th>
                    <th scope="col">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.game}:${r.topic}:${r.question}:${i}`}>
                      <th scope="row">{r.question}</th>
                      <td>{r.gameName}</td>
                      <td>{r.topic ?? '–'}</td>
                      <td>{percentRight(r)}</td>
                      <td>{r.attempts}</td>
                      <td>{r.students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {merged.failed.length > 0 && (
            <p className="teacher__status" role="status">
              Couldn’t load {merged.failed.join(', ')}. Try again in a moment.
            </p>
          )}
        </>
      )}
    </section>
  );
}
