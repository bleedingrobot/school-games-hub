import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LADDER } from '../../../shared/maths/ladder';
import { markQuestion, type MathsContext } from '../../../shared/maths/serverQuestions';
import { botRun } from '../../../shared/goblinstorm/bot';
import { CHOICES, HEROES, MAPS, QUESTIONS_PER_RUN, type WeaponId } from '../../../shared/goblinstorm/config';
import { memoryServices } from '../../../shared/goblinstorm/memoryServices';
import { RUNS_A_DAY, freshSave, newUnlocks, runQuestions } from '../../../shared/goblinstorm/server';
import { encodeSteering } from '../../../shared/goblinstorm/replay';
import { makeHandler } from './handler';

// Goblin Storm's 3 server tests (docs/GOBLINSTORM-PLAN.md, "Tests"), plus the deployable file's check.

function setup(options: Parameters<typeof memoryServices>[0] = {}) {
  const { services, world } = memoryServices(options);
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/goblinstorm', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  /** The right answer to a level-up question, read from the server's own store (as only the server can). */
  const rightAnswer = (who: string, seed: number, slot: number) => markQuestion(world.runs.get(`${who}:${seed}`)!.questions[slot])!.answer;
  /** 20 seconds of a Knight's run on Castle Fields that answered no questions, as the browser would send it. */
  const played = (seed: number) => {
    const bot = botRun({ seed, hero: HEROES[0], map: MAPS[0], shop: {} }, () => CHOICES.wrong, 1200);
    return { steering: encodeSteering(bot.steering), picks: bot.picks };
  };
  return { send, world, rightAnswer, played };
}

const START = { action: 'start', hero: 'knight', map: 0 };

it('refuses: signed out, switch off, locked, a 6th run, too fast and another pupil’s seed', async () => {
  const { send, world, played } = setup();
  expect((await send(null, START)).status).toBe(401);
  expect((await send('pupil-a', { ...START, hero: 'wizard' })).body).toMatchObject({ code: 'locked' });
  expect((await send('pupil-a', { ...START, map: 1 })).body).toMatchObject({ code: 'locked' });

  const first = (await send('pupil-a', START)).body;
  expect(first.runsLeft).toBe(RUNS_A_DAY - 1);
  // The browser is never sent an answer.
  expect(JSON.stringify(first.questions)).not.toMatch(/"answer"|factKey/);

  // Sent straight back, 20 seconds of play is too fast; 20 seconds later it's saved, once.
  const run = { action: 'finish', seed: first.seed, ...played(first.seed) };
  expect((await send('pupil-a', run)).body).toMatchObject({ code: 'too-fast' });
  // Another pupil can't finish (or answer) this run.
  expect((await send('pupil-b', run)).body).toMatchObject({ code: 'not-yours' });
  expect((await send('pupil-b', { action: 'answer', seed: first.seed, slot: 0, value: 1 })).body).toMatchObject({ code: 'gone' });
  world.clock += 20_000;
  // A made-up run (one pick too many) is refused.
  expect((await send('pupil-a', { ...run, picks: [...run.picks, 0] })).body).toMatchObject({ code: 'not-valid' });
  const saved = await send('pupil-a', run);
  expect(saved.body).toMatchObject({ valid: true, summary: { outcome: 'quit', seconds: 20 }, unlocked: [] });
  // Unlocks come only from the replay's summary: the Goblin King opens the Cleric (not another map's boss), level 20
  // the Wizard, and a hero already open isn't unlocked twice.
  const won = { level: 20, kills: 900, bossBeaten: true, evolved: [] as WeaponId[], longestNoHitSeconds: 10 };
  expect(newUnlocks(freshSave(), won, 0)).toEqual(['wizard', 'cleric']);
  expect(newUnlocks(freshSave(), { ...won, level: 19 }, 1)).toEqual([]);
  expect(newUnlocks({ ...freshSave(), heroes: ['wizard'], kills: 4200 }, won, 3)).toEqual(['barbarian', 'witch']);
  expect((await send('pupil-a', run)).body).toMatchObject({ already: true, summary: saved.body.summary });

  // 5 runs a day (finished or not), then "come back tomorrow"; Unlimited today lifts it.
  for (let i = 1; i < RUNS_A_DAY; i++) expect((await send('pupil-a', START)).status).toBe(200);
  expect((await send('pupil-a', START)).body).toMatchObject({ code: 'done-today', error: 'All done for today. See you tomorrow!' });
  world.unlimited = true;
  expect((await send('pupil-a', START)).body).toMatchObject({ runsLeft: null });
  expect([...world.runs.values()].filter((r) => r.extra)).toHaveLength(1);
  world.unlimited = false;
  world.clock += 86_400_000;
  expect((await send('pupil-a', START)).status).toBe(200);

  // With the teacher's switch off, nothing happens.
  world.enabled = false;
  expect((await send('pupil-a', START)).body).toMatchObject({ code: 'game-off' });
});

