/**
 * The battle rules for Maths Monsters. Pure TypeScript: no screens, no browser, no clock.
 *
 *   play(state, action, random) → { state, events }
 *
 * The state is plain data (so it can be saved and sent), `play` never changes the state it is
 * given, and every random number comes from `random` (a 0-1 source passed in). Play the same
 * actions with the same random numbers and you get the same battle: the N.6 server check
 * replays a battle exactly this way (see `replayBattle`).
 *
 * The engine does not make the maths question. `questionFor` says which topic and band to ask;
 * the screen asks it and passes the result in the action. A quick answer is judged by
 * `judgeAnswer` from how hard the question was, not as a race.
 *
 * Battle flow adapted from Monster Tamer by Dev Share Academy (MIT, © 2024).
 */
import type { TopicId } from '../maths/skillPacks';
import { bandFor, quickSeconds } from './bands';
import { speciesOf, type Attack } from './monsterBook';
import {
  catchChance, damageFor, expYield, gainExp, makeMonster, maxHpOf, TUNING,
  type AnswerResult, type Effect, type Monster,
} from './rules';
import { TYPE_TOPIC, typeMultiplier } from './types';

export const MAX_TEAM = 6;

/** `repel` is only used on the map (the world's Bag menu); a battle refuses it. */
export type ItemId = 'potion' | 'super-potion' | 'ball' | 'great-ball' | 'repel';
export type Bag = Partial<Record<ItemId, number>>;

export type Phase = 'choose' | 'replace' | 'won' | 'lost' | 'ran' | 'caught';

export interface BattleState {
  kind: 'wild' | 'trainer';
  /** Area 1 to 6, and whether this is the far half of it (or its Tower): picks the question bands. */
  area: number;
  far: boolean;
  team: Monster[];
  /** Monsters waiting in the box (caught when the team is full). */
  box: Monster[];
  bag: Bag;
  /** Index into `team`. */
  active: number;
  foes: Monster[];
  foeActive: number;
  /** Team members who have fought the current foe (they share the exp). */
  fought: number[];
  phase: Phase;
  turn: number;
  questions: number;
}

export interface BattleSetup {
  kind: 'wild' | 'trainer';
  area: number;
  far?: boolean;
  team: Monster[];
  box?: Monster[];
  bag?: Bag;
  foes: Monster[];
}

export type BattleAction =
  | { kind: 'fight'; attack: number; answer: AnswerResult }
  | { kind: 'switch'; to: number }
  | { kind: 'item'; item: ItemId; target?: number }
  | { kind: 'catch'; answer: AnswerResult; ball?: 'ball' | 'great-ball' }
  | { kind: 'run' };

export type BattleEvent =
  | { kind: 'start'; foe: string }
  | { kind: 'attack'; side: 'you' | 'foe'; monster: string; attack: string; anim: string; damage: number; effect: Effect; answer?: AnswerResult; showAnswer?: boolean }
  | { kind: 'faint'; side: 'you' | 'foe'; monster: string }
  | { kind: 'foe-sent'; foe: string }
  | { kind: 'switch'; to: string }
  | { kind: 'item'; item: ItemId; monster?: string; healed?: number }
  | { kind: 'catch-try'; chance: number; success: boolean }
  | { kind: 'caught'; monster: string; to: 'team' | 'box' }
  | { kind: 'exp'; monster: string; amount: number }
  | { kind: 'level-up'; monster: string; level: number }
  | { kind: 'evolved'; from: string; to: string }
  | { kind: 'ran' }
  | { kind: 'won' }
  | { kind: 'lost' };

export class BattleRuleError extends Error {}

function refuse(why: string): never {
  throw new BattleRuleError(why);
}

export function newBattle(setup: BattleSetup): { state: BattleState; events: BattleEvent[] } {
  if (!setup.team.length || setup.team.length > MAX_TEAM) refuse('A team has 1 to 6 monsters');
  if (!setup.foes.length) refuse('A battle needs a foe');
  if (setup.kind === 'wild' && setup.foes.length !== 1) refuse('A wild battle has one monster');
  const first = setup.team.findIndex((m) => m.hp > 0);
  if (first < 0) refuse('Every monster on the team is tired');
  const state: BattleState = {
    kind: setup.kind,
    area: setup.area,
    far: setup.far ?? false,
    team: structuredClone(setup.team),
    box: structuredClone(setup.box ?? []),
    bag: { ...(setup.bag ?? {}) },
    active: first,
    foes: structuredClone(setup.foes),
    foeActive: 0,
    fought: [first],
    phase: 'choose',
    turn: 0,
    questions: 0,
  };
  return { state, events: [{ kind: 'start', foe: setup.foes[0].species }] };
}

