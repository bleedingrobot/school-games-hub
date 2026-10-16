/**
 * The Gem Keep simulation. Pure: no screen, no React, no clock. `act` makes one of the
 * player's moves, `step` moves the world on by one sixtieth of a second. Randomness comes
 * from a seeded generator kept in the state, so the same seed and the same moves on the same
 * steps always give the same game (which lets the server replay a run later if it needs to).
 *
 * Both functions change the state they're given, for speed: a level is about 40,000 steps.
 * What happened in a step (shots, hits, kills) is added to `state.events` for the screen to
 * show; the screen empties it.
 */
import { ENEMIES, GEM, HEALTH_PER_WAVE, KEEP_HEALTH, MANA, MATHS, STARS, STEP, TOWER, type EnemyKind } from './config';
import { combineCost, combined, combineProblem, shotStats, type Colour, type Gem, type ShotStats } from './gems';
import { groundOf, pathShape, pointAlong, type Ground, type LevelData, type PathShape, type Tile } from './level';

export type Targeting = 'first' | 'strongest';
export type Phase = 'build' | 'wave' | 'won' | 'lost';

export interface Tower {
  x: number;
  y: number;
  level: number;
  gem: Gem | null;
  targeting: Targeting;
  /** Seconds until it can fire again. */
  cooldown: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  path: number;
  /** How far along its path, in tiles. */
  distance: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  /** Share of speed taken away, until `slowUntil`. */
  slow: number;
  slowUntil: number;
  poisonPerSecond: number;
  poisonUntil: number;
}

export interface Projectile {
  x: number;
  y: number;
  target: number;
  stats: ShotStats;
  colours: Colour[];
}

export type GameEvent =
  | { type: 'shot'; x: number; y: number; colours: Colour[] }
  | { type: 'hit'; x: number; y: number; colours: Colour[]; crit: boolean; splash: number }
  | { type: 'kill'; x: number; y: number; kind: EnemyKind; mana: number }
  | { type: 'leak'; kind: EnemyKind; damage: number }
  | { type: 'wave-start'; wave: number; surge: number }
  | { type: 'well'; correct: boolean; mana: number; streak: number }
  | { type: 'keep-low' }
  | { type: 'shield'; healed: number }
  | { type: 'wave-clear'; wave: number; mana: number }
  | { type: 'won'; stars: number }
  | { type: 'lost' };

export interface GameState {
  level: LevelData;
  ground: Ground[][];
  paths: PathShape[];
  step: number;
  /** Seconds of play (steps × STEP). */
  time: number;
  phase: Phase;
  /** Waves started so far. */
  wave: number;
  mana: number;
  keep: number;
  towers: Tower[];
  inventory: (Gem | null)[];
  enemies: Enemy[];
  projectiles: Projectile[];
  /** Enemies still to come this wave, soonest first. */
  spawns: { at: number; kind: EnemyKind; path: number }[];
  stars: number;
  /** Mana Well questions left before the next wave. */
  wellLeft: number;
  /** Right answers in a row at the Mana Well. */
  wellStreak: number;
  /** Extra damage this wave from the Wave Gate (0.25 = +25%). */
  surge: number;
  /** 'ready' until the Keep first drops low; then 'offered' until the student answers; then 'used'. */
  shield: 'ready' | 'offered' | 'used';
  nextId: number;
  /** The random generator's state (mulberry32). */
  random: number;
  events: GameEvent[];
  stats: {
    kills: number;
    leaked: number;
    manaEarned: number;
    manaSpent: number;
    /** Mana from the Mana Well. */
    wellMana: number;
    wellAsked: number;
    wellRight: number;
  };
}

/** Where a gem is: an inventory slot, or the tower on a tile. */
export type GemPlace = { slot: number } | { x: number; y: number };

export type Action =
  | { type: 'build'; x: number; y: number }
  | { type: 'upgrade'; x: number; y: number }
  | { type: 'targeting'; x: number; y: number; mode: Targeting }
  | { type: 'create'; colour: Colour }
  | { type: 'place'; slot: number; x: number; y: number }
  | { type: 'take-out'; x: number; y: number }
  | { type: 'combine'; from: GemPlace; onto: GemPlace }
  /** `gateRight`: right answers at the Wave Gate (0–3). Only boss waves get the Power Surge. */
  | { type: 'start-wave'; gateRight?: number }
  | { type: 'well-answer'; correct: boolean }
  | { type: 'shield'; right: number };

export type Refusal =
  | 'game-over'
  | 'not-buildable'
  | 'tower-there'
  | 'no-tower'
  | 'max-level'
  | 'no-mana'
  | 'no-gem'
  | 'inventory-full'
  | 'same-gem'
  | 'different-grades'
  | 'max-grade'
  | 'wave-running'
  | 'no-more-waves'
  | 'well-empty'
  | 'no-shield';

