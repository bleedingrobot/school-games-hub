import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { ORDERUP_ABOUT, orderUpAlerts, saveOrderUpEnabled, useOrderUpCells, useOrderUpClassSwitch, useOrderUpSummary } from './teacher';

// Loaded only when someone opens it.
const OrderUpPlay = lazy(() => import('./OrderUpPlay').then((m) => ({ default: m.OrderUpPlay })));
const OrderUpTeacherSettings = lazy(() => import('../../pages/TeacherOrderUp').then((m) => ({ default: m.OrderUpTeacherSettings })));

/** A take-away bag with a sum on it. */
function OrderUpIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#2b2724" />
      <path d="M14 18 L18 14 L22 18 L26 14 L30 18 L34 14 L38 18 L42 14 L46 18 L50 14 L50 54 Q50 56 48 56 L16 56 Q14 56 14 54 Z" fill="#c99a5e" />
      <text x="32" y="36" fontSize="11" fontWeight="900" textAnchor="middle" fill="#231f1c">4+3×5</text>
      <rect x="20" y="42" width="24" height="3" rx="1.5" fill="#3478c6" />
      <circle cx="50" cy="12" r="5" fill="#c8372d" />
    </svg>
  );
}

/**
 * Order Up! (docs/ORDERUP-PLAN.md; id orderup): the first Activity. Calm practice of the order of operations on take-away
 * bags. It has no `group`, so no home card: it is listed on the Activities page. Achievements only, no points.
 */
export const orderUp: GameDefinition = {
  id: 'orderup',
  name: 'Order Up!',
  tagline: 'Work out each take-away order in the right order',
  colours: ['#7a3b22', '#2b2724'],
  Icon: OrderUpIcon,
  Play: OrderUpPlay,
  ranked: false,
  noBots: true,
  activity: true,
  teacherSwitch: true,
  teacher: {
    switch: { useValue: useOrderUpClassSwitch, save: saveOrderUpEnabled, about: ORDERUP_ABOUT },
    useSummary: useOrderUpSummary,
    Settings: OrderUpTeacherSettings,
    alerts: orderUpAlerts,
    progressColumns: { note: 'level passed', useCells: useOrderUpCells },
  },
};
