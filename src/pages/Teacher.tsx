import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { RankBadge } from '../components/Progress';
import { FriendlyError } from '../data/profile';
import {
  deletePerson,
  fetchPeople,
  fetchPersonDetail,
  renamePerson,
  setHidden,
  setRole,
  startNewSeason,
  type Person,
  type PersonDetail,
} from '../data/teacher';
import { ALL_GAMES, gameLabel } from '../games/registry';
import { DangerAction } from '../teacher/Settings';
import { BOT_LEVELS, type BotLevel } from '../games/types';
import { BOT_NAMES, placeLabel } from '../../shared/space/names';
import { whenPlayed } from './Dashboard';
import './teacher-page.css';

// Each game's part of a student's panel comes from its GameDefinition (teacher.StudentPanel, or the old StudentPanel), loaded separately.
// The warm-up reset brings the maths ladder with it, so it loads with the student's panel, not with the page.
const PlacementReset = lazy(() => import('../maths/PlacementReset').then((m) => ({ default: m.PlacementReset })));

/** The words a teacher types to start a new season. The server checks them too. */
export const NEW_SEASON_WORDS = 'NEW SEASON';

function errorText(error: unknown) {
  return error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.';
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
            {ALL_GAMES.map((game) => {
              const Panel = game.teacher ? game.teacher.StudentPanel : game.StudentPanel;
              return Panel && <Panel key={game.id} student={person.id} />;
            })}
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
            onClick={() => setConfirming('delete')}
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
          <DangerAction
            label="Delete forever"
            words={person.display_name}
            prompt="Type their player name to confirm"
            ignoreCase
            onConfirm={() =>
              act(async () => {
                await deletePerson(person.id);
                return `${person.display_name} has been deleted.`;
              }, onDeleted)
            }
            onCancel={() => setConfirming(null)}
          />
        </div>
      )}

      <p role="status" className="teacher__status">
        {status}
      </p>
    </div>
  );
}

function NewSeason({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<string | null>(null);

  async function go(typed: string) {
    setStatus('Starting a new season…');
    try {
      const done = await startNewSeason(typed);
      setStatus(
        `Done. ${done.botGames} bot games, ${done.friendGames} games between students and ${done.gemKeepLevels ?? 0} Gem Keep levels were deleted, and everyone starts again from 0 points.`,
      );
      onDone();
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
        It can’t be undone. Delete students who have left the school first (above), one by one. To go ahead, type{' '}
        <strong>{NEW_SEASON_WORDS}</strong> in capitals.
      </p>
      <DangerAction label="Start a new season" words={NEW_SEASON_WORDS} onConfirm={go} />
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}
