import type { Gear, HeroClass, Master, Monster, SkillId } from './types';

/**
 * Dragon Maths: the numbers and names. Rules and shape follow Legend of the Red Dragon (as ported in
 * LORD.ts), rescaled for a 5-week season and for sums a 9-year-old can do. All names, writing and
 * stats here are our own; see docs/LORD-RULES.md for what we take from LORD and what we change.
 *
 * Everything is built from one "tier power" curve, so tuning the pace means changing a few
 * constants (checked with `npm run lord:sim`), not 300 numbers.
 */

export const MAX_LEVEL = 12;
export const FOREST_FIGHTS_PER_DAY = 10;
export const ARENA_FIGHTS_PER_DAY = 3;
export const SKILL_USES_PER_DAY = 3;
export const SEASON_DAYS = 35;
export const STARTING_GOLD = 50;
/** A weaker monster 1 time in this many (LORD: 1 in 6). */
export const WEAKER_ONE_IN = 6;
/** One trip in this many is an event instead of a fight (LORD: 1 in 5). Events don't use a forest fight. */
export const EVENT_ONE_IN = 5;
export const RUN_AWAY_CHANCE = 0.65;
/** Soft losing: you wake at the healer with this share of your HP. */
export const WAKE_UP_HP_SHARE = 0.3;
/** Selling old gear gives back this share of its price. */
export const SELL_BACK = 0.5;
/** Between dragon stages you get this share of your max HP back. */
export const DRAGON_BREATHER = 0.3;

/** How strong things should be at a level: 10, 15, 23, 34 ... 865. */
export const tierPower = (level: number) => Math.round(10 * Math.pow(1.5, level - 1));

/** Two significant figures, so prices read like 1,300 and not 1,297. */
export function friendly(n: number): number {
  if (n < 20) return Math.max(0, Math.round(n));
  const digits = Math.floor(Math.log10(n)) - 1;
  const step = Math.pow(10, digits);
  return Math.round(n / step) * step;
}

/** The hero's base stats on reaching a level (before gear). Level 1: 20 HP, 10 strength, 2 defence. */
export function baseStats(level: number) {
  const p = tierPower(level);
  return {
    maxHp: Math.round(p * 1.2) + 8,
    strength: Math.round(p * 0.4) + 6,
    defence: Math.round(p * 0.1) + 1,
  };
}

/** What a master gives when you beat them: the step up in base stats. */
export function levelUpGain(toLevel: number) {
  const a = baseStats(toLevel);
  const b = baseStats(toLevel - 1);
  return { maxHp: a.maxHp - b.maxHp, strength: a.strength - b.strength, defence: a.defence - b.defence };
}

// ---------- Monsters: ten per level (two lists, interleaved so they run weakest to strongest) ----------

type MonsterSketch = [name: string, intro: string];

