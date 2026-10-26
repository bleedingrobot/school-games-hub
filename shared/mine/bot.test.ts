import { expect, it } from 'vitest';
import { flyLevel } from './bot';
import { makeWorld, replay, stateKey } from './engine';
import { decodeInputs, encodeInputs } from './inputs';
import { RECIPES, makeLevel } from './level';

it('the pretend pilot finishes every mine, and its recorded run replays to the same finish (the server’s job)', () => {
  for (const recipe of RECIPES) {
    const bot = flyLevel(makeWorld(makeLevel(recipe)));
    expect(bot.state.outcome, recipe.id).toBe('finished');
    expect(bot.state.badGrants, recipe.id).toBe(0);
    const again = replay(makeWorld(makeLevel(recipe)), decodeInputs(encodeInputs(bot.runs)) ?? []);
    expect(again.finishSteps, recipe.id).toBe(bot.state.finishSteps);
    expect(stateKey(again), recipe.id).toBe(stateKey(bot.state));
  }
});
