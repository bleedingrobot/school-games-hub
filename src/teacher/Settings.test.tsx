import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FriendlyError } from '../data/profile';
import { PUPILS_SEE_IT, SettingToggle } from './Settings';


afterEach(() => {
  vi.useRealTimers();
});


describe('SettingToggle', () => {
  it('is a real switch that shows its state and saves at once', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingToggle label="Games against friends" value={false} save={save} />);
    const toggle = screen.getByRole('switch', {
      name: 'Games against friends',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('Off');
    await user.click(toggle);
    expect(save).toHaveBeenCalledWith(true);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveTextContent('On');
    expect(await screen.findByRole('status')).toHaveTextContent('Saved ✓');

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const timed = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    cleanup();
    render(<SettingToggle label="Non-maths games" value={false} savedText={PUPILS_SEE_IT} save={vi.fn().mockResolvedValue(undefined)} />);
    await timed.click(screen.getByRole('switch'));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved ✓ Pupils see it when their home page next opens.');
    await act(async () => void vi.advanceTimersByTime(2500));
    expect(screen.getByRole('status')).toHaveTextContent('Saved ✓ Pupils');
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('flips back and says why when the save fails', async () => {
    const save = vi.fn().mockRejectedValue(new FriendlyError('Only a teacher of this class can change that.'));
    const user = userEvent.setup();
    render(<SettingToggle label="Training before games" value={false} save={save} />);
    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    expect(await screen.findByRole('status')).toHaveTextContent('Only a teacher of this class can change that.');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

});






