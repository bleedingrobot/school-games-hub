/**
 * Ghost Tag (Class Live activity `ghost`, docs/GHOST-PLAN.md): every pupil runs their own avatar around a spooky map.
 * A few start each round as ghosts; a ghost that touches a pupil turns them into a ghost too. A right answer makes a
 * pupil invisible for a few seconds (ghosts can't catch them); a ghost's right answer gives a speed dash or a lantern
 * that shows invisible pupils near it. The round ends with the last one standing (or the survivors when its time is
 * up); then new ghosts are picked. Pure rules: the server (shared/classlive/server.ts) and the screens share them.
 *
 * Times are ms since the session started. Positions are board units (a unit square), as Four Corners.
 *
 * Tagging and lag: pupils' devices save their spot every 0.4 s (0.25 s with a ghost near) through the database, and
 * the big screen asks the server to check for tags about twice a second. A tag counts when a ghost's saved spot and a
 * pupil's saved spot are within TAG_R; TAG_R is a little bigger than two touching avatars, so a catch that looked
 * right on the screen counts even with the spots a moment old.
 */
import { rollerAt, type Circle, type Roller, type Spot, type Teleport } from './corners';

export const MAPS = ['graveyard', 'mansion', 'pumpkin', 'ship'] as const;
export type GhostMap = (typeof MAPS)[number];

export const POWERS = ['shield', 'boots', 'freeze'] as const;
export type GhostPower = (typeof POWERS)[number];

export const MECHANICS = ['items', 'teleport', 'slow', 'fog', 'bats'] as const;
export type GhostMechanic = (typeof MECHANICS)[number];
/** The round each mechanic first comes in (James, 25 Nov 2026 NZ: extras unlocked round by round). */
export const UNLOCK: Record<GhostMechanic, number> = { items: 2, teleport: 3, slow: 4, fog: 5, bats: 6 };

/** Each map's own words for the same things. */
export const MAP_WORDS: Record<GhostMap, { name: string; crypt: string; stone: string; stones: string; slow: string; teleport: string; bats: string; fog: string }> = {
  graveyard: { name: 'Moonlit Graveyard', crypt: 'the crypt', stone: 'Tombstone', stones: 'Tombstones', slow: 'Cobwebs', teleport: 'Open grave', bats: 'Bat swarm', fog: 'Graveyard fog' },
  mansion: { name: 'Haunted Mansion', crypt: 'the old fireplace', stone: 'Armchair', stones: 'Armchairs', slow: 'Spilled potion', teleport: 'Magic mirror', bats: 'Flying books', fog: 'Dust cloud' },
  pumpkin: { name: 'Pumpkin Patch', crypt: 'the scarecrow', stone: 'Giant pumpkin', stones: 'Giant pumpkins', slow: 'Sticky mud', teleport: 'Hollow log', bats: 'Crow flock', fog: 'Night mist' },
  ship: { name: 'Ghost Ship', crypt: "the captain's wheel", stone: 'Barrel', stones: 'Barrels', slow: 'Slimy seaweed', teleport: 'Trapdoor', bats: 'Ghost gulls', fog: 'Sea fog' },
};

export const POWER_WORDS: Record<GhostPower, { name: string; emoji: string; how: string }> = {
  shield: { name: 'Garlic shield', emoji: '🧄', how: 'A ghost that touches you bounces off once.' },
  boots: { name: 'Speed boots', emoji: '👟', how: 'You run faster for a few seconds.' },
  freeze: { name: 'Frost bomb', emoji: '❄️', how: 'Ghosts near you freeze solid for a moment.' },
};

// ---- Sizes and speeds ----

export const AVATAR_R = 0.03;
/** A ghost this close (centre to centre) catches you. Two touching avatars are 0.06 apart. */
export const TAG_R = 0.07;
/** Pupils' and ghosts' speeds, board widths a second. */
export const SPEED = 0.28;
export const GHOST_SPEED = 0.265;
export const DASH = 1.55;
export const BOOTS = 1.35;
export const SLOW = 0.5;
/** The database's clamp (classlive_activities.max_speed) allows this much, with slack (a bat knock is faster, briefly). */
export const MAX_SPEED = 0.6;
export const GRAB_R = 0.06;
/** A grab is checked against the saved spot, which can be a moment behind. */
export const GRAB_SLACK = 0.07;
export const TELEPORT_R = 0.04;
export const CRYPT: Circle = { x: 0.5, y: 0.5, r: 0.09 };
export const KNOCK_SPEED = 0.8;
export const KNOCK_MS = 500;

