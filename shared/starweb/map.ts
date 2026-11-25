/**
 * Star Web solo's Star Map (docs/STARWEB-PLAN.md design 1): one star per times table 2 to 12, each at the best medal of a
 * sky that used it, and which known fact the next sky starts from. Pure, so the browser, the preview and the server agree.
 */
import { LEVELS, anchorOf, type Anchor } from '../classlive/stars';
import type { FactStats } from '../maths/leitner';
import { CREATURES, FREE_AFTER_LIT, GUIDE_ANCHOR, KNOWN_BOX, OWN_FACTS_FROM, RECENT_SKIP, TABLES, type Medal } from './config';

export interface Progress {
  /** Best medal per table ("2" to "12"); missing is 0. */
  tables: Record<string, Medal>;
  /** Star Map skies finished with every arm lit, gold ones, and counted stars found in them. */
  lit: number;
  gold: number;
  stars: number;
  /** Lit skies where no help was shown. */
  nohint: number;
  /** The last few known facts ("6x7"), so a new sky doesn't repeat them. */
  recent: string[];
  guideSeen: boolean;
}

export const emptyProgress = (): Progress => ({ tables: {}, lit: 0, gold: 0, stars: 0, nohint: 0, recent: [], guideSeen: false });

export const tableMedal = (p: Progress, t: number): Medal => (p.tables[String(t)] ?? 0) as Medal;
export const tablesLit = (p: Progress) => TABLES.filter((t) => tableMedal(p, t) >= 1).length;
export const goldTables = (p: Progress) => TABLES.filter((t) => tableMedal(p, t) >= 3).length;
export const creaturesOf = (p: Progress) => CREATURES.filter((c) => tablesLit(p) >= c.at);
export const freeOpen = (p: Progress) => p.lit >= FREE_AFTER_LIT;
export const anchorId = (a: Pick<Anchor, 'x' | 'y'>) => `${Math.min(a.x, a.y)}x${Math.max(a.x, a.y)}`;

export interface SkyDone {
  anchor: Anchor;
  medal: Medal;
  /** Counted stars (shared/starweb/sky.ts countedStars). */
  counted: number;
  hints: number;
  mode: 'map' | 'free';
}

/** The progress after a finished sky. A free sky changes nothing on the map (it's practice). */
export function progressAfter(p: Progress, done: SkyDone): Progress {
  if (done.mode === 'free' || done.medal === 0) return { ...p, guideSeen: true };
  const tables = { ...p.tables };
  for (const t of new Set([done.anchor.x, done.anchor.y])) {
    if ((TABLES as readonly number[]).includes(t) && done.medal > tableMedal(p, t)) tables[String(t)] = done.medal;
  }
  return {
    ...p,
    tables,
    lit: p.lit + 1,
    gold: p.gold + (done.medal === 3 ? 1 : 0),
    stars: p.stars + done.counted,
    nohint: p.nohint + (done.hints === 0 ? 1 : 0),
    guideSeen: true,
  };
}

/** Remembers a sky's known fact so the next few don't repeat it. */
export const withRecent = (p: Progress, a: Anchor): Progress => ({ ...p, recent: [anchorId(a), ...p.recent.filter((r) => r !== anchorId(a))].slice(0, RECENT_SKIP) });

const factOf = (key: string): [number, number] | null => {
  const m = /^mul:(\d+)x(\d+)$/.exec(key);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/**
 * The known fact for a new Star Map sky (James, 25 Nov 2026: from the times tables each pupil knows). From the pupil's
 * records: × facts from 2 × 3 to 12 × 12 (no squares), in the top two mastery boxes, with a table the class has on, not one
 * of the last few skies. Facts whose tables aren't gold yet come first. Fewer than 3 such facts: the class game's easy list.
 * Reads the records only; it never works out a pupil's level (docs/game-guide/4-maths.md rule 1).
 */
export function pickAnchor(p: Progress, facts: readonly FactStats[], enabledTables: readonly number[] | undefined, random: () => number): Anchor {
  if (!p.guideSeen && p.lit === 0) return { ...GUIDE_ANCHOR };
  const on = enabledTables && enabledTables.length ? new Set(enabledTables) : null;
  const known = facts.flatMap((f) => {
    const xy = f.box >= KNOWN_BOX ? factOf(f.key) : null;
    if (!xy) return [];
    const [a, b] = xy;
    if (!anchorOf(a, b) || (on && !on.has(a) && !on.has(b))) return [];
    return [[a, b] as [number, number]];
  });
  const pickFrom = (list: readonly (readonly [number, number])[]): Anchor => {
    const fresh = list.filter(([a, b]) => !p.recent.includes(anchorId({ x: a, y: b })));
    const pool = fresh.length ? fresh : list;
    const notGold = pool.filter(([a, b]) => tableMedal(p, a) < 3 || tableMedal(p, b) < 3);
    const from = notGold.length ? notGold : pool;
    const [a, b] = from[Math.floor(random() * from.length) % from.length];
    return random() < 0.5 ? { x: a, y: b, p: a * b } : { x: b, y: a, p: a * b };
  };
  return pickFrom(known.length >= OWN_FACTS_FROM ? known : LEVELS.small);
}
