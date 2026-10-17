import type { FightEvent, SkillId } from '../../../shared/lord/types';

export const SKILL_HELP: Record<SkillId, string> = {
  'power-strike': 'Hit twice as hard',
  zap: 'A magic bolt that always hurts',
  mend: 'Heal a quarter of your health',
  dodge: 'The next hit misses and you hit back',
  pinch: 'Hit and lift a bit of gold',
};

/** What happened in a round, in words. Short, a little cheeky, and never gory. */
export function narrate(log: FightEvent[], monster: string, dragon = false): string[] {
  const them = dragon ? 'The dragon' : `The ${monster}`;
  const lines: string[] = [];
  for (const e of log) {
    switch (e.type) {
      case 'hero-hit':
        lines.push(e.crit ? `A mighty blow! You hit ${dragon ? 'it' : `the ${monster}`} for ${e.damage}.` : `You hit ${dragon ? 'it' : `the ${monster}`} for ${e.damage}.`);
        break;
      case 'monster-hit':
        lines.push(e.damage === 0 ? `${them} swings, but your armour holds. No damage!` : `${them} hits you for ${e.damage}.`);
        break;
      case 'monster-missed':
        lines.push(`You slip aside. ${them} misses!`);
        break;
      case 'ran':
        lines.push(e.success ? 'You run away as fast as your legs will go.' : 'You try to run, but there is no way past!');
        break;
      case 'skill':
        if (e.skill === 'mend') lines.push(`You mend ${e.amount} health.`);
        else if (e.skill === 'pinch') lines.push(`You lift ${e.amount} gold from its pocket.`);
        else if (e.skill === 'dodge') lines.push('You dodge and strike back!');
        break;
      case 'end':
        if (e.outcome === 'won') lines.push(dragon ? 'The dragon is beaten!' : `You beat the ${monster}!`);
        else if (e.outcome === 'lost') lines.push('You fall... and everything goes dark.');
        break;
    }
  }
  return lines;
}

export const BARD_SONGS = [
  'A goblin lost his hat, his hat, his hat; / He asked a troll to find it, and the troll said "I sat on that."',
  'Oh the dragon has a cold, a cold, a cold; / It sneezed and burned the village hall, and now the hall is old.',
  'There once was a knight named Sue / Who fought with a pie and a shoe; / The ogre ran off / With a hiccup and cough, / And said "I was only passing through!"',
  'Seven sheep went into the wood, / Only six came back; / The seventh found a treasure chest / And is now a rich sheep. Baa.',
  'Heroes come and heroes go, / But the soup here is always slow.',
  'Count your gold and count it twice; / A banker\'s smile is worth the price.',
];

export const VILLAGE_NEWS = [
  'The baker says the pies are bigger today. They are not.',
  'A goblin was seen in the forest wearing a very small hat.',
  'The healer has a new bell. Please do not ring it.',
  'Market day: everyone is shouting about potions.',
  'The old bridge was fixed. Nobody saw who did it.',
  'A very large snail was spotted near the bank. It is still there.',
  'The blacksmith lost his hammer. He found it in his hand.',
  'Someone has stolen the village lanterns, and the dragon is blamed.',
];

export const dayHash = (day: string) => [...day].reduce((s, c) => s + c.charCodeAt(0), 0);

/** "a goblin", "an ogre". */
export const withArticle = (name: string) => (/^[aeiou]/i.test(name) ? 'an ' : 'a ') + name;
