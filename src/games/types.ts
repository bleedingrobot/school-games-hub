import type { ComponentType } from 'react';
import type { BotLevel } from '../../shared/botGame';
import type { FriendSession } from '../multiplayer/useFriendGame';

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
  /** The game's panels on the Teacher page (its switch, settings, class views). Make it lazy so the page stays quick. */
  TeacherPanels?: ComponentType;
  /** The game's part of one student's panel on the Teacher page. Lazy too. */
  StudentPanel?: ComponentType<{ student: string }>;
}

export type DashboardGroup = 'no-maths' | 'easy-maths' | 'complex-maths';

/** Games that count for leaderboards, rank badges and won/lost stats. */
export const isRanked = (game: GameDefinition) => game.ranked !== false;
