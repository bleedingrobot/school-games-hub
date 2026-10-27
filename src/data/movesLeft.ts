/**
 * "Moves left today" for the dashboard cards: the pupil's own daily allowances in the games that have them (Dragon Maths
 * forest, arena and master fights; Clan Quest mine fights; Maths Monsters battles). Read-only, through my_moves_left(). Any trouble just means no
 * line on the card, so the dashboard never waits for it or complains about it.
 */
import { nzDate, rollDay } from '../../shared/lord/engine';
import type { Hero } from '../../shared/lord/types';
import { supabase } from '../lib/supabase';

export interface RawMovesLeft {
  lord: { day: string; forestLeft: number; arenaLeft: number; masterTried: boolean; masterExtra: number; forestPerDay: number } | null;
  clans: { fightsLeft: number; perDay: number } | null;
  /** Battles counted today and the daily limit (battleCap.ts). Missing until 20261027000300 is applied. */
  monsters?: { today: number; perDay: number } | null;
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
