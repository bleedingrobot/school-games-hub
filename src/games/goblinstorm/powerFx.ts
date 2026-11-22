/**
 * Each hero's attacks drawn as what they are called (James, 22 Nov 2026: "Stinging Wasps" and "Frost Spikes" were both
 * just a lightning bolt). heroPowers.ts names every hero's version of the 8 weapons; this draws them: wasps swarm in,
 * sunbeams fall, the ground cracks under a Thunder Stomp, ice spikes burst up, lava erupts, and so on. The rules are
 * untouched (every hero's "lightning" still hits the same monsters); only the picture changes.
 *
 * Most of the little things are painted (art/paint/fx/, docs/goblinstorm-art/config.json "fx-..."): a wasp, a hawk, a
 * boulder, a spellbook. Each is drawn in code until its painting has downloaded (or if it isn't painted).
 *
 * A hero's weapon with no entry in HERO_POWERS (the Knight, the Wizard's Fireball, ...) keeps the plain look.
 * Drawing only: Math.random is fine here.
 */
import type { HeroId, WeaponId } from '../../../shared/goblinstorm/config';
import { paintedImage } from './art';
import { glowSprite, type Fx } from './fx';
import { HERO_POWERS } from './heroPowers';

const TAU = Math.PI * 2;
type G = CanvasRenderingContext2D;
export type Colours = { main: string; glow: string; evolved: string };

/** Which hero's look a weapon uses: theirs if they have their own version of it, else the plain one. */
export type Style = HeroId | 'plain';
export function styleOf(hero: HeroId, weapon: WeaponId): Style {
  return HERO_POWERS[hero]?.[weapon] ? hero : 'plain';
}

// ---------------------------------------------------------------- little pictures ("tokens")

/** Small things drawn at the origin, pointing along +x, about 2*s long. */
export type Token =
  | 'sword' | 'leaf' | 'rune' | 'flail' | 'hammer' | 'dagger' | 'icicle' | 'ember'
  | 'fireball' | 'hawk' | 'boulder' | 'orb' | 'bomb' | 'icebolt'
  | 'axe' | 'boomerang' | 'book' | 'mace' | 'star' | 'snowball' | 'lavarock'
  | 'arrow' | 'spark' | 'spear' | 'lightdart' | 'knife' | 'shard' | 'flame'
  | 'bolt' | 'wasp' | 'slash' | 'thorn' | 'caltrop' | 'snowflake' | 'note' | 'none';

const PLAIN: Record<WeaponId, Token> = {
  blades: 'sword', fireball: 'fireball', lightning: 'bolt', aura: 'none', nova: 'none', axes: 'axe', arrows: 'arrow', bubble: 'none',
};

const OWN: Partial<Record<HeroId, Partial<Record<WeaponId, Token>>>> = {
  ranger: { blades: 'leaf', fireball: 'hawk', lightning: 'wasp', aura: 'thorn', nova: 'leaf', axes: 'boomerang', bubble: 'leaf' },
  wizard: { blades: 'rune', lightning: 'spark', aura: 'rune', nova: 'rune', axes: 'book', arrows: 'spark', bubble: 'shard' },
  barbarian: { blades: 'flail', fireball: 'boulder', lightning: 'boulder', aura: 'flame', nova: 'note', arrows: 'spear', bubble: 'boulder' },
  cleric: { blades: 'hammer', fireball: 'orb', lightning: 'lightdart', nova: 'note', axes: 'mace', arrows: 'lightdart', bubble: 'lightdart' },
  rogue: { blades: 'dagger', fireball: 'bomb', lightning: 'slash', aura: 'caltrop', nova: 'star', axes: 'star', arrows: 'knife', bubble: 'slash' },
  witch: { blades: 'icicle', fireball: 'icebolt', lightning: 'icicle', aura: 'snowflake', axes: 'snowball', arrows: 'shard', bubble: 'shard' },
  dragonkid: { blades: 'ember', lightning: 'lavarock', aura: 'flame', nova: 'ember', axes: 'lavarock', arrows: 'flame', bubble: 'ember' },
};

export function tokenOf(hero: HeroId, weapon: WeaponId): Token {
  return (styleOf(hero, weapon) !== 'plain' && OWN[hero]?.[weapon]) || PLAIN[weapon];
}

/** Tokens that tumble as they fly (the rest point the way they go). Turns a second. */
const SPIN: Partial<Record<Token, number>> = {
  axe: 14, boomerang: 18, book: 5, mace: 12, star: 22, snowball: 4, lavarock: 6, boulder: 5, bomb: 6, flail: 0, orb: 2,
};

function glowAt(g: G, c: string, x: number, y: number, r: number, a = 1): void {
  const op = g.globalCompositeOperation;
  const ga = g.globalAlpha;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = ga * a;
  g.drawImage(glowSprite(c) as CanvasImageSource, x - r, y - r, r * 2, r * 2);
  g.globalAlpha = ga;
  g.globalCompositeOperation = op;
}

function poly(g: G, pts: number[]): void {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}

function star(g: G, n: number, outer: number, inner: number, rot = 0): void {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i / (n * 2)) * TAU;
    if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}

const INK = 'rgba(20,20,40,0.8)';

/** A painted effect picture (fx/<name>), or null until it has downloaded. */
export const fxPic = (name: string) => paintedImage(`fx/${name}`);

/** Draws a painted picture centred on the origin, its longer side `size` long. */
export function drawPic(g: G, img: HTMLImageElement, size: number): void {
  const k = size / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  g.drawImage(img, -w / 2, -h / 2, w, h);
}

/** Tokens with a painting, and the soft light (if any) put behind it. */
const PAINTED: Partial<Record<Token, string | null>> = {
  sword: null, leaf: null, rune: '#9a6bff', flail: null, hammer: '#fff3b0', dagger: null, icicle: '#bfe8ff',
  hawk: null, boulder: null, orb: '#ffd84a', bomb: null, icebolt: '#9fdcff', axe: null, boomerang: null, book: '#c8a8ff',
  mace: '#fff3b0', star: null, snowball: null, lavarock: '#ff5a1a', spear: null, knife: null, shard: '#bfe8ff',
  wasp: null, thorn: null, caltrop: null, snowflake: '#cfeeff', note: '#ffd84a',
};
/** How big a painting is drawn, against the 2*s the code drawing fills. */
const PIC_SIZE: Partial<Record<Token, number>> = { hawk: 2.6, wasp: 2.2, book: 2.2, orb: 1.8, boulder: 1.7, lavarock: 1.7, snowball: 1.6, bomb: 1.8, caltrop: 1.7, flail: 1.7, star: 2 };

