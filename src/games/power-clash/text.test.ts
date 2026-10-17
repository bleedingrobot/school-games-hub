import { describe, expect, it } from 'vitest';
import { botLine, squareName } from './text';

describe('saying what the bot did', () => {
  it('names squares so a screen reader can follow', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(squareName)).toEqual([
      'the top-left square', 'the top-middle square', 'the top-right square',
      'the middle-left square', 'the middle square', 'the middle-right square',
      'the bottom-left square', 'the bottom-middle square', 'the bottom-right square',
    ]);
  });
  it('describes each power and the placement', () => {
    expect(botLine([{ kind: 'freeze', player: 'O', square: 4 }])).toBe('The bot froze the middle square.');
    expect(botLine([{ kind: 'body-swap', player: 'O', squares: [0, 8] }])).toBe('The bot swapped the top-left square with the bottom-right square.');
    expect(botLine([{ kind: 'wipe', player: 'O', square: 2 }])).toBe('The bot blasted the symbol on the top-right square.');
    expect(botLine([{ kind: 'double-trouble', player: 'O' }])).toBe('The bot used Double Trouble.');
    expect(botLine([{ kind: 'place', player: 'O', square: 4 }])).toBe('The bot put O on the middle square.');
    expect(botLine([{ kind: 'skip', player: 'O' }])).toBe('The bot missed a go.');
  });
});
