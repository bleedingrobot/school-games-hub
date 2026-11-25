/**
 * Toon Flap Relay (docs/RELAY-PLAN.md): the rules, pure functions only. The class is dealt into colour teams of 4 or 5;
 * every team has one flyer up at a time, racing the same Toon Flap course in its own lane. A turn is 30 s of flying, then
 * the next teammate carries on from where the bird got to. Teammates who aren't flying answer maths questions for
 * sparks, and spend them on perks for their own flyer or troubles that land on a random other team. First team to the
 * nest wins the race; the teacher picks 1, 3 or 5 races.
 *
 * The physics is Toon Flap's (shared/toonflap: same numbers, same fixed 1/60 s step), with the relay's effects added in
 * `flyStep`. Every effect is laid down as a stretch of the course (x0 to x1), never a time, so the flyer's iPad and the
 * server replay the same flaps to the same place. Effects always start a couple of walls ahead of where the server last
 * saw the bird, so the flyer's iPad hears of them (in the reply to its next flap list) before it gets there.
 */
import { BIRD_HALF, BIRD_SIZE, DT, LEAD_IN_SECONDS, NEST_AFTER, RESPAWN_BACK, RESPAWN_LOW, SKY, START_X, START_Y, STEPS_PER_SECOND, WALL_WIDTH, WINGS } from '../toonflap/config';
import type { RunState } from '../toonflap/engine';
import type { Course, LevelDef, Wall, Zone } from '../toonflap/levels';

// ---------- numbers ----------

/** A turn: this many steps of flying (hovering doesn't count). */
export const TURN_STEPS = 30 * STEPS_PER_SECOND;
/** …but a turn never lasts longer than this on the clock (a flyer who hovers and never taps). */
export const TURN_WALL_MS = 42_000;
/** No flap list from the flyer for this long: they've gone, pass the baton. */
export const IDLE_MS = 10_000;
/** "3, 2, 1, go!" before each race. */
export const READY_MS = 5_000;
/** Longest a race runs once it's going; then the furthest team wins. */
export const RACE_MS = 210_000;
/** Cheers and standings between races. */
export const SHOW_MS = 9_000;
/** The course is about this many seconds of flying long (a good team finishes in about 2.5 minutes with handovers). */
export const RACE_FLY_SECONDS = 120;
/** Sparks: one for each right answer, at most this many held. */
export const MAX_SPARKS = 6;
export const PERK_COST = 2;
export const TROUBLE_COST = 3;
/** Each pupil waits this long between sends (perks and troubles share it). */
export const SEND_COOL_MS = 10_000;
/** A team with a trouble on it can't get another for this long, then is safe for SAFE_MS more (docs/RELAY-PLAN.md section 4). */
export const TROUBLE_LOCK_MS = 10_000;
export const SAFE_MS = 8_000;
/** At most this many perks sent to one team in PERK_WINDOW_MS. */
export const PERK_STACK = 2;
export const PERK_WINDOW_MS = 10_000;
/** No troubles in a flyer's first seconds (the handover). */
export const GRACE_MS = 3_000;
/** A new question this long after the last answer. */
export const ANSWER_GAP_MS = 1_000;
/** Effects start this many walls ahead of where the server last saw the bird. */
const LEAD_WALLS = 2;
/** Narrow gaps never get smaller than Toon Flap level 10's (3.5 bird heights). */
const MIN_GAP = 3.5 * BIRD_SIZE;
export const RACE_CHOICES = [1, 3, 5] as const;
export const raceCount = (v: unknown): 1 | 3 | 5 => ((RACE_CHOICES as readonly number[]).includes(v as number) ? (v as 1 | 3 | 5) : 3);

/** Teams: up to six colours. */
export const TEAM_WORDS = [
  { name: 'Red', colour: '#ef4444', emoji: '🟥' },
  { name: 'Blue', colour: '#3b82f6', emoji: '🟦' },
  { name: 'Green', colour: '#22c55e', emoji: '🟩' },
  { name: 'Yellow', colour: '#eab308', emoji: '🟨' },
  { name: 'Purple', colour: '#a855f7', emoji: '🟪' },
  { name: 'Orange', colour: '#f97316', emoji: '🟧' },
] as const;

/** Teams of 4 or 5 (James: auto teams of 4-5, balanced): 2 to 6 teams, sizes differ by at most one. */
export const teamsFor = (players: number): number => (players <= 1 ? 1 : players <= 5 ? 2 : Math.max(2, Math.min(6, Math.round(players / 4.5))));

export const PERKS = ['shield', 'wide', 'slow', 'tailwind', 'magnet', 'ghost', 'mini', 'clear'] as const;
export type Perk = (typeof PERKS)[number];
export const TROUBLES = ['wind', 'fog', 'wall', 'narrow'] as const;
export type Trouble = (typeof TROUBLES)[number];
export type FxKind = Perk | Trouble;

/** The race each perk opens on (James: 8 perks, unlocked race by race). Troubles are all on from race 1. */
export const PERK_UNLOCK: Record<Perk, number> = { shield: 1, wide: 1, slow: 1, tailwind: 1, magnet: 2, ghost: 3, mini: 4, clear: 5 };

