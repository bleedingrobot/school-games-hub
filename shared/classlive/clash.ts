/**
 * Colour Clash (docs/CLASH-PLAN.md): the rules, pure functions only. The class splits into 2 to 4 colour teams; pupils
 * run their avatars about the board (a unit square cut into GRID × GRID tiles) and every tile they cross takes their
 * team's colour. A right answer drops a paint bomb: a splat of their colour round where they stand. Short rounds, the
 * board wiped each time; the team with the most tiles wins the round, the most round wins wins the game.
 *
 * Painting is decided in the database: a pupil's device saves its spot through classlive_clash_paint() (which moves
 * them with classlive_move and paints the tiles on the line from their last saved spot, as `lineTiles` here). Bombs are
 * painted by the server function (`bombTiles`). Movement on the device reuses Four Corners' `stepMove`, so goo, slippy
 * paint, teleports and rollers behave the same on both screens.
 */
import { stepMove as cornersStepMove, type Circle, type MoveRound, type MoveState, type Roller, type Spot, type Teleport } from './corners';

export const CLASH_MAPS = ['park', 'rooftops', 'beach', 'space'] as const;
export type ClashMap = (typeof CLASH_MAPS)[number];

/** Teams are 1 to 4 (0 is a blank tile). */
export type Team = 1 | 2 | 3 | 4;
export const TEAM_WORDS: Record<Team, { name: string; colour: string; emoji: string }> = {
  1: { name: 'Red', colour: '#ef4444', emoji: '🟥' },
  2: { name: 'Blue', colour: '#3b82f6', emoji: '🟦' },
  3: { name: 'Green', colour: '#22c55e', emoji: '🟩' },
  4: { name: 'Yellow', colour: '#facc15', emoji: '🟨' },
};

export const MAP_WORDS: Record<ClashMap, { name: string; goo: string; slip: string; roller: string; fountain: string; portal: string }> = {
  park: { name: 'Paint Park', goo: 'Sticky mud', slip: 'Wet paint', roller: 'Paint roller', fountain: 'Fountain', portal: 'Slide tunnel' },
  rooftops: { name: 'Graffiti Rooftops', goo: 'Tar puddle', slip: 'Oil slick', roller: 'Rolling barrel', fountain: 'Water tower', portal: 'Zip line' },
  beach: { name: 'Splash Beach', goo: 'Soft sand', slip: 'Wet rocks', roller: 'Beach ball', fountain: 'Rock pool', portal: 'Water slide' },
  space: { name: 'Space Paint Lab', goo: 'Gloop', slip: 'Zero-g', roller: 'Rolling asteroid', fountain: 'Reactor', portal: 'Wormhole' },
};

export const POWERS = ['brush', 'speed', 'mega', 'cross'] as const;
export type ClashPower = (typeof POWERS)[number];
export const POWER_WORDS: Record<ClashPower, { name: string; emoji: string; how: string }> = {
  brush: { name: 'Big Brush', emoji: '🖌️', how: 'Your trail is 3 tiles wide for 10 seconds.' },
  speed: { name: 'Speed Shoes', emoji: '👟', how: 'Run faster for 10 seconds.' },
  mega: { name: 'Mega Bomb', emoji: '💥', how: 'This bomb is huge.' },
  cross: { name: 'Rainbow Cross', emoji: '✚', how: 'Paints your whole row and column.' },
};

export const MECHANICS = ['items', 'golden', 'portal', 'goo', 'slip', 'roller', 'fountain'] as const;
export type ClashMechanic = (typeof MECHANICS)[number];
/** The round each mechanic first appears (a few at a time, as Four Corners). */
export const UNLOCK: Record<ClashMechanic, number> = { items: 2, golden: 3, portal: 4, goo: 5, slip: 6, roller: 7, fountain: 8 };

