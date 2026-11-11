import { describe, expect, it } from 'vitest';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { replay, type Tap } from './play';
import { GOES_PER_ROUND, GUIDED_KEY, LEVELS, levelFor, levelKeys, makeRound, parseKey, REVIEW_GOES, showGo, showRound, type Colour, type Kind, type Round, type WrongKind } from './round';

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
    for (const { level, to } of LEVELS) {
      for (const colour of colours) {
        for (const seed of seeds) {
          const round = makeRound(seed, recordsFor[level], { colour });
          expect(round).toEqual(makeRound(seed, recordsFor[level], { colour }));
          expect(round.level).toBe(level);
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          expect(new Set(round.goes.map((g) => g.key)).size).toBe(GOES_PER_ROUND);
          const goes = showRound(round);
          for (const go of goes) {
            expect(go.whole).toBeLessThanOrEqual(to);
            expect(go.showing + go.hiding).toBe(go.whole);
            expect(go.answer).toBe(go.kind === 'altogether' ? go.whole : go.hiding);
            expect(go.choices).toHaveLength(4);
            expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
            expect(go.choices.every((c) => Number.isInteger(c) && c >= 0)).toBe(true);
            expect(go.spoken).not.toContain(`${go.answer}?`);
          }
          // From level 2, two goes (never the first) revisit earlier levels; level 1 has none.
          const earlier = new Set(LEVELS.filter((l) => l.level < level).flatMap((l) => levelKeys(l.level)));
          const reviews = round.goes.map((g, i) => (earlier.has(g.key) ? i : -1)).filter((i) => i >= 0);
          expect(reviews).toHaveLength(level === 1 ? 0 : REVIEW_GOES);
          expect(reviews).not.toContain(0);
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

});

describe('the wrong shells (maths review R5)', () => {
  const allowed: Record<Kind, WrongKind[]> = { hiding: ['shown', 'whole', 'off1'], altogether: ['part', 'off1'], twoTides: ['before', 'whole', 'off1'] };

  it('has three tagged wrong shells on every go: no repeat, at most 2 the answer\'s odd or even, always a one-off near miss', () => {
    for (const kind of Object.keys(allowed) as Kind[]) {
      for (const { from, to } of LEVELS) {
        for (let whole = from; whole <= to; whole++) {
          for (let shown = 0; shown <= whole; shown++) {
            for (const seed of seeds.slice(0, 12)) {
              const go = showGo({ seed }, 3, { key: `part${whole}:${shown}`, kind });
              if (!go) continue;
              const label = `${kind} part${whole}:${shown} seed ${seed}`;
              expect(go.choices, label).toHaveLength(4);
              expect(new Set(go.choices).size, label).toBe(4);
              expect(go.wrongs.map((w) => w.n).sort(), label).toEqual(go.choices.filter((c) => c !== go.answer).sort());
              // The answer is part of the whole, so no shell is bigger than the pipi.
              if (kind !== 'altogether') expect(Math.max(...go.choices), label).toBeLessThanOrEqual(whole);
              expect(go.wrongs.every((w) => allowed[kind].includes(w.kind)), label).toBe(true);
              expect(go.choices.filter((c) => c % 2 === go.answer % 2).length, label).toBeLessThanOrEqual(2);
              expect(go.wrongs.some((w) => Math.abs(w.n - go.answer) === 1), label).toBe(true);
              expect(showGo({ seed }, 3, { key: go.key, kind })).toEqual(go);
            }
          }
        }
      }
    }
  });

  it('scores only the first shell of a go, however many wrong ones follow, and takes a redo after two wrong', () => {
    const round = makeRound(11, [], { colour: 'gold' });
    const goes = showRound(round);
    const taps: Tap[] = goes.flatMap((go) => {
      const [w1, w2, w3] = go.choices.filter((c) => c !== go.answer);
      // wrong, wrong ("Let's look together"), then the redo: another wrong and the right shell
      return [w1, w2, w3, go.answer].map((pick, i) => ({ pick, ms: 3000 + i }));
    });
    const end = replay(round, taps);
    expect(end).toMatchObject({ done: true, mistakes: GOES_PER_ROUND * 3 });
    expect(end.answers).toEqual(goes.map((g) => ({ key: g.key, correct: false, ms: 3000 })));
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
    expect(round.goes[0]).toEqual({ key: GUIDED_KEY, kind: 'hiding', h: 'full' });
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
