/**
 * The painted scene on each home page game card (the Marble Rush course-card look, docs/HOME-ART-PLAN.md).
 *
 * To add a picture: drop `<game-id>.webp` (about 1600 wide) and `<game-id>-small.webp` (about 640 to 800 wide) into
 * src/assets/home/. They are found by name (dashboard plan D8); add a line to FOCUS only if the Play button's strip needs a
 * different crop. A game with no picture yet keeps a band of its own card colours, so a new game never breaks the page.
 */
const FILES = import.meta.glob<string>('../assets/home/*.webp', { eager: true, query: '?url', import: 'default' });

export interface GameCardArt {
  /** The big picture, for wide screens. */
  card: string;
  /** The smaller file: the card on narrow screens, and the Play button. */
  small: string;
  /** CSS background-position for the Play button strip (default 'center 65%'). */
  focus?: string;
}

/** Where the Play button's strip of the picture sits (CSS background-position); 'center 65%' when not listed. */
const FOCUS: Record<string, string> = {
  'checkers': 'center 75%',
  '101': 'center 80%',
  'decree': 'center 55%',
  'marble': 'center 80%',
  'trader': 'center 55%',
  'diamond': 'center 80%',
  'isles': 'center 50%',
  'beanstalk': 'center 45%',
  'hop': 'center 40%',
  'pipi': 'center 45%',
  'korora': 'center 45%',
  'weka': 'center 45%',
  'pigeon': 'center 45%',
  'parrot': 'center 45%',
  'robin': 'center 45%',
  'lizard': 'center 50%',
  'swamphen': 'center 45%',
  'tui': 'center 45%',
  'toonflap': 'center 45%',
  'training': 'center 50%',
  'quick-looks': 'center 50%',
};

/** Every picture, by the id in its file name. */
const ART: Record<string, GameCardArt> = {};
for (const [path, url] of Object.entries(FILES)) {
  const name = path.split('/').pop()!.replace(/\.webp$/, '');
  if (name.endsWith('-small')) continue;
  const small = FILES[`../assets/home/${name}-small.webp`];
  if (small) ART[name] = { card: url, small, ...(FOCUS[name] ? { focus: FOCUS[name] } : {}) };
}

export function gameCardArt(gameId: string): GameCardArt | undefined {
  return ART[gameId];
}

/** The ids that have a picture (for the art test). */
export const PAINTED_IDS = (): string[] => Object.keys(ART);
