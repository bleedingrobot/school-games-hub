/**
 * The teacher's maths focus screen: choose what maths the games ask a class, a group or some students, for how long; see the
 * focuses running (with Extend and End now) and the history; and say whether students may choose their own focus.
 * Every action is checked by the database, which refuses anyone who does not teach the class.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { fetchClasses, fetchClassDetail, type ClassDetail, type ClassSummary } from '../data/classes';
import { fetchMathsAuto, fetchStudentsChooseFocus, saveMathsAuto, saveStudentsChooseFocus } from '../data/classSettings';
import { endFocus, extendFocus, fetchFocuses, setFocus, type FocusBatch, type FocusLength, type FocusScope } from '../data/focus';
import { FriendlyError } from '../data/profile';
import { describeEnd, nzLocalToIso, skillList, timeLeft } from '../../shared/maths/focus';
import { LADDER } from '../../shared/maths/ladder';
import { FocusHistory } from '../maths/FocusHistory';
import { whoFor } from '../maths/focusText';
import { LengthPicker, LENGTHS } from '../maths/LengthPicker';
import { SkillPicker } from '../maths/SkillPicker';
import '../maths/focus.css';
import './classes.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

/** How often the running list looks again, in milliseconds. */
export const REFRESH_MS = 30_000;

export default function SetFocus() {
  const { profile } = useAuth();
  if (profile?.role !== 'teacher') {
    return (
      <section className="coming-soon">
        <div className="coming-soon__emoji" aria-hidden="true">
          🔒
        </div>
        <h1>Teachers only</h1>
        <p className="coming-soon__text">This page is for teachers.</p>
      </section>
    );
  }
  return <SetFocusView />;
}

export { whoFor };

