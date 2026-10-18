import { lazy } from 'react';
import type { GameDefinition } from '../types';

// Loaded only when someone opens the game, so the dashboard stays quick.
const LordPlay = lazy(() => import('./LordPlay').then((m) => ({ default: m.LordPlay })));

function DragonIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 46 Q14 22 30 20 Q34 10 46 12 L42 20 Q54 22 54 34 Q54 46 40 48 L30 54 L28 46 Z" fill="currentColor" />
      <circle cx="40" cy="26" r="2.6" fill="#fff" />
      <path d="M46 12 L52 4 L52 14 Z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/**
 * Dragon Maths (docs/LORD-PLAN.md): a Legend of the Red Dragon style game with daily forest fights, a
 * menu village, 12 masters and the Red Dragon. Maths helps you win. Never ranked. The hero is kept by the school's
 * `lord` server function (stage L.4); the card stays off the dashboard (DRAGON_MATHS_ON) until the teacher's
 * switch and stage L.5 are ready, though the page at /#/dragon-maths opens for teachers.
 */
export const dragonMaths: GameDefinition = {
  id: 'dragon-maths',
  name: 'Dragon Maths',
  tagline: 'Fight monsters, beat your masters and face the Red Dragon!',
  colours: ['#7f1d1d', '#1e1b4b'],
  Icon: DragonIcon,
  Play: LordPlay,
  ranked: false,
  noBots: true,
};
