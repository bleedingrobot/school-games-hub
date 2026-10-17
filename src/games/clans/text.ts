/** Kind, short writing for races, classes and mine zones. Our own words; nobody bleeds. */
export const RACE_TEXT: Record<string, string> = {
  Human: 'Good at a bit of everything.',
  Dwarf: 'Short, strong and very hard to knock over.',
  Elf: 'Quick, sharp-eyed and clever with magic.',
  'Half-Elf': 'Nimble and thoughtful, a little of both worlds.',
  Halfling: 'The quickest of all, with plenty of energy to spare.',
  Orc: 'Huge strength, but not much patience for spell books.',
  Muya: 'Light on their feet, wise, and good at magic.',
  Minotaur: 'Enormous and strong. Slow on their feet, and no good at spells.',
  Imp: 'A small mischief-maker with a very good aim.',
};
export const CLASS_TEXT: Record<string, string> = {
  Barbarian: 'Charges in and hits hard. No spells.',
  Warrior: 'Quick, steady fighter with a few battle moves.',
  'Martial Artist': 'Fast kicks and punches, and a little magic.',
  Knight: 'Brave and tough, with a healing prayer.',
  Assassin: 'Sneaky and accurate. Can tie enemies up with ropes.',
  Healer: 'Mends friends and keeps the clan going.',
  Sorcerer: 'Throws fireballs from a safe distance.',
  Necromancer: 'Studies spooky magic, and uses it kindly.',
  Wizard: 'Knows the most spells, but is easy to knock out.',
  Pirate: 'Quick and charming, with no magic at all.',
  Samurai: 'Calm and careful, with a sword and a fireball.',
};
export const ZONE_TEXT: Record<string, string> = {
  Meadow: 'Meadow pests: scruffy and silly, not scary.',
  Caves: 'Cave creatures: darker, and a bit tougher.',
  Swamp: 'Swamp dwellers: big, squelchy and grumpy.',
  Ruins: 'Old ruins: stony guardians and ghosts.',
  Mountain: 'The high mountain: dragons, wizards and storms.',
};
export const zoneForDepth = (depth: number) => (depth <= 3 ? 'Meadow' : depth <= 7 ? 'Caves' : depth <= 11 ? 'Swamp' : depth <= 15 ? 'Ruins' : 'Mountain');

/** Enemies that crumble when beaten; the rest run off. */
const CRUMBLERS = ['Skeleton', 'Bandaged Mummy', 'Stone Golem', 'Rock Pal', 'Rock Beast', 'Stone Warden', 'Gargoyle', 'Green Slime', 'Fire Spirit', 'Ember Lord'];
export const defeatWord = (name: string) => (CRUMBLERS.some((c) => name.startsWith(c)) ? 'crumbles away' : 'runs off');
