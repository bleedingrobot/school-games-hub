import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld } from '../../../shared/mine/engine';
import { encodeInputs, GRANT, PENALTY } from '../../../shared/mine/inputs';
import { medalFor } from '../../../shared/mine/medals';
import { makeLevel, recipeById } from '../../../shared/mine/level';
import { DOOR_QUESTIONS, PAD_QUESTIONS, questionPlan, type MathsContext } from '../../../shared/mine/maths';
import { MAX_INPUTS_TEXT, MINE_RUNS_PER_DAY, mineStampText } from '../../../shared/mine/save';
import { answersMatch, makeHandler, MAX_REQUESTS_PER_MINUTE, type Services, type StoredRun } from './handler';

const NOW = 1_792_000_000_000;

/** A pretend stamper: not secure, just stable, so the tests can build a good stamp. */
const fakeStamp = async (text: string) => `stamp(${text})`;

const CONTEXT: MathsContext = { facts: [], settings: {} };

/** A pretend database, so a start, some answers and a finish can be tested together. */
function services(over: Partial<Services> = {}, settings: 'off' | 'choose' | 'on' = 'choose') {
  const runs = new Map<string, StoredRun>();
  const clock = { now: NOW };
  const recorded: { once: string; answers: { key: string; correct: boolean }[] }[] = [];
  const s: Services = {
    now: () => clock.now,
    randomHex: (bytes) => 'ab'.repeat(bytes),
    stamp: fakeStamp,
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'pupil-1' : token === 'other-token' ? 'pupil-2' : null)),
    settings: async () => ({ enabled: true, maths: settings }),
    mathsContext: async () => CONTEXT,
    runsToday: async () => 0,
    storeRun: async (_p, seed, level, questions) => {
      runs.set(seed, { level, questions, answered: {} });
      return true;
    },
    loadRun: async (_p, seed) => runs.get(seed) ?? null,
    claimAnswer: async (_p, seed, slot, value, right) => {
      const run = runs.get(seed);
      if (!run || run.answered[String(slot)]) return false;
      run.answered[String(slot)] = { value, right };
      return true;
    },
    recordAnswers: vi.fn(async (_p, once, answers) => {
      recorded.push({ once, answers });
    }),
    record: vi.fn(async () => ({ ok: true as const, value: 'first' as const })),
    awardPoints: vi.fn(async () => {}),
    progressChanged: vi.fn(async () => {}),
    ...over,
  };
  return { s, runs, clock, recorded };
}

function post(body: unknown, token: string | null = 'good-token') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/mine', { method: 'POST', headers, body: JSON.stringify(body) });
}

async function send(s: Services, body: unknown, token: string | null = 'good-token') {
  const response = await makeHandler(s)(post(body, token));
  return { status: response.status, body: await response.json() };
}

const startBody = (over: Record<string, unknown> = {}) => ({ action: 'start', level: 'l2', mode: 'steady', maths: true, ...over });

/** Flies a mine with the pretend pilot. */
function fly(levelId: string, maths: boolean, steady = true) {
  const recipe = recipeById(levelId)!;
  const world = makeWorld(makeLevel(recipe), { steady, maths });
  const bot = flyLevel(world);
  expect(bot.state.outcome).toBe('finished');
  return { bot, plan: questionPlan(world.level) };
}

/** Starts a run through the handler and answers the given slots (right unless told otherwise). */
async function begin(h: ReturnType<typeof services>, level = 'l2', maths = true, mode: 'steady' | 'free' = 'steady') {
  const { body } = await send(h.s, startBody({ level, maths, mode }));
  const stored = h.runs.get(body.seed);
  return { reply: body as { seed: string; stamp: string; maths: boolean; questions: { slot: number }[] }, stored, level, mode };
}
const answerBody = (b: { reply: { seed: string; stamp: string }; level: string; mode: string }, slot: number, value: number, ms = 3000) => ({
  action: 'answer', seed: b.reply.seed, stamp: b.reply.stamp, level: b.level, mode: b.mode, slot, value, ms,
});
/** Finishing: the seed was handed out `after` seconds ago. */
function finishBody(b: { reply: { seed: string; stamp: string }; level: string; mode: string; reply2?: never }, runs: [number, number][], maths = true) {
  return { action: 'finish', seed: b.reply.seed, stamp: b.reply.stamp, level: b.level, mode: b.mode, maths, inputs: encodeInputs(runs) };
}