const MONSTER_SKETCHES: MonsterSketch[][] = [
  [
    ['Mud Slug', 'It is slow, damp, and extremely sure of itself.'],
    ['Grumpy Goose', 'It honks. It has been honking since breakfast.'],
    ['Angry Squirrel', 'It wants its acorn back. You do not have its acorn.'],
    ['Rude Crow', 'It is calling you names in crow, which is mostly "CAW".'],
    ['Bog Frog', 'It is bigger than a frog should be, and it knows it.'],
  ],
  [
    ['Sneaky Kobold', 'It is trying to look like a stump. It is not a good stump.'],
    ['Stick Spider', 'Six of its eight legs are made of twigs. Nobody asked why.'],
    ['Gloomy Badger', 'It sighs. "Another hero. Of course."'],
    ['Tax Goblin', 'It claims the forest path is "for tax purposes".'],
    ['Mossy Imp', 'It giggles and throws a handful of damp moss.'],
  ],
  [
    ['Cave Bat', 'It swoops out of nowhere and squeaks very rudely.'],
    ['Thorn Hog', 'A hedgehog the size of a wheelbarrow. Every spike is pointed at you.'],
    ['Pebble Golem', 'It is a pile of rocks that has had enough of being a pile.'],
    ['Wasp Swarm', 'Thirty wasps, one plan, no manners.'],
    ['Cranky Troll Pup', 'It is only small. It is also extremely cranky.'],
  ],
  [
    ['Wolf Pup', 'Cute. Then it growls, and it is less cute.'],
    ['Bandit Trainee', 'The badge says "Apprentice Bandit". It is still wet from the ink.'],
    ['Fungus Fiend', 'It smells like a school bag left over the holidays.'],
    ['Giant Beetle', 'Its shell shines like a polished boot. It clicks at you.'],
    ['Hedge Witch', 'She cackles and drops her shopping list. It says "newts, newts, newts".'],
  ],
  [
    ['Grey Wolf', 'It circles, patient and clever.'],
    ['Ogre Cook', 'He is holding a very large spoon and a very small recipe.'],
    ['Skeleton Dancer', 'It rattles out a jig. You feel strangely rude interrupting.'],
    ['Bog Troll', 'It rises from the swamp holding a lily pad as a hat.'],
    ['Mirror Imp', 'It copies your pose. Then it copies your sword.'],
  ],
  [
    ['Forest Troll', 'It eats rocks for breakfast and complains about them.'],
    ['Dire Boar', 'It paws the ground. The ground looks worried.'],
    ['Shadow Cat', 'You only see its eyes, then its claws.'],
    ['Rock Gnasher', 'Crunch. Crunch. It is eating a boulder as if it were toast.'],
    ['Sock Wraith', 'It wails about every sock it ever lost. It is strangely sad.'],
  ],
  [
    ['Ogre Chief', 'He wears a crown made of a bucket. Nobody dares mention it.'],
    ['Stone Harpy', 'It shrieks, folds its wings and drops like a rock.'],
    ['Iron Beetle', 'It is armoured, angry, and apparently a beetle.'],
    ['Bramble Witch', 'The thorns around her feet are all pointing at you.'],
    ['Night Stalker', 'It was not there. Now it is. That is the whole trick.'],
  ],
  [
    ['Cave Troll', 'It lives in the dark and has opinions about that.'],
    ['Flame Imp', 'It lights a tiny fire in its palm. Then a bigger one.'],
    ['Gargoyle', 'It was a statue until you walked past.'],
    ['Venom Wyrm', 'A long green snake, with a long green temper.'],
    ['Knight of Rust', 'It creaks with every step and it is still scary.'],
  ],
  [
    ['Frost Giant', 'It sneezes and the trees grow icicles.'],
    ['Storm Hawk', 'The clouds follow it, and so does the thunder.'],
    ['Bone Colossus', 'Someone built it out of far too many skeletons.'],
    ['Lava Toad', 'It burps a puff of steam and a small fountain of sparks.'],
    ['Dread Knight', 'Its helmet is empty. It is still looking at you.'],
  ],
  [
    ['Hydra Pup', 'Three heads, and none of them agree on what to do.'],
    ['Thunder Ogre', 'Every stomp makes a small earthquake.'],
    ['Doom Spider', 'It is the size of a cart and it is unamused.'],
    ['Ember Drake', 'A small dragon. It would like you to know it is not THE dragon.'],
    ['Grave Lord', 'It rises from a grave, stretches and yawns.'],
  ],
  [
    ['Fire Giant', 'It warms its hands on a burning tree.'],
    ['Basalt Wyvern', 'Wings of black stone. It lands with a thud like a dropped piano.'],
    ['Plague Beast', 'Nobody wants to be near it. That is rather its point.'],
    ['Shadow Titan', 'It blots out the sun, and then the sky.'],
    ['Wyrm Queen', 'A snake the length of a river, and just as hard to cross.'],
  ],
  [
    ['Dragon Guard', 'Red scales, gold buckles. It guards the road to the lair.'],
    ['Cinder Colossus', 'It leaks sparks with every step.'],
    ['Elder Drake', 'It smells like a hot oven and old coins.'],
    ['Lair Warden', 'It has watched the dragon sleep for a hundred years.'],
    ['Scorch Knight', 'Its armour glows red hot. The grass dies under its feet.'],
  ],
];


