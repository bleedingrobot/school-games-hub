import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORLD_MAPS } from '../../../shared/monsters/maps';
import { makeMonster } from '../../../shared/monsters/rules';
import { TYPE_LABEL, TYPES } from '../../../shared/monsters/types';
import { AREAS } from '../../../shared/monsters/world/areas';
import { REPEL_STEPS } from '../../../shared/monsters/world/rewards';
import { newWorld } from '../../../shared/monsters/world/world';
import { HowToPlayBody } from './HowToPlay';
import { DEFAULT_MONSTER_SETTINGS } from './settings';
import { StartScreen } from './StartScreen';
import { WorldGame } from './world/WorldGame';

describe('How to play', () => {
  it('has a heading for each part, so a screen reader can jump between them', () => {
    render(<HowToPlayBody />);
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Walking', 'Battles', 'Catching', 'Types and maths', 'Growing', 'Healing and the Bag', 'Towers and badges', 'Saving and points', 'Make it fit you']);
    // each section is named by its heading
    for (const h of screen.getAllByRole('heading', { level: 3 })) expect(screen.getByRole('region', { name: h.textContent! })).toBeInTheDocument();
  });

  it('says how to walk with the keyboard, by tapping, and with the on-screen arrows, and how to talk and open the menu', () => {
    render(<HowToPlayBody />);
    const walking = screen.getByRole('region', { name: 'Walking' });
    for (const text of [/arrow keys/i, /tap a spot/i, /on-screen arrows/i, /talks to/i, /Menu/]) expect(walking).toHaveTextContent(text);
    for (const key of ['W', 'A', 'S', 'D', 'Space', 'Enter', 'M', 'Esc']) expect(within(walking).getByText(key, { selector: 'kbd' })).toBeInTheDocument();
  });

  it('explains right, quick-right and wrong answers the way the game treats them', () => {
    render(<HowToPlayBody />);
    const battles = screen.getByRole('region', { name: 'Battles' });
    expect(battles).toHaveTextContent('Get it right and the attack hits');
    expect(battles).toHaveTextContent('quick right answer hits extra hard');
    expect(battles).toHaveTextContent('small hit');
    expect(screen.getByRole('region', { name: 'Catching' })).toHaveTextContent('right answer makes the catch much more likely');
    expect(screen.getByRole('region', { name: 'Make it fit you' })).toHaveTextContent(/Calm.*Choose answers.*On-screen arrows/s);
  });

  it('lists every type with its maths and every place, from the game’s own data', () => {
    render(<HowToPlayBody />);
    const types = screen.getByRole('region', { name: 'Types and maths' });
    expect(within(types).getAllByRole('listitem')).toHaveLength(TYPES.length);
    for (const t of TYPES) expect(types).toHaveTextContent(TYPE_LABEL[t]);
    expect(types).toHaveTextContent('Leaf: Place value and rounding. Strong against Water.');
    const towers = screen.getByRole('region', { name: 'Towers and badges' });
    for (const a of AREAS) expect(towers).toHaveTextContent(a.name);
    expect(screen.getByRole('region', { name: 'Healing and the Bag' })).toHaveTextContent(`${REPEL_STEPS} steps`);
  });

  it('is on the new-game screen and in the map Menu', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<StartScreen onStart={() => {}} />);
    const summary = screen.getByText('How to play');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    await user.click(summary);
    expect(screen.getByRole('region', { name: 'Walking' })).toBeVisible();
    unmount();

    const world = newWorld({ maps: WORLD_MAPS }, [makeMonster('plusplash-1', 8)], 3);
    render(<WorldGame initial={world} settings={{ ...DEFAULT_MONSTER_SETTINGS, dpad: false }} onSettingsChange={() => {}} timeScale={0} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: 'How to play' }));
    const page = screen.getByRole('dialog', { name: 'How to play' });
    expect(within(page).getByRole('region', { name: 'Battles' })).toBeInTheDocument();
    await user.click(within(page).getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/** Every CSS animation of the game has a "less motion" answer: it is switched off, or replaced by a fade. */
describe('reduced motion', () => {
  const files = ['src/games/monsters/monsters.css', 'src/games/monsters/world/world.css', 'src/games/monsters/art/monster-art.css'];
  const css = files.map((f) => readFileSync(resolve(process.cwd(), f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
  const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{/g)].map((m) => {
    let depth = 1;
    let i = m.index! + m[0].length;
    const from = i;
    while (depth && i < css.length) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0, i++;
    return css.slice(from, i);
  }).join('\n');
  const outside = css.replace(reduced, '');
  const used = [...new Set([...outside.matchAll(/animation:\s*([a-z][\w-]*)/g)].map((m) => m[1]))].filter((n) => n !== 'none');

  it('finds the animations (so this test cannot pass by finding nothing)', () => {
    expect(used.length).toBeGreaterThan(10);
    expect(reduced.length).toBeGreaterThan(200);
  });

  it.each(used)('%s is covered by a reduced-motion rule', (name) => {
    // the rule that uses it names a class; that class (or its svg / children) must be switched off in the reduced block
    const rules = [...outside.matchAll(new RegExp(`([^{}]+)\\{[^{}]*animation:\\s*${name}\\b`, 'g'))].map((m) => m[1].trim());
    expect(rules.length).toBeGreaterThan(0);
    for (const selector of rules.flatMap((r) => r.split(','))) {
      const base = selector.trim().split(/[ >:]/).filter(Boolean).at(-1)!.replace(/^\./, '').replace(/\[.*$/, '');
      const cls = base.split('.').filter(Boolean).at(-1) ?? base;
      const covered = reduced.includes(cls) || reduced.includes(`${cls.replace(/-.*/, '')}-`) || /\.fx \*/.test(reduced) && /^fx/.test(cls);
      expect(covered, `${selector.trim()} (${name})`).toBe(true);
    }
  });
});

describe('doors fade only when motion is wanted', () => {
  it('has no white fade-in after a door for someone who asked for less motion', () => {
    const asked: string[] = [];
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => (asked.push(q), { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    try {
      const world = newWorld({ maps: WORLD_MAPS }, [makeMonster('plusplash-1', 8)], 3);
      const door = WORLD_MAPS['harbour-town'].warps[0];
      render(<WorldGame initial={{ ...world, x: door.x, y: door.y + 1, facing: 'up' }} settings={{ ...DEFAULT_MONSTER_SETTINGS, dpad: false }} onSettingsChange={() => {}} timeScale={0} />);
      act(() => { fireEvent.keyDown(window, { key: 'ArrowUp' }); fireEvent.keyUp(window, { key: 'ArrowUp' }); });
      expect(asked).toContain('(prefers-reduced-motion: reduce)');
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('keyboard and screen reader', () => {
  const opened = async (user: ReturnType<typeof userEvent.setup>) => {
    const world = newWorld({ maps: WORLD_MAPS }, [makeMonster('plusplash-1', 8), makeMonster('digibud-1', 8)], 3);
    render(<WorldGame initial={world} settings={{ ...DEFAULT_MONSTER_SETTINGS, dpad: false }} onSettingsChange={() => {}} timeScale={0} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
  };

  it('the map takes the keyboard when the game opens', () => {
    const world = newWorld({ maps: WORLD_MAPS }, [makeMonster('plusplash-1', 8)], 3);
    render(<WorldGame initial={world} settings={{ ...DEFAULT_MONSTER_SETTINGS, dpad: false }} onSettingsChange={() => {}} timeScale={0} />);
    expect(screen.getByTestId('mw-stage')).toHaveFocus();
  });

  it('Tab stays inside the open Menu, in both directions (it is a dialog covering the map)', async () => {
    const user = userEvent.setup();
    await opened(user);
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    const buttons = within(menu).getAllByRole('button');
    expect(menu).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < buttons.length * 2 + 1; i++) {
      await user.tab();
      expect(menu).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < buttons.length * 2 + 1; i++) {
      await user.tab({ shift: true });
      expect(menu).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('pages that are only words can be focused, so the arrow keys and Page Down scroll them', async () => {
    const user = userEvent.setup();
    await opened(user);
    await user.click(screen.getByRole('button', { name: 'How to play' }));
    const reading = screen.getByRole('region', { name: /^How to play, use the arrow keys/ });
    await user.tab();
    expect(reading).toHaveFocus();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: /^Badges/ }));
    expect(screen.getByRole('region', { name: /^Badges, use the arrow keys/ })).toHaveAttribute('tabindex', '0');
    // pages with buttons do not get an extra stop
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: /^Settings/ }));
    expect(document.querySelector('.mb-sheet__body')).not.toHaveAttribute('tabindex');
  });

  it('every control on the map has a name a screen reader can say', () => {
    const world = newWorld({ maps: WORLD_MAPS }, [makeMonster('plusplash-1', 8)], 3);
    render(<WorldGame initial={world} settings={{ ...DEFAULT_MONSTER_SETTINGS, dpad: true }} onSettingsChange={() => {}} timeScale={0} />);
    for (const name of ['Walk up', 'Walk down', 'Walk left', 'Walk right', 'Talk', 'Menu']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Walk with the arrow keys or W A S D, or tap a spot\. Press Space to talk\./ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your team' })).toBeInTheDocument();
  });
});
