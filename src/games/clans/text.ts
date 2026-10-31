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

/** One kind line for each thing in the shop. Nobody bleeds. */
export const ITEM_TEXT: Record<string, string> = {
  Shortsword: 'A neat little sword. Light and quick.',
  Broadsword: 'A wide, sturdy sword for a steady arm.',
  Axe: 'Heavy and strong. Takes a good pair of arms.',
  Mace: 'A spiky club that taps hard on stony things.',
  Dagger: 'Small and sneaky. Almost anyone can use it.',
  Staff: 'A long wooden stick. Handy for a walk too.',
  Wand: 'A thin wand that makes magic sparkle.',
  'Battle Axe': 'A big double-headed axe. Only the strong can swing it.',
  'Morning Star': 'A ball of spikes on a stick. Needs a quick hand.',
  Scythe: 'A farmer\'s blade, curved like the moon.',
  Boomerang: 'Throw it, and it might even come back.',
  "Falcon's Sword": 'A bright sword with a bird on the handle.',
  'Sky Sword': 'A legend. It hums when the sun comes out.',
  'Knobbly Club': 'A lumpy old club. Cheap, and it works.',
  'Thunder Axe': 'It rumbles every time it swings.',
  'Moon Blade': 'A pale curved blade that glows at night.',
  "Wizard's Staff": 'A staff full of spells for people who read a lot.',
  'Silver Mace': 'A shiny mace. Looks smart, hits hard.',
  'Great Axe': 'The biggest axe in the shop. Mind the doorways.',
  Rags: 'Better than nothing, and very cheap.',
  'Cloth Robe': 'A soft robe. Light as a feather.',
  'Cloth Tunic': 'A plain tunic, good for running about in.',
  'Leather Armor': 'Tough leather that still bends.',
  'Wooden Armor': 'Planks tied together. Stronger than it looks.',
  'Chainmail Armor': 'Hundreds of little metal rings.',
  'Platemail Armor': 'Shiny metal plates from neck to knee.',
  'Kai Tunic': 'A fine tunic for quick, careful fighters.',
  "Hero's Armor": 'The armour every hero dreams about.',
  'Wooden Shield': 'A round shield made of good oak.',
  'Iron Shield': 'A plain iron shield. Solid and dependable.',
  'Platinum Shield': 'A shield that shines like a mirror.',
  'Crystal Shield': 'A shield of clear crystal. Sparkly and strong.',
  "Hero's Shield": 'A shield that makes friends feel brave.',
  "Lion's Shield": 'A shield with a roaring lion on the front.',
};
export const KIND_WORD: Record<string, string> = { weapon: 'Weapon', armor: 'Armour', shield: 'Shield' };
export const STAT_WORD: Record<string, string> = { agility: 'Agility', dexterity: 'Dexterity', strength: 'Strength', wisdom: 'Wisdom', armor: 'Armour', charisma: 'Charisma' };

/** What each thing you can train actually does in a fight. Keys match the Training Hall options. */
export const TRAIN_HELP: Record<string, string> = {
  agility: 'Agility: who goes first in a fight, and how hard you are to hit. Enemies need to beat your agility to land a blow.',
  dexterity: 'Dexterity: your aim. The higher it is above the enemy\'s agility, the more of your hits land.',
  strength: 'Strength: how hard you hit. Damage is about half your strength, so every 2 points adds 1 damage.',
  wisdom: 'Wisdom: makes your spells stronger and more likely to work, and gives you skill points back faster in a fight.',
  armor: 'Armour: every point takes 1 damage off each hit you take (an enemy hit always does at least 1).',
  charisma: 'Charisma: not used in fights. The most charming member of the clan opens the talking choices in quests.',
  hp: 'Health: more HP means you can take more hits before being knocked out.',
  sp: 'Skill points: the fuel for spells. More SP means more spells before you run dry.',
};
/** Plain labels for the stats shown on a member card. */
export const CARD_HELP: Record<string, string> = {
  hp: TRAIN_HELP.hp,
  attack: 'Attack is your strength: how hard you hit.',
  defence: 'Defence is your armour: how much damage you shrug off from each hit.',
  star: 'Your best stat. This is what this member is most about.',
  sp: TRAIN_HELP.sp,
};

/** What is worth training for each class (R = recommended). Armour and health are for the ones who stand at the front; dexterity for anyone who hits, as a miss does nothing however strong the arm; SP for anyone whose best hits are moves. */
export const CLASS_FOCUS: Record<string, string[]> = {
  Barbarian: ['strength', 'dexterity', 'armor', 'hp'],
  Warrior: ['strength', 'agility', 'dexterity'],
  'Martial Artist': ['agility', 'dexterity', 'sp'],
  Knight: ['strength', 'dexterity', 'armor', 'hp', 'charisma'],
  Assassin: ['dexterity', 'agility', 'sp'],
  Healer: ['wisdom', 'sp'],
  Sorcerer: ['wisdom', 'sp'],
  Necromancer: ['wisdom', 'sp'],
  Wizard: ['wisdom', 'sp', 'hp'],
  Pirate: ['agility', 'dexterity', 'strength', 'charisma', 'hp'],
  Samurai: ['agility', 'dexterity', 'strength', 'sp'],
};
export const isRecommended = (cls: string, key: string) => (CLASS_FOCUS[cls] ?? []).includes(key);
