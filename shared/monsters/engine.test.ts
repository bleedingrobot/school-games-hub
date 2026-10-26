import { describe, expect, it } from 'vitest';
import { BattleRuleError, newBattle, play, type BattleAction, type BattleSetup } from './engine';
import { makeMonster, maxHpOf } from './rules';

const half = () => 0.5;

const setup = (over: Partial<BattleSetup> = {}): BattleSetup => ({
  kind: 'wild', area: 1, team: [makeMonster('factorch-1', 10)], bag: { potion: 2, ball: 3 }, foes: [makeMonster('plusplash-1', 5)], ...over,
});

describe('a fight', () => {
  it('hurts the foe and the foe hits back; a last hit wins, gives exp and has no counter-attack', () => {
    const { state } = newBattle(setup());
    const step = play(state, { kind: 'fight', attack: 0, answer: 'right' }, half);
    expect(step.events.map((e) => e.kind)).toEqual(['attack', 'attack']);
    expect(step.state.foes[0].hp).toBeLessThan(state.foes[0].hp);
    expect(step.state.team[0].hp).toBeLessThan(state.team[0].hp);
    expect(state.foes[0].hp).toBe(maxHpOf(state.foes[0])); // the old state is untouched

    const weak = newBattle(setup({ foes: [{ ...makeMonster('plusplash-1', 3), hp: 1 }] })).state;
    const win = play(weak, { kind: 'fight', attack: 1, answer: 'right' }, half);
    expect(win.state.phase).toBe('won');
    expect(win.events.map((e) => e.kind)).toEqual(['attack', 'faint', 'exp', 'won']);
    expect(win.state.team[0].exp).toBeGreaterThan(weak.team[0].exp);
  });

  it('refuses bad actions', () => {
    const { state } = newBattle(setup({ team: [makeMonster('factorch-1', 10), { ...makeMonster('multipup-1', 8), hp: 0 }] }));
    const bad: BattleAction[] = [
      { kind: 'fight', attack: 9, answer: 'right' },
      { kind: 'fight', attack: 0, answer: 'amazing' as never },
      { kind: 'switch', to: 1 }, // tired
      { kind: 'item', item: 'potion' }, // already full
      { kind: 'catch', answer: 'right', ball: 'great-ball' }, // none in the bag
      { kind: 'bogus' } as never,
    ];
    for (const action of bad) expect(() => play(state, action, half), JSON.stringify(action)).toThrow(BattleRuleError);
    const trainer = newBattle(setup({ kind: 'trainer' })).state;
    expect(() => play(trainer, { kind: 'run' }, half)).toThrow(BattleRuleError);
    expect(() => play(trainer, { kind: 'catch', answer: 'right' }, half)).toThrow(BattleRuleError);
    const over = play(newBattle(setup()).state, { kind: 'run' }, half).state;
    expect(() => play(over, { kind: 'run' }, half)).toThrow(BattleRuleError);
  });
});