/** Draws one token at the origin. `col` is the weapon's colour (evolved colour once evolved). */
export function drawToken(g: G, k: Token, s: number, col: string, time: number): void {
  const light = PAINTED[k];
  if (light !== undefined) {
    const img = fxPic(k);
    if (img) {
      if (light) glowAt(g, light, 0, 0, s * 1.5, 0.7);
      if (k === 'hawk' || k === 'wasp' || k === 'book') {
        // Flapping: squash the painting across its wings.
        const f = k === 'book' ? 0.75 + Math.abs(Math.sin(time * 9)) * 0.25 : 0.7 + Math.abs(Math.sin(time * (k === 'wasp' ? 60 : 18) + s * 9)) * 0.3;
        g.save(); g.scale(1, f); drawPic(g, img, s * (PIC_SIZE[k] ?? 2.1)); g.restore();
      } else drawPic(g, img, s * (PIC_SIZE[k] ?? 2.1));
      return;
    }
  }
  g.lineJoin = 'round';
  g.lineWidth = 0.04;
  g.strokeStyle = INK;
  switch (k) {
    case 'sword':
      g.fillStyle = col;
      poly(g, [-0.9 * s, 0, 0.6 * s, -0.18 * s, 0.96 * s, 0, 0.6 * s, 0.18 * s]);
      g.fill(); g.stroke();
      g.fillStyle = '#8a5a2a'; g.fillRect(-1.1 * s, -0.1 * s, 0.28 * s, 0.2 * s);
      g.fillStyle = '#ffd23a'; g.fillRect(-0.84 * s, -0.3 * s, 0.1 * s, 0.6 * s);
      return;
    case 'leaf':
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(-s, 0);
      g.quadraticCurveTo(0, -0.75 * s, s, 0);
      g.quadraticCurveTo(0, 0.75 * s, -s, 0);
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(20,60,20,0.75)';
      g.beginPath(); g.moveTo(-s, 0); g.lineTo(0.8 * s, 0);
      for (let i = -1; i <= 1; i++) { g.moveTo(i * 0.35 * s, 0); g.lineTo(i * 0.35 * s + 0.25 * s, -0.25 * s); g.moveTo(i * 0.35 * s, 0); g.lineTo(i * 0.35 * s + 0.25 * s, 0.25 * s); }
      g.stroke();
      return;
    case 'rune': {
      glowAt(g, col, 0, 0, s * 1.6, 0.8);
      g.strokeStyle = col; g.lineWidth = 0.09 * s + 0.03;
      g.beginPath(); g.arc(0, 0, 0.75 * s, 0, TAU); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.07 * s + 0.02;
      const r = 0.45 * s;
      g.beginPath();
      g.moveTo(0, -r); g.lineTo(r * 0.8, r * 0.6); g.lineTo(-r * 0.8, r * 0.6); g.closePath();
      g.moveTo(0, -r); g.lineTo(0, r);
      g.stroke();
      return;
    }
    case 'flail':
      g.fillStyle = '#6f737c';
      star(g, 8, 0.75 * s, 0.45 * s, time * 3);
      g.fill(); g.stroke();
      g.fillStyle = col;
      g.beginPath(); g.arc(0, 0, 0.42 * s, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.arc(-0.15 * s, -0.15 * s, 0.12 * s, 0, TAU); g.fill();
      return;
    case 'hammer':
      g.fillStyle = '#8a5a2a'; g.fillRect(-s, -0.09 * s, 1.5 * s, 0.18 * s);
      g.fillStyle = col;
      g.fillRect(0.4 * s, -0.5 * s, 0.55 * s, s); g.strokeRect(0.4 * s, -0.5 * s, 0.55 * s, s);
      glowAt(g, '#fff3b0', 0.68 * s, 0, 0.7 * s, 0.6);
      return;
    case 'dagger':
      g.fillStyle = '#dfe3ee';
      poly(g, [-0.3 * s, -0.16 * s, 0.9 * s, 0, -0.3 * s, 0.16 * s]);
      g.fill(); g.stroke();
      g.strokeStyle = col; g.lineWidth = 0.05;
      g.beginPath(); g.moveTo(-0.25 * s, 0); g.lineTo(0.7 * s, 0); g.stroke();
      g.fillStyle = '#2a2235'; g.fillRect(-0.85 * s, -0.09 * s, 0.55 * s, 0.18 * s);
      g.fillStyle = col; g.fillRect(-0.36 * s, -0.28 * s, 0.08 * s, 0.56 * s);
      return;
    case 'icicle':
    case 'shard':
      glowAt(g, '#bfe8ff', 0, 0, s * 0.9, 0.5);
      g.fillStyle = k === 'icicle' ? '#e4f6ff' : col;
      g.strokeStyle = '#3f8fc8';
      poly(g, k === 'icicle' ? [-s, -0.22 * s, s, 0, -s, 0.22 * s, -0.8 * s, 0] : [-0.9 * s, 0, 0, -0.28 * s, s, 0, 0, 0.28 * s]);
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.moveTo(-0.6 * s, -0.06 * s); g.lineTo(0.5 * s, -0.02 * s); g.stroke();
      return;
    case 'ember':
    case 'flame': {
      const f = 1 + Math.sin(time * 30 + s * 9) * 0.12;
      glowAt(g, '#ff6a1a', 0, 0, s * 1.5 * f, 0.9);
      glowAt(g, '#ffd36b', 0, 0, s * 0.7 * f, 0.9);
      if (k === 'ember') {
        g.fillStyle = '#ffe9a0';
        g.beginPath();
        g.moveTo(0.9 * s * f, 0);
        g.quadraticCurveTo(0, -0.5 * s, -0.45 * s, 0);
        g.quadraticCurveTo(0, 0.5 * s, 0.9 * s * f, 0);
        g.fill();
      }
      return;
    }
    case 'fireball':
      glowAt(g, col, 0, 0, 0.7 * s / 0.5 * 0.5 + 0.2, 1);
      g.fillStyle = '#fff3b0';
      g.beginPath(); g.arc(0, 0, 0.3 * s, 0, TAU); g.fill();
      return;
    case 'hawk': {
      const flap = Math.sin(time * 22) * 0.55;
      g.fillStyle = '#8a5a32';
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(0.1 * s, 0);
        g.quadraticCurveTo(-0.2 * s, side * (0.5 + flap * side * 0.5) * s, -0.55 * s, side * (1.0 + flap * side * 0.4) * s);
        g.lineTo(-0.3 * s, side * 0.1 * s);
        g.closePath();
        g.fill(); g.stroke();
      }
      g.fillStyle = '#b07a42';
      g.beginPath(); g.ellipse(0, 0, 0.7 * s, 0.24 * s, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#f2e6d0';
      g.beginPath(); g.arc(0.55 * s, 0, 0.2 * s, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#ffc23a';
      poly(g, [0.7 * s, -0.07 * s, 0.95 * s, 0.03 * s, 0.7 * s, 0.08 * s]); g.fill();
      g.fillStyle = '#5a3a1a';
      poly(g, [-0.65 * s, 0, -s, -0.22 * s, -s, 0.22 * s]); g.fill();
      return;
    }
    case 'boulder':
    case 'lavarock': {
      const R = [1, 0.82, 0.95, 0.78, 1, 0.86, 0.92];
      const pts: number[] = [];
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; pts.push(Math.cos(a) * R[i] * 0.7 * s, Math.sin(a) * R[i] * 0.7 * s); }
      if (k === 'lavarock') glowAt(g, '#ff5a1a', 0, 0, s * 1.3, 0.8);
      g.fillStyle = k === 'boulder' ? '#8f887c' : '#3a2a26';
      poly(g, pts); g.fill(); g.stroke();
      if (k === 'boulder') {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath(); g.arc(-0.2 * s, -0.22 * s, 0.2 * s, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(40,30,20,0.6)';
        g.beginPath(); g.moveTo(0.1 * s, -0.4 * s); g.lineTo(0.2 * s, 0); g.lineTo(0.05 * s, 0.3 * s); g.stroke();
      } else {
        g.strokeStyle = '#ffb02e'; g.lineWidth = 0.07 * s + 0.02;
        g.beginPath(); g.moveTo(-0.4 * s, -0.2 * s); g.lineTo(0, 0.05 * s); g.lineTo(0.35 * s, -0.25 * s); g.moveTo(0, 0.05 * s); g.lineTo(0.1 * s, 0.45 * s); g.stroke();
      }
      return;
    }
    case 'orb':
      glowAt(g, col, 0, 0, s * 1.6, 1);
      g.fillStyle = '#fffbe6';
      g.beginPath(); g.arc(0, 0, 0.38 * s, 0, TAU); g.fill();
      g.strokeStyle = '#e0a800'; g.lineWidth = 0.08 * s + 0.02;
      g.beginPath(); g.moveTo(0, -0.24 * s); g.lineTo(0, 0.24 * s); g.moveTo(-0.17 * s, -0.06 * s); g.lineTo(0.17 * s, -0.06 * s); g.stroke();
      return;
    case 'bomb':
      g.fillStyle = '#26222e';
      g.beginPath(); g.arc(0, 0, 0.55 * s, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(-0.2 * s, -0.2 * s, 0.15 * s, 0, TAU); g.fill();
      g.strokeStyle = '#c8a878'; g.lineWidth = 0.06 * s + 0.02;
      g.beginPath(); g.moveTo(0.35 * s, -0.4 * s); g.quadraticCurveTo(0.6 * s, -0.8 * s, 0.85 * s, -0.7 * s); g.stroke();
      glowAt(g, '#ffd23a', 0.85 * s, -0.7 * s, 0.35 * s * (1 + Math.sin(time * 40) * 0.3), 1);
      return;
    case 'icebolt':
      glowAt(g, '#9fdcff', 0, 0, s * 1.3, 0.8);
      g.fillStyle = '#e8f8ff'; g.strokeStyle = '#3f8fc8';
      poly(g, [s, 0, 0.1 * s, -0.4 * s, -0.8 * s, 0, 0.1 * s, 0.4 * s]); g.fill(); g.stroke();
      g.strokeStyle = '#9fdcff';
      g.beginPath(); g.moveTo(s, 0); g.lineTo(-0.8 * s, 0); g.moveTo(0.1 * s, -0.4 * s); g.lineTo(0.1 * s, 0.4 * s); g.stroke();
      return;
    case 'axe':
      g.fillStyle = '#7a4a22'; g.fillRect(-s, -0.05, s * 2, 0.1);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(s * 0.35, -0.05);
      g.quadraticCurveTo(s * 0.85, -s * 0.6, s * 0.8, 0);
      g.quadraticCurveTo(s * 0.85, s * 0.6, s * 0.35, 0.05);
      g.closePath(); g.fill(); g.stroke();
      return;
    case 'boomerang':
      g.fillStyle = '#b5793a'; g.strokeStyle = '#4a2a10';
      g.beginPath();
      g.moveTo(-s, -0.7 * s);
      g.quadraticCurveTo(0.1 * s, -0.25 * s, 0.35 * s, 0);
      g.quadraticCurveTo(0.1 * s, 0.25 * s, -s, 0.7 * s);
      g.quadraticCurveTo(-0.15 * s, 0.05 * s, -s, -0.7 * s);
      g.fill(); g.stroke();
      g.strokeStyle = col; g.lineWidth = 0.06;
      g.beginPath(); g.moveTo(-0.6 * s, -0.4 * s); g.lineTo(-0.35 * s, -0.25 * s); g.moveTo(-0.6 * s, 0.4 * s); g.lineTo(-0.35 * s, 0.25 * s); g.stroke();
      return;
    case 'book': {
      const open = 0.25 + Math.abs(Math.sin(time * 9)) * 0.55;
      glowAt(g, col, 0, 0, s * 1.4, 0.6);
      for (const side of [-1, 1]) {
        g.fillStyle = '#6a3a9a';
        poly(g, [0, -0.6 * s, side * 0.75 * s, -0.6 * s * open - 0.1 * s, side * 0.75 * s, 0.6 * s - 0.4 * s * open, 0, 0.6 * s]);
        g.fill(); g.stroke();
        g.fillStyle = '#fff6dc';
        poly(g, [0, -0.5 * s, side * 0.62 * s, -0.5 * s * open - 0.05 * s, side * 0.62 * s, 0.5 * s - 0.35 * s * open, 0, 0.5 * s]);
        g.fill();
      }
      g.fillStyle = '#ffd84a'; g.fillRect(-0.04 * s, -0.6 * s, 0.08 * s, 1.2 * s);
      return;
    }
    case 'mace':
      g.fillStyle = '#8a5a2a'; g.fillRect(-s, -0.08 * s, 1.3 * s, 0.16 * s);
      g.fillStyle = col;
      g.save(); g.translate(0.55 * s, 0);
      star(g, 8, 0.5 * s, 0.32 * s); g.fill(); g.stroke();
      g.restore();
      glowAt(g, '#fff3b0', 0.55 * s, 0, 0.6 * s, 0.5);
      return;
    case 'star':
      g.fillStyle = '#c9ccd8';
      star(g, 4, 0.9 * s, 0.28 * s); g.fill(); g.stroke();
      g.fillStyle = col;
      g.beginPath(); g.arc(0, 0, 0.14 * s, 0, TAU); g.fill();
      return;
    case 'snowball':
      g.fillStyle = '#ffffff'; g.strokeStyle = '#7fb0d8';
      g.beginPath(); g.arc(0, 0, 0.6 * s, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(127,176,216,0.45)';
      g.beginPath(); g.arc(0.12 * s, 0.12 * s, 0.45 * s, 0, TAU); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(-0.05 * s, -0.05 * s, 0.4 * s, 0, TAU); g.fill();
      return;
    case 'arrow':
      g.strokeStyle = col; g.lineWidth = 0.14;
      g.globalAlpha *= 0.5;
      g.globalCompositeOperation = 'lighter';
      g.beginPath(); g.moveTo(-1.1 * s * 2, 0); g.lineTo(0, 0); g.stroke();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha *= 2;
      g.strokeStyle = '#8a5a2a'; g.lineWidth = 0.06;
      g.beginPath(); g.moveTo(-1.2 * s, 0); g.lineTo(0, 0); g.stroke();
      g.fillStyle = '#e8eef2';
      poly(g, [0.4 * s, 0, 0, -0.2 * s, 0, 0.2 * s]); g.fill();
      return;
    case 'spark': {
      const tw = 1 + Math.sin(time * 25 + s * 7) * 0.25;
      glowAt(g, col, 0, 0, s * 1.4, 1);
      g.fillStyle = '#ffffff';
      star(g, 4, 0.7 * s * tw, 0.18 * s, time * 4); g.fill();
      return;
    }
    case 'spear':
      g.strokeStyle = '#7a4a22'; g.lineWidth = 0.08;
      g.beginPath(); g.moveTo(-1.6 * s, 0); g.lineTo(0.5 * s, 0); g.stroke();
      g.fillStyle = '#c8ccd6';
      poly(g, [s, 0, 0.4 * s, -0.18 * s, 0.4 * s, 0.18 * s]); g.fill(); g.stroke();
      g.fillStyle = col; g.fillRect(-1.6 * s, -0.12 * s, 0.25 * s, 0.24 * s);
      return;
    case 'lightdart':
      g.globalCompositeOperation = 'lighter';
      g.save(); g.scale(2.2, 0.6);
      g.drawImage(glowSprite(col) as CanvasImageSource, -0.6 * s, -0.6 * s, 1.2 * s, 1.2 * s);
      g.restore();
      g.strokeStyle = '#fffbe6'; g.lineWidth = 0.1 * s + 0.02;
      g.beginPath(); g.moveTo(-1.1 * s, 0); g.lineTo(0.9 * s, 0); g.stroke();
      g.globalCompositeOperation = 'source-over';
      return;
    case 'knife':
      g.fillStyle = '#e8ecf4';
      poly(g, [-0.2 * s, -0.14 * s, 0.6 * s, -0.12 * s, 0.95 * s, 0, 0.6 * s, 0.1 * s, -0.2 * s, 0.1 * s]);
      g.fill(); g.stroke();
      g.fillStyle = '#2a2235'; g.fillRect(-0.75 * s, -0.1 * s, 0.55 * s, 0.2 * s);
      g.fillStyle = col; g.fillRect(-0.25 * s, -0.22 * s, 0.07 * s, 0.44 * s);
      return;
    case 'bolt':
      glowAt(g, '#bfe6ff', 0, 0, s * 1.2, 0.8);
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.12 * s + 0.03;
      g.beginPath(); g.moveTo(-s, -0.2 * s); g.lineTo(-0.2 * s, 0.25 * s); g.lineTo(0.1 * s, -0.2 * s); g.lineTo(s, 0.2 * s); g.stroke();
      return;
    case 'wasp': {
      const buzz = Math.sin(time * 60 + s * 13) * 0.25;
      g.fillStyle = 'rgba(230,245,255,0.8)';
      g.beginPath(); g.ellipse(-0.05 * s, -0.42 * s, 0.35 * s, (0.18 + buzz * 0.1) * s, -0.5, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(-0.05 * s, 0.42 * s, 0.35 * s, (0.18 - buzz * 0.1) * s, 0.5, 0, TAU); g.fill();
      g.fillStyle = '#ffd21f';
      g.beginPath(); g.ellipse(0, 0, 0.75 * s, 0.38 * s, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#1e1a22';
      g.fillRect(-0.3 * s, -0.36 * s, 0.17 * s, 0.72 * s);
      g.fillRect(0.05 * s, -0.36 * s, 0.17 * s, 0.72 * s);
      poly(g, [-0.7 * s, -0.08 * s, -s, 0, -0.7 * s, 0.08 * s]); g.fill();
      g.beginPath(); g.arc(0.6 * s, 0, 0.2 * s, 0, TAU); g.fill();
      return;
    }
    case 'slash':
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#1a1024'; g.lineWidth = 0.3 * s + 0.04;
      g.beginPath(); g.arc(-0.6 * s, 0, s, -0.9, 0.9); g.stroke();
      g.strokeStyle = col; g.lineWidth = 0.1 * s + 0.02;
      g.beginPath(); g.arc(-0.6 * s, 0, s, -0.9, 0.9); g.stroke();
      return;
    case 'thorn':
      g.fillStyle = '#6a4a2a';
      poly(g, [-0.6 * s, -0.3 * s, s, 0, -0.6 * s, 0.3 * s]); g.fill(); g.stroke();
      g.fillStyle = col;
      g.beginPath(); g.ellipse(-0.5 * s, -0.35 * s, 0.3 * s, 0.14 * s, -0.5, 0, TAU); g.fill();
      return;
    case 'caltrop':
      g.fillStyle = '#9a9cab';
      star(g, 4, 0.75 * s, 0.2 * s, Math.PI / 4); g.fill(); g.stroke();
      g.fillStyle = '#d9dbe6';
      star(g, 4, 0.45 * s, 0.15 * s); g.fill();
      return;
    case 'snowflake':
      glowAt(g, '#cfeeff', 0, 0, s * 1.1, 0.6);
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.08 * s + 0.02;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const cx = Math.cos(a), cy = Math.sin(a);
        g.moveTo(0, 0); g.lineTo(cx * 0.8 * s, cy * 0.8 * s);
        g.moveTo(cx * 0.45 * s, cy * 0.45 * s); g.lineTo(cx * 0.45 * s + Math.cos(a + 0.8) * 0.25 * s, cy * 0.45 * s + Math.sin(a + 0.8) * 0.25 * s);
        g.moveTo(cx * 0.45 * s, cy * 0.45 * s); g.lineTo(cx * 0.45 * s + Math.cos(a - 0.8) * 0.25 * s, cy * 0.45 * s + Math.sin(a - 0.8) * 0.25 * s);
      }
      g.stroke();
      return;
    case 'note':
      glowAt(g, col, 0, 0, s * 1.2, 0.6);
      g.fillStyle = col; g.strokeStyle = INK;
      g.beginPath(); g.ellipse(-0.3 * s, 0.4 * s, 0.32 * s, 0.22 * s, -0.4, 0, TAU); g.fill(); g.stroke();
      g.fillRect(-0.02 * s, -0.7 * s, 0.1 * s, 1.1 * s);
      poly(g, [0.08 * s, -0.7 * s, 0.6 * s, -0.4 * s, 0.08 * s, -0.35 * s]); g.fill();
      return;
    case 'none':
      return;
  }
}

/** A flying shot: the token turned the way it flies (or tumbling), with a little trail now and then. */
export function drawShotToken(g: G, fx: Fx, k: Token, x: number, y: number, vx: number, vy: number, s: number, col: string, time: number, id: number): void {
  const spin = SPIN[k];
  const ang = spin !== undefined ? time * spin + id : Math.atan2(vy, vx);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  drawToken(g, k, s, col, time);
  g.restore();
  if (fx.low || Math.random() > 0.45) return;
  const bx = -vx * 0.05, by = -vy * 0.05;
  switch (k) {
    case 'fireball': fx.add('puff', x, y, { life: 0.3, size: s * 0.36, grow: 0.4, c: '#ff7a2a', vx: bx, vy: by }); break;
    case 'flame': fx.add('puff', x, y, { life: 0.35, size: s * 0.6, grow: 1.4, c: Math.random() < 0.5 ? '#ff8a2a' : '#ffd36b', vx: bx, vy: by, add: true }); break;
    case 'bomb': case 'lavarock': fx.add('puff', x, y, { life: 0.5, size: s * 0.35, grow: 0.6, c: '#5a5560', vx: bx, vy: by - 0.5 }); break;
    case 'icebolt': case 'snowball': case 'shard': fx.add('spark', x, y, { life: 0.35, size: 0.06, c: '#e8f8ff', vx: bx + (Math.random() - 0.5) * 2, vy: by + (Math.random() - 0.5) * 2, add: true }); break;
    case 'spark': case 'lightdart': case 'orb': fx.add('spark', x, y, { life: 0.3, size: 0.07, c: col, vx: bx + (Math.random() - 0.5) * 3, vy: by + (Math.random() - 0.5) * 3, add: true }); break;
    case 'hawk': if (Math.random() < 0.2) fx.add('shard', x, y, { life: 0.5, size: 0.08, c: '#b07a42', vx: bx, vy: by + 1, rot: Math.random() * 6, vr: 6 }); break;
    case 'boulder': if (Math.random() < 0.3) fx.add('puff', x, y, { life: 0.4, size: s * 0.3, grow: 0.5, c: '#a8977a', vx: bx, vy: by }); break;
    default: break;
  }
}

// ---------------------------------------------------------------- strikes ("lightning") and bursts

/** A timed strike picture: wasps swarming, a sunbeam, spikes rising, ... */
export interface Strike { style: Style; x: number; y: number; r: number; age: number; life: number; c: string; pts: number[]; hx: number; hy: number }

const strikeLife: Record<Style, number> = { plain: 0.22, knight: 0.22, ranger: 0.45, wizard: 0.32, barbarian: 0.45, cleric: 0.45, rogue: 0.3, witch: 0.55, dragonkid: 0.6 };

/** A "lightning" strike at (x, y) in the hero's own way: starts the picture and its particles. */
export function startStrike(fx: Fx, list: Strike[], style: Style, x: number, y: number, r: number, c: Colours, hx: number, hy: number): void {
  const pts: number[] = [];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  switch (style) {
    case 'ranger':
      // Five wasps: where each starts round the monster, and how it wiggles.
      for (let i = 0; i < 5; i++) pts.push(rnd(0, TAU), rnd(1.8, 3), rnd(0, TAU));
      fx.sparks(x, y, 6, '#ffd21f', 4, 0.07);
      break;
    case 'wizard':
      // Three missiles from the hero, each bending a different way.
      for (let i = 0; i < 3; i++) pts.push((i - 1) * rnd(1.5, 3));
      fx.ring(x, y, 0.1, r * 1.1, 0.3, c.main);
      fx.sparks(x, y, 10, '#e8d8ff', 6);
      break;
    case 'barbarian':
      // Cracks out from the stomp.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rnd(-0.3, 0.3);
        let px = x, py = y;
        pts.push(NaN, NaN, px, py);
        for (let j = 1; j <= 3; j++) {
          const d = (r * 1.2 * j) / 3;
          px = x + Math.cos(a + rnd(-0.35, 0.35)) * d;
          py = y + Math.sin(a + rnd(-0.35, 0.35)) * d * 0.7;
          pts.push(px, py);
        }
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        fx.add('puff', x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.35, { life: 0.55, size: 0.3, grow: 0.9, drag: 3, c: '#b39a74', vx: Math.cos(a) * 3, vy: Math.sin(a) * 2 - 0.5 });
      }
      for (let i = 0; i < 5; i++) fx.add('shard', x, y, { life: 0.5, size: 0.11, c: '#7a6a58', vx: rnd(-3, 3), vy: rnd(-6, -3), rot: rnd(0, 6), vr: 10, drag: 1 });
      break;
    case 'cleric':
      fx.glow(x, y, r * 0.5, r * 2, 0.35, '#fff3b0');
      for (let i = 0; i < 8; i++) fx.add('spark', x + rnd(-r, r) * 0.6, y + rnd(-0.2, 0.3), { life: rnd(0.4, 0.7), size: 0.08, drag: 0.5, vy: -rnd(3, 6), c: i % 2 ? '#ffffff' : '#ffd84a', add: true });
      break;
    case 'rogue':
      pts.push(rnd(0, TAU));
      for (let i = 0; i < 4; i++) fx.add('puff', x + rnd(-0.4, 0.4), y + rnd(-0.4, 0.4), { life: 0.5, size: 0.35, grow: 0.8, drag: 2, c: '#2a1a3a', vx: rnd(-1.5, 1.5), vy: rnd(-1.5, 0.5) });
      fx.sparks(x, y, 5, '#c89aff', 6, 0.07);
      break;
    case 'witch':
      // Spikes: where, how tall, how wide.
      for (let i = 0; i < 6; i++) pts.push(x + rnd(-r, r) * 0.8, y + rnd(-r, r) * 0.45, rnd(0.7, 1.4) * Math.max(0.8, r), rnd(0.18, 0.3));
      for (let i = 0; i < 8; i++) fx.add('shard', x, y, { life: 0.45, size: 0.09, c: i % 2 ? '#ffffff' : '#bfe8ff', vx: rnd(-5, 5), vy: rnd(-6, 1), rot: rnd(0, 6), vr: 12, drag: 2 });
      break;
    case 'dragonkid':
      // Lava blobs: sideways speed, upward speed, size.
      for (let i = 0; i < 7; i++) pts.push(rnd(-2.4, 2.4), rnd(6, 10), rnd(0.12, 0.22));
      for (let i = 0; i < 4; i++) fx.add('puff', x + rnd(-0.4, 0.4), y - 0.3, { life: 0.8, size: 0.3, grow: 1, drag: 1, c: '#4a3a3a', vx: rnd(-0.6, 0.6), vy: -rnd(1.5, 3) });
      fx.glow(x, y, r * 0.5, r * 2, 0.4, '#ff6a1a');
      break;
    default: {
      let px = x + (Math.random() - 0.5) * 2;
      let py = y - 9;
      pts.push(px, py);
      for (let i = 1; i <= 8; i++) {
        px = x + (Math.random() - 0.5) * (1.6 - i * 0.18) * 1.6;
        py = y - 9 + (i * 9) / 8;
        pts.push(i === 8 ? x : px, i === 8 ? y : py);
      }
      fx.glow(x, y, r * 0.8, r * 2.5, 0.25, '#bfe6ff');
      fx.sparks(x, y, 10, '#fff9b0', 8);
    }
  }
  list.push({ style, x, y, r, age: 0, life: strikeLife[style], c: c.main, pts, hx, hy });
  if (list.length > 40) list.shift();
}

/** A shot bursting (the hero's "fireball"): dust for a boulder, smoke for a smoke bomb, frost for ice, ... */
export function burst(fx: Fx, style: Style, x: number, y: number, r: number, c: Colours): boolean {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  switch (style) {
    case 'ranger':
      fx.ring(x, y, r * 0.2, r, 0.25, '#e8d8b0');
      for (let i = 0; i < 8; i++) fx.add('shard', x, y, { life: 0.6, size: 0.1, c: i % 2 ? '#8a5a32' : '#f2e6d0', vx: rnd(-4, 4), vy: rnd(-4, 2), rot: rnd(0, 6), vr: rnd(-6, 6), drag: 3 });
      return true;
    case 'barbarian':
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        fx.add('puff', x, y, { life: 0.6, size: 0.35, grow: r, drag: 3, c: '#a8977a', vx: Math.cos(a) * 4, vy: Math.sin(a) * 3 });
      }
      for (let i = 0; i < 6; i++) fx.add('shard', x, y, { life: 0.55, size: 0.16, c: '#8f887c', vx: rnd(-5, 5), vy: rnd(-6, 2), rot: rnd(0, 6), vr: 8, drag: 2 });
      return true;
    case 'cleric':
      fx.ring(x, y, 0.2, r * 1.2, 0.35, c.main);
      fx.ring(x, y, 0.1, r * 0.8, 0.4, '#ffffff');
      fx.glow(x, y, r * 0.6, r * 2.5, 0.35, '#fff3b0');
      fx.sparks(x, y, 10, '#fffbe6', 6);
      return true;
    case 'rogue':
      for (let i = 0; i < 9; i++) {
        const a = rnd(0, TAU), sp = rnd(1, 3.5);
        fx.add('puff', x, y, { life: rnd(0.7, 1.1), size: 0.4, grow: r * 0.9, drag: 2.5, c: i % 3 ? '#5a5466' : '#3a2a4a', vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4 });
      }
      fx.glow(x, y, 0.3, r * 1.5, 0.15, '#ffd23a');
      return true;
    case 'witch':
      fx.ring(x, y, 0.2, r * 1.1, 0.35, '#e8f8ff');
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        fx.add('shard', x, y, { life: 0.45, size: 0.12, c: i % 2 ? '#ffffff' : '#9fdcff', vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, rot: a, drag: 3 });
      }
      fx.glow(x, y, r * 0.5, r * 2, 0.3, '#bfe8ff');
      return true;
    default:
      return false;
  }
}

/** Draws the strike pictures (wasps, missiles, beams, spikes, lava). */
export function drawStrikes(g: G, list: Strike[], time: number): void {
  for (const b of list) {
    const t = b.age / b.life;
    const a = 1 - t;
    const { x, y, r } = b;
    switch (b.style) {
      case 'ranger':
        for (let i = 0; i < b.pts.length; i += 3) {
          const start = b.pts[i], dist = b.pts[i + 1], wig = b.pts[i + 2];
          // In fast, buzz round the monster, then off.
          const d = t < 0.4 ? dist * (1 - t / 0.4) + 0.35 : 0.35 + (t - 0.4) * 1.2;
          const ang = start + t * 7 + Math.sin(time * 20 + wig) * 0.4;
          const wx = x + Math.cos(ang) * d;
          const wy = y + Math.sin(ang) * d * 0.8 + Math.sin(time * 30 + wig) * 0.08;
          g.globalAlpha = t > 0.75 ? (1 - t) * 4 : 1;
          g.save(); g.translate(wx, wy); g.rotate(ang + Math.PI / 2);
          drawToken(g, 'wasp', 0.22, '#ffd21f', time + i);
          g.restore();
        }
        break;
      case 'wizard':
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < b.pts.length; i++) {
          const bend = b.pts[i];
          const f = Math.min(1, t / 0.55);
          const mx = (b.hx + x) / 2 - (y - b.hy) * 0.15 * bend;
          const my = (b.hy + y) / 2 + (x - b.hx) * 0.15 * bend;
          const at = (u: number): [number, number] => [(1 - u) * (1 - u) * b.hx + 2 * (1 - u) * u * mx + u * u * x, (1 - u) * (1 - u) * b.hy + 2 * (1 - u) * u * my + u * u * y];
          g.globalAlpha = a;
          g.strokeStyle = b.c; g.lineWidth = 0.14;
          g.beginPath();
          for (let k = 0; k <= 8; k++) { const [px, py] = at(Math.max(0, f - 0.35) + (k / 8) * Math.min(f, 0.35)); if (k) g.lineTo(px, py); else g.moveTo(px, py); }
          g.stroke();
          const [hx, hy] = at(f);
          g.save(); g.translate(hx, hy);
          drawToken(g, 'spark', 0.3, b.c, time);
          g.restore();
        }
        g.globalCompositeOperation = 'source-over';
        break;
      case 'barbarian': {
        g.globalAlpha = a;
        g.strokeStyle = '#2a1a0e'; g.lineWidth = 0.14 * a + 0.04;
        g.beginPath();
        for (let i = 0; i < b.pts.length; i += 2) {
          if (Number.isNaN(b.pts[i])) { g.moveTo(b.pts[i + 2], b.pts[i + 3]); i += 2; continue; }
          g.lineTo(b.pts[i], b.pts[i + 1]);
        }
        g.stroke();
        g.strokeStyle = '#ffb04a'; g.lineWidth = 0.04;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = a * 0.6;
        g.stroke();
        g.globalCompositeOperation = 'source-over';
        // A dusty shock ring along the ground.
        g.globalAlpha = a * 0.7;
        g.strokeStyle = '#d9c29a'; g.lineWidth = 0.2 * a;
        g.beginPath(); g.ellipse(x, y, r * (0.4 + t * 1.1), r * (0.28 + t * 0.75), 0, 0, TAU); g.stroke();
        break;
      }
      case 'cleric': {
        const grow = Math.min(1, t / 0.2);
        const wdt = r * (0.55 + 0.25 * Math.sin(time * 12)) * grow;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = a * 0.75;
        g.save(); g.translate(x, y - 6); g.scale(wdt / 0.5, 6.5);
        g.drawImage(glowSprite('#ffd84a') as CanvasImageSource, -0.5, -1, 1, 2);
        g.restore();
        g.globalAlpha = a;
        g.save(); g.translate(x, y - 5); g.scale(wdt / 1.4, 6);
        g.drawImage(glowSprite('#fffbe6') as CanvasImageSource, -0.5, -1, 1, 2);
        g.restore();
        g.globalAlpha = a * 0.9;
        g.save(); g.translate(x, y); g.scale(1, 0.4);
        g.drawImage(glowSprite('#fff3b0') as CanvasImageSource, -r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
        g.restore();
        g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'rogue': {
        const f = Math.min(1, t / 0.3);
        g.globalAlpha = a;
        for (const turn of [0, Math.PI / 2]) {
          g.save(); g.translate(x, y); g.rotate(b.pts[0] + turn);
          g.strokeStyle = '#120a1c'; g.lineWidth = 0.26;
          g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(-r * 0.9 + r * 1.8 * f, 0); g.stroke();
          g.strokeStyle = '#c89aff'; g.lineWidth = 0.07;
          g.globalCompositeOperation = 'lighter';
          g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(-r * 0.9 + r * 1.8 * f, 0); g.stroke();
          g.globalCompositeOperation = 'source-over';
          g.restore();
        }
        break;
      }
      case 'witch':
        for (let i = 0; i < b.pts.length; i += 4) {
          const sx = b.pts[i], sy = b.pts[i + 1], tall = b.pts[i + 2], wide = b.pts[i + 3];
          const up = t < 0.15 ? t / 0.15 : t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
          const hgt = tall * up;
          g.globalAlpha = 1;
          const ice = fxPic('icespike');
          if (ice) {
            if (hgt < 0.02) continue;
            const w2 = (ice.naturalWidth / ice.naturalHeight) * tall;
            g.save(); g.beginPath(); g.rect(sx - w2, sy - hgt - 0.1, w2 * 2, hgt + 0.15); g.clip();
            g.drawImage(ice, sx - w2 / 2, sy - hgt, w2, tall);
            g.restore();
            continue;
          }
          g.fillStyle = '#dff4ff'; g.strokeStyle = '#3f8fc8'; g.lineWidth = 0.04;
          poly(g, [sx - wide, sy, sx, sy - hgt, sx + wide, sy]);
          g.fill(); g.stroke();
          g.fillStyle = 'rgba(127,200,255,0.6)';
          poly(g, [sx, sy, sx, sy - hgt, sx + wide, sy]); g.fill();
        }
        break;
      case 'dragonkid': {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = a;
        g.save(); g.translate(x, y); g.scale(1, 0.45);
        g.drawImage(glowSprite('#ff5a1a') as CanvasImageSource, -r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
        g.drawImage(glowSprite('#ffd36b') as CanvasImageSource, -r * 0.5, -r * 0.5, r, r);
        g.restore();
        g.globalCompositeOperation = 'source-over';
        const ft = b.age;
        for (let i = 0; i < b.pts.length; i += 3) {
          const bx = x + b.pts[i] * ft;
          const by = y - b.pts[i + 1] * ft + 22 * ft * ft;
          if (by > y + 0.2) continue;
          g.globalAlpha = 1;
          glowAt(g, '#ff7a1a', bx, by, b.pts[i + 2] * 3, 0.8);
          const blob = fxPic('lavablob');
          if (blob) { g.save(); g.translate(bx, by); g.rotate(ft * 8 + i); drawPic(g, blob, b.pts[i + 2] * 3); g.restore(); continue; }
          g.fillStyle = '#ffd36b';
          g.beginPath(); g.arc(bx, by, b.pts[i + 2], 0, TAU); g.fill();
        }
        break;
      }
      default: {
        g.globalCompositeOperation = 'lighter';
        for (const [width, col] of [[0.35, '#7fbfff'], [0.12, '#ffffff']] as const) {
          g.globalAlpha = a;
          g.strokeStyle = col;
          g.lineWidth = width;
          g.beginPath();
          g.moveTo(b.pts[0], b.pts[1]);
          for (let i = 2; i < b.pts.length; i += 2) g.lineTo(b.pts[i], b.pts[i + 1]);
          g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
      }
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- nova rings

export interface Wave { style: Style; x: number; y: number; r: number; age: number; life: number; c: Colours }

/** A nova pulse in the hero's own way. Returns false for the plain look (the caller draws that). */
export function startWave(fx: Fx, list: Wave[], style: Style, x: number, y: number, r: number, c: Colours): boolean {
  if (style === 'plain' || style === 'knight' || style === 'witch') return false;
  list.push({ style, x, y, r, age: 0, life: 0.55, c });
  if (list.length > 12) list.shift();
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  if (style === 'ranger') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      fx.add('shard', x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, { life: 0.5, size: 0.12, c: i % 2 ? '#5fd35a' : '#2f8a3a', vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, rot: a, vr: 6, drag: 2 });
    }
  } else if (style === 'barbarian') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      fx.add('puff', x + Math.cos(a) * 0.8, y + Math.sin(a) * 0.6, { life: 0.5, size: 0.3, grow: 1, drag: 2.5, c: '#b39a74', vx: Math.cos(a) * 6, vy: Math.sin(a) * 4 });
    }
  } else if (style === 'cleric') {
    fx.glow(x, y, r * 0.3, r * 1.2, 0.4, '#fff3b0');
  } else if (style === 'dragonkid') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + rnd(-0.2, 0.2);
      fx.add('puff', x + Math.cos(a) * 0.7, y + Math.sin(a) * 0.7, { life: 0.8, size: 0.4, grow: 1.2, drag: 1.8, c: i % 2 ? '#6a6068' : '#4a4048', vx: Math.cos(a) * 7, vy: Math.sin(a) * 7 - 0.5 });
    }
  } else if (style === 'rogue') {
    fx.sparks(x, y, 8, '#e8e8f0', 5, 0.06);
  }
  return true;
}

export function drawWaves(g: G, list: Wave[], time: number): void {
  for (const w of list) {
    const t = w.age / w.life;
    const a = 1 - t;
    const R = w.r * (0.15 + t * 0.85);
    const { x, y, c } = w;
    g.globalAlpha = a;
    g.lineJoin = 'round';
    switch (w.style) {
      case 'ranger': {
        // A wavy ring of vine with leaves along it.
        g.strokeStyle = '#3f8a2a'; g.lineWidth = 0.18;
        g.beginPath();
        for (let i = 0; i <= 64; i++) {
          const ang = (i / 64) * TAU;
          const rr = R + Math.sin(ang * 9 + time * 6) * 0.18;
          if (i) g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); else g.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        g.stroke();
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * TAU + t;
          g.save(); g.translate(x + Math.cos(ang) * R, y + Math.sin(ang) * R); g.rotate(ang + 1);
          drawToken(g, 'leaf', 0.22, c.main, time);
          g.restore();
        }
        break;
      }
      case 'wizard': {
        // A clock face of time magic, hands spinning back.
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = c.main; g.lineWidth = 0.12;
        g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke();
        g.strokeStyle = c.glow; g.lineWidth = 0.05;
        g.beginPath(); g.arc(x, y, R * 0.82, 0, TAU); g.stroke();
        g.lineWidth = 0.1; g.strokeStyle = '#ffffff';
        g.beginPath();
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * TAU;
          g.moveTo(x + Math.cos(ang) * R * 0.86, y + Math.sin(ang) * R * 0.86);
          g.lineTo(x + Math.cos(ang) * R * (i % 3 ? 0.94 : 1.02), y + Math.sin(ang) * R * (i % 3 ? 0.94 : 1.02));
        }
        const h1 = -t * TAU * 1.5, h2 = -t * TAU * 0.4;
        g.moveTo(x, y); g.lineTo(x + Math.cos(h1) * R * 0.7, y + Math.sin(h1) * R * 0.7);
        g.moveTo(x, y); g.lineTo(x + Math.cos(h2) * R * 0.45, y + Math.sin(h2) * R * 0.45);
        g.stroke();
        g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'barbarian': {
        // Shout arcs: thick broken rings, one after another.
        g.strokeStyle = '#ff6a2a'; g.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const rr = R - k * 0.6;
          if (rr <= 0.3) continue;
          g.lineWidth = 0.22 - k * 0.05;
          for (let i = 0; i < 8; i++) {
            const a0 = (i / 8) * TAU + 0.12;
            g.beginPath(); g.arc(x, y, rr, a0, a0 + TAU / 8 - 0.24); g.stroke();
          }
        }
        g.lineCap = 'butt';
        break;
      }
      case 'cleric': {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = '#ffd84a'; g.lineWidth = 0.16;
        g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke();
        g.strokeStyle = '#fffbe6'; g.lineWidth = 0.07;
        g.beginPath(); g.arc(x, y, R * 0.88, 0, TAU); g.stroke();
        g.globalCompositeOperation = 'source-over';
        // The bell over the hero, swinging, and notes riding the ring.
        const sw = Math.sin(time * 14) * 0.4 * a;
        g.save(); g.translate(x, y - 1.3); g.rotate(sw);
        const bell = fxPic('bell');
        if (bell) { glowAt(g, '#fff3b0', 0, 0, 0.9, 0.8); drawPic(g, bell, 1.1); g.restore(); }
        else {
        g.fillStyle = '#ffcf3a'; g.strokeStyle = INK; g.lineWidth = 0.04;
        g.beginPath();
        g.moveTo(-0.12, -0.45); g.quadraticCurveTo(-0.32, -0.4, -0.34, 0); g.lineTo(-0.45, 0.18); g.lineTo(0.45, 0.18); g.lineTo(0.34, 0); g.quadraticCurveTo(0.32, -0.4, 0.12, -0.45); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = '#a07a10'; g.beginPath(); g.arc(0, 0.24, 0.08, 0, TAU); g.fill();
        g.restore();
        }
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * TAU + 0.6;
          g.save(); g.translate(x + Math.cos(ang) * R, y + Math.sin(ang) * R);
          drawToken(g, 'note', 0.25, '#ffd84a', time);
          g.restore();
        }
        break;
      }
      case 'rogue': {
        // A net: spokes and rings flung out.
        g.strokeStyle = '#e8e4d8'; g.lineWidth = 0.05;
        g.beginPath();
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * TAU;
          g.moveTo(x + Math.cos(ang) * R * 0.2, y + Math.sin(ang) * R * 0.2);
          g.lineTo(x + Math.cos(ang) * R, y + Math.sin(ang) * R);
        }
        for (const f of [0.4, 0.7, 1]) {
          for (let i = 0; i <= 14; i++) {
            const ang = (i / 14) * TAU;
            const rr = R * f * (i % 2 ? 0.96 : 1);
            if (i) g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); else g.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
          }
        }
        g.stroke();
        g.fillStyle = '#9a9cab';
        for (let i = 0; i < 14; i += 2) {
          const ang = (i / 14) * TAU;
          g.beginPath(); g.arc(x + Math.cos(ang) * R, y + Math.sin(ang) * R, 0.09, 0, TAU); g.fill();
        }
        break;
      }
      case 'dragonkid': {
        // A thick smoke ring.
        g.strokeStyle = 'rgba(70,62,70,0.7)'; g.lineWidth = 0.7 * a + 0.1;
        g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(140,130,138,0.6)'; g.lineWidth = 0.25 * a + 0.05;
        g.beginPath(); g.arc(x, y, R - 0.15, 0, TAU); g.stroke();
        glowAt(g, '#ff6a1a', x, y, R * 0.5, 0.25 * a);
        break;
      }
      default:
        break;
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- the aura round the hero

