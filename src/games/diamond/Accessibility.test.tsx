import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${process.cwd()}/src/games/diamond/diamond.css`, 'utf8');

/** WCAG relative luminance and contrast ratio. */
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (name: string) => css.match(new RegExp(`--dd-${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1];

describe('Diamond Drop accessibility (read from diamond.css)', () => {
  it('has 4.5:1 words, 3:1 edges, 44px targets, and no movement for pupils who prefer less', () => {
    // Words on the game's own dark backgrounds, and dark words on the gold, the target bar and a full bar.
    for (const bg of ['bg', 'panel', 'face']) {
      for (const text of ['ink', 'soft', 'gold', 'good', 'warn']) expect(contrast(colour(text), colour(bg)), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour('line'), colour(bg)), `edges on ${bg}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(colour('locked'), colour('locked-bg')), 'locked chambers').toBeGreaterThanOrEqual(4.5);
    for (const bg of ['gold', 'track', 'good']) expect(contrast(colour('gold-ink'), colour(bg)), `dark words on ${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const m of css.matchAll(/\.dd-rarity--\w+ \{ background: (#[0-9a-f]{6})/gi)) expect(contrast('#ffffff', m[1]), m[0]).toBeGreaterThanOrEqual(4.5);

    // Every button, tab, chamber, tick box and summary is at least 44px high.
    for (const m of css.matchAll(/([^{}]+)\{[^}]*?min-height:\s*(\d+)px/g)) {
      const selector = m[1].trim();
      if (/(btn|tab|chamber|drop|close|summary|check|tools)/.test(selector) && !/__(num|name|state|you)/.test(selector)) expect(Number(m[2]), selector).toBeGreaterThanOrEqual(44);
    }
    expect(css).toMatch(/\.dd-drop \{[^}]*min-height: 64px/);

    // Every animation and transition is either only for "no preference" or stopped for "reduce".
    const lines = css.split('\n');
    for (const [i, line] of lines.entries()) {
      if (/\b(animation|transition)\s*:/.test(line) && !/animation:\s*none|transition:\s*none/.test(line)) {
        const before = lines.slice(0, i + 1).join('\n');
        expect(before.lastIndexOf('prefers-reduced-motion: no-preference') > before.lastIndexOf('\n}\n'), line.trim()).toBe(true);
      }
    }
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^\n]*animation: none[^\n]*transition: none/);
    // The game's own "Less motion" setting stops them too.
    expect(css).toMatch(/\.dd-still \*[^\n]*animation: none/);
  });
});