/** The other five monsters of each level. Interleaved with the first five so each level has ten, weakest to strongest. */
const EXTRA_SKETCHES: MonsterSketch[][] = [
  [
    ['Hungry Hedgehog', 'It has been eating all morning and wants dessert. You look like dessert.'],
    ['Soggy Scarecrow', 'It lost its hat in the pond and blames you.'],
    ['Cheeky Magpie', 'It steals your shoelace, then looks very pleased.'],
    ['Puddle Imp', 'It jumps out of a puddle and splashes your boots on purpose.'],
    ['Fuzzy Caterpillar', 'It is very fuzzy and very, very determined.'],
  ],
  [
    ['Whiny Wisp', 'It floats about saying "it is not fair" in a tiny voice.'],
    ['Pinecone Pixie', 'It throws pinecones, and it is a lot better at it than you would like.'],
    ['Bramble Rat', 'It has a thorn for a sword and an opinion about everything.'],
    ['Burr Beast', 'It is covered in sticky burrs, and now so are you.'],
    ['Mudcrab', 'It scuttles sideways out of the swamp and waves both claws.'],
  ],
  [
    ['Bridge Troll', 'He wants a toll. The bridge is not even there any more.'],
    ['Thistle Sprite', 'It is small, green, spiky and in a terrible mood.'],
    ['Sneezing Bear', 'It has a cold. It would like to share it with you.'],
    ['Rabid Rabbit', 'It looks like a rabbit. It has the manners of a wolf.'],
    ['Shrieking Owl', 'Whoo? Whoo? It is shouting, and it is not a polite question.'],
  ],
  [
    ['Crow Chief', 'Twelve crows stand behind him. He is the only one who is allowed to talk.'],
    ['Stinky Skunk', 'You smell it before you see it. Then you really smell it.'],
    ['Swamp Hag', 'She stirs a pot of something green and tells you it is soup.'],
    ['Goblin Archer', 'The arrow has a feather on it and a note: "Sorry in advance".'],
    ['Tunnel Mole', 'It pops out of the ground right in front of your toes.'],
  ],
  [
    ['Lantern Ghost', 'A pale glow bobs through the trees. It is holding its own lantern.'],
    ['Rotting Stump', 'It was a stump. Now it has arms. Nobody asked it to.'],
    ['Giant Toad', 'It sits on a toadstool the size of a table and burps a very big burp.'],
    ['Bandit Captain', 'She has a feathered hat, a curved sword and a very long speech.'],
    ['Wolf Rider', 'A goblin on a wolf, both very sure of themselves.'],
  ],
  [
    ['Mud Giant', 'It rises out of the riverbank. It is made entirely of mud, and mood.'],
    ['Cave Spider Queen', 'She wears a crown made of her own silk. It is very good silk.'],
    ['Axe Ogre', 'He has one axe and zero patience.'],
    ['Ghoul Gardener', 'He digs, hums and plants things that should not be planted.'],
    ['Boulder Beetle', 'It rolls a rock the size of a barrel and aims it at you.'],
  ],
  [
    ['Wild Gryphon', 'Half eagle, half lion, all of it cross about something.'],
    ['Swamp Serpent', 'It slides out of the reeds with a hiss like a leaky kettle.'],
    ['Haunted Armour', 'The armour is empty. It is still marching straight at you.'],
    ['Troll Brute', 'It is a troll who has been to the gym.'],
    ['Dusk Banshee', 'It wails a long, high note. All the birds leave.'],
  ],
  [
    ['Ash Wolf', 'Grey as cinders, with embers in its fur. It does not like water.'],
    ['Obsidian Imp', 'It giggles. Where it stands the stones go black and shiny.'],
    ['Crypt Keeper', 'He has a very large ring of keys and nobody to open the doors for.'],
    ['Giant Scorpion', 'It clicks its claws in time, like a very bad drummer.'],
    ['Thorn Dragonling', 'A small dragon covered in thorns. It is still learning to breathe fire.'],
  ],
  [
    ['Mountain Troll', 'It lives in a cave, and it will tell you all about it.'],
    ['Ice Wraith', 'A cold gust, then a cold face in the gust.'],
    ['Snow Yeti', 'It has been waiting on this mountain for a very long time, and it is bored.'],
    ['Frozen Knight', 'It has been standing there since last winter. It is just thawing.'],
    ['Blizzard Owl', 'Its wings make the snow swirl. Its eyes make you swirl.'],
  ],
  [
    ['Cursed Minotaur', 'It has been lost in a maze for so long that it hates all mazes.'],
    ['Pit Fiend', 'It climbs out of a hole with a smile that does not reach its eyes.'],
    ['Lightning Wyvern', 'Every flap of its wings crackles. Your hair stands up.'],
    ['Mummy Lord', 'Bandaged from head to toe, it is unwinding itself slowly to scare you.'],
    ['Tomb Spider', 'It was asleep in a tomb for a thousand years. It is not rested.'],
  ],
  [
    ['Magma Golem', 'It drips hot rock with every step and leaves little footprints of fire.'],
    ['Smoke Dragonet', 'It coughs out a smoky ring, then looks very proud.'],
    ['Obsidian Giant', 'It is made of black glass. It is not at all careful where it steps.'],
    ['Death Wasp Queen', 'She is the size of a horse. Her hive is the size of a house.'],
    ['Forge Demon', 'It carries a red-hot hammer and a long list of grievances.'],
  ],
  [
    ['Dragon Cultist', 'The cultist chants the dragon\'s name and forgets the next bit.'],
    ['Lava Serpent', 'It swims through the lava as if it were a nice cool lake.'],
    ['Blackscale Guard', 'Black scales, red eyes, and a very stern way of standing.'],
    ['Ash Drake', 'Not THE dragon. Its cousin. It would like you to know that.'],
    ['Sunless Knight', 'Its armour is dark as a moonless night, and it stands in the road.'],
  ],
];

