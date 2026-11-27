import { useCallback, useEffect, useRef, useState } from 'react';
import { BACKS, loadChosenBack, loadSeenBacks, saveChosenBack, saveSeenBacks, unlockedBacks, type BackId, type EarnedAchievement } from './backs';

/** Reads the pupil's achievements (my_progress); missing in the preview, where every back is open for trying. */
export type LoadAchievements = () => Promise<EarnedAchievement[]>;

export interface CardBacks {
  /** The back to draw: the pupil's pick if it's unlocked, else Classic. */
  back: BackId;
  choose: (id: BackId) => void;
  unlocked: Set<BackId>;
  achievements: EarnedAchievement[];
  /** Unlocked backs the pupil hasn't looked at yet (the "New" dot). */
  unseen: BackId[];
  markSeen: () => void;
  /** Reads the achievements again (after a game) and returns backs unlocked since the last read. */
  refresh: () => Promise<BackId[]>;
}

const ALL = new Set(BACKS.map((b) => b.id));

export function useCardBacks(load?: LoadAchievements): CardBacks {
  const [chosen, setChosen] = useState<BackId>(loadChosenBack);
  const [unlocked, setUnlocked] = useState<Set<BackId>>(() => (load ? new Set<BackId>(['classic']) : ALL));
  const [achievements, setAchievements] = useState<EarnedAchievement[]>([]);
  const [seen, setSeen] = useState<Set<BackId>>(() => loadSeenBacks() ?? new Set<BackId>(['classic']));
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async (): Promise<BackId[]> => {
    const read = loadRef.current;
    if (!read) return [];
    let list: EarnedAchievement[];
    try {
      list = await read();
    } catch {
      return [];
    }
    const before = unlockedRef.current;
    const next = unlockedBacks(list);
    unlockedRef.current = next;
    setAchievements(list);
    setUnlocked(next);
    return [...next].filter((id) => !before.has(id));
  }, []);

  useEffect(() => {
    if (load) void refresh();
    // Only on opening: later reads are asked for (after a game).
  }, []);

  const choose = useCallback((id: BackId) => {
    setChosen(id);
    saveChosenBack(id);
  }, []);
  const markSeen = useCallback(() => {
    setSeen((old) => {
      const next = new Set([...old, ...unlockedRef.current]);
      saveSeenBacks(next);
      return next;
    });
  }, []);

  return {
    back: unlocked.has(chosen) ? chosen : 'classic',
    choose,
    unlocked,
    achievements,
    unseen: load ? [...unlocked].filter((id) => !seen.has(id)) : [],
    markSeen,
    refresh,
  };
}
