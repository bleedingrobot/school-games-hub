import { lazy } from 'react';
import { saveDiamondEnabled } from '../../data/diamond';
import type { GameDefinition } from '../types';
import { useDiamondEnabled } from './switch';
import { DIAMOND_ABOUT, useDiamondClassSwitch, useDiamondSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const DiamondPlay = lazy(() => import('./DiamondPlay').then((m) => ({ default: m.DiamondPlay })));
const DiamondStudentPanel = lazy(() => import('../../pages/TeacherDiamond').then((m) => ({ default: m.DiamondStudentPanel })));

/** A claw on a rope over a big faceted diamond. */
function DiamondIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 2 V18" stroke="currentColor" strokeWidth="3" />
      <path d="M32 18 L24 28 M32 18 L40 28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M14 40 L22 32 H42 L50 40 L32 60 Z" fill="currentColor" opacity="0.9" />
      <path d="M14 40 H50 M22 32 L28 40 L32 60 M42 32 L36 40 L32 60" stroke="#fbcfe8" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

/**
 * Diamond Drop (docs/DIAMOND-PLAN.md): swing a claw, drop it on gems, hold on with maths, and dig down 10 levels to the
 * Heart Diamond. Not ranked. Switched off (./switch.ts) and not in src/games/registry.ts yet: that is a merge-step change.
 * On the dashboard only while `diamondOn()` is true and the teacher has switched it on for the pupil's class.
 */
export const diamondDrop: GameDefinition = {
  id: 'diamond',
  name: 'Diamond Drop',
  tagline: 'Drop the claw, grab the gems, and dig down to the Heart Diamond',
  colours: ['#7c2d12', '#6b21a8'],
  Icon: DiamondIcon,
  Play: DiamondPlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  useTeacherSwitch: useDiamondEnabled,
  // The teacher's Games table: the on/off switch in the row (the game and its points behind its "?"), how far the class
  // has dug in the Maths column, and starting one student again on their page.
  teacher: {
    switch: { useValue: useDiamondClassSwitch, save: (on, classId) => saveDiamondEnabled(on, classId), about: DIAMOND_ABOUT },
    useSummary: useDiamondSummary,
    StudentPanel: DiamondStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherDiamond').then((m) => m.diamondStudentSummary(student)),
  },
};
