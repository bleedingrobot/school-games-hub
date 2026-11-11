import { describe, expect, it } from 'vitest';
import { checkSave, type Checked, type SaveItem, type Stored } from './check';
import { Session } from './testKit';

const ok = (c: Checked) => {
  if (!c.ok) throw new Error(`refused: ${c.problem}`);
  return c.save;
};
const stored = (item: SaveItem): Stored => ({ world: item.world, at: item.at });

/** A student who has started, played a wild battle in Kauri Bush and saved. */
function started() {
  const s = new Session();
  const first = s.save();
  const prev = stored(first);
  s.goto('kauri-bush', 'entrance');
  return { s, prev, first };
}

describe('honest play is accepted', () => {
  it('a session of wild battles, a trainer, healing and saving, chained save after save', () => {
    const s = new Session(['leaf', 'ice']);
    // With quests on: wins give bits and keep the eggs warm.
    s.quest = { day: '2026-10-20', player: 'pupil-a', playDays: 0 };
    let prev: Stored | null = null;
    let first = true;
    const accept = () => {
      const item = s.save();
      const saved = ok(checkSave(prev, item, s.clock.now(), 'pupil-a'));
      prev = stored(item);
      first = false;
      return saved;
    };
    accept();
    s.goto('kauri-bush', 'entrance');
    let wins = 0;
    let answers = 0;
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 8; i++) s.wild();
      const saved = accept();
      wins += saved.summary.wildWins;
      answers += saved.summary.questions;
    }
    expect(first).toBe(false);
    expect(wins).toBeGreaterThan(10);
    expect(answers).toBeGreaterThan(40); // a wild battle asks once (its power up), plus any catches
    expect(Object.values(s.world.quest!.bits).reduce((a, b) => a + b!, 0)).toBeGreaterThan(10);
  });
});

const refused = (c: Checked, problem: string) => {
  expect(c.ok).toBe(false);
  if (!c.ok) expect(c.problem).toBe(problem);
};

describe('a save the rules cannot have produced is refused', () => {

  it('a catch with no maths question, and an answer that is not what was marked', () => {
    const { s, prev } = started();
    // Play wild battles until one catches (or give up) so the report has a catch step.
    let report;
    for (let i = 0; i < 200 && !report; i++) {
      const r = s.wild();
      if (r.outcome === 'caught') report = r;
    }
    expect(report).toBeTruthy();
    const good = s.save();
    ok(checkSave(prev, good, s.clock.now()));

    const noQuestion = structuredClone(good);
    const battle = noQuestion.battles.find((b) => b.outcome === 'caught')!;
    delete battle.steps[battle.steps.length - 1].q;
    refused(checkSave(prev, noQuestion, s.clock.now()), 'battle-answer');

    // A wrong typed answer reported as a right one.
    const lied = structuredClone(good);
    const step = lied.battles.find((b) => b.outcome === 'caught')!.steps.find((st) => st.action.kind === 'catch')!;
    step.q!.given = step.q!.given + 7;
    step.action = { ...step.action, answer: 'right' } as typeof step.action;
    refused(checkSave(prev, lied, s.clock.now()), 'battle-answer');
  });
});