// ---- Times ----

/** From a round being made to the ghosts being let out of the crypt. */
export const READY_MS = 4000;
/** Longest a round runs once the ghosts are out. */
export const ROUND_MS = 90_000;
/** The end-of-round show (who won), before the next round is made. */
export const SHOW_MS = 6500;
/** A new ghost rises for this long before it can catch anyone. */
export const RISE_MS = 1500;
/** Invisible after a right answer (James's pick on the card, 25 Nov 2026 NZ: 5 s recommended). */
export const HIDE_MS = 5000;
/** A garlic shield's bounce: invisible this long, so the same ghost can't catch you straight away. */
export const BOUNCE_MS = 2000;
export const DASH_MS = 3000;
export const LANTERN_MS = 3500;
export const LANTERN_R = 0.28;
export const BOOTS_MS = 5000;
export const FREEZE_MS = 2500;
export const FREEZE_R = 0.25;
/** Least time between two answers (a wrong one too). */
export const ANSWER_GAP_MS = 1500;

/** Ghosts at the start of a round: one for every 10 pupils (James, 25 Nov 2026 NZ), at least 1, never everyone. */
export const ghostCount = (players: number) => (players < 2 ? 0 : Math.max(1, Math.min(players - 1, Math.ceil(players / 10))));

// ---- The game ----

export interface GhostItem extends Spot { id: number; power: GhostPower; by: string | null }

export interface GhostRound {
  n: number;
  /** The round was made (pupils placed); ghosts are let out at `startAt`. */
  readyAt: number;
  startAt: number;
  /** The round's time runs out here (survivors win). */
  endAt: number;
  /** Ghosts at the start. */
  starters: string[];
  /** Pupils (not ghosts) at the start. */
  humans: number;
  stones: Circle[];
  slows: Circle[];
  teleports: Teleport[];
  bats: Roller[];
  fog: boolean;
  items: GhostItem[];
  /** Set when the round ends. `winners`: the last one standing, or everyone not caught when the time ran out. */
  done: null | { at: number; why: 'last' | 'time' | 'all'; winners: string[] };
  /** When the end-of-round show finishes (the next round is made). */
  showEnd: number | null;
}

export interface GhostMine {
  ghost: boolean;
  /** Session time they were caught this round, and who by. */
  caughtAt: number | null;
  caughtBy: string | null;
  /** Invisible until (session time). */
  hideTo: number;
  dashTo: number;
  lanternTo: number;
  frozenTo: number;
  bootsTo: number;
  shield: boolean;
  /** Ghost right answers alternate: even a dash, odd a lantern. */
  ghostRight: number;
  spot: Spot;
  /** Bumped each time the server moves them (a new round); their device snaps to `spot`. */
  placed: number;
  lastAt: number;
  answered: number;
  right: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  /** Pupils they caught as a ghost (all game). */
  tags: number;
  /** Rounds won: the last one standing, or not caught when the time ran out. */
  crowns: number;
  /** Rounds they were caught in. */
  caught: number;
  /** Rounds they started as a ghost. */
  starts: number;
  vanishes: number;
  grabs: number;
  shieldSaves: number;
  /** Time not caught in rounds (ms), all game. */
  aliveMs: number;
  /** How their last finished round went. */
  last: 'last' | 'survived' | 'caught' | 'ghost' | null;
}

export interface GhostGame {
  kind: 'ghost';
  map: GhostMap;
  round: GhostRound | null;
  mine: Record<string, GhostMine>;
  nextItem: number;
}

