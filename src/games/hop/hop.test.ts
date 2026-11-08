import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Tap } from '../../../shared/hop/play';
import { DAYS_PER_JAR } from '../../../shared/hop/progress';
import { showRound, type Round } from '../../../shared/hop/round';
import { trialBackend } from './backend';

const css = readFileSync(`${process.cwd()}/src/games/hop/hop.css`, 'utf8');

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (name: string) => css.match(new RegExp(`--hp-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const smallest = (name: string) => Number(css.match(new RegExp(`--hp-${name}: clamp\\((\\d+)px`))![1]);

/** Every hop right first time, quickly. */
const perfect = (round: Round): Tap[] => showRound(round).map((h) => ({ pick: h.answer, ms: 1500 }));

describe("Hop's Glow-worm Pond screens", () => {
  it('has 4.5:1 numbers on the pads and glow-worms at night, big targets, and stops moving for pupils who prefer less', () => {
    expect(contrast(colour('ink'), colour('panel'))).toBeGreaterThanOrEqual(4.5); // pad numbers, step labels, the panel
    expect(contrast(colour('ink'), '#a8ecf7')).toBeGreaterThanOrEqual(4.5); // the darkest edge of a glow-worm's bead
    expect(contrast(colour('teal-dark'), colour('panel'))).toBeGreaterThanOrEqual(4.5); // the day count
    expect(smallest('worm')).toBeGreaterThanOrEqual(64);
    expect(smallest('pad-size')).toBeGreaterThanOrEqual(54);
    expect(Number(css.match(/\.hp-button \{[^}]*min-height: (\d+)px/)![1])).toBeGreaterThanOrEqual(44);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^}]*animation: none !important; transition: none !important/);
  });
});

describe('the trial backend', () => {
  beforeEach(() => localStorage.clear());

  it('changes one pad a day, moves up from 10s once they are right, refuses an unfinished round, and gives the jar on day 30', async () => {
    const { backend, tools } = trialBackend({ storageKey: 'test' });
    expect(await backend.load()).toMatchObject({ daysDone: 0, step: 10 });
    const go = async () => {
      const round = await backend.start();
      return { round, result: await backend.finish(round.seed, perfect(round)) };
    };
    expect((await go()).result).toMatchObject({ daysDone: 1, padChanged: 0, jar: false, step: 10 });
    expect((await go()).result).toMatchObject({ daysDone: 1, padChanged: null }); // again the same day: just for fun
    // Playing on the same day, even until the 10s are secure, keeps the step: only the next day's first finish moves the child on to 5s.
    for (let i = 0; i < 10; i++) expect((await go()).result).toMatchObject({ padChanged: null, step: 10 });
    tools.nextDay();
    expect((await go()).result).toMatchObject({ stepBefore: 10, step: 5 });
    expect((await backend.start()).step).toBe(5);
    const round = await backend.start();
    await expect(backend.finish(round.seed, perfect(round).slice(0, 3))).rejects.toThrow(); // not finished
    tools.jumpTo(DAYS_PER_JAR - 1);
    const gold = await backend.start();
    expect(gold.gold).toBe(true);
    expect(await backend.finish(gold.seed, perfect(gold))).toMatchObject({ daysDone: DAYS_PER_JAR, jar: true });
  });

  it('says the twos are secure only once they are, in the finish reply, and goes on to threes', async () => {
    const { backend, tools } = trialBackend({ storageKey: 'signpost' });
    expect((await backend.load()).topSecure).toBe(false);
    tools.makeSecure(2);
    expect(await backend.load()).toMatchObject({ step: 2, topSecure: true }); // twos done, and the signpost shows
    tools.nextDay();
    const round = await backend.start();
    expect(await backend.finish(round.seed, perfect(round))).toMatchObject({ step: 3, stepBefore: 2, topSecure: true }); // threes from the first finish of the day
  });
});