/** Tiles across and down. */
export const GRID = 24;
export const TILE = 1 / GRID;
export const TILES = GRID * GRID;
/** A golden tile counts this many. */
export const GOLDEN_WORTH = 3;
export const READY_MS = 3500;
export const COUNT_MS = 7000;
export const PAINT_S = [45, 60, 90] as const;
export const PAINT_DEFAULT_S = 60;
export const paintSeconds = (v: unknown): number => ((PAINT_S as readonly number[]).includes(v as number) ? (v as number) : PAINT_DEFAULT_S);
export const TEAM_COUNTS = [2, 3, 4] as const;
export const teamCount = (v: unknown): 2 | 3 | 4 => ((TEAM_COUNTS as readonly number[]).includes(v as number) ? (v as 2 | 3 | 4) : 4);
export const ANSWER_GAP_MS = 1500;
/** Power-ups that last (Big Brush, Speed Shoes). */
export const POWER_MS = 10_000;
/** Bomb radius in tiles: bigger on a streak of right answers. */
export const bombRadius = (streak: number, mega: boolean) => (mega ? 5.5 : streak >= 5 ? 3.6 : streak >= 3 ? 2.9 : 2.2);
export const GRAB_R = 0.07;
export const AVATAR_R = 0.035;

export interface ClashItem extends Spot { id: number; power: ClashPower; by: string | null }

export interface ClashRound {
  n: number;
  /** Times in ms since the session started. Painting is open from paintFrom to paintTo. */
  startAt: number;
  paintFrom: number;
  paintTo: number;
  countEnd: number;
  storms: Circle[];
  ice: Circle[];
  teleports: Teleport[];
  roller: Roller | null;
  roller2: Roller | null;
  /** The middle is a fountain: a wall, and its tiles can't be painted. */
  hole: boolean;
  golden: number[];
  items: ClashItem[];
  /** Filled when painting ends: each team's score (golden tiles count GOLDEN_WORTH) and the round's winners. */
  result: { score: number[]; tiles: number[]; winners: Team[] } | null;
}

export interface ClashMine {
  team: Team;
  /** Tiles painted in the whole game (trail and bombs), from the database at each round's end. */
  painted: number;
  bombs: number;
  right: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  answered: number;
  lastAt: number;
  held: ClashPower | null;
  grabs: number;
  powersUsed: number;
  /** Session times a Big Brush / Speed Shoes runs until (the database reads brushTo). */
  brushTo: number | null;
  speedTo: number | null;
  /** Bomb tiles painted (part of `painted`). */
  bombTiles: number;
  /** Bumped when the server moves them (each round's start), so their device snaps to `spot`. */
  placed: number;
  spot: Spot;
}

export interface ClashGame {
  kind: 'clash';
  map: ClashMap;
  teams: 2 | 3 | 4;
  paintS: number;
  /** Epoch ms of the start, for the database's paint window. Null in the lobby. */
  zeroMs: number | null;
  round: ClashRound | null;
  /** Rounds won by each team (index = team; 0 unused), and every tile painted by each team over the game. */
  wins: number[];
  totals: number[];
  history: { n: number; score: number[]; winners: Team[] }[];
  mine: Record<string, ClashMine>;
  nextItem: number;
}

export type ClashEvent =
  | { type: 'clash_round'; t: number; n: number }
  | { type: 'clash_count'; t: number; n: number; score: number[]; winners: Team[] }
  | { type: 'clash_bomb'; t: number; pupil: string; team: Team; x: number; y: number; r: number; power?: ClashPower }
  | { type: 'clash_grab'; t: number; pupil: string; power: ClashPower }
  | { type: 'clash_power'; t: number; pupil: string; power: ClashPower };

// ---- Tiles ----

const clampTile = (v: number) => Math.min(GRID - 1, Math.max(0, Math.floor(v * GRID)));
export const tileOf = (p: Spot) => clampTile(p.y) * GRID + clampTile(p.x);
export const tileCentre = (i: number): Spot => ({ x: ((i % GRID) + 0.5) / GRID, y: (Math.floor(i / GRID) + 0.5) / GRID });
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
export const FOUNTAIN_R = 0.15;
/** Tiles inside the fountain can't be painted (the database checks this too). */
export const inFountain = (i: number) => dist(tileCentre(i), { x: 0.5, y: 0.5 }) < FOUNTAIN_R;