export const FX_WORDS: Record<FxKind, { name: string; emoji: string; how: string }> = {
  shield: { name: 'Shield', emoji: '🛡️', how: 'Blocks the next bump.' },
  wide: { name: 'Wide gaps', emoji: '↕️', how: 'The next 3 walls have bigger gaps.' },
  slow: { name: 'Slow-mo', emoji: '🐢', how: 'Everything slows down for 5 seconds.' },
  tailwind: { name: 'Tailwind', emoji: '💨', how: 'Zoom ahead past the next 3 walls.' },
  magnet: { name: 'Magnet', emoji: '🧲', how: 'Pulls your bird to the middle of the next 2 gaps.' },
  ghost: { name: 'Ghost wings', emoji: '👻', how: 'Fly right through the next wall.' },
  mini: { name: 'Mini bird', emoji: '🐣', how: 'Your bird shrinks for 8 seconds.' },
  clear: { name: 'Clear sky', emoji: '🌈', how: 'Blows away any trouble on your flyer.' },
  wind: { name: 'Wind gust', emoji: '🌬️', how: 'Blows their bird up or down for 5 seconds.' },
  fog: { name: 'Fog', emoji: '🌫️', how: 'They can only see close to their bird for 5 seconds.' },
  wall: { name: 'Extra wall', emoji: '🧱', how: 'An extra wall pops up in front of them.' },
  narrow: { name: 'Narrow gaps', emoji: '🤏', how: 'Their next 2 walls have smaller gaps.' },
};

export const isPerk = (k: unknown): k is Perk => (PERKS as readonly unknown[]).includes(k);
export const isTrouble = (k: unknown): k is Trouble => (TROUBLES as readonly unknown[]).includes(k);

/** Each race a little tighter (race 1 is Toon Flap level 1), always slow wings so Years 1 to 8 can all fly it. */
const RACE_TUNE = [
  { gap: 5.0, spacing: 2.6, wander: 1.2 },
  { gap: 4.8, spacing: 2.5, wander: 1.6 },
  { gap: 4.6, spacing: 2.4, wander: 1.9 },
  { gap: 4.4, spacing: 2.3, wander: 2.1 },
  { gap: 4.2, spacing: 2.2, wander: 2.2 },
] as const;

// ---------- the game ----------

export interface Effect {
  id: number;
  kind: FxKind;
  /** The course stretch it covers (shield: until used; wall: x0 is where the extra wall stands). */
  x0: number;
  x1: number;
  /** Sent by this pupil, from this team (index), to this team. */
  by: string;
  from: number;
  to: number;
  /** Session time it was sent. */
  at: number;
  /** Wind: up (+) or down (−). */
  push?: number;
  /** Extra wall: its gap. */
  gapY?: number;
  gapH?: number;
}

export interface Turn {
  n: number;
  flyer: string;
  /** Session time the turn began (the bird hovers until the first tap). */
  startT: number;
  /** Where the bird starts: x, y and the first wall ahead. */
  x0: number;
  y0: number;
  w0: number;
  /** The flyer's flaps so far (Toon Flap's encodeFlaps text) and how many steps of flying they've done. */
  flaps: string;
  at: number;
  /** Session time of the flyer's last flap list. */
  lastPost: number;
  /** Bumps this turn. */
  bumps: number;
}

export interface RelayTeam {
  colour: number;
  members: string[];
  /** Whose turn is next (an index into members). */
  next: number;
  turn: Turn | null;
  turns: number;
  /** How far the team's bird has got (course units), and the first wall ahead of it. */
  x: number;
  wall: number;
  bumps: number;
  effects: Effect[];
  /** Session time a new trouble may land on this team. */
  calmAt: number;
  /** Session time it reached the nest this race, or null. */
  finishT: number | null;
}

export interface RelayRace {
  n: number;
  seed: number;
  /** Race made (the countdown starts), flying starts at goT. */
  startT: number;
  goT: number;
  /** The race ended (someone reached the nest, or time); the show ends at showEnd. */
  endT: number | null;
  showEnd: number | null;
  /** Winning team (index), or null for a draw (nobody moved). */
  winner: number | null;
  /** Teams in finishing order (indexes), once ended. */
  standings: number[] | null;
}

export interface RelayMine {
  team: number;
  sparks: number;
  answered: number;
  right: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  lastAt: number;
  sendAt: number;
  perks: number;
  troubles: number;
  /** Turns flown, and course units flown over all of them. */
  flights: number;
  flown: number;
  /** Races won with their team. */
  wins: number;
  fastMs?: number;
}

export interface RelayGame {
  kind: 'relay';
  races: 1 | 3 | 5;
  race: RelayRace | null;
  teams: RelayTeam[];
  /** Races won by each team colour (index = colour). */
  wins: number[];
  mine: Record<string, RelayMine>;
  nextFx: number;
  /** Session time of the last step (so a pupil's own row can say what's allowed now). */
  lastT: number;
}

