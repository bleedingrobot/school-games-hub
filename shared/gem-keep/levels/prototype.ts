/**
 * The one hard-coded level for the Phase 1 prototype. Phase 4 replaces it with the
 * 10-level campaign in JSON.
 */
import type { LevelData } from '../level';

export const PROTOTYPE_LEVEL: LevelData = {
  id: 'prototype',
  name: 'Crystal Valley',
  map: [
    '................',
    '......^.........',
    '................',
    '..............~~',
    '....^.........~~',
    '................',
    '................',
    '................',
    '.^..........^...',
    '~~..............',
  ],
  paths: [
    [[-1, 2], [3, 2], [3, 7], [8, 7], [8, 2], [12, 2], [12, 6], [14, 6]],
  ],
  // Level 1 should be super easy and fun (James, 16 Oct 2026): anyone who uses the Mana
  // Well and builds a few towers wins, even getting most questions wrong. Skipping the
  // maths altogether doesn't win comfortably.
  startMana: 140,
  waves: [
    { groups: [{ kind: 'walker', count: 5, gap: 1.6 }] },
    { groups: [{ kind: 'walker', count: 8, gap: 1.3 }] },
    { groups: [{ kind: 'walker', count: 6, gap: 1.2 }, { kind: 'runner', count: 3, gap: 1.5, delay: 4 }] },
    { groups: [{ kind: 'runner', count: 8, gap: 0.9 }] },
    { groups: [{ kind: 'boss', count: 1, gap: 0 }, { kind: 'walker', count: 5, gap: 1.2, delay: 3 }] },
    { groups: [{ kind: 'swarm', count: 15, gap: 0.4 }] },
    { groups: [{ kind: 'walker', count: 10, gap: 0.9 }, { kind: 'brute', count: 1, gap: 0, delay: 5 }] },
    { groups: [{ kind: 'brute', count: 2, gap: 4 }, { kind: 'runner', count: 8, gap: 0.7, delay: 3 }, { kind: 'walker', count: 8, gap: 0.8, delay: 6 }] },
  ],
};
