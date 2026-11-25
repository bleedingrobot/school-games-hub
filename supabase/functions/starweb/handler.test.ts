import { expect, it } from 'vitest';
import { POINTS } from '../../../shared/starweb/config';
import { memoryServices, type MemoryOptions } from '../../../shared/starweb/memoryServices';
import { GOLD_FACTS } from '../../../shared/starweb/pretend';
import { makeHandler } from './handler';

// Star Web solo's server tests: the fairness ones (the rules have their own in shared/starweb).

function setup(over: MemoryOptions = {}) {
  let clock = Date.UTC(2026, 10, 25, 1);
  const log = { points: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, log, random: () => 0.2, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/starweb', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  return { send, log, services, wait: (s: number) => { clock += s * 1000; } };
}

it('re-checks every star, keeps one a second, needs every arm lit to finish, and gives points once', async () => {
  // The pupil knows only 6 × 7 (three records of it, so the sky follows their own records rather than the easy list).
  const known = { key: 'mul:6x7', attempts: 9, correct: 9, avgMs: 2000, box: 4, lastSeen: 0, quickDays: [] };
  const { send, log, wait, services } = setup({ facts: () => [known, known, known] });
  expect((await send(null, { type: 'load' })).status).toBe(401);
  expect((await send('pupil-a', { type: 'load' })).body).toMatchObject({ enabled: true, open: null, pointsLeft: 5, progress: { lit: 0 } });
  const first = (await send('pupil-a', { type: 'open', mode: 'map' })).body.sky;
  expect(first.anchor).toEqual({ x: 3, y: 4, p: 12 }); // the guided first sky
  expect((await send('pupil-a', { type: 'guide-seen' })).body.progress.guideSeen).toBe(true);

  const sky = (await send('pupil-a', { type: 'open', mode: 'map', fresh: true })).body.sky;
  expect([sky.anchor.x, sky.anchor.y].sort()).toEqual([6, 7]); // from the pupil's own known facts
  const seed = sky.seed as string;
  expect((await send('pupil-b', { type: 'save', seed, tries: ['7×6=42'] })).body.code).toBe('not-yours');

  // Wrong and unlinked tries are dropped; a burst faster than one star a second is cut.
  const quick = await send('pupil-a', { type: 'save', seed, tries: ['7×6=42', '6×8=49', '2+2=4', ...GOLD_FACTS.slice(1, 10)], hints: 1 });
  expect(quick.body.stars.map((s: any) => s.t)).toEqual(['7 × 6 = 42', '42 ÷ 6 = 7', '42 ÷ 7 = 6']);
  expect((await send('pupil-a', { type: 'finish', seed })).body.code).toBe('not-lit');
  expect((await send('pupil-a', { type: 'load' })).body.open.stars).toHaveLength(3); // carry on later

  wait(120);
  const done = await send('pupil-a', { type: 'finish', seed, tries: GOLD_FACTS, hints: 0 });
  expect(done.body).toMatchObject({ medal: 3, points: POINTS[3], progress: { lit: 1, gold: 1, stars: 30, nohint: 0, tables: { 6: 3, 7: 3 } } });
  expect(log.points).toEqual([{ player: 'pupil-a', points: POINTS[3], once: `starweb:${seed}` }]);
  expect((await send('pupil-a', { type: 'finish', seed, tries: GOLD_FACTS })).body.already).toBe(true); // sent twice counts once
  expect(log.points).toHaveLength(1);

  // Only the first 5 lit skies of the day earn points.
  for (let i = 0; i < 5; i++) {
    const s = (await send('pupil-a', { type: 'open', mode: 'map', fresh: true })).body.sky;
    wait(120);
    expect([s.anchor.x, s.anchor.y].sort()).toEqual([6, 7]);
    expect((await send('pupil-a', { type: 'finish', seed: s.seed, tries: GOLD_FACTS.slice(0, 28) })).body.medal).toBe(2);
  }
  expect(log.points.map((p) => p.points)).toEqual([4, 3, 3, 3, 3]); // 5 point skies, then none
  expect(services.data.players['pupil-a'].progress.lit).toBe(6);
});

it('refuses while the switch is off, opens Free sky after 5 lit skies, and finishes a lit sky before a new one', async () => {
  let enabled = false;
  const { send, log, wait } = setup({ settings: () => ({ enabled }) });
  expect((await send('pupil-a', { type: 'open', mode: 'map' })).body.code).toBe('off');
  enabled = true;
  await send('pupil-a', { type: 'guide-seen' });
  expect((await send('pupil-a', { type: 'open', mode: 'free', x: 6, y: 7 })).body.code).toBe('locked');

  // A lit sky left open is finished (medal and points kept) when a new one opens.
  const sky = (await send('pupil-a', { type: 'open', mode: 'map' })).body.sky;
  expect((await send('pupil-a', { type: 'open', mode: 'map' })).body.sky.seed).toBe(sky.seed); // Carry on
  wait(120);
  const k = sky.anchor;
  const lightAll = [`${k.y}×${k.x}=${k.p}`, `${k.p}÷${k.x}=${k.y}`, `${k.p}÷${k.y}=${k.x}`, `${k.p * 2}÷${k.x}=${k.y * 2}`,
    `${k.x * 2}×${k.y}=${k.p * 2}`, `${k.x}×${k.y * 2}=${k.p * 2}`, `${k.x * 4}×${k.y}=${k.p * 4}`,
    `${k.x * 10}×${k.y}=${k.p * 10}`, `${k.x}×${k.y * 10}=${k.p * 10}`, `${k.x * 10}×${k.y * 10}=${k.p * 100}`,
    `${k.x}×${k.y + 1}=${k.p + k.x}`, `${k.x + 1}×${k.y}=${k.p + k.y}`, `${k.x - 1}×${k.y}=${k.p - k.y}`,
    `${k.p}+${k.p}=${k.p * 2}`, `${k.p - 1}+1=${k.p}`, `${k.p - 2}+2=${k.p}`, `${k.p + 3}−3=${k.p}`,
    `${k.x / 2}×${k.y}=${k.p / 2}`, `${k.x}×${k.y / 2}=${k.p / 2}`, `${k.x * 2}×${k.y / 2}=${k.p}`, `${k.x / 10}×${k.y}=${k.p / 10}`];
  expect((await send('pupil-a', { type: 'save', seed: sky.seed, tries: lightAll })).body.medal).toBe(1);
  const next = await send('pupil-a', { type: 'open', mode: 'map', fresh: true });
  expect(next.body.progress.lit).toBe(1);
  expect(log.points).toHaveLength(1);
  expect(next.body.sky.seed).not.toBe(sky.seed);
  expect((await send('pupil-a', { type: 'open', mode: 'free', x: 7, y: 7 })).body.code).toBe('locked');
});
