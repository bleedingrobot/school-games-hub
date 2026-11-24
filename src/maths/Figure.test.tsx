import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FIGURE_KINDS, isFigure, type Figure as Spec } from '../../shared/maths/figure';
import { Figure } from './Figure';

const SAMPLES: Spec[] = [
  { kind: 'triangle', angles: ['50°', '60°', '?'] },
  { kind: 'triangle', angles: ['70°', '70°', '?'], equal: 'two' },
  { kind: 'line', angles: ['115°', '?'] },
  { kind: 'point', angles: ['100°', '120°', '?'] },
  { kind: 'crossing', angles: ['40°', '?'] },
  { kind: 'right-angle', angles: ['35°', '?'] },
  { kind: 'rectangle', width: '6 cm', height: '4 cm', inside: '?' },
  { kind: 'triangle-area', base: '8 cm', height: '5 cm', inside: '?' },
  { kind: 'parallelogram', base: '9 m', height: '4 m', inside: '?' },
  { kind: 'trapezium', top: '4 cm', bottom: '10 cm', height: '5 cm', inside: '?' },
  { kind: 'cuboid', length: '5 cm', width: '3 cm', height: '2 cm' },
  { kind: 'cuboid', length: '3 cm', width: '', height: '', cube: true },
  { kind: 'prism', base: '6 cm', height: '4 cm', length: '10 cm' },
  { kind: 'circle', radius: '7 cm', diameter: '?' },
  { kind: 'polygon', sides: 6, label: '?' },
  { kind: 'compass', from: 'N', to: 'SE' },
];

describe('question pictures', () => {
  it('draws every kind, with the asked label highlighted', () => {
    expect(new Set(SAMPLES.map((s) => s.kind))).toEqual(new Set(FIGURE_KINDS));
    for (const f of SAMPLES) {
      const { container, unmount } = render(<Figure figure={f} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(container.innerHTML).not.toContain('NaN');
      if (JSON.stringify(f).includes('?')) expect(container.querySelector('.fig__label--ask')).not.toBeNull();
      unmount();
    }
    // Only figures it can draw are shown.
    expect(isFigure({ kind: 'triangle', angles: ['', '', ''] })).toBe(true);
    expect(isFigure({ kind: 'hexagon-ish' })).toBe(false);
    expect(isFigure(null)).toBe(false);
  });
});
