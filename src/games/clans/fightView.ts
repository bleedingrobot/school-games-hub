/** Display helpers for a fight: who picks next, what the log says. Pure; no rules (those are in shared/clans). */
import { CONFIG } from '../../../shared/clans/config';
import { canCast, type Fighter, type FightEvent, type FightState, type Order } from '../../../shared/clans/fight';
import { SPELLS } from '../../../shared/clans/spells';
import { defeatWord } from './text';

/** Two "Goblin"s become "Goblin A" and "Goblin B" so the log can tell them apart. Names never touch the dice. */
export function labelDuplicates(state: FightState): FightState {
  const next = structuredClone(state);
  const counts = new Map<string, number>();
  for (const e of next.enemies) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const e of next.enemies) {
    if ((counts.get(e.name) ?? 0) > 1) {
      const n = seen.get(e.name) ?? 0;
      seen.set(e.name, n + 1);
      e.name = `${e.name} ${String.fromCharCode(65 + n)}`;
    }
  }
  return next;
}

export const isAlive = (f: Fighter) => f.hp > 0;

/** The order members choose in: quickest first (agility, a little for how healthy they are). Ties go to the lower slot. */
export function choosingOrder(state: FightState): number[] {
  const key = (f: Fighter) => f.stats.agility + Math.floor((f.hp * 10) / Math.max(1, f.maxHp));
  return state.clan
    .filter(isAlive)
    .map((f) => ({ i: f.index, k: key(f) }))
    .sort((a, b) => b.k - a.k || a.i - b.i)
    .map((x) => x.i);
}

/** "Default action": attack the first enemy still standing. */
export const defaultOrder = (state: FightState): Order => ({ action: 'attack', target: Math.max(0, state.enemies.findIndex(isAlive)) });

/** The spells a member can cast right now (known, enough SP, and in the game). */
export const castable = (f: Fighter) => f.spells.filter((id) => canCast(f, id)).map((id) => SPELLS[id]);

export const fightsLabel = (left: number) => `${left} of ${CONFIG.fightsPerDay}`;

/** One log line in gentle words. `clanNames` tells us whose side a name is on. */
export function describe(e: FightEvent, clanNames: ReadonlySet<string>): string {
  switch (e.type) {
    case 'round':
      return `Round ${e.round}`;
    case 'miss':
      return `${e.who} swings at ${e.target} and misses.`;
    case 'hit':
      return `${e.who} hits ${e.target} for ${e.damage}.`;
    case 'cast': {
      const spell = Object.values(SPELLS).find((s) => s.name === e.spell);
      if (spell?.kind === 'heal') return `${e.who} casts ${e.spell} on ${e.target}: +${e.amount} HP.`;
      if (spell?.kind === 'damage') return `${e.who}'s ${e.spell} hits ${e.target} for ${e.amount}.`;
      if (spell?.kind === 'tie') return `${e.who} casts ${e.spell}: ${e.target} is tied up!`;
      return `${e.who} casts ${e.spell} on ${e.target}.`;
    }
    case 'resist':
      return `${e.target} shrugs off ${e.who}'s ${e.spell}.`;
    case 'down':
      return clanNames.has(e.who) ? `${e.who} is knocked out and rests. They'll be fine.` : `${e.who} ${defeatWord(e.who)}!`;
    case 'tied':
      return `${e.who} wriggles in the ropes and loses a turn.`;
    case 'guard':
      return `${e.who} guards, ready for anything.`;
    case 'run':
      return e.ok ? 'The clan runs for the exit!' : "The clan can't get away this time.";
    case 'cry':
      return e.kind === 'damage' ? 'The Battle Cry rings out: the clan hits harder!' : 'The Battle Cry rings out: the clan feels better!';
  }
}
