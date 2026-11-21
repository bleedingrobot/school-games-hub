/**
 * Goblin Storm's rules (docs/GOBLINSTORM-PLAN.md). One step is 1/60 s and the only input each step is a steering
 * direction (0–15, or 16 for standing still). Level-ups pause the run: the browser asks the question, then calls
 * `makeOffer` with the number of cards the answer earned and `applyPick` with the card chosen. The server replays the
 * same steering and picks (replay.ts) and gets exactly the same run.
 *
 * Only + − × ÷ and Math.sqrt: no sin, cos, atan2, hypot or Math.random, so every browser and the server agree.
 */
import {
  BASE_MAGNET, BOSS_AT, DAMAGE_PER_TIER, BOSS_CHARGE, BOSS_WIPE_SHARE, CELL, DT, FAR_AWAY, GEM_PICKUP, GEM_PULL_SPEED, GOLD, GRID, healthGrowth,
  HERO_RADIUS, HURT_GAP, MAX_ENEMIES, MAX_GEMS, MAX_PASSIVES, MAX_SHOTS, MAX_WEAPONS, MINIBOSS_AT, PASSIVE_IDS, PASSIVE_LEVELS,
  PASSIVE_STEP, RUN_STEPS, SEPARATE_CHECKS, SHOP, SHOP_ARMOUR_MAX, SPAWN_RING, STEPS_PER_SECOND, STORM, SWARM_SIZE, SWARMS, WAVES,
  WARM_UP_DAMAGE, WARM_UP_SECONDS, WEAPON_IDS, WEAPON_LEVELS, WEAPONS, WIPE_RADIUS, gemsToNext, LEGENDARY,
  type HeroDef, type LegendaryId, type MapDef, type PassiveId, type ShopLevels, type WeaponId, type WeaponLevel,
} from './config';
import { makeRandom, mixSeed, type Random } from './random';
import { COS, DIR_X, DIR_Y, DIRECTIONS, SIN, STILL, TURN } from './trig';

export interface Enemy {
  alive: boolean;
  /** Unique within a run (for "already hit by this shot"). */
  id: number;
  /** 0 common, 1 fast, 2 tough, 3 mini-boss, 4 boss. */
  kind: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  gems: number;
  /** Slowed until this step. */
  slowUntil: number;
  /** Per weapon slot: can't be hit by that weapon again until this step. */
  hitUntil: number[];
  /** Spiky Shield can't hurt it again until this step. */
  spikeUntil: number;
  /** Steps since the run started when this one appeared (bosses' charge clock). */
  born: number;
}

export interface Shot {
  alive: boolean;
  slot: number;
  weapon: WeaponId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Steps left. */
  life: number;
  damage: number;
  radius: number;
  pierce: number;
  /** Ids of the monsters this shot has already hit. */
  hits: number[];
  /** Fireballs burst over this radius when they hit. */
  burst: number;
  /** Axes fall (units a second squared). */
  gravity: number;
}

export interface Gem { alive: boolean; x: number; y: number; value: number; pulled: boolean }

export interface Held { id: WeaponId; level: number; evolved: boolean; cooldown: number; wipe: number; angle: number; charges: number }
export interface Passive { id: PassiveId; level: number }

export type Upgrade =
  | { kind: 'weapon'; id: WeaponId; level: number }
  | { kind: 'passive'; id: PassiveId; level: number }
  | { kind: 'evolve'; id: WeaponId }
  | { kind: 'gold' }
  | { kind: 'heal' };

/** Things the renderer draws or plays a sound for. Cleared every step; the replay ignores them. */
export type GameEvent =
  | { k: 'hit'; x: number; y: number; damage: number; crit: boolean }
  | { k: 'kill'; x: number; y: number; kind: number }
  | { k: 'hurt'; damage: number }
  | { k: 'block' }
  | { k: 'strike'; x: number; y: number; r: number; weapon: WeaponId }
  | { k: 'wipe'; weapon: WeaponId }
  | { k: 'nova'; r: number; weapon: WeaponId }
  | { k: 'levelup' }
  | { k: 'boss'; kind: number }
  | { k: 'gem' }
  // Storm Lands: a lightning ring struck, the sea turned, the hero got back up, the last boss raged.
  | { k: 'storm'; x: number; y: number; r: number }
  | { k: 'current'; dir: number }
  | { k: 'revive' }
  | { k: 'rage' };

export type Outcome = 'running' | 'won' | 'survived' | 'lost' | 'quit';

export interface Hero {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Last direction moved (0–15), for arrows. */
  facing: number;
  hurtUntil: number;
}

/** A Sky Citadel lightning ring: where, and the step it strikes. */
export interface StormStrike { x: number; y: number; at: number }

/**
 * The Storm Lands' part of a run. It has its own seeded numbers, so nothing here changes a run on the first five maps.
 */
