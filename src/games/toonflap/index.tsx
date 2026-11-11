import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { useToonFlapEnabled } from './switch';
import { saveToonFlapEnabled, TOONFLAP_ABOUT, useToonFlapClassSwitch, useToonFlapSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const ToonFlapPlay = lazy(() => import('./ToonFlapPlay').then((m) => ({ default: m.ToonFlapPlay })));
const ToonFlapTeacherSettings = lazy(() => import('../../pages/TeacherToonFlap').then((m) => ({ default: m.ToonFlapTeacherSettings })));
const ToonFlapStudentPanel = lazy(() => import('../../pages/TeacherToonFlap').then((m) => ({ default: m.ToonFlapStudentPanel })));

/** A round cartoon fantail flapping between two posts. */
function ToonFlapIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#3aa0e0" />
      <rect x="44" y="0" width="12" height="20" rx="3" fill="#5bbf4a" stroke="#2d7a26" strokeWidth="2" />
      <rect x="44" y="40" width="12" height="24" rx="3" fill="#5bbf4a" stroke="#2d7a26" strokeWidth="2" />
      <path d="M10 34 L2 26 L4 40 Z" fill="#6b4a2a" />
      <ellipse cx="22" cy="32" rx="12" ry="10" fill="#8a5a32" />
      <ellipse cx="24" cy="36" rx="7" ry="5" fill="#f2d39a" />
      <path d="M18 28 Q22 18 28 26 Z" fill="#6b4a2a" />
      <circle cx="28" cy="28" r="4" fill="#fff" />
      <circle cx="29" cy="28" r="2" fill="#111" />
      <path d="M33 31 L39 32 L33 34 Z" fill="#f0b429" />
    </svg>
  );
}

/**
 * Toon Flap (docs/TOON-FLAP-PLAN.md; id toonflap): a flappy-style flight through ten cartoon worlds, racing medal times,
 * with times-table checks on the way and answer gaps to fly through. The `toonflap` server function makes and marks the
 * maths and replays every run. On the dashboard only while `toonflapOn()` is true and the teacher has the game on for the
 * pupil's class (on for every class since 11 Nov 2026).
 */
export const toonFlap: GameDefinition = {
  id: 'toonflap',
  name: 'Toon Flap',
  tagline: 'Flap through ten cartoon worlds',
  colours: ['#3aa0e0', '#5bbf4a'],
  Icon: ToonFlapIcon,
  Play: ToonFlapPlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  inDevelopment: true,
  useTeacherSwitch: useToonFlapEnabled,
  // The teacher's Games table: the on/off switch in the row, the class's levels and golds in the Maths column, and a drawer
  // with the maths and read-time settings.
  teacher: {
    switch: { useValue: useToonFlapClassSwitch, save: saveToonFlapEnabled, about: TOONFLAP_ABOUT },
    useSummary: useToonFlapSummary,
    Settings: ToonFlapTeacherSettings,
    StudentPanel: ToonFlapStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherToonFlap').then((m) => m.toonFlapStudentSummary(student)),
  },
};
