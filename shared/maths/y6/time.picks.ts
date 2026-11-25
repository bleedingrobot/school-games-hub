/** Card L2: the 24-hour time picks, checked against their four choices by separate arithmetic. */
import { expect } from 'vitest';

const from24 = (t: string) => {
  const m = /^(\d\d):(\d\d)$/.exec(t)!;
  return Number(m[1]) * 60 + Number(m[2]);
};
const from12 = (t: string) => {
  const m = /^(\d+):(\d\d) (am|pm)$/.exec(t)!;
  return (Number(m[1]) % 12) * 60 + Number(m[2]) + (m[3] === 'pm' ? 720 : 0);
};

export const PICK_CHECKS: Record<string, (parts: string[], prompt: string, right: string, wrong: string[]) => void> = {
  't24:to12': (parts, _p, right, wrong) => {
    expect(from12(right)).toBe(from24(parts[0]));
    for (const w of wrong) expect(from12(w)).not.toBe(from24(parts[0]));
  },
  't24:to24': (parts, _p, right, wrong) => {
    expect(from24(right)).toBe(from12(parts[0]));
    for (const w of wrong) expect(from24(w)).not.toBe(from12(parts[0]));
  },
};
