import { expect, it } from 'vitest';
import { botRun } from './bot';
import { decodeLog, encodeLog } from './inputs';
import { replay } from './physics';
import { countRuns, parseRoad } from './road';
import { MOTHERBOARD_ROADS } from './roads/motherboard';

it('a bot finishes every Motherboard road on its first go, and the server replay agrees on the time', () => {
  expect(new Set(MOTHERBOARD_ROADS.map((r) => r.id)).size).toBe(6);
  MOTHERBOARD_ROADS.forEach((def, i) => {
    const road = parseRoad(def);
    // World 1 teaches driving: no data gates, and recharge ports only from road 3.
    expect(countRuns(road, '?'), def.id).toBe(0);
    expect(countRuns(road, '+') > 0, def.id).toBe(i >= 2);
    const bot = botRun(road, 'average', {}, 1);
    expect(bot.state.outcome, def.id).toBe('finished');
    expect(replay(road, decodeLog(encodeLog(bot.log))!).steps, def.id).toBe(bot.state.steps);
  });
  expect(() => parseRoad({ ...MOTHERBOARD_ROADS[0], rows: ['------'] })).toThrow(/row 1/);
});
