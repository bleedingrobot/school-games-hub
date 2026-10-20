/**
 * The lobby in one request (docs/SERVER-LOAD-PLAN.md, S.4): lobby() answers with everything the lobby used to ask for one by one
 * on each refresh (about 9 requests every 20 seconds): the open games anyone can join, my own open games of every kind, and the
 * names and avatars of the other players in them. The playing-friends switch is not in it: it comes from the remembered settings
 * read (settingsMemory.ts).
 */
import { supabase } from '../lib/supabase';
import { stillOpenSeats, type CardLobbyGame, type SeatSummary } from './cardGames';
import { cardsById, stillOpen, type FriendGame, type LobbyGame, type PlayerCard } from './multiplayer';
import type { PowerGame, PowerLobbyGame } from './powerGames';
import { FriendlyError } from './profile';
import type { SpaceGame, SpaceLobbyGame } from './spaceGames';

export interface LobbyPage {
  /** The open games anyone can join, each kind newest first. */
  friendLobby: LobbyGame[];
  spaceLobby: SpaceLobbyGame[];
  cardLobby: CardLobbyGame[];
  powerLobby: PowerLobbyGame[];
  /** My own games being played or waiting, newest first, without the waiting ones past their time (as before). */
  friendOpen: FriendGame[];
  spaceOpen: SpaceGame[];
  cardOpen: SeatSummary[];
  powerOpen: PowerGame[];
  /** Names and avatars of the other players in my games. Hidden players are left out. */
  players: Map<string, PlayerCard>;
}

type Raw = Record<string, unknown>;

const list = <T>(raw: Raw, part: string): T[] => (Array.isArray(raw[part]) ? (raw[part] as T[]) : []);

export async function fetchLobbyPage(): Promise<LobbyPage> {
  const { data, error } = await supabase.rpc('lobby');
  if (error || !data || typeof data !== 'object') throw new FriendlyError('We couldn’t load the lobby.');
  const raw = data as Raw;
  return {
    friendLobby: list<LobbyGame>(raw, 'friendLobby'),
    spaceLobby: list<SpaceLobbyGame>(raw, 'spaceLobby'),
    cardLobby: list<CardLobbyGame>(raw, 'cardLobby'),
    powerLobby: list<PowerLobbyGame>(raw, 'powerLobby'),
    friendOpen: stillOpen(list<FriendGame>(raw, 'friendOpen')),
    spaceOpen: stillOpen(list<SpaceGame>(raw, 'spaceOpen')),
    cardOpen: stillOpenSeats(list<SeatSummary>(raw, 'cardOpen')),
    powerOpen: stillOpen(list<PowerGame>(raw, 'powerOpen')),
    players: cardsById(list<PlayerCard>(raw, 'players')),
  };
}
