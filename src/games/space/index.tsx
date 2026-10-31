import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { setSpaceMaths } from '../../data/teacher';
import { SPACE_MATHS_ABOUT, useSpaceMaths } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const SpacePlay = lazy(() => import('./SpacePlay').then((m) => ({ default: m.SpacePlay })));
const SpaceTeacherSettings = lazy(() => import('../../pages/TeacherSpace').then((m) => ({ default: m.SpaceTeacherSettings })));

function SpaceIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="22" cy="44" rx="16" ry="7" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.55" />
      <circle cx="22" cy="44" r="5" fill="currentColor" opacity="0.55" />
      <path d="M40 6 C50 14 52 28 50 40 L36 40 C34 28 32 14 40 6 Z" fill="currentColor" />
      <path d="M36 32 L29 42 L36 40 Z M50 32 L57 42 L50 40 Z" fill="currentColor" />
      <circle cx="43" cy="22" r="4.5" fill="rgba(0,0,0,0.3)" />
      <path d="M39 42 Q43 56 47 42 Z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export const space: GameDefinition = {
  id: 'space',
  name: 'Wormholes & Black Holes',
  tagline: 'Race to the space station!',
  colours: ['#2b1d7a', '#0d5d8c'],
  Icon: SpaceIcon,
  Play: SpacePlay,
  ranked: false,
  group: 'easy-maths',
  // The teacher's Games table: the maths switch in the row (the server checks it too), reactions in the drawer.
  teacher: {
    maths: { useValue: useSpaceMaths, save: (mode, classId) => setSpaceMaths(mode, classId), about: SPACE_MATHS_ABOUT },
    Settings: SpaceTeacherSettings,
  },
};
