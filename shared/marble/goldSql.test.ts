import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { NZ_COURSE_DEFS } from './nzCourses';

// The server's Marble Cup and Golden Marble trophies use its own copy of the gold times (public.marble_gold_steps in
// supabase/migrations/20261112002300_trophies_games_4.sql). If a course's medals change here, change that copy in a new
// migration too.
it('the server knows the same gold times as the courses', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261112002300_trophies_games_4.sql'), 'utf8');
  const server = Object.fromEntries(
    [...sql.matchAll(/when '([a-z-]+)' then case when maths then (\d+) else (\d+) end/g)].map((m) => [m[1], { goldMaths: Number(m[2]), gold: Number(m[3]) }]),
  );
  const game = Object.fromEntries(NZ_COURSE_DEFS.map((c) => [c.id, { goldMaths: c.medals.goldMaths ?? c.medals.gold, gold: c.medals.gold }]));
  expect(server).toEqual(game);
});
