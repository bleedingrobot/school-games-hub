import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { RankBadge } from '../components/Progress';
import type { TrophyShelf } from '../data/trophies';
import { FavouriteTrophies, useTrophyShelves } from '../trophies/FavouriteTrophies';
import { HallOfFame } from '../trophies/HallOfFame';
import { fetchStarsBoard, type StarsRow } from '../data/gemKeep';
import { fetchMonstersBoard, type MonstersRow } from '../data/monsters';
import { useClassSwitches } from '../data/classSwitches';
import { fetchLeaderboard, type Board, type BoardRow } from '../data/progress';
import { GAMES, gameLabel } from '../games/registry';
import {
  fetchAchievementsBoard,
  fetchAchievementsByGame,
  fetchGameBoard,
  fetchHardWorkers,
  fetchTrophiesBoard,
  fetchTrophiesOf,
  type AchievementsRow,
  type TheirTrophy,
  type TrophiesRow,
  type BoardScope,
  type GameAchievements,
  type GameBoardRow,
  type HardWorkerRow,
  type HardWorkers,
} from '../data/boards';
import { isRanked } from '../games/types';
import { fetchClasses, type ClassSummary } from '../data/classes';
import { TrophyArt } from '../trophies/TrophyArt';
import { trophyPlace } from '../trophies/cabinet';

export const BOARDS: { id: Board; label: string; about: string; minGames: number; howToJoin: string }[] = [
  {
    id: 'week',
    label: 'This week',
    about: 'Points earned since Monday. Everyone starts again each week!',
    minGames: 3,
    howToJoin: 'games this week',
  },
  {
    id: 'all-time',
    label: 'All time',
    about: 'The best players against friends, by badge.',
    minGames: 5,
    howToJoin: 'games against friends',
  },
  {
    id: 'improved',
    label: 'Most improved',
    about: 'Who climbed the most this week by playing friends.',
    minGames: 3,
    howToJoin: 'games against friends this week',
  },
];

const MEDALS = ['🥇', '🥈', '🥉'];

/** The Hall of fame's tab (profile card P10; ?board=hall opens it, as the home page's New trophies strip does). */
const HALL_TAB = 'hall';

/** Games with a leaderboard: the ranked ones, and Gem Keep (most stars). */
const BOARD_GAMES = GAMES.filter((g) => isRanked(g) || g.id === 'gem-keep' || g.id === 'monsters');

/** What to tell a student who isn't on the board yet. */
export function notOnBoardText(board: Board, gamesPlayed: number): string {
  const info = BOARDS.find((b) => b.id === board)!;
  const more = info.minGames - gamesPlayed;
  if (board === 'improved' && more <= 0) return 'You’re not on this board yet: win a few more games against friends to climb!';
  return `You’re not on this board yet. Play ${more} more ${more === 1 ? info.howToJoin.replace('games', 'game') : info.howToJoin} to join it!`;
}