it('marks a slot once, records it, and replays with the cards those marks gave', async () => {
  const { send, world, rightAnswer } = setup();
  const { seed } = (await send('pupil-a', START)).body;
  const at = { action: 'answer', seed };
  const wrong = await send('pupil-a', { ...at, slot: 0, value: rightAnswer('pupil-a', seed, 0) + 1, ms: 3000 });
  expect(wrong.body).toMatchObject({ mark: 'wrong', correct: false, answer: rightAnswer('pupil-a', seed, 0) });
  expect(wrong.body.fact).toContain(String(rightAnswer('pupil-a', seed, 0)));
  // Only the first answer counts: the right answer sent after it gets the same mark, and nothing is recorded again.
  expect((await send('pupil-a', { ...at, slot: 0, value: rightAnswer('pupil-a', seed, 0), ms: 900 })).body).toMatchObject({ mark: 'wrong', already: true });
  expect((await send('pupil-a', { ...at, slot: 1, value: rightAnswer('pupil-a', seed, 1), ms: 900 })).body).toMatchObject({ mark: 'quick', correct: true });
  expect((await send('pupil-a', { ...at, slot: 2, value: rightAnswer('pupil-a', seed, 2), ms: 60_000 })).body).toMatchObject({ mark: 'right' });
  expect((await send('pupil-a', { ...at, slot: QUESTIONS_PER_RUN, value: 1 })).status).toBe(400);
  expect(world.recorded.map((r) => [r.once, r.answers[0].correct, r.answers[0].given])).toEqual([
    [`${seed}:0`, false, rightAnswer('pupil-a', seed, 0) + 1], [`${seed}:1`, true, undefined], [`${seed}:2`, true, undefined],
  ]);

  // The replay uses the server's marks: 2, 4 and 3 cards for the first three questions (then 2 for unanswered ones).
  const marks = { 0: CHOICES.wrong, 1: CHOICES.quick, 2: CHOICES.right } as Record<number, number>;
  const bot = botRun({ seed, hero: HEROES[0], map: MAPS[0], shop: {} }, (slot) => marks[slot] ?? CHOICES.wrong, 60 * 90);
  world.clock += 90_000;
  const finish = { action: 'finish', seed, steering: encodeSteering(bot.steering), picks: bot.picks };
  expect((await send('pupil-a', finish)).body).toMatchObject({ valid: true, summary: { level: bot.state.level, kills: bot.state.kills } });
  expect(world.saves.get('pupil-a')?.gold).toBe(world.runs.get(`pupil-a:${seed}`)?.summary?.gold);
  // Once ended, no more answers.
  expect((await send('pupil-a', { ...at, slot: 3, value: 1 })).body).toMatchObject({ code: 'gone' });
});

it('makes level-up questions the server can mark, for every skill on the maths ladder', () => {
  for (const skill of LADDER) {
    const focus = { source: 'teacher-class' as const, skills: [skill.id], onlyThese: true, endsAt: null, canChoose: false, own: null };
    const context: MathsContext = { facts: [], settings: {}, focus };
    const qs = runQuestions(context, 7);
    expect(qs.length, skill.id).toBeGreaterThan(0);
    expect(qs.length, skill.id).toBeLessThanOrEqual(QUESTIONS_PER_RUN);
    for (const q of qs) expect(markQuestion(q), skill.id).not.toBeNull();
    // The same seed makes the same questions.
    expect(runQuestions(context, 7), skill.id).toEqual(qs);
  }
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- goblinstorm` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('goblinstorm');
    expect(readFileSync(resolve('supabase/functions/goblinstorm/index.ts'), 'utf8')).toBe(built);
  });
});
