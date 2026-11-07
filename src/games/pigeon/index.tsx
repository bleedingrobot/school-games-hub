import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { WORDS } from './words';
import { usePigeonEnabled } from './switch';
import { PIGEON_ABOUT, savePigeonEnabled, usePigeonClassSwitch, usePigeonSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const PigeonPlay = lazy(() => import('./PigeonPlay').then((m) => ({ default: m.PigeonPlay })));
const PigeonStudentPanel = lazy(() => import('../../pages/TeacherPigeon').then((m) => ({ default: m.PigeonStudentPanel })));
const PigeonTeacherSettings = lazy(() => import('../../pages/TeacherPigeon').then((m) => ({ default: m.PigeonTeacherSettings })));

/** A green pigeon on a branch with a number line under it. */
function PigeonIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#2f6b3f" />
      <ellipse cx="30" cy="26" rx="16" ry="14" fill="#3f7d5a" />
      <ellipse cx="30" cy="31" rx="10" ry="9" fill="#f6f1e4" />
      <circle cx="42" cy="15" r="8" fill="#3f7d5a" />
      <path d="M49 14 L58 18 L49 20 Z" fill="#e8a317" />
      <circle cx="44" cy="13" r="1.8" fill="#fff" />
      <circle cx="44.3" cy="13" r="0.9" fill="#111" />
      <path d="M6 50 H58" stroke="#fffdf5" strokeWidth="3" strokeLinecap="round" />
      {[10, 22, 34, 46, 56].map((x) => <path key={x} d={`M${x} 46 V54`} stroke="#fffdf5" strokeWidth="2" />)}
      <circle cx="34" cy="50" r="4" fill="#f5c518" stroke="#1b2340" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Pigeon’s Number Line (docs/PIGEON-PLAN.md; short id pigeon): for students about 6 to 9, ten goes a day placing and reading numbers on a
 * line to 100 and then 1000, berry clusters that turn bronze, silver and gold, and a Golden Berry Branch after thirty days. Not ranked,
 * no points. On the dashboard only while `pigeonOn()` is true and the teacher has the game on for the pupil's class.
 */
export const pigeonNumberLine: GameDefinition = {
  id: 'pigeon',
  name: 'Pigeon’s Number Line',
  tagline: 'Find the number on the branch with Pigeon',
  colours: ['#2f6b3f', '#0f5c66'],
  Icon: PigeonIcon,
  Play: PigeonPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  // The home page card's chip: today's flower ready, or come back tomorrow.
  nextPart: { noun: WORDS.part },
  useTeacherSwitch: usePigeonEnabled,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Berry Branches in
  // the Maths column, and a drawer with the help setting.
  teacher: {
    switch: { useValue: usePigeonClassSwitch, save: savePigeonEnabled, about: PIGEON_ABOUT },
    useSummary: usePigeonSummary,
    Settings: PigeonTeacherSettings,
    StudentPanel: PigeonStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherPigeon').then((m) => m.pigeonStudentSummary(student)),
  },
};