export const activeMonster = (s: BattleState) => s.team[s.active];
export const activeFoe = (s: BattleState) => s.foes[s.foeActive];

/** The topic and band the next question for this action should come from. */
export function questionFor(state: BattleState, action: Pick<BattleAction, 'kind'>): { topic: TopicId; band: number } | null {
  let topic: TopicId;
  if (action.kind === 'fight') topic = TYPE_TOPIC[speciesOf(activeMonster(state).species).type];
  else if (action.kind === 'catch') topic = TYPE_TOPIC[speciesOf(activeFoe(state).species).type];
  else return null;
  return { topic, band: bandFor(topic, state.area, state.far) };
}

/**
 * Right, quick-right or wrong. Quick means correct within the time set by the question's
 * difficulty. `calm` (a student setting) switches the quick bonus off.
 */
export function judgeAnswer(a: { correct: boolean; ms: number; topic: TopicId; band: number; calm?: boolean }): AnswerResult {
  if (!a.correct) return 'wrong';
  if (!a.calm && a.ms <= quickSeconds(a.topic, a.band) * 1000) return 'quick-right';
  return 'right';
}

export const isOver = (s: BattleState) => s.phase === 'won' || s.phase === 'lost' || s.phase === 'ran' || s.phase === 'caught';

/** Picks an attack for a foe: trainers always take the best-looking one, wild monsters sometimes. */
export function foeAttackIndex(state: BattleState, random: () => number): number {
  const foe = activeFoe(state);
  const species = speciesOf(foe.species);
  const target = speciesOf(activeMonster(state).species);
  const best = species.attacks.reduce((bi, a, i, all) => {
    const score = (x: Attack) => x.power * typeMultiplier(species.type, target.type);
    return score(a) > score(all[bi]) ? i : bi;
  }, 0);
  // Always draw, so the number of random draws never depends on who is fighting.
  const smart = random();
  const pick = random();
  if (state.kind === 'trainer' || smart < TUNING.wildSmartChance) return best;
  return Math.min(species.attacks.length - 1, Math.floor(pick * species.attacks.length));
}

