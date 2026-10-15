/**
 * The settings screen's choices, remembered on this device (like the sound switch), and
 * how they turn into a game setup.
 */
import type { BoardSize } from '../../../shared/space/board';
import { DESIGNED_BOARDS, isDesignedBoardId, type BoardChoice, type DesignedBoardId } from '../../../shared/space/boards';
import { DEFAULT_SETTINGS, type Finish, type Mode, type Settings } from '../../../shared/space/engine';
import { galaxyOfTheDay, parseGalaxyCode } from '../../../shared/space/galaxy';

export type Speed = 'relaxed' | 'normal' | 'zippy';
/** How long animations take compared with Normal. */
export const SPEED_SCALE: Record<Speed, number> = { relaxed: 1.5, normal: 1, zippy: 0.5 };

export interface SpacePrefs {
  board: DesignedBoardId | 'galaxy';
  galaxy: string;
  galaxySize: BoardSize;
  mode: Mode;
  finish: Finish;
  rollAgainOnSix: boolean;
  cosmicEvents: boolean;
  speed: Speed;
  bots: 1 | 2 | 3;
}

export const DEFAULT_PREFS: SpacePrefs = {
  board: 'nebula',
  galaxy: '',
  galaxySize: 100,
  mode: DEFAULT_SETTINGS.mode,
  finish: DEFAULT_SETTINGS.finish,
  rollAgainOnSix: DEFAULT_SETTINGS.rollAgainOnSix,
  cosmicEvents: DESIGNED_BOARDS.nebula.cosmicEvents,
  speed: 'normal',
  bots: 3,
};

const PREFS_KEY = 'sgh-space-settings';
const CALM_KEY = 'sgh-space-less-motion';

const pickOne = <T,>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

export function loadPrefs(): SpacePrefs {
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') ?? {};
  } catch {
    saved = {};
  }
  const d = DEFAULT_PREFS;
  return {
    board: saved.board === 'galaxy' || isDesignedBoardId(saved.board) ? saved.board : d.board,
    galaxy: typeof saved.galaxy === 'string' ? saved.galaxy.slice(0, 40) : d.galaxy,
    galaxySize: pickOne(saved.galaxySize, [100, 50] as const, d.galaxySize),
    mode: pickOne(saved.mode, ['cosmic', 'classic'] as const, d.mode),
    finish: pickOne(saved.finish, ['any', 'exact'] as const, d.finish),
    rollAgainOnSix: typeof saved.rollAgainOnSix === 'boolean' ? saved.rollAgainOnSix : d.rollAgainOnSix,
    cosmicEvents: typeof saved.cosmicEvents === 'boolean' ? saved.cosmicEvents : d.cosmicEvents,
    speed: pickOne(saved.speed, ['relaxed', 'normal', 'zippy'] as const, d.speed),
    bots: pickOne(saved.bots, [1, 2, 3] as const, d.bots),
  };
}

export function savePrefs(prefs: SpacePrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the settings just won't be remembered.
  }
}

/** "Less motion": on if the student switched it on here, or if their device asks for less motion. */
export function loadLessMotion(): boolean {
  try {
    const saved = localStorage.getItem(CALM_KEY);
    if (saved !== null) return saved === 'true';
  } catch {
    // Fall through to the device setting.
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function saveLessMotion(on: boolean) {
  try {
    localStorage.setItem(CALM_KEY, String(on));
  } catch {
    // Not remembered, but still works for this visit.
  }
}

export const todaysGalaxy = () => galaxyOfTheDay(new Date());

/** The board and rules for a game from these choices, or a problem to show. */
export function setupFrom(prefs: SpacePrefs): { board: BoardChoice; settings: Settings } | { problem: string } {
  let board: BoardChoice;
  if (prefs.board === 'galaxy') {
    const code = parseGalaxyCode(prefs.galaxy);
    if (!code) return { problem: 'That galaxy code doesn’t look right. It’s three parts, like Comet-Kiwi-48.' };
    board = { galaxy: code, size: prefs.galaxySize };
  } else {
    board = { id: prefs.board };
  }
  return {
    board,
    settings: {
      ...DEFAULT_SETTINGS,
      mode: prefs.mode,
      finish: prefs.finish,
      rollAgainOnSix: prefs.rollAgainOnSix,
      cosmicEvents: prefs.mode === 'cosmic' && prefs.cosmicEvents,
    },
  };
}
