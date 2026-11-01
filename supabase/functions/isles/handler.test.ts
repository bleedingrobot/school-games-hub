import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { markQuestion, seededRandom, type MathsContext } from '../../../shared/maths/serverQuestions';
import { TURNS_PER_DAY } from '../../../shared/isles/config';
import { memoryServices, type MemoryOptions } from '../../../shared/isles/memoryServices';
import { runRace, starterRace } from '../../../shared/isles/race';
import { makeHandler } from './handler';

// Sky Isles' server tests (docs/ISLES-PLAN.md, section 9: tests 1, 2 and 3 of the game's 8).

const TIMES_TABLES: MathsContext = { facts: [], settings: {} };

function setup(over: MemoryOptions = {}) {
  // Pinned: 11 am on Tuesday 3 November in New Zealand.
  let clock = Date.UTC(2026, 10, 2, 22);
  const log = { answers: [], points: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ maths: () => TIMES_TABLES, now: () => clock, random: seededRandom('isles-tests'), log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/isles', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  /** The right answer to a stored question, read from the server's own store (as only the server can). */
  const rightAnswer = (set: string, slot = 0) => markQuestion(services.data.questions.find((q) => q.id === set)!.questions[slot])!.answer;
  return { send, log, services, rightAnswer, tick: (ms: number) => (clock += ms) };
}

it('marks the turn question itself, once, and only your own (test 1)', async () => {
  const { send, log, rightAnswer } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);
  const { question } = (await send('pupil-a', { action: 'load' })).body;
  // The browser is never sent an answer or a seed.
  expect(JSON.stringify(question)).not.toMatch(/"answer"|factKey|seed/);

  const wrong = await send('pupil-a', { action: 'answer', set: question.set, slot: 0, value: rightAnswer(question.set) + 1, ms: 4000 });
  expect(wrong.body).toEqual({ right: false, answer: rightAnswer(question.set) });
  // Sent twice (even with the right answer the second time): marked once.
  expect((await send('pupil-a', { action: 'answer', set: question.set, slot: 0, value: rightAnswer(question.set) })).body).toMatchObject({ code: 'answered' });
  // Another pupil can't answer it, even knowing its id.
  await send('pupil-b', { action: 'load' });
  expect((await send('pupil-b', { action: 'answer', set: question.set, slot: 0, value: rightAnswer(question.set) })).body).toMatchObject({ code: 'stale' });
  // Recorded for the maths records once, as wrong.
  expect(log.answers.map((a) => [a.player, a.answers[0].correct])).toEqual([['pupil-a', false]]);

  // With the teacher's switch off, nothing happens.
  const off = setup({ settings: () => ({ enabled: false, races: true }) });
  expect((await off.send('pupil-a', { action: 'load' })).body).toMatchObject({ code: 'game-off' });
});

it('plays each turn once, six a day, and refuses an impossible spend (test 2)', async () => {
  const { send, log, services, rightAnswer, tick } = setup();
  let { island, question } = (await send('pupil-a', { action: 'load' })).body;
  await send('pupil-a', { action: 'answer', set: question.set, slot: 0, value: rightAnswer(question.set) });

  // An impossible spend refuses the whole turn, and the turn isn't used.
  const tooDear = await send('pupil-a', { action: 'turn', turn: 0, actions: [{ kind: 'tax', level: 'low' }, { kind: 'anchor' }] });
  expect(tooDear.body).toMatchObject({ code: 'not-enough-coins', at: 1 });
  expect((await send('pupil-a', { action: 'turn', turn: 0, actions: [{ kind: 'build', spot: 99, plot: 'farm' }] })).body).toMatchObject({ code: 'no-such-spot' });
  expect((await send('pupil-a', { action: 'turn', turn: 0, actions: [{ kind: 'build', spot: 5, plot: 'castle' }] })).status).toBe(400);

  const turn = { action: 'turn', turn: 0, actions: [{ kind: 'build', spot: 5, plot: 'workshop' }] };
  const played = (await send('pupil-a', turn)).body;
  // The fair wind came from the answer the server marked.
  expect(played.report.collected.windy).toBe(true);
  expect(played.island).toMatchObject({ turn: 1, turnsLeft: TURNS_PER_DAY - 1, spots: expect.arrayContaining([{ kind: 'workshop', level: 1 }]) });
  // Sent twice: played once, and the island as it is now comes back.
  const twice = (await send('pupil-a', turn)).body;
  expect(twice).toMatchObject({ already: true, island: { turn: 1 } });
  expect(services.data.turns).toHaveLength(1);
  expect(log.points).toEqual([{ player: 'pupil-a', points: 1, once: expect.stringMatching(/^isles:[0-9a-f]+:t0$/) }]);

  // The rest of today's six turns (no answer: no fair wind), then a seventh is refused.
  for (let t = 1; t < TURNS_PER_DAY; t++) {
    island = (await send('pupil-a', { action: 'turn', turn: t, actions: [] })).body.island;
    expect(island.turn).toBe(t + 1);
  }
  const seventh = await send('pupil-a', { action: 'turn', turn: TURNS_PER_DAY, actions: [] });
  expect(seventh.body).toMatchObject({ code: 'no-turns', error: expect.stringContaining('See you tomorrow') });
  expect(services.data.turns).toHaveLength(TURNS_PER_DAY);

  // Tomorrow (New Zealand time) there are six more.
  tick(24 * 60 * 60 * 1000);
  ({ island } = (await send('pupil-a', { action: 'load' })).body);
  expect(island.turnsLeft).toBe(TURNS_PER_DAY);
  expect((await send('pupil-a', { action: 'turn', turn: TURNS_PER_DAY, actions: [] })).status).toBe(200);
});

