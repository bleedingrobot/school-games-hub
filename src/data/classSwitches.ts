import { useEffect, useState } from 'react';
import { readSettings } from './classSettings';
import { gameSwitchColumn } from './settingsChanges';

/**
 * Every game's teacher switch from ONE settings read, so the home page's cards arrive together instead of one by one
 * (dashboard plan D5). Returns the ids of the games switched on, or null while loading. A game is on only when its column is
 * exactly true, the same rule as each game's own fetch*Enabled. A failed read counts as all off, like the old hooks.
 */
export function useClassSwitches(gameIds: string[]): Set<string> | null {
  const [on, setOn] = useState<Set<string> | null>(null);
  const key = gameIds.join(',');
  useEffect(() => {
    let current = true;
    const ids = key ? key.split(',') : [];
    readSettings(ids.map(gameSwitchColumn)).then(
      (row) => current && setOn(new Set(ids.filter((id) => (row as Record<string, unknown> | null)?.[gameSwitchColumn(id)] === true))),
      () => current && setOn(new Set()),
    );
    return () => {
      current = false;
    };
  }, [key]);
  return on;
}

/** What this device last showed on the home page, so a reload starts from the same cards (dashboard plan D5). */
export interface RememberedCards {
  /** Games whose teacher switch was on. */
  on: string[];
  /** The pupil's My games list (topGames). */
  mine: string[];
  classGames: string[];
}

const key = (me: string) => `home-cards:${me}`;

export function readRememberedCards(me: string | undefined): RememberedCards | null {
  if (!me) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(key(me)) ?? 'null') as Partial<RememberedCards> | null;
    if (!raw || !Array.isArray(raw.on)) return null;
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return { on: strings(raw.on), mine: strings(raw.mine), classGames: strings(raw.classGames) };
  } catch {
    return null;
  }
}

export function rememberCards(me: string | undefined, cards: RememberedCards): void {
  if (!me) return;
  try {
    localStorage.setItem(key(me), JSON.stringify(cards));
  } catch {
    // Private window or full storage: the page just starts without a memory next time.
  }
}
