/**
 * The Students tab (/teacher/:classId/students; docs/TEACHER-VIEW-PLAN.md, section 4.3, stage 4): the class roster, one row per
 * student, sortable, with a link to each student's page. "All my students" shows the old list (a school admin: the whole school,
 * teachers too), for finding someone who isn't in this class. The season resets sit underneath, as before.
 *
 * Every action is checked by the database, which refuses anyone who isn't a teacher, and a class they don't teach.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { whenPlayed } from '../components/MyGames';
import { fetchClassOverview, type RosterStudent } from '../data/classOverview';
import { FriendlyError } from '../data/profile';
import { fetchPeople, startNewSeason, type Person } from '../data/teacher';
import { ALL_GAMES } from '../games/registry';
import { share } from '../pages/TeacherQuestionSkips';
import { isTeacherFocus, skillList, skillShortLabel, type MathsFocus } from '../../shared/maths/focus';
import { DangerAction } from './Settings';
import { useTeacherClass } from './TeacherClass';
import '../pages/teacher-page.css';
import './students.css';

/** The words a teacher types to start a new season. The server checks them too. */
export const NEW_SEASON_WORDS = 'NEW SEASON';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

/** Where a student is on the maths ladder, in a few words. */
export function ladderText(focus: MathsFocus): string {
  const l = focus.ladder;
  if (!l) return '–';
  if (l.furthest) return skillShortLabel(l.furthest);
  if (l.placed === 'done' && l.placement) return skillShortLabel(l.placement);
  if (l.placed === 'skipped') return 'Warm-up skipped';
  return 'No warm-up yet';
}

/** Their focus now, in a few words: who picked it and what. */
export function focusText(focus: MathsFocus): string {
  if (focus.source === 'auto') return focus.ladder?.on ? 'Auto (ladder)' : 'None';
  const what = skillList(focus.skills);
  if (isTeacherFocus(focus)) return `${focus.source === 'teacher-class' ? 'Class' : focus.source === 'teacher-group' ? 'Group' : 'Just them'}: ${what}`;
  return `Own: ${what}`;
}

// ---------------------------------------------------------------- "Hide real names", remembered per teacher on this computer

const hideKey = (me: string) => `sgh-hide-real-names:${me}`;

export function useHideRealNames(me: string): [boolean, (hide: boolean) => void] {
  const [hide, setHide] = useState(() => {
    try {
      return localStorage.getItem(hideKey(me)) === '1';
    } catch {
      return false;
    }
  });
  // Another teacher signing in on this computer gets their own choice.
  useEffect(() => {
    try {
      setHide(localStorage.getItem(hideKey(me)) === '1');
    } catch {
      setHide(false);
    }
  }, [me]);
  const change = useCallback(
    (next: boolean) => {
      setHide(next);
      try {
        if (next) localStorage.setItem(hideKey(me), '1');
        else localStorage.removeItem(hideKey(me));
      } catch {
        // Not remembered: it still works for this visit.
      }
    },
    [me],
  );
  return [hide, change];
}

// ---------------------------------------------------------------- the tab

export function TeacherStudents() {
  const { profile } = useAuth();
  const { classId, current } = useTeacherClass();
  const [params, setParams] = useSearchParams();
  const [hideReal, setHideReal] = useHideRealNames(profile?.id ?? '');
  // Set by the student page after a delete, which comes back here.
  const notice = (useLocation().state as { notice?: string } | null)?.notice ?? null;
  if (!profile || !classId || !current) return null;
  const isAdmin = profile.school_admin === true;
  const showAll = params.get('show') === 'all';
  const show = (all: boolean) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (all) next.set('show', 'all');
        else next.delete('show');
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <div className="students-bar">
        <div className="students-show" role="group" aria-label="Show">
          <button type="button" className="students-show__choice" aria-pressed={!showAll} onClick={() => show(false)}>
            {current.name}
          </button>
          <button type="button" className="students-show__choice" aria-pressed={showAll} onClick={() => show(true)}>
            {isAdmin ? 'Whole school' : 'All my students'}
          </button>
        </div>
        <label className="students-hide">
          <input type="checkbox" checked={hideReal} onChange={(e) => setHideReal(e.target.checked)} />
          Hide real names
        </label>
      </div>
      {notice && (
        <p role="status" className="panel students__notice">
          {notice}
        </p>
      )}
      {showAll ? (
        <AllStudents key="all" classId={classId} me={profile.id} isAdmin={isAdmin} hideReal={hideReal} />
      ) : (
        <ClassRoster key={classId} classId={classId} name={current.name} hideReal={hideReal} />
      )}
      <Seasons isAdmin={isAdmin} />
    </>
  );
}