/** Does one step of the battle. Throws BattleRuleError for an action that isn't allowed. */
export function play(prev: BattleState, action: BattleAction, random: () => number): { state: BattleState; events: BattleEvent[] } {
  if (isOver(prev)) refuse('The battle is over');
  const s = structuredClone(prev);
  const events: BattleEvent[] = [];
  const me = () => s.team[s.active];
  const foe = () => s.foes[s.foeActive];

  if (s.phase === 'replace') {
    if (action.kind !== 'switch') refuse('Choose a monster to send out');
    checkSwitch(s, action.to, true);
    s.active = action.to;
    s.phase = 'choose';
    if (!s.fought.includes(s.active)) s.fought.push(s.active);
    events.push({ kind: 'switch', to: me().species });
    return { state: s, events };
  }

  s.turn += 1;
  let foeActs = true;

  switch (action.kind) {
    case 'fight': {
      const attack = speciesOf(me().species).attacks[action.attack];
      if (!attack) refuse('That monster has no such attack');
      if (!['right', 'quick-right', 'wrong'].includes(action.answer)) refuse('Unknown answer result');
      s.questions += 1;
      const hit = damageFor(me(), attack.power, foe(), action.answer, random());
      foe().hp = Math.max(0, foe().hp - hit.damage);
      events.push({
        kind: 'attack', side: 'you', monster: me().species, attack: attack.name, anim: attack.anim,
        damage: hit.damage, effect: hit.effect, answer: action.answer, ...(action.answer === 'wrong' ? { showAnswer: true } : {}),
      });
      break;
    }
    case 'switch':
      checkSwitch(s, action.to, false);
      s.active = action.to;
      if (!s.fought.includes(s.active)) s.fought.push(s.active);
      events.push({ kind: 'switch', to: me().species });
      break;
    case 'item': {
      const have = s.bag[action.item] ?? 0;
      if (have < 1) refuse('You have none of those');
      const heal = action.item === 'potion' ? TUNING.potionHeal : action.item === 'super-potion' ? TUNING.superPotionHeal : refuse('That is not a healing item');
      const target = s.team[action.target ?? s.active];
      if (!target) refuse('No such monster');
      if (target.hp <= 0) refuse('That monster is tired; a potion cannot help');
      const cap = maxHpOf(target);
      if (target.hp >= cap) refuse('That monster is already at full health');
      const healed = Math.min(heal, cap - target.hp);
      target.hp += healed;
      s.bag[action.item] = have - 1;
      events.push({ kind: 'item', item: action.item, monster: target.species, healed });
      break;
    }
    case 'catch': {
      if (s.kind !== 'wild') refuse('You cannot catch a trainer’s monster');
      const ball = action.ball ?? 'ball';
      const have = s.bag[ball] ?? 0;
      if (have < 1) refuse('You have no balls left');
      s.bag[ball] = have - 1;
      s.questions += 1;
      const chance = catchChance(foe(), action.answer, ball);
      const success = random() < chance;
      events.push({ kind: 'catch-try', chance, success });
      if (success) {
        const caught = { ...foe(), hp: Math.max(1, foe().hp) };
        const to = s.team.length < MAX_TEAM ? 'team' : 'box';
        (to === 'team' ? s.team : s.box).push(caught);
        events.push({ kind: 'caught', monster: caught.species, to });
        shareExp(s, events);
        s.phase = 'caught';
        foeActs = false;
      }
      break;
    }
    case 'run':
      if (s.kind !== 'wild') refuse('You cannot run from a trainer');
      events.push({ kind: 'ran' });
      s.phase = 'ran';
      foeActs = false;
      break;
    default:
      refuse('Unknown action');
  }

  if (s.phase === 'choose' && foe().hp <= 0) {
    events.push({ kind: 'faint', side: 'foe', monster: foe().species });
    shareExp(s, events);
    if (s.foeActive + 1 < s.foes.length) {
      s.foeActive += 1;
      s.fought = [s.active];
      events.push({ kind: 'foe-sent', foe: foe().species });
    } else {
      s.phase = 'won';
      events.push({ kind: 'won' });
    }
    foeActs = false;
  }

  if (foeActs && s.phase === 'choose') {
    const f = foe();
    const attack = speciesOf(f.species).attacks[foeAttackIndex(s, random)];
    const hit = damageFor(f, attack.power, me(), undefined, random());
    me().hp = Math.max(0, me().hp - hit.damage);
    events.push({ kind: 'attack', side: 'foe', monster: f.species, attack: attack.name, anim: attack.anim, damage: hit.damage, effect: hit.effect });
    if (me().hp <= 0) {
      events.push({ kind: 'faint', side: 'you', monster: me().species });
      if (s.team.some((m) => m.hp > 0)) {
        s.phase = 'replace';
      } else {
        s.phase = 'lost';
        events.push({ kind: 'lost' });
      }
    }
  }
  return { state: s, events };
}

function checkSwitch(s: BattleState, to: number, free: boolean) {
  const target = s.team[to];
  if (!Number.isInteger(to) || !target) refuse('No such monster');
  if (target.hp <= 0) refuse('That monster is tired');
  if (!free && to === s.active) refuse('That monster is already out');
}

/** Shares the beaten foe's exp between the living monsters that fought it, then levels them. */
function shareExp(s: BattleState, events: BattleEvent[]) {
  const alive = s.fought.filter((i) => s.team[i] && s.team[i].hp > 0);
  if (!alive.length) return;
  const each = Math.max(1, Math.floor(expYield(s.foes[s.foeActive], s.kind === 'trainer') / alive.length));
  for (const i of alive) {
    const result = gainExp(s.team[i], each);
    const from = s.team[i].species;
    events.push({ kind: 'exp', monster: from, amount: each });
    for (const level of result.levelUps) events.push({ kind: 'level-up', monster: result.monster.species, level });
    let name = from;
    for (const to of result.evolvedTo) {
      events.push({ kind: 'evolved', from: name, to });
      name = to;
    }
    s.team[i] = result.monster;
  }
}

/**
 * Plays a whole battle from its setup and the student's actions, with random numbers from
 * `random`. The server uses this to check a reported battle.
 */
export function replayBattle(setup: BattleSetup, actions: readonly BattleAction[], random: () => number): { state: BattleState; events: BattleEvent[] } {
  let { state, events } = newBattle(setup);
  for (const action of actions) {
    const step = play(state, action, random);
    state = step.state;
    events = events.concat(step.events);
  }
  return { state, events };
}

/**
 * What losing does: the team is healed at the last healing spot and nothing is lost.
 * (Where that spot is, is the world's job; this just returns the team healed.)
 */
export function healTeam(team: readonly Monster[]): Monster[] {
  return team.map((m) => ({ ...m, hp: maxHpOf(m) }));
}

export { makeMonster };
