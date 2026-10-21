import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { useArcheryEnabled } from './switch';

// Loaded only when someone opens the game, so the dashboard stays quick.
const ArcheryPlay = lazy(() => import('./ArcheryPlay').then((m) => ({ default: m.ArcheryPlay })));

/** A target with an arrow in the bull's eye. */
function ArcheryIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="28" cy="36" r="22" fill="currentColor" opacity="0.35" />
      <circle cx="28" cy="36" r="15" fill="currentColor" opacity="0.6" />
      <circle cx="28" cy="36" r="7" fill="#fde047" />
      <path d="M28 36 L56 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 6 L58 6 L58 14" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Archery Challenge (docs/ARCHERY-PLAN.md): Scorched Earth with archers. Earn coins in maths speed rounds, spend them
 * in the Armory on special arrows, shields and bows, then fight bots in four worlds. Not ranked. On the dashboard only
 * while `archeryOn()` (./switch.ts) is true and the teacher has switched it on for the pupil's class. Added to
 * src/games/registry.ts at the merge step.
 */
export const archeryChallenge: GameDefinition = {
  id: 'archery',
  name: 'Archery Challenge',
  tagline: 'Earn coins with maths, fill your quiver, and out-shoot the bots',
  colours: ['#9a3412', '#166534'],
  Icon: ArcheryIcon,
  Play: ArcheryPlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  useTeacherSwitch: useArcheryEnabled,
};
