import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../../shared/clans/rewards';
import { Celebration } from './Achievements';
import { ClanQuest } from './ClanQuest';

const SEED = 12345;
const css = readFileSync(`${process.cwd()}/src/games/clans/clans.css`, 'utf8');

/** WCAG relative luminance and contrast ratio. */
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (name: string) => css.match(new RegExp(`--cq-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];

describe('colour contrast on the dark look', () => {
  const backgrounds = { page: colour('bg'), panel: colour('panel'), hover: '#1a1a40', selected: '#1d1d40', log: '#05050c' };
  it('gives text at least 4.5 to 1 on every background it sits on', () => {
    for (const text of ['ink', 'soft', 'yellow', 'cyan', 'green', 'red', 'mag']) {
      for (const [where, bg] of Object.entries(backgrounds)) expect(contrast(colour(text), bg), `${text} on ${where}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('gives borders of buttons and boxes at least 3 to 1 (so inputs can be seen)', () => {
    for (const bg of [backgrounds.page, backgrounds.panel, backgrounds.selected]) expect(contrast(colour('line'), bg)).toBeGreaterThanOrEqual(3);
  });
  it('gives the white numbers on the bars at least 4.5 to 1', () => {
    const hp = css.match(/\.cq-bar--hp \.cq-bar__fill \{ background: (#[0-9a-f]{6})/i)![1];
    const sp = css.match(/\.cq-bar--sp \.cq-bar__fill \{ background: (#[0-9a-f]{6})/i)![1];
    expect(contrast('#ffffff', hp)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', sp)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('movement and touch', () => {
  it('stops every animation and transition when the pupil prefers less movement', () => {
    const lines = css.split('\n');
    for (const [i, line] of lines.entries()) {
      if (/\b(animation|transition)\s*:/.test(line) && !/animation:\s*none|transition:\s*none/.test(line)) {
        const before = lines.slice(0, i + 1).join('\n');
        const inNoPreference = before.lastIndexOf('prefers-reduced-motion: no-preference') > before.lastIndexOf('\n}\n');
        const stopped = /prefers-reduced-motion: reduce\)[^\n]*(transition|animation): none/.test(css);
        expect(inNoPreference || stopped, line.trim()).toBe(true);
      }
    }
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^\n]*\.cq-bar__fill \{ transition: none; \}/);
  });
  it('never sets a button, link, field or summary smaller than 44px high', () => {
    for (const m of css.matchAll(/([^{}]+)\{[^}]*?min-height:\s*(\d+)px/g)) {
      const selector = m[1].trim();
      if (/(btn|link|input|select|summary|key|close|pick|shelf__item|choice)/.test(selector) && !/checkbox|numpad\[data-decimal\]/.test(selector)) {
        expect(Number(m[2]), selector).toBeGreaterThanOrEqual(44);
      }
    }
    expect(css).toMatch(/\.cq \.numpad__key \{ min-height: 44px;/);
  });
});

describe('keyboard and screen readers', () => {
  it('moves focus to the new screen\'s heading whenever a screen changes', async () => {
    const u = userEvent.setup();
    render(<ClanQuest seed={SEED} />);
    await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
    for (const [open, heading] of [['The Market', 'The Market'], ['The Church', 'The Church'], ['Scoreboard', 'Scoreboard'], ['How to play', 'How to play'], ['Go to the Mines', 'The Mines']]) {
      await u.click(screen.getByRole('button', { name: open }));
      expect(screen.getByRole('heading', { name: heading, level: 2 }), open).toHaveFocus();
      await u.click(screen.getAllByRole('button', { name: /^Back/ })[0]);
      expect(screen.getByRole('heading', { name: 'Clan Quest', level: 1 })).toBeInTheDocument();
    }
  });

  it('plays from the clan page into a fight using only the keyboard, and names every part of the fight', async () => {
    const u = userEvent.setup();
    render(<ClanQuest seed={SEED} />);
    await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
    screen.getByRole('button', { name: 'Go to the Mines' }).focus();
    await u.keyboard('{Enter}');
    await u.tab({ shift: false });
    // Tab until "Into the Mines!" has focus, then press Enter.
    for (let i = 0; i < 30 && document.activeElement !== screen.getByRole('button', { name: 'Into the Mines!' }); i++) await u.tab();
    expect(screen.getByRole('button', { name: 'Into the Mines!' })).toHaveFocus();
    await u.keyboard('{Enter}');
    expect(screen.getByRole('group', { name: 'Battle Cry question' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Enemies' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your clan' })).toBeInTheDocument();
    const log = screen.getByRole('list', { name: 'Fight log' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    await u.click(screen.getByRole('button', { name: 'No thanks' }));
    await u.keyboard('{Enter}'); // "Carry on" has focus
    const orders = await screen.findByRole('group', { name: /^Orders for / });
    expect(orders).toHaveFocus();
    await u.keyboard('a'); // attack with the first member
    expect(screen.getAllByRole('group', { name: /^Orders for / }).length).toBe(1);
    // Every bar says what it is in words, never by colour alone.
    for (const bar of screen.getAllByRole('img', { name: /^HP \d+ of \d+$/ })) expect(bar).toBeInTheDocument();
  });

  it('shows the achievement celebration as a polite status message that never steals focus, with a normal button to close it', async () => {
    const u = userEvent.setup();
    let closed = false;
    render(<><button type="button">Before</button><Celebration fresh={[ACHIEVEMENTS[0]]} onClose={() => { closed = true; }} /></>);
    screen.getByRole('button', { name: 'Before' }).focus();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(ACHIEVEMENTS[0].name);
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    await u.tab();
    await u.keyboard('{Enter}');
    expect(closed).toBe(true);
  });
});
