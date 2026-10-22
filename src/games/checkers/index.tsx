import { lazy } from 'react';
import type { GameDefinition } from '../types';

// Loaded only when someone opens the checkers page, so the dashboard stays quick.
const CheckersPlay = lazy(() => import('./CheckersPlay').then((m) => ({ default: m.CheckersPlay })));
const CheckersFriendGame = lazy(() => import('./CheckersFriendGame').then((m) => ({ default: m.CheckersFriendGame })));

function CheckersIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="44" rx="22" ry="9" fill="currentColor" opacity="0.55" />
      <ellipse cx="32" cy="38" rx="22" ry="9" fill="currentColor" />
      <ellipse cx="32" cy="28" rx="22" ry="9" fill="currentColor" opacity="0.55" />
      <ellipse cx="32" cy="22" rx="22" ry="9" fill="currentColor" />
      <ellipse cx="32" cy="22" rx="13" ry="5" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" />
    </svg>
  );
}

export const checkers: GameDefinition = {
  id: 'checkers',
  name: 'Checkers',
  tagline: 'Jump, capture, get crowned!',
  colours: ['#c2410c', '#be123c'],
  Icon: CheckersIcon,
  Play: CheckersPlay,
  Live: CheckersFriendGame,
  group: 'no-maths',
};
