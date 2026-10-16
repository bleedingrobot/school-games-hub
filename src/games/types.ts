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
}

/** Games that count for leaderboards, rank badges and won/lost stats. */
export const isRanked = (game: GameDefinition) => game.ranked !== false;
