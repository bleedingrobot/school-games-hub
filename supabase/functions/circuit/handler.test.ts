/**
 * The circuit function on the pretend database (shared/circuit/memoryServices.ts). Server tests 1 and 2 of the game's 8
 * (Stage 1 used 3).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { botRun } from '../../../shared/circuit/bot';
import { FINISHES_A_DAY, roadById, stampText } from '../../../shared/circuit/game';
import { encodeLog } from '../../../shared/circuit/inputs';
import { memoryServices, type MemoryOptions } from '../../../shared/circuit/memoryServices';
import { makeHandler } from './handler';

const NOW = 1_792_000_000_000;
const ROAD = 'power-on';
const bot = botRun(roadById(ROAD)!, 'average', {}, 1);
const INPUTS = encodeLog(bot.log);

function setup(opts: MemoryOptions = {}) {
  const db = memoryServices({ now: () => NOW, ...opts });
  const handler = makeHandler(db);
  const send = async (body: object, who: string | null = 'ana') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (who) headers.Authorization = `Bearer pupil:${who}`;
    const r = await handler(new Request('http://x/circuit', { method: 'POST', headers, body: JSON.stringify(body) }));
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  };
  /** A go handed out 200 s ago (so a 20 s run is not faster than real time). */
  const go = async (who = 'ana', road = ROAD) => {
    const seed = `c1-${Math.floor(NOW / 1000) - 200}-${'ab'.repeat(12)}`;
    return { road, seed, stamp: (await db.stamp(stampText(who, road, seed)))! };
  };
  return { db, send, go };
}

it('replays a finish and keeps only what the replay says; refuses another pupil’s run, a switched-off class and no sign-in', async () => {
  const { db, send, go } = setup();
  expect((await send({ action: 'load' }, null)).status).toBe(401);

  const start = await send({ action: 'start', road: ROAD });
  expect(start.status).toBe(200);
  expect(start.body.left).toBe(FINISHES_A_DAY);
  // The second road is locked until the first is finished.
  expect((await send({ action: 'start', road: 'clock-speed' })).body.code).toBe('locked');

  // A tampered time is ignored: the replay's steps, medal and battery are what's saved.
  const run = await go();
  const done = await send({ action: 'finish', ...run, inputs: INPUTS, crashes: 0, steps: 1, medal: 'gold' });
  expect(done.status).toBe(200);
  expect(done.body).toMatchObject({ result: 'best', steps: bot.state.steps, clean: true, left: FINISHES_A_DAY - 1 });
  expect(db.roads.ana[ROAD].best).toBe(bot.state.steps);
  expect(db.points).toEqual([{ player: 'ana', points: expect.any(Number), once: run.seed }]);
  // Sent twice, counted once.
  expect((await send({ action: 'finish', ...run, inputs: INPUTS, crashes: 0 })).body.result).toBe('duplicate');
  expect(db.points).toHaveLength(1);

  // Inputs that don't reach the finish, a bad stamp, and another pupil's go are refused.
  expect((await send({ action: 'finish', ...(await go()), inputs: '0.0.4', crashes: 0 })).status).toBe(400);
  expect((await send({ action: 'finish', ...(await go()), stamp: 'nope', inputs: INPUTS, crashes: 0 })).status).toBe(400);
  expect((await send({ action: 'finish', ...(await go('ben')), inputs: INPUTS, crashes: 0 }, 'ana')).status).toBe(400);

  db.switches.enabled = false;
  for (const body of [{ action: 'load' }, { action: 'start', road: ROAD }, { action: 'finish', ...(await go()), inputs: INPUTS, crashes: 0 }]) {
    const r = await send(body);
    expect([r.status, r.body.code]).toEqual([403, 'off']);
  }
});

it('refuses a 6th finish in a New Zealand day unless the class has Unlimited today (extra finishes give no points)', async () => {
  const { db, send, go } = setup({ today: FINISHES_A_DAY - 1 });
  expect((await send({ action: 'finish', ...(await go()), inputs: INPUTS, crashes: 2 })).body).toMatchObject({ left: 0, clean: false });
  expect((await send({ action: 'start', road: ROAD })).body.code).toBe('done-today');
  // A go started before the limit was reached is still refused at the finish.
  const late = { ...(await go()), seed: `c1-${Math.floor(NOW / 1000) - 100}-${'cd'.repeat(12)}` };
  late.stamp = (await db.stamp(stampText('ana', ROAD, late.seed)))!;
  expect((await send({ action: 'finish', ...late, inputs: INPUTS, crashes: 0 })).body.code).toBe('done-today');

  db.switches.unlimited = true;
  expect((await send({ action: 'load' })).body.left).toBeNull();
  expect((await send({ action: 'finish', ...late, inputs: INPUTS, crashes: 0 })).body).toMatchObject({ result: 'saved', left: null });
  expect(db.points).toHaveLength(1);
});

it('is up to date with the code (run `npm run build:functions -- circuit` if this fails)', async () => {
  // @ts-expect-error: plain JavaScript build script
  const { buildFunction } = await import('../../../scripts/build-functions.mjs');
  const built: string = await buildFunction('circuit');
  expect(readFileSync(resolve('supabase/functions/circuit/index.ts'), 'utf8')).toBe(built);
});