export type ActResult = { ok: true } | { ok: false; reason: Refusal };

export function newGame(level: LevelData, seed = 1): GameState {
  return {
    level,
    ground: groundOf(level),
    paths: level.paths.map(pathShape),
    step: 0,
    time: 0,
    phase: 'build',
    wave: 0,
    mana: level.startMana ?? MANA.start,
    keep: KEEP_HEALTH,
    towers: [],
    inventory: Array(GEM.inventorySlots).fill(null),
    enemies: [],
    projectiles: [],
    spawns: [],
    stars: 0,
    wellLeft: MATHS.well.questions,
    wellStreak: 0,
    surge: 0,
    shield: 'ready',
    nextId: 1,
    random: seed >>> 0,
    events: [],
    stats: { kills: 0, leaked: 0, manaEarned: 0, manaSpent: 0, wellMana: 0, wellAsked: 0, wellRight: 0 },
  };
}

/** A number from 0 up to 1, from the state's own generator (mulberry32). */
function random(state: GameState): number {
  state.random = (state.random + 0x6d2b79f5) >>> 0;
  let t = state.random;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const towerAt = (state: GameState, x: number, y: number) => state.towers.find((t) => t.x === x && t.y === y);

export const canBuildOn = (state: GameState, [x, y]: Tile) =>
  state.ground[y]?.[x] === 'grass' && !towerAt(state, x, y);

export const isBossWave = (level: LevelData, wave: number) =>
  level.waves[wave - 1]?.groups.some((g) => g.kind === 'boss') ?? false;

function spend(state: GameState, cost: number): boolean {
  if (state.mana < cost) return false;
  state.mana -= cost;
  state.stats.manaSpent += cost;
  return true;
}

function earn(state: GameState, mana: number) {
  state.mana = Math.min(MANA.max, state.mana + mana);
  state.stats.manaEarned += mana;
}

const freeSlot = (state: GameState) => state.inventory.indexOf(null);

function gemAt(state: GameState, place: GemPlace): Gem | null {
  if ('slot' in place) return state.inventory[place.slot] ?? null;
  return towerAt(state, place.x, place.y)?.gem ?? null;
}

function putGem(state: GameState, place: GemPlace, gem: Gem | null) {
  if ('slot' in place) state.inventory[place.slot] = gem;
  else towerAt(state, place.x, place.y)!.gem = gem;
}

const refuse = (reason: Refusal): ActResult => ({ ok: false, reason });
const OK: ActResult = { ok: true };

/** Makes one of the player's moves, if it's allowed. Nothing changes when it's refused. */
export function act(state: GameState, action: Action): ActResult {
  if (state.phase === 'won' || state.phase === 'lost') return refuse('game-over');
  switch (action.type) {
    case 'build': {
      const { x, y } = action;
      if (towerAt(state, x, y)) return refuse('tower-there');
      if (!canBuildOn(state, [x, y])) return refuse('not-buildable');
      if (!spend(state, TOWER.buildCost)) return refuse('no-mana');
      state.towers.push({ x, y, level: 1, gem: null, targeting: 'first', cooldown: 0 });
      return OK;
    }
    case 'upgrade': {
      const tower = towerAt(state, action.x, action.y);
      if (!tower) return refuse('no-tower');
      if (tower.level >= TOWER.maxLevel) return refuse('max-level');
      if (!spend(state, TOWER.upgradeCost[tower.level - 1])) return refuse('no-mana');
      tower.level++;
      return OK;
    }
    case 'targeting': {
      const tower = towerAt(state, action.x, action.y);
      if (!tower) return refuse('no-tower');
      tower.targeting = action.mode;
      return OK;
    }
    case 'create': {
      const slot = freeSlot(state);
      if (slot < 0) return refuse('inventory-full');
      if (!spend(state, GEM.createCost)) return refuse('no-mana');
      state.inventory[slot] = { id: state.nextId++, grade: 1, colours: [action.colour] };
      return OK;
    }
    case 'place': {
      const tower = towerAt(state, action.x, action.y);
      if (!tower) return refuse('no-tower');
      const gem = state.inventory[action.slot];
      if (!gem) return refuse('no-gem');
      // A gem already in the tower swaps into the slot this one came from.
      state.inventory[action.slot] = tower.gem;
      tower.gem = gem;
      tower.cooldown = Math.max(tower.cooldown, 0.3);
      return OK;
    }
    case 'take-out': {
      const tower = towerAt(state, action.x, action.y);
      if (!tower) return refuse('no-tower');
      if (!tower.gem) return refuse('no-gem');
      const slot = freeSlot(state);
      if (slot < 0) return refuse('inventory-full');
      state.inventory[slot] = tower.gem;
      tower.gem = null;
      return OK;
    }
    case 'combine': {
      const a = gemAt(state, action.from);
      const b = gemAt(state, action.onto);
      if (!a || !b) return refuse('no-gem');
      const problem = combineProblem(a, b);
      if (problem) return refuse(problem);
      if (!spend(state, combineCost(a.grade))) return refuse('no-mana');
      putGem(state, action.from, null);
      putGem(state, action.onto, combined(a, b, state.nextId++));
      return OK;
    }
    case 'start-wave': {
      if (state.phase === 'wave') return refuse('wave-running');
      if (state.wave >= state.level.waves.length) return refuse('no-more-waves');
      const right = Math.max(0, Math.min(MATHS.gate.questions, Math.floor(action.gateRight ?? 0)));
      startWave(state, isBossWave(state.level, state.wave + 1) ? MATHS.gate.surge[right] : 0);
      return OK;
    }
    case 'well-answer': {
      if (state.wellLeft <= 0) return refuse('well-empty');
      state.wellLeft--;
      state.stats.wellAsked++;
      let mana = 0;
      if (action.correct) {
        state.wellStreak++;
        state.stats.wellRight++;
        mana = MATHS.well.mana + (state.wellStreak >= MATHS.well.streakFrom ? MATHS.well.streakBonus : 0);
        earn(state, mana);
        state.stats.wellMana += mana;
      } else {
        state.wellStreak = 0;
      }
      state.events.push({ type: 'well', correct: action.correct, mana, streak: state.wellStreak });
      return OK;
    }
    case 'shield': {
      if (state.shield !== 'offered') return refuse('no-shield');
      const right = Math.max(0, Math.min(MATHS.shield.questions, Math.floor(action.right)));
      const healed = Math.min(KEEP_HEALTH - state.keep, Math.round(right * MATHS.shield.heal * KEEP_HEALTH));
      state.keep += healed;
      state.shield = 'used';
      state.events.push({ type: 'shield', healed });
      return OK;
    }
  }
}

function startWave(state: GameState, surge: number) {
  const wave = state.level.waves[state.wave];
  state.wave++;
  state.phase = 'wave';
  state.surge = surge;
  const pathCount = state.paths.length;
  let turn = 0;
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      state.spawns.push({
        at: state.time + (group.delay ?? 0) + i * group.gap,
        kind: group.kind,
        path: group.path ?? turn++ % pathCount,
      });
    }
  }
  state.spawns.sort((a, b) => a.at - b.at);
  state.events.push({ type: 'wave-start', wave: state.wave, surge });
}

