import { describe, expect, it } from 'vitest';
import { autoplay } from './autoplay';
import { EFFECTS, ENEMIES, GEM, KEEP_HEALTH, MANA, MATHS, STEP, TOWER } from './config';
import { act, enemyHealth, hit, newGame, pickTarget, spawnEnemy, step, type GameState } from './engine';
import { combined, combineProblem, shotStats, type Gem } from './gems';
import { checkLevel, type LevelData } from './level';
import { CAMPAIGN } from './levels';

/** A straight path along row 5, left to right, with the Keep at the end. */
const STRAIGHT: LevelData = {
  id: 'test',
  name: 'Test',
  map: Array(10).fill('................'),
  paths: [[[-1, 5], [15, 5]]],
  startMana: 1000,
  waves: [{ groups: [{ kind: 'walker', count: 1, gap: 0 }] }, { groups: [{ kind: 'walker', count: 1, gap: 0 }] }],
};

const gem = (grade: number, ...colours: Gem['colours']): Gem => ({ id: 0, grade, colours });

/** A game mid-wave with nothing spawning, so tests can place enemies themselves. */
function inWave(level = STRAIGHT): GameState {
  const state = newGame(level);
  act(state, { type: 'start-wave' });
  state.spawns.length = 0;
  return state;
}

function runSeconds(state: GameState, seconds: number) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(state);
}

describe('levels', () => {
  it('the prototype level is valid', () => {
    expect(checkLevel(CAMPAIGN[0])).toEqual([]);
  });

  it('finds broken levels', () => {
    const bad: LevelData = { ...STRAIGHT, map: [...STRAIGHT.map.slice(0, 9), '.....^..........'], paths: [[[0, 9], [3, 5]]] };
    const problems = checkLevel(bad);
    expect(problems.some((p) => p.includes('diagonally'))).toBe(true);
    expect(checkLevel({ ...STRAIGHT, map: STRAIGHT.map.slice(1) })[0]).toMatch(/10 rows/);
    expect(checkLevel({ ...STRAIGHT, map: ['.....^..........', ...STRAIGHT.map.slice(1)], paths: [[[5, -1], [5, 5]]] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/crosses rock/)]),
    );
  });
});

