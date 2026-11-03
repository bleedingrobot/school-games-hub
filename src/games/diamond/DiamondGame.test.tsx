import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DiamondGame } from './DiamondGame';
import { trialBackend } from './trialBackend';

describe('Diamond Drop screens', () => {
  // jsdom has no canvas: the pictures just don't draw.
  beforeAll(() => void vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null));
  // The level's clock is held still (no animation frames), so the Drop always counts at tick 0: on a slow machine a
  // frame or two could run before the click and the claw would have swung on.
  beforeAll(() => void vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0));

  it('guides a new pupil’s first go, records a Drop, and reaches the level end screen with the server’s replay', async () => {
    localStorage.clear();
    const u = userEvent.setup();
    const trial = trialBackend({ now: () => Date.UTC(2026, 10, 2, 22), random: () => 0.25 });
    render(<DiamondGame backend={trial.backend} />);
    await u.click(await screen.findByRole('button', { name: 'Play level 1' }));
    // The play screen's heading has focus, and the first go's big quartz is straight below the claw.
    expect(await screen.findByRole('heading', { name: /Level 1/, level: 2 })).toHaveFocus();
    // Nugget's guided first go follows what the pupil does, so it moves on as soon as they Drop.
    expect(screen.getByText(/Press Drop when it points straight down/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Drop' }));
    expect(screen.queryByText(/Press Drop when it points straight down/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip the guide' })).toBeInTheDocument();
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