/** Health of this kind of enemy in this wave. */
export const enemyHealth = (kind: EnemyKind, wave: number) =>
  Math.round(ENEMIES[kind].health * (1 + HEALTH_PER_WAVE * (wave - 1)));

/** Puts an enemy on the map (also used by tests and the stress test). */
export function spawnEnemy(state: GameState, kind: EnemyKind, path = 0, distance = 0): Enemy {
  const health = enemyHealth(kind, Math.max(1, state.wave));
  const { x, y } = pointAlong(state.paths[path], distance);
  const enemy: Enemy = {
    id: state.nextId++, kind, path, distance, x, y, health, maxHealth: health,
    slow: 0, slowUntil: 0, poisonPerSecond: 0, poisonUntil: 0,
  };
  state.enemies.push(enemy);
  return enemy;
}

const remaining = (state: GameState, e: Enemy) => state.paths[e.path].length - e.distance;

/** The enemy a tower should shoot, or undefined if none is in range. */
export function pickTarget(state: GameState, tower: Tower, range: number): Enemy | undefined {
  const cx = tower.x + 0.5;
  const cy = tower.y + 0.5;
  let best: Enemy | undefined;
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy > range * range) continue;
    if (!best) best = e;
    else if (tower.targeting === 'strongest') {
      if (e.health > best.health || (e.health === best.health && remaining(state, e) < remaining(state, best))) best = e;
    } else if (remaining(state, e) < remaining(state, best)) best = e;
  }
  return best;
}

