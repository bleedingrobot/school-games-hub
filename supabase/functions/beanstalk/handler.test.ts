import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryServices, type MemoryOptions } from '../../../shared/beanstalk/memoryServices';
import { bondKey, makeRound, replay, TARGET, type Tap } from '../../../shared/beanstalk/round';
import { makeHandler } from './handler';

// Kiwi's Beanstalk's server tests (docs/TESTING.md: the game has 8 tests in all; these are the 2 fairness ones).

/** Every pair right first time, after one wrong pair if `wobble`. */
function goodTaps(seed: number, wobble = false): Tap[] {
  const round = makeRound(seed);
  const taps: Tap[] = [];
  for (let r = replay(round, taps); !r.done; r = replay(round, taps)) {
    const [a] = r.onScreen;
    const wrong = r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] !== TARGET);
    if (wobble && taps.length === 0 && wrong !== undefined) taps.push({ a, b: wrong, ms: 4000 });
    taps.push({ a, b: r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] === TARGET)!, ms: 2500 });
  }
  return taps;
}

function setup(over: MemoryOptions = {}) {
  // 9 pm NZ time on 4 Nov 2026 (8 am UTC).
  let clock = Date.UTC(2026, 10, 4, 8);
  let seed = 0.1;
  const log = { answers: [], eggs: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed += 0.137) % 1, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/beanstalk', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const start = async (who: string) => (await send(who, { action: 'start' })).body.seed as number;
  return { send, start, log, services, hours: (h: number) => (clock += h * 3_600_000) };
}

it('finishes only a pupil’s own, finished challenge, once, and records each pair as a bond to 10', async () => {
  const { send, start, log } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);
  expect((await send('pupil-a', { action: 'start' })).body).toMatchObject({ code: 'no-child' });
  await send('pupil-a', { action: 'choose', child: 'jill' });
  await send('pupil-b', { action: 'choose', child: 'jack' });

  const seed = await start('pupil-a');
  const taps = goodTaps(seed, true);
  // Half a challenge, a leaf that isn't floating, and another pupil's challenge are all refused.
  expect((await send('pupil-a', { action: 'finish', seed, taps: taps.slice(0, 4) })).body).toMatchObject({ code: 'not-done' });
  expect((await send('pupil-a', { action: 'finish', seed, taps: [{ a: 0, b: 19, ms: 900 }] })).status).toBe(400);
  expect((await send('pupil-b', { action: 'finish', seed, taps })).body).toMatchObject({ code: 'not-yours' });

  expect((await send('pupil-a', { action: 'finish', seed, taps })).body).toMatchObject({ daysDone: 1, leafChanged: 0 });
  expect((await send('pupil-a', { action: 'finish', seed, taps })).body).toMatchObject({ code: 'ended' });
  // One answer a pair tapped, once, the wrong pair counted against the first leaf's pair.
  expect(log.answers).toHaveLength(1);
  const [{ once, answers }] = log.answers;
  expect(once).toBe(`beanstalk:${seed}`);
  expect(answers).toHaveLength(11);
  expect(answers.every((a) => /^bond10:[1-5]\+[5-9]$/.test(a.key))).toBe(true);
  expect(answers[0]).toMatchObject({ key: bondKey(makeRound(seed).leaves[taps[0].a]), correct: false });

  // With the teacher's switch off, nothing happens.
  const off = setup({ settings: () => ({ enabled: false, dots: true }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });
});

it('changes one leaf a NZ day by the server’s clock, whatever the browser sends, and gives the egg on day 30', async () => {
  const { send, start, hours, services, log } = setup();
  await send('pupil-a', { action: 'choose', child: 'jack' });
  const finish = async () => {
    const seed = await start('pupil-a');
    return (await send('pupil-a', { action: 'finish', seed, taps: goodTaps(seed), daysDone: 29, leafChanged: 9, egg: true })).body;
  };
  expect(await finish()).toEqual({ daysDone: 1, lastLeafDay: '2026-11-04', leafChanged: 0, egg: false });
  hours(2); // 11 pm: still the same NZ day, so just for fun
  expect(await finish()).toMatchObject({ daysDone: 1, leafChanged: null });
  hours(2); // 1 am on the 5th in New Zealand, though still the 4th in UTC
  expect(await finish()).toEqual({ daysDone: 2, lastLeafDay: '2026-11-05', leafChanged: 1, egg: false });
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ child: 'jack', daysDone: 2, today: '2026-11-05', dots: true });
  expect(log.eggs).toEqual([]);
  services.data.players['pupil-a'].daysDone = 29;
  hours(24);
  expect(await finish()).toMatchObject({ daysDone: 30, leafChanged: 9, egg: true });
  expect(log.eggs).toEqual(['pupil-a']); // the hub gives Kiwi's Golden Egg achievement
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- beanstalk` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('beanstalk');
    expect(readFileSync(resolve('supabase/functions/beanstalk/index.ts'), 'utf8')).toBe(built);
  });
});
