/**
 * Drawing Gem Keep on a canvas. Everything is drawn in code (shapes and gradients): no
 * image files. Coordinates are logical pixels (TILE per tile); the engine scales the canvas.
 */
import { ENEMIES, GRID_COLUMNS, GRID_ROWS, TILE, type EnemyKind } from '../../../../shared/gem-keep/config';
import type { Enemy, GameState, Tower } from '../../../../shared/gem-keep/engine';
import { shotStats, type Colour, type Gem } from '../../../../shared/gem-keep/gems';
import { pathTiles } from '../../../../shared/gem-keep/level';
import { GEM_COLOURS, traceShape } from './shapes';

export const WIDTH = GRID_COLUMNS * TILE;
export const HEIGHT = GRID_ROWS * TILE;

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

/** The map: grass, path, rocks, water and the Keep. Drawn once and kept. */
export function drawGround(ctx: CanvasRenderingContext2D, state: GameState) {
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLUMNS; x++) {
      const px = x * TILE;
      const py = y * TILE;
      const kind = state.ground[y][x];
      ctx.fillStyle = (x + y) % 2 ? '#bfe3a5' : '#c9e9b1';
      ctx.fillRect(px, py, TILE, TILE);
      if (kind === 'rock') drawRock(ctx, px, py, x * 7 + y);
      if (kind === 'water') {
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
    // Arrow where enemies come in.
    const [c0, r0] = corners[0];
    const [c1, r1] = corners[1];
    const ex = (Math.max(0, Math.min(GRID_COLUMNS - 1, c0)) + 0.5) * TILE;
    const ey = (Math.max(0, Math.min(GRID_ROWS - 1, r0)) + 0.5) * TILE;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(Math.atan2(r1 - r0, c1 - c0));
    ctx.fillStyle = 'rgba(179, 38, 30, 0.55)';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const last = state.level.paths[0][state.level.paths[0].length - 1];
  drawKeep(ctx, (last[0] + 0.5) * TILE, (last[1] + 0.5) * TILE);
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

function drawKeep(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
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
  // Grade: little pips under the gem.
  if (gem.grade > 1) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1d1b3a';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < gem.grade; i++) {
      const px = cx + (i - (gem.grade - 1) / 2) * 7;
      ctx.beginPath();
      ctx.arc(px, cy + r + 7, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawTower(ctx: CanvasRenderingContext2D, tower: Tower, glow: boolean) {
  const cx = (tower.x + 0.5) * TILE;
  const cy = (tower.y + 0.5) * TILE;
  drawSprite(ctx, `tower:${tower.level}`, TILE, cx, cy, (c, mid) => paintTowerBase(c, tower.level, mid, mid));
  if (tower.gem) {
    const gem = tower.gem;
    const r = 10 + gem.grade * 0.8;
    drawSprite(ctx, `gem:${gem.colours.join('+')}:${gem.grade}`, 44, cx, cy - 2, (c, mid) => drawGem(c, gem, mid, mid, r));
  }
  if (glow) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    roundRect(ctx, cx - 25, cy - 22, 50, 48, 12);
    ctx.stroke();
  }
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

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  const r = ENEMIES[e.kind].size * TILE;
  const cx = e.x * TILE;
  const bob = e.kind === 'swarm' ? 0 : Math.sin(time * 8 + e.id) * 1.5;
  const cy = e.y * TILE + bob;
  ctx.fillStyle = 'rgba(29, 27, 58, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, e.y * TILE + r * 0.85, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  const size = Math.ceil(r * 2.8);
  drawSprite(ctx, `enemy:${e.kind}`, size, cx, cy, (c, mid) => paintEnemyBody(c, e.kind, mid, mid));
  // Slowed: an icy ring. Poisoned: a green ring.
  if (e.slowUntil > time) {
    ctx.strokeStyle = 'rgba(47, 128, 237, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (e.poisonUntil > time) {
    ctx.strokeStyle = 'rgba(34, 168, 106, 0.9)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (e.health < e.maxHealth) {
    const w = Math.max(20, r * 2);
    const top = cy - r - (e.kind === 'boss' ? 22 : 10);
    ctx.fillStyle = 'rgba(29, 27, 58, 0.7)';
    ctx.fillRect(cx - w / 2 - 1, top - 1, w + 2, 6);
    ctx.fillStyle = e.health / e.maxHealth > 0.35 ? '#2bd47d' : '#ff5a4e';
    ctx.fillRect(cx - w / 2, top, (w * Math.max(0, e.health)) / e.maxHealth, 4);
  }
}

/**
 * Pictures that never change (an enemy's body, a tower, a gem) are drawn once onto a small
 * canvas at the screen's real resolution and then copied each frame, which is much quicker
 * than redrawing gradients 60 times a second.
 */
const sprites = new Map<string, HTMLCanvasElement>();
let spriteScale = 1;

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

  // Range of the chosen tower.
  const chosen = view.selectedTile && state.towers.find((t) => sameTile(view.selectedTile, t.x, t.y));
  if (chosen?.gem) {
    const range = shotStats(chosen.gem, chosen.level).range * TILE;
    ctx.fillStyle = 'rgba(255, 210, 63, 0.14)';
    ctx.strokeStyle = 'rgba(224, 168, 0, 0.9)';
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
    drawTower(ctx, { x: view.selectedTile[0], y: view.selectedTile[1], level: 1, gem: null, targeting: 'first', cooldown: 0 }, false);
    ctx.globalAlpha = 1;
  }

  for (const tower of state.towers) {
    drawTower(ctx, tower, view.glowTowers.some(([x, y]) => x === tower.x && y === tower.y));
  }
  for (const e of state.enemies) drawEnemy(ctx, e, state.time);

  for (const p of state.projectiles) {
    const colour = GEM_COLOURS[p.colours[0]];
    ctx.fillStyle = colour.light;
    ctx.beginPath();
    ctx.arc(p.x * TILE, p.y * TILE, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colour.fill;
    ctx.beginPath();
    ctx.arc(p.x * TILE, p.y * TILE, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of particles) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
    ctx.fillStyle = p.colour;
    if (p.text) {
      ctx.font = `800 ${p.size}px ui-rounded, 'Nunito', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(29,27,58,0.8)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  tileHighlight(view.selectedTile, '#ffd23f', 4);
  tileHighlight(view.cursor, '#ff6b00', 4);
}

/** The colour for a particle from this gem. */
export const particleColour = (colours: Colour[]) => GEM_COLOURS[colours[0]].fill;
