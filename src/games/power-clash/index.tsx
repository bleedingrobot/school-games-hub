import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { TEXT } from './text';

const PowerClashPlay = lazy(() => import('./PowerClashPlay').then((m) => ({ default: m.PowerClashPlay })));

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

/** Tic-Tac-Toe: Power Clash. Pass-and-play only so far (Stage P.2); never ranked. */
export const powerClash: GameDefinition = {
  id: 'power-clash',
  name: TEXT.name,
  tagline: TEXT.tagline,
  colours: ['#2b1b6b', '#a3197c'],
  Icon: PowerClashIcon,
  Play: PowerClashPlay,
  ranked: false,
  noBots: true,
};
