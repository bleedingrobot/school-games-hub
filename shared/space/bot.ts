/**
 * Bots for Wormholes & Black Holes. Dice are luck, so a bot's skill is all in its choices:
 * - Cadet (very easy) uses items at random and makes random choices.
 * - Pilot (easy) uses items sensibly.
 * - Commander (medium) also saves its Navigator for the finish, aims hinders at the leader
 *   and only uses items when they're worth it.
 * Bots follow exactly the same rules as students: they can only send actions `play` accepts.
 * The server also uses the Pilot for autopilot, so this file has no browser-only code.
 */
import type { BotLevel } from '../botGame';
import { cometTail } from './board';
import {
  canCharge,
  choiceOptions,
  moveTarget,
  nextWormhole,
  stepsFor,
  usableItems,
  validTargets,
  KEEP_ITEMS,
  type SpaceAction,
  type SpaceState,
  type TurnInfo,
} from './engine';
import type { ItemKind } from './items';

export { BOT_NAMES } from './names';

/** How often each bot answers Mission Control's questions right (so maths doesn't just beat bots). */
export const BOT_MATHS: Record<BotLevel, number> = { 'very-easy': 0.6, easy: 0.75, medium: 0.9 };

/** How much a bot likes holding each item (for "pockets full" choices). */
const ITEM_VALUE: Record<ItemKind, number> = {
  'rescue-beacon': 10, navigator: 9, hyperdrive: 8, 'quantum-swap': 7, 'warp-key': 6,
  'force-field': 6, booster: 4, 'escape-pod': 4, 'tractor-beam': 3, 'gravity-anchor': 3,
  'space-mine': 2, 'repair-kit': 2,
};

/**
 * Roughly how good it is to end up on a square after moving this many steps: just the
 * wormhole, black hole, comet or mine there (not chains). Docking scores highest.
 */
export function landingValue(s: SpaceState, seat: number, steps: number): number {
  const r = s.rockets[seat];
  const { to } = moveTarget(s, r.position, steps);
  const size = s.board.size;
  if (to >= size) return size + 20;
  const square = s.board.squares[to];
  if (s.mines.some((m) => m.square === to && m.owner !== seat)) return to - 3;
  if (s.comet && cometTail(s.comet).includes(to)) return s.comet.head;
  if (square?.kind === 'wormhole') return square.to;
  if (square?.kind === 'black-hole') {
    if (r.items.includes('force-field')) return to - 1; // safe, but uses up the Force Field
    if (r.items.includes('escape-pod')) return to - Math.max(1, Math.floor((to - square.to) / 2));
    return square.to;
  }
  if (square?.kind === 'star') return to + 1.5;
  if (square?.kind === 'gate' && square.twin > to) return square.twin;
  return to;
}

