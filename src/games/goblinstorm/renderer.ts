/**
 * Draws a Goblin Storm run on a 2D canvas with stand-in shapes (docs/GOBLINSTORM-PLAN.md, stage 2). It only reads the
 * run, never changes it, so drawing can't change a result. Real trig is fine here (the engine never uses it).
 *
 * Speed: every monster kind is drawn once into a small picture (both ways round) and stamped with drawImage, the ground
 * is one repeating pattern, and glows are one stretched picture each, so 300+ monsters stay smooth.
 */
import { LEGENDARY, MAX_ENEMIES, STORM, WIPE_RADIUS, type HeroId, type MapDef, type WeaponId } from '../../../shared/goblinstorm/config';
import { area, legendLevel, stats, type GameEvent, type RunState } from '../../../shared/goblinstorm/engine';
import { COS, SIN, TURN } from '../../../shared/goblinstorm/trig';
import { groundArt, heroArt, monsterArt, paintedCount, paintedImage } from './art';
import { Fx, glowSprite } from './fx';
import { powerColour, powerWords } from './heroPowers';
import { burst, drawAuraStyle, drawShieldStyle, drawShotToken, drawStrikes, drawToken, drawWaves, startStrike, startWave, styleOf, tokenOf, type Strike, type Wave } from './powerFx';
import { HERO_LOOKS, MAP_LOOKS, MONSTER_LOOKS, type MonsterLook } from './look';

const TAU = Math.PI * 2;
type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): Canvas {
  const W = Math.max(1, Math.ceil(w));
  const H = Math.max(1, Math.ceil(h));
  return typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
}

/** Pixels per world unit: half the screen's diagonal is 14 units, so monsters always appear just off the edge (ring 15). */
export function viewScale(w: number, h: number): number {
  return Math.sqrt(w * w + h * h) / 28;
}

// ---------------------------------------------------------------- monster pictures

function drawMonster(g: Ctx, L: MonsterLook, r: number, cx: number, cy: number): void {
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(cx, cy + r * 0.85, r * 0.9, r * 0.3, 0, 0, TAU);
  g.fill();
  g.lineWidth = Math.max(1, r * 0.09);
  g.strokeStyle = 'rgba(20,10,25,0.75)';
  const body = (path: () => void) => {
    g.fillStyle = L.body;
    g.beginPath();
    path();
    g.fill();
    g.stroke();
  };
  const eyes = (y: number, spread: number, size: number) => {
    for (const s of [-1, 1]) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(cx + s * spread, y, size, 0, TAU);
      g.fill();
      g.fillStyle = L.eye;
      g.beginPath();
      g.arc(cx + s * spread + size * 0.25, y + size * 0.1, size * 0.6, 0, TAU);
      g.fill();
    }
  };
  const ears = () => {
    if (!L.ears) return;
    g.fillStyle = L.dark;
    for (const s of [-1, 1]) {
      g.beginPath();
      if (L.ears === 'pointy') {
        g.moveTo(cx + s * r * 0.45, cy - r * 0.35);
        g.lineTo(cx + s * r * 1.15, cy - r * 0.75);
        g.lineTo(cx + s * r * 0.75, cy - r * 0.05);
      } else g.arc(cx + s * r * 0.6, cy - r * 0.6, r * 0.28, 0, TAU);
      g.fill();
      g.stroke();
    }
  };
  const horns = () => {
    if (!L.horns) return;
    g.fillStyle = '#f3ead2';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * r * 0.25, cy - r * 0.7);
      g.quadraticCurveTo(cx + s * r * 0.75, cy - r * 1.25, cx + s * r * 0.55, cy - r * 1.35);
      g.lineTo(cx + s * r * 0.5, cy - r * 0.6);
      g.fill();
      g.stroke();
    }
  };
  const crown = () => {
    if (!L.crown) return;
    g.fillStyle = '#ffd23a';
    g.beginPath();
    const y = cy - r * 0.85;
    g.moveTo(cx - r * 0.45, y + r * 0.2);
    g.lineTo(cx - r * 0.5, y - r * 0.3);
    g.lineTo(cx - r * 0.22, y - r * 0.05);
    g.lineTo(cx, y - r * 0.42);
    g.lineTo(cx + r * 0.22, y - r * 0.05);
    g.lineTo(cx + r * 0.5, y - r * 0.3);
    g.lineTo(cx + r * 0.45, y + r * 0.2);
    g.closePath();
    g.fill();
    g.stroke();
  };
  const spots = (n: number, R: number) => {
    if (!L.spots) return;
    g.fillStyle = L.spots;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.6;
      g.beginPath();
      g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.7, r * 0.13, 0, TAU);
      g.fill();
    }
  };

  switch (L.shape) {
    case 'blob':
      body(() => {
        g.moveTo(cx - r, cy + r * 0.6);
        g.quadraticCurveTo(cx - r * 1.05, cy - r * 0.9, cx, cy - r * 0.9);
        g.quadraticCurveTo(cx + r * 1.05, cy - r * 0.9, cx + r, cy + r * 0.6);
        g.closePath();
      });
      spots(4, r * 0.5);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath();
      g.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.18, r * 0.1, -0.6, 0, TAU);
      g.fill();
      eyes(cy - r * 0.15, r * 0.3, r * 0.2);
      break;
    case 'mushroom':
      g.fillStyle = '#f3e6cc';
      g.beginPath();
      g.rect(cx - r * 0.4, cy - r * 0.1, r * 0.8, r * 0.85);
      g.fill();
      g.stroke();
      body(() => {
        g.moveTo(cx - r, cy);
        g.quadraticCurveTo(cx, cy - r * 1.5, cx + r, cy);
        g.closePath();
      });
      spots(3, r * 0.45);
      eyes(cy + r * 0.25, r * 0.18, r * 0.14);
      break;
    case 'critter':
      ears();
      horns();
      body(() => g.arc(cx, cy, r * 0.82, 0, TAU));
      eyes(cy - r * 0.15, r * 0.3, r * 0.2);
      g.strokeStyle = L.dark;
      g.beginPath();
      g.arc(cx, cy + r * 0.2, r * 0.25, 0.2, Math.PI - 0.2);
      g.stroke();
      crown();
      break;
    case 'winged':
      g.fillStyle = L.dark;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * r * 0.3, cy - r * 0.2);
        g.lineTo(cx + s * r * 1.25, cy - r * 0.7);
        g.lineTo(cx + s * r * 1.0, cy + r * 0.1);
        g.lineTo(cx + s * r * 1.2, cy + r * 0.45);
        g.lineTo(cx + s * r * 0.35, cy + r * 0.25);
        g.closePath();
        g.fill();
        g.stroke();
      }
      body(() => g.arc(cx, cy, r * 0.55, 0, TAU));
      eyes(cy - r * 0.1, r * 0.2, r * 0.15);
      break;
    case 'spider':
      g.strokeStyle = L.dark;
      g.lineWidth = Math.max(1, r * 0.12);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const y = cy - r * 0.4 + i * r * 0.28;
          g.beginPath();
          g.moveTo(cx, y);
          g.quadraticCurveTo(cx + s * r * 0.9, y - r * 0.45, cx + s * r * 1.15, y + r * 0.25);
          g.stroke();
        }
      }
      g.lineWidth = Math.max(1, r * 0.09);
      g.strokeStyle = 'rgba(20,10,25,0.75)';
      body(() => g.ellipse(cx, cy, r * 0.62, r * 0.72, 0, 0, TAU));
      spots(3, r * 0.3);
      g.fillStyle = L.eye;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(cx - r * 0.24 + i * r * 0.16, cy - r * 0.32 + (i % 2) * r * 0.06, r * 0.08, 0, TAU);
        g.fill();
      }
      break;
    case 'brute':
      horns();
      g.fillStyle = L.dark;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(cx + s * r * 0.82, cy + r * 0.15, r * 0.3, 0, TAU);
        g.fill();
        g.stroke();
      }
      body(() => g.ellipse(cx, cy, r * 0.8, r * 0.9, 0, 0, TAU));
      spots(5, r * 0.45);
      eyes(cy - r * 0.3, r * 0.27, r * 0.16);
      if (L.tusks) {
        g.fillStyle = '#fff8e6';
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx + s * r * 0.3, cy + r * 0.15);
          g.lineTo(cx + s * r * 0.22, cy - r * 0.15);
          g.lineTo(cx + s * r * 0.12, cy + r * 0.15);
          g.fill();
        }
      }
      crown();
      break;
    case 'ghost':
      g.globalAlpha = 0.9;
      body(() => {
        g.moveTo(cx - r * 0.8, cy + r * 0.8);
        g.lineTo(cx - r * 0.8, cy - r * 0.1);
        g.arc(cx, cy - r * 0.1, r * 0.8, Math.PI, 0);
        g.lineTo(cx + r * 0.8, cy + r * 0.8);
        for (let i = 3; i >= 0; i--) g.lineTo(cx - r * 0.8 + (i * r * 1.6) / 4 + r * 0.2, cy + r * (i % 2 ? 0.55 : 0.85));
        g.closePath();
      });
      g.globalAlpha = 1;
      g.fillStyle = L.eye;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(cx + s * r * 0.28, cy - r * 0.15, r * 0.13, r * 0.2, 0, 0, TAU);
        g.fill();
      }
      crown();
      break;
    case 'flame':
      g.fillStyle = L.dark;
      g.beginPath();
      g.moveTo(cx, cy - r * 1.2);
      g.quadraticCurveTo(cx + r * 1.1, cy, cx + r * 0.6, cy + r * 0.7);
      g.quadraticCurveTo(cx, cy + r * 1.0, cx - r * 0.6, cy + r * 0.7);
      g.quadraticCurveTo(cx - r * 1.1, cy, cx, cy - r * 1.2);
      g.fill();
      g.fillStyle = L.body;
      g.beginPath();
      g.moveTo(cx, cy - r * 0.6);
      g.quadraticCurveTo(cx + r * 0.7, cy + r * 0.2, cx, cy + r * 0.7);
      g.quadraticCurveTo(cx - r * 0.7, cy + r * 0.2, cx, cy - r * 0.6);
      g.fill();
      eyes(cy + r * 0.1, r * 0.2, r * 0.13);
      break;
    case 'skull':
      horns();
      body(() => {
        g.arc(cx, cy - r * 0.15, r * 0.72, Math.PI * 0.85, Math.PI * 0.15);
        g.lineTo(cx + r * 0.38, cy + r * 0.75);
        g.lineTo(cx - r * 0.38, cy + r * 0.75);
        g.closePath();
      });
      g.fillStyle = L.eye;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(cx + s * r * 0.28, cy - r * 0.15, r * 0.19, 0, TAU);
        g.fill();
      }
      g.fillStyle = L.dark;
      g.fillRect(cx - r * 0.25, cy + r * 0.4, r * 0.5, r * 0.08);
      break;
    case 'dragon':
      g.fillStyle = L.dark;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * r * 0.3, cy - r * 0.1);
        g.quadraticCurveTo(cx + s * r * 1.4, cy - r * 1.2, cx + s * r * 1.3, cy + r * 0.3);
        g.lineTo(cx + s * r * 0.4, cy + r * 0.35);
        g.closePath();
        g.fill();
        g.stroke();
      }
      horns();
      body(() => g.ellipse(cx, cy, r * 0.62, r * 0.82, 0, 0, TAU));
      g.fillStyle = '#ffe9b0';
      g.beginPath();
      g.ellipse(cx, cy + r * 0.25, r * 0.35, r * 0.4, 0, 0, TAU);
      g.fill();
      eyes(cy - r * 0.35, r * 0.24, r * 0.14);
      break;
  }
}