export type RelayEvent =
  | { type: 'relay_race'; t: number; n: number }
  | { type: 'relay_go'; t: number; n: number }
  | { type: 'relay_turn'; t: number; team: number; pupil: string }
  | { type: 'relay_fx'; t: number; kind: FxKind; from: number; to: number; pupil: string }
  | { type: 'relay_lead'; t: number; team: number }
  | { type: 'relay_bump'; t: number; team: number }
  | { type: 'relay_nest'; t: number; team: number }
  | { type: 'relay_end'; t: number; n: number; winner: number | null; why: 'nest' | 'time' };

export function newRelay(races: 1 | 3 | 5): RelayGame {
  return { kind: 'relay', races, race: null, teams: [], wins: [0, 0, 0, 0, 0, 0], mine: {}, nextFx: 1, lastT: 0 };
}

export function freshRelayMine(team = 0): RelayMine {
  return { team, sparks: 0, answered: 0, right: 0, wrong: 0, streak: 0, bestStreak: 0, lastAt: -ANSWER_GAP_MS, sendAt: -SEND_COOL_MS, perks: 0, troubles: 0, flights: 0, flown: 0, wins: 0 };
}

// ---------- the course ----------

function stream(seed: number): () => number {
  let s = (Math.abs(seed) % 2147483646) + 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

const RELAY_DEF = (n: number): LevelDef => ({
  // Drawn as Toon Garden (world 1) until the Stadium Sky is painted (docs/RELAY-ART-PLAN.md).
  n: 1, id: `relay-${n}`, name: 'Stadium Sky', world: 'a sports-day stadium sky', seconds: RACE_FLY_SECONDS, pace: 'slow',
  gap: RACE_TUNE[Math.min(n, 5) - 1].gap, spacing: RACE_TUNE[Math.min(n, 5) - 1].spacing, checks: 0, answerWalls: 0, answerGaps: 2,
  wander: RACE_TUNE[Math.min(n, 5) - 1].wander, features: [], newThing: '',
});

const courseCache = new Map<string, Course>();

/** Race `n`'s course from its seed: the same for every team (and on every device). */
export function relayCourse(n: number, seed: number): Course {
  const key = `${n}:${seed}`;
  const hit = courseCache.get(key);
  if (hit) return hit;
  const def = RELAY_DEF(n);
  const speed = WINGS.slow.speed;
  const random = stream(seed * 7 + n);
  const mid = SKY / 2;
  const endX = START_X + speed * RACE_FLY_SECONDS;
  const walls: Wall[] = [];
  let x = START_X + speed * LEAD_IN_SECONDS;
  let lastY = mid;
  for (let i = 0; x < endX; i++) {
    const h = def.gap * BIRD_SIZE;
    const reach = i === 0 ? 0.6 : def.wander;
    const maxJump = 2.2 + def.spacing * 0.6;
    let y = mid + (random() * 2 - 1) * reach;
    y = Math.max(lastY - maxJump, Math.min(lastY + maxJump, y));
    const room = h / 2 + 0.8;
    y = Math.max(room, Math.min(SKY - room, y));
    walls.push({ i, x, gaps: [{ y, h }] });
    lastY = y;
    x += speed * def.spacing;
  }
  const big = 9999;
  const course: Course = {
    def, speed, walls, perches: [], signs: [], zones: [],
    nestX: walls[walls.length - 1].x + WALL_WIDTH + NEST_AFTER,
    medals: { gold: big, silver: big, goldPlain: big, silverPlain: big },
  };
  if (courseCache.size > 40) courseCache.clear();
  courseCache.set(key, course);
  return course;
}

/** Gap size change of each effect (multiplied together). */
const GAP_SCALE: Partial<Record<FxKind, number>> = { wide: 1.3, tailwind: 1.15, narrow: 0.8 };

/** A team's own course: the race's course with its extra walls in, its gaps resized and its wind as zones. */
export function teamCourse(base: Course, effects: readonly Effect[]): Course {
  if (!effects.length) return base;
  const walls: Wall[] = base.walls.map((w) => ({ ...w, gaps: w.gaps.map((g) => ({ ...g })) }));
  for (const e of effects) {
    if (e.kind === 'wall' && e.gapY !== undefined && e.gapH !== undefined) walls.push({ i: -1, x: e.x0, gaps: [{ y: e.gapY, h: e.gapH }] });
  }
  walls.sort((a, b) => a.x - b.x);
  walls.forEach((w, i) => { w.i = i; });
  for (const w of walls) {
    let k = 1;
    for (const e of effects) {
      const s = GAP_SCALE[e.kind];
      if (s && w.x + WALL_WIDTH >= e.x0 && w.x <= e.x1) k *= s;
    }
    if (k !== 1) for (const g of w.gaps) {
      g.h = Math.max(MIN_GAP, Math.min(SKY - 1.2, g.h * k));
      g.y = Math.max(g.h / 2 + 0.3, Math.min(SKY - g.h / 2 - 0.3, g.y));
    }
  }
  const zones: Zone[] = effects.filter((e) => e.kind === 'wind').map((e) => ({ kind: 'gust' as const, x0: e.x0, x1: e.x1, push: e.push ?? 7, gravity: 1 }));
  return { ...base, walls, zones };
}

// ---------- flying (Toon Flap's stepRun with the relay's effects) ----------

export interface FlyState extends RunState {
  /** Shields already used (effect ids). */
  used: number[];
  /** A used shield lets the bird through walls until it is past this x. */
  phaseTo: number;
}

const on = (e: Effect, x: number) => x >= e.x0 && x <= e.x1;
const has = (effects: readonly Effect[], kind: FxKind, x: number) => effects.some((e) => e.kind === kind && on(e, x));

function inside(y: number, half: number, g: { y: number; h: number }): boolean {
  return y - half >= g.y - g.h / 2 && y + half <= g.y + g.h / 2;
}

/** The first wall the bird (at x) hasn't passed. */
export function wallAhead(course: Course, x: number): number {
  let w = 0;
  while (w < course.walls.length && course.walls[w].x + WALL_WIDTH < x - BIRD_HALF) w++;
  return w;
}

/**
 * Where a new turn's bird hovers: where the last one got to, but never inside or right against a wall (then just in
 * front of it, in the middle of its gap, as Toon Flap's bump does).
 */
export function startSpot(course: Course, x: number): { x: number; y: number; w: number } {
  const w = wallAhead(course, x);
  const wall = course.walls[w];
  if (!wall) return { x: Math.min(x, course.nestX - 1), y: SKY / 2, w };
  const before = w > 0 ? course.walls[w - 1].x + WALL_WIDTH : START_X;
  const spot = wall.x - (wall.x - before) * RESPAWN_BACK;
  const g = wall.gaps[0];
  return { x: w === 0 && x <= START_X ? START_X : Math.max(before + 0.2, Math.min(x, spot)), y: w === 0 && x <= START_X ? START_Y : g.y - RESPAWN_LOW, w };
}

export function newFly(turn: Pick<Turn, 'x0' | 'y0' | 'w0'>): FlyState {
  return { t: 0, x: turn.x0, y: turn.y0, vy: 0, mode: 'hover', hover: 'start', bumps: 0, nextWall: turn.w0, perches: 0, picks: [], outcome: 'running', used: [], phaseTo: -1 };
}

function respawn(course: Course, s: FlyState): void {
  const wall = course.walls[s.nextWall];
  if (wall) {
    const before = s.nextWall > 0 ? course.walls[s.nextWall - 1].x + WALL_WIDTH : START_X;
    s.x = wall.x - (wall.x - before) * RESPAWN_BACK;
    s.y = wall.gaps[0].y - RESPAWN_LOW;
  } else {
    s.y = SKY / 2;
  }
  s.vy = 0;
  s.mode = 'hover';
  s.hover = 'bump';
}

/** One step (1/60 s). While hovering, a step without a flap does nothing. `course` is the team's course (teamCourse). */
export function flyStep(course: Course, effects: readonly Effect[], s: FlyState, flap: boolean): 'wait' | 'bump' | 'shield' | 'nest' | null {
  if (s.mode === 'done') return null;
  if (s.mode === 'hover') {
    if (!flap) return 'wait';
    s.mode = 'fly';
  }
  const wings = WINGS[course.def.pace];
  let gravity = wings.gravity;
  let push = 0;
  for (const z of course.zones) {
    if (s.x >= z.x0 && s.x <= z.x1) {
      push += z.push;
      gravity *= z.gravity;
    }
  }
  if (flap) s.vy = wings.lift;
  // Magnet: a gentle pull to the middle of the next gap.
  const wallNow = course.walls[s.nextWall];
  if (wallNow && has(effects, 'magnet', s.x)) push += (wallNow.gaps[0].y - s.y) * 6 - s.vy * 1.5;
  s.vy += (push - gravity) * DT;
  if (s.vy < -wings.maxFall) s.vy = -wings.maxFall;
  if (s.vy > wings.lift * 1.5) s.vy = wings.lift * 1.5;
  s.y += s.vy * DT;
  const speedK = has(effects, 'slow', s.x) ? 0.7 : has(effects, 'tailwind', s.x) ? 1.5 : 1;
  s.x += course.speed * speedK * DT;
  s.t++;

  const half = has(effects, 'mini', s.x) ? BIRD_HALF * 0.7 : BIRD_HALF;
  while (s.nextWall < course.walls.length && course.walls[s.nextWall].x + WALL_WIDTH < s.x - half) s.nextWall++;
  const edge = s.y - half < 0 || s.y + half > SKY;
  let wallHit = false;
  const ghost = has(effects, 'ghost', s.x) || s.x <= s.phaseTo;
  for (let w = s.nextWall; !ghost && !wallHit && w < course.walls.length; w++) {
    const wall = course.walls[w];
    if (wall.x > s.x + half) break;
    if (!wall.gaps.some((g) => inside(s.y, half, g))) wallHit = true;
  }
  if (edge || wallHit) {
    const shield = effects.find((e) => e.kind === 'shield' && e.to >= 0 && s.x >= e.x0 && s.x <= e.x1 && !s.used.includes(e.id));
    if (shield) {
      // The shield takes the bump: bounce off the ground or sky, or slip through this wall.
      s.used.push(shield.id);
      if (edge) {
        s.y = Math.max(half, Math.min(SKY - half, s.y));
        s.vy = s.y < SKY / 2 ? wings.lift * 0.8 : -1;
      }
      if (wallHit) s.phaseTo = course.walls[s.nextWall].x + WALL_WIDTH + half;
      return 'shield';
    }
    s.bumps++;
    respawn(course, s);
    return 'bump';
  }
  if (s.x >= course.nestX) {
    s.mode = 'done';
    s.outcome = 'finished';
    return 'nest';
  }
  return null;
}

/**
 * Plays a turn's flaps from its start up to `upTo` steps of flying (or the turn's end, or the nest). Not valid if the
 * list can't have come from playing (out of order, or a hover the next flap doesn't match).
 */
export function replayTurn(course: Course, effects: readonly Effect[], turn: Pick<Turn, 'x0' | 'y0' | 'w0'>, flaps: readonly number[], upTo: number): { valid: boolean; state: FlyState; bumps: number } {
  const s = newFly(turn);
  const limit = Math.min(upTo, TURN_STEPS);
  let k = 0;
  while (s.mode !== 'done' && s.t < limit) {
    const next = k < flaps.length ? flaps[k] : -1;
    if (next >= 0 && next < s.t) return { valid: false, state: s, bumps: s.bumps };
    const flap = next === s.t;
    if (s.mode === 'hover' && !flap) return { valid: next < 0 || next >= limit, state: s, bumps: s.bumps };
    if (flap) k++;
    flyStep(course, effects, s, flap);
  }
  return { valid: true, state: s, bumps: s.bumps };
}

// ---------- teams and races ----------

/** Deals the players into teams. Race 1 at random; later races mix by flying (average distance a turn, snake order). */
export function dealTeams(g: RelayGame, order: string[], random: () => number): void {
  const k = teamsFor(order.length);
  const ids = [...order];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)) % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const skill = (id: string) => {
    const m = g.mine[id];
    return m && m.flights > 0 ? m.flown / m.flights : -1;
  };
  if (g.race) ids.sort((a, b) => skill(b) - skill(a));
  const members: string[][] = Array.from({ length: k }, () => []);
  ids.forEach((id, i) => {
    const round = Math.floor(i / k);
    const at = round % 2 === 0 ? i % k : k - 1 - (i % k);
    members[at].push(id);
  });
  // Who flies first in each team: those who've flown least so far (so everyone gets a go over the races).
  const flights = (id: string) => g.mine[id]?.flights ?? 0;
  for (const list of members) list.sort((a, b) => flights(a) - flights(b));
  g.teams = members.map((list, colour) => ({ colour, members: list, next: 0, turn: null, turns: 0, x: START_X, wall: 0, bumps: 0, effects: [], calmAt: 0, finishT: null }));
  for (const [ti, team] of g.teams.entries()) for (const id of team.members) {
    const m = g.mine[id] ?? freshRelayMine(ti);
    m.team = ti;
    g.mine[id] = m;
  }
}

