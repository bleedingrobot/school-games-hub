/**
 * The temple's glyphs: rune shapes of 4 to 6 cells on the 4 × 4 grid. Each wall's right tiles sit on one of these, so
 * the lit tiles make a real rune. Drawn by hand: '#' is a cell, '.' is empty, rows top to bottom.
 */
import { CELLS, GRID } from './config';

const DRAWN: readonly string[] = [
  // 4 cells
  '#... #... #... ##..',
  '.... .##. .##. ....',
  '#..# .... .... #..#',
  '.#.. ###. .... ....',
  '#... .#.. ..#. ...#',
  '..#. ..#. .##. ....',
  '##.. .... .... ..##',
  '.#.. .#.. .#.. .#..',
  '.... #### .... ....',
  '#... ##.. .#.. ....',
  '...# ..#. .#.. #...',
  '.##. .... .##. ....',
  // 5 cells
  '#... #... #... ###.',
  '.#.. ###. .#.. ....',
  '#.#. .#.. #.#. ....',
  '..#. ..#. ###. ....',
  '##.. .#.. .##. ....',
  '#... .#.. ..#. ..##',
  '.... .##. .#.. ##..',
  '#..# .##. .... ..#.',
  '##.# .... .... #...',
  '...# ...# ..## ...#',
  '.#.. .#.. ###. ....',
  '#... ##.. .##. ....',
  // 6 cells
  '#..# #..# .... #..#',
  '###. #... ##.. ....',
  '.##. #..# .##. ....',
  '#... ###. ..#. ..##',
  '.#.. ###. .#.. .#..',
  '#.#. .#.. #.#. ...#',
  '##.. ##.. .... ..##',
  '..## ..#. .##. .#..',
  '#... #... #### ....',
  '.#.# .... #.#. .#..',
];

const cellsOf = (drawing: string): number[] => {
  const flat = drawing.replace(/ /g, '');
  if (flat.length !== CELLS) throw new Error(`glyph drawing must have ${CELLS} cells: ${drawing}`);
  return [...flat].flatMap((ch, i) => (ch === '#' ? [i] : []));
};

/** Every glyph as its sorted cell numbers. */
export const GLYPHS: readonly (readonly number[])[] = DRAWN.map(cellsOf);

export const glyphsOfSize = (size: number): (readonly number[])[] => GLYPHS.filter((g) => g.length === size);

/** The same cells, in order (for comparing a lit set with a glyph). */
export const sameCells = (a: readonly number[], b: readonly number[]): boolean => {
  if (a.length !== b.length) return false;
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.every((v, i) => v === y[i]);
};

export const rowCol = (cell: number): [number, number] => [Math.floor(cell / GRID), cell % GRID];
