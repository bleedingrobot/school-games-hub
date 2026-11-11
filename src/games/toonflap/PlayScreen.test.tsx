import { describe, expect, it } from 'vitest';
import { newRun, replayRun, stateKey } from '../../../shared/toonflap/engine';
import { buildCourse, LEVELS } from '../../../shared/toonflap/levels';
import { advance } from './PlayScreen';

describe('Toon Flap play loop', () => {
  it('records flaps (including ones made while hovering) so the server can replay the same run', () => {
    const course = buildCourse(LEVELS[0]);
    const state = newRun(course);
    const flaps: number[] = [];
    // A simple pupil: flaps when the bird is below the middle of the next opening, and taps again after every hover.
    for (let i = 0; i < 30000 && state.mode !== 'done'; i++) {
      const wall = course.walls[state.nextWall];
      const target = wall ? wall.gaps[0].y - 0.3 : 5;
      advance(course, state, state.mode === 'hover' || state.y < target, flaps);
    }
    expect(state.outcome).toBe('finished');
    expect(flaps.length).toBeGreaterThan(10);
    const replay = replayRun(course, flaps);
    expect(replay.valid).toBe(true);
    expect(stateKey(replay.state)).toBe(stateKey(state));
  });
});
