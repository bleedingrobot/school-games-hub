/**
 * The Armory's arrows (docs/ARCHERY-PLAN.md, section 4), as a table. Each arrow is one small entry,
 * plus at most one behaviour function for anything special (splitting, rolling, digging, dirt …).
 * Adding an arrow means adding one entry here and, if it needs one, one behaviour.
 *
 * Stage 1 makes the Plain Arrow and the Steel Arrow work fully. The rest have their numbers, and
 * their behaviours come in Stage 3: until then they fly and burst like a Plain Arrow of their size.
 * Blast sizes and damage are Stage 1's first guesses; the balance simulator (Stage 3) tunes them.
 *
 * James (21 Oct 2026): special arrows are scarce, mostly sold one at a time.
 */
import { DIRECT_HIT_BONUS } from './config';
import type { Archer, ArrowId, Land, ShotHit } from './types';

/** What a behaviour gets to work with when its arrow lands. */
export interface ImpactContext {
  land: Land;
  archers: readonly Archer[];
  shooter: number;
  hit: ShotHit;
  arrow: ArrowKind;
  /** A blast at (x, y): clears the land and hurts archers within `radius`. */
  blast(x: number, y: number, radius: number, peak: number): void;
  /** A ball of dirt at (x, y). */
  dirt(x: number, y: number, radius: number): void;
  /** Extra damage to one archer (a direct hit's bonus). */
  bonus(archer: number, amount: number): void;
}

export interface ArrowBehaviour {
  /** 1 = works now, 3 = written in Stage 3, 'pupil' = the pupil's arrow, waiting for James's answers. */
  stage: 1 | 3 | 'pupil';
  /** What happens where it lands. Left out, the arrow bursts like a Plain Arrow of its own size. */
  impact?: (ctx: ImpactContext) => void;
}

export interface ArrowKind {
  id: ArrowId;
  name: string;
  /** What it does, in a few words, for the Armory. */
  does: string;
  /** Blast radius in px (for Mud Ball, the dirt ball's radius). */
  blastRadius: number;
  /** Damage at the very centre of the blast, before the direct-hit bonus. */
  peakDamage: number;
  /** Coins for one purchase, or null while unknown. */
  price: number | null;
  /** How many arrows one purchase gives, or null while unknown. */
  perPurchase: number | null;
  /** Armory level that unlocks it (0 = from the start), or null while unknown. */
  level: number | null;
  /** In the Armory? Bots also only ever use arrows that are for sale (or unlimited). */
  forSale: boolean;
  /** Never runs out (the Plain Arrow). */
  unlimited: boolean;
  /** Not finished yet (the pupil's Glass Arrow, until James settles its details). */
  placeholder: boolean;
  behaviour?: ArrowBehaviour;
}

/** The normal landing: one blast where it hit, plus the bonus for a direct hit on an archer. */
export function defaultImpact(ctx: ImpactContext): void {
  const { hit, arrow } = ctx;
  if (hit.kind !== 'land' && hit.kind !== 'archer' && hit.kind !== 'floor') return;
  ctx.blast(hit.x, hit.y, arrow.blastRadius, arrow.peakDamage);
  if (hit.kind === 'archer' && hit.archer !== null) ctx.bonus(hit.archer, DIRECT_HIT_BONUS);
}

/** A behaviour still to be written in Stage 3. */
const stage3: ArrowBehaviour = { stage: 3 };

/**
 * The Glass Arrow: the pupil's own arrow (James, 21 Oct 2026, from the pupil's drawing).
 * The pupil's words: "When it stabs them, shards keep hurting, like a poison effect. It should be
 * the most powerful arrow in the game. It kills them next turn if they don't do anything in 1 turn."
 * TODO(glass arrow, Stage 3): the shards that keep hurting, and what counts as "doing something"
 * to get rid of them, wait for James's answers. Its price and level too. Until then it bursts
 * like a Plain Arrow, it isn't sold, and bots never pick it. Don't change the pupil's idea.
 */
function glassImpact(ctx: ImpactContext): void {
  defaultImpact(ctx);
}

type Entry = Omit<ArrowKind, 'forSale' | 'unlimited' | 'placeholder'> & Partial<Pick<ArrowKind, 'forSale' | 'unlimited' | 'placeholder'>>;

