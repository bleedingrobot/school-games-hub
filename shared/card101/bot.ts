/**
 * The 101 bots. A bot is only ever given its own seat's view (view.ts) and its own
 * memory of what it has seen, built from those views and the events it was shown. It is
 * never given the game itself, so it can't peek at the stack or anyone's cards: the
 * types make that impossible, and bot.test.ts checks it.
 *
 *   Very Easy: forgets what it has seen, keeps only low cards, swaps into a random spot,
 *              and knocks at random.
 *   Easy:      remembers its own cards, swaps out its highest one, and knocks when its
 *              hand looks low. It doesn't watch the other players.
 *   Medium:    remembers everything a careful player could (its peek, every card on the
 *              discard pile, what the others took and where they put it), works out the
 *              chances for the cards it can't see, and knocks when it's probably lowest.
 */
import type { BotLevel } from '../botGame';
import { cardValue, PACK, rankOf, SLOTS, type Card, type Slot } from './cards';
import type { Action, GameEvent } from './engine';
import { scoreHand } from './score';
import type { SeatView } from './view';

export interface BotMemory {
  seat: number;
  round: number;
  /** The bot's own four cards, where it knows them. */
  own: (Card | null)[];
  /** Other players' cards it saw them take off the discard pile (Medium uses these). */
  others: (Card | null)[][];
  /**
   * Spots where another player swapped in a card from the stack. Nobody saw it, but they
   * chose to keep it, so it's probably low. A careful human player would guess the same.
   */
  othersKept: boolean[][];
  /** Every card on the discard pile right now (it saw each one go there). */
  discardPile: Card[];
  /** The last held card it saw (anyone's, if it could see it), to know what went into a hand. */
  lastSeenHolding: { seat: number; card: Card | null } | null;
}

export function newMemory(seat: number, players: number): BotMemory {
  return {
    seat,
    round: 0,
    own: [null, null, null, null],
    others: Array.from({ length: players }, () => [null, null, null, null]),
    othersKept: Array.from({ length: players }, () => [false, false, false, false]),
    discardPile: [],
    lastSeenHolding: null,
  };
}

/** Updates a bot's memory from what its seat was just shown. Pure: returns a new memory. */
export function observe(memory: BotMemory, view: SeatView, events: readonly GameEvent[]): BotMemory {
  const m = structuredClone(memory);
  for (const event of events) {
    switch (event.kind) {
      case 'deal':
        m.round = event.round;
        m.own = [null, null, null, null];
        m.others = m.others.map(() => [null, null, null, null]);
        m.othersKept = m.othersKept.map(() => [false, false, false, false]);
        m.discardPile = [event.discardTop];
        break;
      case 'draw':
        if (event.from === 'discard') m.discardPile.pop();
        break;
      case 'swap': {
        const held = heldCard(m, event.seat, events, event);
        if (event.seat === m.seat) m.own[event.slot] = held;
        else {
          m.others[event.seat][event.slot] = held;
          m.othersKept[event.seat][event.slot] = held === null;
        }
        m.discardPile.push(event.discarded);
        break;
      }
      case 'throw':
        m.discardPile.push(event.card);
        break;
      case 'skip':
        if (event.discarded) m.discardPile.push(event.discarded);
        break;
      case 'reshuffle':
        m.discardPile = m.discardPile.slice(-1);
        break;
      case 'out':
        m.others[event.seat] = [null, null, null, null];
        m.othersKept[event.seat] = [false, false, false, false];
        break;
      default:
        break;
    }
  }
  if (view.peek) view.peek.slots.forEach((slot, i) => (m.own[slot] = view.peek!.cards[i]));
  // A card being held lands in someone's hand if they swap it in (seen in the next update).
  m.lastSeenHolding = view.holding ? { seat: view.holding.seat, card: view.holding.card } : null;
  return m;
}