interface Sprites { scale: number; mapId: string; painted: number; pics: Canvas[][]; size: number[] }

/** Draws a painted picture centred in a box of side `box`, keeping its shape. */
function stamp(g: Ctx, img: CanvasImageSource & { width: number; height: number }, cx: number, cy: number, box: number): void {
  const k = box / Math.max(img.width, img.height);
  g.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k);
}

/** Each monster kind drawn once, both ways round: its painting if it has one, otherwise the stand-in shapes. */
function buildSprites(map: MapDef, scale: number): Sprites {
  const pics: Canvas[][] = [];
  const size: number[] = [];
  for (const m of map.monsters) {
    const L = MONSTER_LOOKS[m.id] ?? MONSTER_LOOKS.goblin;
    const art = paintedImage(monsterArt(map.id, m.id));
    const r = m.radius * scale * 1.15;
    const S = Math.ceil(r * 3.2);
    const pair: Canvas[] = [];
    for (const flip of [false, true]) {
      const c = makeCanvas(S, S);
      const g = c.getContext('2d') as Ctx;
      if (flip) { g.translate(S, 0); g.scale(-1, 1); }
      if (art) stamp(g, art, S / 2, S / 2, r * 2.9);
      else drawMonster(g, L, r, S / 2, S / 2);
      pair.push(c);
    }
    pics.push(pair);
    size.push(S / scale);
  }
  return { scale, mapId: map.id, painted: paintedCount(), pics, size };
}