/** A new player: into the smallest team (or the first race's deal, if no race yet). */
export function joinRelay(g: RelayGame, who: string): void {
  if (g.mine[who]) return;
  if (!g.teams.length) {
    g.mine[who] = freshRelayMine(0);
    return;
  }
  let best = 0;
  g.teams.forEach((tm, i) => { if (tm.members.length < g.teams[best].members.length) best = i; });
  g.teams[best].members.push(who);
  g.mine[who] = freshRelayMine(best);
}

function newRace(g: RelayGame, n: number, t: number, order: string[], random: () => number): RelayEvent[] {
  g.race = { n, seed: 1 + Math.floor(random() * 2_000_000_000), startT: t, goT: t + READY_MS, endT: null, showEnd: null, winner: null, standings: null };
  dealTeams(g, order, random);
  return [{ type: 'relay_race', t, n }];
}

export const courseOf = (g: RelayGame): Course | null => (g.race ? relayCourse(g.race.n, g.race.seed) : null);
export const teamCourseOf = (g: RelayGame, team: RelayTeam): Course | null => {
  const base = courseOf(g);
  return base ? teamCourse(base, team.effects) : null;
};

function startTurn(g: RelayGame, team: RelayTeam, ti: number, t: number, events: RelayEvent[]): void {
  const course = teamCourseOf(g, team);
  if (!course || !team.members.length) {
    team.turn = null;
    return;
  }
  const flyer = team.members[team.next % team.members.length];
  team.next = (team.next + 1) % team.members.length;
  const at = startSpot(course, team.x);
  team.turn = { n: ++team.turns, flyer, startT: t, x0: at.x, y0: at.y, w0: at.w, flaps: '', at: 0, lastPost: t, bumps: 0 };
  team.x = at.x;
  team.wall = at.w;
  events.push({ type: 'relay_turn', t, team: ti, pupil: flyer });
}