// ---------------------------------------------------------------- the class roster

type SortKey = 'name' | 'real' | 'active' | 'shown' | 'skipped' | 'ladder' | 'focus';
const SORT_KEYS: readonly SortKey[] = ['name', 'real', 'active', 'shown', 'skipped', 'ladder', 'focus'];

const skipShare = (s: RosterStudent) => (s.shown > 0 ? s.skipped / s.shown : -1);
const byText = (a: string, b: string) => a.localeCompare(b, 'en-NZ', { sensitivity: 'base', numeric: true });

function compare(key: SortKey, a: RosterStudent, b: RosterStudent): number {
  switch (key) {
    case 'name':
      return byText(a.name, b.name);
    case 'real':
      return byText(a.realName ?? '', b.realName ?? '');
    case 'active':
      // Never played sorts as the oldest.
      return Date.parse(a.lastActive ?? '1970-01-01') - Date.parse(b.lastActive ?? '1970-01-01');
    case 'shown':
      return a.shown - b.shown;
    case 'skipped':
      return skipShare(a) - skipShare(b);
    case 'ladder':
      return byText(ladderText(a.focus), ladderText(b.focus));
    case 'focus':
      return byText(focusText(a.focus), focusText(b.focus));
  }
}

/** Numbers and dates start with the biggest (newest) first; words start at A. */
const firstWay = (key: SortKey): 'ascending' | 'descending' => (['active', 'shown', 'skipped'].includes(key) ? 'descending' : 'ascending');

