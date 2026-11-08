import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { WORDS } from './words';
import { useParrotEnabled } from './switch';
import { PARROT_ABOUT, saveParrotEnabled, useParrotClassSwitch, useParrotSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const ParrotPlay = lazy(() => import('./ParrotPlay').then((m) => ({ default: m.ParrotPlay })));
const ParrotStudentPanel = lazy(() => import('../../pages/TeacherParrot').then((m) => ({ default: m.ParrotStudentPanel })));
const ParrotTeacherSettings = lazy(() => import('../../pages/TeacherParrot').then((m) => ({ default: m.ParrotTeacherSettings })));

/** A green parrot on one end of a see-saw, a golden bell on the other. */
function ParrotIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#2f6f6a" />
      <polygon points="26,56 38,56 32,44" fill="#7a5a34" />
      <rect x="6" y="42" width="52" height="5" rx="2.5" fill="#e6c98e" transform="rotate(-6 32 44)" />
      <ellipse cx="16" cy="32" rx="8" ry="10" fill="#5b9a3a" transform="rotate(-6 32 44)" />
      <circle cx="16" cy="20" r="7" fill="#5b9a3a" transform="rotate(-6 32 44)" />
      <path d="M21 19 L28 21 L21 25 Z" fill="#f08a24" transform="rotate(-6 32 44)" />
      <circle cx="18" cy="18" r="1.8" fill="#fff" transform="rotate(-6 32 44)" />
      <path d="M44 38 C38 38 38 46 36 50 L52 50 C50 46 50 38 44 38 Z" fill="#ffd23f" stroke="#b88a00" strokeWidth="1.5" transform="rotate(-6 32 44)" />
      <circle cx="44" cy="52" r="2.4" fill="#b88a00" transform="rotate(-6 32 44)" />
    </svg>
  );
}

/**
 * Parrot’s See-saw (docs/plans/maths-review/new-games/N2-balance.md; short id parrot): for younger students, ten goes a day
 * of keeping a see-saw level, the equals sign as "the same amount", shiny things that turn bronze, silver and gold on the
 * bell rope, and a Golden Bell after thirty days. Not ranked, no points. On the dashboard only while `parrotOn()` is true
 * and the teacher has the game on for the pupil's class.
 */
export const parrotsSeesaw: GameDefinition = {
  id: 'parrot',
  name: 'Parrot’s See-saw',
  tagline: 'Keep the see-saw level',
  colours: ['#2f6f6a', '#5b9a3a'],
  Icon: ParrotIcon,
  Play: ParrotPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  inDevelopment: true,
  // The home page card's chip: today's shiny thing ready, or come back tomorrow.
  nextPart: { noun: WORDS.part },
  useTeacherSwitch: useParrotEnabled,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Bells in
  // the Maths column, and a drawer with the help setting.
  teacher: {
    switch: { useValue: useParrotClassSwitch, save: saveParrotEnabled, about: PARROT_ABOUT },
    useSummary: useParrotSummary,
    Settings: ParrotTeacherSettings,
    StudentPanel: ParrotStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherParrot').then((m) => m.parrotStudentSummary(student)),
    // Today's "Needs you" line and "Hardest right now", from the Foundational view's cached class data (src/teacher/foundational).
    alerts: (classId) => import('../../teacher/foundational/alerts').then((m) => m.foundationalAlerts('parrot', classId)),
    hardest: (classId) => import('../../teacher/foundational/alerts').then((m) => m.foundationalHardest('parrot', classId)),
  },
};
