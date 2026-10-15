import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import { applyMove, boardResult, legalMoves, startPosition } from '../../../shared/checkers/rules';
import { botAction } from '../../../shared/space/bot';
import { DEFAULT_SETTINGS, play } from '../../../shared/space/engine';
import { randomFromSeed } from '../../../shared/space/random';
import { playBots, startSolo, type SoloSetup } from '../../../shared/space/replay';
import { encodeAction, type SpaceGameReport } from '../../../shared/space/save';
import type { SoloSetup as Card101Setup } from '../../../shared/card101/solo';
import { playWholeGame } from '../../../shared/card101/testing';
import { stamper } from '../_shared/stamp';
import { handleSaveBotGame, type Card101Row, type GameRow, type Services, type SpaceRow } from './handler';

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

const NOW = 1_792_000_000;

function services(over: Partial<Services> = {}) {
  const saved: GameRow[] = [];
  const savedSpace: SpaceRow[] = [];
  const saved101: Card101Row[] = [];
  const s: Services = {
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : token === 'other-token' ? 'student-2' : null)),
    record: vi.fn(async (row: GameRow) => {
      saved.push(row);
      return 'saved' as const;
    }),
    recordSpace: vi.fn(async (row: SpaceRow) => {
      savedSpace.push(row);
      return 'saved' as const;
    }),
    record101: vi.fn(async (row: Card101Row) => {
      saved101.push(row);
      return 'saved' as const;
    }),
    stamp: stamper('test-server-key', 'space-seed'),
    nowSeconds: () => NOW,
    ...over,
  };
  return { s, saved, savedSpace, saved101 };
}

