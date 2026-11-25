/**
 * Saboteur Crew (Class Live activity `crew`, docs/CREW-PLAN.md): a hidden-role game in a robot factory. Every pupil runs
 * their own avatar about. Most are the Crew: they do jobs at the machines (a right answer fills the factory's power
 * bar) and fix sparking machines (right answers fill the machine's fix bar). A few are secretly Glitches: they do no
 * maths (James, 25 Nov 2026 NZ), they jam machines (the machine sparks 4 s later) and, from round 3, switch the lights
 * off. The teacher calls a meeting; the class talks for 40 s and votes in secret on their devices. Whoever gets the
 * most votes becomes a helper drone and the screen says kindly what they were. Crew win with a full power bar or every
 * Glitch found; Glitches win with 4 machines sparking at once, the round's time running out, or as many Glitches as Crew.
 *
 * Pure rules: the server (shared/classlive/server.ts, crewServer.ts) and the screens share them. Times are ms since the
 * session started; positions are board units (a unit square), as Four Corners.
 */
import type { Circle, Spot } from './corners';

export const CREW_MAPS = ['factory'] as const;
export type CrewMap = (typeof CREW_MAPS)[number];

export interface Machine extends Circle {
  id: number;
  key: string;
  name: string;
  room: string;
  emoji: string;
  /** Big machines need 3 right answers to fix, small ones 2. */
  big: boolean;
}

/** The robot factory's 8 machines round the Canteen (James's map pick, 25 Nov 2026 NZ). */
export const MACHINES: readonly Machine[] = [
  { id: 0, key: 'assembly', name: 'Robot Assembler', room: 'Assembly', emoji: '🦾', big: true, x: 0.17, y: 0.18, r: 0.06 },
  { id: 1, key: 'paint', name: 'Paint Sprayer', room: 'Paint Shop', emoji: '🎨', big: false, x: 0.5, y: 0.12, r: 0.045 },
  { id: 2, key: 'boiler', name: 'Steam Boiler', room: 'Boiler Room', emoji: '♨️', big: true, x: 0.83, y: 0.18, r: 0.06 },
  { id: 3, key: 'sorter', name: 'Bolt Sorter', room: 'Sorting Belt', emoji: '🔩', big: false, x: 0.12, y: 0.5, r: 0.045 },
  { id: 4, key: 'battery', name: 'Battery Charger', room: 'Battery Bay', emoji: '🔋', big: false, x: 0.88, y: 0.5, r: 0.045 },
  { id: 5, key: 'control', name: 'Light Switch Panel', room: 'Control Room', emoji: '🎛️', big: false, x: 0.17, y: 0.83, r: 0.045 },
  { id: 6, key: 'packer', name: 'Box Packer', room: 'Packing Dock', emoji: '📦', big: true, x: 0.5, y: 0.88, r: 0.06 },
  { id: 7, key: 'recycler', name: 'Recycler', room: 'Recycling', emoji: '♻️', big: false, x: 0.83, y: 0.83, r: 0.045 },
];
/** The Control Room's panel switches the lights back on after a Glitch's lights out. */
export const CONTROL = 5;
export const CANTEEN: Circle = { x: 0.5, y: 0.5, r: 0.13 };
export const fixNeed = (m: Machine) => (m.big ? 3 : 2);

export const POWERS = ['boots', 'camera', 'toolkit'] as const;
export type CrewPower = (typeof POWERS)[number];
export const POWER_WORDS: Record<CrewPower, { name: string; emoji: string; how: string }> = {
  boots: { name: 'Rocket boots', emoji: '🚀', how: 'Your next right answer makes you run faster for a few seconds.' },
  camera: { name: 'Camera', emoji: '📹', how: 'Your next right answer lets you see the whole factory, even in the dark.' },
  toolkit: { name: 'Super toolkit', emoji: '🧰', how: 'Your next right answer at a sparking machine mends it in one go.' },
};

export const MECHANICS = ['items', 'lights', 'belts'] as const;
export type CrewMechanic = (typeof MECHANICS)[number];
/** The round each extra first comes in (James, 25 Nov 2026 NZ: unlocked round by round; lights out from round 3). */
export const UNLOCK: Record<CrewMechanic, number> = { items: 2, lights: 3, belts: 4 };

// ---- Sizes, speeds and times ----

