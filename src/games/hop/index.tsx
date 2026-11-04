import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { useHopEnabled } from './switch';
import { HOP_ABOUT, saveHopEnabled, useHopClassSwitch, useHopSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const HopPlay = lazy(() => import('./HopPlay').then((m) => ({ default: m.HopPlay })));
const HopStudentPanel = lazy(() => import('../../pages/TeacherHop').then((m) => ({ default: m.HopStudentPanel })));
const HopTeacherSettings = lazy(() => import('../../pages/TeacherHop').then((m) => ({ default: m.HopTeacherSettings })));

/** A frog on a lily pad, with a glow-worm over it. */
function HopIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1b2340" opacity="0.9" />
      <ellipse cx="32" cy="48" rx="24" ry="9" fill="#2f8f4e" />
      <path d="M32 48 L50 40" stroke="#1b2340" strokeWidth="2" />
      <ellipse cx="32" cy="38" rx="11" ry="9" fill="#5cbf52" />
      <circle cx="27" cy="29" r="4" fill="#ffffff" />
      <circle cx="37" cy="29" r="4" fill="#ffffff" />
      <circle cx="27" cy="29" r="1.8" fill="#1b2340" />
      <circle cx="37" cy="29" r="1.8" fill="#1b2340" />
      <path d="M26 40 Q32 44 38 40" stroke="#24661f" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="51" cy="14" r="7" fill="#eafbe0" opacity="0.35" />
      <path d="M44 16 Q48 8 56 12" stroke="#eafbe0" strokeWidth="5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/**
 * Hop's Glow-worm Pond (docs/HOP-PLAN.md): for younger students, ten hops a day counting in tens, fives and twos, magic
 * lily pads that turn bronze, silver and gold, and a Golden Glow Jar after thirty days. Not ranked, no points. Switched off
 * (./switch.ts) and not in src/games/registry.ts yet: that is a go-live change. On the dashboard only while `hopOn()` is
 * true and the teacher has switched it on for the pupil's class.
 */
export const hopsGlowwormPond: GameDefinition = {
  id: 'hop',
  name: 'Hop’s Glow-worm Pond',
  tagline: 'Count in tens, fives and twos to help Hop hop across the pond',
  colours: ['#1b2340', '#2f8f4e'],
  Icon: HopIcon,
  Play: HopPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  useTeacherSwitch: useHopEnabled,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Glow Jars in the
  // Maths column, and a drawer with the hops' step labels on or off.
  teacher: {
    switch: { useValue: useHopClassSwitch, save: saveHopEnabled, about: HOP_ABOUT },
    useSummary: useHopSummary,
    Settings: HopTeacherSettings,
    StudentPanel: HopStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherHop').then((m) => m.hopStudentSummary(student)),
  },
};