/** Draws the hero's aura in their own way. Returns false for the plain look (the caller draws that). */
export function drawAuraStyle(g: G, fx: Fx, style: Style, x: number, y: number, r: number, c: Colours, evolved: boolean, time: number): boolean {
  const col = evolved ? c.evolved : c.main;
  switch (style) {
    case 'ranger': {
      // A ring of thorny bramble.
      g.globalAlpha = 0.18;
      glowAt(g, '#5fd35a', x, y, r * 1.1, 1);
      g.globalAlpha = 0.9;
      g.strokeStyle = '#5a3a1a'; g.lineWidth = 0.12;
      for (const off of [0, Math.PI]) {
        g.beginPath();
        for (let i = 0; i <= 72; i++) {
          const ang = (i / 72) * TAU;
          const rr = r + Math.sin(ang * 7 + off + time * 0.8) * 0.12;
          if (i) g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); else g.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        g.stroke();
      }
      const n = evolved ? 24 : 16;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + time * 0.15;
        g.save(); g.translate(x + Math.cos(ang) * r, y + Math.sin(ang) * r); g.rotate(ang + (i % 2 ? 0.4 : -0.4));
        drawToken(g, 'thorn', 0.2, i % 3 ? '#5fd35a' : col, time);
        g.restore();
      }
      break;
    }
    case 'wizard': {
      // A turning circle of runes with a star inside.
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.25;
      g.drawImage(glowSprite(col) as CanvasImageSource, x - r * 1.1, y - r * 1.1, r * 2.2, r * 2.2);
      g.globalAlpha = 0.75;
      g.strokeStyle = col; g.lineWidth = 0.08;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      g.beginPath(); g.arc(x, y, r * 0.86, 0, TAU); g.stroke();
      g.save(); g.translate(x, y); g.rotate(-time * 0.6);
      g.strokeStyle = c.glow; g.lineWidth = 0.05;
      star(g, 5, r * 0.84, r * 0.34); g.stroke();
      g.restore();
      g.globalCompositeOperation = 'source-over';
      const n = evolved ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + time * 0.5;
        g.save(); g.translate(x + Math.cos(ang) * r * 0.93, y + Math.sin(ang) * r * 0.93); g.rotate(ang);
        g.globalAlpha = 0.9;
        drawToken(g, 'rune', 0.16, col, time);
        g.restore();
      }
      break;
    }
    case 'barbarian': {
      // Red flames of fury licking up all round.
      g.globalAlpha = 0.3;
      glowAt(g, '#e2552b', x, y, r * 1.1, 1);
      g.globalCompositeOperation = 'lighter';
      const n = evolved ? 26 : 18;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU;
        const fl = 0.6 + Math.abs(Math.sin(time * 9 + i * 2.3)) * 0.6;
        const fx0 = x + Math.cos(ang) * r, fy0 = y + Math.sin(ang) * r;
        g.globalAlpha = 0.7;
        g.save(); g.translate(fx0, fy0); g.scale(0.55, fl);
        g.drawImage(glowSprite(i % 2 ? '#ff4a1a' : col) as CanvasImageSource, -0.5, -0.9, 1, 1.2);
        g.restore();
      }
      g.globalCompositeOperation = 'source-over';
      if (!fx.low && Math.random() < 0.3) {
        const ang = Math.random() * TAU;
        fx.add('spark', x + Math.cos(ang) * r, y + Math.sin(ang) * r, { vy: -3, life: 0.5, size: 0.08, c: '#ffb02e', add: true });
      }
      break;
    }
    case 'rogue': {
      // Caltrops scattered on the ground, turning slowly with the hero.
      g.globalAlpha = 0.25;
      g.strokeStyle = '#8a5ad0'; g.lineWidth = 0.05; g.setLineDash([0.25, 0.2]);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      const n = evolved ? 22 : 14;
      for (let i = 0; i < n; i++) {
        const ang = i * 2.399 + time * 0.25;
        const d = r * (0.35 + ((i * 0.618) % 1) * 0.6);
        g.save(); g.translate(x + Math.cos(ang) * d, y + Math.sin(ang) * d); g.rotate(i + time * 0.5);
        drawToken(g, 'caltrop', 0.17, col, time);
        g.restore();
      }
      break;
    }
    case 'witch': {
      // A frosty circle with snowflakes drifting round.
      g.globalAlpha = 0.3;
      glowAt(g, '#bfe8ff', x, y, r * 1.1, 1);
      g.globalAlpha = 0.7;
      g.strokeStyle = '#e8f8ff'; g.lineWidth = 0.07;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      g.globalAlpha = 0.9;
      const n = evolved ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + time * 0.4;
        const d = r * (0.7 + Math.sin(time * 1.5 + i) * 0.2);
        g.save(); g.translate(x + Math.cos(ang) * d, y + Math.sin(ang) * d); g.rotate(time + i);
        drawToken(g, 'snowflake', 0.16 + (i % 3) * 0.04, col, time);
        g.restore();
      }
      break;
    }
    case 'dragonkid': {
      // Wavering hot air and rising embers.
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3;
      g.drawImage(glowSprite('#ff6a1a') as CanvasImageSource, x - r * 1.15, y - r * 1.15, r * 2.3, r * 2.3);
      g.globalAlpha = 0.6;
      g.strokeStyle = col; g.lineWidth = 0.1;
      for (const k of [1, 0.75]) {
        g.beginPath();
        for (let i = 0; i <= 60; i++) {
          const ang = (i / 60) * TAU;
          const rr = r * k + Math.sin(ang * 6 + time * 8 * k) * 0.15;
          if (i) g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); else g.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      if (!fx.low && Math.random() < (evolved ? 0.7 : 0.4)) {
        const ang = Math.random() * TAU, d = Math.random() * r;
        fx.add('spark', x + Math.cos(ang) * d, y + Math.sin(ang) * d, { vy: -2.5 - Math.random() * 2, life: 0.7, size: 0.08, drag: 0.5, c: Math.random() < 0.5 ? '#ffd36b' : '#ff6a1a', add: true });
      }
      break;
    }
    default:
      return false;
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return true;
}

