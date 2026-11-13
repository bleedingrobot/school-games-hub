import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { nextStep, parse, stepValue, tokensOf } from '../../../shared/orderup/expr';
import { trialBackend } from './backend';
import { stepNumbers } from './look';
import { OrderUpGame } from './OrderUpGame';

const expr = () => document.querySelector('.ou-expr')!.getAttribute('aria-label')!;
const numberButtons = () => [...document.querySelectorAll<HTMLButtonElement>('.ou-num')];

/** Taps the step that goes next and types its answer, as a pupil would. */
async function doStep() {
  const root = parse(expr());
  const step = nextStep(root)!;
  const order = tokensOf(root).filter((t) => t.kind === 'num').map((t) => t.id);
  if (!document.querySelector('.ou-pad')) for (const id of stepNumbers(step)) await userEvent.click(numberButtons()[order.indexOf(id)]);
  await userEvent.keyboard(`${stepValue(step)}{Enter}`);
}

describe('Order Up! screens', () => {
  afterEach(cleanup);

  it('shows the worked example first, guides the first bag, hints after a wrong pick, collapses the bag onto the ticket and passes a level', async () => {
    let r = 0.37;
    const backend = trialBackend({ random: () => (r = (r * 9301 + 0.49297) % 1) });
    render(<OrderUpGame backend={backend} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));

    // The worked example, line by line, then the pupil's turn.
    expect(await screen.findByText('How it works: Left to right')).toBeTruthy();
    while (!screen.queryByRole('button', { name: 'My turn' })) await userEvent.click(screen.getByRole('button', { name: 'Next line' }));
    await userEvent.click(screen.getByRole('button', { name: 'My turn' }));

    // The guided first bag: the right pair glows. A pick of two numbers not joined by one sign gets the hint.
    expect(document.querySelectorAll('.ou-num--glow')).toHaveLength(2);
    const first = expr();
    const nums = numberButtons();
    await userEvent.click(nums[0]);
    await userEvent.click(nums[nums.length - 1]);
    expect(screen.getByRole('status').textContent).toMatch(/aren't joined by one sign/);

    // Solving it: each step collapses the bag and writes a line on the ticket.
    await doStep();
    const ticket = [...document.querySelectorAll('.ou-ticket__line')].map((l) => l.textContent);
    expect(ticket).toEqual([first, `= ${expr()}`]);

    // The rest of this bag and the other seven, then the set's result: 8 good bags pass level 1 and give its achievement.
    expect(await screen.findByLabelText('Bag 1 of 8')).toBeTruthy();
    while (!screen.queryByText(/Level passed/)) {
      const shown = document.querySelector('.ou-expr');
      if (shown && parse(expr()).kind !== 'num') await doStep();
      else await new Promise((done) => setTimeout(done, 5));
    }
    expect(await screen.findByText('Level passed: Left to right!')).toBeTruthy();
    expect(screen.getByText('New achievement: Left to right')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next level' })).toBeTruthy();
  });
});
