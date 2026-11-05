import { lazy } from 'react';
import { saveDecreeEnabled } from '../../data/decree';
import type { GameDefinition } from '../types';
import { useDecreeEnabled } from './switch';
import { DECREE_ABOUT, decreeSummary, useDecreeClassSwitch } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const DecreePlay = lazy(() => import('./DecreePlay').then((m) => ({ default: m.DecreePlay })));

/** A rolled scroll with a red wax seal. */
function ScrollIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* paper */}
      <path d="M14 10 H50 V50 Q50 56 44 56 H14 Z" fill="#fef3c7" stroke="#92400e" strokeWidth="2" strokeLinejoin="round" />
      {/* rolls at top and bottom */}
      <rect x="10" y="6" width="44" height="8" rx="4" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
      <rect x="10" y="52" width="40" height="8" rx="4" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
      {/* writing */}
      <path d="M20 22 H44 M20 29 H44 M20 36 H36" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" />
      {/* wax seal */}
      <circle cx="42" cy="44" r="8" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
      <circle cx="42" cy="44" r="4" fill="none" stroke="#fecaca" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Royal Decree (docs/DECREE-PLAN.md): rule Riverstone by saying yes or no to your villagers. Every third villager asks a maths
 * question from each pupil's focus. Not ranked. On the dashboard only while `decreeOn()` (./switch.ts) is true and the
 * teacher has the game switched on for the pupil's class.
 */
export const royalDecree: GameDefinition = {
  id: 'decree',
  name: 'Royal Decree',
  tagline: 'Say yes or no to your villagers. Keep Riverstone happy!',
  colours: ['#7c2d12', '#1e3a8a'],
  Icon: ScrollIcon,
  Play: DecreePlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  useTeacherSwitch: useDecreeEnabled,
  teacher: {
    switch: { useValue: useDecreeClassSwitch, save: (on, classId) => saveDecreeEnabled(on, classId), about: DECREE_ABOUT },
    useSummary: decreeSummary,
  },
};
