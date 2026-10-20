import { describe, expect, it } from 'vitest';
import { botRun } from './bot';
import { doorsForSeed } from './maths';
import { courseById } from './courses';
import { makeWorld, newRun, replay, stateKey, stepRun } from './engine';
import { inputPlayer } from './inputs';

describe('inputPlayer', () => {
  it('gives each recorded step in order, then nothing for ever', () => {
    const next = inputPlayer([[2, 2], [0, 1], [5, 1]]);
    expect([next(), next(), next(), next(), next(), next()]).toEqual([2, 2, 0, 5, 0, 0]);
  });

  it('plays a ghost to exactly the same finish as a replay', () => {
    const course = courseById('boulder-beach')!;
    const openDoors = doorsForSeed(course, 'ghost-seed', null);
    const bot = botRun(course, { openDoors });
    const want = replay(course, bot.runs, { openDoors })!;
    const w = makeWorld(course, { openDoors });
    const s = newRun(w);
    const next = inputPlayer(bot.runs);
    while (s.outcome === 'running') stepRun(w, s, next());
    expect(s.finishSteps).toBe(want.finishSteps);
    expect(stateKey(s)).toBe(stateKey(want.state));
  });
});
