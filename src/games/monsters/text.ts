/** The words in the battle message box, one place so they are easy to read and change. */
import type { BattleEvent, BattleState, ItemId } from '../../../shared/monsters/engine';
import { speciesOf } from '../../../shared/monsters/monsterBook';

export const nameOf = (id: string) => speciesOf(id).name;

export const ITEM_LABEL: Record<ItemId, string> = {
  potion: 'Potion',
  'super-potion': 'Super potion',
  ball: 'Ball',
  'great-ball': 'Great ball',
};
export const ITEM_NOTE: Record<ItemId, string> = {
  potion: 'Heals 40 health',
  'super-potion': 'Heals 120 health',
  ball: 'Catch a wild monster',
  'great-ball': 'Catches more often',
};

/** One step the student reads and taps through. `sub` marks the two halves of an evolution. */
export interface Beat {
  event: BattleEvent;
  text: string;
  sub?: 'evolving' | 'evolved';
}

/** A monster that is about to grow is still called by its old name while it levels up. */
export function earlierName(events: readonly BattleEvent[], species: string): string {
  let name = species;
  for (let again = true; again; ) {
    const e = events.find((x) => x.kind === 'evolved' && x.to === name);
    again = !!e;
    if (e && e.kind === 'evolved') name = e.from;
  }
  return name;
}

/**
 * The messages for the events of one move. `kind` is the battle kind (wild or trainer);
 * `fact` is the full right answer shown after a wrong one ("7 × 8 = 56").
 */
export function beatsFor(events: readonly BattleEvent[], kind: BattleState['kind'], fact?: string): Beat[] {
  const out: Beat[] = [];
  const foeName = (id: string) => (kind === 'wild' ? `The wild ${nameOf(id)}` : `The enemy ${nameOf(id)}`);
  for (const event of events) {
    switch (event.kind) {
      case 'start':
        out.push({ event, text: kind === 'wild' ? `A wild ${nameOf(event.foe)} appeared!` : `A trainer wants to battle! They send out ${nameOf(event.foe)}.` });
        break;
      case 'attack': {
        const who = event.side === 'you' ? nameOf(event.monster) : foeName(event.monster);
        const note = event.effect === 'strong' ? ' It’s super effective!' : event.effect === 'weak' ? ' It’s not very effective.' : '';
        let extra = '';
        if (event.side === 'you') {
          if (event.answer === 'quick-right') extra = ' Quick answer: critical hit!';
          else if (event.answer === 'wrong') extra = fact ? ` Not quite: ${fact}. A small hit.` : ' Not quite. A small hit.';
        }
        out.push({ event, text: `${who} used ${event.attack}!${note}${extra}` });
        break;
      }
      case 'faint':
        out.push({ event, text: event.side === 'you' ? `${nameOf(event.monster)} is tired out!` : `${foeName(event.monster)} was beaten!` });
        break;
      case 'foe-sent':
        out.push({ event, text: `They send out ${nameOf(event.foe)}!` });
        break;
      case 'switch':
        out.push({ event, text: `Go, ${nameOf(event.to)}!` });
        break;
      case 'item':
        out.push({ event, text: event.healed ? `${nameOf(event.monster ?? '')} got better (+${event.healed} health).` : 'It was used.' });
        break;
      case 'catch-try':
        out.push({ event, text: event.success ? 'You threw a ball… and it worked!' : 'You threw a ball… but it broke free!' });
        break;
      case 'caught':
        out.push({ event, text: event.to === 'team' ? `${nameOf(event.monster)} joined your team!` : `${nameOf(event.monster)} was sent to your monster box.` });
        break;
      case 'exp':
        out.push({ event, text: `${nameOf(event.monster)} gained ${event.amount} exp.` });
        break;
      case 'level-up':
        out.push({ event, text: `${nameOf(earlierName(events, event.monster))} grew to level ${event.level}!` });
        break;
      case 'evolved':
        out.push({ event, text: `What? ${nameOf(event.from)} is changing!`, sub: 'evolving' });
        out.push({ event, text: `${nameOf(event.from)} grew into ${nameOf(event.to)}!`, sub: 'evolved' });
        break;
      case 'ran':
        out.push({ event, text: 'You got away safely!' });
        break;
      case 'won':
        out.push({ event, text: 'You won the battle!' });
        break;
      case 'lost':
        out.push({ event, text: 'Your team is tired. You hurry back to rest, and nothing is lost.' });
        break;
    }
  }
  return out;
}
