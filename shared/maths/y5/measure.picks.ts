/** Year 5 Measure card: pick questions whose right choice is a word or a time. Checked from the screen text. */
import { expect } from 'vitest';

type Check = (parts: string[], prompt: string, right: string, wrong: string[]) => void;

const kindOfDegrees = (d: number) => (d < 90 ? 'acute' : d === 90 ? 'right' : d < 180 ? 'obtuse' : d === 180 ? 'straight' : 'reflex');
const degrees = (text: string) => Number(/(\d+)°/.exec(text)![1]);

const DIRS = ['north', 'east', 'south', 'west'];
const facing = (parts: string[]) => {
  const start = DIRS.indexOf(/^You face (\w+)\.$/.exec(parts[0])![1]);
  const turn = parts[1];
  // Every turn says which way round, the half turn too (27 Nov 2026).
  expect(turn).toMatch(/^You make (a quarter turn|a half turn|3 quarter turns) (clockwise|anticlockwise)\.$/);
  const count = /3 quarter/.test(turn) ? 3 : /a quarter/.test(turn) ? 1 : 2;
  const sign = /anticlockwise/.test(turn) ? -1 : 1;
  return DIRS[(((start + sign * count) % 4) + 4) % 4];
};

const pad = (n: number) => String(n).padStart(2, '0');
const timeOf = (hour: number, minute: number) => `${hour}:${pad(minute)}`;
const wordsToMinutes = (label: string): number => {
  let m: RegExpExecArray | null;
  if ((m = /^(\d+) o'clock$/.exec(label))) return (Number(m[1]) % 12) * 60;
  if ((m = /^quarter past (\d+)$/.exec(label))) return (Number(m[1]) % 12) * 60 + 15;
  if ((m = /^half past (\d+)$/.exec(label))) return (Number(m[1]) % 12) * 60 + 30;
  if ((m = /^quarter to (\d+)$/.exec(label))) return (Number(m[1]) % 12) * 60 - 15;
  throw new Error(`not a time in words: ${label}`);
};
const mod = (n: number) => ((n % 720) + 720) % 720;

const byKind = (kindOf: (parts: string[]) => string): Check => (parts, _p, right, wrong) => {
  const kind = kindOf(parts);
  expect(right, parts.join(' ')).toBe(kind);
  for (const w of wrong) expect(w, parts.join(' ')).not.toBe(kind);
};

export const PICK_CHECKS: Record<string, Check> = {
  'ang5:size': byKind((parts) => kindOfDegrees(degrees(parts[0]))),
  'ang5:pic': byKind((parts) => kindOfDegrees(degrees(parts[0]))),
  'ang5:clue': byKind((parts) => {
    const clue = parts[0];
    if (clue === 'Less than 90°') return 'acute';
    if (clue === 'Exactly 90°') return 'right';
    if (clue === 'Between 90° and 180°') return 'obtuse';
    if (clue === 'Exactly 180°') return 'straight';
    return 'reflex';
  }),
  'comp5:quarter': byKind(facing),
  'comp5:half': byKind(facing),
  'comp5:three': byKind(facing),
  'clock5:read': (parts, _p, right, wrong) => {
    const hour = Number(/^Short hand between (\d+) and/.exec(parts[0])![1]);
    const minute = Number(/^long hand on (\d+):$/.exec(parts[1])![1]) * 5;
    expect(right).toBe(timeOf(hour, minute));
    for (const w of wrong) expect(w).not.toBe(timeOf(hour, minute));
  },
  'clock5:words': (parts, _p, right, wrong) => {
    // The short hand says the hour and the long hand says the minutes; the hour hand is read as the hour it has passed.
    const hand = parts[0];
    const hour = Number(/(\d+),$/.exec(hand.replace(/ to \d+,$/, ',').replace(/nearly at (\d+),$/, (_s, n) => `${Number(n) === 1 ? 12 : Number(n) - 1},`))![1]);
    const minute = (Number(/^long hand on (\d+):$/.exec(parts[1])![1]) * 5) % 60;
    const total = mod((hour % 12) * 60 + minute);
    expect(mod(wordsToMinutes(right)), parts.join(' ')).toBe(total);
    for (const w of wrong) expect(mod(wordsToMinutes(w)), `${parts.join(' ')} ${w}`).not.toBe(total);
  },
};
