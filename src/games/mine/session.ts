/**
 * One run of a level, held outside React: the rules' state, the inputs recorded so far, and what the screen needs
 * (the step before this one, to draw smoothly between steps; rooms visited, for the map; things that just happened,
 * for messages and sounds). It never draws and never reads the keyboard.
 */
import { USE_RANGE } from '../../../shared/mine/config';
import { clockSteps, makeWorld, newRun, stepRun, type RunState, type World } from '../../../shared/mine/engine';
import { GRANT, PENALTY, pushInput } from '../../../shared/mine/inputs';
import { makeLevel, type PadKind, type Recipe } from '../../../shared/mine/level';

/** A power-up pad is tried at most this many times in a run (docs/MINE-PLAN.md, section 7). */
export const MAX_PAD_TRIES = 3;

export type UseTarget =
  | { kind: 'door'; id: number; x: number; y: number; z: number; distance: number }
  | { kind: 'pad'; id: number; padKind: PadKind; x: number; y: number; z: number; distance: number };

export type MineEvent =
  | { kind: 'key'; colour: 'blue' | 'yellow' | 'red' }
  | { kind: 'door'; id: number; byKey: boolean }
  | { kind: 'pickup'; what: 'shield' | 'energy' | 'missiles' }
  | { kind: 'pad'; padKind: PadKind }
  | { kind: 'robot-down'; x: number; y: number; z: number }
  | { kind: 'hurt'; amount: number }
  | { kind: 'wrong' }
  | { kind: 'reactor-hit' }
  | { kind: 'reactor-down' }
  | { kind: 'rebuilt' }
  | { kind: 'laser' }
  | { kind: 'missile' }
  | { kind: 'boom'; x: number; y: number; z: number }
  | { kind: 'finished' }
  | { kind: 'timeout' };

/** The bits of the state the picture smooths between two steps. */
export interface Snapshot {
  px: number; py: number; pz: number;
  fx: number; fy: number; fz: number;
  ux: number; uy: number; uz: number;
  robots: Float64Array;
}

