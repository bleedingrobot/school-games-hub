import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { SpaceSolo } from './SpaceSolo';

describe('Wormholes & Black Holes against bots', () => {
  it('rolls with the space bar', async () => {
    const user = userEvent.setup();
    render(
      <SoundProvider>
        <SpaceSolo player={{ name: 'Speedy Otter 27', avatar: {} }} level="easy" onLevelChange={vi.fn()} timeScale={0} />
      </SoundProvider>,
    );
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    const roll = screen.getByRole('button', { name: /^🎲 Roll/ });
    await waitFor(() => expect(roll).toBeEnabled());
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard(' ');
    await waitFor(() => expect(screen.getByRole('log')).toHaveTextContent(/Speedy Otter 27 rolled/));
  });
});
