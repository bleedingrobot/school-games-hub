/**
 * Bursts, sparkles, stars, dust, rock chunks and cartoon words (no blood, ever: James, 21 Oct 2026).
 * Everything is in field px and moves on the view's fixed steps; drawing blends between steps.
 * At most `max` particles live at once (300 at full quality).
 */
import { FONT_DISPLAY, OL, TAU, clamp, drawStar, outBack, rr } from './util';

type Kind = 'puff' | 'star' | 'chunk' | 'ring' | 'spark' | 'confetti' | 'leaf';

export interface Particle {
  k: Kind;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  life: number; age: number;
  size: number;
  rot: number; vr: number;
  g: number;
  drag: number;
  c: string; c2: string;
}

export interface FloatText {
  s: string;
  x: number; y: number;
  age: number; life: number;
  /** Size in field px. */
  size: number;
  style: 'word' | 'damage' | 'small';
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  parts: Particle[] = [];
  texts: FloatText[] = [];
  max = 300;
  /** Gentle mode (reduced motion): fewer, shorter, slower bits. */
  gentle = false;

  private add(p: Partial<Particle> & { k: Kind; x: number; y: number }) {
    if (this.parts.length >= this.max) {
      // Make room by dropping the oldest.
      this.parts.shift();
    }
    this.parts.push({
      px: p.x, py: p.y, vx: 0, vy: 0, life: 1, age: 0, size: 4, rot: 0, vr: 0, g: 0, drag: 0, c: '#fff', c2: '#fff', ...p,
    });
  }

  count(n: number): number {
    const m = this.gentle ? n * 0.45 : n;
    return Math.max(1, Math.round(this.max < 200 ? m * 0.5 : m));
  }

