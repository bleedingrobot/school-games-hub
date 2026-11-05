import { expect, it } from 'vitest';
import { markQuestion, seededRandom, type MathsContext } from '../../../shared/maths/serverQuestions';
import { memoryServices, type MemoryOptions } from '../../../shared/decree/memoryServices';
import { DECK, type PublicReign } from '../../../shared/decree/server';
import { isRiddleTurn, nextCard, play, type Move, type Reign } from '../../../shared/decree/engine';
import { makeHandler } from './handler';

// Royal Decree's server tests (docs/TESTING.md: these are the fairness ones).

const TIMES_TABLES: MathsContext = { facts: [], settings: {} };

function setup(over: MemoryOptions = {}) {
  const clock = Date.UTC(2026, 10, 5, 22);
  const log = { answers: [], points: [] } as NonNullable<MemoryOptions['log']>;
  const services = memoryServices({ maths: () => TIMES_TABLES, now: () => clock, random: seededRandom('a royal test'), log, ...over });
  const handler = makeHandler({ ...services, userIdFor: async (t) => (t.startsWith('pupil-') ? t : null) });
  const send = async (who: string | null, body: object) => {
    const res = await handler(new Request('https://x/decree', {
      method: 'POST', headers: who ? { Authorization: `Bearer ${who}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> & { reign: PublicReign } };
  };
  /** The right answer to a riddle, read from the server's own store (as only the server can). */
  const rightAnswer = (slot: number) => markQuestion(services.data.reigns.find((r) => r.status === 'playing')!.questions[slot])!.answer;
  return { send, log, services, rightAnswer };
}

/** The next `count` moves a careful ruler would make from a reign: each card's side that keeps the lowest meter highest. */
function carefulMoves(from: Reign, count: number): Move[] {
  const moves: Move[] = [];
  let r = from;
  for (let i = 0; i < count && r.status === 'playing'; i++) {
    const next = nextCard(r, DECK)!;
    const options: Move[] = next.kind === 'riddle' ? ['riddle'] : ['yes', 'no'];
    const tried = options.map((m) => ({ m, after: play(r, DECK, m)! }));
    tried.sort((a, b) => Math.min(...Object.values(b.after.meters)) - Math.min(...Object.values(a.after.meters)));
    moves.push(tried[0].m);
    r = tried[0].after;
  }
  return moves;
}

it('marks riddles itself, once each, and counts a riddle sent twice once', async () => {
  const { send, log, rightAnswer } = setup();
  expect((await send(null, { action: 'load' })).status).toBe(401);
  const { reign } = (await send('pupil-a', { action: 'start', look: 'ruler-girl-1' })).body;
  expect(reign.questions.length).toBeGreaterThan(1);
  // The browser is never sent an answer.
  expect(JSON.stringify(reign)).not.toMatch(/"answer":|factKey/);

  const at = { action: 'answer', reign: reign.id };
  const wrong = await send('pupil-a', { ...at, slot: 0, value: rightAnswer(0) + 1, ms: 3000 });
  expect(wrong.body).toMatchObject({ right: false, answer: rightAnswer(0) });
  expect((await send('pupil-a', { ...at, slot: 0, value: rightAnswer(0) })).status).toBe(400); // once only
  expect((await send('pupil-a', { ...at, slot: 1, value: rightAnswer(1) })).body).toMatchObject({ right: true });
  expect((await send('pupil-a', { ...at, slot: 99, value: 1 })).status).toBe(400);
  // Both marked answers were recorded for the maths records, each once.
  expect(log.answers.map((a) => [a.answers[0].correct, a.once.endsWith(':0'), a.once.endsWith(':1')])).toEqual([[false, true, false], [true, false, true]]);

  // With the teacher's switch off, nothing happens.
  const off = setup({ enabled: () => false });
  expect((await off.send('pupil-a', { action: 'start', look: 'ruler-girl-1' })).body).toMatchObject({ code: 'game-off' });
});

it("does not let another pupil play your reign", async () => {
  const { send, rightAnswer } = setup();
  const { reign } = (await send('pupil-a', { action: 'start', look: 'ruler-boy-2' })).body;
  expect((await send('pupil-b', { action: 'answer', reign: reign.id, slot: 0, value: rightAnswer(0) })).status).toBe(409);
  expect((await send('pupil-b', { action: 'save', reign: reign.id, from: 0, moves: ['yes'] })).status).toBe(409);
});

it('keeps a saved year once, refuses moves that do not fit, and gives points when the reign ends', async () => {
  const { send, log, services } = setup();
  const { reign } = (await send('pupil-a', { action: 'start', look: 'ruler-boy-2' })).body;
  // A riddle card needs the riddle move, and a request card needs a side.
  expect((await send('pupil-a', { action: 'save', reign: reign.id, from: 0, moves: ['riddle'] })).body).toMatchObject({ code: 'bad-moves' });
  expect((await send('pupil-a', { action: 'save', reign: reign.id, from: 0, moves: ['maybe'] })).status).toBe(400);

  const stored = () => services.data.reigns[0];
  const first = carefulMoves(stored().reign, 4);
  expect(isRiddleTurn(3)).toBe(true);
  const saved = await send('pupil-a', { action: 'save', reign: reign.id, from: 0, moves: first });
  expect(saved.body.reign.reign.turn).toBe(first.length);
  // Sent twice: kept once.
  const again = await send('pupil-a', { action: 'save', reign: reign.id, from: 0, moves: first });
  expect(again.body).toMatchObject({ already: true });
  expect(stored().moves).toEqual(first);

  // Play on to the end: points are given once, for the finished reign.
  while (stored().status === 'playing') {
    const more = carefulMoves(stored().reign, 4);
    await send('pupil-a', { action: 'save', reign: reign.id, from: stored().reign.turn, moves: more });
  }
  expect(log.points).toEqual([{ player: 'pupil-a', points: stored().points, once: `decree:${reign.id}` }]);
  expect(stored().points).toBeGreaterThan(0);
});