export interface StormState {
  rng: Random;
  /** The way the sea pushes (0-15). */
  current: number;
  strikes: StormStrike[];
  /** Second Wind has been used. */
  revived: boolean;
  /** The Storm King is down to half health. */
  raging: boolean;
}

export interface RunSetup {
  seed: number;
  hero: HeroDef;
  map: MapDef;
  shop: ShopLevels;
}

export interface RunState {
  setup: RunSetup;
  t: number;
  hero: Hero;
  weapons: Held[];
  passives: Passive[];
  enemies: Enemy[];
  shots: Shot[];
  gems: Gem[];
  level: number;
  gemBar: number;
  /** Level-ups done (also the question slot of the next one). */
  levelUps: number;
  /** Level-ups earned but not yet chosen. */
  owed: number;
  /** The cards being shown, or null while playing. */
  offer: Upgrade[] | null;
  kills: number;
  miniBeaten: boolean;
  bossBeaten: boolean;
  evolved: WeaponId[];
  /** Steps since the hero was last hurt, and the longest such stretch. */
  sinceHit: number;
  longestNoHit: number;
  bonusGold: number;
  outcome: Outcome;
  events: GameEvent[];
  rng: Random;
  nextId: number;
  /** Collision grid: first monster in each cell, then a chain. */
  cellHead: Int32Array;
  cellNext: Int32Array;
  gridX: number;
  gridY: number;
  storm: StormState;
}

/** The Storm Lands' own stream of seeded numbers (kept apart from the run's, so the first five maps don't change). */
const STORM_STREAM = 0x5707;

// ---------------------------------------------------------------- stats

function passiveLevel(s: RunState, id: PassiveId): number {
  for (const p of s.passives) if (p.id === id) return p.level;
  return 0;
}
function shopLevel(s: RunState, id: keyof typeof SHOP): number {
  const n = s.setup.shop[id] ?? 0;
  return n < 0 ? 0 : n > 5 ? 5 : n;
}
/** A Legendary upgrade's level: 0 off the Storm Lands (they only work there). */
export function legendLevel(s: Pick<RunState, 'setup'>, id: LegendaryId): number {
  if (!s.setup.map.storm) return 0;
  const n = Math.floor(s.setup.shop[id] ?? 0);
  const top = LEGENDARY[id].costs.length;
  return n < 0 || !Number.isFinite(n) ? 0 : n > top ? top : n;
}
/** Weapons a hero can hold: 4, or 5 with Fifth Weapon on the Storm Lands. */
export function maxWeapons(s: Pick<RunState, 'setup'>): number {
  return MAX_WEAPONS + legendLevel(s, 'fifth');
}
/** Steps between an evolved weapon's blasts (Storm Surge makes them sooner). */
function wipeEvery(s: RunState, id: WeaponId): number {
  const every = WEAPONS[id].evolved.wipeEvery;
  const surge = legendLevel(s, 'surge');
  return surge > 0 ? Math.round(every * (1 - surge * LEGENDARY.surge.step)) : every;
}

export function might(s: RunState): number {
  const h = s.setup.hero;
  let m = h.might * (1 + passiveLevel(s, 'gauntlets') * PASSIVE_STEP.gauntlets) * (1 + shopLevel(s, 'might') * SHOP.might.step);
  if (h.rage > 0) m *= 1 + h.rage * (1 - s.hero.hp / s.hero.maxHp);
  const storm = legendLevel(s, 'stormmight');
  if (storm > 0) m *= 1 + storm * LEGENDARY.stormmight.step;
  return m;
}
export function area(s: RunState): number {
  return s.setup.hero.area * (1 + passiveLevel(s, 'snow') * PASSIVE_STEP.snow);
}
function cooldownScale(s: RunState): number {
  return 1 - passiveLevel(s, 'tome') * PASSIVE_STEP.tome;
}
export function armour(s: RunState): number {
  return s.setup.hero.armour + passiveLevel(s, 'armour') * PASSIVE_STEP.armour + Math.min(SHOP_ARMOUR_MAX, shopLevel(s, 'armour'));
}
export function heroSpeed(s: RunState): number {
  return s.setup.hero.speed * (1 + passiveLevel(s, 'boots') * PASSIVE_STEP.boots) * (1 + shopLevel(s, 'speed') * SHOP.speed.step);
}
function magnet(s: RunState): number {
  return BASE_MAGNET * s.setup.hero.magnet * (1 + passiveLevel(s, 'magnet') * PASSIVE_STEP.magnet) * (1 + shopLevel(s, 'magnet') * SHOP.magnet.step);
}
export function stats(w: Held): WeaponLevel {
  const def = WEAPONS[w.id];
  return w.evolved ? def.evolved.stats : def.levels[w.level - 1];
}
function maxHealth(s: RunState): number {
  return s.setup.hero.health + passiveLevel(s, 'heart') * PASSIVE_STEP.heart + shopLevel(s, 'health') * SHOP.health.step;
}

// ---------------------------------------------------------------- set up

