/**
 * Turning what the pupil does (keys, mouse, thumb sticks, buttons) into the rules' whole-number input for each step.
 *
 * The rules step 30 times a second and store one whole number a step. Turning is the tricky part: a mouse gives a
 * different number every moment, which would make a recorded run big. So turning is decided about 10 times a second
 * (every AIM_EVERY steps) and held for those steps; leftover mouse movement carries over, so slow movement still counts
 * (docs/MINE-PLAN.md, section 4).
 */
import { TURN_MAX, TURN_UNIT } from '../../../shared/mine/config';
import { NO_INPUT, type PilotInput } from '../../../shared/mine/inputs';

/** How many steps one aim update lasts (30 steps a second ÷ 3 = 10 updates a second). */
export const AIM_EVERY = 3;
/** The keyboard turns at this steady rate (inputs go from −6 to 6). */
export const KEY_TURN = 4;
/** Radians the ship turns for each pixel the mouse moves, at sensitivity 1. */
export const MOUSE_RAD_PER_PX = 0.0035;
/** A thumb stick pushed less than this does nothing. */
export const STICK_DEADZONE = 0.3;

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

/** Collects mouse movement and turns it into whole-number turns, with the leftover carried to the next update. */
export class MouseAim {
  private yaw = 0;
  private pitch = 0;

  /** Radians the pupil asked to turn (right and up are positive). */
  add(radYaw: number, radPitch: number): void {
    // Never build up a long backlog (a flick, or a tab that was in the background).
    const cap = TURN_MAX * TURN_UNIT * AIM_EVERY * 1.5;
    this.yaw = clamp(this.yaw + radYaw, -cap, cap);
    this.pitch = clamp(this.pitch + radPitch, -cap, cap);
  }

  /** The whole-number turn to hold for the next AIM_EVERY steps. */
  take(): { yaw: number; pitch: number } {
    const per = TURN_UNIT * AIM_EVERY;
    const yaw = clamp(Math.round(this.yaw / per), -TURN_MAX, TURN_MAX);
    const pitch = clamp(Math.round(this.pitch / per), -TURN_MAX, TURN_MAX);
    this.yaw -= yaw * per;
    this.pitch -= pitch * per;
    return { yaw, pitch };
  }

  clear(): void {
    this.yaw = 0;
    this.pitch = 0;
  }
}

export interface ControlSettings {
  sensitivity: number;
  invertY: boolean;
  /** The mouse is captured, so moving it looks around and the buttons fire. */
  lock: boolean;
  /**
   * Easy flying (docs/plans/mine-flight/PLAN.md, M2): the ship cruises by itself. Arrows or WASD steer, Shift brakes,
   * X fires a missile, and the mouse steers by where it points (the further from the middle, the faster the turn).
   */
  easy?: boolean;
}

export type TouchButton = 'up' | 'down' | 'fire' | 'missile' | 'brake';

/** Easy pointing: the middle of the picture this wide (a share of half the picture) does not turn the ship. */
export const POINT_DEADZONE = 0.1;

