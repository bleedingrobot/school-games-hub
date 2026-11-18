/**
 * "How they did": what each student (game name and real name) answered while one focus ran (answers, right, and quick), with a class total. A student who did
 * none is listed as "none", not hidden. Results are counted from the day this was added, so a focus that ended before says that
 * instead of showing zeros that look like "did nothing". Loads when opened, and again each time it is opened.
 */
import { useEffect, useState } from 'react';
import { fetchFocusResults, type FocusResults as Results } from '../data/skillMap';
import { FriendlyError } from '../data/profile';
import { day } from './focusText';
import { HELP_BELOW, HELP_MIN_ANSWERS, needsHelp, percent, studentsNeedingHelp } from './focusHelp';
import '../pages/skill-map.css';

/** "80%" with the plain count under it, or a dash when nothing was answered. */
function Share({ part, whole }: { part: number; whole: number }) {
  const p = percent(part, whole);
  if (p === null) return <>–</>;
  return (
    <>
      {p}%<span className="focus-results__count">{part}</span>
    </>
  );
}

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
  const stuck = results ? studentsNeedingHelp(results.students) : [];
  const notStarted = results ? results.students.filter((s) => s.answers === 0) : [];
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
          <div className={`focus-results__help${stuck.length ? ' focus-results__help--some' : ''}`}>
            <h4>Needs help</h4>
            {stuck.length === 0 ? (
              <p>Nobody is clearly stuck{running ? ' so far' : ''}.</p>
            ) : (
              <ul>
                {stuck.map((s) => (
                  <li key={s.id}>
                    <strong>{s.name}</strong>
                    {s.realName && <span className="skill-map__real focus-results__real">{s.realName}</span>} —{' '}
                    {percent(s.correct, s.answers)}% right ({s.correct} of {s.answers})
                  </li>
                ))}
              </ul>
            )}
            {notStarted.length > 0 && (
              <p>
                <strong>Not started:</strong> {notStarted.map((s) => s.realName ?? s.name).join(', ')}
              </p>
            )}
            <p className="class-panel__hint">
              Flagged when fewer than {Math.round(HELP_BELOW * 100)}% are right after at least {HELP_MIN_ANSWERS} answers.
            </p>
          </div>
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
                <tr key={s.id} className={needsHelp(s) ? 'focus-results__stuck' : undefined}>
                  <th scope="row">
                    {s.name}
                    {s.realName && <span className="skill-map__real focus-results__real">{s.realName}</span>}
                  </th>
                  {s.answers === 0 ? (
                    <td colSpan={3}>none</td>
                  ) : (
                    <>
                      <td>{s.answers}</td>
                      <td>
                        <Share part={s.correct} whole={s.answers} />
                      </td>
                      <td>
                        <Share part={s.quick} whole={s.answers} />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Class total</th>
                <td>{results.total.answers}</td>
                <td>
                  <Share part={results.total.correct} whole={results.total.answers} />
                </td>
                <td>
                  <Share part={results.total.quick} whole={results.total.answers} />
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="class-panel__hint">
            Percentages are out of all their answers; the small number is the count. “Quick” is a right answer given fast enough to count as
            known by heart. Rows in red need help.
          </p>
        </>
      )}
    </details>
  );
}
