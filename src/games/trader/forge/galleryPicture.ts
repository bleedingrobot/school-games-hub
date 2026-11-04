/**
 * The class gallery's picture of a pupil's system (docs/TRADER-SYSTEM-PLAN.md, section 10): drawn by the pupil's own
 * browser after a build, as a 512 × 288 .webp under 40 KB, so the gallery never draws 30 systems in 3D at once. Built
 * pieces only (no holograms, no names). Saved at most once every few minutes, never on Simple graphics.
 */
import { MAX_PICTURE_BYTES, PICTURE_GAP_MINUTES, PICTURE_HEIGHT, PICTURE_WIDTH } from '../../../../shared/trader/gallery';
import type { SystemDesign } from '../../../../shared/trader/system';
import { loadViewer } from './loadViewer';
import type { GraphicsLevel } from './viewer/types';

/** What was last saved, so the same system isn't sent twice (per browser; the server keeps the real limit). */
const MEMORY = 'sgh-trader-gallery-picture';

/** The parts of a design a picture shows: only built pieces matter. */
export function builtKey(d: SystemDesign): string {
  const built = <T extends { built?: boolean }>(x: T | null | undefined) => (x?.built ? x : null);
  return JSON.stringify({
    sun: built(d.sun) && d.sun!.kind,
    planets: d.planets.filter((p) => p.built).map((p) => ({
      ...p, label: undefined, name: undefined,
      ring: built(p.ring), life: built(p.life), moons: p.moons.filter((m) => m.built), effects: p.effects.filter((e) => e.built), tech: p.tech.filter((t) => t.built),
    })),
    belt: built(d.belt), beltAfter: d.beltAfter, comets: built(d.comets), background: d.background, tech: d.tech.filter((t) => t.built),
  });
}

function remembered(): { key: string; at: number } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMORY) ?? 'null') as { key?: unknown; at?: unknown } | null;
    return raw && typeof raw.key === 'string' && typeof raw.at === 'number' ? { key: raw.key, at: raw.at } : null;
  } catch {
    return null;
  }
}

/** True if this system's picture should be (re)drawn now: a built sun, something new since the last, and not too soon. */
export function pictureDue(d: SystemDesign, level: GraphicsLevel | null, now = Date.now()): boolean {
  if (!d.sun?.built || level === null || level === 'simple') return false;
  const last = remembered();
  return !last || (last.key !== builtKey(d) && now - last.at >= PICTURE_GAP_MINUTES * 60_000);
}

export function rememberPicture(d: SystemDesign, now = Date.now()): void {
  try {
    localStorage.setItem(MEMORY, JSON.stringify({ key: builtKey(d), at: now }));
  } catch {
    // The server's own limit still holds.
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** Squeezes a picture under the size limit by saving it again at lower quality. Null if it can't be. */
async function squeeze(blob: Blob): Promise<Blob | null> {
  if (blob.size <= MAX_PICTURE_BYTES) return blob;
  const image = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const smaller = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (smaller && smaller.size <= MAX_PICTURE_BYTES && smaller.type === 'image/webp') return smaller;
  }
  return null;
}

/** Draws the gallery picture off screen (built pieces only) and gives it as base64 .webp, or null if it can't be drawn. */
export async function drawGalleryPicture(design: SystemDesign, level: GraphicsLevel): Promise<string | null> {
  const create = await loadViewer();
  if (!create) return null;
  const box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  Object.assign(box.style, { position: 'fixed', left: '-10000px', top: '0', width: `${PICTURE_WIDTH}px`, height: `${PICTURE_HEIGHT}px`, pointerEvents: 'none' });
  document.body.appendChild(box);
  try {
    const viewer = await create(box, design, { level: level === 'incredible' ? 'normal' : level, showPlans: false, labels: false, reducedMotion: true, interactive: false });
    try {
      await viewer.ready();
      const blob = await squeeze(await viewer.snapshot(PICTURE_WIDTH, PICTURE_HEIGHT));
      return blob ? await toBase64(blob) : null;
    } finally {
      viewer.dispose();
    }
  } catch {
    return null;
  } finally {
    box.remove();
  }
}
