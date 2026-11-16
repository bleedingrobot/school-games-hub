/**
 * Live Clan Duels (docs/CLANS-PVP-PLAN.md, stage 2; James, 17 Nov 2026): two classmates' clans, live, one round at a time.
 * Each round both secretly pick an order, then answer a maths question:
 *
 *   Charge rides down the Volley, the Volley rains over the Shield Wall, the Shield Wall stops the Charge.
 *
 * Both clans always attack. The order that wins the clash hits twice as hard, the one that loses half as hard, and the same
 * order on both sides is a normal hit each. A right answer is a full hit, a wrong one a graze. Clans start level, and the
 * village gives each a few bonuses (never more than about a fifth), so a brand-new clan can beat a big one:
 *
 *   Forge: hits a little harder.  Walls: takes a little less.  Barracks: a little more strength.
 *   Tower: an opening volley before round 1.  Church: one heal the first time strength drops below half.
 *
 * Pure, so the server, both screens and the practice duel all play the very same rounds.
 */
import type { Levels } from './types';

export type DuelMove = 'charge' | 'volley' | 'shield';
export const DUEL_MOVES: readonly DuelMove[] = ['charge', 'volley', 'shield'];

export const DUEL_MOVE_INFO: Record<DuelMove, { name: string; icon: string; beats: DuelMove; verb: string }> = {
  charge: { name: 'Charge', icon: '🐎', beats: 'volley', verb: 'rides down' },
  volley: { name: 'Volley', icon: '🏹', beats: 'shield', verb: 'rains over' },
  shield: { name: 'Shield Wall', icon: '🛡️', beats: 'charge', verb: 'stops' },
};

/** Strength each clan starts with, before the Barracks. */
export const DUEL_HP = 60;
export const DUEL_HIT_RIGHT = 10;
export const DUEL_HIT_WRONG = 4;
export const DUEL_ROUNDS = 5;
export const DUEL_EXTRA_ROUNDS = 3;
export const MAX_DUEL_ROUNDS = DUEL_ROUNDS + DUEL_EXTRA_ROUNDS;

/** What each village level adds (levels top out at 5, the Church at 3). */
export const DUEL_BONUS = { forgePer: 0.04, wallsPer: 0.04, barracksHp: 2, towerHit: 2, churchHeal: 3 } as const;

/** The village bonuses a clan brings to a duel (its building levels when the challenge was sent). */
export type DuelVillage = Pick<Levels, 'forge' | 'walls' | 'barracks' | 'tower' | 'church' | 'strongroom'>;
export const NO_VILLAGE: DuelVillage = { forge: 0, walls: 0, barracks: 0, tower: 0, church: 0, strongroom: 0 };

export const villageOf = (levels: Partial<Levels> | null | undefined): DuelVillage => {
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const l = levels ?? {};
  return { forge: n(l.forge, 5), walls: n(l.walls, 5), barracks: n(l.barracks, 5), tower: n(l.tower, 5), church: n(l.church, 3), strongroom: n(l.strongroom, 5) };
};

export const startHp = (v: DuelVillage) => DUEL_HP + v.barracks * DUEL_BONUS.barracksHp;

/** One clan's go in a round. `move` null: the clock ran out before they picked. */
export interface DuelPick {
  move: DuelMove | null;
  right: boolean;
}

export type DuelSide = 0 | 1;
export type DuelWinner = DuelSide | 'tie';

export interface DuelRound {
  picks: [DuelPick, DuelPick];
  clash: DuelWinner;
  /** Damage each side dealt this round (side 0's on side 1, side 1's on side 0). */
  hits: [number, number];
  /** Church heals this round. */
  heals: [number, number];
  hp: [number, number];
}

export interface DuelState {
  /** The Tower volleys before round 1 (side 0's on side 1, side 1's on side 0). */
  opening: [number, number];
  rounds: DuelRound[];
  hp: [number, number];
  max: [number, number];
  /** Has each side's Church healed yet? */
  healed: [boolean, boolean];
  over: boolean;
  winner: DuelSide | null;
}

export function duelClashOf(a: DuelMove | null, b: DuelMove | null): DuelWinner {
  if (a === b) return 'tie';
  if (!a) return 1;
  if (!b) return 0;
  return DUEL_MOVE_INFO[a].beats === b ? 0 : 1;
}

/** How hard a clan's pick hits, with its Forge, against the other clan's Walls. */
export function duelHit(pick: DuelPick, result: 'win' | 'lose' | 'tie', mine: DuelVillage, theirs: DuelVillage): number {
  if (!pick.move) return 0;
  const base = pick.right ? DUEL_HIT_RIGHT : DUEL_HIT_WRONG;
  const clash = result === 'win' ? base * 2 : result === 'lose' ? base / 2 : base;
  return Math.max(1, Math.round(clash * (1 + mine.forge * DUEL_BONUS.forgePer) * (1 - theirs.walls * DUEL_BONUS.wallsPer)));
}

