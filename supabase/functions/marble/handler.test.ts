import { describe, expect, it, vi } from 'vitest';
import { botRun } from '../../../shared/marble/bot';
import { courseById } from '../../../shared/marble/courses';
import { encodeInputs } from '../../../shared/marble/inputs';
import { doorsForSeed } from '../../../shared/marble/maths';
import { marbleStampText } from '../../../shared/marble/save';
import type { Question } from '../../../shared/maths/skillPack';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type Services, type StoredRun } from './handler';

const NOW = 1_792_000_000_000;
const COURSE = 'boulder-beach';
const course = courseById(COURSE)!;
/** The reference run for a seed: through the tunnel whose door is open. */
const botFor = (seed: string, questions: Question[] | null = null) =>
  botRun(course, { mode: 'up', openDoors: doorsForSeed(course, seed, questions) });

/** A pretend stamper: not secure, just stable, so the tests can build a good stamp. */
const fakeStamp = async (text: string) => `stamp(${text})`;

/** A pretend database for the question lists, so a start, answers and a save can be tested together. */
function services(over: Partial<Services> = {}) {
  const runs = new Map<string, StoredRun>();
  const clock = { now: NOW };
  const recorded: { once: string; answers: { key: string; correct: boolean }[] }[] = [];
  const s: Services = {
    now: () => clock.now,
    randomHex: (bytes) => 'ab'.repeat(bytes),
    stamp: fakeStamp,
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : token === 'other-token' ? 'student-2' : null)),
    record: vi.fn(async () => ({ ok: true as const, value: 'best' as const })),
    random: () => 0.5,
    settings: async () => ({ maths: 'choose' as const, rescue: true }),
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
  };
  return { s, runs, clock, recorded };
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

/** Starts a maths run and plays it with the bot; the clock is moved on past the bot's time. */
async function played() {
  const m = services();
  const { body } = await send(m.s, { action: 'start', course: COURSE, mode: 'up', maths: true });
  const stored = m.runs.get(body.seed)!;
  const bot = botFor(body.seed, stored.questions);
  m.clock.now = NOW + (bot.state.steps / 60 + 30) * 1000;
  return { ...m, body, stored, bot, report: { action: 'save', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, inputs: encodeInputs(bot.runs) } };
}

describe('the marble server function', () => {
  it('replays a run itself, saves the time it worked out (not the one claimed), and counts its gate answer once when sent twice', async () => {
    const { s, recorded, report, stored, bot } = await played();
    const { status, body } = await send(s, { ...report, steps: 1, time: 1 });
    expect(status).toBe(200);
    expect(body.steps).toBe(bot.state.finishSteps);
    const [player, , run, extra] = vi.mocked(s.record).mock.calls[0];
    expect(player).toBe('student-1');
    expect(run.steps).toBe(bot.state.finishSteps);
    expect(extra.maths).toBe(true);
    expect(recorded[0].answers).toEqual([expect.objectContaining({ key: stored.questions[0].factKey, correct: true })]);
    await send(s, report);
    expect(recorded).toHaveLength(1);
  });

  it('refuses a save it cannot trust: not signed in, edited inputs, too quick, another student’s seed, too many requests', async () => {
    const { s, report, clock } = await played();
    expect((await send(s, report, null)).status).toBe(401);
    expect((await send(s, { ...report, inputs: '0x600' })).status).toBe(400);
    expect((await send(s, report, 'other-token')).status).toBe(400);
    expect((await send(s, { ...report, stamp: await fakeStamp(marbleStampText('student-1', COURSE, 'down', report.seed)) })).status).toBe(400);
    clock.now = NOW + 2000;
    expect((await send(s, report)).status).toBe(400);
    expect(s.record).not.toHaveBeenCalled();
    const handle = makeHandler(services().s);
    let last = 200;
    for (let i = 0; i <= MAX_REQUESTS_PER_MINUTE; i++) last = (await handle(post({ action: 'start', course: COURSE, mode: 'up' }))).status;
    expect(last).toBe(429);
  });

  it('marks pit-stop answers once: right, wrong, sent twice, a slot that does not exist, another student’s seed', async () => {
    const { s, recorded, body, stored } = await played();
    const slots = (body.pits as { slot: number }[]).map((p) => p.slot);
    const answer = (slot: number, value: unknown, token = 'good-token') =>
      send(s, { action: 'answer', course: COURSE, mode: 'up', seed: body.seed, stamp: body.stamp, slot, answer: value, ms: 1500 }, token);
    const right = (slot: number) => stored.questions[slot].answer as number;
    // The browser is told the questions but never an answer.
    expect(JSON.stringify(body)).not.toContain('"answer"');
    expect((await answer(slots[0], right(slots[0]))).body).toEqual({ right: true, answer: right(slots[0]) });
    expect((await answer(slots[1], right(slots[1]) + 1)).body).toEqual({ right: false, answer: right(slots[1]) });
    expect((await answer(slots[0], right(slots[0]))).status).toBe(400);
    expect((await answer(99, 1)).status).toBe(400);
    expect((await answer(slots[2], right(slots[2]), 'other-token')).status).toBe(400);
    expect(recorded.map((r) => r.answers[0])).toEqual([
      expect.objectContaining({ key: stored.questions[slots[0]].factKey, correct: true }),
      expect.objectContaining({ key: stored.questions[slots[1]].factKey, correct: false }),
    ]);
  });
});
