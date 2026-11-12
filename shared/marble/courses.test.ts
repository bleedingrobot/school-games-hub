import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { botRun } from './bot';
import { doorsForSeed } from './maths';
import { COURSES } from './courses';
import { medalFor, replay } from './engine';
import { NZ_COURSE_DEFS } from './nzCourses';

// The server's Marble Cup and Golden Marble use their own copy of the gold times (public.marble_gold_steps in
// supabase/migrations/20261112002300_trophies_games_4.sql): if a course's medals change here, change that copy in a new migration.
it('the bot finishes every course without falling and earns gold, and replays to the same time; the server knows the same golds', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261112002300_trophies_games_4.sql'), 'utf8');
  const server = Object.fromEntries(
    [...sql.matchAll(/when '([a-z-]+)' then case when maths then (\d+) else (\d+) end/g)].map((m) => [m[1], { goldMaths: Number(m[2]), gold: Number(m[3]) }]),
  );
  expect(server).toEqual(Object.fromEntries(NZ_COURSE_DEFS.map((c) => [c.id, { goldMaths: c.medals.goldMaths ?? c.medals.gold, gold: c.medals.gold }])));
  for (const c of COURSES) {
    const openDoors = doorsForSeed(c, 'test-seed', null);
    const bot = botRun(c, { openDoors });
    expect(bot.state.outcome, c.def.id).toBe('finished');
    expect(bot.state.falls, c.def.id).toBe(0);
    expect(medalFor(c, bot.state.finishSteps), c.def.id).toBe('gold');
    expect(replay(c, bot.runs, { openDoors })?.finishSteps, c.def.id).toBe(bot.state.finishSteps);
  }
});
