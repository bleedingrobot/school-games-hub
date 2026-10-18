import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { botRun } from '../../../shared/marble/bot';
import { courseById } from '../../../shared/marble/courses';
import { BONUS, encodeInputs } from '../../../shared/marble/inputs';
import { doorMask, doorsForSeed, rightGemsForSeed } from '../../../shared/marble/maths';
import { marbleStampText, MARBLE_RUNS_PER_DAY } from '../../../shared/marble/save';
import type { Question } from '../../../shared/maths/skillPack';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type Services, type StoredRun } from './handler';

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
  it('needs a signed-in student', async () => {
    expect((await send(services(), { action: 'start', course: COURSE, mode: 'up' }, null)).status).toBe(401);
    expect((await send(services(), { action: 'start', course: COURSE, mode: 'up' }, 'fake')).status).toBe(401);
  });

  it('only takes POST, and answers the browser’s pre-check', async () => {
    const handle = makeHandler(services());
    expect((await handle(new Request('http://x/marble', { method: 'OPTIONS' }))).status).toBe(204);
    expect((await handle(new Request('http://x/marble', { method: 'GET' }))).status).toBe(405);
  });

  it('hands out a stamped seed for a real course', async () => {
    const { status, body } = await send(services(), { action: 'start', course: COURSE, mode: 'down' });
    expect(status).toBe(200);
    expect(body.seed).toMatch(/^m1-\d{10}-[0-9a-f]{24}$/);
    expect(body.stamp).toBe(`stamp(${marbleStampText('student-1', COURSE, 'down', body.seed)})`);
    expect((await send(services(), { action: 'start', course: 'nowhere', mode: 'up' })).status).toBe(400);
    expect((await send(services(), { action: 'start', course: COURSE, mode: 'sideways' })).status).toBe(400);
  });

  it('makes no seed when the server has no secret', async () => {
    const s = services({ stamp: async () => null });
    expect((await send(s, { action: 'start', course: COURSE, mode: 'up' })).status).toBe(500);
  });

  it('replays the inputs itself and saves the time it worked out', async () => {
    const s = services();
    const { status, body } = await send(s, await save());
    expect(status).toBe(200);
    expect(body.result).toBe('best');
    expect(body.steps).toBe(bot.state.finishSteps);
    const [player, report, run] = vi.mocked(s.record).mock.calls[0];
    expect(player).toBe('student-1');
    expect(report.course).toBe(COURSE);
    expect(run.steps).toBe(bot.state.finishSteps);
  });

  it('ignores a time the browser claims', async () => {
    const s = services();
    await send(s, await save({ steps: 1, time: 1, finishSteps: 1 }));
    expect(vi.mocked(s.record).mock.calls[0][2].steps).toBe(bot.state.finishSteps);
  });

  it('saves a run with no maths as such, with the doors that were open', async () => {
    const s = services();
    await send(s, await save());
    const [, , , extra] = vi.mocked(s.record).mock.calls[0];
    expect(extra.maths).toBe(false);
    expect(extra.doors).toBe(doorsForSeed(course, SEED, null).reduce((m, d) => m | (1 << d), 0));
    expect(extra.gems).toBe(0);
  });

  it('refuses inputs that were edited into something that does not finish', async () => {
    const s = services();
    const { status } = await send(s, await save({ inputs: '0x600' }));
    expect(status).toBe(400);
    expect(s.record).not.toHaveBeenCalled();
  });

  it('refuses inputs that are not readable', async () => {
    const s = services();
    expect((await send(s, await save({ inputs: 'banana' }))).status).toBe(400);
    expect((await send(s, await save({ inputs: 5 }))).status).toBe(400);
    expect(s.record).not.toHaveBeenCalled();
  });

  it('refuses a time that is faster than the real time since the seed was handed out', async () => {
    const s = services();
    const quick = await seedFor('student-1', 'up', 2);
    expect((await send(s, await save({ ...quick, inputs: encodeInputs(botFor(quick.seed).runs) }))).status).toBe(400);
    expect(s.record).not.toHaveBeenCalled();
  });

  it('refuses a bad stamp, a stamp for another course or mode, and another student’s stamp', async () => {
    const s = services();
    expect((await send(s, await save({ stamp: 'made-up' }))).status).toBe(400);
    const good = await seedFor();
    expect((await send(s, await save({ ...good, course: 'crown-range' }))).status).toBe(400);
    expect((await send(s, await save({ ...good, mode: 'down' }))).status).toBe(400);
    expect((await send(s, await save({}, 'student-2'))).status).toBe(400);
    expect((await send(s, await save({ seed: 'made-up' }))).status).toBe(400);
    expect(s.record).not.toHaveBeenCalled();
  });

  it('refuses an old seed', async () => {
    const s = services();
    expect((await send(s, await save(await seedFor('student-1', 'up', 7 * 3600)))).status).toBe(400);
    expect(s.record).not.toHaveBeenCalled();
  });

  it('passes on "already saved" when the same run is sent twice', async () => {
    const s = services({ record: vi.fn(async () => ({ ok: true as const, value: 'duplicate' as const })) });
    const { status, body } = await send(s, await save());
    expect(status).toBe(200);
    expect(body.result).toBe('duplicate');
  });

  it('asks for a break past the daily limit, and says busy when the database is away', async () => {
    const tooMany = services({ record: vi.fn(async () => ({ ok: false as const, why: 'too-many' as const })) });
    expect((await send(tooMany, await save())).status).toBe(429);
    const busy = services({ record: vi.fn(async () => ({ ok: false as const, why: 'busy' as const })) });
    expect((await send(busy, await save())).status).toBe(503);
    const refused = services({ record: vi.fn(async () => ({ ok: false as const, why: 'refused' as const })) });
    expect((await send(refused, await save())).status).toBe(400);
  });

  it('turns away something that is not start, answer or save', async () => {
    expect((await send(services(), { action: 'delete' })).status).toBe(400);
    expect((await send(services(), null as never)).status).toBe(400);
  });

  it('slows down a student who sends too often', async () => {
    const handle = makeHandler(services());
    let last = 200;
    for (let i = 0; i <= MAX_REQUESTS_PER_MINUTE; i++) last = (await handle(post({ action: 'start', course: COURSE, mode: 'up' }))).status;
    expect(last).toBe(429);
  });

  it('keeps the daily limit in the shared settings', () => {
    expect(MARBLE_RUNS_PER_DAY).toBe(400);
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

describe('maths: starting a run', () => {
  it('has no maths when the teacher has it off, however it is asked for', async () => {
    const { s, runs } = mathsServices({}, { maths: 'off', rescue: true });
    const { body } = await start(s, true);
    expect(body.maths).toBe(false);
    expect(body.gates[0].arrow).toBeGreaterThanOrEqual(0);
    expect(body.gates[0].question).toBeNull();
    expect(body.pits).toEqual([]);
    expect(runs.size).toBe(0);
  });

  it('asks only the students who chose it when the teacher lets them choose', async () => {
    const { s } = mathsServices();
    expect((await start(s)).body.maths).toBe(false);
    expect((await start(s, false)).body.maths).toBe(false);
    expect((await start(s, true)).body.maths).toBe(true);
  });

  it('asks everyone when the teacher says on, even a student who says no', async () => {
    const { s } = mathsServices({}, { maths: 'on', rescue: true });
    expect((await start(s, false)).body.maths).toBe(true);
  });

  it('keeps maths off if the switches or the records cannot be read', async () => {
    expect((await start(mathsServices({ settings: async () => null }).s, true)).body.maths).toBe(false);
    expect((await start(mathsServices({ mathsContext: async () => null }).s, true)).body.maths).toBe(false);
    expect((await start(mathsServices({ storeRun: async () => false }).s, true)).body.maths).toBe(false);
  });

  it('keeps the questions on the server and tells the browser the question, the signs and the doors, but never an answer', async () => {
    const { s, runs } = mathsServices();
    const { body } = await start(s, true);
    expect(body.maths).toBe(true);
    const stored = runs.get(body.seed)!;
    expect(stored.questions.length).toBeGreaterThanOrEqual(10);
    expect(body.gates).toHaveLength(course.gates.length);
    expect(body.gates[0].labels).toHaveLength(course.gates[0].tunnels.length);
    expect(body.gates[0].question.parts.length).toBeGreaterThan(0);
    expect(body.pits).toHaveLength(course.pitCount);
    expect(body.doors).toEqual(doorsForSeed(course, body.seed, stored.questions));
    const text = JSON.stringify(body);
    expect(text).not.toContain('"answer"');
    expect(text).not.toContain('factKey');
  });

  it('puts the right answer under the open door', async () => {
    const { s, runs } = mathsServices();
    const { body } = await start(s, true);
    const q = runs.get(body.seed)!.questions[0];
    const open = course.gates[0].tunnels.findIndex((t) => body.doors.includes(t.door));
    expect(body.gates[0].labels[open]).toBe(String(q.answer));
  });

  it('leaves rescue questions out when the teacher has switched them off', async () => {
    const off = await start(mathsServices({}, { maths: 'on', rescue: false }).s, true);
    expect(off.body.rescue).toBe(false);
    expect(off.body.rescues).toEqual([]);
    const on = await start(mathsServices({}, { maths: 'on', rescue: true }).s, true);
    expect(on.body.rescues.length).toBeGreaterThan(0);
  });

  it('gives a course with no gates no maths', async () => {
    const { s } = mathsServices();
    const { body } = await send(s, { action: 'start', course: 'test-easy', mode: 'up', maths: true });
    expect(body.maths).toBe(false);
    expect(body.gates).toEqual([]);
  });
});

describe('maths: answering a pit stop', () => {
  async function started() {
    const m = mathsServices();
    const { body } = await start(m.s, true);
    const stored = m.runs.get(body.seed)!;
    const slot = body.pits[0].slot as number;
    const base = { action: 'answer', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, slot };
    return { ...m, body, stored, slot, base, right: stored.questions[slot].answer };
  }

  it('marks a right answer, records it under the question\'s own key, and says what the answer was', async () => {
    const { s, recorded, base, right, stored, slot } = await started();
    const { status, body } = await send(s, { ...base, answer: right, ms: 1500 });
    expect(status).toBe(200);
    expect(body).toEqual({ right: true, answer: right });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].answers[0]).toMatchObject({ key: stored.questions[slot].factKey, correct: true, ms: 1500 });
  });

  it('marks a wrong answer wrong and still records it', async () => {
    const { s, recorded, base, right } = await started();
    const { body } = await send(s, { ...base, answer: right + 1, ms: 900 });
    expect(body).toEqual({ right: false, answer: right });
    expect(recorded[0].answers[0].correct).toBe(false);
  });

  it('marks each question once, so the answer cannot be guessed at again', async () => {
    const { s, recorded, base, right } = await started();
    expect((await send(s, { ...base, answer: right + 1 })).status).toBe(200);
    expect((await send(s, { ...base, answer: right })).status).toBe(400);
    expect(recorded).toHaveLength(1);
  });

  it('never takes less than the time it says it took, and caps a made-up long time', async () => {
    const { s, recorded, base, right } = await started();
    await send(s, { ...base, answer: right, ms: 99_999_999 });
    expect(recorded[0].answers[0]).toMatchObject({});
    expect((recorded[0].answers[0] as { ms?: number }).ms).toBeLessThanOrEqual(60_000);
  });

  it('turns away a gate question, a question that does not exist and a rescue question when rescues are off', async () => {
    const { s, base, right } = await started();
    expect((await send(s, { ...base, slot: 0, answer: right })).status).toBe(400);
    expect((await send(s, { ...base, slot: 99, answer: right })).status).toBe(400);
    expect((await send(s, { ...base, slot: 1.5, answer: right })).status).toBe(400);
    expect((await send(s, { ...base, answer: -1 })).status).toBe(400);
    expect((await send(s, { ...base, answer: 'seven' })).status).toBe(400);
    const off = mathsServices({}, { maths: 'on', rescue: false });
    const run = (await start(off.s, true)).body;
    const rescueSlot = course.gates.length + course.pitCount;
    const r = await send(off.s, { action: 'answer', course: COURSE, mode: 'up', seed: run.seed, stamp: run.stamp, slot: rescueSlot, answer: 1 });
    expect(r.status).toBe(400);
  });

  it('turns away a bad stamp, another student\'s stamp and a run that had no maths', async () => {
    const { s, base, right } = await started();
    expect((await send(s, { ...base, stamp: 'made-up', answer: right })).status).toBe(400);
    expect((await send(s, { ...base, answer: right }, 'other-token')).status).toBe(400);
    const plain = mathsServices();
    const run = (await start(plain.s)).body;
    expect((await send(plain.s, { ...base, seed: run.seed, stamp: run.stamp, answer: 1 })).status).toBe(400);
  });

  it('says busy when the database cannot be reached', async () => {
    const m = mathsServices();
    const { body } = await start(m.s, true);
    const base = { action: 'answer', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, slot: body.pits[0].slot, answer: 5 };
    const down = { ...m.s, loadRun: async () => 'busy' as const };
    expect((await send(down, base)).status).toBe(503);
    const noMark = { ...m.s, claimAnswer: async () => 'busy' as const };
    expect((await send(noMark, base)).status).toBe(503);
  });
});