/** One tile of ground (6 × 6 units) that repeats forever. */
function buildGround(mapId: string, scale: number): Canvas {
  const look = MAP_LOOKS[mapId] ?? MAP_LOOKS.castle;
  const T = Math.round(6 * scale);
  const c = makeCanvas(T, T);
  const g = c.getContext('2d') as Ctx;
  const art = paintedImage(groundArt(mapId));
  if (art) {
    g.drawImage(art, 0, 0, T, T);
    return c;
  }
  g.fillStyle = look.ground;
  g.fillRect(0, 0, T, T);
  // fixed scatter (same every time for a map)
  let seed = mapId.length * 977;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = look.ground2;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.ellipse(rnd() * T, rnd() * T, T * (0.08 + rnd() * 0.1), T * (0.05 + rnd() * 0.06), rnd() * 3, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * T;
    const y = rnd() * T;
    const col = look.bits[i % look.bits.length];
    g.fillStyle = col;
    g.strokeStyle = col;
    const s = scale * (0.06 + rnd() * 0.08);
    if (i % 3 === 0) {
      g.lineWidth = Math.max(1, s * 0.4);
      g.beginPath();
      g.moveTo(x - s, y); g.lineTo(x - s * 0.4, y - s * 2);
      g.moveTo(x, y); g.lineTo(x + s * 0.2, y - s * 2.4);
      g.moveTo(x + s, y); g.lineTo(x + s * 0.7, y - s * 1.8);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(x, y, s, 0, TAU);
      g.fill();
    }
  }
  return c;
}

// ---------------------------------------------------------------- the view's own state

interface WipeShow { weapon: WeaponId; age: number; life: number; streaks: { x: number; y: number; vx: number; vy: number; s: number }[] }

/** A sound the run asked for this frame; the play screen decides which to play (at most a couple a frame). */
export type Cue = 'hit' | 'gem' | 'levelup' | 'wipe' | 'hurt' | 'boss' | 'kill-big';

interface BossShow { kind: number; name: string; age: number; life: number }

export class View {
  fx = new Fx();
  /** Strike pictures (lightning and each hero's own version of it), and nova rings. */
  bolts: Strike[] = [];
  waves: Wave[] = [];
  wipeShow: WipeShow | null = null;
  shake = 0;
  flash = 0;
  flashColour = '#fff';
  /** 0–1: the level-up column of light at the hero. */
  levelGlow = 0;
  /** 0–1: the gem bar's pulse after a pickup (the HUD reads it). */
  gemPulse = 0;
  bossShow: BossShow | null = null;
  /** Sounds asked for since the play screen last emptied this. */
  cues = new Set<Cue>();
  /** Low effects: fewer particles, no soft glows (the quality setting or slow frames). */
  low = false;
  private sprites: Sprites | null = null;
  private ground: { canvas: Canvas; pattern: CanvasPattern | null; scale: number; mapId: string; painted: number } | null = null;
  reduced = false;

  /** The hero now playing: their weapons take their colours and names (heroPowers.ts). */
  private hero: HeroId = 'knight';
  private colour(weapon: WeaponId) { return powerColour(this.hero, weapon); }