/** The four tabs (leaderboard plan L2). Achievements opens first: it is the board that matters most. */
const TABS = [
  { id: 'achievements', label: '🏅 Achievements' },
  { id: 'trophies', label: '🏆 Trophies' },
  { id: 'effort', label: '💪 Hard workers' },
  { id: 'games', label: '🎮 Game boards' },
  { id: HALL_TAB, label: '🏛️ Hall of fame' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const SCOPES: { id: BoardScope; label: string }[] = [
  { id: 'school', label: 'Whole school' },
  { id: 'year', label: 'My year' },
  { id: 'class', label: 'My class' },
];

function readTab(raw: string | null): Tab {
  return TABS.some((t) => t.id === raw) ? (raw as Tab) : 'achievements';
}

export function Leaderboard() {
  const [params, setParams] = useSearchParams();
  const tab = readTab(params.get('board'));
  const { profile } = useAuth();
  const pupil = profile?.role !== 'teacher';
  const [scope, setScope] = useState<BoardScope>('school');
  const [teacherScope, setTeacherScope] = useState<BoardScope>('school');
  const boardScope = pupil ? scope : teacherScope;
  const scopeRow = pupil ? (
    <fieldset className="choice-group">
      <legend>Who</legend>
      <div className="choice-group__chips">
        {SCOPES.map((s) => (
          <label key={s.id} className="chip">
            <input type="radio" name="board-scope" checked={scope === s.id} onChange={() => setScope(s.id)} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  ) : (
    <TeacherScope scope={teacherScope} onPick={setTeacherScope} />
  );
  const pick = (id: Tab) => setParams(id === 'achievements' ? {} : { board: id }, { replace: true });
  return (
    <div className="leaderboard">
      <div className="leaderboard__head">
        <h1 className="page-title">Leaderboard</h1>
        <Link to="/points" className="link-button">
          How points and badges work
        </Link>
      </div>

      <div className="panel leaderboard__panel">
        <div className="leaderboard__tabs" role="tablist" aria-label="Boards">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'leaderboard__tab is-on' : 'leaderboard__tab'}
              onClick={() => pick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(tab === 'achievements' || tab === 'effort' || tab === 'trophies') && scopeRow}
        {tab === 'achievements' ? (
          <AchievementsBoard scope={boardScope} />
        ) : tab === 'trophies' ? (
          <TrophiesBoard scope={boardScope} />
        ) : tab === 'effort' ? (
          <HardWorkersBoard scope={boardScope} />
        ) : tab === HALL_TAB ? (
          <HallOfFame />
        ) : (
          <GameBoards scope={boardScope} scopeRow={scopeRow} />
        )}
      </div>
    </div>
  );
}

/** Games with no achievements yet, so nothing to rank (Star Trader). */
const NO_BOARD = new Set(['trader']);
const SWITCHED = GAMES.filter((g) => g.teacherSwitch).map((g) => g.id);

/**
 * A board for every game (James, 13 Nov 2026). Chess and Checkers (points and rank), Gem Keep (stars) and Maths Monsters keep
 * their own boards; every other game ranks achievements in that game, then games finished, so no board ranks maths.
 */
function GameBoards({ scope, scopeRow }: { scope: BoardScope; scopeRow: ReactNode }) {
  const { profile } = useAuth();
  const teacher = profile?.role === 'teacher';
  const switchedOn = useClassSwitches(SWITCHED);
  const boardGames = GAMES.filter((g) => !NO_BOARD.has(g.id) && (!g.teacherSwitch || teacher || (switchedOn?.has(g.id) ?? false)));
  const [game, setGame] = useState(GAMES[0].id);
  const special = BOARD_GAMES.some((g) => g.id === game);
  return (
    <>
      <label className="board-filter__pick board-filter__game">
        <span>Game</span>
        <select value={game} onChange={(e) => setGame(e.target.value)}>
          {boardGames.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      {!special && scopeRow}
      {game === 'gem-keep' ? (
        <StarsBoard />
      ) : game === 'monsters' ? (
        <MonstersBoard />
      ) : special ? (
        <RankedBoard game={game} />
      ) : (
        <OneGameBoard game={game} scope={scope} />
      )}
    </>
  );
}

function OneGameBoard({ game, scope }: { game: string; scope: BoardScope }) {
  const [board, setBoard] = useState<'all-time' | 'week'>('all-time');
  const [rows, setRows] = useState<GameBoardRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { profile } = useAuth();
  const pupil = profile?.role !== 'teacher';

  useEffect(() => {
    let current = true;
    setRows(null);
    setFailed(false);
    fetchGameBoard(game, board, scope).then(
      (r) => current && setRows(r),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [game, board, scope]);

  const top = rows?.slice(0, 10) ?? [];
  const meBelow = rows?.slice(10).find((r) => r.is_me);
  const me = rows?.find((r) => r.is_me);
  const shelves = useTrophyShelves([...top, meBelow].map((r) => r?.name));
  const line = (row: GameBoardRow) => (
    <li key={row.name} className={row.is_me ? 'is-me' : undefined} value={row.place}>
      <span className="board-list__place" aria-label={`Place ${row.place}`}>
        {row.place <= 3 ? MEDALS[row.place - 1] : row.place}
      </span>
      <AvatarImage avatar={row.avatar} size={40} />
      <span className="board-list__name">
        {row.name}
        {row.is_me && <span className="board-list__you"> (you)</span>}
        <FavouriteTrophies shelf={shelves[row.name]} />
      </span>
      <span className="board-list__points">
        🏅 {board === 'week' ? row.week : row.count}
        {row.games > 0 && <small className="board-list__sub">{row.games === 1 ? '1 game' : `${row.games} games`}</small>}
      </span>
    </li>
  );
  const name = GAMES.find((g) => g.id === game)?.name ?? 'this game';

  return (
    <>
      <fieldset className="choice-group">
        <legend>When</legend>
        <div className="choice-group__chips">
          <label className="chip">
            <input type="radio" name="game-board" checked={board === 'all-time'} onChange={() => setBoard('all-time')} />
            <span>All time</span>
          </label>
          <label className="chip">
            <input type="radio" name="game-board" checked={board === 'week'} onChange={() => setBoard('week')} />
            <span>This week</span>
          </label>
        </div>
      </fieldset>
      <p className="leaderboard__about">
        {board === 'week' ? `Achievements earned in ${name} since Monday, then games finished.` : `Achievements earned in ${name}, then games finished.`}
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load the leaderboard just now. Please try again soon.</p>
      ) : !rows ? (
        <p className="panel__empty">Loading…</p>
      ) : top.length === 0 ? (
        <p className="panel__empty">{emptyText(scope, board === 'week' ? `played ${name} this week` : `played ${name}`)}</p>
      ) : (
        <ol className="board-list" aria-label={`${name} leaderboard`}>
          {top.map(line)}
          {meBelow && (
            <>
              <li className="board-list__gap" aria-hidden="true">
                ⋯
              </li>
              {line(meBelow)}
            </>
          )}
        </ol>
      )}
      {rows && !failed && !me && pupil && <p className="leaderboard__me-off">Play {name} and earn an achievement to get on this board!</p>}
    </>
  );
}

/** Year levels a teacher can pick (Year 0 is a new entrant). */
const YEARS = Array.from({ length: 9 }, (_, n) => n);

/** Teachers have no class or year of their own: they pick one of the school's classes, or a year, to filter by. */
function TeacherScope({ scope, onPick }: { scope: BoardScope; onPick: (s: BoardScope) => void }) {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  useEffect(() => {
    let current = true;
    fetchClasses().then(
      (c) => current && setClasses(c.filter((k) => !k.archived)),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);
  return (
    <fieldset className="choice-group board-filter">
      <legend>Who</legend>
      <div className="choice-group__chips">
        <label className="chip">
          <input type="radio" name="board-scope" checked={scope === 'school'} onChange={() => onPick('school')} />
          <span>Whole school</span>
        </label>
        <label className="board-filter__pick">
          <span>Year</span>
          <select
            value={scope.startsWith('year:') ? scope.slice(5) : ''}
            onChange={(e) => onPick(e.target.value === '' ? 'school' : (`year:${Number(e.target.value)}` as BoardScope))}
          >
            <option value="">Any</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </label>
        <label className="board-filter__pick">
          <span>Class</span>
          <select
            value={scope.startsWith('class:') ? scope.slice(6) : ''}
            onChange={(e) => onPick(e.target.value === '' ? 'school' : (`class:${e.target.value}` as BoardScope))}
          >
            <option value="">Any</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

/** What to say when a scoped board is empty. */
function emptyText(scope: BoardScope, what: string): string {
  if (scope.startsWith('class:')) return `Nobody in that class has ${what} yet.`;
  if (scope.startsWith('year:')) return `Nobody in that year has ${what} yet.`;
  if (scope === 'class') return `Nobody in your class has ${what} yet. It could be you!`;
  if (scope === 'year') return `Nobody in your year has ${what} yet, or we don’t know your year yet.`;
  return `Nobody has ${what} yet. It could be you!`;
}

/** Most achievements: every one held, or the ones earned this week. Never a maths result. */
function AchievementsBoard({ scope }: { scope: BoardScope }) {
  const [board, setBoard] = useState<'all-time' | 'week'>('all-time');
  const [rows, setRows] = useState<AchievementsRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { profile } = useAuth();
  const pupil = profile?.role !== 'teacher';

  useEffect(() => {
    let current = true;
    setRows(null);
    setFailed(false);
    fetchAchievementsBoard(board, scope).then(
      (r) => current && setRows(r),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [board, scope]);

  const top = rows?.slice(0, 10) ?? [];
  const meBelow = rows?.slice(10).find((r) => r.is_me);
  const me = rows?.find((r) => r.is_me);
  const shelves = useTrophyShelves([...top, meBelow].map((r) => r?.name));
  const line = (row: AchievementsRow) => (
    <AchievementsLine
      key={row.name}
      row={row}
      board={board}
      shelf={shelves[row.name]}
      open={open === row.name}
      onToggle={() => setOpen((was) => (was === row.name ? null : row.name))}
    />
  );

  return (
    <>
      <fieldset className="choice-group">
        <legend>When</legend>
        <div className="choice-group__chips">
          <label className="chip">
            <input type="radio" name="ach-board" checked={board === 'all-time'} onChange={() => setBoard('all-time')} />
            <span>All time</span>
          </label>
          <label className="chip">
            <input type="radio" name="ach-board" checked={board === 'week'} onChange={() => setBoard('week')} />
            <span>This week</span>
          </label>
        </div>
      </fieldset>
      <p className="leaderboard__about">
        {board === 'week'
          ? 'Achievements earned since Monday. Everyone starts again each week!'
          : 'Every achievement you have earned, in every game. Tap a name to see where they came from.'}
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load the leaderboard just now. Please try again soon.</p>
      ) : !rows ? (
        <p className="panel__empty">Loading…</p>
      ) : top.length === 0 ? (
        <p className="panel__empty">{emptyText(scope, board === 'week' ? 'earned an achievement this week' : 'an achievement')}</p>
      ) : (
        <ol className="board-list" aria-label={board === 'week' ? 'Achievements this week leaderboard' : 'Most achievements leaderboard'}>
          {top.map(line)}
          {meBelow && (
            <>
              <li className="board-list__gap" aria-hidden="true">
                ⋯
              </li>
              {line(meBelow)}
            </>
          )}
        </ol>
      )}
      {rows && !failed && !me && pupil && <MeOffHint board={board} />}
      <p className="leaderboard__note">💪 = played on 4 or 5 school days this week.</p>
    </>
  );
}

function MeOffHint({ board }: { board: 'all-time' | 'week' }) {
  return (
    <p className="leaderboard__me-off">
      {board === 'week' ? 'Earn an achievement this week to get on this board!' : 'Earn your first achievement to get on this board!'}
    </p>
  );
}

function AchievementsLine({
  row,
  board,
  shelf,
  open,
  onToggle,
}: {
  row: AchievementsRow;
  board: 'all-time' | 'week';
  shelf?: TrophyShelf;
  open: boolean;
  onToggle: () => void;
}) {
  const score = board === 'week' ? row.week : row.count;
  return (
    <li className={row.is_me ? 'is-me board-list__row--open' : 'board-list__row--open'} value={row.place}>
      <button type="button" className="board-list__tap" aria-expanded={open} onClick={onToggle}>
        <span className="board-list__place" aria-label={`Place ${row.place}`}>
          {row.place <= 3 ? MEDALS[row.place - 1] : row.place}
        </span>
        <AvatarImage avatar={row.avatar} size={40} />
        <span className="board-list__name">
          {row.name}
          {row.is_me && <span className="board-list__you"> (you)</span>}
          {row.hard && (
            <span className="board-list__hard" title="Played on 4 or 5 school days this week" aria-label="Played on 4 or 5 school days this week">
              {' '}
              💪
            </span>
          )}
          <FavouriteTrophies shelf={shelf} />
        </span>
        <span className="board-list__points">
          🏅 {score}
          {board === 'all-time' && row.week > 0 && <small className="board-list__sub">+{row.week} this week</small>}
        </span>
      </button>
      {open && <AchievementsByGame player={row.name} />}
    </li>
  );
}

function AchievementsByGame({ player }: { player: string }) {
  const [games, setGames] = useState<GameAchievements[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    fetchAchievementsByGame(player).then(
      (g) => current && setGames(g),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [player]);
  if (failed) return <p className="board-list__more">We couldn’t load those just now.</p>;
  if (!games) return <p className="board-list__more">Loading…</p>;
  return (
    <ul className="board-list__more board-games">
      {games.map((g) => (
        <li key={g.game}>
          <strong>{gameLabel(g.game) ?? g.game}</strong> <span className="board-games__n">🏅 {g.count}</span>
          <span className="board-games__names">{g.names.join(' · ')}</span>
        </li>
      ))}
    </ul>
  );
}

/** Most trophies: different trophies held (then wins), all time or this hub season. */
function TrophiesBoard({ scope }: { scope: BoardScope }) {
  const [board, setBoard] = useState<'all-time' | 'season'>('all-time');
  const [rows, setRows] = useState<TrophiesRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { profile } = useAuth();
  const pupil = profile?.role !== 'teacher';

  useEffect(() => {
    let current = true;
    setRows(null);
    setFailed(false);
    fetchTrophiesBoard(board, scope).then(
      (r) => current && setRows(r),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [board, scope]);

  const top = rows?.slice(0, 10) ?? [];
  const meBelow = rows?.slice(10).find((r) => r.is_me);
  const me = rows?.find((r) => r.is_me);
  const line = (row: TrophiesRow) => (
    <TrophiesLine
      key={row.name}
      row={row}
      board={board}
      open={open === row.name}
      onToggle={() => setOpen((was) => (was === row.name ? null : row.name))}
    />
  );

  return (
    <>
      <fieldset className="choice-group">
        <legend>When</legend>
        <div className="choice-group__chips">
          <label className="chip">
            <input type="radio" name="trophy-board" checked={board === 'all-time'} onChange={() => setBoard('all-time')} />
            <span>All time</span>
          </label>
          <label className="chip">
            <input type="radio" name="trophy-board" checked={board === 'season'} onChange={() => setBoard('season')} />
            <span>This season</span>
          </label>
        </div>
      </fieldset>
      <p className="leaderboard__about">
        {board === 'season'
          ? 'Different trophies won this season. Tap a name to see them!'
          : 'Every different trophy in their cabinet. Tap a name to see them!'}
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load the leaderboard just now. Please try again soon.</p>
      ) : !rows ? (
        <p className="panel__empty">Loading…</p>
      ) : top.length === 0 ? (
        <p className="panel__empty">{emptyText(scope, board === 'season' ? 'won a trophy this season' : 'won a trophy')}</p>
      ) : (
        <ol className="board-list" aria-label={board === 'season' ? 'Trophies this season leaderboard' : 'Most trophies leaderboard'}>
          {top.map(line)}
          {meBelow && (
            <>
              <li className="board-list__gap" aria-hidden="true">
                ⋯
              </li>
              {line(meBelow)}
            </>
          )}
        </ol>
      )}
      {rows && !failed && !me && pupil && (
        <p className="leaderboard__me-off">Win a trophy with a big feat in a game to get on this board!</p>
      )}
    </>
  );
}

function TrophiesLine({
  row,
  board,
  open,
  onToggle,
}: {
  row: TrophiesRow;
  board: 'all-time' | 'season';
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className={row.is_me ? 'is-me board-list__row--open' : 'board-list__row--open'} value={row.place}>
      <button type="button" className="board-list__tap" aria-expanded={open} onClick={onToggle}>
        <span className="board-list__place" aria-label={`Place ${row.place}`}>
          {row.place <= 3 ? MEDALS[row.place - 1] : row.place}
        </span>
        <AvatarImage avatar={row.avatar} size={40} />
        <span className="board-list__name">
          {row.name}
          {row.is_me && <span className="board-list__you"> (you)</span>}
        </span>
        <span className="board-list__points">
          🏆 {board === 'season' ? row.season : row.count}
          {board === 'all-time' && row.wins > row.count && <small className="board-list__sub">{row.wins} wins</small>}
        </span>
      </button>
      {open && <TrophiesOf player={row.name} />}
    </li>
  );
}

function TrophiesOf({ player }: { player: string }) {
  const [trophies, setTrophies] = useState<TheirTrophy[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    fetchTrophiesOf(player).then(
      (t) => current && setTrophies(t),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [player]);
  if (failed) return <p className="board-list__more">We couldn’t load those just now.</p>;
  if (!trophies) return <p className="board-list__more">Loading…</p>;
  return (
    <ul className="board-list__more board-trophies">
      {trophies.map((t) => (
        <li key={t.trophy} title={t.how}>
          <TrophyArt id={t.trophy} game={t.game} kind={t.kind} tier={t.tier} size={48} />
          <span>
            <strong>{t.title}</strong>
            <span className="board-trophies__how">
              {trophyPlace(t.game)}
              {t.wins > 1 && ` · won ${t.wins} times`}
            </span>
            <span className="board-trophies__how">{t.how}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Effort: school days played (Monday to Friday, a finished game counts), then games finished. */
function HardWorkersBoard({ scope }: { scope: BoardScope }) {
  const [board, setBoard] = useState<'week' | 'season'>('week');
  const [data, setData] = useState<HardWorkers | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setData(null);
    setFailed(false);
    fetchHardWorkers(board, scope).then(
      (d) => current && setData(d),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [board, scope]);

  const rows = data?.rows ?? [];
  const top = rows.slice(0, 10);
  const meBelow = rows.slice(10).find((r) => r.is_me);
  const shelves = useTrophyShelves([...top, meBelow].map((r) => r?.name));
  const most = board === 'week' ? 5 : null;

  return (
    <>
      {data && data.everyone.length > 0 && (
        <section className="hard-band" aria-labelledby="hard-band-title">
          <h2 id="hard-band-title">Played 4 or 5 school days this week 💪</h2>
          <ul className="hard-band__list">
            {data.everyone.map((p) => (
              <li key={p.name}>
                <AvatarImage avatar={p.avatar} size={28} />
                <span>{p.name}</span>
                {p.days >= 5 && <span className="hard-band__five" aria-label="every school day"> ⭐</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <fieldset className="choice-group">
        <legend>When</legend>
        <div className="choice-group__chips">
          <label className="chip">
            <input type="radio" name="hard-board" checked={board === 'week'} onChange={() => setBoard('week')} />
            <span>This week</span>
          </label>
          <label className="chip">
            <input type="radio" name="hard-board" checked={board === 'season'} onChange={() => setBoard('season')} />
            <span>This season</span>
          </label>
        </div>
      </fieldset>
      <p className="leaderboard__about">
        {board === 'week'
          ? 'School days this week you finished a game on. Turning up counts more than playing for hours!'
          : 'School days this season you finished a game on. 15 days wins the Season Regular trophy.'}
      </p>
      {failed ? (
        <p className="panel__empty">We couldn’t load the leaderboard just now. Please try again soon.</p>
      ) : !data ? (
        <p className="panel__empty">Loading…</p>
      ) : top.length === 0 ? (
        <p className="panel__empty">{emptyText(scope, board === 'week' ? 'played this week' : 'played this season')}</p>
      ) : (
        <ol className="board-list" aria-label={board === 'week' ? 'Hard workers this week leaderboard' : 'Hard workers this season leaderboard'}>
          {top.map((row) => (
            <HardLine key={row.name} row={row} most={most} shelf={shelves[row.name]} />
          ))}
          {meBelow && (
            <>
              <li className="board-list__gap" aria-hidden="true">
                ⋯
              </li>
              <HardLine row={meBelow} most={most} shelf={shelves[meBelow.name]} />
            </>
          )}
        </ol>
      )}
    </>
  );
}

function HardLine({ row, most, shelf }: { row: HardWorkerRow; most: number | null; shelf?: TrophyShelf }) {
  return (
    <li className={row.is_me ? 'is-me' : undefined} value={row.place}>
      <span className="board-list__place" aria-label={`Place ${row.place}`}>
        {row.place <= 3 ? MEDALS[row.place - 1] : row.place}
      </span>
      <AvatarImage avatar={row.avatar} size={40} />
      <span className="board-list__name">
        {row.name}
        {row.is_me && <span className="board-list__you"> (you)</span>}
        <FavouriteTrophies shelf={shelf} />
      </span>
      <span className="board-list__points">
        {row.days} {row.days === 1 ? 'day' : 'days'}
        {most && row.days >= most ? ' ⭐' : ''}
        <small className="board-list__sub">
          {row.games} {row.games === 1 ? 'game' : 'games'}
        </small>
      </span>
    </li>
  );
}

function RankedBoard({ game }: { game: string }) {
  const [board, setBoard] = useState<Board>('week');
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setRows(null);
    setFailed(false);
    fetchLeaderboard(game, board)
      .then((r) => current && setRows(r))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [game, board]);

  const info = BOARDS.find((b) => b.id === board)!;
  const placed = rows?.filter((r) => r.place !== null) ?? [];
  const top = placed.slice(0, 10);
  const meBelow = placed.slice(10).find((r) => r.is_me);
  const meOff = rows?.find((r) => r.is_me && r.place === null);
  const shelves = useTrophyShelves([...top, meBelow].map((r) => r?.display_name));

  return (
    <>
      <fieldset className="choice-group">
        <legend>Board</legend>
        <div className="choice-group__chips">
          {BOARDS.map((b) => (
            <label key={b.id} className="chip">
              <input type="radio" name="board-kind" checked={board === b.id} onChange={() => setBoard(b.id)} />
              <span>{b.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="leaderboard__about">{info.about}</p>

      {failed ? (
        <p className="panel__empty">We couldn’t load the leaderboard just now. Please try again soon.</p>
      ) : !rows ? (
        <p className="panel__empty">Loading…</p>
      ) : (
        <>
          {top.length === 0 ? (
            <p className="panel__empty">Nobody is on this board yet. It could be you!</p>
          ) : (
            <ol className="board-list" aria-label={`${info.label} leaderboard`}>
              {top.map((row) => (
                <BoardLine key={row.display_name} row={row} board={board} shelf={shelves[row.display_name]} />
              ))}
              {meBelow && (
                <>
                  <li className="board-list__gap" aria-hidden="true">
                    ⋯
                  </li>
                  <BoardLine row={meBelow} board={board} shelf={shelves[meBelow.display_name]} />
                </>
              )}
            </ol>
          )}
          {meOff && <p className="leaderboard__me-off">{notOnBoardText(board, meOff.games)}</p>}
        </>
      )}
    </>
  );
}

/** Gem Keep: most stars across the campaign. Never how good anyone's maths is. */
function StarsBoard() {
  const [rows, setRows] = useState<StarsRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    fetchStarsBoard()
      .then((r) => current && setRows(r))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, []);

  const top = rows?.slice(0, 10) ?? [];
  const meBelow = rows?.slice(10).find((r) => r.is_me);
  const me = rows?.find((r) => r.is_me);
  const shelves = useTrophyShelves([...top, meBelow].map((r) => r?.display_name));

  return (
    <>
      <p className="leaderboard__about">Most stars in Gem Keep. Your best stars on each level count, so replaying the same level won’t add more.</p>
      {failed ? (
        <p className="panel__empty">We couldn’t load the leaderboard just now. Please try again soon.</p>
      ) : !rows ? (
        <p className="panel__empty">Loading…</p>
      ) : top.length === 0 ? (
        <p className="panel__empty">Nobody has a star yet. It could be you!</p>
      ) : (
        <ol className="board-list" aria-label="Most stars leaderboard">
          {top.map((row) => (
            <StarsLine key={row.display_name} row={row} shelf={shelves[row.display_name]} />
          ))}
          {meBelow && (
            <>
              <li className="board-list__gap" aria-hidden="true">
                ⋯
              </li>
              <StarsLine row={meBelow} shelf={shelves[meBelow.display_name]} />
            </>
          )}
        </ol>
      )}
      {rows && !me && <p className="leaderboard__me-off">Win a level of Gem Keep to get on this board!</p>}
    </>
  );
}

/** Maths Monsters: most monsters in the monster book (owned, not just seen). Never how good anyone's maths is. */
function MonstersBoard() {
  const [rows, setRows] = useState<MonstersRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    fetchMonstersBoard()
      .then((r) => current && setRows(r))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, []);

  const top = rows?.slice(0, 10) ?? [];
  const meBelow = rows?.slice(10).find((r) => r.is_me);
  const me = rows?.find((r) => r.is_me);
  const shelves = useTrophyShelves([...top, meBelow].map((r) => r?.display_name));

  return (
    <>
      <p className="leaderboard__about">Most monsters collected in Maths Monsters. Every page of the monster book you have filled counts, including the earlier forms of monsters that grew.</p>
      {failed ? (
        <p className="panel__empty">We couldn’t load the leaderboard just now. Please try again soon.</p>
      ) : !rows ? (
        <p className="panel__empty">Loading…</p>
      ) : top.length === 0 ? (
        <p className="panel__empty">Nobody has started yet. It could be you!</p>
      ) : (
        <ol className="board-list" aria-label="Most monsters leaderboard">
          {top.map((row) => (
            <MonstersLine key={row.display_name} row={row} shelf={shelves[row.display_name]} />
          ))}
          {meBelow && (
            <>
              <li className="board-list__gap" aria-hidden="true">
                ⋯
              </li>
              <MonstersLine row={meBelow} shelf={shelves[meBelow.display_name]} />
            </>
          )}
        </ol>
      )}
      {rows && !me && <p className="leaderboard__me-off">Start a game of Maths Monsters to get on this board!</p>}
    </>
  );
}

function MonstersLine({ row, shelf }: { row: MonstersRow; shelf?: TrophyShelf }) {
  return (
    <li className={row.is_me ? 'is-me' : undefined} value={row.place}>
      <span className="board-list__place" aria-label={`Place ${row.place}`}>
        {row.place <= 3 ? MEDALS[row.place - 1] : row.place}
      </span>
      <AvatarImage avatar={row.avatar} size={40} />
      <span className="board-list__name">
        {row.display_name}
        {row.is_me && <span className="board-list__you"> (you)</span>}
        <FavouriteTrophies shelf={shelf} />
      </span>
      <span className="board-list__points">🐾 {row.monsters}</span>
    </li>
  );
}

function StarsLine({ row, shelf }: { row: StarsRow; shelf?: TrophyShelf }) {
  return (
    <li className={row.is_me ? 'is-me' : undefined} value={row.place}>
      <span className="board-list__place" aria-label={`Place ${row.place}`}>
        {row.place <= 3 ? MEDALS[row.place - 1] : row.place}
      </span>
      <AvatarImage avatar={row.avatar} size={40} />
      <span className="board-list__name">
        {row.display_name}
        {row.is_me && <span className="board-list__you"> (you)</span>}
        <FavouriteTrophies shelf={shelf} />
      </span>
      <span className="board-list__points">★ {row.stars}</span>
    </li>
  );
}

function BoardLine({ row, board, shelf }: { row: BoardRow; board: Board; shelf?: TrophyShelf }) {
  const place = row.place ?? 0;
  return (
    <li className={row.is_me ? 'is-me' : undefined} value={place}>
      <span className="board-list__place" aria-label={`Place ${place}`}>
        {place <= 3 ? MEDALS[place - 1] : place}
      </span>
      <AvatarImage avatar={row.avatar} size={40} />
      <span className="board-list__name">
        {row.display_name}
        {row.is_me && <span className="board-list__you"> (you)</span>}
        <FavouriteTrophies shelf={shelf} />
      </span>
      <RankBadge rank={row.rank} />
      {board === 'week' && <span className="board-list__points">{row.points} pts</span>}
    </li>
  );
}