/** The average landing value over the six die faces, with these turn boosts. */
function averageLanding(s: SpaceState, seat: number, boosts: Partial<TurnInfo>): number {
  const t = { ...s.turnInfo, ...boosts };
  let total = 0;
  for (let die = 1; die <= 6; die++) total += landingValue(s, seat, stepsFor(s.rockets[seat], t, die).steps);
  return total / 6;
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

/** The target a bot aims a hinder at: Commander and Pilot pick whoever is furthest ahead. */
function bestTarget(s: SpaceState, item: ItemKind): number {
  return validTargets(s, item).reduce((best, i) => (s.rockets[i].position > s.rockets[best].position ? i : best));
}

interface Plan {
  action: SpaceAction;
  /** Roughly how many squares better off this leaves the bot (or worse off the others). */
  worth: number;
}

function itemPlans(s: SpaceState, level: BotLevel): Plan[] {
  const seat = s.turn;
  const me = s.rockets[seat];
  const size = s.board.size;
  const commander = level === 'medium';
  const plain = averageLanding(s, seat, {});
  const plans: Plan[] = [];
  for (const item of usableItems(s)) {
    switch (item) {
      case 'rescue-beacon':
        plans.push({ action: { kind: 'use-item', item }, worth: 10 });
        break;
      case 'repair-kit':
        plans.push({ action: { kind: 'use-item', item }, worth: me.gravity?.kind === 'heavy' || me.anchored ? 3 : 0 });
        break;
      case 'booster':
        plans.push({ action: { kind: 'use-item', item }, worth: averageLanding(s, seat, { booster: true }) - plain });
        break;
      case 'hyperdrive':
        plans.push({ action: { kind: 'use-item', item }, worth: averageLanding(s, seat, { hyperdrive: true }) - plain });
        break;
      case 'navigator': {
        let best = 1;
        let bestValue = -Infinity;
        for (let value = 1; value <= 6; value++) {
          const v = landingValue(s, seat, stepsFor(me, s.turnInfo, value).steps);
          if (v > bestValue) [best, bestValue] = [value, v];
        }
        const docks = bestValue > size;
        // The Commander keeps it for the finish unless it wins or rides a big wormhole.
        const worth = commander && !docks && bestValue - plain < 12 ? 0 : bestValue - plain;
        plans.push({ action: { kind: 'use-item', item, value: best }, worth });
        break;
      }
      case 'warp-key': {
        const mouth = nextWormhole(s, me.position)!;
        const square = s.board.squares[mouth] as { to: number };
        plans.push({ action: { kind: 'use-item', item }, worth: square.to - me.position - (commander ? 4 : 2) });
        break;
      }
      case 'quantum-swap': {
        const target = bestTarget(s, item);
        const gain = s.rockets[target].position - me.position;
        plans.push({ action: { kind: 'use-item', item, target }, worth: gain - (commander ? 5 : 3) });
        break;
      }
      case 'tractor-beam':
      case 'gravity-anchor': {
        const target = bestTarget(s, item);
        const ahead = s.rockets[target].position > me.position;
        const leader = s.rockets.every((r) => r.position <= s.rockets[target].position);
        const worth = !ahead ? 0 : item === 'tractor-beam' ? 2 : 1.5;
        plans.push({ action: { kind: 'use-item', item, target }, worth: commander && !leader ? 0 : worth });
        break;
      }
      case 'space-mine': {
        const chasers = s.rockets.filter((r, i) => i !== seat && me.position - r.position >= 1 && me.position - r.position <= 6).length;
        plans.push({ action: { kind: 'use-item', item }, worth: chasers > 0 ? 1.2 : 0 });
        break;
      }
      default:
        break;
    }
  }
  return plans;
}

/** What a bot does next, when it's its turn (or its choice). `random` gives 0–1. */
export function botAction(s: SpaceState, level: BotLevel, random: () => number): SpaceAction {
  if (s.phase === 'choice' && s.pending) return { kind: 'choose', option: botChoice(s, level, random) };
  // The charge question never hurts, so every bot answers it each turn, right as often as its level.
  if (canCharge(s)) return { kind: 'charge', right: random() < BOT_MATHS[level] };

  if (level === 'very-easy') {
    const usable = usableItems(s);
    if (usable.length > 0 && random() < 0.4) {
      const item = pick(random, usable);
      const targets = validTargets(s, item);
      return {
        kind: 'use-item',
        item,
        ...(targets.length > 0 ? { target: pick(random, targets) } : {}),
        ...(item === 'navigator' ? { value: 1 + Math.floor(random() * 6) } : {}),
      };
    }
    return { kind: 'roll' };
  }

  const plans = itemPlans(s, level).filter((p) => p.worth >= 1);
  if (plans.length === 0) return { kind: 'roll' };
  return plans.reduce((best, p) => (p.worth > best.worth ? p : best)).action;
}

function botChoice(s: SpaceState, level: BotLevel, random: () => number): number {
  const pending = s.pending!;
  const seat = s.turn;
  if (pending.kind === 'question') return random() < BOT_MATHS[level] ? 1 : 0;
  if (level === 'very-easy') return pick(random, choiceOptions(pending));
  switch (pending.kind) {
    case 'gate':
      return pending.twin > pending.square ? 1 : 0;
    case 'mystery':
      return Math.floor(random() * 3); // every card is the same: the destination is drawn after
    case 'binary': {
      const [a, b] = pending.dice.map((die) => landingValue(s, seat, stepsFor(s.rockets[seat], s.turnInfo, die).steps));
      return b > a ? 1 : 0;
    }
    case 'inventory': {
      const items = s.rockets[seat].items;
      let worst = 0;
      items.forEach((item, i) => { if (ITEM_VALUE[item] < ITEM_VALUE[items[worst]]) worst = i; });
      return ITEM_VALUE[pending.item] > ITEM_VALUE[items[worst]] ? worst : KEEP_ITEMS;
    }
  }
}
