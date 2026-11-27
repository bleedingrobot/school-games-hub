/**
 * A small picture shown above a question (James, 24 Nov 2026: "small pictures from the start" for angle and shape questions).
 *
 * A figure only ever adds to a question: the question's `parts` (and `spoken`) always say everything needed to answer it, so a
 * game that shows only the parts still works, and the server never has to check a picture. Labels are short strings: '50°',
 * '6 cm', '?' (the thing asked, drawn highlighted) or '' (no label).
 *
 * src/maths/Figure.tsx draws these as SVG inside `QuestionModal`.
 */
export type Figure =
  /** A triangle. `angles` are the corner labels, bottom-left, bottom-right, top. `equal` marks equal sides with ticks. */
  | { kind: 'triangle'; angles: [string, string, string]; equal?: 'two' | 'three' }
  /** Angles side by side on a straight line (2 or 3). */
  | { kind: 'line'; angles: string[] }
  /** Angles round a point (3 or 4), adding to 360°. */
  | { kind: 'point'; angles: string[] }
  /** Two straight lines crossing: `angles[0]` and `angles[1]` are vertically opposite. */
  /** `next` puts `angles[1]` in the angle beside `angles[0]` on the same line (they add to 180°), not opposite it. */
  | { kind: 'crossing'; angles: [string, string]; next?: boolean }
  /** A right angle split in two. */
  | { kind: 'right-angle'; angles: [string, string] }
  /** A rectangle (or square) with its side labels, and a label inside (its area, or '?'). */
  | { kind: 'rectangle'; width: string; height: string; inside?: string }
  /** A triangle drawn with its base and dashed height. */
  /** `right` draws it as a right-angled triangle, the height up its left side. */
  | { kind: 'triangle-area'; base: string; height: string; inside?: string; right?: boolean }
  | { kind: 'parallelogram'; base: string; height: string; inside?: string }
  | { kind: 'trapezium'; top: string; bottom: string; height: string; inside?: string }
  /** A box (rectangular prism) or cube; for a cube only `length` is labelled. */
  | { kind: 'cuboid'; length: string; width: string; height: string; cube?: boolean }
  | { kind: 'prism'; base: string; height: string; length: string }
  | { kind: 'circle'; radius?: string; diameter?: string }
  /** A regular polygon with one exterior angle marked. */
  | { kind: 'polygon'; sides: number; label?: string }
  /** Compass points: the turn from `from` to `to`, clockwise. With no `to`, an arrow shows the way you face (`from`). */
  | { kind: 'compass'; from: string; to?: string }
  /** A plain outline of a named shape; `side` labels its lowest side ("10 cm", for a perimeter question). */
  | { kind: 'shape'; name: ShapeName; side?: string }
  /** A small first-quadrant grid (axes numbered from 0, `size` 4-10) with dots. */
  | { kind: 'grid'; size: number; points: { x: number; y: number; label?: string }[] }
  /** A circle cut into equal parts, the first `shaded` coloured. */
  /** `colour` fills the shaded parts in that colour (the one the question names); grey without it. */
  | { kind: 'spinner'; parts: number; shaded: number; colour?: SpinnerColour }
  /** One angle, 1° to 359°, opening anticlockwise from a flat arm (Year 5 "kinds of angles"). The box shows a "Help me" button
   *  with every kind of angle and its name beside this picture (James, 26 Nov 2026). */
  | { kind: 'angle'; degrees: number }
  /** An analogue clock face showing `hour` (1-12) and `minute` (0-59, a multiple of 5). */
  | { kind: 'clock'; hour: number; minute: number };

export const SPINNER_COLOURS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type SpinnerColour = (typeof SPINNER_COLOURS)[number];

export type ShapeName =
  | 'square' | 'rectangle' | 'rhombus' | 'kite' | 'parallelogram' | 'trapezium' | 'equilateral'
  | 'isosceles' | 'scalene' | 'right-triangle' | 'pentagon' | 'hexagon' | 'octagon';

export type FigureKind = Figure['kind'];

/** True when this looks like a figure the box can draw. Anything odd is dropped, never shown half-drawn. */
export function isFigure(value: unknown): value is Figure {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && FIGURE_KINDS.includes(kind as FigureKind);
}

export const FIGURE_KINDS: readonly FigureKind[] = [
  'triangle',
  'line',
  'point',
  'crossing',
  'right-angle',
  'rectangle',
  'triangle-area',
  'parallelogram',
  'trapezium',
  'cuboid',
  'prism',
  'circle',
  'polygon',
  'compass',
  'shape',
  'grid',
  'spinner',
  'angle',
  'clock',
];
