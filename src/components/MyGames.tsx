/**
 * A student's own games: the Recent games list and the My stats tables. The home page shows the newest 3 games; the profile page
 * shows more, with the stats tables. Both take them from the home page's one request (my_home_page).
 */
import { AvatarImage } from '../avatar/AvatarImage';
import type { GameStats } from '../data/botGames';
import type { SeatSummary } from '../data/cardGames';
import type { HomePage } from '../data/homePage';
import type { FriendGame, FriendStats, PlayerCard } from '../data/multiplayer';
import { seatsOf as powerSeatsOf, type PowerGame } from '../data/powerGames';
import { seatsOf, type SpaceGame } from '../data/spaceGames';
import { findGame, GAMES, POWER_CLASH_ON, gameLabel } from '../games/registry';
import { BOT_LEVELS, isRanked, type BotLevel } from '../games/types';
import { BOT_NAMES, placeLabel } from '../../shared/space/names';

const RESULT_LABEL = { won: 'Won', lost: 'Lost', drawn: 'Draw' } as const;

/** "Today", "Yesterday", "Monday", or a date, in the student's own time zone. */
export function whenPlayed(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const then = new Date(iso);
  const daysAgo = Math.round((day(now) - day(then)) / 86_400_000);
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return then.toLocaleDateString('en-NZ', { weekday: 'long' });
  return then.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

function botName(level: string, game?: string) {
  if (game === 'space') return `${BOT_NAMES[level as BotLevel] ?? ''} bots`;
  if (game === '101') return `${BOT_LEVELS.find((l) => l.id === level)?.label ?? ''} bots`;
  return `${BOT_LEVELS.find((l) => l.id === level)?.label ?? ''} bot`;
}

/** One line in Recent games: against a bot, or against another student. */
export interface RecentGame {
  id: string;
  game: string;
  result: 'won' | 'lost' | 'drawn';
  reason: string;
  finished_at: string;
  bot_level?: string;
  opponent?: PlayerCard | null;
  /** Wormholes & Black Holes: the place (null if they left early). */
  place?: number | null;
  /** Wormholes & Black Holes with classmates (rather than one opponent). */
  classmates?: boolean;
  /** Power Clash that ended early: who left. */
  leftBy?: 'me' | 'them' | 'nobody';
}

/** Turns a finished space game with classmates into a Recent games line. */
export function spaceRecentGame(g: SpaceGame, me: string): RecentGame {
  const seat = seatsOf(g).indexOf(me);
  const left = g.ending === 'abandoned' || !!g.seat_info?.[seat]?.left;
  const place = left ? null : (g.places?.[seat] ?? null);
  return {
    id: g.id,
    game: 'space',
    result: place === 1 ? 'won' : 'lost',
    reason: left ? 'abandoned' : (g.ending ?? ''),
    finished_at: g.finished_at ?? g.created_at,
    place,
    classmates: true,
  };
}

/** Turns a finished Power Clash game with a classmate into a Recent games line. */
export function powerRecentGame(g: PowerGame, me: string): RecentGame {
  const seat = powerSeatsOf(g).indexOf(me);
  const abandoned = g.ending === 'abandoned';
  return {
    id: g.id,
    game: 'power-clash',
    result: !abandoned && g.won?.[seat] ? 'won' : 'lost',
    reason: abandoned ? 'abandoned' : 'finished',
    finished_at: g.finished_at ?? g.created_at,
    classmates: true,
    ...(abandoned ? { leftBy: g.leaver === me ? ('me' as const) : g.leaver ? ('them' as const) : ('nobody' as const) } : {}),
  };
}

/** Turns a finished 101 game with classmates (my seat row) into a Recent games line. */
export function cardRecentGame(s: SeatSummary): RecentGame {
  const { info } = s;
  const place = info.ending === 'abandoned' ? null : (info.places?.[s.seat] ?? null);
  const left = !place;
  return {
    id: s.game,
    game: '101',
    result: place === 1 ? 'won' : 'lost',
    reason: left ? 'abandoned' : 'finished',
    finished_at: s.updated_at,
    place,
    classmates: true,
  };
}

/** Turns a finished friend game into a Recent games line, from this student's side. */
export function friendRecentGame(g: FriendGame, me: string, cards: Map<string, PlayerCard>): RecentGame {
  const mySide = g.second_player === me ? 'second' : 'first';
  const opponentId = mySide === 'first' ? g.second_player : g.first_player;
  return {
    id: g.id,
    game: g.game,
    result: g.winner === null ? 'drawn' : g.winner === mySide ? 'won' : 'lost',
    reason: g.reason ?? '',
    finished_at: g.finished_at ?? g.created_at,
    opponent: (opponentId && cards.get(opponentId)) || null,
  };
}

/** Every finished game of every kind in the home page's answer, newest first. */
export function recentGamesFrom(home: HomePage, me: string): RecentGame[] {
  return [
    ...home.botRecent.map((g) => ({ ...g })),
    ...home.friendRecent.map((g) => friendRecentGame(g, me, home.players)),
    ...home.spaceRecent.map((g) => spaceRecentGame(g, me)),
    ...home.cardRecent.map(cardRecentGame),
    ...(POWER_CLASH_ON ? home.powerRecent.map((g) => powerRecentGame(g, me)) : []),
  ].sort((a, b) => b.finished_at.localeCompare(a.finished_at));
}

/** The rows of My stats' two tables, and the Wormholes line's games with classmates. */
export interface MyStats {
  bots: GameStats[];
  friends: FriendStats[];
  spaceClassmates: { played: number; firsts: number } | null;
}

export function statsFrom(home: HomePage): MyStats {
  // 101 with classmates goes in the "Against friends" table with chess and checkers, and Power Clash with a classmate too (a match
  // is won or lost).
  const friends = [...home.friendStats];
  if (home.cardStats) friends.push({ game: '101', played: home.cardStats.played, won: home.cardStats.won, lost: home.cardStats.played - home.cardStats.won, drawn: 0 });
  if (POWER_CLASH_ON && home.powerStats)
    friends.push({ game: 'power-clash', played: home.powerStats.played, won: home.powerStats.won, lost: home.powerStats.played - home.powerStats.won, drawn: 0 });
  return { bots: home.botStats, friends, spaceClassmates: home.spaceStats };
}

/** The Recent games list (the caller decides how many). */
export function RecentList({ games, pointsFor }: { games: RecentGame[]; pointsFor: Map<string, number> }) {
  return (
    <ul className="recent-list">
      {games.map((g) => (
        <li key={g.id}>
          {g.leftBy ? (
            <span className="result result--drawn">Ended</span>
          ) : g.game === 'space' || (g.game === '101' && g.classmates) ? (
            <span className={`result result--${g.place === 1 ? 'won' : 'drawn'}`}>{placeLabel(g.place)}</span>
          ) : (
            <span className={`result result--${g.result}`}>{RESULT_LABEL[g.result]}</span>
          )}
          <span className="recent-list__what">
            {g.bot_level ? (
              <>
                {findGame(g.game)?.name} vs {botName(g.bot_level, g.game)}
              </>
            ) : g.game === 'power-clash' && g.classmates ? (
              <>{gameLabel(g.game)} with a classmate</>
            ) : g.classmates ? (
              <>{findGame(g.game)?.name} with classmates</>
            ) : (
              <>
                {findGame(g.game)?.name} vs <AvatarImage avatar={g.opponent?.avatar} size={24} />{' '}
                {g.opponent?.display_name ?? 'a classmate'}
              </>
            )}
            {g.leftBy && (
              <span className="recent-list__note">
                {g.leftBy === 'me' ? ' (you left)' : g.leftBy === 'them' ? ' (they left)' : ' (ended early)'}
              </span>
            )}
            {g.reason === 'abandoned' && !g.leftBy && g.game !== 'space' && !(g.game === '101' && g.classmates) && (
              <span className="recent-list__note">{g.result === 'won' ? ' (they left)' : ' (left early)'}</span>
            )}
          </span>
          {pointsFor.has(g.id) && <span className="recent-list__points">+{pointsFor.get(g.id)}</span>}
          <span className="recent-list__when">{whenPlayed(g.finished_at)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Games with real wins and losses: the ranked ones, and 101 and Power Clash (no badge, but you win or lose). */
const hasWinLoss = (game: (typeof GAMES)[number]) => isRanked(game) || game.id === '101' || game.id === 'power-clash';

/** Wormholes & Black Holes is luck, so it gets a line of its own rather than won/lost columns. */
export function SpaceStatsLine({
  stats,
  classmates,
}: {
  stats: GameStats[] | null;
  classmates: { played: number; firsts: number } | null;
}) {
  const space = stats?.find((row) => row.game === 'space');
  const played = (space?.played ?? 0) + (classmates?.played ?? 0);
  const firsts = (space?.won ?? 0) + (classmates?.firsts ?? 0);
  if (!played) return null;
  return (
    <p className="stats-line">
      🚀 {findGame('space')?.name}: {played} game{played === 1 ? '' : 's'}, 1st place {firsts} time
      {firsts === 1 ? '' : 's'}
    </p>
  );
}

export function StatsTable({ caption, stats }: { caption: string; stats: { game: string; played: number; won: number; lost: number; drawn: number }[] | null }) {
  return (
    <table className="stats-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Game</th>
          <th scope="col">Played</th>
          <th scope="col">Won</th>
          <th scope="col">Lost</th>
          <th scope="col">Draw</th>
        </tr>
      </thead>
      <tbody>
        {GAMES.filter(hasWinLoss).map((game) => {
          const s = stats?.find((row) => row.game === game.id) ?? { played: 0, won: 0, lost: 0, drawn: 0 };
          const show = (n: number) => (stats ? n : '–');
          return (
            <tr key={game.id}>
              <th scope="row">{game.name}</th>
              <td>{show(s.played)}</td>
              <td>{show(s.won)}</td>
              <td>{show(s.lost)}</td>
              <td>{show(s.drawn)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