/**
 * Tiles on the line from a to b, in steps of half a tile (classlive_clash_paint does the same). Wide: the 8 around each
 * as well (Big Brush).
 */
export function lineTiles(a: Spot, b: Spot, wide: boolean): number[] {
  const steps = Math.max(1, Math.ceil(dist(a, b) / (TILE / 2)));
  const out = new Set<number>();
  for (let s = 0; s <= steps; s++) {
    const p = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps };
    const cx = clampTile(p.x);
    const cy = clampTile(p.y);
    for (let dy = wide ? -1 : 0; dy <= (wide ? 1 : 0); dy++)
      for (let dx = wide ? -1 : 0; dx <= (wide ? 1 : 0); dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < GRID && y < GRID) out.add(y * GRID + x);
      }
  }
  return [...out];
}

/** A bomb's splat: tiles whose centre is within `r` tiles of the spot. */
export function bombTiles(at: Spot, r: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < TILES; i++) if (dist(tileCentre(i), at) <= r * TILE) out.push(i);
  return out;
}

/** Rainbow Cross: the pupil's whole row and column. */
export function crossTiles(at: Spot): number[] {
  const cx = clampTile(at.x);
  const cy = clampTile(at.y);
  const out: number[] = [];
  for (let i = 0; i < GRID; i++) out.push(cy * GRID + i, i * GRID + cx);
  return [...new Set(out)];
}

/** One character a tile: '0' blank, '1' to '4' a team. */
export const blankTiles = () => '0'.repeat(TILES);

export function applyTiles(tiles: string, changes: [number, number][]): string {
  const a = tiles.split('');
  for (const [i, team] of changes) if (i >= 0 && i < TILES) a[i] = String(team);
  return a.join('');
}

/** Each team's score (golden tiles count more) and plain tile counts; index = team. */
export function scoreTiles(tiles: string, golden: number[], hole: boolean): { score: number[]; tiles: number[] } {
  const score = [0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0];
  const gold = new Set(golden);
  for (let i = 0; i < TILES; i++) {
    const team = Number(tiles[i] ?? '0');
    if (!team || (hole && inFountain(i))) continue;
    counts[team]++;
    score[team] += gold.has(i) ? GOLDEN_WORTH : 1;
  }
  return { score, tiles: counts };
}

// ---- Movement (device and pretend pupils) ----

/** The round as Four Corners' movement sees it (no gate). */
export function moveRound(r: ClashRound | null): MoveRound | null {
  if (!r) return null;
  return { storms: r.storms, ice: r.ice, teleports: r.teleports, roller: r.roller, roller2: r.roller2, hole: r.hole, gate: null, runEnd: r.paintTo };
}

export function stepMove(m: MoveState, dir: Spot, dtMs: number, round: ClashRound | null, t: number, speed: boolean): MoveState {
  return cornersStepMove(m, dir, dtMs, moveRound(round), t, { boost: speed, ghost: false });
}

// ---- Making rounds ----

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length) % list.length];

export function mechanicsFor(n: number, random: () => number): Set<ClashMechanic> {
  const out = new Set<ClashMechanic>();
  const open = MECHANICS.filter((m) => UNLOCK[m] <= n);
  if (open.includes('items')) out.add('items');
  const fresh = MECHANICS.find((m) => UNLOCK[m] === n);
  if (fresh) {
    out.add(fresh);
    const older = open.filter((m) => m !== 'items' && m !== fresh);
    if (older.length && random() < 0.5) out.add(pick(older, random));
    return out;
  }
  const others = open.filter((m) => m !== 'items');
  const count = Math.min(others.length, 2 + Math.floor(random() * 2));
  const bag = [...others];
  while (out.size < count + (open.includes('items') ? 1 : 0) && bag.length) out.add(bag.splice(Math.floor(random() * bag.length), 1)[0]);
  return out;
}

