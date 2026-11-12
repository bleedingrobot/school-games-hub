/**
 * Sky Dash (docs/TOON-FLAP-PLAN.md, section 9, stage F.7): the classic one-touch version, open after level 5.
 *
 * It runs on the same physics as the levels (engine.ts stepRun), on an endless-looking course made from the run's seed.
 * stepRun treats a bump the level way (+3 s, try again in front of the wall); Sky Dash then decides: a spare feather or the
 * revive potion saves the run, otherwise it ends there. Feathers come from checks answered right (the server marks them),
 * so the server replays a dash with the same marks and gets the same walls.
 */
import { BIRD_SIZE, DASH_CHECK_SECONDS, DASH_END, DASH_FEATHERS_MAX, DASH_RAMP_WALLS, DASH_START, LEAD_IN_SECONDS, MAX_RUN_STEPS, NEST_AFTER, RESPAWN_LOW, SKY, START_X, STEPS_PER_SECOND, WALL_WIDTH, WINGS } from './config';
import { newRun, stepRun, type RunState, type StepEvent } from './engine';
import type { Course, LevelDef, Perch, Wall } from './levels';

/** Sky Dash as a level: the Cosmic Storm sky (world 10), medium wings. */
export const DASH_DEF: LevelDef = {
  n: 10, id: 'dash', name: 'Sky Dash', world: 'cartoon outer space', seconds: MAX_RUN_STEPS / STEPS_PER_SECOND, pace: 'medium',
  gap: DASH_START.gap, spacing: DASH_START.spacing, checks: 0, answerWalls: 0, answerGaps: 2, wander: DASH_START.wander,
  features: [], newThing: 'One bump and the dash is over. Get checks right for spare feathers.',
};

function stream(seed: number): () => number {
  let s = seed % 2147483646 + 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

/** The seed's own number (the last 9 digits), so each dash has its own course and the server builds the same one. */
const seedNumber = (seed: string): number => Number(seed.slice(-9)) || 1;

/** A dash's course: long enough for the longest run (MAX_RUN_STEPS), with a perch (a check) every 30 s of flying. */
export function buildDashCourse(seed: string): Course {
  const speed = WINGS[DASH_DEF.pace].speed;
  const random = stream(seedNumber(seed));
  const mid = SKY / 2;
  const endX = START_X + speed * (MAX_RUN_STEPS / STEPS_PER_SECOND) + 20;
  const walls: Wall[] = [];
  let x = START_X + speed * LEAD_IN_SECONDS;
  let lastY = mid;
  for (let i = 0; x < endX; i++) {
    const p = Math.min(1, i / DASH_RAMP_WALLS);
    const spacing = DASH_START.spacing + (DASH_END.spacing - DASH_START.spacing) * p;
    const h = (DASH_START.gap + (DASH_END.gap - DASH_START.gap) * p) * BIRD_SIZE;
    const reach = i === 0 ? 0.6 : DASH_START.wander + (DASH_END.wander - DASH_START.wander) * p;
    const maxJump = 2.2 + spacing * 0.6;
    let y = mid + (random() * 2 - 1) * reach;
    y = Math.max(lastY - maxJump, Math.min(lastY + maxJump, y));
    const room = h / 2 + 0.8;
    y = Math.max(room, Math.min(SKY - room, y));
    walls.push({ i, x, gaps: [{ y, h }] });
    lastY = y;
    x += speed * spacing;
  }
  // A perch every DASH_CHECK_SECONDS of flying, halfway between the walls it falls between.
  const perches: Perch[] = [];
  for (let c = 1; ; c++) {
    const target = START_X + speed * DASH_CHECK_SECONDS * c;
    const w = walls.findIndex((wall, k) => k + 1 < walls.length && wall.x <= target && walls[k + 1].x > target);
    if (w < 0) break;
    const a = walls[w].x + WALL_WIDTH;
    perches.push({ i: perches.length, x: a + (walls[w + 1].x - a) / 2, y: walls[w + 1].gaps[0].y - RESPAWN_LOW });
  }
  const big = 9999;
  return {
    def: DASH_DEF, speed, walls, perches, signs: [], zones: [],
    nestX: walls[walls.length - 1].x + WALL_WIDTH + NEST_AFTER,
    medals: { gold: big, silver: big, goldPlain: big, silverPlain: big },
  };
}

export interface DashState {
  run: RunState;
  /** Spare feathers held now. */
  feathers: number;
  feathersUsed: number;
  potionUsed: boolean;
  /** Ended by a bump nothing could save. */
  crashed: boolean;
}

export const newDash = (course: Course): DashState => ({ run: newRun(course), feathers: 0, feathersUsed: 0, potionUsed: false, crashed: false });

/** A check answered right: a spare feather (up to the most you can hold). */
export function earnFeather(d: DashState): void {
  d.feathers = Math.min(DASH_FEATHERS_MAX, d.feathers + 1);
}

/** What saved a bump: a feather first, then the potion (if the pupil brought one), else the dash is over. */
export type Save = 'feather' | 'potion' | 'crash';

/**
 * One dash step. After a bump stepRun has already put the bird back to hover in front of the wall; Sky Dash then spends a
 * feather or the potion, or ends the run (the score stays the walls passed).
 */
export function stepDash(course: Course, d: DashState, flap: boolean, potion: boolean): { event: StepEvent; save: Save | null } {
  const event = stepRun(course, d.run, flap);
  if (event !== 'bump') return { event, save: null };
  if (d.feathers > 0) {
    d.feathers--;
    d.feathersUsed++;
    return { event, save: 'feather' };
  }
  if (potion && !d.potionUsed) {
    d.potionUsed = true;
    return { event, save: 'potion' };
  }
  d.crashed = true;
  d.run.mode = 'done';
  return { event, save: 'crash' };
}

/** The score: walls flown past. */
export const dashWalls = (d: DashState): number => d.run.nextWall;

export interface DashReplay {
  valid: boolean;
  dash: DashState;
}

/**
 * Plays a whole dash from its flaps, with the server's marks (`right[i]`: was check i answered right) and whether a potion
 * could be used. Like replayRun: the flaps must be in order and every hover must end with the next flap.
 */
export function replayDash(course: Course, flaps: readonly number[], right: readonly boolean[], potion: boolean): DashReplay {
  const d = newDash(course);
  let k = 0;
  while (d.run.mode !== 'done') {
    const next = k < flaps.length ? flaps[k] : -1;
    if (next >= 0 && next < d.run.t) return { valid: false, dash: d };
    const flap = next === d.run.t;
    if (d.run.mode === 'hover' && !flap) return { valid: false, dash: d };
    if (flap) k++;
    const { event } = stepDash(course, d, flap, potion);
    if (event === 'perch' && right[d.run.perches - 1]) earnFeather(d);
  }
  return { valid: k === flaps.length, dash: d };
}
