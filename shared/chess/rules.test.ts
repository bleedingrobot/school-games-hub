import { describe, expect, it } from 'vitest';
import { boardResult, Chess, legalUciMoves, playUci, replay } from './rules';

const at = (fen: string) => new Chess(fen);

describe('chess rules', () => {
  it('allows only legal moves and spots how games end', () => {
    expect(legalUciMoves(new Chess())).toHaveLength(20);
    // A pinned piece cannot leave the pin; a king in check must get out of it.
    expect(legalUciMoves(at('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1')).filter((m) => m.startsWith('e2'))).toEqual([]);
    expect(legalUciMoves(at('4k3/8/8/8/8/8/8/r3K3 w - - 0 1')).sort()).toEqual(['e1d2', 'e1e2', 'e1f2'].sort());
    // Castling moves the rook too.
    const castle = at('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    expect(playUci(castle, 'e1g1')?.isKingsideCastle()).toBe(true);
    expect(castle.get('f1')).toEqual({ type: 'r', color: 'w' });
    // En passant and promotion.
    const ep = new Chess();
    for (const m of ['e2e4', 'a7a6', 'e4e5', 'd7d5']) playUci(ep, m);
    expect(playUci(ep, 'e5d6')?.isEnPassant()).toBe(true);
    const promo = at('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    expect(playUci(promo, 'e7e8q')).not.toBeNull();
    // Checkmate, check, stalemate.
    const mate = new Chess();
    for (const m of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) playUci(mate, m);
    expect(boardResult(mate)).toEqual({ ending: 'checkmate', winner: 'black' });
    const check = at('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    playUci(check, 'a1a8');
    expect(boardResult(check)).toBeNull();
    expect(boardResult(at('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ ending: 'stalemate', winner: null });
    // Replays refuse an illegal move and anything after checkmate.
    expect(replay(['e2e4', 'e7e5', 'e4e5'])).toEqual({ ok: false, badMoveIndex: 2 });
    expect(replay(['f2f3', 'e7e5', 'g2g4', 'd8h4', 'a2a3'])).toEqual({ ok: false, badMoveIndex: 4 });
  });
});
