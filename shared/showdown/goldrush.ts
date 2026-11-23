/**
 * Gold Rush, Class Showdown's second arena (docs/SHOWDOWN-PLAN.md section 4.2). Same round, modes, roles and big events
 * as Boss Bounty (the engine), with the boss's health standing in for the mountain's gold: every right answer digs.
 *
 * What's different: each pupil digs at a seam they pick on their iPad. A seam pays by how rich it is (gold 1x, gems 1.5x,
 * rich vein 2.5x), but it only has room for a few diggers: past that, its gold is split among everyone digging there, so
 * a crowded rich vein pays no better than a quiet gold seam. Seams run dry and new ones glitter elsewhere on the map.
 * The wind-up is the cave-in (a shield check) and the weak spot is the mother lode (double gold), both from the engine.
 */
import { hashSeed } from './schedule';
import type { Player, Round, ShowdownEvent } from './types';

export type SeamKind = 'gold' | 'gem' | 'rich';

export interface Seam {
  id: number;
  kind: SeamKind;
  /** Where it is on the map, 0 to 1 across and down. */
  x: number;
  y: number;
  /** Gold left in it (the same units as boss health). */
  left: number;
  size: number;
  /** Ms from the start it ran dry, or null while it's open. */
  dryAt: number | null;
}

export const GOLDRUSH = {
  /** How much each kind pays per dig, and how many diggers it has room for (per 12 pupils playing). */
  kinds: {
    gold: { times: 1, room: 4, share: 0.45 },
    gem: { times: 1.5, room: 3, share: 0.35 },
    rich: { times: 2.5, room: 2, share: 0.2 },
  } satisfies Record<SeamKind, { times: number; room: number; share: number }>,
  /** The mountain holds this much more gold than the boss has health (good seam picks pay more than 1x), tuned with the
   *  simulator to about the same 80% of rounds won as Boss Bounty. */
  mountain: { class: 1.2, teams2: 1.2, teams4: 1.17, solo: 1.23 } as Record<Round['mode'], number>,
  /** Seams open at once. */
  open: 5,
  /** A seam holds this share of the mountain's gold (times its kind's share of seams), so seams run dry a few times a round. */
  seamShare: 0.12,
  /** A pupil who hasn't answered for this long isn't counted as digging. */
  activeMs: 15000,
  /** A crowded seam never pays less than this. */
  minTimes: 0.4,
  /** Spots on the map seams can be (a seam never opens where another is). */
  spots: [
    [0.14, 0.3], [0.32, 0.22], [0.52, 0.28], [0.72, 0.2], [0.88, 0.32],
    [0.2, 0.55], [0.4, 0.5], [0.6, 0.56], [0.8, 0.52],
    [0.12, 0.78], [0.3, 0.75], [0.5, 0.8], [0.7, 0.76], [0.9, 0.8],
  ] as [number, number][],
} as const;

const KIND_ORDER: SeamKind[] = ['gold', 'gem', 'gold', 'rich', 'gem', 'gold', 'rich', 'gold', 'gem'];

/** Opens one new seam (picked from the seed, at a spot no open seam is using). */
function openSeam(r: Round): Seam {
  const seams = r.seams ?? (r.seams = []);
  const id = seams.length;
  const kind = KIND_ORDER[(id + hashSeed(r.seed, `kind${id}`)) % KIND_ORDER.length];
  const used = new Set(seams.filter((s) => s.dryAt === null).map((s) => `${s.x},${s.y}`));
  const free = GOLDRUSH.spots.filter(([x, y]) => !used.has(`${x},${y}`));
  const [x, y] = free[hashSeed(r.seed, `spot${id}`) % free.length];
  const size = Math.max(10, Math.round((r.boss.max || 300) * GOLDRUSH.seamShare * (GOLDRUSH.kinds[kind].times > 2 ? 0.7 : 1)));
  const seam: Seam = { id, kind, x, y, left: size, size, dryAt: null };
  seams.push(seam);
  return seam;
}

/** At the start: the first seams open. */
export function openSeams(r: Round) {
  r.boss.max = Math.round(r.boss.max * GOLDRUSH.mountain[r.mode]);
  r.boss.hp = r.boss.max;
  r.seams = [];
  for (let i = 0; i < GOLDRUSH.open; i++) openSeam(r);
}

export const openSeamsOf = (r: Round) => (r.seams ?? []).filter((s) => s.dryAt === null);

/** Pupils digging at a seam right now (answered lately). */
export function diggersAt(r: Round, seam: number): string[] {
  return r.order.filter((id) => r.players[id].seam === seam && r.t - r.players[id].lastActive <= GOLDRUSH.activeMs);
}

/** A pupil picks a seam (any open one). */
export function chooseSeam(r: Round, id: string, seam: number): boolean {
  const p = r.players[id];
  if (!p || !openSeamsOf(r).some((s) => s.id === seam)) return false;
  p.seam = seam;
  return true;
}

/** The open seam with the most room per digger: where a pupil who hasn't picked (or whose seam ran dry) digs. */
function bestSeam(r: Round): Seam | undefined {
  const scale = Math.max(1, Math.ceil(r.order.length / 12));
  return openSeamsOf(r)
    .map((s) => ({ s, free: GOLDRUSH.kinds[s.kind].room * scale - diggersAt(r, s.id).length }))
    .sort((a, b) => b.free - a.free || a.s.id - b.s.id)[0]?.s;
}

/**
 * One right answer digs: how many times the usual gold it's worth at this pupil's seam (rich seams more, crowded ones
 * split). Takes the gold out of the seam; a seam that runs dry closes and a new one opens.
 */
export function dig(r: Round, p: Player, gold: number, events: ShowdownEvent[]): number {
  let seam = openSeamsOf(r).find((s) => s.id === p.seam);
  if (!seam) {
    seam = bestSeam(r);
    if (!seam) return gold;
    p.seam = seam.id;
  }
  const kind = GOLDRUSH.kinds[seam.kind];
  const scale = Math.max(1, Math.ceil(r.order.length / 12));
  const diggers = Math.max(1, diggersAt(r, seam.id).length);
  const times = Math.max(GOLDRUSH.minTimes, kind.times * Math.min(1, (kind.room * scale) / diggers));
  const got = gold * times;
  seam.left = Math.max(0, seam.left - got);
  if (seam.left <= 0) {
    seam.dryAt = r.t;
    events.push({ type: 'seam_dry', t: r.t, seam: seam.id });
    const fresh = openSeam(r);
    events.push({ type: 'seam_new', t: r.t, seam: fresh.id, kind: fresh.kind, x: fresh.x, y: fresh.y, size: fresh.size });
  }
  return got;
}
