import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type Context, type ServerState } from './actions';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { empireOf, newEmpire } from './empire';
import type { RaidTarget } from './village';
import type { Empire } from './types';

const SEED = 123456;
const TODAY = 20_000;
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: TODAY, ...over });

function created(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, ctx());
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
/** A clan that began a fortnight ago with an army of the given size. */
function veteran(footmen: number, vault = 1000): ServerState {
  const s = created();
  s.createdNzDay = TODAY - 14;
  s.day = 15;
  const e = empireOf(s.clan);
  e.troops = { footman: footmen, axeman: 0, knight: 0 };
  e.vault = vault;
  return s;
}
const target = (footmen = 40, vault = 800): RaidTarget => {
  const e: Empire = { ...newEmpire(), troops: { footman: footmen, axeman: 0, knight: 0 }, vault };
  return { id: 'blue-fox-1', name: 'Blue Fox', createdNzDay: TODAY - 14, empire: e };
};
const raid = (s: ServerState, t: RaidTarget | null, over: Partial<Context> = {}, a: Partial<Extract<Action, { type: 'raidClass' }>> = {}) =>
  applyAction(s, { type: 'raidClass', target: t?.id ?? 'nobody', take: 'gold', plan: { rounds: 3, push: 'steady', loot: 10 }, ...a }, ctx({ self: 'red-1', raidsOn: true, target: t, ...over }));

describe('a raid on a classmate', () => {
  it('moves vault gold only between the two empires, never the purse, and never more than 10%', () => {
    let won = 0;
    for (let k = 1; k <= 120; k++) {
      const s = veteran(45, 500);
      s.seed = k * 7919;
      const t = target(40, 800);
      const before = { purse: s.clan.gold, vaults: empireOf(s.clan).vault + t.empire.vault };
      const out = raid(s, t);
      if (!out.ok || out.result.type !== 'raidClass') throw new Error('raid failed');
      const eff = out.effects!.raid!;
      expect(out.state!.clan.gold).toBe(before.purse);
      expect(empireOf(out.state!.clan).vault + eff.empire.vault).toBe(before.vaults);
      expect(out.result.gold).toBeLessThanOrEqual(80);
      expect(out.result.gold).toBe(800 - eff.empire.vault);
      expect(eff.empire.shieldUntil).toBe(TODAY + CONFIG.empire.raids.shieldDays);
      expect(eff.empire.createdDay).toBe(t.empire.createdDay);
      if (out.result.result.outcome === 'won') won++;
    }
    expect(won).toBeGreaterThan(5);
  });
});
