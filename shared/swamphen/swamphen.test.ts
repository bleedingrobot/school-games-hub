import { describe, expect, it } from 'vitest';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { EARLY_FACTS } from '../maths/skillPacks/earlyFacts';
import { factKey } from '../maths/facts';
import { REED_ROWS } from './config';
import { DAYS_PER_GARDEN, finishChallenge, gardenAfter } from './progress';
import { replay, type Tap } from './play';
import { GOES_PER_ROUND, GUIDED_KEY, KEYS, fairShare, mulKeyOf, pictureCode, STEP_KEYS, kindOfKey, keyPair, makeRound, pictureFor, placeAfter, showGo, showRound, startFor, viewFor, type HelpLevel, type HelpSetting, type Place, type Round, type Step } from './round';
import { handleSwamphen, unplayed } from './server';
import { emptyData, memoryServices } from './memoryServices';
import { slipSummary } from './teacher';

const seeds = Array.from({ length: 40 }, (_, i) => i * 10007 + 1);
const inBox = (keys: string[], box: number): FactStats[] => keys.map((key) => ({ ...newStats(key), box }));
const steps = [1, 2, 3, 4, 5, 6] as Step[];

type Shown = ReturnType<typeof showRound>[number];
const wrongTap = (go: Shown): number => go.choices.find((c) => c !== go.answer)!;
const wobblyTaps = (round: Round): Tap[] => showRound(round).flatMap((go) => [{ pick: wrongTap(go), ms: 4000 }, { pick: go.answer, ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, ten goes of today’s step and some review, with fair cards that match their slips, and the replay marks first taps', () => {
    // Every key is a different, whole, countable garden, and its cards are all different from the right one.
    expect(new Set(KEYS).size).toBe(KEYS.length);
    for (const step of steps) {
      for (const level of [5, 2, 0] as HelpLevel[]) {
        for (const seed of seeds) {
          const records = inBox(KEYS.slice(0, 6), 2);
          const round = makeRound(seed, records, { step, level });
          expect(round).toEqual(makeRound(seed, records, { step, level }));
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          const keys = round.goes.map((g) => g.key);
          keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
          // Seven goes are today's step (step 1: all ten), the rest earlier steps.
          const pool = new Set(STEP_KEYS[step]);
          expect(keys.filter((k) => pool.has(k)).length).toBeGreaterThanOrEqual(step === 1 ? 10 : 7);
          for (const go of showRound(round)) {
            expect(go.l).toBe(level);
            expect(go.kind).toBe(kindOfKey(go.key));
            expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
            expect(go.choices).toHaveLength(4);
            expect(go.wrongs).toHaveLength(3);
            expect(new Set(go.choices).size).toBe(4);
            for (const w of go.wrongs) expect(go.choices).toContain(w.n);
            if (go.kind !== 'which' && go.kind !== 'turn') {
              expect([...go.choices]).toEqual([...go.choices].sort((a, b) => a - b));
              expect(go.choices.filter((c) => c % 10 === go.answer % 10).length).toBeLessThanOrEqual(2);
            }
            const [a, b] = keyPair(go.key);
            if (go.kind === 'share') expect(go.answer * go.rows).toBe(go.total);
            else expect(go.total).toBe(a * b);
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND, firstRight: 0 });
          expect(end.answers.every((a) => !a.correct)).toBe(true);
          expect(end.slips).toHaveLength(GOES_PER_ROUND);
          expect(() => replay(round, [{ pick: 1234, ms: 1 }])).toThrow();
        }
      }
    }
    // The teacher's setting: Always keeps level 4, Off is level 0 (no Peek).
    for (const [help, l] of [['always', 4], ['off', 0], ['fade', 2]] as [HelpSetting, number][]) {
      expect(makeRound(9, [], { level: 2, help }).goes.every((g) => g.l === l)).toBe(true);
    }
    // The very first challenge starts with 2 rows of 2, every row shaded and counted, and it cannot fail.
    for (const seed of seeds) expect(makeRound(seed, [], { guided: true }).goes[0]).toMatchObject({ key: GUIDED_KEY, kind: 'plant', l: 5 });
    // Less picture as help fades; a wrong tap brings it back, and the third leaves two cards.
    expect([5, 4, 3, 2, 1, 0].map((l) => viewFor(l as HelpLevel))).toEqual(['count', 'rows', 'bars', 'edges', 'peek', 'plain']);
    const go = { l: 0 as HelpLevel, choices: [8, 12, 15, 24], answer: 24 };
    expect(pictureFor(go, 1).level).toBe(3);
    expect(pictureFor(go, 2).level).toBe(5);
    expect(pictureFor({ ...go, l: 1 }, 1)).toMatchObject({ level: 1, peekOpen: true });
    expect(pictureFor(go, 3, [8]).choices).toEqual([12, 24]);
  });
});

