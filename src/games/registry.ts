import type { GameDefinition } from './types';
import { chess } from './chess';
import { checkers } from './checkers';
import { space } from './space';

/** Every game on the hub. To add a game: make a folder next to chess/, then add it here. */
export const GAMES: GameDefinition[] = [chess, checkers, space];

export function findGame(id: string | undefined): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id);
}
