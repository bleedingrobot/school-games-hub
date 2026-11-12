import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { WORDS } from './words';
import { LIZARD_ABOUT, saveLizardEnabled, useLizardClassSwitch, useLizardSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const LizardPlay = lazy(() => import('./LizardPlay').then((m) => ({ default: m.LizardPlay })));
const LizardStudentPanel = lazy(() => import('../../pages/TeacherLizard').then((m) => ({ default: m.LizardStudentPanel })));
const LizardTeacherSettings = lazy(() => import('../../pages/TeacherLizard').then((m) => ({ default: m.LizardTeacherSettings })));

/** A green lizard with a bundle of sticks. */
function LizardIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#2f6b3f" />
      <path d="M8 40 Q16 28 30 32 Q42 34 50 26 L58 22 L54 30 Q46 42 32 42 Q18 44 8 40 Z" fill="#7fc44a" />
      <circle cx="50" cy="27" r="2" fill="#111" />
      <path d="M12 48 H52" stroke="#c8903a" strokeWidth="4" strokeLinecap="round" />
      {[16, 22, 28, 34, 40, 46].map((x) => <path key={x} d={`M${x} 46 V56`} stroke="#e8c88a" strokeWidth="3" strokeLinecap="round" />)}
      <path d="M12 51 H50" stroke="#f5c518" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Lizard’s Bundles (docs/LIZARD-PLAN.md; short id lizard): for students about 5 to 8, ten goes a day tying sticks into bundles of ten (tens and ones to 100, then
 * hundreds), bundles in Lizard's den that turn bronze, silver and gold, and a Golden Raft after thirty days. Not ranked,
 * no points. On the dashboard only while `lizardOn()` is true and the teacher has the game on for the pupil's class.
 */
export const lizardBundles: GameDefinition = {
  id: 'lizard',
  name: 'Lizard’s Bundles',
  tagline: 'Tie sticks into bundles with Lizard',
  colours: ['#2f6b3f', '#0f5c66'],
  Icon: LizardIcon,
  Play: LizardPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  inDevelopment: true,
  // The home page card's chip: today's flower ready, or come back tomorrow.
  nextPart: { noun: WORDS.part },
  teacherSwitch: true,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Rafts in
  // the Maths column, and a drawer with the help setting.
  teacher: {
    switch: { useValue: useLizardClassSwitch, save: saveLizardEnabled, about: LIZARD_ABOUT },
    useSummary: useLizardSummary,
    Settings: LizardTeacherSettings,
    StudentPanel: LizardStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherLizard').then((m) => m.lizardStudentSummary(student)),
    // Today's "Needs you" line and "Hardest right now", from the Foundational view's cached class data (src/teacher/foundational).
    alerts: (classId) => import('../../teacher/foundational/alerts').then((m) => m.foundationalAlerts('lizard', classId)),
    hardest: (classId) => import('../../teacher/foundational/alerts').then((m) => m.foundationalHardest('lizard', classId)),
  },
};