export type GhostEvent =
  | { type: 'g_round'; t: number; n: number; starters: string[] }
  | { type: 'g_hunt'; t: number; n: number }
  | { type: 'g_tag'; t: number; pupil: string; by: string }
  | { type: 'g_bounce'; t: number; pupil: string; by: string }
  | { type: 'g_vanish'; t: number; pupil: string }
  | { type: 'g_dash'; t: number; pupil: string }
  | { type: 'g_lantern'; t: number; pupil: string }
  | { type: 'g_grab'; t: number; pupil: string; power: GhostPower; froze: number }
  | { type: 'g_end'; t: number; n: number; why: 'last' | 'time' | 'all'; winners: string[] };

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.min(1 - AVATAR_R, Math.max(AVATAR_R, v));
const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length) % list.length];

export function newGhost(map: GhostMap): GhostGame {
  return { kind: 'ghost', map, round: null, mine: {}, nextItem: 1 };
}

/** A spot round the edge of the map, spread by number (pupils start here). */
export function edgeSpot(i: number, of: number): Spot {
  const a = (i / Math.max(1, of)) * Math.PI * 2 + 0.4;
  const r = 0.36 + (i % 2) * 0.05;
  return { x: clamp01(0.5 + Math.cos(a) * r), y: clamp01(0.5 + Math.sin(a) * r) };
}

/** A seat in the crypt (ghosts start here). */
export function cryptSpot(i: number, of: number): Spot {
  if (of <= 1) return { x: 0.5, y: 0.5 };
  const a = (i / of) * Math.PI * 2;
  return { x: 0.5 + Math.cos(a) * CRYPT.r * 0.55, y: 0.5 + Math.sin(a) * CRYPT.r * 0.55 };
}

export function freshMine(i: number, of = 30): GhostMine {
  return {
    ghost: false, caughtAt: null, caughtBy: null, hideTo: 0, dashTo: 0, lanternTo: 0, frozenTo: 0, bootsTo: 0, shield: false, ghostRight: 0,
    spot: edgeSpot(i, of), placed: 0, lastAt: -ANSWER_GAP_MS, answered: 0, right: 0, wrong: 0, streak: 0, bestStreak: 0,
    tags: 0, crowns: 0, caught: 0, starts: 0, vanishes: 0, grabs: 0, shieldSaves: 0, aliveMs: 0, last: null,
  };
}

/** Which mechanics a round has: each new one on its unlock round (with an earlier one sometimes), then a mix of 2 to 4. */
export function mechanicsFor(n: number, random: () => number): Set<GhostMechanic> {
  const open = MECHANICS.filter((m) => UNLOCK[m] <= n);
  const fresh = MECHANICS.find((m) => UNLOCK[m] === n);
  const out = new Set<GhostMechanic>();
  if (fresh) {
    out.add(fresh);
    const old = open.filter((m) => m !== fresh);
    if (old.length && random() < 0.5) out.add(pick(old, random));
    if (open.includes('items') && random() < 0.7) out.add('items');
    return out;
  }
  if (!open.length) return out;
  const want = Math.min(open.length, 2 + Math.floor(random() * 3));
  const pool = [...open];
  while (out.size < want && pool.length) out.add(pool.splice(Math.floor(random() * pool.length) % pool.length, 1)[0]);
  return out;
}

/** A clear spot for something new: away from the crypt, the edge and what is already placed. */
function openSpot(random: () => number, taken: Circle[], r: number): Spot {
  for (let i = 0; i < 30; i++) {
    const p = { x: 0.1 + random() * 0.8, y: 0.1 + random() * 0.8 };
    if (dist(p, CRYPT) < CRYPT.r + r + 0.05) continue;
    if (taken.some((c) => dist(c, p) < c.r + r + 0.04)) continue;
    return p;
  }
  return { x: 0.2 + random() * 0.6, y: 0.15 };
}

/** Who starts as a ghost: those who started fewest times so far, then at random. */
export function pickStarters(g: GhostGame, order: string[], random: () => number): string[] {
  const k = ghostCount(order.length);
  const shuffled = order.map((id) => ({ id, s: g.mine[id]?.starts ?? 0, r: random() })).sort((a, b) => a.s - b.s || a.r - b.r);
  return shuffled.slice(0, k).map((x) => x.id);
}

