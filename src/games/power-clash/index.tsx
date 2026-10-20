import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { TEXT } from './text';

// Loaded only when someone opens the game, so the dashboard stays quick.
const PowerClashPage = lazy(() => import('./PowerClashPage').then((m) => ({ default: m.PowerClashPage })));

function PowerClashIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" fill="none" strokeLinecap="round" strokeWidth="5">
      <path d="M24 8v48M40 8v48M8 24h48M8 40h48" stroke="currentColor" opacity="0.5" strokeWidth="3" />
      <path d="M10 10l12 12M22 10L10 22" stroke="currentColor" />
      <circle cx="46" cy="46" r="8" stroke="currentColor" />
      <path d="M36 28l-5 10h6l-3 10" stroke="#fde047" strokeLinejoin="round" />
    </svg>
  );
}

/** Tic-Tac-Toe: Power Clash. Two players on one screen, or against a bot (saved for taking-part points); never ranked. */
export const powerClash: GameDefinition = {
  id: 'power-clash',
  name: TEXT.name,
  tagline: TEXT.tagline,
  colours: ['#2b1b6b', '#a3197c'],
  Icon: PowerClashIcon,
  Play: PowerClashPage,
  ranked: false,
  noBots: true,
  group: 'no-maths',
};
