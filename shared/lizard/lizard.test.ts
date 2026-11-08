import { describe, expect, it } from 'vitest';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import { DEN_BUNDLES } from './config';
import { DAYS_PER_RAFT, denAfter, finishChallenge } from './progress';
import { replay, type Tap } from './play';
import { GOES_PER_ROUND, GUIDED_KEY, KEYS, STEP_KEYS, kindOfKey, makeRound, matOf, matValue, pictureFor, placeAfter, poolFor, showRound, startFor, type HelpLevel, type HelpSetting, type Place, type Round, type Step } from './round';
import { handleLizard, unplayed } from './server';
import { emptyData, memoryServices } from './memoryServices';
import { slipSummary } from './teacher';

const seeds = Array.from({ length: 40 }, (_, i) => i * 10007 + 1);
const inBox = (keys: string[], box: number): FactStats[] => keys.map((key) => ({ ...newStats(key), box }));
const steps = [1, 2, 3, 4, 5, 6, 7] as Step[];

type Go = ReturnType<typeof showRound>[number];
const rightTap = (go: Go): number => go.answer;
/** A wrong try: a wrong card, or for a built go one more than the answer's ones. */
const wrongTap = (go: Go): number => (go.choices.length ? go.choices.find((c) => c !== go.answer)! : go.answer + 1);
const wobblyTaps = (round: Round): Tap[] => showRound(round).flatMap((go) => [{ pick: wrongTap(go), ms: 4000 }, { pick: rightTap(go), ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, ten goes of today’s step and some review, with fair cards, and the replay marks first tries', () => {
    for (const step of steps) {
      for (const level of [5, 2, 0] as HelpLevel[]) {
        for (const seed of seeds) {
          const records = inBox(KEYS.slice(0, 6), 2);
          const round = makeRound(seed, records, { step, level });
          expect(round).toEqual(makeRound(seed, records, { step, level }));
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          const keys = round.goes.map((g) => g.key);
          keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
          const pool = new Set(poolFor(step));
          expect(keys.filter((k) => pool.has(k)).length).toBeGreaterThanOrEqual(step === 1 ? 10 : 7);
          for (const go of showRound(round)) {
            expect(go.l).toBe(level);
            if (go.choices.length) {
              expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
              expect(new Set(go.choices).size).toBe(4);
              expect([...go.choices]).toEqual([...go.choices].sort((a, b) => a - b));
              expect(go.choices.filter((c) => c % 10 === go.answer % 10).length).toBeLessThanOrEqual(2);
              expect(go.wrongs).toHaveLength(3);
              // Every named slip matches a real wrong card, and the answer is never a wrong card.
              for (const w of go.wrongs) expect(go.choices).toContain(w.n);
              expect(go.wrongs.some((w) => w.n === go.answer)).toBe(false);
            } else {
              expect(go.wrongs).toEqual([]);
              if (go.kind === 'build') expect(matValue(go.from)).toBe(0);
              if (go.kind === 'bundle') expect(go.from.o).toBe(go.n);
              if (go.kind === 'swap') expect(go.answer).toBe((matOf(go.n).t - 1) * 100 + matOf(go.n).o + 10);
            }
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND, firstRight: 0 });
          expect(end.answers.every((a) => !a.correct)).toBe(true);
          expect(() => replay(round, [{ pick: 99999, ms: 1 }])).toThrow();
          // A card that isn't on the go can't be tapped.
          const cards = showRound(round).find((g) => g.choices.length);
          if (cards && round.goes[0] === round.goes.find((g) => g.key === cards.key)) expect(() => replay(round, [{ pick: 4242, ms: 1 }])).toThrow();
        }
      }
    }
    // Every key can be made, with fair cards, on many seeds.
    for (const key of KEYS) {
      const kind = round1(key);
      for (const seed of seeds.slice(0, 8)) expect(() => showRound({ ...kind, seed, goes: kind.goes.map((g) => ({ ...g })) })).not.toThrow();
    }
    // The teacher's setting: Always keeps level 4, Off is 0, Fades follows the child.
    for (const [help, l] of [['always', 4], ['off', 0], ['fade', 2]] as [HelpSetting, number][]) {
      expect(makeRound(9, [], { level: 2, help }).goes.every((g) => g.l === l)).toBe(true);
    }
    // The very first challenge starts with tying ten sticks into a bundle, 200 seeds over.
    for (let seed = 1; seed <= 200; seed++) {
      const first = showRound(makeRound(seed, [], { guided: true }))[0];
      expect(first).toMatchObject({ key: GUIDED_KEY, kind: 'build', l: 5, answer: 10 });
    }
    // Fewer things shown as help fades; a wrong try brings them back.
    const go = { l: 0 as HelpLevel, choices: [11, 47, 74, 407], answer: 47 };
    expect(pictureFor(go, 0)).toMatchObject({ pictured: false, labels: false, counts: false });
    expect(pictureFor({ ...go, l: 5 }, 0)).toMatchObject({ pictured: true, labels: true, counts: true, colours: true });
    expect(pictureFor({ ...go, l: 3 }, 0)).toMatchObject({ pictured: true, labels: false, colours: true });
    expect(pictureFor({ ...go, l: 2 }, 0).colours).toBe(false);
    expect(pictureFor({ ...go, l: 1 }, 1)).toMatchObject({ peekOpen: true, pictured: true });
    expect(pictureFor(go, 1).level).toBe(3);
    expect(pictureFor(go, 2).level).toBe(5);
    expect(pictureFor(go, 3, [74]).choices).toEqual([11, 47]);
    expect(STEP_KEYS[1].length).toBe(5);
  });
});