/** A new round: everyone is a pupil again but the starters, pupils round the edge, ghosts in the crypt. */
export function makeRound(g: GhostGame, n: number, readyAt: number, order: string[], random: () => number): GhostRound {
  const has = mechanicsFor(n, random);
  const stones: Circle[] = [];
  const count = 6 + Math.floor(random() * 3);
  for (let i = 0; i < count; i++) {
    const r = 0.035 + random() * 0.025;
    stones.push({ ...openSpot(random, stones, r), r });
  }
  const slows: Circle[] = has.has('slow') ? Array.from({ length: 2 }, () => ({ ...openSpot(random, stones, 0.09), r: 0.08 + random() * 0.03 })) : [];
  const teleports: Teleport[] = [];
  if (has.has('teleport')) {
    const along = 0.25 + random() * 0.5;
    teleports.push(random() < 0.5 ? { a: { x: 0.07, y: along }, b: { x: 0.93, y: 1 - along } } : { a: { x: along, y: 0.07 }, b: { x: 1 - along, y: 0.93 } });
  }
  const bats: Roller[] = has.has('bats') ? [{ axis: random() < 0.5 ? 'x' : 'y', at: 0.2 + random() * 0.6, r: 0.06, periodMs: 5000 + Math.floor(random() * 2000) }] : [];
  const items: GhostItem[] = [];
  if (has.has('items')) {
    const k = Math.max(2, Math.min(7, Math.round(order.length / 6)));
    const taken = [...stones, ...slows];
    for (let i = 0; i < k; i++) {
      const p = openSpot(random, taken, GRAB_R);
      taken.push({ ...p, r: GRAB_R });
      items.push({ id: g.nextItem++, power: pick(POWERS, random), by: null, ...p });
    }
  }
  const starters = pickStarters(g, order, random);
  const humans = order.filter((id) => !starters.includes(id));
  order.forEach((id) => {
    const m = (g.mine[id] ??= freshMine(order.indexOf(id), order.length));
    const ghost = starters.includes(id);
    Object.assign(m, { ghost, caughtAt: null, caughtBy: null, hideTo: 0, dashTo: 0, lanternTo: 0, frozenTo: 0, bootsTo: 0, shield: false });
    if (ghost) m.starts++;
    m.spot = ghost ? cryptSpot(starters.indexOf(id), starters.length) : edgeSpot(humans.indexOf(id), humans.length);
    // Off a stone.
    for (const s of stones) if (dist(m.spot, s) < s.r + AVATAR_R) m.spot = { x: clamp01(m.spot.x), y: clamp01(s.y + (m.spot.y < s.y ? -1 : 1) * (s.r + AVATAR_R + 0.005)) };
    m.placed++;
  });
  return {
    n, readyAt, startAt: readyAt + READY_MS, endAt: readyAt + READY_MS + ROUND_MS, starters, humans: humans.length,
    stones, slows, teleports, bats, fog: has.has('fog'), items, done: null, showEnd: null,
  };
}

export const isHidden = (m: GhostMine | undefined, t: number) => !!m && !m.ghost && m.hideTo > t;
export const isFrozen = (m: GhostMine | undefined, t: number) => !!m && m.ghost && m.frozenTo > t;
/** A ghost that can catch: out of the crypt, risen, not frozen. */
export const canCatch = (m: GhostMine | undefined, t: number) => !!m && m.ghost && (m.caughtAt === null || t - m.caughtAt >= RISE_MS) && m.frozenTo <= t;
export const alive = (g: GhostGame, order: string[]) => order.filter((id) => g.mine[id] && !g.mine[id].ghost);

/** The server needs the saved spots: a hunt is on. */
export const needsPositions = (g: GhostGame, t: number) => !!g.round && !g.round.done && t >= g.round.startAt;

/** The game can end: no round, or the last round's show is over. */
export const ghostDone = (g: GhostGame, t: number) => !g.round || (g.round.done !== null && g.round.showEnd !== null && t >= g.round.showEnd);

/** The next time the game moves on by itself (ghosts out, time up, the next round), or null. */
export function nextDeadline(g: GhostGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  const r = g.round;
  if (!r) return 0;
  if (r.done) return r.showEnd;
  return r.endAt;
}

/**
 * Moves the game on at time t: the first round, ghosts let out, tags (from the saved spots), the round's end, the
 * next round. `last`: the session's time is up, so a round that is on ends now and no new one starts.
 */
