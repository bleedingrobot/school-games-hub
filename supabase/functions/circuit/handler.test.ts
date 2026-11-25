/**
 * The circuit function on the pretend database (shared/circuit/memoryServices.ts). Server tests 1 to 3 of the game's 8
 * (Stage 1 used 3; Stage 3's other test is shared/circuit/maths.test.ts).
 */
import { expect, it } from 'vitest';
import { botRun } from '../../../shared/circuit/bot';
import { HALF_REFILL, TOP_SPEED } from '../../../shared/circuit/config';
import { allowTestRoad, FINISHES_A_DAY, roadById, stampText, WORLDS } from '../../../shared/circuit/game';
import { encodeLog, inputCode, makeRecorder } from '../../../shared/circuit/inputs';
import type { RunMaths } from '../../../shared/circuit/maths';
import { memoryServices, type MemoryOptions } from '../../../shared/circuit/memoryServices';
import { newRace, replay, step, type RaceOptions } from '../../../shared/circuit/physics';
import type { Road } from '../../../shared/circuit/road';
import { TEST_ROAD } from '../../../shared/circuit/roads/test';
import { markQuestion } from '../../../shared/maths/serverQuestions';
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

it('replays a finish and keeps only what the replay says; saves an unlocked racer and Volt’s tips; replays a guided go; refuses another pupil’s run, a switched-off class and no sign-in', async () => {
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

  // Racers (Stage 5): Spark to start; Pixel waits for the Graphics Card; the pick is saved.
  expect((await send({ action: 'load' })).body.racer).toBe('spark');
  expect((await send({ action: 'racer', racer: 'pixel' })).body.code).toBe('locked');
  expect((await send({ action: 'racer', racer: 'nope' })).status).toBe(400);
  db.roads.ana = { ...db.roads.ana, ...Object.fromEntries(WORLDS[0].roads.map((r) => [r.id, { ...db.roads.ana[ROAD] }])) };
  expect((await send({ action: 'racer', racer: 'pixel' })).status).toBe(200);
  expect((await send({ action: 'load' })).body.racer).toBe('pixel');

  // Volt's tips (Stage 6): none seen to start, saved once each, only known ones.
  expect((await send({ action: 'load' })).body.seen).toEqual([]);
  expect((await send({ action: 'seen', tips: ['guide', 'crash'] })).status).toBe(200);
  expect((await send({ action: 'seen', tips: ['crash'] })).status).toBe(200);
  expect((await send({ action: 'seen', tips: ['nope'] })).status).toBe(400);
  expect((await send({ action: 'load' })).body.seen).toEqual(['guide', 'crash']);
  // A guided go on road 1 replays with its gaps bridged until the first jump; the flag means nothing on another road.
  const guided = botRun(roadById(ROAD)!, 'careful', { guide: true }, 1);
  const seed = `c1-${Math.floor(NOW / 1000) - 199}-${'cd'.repeat(12)}`;
  const gone = { road: ROAD, seed, stamp: (await db.stamp(stampText('ana', ROAD, seed)))!, inputs: encodeLog(guided.log), crashes: 0 };
  expect((await send({ action: 'finish', ...gone, guide: true })).body).toMatchObject({ result: 'saved', steps: guided.state.steps });

  db.switches.enabled = false;
  for (const body of [{ action: 'load' }, { action: 'racer', racer: 'spark' }, { action: 'start', road: ROAD }, { action: 'finish', ...(await go()), inputs: INPUTS, crashes: 0 }]) {
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

/** Drives the test road at a steady speed, in lane 3 past the port, then into `lanes[g]` for gate g. */
function driveGates(road: Road, lanes: number[], opts: RaceOptions) {
  const rec = makeRecorder();
  let s = newRace(road, opts);
  while (s.outcome === 'racing' && s.steps < 5000) {
    const row = Math.floor(s.z);
    const inGate = road.gateAt[row] ?? -1;
    const target = row < 20 ? 3 : inGate >= 0 ? lanes[inGate] : (lanes[s.gatesPassed] ?? 3);
    const turn = s.x < target + 0.4 ? 1 : s.x > target + 0.6 ? -1 : 0;
    const input = { turn, accel: s.vz < TOP_SPEED * 0.6 ? 1 : 0, jump: false } as const;
    rec.record(s, inputCode(input));
    s = step(s, input, road).state;
  }
  return { state: s, log: rec.log };
}

it('marks a port answer once and replays its refill, gives no shortcut for a wrong gate lane, and asks nothing with maths off', async () => {
  allowTestRoad(TEST_ROAD);
  const road = roadById(TEST_ROAD.id)!;
  let clock = NOW;
  const db = memoryServices({ now: () => clock });
  const handler = makeHandler(db);
  const send = async (body: object) => {
    const r = await handler(new Request('http://x/circuit', { method: 'POST', headers: { Authorization: 'Bearer pupil:ana' }, body: JSON.stringify(body) }));
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  };
  const go = await send({ action: 'start', road: road.def.id });
  const { seed, stamp } = go.body as { seed: string; stamp: string };
  const maths = go.body.maths as RunMaths;
  expect([maths.ports.length, maths.gates.length]).toEqual([1, 2]);
  expect(JSON.stringify(maths)).not.toMatch(/"answer"|factKey/);

  // The port: marked once (the first answer stays), recorded once; a gate can't be answered here.
  const right = markQuestion(db.questions[`ana:${seed}`].questions[0])!.answer;
  expect((await send({ action: 'answer', road: road.def.id, seed, stamp, slot: 0, answer: right + 1, ms: 4000 })).body).toEqual({ right: false, answer: right });
  expect((await send({ action: 'answer', road: road.def.id, seed, stamp, slot: 0, answer: right, ms: 4000 })).status).toBe(400);
  expect((await send({ action: 'answer', road: road.def.id, seed, stamp, slot: 1, answer: right, ms: 4000 })).status).toBe(400);
  expect(db.answers.map((a) => a.answers.map((x) => x.correct))).toEqual([[false]]);

  // The right lane at gate 1 is an overclock shortcut; a wrong lane is the normal road, no faster.
  const gateRight = maths.gates.map((g) => g.rightLane);
  const wrongLane = road.gates[0].lanes.find((l) => l !== gateRight[0])!;
  const opts = { refills: [HALF_REFILL], gateRight };
  const wrongRun = driveGates(road, [wrongLane, gateRight[1]], opts);
  const rightRun = driveGates(road, gateRight, opts);
  expect([wrongRun.state.outcome, rightRun.state.outcome]).toEqual(['finished', 'finished']);
  expect(rightRun.state.steps).toBeLessThan(wrongRun.state.steps);

  // The finish replays with the port's marked refill (half, not full) and marks the lanes: gate 1 wrong, gate 2 right.
  clock += 200_000;
  const done = await send({ action: 'finish', road: road.def.id, seed, stamp, inputs: encodeLog(wrongRun.log), crashes: 0 });
  expect(done.body).toMatchObject({ steps: wrongRun.state.steps, battery: wrongRun.state.battery });
  expect(replay(road, wrongRun.log, { refills: [1], gateRight }).battery).not.toBe(wrongRun.state.battery);
  expect(db.answers.map((a) => a.answers.map((x) => x.correct))).toEqual([[false], [false, true]]);
  await send({ action: 'finish', road: road.def.id, seed, stamp, inputs: encodeLog(wrongRun.log), crashes: 0 });
  expect(db.answers).toHaveLength(2);

  // Maths off: no questions are made or kept, and ports can't be answered.
  db.switches.maths = 'off';
  const plain = await send({ action: 'start', road: road.def.id });
  expect(plain.body.maths).toBeNull();
  expect(Object.keys(db.questions)).toHaveLength(1);
  expect((await send({ action: 'answer', road: road.def.id, seed: plain.body.seed, stamp: plain.body.stamp, slot: 0, answer: 1, ms: 1 })).status).toBe(400);
});
