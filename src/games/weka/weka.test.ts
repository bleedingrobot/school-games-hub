import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Tap } from '../../../shared/weka/play';
import { DAYS_PER_BASKET } from '../../../shared/weka/progress';
import { replay } from '../../../shared/weka/play';
import { ALL_KEYS, showGo, showRound, wrongKind, type Round } from '../../../shared/weka/round';
import { allVoiceLines, whyLine } from './voiceLines';
import { trialBackend } from './backend';

const css = readFileSync(`${process.cwd()}/src/games/weka/weka.css`, 'utf8');

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (name: string) => css.match(new RegExp(`--wk-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const smallest = (name: string) => Number(css.match(new RegExp(`--wk-${name}: clamp\\((\\d+)px`))![1]);

/** Every go right first time, quickly. */
const perfect = (round: Round): Tap[] => showRound(round).map((g) => ({ pick: g.answer, ms: 1500 }));

describe('Weka’s Stepping Stones screens', () => {
  it('has 4.5:1 numbers on the stones and panel, big targets, and stops moving for pupils who prefer less', () => {
    expect(contrast(colour('ink'), colour('panel'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour('teal-dark'), colour('panel'))).toBeGreaterThanOrEqual(4.5); // the day count
    expect(smallest('choice')).toBeGreaterThanOrEqual(64);
    expect(Number(css.match(/\.wk-button \{[^}]*min-height: (\d+)px/)![1])).toBeGreaterThanOrEqual(44);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*animation: none !important; transition: none !important/);
  });
});

describe('the trial backend', () => {
  beforeEach(() => localStorage.clear());

  it('changes one stone a day, moves up from starting on 9 once those are right, refuses an unfinished round, and gives the Golden Picnic Basket on day 30', async () => {
    const { backend, tools } = trialBackend({ storageKey: 'test' });
    expect(await backend.load()).toMatchObject({ daysDone: 0, level: 1, help: 'fade' });
    const go = async () => {
      const round = await backend.start();
      return { round, result: await backend.finish(round.seed, perfect(round)) };
    };
    expect((await go()).result).toMatchObject({ daysDone: 1, stoneChanged: 0, goldenBasket: false, level: 1 });
    // Again the same day (just for fun): each fact counts once a round, so after a few quick perfect rounds starting on 9
    // is secure, but the help for those facts stays full: it only fades once a fact is right on two different days.
    let next = 1;
    for (let i = 0; i < 4 && next === 1; i++) next = (await go()).result.level;
    expect(next).toBe(2);
    const eights = await backend.start();
    expect(eights.level).toBe(2);
    expect(eights.goes.every((g) => g.h === 'full')).toBe(true);
    await expect(backend.finish(eights.seed, perfect(eights).slice(0, 3))).rejects.toThrow();
    tools.jumpTo(DAYS_PER_BASKET - 1);
    const gold = await backend.start();
    expect(gold.day).toBe('gold');
    expect(await backend.finish(gold.seed, perfect(gold))).toMatchObject({ daysDone: DAYS_PER_BASKET, goldenBasket: true });
  });
});

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

  it('makes the hops-to-ten choices with the whole small number and 10 among them', () => {
    for (const g of goes) {
      expect(g.toTenChoices).toHaveLength(4);
      expect(g.toTenWrongs.map((w) => w.kind).slice(0, 2)).toEqual(['other', 'ten']);
      expect(wrongKind(g.toTenWrongs, g.small)).toBe('other');
      expect(wrongKind(g.toTenWrongs, 10)).toBe('ten');
      expect(wrongKind(g.toTenWrongs, g.toTen)).toBeNull();
    }
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

  it('has a voice line for every mistake any go can show, and none says the answer', () => {
    const lines = new Set(allVoiceLines());
    for (const g of goes) {
      for (const w of g.wrongs) {
        expect(lines.has(whyLine(g, w.kind))).toBe(true);
        // The count of hops can equal the answer only when hopping back 18 − 9 (9 hops, lands on 9): that is a coincidence of the numbers.
        if (!(w.kind === 'off1' && g.small === g.answer)) expect(whyLine(g, w.kind)).not.toMatch(new RegExp(`\\b${g.answer}\\b`));
      }
      for (const w of g.toTenWrongs) {
        expect(lines.has(whyLine(g, w.kind))).toBe(true);
        expect(whyLine(g, w.kind)).not.toMatch(new RegExp(`\\b${g.toTen}\\b`));
      }
    }
  });
});
