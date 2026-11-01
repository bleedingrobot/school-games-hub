import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { markQuestion, type MathsContext } from '../../../shared/maths/serverQuestions';
import { botLevel } from '../../../shared/diamond/bot';
import { playLevel } from '../../../shared/diamond/engine';
import { memoryServices, type MemoryOptions } from '../../../shared/diamond/memoryServices';
import { makeRandom } from '../../../shared/diamond/random';
import { makeHandler } from './handler';

// Diamond Drop's server tests (docs/TESTING.md: the game has 8 tests in all; these are the 3 fairness ones).

const TIMES_TABLES: MathsContext = { facts: [], settings: {} };
/** A careful bot that never gets a question right (so its marks match a pupil who answered nothing). */
const STEADY = { wobble: 0, choice: 1, maths: 0 };

function setup(over: MemoryOptions = {}) {
  let clock = Date.UTC(2026, 10, 2, 22);
  let seed = 0.1;
  const log = { answers: [], points: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ maths: () => TIMES_TABLES, now: () => clock, random: () => (seed += 0.137) % 1, log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/diamond', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  /** The right answer to a Hold on! question, read from the server's own store (as only the server can). */
  const rightAnswer = (seed: number, slot: number) => markQuestion(services.data.levels.find((l) => l.seed === seed)!.questions[slot])!.answer;
  /** A good level's drops for this seed, from a bot playing the same engine. */
  const goodDrops = (level: number, seed: number, starter: boolean) => botLevel(level, seed, [], STEADY, makeRandom(7), starter);
  return { send, log, services, rightAnswer, goodDrops, nextDay: () => (clock += 86_400_000) };
}

it('marks Hold on! answers itself, once each, and says nothing of the answers first', async () => {
  const { send, log, rightAnswer } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);
  const start = (await send('pupil-a', { action: 'levelStart', level: 1, boosts: [] })).body;
  expect(start.questions.length).toBeGreaterThan(0);
  // The browser is never sent an answer.
  expect(JSON.stringify(start.questions)).not.toMatch(/"answer"|factKey/);

  const at = { action: 'answer', seed: start.seed };
  const wrong = await send('pupil-a', { ...at, slot: 0, value: rightAnswer(start.seed, 0) + 1, ms: 3000 });
  expect(wrong.body).toEqual({ correct: false, answer: rightAnswer(start.seed, 0) });
  expect((await send('pupil-a', { ...at, slot: 0, value: rightAnswer(start.seed, 0) })).status).toBe(400); // once only
  expect((await send('pupil-a', { ...at, slot: 1, value: rightAnswer(start.seed, 1) })).body).toMatchObject({ correct: true });
  expect((await send('pupil-a', { ...at, slot: 99, value: 1 })).status).toBe(400);
  // Both marked answers were recorded for the maths records, each with its own once-key.
  expect(log.answers.map((a) => [a.answers[0].correct, a.once])).toEqual([[false, `diamond:${start.seed}:0`], [true, `diamond:${start.seed}:1`]]);

  // With the teacher's switch off, nothing happens.
  const off = setup({ enabled: () => false });
  expect((await off.send('pupil-a', { action: 'levelStart', level: 1, boosts: [] })).body).toMatchObject({ code: 'game-off' });
});

it('refuses another pupil’s level, and ends a level only once', async () => {
  const { send, rightAnswer, goodDrops, log } = setup();
  const start = (await send('pupil-a', { action: 'levelStart', level: 1, boosts: [] })).body;
  const { drops } = goodDrops(1, start.seed, start.starter);
  // Pupil b can neither answer pupil a's questions nor end pupil a's level.
  expect((await send('pupil-b', { action: 'answer', seed: start.seed, slot: 0, value: rightAnswer(start.seed, 0) })).status).toBe(409);
  expect((await send('pupil-b', { action: 'levelEnd', seed: start.seed, drops, finish: null })).status).toBe(409);
  expect((await send('pupil-b', { action: 'load' })).body.player.deepest).toBe(0);

  const first = await send('pupil-a', { action: 'levelEnd', seed: start.seed, drops, finish: null });
  expect(first.body.result.passed).toBe(true);
  const again = await send('pupil-a', { action: 'levelEnd', seed: start.seed, drops, finish: null });
  expect(again.body).toMatchObject({ code: 'ended' });
  expect(log.points).toEqual([{ player: 'pupil-a', points: first.body.points, once: `diamond:${start.seed}` }]);
  // Level 2 is a new level: it waits for tomorrow (New Zealand date), then opens.
  expect((await send('pupil-a', { action: 'levelStart', level: 2, boosts: [] })).body).toMatchObject({ code: 'not-open' });
});

it('saves what its own replay says, never a total the browser sends', async () => {
  const { send, goodDrops, nextDay } = setup();
  const start = (await send('pupil-a', { action: 'levelStart', level: 1, boosts: [] })).body;
  const { drops } = goodDrops(1, start.seed, start.starter);
  const end = await send('pupil-a', {
    action: 'levelEnd', seed: start.seed, drops, finish: null,
    coins: 99_999, result: { passed: true, stars: 3, coins: 99_999 }, level: 10, boosts: ['luckyCharm'],
  });
  const replay = playLevel({ level: 1, seed: start.seed, drops, finish: null, boosts: [], marks: start.questions.map(() => false), starter: start.starter });
  expect(end.body.result).toEqual(replay);
  const saved = (await send('pupil-a', { action: 'load' })).body.player;
  expect(saved.coins).toBe(replay.coins);
  expect(saved.deepest).toBe(1);

  // Boosts are paid for on the server, from the saved coins.
  nextDay();
  const tooDear = await send('pupil-a', { action: 'levelStart', level: 2, boosts: ['strongWinch', 'luckyCharm', 'extraTime', 'rockBlaster'] });
  expect(tooDear.status).toBe(400);
  expect((await send('pupil-a', { action: 'levelStart', level: 2, boosts: ['luckyCharm', 'luckyCharm'] })).status).toBe(400);
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- diamond` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('diamond');
    expect(readFileSync(resolve('supabase/functions/diamond/index.ts'), 'utf8')).toBe(built);
  });
});
