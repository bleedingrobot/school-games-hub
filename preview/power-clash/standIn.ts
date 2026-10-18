/**
 * A STAND-IN for the real server, for the Power Clash preview. NOT the real thing.
 *
 * It runs the very same referee code the real "power-clash" server function runs
 * (supabase/functions/power-clash/handler.ts), but "the database" is this browser's
 * localStorage and "live updates" are a BroadcastChannel. Two tabs of the same page are two
 * students: open it twice, pick Ana in one and Ben in the other. Nothing leaves your computer.
 *
 * The real thing needs the database changes applied and the function deployed. This lets
 * you play the classmates game before that.
 */
import { MultiplayerError, type LiveStatus, type PlayerCard } from '../../src/data/multiplayer';
import { FriendlyError } from '../../src/data/profile';
import type { PowerAction, PowerGame, PowerLobbyGame } from '../../src/data/powerGames';
import { powerClashHandler, type NewPowerGame, type PowerGameRow, type Services } from '../../supabase/functions/power-clash/handler';

export const PLAYERS: Record<string, string> = { ana: 'Ana Kiwi', ben: 'Ben Tui', cat: 'Cat Fantail' };

const DB_KEY = 'power-clash-standin-db';
const SKEW_KEY = 'power-clash-standin-skew';
const ME_KEY = 'power-clash-standin-me';
const channel = new BroadcastChannel('power-clash-standin');

interface Db {
  games: Record<string, PowerGameRow>;
  next: number;
}

const readDb = (): Db => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* start again */
  }
  return { games: {}, next: 1 };
};
const writeDb = (db: Db) => localStorage.setItem(DB_KEY, JSON.stringify(db));
const clone = <T,>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

/** One thing at a time across all tabs, like the database's "only if nothing changed" check. */
function locked<T>(work: () => T): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('power-clash-standin', async () => work());
  }
  return Promise.resolve(work());
}

const skew = () => Number(localStorage.getItem(SKEW_KEY) ?? 0) || 0;

/** Who this tab is. Set with ?as=ana, or by the buttons at the top. */
export function whoAmI(): string {
  const asked = new URLSearchParams(location.search).get('as') ?? new URLSearchParams(location.hash.split('?')[1] ?? '').get('as');
  if (asked && asked in PLAYERS) sessionStorage.setItem(ME_KEY, asked);
  const kept = sessionStorage.getItem(ME_KEY);
  return kept && kept in PLAYERS ? kept : 'ana';
}
export function chooseWhoIAm(id: string) {
  sessionStorage.setItem(ME_KEY, id);
  location.href = location.pathname + '#/lobby';
  location.reload();
}

const tell = (id: string) => channel.postMessage({ type: 'game', id });

const services: Services = {
  now: () => Date.now() + skew(),
  random: () => Math.random(),
  userIdFor: async (token) => (token in PLAYERS ? token : null),
  playerStatus: async (player) => ({
    school: player in PLAYERS,
    hidden: false,
    multiplayerEnabled: true,
    schoolId: 1,
    createdLastHour: Object.values(readDb().games).filter((g) => g.host === player && Date.now() + skew() - Date.parse(g.created_at) < 3_600_000).length,
    gone: [],
  }),
  loadGame: (id) => locked(() => clone(readDb().games[id]) ?? null),
  findWaitingByCode: (code) => locked(() => clone(Object.values(readDb().games).find((g) => g.status === 'waiting' && g.code === code)) ?? null),
  codeTaken: (code) => locked(() => Object.values(readDb().games).some((g) => g.status === 'waiting' && g.code === code)),
  findWaitingHostedBy: (player) => locked(() => clone(Object.values(readDb().games).find((g) => g.status === 'waiting' && g.host === player)) ?? null),
  insertGame: (row: NewPowerGame) =>
    locked(() => {
      const db = readDb();
      const waiting = Object.values(db.games).filter((g) => g.status === 'waiting');
      if (waiting.some((g) => g.code === row.code)) return 'code-taken' as const;
      if (waiting.some((g) => g.host === row.host)) return 'already-waiting' as const;
      const game: PowerGameRow = {
        id: `game-${db.next++}`,
        seat2: null,
        game: null,
        events: [],
        version: 0,
        created_at: new Date(Date.now() + skew()).toISOString(),
        started_at: null,
        deadline: null,
        last_action_at: null,
        finished_at: null,
        ending: null,
        leaver: null,
        won: null,
        counts: null,
        stats: null,
        rematch_game: null,
        ...clone(row),
      };
      db.games[game.id] = game;
      writeDb(db);
      tell(game.id);
      return clone(game);
    }),
  updateGame: (id, version, patch) =>
    locked(() => {
      const db = readDb();
      const game = db.games[id];
      if (!game || game.version !== version) return null;
      Object.assign(game, clone(patch));
      writeDb(db);
      tell(id);
      return clone(game);
    }),
};

