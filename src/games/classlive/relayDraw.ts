/**
 * Toon Flap Relay's drawing (docs/RELAY-PLAN.md): one lane of the race, on the big screen (one per team) and full size on
 * the flyer's iPad. Toon Flap's own renderer draws the sky, walls, wind and bird; this adds the relay's effects on top:
 * a shield bubble, ghost wings, fog, speed lines, the team's colour and the icons of effects coming up.
 *
 * Until the Stadium Sky is painted (docs/RELAY-ART-PLAN.md) the lanes use Toon Flap's world 1 look with bunting on top.
 */
import { SKY } from '../../../shared/toonflap/config';
import { decodeFlaps } from '../../../shared/toonflap/engine';
import type { Course } from '../../../shared/toonflap/levels';
import { FX_WORDS, flyStep, isTrouble, newFly, teamCourse, TURN_STEPS, type Effect, type FlyState, type Turn } from '../../../shared/classlive/relay';
import { drawScene, makeView, TOP_PAD } from '../toonflap/renderer';
import type { FlyerPose } from '../toonflap/art/art';
import { painted } from './paintedArt';

type Ctx = CanvasRenderingContext2D;

const imgs = new Map<string, HTMLImageElement | null>();
function picture(src: string | null): HTMLImageElement | null {
  if (!src) return null;
  if (!imgs.has(src)) {
    const img = new Image();
    img.src = src;
    imgs.set(src, img);
  }
  const img = imgs.get(src)!;
  return img && img.complete && img.naturalWidth ? img : null;
}

const on = (e: Pick<Effect, 'x0' | 'x1'>, x: number) => x >= e.x0 && x <= e.x1;

export interface LaneOpts {
  course: Course;
  effects: readonly Omit<Effect, 'by'>[];
  state: FlyState;
  w: number;
  h: number;
  time: number;
  colour: string;
  reduced: boolean;
  /** The flyer's own iPad: fog really hides the course. The big screen only shows the cloud. */
  own: boolean;
  pose: FlyerPose;
}

