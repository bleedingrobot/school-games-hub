/**
 * The painted scene on each home page game card (the Marble Rush course-card look, docs/HOME-ART-PLAN.md).
 *
 * To add a picture: put `<game-id>.webp` (about 1600 wide) and `<game-id>-small.webp` (about 800 wide) in
 * src/assets/home/, then add two import lines and one line in ART below. A game with no picture yet keeps a band of its
 * own card colours, so a new game never breaks the page.
 */

export interface GameCardArt {
  /** The big picture, for wide screens. */
  card: string;
  /** The smaller file: the card on narrow screens, and the Play button. */
  small: string;
  /** CSS background-position for the Play button strip (default 'center 65%'). */
  focus?: string;
}

/** One line per game that has a picture. */
const ART: Record<string, GameCardArt> = {};

export function gameCardArt(gameId: string): GameCardArt | undefined {
  return ART[gameId];
}
