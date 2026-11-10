import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { DAYS_PER_NEST, finishChallenge, treeAfter } from './progress';
import { atMostShareTell } from '../kit/mistakes';
import { replay, type Tap } from './play';
import { GOES_PER_ROUND, GUIDED_KEY, KEYS, keyFor, LESS_KEYS, makeRound, nestShape, pictureFor, placeAfter, showGo, showRound, sisterGo, startFor, STEPS, topSecure, type HelpLevel, type HelpSetting, type Place, type Round } from './round';
import { emptyData, memoryServices } from './memoryServices';
import { handleTui, unplayed } from './server';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const inBox = (keys: string[], box: number): FactStats[] => keys.map((key) => ({ ...newStats(key), box }));

/** One wrong pick on every go, then the right one. */
const wobblyTaps = (round: Round): Tap[] =>
  showRound(round).flatMap((go) => [{ pick: go.choices.find((c) => c !== go.answer)!, ms: 4000 }, { pick: go.answer, ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, asks every fact in its step’s ways, and each fact counts once', () => {
    for (const { step, ways } of STEPS) {
      for (const level of [5, 3, 0] as HelpLevel[]) {
        for (const seed of seeds) {
          const records = inBox(KEYS.slice(0, 4), 2);
          const round = makeRound(seed, records, { step, level });
          expect(round).toEqual(makeRound(seed, records, { step, level }));
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          const keys = round.goes.map((g) => g.key);
          const numbers = keys.map((k) => Number(k.split(':')[1]));
          for (let n = 1; n <= 9; n++) expect(numbers).toContain(n);
          keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
          // Each go counts towards the right record: 10 + n and n + 10 to "tenand", the minus ways to "tenless".
          expect(round.goes.every((g) => g.key === keyFor(Number(g.key.split(':')[1]), g.v) && g.key.startsWith(g.v >= 2 ? 'tenless:' : 'tenand:'))).toBe(true);
          // Weakest first: while only 10 + n is asked, the numbers still in box 0 come before the secure ones.
          if (ways.every((w) => w <= 1)) expect(KEYS.slice(0, 4)).not.toContain(keys[0]);
          expect(round.goes.every((g) => (ways as readonly number[]).includes(g.v))).toBe(true);
          // Steps 2 to 4: seven of the new way.
          if (step > 1 && step < 5) expect(round.goes.filter((g) => g.v === ways[ways.length - 1])).toHaveLength(7);
          for (const go of showRound(round)) {
            expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
            expect(go.choices).toHaveLength(4);
            expect(go.answer).toBe(go.v >= 2 ? go.n : 10 + go.n);
            // "How many?" goes show the reversal (41 for 14) as a wrong nest.
            if (go.v <= 1 && go.n >= 2) expect(go.choices).toContain(go.n * 10 + 1);
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND, firstRight: 0 });
          expect(end.answers.map((a) => a.key)).toEqual([...new Set(keys)]);
          expect(end.answers.every((a) => !a.correct)).toBe(true);
          expect(() => replay(round, [{ pick: 999, ms: 1 }])).toThrow();
        }
      }
    }
    // The teacher's setting: Always shows every berry, Off numbers only.
    for (const [help, l] of [['always', 4], ['off', 0], ['fade', 2]] as [HelpSetting, number][]) {
      expect(makeRound(9, [], { level: 2, help }).goes.every((g) => g.l === l)).toBe(true);
    }
    // The very first challenge starts with 10 and 2, "10 + 2", every berry counted in.
    for (const seed of seeds) expect(makeRound(seed, [], { guided: true, step: 3, level: 2 }).goes[0]).toEqual({ key: GUIDED_KEY, v: 0, l: 5 });
  });
});

