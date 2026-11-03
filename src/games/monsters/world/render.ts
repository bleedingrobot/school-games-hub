/**
 * Drawing one frame of the world on a canvas: the visible part of the pre-painted map, then the
 * people (sorted so ones lower on the screen cover ones above), then a few markers. The tile size
 * is a whole number of screen pixels and smoothing is off, so the pixel art stays sharp.
 */
import { cameraFor } from '../../../../shared/monsters/world/walking';
import type { GameMap } from '../../../../shared/monsters/world/types';
import { leadFollower } from '../../../../shared/monsters/world/areas';
import { DEFAULT_LOOK, mapPic, monsterPic, propPic, slug, walkerPic } from '../art/painted';
import type { WalkView } from './controller';
import { TILE, type TileCache } from './tiles';

export const PLAYER_SPRITE = 98;
const BACKDROP = '#1e293b';
/** A painted walker is this many tiles tall, standing with its feet at the bottom of its tile. */
const WALKER_TILES = 1.5;

// Painted pictures, loaded the first time a frame wants one. `paintedVersion` grows as each arrives, so the frame is drawn again.
const images = new Map<string, HTMLImageElement>();
let version = 0;
export const paintedVersion = () => version;
function ready(url: string | undefined): HTMLImageElement | undefined {
  if (!url) return undefined;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.onload = () => (version += 1);
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : undefined;
}

export interface Scene {
  map: GameMap;
  frames: HTMLCanvasElement[];
  cache: TileCache;
}

/** How many screen pixels each pixel of art takes: a whole number, at most 3 (on a Chromebook that shows about 12 tiles from top to bottom). */
export function scaleFor(cssHeight: number, dpr: number): number {
  const css = Math.min(3, Math.max(2, Math.floor(cssHeight / (TILE * 8))));
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
  /** People with a quest step for you (a gold "!" over them). */
  quests?: ReadonlySet<string>;
  /** Trees hiding a seed pod you are looking for (a little twinkle on each). */
  twinkles?: readonly { x: number; y: number }[];
}

