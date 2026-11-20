import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { buttonFor, useIslesKeys } from './keys';

function Board({ onNext, onBuild, onSpot }: { onNext: () => void; onBuild: () => void; onSpot: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useIslesKeys(root, true);
  return (
    <div ref={root}>
      <h3 tabIndex={-1}>Build</h3>
      <button type="button" data-pip="upgrade" disabled>Upgrade</button>
      <button type="button" data-pip="spot-1" onClick={onSpot}>Spot 2</button>
      <button type="button" data-key="b esc" onClick={onBuild}>Back to the island</button>
      <button type="button" data-pip="next" onClick={onNext}>Done building</button>
      <input aria-label="answer" />
    </div>
  );
}

describe('Sky Isles keys', () => {
  it('Enter, B and a number press the matching button', () => {
    const onNext = vi.fn(), onBuild = vi.fn(), onSpot = vi.fn();
    render(<Board onNext={onNext} onBuild={onBuild} onSpot={onSpot} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: '2' });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onBuild).toHaveBeenCalledTimes(2);
    expect(onSpot).toHaveBeenCalledTimes(1);
  });

  it('skips greyed-out buttons, typing, held keys and keys with Ctrl', () => {
    const onNext = vi.fn();
    const { getByLabelText, container } = render(<Board onNext={onNext} onBuild={vi.fn()} onSpot={vi.fn()} />);
    expect(buttonFor(container, 'u')).toBeNull();
    fireEvent.keyDown(getByLabelText('answer'), { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Enter', repeat: true });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(onNext).not.toHaveBeenCalled();
  });
});