/**
 * The card a player put into their hand with a swap: the one they were last seen holding
 * (known if it's the bot's own, or came off the discard pile), or found in the same batch.
 */
function heldCard(m: BotMemory, seat: number, events: readonly GameEvent[], swap: GameEvent): Card | null {
  const at = events.indexOf(swap);
  for (let i = at - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === 'draw' && e.seat === seat) return e.card ?? null;
    if (e.kind === 'turn' || e.kind === 'deal') break;
  }
  if (m.lastSeenHolding && m.lastSeenHolding.seat === seat) return m.lastSeenHolding.card;
  return null;
}

/** Decides the bot's next action. `random` gives numbers from 0 up to 1. */
export function decide(view: SeatView, memory: BotMemory, level: BotLevel, random: () => number): Action {
  if (view.phase === 'peek') return { type: 'peek-done' };
  if (view.phase !== 'play' || view.turn !== view.seat) throw new Error("It isn't this bot's turn");
  const known = level === 'very-easy' ? memory.own.map((c) => (c && random() < 0.4 ? null : c)) : [...memory.own];

  if (view.holding) {
    const card = view.holding.card!;
    return level === 'very-easy' ? veryEasyPlace(card, known, random) : bestPlace(card, known, pool(view, memory, level), level, random);
  }

  if (view.canKnock && wantsToKnock(view, memory, known, level, random)) return { type: 'knock' };

  const top = view.discardTop;
  if (top) {
    if (level === 'very-easy') {
      if (cardValue(top) <= 2) return { type: 'draw', from: 'discard' };
    } else {
      const cards = pool(view, memory, level);
      const now = expectedScore(known, cards, random, samplesFor(level));
      const place = bestPlace(top, known, cards, level, random);
      if (place.type === 'swap') {
        const after = [...known];
        after[place.slot] = top;
        const gain = now - expectedScore(after, cards, random, samplesFor(level));
        if (level === 'easy' ? gain >= 3 : gain >= stackGain(known, cards, random) + MEDIUM_TUNING.stackBonus) return { type: 'draw', from: 'discard' };
      }
    }
  }
  return { type: 'draw', from: 'stack' };
}

/** Medium's settings, tuned with the simulation (docs/101-PLAN.md section 13): knocking only on a low hand wins most. */
const MEDIUM_TUNING = { knockCap: 5, knockMargin: 0, guessOffset: 1.5, stackBonus: 0.5, alwaysKnockAt: 3 } as const;

const samplesFor = (level: BotLevel) => (level === 'medium' ? 32 : 10);

function veryEasyPlace(card: Card, known: (Card | null)[], random: () => number): Action {
  if (cardValue(card) > 4 && rankOf(card) !== '3') return { type: 'throw' };
  // Swap out a high card it remembers, or else a random one.
  const high = SLOTS.filter((s) => known[s] && cardValue(known[s]!) >= 7);
  const slots = high.length ? high : SLOTS;
  return { type: 'swap', slot: slots[Math.floor(random() * slots.length)] };
}

/** Swap into the spot that lowers the expected hand most, or throw it away. */
function bestPlace(card: Card, known: (Card | null)[], cards: Card[], level: BotLevel, random: () => number): Action {
  const fills = sampleFills(known, cards.filter((c) => c !== card), random, samplesFor(level));
  const now = averageScore(known, fills);
  let best: Slot | null = null;
  let bestScore = now - (level === 'easy' ? 0.5 : 0.25);
  for (const slot of SLOTS) {
    const after = [...known];
    after[slot] = card;
    const score = averageScore(after, fills);
    if (score < bestScore) {
      bestScore = score;
      best = slot;
    }
  }
  return best === null ? { type: 'throw' } : { type: 'swap', slot: best };
}

/**
 * The cards an unknown card could be. Medium leaves out everything it knows is somewhere
 * else (the discard pile, other players' known cards). Easy only leaves out its own cards.
 */
