import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryServices, type MemoryOptions } from '../../../shared/beanstalk/memoryServices';
import type { FactStats } from '../../../shared/maths/leitner';
import { bondKey, replay, targetOf, type Round, type Tap } from '../../../shared/beanstalk/round';
import { makeHandler } from './handler';

// Kiwi's Beanstalk's server tests (docs/TESTING.md: the game has 8 tests in all; these are the fairness ones).

/**
 * Every pair right first time, after one wrong pair if `wobble`. The pairs are those of the round the server made and kept
 * (`start` sends it). Slow by default (over the juniors' quick time), so the records don't climb a box a go and the stage
 * stays put in the tests that are not about it; `ms` 2500 is quick.
 */
function goodTaps(round: Round, wobble = false, ms = 12_000): Tap[] {
  const taps: Tap[] = [];
  for (let r = replay(round, taps); !r.done; r = replay(round, taps)) {
    const [a] = r.onScreen;
    const wrong = r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] !== targetOf(round, a));
    if (wobble && taps.length === 0 && wrong !== undefined) taps.push({ a, b: wrong, ms: 4000 });
    taps.push({ a, b: r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] === targetOf(round, a))!, ms });
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
  const begin = async (who: string) => (await send(who, { action: 'start' })).body as { seed: number; round: Round };
  const start = async (who: string) => (await begin(who)).seed;
  return { send, start, begin, log, services, hours: (h: number) => (clock += h * 3_600_000) };
}

it('finishes only a pupil’s own, finished challenge, once, and records each go as a bond to 10', async () => {
  const { send, begin, log } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);
  expect((await send('pupil-a', { action: 'start' })).body).toMatchObject({ code: 'no-child' });
  await send('pupil-a', { action: 'choose', child: 'jill' });
  await send('pupil-b', { action: 'choose', child: 'jack' });

  const { seed, round } = await begin('pupil-a');
  const taps = goodTaps(round, true);
  // Half a challenge, a leaf that isn't floating, and another pupil's challenge are all refused.
  expect((await send('pupil-a', { action: 'finish', seed, taps: taps.slice(0, 4) })).body).toMatchObject({ code: 'not-done' });
  expect((await send('pupil-a', { action: 'finish', seed, taps: [{ a: 0, b: 19, ms: 900 }] })).status).toBe(400);
  expect((await send('pupil-b', { action: 'finish', seed, taps })).body).toMatchObject({ code: 'not-yours' });

  expect((await send('pupil-a', { action: 'finish', seed, taps })).body).toMatchObject({ daysDone: 1, leafChanged: 0 });
  expect((await send('pupil-a', { action: 'finish', seed, taps })).body).toMatchObject({ code: 'ended' });
  // One answer a go (its first tap), once, the wrong pair counted against the first leaf's pair; the right pair after it isn't scored (maths review R5).
  expect(log.answers).toHaveLength(1);
  const [{ once, answers }] = log.answers;
  expect(once).toBe(`beanstalk:${seed}`);
  expect(answers).toHaveLength(10);
  expect(answers.every((a) => /^bond10:[1-5]\+[5-9]$/.test(a.key))).toBe(true);
  expect(answers[0]).toMatchObject({ key: bondKey(round.leaves[taps[0].a]), correct: false });

  // With the teacher's switch off, nothing happens.
  const off = setup({ settings: () => ({ enabled: false, dots: true }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });
});

it('changes one leaf a NZ day by the server’s clock, whatever the browser sends, and gives the egg on day 30', async () => {
  const { send, begin, hours, services, log } = setup();
  await send('pupil-a', { action: 'choose', child: 'jack' });
  const finish = async () => {
    const { seed, round } = await begin('pupil-a');
    return (await send('pupil-a', { action: 'finish', seed, taps: goodTaps(round), daysDone: 29, leafChanged: 9, egg: true })).body;
  };
  expect(await finish()).toEqual({ daysDone: 1, lastLeafDay: '2026-11-04', leafChanged: 0, egg: false, help: 0, stage: 0, moved: 0 });
  hours(2); // 11 pm: still the same NZ day, so just for fun
  expect(await finish()).toMatchObject({ daysDone: 1, leafChanged: null });
  hours(2); // 1 am on the 5th in New Zealand, though still the 4th in UTC
  expect(await finish()).toEqual({ daysDone: 2, lastLeafDay: '2026-11-05', leafChanged: 1, egg: false, help: 1, stage: 0, moved: 0 });
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ child: 'jack', daysDone: 2, today: '2026-11-05', help: 1, dots: true });
  expect(log.eggs).toEqual([]);
  services.data.players['pupil-a'].daysDone = 29;
  hours(24);
  expect(await finish()).toMatchObject({ daysDone: 30, leafChanged: 9, egg: true });
  expect(log.eggs).toEqual(['pupil-a']); // the hub gives Kiwi's Golden Egg achievement

  // The egg is only a reward now: the sum stays where the child is (S21). On bonds to 20 the round is the child's own sum, with
  // two older pairs last, from the saved stage whatever the browser sends, and each go is recorded against its own sum.
  services.data.players['pupil-a'].stage = 1;
  hours(24);
  const { seed, round } = await begin('pupil-a');
  expect(round.pairTargets!.slice(0, 8).every((t) => t === 20) && round.pairTargets!.slice(8).every((t) => t === 10)).toBe(true);
  expect((await send('pupil-a', { action: 'finish', seed, taps: goodTaps(round, true), target: 10, stage: 3 })).body).toMatchObject({ daysDone: 31, leafChanged: 0, stage: 1 });
  const keys = log.answers.at(-1)!.answers.map((a) => a.key);
  expect(keys.filter((k) => k.startsWith('bond20:'))).toHaveLength(8);
  expect(keys.filter((k) => k.startsWith('bond10:'))).toHaveLength(2);
});

