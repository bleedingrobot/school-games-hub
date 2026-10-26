import { readFileSync } from 'node:fs';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { seededRandom } from '../../../shared/maths/serverQuestions';
import { KingdomPlay } from './KingdomPlay';
import { createTrialBackend } from './trialBackend';

// Kingdom Keeper's two screen tests (docs/TESTING.md: the game has 8 tests in all).

it('plays a year: begin a reign, answer a council question, plan the year and reach the next report', async () => {
  const u = userEvent.setup();
  render(<KingdomPlay backend={createTrialBackend('test', { save: false, random: seededRandom('screen test') })} />);
  await u.click(await screen.findByRole('button', { name: 'Begin your reign' }));
  expect(await screen.findByRole('heading', { name: 'Year 1: the steward’s report' })).toHaveFocus();

  await u.click(screen.getByRole('button', { name: 'Meet your council' }));
  await u.click(await screen.findByRole('button', { name: 'Hear the question' }));
  await u.keyboard('1{Enter}');
  // The server marked it: the council shows how it went, and the next adviser is asking.
  expect(await screen.findByText(/\((boon won!|no boon this year)\)/, {}, { timeout: 5000 })).toBeInTheDocument();
  await waitForElementToBeRemoved(() => screen.queryByRole('dialog'), { timeout: 5000 });
  while (screen.queryByRole('button', { name: 'Not this year' })) await u.click(screen.getByRole('button', { name: 'Not this year' }));

  await u.click(screen.getByRole('button', { name: 'Make this year’s plans' }));
  expect(screen.getByRole('heading', { name: 'The Market' })).toHaveFocus();
  await u.click(screen.getByRole('button', { name: 'Next: Granary' }));
  await u.click(screen.getByRole('button', { name: 'Feed everyone' }));
  await u.click(screen.getByRole('button', { name: 'Next: Fields' }));
  await u.click(screen.getByRole('button', { name: /^Plant all you can/ }));
  await u.click(screen.getByRole('button', { name: 'Next: Check' }));
  expect(screen.getByText('Feed the people 2,000 bushels: everyone fed.')).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'End the year' }));

  // The year's painted cards, then year 2.
  while (!screen.queryByRole('button', { name: 'On to year 2' })) await u.click(await screen.findByRole('button', { name: 'Next' }));
  await u.click(screen.getByRole('button', { name: 'On to year 2' }));
  expect(await screen.findByRole('heading', { name: 'Year 2: the steward’s report' })).toHaveFocus();
  expect(screen.getByRole('list', { name: 'Riverstone now' })).toHaveTextContent('Year 2 of 10');
});

const css = readFileSync(`${process.cwd()}/src/games/kingdom/kingdom.css`, 'utf8');

/** WCAG relative luminance and contrast ratio. */
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (name: string) => css.match(new RegExp(`--kk-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];

it('reads well, has big enough targets and keeps still when asked', () => {
  // Text on parchment (its lightest and darkest), and on the wood.
  for (const text of ['ink', 'soft', 'red', 'blue', 'green', 'warn']) {
    for (const bg of [colour('panel'), '#efdcb6', '#e6d2a6']) expect(contrast(colour(text), bg), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
  for (const text of ['cream', 'gold']) {
    for (const bg of [colour('bg'), colour('wood')]) expect(contrast(colour(text), bg), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
  // Buttons, fields, the map's labels and the fold-outs are at least 44px high.
  for (const m of css.matchAll(/([^{}]+)\{[^}]*?min-height:\s*(\d+)px/g)) {
    if (/(btn|input|summary|look|spot)/.test(m[1])) expect(Number(m[2]), m[1].trim()).toBeGreaterThanOrEqual(44);
  }
  expect(css).toMatch(/\.kk-btn \{[^}]*min-height: 44px/);
  // Every animation stops when the pupil prefers less movement.
  const reduce = css.slice(css.indexOf('prefers-reduced-motion: reduce'));
  for (const m of css.matchAll(/\.(kk-[a-z-]+)\s*\{[^}]*animation:\s*kk-/g)) expect(reduce, m[1]).toContain(`.${m[1]} { animation: none`);
});