export function newRun(setup: RunSetup): RunState {
  const s: RunState = {
    setup,
    t: 0,
    hero: { x: 0, y: 0, hp: 0, maxHp: 0, facing: 0, hurtUntil: 0 },
    weapons: [],
    passives: [],
    enemies: [],
    shots: [],
    gems: [],
    level: 1,
    gemBar: 0,
    levelUps: 0,
    owed: 0,
    offer: null,
    kills: 0,
    miniBeaten: false,
    bossBeaten: false,
    evolved: [],
    sinceHit: 0,
    longestNoHit: 0,
    bonusGold: 0,
    outcome: 'running',
    events: [],
    rng: makeRandom(setup.seed),
    nextId: 1,
    cellHead: new Int32Array(GRID * GRID),
    cellNext: new Int32Array(MAX_ENEMIES),
    gridX: 0,
    gridY: 0,
    storm: { rng: makeRandom(mixSeed(setup.seed, STORM_STREAM)), current: 0, strikes: [], revived: false, raging: false },
  };
  for (let i = 0; i < MAX_ENEMIES; i++) {
    s.enemies.push({ alive: false, id: 0, kind: 0, x: 0, y: 0, hp: 0, maxHp: 0, speed: 0, damage: 0, radius: 0, gems: 0, slowUntil: 0, hitUntil: [0, 0, 0, 0, 0], spikeUntil: 0, born: 0 });
  }
  for (let i = 0; i < MAX_SHOTS; i++) s.shots.push({ alive: false, slot: 0, weapon: 'fireball', x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, radius: 0, pierce: 0, hits: [], burst: 0, gravity: 0 });
  for (let i = 0; i < MAX_GEMS; i++) s.gems.push({ alive: false, x: 0, y: 0, value: 0, pulled: false });
  addWeapon(s, setup.hero.weapon);
  s.hero.maxHp = maxHealth(s);
  s.hero.hp = s.hero.maxHp;
  return s;
}

function addWeapon(s: RunState, id: WeaponId): void {
  s.weapons.push({ id, level: 1, evolved: false, cooldown: 30, wipe: 0, angle: 0, charges: id === 'bubble' ? WEAPONS.bubble.levels[0].count : 0 });
}

// ---------------------------------------------------------------- monsters

function spawn(s: RunState, kind: number, x: number, y: number): Enemy | null {
  let e: Enemy | null = null;
  for (const c of s.enemies) if (!c.alive) { e = c; break; }
  if (!e) return null;
  const def = s.setup.map.monsters[kind];
  const grow = kind >= 3 ? 1 : healthGrowth(s.t);
  e.alive = true;
  e.id = s.nextId++;
  e.kind = kind;
  e.x = x;
  e.y = y;
  e.maxHp = def.health * s.setup.map.tier * grow;
  e.hp = e.maxHp;
  e.speed = def.speed;
  e.damage = def.damage * (1 + (s.setup.map.tier - 1) * DAMAGE_PER_TIER);
  e.radius = def.radius;
  e.gems = def.gems;
  e.slowUntil = 0;
  e.hitUntil[0] = e.hitUntil[1] = e.hitUntil[2] = e.hitUntil[3] = e.hitUntil[4] = 0;
  e.spikeUntil = 0;
  e.born = s.t;
  return e;
}

function spawnOnRing(s: RunState, kind: number, angle: number): Enemy | null {
  const a = ((angle % TURN) + TURN) % TURN;
  return spawn(s, kind, s.hero.x + COS[a] * SPAWN_RING, s.hero.y + SIN[a] * SPAWN_RING);
}

function spawnWaves(s: RunState): void {
  const sec = s.t / STEPS_PER_SECOND;
  for (const w of WAVES) {
    if (sec < w.from || sec >= w.to || s.t % w.every !== 0) continue;
    for (let i = 0; i < w.count; i++) spawnOnRing(s, w.kind, s.rng.int(TURN));
  }
  for (const at of SWARMS) {
    if (s.t === at * STEPS_PER_SECOND) {
      const start = s.rng.int(TURN);
      for (let i = 0; i < SWARM_SIZE; i++) spawnOnRing(s, 0, start + ((i * TURN) / SWARM_SIZE | 0));
    }
  }
  if (s.t === MINIBOSS_AT) { spawnOnRing(s, 3, s.rng.int(TURN)); s.events.push({ k: 'boss', kind: 3 }); }
  if (s.t === BOSS_AT) { spawnOnRing(s, 4, s.rng.int(TURN)); s.events.push({ k: 'boss', kind: 4 }); }
}

function buildGrid(s: RunState): void {
  s.cellHead.fill(-1);
  s.gridX = s.hero.x - (GRID * CELL) / 2;
  s.gridY = s.hero.y - (GRID * CELL) / 2;
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive) continue;
    const c = cellOf(s, e.x, e.y);
    if (c < 0) continue;
    s.cellNext[i] = s.cellHead[c];
    s.cellHead[c] = i;
  }
}
function cellOf(s: RunState, x: number, y: number): number {
  const cx = Math.floor((x - s.gridX) / CELL);
  const cy = Math.floor((y - s.gridY) / CELL);
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return -1;
  return cy * GRID + cx;
}

