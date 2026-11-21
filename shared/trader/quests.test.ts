import { describe, expect, it } from 'vitest';
import { MEDICINE, SHIPS, WATER } from './config';
import { distance, makeGalaxy } from './galaxy';
import { marketFor } from './market';
import { QUESTS, QUEST_MAX_LEG, QUEST_POINTS, nearestSellers, nextQuest, openQuestView, questLegs, questPlanets, questReward } from './quests';
import { DEFAULT_SETTINGS, applyBatch, newGame, type Action, type Game, type Reply } from './server';
import { freeHolds, setCargo, usedHolds } from './state';
import { settleCustoms } from './encounter';

const SEED = 'quest-test';
const galaxy = makeGalaxy(SEED);
const planets = questPlanets(galaxy);
const noMark = () => null;
const run = (g: Game, ...actions: Action[]): Reply => applyBatch(galaxy, SEED, g, actions, DEFAULT_SETTINGS, noMark);
const ok = (r: Reply): Game => {
  if (!r.ok) throw new Error(r.reason);
  return r.game;
};
const refused = (r: Reply): string => (r.ok ? 'not refused' : r.reason);
/** The ship parked at a planet (as if it had flown there). */
const at = (g: Game, planet: number): Game => ({ ...g, t: { ...g.t, location: planet, market: marketFor(galaxy, planet, g.t.day) } });
const fresh = (day = 10): Game => newGame(galaxy, day, DEFAULT_SETTINGS);
/** Does every step of the open quest, the last one last. */
function finish(g: Game, quest: number): Reply {
  const q = QUESTS[quest];
  let game = g;
  for (let i = 0; i < q.steps.length; i++) {
    const step = q.steps[i];
    game = at(game, planets[quest][i]);
    if (step.kind === 'buy-deliver') setCargo(game.t, step.good!, game.t.cargo[step.good!] + 20);
    const r = run(game, { type: step.kind === 'deliver' || step.kind === 'buy-deliver' ? 'quest-deliver' : 'quest-pickup', step: i });
    if (i === q.steps.length - 1) return r;
    game = ok(r);
  }
  throw new Error('no steps');
}