function post(body: unknown, token: string | null = 'good-token', origin = 'https://bleedingrobot.github.io') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: origin };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/save-bot-game', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('the save-bot-game server function', () => {
  it('replays the moves, decides the result itself and saves it', async () => {
    const { s, saved } = services();
    const response = await handleSaveBotGame(
      post({ level: 'easy', studentColour: 'black', moves: FOOLS_MATE, ending: 'finished' }),
      s,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'won', reason: 'checkmate', countsForPoints: false });
    expect(saved).toEqual([
      {
        player: 'student-1',
        game: 'chess',
        bot_level: 'easy',
        player_side: 'black',
        moves: FOOLS_MATE,
        result: 'won',
        reason: 'checkmate',
        player_moves: 2,
        counts_for_points: false,
      },
    ]);
  });

  it('saves the player from the sign-in token, never from the request', async () => {
    const { s, saved } = services();
    await handleSaveBotGame(
      post({ player: 'someone-else', level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }),
      s,
    );
    expect(saved[0].player).toBe('student-1');
  });

  it('refuses anyone not signed in', async () => {
    const { s, saved } = services();
    const body = { level: 'easy', studentColour: 'black', moves: FOOLS_MATE, ending: 'finished' };
    expect((await handleSaveBotGame(post(body, null), s)).status).toBe(401);
    expect((await handleSaveBotGame(post(body, 'fake-token'), s)).status).toBe(401);
    expect(saved).toEqual([]);
  });

  it('refuses a faked win', async () => {
    const { s, saved } = services();
    const lies = [
      { level: 'easy', studentColour: 'white', moves: ['e2e4', 'e7e5', 'd1f7'], ending: 'finished' }, // illegal move
      { level: 'easy', studentColour: 'white', moves: ['e2e4', 'e7e5'], ending: 'finished' }, // not over
      { level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'won' }, // made-up ending
      { level: 'expert', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' },
      'just a string',
    ];
    for (const body of lies) expect((await handleSaveBotGame(post(body), s)).status).toBe(400);
    expect(saved).toEqual([]);
  });

  it('copes with a body that is not JSON', async () => {
    const { s } = services();
    const request = new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer good-token' }, body: '{oops' });
    expect((await handleSaveBotGame(request, s)).status).toBe(400);
  });

  it('passes on the daily limit kindly', async () => {
    const { s } = services({ record: vi.fn(async () => 'too-many' as const) });
    const response = await handleSaveBotGame(
      post({ level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }),
      s,
    );
    expect(response.status).toBe(429);
    expect((await response.json()).error).toMatch(/lot of games/);
  });

  it('answers the browser’s permission check and only names our own websites', async () => {
    const { s } = services();
    const ours = await handleSaveBotGame(
      new Request('http://x', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }),
      s,
    );
    expect(ours.status).toBe(204);
    expect(ours.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    const other = await handleSaveBotGame(
      new Request('http://x', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }),
      s,
    );
    expect(other.headers.get('Access-Control-Allow-Origin')).toBe('https://bleedingrobot.github.io');
    // Remembered for 2 hours, so the browser doesn't ask again before every save.
    expect(ours.headers.get('Access-Control-Max-Age')).toBe('7200');
  });

  it('refuses a huge request without trying to read it as a game', async () => {
    const { s, saved } = services();
    const huge = { level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned', padding: 'x'.repeat(70_000) };
    const response = await handleSaveBotGame(post(huge), s);
    expect(response.status).toBe(400);
    expect(saved).toEqual([]);
  });

  it('refuses a request that isn’t JSON at all', async () => {
    const { s, saved } = services();
    const response = await handleSaveBotGame(
      new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer good-token' }, body: 'not json{' }),
      s,
    );
    expect(response.status).toBe(400);
    expect(saved).toEqual([]);
  });
});

/** A whole checkers game of random legal moves that Red wins. */
function checkersGameRedWins(): string[] {
  for (let seed = 1; ; seed++) {
    const random = seeded(seed);
    let position = startPosition();
    const moves: string[] = [];
    let result = boardResult(position);
    while (!result) {
      const options = legalMoves(position);
      const move = options[Math.floor(random() * options.length)];
      moves.push(move.notation);
      position = applyMove(position, move);
      result = boardResult(position);
    }
    if (result.winner === 'red') return moves;
  }
}

describe('saving checkers games', () => {
  it('replays the moves with the checkers rules, decides the result itself and saves it', async () => {
    const { s, saved } = services();
    const moves = checkersGameRedWins();
    const response = await handleSaveBotGame(
      post({ game: 'checkers', level: 'medium', studentColour: 'white', moves, ending: 'resigned' }),
      s,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe('lost');
    expect(saved).toEqual([
      expect.objectContaining({
        player: 'student-1',
        game: 'checkers',
        bot_level: 'medium',
        player_side: 'white',
        moves,
        result: 'lost',
        player_moves: Math.floor(moves.length / 2),
        counts_for_points: true,
      }),
    ]);
    expect(['no-pieces', 'no-moves']).toContain(saved[0].reason);
  });

  it('saves resigned and abandoned checkers games as losses', async () => {
    const { s, saved } = services();
    for (const ending of ['resigned', 'abandoned']) {
      const response = await handleSaveBotGame(
        post({ game: 'checkers', level: 'easy', studentColour: 'red', moves: ['11-15', '22-18', '15x22'], ending }),
        s,
      );
      expect(response.status).toBe(200);
    }
    expect(saved.map((row) => [row.result, row.reason, row.counts_for_points])).toEqual([
      ['lost', 'resigned', false],
      ['lost', 'abandoned', false],
    ]);
  });

  it('refuses faked or muddled checkers games', async () => {
    const { s, saved } = services();
    const lies = [
      { game: 'checkers', level: 'easy', studentColour: 'red', moves: ['11-15', '22-18', '12-16'], ending: 'resigned' }, // skipped a forced capture
      { game: 'checkers', level: 'easy', studentColour: 'red', moves: ['11-15', '23-19'], ending: 'finished' }, // not over
      { game: 'checkers', level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }, // chess moves
      { game: 'chess', level: 'easy', studentColour: 'white', moves: ['11-15'], ending: 'resigned' }, // checkers moves
      { game: 'checkers', level: 'easy', studentColour: 'black', moves: [], ending: 'resigned' }, // a chess colour
      { game: 'draughts', level: 'easy', studentColour: 'red', moves: [], ending: 'resigned' },
    ];
    for (const body of lies) expect((await handleSaveBotGame(post(body), s)).status).toBe(400);
    expect(saved).toEqual([]);
  });

  it('still treats a report with no game as chess (what older pages send)', async () => {
    const { s, saved } = services();
    await handleSaveBotGame(post({ level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }), s);
    expect(saved[0].game).toBe('chess');
  });
});

/** Asks for a seed, plays a whole game from it with a Pilot-like "student", and returns the report. */
async function spaceGame(s: Services, setup: Omit<SoloSetup, 'seed'>, stopAfter = Infinity) {
  const response = await handleSaveBotGame(post({ game: 'space', start: true }), s);
  const { seed, stamp } = (await response.json()) as { seed: string; stamp: string };
  const game = startSolo({ ...setup, seed });
  const student = randomFromSeed('student');
  const actions: string[] = [];
  playBots(game, setup.level);
  while (game.state.phase !== 'over' && actions.length < stopAfter) {
    const action = botAction(game.state, 'easy', student);
    actions.push(encodeAction(action));
    game.state = play(game.state, action, game.dice).state;
    playBots(game, setup.level);
  }
  const report: SpaceGameReport = {
    game: 'space',
    seed,
    stamp,
    ...setup,
    actions,
    ending: game.state.phase === 'over' ? 'finished' : 'abandoned',
  };
  return { report, state: game.state, studentSeat: game.studentSeat };
}

const NEBULA = { board: { id: 'nebula' as const }, settings: DEFAULT_SETTINGS, bots: 3, level: 'easy' as const };

describe('saving Wormholes & Black Holes games', () => {
  it('hands out a fresh seed with a stamp', async () => {
    const { s } = services();
    const a = await (await handleSaveBotGame(post({ game: 'space', start: true }), s)).json();
    const b = await (await handleSaveBotGame(post({ game: 'space', start: true }), s)).json();
    expect(a.seed).toMatch(/^s1-1792000000-[0-9a-f]{24}$/);
    expect(a.stamp).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.seed).not.toBe(b.seed);
  });

  it('needs a sign-in for a seed too', async () => {
    const { s } = services();
    expect((await handleSaveBotGame(post({ game: 'space', start: true }, null), s)).status).toBe(401);
  });

  it('replays the game from its seed, works out the place itself and saves it', async () => {
    const { s, savedSpace, saved } = services();
    const { report, state, studentSeat } = await spaceGame(s, NEBULA);
    const response = await handleSaveBotGame(post(report), s);
    expect(response.status).toBe(200);
    const place = state.places![studentSeat];
    expect(await response.json()).toEqual(
      expect.objectContaining({ result: place === 1 ? 'won' : 'lost', place, countsForPoints: true }),
    );
    expect(saved).toEqual([]);
    expect(savedSpace).toHaveLength(1);
    const row = savedSpace[0];
    expect(row).toEqual(
      expect.objectContaining({
        player: 'student-1',
        bot_level: 'easy',
        player_side: ['first', 'second', 'third', 'fourth'][studentSeat],
        moves: report.actions,
        counts_for_points: true,
      }),
    );
    expect(row.space).toEqual(
      expect.objectContaining({ seed: report.seed, board: { id: 'nebula' }, bots: 3, place, rockets: 4 }),
    );
    expect(row.space.stats.wormholes).toBeGreaterThanOrEqual(0);
    expect(row.player_moves).toBeGreaterThanOrEqual(5);
  });

  it('saves a game the student left part-way as left early, earning nothing', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, NEBULA, 4);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(savedSpace[0]).toEqual(expect.objectContaining({ result: 'lost', reason: 'abandoned', counts_for_points: false }));
    expect(savedSpace[0].space.place).toBeNull();
  });

  it('refuses a game that says it finished but didn’t', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, NEBULA, 4);
    expect((await handleSaveBotGame(post({ ...report, ending: 'finished' }), s)).status).toBe(400);
    expect(savedSpace).toEqual([]);
  });

  it('refuses made-up seeds, borrowed seeds, old seeds and changed games', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, NEBULA);
    const other = services({ nowSeconds: () => NOW + 13 * 60 * 60 });
    const cases: [object, string][] = [
      [{ ...report, stamp: report.stamp.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) }, 'good-token'], // a forged stamp
      [{ ...report, seed: report.seed.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }, 'good-token'], // a different seed
      [report, 'other-token'], // someone else's seed
      [{ ...report, actions: [...report.actions.slice(1)] }, 'good-token'], // a different game
      [{ ...report, bots: 2 }, 'good-token'], // different settings
      [{ ...report, actions: [...report.actions, 'roll'] }, 'good-token'], // extra actions
      [{ ...report, actions: ['use:laser'] }, 'good-token'], // not an action
      [{ ...report, settings: { ...report.settings, maths: true } }, 'good-token'],
      [{ ...report, board: { id: 'moon' } }, 'good-token'],
      [{ ...report, ending: 'resigned' }, 'good-token'],
    ];
    for (const [body, token] of cases) expect((await handleSaveBotGame(post(body, token), s)).status).toBe(400);
    expect((await handleSaveBotGame(post(report), other.s)).status).toBe(400); // too old
    expect(savedSpace).toEqual([]);
    expect(other.savedSpace).toEqual([]);
  });

  it('plays Random Galaxy boards too', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, { ...NEBULA, board: { galaxy: 'comet kiwi 48', size: 50 } as never, bots: 1 });
    expect(report.board).toEqual({ galaxy: 'comet kiwi 48', size: 50 });
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(savedSpace[0].space.board).toEqual({ galaxy: 'Comet-Kiwi-48', size: 50 });
  });

  it('passes on the daily limit kindly', async () => {
    const { s } = services({ recordSpace: vi.fn(async () => 'too-many' as const) });
    const { report } = await spaceGame(s, NEBULA);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(429);
  });

  it('won’t hand out seeds without a server key', async () => {
    const { s } = services({ stamp: stamper('', 'space-seed') });
    expect((await handleSaveBotGame(post({ game: 'space', start: true }), s)).status).toBe(500);
  });
});

