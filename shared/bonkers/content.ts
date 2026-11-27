/**
 * Smash Quest's names and words (docs/BONKERS-PLAN.md): the classes, zones, monsters, trainers, gear and quests. Kept
 * apart from the numbers (config.ts) so the words can change without touching the pace. Emoji are drawn stand-ins until
 * the bouncy-cartoon paintings (stage B.6).
 */

export const CLASSES = ['knight', 'dazzler', 'granny', 'ninja'] as const;
export type HeroClass = (typeof CLASSES)[number];

export const LOOKS = ['boy', 'girl', 'animal'] as const;
export type Look = (typeof LOOKS)[number];

export interface ClassInfo {
  id: HeroClass;
  name: string;
  /** A girl, boy and animal version of the class's name where it says who they are. */
  names: Record<Look, string>;
  animal: string;
  emoji: Record<Look, string>;
  colour: string;
  blurb: string;
  move: { name: string; does: string };
}

export const CLASS_INFO: Record<HeroClass, ClassInfo> = {
  knight: {
    id: 'knight', name: 'Kitchen Knight', names: { boy: 'Kitchen Knight', girl: 'Kitchen Knight', animal: 'Kitchen Knight Badger' },
    animal: 'badger', emoji: { boy: '🧑‍🍳', girl: '👩‍🍳', animal: '🦡' }, colour: '#e8833a',
    blurb: 'A saucepan helmet, a flowery apron and a very big rolling pin.',
    move: { name: 'Mighty Whack', does: 'Your next right answer hits three times as hard.' },
  },
  dazzler: {
    id: 'dazzler', name: 'Disco Dazzler', names: { boy: 'Disco Dazzler', girl: 'Disco Dazzler', animal: 'Disco Dazzler Flamingo' },
    animal: 'flamingo', emoji: { boy: '🕺', girl: '💃', animal: '🦩' }, colour: '#c04fd8',
    blurb: 'Sparkly cape, giant sunglasses and the dance moves of a legend.',
    move: { name: 'Dazzle Dance', does: 'The monster is so dazzled it can’t smash you this question, and a right answer hits harder.' },
  },
  granny: {
    id: 'granny', name: 'Pirate Granny', names: { boy: 'Pirate Grandad', girl: 'Pirate Granny', animal: 'Pirate Parrot' },
    animal: 'parrot', emoji: { boy: '👴', girl: '👵', animal: '🦜' }, colour: '#2f8fbf',
    blurb: 'An eye patch, two knitting needles and absolutely no fear.',
    move: { name: 'Wool Whirlwind', does: 'The monster is tied up in wool and can’t smash you for 2 questions.' },
  },
  ninja: {
    id: 'ninja', name: 'Bin Ninja', names: { boy: 'Bin Ninja', girl: 'Bin Ninja', animal: 'Bin Ninja Raccoon' },
    animal: 'raccoon', emoji: { boy: '🥷', girl: '🥷', animal: '🦝' }, colour: '#4a5a6a',
    blurb: 'A bin-lid shield, sneaky socks and a pocket full of banana peels.',
    move: { name: 'Banana Peel', does: 'The monster slips: a right answer hits twice as hard and you pinch 2 stickers.' },
  },
};

export const heroName = (cls: HeroClass, look: Look) => CLASS_INFO[cls].names[look];

export interface MonsterInfo {
  id: string;
  name: string;
  emoji: string;
  colour: string;
  /** What it says when it pops up. */
  line: string;
  /** What it says when it's bonked. */
  ouch: string;
}

export interface ZoneInfo {
  id: string;
  name: string;
  /** The hero level that opens this zone. */
  opens: number;
  sky: [string, string];
  ground: string;
  monsters: [MonsterInfo, MonsterInfo, MonsterInfo];
  big: MonsterInfo;
}

const m = (id: string, name: string, emoji: string, colour: string, line: string, ouch: string): MonsterInfo => ({ id, name, emoji, colour, line, ouch });

