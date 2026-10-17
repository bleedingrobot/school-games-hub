import type { Hero } from '../../../shared/lord/types';

/**
 * The trial save: this browser only, until the server save (stage L.4) exists. Nothing here is the
 * real game record. Every read and write is wrapped, because storage can be blocked or full.
 */
export interface TrialSave {
  version: 1;
  hero: Hero | null;
  news: string[];
  /** Test tools: pretend this many days have passed. */
  dayOffset: number;
  riddleDay: string;
  guessDay: string;
  interestDay: string;
}

export const emptySave = (): TrialSave => ({ version: 1, hero: null, news: [], dayOffset: 0, riddleDay: '', guessDay: '', interestDay: '' });

const key = (player: string) => `dragon-maths:trial:${player || 'guest'}`;

export function loadTrial(player: string): TrialSave {
  try {
    const raw = window.localStorage.getItem(key(player));
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as Partial<TrialSave>;
    const hero = parsed.hero;
    const ok = hero && typeof hero.level === 'number' && typeof hero.hp === 'number' && typeof hero.gold === 'number' && typeof hero.heroClass === 'string';
    return { ...emptySave(), ...parsed, version: 1, hero: ok ? hero : null, news: Array.isArray(parsed.news) ? parsed.news.slice(0, 12) : [] };
  } catch {
    return emptySave();
  }
}

export function saveTrial(player: string, save: TrialSave): boolean {
  try {
    window.localStorage.setItem(key(player), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearTrial(player: string) {
  try {
    window.localStorage.removeItem(key(player));
  } catch {
    /* nothing to do */
  }
}
