import { describe, expect, it } from 'vitest';
import type { } from '../../../shared/weka/play';
import { replay } from '../../../shared/weka/play';
import { ALL_KEYS, showGo, showRound, type Round } from '../../../shared/weka/round';

describe('mistakes that teach', () => {
  const plans = ALL_KEYS.flatMap((key) => ([0, 1, 2] as const).map((v) => ({ key, v, h: 'full' as const })));
  const goes = plans.flatMap((plan) => Array.from({ length: 40 }, (_, i) => showGo({ seed: 1000 + i * 37 }, i % 10, plan)!));

  it('gives every go four different choices, the right one among them, each wrong one with a mistake behind it and no more than two ending alike', () => {
    for (const g of goes) {
      expect(g.choices).toHaveLength(4);
      expect(new Set(g.choices).size).toBe(4);
      expect(g.choices).toContain(g.answer);
      expect(g.wrongs.map((w) => w.n).sort()).toEqual(g.choices.filter((n) => n !== g.answer).sort());
      expect(g.choices.filter((n) => n % 10 === g.answer % 10).length).toBeLessThanOrEqual(2);
      expect(g.kind === 'back' ? g.wrongs.every((w) => ['rock', 'add', 'off1'].includes(w.kind)) : g.wrongs.every((w) => w.kind !== 'add')).toBe(true);
    }
    const seen = new Set(goes.flatMap((g) => g.wrongs.map((w) => `${g.kind === 'back' ? 'back' : 'add'}:${w.kind}`)));
    expect([...seen].sort()).toEqual(['add:double', 'add:off1', 'add:part', 'add:rock', 'back:add', 'back:off1', 'back:rock']);
    // The kinds mean what the plan says: stopped at the rock, the whole small number on ten, the leftover on the big number.
    const g = showGo({ seed: 5 }, 0, { key: 'add:5+8', v: 1, h: 'full' })!;
    for (const w of g.wrongs) expect(w.kind === 'off1' ? Math.abs(w.n - 13) : w.n).toBe(w.kind === 'rock' ? 10 : w.kind === 'double' ? 15 : w.kind === 'part' ? 11 : 1);
  });

  it('scores only a go’s first tap, however many wrong taps and redo taps follow', () => {
    const round: Round = { seed: 9, level: 1, day: 'bronze', goes: [{ key: 'add:5+8', v: 1, h: 'full' }, ...Array.from({ length: 9 }, () => ({ key: 'add:6+8', v: 1 as const, h: 'full' as const }))] };
    const shown = showRound(round);
    const [w1, w2] = shown[0].wrongs;
    const taps = [{ pick: w1.n, ms: 900 }, { pick: w2.n, ms: 900 }, { pick: w1.n, ms: 900 }, { pick: shown[0].answer, ms: 900 }, ...shown.slice(1).map((g) => ({ pick: g.answer, ms: 900 }))];
    const r = replay(round, taps);
    expect(r.done).toBe(true);
    expect(r.answers[0]).toMatchObject({ key: 'add:5+8', correct: false, ms: 900 });
    expect(r.answers.filter((a) => a.key === 'add:5+8')).toHaveLength(1);
    expect(r.firstRight).toBe(9);
  });

});
