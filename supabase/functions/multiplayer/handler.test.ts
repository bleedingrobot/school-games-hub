import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import { CODE_ALPHABET } from '../../../shared/multiplayer';
import { boardResult, Chess, legalUciMoves, playUci } from '../../../shared/chess/rules';
import {
  MAX_CREATES_PER_HOUR,
  multiplayerHandler,
  WAITING_GAME_MS,
  type GameRow,
  type NewGame,
  type PlayerStatus,
  type Services,
} from './handler';

const START = Date.parse('2026-10-20T09:00:00Z');
const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

/** A repeatable random chess game that hasn't ended after `plies` moves. */
function randomGame(plies: number): string[] {
  const chess = new Chess();
  const random = seeded(3);
  const moves: string[] = [];
  while (moves.length < plies) {
    const options = legalUciMoves(chess);
    const move = options[Math.floor(random() * options.length)];
    playUci(chess, move);
    moves.push(move);
    if (boardResult(chess)) throw new Error('pick another seed');
  }
  return moves;
}

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

describe('starting a game', () => {
  it('needs a real sign-in, and takes the player from the token', async () => {
    const w = world();
    expect((await w.ask(null, { action: 'create', game: 'chess', side: 'first' })).status).toBe(401);
    const made = await w.ask('ana', { action: 'create', game: 'chess', side: 'first', first_player: 'ben' });
    expect(made.game).toMatchObject({ first_player: 'ana', second_player: null, created_by: 'ana', status: 'waiting' });
  });

  it('gives a 5-character code with no lookalike characters', async () => {
    const w = world();
    for (let i = 0; i < 20; i++) {
      const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'random' });
      expect(game!.code).toMatch(/^.{5}$/);
      for (const c of game!.code!) expect(CODE_ALPHABET).toContain(c);
      expect(game!.code).not.toMatch(/[OI0L1SZB]/);
    }
  });

  it('lets the creator pick their colour, or pick at random', async () => {
    const w = world();
    expect((await w.ask('ana', { action: 'create', game: 'checkers', side: 'second' })).game).toMatchObject({
      first_player: null,
      second_player: 'ana',
      game: 'checkers',
    });
    const sides = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const { game } = await w.ask('ben', { action: 'create', game: 'chess', side: 'random' });
      sides.add(game!.first_player === 'ben' ? 'first' : 'second');
    }
    expect(sides).toEqual(new Set(['first', 'second']));
  });

  it('keeps only one waiting game per student: a new one cancels the old', async () => {
    const w = world();
    const first = (await w.ask('ana', { action: 'create', game: 'chess', side: 'first' })).game!;
    const second = (await w.ask('ana', { action: 'create', game: 'checkers', side: 'first', lobby: true })).game!;
    expect(w.games.get(first.id)!.status).toBe('cancelled');
    expect(second).toMatchObject({ status: 'waiting', in_lobby: true });
  });

  it('refuses bad requests', async () => {
    const w = world();
    expect((await w.ask('ana', { action: 'create', game: 'snakes', side: 'first' })).status).toBe(400);
    expect((await w.ask('ana', { action: 'create', game: 'chess', side: 'purple' })).status).toBe(400);
    expect((await w.ask('ana', { action: 'explode' })).status).toBe(400);
  });

  it('limits how many games a student can start in an hour', async () => {
    const w = world();
    for (let i = 0; i < MAX_CREATES_PER_HOUR; i++) {
      expect((await w.ask('ana', { action: 'create', game: 'chess', side: 'first' })).status).toBe(200);
    }
    expect(await w.ask('ana', { action: 'create', game: 'chess', side: 'first' })).toMatchObject({
      status: 429,
      problem: 'too-many',
    });
    w.tick(3_600_000);
    expect((await w.ask('ana', { action: 'create', game: 'chess', side: 'first' })).status).toBe(200);
  });

  it('lets the creator cancel a game nobody has joined, and nobody else', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first' });
    expect((await w.ask('ben', { action: 'cancel', gameId: game!.id })).status).toBe(403);
    expect((await w.ask('ana', { action: 'cancel', gameId: game!.id })).game!.status).toBe('cancelled');
    expect((await w.ask('ben', { action: 'join', code: game!.code })).problem).toBe('not-found');
  });

  it('hands back the started game if someone joined just before cancelling', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first' });
    await w.ask('ben', { action: 'join', code: game!.code });
    expect((await w.ask('ana', { action: 'cancel', gameId: game!.id })).game!.status).toBe('playing');
  });
});

