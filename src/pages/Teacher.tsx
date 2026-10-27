import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { RankBadge } from '../components/Progress';
import { fetchMathsSwitch } from '../data/spaceGames';
import { FriendlyError } from '../data/profile';
import {
  deletePerson,
  fetchPeople,
  fetchPersonDetail,
  renamePerson,
  setHidden,
  setSpaceMaths,
  setRole,
  startNewSeason,
  type Person,
  type PersonDetail,
} from '../data/teacher';
import { ALL_GAMES, gameLabel } from '../games/registry';
import { useTeacherClass } from '../teacher/TeacherClass';
import { BOT_LEVELS, type BotLevel, type GameDefinition } from '../games/types';
import type { MathsSwitch } from '../../shared/space/mathsSwitch';
import { BOT_NAMES, placeLabel } from '../../shared/space/names';
import { whenPlayed } from './Dashboard';
import './teacher-page.css';

// Each game's own teacher panels come from its GameDefinition (TeacherPanels, StudentPanel), loaded separately.
// The warm-up reset brings the maths ladder with it, so it loads with the student's panel, not with the page.
const PlacementReset = lazy(() => import('../maths/PlacementReset').then((m) => ({ default: m.PlacementReset })));

/** The words a teacher types to start a new season. The server checks them too. */
export const NEW_SEASON_WORDS = 'NEW SEASON';

function errorText(error: unknown) {
  return error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.';
}

/**
 * The Games tab (/teacher/:classId/games): each game's own panels for the header's class, folded away until opened. The class
 * comes from the teacher shell (src/teacher/TeacherShell.tsx) through useTeacherClass().
 */
export function TeacherGames() {
  return (
    <>
      <p className="teacher__group-note">Open a game to see and change its settings for this class.</p>
      {ALL_GAMES.map((game) => {
        const Panels = game.id === 'space' ? MathsSwitchPanel : game.TeacherPanels;
        return (
          Panels && (
            <GameSection key={game.id} game={game}>
              <Panels />
            </GameSection>
          )
        );
      })}
    </>
  );
}

/**
 * The Students tab (/teacher/:classId/students): today's Players list (still the whole school until stage 4), then the season
 * resets. Every action is checked by the database, which refuses anyone who isn't a teacher.
 */
export function TeacherStudents() {
  const { profile } = useAuth();
  if (!profile) return null;
  return <StudentsView me={profile.id} isAdmin={profile.school_admin === true} />;
}

