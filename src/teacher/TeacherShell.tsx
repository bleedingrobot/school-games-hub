/**
 * The teacher area (docs/TEACHER-VIEW-PLAN.md, section 4.1, stage 1): one header and one class for every teacher page, with the
 * class in the address so links and the back button keep it.
 *
 *   /teacher/:classId            Today
 *   /teacher/:classId/students   Students (today's Players list)
 *   /teacher/:classId/maths      Maths: Focus, Skill map, Skipped questions
 *   /teacher/:classId/games      Games (the Games table; /games/:gameId is a game's settings on a narrow screen)
 *   /teacher/:classId/setup      Class set-up (the class's My classes panel)
 *   /teacher/admin               Admin (school admins only; a placeholder for now)
 *
 * The old addresses (/teacher, /classes, /focus?class=, /skills?class=) land on the remembered class through TeacherEntry.
 * The pages hide themselves from students, but that's only for tidiness: the database checks every action.
 */
import { useCallback, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { fetchClasses, type ClassSummary } from '../data/classes';
import { MyClasses } from '../pages/MyClasses';
import { prettyCode } from '../../shared/multiplayer';
import { mineFirst, rememberedClass, TeacherClassPicker, TeacherClassProvider, useTeacherClass } from './TeacherClass';
import './teacher-shell.css';

function TeachersOnly() {
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

/** The part of the address after the class ("", "maths/skills", "setup"…), so switching class keeps the tab. */
function sectionOf(pathname: string): string {
  const parts = pathname.replace(/\/+$/, '').split('/').slice(3);
  return parts.join('/');
}

const pathFor = (classId: string, section = '') => `/teacher/${classId}${section ? `/${section}` : ''}`;

/** Layout route for /teacher/:classId/* and /teacher/admin. */
export function TeacherShell() {
  const { profile } = useAuth();
  const { classId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onPick = useCallback(
    (id: string) => navigate(pathFor(id, classId ? sectionOf(pathname) : '')),
    [navigate, classId, pathname],
  );
  if (profile?.role !== 'teacher') return <TeachersOnly />;
  return (
    <TeacherClassProvider chosen={classId ?? null} onPick={onPick}>
      <ShellBody inAddress={classId ?? null} mode={classId ? 'class' : 'admin'} isAdmin={profile.school_admin === true} />
    </TeacherClassProvider>
  );
}

/** 'class': /teacher/:classId; 'admin': /teacher/admin; 'entry': /teacher with no class yet (opens the first one made). */
type ShellMode = 'class' | 'admin' | 'entry';

function ShellBody({ inAddress, mode, isAdmin }: { inAddress: string | null; mode: ShellMode; isAdmin: boolean }) {
  const { ready, classes, classId, failed } = useTeacherClass();
  const { pathname } = useLocation();
  if (!ready) {
    return (
      <p className="teacher__classes-link" role="status">
        Loading…
      </p>
    );
  }
  if (classes.length === 0) return <NoClass failed={failed} />;
  // A class that isn't in the list (archived, someone else's, a typo) opens the remembered one instead, on the same tab.
  if (mode === 'entry') return <Navigate to={pathFor(classId!)} replace />;
  if (inAddress && inAddress !== classId) return <Navigate to={pathFor(classId!, sectionOf(pathname))} replace />;
  return (
    <div className="teacher teacher-shell">
      <TeacherHeader isAdmin={isAdmin} />
      <Outlet />
    </div>
  );
}

function TeacherHeader({ isAdmin }: { isAdmin: boolean }) {
  const { current, classId } = useTeacherClass();
  if (!current || !classId) return null;
  const tabs = [
    { to: pathFor(classId), label: 'Today', end: true },
    { to: pathFor(classId, 'students'), label: 'Students' },
    { to: pathFor(classId, 'maths'), label: 'Maths' },
    { to: pathFor(classId, 'games'), label: 'Games' },
    { to: pathFor(classId, 'setup'), label: 'Class set-up' },
  ];
  return (
    <header className="teacher-head">
      <div className="teacher-head__top">
        <h1 className="teacher-head__name">
          {current.name}
          {!current.teaching && (
            <>
              {' '}
              <span className="teacher-head__not-mine">(not mine)</span>
            </>
          )}
        </h1>
        <TeacherClassPicker />
      </div>
      <p className="teacher-head__facts">
        <span>
          {current.members} student{current.members === 1 ? '' : 's'}
        </span>
        <span>
          Code {prettyCode(current.warp_code)}
          {current.warp_mode === 'off' ? ' (off)' : current.warp_mode === 'ask' ? ' (asks you first)' : ''}
        </span>
      </p>
      <nav className="teacher-tabs" aria-label="Teacher pages">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="teacher-tabs__tab">
            {t.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/teacher/admin" className="teacher-tabs__tab teacher-tabs__tab--admin">
            Admin
          </NavLink>
        )}
      </nav>
    </header>
  );
}

/** A teacher with no class yet: make one (today's My classes page). */
function NoClass({ failed }: { failed: string | null }) {
  const { reload } = useTeacherClass();
  return (
    <>
      <p className="teacher__classes-link teacher-shell__no-class" role="status">
        {failed ?? 'You don’t teach a class yet.'} Make one below, then share its code with your students.
      </p>
      <MyClasses onChanged={() => void reload()} />
    </>
  );
}

/**
 * /teacher, and the old /classes, /focus and /skills: open the class named in the address (?class=), else the one this visit
 * last used, else the first class I teach, on the right tab. Anything else in the address (a skill map's ?student= and
 * ?skill=) comes along.
 */
export function TeacherEntry({ section = '' }: { section?: string }) {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const named = params.get('class');
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const teacher = profile?.role === 'teacher';

  useEffect(() => {
    if (!teacher || named) return;
    let current = true;
    fetchClasses().then(
      (list) => current && setClasses(list),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [teacher, named]);

  if (!teacher) return <TeachersOnly />;
  const rest = new URLSearchParams(params);
  rest.delete('class');
  const search = rest.toString() ? `?${rest}` : '';
  if (named) return <Navigate to={`${pathFor(named, section)}${search}`} replace />;
  if (failed) return <TeacherShellWithoutClass />;
  if (!classes) {
    return (
      <p className="teacher__classes-link" role="status">
        Loading…
      </p>
    );
  }
  const sorted = mineFirst(classes);
  const target = sorted.find((c) => c.id === rememberedClass()) ?? sorted[0];
  if (!target) return <TeacherShellWithoutClass />;
  return <Navigate to={`${pathFor(target.id, section)}${search}`} replace />;
}

/** No class to open: the shell shows the no-class page (and says why, if the list couldn't load). */
function TeacherShellWithoutClass() {
  return (
    <TeacherClassProvider>
      <ShellBody inAddress={null} mode="entry" isAdmin={false} />
    </TeacherClassProvider>
  );
}

/** The Maths tab's own tabs. */
export function TeacherMaths() {
  const { classId } = useTeacherClass();
  if (!classId) return null;
  return (
    <>
      <nav className="teacher-subtabs" aria-label="Maths">
        <NavLink to={pathFor(classId, 'maths')} end className="teacher-subtabs__tab">
          Focus
        </NavLink>
        <NavLink to={pathFor(classId, 'maths/skills')} className="teacher-subtabs__tab">
          Skill map
        </NavLink>
        <NavLink to={pathFor(classId, 'maths/skips')} className="teacher-subtabs__tab">
          Skipped questions
        </NavLink>
      </nav>
      <Outlet />
    </>
  );
}

/** /teacher/admin: school admins only (section 4.7). Stage 6 fills it in. */
export function TeacherAdmin() {
  const { profile } = useAuth();
  if (profile?.school_admin !== true) {
    return (
      <section className="panel">
        <h2 className="panel__title">Admin</h2>
        <p className="panel__empty">This page is for school admins.</p>
      </section>
    );
  }
  return (
    <section className="panel" aria-labelledby="admin-title">
      <h2 id="admin-title" className="panel__title">
        Admin
      </h2>
      <p>
        Jobs for the whole school will live here: every class and student, teachers and school admins, school game settings, safety,
        and the end of year. For now, the whole-school Players list and the new points season are on the Students tab.
      </p>
    </section>
  );
}
