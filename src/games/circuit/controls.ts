/**
 * Keys and touch into the physics' one input a step (docs/CIRCUIT-PLAN.md, section 4): arrows or W A S D to steer and
 * speed up or slow down, Space to jump. On a touch screen: left and right pads, a jump button, and a speed lever slid with
 * a thumb (it holds the speed you set).
 */
import { TOP_SPEED } from '../../../shared/circuit/config';
import type { Input } from '../../../shared/circuit/inputs';

const KEYS: Record<string, 'left' | 'right' | 'faster' | 'slower' | 'jump'> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'faster', KeyW: 'faster', ArrowDown: 'slower', KeyS: 'slower', Space: 'jump',
};

export class Controls {
  private held = new Set<string>();
  /** Touch pads held. */
  touch = { left: false, right: false, jump: false };
  /** The speed lever, 0 to 1, or null if it hasn't been touched. */
  lever: number | null = null;

  /** True if the key is one the race uses (so the page shouldn't scroll). */
  press(code: string): boolean {
    const what = KEYS[code];
    if (!what) return false;
    this.held.add(what);
    // Keys take over from the lever.
    if (what === 'faster' || what === 'slower') this.lever = null;
    return true;
  }

  release(code: string): void {
    const what = KEYS[code];
    if (what) this.held.delete(what);
  }

  clear(): void {
    this.held.clear();
    this.touch = { left: false, right: false, jump: false };
  }

  /** This step's input, given the racer's forward speed (for the lever). */
  input(vz: number): Input {
    const left = this.held.has('left') || this.touch.left;
    const right = this.held.has('right') || this.touch.right;
    let accel: Input['accel'] = this.held.has('faster') ? 1 : this.held.has('slower') ? -1 : 0;
    if (accel === 0 && this.lever !== null) {
      const want = this.lever * TOP_SPEED;
      accel = vz < want - 0.3 ? 1 : vz > want + 0.6 ? -1 : 0;
    }
    return { turn: left === right ? 0 : left ? -1 : 1, accel, jump: this.held.has('jump') || this.touch.jump };
  }
}
