/**
 * What can actually be done on a turn's Build step right now (James, 16 Nov 2026: only suggest or show what a pupil
 * can really do). Every answer comes from the rules (problemWith), so a button is shown only when pressing it works.
 */
import { DECORATIONS, PLOT_KINDS, type DecorationId } from '../../../shared/isles/config';
import { problemWith, type Action, type Island } from '../../../shared/isles/engine';
import { freePlaces } from './Decorations';

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
