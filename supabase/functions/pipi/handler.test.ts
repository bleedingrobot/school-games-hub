import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newStats } from '../../../shared/maths/leitner';
import { memoryServices, type MemoryOptions } from '../../../shared/pipi/memoryServices';
import type { Tap } from '../../../shared/pipi/play';
import { GUIDED_KEY, levelKeys, showRound, type Round } from '../../../shared/pipi/round';
import { makeHandler } from './handler';

// Pipi's Hidden Shells' server tests (the fairness ones; the rules have their own in shared/pipi).

/** Every go right first time, after one wrong shell on the first go if `wobble`. */
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
  const log = { answers: [], pearls: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed += 0.137) % 1, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/pipi', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const start = async (who: string) => (await send(who, { action: 'start' })).body.round as Round;
  return { send, start, log, services, hours: (h: number) => (clock += h * 3_600_000) };
}

it('finishes only a pupil’s own, finished challenge, once, and records each go once against its part-whole fact', async () => {
  const { send, start, log, services, hours } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);

  const round = await start('pupil-a');
  expect(round.goes[0]).toEqual({ key: GUIDED_KEY, kind: 'hiding', h: 'full' });
  // The browser's word for the round counts for nothing: the server checks the taps against the round it kept.
  const taps = goodTaps(round, true);
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: taps.slice(0, 4) })).body).toMatchObject({ code: 'not-done' });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps: [{ pick: 999, ms: 900 }] })).status).toBe(400);
  expect((await send('pupil-b', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'not-yours' });

  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ daysDone: 1, shellChanged: 0, level: 1 });
  expect((await send('pupil-a', { action: 'finish', seed: round.seed, taps })).body).toMatchObject({ code: 'ended' });
  // One answer a go, once: the first go wrong (its first shell was wrong), the rest right.
  expect(log.answers).toHaveLength(1);
  const [{ once, answers }] = log.answers;
  expect(once).toBe(`pipi:${round.seed}`);
  expect(answers.map((a) => [a.key, a.correct])).toEqual(round.goes.map((g, i) => [g.key, i > 0]));

  // Records from anywhere on the hub that show wholes 3 to 5 secure move the pupil on, and they never drop back.
  services.data.facts['pupil-a'] = levelKeys(1).map((key) => ({ ...newStats(key), box: 2 }));
  // Only the next day's first finish moves the level: a replay the same day keeps it.
  const replay = await start('pupil-a');
  expect(replay.level).toBe(1);
  expect((await send('pupil-a', { action: 'finish', seed: replay.seed, taps: goodTaps(replay) })).body).toMatchObject({ shellChanged: null, level: 1 });
  hours(24);
  const next = await start('pupil-a');
  expect(next.level).toBe(1);
  expect((await send('pupil-a', { action: 'finish', seed: next.seed, taps: goodTaps(next) })).body).toMatchObject({ level: 2 });
  services.data.facts['pupil-a'] = [];
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ level: 2, guided: false });

  // With the teacher's switch off, nothing happens.
  const off = setup({ settings: () => ({ enabled: false, help: true }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });
});

it('changes one shell a NZ day by the server’s clock, whatever the browser sends, and gives a pearl every 30 days', async () => {
  const { send, start, hours, services, log } = setup({ settings: () => ({ enabled: true, help: false }) });
  const finish = async () => {
    const round = await start('pupil-a');
    const reply = (await send('pupil-a', { action: 'finish', seed: round.seed, taps: goodTaps(round), daysDone: 29, shellChanged: 9, pearl: true })).body;
    return { round, reply };
  };
  expect((await finish()).reply).toEqual({ daysDone: 1, lastShellDay: '2026-11-04', shellChanged: 0, pearl: false, level: 1, levelBefore: 1 });
  hours(2); // 11 pm: still the same NZ day, so just for fun
  expect((await finish()).reply).toMatchObject({ daysDone: 1, shellChanged: null });
  hours(2); // 1 am on the 5th in New Zealand, though still the 4th in UTC
  const day2 = await finish();
  expect(day2.reply).toMatchObject({ daysDone: 2, lastShellDay: '2026-11-05', shellChanged: 1 });
  expect(day2.round.colour).toBe('bronze');
  expect((await send('pupil-a', { action: 'load' })).body).toMatchObject({ daysDone: 2, today: '2026-11-05', help: false });
  expect(log.pearls).toEqual([]);
  services.data.players['pupil-a'].daysDone = 29;
  hours(24);
  const last = await finish();
  expect(last.round.colour).toBe('gold');
  expect(last.round.goes.filter((g) => g.kind === 'twoTides')).toHaveLength(2);
  expect(last.reply).toMatchObject({ daysDone: 30, shellChanged: 9, pearl: true });
  expect(log.pearls).toEqual(['pupil-a']); // the hub gives the Golden Pearl achievement
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- pipi` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('pipi');
    expect(readFileSync(resolve('supabase/functions/pipi/index.ts'), 'utf8')).toBe(built);
  });
});
