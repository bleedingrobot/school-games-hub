/**
 * What a student can change while walking: the battle settings (Calm, number pad or choices)
 * plus the on-screen arrows for touch screens. Kept on this device, like Gem Keep's.
 */
import { loadMonsterSettings, saveMonsterSettings, type MonsterSettings } from '../settings';

export interface WorldSettings extends MonsterSettings {
  /** Show on-screen arrows and a Talk button (off unless asked for). */
  dpad: boolean;
  /**
   * Show the tips on the map: the "what next" line, the "tap the map to walk" line and the
   * "game is saved" line (on unless hidden; James, 27 Nov 2026: they cover the map on a phone).
   */
  tips: boolean;
}

const KEY = 'sgh-monsters-dpad';
const TIPS_KEY = 'sgh-monsters-tips';

export function loadWorldSettings(): WorldSettings {
  let dpad = false;
  let tips = true;
  try {
    dpad = localStorage.getItem(KEY) === '1';
    tips = localStorage.getItem(TIPS_KEY) !== '0';
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
  return { ...loadMonsterSettings(), dpad, tips };
}

export function saveWorldSettings(s: WorldSettings) {
  saveMonsterSettings({ calm: s.calm, multipleChoice: s.multipleChoice });
  try {
    localStorage.setItem(KEY, s.dpad ? '1' : '0');
    localStorage.setItem(TIPS_KEY, s.tips ? '1' : '0');
  } catch {
    // Storage blocked.
  }
}