function ClassRoster({ classId, name, hideReal }: { classId: string; name: string; hideReal: boolean }) {
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [params, setParams] = useSearchParams();
  const asked = params.get('sort');
  // ?sort=quiet (from Today's "haven't played"): the students who were last active longest ago come first.
  const key: SortKey = asked === 'quiet' ? 'active' : SORT_KEYS.find((k) => k === asked) ?? 'name';
  const way = asked === 'quiet' ? 'ascending' : params.get('way') === 'down' ? 'descending' : params.get('way') === 'up' ? 'ascending' : firstWay(key);

  useEffect(() => {
    let current = true;
    fetchClassOverview(classId).then(
      (list) => current && setStudents(list),
      (error) => current && setFailed(errorText(error)),
    );
    return () => {
      current = false;
    };
  }, [classId]);

  function sortBy(next: SortKey) {
    const nextWay = next === key ? (way === 'ascending' ? 'descending' : 'ascending') : firstWay(next);
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        out.set('sort', next);
        out.set('way', nextWay === 'ascending' ? 'up' : 'down');
        return out;
      },
      { replace: true },
    );
  }

  const wanted = filter.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = (students ?? []).filter(
      (s) => s.name.toLowerCase().includes(wanted) || (!hideReal && (s.realName ?? '').toLowerCase().includes(wanted)),
    );
    const sign = way === 'ascending' ? 1 : -1;
    return list.sort((a, b) => sign * compare(key, a, b) || byText(a.name, b.name));
  }, [students, wanted, hideReal, key, way]);

  const head = (k: SortKey, label: string) => (
    <th scope="col" aria-sort={k === key ? way : undefined}>
      <button type="button" className="roster__sort" onClick={() => sortBy(k)}>
        {label}
        <span aria-hidden="true">{k === key ? (way === 'ascending' ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  );

  return (
    <section className="panel" aria-labelledby="roster-title">
      <h2 id="roster-title" className="panel__title">
        Students in {name}
        {students && <span className="panel__count">{students.length}</span>}
      </h2>
      <label className="teacher__filter">
        <span>Find a student</span>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={hideReal ? 'Player name' : 'Player name or real name'}
        />
      </label>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !students ? (
        <p className="panel__empty">Loading…</p>
      ) : students.length === 0 ? (
        <p className="panel__empty">No students have joined {name} yet. Share the class code from Class set-up.</p>
      ) : shown.length === 0 ? (
        <p className="panel__empty">No students match.</p>
      ) : (
        <div className="roster__scroll">
          <table className="stats-table roster">
            <caption className="sr-only">Students in {name}. Questions and skips are for the last 7 days.</caption>
            <thead>
              <tr>
                {head('name', 'Student')}
                {!hideReal && head('real', 'Real name')}
                {head('active', 'Last active')}
                {head('shown', 'Questions (7 days)')}
                {head('skipped', 'Skipped')}
                {head('ladder', 'Ladder')}
                {head('focus', 'Focus')}
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className={s.hidden ? 'is-hidden' : undefined}>
                  <th scope="row">
                    <Link to={s.id} className="roster__student">
                      <AvatarImage avatar={s.avatar} size={32} />
                      <span>{s.name}</span>
                    </Link>
                    {s.hidden && <span className="tag tag--hidden">Hidden</span>}
                  </th>
                  {!hideReal && <td>{s.realName ?? '–'}</td>}
                  <td>{s.lastActive ? whenPlayed(s.lastActive) : 'Not yet'}</td>
                  <td>{s.shown}</td>
                  <td>{share(s.skipped, s.shown)}</td>
                  <td>{ladderText(s.focus)}</td>
                  <td>{focusText(s.focus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- everyone the teacher may see

function AllStudents({ classId, me, isAdmin, hideReal }: { classId: string; me: string; isAdmin: boolean; hideReal: boolean }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let current = true;
    fetchPeople().then(
      (list) => current && setPeople(list),
      (error) => current && setFailed(errorText(error)),
    );
    return () => {
      current = false;
    };
  }, []);

  const wanted = filter.trim().toLowerCase();
  const shown = (people ?? []).filter(
    (p) => p.display_name.toLowerCase().includes(wanted) || (!hideReal && (p.real_name ?? '').toLowerCase().includes(wanted)),
  );
  const title = isAdmin ? 'Whole school' : 'All my students';

  return (
    <section className="panel" aria-labelledby="people-title">
      <h2 id="people-title" className="panel__title">
        {title}
        {people && <span className="panel__count">{people.length}</span>}
      </h2>
      <p className="students__note">
        {isAdmin ? 'Every student and teacher in the school.' : 'The students in every class you teach, and the school’s teachers.'}
      </p>
      <label className="teacher__filter">
        <span>Find a player</span>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={hideReal ? 'Player name' : 'Player name or real name'}
        />
      </label>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !people ? (
        <p className="panel__empty">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="panel__empty">No players match.</p>
      ) : (
        <ul className="people-list">
          {shown.map((person) => {
            const games = person.bot_games + person.friend_games;
            return (
              <li key={person.id} className={person.hidden ? 'is-hidden' : undefined}>
                <Link to={`/teacher/${classId}/students/${person.id}`} className="people-list__row">
                  <AvatarImage avatar={person.avatar} size={40} />
                  <span className="people-list__name">
                    {person.display_name}
                    {person.id === me && <span className="tag">You</span>}
                    {person.role === 'teacher' && <span className="tag tag--teacher">Teacher</span>}
                    {person.hidden && <span className="tag tag--hidden">Hidden</span>}
                    {!hideReal && person.real_name && <span className="people-list__real">{person.real_name}</span>}
                  </span>
                  <span className="people-list__games">
                    {games} game{games === 1 ? '' : 's'}
                  </span>
                  <span className="people-list__when">
                    {person.last_played ? `Last played ${whenPlayed(person.last_played).toLowerCase()}` : 'Not played yet'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- seasons and end of year

function Seasons({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin && !ALL_GAMES.some((game) => game.SeasonPanels)) return null;
  return (
    <>
      <h2 className="teacher__group-title">Seasons and end of year</h2>
      <p className="teacher__group-note">Resets that can’t be undone. Most are for the start of a new year.</p>
      <Suspense fallback={null}>{ALL_GAMES.map((game) => game.SeasonPanels && <game.SeasonPanels key={game.id} />)}</Suspense>
      {isAdmin && <NewSeason />}
    </>
  );
}

function NewSeason() {
  const [status, setStatus] = useState<string | null>(null);

  async function go(typed: string) {
    setStatus('Starting a new season…');
    try {
      const done = await startNewSeason(typed);
      setStatus(
        `Done. ${done.botGames} bot games, ${done.friendGames} games between students and ${done.gemKeepLevels ?? 0} Gem Keep levels were deleted, and everyone starts again from 0 points.`,
      );
    } catch (error) {
      setStatus(errorText(error));
      throw error;
    }
  }

  return (
    <section className="panel teacher__season" aria-labelledby="season-title">
      <h2 id="season-title" className="panel__title">
        End of year: start a new season
      </h2>
      <p>For the start of a new school year. It:</p>
      <ul>
        <li>
          <strong>deletes</strong> every finished game, and every point, level, badge, achievement and leaderboard place,
          and everyone’s Gem Keep progress and times-table records
        </li>
        <li>
          <strong>keeps</strong> every account, player name and avatar, the teachers, who is hidden, and games still being
          played
        </li>
      </ul>
      <p>
        It can’t be undone. Delete students who have left the school first (each one’s page, under Manage). To go ahead, type{' '}
        <strong>{NEW_SEASON_WORDS}</strong> in capitals.
      </p>
      <DangerAction label="Start a new season" words={NEW_SEASON_WORDS} onConfirm={go} />
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}
