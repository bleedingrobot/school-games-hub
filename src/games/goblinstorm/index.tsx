import { lazy } from 'react';
import { saveGoblinStormEnabled } from '../../data/goblinstorm';
import type { GameDefinition } from '../types';
import { GOBLINSTORM_ABOUT, useGoblinStormCells, useGoblinStormClassSwitch, useGoblinStormSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const GoblinStormPlay = lazy(() => import('./GoblinStormPlay').then((m) => ({ default: m.GoblinStormPlay })));

/** A spinning blade ring round a little hero, with a goblin face peeking in. */
function GoblinStormIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#3b2a5c" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="6 5" />
      <path d="M32 6 L36 14 L28 14 Z M58 32 L50 36 L50 28 Z M32 58 L28 50 L36 50 Z M6 32 L14 28 L14 36 Z" fill="#fde68a" />
      <circle cx="32" cy="32" r="8" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="2" />
      <circle cx="50" cy="12" r="7" fill="#65a30d" />
      <circle cx="48" cy="11" r="1.5" fill="#fef08a" />
      <circle cx="52" cy="11" r="1.5" fill="#fef08a" />
    </svg>
  );
}

/**
 * Goblin Storm (docs/GOBLINSTORM-PLAN.md; id goblinstorm): steer a hero for 3 minutes while weapons fire by themselves;
 * every third level-up asks one question from the pupil's own focus. The `goblinstorm` server function makes and marks the
 * maths and replays every run. On the dashboard only while `goblinstormOn()` is true and the teacher has the game on for the
 * pupil's class (on for every class by default).
 */
export const goblinStorm: GameDefinition = {
  id: 'goblinstorm',
  name: 'Goblin Storm',
  tagline: 'Survive the goblin swarm: level up, evolve, wipe the screen',
  colours: ['#3b2a5c', '#7c2d12'],
  Icon: GoblinStormIcon,
  Play: GoblinStormPlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  teacherSwitch: true,
  // The teacher's Games table: the on/off switch in the row, "Follows focus" in the Maths column, and bosses beaten on the
  // Progress tab.
  teacher: {
    switch: { useValue: useGoblinStormClassSwitch, save: saveGoblinStormEnabled, about: GOBLINSTORM_ABOUT },
    useSummary: useGoblinStormSummary,
    progressColumns: { note: 'bosses beaten', useCells: useGoblinStormCells },
  },
};
