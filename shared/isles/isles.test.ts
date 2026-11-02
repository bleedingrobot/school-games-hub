// Sky Isles' rule tests (docs/ISLES-PLAN.md, section 9: tests 5 and 6). Balance and pace live in scripts/isles-sim.mjs.
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../maths/serverQuestions';
import { GUST_SPEED, MARKET_PRICE, RACE_LEGS, RACE_QUESTIONS } from './config';
import { newIsland, playTurn, type Action, type Island } from './engine';
import { GULL_RIDERS, gullRiders, RACE_STOPS, racerOf, raceProblem, raceSoFar, runRace, settleRace, starterRace, type Racer, type RaceResult } from './race';

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
    // On the way the Gull Riders are never ahead, so the starter race never looks lost.
    for (let i = 0; i < 200; i++) {
      const race = starterRace(`seed-${i}`, { boats: i % 9, swiftSails: false, happiness: 50 }, [i % 2 === 0, i % 3 === 0, i % 5 === 0]);
      race.themPath.forEach((p, point) => expect(p).toBeLessThanOrEqual(race.youPath[point]));
    }
    // The same racers in an ordinary race can lose, so the starter race really is different.
    const lost = Array.from({ length: 200 }, (_, i) => runRace(`seed-${i}`, racerOf(newIsland()), gullRiders(racerOf(newIsland())), 0));
    expect(lost.some((race) => !race.won)).toBe(true);
  });

  it('shows a race one stretch at a time, never showing what a later answer could change', () => {
    const all: boolean[][] = Array.from({ length: 2 ** RACE_QUESTIONS }, (_, m) => Array.from({ length: RACE_QUESTIONS }, (_, q) => ((m >> q) & 1) === 1));
    const steady = (race: RaceResult, side: 'you' | 'them') => race[side].total - (side === 'you' ? race.you.wind : 0);
    for (let i = 0; i < 150; i++) {
      const you: Racer = { boats: i % 15, swiftSails: i % 3 === 0, happiness: (i * 29) % 101 };
      const them: Racer = i % 2 ? gullRiders(you) : { boats: (i * 7) % 17, swiftSails: i % 4 === 0, happiness: (i * 13) % 101 };
      for (const starter of [false, true]) {
        const run = (marks: boolean[]) => (starter ? starterRace(`s-${i}`, you, marks) : runRace(`s-${i}`, you, them, marks));
        const count = new Map<number, RaceResult>();
        for (const marks of all) {
          const race = run(marks);
          // The winner and the speeds depend only on how many were right, never which ones.
          const right = marks.filter(Boolean).length;
          if (!count.has(right)) count.set(right, race);
          expect([race.won, race.you, race.them]).toEqual([count.get(right)!.won, count.get(right)!.you, count.get(right)!.them]);
          if (!starter) expect(race).toEqual({ ...runRace(`s-${i}`, you, them, right), youPath: race.youPath, themPath: race.themPath, gustLegs: race.gustLegs });
          // Each gust blows on the first leg after its question's stop, only if that question was right.
          expect(race.gustLegs).toEqual(RACE_STOPS.filter((_, q) => marks[q]));
          // The winner reaches the finish line and the boats never go backwards.
          expect(Math.max(race.youPath[RACE_LEGS], race.themPath[RACE_LEGS])).toBe(1);
          expect(race.youPath[RACE_LEGS] >= race.themPath[RACE_LEGS]).toBe(race.won);
          for (let p = 1; p <= RACE_LEGS; p++) {
            expect(race.youPath[p]).toBeGreaterThanOrEqual(race.youPath[p - 1]);
            expect(race.themPath[p]).toBeGreaterThanOrEqual(race.themPath[p - 1]);
            // The lead only changes hands towards the steadily faster boat, or with a gust you can see.
            const before = race.youPath[p - 1] - race.themPath[p - 1];
            const after = race.youPath[p] - race.themPath[p];
            if (before > 0.001 && after < -0.001) expect(steady(race, 'them')).toBeGreaterThan(steady(race, 'you'));
            if (before < -0.001 && after > 0.001) expect(race.gustLegs.includes(p - 1) || steady(race, 'you') > steady(race, 'them')).toBe(true);
          }
          // What's shown after each answer is the start of this race, whatever the later answers are.
          for (let answered = 0; answered <= RACE_QUESTIONS; answered++) {
            const shown = raceSoFar(`s-${i}`, you, them, starter, marks.slice(0, answered));
            expect(shown.youPath).toEqual(race.youPath.slice(0, shown.youPath.length));
            expect(shown.themPath).toEqual(race.themPath.slice(0, shown.themPath.length));
            expect(shown.youPath.length).toBe(RACE_STOPS[Math.min(answered, RACE_QUESTIONS - 1)] + 1);
          }
        }
      }
    }
    // A gust really moves the boat: every gust right puts it further on than none.
    const you = racerOf(newIsland());
    expect(runRace('g', you, gullRiders(you), [true, true, true]).you.total - runRace('g', you, gullRiders(you), 0).you.total).toBe(3 * GUST_SPEED);
  });
});
