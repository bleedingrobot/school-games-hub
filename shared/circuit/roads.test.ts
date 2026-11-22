import { expect, it } from 'vitest';
import { botRun } from './bot';
import { roadNeeds, roadOpen, WORLDS, type RoadProgress } from './game';
import { decodeLog, encodeLog } from './inputs';
import { replay } from './physics';
import { countRuns, parseRoad } from './road';

it('a bot finishes every road of every world on its first go, the replay agrees, and worlds open at 4 of 6', () => {
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
});