describe('building and gems', () => {
  it('builds towers on grass only, and charges for them', () => {
    const state = newGame(STRAIGHT);
    expect(act(state, { type: 'build', x: 3, y: 5 })).toEqual({ ok: false, reason: 'not-buildable' });
    expect(act(state, { type: 'build', x: 3, y: 4 })).toEqual({ ok: true });
    expect(act(state, { type: 'build', x: 3, y: 4 })).toEqual({ ok: false, reason: 'tower-there' });
    expect(state.mana).toBe(1000 - TOWER.buildCost);
  });

  it('refuses when there is not enough mana, and changes nothing', () => {
    const state = newGame({ ...STRAIGHT, startMana: TOWER.buildCost - 1 });
    expect(act(state, { type: 'build', x: 3, y: 4 })).toEqual({ ok: false, reason: 'no-mana' });
    expect(state.towers).toEqual([]);
    expect(state.mana).toBe(TOWER.buildCost - 1);
  });

  it('upgrades towers up to level 3', () => {
    const state = newGame(STRAIGHT);
    act(state, { type: 'build', x: 3, y: 4 });
    expect(act(state, { type: 'upgrade', x: 3, y: 4 }).ok).toBe(true);
    expect(act(state, { type: 'upgrade', x: 3, y: 4 }).ok).toBe(true);
    expect(act(state, { type: 'upgrade', x: 3, y: 4 })).toEqual({ ok: false, reason: 'max-level' });
    expect(state.mana).toBe(1000 - TOWER.buildCost - TOWER.upgradeCost[0] - TOWER.upgradeCost[1]);
  });

  it('makes gems, puts them in towers and swaps them out', () => {
    const state = newGame(STRAIGHT);
    act(state, { type: 'build', x: 3, y: 4 });
    act(state, { type: 'create', colour: 'red' });
    act(state, { type: 'create', colour: 'blue' });
    expect(state.mana).toBe(1000 - TOWER.buildCost - 2 * GEM.createCost);
    act(state, { type: 'place', slot: 0, x: 3, y: 4 });
    expect(state.towers[0].gem?.colours).toEqual(['red']);
    act(state, { type: 'place', slot: 1, x: 3, y: 4 });
    expect(state.towers[0].gem?.colours).toEqual(['blue']);
    expect(state.inventory[1]?.colours).toEqual(['red']);
    expect(act(state, { type: 'take-out', x: 3, y: 4 }).ok).toBe(true);
    expect(state.towers[0].gem).toBeNull();
  });

  it('refuses a new gem when the bag is full', () => {
    const state = newGame(STRAIGHT);
    for (let i = 0; i < GEM.inventorySlots; i++) act(state, { type: 'create', colour: 'green' });
    expect(act(state, { type: 'create', colour: 'green' })).toEqual({ ok: false, reason: 'inventory-full' });
  });

  it('combines two gems of the same grade into the next grade, in either place', () => {
    const state = newGame(STRAIGHT);
    act(state, { type: 'build', x: 3, y: 4 });
    act(state, { type: 'create', colour: 'red' });
    act(state, { type: 'create', colour: 'red' });
    act(state, { type: 'place', slot: 0, x: 3, y: 4 });
    const before = state.mana;
    expect(act(state, { type: 'combine', from: { slot: 1 }, onto: { x: 3, y: 4 } })).toEqual({ ok: true });
    expect(state.towers[0].gem).toMatchObject({ grade: 2, colours: ['red'] });
    expect(state.inventory[1]).toBeNull();
    expect(state.mana).toBe(before - GEM.combineCost[0]);
  });

  it('only combines gems of the same grade, up to grade 5', () => {
    expect(combineProblem({ ...gem(1, 'red'), id: 1 }, { ...gem(2, 'red'), id: 2 })).toBe('different-grades');
    expect(combineProblem({ ...gem(5, 'red'), id: 1 }, { ...gem(5, 'red'), id: 2 })).toBe('max-grade');
    expect(combineProblem({ ...gem(4, 'red'), id: 1 }, { ...gem(4, 'red'), id: 2 })).toBeNull();
    const a = { ...gem(1, 'red'), id: 1 };
    expect(combineProblem(a, a)).toBe('same-gem');
  });

  it('mixing colours makes a gem with both effects, each weaker', () => {
    const mixed = combined(gem(1, 'yellow'), gem(1, 'red'), 9);
    expect(mixed).toEqual({ id: 9, grade: 2, colours: ['red', 'yellow'] });
    const pure = shotStats(gem(2, 'red'), 1);
    const both = shotStats(mixed, 1);
    expect(both.splashShare).toBeCloseTo(pure.splashShare * GEM.mixedStrength);
    expect(both.critChance).toBeGreaterThan(0);
    expect(both.slow).toBe(0);
  });
});

describe('damage', () => {
  it('each grade hits harder, and more than doubles over two grades', () => {
    const g1 = shotStats(gem(1, 'blue'), 1).damage;
    const g2 = shotStats(gem(2, 'blue'), 1).damage;
    const g3 = shotStats(gem(3, 'blue'), 1).damage;
    expect(g2).toBeGreaterThan(2 * g1);
    expect(g3).toBeGreaterThan(2 * g2);
  });

  it('tower levels add range and fire rate', () => {
    const l1 = shotStats(gem(1, 'red'), 1);
    const l3 = shotStats(gem(1, 'red'), 3);
    expect(l3.range).toBeCloseTo(l1.range + TOWER.rangeBonus[2]);
    expect(l3.rate).toBeCloseTo(l1.rate * TOWER.rateBonus[2]);
  });

  it('a shot takes its damage off the enemy', () => {
    const state = inWave();
    const enemy = spawnEnemy(state, 'brute', 0, 5);
    const stats = shotStats(gem(1, 'blue'), 1);
    hit(state, enemy, stats, ['blue']);
    expect(enemy.health).toBeCloseTo(enemy.maxHealth - stats.damage);
  });

  it('enemies get tougher every wave', () => {
    expect(enemyHealth('walker', 1)).toBe(ENEMIES.walker.health);
    expect(enemyHealth('walker', 5)).toBeGreaterThan(enemyHealth('walker', 4));
  });
});

