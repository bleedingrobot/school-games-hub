import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { memoryServices, type MemoryOptions } from '../../../shared/lizard/memoryServices';
import type { Tap } from '../../../shared/lizard/play';
import { GUIDED_KEY, showRound, type Go, type Round } from '../../../shared/lizard/round';
import { makeHandler } from './handler';

// Lizard’s Bundles server tests (the game has more in shared/lizard; these are the fairness ones).

const rightPick = (g: Go) => g.answer;
const wrongPick = (g: Go) => (g.choices.length ? g.choices.find((c) => c !== g.answer)! : g.answer + 1);

/** Every go right first time, after one wrong tap on the first go if `wobble`. */
function goodTaps(round: Round, wobble = false): Tap[] {
  return showRound(round).flatMap((g, i) => [...(wobble && i === 0 ? [{ pick: wrongPick(g), ms: 4000 }] : []), { pick: rightPick(g), ms: 2500 }]);
}

function setup(over: MemoryOptions = {}) {
  // 9 pm NZ time on 8 Nov 2026 (8 am UTC).
  let clock = Date.UTC(2026, 10, 8, 8);
  let seed = 0.1;
  const log = { answers: [], dens: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed += 0.137) % 1, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/lizard', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const start = async (who: string) => (await send(who, { action: 'start' })).body.round as Round;
  return { send, start, log, services, hours: (h: number) => (clock += h * 3_600_000) };
}

it('finishes only a pupil’s own, finished challenge, once; records each key once; changes one bundle a NZ day and tells the hub on day 30', async () => {
  const { send, start, log, hours, services } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);

  const round = await start('pupil-a');
  expect(round.goes[0].key).toBe(GUIDED_KEY); // the very first challenge starts with tying ten sticks, labelled mat
  const taps = goodTaps(round, true);
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: taps.slice(0, 4) })).body).toMatchObject({ code: 'not-done' });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: [{ pick: 99999, ms: 900 }] })).status).toBe(400);
  expect((await send('pupil-b', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'not-yours' });

  const done = (await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body;
  expect(done).toMatchObject({ daysDone: 1, bundleChanged: 0, goldenRaft: false });
  expect(done.firstRight).toBe(round.goes.length - 1); // the wobble on the first go
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'ended' });
  expect(log.answers).toHaveLength(1);
  const [{ once, answers }] = log.answers;
  expect(once).toBe(`lizard:${round.seed}`);
  const keys = [...new Set(round.goes.map((g) => g.key))];
  expect(answers.map((a) => [a.key, a.correct])).toEqual(keys.map((k) => [k, k !== GUIDED_KEY]));

  // The same NZ day again is just for fun; the next NZ day (1 am on the 9th, still the 8th in UTC) counts.
  const again = await start('pupil-a');
  expect((await send('pupil-a', { action: 'finish', seed: again.seed, taps: goodTaps(again) })).body).toMatchObject({ daysDone: 1, bundleChanged: null });
  hours(4);
  const next = await start('pupil-a');
  expect((await send('pupil-a', { action: 'finish', seed: next.seed, taps: goodTaps(next) })).body).toMatchObject({ daysDone: 2, lastDay: '2026-11-09', bundleChanged: 1 });
  services.data.players['pupil-a'].daysDone = 29;
  hours(24);
  const last = await start('pupil-a');
  expect((await send('pupil-a', { action: 'finish', seed: last.seed, taps: goodTaps(last) })).body).toMatchObject({ daysDone: 30, bundleChanged: 9, goldenRaft: true });
  expect(log.dens).toEqual(['pupil-a']); // the hub gives the Golden Raft achievement

  const off = setup({ settings: () => ({ enabled: false, help: 'fade' }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });

  // The deployable file is up to date with the code (run `npm run build:functions -- lizard` if this fails).
  {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('lizard');
    expect(readFileSync(resolve('supabase/functions/lizard/handler.ts'), 'utf8').length).toBeGreaterThan(0);
    expect(readFileSync(resolve('supabase/functions/lizard/index.ts'), 'utf8')).toBe(built);
  }
});
