import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { bandFor, quickSeconds } from './bands';
import {
  BattleRuleError, newBattle, play, questionFor, judgeAnswer, replayBattle, healTeam, isOver,
  type BattleAction, type BattleSetup,
} from './engine';
import { FAMILIES, MONSTER_BOOK, speciesOf } from './monsterBook';
import { catchChance, damageFor, expForLevel, gainExp, makeMonster, maxHpOf, TUNING } from './rules';
import { chooseAction, randomTeam, randomWild } from './sim';
import { STRONG_MULTIPLIER, TYPES, TYPE_TOPIC, WEAK_MULTIPLIER, typeMultiplier } from './types';

const zero = () => 0;
const half = () => 0.5;

const setup = (over: Partial<BattleSetup> = {}): BattleSetup => ({
  kind: 'wild', area: 1, team: [makeMonster('factorch-1', 10)], bag: { potion: 2, ball: 3 }, foes: [makeMonster('plusplash-1', 5)], ...over,
});

describe('monster book', () => {
  it('has 18 families, 54 entries, three per type', () => {
    expect(Object.keys(FAMILIES)).toHaveLength(18);
    expect(MONSTER_BOOK).toHaveLength(54);
    for (const t of TYPES) expect(MONSTER_BOOK.filter((s) => s.type === t && s.stage === 1)).toHaveLength(3);
  });
  it('has unique ids and names, and evolutions that point at the next form', () => {
    expect(new Set(MONSTER_BOOK.map((s) => s.id)).size).toBe(54);
    expect(new Set(MONSTER_BOOK.map((s) => s.name)).size).toBe(54);
    for (const s of MONSTER_BOOK) {
      if (s.stage < 3) expect(speciesOf(s.evolvesTo!).stage).toBe(s.stage + 1);
      else expect(s.evolvesTo).toBeUndefined();
      expect(s.attacks.length).toBe(s.stage + 1);
    }
  });
});

describe('type wheel', () => {
  it('is Leaf > Water > Fire > Ice > Spark > Stone > Leaf', () => {
    const order = ['leaf', 'water', 'fire', 'ice', 'spark', 'stone', 'leaf'] as const;
    for (let i = 0; i < 6; i++) {
      expect(typeMultiplier(order[i], order[i + 1])).toBe(STRONG_MULTIPLIER);
      expect(typeMultiplier(order[i + 1], order[i])).toBe(WEAK_MULTIPLIER);
    }
    expect(typeMultiplier('leaf', 'leaf')).toBe(1);
    expect(typeMultiplier('leaf', 'fire')).toBe(1);
  });
  it('gives each type its own topic', () => {
    expect(new Set(TYPES.map((t) => TYPE_TOPIC[t])).size).toBe(6);
    expect(TYPE_TOPIC.fire).toBe('times-tables');
  });
});

describe('damage', () => {
  const a = makeMonster('plusplash-1', 10); // water
  const normalFoe = makeMonster('digibud-1', 10); // leaf: water has no edge either way
  it('right is normal, quick-right ×1.5, wrong a quarter', () => {
    const right = damageFor(a, 60, normalFoe, 'right', 0).damage;
    expect(damageFor(a, 60, normalFoe, 'quick-right', 0).damage).toBeCloseTo(right * 1.5, -1);
    expect(damageFor(a, 60, normalFoe, 'wrong', 0).damage).toBeCloseTo(right / 4, -1);
    expect(damageFor(a, 60, normalFoe, 'wrong', 0).damage).toBeGreaterThanOrEqual(1);
  });
  it('type advantage sits on top', () => {
    const fireFoe = makeMonster('factorch-1', 10); // water > fire
    const plain = damageFor(a, 60, normalFoe, 'right', 0);
    const strong = damageFor(a, 60, fireFoe, 'right', 0);
    expect(strong.effect).toBe('strong');
    expect(strong.damage).toBeGreaterThan(plain.damage);
    expect(damageFor(fireFoe, 60, a, 'right', 0).effect).toBe('weak');
  });
  it('foes with no question hit softer, and higher levels hit harder', () => {
    expect(damageFor(a, 60, normalFoe, undefined, 0).damage).toBeLessThan(damageFor(a, 60, normalFoe, 'right', 0).damage);
    expect(damageFor({ ...a, level: 30 }, 60, normalFoe, 'right', 0).damage).toBeGreaterThan(damageFor(a, 60, normalFoe, 'right', 0).damage);
  });
});

