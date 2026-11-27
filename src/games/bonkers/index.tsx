import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { BONKERS_ABOUT, saveBonkersClassSwitch, useBonkersCells, useBonkersClassSwitch, useBonkersSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const BonkersPlay = lazy(() => import('./BonkersPlay').then((m) => ({ default: m.BonkersPlay })));

/** A wooden spoon and a star on a sunny sky: a drawn stand-in until the painted card (stage B.6). */
function BonkersIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#ffd34d" />
      <circle cx="44" cy="18" r="9" fill="#fff6c8" />
      <ellipse cx="24" cy="24" rx="10" ry="13" fill="#c9874a" transform="rotate(-35 24 24)" />
      <rect x="27" y="30" width="7" height="28" rx="3.5" fill="#a86a32" transform="rotate(-35 30 44)" />
      <text x="40" y="54" fontSize="18" textAnchor="middle">💥</text>
    </svg>
  );
}

/**
 * Bonkers Quest (docs/BONKERS-PLAN.md; id bonkers): a wacky, streamlined Dragon Maths for Years 2 to 4. One adventure a
 * school day on fixed rails: the Wobbly Inn, 1 of 2 quests, 4 to 6 fights where every hit is a maths question from the
 * pupil's own focus, the trainer when the star bar is full, the chest. The `bonkers` server function makes and marks every
 * question. Pupils see it only once `bonkersOn()` is true (stage B.5); until then teachers open `/#/bonkers` to test it.
 */
export const bonkersQuest: GameDefinition = {
  id: 'bonkers',
  name: 'Bonkers Quest',
  tagline: 'Smash monsters with maths',
  colours: ['#ffb347', '#e8573a'],
  Icon: BonkersIcon,
  Play: BonkersPlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  inDevelopment: true,
  teacherSwitch: true,
  teacher: {
    switch: { useValue: useBonkersClassSwitch, save: saveBonkersClassSwitch, about: BONKERS_ABOUT },
    useSummary: useBonkersSummary,
    progressColumns: { note: 'hero level', useCells: useBonkersCells },
  },
};

export { bonkersOn } from './switch';
