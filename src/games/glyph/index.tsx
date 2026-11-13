import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { GLYPH_ABOUT, saveGlyphClassSwitch, useGlyphClassSwitch } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const GlyphPlay = lazy(() => import('./GlyphPlay').then((m) => ({ default: m.GlyphPlay })));

/** A glyph (a 4 × 4 rune with some squares lit) on a stone. */
function GlyphIcon({ size = 64 }: { size?: number }) {
  const on = [5, 6, 9, 10, 2];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#2f7d3a" />
      <rect x="8" y="8" width="48" height="48" rx="8" fill="#8a9a86" stroke="#4d5b4a" strokeWidth="2" />
      {Array.from({ length: 16 }, (_, c) => (
        <rect key={c} x={13 + (c % 4) * 10} y={13 + Math.floor(c / 4) * 10} width="8" height="8" rx="2" fill={on.includes(c) ? '#6df08a' : '#6d7b69'} />
      ))}
      <circle cx="52" cy="12" r="6" fill="#f2c230" stroke="#9a6b00" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Glyph Gates (docs/GLYPH-PLAN.md; id glyph): light the fraction tiles equal to the gold stone, pick the glyph they make and
 * open the temple walls. The `glyph` server function makes and replays every wall. On the dashboard only while `glyphOn()`
 * is true and the teacher has the game on for the class.
 */
export const glyph: GameDefinition = {
  id: 'glyph',
  name: 'Glyph Gates',
  tagline: 'Light the tiles that match the gold stone and open the temple walls',
  colours: ['#1f7a3f', '#0f4d2c'],
  Icon: GlyphIcon,
  Play: GlyphPlay,
  ranked: false,
  noBots: true,
  group: 'complex-maths',
  inDevelopment: true,
  teacherSwitch: true,
  teacher: {
    switch: { useValue: useGlyphClassSwitch, save: saveGlyphClassSwitch, about: GLYPH_ABOUT },
  },
};

export { glyphOn } from './switch';
