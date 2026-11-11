/**
 * The 10 Toon Flap levels as data (docs/TOON-FLAP-PLAN.md, section 2), and the builder that turns each into its course.
 *
 * Each level is the same course every time: the builder uses a fixed number stream per level (never Math.random), so
 * practice pays off and best times are fair. Which gap of an answer wall is right comes from the run's seed instead
 * (maths.ts). A new level is a new entry in LEVELS.
 */
import { ANSWER_GAP_MIN, BIRD_SIZE, LEAD_IN_SECONDS, NEST_AFTER, RESPAWN_LOW, SKY, START_X, STEPS_PER_SECOND, WALL_WIDTH, WINGS, type Pace } from './config';
import { MEDALS } from './medals';

export type Feature = 'answer-gaps' | 'slide' | 'mixed-gaps' | 'ghosts' | 'gusts' | 'steam' | 'low-gravity' | 'underwater' | 'dark';

export interface LevelDef {
  /** 1 to 10. */
  n: number;
  id: string;
  name: string;
  /** The cartoon world, in words (the art plan has the style). */
  world: string;
  /** Rough length of a run, seconds of flying. */
  seconds: number;
  pace: Pace;
  /** Opening height, in bird heights. */
  gap: number;
  /** Seconds between walls. */
  spacing: number;
  checks: number;
  answerWalls: number;
  /** How many gaps an answer wall has: 2, 3, or a mix. */
  answerGaps: 2 | 3 | 'mix';
  /** How far gap centres wander up and down (units either side of the middle). */
  wander: number;
  /** What's new in this level (first-time tips). */
  features: readonly Feature[];
  /** The new thing, in a pupil's words. */
  newThing: string;
}

export const LEVELS: readonly LevelDef[] = [
  { n: 1, id: 'garden', name: 'Toon Garden', world: 'a sunny cartoon backyard with smiling flowers and a picket fence', seconds: 30, pace: 'slow', gap: 5.0, spacing: 2.6, checks: 1, answerWalls: 0, answerGaps: 2, wander: 1.2, features: [], newThing: 'Tap to flap. Each tap lifts you up.' },
  { n: 2, id: 'mesa', name: 'Mesa Mayhem', world: 'a zany desert canyon with cactus and tall red rock towers', seconds: 40, pace: 'slow', gap: 4.6, spacing: 2.4, checks: 2, answerWalls: 0, answerGaps: 2, wander: 2.0, features: [], newThing: 'The gaps go higher and lower.' },
  { n: 3, id: 'reef', name: 'Bubble Reef', world: 'a goofy undersea cartoon town with coral houses, jellyfish and bubbles', seconds: 45, pace: 'slow', gap: 4.4, spacing: 2.3, checks: 2, answerWalls: 1, answerGaps: 2, wander: 2.0, features: ['answer-gaps', 'underwater'], newThing: 'Underwater flaps are floaty. Fly through the right answer for a tailwind.' },
  { n: 4, id: 'kitchen', name: 'Cheese Kitchen', world: 'a giant kitchen seen by a mouse: table legs, cheese and mouse holes', seconds: 50, pace: 'medium', gap: 4.2, spacing: 2.2, checks: 2, answerWalls: 2, answerGaps: 2, wander: 2.2, features: ['answer-gaps', 'slide'], newThing: 'Some walls slide up and down. Watch them and time it.' },
  { n: 5, id: 'donut', name: 'Donut Town', world: 'a yellow-sky cartoon town with lamp posts and big chimneys', seconds: 55, pace: 'medium', gap: 4.0, spacing: 2.1, checks: 3, answerWalls: 2, answerGaps: 'mix', wander: 2.4, features: ['answer-gaps', 'mixed-gaps'], newThing: 'Some gaps are narrow and some are wide.' },
  { n: 6, id: 'manor', name: 'Spooky Manor', world: 'a silly-not-scary haunted house with wobbly ghosts', seconds: 60, pace: 'medium', gap: 3.9, spacing: 2.0, checks: 3, answerWalls: 2, answerGaps: 3, wander: 2.4, features: ['answer-gaps', 'ghosts'], newThing: 'Ghosts push you. The arrows show which way.' },
  { n: 7, id: 'peaks', name: 'Paper Peaks', world: 'a snowy mountain town made of paper cut-outs', seconds: 60, pace: 'medium-fast', gap: 3.8, spacing: 1.9, checks: 3, answerWalls: 3, answerGaps: 3, wander: 2.5, features: ['answer-gaps', 'gusts'], newThing: 'Snowy gusts come and go. Watch the snow blow.' },
  { n: 8, id: 'volcano', name: 'Volcano Island', world: 'a cartoon volcano island with glowing lava pools', seconds: 65, pace: 'medium-fast', gap: 3.7, spacing: 1.9, checks: 3, answerWalls: 3, answerGaps: 3, wander: 2.5, features: ['answer-gaps', 'steam'], newThing: 'Steam puffs push you up. Wait for the puff to pass.' },
  { n: 9, id: 'robot', name: 'Robot City', world: 'a neon cartoon city at night', seconds: 70, pace: 'fast', gap: 3.6, spacing: 1.8, checks: 4, answerWalls: 3, answerGaps: 3, wander: 2.6, features: ['answer-gaps', 'slide', 'ghosts', 'dark'], newThing: 'It is dark, but the gaps light up. Sliding walls and wind too.' },
  { n: 10, id: 'cosmic', name: 'Cosmic Storm', world: 'cartoon outer space with wobbly planets and comets', seconds: 80, pace: 'fast', gap: 3.5, spacing: 1.7, checks: 4, answerWalls: 4, answerGaps: 3, wander: 2.6, features: ['answer-gaps', 'slide', 'mixed-gaps', 'gusts', 'low-gravity'], newThing: 'Low gravity bubbles make you float. Everything else is here too!' },
];

