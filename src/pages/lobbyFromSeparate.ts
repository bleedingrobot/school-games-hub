/**
 * For tests that fake the lobby's old separate fetchers (Lobby.test.tsx, LobbyPower.test.tsx): the lobby's one request (S.4,
 * src/data/lobby.ts), answered from those same fakes, so the tests can stay as they were. Use it with
 * vi.mock('../data/lobby', async () => ({ fetchLobbyPage: (await import('./lobbyFromSeparate')).lobbyFromSeparate })).
 */
import { fetchCardLobby, fetchMyOpenCardGames } from '../data/cardGames';
import type { LobbyPage } from '../data/lobby';
import { fetchLobby, fetchMyOpenGames, fetchPlayerCards } from '../data/multiplayer';
import { fetchMyOpenPowerGames, fetchPowerLobby } from '../data/powerGames';
import { fetchMyOpenSpaceGames, fetchSpaceLobby } from '../data/spaceGames';

export async function lobbyFromSeparate(): Promise<LobbyPage> {
  const [friendLobby, friendOpen, spaceLobby, spaceOpen, cardLobby, cardOpen, powerLobby, powerOpen] = await Promise.all([
    fetchLobby(),
    fetchMyOpenGames(),
    fetchSpaceLobby(),
    fetchMyOpenSpaceGames(),
    fetchCardLobby(),
    fetchMyOpenCardGames(),
    fetchPowerLobby(),
    fetchMyOpenPowerGames(),
  ]);
  const players = [
    ...friendOpen.flatMap((g) => [g.first_player, g.second_player]),
    ...spaceOpen.flatMap((g) => [g.seat1, g.seat2, g.seat3, g.seat4]),
    ...cardOpen.flatMap((s) => s.info.players),
    ...powerOpen.flatMap((g) => [g.seat1, g.seat2]),
  ].filter((id): id is string => !!id);
  return { friendLobby, friendOpen, spaceLobby, spaceOpen, cardLobby, cardOpen, powerLobby, powerOpen, players: await fetchPlayerCards(players) };
}
