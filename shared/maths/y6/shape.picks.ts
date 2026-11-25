/** Card L4: pick questions whose right choice is a word or a point. Checked from the clue or the question text. */
import { expect } from 'vitest';

const QUAD: Record<string, string> = {
  'one pair of parallel sides': 'trapezium',
  'two pairs of parallel sides, no right angles, not all sides equal': 'parallelogram',
  'four equal sides, no right angles': 'rhombus',
  'two pairs of equal sides next to each other': 'kite',
  'four right angles, four equal sides': 'square',
  'four right angles, opposite sides equal, not a square': 'rectangle',
};
const TRI: Record<string, string> = {
  'three equal sides': 'equilateral',
  'exactly two equal sides': 'isosceles',
  'no equal sides': 'scalene',
  'one right angle': 'right-angled',
};
const byClue = (table: Record<string, string>) => (_parts: string[], prompt: string, right: string, wrong: string[]) => {
  const clue = /has (.+)\?$/.exec(prompt)![1];
  expect(right, prompt).toBe(table[clue]);
  for (const w of wrong) expect(w, prompt).not.toBe(table[clue]);
};
const onAxis = (p: string, axis: string) => {
  const [x, y] = /^\((\d+), (\d+)\)$/.exec(p)!.slice(1).map(Number);
  return axis === 'x' ? y === 0 && x > 0 : x === 0 && y > 0;
};

export const PICK_CHECKS: Record<string, (parts: string[], prompt: string, right: string, wrong: string[]) => void> = {
  'shp:quad': byClue(QUAD),
  'shp:tri': byClue(TRI),
  'coord:axis': (_parts, prompt, right, wrong) => {
    const axis = /on the (x|y)-axis/.exec(prompt)![1];
    expect(onAxis(right, axis), prompt).toBe(true);
    for (const w of wrong) expect(onAxis(w, axis), `${prompt} ${w}`).toBe(false);
  },
};