function SetFocusView() {
  const [params, setParams] = useSearchParams();
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    fetchClasses()
      .then(setClasses)
      .catch((error) => {
        setFailed(errorText(error));
        setClasses([]);
      });
  }, []);

  const mine = (classes ?? []).filter((c) => !c.archived);
  const wanted = params.get('class');
  const chosen = mine.find((c) => c.id === wanted) ?? mine.find((c) => c.teaching) ?? mine[0] ?? null;

  return (
    <div className="teacher classes">
      <h1 className="page-title">Maths focus</h1>
      <p className="classes__back">
        <Link to="/teacher">← Back to the teacher view</Link>
      </p>
      <p className="teacher__classes-link">
        Choose the maths that Gem Keep and Mission Control ask. With no focus, they ask what each student is ready for.
      </p>

      {classes === null ? (
        <p className="teacher__classes-link">Loading…</p>
      ) : mine.length === 0 ? (
        <section className="panel">
          <p className="panel__empty">
            {failed ?? 'You don’t teach a class yet.'} <Link to="/classes">Make one on the My classes page</Link> first.
          </p>
        </section>
      ) : (
        <>
          {mine.length > 1 && (
            <div className="teacher__picker">
              <label>
                <span>Class</span>{' '}
                <select value={chosen?.id ?? ''} onChange={(e) => setParams({ class: e.target.value }, { replace: true })}>
                  {mine.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.teaching ? '' : ' (not mine)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {chosen && <ClassFocus key={chosen.id} summary={chosen} preset={{ student: params.get('student'), skill: params.get('skill') }} />}
        </>
      )}
    </div>
  );
}

/** A skill map link can ask for a student, a skill or both to be ticked already. */
interface Preset {
  student: string | null;
  skill: string | null;
}

function ClassFocus({ summary, preset }: { summary: ClassSummary; preset: Preset }) {
  const classId = summary.id;
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [batches, setBatches] = useState<FocusBatch[] | null>(null);
  const [choose, setChoose] = useState<boolean | null>(null);
  const [auto, setAuto] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const refresh = useCallback(async () => {
    try {
      setBatches(await fetchFocuses(classId));
      setNow(new Date());
    } catch (error) {
      setStatus(errorText(error));
    }
  }, [classId]);

  useEffect(() => {
    fetchClassDetail(classId)
      .then(setDetail)
      .catch((error) => setStatus(errorText(error)));
    fetchStudentsChooseFocus(classId)
      .then(setChoose)
      .catch(() => setChoose(true));
    fetchMathsAuto(classId)
      .then(setAuto)
      .catch(() => setAuto(false));
    void refresh();
  }, [classId, refresh]);

  // The running list looks again by itself, so "ends in 40 minutes" stays true and a focus that has run out drops off.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function changeChoose(on: boolean) {
    setStatus('Saving…');
    try {
      await saveStudentsChooseFocus(on, classId);
      setChoose(on);
      setStatus(on ? 'Students can choose their own focus.' : 'Students can’t choose their own focus. The games use your focus, or auto.');
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  async function changeAuto(on: boolean) {
    setStatus('Saving…');
    try {
      await saveMathsAuto(on, classId);
      setAuto(on);
      setStatus(
        on
          ? 'The games now pick the maths for students with no focus. It starts with their next level or game.'
          : 'The games ask the times tables for students with no focus, as before.',
      );
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <>
      <section className="panel" aria-labelledby="choose-title">
        <h2 id="choose-title" className="panel__title">
          Students choosing their own focus
        </h2>
        {choose !== null && (
          <label className="classes__check">
            <input type="checkbox" checked={choose} onChange={(e) => void changeChoose(e.target.checked)} /> Students can choose their own focus
          </label>
        )}
        <p className="class-panel__hint">
          On: a student can pick their own skills on their home page, unless a focus from you is running. Off: they get your focus, or
          auto. What a student picked is kept, and comes back if you turn this back on.
        </p>
      </section>

      <section className="panel" aria-labelledby="auto-title">
        <h2 id="auto-title" className="panel__title">
          Auto
        </h2>
        {auto !== null && (
          <label className="classes__check">
            <input type="checkbox" checked={auto} onChange={(e) => void changeAuto(e.target.checked)} /> Games pick the maths (auto) when
            there is no focus
          </label>
        )}
        <p className="class-panel__hint">
          On: a student with no focus is walked up the ladder, from number facts to the times tables and beyond, starting where they are
          ready (they can do a short warm-up to find it, or you can set your class&rsquo;s year level on My classes). Their place never goes
          backwards. Your focus, or one a student picked, always comes first. Off: the games ask the times tables, as they always have.
        </p>
      </section>

      <section className="panel" aria-labelledby="running-title">
        <h2 id="running-title" className="panel__title">
          Running focuses
          {batches && <span className="panel__count">{batches.length}</span>}
        </h2>
        {!batches ? (
          <p className="panel__empty">Loading…</p>
        ) : batches.length === 0 ? (
          <p className="panel__empty">None running. Students follow their own choice, or auto.</p>
        ) : (
          <ul className="class-panel__list">
            {batches.map((b) => (
              <Running key={b.batch} batch={b} now={now} onDone={(message) => { setStatus(message); void refresh(); }} onError={(e) => setStatus(errorText(e))} />
            ))}
          </ul>
        )}
      </section>

      {detail && (
        <NewFocus
          classId={classId}
          detail={detail}
          preset={preset}
          onSet={(message) => {
            setStatus(message);
            void refresh();
          }}
          onError={(e) => setStatus(errorText(e))}
        />
      )}

      <FocusHistory classId={classId} detail={detail} />

      <p role="status" className="teacher__classes-link">
        {status}
      </p>
    </>
  );
}

function Running({ batch, now, onDone, onError }: { batch: FocusBatch; now: Date; onDone: (message: string) => void; onError: (error: unknown) => void }) {
  const [extending, setExtending] = useState(false);
  const [length, setLength] = useState<FocusLength>('week');
  const [custom, setCustom] = useState('');

  async function extend() {
    const iso = length === 'custom' ? nzLocalToIso(custom) : undefined;
    if (length === 'custom' && !iso) return onError(new FriendlyError('Pick a date and time first.'));
    try {
      const ends = await extendFocus(batch.batch, length, iso ?? undefined);
      setExtending(false);
      onDone(`It now runs ${describeEnd(ends)}.`);
    } catch (error) {
      onError(error);
    }
  }

  async function end() {
    try {
      await endFocus(batch.batch);
      onDone(`Ended: ${whoFor(batch)} go back to their own choice, or auto.`);
    } catch (error) {
      onError(error);
    }
  }

  return (
    <li className="running-focus">
      <span className="running-focus__what">
        {whoFor(batch)}: {skillList(batch.skills)}
        {batch.onlyThese && <span className="tag">Only these</span>}
      </span>
      <span className="running-focus__meta">
        {timeLeft(batch.endsAt, now)} ({describeEnd(batch.endsAt, now)})
        {batch.status === 'later' && ' · starts later'}
      </span>
      <span className="running-focus__actions">
        {!extending && (
          <button type="button" className="button button--light-outline" onClick={() => setExtending(true)}>
            Extend
          </button>
        )}
        <button type="button" className="button button--light-outline" aria-label={`End now: ${whoFor(batch)}`} onClick={() => void end()}>
          End now
        </button>
      </span>
      {extending && (
        <div className="set-focus__form">
          <LengthPicker value={length} custom={custom} onChange={setLength} onCustom={setCustom} legend="Run it until…" />
          <span className="running-focus__actions">
            <button type="button" className="button button--primary" onClick={() => void extend()}>
              Extend it
            </button>
            <button type="button" className="button button--light-outline" onClick={() => setExtending(false)}>
              Cancel
            </button>
          </span>
        </div>
      )}
    </li>
  );
}

function NewFocus({ classId, detail, preset, onSet, onError }: { classId: string; detail: ClassDetail; preset: Preset; onSet: (message: string) => void; onError: (error: unknown) => void }) {
  const presetStudent = detail.members.find((m) => m.id === preset.student)?.id ?? null;
  const presetSkill = LADDER.find((l) => l.built && l.id === preset.skill)?.id ?? null;
  const [scope, setScope] = useState<FocusScope>(presetStudent ? 'student' : 'class');
  const [group, setGroup] = useState('');
  const [students, setStudents] = useState<Set<string>>(new Set(presetStudent ? [presetStudent] : []));
  const [skills, setSkills] = useState<string[]>(presetSkill ? [presetSkill] : []);
  const [onlyThese, setOnlyThese] = useState(false);
  const [length, setLength] = useState<FocusLength>('friday');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  const targets = scope === 'group' ? (group ? [group] : []) : scope === 'student' ? [...students] : [];
  const needsTarget = scope !== 'class' && targets.length === 0;
  const customIso = length === 'custom' ? nzLocalToIso(custom) : null;
  const ready = skills.length > 0 && !needsTarget && (length !== 'custom' || customIso !== null);

  function who(): string {
    if (scope === 'class') return 'the whole class';
    if (scope === 'group') return `the ${detail.groups.find((g) => g.id === group)?.name ?? ''} group`;
    return `${students.size} student${students.size === 1 ? '' : 's'}`;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await setFocus({ classId, scope, targets, skills, onlyThese, length, custom: customIso ?? undefined });
      onSet(`Focus set for ${who()}: ${skillList(skills)} ${LENGTHS.find((l) => l.value === length)?.label.toLowerCase()}.`);
      setSkills([]);
      setStudents(new Set());
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="set-title">
      <h2 id="set-title" className="panel__title">
        Set a focus
      </h2>
      <form className="set-focus__form" onSubmit={(e) => void submit(e)}>
        <fieldset>
          <legend>Who is it for?</legend>
          <div className="set-focus__options">
            <label>
              <input type="radio" name="focus-scope" checked={scope === 'class'} onChange={() => setScope('class')} /> The whole class
            </label>
            <label>
              <input type="radio" name="focus-scope" checked={scope === 'group'} onChange={() => setScope('group')} disabled={detail.groups.length === 0} /> A group
              {detail.groups.length === 0 && ' (make a group on the My classes page first)'}
            </label>
            <label>
              <input type="radio" name="focus-scope" checked={scope === 'student'} onChange={() => setScope('student')} disabled={detail.members.length === 0} /> Some students
            </label>
          </div>
          {scope === 'group' && (
            <label className="teacher__type">
              <span>Group</span>
              <select value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">Pick a group…</option>
                {detail.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.members})
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === 'student' && (
            <ul className="set-focus__students" aria-label="Students">
              {detail.members.map((m) => (
                <li key={m.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={students.has(m.id)}
                      onChange={() => {
                        const next = new Set(students);
                        if (next.has(m.id)) next.delete(m.id);
                        else next.add(m.id);
                        setStudents(next);
                      }}
                    />{' '}
                    {m.name}
                    {m.group && <span className="tag">{m.group}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <SkillPicker value={skills} onChange={setSkills} legend="What maths?" />
        <label className="classes__check">
          <input type="checkbox" checked={onlyThese} onChange={(e) => setOnlyThese(e.target.checked)} /> Only these skills. Leave this off and earlier skills still come up as
          review (about a third of the questions).
        </label>

        <LengthPicker value={length} custom={custom} onChange={setLength} onCustom={setCustom} />

        <div className="set-focus__row">
          <button type="submit" className="button button--primary" disabled={!ready || busy}>
            Set focus
          </button>
          {!ready && (
            <span className="class-panel__hint">
              {skills.length === 0 ? 'Pick at least one skill.' : needsTarget ? (scope === 'group' ? 'Pick a group.' : 'Pick at least one student.') : 'Pick an end time.'}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
