/**
 * One student's page (/teacher/:classId/students/:studentId; docs/TEACHER-VIEW-PLAN.md, section 4.3, stage 4). A real page, so
 * it can be linked to and the back button works. In order:
 *
 *   Overview      level and points, their maths (ladder place, warm-up, focus) and the last 7 days' questions and skips
 *   Games         wins and losses against bots and friends, then one folded line per game they've played; a game's own panel
 *                 loads only when its line is opened
 *   Recent games
 *   Manage        new name, hide, move to another class, make teacher (school admins); then Delete, in a red box
 *
 * Every action is checked by the database, which refuses a student who isn't in one of the teacher's classes.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { RankBadge } from '../components/Progress';
import { whenPlayed } from '../components/MyGames';
import { fetchStudentCard, type StudentCard } from '../data/classOverview';
import { moveStudent } from '../data/classes';
import { FriendlyError } from '../data/profile';
import { deletePerson, fetchPersonDetail, renamePerson, setHidden, setRole, type PersonDetail } from '../data/teacher';
import { ALL_GAMES, gameLabel } from '../games/registry';
import { BOT_LEVELS, type BotLevel, type GameDefinition } from '../games/types';
import { share } from '../pages/TeacherQuestionSkips';
import { BOT_NAMES, placeLabel } from '../../shared/space/names';
import { DangerAction } from './Settings';
import { useTeacherClass } from './TeacherClass';
import { focusText, ladderText } from './Students';
import './students.css';

// The warm-up reset brings the maths ladder with it, so it loads with this page, not with the teacher area.
const PlacementReset = lazy(() => import('../maths/PlacementReset').then((m) => ({ default: m.PlacementReset })));

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function StudentPage() {
  const { studentId } = useParams();
  const { classId } = useTeacherClass();
  const { profile } = useAuth();
  const [card, setCard] = useState<StudentCard | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!studentId) return;
    let current = true;
    setFailed(null);
    fetchStudentCard(studentId).then(
      (c) => {
        if (!current) return;
        setCard(c);
        setFailed(null);
      },
      (error) => current && setFailed(errorText(error)),
    );
    return () => {
      current = false;
    };
  }, [studentId, version]);

  if (!studentId || !classId || !profile) return null;
  const back = (
    <p className="student-page__back">
      <Link to={`/teacher/${classId}/students`}>‹ Students</Link>
    </p>
  );
  if (failed) {
    return (
      <>
        {back}
        <section className="panel">
          <p className="panel__empty">{failed}</p>
        </section>
      </>
    );
  }
  if (!card || card.id !== studentId) {
    return (
      <>
        {back}
        <p className="teacher__classes-link" role="status">
          Loading…
        </p>
      </>
    );
  }
  return (
    <div className="student-page">
      {back}
      <header className="panel student-page__head">
        <AvatarImage avatar={card.avatar} size={64} />
        <div>
          <h2 className="student-page__name">
            {card.name}
            {card.id === profile.id && <span className="tag">You</span>}
            {card.role === 'teacher' && <span className="tag tag--teacher">Teacher</span>}
            {card.hidden && <span className="tag tag--hidden">Hidden</span>}
          </h2>
          <p className="student-page__facts">
            {card.realName && <span>{card.realName}</span>}
            {card.role === 'student' && (
              <span>{card.classes.length ? card.classes.map((c) => c.name).join(', ') : 'Not in a class'}</span>
            )}
          </p>
        </div>
      </header>
      <StudentDetail key={card.id} card={card} />
      <Manage
        key={`manage-${card.id}`}
        card={card}
        isMe={card.id === profile.id}
        canChangeRoles={profile.school_admin === true}
        onChanged={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}

/** Overview, Games and Recent games: everything that reads teacher_student_detail. */
function StudentDetail({ card }: { card: StudentCard }) {
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchPersonDetail(card.id).then(
      (d) => current && setDetail(d),
      (error) => current && setFailed(errorText(error)),
    );
    return () => {
      current = false;
    };
  }, [card.id]);

  return (
    <>
      <section className="panel" aria-labelledby="overview-title">
        <h2 id="overview-title" className="panel__title">
          Overview
        </h2>
        {detail ? (
          <p className="person-panel__summary">
            Level {detail.level} · {detail.points} points
          </p>
        ) : (
          <p className="panel__empty">{failed ?? 'Loading…'}</p>
        )}
        {card.focus && (
          <dl className="student-page__facts-list">
            <dt>Ladder</dt>
            <dd>{ladderText(card.focus)}</dd>
            <dt>Focus</dt>
            <dd>{focusText(card.focus)}</dd>
            <dt>Last 7 days</dt>
            <dd>
              {card.week.shown} question{card.week.shown === 1 ? '' : 's'}, {share(card.week.skipped, card.week.shown)} skipped
            </dd>
          </dl>
        )}
        {card.role === 'student' && (
          <Suspense fallback={null}>
            <PlacementReset student={card.id} name={card.name} />
          </Suspense>
        )}
      </section>

      <section className="panel" aria-labelledby="games-title">
        <h2 id="games-title" className="panel__title">
          Games
        </h2>
        {detail && <GamesTable detail={detail} />}
        <GameLines student={card.id} />
      </section>

      {detail && detail.recent.length > 0 && (
        <section className="panel" aria-labelledby="recent-title">
          <h2 id="recent-title" className="panel__title">
            Recent games
          </h2>
          <RecentGames recent={detail.recent} />
        </section>
      )}
    </>
  );
}

