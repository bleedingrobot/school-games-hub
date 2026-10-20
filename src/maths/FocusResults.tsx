/**
 * "How they did": what each student answered while one focus ran (answers, right, and quick), with a class total. A student who did
 * none is listed as "none", not hidden. Results are counted from the day this was added, so a focus that ended before says that
 * instead of showing zeros that look like "did nothing". Loads when opened, and again each time it is opened.
 */
import { useEffect, useState } from 'react';
import { fetchFocusResults, type FocusResults as Results } from '../data/skillMap';
import { FriendlyError } from '../data/profile';
import { day } from './focusText';
import '../pages/skill-map.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function FocusResults({ batch, startsAt, endsAt, running }: { batch: string; startsAt: string; endsAt: string; running: boolean }) {
  const [opened, setOpened] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    let current = true;
    setFailed(null);
    fetchFocusResults(batch)
      .then((r) => current && setResults(r))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [opened, batch]);

  const since = results?.since ?? null;
  const before = since !== null && new Date(endsAt) <= since;
  const partly = since !== null && !before && new Date(startsAt) < since;
  return (
    <details className="focus-history__now focus-results" onToggle={(e) => setOpened((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{running ? 'How they are doing so far' : 'How they did'}</summary>
      {failed ? (
        <p role="alert">{failed}</p>
      ) : !results ? (
        <p role="status">Loading…</p>
      ) : before ? (
        <p>This focus ended before results were counted (from {day(since!.toISOString())}), so there is nothing to show for it.</p>
      ) : results.students.length === 0 ? (
        <p>No students to show.</p>
      ) : (
        <>
          {partly && <p>Results are counted from {day(since!.toISOString())}, so answers before then are not in this table.</p>}
          <table className="stats-table">
            <caption className="sr-only">Answers given on the skills of this focus while it ran</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Answers</th>
                <th scope="col">Right</th>
                <th scope="col">Quick</th>
              </tr>
            </thead>
            <tbody>
              {results.students.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  {s.answers === 0 ? (
                    <td colSpan={3}>none</td>
                  ) : (
                    <>
                      <td>{s.answers}</td>
                      <td>{s.correct}</td>
                      <td>{s.quick}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Class total</th>
                <td>{results.total.answers}</td>
                <td>{results.total.correct}</td>
                <td>{results.total.quick}</td>
              </tr>
            </tfoot>
          </table>
          <p className="class-panel__hint">“Quick” is a right answer given fast enough to count as known by heart.</p>
        </>
      )}
    </details>
  );
}
