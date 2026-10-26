import { describe, expect, it } from 'vitest';
import { applyMove, findMove, legalMoves, mustCapture, pieceAt, positionFromRows, type Position } from './rules';

const notations = (position: Position) => legalMoves(position).map((m) => m.notation).sort();

describe('capturing', () => {
  it('is compulsory, removes the jumped piece, and a multi-jump must be finished as one move', () => {
    // Red man on 14 can jump the White man on 18. Red also has a man on 1 that could step.
    const forced = positionFromRows(['r...', '....', '....', '.r..', '.w..', '....', '....', '...w']);
    expect(mustCapture(forced)).toBe(true);
    expect(notations(forced)).toEqual(['14x23']);
    expect(findMove(forced, '1-5')).toBeNull();
    const after = applyMove(forced, findMove(forced, '14x23')!);
    expect(pieceAt(after, 18)).toBeNull();
    expect(pieceAt(after, 23)).toEqual({ colour: 'red', king: false });

    // Red man on 1 jumps 6 to land on 10, then can jump 14 to 17, or 15 to 19 and then 24 to 28.
    const routes = positionFromRows(['r...', '.w..', '....', '.ww.', '....', '...w', '....', '....']);
    expect(notations(routes)).toEqual(['1x10x17', '1x10x19x28']);
    expect(findMove(routes, '1x10')).toBeNull(); // can't stop half way
  });
});
