/**
 * Auction House, Class Showdown's sixth arena (docs/SHOWDOWN-PLAN.md section 4.6). Same round, modes, roles and big events
 * as Boss Bounty (the engine), with the boss's health standing in for the royal treasury the class fills: every right
 * answer pays coins into it, and the class wins when it's full.
 *
 * What's different: right answers also earn each pupil coins to spend. Every minute a treasure goes up for auction on the
 * projector and everyone can bid for it from their iPad for 20 seconds; the highest bid when the hammer falls buys it.
 * A pupil's fortune (their score) is their coins plus what their treasures are worth, so a bargain grows it and paying
 * more than a treasure is worth shrinks it: saving versus spending. Treasures get more valuable as the round goes on and
 * the last one is always the golden dragon, so saving up can pay. Now and then a mystery box hides its value until it's
 * sold. The wind-up is thieves sneaking in (a shield check): if they get through, the treasure on sale is stolen and
 * nobody pays. The weak spot is the golden hour (double coins), from the engine. In team modes a pupil can't bid against
 * their own team's leading bid, and treasures count for the team.
 */
import { hashSeed } from './schedule';
import type { Player, Round, ShowdownEvent, TeamId } from './types';

export type TreasureKind = 'goblet' | 'lamp' | 'map' | 'orb' | 'egg' | 'mystery' | 'dragon';

export interface Lot {
  id: number;
  kind: TreasureKind;
  /** What it's worth (hidden on screens while a mystery box is on sale). */
  value: number;
  /** The lowest first bid. */
  min: number;
  openAt: number;
  endsAt: number;
  /** The leading bid and who made it (a pupil id), or 0 and null with no bids yet. */
  top: number;
  topBy: string | null;
  bids: number;
  /** How it ended: bought, nobody bid, or stolen by thieves; null while it's on sale. */
  end: 'sold' | 'unsold' | 'stolen' | null;
}

export interface AuctionState {
  /** Every treasure put up so far, the one on sale last. */
  lots: Lot[];
  /** Round time the next treasure goes up (null when no more fit before the end; the round is saved as JSON). */
  nextAt: number | null;
}

export const AUCTION = {
  /** The treasury needs this much more (or less) than the boss has health, tuned with the simulator to about 80% won. */
  treasury: { class: 1.05, teams2: 1.02, teams4: 1.03, solo: 1.02 } as Record<Round['mode'], number>,
  /** The first treasure goes up this long after the start, then one every `everyMs`. */
  firstMs: 30000,
  everyMs: 60000,
  /** Bidding lasts this long, and a treasure only goes up if bidding closes this long before the end. */
  openMs: 20000,
  endGapMs: 5000,
  /** What a treasure is worth before its kind: `base` plus `perMinute` for each minute gone, give or take 15%. */
  base: 60,
  perMinute: 25,
  kinds: { goblet: 1, lamp: 1.1, map: 1.2, orb: 1.4, egg: 1.6, mystery: 1, dragon: 2.2 } as Record<TreasureKind, number>,
  /** A mystery box is worth anything from `mystery[0]` to `mystery[1]` times a usual treasure. */
  mystery: [0.4, 2.2] as [number, number],
  /** Every this-many-th treasure is a mystery box (never the last). */
  mysteryEvery: 3,
  /** The lowest first bid is this share of what the treasure is worth (a mystery box: of a usual one). */
  minShare: 0.2,
  /** The iPad's bid buttons raise the leading bid by these. */
  steps: [10, 25, 50],
} as const;

const ORDER: TreasureKind[] = ['goblet', 'lamp', 'map', 'orb', 'egg'];
const roundMs = (r: Round) => r.lengthMin * 60000;
const fits = (r: Round, at: number) => at + AUCTION.openMs <= roundMs(r) - AUCTION.endGapMs;

/** At the start: the treasury is set and the first treasure is on its way. */
export function setAuction(r: Round) {
  r.boss.max = Math.round(r.boss.max * AUCTION.treasury[r.mode]);
  r.boss.hp = r.boss.max;
  r.auction = { lots: [], nextAt: fits(r, AUCTION.firstMs) ? AUCTION.firstMs : null };
  for (const id of r.order) r.players[id].vault = 0;
}

/** What a pupil has won so far is worth (their score minus this is the coins they can spend). */
export const vaultOf = (p: Player) => p.vault ?? 0;
export const coinsOf = (p: Player) => Math.max(0, p.score - vaultOf(p));