describe('questions', () => {
  it('attacks ask the attacker’s topic and catches ask the wild monster’s topic', () => {
    const { state } = newBattle(setup());
    expect(questionFor(state, { kind: 'fight' })).toEqual({ topic: 'times-tables', band: bandFor('times-tables', 1, false) });
    expect(questionFor(state, { kind: 'catch' })?.topic).toBe('add-sub');
    expect(questionFor(state, { kind: 'run' })).toBeNull();
  });
  it('the band follows the area and which half of it', () => {
    expect(bandFor('times-tables', 1, false)).toBeLessThan(bandFor('times-tables', 6, true));
    expect(bandFor('division', 3, true)).toBeGreaterThanOrEqual(bandFor('division', 3, false));
  });
  it('quick is judged by the question’s difficulty, and calm turns it off', () => {
    const easy = { topic: 'times-tables' as const, band: 1 };
    const hard = { topic: 'times-tables' as const, band: 10 };
    expect(quickSeconds('times-tables', 10)).toBeGreaterThan(quickSeconds('times-tables', 1));
    expect(judgeAnswer({ correct: true, ms: 3000, ...easy })).toBe('quick-right');
    expect(judgeAnswer({ correct: true, ms: 6000, ...easy })).toBe('right');
    expect(judgeAnswer({ correct: true, ms: 6000, ...hard })).toBe('quick-right');
    expect(judgeAnswer({ correct: true, ms: 100, ...easy, calm: true })).toBe('right');
    expect(judgeAnswer({ correct: false, ms: 100, ...easy })).toBe('wrong');
  });
});

describe('a fight', () => {
  it('hurts the foe, then the foe hits back', () => {
    const { state } = newBattle(setup());
    const step = play(state, { kind: 'fight', attack: 0, answer: 'right' }, half);
    expect(step.events.map((e) => e.kind)).toEqual(['attack', 'attack']);
    expect(step.state.foes[0].hp).toBeLessThan(state.foes[0].hp);
    expect(step.state.team[0].hp).toBeLessThan(state.team[0].hp);
    expect(step.state.questions).toBe(1);
    expect(state.foes[0].hp).toBe(maxHpOf(state.foes[0])); // the old state is untouched
  });
  it('shows the right answer after a wrong one', () => {
    const { state } = newBattle(setup());
    const step = play(state, { kind: 'fight', attack: 0, answer: 'wrong' }, half);
    expect(step.events[0]).toMatchObject({ kind: 'attack', side: 'you', answer: 'wrong', showAnswer: true });
  });
  it('wins, gives exp and ends with no counter-attack', () => {
    const foe = { ...makeMonster('plusplash-1', 3), hp: 1 };
    const { state } = newBattle(setup({ foes: [foe] }));
    const step = play(state, { kind: 'fight', attack: 1, answer: 'right' }, half);
    expect(step.state.phase).toBe('won');
    expect(step.events.map((e) => e.kind)).toEqual(['attack', 'faint', 'exp', 'won']);
    expect(step.state.team[0].exp).toBeGreaterThan(state.team[0].exp);
  });
  it('losing keeps everything and healTeam sends the team back full', () => {
    const tired = { ...makeMonster('factorch-1', 5), hp: 1 };
    const { state } = newBattle(setup({ team: [tired], foes: [makeMonster('digibud-3', 40)] }));
    const step = play(state, { kind: 'fight', attack: 0, answer: 'wrong' }, zero);
    expect(step.state.phase).toBe('lost');
    expect(step.state.team).toHaveLength(1);
    expect(step.state.bag).toEqual(state.bag);
    expect(healTeam(step.state.team)[0].hp).toBe(maxHpOf(tired));
  });
  it('a fainted monster must be replaced for free, then the battle goes on', () => {
    const tired = { ...makeMonster('factorch-1', 5), hp: 1 };
    const { state } = newBattle(setup({ team: [tired, makeMonster('multipup-1', 8)], foes: [makeMonster('digibud-3', 40)] }));
    const down = play(state, { kind: 'fight', attack: 0, answer: 'right' }, zero).state;
    expect(down.phase).toBe('replace');
    expect(() => play(down, { kind: 'fight', attack: 0, answer: 'right' }, zero)).toThrow(BattleRuleError);
    const back = play(down, { kind: 'switch', to: 1 }, zero);
    expect(back.state.phase).toBe('choose');
    expect(back.state.active).toBe(1);
    expect(back.state.turn).toBe(down.turn); // free: no foe attack
    expect(back.state.team[1].hp).toBe(down.team[1].hp);
  });
  it('a trainer sends the next monster and the exp is bigger than for a wild one', () => {
    const f = () => ({ ...makeMonster('plusplash-1', 5), hp: 1 });
    const trainer = play(newBattle(setup({ kind: 'trainer', foes: [f(), f()] })).state, { kind: 'fight', attack: 1, answer: 'right' }, half);
    expect(trainer.state.phase).toBe('choose');
    expect(trainer.state.foeActive).toBe(1);
    expect(trainer.events.map((e) => e.kind)).toContain('foe-sent');
    const wild = play(newBattle(setup({ foes: [f()] })).state, { kind: 'fight', attack: 1, answer: 'right' }, half);
    const gain = (events: typeof wild.events) => events.find((e) => e.kind === 'exp') as { amount: number };
    expect(gain(trainer.events).amount).toBeGreaterThan(gain(wild.events).amount);
  });
});

