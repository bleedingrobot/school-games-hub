import { readFileSync } from 'node:fs';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FriendlyError } from '../data/profile';
import { DangerAction, SettingChips, SettingChoice, SettingDate, SettingNumber, SettingToggle } from './Settings';

const css = readFileSync(`${process.cwd()}/src/teacher/settings.css`, 'utf8');
const rule = (selector: string) =>
  css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.[\]()'=-]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

afterEach(() => {
  vi.useRealTimers();
});

const SKIPS = [
  { value: 'on', label: 'On', detail: 'Skip any question.' },
  { value: 'limited', label: '3 per game' },
  { value: 'off', label: 'Off', detail: 'Every question needs an answer.' },
] as const;

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
  });

  it('says Saved ✓ for 2 seconds, then goes quiet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SettingToggle label="Emoji reactions" value={true} save={vi.fn().mockResolvedValue(undefined)} />);
    await user.click(screen.getByRole('switch'));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved ✓');
    act(() => vi.advanceTimersByTime(1900));
    expect(screen.getByRole('status')).toHaveTextContent('Saved ✓');
    act(() => vi.advanceTimersByTime(200));
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

  it('gives a plain message for an unexpected failure', async () => {
    const user = userEvent.setup();
    render(<SettingToggle label="Training before games" value={true} save={vi.fn().mockRejectedValue(new Error('500'))} />);
    await user.click(screen.getByRole('switch'));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('waits while loading, and says when the setting could not be loaded', () => {
    const { rerender } = render(<SettingToggle label="Emoji reactions" value={null} save={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    rerender(<SettingToggle label="Emoji reactions" value={null} loadFailed save={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('We couldn’t load this setting.');
  });

  it('works from the keyboard with Space and Enter', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingToggle label="Games against friends" value={false} save={save} />);
    await user.tab();
    expect(screen.getByRole('switch')).toHaveFocus();
    await user.keyboard(' ');
    await waitFor(() => expect(save).toHaveBeenLastCalledWith(true));
    await screen.findByText('Saved ✓');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(save).toHaveBeenLastCalledWith(false));
  });

  it('keeps its "about" line behind a "?"', async () => {
    const user = userEvent.setup();
    render(<SettingToggle label="Games against friends" about="Bot games carry on." value={true} save={vi.fn()} />);
    const more = screen.getByRole('button', {
      name: 'About Games against friends',
    });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Bot games carry on.')).not.toBeVisible();
    await user.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Bot games carry on.')).toBeVisible();
    expect(screen.getByRole('switch')).toHaveAccessibleDescription('Bot games carry on.');
  });
});

describe('SettingChoice', () => {
  it('shows the picked choice and what it means, and saves a new one at once', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingChoice label="Skip button" options={SKIPS} value="on" save={save} />);
    expect(screen.getByRole('radiogroup', { name: 'Skip button' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'On' })).toBeChecked();
    expect(screen.getByText('Skip any question.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Off' }));
    expect(save).toHaveBeenCalledWith('off');
    expect(screen.getByRole('radio', { name: 'Off' })).toBeChecked();
    expect(screen.getByText('Every question needs an answer.')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Saved ✓');
  });

  it('does not save the choice that is already picked', async () => {
    const save = vi.fn();
    render(<SettingChoice label="Skip button" options={SKIPS} value="on" save={save} />);
    await userEvent.click(screen.getByRole('radio', { name: 'On' }));
    expect(save).not.toHaveBeenCalled();
  });

  it('goes back to the old choice and says why when the save fails', async () => {
    const user = userEvent.setup();
    render(<SettingChoice label="Skip button" options={SKIPS} value="limited" save={vi.fn().mockRejectedValue(new Error('no'))} />);
    await user.click(screen.getByRole('radio', { name: 'Off' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByRole('radio', { name: '3 per game' })).toBeChecked();
  });

  it('is one tab stop: arrows move along without saving, Space or Enter picks', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingChoice label="Skip button" options={SKIPS} value="limited" save={save} />);
    await user.tab();
    expect(screen.getByRole('radio', { name: '3 per game' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Off' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'On' })).toHaveFocus();
    expect(save).not.toHaveBeenCalled();
    await user.keyboard(' ');
    expect(save).toHaveBeenLastCalledWith('on');
    await screen.findByText('Saved ✓');
    await user.keyboard('{ArrowLeft}{Enter}');
    await waitFor(() => expect(save).toHaveBeenLastCalledWith('off'));
  });
});

describe('SettingChips', () => {
  const TOPICS = [
    { value: 'add', label: 'Adding' },
    { value: 'sub', label: 'Taking away' },
    { value: 'times', label: 'Times tables' },
  ];

  it('saves each tick at once, in the options’ order', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingChips label="Topics" options={TOPICS} value={['times']} save={save} />);
    expect(screen.getByRole('group', { name: 'Topics' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Adding' }));
    expect(save).toHaveBeenCalledWith(['add', 'times']);
    expect(screen.getByRole('checkbox', { name: 'Adding' })).toBeChecked();
    expect(await screen.findByRole('status')).toHaveTextContent('Saved ✓');
  });

  it('leaves at least one ticked', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingChips label="Topics" options={TOPICS} value={['sub']} save={save} />);
    await user.click(screen.getByRole('checkbox', { name: 'Taking away' }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Taking away' })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Leave at least one ticked.');
  });

  it('can ask for more than one', async () => {
    const user = userEvent.setup();
    render(<SettingChips label="Tables" options={TOPICS} min={2} value={['add', 'sub']} save={vi.fn()} />);
    await user.click(screen.getByRole('checkbox', { name: 'Adding' }));
    expect(screen.getByRole('status')).toHaveTextContent('Leave at least 2 ticked.');
  });

  it('unticks the chip again and says why when the save fails', async () => {
    const user = userEvent.setup();
    render(<SettingChips label="Topics" options={TOPICS} value={['add']} save={vi.fn().mockRejectedValue(new Error('no'))} />);
    await user.click(screen.getByRole('checkbox', { name: 'Times tables' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByRole('checkbox', { name: 'Times tables' })).not.toBeChecked();
  });
});

describe('SettingNumber and SettingDate', () => {
  it('save on Enter, with no Save button', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingNumber label="Fights a day" value={3} min={1} max={10} save={save} />);
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    const box = screen.getByRole('spinbutton', { name: 'Fights a day' });
    await user.clear(box);
    await user.type(box, '5{Enter}');
    expect(save).toHaveBeenCalledWith(5);
    expect(await screen.findByRole('status')).toHaveTextContent('Saved ✓');
  });

  it('save when the teacher moves away, once', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingNumber label="Fights a day" value={3} min={1} max={10} save={save} />);
    const box = screen.getByRole('spinbutton');
    await user.clear(box);
    await user.type(box, '7{Enter}');
    await screen.findByText('Saved ✓');
    await user.tab();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(7);
  });

  it('save nothing when the number is unchanged, and Escape puts the saved one back', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingNumber label="Fights a day" value={3} min={1} max={10} save={save} />);
    const box = screen.getByRole('spinbutton');
    await user.click(box);
    await user.tab();
    await user.clear(box);
    await user.type(box, '9{Escape}');
    expect(box).toHaveValue(3);
    await user.tab();
    expect(save).not.toHaveBeenCalled();
  });

  it('refuse a number out of range and put the old one back', async () => {
    const save = vi.fn();
    const user = userEvent.setup();
    render(<SettingNumber label="Fights a day" value={3} min={1} max={10} save={save} />);
    const box = screen.getByRole('spinbutton');
    await user.clear(box);
    await user.type(box, '40{Enter}');
    expect(save).not.toHaveBeenCalled();
    expect(box).toHaveValue(3);
    expect(screen.getByRole('status')).toHaveTextContent('Pick a whole number from 1 to 10.');
  });

  it('put the old value back and say why when the save fails', async () => {
    const user = userEvent.setup();
    render(<SettingNumber label="Fights a day" value={3} min={1} max={10} save={vi.fn().mockRejectedValue(new Error('no'))} />);
    const box = screen.getByRole('spinbutton');
    await user.clear(box);
    await user.type(box, '4');
    await user.tab();
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong. Please try again.');
    expect(box).toHaveValue(3);
  });

  it('save a date on blur', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SettingDate label="First day of the season" value="2026-11-02" save={save} />);
    const box = screen.getByLabelText('First day of the season');
    await user.clear(box);
    await user.type(box, '2027-02-01');
    await user.tab();
    expect(save).toHaveBeenCalledWith('2027-02-01');
    expect(await screen.findByRole('status')).toHaveTextContent('Saved ✓');
  });
});

