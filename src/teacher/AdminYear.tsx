/**
 * Admin → End of year (/teacher/admin/year; docs/TEACHER-VIEW-PLAN.md, section 4.7): one checklist for the end of the school
 * year. Each step says what it will change and when it was last done, so a second admin doesn't run one twice. Every change goes
 * through a server function that also writes the log, so History can be trusted.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import {
  adminClansNewSeason,
  adminNewPointsSeason,
  archiveClasses,
  deleteLeavers,
  fetchAdminClasses,
  fetchAdminStudents,
  fetchAdminYear,
  markYearStep,
  type AdminClass,
  type AdminStudent,
  type AdminYear as Year,
  type YearAction,
  type YearStep,
} from '../data/admin';
import { FriendlyError } from '../data/profile';
import { DangerAction } from './Settings';
import { NEW_SEASON_WORDS, useHideRealNames } from './Students';
import '../pages/teacher-page.css';
import './students.css';
import './admin.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
const who = (s: YearStep) => s.byRealName ?? s.by;
const list = (names: string[]) => names.join(', ');

/** The new school year to start with: next year from October to December, otherwise this year. */
export function defaultNewYear(now = new Date()): number {
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

function LastDone({ step }: { step: YearStep | null }) {
  if (!step) return <p className="admin-year__last">Not done yet.</p>;
  const by = who(step);
  return <p className="admin-year__last">Last done {day(step.at)}{by ? ` by ${by}` : ''}.</p>;
}

/** What History says for one row. */
function whatHappened(action: YearAction, detail: Record<string, unknown>): string {
  const n = typeof detail.count === 'number' ? detail.count : 0;
  switch (action) {
    case 'classes':
      return 'marked next year’s classes done';
    case 'archive':
      return `archived ${plural(n, 'class', 'classes')}`;
    case 'leavers':
      return `deleted ${plural(n, 'student', 'students')}`;
    case 'points':
      return 'started a new points season';
    case 'fame':
      return typeof detail.season === 'number' ? `started Clan Quest fame season ${detail.season}` : 'started a Clan Quest fame season';
    case 'dragon':
      return 'marked Dragon Maths done';
  }
}

interface Loaded {
  year: Year;
  classes: AdminClass[];
  students: AdminStudent[];
}

export function AdminYear() {
  const { profile } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [newYear, setNewYear] = useState(() => String(defaultNewYear()));

  const reload = useCallback(async () => {
    try {
      const [year, classes, students] = await Promise.all([fetchAdminYear(), fetchAdminClasses(), fetchAdminStudents()]);
      setData({ year, classes, students });
      setFailed(null);
    } catch (error) {
      setFailed(errorText(error));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const yearNumber = /^\d{4}$/.test(newYear.trim()) ? Number(newYear.trim()) : null;

  return (
    <>
      <section className="panel" aria-labelledby="year-title">
        <h2 id="year-title" className="panel__title">
          End of year
        </h2>
        <p>Do these in order at the end of the school year. Each step says what it will change.</p>
        <label className="teacher__filter admin-year__year">
          <span>New school year</span>
          <input type="number" inputMode="numeric" value={newYear} onChange={(e) => setNewYear(e.target.value)} />
        </label>
      </section>
      {failed ? (
        <p className="panel panel__empty">{failed}</p>
      ) : !data ? (
        <p className="panel panel__empty">Loading…</p>
      ) : (
        <>
          <StepClasses data={data} year={yearNumber} reload={reload} />
          <StepArchive data={data} year={yearNumber} reload={reload} />
          <StepLeavers data={data} me={profile?.id ?? ''} reload={reload} />
          <StepPoints data={data} reload={reload} />
          <StepFame data={data} reload={reload} />
          <StepDragon data={data} reload={reload} />
          <History year={data.year} />
        </>
      )}
    </>
  );
}

type StepProps = { data: Loaded; reload: () => Promise<void> };

function Step({ n, title, id, children, step }: { n: number; title: string; id: string; children: ReactNode; step: YearStep | null }) {
  return (
    <section className="panel admin-year__step" aria-labelledby={id}>
      <h2 id={id} className="panel__title">
        {n}. {title}
      </h2>
      <LastDone step={step} />
      {children}
    </section>
  );
}

const Status = ({ text }: { text: string | null }) => (
  <p role="status" className="teacher__status">
    {text}
  </p>
);

// ---------------------------------------------------------------- 1. next year's classes

/** Runs a step's action, says what happened, and reloads. */
function useRunner(reload: () => Promise<void>) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(working: string, task: () => Promise<string>) {
    setBusy(true);
    setStatus(working);
    try {
      setStatus(await task());
      await reload();
    } catch (error) {
      setStatus(errorText(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }
  return { status, busy, run };
}

function StepClasses({ data, year, reload }: StepProps & { year: number | null }) {
  const { status, busy, run } = useRunner(reload);
  const next = data.classes.filter((c) => !c.archived && c.schoolYear === year);
  return (
    <Step n={1} title="Next year’s classes" id="year-classes" step={data.year.steps.classes}>
      <p>
        {next.length > 0 ? `${plural(next.length, 'class', 'classes')} for ${year}: ${list(next.map((c) => c.name))}.` : `No classes for ${year ?? 'that year'} yet.`}
      </p>
      <div className="admin__actions">
        <Link to="/teacher/admin/classes" className="button button--light-outline">
          Make classes on the Classes tab
        </Link>
        <button
          type="button"
          className="button button--light-outline"
          disabled={busy}
          onClick={() => void run('Saving…', async () => (await markYearStep('classes'), 'Marked as done.')).catch(() => {})}
        >
          Mark as done
        </button>
      </div>
      <Status text={status} />
    </Step>
  );
}

// ---------------------------------------------------------------- 2. archive last year's classes

function StepArchive({ data, year, reload }: StepProps & { year: number | null }) {
  const { status, busy, run } = useRunner(reload);
  const old = useMemo(
    () => data.classes.filter((c) => !c.archived && year !== null && c.schoolYear !== null && c.schoolYear < year),
    [data.classes, year],
  );
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const chosen = old.filter((c) => !unticked.has(c.id));
  const toggle = (id: string) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Step n={2} title="Archive last year’s classes" id="year-archive" step={data.year.steps.archive}>
      {old.length === 0 ? (
        <p>No classes from before {year ?? 'that year'}.</p>
      ) : (
        <>
          <p>
            Students in an archived class can’t play class games until they’re in a new class. You can unarchive on the Classes
            tab.
          </p>
          <ul className="admin-year__list">
            {old.map((c) => (
              <li key={c.id}>
                <label className="admin-year__check">
                  <input type="checkbox" checked={!unticked.has(c.id)} onChange={() => toggle(c.id)} />
                  <span>
                    {c.name} ({c.schoolYear}, {plural(c.students, 'student', 'students')})
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="admin__actions">
            <button
              type="button"
              className="button button--light-outline"
              disabled={chosen.length === 0 || busy}
              onClick={() =>
                void run('Archiving…', async () => {
                  const n = await archiveClasses(chosen.map((c) => c.id));
                  return `Archived ${plural(n, 'class', 'classes')}.`;
                }).catch(() => {})
              }
            >
              Archive {plural(chosen.length, 'class', 'classes')}
            </button>
          </div>
        </>
      )}
      <Status text={status} />
    </Step>
  );
}

// ---------------------------------------------------------------- 3. students who have left

function StepLeavers({ data, me, reload }: StepProps & { me: string }) {
  const { status, run } = useRunner(reload);
  const [hideReal, setHideReal] = useHideRealNames(me);
  const leavers = useMemo(() => data.students.filter((s) => !s.classId || s.classArchived), [data.students]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  // Only students still in the list can be ticked (a reload may have removed some).
  const ids = leavers.filter((s) => ticked.has(s.id)).map((s) => s.id);
  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Step n={3} title="Students who have left" id="year-leavers" step={data.year.steps.leavers}>
      <p>Move anyone who is staying into a class first (Admin → Students).</p>
      {leavers.length === 0 ? (
        <p>No students without a class.</p>
      ) : (
        <>
          <div className="admin__actions">
            <button type="button" className="button button--light-outline admin__small" onClick={() => setTicked(new Set(leavers.map((s) => s.id)))}>
              Tick all
            </button>
            <button type="button" className="button button--light-outline admin__small" onClick={() => setTicked(new Set())}>
              Untick all
            </button>
            <label className="students-hide">
              <input type="checkbox" checked={hideReal} onChange={(e) => setHideReal(e.target.checked)} />
              Hide real names
            </label>
          </div>
          <ul className="admin-year__list">
            {leavers.map((s) => (
              <li key={s.id}>
                <label className="admin-year__check">
                  <input type="checkbox" checked={ticked.has(s.id)} onChange={() => toggle(s.id)} />
                  <span>
                    {s.name}
                    {!hideReal && s.realName ? `, ${s.realName}` : ''}
                    {' · '}
                    {s.className ? `${s.className} (archived)` : 'No class'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="admin-year__danger">
            <p>Deleting a student deletes their account and everything they’ve played. It can’t be undone.</p>
            {ids.length > 0 ? (
              <DangerAction
                key={ids.length}
                label={`Delete ${plural(ids.length, 'student', 'students')}`}
                words={String(ids.length)}
                prompt={`Type ${ids.length} to confirm`}
                onConfirm={async (typed) => {
                  await run('Deleting…', async () => {
                    const n = await deleteLeavers(ids, typed);
                    setTicked(new Set());
                    return `Deleted ${plural(n, 'student', 'students')}.`;
                  });
                }}
              />
            ) : (
              <p>Tick the students to delete.</p>
            )}
          </div>
        </>
      )}
      <Status text={status} />
    </Step>
  );
}

// ---------------------------------------------------------------- 4. new points season

function StepPoints({ data, reload }: StepProps) {
  const { status, run } = useRunner(reload);
  return (
    <Step n={4} title="New points season" id="year-points" step={data.year.steps.points}>
      <p>For the start of a new school year. It:</p>
      <ul>
        <li>
          <strong>deletes</strong> every finished game, and every point, level, badge, achievement and leaderboard place, and
          everyone’s Gem Keep progress and times-table records
        </li>
        <li>
          <strong>keeps</strong> every account, player name and avatar, the teachers, who is hidden, and games still being played
        </li>
      </ul>
      <p>
        It can’t be undone. To go ahead, type <strong>{NEW_SEASON_WORDS}</strong> in capitals.
      </p>
      <DangerAction
        label="Start a new season"
        words={NEW_SEASON_WORDS}
        onConfirm={(typed) =>
          run('Starting a new season…', async () => {
            const done = await adminNewPointsSeason(typed);
            return `Done. ${done.botGames} bot games, ${done.friendGames} games between students and ${done.gemKeepLevels ?? 0} Gem Keep levels were deleted, and everyone starts again from 0 points.`;
          })
        }
      />
      <Status text={status} />
    </Step>
  );
}

// ---------------------------------------------------------------- 5. Clan Quest fame season

function StepFame({ data, reload }: StepProps) {
  const { status, run } = useRunner(reload);
  return (
    <Step n={5} title="Clan Quest fame season" id="year-fame" step={data.year.steps.fame}>
      <p>
        Sets every clan’s fame to 0 for every pupil in a current class. Clans, gold, levels and achievements stay. Do this after
        students are in their new classes.
      </p>
      <p>
        It can’t be undone. To go ahead, type <strong>{NEW_SEASON_WORDS}</strong> in capitals.
      </p>
      <DangerAction
        label="Start a new fame season"
        words={NEW_SEASON_WORDS}
        onConfirm={(typed) =>
          run('Starting a new season…', async () => {
            const done = await adminClansNewSeason(typed);
            return `Season ${done.season} has begun.`;
          })
        }
      />
      <Status text={status} />
    </Step>
  );
}

// ---------------------------------------------------------------- 6. Dragon Maths season

function StepDragon({ data, reload }: StepProps) {
  const { status, busy, run } = useRunner(reload);
  return (
    <Step n={6} title="Dragon Maths season" id="year-dragon" step={data.year.steps.dragon}>
      <p>
        Each class sets its own Dragon Maths season start on its Games tab for now. One date for the whole school is coming.
      </p>
      <div className="admin__actions">
        <button
          type="button"
          className="button button--light-outline"
          disabled={busy}
          onClick={() => void run('Saving…', async () => (await markYearStep('dragon'), 'Marked as done.')).catch(() => {})}
        >
          Mark as done
        </button>
      </div>
      <Status text={status} />
    </Step>
  );
}

// ---------------------------------------------------------------- history

function History({ year }: { year: Year }) {
  return (
    <section className="panel" aria-labelledby="year-history">
      <h2 id="year-history" className="panel__title">
        History
      </h2>
      {year.log.length === 0 ? (
        <p className="panel__empty">Nothing yet.</p>
      ) : (
        <ul className="admin-year__history">
          {year.log.map((row, i) => (
            <li key={i}>
              {day(row.at)}, {who(row) ?? 'someone'}: {whatHappened(row.action, row.detail)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
