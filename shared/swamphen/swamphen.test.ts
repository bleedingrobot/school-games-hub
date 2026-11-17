import { describe, expect, it } from 'vitest';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { EARLY_FACTS } from '../maths/skillPacks/earlyFacts';
import { factKey } from '../maths/facts';
import { GOOD_TO_PASS, REED_ROWS, TOP_STEP } from './config';
import { DAYS_PER_GARDEN, finishChallenge, gardenAfter } from './progress';
import { replay, type Tap } from './play';
import {
  EQUAL_KEYS, GOES_PER_ROUND, GUIDED_KEY, KEYS, STEPS, STEP_KEYS, isBigGarden, keyPair, kindLevelsAfter, kindLevelsForStep, kindOfKey, kindsOfKey,
  makeRound, mulKeyOf, newGoes, pictureCode, pictureFor, pictureOf, placeAfter, rowLengths, showGo, showRound, sisterGo, startFor, stepKinds, viewFor,
  type HelpLevel, type HelpSetting, type Place, type Round, type Step,
} from './round';
import { handleSwamphen, unplayed } from './server';
import { emptyData, memoryServices } from './memoryServices';
import { slipSummary, usualSlip } from './teacher';

const seeds = Array.from({ length: 30 }, (_, i) => i * 10007 + 1);
const inBox = (keys: string[], box: number): FactStats[] => keys.map((key) => ({ ...newStats(key), box }));
const steps = STEPS.map((s) => s.step);
const pictureKinds = ['which', 'turn', 'equal'];

type Shown = ReturnType<typeof showRound>[number];
const wrongTap = (go: Shown): number => go.choices.find((c) => c !== go.answer)!;
const wobblyTaps = (round: Round): Tap[] => showRound(round).flatMap((go) => [{ pick: wrongTap(go), ms: 4000 }, { pick: go.answer, ms: 2000 }]);
const perfectTaps = (round: Round): Tap[] => showRound(round).map((g) => ({ pick: g.answer, ms: 3000 }));

