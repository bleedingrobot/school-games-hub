/**
 * The Admin pages (/teacher/admin; docs/TEACHER-VIEW-PLAN.md, section 4.7, stage 6): the school at a glance, every student, and
 * the teachers. For school admins only. The database checks every call and only reads the admin's own school.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { whenPlayed } from '../components/MyGames';
import {
  fetchAdminOverview,
  fetchAdminStudents,
  fetchAdminTeachers,
  setSchoolAdmin,
  type AdminOverview as Overview,
  type AdminStudent,
  type AdminTeacher,
} from '../data/admin';
import { FriendlyError } from '../data/profile';
import { setRole } from '../data/teacher';
import { share } from '../pages/TeacherQuestionSkips';
import { useHideRealNames } from './Students';
import { useTeacherClass } from './TeacherClass';
import '../pages/teacher-page.css';
import './students.css';
import './admin.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Loads once on arrival. */
function useLoaded<T>(load: () => Promise<T>): { data: T | null; failed: string | null; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setFailed(null);
    } catch (error) {
      setFailed(errorText(error));
    }
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, failed, reload };
}

// ---------------------------------------------------------------- Overview

export function AdminOverview() {
  const { data, failed } = useLoaded(fetchAdminOverview);
  if (failed) return <p className="panel panel__empty">{failed}</p>;
  if (!data) return <p className="panel panel__empty">Loading…</p>;
  return (
    <>
      <NeedsAdmin o={data} />
      <TheSchool o={data} />
    </>
  );
}

