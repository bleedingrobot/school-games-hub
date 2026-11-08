import { describe, expect, it } from 'vitest';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { beachAfter, DAYS_PER_PEARL, finishChallenge } from './progress';
import { replay, wrongFirstRun, type Tap } from './play';
import { GOES_PER_ROUND, GUIDED_KEY, helpForStats, LEVELS, levelFor, levelKeys, makeRound, parseKey, REVIEW_GOES, showGo, showRound, type Colour, type Kind, type Round, type WrongKind } from './round';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const secure = (keys: string[]): FactStats[] => keys.map((key) => ({ ...newStats(key), box: 2 }));
/** Records that put a child on each level. */
const recordsFor = { 1: [], 2: secure(levelKeys(1)), 3: secure([...levelKeys(1), ...levelKeys(2)]) } as Record<number, FactStats[]>;
const colours: Colour[] = ['bronze', 'silver', 'gold'];

describe('the help in the sand (R6)', () => {
  it('follows each fact: full with no record, faint then none as it is learned, full again after a slip, and full on a new level', () => {
    const known = { ...newStats('k'), box: 4, correct: 6, quickDays: ['a', 'b'] };
    expect(helpForStats(undefined)).toBe('full');
    expect(helpForStats({ ...known, box: 2, correct: 3 })).toBe('faint');
    expect(helpForStats(known)).toBe('none');
    expect(helpForStats({ ...known, box: 1 })).toBe('full');
    // A child who knows every split to 5 and has moved to 6 and 7: those splits have no record, so every go starts full.
    const learned = levelKeys(1).map((key) => ({ ...known, key }));
    const round = makeRound(7, learned, { reached: 1 });
    expect(round.level).toBe(2);
    // (the review goes from the known earlier splits keep their own, quieter help.)
    expect(round.goes.filter((g) => !levelKeys(1).includes(g.key)).every((g) => g.h === 'full')).toBe(true);
    expect(round.goes.filter((g) => levelKeys(1).includes(g.key)).every((g) => g.h === 'none')).toBe(true);
    // Today's own record of a split, not another's, sets its help.
    const mixed = makeRound(7, [{ ...known, key: 'part7:2' }], { reached: 1 });
    expect(mixed.goes.every((g) => g.h === (g.key === 'part7:2' ? 'none' : 'full'))).toBe(true);
  });

  it('counts goes in a row, latest first, whose first shell was wrong', () => {
    const a = (...c: boolean[]) => c.map((correct) => ({ correct }));
    expect(wrongFirstRun(a())).toBe(0);
    expect(wrongFirstRun(a(false, true, false, false))).toBe(2);
    expect(wrongFirstRun(a(false, false, false, true))).toBe(0);
  });
});

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
      expect(guided.goes[0]).toEqual({ key: GUIDED_KEY, kind: 'hiding', h: 'full' });
      expect(new Set(guided.goes.map((g) => g.key)).size).toBe(GOES_PER_ROUND);
    }
  });
});

describe('the wrong shells (maths review R5)', () => {
  const allowed: Record<Kind, WrongKind[]> = { hiding: ['shown', 'whole', 'add', 'off1'], altogether: ['part', 'off1'], twoTides: ['before', 'whole', 'off1'] };

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

  it('tags the number showing, the whole, the sum and the first tide with what they are', () => {
    for (const seed of seeds.slice(0, 20)) {
      const hiding = showGo({ seed }, 0, { key: 'part9:3', kind: 'hiding' })!; // answer 6; showing 3; whole 9; sum 12
      for (const w of hiding.wrongs) expect(w.kind).toBe({ 3: 'shown', 9: 'whole', 12: 'add' }[w.n] ?? 'off1');
      const tides = showGo({ seed }, 0, { key: 'part9:3', kind: 'twoTides' })!;
      for (const w of tides.wrongs) expect(w.kind).toBe({ 3: 'before', 9: 'whole' }[w.n] ?? 'off1');
    }
    const together = showGo({ seed: 5 }, 0, { key: 'part7:4', kind: 'altogether' })!; // answer 7; the parts are 4 and 3
    for (const w of together.wrongs) expect(w.kind).toBe({ 4: 'part', 3: 'part' }[w.n] ?? 'off1');
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
