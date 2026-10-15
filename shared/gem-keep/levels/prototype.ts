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
  startMana: 200,
  waves: [
    { groups: [{ kind: 'walker', count: 8, gap: 1.2 }] },
    { groups: [{ kind: 'walker', count: 10, gap: 1 }, { kind: 'runner', count: 4, gap: 1, delay: 4 }] },
    { groups: [{ kind: 'runner', count: 12, gap: 0.6 }] },
    { groups: [{ kind: 'walker', count: 10, gap: 0.9 }, { kind: 'brute', count: 2, gap: 4, delay: 3 }] },
    { groups: [{ kind: 'boss', count: 1, gap: 0 }, { kind: 'walker', count: 8, gap: 1, delay: 2 }] },
    { groups: [{ kind: 'swarm', count: 20, gap: 0.35 }] },
    { groups: [{ kind: 'brute', count: 5, gap: 2.5 }, { kind: 'runner', count: 10, gap: 0.7, delay: 2 }] },
    { groups: [{ kind: 'walker', count: 15, gap: 0.6 }, { kind: 'swarm', count: 15, gap: 0.3, delay: 5 }] },
    { groups: [{ kind: 'brute', count: 8, gap: 1.8 }, { kind: 'runner', count: 12, gap: 0.5, delay: 4 }] },
    { groups: [{ kind: 'boss', count: 2, gap: 6 }, { kind: 'brute', count: 4, gap: 3, delay: 3 }, { kind: 'swarm', count: 20, gap: 0.3, delay: 8 }] },
  ],
};