/** One shot landing on an enemy: damage, then each colour's effect. */
export function hit(state: GameState, target: Enemy, stats: ShotStats, colours: Colour[]) {
  let damage = stats.damage;
  const crit = stats.critChance > 0 && random(state) < stats.critChance;
  if (crit) damage *= stats.critMultiplier;
  target.health -= damage;
  let splash = 0;
  if (stats.splashRadius > 0) {
    const r2 = stats.splashRadius * stats.splashRadius;
    for (const e of state.enemies) {
      if (e === target || e.health <= 0) continue;
      const dx = e.x - target.x;
      const dy = e.y - target.y;
      if (dx * dx + dy * dy <= r2) {
        e.health -= damage * stats.splashShare;
        splash++;
      }
    }
  }
  if (stats.slow > 0) {
    target.slow = Math.max(state.time < target.slowUntil ? target.slow : 0, stats.slow);
    target.slowUntil = state.time + stats.slowSeconds;
  }
  if (stats.poisonShare > 0) {
    const perSecond = damage * stats.poisonShare;
    if (state.time >= target.poisonUntil || perSecond >= target.poisonPerSecond) target.poisonPerSecond = perSecond;
    target.poisonUntil = state.time + stats.poisonSeconds;
  }
  state.events.push({ type: 'hit', x: target.x, y: target.y, colours, crit, splash });
}

/** Moves the game on by one step (1/60 of a second). Does nothing between waves. */
export function step(state: GameState) {
  if (state.phase !== 'wave') return;
  state.step++;
  state.time = state.step * STEP;

  while (state.spawns.length && state.spawns[0].at <= state.time) {
    const s = state.spawns.shift()!;
    spawnEnemy(state, s.kind, s.path);
  }

  // Enemies: poison, then walk. Reaching the Keep hurts it.
  for (const e of state.enemies) {
    if (state.time < e.poisonUntil) e.health -= e.poisonPerSecond * STEP;
    if (e.health <= 0) continue;
    const slow = state.time < e.slowUntil ? e.slow : 0;
    e.distance += ENEMIES[e.kind].speed * (1 - slow) * STEP;
    const path = state.paths[e.path];
    if (e.distance >= path.length) {
      const damage = ENEMIES[e.kind].damage;
      state.keep = Math.max(0, state.keep - damage);
      state.stats.leaked++;
      state.events.push({ type: 'leak', kind: e.kind, damage });
      e.health = 0;
      e.distance = -1; // gone, not killed: no mana
      continue;
    }
    const at = pointAlong(path, e.distance);
    e.x = at.x;
    e.y = at.y;
  }

  // Towers fire.
  for (const tower of state.towers) {
    tower.cooldown = Math.max(0, tower.cooldown - STEP);
    if (!tower.gem || tower.cooldown > 0) continue;
    const base = shotStats(tower.gem, tower.level);
    const target = pickTarget(state, tower, base.range);
    if (!target) continue;
    const stats = state.surge ? { ...base, damage: base.damage * (1 + state.surge) } : base;
    tower.cooldown = 1 / stats.rate;
    const x = tower.x + 0.5;
    const y = tower.y + 0.5;
    state.projectiles.push({ x, y, target: target.id, stats, colours: tower.gem.colours });
    state.events.push({ type: 'shot', x, y, colours: tower.gem.colours });
  }

  // Shots fly at their target and follow it. A shot whose target has gone just fizzles.
  const move = GEM.projectileSpeed * STEP;
  let kept = 0;
  for (const p of state.projectiles) {
    const target = state.enemies.find((e) => e.id === p.target && e.health > 0);
    if (!target) continue;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const gap = Math.hypot(dx, dy);
    if (gap <= move) {
      hit(state, target, p.stats, p.colours);
      continue;
    }
    p.x += (dx / gap) * move;
    p.y += (dy / gap) * move;
    state.projectiles[kept++] = p;
  }
  state.projectiles.length = kept;

  // Clear away the dead. Killed ones pay mana; ones that reached the Keep don't.
  kept = 0;
  for (const e of state.enemies) {
    if (e.health > 0) {
      state.enemies[kept++] = e;
      continue;
    }
    if (e.distance >= 0) {
      const mana = ENEMIES[e.kind].mana;
      earn(state, mana);
      state.stats.kills++;
      state.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, mana });
    }
  }
  state.enemies.length = kept;

  if (state.keep <= 0) {
    state.phase = 'lost';
    state.events.push({ type: 'lost' });
    return;
  }
  // The Keep Shield is offered once, the first time the Keep drops low.
  if (state.shield === 'ready' && state.keep < MATHS.shield.below * KEEP_HEALTH) {
    state.shield = 'offered';
    state.events.push({ type: 'keep-low' });
  }
  if (state.spawns.length === 0 && state.enemies.length === 0) {
    state.projectiles.length = 0;
    earn(state, MANA.waveClear);
    state.events.push({ type: 'wave-clear', wave: state.wave, mana: MANA.waveClear });
    state.surge = 0;
    state.wellLeft = MATHS.well.questions;
    if (state.wave >= state.level.waves.length) {
      const left = state.keep / KEEP_HEALTH;
      state.stars = left >= STARS.three ? 3 : left >= STARS.two ? 2 : 1;
      state.phase = 'won';
      state.events.push({ type: 'won', stars: state.stars });
    } else {
      state.phase = 'build';
    }
  }
}
