import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { useBeanstalkEnabled } from './switch';
import { BEANSTALK_ABOUT, saveBeanstalkEnabled, useBeanstalkClassSwitch, useBeanstalkSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const BeanstalkPlay = lazy(() => import('./BeanstalkPlay').then((m) => ({ default: m.BeanstalkPlay })));
const BeanstalkTeacherSettings = lazy(() => import('../../pages/TeacherBeanstalk').then((m) => ({ default: m.BeanstalkTeacherSettings })));

/** A beanstalk with heart-shaped leaves and a golden egg on a cloud. */
function BeanstalkIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="44" cy="14" rx="16" ry="7" fill="#ffffff" opacity="0.95" />
      <ellipse cx="46" cy="7" rx="4" ry="5" fill="#f5c518" stroke="#a16207" strokeWidth="1.2" />
      <path d="M26 62 C22 48 34 40 30 28 C27 20 34 16 38 14" stroke="#24661f" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M28 46 C18 48 14 40 18 36 C22 38 26 40 28 46 Z" fill="#5cbf52" />
      <path d="M31 34 C40 36 44 28 40 24 C36 26 32 28 31 34 Z" fill="#f5c518" />
      <path d="M29 24 C20 24 18 17 22 14 C25 16 28 19 29 24 Z" fill="#cbd5e1" />
    </svg>
  );
}

/**
 * Kiwi's Beanstalk (docs/BEANSTALK-PLAN.md): for younger students, ten pairs that make 10 a day, magic leaves that turn
 * bronze, silver and gold, and a Golden Egg after thirty days. Not ranked, no points. Switched off (./switch.ts) and not
 * in src/games/registry.ts yet: that is a go-live change. On the dashboard only while `beanstalkOn()` is true and the
 * teacher has switched it on for the pupil's class.
 */
export const kiwisBeanstalk: GameDefinition = {
  id: 'beanstalk',
  name: 'Kiwi’s Beanstalk',
  tagline: 'Make pairs that add to 10 and help Kiwi climb down',
  colours: ['#166534', '#a16207'],
  Icon: BeanstalkIcon,
  Play: BeanstalkPlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  useTeacherSwitch: useBeanstalkEnabled,
  // The teacher's Games table: the on/off switch in the row (the game behind its "?"), the class's Golden Eggs in the
  // Maths column, and a drawer with the leaves' dots on or off.
  teacher: {
    switch: { useValue: useBeanstalkClassSwitch, save: saveBeanstalkEnabled, about: BEANSTALK_ABOUT },
    useSummary: useBeanstalkSummary,
    Settings: BeanstalkTeacherSettings,
    studentSummary: (student) => import('../../pages/TeacherBeanstalk').then((m) => m.beanstalkStudentSummary(student)),
  },
};
