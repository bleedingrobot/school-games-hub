import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { useKororaEnabled } from './switch';
import { KORORA_ABOUT, saveKororaEnabled, useKororaClassSwitch, useKororaSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const KororaPlay = lazy(() => import('./KororaPlay').then((m) => ({ default: m.KororaPlay })));
const KororaStudentPanel = lazy(() => import('../../pages/TeacherKorora').then((m) => ({ default: m.KororaStudentPanel })));
const KororaTeacherSettings = lazy(() => import('../../pages/TeacherKorora').then((m) => ({ default: m.KororaTeacherSettings })));

/** A little blue penguin on a rock, with a fish and its reflection. */
function KororaIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1f5f8b" opacity="0.9" />
      <rect x="0" y="38" width="64" height="26" rx="0" fill="#5fb3cf" />
      <line x1="4" y1="38" x2="60" y2="38" stroke="#ffffff" strokeWidth="2" />
      <ellipse cx="24" cy="24" rx="10" ry="14" fill="#5d86b8" />
      <ellipse cx="24" cy="27" rx="6.5" ry="10" fill="#ffffff" />
      <circle cx="21" cy="17" r="1.8" fill="#1b2340" />
      <circle cx="27" cy="17" r="1.8" fill="#1b2340" />
      <path d="M22 21 L26 21 L24 24 Z" fill="#3a3a44" />
      <ellipse cx="46" cy="32" rx="7" ry="4" fill="#f39a4a" />
      <path d="M52 32 L57 28 L57 36 Z" fill="#f39a4a" />
      <ellipse cx="46" cy="44" rx="7" ry="4" fill="#f39a4a" opacity="0.6" />
      <path d="M52 44 L57 40 L57 48 Z" fill="#f39a4a" opacity="0.6" />
    </svg>
  );
}

/**
 * Penguin Pairs (docs/KORORA-PLAN.md; short id korora): for younger students, ten goes a day of doubles and halves with
 * Two-Shoes the penguin at the mirror pool, magic stepping stones that turn bronze, silver and gold, and a pair of
 * dancing shoes after each crossing (dazzling gold after thirty days). Not ranked,
 * no points. On the dashboard only while `kororaOn()` is true and the teacher has the game on for the pupil's class.
 */
export const penguinPairs: GameDefinition = {
  id: 'korora',
  name: 'Penguin Pairs',
  tagline: 'Doubles and halves with Two-Shoes the penguin',
  colours: ['#1f5f8b', '#2f7d9e'],
  Icon: KororaIcon,
  Play: KororaPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  useTeacherSwitch: useKororaEnabled,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's gold dancing shoes in the
  // Maths column, and a drawer with the help setting.
  teacher: {
    switch: { useValue: useKororaClassSwitch, save: saveKororaEnabled, about: KORORA_ABOUT },
    useSummary: useKororaSummary,
    Settings: KororaTeacherSettings,
    StudentPanel: KororaStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherKorora').then((m) => m.kororaStudentSummary(student)),
  },
};
