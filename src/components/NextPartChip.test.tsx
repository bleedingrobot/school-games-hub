import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { kiwisBeanstalk } from '../games/beanstalk';
import { GameCard } from './GameCard';
import { NextPartChip, nextPartWords } from './NextPartChip';

describe('the next-part chip', () => {
  it('says ready today, or come back tomorrow', () => {
    expect(nextPartWords('leaf', false)).toBe('Today’s leaf is ready');
    expect(nextPartWords('lily pad', true)).toBe('Next lily pad tomorrow');
  });

  it('reads itself aloud when tapped in a game', async () => {
    const hear = vi.fn();
    render(<NextPartChip noun="shell" done onHear={hear} />);
    await userEvent.click(screen.getByRole('button', { name: /Next shell tomorrow/ }));
    expect(hear).toHaveBeenCalledWith('Next shell tomorrow');
  });

  it('shows on a daily game’s home page card, and only once the day is known', () => {
    const card = (done?: boolean) => (
      <MemoryRouter>
        <GameCard game={kiwisBeanstalk} level="easy" onLevelChange={() => undefined} nextPartDone={done} />
      </MemoryRouter>
    );
    const { rerender } = render(card());
    expect(screen.queryByText(/leaf/)).toBeNull();
    rerender(card(false));
    expect(screen.getByText('Today’s leaf is ready')).toBeTruthy();
    rerender(card(true));
    expect(screen.getByText('Next leaf tomorrow')).toBeTruthy();
  });
});
