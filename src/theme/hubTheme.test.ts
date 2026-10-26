import { describe, expect, it } from 'vitest';
import { GAMES } from '../games/registry';
import { pageTheme } from './hubTheme';

describe('which pages show the pupil’s theme', () => {
  it('shows it on hub pages, keeps teacher pages on Tidy school, and leaves game screens their own look', () => {
    for (const path of ['/', '/profile', '/lobby', '/training']) expect(pageTheme(path, 'menu'), path).toBe('menu');
    for (const path of ['/teacher', '/classes', '/focus', '/skills']) expect(pageTheme(path, 'soft'), path).toBe('tidy');
    for (const path of [...GAMES.map((g) => `/${g.id}`), '/play/f1', '/placement']) expect(pageTheme(path, 'menu'), path).toBeUndefined();
  });
});