describe('the mine server function', () => {
  it('needs a signed-in pupil', async () => {
    expect((await send(services().s, startBody(), null)).status).toBe(401);
    expect((await send(services().s, startBody(), 'fake')).status).toBe(401);
  });

  it('only takes POST, and answers the browser’s pre-check', async () => {
    const handle = makeHandler(services().s);
    expect((await handle(new Request('http://x/mine', { method: 'OPTIONS' }))).status).toBe(204);
    expect((await handle(new Request('http://x/mine', { method: 'GET' }))).status).toBe(405);
  });

  it('turns away something that is not start, answer or finish', async () => {
    expect((await send(services().s, { action: 'delete' })).status).toBe(400);
    expect((await send(services().s, null as never)).status).toBe(400);
    expect((await send(services().s, [1, 2] as never)).status).toBe(400);
  });

  it('slows down a pupil who sends too often', async () => {
    const handle = makeHandler(services().s);
    let last = 200;
    for (let i = 0; i <= MAX_REQUESTS_PER_MINUTE; i++) last = (await handle(post(startBody({ maths: false })))).status;
    expect(last).toBe(429);
  });

  it('takes a bigger request than the shared helper would, but not a huge one', async () => {
    const h = services();
    const big = (await begin(h, 'l1', false)).reply;
    const sizeable = { action: 'finish', seed: big.seed, stamp: big.stamp, level: 'l1', mode: 'steady', maths: false, inputs: '0x1,'.repeat(10) };
    // Not a finish, so it is refused, but it was read (a 400 from the run check, not from the body size).
    expect((await send(h.s, sizeable)).status).toBe(400);
    const tooBig = { ...sizeable, inputs: 'a'.repeat(MAX_INPUTS_TEXT + 10) };
    expect((await send(h.s, tooBig)).status).toBe(400);
    expect(h.s.record).not.toHaveBeenCalled();
  });
});

