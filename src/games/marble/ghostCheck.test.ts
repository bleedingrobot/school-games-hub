import { expect, it } from 'vitest';
import { botRun } from '../../../shared/marble/bot';
import { courseById } from '../../../shared/marble/courses';
import { encodeInputs } from '../../../shared/marble/inputs';
import { checkGhost } from './ghostCheck';

it('keeps a ghost that still finishes (with its time now) and drops one that no longer does', () => {
  const course = courseById('wide-hill')!;
  const openDoors = course.gates.map((g) => g.tunnels[0].door);
  const bot = botRun(course, { openDoors });
  const ghost = { name: 'Ari', steps: 99999, inputs: encodeInputs(bot.runs), doors: openDoors, gems: [] };
  expect(checkGhost(course, 'up', ghost)?.steps).toBe(bot.state.finishSteps);
  expect(checkGhost(course, 'up', { ...ghost, inputs: '3x60' })).toBeNull();
  expect(checkGhost(course, 'up', null)).toBeNull();
});
