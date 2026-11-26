/**
 * Year 6 ladder skills: Shapes and coordinates (docs/plans/ladder-y6/PLAN.md). Built the way docs/plans/ladder-7-8/BUILD-SPEC.md says.
 * Instant recall only: name a shape from its clue, the order of turn symmetry of a common shape, and one step on a grid.
 *
 *   shape-clue    shp:quad  shp:tri  shp:faces
 *   rot-symmetry  rot:order
 *   coordinates   coord:move  coord:axis
 */
import { int, isInt, type Family } from '../banded';
import type { Figure } from '../figure';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { goodPick, pick, rollPick } from './pickKit';
import type { Y6Row } from './y6Row';

const SHAPE_TAGS = ['MS.Y6.GEO.SH.P1'];
const ROT_TAGS = ['MS.Y6.GEO.SH.P3'];
const COORD_TAGS = ['MS.Y6.ALG.ER.P3'];

// ---------------------------------------------------------------- shape-clue

type Clue = { clue: string; right: string; wrong: [string, string][] };

const QUADS: Clue[] = [
  { clue: 'one pair of parallel sides', right: 'trapezium', wrong: [['mixed it up with a parallelogram', 'parallelogram'], ['thought of a kite', 'kite'], ['thought of a rectangle', 'rectangle'], ['thought of a rhombus', 'rhombus']] },
  { clue: 'two pairs of parallel sides, no right angles, not all sides equal', right: 'parallelogram', wrong: [['mixed it up with a rhombus', 'rhombus'], ['thought of a rectangle', 'rectangle'], ['thought of a trapezium', 'trapezium'], ['thought of a kite', 'kite']] },
  { clue: 'four equal sides, no right angles', right: 'rhombus', wrong: [['mixed it up with a square', 'square'], ['mixed it up with a parallelogram', 'parallelogram'], ['thought of a kite', 'kite'], ['thought of a trapezium', 'trapezium']] },
  { clue: 'two pairs of equal sides next to each other', right: 'kite', wrong: [['mixed it up with a parallelogram', 'parallelogram'], ['mixed it up with a rhombus', 'rhombus'], ['thought of a rectangle', 'rectangle'], ['thought of a trapezium', 'trapezium']] },
  { clue: 'four right angles, four equal sides', right: 'square', wrong: [['mixed it up with a rectangle', 'rectangle'], ['mixed it up with a rhombus', 'rhombus'], ['thought of a parallelogram', 'parallelogram'], ['thought of a kite', 'kite']] },
  { clue: 'four right angles, opposite sides equal, not a square', right: 'rectangle', wrong: [['mixed it up with a square', 'square'], ['mixed it up with a parallelogram', 'parallelogram'], ['thought of a rhombus', 'rhombus'], ['thought of a trapezium', 'trapezium']] },
];

const TRIS: Clue[] = [
  { clue: 'three equal sides', right: 'equilateral', wrong: [['mixed it up with isosceles', 'isosceles'], ['thought of scalene', 'scalene'], ['thought of right-angled', 'right-angled']] },
  { clue: 'exactly two equal sides', right: 'isosceles', wrong: [['mixed it up with equilateral', 'equilateral'], ['thought of scalene', 'scalene'], ['thought of right-angled', 'right-angled']] },
  { clue: 'no equal sides', right: 'scalene', wrong: [['mixed it up with isosceles', 'isosceles'], ['thought of equilateral', 'equilateral'], ['thought of right-angled', 'right-angled']] },
  { clue: 'one right angle', right: 'right-angled', wrong: [['thought of scalene', 'scalene'], ['thought of isosceles', 'isosceles'], ['thought of equilateral', 'equilateral']] },
];

/** A name-the-shape question: the clue is the prompt, the choices are shape names. */
function clueFamily(key: string, label: string, list: Clue[], word: string): Family {
  return oneKey(
    key,
    label,
    SHAPE_TAGS,
    3,
    (_k, r) => [int(r, 0, list.length - 1), ...rollPick(r)],
    (_k, [i, slot, salt]) => {
      if (!isInt(i, 0, list.length - 1) || !goodPick(slot, salt)) return null;
      const c = list[i];
      const named: Record<string, string> = {};
      for (const [why, shape] of c.wrong) named[why] = shape;
      const made = pick(
        { parts: [word[0].toUpperCase() + word.slice(1), '=', '?'], spoken: `Which ${word} has ${c.clue}?`, fact: `${c.right} has ${c.clue}` },
        c.right,
        named,
        { slot, salt },
      );
      return made ? { ...made, prompt: `Which ${word} has ${c.clue}?` } : null;
    },
  );
}

