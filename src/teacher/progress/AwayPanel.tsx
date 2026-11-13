/**
 * "Leaving the game" on the Progress tab: pupils who left a game page a lot in the last 7 days (another tab or app in front,
 * or another window clicked; src/data/pageAway.ts). James, 14 Nov 2026 NZ: "It's only going to be a problem if some kids do it
 * a lot", so only those pupils show at first; the rest are a click away. A signal for a quiet look, never proof.
 */
import { useEffect, useState } from 'react';
import { fetchPageAway, isOften, OFTEN_DURING_QUESTION, OFTEN_TIMES, type AwayPupil } from '../../data/pageAway';
import { gameName } from '../../pages/TeacherQuestionSkips';
import '../../pages/teacher-question-skips.css';

/** "40 s", "3 min". Exported for tests. */
export function usualAway(p: Pick<AwayPupil, 'awaySecs' | 'times'>): string {
  if (!p.times) return '–';
  const secs = Math.round(p.awaySecs / p.times);
  return secs < 90 ? `${secs} s` : `${Math.round(secs / 60)} min`;
}

export function AwayPanel({ classId, load = fetchPageAway }: { classId: string; load?: typeof fetchPageAway }) {
  const [pupils, setPupils] = useState<AwayPupil[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [everyone, setEveryone] = useState(false);

  useEffect(() => {
    let current = true;
    load(classId, 7).then(
      (rows) => current && setPupils(rows),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [classId, load]);

  const often = pupils?.filter(isOften) ?? [];
  const shown = everyone ? pupils ?? [] : often;
  const rest = (pupils?.length ?? 0) - often.length;

  return (
    <section className="panel qs-teacher away-panel" aria-labelledby="away-title">
      <h2 id="away-title" className="panel__title">
        Leaving the game
        {pupils && <span className="panel__count">last 7 days</span>}
      </h2>
      <p className="qs-teacher__switch-note">
        Pupils who left a game page a lot: switched to another tab or app, or clicked another window, for 3 seconds to 10
        minutes. It can mean a calculator or a chat, or just a break: a reason for a quiet look, not proof.
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load this. Please try again later.</p>
      ) : !pupils ? (
        <p className="panel__empty" role="status">Loading…</p>
      ) : pupils.length === 0 ? (
        <p className="panel__empty">Nobody has left a game page yet. Counting started on 14 November.</p>
      ) : (
        <>
          {often.length === 0 && !everyone ? (
            <p className="panel__empty">Nobody left a lot. {rest} pupil{rest === 1 ? '' : 's'} left a few times, which is normal.</p>
          ) : (
            <div className="qs-teacher__scroll">
              <table className="stats-table qs-teacher__table">
                <caption>{everyone ? 'Everyone who left (most first)' : 'Left a lot (most first)'}</caption>
                <thead>
                  <tr>
                    <th scope="col">Pupil</th>
                    <th scope="col">Times left</th>
                    <th scope="col">During a question</th>
                    <th scope="col">Usually away</th>
                    <th scope="col">Mostly in</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} data-high={isOften(p) || undefined}>
                      <th scope="row">
                        {p.name}
                        <span className="qs-teacher__real">{p.realName}</span>
                      </th>
                      <td>
                        {p.times}
                        {p.days > 1 && <span className="qs-teacher__share"> ({p.days} days)</span>}
                      </td>
                      <td>
                        {p.duringQuestion}
                        {p.questions > 0 && <span className="qs-teacher__share"> of {p.questions} questions</span>}
                      </td>
                      <td>{usualAway(p)}</td>
                      <td className="qs-teacher__where">{p.topGame ? gameName(p.topGame) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="qs-teacher__key">
            Marked: {OFTEN_TIMES} or more times, or {OFTEN_DURING_QUESTION} or more during a question. Blips under 3 seconds and breaks over
            10 minutes are not counted.{' '}
            {(rest > 0 || everyone) && (
              <button type="button" className="progress__sort" aria-pressed={everyone} onClick={() => setEveryone((e) => !e)}>
                {everyone ? 'Only those who left a lot' : `Show everyone (${pupils.length})`}
              </button>
            )}
          </p>
        </>
      )}
    </section>
  );
}
