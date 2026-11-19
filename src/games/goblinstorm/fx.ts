/**
 * Goblin Storm's particles: sparks, puffs, rings, shards and a few floating words. Copied in spirit from Archery's
 * pooled Fx (src/games/archery/art/fx.ts), but a true fixed pool: every particle is made once and reused, so a
 * screen-wipe with hundreds of bursts never makes garbage. Positions are in world units; the renderer draws them.
 *
 * Drawing only: nothing here touches the run, so Math.random is fine.
 */

export type FxKind = 'spark' | 'puff' | 'ring' | 'shard' | 'glow';

export interface Particle {
  live: boolean;
  k: FxKind;
  x: number; y: number;
  vx: number; vy: number;
  age: number; life: number;
  size: number; grow: number;
  rot: number; vr: number;
  drag: number;
  c: string;
  /** Drawn with 'lighter' (glows). */
  add: boolean;
}

export interface FloatWord { live: boolean; s: string; x: number; y: number; age: number; life: number; size: number; c: string }

const TAU = Math.PI * 2;

/** A soft round glow in one colour, made once and stretched to any size (much quicker than a gradient each time). */
const glows = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
export function glowSprite(c: string): HTMLCanvasElement | OffscreenCanvas {
  let s = glows.get(c);
  if (s) return s;
  const n = 64;
  s = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(n, n) : Object.assign(document.createElement('canvas'), { width: n, height: n });
  const g = s.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, c);
  grad.addColorStop(0.35, c);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 1;
  g.fillStyle = grad;
  g.fillRect(0, 0, n, n);
  glows.set(c, s);
  return s;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  readonly parts: Particle[] = [];
  readonly words: FloatWord[] = [];
  private next = 0;
  private nextWord = 0;
  /** Reduced motion: fewer, slower bits. */
  gentle = false;
  /** 0–1: fewer particles when the frame rate drops. */
  quality = 1;

  constructor(max = 900, maxWords = 24) {
    for (let i = 0; i < max; i++) {
      this.parts.push({ live: false, k: 'spark', x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 0.1, grow: 0, rot: 0, vr: 0, drag: 0, c: '#fff', add: false });
    }
    for (let i = 0; i < maxWords; i++) this.words.push({ live: false, s: '', x: 0, y: 0, age: 0, life: 1, size: 0.5, c: '#fff' });
  }

  private take(): Particle {
    // The oldest slot is reused when every slot is busy.
    const p = this.parts[this.next];
    this.next = (this.next + 1) % this.parts.length;
    return p;
  }

  private n(count: number): number {
    return Math.max(1, Math.round(count * (this.gentle ? 0.4 : 1) * this.quality));
  }

  add(k: FxKind, x: number, y: number, o: Partial<Omit<Particle, 'live' | 'k' | 'x' | 'y'>>): void {
    const p = this.take();
    p.live = true; p.k = k; p.x = x; p.y = y;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.age = 0; p.life = o.life ?? 0.5;
    p.size = o.size ?? 0.1; p.grow = o.grow ?? 0; p.rot = o.rot ?? 0; p.vr = o.vr ?? 0; p.drag = o.drag ?? 0;
    p.c = o.c ?? '#fff'; p.add = o.add ?? false;
  }

  /** Sparks flying out from a point. */
  sparks(x: number, y: number, count: number, c: string, speed = 6, size = 0.09): void {
    const sp = this.gentle ? 0.5 : 1;
    for (let i = 0, n = this.n(count); i < n; i++) {
      const a = rand(0, TAU), s = rand(0.4, 1) * speed * sp;
      this.add('spark', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), size: rand(0.6, 1.2) * size, drag: 3, c, add: true });
    }
  }

  /** A monster beaten: a soft puff, a few shards in its colours and a pop of light. */
  pop(x: number, y: number, r: number, c: string, c2: string): void {
    const sp = this.gentle ? 0.5 : 1;
    this.add('glow', x, y, { life: 0.22, size: r * 1.6, grow: r * 3, c: '#fff6c8', add: true });
    for (let i = 0, n = this.n(4); i < n; i++) {
      this.add('puff', x + rand(-r, r) * 0.5, y + rand(-r, r) * 0.5, { vx: rand(-1, 1) * sp, vy: rand(-1.5, 0.3) * sp, life: rand(0.35, 0.6), size: r * rand(0.5, 0.8), grow: r * 0.8, drag: 2, c: c2 });
    }
    for (let i = 0, n = this.n(5); i < n; i++) {
      const a = rand(0, TAU), s = rand(2, 6) * sp;
      this.add('shard', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), size: rand(0.08, 0.16) * (1 + r), rot: rand(0, TAU), vr: rand(-12, 12), drag: 2.5, c });
    }
  }

  /** An expanding ring of light (nova, bubble pop, blasts). */
  ring(x: number, y: number, from: number, to: number, life: number, c: string): void {
    this.add('ring', x, y, { size: from, grow: (to - from) / life, life, c, add: true });
  }

  /** A soft burst of light that swells and fades. */
  glow(x: number, y: number, size: number, grow: number, life: number, c: string): void {
    this.add('glow', x, y, { size, grow, life, c, add: true });
  }

  word(s: string, x: number, y: number, c: string, size = 0.5, life = 0.8): void {
    const w = this.words[this.nextWord];
    this.nextWord = (this.nextWord + 1) % this.words.length;
    w.live = true; w.s = s; w.x = x; w.y = y; w.age = 0; w.life = life; w.size = size; w.c = c;
  }

  step(dt: number): void {
    for (const p of this.parts) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) { p.live = false; continue; }
      const d = p.drag > 0 ? Math.max(0, 1 - p.drag * dt) : 1;
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += p.vr * dt;
    }
    for (const w of this.words) {
      if (!w.live) continue;
      w.age += dt;
      w.y -= dt * 1.2;
      if (w.age >= w.life) w.live = false;
    }
  }

  clear(): void {
    for (const p of this.parts) p.live = false;
    for (const w of this.words) w.live = false;
  }

  /** Draws every particle. The context is already in world units (1 unit = `scale` px). */
  draw(ctx: CanvasRenderingContext2D, scale: number): void {
    // Normal ones first, then the glowing ones on top with 'lighter'.
    for (let pass = 0; pass < 2; pass++) {
      const add = pass === 1;
      if (add) ctx.globalCompositeOperation = 'lighter';
      for (const p of this.parts) {
        if (!p.live || p.add !== add) continue;
        const t = p.age / p.life;
        const a = 1 - t;
        ctx.globalAlpha = a;
        if (p.k === 'spark') {
          ctx.fillStyle = p.c;
          const len = Math.min(0.5, Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 0.03);
          ctx.strokeStyle = p.c;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * len * 0.2, p.y - p.vy * len * 0.2);
          ctx.stroke();
        } else if (p.k === 'puff') {
          ctx.globalAlpha = a * 0.55;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.01, p.size), 0, TAU);
          ctx.fill();
        } else if (p.k === 'shard') {
          ctx.fillStyle = p.c;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.restore();
        } else if (p.k === 'ring') {
          ctx.strokeStyle = p.c;
          ctx.lineWidth = Math.max(1.5 / scale, 0.25 * a);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.01, p.size), 0, TAU);
          ctx.stroke();
        } else {
          const r = Math.max(0.01, p.size);
          ctx.drawImage(glowSprite(p.c), p.x - r, p.y - r, r * 2, r * 2);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** Floating words, in screen px (the context is plain px here). */
  drawWords(ctx: CanvasRenderingContext2D, toScreen: (x: number, y: number) => [number, number], scale: number): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const w of this.words) {
      if (!w.live) continue;
      const [sx, sy] = toScreen(w.x, w.y);
      const t = w.age / w.life;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15));
      ctx.globalAlpha = 1 - t * t;
      ctx.font = `900 ${Math.round(w.size * scale * pop)}px system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, w.size * scale * 0.18);
      ctx.strokeStyle = 'rgba(20,10,30,0.85)';
      ctx.strokeText(w.s, sx, sy);
      ctx.fillStyle = w.c;
      ctx.fillText(w.s, sx, sy);
    }
    ctx.globalAlpha = 1;
  }
}
