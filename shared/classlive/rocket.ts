/**
 * Rocket Relay (Class Live `rocket`, docs/ROCKET-PLAN.md): a real running relay. Teams line up at one end of the hall;
 * each team has its own iPad station at the other end. The big screen shows each team's running order, so the iPad
 * knows who is coming: the runner taps "I'm here", answers their own ladder question(s), and every right answer boosts
 * the team's rocket on the big screen. Then they run back and tag the next runner. First rocket to the Moon wins.
 *
 * Pure rules: the server (rocketServer.ts) loads the room, calls these and saves.
 */
import type { RosterPupil } from './jail';

export const TEAM_COUNTS = [2, 3, 4, 5, 6] as const;
export const DEFAULT_TEAMS = 4;
/** Questions per run (the teacher's choice). */
export const PER_RUN = [1, 2, 3] as const;
export type PerRun = (typeof PER_RUN)[number];
export const DEFAULT_PER_RUN: PerRun = 1;
/** The Moon is set so every pupil runs about this many times. */
export const LAPS = 3;
/** A right answer first time; right on the second try is a smaller boost (James's card: one more try, then run back). */
export const BOOST = 2;
export const SMALL_BOOST = 1;
/** One answer at a time per pupil. */
export const ANSWER_GAP_MS = 600;

export const TEAM_WORDS = [
  { name: 'Red', colour: '#e2533d' },
  { name: 'Blue', colour: '#3f7ee0' },
  { name: 'Green', colour: '#3ba55c' },
  { name: 'Yellow', colour: '#e6b417' },
  { name: 'Purple', colour: '#9b5bd8' },
  { name: 'Orange', colour: '#ec8a2c' },
] as const;

export interface RocketTeam {
  /** The running order (pupil ids). */
  order: string[];
  /** Runs so far: order[turn % order.length] runs next. */
  turn: number;
  height: number;
  /** The runner at the iPad now (checked in), or null while the next runner is on the way. */
  active: string | null;
  /** This run: right answers, and whether the current question is a second try. */
  runRight: number;
  secondTry: boolean;
}

export interface RocketMine {
  answered: number;
  rightAll: number;
  wrong: number;
  runs: number;
  lastAt: number;
}

export interface RocketGame {
  kind: 'rocket';
  roster: RosterPupil[];
  teams: RocketTeam[];
  perRun: PerRun;
  /** Height of the Moon. */
  moon: number;
  mine: Record<string, RocketMine>;
  /** The team that reached the Moon first, or null. */
  winner: number | null;
}

export type RocketEvent =
  | { type: 'rocket_boost'; t: number; team: number; pupil: string; by: number }
  | { type: 'rocket_run'; t: number; team: number; pupil: string }
  | { type: 'rocket_moon'; t: number; team: number };

export const teamCountOf = (v: unknown): number => ((TEAM_COUNTS as readonly number[]).includes(v as number) ? (v as number) : DEFAULT_TEAMS);
export const perRunOf = (v: unknown): PerRun => ((PER_RUN as readonly number[]).includes(v as number) ? (v as PerRun) : DEFAULT_PER_RUN);

export const freshRocketMine = (): RocketMine => ({ answered: 0, rightAll: 0, wrong: 0, runs: 0, lastAt: -Infinity });
const mineOf = (g: RocketGame, id: string) => (g.mine[id] ??= freshRocketMine());

/** The Moon for these teams: every pupil of the biggest team runs LAPS times, getting every question right. */
export const moonFor = (teams: RocketTeam[], perRun: PerRun) => Math.max(...teams.map((t) => t.order.length), 1) * LAPS * perRun * BOOST;

/**
 * Teams dealt from the class list in a shuffled order. Teams are as even in size as can be; since every runner answers
 * questions from their own ladder level, a mixed team is a fair team.
 */
export function newRocket(roster: RosterPupil[], teamCount: number, perRun: PerRun, random: () => number): RocketGame {
  const ids = roster.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)) % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const n = Math.max(1, Math.min(teamCount, ids.length || 1));
  const teams: RocketTeam[] = Array.from({ length: n }, () => ({ order: [], turn: 0, height: 0, active: null, runRight: 0, secondTry: false }));
  ids.forEach((id, i) => teams[i % n].order.push(id));
  return { kind: 'rocket', roster: roster.slice(), teams, perRun, moon: moonFor(teams, perRun), mine: {}, winner: null };
}

