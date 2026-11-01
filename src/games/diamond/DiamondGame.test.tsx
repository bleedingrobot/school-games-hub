import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DiamondGame } from './DiamondGame';
import { trialBackend } from './trialBackend';

describe('Diamond Drop screens', () => {
  // jsdom has no canvas: the pictures just don't draw.
  beforeAll(() => void vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null));

  it('starts level 1 from the map, records a Drop, and reaches the level end screen with the server’s replay', async () => {
    const u = userEvent.setup();
    const trial = trialBackend({ now: () => Date.UTC(2026, 10, 2, 22), seeds: () => 4242 });
    render(<DiamondGame backend={trial.backend} />);
    await u.click(await screen.findByRole('button', { name: 'Play level 1' }));
    // The play screen's heading has focus, and the first go's big quartz is straight below the claw.
    expect(await screen.findByRole('heading', { name: /Level 1/, level: 2 })).toHaveFocus();
    await u.click(screen.getByRole('button', { name: 'Drop' }));
    await u.click(screen.getByRole('button', { name: 'Pause' }));
    await u.click(screen.getByRole('button', { name: 'Leave this level' }));
    expect(await screen.findByRole('heading', { name: 'So close!', level: 2 })).toHaveFocus();
    const end = trial.log.find((r) => r.type === 'levelEnd')!.body as { drops: number[] };
    expect(end.drops).toEqual([0]);
    // The replay brought up the big quartz from that one Drop.
    expect(screen.getByText(/Quartz × 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'On to the shop' })).toBeInTheDocument();
  });
});
