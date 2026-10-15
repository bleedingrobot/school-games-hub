/**
 * Names for Wormholes & Black Holes that pages outside the game need too (Recent games,
 * the teacher's view). Kept apart from the rules so those pages don't load the whole game.
 */
import type { BotLevel } from '../botGame';
import type { BoardChoice, DesignedBoardId } from './boards';

export const BOT_NAMES: Record<BotLevel, string> = {
  'very-easy': 'Cadet',
  easy: 'Pilot',
  medium: 'Commander',
};

export const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];

/** What a saved space game shows as its result: the place, or "Left" if they left early. */
export function placeLabel(place: number | null | undefined): string {
  return place ? (ORDINAL[place] ?? `${place}th`) : 'Left';
}

/** The designed boards' names (a test checks they match boards.ts). */
export const BOARD_NAMES: Record<DesignedBoardId, string> = {
  'inner-solar-system': 'Inner Solar System',
  nebula: 'Nebula',
  'deep-space': 'Deep Space',
  'asteroid-belt': 'Asteroid Belt',
};

/** The designed boards in the order they're offered (the same as boards.ts; a test checks). */
export const DESIGNED_BOARD_ORDER: readonly DesignedBoardId[] = ['inner-solar-system', 'nebula', 'deep-space', 'asteroid-belt'];

/** "Nebula", or "Random Galaxy Comet-Kiwi-48 (50 squares)". */
export function boardLabel(board: BoardChoice): string {
  if ('id' in board) return BOARD_NAMES[board.id] ?? 'A board';
  return `Random Galaxy ${board.galaxy}${board.size === 50 ? ' (50 squares)' : ''}`;
}

/** Rockets in a classmates game (the same as the rules engine's limits; a test checks). */
export const MIN_ROCKETS = 2;
export const MAX_ROCKETS = 4;
