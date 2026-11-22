/**
 * The map screen's next-step line (docs/GOBLINSTORM-PLAN.md, Design point 7): one thing to try next, worked out from
 * the save alone, with where "Show me" points. Pure, so it can be tested and never guesses.
 */
import { MAPS, SHOP_IDS, STORM_FIRST, STORM_LANDS_ON } from '../../../shared/goblinstorm/config';
import { stormGateOpen } from '../../../shared/goblinstorm/server';
import { LEGENDARY_IDS } from '../../../shared/goblinstorm/config';
import { allBought, nextCost, nextLegendCost } from '../../../shared/goblinstorm/shop';
import type { MySave } from './backend';

export type ShowMe = { kind: 'map'; map: number } | { kind: 'shop' } | { kind: 'codex' } | { kind: 'hero' };

export interface NextStep { text: string; show: ShowMe }

export function nextStep(save: MySave, stormLands: boolean = STORM_LANDS_ON): NextStep {
  if (save.runs === 0) return { text: 'Play Castle Fields for your first storm.', show: { kind: 'map', map: 0 } };
  const cheapest = allBought(save.shop)
    ? Math.min(...LEGENDARY_IDS.map((id) => nextLegendCost(save.shop, id) ?? Infinity))
    : Math.min(...SHOP_IDS.map((id) => nextCost(save.shop, id) ?? Infinity));
  if (save.gold >= cheapest) return { text: 'You have enough gold for an upgrade in the Shop.', show: { kind: 'shop' } };
  if (save.codex.length === 0 && save.runs >= 2) return { text: 'Evolve a weapon: get it to level 5, then pick its partner. The Codex shows the pairs.', show: { kind: 'codex' } };
  const mapCount = stormLands ? MAPS.length : STORM_FIRST;
  const next = MAPS.slice(0, mapCount).findIndex((_, i) => !save.bosses.includes(i));
  if (next === STORM_FIRST && !stormGateOpen(save)) return { text: 'Buy everything in the Shop to open the Storm Lands.', show: { kind: 'shop' } };
  if (next >= 0) {
    const boss = MAPS[next].monsters[4].name;
    const opens = next + 1 < mapCount ? MAPS[next + 1] : undefined;
    return { text: opens ? `Beat the ${boss} to open ${opens.name}.` : `Beat the ${boss} to beat every boss!`, show: { kind: 'map', map: next } };
  }
  return { text: 'Every boss beaten! Try to beat them with another hero.', show: { kind: 'hero' } };
}
