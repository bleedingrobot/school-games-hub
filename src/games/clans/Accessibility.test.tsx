import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
  it('gives text at least 4.5 to 1 on every background it sits on, and borders at least 3 to 1 (so inputs can be seen)', () => {
    for (const text of ['ink', 'soft', 'yellow', 'cyan', 'green', 'red', 'mag']) {
      for (const [where, bg] of Object.entries(backgrounds)) expect(contrast(colour(text), bg), `${text} on ${where}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const bg of [backgrounds.page, backgrounds.panel, backgrounds.selected]) expect(contrast(colour('line'), bg)).toBeGreaterThanOrEqual(3);
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
