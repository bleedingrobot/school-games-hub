/**
 * Drawing one frame of the world on a canvas: the visible part of the pre-painted map, then the
 * people (sorted so ones lower on the screen cover ones above), then a few markers. The tile size
 * is a whole number of screen pixels and smoothing is off, so the pixel art stays sharp.
 */
import { cameraFor } from '../../../../shared/monsters/world/walking';
import type { GameMap } from '../../../../shared/monsters/world/types';
import type { WalkView } from './controller';
import { TILE, type TileCache } from './tiles';

export const PLAYER_SPRITE = 98;
const BACKDROP = '#1e293b';

export interface Scene {
  map: GameMap;
  frames: HTMLCanvasElement[];
  cache: TileCache;
}

/** How many screen pixels each pixel of art takes: a whole number, and the view shows about 8 tiles from top to bottom. */
export function scaleFor(cssHeight: number, dpr: number): number {
  const css = Math.min(4, Math.max(2, Math.floor(cssHeight / (TILE * 8))));
  return Math.max(2, Math.round(css * dpr));
}

export interface FrameInput {
  width: number;
  height: number;
  scale: number;
  scene: Scene;
  view: WalkView;
  now: number;
  /** 0 = clear, 1 = black: a quick fade after going through a door. */
  fade: number;
}

/** The tile at a point on the canvas (in the same pixels as the canvas), for taps. */
export function tileAt(px: number, py: number, f: Pick<FrameInput, 'width' | 'height' | 'scale' | 'scene' | 'view'>): [number, number] {
  const { offX, offY } = offsets(f);
  return [Math.floor((px + offX) / (TILE * f.scale)), Math.floor((py + offY) / (TILE * f.scale))];
}

function offsets(f: Pick<FrameInput, 'width' | 'height' | 'scale' | 'scene' | 'view'>) {
  const { map } = f.scene;
  const cam = cameraFor(f.view.x, f.view.y, f.width / (TILE * f.scale), f.height / (TILE * f.scale), map.width, map.height);
  return { offX: Math.round(cam.x * TILE * f.scale), offY: Math.round(cam.y * TILE * f.scale) };
}

export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameInput) {
  const { width: W, height: H, scale: S, scene, view, now } = f;
  const { map, frames, cache } = scene;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, W, H);
  const { offX, offY } = offsets(f);

  const frame = frames[Math.floor(now / 700) % frames.length];
  const mapW = map.width * TILE;
  const mapH = map.height * TILE;
  const sx0 = Math.max(0, Math.floor(offX / S));
  const sy0 = Math.max(0, Math.floor(offY / S));
  const sx1 = Math.min(mapW, Math.ceil((offX + W) / S));
  const sy1 = Math.min(mapH, Math.ceil((offY + H) / S));
  if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(frame, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 * S - offX, sy0 * S - offY, (sx1 - sx0) * S, (sy1 - sy0) * S);

  // People, back to front.
  const bob = view.walking && Math.floor(now / 100) % 2 ? -S : 0;
  const people: { x: number; y: number; img: HTMLCanvasElement | null; bob: number; id: string }[] = [];
  for (const t of map.things) {
    if (t.sprite === undefined) continue;
    const a = view.actors.get(t.id);
    people.push({ id: t.id, x: a?.x ?? t.x, y: a?.y ?? t.y, img: cache.person(t.sprite, a?.facing ?? t.facing), bob: 0 });
  }
  people.push({ id: 'you', x: view.x, y: view.y, img: cache.person(PLAYER_SPRITE, view.state.facing), bob });
  people.sort((a, b) => a.y - b.y);
  for (const p of people) {
    if (!p.img) continue;
    ctx.drawImage(p.img, 0, 0, TILE, TILE, Math.round(p.x * TILE * S - offX), Math.round(p.y * TILE * S - offY + p.bob), TILE * S, TILE * S);
    if (view.noticed === p.id) drawExclaim(ctx, Math.round(p.x * TILE * S - offX) + 5 * S, Math.round(p.y * TILE * S - offY) - 9 * S, S);
  }

  if (f.fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${f.fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** A little "!" in a speech bubble, in pixel-art style. */
function drawExclaim(ctx: CanvasRenderingContext2D, x: number, y: number, S: number) {
  const px = (dx: number, dy: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x + dx * S, y + dy * S, w * S, h * S);
  };
  px(-1, 0, 7, 9, '#3f2631');
  px(0, 1, 5, 7, '#ffffff');
  px(2, 2, 1, 3, '#dc2626');
  px(2, 6, 1, 1, '#dc2626');
}
