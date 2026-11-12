/**
 * The trophy cabinet's plain rules (docs/plans/profile/PLAN.md card P5): which game a trophy belongs to, the shelf order,
 * the "next to win" spots, and the words for each win. No screens here, so they are easy to test.
 */
import type { MyTrophy, TrophyPair, TrophyType, TrophyWin } from '../data/trophies';
import { ALL_GAMES, GAMES } from '../games/registry';
import type { GameDefinition } from '../games/types';

/** How many favourites a pupil can pick (the server keeps to the same number). */
export const MAX_FAVOURITES = 3;
/** How many grey "next to win" spots the cabinet shows. */
export const NEXT_SHOWN = 3;

/** Trophy `game` codes that are a home card's art id rather than its page id. */
const SAME_GAME: Record<string, string> = { lord: 'dragon-maths', clans: 'clan-quest', card101: '101' };

/** The game a trophy belongs to, or undefined for a hub-wide one ('hub') or a game this page doesn't know. */
export function trophyGame(game: string): GameDefinition | undefined {
  const id = SAME_GAME[game] ?? game;
  return ALL_GAMES.find((g) => g.id === id);
}

/** Where a trophy was won: the game's name, 'Training' for facts training (not a game card), else 'Games Hub'. */
export function trophyPlace(game: string): string {
  return trophyGame(game)?.name ?? (game === 'training' ? 'Training' : 'Games Hub');
}

/** The shelf: favourites first (in the pupil's order), then the rest in the server's shelf order. */
export function shelfOrder(trophies: MyTrophy[], favourites: string[]): MyTrophy[] {
  const picked = favourites.flatMap((id) => trophies.filter((t) => t.id === id));
  return [...picked, ...trophies.filter((t) => !favourites.includes(t.id))];
}

/**
 * Up to three grey spots, from games the pupil can see: hub-wide trophies, games with no teacher switch, and switched games
 * the class has on. `switchedOn` is null while the class's switches load (switched games wait, so nothing flashes up).
 */
export function nextSpots(next: TrophyType[], switchedOn: ReadonlySet<string> | null): TrophyType[] {
  return next
    .filter((t) => {
      if (t.game === 'hub') return true;
      const game = trophyGame(t.game);
      if (!game) return false;
      if (!GAMES.includes(game)) return false;
      return !game.teacherSwitch || (switchedOn?.has(game.id) ?? false);
    })
    .slice(0, NEXT_SHOWN);
}

const DAY = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' });

/** One win in a child's words: "Season 2 · 14 Nov 2026", "2026", "Step 2 · 3 Nov 2026" or just the day. */
export function winLine(trophy: Pick<TrophyType, 'repeat'>, win: TrophyWin): string {
  const day = DAY.format(new Date(win.at));
  switch (trophy.repeat) {
    case 'season':
      return `Season ${win.season} · ${day}`;
    case 'year':
      return `${win.year} · ${day}`;
    case 'steps':
      return `Step ${win.season} · ${day}`;
    default:
      return day;
  }
}

/** What winning it again would do, for the trophy's plaque. Null when there is nothing more to say. */
export function nextMetalLine(trophy: MyTrophy, season: number): string | null {
  if (trophy.repeat === 'once') return null;
  if (trophy.repeat === 'steps') return trophy.tier === 'gold' ? 'Gold! You reached the top step.' : 'Keep going to reach the next step.';
  const when = trophy.repeat === 'season' ? 'season' : 'year';
  const wonThisTime = trophy.repeat === 'season' ? trophy.wins.some((w) => w.season === season) : trophy.wins.some((w) => w.year === new Date().getFullYear());
  if (trophy.tier === 'gold') return `Gold! Each new ${when} you win it adds one to the count.`;
  const metal = trophy.tier === 'bronze' ? 'silver' : 'gold';
  return wonThisTime ? `Win it again next ${when} to make it ${metal}.` : `Win it again this ${when} to make it ${metal}!`;
}

/** "Gold", "Silver ×2"... the metal and, from two wins, how many. */
export function metalLabel(trophy: { tier: string; count: number }): string {
  const metal = trophy.tier[0].toUpperCase() + trophy.tier.slice(1);
  return trophy.count > 1 ? `${metal} ×${trophy.count}` : metal;
}

/**
 * The half-lit two-game rewards: not won yet, one half held, and both games ones the pupil can see. The hint names the game
 * still to win in.
 */
export function halfLitPairs(pairs: TrophyPair[], switchedOn: ReadonlySet<string> | null): (TrophyPair & { hint: string })[] {
  const visible = (game: string) => nextSpots([{ id: game, game, name: '', how: '', kind: 'trophy', repeat: 'once', art: null }], switchedOn).length > 0;
  return pairs.flatMap((p) => {
    const held = p.halves.filter((h) => h.held);
    const missing = p.halves.find((h) => !h.held);
    if (p.won || held.length !== 1 || !missing || !p.halves.every((h) => visible(h.game))) return [];
    const when = p.within === 'season' ? 'this season' : 'this year';
    return [{ ...p, hint: `You have ${held[0].name}. Win ${missing.name} in ${trophyPlace(missing.game)} ${when} to light it up!` }];
  });
}
