// Writes shared/archery/aim.ts: one direction per whole degree (0–180), as plain numbers, so the
// game never needs Math.cos or Math.sin while it runs (they can differ slightly between browsers).
// Run once: node scripts/archery-aim-table.mjs (the file is checked in; a test checks it matches).
import { writeFileSync } from 'node:fs';

const round = (v) => {
  const r = Number(v.toFixed(15));
  return Object.is(r, -0) ? 0 : r;
};
const xs = [];
const ys = [];
for (let d = 0; d <= 180; d++) {
  xs.push(round(Math.cos((d * Math.PI) / 180)));
  ys.push(round(Math.sin((d * Math.PI) / 180)));
}
const rows = (a) => {
  const out = [];
  for (let i = 0; i < a.length; i += 6) out.push('  ' + a.slice(i, i + 6).join(', ') + ',');
  return out.join('\n');
};
const src = `/**
 * Aim directions, one per whole degree from 0 (right) to 180 (left), with 90 straight up.
 * Written by scripts/archery-aim-table.mjs and checked in as plain numbers, so nothing works out
 * a sine or cosine while the game runs (aim.test.ts checks they match Math.cos and Math.sin).
 */
import { MAX_ANGLE } from './config';

/** How far right each degree points (cos). */
export const AIM_X: readonly number[] = [
${rows(xs)}
];

/** How far up each degree points (sin). Screens' y grows downwards, so a shot's vy starts at −AIM_Y. */
export const AIM_Y: readonly number[] = [
${rows(ys)}
];

/** A whole-degree angle kept to 0–180. */
export function clampAngle(angle: number): number {
  const a = Math.floor(angle);
  return a < 0 ? 0 : a > MAX_ANGLE ? MAX_ANGLE : a;
}
`;
writeFileSync(new URL('../shared/archery/aim.ts', import.meta.url), src);
console.log('wrote shared/archery/aim.ts');
