import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../avatar/avatarParts';

const css = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8');

/** WCAG relative luminance and contrast ratio. */
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** A theme's block of --h-* tokens in styles.css. */
function block(theme: string) {
  const start = css.indexOf(`[data-hub-theme='${theme}'] {`);
  expect(start, theme).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}
/** Every hex colour a token holds (a gradient gives each of its stops). */
function colours(theme: string, name: string): string[] {
  const value = block(theme).match(new RegExp(`--h-${name}:\\s*([^;]+);`))?.[1];
  expect(value, `${theme} --h-${name}`).toBeTruthy();
  const hexes = value!.match(/#[0-9a-f]{6}\b/gi) ?? [];
  expect(hexes.length, `${theme} --h-${name} has a plain colour`).toBeGreaterThan(0);
  return hexes;
}
const one = (theme: string, name: string) => colours(theme, name)[0];

describe.each(THEMES.map((t) => t.id))('the %s theme', (theme) => {
  const worst = (text: string, backs: string[]) => Math.min(...backs.flatMap((b) => colours(theme, b)).map((bg) => contrast(colours(theme, text)[0], bg)));

  it('gives text at least 4.5 to 1 on every box, chip and strip it sits on', () => {
    expect(worst('box-ink', ['box', 'surface', 'chip', 'chip-done', 'hero']), 'text').toBeGreaterThanOrEqual(4.5);
    expect(worst('box-soft', ['box', 'chip', 'hero']), 'softer text').toBeGreaterThanOrEqual(4.5);
    expect(worst('link', ['box', 'hero']), 'links').toBeGreaterThanOrEqual(4.5);
    expect(worst('pts', ['box']), 'points').toBeGreaterThanOrEqual(4.5);
    expect(worst('going-ink', ['going']), 'still going lines').toBeGreaterThanOrEqual(4.5);
  });

  it('gives words straight on the page at least 4.5 to 1', () => {
    expect(worst('title', ['page-solid']), 'page titles').toBeGreaterThanOrEqual(4.5);
    expect(worst('label', ['page-solid']), 'game group labels').toBeGreaterThanOrEqual(4.5);
  });

  it('gives button words at least 4.5 to 1', () => {
    expect(worst('play-ink', ['play']), 'Play button').toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', one(theme, 'brand')), 'white on the main buttons').toBeGreaterThanOrEqual(4.5);
    // A card's Play: dark words on white (Soft and bright paints it in the game's own colours, with white words, like the card).
    expect(contrast('#0f172a', one(theme, 'card-go')), 'card Play').toBeGreaterThanOrEqual(4.5);
  });

  it('keeps keyboard focus clear: the ring or its halo stands out 3 to 1 on the page and on boxes', () => {
    for (const bg of [one(theme, 'page-solid'), one(theme, 'box'), one(theme, 'bar')]) {
      const best = Math.max(contrast(one(theme, 'focus'), bg), contrast(one(theme, 'focus-halo'), bg));
      expect(best, `focus on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the Soft and bright extras', () => {
  it('gives the white group tags at least 4.5 to 1', () => {
    for (const group of ['no-maths', 'easy-maths', 'complex-maths', 'training']) {
      const bg = css.match(new RegExp(`game-group--${group} \\.game-group__label span \\{\\s*background: (#[0-9a-f]{6})`))![1];
      expect(contrast('#ffffff', bg), group).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the home page styles', () => {
  const home = css.slice(css.indexOf('/* ---------- Home page (dashboard)'));
  it('never sets a button or link on it shorter than 40px', () => {
    for (const m of home.matchAll(/([^{}]+)\{[^}]*?min-height:\s*(\d+)px/g)) expect(Number(m[2]), m[1].trim()).toBeGreaterThanOrEqual(40);
  });
  it('has no animation, and its hover lifts stop for pupils who ask for less movement', () => {
    expect(home).not.toMatch(/animation:\s*(?!\s|none)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*?\.game-card:hover,\s*\.quick-link:hover,\s*\.link-tile:hover \{\s*transform: none;/);
  });
});