export const AVATAR_R = 0.03;
/** Close enough to a machine to use it (centre to centre, beyond the machine's edge). */
export const REACH = 0.07;
/** The server checks against the saved spot, which can be a moment behind. */
export const REACH_SLACK = 0.05;
export const GRAB_R = 0.05;
export const SPEED = 0.27;
export const BOOTS = 1.4;
export const BELT_SPEED = 0.12;
/** The database's clamp (classlive_activities.max_speed), with slack. */
export const MAX_SPEED = 0.6;
/** Everyone sees their role card in the Canteen before work starts. */
export const ROLE_MS = 5000;
/** A round's work time (James: 4 minutes), not counting meetings. */
export const ROUND_MS = 240_000;
/** Meetings: talk out loud (James: 40 s), then the secret vote, then the reveal. */
export const TALK_MS = 40_000;
export const MORE_TALK_MS = 20_000;
export const VOTE_MS = 15_000;
export const REVEAL_MS = 7000;
export const SHOW_MS = 9000;
/** A jam starts sparking this long after it is set (James: delayed jam). */
export const JAM_DELAY = 4000;
/** A Glitch waits this long between jams, and this long into a round before the first. */
export const JAM_COOL = 20_000;
export const FIRST_JAM = 8000;
/** A machine mended in the last 10 s can't be jammed again yet. */
export const MEND_GUARD = 10_000;
/** A Glitch drone's right answer takes this off the other Glitches' wait. */
export const DRONE_HELP = 3000;
/** The Glitches win with this many machines sparking at once. */
export const JAMMED_WIN = 4;
/** Power lost per sparking machine, per second (the bar is 0 to 100). */
export const DRAIN = 0.3;
/** A Glitch's fake job: hold Work this long at the machine. */
export const WORK_MS = 3000;
export const LIGHTS_MS = 8000;
export const LIGHT_R = 0.2;
export const LIGHTS_FIX = 2;
export const BOOTS_MS = 6000;
export const CAMERA_MS = 10_000;
export const ANSWER_GAP_MS = 1500;
export const JOBS = 4;

/** Glitches in a round: 1 for every 8 pupils (James), at least 1, at most 4, never more than a third. */
export const glitchCount = (players: number) => (players < 3 ? 0 : Math.max(1, Math.min(4, Math.round(players / 8), Math.floor(players / 3))));
/** Power a right job answer adds: a busy crew fills the bar in a bit over 2 minutes with no jams. */
export const jobPower = (crew: number) => Math.min(12, Math.max(0.3, 100 / (Math.max(1, crew) * 14)));

// ---- The game ----

export interface MachineState {
  /** Set when a Glitch jammed it; it sparks at `sparkAt`. */
  jamAt: number | null;
  sparkAt: number | null;
  sparked: boolean;
  /** The Glitch who jammed it (never on pupils' devices). */
  by: string | null;
  /** Right answers towards mending it. */
  fix: number;
  fixedAt: number;
}

export interface CrewItem extends Spot { id: number; power: CrewPower; by: string | null }
/** A conveyor belt: a strip that carries anyone on it along (not drones). */
export interface Belt { x: number; y: number; w: number; h: number; dx: number; dy: number }

export interface Meeting {
  at: number;
  talkEnd: number;
  voteEnd: number;
  /** Set when the votes are counted. */
  revealEnd: number | null;
  /** Secret: voter → who they voted for, or 'skip'. Only the counts are ever shown. */
  votes: Record<string, string>;
  /** Who was sent off (null: nobody), and whether they were a Glitch. */
  out: string | null;
  glitch: boolean | null;
  counts: Record<string, number> | null;
}

export type CrewWhy = 'power' | 'found' | 'jammed' | 'time' | 'outnumbered';

export interface CrewRound {
  n: number;
  readyAt: number;
  /** Work starts (after the role cards). */
  startAt: number;
  /** Work ends here (moved on by each meeting's length). */
  endAt: number;
  glitches: string[];
  crewAtStart: number;
  power: number;
  /** The power bar was last worked out at this time. */
  powerAt: number;
  machines: MachineState[];
  meeting: Meeting | null;
  meetings: number;
  lightsTo: number;
  lightsFix: number;
  items: CrewItem[];
  belts: Belt[];
  /** The Glitches may switch the lights off this round. */
  lights: boolean;
  done: null | { at: number; winner: 'crew' | 'glitch'; why: CrewWhy };
  showEnd: number | null;
}

export interface CrewMine {
  glitch: boolean;
  drone: boolean;
  /** Machines to do jobs at (fake jobs for a Glitch). */
  jobs: number[];
  spot: Spot;
  placed: number;
  lastAt: number;
  lastWork: number;
  jamTo: number;
  /** The round they last switched the lights off in. */
  lightsIn: number;
  held: CrewPower | null;
  bootsTo: number;
  cameraTo: number;
  toolkit: boolean;
  answered: number;
  right: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  jobsDone: number;
  fixes: number;
  mends: number;
  jams: number;
  fakeJobs: number;
  grabs: number;
  lightsOut: number;
  /** Votes for someone who really was a Glitch. */
  detects: number;
  wins: number;
  glitchWins: number;
  timesGlitch: number;
  last: 'won' | 'lost' | null;
}

export interface CrewGame {
  kind: 'crew';
  map: CrewMap;
  round: CrewRound | null;
  mine: Record<string, CrewMine>;
  nextItem: number;
}

export type CrewEvent =
  | { type: 'c_round'; t: number; n: number }
  | { type: 'c_work'; t: number; n: number }
  | { type: 'c_jam'; t: number; machine: number; by: string }
  | { type: 'c_spark'; t: number; machine: number }
  | { type: 'c_fix'; t: number; machine: number; pupil: string; mended: boolean }
  | { type: 'c_job'; t: number; machine: number; pupil: string }
  | { type: 'c_dark'; t: number; by: string }
  | { type: 'c_light'; t: number; pupil: string }
  | { type: 'c_grab'; t: number; pupil: string; power: CrewPower }
  | { type: 'c_meeting'; t: number }
  | { type: 'c_vote'; t: number }
  | { type: 'c_out'; t: number; pupil: string | null; glitch: boolean | null }
  | { type: 'c_resume'; t: number }
  | { type: 'c_end'; t: number; n: number; winner: 'crew' | 'glitch'; why: CrewWhy; glitches: string[] };

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.min(1 - AVATAR_R, Math.max(AVATAR_R, v));