describe('Star Trader quests', () => {
  it('picks planets from the galaxy, opens quests in order and one a day, checks every step, keeps quest cargo safe, pays rewards, drops, and shows where to go', () => {
    // Each quest's planets come from the galaxy: the same planets for the same galaxy, the right kinds where they exist, every stop within a jump of the last, on many galaxies.
    {
      expect(questPlanets(makeGalaxy(SEED))).toEqual(planets);
      expect(QUESTS.map((q) => q.id)).toEqual(['zuzu', 'sprocket', 'nettle', 'vex', 'kai']);
      let firstChoice = 0;
      let steps = 0;
      for (let i = 0; i < 300; i++) {
        const g = makeGalaxy(`sim-${i}`);
        const all = questPlanets(g);
        QUESTS.forEach((q, qi) => {
          const set = all[qi];
          expect(set).toHaveLength(q.steps.length);
          // Stops are different planets (Dr Nettle's goods are handed over at his planet).
          const stops = q.steps.map((s, si) => (s.kind === 'buy-deliver' ? -1 : set[si])).filter((id) => id >= 0);
          expect(new Set(stops).size).toBe(stops.length);
          const legs = questLegs(g, set);
          for (const leg of legs) expect(leg).toBeLessThanOrEqual(QUEST_MAX_LEG);
          // The whole trip is a few jumps, never one huddle and never a long haul.
          expect(legs.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(QUEST_MAX_LEG * legs.length);
          q.steps.forEach((s, si) => {
            if (!s.prefer.length) return;
            steps += 1;
            if (s.prefer[0](g.planets[set[si]], g)) firstChoice += 1;
          });
        });
        // Vex's pirates wait within a jump of the garden; Dr Nettle has a Medicine market within a jump.
        const vex = all[3];
        for (const id of vex.slice(0, 3)) expect(distance(g.planets[id], g.planets[vex[3]])).toBeLessThanOrEqual(QUEST_MAX_LEG);
        const nettle = g.planets[all[2][2]];
        expect(g.planets.some((p) => p.id !== nettle.id && p.tech >= 4 && distance(p, nettle) <= QUEST_MAX_LEG)).toBe(true);
      }
      // Most steps get their first wish (a Farming co-op for the berries ...); the rest a sensible fallback.
      expect(firstChoice / steps).toBeGreaterThan(0.6);
    }

    // opens quests one at a time, in order, at most one new one a day, and an old save without quests still loads.
    {
      const g0 = fresh();
      expect(g0.quests).toBeUndefined();
      expect(nextQuest(g0.quests, 10)?.id).toBe('zuzu');
      expect(refused(run(g0, { type: 'quest-take', id: 'sprocket' }))).toMatch(/not open/);
      const taken = ok(run(g0, { type: 'quest-take', id: 'zuzu' }));
      expect(taken.quests).toEqual({ open: 'zuzu', done: [], finished: [], lastDay: null });
      expect(refused(run(taken, { type: 'quest-take', id: 'zuzu' }))).toMatch(/Finish or drop/);

      const done = finish(taken, 0);
      expect(done.ok && done.quest).toEqual({ finished: 'zuzu', reward: 300, points: QUEST_POINTS });
      const g1 = ok(done);
      expect(g1.t.credits).toBe(g0.t.credits + 300);
      expect(g1.quests).toEqual({ open: null, done: [], finished: ['zuzu'], lastDay: 10 });
      // The next one opens tomorrow.
      expect(refused(run(g1, { type: 'quest-take', id: 'sprocket' }))).toMatch(/tomorrow/);
      const tomorrow = { ...g1, t: { ...g1.t, day: 11 } };
      expect(ok(run(tomorrow, { type: 'quest-take', id: 'sprocket' })).quests?.open).toBe('sprocket');
      // A finished quest can't be taken again.
      expect(refused(run(tomorrow, { type: 'quest-take', id: 'zuzu' }))).toMatch(/not open/);
    }

    // checks each step: the right planet, the last step after the rest, Lumi's trail in order, and refuses moves the rules don't allow.
    {
      const g = ok(run(fresh(), { type: 'quest-take', id: 'zuzu' }));
      const away = at(g, planets[0][3] === planets[0][0] ? planets[0][1] : planets[0][3]);
      expect(refused(run(away, { type: 'quest-pickup', step: 0 }))).toMatch(/Fly to/);
      expect(refused(run(at(g, planets[0][3]), { type: 'quest-deliver', step: 3 }))).toMatch(/other steps first/);
      expect(refused(run(at(g, planets[0][0]), { type: 'quest-deliver', step: 0 }))).toMatch(/that way/);
      expect(refused(run(at(g, planets[0][0]), { type: 'quest-pickup', step: 9 }))).toMatch(/could not be found/);
      expect(refused(run(at(g, planets[0][0]), { type: 'quest-pickup', step: 1.5 }))).toMatch(/could not be read/);
      expect(refused(run(fresh(), { type: 'quest-pickup', step: 0 }))).toMatch(/Take a quest/);
      expect(refused(run(fresh(), { type: 'quest-drop' }))).toMatch(/no quest/);
      // Any order: the candles before the berries.
      const g2 = ok(run(at(g, planets[0][1]), { type: 'quest-pickup', step: 1 }));
      expect(g2.quests?.done).toEqual([1]);
      expect(refused(run(at(g2, planets[0][1]), { type: 'quest-pickup', step: 1 }))).toMatch(/done/);
      // A whole batch is refused if one move is: nothing is kept.
      expect(refused(run(at(g, planets[0][1]), { type: 'quest-pickup', step: 1 }, { type: 'quest-pickup', step: 0 }))).toMatch(/Fly to/);

      // Lumi's clues go in order.
      const kai: Game = { ...fresh(), quests: { open: 'kai', done: [], finished: ['zuzu', 'sprocket', 'nettle', 'vex'], lastDay: 5 } };
      expect(refused(run(at(kai, planets[4][1]), { type: 'quest-pickup', step: 1 }))).toMatch(/in order/);
      const k1 = ok(run(at(kai, planets[4][0]), { type: 'quest-pickup', step: 0 }));
      expect(ok(run(at(k1, planets[4][1]), { type: 'quest-pickup', step: 1 })).quests?.done).toEqual([0, 1]);
      // Vex's pirates are "arrive and tap" for now (Q.4 adds the fights), and the quest pays 600.
      const vex: Game = { ...fresh(), quests: { open: 'vex', done: [], finished: ['zuzu', 'sprocket', 'nettle'], lastDay: 5 } };
      const won = finish(vex, 3);
      expect(won.ok && won.quest?.reward).toBe(600);
      const kaiDone = finish(kai, 4);
      expect(kaiDone.ok && kaiDone.quest?.reward).toBe(800);
      expect(nextQuest(ok(kaiDone).quests, 99)).toBeNull();
    }

    // quest cargo is free, takes a hold each, needs room, can't be sold or taken, and goes when the quest is handed in or dropped.
    {
      const after1: Game = { ...fresh(), quests: { open: null, done: [], finished: ['zuzu'], lastDay: 5 } };
      const g = ok(run(after1, { type: 'quest-take', id: 'sprocket' }));
      const credits = g.t.credits;
      const g1 = ok(run(at(g, planets[1][0]), { type: 'quest-pickup', step: 0 }));
      expect(g1.t.credits).toBe(credits);
      expect(g1.t.questCargo).toBe(1);
      expect(usedHolds(g1.t)).toBe(1);
      expect(freeHolds(g1.t)).toBe(SHIPS[0].holds - 1);
      // Customs and pirates only see the market goods.
      expect(settleCustoms(g1.t, [0, 1, 2]).state.questCargo).toBe(1);
      // A full hold: no pick-up.
      const full = at(g1, planets[1][1]);
      setCargo(full.t, WATER, freeHolds(full.t));
      expect(refused(run(full, { type: 'quest-pickup', step: 1 }))).toMatch(/Make room/);
      // Dropping loses the steps and the quest cargo, nothing else, and it can be taken again.
      const dropped = ok(run(g1, { type: 'quest-drop' }));
      expect(dropped.quests).toEqual({ open: null, done: [], finished: ['zuzu'], lastDay: 5 });
      expect(dropped.t.questCargo).toBeUndefined();
      expect(dropped.t.credits).toBe(credits);
      expect(ok(run(dropped, { type: 'quest-take', id: 'sprocket' })).quests?.open).toBe('sprocket');
      // Handing in clears the quest cargo and pays.
      const done = ok(finish(g, 1));
      expect(done.t.questCargo).toBeUndefined();
      expect(done.t.credits).toBe(credits + 400);
    }

    // Dr Nettle wants real goods from the market, takes them out of the hold and pays his price (a smaller order on a small ship).
    {
      const base: Game = { ...fresh(), quests: { open: null, done: [], finished: ['zuzu', 'sprocket'], lastDay: 5 } };
      // A Flea has 10 holds: the smaller order.
      const small = ok(run(base, { type: 'quest-take', id: 'nettle' }));
      expect(small.quests?.small).toBe(true);
      expect(questReward(QUESTS[2], true)).toBe(3 * 100 + 7 * 15);
      const big = ok(run({ ...base, t: { ...base.t, ship: 1 } }, { type: 'quest-take', id: 'nettle' }));
      expect(big.quests?.small).toBeUndefined();
      expect(questReward(QUESTS[2])).toBe(5 * 100 + 10 * 15);

      const home = planets[2][2];
      const g = at({ ...big, t: { ...big.t, ship: 1 } }, home);
      expect(refused(run(g, { type: 'quest-deliver', step: 0 }))).toMatch(/You need 5 Medicine/);
      setCargo(g.t, MEDICINE, 6, 360);
      setCargo(g.t, WATER, 10, 50);
      const g1 = ok(run(g, { type: 'quest-deliver', step: 0 }, { type: 'quest-deliver', step: 1 }));
      expect(g1.t.cargo[MEDICINE]).toBe(1);
      expect(g1.t.cargo[WATER]).toBe(0);
      const r = run(g1, { type: 'quest-deliver', step: 2 });
      expect(r.ok && r.quest?.reward).toBe(650);
      expect(ok(r).t.credits).toBe(g.t.credits + 650);
      // The screens show where to buy: the three nearest sellers and today's price.
      const sellers = nearestSellers(galaxy, g.t, MEDICINE);
      expect(sellers.length).toBeGreaterThan(0);
      expect(sellers.every((s) => s.price > 0)).toBe(true);
    }

    // shows the open quest's steps with their planet, coordinates and fuel from the ship.
    {
      expect(openQuestView(galaxy, fresh().t, undefined)).toBeNull();
      const g = ok(run(fresh(), { type: 'quest-take', id: 'zuzu' }));
      const view = openQuestView(galaxy, g.t, g.quests)!;
      expect(view.reward).toBe(300);
      expect(view.steps.map((s) => s.planet)).toEqual(planets[0]);
      const here = galaxy.planets[g.t.location];
      for (const s of view.steps) {
        expect(s.fuel).toBe(distance(here, galaxy.planets[s.planet]));
        expect(s.coords).toMatch(/^\(.+, .+\)$/);
        expect(s.done).toBe(false);
    }
    const there = at(g, planets[0][0]);
    expect(openQuestView(galaxy, there.t, there.quests)!.steps[0]).toMatchObject({ fuel: 0, problem: null });
    }
  });
});
