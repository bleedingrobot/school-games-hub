/**
 * One record per pair for the bonds to 100 and 1000 (Beanstalk, S34): `bond100:30+70` and `bond1000:300+700`, the smaller number
 * first, like `bond10:3+7`. They belong to the same ladder skills as the older one-key-for-all records `bond100:tens` and
 * `bond1000:hundreds` (which are still kept and still count). A skill is secure when either the old key or the pair keys say so.
 */
import { TOP_BOX } from '../config';
import type { FactStats } from '../leitner';
import { STEP_SECURE_SHARE } from '../selector';

/** `bond100:30+70` or `bond1000:300+700`: whole tens (or hundreds) that make the total, the smaller first. */
const PAIR = /^bond(100|1000):(\d{1,3})\+(\d{1,3})$/;

export const BOND_PAIR_TOTALS = [100, 1000] as const;
export type BondPairTotal = (typeof BOND_PAIR_TOTALS)[number];

/** The old record of each total, which the pair records add to. */
export const OLD_BOND_KEY: Record<BondPairTotal, string> = { 100: 'bond100:tens', 1000: 'bond1000:hundreds' };

/** The pairs Beanstalk practises: 10 + 90 to 50 + 50 (100 + 900 to 500 + 500). */
export const bondPairKeys = (total: BondPairTotal): string[] => {
  const step = total / 10;
  return [1, 2, 3, 4, 5].map((n) => `bond${total}:${n * step}+${total - n * step}`);
};

/** True for a pair key that could have been made: the numbers add to the total, the smaller first, in whole tens (hundreds). */
export function isBondPairKey(key: string): boolean {
  const m = PAIR.exec(key);
  if (!m) return false;
  const total = Number(m[1]);
  const lo = Number(m[2]);
  const hi = Number(m[3]);
  const step = total / 10;
  return lo >= step && lo <= hi && lo + hi === total && lo % step === 0 && m[2] === String(lo) && m[3] === String(hi);
}

/** Which total a pair key is for, or null. */
export const totalOfPairKey = (key: string): BondPairTotal | null => (isBondPairKey(key) ? (Number(PAIR.exec(key)![1]) as BondPairTotal) : null);

/**
 * The records with one stand-in for each old key: where the pair records say a total is secure (70 percent of its pairs in box 2
 * or more, or in the top box), the old key counts as at least that. The old record is never made smaller and nothing is saved.
 */
export function foldBondPairs(stats: Iterable<FactStats>): FactStats[] {
  const list = [...stats];
  const byKey = new Map(list.map((s) => [s.key, s]));
  const out = [...list];
  for (const total of BOND_PAIR_TOTALS) {
    const pairs = bondPairKeys(total).map((k) => byKey.get(k)).filter((s): s is FactStats => !!s && s.attempts > 0);
    if (pairs.length === 0) continue;
    const share = (box: number) => pairs.filter((p) => p.box >= box).length / bondPairKeys(total).length;
    const fromPairs = share(TOP_BOX) >= STEP_SECURE_SHARE ? TOP_BOX : share(2) >= STEP_SECURE_SHARE ? 2 : 0;
    const key = OLD_BOND_KEY[total];
    const old = byKey.get(key);
    const attempts = (old?.attempts ?? 0) + pairs.reduce((n, p) => n + p.attempts, 0);
    const merged: FactStats = {
      key,
      attempts,
      correct: (old?.correct ?? 0) + pairs.reduce((n, p) => n + p.correct, 0),
      avgMs: attempts ? ((old?.avgMs ?? 0) * (old?.attempts ?? 0) + pairs.reduce((n, p) => n + p.avgMs * p.attempts, 0)) / attempts : 0,
      box: Math.max(old?.box ?? 0, fromPairs),
      lastSeen: Math.max(old?.lastSeen ?? 0, ...pairs.map((p) => p.lastSeen)),
      quickDays: [...new Set([...(old?.quickDays ?? []), ...pairs.flatMap((p) => p.quickDays)])].sort().slice(-2),
    };
    const at = out.findIndex((s) => s.key === key);
    if (at >= 0) out[at] = merged;
    else out.push(merged);
  }
  return out;
}
