import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { useTraderEnabled } from './switch';

// Loaded only when someone opens the game, so the dashboard stays quick.
const TraderPlay = lazy(() => import('./TraderPlay').then((m) => ({ default: m.TraderPlay })));
const TraderTeacherPanel = lazy(() => import('../../pages/TeacherTrader').then((m) => ({ default: m.TraderTeacherPanel })));
const TraderStudentPanel = lazy(() => import('../../pages/TeacherTrader').then((m) => ({ default: m.TraderStudentPanel })));

/** A little ship with an engine flame, over a planet. */
function TraderIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="42" cy="40" r="17" fill="currentColor" opacity="0.4" />
      <ellipse cx="42" cy="40" rx="25" ry="6" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.7" transform="rotate(-18 42 40)" />
      <path d="M8 30 L26 22 L40 26 L26 34 Z" fill="currentColor" />
      <path d="M8 30 L2 26 L2 34 Z" fill="#fde047" />
      <circle cx="30" cy="27" r="2.6" fill="#7dd3fc" />
    </svg>
  );
}

/**
 * Star Trader (docs/TRADER-PLAN.md): fly a small ship between planets, buy low, sell high, upgrade, dodge pirates and
 * save up to buy a moon. Not ranked. On the dashboard only while `traderOn()` (./switch.ts) is true and the teacher has
 * switched it on for the pupil's class. Added to src/games/registry.ts behind that switch.
 */
export const starTrader: GameDefinition = {
  id: 'trader',
  name: 'Star Trader',
  tagline: 'Buy low, sell high, and save up for a moon of your own',
  colours: ['#4c1d95', '#0e7490'],
  Icon: TraderIcon,
  Play: TraderPlay,
  ranked: false,
  noBots: true,
  group: 'complex-maths',
  useTeacherSwitch: useTraderEnabled,
  TeacherPanels: TraderTeacherPanel,
  StudentPanel: TraderStudentPanel,
};