/** Asks for a 101 seed, plays a whole game from it with an Easy bot as the "student", and returns the report. */
async function game101(s: Services, setup: Omit<Card101Setup, 'seed'>, leaveAfter = Infinity) {
  const response = await handleSaveBotGame(post({ game: '101', start: true }), s);
  const { seed, stamp } = (await response.json()) as { seed: string; stamp: string };
  const { solo, actions } = playWholeGame({ ...setup, seed }, 'easy', leaveAfter);
  // A student who walks away just stops; the browser doesn't send "leave".
  const sent = actions.filter((a) => a !== 'leave');
  const over = solo.game.phase === 'over' && sent.length === actions.length;
  const report = { game: '101' as const, seed, stamp, ...setup, actions: sent, ending: over ? ('finished' as const) : ('abandoned' as const) };
  return { report, game: solo.game };
}

const QUICK = { bots: 2, level: 'easy' as const, settings: { target: 50 as const } };

describe('saving 101 games', () => {
  it('hands out a fresh seed with a stamp', async () => {
    const { s } = services();
    const a = await (await handleSaveBotGame(post({ game: '101', start: true }), s)).json();
    expect(a.seed).toMatch(/^s1-1792000000-[0-9a-f]{24}$/);
    expect(a.stamp).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await handleSaveBotGame(post({ game: '101', start: true }, null), s)).status).toBe(401);
  });

  it('replays the game from its seed, works out the result itself and saves it', async () => {
    const { s, saved101, saved, savedSpace } = services();
    const { report, game } = await game101(s, QUICK);
    const response = await handleSaveBotGame(post(report), s);
    expect(response.status).toBe(200);
    const won = game.winners!.includes(0);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ result: won ? 'won' : 'lost', reason: 'finished', countsForPoints: true }));
    expect(body.place === 1).toBe(won);
    expect(saved).toEqual([]);
    expect(savedSpace).toEqual([]);
    expect(saved101).toHaveLength(1);
    const row = saved101[0];
    expect(row).toEqual(
      expect.objectContaining({ player: 'student-1', bot_level: 'easy', player_side: 'first', moves: report.actions, counts_for_points: true }),
    );
    expect(row.card101).toEqual(
      expect.objectContaining({ seed: report.seed, settings: { target: 50 }, bots: 2, players: 3, total: game.totals[0], rounds: game.results.length }),
    );
    expect(row.card101.stats.zeroHands).toBe(game.results.filter((r) => r.scores[0]!.total === 0).length);
  });

  it('saves a game the student left part-way as left early, earning nothing', async () => {
    const { s, saved101 } = services();
    const { report } = await game101(s, QUICK, 12);
    expect(report.ending).toBe('abandoned');
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(saved101[0]).toEqual(expect.objectContaining({ result: 'lost', reason: 'abandoned', counts_for_points: false }));
    expect(saved101[0].card101.place).toBeNull();
  });

  it('refuses made-up seeds, borrowed seeds, space seeds, old seeds and changed games', async () => {
    const { s, saved101 } = services();
    const { report } = await game101(s, QUICK);
    const spaceSeed = (await (await handleSaveBotGame(post({ game: 'space', start: true }), s)).json()) as { seed: string; stamp: string };
    const other = services({ nowSeconds: () => NOW + 13 * 60 * 60 });
    const cases: [object, string][] = [
      [{ ...report, stamp: report.stamp.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) }, 'good-token'], // a forged stamp
      [{ ...report, seed: report.seed.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }, 'good-token'], // a different seed
      [{ ...report, ...spaceSeed }, 'good-token'], // a seed stamped for the space game
      [report, 'other-token'], // someone else's seed
      [{ ...report, actions: report.actions.slice(1) }, 'good-token'], // a different game
      [{ ...report, bots: 1 }, 'good-token'], // different settings
      [{ ...report, settings: { target: 101 } }, 'good-token'],
      [{ ...report, settings: { target: 75 } }, 'good-token'],
      [{ ...report, level: 'medium' }, 'good-token'],
      [{ ...report, actions: [...report.actions, 'knock'] }, 'good-token'], // extra actions
      [{ ...report, actions: ['peek', 'swap:4'] }, 'good-token'], // not an action
      [{ ...report, actions: report.actions.slice(0, 12), ending: 'finished' }, 'good-token'], // says it finished, didn't
      [{ ...report, ending: 'resigned' }, 'good-token'],
    ];
    for (const [body, token] of cases) expect((await handleSaveBotGame(post(body, token), s)).status).toBe(400);
    expect((await handleSaveBotGame(post(report), other.s)).status).toBe(400); // too old
    expect(saved101).toEqual([]);
    expect(other.saved101).toEqual([]);
  });

  it('passes on the daily limit kindly', async () => {
    const { s } = services({ record101: vi.fn(async () => 'too-many' as const) });
    const { report } = await game101(s, QUICK);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(429);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('save-bot-game');
    expect(readFileSync(resolve('supabase/functions/save-bot-game/index.ts'), 'utf8')).toBe(built);
  });
});
