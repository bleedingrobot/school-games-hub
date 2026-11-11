import { useOtherGameCells } from '../../data/otherGames';

/** The Progress tab's Bond Match column: stars won, added up over every set and board size. */
export const useBondMatchCells = (classId: string) => useOtherGameCells(classId, 'bond-match');
