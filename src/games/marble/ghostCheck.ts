/**
 * A ghost is a recorded run played back through today's physics. When a course or the physics changes (18 Nov 2026: the
 * courses were made easier), an old recording no longer follows the track, so it is checked first: if it doesn't finish,
 * it is left out; if it does, its time is the time it takes now (a fall costs less than it used to).
 */
import type { Course } from '../../../shared/marble/course';
import { replay, type ClockMode } from '../../../shared/marble/engine';
import { decodeInputs } from '../../../shared/marble/inputs';
import type { Ghost } from '../../data/marble';

export function checkGhost(course: Course, mode: ClockMode, ghost: Ghost | null): Ghost | null {
  if (!ghost) return null;
  try {
    const runs = decodeInputs(ghost.inputs);
    const r = runs && replay(course, runs, { mode, openDoors: ghost.doors, rightGems: ghost.gems });
    if (!r || r.outcome !== 'finished') return null;
    return { ...ghost, steps: r.finishSteps };
  } catch {
    return null;
  }
}
