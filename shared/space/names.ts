/**
 * Names for Wormholes & Black Holes that pages outside the game need too (Recent games,
 * the teacher's view). Kept apart from the rules so those pages don't load the whole game.
 */
import type { BotLevel } from '../botGame';

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
