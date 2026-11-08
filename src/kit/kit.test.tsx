import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DotPicture, NumberLine, TenFrame, frameSquares, gridDots, lineTicks, lineX, valueAtX } from '.';

const circles = (html: string) => (html.match(/<circle/g) ?? []).length;

describe('kit pictures', () => {
  it('a ten-frame shows each kind of square and says what it is for a screen reader', () => {
    expect(frameSquares({ filled: 5, highlight: 2, extra: 1, empty: 1, faint: 1 })).toEqual(['filled', 'filled', 'filled', 'filled', 'filled', 'highlight', 'highlight', 'extra', 'empty', 'faint']);
    expect(frameSquares({ filled: 9, highlight: 9 })).toHaveLength(10);
    const html = renderToStaticMarkup(<TenFrame squares={frameSquares({ filled: 3, highlight: 1, empty: 2 })} label="Three counters, one picked out" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Three counters, one picked out"');
    expect(html).toContain('currentColor');
    expect((html.match(/<rect/g) ?? []).length).toBe(10);
    // 3 filled + (ring + counter) + 2 dashed spaces.
    expect(circles(html)).toBe(3 + 2 + 2);
  });

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

  it('a number line can zoom into one gap with a lens, be tapped for the value under the tap, and colour a point by part', () => {
    // 28 is the line's left end and 572 its right end, so the middle is 300.
    expect(valueAtX(300, 0, 100)).toBe(50);
    expect(valueAtX(300, 40, 50)).toBe(45);
    expect(valueAtX(-50, 0, 100)).toBe(0);
    expect(valueAtX(900, 0, 100)).toBe(100);
    expect(valueAtX(10, 5, 5)).toBe(5);
    const plain = renderToStaticMarkup(<NumberLine min={0} max={100} step={10} label="A line" />);
    expect(plain).not.toContain('stroke-dasharray');
    expect(plain).not.toContain('data-pick');
    const html = renderToStaticMarkup(
      <NumberLine
        min={0}
        max={100}
        step={10}
        labelEvery={5}
        lens={{ from: 40, to: 50, step: 1, labelEvery: 5, points: [{ value: 47, label: '?', look: 'ring', tone: 'arc' }] }}
        onPick={() => undefined}
        colors={{ arc: 'var(--game-arc)' }}
        label="A line from 0 to 100 zoomed in on 40 to 50"
      />,
    );
    expect(html).toContain('stroke-dasharray');
    expect(html).toContain('data-pick="lens"');
    expect(html).toContain('var(--game-arc)');
    expect(html).toContain('>45<');
    expect(html).not.toContain('NaN');
    expect(renderToStaticMarkup(<NumberLine min={0} max={100} lens={{ from: 40, to: 50 }} onPick={() => undefined} pickOn="line" label="x" />)).toContain('data-pick="line"');
  });

  it('a dot picture draws every dot, the frame, the gaps and the groups, and arrays come out in neat rows', () => {
    const dots = gridDots(3, 4, 240, 140, 30);
    expect(dots).toHaveLength(12);
    expect(new Set(dots.map((d) => d.y)).size).toBe(3);
    const html = renderToStaticMarkup(
      <DotPicture dots={dots.slice(0, 10)} width={240} height={140} frame={{ x: 60, y: 25, rows: 3, cols: 4, cell: 30 }} mode="groups" tones={['#2f6fb5', '#e0891a']} ghosts tintGaps label="Ten dots in rows" />,
    );
    expect(html).toContain('aria-label="Ten dots in rows"');
    expect(html).toContain('#e0891a');
    // 10 dots + 2 ghost spaces in the frame's empty squares.
    expect(circles(html)).toBe(12);
    expect(html).not.toContain('NaN');
  });
});
