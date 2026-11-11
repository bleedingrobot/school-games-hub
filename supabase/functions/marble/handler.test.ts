import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { botRun } from '../../../shared/marble/bot';
import { courseById } from '../../../shared/marble/courses';
import { encodeInputs } from '../../../shared/marble/inputs';
import { doorsForSeed } from '../../../shared/marble/maths';
import { marbleStampText } from '../../../shared/marble/save';
import type { Question } from '../../../shared/maths/skillPack';
import { makeHandler, type Services, type StoredRun } from './handler';

const NOW = 1_792_000_000_000;
const COURSE = 'boulder-beach';
const course = courseById(COURSE)!;
/** The reference run for a seed (no maths): through the tunnel whose door is open. */
const botFor = (seed: string, questions: Question[] | null = null, wrongFirst = false) =>
  botRun(course, { mode: 'up', openDoors: doorsForSeed(course, seed, questions), wrongFirst });
/** The seed `seedFor` hands out with the default age. */
const SEED_AGE = 200;
const SEED = `m1-${String(Math.floor(NOW / 1000) - SEED_AGE).padStart(10, '0')}-${'ab'.repeat(12)}`;
const bot = botFor(SEED);
const GOOD_INPUTS = encodeInputs(bot.runs);

/** A pretend stamper: not secure, just stable, so the tests can build a good stamp. */
const fakeStamp = async (text: string) => `stamp(${text})`;

function services(over: Partial<Services> = {}) {
  const s: Services = {
    now: () => NOW,
    randomHex: (bytes) => 'ab'.repeat(bytes),
    stamp: fakeStamp,
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : token === 'other-token' ? 'student-2' : null)),
    record: vi.fn(async () => ({ ok: true as const, value: 'best' as const })),
    random: () => 0.5,
    settings: async () => ({ maths: 'off' as const, rescue: true }),
    mathsContext: async () => null,
    storeRun: async () => true,
    loadRun: async () => null,
    claimAnswer: async () => true,
    recordAnswers: async () => {},
    ...over,
  };
  return s;
}

function post(body: unknown, token: string | null = 'good-token') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/marble', { method: 'POST', headers, body: JSON.stringify(body) });
}

async function send(s: Services, body: unknown, token: string | null = 'good-token') {
  const response = await makeHandler(s)(post(body, token));
  return { status: response.status, body: await response.json() };
}

/** A seed handed out `agoSeconds` before the fake "now", with a stamp for `player`. */
async function seedFor(player = 'student-1', mode: 'up' | 'down' = 'up', agoSeconds = SEED_AGE) {
  const made = Math.floor(NOW / 1000) - Math.ceil(agoSeconds);
  const seed = `m1-${String(made).padStart(10, '0')}-${'ab'.repeat(12)}`;
  return { seed, stamp: await fakeStamp(marbleStampText(player, COURSE, mode, seed)) };
}

const save = async (over: Record<string, unknown> = {}, who = 'student-1') => ({
  action: 'save',
  course: COURSE,
  mode: 'up',
  inputs: GOOD_INPUTS,
  ...(await seedFor(who)),
  ...over,
});