describe('joining a game', () => {
  it('joins with the code, typed in any case with spaces, and starts the game', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'second' });
    const typed = `${game!.code!.slice(0, 3).toLowerCase()} ${game!.code!.slice(3)}`;
    const joined = await w.ask('ben', { action: 'join', code: typed });
    expect(joined.game).toMatchObject({
      first_player: 'ben',
      second_player: 'ana',
      status: 'playing',
      started_at: new Date(START).toISOString(),
      turn_started_at: new Date(START).toISOString(),
    });
  });

  it("doesn't let you join your own game", async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first' });
    expect((await w.ask('ana', { action: 'join', code: game!.code })).problem).toBe('own-game');
  });

  it('treats a game from another school like a code that does not exist', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first', lobby: true });
    w.players.get('ben')!.schoolId = 2;
    expect((await w.ask('ben', { action: 'join', code: game!.code })).problem).toBe('not-found');
    expect((await w.ask('ben', { action: 'join', gameId: game!.id })).problem).toBe('not-found');
    w.players.get('ben')!.schoolId = 1;
    expect((await w.ask('ben', { action: 'join', code: game!.code })).game!.status).toBe('playing');
  });

  it("doesn't let a third student join a full game", async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first', lobby: true });
    await w.ask('ben', { action: 'join', code: game!.code });
    expect((await w.ask('cat', { action: 'join', gameId: game!.id })).problem).toBe('full');
    expect((await w.ask('cat', { action: 'join', code: game!.code })).problem).toBe('not-found');
  });

  it('lets only one of two students in when they join at the same moment', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first', lobby: true });
    w.holdLoads(2);
    const [ben, cat] = await Promise.all([
      w.ask('ben', { action: 'join', gameId: game!.id }),
      w.ask('cat', { action: 'join', gameId: game!.id }),
    ]);
    expect([ben.status, cat.status].sort()).toEqual([200, 409]);
    expect(w.games.get(game!.id)!.second_player).toBe(ben.status === 200 ? 'ben' : 'cat');
  });

  it('says so kindly when the code is wrong, and limits guessing', async () => {
    const w = world();
    expect(await w.ask('ben', { action: 'join', code: 'CCCCC' })).toMatchObject({ status: 404, problem: 'not-found' });
    expect((await w.ask('ben', { action: 'join', code: 'hello there' })).problem).toBe('not-found');
    for (let i = 0; i < 8; i++) await w.ask('ben', { action: 'join', code: 'DDDDD' });
    expect((await w.ask('ben', { action: 'join', code: 'FFFFF' })).problem).toBe('too-many-codes');
  });

  it('only lets lobby games be joined without the code', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first' });
    expect((await w.ask('ben', { action: 'join', gameId: game!.id })).problem).toBe('not-found');
  });

  it('refuses a waiting game once it has expired', async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first' });
    w.tick(WAITING_GAME_MS + 1);
    expect((await w.ask('ben', { action: 'join', code: game!.code })).problem).toBe('expired');
  });

  it("cancels the joiner's own waiting game, so nobody joins it by mistake", async () => {
    const w = world();
    const bens = (await w.ask('ben', { action: 'create', game: 'checkers', side: 'first' })).game!;
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first' });
    await w.ask('ben', { action: 'join', code: game!.code });
    expect(w.games.get(bens.id)!.status).toBe('cancelled');
  });
});

