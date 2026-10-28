/**
 * A mine fight, as a pure state machine. `newFight` picks the enemies from a seed; `playRound`
 * takes one order per clan member and runs a whole round. The same seed and the same orders
 * always give the same fight, so the server can replay what the browser played. The whole
 * state is plain JSON, so a half-finished fight can be saved.
 *
 * Rules and numbers are The Clans': agility-first turns (hurt fighters slow down), hit when
 * dexterity beats agility, damage from half strength minus armour, experience per hit.
 */
import { CONFIG } from './config';
import { fightStats } from './character';
import { MONSTERS } from './gamedata';
import { roll } from './rng';
import { SPELLS, type SpellDef } from './spells';
import { STATS, type Member, type MonsterDef, type MonsterKind, type Stat, type Stats } from './types';

export interface Mod {
  stat: Stat;
  amount: number;
  /** Still active while the fight's round number is at most this. */
  until: number;
}

export interface Fighter {
  side: 'clan' | 'enemy';
  /** Position in its own side's list. */
  index: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  stats: Stats;
  spells: number[];
  mods: Mod[];
  /** Turns it will lose to being tied up. */
  tied: number;
  guarding: boolean;
  /** Gold, for enemies. */
  difficulty: number;
}

export type Order =
  | { action: 'attack'; target: number }
  | { action: 'spell'; spell: number; target: number }
  | { action: 'guard' }
  | { action: 'run' }
  | { action: 'skip' }
  /** Monster fights only: give a member (`target`, their place in the clan) a healing potion. */
  | { action: 'potion'; target: number };

/** What a right Battle Cry answer was spent on this round. */
export type Cry = 'damage' | 'heal' | null;

export type FightEvent =
  | { type: 'miss'; who: string; target: string }
  | { type: 'hit'; who: string; target: string; damage: number }
  | { type: 'cast'; who: string; spell: string; target: string; amount: number }
  | { type: 'resist'; who: string; spell: string; target: string }
  | { type: 'down'; who: string }
  | { type: 'tied'; who: string }
  | { type: 'guard'; who: string }
  | { type: 'run'; ok: boolean }
  | { type: 'cry'; kind: Exclude<Cry, null> }
  | { type: 'round'; round: number }
  /** Monster fights: the monster gets ready for its big move next round (you see it coming). */
  | { type: 'warn'; who: string; move: MonsterKind }
  /** Monster fights: the big move itself (the hits it does follow as 'hit' events). */
  | { type: 'big'; who: string; move: MonsterKind }
  /** Monster fights: the giant net holds the monster, and its big move misses. */
  | { type: 'net'; who: string }
  | { type: 'potion'; who: string; target: string; amount: number };

export type FightResult = 'won' | 'lost' | 'fled' | 'timeout';

/** What makes a fight a monster fight (monster.ts sets it up). */
export interface MonsterInFight {
  kind: MonsterKind;
  /** Healing potions the clan brought, and whether the giant net is still unused. */
  potions: number;
  net: boolean;
  /** Percent the Walls cut off every hit the monster does. */
  wallsCut: number;
  /** The most rounds this fight lasts. */
  rounds: number;
}

export interface FightState {
  /** Random state (see rng.ts). */
  rng: number;
  /** The seed the fight started from (it never changes; the Battle Cry questions come from it). */
  seed: number;
  depth: number;
  round: number;
  clan: Fighter[];
  enemies: Fighter[];
  result: FightResult | null;
  /** Experience each clan member earned (same order as `clan`). */
  xp: number[];
  gold: number;
  followers: number;
  log: FightEvent[];
  /** Only in a monster fight. */
  monster?: MonsterInFight;
}

const stat = (f: Fighter, s: Stat): number => {
  let v = f.stats[s];
  for (const m of f.mods) v += m.amount;
  return Math.max(0, Math.min(CONFIG.statCap, v));
};

const alive = (f: Fighter) => f.hp > 0;