describe('the ladder', () => {
  it('has nine steps, small numbers first, and the 6s to 9s only in the Big Garden', () => {
    expect(steps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(TOP_STEP).toBe(9);
    expect(steps.filter(isBigGarden)).toEqual([8, 9]);
    // Every step's keys are its own kinds, and every key can be replayed.
    for (const step of steps) {
      expect(STEP_KEYS[step].length).toBeGreaterThan(0);
      for (const key of STEP_KEYS[step]) {
        expect(KEYS).toContain(key);
        expect(stepKinds(step)).toContain(kindOfKey(key, step));
      }
    }
    const biggest = (step: Step) => Math.max(...STEP_KEYS[step].map((k) => (k.startsWith('share:') ? keyPair(k)[0] : keyPair(k)[0] * keyPair(k)[1])));
    expect(biggest(1)).toBeLessThanOrEqual(12);
    expect(STEP_KEYS[2].every((k) => keyPair(k)[1] === 2)).toBe(true);
    expect(STEP_KEYS[3].every((k) => [5, 10].includes(keyPair(k)[1]))).toBe(true);
    expect(biggest(4)).toBeLessThanOrEqual(20);
    expect(biggest(5)).toBeLessThanOrEqual(15);
    expect(STEP_KEYS[6].every((k) => [3, 4].includes(keyPair(k)[1]))).toBe(true);
    // Under the mat only hides facts the child has met: rows of 2, 3, 4, 5 and 10.
    expect(STEP_KEYS[7].every((k) => [2, 3, 4, 5, 10].includes(keyPair(k)[1]))).toBe(true);
    // Nothing before the Big Garden has more than 5 rows or a row of 6 to 9.
    for (const step of [1, 2, 3, 4, 5, 6, 7] as Step[]) {
      for (const k of STEP_KEYS[step]) {
        if (k.startsWith('share:')) continue;
        expect(keyPair(k)[0]).toBeLessThanOrEqual(5);
        expect([6, 7, 8, 9]).not.toContain(keyPair(k)[1]);
      }
    }
    expect(STEP_KEYS[8].every((k) => [6, 7].includes(keyPair(k)[0]))).toBe(true);
    expect(STEP_KEYS[9].every((k) => [8, 9].includes(keyPair(k)[0]))).toBe(true);
    // Rows are planted except under the mat; a key from the old ladder (6 to 9 in a row) is still under the mat.
    expect(kindOfKey('rows:3x4', 6)).toBe('plant');
    expect(kindOfKey('rows:3x4', 7)).toBe('mat');
    expect(kindOfKey('rows:3x7')).toBe('mat');
    expect(kindsOfKey('rows:3x4')).toEqual(['plant', 'mat']);
    expect(kindOfKey('cut:9x4')).toBe('short');
    expect(kindOfKey('equal:3x4')).toBe('equal');
  });
});

describe('the round', () => {
  it('is the same for the same seed, eases new goes in, never has more than two kinds, and has fair cards that match their slips', () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
    for (const step of steps) {
      for (const days of [0, 1, 2, 5]) {
        for (const level of [5, 2, 0] as HelpLevel[]) {
          for (const seed of seeds) {
            const records = inBox(KEYS.slice(0, 6), 2);
            const round = makeRound(seed, records, { step, level, daysAtStep: days });
            expect(round).toEqual(makeRound(seed, records, { step, level, daysAtStep: days }));
            expect(round.goes).toHaveLength(GOES_PER_ROUND);
            const keys = round.goes.map((g) => g.key);
            keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
            // The step's own goes: 3, then 5, then 7 (all ten at step 1, or when nothing earlier fits).
            const own = round.goes.filter((g) => STEP_KEYS[step].includes(g.key) && stepKinds(step).includes(g.kind)).length;
            expect(own).toBeGreaterThanOrEqual(newGoes(step, days));
            // A day never has more than two kinds; a two-kind step starts with its first kind alone.
            const kinds = new Set(round.goes.map((g) => g.kind));
            expect(kinds.size).toBeLessThanOrEqual(2);
            if (days === 0) expect(round.goes.some((g) => g.kind === stepKinds(step)[1] && STEP_KEYS[step].includes(g.key))).toBe(false);
            for (const go of showRound(round)) {
              expect(go.l).toBe(level);
              expect(kindsOfKey(go.key)).toContain(go.kind);
              expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
              expect(go.choices).toHaveLength(4);
              expect(go.wrongs).toHaveLength(3);
              expect(new Set(go.choices).size).toBe(4);
              for (const w of go.wrongs) expect(go.choices).toContain(w.n);
              if (!pictureKinds.includes(go.kind)) {
                expect([...go.choices]).toEqual([...go.choices].sort((a, b) => a - b));
                expect(go.choices.filter((c) => c % 10 === go.answer % 10).length).toBeLessThanOrEqual(2);
              }
              const [a, b] = keyPair(go.key);
              if (go.kind === 'share') expect(go.answer * go.rows).toBe(go.total);
              else expect(go.total).toBe(a * b);
            }
            const end = replay(round, wobblyTaps(round));
            expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND, firstRight: 0 });
            expect(end.answers.every((x) => !x.correct)).toBe(true);
            expect(end.slips).toHaveLength(GOES_PER_ROUND);
            expect(() => replay(round, [{ pick: 1234, ms: 1 }])).toThrow();
          }
        }
      }
    }
    expect([0, 1, 2, 3, 9].map((d) => newGoes(4, d))).toEqual([3, 5, 7, 7, 7]);
    expect(newGoes(1, 0)).toBe(10);
    // The teacher's setting: Always keeps level 4, Off is level 0 (no Peek).
    for (const [help, l] of [['always', 4], ['off', 0], ['fade', 2]] as [HelpSetting, number][]) {
      expect(makeRound(9, [], { level: 2, help }).goes.every((g) => g.l === l)).toBe(true);
    }
    // The very first challenge starts with 2 rows of 2, every row shaded and counted, and it cannot fail.
    for (const seed of seeds) expect(makeRound(seed, [], { guided: true, daysAtStep: 0 }).goes[0]).toMatchObject({ key: GUIDED_KEY, kind: 'plant', l: 5 });
    // Less picture as help fades; a wrong tap brings it back, and the third leaves two cards.
    expect([5, 4, 3, 2, 1, 0].map((l) => viewFor(l as HelpLevel))).toEqual(['count', 'rows', 'bars', 'edges', 'peek', 'plain']);
    const go = { l: 0 as HelpLevel, choices: [8, 12, 15, 24], answer: 24 };
    expect(pictureFor(go, 1).level).toBe(3);
    expect(pictureFor(go, 2).level).toBe(5);
    expect(pictureFor({ ...go, l: 1 }, 1)).toMatchObject({ level: 1, peekOpen: true });
    expect(pictureFor(go, 3, [8]).choices).toEqual([12, 24]);
    for (const l of [0, 1, 3] as HelpLevel[]) {
      expect(pictureFor({ ...go, l }, 0, [], true)).toMatchObject({ level: 5, peekOpen: false });
      expect(pictureFor({ ...go, l }, 1, [], true)).toMatchObject({ level: 5, peekOpen: false });
    }
  });

  it('asks "which garden has equal rows?" with uneven gardens and a scatter as the wrong pictures, and never records it', () => {
    for (const key of EQUAL_KEYS) {
      const [r, c] = keyPair(key);
      for (let seed = 1; seed <= 50; seed++) {
        const go = showGo({ seed }, 0, { key, kind: 'equal', l: 5 })!;
        expect(go.answer).toBe(pictureCode(r, c));
        expect(go.wrongs.map((w) => w.kind).sort()).toEqual(['scatter', 'uneven', 'uneven']);
        for (const w of go.wrongs.filter((x) => x.kind === 'uneven')) {
          const lengths = rowLengths(pictureOf(w.n));
          expect(lengths).toHaveLength(r);
          expect(new Set(lengths).size).toBe(2);
        }
        expect(rowLengths(pictureOf(go.answer))).toEqual(Array(r).fill(c));
      }
      expect(mulKeyOf(key)).toBeNull();
    }
    const round = makeRound(3, [], { step: 1 });
    expect(round.goes.every((g) => g.kind === 'equal')).toBe(true);
    expect(replay(round, perfectTaps(round)).answers).toEqual([]);
    // A challenge saved on the old ladder still replays (rows of 7 under the mat).
    const old: Round = { seed: 4, step: 3, level: 3, help: 'fade', goes: Array.from({ length: GOES_PER_ROUND }, (_, i) => ({ key: i % 2 ? 'rows:3x7' : 'rows:4x8', kind: 'mat' as const, l: 3 as HelpLevel })) };
    expect(replay(old, perfectTaps(old)).firstRight).toBe(10);
  });
});

