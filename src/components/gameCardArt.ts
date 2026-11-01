/**
 * The painted scene on each home page game card (the Marble Rush course-card look, docs/HOME-ART-PLAN.md).
 *
 * To add a picture: put `<game-id>.webp` (about 1600 wide) and `<game-id>-small.webp` (about 800 wide) in
 * src/assets/home/, then add two import lines and one line in ART below. A game with no picture yet keeps a band of its
 * own card colours, so a new game never breaks the page.
 */
import chess from '../assets/home/chess.webp';
import chessSmall from '../assets/home/chess-small.webp';
import checkers from '../assets/home/checkers.webp';
import checkersSmall from '../assets/home/checkers-small.webp';
import g101 from '../assets/home/101.webp';
import g101Small from '../assets/home/101-small.webp';
import powerClash from '../assets/home/power-clash.webp';
import powerClashSmall from '../assets/home/power-clash-small.webp';
import space from '../assets/home/space.webp';
import spaceSmall from '../assets/home/space-small.webp';
import gemKeep from '../assets/home/gem-keep.webp';
import gemKeepSmall from '../assets/home/gem-keep-small.webp';
import bondMatch from '../assets/home/bond-match.webp';
import bondMatchSmall from '../assets/home/bond-match-small.webp';
import archery from '../assets/home/archery.webp';
import archerySmall from '../assets/home/archery-small.webp';
import mine from '../assets/home/mine.webp';
import mineSmall from '../assets/home/mine-small.webp';
import monsters from '../assets/home/monsters.webp';
import monstersSmall from '../assets/home/monsters-small.webp';
import dragonMaths from '../assets/home/dragon-maths.webp';
import dragonMathsSmall from '../assets/home/dragon-maths-small.webp';
import clanQuest from '../assets/home/clan-quest.webp';
import clanQuestSmall from '../assets/home/clan-quest-small.webp';
import kingdom from '../assets/home/kingdom.webp';
import kingdomSmall from '../assets/home/kingdom-small.webp';
import marble from '../assets/home/marble.webp';
import marbleSmall from '../assets/home/marble-small.webp';
import trader from '../assets/home/trader.webp';
import traderSmall from '../assets/home/trader-small.webp';

export interface GameCardArt {
  /** The big picture, for wide screens. */
  card: string;
  /** The smaller file: the card on narrow screens, and the Play button. */
  small: string;
  /** CSS background-position for the Play button strip (default 'center 65%'). */
  focus?: string;
}

/** One line per game that has a picture. */
const ART: Record<string, GameCardArt> = {
  'chess': { card: chess, small: chessSmall },
  'checkers': { card: checkers, small: checkersSmall, focus: 'center 75%' },
  '101': { card: g101, small: g101Small, focus: 'center 80%' },
  'power-clash': { card: powerClash, small: powerClashSmall },
  'space': { card: space, small: spaceSmall },
  'gem-keep': { card: gemKeep, small: gemKeepSmall },
  'bond-match': { card: bondMatch, small: bondMatchSmall },
  'archery': { card: archery, small: archerySmall },
  'mine': { card: mine, small: mineSmall },
  'monsters': { card: monsters, small: monstersSmall },
  'dragon-maths': { card: dragonMaths, small: dragonMathsSmall },
  'clan-quest': { card: clanQuest, small: clanQuestSmall },
  'kingdom': { card: kingdom, small: kingdomSmall },
  'marble': { card: marble, small: marbleSmall, focus: 'center 80%' },
  'trader': { card: trader, small: traderSmall, focus: 'center 55%' },
};

export function gameCardArt(gameId: string): GameCardArt | undefined {
  return ART[gameId];
}
