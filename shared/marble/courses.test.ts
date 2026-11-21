import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { botRun } from './bot';
import { doorsForSeed } from './maths';
import { COURSES } from './courses';
import { makeWorld, medalFor, newRun, replay, stepRun } from './engine';
import { NZ_COURSE_DEFS } from './nzCourses';
import { encodeInputs } from './inputs';
import { checkGhost } from '../../src/games/marble/ghostCheck';
import { along, QUESTION_GAP, questionOrder, questionToShow } from '../../src/games/marble/questionOrder';

// The server's Marble Cup and Golden Marble use their own copy of the gold times (public.marble_gold_steps in
// supabase/migrations/20261112002300_trophies_games_4.sql): if a course's medals change here, change that copy in a new migration.
it('the bot finishes every course without falling and earns gold, and replays to the same time (and as a ghost), meeting its questions in order and never crowded; the server knows the same golds', () => {
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
    // A ghost that still finishes is kept with today's time; one that drives off the changed track is dropped.
    const ghost = { name: 'Ari', steps: 99999, inputs: encodeInputs(bot.runs), doors: openDoors, gems: [] };
    expect(checkGhost(c, 'up', ghost)?.steps, c.def.id).toBe(bot.state.finishSteps);
    expect(checkGhost(c, 'up', { ...ghost, inputs: '3x60' }), c.def.id).toBeNull();
    // Stops and gates come in the order questionOrder says, and each gate's question shows before its tunnels (never early).
    const order = questionOrder(c);
    // Never crowded: QUESTION_GAP tiles at least between stops, gates and rows of gems, and a gem trail's rows come together.
    const middle = (spots: ReadonlyArray<readonly [number, number]>, k: 0 | 1) => spots.reduce((n, p) => n + p[k], 0) / spots.length;
    const spots = [
      ...order.filter((o) => o.kind !== 'gems').map((o) => ({ pos: o.pos, what: o.kind + o.index })),
      ...c.gems.flatMap((t, ti) => t.groups.map((g) => ({ pos: along(c.def.route, middle(g.spots, 0), middle(g.spots, 1)), what: `gems${ti}` }))),
    ].sort((a, b) => a.pos - b.pos);
    spots.slice(1).forEach((s, i) => {
      if (s.what !== spots[i].what) expect(s.pos - spots[i].pos, `${c.def.id}: ${spots[i].what} then ${s.what}`).toBeGreaterThanOrEqual(QUESTION_GAP);
    });
    const runs = spots.map((s) => s.what).filter((what, i, all) => what !== all[i - 1]);
    expect(new Set(runs).size, `${c.def.id}: a gem trail split by another question`).toBe(runs.length);
    const w = makeWorld(c, { openDoors });
    const s = newRun(w);
    const met: string[] = [];
    const shown = new Set<number>();
    const passed = new Set<number>();
    for (const [code, n] of bot.runs) {
      for (let i = 0; i < n && s.outcome === 'running'; i++) {
        stepRun(w, s, code);
        const q = questionToShow(c, order, s, passed);
        if (q?.kind === 'gate') shown.add(q.index);
        s.pitStops.forEach((p) => met.includes(`stop${p}`) || met.push(`stop${p}`));
        s.gateChoices.forEach((g, gi) => {
          if (g >= 0 && !met.includes(`gate${gi}`)) {
            met.push(`gate${gi}`);
            expect(shown.has(gi), `${c.def.id} gate ${gi} question shown`).toBe(true);
          }
        });
      }
    }
    expect(met, c.def.id).toEqual(order.filter((o) => o.kind !== 'gems').map((o) => o.kind + o.index));
  }
});