function endTurn(g: RelayGame, team: RelayTeam): void {
  const turn = team.turn;
  if (!turn) return;
  const m = g.mine[turn.flyer];
  if (m) {
    m.flights++;
    m.flown += Math.max(0, team.x - turn.x0);
  }
  team.turn = null;
}

/** Teams in race order: at the nest first (soonest first), then furthest. */
export function standingsOf(g: RelayGame): number[] {
  return g.teams.map((_, i) => i).sort((a, b) => {
    const A = g.teams[a], B = g.teams[b];
    if (A.finishT !== null || B.finishT !== null) return (A.finishT ?? Infinity) - (B.finishT ?? Infinity);
    return B.x - A.x;
  });
}

const leaderOf = (g: RelayGame): number | null => {
  if (g.teams.length < 2) return null;
  const s = standingsOf(g);
  const a = g.teams[s[0]], b = g.teams[s[1]];
  return a.finishT !== null || a.x > b.x + 0.01 ? s[0] : null;
};

function endRace(g: RelayGame, t: number, why: 'nest' | 'time'): RelayEvent[] {
  const r = g.race;
  if (!r || r.endT !== null) return [];
  for (const team of g.teams) endTurn(g, team);
  const standings = standingsOf(g);
  const first = g.teams[standings[0]];
  const moved = first && (first.finishT !== null || first.x > START_X + 0.5);
  const tie = standings.length > 1 && first.finishT === null && Math.abs(first.x - g.teams[standings[1]].x) < 0.01;
  r.endT = t;
  r.showEnd = t + SHOW_MS;
  r.standings = standings;
  r.winner = moved && !tie ? standings[0] : null;
  if (r.winner !== null) {
    g.wins[g.teams[r.winner].colour]++;
    for (const id of g.teams[r.winner].members) if (g.mine[id]) g.mine[id].wins++;
  }
  return [{ type: 'relay_end', t, n: r.n, winner: r.winner, why }];
}

