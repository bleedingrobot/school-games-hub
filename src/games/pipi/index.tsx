import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { usePipiEnabled } from './switch';
import { PIPI_ABOUT, savePipiEnabled, usePipiClassSwitch, usePipiSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const PipiPlay = lazy(() => import('./PipiPlay').then((m) => ({ default: m.PipiPlay })));
const PipiStudentPanel = lazy(() => import('../../pages/TeacherPipi').then((m) => ({ default: m.PipiStudentPanel })));
const PipiTeacherSettings = lazy(() => import('../../pages/TeacherPipi').then((m) => ({ default: m.PipiTeacherSettings })));

/** A paper pipi shell on the sand, with one peeking out beside it. */
function PipiIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#7cc7d9" />
      <path d="M0 40 Q16 34 32 39 T64 37 V64 H0 Z" fill="#f2d59b" />
      <path d="M0 50 Q20 45 36 50 T64 48 V64 H0 Z" fill="#e8c27d" />
      <path d="M14 42 Q26 22 38 42 Z" fill="#f7efe1" stroke="#b58a5a" strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 26 V42 M20 33 L23 42 M32 33 L29 42" stroke="#d7b58c" strokeWidth="1.6" />
      <path d="M42 48 Q48 38 54 48 Z" fill="#f7efe1" stroke="#b58a5a" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="46" cy="44" r="1.3" fill="#3a2a1a" />
      <circle cx="50" cy="44" r="1.3" fill="#3a2a1a" />
    </svg>
  );
}

/**
 * Pipi's Hidden Shells (docs/PIPI-PLAN.md): for younger students, ten goes a day finding how many pipi are hiding under
 * the sand (part-whole within 10), magic shells that turn bronze, silver and gold, and a Golden Pearl after thirty days.
 * Not ranked, no points. On the dashboard (Foundational skills) only while `pipiOn()` is true and the teacher has the
 * game on for the pupil's class.
 */
export const pipisHiddenShells: GameDefinition = {
  id: 'pipi',
  name: 'Pipi’s Hidden Shells',
  tagline: 'Find how many pipi are hiding under the sand',
  colours: ['#7cc7d9', '#f2d59b'],
  Icon: PipiIcon,
  Play: PipiPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  useTeacherSwitch: usePipiEnabled,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Pearls in the
  // Maths column, and a drawer with the help in the sand on or off.
  teacher: {
    switch: { useValue: usePipiClassSwitch, save: savePipiEnabled, about: PIPI_ABOUT },
    useSummary: usePipiSummary,
    Settings: PipiTeacherSettings,
    StudentPanel: PipiStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherPipi').then((m) => m.pipiStudentSummary(student)),
  },
};
