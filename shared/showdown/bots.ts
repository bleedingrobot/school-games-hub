/**
 * Pretend pupils for the simulator (and later the `?pretend=30` test page): fast, steady, slow and wobbly answerers,
 * at real speeds. A "typical class" is a random mix of them, different every seed.
 */
import { rng } from './schedule';
import type { Mode, Role } from './types';

export type BotKind = 'fast' | 'steady' | 'slow' | 'wobbly';
export interface BotPupil {
  id: string;
  name: string;
  ladder: number;
  kind: BotKind;
  /** Thinking time for one question, ms (lowest, highest). */
  thinkMs: [number, number];
  /** Chance of a right answer. */
  right: number;
  role: Role;
}

export const BOT_KINDS: Record<BotKind, { thinkMs: [number, number]; right: number; share: number }> = {
  // Thinking times are 0.6x what they were first guessed: the first real class (24 Nov 2026, 19 pupils, 5 minutes) beat
  // the boss at 192 s of 300, where the first pretend pupils took about 250 s; at 0.6x they take about 210 s.
  fast: { thinkMs: [1500, 3000], right: 0.9, share: 0.25 },
  steady: { thinkMs: [3000, 5400], right: 0.8, share: 0.4 },
  slow: { thinkMs: [5400, 9600], right: 0.7, share: 0.2 },
  wobbly: { thinkMs: [2400, 5400], right: 0.55, share: 0.15 },
};

const NAMES = ['Aroha', 'Leo', 'Mia', 'Nikau', 'Ava', 'Tama', 'Isla', 'Mason', 'Ruby', 'Kai', 'Zoe', 'Hemi', 'Lily', 'Jack', 'Maia',
  'Noah', 'Ella', 'Wiremu', 'Grace', 'Oliver', 'Anika', 'Liam', 'Sienna', 'Manaia', 'Chloe', 'Ethan', 'Hana', 'Lucas', 'Amelia', 'Ari',
  'Freya', 'Tane'];

/** A typical class of `size` pretend pupils for this seed. */
export function botClass(seed: number, size: number, mode: Mode): BotPupil[] {
  const r = rng(seed ^ 0x51ed);
  const kinds = Object.entries(BOT_KINDS) as [BotKind, (typeof BOT_KINDS)[BotKind]][];
  return Array.from({ length: size }, (_, i) => {
    let roll = r();
    const [kind, k] = kinds.find(([, x]) => (roll -= x.share) < 0) ?? kinds[1];
    const role: Role = mode === 'solo' ? 'striker' : ((roll = r()) < 0.6 ? 'striker' : roll < 0.85 ? 'guard' : 'healer');
    return { id: `bot${i + 1}`, name: NAMES[i % NAMES.length], ladder: Math.floor(r() * 40), kind, thinkMs: k.thinkMs, right: k.right, role };
  });
}
