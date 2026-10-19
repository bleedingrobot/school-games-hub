/**
 * "What we practised": every focus that has ended for a class (nothing is ever deleted), the last 10 weeks by default, with a switch
 * for all of them. Each one says what was practised, when, who set it, how students did while it ran, and where each student
 * stands on those skills today.
 */
import { useEffect, useState } from 'react';
import { fetchFocusHistory, fetchClassMap, type ClassMap, type HistoryBatch } from '../data/skillMap';
import type { ClassDetail } from '../data/classes';
import { FriendlyError } from '../data/profile';
import { skillList, skillShortLabel } from '../../shared/maths/focus';
import { focusSkills } from '../../shared/maths/ladder';
import { cellFor, LEVELS, studentMap } from '../../shared/maths/skillMap';
import { FocusResults } from './FocusResults';
import { day, whoFor } from './focusText';
import '../pages/skill-map.css';

/** How far back the list goes unless "every earlier focus" is ticked: 10 weeks. */
export const HISTORY_DAYS = 70;

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

/** The students a finished focus was for: the class, a group's members, or the students it named. */
export function studentsOf(batch: Pick<HistoryBatch, 'scope' | 'targets'>, detail: ClassDetail | null): string[] | null {
  if (!detail) return null;
  if (batch.scope === 'class') return detail.members.map((m) => m.id);
  if (batch.scope === 'student') {
    const ids = new Set(batch.targets.map((t) => t.id));
    return detail.members.filter((m) => ids.has(m.id)).map((m) => m.id);
  }
  const groups = new Set(batch.targets.map((t) => t.name));
  return detail.members.filter((m) => m.group !== null && groups.has(m.group)).map((m) => m.id);
}

export function FocusHistory({ classId, detail, now }: { classId: string; detail: ClassDetail | null; now?: Date }) {
  const [all, setAll] = useState(false);
  const [items, setItems] = useState<HistoryBatch[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Worked out once when the panel opens (a new Date on every render would make the list load again and again).
  const [since] = useState(() => new Date((now ?? new Date()).getTime() - HISTORY_DAYS * 86_400_000));

  useEffect(() => {
    let current = true;
    setItems(null);
    setFailed(null);
    fetchFocusHistory(classId, all ? null : since)
      .then((list) => current && setItems(list))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [classId, all, since]);

  return (
    <section className="panel" aria-labelledby="history-title">
      <h2 id="history-title" className="panel__title">
        What we practised
        {items && <span className="panel__count">{items.length}</span>}
      </h2>
      <label className="classes__check">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show every earlier focus, not just the last 10 weeks
      </label>
      {failed ? (
        <p role="alert" className="panel__empty">
          {failed}
        </p>
      ) : items === null ? (
        <p className="panel__empty" role="status">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="panel__empty">{all ? 'No earlier focuses yet.' : 'No focuses have ended in the last 10 weeks.'}</p>
      ) : (
        <ul className="class-panel__list focus-history">
          {items.map((b) => (
            <HistoryItem key={b.batch} batch={b} classId={classId} detail={detail} />
          ))}
        </ul>
      )}
      <p className="class-panel__hint">
        “How they did” counts the answers students gave on a focus’s skills while it ran. “Where they are now” is each student’s record today.
      </p>
    </section>
  );
}

function HistoryItem({ batch, classId, detail }: { batch: HistoryBatch; classId: string; detail: ClassDetail | null }) {
  const [map, setMap] = useState<ClassMap | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!opened || map) return;
    let current = true;
    fetchClassMap(classId)
      .then((m) => current && setMap(m))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [opened, map, classId]);

  const skills = focusSkills({ skills: batch.skills, onlyThese: false });
  const ids = studentsOf(batch, detail);
  const rows = (map?.students ?? []).filter((s) => ids === null || ids.includes(s.id));
  const by = batch.setBy || batch.setByReal;
  return (
    <li>
      <span>
        <strong>{whoFor(batch)}</strong>: {skillList(batch.skills)}
        {batch.onlyThese && ' (only these)'}
        {by && <span className="focus-history__by"> · set by {by}</span>}
      </span>
      <span className="class-panel__when">
        {day(batch.startsAt)} to {day(batch.endsAt)}
      </span>
      <FocusResults batch={batch.batch} startsAt={batch.startsAt} endsAt={batch.endsAt} running={false} />
      <details className="focus-history__now" onToggle={(e) => setOpened((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Where they are now on these skills</summary>
        {failed ? (
          <p role="alert">{failed}</p>
        ) : !map ? (
          <p role="status">Loading…</p>
        ) : rows.length === 0 ? (
          <p>No students to show.</p>
        ) : (
          <table className="stats-table">
            <caption className="sr-only">Where each student is now on the skills of this focus</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                {skills.map((s) => (
                  <th key={s.id} scope="col">
                    {skillShortLabel(s.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const m = studentMap(s.facts, s.ladder, {
                  enabledTables: s.enabledTables,
                  division: s.division,
                });
                return (
                  <tr key={s.id}>
                    <th scope="row">{s.name}</th>
                    {skills.map((skill) => {
                      const level = cellFor(m, skill.id)?.level ?? 'not-started';
                      return (
                        <td key={skill.id}>
                          <span className="skill-map__swatch" data-level={level} aria-hidden="true">
                            {LEVELS[level].mark}
                          </span>{' '}
                          {LEVELS[level].label}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </details>
    </li>
  );
}