function clanFighter(m: Member, index: number): Fighter {
  return {
    side: 'clan', index, name: m.name, level: m.level, hp: m.knockedOut ? 0 : m.hp, maxHp: m.maxHp, sp: m.sp, maxSp: m.maxSp,
    stats: fightStats(m), spells: m.spells, mods: [], tied: 0, guarding: false, difficulty: 0,
  };
}

/** One enemy, with the original's wobble: stats 80-139%, HP 80-109%. */
function spawn(dice: { rng: number }, def: MonsterDef, index: number): Fighter {
  const stats = { ...def.stats };
  for (const s of STATS) stats[s] = Math.floor((def.stats[s] * (80 + roll(dice, 60))) / 100);
  const hp = Math.max(1, Math.floor((def.hp * (80 + roll(dice, 30))) / 100));
  return {
    side: 'enemy', index, name: def.name, level: def.difficulty, hp, maxHp: hp, sp: def.sp, maxSp: def.sp, stats, spells: def.spells,
    mods: [], tied: 0, guarding: false, difficulty: def.difficulty,
  };
}

/** Monsters that can turn up at a mine depth: from 2 levels above to 1 below (bosses only on request). */
export function monstersAt(depth: number): MonsterDef[] {
  const pool = MONSTERS.filter((m) => !m.boss && m.mine <= depth + 1 && m.mine >= depth - 2);
  return pool.length ? pool : MONSTERS.filter((m) => !m.boss && Math.abs(m.mine - depth) <= 4);
}

export function bossAt(depth: number): MonsterDef | undefined {
  return MONSTERS.find((m) => m.boss && m.mine === depth);
}

/** Start a fight at a mine depth (0-20). `boss` fights the depth's boss with two helpers. */
export function newFight(members: Member[], depth: number, seed: number, boss = false): FightState {
  const state: FightState = {
    rng: seed | 0, seed: seed | 0, depth, round: 0, clan: members.map(clanFighter), enemies: [], result: null,
    xp: members.map(() => 0), gold: 0, followers: 0, log: [],
  };
  const pool = monstersAt(depth);
  const bossDef = boss ? bossAt(depth) : undefined;
  const count = bossDef ? 2 : depth < 3 ? 2 + roll(state, 2) : 3 + roll(state, 2);
  const list: MonsterDef[] = bossDef ? [bossDef] : [];
  while (list.length < count + (bossDef ? 1 : 0)) list.push(pool[roll(state, pool.length)]);
  state.enemies = list.map((def, i) => spawn(state, def, i));
  if (state.clan.every((f) => !alive(f))) state.result = 'lost';
  return state;
}

/** The most rounds a fight lasts: a monster fight has its own. */
export const maxRoundsOf = (s: Pick<FightState, 'monster'>) => s.monster?.rounds ?? CONFIG.maxRounds;

const team = (s: FightState, side: 'clan' | 'enemy') => (side === 'clan' ? s.clan : s.enemies);
const foes = (s: FightState, f: Fighter) => team(s, f.side === 'clan' ? 'enemy' : 'clan');
const friends = (s: FightState, f: Fighter) => team(s, f.side);

function hurt(s: FightState, attacker: Fighter, target: Fighter, damage: number): number {
  if (target.guarding) damage = Math.max(1, Math.ceil(damage / 2));
  damage = Math.min(damage, target.hp);
  target.hp -= damage;
  if (attacker.side === 'clan') s.xp[attacker.index] += Math.round((Math.floor(damage / 3) + 1) * (1 + Math.max(0, s.depth - CONFIG.xpBoostFrom) * CONFIG.xpDepthBoost));
  if (target.hp <= 0) {
    s.log.push({ type: 'down', who: target.name });
    if (target.side === 'enemy') s.gold += Math.round((target.difficulty * (20 + roll(s, 10)) + 50 + roll(s, 20)) / 10);
  }
  return damage;
}