// ---------------------------------------------------------------- the shield ("bubble")

/** Draws the hero's shield in their own way. Returns false for the plain bubble (the caller draws that). */
export function drawShieldStyle(g: G, style: Style, x: number, y: number, r: number, charges: number, c: Colours, evolved: boolean, time: number): boolean {
  const col = evolved ? c.evolved : c.main;
  g.lineJoin = 'round';
  switch (style) {
    case 'ranger': {
      // Bark plates in a ring.
      const n = 10;
      for (let k = 0; k < charges; k++) {
        const rr = r + k * 0.14;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * TAU + time * 0.2;
          g.globalAlpha = 0.9;
          g.strokeStyle = i % 2 ? '#7a5230' : '#5a3a1e'; g.lineWidth = 0.16;
          g.beginPath(); g.arc(x, y, rr, a0, a0 + TAU / n - 0.06); g.stroke();
        }
      }
      for (let i = 0; i < (evolved ? 8 : 4); i++) {
        const ang = (i / (evolved ? 8 : 4)) * TAU + time * 0.2;
        g.save(); g.translate(x + Math.cos(ang) * r, y + Math.sin(ang) * r); g.rotate(ang);
        drawToken(g, 'leaf', 0.18, col, time);
        g.restore();
      }
      break;
    }
    case 'wizard': {
      // A ring of glowing hexagons.
      g.globalAlpha = 0.18; g.fillStyle = c.glow;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.8; g.strokeStyle = col; g.lineWidth = 0.04;
      const n = 12;
      for (let k = 0; k < charges; k++) {
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * TAU + time * 0.3 * (k % 2 ? -1 : 1);
          const hx = x + Math.cos(ang) * (r + k * 0.14), hy = y + Math.sin(ang) * (r + k * 0.14);
          g.beginPath();
          for (let j = 0; j < 6; j++) { const q = (j / 6) * TAU + ang; const px = hx + Math.cos(q) * 0.2, py = hy + Math.sin(q) * 0.2; if (j) g.lineTo(px, py); else g.moveTo(px, py); }
          g.closePath(); g.stroke();
        }
      }
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'barbarian': {
      // A round wooden shield held out in front, one notch of iron per charge.
      g.globalAlpha = 0.2; g.strokeStyle = '#e2552b'; g.lineWidth = 0.06;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      g.globalAlpha = 1;
      const sx = x + 0.6, sy = y + 0.15 + Math.sin(time * 3) * 0.04;
      const sh = fxPic('shield');
      if (sh) {
        g.save(); g.translate(sx, sy); drawPic(g, sh, 1); g.restore();
        if (evolved) glowAt(g, col, sx, sy, 0.8, 0.5);
        for (let i = 1; i < charges; i++) { g.save(); g.translate(sx - 0.12 * i, sy - 0.08 * i); g.globalAlpha = 0.5; drawPic(g, sh, 0.9); g.restore(); }
        break;
      }
      g.fillStyle = '#8a5a2a'; g.strokeStyle = INK; g.lineWidth = 0.05;
      g.beginPath(); g.arc(sx, sy, 0.45, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = '#5a3a1a'; g.lineWidth = 0.03;
      g.beginPath(); for (const o of [-0.2, 0, 0.2]) { g.moveTo(sx + o, sy - 0.42); g.lineTo(sx + o, sy + 0.42); } g.stroke();
      g.strokeStyle = evolved ? col : '#9aa0ab'; g.lineWidth = 0.08;
      g.beginPath(); g.arc(sx, sy, 0.42, 0, TAU); g.stroke();
      g.fillStyle = evolved ? col : '#c8ccd6';
      g.beginPath(); g.arc(sx, sy, 0.13, 0, TAU); g.fill();
      for (let i = 0; i < charges; i++) { g.beginPath(); g.arc(sx + Math.cos(i * 2.1) * 0.3, sy + Math.sin(i * 2.1) * 0.3, 0.05, 0, TAU); g.fill(); }
      break;
    }
    case 'cleric': {
      // A shining gold ring with angel wings behind.
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3;
      g.drawImage(glowSprite('#fff3b0') as CanvasImageSource, x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
      g.globalAlpha = 0.9; g.strokeStyle = col; g.lineWidth = 0.07;
      for (let k = 0; k < charges; k++) { g.beginPath(); g.arc(x, y, r + k * 0.12, 0, TAU); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
      const flap = Math.sin(time * 4) * 0.12;
      const feather = fxPic('feather');
      if (feather) {
        g.globalAlpha = 0.95;
        for (const side of [-1, 1]) for (let f = 0; f < 4; f++) {
          g.save(); g.translate(x + side * (0.45 + f * 0.14), y - 0.2 + f * 0.1);
          g.rotate(side < 0 ? Math.PI - (0.5 + flap) - f * 0.3 : (0.5 + flap) + f * 0.3 - 0.9);
          drawPic(g, feather, 0.75 - f * 0.08);
          g.restore();
        }
        break;
      }
      for (const side of [-1, 1]) {
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.strokeStyle = 'rgba(200,170,60,0.9)'; g.lineWidth = 0.03;
        for (let f = 0; f < 3; f++) {
          g.beginPath();
          g.ellipse(x + side * (0.55 + f * 0.18), y - 0.25 + f * 0.12, 0.42 - f * 0.08, 0.14, side * (0.5 + flap) + f * side * 0.25, 0, TAU);
          g.fill(); g.stroke();
        }
      }
      break;
    }
    case 'rogue': {
      // A dark cloak of swirling shadow.
      for (let k = 0; k < 3; k++) {
        g.globalAlpha = 0.28;
        g.fillStyle = k % 2 ? '#2a1a3a' : '#120a1c';
        g.beginPath();
        for (let i = 0; i <= 36; i++) {
          const ang = (i / 36) * TAU;
          const rr = r + Math.sin(ang * 5 + time * (3 + k) + k) * 0.12;
          if (i) g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); else g.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        g.fill();
      }
      g.globalAlpha = 0.8; g.strokeStyle = col; g.lineWidth = 0.04;
      for (let k = 0; k < charges; k++) { g.beginPath(); g.arc(x, y, r + 0.05 + k * 0.1, time + k, time + k + 4); g.stroke(); }
      break;
    }
    case 'witch': {
      // A wall of ice crystals.
      g.globalAlpha = 0.2; g.fillStyle = '#bfe8ff';
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.globalAlpha = 0.9;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU;
        const tall = 0.35 + (i % 3) * 0.1 + (charges - 1) * 0.08;
        g.save(); g.translate(x + Math.cos(ang) * r, y + Math.sin(ang) * r); g.rotate(ang);
        g.fillStyle = '#e4f6ff'; g.strokeStyle = '#3f8fc8'; g.lineWidth = 0.03;
        poly(g, [-0.1, -0.13, tall, 0, -0.1, 0.13]); g.fill(); g.stroke();
        g.restore();
      }
      if (evolved) glowAt(g, col, x, y, r * 1.3, 0.25);
      break;
    }
    case 'dragonkid': {
      // Overlapping dragon scales all round.
      const n = 14;
      for (let k = 0; k < charges; k++) {
        const rr = r + k * 0.13;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * TAU + (k % 2 ? TAU / n / 2 : 0);
          g.globalAlpha = 0.95;
          const sc = fxPic('scale');
          if (sc) { g.save(); g.translate(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); g.rotate(ang + Math.PI / 2); drawPic(g, sc, 0.42); g.restore(); continue; }
          g.fillStyle = i % 2 ? '#e2452b' : '#c2341c';
          g.strokeStyle = evolved ? col : '#ffd36b'; g.lineWidth = 0.03;
          g.beginPath(); g.arc(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 0.17, ang - Math.PI / 2, ang + Math.PI / 2); g.closePath();
          g.fill(); g.stroke();
        }
      }
      break;
    }
    default:
      return false;
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return true;
}
