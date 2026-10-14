import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
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
