// Sky Isles' rule tests (docs/ISLES-PLAN.md, section 9: tests 5 and 6). Balance and pace live in scripts/isles-sim.mjs.
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../maths/serverQuestions';
import { MARKET_PRICE } from './config';
import { newIsland, playTurn, type Action, type Island } from './engine';
import { GULL_RIDERS, gullRiders, racerOf, raceProblem, runRace, settleRace, starterRace } from './race';

const PRICES = { ...MARKET_PRICE };

/** Two turns with a race against a classmate between them, all from one seed: what the server and the preview each do. */
function play(seed: string) {
  const random = seededRandom(seed);
  const first: Action[] = [{ kind: 'build', spot: 5, plot: 'workshop' }, { kind: 'tax', level: 'low' }];
  const one = playTurn(newIsland(), true, first, PRICES, random);
  if (!one.ok) throw new Error(one.problem);
  const classmate: Island = { ...newIsland(), turn: 20, boats: 5 };
  if (raceProblem(one.island, { id: 'ana', island: classmate }, 'me')) throw new Error('race refused');
  const race = runRace(`${seed}:race`, racerOf(one.island), racerOf(classmate), 2);
  const settled = settleRace(one.island, { id: 'ana', island: classmate }, race);
  const two = playTurn(settled.challenger, false, [{ kind: 'raise', spot: 2 }], PRICES, random);
  if (!two.ok) throw new Error(two.problem);
  return { one, race, settled, two };
}

describe('Sky Isles rules', () => {
  it('rolls a turn and a race the same from the same seed and choices, so the server and the preview agree', () => {
    for (const seed of ['isles-a', 'isles-b', 'isles-c']) {
      const a = play(seed);
      expect(play(seed)).toEqual(a);
      // Nobody loses anything in a race: the classmate's island only gains.
      expect(a.settled.defender!.coins).toBeGreaterThanOrEqual(newIsland().coins);
      expect(a.settled.defender!.boats).toBe(5);
    }
    // The seed does matter (otherwise the check above proves nothing).
    const races = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(play(`isles-${i}`).race.youPath)));
    expect(races.size).toBeGreaterThan(1);
  });

  it("can't lose the starter race against the Gull Riders, on any of 1,000 seeds", () => {
    expect(raceProblem({ ...newIsland(), turn: 1 }, GULL_RIDERS, 'me')).toBeNull();
    for (let i = 0; i < 1000; i++) {
      const you = { boats: i % 7, swiftSails: i % 2 === 0, happiness: (i * 37) % 101 };
      const right = i % 4;
      const race = starterRace(`seed-${i}`, you, right);
      expect(race.won).toBe(true);
      expect(race.youPath.at(-1)).toBe(1);
      expect(race.themPath.at(-1)).toBeLessThan(1);
    }
    // The same racers in an ordinary race can lose, so the starter race really is different.
    const lost = Array.from({ length: 200 }, (_, i) => runRace(`seed-${i}`, racerOf(newIsland()), gullRiders(racerOf(newIsland())), 0));
    expect(lost.some((race) => !race.won)).toBe(true);
  });
});
