import { expect, it } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld, replay, stateKey } from '../../../shared/mine/engine';
import { RECIPES } from '../../../shared/mine/level';
import { MineSession } from './session';

it('a session plays and records exactly what the rules would replay (so a saved run is honest)', () => {
  const recipe = RECIPES[1];
  const bot = flyLevel(makeWorld(new MineSession(recipe, { steady: true }).world.level, { steady: true }));
  const session = new MineSession(recipe, { steady: true });
  for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) session.step(code);
  expect(session.state.outcome).toBe('finished');
  expect(session.runs).toEqual(bot.runs);
  expect(stateKey(session.state)).toBe(stateKey(replay(session.world, session.runs)));
  expect(session.clock).toBe(session.state.finishSteps);
});