describe('starting a run', () => {
  it('hands out a stamped seed for a real mine, with its questions kept on the server', async () => {
    const h = services();
    const { status, body } = await send(h.s, startBody());
    expect(status).toBe(200);
    expect(body.seed).toMatch(/^n1-\d{10}-[0-9a-f]{24}$/);
    expect(body.stamp).toBe(`stamp(${mineStampText('pupil-1', 'l2', 'steady', true, body.seed)})`);
    expect(body.maths).toBe(true);
    const plan = questionPlan(makeLevel(recipeById('l2')!));
    expect(body.questions).toHaveLength(plan.total);
    expect(h.runs.get(body.seed)!.questions).toHaveLength(plan.total);
  });

  it('gives each question door its own questions and each pad three', () => {
    const plan = questionPlan(makeLevel(recipeById('l6')!));
    expect(plan.targets.filter((t) => t.kind === 'door')).toHaveLength(3);
    expect(plan.targets.filter((t) => t.kind === 'pad')).toHaveLength(5);
    expect(plan.total).toBe(3 * DOOR_QUESTIONS + 5 * PAD_QUESTIONS);
    // No two targets share a slot.
    const slots = plan.targets.flatMap((t) => Array.from({ length: t.count }, (_, i) => t.first + i));
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('sends the browser what to show but never an answer or a record', async () => {
    const h = services();
    const { reply } = await begin(h);
    expect(reply.questions[0]).toHaveProperty('parts');
    expect(reply.questions[0]).toHaveProperty('spoken');
    for (const q of reply.questions) {
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('factKey');
      expect(q).not.toHaveProperty('params');
    }
    expect(reply.questions.map((q) => q.slot)).toEqual(reply.questions.map((_, i) => i));
  });

  it('makes the same questions again from the same seed', async () => {
    const a = services();
    const b = services();
    const first = await send(a.s, startBody());
    const second = await send(b.s, startBody());
    expect(first.body.seed).toBe(second.body.seed);
    expect(first.body.questions).toEqual(second.body.questions);
  });

  it('starts a run with no questions when maths is not wanted (and the teacher allows that)', async () => {
    const h = services();
    const { status, body } = await send(h.s, startBody({ maths: false }));
    expect(status).toBe(200);
    expect(body.maths).toBe(false);
    expect(body.questions).toEqual([]);
    expect(h.runs.size).toBe(0);
    expect(body.stamp).toBe(`stamp(${mineStampText('pupil-1', 'l2', 'steady', false, body.seed)})`);
    // A request that says nothing about maths is a run without it.
    expect((await send(h.s, { action: 'start', level: 'l2', mode: 'steady' })).body.maths).toBe(false);
  });

  it('refuses maths, in plain words, when the teacher has it off', async () => {
    const { status, body } = await send(services({}, 'off').s, startBody({ maths: true }));
    expect(status).toBe(403);
    expect(body.code).toBe('maths-off');
    expect(body.error).toMatch(/switched off/);
    // ...but a run without maths is fine.
    expect((await send(services({}, 'off').s, startBody({ maths: false }))).status).toBe(200);
  });

  it('refuses a run without maths when the teacher has switched it on for everyone', async () => {
    const { status, body } = await send(services({}, 'on').s, startBody({ maths: false }));
    expect(status).toBe(403);
    expect(body.code).toBe('maths-on');
    expect((await send(services({}, 'on').s, startBody({ maths: true }))).status).toBe(200);
  });

  it('lets a pupil choose either way when the teacher says "students choose"', async () => {
    expect((await send(services().s, startBody({ maths: true }))).status).toBe(200);
    expect((await send(services().s, startBody({ maths: false }))).status).toBe(200);
  });

  it('does not start if the teacher’s switch, the records or the question list cannot be had', async () => {
    expect((await send(services({ settings: async () => null }).s, startBody())).status).toBe(503);
    expect((await send(services({ mathsContext: async () => null }).s, startBody())).status).toBe(503);
    expect((await send(services({ storeRun: async () => false }).s, startBody())).status).toBe(503);
  });

  it('refuses a mine that does not exist, the practice mine, and a flight mode it does not know', async () => {
    const s = services().s;
    expect((await send(s, startBody({ level: 'l9' }))).status).toBe(400);
    expect((await send(s, startBody({ level: 'practice' }))).status).toBe(400);
    expect((await send(s, startBody({ level: 'l2:easy' }))).status).toBe(400);
    expect((await send(s, startBody({ level: 5 }))).status).toBe(400);
    expect((await send(s, startBody({ mode: 'sideways' }))).status).toBe(400);
  });

  it('starts hard mode as its own mine', async () => {
    const h = services();
    const { body } = await send(h.s, startBody({ level: 'l3:hard' }));
    expect(body.stamp).toBe(`stamp(${mineStampText('pupil-1', 'l3:hard', 'steady', true, body.seed)})`);
    expect(h.runs.get(body.seed)!.level).toBe('l3:hard');
  });

  it('makes no seed when the server has no secret', async () => {
    expect((await send(services({ stamp: async () => null }).s, startBody())).status).toBe(500);
  });

  it('asks for a break at the daily limit, and does not start if it cannot count', async () => {
    const { status, body } = await send(services({ runsToday: async () => MINE_RUNS_PER_DAY }).s, startBody());
    expect(status).toBe(429);
    expect(body.code).toBe('too-many');
    expect((await send(services({ runsToday: async () => MINE_RUNS_PER_DAY - 1 }).s, startBody())).status).toBe(200);
    expect((await send(services({ runsToday: async () => 'busy' }).s, startBody())).status).toBe(503);
  });

  it('keeps the daily limit at 20 counted runs', () => {
    expect(MINE_RUNS_PER_DAY).toBe(20);
  });
});

describe('answering a question', () => {
  it('marks a right answer, says what it was, and records it once', async () => {
    const h = services();
    const b = await begin(h);
    const right = b.stored!.questions[0].answer;
    const { status, body } = await send(h.s, answerBody(b, 0, right));
    expect(status).toBe(200);
    expect(body).toEqual({ correct: true, answer: right });
    expect(h.recorded).toHaveLength(1);
    expect(h.recorded[0].once).toBe(`${b.reply.seed}:0`);
    expect(h.recorded[0].answers[0]).toMatchObject({ key: b.stored!.questions[0].factKey, correct: true });
    expect(h.runs.get(b.reply.seed)!.answered['0']).toEqual({ value: right, right: true });
  });

  it('marks a wrong answer and tells the pupil the right one (for “7 × 8 = 56”)', async () => {
    const h = services();
    const b = await begin(h);
    const right = b.stored!.questions[1].answer;
    const { body } = await send(h.s, answerBody(b, 1, right + 1));
    expect(body).toEqual({ correct: false, answer: right });
    expect(h.recorded[0].answers[0].correct).toBe(false);
  });

  it('gives the same reply to the same answer sent again, and records it once', async () => {
    const h = services();
    const b = await begin(h);
    const right = b.stored!.questions[0].answer;
    await send(h.s, answerBody(b, 0, right));
    const again = await send(h.s, answerBody(b, 0, right));
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ correct: true, answer: right });
    expect(h.recorded).toHaveLength(1);
  });

  it('turns away a different answer to a slot that was answered', async () => {
    const h = services();
    const b = await begin(h);
    const right = b.stored!.questions[0].answer;
    await send(h.s, answerBody(b, 0, right + 1));
    expect((await send(h.s, answerBody(b, 0, right))).status).toBe(400);
    expect(h.runs.get(b.reply.seed)!.answered['0'].right).toBe(false);
  });

  it('turns away a slot that does not exist, a negative slot, a fractional one', async () => {
    const h = services();
    const b = await begin(h);
    expect((await send(h.s, answerBody(b, 999, 1))).status).toBe(400);
    expect((await send(h.s, answerBody(b, -1, 1))).status).toBe(400);
    expect((await send(h.s, { ...answerBody(b, 0, 1), slot: 0.5 })).status).toBe(400);
    expect((await send(h.s, { ...answerBody(b, 0, 1), value: 'seven' })).status).toBe(400);
    expect((await send(h.s, { ...answerBody(b, 0, 1), value: -1 })).status).toBe(400);
    expect(h.recorded).toHaveLength(0);
  });

  it('refuses a bad stamp, another pupil’s seed, or a seed that never had maths', async () => {
    const h = services();
    const b = await begin(h);
    const right = b.stored!.questions[0].answer;
    expect((await send(h.s, { ...answerBody(b, 0, right), stamp: 'made-up' })).status).toBe(400);
    expect((await send(h.s, answerBody(b, 0, right), 'other-token')).status).toBe(400);
    expect((await send(h.s, { ...answerBody(b, 0, right), level: 'l3' })).status).toBe(400);
    const plain = await begin(h, 'l2', false);
    expect((await send(h.s, answerBody(plain, 0, 1))).status).toBe(400);
    expect(h.recorded).toHaveLength(0);
  });

  it('refuses an answer for an old seed', async () => {
    const h = services();
    const b = await begin(h);
    h.clock.now += 7 * 3600 * 1000;
    expect((await send(h.s, answerBody(b, 0, b.stored!.questions[0].answer))).status).toBe(400);
  });

  it('says busy when the database is away, and still answers if only the maths records fail', async () => {
    const h = services({ loadRun: async () => 'busy' });
    const b = await begin(h);
    expect((await send(h.s, answerBody(b, 0, 1))).status).toBe(503);
    const g = services({ recordAnswers: async () => { throw new Error('records down'); } });
    const c = await begin(g);
    expect((await send(g.s, answerBody(c, 0, c.stored!.questions[0].answer))).status).toBe(200);
    const k = services({ claimAnswer: async () => 'busy' });
    const d = await begin(k);
    expect((await send(k.s, answerBody(d, 0, 1))).status).toBe(503);
  });

  it('keeps a slow answer’s time to two minutes', async () => {
    const h = services();
    const b = await begin(h);
    await send(h.s, answerBody(b, 0, b.stored!.questions[0].answer, 9_999_999));
    expect(h.recorded[0].answers[0]).toBeDefined();
    const recorded = vi.mocked(h.s.recordAnswers).mock.calls[0][2][0] as { ms: number };
    expect(recorded.ms).toBe(120_000);
  });
});

