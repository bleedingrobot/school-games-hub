import { describe, expect, it } from 'vitest';
import { applyAction, parseAction, type Context, type ServerState } from './actions';
import { clanFromChoices, makeClan, startingDrafts } from './create';
import { LOOKS, lookFromName, lookOf } from './looks';

const SEED = 4242;
const ctx: Context = { seed: SEED, today: 20_000 };
const created = (drafts = startingDrafts(SEED)): ServerState => {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts }, ctx);
  if (!out.ok || !out.state) throw new Error(out.ok ? 'no state' : out.say);
  return out.state;
};

describe('member looks', () => {
  it('a name always gives the same look, and the names spread over all four', () => {
    expect(lookFromName('Hemi')).toBe(lookFromName('Hemi'));
    const seen = new Set(['Ana', 'Ben', 'Cai', 'Dax', 'Eve', 'Fin', 'Gus', 'Hemi', 'Ivy', 'Jo', 'Kai', 'Lou'].map(lookFromName));
    expect(seen.size).toBe(LOOKS.length);
  });

  it('a member saved before looks existed gets the look from their name', () => {
    const old = { ...makeClan('Red Banner', startingDrafts(SEED)).members[0], look: undefined };
    expect(lookOf(old)).toBe(lookFromName(old.name));
    expect(lookOf({ name: old.name, look: 'nonsense' as never })).toBe(lookFromName(old.name));
  });

  it('the creator keeps each chosen look, on the server the same as in the browser', () => {
    const drafts = startingDrafts(SEED).map((d, i) => ({ ...d, look: LOOKS[i] }));
    const state = created(drafts);
    expect(state.clan.members.map((m) => m.look)).toEqual([...LOOKS]);
    expect(state.clan).toEqual({ ...makeClan('Red Banner', drafts) });
  });

  it('a look only changes the picture: the same draft rolls the same stats', () => {
    const plain = startingDrafts(SEED);
    const a = makeClan('Red Banner', plain).members;
    const b = makeClan('Red Banner', plain.map((d) => ({ ...d, look: 'female-2' as const }))).members;
    expect(b.map(({ look: _, ...m }) => m)).toEqual(a.map(({ look: _, ...m }) => m));
  });

  it('the creator refuses a look that is not one of the four', () => {
    const drafts = startingDrafts(SEED).map((d) => ({ ...d, look: 'dragon' as never }));
    expect(clanFromChoices(SEED, 'Red Banner', drafts)).toEqual({ ok: false, say: 'Pick one of the four looks.' });
  });

  it('"Change look" sets one member\'s look, free, and nothing else changes', () => {
    const state = created();
    const out = applyAction(state, { type: 'look', member: 2, look: 'male-2' }, ctx);
    expect(out.ok).toBe(true);
    if (!out.ok || !out.state) return;
    expect(out.state.clan.members[2].look).toBe('male-2');
    expect({ ...out.state.clan, members: out.state.clan.members.map(({ look: _, ...m }) => m) }).toEqual({ ...state.clan, members: state.clan.members.map(({ look: _, ...m }) => m) });
  });

  it('the server reads only a real look for a real member', () => {
    expect(parseAction({ type: 'look', member: 1, look: 'female-1', gold: 999 })).toEqual({ type: 'look', member: 1, look: 'female-1' });
    expect(parseAction({ type: 'look', member: 1, look: 'dragon' })).toBeNull();
    expect(parseAction({ type: 'look', member: 1 })).toBeNull();
    expect(parseAction({ type: 'look', member: -1, look: 'male-1' })).toBeNull();
    const out = applyAction(created(), { type: 'look', member: 5, look: 'male-1' }, ctx);
    expect(out.ok).toBe(false);
  });
});
