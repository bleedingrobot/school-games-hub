import { lazy } from 'react';
import type { GameDefinition } from '../types';

// Loaded only when someone opens the game, so the dashboard stays quick.
const Card101Play = lazy(() => import('./Card101Play').then((m) => ({ default: m.Card101Play })));

function Card101Icon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="8" y="12" width="28" height="40" rx="4" fill="currentColor" opacity="0.5" transform="rotate(-12 22 32)" />
      <rect x="24" y="10" width="30" height="42" rx="4" fill="currentColor" transform="rotate(8 39 31)" />
      <text x="40" y="38" textAnchor="middle" fontSize="13" fontWeight="900" fill="rgba(0,0,0,0.45)" transform="rotate(8 39 31)">
        101
      </text>
    </svg>
  );
}

export const card101: GameDefinition = {
  id: '101',
  name: '101',
  tagline: 'Lowest hand wins!',
  colours: ['#1e6b45', '#0f4a5c'],
  Icon: Card101Icon,
  Play: Card101Play,
  ranked: false,
};
