import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { SpaceSolo } from './SpaceSolo';

function renderGame() {
  const onLevelChange = vi.fn();
  render(
    <SoundProvider>
      <SpaceSolo player={{ name: 'Speedy Otter 27', avatar: {} }} level="easy" onLevelChange={onLevelChange} timeScale={0} />
    </SoundProvider>,
  );
  return { onLevelChange };
}

describe('Wormholes & Black Holes against bots', () => {
  it('shows the settings, remembers them, and passes on the bot level', async () => {
    const user = userEvent.setup();
    const { onLevelChange } = renderGame();
    expect(screen.getByRole('heading', { name: /Wormholes & Black Holes/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Nebula/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pilot' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /Asteroid Belt/ }));
    await user.click(screen.getByRole('radio', { name: 'Commander' }));
    expect(onLevelChange).toHaveBeenCalledWith('medium');
    expect(JSON.parse(localStorage.getItem('sgh-space-settings')!).board).toBe('asteroid-belt');
  });

  it('refuses a galaxy code that isn’t one', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('radio', { name: /Random Galaxy/ }));
    const code = screen.getByLabelText('Galaxy code');
    expect((code as HTMLInputElement).value).toMatch(/^\w+-\w+-\d\d$/); // galaxy of the day
    await user.clear(code);
    await user.type(code, 'not a code');
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/doesn’t look right/);
  });

  it('plays a whole game to the podium', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('radio', { name: /Asteroid Belt/ }));
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    expect(screen.getByRole('img', { name: /Asteroid Belt board, 50 squares/ })).toBeInTheDocument();

    let actions = 0;
    for (let guard = 0; guard < 400; guard++) {
      if (screen.queryByRole('dialog')) break;
      const roll = screen.queryByRole('button', { name: /^🎲 Roll/ });
      const choice = screen.queryByRole('group', { name: /gate|card|pockets|die|aim/i });
      if (choice) {
        await user.click(within(choice).getAllByRole('button')[0]);
        actions++;
      } else if (roll && !roll.hasAttribute('disabled')) {
        await user.click(roll);
        actions++;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    const podium = await waitFor(() => screen.getByRole('dialog'));
    expect(actions).toBeGreaterThan(3);
    expect(within(podium).getByRole('heading')).toHaveTextContent(/You (docked first|got the furthest|came 2nd)/);
    expect(screen.getByRole('log')).toHaveTextContent(/Speedy Otter 27 rolled/);
    await user.click(within(podium).getByRole('button', { name: 'Look at the board' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: /Launch/ })).toBeInTheDocument();
  }, 60_000);

  it('rolls with the space bar', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    const roll = screen.getByRole('button', { name: /^🎲 Roll/ });
    await waitFor(() => expect(roll).toBeEnabled());
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard(' ');
    await waitFor(() => expect(screen.getByRole('log')).toHaveTextContent(/Speedy Otter 27 rolled/));
  });
});