  /** A blast: dust puffs, rock chunks, sparks and a white ring, sized by the blast's radius (px). */
  burst(x: number, y: number, radius: number, dust: [string, string], chunkColours: string[], stars: boolean) {
    const sc = clamp(radius / 30, 0.35, 2.6);
    const sp = this.gentle ? 0.55 : 1;
    for (let i = 0; i < this.count(9 * sc + 3); i++) {
      this.add({ k: 'puff', x: x + rand(-8, 8) * sc, y: y - rand(0, 7), vx: rand(-100, 100) * sc * sp, vy: rand(-140, -25) * sc * sp, life: rand(0.7, 1.15), size: rand(9, 17) * sc, c: dust[0], c2: dust[1], drag: 3.2 });
    }
    for (let i = 0; i < this.count(12 * sc + 2); i++) {
      this.add({ k: 'chunk', x, y: y - 3, vx: rand(-180, 180) * sp, vy: rand(-310, -95) * sp, life: rand(0.7, 1.15), size: rand(1.8, 4.2) * Math.sqrt(sc), rot: rand(0, 6), vr: rand(-10, 10), g: 720, c: chunkColours[i % chunkColours.length] });
    }
    for (let i = 0; i < this.count(6 * sc); i++) {
      const a = rand(0, TAU), s = rand(80, 200) * sp;
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.5), size: rand(2.5, 5), c: '#fff2a8', drag: 2.3 });
    }
    if (stars) {
      for (let i = 0; i < this.count(5 * sc + 2); i++) {
        this.add({ k: 'star', x, y: y - 6, vx: rand(-200, 200) * sp, vy: rand(-330, -130) * sp, life: rand(0.8, 1.2), size: rand(4, 7.5) * Math.sqrt(sc), rot: rand(0, 6), vr: rand(-8, 8), g: 570 });
      }
    }
    this.add({ k: 'ring', x, y: y - 3, life: this.gentle ? 0.35 : 0.45, size: radius * 1.25 + 8 });
  }

  /** A few sparkles (ice ping, shield, pop). */
  sparkles(x: number, y: number, n: number, colour: string, speed = 1) {
    for (let i = 0; i < this.count(n); i++) {
      const a = rand(0, TAU), s = rand(70, 190) * speed * (this.gentle ? 0.5 : 1);
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.7), size: rand(2.5, 5), c: colour, drag: 2.3 });
    }
  }

  /** Small dust puffs where an archer lands. */
  landingDust(x: number, y: number, dust: [string, string], n = 5) {
    for (let i = 0; i < this.count(n); i++) {
      const s = i % 2 ? 1 : -1;
      this.add({ k: 'puff', x: x + s * rand(2, 8), y: y - 1, vx: s * rand(30, 80), vy: rand(-40, -10), life: rand(0.45, 0.7), size: rand(4, 7), c: dust[0], c2: dust[1], drag: 4 });
    }
  }

  /** The cartoon "poof" when an archer pops: stars, white puffs and a big ring. */
  poof(x: number, y: number) {
    for (let i = 0; i < this.count(22); i++) {
      const a = rand(0, TAU), s = rand(90, 300) * (this.gentle ? 0.5 : 1);
      this.add({ k: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: rand(0.9, 1.4), size: rand(4.5, 8.5), rot: rand(0, 6), vr: rand(-8, 8), g: 420 });
    }
    for (let i = 0; i < this.count(12); i++) {
      this.add({ k: 'puff', x: x + rand(-18, 18), y: y + rand(-18, 18), vx: rand(-70, 70), vy: rand(-70, 25), life: rand(0.7, 1.1), size: rand(13, 24), c: '#ffffff', c2: '#ffd6ec', drag: 3 });
    }
    this.add({ k: 'ring', x, y, life: 0.55, size: 66 });
  }

  /** Celebration confetti. */
  confetti(x: number, y: number, n: number) {
    const cols = ['#ffd23f', '#ff4fa3', '#36c2e0', '#5fd35a', '#ff7a1f', '#ffffff'];
    for (let i = 0; i < this.count(n); i++) {
      this.add({ k: 'confetti', x: x + rand(-10, 10), y, vx: rand(-110, 110), vy: rand(-300, -160) * (this.gentle ? 0.6 : 1), life: rand(1.2, 1.8), size: rand(2, 3.4), rot: rand(0, 6), vr: rand(-12, 12), g: 380, drag: 1.2, c: cols[i % cols.length] });
    }
  }

  say(s: string, x: number, y: number, size: number, style: FloatText['style'] = 'word') {
    this.texts.push({ s, x: clamp(x, 70, 890), y: clamp(y, 40, 520), age: 0, life: style === 'damage' ? 1.35 : this.gentle ? 0.9 : 1.2, size, style });
  }

  step(dt: number) {
    const P = this.parts;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.px = p.x;
      p.py = p.y;
      if (p.drag) {
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      if (p.k === 'puff') p.vy -= 14 * dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      P[w++] = p;
    }
    P.length = w;
    const T = this.texts;
    w = 0;
    for (let i = 0; i < T.length; i++) {
      T[i].age += dt;
      if (T[i].age < T[i].life) T[w++] = T[i];
    }
    T.length = w;
  }

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
  }

  draw(g: CanvasRenderingContext2D, alpha: number, minText: number) {
    for (const p of this.parts) {
      const k = Math.min(1, p.age / p.life);
      const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
      switch (p.k) {
        case 'puff': {
          const rad = p.size * (0.5 + 0.9 * (1 - (1 - k) * (1 - k)));
          g.globalAlpha = Math.pow(1 - k, 1.4);
          g.fillStyle = p.c2;
          g.beginPath();
          g.arc(x + rad * 0.08, y + rad * 0.15, rad, 0, TAU);
          g.fill();
          g.fillStyle = p.c;
          g.beginPath();
          g.arc(x, y, rad * 0.9, 0, TAU);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,.4)';
          g.beginPath();
          g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.34, 0, TAU);
          g.fill();
          break;
        }
        case 'star':
          drawStar(g, x, y, p.size, p.rot, k > 0.7 ? (1 - k) / 0.3 : 1);
          break;
        case 'chunk':
          g.save();
          g.translate(x, y);
          g.rotate(p.rot);
          g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
          g.fillStyle = p.c;
          g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          g.lineWidth = 0.7;
          g.strokeStyle = OL;
          g.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
          g.restore();
          break;
        case 'ring':
          g.globalAlpha = 1 - k;
          g.lineWidth = 4 * (1 - k) + 0.6;
          g.strokeStyle = '#ffffff';
          g.beginPath();
          g.arc(x, y, p.size * (0.3 + k * 0.8), 0, TAU);
          g.stroke();
          break;
        case 'spark':
          g.globalAlpha = 1 - k;
          g.fillStyle = p.c;
          g.save();
          g.translate(x, y);
          g.rotate(k * 4);
          g.fillRect(-p.size / 2, -0.7, p.size, 1.4);
          g.fillRect(-0.7, -p.size / 2, 1.4, p.size);
          g.restore();
          break;
        case 'confetti':
          g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
          g.fillStyle = p.c;
          g.save();
          g.translate(x, y);
          g.rotate(p.rot);
          g.fillRect(-p.size / 2, -p.size * 0.3 * Math.abs(Math.cos(p.rot * 2)), p.size, p.size * 0.6 * Math.abs(Math.cos(p.rot * 2)) + 0.3);
          g.restore();
          break;
        case 'leaf':
          break;
      }
    }
    g.globalAlpha = 1;
    for (const t of this.texts) this.drawText(g, t, minText);
  }

  private drawText(g: CanvasRenderingContext2D, x: FloatText, minSize: number) {
    const k = x.age / x.life;
    const pop = this.gentle ? 1 : x.age < 0.2 ? outBack(x.age / 0.2) : 1;
    const al = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const size = Math.max(x.size, minSize * (x.style === 'word' ? 1.5 : 1));
    const rise = x.style === 'damage' ? 26 : 16;
    g.save();
    g.globalAlpha = al;
    g.translate(x.x, x.y - rise * k);
    if (x.style === 'word') g.rotate(-0.07);
    g.scale(pop, pop);
    g.font = `900 ${size}px ${FONT_DISPLAY}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = size * 0.22;
    g.strokeStyle = OL;
    g.strokeText(x.s, 0, 0);
    if (x.style === 'damage') g.fillStyle = '#ff6a3d';
    else if (x.style === 'small') g.fillStyle = '#ffffff';
    else {
      const tg = g.createLinearGradient(0, -size * 0.4, 0, size * 0.4);
      tg.addColorStop(0, '#fff27a');
      tg.addColorStop(1, '#ffa31a');
      g.fillStyle = tg;
    }
    g.fillText(x.s, 0, 0);
    g.restore();
  }
}

/** A little rounded badge (used for names over the archers). */
export function badge(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, ink: string) {
  g.font = `800 ${size}px ${FONT_DISPLAY}`;
  const w = g.measureText(text).width + size * 0.9;
  rr(g, x - w / 2, y - size * 0.7, w, size * 1.4, size * 0.5);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = Math.max(0.6, size * 0.1);
  g.strokeStyle = OL;
  g.stroke();
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y + size * 0.04);
}