/** The next time the game moves on by itself (countdown, turn ends, race time, the show's end), or null. */
export function relayDeadline(g: RelayGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  const r = g.race;
  if (!r) return 0;
  if (r.endT !== null) return r.showEnd;
  if (r.goT > 0 && !g.teams.some((tm) => tm.turn)) return r.goT;
  let due = r.goT + RACE_MS;
  for (const tm of g.teams) if (tm.turn) due = Math.min(due, tm.turn.startT + TURN_WALL_MS, tm.turn.lastPost + IDLE_MS);
  return due;
}

/** Is the game finished (its last race's show is over)? */
export const relayDone = (g: RelayGame, t: number): boolean => !g.race || (g.race.showEnd !== null && t >= g.race.showEnd);

/**
 * Moves the game on at session time t: the first race, "go", turns that ran out (time, or a flyer who's gone), the
 * race's time, the next race. `last`: the session's time is up (the race on now ends at once; no new one).
 * Returns the events and whether the whole game is over.
 */
export function advanceRelay(g: RelayGame, t: number, order: string[], random: () => number, last: boolean): { events: RelayEvent[]; over: boolean } {
  const events: RelayEvent[] = [];
  g.lastT = Math.max(g.lastT ?? 0, t);
  if (!g.race) {
    if (!order.length) return { events, over: false };
    events.push(...newRace(g, 1, t, order, random));
  }
  const r = g.race!;
  if (r.endT === null) {
    if (t >= r.goT) {
      if (!g.teams.some((tm) => tm.turn || tm.turns > 0)) events.push({ type: 'relay_go', t, n: r.n });
      g.teams.forEach((tm, i) => {
        if (tm.finishT !== null) return;
        if (tm.turn && (t >= tm.turn.startT + TURN_WALL_MS || t >= tm.turn.lastPost + IDLE_MS)) endTurn(g, tm);
        if (!tm.turn) startTurn(g, tm, i, t, events);
      });
    }
    if (t >= r.goT + RACE_MS) events.push(...endRace(g, t, 'time'));
    else if (last) events.push(...endRace(g, t, 'time'));
  }
  if (r.endT !== null && r.showEnd !== null && t >= r.showEnd) {
    if (r.n < g.races && !last) events.push(...newRace(g, r.n + 1, t, order, random));
    else return { events, over: true };
  }
  return { events, over: false };
}

/**
 * The flyer's flap list (`flaps` text, `at` steps flown). Replayed on the team's course with its effects; the team's
 * distance is the replay's, never the iPad's word. `elapsedMs`: since the turn began, so a list can't run ahead of the clock.
 */
