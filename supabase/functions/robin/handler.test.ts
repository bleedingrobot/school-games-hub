import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryServices, type MemoryOptions } from '../../../shared/robin/memoryServices';
import type { Tap } from '../../../shared/robin/play';
import { GUIDED_KEY, showRound, type Round } from '../../../shared/robin/round';
import { makeHandler } from './handler';

// Robin’s Berry Basket’s server tests (the game has more in shared/robin; these are the fairness ones).

/** Every go right first time, after one wrong count on the first go if `wobble`. */
function goodTaps(round: Round, wobble = false): Tap[] {
  return showRound(round).flatMap((g, i) => [
    ...(wobble && i === 0 ? [{ pick: g.answer + 1, ms: 4000 }] : []),
    { pick: g.answer, ms: 2500 },
  ]);
}

function setup(over: MemoryOptions = {}) {
  // 9 pm NZ time on 4 Nov 2026 (8 am UTC).
  let clock = Date.UTC(2026, 10, 4, 8);
  let seed = 0.1;
  const log = { answers: [], feasts: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed += 0.137) % 1, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/robin', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const start = async (who: string) => (await send(who, { action: 'start' })).body.round as Round;
  return { send, start, log, services, hours: (h: number) => (clock += h * 3_600_000) };
}

it('finishes only a pupil’s own, finished challenge, once, and records each fact once (the first count of its first go)', async () => {
  const { send, start, log } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);

  const round = await start('pupil-a');
  expect(round.goes[0].key).toBe(GUIDED_KEY); // the very first challenge starts with the guided give-4, with full help
  const taps = goodTaps(round, true);
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: taps.slice(0, 4) })).body).toMatchObject({ code: 'not-done' });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: [{ pick: 999, ms: 900 }] })).status).toBe(400);
  expect((await send('pupil-b', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'not-yours' });

  const done = (await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body;
  expect(done).toMatchObject({ daysDone: 1, changed: 0, feast: false });
  expect(done.firstRight).toBe(round.goes.length - 1); // the wobble on the first go
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'ended' });
  expect(log.answers).toHaveLength(1);
  const [{ once, answers }] = log.answers;
  expect(once).toBe(`robin:${round.seed}`);
  // Each fact once: the guided fact wrong (its first count was wrong), the others right, and no fact twice.
  const keys = [...new Set(round.goes.map((g) => g.key))];
  expect(answers.map((a) => [a.key, a.correct])).toEqual(keys.map((k) => [k, k !== GUIDED_KEY]));

  // Kinds of go seen: a bad kind is unreadable, a good one is saved (twice with no change), and a child's records fill it in.
  expect((await send('pupil-a', { action: 'seen', kinds: ['nonsense'] })).status).toBe(400);
  expect((await send('pupil-a', { action: 'seen', kinds: 'howmany' })).status).toBe(400);
  expect((await send('pupil-a', { action: 'seen', kinds: ['howmany'] })).body).toEqual({ seen: ['howmany'] });
  expect((await send('pupil-a', { action: 'seen', kinds: ['howmany'] })).body).toEqual({ seen: ['howmany'] });
  expect((await send('pupil-a', { action: 'load' })).body.seen).toEqual(['give', 'howmany']); // give: its first go was answered above
  expect((await send('pupil-b', { action: 'load' })).body.seen).toEqual([]);

  const off = setup({ settings: () => ({ enabled: false, help: 'fade' }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });
});

it('changes one basket a NZ day by the server’s clock, and tells the hub on the Golden Berry Feast (day 30)', async () => {
  const { send, start, hours, services, log } = setup();
  const finish = async () => {
    const round = await start('pupil-a');
    return (await send('pupil-a', { action: 'finish', seed: round.seed, taps: goodTaps(round), daysDone: 29, feast: true })).body;
  };
  expect(await finish()).toMatchObject({ daysDone: 1, lastDay: '2026-11-04', changed: 0, feast: false });
  hours(2); // 11 pm: still the same NZ day, so just for fun
  expect(await finish()).toMatchObject({ daysDone: 1, changed: null });
  hours(2); // 1 am on the 5th in New Zealand, though still the 4th in UTC
  expect(await finish()).toMatchObject({ daysDone: 2, lastDay: '2026-11-05', changed: 1 });
  services.data.players['pupil-a'].daysDone = 29;
  hours(24);
  expect(await finish()).toMatchObject({ daysDone: 30, changed: 9, feast: true });
  expect(log.feasts).toEqual(['pupil-a']); // the hub gives the Golden Berry Feast achievement
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- robin` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('robin');
    expect(readFileSync(resolve('supabase/functions/robin/index.ts'), 'utf8')).toBe(built);
  });
});