const handle = powerClashHandler(services);

// ---- Pretend problems, for trying the screens ----
let offline = false;
const watchers = new Set<{ onLive: (s: LiveStatus) => void; onPresent: (ids: string[] | null) => void }>();
export const controls = {
  setOffline(value: boolean) {
    offline = value;
    for (const w of watchers) {
      w.onLive(value ? 'down' : 'live');
      if (value) w.onPresent(null);
    }
  },
  isOffline: () => offline,
  /** Moves the server's clock forward (every tab reloads to pick it up). */
  jump(ms: number) {
    localStorage.setItem(SKEW_KEY, String(skew() + ms));
    channel.postMessage({ type: 'reload' });
    location.reload();
  },
  reset() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SKEW_KEY);
    channel.postMessage({ type: 'reload' });
    location.reload();
  },
};
channel.addEventListener('message', (e) => {
  if (e.data?.type === 'reload') location.reload();
});
(window as unknown as { __powerClashStandIn: unknown }).__powerClashStandIn = controls;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const down = () => new MultiplayerError('We couldn’t reach the server. Check the Wi-Fi and try again.', 'offline');

// ---- The same functions the real pages call (src/data/powerGames.ts) ----

export async function askPower(request: PowerAction): Promise<PowerGame> {
  await sleep(150 + Math.random() * 150);
  if (offline) throw down();
  const response = await handle(
    new Request('http://stand-in/power-clash', {
      method: 'POST',
      headers: { Authorization: `Bearer ${whoAmI()}`, 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify(request),
    }),
  );
  const body = (await response.json()) as { game?: PowerGame; error?: string; problem?: string; secondsLeft?: number };
  if (response.ok && body.game) return body.game;
  throw new MultiplayerError(body.error ?? 'Something went wrong. Please try again.', body.problem ?? 'failed', body.secondsLeft);
}

const mine = (g: PowerGameRow) => g.seat1 === whoAmI() || g.seat2 === whoAmI();

export async function fetchPowerGame(id: string): Promise<PowerGame | null> {
  if (offline) throw new FriendlyError('We couldn’t load this game.');
  const game = await services.loadGame(id);
  return game && mine(game) ? (game as unknown as PowerGame) : null;
}

export async function fetchMyOpenPowerGames(): Promise<PowerGame[]> {
  if (offline) throw new FriendlyError('We couldn’t load your games.');
  const all = Object.values(readDb().games).filter((g) => mine(g) && (g.status === 'playing' || g.status === 'waiting'));
  return all.reverse() as unknown as PowerGame[];
}

export async function fetchPowerLobby(): Promise<PowerLobbyGame[]> {
  if (offline) throw new FriendlyError('We couldn’t load the lobby.');
  return Object.values(readDb().games)
    .filter((g) => g.status === 'waiting' && g.in_lobby && g.seat2 === null && g.seat1 !== whoAmI())
    .map((g) => ({ id: g.id, creator_name: PLAYERS[g.host ?? ''] ?? 'A classmate', creator_avatar: {}, created_at: g.created_at }));
}

export function watchPowerGame(
  id: string,
  me: string,
  handlers: { onGame: (game: PowerGame) => void; onLive: (status: LiveStatus) => void; onPresent: (playerIds: string[] | null) => void },
): { stop(): void } {
  const seen = new Map<string, number>();
  const listener = (e: MessageEvent) => {
    if (e.data?.type === 'game' && e.data.id === id && !offline) {
      const game = readDb().games[id];
      if (game) handlers.onGame(clone(game) as unknown as PowerGame);
    }
    if (e.data?.type === 'here' && e.data.id === id) seen.set(e.data.who, Date.now());
  };
  channel.addEventListener('message', listener);
  const beat = window.setInterval(() => {
    if (offline) return;
    channel.postMessage({ type: 'here', id, who: me });
    seen.set(me, Date.now());
    handlers.onPresent([...seen].filter(([, at]) => Date.now() - at < 5000).map(([who]) => who));
  }, 1000);
  const watcher = { onLive: handlers.onLive, onPresent: handlers.onPresent };
  watchers.add(watcher);
  handlers.onLive(offline ? 'down' : 'live');
  channel.postMessage({ type: 'here', id, who: me });
  return {
    stop() {
      channel.removeEventListener('message', listener);
      window.clearInterval(beat);
      watchers.delete(watcher);
    },
  };
}

export async function fetchClockOffset(): Promise<number> {
  return skew();
}

export async function fetchPlayerCards(ids: string[]): Promise<Map<string, PlayerCard>> {
  return new Map(ids.filter((id) => id in PLAYERS).map((id) => [id, { id, display_name: PLAYERS[id], avatar: {} }]));
}
