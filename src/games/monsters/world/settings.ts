/**
 * What a student can change while walking: the battle settings (Calm, number pad or choices)
 * plus the on-screen arrows for touch screens. Kept on this device, like Gem Keep's.
 */
import { loadMonsterSettings, saveMonsterSettings, type MonsterSettings } from '../settings';

export interface WorldSettings extends MonsterSettings {
  /** Show on-screen arrows and a Talk button (off unless asked for). */
  dpad: boolean;
}

const KEY = 'sgh-monsters-dpad';

export function loadWorldSettings(): WorldSettings {
  let dpad = false;
  try {
    dpad = localStorage.getItem(KEY) === '1';
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
  return { ...loadMonsterSettings(), dpad };
}

export function saveWorldSettings(s: WorldSettings) {
  saveMonsterSettings({ calm: s.calm, multipleChoice: s.multipleChoice });
  try {
    localStorage.setItem(KEY, s.dpad ? '1' : '0');
  } catch {
    // Storage blocked.
  }
}