/** Who runs next for a team (or is at the iPad now). */
export const runnerOf = (t: RocketTeam): string | null => t.active ?? (t.order.length ? t.order[t.turn % t.order.length] : null);
/** The runner after that (shown on the big screen as "Next"). */
export const nextOf = (t: RocketTeam): string | null => (t.order.length ? t.order[(t.turn + 1) % t.order.length] : null);

export type RocketRefusal = 'team' | 'not_you' | 'not_here' | 'won' | 'too_soon';

/** The runner reached their team's iPad and tapped "I'm here". */
export function checkIn(g: RocketGame, team: number, id: string): { ok: true } | { ok: false; reason: RocketRefusal } {
  const t = g.teams[team];
  if (!t) return { ok: false, reason: 'team' };
  if (g.winner !== null) return { ok: false, reason: 'won' };
  if (t.active === id) return { ok: true };
  if (t.active !== null || runnerOf(t) !== id) return { ok: false, reason: 'not_you' };
  t.active = id;
  t.runRight = 0;
  t.secondTry = false;
  return { ok: true };
}

function endRun(g: RocketGame, t: RocketTeam, team: number, id: string, at: number): RocketEvent[] {
  mineOf(g, id).runs += 1;
  t.turn += 1;
  t.active = null;
  t.runRight = 0;
  t.secondTry = false;
  return [{ type: 'rocket_run', t: at, team, pupil: id }];
}

/** "Not here today?": skip the runner whose turn it is (they ran off, or are away). */
export function skip(g: RocketGame, team: number, at: number): RocketEvent[] {
  const t = g.teams[team];
  if (!t || g.winner !== null || !t.order.length) return [];
  const id = runnerOf(t) as string;
  t.turn += 1;
  t.active = null;
  t.runRight = 0;
  t.secondTry = false;
  return [{ type: 'rocket_run', t: at, team, pupil: id }];
}

export type RocketAnswer = { ok: true; runOver: boolean; boost: number; events: RocketEvent[] } | { ok: false; reason: RocketRefusal };

/**
 * A marked answer from the runner at their team's iPad. Right: a boost (smaller on a second try). Wrong: one more try
 * with a new question; wrong again and the run is over. A run ends after `perRun` right answers.
 */
export function answer(g: RocketGame, team: number, id: string, right: boolean, at: number): RocketAnswer {
  const t = g.teams[team];
  if (!t) return { ok: false, reason: 'team' };
  if (g.winner !== null) return { ok: false, reason: 'won' };
  if (t.active !== id) return { ok: false, reason: 'not_here' };
  const m = mineOf(g, id);
  if (at - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = at;
  m.answered += 1;
  const events: RocketEvent[] = [];
  if (!right) {
    m.wrong += 1;
    if (t.secondTry) return { ok: true, runOver: true, boost: 0, events: endRun(g, t, team, id, at) };
    t.secondTry = true;
    return { ok: true, runOver: false, boost: 0, events };
  }
  m.rightAll += 1;
  const by = t.secondTry ? SMALL_BOOST : BOOST;
  t.secondTry = false;
  t.height += by;
  t.runRight += 1;
  events.push({ type: 'rocket_boost', t: at, team, pupil: id, by });
  if (t.height >= g.moon && g.winner === null) {
    g.winner = team;
    events.push({ type: 'rocket_moon', t: at, team });
    return { ok: true, runOver: true, boost: by, events: [...events, ...endRun(g, t, team, id, at)] };
  }
  if (t.runRight >= g.perRun) return { ok: true, runOver: true, boost: by, events: [...events, ...endRun(g, t, team, id, at)] };
  return { ok: true, runOver: false, boost: by, events };
}

/** Team places: the Moon team first, then by height. */
export function rocketPlaces(g: RocketGame): number[] {
  return g.teams.map((_, i) => i).sort((a, b) => (a === g.winner ? -1 : b === g.winner ? 1 : g.teams[b].height - g.teams[a].height));
}

/** The pupils on the winning team (the Moon team, or the highest rocket when time ran out; nobody on a 0-0 tie). */
export function winningTeam(g: RocketGame): number | null {
  if (g.winner !== null) return g.winner;
  const [first, second] = rocketPlaces(g);
  if (first === undefined || g.teams[first].height === 0) return null;
  if (second !== undefined && g.teams[second].height === g.teams[first].height) return null;
  return first;
}
