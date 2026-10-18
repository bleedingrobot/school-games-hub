import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { botRun } from '../../../shared/marble/bot';
import { courseById } from '../../../shared/marble/courses';
import { encodeInputs } from '../../../shared/marble/inputs';
import { marbleStampText, MARBLE_RUNS_PER_DAY } from '../../../shared/marble/save';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type Services } from './handler';

const NOW = 1_792_000_000_000;
const COURSE = 'boulder-beach';
const bot = botRun(courseById(COURSE)!, { mode: 'up' });
const GOOD_INPUTS = encodeInputs(bot.runs);
const BOT_SECONDS = bot.state.steps / 60;

/** A pretend stamper: not secure, just stable, so the tests can build a good stamp. */
const fakeStamp = async (text: string) => `stamp(${text})`;

function services(over: Partial<Services> = {}) {
  const s: Services = {
    now: () => NOW,
    randomHex: (bytes) => 'ab'.repeat(bytes),
    stamp: fakeStamp,
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : token === 'other-token' ? 'student-2' : null)),
    record: vi.fn(async () => ({ ok: true as const, value: 'best' as const })),
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
async function seedFor(player = 'student-1', mode: 'up' | 'down' = 'up', agoSeconds = BOT_SECONDS + 20) {
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
    expect((await send(s, await save(quick))).status).toBe(400);
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

  it('turns away something that is not start or save', async () => {
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

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('marble');
    expect(readFileSync(resolve('supabase/functions/marble/index.ts'), 'utf8')).toBe(built);
  });
});