export function newCrew(map: CrewMap = 'factory'): CrewGame {
  return { kind: 'crew', map, round: null, mine: {}, nextItem: 1 };
}

/** A seat round the Canteen (everyone starts and meets here). */
export function canteenSpot(i: number, of: number): Spot {
  const a = (i / Math.max(1, of)) * Math.PI * 2 + 0.3;
  const r = CANTEEN.r * (of > 14 && i % 2 ? 0.45 : 0.8);
  return { x: CANTEEN.x + Math.cos(a) * r, y: CANTEEN.y + Math.sin(a) * r };
}

function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Four jobs at different machines (never the same as the one just done). */
export function newJobs(random: () => number, not: number | null = null): number[] {
  return shuffled(MACHINES.map((m) => m.id).filter((id) => id !== not), random).slice(0, JOBS);
}

export function freshMine(i: number, of = 30, random: () => number = Math.random): CrewMine {
  return {
    glitch: false, drone: false, jobs: newJobs(random), spot: canteenSpot(i, of), placed: 0, lastAt: -ANSWER_GAP_MS, lastWork: -WORK_MS, jamTo: 0,
    lightsIn: 0, held: null, bootsTo: 0, cameraTo: 0, toolkit: false, answered: 0, right: 0, wrong: 0, streak: 0, bestStreak: 0, jobsDone: 0,
    fixes: 0, mends: 0, jams: 0, fakeJobs: 0, grabs: 0, lightsOut: 0, detects: 0, wins: 0, glitchWins: 0, timesGlitch: 0, last: null,
  };
}

/** Which extras a round has: each new one on its unlock round, then a mix of 2 or 3. */
export function mechanicsFor(n: number, random: () => number): Set<CrewMechanic> {
  const open = MECHANICS.filter((m) => UNLOCK[m] <= n);
  const fresh = MECHANICS.find((m) => UNLOCK[m] === n);
  const out = new Set<CrewMechanic>();
  if (fresh) {
    out.add(fresh);
    if (open.includes('items') && random() < 0.7) out.add('items');
    return out;
  }
  const want = Math.min(open.length, 2 + Math.floor(random() * 2));
  for (const m of shuffled(open, random).slice(0, want)) out.add(m);
  return out;
}

/** Who is a Glitch this round: those who were one fewest times so far, then at random. */
export function pickGlitches(g: CrewGame, order: string[], random: () => number): string[] {
  const k = glitchCount(order.length);
  return order.map((id) => ({ id, s: g.mine[id]?.timesGlitch ?? 0, r: random() })).sort((a, b) => a.s - b.s || a.r - b.r).slice(0, k).map((x) => x.id);
}

function openSpot(random: () => number, taken: Circle[], r: number): Spot {
  for (let i = 0; i < 40; i++) {
    const p = { x: 0.08 + random() * 0.84, y: 0.08 + random() * 0.84 };
    if (dist(p, CANTEEN) < CANTEEN.r + r + 0.03) continue;
    if ([...MACHINES, ...taken].some((c) => dist(c, p) < c.r + r + 0.05)) continue;
    return p;
  }
  return { x: 0.33, y: 0.3 };
}

function seatAll(g: CrewGame, order: string[]) {
  order.forEach((id, i) => {
    const m = g.mine[id];
    if (!m) return;
    m.spot = canteenSpot(i, order.length);
    m.placed++;
  });
}

/** A new round: roles dealt, everyone in the Canteen, new jobs. */
export function makeRound(g: CrewGame, n: number, readyAt: number, order: string[], random: () => number): CrewRound {
  const has = mechanicsFor(n, random);
  const glitches = pickGlitches(g, order, random);
  const startAt = readyAt + ROLE_MS;
  order.forEach((id, i) => {
    const m = (g.mine[id] ??= freshMine(i, order.length, random));
    const glitch = glitches.includes(id);
    Object.assign(m, {
      glitch, drone: false, jobs: newJobs(random), jamTo: startAt + FIRST_JAM, held: null, bootsTo: 0, cameraTo: 0, toolkit: false, lastWork: -WORK_MS,
    });
    if (glitch) m.timesGlitch++;
  });
  seatAll(g, order);
  const items: CrewItem[] = [];
  if (has.has('items')) {
    const k = Math.max(2, Math.min(6, Math.round(order.length / 6)));
    const taken: Circle[] = [];
    for (let i = 0; i < k; i++) {
      const p = openSpot(random, taken, GRAB_R);
      taken.push({ ...p, r: GRAB_R });
      items.push({ id: g.nextItem++, power: POWERS[Math.floor(random() * POWERS.length) % POWERS.length], ...p, by: null });
    }
  }
  const belts: Belt[] = [];
  if (has.has('belts')) {
    const dir = random() < 0.5 ? 1 : -1;
    belts.push({ x: 0.27, y: 0.31, w: 0.46, h: 0.06, dx: dir, dy: 0 });
    if (random() < 0.6) belts.push({ x: 0.27, y: 0.63, w: 0.46, h: 0.06, dx: -dir, dy: 0 });
  }
  return {
    n, readyAt, startAt, endAt: startAt + ROUND_MS, glitches, crewAtStart: order.length - glitches.length, power: 0, powerAt: startAt,
    machines: MACHINES.map(() => ({ jamAt: null, sparkAt: null, sparked: false, by: null, fix: 0, fixedAt: -MEND_GUARD })),
    meeting: null, meetings: 0, lightsTo: 0, lightsFix: 0, items, belts, lights: has.has('lights'), done: null, showEnd: null,
  };
}