/** In a monster fight the Walls take a share off every hit the monster does. */
const cutByWalls = (s: FightState, who: Fighter, dmg: number) =>
  s.monster && who.side === 'enemy' ? Math.max(1, Math.ceil((dmg * (100 - s.monster.wallsCut)) / 100)) : dmg;

function attack(s: FightState, who: Fighter, target: Fighter, cry: Cry): void {
  if (stat(who, 'dexterity') + roll(s, 4) + roll(s, 4) + 2 < stat(target, 'agility') + roll(s, 4)) {
    s.log.push({ type: 'miss', who: who.name, target: target.name });
    return;
  }
  let dmg = Math.floor((Math.floor(stat(who, 'strength') / 2) * (80 + roll(s, 40))) / 100);
  if (who.side === 'clan' && cry === 'damage') dmg = Math.floor(dmg * CONFIG.battleCryDamage);
  // A monster's strength is above the stat cap: its hits are multiplied instead.
  if (s.monster && who.side === 'enemy') dmg = Math.floor(dmg * CONFIG.monster.power);
  dmg = cutByWalls(s, who, Math.max(1, dmg - stat(target, 'armor')));
  const done = hurt(s, who, target, dmg);
  s.log.push({ type: 'hit', who: who.name, target: target.name, damage: done });
}

/** Does this spell go off against a target? Healing and damage always do; the rest can be shrugged off. */
function lands(s: FightState, who: Fighter, spell: SpellDef, target: Fighter): boolean {
  if (spell.kind === 'heal' || spell.kind === 'damage' || spell.kind === 'buff') return true;
  return who.level + stat(who, 'wisdom') + roll(s, 8) + spell.level >= target.level + stat(target, 'wisdom') + roll(s, 4);
}

export function canCast(f: Fighter, spellId: number): boolean {
  const sp = SPELLS[spellId];
  return !!sp && !sp.notYet && f.spells.includes(spellId) && f.sp >= sp.sp;
}

function cast(s: FightState, who: Fighter, spell: SpellDef, target: Fighter): void {
  who.sp -= spell.sp;
  const lvl = Math.min(who.level, 10);
  if (spell.kind === 'heal') {
    const amount = Math.floor(((spell.value + Math.floor(lvl / 2)) * (50 + roll(s, 50))) / 100);
    target.hp = Math.min(target.maxHp, target.hp + amount);
    s.log.push({ type: 'cast', who: who.name, spell: spell.name, target: target.name, amount });
  } else if (spell.kind === 'damage') {
    const targets = spell.all ? foes(s, who).filter(alive) : [target];
    for (const t of targets) {
      const amount = Math.max(1, Math.floor(((spell.value + Math.floor((lvl + stat(who, 'wisdom')) / 3)) * (50 + roll(s, 60))) / 100));
      const done = hurt(s, who, t, amount);
      s.log.push({ type: 'cast', who: who.name, spell: spell.name, target: t.name, amount: done });
    }
  } else if (!lands(s, who, spell, target)) {
    s.log.push({ type: 'resist', who: who.name, spell: spell.name, target: target.name });
  } else if (spell.kind === 'tie') {
    target.tied = 1;
    s.log.push({ type: 'cast', who: who.name, spell: spell.name, target: target.name, amount: 0 });
  } else if (spell.mod) {
    target.mods.push({ stat: spell.mod.stat, amount: spell.mod.amount, until: s.round + spell.mod.rounds - 1 });
    s.log.push({ type: 'cast', who: who.name, spell: spell.name, target: target.name, amount: spell.mod.amount });
  }
}

function pick(s: FightState, list: Fighter[]): Fighter | undefined {
  const live = list.filter(alive);
  return live.length ? live[roll(s, live.length)] : undefined;
}

