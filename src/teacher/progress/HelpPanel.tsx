/**
 * "Help me" on the Progress tab (docs/plans/help-me/PLAN.md H9, James 26 Nov 2026): pupils who opened Help me on a maths
 * question in the last 7 days, how often, how many of those answers were right, and the skills they wanted help with.
 * Helped answers don't tick anything off the ladder, so a pupil who uses help a lot is still being asked those questions.
 */
import { useEffect, useState } from 'react';
import { fetchHelpUses, skillName, type HelpPupil } from '../../data/helpUses';
import '../../pages/teacher-question-skips.css';

export function HelpPanel({ classId, load = fetchHelpUses }: { classId: string; load?: typeof fetchHelpUses }) {
  const [pupils, setPupils] = useState<HelpPupil[] | null>(null);
  const [failed, setFailed] = useState(false);

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

  return (
    <section className="panel qs-teacher help-panel" aria-labelledby="help-uses-title">
      <h2 id="help-uses-title" className="panel__title">
        Help me
        {pupils && <span className="panel__count">last 7 days</span>}
      </h2>
      <p className="qs-teacher__switch-note">
        Pupils who opened Help me on a maths question. Help shows a way to work it out, never the answer, and a helped answer
        doesn’t tick the fact off, so the ladder keeps asking it.
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load this. Please try again later.</p>
      ) : !pupils ? (
        <p className="panel__empty" role="status">Loading…</p>
      ) : pupils.length === 0 ? (
        <p className="panel__empty">Nobody has used Help me in the last 7 days.</p>
      ) : (
        <div className="qs-teacher__scroll">
          <table className="stats-table qs-teacher__table">
            <caption>Most help first</caption>
            <thead>
              <tr>
                <th scope="col">Pupil</th>
                <th scope="col">Helped answers</th>
                <th scope="col">Right after help</th>
                <th scope="col">Mostly on</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    {p.name}
                    <span className="qs-teacher__real">{p.realName}</span>
                  </th>
                  <td>
                    {p.helped}
                    {p.days > 1 && <span className="qs-teacher__share"> ({p.days} days)</span>}
                  </td>
                  <td>
                    {p.right} of {p.helped}
                  </td>
                  <td className="qs-teacher__where">{[...new Set(p.topKeys.map(skillName))].join(', ') || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