describe('switch, bag and run', () => {
  it('switching costs the turn, a potion heals up to full', () => {
    const hurt = { ...makeMonster('factorch-1', 10), hp: 5 };
    const { state } = newBattle(setup({ team: [hurt, makeMonster('multipup-1', 8)] }));
    const sw = play(state, { kind: 'switch', to: 1 }, half);
    expect(sw.state.active).toBe(1);
    expect(sw.events.map((e) => e.kind)).toEqual(['switch', 'attack']);
    const potion = play(state, { kind: 'item', item: 'potion' }, half);
    expect(potion.state.team[0].hp).toBeGreaterThan(5);
    expect(potion.state.bag.potion).toBe(1);
    expect(state.bag.potion).toBe(2);
  });
  it('running works from a wild battle', () => {
    const run = play(newBattle(setup()).state, { kind: 'run' }, half);
    expect(run.state.phase).toBe('ran');
    expect(isOver(run.state)).toBe(true);
  });
  it('refuses bad actions', () => {
    const { state } = newBattle(setup({ team: [makeMonster('factorch-1', 10), { ...makeMonster('multipup-1', 8), hp: 0 }] }));
    const bad: BattleAction[] = [
      { kind: 'fight', attack: 9, answer: 'right' },
      { kind: 'fight', attack: -1, answer: 'right' },
      { kind: 'fight', attack: 0, answer: 'amazing' as never },
      { kind: 'switch', to: 0 }, // already out
      { kind: 'switch', to: 1 }, // tired
      { kind: 'switch', to: 7 },
      { kind: 'item', item: 'potion' }, // already full
      { kind: 'item', item: 'ball' as never },
      { kind: 'item', item: 'super-potion' }, // none in the bag
      { kind: 'catch', answer: 'right', ball: 'great-ball' }, // none in the bag
      { kind: 'bogus' } as never,
    ];
    for (const action of bad) expect(() => play(state, action, half), JSON.stringify(action)).toThrow(BattleRuleError);
    const trainer = newBattle(setup({ kind: 'trainer' })).state;
    expect(() => play(trainer, { kind: 'run' }, half)).toThrow(BattleRuleError);
    expect(() => play(trainer, { kind: 'catch', answer: 'right' }, half)).toThrow(BattleRuleError);
    const over = play(newBattle(setup()).state, { kind: 'run' }, half).state;
    expect(() => play(over, { kind: 'run' }, half)).toThrow(BattleRuleError);
    expect(() => newBattle(setup({ team: [] }))).toThrow(BattleRuleError);
    expect(() => newBattle(setup({ team: [{ ...makeMonster('factorch-1', 5), hp: 0 }] }))).toThrow(BattleRuleError);
    expect(() => newBattle(setup({ foes: [makeMonster('plusplash-1', 5), makeMonster('plusplash-1', 5)] }))).toThrow(BattleRuleError);
  });
});