describe('hidden students and the teacher’s switch', () => {
  it("won't let a hidden student start, join or move", async () => {
    const w = world();
    const game = await w.started();
    w.players.get('ana')!.hidden = true;
    expect((await w.ask('ana', { action: 'create', game: 'chess', side: 'first' })).problem).toBe('hidden');
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 })).problem).toBe('hidden');
    const bens = (await w.ask('ben', { action: 'create', game: 'chess', side: 'first' })).game!;
    expect((await w.ask('ana', { action: 'join', code: bens.code })).problem).toBe('hidden');
  });

  it("won't let anyone join a game made by a student who's since been hidden", async () => {
    const w = world();
    const { game } = await w.ask('ana', { action: 'create', game: 'chess', side: 'first' });
    w.players.get('ana')!.hidden = true;
    expect((await w.ask('ben', { action: 'join', code: game!.code })).problem).toBe('expired');
  });

  it('refuses new games, joins and moves while multiplayer is switched off', async () => {
    const w = world();
    const game = await w.started();
    const waiting = (await w.ask('cat', { action: 'create', game: 'chess', side: 'first' })).game!;
    w.setMultiplayer(false);
    expect(await w.ask('dan', { action: 'create', game: 'chess', side: 'first' })).toMatchObject({
      status: 403,
      problem: 'paused',
      error: 'Your teacher has paused games against friends for now.',
    });
    expect((await w.ask('dan', { action: 'join', code: waiting.code })).problem).toBe('paused');
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 })).problem).toBe('paused');
    // Games can still be ended.
    expect((await w.ask('ana', { action: 'resign', gameId: game.id })).game!.status).toBe('finished');
    w.setMultiplayer(true);
    expect((await w.ask('dan', { action: 'create', game: 'chess', side: 'first' })).status).toBe(200);
  });
});

