import { describe, expect, it } from 'vitest';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { beachAfter, DAYS_PER_PEARL, finishChallenge } from './progress';
import { replay, type Tap } from './play';
import { GOES_PER_ROUND, GUIDED_KEY, LEVELS, levelFor, levelKeys, makeRound, parseKey, showRound, type Colour, type Round } from './round';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const secure = (keys: string[]): FactStats[] => keys.map((key) => ({ ...newStats(key), box: 2 }));
/** Records that put a child on each level. */
const recordsFor = { 1: [], 2: secure(levelKeys(1)), 3: secure([...levelKeys(1), ...levelKeys(2)]) } as Record<number, FactStats[]>;
const colours: Colour[] = ['bronze', 'silver', 'gold'];

/** One wrong shell on every go, then the right one. */
const wobblyTaps = (round: Round): Tap[] =>
  showRound(round).flatMap((go) => [{ pick: go.choices.find((c) => c !== go.answer)!, ms: 4000 }, { pick: go.answer, ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, stays in its level, and can be finished with a right shell on every go', () => {
    for (const { level, from, to } of LEVELS) {
      for (const colour of colours) {
        for (const seed of seeds) {
          const round = makeRound(seed, recordsFor[level], { colour });
          expect(round).toEqual(makeRound(seed, recordsFor[level], { colour }));
          expect(round.level).toBe(level);
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          expect(new Set(round.goes.map((g) => g.key)).size).toBe(GOES_PER_ROUND);
          const goes = showRound(round);
          for (const go of goes) {
            expect(go.whole).toBeGreaterThanOrEqual(from);
            expect(go.whole).toBeLessThanOrEqual(to);
            expect(go.showing + go.hiding).toBe(go.whole);
            expect(go.answer).toBe(go.kind === 'altogether' ? go.whole : go.hiding);
            expect(go.choices).toHaveLength(4);
            expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
            expect(go.choices.every((c) => Number.isInteger(c) && c >= 0)).toBe(true);
            expect(go.spoken).not.toContain(`${go.answer}?`);
          }
          // "None hiding" and "all hiding" at most once a round.
          expect(round.goes.filter((g) => { const p = parseKey(g.key)!; return p.shown === 0 || p.shown === p.whole; }).length).toBeLessThanOrEqual(1);
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND });
          // Each go counts once for the maths records: wrong, as the first shell was wrong.
          expect(end.answers).toEqual(goes.map((g) => ({ key: g.key, correct: false, ms: 4000 })));
          expect(() => replay(round, [{ pick: 999, ms: 1 }])).toThrow();
        }
      }
    }
  });

  it('asks altogether only on silver and gold days and two tides only on gold, never first, and the guided go first', () => {
    for (const seed of seeds) {
      const kinds = (colour: Colour) => makeRound(seed, recordsFor[2], { colour }).goes.map((g) => g.kind);
      expect(kinds('bronze').every((k) => k === 'hiding')).toBe(true);
      expect(kinds('silver').filter((k) => k === 'altogether')).toHaveLength(2);
      expect(kinds('silver')).not.toContain('twoTides');
      expect(kinds('gold').filter((k) => k === 'twoTides')).toHaveLength(2);
      // Altogether and two tides never use 0 or all hiding.
      for (const g of makeRound(seed, recordsFor[1], { colour: 'gold' }).goes.filter((x) => x.kind !== 'hiding')) {
        const p = parseKey(g.key)!;
        expect(p.shown > 0 && p.shown < p.whole, g.key).toBe(true);
      }
      for (const c of colours) expect(kinds(c)[0]).toBe('hiding');
      const guided = makeRound(seed, [], { guided: true });
      expect(guided.goes[0]).toEqual({ key: GUIDED_KEY, kind: 'hiding' });
      expect(new Set(guided.goes.map((g) => g.key)).size).toBe(GOES_PER_ROUND);
    }
  });
});

describe('the level', () => {
  it('moves up at 70% of a level secure and never drops back', () => {
    const one = levelKeys(1);
    const need = Math.ceil(one.length * 0.7);
    expect(levelFor(secure(one.slice(0, need - 1)))).toBe(1);
    expect(levelFor(secure(one.slice(0, need)))).toBe(2);
    expect(levelFor(recordsFor[3])).toBe(3);
    expect(levelFor(secure([...levelKeys(1), ...levelKeys(2), ...levelKeys(3)]))).toBe(3);
    expect(levelFor([], 2)).toBe(2);
  });
});

describe('the magic shells', () => {
  it('turn bronze, silver, then gold, one per NZ day, with a pearl and a new friend every 30 days', () => {
    expect(beachAfter(0)).toMatchObject({ pearls: 0, friend: 'pipi', help: 'full', today: 'bronze', shells: Array(10).fill('sand') });
    expect(beachAfter(10)).toMatchObject({ help: 'faint', today: 'silver', shells: Array(10).fill('bronze') });
    expect(beachAfter(21)).toMatchObject({ help: 'none', today: 'gold', shells: ['gold', ...Array(9).fill('silver')] });
    expect(beachAfter(DAYS_PER_PEARL)).toMatchObject({ pearls: 1, friend: 'korora', day: 0 });
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastShellDay: '2026-11-04', shellChanged: 0, pearl: false });
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, shellChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, shellChanged: 9, pearl: true });
  });
});

describe('the server rules', () => {
  it('starts with the guided go, finishes once, records each go, changes one shell a day and keeps the level', async () => {
    const { memoryServices } = await import('./memoryServices');
    const { handlePipi } = await import('./server');
    let now = Date.parse('2026-11-04T00:00:00Z');
    const log = { answers: [] as { player: string; once: string; answers: FactAnswer[] }[] };
    const services = memoryServices({ now: () => now, log });
    const ask = (body: Record<string, unknown>) => handlePipi(services, 'p1', body);
    expect((await ask({ action: 'load' })).body).toMatchObject({ daysDone: 0, level: 1, help: true, guided: true });
    const round = (await ask({ action: 'start' })).body.round as Round;
    expect(round.goes[0]).toEqual({ key: GUIDED_KEY, kind: 'hiding' });
    const taps = showRound(round).map((g) => ({ pick: g.answer, ms: 1500 }));
    expect((await ask({ action: 'finish', seed: round.seed, taps })).body).toMatchObject({ daysDone: 1, shellChanged: 0, pearl: false, level: 1 });
    expect((await ask({ action: 'finish', seed: round.seed, taps })).status).toBe(409);
    expect(log.answers[0].answers).toHaveLength(GOES_PER_ROUND);
    // Same day again: just for fun. The guided go is only ever the first time.
    const again = (await ask({ action: 'start' })).body.round as Round;
    expect((await ask({ action: 'load' })).body).toMatchObject({ guided: false });
    expect((await ask({ action: 'finish', seed: again.seed, taps: showRound(again).map((g) => ({ pick: g.answer, ms: 1500 })) })).body).toMatchObject({ daysDone: 1, shellChanged: null });
    now += 24 * 3600 * 1000;
    const next = (await ask({ action: 'start' })).body.round as Round;
    expect((await ask({ action: 'finish', seed: next.seed, taps: [{ pick: 99, ms: 1 }] })).status).toBe(400);
  });
});
