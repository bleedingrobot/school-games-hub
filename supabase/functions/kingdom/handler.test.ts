import { expect, it } from 'vitest';
import { LADDER } from '../../../shared/maths/ladder';
import { markQuestion, seededRandom, type MathsContext } from '../../../shared/maths/serverQuestions';
import { FOOD_PER_PERSON, POINT_REIGNS_PER_DAY, YEARS } from '../../../shared/kingdom/config';
import { memoryServices, type MemoryOptions } from '../../../shared/kingdom/memoryServices';
import type { PublicReign } from '../../../shared/kingdom/reign';
import { makeHandler } from './handler';

// Kingdom Keeper's server tests (docs/TESTING.md: the game has 8 tests in all; these are the fairness ones).

const TIMES_TABLES: MathsContext = { facts: [], settings: {} };

function setup(over: MemoryOptions = {}) {
  let clock = Date.UTC(2026, 9, 26, 22);
  const log = { answers: [], points: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ maths: () => TIMES_TABLES, now: () => clock, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/kingdom', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> & { reign: PublicReign } };
  };
  /** The right answer to a council question, read from the server's own store (as only the server can). */
  const rightAnswer = (slot: number) => markQuestion(services.data.reigns.find((r) => r.status === 'playing')!.council!.questions[slot])!.answer;
  return { send, log, services, rightAnswer, tick: (ms: number) => (clock += ms) };
}

const feedAll = (r: PublicReign) => ({ buy: 0, sell: 0, feed: r.city.people * FOOD_PER_PERSON, plant: 0 });
/** Feed everyone (selling land if the store is short), then plant all the land the people and the seed allow. */
const goodYear = ({ city }: PublicReign) => {
  const food = city.people * FOOD_PER_PERSON;
  const sell = city.grain < food ? Math.ceil((food - city.grain) / city.price) : 0;
  const grain = city.grain + sell * city.price - food;
  return { buy: 0, sell, feed: food, plant: Math.max(0, Math.min(city.land - sell, city.people * 10, grain * 2)) };
};

it('marks council answers itself, once each, and only in your own open reign', async () => {
  const { send, log, rightAnswer } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);
  const { reign } = (await send('pupil-a', { action: 'start', look: 'ruler-girl-1' })).body;
  expect(reign.council?.questions).toHaveLength(3);
  // The browser is never sent an answer.
  expect(JSON.stringify(reign)).not.toMatch(/"answer"|factKey|seed/);

  const at = { action: 'answer', reign: reign.id, year: 1 };
  const wrong = await send('pupil-a', { ...at, slot: 0, value: rightAnswer(0) + 1, ms: 3000 });
  expect(wrong.body).toMatchObject({ right: false, answer: rightAnswer(0) });
  expect((await send('pupil-a', { ...at, slot: 0, value: rightAnswer(0) })).status).toBe(400); // once only
  expect((await send('pupil-a', { ...at, slot: 1, value: rightAnswer(1) })).body).toMatchObject({ right: true });
  expect((await send('pupil-a', { ...at, slot: 7, value: 1 })).status).toBe(400);
  expect((await send('pupil-a', { ...at, year: 2, slot: 2, value: rightAnswer(2) })).status).toBe(400);
  // Another pupil can't answer (or play) this reign.
  expect((await send('pupil-b', { ...at, slot: 2, value: rightAnswer(2) })).status).toBe(409);
  expect((await send('pupil-b', { action: 'decide', reign: reign.id, year: 1, decisions: feedAll(reign) })).status).toBe(409);
  // Both marked answers were recorded for the maths records, each with its own once-key.
  expect(log.answers.map((a) => [a.answers[0].correct, a.once.endsWith(':1:0'), a.once.endsWith(':1:1')])).toEqual([[false, true, false], [true, false, true]]);

  // With the teacher's switch off, nothing happens.
  const off = setup({ enabled: () => false });
  expect((await off.send('pupil-a', { action: 'start', look: 'ruler-girl-1' })).body).toMatchObject({ code: 'game-off' });
});

it('turns each year once, with only the boons the server marked, and gives points for a finished reign', async () => {
  const { send, log, rightAnswer, services } = setup({ random: seededRandom('a good reign') });
  let { reign } = (await send('pupil-a', { action: 'start', look: 'ruler-boy-2' })).body;
  expect((await send('pupil-a', { action: 'decide', reign: reign.id, year: 1, decisions: { ...feedAll(reign), feed: 999999 } })).body)
    .toMatchObject({ code: 'grain-for-food' });

  for (let year = 1; year <= YEARS; year++) {
    // Answer every council question right except the first.
    for (let slot = 1; slot < (reign.council?.questions.length ?? 0); slot++) {
      await send('pupil-a', { action: 'answer', reign: reign.id, year, slot, value: rightAnswer(slot) });
    }
    const advisers = reign.council!.advisers;
    const decide = { action: 'decide', reign: reign.id, year, decisions: goodYear(reign), boons: ['reeve', 'trader', 'healer'] };
    const turned = (await send('pupil-a', decide)).body.reign;
    // The year's boons are the advisers answered right, never what the browser claims.
    expect(turned.city.report.boons.sort()).toEqual(advisers.slice(1).sort());
    // Sent twice: the year is turned once.
    const again = await send('pupil-a', decide);
    if (turned.city.status === 'playing') {
      expect(again.body).toMatchObject({ already: true, reign: { city: { year: year + 1 } } });
    } else {
      expect(again.status).toBe(409);
    }
    reign = turned;
  }
  expect(reign).toMatchObject({ city: { status: 'done' }, rating: expect.any(String), points: expect.any(Number) });
  expect(log.points).toEqual([{ player: 'pupil-a', points: reign.points, once: `kingdom:${reign.id}` }]);
  expect(services.data.reigns[0]).toMatchObject({ status: 'done', turned: YEARS });

  // Only the first few reigns a day give points (early endings count): starve the city to end each one quickly.
  for (let i = 1; i <= POINT_REIGNS_PER_DAY; i++) {
    const r = (await send('pupil-a', { action: 'start', look: 'ruler-boy-2' })).body.reign;
    const end = (await send('pupil-a', { action: 'decide', reign: r.id, year: 1, decisions: { buy: 0, sell: 0, feed: 0, plant: 0 } })).body.reign;
    expect(end).toMatchObject({ city: { status: 'ended' }, rating: 'hard', points: i < POINT_REIGNS_PER_DAY ? 1 : 0 });
  }
});

it('gives every skill on the maths ladder a council the server can mark', async () => {
  for (const skill of LADDER) {
    const focus = { source: 'teacher-class' as const, skills: [skill.id], onlyThese: true, endsAt: null, canChoose: false, own: null };
    const { send, services } = setup({ maths: () => ({ facts: [], settings: {}, focus }) as MathsContext });
    const { reign } = (await send('pupil-a', { action: 'start', look: 'ruler-girl-3' })).body;
    expect(reign.council?.questions.length, skill.id).toBe(3);
    for (const q of services.data.reigns[0].council!.questions) expect(markQuestion(q), skill.id).not.toBeNull();
  }
  // No maths could be read: the year goes on with no council.
  const none = setup({ maths: () => null });
  expect((await none.send('pupil-a', { action: 'start', look: 'ruler-girl-3' })).body.reign.council).toBeNull();
});
