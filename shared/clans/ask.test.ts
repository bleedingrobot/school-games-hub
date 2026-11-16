import { describe, expect, it } from 'vitest';
import { applyAction, clanDay, parseAction, type Action, type Applied, type Context, type ServerState } from './actions';
import { startingDrafts } from './create';
import { itemAt } from './items';
import { todaysQuest } from './quests';
import { parseFocus } from '../maths/focus';
import { DEFAULT_PRACTICAL_SETTINGS } from '../maths/practical';
import { markQuestion, type MathsContext } from '../maths/serverQuestions';

const SEED = 123456;
const DAY0 = 20_000;
const MATHS: MathsContext = { facts: [], settings: { enabledTables: [2, 5, 10] }, focus: parseFocus(null) };
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: DAY0, maths: MATHS, ...over });

function created(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, ctx());
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
function ok(state: ServerState, action: Action, over: Partial<Context> = {}): Extract<Applied, { ok: true }> & { state: ServerState } {
  const out = applyAction(state, action, ctx(over));
  if (!out.ok || !out.state) throw new Error(`refused: ${out.ok ? '' : `${out.why}: ${out.say}`}`);
  return out as never;
}
const refused = (state: ServerState, action: Action, over: Partial<Context> = {}) => {
  const out = applyAction(state, action, ctx(over));
  expect(out.ok, JSON.stringify(action)).toBe(false);
  return out as Extract<Applied, { ok: false }>;
};
const answersOf = (s: ServerState) => s.ask!.questions.map((q) => markQuestion(q)!.answer);
const withGold = (s: ServerState, gold = 5000) => {
  const c = structuredClone(s);
  c.clan.gold = gold;
  return c;
};



const setupBuy = () => {
  const s = created();
  const item = itemAt(s.clan.members[0].cls, 'weapon', 2)!;
  const asked = ok(withGold(s), { type: 'ask', for: 'shop' }).state;
  return { asked, item, answer: answersOf(asked)[0], price: (st: ServerState) => 5000 - st.clan.gold };
};

function puzzleDay() {
  for (let offset = 0; offset < 30; offset++) {
    const day = clanDay(DAY0, DAY0 + offset);
    const q = todaysQuest(SEED, day, DEFAULT_PRACTICAL_SETTINGS)!;
    const puzzle = q.choices.findIndex((c) => c.puzzle && !c.charm);
    const plain = q.choices.findIndex((c) => !c.puzzle && !c.charm);
    if (puzzle >= 0) return { today: DAY0 + offset, puzzle, plain };
  }
  throw new Error('no puzzle quest');
}
const asked = (today: number) => ok(created(), { type: 'ask', for: 'quest' }, { today }).state;

const clock = { number: 1, day: 100, daysLeft: 10, clockOn: true };
const week = { clock };
const start = (siege: number | null, askFirst: boolean) => {
  let s = created();
  if (askFirst) s = ok(s, { type: 'ask', for: 'siege' }, week).state;
  return { s, out: ok(s, { type: 'monsterStart', siege, ms: 1800 }, week) };
};



const askedFor = (kind: 'shop' | 'quest' | 'siege') => ok(withGold(created()), { type: 'ask', for: kind }, { clock }).state;

