/**
 * What can actually be done on a turn's Build step right now (James, 16 Nov 2026: only suggest or show what a pupil
 * can really do). Every answer comes from the rules (problemWith), so a button is shown only when pressing it works.
 */
import { DECORATIONS, PLOT_KINDS, type DecorationId } from '../../../shared/isles/config';
import { problemWith, raisePrice, wholeCrystals, type Action, type Island } from '../../../shared/isles/engine';
import { freePlaces } from './Decorations';
import { KIND_NAME, n, plural } from './words';

/** The choices for one spot that can be made now: raise it, or build or change it. */
export function spotActions(island: Island, spot: number): Action[] {
  const here = island.spots[spot];
  if (!here) return [];
  const all: Action[] = [
    ...(here.kind === 'empty' ? [] : [{ kind: 'raise', spot } as Action]),
    ...PLOT_KINDS.filter((k) => k !== here.kind).map((plot): Action => ({ kind: 'build', spot, plot })),
  ];
  return all.filter((a) => problemWith(island, a) === null);
}

/** Can this decoration be bought now (and put on a free place)? */
export function canBuyDecoration(island: Island, id: DecorationId): boolean {
  const free = freePlaces(island);
  return free.length > 0 && problemWith(island, { kind: 'decorate', id, place: free[0] }) === null;
}

export interface BuildChoices {
  /** Spots with at least one choice that can be made. */
  spots: number[];
  anchor: boolean;
  lighthouse: boolean;
  decorate: boolean;
  /** Anything at all. */
  any: boolean;
}

export function buildChoices(island: Island): BuildChoices {
  const spots = island.spots.map((_, i) => i).filter((i) => spotActions(island, i).length > 0);
  const anchor = problemWith(island, { kind: 'anchor' }) === null;
  const lighthouse = problemWith(island, { kind: 'lighthouse' }) === null;
  const decorate = DECORATIONS.some((d) => canBuyDecoration(island, d.id));
  return { spots, anchor, lighthouse, decorate, any: spots.length > 0 || anchor || lighthouse || decorate };
}

export interface UpgradeChoice {
  /** Spots whose building can be upgraded now. */
  spots: number[];
  /** Why nothing can be upgraded now, with the numbers (null: something can). */
  why: string | null;
}

/**
 * The "Upgrade a building" button on the Build step. It is always shown, so pupils know buildings can be upgraded,
 * and greyed out with the reason when none can be (James, 18 Nov 2026).
 */
export function upgradeChoice(island: Island): UpgradeChoice {
  const built = island.spots.map((s, i) => ({ s, i })).filter(({ s }) => s.kind !== 'empty');
  const spots = built.filter(({ i }) => problemWith(island, { kind: 'raise', spot: i }) === null).map(({ i }) => i);
  if (spots.length) return { spots, why: null };
  if (!built.length) return { spots, why: 'Build a building first, then you can upgrade it.' };
  // The cheapest upgrade there is, and what it still needs.
  const cheapest = built
    .flatMap(({ s, i }) => {
      const price = raisePrice(island, i);
      return price && s.kind !== 'empty' ? [{ kind: s.kind, level: s.level + 1, price }] : [];
    })
    .sort((a, b) => a.price.coins - b.price.coins || a.price.crystals - b.price.crystals)[0];
  if (!cheapest) return { spots, why: 'All your buildings are at the top level. Amazing!' };
  const what = `Upgrading your ${KIND_NAME[cheapest.kind]} to level ${cheapest.level}`;
  if (island.coins < cheapest.price.coins) {
    return { spots, why: `Not enough coins. ${what} needs ${plural(cheapest.price.coins, 'coin')}. You have ${n(island.coins)}.` };
  }
  return { spots, why: `Not enough sky crystals. ${what} needs ${plural(cheapest.price.crystals, 'sky crystal')}. You have ${n(wholeCrystals(island))}.` };
}
