import { describe, expect, it } from 'vitest';
import { WORLD_MAPS } from '../maps';
import { AREAS, BADGE_ORDER } from './areas';
import { checkWorld } from './checkWorld';

describe('the six areas, in order', () => {
  it('the whole world checks out, and each badge opens exactly the next area', () => {
    const start = { map: 'harbour-town', spot: 'start' };
    expect(checkWorld(WORLD_MAPS, start, BADGE_ORDER)).toEqual([]);
    const reachable = (badges: string[]) => {
      const problems = checkWorld(WORLD_MAPS, start, badges);
      const lost = new Set(problems.map((p) => /never get to "(.+)"/.exec(p)?.[1]).filter(Boolean));
      return Object.keys(WORLD_MAPS).filter((id) => !lost.has(id));
    };
    for (let k = 0; k <= 6; k++) {
      const got = reachable(BADGE_ORDER.slice(0, k));
      for (const a of AREAS) {
        const open = a.area <= k + 1;
        expect(got.includes(a.map), `${a.name} with ${k} badges`).toBe(open);
        expect(got.includes(a.towerTop), `${a.name} Tower top with ${k} badges`).toBe(open);
      }
    }
  });
});
