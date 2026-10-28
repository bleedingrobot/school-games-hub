import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { TEXT } from './strings';
import { useGemKeepSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const GemKeepPlay = lazy(() => import('./GemKeepPlay').then((m) => ({ default: m.GemKeepPlay })));
// Gem Keep's teacher parts bring the levels and maths code with them, so they load separately.
const GemKeepTeacherSettings = lazy(() => import('../../pages/TeacherGemKeep').then((m) => ({ default: m.GemKeepTeacherSettings })));
const GemKeepStudentPanel = lazy(() => import('../../pages/TeacherGemKeep').then((m) => ({ default: m.GemKeepStudentPanel })));

function GemKeepIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 56 V24 h8 v6 h7 v-6 h14 v6 h7 v-6 h8 V56 Z" fill="currentColor" opacity="0.55" />
      <path d="M32 6 L46 22 L32 44 L18 22 Z" fill="currentColor" />
      <path d="M18 22 H46 M32 6 L26 22 L32 44 L38 22 Z" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Gem Keep (Stage 11). On the dashboard for the class trial since 16 Oct 2026: progress is
 * kept on each device and it earns no points until Phase 5. Never ranked.
 */
export const gemKeep: GameDefinition = {
  id: 'gem-keep',
  name: TEXT.name,
  tagline: TEXT.tagline,
  colours: ['#4c2a9e', '#0e6f80'],
  Icon: GemKeepIcon,
  Play: GemKeepPlay,
  ranked: false,
  noBots: true,
  group: 'easy-maths',
  // The teacher's Games table: always on, so no switch; a summary of its settings in the Maths column; its settings and the
  // class report in its Settings.
  teacher: {
    useSummary: useGemKeepSummary,
    Settings: GemKeepTeacherSettings,
    StudentPanel: GemKeepStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherGemKeep').then((m) => m.gemKeepStudentSummary(student)),
  },
};