describe('effects', () => {
  it('red splashes onto enemies close by, but not far away', () => {
    const state = inWave();
    const target = spawnEnemy(state, 'brute', 0, 5);
    const near = spawnEnemy(state, 'brute', 0, 5.5);
    const far = spawnEnemy(state, 'brute', 0, 9);
    const stats = shotStats(gem(1, 'red'), 1);
    hit(state, target, stats, ['red']);
    expect(near.health).toBeCloseTo(near.maxHealth - stats.damage * EFFECTS.red.share);
    expect(far.health).toBe(far.maxHealth);
    expect(state.events.at(-1)).toMatchObject({ type: 'hit', splash: 1 });
  });

  it('blue slows an enemy down, then wears off', () => {
    const state = inWave();
    const slowed = spawnEnemy(state, 'brute', 0, 1);
    const normal = spawnEnemy(state, 'brute', 0, 1);
    slowed.maxHealth = normal.maxHealth = slowed.health = normal.health = 1e9;
    hit(state, slowed, shotStats(gem(1, 'blue'), 1), ['blue']);
    runSeconds(state, 1);
    const expected = ENEMIES.brute.speed * (1 - EFFECTS.blue.slow);
    expect(slowed.distance - 1).toBeCloseTo(expected, 1);
    expect(normal.distance - 1).toBeCloseTo(ENEMIES.brute.speed, 1);
    const gapAfterSlow = normal.distance - slowed.distance;
    runSeconds(state, 2);
    expect(normal.distance - slowed.distance).toBeCloseTo(gapAfterSlow + ENEMIES.brute.speed * EFFECTS.blue.slow * 0.5, 1);
  });

  it('a stronger slow wins over a weaker one, but a weaker one does not undo it', () => {
    const state = inWave();
    const e = spawnEnemy(state, 'brute', 0, 1);
    hit(state, e, shotStats(gem(4, 'blue'), 1), ['blue']);
    const strong = e.slow;
    hit(state, e, shotStats(gem(1, 'blue'), 1), ['blue']);
    expect(e.slow).toBe(strong);
  });

  it('green poisons for 3 seconds', () => {
    const state = inWave();
    const e = spawnEnemy(state, 'boss', 0, 1);
    const stats = shotStats(gem(1, 'green'), 1);
    hit(state, e, stats, ['green']);
    const afterHit = e.health;
    runSeconds(state, 5);
    expect(afterHit - e.health).toBeCloseTo(stats.damage * stats.poisonShare * EFFECTS.green.seconds, 0);
  });

  it('yellow sometimes lands a critical hit', () => {
    const state = inWave();
    const stats = shotStats(gem(1, 'yellow'), 1);
    let crits = 0;
    for (let i = 0; i < 1000; i++) {
      const e = spawnEnemy(state, 'boss', 0, 1);
      hit(state, e, stats, ['yellow']);
      if (e.maxHealth - e.health > stats.damage * 1.01) crits++;
    }
    expect(crits / 1000).toBeGreaterThan(EFFECTS.yellow.chance - 0.05);
    expect(crits / 1000).toBeLessThan(EFFECTS.yellow.chance + 0.05);
  });
});

