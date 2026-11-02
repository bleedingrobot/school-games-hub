// Sky Isles' rule tests (docs/ISLES-PLAN.md, section 9: tests 5 and 6). Balance and pace live in scripts/isles-sim.mjs.
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../maths/serverQuestions';
import { BREEZE_SPEED, CHUNK_PRICE, GUST_SPEED, RACE_LEGS, RACE_QUESTIONS } from './config';
import { coinsCollected, collect, newIsland, playTurn, room, type Action, type Island } from './engine';
import { GULL_RIDERS, gullRiders, RACE_STOPS, racerOf, raceProblem, raceSoFar, runRace, settleRace, type Racer, type RaceResult } from './race';

/** Two turns with a race against a classmate between them, all from one seed: what the server and the preview each do. */
function play(seed: string) {
  const random = seededRandom(seed);
  const first: Action[] = [{ kind: 'build', spot: 5, plot: 'workshop' }, { kind: 'decorate', id: 'flowers', place: 0 }];
  const one = playTurn(newIsland(), true, first, random);
  if (!one.ok) throw new Error(one.problem);
  const classmate: Island = { ...newIsland(), turn: 20, spots: [...newIsland().spots, { kind: 'dock', level: 2 }] };
  if (raceProblem(one.island, { id: 'ana', island: classmate }, 'me')) throw new Error('race refused');
  const race = runRace(`${seed}:race`, racerOf(one.island), racerOf(classmate), 2);
  const settled = settleRace(one.island, { id: 'ana', island: classmate }, race);
  const two = playTurn(settled.challenger, false, [{ kind: 'raise', spot: 0 }], random);
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
      expect(a.settled.defender!.spots).toEqual(newIsland().spots.concat({ kind: 'dock', level: 2 }));
    }
    // The seed does matter (otherwise the check above proves nothing).
    const races = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(play(`isles-${i}`).race.youPath)));
    expect(races.size).toBeGreaterThan(1);
  });

  it('never lets a challenger win with no answers right, on any of 2,000 seeds (James, 3 Nov 2026)', () => {
    expect(raceProblem({ ...newIsland(), turn: 1 }, GULL_RIDERS, 'me')).toBeNull();
    let wins = 0;
    for (let i = 0; i < 2000; i++) {
      const you: Racer = { boats: i % 15, swiftSails: i % 2 === 0, breeze: i % 3 === 0 };
      const them: Racer = i % 3 ? gullRiders(you) : { boats: (i * 7) % 4, swiftSails: false, breeze: false };
      expect(runRace(`seed-${i}`, you, them, 0).won).toBe(false);
      if (runRace(`seed-${i}`, you, gullRiders(you), 1).won) wins++;
    }
    // One right answer still wins a fair share, so the answers really do decide it.
    expect(wins).toBeGreaterThan(200);
  });

  it('shows a race one stretch at a time, never showing what a later answer could change', () => {
    const all: boolean[][] = Array.from({ length: 2 ** RACE_QUESTIONS }, (_, m) => Array.from({ length: RACE_QUESTIONS }, (_, q) => ((m >> q) & 1) === 1));
    const steady = (race: RaceResult, side: 'you' | 'them') => race[side].total - (side === 'you' ? race.you.wind : 0);
    for (let i = 0; i < 150; i++) {
      const you: Racer = { boats: i % 15, swiftSails: i % 3 === 0, breeze: i % 5 === 0 };
      const them: Racer = i % 2 ? gullRiders(you) : { boats: (i * 7) % 17, swiftSails: i % 4 === 0, breeze: i % 7 === 0 };
      {
        const run = (marks: boolean[]) => runRace(`s-${i}`, you, them, marks);
        const count = new Map<number, RaceResult>();
        for (const marks of all) {
          const race = run(marks);
          // The winner and the speeds depend only on how many were right, never which ones.
          const right = marks.filter(Boolean).length;
          if (!count.has(right)) count.set(right, race);
          expect([race.won, race.you, race.them]).toEqual([count.get(right)!.won, count.get(right)!.you, count.get(right)!.them]);
          expect(race).toEqual({ ...runRace(`s-${i}`, you, them, right), youPath: race.youPath, themPath: race.themPath, gustLegs: race.gustLegs });
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
            const shown = raceSoFar(`s-${i}`, you, them, marks.slice(0, answered));
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

  it('is cosy: nothing is ever lost at the end of a turn, and the choices are checked', () => {
    const random = seededRandom('cosy');
    let island = newIsland();
    for (let t = 0; t < 400; t++) {
      if (island.turnsLeft < 1) island = { ...island, turnsLeft: 6 };
      const result = playTurn(island, t % 2 === 0, [], random);
      if (!result.ok) throw new Error(result.problem);
      // Coins, crystals and islanders only ever go up when nothing is bought.
      expect(result.island.coins).toBeGreaterThanOrEqual(island.coins);
      expect(result.island.crystals).toBeGreaterThanOrEqual(island.crystals);
      expect(result.island.islanders).toBeGreaterThanOrEqual(island.islanders);
      island = result.island;
    }
    // Islanders fill the room there is and stay.
    expect(island.islanders).toBeGreaterThanOrEqual(room(island));
    // Every weather turned up, and it was all good.
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const r = playTurn(newIsland(), false, [], seededRandom(`w-${i}`));
      if (r.ok && r.report.weather) seen.add(r.report.weather);
    }
    expect([...seen].sort()).toEqual(['breeze', 'geese', 'rainbow', 'traveller']);

    // Land is the same price every time; a decoration needs a free place; a help can be had only once.
    const rich: Island = { ...newIsland(), coins: 10_000, crystals: 50, driftLeft: 3 };
    const after = (actions: Action[]) => playTurn(rich, false, actions, seededRandom('x'));
    const anchored = after([{ kind: 'anchor' }, { kind: 'anchor' }]);
    expect(anchored.ok && rich.coins + coinsCollected(collect(rich, false)) - anchored.island.coins).toBe(2 * CHUNK_PRICE);
    expect(after([{ kind: 'decorate', id: 'bench', place: 0 }, { kind: 'decorate', id: 'lantern', place: 0 }])).toMatchObject({ ok: false, problem: 'place-taken', at: 1 });
    expect(after([{ kind: 'decorate', id: 'bench', place: 4 }])).toMatchObject({ ok: false, problem: 'no-such-place' });
    expect(after([{ kind: 'decorate', id: 'flags', place: 0 }, { kind: 'decorate', id: 'flags', place: 1 }])).toMatchObject({ ok: false, problem: 'already-have' });
    expect(after([{ kind: 'decorate', id: 'bench', place: 0 }, { kind: 'decorate', id: 'bench', place: 1 }]).ok).toBe(true);
    // Level 3 needs sky crystals.
    const poor: Island = { ...rich, crystals: 5, spots: rich.spots.map((s, i) => (i === 2 ? { ...s, level: 2 } : s)) };
    expect(playTurn(poor, false, [{ kind: 'raise', spot: 2 }], seededRandom('y'))).toMatchObject({ ok: false, problem: 'not-enough-crystals' });
    // Sail flags make the boats faster; Docks bring sky-boats.
    const flagged = after([{ kind: 'decorate', id: 'flags', place: 0 }]);
    expect(flagged.ok && racerOf(flagged.island).swiftSails).toBe(true);
    expect(racerOf({ ...rich, spots: [...rich.spots, { kind: 'dock', level: 3 }] }).boats).toBe(racerOf(rich).boats + 3);
  });

  it('a warm breeze gives the next race a head start, and the race uses it up', () => {
    const breezy: Island = { ...newIsland(), turn: 3, breeze: true };
    const race = runRace('b', racerOf(breezy), gullRiders(racerOf(breezy)), 1);
    expect(race.you.breeze).toBe(BREEZE_SPEED);
    expect(race.them.breeze).toBe(0);
    expect(settleRace(breezy, null, race).challenger.breeze).toBe(false);
  });
});
