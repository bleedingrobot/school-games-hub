import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { TEXT } from './strings';
import { saveBondMatchEnabled } from '../../data/bondMatch';
import { useBondMatchClassSwitch, useBondMatchEnabled } from './switch';

// Loaded only when someone opens the game, so the dashboard stays quick.
const BondMatchHub = lazy(() => import('./BondMatchHub').then((m) => ({ default: m.BondMatchHub })));
const BondMatchStudentPanel = lazy(() => import('../../pages/TeacherBondMatch').then((m) => ({ default: m.BondMatchStudentPanel })));

function BondMatchIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="14" width="24" height="34" rx="5" fill="currentColor" opacity="0.55" transform="rotate(-8 18 31)" />
      <rect x="34" y="14" width="24" height="34" rx="5" fill="currentColor" transform="rotate(8 46 31)" />
      <path d="M13 28h10M18 23v10M41 31h10" stroke="rgba(0,0,0,0.35)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Bond Match (docs/BOND-MATCH-PLAN.md). On the dashboard while BOND_MATCH_ON (./switch.ts) is true and the teacher has
 * switched it on for the pupil's class. Never ranked: it is practice, and points are small and capped.
 */
export const bondMatch: GameDefinition = {
  id: 'bond-match',
  name: TEXT.name,
  tagline: TEXT.tagline,
  colours: ['#0f766e', '#6d28d9'],
  Icon: BondMatchIcon,
  Play: BondMatchHub,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  useTeacherSwitch: useBondMatchEnabled,
  // The teacher's Games table: just the on/off switch (nothing to open), and the student page's stars.
  teacher: {
    switch: {
      useValue: useBondMatchClassSwitch,
      save: (on, classId) => saveBondMatchEnabled(on, classId),
      about:
        'A memory card game where two cards match when they make a number together (to 10, 100, 1, and more). Off hides it from students and nothing is saved.',
    },
    StudentPanel: BondMatchStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherBondMatch').then((m) => m.bondMatchSummary(student)),
  },
};
