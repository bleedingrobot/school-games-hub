import { describe, expect, it } from 'vitest';
import { FOOD, LOLLIES, MEDICINE, SHIPS, WATER } from './config';
import { chartPoint, distance, makeGalaxy } from './galaxy';
import { isBanned, marketFor } from './market';
import { FIRST_SET, JOB_MIN_LEG, NAVY_LASER, QUESTS, allQuestsDone, sharesPlanet, makeJobs, withJobs, QUEST_MAX_LEG, QUEST_POINTS, nearestSellers, nextQuest, openQuestView, questLegs, questPlanets, questReward, trailClue } from './quests';
import { DEFAULT_SETTINGS, applyBatch, applyFight, newGame, type Action, type Game, type Reply } from './server';

import { freeHolds, setCargo, usedHolds } from './state';
import { settleCustoms } from './encounter';
import { doableHere, waitingHere } from '../../src/games/trader/questGuide';

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
/** Fights Commander Vex's pirate (already started) with full laser shots until it is over. */
function fightOut(g: Game): Reply {
  let r: Reply = { ok: true, game: g, answers: [] };
  for (let i = 0; i < 20 && r.ok && r.game.pending?.kind === 'fight'; i++) r = applyFight(r.game, 'charge', undefined, { ...DEFAULT_SETTINGS, maths: false }, noMark);
  return r;
}
/** Does every step of the open quest, the last one last. */
function finish(g: Game, quest: number): Reply {
  const q = QUESTS[quest];
  let game = g;
  for (let i = 0; i < q.steps.length; i++) {
    const step = q.steps[i];
    game = at(game, planets[quest][i]);
    if (step.kind === 'buy-deliver') setCargo(game.t, step.good!, game.t.cargo[step.good!] + 20);
    if (step.kind === 'pirate') {
      // Vex's pirates are fought, not tapped: a full hull each time (as if mended at a shipyard), until it is won.
      for (let tries = 0; !game.quests?.done.includes(i); tries++) {
        if (tries > 10) throw new Error('could not beat the pirate');
        game = ok(fightOut(ok(run({ ...game, t: { ...game.t, hull: SHIPS[game.t.ship].hull } }, { type: 'quest-fight', step: i }))));
      }
      continue;
    }
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
      expect(QUESTS.map((q) => q.id)).toEqual(['zuzu', 'sprocket', 'nettle', 'vex', 'kai', 'puddle', 'gorbo', 'zip', 'pippop', 'sable']);
      expect(FIRST_SET).toEqual(QUESTS.slice(0, 5).map((q) => q.id));
      // Quests 6 to 10 never move the first five's planets (taken on main before they were added, 22 Nov 2026).
      expect(planets.slice(0, 5)).toEqual([[16, 13, 15, 0], [14, 2, 22, 4, 3], [9, 9, 9], [15, 16, 5, 0], [7, 10, 20, 6]]);
      let firstFive = 0;
      let firstChoice = 0;
      let steps = 0;
      for (let i = 0; i < 300; i++) {
        const g = makeGalaxy(`sim-${i}`);
        const all = questPlanets(g);
        for (const id of all.slice(0, 5).flat()) firstFive = (firstFive * 31 + id + 1) % 1_000_000_007;
        // Mayor Puddle: three dry planets within a jump of each other, and he waits at the last. Chef Gorbo's planet allows
        // Lollies. The Comet Cup: legs of 2 to 5 fuel, 13 at most in all (the smallest tank). Sable's chest is at Rust-Beard's.
        const [puddle, gorbo, zip, , sable] = all.slice(5);
        for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) expect(distance(g.planets[puddle[a]], g.planets[puddle[b]])).toBeLessThanOrEqual(QUEST_MAX_LEG);
        expect(puddle[3]).toBe(puddle[2]);
        expect(isBanned(g.planets[gorbo[4]], LOLLIES)).toBe(false);
        const race = questLegs(g, zip);
        expect(race).toHaveLength(2);
        for (const leg of race) expect(leg >= 2 && leg <= 5).toBe(true);
        expect(race.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(13);
        expect(sable[4]).toBe(sable[3]);
        QUESTS.forEach((q, qi) => {
          const set = all[qi];
          expect(set).toHaveLength(q.steps.length);
          // Stops are different planets (Dr Nettle's goods are handed over at his planet, Mayor Puddle waits at a dry planet).
          const stops = q.steps.map((s, si) => (sharesPlanet(s) ? -1 : set[si])).filter((id) => id >= 0);
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
      expect(firstFive).toBe(477336869);
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

      // A teacher's game opens every quest, in any order, any day (but still not a finished one).
      const teacher = (g: Game, id: string): Reply => applyBatch(galaxy, SEED, g, [{ type: 'quest-take', id }], { ...DEFAULT_SETTINGS, allQuests: true }, noMark);
      expect(ok(teacher(g0, 'sprocket')).quests?.open).toBe('sprocket');
      expect(ok(teacher(g1, 'kai')).quests?.open).toBe('kai');
      expect(refused(teacher(g1, 'zuzu'))).toMatch(/already finished/);
      expect(nextQuest(g1.quests, 10, 'kai')?.id).toBe('kai');
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
      // Lumi's clue (Q.4) is a move on the real map from where the ship is: across and up, as on the star chart.
      const clue = trailClue(galaxy, planets[4][0], planets[4][1]);
      const [a, b] = [chartPoint(galaxy.planets[planets[4][0]]), chartPoint(galaxy.planets[planets[4][1]])];
      expect([clue.dx, clue.dy]).toEqual([b.x - a.x, b.y - a.y]);
      expect(clue.text).toMatch(/^From here, go \d+ (right|left)( and \d+ (up|down))?\.$|^From here, go \d+ (up|down)\.$/);
      expect(trailClue(galaxy, 3, 3).text).toBe('Lumi is right here!');

      // Commander Vex's pirates (Q.4) are fights, not taps. Arriving starts one: a Scrappy pirate or a Raider, never a
      // Captain, with Vex's Navy laser lent (even a Flea with no lasers can fight).
      const vex: Game = { ...fresh(), quests: { open: 'vex', done: [], finished: ['zuzu', 'sprocket', 'nettle'], lastDay: 5 } };
      expect(refused(run(at(vex, planets[3][0]), { type: 'quest-pickup', step: 0 }))).toMatch(/Chase off the pirate/);
      const near = galaxy.planets.find((p) => p.id !== planets[3][0] && distance(p, galaxy.planets[planets[3][0]]) <= 5)!;
      const arrived = run(at(vex, near.id), { type: 'jump', dest: planets[3][0] });
      expect(arrived.ok && arrived.encounter).toEqual({ kind: 'pirates', tier: 0 });
      const fight = ok(arrived).pending;
      expect(fight?.kind === 'fight' && [fight.quest, fight.fight.lent, fight.fight.gentle]).toEqual([0, NAVY_LASER.power, true]);
      expect(vex.t.weapons).toEqual([]);
      for (const step of [0, 1, 2]) {
        const f = ok(run(at(vex, planets[3][step]), { type: 'quest-fight', step })).pending;
        expect(f?.kind === 'fight' && f.tier).toBe(step === 2 ? 1 : 0);
      }
      expect(refused(run(at(vex, planets[3][3]), { type: 'quest-fight', step: 3 }))).toMatch(/no pirate ship/);
      expect(refused(run(at(vex, near.id === planets[3][1] ? planets[3][2] : near.id), { type: 'quest-fight', step: 1 }))).toMatch(/Fly to/);
      // A gentle loss: nothing taken, the ship knocked about (never wrecked), the step not ticked, and the pirate still there.
      const weak = at(vex, planets[3][2]);
      setCargo(weak.t, WATER, 5, 50);
      const lost = fightOut(ok(run({ ...weak, t: { ...weak.t, hull: 1 } }, { type: 'quest-fight', step: 2 })));
      expect(lost.ok && lost.fight?.fight.outcome).toBe('knocked');
      expect(ok(lost).t.cargo[WATER]).toBe(5);
      expect(ok(lost).t.credits).toBe(weak.t.credits);
      expect(ok(lost).t.hull).toBeGreaterThanOrEqual(1);
      expect(ok(lost).quests?.done).toEqual([]);
      // Fleeing doesn't count either; a win ticks the step (the server decides), and it can try again straight away.
      const fled = applyFight(ok(run(at(vex, planets[3][0]), { type: 'quest-fight', step: 0 })), 'flee', undefined, DEFAULT_SETTINGS, noMark);
      expect(ok(fled).quests?.done).toEqual([]);
      const won = finish(vex, 3);
      expect(won.ok && won.quest?.reward).toBe(600);
      const kaiDone = finish(kai, 4);
      expect(kaiDone.ok && kaiDone.quest?.reward).toBe(800);
      expect(nextQuest(ok(kaiDone).quests, 99)?.id).toBe('puddle');
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
    // A stop that has to wait says why: the last stop too early says what to bring; a full hold says make room.
    const waiting = (w: Game) => waitingHere(galaxy, w.t, w.quests, doableHere(galaxy, SEED, w, DEFAULT_SETTINGS).steps);
    const berries = ok(run(there, { type: 'quest-pickup', step: 0 }));
    expect(waiting(at(berries, planets[0][3]))).toEqual([{ line: 'Grandma Zuzu is here.', why: 'First get the Sparkle Candles and a Robot Band, then come back here.' }]);
    expect(waiting(at(berries, planets[0][2]))).toEqual([]);
    expect(waiting(at({ ...berries, t: { ...berries.t, questCargo: 999 } }, planets[0][1]))[0].why).toMatch(/^Make room: 1 free hold needed\. Sell something first/);
    // Dr Nettle: his planet says what to buy and where (said once); other markets say buy here, or keep what's in the hold.
    const nettle: Game = { ...fresh(), quests: { open: 'nettle', done: [], finished: ['zuzu', 'sprocket'], lastDay: 9 } };
    const doc = planets[2][2];
    const atDoc = waiting(at(nettle, doc));
    expect(atDoc).toHaveLength(1);
    expect(atDoc[0].why).toMatch(/^First get 5 Medicine and 10 Water, then come back here\. The nearest Medicine is on .+ \(\d+ fuel\)\./);
    const market = galaxy.planets.find((p) => p.id !== doc && p.tech >= 5)!.id;
    expect(waiting(at(nettle, market))).toEqual([expect.objectContaining({ line: 'Dr Nettle needs these.', shop: true, why: expect.stringMatching(/^Buy 5 Medicine \(\d+ cr each\) and 10 Water .* here\. Then take them to /) })]);
    const water = at(nettle, market);
    setCargo(water.t, WATER, 10);
    expect(waiting(water)[0].why).toMatch(/Keep your 10 Water: don't sell them\./);
    const waterAtDoc = at(nettle, doc);
    setCargo(waterAtDoc.t, WATER, 10);
    expect(waiting(waterAtDoc)[0].why).toMatch(/^First get 5 Medicine, then/);
    // Lumi's family planet stays secret until the trail gets there (Bolt Off shows it, with the right words).
    const kai: Game = at({ ...fresh(), quests: { open: 'kai', done: [], finished: [], lastDay: 9 } }, planets[4][3]);
    expect(waitingHere(galaxy, kai.t, kai.quests, [], [])).toEqual([]);
    expect(waitingHere(galaxy, kai.t, kai.quests, [], 'all')).toEqual([{ line: "Lumi's family is here.", why: "First follow Lumi's trail, then come back here." }]);
    // Vex's garden before the pirates.
    const vex: Game = at({ ...fresh(), quests: { open: 'vex', done: [], finished: [], lastDay: 9 } }, planets[3][3]);
    expect(waiting(vex)).toEqual([{ line: 'Commander Vex is here.', why: 'First chase off 3 more pirate ships, then come back here.' }]);
    }

    // Q.6 daily jobs: none until all five quests are done this season; then one or two a day from the pupil's seed, the same on a
    // reload, short trips, a crate per hold; take, pick up, deliver for a little more than a trade, no hub points; gone at day's end.
    {
      const pupil = `${SEED}:pupil-1`;
      const some = fresh();
      expect(withJobs(galaxy, some, pupil)).toBe(some);
      const four = { ...some, quests: { open: null, done: [], finished: ['zuzu', 'sprocket', 'nettle', 'vex'], lastDay: 9 } };
      expect(withJobs(galaxy, four, pupil)).toBe(four);
      // Jobs are made on most galaxies and days, and always fit the rules.
      let made = 0;
      for (let k = 0; k < 40; k++) {
        const gx = makeGalaxy(`jobs-${k}`);
        const t = newGame(gx, 10 + k, DEFAULT_SETTINGS).t;
        const jobs = makeJobs(gx, `jobs-${k}:p`, t.day, t);
        expect(makeJobs(gx, `jobs-${k}:p`, t.day, t)).toEqual(jobs);
        if (jobs.length) made++;
        expect(jobs.length).toBeLessThanOrEqual(2);
        for (const j of jobs) {
          const tank = SHIPS[t.ship].fuelTank;
          expect(distance(gx.planets[t.location], gx.planets[j.from])).toBeLessThanOrEqual(tank);
          const leg = distance(gx.planets[j.from], gx.planets[j.to]);
          expect(leg).toBeGreaterThanOrEqual(JOB_MIN_LEG);
          expect(leg).toBeLessThanOrEqual(2 * tank);
          expect(j.qty).toBeGreaterThanOrEqual(1);
          expect(j.qty).toBeLessThanOrEqual(SHIPS[t.ship].holds);
          const profit = marketFor(gx, j.to, t.day)[j.good].sell - marketFor(gx, j.from, t.day)[j.good].buy;
          expect(j.pay).toBeGreaterThan(j.qty * profit);
          expect(j.pay).toBeLessThanOrEqual(j.qty * profit + 50);
        }
      }
      expect(made).toBeGreaterThanOrEqual(36);

      const all: Game = { ...some, quests: { open: null, done: [], finished: QUESTS.map((q) => q.id), lastDay: 9 } };
      const day = withJobs(galaxy, all, pupil);
      const list = day.quests!.jobs!.list;
      expect(list.length).toBeGreaterThan(0);
      expect(withJobs(galaxy, day, pupil)).toBe(day);
      expect(withJobs(galaxy, all, pupil).quests!.jobs).toEqual(day.quests!.jobs);
      expect(refused(run(day, { type: 'quest-take', id: 'job-7' }))).toMatch(/could not be found/);
      const taken = ok(run(day, { type: 'quest-take', id: 'job-0' }));
      expect(refused(run(taken, { type: 'quest-take', id: 'job-1' }))).toMatch(/job you have first/);
      const job = list[0];
      const view = openQuestView(galaxy, taken.t, taken.quests)!;
      expect(view.steps.map((s) => s.planet)).toEqual([job.from, job.to]);
      expect(view.reward).toBe(job.pay);
      // The crates need a hold each.
      const full = structuredClone(at(taken, job.from));
      setCargo(full.t, WATER, freeHolds(full.t) - job.qty + 1);
      expect(refused(run(full, { type: 'quest-pickup', step: 0 }))).toMatch(/Make room: \d+ free hold/);
      const got = ok(run(at(taken, job.from), { type: 'quest-pickup', step: 0 }));
      expect(got.t.questCargo).toBe(job.qty);
      expect(refused(run(got, { type: 'quest-deliver', step: 1 }))).toMatch(/Fly to/);
      const r = run(at(got, job.to), { type: 'quest-deliver', step: 1 });
      expect(r.ok && r.job).toEqual({ done: 0, reward: job.pay });
      expect(r.ok && r.quest).toBeUndefined();
      const paid = ok(r);
      expect(paid.t.credits).toBe(got.t.credits + job.pay);
      expect(paid.t.questCargo).toBeUndefined();
      expect(paid.quests).toMatchObject({ open: null, finished: QUESTS.map((q) => q.id), jobs: { done: [0] } });
      expect(refused(run(paid, { type: 'quest-take', id: 'job-0' }))).toMatch(/job is done/);
      // An undone job goes at the end of the day, crates and all; the next day has new jobs.
      const half = ok(run(at(day, job.from), { type: 'quest-take', id: 'job-0' }, { type: 'quest-pickup', step: 0 }));
      const next = withJobs(galaxy, { ...half, t: { ...half.t, day: half.t.day + 1 } }, pupil);
      expect(next.quests).toMatchObject({ open: null, jobs: { day: half.t.day + 1, done: [] } });
      expect(next.t.questCargo).toBeUndefined();
      expect(usedHolds(next.t)).toBe(0);
    }
    // Quests 6 to 10 (trader-quests-2 R.1): they open after the first five, one a day, in order, while today's jobs carry on.
    {
      const five: Game = { ...fresh(), quests: { open: null, done: [], finished: [...FIRST_SET], lastDay: 9 } };
      expect(allQuestsDone(five.quests)).toBe(true);
      expect(withJobs(galaxy, five, `${SEED}:p`).quests?.jobs?.list.length).toBeGreaterThan(0);
      expect(nextQuest(five.quests, 10)?.id).toBe('puddle');
      expect(nextQuest({ ...five.quests!, lastDay: 10 }, 10)).toBeNull();
      expect(refused(run(five, { type: 'quest-take', id: 'gorbo' }))).toMatch(/not open/);
      const order = QUESTS.slice(5).map((q, k) => nextQuest({ ...five.quests!, finished: [...FIRST_SET, ...QUESTS.slice(5, 5 + k).map((c) => c.id)] }, 10)?.id);
      expect(order).toEqual(['puddle', 'gorbo', 'zip', 'pippop', 'sable']);
      const after = (...more: string[]): Game => ({ ...fresh(), quests: { open: null, done: [], finished: [...FIRST_SET, ...more], lastDay: 9 } });
      const take = (g: Game, id: string): Game => ok(run(g, { type: 'quest-take', id }));

      // Mayor Puddle: 4 Water handed over at each dry planet (3 on a small ship), then he pays a set 900 at the last.
      const pud = take(after(), 'puddle');
      expect(pud.quests?.small).toBe(true);
      const big = take({ ...after(), t: { ...after().t, ship: 1 } }, 'puddle');
      expect(big.quests?.small).toBeUndefined();
      expect(questReward(QUESTS[5], true)).toBe(900);
      const dry = at(big, planets[5][0]);
      setCargo(dry.t, WATER, 12, 60);
      expect(refused(run(at(dry, planets[5][1]), { type: 'quest-deliver', step: 0 }))).toMatch(/Fly to/);
      const d1 = ok(run(dry, { type: 'quest-deliver', step: 0 }));
      expect(d1.t.cargo[WATER]).toBe(8);
      expect(refused(run(at(d1, planets[5][2]), { type: 'quest-deliver', step: 3 }))).toMatch(/other steps first/);
      const pr = finish(big, 5);
      expect(pr.ok && pr.quest).toEqual({ finished: 'puddle', reward: 900, points: QUEST_POINTS });

      // Chef Gorbo: two pick-ups (quest cargo) and real Food and Lollies; 400 plus 120 a Food and 60 a Lolly.
      expect(questReward(QUESTS[6])).toBe(400 + 5 * 120 + 3 * 60);
      expect(questReward(QUESTS[6], true)).toBe(400 + 4 * 120 + 2 * 60);
      const gor = take({ ...after('puddle'), t: { ...after().t, ship: 1 } }, 'gorbo');
      const gr = finish(gor, 6);
      expect(gr.ok && gr.quest?.reward).toBe(1180);
      expect(ok(gr).t.cargo[FOOD]).toBe(15);
      expect(ok(gr).t.cargo[LOLLIES]).toBe(17);
      expect(ok(gr).t.questCargo).toBeUndefined();

      // The Comet Cup: in order, from a start line ticked only with a full tank. Fuel bought after it goes back to the start.
      const zip = take(after('puddle', 'gorbo'), 'zip');
      const start = at(zip, planets[7][0]);
      expect(refused(run(at(zip, planets[7][1]), { type: 'quest-pickup', step: 1 }))).toMatch(/in order/);
      expect(refused(run({ ...start, t: { ...start.t, fuel: 3 } }, { type: 'quest-pickup', step: 0 }))).toMatch(/Fill your tank to the top first \(3 of 20\)/);
      const z0 = ok(run(start, { type: 'quest-pickup', step: 0 }));
      expect(z0.quests).toMatchObject({ done: [0], fuelAtStart: SHIPS[0].fuelTank });
      const z1 = ok(run(z0, { type: 'jump', dest: planets[7][1] }));
      expect(z1.t.fuel).toBe(SHIPS[0].fuelTank - questLegs(galaxy, planets[7]).at(0)!);
      const z2 = ok(run({ ...z1, pending: null }, { type: 'quest-pickup', step: 1 }));
      expect(z2.quests?.done).toEqual([0, 1]);
      const refuelled = run(z2, { type: 'refuel', units: 2 });
      expect(refuelled.ok && refuelled.raceReset).toBe(true);
      expect(ok(refuelled).quests).toMatchObject({ open: 'zip', done: [] });
      expect(ok(refuelled).quests?.fuelAtStart).toBeUndefined();
      expect(ok(run(z0, { type: 'quest-drop' })).quests?.fuelAtStart).toBeUndefined();
      const zr = finish(zip, 7);
      expect(zr.ok && zr.quest?.reward).toBe(1100);

      // Pip and Pop: three pets, and a Raider (never a Captain) with Wiggles; a gentle fight with the Navy laser lent.
      const pip = take(after('puddle', 'gorbo', 'zip'), 'pippop');
      const pf = ok(run(at(pip, planets[8][3]), { type: 'quest-fight', step: 3 })).pending;
      expect(pf?.kind === 'fight' && [pf.tier, pf.fight.lent, pf.fight.gentle]).toEqual([1, NAVY_LASER.power, true]);
      const ppr = finish(pip, 8);
      expect(ppr.ok && ppr.quest?.reward).toBe(1200);

      // Captain Sable: three map marks in order, then Rust-Beard (a Captain) at the treasure planet, who stays till beaten.
      const sab = take({ ...after('puddle', 'gorbo', 'zip', 'pippop'), t: { ...fresh().t, ship: 1, hull: SHIPS[1].hull } }, 'sable');
      expect(refused(run(at(sab, planets[9][3]), { type: 'quest-fight', step: 3 }))).toMatch(/in order/);
      expect(trailClue(galaxy, planets[9][2], planets[9][3]).text).toMatch(/^From here, go /);
      const marks = ok(run(at(ok(run(at(ok(run(at(sab, planets[9][0]), { type: 'quest-pickup', step: 0 })), planets[9][1]), { type: 'quest-pickup', step: 1 })), planets[9][2]), { type: 'quest-pickup', step: 2 }));
      const near = galaxy.planets.find((p) => p.id !== planets[9][3] && distance(p, galaxy.planets[planets[9][3]]) <= 8)!;
      const boss = run(at(marks, near.id), { type: 'jump', dest: planets[9][3] });
      expect(boss.ok && boss.encounter).toEqual({ kind: 'pirates', tier: 2 });
      const lost = fightOut(ok(run({ ...at(marks, planets[9][3]), t: { ...at(marks, planets[9][3]).t, hull: 1 } }, { type: 'quest-fight', step: 3 })));
      expect(lost.ok && lost.fight?.fight.outcome).toBe('knocked');
      expect(ok(lost).quests?.done).toEqual([0, 1, 2]);
      expect(refused(run(ok(lost), { type: 'quest-deliver', step: 4 }))).toMatch(/other steps first/);
      const sr = finish(sab, 9);
      expect(sr.ok && sr.quest?.reward).toBe(1500);
      expect(nextQuest(ok(sr).quests, 99)).toBeNull();
      // Jobs still come with all ten done.
      expect(allQuestsDone(ok(sr).quests)).toBe(true);
    }
  });
});