function NeedsAdmin({ o }: { o: Overview }) {
  const lines: ReactNode[] = [];
  if (o.noClass > 0) {
    lines.push(
      <Link key="noclass" to="/teacher/admin/students?show=noclass">
        {o.noClass === 1 ? '1 student isn’t in a class' : `${o.noClass} students aren’t in a class`}
      </Link>,
    );
  }
  if (o.classesNoTeacher.length > 0) {
    lines.push(<span key="noteacher">Classes with no teacher: {o.classesNoTeacher.map((c) => c.name).join(', ')}</span>);
  }
  if (o.oldWarp > 0) {
    lines.push(
      <span key="warp">
        {o.oldWarp === 1 ? '1 student has' : `${o.oldWarp} students have`} waited more than a day to join a class
      </span>,
    );
  }
  return (
    <section className="panel" aria-labelledby="needs-title">
      <h2 id="needs-title" className="panel__title">
        Needs an admin
      </h2>
      {lines.length === 0 ? (
        <p className="panel__empty">Nothing needs an admin right now.</p>
      ) : (
        <ul className="admin__needs">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TheSchool({ o }: { o: Overview }) {
  const c = o.counts;
  const rows: [string, string][] = [
    ['Classes', String(c.classes)],
    ['Students', String(c.students)],
    ['Teachers', `${c.teachers} (${plural(c.admins, 'admin', 'admins')})`],
    ['Students active this week', String(c.activeWeek)],
    ['Questions this week', String(c.shownWeek)],
    ['Skipped', share(c.skippedWeek, c.shownWeek)],
  ];
  return (
    <section className="panel" aria-labelledby="school-title">
      <h2 id="school-title" className="panel__title">
        The school
      </h2>
      <dl className="admin__facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- Students

type Show = 'all' | 'noclass' | 'hidden' | 'quiet';
const SHOWS: { id: Show; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'noclass', label: 'Not in a class' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'quiet', label: 'Not played for 30 days' },
];

const QUIET_DAYS = 30;
const noClass = (s: AdminStudent) => !s.classId || s.classArchived;
const quiet = (s: AdminStudent) => !s.lastPlayed || Date.now() - Date.parse(s.lastPlayed) > QUIET_DAYS * 86_400_000;
const FILTERS: Record<Show, (s: AdminStudent) => boolean> = {
  all: () => true,
  noclass: noClass,
  hidden: (s) => s.hidden,
  quiet,
};

export function AdminStudents() {
  const { profile } = useAuth();
  const { classId } = useTeacherClass();
  const { data, failed } = useLoaded(fetchAdminStudents);
  const [params, setParams] = useSearchParams();
  const [hideReal, setHideReal] = useHideRealNames(profile?.id ?? '');
  const [find, setFind] = useState('');
  const asked = params.get('show');
  const show: Show = SHOWS.find((s) => s.id === asked)?.id ?? 'all';

  const choose = (next: Show) =>
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        if (next === 'all') out.delete('show');
        else out.set('show', next);
        return out;
      },
      { replace: true },
    );

  const wanted = find.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (data ?? []).filter(
        (s) =>
          FILTERS[show](s) && (s.name.toLowerCase().includes(wanted) || (!hideReal && (s.realName ?? '').toLowerCase().includes(wanted))),
      ),
    [data, show, wanted, hideReal],
  );

  return (
    <>
      <div className="students-bar">
        <div className="students-show" role="group" aria-label="Show">
          {SHOWS.map((s) => (
            <button key={s.id} type="button" className="students-show__choice" aria-pressed={show === s.id} onClick={() => choose(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="students-hide">
          <input type="checkbox" checked={hideReal} onChange={(e) => setHideReal(e.target.checked)} />
          Hide real names
        </label>
      </div>
      <section className="panel" aria-labelledby="admin-students-title">
        <h2 id="admin-students-title" className="panel__title">
          Students
          {data && <span className="panel__count">{shown.length}</span>}
        </h2>
        <label className="teacher__filter">
          <span>Find a student</span>
          <input
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder={hideReal ? 'Player name' : 'Player name or real name'}
          />
        </label>
        {failed ? (
          <p className="panel__empty">{failed}</p>
        ) : !data ? (
          <p className="panel__empty">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="panel__empty">{data.length === 0 ? 'There are no students yet.' : 'No students match.'}</p>
        ) : (
          <>
            <p className="students__note">{plural(shown.length, 'student', 'students')}</p>
            <div className="roster__scroll">
              <table className="stats-table roster admin__table">
                <caption className="sr-only">Every student in the school.</caption>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    {!hideReal && <th scope="col">Real name</th>}
                    <th scope="col">Class</th>
                    <th scope="col">Last played</th>
                    <th scope="col">Hidden</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id} className={s.hidden ? 'is-hidden' : undefined}>
                      <th scope="row">
                        {/* Their own class's page when they have one, so "‹ Students" goes back to their class. */}
                        {(s.classId && !s.classArchived) || classId ? (
                          <Link to={`/teacher/${s.classId && !s.classArchived ? s.classId : classId}/students/${s.id}`} className="roster__student">
                            <AvatarImage avatar={s.avatar} size={32} />
                            <span>{s.name}</span>
                          </Link>
                        ) : (
                          <span className="roster__student">
                            <AvatarImage avatar={s.avatar} size={32} />
                            <span>{s.name}</span>
                          </span>
                        )}
                      </th>
                      {!hideReal && <td>{s.realName ?? '–'}</td>}
                      <td>{s.className ? `${s.className}${s.classArchived ? ' (archived)' : ''}` : '–'}</td>
                      <td>{s.lastPlayed ? whenPlayed(s.lastPlayed) : 'Not yet'}</td>
                      <td>{s.hidden ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------- Teachers

export function AdminTeachers() {
  const { profile } = useAuth();
  const [hideReal, setHideReal] = useHideRealNames(profile?.id ?? '');
  const { data, failed, reload } = useLoaded(fetchAdminTeachers);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(task: () => Promise<void>, done: string) {
    setBusy(true);
    setStatus(null);
    try {
      await task();
      setConfirming(null);
      setStatus(done);
      await reload();
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="students-bar">
        <span />
        <label className="students-hide">
          <input type="checkbox" checked={hideReal} onChange={(e) => setHideReal(e.target.checked)} />
          Hide real names
        </label>
      </div>
      <section className="panel" aria-labelledby="admin-teachers-title">
        <h2 id="admin-teachers-title" className="panel__title">
          Teachers
          {data && <span className="panel__count">{data.length}</span>}
        </h2>
        {failed ? (
          <p className="panel__empty">{failed}</p>
        ) : !data ? (
          <p className="panel__empty">Loading…</p>
        ) : data.length === 0 ? (
          <p className="panel__empty">There are no teachers yet.</p>
        ) : (
          <div className="roster__scroll">
            <table className="stats-table roster admin__table">
              <caption className="sr-only">Every teacher in the school.</caption>
              <thead>
                <tr>
                  <th scope="col">Teacher</th>
                  {!hideReal && <th scope="col">Real name</th>}
                  <th scope="col">Classes</th>
                  <th scope="col">School admin</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t) => (
                  <TeacherRow
                    key={t.id}
                    t={t}
                    hideReal={hideReal}
                    busy={busy}
                    confirming={confirming === t.id}
                    onConfirm={(on) => setConfirming(on ? t.id : null)}
                    onAdmin={() => act(() => setSchoolAdmin(t.id, !t.admin), t.admin ? `${t.name} is no longer a school admin.` : `${t.name} is now a school admin.`)}
                    onRemove={() => act(() => setRole(t.id, 'student'), `${t.name} is now a student.`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p role="status" className="teacher__status">
          {status}
        </p>
      </section>
    </>
  );
}

function TeacherRow({
  t,
  hideReal,
  busy,
  confirming,
  onConfirm,
  onAdmin,
  onRemove,
}: {
  t: AdminTeacher;
  hideReal: boolean;
  busy: boolean;
  confirming: boolean;
  onConfirm: (on: boolean) => void;
  onAdmin: () => void;
  onRemove: () => void;
}) {
  return (
    <tr>
      <th scope="row">
        <span className="roster__student">
          <AvatarImage avatar={t.avatar} size={32} />
          <span>{t.name}</span>
        </span>
      </th>
      {!hideReal && <td>{t.realName ?? '–'}</td>}
      <td>{t.classes.length > 0 ? t.classes.map((c) => c.name).join(', ') : '–'}</td>
      <td>{t.admin ? 'Yes' : 'No'}</td>
      <td>
        {t.me ? (
          'That’s you'
        ) : confirming ? (
          <div className="admin__confirm">
            <p>Remove teacher: they become a student and stop teaching their classes.</p>
            <button type="button" className="button button--primary" disabled={busy} onClick={onRemove}>
              Remove
            </button>{' '}
            <button type="button" className="button button--light-outline" disabled={busy} onClick={() => onConfirm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="admin__actions">
            <button type="button" className="button button--light-outline" disabled={busy} onClick={onAdmin}>
              {t.admin ? 'Remove school admin' : 'Make school admin'}
            </button>
            <button type="button" className="button button--light-outline" disabled={busy} onClick={() => onConfirm(true)}>
              Remove teacher
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
