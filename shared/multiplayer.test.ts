import { describe, expect, it } from 'vitest';
import { checkMove, replayGame } from './multiplayer';

describe('refereeing', () => {
  it('ends games by the rules, refuses illegal moves and moves after the end', () => {
    expect(replayGame('chess', ['f2f3', 'e7e5', 'g2g4', 'd8h4'])).toEqual({
      ok: true,
      toMove: 'first',
      ended: { winner: 'second', reason: 'checkmate' },
    });
    expect(replayGame('chess', ['e2e5'])).toEqual({ ok: false });
    expect(replayGame('checkers', ['1-2'])).toEqual({ ok: false });
    expect(checkMove('chess', [], 'e2e4')).toBe('e2e4');
    expect(checkMove('chess', [], 'e2e5')).toBeNull();
    expect(checkMove('chess', ['f2f3', 'e7e5', 'g2g4', 'd8h4'], 'e2e4')).toBeNull();
    expect(checkMove('checkers', [], '11-15')).toBe('11-15');
    expect(checkMove('checkers', ['11-15', '22-18'], '9-13')).toBeNull();
  });
});
