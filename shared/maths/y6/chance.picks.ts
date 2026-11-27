/** Card L5: pick questions whose right choice is a word or a sign, checked with plain facts. */
import { expect } from 'vitest';

const WORD_OF = (event: string): string => {
  const dice = /^Rolling an? (.+) on a dice$/.exec(event);
  if (/^A coin landing/.test(event)) return 'even chance';
  if (/^(Monday coming after Sunday|Winter coming after autumn)$/.test(event)) return 'certain';
  const what = dice![1];
  if (what === 'even number') return 'even chance';
  const m = /^(?:number )?(less than|more than) (\d)$/.exec(what);
  const faces = [1, 2, 3, 4, 5, 6];
  const hits = m ? faces.filter((f) => (m[1] === 'less than' ? f < Number(m[2]) : f > Number(m[2]))).length : faces.filter((f) => f === Number(what)).length;
  return hits === 0 ? 'impossible' : hits === 6 ? 'certain' : hits === 3 ? 'even chance' : hits < 3 ? 'unlikely' : 'likely';
};
const NUMBER_WORD: Record<string, string> = { '0': 'impossible', '0.1': 'unlikely', '0.5': 'even chance', '0.9': 'likely', '1': 'certain' };

/** Value of one side of a sentence: "8 × 7", "30 + 12" or "60". */
const side = (text: string) => {
  const m = /^(?:(\d+) × (\d+)|(\d+) \+ (\d+)|(\d+))$/.exec(text)!;
  if (m[1]) return Number(m[1]) * Number(m[2]);
  if (m[3]) return Number(m[3]) + Number(m[4]);
  return Number(m[5]);
};
const holds = (left: string, sign: string, right: string) => {
  const [l, r] = [side(left), side(right)];
  return { '<': l < r, '>': l > r, '≤': l <= r, '≥': l >= r, '=': l === r }[sign]!;
};
const oneSign = (parts: string[], _prompt: string, right: string, wrong: string[]) => {
  expect(holds(parts[0], right, parts[2]), parts.join(' ')).toBe(true);
  for (const w of wrong) expect(holds(parts[0], w, parts[2]), `${parts.join(' ')} ${w}`).toBe(false);
};

export const PICK_CHECKS: Record<string, (parts: string[], prompt: string, right: string, wrong: string[]) => void> = {
  'chw:event': (parts, _prompt, right, wrong) => {
    expect(right, parts[0]).toBe(WORD_OF(parts[0]));
    for (const w of wrong) expect(w, parts[0]).not.toBe(right);
  },
  'chw:number': (parts, _prompt, right, wrong) => {
    if (parts[1] === 'means') {
      const number = /^A chance of (.+)$/.exec(parts[0])![1];
      expect(right, parts[0]).toBe(NUMBER_WORD[number]);
    } else {
      expect(NUMBER_WORD[right], parts[0]).toBe(parts[0].toLowerCase());
    }
    expect(wrong).not.toContain(right);
  },
  'tf6:fact': oneSign,
  'tf6:sides': oneSign,
};
