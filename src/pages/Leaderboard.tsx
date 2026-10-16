import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AvatarImage } from '../avatar/AvatarImage';
import { RankBadge } from '../components/Progress';
import { fetchStarsBoard, type StarsRow } from '../data/gemKeep';
import { fetchLeaderboard, type Board, type BoardRow } from '../data/progress';
import { GAMES } from '../games/registry';
import { isRanked } from '../games/types';

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

/** Games with a leaderboard: the ranked ones, and Gem Keep (most stars). */
const BOARD_GAMES = GAMES.filter((g) => isRanked(g) || g.id === 'gem-keep');

/** What to tell a student who isn't on the board yet. */
export function notOnBoardText(board: Board, gamesPlayed: number): string {
  const info = BOARDS.find((b) => b.id === board)!;
  const more = info.minGames - gamesPlayed;
  if (board === 'improved' && more <= 0) return 'You’re not on this board yet: win a few more games against friends to climb!';
  return `You’re not on this board yet. Play ${more} more ${more === 1 ? info.howToJoin.replace('games', 'game') : info.howToJoin} to join it!`;
}

export function Leaderboard() {
  const [game, setGame] = useState(GAMES[0].id);
  return (
    <div className="leaderboard">
      <div className="leaderboard__head">
        <h1 className="page-title">Leaderboard</h1>
        <Link to="/points" className="link-button">
          How points and badges work
        </Link>
      </div>

      <div className="panel leaderboard__panel">
        <fieldset className="choice-group">
          <legend>Game</legend>
          <div className="choice-group__chips">
            {BOARD_GAMES.map((g) => (
              <label key={g.id} className="chip">
                <input type="radio" name="board-game" checked={game === g.id} onChange={() => setGame(g.id)} />
                <span>{g.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {game === 'gem-keep' ? <StarsBoard /> : <RankedBoard game={game} />}
      </div>
    </div>
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
                <BoardLine key={row.display_name} row={row} board={board} />
              ))}
              {meBelow && (
                <>
                  <li className="board-list__gap" aria-hidden="true">
                    ⋯
                  </li>
                  <BoardLine row={meBelow} board={board} />
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
            <StarsLine key={row.display_name} row={row} />
          ))}
          {meBelow && (
            <>
              <li className="board-list__gap" aria-hidden="true">
                ⋯
              </li>
              <StarsLine row={meBelow} />
            </>
          )}
        </ol>
      )}
      {rows && !me && <p className="leaderboard__me-off">Win a level of Gem Keep to get on this board!</p>}
    </>
  );
}

function StarsLine({ row }: { row: StarsRow }) {
  return (
    <li className={row.is_me ? 'is-me' : undefined} value={row.place}>
      <span className="board-list__place" aria-label={`Place ${row.place}`}>
        {row.place <= 3 ? MEDALS[row.place - 1] : row.place}
      </span>
      <AvatarImage avatar={row.avatar} size={40} />
      <span className="board-list__name">
        {row.display_name}
        {row.is_me && <span className="board-list__you"> (you)</span>}
      </span>
      <span className="board-list__points">★ {row.stars}</span>
    </li>
  );
}

function BoardLine({ row, board }: { row: BoardRow; board: Board }) {
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
      </span>
      <RankBadge rank={row.rank} />
      {board === 'week' && <span className="board-list__points">{row.points} pts</span>}
    </li>
  );
}
