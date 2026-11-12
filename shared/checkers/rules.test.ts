import { describe, expect, it } from 'vitest';
import { applyMove, boardResult, findMove, legalMoves, mustCapture, pieceAt, positionFromRows, replay, type Position } from './rules';

const notations = (position: Position) => legalMoves(position).map((m) => m.notation).sort();

describe('checkers rules', () => {
  it('forces captures and multi-jumps, crowns kings, decides wins, and replays only legal games', () => {
    // Red man on 14 must jump the White man on 18 rather than step.
    const forced = positionFromRows(['r...', '....', '....', '.r..', '.w..', '....', '....', '...w']);
    expect(mustCapture(forced)).toBe(true);
    expect(notations(forced)).toEqual(['14x23']);
    expect(findMove(forced, '1-5')).toBeNull();
    const after = applyMove(forced, findMove(forced, '14x23')!);
    expect(pieceAt(after, 18)).toBeNull();
    expect(pieceAt(after, 23)).toEqual({ colour: 'red', king: false });

    // A multi-jump is one move and can't be stopped half way.
    const routes = positionFromRows(['r...', '.w..', '....', '.ww.', '....', '...w', '....', '....']);
    expect(notations(routes)).toEqual(['1x10x17', '1x10x19x28']);
    expect(findMove(routes, '1x10')).toBeNull();

    // A man crowned during a jump stops there.
    const crown = positionFromRows(['....', '....', '....', '....', '....', '.r..', '.ww.', '....']);
    expect(notations(crown)).toEqual(['22x31']);
    expect(pieceAt(applyMove(crown, legalMoves(crown)[0]), 31)).toEqual({ colour: 'red', king: true });

    // Winning by taking every piece, or by blocking the other side.
    const last = positionFromRows(['....', '....', '....', '.r..', '.w..', '....', '....', '....']);
    expect(boardResult(applyMove(last, findMove(last, '14x23')!))).toEqual({ ending: 'no-pieces', winner: 'red' });
    const blocked = positionFromRows(['....', '....', '....', '....', '....', '..r.', '..rr', '...w'], 'white');
    expect(boardResult(blocked)).toEqual({ ending: 'no-moves', winner: 'red' });

    // Replays refuse illegal moves.
    expect(replay(['11-15', '22-18', '15x22', '25x18']).ok).toBe(true);
    expect(replay(['22-18'])).toEqual({ ok: false, badMoveIndex: 0 });
    expect(replay(['11-15', '22-18', '12-16'])).toEqual({ ok: false, badMoveIndex: 2 });
  });
});