describe('the help level and the step', () => {
  it('fade after two good challenges, come back after a hard one, and a new step brings one back only without a fade', () => {
    const at = (p: Partial<Place>): Place => ({ step: 1, level: 5, goodInRow: 0, goodAtStep: 0, ...p });
    expect(placeAfter(at({}), 9)).toEqual(at({ goodInRow: 1, goodAtStep: 1 }));
    expect(placeAfter(at({ step: 5, goodInRow: 1 }), 8)).toEqual(at({ step: 5, level: 4, goodAtStep: 1 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 6)).toEqual(at({ level: 2 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 4)).toEqual(at({ level: 3 }));
    expect(placeAfter(at({ level: 5 }), 0).level).toBe(5);
    // A pass on the same go as a fade keeps the fade (the new step adds nothing), and the ten-frames floor does not undo it (S25).
    expect(placeAfter(at({ step: 2, level: 3, goodInRow: 1, goodAtStep: 1 }), 10)).toEqual(at({ step: 3, level: 2 }));
    expect(placeAfter(at({ step: 2, level: 4, goodInRow: 1, goodAtStep: 1 }), 10)).toEqual(at({ step: 3, level: 3 }));
    // A pass with no fade (a middling challenge broke the row) brings one level back, capped at the top.
    expect(placeAfter(at({ step: 2, level: 4, goodInRow: 0, goodAtStep: 1 }), 9)).toEqual(at({ step: 3, level: 5 }));
    expect(placeAfter(at({ step: 2, level: 5, goodInRow: 0, goodAtStep: 1 }), 9)).toEqual(at({ step: 3, level: 5 }));
    // A new step always brings the ten-frames back, even from numbers only.
    expect(placeAfter(at({ step: 2, level: 0, goodInRow: 0, goodAtStep: 1 }), 9)).toEqual(at({ step: 3, level: 4 }));
    // A perfect round counts as two good ones: the help fades at once.
    expect(placeAfter(at({ level: 5 }), 10)).toEqual(at({ level: 4, goodAtStep: 1 }));
    expect(placeAfter(at({ level: 5 }), 9)).toEqual(at({ goodInRow: 1, goodAtStep: 1 }));
    // A child who already knows both kinds of fact starts at step 3, help level 4.
    expect(startFor(inBox([...KEYS.slice(0, 7), ...LESS_KEYS.slice(0, 7)], 2))).toEqual({ step: 3, level: 4 });
    expect(startFor(inBox(KEYS.slice(0, 6), 3))).toEqual({ step: 1, level: 5 });
  });

  it('a child who gets every go right loses the counted-in berries straight away and reaches numbers only', () => {
    let p: Place = { step: 1, level: 5, goodInRow: 0, goodAtStep: 0 };
    for (let i = 0; i < 8; i++) p = placeAfter(p, 10);
    expect(p.step).toBe(5);
    expect(p.level).toBeLessThanOrEqual(4);
    for (let i = 0; i < 8; i++) p = placeAfter(p, 10);
    expect(p.level).toBe(0);
  });

  it('a wrong tap brings more picture for that go, and never shows the answer', () => {
    const go = { l: 0 as HelpLevel, choices: [13, 14, 15, 41], answer: 14 };
    expect(pictureFor(go, 0)).toEqual({ level: 0, peekOpen: false });
    expect(pictureFor(go, 1).level).toBe(3);
    expect(pictureFor({ ...go, l: 1 }, 1)).toMatchObject({ level: 1, peekOpen: true });
    expect(pictureFor({ ...go, l: 3 }, 1).level).toBe(4);
    expect(pictureFor(go, 2).level).toBe(5);
  });
});

describe('mistakes that teach: the nests', () => {
  const rounds = [1, 7, 99, 2024, 31337].flatMap((seed) => STEPS.map((st) => makeRound(seed, [], { step: st.step, level: 5 })));
  const goes = rounds.flatMap((r) => showRound(r));

  it('has four nests at every help level, each wrong one tagged with its mistake, and the kinds fit the way asked', () => {
    for (const level of [0, 1, 2, 3, 4, 5] as HelpLevel[]) {
      for (const go of showRound(makeRound(5, [], { step: 5, level }))) expect(go.choices).toHaveLength(4);
    }
    for (const go of goes) {
      expect(go.wrongs).toHaveLength(3);
      expect([...go.choices].sort((a, b) => a - b)).toEqual([go.answer, ...go.wrongs.map((w) => w.n)].sort((a, b) => a - b));
      const kinds = go.wrongs.map((w) => w.kind);
      expect(new Set(kinds).size).toBe(3);
      if (go.v <= 1) expect(kinds).toContain('off1');
      if (go.v === 2) expect(kinds).toEqual(expect.arrayContaining(['total', 'off1']));
      if (go.v === 3) expect(kinds).toEqual(expect.arrayContaining(['total', 'up', 'off1']));
      for (const w of go.wrongs) {
        if (w.kind === 'reverse') expect(w.n).toBe(go.n * 10 + 1);
        if (w.kind === 'total') expect(w.n).toBe(go.teen);
        if (w.kind === 'off1') expect(Math.abs(w.n - go.answer)).toBe(1);
      }
    }
  });

  it('never leaves the right answer the only nest of its shape, or lets three share it', () => {
    for (const go of goes) {
      expect(atMostShareTell(go.answer, go.choices, nestShape)).toBe(true);
      expect(go.choices.filter((c) => nestShape(c) === nestShape(go.answer)).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('replays two wrong taps, a wrong tap in "Now you try" and then the right one: only the first tap is scored', () => {
    const round = makeRound(11, [], { step: 1, level: 5 });
    const taps: Tap[] = showRound(round).flatMap((go) => {
      const [a, b] = go.wrongs;
      return [a.n, b.n, a.n, go.answer].map((pick) => ({ pick, ms: 1000 }));
    });
    expect(replay(round, taps)).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND * 3, firstRight: 0 });
    const clean = showRound(round).map((go) => ({ pick: go.answer, ms: 1000 }));
    expect(replay(round, clean)).toMatchObject({ done: true, mistakes: 0, firstRight: GOES_PER_ROUND });
  });
});

describe('the sister go', () => {
  it('is the same way and help on other ones, never the original answer, and the first go’s right pick still ends the replay', () => {
    for (const { step } of STEPS) {
      for (const seed of seeds.slice(0, 8)) {
        const round = makeRound(seed, [], { step, level: 3 });
        const goes = showRound(round);
        goes.forEach((go, i) => {
          const sister = sisterGo(round, i, go)!;
          expect(sister.v).toBe(go.v);
          expect(sister.l).toBe(go.l);
          expect(sister.key.split(':')[0]).toBe(go.key.split(':')[0]);
          expect(sister.n).not.toBe(go.n);
          expect(Math.abs(sister.n - go.n)).toBeLessThanOrEqual(2);
          expect(sister.answer).not.toBe(go.answer);
          expect(sisterGo(round, i, go)).toEqual(sister);
        });
        // A right tap on the sister sends the first go's right pick, so the taps replay as usual.
        const sent = goes.flatMap((go) => [{ pick: go.choices.find((c) => c !== go.answer)!, ms: 4000 }, { pick: go.answer, ms: 2000 }]);
        expect(replay(round, sent).done).toBe(true);
      }
    }
  });
});

describe('the kōwhai flowers', () => {
  it('turn bronze, silver, then gold, one per NZ day, with a Golden Nest and a new friend every 30 days', () => {
    expect(treeAfter(0)).toMatchObject({ nests: 0, friend: 'tui', today: 'bronze', flowers: Array(10).fill('bud') });
    expect(treeAfter(21)).toMatchObject({ today: 'gold', flowers: ['gold', ...Array(9).fill('silver')] });
    expect(treeAfter(DAYS_PER_NEST)).toMatchObject({ nests: 1, friend: 'kereru', day: 0 });
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastFlowerDay: '2026-11-04', flowerChanged: 0, goldenNest: false });
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, flowerChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, flowerChanged: 9, goldenNest: true });
  });
});