describe('ask questions', () => {
  it('ask and askCheck: questions are made and kept by the server, shown without answers, and each is marked once', () => {
    // ask: needs the child's maths
    {
      expect(refused(created(), { type: 'ask', for: 'shop' }, { maths: undefined }).why).toBe('no-maths');
    }
    // ask: makes 1 question for the shop and siege, 2 for the quest, and shows no answers
    {
      const s = created();
      for (const [kind, n] of [['shop', 1], ['siege', 1], ['quest', 2]] as const) {
        const out = ok(s, { type: 'ask', for: kind });
        expect(out.result).toMatchObject({ type: 'ask', for: kind });
        const shown = (out.result as unknown as { questions: Record<string, unknown>[] }).questions;
        expect(shown).toHaveLength(n);
        shown.forEach((q) => {
          expect(q).not.toHaveProperty('answer');
          expect(q).not.toHaveProperty('factKey');
        });
        expect(JSON.stringify(out.result)).not.toMatch(/"answer"|"factKey"/);
        expect(out.state.ask).toMatchObject({ for: kind, no: 1 });
        expect(out.state.ask!.questions).toHaveLength(n);
        expect(out.state.askNo).toBe(1);
      }
    }
    // ask: asking again for the same kind gives the same questions and changes nothing
    {
      const first = ok(created(), { type: 'ask', for: 'quest' });
      const again = ok(first.state, { type: 'ask', for: 'quest' });
      expect(again.result).toEqual(first.result);
      expect(again.changed).toBe(false);
      expect(again.state.askNo).toBe(1);
    }
    // ask: asking for a different kind replaces the waiting one
    {
      const first = ok(created(), { type: 'ask', for: 'shop' });
      const next = ok(first.state, { type: 'ask', for: 'quest' });
      expect(next.changed).toBe(true);
      expect(next.state.ask).toMatchObject({ for: 'quest', no: 2 });
      expect(next.state.ask!.questions).toHaveLength(2);
    }
    // ask: is read from a browser, and an old single quest answer counts as the first
    {
      expect(parseAction({ type: 'ask', for: 'siege' })).toEqual({ type: 'ask', for: 'siege' });
      expect(parseAction({ type: 'ask', for: 'bank' })).toBeNull();
      expect(parseAction({ type: 'quest', choice: 1, answer: 7 })).toMatchObject({ type: 'quest', choice: 1, answers: [7] });
      expect(parseAction({ type: 'quest', choice: 1, answers: [1, null] })).toMatchObject({ answers: [1, null] });
      expect(parseAction({ type: 'quest', choice: 1, answers: ['x'] })).toBeNull();
    }
    // askCheck: refuses when nothing is waiting or the slot is not there
    {
      expect(refused(created(), { type: 'askCheck', slot: 0, answer: 1, ms: 10 }).why).toBe('no-question');
      expect(refused(askedFor('shop'), { type: 'askCheck', slot: 1, answer: 1, ms: 10 }).why).toBe('no-question');
    }
    // askCheck: marks a question once, with a per-slot record id; asking again gives the first mark and nothing changes
    {
      const s = askedFor('quest');
      const [a, b] = answersOf(s);
      const first = ok(s, { type: 'askCheck', slot: 1, answer: b + 1, ms: 700 });
      expect(first.result).toEqual({ type: 'askCheck', slot: 1, correct: false, answer: b, given: b + 1 });
      expect(first.changed).toBe(true);
      expect(first.effects?.ladder).toEqual({ once: `clans:ask:${SEED}:1:1`, answers: [{ key: markQuestion(s.ask!.questions[1])!.key, correct: false, ms: 700 }] });
      expect(first.state.ask!.marks![1]).toEqual({ answer: b + 1, correct: false });
      const again = ok(first.state, { type: 'askCheck', slot: 1, answer: b, ms: 10 });
      expect(again.result).toEqual(first.result);
      expect(again.changed).toBe(false);
      expect(again.effects).toBeUndefined();
      const zero = ok(s, { type: 'askCheck', slot: 0, answer: a, ms: 5 });
      expect(zero.result).toMatchObject({ slot: 0, correct: true, given: a });
    }
  });
  it("buy, quest and monsterStart use the server's marks (shop discount, quest prize, siege, ladder fights)", () => {
    // buy with a shop question: right: discount, shows the right answer, clears the ask, records the answer once
    {
      const { asked, item, answer, price } = setupBuy();
      const out = ok(asked, { type: 'buy', member: 0, item: item.name, answer, ms: 2500 });
      expect(out.result).toEqual({ type: 'buy', discount: true, answer });
      expect(out.state.ask).toBeNull();
      const key = markQuestion(asked.ask!.questions[0])!.key;
      expect(out.effects?.ladder).toEqual({ once: `clans:ask:${SEED}:1`, answers: [{ key, correct: true, ms: 2500 }] });
      expect(price(out.state)).toBeLessThan(item.price);
    }
    // buy with a shop question: wrong: full price, still clears the ask and records it as wrong
    {
      const { asked, item, answer, price } = setupBuy();
      const out = ok(asked, { type: 'buy', member: 0, item: item.name, answer: answer + 1, ms: 900 });
      expect(out.result).toEqual({ type: 'buy', discount: false, answer });
      expect(out.state.ask).toBeNull();
      expect(out.effects?.ladder?.answers).toMatchObject([{ correct: false, ms: 900 }]);
      expect(price(out.state)).toBe(item.price);
    }
    // buy with a shop question: a null answer (No thanks): full price, ask cleared, nothing recorded
    {
      const { asked, item, answer, price } = setupBuy();
      const out = ok(asked, { type: 'buy', member: 0, item: item.name, answer: null });
      expect(out.result).toMatchObject({ type: 'buy', discount: false, answer });
      expect(out.state.ask).toBeNull();
      expect(out.effects).toBeUndefined();
      expect(price(out.state)).toBe(item.price);
    }
    // buy with a shop question: no ask waiting: no discount and no effects, whatever answer is sent
    {
      const s = withGold(created());
      const item = itemAt(s.clan.members[0].cls, 'weapon', 2)!;
      const out = ok(s, { type: 'buy', member: 0, item: item.name, answer: 4 });
      expect(out.result).toEqual({ type: 'buy', discount: false });
      expect(out.effects).toBeUndefined();
      expect(5000 - out.state.clan.gold).toBe(item.price);
    }
    // buy with a shop question: a quest ask waiting is not used by a buy
    {
      const s = withGold(created());
      const item = itemAt(s.clan.members[0].cls, 'weapon', 2)!;
      const asked = ok(s, { type: 'ask', for: 'quest' }).state;
      const out = ok(asked, { type: 'buy', member: 0, item: item.name, answer: answersOf(asked)[0] });
      expect(out.result).toEqual({ type: 'buy', discount: false });
      expect(out.state.ask?.for).toBe('quest');
    }
    // buy with a shop question: a refused buy leaves the ask in place
    {
      const s = created();
      const item = itemAt(s.clan.members[0].cls, 'weapon', 2)!;
      const poor = withGold(s, Math.floor(item.price * 0.5));
      const asked = ok(poor, { type: 'ask', for: 'shop' }).state;
      const out = applyAction(asked, { type: 'buy', member: 0, item: item.name, answer: answersOf(asked)[0] }, ctx());
      expect(out.ok).toBe(false);
      expect(asked.ask).not.toBeNull();
      // The same question can then be answered once the clan can pay (state was not changed by the refusal).
      const richer = { ...asked, clan: { ...asked.clan, gold: 5000 } };
      expect(ok(richer, { type: 'buy', member: 0, item: item.name, answer: answersOf(asked)[0] }).result).toMatchObject({ discount: true });
    }
    // quest with two ladder questions: both right: right true, the win outcome, marks listed, one record
    {
      const { today, puzzle } = puzzleDay();
      const s = asked(today);
      const [a, b] = answersOf(s);
      const out = ok(s, { type: 'quest', choice: puzzle, answers: [a, b], ms: 3000 }, { today });
      expect(out.result).toMatchObject({ type: 'quest', right: true, marks: [{ correct: true, answer: a }, { correct: true, answer: b }] });
      expect(out.state.ask).toBeNull();
      expect(out.effects?.ladder?.once).toBe(`clans:ask:${SEED}:1`);
      expect(out.effects?.ladder?.answers).toHaveLength(2);
    }
    // quest with two ladder questions: one right or none right: right false, the lose outcome
    {
      const { today, puzzle } = puzzleDay();
      const s = asked(today);
      const [a, b] = answersOf(s);
      const one = ok(s, { type: 'quest', choice: puzzle, answers: [a, b + 1] }, { today });
      expect(one.result).toMatchObject({ right: false, marks: [{ correct: true }, { correct: false, answer: b }] });
      const none = ok(s, { type: 'quest', choice: puzzle, answers: [a + 1, b + 1] }, { today });
      expect(none.result).toMatchObject({ right: false, marks: [{ correct: false }, { correct: false }] });
      const skipped = ok(s, { type: 'quest', choice: puzzle, answers: [] }, { today });
      expect(skipped.result).toMatchObject({ right: false });
      expect(skipped.effects).toBeUndefined();
      expect(skipped.state.ask).toBeNull();
    }
    // quest with two ladder questions: no quest ask waiting: right false, no marks, no effects
    {
      const { today, puzzle } = puzzleDay();
      const out = ok(created(), { type: 'quest', choice: puzzle, answers: [1, 2] }, { today });
      expect(out.result).toMatchObject({ type: 'quest', right: false });
      expect(out.result).not.toHaveProperty('marks');
      expect(out.effects).toBeUndefined();
    }
    // quest with two ladder questions: a choice with no puzzle: right null and the ask is untouched
    plain: {
      for (let offset = 0; offset < 60; offset++) {
        const today = DAY0 + offset;
        const q = todaysQuest(SEED, clanDay(DAY0, today), DEFAULT_PRACTICAL_SETTINGS)!;
        const plain = q.choices.findIndex((c) => !c.puzzle && !c.charm);
        if (plain < 0) continue;
        const s = asked(today);
        const out = ok(s, { type: 'quest', choice: plain, answers: [1, 2] }, { today });
        expect(out.result).toMatchObject({ type: 'quest', right: null });
        expect(out.state.ask).toEqual(s.ask);
        expect(out.effects).toBeUndefined();
        break plain;
      }
      throw new Error('no plain choice in 60 days');
    }
    // monsterStart with a siege question: marks the siege answer against the waiting question
    {
      const asked = ok(created(), { type: 'ask', for: 'siege' }, week).state;
      const answer = answersOf(asked)[0];
      const right = ok(asked, { type: 'monsterStart', siege: answer, ms: 1800 }, week);
      expect(right.result).toMatchObject({ type: 'monsterStart', right: true, answer });
      expect(right.state.ask).toBeNull();
      expect(right.effects?.ladder).toMatchObject({ once: `clans:ask:${SEED}:1`, answers: [{ correct: true, ms: 1800 }] });
      const wrong = ok(asked, { type: 'monsterStart', siege: answer + 1 }, week);
      expect(wrong.result).toMatchObject({ right: false, answer });
      expect(wrong.effects?.ladder?.answers[0].correct).toBe(false);
      const skipped = ok(asked, { type: 'monsterStart', siege: null }, week);
      expect(skipped.result).toMatchObject({ right: false, answer });
      expect(skipped.effects).toBeUndefined();
    }
    // monsterStart with a siege question: with no siege question waiting, right is null and the answer is hidden
    {
      const { out } = start(5, false);
      expect(out.result).toMatchObject({ type: 'monsterStart', right: null, answer: null });
      expect(out.effects).toBeUndefined();
    }
    // monsterStart with a siege question: the fight is a ladder fight whenever maths is given, with or without ladder: true
    {
      for (const ladder of [undefined, true]) {
        const s = ok(created(), { type: 'monsterStart', siege: null, ...(ladder ? { ladder } : {}) }, week).state;
        expect(s.fight?.questions?.length).toBeGreaterThan(0);
      }
      const none = ok(created(), { type: 'monsterStart', siege: null }, { ...week, maths: undefined }).state;
      expect(none.fight?.questions).toBeUndefined();
    }
    // mine fights are ladder fights whenever maths is given: without ladder: true
    {
      const s = ok(created(), { type: 'fightStart', depth: 1, boss: false }).state;
      expect(s.fight?.questions?.length).toBeGreaterThan(0);
      expect(s.fight?.marks).toEqual([]);
    }
    // mine fights are ladder fights whenever maths is given: but not without maths
    {
      const s = ok(created(), { type: 'fightStart', depth: 1, boss: false }, { maths: undefined }).state;
      expect(s.fight?.questions).toBeUndefined();
    }
    // askCheck: buy uses the stored mark whatever is sent and does not record it again
    {
      const s = askedFor('shop');
      const item = itemAt(s.clan.members[0].cls, 'weapon', 2)!;
      const answer = answersOf(s)[0];
      const checked = ok(s, { type: 'askCheck', slot: 0, answer, ms: 100 }).state;
      const out = ok(checked, { type: 'buy', member: 0, item: item.name, answer: answer + 5, ms: 200 });
      expect(out.result).toEqual({ type: 'buy', discount: true, answer });
      expect(out.effects).toBeUndefined();
      expect(out.state.ask).toBeNull();
      const wrongFirst = ok(s, { type: 'askCheck', slot: 0, answer: answer + 1, ms: 100 }).state;
      expect(ok(wrongFirst, { type: 'buy', member: 0, item: item.name, answer, ms: 200 }).result).toMatchObject({ discount: false });
    }
    // askCheck: quest uses stored marks and marks the unchecked slot from the sent answers
    stored: {
      for (let offset = 0; offset < 30; offset++) {
        const today = DAY0 + offset;
        const q = todaysQuest(SEED, clanDay(DAY0, today), DEFAULT_PRACTICAL_SETTINGS)!;
        const choice = q.choices.findIndex((c) => c.puzzle && !c.charm);
        if (choice < 0) continue;
        const s = ok(created(), { type: 'ask', for: 'quest' }, { today }).state;
        const [a, b] = answersOf(s);
        const checked = ok(s, { type: 'askCheck', slot: 0, answer: a, ms: 50 }, { today }).state;
        const out = ok(checked, { type: 'quest', choice, answers: [a + 9, b], ms: 400 }, { today });
        expect(out.result).toMatchObject({ right: true, marks: [{ correct: true }, { correct: true }] });
        // Only slot 1 is recorded now; slot 0 was recorded by askCheck.
        expect(out.effects?.ladder?.answers).toHaveLength(1);
        expect(out.effects?.ladder?.answers[0].ms).toBe(400);
        break stored;
      }
      throw new Error('no puzzle quest');
    }
    // askCheck: monsterStart uses the stored siege mark
    {
      const s = askedFor('siege');
      const answer = answersOf(s)[0];
      const checked = ok(s, { type: 'askCheck', slot: 0, answer, ms: 50 }, { clock }).state;
      const out = ok(checked, { type: 'monsterStart', siege: null }, { clock });
      expect(out.result).toMatchObject({ right: true, answer });
      expect(out.effects).toBeUndefined();
    }
  });
});
