import { lazy } from 'react';
import type { GameDefinition } from '../types';
import { saveLordEnabled } from '../../data/lord';
import { useLordEnabled } from './switch';
import { LORD_ABOUT, useLordClassSwitch, useLordSummary } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick.
const LordPlay = lazy(() => import('./LordPlay').then((m) => ({ default: m.LordPlay })));
const LordTeacherSettings = lazy(() => import('../../pages/TeacherLord').then((m) => ({ default: m.LordTeacherSettings })));
const LordStudentPanel = lazy(() => import('../../pages/TeacherLord').then((m) => ({ default: m.LordStudentPanel })));

/** A red dragon in profile, wings up, breathing fire. Drawn in its own colours so it stands out on the card. */
function DragonIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* fire */}
      <path d="M13 31 C7 29 4 33 1 32 C4 36 7 36 6 40 C10 38 13 40 15 36 Z" fill="#fbbf24" />
      <path d="M13 32 C9 31 7 34 5 33.5 C7 36 9 36 9 38 C11 37 13 38 14 36 Z" fill="#f97316" />
      {/* far wing */}
      <path d="M36 29 L44 4 Q46 14 50 11 Q52 20 57 19 Q56 29 50 34 Z" fill="#7f1d1d" />
      {/* tail */}
      <path d="M44 44 C54 46 58 54 62 52 C59 60 48 62 40 54 Z" fill="#dc2626" />
      <path d="M62 52 L63 47 L58 50 Z" fill="#fbbf24" />
      {/* body and neck */}
      <path d="M17 33 C22 27 30 28 36 32 C46 33 50 41 44 49 C38 54 28 52 26 44 C24 40 20 40 16 38 Z" fill="#ef4444" />
      <path d="M26 44 C28 52 38 54 44 49 C40 51 32 50 30 44 Z" fill="#fde68a" />
      {/* near wing */}
      <path d="M30 32 L21 6 Q26 12 29 9 Q31 17 36 15 Q37 22 42 22 Q42 30 36 36 Z" fill="#b91c1c" />
      <path d="M30 32 L21 6 M30 32 L29 9 M31 33 L36 15 M32 34 L42 22" stroke="#fca5a5" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {/* head */}
      <path d="M12 30 C12 24 17 21 22 22 L30 25 L22 31 L15 34 Z" fill="#ef4444" />
      <path d="M13 29 L14 33 L20 31 Z" fill="#fff" />
      {/* horns */}
      <path d="M22 22 L19 13 L26 21 Z" fill="#fde68a" />
      <path d="M27 24 L28 15 L31 25 Z" fill="#fbbf24" />
      {/* eye */}
      <circle cx="21" cy="26" r="2.4" fill="#fde047" />
      <ellipse cx="21.3" cy="26" rx="0.8" ry="1.8" fill="#1e1b4b" />
      <circle cx="14.5" cy="28" r="0.7" fill="#7f1d1d" />
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
  group: 'complex-maths',
  useTeacherSwitch: useLordEnabled,
  // The teacher's Games table: the on/off switch in the row, where the season is as its summary, and the school's season
  // box, forest fights, the topics and the class report in its Settings.
  teacher: {
    switch: { useValue: useLordClassSwitch, save: (on, classId) => saveLordEnabled(on, classId), about: LORD_ABOUT },
    useSummary: useLordSummary,
    Settings: LordTeacherSettings,
    StudentPanel: LordStudentPanel,
    studentSummary: (student) => import('../../pages/TeacherLord').then((m) => m.lordStudentSummary(student)),
    hardest: (classId) => import('../../pages/TeacherLord').then((m) => m.lordHardest(classId)),
    alerts: (classId) => import('../../pages/TeacherLord').then((m) => m.lordAlerts(classId)),
  },
};
