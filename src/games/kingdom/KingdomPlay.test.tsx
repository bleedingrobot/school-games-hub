import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { seededRandom } from '../../../shared/maths/serverQuestions';
import { KingdomPlay } from './KingdomPlay';
import { createTrialBackend } from './trialBackend';

// Kingdom Keeper's screen test (docs/TESTING.md: the game has 8 tests in all).

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