/** Calls `fn` for every live monster whose middle is within the cells touching a circle. */
function near(s: RunState, x: number, y: number, r: number, fn: (e: Enemy) => void): void {
  const x0 = Math.max(0, Math.floor((x - r - 1.8 - s.gridX) / CELL));
  const x1 = Math.min(GRID - 1, Math.floor((x + r + 1.8 - s.gridX) / CELL));
  const y0 = Math.max(0, Math.floor((y - r - 1.8 - s.gridY) / CELL));
  const y1 = Math.min(GRID - 1, Math.floor((y + r + 1.8 - s.gridY) / CELL));
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      for (let i = s.cellHead[cy * GRID + cx]; i >= 0; i = s.cellNext[i]) {
        const e = s.enemies[i];
        if (e.alive) fn(e);
      }
    }
  }
}

function touches(e: Enemy, x: number, y: number, r: number): boolean {
  const dx = e.x - x;
  const dy = e.y - y;
  const rr = e.radius + r;
  return dx * dx + dy * dy <= rr * rr;
}

function moveEnemies(s: RunState): void {
  const h = s.hero;
  const chill = 1 - s.setup.hero.chill;
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (!e.alive) continue;
    let dx = h.x - e.x;
    let dy = h.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > FAR_AWAY * FAR_AWAY && e.kind < 3) {
      // Left far behind: come back on the ring on the side the hero is heading.
      const a = s.hero.facing * 4 + s.rng.int(17) - 8;
      const aa = ((a % TURN) + TURN) % TURN;
      e.x = h.x + COS[aa] * SPAWN_RING;
      e.y = h.y + SIN[aa] * SPAWN_RING;
      continue;
    }
    const d = Math.sqrt(d2);
    if (d < 1e-6) continue;
    let speed = e.speed * chill * (e.slowUntil > s.t ? 0.5 : 1);
    if (e.kind >= 3) {
      const every = e.kind === 4 && s.storm.raging ? BOSS_CHARGE.every / STORM.rage.chargeEvery : BOSS_CHARGE.every;
      if ((s.t - e.born) % every < BOSS_CHARGE.lasts) speed *= BOSS_CHARGE.speed;
    }
    dx /= d;
    dy /= d;
    e.x += dx * speed * DT;
    e.y += dy * speed * DT;
    // Push apart from a few neighbours so they don't pile into one spot.
    const c = cellOf(s, e.x, e.y);
    if (c < 0) continue;
    let checks = 0;
    for (let j = s.cellHead[c]; j >= 0 && checks < SEPARATE_CHECKS; j = s.cellNext[j]) {
      if (j === i) continue;
      const o = s.enemies[j];
      if (!o.alive) continue;
      checks++;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const rr = e.radius + o.radius;
      const od2 = ox * ox + oy * oy;
      if (od2 >= rr * rr || od2 < 1e-9) continue;
      const od = Math.sqrt(od2);
      const push = ((rr - od) / od) * 0.25;
      if (e.kind < 3) { e.x += ox * push; e.y += oy * push; }
    }
  }
}

// ---------------------------------------------------------------- hurting monsters

function damageEnemy(s: RunState, e: Enemy, base: number, slot: number): void {
  if (!e.alive) return;
  const crit = s.setup.hero.crit > 0 && s.rng.fraction() < s.setup.hero.crit;
  const dmg = base * might(s) * (crit ? 2 : 1);
  e.hp -= dmg;
  if (slot >= 0) s.events.push({ k: 'hit', x: e.x, y: e.y, damage: dmg, crit });
  if (e.hp <= 0) kill(s, e);
  else if (e.kind === 4 && !s.storm.raging && s.setup.map.storm === 'rage' && e.hp <= e.maxHp / 2) rage(s);
}

/** The Storm King at half health: charges twice as often and calls a ring of storm goblins, once. */
function rage(s: RunState): void {
  s.storm.raging = true;
  s.events.push({ k: 'rage' });
  const start = s.storm.rng.int(TURN);
  for (let i = 0; i < STORM.rage.swarm; i++) spawnOnRing(s, 0, start + ((i * TURN) / STORM.rage.swarm | 0));
}

function kill(s: RunState, e: Enemy): void {
  e.alive = false;
  s.kills++;
  s.events.push({ k: 'kill', x: e.x, y: e.y, kind: e.kind });
  if (e.kind === 3) s.miniBeaten = true;
  if (e.kind === 4) {
    s.bossBeaten = true;
    s.outcome = 'won';
  }
  if (e.gems > 0) dropGem(s, e.x, e.y, e.gems);
  // Crystal Caverns: a tough one breaks into small ones where it stood.
  if (e.kind === 2 && s.setup.map.storm === 'split') {
    for (let i = 0; i < STORM.split.pieces; i++) spawn(s, 0, e.x + (i % 2 ? 0.55 : -0.55), e.y + (i < 2 ? 0 : 0.55));
  }
}

