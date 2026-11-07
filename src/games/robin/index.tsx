import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { WORDS } from './words';
import { useRobinEnabled } from './switch';
import { ROBIN_ABOUT, saveRobinEnabled, useRobinClassSwitch, useRobinSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const RobinPlay = lazy(() => import('./RobinPlay').then((m) => ({ default: m.RobinPlay })));
const RobinStudentPanel = lazy(() => import('../../pages/TeacherRobin').then((m) => ({ default: m.RobinStudentPanel })));
const RobinTeacherSettings = lazy(() => import('../../pages/TeacherRobin').then((m) => ({ default: m.RobinTeacherSettings })));

/** A round robin beside a basket of red berries. */
function RobinIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#3d6b3a" />
      <ellipse cx="24" cy="38" rx="14" ry="15" fill="#8a7a5a" />
      <ellipse cx="26" cy="42" rx="8" ry="11" fill="#e2552e" />
      <circle cx="24" cy="23" r="10" fill="#8a7a5a" />
      <circle cx="20" cy="22" r="4.4" fill="#fff" />
      <circle cx="29" cy="22" r="4.4" fill="#fff" />
      <circle cx="20.6" cy="22" r="2.2" fill="#111" />
      <circle cx="29.6" cy="22" r="2.2" fill="#111" />
      <path d="M24 26 L30 29 L24 31 Z" fill="#f0b429" />
      <path d="M36 40 L60 40 L56 58 L40 58 Z" fill="#c79a5a" stroke="#7a5a2a" strokeWidth="1.5" />
      <circle cx="42" cy="38" r="4.5" fill="#d8283c" />
      <circle cx="50" cy="37" r="4.5" fill="#d8283c" />
      <circle cx="46" cy="33" r="4.5" fill="#d8283c" />
    </svg>
  );
}

/**
 * Robin’s Berry Basket (docs/ROBIN-PLAN.md; short id robin): for younger students, ten goes a day of counting out a set
 * (give exactly N berries, how many, one more), baskets on a log that turn bronze, silver and gold, and a Golden Berry
 * Feast after thirty days. Not ranked, no points. On the dashboard only while `robinOn()` is true and the teacher has the
 * game on for the pupil's class.
 */
export const robinsBerryBasket: GameDefinition = {
  id: 'robin',
  name: 'Robin’s Berry Basket',
  tagline: 'Count out the berries',
  colours: ['#3d6b3a', '#c0392b'],
  Icon: RobinIcon,
  Play: RobinPlay,
  ranked: false,
  noBots: true,
  group: 'foundational',
  inDevelopment: true,
  // The home page card's chip: today's basket ready, or come back tomorrow.
  nextPart: { noun: WORDS.part },
  useTeacherSwitch: useRobinEnabled,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Berry Feasts in
  // the Maths column, and a drawer with the help setting.
  teacher: {
    switch: { useValue: useRobinClassSwitch, save: saveRobinEnabled, about: ROBIN_ABOUT },
    useSummary: useRobinSummary,
    Settings: RobinTeacherSettings,
    StudentPanel: RobinStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherRobin').then((m) => m.robinStudentSummary(student)),
  },
};
