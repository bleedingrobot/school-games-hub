/**
 * Shrinking Island, Class Showdown's fourth arena (docs/SHOWDOWN-PLAN.md section 4.4). Same round, modes, roles and
 * big events as Boss Bounty (the engine), with the boss's health standing in for the rescue raft: every right answer adds
 * planks, and the class sails away when it's built.
 *
 * What's different: everyone stands somewhere on an island that shrinks as the round goes on. A right answer moves you a
 * step towards the middle. Whoever the water reaches washes up on a little rock: no knockouts, you keep answering, but
 * your planks and points count half until 2 right answers swim you back. The wind-up is the big wave (a shield check):
 * when it passes, anyone who wasn't answering is pushed back towards the water. The weak spot is a crate washing ashore
 * (double planks), from the engine.
 */
import { hashSeed } from './schedule';
import type { Player, Round, ShowdownEvent } from './types';

export interface IsleSpot {
  /** Where round the island, in degrees. */
  a: number;
  /** How far from the middle, 0 (the middle) to 1 (the first shoreline). */
  d: number;
  /** On a rock in the sea (the water reached them). */
  rock: boolean;
  /** Right answers towards swimming back. */
  swim: number;
}

export const ISLAND = {
  /** The raft needs this much more (or less) than the boss has health (pupils on rocks build at half speed), tuned with
   *  the simulator to about the same 80% of rounds won as Boss Bounty. */
  raft: { class: 1.04, teams2: 1.0, teams4: 1.03, solo: 1.01 } as Record<Round['mode'], number>,
  /** By the end of the round the island is this much smaller (its radius as a share of where it started). */
  shrink: 0.8,
  /** Where pupils start: this far from the middle, at most. */
  startFar: 0.85,
  startNear: 0.25,
  /** A right answer moves you this much towards the middle (never closer than `middle`). */
  step: 0.025,
  middle: 0.06,
  /** On a rock: answers count this much, and this many right answers swim you back. */
  rockTimes: 0.5,
  swimBack: 2,
  /** Swimming back lands you this far inside the shoreline. */
  landInside: 0.82,
  /** The big wave pushes anyone who hasn't answered for `idleMs` this much towards the water. */
  wavePush: 0.35,
  /** A broken shield's wave reaches everyone further out than this share of the shoreline. */
  beach: 0.5,
  idleMs: 15000,
} as const;

/** The island's radius now (1 at the start, shrinking steadily to 1 - shrink at the end). */
export function shoreAt(r: Round, t = r.t): number {
  const len = r.lengthMin * 60000;
  return 1 - ISLAND.shrink * Math.max(0, Math.min(1, t / Math.max(1, len)));
}

/** A pupil's spot, placed from the seed the first time it's asked for (late joiners too). */
export function spotOf(r: Round, p: Player): IsleSpot {
  if (p.isle) return p.isle;
  const h = hashSeed(r.seed, `isle${p.id}`);
  const a = h % 360;
  const far = ISLAND.startNear + ((h >>> 9) % 1000) / 1000 * (ISLAND.startFar - ISLAND.startNear);
  const d = Math.min(far, shoreAt(r) * ISLAND.landInside);
  p.isle = { a, d, rock: false, swim: 0 };
  return p.isle;
}

/** At the start: the raft is set and everyone gets a spot. */
export function setRaft(r: Round) {
  r.boss.max = Math.round(r.boss.max * ISLAND.raft[r.mode]);
  r.boss.hp = r.boss.max;
  for (const id of r.order) spotOf(r, r.players[id]);
}

/** The water rises: anyone now outside the shoreline washes up on a rock. */
export function tide(r: Round, events: ShowdownEvent[]) {
  const shore = shoreAt(r);
  const washed: string[] = [];
  for (const id of r.order) {
    const s = spotOf(r, r.players[id]);
    if (s.rock || s.d <= shore) continue;
    s.rock = true;
    s.swim = 0;
    washed.push(id);
  }
  if (washed.length) events.push({ type: 'washed_up', t: r.t, pupils: washed });
}

/** A right answer: on the island you step towards the middle; on a rock you build at half speed and swim back after 2. */
export function wade(r: Round, p: Player, events: ShowdownEvent[]): number {
  const s = spotOf(r, p);
  if (!s.rock) {
    s.d = Math.max(ISLAND.middle, s.d - ISLAND.step);
    return 1;
  }
  s.swim++;
  if (s.swim >= ISLAND.swimBack) {
    s.rock = false;
    s.swim = 0;
    s.d = shoreAt(r) * ISLAND.landInside;
    events.push({ type: 'swam_back', t: r.t, pupil: p.id });
  }
  return ISLAND.rockTimes;
}

/**
 * The big wave has passed. Where the shield check broke (`broke(pupil)`), it sweeps over the beach: everyone that far out
 * is pushed back towards the water. Anywhere, a pupil who wasn't answering is pushed back too.
 */
export function wave(r: Round, events: ShowdownEvent[], broke: (p: Player) => boolean = () => false) {
  const pushed: string[] = [];
  const beach = shoreAt(r) * ISLAND.beach;
  for (const id of r.order) {
    const p = r.players[id];
    const s = spotOf(r, p);
    if (s.rock) continue;
    if (!(broke(p) && s.d > beach) && r.t - p.lastActive <= ISLAND.idleMs) continue;
    s.d = Math.min(1.2, s.d + ISLAND.wavePush);
    pushed.push(id);
  }
  if (pushed.length) events.push({ type: 'wave', t: r.t, pupils: pushed });
  tide(r, events);
}
