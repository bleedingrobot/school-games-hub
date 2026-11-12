import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { WORDS } from './words';
import { TUI_ABOUT, saveTuiEnabled, useTuiClassSwitch, useTuiSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const TuiPlay = lazy(() => import('./TuiPlay').then((m) => ({ default: m.TuiPlay })));
const TuiStudentPanel = lazy(() => import('../../pages/TeacherTui').then((m) => ({ default: m.TuiStudentPanel })));
const TuiTeacherSettings = lazy(() => import('../../pages/TeacherTui').then((m) => ({ default: m.TuiTeacherSettings })));

/** A blue-green tūī with a yellow scarf beside a kete tagged 10. */
function TuiIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#3f6b2c" />
      <ellipse cx="20" cy="36" rx="12" ry="14" fill="#1f7a7a" />
      <circle cx="19" cy="20" r="8" fill="#1f7a7a" />
      <path d="M11 20 L3 23 L11 25 Z" fill="#2b2b2b" />
      <circle cx="17" cy="18" r="1.8" fill="#fff" />
      <circle cx="17.3" cy="18" r="0.9" fill="#111" />
      <path d="M11 28 Q19 34 28 27 L27 31 Q19 38 12 32 Z" fill="#f4c20d" />
      <path d="M18 49 L17 56 M24 49 L25 56" stroke="#2b2b2b" strokeWidth="2" />
      <path d="M36 38 Q48 34 60 38 L56 56 Q48 60 40 56 Z" fill="#c9a45c" />
      <path d="M38 40 Q48 44 58 40" stroke="#8a6a2c" strokeWidth="1.5" fill="none" />
      <path d="M40 38 Q48 28 56 38" stroke="#8a6a2c" strokeWidth="2" fill="none" />
      <rect x="42" y="44" width="12" height="8" rx="2" fill="#fff" />
      <text x="48" y="51" fontSize="7" fontWeight="900" textAnchor="middle" fill="#1b2340">10</text>
    </svg>
  );
}

/**
 * Tūī’s Ten Tree (docs/TUI-PLAN.md; short id tui): for younger students, ten goes a day of teen numbers as ten and some
 * more, kōwhai flowers that turn bronze, silver and gold, and a Golden Nest after thirty days. Not ranked, no points.
 * On the dashboard only while `tuiOn()` is true and the teacher has the game on for the pupil's class.
 */
export const tuisTenTree: GameDefinition = {
  id: 'tui',
  name: 'Tūī’s Ten Tree',
  tagline: 'Ten and some more: help Tūī fill up for winter',
  colours: ['#4a5d1f', '#0f5c66'],
  Icon: TuiIcon,
  Play: TuiPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  // The home page card's chip: today's flower ready, or come back tomorrow.
  nextPart: { noun: WORDS.part },
  teacherSwitch: true,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Nests in
  // the Maths column, and a drawer with the help setting.
  teacher: {
    switch: { useValue: useTuiClassSwitch, save: saveTuiEnabled, about: TUI_ABOUT },
    useSummary: useTuiSummary,
    Settings: TuiTeacherSettings,
    StudentPanel: TuiStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherTui').then((m) => m.tuiStudentSummary(student)),
    // Today's "Needs you" line and "Hardest right now", from the Foundational view's cached class data (src/teacher/foundational).
    alerts: (classId) => import('../../teacher/foundational/alerts').then((m) => m.foundationalAlerts('tui', classId)),
    hardest: (classId) => import('../../teacher/foundational/alerts').then((m) => m.foundationalHardest('tui', classId)),
  },
};
