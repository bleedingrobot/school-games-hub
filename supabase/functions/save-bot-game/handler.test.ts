import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import { applyMove, boardResult, legalMoves, startPosition } from '../../../shared/checkers/rules';
import { handleSaveBotGame, type GameRow, type Services } from './handler';

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

function services(over: Partial<Services> = {}) {
  const saved: GameRow[] = [];
  const s: Services = {
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : null)),
    record: vi.fn(async (row: GameRow) => {
      saved.push(row);
      return 'saved' as const;
    }),
    ...over,
  };
  return { s, saved };
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

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('save-bot-game');
    expect(readFileSync(resolve('supabase/functions/save-bot-game/index.ts'), 'utf8')).toBe(built);
  });
});