export interface Gap {
  /** Middle of the opening (units from the ground) when the wall is still. */
  y: number;
  /** Opening height. */
  h: number;
}

export interface Wall {
  /** Index in the course. */
  i: number;
  /** Left edge. */
  x: number;
  gaps: Gap[];
  /** A sliding wall moves all its gaps together: `amp` units either way, once every `period` steps. */
  slide?: { amp: number; period: number; offset: number };
  /** Set on answer walls: which answer sign (0, 1, …) it belongs to. */
  answer?: number;
}

export type ZoneKind = 'ghost' | 'gust' | 'steam' | 'low-gravity';
export interface Zone {
  kind: ZoneKind;
  x0: number;
  x1: number;
  /** Extra push up (+) or down (−), units/s². */
  push: number;
  /** Gravity is multiplied by this inside (1 = normal). */
  gravity: number;
  /** A timed zone is only on for `on` steps of every `period` (from `offset`). */
  timed?: { period: number; on: number; offset: number };
}

export interface Perch {
  /** Which check (0, 1, …). */
  i: number;
  x: number;
  y: number;
}

export interface Sign {
  /** Which answer sign (0, 1, …), the same as its wall's `answer`. */
  i: number;
  /** Where it shows (`SIGN_SECONDS` before its wall). */
  x: number;
  wall: number;
}

export interface Course {
  def: LevelDef;
  speed: number;
  walls: Wall[];
  perches: Perch[];
  signs: Sign[];
  zones: Zone[];
  /** The nest: crossing this x finishes the run. */
  nestX: number;
  /** Medal times for this level, seconds (medals.ts, written by the sim). */
  medals: LevelMedals;
}

export interface LevelMedals {
  /** With maths: no bumps and every bonus. */
  gold: number;
  silver: number;
  /** Maths off: no bonuses to win, so its own times. */
  goldPlain: number;
  silverPlain: number;
}

