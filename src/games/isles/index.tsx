import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { useIslesEnabled } from './switch';

// Loaded only when someone opens the game, so the dashboard stays quick.
const IslesPlay = lazy(() => import('./IslesPlay').then((m) => ({ default: m.IslesPlay })));

/** A little floating island with a house and a cloud. */
function IslandIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="50" cy="14" rx="10" ry="5" fill="#ffffff" opacity="0.9" />
      <path d="M8 34 Q32 26 56 34 L44 48 Q36 60 32 60 Q28 60 20 48 Z" fill="#8a5a34" stroke="#5b3a1e" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="32" cy="34" rx="24" ry="7" fill="#7cc35b" stroke="#3f7a2a" strokeWidth="2" />
      <rect x="24" y="22" width="12" height="10" fill="#fef3c7" stroke="#92400e" strokeWidth="1.5" />
      <path d="M22 23 L30 15 L38 23 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M44 31 L44 20 M44 20 L50 24 L44 26" stroke="#ffffff" strokeWidth="2" fill="#fde047" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Sky Isles (docs/ISLES-PLAN.md): grow a floating island in the class's shared sky. Each turn the sky pilot asks a
 * maths question from the pupil's own focus (a right answer is a fair wind). Not ranked. Not in the hub yet: it joins
 * registry.ts behind `islesOn()` (./switch.ts) at go-live, and the teacher contract comes in stage S.6.
 */
export const skyIsles: GameDefinition = {
  id: 'isles',
  name: 'Sky Isles',
  tagline: 'Grow a floating island in your class’s sky!',
  colours: ['#0e6ba8', '#0f766e'],
  Icon: IslandIcon,
  Play: IslesPlay,
  ranked: false,
  noBots: true,
  group: 'complex-maths',
  useTeacherSwitch: useIslesEnabled,
};
