// GENERATED FILE: don't edit. Edit supabase/functions/space-game/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "space-game" function.

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
		add: [3, 4]
	},
	{
		levels: [5, 6],
		add: [6, 8]
	},
	{
		levels: [7, 8],
		add: [7, 9]
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
//#endregion
//#region shared/space/mathsSwitch.ts
const MATHS_SWITCHES = [
	"off",
	"choose",
	"on"
];
/** Reads the setting from the database. Anything unexpected counts as Off: nobody gets maths by accident. */
function parseMathsSwitch(value) {
	return MATHS_SWITCHES.includes(value) ? value : "off";
}
//#endregion
//#region shared/multiplayer.ts
/** Game codes use these: no vowels (so no rude words) and no lookalikes like O/0 or I/1. */
const CODE_ALPHABET = "CDFGHJKMNPQRTVWXY34679";
/** A random code, e.g. 'KM4TP'. `random` gives numbers from 0 up to (not including) 1. */
function makeCode(random = Math.random) {
	let code = "";
	for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(random() * 22)];
	return code;
}
/** Tidies up what a student typed: any case, spaces or dashes are fine. Null if it can't be a code. */
function normaliseCode(typed) {
	if (typeof typed !== "string" || typed.length > 20) return null;
	const code = typed.toUpperCase().replace(/[\s-]/g, "");
	if (code.length !== 5 || [...code].some((c) => !"CDFGHJKMNPQRTVWXY34679".includes(c))) return null;
	return code;
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
/**
* For games with no campaign (Wormholes & Black Holes): the campaign level a student's records
* say they're ready for. Each step whose facts are mostly secure moves them on one step, so a
* new student starts on ×2, ×5 and ×10. Tables the teacher has switched off are skipped.
*/
function readyLevel(stats, enabledTables = TABLES) {
	const byKey = new Map([...stats].map((s) => [s.key, s]));
	const enabled = new Set(enabledTables);
	for (let i = 0; i < CAMPAIGN_STEPS.length; i++) {
		const step = CAMPAIGN_STEPS[i];
		const upTo = step.upTo ?? 12;
		const keys = [...factsIn(step.add.filter((t) => enabled.has(t)))].filter((k) => parseFactKey(k).b <= upTo);
		if (keys.length === 0) continue;
		if (keys.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / keys.length < .7) return step.levels[0];
	}
	return CAMPAIGN_STEPS[CAMPAIGN_STEPS.length - 1].levels[0];
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
function weightedPick(keys, stats, random) {
	const weights = keys.map((k) => factWeight(stats.get(k)));
	let roll = random() * weights.reduce((a, b) => a + b, 0);
	for (let i = 0; i < keys.length; i++) {
		roll -= weights[i];
		if (roll < 0) return keys[i];
	}
	return keys[keys.length - 1];
}
/**
* Picks the next fact, and records that it was asked in `memory`. Returns null only when
* the teacher has switched every table off.
*/
function pickFact(ctx, stats, memory, random) {
	const pools = poolsFor(ctx);
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
			key: weightedPick(keys, stats, random),
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
//#region shared/maths/skillPacks/timesTables.ts
/**
* The times-tables skill pack: multiplication (7 × 8 = ?), missing factor (? × 8 = 56)
* and division (56 ÷ 8 = ?). All three count towards the same fact's mastery, because
* they're the same fact.
*/
/**
* Each kind of question, with its NZ Curriculum codes. PLACEHOLDERS: James fills these in
* from his curriculum alignment tool.
*/
const TIMES_TABLES_KINDS = {
	multiply: {
		label: "Multiplication facts",
		curriculumTags: ["TODO-multiplication-facts"]
	},
	"missing-factor": {
		label: "Missing factor",
		curriculumTags: ["TODO-missing-factor"]
	},
	divide: {
		label: "Division facts",
		curriculumTags: ["TODO-division-facts"]
	}
};
/**
* Works out a question from how it was shown (e.g. ['?', '×', '8', '=', '56']): its answer and
* the fact it belongs to. Null if it isn't a times-tables question this pack could ask. The
* server uses this to check answers it didn't see being given.
*/
function solveQuestion(parts) {
	if (!Array.isArray(parts) || parts.length !== 5 || parts[3] !== "=" || !parts.every((p) => typeof p === "string")) return null;
	const [a, op, b, , c] = parts;
	if (op !== "×" && op !== "÷" || parts.filter((p) => p === "?").length !== 1) return null;
	const num = (text) => /^\d{1,3}$/.test(text) ? Number(text) : NaN;
	const inTables = (n) => Number.isInteger(n) && n >= 1 && n <= 12;
	let x;
	let y;
	let answer;
	if (op === "×" && c === "?") {
		[x, y] = [num(a), num(b)];
		answer = x * y;
	} else if (op === "×" && a === "?") {
		y = num(b);
		x = answer = num(c) / y;
		if (num(c) !== x * y) return null;
	} else if (op === "×" && b === "?") {
		x = num(a);
		y = answer = num(c) / x;
		if (num(c) !== x * y) return null;
	} else if (op === "÷" && c === "?") {
		y = num(b);
		x = answer = num(a) / y;
	} else return null;
	if (!inTables(x) || !inTables(y)) return null;
	return {
		answer,
		key: factKey(x, y)
	};
}
const SPOKEN = {
	"×": "times",
	"÷": "divided by",
	"=": "equals",
	"?": "what"
};
function shuffle(items, random) {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
/** Wrong answers that look believable: near misses from the same or next-door facts. */
function choicesFor(x, y, answer, isFactor, random) {
	const near = isFactor ? [
		answer - 1,
		answer + 1,
		answer - 2,
		answer + 2,
		answer + 3
	].filter((n) => n >= 1 && n <= 12) : [
		(x + 1) * y,
		(x - 1) * y,
		x * (y + 1),
		x * (y - 1),
		answer + 1,
		answer - 1,
		answer + 10,
		answer - 10,
		x + y
	];
	const ok = (n) => n > 0 && n !== answer && (!isFactor || n <= 12);
	const wrong = shuffle([...new Set(near)].filter(ok), random).slice(0, 3);
	for (let gap = 1; wrong.length < 3; gap++) for (const n of [answer + gap, answer - gap]) if (ok(n) && !wrong.includes(n) && wrong.length < 3) wrong.push(n);
	return shuffle([answer, ...wrong], random);
}
var TimesTables = class {
	random;
	now;
	id = "times-tables";
	label = "Times tables";
	curriculumTags = Object.values(TIMES_TABLES_KINDS).flatMap((k) => k.curriculumTags);
	records = new Map();
	memory = newMemory();
	nextId = 1;
	listeners = new Set();
	constructor(saved = [], random = Math.random, now = Date.now) {
		this.random = random;
		this.now = now;
		for (const s of saved) this.records.set(s.key, s);
	}
	/** Hears every answer as it's recorded (for saving). Returns a function that stops listening. */
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
	nextQuestion(ctx) {
		const picked = pickFact(ctx, this.records, this.memory, this.random);
		if (!picked) return null;
		const fact = parseFactKey(picked.key);
		const [x, y] = this.random() < .5 ? [fact.a, fact.b] : [fact.b, fact.a];
		const product = x * y;
		const missingOn = ctx.missingFactor ?? (ctx.level ?? 1) >= 4;
		const roll = this.random();
		const kind = ctx.division && roll < .3 ? "divide" : missingOn && roll >= .7 ? "missing-factor" : "multiply";
		let parts;
		let answer;
		if (kind === "divide") {
			parts = [
				String(product),
				"÷",
				String(y),
				"=",
				"?"
			];
			answer = x;
		} else if (kind === "missing-factor") {
			const blankFirst = this.random() < .5;
			parts = blankFirst ? [
				"?",
				"×",
				String(y),
				"=",
				String(product)
			] : [
				String(x),
				"×",
				"?",
				"=",
				String(product)
			];
			answer = blankFirst ? x : y;
		} else {
			parts = [
				String(x),
				"×",
				String(y),
				"=",
				"?"
			];
			answer = product;
		}
		return {
			id: this.nextId++,
			skill: this.id,
			factKey: picked.key,
			kind,
			parts,
			spoken: parts.map((p) => SPOKEN[p] ?? p).join(" ") + "?",
			answer,
			choices: ctx.multipleChoice ? choicesFor(x, y, answer, kind !== "multiply", this.random) : void 0,
			band: picked.band
		};
	}
	recordAnswer(q, answer, ms) {
		const correct = answer === q.answer;
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
			fact: q.parts.map((p) => p === "?" ? String(q.answer) : p).join(" "),
			boxBefore: before.box,
			boxAfter: after.box
		};
	}
};
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
function newGame(board, settings, players) {
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
function play(previous, action, dice) {
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
/** True if the rocket whose turn it is may send its charge answer now (maths on, after its first turn, before rolling, once). */
function canCharge(s) {
	return s.settings.maths && s.phase === "ready" && !s.turnInfo.rolled && !s.turnInfo.chargeDone && s.rockets[s.turn].hasPlayed === true;
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
	if (t.mathsCharge) {
		steps += 1;
		changes.push("maths-charge");
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
			case "charge":
				if (!canCharge(s)) throw new SpaceRuleError("There's no charge question to answer now.");
				s.turnInfo.chargeDone = true;
				if (action.right) s.turnInfo.mathsCharge = true;
				return this.emit({
					kind: "charge",
					seat: this.seat,
					right: action.right
				});
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
		t.mathsCharge = false;
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
					if (s.settings.maths) return this.ask({
						kind: "question",
						square: n,
						moment: "black-hole"
					});
					this.fallIn(n, square.to);
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
	/** Falls into the black hole at `n`: half way with an Escape Pod (used up), else all the way. */
	fallIn(n, to) {
		const me = this.me;
		const pod = me.items.indexOf("escape-pod");
		if (pod >= 0) {
			me.items.splice(pod, 1);
			me.position = n - halfFall(n, to);
			this.emit({
				kind: "black-hole",
				seat: this.seat,
				from: n,
				to: me.position,
				escapePod: true
			});
		} else {
			me.position = to;
			this.emit({
				kind: "black-hole",
				seat: this.seat,
				from: n,
				to
			});
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
				const right = option === 1;
				const moment = pending.moment ?? "wormhole";
				if (moment === "black-hole") {
					const square = s.board.squares[pending.square];
					if (right) {
						me.position = pending.square - halfFall(pending.square, square.to);
						this.emit({
							kind: "question",
							seat,
							correct: true,
							from: pending.square,
							to: me.position,
							moment
						});
					} else {
						this.emit({
							kind: "question",
							seat,
							correct: false,
							from: pending.square,
							to: pending.square,
							moment
						});
						this.fallIn(pending.square, square.to);
					}
					this.land();
					return this.afterMove();
				}
				const square = s.board.squares[pending.square];
				const bonus = square.to + 3;
				const to = right && bonus < s.board.size && !isLink(s.board.squares[bonus]) ? bonus : square.to;
				me.position = to;
				this.emit({
					kind: "question",
					seat,
					correct: right,
					from: pending.square,
					to,
					...pending.moment ? { moment } : {}
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
		if (s.settings.maths) this.me.hasPlayed = true;
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
/** How far an Escape Pod (or a right answer) saves you from a black hole at `n` going to `to`. */
function halfFall(n, to) {
	return Math.max(1, Math.floor((n - to) / 2));
}
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
//#region shared/space/mathsQuestion.ts
/**
* Which question Mission Control asks next: the same choice in the bot game (the browser) and
* with classmates (the server), from a student's records at the step they're ready for.
*/
function pickSpaceQuestion(pack, settings = {}) {
	return pack.nextQuestion({
		level: readyLevel(pack.stats(), settings.enabledTables),
		enabledTables: settings.enabledTables,
		division: settings.division,
		missingFactor: settings.missingFactor,
		multipleChoice: settings.multipleChoice
	}) ?? pack.nextQuestion({ level: 1 });
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
//#region shared/space/bot.ts
/** How often each bot answers Mission Control's questions right (so maths doesn't just beat bots). */
const BOT_MATHS = {
	"very-easy": .6,
	easy: .75,
	medium: .9
};
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
	if (canCharge(s)) return {
		kind: "charge",
		right: random() < BOT_MATHS[level]
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
	if (pending.kind === "question") return random() < BOT_MATHS[level] ? 1 : 0;
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
	}
}
//#endregion
//#region shared/space/save.ts
/** "roll", "charge:1" (right) or "charge:0", "choose:1", "use:booster", "use:tractor-beam@2", "use:navigator=6". */
function encodeAction(action) {
	switch (action.kind) {
		case "roll": return "roll";
		case "charge": return action.right ? "charge:1" : "charge:0";
		case "timeout": return "timeout";
		case "choose": return `choose:${action.option}`;
		case "use-item": return `use:${action.item}${action.target !== void 0 ? `@${action.target}` : ""}${action.value !== void 0 ? `=${action.value}` : ""}`;
	}
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
	if (!isBool(s.maths)) return null;
	return {
		mode: s.mode,
		finish: s.finish,
		rollAgainOnSix: s.rollAgainOnSix,
		cosmicEvents: s.cosmicEvents,
		maths: s.maths
	};
}
//#endregion
//#region shared/space/live.ts
/** Bots in empty seats, and autopilot, play as Pilots. */
const LIVE_BOT_LEVEL = "easy";
/** The only reactions there are. The server refuses anything else. */
const REACTIONS = [
	"🚀",
	"👏",
	"😮",
	"🎉",
	"😂",
	"👍"
];
function isReaction(value) {
	return REACTIONS.includes(value);
}
const newStats = () => ({
	wormholes: 0,
	blocks: 0,
	stars: [],
	docked: false,
	turns: 0,
	mathsRight: 0,
	boosts: 0,
	escapes: 0
});
/**
* Starts a game. `entries` is who sits where, in turn order: a player's ID, or null for a bot.
* The caller shuffles them first.
*/
function startLive(setup, entries) {
	if (entries.length < 2 || entries.length > 4) throw new Error("A game needs 2 to 4 rockets.");
	const { state, events } = newGame(boardFor(setup.board), setup.settings, entries.length);
	return {
		game: {
			state,
			seats: entries.map((who) => ({
				bot: who === null,
				autopilot: false,
				left: false,
				timeouts: 0,
				stats: newStats()
			}))
		},
		events
	};
}
/** Starts a game and flies any bots before the first student's turn. */
function launchLive(setup, entries, dice, random) {
	const { game, events } = startLive(setup, entries);
	const out = {
		game,
		events,
		actions: [],
		everyoneLeft: false
	};
	flyBots(game, dice, random, out);
	return out;
}
/** True if nobody needs to tap anything for this seat: a bot or autopilot flies it. */
const flownByBot = (game, seat) => game.seats[seat].bot || game.seats[seat].autopilot;
function addStats(game, actor, before, after, events) {
	for (const event of events) {
		if (!("seat" in event)) continue;
		const stats = game.seats[event.seat]?.stats;
		if (!stats) continue;
		if (event.kind === "wormhole") stats.wormholes++;
		else if (event.kind === "question") {
			if ((event.moment ?? "wormhole") === "wormhole") stats.wormholes++;
			if (event.correct) {
				stats.mathsRight = (stats.mathsRight ?? 0) + 1;
				if (event.moment === "black-hole") stats.escapes = (stats.escapes ?? 0) + 1;
				else stats.boosts = (stats.boosts ?? 0) + 1;
			}
		} else if (event.kind === "charge") {
			if (event.right) stats.mathsRight = (stats.mathsRight ?? 0) + 1;
		} else if (event.kind === "force-field") stats.blocks++;
		else if (event.kind === "docked") stats.docked = true;
		else if (event.kind === "star" && !stats.stars.includes(event.star)) stats.stars = STAR_KINDS.filter((k) => k === event.star || stats.stars.includes(k));
	}
	if (after.turnsTaken > before.turnsTaken || after.phase === "over" && before.phase !== "over") game.seats[actor].stats.turns++;
}
/** Plays one action for the seat whose turn it is, keeping the seats' stats. */
function step(game, action, dice, by, out) {
	const seat = game.state.turn;
	const before = game.state;
	const { state, events } = play(before, action, dice);
	game.state = state;
	addStats(game, seat, before, state, events);
	out.events.push(...events);
	out.actions.push({
		seat,
		action: encodeAction(action),
		by
	});
	applyCharge(game, dice, out);
}
/** A student with a right answer waiting gets their +1 as soon as they can use it (their turn, before rolling). */
function applyCharge(game, dice, out) {
	const info = game.seats[game.state.turn];
	if (!info?.charged || !canCharge(game.state)) return;
	info.charged = false;
	const seat = game.state.turn;
	const action = {
		kind: "charge",
		right: true
	};
	const before = game.state;
	const { state, events } = play(before, action, dice);
	game.state = state;
	addStats(game, seat, before, state, events);
	out.events.push(...events);
	out.actions.push({
		seat,
		action: encodeAction(action),
		by: "player"
	});
}
/** Most bot actions one request plays (3 bots × a long turn each is about 20). */
const MAX_BOT_ACTIONS = 200;
/** True while at least one student is still flying their own rocket. */
const someoneFlying = (game) => game.seats.some((s) => !s.bot && !s.autopilot);
/** Flies bots and autopilot rockets until a student has to act, or the game ends. */
function flyBots(game, dice, random, out) {
	if (!someoneFlying(game)) {
		out.everyoneLeft = true;
		return;
	}
	for (let n = 0; game.state.phase !== "over" && flownByBot(game, game.state.turn); n++) {
		if (n >= MAX_BOT_ACTIONS) throw new Error("Bots never finished their turns");
		const seat = game.state.turn;
		step(game, botAction(game.state, LIVE_BOT_LEVEL, random), dice, game.seats[seat].bot ? "bot" : "autopilot", out);
	}
}
/** A deep copy, so a refused action never changes the game it was given. */
const copyGame = (game) => structuredClone(game);
/**
* A student plays an action on their own turn. Throws SpaceRuleError (with a message for
* the student) if the rules don't allow it. Bots and autopilot then play until it's a
* student's turn again.
*/
function playerAction(previous, action, dice, random) {
	const out = {
		game: copyGame(previous),
		events: [],
		actions: [],
		everyoneLeft: false
	};
	const { game } = out;
	if (action.kind === "timeout") throw new Error("Time-outs come from the clock, not a player");
	step(game, action, dice, "player", out);
	const actor = previous.state.turn;
	game.seats[actor].timeouts = 0;
	flyBots(game, dice, random, out);
	return out;
}
/** The clock ran out for the seat whose turn it is. */
function timeOut(previous, dice, random) {
	const out = {
		game: copyGame(previous),
		events: [],
		actions: [],
		everyoneLeft: false
	};
	const { game } = out;
	const seat = game.state.turn;
	step(game, { kind: "timeout" }, dice, "timeout", out);
	const info = game.seats[seat];
	info.timeouts++;
	if (info.timeouts >= 3 && !info.bot) {
		info.autopilot = true;
		info.left = true;
	}
	flyBots(game, dice, random, out);
	return out;
}
/**
* Puts seats on autopilot (they left, were hidden by the teacher, or were deleted) and flies
* them if it's their turn. Returns null if nothing changed.
*/
function autopilotSeats(previous, seats, dice, random) {
	const fresh = seats.filter((s) => previous.seats[s] && !previous.seats[s].bot && !previous.seats[s].autopilot);
	if (fresh.length === 0 || previous.state.phase === "over") return null;
	const out = {
		game: copyGame(previous),
		events: [],
		actions: [],
		everyoneLeft: false
	};
	for (const s of fresh) {
		out.game.seats[s].autopilot = true;
		out.game.seats[s].left = true;
	}
	flyBots(out.game, dice, random, out);
	return out;
}
/** A student who's back takes the controls from autopilot. It still counts as left for them. */
function takeControls(previous, seat) {
	const game = copyGame(previous);
	game.seats[seat].autopilot = false;
	game.seats[seat].timeouts = 0;
	return game;
}
/**
* Which seats earn points: the game must have ended properly (docked or out of fuel), the
* seat must be a student who didn't leave, with at least 5 turns, and at least 2 students
* must have played it to the end.
*/
function seatsThatCount(game, players) {
	const over = game.state.phase === "over";
	const stayed = game.seats.map((s, i) => !s.bot && !s.left && players[i] !== null && players[i] !== void 0);
	const enough = stayed.filter(Boolean).length >= 2;
	return game.seats.map((s, i) => over && enough && stayed[i] && s.stats.turns >= 5);
}
/** Roughly how long the screen takes to show these events at Normal speed, in milliseconds. */
function animationMs(events) {
	let ms = 0;
	let steps = 0;
	for (const e of events) switch (e.kind) {
		case "dice":
			ms += 850;
			break;
		case "roll":
			steps = e.steps;
			ms += e.changes.length > 0 ? 700 : 0;
			break;
		case "move":
			ms += e.cause === "roll" || e.cause === "bounce" ? 170 * Math.max(steps, Math.abs(e.to - e.from)) : 710;
			break;
		case "wormhole":
		case "black-hole":
			ms += 1300;
			break;
		case "gate":
		case "mystery":
		case "comet":
			ms += 950;
			break;
		case "item-gained":
			ms += 900;
			break;
		case "item-used":
			ms += 800;
			break;
		case "force-field":
			ms += 900;
			break;
		case "cosmic":
			ms += 1800;
			break;
		case "fuel-warning":
			ms += 1500;
			break;
		case "docked":
			ms += 1e3;
			break;
		case "turn-start":
			ms += 250;
			break;
		case "round-start":
		case "game-over":
		case "choice":
		case "timeout": break;
		default: ms += 450;
	}
	return ms;
}
/**
* When the clock runs out for whoever's turn it is: 30 seconds (15 for a choice) after the
* screens have finished showing what just happened. Slower screens (Relaxed speed) get a
* bit more. Null when the game is over.
*/
function deadlineAfter(game, events, nowMs) {
	if (game.state.phase === "over") return null;
	const base = game.state.phase === "choice" && game.state.pending?.kind === "question" ? 20 : game.state.phase === "choice" ? 15 : 30;
	const animation = Math.min(25e3, animationMs(events) * 1.5);
	return nowMs + base * 1e3 + Math.ceil(animation);
}
/** Checks a setup from outside (the browser). Null if it isn't one. */
function parseLiveSetup(input) {
	if (typeof input !== "object" || input === null) return null;
	const s = input;
	const board = parseBoard(s.board);
	const settings = parseSettings(s.settings);
	return board && settings ? {
		board,
		settings
	} : null;
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
//#endregion
//#region supabase/functions/space-game/handler.ts
/**
* The space-game server function: the referee for Wormholes & Black Holes with classmates.
*
* The browser only ever asks: "roll", "use my Booster", "jump through the gate", "join the
* game with this code". This works out who's asking from their sign-in token (never from the
* request), rolls the dice itself with secure randomness, runs the shared rules engine
* (shared/space/live.ts), flies any bots and autopilot rockets, and saves the new state
* "only if the version is still N", so a double tap can't roll twice.
*
* Bot games don't come here: they're played in the browser and saved by save-bot-game.
*/
const WAITING_GAME_MS = 6e5;
/** What students see. Friendly, and nothing technical. */
const MESSAGES = {
	"sign-in": [401, "Please sign in again."],
	"bad-request": [400, "Something went wrong. Please try again."],
	paused: [403, "Your teacher has paused games against friends for now."],
	hidden: [403, "Playing friends isn’t available for you right now. Ask your teacher."],
	"not-found": [404, "We couldn’t find a game with that code. Check it and try again."],
	"not-yours": [403, "That isn’t your game."],
	"not-started": [409, "The host hasn’t launched yet."],
	"not-your-turn": [409, "It’s not your turn yet."],
	autopilot: [409, "Autopilot is flying your rocket. Tap “Take the controls” first."],
	"not-host": [403, "Only the person who started the game can do that."],
	"need-players": [409, "You need at least 2 players to launch. Share the code!"],
	illegal: [400, "You can’t do that right now."],
	over: [409, "This game has already finished."],
	changed: [409, "The game changed just then. Have another look."],
	"too-many": [429, "Slow down a little! Try again in a minute."],
	"too-many-codes": [429, "That’s a lot of codes. Wait a minute, then try again."],
	"not-yet": [409, "There’s still time on the clock."],
	full: [409, "That game is full, or it has already launched."],
	expired: [410, "That game stopped waiting. Ask your friend to make a new one."],
	"rematch-gone": [409, "That rematch has already launched or stopped waiting."],
	"reactions-off": [403, "Reactions are switched off."],
	"maths-off": [403, "Your teacher has switched Mission Control maths off."],
	"reaction-wait": [429, "Wait a few seconds before sending another."],
	"reaction-limit": [429, "That’s all the reactions for this game."],
	failed: [500, "Something went wrong. Please try again."]
};
var Refused = class {
	problem;
	extra;
	constructor(problem, extra = {}) {
		this.problem = problem;
		this.extra = extra;
	}
};
/** Makes the request handler. Keep one per server, so the rate limits are remembered. */
function spaceGameHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handle(request) {
		const cors = corsHeaders(request.headers.get("Origin"));
		const reply = (status, body) => new Response(JSON.stringify(body), {
			status,
			headers: {
				...cors,
				"Content-Type": "application/json"
			}
		});
		const refuse = (refused) => {
			const [status, error] = MESSAGES[refused.problem];
			return reply(status, {
				error,
				problem: refused.problem,
				...refused.extra
			});
		};
		if (request.method === "OPTIONS") return new Response(null, {
			status: 204,
			headers: cors
		});
		if (request.method !== "POST") return reply(405, { error: "Not allowed." });
		const token = bearerToken(request);
		const me = token ? await services.userIdFor(token) : null;
		if (!me) return refuse(new Refused("sign-in"));
		if (!limiter.allow(me, 60)) return refuse(new Refused("too-many"));
		const parsed = await readJsonBody(request);
		const body = typeof parsed === "object" && parsed !== null ? parsed : null;
		const action = ACTIONS[String(body?.action)];
		if (!body || !action) return refuse(new Refused("bad-request"));
		try {
			const result = await action({
				services,
				limiter,
				me,
				body
			});
			return reply(200, result instanceof WithGame ? {
				game: result.game,
				...result.extra
			} : { game: result });
		} catch (error) {
			if (error instanceof Refused) {
				if (![
					"not-your-turn",
					"changed",
					"not-yet",
					"not-found",
					"illegal",
					"reaction-wait"
				].includes(error.problem)) console.warn(`space-game: refused ${String(body.action)} (${error.problem})`);
				return refuse(error);
			}
			console.error(`space-game: ${String(body.action)} failed${error instanceof Error ? ` (${error.message.slice(0, 80)})` : ""}`);
			return refuse(new Refused("failed"));
		}
	};
}
/** A reply that carries more than the game: for the student who asked only (e.g. their question). */
var WithGame = class {
	game;
	extra;
	constructor(game, extra) {
		this.game = game;
		this.extra = extra;
	}
};
const ACTIONS = {
	create,
	join,
	cancel: leave,
	leave,
	launch,
	roll: (c) => playerTurn(c, { kind: "roll" }),
	"use-item": (c) => playerTurn(c, itemAction(c.body)),
	choose: (c) => playerTurn(c, chooseAction(c.body)),
	question: askQuestion,
	answer: answerQuestion,
	"times-up": timesUp,
	"take-controls": takeTheControls,
	rematch,
	react
};
const seatsOf = (g) => [
	g.seat1,
	g.seat2,
	g.seat3,
	g.seat4
];
const seatPatch = (seats) => ({
	seat1: seats[0] ?? null,
	seat2: seats[1] ?? null,
	seat3: seats[2] ?? null,
	seat4: seats[3] ?? null
});
const iso = (ms) => new Date(ms).toISOString();
async function mustBeAllowed(services, player, forPlaying, others = []) {
	const status = await services.playerStatus(player, others);
	if (!status?.school) throw new Refused("sign-in");
	if (status.hidden) throw new Refused("hidden");
	if (forPlaying && !status.multiplayerEnabled) throw new Refused("paused");
	return status;
}
async function loadMyGame(services, me, id) {
	if (typeof id !== "string" || id.length > 64) throw new Refused("bad-request");
	const game = await services.loadGame(id);
	const seat = game ? seatsOf(game).indexOf(me) : -1;
	if (!game || seat < 0) throw new Refused("not-yours");
	return {
		game,
		seat
	};
}
function mustBePlaying(game) {
	if (game.status === "waiting") throw new Refused("not-started");
	if (game.status !== "playing" || !game.state || !game.seat_info) throw new Refused("over");
}
const liveGame = (row) => ({
	state: row.state,
	seats: row.seat_info
});
async function save(services, game, patch) {
	const saved = await services.updateGame(game.id, game.version, {
		...patch,
		version: game.version + 1
	});
	if (!saved) throw new Refused("changed");
	return saved;
}
/** The changes to save after the engine (and any bots) have played. */
function afterPlay(services, players, played) {
	const now = services.now();
	const { game } = played;
	const patch = {
		state: game.state,
		seat_info: game.seats,
		events: played.events,
		actions: played.actions,
		last_action_at: iso(now),
		turn_deadline: null
	};
	if (played.everyoneLeft) return {
		...patch,
		status: "finished",
		ending: "abandoned",
		counts: game.seats.map(() => false),
		finished_at: iso(now)
	};
	if (game.state.phase === "over") return {
		...patch,
		status: "finished",
		ending: game.state.ending,
		places: game.state.places ?? placesFor(game.state),
		counts: seatsThatCount(game, players.slice(0, game.seats.length)),
		finished_at: iso(now)
	};
	const deadline = deadlineAfter(game, played.events, now);
	return {
		...patch,
		turn_deadline: deadline === null ? null : iso(deadline)
	};
}
/**
* Students the teacher has hidden (or who have been deleted) can't keep playing: autopilot
* flies their rockets from now on. Returns the saved game if anything changed.
*/
async function autopilotGone(services, row, status) {
	const seats = seatsOf(row);
	const info = row.seat_info;
	const gone = info.map((_, i) => i).filter((i) => !info[i].bot && !info[i].autopilot && (seats[i] === null || status.gone.includes(seats[i])));
	if (gone.length === 0) return null;
	const played = autopilotSeats(liveGame(row), gone, diceFrom(services.random), services.random);
	if (!played) return null;
	return save(services, row, afterPlay(services, seatsOf(row), played));
}
const otherPlayers = (row, me) => seatsOf(row).filter((p) => p !== null && p !== me);
async function create({ services, me, body }) {
	const setup = parseLiveSetup(body.setup);
	if (!setup) throw new Refused("bad-request");
	if ((await mustBeAllowed(services, me, true)).createdLastHour >= 20) throw new Refused("too-many");
	const mathsSwitch = await services.mathsSwitch();
	if (mathsSwitch === "off" && setup.settings.maths) throw new Refused("maths-off");
	return newWaitingGame(services, me, withMathsSwitch(setup, mathsSwitch), body.lobby === true);
}
/** The setup as the teacher's switch allows it. */
const withMathsSwitch = (setup, mathsSwitch) => mathsSwitch === "choose" || setup.settings.maths === (mathsSwitch === "on") ? setup : {
	...setup,
	settings: {
		...setup.settings,
		maths: mathsSwitch === "on"
	}
};
async function newWaitingGame(services, me, setup, inLobby) {
	const waiting = await services.findWaitingHostedBy(me);
	if (waiting) await services.updateGame(waiting.id, waiting.version, {
		status: "cancelled",
		version: waiting.version + 1,
		events: [],
		actions: []
	});
	for (let tries = 0; tries < 5; tries++) {
		const code = makeCode(() => services.random());
		if (await services.friendCodeTaken(code)) continue;
		const inserted = await services.insertGame({
			code,
			in_lobby: inLobby,
			host: me,
			seat1: me,
			status: "waiting",
			setup,
			expires_at: iso(services.now() + WAITING_GAME_MS)
		});
		if (inserted === "code-taken") continue;
		if (inserted === "already-waiting") throw new Refused("changed");
		if (inserted === "failed") throw new Refused("failed");
		return inserted;
	}
	throw new Refused("failed");
}
async function join({ services, limiter, me, body }) {
	let game;
	if (body.code !== void 0) {
		if (!limiter.allow(`code:${me}`, 10)) throw new Refused("too-many-codes");
		const code = normaliseCode(body.code);
		game = code ? await services.findWaitingByCode(code) : null;
		if (!game) throw new Refused("not-found");
	} else {
		if (typeof body.gameId !== "string" || body.gameId.length > 64) throw new Refused("bad-request");
		game = await services.loadGame(body.gameId);
		if (!game || !game.in_lobby) throw new Refused("not-found");
	}
	await mustBeAllowed(services, me, true);
	return joinWaiting(services, me, game);
}
/** Takes the first empty seat in a waiting game. Already in it? Then that's fine. */
async function joinWaiting(services, me, first) {
	let game = first;
	for (let tries = 0; tries < 4 && game; tries++) {
		if (seatsOf(game).includes(me)) return game;
		if (game.status === "playing" || game.status === "finished") throw new Refused("full");
		if (game.status !== "waiting" || Date.parse(game.expires_at) <= services.now()) throw new Refused("expired");
		const host = game.host && await services.playerStatus(game.host);
		if (!host || !host.school || host.hidden) throw new Refused("expired");
		const seats = seatsOf(game);
		const empty = seats.indexOf(null);
		if (empty < 0) throw new Refused("full");
		seats[empty] = me;
		const joined = await services.updateGame(game.id, game.version, {
			...seatPatch(seats),
			version: game.version + 1
		});
		if (joined) return joined;
		game = await services.loadGame(game.id);
	}
	throw new Refused("changed");
}
async function leave({ services, me, body }) {
	const { game, seat } = await loadMyGame(services, me, body.gameId);
	if (game.status === "waiting") {
		if (game.host === me) {
			const cancelled = await services.updateGame(game.id, game.version, {
				status: "cancelled",
				version: game.version + 1
			});
			if (cancelled) return cancelled;
			throw new Refused("changed");
		}
		const seats = seatsOf(game).filter((p) => p !== me);
		return save(services, game, seatPatch(seats));
	}
	if (game.status !== "playing" || !game.seat_info) return game;
	const played = autopilotSeats(liveGame(game), [seat], diceFrom(services.random), services.random);
	if (!played) return game;
	return save(services, game, afterPlay(services, seatsOf(game), played));
}
async function launch({ services, me, body }) {
	const { game } = await loadMyGame(services, me, body.gameId);
	if (game.host !== me) throw new Refused("not-host");
	if (game.status === "playing") return game;
	if (game.status !== "waiting") throw new Refused("over");
	const status = await mustBeAllowed(services, me, true, otherPlayers(game, me));
	const students = seatsOf(game).filter((p) => p !== null && !status.gone.includes(p));
	const bots = body.bots ?? 0;
	if (typeof bots !== "number" || !Number.isInteger(bots) || bots < 0 || bots > 4 - students.length) throw new Refused("bad-request");
	if (students.length < 2) throw new Refused("need-players");
	const dice = diceFrom(services.random);
	const entries = shuffled(dice, [...students, ...Array.from({ length: bots }, () => null)]);
	const setup = withMathsSwitch(game.setup, await services.mathsSwitch());
	const played = launchLive(setup, entries, dice, services.random);
	return save(services, game, {
		...setup === game.setup ? {} : { setup },
		...seatPatch(entries),
		rockets: entries.length,
		status: "playing",
		started_at: iso(services.now()),
		...afterPlay(services, entries, played)
	});
}
function itemAction(body) {
	if (!isItemKind(body.item)) return null;
	const target = body.target;
	const value = body.value;
	if (target !== void 0 && !(Number.isInteger(target) && target >= 0 && target < 4)) return null;
	if (value !== void 0 && !(Number.isInteger(value) && value >= 1 && value <= 6)) return null;
	return {
		kind: "use-item",
		item: body.item,
		...target !== void 0 ? { target } : {},
		...value !== void 0 ? { value } : {}
	};
}
function chooseAction(body) {
	const option = body.option;
	return Number.isInteger(option) && option >= 0 && option <= 3 ? {
		kind: "choose",
		option
	} : null;
}
async function playerTurn({ services, me, body }, action) {
	if (!action) throw new Refused("bad-request");
	const { game, seat } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	const status = await mustBeAllowed(services, me, true, otherPlayers(game, me));
	if (body.version !== game.version) throw new Refused("changed");
	if (await autopilotGone(services, game, status)) throw new Refused("changed");
	if (game.state.turn !== seat) throw new Refused("not-your-turn");
	if (game.seat_info[seat].autopilot) throw new Refused("autopilot");
	if (action.kind === "choose" && game.state.phase === "choice" && game.state.pending?.kind === "question") throw new Refused("illegal", { error: "Type your answer to carry on." });
	let played;
	try {
		played = playerAction(liveGame(game), action, diceFrom(services.random), services.random);
	} catch (error) {
		if (error instanceof SpaceRuleError) throw new Refused("illegal", { error: error.message });
		throw error;
	}
	return save(services, game, afterPlay(services, seatsOf(game), played));
}
/** What a student sees of a question: everything but the answer. */
function publicQuestion(q) {
	const { id, skill, kind, parts, spoken, choices } = q;
	return {
		id,
		skill,
		kind,
		parts,
		spoken,
		...choices ? { choices } : {}
	};
}
const isKind = (value) => value === "moment" || value === "charge";
/** Everything that must be true for this student to be asked (or to answer) a question of this kind now. */
function questionStamp(game, seat, kind, body) {
	if (!game.setup.settings.maths) throw new Refused("illegal", { error: "Mission Control maths is off in this game." });
	const info = game.seat_info[seat];
	if (info.autopilot) throw new Refused("autopilot");
	const s = game.state;
	if (kind === "moment") {
		if (body.version !== game.version) throw new Refused("changed");
		if (s.turn !== seat) throw new Refused("not-your-turn");
		if (s.phase !== "choice" || s.pending?.kind !== "question") throw new Refused("illegal");
		return game.version;
	}
	if (!s.rockets[seat].hasPlayed) throw new Refused("illegal", { error: "Mission Control asks after your first turn." });
	if (s.turn === seat && s.turnInfo.rolled) throw new Refused("not-yet");
	return info.stats.turns;
}
/** A student asks for their question (it's picked from their records and kept, so a reload shows the same one). */
async function askQuestion({ services, me, body }) {
	if (!isKind(body.kind)) throw new Refused("bad-request");
	const { game, seat } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	await mustBeAllowed(services, me, true, otherPlayers(game, me));
	const stamp = questionStamp(game, seat, body.kind, body);
	const stored = await services.loadQuestion(game.id, seat, body.kind);
	if (stored && stored.stamp === stamp) return new WithGame(game, stored.answered ? { done: true } : { question: publicQuestion(stored.question) });
	const context = await services.loadMathsContext(me);
	if (!context) throw new Refused("failed");
	const question = pickSpaceQuestion(new TimesTables(context.facts, services.random), context.settings);
	if (!question) throw new Refused("failed");
	await services.saveQuestion(game.id, seat, body.kind, stamp, question);
	return new WithGame(game, { question: publicQuestion(question) });
}
/** The student's typed answer, marked here. */
async function answerQuestion({ services, me, body }) {
	const typed = body.answer;
	if (!isKind(body.kind) || !Number.isInteger(typed) || typed < 0 || typed > 1e3) throw new Refused("bad-request");
	const { game, seat } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	await mustBeAllowed(services, me, true, otherPlayers(game, me));
	const kind = body.kind;
	const stamp = questionStamp(game, seat, kind, body);
	const stored = await services.loadQuestion(game.id, seat, kind);
	if (!stored || stored.stamp !== stamp) throw new Refused("changed");
	if (stored.answered) throw new Refused("illegal", { error: "You’ve already answered that one." });
	const solved = solveQuestion(stored.question.parts);
	if (!solved) throw new Refused("failed");
	const right = typed === solved.answer;
	const now = services.now();
	const claimed = typeof body.ms === "number" && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : Infinity;
	const ms = Math.round(Math.min(claimed, now - stored.askedAt));
	const answer = {
		key: solved.key,
		correct: right,
		ms,
		at: now
	};
	const once = `${game.id}:${seat}:${kind}:${stamp}`;
	const reply = {
		right,
		answer: solved.answer
	};
	if (kind === "moment") {
		let played;
		try {
			played = playerAction(liveGame(game), {
				kind: "choose",
				option: right ? 1 : 0
			}, diceFrom(services.random), services.random);
		} catch (error) {
			if (error instanceof SpaceRuleError) throw new Refused("illegal", { error: error.message });
			throw error;
		}
		const saved = await save(services, game, afterPlay(services, seatsOf(game), played));
		await services.recordAnswer(me, once, answer);
		await services.dropQuestion(game.id, seat, kind);
		return new WithGame(saved, reply);
	}
	if (!await services.claimQuestion(game.id, seat, kind)) throw new Refused("illegal", { error: "You’ve already answered that one." });
	await services.recordAnswer(me, once, answer);
	if (!right) return new WithGame(game, reply);
	let current = game;
	for (let tries = 0; tries < 4 && current; tries++) {
		const next = chargeRight(services, current, seat);
		if (next === "nothing") return new WithGame(current, reply);
		const saved = await services.updateGame(current.id, current.version, {
			...next,
			version: current.version + 1
		});
		if (saved) return new WithGame(saved, reply);
		current = await services.loadGame(current.id);
		if (!current || current.status !== "playing" || !current.state || !current.seat_info) return new WithGame(game, reply);
	}
	return new WithGame(current ?? game, reply);
}
/** What to save for a right charge answer: the +1 now if it's their turn and they haven't rolled, else keep it for their next turn. */
function chargeRight(services, game, seat) {
	const s = game.state;
	if (s.turn !== seat) {
		const seats = structuredClone(game.seat_info);
		seats[seat].charged = true;
		return {
			seat_info: seats,
			events: [],
			actions: []
		};
	}
	if (!canCharge(s)) return "nothing";
	const played = playerAction(liveGame(game), {
		kind: "charge",
		right: true
	}, diceFrom(services.random), services.random);
	return {
		...afterPlay(services, seatsOf(game), played),
		turn_deadline: game.turn_deadline
	};
}
/**
* The clock ran out for whoever's turn it is. Any player's page can ask (server functions
* can't wake themselves up); the server checks the clock itself, so nobody can hurry anyone.
*/
async function timesUp({ services, me, body }) {
	const { game } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	const after = await autopilotGone(services, game, await mustBeAllowed(services, me, true, otherPlayers(game, me)));
	if (after) return after;
	const left = Date.parse(game.turn_deadline ?? "") - services.now();
	if (!(left <= 0)) throw new Refused("not-yet", { secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1e3) : 30 });
	const played = timeOut(liveGame(game), diceFrom(services.random), services.random);
	return save(services, game, afterPlay(services, seatsOf(game), played));
}
async function takeTheControls({ services, me, body }) {
	const { game, seat } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	await mustBeAllowed(services, me, true);
	if (!game.seat_info[seat].autopilot) return game;
	const back = takeControls(liveGame(game), seat);
	const deadline = back.state.turn === seat ? deadlineAfter(back, [], services.now()) : null;
	return save(services, game, {
		seat_info: back.seats,
		events: [],
		actions: [],
		...deadline !== null ? { turn_deadline: iso(deadline) } : {}
	});
}
/**
* The first to press Rematch starts a new waiting game (same board and rules) linked to this
* one. Everyone else's Rematch joins it. The host launches it as usual.
*/
async function rematch(context, tries = 0) {
	const { services, me, body } = context;
	const { game } = await loadMyGame(services, me, body.gameId);
	if (game.status !== "finished") throw new Refused("bad-request");
	await mustBeAllowed(services, me, true);
	if (game.rematch_game) {
		const next = await services.loadGame(game.rematch_game);
		if (!next) throw new Refused("rematch-gone");
		if (seatsOf(next).includes(me)) return next;
		if (next.status !== "waiting") throw new Refused("rematch-gone");
		return joinWaiting(services, me, next);
	}
	const next = await newWaitingGame(services, me, withMathsSwitch(game.setup, await services.mathsSwitch()), false);
	if (await services.updateGame(game.id, game.version, {
		rematch_game: next.id,
		version: game.version + 1,
		events: [],
		actions: []
	})) return next;
	await services.updateGame(next.id, next.version, {
		status: "cancelled",
		version: next.version + 1
	});
	if (tries >= 2) throw new Refused("changed");
	return rematch(context, tries + 1);
}
/**
* An emoji reaction: one of the six, only if the teacher has switched them on, at most one
* every 5 seconds and 20 a game. It goes on the game row (not a chat channel), so everyone
* sees it with the next live update, and it's never kept in the log.
*/
async function react({ services, me, body }) {
	if (!isReaction(body.emoji)) throw new Refused("bad-request");
	const { game, seat } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	if (!(await mustBeAllowed(services, me, false)).reactionsEnabled) throw new Refused("reactions-off");
	const result = await services.addReaction(game.id, seat, body.emoji);
	if (result === "too-soon") throw new Refused("reaction-wait");
	if (result === "too-many") throw new Refused("reaction-limit");
	if (result === "not-playing") throw new Refused("over");
	if (result !== "ok") throw new Refused("bad-request");
	return await services.loadGame(game.id) ?? game;
}
//#endregion
//#region supabase/functions/space-game/entry.ts
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
const games = () => admin.from("space_games");
/** Logs say which step went wrong and the database's error code, never who. */
function logProblem(step, code) {
	console.error(`space-game: ${step} failed (${code ?? "unknown"})`);
}
const isUuid = (id) => /^[0-9a-f-]{36}$/i.test(id);
/** The same text always gives the same ID, so an answer sent twice is only counted once. */
async function batchIdFor(text) {
	const hex = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`space-maths:${text}`))).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
Deno.serve(spaceGameHandler({
	now: () => Date.now(),
	random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async playerStatus(player, others = []) {
		const { data, error } = await admin.rpc("space_player_status", {
			player,
			others
		}).maybeSingle();
		if (error || !data) {
			if (error) logProblem("player check", error.code);
			return null;
		}
		const row = data;
		return {
			school: row.school,
			hidden: row.hidden,
			multiplayerEnabled: row.multiplayer_enabled,
			reactionsEnabled: row.reactions_enabled,
			createdLastHour: row.created_last_hour,
			gone: row.gone ?? []
		};
	},
	async loadGame(id) {
		if (!isUuid(id)) return null;
		const { data, error } = await games().select("*").eq("id", id).maybeSingle();
		if (error) logProblem("load", error.code);
		return data ?? null;
	},
	async findWaitingByCode(code) {
		const { data, error } = await games().select("*").eq("code", code).eq("status", "waiting").maybeSingle();
		if (error) logProblem("find code", error.code);
		return data ?? null;
	},
	async friendCodeTaken(code) {
		const { count, error } = await admin.from("mp_games").select("id", {
			count: "exact",
			head: true
		}).eq("code", code).eq("status", "waiting");
		if (error) logProblem("check code", error.code);
		return (count ?? 0) > 0;
	},
	async findWaitingHostedBy(player) {
		const { data, error } = await games().select("*").eq("host", player).eq("status", "waiting").maybeSingle();
		if (error) logProblem("find waiting", error.code);
		return data ?? null;
	},
	async insertGame(row) {
		const { data, error } = await games().insert(row).select("*").single();
		if (!error) return data;
		if (error.code === "23505") return error.message.includes("one_waiting_each") ? "already-waiting" : "code-taken";
		logProblem("create", error.code);
		return "failed";
	},
	async updateGame(id, version, patch) {
		const { data, error } = await games().update(patch).eq("id", id).eq("version", version).select("*").maybeSingle();
		if (error) logProblem("save", error.code);
		return data ?? null;
	},
	async addReaction(id, seat, emoji) {
		const { data, error } = await admin.rpc("space_add_reaction", {
			game_id: id,
			seat,
			emoji
		});
		if (error) {
			logProblem("reaction", error.code);
			return "not-allowed";
		}
		return data;
	},
	async mathsSwitch() {
		const { data, error } = await admin.from("app_settings").select("space_maths").maybeSingle();
		if (error) logProblem("maths switch", error.code);
		return parseMathsSwitch(data?.space_maths);
	},
	async loadMathsContext(player) {
		const { data, error } = await admin.rpc("space_maths_context", { player });
		if (error || !data) {
			logProblem("maths records", error?.code);
			return null;
		}
		const context = data;
		const { enabledTables, division, missingFactor, multipleChoice } = context.settings;
		return {
			facts: context.facts,
			settings: {
				enabledTables,
				division,
				multipleChoice,
				...typeof missingFactor === "boolean" ? { missingFactor } : {}
			}
		};
	},
	async loadQuestion(game, seat, kind) {
		const { data, error } = await admin.from("space_game_questions").select("stamp, question, asked_at, answered").eq("game", game).eq("seat", seat).eq("kind", kind).maybeSingle();
		if (error) logProblem("load question", error.code);
		if (!data) return null;
		return {
			stamp: data.stamp,
			question: data.question,
			askedAt: Date.parse(data.asked_at),
			answered: data.answered
		};
	},
	async saveQuestion(game, seat, kind, stamp, question) {
		const { error } = await admin.from("space_game_questions").upsert({
			game,
			seat,
			kind,
			stamp,
			question,
			asked_at: new Date().toISOString(),
			answered: false
		});
		if (error) logProblem("save question", error.code);
	},
	async claimQuestion(game, seat, kind) {
		const { data, error } = await admin.from("space_game_questions").update({ answered: true }).eq("game", game).eq("seat", seat).eq("kind", kind).eq("answered", false).select("seat");
		if (error) logProblem("claim question", error.code);
		return (data?.length ?? 0) > 0;
	},
	async dropQuestion(game, seat, kind) {
		const { error } = await admin.from("space_game_questions").delete().eq("game", game).eq("seat", seat).eq("kind", kind);
		if (error) logProblem("drop question", error.code);
	},
	async recordAnswer(player, once, answer) {
		const { error } = await admin.rpc("record_fact_answers", {
			player,
			pack: "times-tables",
			batch_id: await batchIdFor(once),
			answers: [answer],
			quick_ms: QUICK_MS,
			fluent_days: 2,
			top_box: 4
		});
		if (error) logProblem("record answer", error.code);
	}
}));
//#endregion