const SOLIDS = [
  { name: 'cube', faces: 6, vertices: 8, edges: 12, forgot: 5 },
  { name: 'square-based pyramid', faces: 5, vertices: 5, edges: 8, forgot: 4 },
  { name: 'triangular prism', faces: 5, vertices: 6, edges: 9, forgot: 3 },
  { name: 'triangular pyramid', faces: 4, vertices: 4, edges: 6, forgot: 3 },
];

const faces = oneKey(
  'shp:faces',
  'Faces of a 3D shape (cube, pyramid, prism)',
  SHAPE_TAGS,
  1,
  (_k, r) => [int(r, 0, SOLIDS.length - 1)],
  (_k, [i]) => {
    if (!isInt(i, 0, SOLIDS.length - 1)) return null;
    const s = SOLIDS[i];
    return withMistakes(
      { parts: [`Faces of a ${s.name}`, '=', '?'], spoken: `How many faces has a ${s.name}?`, answer: s.faces },
      { 'counted the corners': s.vertices, 'counted the edges': s.edges, 'forgot the base': s.faces - 1, 'forgot the ends': s.forgot, 'one more': s.faces + 1 },
    );
  },
);

// ---------------------------------------------------------------- rot-symmetry

const TURNS = [
  { name: 'square', fig: 'square', order: 4, sides: 4, lines: 4 },
  { name: 'rectangle', fig: 'rectangle', order: 2, sides: 4, lines: 2 },
  { name: 'equilateral triangle', fig: 'equilateral', order: 3, sides: 3, lines: 3 },
  { name: 'regular pentagon', fig: 'pentagon', order: 5, sides: 5, lines: 5 },
  { name: 'regular hexagon', fig: 'hexagon', order: 6, sides: 6, lines: 6 },
  { name: 'regular octagon', fig: 'octagon', order: 8, sides: 8, lines: 8 },
  { name: 'rhombus', fig: 'rhombus', order: 2, sides: 4, lines: 2 },
  { name: 'parallelogram', fig: 'parallelogram', order: 2, sides: 4, lines: 0 },
  { name: 'kite', fig: 'kite', order: 1, sides: 4, lines: 1 },
  { name: 'isosceles triangle', fig: 'isosceles', order: 1, sides: 3, lines: 1 },
] as const;

const order = oneKey(
  'rot:order',
  'Order of rotational symmetry of a common shape',
  ROT_TAGS,
  1,
  (_k, r) => [int(r, 0, TURNS.length - 1)],
  (_k, [i]) => {
    if (!isInt(i, 0, TURNS.length - 1)) return null;
    const t = TURNS[i];
    // The shape's name is the part (a part is at most 40 letters on the server); the prompt says what is asked.
    const parts = [t.name[0].toUpperCase() + t.name.slice(1), '=', '?'];
    const an = /^[aeiou]/.test(t.name) ? 'an' : 'a';
    const made = withMistakes(
      { parts, spoken: `What is the order of rotational symmetry of ${an} ${t.name}?`, answer: t.order, figure: { kind: 'shape', name: t.fig } },
      { 'gave the number of sides': t.sides, 'gave the lines of symmetry': t.lines, 'said 1': 1, 'one more': t.order + 1, 'one less': t.order - 1, 'doubled it': t.order * 2 },
    );
    return made ? { ...made, prompt: 'Order of rotational symmetry' } : null;
  },
);

// ---------------------------------------------------------------- coordinates

const DIRS = ['right', 'left', 'up', 'down'] as const;