export const ZONES: ZoneInfo[] = [
  {
    id: 'laundry', name: 'Laundry Swamp', opens: 1, sky: ['#bfe8ff', '#e8f7ff'], ground: '#8fcf8a',
    monsters: [
      m('sock-goblin', 'Sock Goblin', '🧦', '#3fb0e8', 'It smells like a PE bag. It is proud of this.', 'My toes! My lovely holey toes!'),
      m('lint-monster', 'Lint Monster', '🌫️', '#a9a9c8', 'A fluffy grey blob. It has eaten 400 odd socks.', 'Fluff! Everywhere! Fluff!'),
      m('angry-pegs', 'Angry Pegs', '📎', '#f2c14e', 'Three clothes pegs who want to pinch your nose.', 'We’ll be back… on the line.'),
    ],
    big: m('odd-sock-king', 'The Odd Sock King', '👑', '#7a5cd6', 'He has one sock of every kind. He wants yours.', 'My kingdom… for a matching pair!'),
  },
  {
    id: 'custard', name: 'Custard Caves', opens: 2, sky: ['#ffe8a8', '#fff5d6'], ground: '#f2cf5a',
    monsters: [
      m('jelly-knight', 'Jelly Knight', '🍮', '#e8506a', 'It wobbles bravely. It wobbles a lot.', 'Wobble… wobble… flop.'),
      m('grumpy-teapot', 'Grumpy Teapot', '🫖', '#d9895a', 'It is short and stout and VERY cross.', 'Tip me over and pour me out!'),
      m('sprinkle-bat', 'Sprinkle Bat', '🦇', '#ff7ac8', 'It flaps about dropping hundreds and thousands.', 'Eeek! My sprinkles!'),
    ],
    big: m('custard-blob', 'Big Custard Blob', '🟡', '#f0b429', 'It is warm. It is lumpy. It is coming for you.', 'Glorp. Glorp. Glorp.'),
  },
  {
    id: 'bouncy', name: 'Bouncy Castle Ruins', opens: 3, sky: ['#c9d8ff', '#eef2ff'], ground: '#ff9fb0',
    monsters: [
      m('balloon-ogre', 'Balloon Ogre', '🎈', '#e84a4a', 'A huge ogre made of party balloons. It squeaks when it walks.', 'POP! Oh no, that was my arm.'),
      m('trampoline-troll', 'Trampoline Troll', '🤸', '#5ac85a', 'It boings at you from every direction.', 'Boing… boing… bonk.'),
      m('party-popper-imp', 'Party Popper Imp', '🎉', '#f28c28', 'It goes off at the worst possible moment.', 'Pff. Streamers everywhere.'),
    ],
    big: m('bouncy-dragon', 'The Bouncy Dragon', '🐉', '#3fbf8f', 'An inflatable dragon. Its roar is mostly wheezing.', 'Pssssssssssssss…'),
  },
  {
    id: 'supermarket', name: 'Supermarket of Doom', opens: 5, sky: ['#d6f5e3', '#f2fff7'], ground: '#c9c9c9',
    monsters: [
      m('trolley-beast', 'Trolley Beast', '🛒', '#8a9aaa', 'It has one wobbly wheel and a bad attitude.', 'Clatter! Clang! Squeak!'),
      m('shouty-banana', 'Shouty Banana', '🍌', '#f5d63c', 'IT ONLY KNOWS HOW TO SHOUT.', 'I’M… OKAY… THANKS.'),
      m('frozen-pea-swarm', 'Frozen Pea Swarm', '🫛', '#6ccf5c', 'Two hundred angry frozen peas, all at once.', 'We’re melting! Mushy!'),
    ],
    big: m('manager-of-mayhem', 'The Manager of Mayhem', '🧾', '#b84ad8', 'Clean-up on aisle you!', 'Store… closing… early…'),
  },
  {
    id: 'toiletroll', name: 'Toilet Roll Towers', opens: 6, sky: ['#e6dcff', '#f7f3ff'], ground: '#f2f2f2',
    monsters: [
      m('roll-mummy', 'Roll Mummy', '🧻', '#e8e0d0', 'It is wrapped in two-ply. It is very soft and very angry.', 'Unravelling… unravelling…'),
      m('bubble-bath-beast', 'Bubble Bath Beast', '🫧', '#8fd8ff', 'A giant blob of bubbles that smells of strawberries.', 'Pop… pop… pop… pop.'),
      m('rubber-duck-gang', 'Rubber Duck Gang', '🦆', '#ffd23c', 'Six squeaky ducks in tiny sunglasses.', 'SQUEAK! (that means sorry)'),
    ],
    big: m('plunger-pirate', 'The Plunger Pirate', '🪠', '#c43c3c', 'Arr! It sticks its plunger on everything.', 'Shloop! Unstuck!'),
  },
  {
    id: 'volcano', name: 'Volcano of Slight Annoyance', opens: 8, sky: ['#ffc9a8', '#ffe8da'], ground: '#c8643c',
    monsters: [
      m('toaster-dragon', 'Toaster Dragon', '🍞', '#e8a040', 'It breathes toast. Slightly burnt toast.', 'Ding! I’m done.'),
      m('lava-lamp', 'Lava Lamp', '🪔', '#ff5a8a', 'Groovy, gloopy and grumpy.', 'Bloop… bloop… switched off.'),
      m('hot-sauce-hydra', 'Hot Sauce Hydra', '🌶️', '#e83a2a', 'Three heads, all spicy, none polite.', 'Water! WATER!'),
    ],
    big: m('mild-dragon', 'The Dragon of Mild Inconvenience', '🐲', '#d84a3a', 'It’s not evil. It just keeps parking in your spot.', 'Fine. FINE. I’ll move.'),
  },
];

export const zoneById = (id: string) => ZONES.find((z) => z.id === id);
export const openZones = (level: number) => ZONES.filter((z) => z.opens <= level);

