import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { WORDS } from './words';
import { useSwamphenEnabled } from './switch';
import { SWAMPHEN_ABOUT, saveSwamphenEnabled, useSwamphenClassSwitch, useSwamphenSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const SwamphenPlay = lazy(() => import('./SwamphenPlay').then((m) => ({ default: m.SwamphenPlay })));
const SwamphenStudentPanel = lazy(() => import('../../pages/TeacherSwamphen').then((m) => ({ default: m.SwamphenStudentPanel })));
const SwamphenTeacherSettings = lazy(() => import('../../pages/TeacherSwamphen').then((m) => ({ default: m.SwamphenTeacherSettings })));

/** A dark blue hen with a red shield, standing in a reed garden of shoots. */
function SwamphenIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#3b6a3a" />
      <ellipse cx="30" cy="26" rx="16" ry="14" fill="#2c3a8c" />
      <ellipse cx="30" cy="31" rx="10" ry="9" fill="#5a6ad0" />
      <circle cx="42" cy="15" r="8" fill="#2c3a8c" />
      <path d="M40 6 L47 7 L46 12 L41 12 Z" fill="#d83a2e" />
      <path d="M49 14 L58 18 L49 20 Z" fill="#e8a317" />
      <circle cx="44" cy="13" r="1.8" fill="#fff" />
      {[0, 1].map((r) => [10, 22, 34, 46].map((x) => <ellipse key={`${r}${x}`} cx={x + 4} cy={48 + r * 9} rx="3" ry="4.5" fill="#bfe58c" />))}
    </svg>
  );
}

/**
 * Swamp Hen’s Reed Rows (docs/SWAMPHEN-PLAN.md; short id swamphen): for students about 6 to 9, ten goes a day with equal rows and
 * arrays of shoots, then the times tables. Reed rows that turn bronze, silver and gold, and a Golden Reed Garden after thirty
 * days. Not ranked, no points. On the dashboard only while `swamphenOn()` is true and the teacher has the game on for the class.
 */
export const swamphenReedRows: GameDefinition = {
  id: 'swamphen',
  name: 'Swamp Hen’s Reed Rows',
  tagline: 'Count the shoots in equal rows with Swamp Hen',
  colours: ['#3b6a3a', '#2c3a8c'],
  Icon: SwamphenIcon,
  Play: SwamphenPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  inDevelopment: true,
  nextPart: { noun: WORDS.part },
  useTeacherSwitch: useSwamphenEnabled,
  teacher: {
    switch: { useValue: useSwamphenClassSwitch, save: saveSwamphenEnabled, about: SWAMPHEN_ABOUT },
    useSummary: useSwamphenSummary,
    Settings: SwamphenTeacherSettings,
    StudentPanel: SwamphenStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherSwamphen').then((m) => m.swamphenStudentSummary(student)),
  },
};
