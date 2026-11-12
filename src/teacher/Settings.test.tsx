import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUPILS_SEE_IT, SettingToggle } from './Settings';


afterEach(() => {
  vi.useRealTimers();
});


describe('SettingToggle', () => {
  it('is a real switch that shows its state and saves at once, and folds a long about behind More', async () => {
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

    const long = `Outlines in the sand where the hiding shells are. ${'It fades as each student shows they know it. '.repeat(4)}`;
    render(<SettingToggle label="Help" about={long} value={true} save={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'About Help' }));
    expect(screen.getByText(/Outlines in the sand/)).not.toHaveTextContent('It fades');
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText(/Outlines in the sand/)).toHaveTextContent('It fades as each student');
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();

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
});
