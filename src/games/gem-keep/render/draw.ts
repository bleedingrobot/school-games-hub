/**
 * Drawing Gem Keep on a canvas. Coordinates are logical pixels (TILE per tile); the engine scales the canvas.
 *
 * The painted Crystal Night pictures (../art.ts) are used when they're there: a board per level, and sprites
 * for towers, gems, enemies, rocks and the Keep. Anything missing is drawn in code (shapes and gradients),
 * as before. On a painted (night) board the gems also light the ground: soft pools of light drawn with
 * 'lighter' blending from pre-drawn gradients (never shadowBlur, which is slow on Chromebooks).
 */
import { ENEMIES, GRID_COLUMNS, GRID_ROWS, TILE, type EnemyKind } from '../../../../shared/gem-keep/config';
import type { Enemy, GameState, Tower } from '../../../../shared/gem-keep/engine';
import { shotStats, type Colour, type Gem } from '../../../../shared/gem-keep/gems';
import { pathTiles, pointAlong } from '../../../../shared/gem-keep/level';
import { boardUrl, gemSpriteUrl, picture, spritePicture, type SpriteName } from '../art';
import { GEM_COLOURS, traceShape } from './shapes';

export const WIDTH = GRID_COLUMNS * TILE;
export const HEIGHT = GRID_ROWS * TILE;

/** Sizes for the painted sprites, in tiles. Tune here when pictures change. */
const ART = {
  /** Towers are this tall and wide, standing on the bottom of their tile. */
  tower: 1.25,
  /** Where the gem sits in a tower picture: share of the picture's height from its top. */
  towerGemAt: 0.3,
  /** A gem in a tower is this wide (grade 1); each grade adds a little. */
  gem: 0.46,
  keep: 1.45,
  rock: 0.9,
  /** Enemies are their size in config × this, across. */
  enemy: 2.6,
};
/** Enemy pictures painted facing left (the rest face right). Flipped so every enemy faces where it walks. */
const ART_FACES_LEFT = new Set<EnemyKind>([]);

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  colour: string;
  size: number;
  /** Floating text instead of a dot. */
  text?: string;
  /** A ring that grows and fades (a critical hit's flash) instead of a dot. */
  ring?: boolean;
}

/** What the screen wants highlighted, set by the page. */
export interface View {
  selectedTile: [number, number] | null;
  hoverTile: [number, number] | null;
  /** The keyboard cursor, shown while the map has focus. */
  cursor: [number, number] | null;
  /** Towers whose gem can be combined with the chosen one. */
  glowTowers: [number, number][];
  /** Show a see-through tower where one could be built. */
  ghost: boolean;
}

/** Moment-to-moment looks the engine keeps for drawing (none of it is game state). */
export interface Fx {
  /** Seconds, from the page clock (keeps glows gently alive while paused). */
  now: number;
  reducedMotion: boolean;
  /** A painted night board is showing: gems light the ground. */
  night: boolean;
  /** Enemy id → when its white hit flash ends. */
  flashes: Map<number, number>;
  /** Enemy id → which way it faces (1 right, −1 left). */
  facing: Map<number, 1 | -1>;
  /** When the Keep stops shaking. */
  shakeUntil: number;
}

export const newFx = (): Fx => ({ now: 0, reducedMotion: false, night: false, flashes: new Map(), facing: new Map(), shakeUntil: 0 });

/** The Keep's tile: the end of the first path. */
const keepTile = (state: GameState) => state.level.paths[0][state.level.paths[0].length - 1];

/**
 * The map, drawn once and kept: the level's painted board if it has loaded, otherwise grass, road and
 * water in code. Rocks go on top either way (the painted rock where there is one). `brighter` lifts a
 * dark board for projectors and bright rooms.
 */
