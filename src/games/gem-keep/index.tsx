import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { TEXT } from './strings';

// Loaded only when someone opens the game, so the dashboard stays quick.
const GemKeepPlay = lazy(() => import('./GemKeepPlay').then((m) => ({ default: m.GemKeepPlay })));

function GemKeepIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 56 V24 h8 v6 h7 v-6 h14 v6 h7 v-6 h8 V56 Z" fill="currentColor" opacity="0.55" />
      <path d="M32 6 L46 22 L32 44 L18 22 Z" fill="currentColor" />
      <path d="M18 22 H46 M32 6 L26 22 L32 44 L38 22 Z" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Gem Keep (Stage 11). Not in GAMES yet: until Phase 5 it's only at the hidden address
 * /#/gem-keep (see App.tsx), so it doesn't show on the dashboard, leaderboard or profile.
 */
export const gemKeep: GameDefinition = {
  id: 'gem-keep',
  name: TEXT.name,
  tagline: TEXT.tagline,
  colours: ['#4c2a9e', '#0e6f80'],
  Icon: GemKeepIcon,
  Play: GemKeepPlay,
  ranked: false,
};
