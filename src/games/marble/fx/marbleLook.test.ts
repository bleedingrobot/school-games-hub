import { describe, expect, it } from 'vitest';
import { QUALITY } from '../quality';
import { makeMarble, makeTrail, TRAIL_MIN_SPEED } from './marbleLook';

describe('makeMarble', () => {
  it('builds each kind, with a ball inside the root that can roll on its own', () => {
    for (const kind of ['player', 'rival', 'ghost'] as const) {
      const m = makeMarble(kind);
      expect(m.root.children).toContain(m.ball);
      m.dispose();
    }
  });
});

describe('makeTrail', () => {
  const run = (speed: number, trailOn: boolean) => {
    const trail = makeTrail({ ...QUALITY.normal, trail: trailOn });
    for (let i = 0; i < 20; i++) trail.push(i * 0.1, 0.3, 0, speed);
    return trail.object.visible;
  };

  it('stays hidden below the minimum speed', () => {
    expect(run(TRAIL_MIN_SPEED - 0.5, true)).toBe(false);
  });

  it('shows at speed', () => {
    expect(run(TRAIL_MIN_SPEED + 1.5, true)).toBe(true);
  });

  it('stays hidden when the quality has no trail', () => {
    expect(run(TRAIL_MIN_SPEED + 1.5, false)).toBe(false);
  });
});
