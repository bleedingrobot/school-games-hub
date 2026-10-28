import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullScreenButton } from './FullScreenButton';

function setEnabled(value: boolean | undefined) {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value });
}

afterEach(() => {
  setEnabled(undefined);
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
});

describe('FullScreenButton', () => {
  it('fills the screen with the whole page and can shrink back', async () => {
    setEnabled(true);
    const request = vi.fn(async () => {});
    document.documentElement.requestFullscreen = request;
    const exit = vi.fn(async () => {});
    document.exitFullscreen = exit;
    render(<FullScreenButton />);

    const button = screen.getByRole('button', { name: 'Full screen' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(request).toHaveBeenCalled();

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.documentElement });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const leave = screen.getByRole('button', { name: 'Exit full screen' });
    expect(leave).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(leave);
    expect(exit).toHaveBeenCalled();
  });

  it('explains Add to Home Screen where the browser cannot fill the screen', () => {
    setEnabled(false);
    render(<FullScreenButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(screen.getByRole('note')).toHaveTextContent('Add to Home Screen');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('hides when the hub was opened from a Home Screen icon', () => {
    setEnabled(true);
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    render(<FullScreenButton />);
    expect(screen.queryByRole('button')).toBeNull();
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: undefined });
  });
});
