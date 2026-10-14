import { describe, expect, it } from 'vitest';
import { boardResult, Chess, isUciMove, legalUciMoves, playUci, replay } from './rules';

const at = (fen: string) => new Chess(fen);

describe('moves', () => {
  it('has 20 legal moves at the start', () => {
    expect(legalUciMoves(new Chess())).toHaveLength(20);
  });

  it('refuses illegal moves without crashing', () => {
    const chess = new Chess();
    expect(playUci(chess, 'e2e5')).toBeNull();
    expect(playUci(chess, 'e7e5')).toBeNull(); // black can't move first
    expect(playUci(chess, 'nonsense')).toBeNull();
    expect(chess.fen()).toBe(new Chess().fen());
  });

  it('only accepts tidy UCI text', () => {
    expect(isUciMove('e2e4')).toBe(true);
    expect(isUciMove('e7e8q')).toBe(true);
    expect(isUciMove('e7e8k')).toBe(false);
    expect(isUciMove('E2E4')).toBe(false);
    expect(isUciMove(42)).toBe(false);
  });

  it('will not let a pinned piece move off the pin', () => {
    // The white knight on e2 is pinned to its king by the rook on e8.
    const chess = at('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1');
    expect(legalUciMoves(chess).filter((m) => m.startsWith('e2'))).toEqual([]);
  });

  it('must get out of check', () => {
    const chess = at('4k3/8/8/8/8/8/8/r3K3 w - - 0 1');
    expect(chess.inCheck()).toBe(true);
    expect(legalUciMoves(chess).sort()).toEqual(['e1d2', 'e1e2', 'e1f2'].sort());
  });
});

