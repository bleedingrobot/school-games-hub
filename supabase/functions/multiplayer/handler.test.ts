import { describe, expect, it } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import {
  multiplayerHandler,
  type GameRow,
  type NewGame,
  type PlayerStatus,
  type Services,
} from './handler';

const START = Date.parse('2026-10-20T09:00:00Z');
const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

/** A pretend Supabase: games in memory, a clock we can move, and "save only if unchanged". */
function world() {
  let clock = START;
  let nextId = 1;
  const games = new Map<string, GameRow>();
  const players = new Map<string, PlayerStatus>();
  const tokens = new Map<string, string>();
  let settingsOn = true;
  // Lets a test hold every game load until `n` of them are waiting, so requests overlap.
  let gate: { n: number; waiting: (() => void)[] } | null = null;

  for (const name of ['ana', 'ben', 'cat', 'dan']) {
    players.set(name, { school: true, hidden: false, multiplayerEnabled: true, createdLastHour: 0, schoolId: 1 });
    tokens.set(`${name}-token`, name);
  }

  const copy = (g: GameRow | undefined) => (g ? structuredClone(g) : null);

  const services: Services = {
    now: () => clock,
    random: seeded(7),
    userIdFor: async (token) => tokens.get(token) ?? null,
    playerStatus: async (player) => {
      const p = players.get(player);
      if (!p) return null;
      const created = [...games.values()].filter(
        (g) => g.created_by === player && clock - Date.parse(g.created_at) < 3_600_000,
      ).length;
      return { ...p, multiplayerEnabled: settingsOn, createdLastHour: created };
    },
    loadGame: async (id) => {
      if (gate) {
        const g = gate;
        await new Promise<void>((go) => {
          g.waiting.push(go);
          if (g.waiting.length >= g.n) {
            gate = null;
            g.waiting.forEach((release) => release());
          }
        });
      }
      return copy(games.get(id));
    },
    findWaitingByCode: async (code) => copy([...games.values()].find((g) => g.status === 'waiting' && g.code === code)),
    findWaitingCreatedBy: async (player) =>
      copy([...games.values()].find((g) => g.status === 'waiting' && g.created_by === player)),
    insertGame: async (row: NewGame) => {
      const waiting = [...games.values()].filter((g) => g.status === 'waiting');
      if (row.status === 'waiting' && waiting.some((g) => g.code === row.code)) return 'code-taken';
      if (row.status === 'waiting' && waiting.some((g) => g.created_by === row.created_by)) return 'already-waiting';
      const game: GameRow = {
        id: `game-${nextId++}`,
        moves: [],
        version: 0,
        created_at: new Date(clock).toISOString(),
        started_at: null,
        turn_started_at: null,
        draw_offer: null,
        first_draw_offers: 0,
        second_draw_offers: 0,
        first_offer_ply: null,
        second_offer_ply: null,
        winner: null,
        reason: null,
        counts_for_points: null,
        finished_at: null,
        first_wants_rematch: false,
        second_wants_rematch: false,
        rematch_game: null,
        ...row,
      };
      games.set(game.id, game);
      return copy(game)!;
    },
    updateGame: async (id, version, patch) => {
      const g = games.get(id);
      if (!g || g.version !== version) return null;
      Object.assign(g, structuredClone(patch));
      return copy(g);
    },
  };

  const handle = multiplayerHandler(services);
  async function ask(who: string | null, body: object) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
    if (who) headers.Authorization = `Bearer ${who}-token`;
    const response = await handle(new Request('http://x/multiplayer', { method: 'POST', headers, body: JSON.stringify(body) }));
    const json = (await response.json()) as { game?: GameRow; error?: string; problem?: string; secondsLeft?: number };
    return { status: response.status, ...json };
  }

  /** Ana makes a game (she plays first unless told otherwise) and Ben joins it. */
  async function started(game: 'chess' | 'checkers' = 'chess', side = 'first') {
    const made = await ask('ana', { action: 'create', game, side });
    const joined = await ask('ben', { action: 'join', code: made.game!.code });
    return joined.game!;
  }

  /** Plays moves in turn for whoever's turn it is. */
  async function play(id: string, moves: string[]) {
    let last;
    for (const move of moves) {
      const g = games.get(id)!;
      const mover = g.moves.length % 2 === 0 ? g.first_player : g.second_player;
      last = await ask(mover, { action: 'move', gameId: id, move, ply: g.moves.length });
      if (last.status !== 200) throw new Error(`${move}: ${last.problem}`);
    }
    return last!;
  }

  return {
    services,
    games,
    players,
    ask,
    started,
    play,
    tick: (ms: number) => (clock += ms),
    setMultiplayer: (on: boolean) => (settingsOn = on),
    holdLoads: (n: number) => (gate = { n, waiting: [] }),
  };
}

describe('multiplayer server', () => {
  it('only lets signed-in, visible students from the same school play while multiplayer is on', async () => {
    const w = world();
    expect((await w.ask(null, { action: 'create', game: 'chess', side: 'first' })).status).toBe(401);
    const made = await w.ask('ana', { action: 'create', game: 'chess', side: 'first', first_player: 'ben', lobby: true });
    expect(made.game).toMatchObject({ first_player: 'ana', created_by: 'ana', status: 'waiting' });

    // Another school's game looks like a code that doesn't exist.
    w.players.get('ben')!.schoolId = 2;
    expect((await w.ask('ben', { action: 'join', code: made.game!.code })).problem).toBe('not-found');
    w.players.get('ben')!.schoolId = 1;

    w.players.get('cat')!.hidden = true;
    expect((await w.ask('cat', { action: 'join', code: made.game!.code })).problem).toBe('hidden');

    w.setMultiplayer(false);
    expect((await w.ask('ben', { action: 'join', code: made.game!.code })).problem).toBe('paused');
    w.setMultiplayer(true);
    expect((await w.ask('ben', { action: 'join', code: made.game!.code })).game!.status).toBe('playing');

    // A flood of requests is turned away.
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await w.ask('dan', { action: 'resign', gameId: made.game!.id })).status;
    expect(last).toBe(429);
  });

  it('referees moves: right player, right turn, legal moves, and decides checkmate itself', async () => {
    const w = world();
    const game = await w.started();
    expect((await w.ask('ben', { action: 'move', gameId: game.id, move: 'e7e5', ply: 0 })).problem).toBe('not-your-turn');
    expect((await w.ask('cat', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 })).problem).toBe('not-yours');
    for (const move of ['e2e5', 'e7e5', 'nonsense', '', 42]) {
      expect((await w.ask('ana', { action: 'move', gameId: game.id, move, ply: 0 })).problem).toBe('illegal');
    }
    const { game: done } = await w.play(game.id, FOOLS_MATE);
    expect(done).toMatchObject({ status: 'finished', winner: 'second', reason: 'checkmate' });
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 4 })).problem).toBe('over');
  });

  it('lets only one of two joins, or two moves, sent at the same moment through', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first', lobby: true });
    w.holdLoads(2);
    const joins = await Promise.all([
      w.ask('ben', { action: 'join', gameId: game!.id }),
      w.ask('cat', { action: 'join', gameId: game!.id }),
    ]);
    expect(joins.map((r) => r.status).sort()).toEqual([200, 409]);

    w.holdLoads(2);
    const moves = await Promise.all([
      w.ask('ana', { action: 'move', gameId: game!.id, move: 'e2e4', ply: 0 }),
      w.ask('ana', { action: 'move', gameId: game!.id, move: 'd2d4', ply: 0 }),
    ]);
    expect(moves.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(w.games.get(game!.id)!.moves).toHaveLength(1);
  });
});
