import { describe, expect, it, vi } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld } from '../../../shared/mine/engine';
import { encodeInputs } from '../../../shared/mine/inputs';
import { makeLevel, recipeById } from '../../../shared/mine/level';
import { questionPlan, type MathsContext } from '../../../shared/mine/maths';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type Services, type StoredRun } from './handler';

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

/** Answers every slot of one door or pad the way a pupil would: wrong ones first, then a right one. */
async function answerTarget(h: ReturnType<typeof services>, b: Awaited<ReturnType<typeof begin>>, targetId: number, wrong = 0, rights = 1) {
  const plan = questionPlan(makeLevel(recipeById(b.level)!));
  const target = plan.targets.find((t) => t.id === targetId)!;
  for (let i = 0; i < wrong; i++) await send(h.s, answerBody(b, target.first + i, b.stored!.questions[target.first + i].answer + 1));
  for (let k = 0; k < rights; k++) {
    const slot = target.first + wrong + k;
    await send(h.s, answerBody(b, slot, b.stored!.questions[slot].answer));
  }
}

/** The right answers a pretend pilot's run needs: one for each question door and the reactor's three. */
const NEEDED = (plan: ReturnType<typeof questionPlan>) =>
  plan.targets.filter((t) => t.kind !== 'pad').map((t) => ({ id: t.id, rights: t.kind === 'reactor' ? 3 : 1 }));
async function answerWhatTheRunNeeds(h: ReturnType<typeof services>, b: Awaited<ReturnType<typeof begin>>, plan: ReturnType<typeof questionPlan>, wrongAt?: number) {
  for (const n of NEEDED(plan)) await answerTarget(h, b, n.id, n.id === wrongAt ? 1 : 0, n.rights);
}

describe('the mine server function', () => {
  it('marks answers once: right, wrong, sent twice, a slot that does not exist, another pupil’s seed', async () => {
    const h = services();
    expect((await send(h.s, startBody(), null)).status).toBe(401);
    const b = await begin(h);
    // The browser is told what to show but never an answer.
    expect(JSON.stringify(b.reply)).not.toContain('"answer"');
    const right = (slot: number) => b.stored!.questions[slot].answer;
    expect((await send(h.s, answerBody(b, 0, right(0)))).body).toEqual({ correct: true, answer: right(0) });
    expect((await send(h.s, answerBody(b, 1, right(1) + 1))).body).toEqual({ correct: false, answer: right(1) });
    // The same answer again gets the same reply; a different one is turned away.
    expect((await send(h.s, answerBody(b, 0, right(0)))).body).toEqual({ correct: true, answer: right(0) });
    expect((await send(h.s, answerBody(b, 1, right(1)))).status).toBe(400);
    expect((await send(h.s, answerBody(b, 999, 1))).status).toBe(400);
    expect((await send(h.s, answerBody(b, 2, right(2)), 'other-token')).status).toBe(400);
    expect(h.recorded.map((r) => r.answers[0].correct)).toEqual([true, false]);
  });

  it('replays a run itself, saves the time it worked out (not the one claimed), and only opens doors that were answered', async () => {
    const h = services();
    const { bot, plan } = fly('l2', true);
    const b = await begin(h, 'l2');
    h.clock.now += 400_000;
    expect((await send(h.s, finishBody(b, bot.runs))).status).toBe(400);
    await answerWhatTheRunNeeds(h, b, plan);
    const { status, body } = await send(h.s, { ...finishBody(b, bot.runs), steps: 1, time: 1 });
    expect(status).toBe(200);
    expect(body.steps).toBe(bot.state.finishSteps);
    const [player, report, run] = vi.mocked(h.s.record).mock.calls[0];
    expect([player, report.level, run.steps]).toEqual(['pupil-1', 'l2', bot.state.finishSteps]);
    expect(h.s.awardPoints).toHaveBeenCalledWith('pupil-1', 2, 'mine-first:l2');
  });

  it('refuses a run it cannot trust: edited inputs, too quick, another pupil’s stamp, too many requests, maths the teacher switched off', async () => {
    const h = services();
    const { bot } = fly('l1', false);
    const b = await begin(h, 'l1', false);
    expect((await send(h.s, finishBody(b, bot.runs, false))).status).toBe(400);
    h.clock.now += 400_000;
    expect((await send(h.s, { ...finishBody(b, bot.runs, false), inputs: '0x600' })).status).toBe(400);
    expect((await send(h.s, finishBody(b, bot.runs, false), 'other-token')).status).toBe(400);
    expect((await send(h.s, finishBody(b, bot.runs, true))).status).toBe(400);
    expect(h.s.record).not.toHaveBeenCalled();
    expect((await send(services({}, 'off').s, startBody({ maths: true }))).status).toBe(403);
    const handle = makeHandler(services().s);
    let last = 200;
    for (let i = 0; i <= MAX_REQUESTS_PER_MINUTE; i++) last = (await handle(post(startBody({ maths: false })))).status;
    expect(last).toBe(429);
  });
});
