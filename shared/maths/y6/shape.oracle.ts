/** Card L4: answers worked out from the screen text alone. */
const SOLIDS: Record<string, number> = { cube: 6, 'square-based pyramid': 5, 'triangular prism': 5, 'triangular pyramid': 4 };
const ORDER: Record<string, number> = {
  square: 4, rectangle: 2, 'equilateral triangle': 3, 'regular pentagon': 5, 'regular hexagon': 6, 'regular octagon': 8,
  rhombus: 2, parallelogram: 2, kite: 1, 'isosceles triangle': 1,
};

export function oracle(key: string, parts: string[]): number | null {
  if (key === 'shp:faces') return SOLIDS[/^Faces of a (.+)$/.exec(parts[0])![1]];
  if (key === 'rot:order') return ORDER[/^Order of rotational symmetry of a (.+)$/.exec(parts[0])![1]];
  if (key === 'coord:move') {
    const [, x, y] = /^Start at \((\d+), (\d+)\)$/.exec(parts[0])!.map(Number);
    const m = /^Move (\d+) (right|left|up|down)$/.exec(parts[1])!;
    const n = Number(m[1]);
    const dx = m[2] === 'right' ? n : m[2] === 'left' ? -n : 0;
    const dy = m[2] === 'up' ? n : m[2] === 'down' ? -n : 0;
    // The blank is the coordinate that moved.
    return parts[2].startsWith('Now at (?') ? x + dx : y + dy;
  }
  return null;
}