describe('catching', () => {
  const wild = (hpShare: number) => {
    const m = makeMonster('plusplash-1', 8);
    return { ...m, hp: Math.max(1, Math.round(maxHpOf(m) * hpShare)) };
  };
  it('is easier at low health and much easier after a right answer', () => {
    expect(catchChance(wild(0.2), 'right', 'ball')).toBeGreaterThan(catchChance(wild(1), 'right', 'ball'));
    expect(catchChance(wild(0.5), 'right', 'ball')).toBeGreaterThan(2 * catchChance(wild(0.5), 'wrong', 'ball'));
    expect(catchChance(wild(0.5), 'quick-right', 'ball')).toBeGreaterThan(catchChance(wild(0.5), 'right', 'ball'));
    expect(catchChance(wild(0.5), 'right', 'great-ball')).toBeGreaterThan(catchChance(wild(0.5), 'right', 'ball'));
    expect(catchChance({ ...wild(0.1), species: 'plusplash-3' }, 'quick-right', 'great-ball')).toBeLessThanOrEqual(TUNING.catchMax);
  });
  it('catches into the team, or the box when the team is full, and uses up a ball', () => {
    const { state } = newBattle(setup({ foes: [wild(0.1)] }));
    const got = play(state, { kind: 'catch', answer: 'right' }, zero);
    expect(got.state.phase).toBe('caught');
    expect(got.state.team).toHaveLength(2);
    expect(got.state.bag.ball).toBe(2);
    expect(got.events.map((e) => e.kind)).toEqual(['catch-try', 'caught', 'exp']);
    const full = newBattle(setup({ team: Array.from({ length: 6 }, () => makeMonster('factorch-1', 10)), foes: [wild(0.1)] })).state;
    const boxed = play(full, { kind: 'catch', answer: 'right' }, zero);
    expect(boxed.state.team).toHaveLength(6);
    expect(boxed.state.box).toHaveLength(1);
  });
  it('a miss costs the ball and the foe hits back', () => {
    const { state } = newBattle(setup({ foes: [wild(1)] }));
    const miss = play(state, { kind: 'catch', answer: 'wrong' }, () => 0.999);
    expect(miss.state.phase).toBe('choose');
    expect(miss.state.bag.ball).toBe(2);
    expect(miss.events.map((e) => e.kind)).toEqual(['catch-try', 'attack']);
  });
});

