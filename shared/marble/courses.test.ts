import { expect, it } from 'vitest';
import { botRun } from './bot';
import { doorsForSeed } from './maths';
import { COURSES } from './courses';
import { medalFor, replay } from './engine';

it('every course: the bot finishes without falling, earns gold, and a replay gives the same time', () => {
  for (const c of COURSES) {
    const openDoors = doorsForSeed(c, 'test-seed', null);
    const bot = botRun(c, { openDoors });
    expect(bot.state.outcome, c.def.id).toBe('finished');
    expect(bot.state.falls, c.def.id).toBe(0);
    expect(medalFor(c, bot.state.finishSteps), c.def.id).toBe('gold');
    expect(replay(c, bot.runs, { openDoors })?.finishSteps, c.def.id).toBe(bot.state.finishSteps);
  }
});