export interface TrainerInfo {
  /** The level you reach by beating them. */
  to: number;
  name: string;
  emoji: string;
  colour: string;
  line: string;
  beaten: string;
}

export const TRAINERS: TrainerInfo[] = [
  { to: 2, name: 'Coach Crumpet', emoji: '🥯', colour: '#d9a35a', line: 'Twenty laps of the duck pond! Or one fight with me.', beaten: 'Well buttered! You’re level 2!' },
  { to: 3, name: 'Sir Reginald the Very Tall Snail', emoji: '🐌', colour: '#7ac870', line: 'I shall defeat you… eventually. I am quite slow.', beaten: 'Most impressive. I’ll tell my shell.' },
  { to: 4, name: 'Madame Moustache', emoji: '🥸', colour: '#8a5a3a', line: 'My moustache has won forty duels!', beaten: 'Mon dieu! My moustache is shaking!' },
  { to: 5, name: 'Captain Custard', emoji: '🦸', colour: '#f2c14e', line: 'Nobody gets past Captain Custard!', beaten: 'Somebody got past Captain Custard.' },
  { to: 6, name: 'Professor Pickle', emoji: '🥒', colour: '#5aa83c', line: 'I have done the sums. You cannot win.', beaten: 'I must have carried the one wrong.' },
  { to: 7, name: 'The Great Gazebo', emoji: '⛺', colour: '#e85a8a', line: 'I am a garden tent. Fear my flapping!', beaten: 'Folded flat. Well done.' },
  { to: 8, name: 'Lady Lasagne', emoji: '🍝', colour: '#e8703a', line: 'Layer upon layer of pure power!', beaten: 'Delicious work, hero.' },
  { to: 9, name: 'Baron Von Bubblewrap', emoji: '🫧', colour: '#9ad8ff', line: 'Pop me if you can!', beaten: 'Pop… pop… pop… I’m out.' },
  { to: 10, name: 'King Kevin the Enormous Toddler', emoji: '👶', colour: '#ffb0c8', line: 'NO NAP! FIGHT!', beaten: 'Okay. Nap now. You’re level 10!' },
];

export const trainerFor = (level: number) => TRAINERS.find((t) => t.to === level + 1);

/** Gear: four slots, each with a ladder of ever sillier pieces. Power is what it adds to every right hit. */
export const SLOTS = ['weapon', 'shoes', 'cape', 'shield'] as const;
export type Slot = (typeof SLOTS)[number];

export interface GearInfo {
  id: string;
  slot: Slot;
  tier: number;
  name: string;
  emoji: string;
  power: number;
}

const GEAR_NAMES: Record<Slot, Array<[string, string]>> = {
  weapon: [['Wooden Spoon', '🥄'], ['Rolling Pin of Doom', '🪵'], ['Spaghetti Whip', '🍝'], ['Baguette Sword', '🥖'], ['Rubber Chicken of Justice', '🐔'], ['Fish Slapper', '🐟'], ['Pool Noodle of Power', '🌀']],
  shoes: [['Fluffy Slippers', '🥿'], ['Clown Shoes of Stomping', '🤡'], ['High Heels of Distraction', '👠'], ['Jet-Powered Slippers', '🚀'], ['Roller Skates of Speed', '🛼'], ['Moon Boots', '🌙'], ['Golden Gumboots', '🥾']],
  cape: [['Tea Towel', '🧣'], ['Bath Towel of Bravery', '🛁'], ['Shower Curtain Cape', '🚿'], ['Picnic Blanket', '🧺'], ['Bubble Wrap Cape', '🫧'], ['Sparkly Curtain Cape', '✨'], ['Superhero Duvet', '🛏️']],
  shield: [['Bin Lid', '🗑️'], ['Pizza Box Shield', '🍕'], ['Saucepan Shield', '🍳'], ['Giant Biscuit', '🍪'], ['Trampoline Shield', '🥏'], ['Umbrella of Fury', '☂️'], ['Disco Ball Shield', '🪩']],
};

const GEAR_POWER: Record<Slot, number> = { weapon: 2, shoes: 1, cape: 1, shield: 1 };

export const GEAR: GearInfo[] = SLOTS.flatMap((slot) =>
  GEAR_NAMES[slot].map(([name, emoji], tier) => ({ id: `${slot}-${tier}`, slot, tier, name, emoji, power: tier * GEAR_POWER[slot] })),
);

export const gearById = (id: string) => GEAR.find((g) => g.id === id);
export const TOP_TIER = GEAR_NAMES.weapon.length - 1;

/** Silly titles that come with each level. */
export const LEVEL_TITLES = ['', 'Brand New Hero', 'Puddle Splasher', 'Sock Botherer', 'Jelly Wobbler', 'Custard Champion', 'Trolley Tamer', 'Duck Defeater', 'Toast Master', 'Legend-ish', 'Smash Legend'];

/** The innkeeper. */
export const INNKEEPER = { name: 'Granny Jetpack', emoji: '👵🏼' };