describe('targeting', () => {
  function towerWithEnemies() {
    const state = inWave();
    act(state, { type: 'build', x: 5, y: 4 });
    const tower = state.towers[0];
    const leader = spawnEnemy(state, 'walker', 0, 7.5); // further along: closest to the Keep
    const big = spawnEnemy(state, 'brute', 0, 5.5);
    const outOfRange = spawnEnemy(state, 'boss', 0, 14);
    return { state, tower, leader, big, outOfRange };
  }

  it('"first in line" shoots the enemy closest to the Keep', () => {
    const { state, tower, leader } = towerWithEnemies();
    expect(pickTarget(state, tower, 3)).toBe(leader);
  });

  it('"strongest" shoots the enemy with the most health', () => {
    const { state, tower, big } = towerWithEnemies();
    act(state, { type: 'targeting', x: 5, y: 4, mode: 'strongest' });
    expect(pickTarget(state, tower, 3)).toBe(big);
  });

  it('never shoots out of range', () => {
    const { state, tower } = towerWithEnemies();
    state.enemies = state.enemies.filter((e) => e.kind === 'boss');
    expect(pickTarget(state, tower, 3)).toBeUndefined();
  });

  it('a tower with a gem shoots and kills, and the kill pays mana', () => {
    const state = inWave();
    act(state, { type: 'build', x: 5, y: 4 });
    act(state, { type: 'create', colour: 'red' });
    act(state, { type: 'place', slot: 0, x: 5, y: 4 });
    const mana = state.mana;
    spawnEnemy(state, 'swarm', 0, 4);
    runSeconds(state, 2);
    expect(state.stats.kills).toBe(1);
    expect(state.mana).toBe(mana + ENEMIES.swarm.mana + MANA.waveClear);
    expect(state.events.some((e) => e.type === 'shot')).toBe(true);
  });
});

describe('waves, winning and losing', () => {
  it('an enemy reaching the Keep hurts it and pays nothing', () => {
    const state = inWave();
    spawnEnemy(state, 'brute', 0, 15.9);
    const mana = state.mana;
    runSeconds(state, 1);
    expect(state.keep).toBe(KEEP_HEALTH - ENEMIES.brute.damage);
    expect(state.mana).toBe(mana + MANA.waveClear);
    expect(state.phase).toBe('build');
  });

  it('only one wave runs at a time', () => {
    const state = newGame(STRAIGHT);
    act(state, { type: 'start-wave' });
    expect(act(state, { type: 'start-wave' })).toEqual({ ok: false, reason: 'wave-running' });
  });

  it('nothing moves between waves', () => {
    const state = newGame(STRAIGHT);
    step(state);
    expect(state.step).toBe(0);
  });

  it('doing nothing loses the prototype level', () => {
    const state = autoplay(CAMPAIGN[0], 'idle');
    expect(state.phase).toBe('lost');
    expect(state.keep).toBe(0);
    expect(act(state, { type: 'start-wave' })).toEqual({ ok: false, reason: 'game-over' });
  });

  it('the first level is easy with the Mana Well: any colour wins with 3 stars, even getting most questions wrong', () => {
    for (const colours of [['red'], ['blue'], ['green'], ['yellow']] as const) {
      const state = autoplay(CAMPAIGN[0], 'towers-only', 1, colours, { accuracy: 0.3 });
      expect(state.phase).toBe('won');
      expect(state.wave).toBe(CAMPAIGN[0].waves.length);
      expect(state.stars).toBe(3);
    }
  });

  it('skipping the Mana Well loses: maths is the main source of mana', () => {
    for (const strategy of ['towers-only', 'sensible'] as const) {
      const state = autoplay(CAMPAIGN[0], strategy, 1);
      expect(state.phase).toBe('lost');
    }
    const withMaths = autoplay(CAMPAIGN[0], 'sensible', 1, undefined, { accuracy: 0.7 });
    expect(withMaths.stats.wellMana).toBeGreaterThan(withMaths.stats.manaEarned / 2);
  });

  it('the same seed and moves always play out the same', () => {
    const a = autoplay(CAMPAIGN[0], 'towers-only', 7, ['yellow']);
    const b = autoplay(CAMPAIGN[0], 'towers-only', 7, ['yellow']);
    expect(a.step).toBe(b.step);
    expect(a.keep).toBe(b.keep);
    expect(a.mana).toBe(b.mana);
  });
});

