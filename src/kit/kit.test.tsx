import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NumberLine, lineTicks, lineX} from '.';

const circles = (html: string) => (html.match(/<circle/g) ?? []).length;

describe('kit pictures', () => {

  it('a number line puts values in the right place, on any range, and draws every part', () => {
    expect(lineX(50, 0, 100, 400)).toBe(200);
    expect(lineX(45, 40, 50, 400)).toBe(200);
    expect(lineX(-5, 0, 10, 100)).toBe(0);
    expect(lineX(3, 5, 5, 100)).toBe(0);
    expect(lineTicks(0, 10, 2)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(lineTicks(0, 1_000_000, 1)).toEqual([]);
    const html = renderToStaticMarkup(
      <NumberLine
        min={0}
        max={20}
        step={1}
        labelEvery={5}
        landmarks={[{ value: 10 }, { value: 15, label: null }]}
        arcs={[{ from: 0, to: 10, label: '+10' }, { from: 10, to: 4, side: 'below', label: '-6' }]}
        points={[{ value: 13, label: '?', look: 'ring' }]}
        colors={{ arc: 'var(--game-arc)' }}
        label="A line from 0 to 20 with a jump of ten"
      />,
    );
    expect(html).toContain('aria-label="A line from 0 to 20 with a jump of ten"');
    expect(html).toContain('var(--game-arc)');
    expect(html).toContain('+10');
    expect(html).toContain('-6');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    // An arrow point sits above the line (a stem and a head, no circle), and room keeps the height the same with or without arcs.
    const height = (h: string) => Number(/viewBox="0 0 600 ([\d.]+)"/.exec(h)?.[1]);
    const plainLine = height(renderToStaticMarkup(<NumberLine min={0} max={100} label="A line" />));
    const arrow = renderToStaticMarkup(<NumberLine min={0} max={100} points={[{ value: 47, look: 'arrow', label: 'here' }]} label="A line with an arrow" />);
    expect(circles(arrow)).toBe(0);
    expect(arrow).toContain('here');
    expect(height(arrow)).toBeGreaterThan(plainLine);
    const bare = renderToStaticMarkup(<NumberLine min={0} max={100} room={110} roomBelow={100} label="A line" />);
    const jumps = renderToStaticMarkup(<NumberLine min={0} max={100} room={110} roomBelow={100} arcs={[{ from: 40, to: 47, label: '+7' }, { from: 47, to: 40, side: 'below', label: '-7' }]} label="A line" />);
    expect(height(jumps)).toBe(height(bare));
    expect(height(bare)).toBeGreaterThan(plainLine);
    // A lens can carry its own arcs.
    const lensJump = renderToStaticMarkup(<NumberLine min={0} max={100} lens={{ from: 40, to: 50, arcs: [{ from: 40, to: 47, label: '+7 on the lens' }] }} label="A line" />);
    expect(lensJump).toContain('+7 on the lens');
    expect(lensJump).not.toContain('NaN');
  });

});