function openSpot(random: () => number, hole: boolean): Spot {
  for (let i = 0; i < 20; i++) {
    const p = { x: 0.1 + random() * 0.8, y: 0.1 + random() * 0.8 };
    if (hole && dist(p, { x: 0.5, y: 0.5 }) < FOUNTAIN_R + 0.06) continue;
    return p;
  }
  return { x: 0.5, y: 0.2 };
}

export function makeRound(g: ClashGame, n: number, startAt: number, random: () => number, players: number): ClashRound {
  const has = mechanicsFor(n, random);
  const hole = has.has('fountain');
  const storms: Circle[] = has.has('goo') ? Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ ...openSpot(random, hole), r: 0.1 + random() * 0.05 })) : [];
  const ice: Circle[] = has.has('slip') ? Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ ...openSpot(random, hole), r: 0.1 + random() * 0.04 })) : [];
  const teleports: Teleport[] = [];
  if (has.has('portal')) {
    const along = 0.3 + random() * 0.4;
    teleports.push(random() < 0.5 ? { a: { x: 0.06, y: along }, b: { x: 0.94, y: 1 - along } } : { a: { x: along, y: 0.06 }, b: { x: 1 - along, y: 0.94 } });
  }
  const line = () => 0.15 + random() * 0.7;
  const roller: Roller | null = has.has('roller') ? { axis: 'x', at: line(), r: 0.07, periodMs: 5000 + Math.floor(random() * 1500) } : null;
  const roller2: Roller | null = has.has('roller') ? { axis: 'y', at: line(), r: 0.07, periodMs: 5600 + Math.floor(random() * 1500) } : null;
  const golden: number[] = [];
  if (has.has('golden')) {
    // A few golden patches of 4 tiles.
    for (let k = 0; k < 3; k++) {
      const p = openSpot(random, hole);
      const t = tileOf(p);
      const x = Math.min(GRID - 2, t % GRID);
      const y = Math.min(GRID - 2, Math.floor(t / GRID));
      golden.push(y * GRID + x, y * GRID + x + 1, (y + 1) * GRID + x, (y + 1) * GRID + x + 1);
    }
  }
  const items: ClashItem[] = [];
  if (has.has('items')) {
    const count = Math.max(2, Math.min(8, Math.round(players / 5)));
    for (let i = 0; i < count; i++) items.push({ id: g.nextItem++, power: pick(POWERS, random), by: null, ...openSpot(random, hole) });
  }
  const paintFrom = startAt + READY_MS;
  const paintTo = paintFrom + g.paintS * 1000;
  return {
    n, startAt, paintFrom, paintTo, countEnd: paintTo + COUNT_MS, storms, ice, teleports, roller, roller2, hole,
    golden: [...new Set(golden)].filter((i) => !(hole && inFountain(i))), items, result: null,
  };
}

export function newClash(map: ClashMap, teams: 2 | 3 | 4, paintS: number = PAINT_DEFAULT_S): ClashGame {
  return { kind: 'clash', map, teams, paintS: paintSeconds(paintS), zeroMs: null, round: null, wins: [0, 0, 0, 0, 0], totals: [0, 0, 0, 0, 0], history: [], mine: {}, nextItem: 1 };
}

/** A new pupil joins the smallest team (the lowest-numbered of the smallest). */
export function teamFor(g: ClashGame): Team {
  const sizes = [0, 0, 0, 0, 0];
  for (const m of Object.values(g.mine)) sizes[m.team]++;
  let best: Team = 1;
  for (let t = 2; t <= g.teams; t++) if (sizes[t] < sizes[best]) best = t as Team;
  return best;
}