/** A hit that cannot miss, `times` a normal hit (a monster's big move). */
function smash(s: FightState, who: Fighter, target: Fighter, times: number): void {
  const dmg = Math.floor((Math.floor(stat(who, 'strength') / 2) * (80 + roll(s, 40)) * times * CONFIG.monster.power) / 100);
  const done = hurt(s, who, target, cutByWalls(s, who, Math.max(1, dmg - stat(target, 'armor'))));
  s.log.push({ type: 'hit', who: who.name, target: target.name, damage: done });
}

/** Is round `round` a monster fight's big-move round? */
export const bigMoveRound = (round: number) => round > 0 && round % CONFIG.monster.bigEvery === 0;

/** The monster's turn: a stomp on two members, or every third round its big move (which the giant net stops once). */
function monsterTurn(s: FightState, who: Fighter, m: MonsterInFight, cry: Cry): void {
  const M = CONFIG.monster;
  if (bigMoveRound(s.round)) {
    if (m.net) {
      m.net = false;
      s.log.push({ type: 'net', who: who.name });
      return;
    }
    s.log.push({ type: 'big', who: who.name, move: m.kind });
    if (m.kind === 'golem') {
      for (const t of s.clan.filter(alive)) smash(s, who, t, M.slam);
      return;
    }
    const target = pick(s, s.clan);
    if (!target) return;
    smash(s, who, target, m.kind === 'giant' ? M.boulder : M.breath);
    if (m.kind === 'troll' && alive(target)) {
      target.tied = 1;
      s.log.push({ type: 'tied', who: target.name });
    }
    return;
  }
  // A stomp: two different members (or the one left standing).
  const first = pick(s, s.clan);
  if (!first) return;
  attack(s, who, first, cry);
  const rest = s.clan.filter((f) => alive(f) && f !== first);
  if (rest.length) attack(s, who, rest[roll(s, rest.length)], cry);
}

