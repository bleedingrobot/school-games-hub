/**
 * "Basic facts check" on the Progress tab (docs/FACTS-CHECK-PLAN.md): the same 24 facts every 4 weeks, in Training, so the
 * teacher can see whether facts are really improving. First check against latest, per pupil and for the class, and the facts
 * the class finds hardest. Teachers see seconds; pupils never do.
 */
import { useEffect, useState } from 'react';
import { CHECK_CONFIG, CHECK_FACTS, type CheckSummary } from '../../../shared/training/check';
import { fetchClassFactsChecks, type CheckPupil } from '../../data/factsCheck';
import '../../pages/teacher-question-skips.css';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const mid = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const one = (n: number) => (Math.round(n * 10) / 10).toString();
const secs = (ms: number | null) => (ms === null ? '–' : `${one(ms / 1000)} s`);
const day = (at: string) => new Date(at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'Pacific/Auckland' });

export interface ClassSummary {
  done: number;
  notDone: number;
  /** Pupils with two or more checks: first against latest. */
  twice: number;
  quickBefore: number;
  quickNow: number;
  rightBefore: number;
  rightNow: number;
  better: number;
  worse: number;
  middleBefore: number | null;
  middleNow: number | null;
  /** From each pupil's latest check: the facts fewest got right, with the share right. */
  hardest: { prompt: string; right: number }[];
}

/** Exported for tests. */
export function classSummary(pupils: readonly CheckPupil[]): ClassSummary {
  const done = pupils.filter((p) => p.checks.length > 0);
  const pairs = done.filter((p) => p.checks.length > 1).map((p) => [p.checks[0], p.checks[p.checks.length - 1]] as [CheckSummary, CheckSummary]);
  const latest = done.map((p) => p.checks[p.checks.length - 1]);
  const hardest = CHECK_FACTS.map((f, i) => ({ prompt: f.prompt, right: latest.length ? latest.filter((c) => (c.marks[i] ?? 0) > 0).length / latest.length : 1 }))
    .sort((a, b) => a.right - b.right)
    .slice(0, 5);
  const middles = (which: 0 | 1) => mid(pairs.map((p) => p[which].middleMs).filter((m): m is number => m !== null));
  return {
    done: done.length,
    notDone: pupils.length - done.length,
    twice: pairs.length,
    quickBefore: avg(pairs.map((p) => p[0].quick)),
    quickNow: avg(pairs.map((p) => p[1].quick)),
    rightBefore: avg(pairs.map((p) => p[0].right)),
    rightNow: avg(pairs.map((p) => p[1].right)),
    better: pairs.filter((p) => p[1].quick > p[0].quick).length,
    worse: pairs.filter((p) => p[1].quick < p[0].quick).length,
    middleBefore: middles(0),
    middleNow: middles(1),
    hardest: latest.length ? hardest : [],
  };
}

const Check = ({ c }: { c: CheckSummary | undefined }) =>
  c ? (
    <>
      {c.right}/{CHECK_FACTS.length} right, <strong>{c.quick}</strong> quick
      <span className="qs-teacher__share"> ({day(c.at)})</span>
    </>
  ) : (
    <>–</>
  );

export function FactsCheckPanel({ classId, load = fetchClassFactsChecks }: { classId: string; load?: typeof fetchClassFactsChecks }) {
  const [pupils, setPupils] = useState<CheckPupil[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    load(classId).then(
      (rows) => current && setPupils(rows),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [classId, load]);

  const s = pupils ? classSummary(pupils) : null;
  const n = CHECK_FACTS.length;
  const shown = pupils?.filter((p) => p.checks.length > 0) ?? [];

  return (
    <section className="panel qs-teacher facts-check-panel" aria-labelledby="facts-check-title">
      <h2 id="facts-check-title" className="panel__title">
        Basic facts check
        {s && <span className="panel__count">{s.done} done</span>}
      </h2>
      <p className="qs-teacher__switch-note">
        The same {n} times-table and division facts every {CHECK_CONFIG.everyDays / 7} weeks, at the start of Training (Year{' '}
        {CHECK_CONFIG.fromYear} and up). Quick means right with under {CHECK_CONFIG.quickMs / 1000} seconds of thinking (typing time taken
        off). Pupils see how many they got right, never the seconds.
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load this. Please try again later.</p>
      ) : !pupils || !s ? (
        <p className="panel__empty" role="status">Loading…</p>
      ) : s.done === 0 ? (
        <p className="panel__empty">Nobody has done the check yet. Pupils get it the next time they open Training.</p>
      ) : (
        <>
          {s.twice > 0 ? (
            <p className="facts-check__headline">
              {s.twice} pupil{s.twice === 1 ? '' : 's'} with two or more checks: quick facts {one(s.quickBefore)} → <strong>{one(s.quickNow)}</strong> of {n} on
              average, right {one(s.rightBefore)} → {one(s.rightNow)}. {s.better} have more quick facts, {s.worse} fewer. Usual thinking time{' '}
              {secs(s.middleBefore)} → {secs(s.middleNow)}.
            </p>
          ) : (
            <p className="facts-check__headline">Only first checks so far: the next ones show the change, from the week of 30 November.</p>
          )}
          {s.hardest.length > 0 && (
            <p className="qs-teacher__key">
              Hardest in the latest checks: {s.hardest.map((h) => `${h.prompt} (${Math.round(h.right * 100)}% right)`).join(', ')}.
            </p>
          )}
          <div className="qs-teacher__scroll">
            <table className="stats-table qs-teacher__table">
              <caption>First check and latest, per pupil</caption>
              <thead>
                <tr>
                  <th scope="col">Pupil</th>
                  <th scope="col">First check</th>
                  <th scope="col">Latest</th>
                  <th scope="col">Quick facts</th>
                  <th scope="col">Usual thinking time</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const first = p.checks[0];
                  const last = p.checks.length > 1 ? p.checks[p.checks.length - 1] : undefined;
                  const change = last ? last.quick - first.quick : null;
                  return (
                    <tr key={p.id}>
                      <th scope="row">
                        {p.name}
                        <span className="qs-teacher__real">{p.realName}</span>
                      </th>
                      <td><Check c={first} /></td>
                      <td><Check c={last} /></td>
                      <td>{change === null ? '–' : change > 0 ? `+${change}` : `${change}`}</td>
                      <td>
                        {secs(first.middleMs)}
                        {last && <> → {secs(last.middleMs)}</>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {s.notDone > 0 && (
            <p className="qs-teacher__key">
              Not done yet: {s.notDone} pupil{s.notDone === 1 ? '' : 's'} (they get it when they next open Training; Years 0 to {CHECK_CONFIG.fromYear - 1} aren’t asked).
            </p>
          )}
        </>
      )}
    </section>
  );
}
