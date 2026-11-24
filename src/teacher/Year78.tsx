/**
 * Maths > Year 7–8 (James, 25 Nov 2026: "a new teacher page that toggles if they appear for kids or not so they only start
 * getting content they have been taught"). One "Taught" switch per Year 7-8 ladder skill for the class, all off to start.
 * A pupil's auto practice only goes past the Year 6 top into skills switched on here (ladder.ts `y78Taught`). A pupil the
 * teacher stopped at Year 6 (Students tab) gets none of them either way. Set focus can still pick any skill.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchLadderTaught, setLadderTaught } from '../data/years';
import { GENERATED } from '../../shared/maths/skillPacks/generated';
import { Y78_GROUPS, Y78_SKILL_KEYS } from '../../shared/maths/skillPacks/y78';
import { useTeacherClass } from './TeacherClass';
import './year78.css';

/** Two of a skill's question types, as examples ("Adding up from below zero (−4 + 9)"). */
const examples = (skill: string) =>
  (Y78_SKILL_KEYS[skill] ?? [])
    .slice(0, 3)
    .map((k) => GENERATED.families[k]?.label)
    .filter(Boolean)
    .join(' · ');

export function Year78Taught() {
  const { classId, ready } = useTeacherClass();
  const [taught, setTaught] = useState<Set<string> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready || !classId) return;
    let current = true;
    setTaught(null);
    setFailed(null);
    fetchLadderTaught(classId).then(
      (t) => current && setTaught(t),
      (e: Error) => current && setFailed(e.message),
    );
    return () => {
      current = false;
    };
  }, [ready, classId]);

  async function change(skills: string[], on: boolean) {
    if (!classId || !taught || saving) return;
    const before = taught;
    const next = new Set(taught);
    for (const s of skills) (on ? next.add(s) : next.delete(s));
    setTaught(next);
    setSaving(true);
    setFailed(null);
    try {
      await setLadderTaught(classId, skills, on);
    } catch (e) {
      setTaught(before);
      setFailed((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel y78" aria-labelledby="y78-title">
      <h2 id="y78-title" className="panel__title">
        Year 7–8 maths
      </h2>
      <p className="y78__intro">
        Switch on each skill once you have taught it. Pupils who finish the Year 6 skills only get the Year 7 and 8 skills
        switched on here, in this order. Everything starts off. A pupil ticked “Stop at Y6” on the{' '}
        {classId ? <Link to={`/teacher/${classId}/students`}>Students</Link> : 'Students'} tab gets none of them. You can
        still pick any skill in Set focus.
      </p>
      {failed && (
        <p className="y78__error" role="alert">
          {failed}
        </p>
      )}
      {!taught && !failed && (
        <p className="loading" role="status">
          Loading…
        </p>
      )}
      {taught &&
        Y78_GROUPS.map((g) => {
          const ids = g.skills.map((s) => s.id);
          const allOn = ids.every((id) => taught.has(id));
          return (
            <section key={g.name} className="y78__group" aria-label={g.name}>
              <div className="y78__group-head">
                <h3>{g.name}</h3>
                <button type="button" className="y78__all" disabled={saving} onClick={() => change(ids, !allOn)}>
                  {allOn ? 'All off' : 'All on'}
                </button>
              </div>
              <ul className="y78__list">
                {g.skills.map((s) => (
                  <li key={s.id} className="y78__row">
                    <label>
                      <input type="checkbox" checked={taught.has(s.id)} disabled={saving} onChange={(e) => change([s.id], e.target.checked)} aria-label={`${s.label} taught`} />
                      <span className="y78__name">
                        {s.label} <span className="y78__year">Year {s.year}</span>
                      </span>
                      <span className="y78__eg">{examples(s.id)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </section>
  );
}