/** What an enemy does with its turn. */
function enemyTurn(s: FightState, who: Fighter, cry: Cry): void {
  if (s.monster) return monsterTurn(s, who, s.monster, cry);
  const spells = who.spells.map((id) => SPELLS[id]).filter((sp): sp is SpellDef => !!sp && canCast(who, sp.id));
  if (spells.length && roll(s, 3) === 0) {
    const spell = spells[roll(s, spells.length)];
    const target = spell.friendly
      ? friends(s, who).filter(alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      : pick(s, foes(s, who));
    if (target) return cast(s, who, spell, target);
  }
  const target = pick(s, foes(s, who));
  if (target) attack(s, who, target, cry);
}

function clanTurn(s: FightState, who: Fighter, order: Order | undefined, cry: Cry): void {
  const fallback = (): Order => ({ action: 'attack', target: s.enemies.findIndex(alive) });
  let o = order ?? fallback();
  if (o.action === 'run') {
    const dex = s.clan.filter(alive).reduce((t, f) => t + stat(f, 'dexterity'), 0) / Math.max(1, s.clan.filter(alive).length);
    const agi = s.enemies.filter(alive).reduce((t, f) => t + stat(f, 'agility'), 0) / Math.max(1, s.enemies.filter(alive).length);
    const ok = dex + roll(s, 15) >= agi + roll(s, 15);
    s.log.push({ type: 'run', ok });
    if (ok) s.result = 'fled';
    return;
  }
  if (o.action === 'skip') return;
  if (o.action === 'potion') {
    const target = s.clan[o.target];
    if (s.monster && s.monster.potions > 0 && target && alive(target)) {
      s.monster.potions--;
      const amount = Math.min(target.maxHp - target.hp, Math.ceil(target.maxHp * CONFIG.monster.potionHeal));
      target.hp += amount;
      s.log.push({ type: 'potion', who: who.name, target: target.name, amount });
      return;
    }
    o = fallback();
  }
  if (o.action === 'guard') {
    who.guarding = true;
    s.log.push({ type: 'guard', who: who.name });
    return;
  }
  if (o.action === 'spell') {
    const spell = SPELLS[o.spell];
    const list = spell && spell.friendly ? s.clan : s.enemies;
    const target = list[o.target];
    if (spell && canCast(who, spell.id) && target && alive(target)) return cast(s, who, spell, target);
    o = fallback();
  }
  if (o.action === 'attack') {
    let target = s.enemies[o.target];
    if (!target || !alive(target)) target = s.enemies.find(alive) as Fighter;
    if (target) attack(s, who, target, cry);
  }
}

function checkEnd(s: FightState): void {
  if (s.result) return;
  if (s.enemies.every((f) => !alive(f))) s.result = 'won';
  else if (s.clan.every((f) => !alive(f))) s.result = 'lost';
}

/** Followers who watched you win: more the deeper you go. */
function followersFor(s: FightState): number {
  const d = s.depth;
  const base = d <= 5 ? 4 : d <= 10 ? 7 : d <= 15 ? 11 : 14;
  return base + roll(s, 3);
}

/**
 * Play one round. `orders[i]` is clan member i's order (anything missing or not allowed becomes
 * a plain attack). `cry` is the Battle Cry bonus the server has already decided was earned.
 */
export function playRound(s: FightState, orders: (Order | undefined)[], cry: Cry = null): void {
  if (s.result) return;
  s.round++;
  s.log.push({ type: 'round', round: s.round });
  for (const f of [...s.clan, ...s.enemies]) {
    f.guarding = false;
    f.mods = f.mods.filter((m) => m.until >= s.round);
    if (alive(f) && f.maxHp && f.spells.length) f.sp = Math.min(f.maxSp, f.sp + Math.floor((stat(f, 'wisdom') * (roll(s, 15) + 5)) / 150) + 1);
  }
  if (cry) s.log.push({ type: 'cry', kind: cry });
  if (cry === 'heal') {
    for (const f of s.clan.filter(alive)) f.hp = Math.min(f.maxHp, f.hp + Math.ceil(f.maxHp * CONFIG.battleCryHeal));
  }

  const order = [...s.clan, ...s.enemies]
    .filter(alive)
    .map((f) => ({ f, key: stat(f, 'agility') + Math.floor((f.hp * 10) / f.maxHp) + roll(s, 2) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.f);

  for (const who of order) {
    if (s.result) break;
    if (!alive(who)) continue;
    if (who.tied > 0) {
      who.tied--;
      s.log.push({ type: 'tied', who: who.name });
      continue;
    }
    if (who.side === 'clan') clanTurn(s, who, orders[who.index], cry);
    else enemyTurn(s, who, cry);
    checkEnd(s);
  }
  if (s.result === 'won') s.followers = followersFor(s);
  else if (!s.result && s.round >= maxRoundsOf(s)) s.result = 'timeout';
  // The monster gets ready for its big move: the clan sees it coming before it gives its orders.
  if (!s.result && s.monster && bigMoveRound(s.round + 1) && s.enemies[0] && alive(s.enemies[0])) {
    s.log.push({ type: 'warn', who: s.enemies[0].name, move: s.monster.kind });
  }
}

/**
 * Write a finished fight back onto the members: surviving HP/SP (with the between-fight rest),
 * knock-outs, and experience. Gold and followers are for the clan to take. Returns how many
 * levels each member gained.
 */
export function settle(members: Member[], s: FightState, gain: (m: Member, xp: number) => number): number[] {
  return members.map((m, i) => {
    const f = s.clan[i];
    if (!f) return 0;
    const wasOut = m.knockedOut;
    m.sp = f.sp;
    if (wasOut) return 0;
    m.hp = Math.max(0, f.hp);
    if (m.hp === 0) m.knockedOut = true;
    else {
      m.hp = Math.min(m.maxHp, m.hp + Math.ceil((m.maxHp - m.hp) * CONFIG.betweenFightHeal));
      m.sp = Math.min(m.maxSp, m.sp + Math.ceil((m.maxSp - m.sp) * CONFIG.betweenFightHeal));
    }
    return gain(m, s.xp[i]);
  });
}
