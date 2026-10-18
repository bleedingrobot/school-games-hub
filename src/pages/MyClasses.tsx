import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import {
  addCoTeacher,
  addToClass,
  answerWarp,
  archiveClass,
  createClass,
  createGroup,
  deleteGroup,
  fetchClassDetail,
  fetchClassEvents,
  fetchClasses,
  fetchMySchool,
  fetchSchoolTeachers,
  fetchUnassigned,
  fetchWarpRequests,
  moveStudent,
  removeCoTeacher,
  removeFromClass,
  renameGroup,
  resetWarpCode,
  setGroupMember,
  setWarpMode,
  updateClass,
  type ClassDetail,
  type ClassSummary,
  type SchoolInfo,
  type SchoolTeacher,
  type UnassignedStudent,
  type WarpEvent,
  type WarpMode,
  type WarpRequest,
} from '../data/classes';
import { FriendlyError } from '../data/profile';
import { prettyCode } from '../../shared/multiplayer';
import './classes.css';

function errorText(error: unknown) {
  return error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.';
}

/** How often the "who has joined" list and the requests look again, in milliseconds. */
export const LIVE_MS = 8000;

/** "just now", "3 minutes ago", "2 hours ago", or the day. */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

export function eventText(e: WarpEvent): string {
  const group = e.group_name ? ` ${e.group_name}` : '';
  switch (e.kind) {
    case 'joined':
      return `${e.student_name} joined`;
    case 'joined-group':
      return `${e.student_name} joined${group}`;
    case 'added':
      return `${e.student_name} was added`;
    case 'moved-in':
      return `${e.student_name} moved in from another class`;
    case 'moved-out':
      return `${e.student_name} moved to another class`;
    case 'removed':
      return `${e.student_name} was taken out of the class`;
    case 'asked':
      return `${e.student_name} asked to join${group}`;
    case 'declined':
      return `${e.student_name} was turned down${group ? ` for${group}` : ''}`;
  }
}

const MODES: { value: WarpMode; label: string; detail: string }[] = [
  { value: 'on', label: 'On', detail: 'Anyone with the code joins at once.' },
  { value: 'ask', label: 'Ask me first', detail: 'Students wait until you say yes.' },
  { value: 'off', label: 'Off', detail: 'The code does nothing.' },
];

/** Teachers and school admins: make classes, hand out the Class Warp code, and look after who is in them. */
export function MyClasses() {
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
  return <MyClassesView me={profile.id} />;
}

