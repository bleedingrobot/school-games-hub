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
  /** Mission Control maths, when the teacher lets students choose. */
  maths: boolean;
  bots: 1 | 2 | 3;
  /** Against bots, or pass-and-play (people taking turns on this device). */
  who: 'bots' | 'pass';
  /** Pass-and-play: how many people. */
  players: 2 | 3 | 4;
  /** Pass-and-play: the names typed in (blank means "Player 2" and so on). */
  names: string[];
}

/** The longest pass-and-play name. */
export const NAME_LENGTH = 14;

export const DEFAULT_PREFS: SpacePrefs = {
  board: 'nebula',
  galaxy: '',
  galaxySize: 100,
  mode: DEFAULT_SETTINGS.mode,
  finish: DEFAULT_SETTINGS.finish,
  rollAgainOnSix: DEFAULT_SETTINGS.rollAgainOnSix,
  cosmicEvents: DESIGNED_BOARDS.nebula.cosmicEvents,
  speed: 'normal',
  maths: true,
  bots: 3,
  who: 'bots',
  players: 2,
  names: ['', '', '', ''],
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
    maths: typeof saved.maths === 'boolean' ? saved.maths : d.maths,
    bots: pickOne(saved.bots, [1, 2, 3] as const, d.bots),
    who: pickOne(saved.who, ['bots', 'pass'] as const, d.who),
    players: pickOne(saved.players, [2, 3, 4] as const, d.players),
    names: d.names.map((blank, i) => {
      const name = Array.isArray(saved.names) ? saved.names[i] : undefined;
      return typeof name === 'string' ? name.slice(0, NAME_LENGTH) : blank;
    }),
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

/**
 * What the teacher allows (docs/SPACE-MATHS-PLAN.md section 3): 'off' (no maths), 'choose' (a
 * chip in settings) or 'on' (always). Whether a game has maths is this plus the student's chip.
 */
export type MathsMode = 'off' | 'choose' | 'on';

export const mathsOn = (mode: MathsMode, prefs: SpacePrefs) => mode === 'on' || (mode === 'choose' && prefs.maths);

/** The board and rules for a game from these choices, or a problem to show. */
export function setupFrom(prefs: SpacePrefs, mathsOn = false): { board: BoardChoice; settings: Settings } | { problem: string } {
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
      maths: mathsOn,
    },
  };
}

/** Pass-and-play names for each seat: what was typed, or the student's own name for the first, or "Player 2". */
export function passNames(prefs: SpacePrefs, firstName: string): string[] {
  return Array.from({ length: prefs.players }, (_, i) => {
    const typed = prefs.names[i]?.trim().replace(/\s+/g, ' ').slice(0, NAME_LENGTH);
    if (typed) return typed;
    return i === 0 ? firstName : `Player ${i + 1}`;
  });
}