/** Alternate two lists: a0, b0, a1, b1 ... */
const interleave = <T,>(a: T[], b: T[]): T[] => a.flatMap((x, i) => (b[i] === undefined ? [x] : [x, b[i]]));

/** Variant 0 is the level's weakest monster and `count - 1` its strongest. The spread is the same however many there are. */
export function monsterStats(level: number, variant: number, count = 10) {
  const p = tierPower(level);
  const v = count > 1 ? (variant / (count - 1)) * 4 : 0;
  return {
    hp: friendly(p * (1.5 + 0.3 * v) + 4),
    strength: friendly(p * (0.26 + 0.04 * v) + 2),
    gold: friendly(p * (0.8 + 0.14 * v)),
    exp: friendly(p * (0.7 + 0.12 * v)),
  };
}

export const MONSTERS: Monster[][] = MONSTER_SKETCHES.map((first, i) => {
  const level = i + 1;
  const list = interleave(first, EXTRA_SKETCHES[i]);
  return list.map(([name, intro], v) => ({
    id: `l${level}-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    name,
    level,
    intro,
    ...monsterStats(level, v, list.length),
  }));
});

/** Every monster at a level, weakest first. */
export const monstersAt = (level: number): Monster[] => MONSTERS[Math.max(1, Math.min(MAX_LEVEL, level)) - 1];

// ---------- Experience: how much total exp you need to challenge the master for the next level ----------

/** Forest fights a steady pupil should need per level (about 1.5 play days). */
export const FIGHTS_PER_LEVEL = 14;

function averageExp(level: number) {
  const list = monstersAt(level);
  return list.reduce((s, m) => s + m.exp, 0) / list.length;
}

/** Total exp (never spent) needed to challenge the master who takes you from `level` to `level + 1`. */
export const EXP_TO_CHALLENGE: number[] = (() => {
  const out: number[] = [];
  let total = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    total += FIGHTS_PER_LEVEL * averageExp(level);
    out.push(friendly(total));
  }
  return out;
})();

export const expNeeded = (level: number): number => EXP_TO_CHALLENGE[level - 1] ?? Infinity;

// ---------- Masters: one for each step up, 2..12 ----------

const MASTER_SKETCHES: [name: string, intro: string][] = [
  ['Master Pip', 'A small, serious person with a very large stick.'],
  ['Dame Wren', 'She sharpens her sword and her tongue.'],
  ['Sir Tumble', 'He falls over a lot. He also never loses.'],
  ['Old Marrow', 'Nobody knows his age, only that he has beaten it.'],
  ['Madame Quill', 'She fights with a blade and a very long list of rules.'],
  ['Master Basalt', 'Hands like boulders and a voice like gravel.'],
  ['Lady Thistle', 'Her smile is sweet. Her sword is sharper.'],
  ['Captain Brisk', 'He has never once been late, and never once been beaten.'],
  ['Sage Ember', 'He warms his hands on a small flame he carries in his hat.'],
  ['Warden Stonefist', 'The gatekeeper of the last road. Nobody passes without a fight.'],
  ['High Master Orrin', 'The last master. After him, the dragon.'],
];

export const MASTERS: Master[] = MASTER_SKETCHES.map(([name, intro], i) => {
  const toLevel = i + 2;
  const p = tierPower(toLevel - 1);
  return {
    level: toLevel,
    name,
    intro,
    hp: friendly(p * 4.2 + 10),
    strength: friendly(p * 0.55 + 4),
    defence: friendly(p * 0.12),
  };
});

export const masterFor = (heroLevel: number): Master | undefined => MASTERS[heroLevel - 1];

// ---------- Shop: twelve weapons and twelve armours, about one for each level ----------

const WEAPON_NAMES = [
  'Wooden Stick', 'Rusty Dagger', 'Short Sword', 'Hand Axe', 'Iron Mace', 'Long Sword',
  'War Hammer', 'Steel Claymore', 'Silver Blade', 'Battle Axe', 'Dragonbone Sword', 'Sunforged Blade',
];
const ARMOUR_NAMES = [
  'Old Tunic', 'Leather Vest', 'Padded Jacket', 'Chain Shirt', 'Iron Helm and Vest', 'Scale Armour',
  'Steel Breastplate', 'Knight Plate', 'Silver Mail', 'Tower Shield and Plate', 'Dragonscale Armour', 'Sunforged Plate',
];

const gearTier = (index: number) => index + 1;

export const WEAPONS: Gear[] = WEAPON_NAMES.map((name, i) => ({
  name,
  cost: i === 0 ? 0 : friendly(tierPower(gearTier(i)) * 6),
  power: Math.max(2, Math.round(tierPower(gearTier(i)) * 0.6)),
  need: i === 0 ? 0 : baseStats(gearTier(i)).strength,
}));

export const ARMOURS: Gear[] = ARMOUR_NAMES.map((name, i) => ({
  name,
  cost: i === 0 ? 0 : friendly(tierPower(gearTier(i)) * 4),
  power: Math.max(1, Math.round(tierPower(gearTier(i)) * 0.2)),
  need: i === 0 ? 0 : baseStats(gearTier(i)).defence,
}));

// ---------- Classes ----------

export const CLASSES: Record<HeroClass, { name: string; blurb: string; skills: SkillId[] }> = {
  knight: { name: 'Knight', blurb: 'A mighty power strike that hits twice as hard.', skills: ['power-strike'] },
  mage: { name: 'Mage', blurb: 'Small spells: a zap that always hurts, and a mend that heals you.', skills: ['zap', 'mend'] },
  trickster: { name: 'Trickster', blurb: 'Dodge the next hit, or pinch a little gold from the monster.', skills: ['dodge', 'pinch'] },
};

export const SKILL_NAMES: Record<SkillId, string> = {
  'power-strike': 'Power strike',
  zap: 'Zap',
  mend: 'Mend',
  dodge: 'Dodge',
  pinch: 'Pinch',
};

// ---------- The Red Dragon: three stages, each its own monster, hero HP carries across ----------

export const DRAGON_STAGES: Monster[] = (() => {
  const p = tierPower(MAX_LEVEL);
  const stage = (n: number, name: string, intro: string, hpMul: number, strMul: number): Monster => ({
    id: `dragon-${n}`,
    name,
    level: MAX_LEVEL + 1,
    intro,
    hp: friendly(p * hpMul),
    strength: friendly(p * strMul),
    gold: n === 3 ? friendly(p * 40) : 0,
    exp: n === 3 ? friendly(p * 20) : 0,
  });
  return [
    stage(1, 'Scorchtail, the Red Dragon', 'The Red Dragon wakes. The cave floor is warm, and the village\'s stolen treasure is piled beneath it.', 3.05, 0.43),
    stage(2, 'Scorchtail, Roaring', 'It roars so loudly the stolen lanterns rattle. The Red Dragon is angry now.', 3.05, 0.51),
    stage(3, 'Scorchtail, Last Stand', 'One last great breath. Whoever wins this wins the village its light back.', 3.05, 0.59),
  ];
})();