describe('the step and the help level', () => {
  const at = (p: Partial<Place>): Place => ({ step: 1, level: 5, goodInRow: 0, goodAtStep: 0, daysAtStep: 0, hardInRow: 0, ...p });

  it('passes a step after three good days, fades help after two in a row, and takes a child back a step, quietly, after two hard days', () => {
    expect(GOOD_TO_PASS).toBe(3);
    expect(placeAfter(at({}), 9)).toEqual(at({ goodInRow: 1, goodAtStep: 1, daysAtStep: 1 }));
    // A day in the middle counts a day but moves nothing else.
    expect(placeAfter(at({ level: 2, goodInRow: 1, daysAtStep: 2 }), 6)).toEqual(at({ level: 2, daysAtStep: 3 }));
    // Help fades after two good days in a row, and comes back one level after a hard one.
    expect(placeAfter(at({ level: 3, goodInRow: 1, goodAtStep: 1, daysAtStep: 1 }), 9)).toEqual(at({ level: 2, goodAtStep: 2, daysAtStep: 2 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1, daysAtStep: 1 }), 4)).toEqual(at({ level: 3, daysAtStep: 2, hardInRow: 1 }));
    // Three good days pass the step, and the new step starts with full help and new goes easing in.
    expect(placeAfter(at({ step: 3, level: 1, goodInRow: 0, goodAtStep: 2, daysAtStep: 4 }), 10)).toEqual(at({ step: 4, level: 5 }));
    // Two hard days in a row: back one step, full help, and one good day there moves the child on again.
    const back = placeAfter(at({ step: 6, level: 2, hardInRow: 1, goodAtStep: 1, daysAtStep: 3 }), 3);
    expect(back).toEqual(at({ step: 5, level: 5, goodAtStep: GOOD_TO_PASS - 1, daysAtStep: 3 }));
    expect(placeAfter(back, 9).step).toBe(6);
    // Step 1 never goes back; step 9 is never passed.
    expect(placeAfter(at({ step: 1, hardInRow: 1 }), 2).step).toBe(1);
    expect(placeAfter(at({ step: 9, goodAtStep: 5 }), 10).step).toBe(9);
    // Who starts where: the 2 to 5 times tables secure (under the mat, not the Big Garden), counting by fives and tens, or neither.
    const tables = [2, 3, 4, 5].flatMap((t) => Array.from({ length: 13 - t }, (_, i) => factKey(t, t + i)));
    expect(startFor(inBox(tables, 2))).toEqual({ step: 7, level: 3 });
    const skips = [...EARLY_FACTS.families.skip5.keys, ...EARLY_FACTS.families.skip10.keys];
    expect(startFor(inBox(skips, 2))).toEqual({ step: 3, level: 5 });
    expect(startFor(inBox(EARLY_FACTS.families.skip5.keys, 2))).toEqual({ step: 1, level: 5 });
    expect(startFor([])).toEqual({ step: 1, level: 5 });

    // The reed rows: bronze, silver, then gold, one per NZ day, a Golden Reed Garden and a new friend every 30 days.
    expect(gardenAfter(0)).toMatchObject({ prizes: 0, friend: 'swamphen', today: 'bronze', rows: Array(REED_ROWS).fill('mud') });
    expect(gardenAfter(21)).toMatchObject({ today: 'gold', rows: ['gold', ...Array(9).fill('silver')] });
    expect(gardenAfter(DAYS_PER_GARDEN)).toMatchObject({ prizes: 1, friend: 'pigeon', day: 0 });
    expect(finishChallenge(0, null, '2026-11-08')).toEqual({ daysDone: 1, lastDay: '2026-11-08', rowChanged: 0, goldenGarden: false });
    expect(finishChallenge(1, '2026-11-08', '2026-11-08')).toMatchObject({ daysDone: 1, rowChanged: null });
    expect(finishChallenge(29, '2026-11-08', '2026-11-20')).toMatchObject({ daysDone: 30, rowChanged: 9, goldenGarden: true });
  });

  it('keeps a hard kind at its level while another fades, shows each go at its kind’s level, and a new step’s own kinds start at full help', () => {
    const goes = (...rows: [string, number, number][]) => rows.flatMap(([kind, n, right]) => Array.from({ length: n }, (_, i) => ({ kind, right: i < right })));
    let kinds = { plant: { level: 3, goodInRow: 0 }, cut: { level: 3, goodInRow: 0 } };
    for (let day = 0; day < 2; day++) kinds = kindLevelsAfter(kinds, goes(['plant', 5, 5], ['cut', 5, 3]), 3) as typeof kinds;
    expect(kinds.plant).toEqual({ level: 2, goodInRow: 0 });
    expect(kinds.cut.level).toBe(3);
    const round = makeRound(11, [], { step: 6, level: 4, kindLevels: { plant: { level: 1, goodInRow: 0 } } });
    for (const go of round.goes) expect(go.l).toBe(go.kind === 'plant' ? 1 : 4);
    expect(makeRound(11, [], { step: 1, level: 3, guided: true, kindLevels: { plant: { level: 0, goodInRow: 0 } } }).goes[0].l).toBe(5);
    expect(kindLevelsForStep({ plant: { level: 1, goodInRow: 0 }, share: { level: 2, goodInRow: 1 } }, 6)).toEqual({ share: { level: 2, goodInRow: 1 } });
  });
});

