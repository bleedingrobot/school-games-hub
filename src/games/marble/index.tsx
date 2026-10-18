import { lazy } from 'react';
import type { GameDefinition } from '../types';

// Loaded only when someone opens the game, so the dashboard stays quick.
const MarblePlay = lazy(() => import('./MarblePlay').then((m) => ({ default: m.MarblePlay })));

function MarbleIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 44 L30 56 L58 40 L34 28 Z" fill="currentColor" opacity="0.55" />
      <path d="M6 44 V36 L34 20 L58 32 V40 L34 28 L6 44" fill="currentColor" opacity="0.8" />
      <circle cx="30" cy="20" r="11" fill="currentColor" />
      <path d="M22 17 Q30 10 38 17" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Marble Rush (docs/MARBLE-PLAN.md): steer a marble down tracks against the clock. Never ranked for now;
 * it is on the dashboard only while `marbleOn()` (./switch.ts) is true.
 */
export const marbleRush: GameDefinition = {
  id: 'marble',
  name: 'Marble Rush',
  tagline: 'Roll your marble down the track against the clock',
  colours: ['#0e7490', '#7c3aed'],
  Icon: MarbleIcon,
  Play: MarblePlay,
  ranked: false,
  noBots: true,
};
