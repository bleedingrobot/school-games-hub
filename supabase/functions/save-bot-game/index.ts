// GENERATED FILE: don't edit. Edit supabase/functions/save-bot-game/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "save-bot-game" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { Chess } from "npm:chess.js@1.4.0";
//#region supabase/functions/_shared/stamp.ts
/**
* Stamps (signatures) only the server can make: an HMAC-SHA256 of some text, as URL-safe
* base64. The key is made from the server's own secret key and a purpose, so there's nothing
* new to set up, and a stamp made for one purpose is no use for another.
*/
const encoder = new TextEncoder();
async function hmac(key, text) {
	const raw = typeof key === "string" ? encoder.encode(key) : key;
	const imported = await crypto.subtle.importKey("raw", raw, {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(text)));
}
function base64Url(bytes) {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** Returns a function that stamps text for one purpose. Null stamps if there's no secret. */
function stamper(secret, purpose) {
	let key = null;
	return async (text) => {
		if (!secret) return null;
		key ??= hmac(secret, `school-games-hub:${purpose}`);
		return base64Url(await hmac(await key, text));
	};
}
//#endregion
//#region shared/botGame.ts
const BOT_LEVEL_IDS = [
	"very-easy",
	"easy",
	"medium"
];
function isClaimedEnding(value) {
	return value === "finished" || value === "resigned" || value === "abandoned";
}
function isBotLevelId(value) {
	return BOT_LEVEL_IDS.includes(value);
}
/** A list of moves that came from outside: an array of short strings, not too long. */
function isMoveList(value) {
	return Array.isArray(value) && value.length <= 1e3 && value.every((m) => typeof m === "string" && m.length <= 64);
}
//#endregion
//#region shared/space/board.ts
const STAR_KINDS = [
	"red-dwarf",
	"yellow-star",
	"blue-giant",
	"white-dwarf",
	"binary-star",
	"neutron-star",
	"pulsar",
	"supernova",
	"matariki"
];
function isLink(square) {
	return square?.kind === "wormhole" || square?.kind === "black-hole";
}
/** The squares the comet's tail covers (not its head). */
function cometTail(comet) {
	const tail = [];
	for (let i = 1; i < comet.length; i++) tail.push(comet.head - i);
	return tail;
}
/** Where the comet's head goes next round: forward, wrapping round to the start. */
function moveComet(comet, size) {
	const lowest = comet.length + 1;
	const highest = size - 1;
	let head = comet.head + comet.speed;
	if (head > highest) head = lowest + (head - highest - 1);
	return {
		...comet,
		head
	};
}
/** Wormhole distance up divided by black hole distance down must be in this range. */
const BALANCE_RANGE = [.75, 1.35];
/** Every problem with a board, in plain words. An empty list means it's fair. */
function checkBoard(board, options = {}) {
	const problems = [];
	const { size } = board;
	if (size !== 100 && size !== 50) problems.push(`size ${size} isn't 100 or 50`);
	const entries = Object.entries(board.squares).map(([key, square]) => [Number(key), square]);
	const mouths = new Set(entries.filter(([, s]) => isLink(s)).map(([n]) => n));
	let up = 0;
	let down = 0;
	let mysteries = 0;
	for (const [n, square] of entries) {
		if (!Number.isInteger(n) || n < 2 || n > size - 1) {
			problems.push(`square ${n} can't be special (only 2 to ${size - 1})`);
			continue;
		}
		if (square.kind === "wormhole") {
			if (!(square.to > n && square.to <= size - 1)) problems.push(`wormhole ${n} goes to ${square.to}`);
			if (mouths.has(square.to)) problems.push(`wormhole ${n} lands on another hole at ${square.to}`);
			up += square.to - n;
		} else if (square.kind === "black-hole") {
			if (n <= 5) problems.push(`black hole on square ${n} (none on 1 to 5)`);
			if (!(square.to >= 2 && square.to < n)) problems.push(`black hole ${n} goes to ${square.to}`);
			if (mouths.has(square.to)) problems.push(`black hole ${n} lands on another hole at ${square.to}`);
			down += n - square.to;
		} else if (square.kind === "gate") {
			const twin = board.squares[square.twin];
			if (twin?.kind !== "gate" || twin.twin !== n || square.twin === n) problems.push(`gate ${n} has no twin`);
			if (Math.abs(square.twin - n) > size / 4) problems.push(`gates ${n} and ${square.twin} are too far apart`);
		} else if (square.kind === "mystery") mysteries++;
	}
	if (mysteries > 1) problems.push(`${mysteries} mystery stations (at most 1)`);
	const special = entries.map(([n]) => n).sort((a, b) => a - b);
	for (let i = 1; i < special.length; i++) if (special[i] - special[i - 1] < 2) problems.push(`squares ${special[i - 1]} and ${special[i]} are side by side`);
	if (board.comet) {
		const { head, length, speed } = board.comet;
		if (!(length >= 3 && length <= 8 && speed >= 1 && speed <= 6)) problems.push("the comet is the wrong size or speed");
		if (!(head - length + 1 >= 2 && head <= size - 1)) problems.push(`the comet at ${head} is off the board`);
	}
	if (!(board.missionRounds >= 10 && board.missionRounds <= 200)) problems.push(`mission clock ${board.missionRounds} rounds`);
	if (options.balanced) {
		const ratio = down === 0 ? Infinity : up / down;
		if (ratio < BALANCE_RANGE[0] || ratio > BALANCE_RANGE[1]) problems.push(`wormholes go up ${up} and black holes down ${down}: not balanced`);
	}
	return problems;
}
/**
* The average number of rolls one rocket needs to dock, counting only wormholes and black
* holes (any roll finishes). Worked out exactly, not by playing, so it's quick enough to
* check every Random Galaxy as it's made.
*/
function expectedRolls(board) {
	const { size } = board;
	const follow = (n) => {
		const square = board.squares[n];
		return isLink(square) ? square.to : n;
	};
	const expected = new Array(size + 1).fill(0);
	for (let pass = 0; pass < 500; pass++) {
		let change = 0;
		for (let n = size - 1; n >= 1; n--) {
			let total = 0;
			for (let die = 1; die <= 6; die++) total += expected[follow(Math.min(size, n + die))];
			const value = 1 + total / 6;
			change = Math.max(change, Math.abs(value - expected[n]));
			expected[n] = value;
		}
		if (change < 1e-6) break;
	}
	return expected[1];
}
//#endregion
//#region shared/space/random.ts
/** Turns any text into four 32-bit numbers (cyrb128), to seed the generator below. */
function hashSeed(text) {
	let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
	for (let i = 0; i < text.length; i++) {
		const k = text.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ h1 >>> 18, 597399067);
	h2 = Math.imul(h4 ^ h2 >>> 22, 2869860233);
	h3 = Math.imul(h1 ^ h3 >>> 17, 951274213);
	h4 = Math.imul(h2 ^ h4 >>> 19, 2716044179);
	h1 ^= h2 ^ h3 ^ h4;
	h2 ^= h1;
	h3 ^= h1;
	h4 ^= h1;
	return [
		h1 >>> 0,
		h2 >>> 0,
		h3 >>> 0,
		h4 >>> 0
	];
}
/** A repeatable random number generator (sfc32): the same seed always gives the same numbers. */
function randomFromSeed(seed) {
	let [a, b, c, d] = hashSeed(seed);
	return () => {
		a |= 0;
		b |= 0;
		c |= 0;
		d |= 0;
		const t = (a + b | 0) + d | 0;
		d = d + 1 | 0;
		a = b ^ b >>> 9;
		b = c + (c << 3) | 0;
		c = c << 21 | c >>> 11;
		c = c + t | 0;
		return (t >>> 0) / 4294967296;
	};
}
/** Dice from a 0–1 random number source. */
function diceFrom(random) {
	return (sides) => 1 + Math.floor(random() * sides);
}
/** Dice from a seed, for bot games and simulations. */
function seededDice(seed) {
	return diceFrom(randomFromSeed(seed));
}
/** Picks one entry, with each entry's chance in proportion to its weight. */
function pickWeighted(dice, entries) {
	let n = dice(entries.reduce((sum, [, weight]) => sum + weight, 0));
	for (const [value, weight] of entries) {
		n -= weight;
		if (n <= 0) return value;
	}
	return entries[entries.length - 1][0];
}
/** A shuffled copy (Fisher–Yates), using the dice. */
function shuffled(dice, list) {
	const copy = [...list];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = dice(i + 1) - 1;
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}
//#endregion
//#region shared/space/galaxy.ts
/**
* Random Galaxy: boards made by a generator that follows the fairness rules, named by easy
* "galaxy codes" like Comet-Kiwi-48 so a whole class can type one in and play the same board.
*/
const SPACE_WORDS = [
	"Comet",
	"Rocket",
	"Nova",
	"Orbit",
	"Lunar",
	"Solar",
	"Star",
	"Astro",
	"Nebula",
	"Quasar",
	"Meteor",
	"Galaxy",
	"Cosmo",
	"Pulsar",
	"Rover",
	"Saturn",
	"Jupiter",
	"Mars",
	"Venus",
	"Pluto",
	"Aurora",
	"Eclipse",
	"Zenith",
	"Photon",
	"Vega",
	"Sirius",
	"Titan",
	"Apollo",
	"Gemini",
	"Orion",
	"Halley",
	"Kepler"
];
const FRIENDLY_WORDS = [
	"Kiwi",
	"Kea",
	"Weka",
	"Ruru",
	"Moa",
	"Kauri",
	"Rimu",
	"Tuatara",
	"Fantail",
	"Fern",
	"Penguin",
	"Gecko",
	"Dolphin",
	"Orca",
	"Whale",
	"Seal",
	"Gannet",
	"Albatross",
	"Pipi",
	"Kelp",
	"Pavlova",
	"Jandal",
	"Glacier",
	"Volcano",
	"Harbour",
	"Otter",
	"Falcon",
	"Robin",
	"Panda",
	"Tiger",
	"Koala",
	"Puffin"
];
SPACE_WORDS.length * FRIENDLY_WORDS.length * 90;
/**
* Tidies what a student typed into a galaxy code, or null if it isn't one.
* Forgives capitals, spaces instead of dashes and extra spaces: "comet kiwi 48" works.
*/
function parseGalaxyCode(text) {
	const parts = text.trim().split(/[\s\-_.]+/).filter(Boolean);
	if (parts.length !== 3) return null;
	const find = (words, word) => words.find((w) => w.toLowerCase() === word.toLowerCase());
	const space = find(SPACE_WORDS, parts[0]);
	const friendly = find(FRIENDLY_WORDS, parts[1]);
	const number = /^\d{2}$/.test(parts[2]) ? Number(parts[2]) : NaN;
	if (!space || !friendly || !(number >= 10 && number <= 99)) return null;
	return `${space}-${friendly}-${number}`;
}
const ALL_STARS = [
	["red-dwarf", 4],
	["yellow-star", 3],
	["blue-giant", 1],
	["white-dwarf", 2],
	["binary-star", 2],
	["neutron-star", 2],
	["pulsar", 1],
	["supernova", 1],
	["matariki", 1]
];
const RANDOM_GALAXY = {
	100: {
		size: 100,
		wormholes: 8,
		blackHoles: 8,
		wormholeLength: [8, 30],
		blackHoleLength: [8, 30],
		stars: 10,
		starWeights: ALL_STARS,
		onlyOne: [
			"supernova",
			"matariki",
			"pulsar"
		],
		gravity: [
			"heavy",
			"low",
			"slingshot",
			"heavy"
		],
		gatePairs: 1,
		mystery: true,
		comet: true,
		missionRounds: 45,
		cosmicEvents: false,
		balanced: true,
		rolls: [26, 38]
	},
	50: {
		size: 50,
		wormholes: 4,
		blackHoles: 4,
		wormholeLength: [5, 15],
		blackHoleLength: [5, 15],
		stars: 5,
		starWeights: ALL_STARS,
		onlyOne: [
			"supernova",
			"matariki",
			"pulsar"
		],
		gravity: ["heavy", "low"],
		gatePairs: 1,
		mystery: true,
		comet: false,
		missionRounds: 30,
		cosmicEvents: false,
		balanced: true,
		rolls: [13, 18]
	}
};
const between = (dice, low, high) => low + dice(high - low + 1) - 1;
/** How far apart a pair of gates is, nearest and furthest. */
const GATE_GAP = {
	100: [8, 20],
	50: [5, 12]
};
/** One attempt at a board. Returns null if it ran out of room. */
function tryBoard(dice, recipe, id, name) {
	const { size } = recipe;
	const squares = {};
	const landings = new Set();
	const taken = (n) => squares[n] !== void 0;
	const free = (n) => n >= 2 && n <= size - 1 && !taken(n) && !taken(n - 1) && !taken(n + 1) && !landings.has(n);
	const placeSpecial = (low, high) => {
		for (let attempt = 0; attempt < 60; attempt++) {
			const n = between(dice, Math.max(2, low), Math.min(size - 1, high));
			if (free(n)) return n;
		}
		return null;
	};
	const placeLink = (kind, [shortest, longest]) => {
		for (let attempt = 0; attempt < 80; attempt++) {
			const length = between(dice, shortest, longest);
			const from = kind === "wormhole" ? between(dice, 2, size - 1 - length) : between(dice, Math.max(6, 2 + length), size - 1);
			const to = kind === "wormhole" ? from + length : from - length;
			if (!free(from) || taken(to) || to === from) continue;
			squares[from] = {
				kind,
				to
			};
			landings.add(to);
			return true;
		}
		return false;
	};
	for (let i = 0; i < recipe.wormholes; i++) if (!placeLink("wormhole", recipe.wormholeLength)) return null;
	for (let i = 0; i < recipe.blackHoles; i++) if (!placeLink("black-hole", recipe.blackHoleLength)) return null;
	const [nearest, furthest] = GATE_GAP[size];
	for (let i = 0; i < recipe.gatePairs; i++) {
		let placed = false;
		for (let attempt = 0; attempt < 60 && !placed; attempt++) {
			const low = between(dice, 4, size - 4 - nearest);
			const high = low + between(dice, nearest, furthest);
			if (high > size - 4 || !free(low) || !free(high)) continue;
			squares[low] = {
				kind: "gate",
				twin: high
			};
			squares[high] = {
				kind: "gate",
				twin: low
			};
			placed = true;
		}
		if (!placed) return null;
	}
	if (recipe.mystery) {
		const n = placeSpecial(Math.floor(size * .2), Math.floor(size * .8));
		if (n === null) return null;
		squares[n] = { kind: "mystery" };
	}
	for (const gravity of recipe.gravity) {
		const n = placeSpecial(3, size - 3);
		if (n === null) return null;
		squares[n] = {
			kind: "gravity",
			gravity
		};
	}
	const placedStars = [];
	for (let i = 0; i < recipe.stars; i++) {
		const star = pickWeighted(dice, recipe.starWeights.filter(([star]) => !(recipe.onlyOne.includes(star) && placedStars.includes(star))));
		const n = placeSpecial(3, size - 2);
		if (n === null) return null;
		squares[n] = {
			kind: "star",
			star
		};
		placedStars.push(star);
	}
	return {
		id,
		name,
		size,
		squares,
		comet: recipe.comet ? {
			head: between(dice, 20, size - 20),
			length: 5,
			speed: 3
		} : null,
		missionRounds: recipe.missionRounds,
		cosmicEvents: recipe.cosmicEvents
	};
}
/** Makes a board from any text. The same text and recipe always make the same board. */
function generateBoard(seed, recipe, id, name) {
	for (let attempt = 0; attempt < 500; attempt++) {
		const board = tryBoard(seededDice(`${seed}#${attempt}`), recipe, id, name);
		if (!board || checkBoard(board, { balanced: recipe.balanced }).length > 0) continue;
		const rolls = expectedRolls(board);
		if (!recipe.rolls || rolls >= recipe.rolls[0] && rolls <= recipe.rolls[1]) return board;
	}
	throw new Error(`Couldn't make a fair board from "${seed}"`);
}
/** The Random Galaxy for a galaxy code. */
function galaxyBoard(code, size) {
	const tidy = parseGalaxyCode(code);
	if (!tidy) throw new Error(`"${code}" isn't a galaxy code`);
	return generateBoard(`galaxy:${tidy}:${size}`, RANDOM_GALAXY[size], `galaxy-${size}`, `Random Galaxy ${tidy}`);
}
//#endregion
//#region shared/space/boards.ts
const DESIGNED_BOARD_IDS = [
	"inner-solar-system",
	"nebula",
	"deep-space",
	"asteroid-belt"
];
const DESIGNED_BOARDS = {
	"inner-solar-system": {
		id: "inner-solar-system",
		name: "Inner Solar System",
		size: 100,
		missionRounds: 40,
		cosmicEvents: false,
		comet: null,
		squares: {
			3: {
				kind: "wormhole",
				to: 27
			},
			8: {
				kind: "star",
				star: "yellow-star"
			},
			12: {
				kind: "star",
				star: "red-dwarf"
			},
			18: {
				kind: "wormhole",
				to: 37
			},
			21: {
				kind: "wormhole",
				to: 41
			},
			23: {
				kind: "wormhole",
				to: 33
			},
			28: {
				kind: "black-hole",
				to: 20
			},
			31: {
				kind: "black-hole",
				to: 17
			},
			36: {
				kind: "black-hole",
				to: 25
			},
			40: {
				kind: "star",
				star: "red-dwarf"
			},
			44: {
				kind: "wormhole",
				to: 57
			},
			48: {
				kind: "gravity",
				gravity: "heavy"
			},
			50: {
				kind: "wormhole",
				to: 73
			},
			56: {
				kind: "star",
				star: "blue-giant"
			},
			59: {
				kind: "wormhole",
				to: 82
			},
			62: {
				kind: "black-hole",
				to: 52
			},
			64: {
				kind: "star",
				star: "binary-star"
			},
			66: {
				kind: "wormhole",
				to: 80
			},
			70: {
				kind: "star",
				star: "matariki"
			},
			72: {
				kind: "wormhole",
				to: 96
			},
			75: {
				kind: "star",
				star: "red-dwarf"
			},
			77: {
				kind: "star",
				star: "white-dwarf"
			},
			79: {
				kind: "star",
				star: "red-dwarf"
			},
			81: {
				kind: "gravity",
				gravity: "slingshot"
			},
			83: {
				kind: "gravity",
				gravity: "low"
			},
			91: {
				kind: "gravity",
				gravity: "low"
			},
			93: {
				kind: "star",
				star: "yellow-star"
			},
			95: {
				kind: "black-hole",
				to: 84
			},
			99: {
				kind: "black-hole",
				to: 89
			}
		}
	},
	nebula: {
		id: "nebula",
		name: "Nebula",
		size: 100,
		missionRounds: 40,
		cosmicEvents: false,
		comet: null,
		squares: {
			6: {
				kind: "gravity",
				gravity: "slingshot"
			},
			9: {
				kind: "star",
				star: "white-dwarf"
			},
			13: {
				kind: "gravity",
				gravity: "heavy"
			},
			20: {
				kind: "star",
				star: "red-dwarf"
			},
			23: {
				kind: "wormhole",
				to: 41
			},
			25: {
				kind: "star",
				star: "yellow-star"
			},
			30: {
				kind: "star",
				star: "blue-giant"
			},
			33: {
				kind: "star",
				star: "red-dwarf"
			},
			35: {
				kind: "black-hole",
				to: 15
			},
			37: {
				kind: "star",
				star: "neutron-star"
			},
			39: {
				kind: "black-hole",
				to: 10
			},
			42: {
				kind: "black-hole",
				to: 17
			},
			44: {
				kind: "wormhole",
				to: 69
			},
			47: {
				kind: "black-hole",
				to: 38
			},
			49: {
				kind: "wormhole",
				to: 63
			},
			51: {
				kind: "wormhole",
				to: 65
			},
			53: {
				kind: "gravity",
				gravity: "heavy"
			},
			57: {
				kind: "black-hole",
				to: 34
			},
			61: {
				kind: "black-hole",
				to: 48
			},
			64: {
				kind: "gate",
				twin: 82
			},
			66: {
				kind: "wormhole",
				to: 84
			},
			68: {
				kind: "wormhole",
				to: 96
			},
			70: {
				kind: "wormhole",
				to: 95
			},
			73: { kind: "mystery" },
			78: {
				kind: "wormhole",
				to: 93
			},
			80: {
				kind: "black-hole",
				to: 55
			},
			82: {
				kind: "gate",
				twin: 64
			},
			85: {
				kind: "star",
				star: "yellow-star"
			},
			87: {
				kind: "star",
				star: "matariki"
			},
			89: {
				kind: "black-hole",
				to: 63
			},
			91: {
				kind: "gravity",
				gravity: "low"
			},
			94: {
				kind: "star",
				star: "binary-star"
			},
			97: {
				kind: "star",
				star: "white-dwarf"
			}
		}
	},
	"deep-space": {
		id: "deep-space",
		name: "Deep Space",
		size: 100,
		missionRounds: 45,
		cosmicEvents: true,
		comet: {
			head: 33,
			length: 5,
			speed: 3
		},
		squares: {
			4: {
				kind: "wormhole",
				to: 32
			},
			6: {
				kind: "wormhole",
				to: 24
			},
			9: {
				kind: "wormhole",
				to: 30
			},
			11: {
				kind: "star",
				star: "neutron-star"
			},
			13: {
				kind: "star",
				star: "binary-star"
			},
			16: {
				kind: "wormhole",
				to: 32
			},
			18: {
				kind: "wormhole",
				to: 53
			},
			21: {
				kind: "black-hole",
				to: 7
			},
			25: {
				kind: "star",
				star: "red-dwarf"
			},
			29: {
				kind: "black-hole",
				to: 17
			},
			31: {
				kind: "star",
				star: "red-dwarf"
			},
			33: {
				kind: "wormhole",
				to: 69
			},
			37: {
				kind: "black-hole",
				to: 10
			},
			44: {
				kind: "wormhole",
				to: 68
			},
			48: {
				kind: "wormhole",
				to: 75
			},
			51: {
				kind: "black-hole",
				to: 26
			},
			57: {
				kind: "star",
				star: "matariki"
			},
			59: { kind: "mystery" },
			62: {
				kind: "star",
				star: "blue-giant"
			},
			64: {
				kind: "star",
				star: "pulsar"
			},
			66: {
				kind: "gravity",
				gravity: "low"
			},
			70: {
				kind: "star",
				star: "yellow-star"
			},
			72: {
				kind: "black-hole",
				to: 43
			},
			74: {
				kind: "gravity",
				gravity: "slingshot"
			},
			78: {
				kind: "black-hole",
				to: 58
			},
			80: {
				kind: "star",
				star: "white-dwarf"
			},
			82: {
				kind: "gravity",
				gravity: "heavy"
			},
			85: {
				kind: "gravity",
				gravity: "heavy"
			},
			87: {
				kind: "gate",
				twin: 95
			},
			90: {
				kind: "black-hole",
				to: 61
			},
			93: {
				kind: "star",
				star: "supernova"
			},
			95: {
				kind: "gate",
				twin: 87
			},
			99: {
				kind: "black-hole",
				to: 84
			}
		}
	},
	"asteroid-belt": {
		id: "asteroid-belt",
		name: "Asteroid Belt",
		size: 50,
		missionRounds: 25,
		cosmicEvents: false,
		comet: null,
		squares: {
			5: {
				kind: "gravity",
				gravity: "heavy"
			},
			7: {
				kind: "wormhole",
				to: 14
			},
			9: {
				kind: "star",
				star: "white-dwarf"
			},
			12: {
				kind: "gravity",
				gravity: "low"
			},
			15: {
				kind: "wormhole",
				to: 23
			},
			18: {
				kind: "black-hole",
				to: 10
			},
			21: {
				kind: "black-hole",
				to: 11
			},
			24: {
				kind: "star",
				star: "yellow-star"
			},
			27: {
				kind: "black-hole",
				to: 19
			},
			30: {
				kind: "wormhole",
				to: 40
			},
			33: {
				kind: "gate",
				twin: 45
			},
			35: {
				kind: "wormhole",
				to: 46
			},
			37: {
				kind: "star",
				star: "binary-star"
			},
			39: {
				kind: "star",
				star: "yellow-star"
			},
			42: {
				kind: "star",
				star: "red-dwarf"
			},
			45: {
				kind: "gate",
				twin: 33
			},
			48: {
				kind: "black-hole",
				to: 38
			}
		}
	}
};
function isDesignedBoardId(value) {
	return DESIGNED_BOARD_IDS.includes(value);
}
function boardFor(choice) {
	if ("id" in choice) {
		if (!isDesignedBoardId(choice.id)) throw new Error(`No board called "${choice.id}"`);
		return DESIGNED_BOARDS[choice.id];
	}
	return galaxyBoard(choice.galaxy, choice.size);
}
//#endregion
//#region shared/space/items.ts
const ITEM_KINDS = [
	"booster",
	"hyperdrive",
	"navigator",
	"force-field",
	"escape-pod",
	"repair-kit",
	"warp-key",
	"rescue-beacon",
	"tractor-beam",
	"gravity-anchor",
	"space-mine",
	"quantum-swap"
];
const ITEMS = {
	booster: {
		name: "Booster",
		kind: "help",
		automatic: false,
		targeted: false,
		rare: false
	},
	hyperdrive: {
		name: "Hyperdrive",
		kind: "help",
		automatic: false,
		targeted: false,
		rare: true
	},
	navigator: {
		name: "Navigator",
		kind: "help",
		automatic: false,
		targeted: false,
		rare: true
	},
	"force-field": {
		name: "Force Field",
		kind: "help",
		automatic: true,
		targeted: false,
		rare: false
	},
	"escape-pod": {
		name: "Escape Pod",
		kind: "help",
		automatic: true,
		targeted: false,
		rare: false
	},
	"repair-kit": {
		name: "Repair Kit",
		kind: "help",
		automatic: false,
		targeted: false,
		rare: false
	},
	"warp-key": {
		name: "Warp Key",
		kind: "help",
		automatic: false,
		targeted: false,
		rare: false
	},
	"rescue-beacon": {
		name: "Rescue Beacon",
		kind: "help",
		automatic: false,
		targeted: false,
		rare: false
	},
	"tractor-beam": {
		name: "Tractor Beam",
		kind: "hinder",
		automatic: false,
		targeted: true,
		rare: false
	},
	"gravity-anchor": {
		name: "Gravity Anchor",
		kind: "hinder",
		automatic: false,
		targeted: true,
		rare: false
	},
	"space-mine": {
		name: "Space Mine",
		kind: "hinder",
		automatic: false,
		targeted: false,
		rare: false
	},
	"quantum-swap": {
		name: "Quantum Swap",
		kind: "hinder",
		automatic: false,
		targeted: true,
		rare: true
	}
};
/**
* Which items each tier can give, and how often (bigger number = more often).
* The Rescue Beacon never comes from a star: it's only given to a rocket far behind.
*/
const ITEM_TIERS = {
	common: [
		["booster", 3],
		["force-field", 2],
		["escape-pod", 2],
		["repair-kit", 1],
		["space-mine", 2],
		["tractor-beam", 2]
	],
	random: [
		["booster", 3],
		["force-field", 2],
		["escape-pod", 2],
		["repair-kit", 1],
		["space-mine", 2],
		["tractor-beam", 2],
		["gravity-anchor", 2],
		["warp-key", 1],
		["hyperdrive", 1],
		["navigator", 1],
		["quantum-swap", 1]
	],
	rare: [
		["hyperdrive", 1],
		["navigator", 1],
		["quantum-swap", 1],
		["warp-key", 1]
	]
};
/** Catch-up help: the rocket in last place gets one tier better. */
function betterTier(tier) {
	return tier === "common" ? "random" : "rare";
}
function isItemKind(value) {
	return ITEM_KINDS.includes(value);
}
/** Never reached (a test checks): stops a bug from looping for ever. */
const SAFETY_STOP = 25;
/** Where the mystery station can send you, and how likely each is. */
const MYSTERY_OFFSETS = [
	[3, 2],
	[5, 2],
	[8, 2],
	[12, 1],
	[-3, 2],
	[-6, 1]
];
/** A move the rules don't allow. The message is fine to show a student. */
var SpaceRuleError = class extends Error {};
const newTurnInfo = () => ({
	itemUsed: false,
	rolled: false,
	booster: false,
	hyperdrive: false,
	navigator: null,
	effects: 0,
	rolledSix: false,
	rollAgainUsed: false
});
/** Classic mode keeps only the wormholes and black holes. */
function classicBoard(board) {
	const squares = {};
	for (const [n, square] of Object.entries(board.squares)) if (isLink(square)) squares[Number(n)] = square;
	return {
		...board,
		squares,
		comet: null
	};
}
/** A new game, everyone on square 1, the first seat to play. */
function newGame$1(board, settings, players) {
	if (!Number.isInteger(players) || players < 2 || players > 4) throw new SpaceRuleError(`A game needs 2 to 4 rockets.`);
	const playBoard = settings.mode === "classic" ? classicBoard(board) : structuredClone(board);
	return {
		state: {
			board: playBoard,
			settings: {
				...settings,
				cosmicEvents: settings.mode === "cosmic" && settings.cosmicEvents
			},
			rockets: Array.from({ length: players }, () => ({
				position: 1,
				items: [],
				gravity: null,
				anchored: false,
				solarWind: false,
				binary: false,
				shielded: false,
				lastTarget: null,
				beaconRound: null
			})),
			turn: 0,
			round: 1,
			turnsTaken: 0,
			phase: "ready",
			pending: null,
			turnInfo: newTurnInfo(),
			comet: playBoard.comet ? { ...playBoard.comet } : null,
			mines: [],
			asteroids: [],
			places: null,
			ending: null
		},
		events: [{
			kind: "round-start",
			round: 1
		}, {
			kind: "turn-start",
			seat: 0,
			round: 1
		}]
	};
}
function play$1(previous, action, dice) {
	const s = structuredClone(previous);
	const events = [];
	new Game(s, dice, events).act(action);
	return {
		state: s,
		events
	};
}
/**
* How many rounds before the fuel runs out. The board's number is for 4 rockets; fewer
* rockets have quicker rounds, so they get a few more.
*/
function missionRounds(s) {
	return s.board.missionRounds + (4 - s.rockets.length) * 5;
}
/** The lowest square any rocket is on. */
const lastPosition = (s) => Math.min(...s.rockets.map((r) => r.position));
const leaderPosition = (s) => Math.max(...s.rockets.map((r) => r.position));
/** True if this rocket is in last place (tied counts). */
function isLast(s, seat) {
	return s.rockets[seat].position === lastPosition(s);
}
/** The rockets this one could aim this item at right now. */
function validTargets(s, item, seat = s.turn) {
	if (!ITEMS[item].targeted) return [];
	const me = s.rockets[seat];
	const last = lastPosition(s);
	const targets = [];
	s.rockets.forEach((other, i) => {
		if (i === seat || other.shielded || i === me.lastTarget) return;
		if (other.position === last) return;
		if (item === "tractor-beam" && other.position <= 1) return;
		if (item === "quantum-swap") {
			const ahead = other.position - me.position;
			if (ahead <= 0 || ahead > 15) return;
			if (other.position >= s.board.size - 10) return;
		}
		targets.push(i);
	});
	return targets;
}
/** The nearest wormhole mouth ahead of a square, or null. */
function nextWormhole(s, from) {
	for (let n = from + 1; n < s.board.size; n++) if (s.board.squares[n]?.kind === "wormhole") return n;
	return null;
}
/** Why an item can't be used right now, or null if it can. */
function itemProblem(s, item, seat = s.turn) {
	const r = s.rockets[seat];
	if (s.phase !== "ready" || seat !== s.turn) return "It isn't your turn.";
	if (!r.items.includes(item)) return "You don't have that item.";
	if (s.turnInfo.itemUsed) return "You can only use one item a turn.";
	if (s.turnInfo.rolled) return "Use items before you roll.";
	if (ITEMS[item].automatic) return "That one works by itself.";
	if (item === "repair-kit" && !r.gravity && !r.anchored) return "Nothing to repair.";
	if (item === "warp-key" && nextWormhole(s, r.position) === null) return "No wormholes ahead.";
	if (item === "space-mine") {
		if (s.mines.some((m) => m.owner === seat)) return "You already have a mine out there.";
		if (r.position <= 1) return "You can't leave a mine on Earth.";
		if (s.mines.some((m) => m.square === r.position)) return "There's already a mine here.";
	}
	if (ITEMS[item].targeted && validTargets(s, item, seat).length === 0) return "No rockets you can aim at.";
	return null;
}
/** The items this rocket could use right now. */
function usableItems(s, seat = s.turn) {
	return [...new Set(s.rockets[seat].items)].filter((item) => itemProblem(s, item, seat) === null);
}
/**
* How far a die roll moves this rocket, and what changed it.
* Order: Navigator picks the die; doubles (Hyperdrive, slingshot); halves rounded up
* (heavy gravity, Gravity Anchor); then pluses (Booster, low gravity, solar wind). Never 0.
*/
function stepsFor(r, t, die) {
	let steps = die;
	const changes = [];
	if (t.hyperdrive) {
		steps *= 2;
		changes.push("hyperdrive");
	}
	if (r.gravity?.kind === "slingshot") {
		steps *= 2;
		changes.push("slingshot");
	}
	if (r.gravity?.kind === "heavy") {
		steps = Math.ceil(steps / 2);
		changes.push("heavy-gravity");
	}
	if (r.anchored) {
		steps = Math.ceil(steps / 2);
		changes.push("gravity-anchor");
	}
	if (t.booster) {
		steps += 2;
		changes.push("booster");
	}
	if (r.gravity?.kind === "low") {
		steps += 2;
		changes.push("low-gravity");
	}
	if (r.solarWind) {
		steps += 1;
		changes.push("solar-wind");
	}
	return {
		steps: Math.max(1, steps),
		changes
	};
}
/** Where moving this many squares forward from a square ends, before any square acts. */
function moveTarget(s, from, steps) {
	const size = s.board.size;
	const to = from + steps;
	if (to <= size) return {
		to,
		bounced: false
	};
	if (s.settings.finish === "any") return {
		to: size,
		bounced: false
	};
	return {
		to: Math.max(1, size - (to - size)),
		bounced: true
	};
}
/** Everyone's place by how far they got (a docked rocket is always 1st). Ties share. */
function placesFor(s) {
	return s.rockets.map((r) => 1 + s.rockets.filter((o) => o.position > r.position).length);
}
/** True if landing here would make something happen (used for the chain cap). */
function somethingAt(s, seat, n) {
	if (n >= s.board.size) return false;
	if (s.mines.some((m) => m.square === n && m.owner !== seat)) return true;
	if (s.asteroids.includes(n)) return true;
	if (s.comet && cometTail(s.comet).includes(n)) return true;
	const square = s.board.squares[n];
	return square !== void 0 && square.kind !== "nebula";
}
var Game = class {
	s;
	dice;
	events;
	constructor(s, dice, events) {
		this.s = s;
		this.dice = dice;
		this.events = events;
	}
	get seat() {
		return this.s.turn;
	}
	get me() {
		return this.s.rockets[this.s.turn];
	}
	emit(event) {
		this.events.push(event);
	}
	act(action) {
		const s = this.s;
		if (s.phase === "over") throw new SpaceRuleError("This game is over.");
		switch (action.kind) {
			case "use-item": return this.useItem(action.item, action.target, action.value);
			case "roll":
				if (s.phase !== "ready") throw new SpaceRuleError("Make your choice first.");
				return this.roll();
			case "choose":
				if (s.phase !== "choice" || !s.pending) throw new SpaceRuleError("There's nothing to choose.");
				return this.choose(action.option);
			case "timeout":
				this.emit({
					kind: "timeout",
					seat: this.seat
				});
				if (s.phase === "choice" && s.pending) return this.choose(defaultOption(s.pending));
				return this.roll();
			default: throw new SpaceRuleError("That isn't something you can do.");
		}
	}
	useItem(item, target, value) {
		const problem = ITEMS[item] ? itemProblem(this.s, item) : "That isn't an item.";
		if (problem) throw new SpaceRuleError(problem);
		const s = this.s;
		const me = this.me;
		if (ITEMS[item].targeted) {
			if (target === void 0 || !validTargets(s, item).includes(target)) throw new SpaceRuleError("You can't aim at that rocket.");
		}
		if (item === "navigator" && !(Number.isInteger(value) && value >= 1 && value <= 6)) throw new SpaceRuleError("Pick a number from 1 to 6.");
		me.items.splice(me.items.indexOf(item), 1);
		s.turnInfo.itemUsed = true;
		this.emit({
			kind: "item-used",
			seat: this.seat,
			item,
			...target !== void 0 && ITEMS[item].targeted ? { target } : {},
			...item === "navigator" ? { value } : {}
		});
		switch (item) {
			case "booster":
				s.turnInfo.booster = true;
				return;
			case "hyperdrive":
				s.turnInfo.hyperdrive = true;
				return;
			case "navigator":
				s.turnInfo.navigator = value;
				return;
			case "repair-kit":
				me.gravity = null;
				me.anchored = false;
				this.emit({
					kind: "repaired",
					seat: this.seat
				});
				return;
			case "space-mine":
				s.mines.push({
					square: me.position,
					owner: this.seat,
					round: s.round
				});
				this.emit({
					kind: "mine-placed",
					seat: this.seat,
					square: me.position
				});
				return;
			case "tractor-beam": {
				const other = s.rockets[target];
				const from = other.position;
				other.position = Math.max(1, from - 3);
				this.emit({
					kind: "pushed",
					seat: target,
					from,
					to: other.position,
					by: "tractor-beam",
					source: this.seat
				});
				this.hit(target);
				return;
			}
			case "gravity-anchor":
				s.rockets[target].anchored = true;
				this.emit({
					kind: "anchored",
					seat: target,
					source: this.seat
				});
				this.hit(target);
				return;
			case "quantum-swap": {
				const other = s.rockets[target];
				const [mine, theirs] = [me.position, other.position];
				me.position = theirs;
				other.position = mine;
				this.emit({
					kind: "swapped",
					seat: this.seat,
					target,
					from: mine,
					to: theirs
				});
				this.hit(target);
				return;
			}
			case "warp-key": {
				const mouth = nextWormhole(s, me.position);
				this.moveMe(mouth, "warp-key");
				return this.afterMove();
			}
			case "rescue-beacon":
				this.moveMe(Math.min(s.board.size, me.position + 10), "rescue-beacon");
				return this.afterMove();
			default: throw new SpaceRuleError("That works by itself.");
		}
	}
	/** A hinder hit this rocket: it's shielded until its next turn. */
	hit(target) {
		this.s.rockets[target].shielded = true;
		this.me.lastTarget = target;
	}
	gainItem(seat, tier, from, item) {
		const got = item ?? pickWeighted(this.dice, ITEM_TIERS[tier]);
		const r = this.s.rockets[seat];
		if (r.items.length < 3) {
			r.items.push(got);
			this.emit({
				kind: "item-gained",
				seat,
				item: got,
				from
			});
		} else if (seat === this.seat && from !== "rescue") this.ask({
			kind: "inventory",
			item: got
		});
		else this.emit({
			kind: "pockets-full",
			seat,
			item: got
		});
	}
	roll() {
		const s = this.s;
		const me = this.me;
		if (me.binary && s.turnInfo.navigator === null) {
			me.binary = false;
			const two = [this.dice(6), this.dice(6)];
			this.emit({
				kind: "dice",
				seat: this.seat,
				dice: two
			});
			this.ask({
				kind: "binary",
				dice: two
			});
			return;
		}
		const die = s.turnInfo.navigator ?? this.dice(6);
		if (s.turnInfo.navigator === null) this.emit({
			kind: "dice",
			seat: this.seat,
			dice: [die]
		});
		this.rollWith(die, s.turnInfo.navigator === null);
	}
	rollWith(die, realDie) {
		const s = this.s;
		const me = this.me;
		const t = s.turnInfo;
		const { steps, changes } = stepsFor(me, t, die);
		this.emit({
			kind: "roll",
			seat: this.seat,
			die,
			steps,
			changes
		});
		t.booster = t.hyperdrive = false;
		t.navigator = null;
		me.anchored = false;
		me.solarWind = false;
		if (me.gravity && --me.gravity.rolls <= 0) me.gravity = null;
		t.rolled = true;
		t.rolledSix = realDie && die === 6;
		t.effects = 0;
		const { to, bounced } = moveTarget(s, me.position, steps);
		this.emit({
			kind: "move",
			seat: this.seat,
			from: me.position,
			to,
			cause: bounced ? "bounce" : "roll",
			...bounced ? { bounced } : {}
		});
		me.position = to;
		this.land();
		this.afterMove();
	}
	/** Moves the rocket whose turn it is (by an item or a square), then lets squares act. */
	moveMe(to, cause) {
		const me = this.me;
		this.s.turnInfo.effects = 0;
		this.emit({
			kind: "move",
			seat: this.seat,
			from: me.position,
			to,
			cause
		});
		me.position = to;
		this.land();
	}
	/** Lets the square the rocket landed on act, and the next, up to CHAIN_CAP. */
	land() {
		const s = this.s;
		const me = this.me;
		const seat = this.seat;
		for (let guard = 0;; guard++) {
			if (guard > SAFETY_STOP) throw new Error("Wormholes & Black Holes: safety stop reached");
			const n = me.position;
			if (n >= s.board.size) {
				this.emit({
					kind: "docked",
					seat
				});
				this.endGame("docked");
				return;
			}
			if (!somethingAt(s, seat, n)) return;
			if (s.turnInfo.effects >= 3) {
				this.emit({
					kind: "chain-cap",
					seat,
					square: n
				});
				return;
			}
			s.turnInfo.effects++;
			const mine = s.mines.find((m) => m.square === n && m.owner !== seat);
			if (mine) {
				s.mines.splice(s.mines.indexOf(mine), 1);
				me.position = Math.max(1, n - 3);
				this.emit({
					kind: "pushed",
					seat,
					from: n,
					to: me.position,
					by: "space-mine",
					source: mine.owner
				});
				continue;
			}
			if (s.asteroids.includes(n)) {
				this.emit({
					kind: "asteroid",
					seat,
					square: n
				});
				if (me.items.length > 0) {
					this.emit({
						kind: "item-lost",
						seat,
						item: me.items.pop()
					});
					return;
				}
				me.position = Math.max(1, n - 1);
				this.emit({
					kind: "move",
					seat,
					from: n,
					to: me.position,
					cause: "bounce"
				});
				continue;
			}
			if (s.comet && cometTail(s.comet).includes(n)) {
				me.position = s.comet.head;
				this.emit({
					kind: "comet",
					seat,
					from: n,
					to: me.position
				});
				continue;
			}
			const square = s.board.squares[n];
			switch (square.kind) {
				case "wormhole":
					if (s.settings.maths) return this.ask({
						kind: "question",
						square: n
					});
					me.position = square.to;
					this.emit({
						kind: "wormhole",
						seat,
						from: n,
						to: square.to
					});
					continue;
				case "black-hole": {
					const ff = me.items.indexOf("force-field");
					if (ff >= 0) {
						me.items.splice(ff, 1);
						this.emit({
							kind: "force-field",
							seat,
							square: n
						});
						return;
					}
					const pod = me.items.indexOf("escape-pod");
					if (pod >= 0) {
						me.items.splice(pod, 1);
						me.position = n - Math.max(1, Math.floor((n - square.to) / 2));
						this.emit({
							kind: "black-hole",
							seat,
							from: n,
							to: me.position,
							escapePod: true
						});
					} else {
						me.position = square.to;
						this.emit({
							kind: "black-hole",
							seat,
							from: n,
							to: square.to
						});
					}
					continue;
				}
				case "star":
					this.emit({
						kind: "star",
						seat,
						square: n,
						star: square.star
					});
					if (this.star(square.star, n)) continue;
					return;
				case "gravity":
					me.gravity = {
						kind: square.gravity,
						rolls: square.gravity === "slingshot" ? 1 : 2
					};
					this.emit({
						kind: "gravity",
						seat,
						gravity: square.gravity,
						source: "square"
					});
					return;
				case "gate": return this.ask({
					kind: "gate",
					square: n,
					twin: square.twin
				});
				case "mystery": return this.ask({
					kind: "mystery",
					square: n
				});
				case "nebula": return;
			}
		}
	}
	/** A star square acts. Returns true if it moved the rocket (so the new square acts too). */
	star(star, n) {
		const s = this.s;
		const me = this.me;
		const seat = this.seat;
		const tier = (base) => isLast(s, seat) ? betterTier(base) : base;
		switch (star) {
			case "red-dwarf":
				this.gainItem(seat, tier("common"), "star");
				return false;
			case "yellow-star":
				this.gainItem(seat, tier("random"), "star");
				return false;
			case "blue-giant":
				this.gainItem(seat, "rare", "star");
				return false;
			case "white-dwarf":
				this.gainItem(seat, "common", "star", "force-field");
				return false;
			case "binary-star":
				me.binary = true;
				this.emit({
					kind: "binary-ready",
					seat
				});
				return false;
			case "neutron-star":
				me.gravity = {
					kind: "heavy",
					rolls: 2
				};
				this.emit({
					kind: "gravity",
					seat,
					gravity: "heavy",
					source: "neutron-star"
				});
				return false;
			case "pulsar":
				this.pushNear(n, 5, 2, "pulsar");
				return false;
			case "supernova":
				this.pushNear(n, 10, 2, "supernova");
				s.board.squares[n] = { kind: "nebula" };
				this.emit({
					kind: "supernova-spent",
					square: n
				});
				me.position = Math.min(s.board.size, n + 5);
				this.emit({
					kind: "move",
					seat,
					from: n,
					to: me.position,
					cause: "supernova"
				});
				return true;
			case "matariki":
				for (let i = 1; i < s.rockets.length; i++) this.gainItem((seat + i) % s.rockets.length, "common", "matariki");
				this.gainItem(seat, "common", "matariki");
				return false;
		}
	}
	/** Every other rocket within `range` squares (either way) goes back. */
	pushNear(n, range, push, by) {
		this.s.rockets.forEach((r, i) => {
			if (i === this.seat || Math.abs(r.position - n) > range || r.position <= 1) return;
			const from = r.position;
			r.position = Math.max(1, from - push);
			this.emit({
				kind: "pushed",
				seat: i,
				from,
				to: r.position,
				by,
				source: this.seat
			});
		});
	}
	ask(pending) {
		this.s.phase = "choice";
		this.s.pending = pending;
		this.emit({
			kind: "choice",
			seat: this.seat,
			pending
		});
	}
	choose(option) {
		const s = this.s;
		const me = this.me;
		const seat = this.seat;
		const pending = s.pending;
		if (!Number.isInteger(option) || !choiceOptions(pending).includes(option)) throw new SpaceRuleError("That isn't one of the choices.");
		s.phase = "ready";
		s.pending = null;
		switch (pending.kind) {
			case "binary": return this.rollWith(pending.dice[option], true);
			case "gate":
				if (option === 1) {
					me.position = pending.twin;
					this.emit({
						kind: "gate",
						seat,
						from: pending.square,
						to: pending.twin
					});
				} else this.emit({
					kind: "gate-stay",
					seat,
					square: pending.square
				});
				return this.afterMove();
			case "mystery": {
				const offset = pickWeighted(this.dice, MYSTERY_OFFSETS);
				const to = Math.min(s.board.size - 1, Math.max(2, pending.square + offset));
				me.position = to;
				this.emit({
					kind: "mystery",
					seat,
					card: option,
					from: pending.square,
					to
				});
				this.land();
				return this.afterMove();
			}
			case "inventory":
				if (option === 3) this.emit({
					kind: "item-declined",
					seat,
					item: pending.item
				});
				else {
					const [dropped] = me.items.splice(option, 1, pending.item);
					this.emit({
						kind: "item-swapped",
						seat,
						dropped,
						item: pending.item
					});
				}
				return this.afterMove();
			case "question": {
				const square = s.board.squares[pending.square];
				const bonus = square.to + 3;
				const to = option === 1 && bonus < s.board.size && !isLink(s.board.squares[bonus]) ? bonus : square.to;
				me.position = to;
				this.emit({
					kind: "question",
					seat,
					correct: option === 1,
					from: pending.square,
					to
				});
				this.land();
				return this.afterMove();
			}
		}
	}
	/** After a move (or a choice) has finished: wait for a choice, carry on the turn, or end it. */
	afterMove() {
		const s = this.s;
		if (s.phase === "over" || s.phase === "choice") return;
		if (!s.turnInfo.rolled) return;
		const t = s.turnInfo;
		if (s.settings.rollAgainOnSix && t.rolledSix && !t.rollAgainUsed) {
			t.rollAgainUsed = true;
			t.rolled = false;
			t.rolledSix = false;
			this.emit({
				kind: "roll-again",
				seat: this.seat
			});
			return;
		}
		this.nextTurn();
	}
	nextTurn() {
		const s = this.s;
		s.turnsTaken++;
		s.turn = (s.turn + 1) % s.rockets.length;
		if (s.turn === 0) {
			this.newRound();
			if (s.phase === "over") return;
		}
		s.turnInfo = newTurnInfo();
		const me = this.me;
		me.shielded = false;
		this.emit({
			kind: "turn-start",
			seat: s.turn,
			round: s.round
		});
		if (s.settings.mode === "cosmic" && isLast(s, s.turn) && leaderPosition(s) - me.position >= 30 && (me.beaconRound === null || s.round - me.beaconRound >= 8) && me.items.length < 3 && !me.items.includes("rescue-beacon")) {
			me.beaconRound = s.round;
			this.gainItem(s.turn, "common", "rescue", "rescue-beacon");
		}
	}
	newRound() {
		const s = this.s;
		if (s.round >= missionRounds(s)) {
			this.endGame("mission-clock");
			return;
		}
		s.round++;
		s.asteroids = [];
		this.emit({
			kind: "round-start",
			round: s.round
		});
		const roundsLeft = missionRounds(s) - s.round + 1;
		if (roundsLeft === 5) this.emit({
			kind: "fuel-warning",
			roundsLeft
		});
		if (s.comet) {
			s.comet = moveComet(s.comet, s.board.size);
			this.emit({
				kind: "comet-moved",
				head: s.comet.head
			});
		}
		for (const mine of [...s.mines]) if (s.round - mine.round >= 5) {
			s.mines.splice(s.mines.indexOf(mine), 1);
			this.emit({
				kind: "mine-fizzled",
				owner: mine.owner,
				square: mine.square
			});
		}
		if (s.settings.cosmicEvents && (s.round - 1) % 5 === 0) this.cosmicEvent();
	}
	cosmicEvent() {
		const s = this.s;
		const event = pickWeighted(this.dice, [
			["solar-wind", 1],
			["meteor-shower", 1],
			["wormhole-shift", 1]
		]);
		if (event === "solar-wind") {
			for (const r of s.rockets) r.solarWind = true;
			this.emit({
				kind: "cosmic",
				event
			});
		} else if (event === "meteor-shower") {
			const empty = [];
			for (let n = 2; n < s.board.size; n++) if (!somethingAt(s, -1, n) && !s.rockets.some((r) => r.position === n)) empty.push(n);
			const squares = [];
			for (let i = 0; i < 5 && empty.length > 0; i++) squares.push(empty.splice(this.dice(empty.length) - 1, 1)[0]);
			s.asteroids = squares.sort((a, b) => a - b);
			this.emit({
				kind: "cosmic",
				event,
				squares: s.asteroids
			});
		} else {
			const wormholes = Object.entries(s.board.squares).filter(([, sq]) => sq.kind === "wormhole").map(([n]) => Number(n));
			if (wormholes.length === 0) return this.emit({
				kind: "cosmic",
				event
			});
			const wormhole = wormholes[this.dice(wormholes.length) - 1];
			const square = s.board.squares[wormhole];
			const options = [];
			for (let d = -5; d <= 5; d++) {
				const to = square.to + d;
				if (d !== 0 && to > wormhole + 1 && to < s.board.size && s.board.squares[to] === void 0) options.push(to);
			}
			if (options.length === 0) return this.emit({
				kind: "cosmic",
				event,
				wormhole,
				from: square.to,
				to: square.to
			});
			const to = options[this.dice(options.length) - 1];
			this.emit({
				kind: "cosmic",
				event,
				wormhole,
				from: square.to,
				to
			});
			square.to = to;
		}
	}
	endGame(ending) {
		const s = this.s;
		s.phase = "over";
		s.pending = null;
		s.ending = ending;
		s.places = placesFor(s);
		this.emit({
			kind: "game-over",
			ending,
			places: s.places
		});
	}
};
/** The options a choice has (see SpaceAction). */
function choiceOptions(pending) {
	switch (pending.kind) {
		case "gate": return [0, 1];
		case "mystery": return [
			0,
			1,
			2
		];
		case "inventory": return [
			0,
			1,
			2,
			3
		];
		case "binary": return [0, 1];
		case "question": return [0, 1];
	}
}
/** What happens when a choice times out: stay, card 1, keep your items, the higher die, "wrong". */
function defaultOption(pending) {
	switch (pending.kind) {
		case "gate": return 0;
		case "mystery": return 0;
		case "inventory": return 3;
		case "binary": return pending.dice[1] > pending.dice[0] ? 1 : 0;
		case "question": return 0;
	}
}
//#endregion
//#region shared/space/bot.ts
/** How much a bot likes holding each item (for "pockets full" choices). */
const ITEM_VALUE = {
	"rescue-beacon": 10,
	navigator: 9,
	hyperdrive: 8,
	"quantum-swap": 7,
	"warp-key": 6,
	"force-field": 6,
	booster: 4,
	"escape-pod": 4,
	"tractor-beam": 3,
	"gravity-anchor": 3,
	"space-mine": 2,
	"repair-kit": 2
};
/**
* Roughly how good it is to end up on a square after moving this many steps: just the
* wormhole, black hole, comet or mine there (not chains). Docking scores highest.
*/
function landingValue(s, seat, steps) {
	const r = s.rockets[seat];
	const { to } = moveTarget(s, r.position, steps);
	const size = s.board.size;
	if (to >= size) return size + 20;
	const square = s.board.squares[to];
	if (s.mines.some((m) => m.square === to && m.owner !== seat)) return to - 3;
	if (s.comet && cometTail(s.comet).includes(to)) return s.comet.head;
	if (square?.kind === "wormhole") return square.to;
	if (square?.kind === "black-hole") {
		if (r.items.includes("force-field")) return to - 1;
		if (r.items.includes("escape-pod")) return to - Math.max(1, Math.floor((to - square.to) / 2));
		return square.to;
	}
	if (square?.kind === "star") return to + 1.5;
	if (square?.kind === "gate" && square.twin > to) return square.twin;
	return to;
}
/** The average landing value over the six die faces, with these turn boosts. */
function averageLanding(s, seat, boosts) {
	const t = {
		...s.turnInfo,
		...boosts
	};
	let total = 0;
	for (let die = 1; die <= 6; die++) total += landingValue(s, seat, stepsFor(s.rockets[seat], t, die).steps);
	return total / 6;
}
function pick(random, list) {
	return list[Math.floor(random() * list.length)];
}
/** The target a bot aims a hinder at: Commander and Pilot pick whoever is furthest ahead. */
function bestTarget(s, item) {
	return validTargets(s, item).reduce((best, i) => s.rockets[i].position > s.rockets[best].position ? i : best);
}
function itemPlans(s, level) {
	const seat = s.turn;
	const me = s.rockets[seat];
	const size = s.board.size;
	const commander = level === "medium";
	const plain = averageLanding(s, seat, {});
	const plans = [];
	for (const item of usableItems(s)) switch (item) {
		case "rescue-beacon":
			plans.push({
				action: {
					kind: "use-item",
					item
				},
				worth: 10
			});
			break;
		case "repair-kit":
			plans.push({
				action: {
					kind: "use-item",
					item
				},
				worth: me.gravity?.kind === "heavy" || me.anchored ? 3 : 0
			});
			break;
		case "booster":
			plans.push({
				action: {
					kind: "use-item",
					item
				},
				worth: averageLanding(s, seat, { booster: true }) - plain
			});
			break;
		case "hyperdrive":
			plans.push({
				action: {
					kind: "use-item",
					item
				},
				worth: averageLanding(s, seat, { hyperdrive: true }) - plain
			});
			break;
		case "navigator": {
			let best = 1;
			let bestValue = -Infinity;
			for (let value = 1; value <= 6; value++) {
				const v = landingValue(s, seat, stepsFor(me, s.turnInfo, value).steps);
				if (v > bestValue) [best, bestValue] = [value, v];
			}
			const worth = commander && !(bestValue > size) && bestValue - plain < 12 ? 0 : bestValue - plain;
			plans.push({
				action: {
					kind: "use-item",
					item,
					value: best
				},
				worth
			});
			break;
		}
		case "warp-key": {
			const mouth = nextWormhole(s, me.position);
			const square = s.board.squares[mouth];
			plans.push({
				action: {
					kind: "use-item",
					item
				},
				worth: square.to - me.position - (commander ? 4 : 2)
			});
			break;
		}
		case "quantum-swap": {
			const target = bestTarget(s, item);
			const gain = s.rockets[target].position - me.position;
			plans.push({
				action: {
					kind: "use-item",
					item,
					target
				},
				worth: gain - (commander ? 5 : 3)
			});
			break;
		}
		case "tractor-beam":
		case "gravity-anchor": {
			const target = bestTarget(s, item);
			const ahead = s.rockets[target].position > me.position;
			const leader = s.rockets.every((r) => r.position <= s.rockets[target].position);
			const worth = !ahead ? 0 : item === "tractor-beam" ? 2 : 1.5;
			plans.push({
				action: {
					kind: "use-item",
					item,
					target
				},
				worth: commander && !leader ? 0 : worth
			});
			break;
		}
		case "space-mine": {
			const chasers = s.rockets.filter((r, i) => i !== seat && me.position - r.position >= 1 && me.position - r.position <= 6).length;
			plans.push({
				action: {
					kind: "use-item",
					item
				},
				worth: chasers > 0 ? 1.2 : 0
			});
			break;
		}
	}
	return plans;
}
/** What a bot does next, when it's its turn (or its choice). `random` gives 0–1. */
function botAction(s, level, random) {
	if (s.phase === "choice" && s.pending) return {
		kind: "choose",
		option: botChoice(s, level, random)
	};
	if (level === "very-easy") {
		const usable = usableItems(s);
		if (usable.length > 0 && random() < .4) {
			const item = pick(random, usable);
			const targets = validTargets(s, item);
			return {
				kind: "use-item",
				item,
				...targets.length > 0 ? { target: pick(random, targets) } : {},
				...item === "navigator" ? { value: 1 + Math.floor(random() * 6) } : {}
			};
		}
		return { kind: "roll" };
	}
	const plans = itemPlans(s, level).filter((p) => p.worth >= 1);
	if (plans.length === 0) return { kind: "roll" };
	return plans.reduce((best, p) => p.worth > best.worth ? p : best).action;
}
function botChoice(s, level, random) {
	const pending = s.pending;
	const seat = s.turn;
	if (level === "very-easy") return pick(random, choiceOptions(pending));
	switch (pending.kind) {
		case "gate": return pending.twin > pending.square ? 1 : 0;
		case "mystery": return Math.floor(random() * 3);
		case "binary": {
			const [a, b] = pending.dice.map((die) => landingValue(s, seat, stepsFor(s.rockets[seat], s.turnInfo, die).steps));
			return b > a ? 1 : 0;
		}
		case "inventory": {
			const items = s.rockets[seat].items;
			let worst = 0;
			items.forEach((item, i) => {
				if (ITEM_VALUE[item] < ITEM_VALUE[items[worst]]) worst = i;
			});
			return ITEM_VALUE[pending.item] > ITEM_VALUE[items[worst]] ? worst : 3;
		}
		case "question": return 1;
	}
}
//#endregion
//#region shared/space/replay.ts
/** Starts a bot game from its setup. */
function startSolo$1(setup) {
	const players = setup.bots + 1;
	const { state, events } = newGame$1(boardFor(setup.board), setup.settings, players);
	return {
		state,
		events,
		studentSeat: seededDice(`${setup.seed}:order`)(players) - 1,
		dice: seededDice(`${setup.seed}:dice`),
		botRandom: randomFromSeed(`${setup.seed}:bots`)
	};
}
/** Plays bot turns until it's the student's turn or the game is over. */
function playBots$1(game, level, onEvents) {
	for (let guard = 0; game.state.phase !== "over" && game.state.turn !== game.studentSeat; guard++) {
		if (guard > 1e4) throw new Error("Bots never finished their turns");
		const { state, events } = play$1(game.state, botAction(game.state, level, game.botRandom), game.dice);
		game.state = state;
		game.events.push(...events);
		onEvents?.(events);
	}
}
/**
* Replays a bot game exactly. Fails if any action is against the rules or left over.
* `onEvents` sees every event, in order, from the start of the game.
*/
function replaySolo$1(setup, actions, onEvents) {
	if (actions.length > 2e3) return {
		ok: false,
		reason: "too many actions"
	};
	let game;
	try {
		game = startSolo$1(setup);
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "bad setup"
		};
	}
	let studentTurns = 0;
	onEvents?.(game.events);
	try {
		playBots$1(game, setup.level, onEvents);
		for (const action of actions) {
			if (game.state.phase === "over") return {
				ok: false,
				reason: "actions after the game ended"
			};
			const before = game.state.turnsTaken;
			const { state, events } = play$1(game.state, action, game.dice);
			game.state = state;
			onEvents?.(events);
			if (game.state.turnsTaken > before || game.state.phase === "over") studentTurns++;
			playBots$1(game, setup.level, onEvents);
		}
	} catch (error) {
		if (error instanceof SpaceRuleError) return {
			ok: false,
			reason: `an action broke the rules: ${error.message}`
		};
		throw error;
	}
	return {
		ok: true,
		state: game.state,
		studentSeat: game.studentSeat,
		studentTurns,
		finished: game.state.phase === "over"
	};
}
const SEED_PATTERN = /^s1-(\d{10})-[0-9a-f]{24}$/;
const SEAT_NAMES = [
	"first",
	"second",
	"third",
	"fourth"
];
/** A new seed: when it was made and 12 random bytes. */
function makeSeed(nowSeconds, randomHex) {
	return `s1-${String(Math.floor(nowSeconds)).padStart(10, "0")}-${randomHex}`;
}
/** What the server signs: the seed and who it was given to, so a seed can't be shared. */
function stampText$1(player, seed) {
	return `space-seed:v1:${player}:${seed}`;
}
/** Null if the seed is well made and still fresh, else what's wrong. */
function seedProblem(seed, nowSeconds) {
	const match = SEED_PATTERN.exec(seed);
	if (!match) return "not a server seed";
	const age = nowSeconds - Number(match[1]);
	if (age < -300) return "seed from the future";
	if (age > 43200) return "seed too old";
	return null;
}
/** The opposite of encodeAction. Null for anything it wouldn't make (timeouts too: solo games have no timer). */
function decodeAction(text) {
	if (text === "roll") return { kind: "roll" };
	const choose = /^choose:([0-3])$/.exec(text);
	if (choose) return {
		kind: "choose",
		option: Number(choose[1])
	};
	const use = /^use:([a-z-]{1,20})(?:@([0-3]))?(?:=([1-6]))?$/.exec(text);
	if (use && isItemKind(use[1])) return {
		kind: "use-item",
		item: use[1],
		...use[2] !== void 0 ? { target: Number(use[2]) } : {},
		...use[3] !== void 0 ? { value: Number(use[3]) } : {}
	};
	return null;
}
const isBool = (value) => typeof value === "boolean";
function parseBoard(input) {
	if (typeof input !== "object" || input === null) return null;
	const b = input;
	if ("id" in b) return isDesignedBoardId(b.id) && Object.keys(b).length === 1 ? { id: b.id } : null;
	if (typeof b.galaxy !== "string" || b.galaxy.length > 40 || b.size !== 100 && b.size !== 50) return null;
	const galaxy = parseGalaxyCode(b.galaxy);
	return galaxy ? {
		galaxy,
		size: b.size
	} : null;
}
function parseSettings(input) {
	if (typeof input !== "object" || input === null) return null;
	const s = input;
	if (s.mode !== "classic" && s.mode !== "cosmic") return null;
	if (s.finish !== "any" && s.finish !== "exact") return null;
	if (!isBool(s.rollAgainOnSix) || !isBool(s.cosmicEvents)) return null;
	if (s.maths !== false) return null;
	return {
		mode: s.mode,
		finish: s.finish,
		rollAgainOnSix: s.rollAgainOnSix,
		cosmicEvents: s.cosmicEvents,
		maths: false
	};
}
/** Checks the shape of a report that came from outside (e.g. the browser). */
function parseSpaceReport(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (r.game !== "space") return null;
	if (typeof r.seed !== "string" || r.seed.length > 64) return null;
	if (typeof r.stamp !== "string" || !/^[A-Za-z0-9_-]{20,100}$/.test(r.stamp)) return null;
	const board = parseBoard(r.board);
	const settings = parseSettings(r.settings);
	if (!board || !settings) return null;
	if (r.bots !== 1 && r.bots !== 2 && r.bots !== 3) return null;
	if (!isBotLevelId(r.level) || !isClaimedEnding(r.ending) || r.ending === "resigned") return null;
	if (!Array.isArray(r.actions) || r.actions.length > 1e3) return null;
	if (!r.actions.every((a) => typeof a === "string" && a.length <= 40)) return null;
	return {
		game: "space",
		seed: r.seed,
		stamp: r.stamp,
		board,
		settings,
		bots: r.bots,
		level: r.level,
		actions: r.actions,
		ending: r.ending
	};
}
/** Replays the game from its seed and works out the result. The stamp is checked separately. */
function judgeSpaceGame(report) {
	const actions = [];
	for (const text of report.actions) {
		const action = decodeAction(text);
		if (!action) return {
			ok: false,
			problem: "unreadable action"
		};
		actions.push(action);
	}
	const setup = {
		seed: report.seed,
		board: report.board,
		settings: report.settings,
		bots: report.bots,
		level: report.level
	};
	const events = [];
	let replayed;
	try {
		replayed = replaySolo$1(setup, actions, (batch) => events.push(...batch));
	} catch {
		return {
			ok: false,
			problem: "replay failed"
		};
	}
	if (!replayed.ok) return {
		ok: false,
		problem: replayed.reason
	};
	const { state, studentSeat, studentTurns, finished } = replayed;
	if (!finished && report.ending === "finished") return {
		ok: false,
		problem: "game not over"
	};
	const mine = events.filter((e) => "seat" in e && e.seat === studentSeat);
	const stars = new Set(mine.flatMap((e) => e.kind === "star" ? [e.star] : []));
	const stats = {
		wormholes: mine.filter((e) => e.kind === "wormhole").length,
		blocks: mine.filter((e) => e.kind === "force-field").length,
		stars: STAR_KINDS.filter((k) => stars.has(k)),
		docked: mine.some((e) => e.kind === "docked")
	};
	const place = finished ? state.places?.[studentSeat] ?? null : null;
	return {
		ok: true,
		game: {
			outcome: place === 1 ? "won" : "lost",
			reason: !finished ? "abandoned" : state.ending === "mission-clock" ? "out-of-fuel" : "docked",
			place,
			rockets: report.bots + 1,
			playerSide: SEAT_NAMES[studentSeat],
			studentTurns,
			countsForPoints: finished && studentTurns >= 5,
			stats
		}
	};
}
//#endregion
//#region shared/card101/cards.ts
/**
* The pack for 101: 52 cards, each written as two characters, rank then suit.
* Ranks: A 2 3 4 5 6 7 8 9 T(en) J Q K. Suits: C(lubs) D(iamonds) H(earts) S(pades).
* So "QH" is the Queen of hearts and "TS" the 10 of spades.
*
* Two characters, always upper case, so a test can find every card in any message
* with one pattern (CARD_PATTERN) and prove no hidden card ever leaves the server.
*/
const RANKS = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"T",
	"J",
	"Q",
	"K"
];
/** Every card, in a fixed order (shuffle a copy). */
const PACK = [
	"C",
	"D",
	"H",
	"S"
].flatMap((suit) => RANKS.map((rank) => `${rank}${suit}`));
const rankOf = (card) => card[0];
/** What a card scores on its own: King 0, 3 0, Ace 1, 2 and 4–10 face value, Jack and Queen 10. */
function cardValue(card) {
	const rank = rankOf(card);
	if (rank === "K" || rank === "3") return 0;
	if (rank === "A") return 1;
	if (rank === "T" || rank === "J" || rank === "Q") return 10;
	return Number(rank);
}
/** Where each of your four cards sits. The bottom two (nearest you) are the ones you peek at. */
const SLOTS = [
	0,
	1,
	2,
	3
];
const PEEK_SLOTS = [2, 3];
const isSlot = (value) => SLOTS.includes(value);
//#endregion
//#region shared/card101/score.ts
/**
* Scoring a hand of four cards, the way James's family plays (docs/101-RULES.md):
*
*   1. Three or four of a kind: the whole hand scores 0.
*   2. Pairs: two cards of the same rank, anywhere, cancel each other (both score 0).
*   3. 3s: each 3 scores 0 and cancels the highest card still counting. A tie for highest
*      cancels just one card. Two 3s cancel two cards (even though they're also a pair).
*   4. Add up what's left.
*
* Besides the total, it returns each step, so the end-of-round screen can show the
* working: "the 7s cancel", "the 3 cancels the Queen", "4 + 0 = 4".
*/
function scoreHand(hand) {
	const values = hand.map(cardValue);
	const steps = [];
	const slotsByRank = new Map();
	hand.forEach((card, slot) => {
		const rank = rankOf(card);
		slotsByRank.set(rank, [...slotsByRank.get(rank) ?? [], slot]);
	});
	for (const [rank, slots] of slotsByRank) if (slots.length >= 3) {
		steps.push({
			kind: "triple",
			rank,
			slots
		});
		return {
			total: 0,
			values: values.map(() => 0),
			steps
		};
	}
	const cancelled = new Set();
	for (const [rank, slots] of slotsByRank) if (slots.length === 2) {
		steps.push({
			kind: "pair",
			rank,
			slots: [slots[0], slots[1]]
		});
		for (const slot of slots) cancelled.add(slot);
	}
	for (const three of slotsByRank.get("3") ?? []) {
		let highest = -1;
		hand.forEach((_, slot) => {
			if (cancelled.has(slot) || values[slot] === 0) return;
			if (highest < 0 || values[slot] > values[highest]) highest = slot;
		});
		if (highest < 0) break;
		steps.push({
			kind: "three-cancels",
			three,
			cancels: highest,
			value: values[highest]
		});
		cancelled.add(highest);
	}
	const finalValues = values.map((value, slot) => cancelled.has(slot) ? 0 : value);
	return {
		total: finalValues.reduce((a, b) => a + b, 0),
		values: finalValues,
		steps
	};
}
const TARGETS = [101, 50];
var RuleError = class extends Error {};
const fail = (message) => {
	throw new RuleError(message);
};
const activeSeats = (game) => game.totals.map((_, seat) => seat).filter((seat) => !game.out[seat]);
/** Starts a game. The first round is dealt straight away; `dice` shuffles and picks who starts. */
function newGame(players, settings, dice) {
	if (!Number.isInteger(players) || players < 2 || players > 4) fail("2 to 4 players");
	if (!TARGETS.includes(settings.target)) fail("Unknown target");
	const game = {
		settings: { target: settings.target },
		players,
		totals: Array(players).fill(0),
		out: Array(players).fill(false),
		round: 0,
		starter: dice(players) - 1,
		phase: "round-over",
		hands: Array.from({ length: players }, () => []),
		faceUp: Array.from({ length: players }, () => []),
		stack: [],
		discard: [],
		turn: 0,
		holding: null,
		turnsThisRound: Array(players).fill(0),
		knocker: null,
		owesLastTurn: Array(players).fill(false),
		peeked: Array(players).fill(false),
		skips: Array(players).fill(0),
		results: [],
		winners: null
	};
	const events = [];
	deal(game, dice, events, false);
	return {
		game,
		events
	};
}
/** Plays one action. Throws RuleError (and changes nothing) if it isn't allowed. */
function play(game, actor, action, dice) {
	const g = structuredClone(game);
	const events = [];
	apply(g, actor, action, dice, events);
	return {
		game: g,
		events
	};
}
function apply(g, actor, action, dice, events) {
	if (g.phase === "over") fail("The game is over");
	const seat = actor === "system" ? null : actor;
	if (seat !== null && (!Number.isInteger(seat) || seat < 0 || seat >= g.players)) fail("No such player");
	if (seat !== null && g.out[seat]) fail("You're out of this game");
	switch (action.type) {
		case "peek-done":
			if (seat === null) fail("Only a player can finish their peek");
			if (g.phase !== "peek") fail("It isn't peek time");
			if (g.peeked[seat]) fail("Your peek is already over");
			g.peeked[seat] = true;
			events.push({
				kind: "peek-done",
				seat
			});
			startPlayIfPeeksDone(g, events);
			return;
		case "end-peek":
			if (seat !== null) fail("Only the referee can end the peek");
			if (g.phase !== "peek") fail("It isn't peek time");
			for (const s of activeSeats(g)) g.peeked[s] = true;
			startPlayIfPeeksDone(g, events);
			return;
		case "next-round":
			if (seat !== null) fail("Only the referee deals");
			if (g.phase !== "round-over") fail("The round isn't over");
			deal(g, dice, events, true);
			return;
		case "leave":
			if (seat === null) fail("Only a player can leave");
			putOut(g, seat, "left", events);
			return;
		case "skip": {
			if (seat !== null) fail("Only the referee can skip a turn");
			if (g.phase !== "play") fail("Nobody's turn to skip");
			const skipped = g.turn;
			const discarded = g.holding ? g.holding.card : null;
			if (g.holding) g.discard.push(g.holding.card);
			g.holding = null;
			events.push({
				kind: "skip",
				seat: skipped,
				discarded
			});
			g.skips[skipped] += 1;
			if (g.skips[skipped] >= 3) {
				putOut(g, skipped, "skipped", events);
				return;
			}
			endTurn(g, events);
			return;
		}
	}
	if (g.phase !== "play") fail("It isn't time to play");
	if (seat === null) fail("Only a player can do that");
	if (seat !== g.turn) fail("It isn't your turn");
	g.skips[seat] = 0;
	switch (action.type) {
		case "draw":
			if (g.holding) fail("You're already holding a card");
			if (action.from === "discard") {
				const card = g.discard.pop() ?? fail("The discard pile is empty");
				g.holding = {
					card,
					from: "discard"
				};
				events.push({
					kind: "draw",
					seat,
					from: "discard",
					card
				});
			} else if (action.from === "stack") {
				if (g.stack.length === 0) reshuffle(g, dice, events);
				const card = g.stack.pop() ?? fail("There are no cards left to draw");
				g.holding = {
					card,
					from: "stack"
				};
				events.push({
					kind: "draw",
					seat,
					from: "stack",
					card
				});
			} else fail("Draw from the stack or the discard pile");
			return;
		case "swap": {
			if (!g.holding) fail("Take a card first");
			if (!isSlot(action.slot)) fail("Pick one of your four cards");
			if (g.faceUp[seat][action.slot]) fail("That card is face up, so it stays. Pick a face-down card, or throw it away");
			const discarded = g.hands[seat][action.slot];
			const placed = g.holding.card;
			g.hands[seat][action.slot] = placed;
			g.faceUp[seat][action.slot] = true;
			g.discard.push(discarded);
			g.holding = null;
			events.push({
				kind: "swap",
				seat,
				slot: action.slot,
				placed,
				discarded
			});
			endTurn(g, events);
			return;
		}
		case "throw": {
			if (!g.holding) fail("Take a card first");
			const card = g.holding.card;
			g.discard.push(card);
			g.holding = null;
			events.push({
				kind: "throw",
				seat,
				card
			});
			endTurn(g, events);
			return;
		}
		case "knock":
			if (!canKnock(g, seat)) fail(g.knocker !== null ? "Someone has already knocked" : "You can knock once everyone has had a turn");
			g.knocker = seat;
			for (const s of activeSeats(g)) g.owesLastTurn[s] = s !== seat;
			events.push({
				kind: "knock",
				seat
			});
			endTurn(g, events);
			return;
		default: fail("Unknown move");
	}
}
/** Whether this player could knock right now. */
function canKnock(g, seat) {
	return g.phase === "play" && g.turn === seat && !g.holding && g.knocker === null && activeSeats(g).every((s) => g.turnsThisRound[s] >= 1);
}
function startPlayIfPeeksDone(g, events) {
	if (activeSeats(g).some((s) => !g.peeked[s])) return;
	g.phase = "play";
	g.turn = g.out[g.starter] ? nextActive(g, g.starter) : g.starter;
	events.push({
		kind: "play-starts",
		turn: g.turn
	});
}
/** Shuffles a fresh pack and deals a round. `moveStarter`: the start moves one player along. */
function deal(g, dice, events, moveStarter) {
	g.round += 1;
	if (moveStarter) g.starter = nextActive(g, g.starter);
	const pack = shuffled(dice, PACK);
	g.hands = g.totals.map((_, seat) => g.out[seat] ? [] : pack.splice(0, 4));
	g.faceUp = g.hands.map((hand) => hand.map(() => false));
	g.discard = [pack.pop()];
	g.stack = pack;
	g.holding = null;
	g.turn = g.starter;
	g.turnsThisRound = Array(g.players).fill(0);
	g.knocker = null;
	g.owesLastTurn = Array(g.players).fill(false);
	g.peeked = g.out.map((out) => out);
	g.phase = "peek";
	events.push({
		kind: "deal",
		round: g.round,
		starter: g.starter,
		discardTop: g.discard[g.discard.length - 1]
	});
}
/** The stack is empty: shuffle the discard pile, except its top card, into a new stack. */
function reshuffle(g, dice, events) {
	const top = g.discard.pop();
	if (top === void 0 || g.discard.length === 0) {
		if (top !== void 0) g.discard.push(top);
		fail("There are no cards left to draw");
	}
	g.stack = shuffled(dice, g.discard);
	g.discard = [top];
	events.push({
		kind: "reshuffle",
		cards: g.stack.length
	});
}
function nextActive(g, from) {
	for (let step = 1; step <= g.players; step++) {
		const seat = (from + step) % g.players;
		if (!g.out[seat]) return seat;
	}
	return from;
}
/** The current player's turn is over: pass it on, or score the round after the last turns. */
function endTurn(g, events) {
	const finished = g.turn;
	g.turnsThisRound[finished] += 1;
	if (g.knocker !== null) g.owesLastTurn[finished] = false;
	passTurn(g, finished, events);
}
function passTurn(g, from, events) {
	if (g.knocker !== null) {
		for (let step = 1; step <= g.players; step++) {
			const seat = (from + step) % g.players;
			if (!g.out[seat] && g.owesLastTurn[seat]) {
				g.turn = seat;
				events.push({
					kind: "turn",
					seat,
					lastTurn: true
				});
				return;
			}
		}
		scoreRound(g, events);
		return;
	}
	g.turn = nextActive(g, from);
	events.push({
		kind: "turn",
		seat: g.turn,
		lastTurn: false
	});
}
function scoreRound(g, events) {
	const scores = g.hands.map((hand, seat) => g.out[seat] ? null : scoreHand(hand));
	const live = activeSeats(g);
	const lowest = Math.min(...live.map((s) => scores[s].total));
	for (const s of live) g.totals[s] += scores[s].total;
	const result = {
		round: g.round,
		hands: g.hands.map((hand, seat) => g.out[seat] ? [] : [...hand]),
		scores,
		winners: live.filter((s) => scores[s].total === lowest),
		knocker: g.knocker,
		totals: [...g.totals]
	};
	g.results.push(result);
	g.phase = "round-over";
	g.holding = null;
	events.push({
		kind: "round-end",
		result
	});
	if (live.some((s) => g.totals[s] >= g.settings.target)) finishGame(g, events);
}
function finishGame(g, events) {
	const live = activeSeats(g);
	const best = Math.min(...live.map((s) => g.totals[s]));
	g.winners = live.filter((s) => g.totals[s] === best);
	g.phase = "over";
	events.push({
		kind: "game-over",
		winners: g.winners,
		totals: [...g.totals]
	});
}
/** A player leaves or is skipped out: their cards leave the table and the others carry on. */
function putOut(g, seat, reason, events) {
	if (g.out[seat]) fail("You're out of this game");
	const wasTheirTurn = g.phase === "play" && g.turn === seat;
	if (wasTheirTurn && g.holding) {
		g.discard.push(g.holding.card);
		g.holding = null;
	}
	g.out[seat] = true;
	g.hands[seat] = [];
	g.faceUp[seat] = [];
	g.owesLastTurn[seat] = false;
	g.peeked[seat] = true;
	events.push({
		kind: "out",
		seat,
		reason
	});
	const live = activeSeats(g);
	if (live.length < 2) {
		g.winners = live;
		g.phase = "over";
		events.push({
			kind: "game-over",
			winners: live,
			totals: [...g.totals]
		});
		return;
	}
	if (g.phase === "peek") startPlayIfPeeksDone(g, events);
	else if (wasTheirTurn) passTurn(g, seat, events);
}
//#endregion
//#region shared/card101/bot.ts
function newMemory(seat, players) {
	return {
		seat,
		round: 0,
		own: [
			null,
			null,
			null,
			null
		],
		others: Array.from({ length: players }, () => [
			null,
			null,
			null,
			null
		]),
		othersKept: Array.from({ length: players }, () => [
			false,
			false,
			false,
			false
		]),
		discardPile: [],
		lastSeenHolding: null
	};
}
/** Updates a bot's memory from what its seat was just shown. Pure: returns a new memory. */
function observe(memory, view, events) {
	const m = structuredClone(memory);
	for (const event of events) switch (event.kind) {
		case "deal":
			m.round = event.round;
			m.own = [
				null,
				null,
				null,
				null
			];
			m.others = m.others.map(() => [
				null,
				null,
				null,
				null
			]);
			m.othersKept = m.othersKept.map(() => [
				false,
				false,
				false,
				false
			]);
			m.discardPile = [event.discardTop];
			break;
		case "draw":
			if (event.from === "discard") m.discardPile.pop();
			break;
		case "swap": {
			const held = heldCard(m, event.seat, events, event);
			if (event.seat === m.seat) m.own[event.slot] = held;
			else {
				m.others[event.seat][event.slot] = held;
				m.othersKept[event.seat][event.slot] = held === null;
			}
			m.discardPile.push(event.discarded);
			break;
		}
		case "throw":
			m.discardPile.push(event.card);
			break;
		case "skip":
			if (event.discarded) m.discardPile.push(event.discarded);
			break;
		case "reshuffle":
			m.discardPile = m.discardPile.slice(-1);
			break;
		case "out":
			m.others[event.seat] = [
				null,
				null,
				null,
				null
			];
			m.othersKept[event.seat] = [
				false,
				false,
				false,
				false
			];
	}
	if (view.peek) view.peek.slots.forEach((slot, i) => m.own[slot] = view.peek.cards[i]);
	view.faceUp.forEach((hand, seat) => hand.forEach((card, slot) => {
		if (!card) return;
		if (seat === m.seat) m.own[slot] = card;
		else {
			m.others[seat][slot] = card;
			m.othersKept[seat][slot] = false;
		}
	}));
	m.lastSeenHolding = view.holding ? {
		seat: view.holding.seat,
		card: view.holding.card
	} : null;
	return m;
}
/**
* The card a player put into their hand with a swap: the one they were last seen holding
* (known if it's the bot's own, or came off the discard pile), or found in the same batch.
*/
function heldCard(m, seat, events, swap) {
	const at = events.indexOf(swap);
	for (let i = at - 1; i >= 0; i--) {
		const e = events[i];
		if (e.kind === "draw" && e.seat === seat) return e.card ?? null;
		if (e.kind === "turn" || e.kind === "deal") break;
	}
	if (m.lastSeenHolding && m.lastSeenHolding.seat === seat) return m.lastSeenHolding.card;
	return null;
}
/** Decides the bot's next action. `random` gives numbers from 0 up to 1. */
function decide(view, memory, level, random) {
	if (view.phase === "peek") return { type: "peek-done" };
	if (view.phase !== "play" || view.turn !== view.seat) throw new Error("It isn't this bot's turn");
	const up = view.faceUp[view.seat] ?? [];
	const known = memory.own.map((c, slot) => up[slot] ?? (level === "very-easy" && c && random() < .4 ? null : c));
	const open = SLOTS.filter((slot) => !up[slot]);
	if (view.holding) {
		const card = view.holding.card;
		return level === "very-easy" ? veryEasyPlace(card, known, open, random) : bestPlace(card, known, open, pool(view, memory, level), level, random);
	}
	const dragging = view.turnsThisRound[view.seat] >= 10;
	if (view.canKnock && (open.length === 0 || dragging || wantsToKnock(view, memory, known, level, random))) return { type: "knock" };
	const top = view.discardTop;
	if (top) {
		if (level === "very-easy") {
			if (cardValue(top) <= 2) return {
				type: "draw",
				from: "discard"
			};
		} else {
			const cards = pool(view, memory, level);
			const now = expectedScore(known, cards, random, samplesFor(level));
			const place = bestPlace(top, known, open, cards, level, random);
			if (place.type === "swap") {
				const after = [...known];
				after[place.slot] = top;
				const gain = now - expectedScore(after, cards, random, samplesFor(level));
				if (level === "easy" ? gain >= 3 : gain >= stackGain(known, open, cards, random) + MEDIUM_TUNING.stackBonus) return {
					type: "draw",
					from: "discard"
				};
			}
		}
	}
	return {
		type: "draw",
		from: "stack"
	};
}
/** Medium's settings, tuned with the simulation (docs/101-PLAN.md section 13): knocking only on a low hand wins most. */
const MEDIUM_TUNING = {
	knockCap: 5,
	knockMargin: 0,
	guessOffset: 1.5,
	stackBonus: .5,
	alwaysKnockAt: 3
};
const samplesFor = (level) => level === "medium" ? 32 : 10;
function veryEasyPlace(card, known, open, random) {
	if (open.length === 0 || cardValue(card) > 4 && rankOf(card) !== "3") return { type: "throw" };
	const high = open.filter((s) => known[s] && cardValue(known[s]) >= 7);
	const slots = high.length ? high : open;
	return {
		type: "swap",
		slot: slots[Math.floor(random() * slots.length)]
	};
}
/** Swap into the spot that lowers the expected hand most, or throw it away. */
function bestPlace(card, known, open, cards, level, random) {
	const fills = sampleFills(known, cards.filter((c) => c !== card), random, samplesFor(level));
	const now = averageScore(known, fills);
	let best = null;
	let bestScore = now - (level === "easy" ? .5 : .25);
	for (const slot of open) {
		const after = [...known];
		after[slot] = card;
		const score = averageScore(after, fills);
		if (score < bestScore) {
			bestScore = score;
			best = slot;
		}
	}
	return best === null ? { type: "throw" } : {
		type: "swap",
		slot: best
	};
}
/**
* The cards an unknown card could be. Medium leaves out everything it knows is somewhere
* else (the discard pile, other players' known cards). Easy only leaves out its own cards.
*/
function pool(view, memory, level) {
	const elsewhere = new Set(memory.own.filter((c) => c !== null));
	if (view.holding?.card) elsewhere.add(view.holding.card);
	if (level === "medium") {
		for (const c of memory.discardPile) elsewhere.add(c);
		for (const hand of memory.others) for (const c of hand) if (c) elsewhere.add(c);
	} else if (view.discardTop) elsewhere.add(view.discardTop);
	return PACK.filter((c) => !elsewhere.has(c));
}
/** Random guesses for the unknown spots, drawn without repeats from `cards`. */
function sampleFills(known, cards, random, samples) {
	const unknown = known.filter((c) => c === null).length;
	const fills = [];
	for (let n = 0; n < samples; n++) {
		const picked = [];
		const left = [...cards];
		for (let i = 0; i < unknown && left.length; i++) picked.push(left.splice(Math.floor(random() * left.length), 1)[0]);
		fills.push(picked);
	}
	return fills;
}
function averageScore(known, fills) {
	let sum = 0;
	for (const fill of fills) {
		let i = 0;
		sum += scoreHand(known.map((c) => c ?? fill[i++] ?? "KS")).total;
	}
	return sum / fills.length;
}
function expectedScore(known, cards, random, samples) {
	return averageScore(known, sampleFills(known, cards, random, samples));
}
function wantsToKnock(view, memory, known, level, random) {
	if (level === "very-easy") return random() < .2;
	const cards = pool(view, memory, level);
	const mine = expectedScore(known, cards, random, samplesFor(level));
	if (level === "easy") return mine <= 9;
	if (mine <= MEDIUM_TUNING.alwaysKnockAt) return true;
	const others = view.totals.map((_, seat) => seat).filter((seat) => seat !== view.seat && !view.out[seat]).map((seat) => guessHand(memory, seat, cards, random) - MEDIUM_TUNING.guessOffset);
	const theirBest = Math.min(...others);
	return mine <= MEDIUM_TUNING.knockCap && mine < theirBest - MEDIUM_TUNING.knockMargin;
}
/** Medium's guess at another player's hand: known cards, low guesses for kept stack cards. */
function guessHand(memory, seat, cards, random) {
	const low = cards.filter((c) => cardValue(c) <= 5);
	let sum = 0;
	const samples = 16;
	for (let n = 0; n < samples; n++) {
		const used = new Set();
		const pick = (from) => {
			for (let tries = 0; tries < 20; tries++) {
				const c = from[Math.floor(random() * from.length)];
				if (!used.has(c)) {
					used.add(c);
					return c;
				}
			}
			return "KS";
		};
		const hand = SLOTS.map((slot) => memory.others[seat][slot] ?? pick(memory.othersKept[seat][slot] && low.length ? low : cards));
		sum += scoreHand(hand).total;
	}
	return sum / samples;
}
/** Medium: how much a card off the stack would lower its hand, on average. */
function stackGain(known, open, cards, random) {
	const fills = sampleFills(known, cards, random, 16);
	const now = averageScore(known, fills);
	let gain = 0;
	const draws = 10;
	for (let n = 0; n < draws; n++) {
		const card = cards[Math.floor(random() * cards.length)];
		let best = now;
		for (const slot of open) {
			const after = [...known];
			after[slot] = card;
			best = Math.min(best, averageScore(after, fills));
		}
		gain += now - best;
	}
	return gain / draws;
}
//#endregion
//#region shared/card101/view.ts
/**
* What one player is allowed to know. This is the ONLY way card information leaves the
* server in a classmates game: every function reply, every live update and every bot
* goes through `viewFor` and `eventsFor`.
*
* A player may see: the top of the discard pile; a card they've just drawn, while they
* hold it; a card anyone took from the discard pile (everyone saw it face up); every
* card swapped into a hand (those go in face up); their bottom two cards during the
* peek, and never again; and everyone's cards once a round is over. Nothing else: never
* the stack, never anyone's face-down cards, not even their own. `view.test.ts` plays thousands of games and checks every view for leaks.
*/
function viewFor(game, seat) {
	const holding = game.holding ? {
		seat: game.turn,
		from: game.holding.from,
		card: game.turn === seat || game.holding.from === "discard" ? game.holding.card : null
	} : null;
	const peekOn = game.phase === "peek" && !game.out[seat] && !game.peeked[seat];
	const roundShown = game.phase === "round-over" || game.phase === "over";
	const last = game.results[game.results.length - 1];
	return {
		seat,
		players: game.players,
		settings: { ...game.settings },
		round: game.round,
		phase: game.phase,
		turn: game.turn,
		starter: game.starter,
		totals: [...game.totals],
		out: [...game.out],
		cardsOnTable: game.hands.map((hand) => hand.length),
		faceUp: game.hands.map((hand, s) => hand.map((card, slot) => game.faceUp[s][slot] ? card : null)),
		stackCount: game.stack.length,
		discardTop: game.discard.length ? game.discard[game.discard.length - 1] : null,
		holding,
		peek: peekOn ? {
			slots: PEEK_SLOTS,
			cards: PEEK_SLOTS.map((slot) => game.hands[seat][slot])
		} : null,
		peeked: [...game.peeked],
		turnsThisRound: [...game.turnsThisRound],
		knocker: game.knocker,
		owesLastTurn: [...game.owesLastTurn],
		canKnock: canKnock(game, seat),
		skips: [...game.skips],
		lastRound: roundShown && last && last.round === game.round ? structuredClone(last) : null,
		history: game.results.map((r) => ({
			round: r.round,
			hands: r.scores.map((s) => s ? s.total : null),
			winners: [...r.winners],
			knocker: r.knocker,
			totals: [...r.totals]
		})),
		winners: game.winners ? [...game.winners] : null
	};
}
/**
* The events one player may see. A card drawn from the stack is shown only to the
* player who drew it, and only while they're still holding it (`game` is the game
* after the events), so once it's swapped in it's gone from their screen too.
*/
function eventsFor(events, seat, game) {
	return events.map((event) => {
		if (event.kind === "round-end") return (game.phase === "round-over" || game.phase === "over") && game.round === event.result.round ? structuredClone(event) : {
			kind: "round-end",
			result: {
				...structuredClone(event.result),
				hands: []
			}
		};
		if (event.kind !== "draw" || event.from !== "stack") return structuredClone(event);
		const stillHolding = game.phase === "play" && game.turn === seat && game.holding?.card === event.card;
		if (event.seat === seat && stillHolding) return { ...event };
		return {
			kind: "draw",
			seat: event.seat,
			from: "stack"
		};
	});
}
function parseStudentAction(text) {
	switch (text) {
		case "peek": return {
			actor: 0,
			action: { type: "peek-done" }
		};
		case "draw:stack": return {
			actor: 0,
			action: {
				type: "draw",
				from: "stack"
			}
		};
		case "draw:discard": return {
			actor: 0,
			action: {
				type: "draw",
				from: "discard"
			}
		};
		case "throw": return {
			actor: 0,
			action: { type: "throw" }
		};
		case "knock": return {
			actor: 0,
			action: { type: "knock" }
		};
		case "leave": return {
			actor: 0,
			action: { type: "leave" }
		};
		case "next": return {
			actor: "system",
			action: { type: "next-round" }
		};
		default: {
			if (typeof text !== "string" || !text.startsWith("swap:")) return null;
			const slot = Number(text.slice(5));
			return isSlot(slot) && text === `swap:${slot}` ? {
				actor: 0,
				action: {
					type: "swap",
					slot
				}
			} : null;
		}
	}
}
function startSolo(setup) {
	if (!Number.isInteger(setup.bots) || setup.bots < 1 || setup.bots > 3) throw new RuleError("1 to 3 bots");
	const dice = seededDice(`${setup.seed}:deck`);
	const { game, events } = newGame(setup.bots + 1, setup.settings, dice);
	const solo = {
		setup,
		game,
		dice,
		memories: Array.from({ length: game.players }, (_, seat) => seat === 0 ? null : newMemory(seat, game.players)),
		decisions: 0
	};
	tellBots(solo, events);
	return {
		solo,
		events: eventsFor(events, 0, game)
	};
}
/** Plays one action and shows every bot what its seat saw. Returns the student's events. */
function applySolo(solo, actor, action) {
	const { game, events } = play(solo.game, actor, action, solo.dice);
	solo.game = game;
	tellBots(solo, events);
	return eventsFor(events, 0, game);
}
function tellBots(solo, events) {
	solo.memories = solo.memories.map((memory, seat) => memory ? observe(memory, viewFor(solo.game, seat), eventsFor(events, seat, solo.game)) : null);
}
/** The next thing a bot wants to do, or null when it's the student's move (or between rounds). */
function nextBotMove(solo) {
	const g = solo.game;
	if (g.phase === "peek") {
		const seat = solo.memories.findIndex((m, s) => m && !g.out[s] && !g.peeked[s]);
		return seat >= 0 ? {
			seat,
			action: { type: "peek-done" }
		} : null;
	}
	if (g.phase !== "play" || g.turn === 0) return null;
	const random = randomFromSeed(`${solo.setup.seed}:bot:${solo.decisions}`);
	const action = decide(viewFor(g, g.turn), solo.memories[g.turn], solo.setup.level, random);
	return {
		seat: g.turn,
		action
	};
}
/**
* Plays the next bot move, if a bot is to move. Returns what happened (the student's
* events), or null when it's the student's move. The screen calls this one move at a
* time, with a pause between, so it plays exactly what `playBots` would.
*/
function playOneBot(solo) {
	const move = nextBotMove(solo);
	if (!move) return null;
	if (move.action.type !== "peek-done") solo.decisions += 1;
	return {
		...move,
		events: applySolo(solo, move.seat, move.action)
	};
}
/** Plays bot moves until the student has to act. `onEvents` gets the student's events after each one. */
function playBots(solo, onEvents) {
	for (let guard = 0;; guard++) {
		if (guard > 5e3) throw new Error("Bots never finished their turns");
		const move = playOneBot(solo);
		if (!move) return;
		onEvents?.(move.events, move.seat);
	}
}
/** Replays a saved bot game from its seed and the student's actions (for the server). */
function replaySolo(setup, actions) {
	if (!Array.isArray(actions) || actions.length > 3e3) return {
		ok: false,
		reason: "Too many moves"
	};
	let solo;
	try {
		solo = startSolo(setup).solo;
		playBots(solo);
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof RuleError ? error.message : "Bad game"
		};
	}
	let studentTurns = 0;
	let left = false;
	for (const text of actions) {
		const parsed = parseStudentAction(text);
		if (!parsed) return {
			ok: false,
			reason: "Unknown move"
		};
		try {
			applySolo(solo, parsed.actor, parsed.action);
			if ([
				"swap",
				"throw",
				"knock"
			].includes(parsed.action.type)) studentTurns += 1;
			if (parsed.action.type === "leave") left = true;
			playBots(solo);
		} catch (error) {
			return {
				ok: false,
				reason: error instanceof RuleError ? error.message : "Bad game"
			};
		}
	}
	const g = solo.game;
	const rounds = g.results.length;
	return {
		ok: true,
		game: g,
		studentTurns,
		rounds,
		finished: g.phase === "over",
		left
	};
}
/** What the server signs: the seed and who it was given to, so a seed can't be shared or used for another game. */
function stampText(player, seed) {
	return `101-seed:v1:${player}:${seed}`;
}
/** Checks the shape of a report that came from outside (e.g. the browser). */
function parseCard101Report(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (r.game !== "101") return null;
	if (typeof r.seed !== "string" || r.seed.length > 64) return null;
	if (typeof r.stamp !== "string" || !/^[A-Za-z0-9_-]{20,100}$/.test(r.stamp)) return null;
	if (r.bots !== 1 && r.bots !== 2 && r.bots !== 3) return null;
	if (!isBotLevelId(r.level) || !isClaimedEnding(r.ending) || r.ending === "resigned") return null;
	const settings = r.settings;
	if (typeof settings !== "object" || settings === null || Object.keys(settings).length !== 1) return null;
	if (!TARGETS.includes(settings.target)) return null;
	if (!Array.isArray(r.actions) || r.actions.length > 1e3) return null;
	if (!r.actions.every((a) => typeof a === "string" && a.length <= 20)) return null;
	return {
		game: "101",
		seed: r.seed,
		stamp: r.stamp,
		bots: r.bots,
		level: r.level,
		settings: { target: settings.target },
		actions: r.actions,
		ending: r.ending
	};
}
/** Replays the game from its seed and works out the result. The stamp is checked separately. */
function judgeCard101Game(report) {
	const setup = {
		seed: report.seed,
		bots: report.bots,
		level: report.level,
		settings: report.settings
	};
	let replayed;
	try {
		replayed = replaySolo(setup, report.actions);
	} catch {
		return {
			ok: false,
			problem: "replay failed"
		};
	}
	if (!replayed.ok) return {
		ok: false,
		problem: replayed.reason
	};
	const { game, studentTurns, rounds, left } = replayed;
	const finished = replayed.finished && !left;
	if (!finished && report.ending === "finished") return {
		ok: false,
		problem: "game not over"
	};
	const stats = {
		zeroHands: 0,
		triples: 0,
		knockWins: 0,
		savedByThree: 0
	};
	for (const result of game.results) {
		const score = result.scores[0];
		if (!score) continue;
		if (score.total === 0) stats.zeroHands += 1;
		if (score.steps.some((s) => s.kind === "triple")) stats.triples += 1;
		if (result.knocker === 0 && result.winners.includes(0)) stats.knockWins += 1;
		stats.savedByThree += score.steps.filter((s) => s.kind === "three-cancels" && s.value === 10).length;
	}
	const total = game.totals[0];
	const won = finished && (game.winners ?? []).includes(0);
	const place = finished ? 1 + game.totals.filter((t, seat) => !game.out[seat] && t < total).length : null;
	return {
		ok: true,
		game: {
			outcome: won ? "won" : "lost",
			reason: finished ? "finished" : "abandoned",
			place,
			players: game.players,
			rounds,
			total,
			studentTurns,
			countsForPoints: finished && rounds >= 2,
			stats
		}
	};
}
//#endregion
//#region shared/chess/rules.ts
/**
* Chess rules, shared by the website and the server.
*
* chess.js does the real work (legal moves, check, castling, en passant, promotion and
* every draw rule). This file only adds the few things both sides need: replaying a
* game from its list of moves, and saying how a finished game ended.
*
* Moves are stored in "UCI" form: from-square + to-square, plus the promotion piece
* if there is one. For example "e2e4", "e1g1" (castling), "e7e8q" (promote to a queen).
*/
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
function isUciMove(text) {
	return typeof text === "string" && UCI.test(text);
}
/** Plays one UCI move. Returns the move, or null if it isn't legal here. Never throws. */
function playUci(chess, uci) {
	if (!isUciMove(uci)) return null;
	try {
		return chess.move({
			from: uci.slice(0, 2),
			to: uci.slice(2, 4),
			promotion: uci[4]
		});
	} catch {
		return null;
	}
}
/**
* Has the game ended by the rules? Draws end the game automatically: threefold
* repetition, 50 moves each with no capture or pawn move, and too few pieces to mate.
*/
function boardResult$1(chess) {
	if (chess.isCheckmate()) return {
		ending: "checkmate",
		winner: chess.turn() === "w" ? "black" : "white"
	};
	if (chess.isStalemate()) return {
		ending: "stalemate",
		winner: null
	};
	if (chess.isInsufficientMaterial()) return {
		ending: "not-enough-pieces",
		winner: null
	};
	if (chess.isThreefoldRepetition()) return {
		ending: "threefold-repetition",
		winner: null
	};
	if (chess.isDrawByFiftyMoves()) return {
		ending: "fifty-moves",
		winner: null
	};
	return null;
}
/**
* Replays a whole game from the starting position. Fails if any move is illegal, or if
* a move comes after the game has already ended.
*/
function replay$1(moves) {
	const chess = new Chess();
	for (let i = 0; i < moves.length; i++) if (boardResult$1(chess) || !playUci(chess, moves[i])) return {
		ok: false,
		badMoveIndex: i
	};
	return {
		ok: true,
		chess,
		result: boardResult$1(chess)
	};
}
//#endregion
//#region shared/chess/botGame.ts
/**
* Deciding the result of a game against a bot. The website uses this to show the result
* straight away, and the server runs the very same code before saving, so a student
* can't send in a pretend win.
*/
/** Checks the shape of a report that came from outside (e.g. the browser). */
function parseReport(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (!isBotLevelId(r.level)) return null;
	if (r.studentColour !== "white" && r.studentColour !== "black") return null;
	if (!isClaimedEnding(r.ending) || !isMoveList(r.moves)) return null;
	return {
		level: r.level,
		studentColour: r.studentColour,
		moves: r.moves,
		ending: r.ending
	};
}
function studentMoveCount$1(moves, studentColour) {
	return studentColour === "white" ? Math.ceil(moves.length / 2) : Math.floor(moves.length / 2);
}
function judgeBotGame(report) {
	if (report.moves.length > 1e3) return {
		ok: false,
		problem: "too many moves"
	};
	const replayed = replay$1(report.moves);
	if (!replayed.ok) return {
		ok: false,
		problem: `illegal move at ${replayed.badMoveIndex + 1}`
	};
	const studentMoves = studentMoveCount$1(report.moves, report.studentColour);
	const longEnough = studentMoves >= 10;
	if (replayed.result) {
		const { ending, winner } = replayed.result;
		return {
			ok: true,
			game: {
				outcome: winner === null ? "drawn" : winner === report.studentColour ? "won" : "lost",
				reason: ending,
				studentMoves,
				countsForPoints: longEnough
			}
		};
	}
	if (report.ending === "finished") return {
		ok: false,
		problem: "the game is not over"
	};
	return {
		ok: true,
		game: {
			outcome: "lost",
			reason: report.ending,
			studentMoves,
			countsForPoints: report.ending === "resigned" && longEnough
		}
	};
}
function otherColour(colour) {
	return colour === "red" ? "white" : "red";
}
/** Which row (0 = top, Red's back row) and column (0 = left) a square is on. */
function rowCol(square) {
	const row = Math.floor((square - 1) / 4);
	const index = (square - 1) % 4;
	return {
		row,
		col: row % 2 === 0 ? index * 2 + 1 : index * 2
	};
}
/** The square number at a row and column, or null for a light square or off the board. */
function squareAt(row, col) {
	if (row < 0 || row > 7 || col < 0 || col > 7 || (row + col) % 2 === 0) return null;
	return row * 4 + Math.floor(col / 2) + 1;
}
/** The far row, where a man is crowned. */
function crownRow(colour) {
	return colour === "red" ? 7 : 0;
}
/** Red men move down the board (towards row 7), White men move up. */
function directions(piece) {
	const forward = piece.colour === "red" ? 1 : -1;
	const steps = [[forward, -1], [forward, 1]];
	if (piece.king) steps.push([-forward, -1], [-forward, 1]);
	return steps;
}
function startPosition() {
	const board = [];
	for (let square = 1; square <= 32; square++) if (square <= 12) board.push({
		colour: "red",
		king: false
	});
	else if (square >= 21) board.push({
		colour: "white",
		king: false
	});
	else board.push(null);
	return {
		board,
		turn: "red",
		quietPlies: 0
	};
}
function pieceAt(position, square) {
	return position.board[square - 1] ?? null;
}
function makeMove(path, captures, crowns) {
	return {
		path,
		captures,
		crowns,
		notation: path.join(captures.length > 0 ? "x" : "-")
	};
}
/** Every complete jump the piece on `from` can make. Each one carries on as far as it can. */
function jumpsFrom(position, from) {
	const piece = pieceAt(position, from);
	const board = [...position.board];
	board[from - 1] = null;
	const found = [];
	function explore(at, path, captured) {
		const { row, col } = rowCol(at);
		let canJump = false;
		for (const [dr, dc] of directions(piece)) {
			const over = squareAt(row + dr, col + dc);
			const land = squareAt(row + 2 * dr, col + 2 * dc);
			if (over === null || land === null) continue;
			const victim = board[over - 1];
			if (!victim || victim.colour === piece.colour || captured.includes(over) || board[land - 1]) continue;
			canJump = true;
			const nextPath = [...path, land];
			const nextCaptured = [...captured, over];
			if (!piece.king && rowCol(land).row === crownRow(piece.colour)) found.push(makeMove(nextPath, nextCaptured, true));
			else explore(land, nextPath, nextCaptured);
		}
		if (!canJump && captured.length > 0) found.push(makeMove(path, captured, false));
	}
	explore(from, [from], []);
	return found;
}
function stepsFrom(position, from) {
	const piece = pieceAt(position, from);
	const { row, col } = rowCol(from);
	const moves = [];
	for (const [dr, dc] of directions(piece)) {
		const to = squareAt(row + dr, col + dc);
		if (to === null || pieceAt(position, to)) continue;
		moves.push(makeMove([from, to], [], !piece.king && rowCol(to).row === crownRow(piece.colour)));
	}
	return moves;
}
function ownSquares(position) {
	const squares = [];
	for (let square = 1; square <= 32; square++) if (pieceAt(position, square)?.colour === position.turn) squares.push(square);
	return squares;
}
/**
* Every legal move for the side to move. If any jump is possible, only jumps are legal
* (captures are compulsory), but the player may pick whichever jump they like.
*/
function legalMoves(position) {
	const mine = ownSquares(position);
	const jumps = mine.flatMap((square) => jumpsFrom(position, square));
	if (jumps.length > 0) return jumps;
	return mine.flatMap((square) => stepsFrom(position, square));
}
/** Makes a move (assumed legal: get it from legalMoves). Returns the new position. */
function applyMove(position, move) {
	const board = [...position.board];
	const from = move.path[0];
	const to = move.path[move.path.length - 1];
	const piece = board[from - 1];
	board[from - 1] = null;
	for (const square of move.captures) board[square - 1] = null;
	board[to - 1] = {
		colour: piece.colour,
		king: piece.king || move.crowns
	};
	const quiet = move.captures.length === 0 && !move.crowns;
	return {
		board,
		turn: otherColour(position.turn),
		quietPlies: quiet ? position.quietPlies + 1 : 0
	};
}
/** Finds a legal move from its notation, e.g. "11-15" or "15x24x31". Null if it isn't legal here. */
function findMove(position, notation) {
	return legalMoves(position).find((move) => move.notation === notation) ?? null;
}
/** Has the game ended by the rules? */
function boardResult(position) {
	const winner = otherColour(position.turn);
	if (ownSquares(position).length === 0) return {
		ending: "no-pieces",
		winner
	};
	if (legalMoves(position).length === 0) return {
		ending: "no-moves",
		winner
	};
	if (position.quietPlies >= 80) return {
		ending: "forty-moves",
		winner: null
	};
	return null;
}
/**
* Replays a whole game from the starting position. Fails if any move is illegal, or if
* a move comes after the game has already ended.
*/
function replay(moves) {
	let position = startPosition();
	const played = [];
	for (let i = 0; i < moves.length; i++) {
		const move = boardResult(position) ? null : findMove(position, moves[i]);
		if (!move) return {
			ok: false,
			badMoveIndex: i
		};
		position = applyMove(position, move);
		played.push(move);
	}
	return {
		ok: true,
		position,
		played,
		result: boardResult(position)
	};
}
//#endregion
//#region shared/checkers/botGame.ts
/**
* Deciding the result of a checkers game against a bot. The website uses this to show the
* result straight away, and the save-bot-game server function runs the very same code
* before saving, so a student can't send in a pretend win.
*/
/** Checks the shape of a report that came from outside (e.g. the browser). */
function parseCheckersReport(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (!isBotLevelId(r.level)) return null;
	if (r.studentColour !== "red" && r.studentColour !== "white") return null;
	if (!isClaimedEnding(r.ending) || !isMoveList(r.moves)) return null;
	return {
		level: r.level,
		studentColour: r.studentColour,
		moves: r.moves,
		ending: r.ending
	};
}
function studentMoveCount(moves, studentColour) {
	return studentColour === "red" ? Math.ceil(moves.length / 2) : Math.floor(moves.length / 2);
}
function judgeCheckersGame(report) {
	if (report.moves.length > 1e3) return {
		ok: false,
		problem: "too many moves"
	};
	const replayed = replay(report.moves);
	if (!replayed.ok) return {
		ok: false,
		problem: `illegal move at ${replayed.badMoveIndex + 1}`
	};
	const studentMoves = studentMoveCount(report.moves, report.studentColour);
	const longEnough = studentMoves >= 10;
	if (replayed.result) {
		const { ending, winner } = replayed.result;
		return {
			ok: true,
			game: {
				outcome: winner === null ? "drawn" : winner === report.studentColour ? "won" : "lost",
				reason: ending,
				studentMoves,
				countsForPoints: longEnough
			}
		};
	}
	if (report.ending === "finished") return {
		ok: false,
		problem: "the game is not over"
	};
	return {
		ok: true,
		game: {
			outcome: "lost",
			reason: report.ending,
			studentMoves,
			countsForPoints: report.ending === "resigned" && longEnough
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
//#region supabase/functions/save-bot-game/handler.ts
/**
* The save-bot-game server function: the browser sends the moves of a finished chess,
* checkers, Wormholes & Black Holes or 101 game against bots, and this decides the result
* and saves it. For Wormholes & Black Holes and 101 it also hands out the stamped seed a
* game is played from (shared/space/save.ts explains how that works).
*
* It never trusts the browser's word for the result. It replays every move with the same
* rules code the website uses (chess.js for chess, shared/checkers for checkers), works
* out who won, and only then saves it. The bot's moves are checked for legality too; a
* determined student could still fake the bot's moves, which is why bot games will only
* ever earn small, capped points.
*/
async function handleSaveBotGame(request, services) {
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
	const body = await readJsonBody(request);
	const asked = body;
	if ((asked?.game === "space" || asked?.game === "101") && asked.start === true) {
		const seed = makeSeed(now(services), (services.randomHex ?? randomHex)(12));
		const stamp = await services.stamp((asked.game === "space" ? stampText$1 : stampText)(player, seed));
		if (!stamp) return reply(500, { error: "The game couldn't start." });
		return reply(200, {
			seed,
			stamp
		});
	}
	if (asked?.game === "space") return saveSpaceGame(player, body, services, reply);
	if (asked?.game === "101") return save101Game(player, body, services, reply);
	const checked = check(body);
	if (!checked) return reply(400, { error: "That game couldn't be read." });
	const { game: gameName, report, judged } = checked;
	if (!judged.ok) {
		console.warn(`save-bot-game: refused a game (${judged.problem})`);
		return reply(400, { error: "That game couldn't be checked." });
	}
	const { game } = judged;
	const saved = await services.record({
		player,
		game: gameName,
		bot_level: report.level,
		player_side: report.studentColour,
		moves: report.moves,
		result: game.outcome,
		reason: game.reason,
		player_moves: game.studentMoves,
		counts_for_points: game.countsForPoints
	});
	if (saved === "too-many") return reply(429, { error: TOO_MANY });
	if (saved !== "saved") return reply(500, { error: "The game couldn't be saved." });
	return reply(200, {
		result: game.outcome,
		reason: game.reason,
		countsForPoints: game.countsForPoints
	});
}
const TOO_MANY = "That's a lot of games today! Have a break and come back tomorrow.";
async function saveSpaceGame(player, body, services, reply) {
	const report = parseSpaceReport(body);
	if (!report) return reply(400, { error: "That game couldn't be read." });
	const expected = await services.stamp(stampText$1(player, report.seed));
	const problem = seedProblem(report.seed, now(services)) ?? (expected && sameText(expected, report.stamp) ? null : "bad stamp");
	const judged = problem ? {
		ok: false,
		problem
	} : judgeSpaceGame(report);
	if (!judged.ok) {
		console.warn(`save-bot-game: refused a space game (${judged.problem})`);
		return reply(400, { error: "That game couldn't be checked." });
	}
	const { game } = judged;
	const saved = await services.recordSpace({
		player,
		bot_level: report.level,
		player_side: game.playerSide,
		moves: report.actions,
		result: game.outcome,
		reason: game.reason,
		player_moves: game.studentTurns,
		counts_for_points: game.countsForPoints,
		space: {
			seed: report.seed,
			board: report.board,
			settings: report.settings,
			bots: report.bots,
			place: game.place,
			rockets: game.rockets,
			stats: game.stats
		}
	});
	if (saved === "too-many") return reply(429, { error: TOO_MANY });
	if (saved !== "saved") return reply(500, { error: "The game couldn't be saved." });
	return reply(200, {
		result: game.outcome,
		reason: game.reason,
		place: game.place,
		countsForPoints: game.countsForPoints
	});
}
async function save101Game(player, body, services, reply) {
	const report = parseCard101Report(body);
	if (!report) return reply(400, { error: "That game couldn't be read." });
	const expected = await services.stamp(stampText(player, report.seed));
	const problem = seedProblem(report.seed, now(services)) ?? (expected && sameText(expected, report.stamp) ? null : "bad stamp");
	const judged = problem ? {
		ok: false,
		problem
	} : judgeCard101Game(report);
	if (!judged.ok) {
		console.warn(`save-bot-game: refused a 101 game (${judged.problem})`);
		return reply(400, { error: "That game couldn't be checked." });
	}
	const { game } = judged;
	const saved = await services.record101({
		player,
		bot_level: report.level,
		player_side: "first",
		moves: report.actions,
		result: game.outcome,
		reason: game.reason,
		player_moves: game.studentTurns,
		counts_for_points: game.countsForPoints,
		card101: {
			seed: report.seed,
			settings: report.settings,
			bots: report.bots,
			place: game.place,
			players: game.players,
			rounds: game.rounds,
			total: game.total,
			stats: game.stats
		}
	});
	if (saved === "too-many") return reply(429, { error: TOO_MANY });
	if (saved !== "saved") return reply(500, { error: "The game couldn't be saved." });
	return reply(200, {
		result: game.outcome,
		reason: game.reason,
		place: game.place,
		countsForPoints: game.countsForPoints
	});
}
const now = (services) => Math.floor(services.nowSeconds?.() ?? Date.now() / 1e3);
function randomHex(bytes) {
	return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}
/** Compares two stamps without stopping at the first difference, so timing gives nothing away. */
function sameText(a, b) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
/**
* Reads and judges a report. Reports without a "game" are chess: that's what the website
* sent before checkers existed.
*/
function check(body) {
	const game = body?.game ?? "chess";
	if (game === "chess") {
		const report = parseReport(body);
		return report && {
			game: "chess",
			report,
			judged: judgeBotGame(report)
		};
	}
	if (game === "checkers") {
		const report = parseCheckersReport(body);
		return report && {
			game: "checkers",
			report,
			judged: judgeCheckersGame(report)
		};
	}
	return null;
}
//#endregion
//#region supabase/functions/save-bot-game/entry.ts
/** The server's own key. Supabase provides it automatically; it never leaves the server. */
function serverKey() {
	const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (legacy) return legacy;
	const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
	return keys.default ?? Object.values(keys)[0] ?? "";
}
const key = serverKey();
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", key, { auth: {
	persistSession: false,
	autoRefreshToken: false
} });
Deno.serve((request) => handleSaveBotGame(request, {
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async record(row) {
		const { error } = await admin.rpc("record_bot_game", row);
		if (!error) return "saved";
		if (error.code === "54000") return "too-many";
		console.error(`save-bot-game: database refused the game (${error.code})`);
		return "refused";
	},
	async recordSpace(row) {
		const { error } = await admin.rpc("record_space_bot_game", row);
		if (!error) return "saved";
		if (error.code === "54000") return "too-many";
		console.error(`save-bot-game: database refused a space game (${error.code})`);
		return "refused";
	},
	async record101(row) {
		const { error } = await admin.rpc("record_101_bot_game", row);
		if (!error) return "saved";
		if (error.code === "54000") return "too-many";
		console.error(`save-bot-game: database refused a 101 game (${error.code})`);
		return "refused";
	},
	stamp: stamper(key, "space-seed")
}));
//#endregion
