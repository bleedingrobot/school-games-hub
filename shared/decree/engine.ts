/**
 * Royal Decree's rules, as pure functions (docs/DECREE-PLAN.md): the same seed and the same moves always give the same
 * reign. The browser plays with these for instant feedback; the server replays the same moves to save the reign and
 * give points, using only the riddle answers it marked itself.
 *
 * A reign is a run of cards. Every RIDDLE_EVERY-th card is a riddle (a maths question from the pupil's focus); the
 * rest are villagers' requests, answered yes or no, each nudging the four meters. A meter at 0 ends the reign. Each
 * new year the food goes down a little. Living through all the cards is a full reign.
 */
import { seededRandom } from '../maths/serverQuestions';
import {
  CARDS_IN_REIGN, EFFECT_MOST, METER_MOST, METER_START, METERS, POINTS, RIDDLE_BONUS, RIDDLE_EVERY, SEASONS,
  WINTER_FOOD, type Meter,
} from './config';
import type { Card, Choice, Effect, Riddle } from './types';

export type Meters = Record<Meter, number>;
export type EndingId = Meter | 'full';
export type Side = 'yes' | 'no';
/** One move: a side for a request card, 'riddle' for a riddle card (answered or skipped). */
export type Move = Side | 'riddle';

export interface Reign {
  seed: string;
  meters: Meters;
  /** Cards finished so far (0 to CARDS_IN_REIGN). The next card is number turn + 1. */
  turn: number;
  flags: string[];
  /** Request cards already seen this reign (none comes twice). */
  used: string[];
  /** Riddles answered right. */
  stars: number;
  /** Villagers met this reign (for the Royal Album). */
  met: string[];
  status: 'playing' | 'over' | 'full';
  ending?: EndingId;
}

/** What comes next: a request card, or a riddle (with its slot: which maths question of the reign it is). */
export type Next = { kind: 'card'; card: Card } | { kind: 'riddle'; riddle: Riddle; slot: number };

export interface Deck {
  cards: readonly Card[];
  riddles: readonly Riddle[];
}

export const newReign = (seed: string): Reign => ({
  seed,
  meters: { food: METER_START, gold: METER_START, happy: METER_START, safe: METER_START },
  turn: 0,
  flags: [],
  used: [],
  stars: 0,
  met: [],
  status: 'playing',
});

/** Is card number n (1-based) a riddle? */
export const isRiddleTurn = (n: number) => n % RIDDLE_EVERY === 0;
/** The riddle slot (0-based) for card number n. */
export const riddleSlot = (n: number) => n / RIDDLE_EVERY - 1;
/** How many riddles a full reign has (the server makes this many questions). */
export const RIDDLES_IN_REIGN = Math.floor(CARDS_IN_REIGN / RIDDLE_EVERY);

/** The year (1-based) a card number falls in, and its season (0 to SEASONS − 1). */
export const yearOf = (n: number) => Math.ceil(n / SEASONS);
export const seasonOf = (n: number) => (n - 1) % SEASONS;
/** Whole years lived through. */
export const yearsLived = (reign: Reign) => Math.floor(reign.turn / SEASONS);

function pickWeighted<T>(items: readonly T[], weight: (t: T) => number, random: () => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = random() * total;
  for (const t of items) {
    r -= weight(t);
    if (r < 0) return t;
  }
  return items[items.length - 1];
}

/** The card that comes next. Same reign, same card: the random numbers come from the seed and the card number. */
export function nextCard(reign: Reign, deck: Deck): Next | null {
  if (reign.status !== 'playing') return null;
  const n = reign.turn + 1;
  const random = seededRandom(`${reign.seed}:${n}`);
  if (isRiddleTurn(n)) {
    return { kind: 'riddle', riddle: deck.riddles[Math.floor(random() * deck.riddles.length)], slot: riddleSlot(n) };
  }
  const open = deck.cards.filter((c) => !reign.used.includes(c.id) && (!c.needs || reign.flags.includes(c.needs)) && (c.from ?? 1) <= n);
  if (!open.length) return null;
  // Follow-ups to a story the pupil started are much more likely, so stories carry on.
  return { kind: 'card', card: pickWeighted(open, (c) => (c.weight ?? 1) * (c.needs ? 4 : 1), random) };
}

