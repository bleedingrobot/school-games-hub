import type { GameDefinition } from './types';
import { chess } from './chess';
import { checkers } from './checkers';
import { space } from './space';
import { card101 } from './card101';
import { gemKeep } from './gem-keep';
import { powerClash } from './power-clash';

/**
 * Is Power Clash on the dashboard? The switch James flips when he's happy with it (it needs the
 * Power Clash database migration and the save-bot-game function applied first, see
 * docs/POWER-CLASH-PLAN.md). While it is false the game still works at /#/power-clash, but has no card.
 */
export const POWER_CLASH_ON = false;

/** Every game on the hub. To add a game: make a folder next to chess/, then add it here. */
export const GAMES: GameDefinition[] = [chess, checkers, space, card101, gemKeep, ...(POWER_CLASH_ON ? [powerClash] : [])];

/** Every game that can have saved games: the dashboard's, plus Power Clash even while its card is switched off. */
export const ALL_GAMES: GameDefinition[] = POWER_CLASH_ON ? GAMES : [...GAMES, powerClash];

/** A game's name for lists of saved games, even for Power Clash while its card is off. */
export const gameLabel = (id: string | undefined) => ALL_GAMES.find((game) => game.id === id)?.name;

export function findGame(id: string | undefined): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id);
}
