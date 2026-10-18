// GENERATED FILE: don't edit. Edit supabase/functions/lord/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "lord" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
//#region shared/maths/config.ts
/**
* Tuning numbers for the maths engine, in one place. Nothing here knows about any game.
*/
/** Times tables 1–12. */
const TABLES = [
	1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	11,
	12
];
/**
* The campaign's focus tables: each step adds tables, and the tables from earlier steps
* become review. Edit freely; levels not listed use the last step. `upTo` is the biggest
* number any fact uses in that step (default 12): the first levels stop at × 10 so they're
* super easy (James, 16 Oct 2026).
*
* The order follows the NZ Curriculum families (James, 18 Oct 2026): 2/5/10, then 3/4/8,
* then 6/9, then 7, then 11/12. It used to put ×8 with ×6 and ×7 with ×9. Level numbers are
* unchanged, so a student part-way through the old order keeps their level; the facts they
* already know are in their records, so they show up as review and the new tables as focus.
* Fact records are keyed by the fact ("mul:6x7"), not by the step, so none are lost.
*/
const CAMPAIGN_STEPS = [
	{
		levels: [1, 2],
		add: [
			2,
			5,
			10
		],
		upTo: 10
	},
	{
		levels: [3, 4],
		add: [
			3,
			4,
			8
		]
	},
	{
		levels: [5, 6],
		add: [6, 9]
	},
	{
		levels: [7, 8],
		add: [7]
	},
	{
		levels: [9, 10],
		add: [11, 12]
	}
];
/** Share of questions from the current focus tables, review of earlier tables, and stretch (next table up). */
const MIX = {
	focus: .6,
	review: .3,
	stretch: .1
};
/** Answering correctly within this many milliseconds counts as quick. */
const QUICK_MS = 5e3;
/** Mastery boxes 0–4 (Leitner). How likely each box is to be picked: lower boxes come up more. */
const BOX_WEIGHTS = [
	6,
	5,
	3,
	2,
	1
];
/** A fact answered wrongly comes back after this many other questions (a random number in this range). */
const REPEAT_AFTER = {
	min: 3,
	max: 6
};
const RUN_AWAY_CHANCE = .65;
/** Soft losing: you wake at the healer with this share of your HP. */
const WAKE_UP_HP_SHARE = .3;
/** Selling old gear gives back this share of its price. */
const SELL_BACK = .5;
/** Between dragon stages you get this share of your max HP back. */
const DRAGON_BREATHER = .3;
/** How strong things should be at a level: 10, 15, 23, 34 ... 865. */
const tierPower = (level) => Math.round(10 * Math.pow(1.5, level - 1));
/** Two significant figures, so prices read like 1,300 and not 1,297. */
function friendly(n) {
	if (n < 20) return Math.max(0, Math.round(n));
	const digits = Math.floor(Math.log10(n)) - 1;
	const step = Math.pow(10, digits);
	return Math.round(n / step) * step;
}
/** The hero's base stats on reaching a level (before gear). Level 1: 20 HP, 10 strength, 2 defence. */
function baseStats(level) {
	const p = tierPower(level);
	return {
		maxHp: Math.round(p * 1.2) + 8,
		strength: Math.round(p * .4) + 6,
		defence: Math.round(p * .1) + 1
	};
}
/** What a master gives when you beat them: the step up in base stats. */
function levelUpGain(toLevel) {
	const a = baseStats(toLevel);
	const b = baseStats(toLevel - 1);
	return {
		maxHp: a.maxHp - b.maxHp,
		strength: a.strength - b.strength,
		defence: a.defence - b.defence
	};
}
const MONSTER_SKETCHES = [
	[
		["Mud Slug", "It is slow, damp, and extremely sure of itself."],
		["Grumpy Goose", "It honks. It has been honking since breakfast."],
		["Angry Squirrel", "It wants its acorn back. You do not have its acorn."],
		["Rude Crow", "It is calling you names in crow, which is mostly \"CAW\"."],
		["Bog Frog", "It is bigger than a frog should be, and it knows it."]
	],
	[
		["Sneaky Kobold", "It is trying to look like a stump. It is not a good stump."],
		["Stick Spider", "Six of its eight legs are made of twigs. Nobody asked why."],
		["Gloomy Badger", "It sighs. \"Another hero. Of course.\""],
		["Tax Goblin", "It claims the forest path is \"for tax purposes\"."],
		["Mossy Imp", "It giggles and throws a handful of damp moss."]
	],
	[
		["Cave Bat", "It swoops out of nowhere and squeaks very rudely."],
		["Thorn Hog", "A hedgehog the size of a wheelbarrow. Every spike is pointed at you."],
		["Pebble Golem", "It is a pile of rocks that has had enough of being a pile."],
		["Wasp Swarm", "Thirty wasps, one plan, no manners."],
		["Cranky Troll Pup", "It is only small. It is also extremely cranky."]
	],
	[
		["Wolf Pup", "Cute. Then it growls, and it is less cute."],
		["Bandit Trainee", "The badge says \"Apprentice Bandit\". It is still wet from the ink."],
		["Fungus Fiend", "It smells like a school bag left over the holidays."],
		["Giant Beetle", "Its shell shines like a polished boot. It clicks at you."],
		["Hedge Witch", "She cackles and drops her shopping list. It says \"newts, newts, newts\"."]
	],
	[
		["Grey Wolf", "It circles, patient and clever."],
		["Ogre Cook", "He is holding a very large spoon and a very small recipe."],
		["Skeleton Dancer", "It rattles out a jig. You feel strangely rude interrupting."],
		["Bog Troll", "It rises from the swamp holding a lily pad as a hat."],
		["Mirror Imp", "It copies your pose. Then it copies your sword."]
	],
	[
		["Forest Troll", "It eats rocks for breakfast and complains about them."],
		["Dire Boar", "It paws the ground. The ground looks worried."],
		["Shadow Cat", "You only see its eyes, then its claws."],
		["Rock Gnasher", "Crunch. Crunch. It is eating a boulder as if it were toast."],
		["Sock Wraith", "It wails about every sock it ever lost. It is strangely sad."]
	],
	[
		["Ogre Chief", "He wears a crown made of a bucket. Nobody dares mention it."],
		["Stone Harpy", "It shrieks, folds its wings and drops like a rock."],
		["Iron Beetle", "It is armoured, angry, and apparently a beetle."],
		["Bramble Witch", "The thorns around her feet are all pointing at you."],
		["Night Stalker", "It was not there. Now it is. That is the whole trick."]
	],
	[
		["Cave Troll", "It lives in the dark and has opinions about that."],
		["Flame Imp", "It lights a tiny fire in its palm. Then a bigger one."],
		["Gargoyle", "It was a statue until you walked past."],
		["Venom Wyrm", "A long green snake, with a long green temper."],
		["Knight of Rust", "It creaks with every step and it is still scary."]
	],
	[
		["Frost Giant", "It sneezes and the trees grow icicles."],
		["Storm Hawk", "The clouds follow it, and so does the thunder."],
		["Bone Colossus", "Someone built it out of far too many skeletons."],
		["Lava Toad", "It burps a puff of steam and a small fountain of sparks."],
		["Dread Knight", "Its helmet is empty. It is still looking at you."]
	],
	[
		["Hydra Pup", "Three heads, and none of them agree on what to do."],
		["Thunder Ogre", "Every stomp makes a small earthquake."],
		["Doom Spider", "It is the size of a cart and it is unamused."],
		["Ember Drake", "A small dragon. It would like you to know it is not THE dragon."],
		["Grave Lord", "It rises from a grave, stretches and yawns."]
	],
	[
		["Fire Giant", "It warms its hands on a burning tree."],
		["Basalt Wyvern", "Wings of black stone. It lands with a thud like a dropped piano."],
		["Plague Beast", "Nobody wants to be near it. That is rather its point."],
		["Shadow Titan", "It blots out the sun, and then the sky."],
		["Wyrm Queen", "A snake the length of a river, and just as hard to cross."]
	],
	[
		["Dragon Guard", "Red scales, gold buckles. It guards the road to the lair."],
		["Cinder Colossus", "It leaks sparks with every step."],
		["Elder Drake", "It smells like a hot oven and old coins."],
		["Lair Warden", "It has watched the dragon sleep for a hundred years."],
		["Scorch Knight", "Its armour glows red hot. The grass dies under its feet."]
	]
];
/** The other five monsters of each level. Interleaved with the first five so each level has ten, weakest to strongest. */
const EXTRA_SKETCHES = [
	[
		["Hungry Hedgehog", "It has been eating all morning and wants dessert. You look like dessert."],
		["Soggy Scarecrow", "It lost its hat in the pond and blames you."],
		["Cheeky Magpie", "It steals your shoelace, then looks very pleased."],
		["Puddle Imp", "It jumps out of a puddle and splashes your boots on purpose."],
		["Fuzzy Caterpillar", "It is very fuzzy and very, very determined."]
	],
	[
		["Whiny Wisp", "It floats about saying \"it is not fair\" in a tiny voice."],
		["Pinecone Pixie", "It throws pinecones, and it is a lot better at it than you would like."],
		["Bramble Rat", "It has a thorn for a sword and an opinion about everything."],
		["Burr Beast", "It is covered in sticky burrs, and now so are you."],
		["Mudcrab", "It scuttles sideways out of the swamp and waves both claws."]
	],
	[
		["Bridge Troll", "He wants a toll. The bridge is not even there any more."],
		["Thistle Sprite", "It is small, green, spiky and in a terrible mood."],
		["Sneezing Bear", "It has a cold. It would like to share it with you."],
		["Rabid Rabbit", "It looks like a rabbit. It has the manners of a wolf."],
		["Shrieking Owl", "Whoo? Whoo? It is shouting, and it is not a polite question."]
	],
	[
		["Crow Chief", "Twelve crows stand behind him. He is the only one who is allowed to talk."],
		["Stinky Skunk", "You smell it before you see it. Then you really smell it."],
		["Swamp Hag", "She stirs a pot of something green and tells you it is soup."],
		["Goblin Archer", "The arrow has a feather on it and a note: \"Sorry in advance\"."],
		["Tunnel Mole", "It pops out of the ground right in front of your toes."]
	],
	[
		["Lantern Ghost", "A pale glow bobs through the trees. It is holding its own lantern."],
		["Rotting Stump", "It was a stump. Now it has arms. Nobody asked it to."],
		["Giant Toad", "It sits on a toadstool the size of a table and burps a very big burp."],
		["Bandit Captain", "She has a feathered hat, a curved sword and a very long speech."],
		["Wolf Rider", "A goblin on a wolf, both very sure of themselves."]
	],
	[
		["Mud Giant", "It rises out of the riverbank. It is made entirely of mud, and mood."],
		["Cave Spider Queen", "She wears a crown made of her own silk. It is very good silk."],
		["Axe Ogre", "He has one axe and zero patience."],
		["Ghoul Gardener", "He digs, hums and plants things that should not be planted."],
		["Boulder Beetle", "It rolls a rock the size of a barrel and aims it at you."]
	],
	[
		["Wild Gryphon", "Half eagle, half lion, all of it cross about something."],
		["Swamp Serpent", "It slides out of the reeds with a hiss like a leaky kettle."],
		["Haunted Armour", "The armour is empty. It is still marching straight at you."],
		["Troll Brute", "It is a troll who has been to the gym."],
		["Dusk Banshee", "It wails a long, high note. All the birds leave."]
	],
	[
		["Ash Wolf", "Grey as cinders, with embers in its fur. It does not like water."],
		["Obsidian Imp", "It giggles. Where it stands the stones go black and shiny."],
		["Crypt Keeper", "He has a very large ring of keys and nobody to open the doors for."],
		["Giant Scorpion", "It clicks its claws in time, like a very bad drummer."],
		["Thorn Dragonling", "A small dragon covered in thorns. It is still learning to breathe fire."]
	],
	[
		["Mountain Troll", "It lives in a cave, and it will tell you all about it."],
		["Ice Wraith", "A cold gust, then a cold face in the gust."],
		["Snow Yeti", "It has been waiting on this mountain for a very long time, and it is bored."],
		["Frozen Knight", "It has been standing there since last winter. It is just thawing."],
		["Blizzard Owl", "Its wings make the snow swirl. Its eyes make you swirl."]
	],
	[
		["Cursed Minotaur", "It has been lost in a maze for so long that it hates all mazes."],
		["Pit Fiend", "It climbs out of a hole with a smile that does not reach its eyes."],
		["Lightning Wyvern", "Every flap of its wings crackles. Your hair stands up."],
		["Mummy Lord", "Bandaged from head to toe, it is unwinding itself slowly to scare you."],
		["Tomb Spider", "It was asleep in a tomb for a thousand years. It is not rested."]
	],
	[
		["Magma Golem", "It drips hot rock with every step and leaves little footprints of fire."],
		["Smoke Dragonet", "It coughs out a smoky ring, then looks very proud."],
		["Obsidian Giant", "It is made of black glass. It is not at all careful where it steps."],
		["Death Wasp Queen", "She is the size of a horse. Her hive is the size of a house."],
		["Forge Demon", "It carries a red-hot hammer and a long list of grievances."]
	],
	[
		["Dragon Cultist", "The cultist chants the dragon's name and forgets the next bit."],
		["Lava Serpent", "It swims through the lava as if it were a nice cool lake."],
		["Blackscale Guard", "Black scales, red eyes, and a very stern way of standing."],
		["Ash Drake", "Not THE dragon. Its cousin. It would like you to know that."],
		["Sunless Knight", "Its armour is dark as a moonless night, and it stands in the road."]
	]
];
/** Alternate two lists: a0, b0, a1, b1 ... */
const interleave = (a, b) => a.flatMap((x, i) => b[i] === void 0 ? [x] : [x, b[i]]);
/** Variant 0 is the level's weakest monster and `count - 1` its strongest. The spread is the same however many there are. */
function monsterStats(level, variant, count = 10) {
	const p = tierPower(level);
	const v = count > 1 ? variant / (count - 1) * 4 : 0;
	return {
		hp: friendly(p * (1.5 + .3 * v) + 4),
		strength: friendly(p * (.26 + .04 * v) + 2),
		gold: friendly(p * (.8 + .14 * v)),
		exp: friendly(p * (.7 + .12 * v))
	};
}
const MONSTERS = MONSTER_SKETCHES.map((first, i) => {
	const level = i + 1;
	const list = interleave(first, EXTRA_SKETCHES[i]);
	return list.map(([name, intro], v) => ({
		id: `l${level}-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
		name,
		level,
		intro,
		...monsterStats(level, v, list.length)
	}));
});
/** Every monster at a level, weakest first. */
const monstersAt = (level) => MONSTERS[Math.max(1, Math.min(12, level)) - 1];
function averageExp(level) {
	const list = monstersAt(level);
	return list.reduce((s, m) => s + m.exp, 0) / list.length;
}
/** Total exp (never spent) needed to challenge the master who takes you from `level` to `level + 1`. */
const EXP_TO_CHALLENGE = (() => {
	const out = [];
	let total = 0;
	for (let level = 1; level < 12; level++) {
		total += 14 * averageExp(level);
		out.push(friendly(total));
	}
	return out;
})();
const expNeeded = (level) => EXP_TO_CHALLENGE[level - 1] ?? Infinity;
const MASTERS = [
	["Master Pip", "A small, serious person with a very large stick."],
	["Dame Wren", "She sharpens her sword and her tongue."],
	["Sir Tumble", "He falls over a lot. He also never loses."],
	["Old Marrow", "Nobody knows his age, only that he has beaten it."],
	["Madame Quill", "She fights with a blade and a very long list of rules."],
	["Master Basalt", "Hands like boulders and a voice like gravel."],
	["Lady Thistle", "Her smile is sweet. Her sword is sharper."],
	["Captain Brisk", "He has never once been late, and never once been beaten."],
	["Sage Ember", "He warms his hands on a small flame he carries in his hat."],
	["Warden Stonefist", "The gatekeeper of the last road. Nobody passes without a fight."],
	["High Master Orrin", "The last master. After him, the dragon."]
].map(([name, intro], i) => {
	const toLevel = i + 2;
	const p = tierPower(toLevel - 1);
	return {
		level: toLevel,
		name,
		intro,
		hp: friendly(p * 4.2 + 10),
		strength: friendly(p * .55 + 4),
		defence: friendly(p * .12)
	};
});
const masterFor = (heroLevel) => MASTERS[heroLevel - 1];
const WEAPON_NAMES = [
	"Wooden Stick",
	"Rusty Dagger",
	"Short Sword",
	"Hand Axe",
	"Iron Mace",
	"Long Sword",
	"War Hammer",
	"Steel Claymore",
	"Silver Blade",
	"Battle Axe",
	"Dragonbone Sword",
	"Sunforged Blade"
];
const ARMOUR_NAMES = [
	"Old Tunic",
	"Leather Vest",
	"Padded Jacket",
	"Chain Shirt",
	"Iron Helm and Vest",
	"Scale Armour",
	"Steel Breastplate",
	"Knight Plate",
	"Silver Mail",
	"Tower Shield and Plate",
	"Dragonscale Armour",
	"Sunforged Plate"
];
const gearTier = (index) => index + 1;
const WEAPONS = WEAPON_NAMES.map((name, i) => ({
	name,
	cost: i === 0 ? 0 : friendly(tierPower(gearTier(i)) * 6),
	power: Math.max(2, Math.round(tierPower(gearTier(i)) * .6)),
	need: i === 0 ? 0 : baseStats(gearTier(i)).strength
}));
const ARMOURS = ARMOUR_NAMES.map((name, i) => ({
	name,
	cost: i === 0 ? 0 : friendly(tierPower(gearTier(i)) * 4),
	power: Math.max(1, Math.round(tierPower(gearTier(i)) * .2)),
	need: i === 0 ? 0 : baseStats(gearTier(i)).defence
}));
const CLASSES = {
	knight: {
		name: "Knight",
		blurb: "A mighty power strike that hits twice as hard.",
		skills: ["power-strike"]
	},
	mage: {
		name: "Mage",
		blurb: "Small spells: a zap that always hurts, and a mend that heals you.",
		skills: ["zap", "mend"]
	},
	trickster: {
		name: "Trickster",
		blurb: "Dodge the next hit, or pinch a little gold from the monster.",
		skills: ["dodge", "pinch"]
	}
};
const DRAGON_STAGES = (() => {
	const p = tierPower(12);
	const stage = (n, name, intro, hpMul, strMul) => ({
		id: `dragon-${n}`,
		name,
		level: 13,
		intro,
		hp: friendly(p * hpMul),
		strength: friendly(p * strMul),
		gold: n === 3 ? friendly(p * 40) : 0,
		exp: n === 3 ? friendly(p * 20) : 0
	});
	return [
		stage(1, "Scorchtail, the Red Dragon", "The Red Dragon wakes. The cave floor is warm, and the village's stolen treasure is piled beneath it.", 3.05, .43),
		stage(2, "Scorchtail, Roaring", "It roars so loudly the stolen lanterns rattle. The Red Dragon is angry now.", 3.05, .51),
		stage(3, "Scorchtail, Last Stand", "One last great breath. Whoever wins this wins the village its light back.", 3.05, .59)
	];
})();
//#endregion
//#region shared/lord/events.ts
/**
* Forest events, as data, not code (LORD's scripted events work the same way), so going from a
* dozen to fifty is writing work. A maths event's text only sets the scene: the question itself comes from a shared maths pack, so the text must not state numbers. Events never use up a forest fight. The ones with `maths` become
* a question on the screen (L.2): the reward is paid only for a right answer, and a wrong answer
* shows the worked solution and costs nothing. Events with no maths are just luck and jokes.
*/
const EVENTS = [
	{
		id: "lost-purse",
		title: "A lost purse",
		text: "Under a bush: a purse. Someone has very kindly lost it for you.",
		gold: 25
	},
	{
		id: "fairy",
		title: "The fairy",
		text: "A fairy tumbles out of a flower and sneezes. Magic dust settles over you, and your aches float away.",
		heal: "full"
	},
	{
		id: "rubbish-map",
		title: "The treasure map",
		text: "A treasure map! It is a very detailed map of the village rubbish tip. You keep it anyway.",
		exp: 5
	},
	{
		id: "old-man",
		title: "The old man's cart",
		text: "An old man's cart is stuck in the mud. You push. He gives you a little gold and a lot of thanks.",
		gold: 15,
		kindness: 1
	},
	{
		id: "sleeping-bear",
		title: "The sleeping bear",
		text: "A huge bear is snoring in the path. You tiptoe round it. The bear dreams about honey and does not notice.",
		exp: 10
	},
	{
		id: "gem-glint",
		title: "Something shiny",
		text: "A glint in the stream. A gem! A real one, and only slightly chewed by a fish.",
		gems: 1
	},
	{
		id: "echo",
		title: "The shouting hill",
		text: "You shout \"HELLO!\" from the top of the hill. The hill shouts back \"HELLO!\" and then, a moment later, \"WHO ARE YOU?\"",
		exp: 5
	},
	{
		id: "treasure-piles",
		title: "The treasure piles",
		text: "Two chests sit side by side, each stamped with a number of coins. A sign says: \"Only those who can read numbers may open the chests.\"",
		maths: {
			topic: "place-value",
			reward: { gold: 40 }
		}
	},
	{
		id: "old-woman-riddle",
		title: "The old woman's riddle",
		text: "An old woman on a stump cackles: \"Answer my riddle, hero, and I will pay you well!\"",
		maths: {
			topic: "patterns",
			reward: {
				gold: 30,
				exp: 10
			}
		}
	},
	{
		id: "gem-goblins",
		title: "The gem-sharing goblins",
		text: "Some goblins have found a heap of gems and are having one huge argument about who gets what. They want a hero to settle it with a sum.",
		maths: {
			topic: "division",
			reward: {
				exp: 20,
				gold: 10
			}
		}
	},
	{
		id: "honest-pedlar",
		title: "The honest pedlar",
		text: "A pedlar waves a pie under your nose. \"Bargain!\" he says. You count your gold carefully, because pedlars are good at sums, too.",
		maths: {
			topic: "money",
			reward: { gold: 15 }
		}
	},
	{
		id: "singing-frog",
		title: "The singing frog",
		text: "A frog on a log is singing very badly. You clap politely. It bows, and drops a coin from its hat.",
		gold: 10
	},
	{
		id: "friendly-troll",
		title: "The friendly troll",
		text: "A big troll blocks the path. You hold your breath. He just wants to know where the nearest bakery is. You point. He cries with joy.",
		kindness: 1,
		exp: 8
	},
	{
		id: "mushroom-ring",
		title: "The mushroom ring",
		text: "You step into a ring of mushrooms. They hum a soft tune and you feel better already.",
		heal: .5
	},
	{
		id: "lost-lamb",
		title: "The lost lamb",
		text: "A little lamb is stuck in a bramble bush. You free it, and it follows you home before a farmer thanks you with a coin.",
		gold: 12,
		kindness: 1
	},
	{
		id: "pie-cart",
		title: "The pie cart",
		text: "A cart with a very hot pie sits by the road. There is no one in sight, only a sign: \"Help yourself, and tell no one.\" You do, and feel much better.",
		heal: .25
	},
	{
		id: "woodcutter",
		title: "The woodcutter",
		text: "A woodcutter has locked himself out of his own hut. You lift the latch with a twig. He pays you in firewood and a little coin.",
		gold: 18,
		kindness: 1
	},
	{
		id: "shooting-star",
		title: "The shooting star",
		text: "A shooting star falls into the stream with a small, polite plop. You fish it out. It is a gem now.",
		gems: 1
	},
	{
		id: "echo-cave",
		title: "The echo cave",
		text: "You shout your name into a cave. A voice replies with a different, much better name for you.",
		exp: 6
	},
	{
		id: "wishing-well",
		title: "The wishing well",
		text: "You toss in a coin and wish for a better sword. Something in the well mutters \"we will see\". Then, a few moments later, it gives you back two coins.",
		gold: 16
	},
	{
		id: "wise-owl",
		title: "The wise owl",
		text: "An owl on a branch gives you a long look and a short piece of advice: \"Duck.\"",
		exp: 12
	},
	{
		id: "bridge-toll",
		title: "The bridge toll",
		text: "A grumpy goblin sits by a wobbly bridge with a tin cup. \"Toll!\" he squeaks. He takes payment in coins, but only if you can count them out correctly.",
		maths: {
			topic: "money",
			reward: { gold: 25 }
		}
	},
	{
		id: "stepping-stones",
		title: "The stepping stones",
		text: "A river crosses the path. The stones across it are all marked with numbers. Step on the wrong one and it wobbles. The right ones follow a pattern.",
		maths: {
			topic: "patterns",
			reward: {
				gold: 20,
				exp: 10
			}
		}
	},
	{
		id: "baker-ovens",
		title: "The baker's ovens",
		text: "A baker is in a flap. Her ovens have all been loaded with trays, and she needs the total number of buns, quickly. \"Help, and I will give you a bun!\" She is not good at sums.",
		maths: {
			topic: "times-tables",
			reward: {
				gold: 20,
				exp: 10
			}
		}
	},
	{
		id: "goblin-market",
		title: "The goblin market",
		text: "A goblin market has popped up in a clearing. Every stall has a price and a sum, and the goblins will not let you pass without doing one.",
		maths: {
			topic: "add-sub",
			reward: { gold: 25 }
		}
	},
	{
		id: "cake-fairies",
		title: "The cake fairies",
		text: "Two fairies have baked one enormous cake and cannot agree how to cut it. They need a hero who understands fractions. They offer a gem for the right answer.",
		maths: {
			topic: "fractions",
			reward: {
				gems: 1,
				exp: 10
			}
		}
	},
	{
		id: "merchant-scales",
		title: "The merchant's scales",
		text: "A travelling merchant is weighing out spice on a pair of scales and is sure he is being cheated. He has the numbers, but he cannot read them. He pays for a helping hand.",
		maths: {
			topic: "decimals",
			reward: {
				gold: 25,
				exp: 10
			}
		}
	},
	{
		id: "sleeping-giant",
		title: "The sleeping giant's puzzle",
		text: "A giant dozes beside a chest with a number lock. A sign reads: \"To open, you must know your places.\" The chest looks well stocked.",
		maths: {
			topic: "place-value",
			reward: { gold: 30 }
		}
	}
];
/**
* The events the forest may find when the teacher has some topics off: a maths event about a switched-off topic is
* left out (the rest of the forest is unchanged, and there are always events with no maths in them).
*/
const eventsOn = (on) => EVENTS.filter((e) => !e.maths || on.includes(e.maths.topic));
const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
//#endregion
//#region shared/lord/engine.ts
/** mulberry32. Returns the random number and the new state. */
function nextRandom(state) {
	const next = state + 1831565813 >>> 0;
	let t = next;
	t = Math.imul(t ^ t >>> 15, t | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	return [((t ^ t >>> 14) >>> 0) / 4294967296, next];
}
/** A plain random function from a seed (for picking a trip, or in tests). */
function makeRandom(seed) {
	let state = seed >>> 0;
	return () => {
		const [value, next] = nextRandom(state);
		state = next;
		return value;
	};
}
const pick = (rand, list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
function newHero(heroClass, today, previous) {
	const base = baseStats(1);
	return {
		level: 1,
		exp: 0,
		hp: base.maxHp,
		maxHp: base.maxHp,
		strength: base.strength,
		defence: base.defence,
		gold: 50,
		bank: 0,
		gems: 0,
		kindness: 0,
		weapon: 0,
		armour: 0,
		heroClass,
		dragonKills: previous?.dragonKills ?? 0,
		day: today,
		forestLeft: 10,
		arenaLeft: 3,
		skillLeft: 3,
		masterTried: false,
		forestWins: 0,
		arenaWins: 0,
		masterWins: 0
	};
}
const heroAttack = (h) => h.strength + WEAPONS[h.weapon].power;
const heroDefence = (h) => h.defence + ARMOURS[h.armour].power;
/** Today's date in New Zealand, as YYYY-MM-DD. The server's clock, not the browser's. */
function nzDate(now) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Pacific/Auckland",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(now);
}
/**
* The first play of a new day gives back the day's turns and full health. Forest fights you didn't use pile up for
* the days you missed, but never past two days' worth (a pupil who plays twice a week gets a double day), and a missed
* day saves up one extra master try. Arena fights and skills don't pile up. Called by the server at the start of every request, so nothing
* has to run at midnight.
*/
function rollDay(hero, today, forestPerDay = 10) {
	if (hero.day === today) return hero;
	const gone = Math.max(1, dayNumber$1(today) - dayNumber$1(hero.day || today));
	const kept = Math.max(0, hero.forestLeft);
	return {
		...hero,
		day: today,
		forestLeft: Math.min(forestPerDay * 2, kept + forestPerDay * gone),
		arenaLeft: 3,
		skillLeft: 3,
		masterTried: false,
		hp: hero.maxHp,
		masterExtra: Math.min(2, (hero.masterExtra ?? 0) + Math.max(0, gone - 1))
	};
}
const dayNumber$1 = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 864e5);
function seasonOf(seasonOneStart, today) {
	const days = dayNumber$1(today) - dayNumber$1(seasonOneStart);
	if (days < 0) return {
		number: 0,
		dayOfSeason: 0,
		daysLeft: -days,
		started: false
	};
	const number = Math.floor(days / 35) + 1;
	const dayOfSeason = days % 35 + 1;
	return {
		number,
		dayOfSeason,
		daysLeft: 35 - dayOfSeason,
		started: true
	};
}
/** Picks what a trip into the forest finds. The same seed always finds the same thing. */
function forestTrip(hero, seed, events = EVENTS) {
	const rand = makeRandom(seed);
	if (events.length > 0 && Math.floor(rand() * 5) === 0) return {
		kind: "event",
		event: pick(rand, events)
	};
	const weaker = hero.level > 1 && Math.floor(rand() * 6) === 0;
	return {
		kind: "fight",
		monster: pick(rand, monstersAt(weaker ? hero.level - 1 : hero.level)),
		seed: Math.floor(rand() * 4294967296)
	};
}
function applyEvent(hero, event, mathsRight = false) {
	const scale = tierPower(hero.level) / 10;
	const scaled = (n = 0) => friendly(n * scale);
	const next = { ...hero };
	next.gold += scaled(event.gold);
	next.exp += scaled(event.exp);
	next.gems += event.gems ?? 0;
	next.kindness += event.kindness ?? 0;
	if (event.heal === "full") next.hp = next.maxHp;
	else if (typeof event.heal === "number") next.hp = Math.min(next.maxHp, next.hp + Math.ceil(next.maxHp * event.heal));
	if (event.maths && mathsRight) {
		next.gold += scaled(event.maths.reward.gold);
		next.exp += scaled(event.maths.reward.exp);
		next.gems += event.maths.reward.gems ?? 0;
	}
	return next;
}
/** LORD's damage: a random half of your strength, plus the other half. */
function damageRoll(attack, rand) {
	const half = Math.floor(attack / 2);
	return half + Math.floor(rand() * (half + 1));
}
function startFight(hero, monster, seed, options = {}) {
	return {
		monster,
		monsterHp: monster.hp,
		heroHp: options.heroHp ?? hero.hp,
		kind: options.kind ?? "forest",
		heroClass: hero.heroClass,
		heroAttack: heroAttack(hero),
		heroDefence: heroDefence(hero),
		heroMaxHp: hero.maxHp,
		round: 0,
		firstHitBonus: options.firstHitBonus ?? 1,
		shield: options.shield ?? 0,
		dodging: false,
		skillLeft: hero.skillLeft,
		goldPinched: 0,
		rng: seed >>> 0,
		over: false,
		outcome: null,
		log: []
	};
}
const canRun = (fight) => fight.kind === "forest";
function skillsFor(heroClass) {
	return CLASSES[heroClass].skills;
}
/** Plays one round: the hero acts, then the monster hits back. Pure: returns a new state. */
function stepFight(fight, action) {
	if (fight.over) throw new Error("This fight is over");
	let rng = fight.rng;
	const rand = () => {
		const [value, next] = nextRandom(rng);
		rng = next;
		return value;
	};
	const f = {
		...fight,
		log: []
	};
	f.round += 1;
	const log = f.log;
	let monsterActs = true;
	const hitMonster = (damage, crit = false) => {
		f.monsterHp = Math.max(0, f.monsterHp - damage);
		log.push({
			type: "hero-hit",
			damage,
			crit
		});
	};
	const bonus = f.round === 1 ? f.firstHitBonus : 1;
	if (action.type === "attack") hitMonster(Math.max(1, Math.round(damageRoll(f.heroAttack, rand) * bonus)));
	else if (action.type === "run") {
		if (!canRun(f)) throw new Error("You cannot run from this fight");
		const success = rand() < RUN_AWAY_CHANCE;
		log.push({
			type: "ran",
			success
		});
		if (success) {
			f.over = true;
			f.outcome = "fled";
			monsterActs = false;
		}
	} else {
		if (!skillsFor(f.heroClass).includes(action.skill)) throw new Error("Your class cannot do that");
		if (f.skillLeft <= 0) throw new Error("No skill uses left today");
		if (action.skill === "pinch" && f.goldPinched > 0) throw new Error("You already pinched this monster");
		f.skillLeft -= 1;
		switch (action.skill) {
			case "power-strike": {
				const damage = Math.max(1, Math.round(damageRoll(f.heroAttack, rand) * 2 * bonus));
				hitMonster(damage, true);
				log.push({
					type: "skill",
					skill: "power-strike",
					amount: damage
				});
				break;
			}
			case "zap": {
				const damage = Math.max(1, Math.round(f.heroAttack * 1.5 * bonus));
				hitMonster(damage);
				log.push({
					type: "skill",
					skill: "zap",
					amount: damage
				});
				break;
			}
			case "mend": {
				const healed = Math.min(f.heroMaxHp - f.heroHp, Math.ceil(f.heroMaxHp * .25));
				f.heroHp += healed;
				log.push({
					type: "skill",
					skill: "mend",
					amount: healed
				});
				break;
			}
			case "dodge":
				f.dodging = true;
				log.push({
					type: "skill",
					skill: "dodge",
					amount: 0
				});
				hitMonster(Math.max(1, Math.round(damageRoll(f.heroAttack, rand) * bonus)));
				break;
			case "pinch":
				f.goldPinched = Math.max(1, Math.floor(f.monster.gold / 4));
				log.push({
					type: "skill",
					skill: "pinch",
					amount: f.goldPinched
				});
				hitMonster(Math.max(1, Math.round(damageRoll(f.heroAttack, rand) * bonus)));
		}
	}
	if (!f.over && f.monsterHp <= 0) {
		f.over = true;
		f.outcome = "won";
		monsterActs = false;
	}
	if (monsterActs && !f.over) {
		if (f.dodging) {
			f.dodging = false;
			log.push({ type: "monster-missed" });
		} else {
			const raw = damageRoll(f.monster.strength, rand);
			const blocked = Math.floor(rand() * (f.heroDefence + 1)) + f.shield;
			const damage = Math.max(0, raw - blocked);
			f.heroHp = Math.max(0, f.heroHp - damage);
			log.push({
				type: "monster-hit",
				damage,
				blocked: Math.min(raw, blocked)
			});
			if (f.heroHp <= 0) {
				f.over = true;
				f.outcome = "lost";
			}
		}
	}
	if (f.over && f.outcome) log.push({
		type: "end",
		outcome: f.outcome
	});
	f.rng = rng;
	return f;
}
/** Plays a saved list of actions from the start. This is what the server does to check a fight. */
function replayFight(start, actions) {
	let fight = start;
	for (const action of actions) {
		if (fight.over) throw new Error("Too many actions: the fight was already over");
		fight = stepFight(fight, action);
	}
	return fight;
}
/** What a finished fight does to the hero. Master and dragon fights are handled by their own functions. */
function applyForestResult(hero, fight) {
	if (!fight.over) throw new Error("The fight is not finished");
	const next = {
		...hero,
		skillLeft: fight.skillLeft
	};
	if (fight.outcome === "won") {
		next.hp = fight.heroHp;
		next.gold += fight.monster.gold + fight.goldPinched;
		next.exp += fight.monster.exp;
		next.forestWins += 1;
	} else if (fight.outcome === "lost") {
		next.gold = 0;
		next.hp = Math.max(1, Math.ceil(hero.maxHp * WAKE_UP_HP_SHARE));
	} else next.hp = fight.heroHp;
	return next;
}
/** The forest-fight turn is taken when the fight is handed out, so closing the tab does not give it back. */
const useForestTurn = (hero) => {
	if (hero.forestLeft <= 0) throw new Error("No forest fights left today");
	return {
		...hero,
		forestLeft: hero.forestLeft - 1
	};
};
function canChallengeMaster(hero) {
	if (hero.level >= 12) return {
		ok: false,
		reason: "You have beaten every master. The dragon is next!"
	};
	if (hero.masterTried) return {
		ok: false,
		reason: "You already challenged your master today. Come back tomorrow."
	};
	const need = expNeeded(hero.level);
	if (hero.exp < need) return {
		ok: false,
		reason: `You need ${need - hero.exp} more experience before your master will fight you.`
	};
	return { ok: true };
}
function startMasterFight(hero, seed, options = {}) {
	const check = canChallengeMaster(hero);
	if (!check.ok) throw new Error(check.reason);
	const master = masterFor(hero.level);
	return startFight(hero, {
		id: `master-${master.level}`,
		name: master.name,
		level: master.level,
		hp: master.hp,
		strength: master.strength,
		gold: 0,
		exp: 0,
		intro: master.intro
	}, seed, {
		...options,
		kind: "master"
	});
}
/** Beat your master and you go up a level, a bit stronger, fully healed. Lose and nothing is lost: you are just healed. */
function applyMasterResult(hero, fight) {
	if (!fight.over) throw new Error("The fight is not finished");
	const extra = hero.masterExtra ?? 0;
	const next = {
		...hero,
		masterTried: extra <= 0,
		masterExtra: Math.max(0, extra - 1),
		skillLeft: fight.skillLeft
	};
	if (fight.outcome === "won") {
		const gain = levelUpGain(hero.level + 1);
		next.level += 1;
		next.maxHp += gain.maxHp;
		next.strength += gain.strength;
		next.defence += gain.defence;
		next.masterWins += 1;
	}
	next.hp = next.maxHp;
	return next;
}
function canFaceDragon(hero) {
	return hero.level >= 12 && hero.exp >= expNeeded(11);
}
/** A dragon stage, 1 to 3. Pass the hero's HP from the stage before. */
function startDragonStage(hero, stage, seed, options = {}) {
	if (!canFaceDragon(hero)) throw new Error("You are not ready for the dragon yet");
	return startFight(hero, DRAGON_STAGES[stage - 1], seed, {
		...options,
		kind: "dragon"
	});
}
/** Between dragon stages the dragon pauses to roar and you catch your breath: a share of your HP comes back. */
function dragonBreather(hero, hp) {
	return Math.min(hero.maxHp, hp + Math.ceil(hero.maxHp * DRAGON_BREATHER));
}
/** Win all three stages: a star, and your hero starts again at level 1 (class and stars are kept). */
function finishDragon(hero, today) {
	return newHero(hero.heroClass, today, { dragonKills: hero.dragonKills + 1 });
}
/** Lose to the dragon: you wake at the healer, nothing lost but a day's try. */
function loseToDragon(hero) {
	return {
		...hero,
		hp: Math.max(1, Math.ceil(hero.maxHp * WAKE_UP_HP_SHARE))
	};
}
/** Gold per HP at the healer. */
const healPrice = (level) => Math.max(1, Math.round(level * .25));
function healCost(hero, hp, discount = 0) {
	return Math.ceil(hp * healPrice(hero.level) * (1 - discount));
}
/** Heal up to `hp` points, as many as you can afford. `discount` is 0.1 after a right answer. */
function heal(hero, hp, discount = 0) {
	const missing = hero.maxHp - hero.hp;
	let n = Math.max(0, Math.min(hp, missing));
	while (n > 0 && healCost(hero, n, discount) > hero.gold) n -= 1;
	return {
		...hero,
		hp: hero.hp + n,
		gold: hero.gold - healCost(hero, n, discount)
	};
}
function deposit(hero, amount) {
	const n = Math.max(0, Math.min(Math.floor(amount), hero.gold));
	return {
		...hero,
		gold: hero.gold - n,
		bank: hero.bank + n
	};
}
function withdraw(hero, amount) {
	const n = Math.max(0, Math.min(Math.floor(amount), hero.bank));
	return {
		...hero,
		gold: hero.gold + n,
		bank: hero.bank - n
	};
}
/** 1% off for every point of Kindness, up to 10%. */
const kindnessDiscount = (hero) => Math.min(.1, hero.kindness * .01);
function shopPrice(hero, cost, extraDiscount = 0) {
	return Math.ceil(cost * (1 - kindnessDiscount(hero)) * (1 - extraDiscount));
}
/**
* Buy a weapon or armour. Your old one is sold back for half its price first, then you pay, so
* saved-up gold can't skip half the game: the best gear needs enough strength or defence (LORD's rule).
*/
function buyGear(hero, slot, index, extraDiscount = 0) {
	const table = slot === "weapon" ? WEAPONS : ARMOURS;
	const item = table[index];
	if (!item || index === 0) return {
		ok: false,
		reason: "The shop does not sell that."
	};
	if (index <= hero[slot]) return {
		ok: false,
		reason: "That is no better than what you have."
	};
	if ((slot === "weapon" ? hero.strength : hero.defence) < item.need) return {
		ok: false,
		reason: `You need ${item.need} base ${slot === "weapon" ? "strength" : "defence"} to use that. Beat your next master first.`
	};
	const refund = Math.floor(table[hero[slot]].cost * SELL_BACK);
	const paid = shopPrice(hero, item.cost, extraDiscount);
	if (hero.gold + refund < paid) return {
		ok: false,
		reason: `You need ${paid - refund - hero.gold} more gold (after selling your old one).`
	};
	return {
		ok: true,
		hero: {
			...hero,
			[slot]: index,
			gold: hero.gold + refund - paid
		},
		paid,
		refund
	};
}
/** The round each side uses its class move. */
const MOVE_ROUND = 2;
const duelistOf = (hero, name) => ({
	name,
	heroClass: hero.heroClass,
	level: hero.level,
	attack: heroAttack(hero),
	defence: heroDefence(hero),
	maxHp: hero.maxHp
});
/**
* An arena duel. Both heroes start at full health and take turns (a first, then b) for up to 30 rounds. A hit is
* LORD's damage roll minus a random 0 to the other hero's defence (in player fights defence counts on both sides),
* and always at least 1. In round 2 each hero uses its class move once, for free: a Knight's power strike (double),
* a Mage's zap (1.5 × attack, no roll) or a Trickster's dodge (the next hit misses). Pure and seeded, so the very
* same duel can be played again from the same two heroes and the same seed.
*/
function playDuel(a, b, seed) {
	let rng = seed >>> 0;
	const rand = () => {
		const [value, next] = nextRandom(rng);
		rng = next;
		return value;
	};
	const hp = {
		a: a.maxHp,
		b: b.maxHp
	};
	const side = {
		a,
		b
	};
	const dodging = {
		a: false,
		b: false
	};
	const log = [];
	let rounds = 0;
	const strike = (who) => {
		const us = side[who];
		const other = who === "a" ? "b" : "a";
		const them = side[other];
		if (dodging[other]) {
			dodging[other] = false;
			log.push({
				who,
				type: "miss"
			});
			return;
		}
		let move;
		let raw;
		if (rounds === MOVE_ROUND && us.heroClass === "knight") {
			move = "power-strike";
			raw = damageRoll(us.attack, rand) * 2;
		} else if (rounds === MOVE_ROUND && us.heroClass === "mage") {
			move = "zap";
			raw = Math.round(us.attack * 1.5);
		} else {
			raw = damageRoll(us.attack, rand);
			if (rounds === MOVE_ROUND && us.heroClass === "trickster") {
				move = "dodge";
				dodging[who] = true;
			}
		}
		const damage = Math.max(1, raw - Math.floor(rand() * (them.defence + 1)));
		hp[other] = Math.max(0, hp[other] - damage);
		log.push({
			who,
			type: "hit",
			damage,
			...move ? { move } : {}
		});
	};
	while (rounds < 30 && hp.a > 0 && hp.b > 0) {
		rounds += 1;
		strike("a");
		if (hp.b > 0) strike("b");
	}
	return {
		winner: hp.b <= 0 ? "a" : hp.a <= 0 ? "b" : hp.a / a.maxHp > hp.b / b.maxHp ? "a" : "b",
		rounds,
		hpA: hp.a,
		hpB: hp.b,
		log
	};
}
/** A little experience for an arena win: about half a forest monster's worth. Losing costs nothing and gives nothing. */
const arenaExp = (level) => Math.max(1, Math.round(tierPower(level) * .5));
//#endregion
//#region shared/lord/maths.ts
/** The pack each moment draws from. Where the teacher has turned a topic off, the game uses the next in the list. */
const MOMENT_TOPICS = {
	"size-it-up": [
		"add-sub",
		"times-tables",
		"place-value",
		"division",
		"fractions",
		"decimals"
	],
	shop: ["money", "add-sub"],
	healer: ["times-tables", "division"],
	bank: ["decimals", "add-sub"],
	riddle: ["patterns", "place-value"],
	treasure: [
		"place-value",
		"division",
		"money",
		"patterns"
	],
	"inn-guess": [],
	"master-trial": [
		"add-sub",
		"times-tables",
		"place-value",
		"division",
		"fractions",
		"decimals",
		"money",
		"patterns"
	],
	"dragon-trial": [
		"add-sub",
		"times-tables",
		"place-value",
		"division",
		"fractions",
		"decimals",
		"money",
		"patterns"
	]
};
/** Every topic Dragon Maths can ask about (the teacher's tick-list, all on to start). */
const ALL_TOPICS = [
	"place-value",
	"add-sub",
	"times-tables",
	"division",
	"fractions",
	"decimals",
	"money",
	"patterns"
];
/** The topics to use from a settings list: the known ones only, and never none (an empty or unreadable list means all). */
function topicsOn(list) {
	const on = Array.isArray(list) ? ALL_TOPICS.filter((t) => list.includes(t)) : [];
	return on.length ? on : ALL_TOPICS;
}
/**
* The packs a moment may draw from when the teacher has some topics off: its own packs that are on. If all of
* its own are off, any topic that is on, so no moment is ever without a question (the number-guess game has none).
*/
function momentTopics(moment, on = ALL_TOPICS) {
	const own = MOMENT_TOPICS[moment];
	if (own.length === 0) return [];
	const kept = own.filter((t) => on.includes(t));
	return kept.length ? kept : [...on];
}
/** The difficulty band (1 easiest, 4 hardest) that suits a hero's level when nothing better is known. */
const defaultBand = (level) => Math.min(4, Math.max(1, Math.ceil(level / 3)));
/** Does this fight offer a "size it up" question? A pure function of the seed so a replay agrees. */
const offersSizeItUp = (seed) => (Math.imul(seed >>> 0, 2654435761) >>> 0) % 3 === 0;
/** Size it up: a right answer finds the monster's weak spot. */
const sizeItUpBonus = (result) => result === "right" ? 1.5 : result === "hint" ? 1.25 : 1;
/** Shop and healer: a right answer is 10% off (a hint earns 5%); wrong is full price. */
const priceDiscount = (result) => result === "right" ? .1 : result === "hint" ? .05 : 0;
/** Master's trial: each right answer adds a little strength when you level up (a tenth of the usual gain, at least 1). */
function masterTrialStrength(toLevel, results) {
	const per = Math.max(1, Math.round(levelUpGain(toLevel).strength * .1));
	return results.reduce((sum, r) => sum + (r === "right" ? per : r === "hint" ? Math.ceil(per / 2) : 0), 0);
}
function addMasterTrialBonus(hero, results) {
	return {
		...hero,
		strength: hero.strength + masterTrialStrength(hero.level, results)
	};
}
/**
* Before each dragon stage: a right answer gives a small shield and a slightly bigger first hit. A wrong answer gives
* neither, and the fight still goes on. The dragon is a fight, not a test (James, 18 Oct): gear and class skills
* decide it, and the riddles are a nudge.
*/
function dragonStageOptions(result) {
	const shield = Math.round(tierPower(12) * .02);
	if (result === "right") return {
		shield,
		firstHitBonus: 1.2
	};
	if (result === "hint") return {
		shield: Math.round(shield / 2),
		firstHitBonus: 1.1
	};
	return {};
}
/** Bank interest question (optional, older pupils): a right answer adds a little interest, once a day. */
const interestFor = (bank, result) => result === "right" ? Math.floor(bank * .05) : result === "hint" ? Math.floor(bank * .025) : 0;
const numberGuessPrize = (level, won) => Math.round(tierPower(level) * (won ? 1 : .2));
/** The inn's riddle of the day: a right answer pays well, a wrong one pays a little for trying. */
const riddleGold = (level, result) => friendly(tierPower(level) * (result === "right" ? 1.5 : result === "hint" ? .75 : .3));
//#endregion
//#region shared/lord/sim.ts
/** How often the simulated pupil answers a maths question right. */
const MATHS_RIGHT_SHARE = .7;
const dayString = (n) => new Date(Date.UTC(2026, 0, 1) + n * 864e5).toISOString().slice(0, 10);
/** The pupil's fight: attack, with class skills used when it makes sense. */
function playFight(start) {
	let f = start;
	let guard = 0;
	while (!f.over && guard++ < 200) {
		const hpShare = f.heroHp / f.heroMaxHp;
		const skills = f.skillLeft > 0 ? skillsFor(f.heroClass) : [];
		if (skills.includes("mend") && hpShare < .45 && f.heroHp < f.heroMaxHp) f = stepFight(f, {
			type: "skill",
			skill: "mend"
		});
		else if (skills.includes("power-strike")) f = stepFight(f, {
			type: "skill",
			skill: "power-strike"
		});
		else if (skills.includes("zap")) f = stepFight(f, {
			type: "skill",
			skill: "zap"
		});
		else if (skills.includes("dodge") && hpShare < .6) f = stepFight(f, {
			type: "skill",
			skill: "dodge"
		});
		else if (skills.includes("pinch") && f.goldPinched === 0) f = stepFight(f, {
			type: "skill",
			skill: "pinch"
		});
		else f = stepFight(f, { type: "attack" });
	}
	return f;
}
function shop(hero, report) {
	let h = hero;
	for (let again = 0; again < 4; again++) {
		let bought = false;
		for (const slot of ["weapon", "armour"]) {
			const top = (slot === "weapon" ? WEAPONS : ARMOURS).length - 1;
			for (let i = top; i > h[slot]; i--) {
				const r = buyGear(h, slot, i);
				if (r.ok) {
					report.goldOnGear += r.paid - r.refund;
					h = r.hero;
					bought = true;
					break;
				}
			}
		}
		if (!bought) break;
	}
	return h;
}
function playSeason(heroClass, style, seed, days = 35) {
	const rand = makeRandom(seed);
	const report = {
		levelDay: Array(13).fill(null),
		levelCalendarDay: Array(13).fill(null),
		forestFights: 0,
		forestWins: 0,
		forestLosses: 0,
		arenaWins: 0,
		masterTries: 0,
		masterWins: 0,
		goldEarned: 0,
		goldOnHealing: 0,
		goldOnGear: 0,
		dragonKills: 0,
		dragonTries: 0,
		dragonDay: null,
		playDays: 0,
		avgRounds: 0,
		heroByDay: []
	};
	let rounds = 0;
	let hero = newHero(heroClass, dayString(0));
	report.levelDay[1] = 0;
	report.levelCalendarDay[1] = 0;
	const tryHeal = (h) => {
		if (h.hp >= h.maxHp * style.healBelow) return h;
		const withBank = withdraw(h, h.bank);
		const healed = heal(withBank, h.maxHp - h.hp);
		report.goldOnHealing += withBank.gold - healed.gold;
		return deposit(healed, healed.gold);
	};
	for (let day = 0; day < days; day++) {
		if (!style.plays(day)) {
			report.heroByDay.push(hero);
			continue;
		}
		report.playDays += 1;
		hero = rollDay(hero, dayString(day));
		hero = shop(withdraw(hero, hero.bank), report);
		const tryMaster = () => {
			if (!canChallengeMaster(hero).ok) return;
			report.masterTries += 1;
			const f = playFight(startMasterFight(hero, Math.floor(rand() * 4294967296)));
			hero = applyMasterResult(hero, f);
			if (f.outcome === "won") {
				report.masterWins += 1;
				report.levelDay[hero.level] ??= report.playDays;
				report.levelCalendarDay[hero.level] ??= day;
				hero = shop(withdraw(hero, hero.bank), report);
			}
		};
		tryMaster();
		if (canFaceDragon(hero)) {
			let hp = hero.hp;
			let won = true;
			let skillLeft = hero.skillLeft;
			for (const stage of [
				1,
				2,
				3
			]) {
				const riddle = rand() < .7 ? "right" : "wrong";
				const f = playFight(startDragonStage({
					...hero,
					skillLeft
				}, stage, Math.floor(rand() * 4294967296), {
					...dragonStageOptions(riddle),
					heroHp: hp
				}));
				skillLeft = f.skillLeft;
				hp = dragonBreather(hero, f.heroHp);
				if (f.outcome !== "won") {
					won = false;
					break;
				}
			}
			report.dragonTries += 1;
			if (won) {
				report.dragonKills += 1;
				report.dragonDay ??= report.playDays;
				hero = finishDragon(hero, dayString(day));
			} else hero = loseToDragon(hero);
		}
		let guard = 0;
		while (hero.forestLeft > 0 && guard++ < 40) {
			hero = tryHeal(hero);
			const trip = forestTrip(hero, Math.floor(rand() * 4294967296));
			if (trip.kind === "event") {
				const before = hero.gold;
				hero = applyEvent(hero, trip.event, rand() < MATHS_RIGHT_SHARE);
				report.goldEarned += Math.max(0, hero.gold - before);
				continue;
			}
			hero = useForestTurn(hero);
			const f = playFight(startFight(hero, trip.monster, trip.seed));
			report.forestFights += 1;
			rounds += f.round;
			const before = hero.gold;
			hero = applyForestResult(hero, f);
			if (f.outcome === "won") {
				report.forestWins += 1;
				report.goldEarned += hero.gold - before;
			} else if (f.outcome === "lost") report.forestLosses += 1;
			hero = shop(hero, report);
			tryMaster();
		}
		for (let i = 0; i < 3; i++) {
			const mirror = duelistOf(hero, "Mirror");
			if (playDuel(duelistOf(hero, "You"), mirror, Math.floor(rand() * 4294967296)).winner === "a") {
				hero = {
					...hero,
					exp: hero.exp + arenaExp(hero.level),
					arenaWins: hero.arenaWins + 1
				};
				report.arenaWins += 1;
			}
		}
		hero = deposit(hero, Math.max(0, hero.gold - 0));
		report.heroByDay.push(hero);
	}
	report.avgRounds = report.forestFights ? rounds / report.forestFights : 0;
	return report;
}
//#endregion
//#region shared/lord/computer.ts
const days = (...on) => Array.from({ length: 7 }, (_, d) => on.includes(d));
const COMPUTER_HEROES = [
	{
		id: "gareth",
		name: "Sir Gareth",
		heroClass: "knight",
		plays: days(0, 1, 2, 3, 4)
	},
	{
		id: "maple",
		name: "Dame Maple",
		heroClass: "mage",
		plays: days(0, 1, 2, 3)
	},
	{
		id: "bram",
		name: "Old Bram",
		heroClass: "knight",
		plays: days(0, 2, 4)
	},
	{
		id: "wren",
		name: "Lady Wren",
		heroClass: "trickster",
		plays: days(0, 1, 2, 3, 4, 5, 6)
	},
	{
		id: "flint",
		name: "Captain Flint",
		heroClass: "trickster",
		plays: days(1, 2, 3, 4)
	},
	{
		id: "orrin",
		name: "Wizard Pim",
		heroClass: "mage",
		plays: days(0, 1, 3, 4)
	},
	{
		id: "hazel",
		name: "Sister Hazel",
		heroClass: "mage",
		plays: days(1, 3, 5)
	},
	{
		id: "mort",
		name: "Big Mort",
		heroClass: "knight",
		plays: days(0, 1, 2, 3, 4, 5)
	}
];
const hashOf = (text) => {
	let h = 2166136261;
	for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return h >>> 0;
};
/** One full season of one computer hero, kept for the next request (the server process stays warm for a while). */
const seasons = new Map();
function seasonOfHero(spec, seasonNumber) {
	const key = `${spec.id}:${seasonNumber}`;
	let heroes = seasons.get(key);
	if (!heroes) {
		const style = {
			name: spec.name,
			plays: (d) => spec.plays[d % 7],
			healBelow: .4
		};
		heroes = playSeason(spec.heroClass, style, hashOf(key), 35).heroByDay;
		seasons.set(key, heroes);
		if (seasons.size > 40) seasons.delete(seasons.keys().next().value);
	}
	return heroes;
}
/** Where every computer hero stands at the end of the day (`dayOfSeason` 1 to 35). */
function computerHeroes(seasonNumber, dayOfSeason) {
	const index = Math.max(0, Math.min(35, dayOfSeason) - 1);
	return COMPUTER_HEROES.map((spec) => {
		const hero = seasonOfHero(spec, seasonNumber)[index];
		return {
			id: spec.id,
			name: spec.name,
			hero,
			duelist: duelistOf(hero, spec.name)
		};
	});
}
/** What the computer heroes did on a day: a level gained (by beating a master) or the dragon beaten. */
function computerDeeds(seasonNumber, dayOfSeason) {
	if (dayOfSeason < 2) return [];
	const out = [];
	for (const spec of COMPUTER_HEROES) {
		const run = seasonOfHero(spec, seasonNumber);
		const before = run[Math.min(35, dayOfSeason) - 2];
		const after = run[Math.min(35, dayOfSeason) - 1];
		if (after.dragonKills > before.dragonKills) out.push({
			id: spec.id,
			kind: "dragon",
			text: `${spec.name} (computer hero) beat the Red Dragon! The village cheers.`
		});
		else if (after.level > before.level && after.level <= 12) {
			const master = masterFor(after.level - 1);
			out.push({
				id: spec.id,
				kind: "level",
				text: `${spec.name} (computer hero) beat ${master?.name ?? "a master"} and reached level ${after.level}!`
			});
		}
	}
	return out;
}
//#endregion
//#region shared/lord/news.ts
/**
* The village's event of the day: a little life, often with a number in it. Lines only: nothing about the day
* changes (the plan's "market day 10% off" would be a real rule, and is left for later).
*/
const VILLAGE_EVENTS = [
	"Market day! The baker has 6 trays of pies with 8 pies on each. That is 48 pies, and one goblin has already tried to buy them all.",
	"A fog rolls over Hollowbrook. The lamplighter lights 20 lamps, then gets lost on the way to the 21st.",
	"The blacksmith gives a free sharpen to anyone who can say what 7 × 8 is. The whole queue says 56, and he runs out of sharpening stones.",
	"The inn is full tonight: 4 tables, 5 heroes at each. That is 20 heroes, all arguing about whose goblin was biggest.",
	"A travelling pedlar sells 3 turnips for 12 gold. Each turnip costs 4. Nobody wants a turnip.",
	"The village clock has chimed 13 times. The clockmaker says that is one more than it should. He is looking for the extra one.",
	"A sheep has been found on the bank roof. The farmer counts his flock: 30 sheep, so 29 now on the ground. He says it is a very clever sheep.",
	"The healer is running a sale on bandages: buy 2, get 1 free. Nobody has been hurt, but the queue is long.",
	"A rainbow lands behind the mill. The children count 7 colours. The goblins count 9 and are told to count again.",
	"The bard has a new song with 12 verses. By verse 8, the audience has gone to the shop.",
	"Heavy rain! Puddles everywhere. The ducks have 10 new swimming pools and are very happy about it.",
	"A baker’s dozen is 13, says the baker, putting 13 buns in each bag. 4 bags is 52 buns, and no profit.",
	"Dragon-watch: the tower guard sees a smoke cloud on the hill. It is the cook burning the porridge again.",
	"The mayor measures the town square: 12 steps one way and 10 the other. That is 120 steps of paving to sweep!",
	"A lost cat is found in the library, asleep on the book about dogs.",
	"Training day at the grounds: 5 heroes each do 9 press-ups. The master counts 45 and gives them a biscuit.",
	"The fishmonger has 24 fish and 6 customers. Everyone gets 4 fish, and one customer gets a surprised look.",
	"Somebody has painted the well bright pink. The pink is very good. Nobody will say who did it.",
	"Frost this morning! The pond is icy. A brave frog is sliding across it on purpose.",
	"The armourer polishes 15 helmets. Each one takes 2 minutes. He will be done in half an hour, or at tea time.",
	"A bag of gold coins is found by the bridge: 100 coins, if you count the one that is chocolate.",
	"The village band plays 3 songs, each 4 minutes long. The goblins in the front row ask for a 4th, and a snack.",
	"A kite festival! 18 kites go up and 9 come down in a tree. The tree has asked to be left in peace.",
	"The mill grinds 50 sacks of flour in a day. The baker says that is 50 reasons to expect more pies.",
	"A quiet day in Hollowbrook. The only thing to report is that nothing happened, and that the news-writer is very tired.",
	"The grocer sells apples at 5 gold each. A hero buys 6 and pays 30, and gets a free worm.",
	"A comet streaks over the forest tonight. The wizard says it is a sign. The sign says \"back in 5 minutes\".",
	"The bank has counted the village savings: 1,000 gold in the vault, 250 more in the tin, and 1 button.",
	"A parade of 8 ducks, in 2 neat rows of 4. The ducks do not know it is a parade.",
	"Someone has tied a ribbon round the Great Oak, 9 metres round. The oak says nothing but looks pleased."
];
const dayNumber = (day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 864e5);
const villageEventFor = (day) => VILLAGE_EVENTS[(dayNumber(day) % VILLAGE_EVENTS.length + VILLAGE_EVENTS.length) % VILLAGE_EVENTS.length];
/** The lines that belong to a day whoever plays: the village event and what the computer heroes did. */
function dailyNews(day, season) {
	const lines = [{
		kind: "village",
		text: villageEventFor(day),
		player: null,
		dedupe: "village"
	}];
	for (const deed of computerDeeds(season.number, season.dayOfSeason)) lines.push({
		kind: "computer",
		text: deed.text,
		player: null,
		dedupe: `computer:${deed.id}`
	});
	return lines;
}
const masterWonLine = (player, masterName, level) => ({
	kind: "master",
	text: `{p} beat ${masterName} and reached level ${level}!`,
	player,
	dedupe: `master:${player}:${level}`
});
const dragonWonLine = (player, star) => ({
	kind: "dragon",
	text: `{p} beat the Red Dragon! That is star number ${star}. The village treasure, food and light are back!`,
	player,
	dedupe: `dragon:${player}`
});
const arenaWonLine = (player, opponent) => ({
	kind: "arena",
	text: opponent ? `{p} beat ${opponent} (computer hero) in the arena!` : "{p} won a fight in the arena!",
	player,
	dedupe: `arena:${player}`
});
const flattenedLine = (player, monster) => ({
	kind: "flattened",
	text: `{p} was flattened by ${/^[aeiou]/i.test(monster) ? "an" : "a"} ${monster}. The healer has put the kettle on.`,
	player,
	dedupe: `flat:${player}`
});
//#endregion
//#region shared/maths/leitner.ts
/**
* Mastery boxes (the Leitner system). Every fact sits in box 0–4:
* correct and quick moves it up one box, correct but slow keeps it where it is, and wrong
* drops it to box 1. A fact only reaches box 4 ("fluent") once it has been answered
* quickly and correctly on at least two different days, so one lucky lesson isn't enough.
*/
function newStats$1(key) {
	return {
		key,
		attempts: 0,
		correct: 0,
		avgMs: 0,
		box: 0,
		lastSeen: 0,
		quickDays: []
	};
}
const nzDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" });
/** The New Zealand date of a moment, as YYYY-MM-DD. */
const nzDay = (at) => nzDayFormat.format(new Date(at));
/** The stats after one answer. Doesn't change the stats it's given. */
function afterAnswer(stats, correct, ms, at) {
	const attempts = stats.attempts + 1;
	const next = {
		...stats,
		attempts,
		correct: stats.correct + (correct ? 1 : 0),
		avgMs: Math.round(stats.avgMs + (ms - stats.avgMs) / attempts),
		lastSeen: at,
		quickDays: [...stats.quickDays]
	};
	if (!correct) {
		next.box = 1;
		return next;
	}
	if (ms > 5e3) return next;
	const day = nzDay(at);
	if (!next.quickDays.includes(day)) next.quickDays = [...next.quickDays, day].slice(-2);
	const canBeFluent = next.quickDays.length >= 2;
	next.box = Math.min(stats.box + 1, canBeFluent ? 4 : 3);
	return next;
}
//#endregion
//#region shared/maths/facts.ts
/**
* Times-table facts. "7 × 8" and "8 × 7" are one fact for mastery (key "mul:7x8", smaller
* number first), but both orders get asked.
*/
const factKey = (x, y) => `mul:${Math.min(x, y)}x${Math.max(x, y)}`;
function parseFactKey(key) {
	const match = /^mul:(\d+)x(\d+)$/.exec(key);
	if (!match) return null;
	const a = Number(match[1]);
	const b = Number(match[2]);
	return a <= b && a >= 1 && b <= 12 ? {
		a,
		b
	} : null;
}
/** Every fact in one times table: t × 1 to t × 12, as keys. */
function tableFacts(table) {
	return TABLES.map((n) => factKey(table, n));
}
/** Every fact in these tables, with no repeats. */
function factsIn(tables) {
	const keys = new Set();
	for (const t of tables) for (const key of tableFacts(t)) keys.add(key);
	return keys;
}
//#endregion
//#region shared/maths/selector.ts
/**
* Choosing the next fact to ask. About 60% come from the current focus tables, 30% review
* earlier tables (weak facts more often) and 10% stretch into the next table up. Within
* those, facts in lower mastery boxes come up more often, the last few facts asked are
* skipped, and a fact answered wrongly comes back 3–6 questions later.
*/
const newMemory = () => ({
	asked: 0,
	recent: [],
	repeats: []
});
function stepIndex(level) {
	const i = CAMPAIGN_STEPS.findIndex((s) => s.levels.includes(level));
	return i >= 0 ? i : level < CAMPAIGN_STEPS[0].levels[0] ? 0 : CAMPAIGN_STEPS.length - 1;
}
/** The facts each band draws from, for this context. */
function poolsFor(ctx) {
	const enabled = new Set(ctx.enabledTables ?? TABLES);
	const on = (tables) => tables.filter((t) => enabled.has(t));
	let focusTables;
	let reviewTables;
	let stretchTables;
	let upTo = 12;
	if (ctx.focusTables) {
		focusTables = on(ctx.focusTables);
		reviewTables = on(TABLES.filter((t) => !ctx.focusTables.includes(t)));
		stretchTables = [];
	} else {
		const step = stepIndex(ctx.level ?? 1);
		focusTables = on(CAMPAIGN_STEPS[step].add);
		reviewTables = on(CAMPAIGN_STEPS.slice(0, step).flatMap((s) => s.add));
		stretchTables = on(CAMPAIGN_STEPS[step + 1]?.add ?? []);
		upTo = CAMPAIGN_STEPS[step].upTo ?? 12;
	}
	const small = (key) => parseFactKey(key).b <= upTo;
	const focus = new Set([...factsIn(focusTables)].filter(small));
	const review = [...factsIn(reviewTables)].filter((k) => small(k) && !focus.has(k));
	const stretch = [...factsIn(stretchTables)].filter((k) => small(k) && !focus.has(k) && !review.includes(k));
	return {
		focus: [...focus],
		review,
		stretch
	};
}
/** How likely a fact is to be picked: lower boxes and more mistakes make it likelier. */
function factWeight(stats) {
	if (!stats) return BOX_WEIGHTS[0];
	const wrongShare = stats.attempts ? (stats.attempts - stats.correct) / stats.attempts : 0;
	return BOX_WEIGHTS[Math.min(stats.box, BOX_WEIGHTS.length - 1)] * (1 + wrongShare);
}
function weightedPick(keys, stats, random, extra) {
	const weights = keys.map((k) => factWeight(stats.get(k)) * (extra?.(k) ?? 1));
	let roll = random() * weights.reduce((a, b) => a + b, 0);
	for (let i = 0; i < keys.length; i++) {
		roll -= weights[i];
		if (roll < 0) return keys[i];
	}
	return keys[keys.length - 1];
}
/**
* The same picking rules over any pools of keys (the other skill packs build their own
* pools from difficulty bands). Returns null when every pool is empty.
*/
function pickFromPools(pools, ctx, stats, memory, random, extraWeight) {
	const allowed = new Set([
		...pools.focus,
		...pools.review,
		...pools.stretch
	]);
	if (allowed.size === 0) return null;
	memory.asked++;
	const due = memory.repeats.find((r) => r.due <= memory.asked && allowed.has(r.key));
	let choice;
	if (due) {
		memory.repeats = memory.repeats.filter((r) => r !== due);
		choice = {
			key: due.key,
			band: "repeat"
		};
	} else {
		const roll = random();
		const band = [
			ctx.onlyFocus || roll < MIX.focus ? "focus" : roll < MIX.focus + MIX.review ? "review" : "stretch",
			"focus",
			"review",
			"stretch"
		].find((b) => pools[b].length > 0);
		let keys = pools[band];
		if (ctx.boxes) {
			const inBoxes = keys.filter((k) => ctx.boxes.includes(stats.get(k)?.box ?? 0));
			if (inBoxes.length) keys = inBoxes;
		}
		const recent = new Set(memory.recent.slice(-3));
		const fresh = keys.filter((k) => !recent.has(k));
		if (fresh.length) keys = fresh;
		choice = {
			key: weightedPick(keys, stats, random, extraWeight),
			band
		};
	}
	memory.recent = [...memory.recent, choice.key].slice(-10);
	return choice;
}
/** After a wrong answer: ask this fact again 3–6 questions from now (once). */
function scheduleRepeat(memory, key, random) {
	if (memory.repeats.some((r) => r.key === key)) return;
	const gap = REPEAT_AFTER.min + Math.floor(random() * (REPEAT_AFTER.max - REPEAT_AFTER.min + 1));
	memory.repeats.push({
		key,
		due: memory.asked + gap
	});
}
//#endregion
//#region shared/maths/banded.ts
/**
* The common engine behind every skill pack except times tables. A pack is a list of
* question families, grouped into difficulty bands (band 1 easiest). `QuestionContext.level`
* is the band: its families are the focus, easier bands are review, and the next band up is
* stretch, with the same 60/30/10 mix, mastery boxes and repeats as times tables
* (`pickFromPools`).
*
* A family owns one or more mastery keys. Fact-style families (adding facts, division facts)
* have one key per fact ("add:7+8"); the rest have a single key for the kind of question
* ("add:2d+2d:carry"), because "47 + 36" and "58 + 25" are the same skill.
*
* Every question is made from a short list of numbers (`params`) by a pure function, so the
* server can make the question again from its key and numbers to check an answer, without
* trusting the browser's copy of the question.
*/
/** A whole number from lo to hi (both included). */
const int = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
const pickOne = (random, items) => items[Math.floor(random() * items.length)];
function shuffle(items, random) {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
/** Rounds away floating-point dust: 0.1 + 0.2 → 0.3. */
const tidy = (n) => Math.round(n * 1e3) / 1e3;
/** Whole numbers within [lo, hi]. */
const isInt$1 = (n, lo, hi) => typeof n === "number" && Number.isInteger(n) && n >= lo && n <= hi;
/** How a number is written on screen: 3406 → "3406", 12500 → "12 500" (NZ style for 5+ digits), 0.5 → "0.5". */
function show(n) {
	const [whole, frac] = String(tidy(Math.abs(n))).split(".");
	const grouped = whole.length >= 5 ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : whole;
	return (n < 0 ? "−" : "") + grouped + (frac ? "." + frac : "");
}
/** Money in dollars, from cents: 240 → "$2.40". */
const dollars = (cents) => `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
const SPOKEN_WORDS = {
	"+": "plus",
	"−": "minus",
	"×": "times",
	"÷": "divided by",
	"=": "equals",
	"?": "what",
	r: "remainder"
};
const ORDINAL = {
	2: ["half", "halves"],
	3: ["third", "thirds"],
	4: ["quarter", "quarters"],
	5: ["fifth", "fifths"],
	6: ["sixth", "sixths"],
	7: ["seventh", "sevenths"],
	8: ["eighth", "eighths"],
	9: ["ninth", "ninths"],
	10: ["tenth", "tenths"],
	12: ["twelfth", "twelfths"],
	100: ["hundredth", "hundredths"]
};
/** A fraction part in words: "3/4" → "3 quarters", "?/8" → "what eighths", "2 1/3" → "2 and 1 third". */
function spokenFraction(part) {
	const mixed = /^(\d+|\?) (\d+|\?)\/(\d+)$/.exec(part);
	if (mixed) return `${mixed[1] === "?" ? "what" : mixed[1]} and ${spokenFraction(`${mixed[2]}/${mixed[3]}`)}`;
	const m = /^(\d+|\?)\/(\d+|\?)$/.exec(part);
	if (!m) return part;
	const [, top, bottom] = m;
	if (bottom === "?") return `${top} over what`;
	const names = ORDINAL[Number(bottom)];
	if (!names) return `${top === "?" ? "what" : top} over ${bottom}`;
	if (top === "?") return `what ${names[1]}`;
	return `${top} ${top === "1" ? names[0] : names[1]}`;
}
/** The spoken version of a question's parts, for screen readers. */
function speak(parts) {
	const text = parts.map((p) => SPOKEN_WORDS[p] ?? (p.includes("/") ? spokenFraction(p) : p.replace(/^\$/, "$"))).join(" ").replace(/\s+/g, " ").trim();
	return /[?.!:]$/.test(text) ? text : text + "?";
}
/** The parts with the blank filled in: "7 + 8 = ?" → "7 + 8 = 15", "1/2 = ?/8" → "1/2 = 4/8". */
const fillBlank = (parts, answer) => parts.map((p) => p.includes("?") ? p.replace("?", show(answer)) : p).join(" ").replace(/\$ /g, "$");
/** Same answer, allowing for floating-point dust (0.30000000000000004). */
const sameAnswer = (a, b) => Math.abs(a - b) < 1e-6;
/** Digits a typed answer needs, allowing one extra so the length doesn't give the answer away. */
const lengthFor = (answer) => String(tidy(answer)).length;
/** Four choices: the answer plus believable wrong ones, padded with near misses when short. */
function choicesFor(answer, wrong, decimal, random) {
	const ok = (n) => Number.isFinite(n) && n >= 0 && !sameAnswer(n, answer) && (decimal || Number.isInteger(n));
	const picked = [];
	for (const n of shuffle(wrong.map(tidy), random)) if (ok(n) && !picked.some((p) => sameAnswer(p, n)) && picked.length < 3) picked.push(n);
	const steps = decimal && !Number.isInteger(answer) ? [
		.1,
		1,
		.01,
		.2
	] : [
		1,
		10,
		2,
		100
	];
	for (let i = 1; picked.length < 3; i++) for (const step of steps) for (const n of [tidy(answer + step * i), tidy(answer - step * i)]) if (ok(n) && !picked.some((p) => sameAnswer(p, n)) && picked.length < 3) picked.push(n);
	return shuffle([answer, ...picked], random);
}
var BandedPack = class {
	definition;
	random;
	now;
	id;
	label;
	curriculumTags;
	/** Number of difficulty bands (valid `level`s are 1 to this). */
	bandCount;
	familyOfKey = new Map();
	bandOfKey = new Map();
	records = new Map();
	memory = newMemory();
	listeners = new Set();
	nextId = 1;
	constructor(definition, saved = [], random = Math.random, now = Date.now) {
		this.definition = definition;
		this.random = random;
		this.now = now;
		this.id = definition.id;
		this.label = definition.label;
		this.bandCount = definition.bands.length;
		const families = Object.values(definition.families);
		this.curriculumTags = [...new Set(families.flatMap((f) => f.curriculumTags))];
		definition.bands.forEach((names, i) => {
			for (const name of names) {
				const family = definition.families[name];
				if (!family) throw new Error(`${definition.id}: band ${i + 1} names unknown family "${name}"`);
				for (const key of family.keys) {
					if (this.familyOfKey.has(key)) throw new Error(`${definition.id}: key "${key}" is in two families or bands`);
					this.familyOfKey.set(key, family);
					this.bandOfKey.set(key, i + 1);
				}
			}
		});
		for (const name of definition.ladderOnly ?? []) {
			const family = definition.families[name];
			if (!family) throw new Error(`${definition.id}: ladderOnly names unknown family "${name}"`);
			for (const key of family.keys) {
				if (this.familyOfKey.has(key)) throw new Error(`${definition.id}: key "${key}" is in two families or bands`);
				this.familyOfKey.set(key, family);
			}
		}
		for (const s of saved) if (this.familyOfKey.has(s.key)) this.records.set(s.key, s);
	}
	/** Every mastery key in a band (1 = easiest). */
	keysInBand(band) {
		return (this.definition.bands[band - 1] ?? []).flatMap((name) => this.definition.families[name].keys);
	}
	/** Which band a key belongs to, or undefined if this pack doesn't own it. */
	bandOf(key) {
		return this.bandOfKey.get(key);
	}
	/** What a key is about, for the teacher: "Adding 2-digit numbers, with regrouping". */
	labelOf(key) {
		return this.familyOfKey.get(key)?.label;
	}
	/** The focus, review and stretch keys for a band. */
	poolsFor(level) {
		const band = Math.min(Math.max(Math.round(level), 1), this.bandCount);
		return {
			focus: this.keysInBand(band),
			review: Array.from({ length: band - 1 }, (_, i) => this.keysInBand(i + 1)).flat(),
			stretch: band < this.bandCount ? this.keysInBand(band + 1) : []
		};
	}
	onAnswer(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	stats() {
		return [...this.records.values()];
	}
	statsFor(key) {
		return this.records.get(key);
	}
	/**
	* Makes the question for a key and its numbers, exactly as `nextQuestion` would have.
	* Null if this pack doesn't own the key or the numbers aren't ones it could have rolled.
	* The server uses this to check answers.
	*/
	rebuild(key, params, multipleChoice = false, random = this.random) {
		const family = this.familyOfKey.get(key);
		if (!family || !params.every((p) => Number.isFinite(p))) return null;
		const made = family.make(key, params);
		if (!made) return null;
		const answer = tidy(made.answer);
		const decimal = made.input === "decimal";
		let choices;
		let choiceLabels;
		if (made.pick) {
			choices = made.pick.map((_, i) => i);
			choiceLabels = made.pick;
		} else if (multipleChoice) choices = choicesFor(answer, made.wrong ?? [], decimal, random);
		return {
			skill: this.id,
			factKey: key,
			kind: key,
			parts: made.parts,
			spoken: made.spoken,
			answer,
			choices,
			choiceLabels,
			input: made.input ?? "whole",
			maxLength: Math.max(3, lengthFor(answer) + 1),
			params: [...params]
		};
	}
	nextQuestion(ctx) {
		const picked = pickFromPools(this.poolsFor(ctx.level ?? 1), ctx, this.records, this.memory, this.random);
		if (!picked) return null;
		return this.questionFor(picked.key, picked.band, ctx);
	}
	/** Whether this pack owns a mastery key. */
	owns(key) {
		return this.familyOfKey.has(key);
	}
	/** The question for a chosen key (the picking was done by the caller, e.g. auto mode). */
	questionFor(key, band, ctx = {}) {
		const picked = {
			key,
			band
		};
		const family = this.familyOfKey.get(picked.key);
		for (let tries = 0; tries < 20; tries++) {
			const built = this.rebuild(picked.key, family.roll(picked.key, this.random), !!ctx.multipleChoice);
			if (built) return {
				...built,
				id: this.nextId++,
				band: picked.band
			};
		}
		throw new Error(`${this.id}: family for "${picked.key}" keeps rolling numbers it can't use`);
	}
	recordAnswer(q, answer, ms) {
		const correct = sameAnswer(answer, q.answer);
		const before = this.records.get(q.factKey) ?? newStats$1(q.factKey);
		const at = this.now();
		const after = afterAnswer(before, correct, ms, at);
		this.records.set(q.factKey, after);
		for (const listener of this.listeners) listener({
			key: q.factKey,
			correct,
			ms: Math.round(ms),
			at
		});
		if (!correct) scheduleRepeat(this.memory, q.factKey, this.random);
		return {
			correct,
			fact: this.factText(q),
			boxBefore: before.box,
			boxAfter: after.box
		};
	}
	/** The right answer in full, shown after a wrong answer. */
	factText(q) {
		return (q.params ? this.familyOfKey.get(q.factKey)?.make(q.factKey, q.params) : null)?.fact ?? fillBlank(q.parts, q.answer);
	}
};
//#endregion
//#region shared/maths/skillPacks/addSub.ts
/**
* Adding and taking away (the Water topic in Maths Monsters).
*
* Band 1: addition facts to 10 + 10, asked as adding, taking away and missing numbers (one
*         fact each, like 7 × 8 in times tables).
* Band 2: tens (40 + 30), adding tens to a 2-digit number (47 + 30), and bridging ten (47 + 8).
* Band 3: 2-digit ± 2-digit, without then with regrouping, and pairs to 100.
* Band 4: 3-digit ± 3-digit, and near-hundreds (398 + 250, 634 − 299).
*/
const TODO$6 = (what) => [`TODO-${what}`];
const sum = (a, b, extra = {}) => {
	const parts = [
		show(a),
		"+",
		show(b),
		"=",
		"?"
	];
	return {
		parts,
		spoken: speak(parts),
		answer: a + b,
		...extra
	};
};
const diff = (a, b, extra = {}) => {
	const parts = [
		show(a),
		"−",
		show(b),
		"=",
		"?"
	];
	return {
		parts,
		spoken: speak(parts),
		answer: a - b,
		...extra
	};
};
/** Each column added with no carrying: the classic slip (47 + 36 → 73). */
function noCarry(a, b) {
	let out = 0;
	for (let place = 1; a > 0 || b > 0; place *= 10, a = Math.floor(a / 10), b = Math.floor(b / 10)) out += (a % 10 + b % 10) % 10 * place;
	return out;
}
/** Each column taken smaller-from-bigger: the classic slip (52 − 37 → 25). */
function smallerFromBigger(a, b) {
	let out = 0;
	for (let place = 1; a > 0 || b > 0; place *= 10, a = Math.floor(a / 10), b = Math.floor(b / 10)) out += Math.abs(a % 10 - b % 10) * place;
	return out;
}
const addWrong = (a, b) => {
	const s = a + b;
	return [
		noCarry(a, b),
		s + 10,
		s - 10,
		s + 1,
		s - 1,
		s + 100,
		s - 100
	];
};
const subWrong = (a, b) => {
	const d = a - b;
	return [
		smallerFromBigger(a, b),
		d + 10,
		d - 10,
		d + 1,
		d - 1,
		a + b
	];
};
const factKeys$1 = [];
for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) factKeys$1.push(`add:${a}+${b}`);
const parseFact$1 = (key) => {
	const m = /^add:(\d+)\+(\d+)$/.exec(key);
	return m ? {
		a: Number(m[1]),
		b: Number(m[2])
	} : null;
};
/** Variants: 0 a + b, 1 b + a, 2 (a+b) − a, 3 (a+b) − b, 4 a + ? = a+b. */
const facts = {
	label: "Adding and taking away facts to 20",
	curriculumTags: TODO$6("addition-facts"),
	keys: factKeys$1,
	roll: (key, r) => {
		const { a, b } = parseFact$1(key);
		return [
			a,
			b,
			int(r, 0, 4)
		];
	},
	make: (key, [a, b, v]) => {
		const fact = parseFact$1(key);
		if (!fact || fact.a !== a || fact.b !== b || !isInt$1(v, 0, 4)) return null;
		const s = a + b;
		if (v === 0) return sum(a, b, { wrong: [
			s + 1,
			s - 1,
			s + 2,
			s - 2
		] });
		if (v === 1) return sum(b, a, { wrong: [
			s + 1,
			s - 1,
			s + 2,
			s - 2
		] });
		if (v === 2) return diff(s, a, { wrong: [
			b + 1,
			b - 1,
			s + a,
			b + 2
		] });
		if (v === 3) return diff(s, b, { wrong: [
			a + 1,
			a - 1,
			s + b,
			a + 2
		] });
		const parts = [
			String(a),
			"+",
			"?",
			"=",
			String(s)
		];
		return {
			parts,
			spoken: speak(parts),
			answer: b,
			wrong: [
				s,
				b + 1,
				b - 1,
				a
			]
		};
	}
};
/** A family with one key, two numbers and a check on them. */
function kind(key, label, tag, roll, valid, make) {
	return {
		label,
		curriculumTags: TODO$6(tag),
		keys: [key],
		roll: (_k, r) => roll(r),
		make: (_k, [a, b]) => isInt$1(a, 0, 9999) && isInt$1(b, 0, 9999) && valid(a, b) ? make(a, b) : null
	};
}
const ones = (n) => n % 10;
const tens = (n) => Math.floor(n / 10) % 10;
const ADD_SUB = {
	id: "add-sub",
	label: "Adding and taking away",
	families: {
		facts,
		"add:tens": kind("add:tens", "Adding tens (40 + 30)", "add-tens", (r) => [int(r, 1, 9) * 10, int(r, 1, 9) * 10], (a, b) => a % 10 === 0 && b % 10 === 0 && a >= 10 && a <= 90 && b >= 10 && b <= 90, (a, b) => sum(a, b, { wrong: [
			a + b + 10,
			a + b - 10,
			(a + b) / 10,
			a + b + 100
		] })),
		"sub:tens": kind("sub:tens", "Taking away tens (120 − 40)", "sub-tens", (r) => {
			const b = int(r, 1, 9) * 10;
			return [b + int(r, 1, 9) * 10, b];
		}, (a, b) => a % 10 === 0 && b % 10 === 0 && b >= 10 && b <= 90 && a - b >= 10 && a - b <= 90, (a, b) => diff(a, b, { wrong: [
			a - b + 10,
			a - b - 10,
			a + b
		] })),
		"add:2d+tens": kind("add:2d+tens", "Adding tens to a 2-digit number (47 + 30)", "add-tens-to-2d", (r) => [int(r, 1, 6) * 10 + int(r, 1, 9), int(r, 1, 3) * 10], (a, b) => a >= 11 && a <= 69 && ones(a) !== 0 && b % 10 === 0 && b >= 10 && b <= 30, (a, b) => sum(a, b, { wrong: addWrong(a, b).concat([a + b / 10]) })),
		"sub:2d-tens": kind("sub:2d-tens", "Taking tens from a 2-digit number (77 − 30)", "sub-tens-from-2d", (r) => {
			const b = int(r, 1, 3) * 10;
			return [b + int(r, 1, 5) * 10 + int(r, 1, 9), b];
		}, (a, b) => b % 10 === 0 && b >= 10 && b <= 30 && a - b >= 11 && a - b <= 59 && ones(a) !== 0, (a, b) => diff(a, b, { wrong: subWrong(a, b).concat([a - b / 10]) })),
		"add:bridge10": kind("add:bridge10", "Adding across a ten (47 + 8)", "add-bridge-ten", (r) => {
			const a = int(r, 1, 8) * 10 + int(r, 2, 9);
			return [a, int(r, 11 - ones(a), 9)];
		}, (a, b) => a >= 12 && a <= 89 && b >= 2 && b <= 9 && ones(a) + b >= 10, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:bridge10": kind("sub:bridge10", "Taking away across a ten (53 − 8)", "sub-bridge-ten", (r) => {
			const a = int(r, 2, 9) * 10 + int(r, 0, 7);
			return [a, int(r, Math.max(2, ones(a) + 1), 9)];
		}, (a, b) => a >= 20 && a <= 97 && b >= 2 && b <= 9 && ones(a) < b, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:2d+2d": kind("add:2d+2d", "Adding 2-digit numbers (34 + 25)", "add-2d", (r) => {
			const a = int(r, 1, 7) * 10 + int(r, 1, 8);
			return [a, int(r, 1, 8 - tens(a)) * 10 + int(r, 1, 9 - ones(a))];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && ones(a) + ones(b) <= 9 && a + b <= 99, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:2d-2d": kind("sub:2d-2d", "Taking away 2-digit numbers (59 − 25)", "sub-2d", (r) => {
			const b = int(r, 1, 7) * 10 + int(r, 1, 8);
			return [b + int(r, 1, 9 - tens(b)) * 10 + int(r, 0, 9 - ones(b)), b];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && a > b && ones(a) >= ones(b) && a - b >= 10, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:2d+2d:carry": kind("add:2d+2d:carry", "Adding 2-digit numbers, with regrouping (47 + 36)", "add-2d-regroup", (r) => {
			const a = int(r, 1, 7) * 10 + int(r, 2, 9);
			return [a, int(r, 1, 8 - tens(a)) * 10 + int(r, 10 - ones(a), 9)];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && ones(a) + ones(b) >= 10 && a + b <= 99, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:2d-2d:borrow": kind("sub:2d-2d:borrow", "Taking away 2-digit numbers, with regrouping (52 − 37)", "sub-2d-regroup", (r) => {
			const a = int(r, 3, 9) * 10 + int(r, 0, 8);
			return [a, int(r, 1, tens(a) - 2) * 10 + int(r, ones(a) + 1, 9)];
		}, (a, b) => a >= 30 && a <= 99 && b >= 10 && b <= 99 && ones(a) < ones(b) && a - b >= 10, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:to100": {
			label: "Pairs that make 100 (64 + ? = 100)",
			curriculumTags: TODO$6("pairs-to-100"),
			keys: ["add:to100"],
			roll: (_k, r) => [int(r, 1, 8) * 10 + int(r, 1, 9)],
			make: (_k, [a]) => {
				if (!isInt$1(a, 11, 89) || a % 10 === 0) return null;
				const parts = [
					String(a),
					"+",
					"?",
					"=",
					"100"
				];
				const b = 100 - a;
				return {
					parts,
					spoken: speak(parts),
					answer: b,
					wrong: [
						(10 - tens(a)) * 10 + (10 - ones(a)),
						b + 10,
						b - 10,
						b + 1
					]
				};
			}
		},
		"add:3d+3d": kind("add:3d+3d", "Adding 3-digit numbers (456 + 278)", "add-3d", (r) => {
			const a = int(r, 101, 799);
			return [a, int(r, 101, 999 - a)];
		}, (a, b) => a >= 101 && a <= 799 && b >= 101 && a + b <= 999, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:3d-3d": kind("sub:3d-3d", "Taking away 3-digit numbers (502 − 178)", "sub-3d", (r) => {
			const b = int(r, 101, 799);
			return [int(r, b + 11, 999), b];
		}, (a, b) => a >= 112 && a <= 999 && b >= 101 && b <= 799 && a - b >= 11, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:near100": kind("add:near100", "Adding a number close to a hundred (398 + 250)", "add-compensate", (r) => [int(r, 1, 5) * 100 - int(r, 1, 3), int(r, 11, 49) * 10], (a, b) => a % 100 >= 97 && a >= 97 && a <= 499 && b % 10 === 0 && b >= 110 && b <= 490, (a, b) => sum(a, b, { wrong: [
			a + b + 2,
			Math.ceil(a / 100) * 100 + b,
			a + b - 10,
			a + b + 10
		] })),
		"sub:near100": kind("sub:near100", "Taking away a number close to a hundred (634 − 299)", "sub-compensate", (r) => {
			const b = int(r, 1, 4) * 100 - int(r, 1, 3);
			return [int(r, Math.ceil(b / 100) * 100 + 11, 999), b];
		}, (a, b) => b % 100 >= 97 && b >= 97 && b <= 399 && a <= 999 && a - b >= 12, (a, b) => diff(a, b, { wrong: [
			a - Math.ceil(b / 100) * 100,
			a - b + 2,
			a - b - 2,
			a - b + 10
		] }))
	},
	bands: [
		["facts"],
		[
			"add:tens",
			"sub:tens",
			"add:2d+tens",
			"sub:2d-tens",
			"add:bridge10",
			"sub:bridge10"
		],
		[
			"add:2d+2d",
			"sub:2d-2d",
			"add:2d+2d:carry",
			"sub:2d-2d:borrow",
			"add:to100"
		],
		[
			"add:3d+3d",
			"sub:3d-3d",
			"add:near100",
			"sub:near100"
		]
	]
};
//#endregion
//#region shared/maths/skillPacks/decimals.ts
/**
* Decimals and money (the Stone topic in Maths Monsters). Every question here has a decimal
* point key on the number pad. The numbers are kept as whole tenths, hundredths or cents, so
* nothing suffers from floating-point dust.
*
* Band 1: adding and taking away tenths (0.3 + 0.5, 1.5 − 0.7), tenths from fractions (7/10).
* Band 2: money: adding prices, and change from $5, $10 or $20.
* Band 3: hundredths (0.25 + 0.5), which decimal is bigger (0.5 or 0.45), × 10 and × 100.
* Band 4: rounding to a whole number, decimals × whole numbers, fractions as decimals (3/4 = 0.75).
*/
const TODO$5 = (what) => [`TODO-${what}`];
const tenths = (n) => show(n / 10);
const hundredths = (n) => show(n / 100);
const decimal = (made) => ({
	...made,
	input: "decimal"
});
const FRACTIONS_AS_DECIMALS = [
	[1, 2],
	[1, 4],
	[3, 4],
	[1, 5],
	[2, 5],
	[3, 5],
	[4, 5]
];
const DECIMALS = {
	id: "decimals",
	label: "Decimals and money",
	families: {
		"dec:tenths:add": {
			label: "Adding tenths (0.3 + 0.5)",
			curriculumTags: TODO$5("add-tenths"),
			keys: ["dec:tenths:add"],
			roll: (_k, r) => [int(r, 1, 9), int(r, 1, 9)],
			make: (_k, [a, b]) => {
				if (!isInt$1(a, 1, 9) || !isInt$1(b, 1, 9)) return null;
				const parts = [
					tenths(a),
					"+",
					tenths(b),
					"=",
					"?"
				];
				const s = a + b;
				return decimal({
					parts,
					spoken: speak(parts),
					answer: s / 10,
					wrong: [
						s / 100,
						s,
						s % 10 / 10,
						(s + 1) / 10,
						(s - 1) / 10
					]
				});
			}
		},
		"dec:tenths:sub": {
			label: "Taking away tenths (1.5 − 0.7)",
			curriculumTags: TODO$5("subtract-tenths"),
			keys: ["dec:tenths:sub"],
			roll: (_k, r) => {
				const a = int(r, 2, 19);
				return [a, int(r, 1, Math.min(9, a - 1))];
			},
			make: (_k, [a, b]) => {
				if (!isInt$1(a, 2, 19) || !isInt$1(b, 1, Math.min(9, a - 1))) return null;
				const parts = [
					tenths(a),
					"−",
					tenths(b),
					"=",
					"?"
				];
				const d = a - b;
				return decimal({
					parts,
					spoken: speak(parts),
					answer: d / 10,
					wrong: [
						d / 100,
						Math.abs(a % 10 - b) / 10 + Math.floor(a / 10),
						(d + 1) / 10,
						(d - 1) / 10
					]
				});
			}
		},
		"dec:from-frac:tenths": {
			label: "Tenths as decimals (7/10 = 0.7)",
			curriculumTags: TODO$5("tenths-as-decimals"),
			keys: ["dec:from-frac:tenths"],
			roll: (_k, r) => [int(r, 1, 9)],
			make: (_k, [n]) => {
				if (!isInt$1(n, 1, 9)) return null;
				const parts = [
					`${n}/10`,
					"=",
					"?"
				];
				return decimal({
					parts,
					spoken: speak(parts),
					answer: n / 10,
					wrong: [
						n,
						n / 100,
						(n + 1) / 10,
						Number(`${n}.1`)
					]
				});
			}
		},
		"money:add": {
			label: "Adding money ($2.40 + $1.75)",
			curriculumTags: TODO$5("money-add"),
			keys: ["money:add"],
			roll: (_k, r) => [int(r, 21, 199) * 5, int(r, 21, 199) * 5],
			make: (_k, [a, b]) => {
				if (!isInt$1(a, 105, 995) || !isInt$1(b, 105, 995) || a % 5 || b % 5) return null;
				const parts = [
					dollars(a),
					"+",
					dollars(b),
					"=",
					"$",
					"?"
				];
				const s = a + b;
				const noCarry = (Math.floor(a / 100) + Math.floor(b / 100)) * 100 + (a % 100 + b % 100) % 100;
				return decimal({
					parts,
					spoken: speak(parts),
					answer: s / 100,
					wrong: [
						noCarry / 100,
						(s + 100) / 100,
						(s + 10) / 100,
						(s - 10) / 100
					],
					fact: `${dollars(a)} + ${dollars(b)} = ${dollars(s)}`
				});
			}
		},
		"money:change": {
			label: "Working out change ($10 − $3.65)",
			curriculumTags: TODO$5("money-change"),
			keys: ["money:change"],
			roll: (_k, r) => {
				const paid = pickOne(r, [
					500,
					1e3,
					2e3
				]);
				return [paid, int(r, 21, paid / 5 - 1) * 5];
			},
			make: (_k, [paid, cost]) => {
				if (![
					500,
					1e3,
					2e3
				].includes(paid) || !isInt$1(cost, 105, paid - 5) || cost % 5) return null;
				const parts = [
					dollars(paid),
					"−",
					dollars(cost),
					"=",
					"$",
					"?"
				];
				const c = paid - cost;
				return decimal({
					parts,
					spoken: speak(parts),
					answer: c / 100,
					wrong: [
						(c + 100) / 100,
						(c + 10) / 100,
						(c - 10) / 100,
						(c + 20) / 100
					],
					fact: `${dollars(paid)} − ${dollars(cost)} = ${dollars(c)}`
				});
			}
		},
		"dec:hundredths:add": {
			label: "Adding hundredths (0.25 + 0.5)",
			curriculumTags: TODO$5("add-hundredths"),
			keys: ["dec:hundredths:add"],
			roll: (_k, r) => {
				let a;
				do
					a = int(r, 11, 99);
				while (a % 10 === 0);
				return [a, int(r, 1, 9) * 10];
			},
			make: (_k, [a, b]) => {
				if (!isInt$1(a, 11, 99) || a % 10 === 0 || !isInt$1(b, 10, 90) || b % 10) return null;
				const parts = [
					hundredths(a),
					"+",
					hundredths(b),
					"=",
					"?"
				];
				return decimal({
					parts,
					spoken: speak(parts),
					answer: (a + b) / 100,
					wrong: [
						(a + b / 10) / 100,
						(a + b + 10) / 100,
						(a + b + 1) / 100,
						(a + b - 10) / 100
					]
				});
			}
		},
		"dec:compare": {
			label: "Which decimal is bigger? (0.5 or 0.45)",
			curriculumTags: TODO$5("compare-decimals"),
			keys: ["dec:compare"],
			roll: (_k, r) => {
				const a = int(r, 1, 9) * 10;
				let b;
				do
					b = int(r, 11, 99);
				while (b % 10 === 0);
				return r() < .5 ? [a, b] : [b, a];
			},
			make: (_k, [a, b]) => {
				if (!isInt$1(a, 1, 99) || !isInt$1(b, 1, 99) || a === b || a % 10 === 0 === (b % 10 === 0)) return null;
				const labels = [hundredths(a), hundredths(b)];
				const answer = a > b ? 0 : 1;
				return decimal({
					parts: ["Which is bigger?"],
					spoken: `Which is bigger: ${labels[0]} or ${labels[1]}?`,
					answer,
					pick: labels,
					fact: `${labels[answer]} is bigger than ${labels[1 - answer]}`
				});
			}
		},
		"dec:times10": {
			label: "Decimals × 10 and × 100 (0.7 × 10)",
			curriculumTags: TODO$5("decimals-times-powers-of-ten"),
			keys: ["dec:times10"],
			roll: (_k, r) => {
				let a;
				do
					a = int(r, 1, 99);
				while (a % 10 === 0);
				return [a, int(r, 1, 2)];
			},
			make: (_k, [a, p]) => {
				if (!isInt$1(a, 1, 99) || a % 10 === 0 || !isInt$1(p, 1, 2)) return null;
				const m = 10 ** p;
				const parts = [
					tenths(a),
					"×",
					String(m),
					"=",
					"?"
				];
				const answer = tidy(a * m / 10);
				return decimal({
					parts,
					spoken: speak(parts),
					answer,
					wrong: [
						a / 10,
						answer * 10,
						answer / 10,
						a / 10 + m
					]
				});
			}
		},
		"dec:round": {
			label: "Rounding decimals to a whole number (3.6 → 4)",
			curriculumTags: TODO$5("round-decimals"),
			keys: ["dec:round"],
			roll: (_k, r) => {
				let a;
				do
					a = int(r, 11, 199);
				while (a % 10 === 0);
				return [a];
			},
			make: (_k, [a]) => {
				if (!isInt$1(a, 11, 199) || a % 10 === 0) return null;
				const down = Math.floor(a / 10);
				const answer = a % 10 >= 5 ? down + 1 : down;
				const parts = [
					"Round",
					tenths(a),
					"to the nearest whole number:",
					"?"
				];
				return decimal({
					parts,
					spoken: speak(parts),
					answer,
					wrong: [
						answer === down ? down + 1 : down,
						a,
						answer + 1,
						a / 10
					],
					fact: `${tenths(a)} rounded to the nearest whole number is ${answer}`
				});
			}
		},
		"dec:times-whole": {
			label: "Decimals × whole numbers (0.3 × 4)",
			curriculumTags: TODO$5("multiply-decimals"),
			keys: ["dec:times-whole"],
			roll: (_k, r) => [int(r, 1, 9), int(r, 2, 9)],
			make: (_k, [a, b]) => {
				if (!isInt$1(a, 1, 9) || !isInt$1(b, 2, 9)) return null;
				const parts = [
					tenths(a),
					"×",
					String(b),
					"=",
					"?"
				];
				return decimal({
					parts,
					spoken: speak(parts),
					answer: a * b / 10,
					wrong: [
						a * b,
						a * b / 100,
						(a * b + 1) / 10,
						(a * b - 1) / 10
					]
				});
			}
		},
		"dec:from-frac": {
			label: "Fractions as decimals (3/4 = 0.75)",
			curriculumTags: TODO$5("fractions-as-decimals"),
			keys: ["dec:from-frac"],
			roll: (_k, r) => r() < .3 ? [int(r, 1, 99), 100] : pickOne(r, FRACTIONS_AS_DECIMALS),
			make: (_k, [n, d]) => {
				if (!(d === 100 ? isInt$1(n, 1, 99) : FRACTIONS_AS_DECIMALS.some(([x, y]) => x === n && y === d))) return null;
				const parts = [
					`${n}/${d}`,
					"=",
					"?"
				];
				return decimal({
					parts,
					spoken: speak(parts),
					answer: n / d,
					wrong: [
						Number(`${n}.${d}`),
						n / 10,
						tidy(n / d + .1),
						d / n / 10
					]
				});
			}
		}
	},
	bands: [
		[
			"dec:tenths:add",
			"dec:tenths:sub",
			"dec:from-frac:tenths"
		],
		["money:add", "money:change"],
		[
			"dec:hundredths:add",
			"dec:compare",
			"dec:times10"
		],
		[
			"dec:round",
			"dec:times-whole",
			"dec:from-frac"
		]
	]
};
//#endregion
//#region shared/maths/skillPacks/division.ts
/**
* Division (the Ice topic in Maths Monsters).
*
* Bands 1–3: division facts (56 ÷ 8 = ?, 56 ÷ ? = 7), one record per fact, in the same
*            order the times-tables campaign brings tables in: ÷ 2, 5, 10, then ÷ 3, 4,
*            then ÷ 6–9. (These are kept apart from the times-tables records so each topic
*            shows its own progress.)
* Not in a band: ÷ 11 and ÷ 12 facts, which only the auto ladder asks (Maths Monsters' bands
*            are unchanged).
* Band 4:    2-digit ÷ 1-digit (84 ÷ 4), dividing by 10 and 100, and missing dividends.
* Band 5:    remainders (23 ÷ 4 = 5 r ?) and 3-digit ÷ 1-digit.
*/
const TODO$4 = (what) => [`TODO-${what}`];
/** Quotients go to 10 in band 1 (like the first Gem Keep levels) and 12 after. */
const factKeys = (divisors, upTo) => divisors.flatMap((d) => Array.from({ length: upTo }, (_, i) => `div:${d * (i + 1)}/${d}`));
const parseFact = (key) => {
	const m = /^div:(\d+)\/(\d+)$/.exec(key);
	return m ? {
		n: Number(m[1]),
		d: Number(m[2])
	} : null;
};
function factFamily(label, divisors, upTo) {
	const keys = factKeys(divisors, upTo);
	const owned = new Set(keys);
	return {
		label,
		curriculumTags: TODO$4("division-facts"),
		keys,
		roll: (key, r) => {
			const { n, d } = parseFact(key);
			return [
				d,
				n / d,
				int(r, 0, 3) === 0 ? 1 : 0
			];
		},
		make: (key, [d, q, v]) => {
			if (!owned.has(key) || !isInt$1(v, 0, 1) || key !== `div:${d * q}/${d}`) return null;
			const n = d * q;
			if (v === 0) {
				const parts = [
					String(n),
					"÷",
					String(d),
					"=",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: q,
					wrong: [
						q + 1,
						q - 1,
						d,
						n - d,
						q + 2
					]
				};
			}
			const parts = [
				String(n),
				"÷",
				"?",
				"=",
				String(q)
			];
			return {
				parts,
				spoken: speak(parts),
				answer: d,
				wrong: [
					d + 1,
					d - 1,
					q,
					n - q
				]
			};
		}
	};
}
const divide = (n, d, extra = {}) => {
	const parts = [
		show(n),
		"÷",
		show(d),
		"=",
		"?"
	];
	return {
		parts,
		spoken: speak(parts),
		answer: n / d,
		...extra
	};
};
const DIVISION = {
	id: "division",
	label: "Division",
	families: {
		"facts-2-5-10": factFamily("Division facts: ÷ 2, ÷ 5, ÷ 10", [
			2,
			5,
			10
		], 10),
		"facts-3-4": factFamily("Division facts: ÷ 3, ÷ 4", [3, 4], 12),
		"facts-11-12": factFamily("Division facts: ÷ 11, ÷ 12", [11, 12], 12),
		"facts-6-9": factFamily("Division facts: ÷ 6, ÷ 7, ÷ 8, ÷ 9", [
			6,
			7,
			8,
			9
		], 12),
		"div:2d/1d": {
			label: "Dividing a 2-digit number (84 ÷ 4)",
			curriculumTags: TODO$4("divide-2d-by-1d"),
			keys: ["div:2d/1d"],
			roll: (_k, r) => {
				const d = int(r, 2, 6);
				return [d, int(r, 11, Math.floor(99 / d))];
			},
			make: (_k, [d, q]) => {
				if (!isInt$1(d, 2, 6) || !isInt$1(q, 11, Math.floor(99 / d))) return null;
				const n = d * q;
				return divide(n, d, { wrong: [
					q + 1,
					q - 1,
					q + 10,
					q - 10
				] });
			}
		},
		"div:by10": {
			label: "Dividing by 10 and 100 (340 ÷ 10)",
			curriculumTags: TODO$4("divide-by-10-100"),
			keys: ["div:by10"],
			roll: (_k, r) => [int(r, 1, 9) * 10 + int(r, 1, 9), int(r, 1, 2)],
			make: (_k, [q, p]) => {
				if (!isInt$1(q, 11, 99) || q % 10 === 0 || !isInt$1(p, 1, 2)) return null;
				const d = 10 ** p;
				return divide(q * d, d, { wrong: [
					q * 10,
					q * 100,
					q + 1,
					q - 1
				] });
			}
		},
		"div:missing": {
			label: "Missing number in a division (? ÷ 4 = 7)",
			curriculumTags: TODO$4("division-missing-dividend"),
			keys: ["div:missing"],
			roll: (_k, r) => [int(r, 2, 9), int(r, 2, 12)],
			make: (_k, [d, q]) => {
				if (!isInt$1(d, 2, 9) || !isInt$1(q, 2, 12)) return null;
				const parts = [
					"?",
					"÷",
					String(d),
					"=",
					String(q)
				];
				return {
					parts,
					spoken: speak(parts),
					answer: d * q,
					wrong: [
						d + q,
						d * q + d,
						d * q - d,
						d * (q + 1) + 1
					]
				};
			}
		},
		"div:remainder": {
			label: "Remainders (23 ÷ 4 = 5 r ?)",
			curriculumTags: TODO$4("division-remainders"),
			keys: ["div:remainder"],
			roll: (_k, r) => {
				const d = int(r, 3, 9);
				return [
					d,
					int(r, 2, 9),
					int(r, 1, d - 1)
				];
			},
			make: (_k, [d, q, rem]) => {
				if (!isInt$1(d, 3, 9) || !isInt$1(q, 2, 9) || !isInt$1(rem, 1, d - 1)) return null;
				const n = d * q + rem;
				const parts = [
					String(n),
					"÷",
					String(d),
					"=",
					String(q),
					"r",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: rem,
					wrong: [
						d - rem,
						rem + 1,
						rem - 1,
						n - d * q + d
					],
					fact: `${n} ÷ ${d} = ${q} r ${rem}`
				};
			}
		},
		"div:3d/1d": {
			label: "Dividing a 3-digit number (756 ÷ 7)",
			curriculumTags: TODO$4("divide-3d-by-1d"),
			keys: ["div:3d/1d"],
			roll: (_k, r) => {
				const d = int(r, 3, 9);
				return [d, int(r, Math.ceil(100 / d), Math.floor(999 / d))];
			},
			make: (_k, [d, q]) => {
				if (!isInt$1(d, 3, 9) || !isInt$1(q, Math.ceil(100 / d), Math.floor(999 / d))) return null;
				return divide(d * q, d, { wrong: [
					q + 1,
					q - 1,
					q + 10,
					q - 10,
					q * 10
				] });
			}
		}
	},
	ladderOnly: ["facts-11-12"],
	bands: [
		["facts-2-5-10"],
		["facts-3-4"],
		["facts-6-9"],
		[
			"div:2d/1d",
			"div:by10",
			"div:missing"
		],
		["div:remainder", "div:3d/1d"]
	]
};
//#endregion
//#region shared/maths/skillPacks/fractions.ts
/**
* Fractions (the Spark topic in Maths Monsters). A part like '3/4' is drawn as a fraction,
* and '?/8' puts the blank in the top.
*
* Band 1: unit fractions of amounts (1/4 of 20), comparing with the same bottom number.
* Band 2: other fractions of amounts (3/4 of 20), equivalent fractions (1/2 = ?/8), comparing
*         with the same top number (2/3 or 2/5: the "bigger bottom = bigger fraction" trap).
* Band 3: adding and taking away with the same bottom number, mixed numbers ↔ improper fractions.
* Band 4: comparing any two fractions, simplifying (6/8 = 3/?).
*/
const TODO$3 = (what) => [`TODO-${what}`];
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const frac = (n, d) => `${n}/${d}`;
/** A "which is bigger?" question: the answer is the index of the bigger fraction. */
function bigger(n1, d1, n2, d2) {
	const labels = [frac(n1, d1), frac(n2, d2)];
	const answer = n1 / d1 > n2 / d2 ? 0 : 1;
	return {
		parts: ["Which is bigger?"],
		spoken: `Which is bigger: ${speak([labels[0]]).replace(/\?$/, "")} or ${speak([labels[1]]).replace(/\?$/, "")}?`,
		answer,
		pick: labels,
		fact: `${labels[answer]} is bigger than ${labels[1 - answer]}`
	};
}
const DENOMINATORS = [
	2,
	3,
	4,
	5,
	6,
	8,
	10,
	12
];
const FRACTIONS = {
	id: "fractions",
	label: "Fractions",
	families: {
		"frac:of:unit": {
			label: "A unit fraction of an amount (1/4 of 20)",
			curriculumTags: TODO$3("unit-fraction-of-amount"),
			keys: ["frac:of:unit"],
			roll: (_k, r) => [pickOne(r, [
				2,
				3,
				4,
				5,
				10
			]), int(r, 1, 10)],
			make: (_k, [d, q]) => {
				if (![
					2,
					3,
					4,
					5,
					10
				].includes(d) || !isInt$1(q, 1, 10)) return null;
				const parts = [
					frac(1, d),
					"of",
					String(d * q),
					"=",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: q,
					wrong: [
						d * q - q,
						q + 1,
						q - 1,
						d,
						d * q - d
					]
				};
			}
		},
		"frac:compare:same-den": {
			label: "Which fraction is bigger? (same bottom number)",
			curriculumTags: TODO$3("compare-fractions"),
			keys: ["frac:compare:same-den"],
			roll: (_k, r) => {
				const d = pickOne(r, [
					3,
					4,
					5,
					6,
					8,
					10,
					12
				]);
				const a = int(r, 1, d - 1);
				let b = int(r, 1, d - 2);
				if (b >= a) b++;
				return [
					a,
					b,
					d
				];
			},
			make: (_k, [a, b, d]) => isInt$1(d, 3, 12) && isInt$1(a, 1, d - 1) && isInt$1(b, 1, d - 1) && a !== b ? bigger(a, d, b, d) : null
		},
		"frac:of:nonunit": {
			label: "A fraction of an amount (3/4 of 20)",
			curriculumTags: TODO$3("fraction-of-amount"),
			keys: ["frac:of:nonunit"],
			roll: (_k, r) => {
				const d = pickOne(r, [
					3,
					4,
					5,
					8,
					10
				]);
				let n;
				do
					n = int(r, 2, d - 1);
				while (gcd(n, d) !== 1);
				return [
					n,
					d,
					int(r, 1, 10)
				];
			},
			make: (_k, [n, d, q]) => {
				if (![
					3,
					4,
					5,
					8,
					10
				].includes(d) || !isInt$1(n, 2, d - 1) || gcd(n, d) !== 1 || !isInt$1(q, 1, 10)) return null;
				const parts = [
					frac(n, d),
					"of",
					String(d * q),
					"=",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: n * q,
					wrong: [
						q,
						d * q / n,
						n * q + q,
						n * q - q,
						d * q - n * q
					]
				};
			}
		},
		"frac:equiv": {
			label: "Equivalent fractions (1/2 = ?/8)",
			curriculumTags: TODO$3("equivalent-fractions"),
			keys: ["frac:equiv"],
			roll: (_k, r) => {
				const d = int(r, 2, 5);
				let n;
				do
					n = int(r, 1, d - 1);
				while (gcd(n, d) !== 1);
				return [
					n,
					d,
					int(r, 2, 5),
					int(r, 0, 1)
				];
			},
			make: (_k, [n, d, k, v]) => {
				if (!isInt$1(d, 2, 5) || !isInt$1(n, 1, d - 1) || gcd(n, d) !== 1 || !isInt$1(k, 2, 5) || !isInt$1(v, 0, 1)) return null;
				const blank = v === 0 ? `?/${d * k}` : `${n * k}/?`;
				const parts = [
					frac(n, d),
					"=",
					blank
				];
				return v === 0 ? {
					parts,
					spoken: speak(parts),
					answer: n * k,
					wrong: [
						n + d * k - d,
						n * k + 1,
						n * k - 1,
						d * k - n
					]
				} : {
					parts,
					spoken: speak(parts),
					answer: d * k,
					wrong: [
						d + n * k - n,
						d * k + 1,
						d * k - 1,
						n * k + d
					]
				};
			}
		},
		"frac:compare:same-num": {
			label: "Which fraction is bigger? (same top number)",
			curriculumTags: TODO$3("compare-fractions"),
			keys: ["frac:compare:same-num"],
			roll: (_k, r) => {
				const d1 = pickOne(r, DENOMINATORS);
				let d2;
				do
					d2 = pickOne(r, DENOMINATORS);
				while (d2 === d1);
				return [
					int(r, 1, Math.min(d1, d2) - 1),
					d1,
					d2
				];
			},
			make: (_k, [n, d1, d2]) => DENOMINATORS.includes(d1) && DENOMINATORS.includes(d2) && d1 !== d2 && isInt$1(n, 1, Math.min(d1, d2) - 1) ? bigger(n, d1, n, d2) : null
		},
		"frac:add:same-den": {
			label: "Adding fractions with the same bottom number",
			curriculumTags: TODO$3("add-fractions"),
			keys: ["frac:add:same-den"],
			roll: (_k, r) => {
				const d = int(r, 3, 12);
				const a = int(r, 1, d - 2);
				return [
					a,
					int(r, 1, d - 1 - a),
					d
				];
			},
			make: (_k, [a, b, d]) => {
				if (!isInt$1(d, 3, 12) || !isInt$1(a, 1, d - 2) || !isInt$1(b, 1, d - 1 - a)) return null;
				const parts = [
					frac(a, d),
					"+",
					frac(b, d),
					"=",
					`?/${d}`
				];
				return {
					parts,
					spoken: speak(parts),
					answer: a + b,
					wrong: [
						a + b + 1,
						a + b - 1,
						a * b,
						Math.abs(a - b)
					]
				};
			}
		},
		"frac:sub:same-den": {
			label: "Taking away fractions with the same bottom number",
			curriculumTags: TODO$3("subtract-fractions"),
			keys: ["frac:sub:same-den"],
			roll: (_k, r) => {
				const d = int(r, 3, 12);
				const a = int(r, 2, d);
				return [
					a,
					int(r, 1, a - 1),
					d
				];
			},
			make: (_k, [a, b, d]) => {
				if (!isInt$1(d, 3, 12) || !isInt$1(a, 2, d) || !isInt$1(b, 1, a - 1)) return null;
				const parts = [
					frac(a, d),
					"−",
					frac(b, d),
					"=",
					`?/${d}`
				];
				return {
					parts,
					spoken: speak(parts),
					answer: a - b,
					wrong: [
						a + b,
						a - b + 1,
						a - b - 1,
						d - b
					]
				};
			}
		},
		"frac:improper": {
			label: "Mixed numbers and improper fractions (2 1/3 = ?/3)",
			curriculumTags: TODO$3("mixed-numbers"),
			keys: ["frac:improper"],
			roll: (_k, r) => {
				const d = int(r, 2, 8);
				return [
					int(r, 1, 4),
					int(r, 1, d - 1),
					d,
					int(r, 0, 1)
				];
			},
			make: (_k, [w, n, d, v]) => {
				if (!isInt$1(d, 2, 8) || !isInt$1(w, 1, 4) || !isInt$1(n, 1, d - 1) || !isInt$1(v, 0, 1)) return null;
				const top = w * d + n;
				if (v === 0) {
					const parts = [
						`${w} ${frac(n, d)}`,
						"=",
						`?/${d}`
					];
					return {
						parts,
						spoken: speak(parts),
						answer: top,
						wrong: [
							w + n,
							w * n + d,
							top + 1,
							top - 1,
							w * d
						]
					};
				}
				const parts = [
					frac(top, d),
					"=",
					`? ${frac(n, d)}`
				];
				return {
					parts,
					spoken: speak(parts),
					answer: w,
					wrong: [
						w + 1,
						w - 1,
						top - n,
						n
					]
				};
			}
		},
		"frac:compare:mixed": {
			label: "Which fraction is bigger? (any two)",
			curriculumTags: TODO$3("compare-fractions"),
			keys: ["frac:compare:mixed"],
			roll: (_k, r) => {
				for (;;) {
					const d1 = pickOne(r, DENOMINATORS);
					const d2 = pickOne(r, DENOMINATORS);
					const n1 = int(r, 1, d1 - 1);
					const n2 = int(r, 1, d2 - 1);
					if (d1 !== d2 && n1 !== n2 && n1 * d2 !== n2 * d1) return [
						n1,
						d1,
						n2,
						d2
					];
				}
			},
			make: (_k, [n1, d1, n2, d2]) => DENOMINATORS.includes(d1) && DENOMINATORS.includes(d2) && d1 !== d2 && isInt$1(n1, 1, d1 - 1) && isInt$1(n2, 1, d2 - 1) && n1 !== n2 && n1 * d2 !== n2 * d1 ? bigger(n1, d1, n2, d2) : null
		},
		"frac:simplify": {
			label: "Simplifying fractions (6/8 = 3/?)",
			curriculumTags: TODO$3("simplify-fractions"),
			keys: ["frac:simplify"],
			roll: (_k, r) => {
				let n;
				const d = int(r, 2, 6);
				do
					n = int(r, 1, d - 1);
				while (gcd(n, d) !== 1);
				return [
					n,
					d,
					int(r, 2, 6),
					int(r, 0, 1)
				];
			},
			make: (_k, [n, d, k, v]) => {
				if (!isInt$1(d, 2, 6) || !isInt$1(n, 1, d - 1) || gcd(n, d) !== 1 || !isInt$1(k, 2, 6) || !isInt$1(v, 0, 1)) return null;
				const parts = [
					frac(n * k, d * k),
					"=",
					v === 0 ? `${n}/?` : `?/${d}`
				];
				return v === 0 ? {
					parts,
					spoken: speak(parts),
					answer: d,
					wrong: [
						d * k - n * k + n,
						d + 1,
						d * k,
						d - 1
					]
				} : {
					parts,
					spoken: speak(parts),
					answer: n,
					wrong: [
						n * k - d * k + d,
						n + 1,
						n * k,
						n + 2
					]
				};
			}
		}
	},
	bands: [
		["frac:of:unit", "frac:compare:same-den"],
		[
			"frac:of:nonunit",
			"frac:equiv",
			"frac:compare:same-num"
		],
		[
			"frac:add:same-den",
			"frac:sub:same-den",
			"frac:improper"
		],
		["frac:compare:mixed", "frac:simplify"]
	]
};
//#endregion
//#region shared/maths/skillPacks/money.ts
/**
* Gold and shopping (Dragon Maths: the shop, the healer, the inn and forest treasure).
*
* Band 1: change from a purchase, and the cost of 2 or 3 of something.
* Band 2: the total of two things, and gold left after buying two things.
* Band 3: swap rates (gems for potions), and "do I have enough?" as how many more gold I need.
* Band 4: which is better value (pick one), and bigger change.
*
* Gold is a whole number, so no decimals. Every question is made from its numbers, so the server can make it again.
*/
const TODO$2 = (what) => [`TODO-${what}`];
const ITEMS = [
	"pie",
	"potion",
	"torch",
	"map",
	"apple pie",
	"rope",
	"shield polish",
	"lantern",
	"bandage",
	"sweet roll"
];
const ITEMS_PLURAL = [
	"pies",
	"potions",
	"torches",
	"maps",
	"apple pies",
	"ropes",
	"tins of polish",
	"lanterns",
	"bandages",
	"sweet rolls"
];
const item = (i) => ITEMS[i % ITEMS.length];
const plural = (i) => ITEMS_PLURAL[i % ITEMS.length];
const gold = (n) => `${show(n)} gold`;
const itemIndex = (r) => int(r, 0, ITEMS.length - 1);
const MONEY = {
	id: "money",
	label: "Gold and shopping",
	families: {
		"money:change": {
			label: "Change from a purchase (40 gold, costs 25)",
			curriculumTags: TODO$2("money-change"),
			keys: ["money:change"],
			roll: (_k, r) => {
				const pay = pickOne(r, [50, 100]);
				const cost = int(r, 3, pay / 5 - 1) * 5;
				return [
					itemIndex(r),
					cost,
					pay
				];
			},
			make: (_k, [i, cost, pay]) => {
				if (!isInt$1(i, 0, ITEMS.length - 1) || !isInt$1(cost, 15, 95) || cost % 5 !== 0 || pay !== 50 && pay !== 100 || cost >= pay) return null;
				const parts = [
					"A",
					item(i),
					"costs",
					gold(cost) + ".",
					`You pay ${gold(pay)}. Change:`,
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: pay - cost,
					wrong: [
						pay - cost + 5,
						pay - cost - 5,
						pay + cost,
						pay - cost + 10,
						pay - cost - 10
					],
					fact: `${show(pay)} − ${show(cost)} = ${show(pay - cost)} gold change`
				};
			}
		},
		"money:several": {
			label: "The cost of 2 or 3 of something (3 pies at 12 gold)",
			curriculumTags: TODO$2("money-several"),
			keys: ["money:several"],
			roll: (_k, r) => [
				itemIndex(r),
				int(r, 2, 5),
				int(r, 2, 12)
			],
			make: (_k, [i, n, price]) => {
				if (!isInt$1(i, 0, ITEMS.length - 1) || !isInt$1(n, 2, 5) || !isInt$1(price, 2, 12)) return null;
				const parts = [
					`${n} ${plural(i)} at`,
					gold(price) + " each cost",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: n * price,
					wrong: [
						n + price,
						n * price + price,
						n * price - price,
						(n + 1) * price + 1
					],
					fact: `${n} × ${price} = ${show(n * price)} gold`
				};
			}
		},
		"money:total": {
			label: "The total of two things (a sword 85 gold and a shield 60 gold)",
			curriculumTags: TODO$2("money-total"),
			keys: ["money:total"],
			roll: (_k, r) => [
				itemIndex(r),
				int(r, 12, 90),
				int(r, 12, 90)
			],
			make: (_k, [i, a, b]) => {
				if (!isInt$1(i, 0, ITEMS.length - 1) || !isInt$1(a, 12, 90) || !isInt$1(b, 12, 90)) return null;
				const j = i + 1;
				const parts = [
					`A ${item(i)} costs`,
					gold(a) + ". ",
					`A ${item(j)} costs`,
					gold(b) + ".",
					"Both cost",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: a + b,
					wrong: [
						a + b + 10,
						a + b - 10,
						Math.abs(a - b),
						a + b + 1,
						a + b - 1
					],
					fact: `${show(a)} + ${show(b)} = ${show(a + b)} gold`
				};
			}
		},
		"money:left": {
			label: "Gold left after buying two things",
			curriculumTags: TODO$2("money-left"),
			keys: ["money:left"],
			roll: (_k, r) => {
				const a = int(r, 10, 60);
				const b = int(r, 10, 60);
				return [
					itemIndex(r),
					a,
					b,
					a + b + int(r, 5, 50)
				];
			},
			make: (_k, [i, a, b, have]) => {
				if (!isInt$1(i, 0, ITEMS.length - 1) || !isInt$1(a, 10, 60) || !isInt$1(b, 10, 60) || !isInt$1(have, a + b + 5, a + b + 50)) return null;
				const parts = [
					`You have ${gold(have)}. You buy a ${item(i)} for`,
					gold(a),
					`and a ${item(i + 1)} for`,
					gold(b) + ". Gold left:",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: have - a - b,
					wrong: [
						have - a,
						have - b,
						have - a - b + 10,
						have - a - b - 10,
						have + a + b
					],
					fact: `${show(a)} + ${show(b)} = ${show(a + b)}, and ${show(have)} − ${show(a + b)} = ${show(have - a - b)} gold left`
				};
			}
		},
		"money:swap": {
			label: "Swap rates (2 gems buy 3 potions: how many potions for 8 gems?)",
			curriculumTags: TODO$2("money-swap"),
			keys: ["money:swap"],
			roll: (_k, r) => {
				const gems = int(r, 2, 4);
				return [
					itemIndex(r),
					gems,
					int(r, 2, 6),
					int(r, 2, 5)
				];
			},
			make: (_k, [i, gems, per, times]) => {
				if (!isInt$1(i, 0, ITEMS.length - 1) || !isInt$1(gems, 2, 4) || !isInt$1(per, 2, 6) || !isInt$1(times, 2, 5)) return null;
				const parts = [
					`${gems} gems buy ${per} ${plural(i)}.`,
					`How many ${plural(i)} for ${gems * times} gems?`,
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: per * times,
					wrong: [
						per + times,
						per * times + per,
						per * (times - 1),
						per * (times + 1),
						gems * times
					],
					fact: `${gems * times} gems is ${times} lots of ${gems}, so ${times} × ${per} = ${per * times} ${plural(i)}`
				};
			}
		},
		"money:short": {
			label: "How much more gold do you need?",
			curriculumTags: TODO$2("money-short"),
			keys: ["money:short"],
			roll: (_k, r) => {
				const have = int(r, 20, 150);
				return [
					itemIndex(r),
					have,
					have + int(r, 8, 90)
				];
			},
			make: (_k, [i, have, cost]) => {
				if (!isInt$1(i, 0, ITEMS.length - 1) || !isInt$1(have, 20, 150) || !isInt$1(cost, have + 8, have + 90)) return null;
				const parts = [
					`You have ${gold(have)}. A ${item(i)} costs`,
					gold(cost) + ". You need",
					"?",
					"more gold."
				];
				return {
					parts,
					spoken: speak(parts),
					answer: cost - have,
					wrong: [
						cost + have,
						cost - have + 10,
						cost - have - 10,
						cost - have + 1,
						cost - have - 1
					],
					fact: `${show(cost)} − ${show(have)} = ${show(cost - have)} gold`
				};
			}
		},
		"money:value": {
			label: "Which is better value? (3 for 12 gold or 5 for 15 gold)",
			curriculumTags: TODO$2("money-value"),
			keys: ["money:value"],
			roll: (_k, r) => {
				for (;;) {
					const unitA = int(r, 2, 9);
					const unitB = int(r, 2, 9);
					if (unitA === unitB) continue;
					const nA = int(r, 2, 6);
					const nB = int(r, 2, 6);
					return [
						itemIndex(r),
						nA,
						unitA * nA,
						nB,
						unitB * nB
					];
				}
			},
			make: (_k, [i, nA, priceA, nB, priceB]) => {
				if (!isInt$1(i, 0, ITEMS.length - 1) || !isInt$1(nA, 2, 6) || !isInt$1(nB, 2, 6) || !isInt$1(priceA, 4, 54) || !isInt$1(priceB, 4, 54)) return null;
				if (priceA % nA !== 0 || priceB % nB !== 0 || priceA / nA === priceB / nB) return null;
				const unitA = priceA / nA;
				const unitB = priceB / nB;
				const parts = [`Deal A: ${nA} ${plural(i)} for ${gold(priceA)}. Deal B: ${nB} ${plural(i)} for ${gold(priceB)}. Which is cheaper for each one?`, "?"];
				return {
					parts,
					spoken: speak(parts),
					answer: unitA < unitB ? 0 : 1,
					pick: [`Deal A (${nA} for ${priceA})`, `Deal B (${nB} for ${priceB})`],
					fact: `A costs ${show(priceA)} ÷ ${nA} = ${unitA} each. B costs ${show(priceB)} ÷ ${nB} = ${unitB} each. ${unitA < unitB ? "A" : "B"} is cheaper.`
				};
			}
		},
		"money:change-big": {
			label: "Bigger change (250 gold, costs 187)",
			curriculumTags: TODO$2("money-change-big"),
			keys: ["money:change-big"],
			roll: (_k, r) => {
				const pay = pickOne(r, [
					200,
					250,
					300,
					500
				]);
				return [
					itemIndex(r),
					int(r, 101, pay - 6),
					pay
				];
			},
			make: (_k, [i, cost, pay]) => {
				if (!isInt$1(i, 0, ITEMS.length - 1) || ![
					200,
					250,
					300,
					500
				].includes(pay) || !isInt$1(cost, 101, pay - 6)) return null;
				const parts = [
					"A",
					item(i),
					"costs",
					gold(cost) + ".",
					`You pay ${gold(pay)}. Change:`,
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: pay - cost,
					wrong: [
						pay - cost + 10,
						pay - cost - 10,
						pay - cost + 100,
						pay - cost - 100,
						pay - cost + 1
					],
					fact: `${show(pay)} − ${show(cost)} = ${show(pay - cost)} gold change`
				};
			}
		}
	},
	bands: [
		["money:change", "money:several"],
		["money:total", "money:left"],
		["money:swap", "money:short"],
		["money:value", "money:change-big"]
	]
};
//#endregion
//#region shared/maths/skillPacks/patterns.ts
/**
* Number patterns (Dragon Maths: riddles, the old woman in the forest, the inn).
*
* Band 1: next number when counting on by 2 to 10 ("3, 7, 11, 15, ?").
* Band 2: counting back, and doubling.
* Band 3: a missing number in the middle, and "what is the step?".
* Band 4: growing steps (+1, +2, +3 ...) and rules like "n × 3 + 1".
*/
const TODO$1 = (what) => [`TODO-${what}`];
const seq = (nums) => nums.map((n) => show(n) + ",").join(" ");
/** The terms of an arithmetic pattern. */
const arithmetic = (start, step, count) => Array.from({ length: count }, (_, i) => start + step * i);
const PATTERNS = {
	id: "patterns",
	label: "Number patterns",
	families: {
		"pat:add": {
			label: "Next number, counting on (3, 7, 11, 15, ?)",
			curriculumTags: TODO$1("pattern-add"),
			keys: ["pat:add"],
			roll: (_k, r) => [int(r, 1, 30), pickOne(r, [
				2,
				3,
				4,
				5,
				6,
				7,
				8,
				9,
				10
			])],
			make: (_k, [start, step]) => {
				if (!isInt$1(start, 1, 30) || !isInt$1(step, 2, 10)) return null;
				const terms = arithmetic(start, step, 5);
				const parts = [
					"What comes next?",
					seq(terms.slice(0, 4)),
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: terms[4],
					wrong: [
						terms[3] + step + 1,
						terms[3] + step - 1,
						terms[3] + 1,
						terms[3] + step * 2
					],
					fact: `It goes up by ${step} each time: ${terms[3]} + ${step} = ${terms[4]}`
				};
			}
		},
		"pat:down": {
			label: "Next number, counting back (50, 45, 40, 35, ?)",
			curriculumTags: TODO$1("pattern-down"),
			keys: ["pat:down"],
			roll: (_k, r) => {
				const step = pickOne(r, [
					2,
					3,
					4,
					5,
					6,
					10
				]);
				return [step, step * 4 + int(r, 2, 40)];
			},
			make: (_k, [step, start]) => {
				if (!isInt$1(step, 2, 10) || !isInt$1(start, step * 4 + 2, step * 4 + 40)) return null;
				const terms = arithmetic(start, -step, 5);
				const parts = [
					"What comes next?",
					seq(terms.slice(0, 4)),
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: terms[4],
					wrong: [
						terms[3] - step - 1,
						terms[3] - step + 1,
						terms[3] + step,
						terms[3] - 1
					],
					fact: `It goes down by ${step} each time: ${terms[3]} − ${step} = ${terms[4]}`
				};
			}
		},
		"pat:double": {
			label: "Doubling (2, 4, 8, 16, ?)",
			curriculumTags: TODO$1("pattern-double"),
			keys: ["pat:double"],
			roll: (_k, r) => [pickOne(r, [
				1,
				2,
				3,
				5
			]), int(r, 3, 4)],
			make: (_k, [start, shown]) => {
				if (![
					1,
					2,
					3,
					5
				].includes(start) || !isInt$1(shown, 3, 4)) return null;
				const terms = Array.from({ length: shown + 1 }, (_, i) => start * 2 ** i);
				const parts = [
					"What comes next?",
					seq(terms.slice(0, shown)),
					"?"
				];
				const last = terms[shown - 1];
				return {
					parts,
					spoken: speak(parts),
					answer: terms[shown],
					wrong: [
						last + 2,
						last + (last - terms[shown - 2]),
						last * 3,
						last + 1
					],
					fact: `Each number is doubled: ${last} × 2 = ${terms[shown]}`
				};
			}
		},
		"pat:missing": {
			label: "A missing number in the middle (5, 9, ?, 17, 21)",
			curriculumTags: TODO$1("pattern-missing"),
			keys: ["pat:missing"],
			roll: (_k, r) => [
				int(r, 1, 40),
				pickOne(r, [
					2,
					3,
					4,
					5,
					6,
					7,
					8,
					9,
					10,
					12
				]),
				int(r, 1, 3)
			],
			make: (_k, [start, step, hole]) => {
				if (!isInt$1(start, 1, 40) || !isInt$1(step, 2, 12) || !isInt$1(hole, 1, 3)) return null;
				const terms = arithmetic(start, step, 5);
				const parts = ["Fill the gap:", ...terms.map((n, i) => i === hole ? "?" : show(n) + (i < 4 ? "," : ""))];
				return {
					parts,
					spoken: speak(parts),
					answer: terms[hole],
					wrong: [
						terms[hole] + 1,
						terms[hole] - 1,
						terms[hole] + step,
						terms[hole] - step
					],
					fact: `It goes up by ${step} each time, so the gap is ${terms[hole - 1]} + ${step} = ${terms[hole]}`
				};
			}
		},
		"pat:step": {
			label: "What is the step? (4, 9, 14, 19: it goes up by ?)",
			curriculumTags: TODO$1("pattern-step"),
			keys: ["pat:step"],
			roll: (_k, r) => [int(r, 1, 40), pickOne(r, [
				2,
				3,
				4,
				5,
				6,
				7,
				8,
				9,
				10,
				11,
				12,
				15,
				20,
				25
			])],
			make: (_k, [start, step]) => {
				if (!isInt$1(start, 1, 40) || !isInt$1(step, 2, 25)) return null;
				const terms = arithmetic(start, step, 4);
				const parts = [
					seq(terms),
					"it goes up by",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: step,
					wrong: [
						step + 1,
						step - 1,
						step + 2,
						step * 2
					],
					fact: `${terms[1]} − ${terms[0]} = ${step}, so it goes up by ${step}`
				};
			}
		},
		"pat:grow": {
			label: "Growing steps (1, 2, 4, 7, 11, ?)",
			curriculumTags: TODO$1("pattern-grow"),
			keys: ["pat:grow"],
			roll: (_k, r) => [int(r, 1, 10), int(r, 1, 3)],
			make: (_k, [start, firstStep]) => {
				if (!isInt$1(start, 1, 10) || !isInt$1(firstStep, 1, 3)) return null;
				const terms = [start];
				for (let i = 0; i < 5; i++) terms.push(terms[i] + firstStep + i);
				const parts = [
					"What comes next?",
					seq(terms.slice(0, 5)),
					"?"
				];
				const lastStep = firstStep + 3;
				return {
					parts,
					spoken: speak(parts),
					answer: terms[5],
					wrong: [
						terms[4] + lastStep,
						terms[4] + lastStep + 2,
						terms[4] + lastStep - 2,
						terms[4] + firstStep
					],
					fact: `The jumps grow by 1 each time: ${firstStep}, ${firstStep + 1}, ${firstStep + 2}, ${lastStep}, so next is ${terms[4]} + ${lastStep + 1} = ${terms[5]}`
				};
			}
		},
		"pat:rule": {
			label: "A rule (n × 3 + 1: what is it when n is 6?)",
			curriculumTags: TODO$1("pattern-rule"),
			keys: ["pat:rule"],
			roll: (_k, r) => [
				int(r, 2, 6),
				int(r, 0, 5),
				int(r, 3, 10)
			],
			make: (_k, [times, plus, n]) => {
				if (!isInt$1(times, 2, 6) || !isInt$1(plus, 0, 5) || !isInt$1(n, 3, 10)) return null;
				const parts = [`Rule: n × ${times}${plus ? ` + ${plus}` : ""}. When n is ${n}, the answer is`, "?"];
				return {
					parts,
					spoken: speak(parts),
					answer: n * times + plus,
					wrong: [
						n * times,
						n + times + plus,
						n * (times + plus),
						n * times + plus + 1,
						n * times + plus - 1
					],
					fact: `${n} × ${times}${plus ? ` + ${plus}` : ""} = ${n * times + plus}`
				};
			}
		}
	},
	bands: [
		["pat:add"],
		["pat:down", "pat:double"],
		["pat:missing", "pat:step"],
		["pat:grow", "pat:rule"]
	]
};
//#endregion
//#region shared/maths/skillPacks/placeValue.ts
/**
* Place value and rounding (the Leaf topic in Maths Monsters).
*
* Band 1: 3-digit numbers: what a digit is worth, partitioning (362 = 300 + ? + 2), 10 more/less.
* Band 2: the same with 4-digit numbers, and 100 or 1000 more/less.
* Band 3: rounding to the nearest 10 and 100.
* Band 4: rounding to the nearest 1000, 5-digit numbers, and × 10, 100, 1000.
*/
const TODO = (what) => [`TODO-${what}`];
/** The digit in a place: place 0 = ones, 1 = tens, 2 = hundreds... */
const digitAt = (n, place) => Math.floor(n / 10 ** place) % 10;
const digitCount = (n) => String(n).length;
/** The places whose digit is not 0 and appears only once (so "the 6" can only mean one digit). */
const askablePlaces = (n, minPlace) => Array.from({ length: digitCount(n) }, (_, p) => p).filter((p) => p >= minPlace && digitAt(n, p) !== 0 && String(n).split("").filter((c) => Number(c) === digitAt(n, p)).length === 1);
function digitWorth(key, label, lo, hi) {
	return {
		label,
		curriculumTags: TODO("place-value-digit"),
		keys: [key],
		roll: (_k, r) => {
			for (;;) {
				const n = int(r, lo, hi);
				const places = askablePlaces(n, 1);
				if (places.length) return [n, places[int(r, 0, places.length - 1)]];
			}
		},
		make: (_k, [n, place]) => {
			if (!isInt$1(n, lo, hi) || !askablePlaces(n, 1).includes(place)) return null;
			const d = digitAt(n, place);
			const parts = [
				"In",
				show(n) + ",",
				"the",
				String(d),
				"is worth",
				"?"
			];
			return {
				parts,
				spoken: speak(parts),
				answer: d * 10 ** place,
				wrong: [
					d,
					d * 10 ** (place + 1),
					d * 10 ** (place - 1),
					d * 10 ** (place + 2)
				],
				fact: `In ${show(n)}, the ${d} is worth ${show(d * 10 ** place)}`
			};
		}
	};
}
function partition(key, label, lo, hi) {
	const ok = (n, place) => isInt$1(n, lo, hi) && isInt$1(place, 1, digitCount(n) - 1) && digitAt(n, place) !== 0 && String(n).replace(/0/g, "").length >= 2;
	return {
		label,
		curriculumTags: TODO("place-value-partition"),
		keys: [key],
		roll: (_k, r) => {
			for (;;) {
				const n = int(r, lo, hi);
				const place = int(r, 1, digitCount(n) - 1);
				if (ok(n, place)) return [n, place];
			}
		},
		make: (_k, [n, place]) => {
			if (!ok(n, place)) return null;
			const terms = [];
			for (let p = digitCount(n) - 1; p >= 0; p--) {
				const d = digitAt(n, p);
				if (d === 0) continue;
				if (terms.length) terms.push("+");
				terms.push(p === place ? "?" : show(d * 10 ** p));
			}
			const parts = [
				show(n),
				"=",
				...terms
			];
			const d = digitAt(n, place);
			return {
				parts,
				spoken: speak(parts),
				answer: d * 10 ** place,
				wrong: [
					d,
					d * 10 ** (place + 1),
					d * 10 ** (place - 1)
				]
			};
		}
	};
}
/** "10 more than 395": steps are 10s (band 1) or 100s and 1000s (band 2). Half the questions cross into the next place. */
function moreLess(key, label, steps, lo, hi) {
	const ok = (n, v, step) => isInt$1(v, 0, 1) && steps.includes(step) && isInt$1(n, lo, hi) && isInt$1(v === 0 ? n + step : n - step, lo - step, hi + step);
	return {
		label,
		curriculumTags: TODO("place-value-more-less"),
		keys: [key],
		roll: (_k, r) => {
			const step = steps[int(r, 0, steps.length - 1)];
			const v = int(r, 0, 1);
			for (;;) {
				let n = int(r, lo, hi);
				if (r() < .5) {
					const digit = v === 0 ? 9 : 0;
					n = n - digitAt(n, Math.log10(step)) * step + digit * step;
				}
				if (ok(n, v, step)) return [
					n,
					v,
					step
				];
			}
		},
		make: (_k, [n, v, step]) => {
			if (!ok(n, v, step)) return null;
			const parts = [
				`${show(step)} ${v === 0 ? "more" : "less"} than`,
				show(n),
				"=",
				"?"
			];
			const answer = v === 0 ? n + step : n - step;
			const place = Math.log10(step);
			const slip = n - digitAt(n, place) * step + (digitAt(n, place) + (v === 0 ? 1 : 9)) % 10 * step;
			return {
				parts,
				spoken: speak(parts),
				answer,
				wrong: [
					slip,
					v === 0 ? n + 1 : n - 1,
					v === 0 ? n + step * 10 : n - step * 10,
					v === 0 ? n - step : n + step
				]
			};
		}
	};
}
function rounding(key, label, to, lo, hi) {
	const ok = (n) => isInt$1(n, lo, hi) && n % to !== 0;
	return {
		label,
		curriculumTags: TODO("rounding"),
		keys: [key],
		roll: (_k, r) => {
			for (;;) {
				let n = int(r, lo, hi);
				if (r() < .2) n = n - n % to + to / 2;
				if (ok(n)) return [n];
			}
		},
		make: (_k, [n]) => {
			if (!ok(n)) return null;
			const down = n - n % to;
			const answer = n % to >= to / 2 ? down + to : down;
			const parts = [
				"Round",
				show(n),
				`to the nearest ${show(to)}:`,
				"?"
			];
			return {
				parts,
				spoken: speak(parts),
				answer,
				wrong: [
					answer === down ? down + to : down,
					Math.round(n / (to * 10)) * to * 10,
					Math.round(n / (to / 10 || 1)) * (to / 10 || 1),
					answer + to
				],
				fact: `${show(n)} rounded to the nearest ${show(to)} is ${show(answer)}`
			};
		}
	};
}
const PLACE_VALUE = {
	id: "place-value",
	label: "Place value and rounding",
	families: {
		"pv:digit:3d": digitWorth("pv:digit:3d", "What a digit is worth (3-digit numbers)", 100, 999),
		"pv:partition:3d": partition("pv:partition:3d", "Splitting 3-digit numbers (362 = 300 + 60 + 2)", 101, 999),
		"pv:10more": moreLess("pv:10more", "10 more and 10 less", [10], 100, 989),
		"pv:digit:4d": digitWorth("pv:digit:4d", "What a digit is worth (4-digit numbers)", 1e3, 9999),
		"pv:partition:4d": partition("pv:partition:4d", "Splitting 4-digit numbers", 1001, 9999),
		"pv:100more": moreLess("pv:100more", "100 and 1000 more and less", [100, 1e3], 1e3, 8999),
		"pv:round10": rounding("pv:round10", "Rounding to the nearest 10", 10, 101, 999),
		"pv:round100": rounding("pv:round100", "Rounding to the nearest 100", 100, 101, 9999),
		"pv:round1000": rounding("pv:round1000", "Rounding to the nearest 1000", 1e3, 1001, 99999),
		"pv:digit:5d": digitWorth("pv:digit:5d", "What a digit is worth (5-digit numbers)", 1e4, 99999),
		"pv:times10": {
			label: "Multiplying by 10, 100 and 1000",
			curriculumTags: TODO("multiply-by-powers-of-ten"),
			keys: ["pv:times10"],
			roll: (_k, r) => [int(r, 2, 99), int(r, 1, 3)],
			make: (_k, [n, p]) => {
				if (!isInt$1(n, 2, 99) || !isInt$1(p, 1, 3)) return null;
				const m = 10 ** p;
				const parts = [
					String(n),
					"×",
					show(m),
					"=",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: n * m,
					wrong: [
						n * m * 10,
						n * m / 10,
						n + m,
						n * 10 ** (p + 2)
					]
				};
			}
		}
	},
	bands: [
		[
			"pv:digit:3d",
			"pv:partition:3d",
			"pv:10more"
		],
		[
			"pv:digit:4d",
			"pv:partition:4d",
			"pv:100more"
		],
		["pv:round10", "pv:round100"],
		[
			"pv:round1000",
			"pv:digit:5d",
			"pv:times10"
		]
	]
};
//#endregion
//#region shared/maths/skillPacks/index.ts
/** The banded packs (everything except times tables, which has its own campaign steps). */
const BANDED_PACKS = {
	"place-value": PLACE_VALUE,
	"add-sub": ADD_SUB,
	division: DIVISION,
	fractions: FRACTIONS,
	decimals: DECIMALS
};
PLACE_VALUE.label, ADD_SUB.label, DIVISION.label, FRACTIONS.label, DECIMALS.label;
const EXTRA_PACKS = {
	money: MONEY,
	patterns: PATTERNS
};
//#endregion
//#region shared/lord/proof.ts
/**
* Checking one maths answer from the browser without trusting it. The browser sends a "proof": which pack
* the question came from, its key and numbers, and what the pupil gave. The server makes the question again
* from the key and numbers (`BandedPack.rebuild`, as Maths Monsters does) and marks it itself. A proof that
* can't be checked counts as wrong, never as an error the pupil sees; the reason is kept for the teacher page.
*/
const KINDS = [
	"multiply",
	"missing-factor",
	"divide"
];
/** The level a question is asked at: a band for most packs, a campaign level for times tables. */
const questionLevel = (pack, heroLevel) => pack === "times-tables" ? [
	1,
	3,
	6,
	9
][defaultBand(heroLevel) - 1] ?? 1 : defaultBand(heroLevel);
const bandedPacks = new Map();
function bandedPack(id) {
	const def = BANDED_PACKS[id] ?? EXTRA_PACKS[id];
	if (!def) return null;
	let pack = bandedPacks.get(id);
	if (!pack) {
		pack = new BandedPack(def);
		bandedPacks.set(id, pack);
	}
	return pack;
}
const isNumber = (n) => typeof n === "number" && Number.isFinite(n);
/**
* Is this a question the game could have asked a hero of this level at this moment, and was it right?
* `only` forces one pack (a forest event's own topic); otherwise the moment's packs are allowed. `on` is the list of
* topics the teacher has left on: a question from any other topic is refused.
*/
function markProof(raw, moment, heroLevel, now, only, on = ALL_TOPICS) {
	if (!raw || typeof raw !== "object") return {
		ok: false,
		problem: "proof"
	};
	const p = raw;
	if (typeof p.pack !== "string") return {
		ok: false,
		problem: "proof-pack"
	};
	if (!(only ? on.includes(only) ? [only] : [] : momentTopics(moment, on)).includes(p.pack)) return {
		ok: false,
		problem: "proof-pack"
	};
	if (typeof p.key !== "string" || p.key.length > 60) return {
		ok: false,
		problem: "proof-key"
	};
	if (!isNumber(p.given)) return {
		ok: false,
		problem: "proof-answer"
	};
	if (p.level !== questionLevel(p.pack, heroLevel)) return {
		ok: false,
		problem: "proof-level"
	};
	const level = p.level;
	const ms = isNumber(p.ms) ? Math.max(0, Math.min(12e4, Math.round(p.ms))) : 6e4;
	let correct;
	if (p.pack === "times-tables") {
		const fact = parseFactKey(p.key);
		if (!fact) return {
			ok: false,
			problem: "proof-key"
		};
		const pools = poolsFor({ level });
		if (![
			...pools.focus,
			...pools.review,
			...pools.stretch
		].includes(p.key)) return {
			ok: false,
			problem: "proof-level"
		};
		if (typeof p.kind !== "string" || !KINDS.includes(p.kind)) return {
			ok: false,
			problem: "proof-kind"
		};
		correct = p.kind === "multiply" ? p.given === fact.a * fact.b : p.given === fact.a || p.given === fact.b;
	} else {
		const pack = bandedPack(p.pack);
		if (!pack) return {
			ok: false,
			problem: "proof-pack"
		};
		const keyBand = pack.bandOf(p.key);
		if (keyBand === void 0 || keyBand > Math.min(level + 1, pack.bandCount)) return {
			ok: false,
			problem: "proof-level"
		};
		if (!Array.isArray(p.params) || p.params.length > 8 || !p.params.every(isNumber)) return {
			ok: false,
			problem: "proof-params"
		};
		const made = pack.rebuild(p.key, p.params);
		if (!made) return {
			ok: false,
			problem: "proof-params"
		};
		correct = sameAnswer(p.given, made.answer);
	}
	return {
		ok: true,
		correct,
		hinted: p.hinted === true,
		answer: {
			pack: p.pack,
			key: p.key,
			correct,
			ms,
			at: now
		}
	};
}
//#endregion
//#region shared/lord/server.ts
const newStats = () => ({
	forestWins: 0,
	masterWins: 0,
	arenaWins: 0,
	riddles: 0,
	dragons: 0,
	bestLevel: 1
});
const newExtra = (stats = newStats()) => ({
	riddleDay: "",
	interestDay: "",
	guess: null,
	pendingEvent: null,
	dragon: null,
	dragonDay: "",
	classOpen: false,
	stats
});
/** An `extra` as saved, filled in where an older save had no such part. */
const readExtra = (saved) => ({
	...newExtra(),
	...saved,
	stats: {
		...newStats(),
		...saved?.stats
	}
});
const FINISH_ACTIONS = [
	"fight-finish",
	"master-finish",
	"dragon-finish"
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SKILLS = [
	"power-strike",
	"zap",
	"mend",
	"dodge",
	"pinch"
];
const ACTIONS = [
	"load",
	"rollover",
	"start-hero",
	"forest",
	"event",
	"fight-finish",
	"master-start",
	"master-finish",
	"dragon-stage",
	"dragon-finish",
	"shop-buy",
	"heal",
	"bank",
	"inn",
	"arena",
	"tools"
];
function parseActions(raw) {
	if (!Array.isArray(raw) || raw.length === 0 || raw.length > 300) return null;
	const out = [];
	for (const a of raw) {
		if (!a || typeof a !== "object") return null;
		if (a.type === "attack" || a.type === "run") out.push({ type: a.type });
		else if (a.type === "skill" && SKILLS.includes(a.skill)) out.push({
			type: "skill",
			skill: a.skill
		});
		else return null;
	}
	return out;
}
const isInt = (n, lo, hi) => typeof n === "number" && Number.isInteger(n) && n >= lo && n <= hi;
const rule = (message) => ({
	refuse: "rule",
	message
});
const isRefuse = (x) => "refuse" in x;
/** Marks a proof and gathers what is needed to record it. A proof that cannot be checked is just wrong. */
function mark(c, raw, moment, only) {
	if (raw === void 0 || raw === null) return {
		result: "wrong",
		skipped: true,
		answers: [],
		notes: []
	};
	const m = markProof(raw, moment, c.w.hero.level, c.now, only, topicsOn(c.settings.topics));
	if (!m.ok) return {
		result: "wrong",
		skipped: false,
		answers: [],
		notes: [m.problem]
	};
	return {
		result: m.correct ? m.hinted ? "hint" : "right" : "wrong",
		skipped: false,
		answers: [m.answer],
		notes: []
	};
}
function startHero(c, existing) {
	const cls = c.req.heroClass;
	if (typeof cls !== "string" || !(cls in CLASSES)) return { refuse: "bad-request" };
	const { hero, extra } = c.w;
	if (existing) {
		if (!(extra.classOpen && hero.forestWins === 0 && hero.exp === 0 && hero.weapon === 0 && hero.armour === 0)) return rule("You already have a hero.");
	}
	const next = newHero(cls, c.today, existing ? { dragonKills: hero.dragonKills } : void 0);
	next.forestLeft = c.settings.forestPerDay;
	return {
		hero: next,
		extra: newExtra(extra.stats),
		summary: { heroClass: cls },
		result: {}
	};
}
function forest(c) {
	const { hero, extra } = c.w;
	if (extra.pendingEvent) return {
		summary: {
			kind: "event",
			again: true
		},
		result: {
			kind: "event",
			eventId: extra.pendingEvent
		}
	};
	if (hero.forestLeft <= 0) return {
		refuse: "no-turns",
		message: "You have used all your forest fights today. Come back tomorrow, or visit the village."
	};
	if (hero.hp <= 0) return rule("You are too hurt to go into the forest. See the healer.");
	const trip = forestTrip(hero, c.s.seed(), eventsOn(topicsOn(c.settings.topics)));
	if (trip.kind === "event") return {
		extra: {
			...extra,
			pendingEvent: trip.event.id
		},
		summary: {
			kind: "event",
			id: trip.event.id
		},
		result: {
			kind: "event",
			eventId: trip.event.id
		}
	};
	const after = useForestTurn(hero);
	return {
		hero: after,
		openFight: {
			id: c.s.newId(),
			kind: "forest",
			seed: trip.seed,
			start: startFight(after, trip.monster, trip.seed),
			info: {
				day: c.today,
				sizeUp: offersSizeItUp(trip.seed)
			}
		},
		summary: {
			kind: "fight",
			monster: trip.monster.id,
			seed: trip.seed
		},
		result: { kind: "fight" }
	};
}
function event(c) {
	const { hero, extra } = c.w;
	const e = extra.pendingEvent ? EVENT_BY_ID[extra.pendingEvent] : void 0;
	if (!e) return rule("There is no event waiting.");
	let right = false;
	let answers = [];
	let notes = [];
	if (e.maths && !c.req.walkOn && topicsOn(c.settings.topics).includes(e.maths.topic)) {
		const m = mark(c, c.req.proof, "treasure", e.maths.topic);
		right = m.result !== "wrong";
		answers = m.answers;
		notes = m.notes;
	}
	return {
		hero: applyEvent(hero, e, right),
		extra: {
			...extra,
			pendingEvent: null
		},
		answers,
		notes,
		summary: {
			event: e.id,
			right
		},
		result: {
			eventId: e.id,
			right,
			walkedOn: !!c.req.walkOn
		}
	};
}
/** After a fight crossed midnight, today's fresh health, skills and master try win over what the old day left. */
function keepToday(next, rolled, crossed) {
	return crossed ? {
		...next,
		hp: rolled.hp,
		skillLeft: rolled.skillLeft,
		masterTried: rolled.masterTried
	} : next;
}
function replayOpen(c, kind, bonus = 1) {
	const open = c.w.open;
	if (!open || open.kind !== kind || open.id !== c.req.fightId) return { refuse: "no-fight" };
	const actions = parseActions(c.req.actions);
	if (!actions) return {
		refuse: "tampered",
		note: "actions"
	};
	let fight;
	try {
		fight = replayFight({
			...open.start,
			firstHitBonus: bonus === 1 ? open.start.firstHitBonus : bonus
		}, actions);
	} catch {
		return {
			refuse: "tampered",
			note: "replay"
		};
	}
	if (!fight.over) return {
		refuse: "tampered",
		note: "unfinished"
	};
	return {
		open,
		fight,
		actions
	};
}
function fightFinish(c) {
	const open = c.w.open;
	let bonus = 1;
	let answers = [];
	let notes = [];
	let sizeUp = null;
	if (open?.kind === "forest" && open.info.sizeUp && c.req.sizeUp) {
		const m = mark(c, c.req.sizeUp, "size-it-up");
		sizeUp = m.result;
		bonus = sizeItUpBonus(m.result);
		answers = m.answers;
		notes = m.notes;
	}
	const played = replayOpen(c, "forest", bonus);
	if (isRefuse(played)) return played;
	const { fight, actions, open: was } = played;
	const crossed = was.info.day !== c.today;
	const hero = keepToday(applyForestResult(c.w.hero, fight), c.w.hero, crossed);
	const rewards = fight.outcome === "won" ? {
		gold: fight.monster.gold + fight.goldPinched,
		exp: fight.monster.exp
	} : {
		gold: 0,
		exp: 0
	};
	const won = fight.outcome === "won";
	return {
		hero,
		answers,
		notes,
		gain: won ? { forestWins: 1 } : void 0,
		news: fight.outcome === "lost" ? [flattenedLine(c.player, fight.monster.name)] : void 0,
		closeFight: {
			status: "finished",
			actions,
			result: {
				outcome: fight.outcome,
				rounds: fight.round,
				...rewards,
				sizeUp
			}
		},
		summary: {
			outcome: fight.outcome,
			monster: fight.monster.id,
			...rewards
		},
		result: {
			outcome: fight.outcome,
			...rewards,
			sizeUp,
			readyForMaster: fight.outcome === "won" && hero.level < 12 && canChallengeMaster(hero).ok
		}
	};
}
function masterStart(c) {
	const { hero } = c.w;
	const check = canChallengeMaster(hero);
	if (!check.ok) return rule(check.reason ?? "Not yet.");
	const proofs = Array.isArray(c.req.trial) ? c.req.trial.slice(0, 3) : [];
	const trial = [];
	const answers = [];
	const notes = [];
	for (let i = 0; i < 3; i++) {
		const m = mark(c, proofs[i], "master-trial");
		trial.push(m.result);
		answers.push(...m.answers);
		notes.push(...m.notes);
	}
	const seed = c.s.seed();
	const start = startMasterFight(hero, seed);
	const open = {
		id: c.s.newId(),
		kind: "master",
		seed,
		start,
		info: {
			day: c.today,
			sizeUp: false,
			trial
		}
	};
	return {
		hero: {
			...hero,
			masterTried: true
		},
		openFight: open,
		answers,
		notes,
		summary: {
			master: start.monster.id,
			trial
		},
		result: { trial }
	};
}
function masterFinish(c) {
	const played = replayOpen(c, "master");
	if (isRefuse(played)) return played;
	const { fight, actions, open } = played;
	const was = c.w.hero;
	let hero = applyMasterResult(was, fight);
	const trial = open.info.trial ?? [];
	if (fight.outcome === "won") hero = addMasterTrialBonus(hero, trial);
	hero = keepToday(hero, was, open.info.day !== c.today);
	const won = fight.outcome === "won";
	return {
		hero,
		gain: won ? { masterWins: 1 } : void 0,
		news: won ? [masterWonLine(c.player, masterFor(was.level)?.name ?? "your master", hero.level)] : void 0,
		closeFight: {
			status: "finished",
			actions,
			result: {
				outcome: fight.outcome,
				rounds: fight.round,
				level: hero.level
			}
		},
		summary: {
			outcome: fight.outcome,
			level: hero.level
		},
		result: {
			outcome: fight.outcome,
			level: hero.level,
			trial,
			bonusStrength: hero.strength - was.strength
		}
	};
}
function dragonStage(c) {
	const { hero, extra } = c.w;
	if (!canFaceDragon(hero)) return rule("You are not ready for the dragon yet.");
	const stage = c.req.stage;
	const expected = extra.dragon?.next ?? 1;
	if (!isInt(stage, 1, 3) || stage !== expected) return rule("That is not the next fight.");
	if (stage === 1 && extra.dragonDay === c.today) return rule("You have already faced the dragon today. Come back tomorrow.");
	const m = mark(c, c.req.riddle, "dragon-trial");
	const seed = c.s.seed();
	const start = startDragonStage(hero, stage, seed, {
		...dragonStageOptions(m.result),
		heroHp: stage === 1 ? hero.hp : extra.dragon.hp
	});
	const open = {
		id: c.s.newId(),
		kind: "dragon",
		seed,
		start,
		info: {
			day: c.today,
			sizeUp: false,
			stage
		}
	};
	return {
		extra: {
			...extra,
			dragonDay: c.today
		},
		openFight: open,
		answers: m.answers,
		notes: m.notes,
		summary: {
			stage,
			riddle: m.result
		},
		result: {
			stage,
			riddle: m.result
		}
	};
}
function dragonFinish(c) {
	const played = replayOpen(c, "dragon");
	if (isRefuse(played)) return played;
	const { fight, actions, open } = played;
	const stage = open.info.stage ?? 1;
	const { hero, extra } = c.w;
	const carried = {
		...hero,
		skillLeft: fight.skillLeft
	};
	let next;
	let dragon = null;
	let finished = false;
	if (fight.outcome !== "won") next = loseToDragon(carried);
	else if (stage < 3) {
		next = carried;
		dragon = {
			next: stage + 1,
			hp: dragonBreather(hero, fight.heroHp)
		};
	} else {
		next = finishDragon(carried, c.today);
		finished = true;
	}
	return {
		hero: next,
		extra: {
			...extra,
			dragon
		},
		gain: finished ? { dragons: 1 } : void 0,
		hall: finished,
		news: finished ? [dragonWonLine(c.player, next.dragonKills)] : void 0,
		closeFight: {
			status: "finished",
			actions,
			result: {
				outcome: fight.outcome,
				rounds: fight.round,
				stage
			}
		},
		summary: {
			outcome: fight.outcome,
			stage,
			finished
		},
		result: {
			outcome: fight.outcome,
			stage,
			finished,
			stars: next.dragonKills,
			hpGoingIn: dragon?.hp ?? null
		}
	};
}
function shopBuy(c) {
	const { slot, index } = c.req;
	if (slot !== "weapon" && slot !== "armour" || !isInt(index, 0, 99)) return { refuse: "bad-request" };
	const full = buyGear(c.w.hero, slot, index);
	if (!full.ok) return rule(full.reason);
	const m = mark(c, c.req.proof, "shop");
	const bought = buyGear(c.w.hero, slot, index, priceDiscount(m.result));
	if (!bought.ok) return rule(bought.reason);
	const item = (slot === "weapon" ? WEAPONS : ARMOURS)[index];
	return {
		hero: bought.hero,
		answers: m.answers,
		notes: m.notes,
		summary: {
			slot,
			item: item.name,
			paid: bought.paid
		},
		result: {
			item: item.name,
			paid: bought.paid,
			refund: bought.refund,
			saved: full.paid - bought.paid
		}
	};
}
function healAction(c) {
	const { hero } = c.w;
	const wanted = c.req.hp;
	if (!isInt(wanted, 1, 1e5)) return { refuse: "bad-request" };
	const missing = hero.maxHp - hero.hp;
	if (missing <= 0) return rule("You are already in perfect health.");
	const m = mark(c, c.req.proof, "healer");
	const discount = priceDiscount(m.result);
	const after = heal(hero, Math.min(wanted, missing), discount);
	if (after.hp === hero.hp) return rule("You cannot afford even one point of healing.");
	return {
		hero: after,
		answers: m.answers,
		notes: m.notes,
		summary: {
			healed: after.hp - hero.hp,
			paid: hero.gold - after.gold
		},
		result: {
			healed: after.hp - hero.hp,
			paid: hero.gold - after.gold,
			discount
		}
	};
}
function bank(c) {
	const { hero, extra } = c.w;
	const op = c.req.op;
	if (op === "deposit" || op === "withdraw") {
		const amount = c.req.amount;
		if (!isInt(amount, 1, 1e9)) return { refuse: "bad-request" };
		const next = op === "deposit" ? deposit(hero, amount) : withdraw(hero, amount);
		if (next.gold === hero.gold) return rule(op === "deposit" ? "You have no gold to put in the bank." : "You have nothing in the bank to take out.");
		return {
			hero: next,
			summary: {
				op,
				moved: Math.abs(next.gold - hero.gold)
			},
			result: { moved: Math.abs(next.gold - hero.gold) }
		};
	}
	if (op !== "interest") return { refuse: "bad-request" };
	if (hero.level < 4) return rule("The banker only talks interest with heroes of level 4 and up.");
	if (hero.bank <= 0) return rule("Save some gold in the bank first.");
	if (extra.interestDay === c.today) return rule("You have already asked about interest today.");
	if (c.req.proof === void 0 || c.req.proof === null) return rule("Answer the banker’s question to earn interest.");
	const m = mark(c, c.req.proof, "bank");
	const extraGold = interestFor(hero.bank, m.result);
	return {
		hero: {
			...hero,
			bank: hero.bank + extraGold
		},
		extra: {
			...extra,
			interestDay: c.today
		},
		answers: m.answers,
		notes: m.notes,
		summary: { interest: extraGold },
		result: {
			interest: extraGold,
			right: m.result !== "wrong"
		}
	};
}
function inn(c) {
	const { hero, extra } = c.w;
	const game = c.req.game;
	if (game === "riddle") {
		if (extra.riddleDay === c.today) return rule("You have done the riddle today. Come back tomorrow!");
		if (c.req.proof === void 0 || c.req.proof === null) return rule("Answer the riddle to earn gold.");
		const m = mark(c, c.req.proof, "riddle");
		const gold = riddleGold(hero.level, m.result);
		return {
			hero: {
				...hero,
				gold: hero.gold + gold
			},
			extra: {
				...extra,
				riddleDay: c.today
			},
			answers: m.answers,
			notes: m.notes,
			summary: {
				riddle: m.result,
				gold
			},
			result: {
				gold,
				right: m.result !== "wrong"
			}
		};
	}
	if (game === "guess-start") {
		if (extra.guess?.day === c.today) return {
			summary: { guess: "again" },
			result: {}
		};
		const secret = 1 + c.s.seed() % 100;
		return {
			extra: {
				...extra,
				guess: {
					day: c.today,
					secret,
					tries: [],
					done: false
				}
			},
			summary: { guess: "start" },
			result: {}
		};
	}
	if (game === "guess") {
		const g = extra.guess;
		const n = c.req.n;
		if (!g || g.day !== c.today) return rule("Start the number game first.");
		if (g.done) return rule("You have played the number game today. Come back tomorrow!");
		if (!isInt(n, 1, 100)) return rule("Pick a whole number from 1 to 100.");
		const hint = n === g.secret ? "win" : n < g.secret ? "low" : "high";
		const tries = [...g.tries, {
			n,
			hint
		}];
		const over = hint === "win" || tries.length >= 7;
		const prize = over ? numberGuessPrize(hero.level, hint === "win") : 0;
		return {
			hero: over ? {
				...hero,
				gold: hero.gold + prize
			} : void 0,
			extra: {
				...extra,
				guess: {
					...g,
					tries,
					done: over
				}
			},
			summary: {
				guess: n,
				hint,
				prize
			},
			result: {
				hint,
				tries: tries.length,
				over,
				prize,
				secret: over && hint !== "win" ? g.secret : void 0
			}
		};
	}
	return { refuse: "bad-request" };
}
const sane = (h) => {
	const x = h;
	return !!x && typeof x === "object" && Number.isInteger(x.level) && x.level >= 1 && x.level <= 12 && Number.isInteger(x.weapon) && x.weapon >= 0 && x.weapon < WEAPONS.length && Number.isInteger(x.armour) && x.armour >= 0 && x.armour < ARMOURS.length && Number.isFinite(x.strength) && Number.isFinite(x.defence) && Number.isFinite(x.maxHp) && x.maxHp > 0 && typeof x.heroClass === "string" && x.heroClass in CLASSES;
};
/** Three fights a day against a saved copy of a classmate's hero or a computer hero, near your level. Played by the server. */
async function arena(c) {
	const { hero } = c.w;
	if (hero.arenaLeft <= 0) return {
		refuse: "no-turns",
		message: "You have used your arena fights today. Come back tomorrow!"
	};
	const season = seasonFor(c.settings, c.today);
	const classmates = await c.s.arenaCandidates(c.player, season.number, hero.level);
	const pool = [];
	if (classmates.ok) {
		for (const k of classmates.value) if (k && typeof k.player === "string" && k.player !== c.player && typeof k.name === "string" && sane(k.hero)) pool.push({
			kind: "pupil",
			id: k.player,
			name: k.name,
			duelist: duelistOf(k.hero, k.name)
		});
	}
	for (const k of computerHeroes(season.number, season.dayOfSeason)) pool.push({
		kind: "computer",
		id: k.id,
		name: k.name,
		duelist: k.duelist
	});
	const gap = (o) => Math.abs(o.duelist.level - hero.level);
	const near = pool.filter((o) => gap(o) <= 1);
	const choices = near.length > 0 ? near : [...pool].sort((x, y) => gap(x) - gap(y)).slice(0, 3);
	const seed = c.s.seed();
	const rand = makeRandom(seed ^ 2779096485);
	const opponent = choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))];
	const you = duelistOf(hero, "You");
	const duel = playDuel(you, opponent.duelist, seed);
	const won = duel.winner === "a";
	const exp = won ? arenaExp(hero.level) : 0;
	const after = {
		...hero,
		arenaLeft: hero.arenaLeft - 1,
		exp: hero.exp + exp,
		arenaWins: hero.arenaWins + (won ? 1 : 0)
	};
	const slug = opponent.kind === "computer" ? `computer-${opponent.id}` : `pupil-${opponent.id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}`;
	const result = {
		outcome: won ? "won" : "lost",
		rounds: duel.rounds,
		hpYou: duel.hpA,
		hpThem: duel.hpB,
		exp,
		log: duel.log
	};
	return {
		hero: after,
		gain: won ? { arenaWins: 1 } : void 0,
		news: won ? [arenaWonLine(c.player, opponent.kind === "computer" ? opponent.name : null)] : void 0,
		doneFight: {
			id: c.s.newId(),
			kind: "arena",
			monster: slug,
			seed,
			start: {
				a: you,
				b: opponent.duelist
			},
			info: {
				day: c.today,
				opponent: {
					kind: opponent.kind,
					name: opponent.name,
					level: opponent.duelist.level
				}
			},
			result
		},
		summary: {
			arena: won ? "won" : "lost",
			against: slug,
			rounds: duel.rounds,
			exp
		},
		result: {
			...result,
			you: {
				name: you.name,
				heroClass: you.heroClass,
				level: you.level,
				maxHp: you.maxHp
			},
			opponent: {
				name: opponent.name,
				heroClass: opponent.duelist.heroClass,
				level: opponent.duelist.level,
				maxHp: opponent.duelist.maxHp,
				computer: opponent.kind === "computer"
			}
		}
	};
}
/** Test tools: for teachers only. The browser trial (preview/lord) is its own teacher. */
async function tools(c) {
	if (!await c.teacher()) return {
		refuse: "not-allowed",
		note: "tools"
	};
	const { hero, extra, open } = c.w;
	const tool = c.req.tool;
	const value = c.req.value;
	if (tool === "abandon-fight") {
		if (!open) return rule("There is no fight to give up.");
		return {
			closeFight: {
				status: "abandoned",
				actions: [],
				result: {}
			},
			summary: { tool },
			result: {}
		};
	}
	if (open) return { refuse: "fight-open" };
	switch (tool) {
		case "jump": {
			const to = typeof value === "number" ? Math.max(1, Math.min(12, Math.round(value))) : 1;
			const base = baseStats(to);
			const gear = Math.min(WEAPONS.length - 1, to - 1);
			return {
				hero: {
					...hero,
					level: to,
					...base,
					hp: base.maxHp,
					weapon: gear,
					armour: gear,
					exp: to < 12 ? expNeeded(to) : expNeeded(11),
					forestLeft: Math.max(hero.forestLeft, 10),
					skillLeft: 3,
					masterTried: false
				},
				extra: {
					...extra,
					dragon: null,
					dragonDay: ""
				},
				summary: {
					tool,
					to
				},
				result: {}
			};
		}
		case "gold": return {
			hero: {
				...hero,
				gold: hero.gold + 1e3
			},
			summary: { tool },
			result: {}
		};
		case "exp": return {
			hero: {
				...hero,
				exp: hero.exp + 500
			},
			summary: { tool },
			result: {}
		};
		case "refill": return {
			hero: {
				...hero,
				forestLeft: c.settings.forestPerDay,
				skillLeft: 3,
				masterTried: false
			},
			extra: {
				...extra,
				dragonDay: ""
			},
			summary: { tool },
			result: {}
		};
		case "hurt": return {
			hero: {
				...hero,
				hp: Math.max(1, Math.floor(hero.maxHp / 5))
			},
			summary: { tool },
			result: {}
		};
		case "best-gear": return {
			hero: {
				...hero,
				weapon: WEAPONS.length - 1,
				armour: ARMOURS.length - 1
			},
			summary: { tool },
			result: {}
		};
		case "new-day": return {
			hero: {
				...hero,
				day: "2000-01-01"
			},
			extra: {
				...extra,
				riddleDay: "",
				interestDay: "",
				guess: null,
				dragonDay: ""
			},
			summary: { tool },
			result: {}
		};
		case "event":
			if (typeof value !== "string" || !EVENT_BY_ID[value]) return { refuse: "bad-request" };
			return {
				extra: {
					...extra,
					pendingEvent: value
				},
				summary: {
					tool,
					event: value
				},
				result: {}
			};
		case "reset": return {
			hero: newHero(hero.heroClass, c.today),
			extra: {
				...newExtra(extra.stats),
				classOpen: true
			},
			summary: { tool },
			result: {}
		};
		default: return { refuse: "bad-request" };
	}
}
const viewOf = (w, version, today, season, settings) => ({
	hero: w?.hero ?? null,
	version,
	today,
	season: {
		number: season.number,
		dayOfSeason: season.dayOfSeason,
		daysLeft: season.daysLeft
	},
	forestPerDay: settings.forestPerDay,
	topics: topicsOn(settings.topics),
	classOpen: w?.extra.classOpen ?? false,
	openFight: w?.open ? {
		id: w.open.id,
		kind: w.open.kind,
		seed: w.open.seed,
		start: w.open.start,
		sizeUp: w.open.info.sizeUp,
		stage: w.open.info.stage,
		trial: w.open.info.trial
	} : null,
	pendingEvent: w?.extra.pendingEvent ?? null,
	dragon: w?.extra.dragon ?? null,
	dragonTried: w?.extra.dragonDay === today,
	riddleDone: w?.extra.riddleDay === today,
	interestDone: w?.extra.interestDay === today,
	guess: w?.extra.guess?.day === today ? {
		done: w.extra.guess.done,
		tries: w.extra.guess.tries
	} : null,
	stats: w?.extra.stats ?? newStats()
});
[...ALL_TOPICS];
/** The season a day falls in. With no start date set, the first season starts today. */
function seasonFor(settings, today) {
	return settings.seasonStart ? seasonOf(settings.seasonStart, today) : {
		number: 1,
		dayOfSeason: 1,
		daysLeft: 34,
		started: true
	};
}
const dayCount = (day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 864e5);
function abandonedHero(open, hero, extra) {
	if (open.kind === "forest") return {
		hero: applyForestResult(hero, {
			...open.start,
			over: true,
			outcome: "lost",
			skillLeft: hero.skillLeft
		}),
		extra
	};
	if (open.kind === "master") return {
		hero: {
			...hero,
			hp: hero.maxHp
		},
		extra
	};
	return {
		hero: loseToDragon(hero),
		extra: {
			...extra,
			dragon: null
		}
	};
}
const busy = () => ({
	status: 503,
	body: { error: "We couldn't reach your hero just now." }
});
/** Runs one request for one signed-in student. Never throws. */
async function runLord(s, player, raw) {
	const req = raw && typeof raw === "object" ? raw : null;
	const action = req?.action;
	if (!req || typeof action !== "string" || !ACTIONS.includes(action)) return {
		status: 200,
		body: {
			ok: false,
			reason: "bad-request"
		}
	};
	const settingsOut = await s.settings(player);
	if (!settingsOut.ok) return busy();
	const settings = settingsOut.value;
	let teacherKnown;
	const teacher = async () => {
		if (teacherKnown === void 0) {
			const t = await s.isTeacher(player);
			teacherKnown = t.ok && t.value;
		}
		return teacherKnown;
	};
	if (!settings.enabled && !await teacher()) return {
		status: 200,
		body: {
			ok: false,
			reason: "closed"
		}
	};
	const now = s.now();
	const today = nzDate(new Date(now));
	const season = seasonFor(settings, today);
	if (!season.started) return {
		status: 200,
		body: {
			ok: false,
			reason: "not-started",
			message: `The season starts in ${season.daysLeft} days.`
		}
	};
	const requestId = req.requestId;
	const validId = typeof requestId === "string" && UUID.test(requestId);
	const loaded = await s.load(player, validId ? requestId : void 0);
	if (!loaded.ok) return busy();
	let row = loaded.value.row;
	let stored = loaded.value.openFight;
	let abandoned = null;
	if (row && stored && dayCount(today) - dayCount(stored.info.day) >= 2) {
		const lost = abandonedHero(stored, row.hero, readExtra(row.extra));
		const out = await s.commit(player, {
			expect: row.version,
			hero: lost.hero,
			season: row.season,
			extra: lost.extra,
			openFight: null,
			closeFight: {
				id: stored.id,
				status: "abandoned",
				actions: [],
				result: {
					outcome: "lost",
					abandoned: true
				}
			},
			event: {
				requestId: s.newId(),
				action: "abandon",
				summary: { fight: stored.kind }
			},
			news: [],
			score: null,
			hall: null,
			doneFight: null
		});
		if (!out.ok) return busy();
		if (out.value.status === "saved") {
			abandoned = stored.kind;
			row = {
				...row,
				hero: lost.hero,
				extra: lost.extra,
				version: out.value.version
			};
			stored = null;
		} else {
			const again = await s.load(player, validId ? requestId : void 0);
			if (!again.ok) return busy();
			row = again.value.row;
			stored = again.value.openFight;
		}
	}
	if (action === "load" && !loaded.value.dailyDone) await s.dailyNews(player, today, dailyNews(today, season));
	let w = null;
	let rolled = false;
	if (row) {
		let hero = row.hero;
		let extra = readExtra(row.extra);
		let rowSeason = row.season;
		if (rowSeason < season.number && !stored) {
			hero = newHero(hero.heroClass, today, { dragonKills: hero.dragonKills });
			extra = {
				...newExtra(extra.stats),
				classOpen: true
			};
			rowSeason = season.number;
			rolled = true;
		}
		if (hero.day !== today) {
			hero = rollDay(hero, today, settings.forestPerDay);
			extra = {
				...extra,
				dragon: null
			};
			rolled = true;
		}
		if (hero.forestLeft > settings.forestPerDay * 2) hero = {
			...hero,
			forestLeft: settings.forestPerDay * 2
		};
		w = {
			hero,
			extra,
			season: rowSeason,
			open: stored
		};
	}
	const finishNow = (state, version) => viewOf(state, version, today, season, settings);
	if (action === "load" || action === "rollover") {
		const note = abandoned ? { abandoned } : {};
		if (!row || !w) return {
			status: 200,
			body: {
				ok: true,
				state: finishNow(null, 0),
				result: {}
			}
		};
		if (!rolled) return {
			status: 200,
			body: {
				ok: true,
				state: finishNow(w, row.version),
				result: note
			}
		};
		const out = await s.commit(player, {
			expect: row.version,
			hero: w.hero,
			season: w.season,
			extra: w.extra,
			openFight: null,
			closeFight: null,
			event: {
				requestId: s.newId(),
				action: "rollover",
				summary: {
					day: today,
					season: w.season
				}
			},
			news: [],
			score: null,
			hall: null,
			doneFight: null
		});
		if (!out.ok) return out.why === "busy" ? busy() : {
			status: 200,
			body: {
				ok: true,
				state: finishNow(w, row.version),
				result: {}
			}
		};
		if (out.value.status !== "saved") {
			const again = await s.load(player);
			if (again.ok && again.value.row) return {
				status: 200,
				body: {
					ok: true,
					state: finishNow({
						hero: again.value.row.hero,
						extra: again.value.row.extra,
						season: again.value.row.season,
						open: again.value.openFight
					}, again.value.row.version),
					result: {}
				}
			};
			return busy();
		}
		return {
			status: 200,
			body: {
				ok: true,
				state: finishNow(w, out.value.version),
				result: note
			}
		};
	}
	const refuse = (reason, message) => ({
		status: 200,
		body: {
			ok: false,
			reason,
			message,
			...w ? { state: finishNow(w, row?.version ?? 0) } : {}
		}
	});
	const note = async (reason) => {
		await s.recordRefusal(player, reason, action);
	};
	if (!validId) {
		await note("bad-request");
		return refuse("bad-request");
	}
	if (loaded.value.seen) return refuse("duplicate");
	const isFinish = FINISH_ACTIONS.includes(action);
	if (action === "start-hero" && !row) {} else if (!row || !w) return refuse("no-hero");
	else {
		if (!isFinish && req.version !== row.version) return refuse("stale");
		if (w.open && !isFinish && action !== "tools") return refuse("fight-open", "Finish your fight first.");
		if (isFinish && !w.open) return refuse("no-fight");
	}
	const base = w ?? {
		hero: newHero("knight", today),
		extra: newExtra(),
		season: season.number,
		open: null
	};
	const ctx = {
		player,
		w: base,
		req,
		today,
		settings,
		now,
		s,
		rolled,
		teacher
	};
	let done;
	switch (action) {
		case "start-hero":
			done = startHero(ctx, !!row);
			break;
		case "forest":
			done = forest(ctx);
			break;
		case "event":
			done = event(ctx);
			break;
		case "fight-finish":
			done = fightFinish(ctx);
			break;
		case "master-start":
			done = masterStart(ctx);
			break;
		case "master-finish":
			done = masterFinish(ctx);
			break;
		case "dragon-stage":
			done = dragonStage(ctx);
			break;
		case "dragon-finish":
			done = dragonFinish(ctx);
			break;
		case "shop-buy":
			done = shopBuy(ctx);
			break;
		case "heal":
			done = healAction(ctx);
			break;
		case "bank":
			done = bank(ctx);
			break;
		case "inn":
			done = inn(ctx);
			break;
		case "arena":
			done = await arena(ctx);
			break;
		case "tools":
			done = await tools(ctx);
			break;
		default: done = { refuse: "bad-request" };
	}
	if (isRefuse(done)) {
		if (done.refuse === "tampered" || done.refuse === "not-allowed" || done.refuse === "bad-request") await note(done.note ?? done.refuse);
		return refuse(done.refuse, done.message);
	}
	for (const code of done.notes ?? []) await note(code);
	const nextHero = done.hero ?? base.hero;
	const gain = done.gain ?? {};
	const rightAnswers = (done.answers ?? []).filter((a) => a.correct).length;
	const before = (done.extra ?? base.extra).stats;
	const stats = {
		forestWins: before.forestWins + (gain.forestWins ?? 0),
		masterWins: before.masterWins + (gain.masterWins ?? 0),
		arenaWins: before.arenaWins + (gain.arenaWins ?? 0),
		riddles: before.riddles + rightAnswers,
		dragons: before.dragons + (gain.dragons ?? 0),
		bestLevel: Math.max(before.bestLevel, nextHero.level)
	};
	const nextExtra = {
		...done.extra ?? base.extra,
		stats
	};
	const nextOpen = done.openFight ?? (done.closeFight ? null : base.open);
	const changed = !!(done.hero || done.extra || done.openFight || done.closeFight || done.doneFight);
	const earned = {
		forest: gain.forestWins ?? 0,
		master: gain.masterWins ?? 0,
		dragon: gain.dragons ?? 0
	};
	const reply = (state, version) => ({
		status: 200,
		body: {
			ok: true,
			state: finishNow(state, version),
			result: done.result
		}
	});
	const after = {
		hero: nextHero,
		extra: nextExtra,
		season: base.season,
		open: nextOpen
	};
	if (!changed && !rolled) return reply(after, row?.version ?? 0);
	const out = await s.commit(player, {
		expect: row?.version ?? 0,
		hero: nextHero,
		season: base.season,
		extra: nextExtra,
		openFight: done.openFight ?? null,
		closeFight: done.closeFight && base.open ? {
			id: base.open.id,
			...done.closeFight
		} : null,
		event: {
			requestId,
			action,
			summary: done.summary
		},
		news: done.news ?? [],
		score: earned.forest + earned.master + earned.dragon > 0 ? earned : null,
		hall: done.hall ? { season: base.season } : null,
		doneFight: done.doneFight ?? null
	});
	if (!out.ok) return out.why === "busy" || out.why === "too-many" ? busy() : refuse("bad-request");
	if (out.value.status !== "saved") {
		const again = await s.load(player);
		const reason = out.value.status === "duplicate" ? "duplicate" : out.value.status === "open-fight" ? "fight-open" : out.value.status === "no-fight" ? "no-fight" : "stale";
		if (again.ok && again.value.row) return {
			status: 200,
			body: {
				ok: false,
				reason,
				state: finishNow({
					hero: again.value.row.hero,
					extra: again.value.row.extra,
					season: again.value.row.season,
					open: again.value.openFight
				}, again.value.row.version)
			}
		};
		return busy();
	}
	const byPack = new Map();
	for (const { pack, ...a } of done.answers ?? []) byPack.set(pack, [...byPack.get(pack) ?? [], a]);
	for (const [pack, list] of byPack) await s.recordAnswers(player, pack, `${requestId}:${pack}`, list);
	return reply(after, out.value.version);
}
//#endregion
//#region supabase/functions/_shared/http.ts
/** Websites allowed to call the server functions from a browser. */
const ALLOWED_ORIGINS = [
	"https://bleedingrobot.github.io",
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:4173",
	"http://127.0.0.1:4173"
];
function corsHeaders(origin) {
	return {
		"Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
		"Access-Control-Max-Age": "7200",
		Vary: "Origin"
	};
}
/** The sign-in token from the request, if there is one. */
function bearerToken(request) {
	return request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1] ?? null;
}
/** Reads a JSON request body. Null if it's missing, unreadable or bigger than MAX_BODY_BYTES. */
async function readJsonBody(request) {
	if (Number(request.headers.get("Content-Length") ?? 0) > 65536) return null;
	try {
		const text = await request.text();
		return text.length > 65536 ? null : JSON.parse(text);
	} catch {
		return null;
	}
}
//#endregion
//#region supabase/functions/_shared/limits.ts
/**
* Counts requests per student in this server's memory. A soft limit: each server copy counts
* separately. (The same as the one in multiplayer/handler.ts, which is left as it is so the
* live multiplayer function doesn't change.)
*/
var RateLimiter = class {
	now;
	hits = new Map();
	constructor(now) {
		this.now = now;
	}
	/** Records a request and says whether it's within `limit` per minute. */
	allow(key, limit) {
		const now = this.now();
		const recent = (this.hits.get(key) ?? []).filter((t) => now - t < 6e4);
		if (recent.length >= limit) {
			this.hits.set(key, recent);
			return false;
		}
		recent.push(now);
		this.hits.set(key, recent);
		if (this.hits.size > 5e3) this.hits.clear();
		return true;
	}
};
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
/** A batch id for the answers of one request and pack: the same request always gives the same id, so a retry is never counted twice. */
async function batchIdFor(key) {
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`lord:${key}`)));
	const h = hex(digest.slice(0, 16));
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleLord(request) {
		const cors = corsHeaders(request.headers.get("Origin"));
		const reply = (status, body) => new Response(JSON.stringify(body), {
			status,
			headers: {
				...cors,
				"Content-Type": "application/json"
			}
		});
		if (request.method === "OPTIONS") return new Response(null, {
			status: 204,
			headers: cors
		});
		if (request.method !== "POST") return reply(405, { error: "Not allowed." });
		const token = bearerToken(request);
		const player = token ? await services.userIdFor(token) : null;
		if (!player) return reply(401, { error: "Please sign in again." });
		if (!limiter.allow(player, 60)) return reply(429, { error: "Slow down a little!" });
		const body = await readJsonBody(request);
		if (!body || typeof body !== "object") return reply(400, { error: "That couldn't be read." });
		const out = await runLord(services, player, body);
		if (out.body && "ok" in out.body && !out.body.ok && [
			"tampered",
			"not-allowed",
			"bad-request"
		].includes(out.body.reason)) console.warn(`lord: turned a request down (${out.body.reason})`);
		return reply(out.status, out.body);
	};
}
//#endregion
//#region supabase/functions/lord/entry.ts
/** The server's own key. Supabase provides it automatically; it never leaves the server. */
function serverKey() {
	const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (legacy) return legacy;
	const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
	return keys.default ?? Object.values(keys)[0] ?? "";
}
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serverKey(), { auth: {
	persistSession: false,
	autoRefreshToken: false
} });
/** Calls a database function. Logs say which one and the error code, never who. */
async function call(name, args) {
	const { data, error } = await admin.rpc(name, args);
	if (!error) return {
		ok: true,
		value: data
	};
	console.error(`lord: ${name} failed (${error.code ?? "unknown"})`);
	if (error.code === "54000") return {
		ok: false,
		why: "too-many"
	};
	if (error.code && /^2[23]/.test(error.code)) return {
		ok: false,
		why: "refused"
	};
	return {
		ok: false,
		why: "busy"
	};
}
Deno.serve(makeHandler({
	now: () => Date.now(),
	seed: () => crypto.getRandomValues(new Uint32Array(1))[0],
	newId: () => crypto.randomUUID(),
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async isTeacher(player) {
		const { data, error } = await admin.from("profiles").select("role").eq("id", player).maybeSingle();
		if (error || !data) return {
			ok: false,
			why: "busy"
		};
		return {
			ok: true,
			value: data.role === "teacher"
		};
	},
	settings: (player) => call("lord_server_settings", { player }),
	load: (player, requestId) => call("load_lord", {
		player,
		request_id: requestId ?? null
	}),
	commit: (player, commit) => call("lord_commit", {
		player,
		change: commit
	}),
	async recordAnswers(player, pack, batchKey, answers) {
		return call("record_fact_answers", {
			player,
			pack,
			batch_id: await batchIdFor(`${batchKey}`),
			answers,
			quick_ms: QUICK_MS,
			fluent_days: 2,
			top_box: 4
		});
	},
	recordRefusal: (player, reason, action) => call("record_lord_refusal", {
		player,
		reason,
		action
	}),
	arenaCandidates: (player, season, level) => call("lord_arena_candidates", {
		player,
		season,
		lvl: level
	}),
	dailyNews: (player, day, lines) => call("lord_daily_news", {
		player,
		news_day: day,
		lines
	})
}));
//#endregion