function StudentsView({ me, isAdmin }: { me: string; isAdmin: boolean }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPeople(await fetchPeople());
      setFailed(null);
    } catch (error) {
      setFailed(errorText(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const wanted = filter.trim().toLowerCase();
  const shown = (people ?? []).filter(
    (p) => p.display_name.toLowerCase().includes(wanted) || (p.real_name ?? '').toLowerCase().includes(wanted),
  );

  return (
    <>
      <section className="panel" aria-labelledby="people-title">
        <h2 id="people-title" className="panel__title">
          Players (whole school)
          {people && <span className="panel__count">{people.length}</span>}
        </h2>
        <label className="teacher__filter">
          <span>Find a player</span>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Player name or real name" />
        </label>
        {failed ? (
          <p className="panel__empty">{failed}</p>
        ) : !people ? (
          <p className="panel__empty">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="panel__empty">No players match.</p>
        ) : (
          <ul className="people-list">
            {shown.map((person) => (
              <li key={person.id} className={person.hidden ? 'is-hidden' : undefined}>
                <button
                  type="button"
                  className="people-list__row"
                  aria-expanded={open === person.id}
                  onClick={() => setOpen(open === person.id ? null : person.id)}
                >
                  <AvatarImage avatar={person.avatar} size={40} />
                  <span className="people-list__name">
                    {person.display_name}
                    {person.id === me && <span className="tag">You</span>}
                    {person.role === 'teacher' && <span className="tag tag--teacher">Teacher</span>}
                    {person.hidden && <span className="tag tag--hidden">Hidden</span>}
                    {person.real_name && <span className="people-list__real">{person.real_name}</span>}
                  </span>
                  <span className="people-list__games">
                    {person.bot_games + person.friend_games} game{person.bot_games + person.friend_games === 1 ? '' : 's'}
                  </span>
                  <span className="people-list__when">
                    {person.last_played ? `Last played ${whenPlayed(person.last_played).toLowerCase()}` : 'Not played yet'}
                  </span>
                </button>
                {open === person.id && (
                  <PersonPanel
                    person={person}
                    isMe={person.id === me}
                    canChangeRoles={isAdmin}
                    onChanged={() => void load()}
                    onDeleted={() => {
                      setOpen(null);
                      void load();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(isAdmin || ALL_GAMES.some((game) => game.SeasonPanels)) && (
        <>
          <h2 className="teacher__group-title">Seasons and end of year</h2>
          <p className="teacher__group-note">Resets that can’t be undone. Most are for the start of a new year.</p>
          <Suspense fallback={null}>
            {ALL_GAMES.map((game) => game.SeasonPanels && <game.SeasonPanels key={game.id} />)}
          </Suspense>
          {isAdmin && <NewSeason onDone={() => void load()} />}
        </>
      )}
    </>
  );
}

/**
 * One game's settings, folded away until the teacher opens it. The panels inside only mount (and ask the server for anything)
 * once opened, so the page no longer loads every game's settings and class tables on arrival.
 */
function GameSection({ game, children }: { game: GameDefinition; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="teacher-game" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="teacher-game__summary">
        <game.Icon size={32} />
        <span>{game.name}</span>
      </summary>
      {open && (
        <div className="teacher-game__body">
          <Suspense fallback={<p className="panel__empty">Loading…</p>}>{children}</Suspense>
        </div>
      )}
    </details>
  );
}

const MATHS_CHOICES: { value: MathsSwitch; label: string; detail: string }[] = [
  { value: 'off', label: 'Off', detail: 'No maths questions in space games. Nothing else changes.' },
  { value: 'choose', label: 'Students choose', detail: 'Each student picks maths on or off when they set up a game.' },
  { value: 'on', label: 'On for everyone', detail: 'Every space game has maths questions, with no way to turn them off.' },
];

/**
 * Mission Control maths in Wormholes & Black Holes (docs/SPACE-MATHS-PLAN.md), for the picked class.
 * The server checks this too, so nobody can start or save a maths game while it's off.
 */
export function MathsSwitchPanel() {
  const { classId, ready } = useTeacherClass();
  const [mode, setMode] = useState<MathsSwitch | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setMode(null);
    setStatus(null);
    fetchMathsSwitch(classId)
      .then(setMode)
      .catch(() => setStatus('We couldn’t load this setting.'));
  }, [ready, classId]);

  async function change(next: MathsSwitch) {
    setStatus('Saving…');
    try {
      await setSpaceMaths(next, classId);
      setMode(next);
      setStatus(`Mission Control maths: ${MATHS_CHOICES.find((c) => c.value === next)?.label}.`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel teacher__switch" aria-labelledby="maths-title">
      <h2 id="maths-title" className="panel__title">
        Mission Control maths in space games
      </h2>
      <p>
        Times-table questions at wormholes and black holes, and a question after each turn. They use each student’s own
        times-table records, and what they answer goes into those records. A wrong answer never costs a student anything.
      </p>
      {mode !== null && (
        <fieldset className="level-picker">
          <legend>Who gets the questions</legend>
          <div className="level-picker__options">
            {MATHS_CHOICES.map((choice) => (
              <label key={choice.value} className="level-picker__option">
                <input type="radio" name="space-maths-switch" checked={mode === choice.value} onChange={() => void change(choice.value)} />
                <span>
                  <strong>{choice.label}:</strong> {choice.detail}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}

type Confirming = 'rename' | 'role' | 'delete' | null;

function PersonPanel({
  person,
  isMe,
  canChangeRoles,
  onChanged,
  onDeleted,
}: {
  person: Person;
  isMe: boolean;
  /** Only a school admin makes (or un-makes) teachers; the database checks it too. */
  canChangeRoles: boolean;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let current = true;
    fetchPersonDetail(person.id)
      .then((d) => current && setDetail(d))
      .catch((error) => current && setStatus(errorText(error)));
    return () => {
      current = false;
    };
  }, [person.id]);

  async function act(work: () => Promise<string>, after: () => void = onChanged) {
    setStatus('Saving…');
    setConfirming(null);
    try {
      setStatus(await work());
      after();
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  const makingTeacher = person.role !== 'teacher';
  const nameMatches = typed.trim().toLowerCase() === person.display_name.toLowerCase();

  return (
    <div className="person-panel">
      {detail ? (
        <>
          <p className="person-panel__summary">
            Level {detail.level} · {detail.points} points
          </p>
          <table className="stats-table person-panel__stats">
            <caption>Games</caption>
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Against</th>
                <th scope="col">Played</th>
                <th scope="col">Won</th>
                <th scope="col">Lost</th>
                <th scope="col">Draw</th>
                <th scope="col">Left early</th>
              </tr>
            </thead>
            <tbody>
              {detail.games.flatMap((g) =>
                (['bot', 'friend'] as const).map((kind) => (
                  <tr key={`${g.game}-${kind}`}>
                    <th scope="row">{kind === 'bot' ? gameLabel(g.game) : ''}</th>
                    <td>{kind === 'bot' ? 'Bots' : 'Friends'}</td>
                    <td>{g[kind].played}</td>
                    <td>{g[kind].won}</td>
                    <td>{g[kind].lost}</td>
                    <td>{g[kind].drawn}</td>
                    <td>{g[kind].left}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
          <p className="person-panel__badges">
            {detail.games.map((g) => (
              <span key={g.game}>
                {g.rank ? <RankBadge rank={g.rank} game={g.game} /> : gameLabel(g.game)}: {g.achievements} achievement
                {g.achievements === 1 ? '' : 's'}
              </span>
            ))}
          </p>
          {detail.recent.length > 0 && (
            <ul className="recent-list person-panel__recent" aria-label="Recent games">
              {detail.recent.map((r, i) => (
                <li key={i}>
                  {r.game === 'space' ? (
                    <span className={`result result--${r.place === 1 ? 'won' : 'drawn'}`}>{placeLabel(r.place)}</span>
                  ) : (
                    <span className={`result result--${r.result}`}>
                      {r.result === 'won' ? 'Won' : r.result === 'lost' ? 'Lost' : 'Draw'}
                    </span>
                  )}
                  <span className="recent-list__what">
                    {gameLabel(r.game)} vs{' '}
                    {r.kind !== 'bot'
                      ? r.against
                      : r.game === 'space'
                        ? `${BOT_NAMES[r.against as BotLevel] ?? ''} bots`
                        : `${BOT_LEVELS.find((l) => l.id === r.against)?.label ?? ''} bot${r.game === '101' ? 's' : ''}`}
                    {r.reason === 'abandoned' && <span className="recent-list__note"> (left early)</span>}
                  </span>
                  <span className="recent-list__when">{whenPlayed(r.finished_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <Suspense fallback={null}>
            {person.role === 'student' && <PlacementReset student={person.id} name={person.display_name} />}
            {ALL_GAMES.map((game) => game.StudentPanel && <game.StudentPanel key={game.id} student={person.id} />)}
          </Suspense>
        </>
      ) : (
        !status && <p className="panel__empty">Loading…</p>
      )}

      <div className="person-panel__actions">
        <button type="button" className="button button--light-outline" onClick={() => setConfirming('rename')}>
          🔀 New name
        </button>
        <button
          type="button"
          className="button button--light-outline"
          onClick={() =>
            void act(async () => {
              await setHidden(person.id, !person.hidden);
              return person.hidden
                ? `${person.display_name} is back on the leaderboards and in the lobby.`
                : `${person.display_name} is now hidden from leaderboards and the lobby, and can’t play friends.`;
            })
          }
        >
          {person.hidden ? '👁️ Show again' : '🙈 Hide'}
        </button>
        {!isMe && canChangeRoles && (
          <button type="button" className="button button--light-outline" onClick={() => setConfirming('role')}>
            {makingTeacher ? '🧑‍🏫 Make teacher' : 'Remove teacher'}
          </button>
        )}
        {person.role !== 'teacher' && (
          <button
            type="button"
            className="button button--danger"
            onClick={() => {
              setTyped('');
              setConfirming('delete');
            }}
          >
            🗑️ Delete
          </button>
        )}
      </div>

      {confirming === 'rename' && (
        <div className="chess-confirm" role="group" aria-label="Confirm new name">
          <p>Give {person.display_name} a new random name? They can pick their own again from the word lists.</p>
          <div className="person-panel__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() =>
                void act(async () => `${person.display_name} is now ${await renamePerson(person.id)}.`)
              }
            >
              Yes, new name
            </button>
            <button type="button" className="button button--light-outline" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirming === 'role' && (
        <div className="chess-confirm" role="group" aria-label="Confirm teacher change">
          <p>
            {makingTeacher
              ? `Make ${person.display_name} a teacher? Teachers can see every player, rename, hide and delete students, and start a new season. Only do this for staff.`
              : `Stop ${person.display_name} being a teacher? They'll become an ordinary player.`}
          </p>
          <div className="person-panel__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() =>
                void act(async () => {
                  await setRole(person.id, makingTeacher ? 'teacher' : 'student');
                  return makingTeacher ? `${person.display_name} is now a teacher.` : `${person.display_name} is no longer a teacher.`;
                })
              }
            >
              {makingTeacher ? 'Yes, make teacher' : 'Yes, remove teacher'}
            </button>
            <button type="button" className="button button--light-outline" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirming === 'delete' && (
        <div className="chess-confirm" role="group" aria-label="Confirm delete">
          <p>
            This deletes {person.display_name}’s account and all their games, points and achievements. It can’t be
            undone. Friends they played keep those games, without their name. If they sign in again, they start fresh.
          </p>
          <label className="teacher__type">
            <span>Type their player name to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <div className="person-panel__actions">
            <button
              type="button"
              className="button button--danger"
              disabled={!nameMatches}
              onClick={() =>
                void act(async () => {
                  await deletePerson(person.id);
                  return `${person.display_name} has been deleted.`;
                }, onDeleted)
              }
            >
              Delete forever
            </button>
            <button type="button" className="button button--light-outline" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p role="status" className="teacher__status">
        {status}
      </p>
    </div>
  );
}

function NewSeason({ onDone }: { onDone: () => void }) {
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const ready = typed.trim() === NEW_SEASON_WORDS;

  async function go() {
    setStatus('Starting a new season…');
    try {
      const done = await startNewSeason(typed.trim());
      setTyped('');
      setStatus(
        `Done. ${done.botGames} bot games, ${done.friendGames} games between students and ${done.gemKeepLevels ?? 0} Gem Keep levels were deleted, and everyone starts again from 0 points.`,
      );
      onDone();
    } catch (error) {
      setStatus(errorText(error));
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
        It can’t be undone. Delete students who have left the school first (above), one by one. To go ahead, type{' '}
        <strong>{NEW_SEASON_WORDS}</strong> in capitals.
      </p>
      <label className="teacher__type">
        <span>Type {NEW_SEASON_WORDS}</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      <button type="button" className="button button--danger" disabled={!ready} onClick={() => void go()}>
        Start a new season
      </button>
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}
