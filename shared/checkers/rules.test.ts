import { describe, expect, it } from 'vitest';
import {
  applyMove,
  boardResult,
  findMove,
  legalMoves,
  mustCapture,
  pieceAt,
  positionFromRows,
  QUIET_PLIES_FOR_DRAW,
  replay,
  rowCol,
  squareAt,
  startPosition,
  type Position,
} from './rules';
import { seeded } from '../seededRandom';

const notations = (position: Position) => legalMoves(position).map((m) => m.notation).sort();

describe('the board', () => {
  it('numbers the 32 dark squares the standard way', () => {
    expect(rowCol(1)).toEqual({ row: 0, col: 1 });
    expect(rowCol(4)).toEqual({ row: 0, col: 7 });
    expect(rowCol(5)).toEqual({ row: 1, col: 0 });
    expect(rowCol(29)).toEqual({ row: 7, col: 0 }); // a dark square in each player's near-left corner
    expect(rowCol(32)).toEqual({ row: 7, col: 6 });
    for (let square = 1; square <= 32; square++) {
      const { row, col } = rowCol(square);
      expect(squareAt(row, col)).toBe(square);
    }
    expect(squareAt(0, 0)).toBeNull(); // light square
    expect(squareAt(8, 1)).toBeNull(); // off the board
  });

  it('starts with 12 pieces each, Red on 1–12, and Red moves first', () => {
    const start = startPosition();
    expect(start.turn).toBe('red');
    expect(start.board.filter((p) => p?.colour === 'red')).toHaveLength(12);
    expect(start.board.filter((p) => p?.colour === 'white')).toHaveLength(12);
    expect(pieceAt(start, 12)).toEqual({ colour: 'red', king: false });
    expect(pieceAt(start, 21)).toEqual({ colour: 'white', king: false });
    expect(notations(start)).toEqual(['10-14', '10-15', '11-15', '11-16', '12-16', '9-13', '9-14']);
  });
});

describe('moving', () => {
  it('men move one square diagonally forwards only', () => {
    const red = positionFromRows(['....', '....', '....', '....', '.r..', '....', '....', '...w']);
    expect(notations(red)).toEqual(['18-22', '18-23']);
    const white = positionFromRows(['r...', '....', '....', '....', '.w..', '....', '....', '....'], 'white');
    expect(notations(white)).toEqual(['18-14', '18-15']);
  });

  it('kings move one square diagonally, forwards or backwards', () => {
    const position = positionFromRows(['....', '....', '....', '....', '.R..', '....', '....', '...w']);
    expect(notations(position)).toEqual(['18-14', '18-15', '18-22', '18-23']);
  });

  it('pieces cannot move onto another piece or off the board', () => {
    // Red man on 5 (left edge) with its only forward square, 9, taken by its own piece.
    const position = positionFromRows(['....', 'r...', 'r...', '....', '....', '....', '....', '...w']);
    expect(notations(position)).toEqual(['9-13', '9-14']);
  });

  it('a man reaching the far row becomes a king', () => {
    const position = positionFromRows(['....', '....', '....', '....', '....', '....', '.r..', '...w']);
    const move = findMove(position, '26-30')!;
    expect(move.crowns).toBe(true);
    expect(pieceAt(applyMove(position, move), 30)).toEqual({ colour: 'red', king: true });
    // White is crowned on Red's back row.
    const white = positionFromRows(['r...', '.w..', '....', '....', '....', '....', '....', '....'], 'white');
    expect(pieceAt(applyMove(white, findMove(white, '6-2')!), 2)).toEqual({ colour: 'white', king: true });
  });

  it('only takes moves in exact notation', () => {
    const start = startPosition();
    expect(findMove(start, '11-15')).not.toBeNull();
    expect(findMove(start, '11 - 15')).toBeNull();
    expect(findMove(start, '11-14')).toBeNull();
    expect(findMove(start, '22-18')).toBeNull(); // White's move, but it's Red's turn
  });
});

