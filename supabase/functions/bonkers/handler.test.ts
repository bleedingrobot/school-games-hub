import { expect, it } from 'vitest';
import { replay } from '../../../shared/bonkers/engine';
import { memoryServices, type MemoryOptions } from '../../../shared/bonkers/memoryServices';
import type { Settings } from '../../../shared/bonkers/server';
import { makeHandler } from './handler';

// Smash Quest's server tests: the fairness ones (the rules have their own in shared/bonkers).

function setup(over: MemoryOptions = {}) {
  const clock = Date.UTC(2026, 10, 29, 22); // Monday 30 Nov 2026, 11am in NZ
  let seed = 0.1;
  const log = { answers: [], points: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ now: () => clock, random: () => (seed = (seed * 9301 + 0.4927) % 1), log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/bonkers', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  return { send, log, services };
}

/** Answers every question until the adventure is done: right when `right(slot)` says so (the answer comes from a wrong try's reply). */
async function playThrough(send: ReturnType<typeof setup>['send'], who: string, current: any, right: (slot: number) => boolean) {
  let q = current.question;
  while (q) {
    const pick = right(q.slot) ? await answerFor(send, who, current.seed, q) : -1;
    const r = (await send(who, { action: 'answer', seed: current.seed, slot: q.slot, value: pick, ms: 4000, special: true })).body;
    q = r.question;
  }
}
// The browser never knows the answer; the test reads it from the kept questions, like the server does.
let services: ReturnType<typeof memoryServices>;
async function answerFor(_send: unknown, who: string, seedText: string, q: { slot: number }) {
  const kept = services.data.adventures.find((a) => a.player === who && a.kept.seed === seedText)!.kept;
  return kept.questions[q.slot % kept.questions.length].answer;
}

it('picks a hero once, starts only today’s quests, marks each answer once and in order, and never shows an answer', async () => {
  const s = setup();
  services = s.services;
  const { send, log } = s;
  expect((await send(null, { action: 'load' })).status).toBe(401);
  const load = (await send('pupil-a', { action: 'load' })).body;
  expect(load).toMatchObject({ waiting: 1, current: null, progress: { hero: null, level: 1 } });
  expect((await send('pupil-a', { action: 'start', quest: load.quests[0].id })).body.code).toBe('no-hero');
  expect((await send('pupil-a', { action: 'hero', cls: 'wizard', look: 'boy' })).status).toBe(400);
  expect((await send('pupil-a', { action: 'hero', cls: 'ninja', look: 'animal' })).status).toBe(200);
  expect((await send('pupil-a', { action: 'hero', cls: 'knight', look: 'boy' })).body.code).toBe('locked'); // kept all season
  expect((await send('pupil-a', { action: 'hero', cls: 'ninja', look: 'girl' })).status).toBe(200); // a new look is fine

  expect((await send('pupil-a', { action: 'start', quest: 'volcano:wins:4:0' })).body.code).toBe('stale'); // not offered today
  const start = (await send('pupil-a', { action: 'start', quest: load.quests[1].id })).body;
  expect(start.waiting).toBe(0);
  const cur = start.current;
  expect(cur.question.choices).toHaveLength(4); // always 4 choices
  expect(JSON.stringify(start)).not.toContain('"answer"');
  // Starting again just hands back the adventure that's going.
  expect((await send('pupil-a', { action: 'start', quest: load.quests[0].id })).body.current.seed).toBe(cur.seed);

  const wrong = (await send('pupil-a', { action: 'answer', seed: cur.seed, slot: 0, value: -1, ms: 3000 })).body;
  expect(wrong).toMatchObject({ correct: false, marks: [{ right: false, special: false }] });
  expect(typeof wrong.answer).toBe('number'); // shown with the right answer, after
  expect((await send('pupil-a', { action: 'answer', seed: cur.seed, slot: 0, value: wrong.answer, ms: 3000 })).body).toMatchObject({ correct: false, again: true });
  expect((await send('pupil-a', { action: 'answer', seed: cur.seed, slot: 5, value: 1, ms: 1 })).body.code).toBe('order');
  expect((await send('pupil-b', { action: 'answer', seed: cur.seed, slot: 1, value: 1, ms: 1 })).body.code).toBe('not-yours');
  expect(log.answers).toHaveLength(1);
  expect((await send('pupil-a', { action: 'finish', seed: cur.seed })).body.code).toBe('not-done');
});

it('replays the marks to save the result once, gives points once, and uses up the day’s adventure unless Unlimited today is on', async () => {
  let unlimited = false;
  const s = setup({ settings: (): Settings => ({ enabled: true, unlimited }) });
  services = s.services;
  const { send, log } = s;
  await send('pupil-a', { action: 'hero', cls: 'knight', look: 'boy' });
  const load = (await send('pupil-a', { action: 'load' })).body;
  const cur = (await send('pupil-a', { action: 'start', quest: load.quests[0].id })).body.current;
  await playThrough(send, 'pupil-a', cur, () => true);
  const kept = services.data.adventures[0].kept;
  expect(replay(kept.adventure, kept.marks).phase).toBe('done');
  const done = (await send('pupil-a', { action: 'finish', seed: cur.seed })).body;
  expect(done.starsEarned).toBeGreaterThan(0);
  expect(done.progress.stats.adventures).toBe(1);
  expect(done.waiting).toBe(0);
  expect(log.points).toHaveLength(1);
  expect(log.points[0].points).toBe(done.points);
  expect((await send('pupil-a', { action: 'finish', seed: cur.seed })).body.code).toBe('ended');
  expect(log.points).toHaveLength(1);

  // None left today; the teacher's Unlimited today lets them go again without using one up.
  const next = (await send('pupil-a', { action: 'load' })).body;
  expect(next.quests[0].id).not.toBe(load.quests[0].id); // new quests after each adventure
  expect((await send('pupil-a', { action: 'start', quest: next.quests[0].id })).body.code).toBe('done-today');
  unlimited = true;
  const extra = (await send('pupil-a', { action: 'start', quest: next.quests[0].id })).body;
  expect(extra.waiting).toBeNull();
  expect(extra.progress.credits).toBe(0);

  // Switched off by the teacher: refused, but load still says so.
  const off = setup({ settings: () => ({ enabled: false }) });
  expect((await off.send('pupil-a', { action: 'hero', cls: 'knight', look: 'boy' })).body.code).toBe('off');
  expect((await off.send('pupil-a', { action: 'load' })).body.enabled).toBe(false);
});
