/**
 * Effects: sparks, smoke, explosions, laser bolts, shield ripples and tumbling crates. A small particle system with a
 * cap, so a busy fight stays smooth on a Chromebook.
 */
import { TAU, clamp, rgba } from './util';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  colour: string;
  kind: 'spark' | 'smoke' | 'glow' | 'crate' | 'ring';
  grow: number;
  drag: number;
  spin: number;
  angle: number;
}

interface Bolt {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  dur: number;
  colour: string;
  width: number;
}

interface Ripple {
  x: number;
  y: number;
  rx: number;
  ry: number;
  t: number;
  dur: number;
  colour: string;
}

export class Fx {
  private parts: Particle[] = [];
  private bolts: Bolt[] = [];
  private ripples: Ripple[] = [];
  /** The most particles alive at once (lower in simple graphics). */
  cap = 320;
  /** Reduced motion: gentler, fewer. */
  gentle = false;
  /** Screen shake left, in seconds. */
  shake = 0;
  /** A white flash over the whole picture, 0 to 1. */
  flash = 0;

  get count(): number {
    return this.parts.length;
  }

  clear(): void {
    this.parts = [];
    this.bolts = [];
    this.ripples = [];
    this.shake = 0;
    this.flash = 0;
  }

  private add(p: Particle): void {
    if (this.parts.length >= this.cap) this.parts.shift();
    this.parts.push(p);
  }

  spark(x: number, y: number, n: number, colour: string, speed = 160): void {
    const count = this.gentle ? Math.ceil(n / 3) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random());
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.35 + Math.random() * 0.4, size: 1.2 + Math.random() * 1.6, colour, kind: 'spark', grow: 0, drag: 2.2, spin: 0, angle: 0 });
    }
  }

  smoke(x: number, y: number, n = 1): void {
    for (let i = 0; i < n; i++) {
      this.add({ x, y, vx: -20 - Math.random() * 20, vy: -10 - Math.random() * 25, life: 0, max: 0.9 + Math.random() * 0.8, size: 4 + Math.random() * 4, colour: '#4b5563', kind: 'smoke', grow: 14, drag: 0.8, spin: 0, angle: 0 });
    }
  }

  /** An explosion: a flash, a ring, glowing fireballs, sparks and smoke. `size` is a radius in pixels. */
  boom(x: number, y: number, size: number): void {
    this.add({ x, y, vx: 0, vy: 0, life: 0, max: 0.55, size: size * 0.2, colour: '#fff4c2', kind: 'ring', grow: size * 2.4, drag: 0, spin: 0, angle: 0 });
    const balls = this.gentle ? 5 : 14;
    for (let i = 0; i < balls; i++) {
      const a = Math.random() * TAU;
      const s = size * (0.4 + Math.random() * 1.6);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.5 + Math.random() * 0.6, size: size * (0.12 + Math.random() * 0.16), colour: i % 3 ? '#fb923c' : '#fde047', kind: 'glow', grow: size * 0.2, drag: 2.4, spin: 0, angle: 0 });
    }
    this.spark(x, y, 26, '#fff7d6', size * 3);
    for (let i = 0; i < (this.gentle ? 3 : 8); i++) this.smoke(x + (Math.random() - 0.5) * size, y + (Math.random() - 0.5) * size);
    if (!this.gentle) {
      this.shake = Math.max(this.shake, 0.35);
      this.flash = Math.max(this.flash, 0.5);
    }
  }

  crate(x: number, y: number, vx: number, vy: number): void {
    this.add({ x, y, vx, vy, life: 0, max: 1.6, size: 7, colour: '#d6a35a', kind: 'crate', grow: 0, drag: 0.4, spin: (Math.random() - 0.5) * 8, angle: Math.random() * TAU });
  }

  bolt(x1: number, y1: number, x2: number, y2: number, colour: string, width: number, dur: number): void {
    this.bolts.push({ x1, y1, x2, y2, t: 0, dur, colour, width });
  }

  ripple(x: number, y: number, rx: number, ry: number, colour: string, dur = 0.7): void {
    this.ripples.push({ x, y, rx, ry, t: 0, dur, colour });
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.life += dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      if (p.kind === 'crate') p.vy += 40 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.angle += p.spin * dt;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const b of this.bolts) b.t += dt;
    this.bolts = this.bolts.filter((b) => b.t < b.dur);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < r.dur);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  /** Where a bolt's bright head is right now: used to time the hit. */
  draw(g: CanvasRenderingContext2D): void {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const a = clamp(1 - p.life / p.max, 0, 1);
      if (p.kind === 'smoke') continue;
      if (p.kind === 'ring') {
        g.strokeStyle = rgba('#ffe9a8', a * 0.8);
        g.lineWidth = 3 + a * 6;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, TAU);
        g.stroke();
      } else if (p.kind === 'glow') {
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, rgba('#ffffff', a));
        grad.addColorStop(0.35, rgba(p.colour, a * 0.9));
        grad.addColorStop(1, rgba(p.colour, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, TAU);
        g.fill();
      } else if (p.kind === 'spark') {
        g.strokeStyle = rgba(p.colour, a);
        g.lineWidth = p.size;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        g.stroke();
      }
    }
    for (const b of this.bolts) {
      const p = clamp(b.t / b.dur, 0, 1);
      // The bolt is a bright streak that races from the gun to the target.
      const head = Math.min(1, p * 1.25);
      const tail = Math.max(0, head - 0.28);
      const hx = b.x1 + (b.x2 - b.x1) * head;
      const hy = b.y1 + (b.y2 - b.y1) * head;
      const tx = b.x1 + (b.x2 - b.x1) * tail;
      const ty = b.y1 + (b.y2 - b.y1) * tail;
      g.lineCap = 'round';
      g.strokeStyle = rgba(b.colour, 0.35);
      g.lineWidth = b.width * 3.2;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(hx, hy);
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = b.width;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(hx, hy);
      g.stroke();
    }
    for (const r of this.ripples) {
      const p = clamp(r.t / r.dur, 0, 1);
      g.strokeStyle = rgba(r.colour, (1 - p) * 0.9);
      g.lineWidth = 2 + (1 - p) * 3;
      g.beginPath();
      g.ellipse(r.x, r.y, r.rx * (0.9 + p * 0.25), r.ry * (0.9 + p * 0.25), 0, 0, TAU);
      g.stroke();
    }
    g.restore();
    // Smoke and crates are drawn normally (not glowing).
    for (const p of this.parts) {
      const a = clamp(1 - p.life / p.max, 0, 1);
      if (p.kind === 'smoke') {
        g.fillStyle = rgba(p.colour, a * 0.45);
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, TAU);
        g.fill();
      } else if (p.kind === 'crate') {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.angle);
        g.fillStyle = '#c28a3b';
        g.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
        g.strokeStyle = '#6b4416';
        g.lineWidth = 1.5;
        g.strokeRect(-p.size, -p.size, p.size * 2, p.size * 2);
        g.beginPath();
        g.moveTo(-p.size, -p.size);
        g.lineTo(p.size, p.size);
        g.moveTo(p.size, -p.size);
        g.lineTo(-p.size, p.size);
        g.stroke();
        g.restore();
      }
    }
  }
}
