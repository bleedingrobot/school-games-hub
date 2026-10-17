/**
 * Walking, as it happens over time: key presses, tap-to-walk paths, smooth steps, turning on
 * the spot, a trainer who walks up to you. The rules (what blocks, what a step does) are in
 * shared/monsters/world; this only decides *when* each step happens, so it never goes faster than
 * a student can follow. No React and no canvas: the screen reads `view()` and draws it.
 */
import { OPPOSITE, type Dir, type Thing, type WorldState } from '../../../../shared/monsters/world/types';
import { planTap } from '../../../../shared/monsters/world/walking';
import {
  interact, mapOf, step, type InteractOutcome, type Trigger, type WorldOptions,
} from '../../../../shared/monsters/world/world';

/** EASY TO EDIT: how long things take, in milliseconds. About 5 tiles a second: gentle on purpose. */
export const TIMING = {
  step: 200,
  /** Turning on the spot (a quick tap on a key turns without stepping). */
  turn: 110,
  /** The "!" over a trainer who has seen you, before they walk. */
  notice: 700,
  /** A trainer walking up to you, per tile. */
  trainerStep: 220,
};

export interface ControllerEvents {
  /** The logical game state changed (after every step, turn or talk). */
  onState(state: WorldState): void;
  /** Grass started a wild battle. Input is locked until `unlock()`. */
  onWild(trigger: Extract<Trigger, { kind: 'wild' }>): void;
  /** A trainer has walked up and wants a battle. */
  onTrainer(trainer: Thing): void;
  /** Something to read out: a sign, a person, the nurse. */
  onTalk(outcome: InteractOutcome): void;
  /** You went through a door or exit. */
  onEnter?(state: WorldState): void;
}

export interface Actor {
  x: number;
  y: number;
  facing: Dir;
}

export interface WalkView {
  state: WorldState;
  /** Where to draw the player, in tiles (between two tiles while stepping). */
  x: number;
  y: number;
  /** Walking cycle: false = standing, used for a little bob. */
  walking: boolean;
  /** People who are not where the map put them (a trainer on the way to you), and who is looking at you. */
  actors: Map<string, Actor>;
  /** Who has the "!" over their head. */
  noticed: string | null;
}

export class WalkController {
  state: WorldState;
  private from: [number, number] | null = null;
  private stepStart = 0;
  private stepLength = 0;
  private busyUntil = 0;
  private held: Dir[] = [];
  private path: Dir[] = [];
  /** After a tap-walk, turn to this way and talk. */
  private thenTalk: Dir | null = null;
  private locked = false;
  private actors = new Map<string, Actor>();
  private noticed: string | null = null;
  private script: { at: number; run: () => void }[] = [];
  private now = 0;

  constructor(initial: WorldState, private opts: WorldOptions, private events: ControllerEvents, private timeScale = 1) {
    this.state = initial;
  }

  setOptions(opts: WorldOptions) {
    this.opts = opts;
  }

  /** Put the game at a state straight away (teleporting). */
  jump(state: WorldState) {
    this.state = state;
    this.from = null;
    this.path = [];
    this.thenTalk = null;
    this.script = [];
    this.actors.clear();
    this.noticed = null;
    this.events.onState(state);
  }

  /** While something else has the screen (a talk box, a battle, settings) walking waits. */
  lock() {
    this.locked = true;
    this.held = [];
    this.path = [];
    this.thenTalk = null;
  }
  unlock() {
    this.locked = false;
    this.actors.clear();
    this.noticed = null;
  }
  get isLocked() {
    return this.locked;
  }

  private ms(n: number) {
    return n * this.timeScale;
  }

  press(dir: Dir, now = this.now) {
    this.path = [];
    this.thenTalk = null;
    this.held = [...this.held.filter((d) => d !== dir), dir];
    this.tick(now);
  }
  release(dir: Dir) {
    this.held = this.held.filter((d) => d !== dir);
  }

  /** A tap on a tile: walk there by the shortest way, or walk up to a person or sign and talk. */
  tap(tx: number, ty: number) {
    if (this.locked) return;
    const plan = planTap(mapOf(this.opts, this.state), this.state, tx, ty);
    if (plan.kind === 'none') return;
    this.held = [];
    this.path = plan.path.slice();
    this.thenTalk = plan.kind === 'talk' ? plan.face : null;
    if (plan.kind === 'talk' && !plan.path.length) this.faceAndTalk(plan.face);
    else this.tick(this.now);
  }

  private faceAndTalk(face: Dir) {
    this.thenTalk = null;
    this.state = { ...this.state, facing: face };
    this.talk();
  }

  /** Space / Enter / the Talk button: talk to what you face. */
  talk() {
    if (this.locked || this.isStepping(this.now)) return;
    const out = interact(this.state, this.opts);
    if (!out.talk) return;
    this.state = out.state;
    this.held = [];
    this.path = [];
    this.events.onState(this.state);
    this.events.onTalk(out);
  }

  private isStepping(now: number) {
    return this.from !== null && now < this.stepStart + this.stepLength;
  }

