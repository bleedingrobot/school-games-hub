/**
 * "Moves left today" for the dashboard cards: the pupil's own daily allowances in the games that have them (Dragon Maths
 * forest, arena and master fights; Clan Quest mine fights; Maths Monsters battles; Diamond Drop's one new level a day; Star Trader jumps; Sky Isles turns). Read-only, through my_moves_left(). Any trouble just means no
 * line on the card, so the dashboard never waits for it or complains about it.
 */
import { levelsOpen, type Player } from '../../shared/diamond/progress';
import { nzDayNumber } from '../../shared/clans/clock';
import { MOST_TURNS_SAVED, TURNS_PER_DAY } from '../../shared/isles/config';
import { nzDate, rollDay } from '../../shared/lord/engine';
import type { Hero } from '../../shared/lord/types';
import { eggWarmth, isReady } from '../../shared/monsters/quests/eggs';
import type { Egg } from '../../shared/monsters/quests/types';
import { supabase } from '../lib/supabase';

export interface RawMovesLeft {
  lord: { day: string; forestLeft: number; arenaLeft: number; masterTried: boolean; masterExtra: number; forestPerDay: number; level?: number; exp?: number } | null;
  clans: { fightsLeft: number; perDay: number } | null;
  /** Battles counted today and the daily limit (battleCap.ts). Missing until 20261027000300 is applied. */
  monsters?: {
    today: number;
    perDay: number;
    /** The eggs carried, the play-day count and the last battle day, for the egg line (my_moves_left, from 20261103000100). */
    eggs?: Pick<Egg, 'species' | 'found' | 'warmed'>[];
    playDays?: number;
    lastDay?: string | null;
  } | null;
  /** The school's Clan Quest season clock (read with readClock). Missing until 20261029000700 is applied. */
  season?: unknown;
  /** The school's Dragon Maths season { start, on } (read with readLordSeason). Missing until 20261030000100 is applied. */
  lordSeason?: unknown;
  /** Diamond Drop's deepest level passed and the NZ date it was first passed. Missing until 20261102000300 is applied. */
  diamond?: { deepest: number; newLevelDate: string | null } | null;
  /** Star Trader's saved day number, jumps left on it, and the class's jumps a day. Missing until 20261102000300 is applied. */
  trader?: { day: number; jumpsLeft: number; perDay: number } | null;
  /** Sky Isles: the New Zealand day number the island was last saved on and the turns left then. Missing until 20261104000200 is applied. */
  isles?: { day: number; turnsLeft: number } | null;
}

/** One thing on a card: "🌲 7 forest fights". `empty` is for a used-up allowance, which is drawn quietly. */
export interface MoveChip {
  emoji: string;
  text: string;
  empty: boolean;
}

export interface CardMoves {
  chips: MoveChip[];
  /** Everything is used up for today. */
  allDone: boolean;
}