export function advance(g: GhostGame, t: number, order: string[], positions: Record<string, Spot>, random: () => number, last = false): GhostEvent[] {
  const events: GhostEvent[] = [];
  const begin = (readyAt: number) => {
    if (order.length < 2 || last) return;
    const n = (g.round?.n ?? 0) + 1;
    g.round = makeRound(g, n, readyAt, order, random);
    events.push({ type: 'g_round', t, n, starters: [...g.round.starters] });
  };
  if (!g.round) {
    begin(t);
    return events;
  }
  const r = g.round;
  if (!r.done) {
    if (t >= r.startAt) {
      // Spots: what devices saved, else where the server last put them.
      for (const id of order) {
        const p = positions[id];
        if (p && g.mine[id]) g.mine[id].spot = { x: p.x, y: p.y };
      }
      events.push(...tags(g, r, t, order));
    }
    const left = alive(g, order);
    if (!r.done) {
      if (r.humans >= 2 && left.length <= 1) endRound(g, r, t, left.length ? 'last' : 'all', left, order, events);
      else if (r.humans < 2 && left.length === 0) endRound(g, r, t, 'all', [], order, events);
      else if (t >= r.endAt || last) endRound(g, r, Math.min(t, r.endAt), 'time', left, order, events);
    }
    return events;
  }
  if (r.showEnd !== null && t >= r.showEnd) begin(t);
  return events;
}

/** Ghosts catch pupils within TAG_R (the closest ghost does it). A garlic shield bounces one catch. */
function tags(g: GhostGame, r: GhostRound, t: number, order: string[]): GhostEvent[] {
  const out: GhostEvent[] = [];
  const hunters = order.filter((id) => canCatch(g.mine[id], t));
  if (!hunters.length) return out;
  const caughtNow = new Set<string>();
  for (const id of order) {
    const m = g.mine[id];
    if (!m || m.ghost) continue;
    let best: { by: string; d: number } | null = null;
    for (const gid of hunters) {
      if (caughtNow.has(gid)) continue;
      const gm = g.mine[gid];
      // An invisible pupil can only be caught by a ghost with its lantern lit.
      if (m.hideTo > t && gm.lanternTo <= t) continue;
      const d = dist(m.spot, gm.spot);
      if (d <= TAG_R && (!best || d < best.d)) best = { by: gid, d };
    }
    if (!best) continue;
    if (m.shield) {
      m.shield = false;
      m.hideTo = Math.max(m.hideTo, t + BOUNCE_MS);
      m.shieldSaves++;
      out.push({ type: 'g_bounce', t, pupil: id, by: best.by });
      continue;
    }
    m.ghost = true;
    m.caughtAt = t;
    m.caughtBy = best.by;
    m.caught++;
    m.hideTo = 0;
    m.bootsTo = 0;
    m.aliveMs += Math.max(0, t - r.startAt);
    g.mine[best.by].tags++;
    caughtNow.add(id);
    out.push({ type: 'g_tag', t, pupil: id, by: best.by });
  }
  return out;
}

function endRound(g: GhostGame, r: GhostRound, t: number, why: 'last' | 'time' | 'all', winners: string[], order: string[], events: GhostEvent[]) {
  r.done = { at: t, why, winners: [...winners] };
  r.showEnd = t + SHOW_MS;
  for (const id of order) {
    const m = g.mine[id];
    if (!m) continue;
    if (!m.ghost) {
      m.aliveMs += Math.max(0, t - r.startAt);
      m.crowns++;
      m.last = why === 'last' ? 'last' : 'survived';
    } else m.last = r.starters.includes(id) ? 'ghost' : 'caught';
  }
  events.push({ type: 'g_end', t, n: r.n, why, winners: [...winners] });
}

/** Can this player get a question now? Pupils: not while invisible. Ghosts: not while frozen. Only while a hunt is on. */
export function canAsk(g: GhostGame, who: string, t: number): boolean {
  const r = g.round;
  const m = g.mine[who];
  if (!r || r.done || !m || t < r.readyAt) return false;
  if (t < m.lastAt + ANSWER_GAP_MS) return false;
  return m.ghost ? m.frozenTo <= t : m.hideTo <= t;
}

