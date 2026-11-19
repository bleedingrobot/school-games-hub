/**
 * The Lobby's live games (docs/plans/play-anyone/PLAN.md, section D, stage 3): Archery fights, Dragon Maths clashes and
 * Clan duels, plus the Sky race and Village Raid tiles.
 *
 * - `lobby_here()` (one read, every 20 seconds with the open games) says what I can start in each game, my own fights
 *   that are waiting or going, and who is here now with what we could play together. It records nothing: the hub's own
 *   `hub_here()` (useHubAsks) already says "I'm here".
 * - A challenge goes through that game's own server step (the same one the game's own list uses); each game's data
 *   module loads only when it's needed.
 */
import { supabase } from '../lib/supabase';
import { readClassBits, type SchoolPlayer } from '../components/SchoolPlayerList';
import { ASK_GAMES, type AskGame } from './hubAsks';

/** What I can do in a game from the Lobby: ready, nothing made yet (archer, hero, clan or island), or paused by the teacher. */
export type MyState = 'ready' | 'none' | 'off';
/** The Lobby's tiles that need something of mine: the three live games, the Sky race and the Village Raid. */
export type MyGame = AskGame | 'isles' | 'raid';
/** What I could play with one kid here: yes, they haven't made a hero or clan, their class has it paused, or they're busy. */
export type WithThem = 'ok' | 'none' | 'off' | 'busy';

export interface HerePlayer extends SchoolPlayer {
  avatar: unknown;
  /** Their clan's id for a duel (only when I have a clan myself). */
  clan: string | null;
  /** Only the live games I can play myself. */
  games: Partial<Record<AskGame, WithThem>>;
}

export interface GoingFight {
  game: AskGame;
  id: number;
  /** 'asked' is my own challenge, waiting for a yes. */
  status: 'asked' | 'packing' | 'playing';
  with: string;
}

export interface LobbyHere {
  me: Record<MyGame, MyState>;
  going: GoingFight[];
  online: HerePlayer[];
}

const MY_GAMES: MyGame[] = [...ASK_GAMES, 'isles', 'raid'];
const isAskGame = (g: unknown): g is AskGame => typeof g === 'string' && (ASK_GAMES as readonly string[]).includes(g);
const WITH: WithThem[] = ['ok', 'none', 'off', 'busy'];

/** Reads lobby_here()'s reply, leaving out anything it can't read. Exported for the tests. */
export function readLobbyHere(data: unknown): LobbyHere | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as { me?: unknown; going?: unknown; online?: unknown };
  const mine = (raw.me && typeof raw.me === 'object' ? raw.me : {}) as Record<string, unknown>;
  const me = Object.fromEntries(
    MY_GAMES.map((g) => [g, mine[g] === 'ready' || mine[g] === 'none' ? mine[g] : 'off']),
  ) as Record<MyGame, MyState>;
  const going: GoingFight[] = (Array.isArray(raw.going) ? raw.going : []).flatMap((g: Record<string, unknown>) =>
    g && isAskGame(g.game) && Number.isSafeInteger(g.id) && typeof g.with === 'string' && ['asked', 'packing', 'playing'].includes(g.status as string)
      ? [{ game: g.game, id: g.id as number, status: g.status as GoingFight['status'], with: g.with }]
      : [],
  );
  const online: HerePlayer[] = (Array.isArray(raw.online) ? raw.online : []).flatMap((o: Record<string, unknown>) => {
    if (!o || typeof o.id !== 'string' || typeof o.name !== 'string') return [];
    const games = (o.games && typeof o.games === 'object' ? o.games : {}) as Record<string, unknown>;
    return [{
      id: o.id,
      name: o.name,
      avatar: o.avatar ?? null,
      clan: typeof o.clan === 'string' ? o.clan : null,
      games: Object.fromEntries(ASK_GAMES.flatMap((g) => (WITH.includes(games[g] as WithThem) ? [[g, games[g]]] : []))),
      ...readClassBits(o),
    }];
  });
  return { me, going, online };
}

export async function fetchLobbyHere(): Promise<LobbyHere | null> {
  try {
    const { data, error } = await supabase.rpc('lobby_here');
    if (error) return null;
    return readLobbyHere(data);
  } catch {
    return null;
  }
}

/** Where a game opens at its fight, clash or duel screen (after a challenge is sent, or for "Carry on"). */
export const livePath = (game: AskGame) => (game === 'archery' ? '/archery' : `/${game}?open=live`);

/** Sends a challenge through the game's own server step. Null if it went; otherwise the game's words for why not. */
export async function sendChallenge(game: AskGame, them: HerePlayer): Promise<string | null> {
  if (game === 'archery') {
    const [{ archeryApi, serverTransport }, { loadChoices }] = await Promise.all([import('./archery'), import('../games/archery/prefs')]);
    const r = await archeryApi(serverTransport).duelChallenge(them.id, loadChoices().world);
    return r.ok ? null : r.message;
  }
  if (game === 'dragon-maths') {
    const { sendClash } = await import('./lordClash');
    const r = await sendClash({ action: 'clash-challenge', other: them.id });
    return r.ok ? null : r.message;
  }
  if (!them.clan) return 'They haven’t started a clan yet.';
  const { sendDuel } = await import('./clanDuel');
  const r = await sendDuel({ action: 'duel-challenge', other: them.clan });
  return r.ok ? null : r.message;
}