/** Which step of its twinkle a pod is on (0 is a rest), so the frame is only drawn again when one changes. */
export const twinklePhase = (now: number, i: number) => Math.floor((now + i * 600) / 160) % 12;

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

  const mapW = map.width * TILE;
  const mapH = map.height * TILE;
  const sx0 = Math.max(0, Math.floor(offX / S));
  const sy0 = Math.max(0, Math.floor(offY / S));
  const sx1 = Math.min(mapW, Math.ceil((offX + W) / S));
  const sy1 = Math.min(mapH, Math.ceil((offY + H) / S));
  // The painted map once it has loaded (drawn smooth), else the tile map (drawn sharp).
  const pics = mapPic(map.id);
  const ground = ready(pics.ground);
  const above = ready(pics.above);
  const layer = (img: CanvasImageSource, k: number) => ctx.drawImage(img, sx0 * k, sy0 * k, (sx1 - sx0) * k, (sy1 - sy0) * k, sx0 * S - offX, sy0 * S - offY, (sx1 - sx0) * S, (sy1 - sy0) * S);
  if (sx1 > sx0 && sy1 > sy0) {
    if (ground) {
      ctx.imageSmoothingEnabled = true;
      layer(ground, ground.naturalWidth / mapW);
    } else layer(frames[Math.floor(now / 700) % frames.length], 1);
  }

  // Things that change: a gate while it is shut, chests (closed, then open), a sleeping giant until it is woken.
  // Each is painted when there is a picture, else its tile.
  const stamp = (gid: number, x: number, y: number, painted?: string) => {
    const img = ready(painted && propPic(painted));
    const px = Math.round(x * TILE * S - offX);
    const py = Math.round(y * TILE * S - offY);
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, px, py, TILE * S, TILE * S);
      return;
    }
    ctx.imageSmoothingEnabled = false;
    const t = cache.tile(gid);
    if (t) ctx.drawImage(t, 0, 0, TILE, TILE, px, py, TILE * S, TILE * S);
  };
  for (const g of map.gates) if (!view.state.badges.includes(g.badge)) stamp(g.gid, g.x, g.y, 'gate');
  for (const t of map.things) if (t.kind === 'chest' && t.gid) stamp(view.state.chests.includes(t.id) ? t.openGid! : t.gid, t.x, t.y, view.state.chests.includes(t.id) ? 'chest-open' : 'chest');
  for (const t of map.things) if (t.kind === 'giant' && t.gid && !view.state.quest?.flags.includes(`woke:${t.giant}`)) stamp(t.gid, t.x, t.y, `giant-${t.giant}`);

  // People, back to front.
  const bob = view.walking && Math.floor(now / 100) % 2 ? -S : 0;
  // A painted walker (taller than a tile, feet on its tile) when there is one, else the Tiny Dungeon sprite.
  const people: { x: number; y: number; img: HTMLCanvasElement | null; painted?: HTMLImageElement; bob: number; id: string; monster?: boolean }[] = [];
  for (const t of map.things) {
    if (t.sprite === undefined) continue;
    const a = view.actors.get(t.id);
    const facing = a?.facing ?? t.facing;
    people.push({ id: t.id, x: a?.x ?? t.x, y: a?.y ?? t.y, img: cache.person(t.sprite, facing), painted: ready(walkerPic(slug(t.name), facing)), bob: 0 });
  }
  const me = ready(walkerPic(view.state.look ?? DEFAULT_LOOK, view.state.facing));
  // Your lead monster walks behind you once you have enough badges (drawn first, so you stand in front on the same tile).
  const lead = view.follower && leadFollower(view.state);
  const leadPic = lead && ready(monsterPic(lead.species, lead.shiny, true));
  if (view.follower && leadPic) people.push({ id: 'lead', x: view.follower.x, y: view.follower.y, img: null, painted: leadPic, bob, monster: true });
  people.push({ id: 'you', x: view.x, y: view.y, img: cache.person(PLAYER_SPRITE, view.state.facing), painted: me, bob });
  people.sort((a, b) => a.y - b.y || (a.monster ? -1 : b.monster ? 1 : 0));
  for (const p of people) {
    const px = Math.round(p.x * TILE * S - offX);
    const py = Math.round(p.y * TILE * S - offY + p.bob);
    if (p.painted) {
      // A monster is about a tile tall; a person is taller than a tile, feet on their tile.
      const h = (p.monster ? 1.1 : WALKER_TILES) * TILE * S;
      const w = (h * p.painted.naturalWidth) / p.painted.naturalHeight;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(p.painted, px + (TILE * S - w) / 2, py + TILE * S - h, w, h);
    } else if (p.img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(p.img, 0, 0, TILE, TILE, px, py, TILE * S, TILE * S);
    } else continue;
    const above = Math.round(p.y * TILE * S - offY) - (p.painted ? 17 : 9) * S;
    if (view.noticed === p.id) drawExclaim(ctx, px + 5 * S, above, S);
    else if (f.quests?.has(p.id)) drawExclaim(ctx, px + 5 * S, above, S, true);
  }
  // What stands in front of the walkers on a painted map: tree tops and roofs.
  if (above && sx1 > sx0 && sy1 > sy0) {
    ctx.imageSmoothingEnabled = true;
    layer(above, above.naturalWidth / mapW);
  }
  ctx.imageSmoothingEnabled = false;
  // Over the tree tops, so a pod hidden in a tree still shows.
  f.twinkles?.forEach((t, i) => drawTwinkle(ctx, Math.round((t.x * TILE + 8) * S - offX), Math.round((t.y * TILE + 5) * S - offY), S, twinklePhase(now, i)));

  if (f.fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${f.fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** A four-point sparkle that grows, shines and fades, then rests a moment: pale gold, in chunky pixel-art style (2 art pixels a block, so it reads on a small screen). */
function drawTwinkle(ctx: CanvasRenderingContext2D, x0: number, y0: number, px: number, phase: number) {
  const r = [0, 1, 2, 3, 2, 1][phase] ?? 0;
  if (!r) return;
  const S = 2 * px;
  const x = x0 - px;
  const y = y0 - px;
  ctx.fillStyle = 'rgba(63, 38, 49, 0.55)';
  ctx.fillRect(x - (r + 1) * S, y - S, (2 * r + 3) * S, 3 * S);
  ctx.fillRect(x - S, y - (r + 1) * S, 3 * S, (2 * r + 3) * S);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x - r * S, y, (2 * r + 1) * S, S);
  ctx.fillRect(x, y - r * S, S, (2 * r + 1) * S);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, S, S);
}

/** A little "!" in a speech bubble, in pixel-art style. */
function drawExclaim(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, quest = false) {
  const px = (dx: number, dy: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x + dx * S, y + dy * S, w * S, h * S);
  };
  px(-1, 0, 7, 9, '#3f2631');
  // A trainer who has seen you: red on white. A quest for you: dark on gold.
  px(0, 1, 5, 7, quest ? '#fbbf24' : '#ffffff');
  px(2, 2, 1, 3, quest ? '#3f2631' : '#dc2626');
  px(2, 6, 1, 1, quest ? '#3f2631' : '#dc2626');
}