export function drawLane(c: Ctx, o: LaneOpts): void {
  const { course, state: s } = o;
  const effects = o.effects as Effect[];
  const bunting = picture(painted('relay', 'bunting'));
  drawScene(c, { course, state: s, w: o.w, h: o.h, time: o.time, reduced: o.reduced, shake: 0, flyer: 'fantail', shiny: false, trail: null, particles: [], pose: o.pose, labels: null, ghostPath: false });
  const v = makeView(s, o.w, o.h);
  const px = (x: number) => (x - v.camX) * v.s;
  const py = (y: number) => v.offY + (SKY + TOP_PAD - y) * v.s;
  const bx = px(s.x);
  const by = py(s.y);
  // The stadium's bunting along the top (stand-in for the painted Stadium Sky).
  if (bunting) {
    const bw = (bunting.naturalWidth / bunting.naturalHeight) * o.h * 0.12;
    const off = (v.camX * v.s * 0.5) % bw;
    for (let x = -off - bw; x < o.w; x += bw) c.drawImage(bunting, x, 0, bw, o.h * 0.12);
  } else {
    const flag = Math.max(10, o.h * 0.05);
    const off = (v.camX * v.s * 0.5) % (flag * 2);
    const cols = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
    for (let x = -off - flag * 2, i = 0; x < o.w + flag; x += flag * 1.2, i++) {
      c.fillStyle = cols[((i % 6) + 6) % 6];
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + flag, 0);
      c.lineTo(x + flag / 2, flag * 1.1);
      c.closePath();
      c.fill();
    }
  }
  const active = (k: Effect['kind']) => effects.some((e) => e.kind === k && on(e, s.x) && !(k === 'shield' && s.used.includes(e.id)));
  // Speed lines: tailwind; blue haze: slow-mo.
  if (active('tailwind') && !o.reduced) {
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = Math.max(2, v.s * 0.06);
    for (let i = 0; i < 6; i++) {
      const yy = by + (i - 2.5) * v.s * 0.35;
      const len = v.s * (1.2 + ((o.time * 7 + i) % 1));
      c.beginPath();
      c.moveTo(bx - v.s * 0.6, yy);
      c.lineTo(bx - v.s * 0.6 - len, yy);
      c.stroke();
    }
  }
  if (active('slow')) {
    c.fillStyle = 'rgba(80,140,255,0.16)';
    c.fillRect(0, 0, o.w, o.h);
  }
  if (active('shield')) {
    c.strokeStyle = 'rgba(120,220,255,0.95)';
    c.fillStyle = 'rgba(120,220,255,0.18)';
    c.lineWidth = Math.max(2, v.s * 0.08);
    c.beginPath();
    c.arc(bx, by, v.s * (0.75 + Math.sin(o.time * 6) * 0.04), 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  if (active('ghost')) {
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.arc(bx, by, v.s * 0.9, 0, Math.PI * 2);
    c.fill();
  }
  if (active('magnet')) {
    c.font = `${Math.round(v.s * 0.6)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText('🧲', bx, by - v.s * 0.9);
  }
  if (active('mini')) {
    c.font = `${Math.round(v.s * 0.5)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText('🐣', bx, by - v.s * 0.9);
  }
  // Fog: on the flyer's iPad only a circle round the bird shows; the big screen shows a cloud over the lane.
  if (active('fog')) {
    if (o.own) {
      const g = c.createRadialGradient(bx, by, v.s * 1.6, bx, by, v.s * 3.2);
      g.addColorStop(0, 'rgba(225,230,240,0)');
      g.addColorStop(1, 'rgba(225,230,240,0.97)');
      c.fillStyle = g;
      c.fillRect(0, 0, o.w, o.h);
    } else {
      c.fillStyle = 'rgba(225,230,240,0.55)';
      c.fillRect(bx + v.s * 1.5, 0, o.w, o.h);
    }
  }
  // The big screen's lanes are thin: a ring in the team's colour makes each bird easy to find.
  if (!o.own) {
    const r = Math.max(10, v.s * 0.85);
    c.lineWidth = Math.max(2.5, r * 0.18);
    c.strokeStyle = '#fff';
    c.beginPath();
    c.arc(bx, by, r + c.lineWidth * 0.6, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = o.colour;
    c.beginPath();
    c.arc(bx, by, r, 0, Math.PI * 2);
    c.stroke();
  }
  // Coming up: each effect's icon over where it starts.
  c.textAlign = 'center';
  c.font = `${Math.round(Math.max(14, v.s * 0.7))}px system-ui, sans-serif`;
  for (const e of effects) {
    if (e.x0 <= s.x || e.kind === 'clear') continue;
    const x = px(e.x0);
    if (x < 0 || x > o.w + 20) continue;
    c.fillStyle = isTrouble(e.kind) ? 'rgba(220,38,38,0.85)' : 'rgba(22,163,74,0.85)';
    c.beginPath();
    c.arc(x, py(SKY - 0.6), v.s * 0.55, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.fillText(FX_WORDS[e.kind].emoji, x, py(SKY - 0.6) + v.s * 0.24);
  }
  // The team's colour round the lane.
  c.strokeStyle = o.colour;
  c.lineWidth = Math.max(4, o.h * 0.025);
  c.strokeRect(0, 0, o.w, o.h);
}

/**
 * A lane being watched (the big screen): plays the flyer's saved flaps a moment behind, at real speed, so the bird glides
 * smoothly between flap lists. Starts again from the turn's start when the effects change.
 */
export class LanePlayer {
  private turnN = -1;
  private fxKey = '';
  private flaps: number[] = [];
  private k = 0;
  private effects: Effect[] = [];
  state: FlyState | null = null;
  course: Course | null = null;
  /** The last bump, shield or nest seen while playing (the screen reads and clears it). */
  lastEvent: 'bump' | 'shield' | 'nest' | null = null;

  /** Moves the bird on `dtSteps` towards the last step the flyer sent (or shows it hovering where the team got to). */
  update(base: Course, effects: readonly Omit<Effect, 'by'>[], turn: Turn | null, idleX: number, dtSteps: number): FlyState {
    this.effects = effects as Effect[];
    const fxKey = effects.map((e) => `${e.id}:${e.x1.toFixed(2)}`).join(',');
    if (fxKey !== this.fxKey || !this.course) this.course = teamCourse(base, this.effects);
    if (!turn) {
      this.turnN = -1;
      this.fxKey = fxKey;
      this.state = null;
      return newFly({ x0: idleX, y0: SKY / 2, w0: 0 });
    }
    this.flaps = decodeFlaps(turn.flaps) ?? this.flaps;
    if (turn.n !== this.turnN || fxKey !== this.fxKey || !this.state) {
      const reuse = turn.n === this.turnN && this.state ? this.state.t : 0;
      this.turnN = turn.n;
      this.fxKey = fxKey;
      this.state = newFly(turn);
      this.k = 0;
      this.play(reuse);
    }
    const target = Math.min(turn.at, TURN_STEPS);
    const s = this.state;
    // Far behind (a slow screen): jump closer.
    this.play(target - s.t > 120 ? target - 30 : Math.min(target, s.t + dtSteps));
    return s;
  }

  private play(upTo: number) {
    const s = this.state!;
    const course = this.course!;
    for (let guard = 0; guard < 4000 && s.t < upTo && s.mode !== 'done'; guard++) {
      while (this.k < this.flaps.length && this.flaps[this.k] < s.t) this.k++;
      const flap = this.flaps[this.k] === s.t;
      if (s.mode === 'hover' && !flap) break;
      if (flap) this.k++;
      const e = flyStep(course, this.effects, s, flap);
      if (e === 'bump' || e === 'shield' || e === 'nest') this.lastEvent = e;
    }
  }
}
