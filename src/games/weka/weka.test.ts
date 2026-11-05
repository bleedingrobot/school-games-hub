import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Tap } from '../../../shared/weka/play';
import { DAYS_PER_BASKET } from '../../../shared/weka/progress';
import { showRound, type Round } from '../../../shared/weka/round';
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
