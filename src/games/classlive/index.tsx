import { lazy } from 'react';
import { saveClassLiveEnabled } from '../../data/classlive';
import type { GameDefinition } from '../types';
import { CLASSLIVE_ABOUT, useClassLiveClassSwitch } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const ClassLiveSettings = lazy(() => import('./Settings').then((m) => ({ default: m.ClassLiveSettings })));
const ClassLivePage = lazy(() => import('./ClassLivePage').then((m) => ({ default: m.ClassLivePage })));

/** A glowing star joined to smaller stars: a constellation over a night sky. */
function ClassLiveIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#140f3d" />
      <path d="M32 32 L14 16 M32 32 L50 14 M32 32 L52 44 M32 32 L16 50" stroke="#a5b4fc" strokeWidth="1.6" opacity="0.8" />
      <circle cx="14" cy="16" r="3" fill="#fcd34d" />
      <circle cx="50" cy="14" r="2.5" fill="#86efac" />
      <circle cx="52" cy="44" r="3" fill="#f9a8d4" />
      <circle cx="16" cy="50" r="2.5" fill="#7dd3fc" />
      <circle cx="32" cy="32" r="10" fill="#fde68a" opacity="0.25" />
      <path d="M32 23 L34.6 29.4 L41 32 L34.6 34.6 L32 41 L29.4 34.6 L23 32 L29.4 29.4 Z" fill="#fff7d1" />
    </svg>
  );
}

/**
 * Class Live (docs/CLASSLIVE-PLAN.md; id classlive): whole-class games for the big screen, starting with Star Web. The
 * teacher runs it on the projector (/teacher/classlive), pupils play on their own device (/#/classlive?room=). Pupils join
 * from the pop-up, so it has no home card. In the hub only while `classliveOn()` (./switch.ts) is true.
 */
export const classLive: GameDefinition = {
  id: 'classlive',
  name: 'Class Live',
  tagline: 'Whole-class games on the big screen',
  colours: ['#312e81', '#6d28d9'],
  Icon: ClassLiveIcon,
  Play: ClassLivePage,
  ranked: false,
  noBots: true,
  group: 'complex-maths',
  teacherSwitch: true,
  teacher: {
    switch: { useValue: useClassLiveClassSwitch, save: saveClassLiveEnabled, about: CLASSLIVE_ABOUT },
    Settings: ClassLiveSettings,
  },
};