describe('maths: saving a run through the gates', () => {
  async function played(wrongFirst = false) {
    const m = mathsServices();
    const { body } = await start(m.s, true);
    const stored = m.runs.get(body.seed)!;
    const bot2 = botFor(body.seed, stored.questions, wrongFirst);
    m.clock.now = NOW + (bot2.state.steps / 60 + 30) * 1000;
    return { ...m, body, stored, bot2, report: { action: 'save', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, inputs: encodeInputs(bot2.runs) } };
  }

  it('saves a run that went through the open door, as a run with maths, and records the right gate answer', async () => {
    const { s, recorded, report, stored, bot2 } = await played();
    const { status } = await send(s, report);
    expect(status).toBe(200);
    expect(vi.mocked(s.record).mock.calls[0][3].maths).toBe(true);
    expect(vi.mocked(s.record).mock.calls[0][2].steps).toBe(bot2.state.finishSteps);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].answers).toEqual([expect.objectContaining({ key: stored.questions[0].factKey, correct: true })]);
  });

  it('records a wrong answer when the first tunnel the marble rolled into was the wrong one', async () => {
    const { s, recorded, report } = await played(true);
    expect((await send(s, report)).status).toBe(200);
    expect(recorded[0].answers[0].correct).toBe(false);
  });

  it('counts a gate answer once when the run is sent twice', async () => {
    const { s, recorded, report } = await played();
    await send(s, report);
    vi.mocked(s.record).mockResolvedValueOnce({ ok: true, value: 'duplicate' });
    await send(s, report);
    expect(recorded).toHaveLength(1);
  });

  it('does not record a gate answer a second time even if the save comes back as new', async () => {
    const { s, recorded, report } = await played();
    await send(s, report);
    await send(s, report);
    expect(recorded).toHaveLength(1);
  });

  it('still saves the run when the maths records cannot be updated', async () => {
    const { s, report } = await played();
    const failing = { ...s, recordAnswers: async () => { throw new Error('down'); } };
    const response = await makeHandler(failing)(post(report));
    expect(response.status).toBe(200);
    expect(vi.mocked(s.record)).toHaveBeenCalled();
  });

  it('refuses a run whose doors do not fit the questions (it was played as if there was no maths)', async () => {
    const { s, report, body } = await played();
    const asIfOff = botFor(body.seed, null);
    const sameDoors = JSON.stringify(doorsForSeed(course, body.seed, null)) === JSON.stringify(body.doors);
    const { status } = await send(s, { ...report, inputs: encodeInputs(asIfOff.runs) });
    expect(status).toBe(sameDoors ? 200 : 400);
  });

  it('refuses a bonus input with no right pit-stop answer, and allows one with it', async () => {
    const { s, report, body, bot2, stored, clock } = await played();
    const withBonus = encodeInputs([[BONUS, 1], ...bot2.runs]);
    expect((await send(s, { ...report, inputs: withBonus })).status).toBe(400);
    const slot = body.pits[0].slot as number;
    const answerBase = { action: 'answer', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, slot };
    const wrong = await send(s, { ...answerBase, answer: stored.questions[slot].answer + 1 });
    expect(wrong.body.right).toBe(false);
    expect((await send(s, { ...report, inputs: withBonus })).status).toBe(400);
    void clock;
  });

  it('allows a bonus after a right pit-stop answer, and takes the time off', async () => {
    const { s, report, body, bot2, stored } = await played();
    const slot = body.pits[0].slot as number;
    const right = await send(s, { action: 'answer', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, slot, answer: stored.questions[slot].answer });
    expect(right.body.right).toBe(true);
    const ok = await send(s, { ...report, inputs: encodeInputs([[BONUS, 1], ...bot2.runs]) });
    expect(ok.status).toBe(200);
    expect(vi.mocked(s.record).mock.calls.at(-1)![2].steps).toBe(bot2.state.finishSteps - 120);
    // ... but only one for one right answer
    const two = await send(s, { ...report, inputs: encodeInputs([[BONUS, 1], [BONUS, 1], ...bot2.runs]) });
    expect(two.status).toBe(400);
  });
});