describe('DangerAction', () => {
  it('stays asleep until the words are typed, then runs once and empties', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DangerAction label="Start a new season" words="NEW SEASON" onConfirm={onConfirm} />);
    const go = screen.getByRole('button', { name: 'Start a new season' });
    expect(go).toHaveClass('button--danger');
    expect(go).toBeDisabled();
    await user.type(screen.getByLabelText('Type NEW SEASON'), 'new season');
    expect(go).toBeDisabled();
    await user.clear(screen.getByLabelText('Type NEW SEASON'));
    await user.type(screen.getByLabelText('Type NEW SEASON'), 'NEW SEASON');
    await user.click(go);
    expect(onConfirm).toHaveBeenCalledWith('NEW SEASON');
    await waitFor(() => expect(screen.getByLabelText('Type NEW SEASON')).toHaveValue(''));
  });

  it('can ignore case, has a Cancel, and keeps the words if it fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('no'));
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <DangerAction
        label="Delete forever"
        words="Brave Kiwi 7"
        prompt="Type their player name to confirm"
        ignoreCase
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await user.type(screen.getByLabelText('Type their player name to confirm'), 'brave kiwi 7');
    await user.click(screen.getByRole('button', { name: 'Delete forever' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Type their player name to confirm')).toHaveValue('brave kiwi 7');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('red means "can’t undo"', () => {
  it('never makes a reversible control red', () => {
    const { container } = render(
      <>
        <SettingToggle label="A" about="a" value={true} save={vi.fn()} />
        <SettingChoice label="B" about="b" options={SKIPS} value="on" save={vi.fn()} />
        <SettingChips label="C" about="c" options={[{ value: 'x', label: 'X' }]} value={['x']} save={vi.fn()} />
        <SettingNumber label="D" value={1} min={1} max={2} save={vi.fn()} />
        <SettingDate label="E" value="2026-01-01" save={vi.fn()} />
      </>,
    );
    expect(container.querySelector('.button--danger')).toBeNull();
    expect(css).not.toMatch(/var\(--lost\)/);
  });
});

describe('the stylesheet', () => {
  it('makes every control at least 44 px', () => {
    for (const sel of ['.setting-switch', '.setting-choice__option', '.setting-field__input'])
      expect(rule(sel), sel).toMatch(/min-height: 44px/);
    expect(rule('.setting__about-button')).toMatch(/width: 44px;[\s\S]*height: 44px/);
  });

  it('keeps a visible focus ring inside the segmented control', () => {
    expect(rule('.setting-choice__option:focus-visible')).toMatch(/outline: 4px solid var\(--focus\)/);
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });

  it('stops the switch sliding when the device asks for less motion', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.setting-switch__track,\s*\.setting-switch__knob\s*\{\s*transition: none;/);
  });
});
