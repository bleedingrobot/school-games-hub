/**
 * What a student can change in Maths Monsters (kept on this device, like Gem Keep's settings):
 * Calm (no quick bonus, nothing timed) and how answers are given.
 */
export interface MonsterSettings {
  /** Calm: no quick-answer bonus and no hint about speed. */
  calm: boolean;
  /** Four choices to tap instead of the number pad. */
  multipleChoice: boolean;
}

export const DEFAULT_MONSTER_SETTINGS: MonsterSettings = { calm: false, multipleChoice: false };

const KEY = 'sgh-monsters-settings';

export function loadMonsterSettings(): MonsterSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      calm: typeof saved?.calm === 'boolean' ? saved.calm : DEFAULT_MONSTER_SETTINGS.calm,
      multipleChoice: typeof saved?.multipleChoice === 'boolean' ? saved.multipleChoice : DEFAULT_MONSTER_SETTINGS.multipleChoice,
    };
  } catch {
    return { ...DEFAULT_MONSTER_SETTINGS };
  }
}

export function saveMonsterSettings(settings: MonsterSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
}
