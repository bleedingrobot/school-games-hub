import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { useWekaEnabled } from './switch';
import { WEKA_ABOUT, saveWekaEnabled, useWekaClassSwitch, useWekaSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const WekaPlay = lazy(() => import('./WekaPlay').then((m) => ({ default: m.WekaPlay })));
const WekaStudentPanel = lazy(() => import('../../pages/TeacherWeka').then((m) => ({ default: m.WekaStudentPanel })));
const WekaTeacherSettings = lazy(() => import('../../pages/TeacherWeka').then((m) => ({ default: m.WekaTeacherSettings })));

/** A weka on a stepping stone, with the big rock ahead. */
function WekaIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#4f7a3a" />
      <rect x="0" y="36" width="64" height="28" fill="#5fb3cf" />
      <ellipse cx="14" cy="46" rx="9" ry="4" fill="#b9bec2" />
      <ellipse cx="32" cy="48" rx="8" ry="3.5" fill="#8d959d" />
      <ellipse cx="50" cy="47" rx="12" ry="5" fill="#c9b48a" />
      <text x="50" y="50" fontSize="8" fontWeight="900" textAnchor="middle" fill="#1b2340">10</text>
      <ellipse cx="16" cy="30" rx="10" ry="8" fill="#8a5a32" />
      <circle cx="10" cy="22" r="6" fill="#8a5a32" />
      <path d="M5 22 L0 24 L5 25 Z" fill="#8c8a86" />
      <circle cx="9" cy="21" r="1.6" fill="#b0332a" />
      <path d="M14 37 L13 42 M19 37 L20 42" stroke="#c46a5a" strokeWidth="2" />
    </svg>
  );
}

/**
 * Weka’s Stepping Stones (docs/WEKA-PLAN.md; short id weka): for younger students, ten goes a day of adding across ten
 * by making ten on a stream of stepping stones, magic stones that turn bronze, silver and gold, and a Golden Picnic
 * Basket after thirty days. Not ranked, no points. On the dashboard only while `wekaOn()` is true and the teacher has the
 * game on for the pupil's class.
 */
export const wekasSteppingStones: GameDefinition = {
  id: 'weka',
  name: 'Weka’s Stepping Stones',
  tagline: 'Make ten to add: hop with Weka across the stream',
  colours: ['#4f7a3a', '#2f7d9e'],
  Icon: WekaIcon,
  Play: WekaPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  useTeacherSwitch: useWekaEnabled,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Picnic Baskets in
  // the Maths column, and a drawer with the help setting.
  teacher: {
    switch: { useValue: useWekaClassSwitch, save: saveWekaEnabled, about: WEKA_ABOUT },
    useSummary: useWekaSummary,
    Settings: WekaTeacherSettings,
    StudentPanel: WekaStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherWeka').then((m) => m.wekaStudentSummary(student)),
  },
};
