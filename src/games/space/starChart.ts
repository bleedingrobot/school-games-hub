/**
 * The Star chart: which space facts this student has discovered. Kept on this device only
 * (not in the database), so clearing the browser clears it. That's fine: it's just for fun.
 */
import type { SpaceEvent } from '../../../shared/space/engine';
import { FACTS, type FactId } from '../../../shared/space/facts';

const STORAGE_KEY = 'sgh-space-star-chart';
const KNOWN = new Set<string>(FACTS.map((f) => f.id));

export function loadStarChart(): Set<FactId> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (Array.isArray(saved)) return new Set(saved.filter((id): id is FactId => typeof id === 'string' && KNOWN.has(id)));
  } catch {
    // Nothing saved, or storage blocked.
  }
  return new Set();
}

/** Adds a fact to the chart. Returns true if it's new. */
export function discover(id: FactId): boolean {
  const chart = loadStarChart();
  if (chart.has(id)) return false;
  chart.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...chart]));
  } catch {
    // Storage blocked: it just won't be remembered.
  }
  return true;
}

/** The fact an event shows, if it's about your own rocket landing on something (or a supernova burning out). */
export function factFor(event: SpaceEvent, me: number | null): FactId | null {
  if (event.kind === 'supernova-spent') return 'nebula';
  if (me === null || !('seat' in event) || event.seat !== me) return null;
  switch (event.kind) {
    case 'star':
      return event.star;
    case 'wormhole':
      return 'wormhole';
    case 'black-hole':
    case 'force-field':
      return 'black-hole';
    case 'comet':
      return 'comet';
    case 'asteroid':
      return 'asteroid';
    case 'gravity':
      if (event.source === 'neutron-star') return null; // the neutron star's own fact shows instead
      return event.gravity === 'heavy' ? 'heavy-gravity' : event.gravity === 'low' ? 'low-gravity' : 'slingshot';
    case 'docked':
      return 'space-station';
    default:
      return null;
  }
}
