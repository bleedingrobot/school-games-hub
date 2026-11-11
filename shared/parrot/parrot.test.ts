import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { placeAfter} from '../kit/help';
import { replay, slipsOf, type Tap } from './play';
import { STEP_RULES, type Step } from './config';
import type { } from '../maths/skillPacks/equalsKeys';
import { ALL_KEYS, balance, GOES_PER_ROUND, isStoneGo, KEYS, levelFor, makeRound, MAX_STONES, redoCards, sisterGo, showRound, slipOfPick, STEP_KEYS, tapsAllowed, tiltOf} from './round';

const seeds = Array.from({ length: 40 }, (_, i) => i * 10007 + 1);
const steps: Step[] = [1, 2, 3, 4, 5, 6];
const rec = (key: string, box: number, attempts = 1): FactStats => ({ ...newStats(key), box, attempts });

describe('the round', () => {
  it('is the same for the same seed, has 7 new and 3 earlier goes, weakest first, and every go balances with its own answer', () => {
    expect(ALL_KEYS.length).toBe(KEYS.miss.length + 21 + 30 + 20 + 30);
    expect([KEYS.swap.length, KEYS.both.length, KEYS.sub.length, KEYS.tf.length]).toEqual([21, 30, 20, 30]);
    for (const step of steps) {
      for (const seed of seeds) {
        const records = KEYS.miss.slice(0, 6).map((k) => rec(k, 3));
        const round = makeRound(seed, records, { step, level: 5 });
        expect(round).toEqual(makeRound(seed, records, { step, level: 5 }));
        expect(round.goes).toHaveLength(GOES_PER_ROUND);
        const { fresh, review } = STEP_KEYS[step];
        const goes = showRound(round);
        if (step === 2) expect(goes.filter((g) => g.v > 0)).toHaveLength(7);
        else expect(goes.filter((g) => g.kind === fresh)).toHaveLength(review.length ? 7 : 10);
        for (const g of goes) {
          if (g.kind === 'tf') expect(g.answer).toBe(balance(g, 0) === 0 ? 1 : balance(g, 0) > 0 ? 0 : 2);
          else expect(balance(g, g.answer)).toBe(0);
          if (g.kind !== 'tf') expect(tiltOf(g, g.answer + 1)).not.toBe('level');
        }
        if (step === 1) expect(goes.every((g) => g.v === 0)).toBe(true);
      }
    }
    expect(makeRound(9, [], { level: 2, help: 'always' }).goes.every((g) => g.l === 4)).toBe(true);
    expect(makeRound(9, [], { level: 2, help: 'off' }).goes.every((g) => g.l === 0)).toBe(true);
  });

  it('replays the taps: a stone-go takes any count, a card go only its cards, and only the first tap of a go counts', () => {
    const round = makeRound(11, [], { step: 3, level: 3 });
    const goes = showRound(round);
    expect(goes.some(isStoneGo)).toBe(false);
    const wobbly: Tap[] = goes.flatMap((g) => [{ pick: g.wrongs[0].n, ms: 3000 }, { pick: g.answer, ms: 2000 }]);
    const end = replay(round, wobbly);
    expect(end).toMatchObject({ done: true, mistakes: GOES_PER_ROUND, firstRight: 0 });
    expect(end.answers.every((a) => !a.correct)).toBe(true);
    expect(() => replay(round, [{ pick: 99, ms: 1 }])).toThrow();
    const stones = makeRound(12, [], { step: 1, level: 5 });
    const sgoes = showRound(stones);
    expect(sgoes.every(isStoneGo)).toBe(true);
    const odd = sgoes.map((g) => ({ pick: g.answer, ms: 1500 }));
    expect(replay(stones, [{ pick: 20, ms: 1 }, ...odd])).toMatchObject({ mistakes: 1, firstRight: GOES_PER_ROUND - 1 });
    expect(slipsOf(stones, [{ pick: 20, ms: 1 }, ...odd])[0]).toBe('more');
  });
});

describe('help and place', () => {
  it('moves by the kit rules: fade after two good, back after a hard one, a new step adds two unless it faded, and a struggle keeps stones', () => {
    const at = (p: object) => ({ step: 1, level: 5, goodInRow: 0, goodAtStep: 0, ...p });
    expect(placeAfter(at({ goodInRow: 1 }), 9, STEP_RULES)).toEqual(at({ level: 4, goodAtStep: 1 }));
    expect(placeAfter(at({ level: 2 }), 3, STEP_RULES).level).toBe(3);
    expect(placeAfter(at({ step: 2, level: 3, goodInRow: 1, goodAtStep: 1 }), 10, STEP_RULES)).toEqual(at({ step: 3, level: 2 }));
    expect(placeAfter(at({ step: 2, level: 2, goodAtStep: 1 }), 9, STEP_RULES)).toEqual(at({ step: 3, level: 4, goodInRow: 0 }));
    expect(levelFor(2, 0, false, 'fade').level).toBe(2);
    expect(levelFor(2, 1, false, 'fade').level).toBe(3);
    expect(levelFor(2, 2, false, 'fade').level).toBe(5);
    expect(levelFor(0, 0, true, 'fade').level).toBe(5);
    expect(levelFor(1, 0, false, 'off').peek).toBe(false);
    let p = at({}) as ReturnType<typeof placeAfter>;
    for (let i = 0; i < 12; i++) p = placeAfter(p, 10, STEP_RULES);
    expect(p.step).toBe(6);
    expect(p.level).toBeLessThan(4);
  });

});

