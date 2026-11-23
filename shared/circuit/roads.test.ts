import { expect, it } from 'vitest';
import { botRun } from './bot';
import { achievementsReached, circuitCounts, GUIDE_ROAD, roadById, roadNeeds, roadOpen, WORLDS, type RoadProgress } from './game';
import { decodeLog, encodeLog } from './inputs';
import { newRace, replay, step } from './physics';
import { bridgedRoad, cellAt, countRuns, gapRuns, parseRoad } from './road';

it('a bot finishes every road of every world on its first go, the replay agrees, worlds open at 4 of 6, and the guided go and achievements count right', () => {
  const all = WORLDS.flatMap((w) => w.roads);
  expect(WORLDS.map((w) => w.roads.length)).toEqual([6, 6, 6, 6, 6]);
  expect(new Set(all.map((r) => r.id)).size).toBe(30);
  WORLDS.forEach((world, w) => {
    world.roads.forEach((def, i) => {
      const road = parseRoad(def);
      expect(def.world, def.id).toBe(world.id);
      // World 1 teaches driving: no data gates, and recharge ports only from road 3. Data gates from world 2.
      expect(countRuns(road, '?') > 0, def.id).toBe(w > 0);
      expect(countRuns(road, '+') > 0, def.id).toBe(w > 0 || i >= 2);
      const bot = botRun(road, 'average', {}, 1);
      expect(bot.state.outcome, def.id).toBe('finished');
      expect(replay(road, decodeLog(encodeLog(bot.log))!).steps, def.id).toBe(bot.state.steps);
    });
  });
  expect(() => parseRoad({ ...all[0], rows: ['------'] })).toThrow(/row 1/);

  // Inside a world roads open in order; a world opens when 4 of the 6 roads before it are finished.
  const done = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { finishes: 1 } as RoadProgress]));
  const first = WORLDS[0].roads.map((r) => r.id);
  expect(roadNeeds(first[0])).toBeNull();
  expect(roadOpen({}, first[1])).toBe(false);
  expect(roadOpen(done(first.slice(0, 3)), 'hot-wire')).toBe(false);
  expect(roadOpen(done([first[0], first[2], first[4], first[5]]), 'hot-wire')).toBe(true);
  expect(roadOpen(done(first), 'fan-alley')).toBe(false);

  // Volt's guided go (Stage 6): road 1's gaps are bridged until the first jump; then only the bridges already reached stay.
  const guided = roadById(GUIDE_ROAD)!;
  const gap = gapRuns(guided)[0];
  expect(gap).toBeDefined();
  expect(cellAt(bridgedRoad(guided, guided.length), 3, gap.first)).toBe('-');
  let s = newRace(guided, { guide: true });
  expect(s.bridges).toBe(guided.length);
  s = step(s, { turn: 0, accel: 1, jump: true }, guided).state;
  expect(s.bridges).toBe(1);
  // The careful bot finishes the guided go, and the server's replay (with the guide) agrees exactly.
  const careful = botRun(guided, 'careful', { guide: true }, 1);
  expect(careful.state.outcome).toBe('finished');
  expect(replay(guided, decodeLog(encodeLog(careful.log))!, { guide: true }).steps).toBe(careful.state.steps);

  // Achievements: roads, clean runs, golds, worlds open, Quantum Core roads and hard finishes (as circuit_counts).
  const p = (extra: Partial<RoadProgress> = {}): RoadProgress => ({ best: 600, medal: 'bronze', clean: false, charged: false, finishes: 1, ...extra });
  const mine = { ...Object.fromEntries(first.slice(0, 4).map((id) => [id, p()])), 'power-on': p({ clean: true, medal: 'gold', hardFinishes: 1 }), 'test-road': p() };
  expect(circuitCounts(mine)).toEqual({ circuit_roads: 4, circuit_clean: 1, circuit_golds: 1, circuit_worlds_open: 2, circuit_core_roads: 0, circuit_hard: 1 });
  expect(achievementsReached(mine)).toEqual(['circuit-first-boot', 'circuit-clean-run', 'circuit-gold', 'circuit-world-hopper', 'circuit-firewall']);
});
