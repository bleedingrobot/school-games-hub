/**
 * Card Y6: the algebra questions whose right choice is a rule or a sign, not a number. Worked out from the screen text and
 * the choices with plain arithmetic. y78.test.ts runs these on every roll.
 */
import { expect } from 'vitest';

const rule = (label: string): ((n: number) => number) => {
  const m = /^(\d*)n(?: ([+−]) (\d+))?$/.exec(label)!;
  const a = m[1] === '' ? 1 : Number(m[1]);
  const b = m[2] ? (m[2] === '+' ? 1 : -1) * Number(m[3]) : 0;
  return (n) => a * n + b;
};
const side = (text: string) => {
  const m = /^(?:(\d+) × (\d+)|0\.(\d) × (\d+)|(\d+) \+ (\d+))$/.exec(text)!;
  if (m[1]) return Number(m[1]) * Number(m[2]);
  if (m[3]) return (Number(m[3]) * Number(m[4])) / 10;
  return Number(m[5]) + Number(m[6]);
};
const holds = (left: string, sign: string, right: string) => {
  const [l, r] = [side(left), side(right)];
  return { '<': l < r, '>': l > r, '≤': l <= r, '≥': l >= r, '=': Math.abs(l - r) < 1e-9 }[sign]!;
};
/** Only the right sign makes a true sentence. */
const oneSign = (parts: string[], _prompt: string, right: string, wrong: string[]) => {
  expect(holds(parts[0], right, parts[2]), parts.join(' ')).toBe(true);
  for (const w of wrong) expect(holds(parts[0], w, parts[2]), `${parts.join(' ')} ${w}`).toBe(false);
};

export const PICK_CHECKS: Record<string, (parts: string[], prompt: string, right: string, wrong: string[]) => void> = {
  // Only the right rule makes the sequence shown.
  'alg:pat-rule': (_parts, prompt, right, wrong) => {
    const seq = /makes (.+)\?$/.exec(prompt)![1].split(', ').map(Number);
    const works = (label: string) => seq.every((t, k) => rule(label)(k + 1) === t);
    expect(works(right), prompt).toBe(true);
    for (const w of wrong) expect(works(w), `${prompt} ${w}`).toBe(false);
  },
  'alg:tf-whole': oneSign,
  'alg:tf-dec': oneSign,
};