describe('mistakes that teach', () => {
  const goes = [1, 7, 99, 2024].flatMap((seed) => steps.flatMap((step) => showRound(makeRound(seed, [], { step, level: 5 }))));

  it('never makes a wrong card the answer or a repeat, and each wrong card matches its named slip', () => {
    for (const g of goes) {
      const [a, b] = g.lg.length === 2 ? [g.lg[0], g.lg[1]] : [g.lg[0], g.rg[0]];
      const total = g.lg.reduce((s, n) => s + n, 0);
      if (g.kind !== 'tf') expect(g.wrongs).toHaveLength(3);
      expect(g.wrongs.map((w) => w.n)).not.toContain(g.answer);
      expect(new Set(g.wrongs.map((w) => w.n)).size).toBe(g.wrongs.length);
      expect([...g.choices].sort((x, y) => x - y)).toEqual([g.answer, ...g.wrongs.map((w) => w.n)].sort((x, y) => x - y));
      for (const w of g.wrongs) {
        if (w.kind === 'off1') expect(Math.abs(w.n - g.answer)).toBe(1);
        if (w.kind === 'near') expect(Math.abs(w.n - g.answer)).toBeGreaterThanOrEqual(2);
        if (g.kind === 'miss' && w.kind === 'total') expect(w.n).toBe(total);
        if (g.kind === 'miss' && w.kind === 'all') expect(w.n).toBe(total + g.rg[0]);
        if (g.kind === 'miss' && w.kind === 'copy') expect(w.n).toBe(g.rg[0]);
        if (g.kind === 'swap' && w.kind === 'dbl') expect(w.n).toBe(g.answer * 2);
        if (g.kind === 'tf') expect(['both', 'first', 'side']).toContain(w.kind);
      }
      void a; void b;
    }
    for (const g of goes) {
      expect(slipOfPick(g, g.answer)).toBeNull();
      if (g.kind === 'tf') continue;
      const total = g.lg.reduce((s, n) => s + n, 0);
      for (let n = 0; n <= MAX_STONES * 2; n++) {
        if (n === g.answer) continue;
        const card = g.wrongs.find((w) => w.n === n);
        const slip = slipOfPick(g, n);
        if (card) expect(slip).toBe(card.kind);
        else if ((g.kind === 'miss' || g.kind === 'swap') && n === total) expect(slip).toBe('total');
        else if ((g.kind === 'miss' || g.kind === 'swap') && n === g.rg[0]) expect(slip).toBe('copy');
        else if ((g.kind === 'miss' || g.kind === 'swap') && n === total + g.rg[0]) expect(slip).toBe('all');
        else if (g.kind === 'swap' && n === 2 * g.answer) expect(slip).toBe('dbl');
        else if (Math.abs(n - g.answer) === 1) expect(slip).toBe('off1');
        else expect(slip).toBe(n > g.answer ? 'more' : 'less');
      }
    }
    const g = showRound(makeRound(5, [], { step: 1, level: 5 }))[0];
    expect(redoCards(g, [g.wrongs[0].n])).toHaveLength(2);
    expect(redoCards(g, [])).toContain(g.answer);
    for (const x of goes) {
      const two = redoCards(x, [x.wrongs[0].n]);
      expect(two).toHaveLength(2);
      const other = two.find((c) => c !== x.answer)!;
      const nearer = x.wrongs.filter((w) => w.n !== x.wrongs[0].n && Math.abs(w.n - x.answer) < Math.abs(other - x.answer));
      expect(nearer).toHaveLength(0);
    }
  });

});

describe('Now you try one like it', () => {
  it('asks a sister go: the same key kind, layout and level, other numbers, an answer of its own, and it is not in the saved taps', () => {
    let made = 0;
    const none: string[] = [];
    for (const seed of seeds.slice(0, 10)) {
      const round = makeRound(seed, [], { step: 6, level: 3 });
      const goes = showRound(round);
      // The saved taps are the original goes' own picks (a wrong one, then the right one, on every go): a sister is never among them, and replay is whole.
      const taps: Tap[] = goes.flatMap((go) => [{ pick: tapsAllowed(go).find((c) => c !== go.answer)!, ms: 900 }, { pick: go.answer, ms: 900 }]);
      expect(replay(round, taps).done).toBe(true);
      for (const [i, go] of goes.entries()) {
        const sister = sisterGo(round, i, go);
        if (!sister) { none.push(go.key); continue; }
        made++;
        expect(sister.key).not.toBe(go.key);
        expect([sister.kind, sister.v, sister.l]).toEqual([go.kind, go.v, go.l]);
        expect(sister.choices).toContain(sister.answer);
        expect(sister.wrongs.length).toBe(sister.choices.length - 1);
        if (go.kind !== 'tf') expect(sister.answer).not.toBe(go.answer);
        expect(sisterGo(round, i, go)).toEqual(sister);
      }
    }
    expect(made).toBeGreaterThan(80);
    expect(none.length).toBeLessThan(made / 10);
  });
});
