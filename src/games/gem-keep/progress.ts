/**
 * The student's campaign progress: best stars per level, and which Level Keys are passed
 * (a passed Level Key unlocks the next level). Phase 5 saves this to the database; until
 * then it's kept in this browser only.
 */
export interface LevelProgress {
  stars: number;
  keyPassed: boolean;
}

export type CampaignProgress = Record<string, LevelProgress>;

const STORAGE_KEY = 'sgh-gem-keep-progress';

export function loadProgress(): CampaignProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress: CampaignProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage blocked: progress lasts until the page is closed.
  }
}

/** Keeps the best stars for a level. */
export function withWin(progress: CampaignProgress, id: string, stars: number): CampaignProgress {
  const was = progress[id] ?? { stars: 0, keyPassed: false };
  return { ...progress, [id]: { ...was, stars: Math.max(was.stars, stars) } };
}

export function withKey(progress: CampaignProgress, id: string): CampaignProgress {
  const was = progress[id] ?? { stars: 0, keyPassed: false };
  return { ...progress, [id]: { ...was, keyPassed: true } };
}

/** Level 1 is always open; every other level opens when the one before's Level Key is passed. */
export function isUnlocked(progress: CampaignProgress, ids: string[], index: number): boolean {
  return index === 0 || !!progress[ids[index - 1]]?.keyPassed;
}

export const totalStars = (progress: CampaignProgress) => Object.values(progress).reduce((n, p) => n + p.stars, 0);