function pool(view: SeatView, memory: BotMemory, level: BotLevel): Card[] {
  const elsewhere = new Set<Card>(memory.own.filter((c): c is Card => c !== null));
  if (view.holding?.card) elsewhere.add(view.holding.card);
  if (level === 'medium') {
    for (const c of memory.discardPile) elsewhere.add(c);
    for (const hand of memory.others) for (const c of hand) if (c) elsewhere.add(c);
  } else if (view.discardTop) {
    elsewhere.add(view.discardTop);
  }
  return PACK.filter((c) => !elsewhere.has(c));
}

/** Random guesses for the unknown spots, drawn without repeats from `cards`. */
function sampleFills(known: (Card | null)[], cards: Card[], random: () => number, samples: number): Card[][] {
  const unknown = known.filter((c) => c === null).length;
  const fills: Card[][] = [];
  for (let n = 0; n < samples; n++) {
    const picked: Card[] = [];
    const left = [...cards];
    for (let i = 0; i < unknown && left.length; i++) picked.push(left.splice(Math.floor(random() * left.length), 1)[0]);
    fills.push(picked);
  }
  return fills;
}

function averageScore(known: (Card | null)[], fills: Card[][]): number {
  let sum = 0;
  for (const fill of fills) {
    let i = 0;
    sum += scoreHand(known.map((c) => c ?? fill[i++] ?? 'KS')).total;
  }
  return sum / fills.length;
}

function expectedScore(known: (Card | null)[], cards: Card[], random: () => number, samples: number): number {
  return averageScore(known, sampleFills(known, cards, random, samples));
}

function wantsToKnock(view: SeatView, memory: BotMemory, known: (Card | null)[], level: BotLevel, random: () => number): boolean {
  if (level === 'very-easy') return random() < 0.2;
  const cards = pool(view, memory, level);
  const mine = expectedScore(known, cards, random, samplesFor(level));
  if (level === 'easy') return mine <= 9;
  // Medium: knock when it's probably lowest, even after everyone's last turn.
  if (mine <= MEDIUM_TUNING.alwaysKnockAt) return true;
  const others = view.totals
    .map((_, seat) => seat)
    .filter((seat) => seat !== view.seat && !view.out[seat])
    .map((seat) => guessHand(memory, seat, cards, random) - MEDIUM_TUNING.guessOffset);
  const theirBest = Math.min(...others);
  return mine <= MEDIUM_TUNING.knockCap && mine < theirBest - MEDIUM_TUNING.knockMargin;
}

/** Medium's guess at another player's hand: known cards, low guesses for kept stack cards. */
function guessHand(memory: BotMemory, seat: number, cards: Card[], random: () => number): number {
  const low = cards.filter((c) => cardValue(c) <= 5);
  let sum = 0;
  const samples = 16;
  for (let n = 0; n < samples; n++) {
    const used = new Set<Card>();
    const pick = (from: Card[]) => {
      for (let tries = 0; tries < 20; tries++) {
        const c = from[Math.floor(random() * from.length)];
        if (!used.has(c)) {
          used.add(c);
          return c;
        }
      }
      return 'KS' as Card;
    };
    const hand = SLOTS.map((slot) => memory.others[seat][slot] ?? pick(memory.othersKept[seat][slot] && low.length ? low : cards));
    sum += scoreHand(hand).total;
  }
  return sum / samples;
}

/** Medium: how much a card off the stack would lower its hand, on average. */
function stackGain(known: (Card | null)[], cards: Card[], random: () => number): number {
  const fills = sampleFills(known, cards, random, 16);
  const now = averageScore(known, fills);
  let gain = 0;
  const draws = 10;
  for (let n = 0; n < draws; n++) {
    const card = cards[Math.floor(random() * cards.length)];
    let best = now;
    for (const slot of SLOTS) {
      const after = [...known];
      after[slot] = card;
      best = Math.min(best, averageScore(after, fills));
    }
    gain += now - best;
  }
  return gain / draws;
}
