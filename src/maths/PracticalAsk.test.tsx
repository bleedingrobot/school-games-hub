import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildQuestion } from '../../shared/maths/practical';
import { PracticalAsk } from './PracticalAsk';

describe('PracticalAsk', () => {
  it('types a negative answer with the minus key and the keyboard', async () => {
    const q = buildQuestion('negative', [3, -8]);
    expect(q.answer).toBeLessThan(0);
    const onSubmit = vi.fn();
    render(<PracticalAsk question={q} title="Battle Cry!" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Minus' }));
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(onSubmit).toHaveBeenCalledWith(-5);
    onSubmit.mockClear();
    await userEvent.keyboard('{Backspace}{Backspace}-7{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(-7);
  });

  it('has no minus key for questions that cannot be negative', () => {
    render(<PracticalAsk question={buildQuestion('percent-of', [10, 80])} title="t" onSubmit={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Minus' })).not.toBeInTheDocument();
  });

  it('lets you tap the better buy', async () => {
    const q = buildQuestion('better-buy', [500, 7, 750, 6], { labels: ['Axe', 'Sword'] });
    const onSubmit = vi.fn();
    render(<PracticalAsk question={q} title="t" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: q.choices![0].label }));
    expect(onSubmit).toHaveBeenCalledWith(q.choices![0].value);
  });
});
