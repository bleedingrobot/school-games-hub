/**
 * Star Web solo's tuning numbers (docs/STARWEB-PLAN.md). The class game's rules (shared/classlive/stars.ts) are imported,
 * never changed; these are the solo game's own.
 */
import { SUPERNOVA } from '../classlive/stars';

/** Counted stars for a silver sky (every arm lit first). */
export const SILVER = 25;
/** Counted stars for gold: the supernova. */
export const GOLD = SUPERNOVA;
/** Wild links past this many still show but don't count towards silver and gold (so 42 + 1, 42 + 2 ... can't farm medals). */
export const WILD_CAP = 5;

export type Medal = 0 | 1 | 2 | 3;
export const MEDAL_NAMES: Record<Medal, string> = { 0: 'not lit yet', 1: 'bronze', 2: 'silver', 3: 'gold' };

/** Hub points for a finished sky by its medal (bronze 2, silver 3, gold 4), for the first skies of the NZ day. */
export const POINTS: Record<Exclude<Medal, 0>, number> = { 1: 2, 2: 3, 3: 4 };
export const POINT_SKIES_A_DAY = 5;

/** The Star Map's tables. */
export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
/** A new sky never repeats one of the pupil's last this-many known facts. */
export const RECENT_SKIP = 5;
/** Known facts (box 3 or 4, within the class's tables) a pupil needs before the sky follows their own records. */
export const OWN_FACTS_FROM = 3;
/** The mastery box a fact needs to be "known": answered right and quickly a few times. */
export const KNOWN_BOX = 3;

/** Line-art creatures join the Star Map at these many tables lit: the whale, the falcon, the dragon. */
export const CREATURES = [
  { at: 4, id: 'whale', name: 'the Star Whale' },
  { at: 8, id: 'falcon', name: 'the Star Falcon' },
  { at: 11, id: 'dragon', name: 'the Star Dragon' },
] as const;

/** Free sky (stage SW5): pick any × fact up to 12 × 12. Opens after this many lit skies. No points, no map. */
export const FREE_AFTER_LIT = 5;

/** The guided first sky's known fact (docs/STARWEB-PLAN.md design 7). */
export const GUIDE_ANCHOR = { x: 3, y: 4, p: 12 } as const;

/** The server keeps at most one new star a second between saves, plus this many (a burst after thinking). */
export const STAR_BURST = 3;
/** Tries one save may carry. */
export const MAX_TRIES_PER_SAVE = 40;
/** The browser saves after this many new stars, or this long after an unsaved one (ms). */
export const SAVE_EVERY_STARS = 4;
export const SAVE_EVERY_MS = 20_000;

/** No new star for this long (ms) brings the next rung of help: a nudge, then the numbers, then "Show me". */
export const STALL_MS = 20_000;
/** Wrong tries at the same fact before the working shows. */
export const WRONG_FOR_WORKING = 2;