describe('capturing', () => {
  // Red man on 14 can jump the White man on 18. Red also has a man on 1 that could step.
  const forced = positionFromRows(['r...', '....', '....', '.r..', '.w..', '....', '....', '...w']);

  it('is compulsory: if you can jump, you must', () => {
    expect(mustCapture(forced)).toBe(true);
    expect(notations(forced)).toEqual(['14x23']);
    expect(findMove(forced, '1-5')).toBeNull();
    expect(findMove(forced, '1-6')).toBeNull();
  });

  it('removes the jumped piece', () => {
    const after = applyMove(forced, findMove(forced, '14x23')!);
    expect(pieceAt(after, 18)).toBeNull();
    expect(pieceAt(after, 14)).toBeNull();
    expect(pieceAt(after, 23)).toEqual({ colour: 'red', king: false });
    expect(after.turn).toBe('white');
  });

  it('lets you choose which piece captures when there is more than one', () => {
    // Red on 14 can take 18, and Red on 16 can take 19.
    const position = positionFromRows(['....', '....', '....', '.r.r', '.ww.', '....', '....', '...w']);
    expect(notations(position)).toEqual(['14x23', '16x23']);
  });

  it('men cannot capture backwards, but kings can', () => {
    const man = positionFromRows(['....', '....', '....', '....', '.w..', '..r.', '....', '...w']);
    expect(mustCapture(man)).toBe(false);
    expect(notations(man)).toEqual(['23-26', '23-27']);
    const king = positionFromRows(['....', '....', '....', '....', '.w..', '..R.', '....', '...w']);
    expect(notations(king)).toEqual(['23x14']);
  });

  it('cannot jump your own piece, or land on a piece', () => {
    const own = positionFromRows(['....', '....', '....', '.r..', '.r..', '....', '....', '...w']);
    expect(mustCapture(own)).toBe(false);
    const blocked = positionFromRows(['....', '....', '....', '.r..', '.w..', '..w.', '....', '....']);
    expect(mustCapture(blocked)).toBe(false);
  });
});

describe('multi-jumps', () => {
  // Red man on 1. White on 6, 14, 15 and 24. From 1 it jumps 6 to land on 10, then has a
  // choice: jump 14 to 17 (and stop), or jump 15 to 19 and then 24 to 28.
  const routes = positionFromRows(['r...', '.w..', '....', '.ww.', '....', '...w', '....', '....']);

  it('must keep jumping, and the whole jump is one move', () => {
    expect(notations(routes)).toEqual(['1x10x17', '1x10x19x28']);
    expect(findMove(routes, '1x10')).toBeNull(); // can't stop half way
  });

  it('lets you choose any route, not just the one that takes the most', () => {
    const short = applyMove(routes, findMove(routes, '1x10x17')!);
    expect(short.board.filter((p) => p?.colour === 'white')).toHaveLength(2);
    const long = applyMove(routes, findMove(routes, '1x10x19x28')!);
    expect(long.board.filter((p) => p?.colour === 'white')).toHaveLength(1);
    expect(pieceAt(long, 28)).toEqual({ colour: 'red', king: false });
    expect(findMove(routes, '1x10x19x28')!.captures).toEqual([6, 15, 24]);
  });

  it('a man crowned during a jump stops there, even if it could jump again as a king', () => {
    // Red man on 22 jumps 26 to land on 31 (crowned). As a king it could then jump 27.
    const position = positionFromRows(['....', '....', '....', '....', '....', '.r..', '.ww.', '....']);
    const moves = legalMoves(position);
    expect(moves.map((m) => m.notation)).toEqual(['22x31']);
    expect(moves[0].crowns).toBe(true);
    const after = applyMove(position, moves[0]);
    expect(pieceAt(after, 31)).toEqual({ colour: 'red', king: true });
    expect(pieceAt(after, 27)).toEqual({ colour: 'white', king: false });
    expect(after.turn).toBe('white');
  });

  it('a king that is already crowned keeps jumping', () => {
    const position = positionFromRows(['....', '....', '....', '....', '....', '.R..', '.ww.', '....']);
    expect(notations(position)).toEqual(['22x31x24']);
  });

  it('a king can jump in a loop back to its starting square', () => {
    // Red king on 10, White on 14, 15, 22 and 23: it can go all the way round, either way.
    const position = positionFromRows(['....', '....', '.R..', '.ww.', '....', '.ww.', '....', '....']);
    expect(notations(position)).toEqual(['10x17x26x19x10', '10x19x26x17x10']);
    const after = applyMove(position, findMove(position, '10x17x26x19x10')!);
    expect(after.board.filter((p) => p?.colour === 'white')).toHaveLength(0);
    expect(pieceAt(after, 10)).toEqual({ colour: 'red', king: true });
  });

  it('never jumps the same piece twice', () => {
    for (let game = 1; game <= 20; game++) {
      const random = seeded(game);
      let position = startPosition();
      while (!boardResult(position)) {
        const options = legalMoves(position);
        for (const move of options) expect(new Set(move.captures).size).toBe(move.captures.length);
        position = applyMove(position, options[Math.floor(random() * options.length)]);
      }
    }
  });
});