export function flyTurn(g: RelayGame, who: string, turnN: number, flaps: number[], flapsText: string, at: number, t: number):
  { ok: true; events: RelayEvent[]; done: boolean } | { ok: false; reason: 'not_flying' | 'old_turn' | 'bad' | 'not_now' } {
  const r = g.race;
  if (!r || r.endT !== null || t < r.goT) return { ok: false, reason: 'not_now' };
  const ti = g.teams.findIndex((tm) => tm.turn?.flyer === who);
  if (ti < 0) return { ok: false, reason: 'not_flying' };
  const team = g.teams[ti];
  const turn = team.turn!;
  if (turn.n !== turnN) return { ok: false, reason: 'old_turn' };
  // Never ahead of the clock (a little slack for the iPad's own timer).
  const most = Math.floor(((t - turn.startT) / 1000) * STEPS_PER_SECOND) + 45;
  const upTo = Math.max(0, Math.min(at, most, TURN_STEPS));
  const course = teamCourseOf(g, team)!;
  const before = leaderOf(g);
  const out = replayTurn(course, team.effects, turn, flaps, upTo);
  if (!out.valid) return { ok: false, reason: 'bad' };
  const events: RelayEvent[] = [];
  if (out.bumps > turn.bumps) {
    team.bumps += out.bumps - turn.bumps;
    events.push({ type: 'relay_bump', t, team: ti });
  }
  turn.bumps = out.bumps;
  turn.flaps = flapsText;
  turn.at = upTo;
  turn.lastPost = t;
  team.x = out.state.x;
  team.wall = out.state.nextWall;
  const nest = out.state.outcome === 'finished';
  const after = leaderOf(g);
  if (after !== null && after !== before) events.push({ type: 'relay_lead', t, team: after });
  if (nest) {
    team.finishT = t;
    endTurn(g, team);
    events.push({ type: 'relay_nest', t, team: ti });
    // First to the nest wins the race (James: relay race to the nest).
    events.push(...endRace(g, t, 'nest'));
    return { ok: true, events, done: true };
  }
  if (upTo >= TURN_STEPS) {
    endTurn(g, team);
    startTurn(g, team, ti, t, events);
    return { ok: true, events, done: true };
  }
  return { ok: true, events, done: false };
}

// ---------- maths and sparks ----------

/** Who's flying now (any team), or null. */
export const flyingTeam = (g: RelayGame, who: string): number => g.teams.findIndex((tm) => tm.turn?.flyer === who);

/** Can this pupil get a question now? Not while flying, only while a race is on (the countdown too). */
export function relayCanAsk(g: RelayGame, who: string): boolean {
  const r = g.race;
  return !!r && r.endT === null && !!g.mine[who] && flyingTeam(g, who) < 0;
}

export function relayAnswered(g: RelayGame, who: string, right: boolean, t: number, ms?: number): { ok: true; events: RelayEvent[] } | { ok: false; reason: 'too_soon' | 'not_now' } {
  const m = g.mine[who];
  if (!m || !relayCanAsk(g, who)) return { ok: false, reason: 'not_now' };
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (right) {
    m.right++;
    m.streak++;
    m.bestStreak = Math.max(m.bestStreak, m.streak);
    m.sparks = Math.min(MAX_SPARKS, m.sparks + 1);
    if (ms !== undefined && ms >= 300 && (m.fastMs === undefined || ms < m.fastMs)) m.fastMs = ms;
  } else {
    m.wrong++;
    m.streak = 0;
  }
  return { ok: true, events: [] };
}

/** A perk's price for this team: 1 less for the team in last place, 1 more for the leader (James: gentle catch-up). */
export function perkCost(g: RelayGame, team: number): number {
  const live = standingsOf(g).filter((i) => g.teams[i].finishT === null);
  if (live.length < 2) return PERK_COST;
  const leader = leaderOf(g);
  if (leader === team) return PERK_COST + 1;
  const last = live[live.length - 1];
  const second = g.teams[live[live.length - 2]];
  if (last === team && g.teams[last].x < second.x - 0.01) return PERK_COST - 1;
  return PERK_COST;
}

/** Can a trouble land on this team now? Racing, past the handover, nothing on it, not in its safe time. */
export const troubleFree = (team: RelayTeam, t: number): boolean =>
  team.finishT === null && !!team.turn && t >= team.turn.startT + GRACE_MS && t >= team.calmAt;

/** The teams a trouble from this team could land on now. */
export const troubleTargets = (g: RelayGame, from: number, t: number): number[] => g.teams.map((tm, i) => (i !== from && troubleFree(tm, t) ? i : -1)).filter((i) => i >= 0);

/** The stretch an effect starts at: just after the wall before `LEAD_WALLS` walls ahead. */
function startOf(course: Course, wall: number): { x: number; k: number } | null {
  const k = Math.max(1, wall + LEAD_WALLS);
  if (k >= course.walls.length) return null;
  return { x: course.walls[k - 1].x + WALL_WIDTH + 0.2, k };
}

const WALL_COUNT: Partial<Record<FxKind, number>> = { wide: 3, tailwind: 3, magnet: 2, ghost: 1, narrow: 2 };
const SECONDS: Partial<Record<FxKind, number>> = { slow: 5, mini: 8, wind: 5, fog: 5, shield: 25 };