function dropGem(s: RunState, x: number, y: number, value: number): void {
  for (const g of s.gems) {
    if (!g.alive) { g.alive = true; g.x = x; g.y = y; g.value = value; g.pulled = false; return; }
  }
  // Every slot full: the gem's worth joins the oldest gem (drawn bigger).
  s.gems[0].value += value;
}

function wipe(s: RunState, w: Held): void {
  const dmg = WEAPONS[w.id].evolved.wipeDamage;
  s.events.push({ k: 'wipe', weapon: w.id });
  const r2 = WIPE_RADIUS * WIPE_RADIUS;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const dx = e.x - s.hero.x;
    const dy = e.y - s.hero.y;
    if (dx * dx + dy * dy > r2) continue;
    damageEnemy(s, e, e.kind >= 3 ? dmg * BOSS_WIPE_SHARE : dmg, -1);
  }
}

function nearestEnemy(s: RunState, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestD = range * range;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const dx = e.x - s.hero.x;
    const dy = e.y - s.hero.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function fire(s: RunState, slot: number, w: Held, x: number, y: number, vx: number, vy: number, life: number, st: WeaponLevel, extra: Partial<Shot> = {}): void {
  for (const p of s.shots) {
    if (p.alive) continue;
    p.alive = true;
    p.slot = slot;
    p.weapon = w.id;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.damage = st.damage;
    p.radius = st.area;
    p.pierce = st.pierce;
    p.hits.length = 0;
    p.burst = 0;
    p.gravity = 0;
    Object.assign(p, extra);
    return;
  }
}

function useWeapons(s: RunState): void {
  const h = s.hero;
  const ar = area(s);
  for (let slot = 0; slot < s.weapons.length; slot++) {
    const w = s.weapons[slot];
    const st = stats(w);
    if (w.evolved && ++w.wipe >= wipeEvery(s, w.id)) { w.wipe = 0; wipe(s, w); }

    if (w.id === 'blades') {
      // Blades turn every step and cut whatever they touch (each monster once per `cooldown`).
      w.angle = (w.angle + st.speed) % TURN;
      const r = st.area * ar;
      for (let b = 0; b < st.count; b++) {
        const a = w.angle + (b * TURN) / st.count;
        const i = Math.floor(a) % TURN;
        const f = a - Math.floor(a);
        const j = (i + 1) % TURN;
        const bx = h.x + (COS[i] + (COS[j] - COS[i]) * f) * r;
        const by = h.y + (SIN[i] + (SIN[j] - SIN[i]) * f) * r;
        near(s, bx, by, 0.45, (e) => {
          if (e.hitUntil[slot] > s.t || !touches(e, bx, by, 0.45)) return;
          e.hitUntil[slot] = s.t + st.cooldown;
          damageEnemy(s, e, st.damage, slot);
        });
      }
      continue;
    }

    if (w.id === 'bubble') {
      if (w.charges < st.count && --w.cooldown <= 0) { w.charges++; w.cooldown = Math.round(st.cooldown * cooldownScale(s)); }
      continue;
    }

    if (--w.cooldown > 0) continue;
    w.cooldown = Math.max(6, Math.round(st.cooldown * cooldownScale(s)));

    if (w.id === 'aura') {
      const r = st.area * ar;
      near(s, h.x, h.y, r, (e) => { if (touches(e, h.x, h.y, r)) damageEnemy(s, e, st.damage, slot); });
    } else if (w.id === 'nova') {
      const r = st.area * ar;
      s.events.push({ k: 'nova', r, weapon: w.id });
      near(s, h.x, h.y, r, (e) => {
        if (!touches(e, h.x, h.y, r)) return;
        e.slowUntil = s.t + 90;
        damageEnemy(s, e, st.damage, slot);
      });
    } else if (w.id === 'fireball') {
      for (let n = 0; n < st.count; n++) {
        const target = nearestEnemy(s, 14);
        if (!target) break;
        let dx = target.x - h.x + (n - (st.count - 1) / 2) * 0.8;
        let dy = target.y - h.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= d;
        dy /= d;
        fire(s, slot, w, h.x, h.y, dx * st.speed, dy * st.speed, 120, st, { radius: 0.35, pierce: 0, burst: st.area * ar });
      }
    } else if (w.id === 'lightning') {
      // Strikes random monsters near enough to see.
      const r = st.area * ar;
      for (let n = 0; n < st.count; n++) {
        let target: Enemy | null = null;
        for (let tries = 0; tries < 8 && !target; tries++) {
          const e = s.enemies[s.rng.int(MAX_ENEMIES)];
          if (!e.alive) continue;
          const dx = e.x - h.x;
          const dy = e.y - h.y;
          if (dx * dx + dy * dy < 12 * 12) target = e;
        }
        if (!target) target = nearestEnemy(s, 12);
        if (!target) break;
        const tx = target.x;
        const ty = target.y;
        s.events.push({ k: 'strike', x: tx, y: ty, r, weapon: w.id });
        near(s, tx, ty, r, (e) => { if (touches(e, tx, ty, r)) damageEnemy(s, e, st.damage, slot); });
      }
    } else if (w.id === 'axes') {
      for (let n = 0; n < st.count; n++) {
        const side = (s.rng.fraction() - 0.5) * 6;
        fire(s, slot, w, h.x, h.y, side, -st.speed, 100, st, { gravity: 20, radius: st.area * ar });
      }
    } else if (w.id === 'arrows') {
      const f = h.facing * 4;
      for (let n = 0; n < st.count; n++) {
        const a = (((f + (n - (st.count - 1) / 2) * 2) % TURN) + TURN) % TURN;
        fire(s, slot, w, h.x, h.y, COS[a] * st.speed, SIN[a] * st.speed, 70, st, { radius: st.area * ar });
      }
    }
  }
}

function moveShots(s: RunState): void {
  for (const p of s.shots) {
    if (!p.alive) continue;
    p.vy += p.gravity * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    if (--p.life <= 0) { p.alive = false; continue; }
    near(s, p.x, p.y, p.radius, (e) => {
      if (!p.alive || !touches(e, p.x, p.y, p.radius) || p.hits.includes(e.id)) return;
      if (p.burst > 0) {
        const bx = p.x;
        const by = p.y;
        const br = p.burst;
        s.events.push({ k: 'strike', x: bx, y: by, r: br, weapon: p.weapon });
        near(s, bx, by, br, (o) => { if (touches(o, bx, by, br)) damageEnemy(s, o, p.damage, p.slot); });
        p.alive = false;
        return;
      }
      p.hits.push(e.id);
      damageEnemy(s, e, p.damage, p.slot);
      if (p.hits.length > p.pierce) p.alive = false;
    });
  }
}

// ---------------------------------------------------------------- the hero

function hurtHero(s: RunState): void {
  const h = s.hero;
  const spikes = passiveLevel(s, 'spiky') * PASSIVE_STEP.spiky;
  near(s, h.x, h.y, HERO_RADIUS, (e) => {
    if (!touches(e, h.x, h.y, HERO_RADIUS)) return;
    if (spikes > 0 && e.spikeUntil <= s.t) { e.spikeUntil = s.t + 30; damageEnemy(s, e, spikes, -1); }
    if (!e.alive || h.hurtUntil > s.t) return;
    h.hurtUntil = s.t + HURT_GAP;
    const bubble = s.weapons.find((w) => w.id === 'bubble' && w.charges > 0);
    if (bubble) {
      bubble.charges--;
      if (bubble.charges === 0 || bubble.cooldown <= 0) bubble.cooldown = stats(bubble).cooldown;
      s.events.push({ k: 'block' });
      const st = stats(bubble);
      if (st.damage > 0) {
        const r = st.area * area(s);
        s.events.push({ k: 'nova', r, weapon: 'bubble' });
        near(s, h.x, h.y, r, (o) => { if (touches(o, h.x, h.y, r)) damageEnemy(s, o, st.damage, -1); });
      }
      return;
    }
    const warm = s.t < WARM_UP_SECONDS * STEPS_PER_SECOND ? WARM_UP_DAMAGE : 1;
    takeHit(s, Math.max(1, e.damage * warm - armour(s)));
  });
}

/** The hero loses `dmg` health: they fall at 0, unless Second Wind gets them back up (once a run). */
function takeHit(s: RunState, dmg: number): void {
  const h = s.hero;
  h.hp -= dmg;
  s.sinceHit = 0;
  s.events.push({ k: 'hurt', damage: dmg });
  if (h.hp > 0) return;
  if (legendLevel(s, 'secondwind') > 0 && !s.storm.revived) {
    s.storm.revived = true;
    h.hp = h.maxHp * LEGENDARY.secondwind.step;
    h.hurtUntil = s.t + 2 * STEPS_PER_SECOND;
    s.events.push({ k: 'revive' });
    return;
  }
  h.hp = 0;
  s.outcome = 'lost';
}

// ---------------------------------------------------------------- the Storm Lands' twists

/** Sunken Kingdom: the sea pushes the hero, a new way every 30 s (Anchor Boots push back). */
function seaCurrent(s: RunState): void {
  if (s.t % STORM.current.every === 0) {
    s.storm.current = s.storm.rng.int(DIRECTIONS);
    s.events.push({ k: 'current', dir: s.storm.current });
  }
  const push = STORM.current.speed * (1 - legendLevel(s, 'anchor') * LEGENDARY.anchor.step) * DT;
  s.hero.x += DIR_X[s.storm.current] * push;
  s.hero.y += DIR_Y[s.storm.current] * push;
}

/** Sky Citadel: glowing rings on the ground (one under the hero), then lightning hits everything in them. */
function stormLightning(s: RunState): void {
  const L = STORM.lightning;
  const h = s.hero;
  const st = s.storm;
  if (s.t >= WARM_UP_SECONDS * STEPS_PER_SECOND && s.t % L.every === 0) {
    for (let i = 0; i < L.count; i++) {
      const x = i === 0 ? h.x : h.x + st.rng.between(-L.spread, L.spread);
      const y = i === 0 ? h.y : h.y + st.rng.between(-L.spread, L.spread);
      st.strikes.push({ x, y, at: s.t + L.warn });
    }
  }
  if (st.strikes.length === 0 || st.strikes[0].at > s.t) return;
  const now = st.strikes.filter((k) => k.at === s.t);
  st.strikes = st.strikes.filter((k) => k.at > s.t);
  for (const k of now) {
    s.events.push({ k: 'storm', x: k.x, y: k.y, r: L.radius });
    near(s, k.x, k.y, L.radius, (e) => {
      if (!touches(e, k.x, k.y, L.radius)) return;
      e.hp -= L.monsterDamage * s.setup.map.tier * (e.kind >= 3 ? BOSS_WIPE_SHARE : 1);
      if (e.hp <= 0) kill(s, e);
    });
    const dx = h.x - k.x;
    const dy = h.y - k.y;
    const rr = L.radius + HERO_RADIUS;
    if (s.outcome !== 'running' || dx * dx + dy * dy > rr * rr) continue;
    const bubble = s.weapons.find((w) => w.id === 'bubble' && w.charges > 0);
    if (bubble) {
      bubble.charges--;
      if (bubble.charges === 0 || bubble.cooldown <= 0) bubble.cooldown = stats(bubble).cooldown;
      s.events.push({ k: 'block' });
      continue;
    }
    h.hurtUntil = s.t + HURT_GAP;
    takeHit(s, Math.max(1, L.damage * (1 + (s.setup.map.tier - 1) * DAMAGE_PER_TIER) - armour(s)));
  }
}

function collectGems(s: RunState): void {
  const h = s.hero;
  const pull = magnet(s);
  const crown = 1 + passiveLevel(s, 'crown') * PASSIVE_STEP.crown;
  for (const g of s.gems) {
    if (!g.alive) continue;
    let dx = h.x - g.x;
    let dy = h.y - g.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= GEM_PICKUP * GEM_PICKUP) {
      g.alive = false;
      s.gemBar += g.value * crown;
      s.events.push({ k: 'gem' });
      continue;
    }
    if (g.pulled || d2 <= pull * pull) {
      g.pulled = true;
      const d = Math.sqrt(d2);
      dx /= d;
      dy /= d;
      g.x += dx * GEM_PULL_SPEED * DT;
      g.y += dy * GEM_PULL_SPEED * DT;
    }
  }
  while (s.gemBar >= gemsToNext(s.level)) {
    s.gemBar -= gemsToNext(s.level);
    s.level++;
    s.owed++;
    s.events.push({ k: 'levelup' });
  }
}

