import { lazy } from 'react';
import type { GameDefinition } from '../types';

// Loaded only when someone opens the game, so the dashboard stays quick.
const MonstersPlay = lazy(() => import('./MonstersPlay').then((m) => ({ default: m.MonstersPlay })));

function MonstersIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 52 Q32 40 56 52 V58 H8 Z" fill="currentColor" opacity="0.55" />
      <ellipse cx="32" cy="32" rx="19" ry="17" fill="currentColor" />
      <path d="M17 19 L21 6 L28 16 M47 19 L43 6 L36 16" fill="currentColor" />
      <circle cx="25" cy="30" r="5" fill="#fff" />
      <circle cx="39" cy="30" r="5" fill="#fff" />
      <circle cx="26" cy="31" r="2.4" fill="#0f172a" />
      <circle cx="40" cy="31" r="2.4" fill="#0f172a" />
      <path d="M25 41 Q32 47 39 41" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Maths Monsters (docs/MONSTER-PLAN.md). Walk around, battle and catch monsters; every attack and catch
 * is a maths question. Never ranked. Hidden from the dashboard until a teacher switches it on.
 */
export const monsters: GameDefinition = {
  id: 'monsters',
  name: 'Maths Monsters',
  tagline: 'Walk, battle and catch monsters with maths!',
  colours: ['#166534', '#0e7490'],
  Icon: MonstersIcon,
  Play: MonstersPlay,
  ranked: false,
  noBots: true,
};
