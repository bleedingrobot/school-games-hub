import { describe, expect, it } from 'vitest';
import { seeded } from '../seededRandom';
import { newStats, type FactStats } from '../maths/leitner';
import { DAYS_PER_FISH, finishChallenge, poolAfter } from './progress';
import { replay, type Tap } from './play';
import { sharingTell } from '../kit/mistakes';
import { emptyData, memoryServices } from './memoryServices';
import { handleKorora } from './server';
import { followsItsDouble, FAIR_GOES, GOES_PER_ROUND, GUIDED_KEY, helpForStats, LEVELS, levelFor, levelKeys, makeRound, mistakeChoices, showRound, topSecure, type Level, type Round, type WrongKind } from './round';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const secure = (keys: string[]): FactStats[] => keys.map((key) => ({ ...newStats(key), box: 2 }));
/** Records that put a child on each level. */
const recordsFor = (level: Level) => secure(LEVELS.filter((l) => l.level < level).flatMap((l) => levelKeys(l.level)));

/** One wrong pick on every go, then the right one. */
const wobblyTaps = (round: Round): Tap[] =>
  showRound(round).flatMap((go) => [{ pick: go.choices.find((c) => c !== go.answer)!, ms: 4000 }, { pick: go.answer, ms: 2000 }]);

describe('the picture help (R6)', () => {
  it('follows each fact: full with no record, faint then none as it is learned, full again after a slip, and full on a new level', () => {
    const known = { ...newStats('k'), box: 4, correct: 6, quickDays: ['a', 'b'] };
    expect(helpForStats(undefined)).toBe('full');
    expect(helpForStats({ ...known, box: 2, correct: 3 })).toBe('faint');
    expect(helpForStats(known)).toBe('none');
    expect(helpForStats({ ...known, box: 1 })).toBe('full');
    // S25: right and quick twice on one day leaves full help; a wrong answer brings it back.
    const quick1 = { ...newStats('k'), box: 2, correct: 2, attempts: 2, quickDays: ['a'] };
    expect(helpForStats(quick1)).toBe('faint');
    expect(helpForStats({ ...quick1, box: 1, attempts: 3 })).toBe('full');
    // A child who knows every double to 5 and has just moved to halves to 10: those facts have no record, so every go starts full.
    const learned = levelKeys(1).map((key) => ({ ...known, key }));
    const halves = makeRound(7, learned, { reached: 1 });
    expect(halves.level).toBe(2);
    const half = halves.goes.filter((g) => g.key.startsWith('half:'));
    expect(half.length).toBeGreaterThanOrEqual(5);
    expect(half.every((g) => g.h === 'full')).toBe(true);
    expect(halves.goes.filter((g) => g.key.startsWith('dbl:')).every((g) => g.h === 'none')).toBe(true);
  });
});

describe('the round', () => {
  it('is the same for the same seed, asks every fact of the level, never one twice in a row, and each fact counts once', () => {
    for (const { level } of LEVELS) {
      for (const gold of [false, true]) {
        for (const seed of seeds) {
          const round = makeRound(seed, recordsFor(level), { gold });
          expect(round).toEqual(makeRound(seed, recordsFor(level), { gold }));
          expect(round.level).toBe(level);
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          const keys = round.goes.map((g) => g.key);
          for (const k of levelKeys(level)) expect(keys).toContain(k);
          keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
          expect(keys.slice(-FAIR_GOES).every((k) => k.startsWith('oddeven:'))).toBe(gold);
          expect(keys.some((k) => k.startsWith('half:') && round.goes.find((g) => g.key === k)!.v !== 0)).toBe(false);
          const goes = showRound(round);
          for (const go of goes) {
            expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
            expect(go.choices).toHaveLength(go.kind === 'fair' ? 2 : 4);
            // Fair or not (R9): a pile of 6 to 20 (to 10 on the first two levels); even is fair, odd is one too many, one too few is never right.
            if (go.kind === 'fair') {
              expect(go.n).toBeGreaterThanOrEqual(6);
              expect(go.n).toBeLessThanOrEqual(level <= 2 ? 10 : 20);
              expect(go.answer).toBe(go.n % 2 === 0 ? 1 : 0);
              expect([...go.choices].sort()).toEqual([0, 1]);
            }
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND });
          expect(end.answers.map((a) => a.key)).toEqual([...new Set(keys)]);
          expect(end.answers.every((a) => !a.correct)).toBe(true);
          expect(() => replay(round, [{ pick: 999, ms: 1 }])).toThrow();
        }
      }
    }
    // A double comes just before its half when a round has both (double 4, then half of 8).
    const paired = seeds.map((seed) => makeRound(seed, recordsFor(2))).flatMap((r) => r.goes.map((g, i) => ({ g, i, r })))
      .filter(({ g }) => g.key === 'dbl:4').filter(({ r }) => r.goes.some((x) => x.key === 'half:8'));
    expect(paired.length).toBeGreaterThan(0);
    for (const { i, r } of paired) expect(followsItsDouble(r.goes, i + 1) || r.goes[i + 1]?.key !== 'half:8').toBe(true);
    expect(paired.filter(({ i, r }) => followsItsDouble(r.goes, i + 1)).length).toBeGreaterThan(paired.length / 2);
    // The very first challenge starts with double 2.
    for (const seed of seeds) expect(makeRound(seed, [], { guided: true }).goes[0].key).toBe(GUIDED_KEY);
  });
});