/**
 * One step with this steering direction (0–15, or 16 for still). Does nothing while a level-up is waiting for a pick
 * (check `waiting(s)` first) or after the run has ended.
 */
export function stepRun(s: RunState, dir: number): void {
  s.events.length = 0;
  if (s.outcome !== 'running' || waiting(s)) return;
  const h = s.hero;
  const d = dir >= 0 && dir <= STILL ? dir : STILL;
  const v = heroSpeed(s) * DT;
  h.x += DIR_X[d] * v;
  h.y += DIR_Y[d] * v;
  if (d !== STILL) h.facing = d;
  if (s.setup.map.storm === 'current') seaCurrent(s);

  spawnWaves(s);
  buildGrid(s);
  moveEnemies(s);
  buildGrid(s);
  useWeapons(s);
  moveShots(s);
  hurtHero(s);
  if (s.setup.map.storm === 'lightning' && s.outcome === 'running') stormLightning(s);
  collectGems(s);

  const regen = s.setup.hero.regen + passiveLevel(s, 'holywater') * PASSIVE_STEP.holywater;
  if (regen > 0 && h.hp > 0) h.hp = Math.min(h.maxHp, h.hp + regen * DT);
  s.t++;
  s.sinceHit++;
  if (s.sinceHit > s.longestNoHit) s.longestNoHit = s.sinceHit;
  if (s.outcome === 'running' && s.t >= RUN_STEPS) s.outcome = 'survived';
}