describe('maths rewards', () => {
  it('the Mana Well pays for right answers, adds a streak bonus, and never takes mana for wrong ones', () => {
    const state = newGame(STRAIGHT);
    const start = state.mana;
    act(state, { type: 'well-answer', correct: true });
    act(state, { type: 'well-answer', correct: true });
    expect(state.mana).toBe(start + 2 * MATHS.well.mana);
    act(state, { type: 'well-answer', correct: true }); // third in a row: bonus
    expect(state.mana).toBe(start + 3 * MATHS.well.mana + MATHS.well.streakBonus);
    const before = state.mana;
    act(state, { type: 'well-answer', correct: false });
    expect(state.mana).toBe(before);
    expect(state.wellStreak).toBe(0);
    expect(state.stats).toMatchObject({ wellAsked: 4, wellRight: 3 });
  });

  it('the Mana Well rests after 10 questions until the next wave is cleared', () => {
    const state = newGame(STRAIGHT);
    for (let i = 0; i < MATHS.well.questions; i++) expect(act(state, { type: 'well-answer', correct: true }).ok).toBe(true);
    expect(act(state, { type: 'well-answer', correct: true })).toEqual({ ok: false, reason: 'well-empty' });
    act(state, { type: 'start-wave' });
    runSeconds(state, 30);
    expect(state.phase).toBe('build');
    expect(state.wellLeft).toBe(MATHS.well.questions);
  });

  it('the Wave Gate gives a Power Surge on boss waves only', () => {
    const level: LevelData = { ...STRAIGHT, waves: [{ groups: [{ kind: 'boss', count: 1, gap: 0 }] }, ...STRAIGHT.waves] };
    const boss = newGame(level);
    act(boss, { type: 'start-wave', gateRight: 3 });
    expect(boss.surge).toBe(0.25);
    const two = newGame(level);
    act(two, { type: 'start-wave', gateRight: 2 });
    expect(two.surge).toBe(0.1);
    const one = newGame(level);
    act(one, { type: 'start-wave', gateRight: 1 });
    expect(one.surge).toBe(0);
    const notBoss = newGame(STRAIGHT);
    act(notBoss, { type: 'start-wave', gateRight: 3 });
    expect(notBoss.surge).toBe(0);
  });

  it('a Power Surge makes shots hit harder', () => {
    const state = inWave();
    act(state, { type: 'build', x: 5, y: 4 });
    act(state, { type: 'create', colour: 'blue' });
    act(state, { type: 'place', slot: 0, x: 5, y: 4 });
    state.surge = 0.25;
    const e = spawnEnemy(state, 'boss', 0, 5);
    e.health = e.maxHealth = 1e6;
    runSeconds(state, 0.5);
    expect(e.maxHealth - e.health).toBeCloseTo(shotStats(gem(1, 'blue'), 1).damage * 1.25);
  });

  it('the Keep Shield is offered once when the Keep drops low, and heals for each right answer', () => {
    const state = inWave();
    state.keep = 30;
    spawnEnemy(state, 'brute', 0, 15.95);
    spawnEnemy(state, 'boss', 0, 2);
    runSeconds(state, 0.2);
    expect(state.keep).toBe(18);
    expect(state.shield).toBe('offered');
    expect(state.events.filter((e) => e.type === 'keep-low')).toHaveLength(1);
    expect(act(state, { type: 'shield', right: 4 }).ok).toBe(true);
    expect(state.keep).toBe(18 + 4 * MATHS.shield.heal * KEEP_HEALTH);
    expect(act(state, { type: 'shield', right: 5 })).toEqual({ ok: false, reason: 'no-shield' });
  });

  it('the Keep Shield never heals past full health', () => {
    const state = inWave();
    state.shield = 'offered';
    state.keep = 90;
    act(state, { type: 'shield', right: 5 });
    expect(state.keep).toBe(KEEP_HEALTH);
  });
});
