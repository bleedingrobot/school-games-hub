import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Copied from Mine Runner's: it reads the stylesheet and checks contrast, target sizes and movement.
const css = readFileSync(`${process.cwd()}/src/games/archery/archery.css`, 'utf8');
const screen = readFileSync(`${process.cwd()}/src/games/archery/FightScreen.tsx`, 'utf8');

/** WCAG relative luminance and contrast ratio. */
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (name: string) => css.match(new RegExp(`--ar-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.[\]()'=]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const colourIn = (selector: string, prop = 'background') => rule(selector).match(new RegExp(`(?:^|;|\\s)${prop}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];

describe('colour contrast on the fight screen', () => {
  it('gives the white, pale and gold words at least 4.5 to 1 on the HUD panels', () => {
    const panel = token('panel');
    for (const name of ['ink', 'soft', 'gold']) expect(contrast(token(name), panel), name).toBeGreaterThanOrEqual(4.5);
  });
  it('gives the turn pill, the Arrows/Score/Best boxes their own readable colours', () => {
    expect(contrast(colourIn('.ar-turn', 'color')!, colourIn('.ar-turn')!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colourIn('.ar-turn[data-bot]', 'color')!, colourIn('.ar-turn[data-bot]')!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colourIn('.ar-stat', 'color')!, colourIn('.ar-stat')!)).toBeGreaterThanOrEqual(4.5);
  });
  it('gives the health bars at least 3 to 1 against their track, so a low bar can be seen', () => {
    const track = token('track');
    expect(contrast(colourIn('.ar-bar__fill')!, track)).toBeGreaterThanOrEqual(3);
    expect(contrast(colourIn('.ar-bar__fill[data-low]')!, track)).toBeGreaterThanOrEqual(3);
  });
});

describe('movement', () => {
  it('only animates or fades inside "no preference", and the Less motion setting turns even that off', () => {
    let inNoPreference = false;
    let depth = 0;
    let animated = 0;
    for (const line of css.split('\n')) {
      if (/@media \(prefers-reduced-motion: no-preference\)/.test(line)) {
        inNoPreference = true;
        depth = 0;
      }
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      if (inNoPreference && depth <= 0) inNoPreference = false;
      if (/\b(animation|transition)\s*:/.test(line) && !/:\s*none/.test(line)) {
        animated++;
        expect(inNoPreference, line.trim()).toBe(true);
      }
    }
    expect(animated).toBeGreaterThan(0);
    expect(css).toMatch(/\.ar-fight\[data-less-motion\][^{]*\{[^}]*animation: none; transition: none;/);
    // The canvas is told too, and follows the device's setting unless the pupil chose.
    expect(screen).toMatch(/lessMotion/);
  });
});

describe('touch and keyboard', () => {
  it('never sets a button, switch or slider smaller than 44px', () => {
    for (const w of ['.ar-btn', '.ar-check', '.ar-range']) {
      const m = css.match(new RegExp(`${w.replace('.', '\\.')}\\s*\\{[^}]*min-height:\\s*(\\d+)px`));
      expect(m, w).not.toBeNull();
      expect(Number(m![1]), w).toBeGreaterThanOrEqual(44);
    }
    expect(rule('.ar-btn')).toMatch(/min-width: 44px/);
  });
  it('uses the hub\'s shared buttons for every button on the screen', () => {
    for (const m of screen.matchAll(/<button[^>]*className="([^"]+)"/g)) expect(m[1], m[0]).toMatch(/^button button--(play|light) ar-btn/);
  });
  it('does not remove the site\'s keyboard focus outline', () => {
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });
  it('never styles a bare element or a shared class', () => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of noComments.matchAll(/^([^@{}\s][^{}]*)\{/gm)) {
      for (const sel of m[1].split(',').map((s) => s.trim())) {
        if (/^(from|to)$/.test(sel) || /^\d+%$/.test(sel)) continue;
        expect(sel, 'every selector must start with .ar-').toMatch(/^\.ar-/);
      }
    }
  });
  it('keeps the page from scrolling under the fight, and lets touch aiming have the drag', () => {
    expect(rule('.ar-fight')).toMatch(/position: fixed; inset: 0/);
    expect(rule('.ar-stage')).toMatch(/touch-action: none/);
  });
  it('moves focus to each new screen\'s heading', () => {
    for (const id of ['ar-fight-title', 'ar-round-title', 'ar-end-title', 'ar-settings-title', 'ar-problem-title']) {
      expect(screen).toMatch(new RegExp(`id="${id}" ref=\\{(heading|dialogHeading)\\} tabIndex=\\{-1\\}`));
    }
  });
});

describe('no aiming help (James, 21 Oct 2026)', () => {
  it('never hands the picture anything to draw an aiming line, path or landing guess with', () => {
    // The screen only ever tells the picture an angle and how far the string is pulled.
    expect(screen).not.toMatch(/aimLine|aimGuide|predict|ghost|trajectory|preview(Path|Shot)/i);
    expect(screen).not.toMatch(/flyArrow/);
  });
});

describe('the screens around the fights (Stage 5)', () => {
  const files = ['ArcheryGame', 'HomeScreen', 'FightSetup', 'SpeedRound', 'ArmoryScreen', 'HowToPlay', 'CoinCount'].map((f) => [f, readFileSync(`${process.cwd()}/src/games/archery/${f}.tsx`, 'utf8')] as const);

  it('uses the hub\'s shared buttons for every button', () => {
    for (const [name, text] of files) {
      for (const m of text.matchAll(/<button[^>]*className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) expect(m[1] ?? m[2], `${name}: ${m[0]}`).toMatch(/^button button--(play|light) ar-btn/);
    }
  });

  it('moves focus to each screen\'s heading', () => {
    for (const [name, text] of files) {
      if (name === 'CoinCount' || name === 'ArcheryGame') continue;
      expect(text, name).toMatch(/<h2 id="ar-[a-z-]+-title" ref=\{heading\} tabIndex=\{-1\}/);
    }
  });

  it('gives white words at least 4.5 to 1 on every chunky home button, and the paper words on paper', () => {
    for (const m of css.matchAll(/\.ar-shell \.ar-chunky(--[a-z]+)? \{[^}]*background: (#[0-9a-f]{6})/g)) expect(contrast('#ffffff', m[2]), `.ar-chunky${m[1] ?? ''}`).toBeGreaterThanOrEqual(4.5);
    const paper = css.match(/--ar-paper: (#[0-9a-f]{6})/)![1];
    for (const ink of ['--ar-paper-ink', '--ar-paper-soft']) expect(contrast(css.match(new RegExp(`${ink}: (#[0-9a-f]{6})`))![1], paper), ink).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', colourIn(".ar-pips li[data-state='now']")!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colourIn('.ar-pips li', 'color')!, colourIn('.ar-pips li')!)).toBeGreaterThanOrEqual(4.5);
  });
});
