/**
 * Arena clashes: a hero against a hero, one round at a time (James, 17 Nov 2026). Each round both players secretly pick
 * one of three attacks, then each answers a maths question:
 *
 *   Hammer smashes Sword, Sword cuts Net, Net tangles Hammer.
 *
 * Both heroes always swing. The one whose attack wins the clash hits twice as hard, the one whose attack loses hits half
 * as hard, and the same attack on both sides is a normal hit each. A right answer gives a full hit, a wrong answer only a
 * graze. Both heroes are the same strength here, whatever their level, so the picks and the maths decide it.
 *
 * No timer on the maths itself (the game's rule: no speed bonus); a round only has a long time limit so a classmate who
 * walks away can't hold the other up. A pick the clock took counts as no attack at all.
 *
 * Pure, so the server, the classmate screens and the practice fight all play the very same rounds.
 */
import { friendly, tierPower } from './data';

export type ClashMove = 'hammer' | 'sword' | 'net';
export const CLASH_MOVES: readonly ClashMove[] = ['hammer', 'sword', 'net'];

export const MOVE_INFO: Record<ClashMove, { name: string; icon: string; beats: ClashMove; verb: string }> = {
  hammer: { name: 'Hammer', icon: '🔨', beats: 'sword', verb: 'smashes' },
  sword: { name: 'Sword', icon: '⚔️', beats: 'net', verb: 'cuts' },
  net: { name: 'Net', icon: '🕸️', beats: 'hammer', verb: 'tangles' },
};

/** Health each hero starts a clash with (the same for everyone). */
export const CLASH_HP = 50;
/** A hit after a right answer, and after a wrong one. */
export const HIT_RIGHT = 10;
export const HIT_WRONG = 4;
/** Rounds in a clash. If the health is level after these, up to EXTRA_ROUNDS more decide it; after that it's a draw. */
export const CLASH_ROUNDS = 5;
export const EXTRA_ROUNDS = 3;
export const MAX_CLASH_ROUNDS = CLASH_ROUNDS + EXTRA_ROUNDS;

/** One player's go in a round. `move` null: the clock ran out before they picked. */
export interface ClashPick {
  move: ClashMove | null;
  right: boolean;
}

export type ClashSide = 0 | 1;
/** Who won the clash of attacks: a side, or 'tie'. */
export type ClashWinner = ClashSide | 'tie';

export interface ClashRound {
  picks: [ClashPick, ClashPick];
  clash: ClashWinner;
  /** The damage each side dealt this round (side 0's hit on side 1, side 1's hit on side 0). */
  hits: [number, number];
  /** Health after the round. */
  hp: [number, number];
}

export interface ClashState {
  rounds: ClashRound[];
  hp: [number, number];
  over: boolean;
  /** Who won the whole clash: a side, null for a draw (only once it's over). */
  winner: ClashSide | null;
}

/** Which attack wins: 0, 1 or 'tie'. No attack loses to any attack; two no-attacks tie. */
export function clashOf(a: ClashMove | null, b: ClashMove | null): ClashWinner {
  if (a === b) return 'tie';
  if (!a) return 1;
  if (!b) return 0;
  return MOVE_INFO[a].beats === b ? 0 : 1;
}

/** How hard a pick hits, given whether its attack won, lost or tied the clash. */
export function hitFor(pick: ClashPick, result: 'win' | 'lose' | 'tie'): number {
  if (!pick.move) return 0;
  const base = pick.right ? HIT_RIGHT : HIT_WRONG;
  return result === 'win' ? base * 2 : result === 'lose' ? Math.ceil(base / 2) : base;
}

export const newClash = (): ClashState => ({ rounds: [], hp: [CLASH_HP, CLASH_HP], over: false, winner: null });

/** Plays one round onto a clash that isn't over. */
export function playRound(state: ClashState, picks: [ClashPick, ClashPick]): ClashState {
  if (state.over) throw new Error('This clash is over');
  const clash = clashOf(picks[0].move, picks[1].move);
  const result = (side: ClashSide) => (clash === 'tie' ? 'tie' : clash === side ? 'win' : 'lose');
  const hits: [number, number] = [hitFor(picks[0], result(0)), hitFor(picks[1], result(1))];
  const hp: [number, number] = [Math.max(0, state.hp[0] - hits[1]), Math.max(0, state.hp[1] - hits[0])];
  const rounds = [...state.rounds, { picks, clash, hits, hp }];
  const knocked = hp[0] === 0 || hp[1] === 0;
  const level = hp[0] === hp[1];
  // Over when someone is down, after the five rounds unless it's level, and always after the extra rounds.
  const over = knocked || (rounds.length >= CLASH_ROUNDS && !level) || rounds.length >= MAX_CLASH_ROUNDS;
  const winner: ClashSide | null = !over || level ? null : hp[0] > hp[1] ? 0 : 1;
  return { rounds, hp, over, winner };
}

/** The clash after these rounds of picks. Throws if a round comes after the end. */
export function replayClash(picks: readonly [ClashPick, ClashPick][]): ClashState {
  return picks.reduce((s, p) => playRound(s, p), newClash());
}

/** The words for a round's clash of attacks: "Hammer smashes Sword!" */
export function clashLine(a: ClashMove | null, b: ClashMove | null): string {
  if (!a && !b) return 'Nobody attacked!';
  if (a === b) return `${MOVE_INFO[a as ClashMove].name} against ${MOVE_INFO[a as ClashMove].name}: a fair swing each!`;
  const w = clashOf(a, b) === 0 ? a : b;
  const l = w === a ? b : a;
  if (!l) return `${MOVE_INFO[w as ClashMove].name}, and nothing to stop it!`;
  return `${MOVE_INFO[w as ClashMove].name} ${MOVE_INFO[w as ClashMove].verb} ${MOVE_INFO[l].name}!`;
}

/** Reads a pick as the browser sends it (null if it isn't one). The clock's "no attack" is never sent: only the server makes those. */
export function readMove(raw: unknown): ClashMove | null {
  return typeof raw === 'string' && (CLASH_MOVES as readonly string[]).includes(raw) ? (raw as ClashMove) : null;
}

// ---------- Gold ----------

/** Classmate clashes a day that pay gold (more can be played, for fun). */
export const PAID_CLASHES_PER_DAY = 3;

/** The winner's gold: about what a forest fight at their level pays. */
export const clashGold = (winnerLevel: number): number => friendly(tierPower(winnerLevel) * 1.2);

/** What each side is paid when a clash ends: the winner the full amount, the other half of it. A draw pays both half. */
export function clashPrize(winner: ClashSide | null, levels: [number, number]): [number, number] {
  if (winner === null) {
    const half = (l: number) => Math.max(1, Math.round(clashGold(l) / 2));
    return [half(levels[0]), half(levels[1])];
  }
  const full = clashGold(levels[winner]);
  const half = Math.max(1, Math.round(full / 2));
  return winner === 0 ? [full, half] : [half, full];
}

// ---------- The computer, for practice ----------

/** A practice opponent's pick: any attack, and a right answer about 7 times in 10. */
export function computerPick(rand: () => number): ClashPick {
  return { move: CLASH_MOVES[Math.floor(rand() * 3) % 3], right: rand() < 0.7 };
}
