// GENERATED FILE: don't edit. Edit supabase/functions/monster/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "monster" function.

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
const BAND_TABLE = {
	"place-value": [
		1,
		1,
		1,
		2,
		2,
		2,
		3,
		3,
		3,
		4,
		4,
		4
	],
	"add-sub": [
		1,
		1,
		1,
		2,
		2,
		2,
		3,
		3,
		3,
		4,
		4,
		4
	],
	"times-tables": [
		1,
		2,
		3,
		4,
		4,
		5,
		6,
		7,
		8,
		9,
		9,
		10
	],
	division: [
		1,
		1,
		2,
		2,
		3,
		3,
		4,
		4,
		4,
		5,
		5,
		5
	],
	fractions: [
		1,
		1,
		1,
		2,
		2,
		2,
		3,
		3,
		3,
		4,
		4,
		4
	],
	decimals: [
		1,
		1,
		1,
		2,
		2,
		2,
		3,
		3,
		3,
		4,
		4,
		4
	]
};
/** The band for a topic in an area (1 to 6). `far` is the far half of the area and its Tower. */
function bandFor(topic, area, far) {
	const a = Math.min(Math.max(Math.round(area), 1), 6);
	return BAND_TABLE[topic][(a - 1) * 2 + (far ? 1 : 0)];
}
/** Wild monster levels in each area [lowest, highest]. Tower trainers use the highest + 2. */
const AREA_LEVELS = [
	[2, 6],
	[7, 12],
	[13, 19],
	[20, 27],
	[28, 36],
	[37, 45]
];
/**
* A correct answer within this many seconds counts as quick. Judged by how hard the question is
* (topic and band), not as a race against anyone: base + perBand × (band − 1).
*/
const QUICK_SECONDS = {
	"place-value": {
		base: 6,
		perBand: 2
	},
	"add-sub": {
		base: 5,
		perBand: 3
	},
	"times-tables": {
		base: 3.5,
		perBand: .8
	},
	division: {
		base: 5,
		perBand: 2.5
	},
	fractions: {
		base: 8,
		perBand: 3
	},
	decimals: {
		base: 7,
		perBand: 3
	}
};
const quickSeconds = (topic, band) => QUICK_SECONDS[topic].base + QUICK_SECONDS[topic].perBand * (band - 1);
//#endregion
//#region shared/monsters/monsterBook.ts
/** What a grown monster's base stats are multiplied by. */
const STAGE_BOOST = [
	1,
	1.25,
	1.55
];
const TYPE_ATTACKS = {
	leaf: {
		basic: {
			name: "Leaf Count",
			power: 35,
			anim: "leaf-1"
		},
		big: {
			name: "Forest Sum",
			power: 80,
			anim: "leaf-3"
		}
	},
	water: {
		basic: {
			name: "Splash Add",
			power: 35,
			anim: "water-1"
		},
		big: {
			name: "Tidal Total",
			power: 80,
			anim: "water-3"
		}
	},
	fire: {
		basic: {
			name: "Spark Times",
			power: 35,
			anim: "fire-1"
		},
		big: {
			name: "Multiply Blaze",
			power: 80,
			anim: "fire-3"
		}
	},
	ice: {
		basic: {
			name: "Frost Share",
			power: 35,
			anim: "ice-1"
		},
		big: {
			name: "Blizzard Split",
			power: 80,
			anim: "ice-3"
		}
	},
	spark: {
		basic: {
			name: "Zap Part",
			power: 35,
			anim: "spark-1"
		},
		big: {
			name: "Thunder Whole",
			power: 80,
			anim: "spark-3"
		}
	},
	stone: {
		basic: {
			name: "Pebble Toss",
			power: 35,
			anim: "stone-1"
		},
		big: {
			name: "Boulder Point",
			power: 80,
			anim: "stone-3"
		}
	}
};
/** THE NAMES FOR JAMES TO OK are in the `names` of each family. */
const FAMILIES = {
	digibud: {
		type: "leaf",
		names: [
			"Digibud",
			"Tensprout",
			"Thousandtree"
		],
		stats: {
			hp: 42,
			atk: 11,
			def: 11
		},
		moves: ["Digit Dart", "Value Vine"],
		evolveAt: [16, 32]
	},
	roundroot: {
		type: "leaf",
		names: [
			"Roundroot",
			"Nearestree",
			"Rounderoak"
		],
		stats: {
			hp: 50,
			atk: 9,
			def: 13
		},
		moves: ["Round Up", "Root Round"],
		evolveAt: [15, 31]
	},
	placepetal: {
		type: "leaf",
		names: [
			"Placepetal",
			"Valuebloom",
			"Millibloom"
		],
		stats: {
			hp: 38,
			atk: 13,
			def: 9
		},
		moves: ["Petal Place", "Bloom Value"],
		evolveAt: [17, 34]
	},
	plusplash: {
		type: "water",
		names: [
			"Plusplash",
			"Sumsplash",
			"Totalwave"
		],
		stats: {
			hp: 40,
			atk: 11,
			def: 11
		},
		moves: ["Plus Puddle", "Sum Surge"],
		evolveAt: [16, 32]
	},
	minnowus: {
		type: "water",
		names: [
			"Minnowus",
			"Minusfin",
			"Minusharker"
		],
		stats: {
			hp: 36,
			atk: 13,
			def: 9
		},
		moves: ["Take Bite", "Minus Current"],
		evolveAt: [16, 33]
	},
	carrycrab: {
		type: "water",
		names: [
			"Carrycrab",
			"Regroupcrab",
			"Kingcarrab"
		],
		stats: {
			hp: 48,
			atk: 10,
			def: 13
		},
		moves: ["Carry Claw", "Borrow Snap"],
		evolveAt: [18, 35]
	},
	factorch: {
		type: "fire",
		names: [
			"Factorch",
			"Factoblaze",
			"Factoinferno"
		],
		stats: {
			hp: 38,
			atk: 13,
			def: 9
		},
		moves: ["Factor Flame", "Table Torch"],
		evolveAt: [16, 32]
	},
	multipup: {
		type: "fire",
		names: [
			"Multipup",
			"Multihound",
			"Multiplosion"
		],
		stats: {
			hp: 42,
			atk: 11,
			def: 11
		},
		moves: ["Times Nip", "Product Pounce"],
		evolveAt: [15, 30]
	},
	squaremander: {
		type: "fire",
		names: [
			"Squaremander",
			"Cubemander",
			"Powermander"
		],
		stats: {
			hp: 46,
			atk: 10,
			def: 12
		},
		moves: ["Square Singe", "Cube Scorch"],
		evolveAt: [18, 36]
	},
	divvy: {
		type: "ice",
		names: [
			"Divvy",
			"Quotipeng",
			"Emperor Quotient"
		],
		stats: {
			hp: 40,
			atk: 11,
			def: 11
		},
		moves: ["Divide Dive", "Quotient Slide"],
		evolveAt: [16, 32]
	},
	remaindeer: {
		type: "ice",
		names: [
			"Remaindeer",
			"Remainstag",
			"Remaindreign"
		],
		stats: {
			hp: 44,
			atk: 12,
			def: 10
		},
		moves: ["Left-over Leap", "Antler Chill"],
		evolveAt: [17, 34]
	},
	sharebear: {
		type: "ice",
		names: [
			"Sharebear",
			"Splitbear",
			"Polarsplit"
		],
		stats: {
			hp: 50,
			atk: 9,
			def: 13
		},
		moves: ["Fair Share", "Equal Swipe"],
		evolveAt: [16, 31]
	},
	fractopus: {
		type: "spark",
		names: [
			"Fractopus",
			"Fractoshock",
			"Fractostorm"
		],
		stats: {
			hp: 40,
			atk: 12,
			def: 10
		},
		moves: ["Half Zap", "Quarter Charge"],
		evolveAt: [16, 32]
	},
	numeratot: {
		type: "spark",
		names: [
			"Numeratot",
			"Numerator",
			"Numeratron"
		],
		stats: {
			hp: 36,
			atk: 13,
			def: 9
		},
		moves: ["Top Spark", "Count Current"],
		evolveAt: [15, 31]
	},
	denomibolt: {
		type: "spark",
		names: [
			"Denomibolt",
			"Denomivolt",
			"Denominator"
		],
		stats: {
			hp: 46,
			atk: 10,
			def: 12
		},
		moves: ["Bottom Bolt", "Equal Parts"],
		evolveAt: [17, 34]
	},
	pebblepoint: {
		type: "stone",
		names: [
			"Pebblepoint",
			"Decimound",
			"Decimountain"
		],
		stats: {
			hp: 48,
			atk: 10,
			def: 12
		},
		moves: ["Point Pelt", "Tenth Tumble"],
		evolveAt: [16, 32]
	},
	coinrock: {
		type: "stone",
		names: [
			"Coinrock",
			"Dollarock",
			"Goldilith"
		],
		stats: {
			hp: 42,
			atk: 11,
			def: 11
		},
		moves: ["Coin Clunk", "Change Crush"],
		evolveAt: [16, 33]
	},
	centipebble: {
		type: "stone",
		names: [
			"Centipebble",
			"Centipillar",
			"Centurock"
		],
		stats: {
			hp: 38,
			atk: 13,
			def: 9
		},
		moves: ["Cent Skip", "Hundredth Hit"],
		evolveAt: [17, 34]
	}
};
/** Moves' power: the type's basic attack is 35, then the family's two own attacks. */
const OWN_POWER = [45, 60];
function build() {
	const out = [];
	for (const [family, f] of Object.entries(FAMILIES)) {
		const { basic, big } = TYPE_ATTACKS[f.type];
		const own = f.moves.map((name, i) => ({
			name,
			power: OWN_POWER[i],
			anim: `${f.type}-2`
		}));
		const idOf = (i) => `${family}-${i + 1}`;
		f.names.forEach((name, i) => {
			const stage = i + 1;
			const boost = STAGE_BOOST[i];
			out.push({
				id: idOf(i),
				name,
				type: f.type,
				family,
				stage,
				stats: {
					hp: Math.round(f.stats.hp * boost),
					atk: Math.round(f.stats.atk * boost),
					def: Math.round(f.stats.def * boost)
				},
				attacks: stage === 1 ? [basic, own[0]] : stage === 2 ? [
					basic,
					own[0],
					own[1]
				] : [
					basic,
					own[0],
					own[1],
					big
				],
				...stage < 3 ? {
					evolvesTo: idOf(i + 1),
					evolveAt: f.evolveAt[i]
				} : {}
			});
		});
	}
	return out;
}
/** All 54 entries, family by family, first form to last. */
const MONSTER_BOOK = build();
const BY_ID = new Map(MONSTER_BOOK.map((s) => [s.id, s]));
/** The form of a family a monster of this level has (first form below its first growth level, and so on). */
function formAt(family, level) {
	const f = FAMILIES[family];
	if (!f) throw new Error(`No monster family "${family}" in the monster book`);
	return `${family}-${level >= f.evolveAt[1] ? 3 : level >= f.evolveAt[0] ? 2 : 1}`;
}
function speciesOf(id) {
	const s = BY_ID.get(id);
	if (!s) throw new Error(`No monster "${id}" in the monster book`);
	return s;
}
//#endregion
//#region shared/monsters/types.ts
/** In wheel order: each type is strong against the one after it, and weak against the one before it. */
const TYPES = [
	"leaf",
	"water",
	"fire",
	"ice",
	"spark",
	"stone"
];
/** The topic a type's attacks (and its catch questions) are asked from. */
const TYPE_TOPIC = {
	leaf: "place-value",
	water: "add-sub",
	fire: "times-tables",
	ice: "division",
	spark: "fractions",
	stone: "decimals"
};
const STRONG_MULTIPLIER = 1.5;
const WEAK_MULTIPLIER = .75;
/** The type this one is strong against. */
const strongAgainst = (t) => TYPES[(TYPES.indexOf(t) + 1) % TYPES.length];
/** The type that is strong against this one. */
const weakTo = (t) => TYPES[(TYPES.indexOf(t) + TYPES.length - 1) % TYPES.length];
/** ×1.5 when the attacker is strong against the defender, ×0.75 when it is weak, otherwise ×1. */
function typeMultiplier(attack, defender) {
	if (strongAgainst(attack) === defender) return STRONG_MULTIPLIER;
	if (weakTo(attack) === defender) return WEAK_MULTIPLIER;
	return 1;
}
//#endregion
//#region shared/monsters/rules.ts
/**
* The numbers behind battles: stats at a level, damage, exp and catching. Every tunable number
* is in TUNING so the simulator (`npm run monsters:sim`) and a human can find them in one place.
*
* The exp curve (level³) and the idea that a catch is easier at low health are adapted from
* Monster Tamer by Dev Share Academy (MIT, © 2024), https://github.com/devshareacademy/monster-tamer
*/
const TUNING = {
	maxLevel: 50,
	/** Damage = power × (attack ÷ defence) × (level + 2) ÷ 7 × this × type × answer, so hits grow with the monster. */
	damageScale: .3,
	/** Wild monsters and trainers hit softer than a student's team (they ask no question). */
	foeDamageScale: .55,
	/** Each hit is between (1 - this) and 1 of its full size. */
	damageSpread: .15,
	answerMultiplier: {
		right: 1,
		"quick-right": 1.5,
		wrong: .25
	},
	/** Exp a defeated monster gives = yield × its level ÷ 5, by its stage; trainers give more. */
	expCurve: 2.5,
	expYield: [
		14,
		20,
		27
	],
	trainerExpBonus: 1.5,
	/** Catching: chance when the monster is at full health, and how much low health adds. */
	catchBase: .2,
	catchLowHealthBonus: .4,
	/** Times the chance, by answer. */
	catchAnswer: {
		right: 2.2,
		"quick-right": 2.8,
		wrong: .6
	},
	/** Grown monsters are harder to catch, by stage. */
	catchStage: [
		1,
		.8,
		.6
	],
	catchMax: .95,
	/** Items. */
	potionHeal: 40,
	superPotionHeal: 120,
	ballPower: {
		ball: 1,
		"great-ball": 1.6
	},
	/** Chance a wild monster picks its best-looking attack instead of a random one. */
	wildSmartChance: .5,
	shinyChance: 1 / 64
};
/**
* Total exp a monster has when it just reached this level (level 1 = 0). Monster Tamer uses level³;
* we use level^2.5 so levels 30-40 don't take six times as many battles as levels 5-10.
*/
const expForLevel = (level) => level <= 1 ? 0 : Math.round(level ** TUNING.expCurve);
function maxHp(species, level) {
	return Math.round(species.stats.hp * level / 10) + level + 10;
}
const power = (base, level) => base * (level + 8);
/** A fresh monster at full health. `random` rolls whether it is a shiny. */
function makeMonster(speciesId, level, random) {
	const species = speciesOf(speciesId);
	const lv = Math.min(Math.max(Math.round(level), 1), TUNING.maxLevel);
	const shiny = random ? random() < TUNING.shinyChance : false;
	return {
		species: speciesId,
		level: lv,
		exp: expForLevel(lv),
		hp: maxHp(species, lv),
		...shiny ? { shiny } : {}
	};
}
const maxHpOf = (m) => maxHp(speciesOf(m.species), m.level);
/**
* Damage from one attack. `answer` is the student's result for their own attacks; foes pass
* undefined (they ask no question) and hit a bit softer. `roll` is a 0-1 random number.
*/
function damageFor(attacker, attackPower, defender, answer, roll) {
	const a = speciesOf(attacker.species);
	const d = speciesOf(defender.species);
	const typeMult = typeMultiplier(a.type, d.type);
	const answerMult = answer ? TUNING.answerMultiplier[answer] : 1;
	const side = answer ? 1 : TUNING.foeDamageScale;
	const spread = 1 - roll * TUNING.damageSpread;
	const raw = attackPower * (power(a.stats.atk, attacker.level) / power(d.stats.def, defender.level)) * TUNING.damageScale * ((attacker.level + 2) / 7) * side * typeMult * answerMult * spread;
	return {
		damage: Math.max(1, Math.floor(raw)),
		effect: typeMult > 1 ? "strong" : typeMult < 1 ? "weak" : "normal"
	};
}
/** Exp for beating a monster, before it is shared out. */
function expYield(foe, trainer) {
	const stage = speciesOf(foe.species).stage;
	return Math.max(1, Math.floor(TUNING.expYield[stage - 1] * foe.level / 5 * (trainer ? TUNING.trainerExpBonus : 1)));
}
/** The chance a ball works: easier at low health, much easier after a right answer. */
function catchChance(wild, answer, ball) {
	const stage = speciesOf(wild.species).stage;
	const hpLeft = wild.hp / maxHpOf(wild);
	const chance = (TUNING.catchBase + TUNING.catchLowHealthBonus * (1 - hpLeft)) * TUNING.catchAnswer[answer] * TUNING.catchStage[stage - 1] * (TUNING.ballPower[ball] ?? 1);
	return Math.min(TUNING.catchMax, Math.max(0, chance));
}
/**
* Puts exp on a monster and levels it up (and grows it) as far as it goes.
* Returns what happened, for the screens.
*/
function gainExp(m, amount) {
	const out = {
		...m,
		exp: m.exp + amount
	};
	const levelUps = [];
	const evolvedTo = [];
	while (out.level < TUNING.maxLevel && out.exp >= expForLevel(out.level + 1)) {
		const before = maxHpOf(out);
		out.level += 1;
		levelUps.push(out.level);
		let sp = speciesOf(out.species);
		if (sp.evolvesTo && sp.evolveAt !== void 0 && out.level >= sp.evolveAt) {
			out.species = sp.evolvesTo;
			evolvedTo.push(sp.evolvesTo);
			sp = speciesOf(out.species);
		}
		if (out.hp > 0) out.hp += maxHpOf(out) - before;
	}
	return {
		monster: out,
		levelUps,
		evolvedTo
	};
}
var BattleRuleError = class extends Error {};
function refuse$1(why) {
	throw new BattleRuleError(why);
}
function newBattle(setup) {
	if (!setup.team.length || setup.team.length > 6) refuse$1("A team has 1 to 6 monsters");
	if (!setup.foes.length) refuse$1("A battle needs a foe");
	if (setup.kind === "wild" && setup.foes.length !== 1) refuse$1("A wild battle has one monster");
	const first = setup.team.findIndex((m) => m.hp > 0);
	if (first < 0) refuse$1("Every monster on the team is tired");
	return {
		state: {
			kind: setup.kind,
			area: setup.area,
			far: setup.far ?? false,
			team: structuredClone(setup.team),
			box: structuredClone(setup.box ?? []),
			bag: { ...setup.bag ?? {} },
			active: first,
			foes: structuredClone(setup.foes),
			foeActive: 0,
			fought: [first],
			phase: "choose",
			turn: 0,
			questions: 0
		},
		events: [{
			kind: "start",
			foe: setup.foes[0].species
		}]
	};
}
const activeMonster = (s) => s.team[s.active];
const activeFoe = (s) => s.foes[s.foeActive];
/** The topic and band the next question for this action should come from. */
function questionFor(state, action) {
	let topic;
	if (action.kind === "fight") topic = TYPE_TOPIC[speciesOf(activeMonster(state).species).type];
	else if (action.kind === "catch") topic = TYPE_TOPIC[speciesOf(activeFoe(state).species).type];
	else return null;
	return {
		topic,
		band: bandFor(topic, state.area, state.far)
	};
}
const isOver = (s) => s.phase === "won" || s.phase === "lost" || s.phase === "ran" || s.phase === "caught";
/** Picks an attack for a foe: trainers always take the best-looking one, wild monsters sometimes. */
function foeAttackIndex(state, random) {
	const species = speciesOf(activeFoe(state).species);
	const target = speciesOf(activeMonster(state).species);
	const best = species.attacks.reduce((bi, a, i, all) => {
		const score = (x) => x.power * typeMultiplier(species.type, target.type);
		return score(a) > score(all[bi]) ? i : bi;
	}, 0);
	const smart = random();
	const pick = random();
	if (state.kind === "trainer" || smart < TUNING.wildSmartChance) return best;
	return Math.min(species.attacks.length - 1, Math.floor(pick * species.attacks.length));
}
/** Does one step of the battle. Throws BattleRuleError for an action that isn't allowed. */
function play(prev, action, random) {
	if (isOver(prev)) refuse$1("The battle is over");
	const s = structuredClone(prev);
	const events = [];
	const me = () => s.team[s.active];
	const foe = () => s.foes[s.foeActive];
	if (s.phase === "replace") {
		if (action.kind !== "switch") refuse$1("Choose a monster to send out");
		checkSwitch(s, action.to, true);
		s.active = action.to;
		s.phase = "choose";
		if (!s.fought.includes(s.active)) s.fought.push(s.active);
		events.push({
			kind: "switch",
			to: me().species
		});
		return {
			state: s,
			events
		};
	}
	s.turn += 1;
	let foeActs = true;
	switch (action.kind) {
		case "fight": {
			const attack = speciesOf(me().species).attacks[action.attack];
			if (!attack) refuse$1("That monster has no such attack");
			if (![
				"right",
				"quick-right",
				"wrong"
			].includes(action.answer)) refuse$1("Unknown answer result");
			s.questions += 1;
			const hit = damageFor(me(), attack.power, foe(), action.answer, random());
			foe().hp = Math.max(0, foe().hp - hit.damage);
			events.push({
				kind: "attack",
				side: "you",
				monster: me().species,
				attack: attack.name,
				anim: attack.anim,
				damage: hit.damage,
				effect: hit.effect,
				answer: action.answer,
				...action.answer === "wrong" ? { showAnswer: true } : {}
			});
			break;
		}
		case "switch":
			checkSwitch(s, action.to, false);
			s.active = action.to;
			if (!s.fought.includes(s.active)) s.fought.push(s.active);
			events.push({
				kind: "switch",
				to: me().species
			});
			break;
		case "item": {
			const have = s.bag[action.item] ?? 0;
			if (have < 1) refuse$1("You have none of those");
			const heal = action.item === "potion" ? TUNING.potionHeal : action.item === "super-potion" ? TUNING.superPotionHeal : refuse$1("That is not a healing item");
			const target = s.team[action.target ?? s.active];
			if (!target) refuse$1("No such monster");
			if (target.hp <= 0) refuse$1("That monster is tired; a potion cannot help");
			const cap = maxHpOf(target);
			if (target.hp >= cap) refuse$1("That monster is already at full health");
			const healed = Math.min(heal, cap - target.hp);
			target.hp += healed;
			s.bag[action.item] = have - 1;
			events.push({
				kind: "item",
				item: action.item,
				monster: target.species,
				healed
			});
			break;
		}
		case "catch": {
			if (s.kind !== "wild") refuse$1("You cannot catch a trainer’s monster");
			const ball = action.ball ?? "ball";
			const have = s.bag[ball] ?? 0;
			if (have < 1) refuse$1("You have no balls left");
			s.bag[ball] = have - 1;
			s.questions += 1;
			const chance = catchChance(foe(), action.answer, ball);
			const success = random() < chance;
			events.push({
				kind: "catch-try",
				chance,
				success
			});
			if (success) {
				const caught = {
					...foe(),
					hp: Math.max(1, foe().hp)
				};
				const to = s.team.length < 6 ? "team" : "box";
				(to === "team" ? s.team : s.box).push(caught);
				events.push({
					kind: "caught",
					monster: caught.species,
					to
				});
				shareExp(s, events);
				s.phase = "caught";
				foeActs = false;
			}
			break;
		}
		case "run":
			if (s.kind !== "wild") refuse$1("You cannot run from a trainer");
			events.push({ kind: "ran" });
			s.phase = "ran";
			foeActs = false;
			break;
		default: refuse$1("Unknown action");
	}
	if (s.phase === "choose" && foe().hp <= 0) {
		events.push({
			kind: "faint",
			side: "foe",
			monster: foe().species
		});
		shareExp(s, events);
		if (s.foeActive + 1 < s.foes.length) {
			s.foeActive += 1;
			s.fought = [s.active];
			events.push({
				kind: "foe-sent",
				foe: foe().species
			});
		} else {
			s.phase = "won";
			events.push({ kind: "won" });
		}
		foeActs = false;
	}
	if (foeActs && s.phase === "choose") {
		const f = foe();
		const attack = speciesOf(f.species).attacks[foeAttackIndex(s, random)];
		const hit = damageFor(f, attack.power, me(), void 0, random());
		me().hp = Math.max(0, me().hp - hit.damage);
		events.push({
			kind: "attack",
			side: "foe",
			monster: f.species,
			attack: attack.name,
			anim: attack.anim,
			damage: hit.damage,
			effect: hit.effect
		});
		if (me().hp <= 0) {
			events.push({
				kind: "faint",
				side: "you",
				monster: me().species
			});
			if (s.team.some((m) => m.hp > 0)) s.phase = "replace";
			else {
				s.phase = "lost";
				events.push({ kind: "lost" });
			}
		}
	}
	return {
		state: s,
		events
	};
}
function checkSwitch(s, to, free) {
	const target = s.team[to];
	if (!Number.isInteger(to) || !target) refuse$1("No such monster");
	if (target.hp <= 0) refuse$1("That monster is tired");
	if (!free && to === s.active) refuse$1("That monster is already out");
}
/** Shares the beaten foe's exp between the living monsters that fought it, then levels them. */
function shareExp(s, events) {
	const alive = s.fought.filter((i) => s.team[i] && s.team[i].hp > 0);
	if (!alive.length) return;
	const each = Math.max(1, Math.floor(expYield(s.foes[s.foeActive], s.kind === "trainer") / alive.length));
	for (const i of alive) {
		const result = gainExp(s.team[i], each);
		const from = s.team[i].species;
		events.push({
			kind: "exp",
			monster: from,
			amount: each
		});
		for (const level of result.levelUps) events.push({
			kind: "level-up",
			monster: result.monster.species,
			level
		});
		let name = from;
		for (const to of result.evolvedTo) {
			events.push({
				kind: "evolved",
				from: name,
				to
			});
			name = to;
		}
		s.team[i] = result.monster;
	}
}
//#endregion
//#region shared/monsters/world/rewards.ts
const LOOT = {
	"trainer-small": {
		potion: 1,
		ball: 2
	},
	"trainer-big": {
		potion: 2,
		ball: 3
	},
	potions: { potion: 3 },
	balls: { ball: 4 },
	mixed: {
		potion: 2,
		ball: 3
	},
	super: {
		"super-potion": 1,
		potion: 1
	},
	great: { "great-ball": 2 },
	repel: { repel: 2 },
	tower: {
		"super-potion": 1,
		"great-ball": 2
	}
};
const ITEM_ORDER = [
	"potion",
	"super-potion",
	"ball",
	"great-ball",
	"repel"
];
function addToBag(bag, loot) {
	const out = { ...bag };
	for (const i of ITEM_ORDER) if (loot[i]) out[i] = (out[i] ?? 0) + loot[i];
	return out;
}
//#endregion
//#region shared/monsters/world/types.ts
const DIRS$1 = [
	"up",
	"down",
	"left",
	"right"
];
var MapError = class extends Error {
	problems;
	constructor(id, problems) {
		super(`Map "${id}" has problems:\n - ${problems.join("\n - ")}`);
		this.problems = problems;
	}
};
const TALKING = [
	"sign",
	"person",
	"nurse",
	"box",
	"book",
	"closed",
	"trainer",
	"chest"
];
const NEEDS_FREE_TILE = [
	"person",
	"nurse",
	"trainer",
	"chest"
];
const BADGES = [
	"leaf",
	"water",
	"fire",
	"ice",
	"spark",
	"stone"
];
function props(o) {
	return Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
}
const text = (v) => typeof v === "string" ? v : "";
const pagesOf = (v) => text(v).split("\n").map((s) => s.trim()).filter(Boolean);
const num = (v, fallback) => typeof v === "number" ? v : fallback;
const dirOf = (v, fallback) => DIRS$1.includes(v) ? v : fallback;
/** True for a family ("fractopus") or a species ("fractopus-2"), the two ways a wild list or a team names a monster. */
function isMonsterName(name) {
	if (FAMILIES[name]) return true;
	try {
		speciesOf(name);
		return true;
	} catch {
		return false;
	}
}
/** "digibud:14,multipup-1:5" → monsters. A family gets the form its level says; anything that doesn't read cleanly is reported. */
function parseTeam(value, problems, who) {
	const team = [];
	for (const part of value.split(",").map((s) => s.trim()).filter(Boolean)) {
		const [name, level] = part.split(":");
		const n = Number(level);
		if (!isMonsterName(name)) {
			problems.push(`${who}: "${name}" is not in the monster book`);
			continue;
		}
		if (!Number.isInteger(n) || n < 1 || n > 50) problems.push(`${who}: "${part}" needs a level from 1 to 50`);
		else team.push({
			species: FAMILIES[name] ? formAt(name, n) : name,
			level: n
		});
	}
	if (!team.length) problems.push(`${who}: a trainer needs a team ("family:level,...")`);
	if (team.length > 3) problems.push(`${who}: a trainer has at most 3 monsters`);
	return team;
}
/** Reads a Tiled map. Throws a `MapError` that lists everything wrong with it. */
function parseMap(id, raw) {
	const problems = [];
	const { width, height } = raw;
	const size = width * height;
	if (!(width > 0 && height > 0)) problems.push("width and height must be more than 0");
	if (raw.tilewidth !== 16 || raw.tileheight !== 16) problems.push(`tiles must be 16 × 16`);
	const last = Math.max(0, ...raw.tilesets.map((t) => t.firstgid + t.tilecount - 1));
	const layer = (name) => {
		const l = raw.layers.find((x) => x.type === "tilelayer" && x.name === name);
		if (!l || !l.data) {
			problems.push(`there is no tile layer called "${name}"`);
			return new Array(size).fill(0);
		}
		if (l.data.length !== size) problems.push(`layer "${name}" has ${l.data.length} tiles, a ${width} × ${height} map needs ${size}`);
		if (l.data.some((g) => !Number.isInteger(g) || g < 0 || g > last)) problems.push(`layer "${name}" uses a tile number that is not in a tileset`);
		return l.data.slice();
	};
	const ground = layer("ground");
	const walls = layer("walls");
	const grass = layer("grass");
	const objectLayer = raw.layers.find((x) => x.type === "objectgroup" && x.name === "objects");
	if (!objectLayer) problems.push("there is no object layer called \"objects\"");
	const mp = props(raw);
	const name = text(mp.name) || id;
	const area = num(mp.area, 0);
	if (!Number.isInteger(area) || area < 0 || area > 6) problems.push("\"area\" must be 0 (a town) or 1 to 6");
	const wild = text(mp.wild).split(",").map((s) => s.trim()).filter(Boolean);
	for (const w of wild) if (!isMonsterName(w)) problems.push(`wild monster "${w}" is not in the monster book`);
	const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
	const things = [];
	const gates = [];
	const warps = [];
	const spots = [];
	const far = new Array(size).fill(false);
	for (const o of objectLayer?.objects ?? []) {
		const type = o.type || o.class || "";
		const p = props(o);
		const x = Math.floor(o.x / 16);
		const y = Math.floor(o.y / 16);
		const label = `${type} "${o.name || o.id}" at ${x},${y}`;
		if (type === "far") {
			const w = Math.max(1, Math.round((o.width ?? 16) / 16));
			const h = Math.max(1, Math.round((o.height ?? 16) / 16));
			for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inside(xx, yy)) far[yy * width + xx] = true;
			continue;
		}
		if (!inside(x, y)) {
			problems.push(`${label} is outside the map`);
			continue;
		}
		if (type === "gate") {
			const badge = text(p.badge);
			const pages = pagesOf(p.text);
			if (!BADGES.includes(badge)) problems.push(`${label} needs a "badge" (${BADGES.join(", ")})`);
			if (!pages.length) problems.push(`${label} has no text`);
			if (typeof p.gid !== "number") problems.push(`${label} needs a "gid" (the tile drawn while it is closed)`);
			gates.push({
				id: `${id}:${o.name || o.id}`,
				x,
				y,
				badge,
				pages,
				gid: num(p.gid, 0)
			});
		} else if (type === "warp") warps.push({
			id: `${id}:${o.name || o.id}`,
			x,
			y,
			to: text(p.to),
			toX: num(p.toX, -1),
			toY: num(p.toY, -1),
			facing: dirOf(p.facing, "down")
		});
		else if (type === "spot") {
			if (!o.name) problems.push(`${label} needs a name`);
			spots.push({
				name: o.name ?? "",
				x,
				y,
				facing: dirOf(p.facing, "down")
			});
		} else if (TALKING.includes(type)) {
			const kind = type;
			const pages = pagesOf(p.text);
			if (!pages.length) problems.push(`${label} has no text`);
			const thing = {
				kind,
				id: `${id}:${o.name || o.id}`,
				name: o.name ?? "",
				x,
				y,
				facing: dirOf(p.facing, "down"),
				pages
			};
			if (kind === "person" || kind === "trainer" || kind === "nurse") {
				if (typeof p.sprite !== "number") problems.push(`${label} needs a "sprite" number`);
				else thing.sprite = p.sprite;
				if (!o.name) problems.push(`${label} needs a name`);
			}
			if (kind === "trainer") {
				thing.sight = num(p.sight, 4);
				thing.winPages = pagesOf(p.win);
				if (!thing.winPages.length) problems.push(`${label} needs "win" text (what they say after you win)`);
				thing.team = parseTeam(text(p.team), problems, label);
				if (p.badge !== void 0) {
					if (BADGES.includes(text(p.badge))) thing.badge = text(p.badge);
					else problems.push(`${label}: "${text(p.badge)}" is not a badge (${BADGES.join(", ")})`);
				}
			}
			if (kind === "trainer" || kind === "chest") {
				if (p.loot !== void 0 || kind === "chest") {
					if (LOOT[text(p.loot)]) thing.loot = text(p.loot);
					else problems.push(`${label}: "${text(p.loot)}" is not a bundle in rewards.ts`);
				}
			}
			if (kind === "chest") {
				if (typeof p.gid !== "number" || typeof p.open !== "number") problems.push(`${label} needs "gid" and "open" (the tiles for closed and open)`);
				else {
					thing.gid = p.gid;
					thing.openGid = p.open;
				}
			}
			things.push(thing);
		} else problems.push(`${label}: "${type}" is not a kind of object (sign, person, nurse, box, book, closed, trainer, chest, gate, warp, spot, far)`);
	}
	const walled = (x, y) => walls[y * width + x] !== 0;
	for (const t of things) if (NEEDS_FREE_TILE.includes(t.kind) && walled(t.x, t.y)) problems.push(`${t.kind} "${t.name}" at ${t.x},${t.y} is standing on a wall tile`);
	const taken = new Map();
	for (const o of [
		...things.map((t) => ({
			x: t.x,
			y: t.y,
			n: t.id
		})),
		...warps.map((w) => ({
			x: w.x,
			y: w.y,
			n: w.id
		})),
		...gates.map((g) => ({
			x: g.x,
			y: g.y,
			n: g.id
		}))
	]) {
		const k = `${o.x},${o.y}`;
		if (taken.has(k)) problems.push(`${o.n} and ${taken.get(k)} are on the same tile (${k})`);
		taken.set(k, o.n);
	}
	const ids = new Set();
	for (const t of things) {
		if (ids.has(t.id)) problems.push(`two objects are both called "${t.name}"`);
		ids.add(t.id);
	}
	if (problems.length) throw new MapError(id, problems);
	const blocked = walls.map((g) => g !== 0);
	for (const t of things) blocked[t.y * width + t.x] = true;
	for (const g of gates) blocked[g.y * width + g.x] = true;
	return {
		id,
		name,
		width,
		height,
		area,
		ground,
		walls,
		grass,
		blocked,
		isGrass: grass.map((g) => g !== 0),
		far,
		things,
		gates,
		warps,
		spots,
		wild
	};
}
const WORLD_MAPS = Object.fromEntries(Object.entries({
	"harbour-town": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 24,
		height: 18,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 16,
		nextobjectid: 16,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Harbour Town"
			},
			{
				"name": "area",
				"type": "int",
				"value": 0
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 15,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 24,
				"height": 18,
				"opacity": 1,
				"visible": true,
				"data": [
					2,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					2,
					1,
					2,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					2,
					1,
					3,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					2,
					3,
					1,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					2,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					25,
					27,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					25,
					27,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					25,
					27,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					2,
					1,
					1,
					13,
					14,
					15,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					13,
					14,
					15,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					25,
					26,
					27,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					25,
					26,
					27,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					25,
					26,
					27,
					1,
					1,
					1,
					1,
					25,
					27,
					2,
					1,
					25,
					26,
					27,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					13,
					26,
					26,
					26,
					14,
					14,
					14,
					14,
					26,
					26,
					14,
					14,
					26,
					26,
					26,
					14,
					14,
					15,
					3,
					1,
					1,
					1,
					1,
					1,
					37,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					38,
					39,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					2,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1
				]
			},
			{
				"id": 16,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 24,
				"height": 18,
				"opacity": 1,
				"visible": true,
				"data": [
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					0,
					0,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					29,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					0,
					0,
					0,
					0,
					29,
					0,
					0,
					0,
					0,
					0,
					29,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					29,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					0,
					0,
					0,
					29,
					0,
					0,
					0,
					29,
					29,
					0,
					81,
					82,
					82,
					83,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					53,
					54,
					55,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					49,
					50,
					51,
					0,
					0,
					0,
					5,
					29,
					29,
					49,
					50,
					51,
					0,
					65,
					66,
					67,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					61,
					62,
					63,
					0,
					0,
					0,
					17,
					29,
					29,
					61,
					62,
					63,
					0,
					77,
					78,
					80,
					5,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					73,
					74,
					76,
					0,
					0,
					0,
					0,
					29,
					29,
					77,
					78,
					80,
					0,
					89,
					90,
					89,
					17,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					85,
					85,
					85,
					0,
					53,
					54,
					55,
					29,
					29,
					89,
					89,
					89,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					65,
					66,
					67,
					29,
					29,
					0,
					5,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					73,
					74,
					76,
					29,
					29,
					0,
					17,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					85,
					85,
					85,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					196,
					222,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					81,
					82,
					82,
					265,
					265,
					265,
					265,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					0,
					0,
					0,
					29,
					0,
					0,
					0,
					265,
					265,
					265,
					265,
					0,
					0,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29
				]
			},
			{
				"id": 17,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 24,
				"height": 18,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 18,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "welcome",
						"type": "sign",
						"x": 144,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Welcome to Harbour Town! The wild monsters live up the road, in Kauri Bush."
						}]
					},
					{
						"id": 2,
						"name": "healing-sign",
						"type": "sign",
						"x": 128,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Healing Centre. Tired monsters rest here."
						}]
					},
					{
						"id": 3,
						"name": "north-sign",
						"type": "sign",
						"x": 224,
						"y": 16,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "North: Kauri Bush. Watch out for long grass!"
						}]
					},
					{
						"id": 4,
						"name": "pond-sign",
						"type": "sign",
						"x": 256,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Please do not feed the Minnowus."
						}]
					},
					{
						"id": 5,
						"name": "Teacher",
						"type": "person",
						"x": 208,
						"y": 240,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 84
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Hello! I am your teacher. Welcome to Maths Monsters!\nEvery monster stands for one kind of maths. Fire is times tables, Water is adding and taking away.\nIn a battle your monster attacks by answering a maths question. Right answers hit hard, quick ones hit harder, and a wrong one still does a little.\nNobody ever loses anything for a wrong answer. If your team gets tired, you just wake up at the Healing Centre.\nWalk in the long grass up north to find wild monsters. Throw a ball to catch them!\nThe end of each area has a Topic Tower. Beat its trainer to win a badge and open the way to the next area.\nPress M or Escape to open your menu any time.\nGood luck!"
							}
						]
					},
					{
						"id": 6,
						"name": "Fisher",
						"type": "person",
						"x": 304,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 111
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "The Minnowus here are so quick. I swear one swam off with my sandwich."
							}
						]
					},
					{
						"id": 7,
						"name": "Monster box",
						"type": "box",
						"x": 48,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "This is your Monster box. It keeps the monsters that do not fit in your team of six.\nYour box holds {box} monsters. Let us have a look!"
						}]
					},
					{
						"id": 8,
						"name": "Monster book",
						"type": "book",
						"x": 32,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "This is the Monster book. It lists every monster you meet, with its type, its maths and how it grows.\nLet us have a look!"
						}]
					},
					{
						"id": 9,
						"name": "to-bush-left",
						"type": "warp",
						"x": 176,
						"y": 0,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "kauri-bush"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 11
							},
							{
								"name": "toY",
								"type": "int",
								"value": 18
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 10,
						"name": "to-bush-right",
						"type": "warp",
						"x": 192,
						"y": 0,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "kauri-bush"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 12
							},
							{
								"name": "toY",
								"type": "int",
								"value": 18
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 11,
						"name": "to-healing-centre",
						"type": "warp",
						"x": 96,
						"y": 128,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "healing-centre"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 5
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 12,
						"name": "start",
						"type": "spot",
						"x": 176,
						"y": 240,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 13,
						"name": "box",
						"type": "spot",
						"x": 48,
						"y": 240,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 14,
						"name": "book",
						"type": "spot",
						"x": 32,
						"y": 208,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					}
				]
			}
		]
	},
	"healing-centre": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 10,
		height: 7,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 6,
		nextobjectid: 6,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Healing Centre"
			},
			{
				"name": "area",
				"type": "int",
				"value": 0
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 5,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 10,
				"height": 7,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 6,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 10,
				"height": 7,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					0,
					94,
					205,
					205,
					0,
					205,
					205,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					90,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 7,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 10,
				"height": 7,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 8,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Nurse Joy",
						"type": "nurse",
						"x": 64,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the Healing Centre! Let me look after your monsters."
							}
						]
					},
					{
						"id": 2,
						"name": "poster",
						"type": "sign",
						"x": 16,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A poster: \"A rested monster is a happy monster. Talk to the nurse any time!\""
						}]
					},
					{
						"id": 3,
						"name": "out",
						"type": "warp",
						"x": 80,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "harbour-town"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 6
							},
							{
								"name": "toY",
								"type": "int",
								"value": 9
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 4,
						"name": "wake",
						"type": "spot",
						"x": 64,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"kauri-bush": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 25,
		height: 20,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 28,
		nextobjectid: 28,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Area 1: Kauri Bush"
			},
			{
				"name": "area",
				"type": "int",
				"value": 1
			},
			{
				"name": "wild",
				"type": "string",
				"value": "digibud,digibud,roundroot,roundroot,placepetal,placepetal,plusplash,minnowus,multipup,divvy,fractopus,pebblepoint"
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 27,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					2,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					2,
					1,
					2,
					3,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					13,
					14,
					14,
					15,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					2,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					2,
					1,
					25,
					26,
					38,
					39,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					25,
					27,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					13,
					14,
					14,
					14,
					26,
					27,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					1,
					37,
					38,
					38,
					38,
					26,
					27,
					2,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					1,
					1,
					3,
					2,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					2,
					1,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					1,
					1,
					2,
					2,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					3,
					1,
					25,
					27,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					13,
					14,
					14,
					14,
					14,
					14,
					14,
					26,
					27,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					2,
					25,
					26,
					38,
					38,
					38,
					38,
					38,
					38,
					39,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					3,
					1,
					1,
					1,
					1,
					25,
					27,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					13,
					14,
					14,
					14,
					14,
					14,
					14,
					26,
					27,
					2,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					2,
					2,
					3,
					1,
					37,
					38,
					38,
					38,
					38,
					38,
					38,
					26,
					27,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					2,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					2,
					25,
					27,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					25,
					27,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					25,
					27,
					1,
					3,
					2,
					2,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1
				]
			},
			{
				"id": 28,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					0,
					29,
					29,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					49,
					50,
					50,
					50,
					51,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					61,
					62,
					62,
					62,
					63,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					5,
					0,
					0,
					77,
					78,
					78,
					78,
					80,
					0,
					0,
					0,
					0,
					0,
					5,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					17,
					0,
					0,
					89,
					78,
					78,
					78,
					89,
					0,
					0,
					0,
					0,
					0,
					17,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					89,
					89,
					90,
					89,
					89,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					29,
					29,
					0,
					0,
					0,
					0,
					5,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					5,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					17,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					17,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					5,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					0,
					0,
					0,
					0,
					0,
					53,
					54,
					55,
					0,
					0,
					0,
					17,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					29,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					65,
					66,
					67,
					0,
					0,
					0,
					0,
					265,
					265,
					265,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					73,
					74,
					76,
					0,
					0,
					0,
					0,
					265,
					265,
					265,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					85,
					85,
					85,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					0,
					0,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29
				]
			},
			{
				"id": 29,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					267,
					267,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					0,
					267,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					0,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 30,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "far half",
						"type": "far",
						"x": 0,
						"y": 0,
						"width": 400,
						"height": 160,
						"rotation": 0,
						"visible": true,
						"properties": []
					},
					{
						"id": 2,
						"name": "to-tower",
						"type": "warp",
						"x": 224,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-1-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 7
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 3,
						"name": "Nurse Pania",
						"type": "nurse",
						"x": 208,
						"y": 240,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Kia ora! I look after tired monsters here in the bush."
							}
						]
					},
					{
						"id": 4,
						"name": "area-2-gate",
						"type": "gate",
						"x": 336,
						"y": 16,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "badge",
								"type": "string",
								"value": "leaf"
							},
							{
								"name": "text",
								"type": "string",
								"value": "A rope fence blocks the path north. A sign says: \"Shell Beach. Only for trainers with a Leaf badge!\""
							},
							{
								"name": "gid",
								"type": "int",
								"value": 82
							}
						]
					},
					{
						"id": 5,
						"name": "to-shell-beach",
						"type": "warp",
						"x": 336,
						"y": 0,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "shell-beach"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 21
							},
							{
								"name": "toY",
								"type": "int",
								"value": 18
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 6,
						"name": "bush-sign",
						"type": "sign",
						"x": 160,
						"y": 288,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Kauri Bush. Wild monsters hide in the long grass. Walk in it and see who jumps out!"
						}]
					},
					{
						"id": 7,
						"name": "trail-sign",
						"type": "sign",
						"x": 256,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "North: the Leaf Tower and Shell Beach. South: Harbour Town."
						}]
					},
					{
						"id": 8,
						"name": "west-sign",
						"type": "sign",
						"x": 64,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "West trail: lots of long grass. Be ready!"
						}]
					},
					{
						"id": 9,
						"name": "hut-sign",
						"type": "sign",
						"x": 208,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Rest hut. Nurse Pania will heal your team for free."
						}]
					},
					{
						"id": 10,
						"name": "tower-sign",
						"type": "sign",
						"x": 240,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "The Leaf Tower. Beat the Tower trainer to win the Leaf badge."
						}]
					},
					{
						"id": 11,
						"name": "chest-sign",
						"type": "sign",
						"x": 144,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is hidden in the long grass to the west. Look for a little box!"
						}]
					},
					{
						"id": 12,
						"name": "Mere",
						"type": "person",
						"x": 240,
						"y": 272,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 100
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Tip: if a monster is nearly out of health, it is much easier to catch.\nA right answer helps too!"
							}
						]
					},
					{
						"id": 13,
						"name": "Tama",
						"type": "person",
						"x": 144,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 88
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Why was six afraid of seven?\nBecause seven eight nine!"
							}
						]
					},
					{
						"id": 14,
						"name": "Hermit",
						"type": "person",
						"x": 176,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 111
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Each monster uses the maths of its type. Water monsters ask adding and taking away, Fire monsters ask times tables.\nBring a monster of every type, and you can practise everything!"
							}
						]
					},
					{
						"id": 15,
						"name": "Ranger Kiri",
						"type": "trainer",
						"x": 256,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 96
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 4
							},
							{
								"name": "text",
								"type": "string",
								"value": "Hey! You there! I saw you walk past. Show me your monsters!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Great battle! You are getting good at this. Keep going!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "digibud:4,plusplash:4"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-small"
							}
						]
					},
					{
						"id": 16,
						"name": "Chest in the bush",
						"type": "chest",
						"x": 96,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A wooden chest, half hidden in the grass. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "balls"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 17,
						"name": "Chest by the Tower",
						"type": "chest",
						"x": 272,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest sits beside the path. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "mixed"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 18,
						"name": "to-town-left",
						"type": "warp",
						"x": 176,
						"y": 304,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "harbour-town"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 11
							},
							{
								"name": "toY",
								"type": "int",
								"value": 1
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 19,
						"name": "to-town-right",
						"type": "warp",
						"x": 192,
						"y": 304,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "harbour-town"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 12
							},
							{
								"name": "toY",
								"type": "int",
								"value": 1
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 20,
						"name": "entrance",
						"type": "spot",
						"x": 176,
						"y": 288,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 21,
						"name": "trainer-approach",
						"type": "spot",
						"x": 288,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 22,
						"name": "grass-edge",
						"type": "spot",
						"x": 272,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 23,
						"name": "nurse",
						"type": "spot",
						"x": 192,
						"y": 240,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "right"
						}]
					},
					{
						"id": 24,
						"name": "chest",
						"type": "spot",
						"x": 96,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 25,
						"name": "tower-door",
						"type": "spot",
						"x": 224,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 26,
						"name": "gate",
						"type": "spot",
						"x": 336,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"shell-beach": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 25,
		height: 20,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 28,
		nextobjectid: 28,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Area 2: Shell Beach"
			},
			{
				"name": "area",
				"type": "int",
				"value": 2
			},
			{
				"name": "wild",
				"type": "string",
				"value": "plusplash,plusplash,minnowus,minnowus,carrycrab,carrycrab,factorch,squaremander,remaindeer,sharebear,numeratot,denomibolt,coinrock,centipebble"
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 27,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					289,
					289,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268,
					268
				]
			},
			{
				"id": 28,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					6,
					6,
					6,
					0,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					49,
					50,
					50,
					50,
					51,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					61,
					62,
					62,
					62,
					63,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					77,
					78,
					78,
					78,
					80,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					6,
					6,
					0,
					0,
					0,
					0,
					84,
					0,
					84,
					89,
					78,
					78,
					78,
					89,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					89,
					89,
					90,
					89,
					89,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					287,
					0,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					288,
					0,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					265,
					265,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					265,
					265,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					265,
					265,
					265,
					265,
					265,
					265,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					265,
					265,
					265,
					265,
					265,
					265,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					265,
					265,
					265,
					265,
					265,
					265,
					0,
					287,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					265,
					265,
					265,
					265,
					265,
					265,
					0,
					288,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					53,
					54,
					84,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					265,
					265,
					265,
					265,
					265,
					265,
					0,
					287,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					65,
					66,
					67,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					265,
					265,
					265,
					265,
					265,
					265,
					0,
					288,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					73,
					74,
					76,
					0,
					0,
					0,
					84,
					0,
					6,
					6,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					85,
					85,
					85,
					0,
					0,
					0,
					0,
					0,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					6,
					0,
					6,
					6,
					6
				]
			},
			{
				"id": 29,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					269,
					269,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					269,
					269,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					269,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					269,
					269,
					269,
					269,
					269,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 30,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "far half",
						"type": "far",
						"x": 0,
						"y": 0,
						"width": 400,
						"height": 160,
						"rotation": 0,
						"visible": true,
						"properties": []
					},
					{
						"id": 2,
						"name": "to-tower",
						"type": "warp",
						"x": 160,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-2-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 7
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 3,
						"name": "Nurse Hinemoa",
						"type": "nurse",
						"x": 304,
						"y": 256,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Kia ora! Come and rest your monsters on the sand."
							}
						]
					},
					{
						"id": 4,
						"name": "area-3-gate",
						"type": "gate",
						"x": 48,
						"y": 16,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "badge",
								"type": "string",
								"value": "water"
							},
							{
								"name": "text",
								"type": "string",
								"value": "A rope fence blocks the steep path north. A sign says: \"Fire Mountain. Only for trainers with a Water badge!\""
							},
							{
								"name": "gid",
								"type": "int",
								"value": 82
							}
						]
					},
					{
						"id": 5,
						"name": "to-fire-mountain",
						"type": "warp",
						"x": 48,
						"y": 0,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "fire-mountain"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 3
							},
							{
								"name": "toY",
								"type": "int",
								"value": 18
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 6,
						"name": "beach-sign",
						"type": "sign",
						"x": 352,
						"y": 272,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Shell Beach. Water monsters splash about here. Their attacks ask adding and taking away."
						}]
					},
					{
						"id": 7,
						"name": "tower-sign",
						"type": "sign",
						"x": 176,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "The Water Tower. Beat the Tower trainer to win the Water badge."
						}]
					},
					{
						"id": 8,
						"name": "hut-sign",
						"type": "sign",
						"x": 288,
						"y": 240,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Rest hut. Nurse Hinemoa will heal your team for free."
						}]
					},
					{
						"id": 9,
						"name": "gate-sign",
						"type": "sign",
						"x": 80,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "North-west: the path up to Fire Mountain. You need the Water badge."
						}]
					},
					{
						"id": 10,
						"name": "chest-sign-1",
						"type": "sign",
						"x": 336,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is buried in the dunes just east of here."
						}]
					},
					{
						"id": 11,
						"name": "chest-sign-2",
						"type": "sign",
						"x": 112,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is hiding in the corner by the sea, up north."
						}]
					},
					{
						"id": 12,
						"name": "Hine",
						"type": "person",
						"x": 288,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "I counted 47 shells on the beach. Then a wave took 18 away. That leaves 29!\nAdding and taking away is what Water monsters are all about."
							}
						]
					},
					{
						"id": 13,
						"name": "Old Joe",
						"type": "person",
						"x": 192,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 100
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "What did the ocean say to the beach?\nNothing, it just waved!"
							}
						]
					},
					{
						"id": 14,
						"name": "Surfer Tui",
						"type": "person",
						"x": 96,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 88
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Tip: Water is strong against Fire, but weak against Leaf. Bring a Leaf monster if you want to beat a Water one!"
							}
						]
					},
					{
						"id": 15,
						"name": "Lifeguard Sam",
						"type": "trainer",
						"x": 192,
						"y": 128,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 97
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 2
							},
							{
								"name": "text",
								"type": "string",
								"value": "Stop right there! Nobody swims past me without a battle!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "You are a strong swimmer! I mean trainer."
							},
							{
								"name": "team",
								"type": "string",
								"value": "plusplash:9,minnowus:9"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-small"
							}
						]
					},
					{
						"id": 16,
						"name": "Swimmer Aroha",
						"type": "trainer",
						"x": 112,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "My Water monsters have been training all summer. Want to see?"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Wow, you made a splash!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "carrycrab:10,plusplash:11"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-small"
							}
						]
					},
					{
						"id": 17,
						"name": "Chest in the dunes",
						"type": "chest",
						"x": 352,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest is half buried in the sand. You dig it out and lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "balls"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 18,
						"name": "Chest by the sea",
						"type": "chest",
						"x": 96,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest sits right at the water's edge. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "mixed"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 19,
						"name": "to-bush",
						"type": "warp",
						"x": 336,
						"y": 304,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "kauri-bush"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 21
							},
							{
								"name": "toY",
								"type": "int",
								"value": 1
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 20,
						"name": "entrance",
						"type": "spot",
						"x": 336,
						"y": 288,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 21,
						"name": "trainer-approach",
						"type": "spot",
						"x": 176,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 22,
						"name": "grass-edge",
						"type": "spot",
						"x": 192,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 23,
						"name": "nurse",
						"type": "spot",
						"x": 320,
						"y": 256,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "left"
						}]
					},
					{
						"id": 24,
						"name": "chest",
						"type": "spot",
						"x": 352,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 25,
						"name": "tower-door",
						"type": "spot",
						"x": 160,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 26,
						"name": "gate",
						"type": "spot",
						"x": 48,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"fire-mountain": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 25,
		height: 20,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 28,
		nextobjectid: 28,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Area 3: Fire Mountain"
			},
			{
				"name": "area",
				"type": "int",
				"value": 3
			},
			{
				"name": "wild",
				"type": "string",
				"value": "factorch,factorch,multipup,multipup,squaremander,squaremander,roundroot,placepetal,plusplash,minnowus,remaindeer,sharebear,numeratot,coinrock"
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 27,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					291,
					291,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274,
					274
				]
			},
			{
				"id": 28,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					0,
					284,
					284,
					284,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					272,
					272,
					272,
					0,
					49,
					50,
					50,
					50,
					51,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					272,
					272,
					272,
					0,
					61,
					62,
					62,
					62,
					63,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					77,
					78,
					78,
					78,
					80,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					89,
					78,
					78,
					78,
					89,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					89,
					89,
					90,
					89,
					89,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					53,
					54,
					55,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					65,
					66,
					67,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					272,
					272,
					272,
					272,
					272,
					272,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					73,
					74,
					76,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					272,
					272,
					272,
					272,
					272,
					272,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					85,
					85,
					85,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					272,
					272,
					272,
					272,
					272,
					272,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					4,
					0,
					4,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					16,
					0,
					16,
					0,
					0,
					84,
					0,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					272,
					272,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					272,
					272,
					272,
					0,
					284,
					284,
					272,
					272,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					4,
					0,
					4,
					0,
					0,
					0,
					0,
					272,
					272,
					272,
					0,
					284,
					284,
					272,
					272,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					16,
					0,
					16,
					0,
					0,
					0,
					0,
					272,
					272,
					272,
					0,
					284,
					284,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					284,
					284,
					284,
					284,
					0,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284,
					284
				]
			},
			{
				"id": 29,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					275,
					275,
					275,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 30,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "far half",
						"type": "far",
						"x": 0,
						"y": 0,
						"width": 400,
						"height": 160,
						"rotation": 0,
						"visible": true,
						"properties": []
					},
					{
						"id": 2,
						"name": "to-tower",
						"type": "warp",
						"x": 192,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-3-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 7
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 3,
						"name": "Nurse Mere",
						"type": "nurse",
						"x": 144,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Phew, it is hot up here! Come and cool your monsters down."
							}
						]
					},
					{
						"id": 4,
						"name": "area-4-gate",
						"type": "gate",
						"x": 320,
						"y": 16,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "badge",
								"type": "string",
								"value": "fire"
							},
							{
								"name": "text",
								"type": "string",
								"value": "A rope fence blocks the icy path north. A sign says: \"Snowy Peaks. Only for trainers with a Fire badge!\""
							},
							{
								"name": "gid",
								"type": "int",
								"value": 82
							}
						]
					},
					{
						"id": 5,
						"name": "to-snowy-peaks",
						"type": "warp",
						"x": 320,
						"y": 0,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "snowy-peaks"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 20
							},
							{
								"name": "toY",
								"type": "int",
								"value": 18
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 6,
						"name": "mountain-sign",
						"type": "sign",
						"x": 80,
						"y": 272,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Fire Mountain. Fire monsters live here. Their attacks ask times tables. Keep away from the lava!"
						}]
					},
					{
						"id": 7,
						"name": "tower-sign",
						"type": "sign",
						"x": 224,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "The Fire Tower. Beat the Tower trainer to win the Fire badge."
						}]
					},
					{
						"id": 8,
						"name": "hut-sign",
						"type": "sign",
						"x": 160,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Rest hut. Nurse Mere will heal your team for free."
						}]
					},
					{
						"id": 9,
						"name": "gate-sign",
						"type": "sign",
						"x": 288,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "North-east: the icy path to Snowy Peaks. You need the Fire badge."
						}]
					},
					{
						"id": 10,
						"name": "chest-sign-1",
						"type": "sign",
						"x": 336,
						"y": 208,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is sitting by the lava to the east."
						}]
					},
					{
						"id": 11,
						"name": "chest-sign-2",
						"type": "sign",
						"x": 144,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is tucked in beside the Tower, up north."
						}]
					},
					{
						"id": 12,
						"name": "Vera",
						"type": "person",
						"x": 128,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Times tables are quick if you know your fours: double, then double again!\n7 x 8 is 56. Just remember five, six, seven, eight: 56 = 7 x 8."
							}
						]
					},
					{
						"id": 13,
						"name": "Ash",
						"type": "person",
						"x": 240,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 88
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "What do you get if you multiply a volcano by a fish?\nI have no idea, but it is very hot!"
							}
						]
					},
					{
						"id": 14,
						"name": "Old Kui",
						"type": "person",
						"x": 256,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 100
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Tip: Fire is strong against Ice, but weak against Water. A Water monster is a very good friend on this mountain."
							}
						]
					},
					{
						"id": 15,
						"name": "Hiker Rob",
						"type": "trainer",
						"x": 160,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 112
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 2
							},
							{
								"name": "text",
								"type": "string",
								"value": "I have climbed this mountain a hundred times, with my monsters. Let us battle!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Great fight! My knees are weaker than my monsters."
							},
							{
								"name": "team",
								"type": "string",
								"value": "factorch:15,multipup:16"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-small"
							}
						]
					},
					{
						"id": 16,
						"name": "Firefighter Kate",
						"type": "trainer",
						"x": 272,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 97
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "I put out fires all day. Now I will put out your team!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Hot stuff! You put out my fire."
							},
							{
								"name": "team",
								"type": "string",
								"value": "squaremander:17,multipup:17"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-big"
							}
						]
					},
					{
						"id": 17,
						"name": "Chest by the lava",
						"type": "chest",
						"x": 336,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest sits right next to the lava. It is warm to touch. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "balls"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 18,
						"name": "Chest by the Tower",
						"type": "chest",
						"x": 144,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest hides in the shadow of the Tower. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "super"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 19,
						"name": "to-beach",
						"type": "warp",
						"x": 48,
						"y": 304,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "shell-beach"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 3
							},
							{
								"name": "toY",
								"type": "int",
								"value": 1
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 20,
						"name": "entrance",
						"type": "spot",
						"x": 48,
						"y": 288,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 21,
						"name": "trainer-approach",
						"type": "spot",
						"x": 192,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 22,
						"name": "grass-edge",
						"type": "spot",
						"x": 112,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 23,
						"name": "nurse",
						"type": "spot",
						"x": 144,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 24,
						"name": "chest",
						"type": "spot",
						"x": 320,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "right"
						}]
					},
					{
						"id": 25,
						"name": "tower-door",
						"type": "spot",
						"x": 192,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 26,
						"name": "gate",
						"type": "spot",
						"x": 320,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"snowy-peaks": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 25,
		height: 20,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 28,
		nextobjectid: 28,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Area 4: Snowy Peaks"
			},
			{
				"name": "area",
				"type": "int",
				"value": 4
			},
			{
				"name": "wild",
				"type": "string",
				"value": "divvy,divvy,remaindeer,remaindeer,sharebear,sharebear,digibud,roundroot,carrycrab,minnowus,squaremander,fractopus,pebblepoint,centipebble"
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 27,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					294,
					294,
					294,
					294,
					294,
					294,
					294,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					294,
					294,
					294,
					294,
					294,
					294,
					294,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					294,
					294,
					294,
					294,
					294,
					294,
					294,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					294,
					294,
					294,
					294,
					294,
					294,
					294,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					294,
					294,
					294,
					294,
					294,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					294,
					294,
					294,
					294,
					294,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					294,
					294,
					294,
					294,
					294,
					270,
					270,
					270,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					290,
					290,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270,
					270
				]
			},
			{
				"id": 28,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					281,
					281,
					281,
					281,
					0,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					0,
					279,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					49,
					50,
					50,
					50,
					51,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					280,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					61,
					62,
					62,
					62,
					63,
					0,
					0,
					0,
					0,
					0,
					0,
					279,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					77,
					78,
					78,
					78,
					80,
					0,
					279,
					0,
					0,
					279,
					0,
					280,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					89,
					78,
					78,
					78,
					89,
					0,
					280,
					0,
					0,
					280,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					89,
					89,
					90,
					89,
					89,
					0,
					279,
					0,
					279,
					0,
					0,
					279,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					280,
					0,
					280,
					0,
					0,
					280,
					0,
					281,
					281,
					0,
					279,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					280,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					279,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					281,
					281,
					0,
					0,
					280,
					0,
					279,
					0,
					279,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					280,
					0,
					280,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					279,
					0,
					0,
					0,
					0,
					0,
					0,
					53,
					54,
					84,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					280,
					0,
					0,
					0,
					0,
					0,
					0,
					65,
					66,
					67,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					73,
					74,
					76,
					0,
					0,
					0,
					84,
					0,
					281,
					281,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					85,
					85,
					85,
					0,
					0,
					0,
					0,
					0,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					281,
					0,
					281,
					281,
					281,
					281
				]
			},
			{
				"id": 29,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					271,
					271,
					271,
					271,
					271,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 30,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "far half",
						"type": "far",
						"x": 0,
						"y": 0,
						"width": 400,
						"height": 160,
						"rotation": 0,
						"visible": true,
						"properties": []
					},
					{
						"id": 2,
						"name": "to-tower",
						"type": "warp",
						"x": 208,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-4-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 7
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 3,
						"name": "Nurse Aroha",
						"type": "nurse",
						"x": 304,
						"y": 256,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Brrr! Come in from the cold. I will warm your monsters up."
							}
						]
					},
					{
						"id": 4,
						"name": "area-5-gate",
						"type": "gate",
						"x": 64,
						"y": 16,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "badge",
								"type": "string",
								"value": "ice"
							},
							{
								"name": "text",
								"type": "string",
								"value": "A rope fence blocks the dark cave mouth north. A sign says: \"Glowworm Caves. Only for trainers with an Ice badge!\""
							},
							{
								"name": "gid",
								"type": "int",
								"value": 82
							}
						]
					},
					{
						"id": 5,
						"name": "to-glowworm-caves",
						"type": "warp",
						"x": 64,
						"y": 0,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "glowworm-caves"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 4
							},
							{
								"name": "toY",
								"type": "int",
								"value": 18
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 6,
						"name": "peaks-sign",
						"type": "sign",
						"x": 352,
						"y": 272,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Snowy Peaks. Ice monsters live here. Their attacks ask division: sharing things out equally."
						}]
					},
					{
						"id": 7,
						"name": "tower-sign",
						"type": "sign",
						"x": 240,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "The Ice Tower. Beat the Tower trainer to win the Ice badge."
						}]
					},
					{
						"id": 8,
						"name": "hut-sign",
						"type": "sign",
						"x": 288,
						"y": 240,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Rest hut. Nurse Aroha will heal your team for free."
						}]
					},
					{
						"id": 9,
						"name": "gate-sign",
						"type": "sign",
						"x": 96,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "North-west: the way to the Glowworm Caves. You need the Ice badge."
						}]
					},
					{
						"id": 10,
						"name": "chest-sign-1",
						"type": "sign",
						"x": 336,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is half buried in a snow drift just east of here."
						}]
					},
					{
						"id": 11,
						"name": "chest-sign-2",
						"type": "sign",
						"x": 112,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is frozen into the snow by the path, to the north-west."
						}]
					},
					{
						"id": 12,
						"name": "Skier Jo",
						"type": "person",
						"x": 272,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 88
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "If 24 snowballs are shared by 6 friends, each friend gets 4. Division is just fair sharing!"
							}
						]
					},
					{
						"id": 13,
						"name": "Nana Pip",
						"type": "person",
						"x": 192,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 100
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "What do you call a snowman in July?\nA puddle!"
							}
						]
					},
					{
						"id": 14,
						"name": "Ranger Fern",
						"type": "person",
						"x": 128,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Tip: Ice is strong against Spark, but weak against Fire. Fire monsters melt Ice monsters!"
							}
						]
					},
					{
						"id": 15,
						"name": "Skier Ben",
						"type": "trainer",
						"x": 256,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 111
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "I just flew down that slope. Now let me fly past your team!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Smooth moves! You carved me up."
							},
							{
								"name": "team",
								"type": "string",
								"value": "divvy:24,sharebear:25"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-small"
							}
						]
					},
					{
						"id": 16,
						"name": "Snowboarder Mia",
						"type": "trainer",
						"x": 144,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "Hey! Wanna race? Okay, battle instead!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Gnarly! You have got it."
							},
							{
								"name": "team",
								"type": "string",
								"value": "remaindeer:25,divvy:26"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-big"
							}
						]
					},
					{
						"id": 17,
						"name": "Chest in the snow drift",
						"type": "chest",
						"x": 352,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest is poking out of the snow. You brush it off and lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "balls"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 18,
						"name": "Chest by the path",
						"type": "chest",
						"x": 32,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A frosty chest sits by the path. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "repel"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 19,
						"name": "to-fire-mountain",
						"type": "warp",
						"x": 320,
						"y": 304,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "fire-mountain"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 20
							},
							{
								"name": "toY",
								"type": "int",
								"value": 1
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 20,
						"name": "entrance",
						"type": "spot",
						"x": 320,
						"y": 288,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 21,
						"name": "trainer-approach",
						"type": "spot",
						"x": 224,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "right"
						}]
					},
					{
						"id": 22,
						"name": "grass-edge",
						"type": "spot",
						"x": 208,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 23,
						"name": "nurse",
						"type": "spot",
						"x": 320,
						"y": 256,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "left"
						}]
					},
					{
						"id": 24,
						"name": "chest",
						"type": "spot",
						"x": 352,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 25,
						"name": "tower-door",
						"type": "spot",
						"x": 208,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 26,
						"name": "gate",
						"type": "spot",
						"x": 64,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"glowworm-caves": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 25,
		height: 20,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 28,
		nextobjectid: 28,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Area 5: Glowworm Caves"
			},
			{
				"name": "area",
				"type": "int",
				"value": 5
			},
			{
				"name": "wild",
				"type": "string",
				"value": "fractopus,fractopus,numeratot,numeratot,denomibolt,denomibolt,placepetal,plusplash,multipup,sharebear,coinrock,pebblepoint"
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 27,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					292,
					292,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276,
					276
				]
			},
			{
				"id": 28,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					0,
					278,
					278,
					278,
					278,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					49,
					50,
					50,
					50,
					51,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					61,
					62,
					62,
					62,
					63,
					0,
					0,
					285,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					77,
					78,
					78,
					78,
					80,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					285,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					89,
					78,
					78,
					78,
					89,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					89,
					89,
					90,
					89,
					89,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					285,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					285,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					285,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					285,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					285,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					278,
					278,
					0,
					285,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					285,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					53,
					54,
					55,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					265,
					265,
					265,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					65,
					66,
					67,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					0,
					265,
					265,
					265,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					73,
					74,
					76,
					265,
					265,
					265,
					265,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					85,
					85,
					85,
					265,
					265,
					265,
					265,
					0,
					0,
					0,
					278,
					278,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					278,
					278,
					278,
					278,
					278,
					0,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278,
					278
				]
			},
			{
				"id": 29,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					277,
					277,
					277,
					277,
					277,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 30,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "far half",
						"type": "far",
						"x": 0,
						"y": 0,
						"width": 400,
						"height": 160,
						"rotation": 0,
						"visible": true,
						"properties": []
					},
					{
						"id": 2,
						"name": "to-tower",
						"type": "warp",
						"x": 176,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-5-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 7
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 3,
						"name": "Nurse Kowhai",
						"type": "nurse",
						"x": 208,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the caves! It is cosy in here. Let me look after your monsters."
							}
						]
					},
					{
						"id": 4,
						"name": "area-6-gate",
						"type": "gate",
						"x": 304,
						"y": 16,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "badge",
								"type": "string",
								"value": "spark"
							},
							{
								"name": "text",
								"type": "string",
								"value": "A rope fence blocks the tunnel north. A sign says: \"Harbour City. Only for trainers with a Spark badge!\""
							},
							{
								"name": "gid",
								"type": "int",
								"value": 82
							}
						]
					},
					{
						"id": 5,
						"name": "to-harbour-city",
						"type": "warp",
						"x": 304,
						"y": 0,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "harbour-city"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 19
							},
							{
								"name": "toY",
								"type": "int",
								"value": 18
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 6,
						"name": "cave-sign",
						"type": "sign",
						"x": 96,
						"y": 272,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Glowworm Caves. Spark monsters glow here. Their attacks ask fractions: halves, quarters and more."
						}]
					},
					{
						"id": 7,
						"name": "tower-sign",
						"type": "sign",
						"x": 208,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "The Spark Tower. Beat the Tower trainer to win the Spark badge."
						}]
					},
					{
						"id": 8,
						"name": "hut-sign",
						"type": "sign",
						"x": 208,
						"y": 240,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Rest hut. Nurse Kowhai will heal your team for free."
						}]
					},
					{
						"id": 9,
						"name": "gate-sign",
						"type": "sign",
						"x": 272,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "North-east: the tunnel to Harbour City. You need the Spark badge."
						}]
					},
					{
						"id": 10,
						"name": "chest-sign-1",
						"type": "sign",
						"x": 336,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is glowing in the corner to the east."
						}]
					},
					{
						"id": 11,
						"name": "chest-sign-2",
						"type": "sign",
						"x": 144,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is wedged behind the stalagmites by the Tower."
						}]
					},
					{
						"id": 12,
						"name": "Glow Gran",
						"type": "person",
						"x": 112,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 100
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Look up! Thousands of glowworms! If half of them are asleep, and a quarter are chatting, how many are awake? A quarter!"
							}
						]
					},
					{
						"id": 13,
						"name": "Spelunker Bo",
						"type": "person",
						"x": 224,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 88
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Why did the fraction not go in the cave?\nIt was afraid of getting stuck on a denominator!"
							}
						]
					},
					{
						"id": 14,
						"name": "Wee Hana",
						"type": "person",
						"x": 272,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 85
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Tip: Spark is strong against Stone, but weak against Ice. Bring an Ice monster to the caves!"
							}
						]
					},
					{
						"id": 15,
						"name": "Caver Pete",
						"type": "trainer",
						"x": 128,
						"y": 160,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 111
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "It is dark in here, but I can still see you coming. Battle?"
							},
							{
								"name": "win",
								"type": "string",
								"value": "You shine brighter than my torch!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "fractopus:30,numeratot:31"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-small"
							}
						]
					},
					{
						"id": 16,
						"name": "Miner Rua",
						"type": "trainer",
						"x": 240,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 86
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "I dig for crystals, but monsters are even better. Let us fight!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "You struck gold! Well, not gold. But a very good battle."
							},
							{
								"name": "team",
								"type": "string",
								"value": "denomibolt:33,fractopus:33"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-big"
							}
						]
					},
					{
						"id": 17,
						"name": "Chest in the corner",
						"type": "chest",
						"x": 352,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest glows in the dark. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "balls"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 18,
						"name": "Chest behind the stalagmites",
						"type": "chest",
						"x": 128,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest hides behind the stalagmites. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "great"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 19,
						"name": "to-snowy-peaks",
						"type": "warp",
						"x": 64,
						"y": 304,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "snowy-peaks"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 4
							},
							{
								"name": "toY",
								"type": "int",
								"value": 1
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 20,
						"name": "entrance",
						"type": "spot",
						"x": 64,
						"y": 288,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 21,
						"name": "trainer-approach",
						"type": "spot",
						"x": 128,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 22,
						"name": "grass-edge",
						"type": "spot",
						"x": 144,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 23,
						"name": "nurse",
						"type": "spot",
						"x": 208,
						"y": 208,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 24,
						"name": "chest",
						"type": "spot",
						"x": 352,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 25,
						"name": "tower-door",
						"type": "spot",
						"x": 176,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 26,
						"name": "gate",
						"type": "spot",
						"x": 304,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"harbour-city": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 25,
		height: 20,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 25,
		nextobjectid: 25,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Area 6: Harbour City"
			},
			{
				"name": "area",
				"type": "int",
				"value": 6
			},
			{
				"name": "wild",
				"type": "string",
				"value": "pebblepoint,pebblepoint,coinrock,coinrock,centipebble,centipebble,digibud,minnowus,factorch,remaindeer,denomibolt,placepetal"
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 24,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					2,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					2,
					1,
					2,
					3,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					2,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					1,
					3,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					293,
					293,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					3,
					2,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					293,
					293,
					1,
					3,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					2,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					293,
					293,
					1,
					2,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					293,
					293,
					1,
					1,
					1,
					2,
					1,
					2,
					1,
					2,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					293,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					2,
					1,
					1,
					1,
					1,
					293,
					293,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					1,
					2,
					1,
					1,
					1,
					2,
					1,
					293,
					293,
					2,
					1,
					1,
					1,
					2,
					2,
					3,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					293,
					293,
					1,
					2,
					2,
					2,
					1,
					1,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					3,
					1,
					1,
					1,
					1,
					1,
					293,
					293,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					293,
					293,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					3,
					2,
					2,
					2,
					1,
					1,
					1,
					1,
					1,
					1,
					1
				]
			},
			{
				"id": 25,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					0,
					49,
					50,
					51,
					0,
					49,
					50,
					50,
					50,
					51,
					0,
					0,
					0,
					0,
					5,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					29,
					29,
					0,
					61,
					62,
					63,
					0,
					61,
					62,
					62,
					62,
					63,
					0,
					0,
					0,
					0,
					17,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					29,
					29,
					0,
					77,
					78,
					80,
					0,
					77,
					78,
					78,
					78,
					80,
					0,
					0,
					0,
					0,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					29,
					29,
					0,
					89,
					89,
					89,
					0,
					89,
					78,
					78,
					78,
					89,
					0,
					0,
					0,
					0,
					0,
					84,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					29,
					29,
					0,
					0,
					5,
					0,
					0,
					89,
					89,
					90,
					89,
					89,
					0,
					0,
					0,
					0,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					29,
					29,
					0,
					0,
					17,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					265,
					265,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					265,
					265,
					265,
					265,
					265,
					0,
					29,
					29,
					0,
					81,
					82,
					82,
					83,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					81,
					82,
					83,
					29,
					29,
					0,
					0,
					0,
					84,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					0,
					53,
					54,
					55,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					53,
					54,
					55,
					0,
					0,
					0,
					0,
					53,
					54,
					55,
					29,
					29,
					0,
					65,
					66,
					67,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					65,
					66,
					67,
					0,
					0,
					0,
					0,
					65,
					66,
					67,
					29,
					29,
					0,
					73,
					74,
					76,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					73,
					74,
					76,
					0,
					0,
					0,
					0,
					77,
					78,
					80,
					29,
					29,
					0,
					85,
					85,
					85,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					85,
					85,
					85,
					84,
					0,
					0,
					0,
					89,
					89,
					89,
					29,
					29,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					29,
					0,
					29,
					29,
					29,
					29,
					29
				]
			},
			{
				"id": 26,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 25,
				"height": 20,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					0,
					0,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					0,
					0,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					267,
					267,
					267,
					267,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 27,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "far half",
						"type": "far",
						"x": 0,
						"y": 0,
						"width": 400,
						"height": 160,
						"rotation": 0,
						"visible": true,
						"properties": []
					},
					{
						"id": 2,
						"name": "to-tower",
						"type": "warp",
						"x": 128,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-6-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 7
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 3,
						"name": "Nurse Sina",
						"type": "nurse",
						"x": 272,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the big city! Let me rest your monsters."
							}
						]
					},
					{
						"id": 4,
						"name": "city-sign",
						"type": "sign",
						"x": 272,
						"y": 272,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Harbour City. Stone monsters live here. Their attacks ask decimals and money: $2.40 + $1.75 and 0.3 + 0.5."
						}]
					},
					{
						"id": 5,
						"name": "tower-sign",
						"type": "sign",
						"x": 160,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "The Stone Tower. Beat the Tower trainer to win the Stone badge, the last one!"
						}]
					},
					{
						"id": 6,
						"name": "hut-sign",
						"type": "sign",
						"x": 208,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Rest hut. Nurse Sina will heal your team for free."
						}]
					},
					{
						"id": 7,
						"name": "harbour-sign",
						"type": "sign",
						"x": 256,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "The harbour. Ships come here from all over the world."
						}]
					},
					{
						"id": 8,
						"name": "chest-sign-1",
						"type": "sign",
						"x": 368,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is stashed behind the shops to the east."
						}]
					},
					{
						"id": 9,
						"name": "chest-sign-2",
						"type": "sign",
						"x": 64,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "A chest is waiting in the corner park, to the west."
						}]
					},
					{
						"id": 10,
						"name": "Shopkeeper Lu",
						"type": "person",
						"x": 208,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 85
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "A book costs $3.50 and a pen costs $1.25. That is $4.75 altogether. Money is just decimals!"
							}
						]
					},
					{
						"id": 11,
						"name": "Captain Tui",
						"type": "person",
						"x": 240,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 100
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "text",
								"type": "string",
								"value": "What kind of money do pirates love?\nBuck-aneers!"
							}
						]
					},
					{
						"id": 12,
						"name": "Mayor Kiri",
						"type": "person",
						"x": 176,
						"y": 80,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "left"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to Harbour City! This is the end of the road, for now. Win the Stone badge and you will hold all six!\nTip: Stone is strong against Leaf, but weak against Spark."
							}
						]
					},
					{
						"id": 13,
						"name": "Dock worker Sione",
						"type": "trainer",
						"x": 192,
						"y": 144,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 88
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "I carry heavy crates all day. My monsters are even stronger!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Strong! I should hire you for the docks."
							},
							{
								"name": "team",
								"type": "string",
								"value": "pebblepoint:40,coinrock:40"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-small"
							}
						]
					},
					{
						"id": 14,
						"name": "Sailor Hana",
						"type": "trainer",
						"x": 208,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 112
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "Ahoy! Prepare for a battle on the high seas, well, on the quay!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Shiver me timbers! You win."
							},
							{
								"name": "team",
								"type": "string",
								"value": "centipebble:42,pebblepoint:43"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "trainer-big"
							}
						]
					},
					{
						"id": 15,
						"name": "Chest behind the shops",
						"type": "chest",
						"x": 368,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest is stashed behind the shops. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "balls"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 16,
						"name": "Chest in the corner park",
						"type": "chest",
						"x": 48,
						"y": 192,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "text",
								"type": "string",
								"value": "A chest sits under a tree in the park. You lift the lid..."
							},
							{
								"name": "loot",
								"type": "string",
								"value": "mixed"
							},
							{
								"name": "gid",
								"type": "int",
								"value": 223
							},
							{
								"name": "open",
								"type": "int",
								"value": 224
							}
						]
					},
					{
						"id": 17,
						"name": "to-glowworm-caves",
						"type": "warp",
						"x": 304,
						"y": 304,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "glowworm-caves"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 19
							},
							{
								"name": "toY",
								"type": "int",
								"value": 1
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 18,
						"name": "entrance",
						"type": "spot",
						"x": 304,
						"y": 288,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					},
					{
						"id": 19,
						"name": "trainer-approach",
						"type": "spot",
						"x": 192,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 20,
						"name": "grass-edge",
						"type": "spot",
						"x": 160,
						"y": 224,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 21,
						"name": "nurse",
						"type": "spot",
						"x": 272,
						"y": 208,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "down"
						}]
					},
					{
						"id": 22,
						"name": "chest",
						"type": "spot",
						"x": 352,
						"y": 176,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "right"
						}]
					},
					{
						"id": 23,
						"name": "tower-door",
						"type": "spot",
						"x": 128,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-1-hall": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 7,
		nextobjectid: 7,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Leaf Tower"
			},
			{
				"name": "area",
				"type": "int",
				"value": 1
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 6,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 7,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					196,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					196,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					199,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					199,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					90,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 8,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 9,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower guide Wiremu",
						"type": "person",
						"x": 48,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 85
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the Leaf Tower! Leaf monsters ask place value and rounding: what is the 4 worth in 3,406? What is 678 to the nearest 10?\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!"
							}
						]
					},
					{
						"id": 2,
						"name": "tower-sign",
						"type": "sign",
						"x": 112,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Leaf Tower. Climb the ladder to meet the Tower trainer and win the Leaf badge!"
						}]
					},
					{
						"id": 3,
						"name": "up",
						"type": "warp",
						"x": 80,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-1-top"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 4,
						"name": "out",
						"type": "warp",
						"x": 80,
						"y": 128,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "kauri-bush"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 14
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 5,
						"name": "inside",
						"type": "spot",
						"x": 80,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-1-top": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 5,
		nextobjectid: 5,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Leaf Tower, top floor"
			},
			{
				"name": "area",
				"type": "int",
				"value": 1
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 4,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 5,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					0,
					197,
					0,
					0,
					0,
					0,
					0,
					197,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 6,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 7,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower trainer Hemi",
						"type": "trainer",
						"x": 80,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 96
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "So you came to climb my Tower! I am Hemi. Leaf monsters never forget what a digit is worth. Let us see about yours!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Well done! The Leaf badge is yours. The path to Shell Beach is open now. Go and see the sea!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "digibud:6,roundroot:7,placepetal:8"
							},
							{
								"name": "badge",
								"type": "string",
								"value": "leaf"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "tower"
							}
						]
					},
					{
						"id": 2,
						"name": "down",
						"type": "warp",
						"x": 80,
						"y": 112,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-1-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 3
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 3,
						"name": "trainer-approach",
						"type": "spot",
						"x": 80,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-2-hall": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 7,
		nextobjectid: 7,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Water Tower"
			},
			{
				"name": "area",
				"type": "int",
				"value": 2
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 6,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 7,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					196,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					196,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					199,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					199,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					90,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 8,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 9,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower guide Ana",
						"type": "person",
						"x": 48,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 85
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the Water Tower! Water monsters ask adding and taking away: 47 + 36, 120 - 58, change from a $10 note.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!"
							}
						]
					},
					{
						"id": 2,
						"name": "tower-sign",
						"type": "sign",
						"x": 112,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Water Tower. Climb the ladder to meet the Tower trainer and win the Water badge!"
						}]
					},
					{
						"id": 3,
						"name": "up",
						"type": "warp",
						"x": 80,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-2-top"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 4,
						"name": "out",
						"type": "warp",
						"x": 80,
						"y": 128,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "shell-beach"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 10
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 5,
						"name": "inside",
						"type": "spot",
						"x": 80,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-2-top": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 5,
		nextobjectid: 5,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Water Tower, top floor"
			},
			{
				"name": "area",
				"type": "int",
				"value": 2
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 4,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 5,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					0,
					197,
					0,
					0,
					0,
					0,
					0,
					197,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 6,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 7,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower trainer Moana",
						"type": "trainer",
						"x": 80,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 96
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "The tide is in and so am I! I am Moana. Water monsters are all about adding and taking away. Show me what you have got!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "You rode that wave perfectly! The Water badge is yours. Fire Mountain is open now. Wear something cool!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "plusplash:12,minnowus:13,carrycrab:14"
							},
							{
								"name": "badge",
								"type": "string",
								"value": "water"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "tower"
							}
						]
					},
					{
						"id": 2,
						"name": "down",
						"type": "warp",
						"x": 80,
						"y": 112,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-2-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 3
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 3,
						"name": "trainer-approach",
						"type": "spot",
						"x": 80,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-3-hall": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 7,
		nextobjectid: 7,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Fire Tower"
			},
			{
				"name": "area",
				"type": "int",
				"value": 3
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 6,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 7,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					196,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					196,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					199,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					199,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					90,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 8,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 9,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower guide Tipene",
						"type": "person",
						"x": 48,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 86
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the Fire Tower! Fire monsters ask times tables: 7 x 8, 9 x 6, 12 x 4.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!"
							}
						]
					},
					{
						"id": 2,
						"name": "tower-sign",
						"type": "sign",
						"x": 112,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Fire Tower. Climb the ladder to meet the Tower trainer and win the Fire badge!"
						}]
					},
					{
						"id": 3,
						"name": "up",
						"type": "warp",
						"x": 80,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-3-top"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 4,
						"name": "out",
						"type": "warp",
						"x": 80,
						"y": 128,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "fire-mountain"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 12
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 5,
						"name": "inside",
						"type": "spot",
						"x": 80,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-3-top": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 5,
		nextobjectid: 5,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Fire Tower, top floor"
			},
			{
				"name": "area",
				"type": "int",
				"value": 3
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 4,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 5,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					0,
					197,
					0,
					0,
					0,
					0,
					0,
					197,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 6,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 7,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower trainer Rangi",
						"type": "trainer",
						"x": 80,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 87
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "Feel the heat! I am Rangi, keeper of the Fire Tower. My monsters know every times table. Do yours?"
							},
							{
								"name": "win",
								"type": "string",
								"value": "You are on fire! The Fire badge is yours. The icy path to Snowy Peaks is open now. Take a coat!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "factorch:19,multipup:20,squaremander:21"
							},
							{
								"name": "badge",
								"type": "string",
								"value": "fire"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "tower"
							}
						]
					},
					{
						"id": 2,
						"name": "down",
						"type": "warp",
						"x": 80,
						"y": 112,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-3-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 3
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 3,
						"name": "trainer-approach",
						"type": "spot",
						"x": 80,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-4-hall": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 7,
		nextobjectid: 7,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Ice Tower"
			},
			{
				"name": "area",
				"type": "int",
				"value": 4
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 6,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 7,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					196,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					196,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					199,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					199,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					90,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 8,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 9,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower guide Pita",
						"type": "person",
						"x": 48,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 85
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the Ice Tower! Ice monsters ask division: 56 divided by 7, 35 divided by 5, and remainders.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!"
							}
						]
					},
					{
						"id": 2,
						"name": "tower-sign",
						"type": "sign",
						"x": 112,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Ice Tower. Climb the ladder to meet the Tower trainer and win the Ice badge!"
						}]
					},
					{
						"id": 3,
						"name": "up",
						"type": "warp",
						"x": 80,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-4-top"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 4,
						"name": "out",
						"type": "warp",
						"x": 80,
						"y": 128,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "snowy-peaks"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 13
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 5,
						"name": "inside",
						"type": "spot",
						"x": 80,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-4-top": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 5,
		nextobjectid: 5,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Ice Tower, top floor"
			},
			{
				"name": "area",
				"type": "int",
				"value": 4
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 4,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 5,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					0,
					197,
					0,
					0,
					0,
					0,
					0,
					197,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 6,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 7,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower trainer Maia",
						"type": "trainer",
						"x": 80,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 97
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "Cool as ice, that is me. I am Maia. Ice monsters share everything out fairly. Can you share out my attacks?"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Cool! The Ice badge is yours. The Glowworm Caves are open now. Take a torch!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "divvy:27,remaindeer:28,sharebear:29"
							},
							{
								"name": "badge",
								"type": "string",
								"value": "ice"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "tower"
							}
						]
					},
					{
						"id": 2,
						"name": "down",
						"type": "warp",
						"x": 80,
						"y": 112,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-4-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 3
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 3,
						"name": "trainer-approach",
						"type": "spot",
						"x": 80,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-5-hall": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 7,
		nextobjectid: 7,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Spark Tower"
			},
			{
				"name": "area",
				"type": "int",
				"value": 5
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 6,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 7,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					196,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					196,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					199,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					199,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					90,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 8,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 9,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower guide Ngaio",
						"type": "person",
						"x": 48,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 99
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the Spark Tower! Spark monsters ask fractions: half of 18, which is bigger, 2/3 or 3/4, and adding fractions.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!"
							}
						]
					},
					{
						"id": 2,
						"name": "tower-sign",
						"type": "sign",
						"x": 112,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Spark Tower. Climb the ladder to meet the Tower trainer and win the Spark badge!"
						}]
					},
					{
						"id": 3,
						"name": "up",
						"type": "warp",
						"x": 80,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-5-top"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 4,
						"name": "out",
						"type": "warp",
						"x": 80,
						"y": 128,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "glowworm-caves"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 11
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 5,
						"name": "inside",
						"type": "spot",
						"x": 80,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-5-top": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 5,
		nextobjectid: 5,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Spark Tower, top floor"
			},
			{
				"name": "area",
				"type": "int",
				"value": 5
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 4,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 5,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					0,
					197,
					0,
					0,
					0,
					0,
					0,
					197,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 6,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 7,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower trainer Wiremu",
						"type": "trainer",
						"x": 80,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 111
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "Zap! You found me. I am Wiremu, keeper of the Spark Tower. Every spark is just a small part of a whole. Let us see yours!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Electrifying! The Spark badge is yours. The tunnel to Harbour City is open now. Nearly there!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "fractopus:36,numeratot:37,denomibolt:38"
							},
							{
								"name": "badge",
								"type": "string",
								"value": "spark"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "tower"
							}
						]
					},
					{
						"id": 2,
						"name": "down",
						"type": "warp",
						"x": 80,
						"y": 112,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-5-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 3
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 3,
						"name": "trainer-approach",
						"type": "spot",
						"x": 80,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-6-hall": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 7,
		nextobjectid: 7,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Stone Tower"
			},
			{
				"name": "area",
				"type": "int",
				"value": 6
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 6,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 7,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					196,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					196,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					84,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					199,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					199,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					90,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 8,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 9,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower guide Sefa",
						"type": "person",
						"x": 48,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 88
							},
							{
								"name": "facing",
								"type": "string",
								"value": "right"
							},
							{
								"name": "text",
								"type": "string",
								"value": "Welcome to the Stone Tower, the last one! Stone monsters ask decimals and money: 0.3 + 0.5, $10 - $3.65, rounding.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!"
							}
						]
					},
					{
						"id": 2,
						"name": "tower-sign",
						"type": "sign",
						"x": 112,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "text",
							"type": "string",
							"value": "Stone Tower. Climb the ladder to meet the Tower trainer and win the Stone badge!"
						}]
					},
					{
						"id": 3,
						"name": "up",
						"type": "warp",
						"x": 80,
						"y": 32,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-6-top"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "up"
							}
						]
					},
					{
						"id": 4,
						"name": "out",
						"type": "warp",
						"x": 80,
						"y": 128,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "harbour-city"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 8
							},
							{
								"name": "toY",
								"type": "int",
								"value": 6
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 5,
						"name": "inside",
						"type": "spot",
						"x": 80,
						"y": 96,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	},
	"tower-6-top": {
		type: "map",
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 11,
		height: 9,
		tilewidth: 16,
		tileheight: 16,
		nextlayerid: 5,
		nextobjectid: 5,
		properties: [
			{
				"name": "name",
				"type": "string",
				"value": "Stone Tower, top floor"
			},
			{
				"name": "area",
				"type": "int",
				"value": 6
			},
			{
				"name": "wild",
				"type": "string",
				"value": ""
			}
		],
		tilesets: [
			{
				"firstgid": 1,
				"name": "tiny-town",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 133,
				"name": "tiny-dungeon",
				"image": "../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png",
				"imagewidth": 192,
				"imageheight": 176,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 12,
				"tilecount": 132,
				"margin": 0,
				"spacing": 0
			},
			{
				"firstgid": 265,
				"name": "extra-tiles",
				"image": "../../../src/games/monsters/world/assets/extra-tiles.png",
				"imagewidth": 480,
				"imageheight": 16,
				"tilewidth": 16,
				"tileheight": 16,
				"columns": 30,
				"tilecount": 30,
				"margin": 0,
				"spacing": 0,
				"tiles": [{
					"id": 0,
					"animation": [{
						"tileid": 0,
						"duration": 700
					}, {
						"tileid": 1,
						"duration": 700
					}]
				}, {
					"id": 7,
					"animation": [{
						"tileid": 7,
						"duration": 700
					}, {
						"tileid": 8,
						"duration": 700
					}]
				}]
			}
		],
		layers: [
			{
				"id": 4,
				"name": "ground",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182,
					182
				]
			},
			{
				"id": 5,
				"name": "walls",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					161,
					173,
					173,
					162,
					173,
					173,
					161,
					173,
					173,
					173,
					0,
					197,
					0,
					0,
					0,
					0,
					0,
					197,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					173,
					173,
					0,
					0,
					0,
					0,
					201,
					0,
					0,
					0,
					0,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173,
					173
				]
			},
			{
				"id": 6,
				"name": "grass",
				"type": "tilelayer",
				"x": 0,
				"y": 0,
				"width": 11,
				"height": 9,
				"opacity": 1,
				"visible": true,
				"data": [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]
			},
			{
				"id": 7,
				"name": "objects",
				"type": "objectgroup",
				"draworder": "topdown",
				"x": 0,
				"y": 0,
				"opacity": 1,
				"visible": true,
				"objects": [
					{
						"id": 1,
						"name": "Tower trainer Aroha",
						"type": "trainer",
						"x": 80,
						"y": 48,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "sprite",
								"type": "int",
								"value": 96
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							},
							{
								"name": "sight",
								"type": "int",
								"value": 3
							},
							{
								"name": "text",
								"type": "string",
								"value": "You made it all the way to the Stone Tower! I am Aroha. Stone monsters are tough and exact. Every cent counts!"
							},
							{
								"name": "win",
								"type": "string",
								"value": "Magnificent! The Stone badge is yours, and that makes all six. You are a Maths Monsters champion!"
							},
							{
								"name": "team",
								"type": "string",
								"value": "pebblepoint:45,coinrock:46,centipebble:47"
							},
							{
								"name": "badge",
								"type": "string",
								"value": "stone"
							},
							{
								"name": "loot",
								"type": "string",
								"value": "tower"
							}
						]
					},
					{
						"id": 2,
						"name": "down",
						"type": "warp",
						"x": 80,
						"y": 112,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [
							{
								"name": "to",
								"type": "string",
								"value": "tower-6-hall"
							},
							{
								"name": "toX",
								"type": "int",
								"value": 5
							},
							{
								"name": "toY",
								"type": "int",
								"value": 3
							},
							{
								"name": "facing",
								"type": "string",
								"value": "down"
							}
						]
					},
					{
						"id": 3,
						"name": "trainer-approach",
						"type": "spot",
						"x": 80,
						"y": 64,
						"width": 16,
						"height": 16,
						"rotation": 0,
						"visible": true,
						"properties": [{
							"name": "facing",
							"type": "string",
							"value": "up"
						}]
					}
				]
			}
		]
	}
}).map(([id, raw]) => [id, parseMap(id, raw)]));
/** The badge names, in the order you earn them. */
const BADGE_ORDER = [
	{
		area: 1,
		map: "kauri-bush",
		name: "Kauri Bush",
		type: "leaf",
		badge: "leaf",
		towerHall: "tower-1-hall",
		towerTop: "tower-1-top"
	},
	{
		area: 2,
		map: "shell-beach",
		name: "Shell Beach",
		type: "water",
		badge: "water",
		towerHall: "tower-2-hall",
		towerTop: "tower-2-top"
	},
	{
		area: 3,
		map: "fire-mountain",
		name: "Fire Mountain",
		type: "fire",
		badge: "fire",
		towerHall: "tower-3-hall",
		towerTop: "tower-3-top"
	},
	{
		area: 4,
		map: "snowy-peaks",
		name: "Snowy Peaks",
		type: "ice",
		badge: "ice",
		towerHall: "tower-4-hall",
		towerTop: "tower-4-top"
	},
	{
		area: 5,
		map: "glowworm-caves",
		name: "Glowworm Caves",
		type: "spark",
		badge: "spark",
		towerHall: "tower-5-hall",
		towerTop: "tower-5-top"
	},
	{
		area: 6,
		map: "harbour-city",
		name: "Harbour City",
		type: "stone",
		badge: "stone",
		towerHall: "tower-6-hall",
		towerTop: "tower-6-top"
	}
].map((a) => a.badge);
//#endregion
//#region shared/monsters/world/walking.ts
const inMap = (map, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height;
const NO_BADGES = [];
/**
* Can't walk here: off the map, a wall tile (tree, house, water), a person or sign, or a gate
* whose badge you don't hold (`badges` is what you hold; leave it out for "none").
* Doors and exits can be walked on.
*/
function isBlocked(map, x, y, badges = NO_BADGES) {
	if (!inMap(map, x, y)) return true;
	if (map.warps.some((w) => w.x === x && w.y === y)) return false;
	const gate = gateAt(map, x, y);
	if (gate) return !badges.includes(gate.badge);
	return map.blocked[y * map.width + x];
}
const gateAt = (map, x, y) => map.gates.find((g) => g.x === x && g.y === y);
//#endregion
//#region shared/monsters/world/encounters.ts
/**
* Wild battles in long grass, and trainers who spot you. All the numbers a person might want to
* change are in ENCOUNTERS. No browser, no clock: random numbers come from a seeded `Dice`.
*/
/** EASY TO EDIT: how often grass starts a battle. */
const ENCOUNTERS = {
	/** A wild battle starts after this many steps in long grass (a number from the low to the high, both included). */
	steps: {
		min: 12,
		max: 20
	},
	/** The test page's "More battles" switch. */
	fastSteps: {
		min: 2,
		max: 3
	},
	/** How many tiles ahead a trainer sees you unless the map says otherwise. */
	trainerSight: 4
};
function nextGrassSteps(dice, fast) {
	const r = fast ? ENCOUNTERS.fastSteps : ENCOUNTERS.steps;
	return dice.int(r.min, r.max);
}
/** The wild levels for an area: its range cut in half, the near half (by town) then the far half. */
function wildLevels(area, far) {
	const [low, high] = AREA_LEVELS[Math.min(Math.max(area, 1), AREA_LEVELS.length) - 1];
	const mid = Math.round((low + high) / 2);
	return far ? [mid, high] : [low, mid];
}
/** The species a wild list entry gives at a level: a family grows with the level, a fixed species stays. */
const wildSpecies = (entry, level) => FAMILIES[entry] ? formAt(entry, level) : entry;
function starterFor(type, nth) {
	const family = Object.entries(FAMILIES).filter(([, f]) => f.type === type)[nth]?.[0];
	if (!family) throw new Error(`There is no family number ${nth} for type ${type}`);
	return makeMonster(`${family}-1`, 5);
}
const startTeam = (picks) => [starterFor(picks[0], 0), starterFor(picks[1], picks[1] === picks[0] ? 1 : 0)];
//#endregion
//#region shared/monsters/world/rng.ts
/** A small seeded random source (mulberry32). Same seed, same numbers: tests can repeat a walk. */
var Dice = class {
	seed;
	constructor(seed) {
		this.seed = seed >>> 0;
	}
	/** A number from 0 up to (not including) 1. */
	next() {
		this.seed = this.seed + 1831565813 >>> 0;
		let t = this.seed;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}
	/** A whole number from `low` to `high`, both included. */
	int(low, high) {
		return low + Math.floor(this.next() * (high - low + 1));
	}
};
//#endregion
//#region shared/monsters/world/world.ts
const START_BAG = {
	potion: 5,
	ball: 10
};
const START_MAP = "harbour-town";
function spotOf(opts, map, name) {
	const s = opts.maps[map]?.spots.find((x) => x.name === name);
	if (!s) throw new Error(`Map "${map}" has no spot called "${name}"`);
	return s;
}
/** A new game: in the home town, the given team, the starter bag, and you wake up at the healing centre if you lose. */
function newWorld(opts, team, seed = 1) {
	const start = spotOf(opts, START_MAP, "start");
	const wake = spotOf(opts, "healing-centre", "wake");
	const dice = new Dice(seed);
	return refreshBook({
		version: 1,
		map: START_MAP,
		x: start.x,
		y: start.y,
		facing: start.facing,
		team: structuredClone(team),
		box: [],
		bag: { ...START_BAG },
		beaten: [],
		heal: {
			map: "healing-centre",
			x: wake.x,
			y: wake.y,
			facing: wake.facing
		},
		seed: dice.seed,
		grassSteps: nextGrassSteps(dice, opts.fast ?? false),
		repel: 0,
		steps: 0,
		badges: [],
		seen: [],
		owned: [],
		chests: [],
		paid: []
	});
}
const sorted = (ids) => [...new Set(ids)].sort();
/** The monsters you hold are in the book as owned, and so are the earlier forms they grew from. */
function refreshBook(state) {
	const have = new Set([
		...state.owned,
		...state.team.map((m) => m.species),
		...state.box.map((m) => m.species)
	]);
	for (const id of [...have]) {
		const { family, stage } = speciesOf(id);
		for (let earlier = 1; earlier < stage; earlier++) have.add(`${family}-${earlier}`);
	}
	const owned = sorted(have);
	return {
		...state,
		owned,
		seen: sorted([...state.seen, ...owned])
	};
}
//#endregion
//#region shared/maths/leitner.ts
/**
* Mastery boxes (the Leitner system). Every fact sits in box 0–4:
* correct and quick moves it up one box, correct but slow keeps it where it is, and wrong
* drops it to box 1. A fact only reaches box 4 ("fluent") once it has been answered
* quickly and correctly on at least two different days, so one lucky lesson isn't enough.
*/
function newStats(key) {
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
function afterAnswer(stats, correct, ms, at, quickMs = QUICK_MS) {
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
	if (ms > quickMs) return next;
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
		} else if (multipleChoice || made.choose) choices = choicesFor(answer, made.wrong ?? [], decimal, random);
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
		const before = this.records.get(q.factKey) ?? newStats(q.factKey);
		const at = this.now();
		const after = afterAnswer(before, correct, ms, at, this.definition.quickMs);
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
TODO$2("money-change"), TODO$2("money-several"), TODO$2("money-total"), TODO$2("money-left"), TODO$2("money-swap"), TODO$2("money-short"), TODO$2("money-value"), TODO$2("money-change-big");
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
TODO$1("pattern-add"), TODO$1("pattern-down"), TODO$1("pattern-double"), TODO$1("pattern-missing"), TODO$1("pattern-step"), TODO$1("pattern-grow"), TODO$1("pattern-rule");
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
//#endregion
//#region shared/monsters/topics.ts
/**
* The teacher's topic switches. A switched-off topic's questions are swapped for the nearest topic
* that is on, so no area is ever blocked. "Nearest" is the topic next to it in teaching order
* (the order of the six types in the plan); when two are equally near, the earlier (easier) one wins.
*/
const TOPIC_IDS = [
	{
		id: "place-value",
		label: PLACE_VALUE.label
	},
	{
		id: "add-sub",
		label: ADD_SUB.label
	},
	{
		id: "times-tables",
		label: "Times tables"
	},
	{
		id: "division",
		label: DIVISION.label
	},
	{
		id: "fractions",
		label: FRACTIONS.label
	},
	{
		id: "decimals",
		label: DECIMALS.label
	}
].map((t) => t.id);
const isTopicId = (x) => typeof x === "string" && TOPIC_IDS.includes(x);
//#endregion
//#region shared/monsters/save/verify.ts
/**
* Checking one reported maths question without trusting the browser: the question is made again
* from its key and numbers, and the typed answer is marked here. (`BandedPack.rebuild` was built
* for this in stage N.1; times tables have no numbers to rebuild, so they are checked from the key.)
*/
const packs = new Map();
const packFor = (topic) => {
	let pack = packs.get(topic);
	if (!pack) {
		pack = new BandedPack(BANDED_PACKS[topic]);
		packs.set(topic, pack);
	}
	return pack;
};
/** The numbers in a question must be plain finite numbers, a few of them. */
const isNumber = (n) => typeof n === "number" && Number.isFinite(n);
/**
* Is this a question the game could have asked in this area, and was the answer right?
* `area` and `far` say where the battle was, so the band must be the one the area asks for
* (the teacher's topic switches can swap the topic, never make the band easier).
*/
function markQuestion(q, area, far) {
	if (!q || typeof q !== "object") return {
		ok: false,
		problem: "question"
	};
	const r = q;
	if (!isTopicId(r.topic)) return {
		ok: false,
		problem: "question-topic"
	};
	const topic = r.topic;
	if (typeof r.key !== "string" || r.key.length > 60) return {
		ok: false,
		problem: "question-key"
	};
	if (!isNumber(r.given)) return {
		ok: false,
		problem: "question-answer"
	};
	if (!Number.isInteger(r.band) || r.band !== bandFor(topic, area, far)) return {
		ok: false,
		problem: "question-band"
	};
	const band = r.band;
	if (topic === "times-tables") {
		const fact = parseFactKey(r.key);
		if (!fact) return {
			ok: false,
			problem: "question-key"
		};
		const pools = poolsFor({ level: band });
		if (![
			...pools.focus,
			...pools.review,
			...pools.stretch
		].includes(r.key)) return {
			ok: false,
			problem: "question-band"
		};
		const product = fact.a * fact.b;
		if (r.kind === "multiply") return {
			ok: true,
			correct: r.given === product
		};
		if (r.kind === "missing-factor" && band >= 4) return {
			ok: true,
			correct: r.given === fact.a || r.given === fact.b
		};
		return {
			ok: false,
			problem: "question-kind"
		};
	}
	const pack = packFor(topic);
	const keyBand = pack.bandOf(r.key);
	if (keyBand === void 0 || keyBand > Math.min(band + 1, pack.bandCount)) return {
		ok: false,
		problem: "question-band"
	};
	if (!Array.isArray(r.params) || r.params.length > 8 || !r.params.every(isNumber)) return {
		ok: false,
		problem: "question-params"
	};
	const made = pack.rebuild(r.key, r.params);
	if (!made) return {
		ok: false,
		problem: "question-params"
	};
	return {
		ok: true,
		correct: sameAnswer(r.given, made.answer)
	};
}
//#endregion
//#region shared/monsters/save/check.ts
/** Easy to edit: what a person can do. */
const LIMITS = {
	/** Battles one save may carry. */
	maxBattles: 40,
	/** Steps in one battle (a long Tower fight is about 40). */
	maxSteps: 250,
	/** Questions answered in any 60 seconds. */
	answersPerMinute: 24,
	/** The quickest an answer can be, in milliseconds. */
	minAnswerMs: 250,
	/** Walking is about 5 tiles a second; this leaves room for a slow clock. */
	stepsPerSecond: 6,
	/** Steps allowed on top (a save just after another has no time between them). */
	stepSlack: 40,
	/** A save made after this long without an earlier one is checked as if this long had passed (a first save). */
	firstSaveSeconds: 3600,
	/** The newest a save may be, ahead of the server's clock (clocks are never quite right). */
	clockAheadMs: 6e4,
	/** The oldest a save may be. */
	oldestMs: 5184e6,
	/** Box size. */
	maxBox: 300,
	/** Most of one item the bag may hold. */
	maxItem: 999,
	/** Gap allowed between one answer ending and the next starting, in milliseconds (clock rounding). */
	answerSlackMs: 1500
};
const UUID$1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIRS = [
	"up",
	"down",
	"left",
	"right"
];
const ITEMS = ITEM_ORDER;
const isInt = (n, min, max) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const isObject = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const isStringArray = (x) => Array.isArray(x) && x.every((s) => typeof s === "string" && s.length <= 80);
const fail = (problem) => ({
	ok: false,
	problem
});
const MAPS = WORLD_MAPS;
const things = (m) => m.things;
const ALL_THINGS = Object.values(MAPS).flatMap(things);
const CHEST_IDS = new Set(ALL_THINGS.filter((t) => t.kind === "chest").map((t) => t.id));
const CHEST_LOOT = new Map(ALL_THINGS.filter((t) => t.kind === "chest").map((t) => [t.id, t.loot ?? ""]));
const TRAINERS = new Map(ALL_THINGS.filter((t) => t.kind === "trainer").map((t) => [t.id, t]));
const TRAINER_MAP = new Map(Object.values(MAPS).flatMap((m) => m.things.filter((t) => t.kind === "trainer").map((t) => [t.id, m.id])));
const PAYING_TRAINERS = new Set([...TRAINERS.values()].filter((t) => t.loot).map((t) => t.id));
const SPECIES_ID = /^[a-z]+-[123]$/;
/** The highest area your badges open: area 1 is open, and each badge opens the next. */
function maxAreaFor(badges) {
	let n = 0;
	while (n < BADGE_ORDER.length && badges.includes(BADGE_ORDER[n])) n += 1;
	return n + 1;
}
function monsterOk(m) {
	if (!isObject(m)) return false;
	if (typeof m.species !== "string" || !SPECIES_ID.test(m.species)) return false;
	let species;
	try {
		species = speciesOf(m.species);
	} catch {
		return false;
	}
	if (!isInt(m.level, 1, TUNING.maxLevel) || !isInt(m.exp, 0, 1e7)) return false;
	if (m.exp < expForLevel(m.level) || m.level < TUNING.maxLevel && m.exp >= expForLevel(m.level + 1)) return false;
	if (species.stage > speciesOf(formAt(species.family, m.level)).stage) return false;
	if (!isInt(m.hp, 0, maxHpOf(m))) return false;
	if (m.shiny !== void 0 && m.shiny !== true) return false;
	return Object.keys(m).every((k) => [
		"species",
		"level",
		"exp",
		"hp",
		"shiny"
	].includes(k));
}
/** One monster as the pool counts it: who, and how much exp. Health and order don't matter. */
const signature = (m) => `${m.species}:${m.exp}${m.shiny ? ":s" : ""}`;
const poolOf = (team, box) => [...team, ...box].map(signature).sort();
const samePool = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);
const bagOk = (bag) => isObject(bag) && Object.entries(bag).every(([k, v]) => ITEMS.includes(k) && isInt(v, 0, LIMITS.maxItem));
function worldShape(w) {
	if (!isObject(w) || w.version !== 1) return "world";
	const world = w;
	if (typeof world.map !== "string" || !MAPS[world.map]) return "map";
	if (!isInt(world.x, 0, 200) || !isInt(world.y, 0, 200) || !DIRS.includes(world.facing)) return "tile";
	if (!Array.isArray(world.team) || world.team.length < 1 || world.team.length > 6 || !world.team.every(monsterOk)) return "team";
	if (!Array.isArray(world.box) || world.box.length > LIMITS.maxBox || !world.box.every(monsterOk)) return "box";
	if (!bagOk(world.bag)) return "bag";
	for (const key of [
		"beaten",
		"badges",
		"seen",
		"owned",
		"chests",
		"paid"
	]) if (!isStringArray(world[key])) return "sets";
	if (new Set(world.badges).size !== world.badges.length || !world.badges.every((b) => BADGE_ORDER.includes(b))) return "badges";
	if (!isObject(world.heal) || typeof world.heal.map !== "string" || !MAPS[world.heal.map] || !isInt(world.heal.x, 0, 200) || !isInt(world.heal.y, 0, 200) || !DIRS.includes(world.heal.facing)) return "heal";
	if (!isInt(world.seed, 0, 4294967295) || !isInt(world.grassSteps, 0, 100) || !isInt(world.repel, 0, 1e3) || !isInt(world.steps, 0, 1e9)) return "counters";
	const sorted = (a) => a.every((s, i) => i === 0 || a[i - 1] < s);
	if (!sorted(world.seen) || !sorted(world.owned) || !world.seen.every((s) => SPECIES_ID.test(s)) || !world.owned.every((s) => SPECIES_ID.test(s))) return "book";
	if (!world.seen.every(speciesKnown) || !world.owned.every(speciesKnown)) return "book";
	if (!world.chests.every((c) => CHEST_IDS.has(c)) || new Set(world.chests).size !== world.chests.length) return "chests";
	if (!world.paid.every((p) => PAYING_TRAINERS.has(p)) || new Set(world.paid).size !== world.paid.length) return "paid";
	const here = MAPS[world.map];
	if (!world.beaten.every((b) => TRAINER_MAP.get(b) === here.id)) return "beaten";
	if (here.area > maxAreaFor(world.badges)) return "area-locked";
	if (isBlocked(here, world.x, world.y, world.badges) || here.things.some((t) => t.x === world.x && t.y === world.y)) return "tile";
	if (!MAPS[world.heal.map].things.some((t) => t.kind === "nurse" && Math.abs(t.x - world.heal.x) + Math.abs(t.y - world.heal.y) <= 2)) return "heal";
	return null;
}
function speciesKnown(id) {
	try {
		speciesOf(id);
		return true;
	} catch {
		return false;
	}
}
const isSubset = (small, big) => small.every((s) => big.includes(s));
const sameList = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);
/** Plays one reported battle with the rules, checking each question and each random number. Returns a problem code or the result. */
function replay(report, pool, allowance) {
	if (!isObject(report) || typeof report.id !== "string" || !UUID$1.test(report.id)) return "battle";
	const r = report;
	const map = typeof r.map === "string" ? MAPS[r.map] : void 0;
	if (!map) return "battle-map";
	if (!isObject(r.setup) || !Array.isArray(r.steps) || r.steps.length > LIMITS.maxSteps || ![
		"won",
		"lost",
		"ran",
		"caught"
	].includes(r.outcome)) return "battle";
	const setup = r.setup;
	if (setup.kind === "wild") {
		if (r.trainer !== void 0 || map.area < 1 || !map.wild.length) return "battle-setup";
		if (setup.area !== map.area || typeof setup.far !== "boolean" || !Array.isArray(setup.foes) || setup.foes.length !== 1) return "battle-setup";
		const foe = setup.foes[0];
		const [low, high] = wildLevels(map.area, setup.far);
		if (!isObject(foe) || !isInt(foe.level, low, high)) return "battle-foe";
		if (!map.wild.map((entry) => wildSpecies(entry, foe.level)).includes(foe.species)) return "battle-foe";
		const fresh = makeMonster(foe.species, foe.level);
		if (foe.exp !== fresh.exp || foe.hp !== fresh.hp || foe.shiny !== void 0 && foe.shiny !== true) return "battle-foe";
	} else if (setup.kind === "trainer") {
		const trainer = typeof r.trainer === "string" ? TRAINERS.get(r.trainer) : void 0;
		if (!trainer || TRAINER_MAP.get(trainer.id) !== map.id) return "battle-setup";
		if (setup.area !== Math.max(map.area, 1) || setup.far !== true) return "battle-setup";
		const expected = (trainer.team ?? []).map((m) => makeMonster(m.species, m.level));
		if (!Array.isArray(setup.foes) || JSON.stringify(setup.foes) !== JSON.stringify(expected)) return "battle-foe";
	} else return "battle-setup";
	if (!Array.isArray(setup.team) || !setup.team.every(monsterOk) || setup.box !== void 0 && (!Array.isArray(setup.box) || !setup.box.every(monsterOk))) return "battle-setup";
	if (setup.bag !== void 0 && !bagOk(setup.bag)) return "battle-setup";
	if (!samePool(poolOf(setup.team, setup.box ?? []), pool)) return "pool-mismatch";
	for (const id of ITEM_ORDER) if ((setup.bag?.[id] ?? 0) > (allowance[id] ?? 0)) return "bag";
	let state;
	try {
		state = newBattle(setup).state;
	} catch {
		return "battle-setup";
	}
	const answers = [];
	for (const step of r.steps) {
		if (!isObject(step) || !isObject(step.action) || !Array.isArray(step.randoms) || step.randoms.length > 40) return "battle-step";
		const draws = step.randoms;
		if (!draws.every((n) => typeof n === "number" && n >= 0 && n < 1)) return "battle-random";
		const action = step.action;
		if (action.kind === "fight" || action.kind === "catch") {
			if (state.phase === "replace") return "battle-step";
			if (!questionFor(state, action) || step.q === void 0) return "battle-answer";
			const marked = markQuestion(step.q, state.area, state.far);
			if (!marked.ok) return marked.problem;
			const q = step.q;
			if (!isInt(q.ms, LIMITS.minAnswerMs, 36e5)) return "battle-answer";
			const result = action.answer;
			const quickOk = q.ms <= quickSeconds(q.topic, q.band) * 1e3;
			if (marked.correct ? !(result === "right" || result === "quick-right" && quickOk) : result !== "wrong") return "battle-answer";
			answers.push({
				q,
				correct: marked.correct
			});
		} else if (step.q !== void 0) return "battle-answer";
		let used = 0;
		const random = () => {
			if (used >= draws.length) throw new RangeError("out of random numbers");
			return draws[used++];
		};
		try {
			state = play(state, action, random).state;
		} catch (e) {
			return e instanceof RangeError ? "battle-random" : "battle-replay";
		}
		if (used !== draws.length) return "battle-random";
	}
	if (![
		"won",
		"lost",
		"ran",
		"caught"
	].includes(state.phase) || state.phase !== r.outcome) return "battle-outcome";
	return {
		report: r,
		final: state,
		answers,
		wild: setup.kind === "wild"
	};
}
/**
* Checks one save against the last good one (null for a student's first save). `nowMs` is the
* server's clock. Returns what to keep, or the first thing wrong, as a short code (it goes in the
* server's log and on the teacher page, never to the student).
*/
function checkSave(prev, raw, nowMs) {
	if (!isObject(raw)) return fail("item");
	const item = raw;
	if (typeof item.saveId !== "string" || !UUID$1.test(item.saveId)) return fail("save-id");
	if (!isInt(item.seq, 1, 1e7) || !isInt(item.at, 0, 0x5af3107a4000)) return fail("item");
	if (!Array.isArray(item.battles) || item.battles.length > LIMITS.maxBattles) return fail("battles");
	const w = item.world;
	const shape = worldShape(w);
	if (shape) return fail(shape);
	let before;
	if (prev) {
		if (item.start !== void 0) return fail("start");
		before = prev;
	} else {
		const s = item.start;
		if (!Array.isArray(s) || s.length !== 2 || !s.every((t) => TYPES.includes(t))) return fail("start");
		before = {
			world: newWorld({ maps: MAPS }, startTeam(s), w.seed),
			at: item.at - LIMITS.firstSaveSeconds * 1e3
		};
	}
	const was = before.world;
	if (item.at > nowMs + LIMITS.clockAheadMs || item.at < nowMs - LIMITS.oldestMs || item.at < before.at) return fail("time");
	const seconds = Math.max(0, (item.at - before.at) / 1e3);
	if (w.steps < was.steps) return fail("steps");
	if (!isSubset(was.badges, w.badges) || !isSubset(was.chests, w.chests) || !isSubset(was.paid, w.paid) || !isSubset(was.owned, w.owned) || !isSubset(was.seen, w.seen)) return fail("shrank");
	const bookExpected = refreshBook({
		...w,
		owned: was.owned,
		seen: was.seen
	});
	if (!sameList(w.owned, bookExpected.owned) || !isSubset(bookExpected.seen, w.seen)) return fail("owned");
	let pool = poolOf(was.team, was.box);
	const newChests = w.chests.filter((c) => !was.chests.includes(c));
	const newPaid = w.paid.filter((p) => !was.paid.includes(p));
	const newBadges = w.badges.filter((b) => !was.badges.includes(b));
	let allowance = { ...was.bag };
	for (const c of newChests) allowance = addToBag(allowance, LOOT[CHEST_LOOT.get(c) ?? ""] ?? {});
	for (const p of newPaid) allowance = addToBag(allowance, LOOT[TRAINERS.get(p).loot ?? ""] ?? {});
	const answers = {};
	const timeline = [];
	const summary = {
		wildWins: 0,
		trainerWins: 0,
		newBadges,
		catches: 0,
		questions: 0,
		right: 0,
		owned: 0,
		seen: 0,
		badges: 0,
		finalInTeam: 0
	};
	const wonTrainers = new Set();
	let wildBattles = 0;
	const seenIds = new Set();
	for (const raw of item.battles) {
		const out = replay(raw, pool, allowance);
		if (typeof out === "string") return fail(out);
		if (seenIds.has(out.report.id)) return fail("battle");
		seenIds.add(out.report.id);
		const { setup } = out.report;
		for (const id of ITEM_ORDER) {
			const used = (setup.bag?.[id] ?? 0) - (out.final.bag[id] ?? 0);
			if (used > 0) allowance[id] = (allowance[id] ?? 0) - used;
		}
		pool = poolOf(out.final.team, out.final.box);
		if (out.wild) wildBattles += 1;
		if (out.report.outcome === "won") {
			if (out.wild) summary.wildWins += 1;
			else {
				summary.trainerWins += 1;
				wonTrainers.add(out.report.trainer);
			}
		}
		if (out.report.outcome === "caught") summary.catches += 1;
		for (const a of out.answers) {
			timeline.push(a);
			summary.questions += 1;
			if (a.correct) summary.right += 1;
		}
	}
	if (!samePool(poolOf(w.team, w.box), pool)) return fail("pool-mismatch");
	for (const id of ITEM_ORDER) if ((w.bag[id] ?? 0) > (allowance[id] ?? 0)) return fail("bag");
	for (const b of newBadges) if (![...wonTrainers].some((id) => TRAINERS.get(id)?.badge === b)) return fail("badge");
	for (const p of newPaid) if (!wonTrainers.has(p)) return fail("paid");
	for (const c of newChests) if (Object.values(MAPS).find((m) => m.things.some((t) => t.id === c)).area > maxAreaFor(w.badges)) return fail("area-locked");
	const newSteps = w.steps - was.steps;
	if (newSteps > LIMITS.stepsPerSecond * seconds + LIMITS.stepSlack) return fail("speed");
	if (wildBattles > newSteps / ENCOUNTERS.steps.min + 2) return fail("pace");
	let windowStart = 0;
	let lastAt = prev ? before.at - 1e4 : nowMs - LIMITS.oldestMs;
	const ats = [];
	for (const { q, correct } of timeline) {
		if (!isInt(q.at, 0, 0x5af3107a4000) || q.at < nowMs - LIMITS.oldestMs || q.at > item.at + 3e4) return fail("answer-time");
		if (q.at < lastAt + q.ms - LIMITS.answerSlackMs) return fail("answer-time");
		lastAt = q.at;
		ats.push(q.at);
		while (ats[ats.length - 1] - ats[windowStart] >= 6e4) windowStart += 1;
		if (ats.length - windowStart > LIMITS.answersPerMinute) return fail("answer-pace");
		(answers[q.topic] ??= []).push({
			key: q.key,
			correct,
			ms: q.ms,
			at: q.at
		});
	}
	summary.owned = w.owned.length;
	summary.seen = w.seen.length;
	summary.badges = w.badges.length;
	summary.finalInTeam = w.team.filter((m) => speciesOf(m.species).stage === 3).length;
	return {
		ok: true,
		save: {
			item,
			summary,
			answers
		}
	};
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
/** A batch id for one topic of one save: the same save always gives the same ids, so a retry is never counted twice. */
async function batchIdFor(saveId, topic) {
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`monster:${saveId}:${topic}`)));
	const h = hex(digest.slice(0, 16));
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleMonster(request) {
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
		if (!limiter.allow(player, 20)) return reply(429, { error: "Slow down a little!" });
		const body = await readJsonBody(request);
		if (!body || !Array.isArray(body.items) || body.items.length > 12) return reply(400, { error: "That couldn't be read." });
		if (body.items.length === 0) return reply(200, {
			handled: 0,
			results: []
		});
		const on = await services.enabled(player);
		if (!on.ok) return reply(503, { error: "We couldn't save your game just now." });
		if (!on.value) return reply(503, { error: "Maths Monsters is switched off." });
		const first = await services.loadSave(player);
		if (!first.ok) return reply(503, { error: "We couldn't save your game just now." });
		let prev = first.value;
		const ids = body.items.flatMap((x) => typeof x?.saveId === "string" && UUID.test(x.saveId) ? [x.saveId] : []);
		const known = ids.length ? await services.knownSaves(player, ids) : {
			ok: true,
			value: []
		};
		if (!known.ok) return reply(503, { error: "We couldn't save your game just now." });
		const kept = new Set(known.value);
		const results = [];
		let refused = null;
		for (const raw of body.items) {
			if (refused) {
				results.push({
					type: "refused",
					problem: "after-refusal"
				});
				continue;
			}
			if (kept.has(raw?.saveId ?? "")) {
				results.push({
					type: "save",
					status: "duplicate",
					version: first.value?.version ?? 0,
					points: null
				});
				continue;
			}
			const checked = checkSave(prev, raw, services.now());
			if (!checked.ok) {
				refused = checked.problem;
				await refuse(player, checked.problem, raw, services);
				results.push({
					type: "refused",
					problem: checked.problem
				});
				continue;
			}
			const { item, summary, answers } = checked.save;
			let stop = false;
			for (const [topic, list] of Object.entries(answers)) {
				if (!list?.length) continue;
				const recorded = await services.recordAnswers(player, topic, await batchIdFor(item.saveId, topic), list);
				if (recorded.ok) continue;
				if (recorded.why === "refused") {
					refused = "answers";
					await refuse(player, "answers", raw, services);
					results.push({
						type: "refused",
						problem: "answers"
					});
				} else stop = true;
				break;
			}
			if (refused) continue;
			if (stop) break;
			const saved = await services.recordSave(player, {
				saveId: item.saveId,
				seq: item.seq,
				at: item.at,
				world: item.world,
				battles: item.battles,
				summary
			});
			if (!saved.ok) {
				if (saved.why === "refused") {
					refused = "database";
					await refuse(player, "database", raw, services);
					results.push({
						type: "refused",
						problem: "database"
					});
					continue;
				}
				break;
			}
			if (saved.value.status === "stale") {
				refused = "stale";
				await refuse(player, "stale", raw, services);
				results.push({
					type: "refused",
					problem: "stale"
				});
				continue;
			}
			results.push({
				type: "save",
				...saved.value
			});
			prev = {
				world: item.world,
				at: item.at
			};
		}
		if (results.length === 0) return reply(503, { error: "We couldn't save your game just now." });
		return reply(200, {
			handled: results.length,
			results
		});
	};
}
/** Logs what was wrong (a code, never who sent it) and leaves a note for the teacher page. */
async function refuse(player, problem, raw, services) {
	console.warn(`monster: refused a save (${problem})`);
	const seq = raw?.seq;
	await services.recordRefusal(player, problem, typeof seq === "number" && Number.isInteger(seq) ? seq : null);
}
//#endregion
//#region supabase/functions/monster/entry.ts
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
	console.error(`monster: ${name} failed (${error.code ?? "unknown"})`);
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
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async enabled(player) {
		const { data, error } = await admin.rpc("settings_of", { player }).maybeSingle();
		if (error || !data) return {
			ok: false,
			why: "busy"
		};
		return {
			ok: true,
			value: data.monsters_enabled === true
		};
	},
	async loadSave(player) {
		const loaded = await call("load_monster_save", { player });
		if (!loaded.ok) return loaded;
		return {
			ok: true,
			value: loaded.value ? {
				world: loaded.value.world,
				at: Number(loaded.value.clientAt),
				version: loaded.value.version
			} : null
		};
	},
	knownSaves: (player, ids) => call("known_monster_saves", {
		player,
		ids
	}),
	recordAnswers: (player, pack, batchId, answers) => call("record_fact_answers", {
		player,
		pack,
		batch_id: batchId,
		answers,
		quick_ms: QUICK_MS,
		fluent_days: 2,
		top_box: 4
	}),
	recordSave: (player, save) => call("record_monster_save", {
		player,
		save
	}),
	recordRefusal: (player, reason, seq) => call("record_monster_refusal", {
		player,
		reason,
		seq
	})
}));
//#endregion