/** A level-up is waiting: ask the question, then `makeOffer` and `applyPick`. */
export function waiting(s: RunState): boolean {
  return s.owed > 0 || s.offer !== null;
}

// ---------------------------------------------------------------- level-ups

/** Everything that could be offered right now, evolutions first. */
function candidates(s: RunState): { evolve: Upgrade[]; rest: Upgrade[] } {
  const evolve: Upgrade[] = [];
  const rest: Upgrade[] = [];
  for (const w of s.weapons) {
    if (w.evolved) continue;
    if (w.level >= WEAPON_LEVELS) {
      if (passiveLevel(s, WEAPONS[w.id].evolvesWith) > 0) evolve.push({ kind: 'evolve', id: w.id });
    } else rest.push({ kind: 'weapon', id: w.id, level: w.level + 1 });
  }
  if (s.weapons.length < maxWeapons(s)) {
    for (const id of WEAPON_IDS) if (!s.weapons.some((w) => w.id === id)) rest.push({ kind: 'weapon', id, level: 1 });
  }
  for (const p of s.passives) if (p.level < PASSIVE_LEVELS) rest.push({ kind: 'passive', id: p.id, level: p.level + 1 });
  if (s.passives.length < MAX_PASSIVES) {
    for (const id of PASSIVE_IDS) if (!s.passives.some((p) => p.id === id)) rest.push({ kind: 'passive', id, level: 1 });
  }
  return { evolve, rest };
}

