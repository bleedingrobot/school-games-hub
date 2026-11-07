import { describe, expect, it } from 'vitest';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { BERRY_CLUSTERS } from './config';
import { DAYS_PER_BRANCH, branchAfter, finishChallenge } from './progress';
import { replay, type Tap } from './play';
import { GOES_PER_ROUND, GUIDED_KEY, KEYS, STEP_KEYS, makeRound, marksFor, pictureFor, placeAfter, placeRight, poolFor, showRound, startFor, tapValue, type HelpLevel, type HelpSetting, type Place, type Round, type Step } from './round';
import { handlePigeon, unplayed } from './server';
import { emptyData, memoryServices } from './memoryServices';
import { placingSummary } from './teacher';

const seeds = Array.from({ length: 40 }, (_, i) => i * 10007 + 1);
const inBox = (keys: string[], box: number): FactStats[] => keys.map((key) => ({ ...newStats(key), box }));
const steps = [1, 2, 3, 4, 5, 6, 7] as Step[];

/** A perfect tap for a go: the card, or the place along the line. */
const rightTap = (go: ReturnType<typeof showRound>[number]): number => (go.kind === 'place' ? Math.round(((go.n - go.lo) / (go.hi - go.lo)) * 1000) : go.answer);
const wrongTap = (go: ReturnType<typeof showRound>[number]): number =>
  go.kind === 'place' ? (rightTap(go) > 500 ? 0 : 1000) : go.choices.find((c) => c !== go.answer)!;
const wobblyTaps = (round: Round): Tap[] => showRound(round).flatMap((go) => [{ pick: wrongTap(go), ms: 4000 }, { pick: rightTap(go), ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, ten goes of today’s step and some review, with fair cards, and the replay marks first taps', () => {
    for (const step of steps) {
      for (const level of [5, 2, 0] as HelpLevel[]) {
        for (const seed of seeds) {
          const records = inBox(KEYS.slice(0, 6), 2);
          const round = makeRound(seed, records, { step, level });
          expect(round).toEqual(makeRound(seed, records, { step, level }));
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          const keys = round.goes.map((g) => g.key);
          keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
          // Seven goes are today's step (step 1: all ten on the tens), the rest earlier steps.
          const pool = new Set(poolFor(step, new Map()));
          expect(keys.filter((k) => pool.has(k)).length).toBeGreaterThanOrEqual(step === 1 ? 10 : 7);
          if (step === 1) expect(new Set(keys).size).toBe(9);
          for (const go of showRound(round)) {
            expect(go.l).toBe(level);
            if (go.kind === 'place') {
              expect(go.choices).toEqual([]);
              expect(placeRight(go, rightTap(go))).toBe(true);
              expect(placeRight(go, wrongTap(go))).toBe(false);
              expect(Math.abs(tapValue(go, rightTap(go)) - go.n)).toBeLessThanOrEqual(0.5);
            } else if (go.kind === 'near') {
              expect(go.choices).toHaveLength(2);
              expect(go.posts).toContain(go.answer);
            } else {
              expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
              expect(go.choices).toHaveLength(4);
              expect([...go.choices]).toEqual([...go.choices].sort((a, b) => a - b));
              // At most two cards (the answer and one more) end in the same digit.
              expect(go.choices.filter((c) => (go.max === 1000 ? Math.floor(c / 10) % 10 === Math.floor(go.answer / 10) % 10 : c % 10 === go.answer % 10)).length).toBeLessThanOrEqual(2);
              expect(go.wrongs).toHaveLength(3);
            }
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND, firstRight: 0 });
          expect(end.answers.every((a) => !a.correct)).toBe(true);
          expect(() => replay(round, [{ pick: 1234, ms: 1 }])).toThrow();
        }
      }
    }
    // The teacher's setting: Always marks every ten, Off the two ends only.
    for (const [help, l] of [['always', 4], ['off', 0], ['fade', 2]] as [HelpSetting, number][]) {
      expect(makeRound(9, [], { level: 2, help }).goes.every((g) => g.l === l)).toBe(true);
    }
    // The very first challenge starts with 50 on the 100 line, every number marked.
    for (const seed of seeds) expect(makeRound(seed, [], { guided: true }).goes[0]).toMatchObject({ key: GUIDED_KEY, kind: 'place', l: 5 });
    // Halfway numbers wait until most of the other 'closer' numbers are secure.
    const others = STEP_KEYS[5].filter((k) => !k.includes(':h'));
    expect(poolFor(5, new Map()).some((k) => k.includes(':h'))).toBe(false);
    expect(poolFor(5, new Map(others.map((k) => [k, 2]))).some((k) => k.includes(':h'))).toBe(true);
    // Fewer numbers on the branch as help fades; a wrong tap brings them back.
    expect(marksFor(5, 0, 100).named).toHaveLength(11);
    expect(marksFor(0, 0, 100).named).toEqual([0, 100]);
    expect(marksFor(4, 0, 1000).named).toHaveLength(11);
    const go = { l: 0 as HelpLevel, kind: 'read' as const, choices: [13, 14, 15, 41], answer: 14, n: 14, lo: 0, hi: 100, max: 100 };
    expect(pictureFor(go, 1).level).toBe(3);
    expect(pictureFor(go, 2).level).toBe(5);
    expect(pictureFor(go, 3, [13]).choices).toEqual([14, 15]);
    expect(pictureFor({ ...go, kind: 'place', choices: [] }, 3).band).toEqual([10, 20]);
  });
});

