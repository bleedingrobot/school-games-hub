import { readFileSync } from 'node:fs';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { seededRandom } from '../../../shared/maths/serverQuestions';
import { DecreePlay } from './DecreePlay';
import { createTrialBackend } from './trialBackend';

// Royal Decree's screen tests (2 of the game's 7: one plays, one checks the looks).

it('plays a first year: begin, say yes and no, help with a riddle, and reach year 2', async () => {
  const u = userEvent.setup();
  render(<DecreePlay backend={createTrialBackend('test', { save: false, random: seededRandom('screen test') })} />);
  await u.click(await screen.findByRole('button', { name: 'Begin your reign' }));
  expect(screen.getByLabelText(/Year 1 of 6, Spring/)).toBeInTheDocument();

  let riddles = 0;
  const step = async () => {
    for (const name of ['Got it', 'Next', 'On we go']) {
      const b = screen.queryByRole('button', { name });
      if (b) return u.click(b);
    }
    const help = screen.queryByRole('button', { name: /^Help / });
    if (help) {
      riddles++;
      await u.click(help);
      await screen.findByRole('dialog');
      await u.keyboard('1{Enter}');
      return waitForElementToBeRemoved(() => screen.queryByRole('dialog'), { timeout: 5000 });
    }
    return u.keyboard('{ArrowRight}');
  };
  for (let i = 0; i < 40 && !screen.queryByText('Year 2 begins!') && !screen.queryByText(/Seasons ruled/); i++) {
    await step();
  }
  expect(riddles).toBe(1);
  expect(screen.getByText(/Year 2 begins!|Seasons ruled/)).toBeInTheDocument();
});

const css = readFileSync(`${process.cwd()}/src/games/decree/decree.css`, 'utf8');
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (name: string) => css.match(new RegExp(`--rd-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];

it('reads well, has big enough targets and keeps still when asked', () => {
  for (const text of ['ink', 'soft', 'red', 'blue', 'green', 'warn']) {
    for (const bg of ['#ffffff', '#fffdf6', '#f3f8ff', '#fff7d6', '#eaf4fb']) expect(contrast(colour(text), bg), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
  // White words on the yes, no and orange buttons.
  for (const bg of ['#1f5f94', '#2b6a23', colour('hot-deep')]) expect(contrast('#ffffff', bg)).toBeGreaterThanOrEqual(4.5);
  expect(css).toMatch(/\.rd-btn \{[^}]*min-height: 44px; min-width: 44px/);
  expect(css).toMatch(/prefers-reduced-motion: reduce[^}]*\{[^}]*transition: none !important/);
});
