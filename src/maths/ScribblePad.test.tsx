import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../../shared/maths/skillPack';
import { QuestionModal } from './QuestionModal';
import { ScribblePad } from './ScribblePad';

const question = (id = 1): Question => ({
  id,
  skill: 'times-tables',
  factKey: 'mul:7x8',
  kind: 'multiply',
  parts: ['7', '×', '8', '=', '?'],
  spoken: '7 times 8 equals what?',
  answer: 56,
  band: 'focus',
});

const modal = (id = 1, extra: Partial<React.ComponentProps<typeof QuestionModal>> = {}) => (
  <QuestionModal
    question={question(id)}
    title="Mana Well"
    onSubmit={() => ({ correct: true, fact: '', boxBefore: 0, boxAfter: 1 })}
    onDone={() => {}}
    {...extra}
  />
);

describe('the scribble pad beside the question', () => {
  it('starts hidden, opens from the Scribble button, and hides again', async () => {
    const user = userEvent.setup();
    render(modal());
    expect(screen.queryByRole('region', { name: 'Scribble pad' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /scribble/i }));
    expect(screen.getByRole('region', { name: 'Scribble pad' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('region', { name: 'Scribble pad' })).toBeNull();
  });

  it('remembers that it was left open', async () => {
    const user = userEvent.setup();
    const first = render(modal());
    await user.click(screen.getByRole('button', { name: /scribble/i }));
    first.unmount();
    render(modal());
    expect(screen.getByRole('region', { name: 'Scribble pad' })).toBeInTheDocument();
  });

  it('Escape in the pad hides the pad, not the question', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    localStorage.setItem('sgh-scribble-open', '1');
    render(modal(1, { onClose }));
    screen.getByRole('button', { name: 'Pen' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Scribble pad' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is not shown on an inline card, or when a game turns it off', () => {
    localStorage.setItem('sgh-scribble-open', '1');
    const a = render(modal(1, { inline: true }));
    expect(screen.queryByRole('region', { name: 'Scribble pad' })).toBeNull();
    a.unmount();
    render(modal(1, { scribble: false }));
    expect(screen.queryByRole('region', { name: 'Scribble pad' })).toBeNull();
    expect(screen.queryByRole('button', { name: /scribble/i })).toBeNull();
  });

  it('the number pad still types the answer while the pad is open', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sgh-scribble-open', '1');
    render(modal());
    await user.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('5');
  });
});

describe('the pad inside a game that listens for pointers', () => {
  it('keeps its pointers to itself, so the game cannot steal them mid-stroke', () => {
    const gameHears = vi.fn();
    render(
      <div onPointerDown={gameHears} onPointerMove={gameHears} onPointerUp={gameHears}>
        <ScribblePad onCollapse={() => {}} />
      </div>,
    );
    const canvas = screen.getByRole('img', { name: /drawing space/i });
    fireEvent.pointerDown(canvas, { pointerId: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(gameHears).not.toHaveBeenCalled();
  });
});

describe('the pad itself', () => {
  it('has a pen, rubber, clear and three colours, and marks the chosen tool', async () => {
    const user = userEvent.setup();
    render(<ScribblePad onCollapse={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Rubber' }));
    expect(screen.getByRole('button', { name: 'Rubber' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Blue' }));
    expect(screen.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['Black', 'Blue', 'Red', 'Clear']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });
});