describe('castling', () => {
  const open = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';

  it('works on both sides and moves the rook too', () => {
    const short = at(open);
    expect(playUci(short, 'e1g1')?.isKingsideCastle()).toBe(true);
    expect(short.get('f1')).toEqual({ type: 'r', color: 'w' });

    const long = at(open);
    expect(playUci(long, 'e1c1')?.isQueensideCastle()).toBe(true);
    expect(long.get('d1')).toEqual({ type: 'r', color: 'w' });
  });

  it('is not allowed once the king has moved', () => {
    const chess = at(open);
    for (const m of ['e1f1', 'a7a6', 'f1e1', 'a6a5']) expect(playUci(chess, m)).not.toBeNull();
    expect(legalUciMoves(chess)).not.toContain('e1g1');
    expect(legalUciMoves(chess)).not.toContain('e1c1');
  });

  it('is not allowed on the side whose rook has moved', () => {
    const chess = at('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    for (const m of ['h1h2', 'e8d8', 'h2h1', 'd8e8']) expect(playUci(chess, m)).not.toBeNull();
    expect(legalUciMoves(chess)).not.toContain('e1g1');
    expect(legalUciMoves(chess)).toContain('e1c1');
  });

  it('is not allowed out of, through, or into check', () => {
    expect(legalUciMoves(at('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).not.toContain('e1g1'); // in check
    const through = legalUciMoves(at('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1')); // f1 attacked
    expect(through).not.toContain('e1g1');
    expect(through).toContain('e1c1');
    expect(legalUciMoves(at('6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).not.toContain('e1g1'); // g1 attacked
  });

  it('is not allowed with a piece in the way', () => {
    expect(legalUciMoves(at('4k3/8/8/8/8/8/8/RN2K1NR w KQ - 0 1'))).not.toContain('e1c1');
    expect(legalUciMoves(at('4k3/8/8/8/8/8/8/RN2K1NR w KQ - 0 1'))).not.toContain('e1g1');
  });
});

describe('en passant', () => {
  it('can capture a pawn that just jumped two squares', () => {
    const chess = new Chess();
    for (const m of ['e2e4', 'a7a6', 'e4e5', 'd7d5']) playUci(chess, m);
    const move = playUci(chess, 'e5d6');
    expect(move?.isEnPassant()).toBe(true);
    expect(chess.get('d5')).toBeUndefined(); // the captured pawn is gone
  });

  it('is only allowed straight away', () => {
    const chess = new Chess();
    for (const m of ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'h2h3', 'h7h6']) playUci(chess, m);
    expect(legalUciMoves(chess)).not.toContain('e5d6');
  });

  it('is not allowed if it would leave the king in check', () => {
    // Taking en passant would open the rank between the white king and the black rook.
    const chess = at('8/8/8/K2pP2r/8/8/8/4k3 w - d6 0 1');
    expect(legalUciMoves(chess)).not.toContain('e5d6');
  });
});

describe('promotion', () => {
  it('lets a pawn become any of the four pieces', () => {
    for (const piece of ['q', 'r', 'b', 'n'] as const) {
      const chess = at('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
      expect(playUci(chess, `e7e8${piece}`)).not.toBeNull();
      expect(chess.get('e8')).toEqual({ type: piece, color: 'w' });
    }
  });

  it('can promote while capturing', () => {
    const chess = at('3r4/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    expect(playUci(chess, 'e7d8n')?.isCapture()).toBe(true);
    expect(chess.get('d8')).toEqual({ type: 'n', color: 'w' });
  });

  it('works for black too', () => {
    const chess = at('4k3/8/8/8/8/8/3p4/K7 b - - 0 1');
    expect(playUci(chess, 'd2d1q')).not.toBeNull();
    expect(chess.get('d1')).toEqual({ type: 'q', color: 'b' });
  });

  it('lists all four choices as separate legal moves', () => {
    const moves = legalUciMoves(at('8/4P3/8/8/8/8/k7/4K3 w - - 0 1')).filter((m) => m.startsWith('e7'));
    expect(moves.sort()).toEqual(['e7e8b', 'e7e8n', 'e7e8q', 'e7e8r']);
  });
});

describe('how games end', () => {
  it('spots checkmate and the winner', () => {
    const chess = new Chess();
    for (const m of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) playUci(chess, m); // fool's mate
    expect(boardResult(chess)).toEqual({ ending: 'checkmate', winner: 'black' });
  });

  it('spots a back-rank checkmate for white', () => {
    const chess = at('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    playUci(chess, 'a1a8');
    expect(boardResult(chess)).toEqual({ ending: 'checkmate', winner: 'white' });
  });

  it('check is not checkmate', () => {
    const chess = at('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    playUci(chess, 'a1a8');
    expect(chess.inCheck()).toBe(true);
    expect(boardResult(chess)).toBeNull();
  });

  it('spots stalemate as a draw', () => {
    expect(boardResult(at('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ ending: 'stalemate', winner: null });
  });

  it('draws on threefold repetition', () => {
    const chess = new Chess();
    for (const m of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1']) playUci(chess, m);
    expect(boardResult(chess)).toBeNull();
    playUci(chess, 'f6g8');
    expect(boardResult(chess)).toEqual({ ending: 'threefold-repetition', winner: null });
  });

  it('draws after 50 moves each with no capture or pawn move', () => {
    const chess = at('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
    expect(boardResult(chess)).toBeNull();
    playUci(chess, 'a1a2');
    expect(boardResult(chess)).toEqual({ ending: 'fifty-moves', winner: null });
  });

  it('a pawn move resets the 50-move count', () => {
    const chess = at('4k3/8/8/8/8/8/P7/R3K3 w - - 99 80');
    playUci(chess, 'a2a3');
    expect(boardResult(chess)).toBeNull();
  });

  it('draws when nobody has enough pieces to checkmate', () => {
    expect(boardResult(at('4k3/8/8/8/8/8/8/4K3 w - - 0 1'))?.ending).toBe('not-enough-pieces');
    expect(boardResult(at('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1'))?.ending).toBe('not-enough-pieces');
    expect(boardResult(at('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1'))?.ending).toBe('not-enough-pieces');
    expect(boardResult(at('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'))).toBeNull(); // a rook is enough
  });
});

describe('replaying a game', () => {
  it('replays a legal game', () => {
    const result = replay(['e2e4', 'e7e5', 'g1f3']);
    expect(result.ok && result.chess.history()).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('finds the first illegal move', () => {
    expect(replay(['e2e4', 'e7e5', 'e4e5'])).toEqual({ ok: false, badMoveIndex: 2 });
  });

  it('refuses moves after checkmate', () => {
    expect(replay(['f2f3', 'e7e5', 'g2g4', 'd8h4', 'a2a3'])).toEqual({ ok: false, badMoveIndex: 4 });
  });

  it('replays castling, en passant and promotion', () => {
    const game = [
      'e2e4', 'd7d5', 'e4e5', 'f7f5', 'e5f6', // en passant
      'g8h6', 'f6g7', 'e8f7', 'g7h8n', // promotion to a knight, capturing the rook, with check
      'f7e6', 'g1f3', 'b8c6', 'f1e2', 'd8d6', 'e1g1', // white castles
    ];
    const result = replay(game);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chess.get('h8')).toEqual({ type: 'n', color: 'w' });
      expect(result.chess.get('g1')).toEqual({ type: 'k', color: 'w' });
    }
  });
});