export type MovesByGame = Record<string, CardMoves>;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Turns what the database said into chips per game id. `now` is a parameter so tests can pick the day. */
export function movesFromRaw(raw: RawMovesLeft | null | undefined, now: Date = new Date()): MovesByGame {
  const out: MovesByGame = {};
  const lord = raw?.lord;
  if (lord && typeof lord.forestLeft === 'number') {
    // A hero who hasn't played yet today gets the new day's allowance when they next play, so show that.
    const hero = rollDay(
      { day: lord.day, forestLeft: lord.forestLeft, arenaLeft: lord.arenaLeft, masterTried: lord.masterTried, masterExtra: lord.masterExtra } as Hero,
      nzDate(now),
      lord.forestPerDay || undefined,
    );
    const masterTries = (hero.masterTried ? 0 : 1) + (hero.masterExtra ?? 0);
    const chips: MoveChip[] = [
      { emoji: '🌲', text: plural(hero.forestLeft, 'forest fight', 'forest fights'), empty: hero.forestLeft === 0 },
      { emoji: '🏟️', text: plural(hero.arenaLeft, 'arena fight', 'arena fights'), empty: hero.arenaLeft === 0 },
      { emoji: '🗡️', text: plural(masterTries, 'master try', 'master tries'), empty: masterTries === 0 },
    ];
    out['dragon-maths'] = { chips, allDone: chips.every((c) => c.empty) };
  }
  const clans = raw?.clans;
  if (clans && typeof clans.fightsLeft === 'number') {
    out['clan-quest'] = {
      chips: [{ emoji: '⛏️', text: `${clans.fightsLeft} of ${clans.perDay} mine fights`, empty: clans.fightsLeft === 0 }],
      allDone: clans.fightsLeft === 0,
    };
  }
  const monsters = raw?.monsters;
  if (monsters && typeof monsters.today === 'number') {
    const left = Math.max(monsters.perDay - monsters.today, 0);
    out.monsters = {
      chips: [{ emoji: '⚔️', text: `${left} of ${monsters.perDay} battles`, empty: left === 0 }],
      allDone: left === 0,
    };
    const eggs = monsters.eggs ?? [];
    if (eggs.length) {
      // A nudge to come back: an egg about to go cold comes first, then eggs ready to hatch.
      const ready = eggs.filter((e) => isReady(e as Egg, monsters.playDays ?? 0)).length;
      const warmth = eggWarmth({ eggs: eggs as Egg[], lastDay: monsters.lastDay ?? undefined }, nzDate(now));
      const chip: MoveChip | null = warmth === 'cooling'
        ? { emoji: '🥶', text: 'Battle today or your eggs go cold!', empty: false }
        : warmth === 'cold' ? null
        : ready ? { emoji: '🐣', text: `${plural(ready, 'egg', 'eggs')} ready to hatch!`, empty: false }
        : { emoji: '🥚', text: `${plural(eggs.length, 'egg', 'eggs')} warming`, empty: false };
      if (chip) out.monsters.chips.push(chip);
    }
  }
  const diamond = raw?.diamond;
  if (diamond && typeof diamond.deepest === 'number') {
    // One new level a day. Replays never run out, so the card never says "all done"; a pupil past level 10 gets no chip.
    const open = levelsOpen({ deepest: diamond.deepest, newLevelDate: diamond.newLevelDate } as Player, now);
    if (open.next !== null) {
      const chip: MoveChip = open.nextOpen
        ? { emoji: '⛏️', text: `New level ${open.next} ready`, empty: false }
        : { emoji: '⛏️', text: `Level ${open.next} opens tomorrow`, empty: true };
      out.diamond = { chips: [chip], allDone: false };
    }
  }
  const trader = raw?.trader;
  if (trader && typeof trader.jumpsLeft === 'number') {
    // A new day gives back the class's jumps a day when they next play (rollDay in shared/trader/server.ts).
    const left = trader.day < nzDayNumber(now.getTime()) ? trader.perDay : Math.max(trader.jumpsLeft, 0);
    out.trader = {
      chips: [{ emoji: '🚀', text: `${left} of ${trader.perDay} jumps`, empty: left === 0 }],
      allDone: left === 0,
    };
  }
  const isles = raw?.isles;
  if (isles && typeof isles.turnsLeft === 'number') {
    // Each later day adds TURNS_PER_DAY turns, up to MOST_TURNS_SAVED, when the pupil next plays.
    const today = nzDayNumber(now.getTime());
    const left = isles.day < today
      ? Math.min(MOST_TURNS_SAVED, isles.turnsLeft + TURNS_PER_DAY * (today - isles.day))
      : Math.max(isles.turnsLeft, 0);
    out.isles = {
      chips: [{ emoji: '🏝️', text: plural(left, 'turn', 'turns') + ' left', empty: left === 0 }],
      allDone: left === 0,
    };
  }
  return out;
}

/** The signed-in pupil's moves left, or nothing at all if it can't be read. */
export async function fetchMyMovesLeft(): Promise<MovesByGame> {
  try {
    const { data, error } = await supabase.rpc('my_moves_left');
    if (error || !data) return {};
    return movesFromRaw(data as RawMovesLeft);
  } catch {
    return {};
  }
}