export function drawGround(ctx: CanvasRenderingContext2D, state: GameState, small = false, brighter = false) {
  const board = picture(boardUrl(state.level.id, small));
  if (board) {
    ctx.drawImage(board, 0, 0, WIDTH, HEIGHT);
    if (brighter) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(150, 140, 205, 0.42)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }
  } else {
    drawCodeGround(ctx, state);
  }
  const rock = spritePicture('rock');
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLUMNS; x++) {
      if (state.ground[y][x] !== 'rock') continue;
      if (rock) drawStanding(ctx, rock, (x + 0.5) * TILE, (y + 1) * TILE, ART.rock * TILE, 0.4);
      else drawRock(ctx, x * TILE, y * TILE, x * 7 + y);
    }
  }
  // Arrow where enemies come in.
  for (const corners of state.level.paths) {
    const [c0, r0] = corners[0];
    const [c1, r1] = corners[1];
    const ex = (Math.max(0, Math.min(GRID_COLUMNS - 1, c0)) + 0.5) * TILE;
    const ey = (Math.max(0, Math.min(GRID_ROWS - 1, r0)) + 0.5) * TILE;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(Math.atan2(r1 - r0, c1 - c0));
    ctx.fillStyle = board ? 'rgba(255, 120, 110, 0.7)' : 'rgba(179, 38, 30, 0.55)';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Grass, water and the sandy road, drawn in code. */
function drawCodeGround(ctx: CanvasRenderingContext2D, state: GameState) {
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLUMNS; x++) {
      const px = x * TILE;
      const py = y * TILE;
      ctx.fillStyle = (x + y) % 2 ? '#bfe3a5' : '#c9e9b1';
      ctx.fillRect(px, py, TILE, TILE);
      if (state.ground[y][x] === 'water') {
        ctx.fillStyle = '#7cc4ef';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        for (const dy of [18, 38]) {
          ctx.beginPath();
          ctx.moveTo(px + 10, py + dy);
          ctx.quadraticCurveTo(px + 20, py + dy - 6, px + 30, py + dy);
          ctx.quadraticCurveTo(px + 40, py + dy + 6, px + 50, py + dy);
          ctx.stroke();
        }
      }
    }
  }
  // The path: a soft sandy road joining the corners.
  for (const corners of state.level.paths) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const trace = () => {
      ctx.beginPath();
      corners.forEach(([c, r], i) => {
        const x = (c + 0.5) * TILE;
        const y = (r + 0.5) * TILE;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
    };
    trace();
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = TILE * 0.86;
    ctx.stroke();
    trace();
    ctx.strokeStyle = '#ecd9a6';
    ctx.lineWidth = TILE * 0.74;
    ctx.stroke();
    // Little stones along the road.
    ctx.fillStyle = 'rgba(160, 125, 70, 0.35)';
    pathTiles(corners).forEach(([c, r], i) => {
      ctx.beginPath();
      ctx.arc((c + 0.3 + (i % 3) * 0.2) * TILE, (r + 0.35 + ((i * 7) % 3) * 0.15) * TILE, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

/** A picture standing on the ground: `bottom` is where it touches, with a small dark shadow. */
function drawStanding(ctx: CanvasRenderingContext2D, img: CanvasImageSource, cx: number, bottom: number, size: number, shadow: number) {
  ctx.fillStyle = 'rgba(5, 4, 20, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, bottom - size * 0.08, size * shadow, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(img, cx - size / 2, bottom - size, size, size);
}

function drawRock(ctx: CanvasRenderingContext2D, px: number, py: number, seed: number) {
  const blobs = [
    [0.38, 0.55, 0.26],
    [0.64, 0.6, 0.2],
    [0.5, 0.38, 0.18],
  ];
  for (const [bx, by, br] of blobs) {
    const r = br * TILE * (0.9 + ((seed * 13) % 5) * 0.04);
    const g = ctx.createRadialGradient(px + bx * TILE - r / 3, py + by * TILE - r / 3, 2, px + bx * TILE, py + by * TILE, r);
    g.addColorStop(0, '#c9c6d6');
    g.addColorStop(1, '#7d7a92');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px + bx * TILE, py + by * TILE, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The Keep, drawn every frame so it can shake when hit and glow while it's healthy. */
function drawKeep(ctx: CanvasRenderingContext2D, state: GameState, fx: Fx) {
  const [c, r] = keepTile(state);
  const shaking = fx.now < fx.shakeUntil && !fx.reducedMotion;
  const dx = shaking ? Math.sin(fx.now * 70) * 3 : 0;
  const cx = (c + 0.5) * TILE + dx;
  const img = spritePicture('keep');
  if (fx.night) {
    // Warm light from the windows, dimming as the Keep is hurt.
    const share = Math.max(0, state.keep) / 100;
    if (share > 0) drawGlow(ctx, '#ffb84d', cx, r * TILE + TILE * 0.35, TILE * (0.7 + 0.5 * share), 0.25 + 0.45 * share);
  }
  if (img) {
    drawSprite(ctx, 'keep:art', ART.keep * TILE, cx, (r + 1) * TILE - (ART.keep * TILE) / 2, (k, mid) => {
      const s = ART.keep * TILE;
      k.drawImage(img, mid - s / 2, mid - s / 2, s, s);
    });
  } else {
    drawCodeKeep(ctx, cx, (r + 0.5) * TILE);
  }
}

function drawCodeKeep(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const w = TILE * 0.9;
  const h = TILE * 0.8;
  const left = cx - w / 2;
  const top = cy - h / 2 + 4;
  ctx.fillStyle = 'rgba(29, 27, 58, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + h / 2, w * 0.6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(left, top, left + w, top);
  g.addColorStop(0, '#7b5fe0');
  g.addColorStop(1, '#4529a3');
  ctx.fillStyle = g;
  ctx.beginPath();
  // Walls with battlements.
  ctx.moveTo(left, top + h);
  ctx.lineTo(left, top);
  const merlon = w / 5;
  for (let i = 0; i < 5; i++) {
    const x = left + i * merlon;
    ctx.lineTo(x, i % 2 ? top + 8 : top);
    ctx.lineTo(x + merlon, i % 2 ? top + 8 : top);
  }
  ctx.lineTo(left + w, top + h);
  ctx.closePath();
  ctx.fill();
  // Door and a flag.
  ctx.fillStyle = '#2a1866';
  ctx.beginPath();
  ctx.arc(cx, top + h - 12, 9, Math.PI, 0);
  ctx.rect(cx - 9, top + h - 12, 18, 12);
  ctx.fill();
  ctx.strokeStyle = '#2a1866';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, top - 22);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(cx, top - 22);
  ctx.lineTo(cx + 16, top - 16);
  ctx.lineTo(cx, top - 10);
  ctx.closePath();
  ctx.fill();
}

/** A gem: its colour's shape with a shine. Mixed gems show every colour. */
export function drawGem(ctx: CanvasRenderingContext2D, gem: Pick<Gem, 'grade' | 'colours'>, cx: number, cy: number, r: number) {
  const [main, ...more] = gem.colours;
  const c = GEM_COLOURS[main];
  traceShape(ctx, main, cx, cy, r);
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, c.light);
  g.addColorStop(0.45, c.fill);
  g.addColorStop(1, c.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  // Extra colours of a mixed gem: small shapes on its edge.
  more.forEach((colour, i) => {
    const angle = Math.PI * 0.25 + i * Math.PI * 0.5;
    const sx = cx + Math.cos(angle) * r * 0.9;
    const sy = cy + Math.sin(angle) * r * 0.9;
    traceShape(ctx, colour, sx, sy, r * 0.45);
    ctx.fillStyle = GEM_COLOURS[colour].fill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  });
  drawPips(ctx, gem.grade, cx, cy + r + 7);
}

/** A gem from its painted pictures (main colour big, extra colours small on its edge), or null if any is missing. */
function gemPictures(gem: Pick<Gem, 'colours'>): HTMLImageElement[] | null {
  const pics = gem.colours.map((c) => picture(gemSpriteUrl(c)));
  return pics.every(Boolean) ? (pics as HTMLImageElement[]) : null;
}

function drawGemPicture(ctx: CanvasRenderingContext2D, gem: Pick<Gem, 'grade' | 'colours'>, pics: HTMLImageElement[], cx: number, cy: number, d: number) {
  const [main, ...more] = pics;
  ctx.drawImage(main, cx - d / 2, cy - d / 2, d, d);
  more.forEach((img, i) => {
    const angle = Math.PI * 0.25 + i * Math.PI * 0.5;
    const s = d * 0.5;
    ctx.drawImage(img, cx + Math.cos(angle) * d * 0.42 - s / 2, cy + Math.sin(angle) * d * 0.42 - s / 2, s, s);
  });
  drawPips(ctx, gem.grade, cx, cy + d * 0.5 + 6);
}

/** Grade: little pips under the gem. */
function drawPips(ctx: CanvasRenderingContext2D, grade: number, cx: number, y: number) {
  if (grade <= 1) return;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#1d1b3a';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < grade; i++) {
    ctx.beginPath();
    ctx.arc(cx + (i - (grade - 1) / 2) * 7, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// ---------- Light ----------

/** A soft round light in one colour, drawn once and reused (cheap to copy, unlike shadowBlur). */
const glows = new Map<string, HTMLCanvasElement>();
function glowSprite(colour: string): HTMLCanvasElement {
  let canvas = glows.get(colour);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, colour);
    g.addColorStop(0.35, withAlpha(colour, 0.45));
    g.addColorStop(1, withAlpha(colour, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    glows.set(colour, canvas);
  }
  return canvas;
}

function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function drawGlow(ctx: CanvasRenderingContext2D, colour: string, cx: number, cy: number, radius: number, alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(glowSprite(colour), cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

/** A gently breathing brightness (steady when the device asks for less motion). */
const pulse = (fx: Fx, seed: number) => (fx.reducedMotion ? 1 : 1 + Math.sin(fx.now * 2.2 + seed) * 0.12);

// ---------- Towers ----------

function towerTop(tower: Pick<Tower, 'x' | 'y'>) {
  const s = ART.tower * TILE;
  const top = (tower.y + 1) * TILE - s + TILE * 0.06;
  return { s, top };
}

/** Where the gem sits in this tower (its centre). */
function gemSpot(tower: Tower): { x: number; y: number; art: boolean } {
  const cx = (tower.x + 0.5) * TILE;
  if (spritePicture(`tower-${tower.level}` as SpriteName)) {
    const { s, top } = towerTop(tower);
    return { x: cx, y: top + s * ART.towerGemAt, art: true };
  }
  return { x: cx, y: (tower.y + 0.5) * TILE - 2, art: false };
}

function drawTower(ctx: CanvasRenderingContext2D, tower: Tower, glow: boolean, fx: Fx) {
  const cx = (tower.x + 0.5) * TILE;
  const cy = (tower.y + 0.5) * TILE;
  const img = spritePicture(`tower-${tower.level}` as SpriteName);
  if (img) {
    const { s, top } = towerTop(tower);
    ctx.fillStyle = 'rgba(5, 4, 20, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, (tower.y + 1) * TILE - TILE * 0.1, TILE * 0.42, TILE * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(ctx, `tower:art:${tower.level}`, s, cx, top + s / 2, (k, mid) => k.drawImage(img, mid - s / 2, mid - s / 2, s, s));
  } else {
    drawSprite(ctx, `tower:${tower.level}`, TILE, cx, cy, (c, mid) => paintTowerBase(c, tower.level, mid, mid));
  }
  if (tower.gem) {
    const gem = tower.gem;
    const spot = gemSpot(tower);
    const pics = spot.art ? gemPictures(gem) : null;
    if (pics) {
      const d = ART.gem * TILE * (1 + 0.07 * (gem.grade - 1));
      if (fx.night) drawGlow(ctx, GEM_COLOURS[gem.colours[0]].light, spot.x, spot.y, d * 0.95, 0.55 * pulse(fx, tower.x + tower.y));
      drawSprite(ctx, `gem:art:${gem.colours.join('+')}:${gem.grade}`, d * 1.8, spot.x, spot.y + d * 0.2, (k, mid) =>
        drawGemPicture(k, gem, pics, mid, mid - d * 0.2, d),
      );
    } else {
      const r = 10 + gem.grade * 0.8;
      if (fx.night) drawGlow(ctx, GEM_COLOURS[gem.colours[0]].light, spot.x, spot.y, r * 2, 0.5 * pulse(fx, tower.x + tower.y));
      drawSprite(ctx, `gem:${gem.colours.join('+')}:${gem.grade}`, 44, spot.x, spot.y, (c, mid) => drawGem(c, gem, mid, mid, r));
    }
  }
  if (glow) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    roundRect(ctx, cx - 25, cy - 22, 50, 48, 12);
    ctx.stroke();
  }
}

/** The pool of light a gem casts on the ground around its tower: bigger and brighter by grade. */
function drawTowerLight(ctx: CanvasRenderingContext2D, tower: Tower, fx: Fx) {
  if (!tower.gem) return;
  const g = tower.gem.grade;
  const colour = GEM_COLOURS[tower.gem.colours[0]].fill;
  drawGlow(ctx, colour, (tower.x + 0.5) * TILE, (tower.y + 0.75) * TILE, TILE * (0.85 + 0.15 * g), (0.45 + 0.08 * g) * pulse(fx, tower.x * 3 + tower.y));
}

function paintTowerBase(ctx: CanvasRenderingContext2D, level: number, cx: number, cy: number) {
  ctx.fillStyle = 'rgba(29, 27, 58, 0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 20, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(cx - 22, 0, cx + 22, 0);
  g.addColorStop(0, '#a8a5bd');
  g.addColorStop(1, '#6e6a88');
  ctx.fillStyle = g;
  roundRect(ctx, cx - 21, cy - 18, 42, 40, 9);
  ctx.fill();
  ctx.fillStyle = '#4a4770';
  roundRect(ctx, cx - 15, cy - 12, 30, 26, 7);
  ctx.fill();
  // Level pips on the base.
  for (let i = 0; i < level; i++) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(cx - 10 + i * 10, cy + 18, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------- Enemies ----------

const ENEMY_LOOK: Record<EnemyKind, { body: string; dark: string }> = {
  walker: { body: '#9b5de5', dark: '#5a2a99' },
  runner: { body: '#ff8c42', dark: '#b34d00' },
  brute: { body: '#6d6875', dark: '#36323d' },
  swarm: { body: '#3d3a4b', dark: '#1d1b26' },
  boss: { body: '#d62839', dark: '#6e0d17' },
};

function paintEnemyBody(ctx: CanvasRenderingContext2D, kind: EnemyKind, cx: number, cy: number) {
  const r = ENEMIES[kind].size * TILE;
  const look = ENEMY_LOOK[kind];
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, look.body);
  g.addColorStop(1, look.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  if (kind === 'brute') ctx.roundRect(cx - r, cy - r, r * 2, r * 2, r * 0.45);
  else if (kind === 'runner') {
    ctx.ellipse(cx, cy, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
  } else ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'boss') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy - r * 0.7);
    ctx.lineTo(cx - r * 0.6, cy - r * 1.25);
    ctx.lineTo(cx - r * 0.3, cy - r * 0.95);
    ctx.lineTo(cx, cy - r * 1.35);
    ctx.lineTo(cx + r * 0.3, cy - r * 0.95);
    ctx.lineTo(cx + r * 0.6, cy - r * 1.25);
    ctx.lineTo(cx + r * 0.6, cy - r * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  if (kind !== 'swarm') {
    // Eyes.
    ctx.fillStyle = '#fff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * r * 0.35, cy - r * 0.1, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1d1b3a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * r * 0.35 + r * 0.06, cy - r * 0.08, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A picture's shape filled with one colour (for the pale rim and the white hit flash). */
function silhouette(source: CanvasImageSource, w: number, h: number, colour: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** A painted enemy, facing `face`, with a thin pale rim so it stands out on a dark board. */
function paintEnemyArt(ctx: CanvasRenderingContext2D, img: HTMLImageElement, kind: EnemyKind, face: 1 | -1, mid: number, d: number) {
  ctx.save();
  ctx.translate(mid, mid);
  if (face === (ART_FACES_LEFT.has(kind) ? 1 : -1)) ctx.scale(-1, 1);
  const rim = silhouette(img, d, d, 'rgba(225, 232, 255, 0.85)');
  for (let a = 0; a < 8; a++) {
    ctx.drawImage(rim, -d / 2 + Math.cos((a * Math.PI) / 4) * 1.5, -d / 2 + Math.sin((a * Math.PI) / 4) * 1.5, d, d);
  }
  ctx.drawImage(img, -d / 2, -d / 2, d, d);
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, state: GameState, fx: Fx) {
  const time = state.time;
  const r = ENEMIES[e.kind].size * TILE;
  const cx = e.x * TILE;
  const bob = e.kind === 'swarm' || fx.reducedMotion ? 0 : Math.sin(time * 8 + e.id) * 1.5;
  const cy = e.y * TILE + bob;
  // Which way it's walking: look a little further along its path.
  const path = state.paths[e.path];
  if (path) {
    const ahead = pointAlong(path, e.distance + 0.1);
    if (Math.abs(ahead.x - e.x) > 0.01) fx.facing.set(e.id, ahead.x < e.x ? -1 : 1);
  }
  const face = fx.facing.get(e.id) ?? 1;

  ctx.fillStyle = fx.night ? 'rgba(5, 4, 20, 0.5)' : 'rgba(29, 27, 58, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, e.y * TILE + r * 0.85, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  const img = spritePicture(e.kind);
  const flashing = (fx.flashes.get(e.id) ?? 0) > fx.now;
  if (img) {
    const d = r * ART.enemy;
    const size = Math.ceil(d + 6);
    drawSprite(ctx, `enemy:art:${e.kind}:${face}`, size, cx, cy, (k, mid) => paintEnemyArt(k, img, e.kind, face, mid, d));
    if (flashing) drawSprite(ctx, `enemy:flash:${e.kind}:${face}`, size, cx, cy, (k, mid) => flashOf(k, sprite(`enemy:art:${e.kind}:${face}`, size, () => {}), mid, size));
  } else {
    const size = Math.ceil(r * 2.8);
    drawSprite(ctx, `enemy:${e.kind}`, size, cx, cy, (c, mid) => paintEnemyBody(c, e.kind, mid, mid));
    if (flashing) drawSprite(ctx, `enemy:flash:${e.kind}`, size, cx, cy, (k, mid) => flashOf(k, sprite(`enemy:${e.kind}`, size, () => {}), mid, size));
  }

  // Slowed: frost shimmer. Poisoned: green bubbles.
  if (e.slowUntil > time) {
    const spin = fx.reducedMotion ? 0 : fx.now * 1.5;
    ctx.strokeStyle = 'rgba(150, 225, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -spin * 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e6f7ff';
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3;
      const gx = cx + Math.cos(a) * (r + 4);
      const gy = cy + Math.sin(a) * (r + 4);
      ctx.beginPath();
      ctx.moveTo(gx, gy - 3.5);
      ctx.lineTo(gx + 2, gy);
      ctx.lineTo(gx, gy + 3.5);
      ctx.lineTo(gx - 2, gy);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (e.poisonUntil > time) {
    ctx.fillStyle = 'rgba(110, 235, 140, 0.85)';
    for (let i = 0; i < 3; i++) {
      const t = fx.reducedMotion ? i / 3 : (fx.now * 0.9 + i / 3 + e.id * 0.17) % 1;
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(cx + (i - 1) * r * 0.55, cy - r * 0.4 - t * r * 1.2, 2 + i * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (e.health < e.maxHealth) {
    const w = Math.max(20, r * 2);
    const top = cy - r * (img ? ART.enemy / 2 : 1) - (e.kind === 'boss' ? 14 : 8);
    ctx.fillStyle = 'rgba(29, 27, 58, 0.8)';
    ctx.fillRect(cx - w / 2 - 1, top - 1, w + 2, 6);
    ctx.fillStyle = e.health / e.maxHealth > 0.35 ? '#2bd47d' : '#ff5a4e';
    ctx.fillRect(cx - w / 2, top, (w * Math.max(0, e.health)) / e.maxHealth, 4);
  }
}

/** The white hit flash: the enemy's own sprite, filled white. */
function flashOf(ctx: CanvasRenderingContext2D, body: HTMLCanvasElement, mid: number, size: number) {
  ctx.drawImage(silhouette(body, body.width, body.height, '#ffffff'), mid - size / 2, mid - size / 2, size, size);
}

// ---------- The sprite cache ----------

/**
 * Pictures that never change (an enemy's body, a tower, a gem) are drawn once onto a small
 * canvas at the screen's real resolution and then copied each frame, which is much quicker
 * than redrawing gradients 60 times a second.
 */
const sprites = new Map<string, HTMLCanvasElement>();
let spriteScale = 1;

/** Forget every cached sprite (a painted picture arrived, so the code-drawn ones are out of date). */
export function clearSprites() {
  sprites.clear();
}

function sprite(key: string, size: number, paint: (ctx: CanvasRenderingContext2D, c: number) => void): HTMLCanvasElement {
  let canvas = sprites.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.ceil(size * spriteScale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(spriteScale, spriteScale);
    paint(ctx, size / 2);
    sprites.set(key, canvas);
  }
  return canvas;
}

function drawSprite(ctx: CanvasRenderingContext2D, key: string, size: number, x: number, y: number, paint: (ctx: CanvasRenderingContext2D, c: number) => void) {
  ctx.drawImage(sprite(key, size, paint), x - size / 2, y - size / 2, size, size);
}

const sameTile = (a: [number, number] | null, x: number, y: number) => !!a && a[0] === x && a[1] === y;

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ground: CanvasImageSource,
  view: View,
  particles: Particle[],
  scale: number,
  fx: Fx = newFx(),
) {
  if (scale !== spriteScale) {
    sprites.clear();
    spriteScale = scale;
  }
  ctx.drawImage(ground, 0, 0, WIDTH, HEIGHT);

  const tileHighlight = (tile: [number, number] | null, colour: string, width: number) => {
    if (!tile) return;
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.strokeRect(tile[0] * TILE + width / 2, tile[1] * TILE + width / 2, TILE - width, TILE - width);
  };
  if (view.hoverTile && !sameTile(view.selectedTile, ...view.hoverTile)) tileHighlight(view.hoverTile, 'rgba(255,255,255,0.8)', 3);

  // Gems light the ground around their towers.
  if (fx.night) for (const tower of state.towers) drawTowerLight(ctx, tower, fx);

  // Range of the chosen tower.
  const chosen = view.selectedTile && state.towers.find((t) => sameTile(view.selectedTile, t.x, t.y));
  if (chosen?.gem) {
    const range = shotStats(chosen.gem, chosen.level).range * TILE;
    ctx.fillStyle = 'rgba(255, 210, 63, 0.14)';
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc((chosen.x + 0.5) * TILE, (chosen.y + 0.5) * TILE, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (view.ghost && view.selectedTile) {
    ctx.globalAlpha = 0.45;
    drawTower(ctx, { x: view.selectedTile[0], y: view.selectedTile[1], level: 1, gem: null, targeting: 'first', cooldown: 0 }, false, fx);
    ctx.globalAlpha = 1;
  }

  // Towers and the Keep stand up out of their tiles, so draw the back rows first.
  const keepRow = keepTile(state)[1];
  let keepDrawn = false;
  const towers = [...state.towers].sort((a, b) => a.y - b.y);
  for (const tower of towers) {
    if (!keepDrawn && tower.y > keepRow) {
      drawKeep(ctx, state, fx);
      keepDrawn = true;
    }
    drawTower(ctx, tower, view.glowTowers.some(([x, y]) => x === tower.x && y === tower.y), fx);
  }
  if (!keepDrawn) drawKeep(ctx, state, fx);

  for (const e of state.enemies) drawEnemy(ctx, e, state, fx);
  if (fx.facing.size > state.enemies.length + 64) {
    const alive = new Set(state.enemies.map((e) => e.id));
    for (const id of fx.facing.keys()) if (!alive.has(id)) fx.facing.delete(id);
    for (const id of fx.flashes.keys()) if (!alive.has(id)) fx.flashes.delete(id);
  }

  // Shots: a glowing dot with a short trail behind it.
  for (const p of state.projectiles) {
    const colour = GEM_COLOURS[p.colours[0]];
    const px = p.x * TILE;
    const py = p.y * TILE;
    const target = state.enemies.find((e) => e.id === p.target);
    if (target) {
      const dx = target.x * TILE - px;
      const dy = target.y * TILE - py;
      const len = Math.hypot(dx, dy) || 1;
      const tx = px - (dx / len) * 18;
      const ty = py - (dy / len) * 18;
      const trail = ctx.createLinearGradient(px, py, tx, ty);
      trail.addColorStop(0, withAlpha(colour.light, 0.9));
      trail.addColorStop(1, withAlpha(colour.light, 0));
      ctx.strokeStyle = trail;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    if (fx.night) drawGlow(ctx, colour.fill, px, py, 14, 0.8);
    ctx.fillStyle = colour.light;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colour.fill;
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of particles) {
    if (p.life <= 0) continue;
    const fade = Math.min(1, (p.life / p.max) * 1.5);
    ctx.globalAlpha = fade;
    if (p.text) {
      ctx.fillStyle = p.colour;
      ctx.font = `800 ${p.size}px ui-rounded, 'Nunito', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(29,27,58,0.8)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.ring) {
      ctx.strokeStyle = p.colour;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.2 - p.life / p.max), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      if (fx.night) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalAlpha = 1;

  tileHighlight(view.selectedTile, '#ffd23f', 4);
  tileHighlight(view.cursor, '#ff6b00', 4);
}

/** The colour for a particle from this gem. */
export const particleColour = (colours: Colour[]) => GEM_COLOURS[colours[0]].fill;
