/**
 * The Achievement Hall's rules (docs/ACHIEVEMENTS-PLAN.md, stage 2): which shelves come first, what each filter keeps,
 * the "Next up" three, and the words on a badge card. No React here, so the page and its tests share one set of rules.
 */
import type { Achievement } from '../data/progress';
import { findGame, gameLabel } from '../games/registry';

export type HallFilter = 'all' | 'earned' | 'nearly' | 'not-started';

export const FILTERS: { id: HallFilter; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'earned', label: 'Earned', emoji: '🏅' },
  { id: 'nearly', label: 'Nearly there', emoji: '🔥' },
  { id: 'not-started', label: 'Not started', emoji: '🌱' },
];

export interface Shelf {
  /** The game id (or "homework", "quests"). */
  id: string;
  name: string;
  achievements: Achievement[];
  earned: number;
  /** Where its Play button goes, or null when there is nowhere to play it. */
  playTo: string;
  playLabel: string;
}

/** How far along, 0 to 1 (earned is always 1). */
export function share(a: Achievement): number {
  if (a.earnedAt) return 1;
  return a.goal > 0 ? Math.min(1, Math.max(0, a.progress / a.goal)) : 0;
}

export function matches(a: Achievement, filter: HallFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'earned') return a.earnedAt !== null;
  if (filter === 'nearly') return !a.earnedAt && a.progress > 0;
  return !a.earnedAt && a.progress <= 0;
}

/**
 * One shelf per game, played-most first: the pupil's most played games of the last 14 days (my_home_page's topGames),
 * then games with anything earned or started (most earned first), then untouched games in the home page's order.
 * Within a shelf, the database's own order (easy to hard).
 */
export function shelvesOf(all: Achievement[], playedMost: string[]): Shelf[] {
  const byGame = new Map<string, Achievement[]>();
  for (const a of all) byGame.set(a.game, [...(byGame.get(a.game) ?? []), a]);
  const shelves = [...byGame].map(([id, achievements], order): Shelf & { order: number; started: number } => {
    const game = findGame(id);
    return {
      id,
      name: gameLabel(id) ?? id,
      achievements,
      earned: achievements.filter((a) => a.earnedAt).length,
      started: achievements.reduce((sum, a) => sum + share(a), 0),
      // Homework and class quests are earned from the home page; a game opens its own page.
      playTo: game ? `/${game.id}` : '/',
      playLabel: game ? `Play ${game.name}` : id === 'quests' ? 'See this week’s quest' : 'Go to my games',
      order,
    };
  });
  const rank = (id: string) => {
    const i = playedMost.indexOf(id);
    return i < 0 ? Infinity : i;
  };
  return shelves
    .sort((a, b) => rank(a.id) - rank(b.id) || Number(b.started > 0) - Number(a.started > 0) || b.earned - a.earned || b.started - a.started || a.order - b.order)
    .map(({ order: _o, started: _s, ...shelf }) => shelf);
}

/** The three closest to being earned (easiest first when there's a tie, so a new pupil sees a bronze to chase). */
export function nextUp(all: Achievement[], count = 3): Achievement[] {
  return all
    .filter((a) => !a.earnedAt)
    .sort((a, b) => share(b) - share(a) || (a.tier ?? 2) - (b.tier ?? 2))
    .slice(0, count);
}

/** "7 of 10", or for a badge or a one-off: "Not yet" / "Earned". */
export function progressWords(a: Achievement): string {
  if (a.measure === 'rank' || a.goal <= 1) return a.earnedAt ? 'Earned' : 'Not yet';
  return `${a.earnedAt ? a.goal : Math.min(a.progress, a.goal)} of ${a.goal}`;
}

/** "Earned on Tuesday 12 November" in New Zealand time (with the year when it isn't this year). */
export function earnedWords(iso: string, now = new Date()): string {
  const parts = (date: Date) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        .formatToParts(date)
        .map((p) => [p.type, p.value]),
    );
  const d = parts(new Date(iso));
  const thisYear = parts(now).year;
  return `Earned on ${d.weekday} ${d.day} ${d.month}${d.year === thisYear ? '' : ` ${d.year}`}`;
}

/** The filter and game picked last time on this device (a shared iPad forgets nothing worse than a filter). */
const KEY = 'achievement-hall';

export function readChoice(): { filter: HallFilter; game: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { filter?: string; game?: string };
    const filter = FILTERS.some((f) => f.id === saved.filter) ? (saved.filter as HallFilter) : 'all';
    return { filter, game: typeof saved.game === 'string' ? saved.game : '' };
  } catch {
    return { filter: 'all', game: '' };
  }
}

export function saveChoice(choice: { filter: HallFilter; game: string }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Private browsing or full storage: the Hall just opens on All next time.
  }
}
