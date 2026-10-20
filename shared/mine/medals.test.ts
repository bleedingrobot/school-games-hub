import { describe, expect, it } from 'vitest';
import { flyLevel } from './bot';
import { makeWorld } from './engine';
import { RECIPES, hardRecipe, makeLevel, recipeById } from './level';
import { MEDALS, medalFor } from './medals';

describe('medals', () => {
  it('has a sensible medal set for every level, normal and hard', () => {
    for (const r of RECIPES) for (const id of [r.id, `${r.id}:hard`]) {
      const m = MEDALS[id];
      expect(m, id).toBeDefined();
      expect(m.gold).toBeLessThan(m.silver);
      expect(m.silver).toBeLessThan(m.bronze);
    }
  });

  it('gives the right medal at the edges', () => {
    expect(medalFor('l1', 95 * 30)).toBe('gold');
    expect(medalFor('l1', 95 * 30 + 1)).toBe('silver');
    expect(medalFor('l1', 200 * 30)).toBe('bronze');
    expect(medalFor('l1', 200 * 30 + 1)).toBeNull();
    expect(medalFor('nope', 1)).toBeNull();
  });

  it('hard mode is the same mine with more to fight', () => {
    for (const r of RECIPES) {
      const hard = recipeById(`${r.id}:hard`);
      expect(hard).toEqual(hardRecipe(r));
      const a = makeLevel(r);
      const b = makeLevel(hardRecipe(r));
      expect(b.start).toBe(a.start);
      expect(b.reactorRoom).toBe(a.reactorRoom);
      expect(b.keys).toEqual(a.keys);
      expect(b.robots.length).toBeGreaterThan(a.robots.length);
      expect(b.escapeSteps).toBeLessThan(a.escapeSteps);
    }
    expect(recipeById('l1:hard:hard')).toBeUndefined();
    expect(recipeById('l9:hard')).toBeUndefined();
  });

  // The pretend pilot never dodges, so it should win at least bronze on every mine, and gold on the two gentle ones.
  it.each(RECIPES.flatMap((r) => [[r.id, r], [`${r.id}:hard`, hardRecipe(r)]] as const))('the pilot wins a medal on %s', (id, recipe) => {
    const bot = flyLevel(makeWorld(makeLevel(recipe)));
    expect(bot.state.outcome).toBe('finished');
    expect(medalFor(id, bot.state.finishSteps)).not.toBeNull();
    if (id === 'l1' || id === 'l2') expect(medalFor(id, bot.state.finishSteps)).toBe('gold');
  });
});
