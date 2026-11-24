/**
 * Boss health by mode, round length and class size. WRITTEN BY THE SIMULATOR: npm run showdown:sim -- --write
 * Tuned so a typical class beats the boss in about 80% of rounds (docs/SHOWDOWN-PLAN.md stage 1).
 * Each row is [pupils, health]; sizes in between are read off a straight line, sizes past the ends scale per pupil.
 */
import type { Mode } from './types';

export const BOSS_HEALTH: Record<Mode, Record<number, [number, number][]>> = {
  class: {
    5: [[8, 275], [12, 425], [16, 605], [20, 750], [24, 930], [28, 1100], [32, 1255]],
    10: [[8, 500], [12, 855], [16, 1135], [20, 1490], [24, 1825], [28, 2185], [32, 2450]],
    15: [[8, 690], [12, 1215], [16, 1695], [20, 2190], [24, 2585], [28, 3225], [32, 3705]],
  },
  teams2: {
    5: [[8, 265], [12, 410], [16, 580], [20, 720], [24, 900], [28, 1020], [32, 1170]],
    10: [[8, 455], [12, 775], [16, 1010], [20, 1340], [24, 1655], [28, 1920], [32, 2195]],
    15: [[8, 620], [12, 1065], [16, 1400], [20, 1825], [24, 2205], [28, 2575], [32, 3155]],
  },
  teams4: {
    5: [[8, 285], [12, 435], [16, 610], [20, 760], [24, 935], [28, 1110], [32, 1235]],
    10: [[8, 545], [12, 890], [16, 1165], [20, 1490], [24, 1835], [28, 2160], [32, 2435]],
    15: [[8, 775], [12, 1235], [16, 1715], [20, 2250], [24, 2660], [28, 3260], [32, 3640]],
  },
  solo: {
    5: [[8, 380], [12, 595], [16, 810], [20, 1020], [24, 1225], [28, 1430], [32, 1630]],
    10: [[8, 755], [12, 1195], [16, 1615], [20, 2060], [24, 2470], [28, 2925], [32, 3300]],
    15: [[8, 1125], [12, 1815], [16, 2440], [20, 3065], [24, 3760], [28, 4455], [32, 5020]],
  },
};

/**
 * Real classes answer faster than the simulator's pupils: in the first real rounds (24 Nov 2026, 5 minutes, 19 pupils)
 * the boss fell with about 1.5 minutes left in class and solo (192 s and 210 s of 300), and Gold Rush in teams4 at 151 s.
 * James asked for it a little harder. The pretend pupils in bots.ts now think at the real pace, and every table value is
 * scaled by this: about 78% of rounds won, and a won round ends about 30 to 40 seconds before the bell.
 */
export const REAL_CLASS_PACE = 1.3;

/** The boss's full health for this many pupils. */
export function bossHealth(mode: Mode, lengthMin: number, pupils: number): number {
  return Math.round(tableHealth(mode, lengthMin, pupils) * REAL_CLASS_PACE);
}

function tableHealth(mode: Mode, lengthMin: number, pupils: number): number {
  const rows = BOSS_HEALTH[mode][lengthMin] ?? BOSS_HEALTH[mode][10];
  const n = Math.max(1, pupils);
  if (n <= rows[0][0]) return Math.round((rows[0][1] / rows[0][0]) * n);
  const last = rows[rows.length - 1];
  if (n >= last[0]) return Math.round((last[1] / last[0]) * n);
  for (let i = 1; i < rows.length; i++) {
    const [n0, h0] = rows[i - 1];
    const [n1, h1] = rows[i];
    if (n <= n1) return Math.round(h0 + ((h1 - h0) * (n - n0)) / (n1 - n0));
  }
  return last[1];
}
