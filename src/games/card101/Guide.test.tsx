import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { scoreHand } from '../../../shared/card101/score';
import { SoundProvider } from '../../sound';
import { Card101Solo } from './Card101Solo';
import { Card101Guide, EXAMPLES } from './Guide';

describe('How to play 101', () => {
  it('the examples score what the rules say (docs/101-RULES.md)', () => {
    expect(EXAMPLES.map((hand) => scoreHand(hand).total)).toEqual([4, 0, 7, 0, 0, 12]);
    render(<Card101Guide onClose={() => {}} />);
    const items = screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('Scores '));
    expect(items.map((li) => li.textContent?.match(/Scores ([\d +=]+)$/)?.[1])).toEqual(['4 + 0 = 4', '0', '6 + 1 = 7', '0', '0', '10 + 2 = 12']);
  });

  it('opens from the settings and with ?, closes with Escape, and gives focus back', async () => {
    const user = userEvent.setup();
    render(
      <SoundProvider>
        <Card101Solo player={{ name: 'Speedy Otter 27', avatar: {} }} level="easy" onLevelChange={vi.fn()} timeScale={0} />
      </SoundProvider>,
    );
    const open = screen.getByRole('button', { name: /How to play/ });
    await user.click(open);
    const dialog = screen.getByRole('dialog', { name: /How to play 101/ });
    expect(within(dialog).getByRole('button', { name: 'Close help' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /How to play 101/ })).not.toBeInTheDocument();
    expect(open).toHaveFocus();
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    await user.keyboard('?');
    expect(screen.getByRole('dialog', { name: /How to play 101/ })).toHaveTextContent('Bots only see what you would see');
  });

  it('for classmates games it explains the clock', () => {
    render(<Card101Guide live onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('60 seconds for each turn');
  });
});