export function freshMine(team: Team): ClashMine {
  return {
    team, painted: 0, bombs: 0, right: 0, wrong: 0, streak: 0, bestStreak: 0, answered: 0, lastAt: -ANSWER_GAP_MS, held: null, grabs: 0, powersUsed: 0,
    brushTo: null, speedTo: null, bombTiles: 0, placed: 0, spot: { x: 0.5, y: 0.5 },
  };
}

/** Where each team starts: its own side of the board. */
export function startSpot(team: Team, teams: number, i: number): Spot {
  const sides: Spot[] = teams === 2 ? [{ x: 0.15, y: 0.5 }, { x: 0.85, y: 0.5 }] : [{ x: 0.15, y: 0.15 }, { x: 0.85, y: 0.15 }, { x: 0.85, y: 0.85 }, { x: 0.15, y: 0.85 }];
  const c = sides[(team - 1) % sides.length];
  return { x: c.x + ((i % 3) - 1) * 0.04, y: c.y + ((Math.floor(i / 3) % 3) - 1) * 0.04 };
}

export const painting = (r: ClashRound | null, t: number) => !!r && r.result === null && t >= r.paintFrom && t < r.paintTo;
export const speedy = (m: ClashMine | undefined, t: number) => !!m && m.speedTo !== null && t < m.speedTo;
export const brushy = (m: ClashMine | undefined, t: number) => !!m && m.brushTo !== null && t < m.brushTo;

// ---- Moving the game on ----

/** The time of the next thing the server must do (count a round, start the next), or null. */
export function nextDeadline(g: ClashGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  if (!g.round) return 0;
  if (g.round.result === null) return g.round.paintTo;
  return g.round.countEnd;
}

/** Painting has ended and the round isn't counted yet: the server needs the board. */
export const needsTiles = (g: ClashGame, t: number) => !!g.round && g.round.result === null && t >= g.round.paintTo;

export const clashDone = (g: ClashGame, t: number) => !g.round || (g.round.result !== null && t >= g.round.countEnd);

/**
 * Moves the game on to time t: counts the round (from `board`, the database's tiles, and `painted`, tiles painted by
 * each pupil in the whole game), starts the next. When `last` (time is up), no new round starts.
 */
export function advance(g: ClashGame, t: number, order: string[], board: { tiles: string; painted: Record<string, number> } | null, random: () => number, last = false): ClashEvent[] {
  const events: ClashEvent[] = [];
  for (let guard = 0; guard < 4; guard++) {
    const r = g.round;
    if (!r) {
      if (last) break;
      g.round = makeRound(g, 1, Math.max(0, t), random, order.length);
      events.push({ type: 'clash_round', t, n: 1 });
      continue;
    }
    if (r.result === null) {
      if (t < r.paintTo || !board) break;
      const { score, tiles } = scoreTiles(board.tiles, r.golden, r.hole);
      const top = Math.max(...score.slice(1, g.teams + 1));
      const winners = top > 0 ? ([1, 2, 3, 4] as Team[]).filter((tm) => tm <= g.teams && score[tm] === top) : [];
      r.result = { score, tiles, winners };
      for (const w of winners) g.wins[w]++;
      for (let tm = 1; tm <= 4; tm++) g.totals[tm] += tiles[tm];
      g.history.push({ n: r.n, score, winners });
      for (const id of order) if (g.mine[id] && board.painted[id] !== undefined) g.mine[id].painted = Math.max(g.mine[id].painted, board.painted[id]);
      events.push({ type: 'clash_count', t: r.paintTo, n: r.n, score, winners });
      continue;
    }
    if (t < r.countEnd || last) break;
    const startAt = t - r.countEnd > 2000 ? t : r.countEnd;
    for (const m of Object.values(g.mine)) {
      m.brushTo = null;
      m.speedTo = null;
    }
    g.round = makeRound(g, r.n + 1, startAt, random, order.length);
    events.push({ type: 'clash_round', t: startAt, n: r.n + 1 });
  }
  return events;
}

