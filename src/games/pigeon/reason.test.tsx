import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NumberLine } from '../../kit';
import { KEYS, kindFor, kindOfKey, showGo, type Go, type Kind } from '../../../shared/pigeon/round';
import { lineFor } from './Goes';
import { MAX_ARCS, reasonFor } from './reason';

const goFor = (key: string, kind: Kind = kindFor(key)): Go => showGo({ seed: 5 }, 0, { key, kind, l: 5 })!;
const sum = (arcs: { from: number; to: number }[]) => arcs.reduce((t, a) => t + Math.abs(a.to - a.from), 0);

describe('the reason drawn on the line', () => {
  it('counts the jumps for a place, reads with a real arrow, shows two jump sizes for ten more and the gaps for near, and never moves the line', () => {
    const k47 = KEYS.find((k) => k === 'place100:n47') ?? KEYS.find((k) => k.startsWith('place100:n4'))!;
    const place = goFor(k47);
    const n = place.n;
    const r = reasonFor(place, 33);
    const tens = Math.floor(n / 10);
    expect(r.arcs).toHaveLength(tens + (n % 10 ? 1 : 0));
    expect(r.arcs.slice(0, tens).every((a) => a.to - a.from === 10)).toBe(true);
    expect(sum(r.arcs)).toBe(n);
    expect(r.points[0]).toMatchObject({ look: 'ring', value: 33 });
    expect(r.points.at(-1)).toMatchObject({ value: n, tone: 'landmark', label: String(n) });

    const big = goFor(KEYS.find((k) => k.startsWith('place1000'))!);
    const bigArcs = reasonFor(big, null).arcs;
    expect(bigArcs[0].to - bigArcs[0].from).toBe(100);
    expect(bigArcs.length).toBeLessThanOrEqual(MAX_ARCS);

    const zoom = goFor(KEYS.find((k) => k.startsWith('zoom'))!, 'place');
    const zoomArcs = reasonFor(zoom, null).arcs;
    expect(zoomArcs.every((a) => a.to - a.from <= Math.max(1, (zoom.hi - zoom.lo) / 10))).toBe(true);
    expect(sum(zoomArcs)).toBe(zoom.n - zoom.lo);

    const read = goFor(KEYS.find((k) => kindOfKey(k) === 'read')!);
    const rr = reasonFor(read, read.choices.find((c) => c !== read.answer)!);
    expect(rr.points[0]).toMatchObject({ look: 'arrow', value: read.n });
    expect(rr.arcs.length).toBeGreaterThan(0);
    expect(rr.arcs.length).toBeLessThanOrEqual(MAX_ARCS);
    expect(rr.arcs.at(-1)!.to).toBe(read.n);

    const ten = goFor(KEYS.find((k) => kindOfKey(k) === 'tens')!);
    const wrong = ten.choices.find((c) => c !== ten.answer)!;
    const tr = reasonFor(ten, wrong);
    expect(tr.arcs[0]).toMatchObject({ from: ten.n, to: ten.answer });
    expect(tr.arcs[1]).toMatchObject({ from: ten.n, to: wrong, side: 'below' });

    const near = goFor(KEYS.find((k) => kindOfKey(k) === 'near')!);
    const nr = reasonFor(near, near.posts![0]);
    expect(nr.arcs).toHaveLength(2);
    expect(sum(nr.arcs)).toBe(near.posts![1] - near.posts![0]);
    expect(nr.arcs.filter((a) => a.side === 'below')).toHaveLength(1);

    // The line is the same height with and without the reason, for every go the game can ask and every wrong card.
    const height = (go: Go, reason: ReturnType<typeof reasonFor> | null) => {
      const props = lineFor(go, 5, reason ? reason.points : [], [], reason ? reason.arcs : []);
      return Number(/viewBox="0 0 600 ([\d.]+)"/.exec(renderToStaticMarkup(<NumberLine {...props} label="x" />))?.[1]);
    };
    for (const key of KEYS) {
      for (const kind of kindOfKey(key) === 'zoom' ? (['place', 'read'] as const) : [kindFor(key)]) {
        const go = goFor(key, kind);
        const taps = go.kind === 'place' ? [go.lo, go.hi, go.lo + (go.hi - go.lo) / 2] : go.choices.filter((c) => c !== go.answer);
        for (const t of taps) expect(height(go, reasonFor(go, t))).toBe(height(go, null));
      }
    }
  });
});
