import { lazy } from 'react';
import { saveKingdomEnabled } from '../../data/kingdom';
import type { GameDefinition } from '../types';
import { useKingdomEnabled } from './switch';
import { KINGDOM_ABOUT, kingdomSummary, useKingdomClassSwitch } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const KingdomPlay = lazy(() => import('./KingdomPlay').then((m) => ({ default: m.KingdomPlay })));

/** A golden crown over a sheaf of wheat. */
function CrownIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* wheat */}
      <path d="M32 60 L32 34 M32 46 L24 36 M32 46 L40 36 M32 54 L22 44 M32 54 L42 44" stroke="#fde68a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="23" cy="35" rx="3" ry="5" fill="#fbbf24" transform="rotate(-40 23 35)" />
      <ellipse cx="41" cy="35" rx="3" ry="5" fill="#fbbf24" transform="rotate(40 41 35)" />
      <ellipse cx="21" cy="43" rx="3" ry="5" fill="#fbbf24" transform="rotate(-50 21 43)" />
      <ellipse cx="43" cy="43" rx="3" ry="5" fill="#fbbf24" transform="rotate(50 43 43)" />
      {/* crown */}
      <path d="M12 30 L10 10 L22 20 L32 6 L42 20 L54 10 L52 30 Z" fill="#facc15" stroke="#92400e" strokeWidth="2" strokeLinejoin="round" />
      <rect x="12" y="27" width="40" height="6" rx="2" fill="#eab308" stroke="#92400e" strokeWidth="2" />
      <circle cx="32" cy="18" r="3" fill="#dc2626" />
      <circle cx="21" cy="24" r="2.2" fill="#2563eb" />
      <circle cx="43" cy="24" r="2.2" fill="#16a34a" />
    </svg>
  );
}

/**
 * Kingdom Keeper (docs/KINGDOM-PLAN.md): Hamurabi with a council. Rule Riverstone for ten years; advisers ask maths from
 * each pupil's focus, and right answers win boons for the year. Not ranked. On the dashboard only while `kingdomOn()`
 * (./switch.ts) is true and the teacher has switched it on for the pupil's class.
 */
export const kingdomKeeper: GameDefinition = {
  id: 'kingdom',
  name: 'Kingdom Keeper',
  tagline: 'Rule Riverstone for ten years: feed your people, grow your city!',
  colours: ['#854d0e', '#1e3a5f'],
  Icon: CrownIcon,
  Play: KingdomPlay,
  ranked: false,
  noBots: true,
  group: 'complex-maths',
  useTeacherSwitch: useKingdomEnabled,
  // The teacher's Games table: the on/off switch in the row (the game and its points behind its "?"), "Follows focus" for its
  // maths, and nothing to open.
  teacher: {
    switch: { useValue: useKingdomClassSwitch, save: (on, classId) => saveKingdomEnabled(on, classId), about: KINGDOM_ABOUT },
    useSummary: kingdomSummary,
  },
};