describe('the server', () => {
  it('starts a challenge, replays the taps, records each key once (and the plain times key beside it), counts the day once, eases a new step in and steps back after two hard days', async () => {
    const log = { answers: [] as { player: string; once: string; answers: FactAnswer[] }[], gardens: [] as string[] };
    let seedCounter = 0.37;
    let clock = Date.parse('2026-11-08T02:00:00Z');
    const services = memoryServices({ now: () => clock, random: () => (seedCounter = (seedCounter * 7919 + 0.137) % 1), log });
    const play = async (taps: (r: Round) => Tap[]) => {
      const round = (await handleSwamphen(services, 'p1', { action: 'start' })).body.round as Round;
      const done = await handleSwamphen(services, 'p1', { action: 'finish', seed: round.seed, taps: taps(round) });
      clock += 86_400_000;
      return { round, body: done.body };
    };
    const started = await handleSwamphen(services, 'p1', { action: 'start' });
    expect(started.status).toBe(200);
    const round = started.body.round as Round;
    expect(round.goes[0].key).toBe(GUIDED_KEY);
    expect(round.goes.slice(1).every((g) => g.kind === 'equal')).toBe(true);
    const perfect = perfectTaps(round);
    expect((await handleSwamphen(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect.slice(0, 5) })).body.code).toBe('not-done');
    const done = await handleSwamphen(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect });
    expect(done.body).toMatchObject({ daysDone: 1, rowChanged: 0, firstRight: 10, step: 1 });
    // Only the planted go is a fact to record (and its plain times key); equal rows are not.
    expect(log.answers).toHaveLength(1);
    expect(log.answers[0].answers.map((a) => a.key)).toEqual([GUIDED_KEY, 'mul:2x2']);
    expect((await handleSwamphen(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect })).body.code).toBe('ended');
    // Three good days pass the step; the next step starts with 3 of its own goes and full help.
    clock += 86_400_000;
    expect((await play(perfectTaps)).body).toMatchObject({ daysDone: 2, step: 1 });
    const third = await play(perfectTaps);
    expect(third.body).toMatchObject({ daysDone: 3, step: 2, stepBefore: 1, level: 5 });
    const firstAtTwo = await play(perfectTaps);
    expect(firstAtTwo.round.goes.filter((g) => g.kind === 'plant')).toHaveLength(3);
    expect(firstAtTwo.round.goes.filter((g) => g.kind === 'equal')).toHaveLength(7);
    // Two hard days in a row take the child back to step 1, quietly.
    const hard = (r: Round) => wobblyTaps(r);
    expect((await play(hard)).body).toMatchObject({ step: 2 });
    expect((await play(hard)).body).toMatchObject({ step: 1, stepBefore: 2, level: 5 });
    // ... and one good day moves them on again.
    expect((await play(perfectTaps)).body).toMatchObject({ step: 2 });

    expect((await handleSwamphen(services, 'p2', { action: 'finish', seed: round.seed, taps: perfect })).body.code).toBe('not-yours');
    const off = memoryServices({ settings: () => ({ enabled: false, help: 'fade' }) });
    expect((await handleSwamphen(off, 'p1', { action: 'load' })).body.code).toBe('game-off');
    expect((await handleSwamphen(services, 'p1', { action: 'finish', seed: 'x', taps: [] })).status).toBe(400);
    expect(unplayed()).toMatchObject({ step: 1, daysAtStep: 0, hardInRow: 0 });
    expect(emptyData().rounds).toEqual([]);
    // A teacher sees the slip made most: a child who always adds the numbers.
    const r = makeRound(5, [], { step: 3, level: 3 });
    const adds = showRound(r).flatMap((g) => {
      const added = g.wrongs.find((w) => w.kind === 'added');
      return [...(added ? [{ pick: added.n, ms: 1 }] : []), { pick: g.answer, ms: 1 }];
    });
    expect(slipSummary([{ round: r, taps: adds }]).most).toBe('added');
    // Show me first: a bad kind is refused, a good one is saved (twice, no change), and load adds the kinds the child already answered.
    expect((await handleSwamphen(services, 'p1', { action: 'seen', kinds: ['nonsense'] })).status).toBe(400);
    expect((await handleSwamphen(services, 'p1', { action: 'seen', kinds: 'mat' })).status).toBe(400);
    for (let i = 0; i < 2; i++) expect((await handleSwamphen(services, 'p1', { action: 'seen', kinds: ['equal'] })).body.seen).toEqual(['equal']);
    expect((await handleSwamphen(services, 'p1', { action: 'load' })).body.seen).toEqual(['equal', 'plant']);
    expect((await handleSwamphen(services, 'p9', { action: 'load' })).body.seen).toEqual([]);
  });
});