const round1 = (key: string): Round => ({ seed: 1, step: 1, level: 5, help: 'fade', goes: [{ key, kind: kindOfKey(key)!, l: 5 }] });

describe('the help level, the step and the den', () => {
  it('fades help after two good challenges, brings it back after a hard one, starts known children further on, and turns the bundles', () => {
    const at = (p: Partial<Place>): Place => ({ step: 1, level: 5, goodInRow: 0, goodAtStep: 0, ...p });
    expect(placeAfter(at({}), 9)).toEqual(at({ goodInRow: 1, goodAtStep: 1 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 6)).toEqual(at({ level: 2 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 4)).toEqual(at({ level: 3 }));
    expect(placeAfter(at({ step: 2, level: 3, goodInRow: 1, goodAtStep: 1 }), 10)).toEqual(at({ step: 3, level: 2 }));
    expect(placeAfter(at({ step: 5, level: 1, goodInRow: 1, goodAtStep: 1 }), 10)).toEqual(at({ step: 6, level: 3 }));
    expect(placeAfter(at({ step: 7, level: 2, goodInRow: 0, goodAtStep: 5 }), 10).step).toBe(7);
    // Tūī's "ten and" facts: all nine start at step 3, some at step 2.
    const tenAnd = (n: number) => inBox(Array.from({ length: n }, (_, i) => `tenand:${i + 1}`), 2);
    expect(startFor(tenAnd(9))).toEqual({ step: 3, level: 3 });
    expect(startFor(tenAnd(6))).toEqual({ step: 2, level: 4 });
    expect(startFor(tenAnd(2))).toEqual({ step: 1, level: 5 });
    expect(startFor([])).toEqual({ step: 1, level: 5 });

    expect(denAfter(0)).toMatchObject({ prizes: 0, friend: 'lizard', today: 'bronze', bundles: Array(DEN_BUNDLES).fill('twine') });
    expect(denAfter(21)).toMatchObject({ today: 'gold', bundles: ['gold', ...Array(9).fill('silver')] });
    expect(denAfter(DAYS_PER_RAFT)).toMatchObject({ prizes: 1, friend: 'kiwi', day: 0 });
    expect(finishChallenge(0, null, '2026-11-08')).toEqual({ daysDone: 1, lastDay: '2026-11-08', bundleChanged: 0, goldenRaft: false });
    expect(finishChallenge(1, '2026-11-08', '2026-11-08')).toMatchObject({ daysDone: 1, bundleChanged: null });
    expect(finishChallenge(29, '2026-11-08', '2026-11-20')).toMatchObject({ daysDone: 30, bundleChanged: 9, goldenRaft: true });
  });
});

describe('the server', () => {
  it('starts a challenge, replays the taps, records each key once, counts the day once, moves the step, and tells a teacher the slip', async () => {
    const log = { answers: [] as { player: string; once: string; answers: FactAnswer[] }[], dens: [] as string[] };
    let seedCounter = 0.37;
    let clock = Date.parse('2026-11-08T02:00:00Z');
    const services = memoryServices({ now: () => clock, random: () => (seedCounter = (seedCounter * 7919 + 0.137) % 1), log });
    const started = await handleLizard(services, 'p1', { action: 'start' });
    expect(started.status).toBe(200);
    const round = started.body.round as Round;
    expect(round.goes[0].key).toBe(GUIDED_KEY);
    const perfect: Tap[] = showRound(round).map((g) => ({ pick: rightTap(g), ms: 3000 }));
    expect((await handleLizard(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect.slice(0, 5) })).body.code).toBe('not-done');
    const done = await handleLizard(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect });
    expect(done.body).toMatchObject({ daysDone: 1, bundleChanged: 0, firstRight: 10, step: 1 });
    expect(log.answers).toHaveLength(1);
    expect((log.answers[0].answers as { correct: boolean }[]).every((a) => a.correct)).toBe(true);
    expect((await handleLizard(services, 'p1', { action: 'finish', seed: round.seed, taps: perfect })).body.code).toBe('ended');
    // Kinds seen: a made-up kind is unreadable, a real one is saved (twice is the same), and load adds the kinds the facts show.
    expect((await handleLizard(services, 'p1', { action: 'seen', kinds: ['nope'] })).status).toBe(400);
    await handleLizard(services, 'p1', { action: 'seen', kinds: ['swap'] });
    expect((await handleLizard(services, 'p1', { action: 'seen', kinds: ['swap'] })).body.seen).toEqual(['swap']);
    expect((await handleLizard(services, 'p1', { action: 'load' })).body.seen).toEqual(expect.arrayContaining(['swap', 'build']));
    expect((await handleLizard(services, 'p2', { action: 'load' })).body.seen).toEqual([]);
    clock += 86_400_000;
    const second = (await handleLizard(services, 'p1', { action: 'start' })).body.round as Round;
    const again = await handleLizard(services, 'p1', { action: 'finish', seed: second.seed, taps: showRound(second).map((g) => ({ pick: rightTap(g), ms: 3000 })) });
    expect(again.body).toMatchObject({ daysDone: 2, step: 2, stepBefore: 1 });
    expect((await handleLizard(services, 'p2', { action: 'finish', seed: round.seed, taps: perfect })).body.code).toBe('not-yours');
    const off = memoryServices({ settings: () => ({ enabled: false, help: 'fade' }) });
    expect((await handleLizard(off, 'p1', { action: 'load' })).body.code).toBe('game-off');
    expect((await handleLizard(services, 'p1', { action: 'finish', seed: 'x', taps: [] })).status).toBe(400);
    expect(unplayed().step).toBe(1);
    expect(emptyData().rounds).toEqual([]);
    // A teacher sees the slip made most often: the 74 card for 47, twice, is digits turned round.
    const r = makeRound(11, [], { step: 2, level: 3 });
    const reversed = showRound(r).flatMap((g) => {
      const slip = g.wrongs.find((w) => w.kind === 'reverse');
      return slip ? [{ pick: slip.n, ms: 1 }, { pick: g.answer, ms: 1 }] : [{ pick: g.answer, ms: 1 }];
    });
    const summary = slipSummary([{ round: r, taps: reversed }]);
    if (showRound(r).filter((g) => g.wrongs.some((w) => w.kind === 'reverse')).length >= 2) expect(summary.top).toBe('reverse');
    expect(slipSummary([])).toEqual({ wrong: 0, top: null, count: 0 });
  });
});