const clampMeter = (v: number) => Math.max(0, Math.min(METER_MOST, v));

/** The meters after an effect (each kept between 0 and METER_MOST). */
export function applyEffect(meters: Meters, effect: Effect): Meters {
  const out = { ...meters };
  for (const m of METERS) out[m] = clampMeter(out[m] + Math.max(-EFFECT_MOST, Math.min(EFFECT_MOST, effect[m] ?? 0)));
  return out;
}

const emptyMeter = (meters: Meters): Meter | undefined => METERS.find((m) => meters[m] <= 0);

/** What happens after the card: winter at a new year, an empty meter ending the reign, or a full reign. */
function afterCard(reign: Reign): Reign {
  let r = reign;
  let empty = emptyMeter(r.meters);
  if (!empty && r.turn < CARDS_IN_REIGN && r.turn % SEASONS === 0) {
    r = { ...r, meters: applyEffect(r.meters, { food: -WINTER_FOOD }) };
    empty = emptyMeter(r.meters);
  }
  if (empty) return { ...r, status: 'over', ending: empty };
  if (r.turn >= CARDS_IN_REIGN) return { ...r, status: 'full', ending: 'full' };
  return r;
}

/**
 * Plays one move. For a riddle, `right` says whether the server marked the answer right (false when skipped or
 * wrong: nothing is lost). A move that doesn't fit the card (a side on a riddle, or the other way) is refused (null).
 */
const meet = (met: string[], who: string) => (met.includes(who) ? met : [...met, who]);

export function play(reign: Reign, deck: Deck, move: Move, right = false): Reign | null {
  const next = nextCard(reign, deck);
  if (!next) return null;
  if (next.kind === 'riddle') {
    if (move !== 'riddle') return null;
    const meters = right ? applyEffect(reign.meters, { [next.riddle.meter]: RIDDLE_BONUS }) : reign.meters;
    return afterCard({ ...reign, meters, turn: reign.turn + 1, stars: reign.stars + (right ? 1 : 0), met: meet(reign.met, next.riddle.who) });
  }
  if (move === 'riddle') return null;
  const choice: Choice = next.card[move];
  return afterCard({
    ...reign,
    meters: applyEffect(reign.meters, choice.effect),
    turn: reign.turn + 1,
    used: [...reign.used, next.card.id],
    met: meet(reign.met, next.card.who),
    flags: choice.sets && !reign.flags.includes(choice.sets) ? [...reign.flags, choice.sets] : reign.flags,
  });
}

/** Plays a list of moves from a reign; riddle results come from `rightAt(slot)`. Null if any move doesn't fit. */
export function playAll(reign: Reign, deck: Deck, moves: readonly Move[], rightAt: (slot: number) => boolean): Reign | null {
  let r: Reign | null = reign;
  for (const move of moves) {
    if (!r) return null;
    const n = r.turn + 1;
    r = play(r, deck, move, isRiddleTurn(n) && rightAt(riddleSlot(n)));
  }
  return r;
}

/** Points for a finished reign: 1, +1 a year lived (up to 3), +1 for a full reign. */
export function pointsFor(reign: Reign): number {
  if (reign.status === 'playing') return 0;
  return POINTS.played + Math.min(POINTS.yearsCounted, yearsLived(reign)) * POINTS.perYear + (reign.status === 'full' ? POINTS.full : 0);
}

/** Which way each meter moves for a choice, for the hints shown while the pupil decides: −2 to +2 "arrows". */
export function hintFor(choice: Choice): Partial<Record<Meter, number>> {
  const out: Partial<Record<Meter, number>> = {};
  for (const m of METERS) {
    const v = choice.effect[m] ?? 0;
    if (v) out[m] = v > 0 ? Math.min(2, v) : Math.max(-2, v);
  }
  return out;
}