  /** Turns the step's events into effects. Called after every engine step. */
  take(s: RunState, events: readonly GameEvent[]): void {
    this.hero = s.setup.hero.id;
    const fx = this.fx;
    const looks = s.setup.map.monsters;
    let hits = 0;
    let gems = 0;
    for (const ev of events) {
      if (ev.k === 'kill') {
        const L = MONSTER_LOOKS[looks[ev.kind]?.id] ?? MONSTER_LOOKS.goblin;
        const r = looks[ev.kind]?.radius ?? 0.4;
        fx.pop(ev.x, ev.y, r, L.body, L.dark);
        if (ev.kind >= 3) {
          fx.ring(ev.x, ev.y, 0.5, 8, 0.7, '#ffe68a');
          fx.sparks(ev.x, ev.y, 60, '#ffd23a', 12, 0.14);
          fx.word(ev.kind === 4 ? 'BOSS BEATEN!' : 'MINI-BOSS DOWN!', ev.x, ev.y - 1.5, '#ffd23a', 1.1, 1.8);
          this.addShake(0.5);
          this.cues.add('kill-big');
          if (ev.kind === 4 && !this.low) {
            fx.ring(ev.x, ev.y, 1, 16, 1.1, '#ffffff');
            fx.glow(ev.x, ev.y, 2, 24, 0.8, '#ffe68a');
          }
        }
      } else if (ev.k === 'hit') {
        // Lots of these at once late in a run: only the first few in a step get sparks.
        if (hits++ < (this.low ? 2 : 6)) {
          fx.sparks(ev.x, ev.y, ev.crit ? 7 : 3, ev.crit ? '#ffe04a' : '#ffffff', ev.crit ? 7 : 4, ev.crit ? 0.11 : 0.07);
          if (ev.crit && !this.low) fx.ring(ev.x, ev.y, 0.15, 0.9, 0.18, '#fff3b0');
          this.cues.add('hit');
        }
        if (ev.crit) fx.word(String(Math.round(ev.damage)), ev.x, ev.y - 0.5, '#ffe04a', 0.45, 0.6);
      } else if (ev.k === 'strike') {
        const c = this.colour(ev.weapon);
        const style = styleOf(this.hero, ev.weapon);
        if (ev.weapon === 'lightning') startStrike(fx, this.bolts, style, ev.x, ev.y, ev.r, c, s.hero.x, s.hero.y);
        else if (!burst(fx, style, ev.x, ev.y, ev.r, c)) {
          fx.glow(ev.x, ev.y, ev.r * 0.6, ev.r * 2.5, 0.3, c.glow);
          fx.sparks(ev.x, ev.y, 10, c.main, 7);
          fx.ring(ev.x, ev.y, ev.r * 0.3, ev.r * 1.1, 0.3, c.main);
        }
      } else if (ev.k === 'nova') {
        const c = this.colour(ev.weapon);
        if (ev.weapon === 'nova' && startWave(fx, this.waves, styleOf(this.hero, ev.weapon), s.hero.x, s.hero.y, ev.r, c)) continue;
        fx.ring(s.hero.x, s.hero.y, 0.4, ev.r, 0.45, c.main);
        fx.ring(s.hero.x, s.hero.y, 0.2, ev.r * 0.8, 0.5, c.glow);
        fx.glow(s.hero.x, s.hero.y, ev.r * 0.4, ev.r * 1.5, 0.35, c.glow);
        if (ev.weapon === 'nova') for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          fx.add('shard', s.hero.x + Math.cos(a) * ev.r * 0.6, s.hero.y + Math.sin(a) * ev.r * 0.6, { vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, life: 0.4, size: 0.15, rot: a, c: '#e8f8ff' });
        }
      } else if (ev.k === 'wipe') {
        this.startWipe(s, ev.weapon);
      } else if (ev.k === 'hurt') {
        this.addShake(0.25);
        this.flash = Math.max(this.flash, 0.35);
        this.flashColour = '#ff2a2a';
        fx.sparks(s.hero.x, s.hero.y, 8, '#ff6a5a', 5);
        this.cues.add('hurt');
      } else if (ev.k === 'block') {
        fx.ring(s.hero.x, s.hero.y, 0.6, 1.8, 0.35, '#c8f4ff');
        fx.sparks(s.hero.x, s.hero.y, 14, '#9ae6ff', 6);
        fx.word('Blocked!', s.hero.x, s.hero.y - 1.2, '#c8f4ff', 0.45, 0.7);
      } else if (ev.k === 'levelup') {
        fx.ring(s.hero.x, s.hero.y, 0.3, 3, 0.6, '#9affc8');
        fx.ring(s.hero.x, s.hero.y, 0.2, 5, 0.9, '#ffffff');
        fx.sparks(s.hero.x, s.hero.y, 30, '#9affc8', 8, 0.12);
        // Sparkles rising up the column of light.
        for (let i = 0, n = this.low ? 6 : 18; i < n; i++) {
          fx.add('spark', s.hero.x + (Math.random() - 0.5) * 1.4, s.hero.y + Math.random() * 0.6, { vy: -4 - Math.random() * 6, life: 0.6 + Math.random() * 0.5, size: 0.09, drag: 0.5, c: i % 2 ? '#d8ffe8' : '#9affc8', add: true });
        }
        fx.word('LEVEL UP!', s.hero.x, s.hero.y - 1.8, '#9affc8', 0.7, 1.1);
        this.levelGlow = 1;
        this.cues.add('levelup');
      } else if (ev.k === 'gem') {
        gems++;
      } else if (ev.k === 'boss') {
        this.startBoss(looks[ev.kind]?.name ?? 'Boss', ev.kind);
      } else if (ev.k === 'storm') {
        // Sky Citadel: the ring's lightning lands.
        this.bolt(ev.x, ev.y, ev.r, '#e8f4ff');
        fx.ring(ev.x, ev.y, 0.3, ev.r * 1.4, 0.35, '#bfe6ff');
        this.addShake(0.2);
        this.cues.add('hit');
      } else if (ev.k === 'current') {
        if (s.t > 0) fx.word('The tide turns!', s.hero.x, s.hero.y - 1.8, '#8ad8d0', 0.6, 1.4);
      } else if (ev.k === 'revive') {
        fx.ring(s.hero.x, s.hero.y, 0.4, 4, 0.7, '#fff3b0');
        fx.glow(s.hero.x, s.hero.y, 1, 6, 0.6, '#ffe68a');
        fx.sparks(s.hero.x, s.hero.y, 30, '#ffe68a', 8, 0.12);
        fx.word('SECOND WIND!', s.hero.x, s.hero.y - 1.8, '#ffe68a', 0.9, 1.6);
        this.flash = Math.max(this.flash, 0.5);
        this.flashColour = '#fff3b0';
        this.cues.add('levelup');
      } else if (ev.k === 'rage') {
        fx.word(`${looks[4]?.name ?? 'The boss'} rages!`.toUpperCase(), s.hero.x, s.hero.y - 2.2, '#ff8a5a', 1, 1.8);
        this.addShake(0.8);
        this.flash = Math.max(this.flash, 0.45);
        this.flashColour = '#ff2a2a';
        this.cues.add('boss');
      }
    }
    if (gems) {
      // One little sparkle at the hero a step, however many gems came in (the event has no place).
      fx.sparks(s.hero.x, s.hero.y - 0.2, Math.min(6, 2 + gems), '#8af0ff', 3, 0.07);
      this.gemPulse = 1;
      this.cues.add('gem');
    }
  }

  /** A boss walks in: the screen darkens, warning stripes slide in, its name drops in big and the ground shakes. */
  private startBoss(name: string, kind: number): void {
    this.bossShow = { kind, name, age: 0, life: this.reduced ? 1.6 : 2.4 };
    this.addShake(kind === 4 ? 0.8 : 0.5);
    this.cues.add('boss');
  }

  addShake(n: number): void {
    if (!this.reduced) this.shake = Math.min(1, Math.max(this.shake, n));
  }

  /** An evolution's screen-wipe: a big flash in the weapon's colour, streaks across the screen and shake. */
  private startWipe(s: RunState, weapon: WeaponId): void {
    const c = this.colour(weapon);
    this.flash = this.reduced ? 0.45 : 0.9;
    this.flashColour = c.evolved;
    this.addShake(0.9);
    const streaks = [];
    const n = this.reduced ? 10 : 28;
    for (let i = 0; i < n; i++) {
      const fromTop = weapon === 'fireball' || weapon === 'arrows' || weapon === 'lightning' || weapon === 'nova';
      streaks.push(fromTop
        ? { x: s.hero.x + (Math.random() - 0.5) * 30, y: s.hero.y - 12 - Math.random() * 10, vx: 3 + Math.random() * 3, vy: 22 + Math.random() * 10, s: 0.4 + Math.random() * 0.5 }
        : { x: s.hero.x, y: s.hero.y, vx: Math.cos((i / n) * TAU) * 24, vy: Math.sin((i / n) * TAU) * 24, s: 0.5 + Math.random() * 0.4 });
    }
    this.wipeShow = { weapon, age: 0, life: 1.1, streaks };
    this.fx.ring(s.hero.x, s.hero.y, 0.5, WIPE_RADIUS, 0.7, c.evolved);
    this.fx.ring(s.hero.x, s.hero.y, 0.5, WIPE_RADIUS * 0.7, 0.55, '#ffffff');
    this.fx.glow(s.hero.x, s.hero.y, 2, 30, 0.5, c.glow);
    this.fx.word(powerWords(this.hero, weapon).evolved.toUpperCase() + '!', s.hero.x, s.hero.y - 2.5, c.evolved, 1.3, 1.6);
    if (!this.low) {
      // A second, later shockwave and a spray of shards in the weapon's colours.
      this.fx.ring(s.hero.x, s.hero.y, 0.2, WIPE_RADIUS * 1.2, 1.0, c.main);
      for (let i = 0, k = this.reduced ? 12 : 36; i < k; i++) {
        const a = (i / k) * TAU;
        const sp = 10 + Math.random() * 12;
        this.fx.add('shard', s.hero.x, s.hero.y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7, size: 0.22, rot: a, vr: 10, drag: 1.2, c: i % 2 ? c.evolved : '#ffffff' });
      }
    }
    this.cues.add('wipe');
  }

  /** Real-time parts of the effects (not the run). */
  tick(dt: number): void {
    this.fx.step(dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.levelGlow = Math.max(0, this.levelGlow - dt * 1.4);
    this.gemPulse = Math.max(0, this.gemPulse - dt * 4);
    if (this.bossShow) {
      this.bossShow.age += dt;
      if (this.bossShow.age >= this.bossShow.life) this.bossShow = null;
    }
    for (const b of this.bolts) b.age += dt;
    this.bolts = this.bolts.filter((b) => b.age < b.life);
    for (const v of this.waves) v.age += dt;
    while (this.waves.length && this.waves[0].age >= this.waves[0].life) this.waves.shift();
    if (this.wipeShow) {
      const w = this.wipeShow;
      w.age += dt;
      for (const st of w.streaks) { st.x += st.vx * dt; st.y += st.vy * dt; }
      if (w.age >= w.life) this.wipeShow = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, s: RunState, w: number, h: number, time: number, stick: Stick | null): void {
    const scale = viewScale(w, h);
    const map = s.setup.map;
    // A painting that finishes downloading mid-run replaces its stand-in at once.
    const painted = paintedCount();
    if (!this.sprites || this.sprites.scale !== scale || this.sprites.mapId !== map.id || this.sprites.painted !== painted) this.sprites = buildSprites(map, scale);
    if (!this.ground || this.ground.scale !== scale || this.ground.mapId !== map.id || this.ground.painted !== painted) {
      const canvas = buildGround(map.id, scale);
      this.ground = { canvas, scale, mapId: map.id, painted, pattern: ctx.createPattern(canvas as CanvasImageSource, 'repeat') };
    }
    const sh = this.reduced ? 0 : this.shake * this.shake * 0.5;
    const shx = sh ? (Math.random() - 0.5) * sh : 0;
    const shy = sh ? (Math.random() - 0.5) * sh : 0;
    const camX = s.hero.x + shx;
    const camY = s.hero.y + shy;

    // ground (screen px, the pattern shifted with the camera)
    const T = 6 * scale;
    const ox = ((-camX * scale + w / 2) % T + T) % T;
    const oy = ((-camY * scale + h / 2) % T + T) % T;
    ctx.save();
    ctx.translate(ox - T, oy - T);
    ctx.fillStyle = this.ground.pattern ?? MAP_LOOKS.castle.ground;
    ctx.fillRect(0, 0, w + T * 2, h + T * 2);
    ctx.restore();

    // world units from here
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);
    const halfW = w / 2 / scale + 2;
    const halfH = h / 2 / scale + 2;
    const onScreen = (x: number, y: number) => Math.abs(x - camX) < halfW && Math.abs(y - camY) < halfH;

    this.drawCurrent(ctx, s, time, halfW, halfH, camX, camY);
    this.drawStrikeRings(ctx, s, time);
    this.drawAura(ctx, s, time);
    this.drawGems(ctx, s, time, onScreen);
    this.drawEnemies(ctx, s, time, onScreen);
    this.drawLevelGlow(ctx, s);
    this.drawHero(ctx, s, time);
    this.drawBlades(ctx, s, time);
    this.drawBubble(ctx, s, time);
    this.drawShots(ctx, s, time);
    drawStrikes(ctx, this.bolts, time);
    drawWaves(ctx, this.waves, time);
    this.fx.draw(ctx, scale);
    this.drawWipe(ctx, time);
    ctx.restore();

    // screen px
    const toScreen = (x: number, y: number): [number, number] => [(x - camX) * scale + w / 2, (y - camY) * scale + h / 2];
    if (map.storm === 'fog') this.drawFog(ctx, s, w, h, scale);
    this.drawBossArrows(ctx, s, w, h, toScreen);
    this.fx.drawWords(ctx, toScreen, scale);
    this.drawVignette(ctx, map.id, w, h);
    this.drawBossShow(ctx, w, h, time);
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.85, this.flash) * (this.reduced ? 0.5 : 1);
      ctx.fillStyle = this.flashColour;
      ctx.globalCompositeOperation = this.flashColour === '#ff2a2a' ? 'source-over' : 'lighter';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (stick) drawStick(ctx, stick);
  }

  private drawAura(ctx: CanvasRenderingContext2D, s: RunState, time: number): void {
    for (const wpn of s.weapons) {
      if (wpn.id !== 'aura') continue;
      const r = stats(wpn).area * area(s);
      const c = this.colour('aura');
      if (drawAuraStyle(ctx, this.fx, styleOf(this.hero, 'aura'), s.hero.x, s.hero.y, r, c, wpn.evolved, time)) continue;
      const pulse = 1 + Math.sin(time * 5) * 0.04;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(glowSprite(wpn.evolved ? c.evolved : c.main) as CanvasImageSource, s.hero.x - r * 1.15 * pulse, s.hero.y - r * 1.15 * pulse, r * 2.3 * pulse, r * 2.3 * pulse);
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = wpn.evolved ? c.evolved : c.glow;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(s.hero.x, s.hero.y, r * pulse, 0, TAU);
      ctx.stroke();
      if (wpn.evolved) {
        ctx.lineWidth = 0.12;
        for (let i = 0; i < 12; i++) {
          const a = time * 0.8 + (i / 12) * TAU;
          ctx.beginPath();
          ctx.moveTo(s.hero.x + Math.cos(a) * r * 0.6, s.hero.y + Math.sin(a) * r * 0.6);
          ctx.lineTo(s.hero.x + Math.cos(a) * r * 1.2, s.hero.y + Math.sin(a) * r * 1.2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawGems(ctx: CanvasRenderingContext2D, s: RunState, time: number, onScreen: (x: number, y: number) => boolean): void {
    const groups: [string, string, number, (v: number) => boolean][] = [
      ['#4ab8ff', '#bfe8ff', 0.16, (v) => v < 3],
      ['#3ad97a', '#bfffd6', 0.22, (v) => v >= 3 && v < 20],
      ['#ff3a6a', '#ffc0d0', 0.34, (v) => v >= 20],
    ];
    const bob = Math.sin(time * 4) * 0.04;
    for (const [col, light, size, test] of groups) {
      ctx.fillStyle = col;
      ctx.strokeStyle = light;
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      for (const g of s.gems) {
        if (!g.alive || !test(g.value) || !onScreen(g.x, g.y)) continue;
        const y = g.y + bob;
        ctx.moveTo(g.x, y - size);
        ctx.lineTo(g.x + size * 0.7, y);
        ctx.lineTo(g.x, y + size);
        ctx.lineTo(g.x - size * 0.7, y);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, s: RunState, time: number, onScreen: (x: number, y: number) => boolean): void {
    const sp = this.sprites as Sprites;
    const frozen: number[] = [];
    const bosses: number[] = [];
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = s.enemies[i];
      if (!e.alive || !onScreen(e.x, e.y)) continue;
      const pics = sp.pics[e.kind];
      const S = sp.size[e.kind];
      const flip = e.x < s.hero.x ? 0 : 1;
      const wob = this.reduced ? 0 : Math.sin(time * 9 + e.id) * 0.06;
      const charging = e.kind >= 3 && e.speed > 0 && (s.t - e.born) % 240 < 40;
      ctx.drawImage(pics[flip] as CanvasImageSource, e.x - S / 2, e.y - S / 2 - wob * S * 0.3, S, S * (1 + wob));
      if (charging) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        ctx.drawImage(glowSprite('#ff4a2a') as CanvasImageSource, e.x - e.radius * 1.8, e.y - e.radius * 1.8, e.radius * 3.6, e.radius * 3.6);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (e.slowUntil > s.t) frozen.push(i);
      if (e.kind >= 3) bosses.push(i);
    }
    if (frozen.length) {
      ctx.strokeStyle = 'rgba(190,235,255,0.85)';
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      for (const i of frozen) {
        const e = s.enemies[i];
        ctx.moveTo(e.x + e.radius, e.y);
        ctx.arc(e.x, e.y, e.radius, 0, TAU);
      }
      ctx.stroke();
    }
    for (const i of bosses) {
      const e = s.enemies[i];
      const bw = e.radius * 2.4;
      const y = e.y - e.radius * 1.6 - 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - bw / 2 - 0.05, y - 0.05, bw + 0.1, 0.28);
      ctx.fillStyle = e.kind === 4 ? '#ff3a3a' : '#ff9a2a';
      ctx.fillRect(e.x - bw / 2, y, bw * Math.max(0, e.hp / e.maxHp), 0.18);
    }
  }

  private drawHero(ctx: CanvasRenderingContext2D, s: RunState, time: number): void {
    const h = s.hero;
    const L = HERO_LOOKS[s.setup.hero.id];
    const hurt = h.hurtUntil > s.t && Math.floor(time * 20) % 2 === 0;
    const r = 0.5;
    const fx = DIRX(h.facing);
    const step = this.reduced ? 0 : Math.sin(time * 14) * 0.04;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.9, r * 0.85, r * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = hurt ? 0.45 : 1;
    const art = paintedImage(heroArt(s.setup.hero.id, h.hurtUntil > s.t ? 'hurt' : 'stand')) ?? paintedImage(heroArt(s.setup.hero.id, 'stand'));
    if (art) {
      if (fx < 0) ctx.scale(-1, 1);
      stamp(ctx, art, 0, step * 0.5, r * 3.4);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = 'rgba(20,10,25,0.85)';
    // cape
    ctx.fillStyle = L.cape;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.2);
    ctx.lineTo(r * 0.6, -r * 0.2);
    ctx.lineTo(r * 0.75 - fx * 0.15, r * 0.85 + step);
    ctx.lineTo(-r * 0.75 - fx * 0.15, r * 0.85 - step);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // body
    ctx.fillStyle = L.body;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.55, r * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = L.trim;
    ctx.fillRect(-r * 0.5, r * 0.3, r, r * 0.12);
    // head
    ctx.fillStyle = L.skin;
    ctx.beginPath();
    ctx.arc(fx * 0.05, -r * 0.45, r * 0.42, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1e1428';
    ctx.beginPath();
    ctx.arc(fx * 0.12 - 0.09, -r * 0.48, 0.045, 0, TAU);
    ctx.arc(fx * 0.12 + 0.09, -r * 0.48, 0.045, 0, TAU);
    ctx.fill();
    drawHat(ctx, L.hat, L.trim, L.body, r, fx);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawBlades(ctx: CanvasRenderingContext2D, s: RunState, time: number): void {
    const ar = area(s);
    for (const wpn of s.weapons) {
      if (wpn.id !== 'blades') continue;
      const st = stats(wpn);
      const r = st.area * ar;
      const c = this.colour('blades');
      const col = wpn.evolved ? c.evolved : c.main;
      // a glowing trail ring
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = wpn.evolved ? 0.4 : 0.22;
      ctx.strokeStyle = wpn.evolved ? c.evolved : c.glow;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.arc(s.hero.x, s.hero.y, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let b = 0; b < st.count; b++) {
        const a = wpn.angle + (b * TURN) / st.count;
        const i = Math.floor(a) % TURN;
        const f = a - Math.floor(a);
        const j = (i + 1) % TURN;
        const bx = s.hero.x + (COS[i] + (COS[j] - COS[i]) * f) * r;
        const by = s.hero.y + (SIN[i] + (SIN[j] - SIN[i]) * f) * r;
        const ang = (a / TURN) * TAU + Math.PI / 2;
        ctx.drawImage(glowSprite(wpn.evolved ? c.evolved : c.glow) as CanvasImageSource, bx - 0.6, by - 0.6, 1.2, 1.2);
        ctx.globalCompositeOperation = 'source-over';
        const tok = tokenOf(this.hero, 'blades');
        if (tok !== 'sword') {
          if (tok === 'flail') {
            // A chain back to the hero.
            ctx.strokeStyle = 'rgba(90,90,100,0.9)';
            ctx.lineWidth = 0.05;
            ctx.setLineDash([0.12, 0.08]);
            ctx.beginPath(); ctx.moveTo(s.hero.x, s.hero.y); ctx.lineTo(bx, by); ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(ang + (tok === 'rune' || tok === 'ember' ? 0 : wpn.evolved ? time * 10 : 0));
          drawToken(ctx, tok, wpn.evolved ? 0.5 : 0.42, col, time + b);
          ctx.restore();
          ctx.globalCompositeOperation = 'lighter';
          if (tok === 'ember' && !this.fx.low && Math.random() < 0.3) this.fx.add('spark', bx, by, { vy: -2, life: 0.4, size: 0.07, c: '#ffb02e', add: true });
          continue;
        }
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(ang + (wpn.evolved ? time * 10 : 0));
        ctx.fillStyle = col;
        ctx.strokeStyle = 'rgba(20,20,40,0.8)';
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(-0.45, 0);
        ctx.lineTo(0.3, -0.09);
        ctx.lineTo(0.48, 0);
        ctx.lineTo(0.3, 0.09);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#8a5a2a';
        ctx.fillRect(-0.55, -0.05, 0.14, 0.1);
        ctx.fillStyle = '#ffd23a';
        ctx.fillRect(-0.42, -0.15, 0.05, 0.3);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawBubble(ctx: CanvasRenderingContext2D, s: RunState, time: number): void {
    const wpn = s.weapons.find((x) => x.id === 'bubble');
    if (!wpn || wpn.charges <= 0) return;
    const c = this.colour('bubble');
    const r = 0.85 + Math.sin(time * 3) * 0.03;
    if (drawShieldStyle(ctx, styleOf(this.hero, 'bubble'), s.hero.x, s.hero.y, r, wpn.charges, c, wpn.evolved, time)) return;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = wpn.evolved ? c.evolved : c.glow;
    ctx.beginPath();
    ctx.arc(s.hero.x, s.hero.y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = wpn.evolved ? c.evolved : c.main;
    ctx.lineWidth = 0.06;
    for (let i = 0; i < wpn.charges; i++) {
      ctx.beginPath();
      ctx.arc(s.hero.x, s.hero.y, r + i * 0.12, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(s.hero.x - r * 0.45, s.hero.y - r * 0.5, r * 0.18, r * 0.09, -0.7, 0, TAU);
    ctx.fill();
    if (wpn.evolved) {
      ctx.fillStyle = c.evolved;
      for (let i = 0; i < 10; i++) {
        const a = time + (i / 10) * TAU;
        ctx.beginPath();
        ctx.moveTo(s.hero.x + Math.cos(a) * (r + 0.35), s.hero.y + Math.sin(a) * (r + 0.35));
        ctx.lineTo(s.hero.x + Math.cos(a + 0.15) * r, s.hero.y + Math.sin(a + 0.15) * r);
        ctx.lineTo(s.hero.x + Math.cos(a - 0.15) * r, s.hero.y + Math.sin(a - 0.15) * r);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawShots(ctx: CanvasRenderingContext2D, s: RunState, time: number): void {
    const evolved = (id: WeaponId) => s.weapons.some((x) => x.id === id && x.evolved);
    for (const p of s.shots) {
      if (!p.alive) continue;
      const c = this.colour(p.weapon);
      if (styleOf(this.hero, p.weapon) !== 'plain') {
        const tok = tokenOf(this.hero, p.weapon);
        const ev = evolved(p.weapon);
        const size = p.weapon === 'axes' ? p.radius * 0.9 : p.weapon === 'fireball' ? (ev ? 0.55 : 0.4) : 0.34;
        drawShotToken(ctx, this.fx, tok, p.x, p.y, p.vx, p.vy, size * (ev && p.weapon !== 'fireball' ? 1.2 : 1), ev ? c.evolved : c.main, time, p.slot * 7 + (p.life % 97));
        continue;
      }
      if (p.weapon === 'fireball') {
        const big = evolved('fireball') ? 1.5 : 1;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite(evolved('fireball') ? c.evolved : c.main) as CanvasImageSource, p.x - 0.7 * big, p.y - 0.7 * big, 1.4 * big, 1.4 * big);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.16 * big, 0, TAU);
        ctx.fill();
        if (Math.random() < 0.5) this.fx.add('puff', p.x, p.y, { life: 0.3, size: 0.18 * big, grow: 0.4, c: '#ff7a2a', vx: -p.vx * 0.05, vy: -p.vy * 0.05 });
      } else if (p.weapon === 'axes') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(time * 14);
        const sz = p.radius * 1.4;
        ctx.fillStyle = '#7a4a22';
        ctx.fillRect(-sz, -0.05, sz * 2, 0.1);
        ctx.fillStyle = evolved('axes') ? c.evolved : '#d9dde6';
        ctx.strokeStyle = 'rgba(20,20,40,0.8)';
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(sz * 0.5, -0.05);
        ctx.quadraticCurveTo(sz * 1.2, -sz * 0.8, sz * 1.1, 0);
        ctx.quadraticCurveTo(sz * 1.2, sz * 0.8, sz * 0.5, 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (p.weapon === 'arrows') {
        const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        const dx = p.vx / sp;
        const dy = p.vy / sp;
        ctx.strokeStyle = evolved('arrows') ? c.evolved : c.glow;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 0.14;
        ctx.beginPath();
        ctx.moveTo(p.x - dx * 1.1, p.y - dy * 1.1);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#8a5a2a';
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.moveTo(p.x - dx * 0.6, p.y - dy * 0.6);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = '#e8eef2';
        ctx.beginPath();
        ctx.moveTo(p.x + dx * 0.2, p.y + dy * 0.2);
        ctx.lineTo(p.x - dy * 0.1, p.y + dx * 0.1);
        ctx.lineTo(p.x + dy * 0.1, p.y - dx * 0.1);
        ctx.fill();
      }
    }
  }

  /** The level-up column of light: a tall soft beam over the hero that fades in about 0.7 s. */
  private drawLevelGlow(ctx: CanvasRenderingContext2D, s: RunState): void {
    const a = this.levelGlow;
    if (a <= 0) return;
    const x = s.hero.x;
    const y = s.hero.y;
    const wide = 0.9 + (1 - a) * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * (this.reduced ? 0.5 : 0.85);
    const g = ctx.createLinearGradient(x - wide, 0, x + wide, 0);
    g.addColorStop(0, 'rgba(154,255,200,0)');
    g.addColorStop(0.5, 'rgba(220,255,236,0.9)');
    g.addColorStop(1, 'rgba(154,255,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - wide, y - 14, wide * 2, 14.4);
    if (!this.low) {
      ctx.globalAlpha = a;
      const r = 1.6 + (1 - a) * 1.5;
      ctx.drawImage(glowSprite('#9affc8') as CanvasImageSource, x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** A boss arriving, in screen px: a dark pulse, hazard stripes top and bottom, and its name. */
  private drawBossShow(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
    const b = this.bossShow;
    if (!b) return;
    const t = b.age / b.life;
    const inOut = Math.min(1, t * 6, (1 - t) * 4);
    const big = b.kind === 4;
    // darken
    ctx.globalAlpha = inOut * (big ? 0.38 : 0.25) * (this.reduced ? 0.6 : 1);
    ctx.fillStyle = '#12020a';
    ctx.fillRect(0, 0, w, h);
    // hazard stripes
    const band = Math.max(18, Math.min(34, h * 0.05));
    const slide = this.reduced ? 0 : (time * 60) % (band * 2);
    ctx.globalAlpha = inOut * 0.9;
    for (const y of [0, h - band]) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, w, band);
      ctx.clip();
      ctx.fillStyle = big ? '#b3121e' : '#c46a0c';
      ctx.fillRect(0, y, w, band);
      ctx.fillStyle = '#1a0a0a';
      for (let x = -band * 2 + (y ? -slide : slide); x < w + band * 2; x += band * 2) {
        ctx.beginPath();
        ctx.moveTo(x, y + band);
        ctx.lineTo(x + band, y);
        ctx.lineTo(x + band * 1.6, y);
        ctx.lineTo(x + band * 0.6, y + band);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // the name, dropping in
    const drop = this.reduced ? 1 : Math.min(1, t * 5);
    const size = Math.round(Math.min(w * 0.09, h * 0.12) * (big ? 1 : 0.8) * (1.6 - drop * 0.6));
    ctx.globalAlpha = inOut;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(3, size * 0.14);
    ctx.strokeStyle = 'rgba(20,0,10,0.9)';
    const text = big ? `${b.name.toUpperCase()}!` : b.name.toUpperCase();
    const ty = h * 0.42; // below the arrival banner
    ctx.strokeText(text, w / 2, ty);
    ctx.fillStyle = big ? '#ff5a4a' : '#ffb04a';
    ctx.fillText(text, w / 2, ty);
    ctx.globalAlpha = 1;
  }

  private drawWipe(ctx: CanvasRenderingContext2D, time: number): void {
    const w = this.wipeShow;
    if (!w) return;
    const c = this.colour(w.weapon);
    const a = 1 - w.age / w.life;
    ctx.globalCompositeOperation = 'lighter';
    for (const st of w.streaks) {
      ctx.globalAlpha = a;
      const size = st.s * 1.6;
      ctx.drawImage(glowSprite(c.evolved) as CanvasImageSource, st.x - size, st.y - size, size * 2, size * 2);
      ctx.strokeStyle = c.main;
      ctx.lineWidth = st.s * 0.4;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x - st.vx * 0.08, st.y - st.vy * 0.08);
      ctx.stroke();
      const tok = tokenOf(this.hero, w.weapon);
      if (styleOf(this.hero, w.weapon) !== 'plain' && tok !== 'none') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(Math.atan2(st.vy, st.vx));
        drawToken(ctx, tok, st.s * 1.1, c.evolved, time);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
      } else if (w.weapon === 'blades' || w.weapon === 'axes') {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(time * 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-size * 0.5, -0.06, size, 0.12);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBossArrows(ctx: CanvasRenderingContext2D, s: RunState, w: number, h: number, toScreen: (x: number, y: number) => [number, number]): void {
    for (const e of s.enemies) {
      if (!e.alive || e.kind < 3) continue;
      const [sx, sy] = toScreen(e.x, e.y);
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const ang = Math.atan2(sy - h / 2, sx - w / 2);
      const m = 34;
      const k = Math.min((w / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (h / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
      const ax = w / 2 + Math.cos(ang) * k;
      const ay = h / 2 + Math.sin(ang) * k;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = e.kind === 4 ? '#ff3a3a' : '#ff9a2a';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -13);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 13);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
  }

  /** Sky Citadel: each lightning ring glows brighter and fills in as its strike comes. */
  private drawStrikeRings(ctx: CanvasRenderingContext2D, s: RunState, time: number): void {
    if (s.setup.map.storm !== 'lightning') return;
    const L = STORM.lightning;
    for (const k of s.storm.strikes) {
      const left = Math.max(0, (k.at - s.t) / L.warn);
      const soon = 1 - left;
      ctx.globalAlpha = 0.25 + soon * 0.45;
      ctx.fillStyle = '#bfe6ff';
      ctx.beginPath();
      ctx.arc(k.x, k.y, L.radius * soon, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.6 + Math.sin(time * (8 + soon * 18)) * 0.3;
      ctx.strokeStyle = soon > 0.7 ? '#ffffff' : '#8ad0ff';
      ctx.lineWidth = 0.08 + soon * 0.06;
      ctx.beginPath();
      ctx.arc(k.x, k.y, L.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Sunken Kingdom: streaks of water drift the way the sea is pushing. */
  private drawCurrent(ctx: CanvasRenderingContext2D, s: RunState, time: number, halfW: number, halfH: number, camX: number, camY: number): void {
    if (s.setup.map.storm !== 'current') return;
    const dx = Math.cos((s.storm.current / 16) * TAU);
    const dy = Math.sin((s.storm.current / 16) * TAU);
    const n = this.low ? 14 : 34;
    const spanX = halfW * 2;
    const spanY = halfH * 2;
    ctx.strokeStyle = '#bff4ee';
    ctx.lineWidth = 0.07;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      // Fixed spots that slide with time, wrapped onto the screen.
      const travel = time * 3 + i * 7.3;
      const px = camX - halfW + ((((i * 37.1 + travel * dx) % spanX) + spanX) % spanX);
      const py = camY - halfH + ((((i * 19.7 + travel * dy) % spanY) + spanY) % spanY);
      ctx.globalAlpha = 0.18 + (i % 3) * 0.06;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + dx * 1.2, py + dy * 1.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Shadow Swamp: dark fog everywhere but close round the hero (further with the Storm Lantern). */
  private fogFor: { key: string; g: CanvasGradient } | null = null;
  private drawFog(ctx: CanvasRenderingContext2D, s: RunState, w: number, h: number, scale: number): void {
    const see = (STORM.fog.see + legendLevel(s, 'lantern') * STORM.fog.lantern * LEGENDARY.lantern.step) * scale;
    const key = `${w}x${h}:${Math.round(see)}`;
    if (!this.fogFor || this.fogFor.key !== key) {
      const g = ctx.createRadialGradient(w / 2, h / 2, see * 0.55, w / 2, h / 2, see);
      g.addColorStop(0, 'rgba(8,14,10,0)');
      g.addColorStop(0.6, 'rgba(8,14,10,0.7)');
      g.addColorStop(1, 'rgba(8,14,10,0.94)');
      this.fogFor = { key, g };
    }
    ctx.fillStyle = this.fogFor.g;
    ctx.fillRect(0, 0, w, h);
  }

  private vignetteFor: { key: string; g: CanvasGradient } | null = null;
  private drawVignette(ctx: CanvasRenderingContext2D, mapId: string, w: number, h: number): void {
    const key = `${mapId}:${w}x${h}`;
    if (!this.vignetteFor || this.vignetteFor.key !== key) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.sqrt(w * w + h * h) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, (MAP_LOOKS[mapId] ?? MAP_LOOKS.castle).vignette);
      this.vignetteFor = { key, g };
    }
    ctx.fillStyle = this.vignetteFor.g;
    ctx.fillRect(0, 0, w, h);
  }
}

const DIRX = (facing: number) => Math.cos((facing / 16) * TAU);

function drawHat(ctx: CanvasRenderingContext2D, hat: string, trim: string, body: string, r: number, fx: number): void {
  const y = -r * 0.45;
  ctx.fillStyle = body;
  ctx.beginPath();
  if (hat === 'helmet') {
    ctx.arc(fx * 0.05, y - 0.02, r * 0.46, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff4a4a';
    ctx.fillRect(-0.03, y - r * 0.85, 0.06, r * 0.3);
  } else if (hat === 'hood') {
    ctx.arc(fx * 0.05, y, r * 0.5, Math.PI * 0.95, Math.PI * 0.05);
    ctx.lineTo(fx * 0.05, y - r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hat === 'pointy' || hat === 'witch') {
    ctx.moveTo(-r * 0.6, y - r * 0.2);
    ctx.lineTo(r * 0.6, y - r * 0.2);
    ctx.lineTo(fx * 0.15 + 0.05, y - r * 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(fx * 0.1, y - r * 0.8, 0.06, 0, TAU);
    ctx.fill();
  } else if (hat === 'horns' || hat === 'dragon') {
    ctx.fillStyle = hat === 'dragon' ? '#ffd36b' : '#f3ead2';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * r * 0.3, y - r * 0.3);
      ctx.quadraticCurveTo(sgn * r * 0.8, y - r * 0.6, sgn * r * 0.7, y - r * 1.0);
      ctx.lineTo(sgn * r * 0.45, y - r * 0.2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (hat === 'halo') {
    ctx.strokeStyle = '#ffd84a';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.ellipse(0, y - r * 0.6, r * 0.35, r * 0.1, 0, 0, TAU);
    ctx.stroke();
  } else if (hat === 'mask') {
    ctx.fillStyle = trim;
    ctx.fillRect(-r * 0.42, y - 0.06, r * 0.84, 0.1);
  }
}

// ---------------------------------------------------------------- the floating stick

export interface Stick { ox: number; oy: number; x: number; y: number; max: number }

function drawStick(ctx: CanvasRenderingContext2D, st: Stick): void {
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(st.ox, st.oy, st.max, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
  let dx = st.x - st.ox;
  let dy = st.y - st.oy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > st.max) { dx = (dx / d) * st.max; dy = (dy / d) * st.max; }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(st.ox + dx, st.oy + dy, st.max * 0.45, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}
