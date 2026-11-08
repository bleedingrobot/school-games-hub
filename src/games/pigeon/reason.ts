/**
 * The reason for a wrong answer, drawn on the number line itself (maths review 2, S7): the child's own mark as a ring, the
 * jumps counted from the line's big marks to the right place, a real arrow on a read go. Pure, so it can be tested; Goes.tsx
 * hands the result to the kit line at "Let's look together" and keeps it for the rest of the go.
 */
import type { Arc, LinePoint } from '../../kit';
import type { Go } from '../../../shared/pigeon/round';

/** The most jumps counted on one line. */
export const MAX_ARCS = 10;
/** The kit line is 544 picture units wide between its ends; a label needs about this much room under it. */
const LINE_UNITS = 544;
const LABEL_SPAN = 20;

export interface Reason {
  points: LinePoint[];
  arcs: Arc[];
}

/** The big unit of the line the child works on: 100 on the 1000 line, 1 on a lens ten wide or less, else 10 (as "Let's look together" names the marks). */
export function bigUnit(go: Pick<Go, 'max' | 'lens' | 'lo' | 'hi'>): number {
  return go.max >= 1000 && !go.lens ? 100 : go.lens && go.hi - go.lo <= 10 ? 1 : 10;
}

/** An arc from `from` to `to` on a line from `lo` to `hi`, labelled when it is wide enough to hold the words. */
function jump(from: number, to: number, lo: number, hi: number, label: string, side?: 'below'): Arc {
  const wide = (Math.abs(to - from) / (hi - lo)) * LINE_UNITS >= LABEL_SPAN;
  return { from, to, ...(wide ? { label } : {}), ...(side ? { side } : {}) };
}

const signed = (d: number) => `${d > 0 ? '+' : '-'}${Math.abs(d)}`;

/**
 * What the line shows for this go once the child has been wrong twice. `tappedValue` is the child's last wrong answer in the
 * line's own units (the value under the tap for a place go, the card for the others), or null if there is none.
 */
export function reasonFor(go: Go, tappedValue: number | null): Reason {
  const { lo, hi } = go;
  const onLine = (v: number | null): v is number => v !== null && v >= lo && v <= hi;
  const ring: LinePoint[] = onLine(tappedValue) ? [{ value: tappedValue, look: 'ring' }] : [];
  const size = bigUnit(go);

  if (go.kind === 'place') {
    const low = Math.max(lo, Math.floor(go.n / size) * size);
    const arcs: Arc[] = [];
    for (let v = lo; v + size <= low; v += size) arcs.push(jump(v, v + size, lo, hi, `+${size}`));
    if (go.n > low) arcs.push(jump(low, go.n, lo, hi, `+${go.n - low}`));
    return { points: [...ring, { value: go.n, label: String(go.n), tone: 'landmark' }], arcs: arcs.slice(-MAX_ARCS) };
  }

  if (go.kind === 'read') {
    // From the big mark just below (or the one before it when the arrow is on a big mark), up in little jumps.
    const below = Math.floor(go.n / size) * size;
    const low = size === 1 ? lo : Math.max(lo, below === go.n ? go.n - size : below);
    const small = Math.max(1, size / 10);
    const arcs: Arc[] = [];
    for (let v = low; v < go.n; v += small) arcs.push(jump(v, Math.min(go.n, v + small), lo, hi, `+${Math.min(go.n, v + small) - v}`));
    return { points: [{ value: go.n, look: 'arrow' }, ...ring], arcs: arcs.slice(0, MAX_ARCS) };
  }

  if (go.kind === 'tens') {
    const arcs: Arc[] = [jump(go.n, go.answer, lo, hi, signed(go.answer - go.n))];
    if (onLine(tappedValue) && tappedValue !== go.n) arcs.push(jump(go.n, tappedValue, lo, hi, signed(tappedValue - go.n), 'below'));
    return { points: [{ value: go.n, label: String(go.n) }, ...ring], arcs };
  }

  // Near: the gap to each post, the nearer one above.
  const posts = go.posts ?? [go.answer, go.answer];
  const gaps = posts.map((p) => Math.abs(p - go.n));
  const nearer = gaps[0] <= gaps[1] ? 0 : 1;
  const arcs = posts.map((p, i) => jump(go.n, p, lo, hi, String(gaps[i]), i === nearer ? undefined : 'below'));
  return { points: [{ value: go.n, label: String(go.n) }, ...ring], arcs };
}