function GamesTable({ detail }: { detail: PersonDetail }) {
  return (
    <>
      <div className="roster__scroll">
        <table className="stats-table person-panel__stats">
          <caption>Against bots and friends</caption>
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
      </div>
      <p className="person-panel__badges">
        {detail.games.map((g) => (
          <span key={g.game}>
            {g.rank ? <RankBadge rank={g.rank} game={g.game} /> : gameLabel(g.game)}: {g.achievements} achievement
            {g.achievements === 1 ? '' : 's'}
          </span>
        ))}
      </p>
    </>
  );
}

/** The games with their own student panel: a one-line summary each, and the panel itself only when the line is opened. */
function GameLines({ student }: { student: string }) {
  const games = ALL_GAMES.filter((g) => g.teacher?.StudentPanel);
  const [summaries, setSummaries] = useState<Record<string, string | null | undefined>>({});

  useEffect(() => {
    let current = true;
    setSummaries({});
    for (const game of games) {
      const summary = game.teacher?.studentSummary;
      if (!summary) continue;
      summary(student).then(
        (line) => current && setSummaries((s) => ({ ...s, [game.id]: line })),
        // A summary that can't load leaves the line there, without its words.
        () => current && setSummaries((s) => ({ ...s, [game.id]: '' })),
      );
    }
    return () => {
      current = false;
    };
    // The list of games never changes while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  // A game with a summary that says null hasn't been played: it gets no line of its own.
  const played = games.filter((g) => !g.teacher?.studentSummary || summaries[g.id] !== null);
  const notPlayed = games.filter((g) => g.teacher?.studentSummary && summaries[g.id] === null);
  return (
    <>
      <ul className="game-lines">
        {played.map((game) => (
          <GameLine key={game.id} game={game} student={student} summary={summaries[game.id]} />
        ))}
      </ul>
      {notPlayed.length > 0 && (
        <p className="students__note">Not played yet: {notPlayed.map((g) => g.name).join(', ')}.</p>
      )}
    </>
  );
}

function GameLine({ game, student, summary }: { game: GameDefinition; student: string; summary: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const Panel = game.teacher!.StudentPanel!;
  return (
    <li>
      <details className="game-line" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="game-line__summary">
          <span className="game-line__name">{game.name}</span>
          {summary && <span className="game-line__what">{summary}</span>}
        </summary>
        {open && (
          <div className="game-line__body">
            <Suspense fallback={<p className="panel__empty">Loading…</p>}>
              <Panel student={student} />
            </Suspense>
          </div>
        )}
      </details>
    </li>
  );
}

function RecentGames({ recent }: { recent: PersonDetail['recent'] }) {
  return (
    <ul className="recent-list person-panel__recent" aria-label="Recent games">
      {recent.map((r, i) => (
        <li key={i}>
          {r.game === 'space' ? (
            <span className={`result result--${r.place === 1 ? 'won' : 'drawn'}`}>{placeLabel(r.place)}</span>
          ) : (
            <span className={`result result--${r.result}`}>{r.result === 'won' ? 'Won' : r.result === 'lost' ? 'Lost' : 'Draw'}</span>
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
  );
}

// ---------------------------------------------------------------- Manage

type Confirming = 'rename' | 'role' | 'delete' | null;

function Manage({
  card,
  isMe,
  canChangeRoles,
  onChanged,
}: {
  card: StudentCard;
  isMe: boolean;
  /** Only a school admin makes (or un-makes) teachers; the database checks it too. */
  canChangeRoles: boolean;
  onChanged: () => void;
}) {
  const { classId, classes, reload } = useTeacherClass();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [moveTo, setMoveTo] = useState('');
  const makingTeacher = card.role !== 'teacher';
  const inClass = new Set(card.classes.map((c) => c.id));
  const otherClasses = classes.filter((c) => c.teaching && !inClass.has(c.id));

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

  return (
    <section className="panel student-manage" aria-labelledby="manage-title">
      <h2 id="manage-title" className="panel__title">
        Manage
      </h2>
      <div className="person-panel__actions">
        <button type="button" className="button button--light-outline" onClick={() => setConfirming('rename')}>
          🔀 New name
        </button>
        <button
          type="button"
          className="button button--light-outline"
          onClick={() =>
            void act(async () => {
              await setHidden(card.id, !card.hidden);
              return card.hidden
                ? `${card.name} is back on the leaderboards and in the lobby.`
                : `${card.name} is now hidden from leaderboards and the lobby, and can’t play friends.`;
            })
          }
        >
          {card.hidden ? '👁️ Show again' : '🙈 Hide'}
        </button>
        {!isMe && canChangeRoles && (
          <button type="button" className="button button--light-outline" onClick={() => setConfirming('role')}>
            {makingTeacher ? '🧑‍🏫 Make teacher' : 'Remove teacher'}
          </button>
        )}
      </div>

      {card.role === 'student' && otherClasses.length > 0 && (
        <div className="student-manage__move">
          <label className="teacher__filter">
            <span>Move to another class</span>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Choose a class…</option>
              {otherClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button button--light-outline"
            disabled={!moveTo}
            onClick={() => {
              const to = otherClasses.find((c) => c.id === moveTo);
              if (!to) return;
              void act(async () => {
                await moveStudent(card.id, to.id);
                setMoveTo('');
                void reload();
                return `${card.name} is now in ${to.name}.`;
              });
            }}
          >
            Move
          </button>
        </div>
      )}

      {confirming === 'rename' && (
        <div className="chess-confirm" role="group" aria-label="Confirm new name">
          <p>Give {card.name} a new random name? They can pick their own again from the word lists.</p>
          <div className="person-panel__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => void act(async () => `${card.name} is now ${await renamePerson(card.id)}.`)}
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
              ? `Make ${card.name} a teacher? Teachers can see every player, rename, hide and delete students, and start a new season. Only do this for staff.`
              : `Stop ${card.name} being a teacher? They'll become an ordinary player.`}
          </p>
          <div className="person-panel__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() =>
                void act(async () => {
                  await setRole(card.id, makingTeacher ? 'teacher' : 'student');
                  return makingTeacher ? `${card.name} is now a teacher.` : `${card.name} is no longer a teacher.`;
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

      <p role="status" className="teacher__status">
        {status}
      </p>

      {card.role === 'student' && (
        <div className="student-manage__danger" role="group" aria-labelledby="danger-title">
          <h3 id="danger-title" className="student-manage__danger-title">
            Can’t be undone
          </h3>
          {confirming === 'delete' ? (
            <div className="chess-confirm" role="group" aria-label="Confirm delete">
              <p>
                This deletes {card.name}’s account and all their games, points and achievements. It can’t be undone. Friends they
                played keep those games, without their name. If they sign in again, they start fresh.
              </p>
              <DangerAction
                label="Delete forever"
                words={card.name}
                prompt="Type their player name to confirm"
                ignoreCase
                onConfirm={async () => {
                  // Not through act(): on a failure the box stays open with the name still typed, so they can try again.
                  setStatus('Deleting…');
                  try {
                    await deletePerson(card.id);
                  } catch (error) {
                    setStatus(errorText(error));
                    throw error;
                  }
                  navigate(`/teacher/${classId}/students`, { replace: true, state: { notice: `${card.name} has been deleted.` } });
                }}
                onCancel={() => setConfirming(null)}
              />
            </div>
          ) : (
            <button type="button" className="button button--danger" onClick={() => setConfirming('delete')}>
              🗑️ Delete
            </button>
          )}
        </div>
      )}
    </section>
  );
}