/** A marked answer: a pupil's right answer makes them invisible; a ghost's gives a dash, then a lantern, in turn. */
export function answered(g: GhostGame, who: string, right: boolean, t: number): { ok: true; events: GhostEvent[]; gave: 'hide' | 'dash' | 'lantern' | null } | { ok: false; reason: 'too_soon' | 'not_now' } {
  const m = g.mine[who];
  const r = g.round;
  if (!m || !r || r.done) return { ok: false, reason: 'not_now' };
  if (t < m.lastAt + ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (!right) {
    m.wrong++;
    m.streak = 0;
    return { ok: true, events: [], gave: null };
  }
  m.right++;
  m.streak++;
  m.bestStreak = Math.max(m.bestStreak, m.streak);
  if (!m.ghost) {
    m.hideTo = Math.max(t, r.startAt) + HIDE_MS;
    m.vanishes++;
    return { ok: true, events: [{ type: 'g_vanish', t, pupil: who }], gave: 'hide' };
  }
  const dash = m.ghostRight % 2 === 0;
  m.ghostRight++;
  if (dash) m.dashTo = Math.max(t, r.startAt) + DASH_MS;
  else m.lanternTo = Math.max(t, r.startAt) + LANTERN_MS;
  return { ok: true, events: [{ type: dash ? 'g_dash' : 'g_lantern', t, pupil: who }], gave: dash ? 'dash' : 'lantern' };
}

/** A pupil (not a ghost) runs over a power-up: checked against their saved spot. A frost bomb freezes ghosts near. */
export function grab(g: GhostGame, who: string, itemId: unknown, at: Spot | undefined, t: number): { ok: true; events: GhostEvent[] } | { ok: false; reason: 'not_now' | 'gone' | 'far' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || r.done || !m || m.ghost || !at) return { ok: false, reason: 'not_now' };
  const it = r.items.find((x) => x.id === itemId);
  if (!it || it.by) return { ok: false, reason: 'gone' };
  if (dist(it, at) > GRAB_R + AVATAR_R + GRAB_SLACK) return { ok: false, reason: 'far' };
  it.by = who;
  m.grabs++;
  let froze = 0;
  if (it.power === 'shield') m.shield = true;
  else if (it.power === 'boots') m.bootsTo = Math.max(t, r.startAt) + BOOTS_MS;
  else {
    for (const gm of Object.values(g.mine)) {
      if (gm.ghost && dist(gm.spot, at) <= FREEZE_R) { gm.frozenTo = Math.max(t, r.startAt) + FREEZE_MS; froze++; }
    }
  }
  return { ok: true, events: [{ type: 'g_grab', t, pupil: who, power: it.power, froze }] };
}

/** The podium: most rounds won (crowns), then most catches. Ties share a place. */
export function podium(g: GhostGame, order: string[]): { player: string; place: 1 | 2 | 3 }[] {
  const score = (id: string) => (g.mine[id]?.crowns ?? 0) * 1000 + (g.mine[id]?.tags ?? 0);
  const scores = [...new Set(order.map(score))].filter((s) => s > 0).sort((a, b) => b - a).slice(0, 3);
  return order.map((id) => ({ player: id, s: score(id) })).filter((x) => scores.includes(x.s)).sort((a, b) => b.s - a.s)
    .map((x) => ({ player: x.player, place: (scores.indexOf(x.s) + 1) as 1 | 2 | 3 }));
}

// ---- Moving (devices, the preview's pretend pupils) ----

export interface GhostMove {
  p: Spot;
  v: Spot;
  /** Knocked by the bats: no steering until then. */
  stun?: number;
  hitAt?: number;
  /** Just warped: not again until then (so you don't bounce back). */
  warpTo?: number;
}

export type MoveRoundG = Pick<GhostRound, 'stones' | 'slows' | 'teleports' | 'bats' | 'startAt'>;

/** Current speed multiplier for a player. */
export function speedOf(m: Pick<GhostMine, 'ghost' | 'dashTo' | 'bootsTo' | 'frozenTo'>, t: number): number {
  if (m.ghost) return m.frozenTo > t ? 0 : GHOST_SPEED * (m.dashTo > t ? DASH : 1);
  return SPEED * (m.bootsTo > t ? BOOTS : 1);
}

