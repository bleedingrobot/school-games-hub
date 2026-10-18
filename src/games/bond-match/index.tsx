import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { TEXT } from './strings';

// Loaded only when someone opens the game, so the dashboard stays quick.
const BondMatchPlay = lazy(() => import('./BondMatchPlay').then((m) => ({ default: m.BondMatchPlay })));

function BondMatchIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="14" width="24" height="34" rx="5" fill="currentColor" opacity="0.55" transform="rotate(-8 18 31)" />
      <rect x="34" y="14" width="24" height="34" rx="5" fill="currentColor" transform="rotate(8 46 31)" />
      <path d="M13 28h10M18 23v10M41 31h10" stroke="rgba(0,0,0,0.35)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Bond Match (M.2). Written but NOT in src/games/registry.ts, so nothing in the live app can reach
 * it; adding it there is stage M.7. Never ranked, no bots yet.
 */
export const bondMatch: GameDefinition = {
  id: 'bond-match',
  name: TEXT.name,
  tagline: TEXT.tagline,
  colours: ['#0f766e', '#6d28d9'],
  Icon: BondMatchIcon,
  Play: BondMatchPlay,
  ranked: false,
  noBots: true,
};
