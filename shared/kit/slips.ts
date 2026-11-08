/**
 * The kind of slip behind a child's wrong taps, for the teacher's "usual slip" line (LEARNING-DESIGN rule 9, S34). No game
 * words here: a game gives its goes (with a way to name a wrong pick) and the child's taps, and gets back, for each go, the
 * kind of the first wrong tap (null when the child was right first time). The shape is the one Robin's and Parrot's own
 * `slipsOf` have used since they were built.
 */

/** A tap: the number the child picked. */
export interface SlipTap {
  pick: number;
}

/** What a game says about a go: what is right, and the kind of slip a wrong pick is (null when it has none to name). */
export interface SlipGo<K extends string> {
  answer: number;
  kindOf: (pick: number) => K | null;
}

/**
 * For each go, the kind of its first wrong tap, or null when it was right first time (or never reached). A right tap moves on
 * to the next go; later wrong taps on the same go are not counted, only the first.
 */
export function slipsOf<K extends string>(goes: readonly SlipGo<K>[], taps: readonly SlipTap[]): (K | null)[] {
  const slips: (K | null)[] = goes.map(() => null);
  let at = 0;
  let tried = false;
  for (const { pick } of taps) {
    const go = goes[at];
    if (!go) break;
    if (pick === go.answer) {
      at++;
      tried = false;
      continue;
    }
    if (!tried) slips[at] = go.kindOf(pick);
    tried = true;
  }
  return slips;
}

/** Enough evidence for a "usual slip": the commonest kind needs at least this many in the last ten challenges. */
export const SLIP_SHOW_MIN = 3;

/**
 * The commonest kind in a list of slips (nulls are right-first-time goes and are ignored), only if it was seen at least `min`
 * times; null otherwise, including when two kinds tie, so the line is "no single slip stands out yet".
 */
export function topSlip<K extends string>(slips: readonly (K | null)[], min: number = SLIP_SHOW_MIN): K | null {
  const counts = new Map<K, number>();
  for (const s of slips) if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < min) return null;
  if (ranked[1] && ranked[1][1] === ranked[0][1]) return null;
  return ranked[0][0];
}
