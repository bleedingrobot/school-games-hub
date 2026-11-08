import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Tap } from '../../../shared/korora/play';
import { DAYS_PER_FISH } from '../../../shared/korora/progress';
import { showRound, type Round } from '../../../shared/korora/round';
import { trialBackend } from './backend';

const css = readFileSync(`${process.cwd()}/src/games/korora/korora.css`, 'utf8');

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (name: string) => css.match(new RegExp(`--kr-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const smallest = (name: string) => Number(css.match(new RegExp(`--kr-${name}: clamp\\((\\d+)px`))![1]);

/** Every go right first time, quickly. */
const perfect = (round: Round): Tap[] => showRound(round).map((g) => ({ pick: g.answer, ms: 1500 }));

describe('Penguin Pairs screens', () => {
  it('has 4.5:1 numbers on the pebbles and panel, big targets, and stops moving for pupils who prefer less', () => {
    expect(contrast(colour('ink'), colour('panel'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour('teal-dark'), colour('panel'))).toBeGreaterThanOrEqual(4.5); // the day count
    expect(smallest('choice')).toBeGreaterThanOrEqual(64);
    expect(Number(css.match(/\.kr-button \{[^}]*min-height: (\d+)px/)![1])).toBeGreaterThanOrEqual(44);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*animation: none !important; transition: none !important/);
  });
});

describe('the trial backend', () => {
  beforeEach(() => localStorage.clear());

  it('changes one pebble a day, moves up from doubles once they are right, refuses an unfinished round, and gives the Golden Fish on day 30', async () => {
    const { backend, tools } = trialBackend({ storageKey: 'test' });
    expect(await backend.load()).toMatchObject({ daysDone: 0, level: 1, help: 'fade' });
    const go = async () => {
      const round = await backend.start();
      return { round, result: await backend.finish(round.seed, perfect(round)) };
    };
    expect((await go()).result).toMatchObject({ daysDone: 1, pebbleChanged: 0, goldenFish: false, level: 1 });
    // Again the same day (just for fun): the answers count, but the level stays; the next day's first finish moves it.
    expect((await go()).result).toMatchObject({ daysDone: 1, pebbleChanged: null, levelBefore: 1, level: 1 });
    tools.nextDay();
    expect((await go()).result).toMatchObject({ levelBefore: 1, level: 2 });
    expect((await backend.start()).level).toBe(2);
    const round = await backend.start();
    await expect(backend.finish(round.seed, perfect(round).slice(0, 3))).rejects.toThrow();
    tools.jumpTo(DAYS_PER_FISH - 1);
    const gold = await backend.start();
    expect(gold.gold).toBe(true);
    expect(await backend.finish(gold.seed, perfect(gold))).toMatchObject({ daysDone: DAYS_PER_FISH, goldenFish: true });
  });
});
