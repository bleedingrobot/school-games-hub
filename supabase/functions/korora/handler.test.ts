import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newStats } from '../../../shared/maths/leitner';
import { memoryServices, type MemoryOptions } from '../../../shared/korora/memoryServices';
import type { Tap } from '../../../shared/korora/play';
import { FAIR_GOES, GUIDED_KEY, levelKeys, showRound, type Round } from '../../../shared/korora/round';
import { makeHandler } from './handler';

// Penguin Pairs' server tests (the game has 8 tests in all; these are the 2 fairness ones).

/** Every go right first time, after one wrong pick on the first go if `wobble`. */
function goodTaps(round: Round, wobble = false): Tap[] {
  return showRound(round).flatMap((g, i) => [
    ...(wobble && i === 0 ? [{ pick: g.choices.find((c) => c !== g.answer)!, ms: 4000 }] : []),
    { pick: g.answer, ms: 2500 },
  ]);
}

function setup(over: MemoryOptions = {}) {
  // 9 pm NZ time on 4 Nov 2026 (8 am UTC).
  let clock = Date.UTC(2026, 10, 4, 8);
  let seed = 0.1;
  const log = { answers: [], fish: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed += 0.137) % 1, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/korora', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const start = async (who: string) => (await send(who, { action: 'start' })).body.round as Round;
  return { send, start, log, services, hours: (h: number) => (clock += h * 3_600_000) };
}

it('finishes only a pupil’s own, finished challenge, once, and records each fact once (the first pick of its first go)', async () => {
  const { send, start, log, services } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);

  const round = await start('pupil-a');
  expect(round.goes[0].key).toBe(GUIDED_KEY); // the very first challenge starts with double 2
  const taps = goodTaps(round, true);
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: taps.slice(0, 4) })).body).toMatchObject({ code: 'not-done' });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: [{ pick: 999, ms: 900 }] })).status).toBe(400);
  expect((await send('pupil-b', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'not-yours' });

  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ daysDone: 1, pebbleChanged: 0, level: 1 });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'ended' });
  expect(log.answers).toHaveLength(1);
  const [{ once, answers }] = log.answers;
  expect(once).toBe(`korora:${round.seed}`);
  // Each fact once: double 2 wrong (its first pick was wrong), the other doubles right, and no fact twice.
  const keys = [...new Set(round.goes.map((g) => g.key))];
  expect(answers.map((a) => [a.key, a.correct])).toEqual(keys.map((k) => [k, k !== GUIDED_KEY]));

  // Records from anywhere on the hub that show doubles to 5 secure move the pupil on to halves, and they never drop back.
  services.data.facts['pupil-a'] = levelKeys(1).map((key) => ({ ...newStats(key), box: 2 }));
  const halves = await start('pupil-a');
  expect(halves.level).toBe(2);
  expect(halves.goes[0].key).not.toBe(GUIDED_KEY);
  await send('pupil-a', { action: 'finish', seed: halves.seed, taps: goodTaps(halves) });
  services.data.facts['pupil-a'] = [];
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ level: 2, help: 'fade' });

  const off = setup({ settings: () => ({ enabled: false, help: 'fade' }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });
});

it('changes one pebble a NZ day by the server’s clock, with fair-or-not recorded on gold days and the gold dancing shoes on day 30', async () => {
  const { send, start, hours, services, log } = setup();
  const finish = async () => {
    const round = await start('pupil-a');
    const reply = (await send('pupil-a', { action: 'finish', seed: round.seed, taps: goodTaps(round), daysDone: 29, goldenFish: true })).body;
    return { round, reply };
  };
  expect((await finish()).reply).toEqual({ daysDone: 1, lastPebbleDay: '2026-11-04', pebbleChanged: 0, goldenFish: false, shoesWon: null, level: 1, levelBefore: 1 });
  hours(2); // 11 pm: still the same NZ day, so just for fun
  expect((await finish()).reply).toMatchObject({ daysDone: 1, pebbleChanged: null });
  hours(2); // 1 am on the 5th in New Zealand, though still the 4th in UTC
  const day2 = await finish();
  expect(day2.reply).toMatchObject({ daysDone: 2, lastPebbleDay: '2026-11-05', pebbleChanged: 1 });
  expect(day2.round.goes.some((g) => g.key.startsWith('oddeven:'))).toBe(false);
  services.data.players['pupil-a'].daysDone = 29;
  hours(24);
  const last = await finish();
  expect(last.round.gold).toBe(true);
  expect(last.round.goes.slice(-FAIR_GOES).every((g) => g.key.startsWith('oddeven:'))).toBe(true);
  expect(log.answers.at(-1)!.answers.filter((a) => a.key.startsWith('oddeven:'))).toHaveLength(FAIR_GOES);
  expect(last.reply).toMatchObject({ daysDone: 30, pebbleChanged: 9, goldenFish: true, shoesWon: 'gold' });
  expect(log.fish).toEqual(['pupil-a']); // the hub gives Two-Shoes' gold dancing shoes achievement
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- korora` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('korora');
    expect(readFileSync(resolve('supabase/functions/korora/index.ts'), 'utf8')).toBe(built);
  });
});