const move = oneKey(
  'coord:move',
  'Moving a point on a grid (start at (2, 3), 4 right)',
  COORD_TAGS,
  4,
  (_k, r) => {
    for (;;) {
      const x = int(r, 0, 10);
      const y = int(r, 0, 10);
      const d = int(r, 0, 3);
      const n = int(r, 1, 6);
      const [ex, ey] = end(x, y, d, n);
      if (ex >= 0 && ex <= 10 && ey >= 0 && ey <= 10) return [x, y, d, n];
    }
  },
  (_k, [x, y, d, n]) => {
    if (!isInt(x, 0, 10) || !isInt(y, 0, 10) || !isInt(d, 0, 3) || !isInt(n, 1, 6)) return null;
    const [ex, ey] = end(x, y, d, n);
    if (ex < 0 || ex > 10 || ey < 0 || ey > 10) return null;
    const horizontal = d < 2;
    const answer = horizontal ? ex : ey;
    const other = horizontal ? y : x;
    const start = horizontal ? x : y;
    const sign = d === 0 || d === 2 ? 1 : -1;
    const parts = [`Start at (${x}, ${y})`, `Move ${n} ${DIRS[d]}`, horizontal ? `Now at (?, ${ey})` : `Now at (${ex}, ?)`];
    const named: Named = { 'went the other way': start - sign * n, 'gave the starting number': start, 'gave the other coordinate': other, 'gave the move': n, 'one too many': answer + 1, 'one too few': answer - 1 };
    const figure: Figure = { kind: 'grid', size: 10, points: [{ x, y }] };
    return withMistakes(
      { parts, spoken: `Start at x ${x}, y ${y}. Move ${n} ${DIRS[d]}. What is the new ${horizontal ? 'x' : 'y'} coordinate?`, answer, figure },
      named,
    );
  },
);

function end(x: number, y: number, d: number, n: number): [number, number] {
  return d === 0 ? [x + n, y] : d === 1 ? [x - n, y] : d === 2 ? [x, y + n] : [x, y - n];
}

/**
 * One point marked on a big grid; the pupil reads its x value (how far across) or its y value (how far up). James, 26 Nov
 * 2026: "a single marked point on the graph and asking the kids to identify one of the values of x or y" (it was "which of
 * four points sits on the x-axis", with four labelled points crowded on a small grid). The key stays coord:axis, so the
 * ladder and pupils' records carry on. The two numbers are never the same, so mixing up x and y is always wrong.
 */
const axis = oneKey(
  'coord:axis',
  'Reading the x or y value of a point',
  COORD_TAGS,
  5,
  (_k, r) => {
    const which = int(r, 0, 1);
    const a = int(r, 1, 9);
    let b = int(r, 1, 9);
    if (b === a) b = a === 9 ? 1 : a + 1;
    // Five numbers as before (the last two are unused now), so questions already handed out still check.
    return [which, a, b, ...rollPick(r)];
  },
  (_k, [which, a, b]) => {
    if (!isInt(which, 0, 1) || !isInt(a, 1, 9) || !isInt(b, 1, 9) || a === b) return null;
    const name = which === 0 ? 'x' : 'y';
    const answer = which === 0 ? a : b;
    const figure: Figure = { kind: 'grid', size: 10, points: [{ x: a, y: b }] };
    const named: Named = { 'mixed up x and y': which === 0 ? b : a, 'one too many': answer + 1, 'one too few': answer - 1 };
    const made = withMistakes(
      { parts: [name, '=', '?'], spoken: `Look at the point on the grid. What is its ${name} value, how far ${which === 0 ? 'across' : 'up'}?`, answer, figure },
      named,
    );
    return made ? { ...made, prompt: `What is the ${name} value of the point? (How far ${which === 0 ? 'across' : 'up'}?)` } : null;
  },
);

// ---------------------------------------------------------------- the lot

export const SHAPE_FAMILIES: Record<string, Family> = Object.fromEntries(
  [clueFamily('shp:quad', 'Naming a quadrilateral from a clue', QUADS, 'quadrilateral'), clueFamily('shp:tri', 'Naming a triangle from a clue', TRIS, 'triangle'), faces, order, move, axis].map((f) => [f.keys[0], f]),
);

export const SHAPE_SKILL_KEYS: Record<string, readonly string[]> = {
  'shape-clue': ['shp:quad', 'shp:tri', 'shp:faces'],
  'rot-symmetry': ['rot:order'],
  coordinates: ['coord:move', 'coord:axis'],
};

export const SHAPE_SLOW_KEYS: string[] = [];

export const SHAPE_LADDER: readonly Y6Row[] = [
  // Shape from a clue and rotational symmetry were taken off the ladder (James, 26 Nov 2026 NZ): see FORMER_SKILLS in ladder.ts.
  // Their question types stay in SHAPE_FAMILIES so answers pupils already gave still read back.
  { id: 'coordinates', label: 'Coordinates (x, y)', tiny: 'Coordinates', stage: 'algebra', after: 'angles-y6', tags: COORD_TAGS },
];