/** A small number stream with whole-number steps, so each course is the same everywhere. */
function stream(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

/** Builds a level's course. `gentle` (Gentle wings) slows the world and widens the gaps a little. */
export function buildCourse(def: LevelDef, gentle = false): Course {
  const wings = WINGS[def.pace];
  const speed = wings.speed * (gentle ? 0.8 : 1);
  const step = wings.speed * def.spacing; // walls are the same distance apart with Gentle wings; there's just more time
  const gapH = def.gap * BIRD_SIZE * (gentle ? 1.15 : 1);
  const random = stream(1000 + def.n * 7919);
  const firstX = START_X + wings.speed * LEAD_IN_SECONDS;
  const count = Math.max(4, Math.floor((def.seconds * wings.speed - (firstX - START_X) - NEST_AFTER) / step) + 1);

  // Checks sit evenly through the course; each one is followed by the level's hardest stretch (wider swings).
  const checkAfter: number[] = [];
  for (let c = 0; c < def.checks; c++) checkAfter.push(Math.round(((c + 1) * count) / (def.checks + 1)) - 1);
  // Answer walls: spread out, never the first two walls, never right after a check (its sign must show in open sky).
  const answerAt: number[] = [];
  for (let a = 0; a < def.answerWalls; a++) {
    let w = Math.round(((a + 0.65) * count) / (def.answerWalls + 0.3));
    const clash = (k: number) => k < 2 || k >= count - 1 || checkAfter.some((c) => k - c >= 0 && k - c <= 2) || answerAt.some((o) => Math.abs(o - k) < 3);
    for (let tries = 0; clash(w) && tries < count; tries++) w = (w + 1) % count;
    if (!clash(w)) answerAt.push(w);
  }

  const mid = SKY / 2;
  const walls: Wall[] = [];
  let lastY = mid;
  for (let i = 0; i < count; i++) {
    const x = firstX + i * step;
    const answer = answerAt.indexOf(i);
    if (answer >= 0) {
      const n = def.answerGaps === 'mix' ? (answer % 2 === 0 ? 2 : 3) : def.answerGaps;
      const h = Math.max(ANSWER_GAP_MIN[n], Math.min(gapH, n === 2 ? 3 : 2.4));
      const gaps: Gap[] = n === 2 ? [{ y: 3.3, h }, { y: 6.7, h }] : [{ y: 2.2, h }, { y: 5, h }, { y: 7.8, h }];
      walls.push({ i, x, gaps, answer });
      lastY = mid;
      continue;
    }
    // After a check, the next three walls swing wider (the hard stretch); the first wall is gentle.
    const hard = checkAfter.some((c) => i - c >= 1 && i - c <= 3);
    const reach = i === 0 ? 0.6 : def.wander * (hard ? 1 : 0.75);
    // Never jump further than a pupil can climb or drop between two walls.
    const maxJump = 2.2 + def.spacing * 0.6;
    let y = mid + (random() * 2 - 1) * reach;
    y = Math.max(lastY - maxJump, Math.min(lastY + maxJump, y));
    let h = gapH;
    if (def.features.includes('mixed-gaps')) h = gapH * (random() < 0.5 ? 0.92 : 1.15);
    const room = h / 2 + 0.8;
    y = Math.max(room, Math.min(SKY - room, y));
    const wall: Wall = { i, x, gaps: [{ y, h }] };
    if (def.features.includes('slide') && i > 1 && i % 3 === 1) {
      const amp = Math.min(1.1, SKY - room - y, y - room);
      if (amp > 0.3) wall.slide = { amp, period: Math.round((3 + random() * 1.5) * STEPS_PER_SECOND), offset: Math.floor(random() * 200) };
    }
    walls.push(wall);
    lastY = y;
  }

  // The perches sit halfway between a wall and the next.
  // …at the height of the next opening (a little below, since the flap that sets off lifts the bird).
  const perches: Perch[] = checkAfter.map((after, i) => ({ i, x: walls[after].x + WALL_WIDTH + (step - WALL_WIDTH) / 2, y: walls[after + 1].gaps[0].y - RESPAWN_LOW }));
  const signs: Sign[] = answerAt
    .map((w, i) => ({ i, wall: w, x: walls[w].x - speed * 4 }))
    .sort((a, b) => a.i - b.i);

  const zones: Zone[] = [];
  const between = (i: number) => ({ x0: walls[i].x + WALL_WIDTH + 0.3, x1: walls[i + 1].x - 0.3 });
  const plainGaps = (i: number) => walls[i].answer === undefined && walls[i + 1].answer === undefined && !checkAfter.includes(i);
  for (let i = 1; i < count - 1; i++) {
    if (!plainGaps(i)) continue;
    const { x0, x1 } = between(i);
    if (def.features.includes('ghosts') && i % 3 === 0) zones.push({ kind: 'ghost', x0, x1, push: random() < 0.5 ? 5 : -5, gravity: 1 });
    if (def.features.includes('gusts') && i % 4 === 2) {
      zones.push({ kind: 'gust', x0, x1, push: random() < 0.5 ? 7 : -6, gravity: 1, timed: { period: 150, on: 70, offset: Math.floor(random() * 150) } });
    }
    if (def.features.includes('steam') && i % 3 === 1) zones.push({ kind: 'steam', x0, x1: Math.min(x1, x0 + 2), push: 14, gravity: 1, timed: { period: 130, on: 40, offset: Math.floor(random() * 130) } });
    if (def.features.includes('low-gravity') && i % 4 === 0) zones.push({ kind: 'low-gravity', x0: x0 + 0.5, x1: x1 - 2, push: 0, gravity: 0.55 }); // ends well before the next wall
  }

  return {
    def,
    speed,
    walls,
    perches,
    signs,
    zones,
    nestX: walls[count - 1].x + WALL_WIDTH + NEST_AFTER,
    medals: MEDALS[def.id] ?? { gold: def.seconds, silver: def.seconds + 10, goldPlain: def.seconds, silverPlain: def.seconds + 10 },
  };
}

export const levelById = (id: string): LevelDef | undefined => LEVELS.find((l) => l.id === id);