/** Running over an item picks it up (one at a time, while painting). */
export function grab(g: ClashGame, who: string, itemId: unknown, at: Spot | undefined, t: number): { ok: true; events: ClashEvent[] } | { ok: false; reason: 'not_now' | 'gone' | 'far' | 'full' } {
  const r = g.round;
  const m = g.mine[who];
  if (!m || !painting(r, t)) return { ok: false, reason: 'not_now' };
  if (m.held) return { ok: false, reason: 'full' };
  const item = r!.items.find((x) => x.id === itemId);
  if (!item || item.by) return { ok: false, reason: 'gone' };
  if (!at || dist(at, item) > GRAB_R + AVATAR_R + 0.03) return { ok: false, reason: 'far' };
  item.by = who;
  m.held = item.power;
  m.grabs++;
  return { ok: true, events: [{ type: 'clash_grab', t, pupil: who, power: item.power }] };
}

/** Can this pupil ask for a question now (painting is on)? */
export const canAsk = (g: ClashGame, who: string, t: number) => !!g.mine[who] && painting(g.round, t);

/**
 * A marked answer. A right one drops a paint bomb at `at` (their saved spot) and switches on a held power-up. Returns
 * the tiles to paint (the server paints them in the database).
 */
export function answered(g: ClashGame, who: string, right: boolean, at: Spot | undefined, t: number): { ok: true; events: ClashEvent[]; tiles: number[] } | { ok: false; reason: 'too_soon' | 'not_now' } {
  const m = g.mine[who];
  const r = g.round;
  if (!m || !r || !painting(r, t)) return { ok: false, reason: 'not_now' };
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (!right) {
    m.wrong++;
    m.streak = 0;
    return { ok: true, events: [], tiles: [] };
  }
  m.right++;
  m.streak++;
  m.bestStreak = Math.max(m.bestStreak, m.streak);
  const spot = at ?? { x: 0.5, y: 0.5 };
  const power = m.held;
  const events: ClashEvent[] = [];
  if (power) {
    m.held = null;
    m.powersUsed++;
    events.push({ type: 'clash_power', t, pupil: who, power });
    if (power === 'brush') m.brushTo = t + POWER_MS;
    if (power === 'speed') m.speedTo = t + POWER_MS;
  }
  const radius = bombRadius(m.streak, power === 'mega');
  let tiles = bombTiles(spot, radius);
  if (power === 'cross') tiles = [...new Set([...tiles, ...crossTiles(spot)])];
  if (r.hole) tiles = tiles.filter((i) => !inFountain(i));
  m.bombs++;
  m.bombTiles += tiles.length;
  events.push({ type: 'clash_bomb', t, pupil: who, team: m.team, x: spot.x, y: spot.y, r: radius, ...(power ? { power } : {}) });
  return { ok: true, events, tiles };
}

/** Teams in order, best first: round wins, then tiles over the game. Ties share a place. */
export function standings(g: ClashGame): { team: Team; wins: number; tiles: number; place: number }[] {
  const teams = ([1, 2, 3, 4] as Team[]).filter((t) => t <= g.teams).map((team) => ({ team, wins: g.wins[team], tiles: g.totals[team], place: 0 }));
  teams.sort((a, b) => b.wins - a.wins || b.tiles - a.tiles);
  teams.forEach((x, i) => {
    const prev = teams[i - 1];
    x.place = prev && prev.wins === x.wins && prev.tiles === x.tiles ? prev.place : i + 1;
  });
  return teams;
}

/** The winning team(s): first place, if any round was played and won. */
export const champions = (g: ClashGame): Team[] => (g.history.some((h) => h.winners.length) ? standings(g).filter((x) => x.place === 1).map((x) => x.team) : []);

/** A pretend pupil's joystick: wander towards a target, a new one now and then. */
export function pretendDir(p: Spot, target: Spot, random: () => number): Spot {
  const dx = target.x - p.x + (random() - 0.5) * 0.1;
  const dy = target.y - p.y + (random() - 0.5) * 0.1;
  const len = Math.hypot(dx, dy);
  return len < 0.03 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}