describe('the marble server function', () => {
  it('refuses a student who is not signed in, a bad method, edited or unreadable inputs, a too-fast time, and a bad, wrong-course, other-student or old stamp', async () => {
    expect((await send(services(), { action: 'start', course: COURSE, mode: 'up' }, null)).status).toBe(401);
    expect((await send(services(), { action: 'start', course: COURSE, mode: 'up' }, 'fake')).status).toBe(401);
    const handle = makeHandler(services());
    expect((await handle(new Request('http://x/marble', { method: 'GET' }))).status).toBe(405);
    const s = services();
    expect((await send(s, await save({ inputs: '0x600' }))).status).toBe(400);
    expect((await send(s, await save({ inputs: 'banana' }))).status).toBe(400);
    expect((await send(s, await save({ inputs: 5 }))).status).toBe(400);
    const quick = await seedFor('student-1', 'up', 2);
    expect((await send(s, await save({ ...quick, inputs: encodeInputs(botFor(quick.seed).runs) }))).status).toBe(400);
    expect((await send(s, await save({ stamp: 'made-up' }))).status).toBe(400);
    const good = await seedFor();
    expect((await send(s, await save({ ...good, course: 'crown-range' }))).status).toBe(400);
    expect((await send(s, await save({ ...good, mode: 'down' }))).status).toBe(400);
    expect((await send(s, await save({}, 'student-2'))).status).toBe(400);
    expect((await send(s, await save({ seed: 'made-up' }))).status).toBe(400);
    expect((await send(s, await save(await seedFor('student-1', 'up', 7 * 3600)))).status).toBe(400);
    expect(s.record).not.toHaveBeenCalled();
  });

  it('hands out a stamped seed, replays the inputs itself and saves its own time, and passes on "already saved" for a repeat', async () => {
    const started = await send(services(), { action: 'start', course: COURSE, mode: 'down' });
    expect(started.status).toBe(200);
    expect(started.body.seed).toMatch(/^m1-\d{10}-[0-9a-f]{24}$/);
    expect(started.body.stamp).toBe(`stamp(${marbleStampText('student-1', COURSE, 'down', started.body.seed)})`);
    expect((await send(services(), { action: 'start', course: 'nowhere', mode: 'up' })).status).toBe(400);

    const s = services();
    const { status, body } = await send(s, await save({ steps: 1, time: 1, finishSteps: 1 }));
    expect(status).toBe(200);
    expect(body.result).toBe('best');
    expect(body.steps).toBe(bot.state.finishSteps);
    const [player, report, run] = vi.mocked(s.record).mock.calls[0];
    expect(player).toBe('student-1');
    expect(report.course).toBe(COURSE);
    expect(run.steps).toBe(bot.state.finishSteps);

    const again = services({ record: vi.fn(async () => ({ ok: true as const, value: 'duplicate' as const })) });
    expect((await send(again, await save())).body.result).toBe('duplicate');
  });
});