export type CrewPhase = 'wait' | 'roles' | 'work' | 'talk' | 'vote' | 'reveal' | 'done';

export function phaseOf(r: Pick<CrewRound, 'done' | 'startAt'> & { meeting: Pick<Meeting, 'talkEnd' | 'revealEnd'> | null } | null, t: number): CrewPhase {
  if (!r) return 'wait';
  if (r.done) return 'done';
  if (r.meeting) return t < r.meeting.talkEnd ? 'talk' : r.meeting.revealEnd === null ? 'vote' : 'reveal';
  return t < r.startAt ? 'roles' : 'work';
}

export const isActive = (m: CrewMine | undefined) => !!m && !m.drone;
export const activeGlitches = (g: CrewGame, order: string[]) => order.filter((id) => g.mine[id]?.glitch && !g.mine[id].drone);
export const activeCrew = (g: CrewGame, order: string[]) => order.filter((id) => g.mine[id] && !g.mine[id].glitch && !g.mine[id].drone);
export const sparking = (r: CrewRound) => r.machines.filter((m) => m.sparked).length;

/** Works out the power bar up to t: each sparking machine drains it (only during work). */
export function settle(r: CrewRound, t: number) {
  if (r.done || r.meeting || t <= r.powerAt) return;
  let lost = 0;
  for (const m of r.machines) {
    if (m.sparkAt === null) continue;
    lost += Math.max(0, t - Math.max(r.powerAt, m.sparkAt));
  }
  r.power = Math.max(0, r.power - (DRAIN * lost) / 1000);
  r.powerAt = t;
}

/** The power bar at t for drawing (between saves), from the public copy. */
export function powerNow(r: { power: number; powerAt: number; sparking: number; paused: boolean }, t: number): number {
  if (r.paused) return r.power;
  return Math.max(0, r.power - (DRAIN * r.sparking * Math.max(0, t - r.powerAt)) / 1000);
}

/** The game can end: no round, or the last round's show is over. */
export const crewDone = (g: CrewGame, t: number) => !g.round || (g.round.done !== null && g.round.showEnd !== null && t >= g.round.showEnd);

/** The next time the game moves on by itself, or null. */
export function nextDeadline(g: CrewGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  const r = g.round;
  if (!r) return 0;
  if (r.done) return r.showEnd;
  if (r.meeting) return r.meeting.revealEnd ?? (r.meeting.talkEnd > r.meeting.voteEnd ? r.meeting.talkEnd : r.meeting.voteEnd);
  const sparks = r.machines.filter((m) => m.sparkAt !== null && !m.sparked).map((m) => m.sparkAt as number);
  return Math.min(r.endAt, ...sparks);
}

function endRound(g: CrewGame, r: CrewRound, t: number, winner: 'crew' | 'glitch', why: CrewWhy, order: string[], events: CrewEvent[]) {
  settle(r, t);
  r.done = { at: t, winner, why };
  r.showEnd = t + SHOW_MS;
  r.meeting = null;
  for (const id of order) {
    const m = g.mine[id];
    if (!m) continue;
    const won = (winner === 'glitch') === m.glitch;
    m.last = won ? 'won' : 'lost';
    if (won) {
      m.wins++;
      if (m.glitch) m.glitchWins++;
    }
  }
  events.push({ type: 'c_end', t, n: r.n, winner, why, glitches: [...r.glitches] });
}

/** Counts the secret votes: the most votes is sent off; a tie, or Skip on top, sends nobody. */
export function countVotes(votes: Record<string, string>): { out: string | null; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const v of Object.values(votes)) counts[v] = (counts[v] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const best = Object.keys(counts).filter((k) => counts[k] === top);
  return { out: top > 0 && best.length === 1 && best[0] !== 'skip' ? best[0] : null, counts };
}

/**
 * Moves the game on at time t: the first round, work starting, delayed jams sparking, the power bar, wins, the end of a
 * meeting's talk and vote, the reveal, the next round. `last`: the session's time is up (a round that is on ends now).
 */