  /** Move the clock on and do whatever is due. Call this about every 16 ms. */
  tick(now: number) {
    this.now = now;
    for (const s of this.script.filter((x) => now >= x.at)) {
      this.script = this.script.filter((x) => x !== s);
      s.run();
    }
    if (this.from && now >= this.stepStart + this.stepLength) this.from = null;
    if (this.locked || now < this.busyUntil || this.isStepping(now)) return;

    let dir: Dir | undefined = this.held[this.held.length - 1];
    let turnFirst = true;
    if (!dir && this.path.length) {
      dir = this.path[0];
      turnFirst = false;
    }
    if (!dir) {
      if (this.thenTalk) this.faceAndTalk(this.thenTalk);
      return;
    }

    const before = this.state;
    const out = step(before, dir, this.opts, { turnFirst });
    this.state = out.state;
    if (out.action === 'turn') {
      this.busyUntil = now + this.ms(TIMING.turn);
      this.events.onState(this.state);
      return;
    }
    if (!turnFirst) {
      if (out.action === 'bump') this.path = []; // something is in the way now
      else this.path.shift();
    }
    if (out.action === 'bump') {
      this.busyUntil = now + this.ms(TIMING.turn);
      this.events.onState(this.state);
      return;
    }
    this.from = out.action === 'warp' ? null : [before.x, before.y];
    this.stepStart = now;
    this.stepLength = out.action === 'warp' ? this.ms(TIMING.step) / 2 : this.ms(TIMING.step);
    if (out.action === 'warp') {
      this.busyUntil = now + this.stepLength;
      this.held = [];
      this.path = [];
      this.thenTalk = null;
      this.events.onEnter?.(this.state);
    }
    this.events.onState(this.state);

    if (out.trigger?.kind === 'wild') {
      const t = out.trigger;
      this.lockNow();
      // Let the last step finish, then start the battle.
      this.script.push({ at: now + this.stepLength, run: () => this.events.onWild(t) });
    } else if (out.trigger?.kind === 'trainer') {
      this.lockNow();
      this.meetTrainer(out.trigger, now + this.stepLength);
    }
  }

  private lockNow() {
    this.held = [];
    this.path = [];
    this.thenTalk = null;
    this.locked = true;
  }

  /** The "!", then the trainer walks up to you, then they challenge you. */
  private meetTrainer(trigger: Extract<Trigger, { kind: 'trainer' }>, start: number) {
    const t = trigger.sighting.trainer;
    this.actors.set(t.id, { x: t.x, y: t.y, facing: t.facing });
    this.noticed = t.id;
    let at = start + this.ms(TIMING.notice);
    this.script.push({ at, run: () => { this.noticed = null; } });
    for (const [x, y] of trigger.sighting.path) {
      const arrive = at + this.ms(TIMING.trainerStep);
      const from = { ...this.actors.get(t.id)! };
      this.walkActor(t.id, from, { x, y }, at, arrive);
      at = arrive;
    }
    // The player turns to face the trainer.
    const toward = (() => {
      const dx = t.x - this.state.x;
      const dy = t.y - this.state.y;
      const d = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      return d as Dir;
    })();
    this.script.push({
      at,
      run: () => {
        this.state = { ...this.state, facing: toward };
        this.actors.set(t.id, { ...(this.actors.get(t.id) ?? { x: t.x, y: t.y }), facing: OPPOSITE[toward] });
        this.events.onState(this.state);
        this.events.onTrainer(t);
      },
    });
  }

  private actorTween = new Map<string, { from: Actor; to: { x: number; y: number }; start: number; end: number }>();
  private walkActor(id: string, from: Actor, to: { x: number; y: number }, start: number, end: number) {
    this.script.push({
      at: start,
      run: () => {
        this.actorTween.set(id, { from, to, start, end });
      },
    });
    this.script.push({
      at: end,
      run: () => {
        this.actorTween.delete(id);
        const dir: Dir = to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up';
        this.actors.set(id, { x: to.x, y: to.y, facing: dir });
      },
    });
  }

  /** Everything the screen needs to draw this moment. */
  view(now = this.now): WalkView {
    let x = this.state.x;
    let y = this.state.y;
    let walking = false;
    if (this.from && this.stepLength > 0) {
      const p = Math.min(1, Math.max(0, (now - this.stepStart) / this.stepLength));
      x = this.from[0] + (this.state.x - this.from[0]) * p;
      y = this.from[1] + (this.state.y - this.from[1]) * p;
      walking = p < 1;
    }
    const actors = new Map(this.actors);
    for (const [id, tw] of this.actorTween) {
      const p = Math.min(1, Math.max(0, (now - tw.start) / Math.max(1, tw.end - tw.start)));
      const dir: Dir = tw.to.x > tw.from.x ? 'right' : tw.to.x < tw.from.x ? 'left' : tw.to.y > tw.from.y ? 'down' : 'up';
      actors.set(id, { x: tw.from.x + (tw.to.x - tw.from.x) * p, y: tw.from.y + (tw.to.y - tw.from.y) * p, facing: dir });
    }
    return { state: this.state, x, y, walking, actors, noticed: this.noticed };
  }

  /** For tests and the test page: is a step or turn still going? */
  get busy() {
    return this.locked || this.isStepping(this.now) || this.now < this.busyUntil || this.script.length > 0;
  }
}