/** Answers every slot of one door or pad the way a pupil would: wrong ones first, then a right one. */
async function answerTarget(h: ReturnType<typeof services>, b: Awaited<ReturnType<typeof begin>>, targetId: number, wrong = 0) {
  const plan = questionPlan(makeLevel(recipeById(b.level)!));
  const target = plan.targets.find((t) => t.id === targetId)!;
  for (let i = 0; i < wrong; i++) await send(h.s, answerBody(b, target.first + i, b.stored!.questions[target.first + i].answer + 1));
  const slot = target.first + wrong;
  await send(h.s, answerBody(b, slot, b.stored!.questions[slot].answer));
}

describe('finishing a run', () => {
  it('replays the inputs itself and saves the time it worked out', async () => {
    const h = services();
    const { bot, plan } = fly('l2', true);
    const b = await begin(h, 'l2');
    const door = plan.targets.find((t) => t.kind === 'door')!;
    await answerTarget(h, b, door.id);
    h.clock.now += 400_000;
    const { status, body } = await send(h.s, finishBody(b, bot.runs));
    expect(status).toBe(200);
    expect(body.result).toBe('first');
    expect(body.steps).toBe(bot.state.finishSteps);
    const [player, report, run] = vi.mocked(h.s.record).mock.calls[0];
    expect(player).toBe('pupil-1');
    expect(report.level).toBe('l2');
    expect(report.maths).toBe(true);
    expect(run.steps).toBe(bot.state.finishSteps);
    expect(run.grants).toEqual([door.id]);
    expect(run.penalties).toBe(0);
  });

  it('ignores a time the browser claims', async () => {
    const h = services();
    const { bot, plan } = fly('l2', true);
    const b = await begin(h, 'l2');
    await answerTarget(h, b, plan.targets.find((t) => t.kind === 'door')!.id);
    h.clock.now += 400_000;
    await send(h.s, { ...finishBody(b, bot.runs), steps: 1, time: 1, finishSteps: 1 });
    expect(vi.mocked(h.s.record).mock.calls[0][2].steps).toBe(bot.state.finishSteps);
  });

  it('accepts a flown run in free flight too', async () => {
    const h = services();
    const { bot, plan } = fly('l2', true, false);
    const b = await begin(h, 'l2', true, 'free');
    await answerTarget(h, b, plan.targets.find((t) => t.kind === 'door')!.id);
    h.clock.now += 400_000;
    expect((await send(h.s, finishBody(b, bot.runs))).status).toBe(200);
  });

  it('accepts a run with no maths on a mine that needs none, and refuses a made-up grant in it', async () => {
    const h = services();
    const { bot } = fly('l1', false);
    const b = await begin(h, 'l1', false);
    h.clock.now += 400_000;
    expect((await send(h.s, finishBody(b, bot.runs, false))).status).toBe(200);
    expect(vi.mocked(h.s.record).mock.calls[0][1].maths).toBe(false);
    // A forged answer in a run that had none.
    const g = services();
    const c = await begin(g, 'l1', false);
    g.clock.now += 400_000;
    const forged: [number, number][] = [[GRANT, 1], ...bot.runs];
    expect((await send(g.s, finishBody(c, forged, false))).status).toBe(400);
    expect(g.s.record).not.toHaveBeenCalled();
  });

  it('plays a mine with question doors, with the doors open, when the run has no maths', async () => {
    const h = services({}, 'off');
    const { bot } = fly('l2', false);
    const b = await begin(h, 'l2', false);
    h.clock.now += 400_000;
    const { status } = await send(h.s, finishBody(b, bot.runs, false));
    expect(status).toBe(200);
    expect(vi.mocked(h.s.record).mock.calls[0][2].grants).toEqual([]);
  });

  it('will not open a question door that was never answered', async () => {
    const h = services();
    const { bot } = fly('l2', true);
    const b = await begin(h, 'l2');
    h.clock.now += 400_000;
    expect((await send(h.s, finishBody(b, bot.runs))).status).toBe(400);
    expect(h.s.record).not.toHaveBeenCalled();
  });

  it('will not open a question door with a right answer that belongs to a pad or another door', async () => {
    const h = services();
    const { bot, plan } = fly('l2', true);
    const b = await begin(h, 'l2');
    const pad = plan.targets.find((t) => t.kind === 'pad')!;
    await answerTarget(h, b, pad.id);
    h.clock.now += 400_000;
    expect((await send(h.s, finishBody(b, bot.runs))).status).toBe(400);
    // A wrong answer at the door is no help either.
    const g = services();
    const c = await begin(g, 'l2');
    const door = plan.targets.find((t) => t.kind === 'door')!;
    await send(g.s, answerBody(c, door.first, c.stored!.questions[door.first].answer + 1));
    g.clock.now += 400_000;
    expect((await send(g.s, finishBody(c, bot.runs))).status).toBe(400);
  });

  it('charges a wrong answer at a door: the run must carry the penalty, and the time includes it', async () => {
    const h = services();
    const { bot, plan } = fly('l2', true);
    const door = plan.targets.find((t) => t.kind === 'door')!;
    const b = await begin(h, 'l2');
    await answerTarget(h, b, door.id, 1);
    h.clock.now += 600_000;
    // Without the penalty the run does not add up.
    expect((await send(h.s, finishBody(b, bot.runs))).status).toBe(400);
    // With it (put in just before the answer) the run is the one the pupil flew.
    const at = bot.runs.findIndex(([code]) => code === GRANT + door.id);
    const withPenalty: [number, number][] = [...bot.runs.slice(0, at), [PENALTY, 1], ...bot.runs.slice(at)];
    const sent = await send(h.s, finishBody(b, withPenalty));
    expect(sent.status).toBe(200);
    const run = vi.mocked(h.s.record).mock.calls[0][2];
    expect(run.penalties).toBe(1);
    expect(run.grants).toEqual([door.id]);
    // The wrong answer cost 6 seconds (180 steps) on the clock.
    expect(run.steps).toBe(bot.state.finishSteps + 180);
  });

  it('refuses a penalty that no wrong answer paid for (and leaving one out)', () => {
    const plan = questionPlan(makeLevel(recipeById('l2')!));
    const door = plan.targets.find((t) => t.kind === 'door')!;
    const pad = plan.targets.find((t) => t.kind === 'pad')!;
    const run = (grants: number[], penalties: number) => ({ steps: 100, played: 100, held: 0, deaths: 0, grants, penalties });
    const stored = (answered: StoredRun['answered']): StoredRun => ({ level: 'l2', questions: [], answered });
    const rightAtDoor = { [door.first]: { value: 1, right: true } };
    expect(answersMatch(true, stored(rightAtDoor), plan, run([door.id], 0))).toBe(true);
    expect(answersMatch(true, stored(rightAtDoor), plan, run([door.id], 1))).toBe(false);
    const wrongThenRight = { [door.first]: { value: 1, right: false }, [door.first + 1]: { value: 1, right: true } };
    expect(answersMatch(true, stored(wrongThenRight), plan, run([door.id], 1))).toBe(true);
    expect(answersMatch(true, stored(wrongThenRight), plan, run([door.id], 0))).toBe(false);
    // A wrong answer at a pad costs nothing, so no penalty is allowed for it.
    const wrongAtPad = { ...rightAtDoor, [pad.first]: { value: 1, right: false } };
    expect(answersMatch(true, stored(wrongAtPad), plan, run([door.id], 0))).toBe(true);
    expect(answersMatch(true, stored(wrongAtPad), plan, run([door.id], 1))).toBe(false);
    // A pad filled by an answer needs a right answer at that pad.
    expect(answersMatch(true, stored(rightAtDoor), plan, run([door.id, pad.id], 0))).toBe(false);
    expect(answersMatch(true, stored({ ...rightAtDoor, [pad.first + 2]: { value: 1, right: true } }), plan, run([door.id, pad.id], 0))).toBe(true);
    // Something that is not a door or pad of this mine.
    expect(answersMatch(true, stored(rightAtDoor), plan, run([door.id, 63], 0))).toBe(false);
    // No maths: no grants, no penalties.
    expect(answersMatch(false, null, plan, run([], 0))).toBe(true);
    expect(answersMatch(false, null, plan, run([door.id], 0))).toBe(false);
    expect(answersMatch(false, null, plan, run([], 1))).toBe(false);
    // Maths but the list has gone: not accepted.
    expect(answersMatch(true, null, plan, run([], 0))).toBe(false);
  });

  it('refuses inputs that were edited into something that does not finish', async () => {
    const h = services();
    const b = await begin(h, 'l1', false);
    h.clock.now += 400_000;
    expect((await send(h.s, { ...finishBody(b, [], false), inputs: '0x600' })).status).toBe(400);
    expect((await send(h.s, { ...finishBody(b, [], false), inputs: '' })).status).toBe(400);
    expect(h.s.record).not.toHaveBeenCalled();
  });

  it('refuses inputs that are not readable', async () => {
    const h = services();
    const b = await begin(h, 'l1', false);
    expect((await send(h.s, { ...finishBody(b, [], false), inputs: 'banana' })).status).toBe(400);
    expect((await send(h.s, { ...finishBody(b, [], false), inputs: 5 })).status).toBe(400);
    expect(h.s.record).not.toHaveBeenCalled();
  });

  it('refuses a time that is faster than the real time since the seed was handed out', async () => {
    const h = services();
    const { bot } = fly('l1', false);
    const b = await begin(h, 'l1', false);
    h.clock.now += 2000;
    expect((await send(h.s, finishBody(b, bot.runs, false))).status).toBe(400);
    expect(h.s.record).not.toHaveBeenCalled();
  });

  it('refuses a bad stamp, a stamp for another mine, mode, or maths choice, and another pupil’s stamp', async () => {
    const h = services();
    const { bot } = fly('l1', false);
    const b = await begin(h, 'l1', false);
    h.clock.now += 400_000;
    expect((await send(h.s, { ...finishBody(b, bot.runs, false), stamp: 'made-up' })).status).toBe(400);
    expect((await send(h.s, { ...finishBody(b, bot.runs, false), level: 'l1:hard' })).status).toBe(400);
    expect((await send(h.s, { ...finishBody(b, bot.runs, false), mode: 'free' })).status).toBe(400);
    expect((await send(h.s, finishBody(b, bot.runs, true))).status).toBe(400);
    expect((await send(h.s, finishBody(b, bot.runs, false), 'other-token')).status).toBe(400);
    expect((await send(h.s, { ...finishBody(b, bot.runs, false), seed: 'made-up' })).status).toBe(400);
    expect(h.s.record).not.toHaveBeenCalled();
  });

  it('refuses a run for the practice mine', async () => {
    const h = services();
    const b = await begin(h, 'l1', false);
    expect((await send(h.s, { ...finishBody(b, [], false), level: 'practice' })).status).toBe(400);
  });

  it('refuses an old seed', async () => {
    const h = services();
    const { bot } = fly('l1', false);
    const b = await begin(h, 'l1', false);
    h.clock.now += 7 * 3600 * 1000;
    expect((await send(h.s, finishBody(b, bot.runs, false))).status).toBe(400);
  });

  it('passes on "already saved" when the same run is sent twice', async () => {
    const h = services({ record: vi.fn(async () => ({ ok: true as const, value: 'duplicate' as const })) });
    const { bot } = fly('l1', false);
    const b = await begin(h, 'l1', false);
    h.clock.now += 400_000;
    const { status, body } = await send(h.s, finishBody(b, bot.runs, false));
    expect(status).toBe(200);
    expect(body.result).toBe('duplicate');
  });

  it('asks for a break past the daily limit, and says busy when the database is away', async () => {
    const { bot } = fly('l1', false);
    const run = async (result: 'too-many' | 'busy' | 'refused') => {
      const h = services({ record: vi.fn(async () => ({ ok: false as const, why: result })) });
      const b = await begin(h, 'l1', false);
      h.clock.now += 400_000;
      return (await send(h.s, finishBody(b, bot.runs, false))).status;
    };
    expect(await run('too-many')).toBe(429);
    expect(await run('busy')).toBe(503);
    expect(await run('refused')).toBe(400);
    const h = services({ loadRun: async () => 'busy' });
    const { bot: botTwo } = fly('l2', true);
    const b = await begin(h, 'l2');
    h.clock.now += 400_000;
    expect((await send(h.s, finishBody(b, botTwo.runs))).status).toBe(503);
  });

  it('every mine’s pretend pilot, answering right, is accepted (steady flight)', async () => {
    for (const id of ['l1', 'l2', 'l3', 'l4']) {
      const h = services();
      const { bot, plan } = fly(id, true);
      const b = await begin(h, id);
      for (const t of plan.targets) if (bot.runs.some(([code]) => code === GRANT + t.id)) await answerTarget(h, b, t.id);
      h.clock.now += 1_200_000;
      const { status } = await send(h.s, finishBody(b, bot.runs));
      expect(status, id).toBe(200);
      expect(vi.mocked(h.s.record).mock.calls[0][2].steps, id).toBe(bot.state.finishSteps);
    }
  });
});