export function advance(g: CrewGame, t: number, order: string[], random: () => number, last = false): CrewEvent[] {
  const events: CrewEvent[] = [];
  const begin = () => {
    if (order.length < 3 || last) return;
    const n = (g.round?.n ?? 0) + 1;
    g.round = makeRound(g, n, t, order, random);
    events.push({ type: 'c_round', t, n });
  };
  const r = g.round;
  if (!r) {
    begin();
    return events;
  }
  if (r.done) {
    if (r.showEnd !== null && t >= r.showEnd) begin();
    return events;
  }
  if (last) {
    settle(r, t);
    endRound(g, r, t, r.power >= 50 ? 'crew' : 'glitch', r.power >= 50 ? 'power' : 'time', order, events);
    return events;
  }
  const mt = r.meeting;
  if (mt) {
    const voters = order.filter((id) => isActive(g.mine[id]));
    if (mt.revealEnd === null && t >= mt.talkEnd && (t >= mt.voteEnd || (voters.length > 0 && voters.every((id) => mt.votes[id] !== undefined)))) {
      const { out, counts } = countVotes(mt.votes);
      mt.counts = counts;
      mt.out = out;
      mt.glitch = out ? !!g.mine[out]?.glitch : null;
      mt.revealEnd = t + REVEAL_MS;
      if (out && g.mine[out]) {
        g.mine[out].drone = true;
        g.mine[out].held = null;
        if (g.mine[out].glitch) for (const [voter, pick] of Object.entries(mt.votes)) if (pick === out && g.mine[voter]) g.mine[voter].detects++;
      }
      events.push({ type: 'c_out', t, pupil: out, glitch: mt.glitch });
    } else if (mt.revealEnd !== null && t >= mt.revealEnd) {
      const glitches = activeGlitches(g, order).length;
      const crew = activeCrew(g, order).length;
      if (glitches === 0) endRound(g, r, t, 'crew', 'found', order, events);
      else if (glitches >= crew) endRound(g, r, t, 'glitch', 'outnumbered', order, events);
      else {
        // Back to work: the clock and any jam not yet sparking carry on from where they were.
        const gone = t - mt.at;
        r.endAt += gone;
        r.powerAt = t;
        for (const m of r.machines) if (m.sparkAt !== null && !m.sparked) m.sparkAt += gone;
        for (const id of order) {
          const m = g.mine[id];
          if (m && m.jamTo > mt.at) m.jamTo += gone;
        }
        r.meeting = null;
        r.meetings++;
        r.lightsTo = 0;
        events.push({ type: 'c_resume', t });
      }
    }
    return events;
  }
  if (t < r.startAt) return events;
  // Delayed jams spark; the power bar drains for each sparking machine.
  for (const [i, m] of r.machines.entries()) {
    if (m.sparkAt !== null && !m.sparked && t >= m.sparkAt) {
      settle(r, m.sparkAt);
      m.sparked = true;
      events.push({ type: 'c_spark', t, machine: i });
    }
  }
  settle(r, t);
  if (r.power >= 100) endRound(g, r, t, 'crew', 'power', order, events);
  else if (sparking(r) >= JAMMED_WIN) endRound(g, r, t, 'glitch', 'jammed', order, events);
  else if (t >= r.endAt) endRound(g, r, Math.min(t, r.endAt), 'glitch', 'time', order, events);
  return events;
}

/** The teacher calls a meeting (James: teacher only): everyone to the Canteen, the clock stops. */
export function callMeeting(g: CrewGame, t: number, order: string[]): { ok: true; events: CrewEvent[] } | { ok: false } {
  const r = g.round;
  if (!r || phaseOf(r, t) !== 'work') return { ok: false };
  settle(r, t);
  r.meeting = { at: t, talkEnd: t + TALK_MS, voteEnd: t + TALK_MS + VOTE_MS, revealEnd: null, votes: {}, out: null, glitch: null, counts: null };
  r.lightsTo = 0;
  seatAll(g, order);
  return { ok: true, events: [{ type: 'c_meeting', t }] };
}

/** The teacher's meeting buttons: vote now (skip the rest of the talk), or 20 more seconds of talk. */
export function meetingControl(g: CrewGame, t: number, what: 'vote' | 'more'): { ok: true; events: CrewEvent[] } | { ok: false } {
  const mt = g.round?.meeting;
  if (!mt || mt.revealEnd !== null) return { ok: false };
  if (what === 'vote') {
    if (t >= mt.talkEnd) return { ok: false };
    mt.talkEnd = t;
    mt.voteEnd = t + VOTE_MS;
    return { ok: true, events: [{ type: 'c_vote', t }] };
  }
  if (t >= mt.talkEnd) {
    mt.talkEnd = t + MORE_TALK_MS;
    mt.voteEnd = mt.talkEnd + VOTE_MS;
  } else {
    mt.talkEnd += MORE_TALK_MS;
    mt.voteEnd += MORE_TALK_MS;
  }
  return { ok: true, events: [] };
}

/** A secret vote (anyone still on the floor; drones don't vote): a player still on the floor, or 'skip'. */
export function castVote(g: CrewGame, who: string, pick: unknown, t: number, order: string[]): { ok: true } | { ok: false; reason: 'not_now' | 'bad' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || phaseOf(r, t) !== 'vote' || !r.meeting || !isActive(m)) return { ok: false, reason: 'not_now' };
  if (pick !== 'skip' && (typeof pick !== 'string' || pick === who || !order.includes(pick) || !isActive(g.mine[pick]))) return { ok: false, reason: 'bad' };
  r.meeting.votes[who] = pick as string;
  return { ok: true };
}

const inReach = (machine: Machine, at: Spot, slack = REACH_SLACK) => dist(machine, at) <= machine.r + REACH + slack;

/** What a right answer here would do: mend a sparking machine, a job, the light switch in the dark, or (a Glitch drone) help. */
export type Purpose = { kind: 'fix'; machine: number } | { kind: 'job'; machine: number } | { kind: 'lights' } | { kind: 'drone' };