/** A pretend database for the question lists, so a start and a save can be tested together. */
function mathsServices(over: Partial<Services> = {}, settings = { maths: 'choose' as 'off' | 'choose' | 'on', rescue: true }) {
  const runs = new Map<string, StoredRun>();
  const clock = { now: NOW };
  const recorded: { once: string; answers: { key: string; correct: boolean }[] }[] = [];
  const s = services({
    now: () => clock.now,
    settings: async () => settings,
    mathsContext: async () => ({ facts: [], settings: {} }),
    storeRun: async (_p, seed, rescue, questions) => {
      runs.set(seed, { rescue, questions, answered: {} });
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
    ...over,
  });
  return { s, runs, clock, recorded };
}

const start = (s: Services, maths?: boolean) => send(s, { action: 'start', course: COURSE, mode: 'up', ...(maths === undefined ? {} : { maths }) });


describe('maths: marking and saving', () => {
  async function started() {
    const m = mathsServices();
    const { body } = await start(m.s, true);
    const stored = m.runs.get(body.seed)!;
    const slot = body.pits[0].slot as number;
    const base = { action: 'answer', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, slot };
    return { ...m, body, stored, slot, base, right: stored.questions[slot].answer };
  }

  it('marks a pit-stop answer right or wrong once only, and refuses other students, bad stamps and questions that are not pit stops', async () => {
    const { s, recorded, base, right } = await started();
    const wrong = await send(s, { ...base, answer: right + 1, ms: 900 });
    expect(wrong.body).toEqual({ right: false, answer: right });
    expect(recorded[0].answers[0].correct).toBe(false);
    expect((await send(s, { ...base, answer: right })).status).toBe(400);
    expect(recorded).toHaveLength(1);

    const fresh = await started();
    const ok = await send(fresh.s, { ...fresh.base, answer: fresh.right, ms: 1500 });
    expect(ok.body).toEqual({ right: true, answer: fresh.right });
    expect(fresh.recorded[0].answers[0]).toMatchObject({ key: fresh.stored.questions[fresh.slot].factKey, correct: true, ms: 1500 });

    const f = await started();
    expect((await send(f.s, { ...f.base, stamp: 'made-up', answer: f.right })).status).toBe(400);
    expect((await send(f.s, { ...f.base, answer: f.right }, 'other-token')).status).toBe(400);
    expect((await send(f.s, { ...f.base, slot: 0, answer: f.right })).status).toBe(400);
    expect((await send(f.s, { ...f.base, slot: 99, answer: f.right })).status).toBe(400);
    expect((await send(f.s, { ...f.base, answer: 'seven' })).status).toBe(400);
    expect(f.recorded).toHaveLength(0);
  });

  it('never sends an answer to the browser, puts the right answer under the open door, and has no maths when the teacher has it off', async () => {
    const { s, runs } = mathsServices();
    const { body } = await start(s, true);
    expect(body.maths).toBe(true);
    const stored = runs.get(body.seed)!;
    const text = JSON.stringify(body);
    expect(text).not.toContain('"answer"');
    expect(text).not.toContain('factKey');
    const open = course.gates[0].tunnels.findIndex((t) => body.doors.includes(t.door));
    expect(body.gates[0].labels[open]).toBe(String(stored.questions[0].answer));
    const off = mathsServices({}, { maths: 'off', rescue: true });
    expect((await start(off.s, true)).body.maths).toBe(false);
    expect(off.runs.size).toBe(0);
  });

  it('saves a run through the gates, records the gate answer once even when sent twice, records a wrong tunnel as wrong, and refuses time off at a stop with no right answer', async () => {
    const m = mathsServices();
    const { body } = await start(m.s, true);
    const stored = m.runs.get(body.seed)!;
    const bot2 = botFor(body.seed, stored.questions);
    m.clock.now = NOW + (bot2.state.steps / 60 + 30) * 1000;
    const report = { action: 'save', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, inputs: encodeInputs(bot2.runs) };
    expect((await send(m.s, report)).status).toBe(200);
    expect(vi.mocked(m.s.record).mock.calls[0][3].maths).toBe(true);
    expect(vi.mocked(m.s.record).mock.calls[0][2].steps).toBe(bot2.state.finishSteps);
    expect(m.recorded[0].answers).toEqual([expect.objectContaining({ key: stored.questions[0].factKey, correct: true })]);
    await send(m.s, report);
    expect(m.recorded).toHaveLength(1);

    const w = mathsServices();
    const wb = (await start(w.s, true)).body;
    const wrongBot = botFor(wb.seed, w.runs.get(wb.seed)!.questions, true);
    w.clock.now = NOW + (wrongBot.state.steps / 60 + 30) * 1000;
    expect((await send(w.s, { action: 'save', course: COURSE, mode: 'up', seed: wb.seed, stamp: wb.stamp, inputs: encodeInputs(wrongBot.runs) })).status).toBe(200);
    expect(w.recorded[0].answers[0].correct).toBe(false);

    const t = mathsServices();
    const tb = (await start(t.s, true)).body;
    const tq = t.runs.get(tb.seed)!.questions;
    const answering = botRun(course, { mode: 'up', openDoors: doorsForSeed(course, tb.seed, tq), answers: true });
    t.clock.now = NOW + (answering.state.steps / 60 + 30) * 1000;
    const claim = { action: 'save', course: COURSE, mode: 'up', seed: tb.seed, stamp: tb.stamp, inputs: encodeInputs(answering.runs) };
    expect((await send(t.s, claim)).status).toBe(400);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('marble');
    expect(readFileSync(resolve('supabase/functions/marble/index.ts'), 'utf8')).toBe(built);
  });
});
