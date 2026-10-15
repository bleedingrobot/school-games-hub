/**
 * Gem colours and shapes, shared by the canvas and the SVG icons so they always match.
 * Each colour has its own shape, so gems can be told apart without seeing colour.
 */
import type { Colour } from '../../../../shared/gem-keep/gems';

export const GEM_COLOURS: Record<Colour, { fill: string; light: string; dark: string }> = {
  red: { fill: '#e5383b', light: '#ffb3b0', dark: '#8c1418' },
  blue: { fill: '#2f80ed', light: '#b5d4ff', dark: '#123f86' },
  green: { fill: '#22a86a', light: '#a8f0c8', dark: '#0d5a35' },
  yellow: { fill: '#f5b800', light: '#fff1a8', dark: '#8a5a00' },
};

/** The shape's corners around (0, 0), fitting a circle of radius 1. Null means a circle. */
export function shapePoints(colour: Colour): [number, number][] | null {
  switch (colour) {
    case 'blue':
      return null;
    case 'red':
      return [0, 1, 2].map((i) => polar(-Math.PI / 2 + (i * 2 * Math.PI) / 3, 1)).map(([x, y]) => [x, y + 0.15]);
    case 'green':
      return [0, 1, 2, 3, 4, 5].map((i) => polar((i * Math.PI) / 3, 0.95));
    case 'yellow':
      return Array.from({ length: 10 }, (_, i) => polar(-Math.PI / 2 + (i * Math.PI) / 5, i % 2 ? 0.45 : 1.05));
  }
}

function polar(angle: number, r: number): [number, number] {
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

/** An SVG path for the shape, centred on (cx, cy) with radius r. */
export function svgPath(colour: Colour, cx: number, cy: number, r: number): string {
  const points = shapePoints(colour);
  if (!points) return `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${(cx + x * r).toFixed(2)},${(cy + y * r).toFixed(2)}`).join(' ') + ' Z';
}

/** Traces the shape on a canvas (call fill/stroke afterwards). */
export function traceShape(ctx: CanvasRenderingContext2D, colour: Colour, cx: number, cy: number, r: number) {
  ctx.beginPath();
  const points = shapePoints(colour);
  if (!points) {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    return;
  }
  points.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * r, cy + y * r) : ctx.moveTo(cx + x * r, cy + y * r)));
  ctx.closePath();
}