describe('ten and and ten less records (R9)', () => {
  it('shows a go by its way and key, still shows a challenge saved before the split, and refuses a mismatch', () => {
    const round = { seed: 5 };
    const plus = showGo(round, 0, { key: 'tenand:4', v: 1, l: 3 })!;
    expect([plus.answer, plus.parts.join(' ')]).toEqual([14, '4 + 10 = ?']);
    expect(showGo(round, 1, { key: 'tenless:4', v: 3, l: 3 })!.parts.join(' ')).toBe('14 − 10 = ?');
    expect(showGo(round, 2, { key: 'tenless:4', v: 2, l: 3 })!.parts.join(' ')).toBe('10 + ? = 14');
    expect(showGo(round, 3, { key: 'tenand:4', v: 3, l: 3 })!.answer).toBe(4); // saved before the split
    expect(showGo(round, 4, { key: 'tenless:4', v: 0, l: 3 })).toBeNull();
  });

  it('a child who knows only one kind of fact starts at step 1; both kinds start at step 3', () => {
    expect(startFor(inBox(KEYS.slice(0, 7), 2))).toEqual({ step: 1, level: 5 });
    expect(startFor(inBox(LESS_KEYS, 2))).toEqual({ step: 1, level: 5 });
    expect(startFor(inBox([...KEYS, ...LESS_KEYS.slice(0, 7)], 2))).toEqual({ step: 3, level: 4 });
  });
});

