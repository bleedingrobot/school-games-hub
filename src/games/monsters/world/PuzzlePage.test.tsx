import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WORLD_MAPS } from '../../../../shared/monsters/maps';
import { makeMonster } from '../../../../shared/monsters/rules';
import { newWorld } from '../../../../shared/monsters/world/world';
import { PuzzlePage } from './PuzzlePage';

const world = () => newWorld({ maps: WORLD_MAPS }, [makeMonster('digibud-1', 5)], 1);

describe('PuzzlePage (the painted puzzle stage)', () => {
  it('crosses the stepping stones and shows the prize card', () => {
    const apply = vi.fn();
    const onDone = vi.fn();
    render(<PuzzlePage world={world()} apply={apply} id="shell-stones" opts={{}} onDone={onDone} />);
    const stone = (n: string) => screen.getAllByRole('button', { name: n })[0];
    // A wrong number is a splash and counts a try.
    fireEvent.click(stone('13'));
    expect(screen.getByLabelText('Tries: 1')).toBeTruthy();
    for (const n of ['6', '9', '12', '15', '18', '21', '24', '27']) fireEvent.click(stone(n));
    expect(screen.getByText('6 → 9 → 12 → 15 → 18 → 21 → 24 → 27')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Far bank, row 4' }));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'You solved it!' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the map' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('keeps the lock buttons and shows Show me after three tries', () => {
    render(<PuzzlePage world={world()} apply={vi.fn()} id="cave-count" opts={{}} />);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Try the code' }));
    fireEvent.click(screen.getByRole('button', { name: '💡 Show me' }));
    expect(screen.getByText(/Count each group of glowworms/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Number 1 up' }));
    expect(screen.getByLabelText('Number 1').textContent).toContain('1');
  });

  it('slides on the ice with the arrow buttons', () => {
    render(<PuzzlePage world={world()} apply={vi.fn()} id="snow-slide" opts={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Down' }));
    expect(screen.getByRole('img', { name: /Ice\. You are in row 3, column 1\./ })).toBeTruthy();
  });
});