describe('the teacher’s game switch', () => {
  it('starts nothing while the game is switched off for the class', async () => {
    const { s, runs } = services({ settings: async () => ({ enabled: false, maths: 'choose' as const }) });
    const { status, body } = await send(s, startBody());
    expect(status).toBe(403);
    expect(body.code).toBe('game-off');
    expect(body.error).toMatch(/not switched on/);
    expect(runs.size).toBe(0);
    expect(s.runsToday).toBeDefined();
  });
});

describe('points and achievements for a saved run', () => {
  async function finishWith(value: 'first' | 'best' | 'saved' | 'duplicate', over: Partial<Services> = {}) {
    const h = services({ record: vi.fn(async () => ({ ok: true as const, value })), ...over });
    const { bot } = fly('l1', false);
    const b = await begin(h, 'l1', false);
    h.clock.now += 400_000;
    const sent = await send(h.s, finishBody(b, bot.runs, false));
    return { h, sent, bot };
  }

  it('gives 2 points for a first finish, and checks achievements', async () => {
    const { h, sent } = await finishWith('first');
    expect(sent.status).toBe(200);
    expect(h.s.awardPoints).toHaveBeenCalledTimes(1);
    expect(h.s.awardPoints).toHaveBeenCalledWith('pupil-1', 2, 'mine-first:l1');
    expect(h.s.progressChanged).toHaveBeenCalledWith('pupil-1');
  });

  it('gives 1 point for a better time, once a day for each mine', async () => {
    const { h } = await finishWith('best');
    const [, points, once] = vi.mocked(h.s.awardPoints).mock.calls[0];
    expect(points).toBe(1);
    expect(once).toMatch(/^mine-best:l1:\d{4}-\d{2}-\d{2}$/);
  });

  it('gives nothing for a slower time, but still checks achievements (answers count towards some)', async () => {
    const { h } = await finishWith('saved');
    expect(h.s.awardPoints).not.toHaveBeenCalled();
    expect(h.s.progressChanged).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a run saved before', async () => {
    const { h, sent } = await finishWith('duplicate');
    expect(sent.body.result).toBe('duplicate');
    expect(h.s.awardPoints).not.toHaveBeenCalled();
    expect(h.s.progressChanged).not.toHaveBeenCalled();
  });

  it('keeps the run even if the points or achievements cannot be updated', async () => {
    const { sent } = await finishWith('first', {
      awardPoints: async () => { throw new Error('down'); },
      progressChanged: async () => { throw new Error('down'); },
    });
    expect(sent.status).toBe(200);
    expect(sent.body.result).toBe('first');
  });

  it('works out the medal itself and gives it to the database and back', async () => {
    const { h, sent, bot } = await finishWith('first');
    const medal = vi.mocked(h.s.record).mock.calls[0][3];
    expect(medal).toBe(medalFor('l1', bot.state.finishSteps));
    expect(sent.body.medal).toBe(medal);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- mine` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('mine');
    expect(readFileSync(resolve('supabase/functions/mine/index.ts'), 'utf8')).toBe(built);
  });
});

