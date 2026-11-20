import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyBadge, useGameKeys } from '.';

afterEach(cleanup);

function Screen({ onGo, onPick, pop }: { onGo: () => void; onPick: (n: number) => void; pop?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useGameKeys(root);
  return (
    <div ref={root}>
      <button type="button" data-key="1" disabled onClick={() => onPick(0)}>Locked</button>
      <button type="button" data-key="2" onClick={() => onPick(1)}><KeyBadge k="2" />Second</button>
      <button type="button" data-key="enter" onClick={onGo}>Next</button>
      {pop && <div aria-modal="true" />}
    </div>
  );
}

describe('kit keys', () => {
  it('a key presses its button, never a greyed-out one, not too fast, and not while a pop-up is open', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const onGo = vi.fn();
    const onPick = vi.fn();
    const { rerender } = render(<Screen onGo={onGo} onPick={onPick} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: '2' });
    expect(onPick).toHaveBeenCalledWith(1);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onGo).not.toHaveBeenCalled(); // too soon after the last key
    vi.spyOn(performance, 'now').mockReturnValue(2000);
    fireEvent.keyDown(window, { key: 'Enter', repeat: true });
    expect(onGo).not.toHaveBeenCalled(); // a held key
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onGo).toHaveBeenCalledTimes(1);
    rerender(<Screen onGo={onGo} onPick={onPick} pop />);
    vi.spyOn(performance, 'now').mockReturnValue(3000);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onGo).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