describe('exp, levelling and evolving', () => {
  it('needs more exp for each level', () => {
    expect(expForLevel(1)).toBe(0);
    for (let l = 2; l < 50; l++) expect(expForLevel(l + 1) - expForLevel(l)).toBeGreaterThan(expForLevel(l) - expForLevel(l - 1));
  });
  it('levels up, and the new health comes in full', () => {
    const m = makeMonster('factorch-1', 5);
    const r = gainExp(m, expForLevel(6) - m.exp);
    expect(r.levelUps).toEqual([6]);
    expect(r.monster.hp).toBe(maxHpOf(r.monster));
    expect(r.evolvedTo).toEqual([]);
  });
  it('a hurt monster stays hurt, a tired one stays tired', () => {
    const hurt = { ...makeMonster('factorch-1', 5), hp: 3 };
    const r = gainExp(hurt, 10000);
    expect(r.monster.hp).toBeGreaterThan(3);
    expect(r.monster.hp).toBeLessThan(maxHpOf(r.monster));
    expect(gainExp({ ...hurt, hp: 0 }, 10000).monster.hp).toBe(0);
  });
  it('evolves at its level, twice over a long climb, and not past the last form', () => {
    const [first, second] = FAMILIES.factorch.evolveAt;
    const m = makeMonster('factorch-1', first - 1);
    const a = gainExp(m, expForLevel(first) - m.exp);
    expect(a.evolvedTo).toEqual(['factorch-2']);
    expect(a.monster.species).toBe('factorch-2');
    const b = gainExp(m, expForLevel(second + 1) - m.exp);
    expect(b.evolvedTo).toEqual(['factorch-2', 'factorch-3']);
    expect(gainExp(makeMonster('factorch-3', 49), 10 ** 9).monster.level).toBe(TUNING.maxLevel);
  });
  it('shares exp between the monsters that fought, in a battle', () => {
    const foe = { ...makeMonster('plusplash-1', 10), hp: 1 };
    let { state } = newBattle(setup({ team: [makeMonster('factorch-1', 10), makeMonster('multipup-1', 10)], foes: [foe] }));
    state = play(state, { kind: 'switch', to: 1 }, zero).state;
    state = play(state, { kind: 'fight', attack: 1, answer: 'right' }, zero).state;
    expect(state.team[0].exp).toBeGreaterThan(makeMonster('factorch-1', 10).exp);
    expect(state.team[1].exp).toBeGreaterThan(makeMonster('multipup-1', 10).exp);
  });
  it('evolution shows up as events in a battle', () => {
    const near = { ...makeMonster('factorch-1', 15), exp: expForLevel(16) - 1 };
    const foe = { ...makeMonster('plusplash-1', 12), hp: 1 };
    const step = play(newBattle(setup({ team: [near], foes: [foe] })).state, { kind: 'fight', attack: 0, answer: 'right' }, zero);
    const kinds = step.events.map((e) => e.kind);
    expect(kinds).toContain('level-up');
    expect(kinds).toContain('evolved');
    expect(step.state.team[0].species).toBe('factorch-2');
  });
});

describe('wild and trainer AI', () => {
  it('trainers always use the best-looking attack, wild monsters sometimes pick another', () => {
    const own = makeMonster('plusplash-3', 30); // 4 attacks, best is the last
    const trainer = newBattle(setup({ kind: 'trainer', foes: [own] })).state;
    const picks = (state: typeof trainer) => new Set(Array.from({ length: 50 }, (_, i) => {
      const r = randomFromSeed(`ai:${i}`);
      const e = play({ ...state, team: [{ ...state.team[0], hp: 999 }] }, { kind: 'fight', attack: 0, answer: 'right' }, r).events.find((x) => x.kind === 'attack' && x.side === 'foe') as { attack: string };
      return e.attack;
    }));
    expect(picks(trainer).size).toBe(1);
    const wildState = newBattle(setup({ foes: [own] })).state;
    expect(picks(wildState).size).toBeGreaterThan(1);
  });
});

describe('replay', () => {
  it('the same actions and random numbers give the same battle', () => {
    const make = (seed: string) => {
      const random = randomFromSeed(seed);
      return { random, setup: setup({ team: randomTeam(12, 3, random), foes: [randomWild(12, random)] }) };
    };
    const { random, setup: s } = make('replay');
    // Play it live, recording the actions.
    const actions: BattleAction[] = [];
    let { state } = newBattle(s);
    const student = { right: 0.6, quick: 0.5, catchBelow: 0.4 };
    const events: unknown[] = [];
    const live = randomFromSeed('replay-dice');
    while (!isOver(state)) {
      const a = chooseAction(state, student, random);
      actions.push(a);
      const step = play(state, a, live);
      state = step.state;
      events.push(...step.events);
    }
    const again = replayBattle(s, actions, randomFromSeed('replay-dice'));
    expect(again.state).toEqual(state);
    expect(again.events.slice(1)).toEqual(events);
    // A different seed gives a different battle.
    const others = ['a', 'b', 'c'].map((seed) => {
      try { return replayBattle(s, actions, randomFromSeed(seed)).state; } catch { return null; }
    });
    expect(others.some((o) => JSON.stringify(o) !== JSON.stringify(state))).toBe(true);
  });
});