describe('the help level and the step', () => {
  it('fades help after two good challenges, brings it back after a hard one, and turns the berry clusters', () => {
    const at = (p: Partial<Place>): Place => ({ step: 1, level: 5, goodInRow: 0, goodAtStep: 0, ...p });
    expect(placeAfter(at({}), 9)).toEqual(at({ goodInRow: 1, goodAtStep: 1 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 6)).toEqual(at({ level: 2 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 4)).toEqual(at({ level: 3 }));
    expect(placeAfter(at({ step: 2, level: 3, goodInRow: 1, goodAtStep: 1 }), 10)).toEqual(at({ step: 3, level: 2 }));
    expect(placeAfter(at({ step: 2, level: 2, goodInRow: 0, goodAtStep: 1 }), 9)).toEqual(at({ step: 3, level: 4 }));
    expect(placeAfter(at({ step: 5, level: 1, goodInRow: 1, goodAtStep: 1 }), 10)).toEqual(at({ step: 6, level: 3 }));
    expect(placeAfter(at({ step: 6, level: 0, goodInRow: 0, goodAtStep: 1 }), 9).level).toBe(3);
    expect(placeAfter(at({ step: 7, level: 2, goodInRow: 0, goodAtStep: 5 }), 10).step).toBe(7);
    // Ten-and facts start at step 1 with less help; one more and one less (Ruru) at step 3.
    expect(startFor(inBox(Array.from({ length: 9 }, (_, i) => `tenand:${i + 1}`), 2))).toEqual({ step: 1, level: 4 });
    expect(startFor(inBox([...Array.from({ length: 20 }, (_, i) => `more1:${i}`), ...Array.from({ length: 20 }, (_, i) => `less1:${i}`)], 2))).toEqual({ step: 3, level: 2 });
    expect(startFor([])).toEqual({ step: 1, level: 5 });

    // The berry clusters: bronze, silver, then gold, one per NZ day, a Golden Berry Branch and a new friend every 30 days.
    expect(branchAfter(0)).toMatchObject({ prizes: 0, friend: 'pigeon', today: 'bronze', clusters: Array(BERRY_CLUSTERS).fill('green') });
    expect(branchAfter(21)).toMatchObject({ today: 'gold', clusters: ['gold', ...Array(9).fill('silver')] });
    expect(branchAfter(DAYS_PER_BRANCH)).toMatchObject({ prizes: 1, friend: 'sparrow', day: 0 });
    expect(finishChallenge(0, null, '2026-11-08')).toEqual({ daysDone: 1, lastDay: '2026-11-08', clusterChanged: 0, goldenBranch: false });
    expect(finishChallenge(1, '2026-11-08', '2026-11-08')).toMatchObject({ daysDone: 1, clusterChanged: null });
    expect(finishChallenge(29, '2026-11-08', '2026-11-20')).toMatchObject({ daysDone: 30, clusterChanged: 9, goldenBranch: true });
  });
});

describe('the server', () => {
  it('starts a challenge, replays the taps, records each key once, counts the day once, and moves the step', async () => {
    const log = { answers: [] as { player: string; once: string; answers: FactAnswer[] }[], branches: [] as string[] };
    let seedCounter = 0.37;
    let clock = Date.parse('2026-11-08T02:00:00Z');
    const services = memoryServices({ now: () => clock, random: () => (seedCounter = (seedCounter * 7919 + 0.137) % 1), log });
    const started = await handlePigeon(services, 'p1', { action: 'start' });
    expect(started.status).toBe(200);
    const round = (started.body.round as Round);
    expect(round.goes[0].key).toBe(GUIDED_KEY);
    const perfect: Tap[] = showRound(round).map((g) => ({ pick: rightTap(g), ms: 3000 }));
    expect((await handlePigeon(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect.slice(0, 5) })).body.code).toBe('not-done');
    const done = await handlePigeon(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect });
    expect(done.body).toMatchObject({ daysDone: 1, clusterChanged: 0, firstRight: 10, step: 1 });
    expect(log.answers).toHaveLength(1);
    expect((log.answers[0].answers as { correct: boolean }[]).every((a) => a.correct)).toBe(true);
    // The same challenge cannot finish twice; another at the same day counts for fun only.
    expect((await handlePigeon(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect })).body.code).toBe('ended');
    // Two good challenges pass the step.
    clock += 86_400_000;
    const second = (await handlePigeon(services, 'p1', { action: 'start' })).body.round as Round;
    const again = await handlePigeon(services, 'p1', { action: 'finish', seed: second.seed, taps: showRound(second).map((g) => ({ pick: rightTap(g), ms: 3000 })) });
    expect(again.body).toMatchObject({ daysDone: 2, step: 2, stepBefore: 1 });
    // A pupil's taps are theirs alone; the class can switch the game off.
    expect((await handlePigeon(services, 'p2', { action: 'finish', seed: round.seed, taps: perfect })).body.code).toBe('not-yours');
    const off = memoryServices({ settings: () => ({ enabled: false, help: 'fade' }) });
    expect((await handlePigeon(off, 'p1', { action: 'load' })).body.code).toBe('game-off');
    expect((await handlePigeon(services, 'p1', { action: 'finish', seed: 'x', taps: [] })).status).toBe(400);
    expect(unplayed().step).toBe(1);
    expect(emptyData().rounds).toEqual([]);
    // A teacher sees the placing: big numbers put too far back look squashed.
    const r = makeRound(5, [], { step: 3, level: 3 });
    const squashed = showRound(r).map((g) => ({ pick: g.kind === 'place' ? Math.round(((g.n - g.lo) / (g.hi - g.lo)) * 1000 * (g.n > 70 ? 0.6 : 1)) : g.answer, ms: 1000 }));
    const fix = showRound(r).flatMap((g, i) => (g.kind === 'place' && g.n > 70 ? [squashed[i], { pick: rightTap(g), ms: 1 }] : [{ pick: rightTap(g), ms: 1 }]));
    const summary = placingSummary([{ round: r, taps: fix }]);
    expect(summary.taps).toBeGreaterThan(0);
    if (summary.bigOff !== null) expect(summary.bigOff).toBeLessThan(0);
  });
});