export function newDuel(villages: [DuelVillage, DuelVillage]): DuelState {
  const max: [number, number] = [startHp(villages[0]), startHp(villages[1])];
  const opening: [number, number] = [villages[0].tower * DUEL_BONUS.towerHit, villages[1].tower * DUEL_BONUS.towerHit];
  return { opening, rounds: [], hp: [max[0] - opening[1], max[1] - opening[0]], max, healed: [false, false], over: false, winner: null };
}

/** Plays one round onto a duel that isn't over. */
export function playDuelRound(state: DuelState, picks: [DuelPick, DuelPick], villages: [DuelVillage, DuelVillage]): DuelState {
  if (state.over) throw new Error('This duel is over');
  const clash = duelClashOf(picks[0].move, picks[1].move);
  const result = (side: DuelSide) => (clash === 'tie' ? 'tie' : clash === side ? 'win' : 'lose');
  const hits: [number, number] = [duelHit(picks[0], result(0), villages[0], villages[1]), duelHit(picks[1], result(1), villages[1], villages[0])];
  const hp: [number, number] = [Math.max(0, state.hp[0] - hits[1]), Math.max(0, state.hp[1] - hits[0])];
  const healed: [boolean, boolean] = [...state.healed];
  const heals: [number, number] = [0, 0];
  // The Church heals once, the first time a clan still standing drops below half its strength.
  for (const side of [0, 1] as const) {
    const heal = villages[side].church * DUEL_BONUS.churchHeal;
    if (!healed[side] && heal > 0 && hp[side] > 0 && hp[side] < state.max[side] / 2) {
      healed[side] = true;
      heals[side] = Math.min(heal, state.max[side] - hp[side]);
      hp[side] += heals[side];
    }
  }
  const rounds = [...state.rounds, { picks, clash, hits, heals, hp }];
  const knocked = hp[0] === 0 || hp[1] === 0;
  // Who is ahead: the bigger share of their own strength left (so a big Barracks doesn't win a draw by itself).
  const share = (side: DuelSide) => hp[side] / state.max[side];
  const level = Math.abs(share(0) - share(1)) < 1e-9;
  const over = knocked || (rounds.length >= DUEL_ROUNDS && !level) || rounds.length >= MAX_DUEL_ROUNDS;
  const winner: DuelSide | null = !over || (level && !knocked) ? null : hp[0] === 0 && hp[1] === 0 ? null : hp[1] === 0 ? 0 : hp[0] === 0 ? 1 : share(0) > share(1) ? 0 : 1;
  return { ...state, rounds, hp, healed, over, winner };
}

export function replayDuel(picks: readonly [DuelPick, DuelPick][], villages: [DuelVillage, DuelVillage]): DuelState {
  return picks.reduce((s, p) => playDuelRound(s, p, villages), newDuel(villages));
}

/** "Charge rides down Volley!" */
export function duelLine(a: DuelMove | null, b: DuelMove | null): string {
  if (!a && !b) return 'Nobody moved!';
  if (a === b) return `${DUEL_MOVE_INFO[a as DuelMove].name} against ${DUEL_MOVE_INFO[a as DuelMove].name}: a fair hit each!`;
  const w = duelClashOf(a, b) === 0 ? a : b;
  const l = w === a ? b : a;
  if (!l) return `${DUEL_MOVE_INFO[w as DuelMove].name}, and nothing to stop it!`;
  return `${DUEL_MOVE_INFO[w as DuelMove].name} ${DUEL_MOVE_INFO[w as DuelMove].verb} ${DUEL_MOVE_INFO[l].name}!`;
}

export function readDuelMove(raw: unknown): DuelMove | null {
  return typeof raw === 'string' && (DUEL_MOVES as readonly string[]).includes(raw) ? (raw as DuelMove) : null;
}

// ---------- Prizes ----------

/** Duels a day that pay (more can be played, for fun). */
export const PAID_DUELS_PER_DAY = 3;
export const DUEL_PRIZE = { won: { gold: 40, banners: 3 }, lost: { gold: 15, banners: 1 }, draw: { gold: 25, banners: 2 }, strongroomGold: 5 } as const;

/** What each side gets when a duel is played to the end. Nobody ever loses anything. */
export function duelPrize(winner: DuelSide | null, villages: [DuelVillage, DuelVillage]): { gold: [number, number]; banners: [number, number] } {
  const one = (side: DuelSide) => {
    const p = winner === null ? DUEL_PRIZE.draw : winner === side ? DUEL_PRIZE.won : DUEL_PRIZE.lost;
    return { gold: p.gold + villages[side].strongroom * DUEL_PRIZE.strongroomGold, banners: p.banners };
  };
  const a = one(0);
  const b = one(1);
  return { gold: [a.gold, b.gold], banners: [a.banners, b.banners] };
}

// ---------- The computer, for practice ----------

/** A practice rival's pick: any order, and a right answer about 7 times in 10. */
export function computerDuelPick(rand: () => number): DuelPick {
  return { move: DUEL_MOVES[Math.floor(rand() * 3) % 3], right: rand() < 0.7 };
}
