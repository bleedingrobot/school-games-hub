import type { GameDefinition } from './types';
import { chess } from './chess';
import { checkers } from './checkers';
import { space } from './space';
import { card101 } from './card101';
import { gemKeep } from './gem-keep';
import { monsters } from './monsters';
import { powerClash } from './power-clash';
import { dragonMaths } from './lord';
import { clanQuest } from './clans/game';
import { marbleRush } from './marble';
import { marbleOn } from './marble/switch';
import { bondMatch } from './bond-match';
import { BOND_MATCH_ON } from './bond-match/switch';

/**
 * Is Power Clash on the dashboard? The switch James flips when he's happy with it (it needs the
 * Power Clash database migration and the save-bot-game function applied first, see
 * docs/POWER-CLASH-PLAN.md). While it is false the game still works at /#/power-clash, but has no card.
 */
export const POWER_CLASH_ON = true;

/**
 * Is Dragon Maths on the dashboard? On since 18 Oct 2026 (James said go). The card still hides itself while the
 * teacher's switch (the Dragon Maths panel on the teacher page) is off. Turn this off to remove the card completely.
 */
export const DRAGON_MATHS_ON = true;

/**
 * Is Clan Quest on the dashboard? The card still hides itself while the teacher's switch (the Clan Quest panel on the
 * teacher page) is off, and the database starts with that switch off. Turn this off to remove the card completely.
 * Needs the clans migrations applied and the `clans` function deployed first (docs/CLANS-PLAN.md).
 */
export const CLAN_QUEST_ON = true;

/** Every game on the hub. To add a game: make a folder next to chess/, then add it here. */
export const GAMES: GameDefinition[] = [chess, checkers, space, card101, gemKeep, ...(POWER_CLASH_ON ? [powerClash] : []), monsters, ...(DRAGON_MATHS_ON ? [dragonMaths] : []), ...(CLAN_QUEST_ON ? [clanQuest] : []), ...(marbleOn() ? [marbleRush] : []), ...(BOND_MATCH_ON ? [bondMatch] : [])];

/** Every game that can have saved games: the dashboard's, plus Power Clash even while its card is switched off. */
export const ALL_GAMES: GameDefinition[] = [...GAMES, ...(POWER_CLASH_ON ? [] : [powerClash]), ...(DRAGON_MATHS_ON ? [] : [dragonMaths]), ...(CLAN_QUEST_ON ? [] : [clanQuest])];

/** A game's name for lists of saved games, even for Power Clash while its card is off. */
export const gameLabel = (id: string | undefined) => ALL_GAMES.find((game) => game.id === id)?.name;

export function findGame(id: string | undefined): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id);
}
