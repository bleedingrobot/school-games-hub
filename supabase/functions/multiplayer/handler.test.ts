import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import {
  multiplayerHandler,
  WAITING_GAME_MS,
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

describe('the multiplayer server function', () => {
  it('refuses strangers, your own game, other schools, full or expired games, hidden students and a paused class', async () => {
    const w = world();
    expect((await w.ask(null, { action: 'create', game: 'chess', side: 'first' })).status).toBe(401);
    const made = await w.ask('ana', { action: 'create', game: 'chess', side: 'first', first_player: 'ben', lobby: true });
    expect(made.game).toMatchObject({ first_player: 'ana', second_player: null, created_by: 'ana', status: 'waiting' });
    const game = made.game!;
    expect((await w.ask('ana', { action: 'join', code: game.code })).problem).toBe('own-game');
    w.players.get('ben')!.schoolId = 2;
    expect((await w.ask('ben', { action: 'join', code: game.code })).problem).toBe('not-found');
    expect((await w.ask('ben', { action: 'join', gameId: game.id })).problem).toBe('not-found');
    w.players.get('ben')!.schoolId = 1;
    expect((await w.ask('ben', { action: 'join', code: game.code })).game!.status).toBe('playing');
    expect((await w.ask('cat', { action: 'join', gameId: game.id })).problem).toBe('full');

    const old = (await w.ask('cat', { action: 'create', game: 'chess', side: 'first' })).game!;
    w.tick(WAITING_GAME_MS + 1);
    expect((await w.ask('dan', { action: 'join', code: old.code })).problem).toBe('expired');

    w.players.get('ana')!.hidden = true;
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 })).problem).toBe('hidden');
    expect((await w.ask('ana', { action: 'create', game: 'chess', side: 'first' })).problem).toBe('hidden');
    w.players.get('ana')!.hidden = false;

    const waiting = (await w.ask('cat', { action: 'create', game: 'chess', side: 'first' })).game!;
    w.setMultiplayer(false);
    expect((await w.ask('dan', { action: 'create', game: 'chess', side: 'first' })).problem).toBe('paused');
    expect((await w.ask('dan', { action: 'join', code: waiting.code })).problem).toBe('paused');
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 })).problem).toBe('paused');
  });

  it('lets only one of two students in, and only one of two moves through, when they arrive at the same moment', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first', lobby: true });
    w.holdLoads(2);
    const [ben, cat] = await Promise.all([
      w.ask('ben', { action: 'join', gameId: game!.id }),
      w.ask('cat', { action: 'join', gameId: game!.id }),
    ]);
    expect([ben.status, cat.status].sort()).toEqual([200, 409]);
    w.holdLoads(2);
    const results = await Promise.all([
      w.ask('ana', { action: 'move', gameId: game!.id, move: 'e2e4', ply: 0 }),
      w.ask('ana', { action: 'move', gameId: game!.id, move: 'd2d4', ply: 0 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(w.games.get(game!.id)!.moves).toHaveLength(1);
  });

  it('keeps turn order, refuses illegal moves, outsiders and old boards, and decides checkmate itself', async () => {
    const w = world();
    const game = await w.started();
    expect((await w.ask('ben', { action: 'move', gameId: game.id, move: 'e7e5', ply: 0 })).problem).toBe('not-your-turn');
    for (const move of ['e2e5', 'e7e5', 'nonsense', '', 42]) {
      expect((await w.ask('ana', { action: 'move', gameId: game.id, move, ply: 0 })).problem).toBe('illegal');
    }
    expect((await w.ask('cat', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 })).problem).toBe('not-yours');
    expect((await w.ask('cat', { action: 'resign', gameId: game.id })).problem).toBe('not-yours');
    await w.play(game.id, ['f2f3']);
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'd2d4', ply: 1 })).problem).toBe('not-your-turn');
    expect((await w.ask('ben', { action: 'move', gameId: game.id, move: 'e7e5', ply: 0 })).problem).toBe('changed');
    const { game: done } = await w.play(game.id, FOOLS_MATE.slice(1));
    expect(done).toMatchObject({ status: 'finished', winner: 'second', reason: 'checkmate', counts_for_points: false });
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 4 })).problem).toBe('over');
    expect((await w.ask('ana', { action: 'resign', gameId: game.id })).problem).toBe('over');
  });

  it('referees checkers too, including compulsory jumps', async () => {
    const w = world();
    const game = await w.started('checkers');
    await w.play(game.id, ['11-15', '22-18']);
    // Red must jump, so a quiet move is refused.
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: '9-13', ply: 2 })).problem).toBe('illegal');
    const { game: after } = await w.ask('ana', { action: 'move', gameId: game.id, move: '15x22', ply: 2 });
    expect(after!.moves).toEqual(['11-15', '22-18', '15x22']);
  });

  it('lets you claim the win only after your opponent has had 2 minutes, never on your own turn', async () => {
    const w = world();
    const game = await w.started();
    expect((await w.ask('ana', { action: 'claim-win', gameId: game.id })).problem).toBe('not-yet');
    await w.play(game.id, ['e2e4']);
    w.tick(119_000);
    expect(await w.ask('ana', { action: 'claim-win', gameId: game.id })).toMatchObject({ status: 409, problem: 'not-yet', secondsLeft: 1 });
    w.tick(1000);
    const { game: done } = await w.ask('ana', { action: 'claim-win', gameId: game.id });
    expect(done).toMatchObject({ status: 'finished', winner: 'first', reason: 'abandoned', counts_for_points: false });
  });

  it('makes resigning a loss for the one who resigns, and a draw needs the other player to accept', async () => {
    const w = world();
    const game = await w.started();
    expect((await w.ask('ana', { action: 'offer-draw', gameId: game.id })).game!.draw_offer).toBe('first');
    expect((await w.ask('ana', { action: 'answer-draw', gameId: game.id, accept: true })).problem).toBe('no-offer');
    const { game: drawn } = await w.ask('ben', { action: 'answer-draw', gameId: game.id, accept: true });
    expect(drawn).toMatchObject({ status: 'finished', winner: null, reason: 'agreed-draw' });
    const second = await w.started();
    await w.play(second.id, ['e2e4']);
    const { game: done } = await w.ask('ben', { action: 'resign', gameId: second.id });
    expect(done).toMatchObject({ status: 'finished', winner: 'first', reason: 'resigned', counts_for_points: false });
  });
});

describe('the deployable file', () => {
  it('has an up-to-date index.ts (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('multiplayer');
    expect(readFileSync(resolve('supabase/functions/multiplayer/index.ts'), 'utf8')).toBe(built);
  });
});
