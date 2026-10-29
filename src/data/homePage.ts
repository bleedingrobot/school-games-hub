/**
 * The home page in one request (docs/SERVER-LOAD-PLAN.md, S.2): my_home_page() answers with everything the page and its cards
 * (class, maths focus, maths path) used to ask for one by one. It is asked every time the page opens and never remembered, so
 * points, recent games and moves left are always up to date after a game. The game switches are not in it: they come from the
 * remembered settings read (settingsMemory.ts).
 */
import { readClock, type SeasonClock } from '../../shared/clans/season';
import { nzDate } from '../../shared/lord/engine';
import { readLordSeason, type HomeLordSeason } from '../../shared/lord/seasonRoad';
import { supabase } from '../lib/supabase';
import { tidyRecentGames, type GameStats, type RecentGameRow, type SavedGame } from './botGames';
import type { SeatSummary } from './cardGames';
import { movesFromRaw, type MovesByGame, type RawMovesLeft } from './movesLeft';
import { cardsById, type FriendGame, type FriendStats, type PlayerCard } from './multiplayer';
import type { PowerGame } from './powerGames';
import { FriendlyError } from './profile';
import type { MyProgress } from './progress';
import type { SpaceGame } from './spaceGames';

export interface HomePage {
  /** Null if it couldn't be read, as when its own request failed. */
  progress: MyProgress | null;
  botRecent: SavedGame[];
  botStats: GameStats[];
  friendRecent: FriendGame[];
  friendStats: FriendStats[];
  /** Waiting and being played, newest first (the page keeps the ones being played). */
  friendOpen: FriendGame[];
  /** Names and avatars of the other players in those games. Hidden players are left out. */
  players: Map<string, PlayerCard>;
  spaceRecent: SpaceGame[];
  spaceOpen: SpaceGame[];
  spaceStats: { played: number; firsts: number } | null;
  cardRecent: SeatSummary[];
  cardOpen: SeatSummary[];
  cardStats: { played: number; won: number } | null;
  powerRecent: PowerGame[];
  powerOpen: PowerGame[];
  powerStats: { played: number; won: number } | null;
  moves: MovesByGame;
  /** The school's Clan Quest season (for the "This season" strip), or null if the answer has none. */
  season: SeasonClock | null;
  /** The school's Dragon Maths season and the pupil's hero (for the Dragon Maths strip), or null when it isn't running for them. */
  lordSeason: HomeLordSeason | null;
  /**
   * The cards' parts as the database sent them, each read by its own card (so the maths code stays in the maths cards' download).
   * A part the answer doesn't have is left out, and that card asks for itself.
   */
  parts: Partial<Record<CardPart, unknown>>;
}

export type CardPart = 'myClass' | 'focus' | 'ladder';
const CARD_PARTS: CardPart[] = ['myClass', 'focus', 'ladder'];

type Raw = Record<string, unknown>;

const list = <T>(raw: Raw, part: string): T[] => (Array.isArray(raw[part]) ? (raw[part] as T[]) : []);
const row = <T>(raw: Raw, part: string): T | null => (raw[part] && typeof raw[part] === 'object' ? (raw[part] as T) : null);

export async function fetchMyHomePage(): Promise<HomePage> {
  const { data, error } = await supabase.rpc('my_home_page');
  if (error || !data || typeof data !== 'object') throw new FriendlyError('We couldn’t load your games.');
  const raw = data as Raw;
  return {
    progress: row<MyProgress>(raw, 'progress'),
    botRecent: tidyRecentGames(list<RecentGameRow>(raw, 'botRecent')),
    botStats: list<GameStats>(raw, 'botStats'),
    friendRecent: list<FriendGame>(raw, 'friendRecent'),
    friendStats: list<FriendStats>(raw, 'friendStats'),
    friendOpen: list<FriendGame>(raw, 'friendOpen'),
    players: cardsById(list<PlayerCard>(raw, 'players')),
    spaceRecent: list<SpaceGame>(raw, 'spaceRecent'),
    spaceOpen: list<SpaceGame>(raw, 'spaceOpen'),
    spaceStats: row(raw, 'spaceStats'),
    cardRecent: list<SeatSummary>(raw, 'cardRecent'),
    cardOpen: list<SeatSummary>(raw, 'cardOpen'),
    cardStats: row(raw, 'cardStats'),
    powerRecent: list<PowerGame>(raw, 'powerRecent'),
    powerOpen: list<PowerGame>(raw, 'powerOpen'),
    powerStats: row(raw, 'powerStats'),
    moves: movesFromRaw(row<RawMovesLeft>(raw, 'movesLeft')),
    season: readClock(row<RawMovesLeft>(raw, 'movesLeft')?.season),
    lordSeason: readLordSeason(row<RawMovesLeft>(raw, 'movesLeft')?.lordSeason, row<RawMovesLeft>(raw, 'movesLeft')?.lord, nzDate(new Date())),
    parts: Object.fromEntries(CARD_PARTS.filter((part) => part in raw).map((part) => [part, raw[part]])),
  };
}

/**
 * A card's part of the home page's answer. Shown anywhere else (no answer), or if the answer has no such part, the card asks for
 * itself. If the home page's one request failed, this fails too, so the card shows what it shows when its own request fails.
 */
export function partOf<T>(homePage: Promise<HomePage> | undefined, part: CardPart, read: (raw: unknown) => T, own: () => Promise<T>): Promise<T> {
  if (!homePage) return own();
  return homePage.then((home) => (part in home.parts ? read(home.parts[part]) : own()));
}
