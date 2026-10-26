import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import type { Card101GameReport } from '../../../shared/card101/save';
import { Card101Solo, type Card101Saving } from './Card101Solo';

function renderGame(saving?: Card101Saving) {
  const onLevelChange = vi.fn();
  const view = render(
    <SoundProvider>
      <Card101Solo
        player={{ name: 'Speedy Otter 27', avatar: {} }}
        level="very-easy"
        onLevelChange={onLevelChange}
        saving={saving}
        timeScale={0}
      />
    </SoundProvider>,
  );
  return { onLevelChange, view };
}

/** A pretend server: hands out seeds and keeps what it's sent. */
function fakeSaving(seed: string | null = 's1-1792000000-0123456789abcdef01234567') {
  const saved: Card101GameReport[] = [];
  const left: Card101GameReport[] = [];
  const saving: Card101Saving = {
    seed: vi.fn(async () => (seed ? { seed, stamp: 'x'.repeat(43) } : null)),
    save: vi.fn(async (report: Card101GameReport) => {
      saved.push(report);
      return { countsForPoints: true };
    }),
    abandon: vi.fn((report: Card101GameReport) => {
      left.push(report);
    }),
  };
  return { saving, saved, left };
}

async function deal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
  await user.click(await screen.findByRole('button', { name: /remembered them/ }));
}

beforeEach(() => localStorage.clear());

describe('101 against bots', () => {
  it('take a card and swap it in: it goes face up; the knock waits for everyone’s first turn', async () => {
    const user = userEvent.setup();
    renderGame();
    await deal(user);
    const stack = () => screen.getByRole('button', { name: /^Stack:/ });
    await waitFor(() => expect(stack()).toBeEnabled());
    expect(screen.getByRole('button', { name: /Knock/ })).toBeDisabled();
    expect(screen.getByText(/knock once everyone has had a turn/)).toBeInTheDocument();
    await user.click(stack());
    const card = screen.getByRole('img', { name: /Your new card: / }).getAttribute('aria-label')!.replace('Your new card: ', '');
    const mine = screen.getByRole('group', { name: 'Your four cards' });
    expect(within(mine).getAllByRole('button', { name: /^Swap with/ })).toHaveLength(4);
    await user.click(within(mine).getByRole('button', { name: /Swap with your top left/ }));
    expect(within(mine).getAllByRole('button')[0]).toHaveAccessibleName(`Your card, top left: ${card}, face up`);
    expect(screen.getByText(new RegExp(`You put the ${card} face up in your top left spot`))).toBeInTheDocument();
  });

  it('records a game the student leaves part-way, once', async () => {
    const user = userEvent.setup();
    const { saving, left } = fakeSaving();
    const { view } = renderGame(saving);
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    await screen.findByRole('button', { name: /remembered them/ });
    // Leaving before doing anything records nothing.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(left).toEqual([]);
    await deal(user);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    view.unmount();
    expect(left).toHaveLength(1);
    expect(left[0]).toEqual(expect.objectContaining({ ending: 'abandoned', actions: ['peek'] }));
  });
});
