import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PuzzlePage } from './PuzzlePage';
import type { WorldState } from '../../../../shared/monsters/world/types';
import type { QuestOptions } from '../../../../shared/monsters/world/questWorld';

describe('the stepping stones screen', () => {
  it('crosses Shell Beach counting in 3s, and says why a stone that is too far does nothing', async () => {
    const user = userEvent.setup();
    render(<PuzzlePage world={{} as WorldState} apply={() => {}} id="shell-stones" opts={{} as QuestOptions} />);
    const stone = (n: number) => screen.getByRole('button', { name: String(n) });
    await user.click(stone(9));
    expect(screen.getByRole('status')).toHaveTextContent('left side');
    await user.click(stone(6));
    await user.click(stone(15));
    expect(screen.getByRole('status')).toHaveTextContent('Too far');
    for (const n of [9, 12, 15, 18, 21, 24, 27]) {
      await user.click(stone(n));
      expect(stone(n)).toHaveAttribute('aria-pressed', 'true');
    }
    await user.click(screen.getByRole('button', { name: 'Far bank, row 4' }));
    expect(screen.getByRole('status')).toHaveTextContent('You solved it!');
  });
});