describe('turning a garden and sharing it out', () => {
  it('a turn go asks for the turned garden, can be answered wrongly with a named slip, and records no plain times key', () => {
    const turnKeys = STEP_KEYS[5].filter((k) => k.startsWith('turn:'));
    expect(turnKeys.length).toBeGreaterThan(0);
    for (const key of turnKeys) {
      const [a, b] = keyPair(key);
      expect(mulKeyOf(key)).toBeNull();
      for (let seed = 1; seed <= 200; seed++) {
        const go = showGo({ seed }, 0, { key, kind: 'turn', l: 3 })!;
        expect(new Set(go.choices).size).toBe(4);
        expect(go.answer).toBe(pictureCode(b, a));
        expect(go.wrongs.find((w) => w.n === pictureCode(a, b))?.kind).toBe('unturned');
      }
    }
    const round: Round = { seed: 5, step: 5, level: 3, help: 'fade', goes: Array.from({ length: GOES_PER_ROUND }, () => ({ key: turnKeys[0], kind: 'turn' as const, l: 3 as HelpLevel })) };
    const goes = showRound(round);
    const taps: Tap[] = goes.flatMap((g) => [{ pick: g.wrongs[0].n, ms: 1 }, { pick: g.answer, ms: 1 }]);
    const played = replay(round, taps);
    expect(played.firstRight).toBe(0);
    expect(played.slips).toContain(goes[0].wrongs[0].kind);
    expect(played.answers.some((x) => x.key.startsWith('mul:'))).toBe(false);
  });
});

