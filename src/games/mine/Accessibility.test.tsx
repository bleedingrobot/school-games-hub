import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${process.cwd()}/src/games/mine/mine.css`, 'utf8');

/** WCAG relative luminance and contrast ratio. */
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (name: string) => css.match(new RegExp(`--mn-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const colourIn = (selector: string, prop = 'background') => rule(selector).match(new RegExp(`${prop}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];

describe('colour contrast on the dark game screen', () => {
  it('gives the white and pale text at least 4.5 to 1 on the HUD panel', () => {
    const panel = token('panel');
    expect(contrast(token('ink'), panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('soft'), panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#fecaca', panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#fde047', panel)).toBeGreaterThanOrEqual(4.5);
  });
  it('gives the bars at least 3 to 1 against their track, so a low bar can be seen', () => {
    const track = colourIn('.mn-bar__track')!;
    for (const name of ['shield', 'energy', 'reactor', 'danger']) expect(contrast(token(name), track), name).toBeGreaterThanOrEqual(3);
    expect(contrast(token('line'), '#05070d')).toBeGreaterThanOrEqual(3);
  });
  it('gives white words on the coloured chips and buttons at least 4.5 to 1', () => {
    for (const [selector, prop] of [['.mn-escape', 'background'], ['.mn-escape[data-urgent]', 'background'], ['.mn-touchbtn--use', 'background']] as const) {
      const bg = colourIn(selector, prop);
      expect(bg, selector).toBeDefined();
      expect(contrast('#ffffff', bg!), selector).toBeGreaterThanOrEqual(4.5);
    }
    // The fire and missile buttons are drawn over the picture, so their colours must hold up even over bright rock.
    for (const solid of ['#b91c1c', '#b45309']) expect(contrast('#ffffff', solid), solid).toBeGreaterThanOrEqual(4.5);
  });
  it('gives the map words at least 4.5 to 1 on the map’s dark background', () => {
    for (const hex of ['#e2e8f0', '#fdba74', '#94a3b8']) expect(contrast(hex, '#0b1220'), hex).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#cbd5e1', '#0b1220')).toBeGreaterThanOrEqual(3);
  });
  it('keeps the warning note readable', () => {
    expect(contrast('#78350f', '#fef3c7')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('movement', () => {
  it('only animates or fades inside "no preference", and the Less motion setting turns even that off', () => {
    const lines = css.split('\n');
    let inNoPreference = false;
    let depth = 0;
    let animated = 0;
    for (const line of lines) {
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
    expect(css).toMatch(/\.mn-run\[data-less-motion\][^{]*\{[^}]*animation: none; transition: none;/);
  });
});

describe('touch and keyboard', () => {
  it('never sets a button, field, switch or summary smaller than 44px', () => {
    const sizes: [string, number][] = [];
    for (const m of css.matchAll(/([^{}]+)\{[^}]*?min-height:\s*(\d+)px/g)) sizes.push([m[1].trim(), Number(m[2])]);
    const wanted = ['.mn-btn', '.mn-check', '.mn-field select', '.mn-more > summary', '.mn-touchbtn'];
    for (const w of wanted) {
      const found = sizes.find(([s]) => s.includes(w));
      expect(found, w).toBeDefined();
      expect(found![1], w).toBeGreaterThanOrEqual(44);
    }
    expect(css).toMatch(/\.mn-touchbtn\s*\{[^}]*min-width: 56px; min-height: 56px/);
    expect(css).toMatch(/\.mn-touchbtn--small\s*\{ width: 56px; height: 56px/);
  });
  it('makes the thumb sticks at least 100px across', () => {
    // The size is set where the stick is made (TouchControls.tsx).
    const source = readFileSync(`${process.cwd()}/src/games/mine/TouchControls.tsx`, 'utf8');
    expect(Number(source.match(/const STICK = (\d+)/)![1])).toBeGreaterThanOrEqual(100);
  });
  it('does not remove the site’s keyboard focus outline', () => {
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });
  it('never styles a bare element or a shared class', () => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of noComments.matchAll(/^([^@{}\s][^{}]*)\{/gm)) {
      for (const sel of m[1].split(',').map((s) => s.trim())) {
        if (/^(from|to)$/.test(sel) || /^\d+%$/.test(sel)) continue;
        expect(sel, 'every selector must start with .mn-').toMatch(/^\.mn-/);
      }
    }
  });
  it('keeps the page from scrolling under a flying screen', () => {
    expect(rule('.mn-run')).toMatch(/position: fixed; inset: 0/);
    expect(rule('.mn-stage')).toMatch(/touch-action: none/);
  });
});