describe('the what’s next card (R8)', () => {
  it('is secure at 13 of the 18 ten-and and ten-less facts, not at nine plus facts alone, and the finish reply says so', async () => {
    const all = [...KEYS, ...LESS_KEYS];
    expect(topSecure(inBox(all.slice(0, 13), 2))).toBe(true);
    expect(topSecure(inBox(all.slice(0, 12), 2))).toBe(false);
    expect(topSecure(inBox(KEYS, 3))).toBe(false); // knows 10 + n, not yet the minus facts
    for (const [count, secure] of [[13, true], [12, false]] as const) {
      const data = emptyData();
      data.facts.p = inBox(all.slice(0, count), 2);
      const services = memoryServices({ data, now: () => Date.UTC(2026, 10, 7, 22) });
      const started = await handleTui(services, 'p', { action: 'start' });
      const round = started.body.round as Round;
      const taps: Tap[] = showRound(round).map((go) => ({ pick: go.answer, ms: 1000 }));
      const done = await handleTui(services, 'p', { action: 'finish', seed: round.seed, taps });
      expect(done.status).toBe(200);
      expect(done.body.topSecure).toBe(secure);
    }
  });
});

describe('help for each way of asking (S35)', () => {
  const perfect = (round: Round, hard: number | null): Tap[] =>
    showRound(round).flatMap((go) => (go.v === hard ? [{ pick: go.choices.find((c) => c !== go.answer)!, ms: 2000 }, { pick: go.answer, ms: 2000 }] : [{ pick: go.answer, ms: 1000 }]));

  it('a hard way keeps its help while the easy ways fade, and each go is shown at its own way’s level', async () => {
    const data = emptyData();
    data.players.p = { ...unplayed(), daysDone: 1, lastFlowerDay: '2026-11-05', step: 5, level: 3, version: 1 };
    let now = Date.UTC(2026, 10, 7, 22);
    const services = memoryServices({ data, now: () => now });
    for (let day = 0; day < 2; day++) {
      const round = (await handleTui(services, 'p', { action: 'start' })).body.round as Round;
      const done = await handleTui(services, 'p', { action: 'finish', seed: round.seed, taps: perfect(round, 3) });
      expect(done.status).toBe(200);
      now += 24 * 60 * 60 * 1000;
    }
    const levels = data.players.p.kindLevels;
    expect([levels.v0.level, levels.v1.level, levels.v2.level]).toEqual([2, 2, 2]);
    expect(levels.v3.level).toBeGreaterThanOrEqual(4);
    const next = (await handleTui(services, 'p', { action: 'start' })).body.round as Round;
    for (const g of next.goes) expect(g.l).toBe(levels[`v${g.v}`].level);
    // The whole-child level is still the step logic's own (the hard way did not drag the easy ones back, or the reverse).
    expect(data.players.p.level).toBeLessThan(levels.v3.level);
  });

  it('a new way starts at the whole-child level while old ways keep theirs, and a new step keeps the map', async () => {
    const data = emptyData();
    data.players.p = { ...unplayed(), daysDone: 1, lastFlowerDay: '2026-11-05', step: 3, level: 3, goodAtStep: 1, kindLevels: { v0: { level: 1, goodInRow: 0 }, v1: { level: 2, goodInRow: 0 } }, version: 1 };
    const services = memoryServices({ data, now: () => Date.UTC(2026, 10, 7, 22) });
    const round = (await handleTui(services, 'p', { action: 'start' })).body.round as Round;
    for (const g of round.goes) expect(g.l).toBe(g.v === 0 ? 1 : g.v === 1 ? 2 : 3);
    const done = await handleTui(services, 'p', { action: 'finish', seed: round.seed, taps: perfect(round, null) });
    expect(done.body).toMatchObject({ step: 4 });
    const saved = data.players.p;
    expect(Object.keys(saved.kindLevels).sort()).toEqual(['v0', 'v1', 'v2']);
    expect(saved.kindLevels.v0.level).toBeLessThanOrEqual(1);
    const next = (await handleTui(services, 'p', { action: 'start' })).body.round as Round;
    const fresh = next.goes.filter((g) => g.v === 3);
    expect(fresh.length).toBeGreaterThan(0);
    for (const g of fresh) expect(g.l).toBe(saved.level);
  });
});