const ENTRIES: Entry[] = [
  { id: 'plain', name: 'Plain Arrow', does: 'A small blast. You never run out.', blastRadius: 18, peakDamage: 25, price: 0, perPurchase: null, level: 0, forSale: false, unlimited: true, behaviour: { stage: 1 } },
  { id: 'steel', name: 'Steel Arrow', does: 'A bigger blast.', blastRadius: 30, peakDamage: 40, price: 50, perPurchase: 2, level: 1, behaviour: { stage: 1 } },
  { id: 'log', name: 'Rolling Log', does: 'Lands, rolls downhill, bursts in a dip or at an archer.', blastRadius: 24, peakDamage: 35, price: 60, perPurchase: 1, level: 1, behaviour: stage3 },
  { id: 'mole', name: 'Mole Arrow', does: 'Digs a tunnel straight down.', blastRadius: 9, peakDamage: 10, price: 40, perPurchase: 1, level: 1, behaviour: stage3 },
  { id: 'mud', name: 'Mud Ball', does: 'Adds a ball of dirt: bury someone or build a wall.', blastRadius: 36, peakDamage: 0, price: 50, perPurchase: 1, level: 1, behaviour: stage3 },
  { id: 'rain', name: 'Arrow Rain', does: 'Splits at the top of its flight into 5 small arrows.', blastRadius: 14, peakDamage: 14, price: 150, perPurchase: 1, level: 2, behaviour: stage3 },
  { id: 'skip', name: 'Skipping Arrow', does: 'Hops forward twice, with 3 growing blasts.', blastRadius: 20, peakDamage: 18, price: 120, perPurchase: 1, level: 2, behaviour: stage3 },
  { id: 'goo', name: 'Sticky Goo Arrow', does: 'A goo puddle pools in dips and hurts anyone in it.', blastRadius: 30, peakDamage: 12, price: 120, perPurchase: 1, level: 3, behaviour: stage3 },
  { id: 'shaker', name: 'Earth Shaker', does: 'All floating dirt falls.', blastRadius: 0, peakDamage: 0, price: 100, perPurchase: 1, level: 3, behaviour: stage3 },
  { id: 'owl', name: 'Owl Arrow', does: 'Gently steers toward an archer close to its path.', blastRadius: 20, peakDamage: 30, price: 250, perPurchase: 1, level: 3, behaviour: stage3 },
  { id: 'firework', name: 'Firework Arrow', does: '5 sparkly pops around where it lands.', blastRadius: 16, peakDamage: 14, price: 180, perPurchase: 1, level: 4, behaviour: stage3 },
  { id: 'sneaky', name: 'Sneaky Mole', does: 'Tunnels toward the nearest archer and pops up under them.', blastRadius: 22, peakDamage: 35, price: 220, perPurchase: 1, level: 4, behaviour: stage3 },
  { id: 'bolt', name: 'Crossbow Bolt', does: 'Straight and fast, no drop, cuts through dirt, short range.', blastRadius: 12, peakDamage: 35, price: 150, perPurchase: 1, level: 4, behaviour: stage3 },
  { id: 'giant', name: 'Giant Arrow', does: 'A huge blast with a shockwave of leaves and confetti.', blastRadius: 75, peakDamage: 55, price: 400, perPurchase: 1, level: 5, behaviour: stage3 },
  // The pupil's own arrow (see glassImpact). Not for sale until its last details are settled.
  // Its blast numbers are the Plain Arrow's for now; price and level are blank.
  { id: 'glass', name: 'Glass Arrow', does: 'Stabs, and its glass shards keep hurting. Deal with them in 1 turn, or you pop.', blastRadius: 18, peakDamage: 25, price: null, perPurchase: 1, level: null, forSale: false, placeholder: true, behaviour: { stage: 'pupil', impact: glassImpact } },
];

export const ARROWS: readonly ArrowKind[] = ENTRIES.map((e) => ({ forSale: true, unlimited: false, placeholder: false, ...e }));

const BY_ID = new Map(ARROWS.map((a) => [a.id, a]));

export function arrowKind(id: ArrowId): ArrowKind {
  const a = BY_ID.get(id);
  if (!a) throw new Error(`no arrow called ${id}`);
  return a;
}

export function isArrowId(id: unknown): id is ArrowId {
  return typeof id === 'string' && BY_ID.has(id as ArrowId);
}

/** Can this arrow be used in a fight at all? Only unlimited ones and ones the Armory sells. */
export function usable(a: ArrowKind): boolean {
  return a.unlimited || a.forSale;
}

/** What the Armory sells. */
export function armoryArrows(): ArrowKind[] {
  return ARROWS.filter((a) => a.forSale);
}

/** The arrows a bot may choose from: never one that isn't for sale (so not the Glass Arrow until it's finished). */
export function botArrows(): ArrowKind[] {
  return ARROWS.filter(usable);
}

/** Plays an arrow's landing: its own behaviour, or a plain burst. */
export function impact(ctx: ImpactContext): void {
  const f = ctx.arrow.behaviour?.impact;
  if (f) f(ctx);
  else defaultImpact(ctx);
}
