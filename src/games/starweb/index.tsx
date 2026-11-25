import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { saveStarWebClassSwitch, STARWEB_ABOUT, starwebHardest, useStarWebCells, useStarWebClassSwitch, useStarWebSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const StarWebPlay = lazy(() => import('./StarWebPlay').then((m) => ({ default: m.StarWebPlay })));

/** A glowing fact in a night sky with seven coloured arms. */
function StarWebIcon({ size = 64 }: { size?: number }) {
  const arms = ['#7dd3fc', '#c4b5fd', '#fcd34d', '#f9a8d4', '#86efac', '#fdba74', '#e2e8f0'];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#141450" />
      {arms.map((c, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
        const x = 32 + Math.cos(a) * 22;
        const y = 32 + Math.sin(a) * 22;
        return (
          <g key={c}>
            <line x1="32" y1="32" x2={x} y2={y} stroke={c} strokeWidth="2" opacity="0.8" />
            <circle cx={x} cy={y} r="3.2" fill={c} />
          </g>
        );
      })}
      <circle cx="32" cy="32" r="7" fill="#ffd54a" />
      <circle cx="32" cy="32" r="3.5" fill="#fffbe6" />
    </svg>
  );
}

/**
 * Star Web solo (docs/STARWEB-PLAN.md; id starweb): one known times fact glows in the night sky and the pupil types the facts
 * it unlocks, lighting the seven arms; each lit sky lights two tables on their Star Map. The `starweb` server function picks
 * the known fact from the pupil's own times-table records and re-checks every star. On the dashboard only while `starwebOn()`
 * is true and the teacher has the game on for the pupil's class.
 */
export const starWeb: GameDefinition = {
  id: 'starweb',
  name: 'Star Web',
  tagline: 'Light up your Star Map',
  colours: ['#2b2a8a', '#0b0b3a'],
  Icon: StarWebIcon,
  Play: StarWebPlay,
  ranked: false,
  noBots: true,
  group: 'complex-maths',
  inDevelopment: true,
  teacherSwitch: true,
  teacher: {
    switch: { useValue: useStarWebClassSwitch, save: saveStarWebClassSwitch, about: STARWEB_ABOUT },
    useSummary: useStarWebSummary,
    progressColumns: { note: 'tables lit', useCells: useStarWebCells },
    hardest: starwebHardest,
  },
};

export { starwebOn } from './switch';
