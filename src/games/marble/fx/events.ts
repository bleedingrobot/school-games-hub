/**
 * Spots the things worth a little effect when a run goes from one state to the next.
 * Pure: it only compares two RunStates (it never draws and never changes them).
 * Positions are grid units like the engine: x and y on the grid, z is the height in tiles.
 */
import { AIR_GRAVITY, DT } from '../../../../shared/marble/config';
import type { RunState } from '../../../../shared/marble/engine';

export type RunEvent =
  | { kind: 'land'; x: number; y: number; z: number; speed: number }
  | { kind: 'fall'; x: number; y: number; z: number }
  | { kind: 'gem'; id: number }
  | { kind: 'finish'; x: number; y: number; z: number }
  | { kind: 'respawn'; x: number; y: number; z: number };

/** A landing slower than this (tiles per second, downwards) is just rolling down a step: no dust. */
export const LAND_MIN_SPEED = 1;

/**
 * What happened between `prev` and `now` (one physics step, or a few).
 * A fall puts the marble back on the track in the same step, so 'fall' (where it went over)
 * and 'respawn' (where it is back) come together, and there is no 'land' for that step.
 */
export function runEvents(prev: RunState, now: RunState): RunEvent[] {
  const out: RunEvent[] = [];
  if (now.falls > prev.falls) {
    out.push({ kind: 'fall', x: prev.x, y: prev.y, z: prev.z });
    out.push({ kind: 'respawn', x: now.x, y: now.y, z: now.z });
  } else if (!prev.grounded && now.grounded) {
    // The engine zeroes vz on landing, so use the speed before it, plus the step of gravity it had just added.
    const speed = -(prev.vz - AIR_GRAVITY * DT);
    if (speed > LAND_MIN_SPEED) out.push({ kind: 'land', x: now.x, y: now.y, z: now.z, speed });
  }
  for (const id of now.gemsTaken) if (!prev.gemsTaken.includes(id)) out.push({ kind: 'gem', id });
  if (prev.outcome === 'running' && now.outcome === 'finished') out.push({ kind: 'finish', x: now.x, y: now.y, z: now.z });
  return out;
}