const LETTERS = new Set(['KeyB', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'KeyQ', 'KeyE', 'KeyX', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Controls {
  settings: ControlSettings = { sensitivity: 1, invertY: false, lock: false, easy: false };
  /** Easy pointing: where the mouse is on the picture, −1 to 1 each way from the middle (right and down are positive), or null. */
  private point: { x: number; y: number } | null = null;
  private down = new Set<string>();
  private mouse = new MouseAim();
  private buttons = new Set<TouchButton>();
  private mouseFire = false;
  private mouseMissile = false;
  private tapFire = 0;
  private move = { x: 0, y: 0 };
  private look = { x: 0, y: 0 };
  private held = { yaw: 0, pitch: 0 };
  private count = 0;

  // ——— Keyboard ———
  /** Returns true when the key is one the game uses (so the page should not also scroll or click). */
  keyDown(code: string): boolean {
    if (!LETTERS.has(code)) return false;
    this.down.add(code);
    return true;
  }
  keyUp(code: string): void {
    this.down.delete(code);
  }

  // ——— Mouse ———
  /** Pixels the mouse moved (right and down are positive on screen). */
  mouseMoved(dx: number, dy: number): void {
    const k = MOUSE_RAD_PER_PX * this.settings.sensitivity;
    this.mouse.add(dx * k, (this.settings.invertY ? dy : -dy) * k);
  }
  setMouseButtons(fire: boolean, missile: boolean): void {
    this.mouseFire = fire;
    this.mouseMissile = missile;
  }
  /** A quick tap on the picture (not a drag) fires a short burst. */
  tap(): void {
    this.tapFire = 5;
  }

  /** Easy flying: where the mouse is over the picture, as a share of half its width and height from the middle; null when it leaves. */
  setPoint(x: number, y: number): void;
  setPoint(p: null): void;
  setPoint(x: number | null, y?: number): void {
    this.point = x === null ? null : { x: clamp(x, -1, 1), y: clamp(y ?? 0, -1, 1) };
  }

  // ——— Touch ———
  setMove(x: number, y: number): void {
    this.move = { x, y };
  }
  setLook(x: number, y: number): void {
    this.look = { x, y };
  }
  setButton(b: TouchButton, on: boolean): void {
    if (on) this.buttons.add(b);
    else this.buttons.delete(b);
  }

  /** Lets go of everything (the window lost focus, or the game was paused). */
  clear(): void {
    this.down.clear();
    this.buttons.clear();
    this.mouse.clear();
    this.mouseFire = false;
    this.mouseMissile = false;
    this.tapFire = 0;
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.held = { yaw: 0, pitch: 0 };
    this.point = null;
    this.count = 0;
  }

  private key(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  private dead(v: number): number {
    return Math.abs(v) < STICK_DEADZONE ? 0 : v > 0 ? 1 : -1;
  }

  /** The input for the next step. Call once per step. */
  sample(): PilotInput {
    return this.settings.easy ? this.sampleEasy() : this.sampleClassic();
  }

  /** Easy flying: one way to steer (stick, keys or pointing), fire, missile and brake. The ship pushes forward by itself. */
  private sampleEasy(): PilotInput {
    if (this.count % AIM_EVERY === 0) {
      const m = this.mouse.take();
      const sens = this.settings.sensitivity;
      const flip = this.settings.invertY ? -1 : 1;
      const curve = (v: number, dead: number) => (Math.abs(v) < dead ? 0 : Math.sign(v) * ((Math.abs(v) - dead) / (1 - dead)) ** 1.5);
      const stickYaw = curve(this.look.x, STICK_DEADZONE) * TURN_MAX * sens;
      const stickPitch = curve(-this.look.y, STICK_DEADZONE) * TURN_MAX * sens * flip;
      const steeringByKey = this.key('ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS');
      // Keys win over pointing, so a mouse left resting to one side can't fight a pupil who is using the keys.
      const p = this.point && !this.settings.lock && !steeringByKey ? this.point : { x: 0, y: 0 };
      const pointYaw = curve(p.x, POINT_DEADZONE) * TURN_MAX * sens * 0.75;
      const pointPitch = curve(-p.y, POINT_DEADZONE) * TURN_MAX * sens * 0.75 * flip;
      const right = this.key('ArrowRight', 'KeyD') ? 1 : 0;
      const left = this.key('ArrowLeft', 'KeyA') ? 1 : 0;
      const up = this.key('ArrowUp', 'KeyW') ? 1 : 0;
      const down = this.key('ArrowDown', 'KeyS') ? 1 : 0;
      const keyYaw = (right - left) * (KEY_TURN + 1);
      const keyPitch = (up - down) * (KEY_TURN + 1) * flip;
      this.held = {
        yaw: clamp(Math.round(m.yaw + stickYaw + pointYaw + keyYaw), -TURN_MAX, TURN_MAX),
        pitch: clamp(Math.round(m.pitch + stickPitch + pointPitch + keyPitch), -TURN_MAX, TURN_MAX),
      };
    }
    this.count++;
    const fire = this.key('Space') || this.mouseFire || this.buttons.has('fire') || this.tapFire > 0;
    if (this.tapFire > 0) this.tapFire--;
    const brake = this.key('ShiftLeft', 'ShiftRight', 'KeyB') || this.buttons.has('brake');
    return {
      tx: 0,
      ty: 0,
      tz: brake ? -1 : 0,
      yaw: this.held.yaw,
      pitch: this.held.pitch,
      roll: 0,
      fire,
      missile: this.key('KeyX') || this.mouseMissile || this.buttons.has('missile'),
    };
  }

  private sampleClassic(): PilotInput {
    if (this.count % AIM_EVERY === 0) {
      const m = this.mouse.take();
      const sens = this.settings.sensitivity;
      const flip = this.settings.invertY ? -1 : 1;
      // The look stick is steered by deflection, with a gentle curve so small pushes are fine.
      const curve = (v: number) => (Math.abs(v) < STICK_DEADZONE ? 0 : Math.sign(v) * v * v);
      const stickYaw = Math.round(curve(this.look.x) * TURN_MAX * sens);
      const stickPitch = Math.round(curve(-this.look.y) * TURN_MAX * sens * flip);
      const keyYaw = (this.key('ArrowRight') ? KEY_TURN : 0) - (this.key('ArrowLeft') ? KEY_TURN : 0);
      const keyPitch = (this.key('ArrowUp') ? KEY_TURN : 0) - (this.key('ArrowDown') ? KEY_TURN : 0);
      this.held = {
        yaw: clamp(m.yaw + stickYaw + keyYaw, -TURN_MAX, TURN_MAX),
        pitch: clamp(m.pitch + stickPitch + keyPitch, -TURN_MAX, TURN_MAX),
      };
    }
    this.count++;
    const fire = this.key('Space') || this.mouseFire || this.buttons.has('fire') || this.tapFire > 0;
    if (this.tapFire > 0) this.tapFire--;
    return {
      tx: clamp((this.key('KeyD') ? 1 : 0) - (this.key('KeyA') ? 1 : 0) + this.dead(this.move.x), -1, 1),
      ty: clamp((this.key('KeyR') ? 1 : 0) - (this.key('KeyF') ? 1 : 0) + (this.buttons.has('up') ? 1 : 0) - (this.buttons.has('down') ? 1 : 0), -1, 1),
      tz: clamp((this.key('KeyW') ? 1 : 0) - (this.key('KeyS') ? 1 : 0) + this.dead(-this.move.y), -1, 1),
      yaw: this.held.yaw,
      pitch: this.held.pitch,
      roll: (this.key('KeyE') ? 1 : 0) - (this.key('KeyQ') ? 1 : 0),
      fire,
      missile: this.key('ShiftLeft', 'ShiftRight', 'KeyX') || this.mouseMissile || this.buttons.has('missile'),
    };
  }
}

export { NO_INPUT };
