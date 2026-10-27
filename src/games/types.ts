import type { ComponentType } from 'react';
import type { BotLevel } from '../../shared/botGame';
import type { FriendSession } from '../multiplayer/useFriendGame';
import type { MathsSwitch } from '../../shared/space/mathsSwitch';

export type { BotLevel };

export const BOT_LEVELS: { id: BotLevel; label: string; hint: string }[] = [
  { id: 'very-easy', label: 'Very Easy', hint: 'Makes lots of mistakes' },
  { id: 'easy', label: 'Easy', hint: 'Plays OK, misses things' },
  { id: 'medium', label: 'Medium', hint: 'A real challenge' },
];

export function isBotLevel(value: string | null): value is BotLevel {
  return BOT_LEVELS.some((level) => level.id === value);
}

/** Everything the hub needs to know about one game. Add a folder + one line in registry.ts. */
export interface GameDefinition {
  id: string;
  name: string;
  tagline: string;
  /** Card colours: a two-stop gradient that keeps white text readable. */
  colours: [string, string];
  Icon: ComponentType<{ size?: number }>;
  /** The game itself, played against a bot. Games without one show "Coming soon". */
  Play?: ComponentType<{ level: BotLevel }>;
  /** The game against another student, refereed by the server. */
  Live?: ComponentType<{ session: FriendSession }>;
  /**
   * False for games of luck (Wormholes & Black Holes): they never appear on leaderboards,
   * rank badges or the won/lost tables. Leave it out for chess-like games.
   */
  ranked?: boolean;
  /** True for games with no bots to pick (Gem Keep): the card just says "Play". */
  noBots?: boolean;
  /** Where the dashboard lists the game (in GAMES order within a group). A game without one has no dashboard card. */
  group?: DashboardGroup;
  /**
   * The teacher's on/off switch for the pupil's class, as a React hook: true shows the card, false or null (still
   * loading) hides it. Leave it out for a game that is always on. The dashboard calls it for every game in GAMES.
   */
  useTeacherSwitch?: () => boolean | null;
  /**
   * The game on the teacher's Games table and student page (docs/TEACHER-VIEW-PLAN.md, section 6). A game that has moved to
   * this leaves out TeacherPanels and StudentPanel below.
   */
  teacher?: TeacherContract;
  /** Old way, until every game has moved to `teacher`: the game's panels, shown in the Games table's drawer. Lazy. */
  TeacherPanels?: ComponentType;
  /** Old way too: the game's part of one student's panel on the Teacher page. Lazy too. */
  StudentPanel?: ComponentType<{ student: string }>;
  /** Season resets for the "Seasons and end of year" part at the bottom of the Teacher page, away from the everyday switches. Lazy too. */
  SeasonPanels?: ComponentType;
}

/** A class's value as a teacher control needs it: null while loading, and whether it couldn't be read. */
export interface Loaded<T> {
  value: T | null;
  failed: boolean;
}

/**
 * How a game plugs into the teacher area. The hub draws the row and the drawer; the game's own files say what is in them. Every
 * part is given the class from the teacher header. The `use…` parts are React hooks, called on every Games table row, so keep
 * them light (one request); `Settings` and `StudentPanel` should be lazy.
 */
export interface TeacherContract {
  /** The on/off switch for the class (the On column). Leave it out for a game that is always on. */
  switch?: {
    useValue(classId: string): Loaded<boolean>;
    save(on: boolean, classId: string): Promise<void>;
    /** One line on what On means, behind the switch's "?". */
    about?: string;
  };
  /** The 3-way maths switch for the class (the Maths column). */
  maths?: {
    useValue(classId: string): Loaded<MathsSwitch>;
    save(mode: MathsSwitch, classId: string): Promise<void>;
    about?: string;
  };
  /** One line for the Maths column when there is no maths switch ("4 of 6 topics"). Null while loading. */
  useSummary?(classId: string): string | null;
  /** The drawer (or, on a narrow screen, the sub-page): the game's settings and class report for this class. Lazy. */
  Settings?: ComponentType<{ classId: string }>;
  /** The student page, Games section. Lazy, loaded only when opened. */
  StudentPanel?: ComponentType<{ student: string }>;
  /** One line for the student's folded Games row ("14 of 30 stars"), or null for nothing to say. */
  studentSummary?(student: string): Promise<string | null>;
}

export type DashboardGroup = 'no-maths' | 'easy-maths' | 'complex-maths';

/** Games that count for leaderboards, rank badges and won/lost stats. */
export const isRanked = (game: GameDefinition) => game.ranked !== false;