/**
 * One step of movement: `dir` is the joystick (length 0 to 1), dt in ms. Pupils bump into the stones and are slowed
 * by the sticky patches; ghosts glide through both but stay in the crypt until the hunt starts. Bats knock pupils
 * flying. Teleports warp anyone to the other end.
 */
export function stepGhost(m: GhostMove, dir: Spot, dtMs: number, round: MoveRoundG | null, t: number, o: { ghost: boolean; speed: number }): GhostMove {
  const dt = Math.min(100, Math.max(0, dtMs)) / 1000;
  const stones = (p: Spot) => {
    if (o.ghost || !round) return p;
    let q = p;
    for (const s of round.stones) {
      const d = dist(q, s);
      const min = s.r + AVATAR_R;
      if (d < min) {
        const ax = d < 1e-6 ? 1 : (q.x - s.x) / d;
        const ay = d < 1e-6 ? 0 : (q.y - s.y) / d;
        q = { x: clamp01(s.x + ax * min), y: clamp01(s.y + ay * min) };
      }
    }
    return q;
  };
  if (m.stun !== undefined && t < m.stun) {
    const k = Math.max(0, 1 - dt * 2.4);
    const v = { x: m.v.x * k, y: m.v.y * k };
    return { ...m, p: stones({ x: clamp01(m.p.x + v.x * dt), y: clamp01(m.p.y + v.y * dt) }), v };
  }
  const len = Math.hypot(dir.x, dir.y);
  const d = len > 1 ? { x: dir.x / len, y: dir.y / len } : dir;
  let speed = o.speed;
  if (round && !o.ghost && round.slows.some((c) => dist(c, m.p) < c.r)) speed *= SLOW;
  const v = { x: d.x * speed, y: d.y * speed };
  let p = stones({ x: clamp01(m.p.x + v.x * dt), y: clamp01(m.p.y + v.y * dt) });
  // Ghosts wait in the crypt until the hunt.
  if (round && o.ghost && t < round.startAt) {
    const c = dist(p, CRYPT);
    if (c > CRYPT.r - AVATAR_R * 0.5) {
      const k = (CRYPT.r - AVATAR_R * 0.5) / c;
      p = { x: CRYPT.x + (p.x - CRYPT.x) * k, y: CRYPT.y + (p.y - CRYPT.y) * k };
    }
  }
  if (round && !o.ghost) {
    for (const b of round.bats) {
      const at = rollerAt(b, t);
      if (dist(p, at) < b.r + AVATAR_R) {
        const a = Math.atan2(p.y - at.y, p.x - at.x);
        const kv = { x: Math.cos(a) * KNOCK_SPEED, y: Math.sin(a) * KNOCK_SPEED };
        const push = b.r + AVATAR_R + 0.01;
        return { p: stones({ x: clamp01(at.x + Math.cos(a) * push), y: clamp01(at.y + Math.sin(a) * push) }), v: kv, stun: t + KNOCK_MS, hitAt: t, ...(m.warpTo !== undefined ? { warpTo: m.warpTo } : {}) };
      }
    }
  }
  if (round && (m.warpTo === undefined || t >= m.warpTo)) {
    for (const tp of round.teleports) {
      if (dist(p, tp.a) < TELEPORT_R) return { p: { x: clamp01(tp.b.x + v.x * 0.2), y: clamp01(tp.b.y + v.y * 0.2) }, v: { x: 0, y: 0 }, warpTo: t + 900, ...(m.hitAt !== undefined ? { hitAt: m.hitAt } : {}) };
      if (dist(p, tp.b) < TELEPORT_R) return { p: { x: clamp01(tp.a.x + v.x * 0.2), y: clamp01(tp.a.y + v.y * 0.2) }, v: { x: 0, y: 0 }, warpTo: t + 900, ...(m.hitAt !== undefined ? { hitAt: m.hitAt } : {}) };
    }
  }
  return { p, v: { x: 0, y: 0 }, ...(m.hitAt !== undefined ? { hitAt: m.hitAt } : {}), ...(m.warpTo !== undefined ? { warpTo: m.warpTo } : {}) };
}

