/**
 * Real-life Four Corners (Class Live `jail`, docs/JAIL-PLAN.md): the class plays Four Corners for real in the room. The
 * big screen runs the countdown and the dice; a few shared iPads are "jail stations". A pupil who is out taps their own
 * name on any station (no sign-in), answers `need` questions right (not in a row), and the big screen flashes their name:
 * back in the game.
 *
 * Pure rules: the server (jailServer.ts) loads the room, calls these and saves.
 */
import { MAPS, type CornerMap } from './corners';
import type { MingleLevel } from './mingle';

/** How many right answers get you out of jail (the teacher's choice). */
export const NEEDS = [3, 5, 10] as const;
export type Need = (typeof NEEDS)[number];
export const DEFAULT_NEED: Need = 5;
/** One answer at a time per pupil. */
export const ANSWER_GAP_MS = 600;
/** The most names a class list holds (as MAX_PLAYERS). */
export const ROSTER_MAX = 40;

export interface RosterPupil {
  id: string;
  name: string;
}

export interface JailMine {
  /** In jail since this session time (ms), or null. */
  inAt: number | null;
  /** Right answers this time in jail. */
  right: number;
  /** Every answer, right or wrong, this game (seeds the next question). */
  answered: number;
  /** All right answers this game. */
  rightAll: number;
  wrong: number;
  /** Times back in the game. */
  backs: number;
  /** Times sent to jail. */
  outs: number;
  /** Last answer (session ms). */
  lastAt: number;
}

export interface JailGame {
  kind: 'jail';
  /** The painted map the big screen starts on (the teacher can change it there). */
  map: CornerMap;
  need: Need;
  /** The class list, made on the server when the room opens. Names as the hub shows them (liveNames). */
  roster: RosterPupil[];
  mine: Record<string, JailMine>;
  /** Everyone back in so far, newest last (session ms). */
  backs: { id: string; t: number }[];
  /**
   * Maths Mingle (docs/MINGLE-PLAN.md) uses these same station rules with its own big screen: pupils left out of a group
   * answer their way back in. Absent for Real-life Four Corners.
   */
  mode?: 'mingle';
  /** Maths Mingle: the group calls' level, and whether silly twists come up. */
  level?: MingleLevel;
  twists?: boolean;
}

export type JailEvent =
  | { type: 'jail_in'; t: number; pupil: string }
  | { type: 'jail_back'; t: number; pupil: string }
  /** "Not you?": the name came off the jail list without answering. */
  | { type: 'jail_undo'; t: number; pupil: string };

export const needOf = (v: unknown): Need => (NEEDS as readonly number[]).includes(v as number) ? (v as Need) : DEFAULT_NEED;
export const mapOf = (v: unknown, random: () => number): CornerMap =>
  MAPS.find((m) => m === v) ?? MAPS[Math.floor(random() * MAPS.length) % MAPS.length];

export function newJail(map: CornerMap, need: Need, roster: RosterPupil[] = [], mingle?: { level: MingleLevel; twists: boolean }): JailGame {
  return { kind: 'jail', map, need, roster: roster.slice(0, ROSTER_MAX), mine: {}, backs: [], ...(mingle ? { mode: 'mingle' as const, level: mingle.level, twists: mingle.twists } : {}) };
}

export const freshJailMine = (): JailMine => ({ inAt: null, right: 0, answered: 0, rightAll: 0, wrong: 0, backs: 0, outs: 0, lastAt: -Infinity });

const mineOf = (g: JailGame, id: string) => (g.mine[id] ??= freshJailMine());

export const onRoster = (g: JailGame, id: unknown): id is string => typeof id === 'string' && g.roster.some((p) => p.id === id);

/** Who is in jail now, first in first. */
export const jailed = (g: JailGame) =>
  Object.entries(g.mine).filter(([, m]) => m.inAt !== null).sort((a, b) => (a[1].inAt as number) - (b[1].inAt as number)).map(([id]) => id);

/** A pupil tapped their name on a station: into jail (already in: nothing changes, they carry on where they were). */
export function goIn(g: JailGame, id: string, t: number): JailEvent[] {
  const m = mineOf(g, id);
  if (m.inAt !== null) return [];
  m.inAt = t;
  m.right = 0;
  m.outs += 1;
  return [{ type: 'jail_in', t, pupil: id }];
}

/** "Not you?": off the jail list, no flash. */
export function undo(g: JailGame, id: string, t: number): JailEvent[] {
  const m = g.mine[id];
  if (!m || m.inAt === null) return [];
  m.inAt = null;
  m.right = 0;
  m.outs = Math.max(0, m.outs - 1);
  return [{ type: 'jail_undo', t, pupil: id }];
}

/** The teacher let someone out from the big screen (no flash, no comeback counted). */
export const release = undo;

export type AnswerOut = { ok: true; back: boolean; events: JailEvent[] } | { ok: false; reason: 'not_in' | 'too_soon' };

/** A marked answer from a pupil in jail. `need` right answers (not in a row) and they're back in. */
export function answer(g: JailGame, id: string, right: boolean, t: number): AnswerOut {
  const m = g.mine[id];
  if (!m || m.inAt === null) return { ok: false, reason: 'not_in' };
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered += 1;
  if (!right) {
    m.wrong += 1;
    return { ok: true, back: false, events: [] };
  }
  m.right += 1;
  m.rightAll += 1;
  if (m.right < g.need) return { ok: true, back: false, events: [] };
  m.inAt = null;
  m.right = 0;
  m.backs += 1;
  g.backs.push({ id, t });
  if (g.backs.length > 200) g.backs.splice(0, g.backs.length - 200);
  return { ok: true, back: true, events: [{ type: 'jail_back', t, pupil: id }] };
}
