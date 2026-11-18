import { describe, expect, it } from 'vitest';
import type { RunState } from '../../../../shared/marble/engine';
import { runEvents } from './events';

const base = { x: 1, y: 2, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, falls: 0, gemsTaken: [], checkpoints: [], outcome: 'running' } as unknown as RunState;

describe('runEvents celebrations', () => {
  it('spots a new checkpoint', () => {
    const e = runEvents(base, { ...base, checkpoints: [3] });
    expect(e.map((x) => x.kind)).toEqual(['checkpoint']);
  });
  it('spots a big landing as land + bigair, a small one as land only', () => {
    const air = { ...base, grounded: false, vz: -10 };
    expect(runEvents(air, base).map((x) => x.kind)).toEqual(['land', 'bigair']);
    expect(runEvents({ ...air, vz: -3 }, base).map((x) => x.kind)).toEqual(['land']);
  });
});