function MyClassesView({ me }: { me: string }) {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchClasses(showArchived);
      setClasses(list);
      setFailed(null);
      // Keep the class that was open; otherwise open the first one this teacher teaches.
      setOpen((current) => (current && list.some((c) => c.id === current) ? current : (list.find((c) => c.teaching)?.id ?? list[0]?.id ?? null)));
    } catch (error) {
      setFailed(errorText(error));
    }
  }, [showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetchMySchool()
      .then(setSchool)
      .catch(() => undefined);
  }, []);

  const isAdmin = school?.admin === true;
  const current = classes?.find((c) => c.id === open) ?? null;

  return (
    <div className="teacher classes">
      <h1 className="page-title">My classes</h1>
      <p className="classes__back">
        <Link to="/teacher">← Back to the teacher view</Link>
        {school && <span className="classes__school">{school.name}{isAdmin && <span className="tag tag--teacher">School admin</span>}</span>}
      </p>

      <MakeClass
        onMade={(id) => {
          setOpen(id);
          void load();
        }}
      />

      <section className="panel" aria-labelledby="classes-title">
        <h2 id="classes-title" className="panel__title">
          Classes
          {classes && <span className="panel__count">{classes.length}</span>}
        </h2>
        {isAdmin && (
          <label className="classes__check">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived classes
          </label>
        )}
        {failed ? (
          <p className="panel__empty">{failed}</p>
        ) : !classes ? (
          <p className="panel__empty">Loading…</p>
        ) : classes.length === 0 ? (
          <p className="panel__empty">You don’t have a class yet. Make one above, then give its code to your students.</p>
        ) : (
          <ul className="people-list classes__list">
            {classes.map((c) => (
              <li key={c.id} className={c.archived ? 'is-hidden' : undefined}>
                <button
                  type="button"
                  className="people-list__row"
                  aria-expanded={open === c.id}
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                >
                  <span className="people-list__name">
                    {c.name}
                    {c.archived && <span className="tag tag--hidden">Archived</span>}
                    {!c.teaching && <span className="tag">Not yours</span>}
                    {c.waiting > 0 && <span className="tag classes__waiting-tag">{c.waiting} waiting</span>}
                    <span className="people-list__real">
                      {c.school_year}
                      {c.year_level !== null && ` · Year ${c.year_level}`}
                    </span>
                  </span>
                  <span className="people-list__games">
                    {c.members} student{c.members === 1 ? '' : 's'}
                  </span>
                  <span className="people-list__when">
                    Code {prettyCode(c.warp_code)}
                    {c.warp_mode === 'off' ? ' (off)' : c.warp_mode === 'ask' ? ' (asks you first)' : ''}
                  </span>
                </button>
                {open === c.id && current && (
                  <ClassPanel
                    summary={current}
                    me={me}
                    isAdmin={isAdmin}
                    others={classes.filter((o) => o.id !== c.id && o.teaching && !o.archived)}
                    onChanged={() => void load()}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MakeClass({ onMade }: { onMade: (id: string) => void }) {
  const thisYear = new Date().getFullYear();
  const [name, setName] = useState('');
  const [year, setYear] = useState(thisYear);
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus('Saving…');
    try {
      const id = await createClass(name.trim(), year, level === '' ? null : Number(level));
      setName('');
      setStatus('Class made. Its code is below, ready to share.');
      onMade(id);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel" aria-labelledby="make-class-title">
      <h2 id="make-class-title" className="panel__title">
        Make a class
      </h2>
      <form className="classes__form" onSubmit={(e) => void submit(e)}>
        <label className="teacher__type">
          <span>Class name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Room 12" aria-describedby="make-class-name-help" />
        </label>
        <label className="teacher__type">
          <span>School year</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="teacher__type">
          <span>Year level (optional)</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((l) => (
              <option key={l} value={l}>
                Year {l}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button button--primary">
          Make class
        </button>
      </form>
      <p id="make-class-name-help" className="class-panel__hint">
        Leave the name blank and the class is named after your email (the part before the @). You can rename it any time. Students
        see a class name once they type its code, so give it a name your class will recognise.
      </p>
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}

function ClassPanel({
  summary,
  me,
  isAdmin,
  others,
  onChanged,
}: {
  summary: ClassSummary;
  me: string;
  isAdmin: boolean;
  others: ClassSummary[];
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [events, setEvents] = useState<WarpEvent[]>([]);
  const [requests, setRequests] = useState<WarpRequest[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedStudent[]>([]);
  const [staff, setStaff] = useState<SchoolTeacher[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [coTeacher, setCoTeacher] = useState('');
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<'reset' | 'archive' | `reset-group:${string}` | `delete-group:${string}` | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  const id = summary.id;
  const refresh = useCallback(async () => {
    try {
      const [d, e, r] = await Promise.all([fetchClassDetail(id), fetchClassEvents(id), fetchWarpRequests()]);
      setDetail(d);
      setEvents(e);
      setRequests(r.filter((x) => x.class_id === id));
    } catch (error) {
      setStatus(errorText(error));
    }
  }, [id]);

  const refreshLists = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([fetchUnassigned(), fetchSchoolTeachers()]);
      setUnassigned(u);
      setStaff(s);
    } catch (error) {
      setStatus(errorText(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshLists();
  }, [refresh, refreshLists]);

  // The "joined" list and the requests are live: look again every few seconds while the page is showing.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh();
    }, LIVE_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function act(work: () => Promise<string>) {
    setStatus('Saving…');
    setConfirming(null);
    try {
      setStatus(await work());
      await Promise.all([refresh(), refreshLists()]);
      onChanged();
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  if (!detail) {
    return <div className="class-panel">{status ? <p className="panel__empty">{status}</p> : <p className="panel__empty">Loading…</p>}</div>;
  }

  const teacherIds = new Set(detail.teachers.map((t) => t.id));
  const canAddTeacher = staff.filter((t) => !teacherIds.has(t.id));
  const editable = !detail.archived && (summary.teaching || isAdmin);

  const nameNow = rename ?? detail.name;
  const levelNow = level ?? (detail.yearLevel === null ? '' : String(detail.yearLevel));

  return (
    <div className="class-panel">
      {editable && (
        <section aria-labelledby={`name-${id}`} className="class-panel__section">
          <h3 id={`name-${id}`}>Class name</h3>
          <form
            className="class-panel__add-teacher"
            onSubmit={(e) => {
              e.preventDefault();
              const name = nameNow.trim();
              void act(async () => {
                await updateClass(id, name, detail.schoolYear, levelNow === '' ? null : Number(levelNow));
                setRename(null);
                setLevel(null);
                return `Saved. The class is called ${name}${levelNow === '' ? '' : `, Year ${levelNow}`}.`;
              });
            }}
          >
            <label className="teacher__type">
              <span>Name</span>
              <input value={nameNow} onChange={(e) => setRename(e.target.value)} maxLength={30} />
            </label>
            <label className="teacher__type">
              <span>Year level</span>
              <select value={levelNow} onChange={(e) => setLevel(e.target.value)}>
                <option value="">Not set</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((l) => (
                  <option key={l} value={l}>
                    Year {l}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="button button--light-outline"
              disabled={nameNow.trim() === '' || (nameNow.trim() === detail.name && levelNow === (detail.yearLevel === null ? '' : String(detail.yearLevel)))}
            >
              Save
            </button>
          </form>
          <p className="class-panel__hint">
            Your students see this name after they type the class code, so make it one they will recognise. The year level is never shown to
            students: auto uses it to choose where the games start (a student can do a short warm-up to find a better place).{' '}
            <Link to={`/focus?class=${id}`}>🎯 Choose the maths for this class</Link>
          </p>
        </section>
      )}

      <section aria-labelledby={`warp-${id}`} className="class-panel__section">
        <h3 id={`warp-${id}`}>Class Warp code</h3>
        <p className="class-panel__code" aria-label={`The code for ${detail.name} is ${detail.warpCode.split('').join(' ')}`}>
          {prettyCode(detail.warpCode)}
        </p>
        <p className="class-panel__hint">
          Tell your students this code. They type it into Class Warp on their home page. It only ever puts them in this class.
        </p>
        <ModePicker
          name={`mode-${id}`}
          label="What the code does"
          value={detail.warpMode}
          disabled={!editable}
          onChange={(mode) =>
            void act(async () => {
              await setWarpMode(id, mode);
              return `The class code is now ${MODES.find((m) => m.value === mode)?.label.toLowerCase()}.`;
            })
          }
        />
        {editable &&
          (confirming === 'reset' ? (
            <div className="chess-confirm" role="group" aria-label="Confirm new code">
              <p>Make a new code? The old one stops working at once. Students already in the class stay in it.</p>
              <div className="person-panel__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() =>
                    void act(async () => `The new code is ${prettyCode(await resetWarpCode(id))}.`)
                  }
                >
                  Yes, new code
                </button>
                <button type="button" className="button button--light-outline" onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="button button--light-outline" onClick={() => setConfirming('reset')}>
              🔀 Make a new code
            </button>
          ))}
      </section>

      {requests.length > 0 && (
        <section aria-labelledby={`requests-${id}`} className="class-panel__section">
          <h3 id={`requests-${id}`}>Waiting for your yes</h3>
          <ul className="class-panel__list">
            {requests.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.student_name}</strong> would like to join{r.group_name ? ` ${r.group_name}` : ''} ({ago(r.asked_at)})
                </span>
                <span className="person-panel__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    aria-label={`Yes, let ${r.student_name} in`}
                    onClick={() => void act(async () => { await answerWarp(r.id, true); return `${r.student_name} is in.`; })}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="button button--light-outline"
                    aria-label={`No, keep ${r.student_name} out`}
                    onClick={() => void act(async () => { await answerWarp(r.id, false); return `${r.student_name} was turned down.`; })}
                  >
                    No
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby={`joined-${id}`} className="class-panel__section">
        <h3 id={`joined-${id}`}>Who has joined</h3>
        {events.length === 0 ? (
          <p className="panel__empty">Nobody yet. This list updates by itself.</p>
        ) : (
          <div className="class-panel__events" role="log" aria-live="polite" aria-label="Recent warps">
            <ul className="class-panel__list">
              {events.map((e) => (
                <li key={e.id}>
                  <span>{eventText(e)}</span>
                  <span className="class-panel__when">{ago(e.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby={`groups-${id}`} className="class-panel__section">
        <h3 id={`groups-${id}`}>Groups</h3>
        <p className="class-panel__hint">
          A group is a smaller set of students inside this class, for example a maths group. Each group has its own Class Warp code
          and can have its own maths focus. A student is in one group at a time.
        </p>
        {editable && (
          <form
            className="class-panel__add-teacher"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newGroup.trim();
              void act(async () => {
                await createGroup(id, name);
                setNewGroup('');
                return `The ${name} group is made. Pick its students below.`;
              });
            }}
          >
            <label className="teacher__type">
              <span>New group name</span>
              <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} maxLength={30} placeholder="Kea" />
            </label>
            <button type="submit" className="button button--light-outline" disabled={newGroup.trim() === ''}>
              Make group
            </button>
          </form>
        )}
        {detail.groups.length === 0 ? (
          <p className="panel__empty">No groups yet.</p>
        ) : (
          <ul className="class-panel__list">
            {detail.groups.map((g) => (
              <li key={g.id} className="class-panel__group">
                <span>
                  <strong>{g.name}</strong> · {g.members} student{g.members === 1 ? '' : 's'} · code{' '}
                  <span className="class-panel__code-inline">{prettyCode(g.warpCode)}</span>
                </span>
                <ModePicker
                  name={`mode-${g.id}`}
                  label={`What the ${g.name} code does`}
                  value={g.warpMode}
                  disabled={!editable}
                  compact
                  onChange={(mode) =>
                    void act(async () => {
                      await setWarpMode(id, mode, g.id);
                      return `The ${g.name} code is now ${MODES.find((m) => m.value === mode)?.label.toLowerCase()}.`;
                    })
                  }
                />
                {editable && (
                  <span className="class-panel__row-actions">
                    <input
                      aria-label={`Name of the ${g.name} group`}
                      value={groupNames[g.id] ?? g.name}
                      maxLength={30}
                      onChange={(e) => setGroupNames({ ...groupNames, [g.id]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="button button--light-outline"
                      aria-label={`Rename ${g.name}`}
                      disabled={(groupNames[g.id] ?? g.name).trim() === '' || (groupNames[g.id] ?? g.name).trim() === g.name}
                      onClick={() =>
                        void act(async () => {
                          const name = (groupNames[g.id] ?? g.name).trim();
                          await renameGroup(g.id, name);
                          setGroupNames((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== g.id)));
                          return `The group is now called ${name}.`;
                        })
                      }
                    >
                      Rename
                    </button>
                    {confirming === `delete-group:${g.id}` ? (
                      <>
                        <button
                          type="button"
                          className="button button--primary"
                          onClick={() => void act(async () => { await deleteGroup(g.id); return `The ${g.name} group is gone. Its students are still in the class.`; })}
                        >
                          Yes, delete {g.name}
                        </button>
                        <button type="button" className="button button--light-outline" onClick={() => setConfirming(null)}>
                          Keep it
                        </button>
                      </>
                    ) : (
                      <button type="button" className="button button--light-outline" aria-label={`Delete ${g.name}`} onClick={() => setConfirming(`delete-group:${g.id}`)}>
                        Delete
                      </button>
                    )}
                  </span>
                )}
                {editable && (
                  <button
                    type="button"
                    className="button button--light-outline"
                    aria-label={`New code for ${g.name}`}
                    onClick={() =>
                      void act(async () => `The new ${g.name} code is ${prettyCode(await resetWarpCode(id, g.id))}.`)
                    }
                  >
                    🔀 New code
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`members-${id}`} className="class-panel__section">
        <h3 id={`members-${id}`}>
          Students <span className="panel__count">{detail.members.length}</span>
        </h3>
        {detail.members.length === 0 ? (
          <p className="panel__empty">No students yet. Share the code, or add students below.</p>
        ) : (
          <ul className="class-panel__list">
            {detail.members.map((m) => (
              <li key={m.id} className={m.hidden ? 'is-hidden' : undefined}>
                <span className="class-panel__who">
                  <AvatarImage avatar={m.avatar} size={36} />
                  <span>
                    {m.name}
                    {m.group && <span className="tag">{m.group}</span>}
                    {m.hidden && <span className="tag tag--hidden">Hidden</span>}
                    {m.realName && <span className="people-list__real">{m.realName}</span>}
                  </span>
                </span>
                {editable && (
                  <span className="class-panel__row-actions">
                    {detail.groups.length > 0 && (
                      <select
                        aria-label={`Group for ${m.name}`}
                        value={m.groupId ?? ''}
                        onChange={(e) => {
                          const to = e.target.value;
                          void act(async () => {
                            if (to === '') {
                              if (m.groupId) await setGroupMember(m.groupId, m.id, false);
                              return `${m.name} is in no group.`;
                            }
                            await setGroupMember(to, m.id, true);
                            return `${m.name} is in ${detail.groups.find((g) => g.id === to)?.name ?? 'the group'}.`;
                          });
                        }}
                      >
                        <option value="">No group</option>
                        {detail.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {others.length > 0 && (
                      <>
                        <select
                          aria-label={`Move ${m.name} to`}
                          value={moveTo[m.id] ?? ''}
                          onChange={(e) => setMoveTo({ ...moveTo, [m.id]: e.target.value })}
                        >
                          <option value="">Move to…</option>
                          {others.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="button button--light-outline"
                          aria-label={`Move ${m.name}`}
                          disabled={!moveTo[m.id]}
                          onClick={() =>
                            void act(async () => {
                              const to = others.find((o) => o.id === moveTo[m.id]);
                              await moveStudent(m.id, moveTo[m.id]);
                              return `${m.name} moved to ${to?.name ?? 'the other class'}.`;
                            })
                          }
                        >
                          Move
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="button button--light-outline"
                      aria-label={`Take ${m.name} out of the class`}
                      onClick={() =>
                        void act(async () => {
                          await removeFromClass(m.id);
                          return `${m.name} is out of the class. Their points and progress are still theirs.`;
                        })
                      }
                    >
                      Take out
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editable && (
        <section aria-labelledby={`add-${id}`} className="class-panel__section">
          <h3 id={`add-${id}`}>Add students who aren’t in a class</h3>
          {unassigned.length === 0 ? (
            <p className="panel__empty">Everyone at your school is in a class.</p>
          ) : (
            <>
              <ul className="class-panel__list class-panel__ticks">
                {unassigned.map((s) => (
                  <li key={s.id}>
                    <label className="class-panel__who">
                      <input
                        type="checkbox"
                        checked={ticked.has(s.id)}
                        onChange={(e) => {
                          const next = new Set(ticked);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          setTicked(next);
                        }}
                      />
                      <AvatarImage avatar={s.avatar} size={32} />
                      <span>
                        {s.display_name}
                        {s.real_name && <span className="people-list__real">{s.real_name}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="button button--primary"
                disabled={ticked.size === 0}
                onClick={() =>
                  void act(async () => {
                    const added = await addToClass(id, [...ticked]);
                    setTicked(new Set());
                    return `Added ${added} student${added === 1 ? '' : 's'} to ${detail.name}.`;
                  })
                }
              >
                Add {ticked.size > 0 ? ticked.size : ''} selected to {detail.name}
              </button>
            </>
          )}
        </section>
      )}

      <section aria-labelledby={`teachers-${id}`} className="class-panel__section">
        <h3 id={`teachers-${id}`}>Teachers</h3>
        <ul className="class-panel__list">
          {detail.teachers.map((t) => (
            <li key={t.id}>
              <span>
                {t.name}
                {t.id === me && <span className="tag">You</span>}
                {t.realName && <span className="people-list__real">{t.realName}</span>}
              </span>
              {editable && (
                <button
                  type="button"
                  className="button button--light-outline"
                  aria-label={`Remove ${t.realName ?? t.name} from this class`}
                  onClick={() =>
                    void act(async () => {
                      await removeCoTeacher(id, t.id);
                      return `${t.realName ?? t.name} no longer teaches ${detail.name}.`;
                    })
                  }
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {editable && canAddTeacher.length > 0 && (
          <div className="class-panel__add-teacher">
            <label className="teacher__type">
              <span>Add a co-teacher</span>
              <select value={coTeacher} onChange={(e) => setCoTeacher(e.target.value)}>
                <option value="">Choose a teacher…</option>
                {canAddTeacher.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.real_name ?? t.display_name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button button--light-outline"
              disabled={!coTeacher}
              onClick={() =>
                void act(async () => {
                  await addCoTeacher(id, coTeacher);
                  setCoTeacher('');
                  return 'Teacher added.';
                })
              }
            >
              Add teacher
            </button>
          </div>
        )}
      </section>

      {isAdmin && (
        <section aria-labelledby={`archive-${id}`} className="class-panel__section">
          <h3 id={`archive-${id}`}>{detail.archived ? 'Archived class' : 'End of year'}</h3>
          {confirming === 'archive' ? (
            <div className="chess-confirm" role="group" aria-label="Confirm archive">
              <p>
                Archive {detail.name}? It leaves the teachers’ lists and its code stops working. Students keep their points and progress,
                and nothing is deleted.
              </p>
              <div className="person-panel__actions">
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() =>
                    void act(async () => {
                      await archiveClass(id, true);
                      return `${detail.name} is archived.`;
                    })
                  }
                >
                  Yes, archive it
                </button>
                <button type="button" className="button button--light-outline" onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : detail.archived ? (
            <button
              type="button"
              className="button button--light-outline"
              onClick={() =>
                void act(async () => {
                  await archiveClass(id, false);
                  return `${detail.name} is back.`;
                })
              }
            >
              Bring this class back
            </button>
          ) : (
            <button type="button" className="button button--light-outline" onClick={() => setConfirming('archive')}>
              📦 Archive this class
            </button>
          )}
        </section>
      )}

      <p role="status" className="teacher__status">
        {status}
      </p>
    </div>
  );
}

function ModePicker({
  name,
  label,
  value,
  disabled,
  compact,
  onChange,
}: {
  name: string;
  label: string;
  value: WarpMode;
  disabled?: boolean;
  compact?: boolean;
  onChange: (mode: WarpMode) => void;
}) {
  return (
    <fieldset className={`level-picker${compact ? ' level-picker--compact' : ''}`} disabled={disabled}>
      <legend>{label}</legend>
      <div className="level-picker__options">
        {MODES.map((m) => (
          <label key={m.value} className="level-picker__option">
            <input type="radio" name={name} checked={value === m.value} onChange={() => onChange(m.value)} />
            <span>
              <strong>{m.label}</strong>
              {!compact && <>: {m.detail}</>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
