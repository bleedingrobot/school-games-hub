/**
 * Card backs a pupil can unlock (docs/101-ART-PLAN.md "Card backs"). Each one is earned by an achievement the server
 * already awards, so the browser only chooses which unlocked back to show. The choice is remembered on this device.
 */
import { createContext, useContext } from 'react';

export type BackId =
  | 'classic'
  | 'seaglass'
  | 'pohutukawa'
  | 'koru'
  | 'kea'
  | 'paua'
  | 'matariki'
  | 'wave'
  | 'golden'
  | 'rockpool';

export interface BackInfo {
  id: BackId;
  name: string;
  /** The achievement that unlocks it (none for Classic). */
  needs?: { achievement: string; emoji: string; how: string };
}

export const BACKS: readonly BackInfo[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'seaglass', name: 'Sea Glass', needs: { achievement: '101-first-game', emoji: '🃏', how: 'Finish your first game of 101.' } },
  { id: 'pohutukawa', name: 'Pōhutukawa', needs: { achievement: '101-first-win', emoji: '🏆', how: 'Win a game of 101.' } },
  { id: 'koru', name: 'Koru', needs: { achievement: '101-ten-games', emoji: '🔟', how: 'Finish 10 games of 101.' } },
  { id: 'kea', name: 'Kea Feathers', needs: { achievement: '101-knock-win', emoji: '✊', how: 'Knock to end a round, and win it.' } },
  { id: 'paua', name: 'Pāua', needs: { achievement: '101-triples', emoji: '🎰', how: 'Get three cards of the same kind in your hand.' } },
  { id: 'matariki', name: 'Matariki', needs: { achievement: '101-perfect-zero', emoji: '0️⃣', how: 'Finish a round holding a hand worth exactly 0.' } },
  { id: 'wave', name: 'Big Wave', needs: { achievement: '101-saved-by-3', emoji: '3️⃣', how: 'Play a 3 to cancel a 10-point card.' } },
  { id: 'golden', name: 'Golden Crown', needs: { achievement: '101-classmates-win', emoji: '👫', how: 'Win a game of 101 against classmates.' } },
  { id: 'rockpool', name: 'Rock Pool', needs: { achievement: 'bond-first', emoji: '🦀', how: 'Finish a game of Bond Match.' } },
];

export const backInfo = (id: BackId): BackInfo => BACKS.find((b) => b.id === id) ?? BACKS[0];

/** What the server says about one achievement: earned, or how far along. */
export interface EarnedAchievement {
  id: string;
  earnedAt: string | null;
  progress?: number;
  goal?: number;
}

/** Which backs are open to this pupil: Classic always, the rest from earned achievements. */
export function unlockedBacks(achievements: readonly EarnedAchievement[]): Set<BackId> {
  const earned = new Set(achievements.filter((a) => a.earnedAt).map((a) => a.id));
  return new Set(BACKS.filter((b) => !b.needs || earned.has(b.needs.achievement)).map((b) => b.id));
}

/** "3 of 10" for a locked back whose achievement counts up, else null. */
export function progressFor(back: BackInfo, achievements: readonly EarnedAchievement[]): string | null {
  if (!back.needs) return null;
  const a = achievements.find((x) => x.id === back.needs!.achievement);
  if (!a || a.earnedAt || !a.goal || a.goal <= 1) return null;
  return `${Math.min(a.progress ?? 0, a.goal)} of ${a.goal}`;
}

const CHOSEN_KEY = 'sgh-101-back';
const SEEN_KEY = 'sgh-101-backs-seen';

export function loadChosenBack(): BackId {
  try {
    const id = localStorage.getItem(CHOSEN_KEY);
    return BACKS.some((b) => b.id === id) ? (id as BackId) : 'classic';
  } catch {
    return 'classic';
  }
}

export function saveChosenBack(id: BackId): void {
  try {
    localStorage.setItem(CHOSEN_KEY, id);
  } catch {
    // Storage blocked: the back just isn't remembered.
  }
}

/** Backs the pupil has already been shown as unlocked (so a new one gets its moment once). Null: never stored. */
export function loadSeenBacks(): Set<BackId> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw === null) return null;
    const list = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(list) ? (list.filter((id) => BACKS.some((b) => b.id === id)) as BackId[]) : []);
  } catch {
    return null;
  }
}

export function saveSeenBacks(ids: Iterable<BackId>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Storage blocked: the moment may show again.
  }
}

/** The back every face-down card on this screen uses (the pupil's own pick). */
export const CardBackContext = createContext<BackId>('classic');
export const useCardBack = () => useContext(CardBackContext);
