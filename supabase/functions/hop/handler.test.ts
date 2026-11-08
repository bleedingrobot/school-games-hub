import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newStats } from '../../../shared/maths/leitner';
import { memoryServices, type MemoryOptions } from '../../../shared/hop/memoryServices';
import type { Tap } from '../../../shared/hop/play';
import { showRound, stepKeys, type Round } from '../../../shared/hop/round';
import { makeHandler } from './handler';

// Hop's Glow-worm Pond's server tests (the game has 8 tests in all; these are the 2 fairness ones).

/** Every hop right first time, after one wrong glow-worm on the first hop if `wobble`. */
function goodTaps(round: Round, wobble = false): Tap[] {
  return showRound(round).flatMap((h, i) => [
    ...(wobble && i === 0 ? [{ pick: h.choices.find((c) => c !== h.answer)!, ms: 4000 }] : []),
    { pick: h.answer, ms: 2500 },
  ]);
}

function setup(over: MemoryOptions = {}) {
  // 9 pm NZ time on 4 Nov 2026 (8 am UTC).
  let clock = Date.UTC(2026, 10, 4, 8);
  let seed = 0.1;
  const log = { answers: [], jars: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed += 0.137) % 1, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/hop', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const start = async (who: string) => (await send(who, { action: 'start' })).body.round as Round;
  return { send, start, log, services, hours: (h: number) => (clock += h * 3_600_000) };
}

it('finishes only a pupil’s own, finished challenge, once, and records each hop once against its skip-counting fact', async () => {
  const { send, start, log, services, hours } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);
  // Show me first: the kinds of hop a child has seen are remembered per pupil, a bad kind is refused, and load returns them.
  expect((await send('pupil-a', { action: 'seen', kinds: ['nonsense'] })).status).toBe(400);
  expect((await send('pupil-a', { action: 'seen', kinds: ['back'] })).body).toMatchObject({ seen: ['back'] });
  expect((await send('pupil-a', { action: 'seen', kinds: ['offset'] })).body.seen).toEqual(['back', 'offset']);
  expect((await send('pupil-a', { action: 'load' })).body.seen).toEqual(['back', 'offset']);
  expect((await send('pupil-b', { action: 'load' })).body.seen).toEqual([]);

  const round = await start('pupil-a');
  // The browser's word for the round counts for nothing: the server checks the taps against the round it kept.
  const taps = goodTaps(round, true);
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: taps.slice(0, 4) })).body).toMatchObject({ code: 'not-done' });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: [{ pick: 999, ms: 900 }] })).status).toBe(400);
  expect((await send('pupil-b', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'not-yours' });

  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ daysDone: 1, padChanged: 0, step: 10 });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'ended' });
  // One answer a hop, once: the first hop wrong (its first glow-worm was wrong), the rest right.
  expect(log.answers).toHaveLength(1);
  const [{ once, answers }] = log.answers;
  expect(once).toBe(`hop:${round.seed}`);
  expect(answers.map((a) => [a.key, a.correct])).toEqual(round.hops.map((h, i) => [h.key, i > 0]));

  // Records from anywhere on the hub that show 10s secure move the pupil on to 5s only at the next day's first finish:
  // a replay the same day keeps the step. They never drop back.
  services.data.facts['pupil-a'] = stepKeys(10).map((key) => ({ ...newStats(key), box: 2 }));
  const replay = await start('pupil-a');
  expect(replay.step).toBe(10);
  expect((await send('pupil-a', { action: 'finish', seed: replay.seed, taps: goodTaps(replay) })).body).toMatchObject({ padChanged: null, step: 10 });
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ step: 10 });
  hours(24);
  const fives = await start('pupil-a');
  expect(fives.step).toBe(10);
  expect((await send('pupil-a', { action: 'finish', seed: fives.seed, taps: goodTaps(fives) })).body).toMatchObject({ padChanged: 1, step: 5 });
  services.data.facts['pupil-a'] = [];
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ step: 5 });

  // With the teacher's switch off, nothing happens.
  const off = setup({ settings: () => ({ enabled: false, labels: true }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });
});

it('changes one pad a NZ day by the server’s clock, whatever the browser sends, with counting back and the jar on gold days', async () => {
  const { send, start, hours, services, log } = setup();
  const finish = async () => {
    const round = await start('pupil-a');
    const reply = (await send('pupil-a', { action: 'finish', seed: round.seed, taps: goodTaps(round), daysDone: 29, padChanged: 9, jar: true })).body;
    return { round, reply };
  };
  expect((await finish()).reply).toEqual({ daysDone: 1, lastPadDay: '2026-11-04', padChanged: 0, jar: false, step: 10, stepBefore: 10, topSecure: false });
  hours(2); // 11 pm: still the same NZ day, so just for fun
  expect((await finish()).reply).toMatchObject({ daysDone: 1, padChanged: null });
  hours(2); // 1 am on the 5th in New Zealand, though still the 4th in UTC
  const day2 = await finish();
  expect(day2.reply).toMatchObject({ daysDone: 2, lastPadDay: '2026-11-05', padChanged: 1 });
  expect(day2.round.hops.some((h) => h.key.includes(':back:'))).toBe(false);
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ daysDone: 2, today: '2026-11-05', labels: true });
  expect(log.jars).toEqual([]);
  services.data.players['pupil-a'].daysDone = 29;
  hours(24);
  const last = await finish();
  expect(last.round.gold).toBe(true);
  expect(last.round.hops.slice(-3).every((h) => h.key.includes(':back:'))).toBe(true);
  expect(last.reply).toMatchObject({ daysDone: 30, padChanged: 9, jar: true });
  expect(log.jars).toEqual(['pupil-a']); // the hub gives Hop's Golden Glow Jar achievement
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- hop` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('hop');
    expect(readFileSync(resolve('supabase/functions/hop/index.ts'), 'utf8')).toBe(built);
  });
});
