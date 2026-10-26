import { describe, expect, it } from 'vitest';
import { GAMES } from '../games/registry';
import { pageTheme } from './hubTheme';

describe('which pages show the pupil’s theme', () => {
  it('shows it on the hub pages', () => {
    for (const path of ['/', '/profile', '/lobby', '/leaderboard', '/training', '/warp', '/points', '/lobby/']) {
      expect(pageTheme(path, 'menu'), path).toBe('menu');
    }
  });

  it('keeps the teacher pages on Tidy school', () => {
    for (const path of ['/teacher', '/classes', '/focus', '/skills']) expect(pageTheme(path, 'soft'), path).toBe('tidy');
  });

  it('gives game screens no theme, so every game keeps its own look', () => {
    const games = [...GAMES.map((g) => `/${g.id}`), '/play/f1', '/space-game/s1', '/card-game/c1', '/power-game/p1', '/placement', '/nope'];
    for (const path of games) expect(pageTheme(path, 'menu'), path).toBeUndefined();
  });
});