describe('the help level and the step', () => {
  it('fades help after two good challenges, brings it back after a hard one, starts a child who knows the tables further on, and turns the reed rows', () => {
    const at = (p: Partial<Place>): Place => ({ step: 1, level: 5, goodInRow: 0, goodAtStep: 0, ...p });
    expect(placeAfter(at({}), 9)).toEqual(at({ goodInRow: 1, goodAtStep: 1 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 6)).toEqual(at({ level: 2 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 4)).toEqual(at({ level: 3 }));
    expect(placeAfter(at({ step: 2, level: 3, goodInRow: 1, goodAtStep: 1 }), 10)).toEqual(at({ step: 3, level: 2 }));
    expect(placeAfter(at({ step: 2, level: 2, goodInRow: 0, goodAtStep: 1 }), 9)).toEqual(at({ step: 3, level: 4 }));
    expect(placeAfter(at({ step: 6, level: 2, goodInRow: 0, goodAtStep: 5 }), 10).step).toBe(6);
    // Who starts where: the tables secure, counting by fives and tens secure, or neither.
    const tables = [2, 3, 4, 5].flatMap((t) => Array.from({ length: 13 - t }, (_, i) => factKey(t, t + i)));
    expect(startFor(inBox(tables, 2))).toEqual({ step: 5, level: 2 });
    const skips = [...EARLY_FACTS.families.skip5.keys, ...EARLY_FACTS.families.skip10.keys];
    expect(startFor(inBox(skips, 2))).toEqual({ step: 2, level: 5 });
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
});

describe('the server', () => {
  it('starts a challenge, replays the taps, records each key once (and the plain times key beside it), counts the day once, moves the step and names the slip', async () => {
    const log = { answers: [] as { player: string; once: string; answers: FactAnswer[] }[], gardens: [] as string[] };
    let seedCounter = 0.37;
    let clock = Date.parse('2026-11-08T02:00:00Z');
    const services = memoryServices({ now: () => clock, random: () => (seedCounter = (seedCounter * 7919 + 0.137) % 1), log });
    const started = await handleSwamphen(services, 'p1', { action: 'start' });
    expect(started.status).toBe(200);
    const round = started.body.round as Round;
    expect(round.goes[0].key).toBe(GUIDED_KEY);
    const perfect: Tap[] = showRound(round).map((g) => ({ pick: g.answer, ms: 3000 }));
    expect((await handleSwamphen(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect.slice(0, 5) })).body.code).toBe('not-done');
    const done = await handleSwamphen(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect });
    expect(done.body).toMatchObject({ daysDone: 1, rowChanged: 0, firstRight: 10, step: 1 });
    expect(log.answers).toHaveLength(1);
    const recorded = log.answers[0].answers;
    expect(recorded.every((a) => a.correct)).toBe(true);
    expect(recorded.filter((a) => a.key.startsWith('rows:'))).toHaveLength(10);
    expect(recorded.some((a) => a.key.startsWith('mul:'))).toBe(true);
    // The same challenge cannot finish twice; another at the same day counts for fun only.
    expect((await handleSwamphen(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect })).body.code).toBe('ended');
    // Two good challenges pass the step.
    clock += 86_400_000;
    const second = (await handleSwamphen(services, 'p1', { action: 'start' })).body.round as Round;
    const again = await handleSwamphen(services, 'p1', { action: 'finish', seed: second.seed, taps: showRound(second).map((g) => ({ pick: g.answer, ms: 3000 })) });
    expect(again.body).toMatchObject({ daysDone: 2, step: 2, stepBefore: 1 });
    // A pupil's taps are theirs alone; the class can switch the game off.
    expect((await handleSwamphen(services, 'p2', { action: 'finish', seed: round.seed, taps: perfect })).body.code).toBe('not-yours');
    const off = memoryServices({ settings: () => ({ enabled: false, help: 'fade' }) });
    expect((await handleSwamphen(off, 'p1', { action: 'load' })).body.code).toBe('game-off');
    expect((await handleSwamphen(services, 'p1', { action: 'finish', seed: 'x', taps: [] })).status).toBe(400);
    expect(unplayed().step).toBe(1);
    expect(emptyData().rounds).toEqual([]);
    // A teacher sees the slip made most: a child who always adds the numbers.
    const r = makeRound(5, [], { step: 1, level: 3 });
    const adds = showRound(r).flatMap((g) => {
      const added = g.wrongs.find((w) => w.kind === 'added');
      return [...(added ? [{ pick: added.n, ms: 1 }] : []), { pick: g.answer, ms: 1 }];
    });
    const summary = slipSummary([{ round: r, taps: adds }]);
    expect(summary.most).toBe('added');
  });
});

describe('turning a garden and sharing it out', () => {
  it('a turn go asks for the turned garden, can be answered wrongly with a named slip, and records no plain times key', () => {
    const turnKeys = KEYS.filter((k) => k.startsWith('turn:'));
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
    const round = { seed: 5, step: 2 as Step, level: 3 as HelpLevel, help: 'fade' as HelpSetting, goes: Array.from({ length: GOES_PER_ROUND }, () => ({ key: turnKeys[0], kind: 'turn' as const, l: 3 as HelpLevel })) };
    const goes = showRound(round);
    const taps: Tap[] = goes.flatMap((g) => [{ pick: g.wrongs[0].n, ms: 1 }, { pick: g.answer, ms: 1 }]);
    const played = replay(round, taps);
    expect(played.firstRight).toBe(0);
    expect(played.slips).toContain(goes[0].wrongs[0].kind);
    expect(played.answers.some((x) => x.key.startsWith('mul:'))).toBe(false);
  });

  it('shares are fair only when every row has the same, and some', () => {
    expect(fairShare([3, 3, 3])).toBe(true);
    expect(fairShare([4, 3, 3])).toBe(false);
    expect(fairShare([0, 0, 0])).toBe(false);
    expect(fairShare([])).toBe(false);
  });
});
