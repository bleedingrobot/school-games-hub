/**
 * Sky Isles for Year 4 to 6 (test 7 of the game's 8, docs/ISLES-PLAN.md section 9, copied from Clan Quest's): text
 * colours at least 4.5 to 1, buttons at least 44 px high, every movement stopped when the pupil asks for less motion,
 * and focus moved to each new screen's heading, so a pupil on a keyboard or a screen reader always knows where they are.
 */
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IslesPlay } from './IslesPlay';
import { createTrialBackend } from './trialBackend';

const css = readFileSync(`${process.cwd()}/src/games/isles/isles.css`, 'utf8');
const hub = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8');

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const own = (name: string) => css.match(new RegExp(`--si-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const token = (name: string) => hub.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];

describe('colour contrast', () => {
  it('gives text at least 4.5 to 1 on whatever it sits on', () => {
    const pairs: [string, string, string][] = [
      ['headings on the sky', own('title'), own('sky')],
      ['headings low on the sky', own('title'), own('sky-2')],
      ['words on panels', token('ink'), token('surface')],
      ['softer words on panels', token('ink-soft'), token('surface')],
      ['warnings on panels', token('lost'), token('surface')],
      ['the fair wind on panels', token('won'), token('surface')],
      ['words on the gold badges', token('ink'), own('gold')],
    ];
    for (const [where, text, bg] of pairs) expect(contrast(text, bg), where).toBeGreaterThanOrEqual(4.5);
  });
});

describe('movement and touch', () => {
  it('stops every animation and transition when the pupil prefers less movement', () => {
    const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const m of css.matchAll(/([^{}]+)\{[^}]*\b(animation|transition):(?!\s*none)/g)) {
      const selector = m[1].trim().split(',')[0].trim();
      if (selector.startsWith('@')) continue;
      expect(reduce.includes(selector.split(/[ :]/)[0]), selector).toBe(true);
    }
  });

  it('never sets a button or control smaller than 44px', () => {
    // Badges and drawn shapes inside a button aren't targets themselves.
    for (const m of css.matchAll(/([^{}]+)\{[^}]*?min-(?:height|width):\s*(\d+)px/g)) {
      if (/__(count|drawn)|si-isle__keeper|si-boat/.test(m[1])) continue;
      expect(Number(m[2]), m[1].trim()).toBeGreaterThanOrEqual(44);
    }
    for (const control of ['.si-spot {', '.si-tax__option {', '.si-more__spot {', '.si-drift {', '.si-slider input {']) {
      expect(css.slice(css.indexOf(control)).split('}')[0], control).toMatch(/min-height: 44px/);
    }
  });
});

describe('keyboard and screen readers', () => {
  it('moves focus to the new screen\'s heading whenever a screen changes, and plays a turn by keyboard', async () => {
    const u = userEvent.setup();
    const backend = createTrialBackend('a11y', { save: false, random: () => 0.42 });
    render(<IslesPlay backend={backend} />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Choose your Sky Keeper' })).toHaveFocus());
    await u.click(screen.getByRole('radio', { name: 'Sky Keeper 4' }));
    await u.click(screen.getByRole('button', { name: 'This is my keeper' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My island', level: 2 })).toHaveFocus());
    for (const [open, heading] of [['Upgrades', 'Upgrades'], ['How to play', 'How to play']]) {
      await u.click(screen.getByRole('button', { name: open }));
      expect(screen.getByRole('heading', { name: heading, level: 2 }), open).toHaveFocus();
      await u.click(screen.getByRole('button', { name: 'Back' }));
      expect(screen.getByRole('heading', { name: 'My island', level: 2 })).toHaveFocus();
    }
    // A turn, by keyboard: the same 11 steps, each with its heading focused and "Step n of 11" at the top. Every
    // spot has a name, a step that can't happen says why and has a working Next, and End turn brings the island back
    // with one turn fewer.
    expect(screen.getByRole('button', { name: 'Spot 6: Empty spot' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Play a turn' }).focus();
    await u.keyboard('{Enter}');
    const at = (n: number, heading: string | RegExp) => {
      expect(screen.getByRole('img', { name: new RegExp(`^Step ${n} of 11`) })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: heading, level: 3 })).toHaveFocus();
    };
    const press = async (name: string | RegExp) => {
      screen.getByRole('button', { name }).focus();
      await u.keyboard('{Enter}');
    };
    at(1, 'Island report');
    await press('Start my turn');
    await u.click(await screen.findByRole('button', { name: 'Skip' }));
    await waitFor(() => at(3, 'Collect and feed'));
    await press('Next');
    // Step 4 can't happen yet (land costs 85 coins a spot): greyed, with the numbers, then Next.
    at(4, 'Land');
    expect(screen.getByRole('button', { name: 'Anchor it' })).toBeDisabled();
    expect(screen.getByText(/^Needs 510 coins\. You have \d+\.$/)).toBeInTheDocument();
    // Back takes the pupil to the step before; spots can only be tapped on the Build step.
    await press('Back');
    at(3, 'Collect and feed');
    await press('Next');
    at(4, 'Land');
    expect(screen.queryByRole('button', { name: 'Spot 6: Empty spot' })).not.toBeInTheDocument();
    await press('Next');
    at(5, 'Build');
    await press('Spot 6: Empty spot');
    at(5, 'Spot 6: Empty spot');
    await press(/^Farm: 25 coins/);
    at(5, 'Build another?');
    await press('No, thanks');
    at(6, 'Tax');
    expect(screen.getByRole('radio', { name: /^Fair/ })).toHaveAttribute('aria-checked', 'true');
    await press('Next');
    at(7, 'Workshops');
    expect(screen.getByText(/You have no Workshop yet/)).toBeInTheDocument();
    await press('Next');
    at(8, 'Festival');
    await press('Not this turn');
    at(9, 'Big projects');
    await press('Next');
    at(10, 'Market');
    expect(screen.getByRole('button', { name: 'Market' })).toBeDisabled();
    await press('Next');
    at(11, 'Check and end');
    expect(screen.getByText('Build a Farm on spot 6')).toBeInTheDocument();
    await press('End turn');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My island', level: 2 })).toHaveFocus());
    expect(screen.getByRole('img', { name: '5 turns left today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spot 6: Farm, level 1' })).toBeInTheDocument();
  });
});
