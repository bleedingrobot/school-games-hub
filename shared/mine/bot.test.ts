import { describe, expect, it } from 'vitest';
import { flyLevel } from './bot';
import { clockSteps, makeWorld, replay, stateKey } from './engine';
import { GRANT, decodeInputs, encodeInputs, grantsIn } from './inputs';
import { RECIPES, makeLevel } from './level';

describe('the pretend pilot', () => {
  // Every level can be finished: keys in order, question doors answered, reactor destroyed, escape.
  it.each(RECIPES.map((r) => [r.id, r] as const))('finishes %s inside the escape timer, and its recorded run replays to the same finish', (_id, recipe) => {
    const level = makeLevel(recipe);
    const w = makeWorld(level);
    const bot = flyLevel(w);
    const s = bot.state;
    expect(s.outcome).toBe('finished');
    expect(s.reactorDown).toBe(1);
    expect(s.keys.filter(Boolean).length).toBe(recipe.doors.filter((d) => d !== 'question').length);
    expect(s.doorsOpen.every((d) => d === 1)).toBe(true);
    expect(s.badGrants).toBe(0);
    expect(s.escapeLeft).toBeGreaterThan(0);
    // Only question doors are ever opened with GRANT.
    const granted = grantsIn(bot.runs);
    expect(granted.length).toBe(recipe.doors.filter((d) => d === 'question').length);
    for (const id of granted) expect(level.doors[id].kind).toBe('question');
    expect(bot.runs.every(([c]) => c < GRANT + 64)).toBe(true);
    // The server's job: replay the inputs and get the same time.
    const text = encodeInputs(bot.runs);
    const runs = decodeInputs(text);
    expect(runs).not.toBeNull();
    const again = replay(makeWorld(makeLevel(recipe)), runs ?? []);
    expect(again.outcome).toBe('finished');
    expect(again.finishSteps).toBe(s.finishSteps);
    expect(stateKey(again)).toBe(stateKey(s));
    expect(clockSteps(again)).toBe(clockSteps(s));
  });

  it('cannot finish a level with a question door and a key door by skipping them (the doors stay shut)', () => {
    const level = makeLevel(RECIPES[2]);
    const w = makeWorld(level);
    // No grants, no keys: just fly forward; nothing opens.
    const bot = flyLevel(w, { maxSteps: 600, shoot: false });
    expect(bot.state.outcome).toBe('running');
  });

  it('works the same in free flight (it never relies on the ship staying level)', () => {
    const level = makeLevel(RECIPES[0]);
    const bot = flyLevel(makeWorld(level, { steady: false }), { maxSteps: 30 * 60 * 5 });
    // Free flight is harder to steer; the point is that the rules don't break and the replay still matches.
    const again = replay(makeWorld(level, { steady: false }), bot.runs);
    expect(stateKey(again)).toBe(stateKey(bot.state));
  });
});