export function purposeAt(g: CrewGame, who: string, at: Spot | undefined, t: number, slack = REACH_SLACK): Purpose | null {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || !at || phaseOf(r, t) !== 'work') return null;
  if (m.glitch) return m.drone ? { kind: 'drone' } : null;
  if (r.lightsTo > t && inReach(MACHINES[CONTROL], at, slack)) return { kind: 'lights' };
  const fix = MACHINES.find((mc) => r.machines[mc.id].sparked && inReach(mc, at, slack));
  if (fix) return { kind: 'fix', machine: fix.id };
  const job = MACHINES.find((mc) => m.jobs.includes(mc.id) && !r.machines[mc.id].sparked && inReach(mc, at, slack));
  if (job) return { kind: 'job', machine: job.id };
  return null;
}

/** Can this player get a question now (and why)? */
export function canAsk(g: CrewGame, who: string, at: Spot | undefined, t: number): Purpose | null {
  const m = g.mine[who];
  if (!m || t < m.lastAt + ANSWER_GAP_MS) return null;
  return purposeAt(g, who, at, t);
}

/** A marked answer. Right: fills a fix bar, does a job (power), switches the lights on, or helps the Glitches (a Glitch drone). */
export function answered(g: CrewGame, who: string, right: boolean, purpose: Purpose, t: number, order: string[], random: () => number):
  { ok: true; events: CrewEvent[]; gave: string | null } | { ok: false; reason: 'too_soon' | 'not_now' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || phaseOf(r, t) !== 'work') return { ok: false, reason: 'not_now' };
  if (t < m.lastAt + ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  settle(r, t);
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
  const events: CrewEvent[] = [];
  let gave: string | null = null;
  if (purpose.kind === 'drone') {
    for (const id of activeGlitches(g, order)) g.mine[id].jamTo = Math.max(t, g.mine[id].jamTo - DRONE_HELP);
    gave = 'drone';
  } else if (purpose.kind === 'lights') {
    r.lightsFix++;
    if (r.lightsFix >= LIGHTS_FIX && r.lightsTo > t) {
      r.lightsTo = t;
      events.push({ type: 'c_light', t, pupil: who });
      gave = 'lights_on';
    } else gave = 'lights';
  } else if (purpose.kind === 'fix' && r.machines[purpose.machine].sparked) {
    const st = r.machines[purpose.machine];
    st.fix += m.toolkit ? fixNeed(MACHINES[purpose.machine]) : 1;
    if (m.toolkit) m.toolkit = false;
    m.fixes++;
    const mended = st.fix >= fixNeed(MACHINES[purpose.machine]);
    if (mended) {
      Object.assign(st, { jamAt: null, sparkAt: null, sparked: false, by: null, fix: 0, fixedAt: t });
      m.mends++;
    }
    events.push({ type: 'c_fix', t, machine: purpose.machine, pupil: who, mended });
    gave = mended ? 'mended' : 'fix';
  } else {
    const id = purpose.kind === 'job' || purpose.kind === 'fix' ? purpose.machine : -1;
    if (m.jobs.includes(id)) {
      m.jobs = m.jobs.filter((x) => x !== id);
      if (!m.jobs.length) m.jobs = newJobs(random, id);
      m.jobsDone++;
      r.power = Math.min(100, r.power + jobPower(r.crewAtStart));
      events.push({ type: 'c_job', t, machine: id, pupil: who });
      gave = 'job';
    }
  }
  // A held power-up switches on with a right answer.
  if (m.held === 'boots') { m.bootsTo = t + BOOTS_MS; m.held = null; }
  else if (m.held === 'camera') { m.cameraTo = t + CAMERA_MS; m.held = null; }
  else if (m.held === 'toolkit' && !m.toolkit) { m.toolkit = true; m.held = null; }
  if (r.power >= 100) endRound(g, r, t, 'crew', 'power', order, events);
  return { ok: true, events, gave };
}

/** A Glitch jams a machine it is standing by: it starts sparking JAM_DELAY later. */
export function jam(g: CrewGame, who: string, machine: unknown, at: Spot | undefined, t: number): { ok: true; events: CrewEvent[] } | { ok: false; reason: 'not_now' | 'far' | 'wait' | 'busy' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || !m.glitch || m.drone || !at || phaseOf(r, t) !== 'work') return { ok: false, reason: 'not_now' };
  const mc = MACHINES.find((x) => x.id === machine);
  if (!mc) return { ok: false, reason: 'not_now' };
  if (!inReach(mc, at)) return { ok: false, reason: 'far' };
  if (t < m.jamTo) return { ok: false, reason: 'wait' };
  const st = r.machines[mc.id];
  if (st.jamAt !== null || t < st.fixedAt + MEND_GUARD) return { ok: false, reason: 'busy' };
  Object.assign(st, { jamAt: t, sparkAt: t + JAM_DELAY, sparked: false, by: who, fix: 0 });
  m.jamTo = t + JAM_COOL;
  m.jams++;
  return { ok: true, events: [{ type: 'c_jam', t, machine: mc.id, by: who }] };
}