function snapshot(s: RunState): Snapshot {
  const robots = new Float64Array(s.robots.length * 3);
  s.robots.forEach((r, i) => {
    robots[i * 3] = r.x;
    robots[i * 3 + 1] = r.y;
    robots[i * 3 + 2] = r.z;
  });
  return { px: s.px, py: s.py, pz: s.pz, fx: s.fx, fy: s.fy, fz: s.fz, ux: s.ux, uy: s.uy, uz: s.uz, robots };
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export class MineSession {
  readonly world: World;
  readonly state: RunState;
  /** The inputs so far, as the rules store them. */
  readonly runs: [number, number][] = [];
  prev: Snapshot;
  readonly visited = new Set<number>();
  readonly visitedEdges = new Set<string>();
  /** Things that happened since the screen last looked. The screen empties this each frame. */
  events: MineEvent[] = [];
  private padTries = new Map<number, number>();
  private announcedDoors = new Set<number>();
  private announcedPads = new Set<number>();

  constructor(recipe: Recipe, options: { steady: boolean }) {
    this.world = makeWorld(makeLevel(recipe), { steady: options.steady });
    this.state = newRun(this.world);
    this.prev = snapshot(this.state);
    this.visited.add(this.state.lastRoom);
  }

  get running(): boolean {
    return this.state.outcome === 'running';
  }

  /** The clock the pupil sees, in steps. */
  get clock(): number {
    return clockSteps(this.state);
  }

  /** Plays one step and records it. */
  step(code: number): void {
    const s = this.state;
    if (s.outcome !== 'running') return;
    const before = {
      keys: [...s.keys], doors: s.doorsOpen.filter(Boolean).length, byKey: s.doorsByKey, pickups: s.pickupsTaken.map((v) => v),
      pads: s.padsUsed.filter(Boolean).length, killed: s.robotsKilled, alive: s.robots.map((r) => r.alive), damage: s.damageTaken,
      reactorHp: s.reactorHp, reactorDown: s.reactorDown, deaths: s.deaths, wrong: s.wrongAnswers,
      missiles: s.shots.filter((t) => t.k === 1).map((t) => ({ x: t.x + t.vx, y: t.y + t.vy, z: t.z + t.vz, life: t.life })),
      laserCool: s.laserCool, missileCool: s.missileCool, missileCount: s.missiles,
    };
    const room = s.lastRoom;
    const snap = snapshot(s);
    stepRun(this.world, s, code);
    pushInput(this.runs, code);
    this.prev = snap;
    this.diff(before, room);
  }

  private diff(b: { keys: number[]; doors: number; byKey: number; pickups: number[]; pads: number; killed: number; alive: number[]; damage: number; reactorHp: number; reactorDown: number; deaths: number; wrong: number; missiles: { x: number; y: number; z: number; life: number }[]; laserCool: number; missileCool: number; missileCount: number }, room: number): void {
    const s = this.state;
    const L = this.world.level;
    const ev = this.events;
    (['blue', 'yellow', 'red'] as const).forEach((colour, i) => {
      if (b.keys[i] === 0 && s.keys[i] === 1) ev.push({ kind: 'key', colour });
    });
    if (s.doorsOpen.filter(Boolean).length > b.doors) {
      // Name the door that just opened.
      for (const door of L.doors) if (s.doorsOpen[door.id] === 1) {
        if (!this.announcedDoors.has(door.id)) {
          this.announcedDoors.add(door.id);
          ev.push({ kind: 'door', id: door.id, byKey: door.kind !== 'question' });
        }
      }
    }
    s.pickupsTaken.forEach((v, i) => {
      if (v === 1 && b.pickups[i] === 0) ev.push({ kind: 'pickup', what: L.pickups[i].kind });
    });
    if (s.padsUsed.filter(Boolean).length > b.pads) {
      s.padsUsed.forEach((v, n) => {
        if (v === 1 && !this.announcedPads.has(n)) {
          this.announcedPads.add(n);
          ev.push({ kind: 'pad', padKind: L.pads[n].kind });
        }
      });
    }
    s.robots.forEach((r, i) => {
      if (b.alive[i] === 1 && r.alive === 0) ev.push({ kind: 'robot-down', x: r.x, y: r.y, z: r.z });
    });
    if (s.damageTaken > b.damage && s.wrongAnswers === b.wrong) ev.push({ kind: 'hurt', amount: s.damageTaken - b.damage });
    if (s.wrongAnswers > b.wrong) ev.push({ kind: 'wrong' });
    if (s.reactorHp < b.reactorHp && !s.reactorDown) ev.push({ kind: 'reactor-hit' });
    if (s.reactorDown && !b.reactorDown) ev.push({ kind: 'reactor-down' });
    if (s.deaths > b.deaths) ev.push({ kind: 'rebuilt' });
    if (s.laserCool > b.laserCool) ev.push({ kind: 'laser' });
    if (s.missileCool > b.missileCool) ev.push({ kind: 'missile' });
    // A missile that is gone before its time ran out has blown up where it would have been.
    if (b.missiles.length) {
      const now = s.shots.filter((t) => t.k === 1);
      for (const m of b.missiles) {
        if (m.life <= 1) continue;
        const stillThere = now.some((t) => Math.abs(t.x - m.x) < 0.02 && Math.abs(t.y - m.y) < 0.02 && Math.abs(t.z - m.z) < 0.02);
        if (!stillThere) ev.push({ kind: 'boom', x: m.x, y: m.y, z: m.z });
      }
    }
    if (s.lastRoom !== room) {
      this.visited.add(s.lastRoom);
      if (L.edges.some(([a, c]) => edgeKey(a, c) === edgeKey(room, s.lastRoom))) this.visitedEdges.add(edgeKey(room, s.lastRoom));
    }
    if (s.outcome === 'finished') ev.push({ kind: 'finished' });
    if (s.outcome === 'timeout') ev.push({ kind: 'timeout' });
  }

  /** The nearest question door or power-up pad the pilot can use from here, if any. */
  target(): UseTarget | null {
    const s = this.state;
    if (s.outcome !== 'running') return null;
    const L = this.world.level;
    let best: UseTarget | null = null;
    const near = (x: number, y: number, z: number) => Math.sqrt((s.px - x) ** 2 + (s.py - y) ** 2 + (s.pz - z) ** 2);
    for (const d of L.doors) {
      if (d.kind !== 'question' || s.doorsOpen[d.id] === 1) continue;
      const distance = near(d.x, d.y, d.z);
      if (distance <= USE_RANGE - 0.05 && (!best || distance < best.distance)) best = { kind: 'door', id: d.id, x: d.x, y: d.y, z: d.z, distance };
    }
    L.pads.forEach((p, n) => {
      if (s.padsUsed[n] === 1 || (this.padTries.get(p.id) ?? 0) >= MAX_PAD_TRIES) return;
      const distance = near(p.x, p.y, p.z);
      if (distance <= USE_RANGE - 0.05 && (!best || distance < best.distance)) best = { kind: 'pad', id: p.id, padKind: p.kind, x: p.x, y: p.y, z: p.z, distance };
    });
    return best;
  }

  /** The pilot answered a question for a door or pad. A right answer opens or refills; a wrong one costs at a door. */
  answered(target: UseTarget, correct: boolean): void {
    if (target.kind === 'pad') this.padTries.set(target.id, (this.padTries.get(target.id) ?? 0) + 1);
    if (correct) this.step(GRANT + target.id);
    else if (target.kind === 'door') this.step(PENALTY);
  }

  /** How many tries a pad has left. */
  padTriesLeft(id: number): number {
    return MAX_PAD_TRIES - (this.padTries.get(id) ?? 0);
  }
}
