import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld } from '../../../shared/mine/engine';
import { encodeInputs, GRANT, PENALTY } from '../../../shared/mine/inputs';
import { makeLevel, recipeById } from '../../../shared/mine/level';
import { questionPlan, type MathsContext } from '../../../shared/mine/maths';
import { makeHandler, type Services, type StoredRun } from './handler';

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
const GRANTS_OF = (plan: ReturnType<typeof questionPlan>) => NEEDED(plan).flatMap((n) => Array(n.rights).fill(n.id) as number[]).sort((a, b) => a - b);

describe('the mine server function', () => {
  it('refuses anyone who is not signed in, and runs, answers or stamps that are not theirs', async () => {
    expect((await send(services().s, startBody(), null)).status).toBe(401);
    expect((await send(services().s, startBody(), 'fake')).status).toBe(401);
    expect((await send(services().s, { action: 'delete' })).status).toBe(400);
    expect((await send(services().s, startBody({ level: 'practice' }))).status).toBe(400);

    // Answers: bad stamp, another pupil, wrong mine, a seed that never had maths, an old seed, a bad slot.
    const h = services();
    const b = await begin(h);
    const right = b.stored!.questions[0].answer;
    expect((await send(h.s, { ...answerBody(b, 0, right), stamp: 'made-up' })).status).toBe(400);
    expect((await send(h.s, answerBody(b, 0, right), 'other-token')).status).toBe(400);
    expect((await send(h.s, { ...answerBody(b, 0, right), level: 'l3' })).status).toBe(400);
    expect((await send(h.s, answerBody(await begin(h, 'l2', false), 0, 1))).status).toBe(400);
    expect((await send(h.s, answerBody(b, 999, 1))).status).toBe(400);
    expect((await send(h.s, answerBody(b, -1, 1))).status).toBe(400);
    expect(h.recorded).toHaveLength(0);
    h.clock.now += 7 * 3600 * 1000;
    expect((await send(h.s, answerBody(b, 0, right))).status).toBe(400);

    // Finishing: bad stamp, another mine, mode, maths choice, another pupil, a made-up seed, a time faster than real, a door never answered.
    const g = services();
    const { bot } = fly('l1', false);
    const c = await begin(g, 'l1', false);
    g.clock.now += 2000;
    expect((await send(g.s, finishBody(c, bot.runs, false))).status).toBe(400);
    g.clock.now += 400_000;
    expect((await send(g.s, { ...finishBody(c, bot.runs, false), stamp: 'made-up' })).status).toBe(400);
    expect((await send(g.s, { ...finishBody(c, bot.runs, false), level: 'l1:hard' })).status).toBe(400);
    expect((await send(g.s, { ...finishBody(c, bot.runs, false), mode: 'free' })).status).toBe(400);
    expect((await send(g.s, finishBody(c, bot.runs, true))).status).toBe(400);
    expect((await send(g.s, finishBody(c, bot.runs, false), 'other-token')).status).toBe(400);
    expect((await send(g.s, { ...finishBody(c, bot.runs, false), seed: 'made-up' })).status).toBe(400);
    const two = fly('l2', true);
    const d = await begin(g, 'l2');
    g.clock.now += 400_000;
    expect((await send(g.s, finishBody(d, two.bot.runs))).status).toBe(400);
    expect(g.s.record).not.toHaveBeenCalled();
  });

  it('marks a wrong answer wrong and tells the right one, and counts an answer sent twice once', async () => {
    const h = services();
    const b = await begin(h);
    const right = b.stored!.questions[0].answer;
    expect((await send(h.s, answerBody(b, 0, right))).body).toEqual({ correct: true, answer: right });
    const again = await send(h.s, answerBody(b, 0, right));
    expect(again.body).toEqual({ correct: true, answer: right });
    expect(h.recorded).toHaveLength(1);
    expect(h.recorded[0].answers[0]).toMatchObject({ key: b.stored!.questions[0].factKey, correct: true });
    const other = b.stored!.questions[1].answer;
    expect((await send(h.s, answerBody(b, 1, other + 1))).body).toEqual({ correct: false, answer: other });
    expect(h.recorded[1].answers[0].correct).toBe(false);
    // A different answer to a slot already answered is turned away.
    expect((await send(h.s, answerBody(b, 1, other))).status).toBe(400);
    expect(h.runs.get(b.reply.seed)!.answered['1'].right).toBe(false);
  });

  it('replays the inputs itself (ignoring a claimed time), charges a wrong door answer, and saves a run sent twice once', async () => {
    const h = services();
    const { bot, plan } = fly('l2', true);
    const b = await begin(h, 'l2');
    await answerWhatTheRunNeeds(h, b, plan);
    h.clock.now += 400_000;
    const { status, body } = await send(h.s, { ...finishBody(b, bot.runs), steps: 1, time: 1, finishSteps: 1 });
    expect(status).toBe(200);
    expect(body.result).toBe('first');
    const run = vi.mocked(h.s.record).mock.calls[0][2];
    expect(run.steps).toBe(bot.state.finishSteps);
    expect([...run.grants].sort((x, y) => x - y)).toEqual(GRANTS_OF(plan));

    // A wrong answer at a door must be paid for in the run, and costs 6 seconds (180 steps).
    const door = plan.targets.find((t) => t.kind === 'door')!;
    const g = services();
    const c = await begin(g, 'l2');
    await answerWhatTheRunNeeds(g, c, plan, door.id);
    g.clock.now += 600_000;
    expect((await send(g.s, finishBody(c, bot.runs))).status).toBe(400);
    const at = bot.runs.findIndex(([code]) => code === GRANT + door.id);
    const withPenalty: [number, number][] = [...bot.runs.slice(0, at), [PENALTY, 1], ...bot.runs.slice(at)];
    expect((await send(g.s, finishBody(c, withPenalty))).status).toBe(200);
    const paid = vi.mocked(g.s.record).mock.calls[0][2];
    expect(paid.penalties).toBe(1);
    expect(paid.steps).toBe(bot.state.finishSteps + 180);

    // The same run sent twice reports "already saved".
    const dup = services({ record: vi.fn(async () => ({ ok: true as const, value: 'duplicate' as const })) });
    const e = await begin(dup, 'l2');
    await answerWhatTheRunNeeds(dup, e, plan);
    dup.clock.now += 400_000;
    expect((await send(dup.s, finishBody(e, bot.runs))).body.result).toBe('duplicate');
  });

  it('accepts every mine’s pretend pilot answering right (steady flight)', async () => {
    for (const id of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']) {
      const h = services();
      const { bot, plan } = fly(id, true);
      const b = await begin(h, id);
      for (const t of plan.targets) {
        const used = bot.runs.filter(([code]) => code === GRANT + t.id).length;
        if (used) await answerTarget(h, b, t.id, 0, used);
      }
      h.clock.now += 1_200_000;
      const { status } = await send(h.s, finishBody(b, bot.runs));
      expect(status, id).toBe(200);
      expect(vi.mocked(h.s.record).mock.calls[0][2].steps, id).toBe(bot.state.finishSteps);
    }
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