describe('the finish words (S33)', () => {
  it('count every go right at the first tap, not once per fact, and not a guess faster than the think floor', () => {
    const round = makeRound(seeds[0], recordsFor(1), { gold: false });
    const right = showRound(round).map((go) => ({ pick: go.answer, ms: 2000 }));
    expect(replay(round, right).firstRight).toBe(GOES_PER_ROUND);
    expect(replay(round, wobblyTaps(round)).firstRight).toBe(0);
    expect(replay(round, right.map((t, i) => (i < 2 ? { ...t, ms: 100 } : t))).firstRight).toBe(GOES_PER_ROUND - 2);
  });
});

describe('the wrong stones (mistakes that teach)', () => {
  const doubles = [...Array(10)].map((_, i) => i + 1);
  const halves = [...Array(10)].map((_, i) => (i + 1) * 2);
  const allowed: Record<'double' | 'half', WrongKind[]> = { double: ['same', 'plus1', 'plus2', 'miscount'], half: ['all', 'minus2', 'double', 'miscount'] };

  it('are three real mistakes each, tagged, never n times n, never a lone shape, and the same every time for a seed', () => {
    for (const seed of seeds) {
      for (const [kind, ns] of [['double', doubles], ['half', halves]] as const) {
        for (const n of ns) {
          const answer = kind === 'double' ? 2 * n : n / 2;
          const a = mistakeChoices(kind, n, seeded(seed));
          expect(a).toEqual(mistakeChoices(kind, n, seeded(seed)));
          expect(a.choices).toHaveLength(4);
          expect(a.choices.filter((c) => c === answer)).toHaveLength(1);
          expect(new Set(a.choices).size).toBe(4);
          expect(a.wrongs).toHaveLength(3);
          expect([...a.wrongs.map((w) => w.n), answer].sort()).toEqual([...a.choices].sort());
          for (const w of a.wrongs) {
            expect(allowed[kind]).toContain(w.kind);
            expect(w.n).toBeGreaterThanOrEqual(1);
            if (w.kind === 'plus2') expect(n).toBeGreaterThanOrEqual(3);
            if (w.kind === 'miscount') expect(Math.abs(w.n - answer)).toBeLessThanOrEqual(3);
          }
          // No times-tables slip (25 for 5 + 5), unless the miscount happens to be that close.
          if (kind === 'double' && n * n !== answer && Math.abs(n * n - answer) > 3) expect(a.choices).not.toContain(n * n);
          // At most two of the four share the answer's shape (odd or even).
          expect(sharingTell(answer, a.choices, (x) => x % 2)).toBeLessThanOrEqual(2);
        }
      }
    }
    // Big doubles show the real slips: 5 + 5 never offers 25, and double 6 offers 6 (same) and 8 (plus 2) among its slips.
    const kinds = new Set(seeds.flatMap((seed) => mistakeChoices('double', 6, seeded(seed)).wrongs.map((w) => `${w.kind}:${w.n}`)));
    expect(kinds).toContain('same:6');
    expect(kinds).toContain('plus2:8');
    expect(kinds).toContain('plus1:7');
    expect(seeds.some((seed) => mistakeChoices('half', 12, seeded(seed)).wrongs.some((w) => w.kind === 'all' && w.n === 12))).toBe(true);
  });

  it('are the same on the server (a rebuilt round gives the same stones) and fair or not has its two choices', () => {
    for (const seed of seeds.slice(0, 20)) {
      const round = makeRound(seed, recordsFor(4), { gold: true });
      showRound(round).forEach((go, i, all) => {
        expect(go).toEqual(showRound(makeRound(seed, recordsFor(4), { gold: true }))[i]);
        expect(go.wrongs).toHaveLength(go.kind === 'fair' ? 0 : 3);
        expect(go.choices).toHaveLength(go.kind === 'fair' ? 2 : 4);
        expect(all).toHaveLength(GOES_PER_ROUND);
      });
    }
  });

  it('score only the first tap of a go: two wrong taps, a wrong one in "Now you try", then right, is one wrong answer', () => {
    for (const seed of seeds.slice(0, 10)) {
      const round = makeRound(seed, recordsFor(2));
      const taps = showRound(round).flatMap((go): Tap[] => {
        const [a, b] = go.wrongs;
        return [{ pick: a.n, ms: 3000 }, { pick: b.n, ms: 3000 }, { pick: a.n, ms: 9000 }, { pick: go.answer, ms: 1000 }];
      });
      const end = replay(round, taps);
      expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: 3 * GOES_PER_ROUND });
      expect(end.answers.every((x) => !x.correct && x.ms === 3000)).toBe(true);
      expect(end.answers.map((x) => x.key)).toEqual([...new Set(round.goes.map((g) => g.key))]);
    }
  });
});

