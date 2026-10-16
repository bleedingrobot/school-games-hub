// GENERATED FILE: don't edit. Edit supabase/functions/gem-keep/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "gem-keep" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
//#region shared/maths/facts.ts
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
//#endregion
//#region shared/gem-keep/config.ts
/**
* The maths in the game. Right answers give; wrong answers never take anything away.
*/
const MATHS = {
	/** Mana Well: up to this many questions between waves, this much mana each, plus a bonus from 3 right in a row. */
	well: {
		questions: 10,
		mana: 15,
		streakFrom: 3,
		streakBonus: 5
	},
	/** Wave Gate before a boss wave: 3 questions. 3 right = Power Surge (+25% damage that wave), 2 right = +10%. */
	gate: {
		questions: 3,
		surge: [
			0,
			0,
			.1,
			.25
		]
	},
	/** Keep Shield: once a level, when the Keep drops below this share, 5 quick questions, each right one heals this share. */
	shield: {
		below: .25,
		questions: 5,
		heal: .05
	},
	/** Level Key: questions on the level's focus tables, and how many must be right to unlock the next level. */
	key: {
		questions: 10,
		passMark: 8
	},
	/** Gem Forge: combining gems of this grade asks facts from these mastery boxes (none listed = any). */
	combineBoxes: {
		1: [3, 4],
		2: [],
		3: [
			0,
			1,
			2
		],
		4: [
			0,
			1,
			2
		]
	},
	/** Challenge mode: the game keeps running at this share of its speed while a question is up. */
	challengeSpeed: .5
};
//#endregion
//#region shared/gem-keep/levels/index.ts
const CAMPAIGN = [
	{
		id: "level-1",
		name: "Crystal Valley",
		intro: "A gentle start. Build towers beside the path.",
		toughness: 1,
		startMana: 140,
		map: [
			"................",
			"......^.........",
			"................",
			"..............~~",
			"....^.........~~",
			"................",
			"................",
			"................",
			".^..........^...",
			"~~.............."
		],
		paths: [[
			[-1, 2],
			[3, 2],
			[3, 7],
			[8, 7],
			[8, 2],
			[12, 2],
			[12, 6],
			[14, 6]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 5,
				"gap": 1.6
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 8,
				"gap": 1.3
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 6,
				"gap": 1.2
			}, {
				"kind": "runner",
				"count": 3,
				"gap": 1.5,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "runner",
				"count": 8,
				"gap": .9
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 0
			}, {
				"kind": "walker",
				"count": 5,
				"gap": 1.2,
				"delay": 3
			}] },
			{ "groups": [{
				"kind": "swarm",
				"count": 15,
				"gap": .4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 10,
				"gap": .9
			}, {
				"kind": "brute",
				"count": 1,
				"gap": 0,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "brute",
					"count": 2,
					"gap": 4
				},
				{
					"kind": "runner",
					"count": 8,
					"gap": .7,
					"delay": 3
				},
				{
					"kind": "walker",
					"count": 8,
					"gap": .8,
					"delay": 6
				}
			] }
		]
	},
	{
		id: "level-2",
		name: "Sunny Meadow",
		intro: "Runners are quick. Slow them down with blue gems!",
		toughness: 1.28,
		startMana: 140,
		map: [
			"................",
			".^..............",
			"................",
			".............^..",
			"..^.............",
			".......^........",
			"................",
			"................",
			".......~~.......",
			".......~~......."
		],
		paths: [[
			[-1, 7],
			[4, 7],
			[4, 2],
			[10, 2],
			[10, 7],
			[14, 7]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 6,
				"gap": 1
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 7,
				"gap": 1
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 7,
					"gap": 1
				},
				{
					"kind": "runner",
					"count": 4,
					"gap": .8,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 13,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 8,
				"gap": .9
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 5,
				"gap": .9,
				"delay": 3
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 10,
				"gap": .9
			}, {
				"kind": "swarm",
				"count": 16,
				"gap": .35,
				"delay": 6
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 11,
				"gap": .9
			}, {
				"kind": "runner",
				"count": 6,
				"gap": .7,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 11,
				"gap": .9
			}] }
		]
	},
	{
		id: "level-3",
		name: "River Bend",
		intro: "The river winds. So does the path.",
		toughness: 1.83,
		startMana: 140,
		map: [
			".........~~~~~~~",
			"................",
			"................",
			"^...^...........",
			"................",
			"........~~......",
			"........~~.^....",
			"................",
			"................",
			"................"
		],
		paths: [[
			[-1, 1],
			[6, 1],
			[6, 5],
			[2, 5],
			[2, 8],
			[13, 8],
			[13, 3],
			[10, 3]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 6,
				"gap": 1
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 7,
				"gap": .9
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 8,
					"gap": .9
				},
				{
					"kind": "runner",
					"count": 5,
					"gap": .7,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 14,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 9,
				"gap": .9
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 5,
				"gap": .9,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 10,
					"gap": .9
				},
				{
					"kind": "swarm",
					"count": 17,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 2,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 11,
				"gap": .8
			}, {
				"kind": "runner",
				"count": 7,
				"gap": .6,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 12,
				"gap": .8
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 13,
					"gap": .8
				},
				{
					"kind": "runner",
					"count": 8,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 20,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 2,
					"gap": 3,
					"delay": 5
				}
			] }
		]
	},
	{
		id: "level-4",
		name: "Rocky Pass",
		intro: "They come from the east this time.",
		toughness: 2.17,
		startMana: 140,
		map: [
			"................",
			"................",
			".......^^.......",
			"................",
			"..............^.",
			"................",
			"...^...^.^......",
			"................",
			"................",
			"................"
		],
		paths: [[
			[16, 1],
			[11, 1],
			[11, 4],
			[4, 4],
			[4, 1],
			[1, 1],
			[1, 8],
			[12, 8],
			[12, 6]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 7,
				"gap": .9
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 8,
				"gap": .9
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 8,
					"gap": .9
				},
				{
					"kind": "runner",
					"count": 5,
					"gap": .7,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 15,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 9,
				"gap": .9
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 5,
				"gap": .8,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 11,
					"gap": .8
				},
				{
					"kind": "swarm",
					"count": 18,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 2,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 12,
				"gap": .8
			}, {
				"kind": "runner",
				"count": 7,
				"gap": .6,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 12,
				"gap": .8
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 13,
					"gap": .7
				},
				{
					"kind": "runner",
					"count": 8,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 21,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 2,
					"gap": 3,
					"delay": 5
				}
			] }
		]
	},
	{
		id: "level-5",
		name: "The Long Road",
		intro: "A long road gives your towers time. Make it count.",
		toughness: 2.12,
		startMana: 140,
		map: [
			"................",
			"................",
			"................",
			".....^....^.....",
			"................",
			"................",
			"................",
			"................",
			"~...........^...",
			"~..............."
		],
		paths: [[
			[-1, 1],
			[13, 1],
			[13, 5],
			[2, 5],
			[2, 8],
			[10, 8]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 7,
				"gap": .9
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 8,
				"gap": .9
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 9,
					"gap": .8
				},
				{
					"kind": "runner",
					"count": 5,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 16,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 10,
				"gap": .8
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 6,
				"gap": .8,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 11,
					"gap": .8
				},
				{
					"kind": "swarm",
					"count": 19,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 2,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 12,
				"gap": .7
			}, {
				"kind": "runner",
				"count": 7,
				"gap": .6,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 13,
				"gap": .7
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 14,
					"gap": .7
				},
				{
					"kind": "runner",
					"count": 8,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 22,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 8,
				"gap": .7,
				"delay": 3
			}] }
		]
	},
	{
		id: "level-6",
		name: "Two Rivers",
		intro: "Two paths now! Watch both sides.",
		toughness: 1.57,
		startMana: 140,
		map: [
			"................",
			"............~~..",
			"..............^.",
			"................",
			"................",
			"................",
			".^..............",
			"....~~..........",
			"....~~..........",
			"................"
		],
		paths: [[
			[-1, 1],
			[3, 1],
			[3, 4],
			[6, 4],
			[6, 2],
			[8, 2],
			[8, 5]
		], [
			[16, 8],
			[12, 8],
			[12, 4],
			[10, 4],
			[10, 7],
			[8, 7],
			[8, 5]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 8,
				"gap": .8
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 9,
				"gap": .8
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 9,
					"gap": .8
				},
				{
					"kind": "runner",
					"count": 6,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 17,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 10,
				"gap": .8
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 6,
				"gap": .7,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 12,
					"gap": .7
				},
				{
					"kind": "swarm",
					"count": 20,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 2,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 13,
				"gap": .7
			}, {
				"kind": "runner",
				"count": 8,
				"gap": .6,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 13,
				"gap": .7
			}, {
				"kind": "brute",
				"count": 3,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 14,
					"gap": .7
				},
				{
					"kind": "runner",
					"count": 9,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 23,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 8,
				"gap": .6,
				"delay": 3
			}] }
		]
	},
	{
		id: "level-7",
		name: "Frost Ridge",
		intro: "Tough enemies on a long climb.",
		toughness: 2.14,
		startMana: 140,
		map: [
			"................",
			"................",
			"^...............",
			"................",
			"....^...........",
			"........^.......",
			"................",
			"............^...",
			"...............~",
			"...............~"
		],
		paths: [[
			[-1, 8],
			[2, 8],
			[2, 1],
			[6, 1],
			[6, 8],
			[10, 8],
			[10, 1],
			[14, 1],
			[14, 5]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 8,
				"gap": .8
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 9,
				"gap": .8
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 10,
					"gap": .7
				},
				{
					"kind": "runner",
					"count": 6,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 18,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 11,
				"gap": .7
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 6,
				"gap": .7,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 12,
					"gap": .7
				},
				{
					"kind": "swarm",
					"count": 21,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 2,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 13,
				"gap": .7
			}, {
				"kind": "runner",
				"count": 8,
				"gap": .6,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 14,
				"gap": .6
			}, {
				"kind": "brute",
				"count": 3,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 15,
					"gap": .6
				},
				{
					"kind": "runner",
					"count": 9,
					"gap": .5,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 24,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 8,
				"gap": .6,
				"delay": 3
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 8,
				"gap": .6,
				"delay": 3
			}] }
		]
	},
	{
		id: "level-8",
		name: "Twin Gates",
		intro: "Two gates, one Keep.",
		toughness: 1.58,
		startMana: 140,
		map: [
			"......~~~.......",
			"................",
			"................",
			"................",
			"............^...",
			"................",
			"................",
			"........^.......",
			"...^............",
			"................"
		],
		paths: [[
			[-1, 0],
			[4, 0],
			[4, 3],
			[1, 3],
			[1, 6],
			[6, 6],
			[6, 4],
			[7, 4]
		], [
			[16, 9],
			[11, 9],
			[11, 6],
			[14, 6],
			[14, 2],
			[9, 2],
			[9, 4],
			[7, 4]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 9,
				"gap": .7
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 10,
				"gap": .7
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 10,
					"gap": .7
				},
				{
					"kind": "runner",
					"count": 6,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 19,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 11,
				"gap": .7
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 6,
				"gap": .7,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 13,
					"gap": .6
				},
				{
					"kind": "swarm",
					"count": 22,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 14,
				"gap": .6
			}, {
				"kind": "runner",
				"count": 8,
				"gap": .5,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 14,
				"gap": .6
			}, {
				"kind": "brute",
				"count": 3,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 15,
					"gap": .6
				},
				{
					"kind": "runner",
					"count": 9,
					"gap": .5,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 25,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 8,
				"gap": .5,
				"delay": 3
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 1,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 9,
				"gap": .5,
				"delay": 3
			}] }
		]
	},
	{
		id: "level-9",
		name: "Storm Peaks",
		intro: "Bosses travel in pairs up here.",
		toughness: 1.63,
		startMana: 140,
		map: [
			"................",
			"........^.......",
			"................",
			"................",
			".^..............",
			"..............^.",
			"................",
			"................",
			".....^........~~",
			"..............~~"
		],
		paths: [[
			[-1, 8],
			[3, 8],
			[3, 2],
			[6, 2],
			[6, 6],
			[8, 6]
		], [
			[16, 1],
			[12, 1],
			[12, 8],
			[10, 8],
			[10, 4],
			[8, 4],
			[8, 6]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 9,
				"gap": .7
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 10,
				"gap": .7
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 11,
					"gap": .7
				},
				{
					"kind": "runner",
					"count": 7,
					"gap": .6,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 20,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 12,
				"gap": .6
			}, {
				"kind": "brute",
				"count": 2,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 2,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 7,
				"gap": .6,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 13,
					"gap": .6
				},
				{
					"kind": "swarm",
					"count": 23,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 14,
				"gap": .6
			}, {
				"kind": "runner",
				"count": 9,
				"gap": .5,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 15,
				"gap": .5
			}, {
				"kind": "brute",
				"count": 3,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 16,
					"gap": .5
				},
				{
					"kind": "runner",
					"count": 10,
					"gap": .4,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 26,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "boss",
				"count": 2,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 9,
				"gap": .5,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 17,
					"gap": .5
				},
				{
					"kind": "runner",
					"count": 11,
					"gap": .4,
					"delay": 4
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "boss",
				"count": 2,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 9,
				"gap": .5,
				"delay": 3
			}] }
		]
	},
	{
		id: "level-10",
		name: "Gem Keep Castle",
		intro: "The final stand. Everything you have learned!",
		toughness: 1.17,
		startMana: 140,
		map: [
			"................",
			"................",
			"................",
			"................",
			".............~~.",
			"..........^..~~.",
			"................",
			"^...........^...",
			"................",
			"................"
		],
		paths: [[
			[-1, 0],
			[14, 0],
			[14, 2],
			[1, 2],
			[1, 4],
			[7, 4],
			[7, 6]
		], [
			[16, 9],
			[3, 9],
			[3, 6],
			[7, 6]
		]],
		waves: [
			{ "groups": [{
				"kind": "walker",
				"count": 10,
				"gap": .7
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 11,
				"gap": .6
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 11,
					"gap": .6
				},
				{
					"kind": "runner",
					"count": 7,
					"gap": .5,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 21,
					"gap": .35,
					"delay": 6
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 12,
				"gap": .6
			}, {
				"kind": "brute",
				"count": 3,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [{
				"kind": "boss",
				"count": 2,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 7,
				"gap": .6,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 14,
					"gap": .5
				},
				{
					"kind": "swarm",
					"count": 24,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "walker",
				"count": 15,
				"gap": .5
			}, {
				"kind": "runner",
				"count": 9,
				"gap": .4,
				"delay": 4
			}] },
			{ "groups": [{
				"kind": "walker",
				"count": 15,
				"gap": .5
			}, {
				"kind": "brute",
				"count": 3,
				"gap": 3,
				"delay": 5
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 16,
					"gap": .5
				},
				{
					"kind": "runner",
					"count": 10,
					"gap": .4,
					"delay": 4
				},
				{
					"kind": "swarm",
					"count": 27,
					"gap": .35,
					"delay": 6
				},
				{
					"kind": "brute",
					"count": 3,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "boss",
				"count": 2,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 9,
				"gap": .5,
				"delay": 3
			}] },
			{ "groups": [
				{
					"kind": "walker",
					"count": 18,
					"gap": .4
				},
				{
					"kind": "runner",
					"count": 11,
					"gap": .3,
					"delay": 4
				},
				{
					"kind": "brute",
					"count": 4,
					"gap": 3,
					"delay": 5
				}
			] },
			{ "groups": [{
				"kind": "boss",
				"count": 2,
				"gap": 6
			}, {
				"kind": "walker",
				"count": 10,
				"gap": .4,
				"delay": 3
			}] }
		]
	}
];
/** The level with this id, and its number (1–10). */
function findLevel(id) {
	const i = CAMPAIGN.findIndex((l) => l.id === id);
	return i < 0 ? null : {
		level: CAMPAIGN[i],
		number: i + 1
	};
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isInt = (n, min, max) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
/**
* The shortest a won level can take, in game seconds: the time until each wave's last enemy
* comes in, added up. Enemies still have to walk to the Keep, so real wins take longer.
*/
function minWinSeconds(level) {
	return level.waves.reduce((total, wave) => total + Math.max(0, ...wave.groups.map((g) => (g.delay ?? 0) + (g.count - 1) * g.gap)), 0);
}
/** The level before this one in the campaign (its Level Key opens this one), or null. */
function levelBefore(levelId) {
	const i = CAMPAIGN.findIndex((l) => l.id === levelId);
	return i > 0 ? CAMPAIGN[i - 1].id : null;
}
function checkRun(x) {
	if (typeof x.runId !== "string" || !UUID.test(x.runId)) return {
		ok: false,
		problem: "run-id"
	};
	const found = typeof x.levelId === "string" ? findLevel(x.levelId) : null;
	if (!found) return {
		ok: false,
		problem: "level"
	};
	const total = found.level.waves.length;
	if (x.result !== "won" && x.result !== "lost") return {
		ok: false,
		problem: "result"
	};
	const won = x.result === "won";
	if (!isInt(x.stars, won ? 1 : 0, won ? 3 : 0)) return {
		ok: false,
		problem: "stars"
	};
	if (!isInt(x.waves, won ? total : 0, total)) return {
		ok: false,
		problem: "waves"
	};
	if (!isInt(x.gameSeconds, 0, 36e3)) return {
		ok: false,
		problem: "time"
	};
	if (won && x.gameSeconds < minWinSeconds(found.level) * .9) return {
		ok: false,
		problem: "too-quick"
	};
	if (!isInt(x.asked, 0, 2e3) || !isInt(x.right, 0, x.asked)) return {
		ok: false,
		problem: "answers"
	};
	return {
		ok: true,
		item: {
			type: "run",
			runId: x.runId,
			levelId: found.level.id,
			result: x.result,
			stars: x.stars,
			waves: x.waves,
			gameSeconds: x.gameSeconds,
			asked: x.asked,
			right: x.right
		}
	};
}
function checkKey(x) {
	const found = typeof x.levelId === "string" ? findLevel(x.levelId) : null;
	if (!found) return {
		ok: false,
		problem: "level"
	};
	if (!isInt(x.right, 0, MATHS.key.questions)) return {
		ok: false,
		problem: "answers"
	};
	return {
		ok: true,
		item: {
			type: "key",
			levelId: found.level.id,
			right: x.right
		}
	};
}
function checkFact(f, nowMs) {
	if (!f || typeof f !== "object") return null;
	const s = f;
	if (typeof s.key !== "string" || !parseFactKey(s.key)) return null;
	if (!isInt(s.attempts, 0, 1e5) || !isInt(s.correct, 0, s.attempts)) return null;
	if (!isInt(s.avgMs, 0, 36e5) || !isInt(s.box, 0, 4)) return null;
	if (!isInt(s.lastSeen, 0, nowMs + 864e5)) return null;
	if (!Array.isArray(s.quickDays) || s.quickDays.length > 2) return null;
	if (!s.quickDays.every((d) => typeof d === "string" && DAY.test(d) && !Number.isNaN(Date.parse(d)))) return null;
	if (s.attempts >= 3 && s.avgMs < 250) return null;
	return {
		key: s.key,
		attempts: s.attempts,
		correct: s.correct,
		avgMs: s.avgMs,
		box: s.box,
		lastSeen: s.lastSeen,
		quickDays: s.quickDays
	};
}
function checkFacts(x, nowMs) {
	if (x.pack !== "times-tables") return {
		ok: false,
		problem: "pack"
	};
	if (!Array.isArray(x.facts) || x.facts.length > 200) return {
		ok: false,
		problem: "facts"
	};
	const seen = new Set();
	const facts = [];
	for (const raw of x.facts) {
		const fact = checkFact(raw, nowMs);
		if (fact && !seen.has(fact.key)) {
			seen.add(fact.key);
			facts.push(fact);
		}
	}
	return {
		ok: true,
		item: {
			type: "facts",
			pack: "times-tables",
			facts
		}
	};
}
/** Trial progress: stars must be 0–3 and Level Keys only in campaign order, as the game allows. */
function checkImport(x) {
	if (!Array.isArray(x.levels) || x.levels.length > CAMPAIGN.length) return {
		ok: false,
		problem: "levels"
	};
	const byId = new Map();
	for (const raw of x.levels) {
		const l = raw ?? {};
		if (typeof l.levelId !== "string" || !findLevel(l.levelId)) return {
			ok: false,
			problem: "level"
		};
		if (!isInt(l.stars, 0, 3) || typeof l.keyPassed !== "boolean") return {
			ok: false,
			problem: "level"
		};
		byId.set(l.levelId, {
			stars: l.stars,
			keyPassed: l.keyPassed
		});
	}
	const levels = [];
	for (let i = 0; i < CAMPAIGN.length; i++) {
		const p = byId.get(CAMPAIGN[i].id);
		if (!p || p.stars === 0) continue;
		if (i > 0 && !byId.get(CAMPAIGN[i - 1].id)?.keyPassed) break;
		levels.push({
			levelId: CAMPAIGN[i].id,
			stars: p.stars,
			keyPassed: p.keyPassed
		});
		if (!p.keyPassed) break;
	}
	return {
		ok: true,
		item: {
			type: "import",
			levels
		}
	};
}
/** Checks one item from a save request. */
function checkItem(raw, nowMs) {
	if (!raw || typeof raw !== "object") return {
		ok: false,
		problem: "item"
	};
	const x = raw;
	switch (x.type) {
		case "run": return checkRun(x);
		case "key": return checkKey(x);
		case "facts": return checkFacts(x, nowMs);
		case "import": return checkImport(x);
		default: return {
			ok: false,
			problem: "type"
		};
	}
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
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleGemKeep(request) {
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
		if (!body || !Array.isArray(body.items) || body.items.length > 40) return reply(400, { error: "That couldn't be read." });
		const results = [];
		for (const raw of body.items) {
			const checked = checkItem(raw, services.now());
			if (!checked.ok) {
				console.warn(`gem-keep: refused an item (${checked.problem})`);
				results.push({
					type: "invalid",
					problem: checked.problem
				});
				continue;
			}
			const result = await save(player, checked.item, services);
			if (result === "stop") break;
			results.push(result);
		}
		if (results.length < body.items.length && results.length === 0) return reply(503, { error: "We couldn't save your Gem Keep progress just now." });
		return reply(200, {
			handled: results.length,
			results
		});
	};
}
function settle(saved, ok) {
	if (saved.ok) return ok(saved.value);
	if (saved.why === "refused") return {
		type: "invalid",
		problem: "refused"
	};
	return "stop";
}
async function save(player, item, services) {
	switch (item.type) {
		case "run": {
			const found = findLevel(item.levelId);
			const { type: _type, ...run } = item;
			return settle(await services.recordRun(player, {
				...run,
				levelNumber: found.number,
				afterLevel: levelBefore(item.levelId),
				wavesTotal: found.level.waves.length
			}), (value) => ({
				type: "run",
				...value
			}));
		}
		case "key": return settle(await services.recordKey(player, item.levelId, item.right), (status) => ({
			type: "key",
			status
		}));
		case "facts":
			if (item.facts.length === 0) return {
				type: "facts",
				changed: 0
			};
			return settle(await services.recordFacts(player, item.pack, item.facts), (changed) => ({
				type: "facts",
				changed
			}));
		case "import": return settle(await services.importProgress(player, item.levels), (status) => ({
			type: "import",
			status
		}));
	}
}
//#endregion
//#region supabase/functions/gem-keep/entry.ts
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
	console.error(`gem-keep: ${name} failed (${error.code ?? "unknown"})`);
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
	recordRun: (player, run) => call("record_gem_keep_run", {
		player,
		run
	}),
	recordKey: (player, levelId, right) => call("record_gem_keep_key", {
		player,
		level_id: levelId,
		right_answers: right
	}),
	recordFacts: (player, pack, facts) => call("record_gem_keep_facts", {
		player,
		pack,
		facts
	}),
	importProgress: (player, levels) => call("import_gem_keep_progress", {
		player,
		levels
	})
}));
//#endregion
