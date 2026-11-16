import { describe, expect, it } from 'vitest';
import { applyAction, clanDay, type Action, type Applied, type Context, type ServerState } from './actions';
import { itemAt } from './items';
import { startingDrafts } from './create';
import { ITEMS } from './gamedata';
import { QUESTS, todaysQuest } from './quests';
import { DEFAULT_PRACTICAL_SETTINGS } from '../maths/practical';
import { parseFocus } from '../maths/focus';
import { markQuestion, type MathsContext } from '../maths/serverQuestions';

const MATHS: MathsContext = { facts: [], settings: { enabledTables: [2, 5, 10] }, focus: parseFocus(null) };
const SEED = 123456;
const DAY0 = 20_000;
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: DAY0, ...over });
const choices = (seed = SEED) => ({ name: 'Red Banner', drafts: startingDrafts(seed) });

function created(over: Partial<Context> = {}): ServerState {
  const out = applyAction(null, { type: 'create', ...choices() }, ctx(over));
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
/** Apply and expect it to work. */
function ok(state: ServerState, action: Action, over: Partial<Context> = {}): Extract<Applied, { ok: true }> & { state: ServerState } {
  const out = applyAction(state, action, ctx(over));
  if (!out.ok || !out.state) throw new Error(`refused: ${out.ok ? '' : out.say}`);
  return out as never;
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

describe('making a clan', () => {
  it('ignores stats, gold and seeds the browser makes up', () => {
    const drafts = startingDrafts(SEED).map((d, i) => ({ ...d, seed: 999 + i, stats: { strength: 60 }, hp: 999 }));
    const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: drafts as never }, ctx());
    expect(out.ok && out.state!.clan).toEqual(created().clan);
    expect(out.ok && out.state!.clan.members.map((m) => m.stats.strength)).not.toContain(60);
  });
});

describe('the shop, Training Hall and Church', () => {
  it('refuses too little gold, an unknown item or member, another class\'s item, a tier the Smithy does not sell, or one no better', () => {
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

describe('quests', () => {
  const puzzleChoice = (q: (typeof QUESTS)[number]) => q.choices.findIndex((c) => c.puzzle && !c.charm);

  /** A clan that is on a day when today's quest has a puzzle choice anyone can pick. */
  function stateWithPuzzle() {
    for (let offset = 0; offset < 10; offset++) {
      const s = created();
      const day = clanDay(DAY0, DAY0 + offset);
      const q = todaysQuest(s.seed, day, DEFAULT_PRACTICAL_SETTINGS)!;
      if (puzzleChoice(q) >= 0) return { today: DAY0 + offset, q };
    }
    throw new Error('no puzzle quest in ten days');
  }

  it('marks the two ladder questions kept by ask: both right gets the big prize, anything else the smaller', () => {
    const { today, q } = stateWithPuzzle();
    const choice = puzzleChoice(q);
    const s = created();
    const day = clanDay(DAY0, today);
    const answersOf = (st: ServerState) => st.ask!.questions.map((x) => markQuestion(x)!.answer);
    const asked = ok(s, { type: 'ask', for: 'quest' }, { today, maths: MATHS }).state;
    const [a, b] = answersOf(asked);
    const right = ok(asked, { type: 'quest', choice, answers: [a, b] }, { today });
    const wrong = ok(asked, { type: 'quest', choice, answers: [a + 1, b + 1] }, { today });
    const skipped = ok(asked, { type: 'quest', choice, answers: [null, null] }, { today });
    expect(right.result).toMatchObject({ type: 'quest', questId: q.id, right: true });
    expect(wrong.result).toMatchObject({ right: false });
    expect(skipped.result).toMatchObject({ right: false });
    const total = (o: typeof right) => o.state.clan.gold + o.state.clan.followers + o.state.clan.members[0].points;
    expect(total(right)).toBeGreaterThan(total(wrong));
    expect(total(wrong)).toBeGreaterThanOrEqual(total(skipped) - 0);
    // A wrong answer never blocks: the quest is done either way.
    expect(wrong.state.clan.questDay).toBe(day);
  });
});