describe('the level', () => {
  it('moves up once 70% of a level is secure, and never drops back', () => {
    const one = levelKeys(1);
    expect(levelFor(secure(one.slice(0, 3)))).toBe(1);
    expect(levelFor(secure(one.slice(0, 4)))).toBe(2);
    expect(levelFor(recordsFor(4))).toBe(4);
    expect(levelFor(recordsFor(5))).toBe(5);
    expect(levelFor(secure(LEVELS.flatMap((l) => levelKeys(l.level))))).toBe(5);
    expect(levelFor([], 3)).toBe(3);
  });
});

describe('near doubles (R8, level 5)', () => {
  const near = (n: number) => `add:${n}+${n + 1}`;

  it('asks 5 + 6 to 8 + 9 from Weka\'s add keys, with the right answers, real slips and the double-and-one picture', () => {
    expect(levelKeys(5)).toEqual([5, 6, 7, 8].map(near));
    for (const seed of seeds.slice(0, 20)) {
      const round = makeRound(seed, recordsFor(5), { gold: true });
      expect(round.level).toBe(5);
      for (const go of showRound(round).filter((g) => g.kind === 'near')) {
        expect(go.answer).toBe(2 * go.n + 1);
        expect(go.parts).toEqual([String(go.n), '+', String(go.n + 1), '=', '?']);
        expect(go.wrongs).toHaveLength(3);
        expect(go.wrongs.map((w) => w.kind)).toContain('noExtra');
        expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
        expect(sharingTell(go.answer, go.choices, (x) => x % 2)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('is reached only when level 4 is secure, is recorded under the add key, and the finish says when near doubles are secure', async () => {
    expect(topSecure(secure(levelKeys(5).slice(0, 3)))).toBe(true);
    expect(topSecure(secure(levelKeys(5).slice(0, 2)))).toBe(false);
    for (const [count, expected] of [[3, true], [2, false]] as const) {
      const data = emptyData();
      data.facts.p = secure([...LEVELS.filter((l) => l.level < 5).flatMap((l) => levelKeys(l.level)), ...levelKeys(5).slice(0, count)]);
      data.players.p = { daysDone: 3, lastPebbleDay: null, reached: 5, version: 1 };
      const services = memoryServices({ data });
      const started = await handleKorora(services, 'p', { action: 'start' });
      const round = started.body.round as Round;
      const done = await handleKorora(services, 'p', { action: 'finish', seed: round.seed, taps: showRound(round).map((g) => ({ pick: g.answer, ms: 1000 })) });
      expect(done.body).toMatchObject({ level: 5, topSecure: expected });
      expect(data.players.p.reached).toBe(5);
      expect(done.body.topSecure).toBe(expected);
    }
  });
});

describe('the magic pebbles', () => {
  it('turn bronze, silver, then gold, one per NZ day, with a Golden Fish and a new friend every 30 days', () => {
    expect(poolAfter(0)).toMatchObject({ fish: 0, friend: 'korora', help: 'full', gold: false, pebbles: Array(10).fill('grey') });
    expect(poolAfter(10)).toMatchObject({ help: 'faint', today: 'silver', pebbles: Array(10).fill('bronze') });
    expect(poolAfter(21)).toMatchObject({ help: 'none', gold: true, pebbles: ['gold', ...Array(9).fill('silver')] });
    expect(poolAfter(DAYS_PER_FISH)).toMatchObject({ fish: 1, friend: 'hoiho', day: 0 });
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastPebbleDay: '2026-11-04', pebbleChanged: 0, goldenFish: false, shoesWon: null });
    expect(finishChallenge(9, null, '2026-11-04')).toMatchObject({ daysDone: 10, shoesWon: 'bronze', goldenFish: false });
    expect(finishChallenge(19, null, '2026-11-04')).toMatchObject({ daysDone: 20, shoesWon: 'silver' });
    expect(poolAfter(0).shoes).toBeNull();
    expect(poolAfter(10).shoes).toBe('bronze');
    expect(poolAfter(25).shoes).toBe('silver');
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, pebbleChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, pebbleChanged: 9, goldenFish: true, shoesWon: 'gold' });
  });
});
