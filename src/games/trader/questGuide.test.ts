import { describe, expect, it } from 'vitest';
import { makeGalaxy } from '../../../shared/trader/galaxy';
import { marketFor } from '../../../shared/trader/market';
import { questPlanets } from '../../../shared/trader/quests';
import { DEFAULT_SETTINGS, applyBatch, newGame, type Action, type Game } from '../../../shared/trader/server';
import { doableHere, waitingHere } from './questGuide';

const SEED = 'quest-test';
const galaxy = makeGalaxy(SEED);
const zuzu = questPlanets(galaxy)[0];
const at = (g: Game, planet: number): Game => ({ ...g, t: { ...g.t, location: planet, market: marketFor(galaxy, planet, g.t.day) } });
const run = (g: Game, a: Action): Game => {
  const r = applyBatch(galaxy, SEED, g, [a], DEFAULT_SETTINGS, () => null);
  if (!r.ok) throw new Error(r.reason);
  return r.game;
};
const waiting = (g: Game) => waitingHere(galaxy, g.t, g.quests, doableHere(galaxy, SEED, g, DEFAULT_SETTINGS).steps);

describe('quest stops that wait', () => {
  it("says what is still needed at the last stop, and nothing once it can be done or on other planets", () => {
    let g = run(newGame(galaxy, 10, DEFAULT_SETTINGS), { type: 'quest-take', id: 'zuzu' });
    g = run(at(g, zuzu[0]), { type: 'quest-pickup', step: 0 });
    // Landing on Grandma Zuzu's planet early: the card says who is there and what to bring.
    expect(waiting(at(g, zuzu[3]))).toEqual([{ line: 'Grandma Zuzu is here.', why: 'First get the Sparkle Candles and a Robot Band, then come back here.' }]);
    // A pick-up stop is fine in any order, so it has the landing card, not this one.
    expect(waiting(at(g, zuzu[2]))).toEqual([]);
    g = run(at(g, zuzu[2]), { type: 'quest-pickup', step: 2 });
    g = run(at(g, zuzu[1]), { type: 'quest-pickup', step: 1 });
    expect(waiting(at(g, zuzu[3]))).toEqual([]);
  });

  it('says to make room when the hold is full', () => {
    const g = run(newGame(galaxy, 10, DEFAULT_SETTINGS), { type: 'quest-take', id: 'zuzu' });
    const full = at({ ...g, t: { ...g.t, questCargo: 999 } }, zuzu[1]);
    const [w] = waiting(full);
    expect(w.line).toBe('Pick up the Sparkle Candles for Grandma Zuzu.');
    expect(w.why).toMatch(/^Make room: 1 free hold needed\. Sell something first/);
  });
});