/** Every go starts with a wrong pair (where one floats): a hard day. */
function hardTaps(round: Round): Tap[] {
  const taps: Tap[] = [];
  for (let r = replay(round, taps); !r.done; r = replay(round, taps)) {
    const [a] = r.onScreen;
    const wrong = r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] !== targetOf(round, a));
    if (wrong !== undefined) taps.push({ a, b: wrong, ms: 3000 });
    taps.push({ a, b: r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] === targetOf(round, a))!, ms: 2500 });
  }
  return taps;
}

it('moves a child’s dots on the day’s first finish only, saves them, and starts them full on a new sum (maths review R6)', async () => {
  let known: FactStats[] = [];
  const { send, begin, hours, services } = setup({ facts: () => known });
  await send('pupil-a', { action: 'choose', child: 'jack' });
  const finish = async (taps: (round: Round) => Tap[]) => {
    const { seed, round } = await begin('pupil-a');
    return (await send('pupil-a', { action: 'finish', seed, taps: taps(round) })).body;
  };
  const saved = () => services.data.players['pupil-a'];
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ help: 0 });
  // Day 1 good, then a hard replay the same day: nothing moves. Day 2 good: full to small.
  expect(await finish(goodTaps)).toMatchObject({ help: 0 });
  expect(await finish(hardTaps)).toMatchObject({ leafChanged: null, help: 0 });
  hours(24);
  expect(await finish(goodTaps)).toMatchObject({ leafChanged: 1, help: 1 });
  expect(saved()).toMatchObject({ help: 1, goodInRow: 0, daysDone: 2 });
  // A hard day brings a step back, and the load shows it.
  hours(24);
  expect(await finish(hardTaps)).toMatchObject({ help: 0 });
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ help: 0, daysDone: 3 });
  // The egg no longer changes the sum, so the dots go on as they were. A move to a new sum (S21) starts them full again, even for a child on no dots.
  Object.assign(saved(), { daysDone: 29, help: 2, goodInRow: 1 });
  hours(24);
  expect(await finish(goodTaps)).toMatchObject({ egg: true, help: 2, moved: 0 });
  Object.assign(saved(), { help: 2, goodInRow: 1, goodDays: 1 });
  known = [1, 2, 3, 4, 5].map((n) => ({ key: bondKey(n), attempts: 4, correct: 4, avgMs: 2000, box: 3, lastSeen: 0, quickDays: [] }));
  hours(24);
  expect(await finish(goodTaps)).toMatchObject({ stage: 1, moved: 1, help: 0 });
  expect(saved()).toMatchObject({ stage: 1, help: 0, goodInRow: 0, goodDays: 0, stageDays: 0 });
});

it('keeps which kinds of go a pupil has seen: unreadable kinds are refused and a kind saved twice is kept once', async () => {
  const { send } = setup();
  expect((await send('pupil-a', { action: 'load' })).body.seen).toEqual([]);
  expect((await send('pupil-a', { action: 'seen', kinds: ['zoom'] })).status).toBe(400);
  expect((await send('pupil-a', { action: 'seen', kinds: 'missing' })).status).toBe(400);
  await send('pupil-a', { action: 'seen', kinds: ['missing'] });
  expect((await send('pupil-a', { action: 'seen', kinds: ['missing'] })).body.seen).toEqual(['missing']);
  expect((await send('pupil-a', { action: 'load' })).body.seen).toEqual(['missing']);
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- beanstalk` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('beanstalk');
    expect(readFileSync(resolve('supabase/functions/beanstalk/index.ts'), 'utf8')).toBe(built);
  });
});
