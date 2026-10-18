import { describe, expect, it } from 'vitest';
import type { PowerGame } from '../data/powerGames';
import { powerRecentGame, whenPlayed } from './Dashboard';

describe('when a game was played', () => {
  const now = new Date(2026, 9, 15, 14, 0); // Thursday 15 October 2026, 2pm

  it('says Today, Yesterday, a weekday, then a date', () => {
    expect(whenPlayed(new Date(2026, 9, 15, 8, 30).toISOString(), now)).toBe('Today');
    expect(whenPlayed(new Date(2026, 9, 14, 23, 59).toISOString(), now)).toBe('Yesterday');
    expect(whenPlayed(new Date(2026, 9, 12, 10, 0).toISOString(), now)).toBe('Monday');
    expect(whenPlayed(new Date(2026, 8, 30, 10, 0).toISOString(), now)).toBe('30 Sept');
  });
});

describe('a Power Clash game in Recent games', () => {
  const finished = (over: Partial<PowerGame> = {}): PowerGame =>
    ({ id: 'p1', seat1: 'me', seat2: 'them', status: 'finished', ending: 'finished', won: [true, false], leaver: null,
      finished_at: '2026-10-20T01:00:00Z', created_at: '2026-10-20T00:00:00Z', ...over }) as PowerGame;

  it('a win and a loss, from my seat', () => {
    expect(powerRecentGame(finished(), 'me')).toMatchObject({ game: 'power-clash', result: 'won', reason: 'finished', classmates: true });
    expect(powerRecentGame(finished(), 'them')).toMatchObject({ result: 'lost', reason: 'finished' });
    expect(powerRecentGame(finished({ seat1: 'them', seat2: 'me' }), 'me').result).toBe('lost');
  });

  it('a game that ended early says who left, and is never a win', () => {
    const left = finished({ ending: 'abandoned', won: [false, false], leaver: 'them' });
    expect(powerRecentGame(left, 'me')).toMatchObject({ result: 'lost', reason: 'abandoned', leftBy: 'them' });
    expect(powerRecentGame(left, 'them').leftBy).toBe('me');
    expect(powerRecentGame({ ...left, leaver: null }, 'me').leftBy).toBe('nobody');
  });
});
