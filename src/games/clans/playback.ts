/**
 * A played round, one action at a time, so the fight screen can show it happen (docs/CLANS-FIGHT-FEEL.md, stage 1).
 * Display only: it reads the round's log the engine already wrote and never touches the rules or the dice.
 */
import { CONFIG } from '../../../shared/clans/config';
import type { FightEvent, FightState } from '../../../shared/clans/fight';
import { SPELLS } from '../../../shared/clans/spells';
import { describe } from './fightView';

/** A fighter on the screen: `c2` is clan slot 2, `e0` the first enemy. */
export type Who = `c${number}` | `e${number}`;

export interface Float {
  text: string;
  kind: 'damage' | 'heal' | 'miss';
}

export interface Step {
  /** The log line for this action. */
  line: string;
  /** Who acts (nudges forward) and who it lands on (flashes, shakes, gets a floating number). */
  actor?: Who;
  targets: { who: Who; float?: Float }[];
  /** Everyone's HP once this action is done. */
  hp: Record<Who, number>;
}

export interface Summary {
  dealt: number;
  taken: number;
  healed: number;
  beaten: string[];
  resting: string[];
  text: string;
}

/**
 * The round's events in the order they happened on screen. The engine logs a knock-out just before the hit or spell
 * that caused it, so each knock-out moves to just after that hit.
 */
export function inOrder(events: FightEvent[]): FightEvent[] {
  const out = [...events];
  for (let i = 0; i < out.length - 1; i++) {
    const [down, cause] = [out[i], out[i + 1]];
    if (down.type === 'down' && (cause.type === 'hit' || cause.type === 'cast') && cause.target === down.who) {
      out[i] = cause;
      out[i + 1] = down;
      i++;
    }
  }
  return out;
}

/** About a third of a second an action, and a whole round never more than about 4 seconds. */
export const stepMs = (steps: number) => Math.min(350, Math.floor(4000 / Math.max(1, steps)));

const HEALS = new Set(Object.values(SPELLS).filter((s) => s.kind === 'heal').map((s) => s.name));
const DAMAGES = new Set(Object.values(SPELLS).filter((s) => s.kind === 'damage').map((s) => s.name));

/**
 * The steps of the round `after` just played from `before` (the same fight a round earlier). `from` is where the
 * round's events start in `after.log`. The last step's HP always matches `after`.
 */
export function roundSteps(before: FightState, after: FightState, from: number, clanNames: ReadonlySet<string>): Step[] {
  const who = new Map<string, Who>();
  for (const f of after.enemies) who.set(f.name, `e${f.index}`);
  for (const f of after.clan) who.set(f.name, `c${f.index}`);
  const max = new Map<Who, number>();
  const hp = {} as Record<Who, number>;
  for (const f of before.clan) (hp[`c${f.index}`] = f.hp), max.set(`c${f.index}`, f.maxHp);
  for (const f of before.enemies) (hp[`e${f.index}`] = f.hp), max.set(`e${f.index}`, f.maxHp);
  const change = (w: Who | undefined, by: number) => {
    if (w) hp[w] = Math.max(0, Math.min(max.get(w) ?? 0, hp[w] + by));
  };

  const steps: Step[] = [];
  for (const e of inOrder(after.log.slice(from))) {
    if (e.type === 'round') continue;
    const step: Step = { line: describe(e, clanNames), targets: [], hp };
    if (e.type === 'hit') {
      step.actor = who.get(e.who);
      change(who.get(e.target), -e.damage);
      step.targets.push({ who: who.get(e.target)!, float: { text: `-${e.damage}`, kind: 'damage' } });
    } else if (e.type === 'miss') {
      step.actor = who.get(e.who);
      step.targets.push({ who: who.get(e.target)!, float: { text: 'miss!', kind: 'miss' } });
    } else if (e.type === 'cast') {
      step.actor = who.get(e.who);
      const t = who.get(e.target)!;
      if (HEALS.has(e.spell)) {
        change(t, e.amount);
        step.targets.push({ who: t, float: { text: `+${e.amount}`, kind: 'heal' } });
      } else if (DAMAGES.has(e.spell)) {
        change(t, -e.amount);
        step.targets.push({ who: t, float: { text: `-${e.amount}`, kind: 'damage' } });
      } else step.targets.push({ who: t });
      // "Hits every enemy" logs one cast per enemy: show them as one action.
      const last = steps[steps.length - 1];
      if (last && last.actor === step.actor && last.line.startsWith(`${e.who}'s ${e.spell} `) && DAMAGES.has(e.spell)) {
        last.line += ` ${step.line}`;
        last.targets.push(...step.targets);
        last.hp = { ...hp };
        continue;
      }
    } else if (e.type === 'resist') {
      step.actor = who.get(e.who);
      step.targets.push({ who: who.get(e.target)!, float: { text: 'shrugs it off', kind: 'miss' } });
    } else if (e.type === 'cry' && e.kind === 'heal') {
      for (const f of before.clan) {
        if (hp[`c${f.index}`] <= 0) continue;
        const add = Math.min(Math.ceil(f.maxHp * CONFIG.battleCryHeal), f.maxHp - hp[`c${f.index}`]);
        change(`c${f.index}`, add);
        step.targets.push({ who: `c${f.index}`, float: { text: `+${add}`, kind: 'heal' } });
      }
    } else if (e.type === 'cry') {
      for (const f of before.clan) if (hp[`c${f.index}`] > 0) step.targets.push({ who: `c${f.index}` });
    } else if (e.type === 'guard' || e.type === 'tied') {
      step.actor = who.get(e.who);
    } else if (e.type === 'down') {
      step.targets.push({ who: who.get(e.who)! });
    }
    step.hp = { ...hp };
    steps.push(step);
  }
  return steps;
}

/** One line on what the round did: "Round 2: you did 34 damage and took 9. Goblin A is beaten!" */
export function roundSummary(after: FightState, from: number, clanNames: ReadonlySet<string>): Summary {
  let dealt = 0;
  let taken = 0;
  let healed = 0;
  const beaten: string[] = [];
  const resting: string[] = [];
  for (const e of after.log.slice(from) as FightEvent[]) {
    if (e.type === 'hit' || (e.type === 'cast' && DAMAGES.has(e.spell))) {
      const amount = e.type === 'hit' ? e.damage : e.amount;
      if (clanNames.has(e.who)) dealt += amount;
      else if (clanNames.has(e.target)) taken += amount;
    } else if (e.type === 'cast' && HEALS.has(e.spell) && clanNames.has(e.target)) healed += e.amount;
    else if (e.type === 'down') (clanNames.has(e.who) ? resting : beaten).push(e.who);
  }
  const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
  const parts = [`Round ${after.round}: you did ${dealt} damage and took ${taken}.`];
  if (healed) parts.push(`You healed ${healed}.`);
  if (beaten.length) parts.push(`${list(beaten)} ${beaten.length > 1 ? 'are' : 'is'} beaten!`);
  if (resting.length) parts.push(`${list(resting)} ${resting.length > 1 ? 'are' : 'is'} resting.`);
  return { dealt, taken, healed, beaten, resting, text: parts.join(' ') };
}