/** A Glitch's pretend job: held Work at one of its job machines for WORK_MS (adds no power). */
export function fakeWork(g: CrewGame, who: string, machine: unknown, at: Spot | undefined, t: number, random: () => number): { ok: true } | { ok: false; reason: 'not_now' | 'far' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || !m.glitch || m.drone || !at || phaseOf(r, t) !== 'work' || t < m.lastWork + WORK_MS - 300) return { ok: false, reason: 'not_now' };
  const mc = MACHINES.find((x) => x.id === machine);
  if (!mc || !m.jobs.includes(mc.id)) return { ok: false, reason: 'not_now' };
  if (!inReach(mc, at)) return { ok: false, reason: 'far' };
  m.lastWork = t;
  m.jobs = m.jobs.filter((x) => x !== mc.id);
  if (!m.jobs.length) m.jobs = newJobs(random, mc.id);
  m.fakeJobs++;
  return { ok: true };
}

/** A Glitch switches the lights off (rounds with lights out, once each a round). */
export function lightsOff(g: CrewGame, who: string, t: number): { ok: true; events: CrewEvent[] } | { ok: false } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || !m.glitch || m.drone || !r.lights || m.lightsIn === r.n || r.lightsTo > t || phaseOf(r, t) !== 'work') return { ok: false };
  r.lightsTo = t + LIGHTS_MS;
  r.lightsFix = 0;
  m.lightsIn = r.n;
  m.lightsOut++;
  return { ok: true, events: [{ type: 'c_dark', t, by: who }] };
}

/** Crew (and Crew drones) pick up a power-up by walking over it; it switches on with the next right answer. */
export function grab(g: CrewGame, who: string, itemId: unknown, at: Spot | undefined, t: number): { ok: true; events: CrewEvent[] } | { ok: false; reason: 'not_now' | 'gone' | 'far' | 'full' } {
  const r = g.round;
  const m = g.mine[who];
  if (!r || !m || m.glitch || !at || phaseOf(r, t) !== 'work') return { ok: false, reason: 'not_now' };
  const it = r.items.find((x) => x.id === itemId);
  if (!it || it.by) return { ok: false, reason: 'gone' };
  if (m.held || m.toolkit) return { ok: false, reason: 'full' };
  if (dist(it, at) > GRAB_R + AVATAR_R + REACH_SLACK) return { ok: false, reason: 'far' };
  it.by = who;
  m.held = it.power;
  m.grabs++;
  return { ok: true, events: [{ type: 'c_grab', t, pupil: who, power: it.power }] };
}

/** The podium: most rounds won, then right answers and jams. Ties share a place. */
export function podium(g: CrewGame, order: string[]): { player: string; place: 1 | 2 | 3 }[] {
  const score = (id: string) => (g.mine[id]?.wins ?? 0) * 1000 + (g.mine[id]?.right ?? 0) + (g.mine[id]?.jams ?? 0) * 2;
  const scores = [...new Set(order.map(score))].filter((s) => s >= 1000).sort((a, b) => b - a).slice(0, 3);
  return order.map((id) => ({ player: id, s: score(id) })).filter((x) => scores.includes(x.s)).sort((a, b) => b.s - a.s)
    .map((x) => ({ player: x.player, place: (scores.indexOf(x.s) + 1) as 1 | 2 | 3 }));
}

// ---- Moving (devices, the preview's pretend pupils) ----

export interface CrewMove { p: Spot }
export type MoveRoundC = Pick<CrewRound, 'belts' | 'startAt'> & { meeting: unknown; done: unknown };

export const speedOf = (m: Pick<CrewMine, 'bootsTo'>, t: number) => SPEED * (m.bootsTo > t ? BOOTS : 1);
export const onBelt = (b: Belt, p: Spot) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

/**
 * One step: `dir` is the joystick (length 0 to 1), dt in ms. Players bump into machines and the Canteen tables stay
 * open; belts carry anyone but drones. Nobody moves during the role cards or a meeting.
 */
export function stepCrew(m: CrewMove, dir: Spot, dtMs: number, round: MoveRoundC | null, t: number, o: { drone: boolean; speed: number }): CrewMove {
  if (!round || round.done || round.meeting || t < round.startAt) return m;
  const dt = Math.min(100, Math.max(0, dtMs)) / 1000;
  const len = Math.hypot(dir.x, dir.y);
  const d = len > 1 ? { x: dir.x / len, y: dir.y / len } : dir;
  let p = { x: m.p.x + d.x * o.speed * dt, y: m.p.y + d.y * o.speed * dt };
  if (!o.drone) {
    for (const b of round.belts) if (onBelt(b, m.p)) p = { x: p.x + b.dx * BELT_SPEED * dt, y: p.y + b.dy * BELT_SPEED * dt };
    for (const mc of MACHINES) {
      const dd = dist(p, mc);
      const min = mc.r + AVATAR_R;
      if (dd < min) {
        const ax = dd < 1e-6 ? 1 : (p.x - mc.x) / dd;
        const ay = dd < 1e-6 ? 0 : (p.y - mc.y) / dd;
        p = { x: mc.x + ax * min, y: mc.y + ay * min };
      }
    }
  }
  return { p: { x: clamp01(p.x), y: clamp01(p.y) } };
}