describe('how a game ends', () => {
  it('you win by taking all the other side’s pieces', () => {
    const position = positionFromRows(['....', '....', '....', '.r..', '.w..', '....', '....', '....']);
    expect(boardResult(position)).toBeNull();
    const after = applyMove(position, findMove(position, '14x23')!);
    expect(boardResult(after)).toEqual({ ending: 'no-pieces', winner: 'red' });
  });

  it('you win by blocking the other side so it has no legal move', () => {
    // White's only man is on 32. Red men on 27 and 28 block it, and 23 stops it jumping 27.
    const position = positionFromRows(['....', '....', '....', '....', '....', '..r.', '..rr', '...w'], 'white');
    expect(legalMoves(position)).toEqual([]);
    expect(boardResult(position)).toEqual({ ending: 'no-moves', winner: 'red' });
  });

  it('is a draw after 40 moves each with no capture and no new king', () => {
    const kings = positionFromRows(['R...', '....', '....', '....', '....', '....', '....', '...W'], 'red', QUIET_PLIES_FOR_DRAW - 1);
    expect(boardResult(kings)).toBeNull();
    const after = applyMove(kings, findMove(kings, '1-6')!);
    expect(after.quietPlies).toBe(QUIET_PLIES_FOR_DRAW);
    expect(boardResult(after)).toEqual({ ending: 'forty-moves', winner: null });
  });

  it('a capture or a new king starts the 40-move count again', () => {
    const capture = positionFromRows(['....', '....', '....', '.r..', '.w..', '....', '....', '...W'], 'red', 70);
    expect(applyMove(capture, findMove(capture, '14x23')!).quietPlies).toBe(0);
    const crown = positionFromRows(['....', '....', '....', '....', '....', '....', '.r..', 'W...'], 'red', 70);
    expect(applyMove(crown, findMove(crown, '26-31')!).quietPlies).toBe(0);
    const quiet = positionFromRows(['R...', '....', '....', '....', '....', '....', '....', '...W'], 'red', 70);
    expect(applyMove(quiet, findMove(quiet, '1-6')!).quietPlies).toBe(71);
  });

  it('a win on the last quiet move still counts as a win, not a draw', () => {
    // Red king steps 24-28 on the 80th quiet move, which leaves White's man on 32 stuck.
    const position = positionFromRows(['....', '....', '....', '....', '....', '..rR', '..r.', '...w'], 'red', QUIET_PLIES_FOR_DRAW - 1);
    const after = applyMove(position, findMove(position, '24-28')!);
    expect(after.quietPlies).toBe(QUIET_PLIES_FOR_DRAW);
    expect(boardResult(after)).toEqual({ ending: 'no-moves', winner: 'red' });
  });
});

describe('replaying a game', () => {
  it('replays legal moves, including forced captures and a choice of recaptures', () => {
    const opening = ['11-15', '22-18', '15x22'];
    const replayed = replay(opening);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.result).toBeNull();
    // White must recapture, and has two ways to do it.
    expect(notations(replayed.position)).toEqual(['25x18', '26x17']);
    expect(replay([...opening, '25x18']).ok).toBe(true);
    expect(replay([...opening, '26x17']).ok).toBe(true);
  });

  it('rejects illegal moves', () => {
    expect(replay(['22-18'])).toEqual({ ok: false, badMoveIndex: 0 }); // White can't go first
    expect(replay(['11-15', '22-18', '12-16'])).toEqual({ ok: false, badMoveIndex: 2 }); // ignored a capture
    expect(replay(['11-15', '22-18', '15x22', '24-20'])).toEqual({ ok: false, badMoveIndex: 3 });
    expect(replay(['11-15', '23-19', '15x24'])).toEqual({ ok: false, badMoveIndex: 2 }); // landing on a piece
    expect(replay(['11-18'])).toEqual({ ok: false, badMoveIndex: 0 });
    expect(replay(['e2e4'])).toEqual({ ok: false, badMoveIndex: 0 });
  });

  it('plays whole random games to the end, and rejects any move after the end', () => {
    for (let game = 1; game <= 30; game++) {
      const random = seeded(game);
      let position = startPosition();
      const moves: string[] = [];
      while (!boardResult(position)) {
        const options = legalMoves(position);
        const move = options[Math.floor(random() * options.length)];
        moves.push(move.notation);
        position = applyMove(position, move);
      }
      const replayed = replay(moves);
      expect(replayed.ok && replayed.result).toEqual(boardResult(position));
      expect(replay([...moves, '1-5'])).toEqual({ ok: false, badMoveIndex: moves.length });
    }
  });
});
