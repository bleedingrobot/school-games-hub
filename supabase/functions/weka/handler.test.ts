import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newStats } from '../../../shared/maths/leitner';
import { memoryServices, type MemoryOptions } from '../../../shared/weka/memoryServices';
import type { Tap } from '../../../shared/weka/play';
import { BACK_GOES, GUIDED_KEY, levelKeys, showRound, type Round } from '../../../shared/weka/round';
import { makeHandler } from './handler';

// Weka’s Stepping Stones’ server tests (the game has 8 tests in all; these are the 2 fairness ones).

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
  const log = { answers: [], baskets: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed += 0.137) % 1, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/weka', {
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
  expect(round.goes[0].key).toBe(GUIDED_KEY); // the very first challenge starts with 9 + 2, with full help
  expect(round.goes[0]).toMatchObject({ v: 1, h: 'full' });
  const taps = goodTaps(round, true);
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: taps.slice(0, 4) })).body).toMatchObject({ code: 'not-done' });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: [{ pick: 999, ms: 900 }] })).status).toBe(400);
  expect((await send('pupil-b', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'not-yours' });

  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ daysDone: 1, stoneChanged: 0, level: 1 });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'ended' });
  expect(log.answers).toHaveLength(1);
  const [{ once, answers }] = log.answers;
  expect(once).toBe(`weka:${round.seed}`);
  // Each fact once: 9 + 2 wrong (its first pick was wrong), the others right, and no fact twice.
  const keys = [...new Set(round.goes.map((g) => g.key))];
  expect(answers.map((a) => [a.key, a.correct])).toEqual(keys.map((k) => [k, k !== GUIDED_KEY]));

  // Records from anywhere on the hub that show starting on 9 secure move the pupil on to 8, and they never drop back.
  // The help follows the records: secure facts (box 2) get the faint picture.
  services.data.facts['pupil-a'] = levelKeys(1).map((key) => ({ ...newStats(key), box: 2 }));
  const eights = await start('pupil-a');
  expect(eights.level).toBe(2);
  expect(eights.goes[0].key).not.toBe(GUIDED_KEY);
  for (const g of eights.goes) expect(g.h).toBe(levelKeys(1).includes(g.key) ? 'faint' : 'full');
  await send('pupil-a', { action: 'finish', seed: eights.seed, taps: goodTaps(eights) });
  services.data.facts['pupil-a'] = [];
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ level: 2, help: 'fade' });

  const off = setup({ settings: () => ({ enabled: false, help: 'fade' }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });
});

it('changes one stone a NZ day by the server’s clock, with hop-backs recorded on gold days and the Golden Picnic Basket on day 30', async () => {
  const { send, start, hours, services, log } = setup();
  const finish = async () => {
    const round = await start('pupil-a');
    const reply = (await send('pupil-a', { action: 'finish', seed: round.seed, taps: goodTaps(round), daysDone: 29, goldenBasket: true })).body;
    return { round, reply };
  };
  expect((await finish()).reply).toEqual({ daysDone: 1, lastStoneDay: '2026-11-04', stoneChanged: 0, goldenBasket: false, level: 1, levelBefore: 1 });
  hours(2); // 11 pm: still the same NZ day, so just for fun
  expect((await finish()).reply).toMatchObject({ daysDone: 1, stoneChanged: null });
  hours(2); // 1 am on the 5th in New Zealand, though still the 4th in UTC
  const day2 = await finish();
  expect(day2.reply).toMatchObject({ daysDone: 2, lastStoneDay: '2026-11-05', stoneChanged: 1 });
  expect(day2.round.goes.some((g) => g.v !== 1)).toBe(false); // bronze days: bigger number first, no hop-backs
  services.data.players['pupil-a'].daysDone = 29;
  hours(24);
  const last = await finish();
  expect(last.round.day).toBe('gold');
  expect(last.round.goes.slice(-BACK_GOES).every((g) => g.v === 2)).toBe(true);
  // A hop-back (13 − 5) counts for its adding fact, once a round like any other go.
  const keys = new Set(last.round.goes.map((g) => g.key));
  expect(log.answers.at(-1)!.answers.map((a) => a.key).sort()).toEqual([...keys].sort());
  expect(last.reply).toMatchObject({ daysDone: 30, stoneChanged: 9, goldenBasket: true });
  expect(log.baskets).toEqual(['pupil-a']); // the hub gives Weka's Golden Picnic Basket achievement
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- weka` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('weka');
    expect(readFileSync(resolve('supabase/functions/weka/index.ts'), 'utf8')).toBe(built);
  });
});
