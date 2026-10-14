import type { GameDefinition } from '../types';

function ChessIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="16" r="9" fill="currentColor" />
      <path d="M25 27h14l-2 4h-10z" fill="currentColor" />
      <path d="M27 31h10c0 8 2 14 6 18H21c4-4 6-10 6-18z" fill="currentColor" />
      <rect x="15" y="49" width="34" height="8" rx="4" fill="currentColor" />
    </svg>
  );
}

export const chess: GameDefinition = {
  id: 'chess',
  name: 'Chess',
  tagline: 'Outsmart the king!',
  colours: ['#5b3cc4', '#2f55c8'],
  Icon: ChessIcon,
};
