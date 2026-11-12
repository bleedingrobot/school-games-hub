// Sky Isles' rule tests (docs/ISLES-PLAN.md, section 9: tests 5 and 6). Balance and pace live in scripts/isles-sim.mjs.
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../maths/serverQuestions';
import { CHUNK_PRICE } from './config';
import { coinsCollected, collect, newIsland, playTurn, room, type Action, type Island } from './engine';
import { GULL_RIDERS, gullRiders, racerOf, raceProblem, runRace, type Racer } from './race';

describe('Sky Isles rules', () => {
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

});
