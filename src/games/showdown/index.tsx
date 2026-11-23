import { lazy } from 'react';
import { saveShowdownEnabled } from '../../data/showdown';
import type { GameDefinition } from '../types';
import { SHOWDOWN_ABOUT, useShowdownClassSwitch } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const ShowdownSettings = lazy(() => import('./Settings').then((m) => ({ default: m.ShowdownSettings })));
const ShowdownPage = lazy(() => import('./ShowdownPage').then((m) => ({ default: m.ShowdownPage })));

/** Crossed swords over a boss silhouette (two horns, two eyes). */
function ShowdownIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1b2a5e" />
      <path d="M32 12 C20 12 14 22 14 32 C14 42 20 52 32 52 C44 52 50 42 50 32 C50 22 44 12 32 12 Z" fill="#0b1236" />
      <path d="M16 20 L10 8 L24 14 Z M48 20 L54 8 L40 14 Z" fill="#0b1236" />
      <circle cx="25" cy="30" r="3" fill="#ffd23f" />
      <circle cx="39" cy="30" r="3" fill="#ffd23f" />
      <path d="M14 54 L48 14 M50 54 L16 14" stroke="#e8eef8" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 10 L52 18 M12 18 L20 10" stroke="#ffc83d" strokeWidth="4" strokeLinecap="round" />
      <path d="M13 56 L9 60 M51 56 L55 60" stroke="#ffc83d" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Class Showdown (docs/SHOWDOWN-PLAN.md; id showdown): a live maths battle for the whole class. The teacher runs it on the
 * projector (/teacher/showdown), pupils answer on their own device (/#/showdown?room=). In the hub only while `showdownOn()`
 * (./switch.ts) is true and the teacher has the game on for the class.
 */
export const showdown: GameDefinition = {
  id: 'showdown',
  name: 'Class Showdown',
  tagline: 'A live maths battle with the whole class',
  colours: ['#1e4f8f', '#5b2a86'],
  Icon: ShowdownIcon,
  Play: ShowdownPage,
  ranked: false,
  noBots: true,
  group: 'complex-maths',
  teacherSwitch: true,
  teacher: {
    switch: { useValue: useShowdownClassSwitch, save: saveShowdownEnabled, about: SHOWDOWN_ABOUT },
    Settings: ShowdownSettings,
  },
};
