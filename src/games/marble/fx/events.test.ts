import { describe, expect, it } from 'vitest';
import type { RunState } from '../../../../shared/marble/engine';
import { runEvents } from './events';

function base(over: Partial<RunState> = {}): RunState {
  return {
    x: 2.5, y: 3.5, z: 1, vx: 0, vy: 0, vz: 0, grounded: true, steps: 10, held: 0, penalty: 0, refundable: 0, bonus: 0, falls: 0,
    respawnX: 1.5, respawnY: 1.5, safeSpots: [], checkpoints: [], outcome: 'running', finishSteps: 0, padCooldown: 0,
    gateChoices: [], pitStops: [], pitsPaid: [], gemsTaken: [], ...over,
  };
}

describe('runEvents', () => {
  it('says nothing while rolling', () => {
    expect(runEvents(base(), base({ x: 2.6 }))).toEqual([]);
  });

  it('lands after a real drop', () => {
    const ev = runEvents(base({ grounded: false, vz: -5 }), base({ grounded: true, vz: 0, z: 0.5 }));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'land', x: 2.5, y: 3.5, z: 0.5 });
    expect(ev[0].kind === 'land' && ev[0].speed).toBeGreaterThan(5);
  });

  it('does not land for a tiny step down', () => {
    expect(runEvents(base({ grounded: false, vz: -0.1 }), base({ grounded: true }))).toEqual([]);
  });

  it('does not land while still in the air', () => {
    expect(runEvents(base({ grounded: false, vz: -5 }), base({ grounded: false, vz: -5.3 }))).toEqual([]);
  });

  it('falls from where it was, then comes back (no landing)', () => {
    const ev = runEvents(base({ grounded: false, vz: -12, x: 7, y: 8, z: -1 }), base({ falls: 1, x: 1.5, y: 1.5, z: 0 }));
    expect(ev).toEqual([
      { kind: 'fall', x: 7, y: 8, z: -1 },
      { kind: 'respawn', x: 1.5, y: 1.5, z: 0 },
    ]);
  });

  it('reports only new gems', () => {
    const ev = runEvents(base({ gemsTaken: [2] }), base({ gemsTaken: [2, 5] }));
    expect(ev).toEqual([{ kind: 'gem', id: 5 }]);
  });

  it('reports the finish once', () => {
    const fin = base({ outcome: 'finished' });
    expect(runEvents(base(), fin)).toEqual([{ kind: 'finish', x: 2.5, y: 3.5, z: 1 }]);
    expect(runEvents(fin, fin)).toEqual([]);
  });

  it('does not call a timeout a finish', () => {
    expect(runEvents(base(), base({ outcome: 'timeout' }))).toEqual([]);
  });
});