describe('maths: number gems', () => {
  const glacier = courseById('glacier-run')!;

  async function playedGlacier() {
    const m = mathsServices();
    const { body } = await send(m.s, { action: 'start', course: 'glacier-run', mode: 'up', maths: true });
    const stored = m.runs.get(body.seed)!;
    const doors = doorsForSeed(glacier, body.seed, stored.questions);
    const right = rightGemsForSeed(glacier, body.seed, stored.questions);
    const bot2 = botRun(glacier, { mode: 'up', openDoors: doors, rightGems: right, answers: false });
    m.clock.now = NOW + (bot2.state.steps / 60 + 30) * 1000;
    return { ...m, body, stored, right, bot2, report: { action: 'save', course: 'glacier-run', mode: 'up', seed: body.seed, stamp: body.stamp, inputs: encodeInputs(bot2.runs) } };
  }

  it('hands the browser each trail\'s question, what every gem carries and which are right, never an answer', async () => {
    const m = mathsServices();
    const { body } = await send(m.s, { action: 'start', course: 'glacier-run', mode: 'up', maths: true });
    expect(body.gems).toHaveLength(glacier.gems.length);
    expect(body.gems[0].groups).toHaveLength(glacier.gems[0].groups.length);
    expect(body.rightGems).toEqual(rightGemsForSeed(glacier, body.seed, m.runs.get(body.seed)!.questions));
    expect(JSON.stringify(body.gems)).not.toContain('"answer"');
  });

  it('has no gems with maths off', async () => {
    const { body } = await send(mathsServices({}, { maths: 'off', rescue: true }).s, { action: 'start', course: 'glacier-run', mode: 'up', maths: true });
    expect(body.gems).toEqual([]);
    expect(body.rightGems).toEqual([]);
  });

  it('replays a run with the right gems, saves its time with their seconds off, and keeps which gems they were', async () => {
    const { s, report, right, bot2 } = await playedGlacier();
    const { status } = await send(s, report);
    expect(status).toBe(200);
    const call = vi.mocked(s.record).mock.calls[0];
    expect(call[2].steps).toBe(bot2.state.finishSteps);
    expect(call[3].gems).toBe(doorMask(right));
    expect(call[2].gems).toBe(bot2.state.gemsTaken.length);
  });

  it('records nothing for a gem (gems are never recorded)', async () => {
    const { s, recorded, report, stored } = await playedGlacier();
    await send(s, report);
    // Only the gate answers are recorded: one per gate.
    expect(recorded[0].answers).toHaveLength(glacier.gates.length);
    const keys = recorded[0].answers.map((a) => a.key);
    expect(keys.length).toBeLessThanOrEqual(stored.questions.length);
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
