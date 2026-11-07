import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAYS_PER_EGG } from '../../../shared/beanstalk/progress';
import { makeRound, replay, type Target, type Tap } from '../../../shared/beanstalk/round';
import { trialBackend } from './backend';

const css = readFileSync(`${process.cwd()}/src/games/beanstalk/beanstalk.css`, 'utf8');

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (name: string) => css.match(new RegExp(`--bs-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];

/** Every pair right, first time. */
function perfectTaps(seed: number, target: Target = 10): Tap[] {
  const round = makeRound(seed, target);
  const taps: Tap[] = [];
  for (let r = replay(round, taps); !r.done; r = replay(round, taps)) {
    const [a] = r.onScreen;
    taps.push({ a, b: r.onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] === target)!, ms: 900 });
  }
  return taps;
}

describe("Kiwi's Beanstalk screens", () => {
  it('has 4.5:1 words, big targets for small fingers, and stops moving for pupils who prefer less', () => {
    expect(contrast(colour('ink'), colour('panel'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour('ink'), '#ffffff')).toBeGreaterThanOrEqual(4.5); // the number on each leaf
    expect(contrast(colour('green-dark'), colour('panel'))).toBeGreaterThanOrEqual(4.5); // the day count
    expect(css).toMatch(/--bs-leaf: clamp\((\d+)px/);
    expect(Number(css.match(/--bs-leaf: clamp\((\d+)px/)![1])).toBeGreaterThanOrEqual(64);
    expect(Number(css.match(/\.bs-voice \{[^}]*min-height: (\d+)px/)![1])).toBeGreaterThanOrEqual(44);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*animation: none !important; transition: none !important/);
  });
});

describe('the trial backend', () => {
  beforeEach(() => localStorage.clear());

  it('chooses Jack or Jill, changes one leaf a day, and gives the egg on day 30', async () => {
    const { backend, tools } = trialBackend({ storageKey: 'test' });
    expect((await backend.load()).child).toBeNull();
    await backend.choose('jill');
    const go = async () => {
      const { seed } = await backend.start();
      return backend.finish(seed, perfectTaps(seed));
    };
    expect(await go()).toMatchObject({ daysDone: 1, leafChanged: 0, egg: false });
    expect(await go()).toMatchObject({ daysDone: 1, leafChanged: null }); // again the same day: just for fun
    const { seed } = await backend.start();
    await expect(backend.finish(seed, perfectTaps(seed).slice(0, 3))).rejects.toThrow(); // not finished
    tools.jumpTo(DAYS_PER_EGG - 1);
    expect(await go()).toMatchObject({ daysDone: DAYS_PER_EGG, egg: true });
    expect(await backend.load()).toMatchObject({ child: 'jill', daysDone: DAYS_PER_EGG });
    // The next beanstalk is bonds to 20 (R8), the one after it bonds to 100.
    const next = await backend.start();
    expect(await backend.finish(next.seed, perfectTaps(next.seed, 20))).toMatchObject({ daysDone: DAYS_PER_EGG, leafChanged: null });
    tools.jumpTo(2 * DAYS_PER_EGG);
    const tui = await backend.start();
    expect(await backend.finish(tui.seed, perfectTaps(tui.seed, 100))).toMatchObject({ daysDone: 2 * DAYS_PER_EGG + 1, leafChanged: 0 });
  });
});