describe('moves', () => {
  it('saves a legal move on your turn and starts the other player’s clock', async () => {
    const w = world();
    const game = await w.started();
    w.tick(5000);
    const { game: after } = await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 });
    expect(after).toMatchObject({ moves: ['e2e4'], status: 'playing', turn_started_at: new Date(START + 5000).toISOString() });
  });

  it('refuses moves out of turn', async () => {
    const w = world();
    const game = await w.started();
    expect((await w.ask('ben', { action: 'move', gameId: game.id, move: 'e7e5', ply: 0 })).problem).toBe('not-your-turn');
    await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 });
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'd2d4', ply: 1 })).problem).toBe('not-your-turn');
  });

  it('refuses illegal moves', async () => {
    const w = world();
    const game = await w.started();
    for (const move of ['e2e5', 'e7e5', 'nonsense', '', 42]) {
      expect((await w.ask('ana', { action: 'move', gameId: game.id, move, ply: 0 })).problem).toBe('illegal');
    }
    expect(w.games.get(game.id)!.moves).toEqual([]);
  });

  it('refuses moves from someone who isn’t playing', async () => {
    const w = world();
    const game = await w.started();
    expect(await w.ask('cat', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 })).toMatchObject({
      status: 403,
      problem: 'not-yours',
    });
    expect((await w.ask('cat', { action: 'resign', gameId: game.id })).problem).toBe('not-yours');
    expect((await w.ask('cat', { action: 'move', gameId: 'no-such-game', move: 'e2e4', ply: 0 })).problem).toBe('not-yours');
  });

  it('refuses a move made from an out-of-date board', async () => {
    const w = world();
    const game = await w.started();
    await w.play(game.id, ['e2e4', 'e7e5']);
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'd2d4', ply: 0 })).problem).toBe('changed');
  });

  it('lets only one of two moves sent at the same moment through', async () => {
    const w = world();
    const game = await w.started();
    w.holdLoads(2);
    const results = await Promise.all([
      w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 0 }),
      w.ask('ana', { action: 'move', gameId: game.id, move: 'd2d4', ply: 0 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(w.games.get(game.id)!.moves).toHaveLength(1);
  });

  it('decides checkmate itself, and refuses moves after the end', async () => {
    const w = world();
    const game = await w.started();
    const { game: done } = await w.play(game.id, FOOLS_MATE);
    expect(done).toMatchObject({ status: 'finished', winner: 'second', reason: 'checkmate', counts_for_points: false });
    expect((await w.ask('ana', { action: 'move', gameId: game.id, move: 'e2e4', ply: 4 })).problem).toBe('over');
    expect((await w.ask('ana', { action: 'resign', gameId: game.id })).problem).toBe('over');
  });

  it('counts a long finished game for points', async () => {
    const w = world();
    const game = await w.started();
    await w.play(game.id, randomGame(20));
    const { game: done } = await w.ask('ana', { action: 'resign', gameId: game.id });
    expect(done).toMatchObject({ winner: 'second', reason: 'resigned', counts_for_points: true });
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
});

describe('resigning and draws', () => {
  it('resigning is a loss for the one who resigns', async () => {
    const w = world();
    const game = await w.started();
    await w.play(game.id, ['e2e4']);
    const { game: done } = await w.ask('ben', { action: 'resign', gameId: game.id });
    expect(done).toMatchObject({ status: 'finished', winner: 'first', reason: 'resigned', counts_for_points: false });
  });

  it('a draw offer can be accepted', async () => {
    const w = world();
    const game = await w.started();
    expect((await w.ask('ana', { action: 'offer-draw', gameId: game.id })).game!.draw_offer).toBe('first');
    // You can't answer your own offer.
    expect((await w.ask('ana', { action: 'answer-draw', gameId: game.id, accept: true })).problem).toBe('no-offer');
    const { game: done } = await w.ask('ben', { action: 'answer-draw', gameId: game.id, accept: true });
    expect(done).toMatchObject({ status: 'finished', winner: null, reason: 'agreed-draw' });
  });

  it('a draw offer can be declined, or turned down by just moving', async () => {
    const w = world();
    const game = await w.started();
    await w.ask('ana', { action: 'offer-draw', gameId: game.id });
    expect((await w.ask('ben', { action: 'answer-draw', gameId: game.id, accept: false })).game!.draw_offer).toBeNull();
    await w.play(game.id, ['e2e4']);
    await w.ask('ana', { action: 'offer-draw', gameId: game.id });
    const { game: after } = await w.ask('ben', { action: 'move', gameId: game.id, move: 'e7e5', ply: 1 });
    expect(after!.draw_offer).toBeNull();
    expect((await w.ask('ben', { action: 'answer-draw', gameId: game.id, accept: true })).problem).toBe('no-offer');
  });

  it('two players offering a draw agree a draw', async () => {
    const w = world();
    const game = await w.started();
    await w.ask('ana', { action: 'offer-draw', gameId: game.id });
    expect((await w.ask('ben', { action: 'offer-draw', gameId: game.id })).game!.reason).toBe('agreed-draw');
  });

  it("doesn't let a student spam draw offers", async () => {
    const w = world();
    const game = await w.started();
    await w.ask('ana', { action: 'offer-draw', gameId: game.id });
    await w.ask('ben', { action: 'answer-draw', gameId: game.id, accept: false });
    expect((await w.ask('ana', { action: 'offer-draw', gameId: game.id })).problem).toBe('draw-wait');

    // 5 of Ana's own moves later, she can offer again; three offers in all.
    const moves = randomGame(40);
    for (let offer = 2; offer <= 3; offer++) {
      await w.play(game.id, moves.slice(w.games.get(game.id)!.moves.length, (offer - 1) * 10));
      expect((await w.ask('ana', { action: 'offer-draw', gameId: game.id })).status).toBe(200);
      await w.ask('ben', { action: 'answer-draw', gameId: game.id, accept: false });
    }
    expect(w.games.get(game.id)!.first_draw_offers).toBe(3);
    await w.play(game.id, moves.slice(20, 40));
    expect((await w.ask('ana', { action: 'offer-draw', gameId: game.id })).problem).toBe('draw-limit');
  });
});

describe('the 2-minute rule', () => {
  it('lets you claim the win only after your opponent has had 2 minutes, by the server’s clock', async () => {
    const w = world();
    const game = await w.started();
    await w.play(game.id, ['e2e4']);
    w.tick(119_000);
    expect(await w.ask('ana', { action: 'claim-win', gameId: game.id })).toMatchObject({
      status: 409,
      problem: 'not-yet',
      secondsLeft: 1,
    });
    w.tick(1000);
    const { game: done } = await w.ask('ana', { action: 'claim-win', gameId: game.id });
    expect(done).toMatchObject({ status: 'finished', winner: 'first', reason: 'abandoned', counts_for_points: false });
  });

  it("can't be claimed on your own turn", async () => {
    const w = world();
    const game = await w.started();
    w.tick(10 * 60_000);
    expect((await w.ask('ana', { action: 'claim-win', gameId: game.id })).problem).toBe('not-yet');
    // Ben can claim, though: Ana hasn't made her first move.
    expect((await w.ask('ben', { action: 'claim-win', gameId: game.id })).game!.winner).toBe('second');
  });

  it('restarts the clock with every move', async () => {
    const w = world();
    const game = await w.started();
    w.tick(110_000);
    await w.play(game.id, ['e2e4']);
    w.tick(110_000);
    expect((await w.ask('ana', { action: 'claim-win', gameId: game.id })).problem).toBe('not-yet');
  });
});

describe('rematch', () => {
  it('needs both players, then starts a new game with the colours swapped', async () => {
    const w = world();
    const game = await w.started('checkers');
    await w.ask('ana', { action: 'resign', gameId: game.id });
    const asked = await w.ask('ana', { action: 'rematch', gameId: game.id });
    expect(asked.game).toMatchObject({ first_wants_rematch: true, rematch_game: null });
    const { game: old } = await w.ask('ben', { action: 'rematch', gameId: game.id });
    const next = w.games.get(old!.rematch_game!)!;
    expect(next).toMatchObject({ game: 'checkers', status: 'playing', first_player: 'ben', second_player: 'ana', moves: [] });
  });

  it('starts just one new game when both press at the same moment', async () => {
    const w = world();
    const game = await w.started();
    await w.ask('ana', { action: 'resign', gameId: game.id });
    w.holdLoads(2);
    await Promise.all([
      w.ask('ana', { action: 'rematch', gameId: game.id }),
      w.ask('ben', { action: 'rematch', gameId: game.id }),
    ]);
    const live = [...w.games.values()].filter((g) => g.status === 'playing');
    expect(live).toHaveLength(1);
    expect(w.games.get(game.id)!.rematch_game).toBe(live[0].id);
  });

  it("isn't possible before the game ends, or once the opponent is hidden", async () => {
    const w = world();
    const game = await w.started();
    expect((await w.ask('ana', { action: 'rematch', gameId: game.id })).status).toBe(400);
    await w.ask('ana', { action: 'resign', gameId: game.id });
    w.players.get('ben')!.hidden = true;
    expect((await w.ask('ana', { action: 'rematch', gameId: game.id })).problem).toBe('no-opponent');
  });
});

describe('the server function itself', () => {
  it('turns away a student sending far too many requests', async () => {
    const w = world();
    const game = await w.started();
    const results = [];
    for (let i = 0; i < 61; i++) results.push((await w.ask('cat', { action: 'resign', gameId: game.id })).status);
    expect(results.at(-1)).toBe(429);
  });

  it('answers the browser’s permission check', async () => {
    const response = await multiplayerHandler(world().services)(
      new Request('http://x/multiplayer', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('7200');
  });

  it('refuses huge or unreadable requests', async () => {
    const w = world();
    const game = await w.started();
    const handle = multiplayerHandler(w.services);
    const send = (body: string) =>
      handle(new Request('http://x/multiplayer', { method: 'POST', headers: { Authorization: 'Bearer ana-token' }, body }));
    const huge = await send(JSON.stringify({ action: 'resign', gameId: game.id, padding: 'x'.repeat(70_000) }));
    expect(huge.status).toBe(400);
    expect((await send('{"action": "resign"')).status).toBe(400);
    expect((await send('[1, 2, 3]')).status).toBe(400);
    expect((await send('"resign"')).status).toBe(400);
    expect((await w.services.loadGame(game.id))?.status).toBe('playing');
  });

  it('has an up-to-date index.ts (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('multiplayer');
    expect(readFileSync(resolve('supabase/functions/multiplayer/index.ts'), 'utf8')).toBe(built);
  });
});