/** A pretend pupil's joystick towards a spot (a little wobble). */
export function pretendDir(me: Spot, to: Spot, random: () => number): Spot {
  const dx = to.x - me.x + (random() - 0.5) * 0.08;
  const dy = to.y - me.y + (random() - 0.5) * 0.08;
  const l = Math.hypot(dx, dy);
  return l < 0.02 ? { x: 0, y: 0 } : { x: dx / l, y: dy / l };
}

// ---- What pupils' devices see ----

/** The room's public copy: no names, no ids, never who is a Glitch, jams only once they spark. */
export interface PublicCrew {
  kind: 'crew';
  map: CrewMap;
  round: null | {
    n: number; readyAt: number; startAt: number; endAt: number; power: number; powerAt: number; crewAtStart: number;
    machines: { sparked: boolean; fix: number }[];
    meeting: null | { at: number; talkEnd: number; voteEnd: number; revealEnd: number | null; voted: number; out: boolean | null; glitch: boolean | null };
    lightsTo: number; lightsFix: number; lights: boolean; items: Omit<CrewItem, 'by'>[]; belts: Belt[];
    done: null | { at: number; winner: 'crew' | 'glitch'; why: CrewWhy; glitches: number };
    showEnd: number | null;
  };
  /** Glitches still on the floor (shown on the big screen too), players on the floor. */
  glitches: number;
  active: number;
}

export function publicCrew(g: CrewGame, order: string[]): PublicCrew {
  const r = g.round;
  return {
    kind: 'crew', map: g.map, glitches: activeGlitches(g, order).length, active: order.filter((id) => isActive(g.mine[id])).length,
    round: r ? {
      n: r.n, readyAt: r.readyAt, startAt: r.startAt, endAt: r.endAt, power: r.power, powerAt: r.powerAt, crewAtStart: r.crewAtStart,
      machines: r.machines.map((m) => ({ sparked: m.sparked, fix: m.sparked ? m.fix : 0 })),
      meeting: r.meeting ? {
        at: r.meeting.at, talkEnd: r.meeting.talkEnd, voteEnd: r.meeting.voteEnd, revealEnd: r.meeting.revealEnd, voted: Object.keys(r.meeting.votes).length,
        out: r.meeting.revealEnd === null ? null : r.meeting.out !== null, glitch: r.meeting.revealEnd === null ? null : r.meeting.glitch,
      } : null,
      lightsTo: r.lightsTo, lightsFix: r.lightsFix, lights: r.lights, items: r.items.filter((x) => !x.by).map(({ by: _by, ...x }) => x), belts: r.belts,
      done: r.done ? { ...r.done, glitches: r.glitches.length } : null, showEnd: r.showEnd,
    } : null,
  };
}

/** One player's own row: their role, jobs, power-ups; their fellow Glitches' names only if they are one. */
export interface CrewPlayer {
  kind: 'crew';
  glitch: boolean;
  drone: boolean;
  mates: string[];
  jobs: number[];
  jamTo: number;
  canLights: boolean;
  held: CrewPower | null;
  bootsTo: number;
  cameraTo: number;
  toolkit: boolean;
  spot: Spot;
  placed: number;
  nextAt: number;
  lastWork: number;
  /** In a meeting: who can be voted for (first names), and this player's own vote. */
  ballot: { id: string; name: string; colour: number }[] | null;
  myVote: string | null;
  /** The sent-off player's first name, after a reveal. */
  outName: string | null;
  last: CrewMine['last'];
  wins: number;
  place: 1 | 2 | 3 | null;
  stats: { right: number; wrong: number; bestStreak: number; jobs: number; mends: number; jams: number; fakeJobs: number; grabs: number; detects: number; glitchWins: number };
}

export function crewPlayer(g: CrewGame, id: string, order: string[], over: boolean, people: (pid: string) => { name: string; colour: number }): CrewPlayer {
  const m = g.mine[id] ?? freshMine(Math.max(0, order.indexOf(id)), order.length);
  const r = g.round;
  const mt = r?.meeting ?? null;
  return {
    kind: 'crew', glitch: m.glitch, drone: m.drone,
    mates: m.glitch && r ? r.glitches.filter((x) => x !== id).map((x) => people(x).name) : [],
    jobs: m.jobs, jamTo: m.jamTo, canLights: !!r?.lights && m.glitch && !m.drone && m.lightsIn !== r.n, held: m.held, bootsTo: m.bootsTo, cameraTo: m.cameraTo, toolkit: m.toolkit,
    spot: m.spot, placed: m.placed, nextAt: m.lastAt + ANSWER_GAP_MS, lastWork: m.lastWork,
    ballot: mt ? order.filter((x) => x !== id && isActive(g.mine[x])).map((x) => ({ id: x, ...people(x) })) : null,
    myVote: mt?.votes[id] ?? null,
    outName: mt && mt.revealEnd !== null && mt.out ? people(mt.out).name : null,
    last: m.last, wins: m.wins, place: over ? (podium(g, order).find((x) => x.player === id)?.place ?? null) : null,
    stats: { right: m.right, wrong: m.wrong, bestStreak: m.bestStreak, jobs: m.jobsDone, mends: m.mends, jams: m.jams, fakeJobs: m.fakeJobs, grabs: m.grabs, detects: m.detects, glitchWins: m.glitchWins },
  };
}
