import { lazy } from 'react';
import type { GameDefinition } from '../types';

// Loaded only when someone opens the game, so the dashboard stays quick.
const ClanPlay = lazy(() => import('./ClanPlay').then((m) => ({ default: m.ClanPlay })));

function ClanIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 6 L54 14 V32 Q54 50 32 58 Q10 50 10 32 V14 Z" fill="currentColor" />
      <path d="M32 16 V48 M20 28 H44" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

/**
 * Clan Quest (docs/CLANS-PLAN.md): make a clan, go into the Mines, build an empire. Never ranked. The clan is kept by
 * the school's `clans` server function. Hidden from the dashboard until a teacher switches it on.
 */
export const clanQuest: GameDefinition = {
  id: 'clan-quest',
  name: 'Clan Quest',
  tagline: 'Build a clan, fight in the Mines and grow your empire!',
  colours: ['#7c2d12', '#1e3a8a'],
  Icon: ClanIcon,
  Play: ClanPlay,
  ranked: false,
  noBots: true,
};
