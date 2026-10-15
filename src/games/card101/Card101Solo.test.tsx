import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { Card101Solo, barLevel, placesFrom } from './Card101Solo';

function renderGame() {
  const onLevelChange = vi.fn();
  render(
    <SoundProvider>
      <Card101Solo player={{ name: 'Speedy Otter 27', avatar: {} }} level="very-easy" onLevelChange={onLevelChange} timeScale={0} />
    </SoundProvider>,
  );
  return { onLevelChange };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

async function deal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
  await user.click(await screen.findByRole('button', { name: /remembered them/ }));
}

beforeEach(() => localStorage.clear());

describe('101 against bots', () => {
  it('shows the settings, remembers them, and passes on the bot level', async () => {
    const user = userEvent.setup();
    const { onLevelChange } = renderGame();
    expect(screen.getByRole('heading', { name: /101/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Normal: to 101/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: '3' }));
    await user.click(screen.getByRole('radio', { name: /Quick: to 50/ }));
    await user.click(screen.getByRole('radio', { name: 'Medium' }));
    expect(onLevelChange).toHaveBeenCalledWith('medium');
    expect(JSON.parse(localStorage.getItem('sgh-101-prefs')!)).toEqual({ bots: 3, target: 50 });
  });

  it('deals 4 face-down cards each and shows only your bottom two during the peek', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    await screen.findByRole('button', { name: /remembered them/ });
    const mine = screen.getByRole('group', { name: 'Your four cards' });
    const labels = within(mine).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels[0]).toMatch(/top left: face down/);
    expect(labels[1]).toMatch(/top right: face down/);
    expect(labels[2]).toMatch(/bottom left: .+ of .+, face up/);
    expect(labels[3]).toMatch(/bottom right: .+ of .+, face up/);
    // The bots' cards are all face down.
    for (const name of ['Kea’s cards', 'Tūī’s cards']) {
      const seat = screen.getByRole('region', { name });
      expect(within(seat).getAllByRole('img', { name: /face down/ })).toHaveLength(4);
    }
    await user.click(screen.getByRole('button', { name: /remembered them/ }));
    await waitFor(() => expect(within(mine).getAllByRole('button', { name: /face down/ })).toHaveLength(4));
  });

  it('take a card, swap it in: it goes face up and that spot is locked; the knock waits for everyone’s first turn', async () => {
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
    // Next turn: the face-up spot can't be picked again.
    await waitFor(() => expect(stack()).toBeEnabled());
    await user.click(stack());
    expect(within(mine).getAllByRole('button', { name: /^Swap with/ })).toHaveLength(3);
    expect(within(mine).getAllByRole('button')[0]).toBeDisabled();
  });

  it('works from the keyboard: S takes from the stack, T throws it away, D takes the discard', async () => {
    const user = userEvent.setup();
    renderGame();
    await deal(user);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Stack:/ })).toBeEnabled());
    await user.keyboard('s');
    const held = screen.getByRole('img', { name: /Your new card: / }).getAttribute('aria-label')!.replace('Your new card: ', '');
    await user.keyboard('t');
    // (The bots play straight away in tests, so check the log, not the pile.)
    expect(screen.getByText(`You threw away the ${held}.`)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Stack:/ })).toBeEnabled());
    const top = screen.getByRole('button', { name: /^Discard pile:/ }).getAttribute('aria-label')!.match(/: (.+)\. Take it/)![1];
    await user.keyboard('d');
    expect(screen.getByRole('img', { name: /Your new card: / })).toHaveAccessibleName(`Your new card: ${top}`);
  });

  it('plays a whole Quick game to the podium, with the scoring show after every round', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sgh-101-prefs', JSON.stringify({ bots: 1, target: 50 }));
    renderGame();
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    let rounds = 0;
    for (let guard = 0; guard < 3000; guard++) {
      if (screen.queryByRole('dialog', { name: /You (won|came|shared)/ })) break;
      const see = screen.queryByRole('button', { name: /See who won/ });
      const next = screen.queryByRole('button', { name: /Next round/ });
      const peek = screen.queryByRole('button', { name: /remembered them/ });
      const pick = screen.queryAllByRole('button', { name: /^Swap with/ });
      const throwIt = screen.queryByRole('button', { name: /Throw it away/ });
      const stack = screen.queryByRole('button', { name: /^Stack:/ });
      if (see || next) {
        expect(screen.getByRole('dialog', { name: /Round \d+ scores/ })).toBeInTheDocument();
        expect(screen.getAllByText(/^Hand: /).length).toBe(2);
        rounds++;
        await user.click((see ?? next)!);
      } else if (peek) await user.click(peek);
      else if (pick.length) await user.click(pick[pick.length - 1]);
      else if (throwIt) await user.click(throwIt);
      else if (stack && !stack.hasAttribute('disabled')) await user.click(stack);
      else await tick();
    }
    const podium = await screen.findByRole('dialog', { name: /You (won|came|shared)/ });
    expect(rounds).toBeGreaterThan(1);
    expect(within(podium).getAllByRole('listitem')).toHaveLength(2);
    expect(within(podium).getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  }, 30_000);
});

describe('101 screen helpers', () => {
  it('places go lowest first, and ties share a place', () => {
    expect(placesFrom([40, 12, 55], [false, false, false])).toEqual([2, 1, 3]);
    expect(placesFrom([20, 20, 30, 5], [false, false, false, false])).toEqual([2, 2, 4, 1]);
    expect(placesFrom([20, 0, 30], [false, true, false])).toEqual([1, 0, 2]);
  });

  it('score bars turn amber after 75% of the way and red after 90%', () => {
    expect(barLevel(70, 101)).toBe('ok');
    expect(barLevel(76, 101)).toBe('warn');
    expect(barLevel(91, 101)).toBe('danger');
    expect(barLevel(46, 50)).toBe('danger');
  });
});