it("works a Sky Race out from its seed and the answers the server marked, so the browser can't rig it (test 3)", async () => {
  const { send, services, rightAnswer, log } = setup();
  await send('pupil-a', { action: 'load' });
  // A race needs the opponent's island to be one the server knows: classmates come in stage S.4.
  expect((await send('pupil-a', { action: 'raceStart', opponent: 'pupil-b' })).body).toMatchObject({ code: 'not-yet' });

  // The season's first race is the starter race: it can't be lost, even with every answer wrong.
  const first = (await send('pupil-a', { action: 'raceStart', opponent: 'gull-riders' })).body.race;
  expect(first).toMatchObject({ starter: true });
  expect(first.questions).toHaveLength(3);
  expect(JSON.stringify(first)).not.toMatch(/"answer"|factKey|seed/);
  // Starting again carries on the same race, so a bad start can't be thrown away.
  expect((await send('pupil-a', { action: 'raceStart', opponent: 'gull-riders' })).body.race.id).toBe(first.id);
  for (const q of first.questions) await send('pupil-a', { action: 'raceAnswer', race: first.id, slot: q.slot, value: rightAnswer(q.set, q.slot) + 1 });
  // What the browser says about the result is ignored: it comes from the stored seed and the marks.
  const done = (await send('pupil-a', { action: 'raceFinish', race: first.id, won: true, right: 3 })).body;
  const stored = services.data.races[0];
  expect(done.race.result).toEqual(starterRace(stored.seed, stored.you, 0));
  expect(done.race.result.won).toBe(true);
  expect(done.island).toMatchObject({ racesToday: 1, racesWon: 1, coins: 150 + 30, goods: 5 });
  // Sent twice: finished once.
  expect((await send('pupil-a', { action: 'raceFinish', race: first.id })).body).toMatchObject({ already: true });
  expect(log.points.filter((p) => p.once.startsWith('isles:race:'))).toHaveLength(1);

  // One race a turn: play a turn, then an ordinary race, which the answers decide.
  expect((await send('pupil-a', { action: 'raceStart', opponent: 'gull-riders' })).body).toMatchObject({ code: 'raced-this-turn' });
  await send('pupil-a', { action: 'turn', turn: 0, actions: [] });
  const second = (await send('pupil-a', { action: 'raceStart', opponent: 'gull-riders' })).body.race;
  expect(second.starter).toBe(false);
  for (const q of second.questions) await send('pupil-a', { action: 'raceAnswer', race: second.id, slot: q.slot, value: rightAnswer(q.set, q.slot) });
  // Another pupil can't answer or finish it.
  await send('pupil-b', { action: 'load' });
  expect((await send('pupil-b', { action: 'raceFinish', race: second.id })).body).toMatchObject({ code: 'stale' });
  const r2 = (await send('pupil-a', { action: 'raceFinish', race: second.id })).body;
  const s2 = services.data.races[1];
  expect(r2.race.result).toEqual(runRace(s2.seed, s2.you, s2.them, 3));

  // The teacher can switch races off.
  const off = setup({ settings: () => ({ enabled: true, races: false }) });
  await off.send('pupil-a', { action: 'load' });
  expect((await off.send('pupil-a', { action: 'raceStart', opponent: 'gull-riders' })).body).toMatchObject({ code: 'races-off' });
});

it('the deployable file is up to date with the code (run `npm run build:functions -- isles` if this fails)', async () => {
  // @ts-expect-error: plain JavaScript build script
  const { buildFunction } = await import('../../../scripts/build-functions.mjs');
  const built: string = await buildFunction('isles');
  expect(readFileSync(resolve('supabase/functions/isles/index.ts'), 'utf8')).toBe(built);
});
