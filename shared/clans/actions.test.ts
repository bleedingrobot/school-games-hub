import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type Applied, type Context, type ServerState } from './actions';
import { itemAt } from './items';
import { startingDrafts } from './create';
import { ITEMS } from './gamedata';

const SEED = 123456;
const DAY0 = 20_000;
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: DAY0, ...over });
const choices = (seed = SEED) => ({ name: 'Red Banner', drafts: startingDrafts(seed) });

function created(over: Partial<Context> = {}): ServerState {
  const out = applyAction(null, { type: 'create', ...choices() }, ctx(over));
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
const refused = (state: ServerState | null, action: Action, over: Partial<Context> = {}) => {
  const out = applyAction(state, action, ctx(over));
  expect(out.ok, JSON.stringify(action)).toBe(false);
  return out as Extract<Applied, { ok: false }>;
};
const rich = (state: ServerState, gold = 5000): ServerState => {
  const s = structuredClone(state);
  s.clan.gold = gold;
  return s;
};

describe('what the browser sends', () => {
  it('ignores stats, gold and seeds the browser makes up for a new clan; the shop refuses too little gold, an unknown item or member, another class\'s item, a tier the Smithy does not sell, or one no better', () => {
    // Making a clan: made-up stats, gold and seeds are ignored.
    const drafts = startingDrafts(SEED).map((d, i) => ({ ...d, seed: 999 + i, stats: { strength: 60 }, hp: 999 }));
    const made = applyAction(null, { type: 'create', name: 'Red Banner', drafts: drafts as never }, ctx());
    expect(made.ok && made.state!.clan).toEqual(created().clan);
    expect(made.ok && made.state!.clan.members.map((m) => m.stats.strength)).not.toContain(60);
    // The shop.
    const s = created();
    const m = s.clan.members[0];
    const next = itemAt(m.cls, 'weapon', 2)!;
    const poor = structuredClone(s);
    poor.clan.gold = next.price - 1;
    expect(refused(poor, { type: 'buy', member: 0, item: next.name }).why).toBe('gold');
    expect(refused(s, { type: 'buy', member: 0, item: 'Sword of Anything' }).why).toBe('item');
    expect(refused(rich(s), { type: 'buy', member: 5, item: next.name }).why).toBe('member');
    const other = ITEMS.find((i) => i.cls !== m.cls && i.tier === 2)!;
    expect(refused(rich(s), { type: 'buy', member: 0, item: other.name }).why).toBe('shelf');
    expect(refused(rich(s), { type: 'buy', member: 0, item: itemAt(m.cls, 'weapon', 3)!.name }).why).toBe('shelf'); // Smithy level 0 sells up to tier 2
    expect(refused(rich(s), { type: 'buy', member: 0, item: itemAt(m.cls, 'weapon', 1)!.name }).why).toBe('shelf');
  });
});

describe('new names at the start of a season', () => {
  const repicking = () => {
    const s = created();
    s.clan.season = 2;
    s.clan.repick = 2;
    return s;
  };
  it('renames a member from the list, or a made-up name with the teacher switch, and only before Keep going', () => {
    const s = repicking();
    const free = ['Aria', 'Bram', 'Cleo', 'Elin'].find((n) => !s.clan.members.some((m) => m.name === n))!;
    const out = applyAction(s, { type: 'rename', member: 1, name: free }, ctx());
    expect(out.ok && out.state!.clan.members[1].name).toBe(free);
    expect(refused(s, { type: 'rename', member: 1, name: s.clan.members[0].name }).why).toBe('name');
    expect(refused(s, { type: 'rename', member: 1, name: 'Zork' }).why).toBe('name');
    const typed = applyAction(s, { type: 'rename', member: 2, name: 'te ahi' }, ctx({ typedNames: true }));
    expect(typed.ok && typed.state!.clan.members[2].name).toBe('Te Ahi');
    expect(refused(s, { type: 'rename', member: 2, name: 'poop' }, { typedNames: true }).why).toBe('name');
    expect(refused(created(), { type: 'rename', member: 1, name: free }).why).toBe('rename');
  });
});