/** A pretend pupil's joystick: pupils run from the nearest ghost (towards open space), ghosts chase the nearest pupil. */
export function pretendDir(me: Spot, ghost: boolean, others: { p: Spot; ghost: boolean }[], random: () => number): Spot {
  const targets = others.filter((o) => o.ghost !== ghost);
  if (!targets.length) return { x: random() - 0.5, y: random() - 0.5 };
  const near = targets.reduce((a, b) => (dist(a.p, me) < dist(b.p, me) ? a : b));
  let dx = near.p.x - me.x;
  let dy = near.p.y - me.y;
  if (!ghost) {
    dx = -dx; dy = -dy;
    // Away from walls.
    dx += (0.5 - me.x) * 0.8;
    dy += (0.5 - me.y) * 0.8;
  }
  dx += (random() - 0.5) * 0.3;
  dy += (random() - 0.5) * 0.3;
  const len = Math.hypot(dx, dy);
  return len < 0.01 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

// ---- What pupils' devices see ----

/** The room's public copy: no names, no ids, who is a ghost left out (pupils' devices get spots with roles instead). */
export interface PublicGhost {
  kind: 'ghost';
  map: GhostMap;
  round: null | (Omit<GhostRound, 'starters' | 'items' | 'done'> & { items: Omit<GhostItem, 'by'>[]; done: null | { at: number; why: 'last' | 'time' | 'all'; winners: number } });
  /** Pupils not caught, and ghosts, now. */
  humans: number;
  ghosts: number;
}

export function publicGhost(g: GhostGame, order: string[]): PublicGhost {
  const r = g.round;
  const left = alive(g, order).length;
  return {
    kind: 'ghost', map: g.map, humans: left, ghosts: order.length - left,
    round: r ? {
      n: r.n, readyAt: r.readyAt, startAt: r.startAt, endAt: r.endAt, humans: r.humans, stones: r.stones, slows: r.slows, teleports: r.teleports,
      bats: r.bats, fog: r.fog, showEnd: r.showEnd, items: r.items.filter((x) => !x.by).map(({ by: _by, ...x }) => x),
      done: r.done ? { at: r.done.at, why: r.done.why, winners: r.done.winners.length } : null,
    } : null,
  };
}

/** One player's own row. */
export interface GhostPlayer {
  kind: 'ghost';
  ghost: boolean;
  /** Caught this round (not a starter). */
  caught: boolean;
  caughtAt: number | null;
  hideTo: number; dashTo: number; lanternTo: number; frozenTo: number; bootsTo: number; shield: boolean;
  spot: Spot; placed: number; nextAt: number;
  /** Won the round that just ended (or survived it). */
  last: GhostMine['last'];
  crowns: number; tags: number;
  place: 1 | 2 | 3 | null;
  stats: { right: number; wrong: number; bestStreak: number; vanishes: number; grabs: number; shieldSaves: number; caught: number; aliveS: number };
}

export function ghostPlayer(g: GhostGame, id: string, order: string[], over: boolean): GhostPlayer {
  const m = g.mine[id] ?? freshMine(Math.max(0, order.indexOf(id)), order.length);
  const starter = !!g.round?.starters.includes(id);
  return {
    kind: 'ghost', ghost: m.ghost, caught: m.ghost && !starter, caughtAt: m.caughtAt, hideTo: m.hideTo, dashTo: m.dashTo, lanternTo: m.lanternTo,
    frozenTo: m.frozenTo, bootsTo: m.bootsTo, shield: m.shield, spot: m.spot, placed: m.placed, nextAt: m.lastAt + ANSWER_GAP_MS, last: m.last,
    crowns: m.crowns, tags: m.tags, place: over ? (podium(g, order).find((x) => x.player === id)?.place ?? null) : null,
    stats: { right: m.right, wrong: m.wrong, bestStreak: m.bestStreak, vanishes: m.vanishes, grabs: m.grabs, shieldSaves: m.shieldSaves, caught: m.caught, aliveS: Math.round(m.aliveMs / 1000) },
  };
}