describe('the sister go', () => {
  it('is the same kind from the same step with other numbers and cards, is not saved, and the original still ends on its right pick', () => {
    const none: string[] = [];
    for (const step of steps) {
      for (const seed of seeds.slice(0, 10)) {
        const round = makeRound(seed, inBox(KEYS.slice(0, 6), 2), { step, level: 3 });
        const goes = showRound(round);
        goes.forEach((go, i) => {
          const sister = sisterGo(round, i, go);
          if (!sister) {
            none.push(go.key);
            return;
          }
          expect(sister.kind).toBe(go.kind);
          expect(sister.key).not.toBe(go.key);
          expect(go.choices).not.toContain(sister.answer);
          expect(sister.choices).toContain(sister.answer);
          // Never harder than the go: from a step that asks the go too.
          expect(STEPS.some((s) => STEP_KEYS[s.step].includes(go.key) && STEP_KEYS[s.step].includes(sister.key))).toBe(true);
        });
        const taps = goes.flatMap((go) => [{ pick: wrongTap(go), ms: 1000 }, { pick: wrongTap(go), ms: 1000 }, { pick: go.answer, ms: 1000 }]);
        expect(replay(round, taps).done).toBe(true);
      }
    }
    console.log('NOSISTER', [...new Set(none)].join(' ') || 'none');
  });
});

describe('the usual slip is saved', () => {
  it('keeps the named slips of the first wrong taps when the challenge finishes, and the page prefers the saved slip', async () => {
    const data = emptyData();
    const services = memoryServices({ data, now: () => Date.parse('2026-11-10T02:00:00Z'), random: () => 0.4 });
    const started = (await handleSwamphen(services, 'p1', { action: 'start' })).body.round as Round;
    const taps = wobblyTaps(started);
    expect((await handleSwamphen(services, 'p1', { action: 'finish', seed: started.seed, taps })).status).toBe(200);
    const kept = data.rounds.find((r) => r.round.seed === started.seed)?.slips;
    expect(kept).toEqual(replay(started, taps).slips);
    expect(usualSlip('turned', [])).toBe('turned');
    expect(usualSlip(null, [{ round: started, taps }])).toBe(slipSummary([{ round: started, taps }]).most);
    expect(usualSlip('nope', [])).toBeNull();
  });
});