/**
 * The cards for the waiting level-up: `choices` of them (2 wrong, 3 right, 4 quick) and then a Gold card. An evolution,
 * when one is ready, is always the first card. Seeded by the run and the level-up number, so the browser and the replay agree.
 */
export function makeOffer(s: RunState, choices: number): Upgrade[] {
  if (!waiting(s)) return [];
  if (s.offer) return s.offer;
  const n = choices < 2 ? 2 : choices > 4 ? 4 : choices;
  const rng = makeRandom(mixSeed(s.setup.seed, s.levelUps));
  const { evolve, rest } = candidates(s);
  const offer: Upgrade[] = evolve.slice(0, n);
  while (offer.length < n && rest.length > 0) offer.push(rest.splice(rng.int(rest.length), 1)[0]);
  if (offer.length < n) offer.push({ kind: 'heal' });
  offer.push({ kind: 'gold' }); // always the last card, on top of the ones the answer earned (James, 20 Nov 2026)
  s.offer = offer;
  return offer;
}

/** Takes card `index` of the offer. Returns false (and changes nothing) if there's no offer or no such card. */
export function applyPick(s: RunState, index: number): boolean {
  const offer = s.offer;
  if (!offer || !Number.isInteger(index) || index < 0 || index >= offer.length) return false;
  const u = offer[index];
  if (u.kind === 'weapon') {
    const w = s.weapons.find((x) => x.id === u.id);
    if (w) {
      w.level = u.level;
      if (w.id === 'bubble') w.charges = Math.min(stats(w).count, w.charges + 1);
    } else addWeapon(s, u.id);
  } else if (u.kind === 'passive') {
    const p = s.passives.find((x) => x.id === u.id);
    if (p) p.level = u.level;
    else s.passives.push({ id: u.id, level: 1 });
    if (u.id === 'heart') {
      const before = s.hero.maxHp;
      s.hero.maxHp = maxHealth(s);
      s.hero.hp += s.hero.maxHp - before;
    }
  } else if (u.kind === 'evolve') {
    const w = s.weapons.find((x) => x.id === u.id);
    if (w) {
      w.evolved = true;
      w.wipe = wipeEvery(s, w.id) - 30;
      if (!s.evolved.includes(w.id)) s.evolved.push(w.id);
    }
  } else if (u.kind === 'heal') {
    s.hero.hp = s.hero.maxHp;
  } else {
    s.bonusGold += 5;
  }
  s.offer = null;
  s.owed--;
  s.levelUps++;
  return true;
}

// ---------------------------------------------------------------- the end

export interface RunSummary {
  outcome: Outcome;
  seconds: number;
  level: number;
  kills: number;
  miniBeaten: boolean;
  bossBeaten: boolean;
  evolved: WeaponId[];
  /** Every weapon held in the run, in the order picked up (weapons are never dropped). Fills the Weapon Codex. */
  weapons: WeaponId[];
  longestNoHitSeconds: number;
  gold: number;
}

export function goldFor(s: RunState): number {
  const shop = 1 + shopLevel(s, 'gold') * SHOP.gold.step;
  const base = Math.floor(s.kills / 8) * GOLD.per8Kills + (s.miniBeaten ? GOLD.miniBoss : 0) + (s.bossBeaten ? GOLD.boss : 0)
    + (s.outcome === 'won' || s.outcome === 'survived' ? GOLD.survived : 0) + s.bonusGold;
  return Math.floor(base * shop * (s.setup.map.storm ? STORM.gold : 1));
}

export function summary(s: RunState): RunSummary {
  return {
    outcome: s.outcome,
    seconds: Math.floor(s.t / STEPS_PER_SECOND),
    level: s.level,
    kills: s.kills,
    miniBeaten: s.miniBeaten,
    bossBeaten: s.bossBeaten,
    evolved: [...s.evolved],
    weapons: s.weapons.map((w) => w.id),
    longestNoHitSeconds: Math.floor(s.longestNoHit / STEPS_PER_SECOND),
    gold: goldFor(s),
  };
}
