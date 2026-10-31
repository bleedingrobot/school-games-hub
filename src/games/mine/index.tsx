import { lazy } from 'react';
import { saveMineEnabled, saveMineMaths } from '../../data/mine';
import type { GameDefinition } from '../types';
import { useMineEnabled } from './switch';
import { MINE_ABOUT, MINE_MATHS_ABOUT, useMineClassMaths, useMineClassSwitch } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const MinePlay = lazy(() => import('./MinePlay').then((m) => ({ default: m.MinePlay })));

/** A little ship in a tunnel, with the reactor glowing at the end. */
function MineIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M4 12 L28 22 V46 L4 56 Z" fill="currentColor" opacity="0.5" />
      <path d="M60 12 L36 22 V46 L60 56 Z" fill="currentColor" opacity="0.5" />
      <path d="M28 22 H36 V46 H28 Z" fill="currentColor" opacity="0.8" />
      <circle cx="32" cy="34" r="5" fill="#fb923c" />
      <path d="M14 44 L22 38 L30 52 Z" fill="currentColor" />
      <path d="M22 38 L26 42" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Mine Runner (docs/MINE-PLAN.md): fly a ship through twisting underground mines, find keys, answer question doors, blow
 * up the reactor and race to the exit. Solo, against robots, with school-only best-time boards. Never ranked. On the
 * dashboard only while `mineOn()` (./switch.ts) is true and the teacher has switched it on for the pupil's class.
 */
export const mineRunner: GameDefinition = {
  id: 'mine',
  name: 'Mine Runner',
  tagline: 'Fly through the mine, blow up the reactor and race to the exit',
  colours: ['#7c2d12', '#1e3a8a'],
  Icon: MineIcon,
  Play: MinePlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  useTeacherSwitch: useMineEnabled,
  // The teacher's Games table: the on/off switch and the maths switch, both in the row, and nothing to open.
  teacher: {
    switch: { useValue: useMineClassSwitch, save: (on, classId) => saveMineEnabled(on, classId), about: MINE_ABOUT },
    maths: { useValue: useMineClassMaths, save: (mode, classId) => saveMineMaths(mode, classId), about: MINE_MATHS_ABOUT },
  },
};
