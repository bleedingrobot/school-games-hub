/**
 * Monster Dig pictures (docs/DIAMOND-MONSTERS-PLAN.md): the Maths Monsters paintings, reused as they are (read only:
 * nothing here changes that game), drawn into the claw field, plus the look of each cavern until James paints its own.
 */
import { monsterPic } from '../../monsters/art/painted';
import { DIG_MONSTERS, TIER_RULES } from '../../../../shared/diamond/caverns';
import { FIRST_CAVERN, type DigTier } from '../../../../shared/diamond/config';
import { paintFile } from './paint';

const images = new Map<string, HTMLImageElement>();

/** A monster's painting, ready to draw, or undefined (starting the download) so a stand-in draws this time. */
export function monsterNow(species: string, shiny: boolean, small = true): HTMLImageElement | undefined {
  const url = monsterPic(species, shiny, small) ?? monsterPic(species, false, small);
  if (!url || typeof Image === 'undefined') return undefined;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : undefined;
}

/** The picture's URL, for <img> on the pages (the plain one if a shiny hasn't been painted). */
export const monsterUrl = (species: string, shiny = false, small = true) => monsterPic(species, shiny, small) ?? monsterPic(species, false, small);

/** A monster's name from the Maths Monsters book. */
export const monsterName = (species: string) => DIG_MONSTERS.find((s) => s.id === species)?.name ?? 'Monster';

/** The colour of each tier's ring and label. */
export const TIER_COLOUR: Record<DigTier, string> = { common: '#d8d2c4', uncommon: '#6fd36a', rare: '#4fb3ff', giant: '#c07bff', ultra: '#ffcf3a' };

/**
 * A monster in the rock. `out` is false while one of the rarest is burrowed away: then only a mound and two eyes show.
 * Walking ones bob and face the way they're going; a shiny one glitters.
 */
export function drawMonster(
  c: CanvasRenderingContext2D,
  m: { species: string; tier: DigTier; shiny: boolean },
  x: number, y: number, r: number, time: number, still: boolean, dir: 1 | -1 = 1, out = true,
) {
  c.save();
  if (!out) {
    c.fillStyle = 'rgba(60,40,25,0.85)';
    c.beginPath(); c.ellipse(x, y + r * 0.5, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 0.25, y + r * 0.3, r * 0.12, 0, Math.PI * 2); c.fill(); }
    c.restore();
    return;
  }
  const bob = still ? 0 : Math.sin(time * 5 + x) * 2;
  // Tier ring, brighter for the rarer ones.
  const ring = TIER_COLOUR[m.tier];
  c.globalAlpha = m.tier === 'common' ? 0.35 : 0.7;
  c.strokeStyle = ring; c.lineWidth = m.tier === 'ultra' || m.tier === 'giant' ? 4 : 3;
  c.beginPath(); c.arc(x, y + bob, r * 1.05, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = 1;
  const img = monsterNow(m.species, m.shiny);
  const size = r * 2.3;
  if (img) {
    c.translate(x, y + bob);
    if (dir < 0) c.scale(-1, 1);
    c.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    // Stand-in until the painting arrives: a soft blob with eyes, in the tier's colour.
    c.fillStyle = ring;
    c.beginPath(); c.arc(x, y + bob, r * 0.85, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#222';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 0.3, y + bob - r * 0.15, r * 0.12, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
  if (m.shiny) {
    c.save();
    c.fillStyle = '#fff6b0';
    for (let i = 0; i < 4; i++) {
      const a = (still ? i : time * 2 + i) * 1.57;
      c.globalAlpha = still ? 0.9 : 0.5 + 0.5 * Math.abs(Math.sin(time * 3 + i));
      c.beginPath(); c.arc(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1, 2.6, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}

/** Until a cavern has its own painting, it borrows the look of a level above it (and a colour wash of its own). */
const BORROW = [4, 6, 9, 5, 4, 7, 5, 10, 10, 10];
export const CAVE_TINT = ['rgba(60,160,70,0.22)', 'rgba(40,120,200,0.22)', 'rgba(230,90,30,0.2)', 'rgba(170,220,255,0.22)', 'rgba(250,220,60,0.18)', 'rgba(130,110,90,0.22)', 'rgba(150,80,200,0.18)', 'rgba(120,60,200,0.24)', 'rgba(20,20,80,0.3)', 'rgba(255,190,40,0.18)'];

/** The level whose look a level is drawn with: its own, or the borrowed one for a cavern with no painting yet. */
export function artLevel(level: number): number {
  if (level < FIRST_CAVERN) return level;
  return paintFile('levels', String(level)) ? level : BORROW[level - FIRST_CAVERN];
}

/** A colour wash over a cavern that has no painting of its own (none for levels 1 to 10). */
export const caveTint = (level: number) => (level >= FIRST_CAVERN && !paintFile('levels', String(level)) ? CAVE_TINT[level - FIRST_CAVERN] : null);

/** How rare it looks to a pupil: "Rare · 14% of monsters". */
export const tierWords = (tier: DigTier) => TIER_RULES[tier].name;