/** The treasure on sale now, if any. */
export function openLot(r: Round): Lot | null {
  const lot = r.auction?.lots[r.auction.lots.length - 1];
  return lot && lot.end === null ? lot : null;
}

/** The round time the auction next needs the engine: the hammer falling, or the next treasure going up. */
export function auctionDue(r: Round): number {
  const lot = openLot(r);
  return lot ? lot.endsAt : r.auction?.nextAt ?? Infinity;
}

/** Runs when `auctionDue` comes round: the hammer falls on the treasure on sale, or the next one goes up. */
export function auctionTick(r: Round, events: ShowdownEvent[]) {
  const a = r.auction;
  if (!a) return;
  const lot = openLot(r);
  if (lot) return hammer(r, lot, events);
  if (a.nextAt === null) return;
  const id = a.lots.length;
  const at = a.nextAt;
  const last = !fits(r, at + AUCTION.everyMs);
  const kind: TreasureKind = last ? 'dragon' : id % AUCTION.mysteryEvery === AUCTION.mysteryEvery - 1 ? 'mystery' : ORDER[(id + hashSeed(r.seed, `lot${id}`)) % ORDER.length];
  const h = hashSeed(r.seed, `value${id}`);
  const usual = (AUCTION.base + (AUCTION.perMinute * at) / 60000) * (0.85 + ((h % 1000) / 1000) * 0.3);
  const luck = kind === 'mystery' ? AUCTION.mystery[0] + (((h >>> 10) % 1000) / 1000) * (AUCTION.mystery[1] - AUCTION.mystery[0]) : AUCTION.kinds[kind];
  const value = Math.max(10, Math.round((usual * luck) / 5) * 5);
  const min = Math.max(10, Math.round((usual * AUCTION.kinds[kind === 'mystery' ? 'goblet' : kind] * AUCTION.minShare) / 5) * 5);
  a.lots.push({ id, kind, value, min, openAt: at, endsAt: at + AUCTION.openMs, top: 0, topBy: null, bids: 0, end: null });
  a.nextAt = last ? null : at + AUCTION.everyMs;
  events.push({ type: 'lot_open', t: r.t, lot: id, kind, value: kind === 'mystery' ? null : value, min, endsAt: at + AUCTION.openMs });
}

/** The hammer falls: the leading bid buys the treasure (the coins are spent, its value joins their fortune). */
function hammer(r: Round, lot: Lot, events: ShowdownEvent[]) {
  const p = lot.topBy ? r.players[lot.topBy] : null;
  if (!p) {
    lot.end = 'unsold';
    events.push({ type: 'lot_unsold', t: r.t, lot: lot.id, stolen: false });
    return;
  }
  lot.end = 'sold';
  const gain = lot.value - lot.top;
  p.score += gain;
  p.vault = vaultOf(p) + lot.value;
  if (p.team) r.teamPoints[p.team] = (r.teamPoints[p.team] ?? 0) + gain;
  events.push({ type: 'lot_sold', t: r.t, lot: lot.id, kind: lot.kind, pupil: p.id, team: p.team, bid: lot.top, value: lot.value });
}

/** Thieves got through: the treasure on sale is stolen, and nobody pays for it. */
export function thieves(r: Round, events: ShowdownEvent[]) {
  const lot = openLot(r);
  if (!lot) return;
  lot.end = 'stolen';
  events.push({ type: 'lot_unsold', t: r.t, lot: lot.id, stolen: true });
}

export type BidRefusal = 'no_lot' | 'too_low' | 'too_poor' | 'own_team' | 'already_top';

/** A pupil bids `amount` coins for the treasure on sale. */
export function bid(r: Round, id: string, amount: number, events: ShowdownEvent[]): BidRefusal | null {
  const p = r.players[id];
  const lot = openLot(r);
  if (!p || !lot || r.t >= lot.endsAt) return 'no_lot';
  if (lot.topBy === id) return 'already_top';
  if (p.team && lot.topBy && r.players[lot.topBy]?.team === p.team) return 'own_team';
  if (!Number.isInteger(amount) || amount < lot.min || amount <= lot.top) return 'too_low';
  if (amount > coinsOf(p)) return 'too_poor';
  lot.top = amount;
  lot.topBy = id;
  lot.bids++;
  p.lastActive = r.t;
  events.push({ type: 'bid', t: r.t, lot: lot.id, pupil: id, team: p.team as TeamId | null, amount });
  return null;
}
