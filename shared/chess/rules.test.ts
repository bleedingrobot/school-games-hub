import { describe, expect, it } from 'vitest';
import { boardResult, Chess, legalUciMoves, playUci } from './rules';

const at = (fen: string) => new Chess(fen);

describe('moves', () => {
  it('refuses illegal moves, and only allows getting out of check', () => {
    const chess = new Chess();
    expect(legalUciMoves(chess)).toHaveLength(20);
    expect(playUci(chess, 'e2e5')).toBeNull();
    expect(playUci(chess, 'e7e5')).toBeNull(); // black can't move first
    expect(playUci(chess, 'nonsense')).toBeNull();
    expect(chess.fen()).toBe(new Chess().fen());
    const check = at('4k3/8/8/8/8/8/8/r3K3 w - - 0 1');
    expect(legalUciMoves(check).sort()).toEqual(['e1d2', 'e1e2', 'e1f2'].sort());
  });
});

describe('how games end', () => {
  it('spots checkmate and the winner, check that is not mate, and stalemate as a draw', () => {
    const chess = new Chess();
    for (const m of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) playUci(chess, m); // fool's mate
    expect(boardResult(chess)).toEqual({ ending: 'checkmate', winner: 'black' });
    const check = at('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    playUci(check, 'a1a8');
    expect(boardResult(check)).toBeNull();
    expect(boardResult(at('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ ending: 'stalemate', winner: null });
  });
});