/** Lays an effect on a team's course, `LEAD_WALLS` walls ahead of its bird. */
function layEffect(g: RelayGame, kind: FxKind, by: string, from: number, to: number, t: number, random: () => number): Effect | 'no_room' {
  const team = g.teams[to];
  const course = teamCourseOf(g, team);
  if (!course) return 'no_room';
  const at = startOf(course, team.wall);
  if (!at) return 'no_room';
  const e: Effect = { id: g.nextFx++, kind, x0: at.x, x1: at.x, by, from, to, at: t };
  const n = WALL_COUNT[kind];
  if (n) e.x1 = course.walls[Math.min(at.k + n - 1, course.walls.length - 1)].x + WALL_WIDTH + 0.4;
  const secs = SECONDS[kind];
  if (secs) e.x1 = at.x + course.speed * secs;
  if (kind === 'wind') e.push = random() < 0.5 ? 7 : -6;
  if (kind === 'wall') {
    // Halfway between the wall before and the next one, its gap between theirs, always a fair size.
    const a = course.walls[at.k - 1], b = course.walls[at.k];
    const room = b.x - (a.x + WALL_WIDTH);
    if (room < WALL_WIDTH * 3) return 'no_room';
    e.x0 = a.x + WALL_WIDTH + (room - WALL_WIDTH) / 2;
    e.x1 = e.x0 + WALL_WIDTH;
    e.gapY = (a.gaps[0].y + b.gaps[0].y) / 2;
    e.gapH = Math.max(a.gaps[0].h, b.gaps[0].h, 4.6 * BIRD_SIZE);
  }
  if (kind === 'clear') {
    // Clear sky: troubles end where the new stretch starts; extra walls not reached yet go.
    team.effects = team.effects.filter((x) => !(x.kind === 'wall' && x.x0 > at.x));
    for (const x of team.effects) if (isTrouble(x.kind) && x.x1 > at.x) x.x1 = Math.max(x.x0, at.x);
    team.calmAt = Math.max(t, Math.min(team.calmAt, t + SAFE_MS));
  }
  team.effects.push(e);
  return e;
}

/**
 * A pupil spends sparks: a perk for their own flyer, or a trouble for a random other team that's free (James: no aiming,
 * so nobody can gang up). The server checks every rule.
 */
export function relaySpend(g: RelayGame, who: string, kind: unknown, t: number, random: () => number):
  { ok: true; events: RelayEvent[]; to: number } | { ok: false; reason: 'not_now' | 'unknown' | 'locked' | 'sparks' | 'cool' | 'stack' | 'busy_teams' | 'no_room' } {
  const r = g.race;
  const m = g.mine[who];
  if (!r || r.endT !== null || t < r.goT || !m) return { ok: false, reason: 'not_now' };
  if (flyingTeam(g, who) >= 0) return { ok: false, reason: 'not_now' };
  if (!isPerk(kind) && !isTrouble(kind)) return { ok: false, reason: 'unknown' };
  const mine = g.teams[m.team];
  if (!mine || mine.finishT !== null || !mine.turn) return { ok: false, reason: 'not_now' };
  if (isPerk(kind) && PERK_UNLOCK[kind] > r.n) return { ok: false, reason: 'locked' };
  if (t - m.sendAt < SEND_COOL_MS) return { ok: false, reason: 'cool' };
  const cost = isPerk(kind) ? perkCost(g, m.team) : TROUBLE_COST;
  if (m.sparks < cost) return { ok: false, reason: 'sparks' };
  let to = m.team;
  if (isPerk(kind)) {
    const recent = mine.effects.filter((e) => isPerk(e.kind) && t - e.at < PERK_WINDOW_MS).length;
    if (recent >= PERK_STACK) return { ok: false, reason: 'stack' };
  } else {
    const free = troubleTargets(g, m.team, t);
    if (!free.length) return { ok: false, reason: 'busy_teams' };
    to = free[Math.floor(random() * free.length) % free.length];
  }
  const e = layEffect(g, kind, who, m.team, to, t, random);
  if (e === 'no_room') return { ok: false, reason: 'no_room' };
  if (isTrouble(kind)) g.teams[to].calmAt = t + TROUBLE_LOCK_MS + SAFE_MS;
  m.sparks -= cost;
  m.sendAt = t;
  if (isPerk(kind)) m.perks++;
  else m.troubles++;
  return { ok: true, events: [{ type: 'relay_fx', t, kind, from: m.team, to, pupil: who }], to };
}

/** A small seeded random from the game's own count, so a send's target is the same on every retry of the step. */
export function fxRandom(g: RelayGame, seed: number): () => number {
  return stream(seed + g.nextFx * 7919);
}

// ---------- podium ----------

/** Pupils on winning teams: the most races won (team), then their own right answers. Shares ties like the other games. */
export function relayPodium(g: RelayGame, order: string[]): { player: string; place: 1 | 2 | 3 }[] {
  const score = (id: string) => (g.mine[id]?.wins ?? 0);
  const scores = [...new Set(order.map(score))].filter((s) => s > 0).sort((a, b) => b - a).slice(0, 3);
  return order.map((id) => ({ player: id, s: score(id) })).filter((x) => scores.includes(x.s)).sort((a, b) => b.s - a.s)
    .map((x) => ({ player: x.player, place: (scores.indexOf(x.s) + 1) as 1 | 2 | 3 }));
}
