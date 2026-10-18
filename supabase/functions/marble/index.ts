// GENERATED FILE: don't edit. Edit supabase/functions/marble/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "marble" function.

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
/** In auto mode, review leans towards the hardest tables (the England Multiplication Tables Check finds these hardest). */
const HARD_TABLES = [
	6,
	7,
	8,
	9,
	12
];
/** How much likelier a fact using a hard table is to be picked, on top of its box. */
const HARD_TABLE_WEIGHT = 1.5;
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
* Picks the next fact, and records that it was asked in `memory`. Returns null only when
* the teacher has switched every table off.
*/
function pickFact(ctx, stats, memory, random) {
	return pickFromPools(poolsFor(ctx), ctx, stats, memory, random);
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
function shuffle$1(items, random) {
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
const isInt = (n, lo, hi) => typeof n === "number" && Number.isInteger(n) && n >= lo && n <= hi;
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
const sameAnswer$1 = (a, b) => Math.abs(a - b) < 1e-6;
/** Digits a typed answer needs, allowing one extra so the length doesn't give the answer away. */
const lengthFor = (answer) => String(tidy(answer)).length;
/** Four choices: the answer plus believable wrong ones, padded with near misses when short. */
function choicesFor$2(answer, wrong, decimal, random) {
	const ok = (n) => Number.isFinite(n) && n >= 0 && !sameAnswer$1(n, answer) && (decimal || Number.isInteger(n));
	const picked = [];
	for (const n of shuffle$1(wrong.map(tidy), random)) if (ok(n) && !picked.some((p) => sameAnswer$1(p, n)) && picked.length < 3) picked.push(n);
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
	for (let i = 1; picked.length < 3; i++) for (const step of steps) for (const n of [tidy(answer + step * i), tidy(answer - step * i)]) if (ok(n) && !picked.some((p) => sameAnswer$1(p, n)) && picked.length < 3) picked.push(n);
	return shuffle$1([answer, ...picked], random);
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
		} else if (multipleChoice) choices = choicesFor$2(answer, made.wrong ?? [], decimal, random);
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
		const correct = sameAnswer$1(answer, q.answer);
		const before = this.records.get(q.factKey) ?? newStats(q.factKey);
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
		if (!fact || fact.a !== a || fact.b !== b || !isInt(v, 0, 4)) return null;
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
		make: (_k, [a, b]) => isInt(a, 0, 9999) && isInt(b, 0, 9999) && valid(a, b) ? make(a, b) : null
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
				if (!isInt(a, 11, 89) || a % 10 === 0) return null;
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
				if (!isInt(a, 1, 9) || !isInt(b, 1, 9)) return null;
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
				if (!isInt(a, 2, 19) || !isInt(b, 1, Math.min(9, a - 1))) return null;
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
				if (!isInt(n, 1, 9)) return null;
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
				if (!isInt(a, 105, 995) || !isInt(b, 105, 995) || a % 5 || b % 5) return null;
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
				].includes(paid) || !isInt(cost, 105, paid - 5) || cost % 5) return null;
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
				if (!isInt(a, 11, 99) || a % 10 === 0 || !isInt(b, 10, 90) || b % 10) return null;
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
				if (!isInt(a, 1, 99) || !isInt(b, 1, 99) || a === b || a % 10 === 0 === (b % 10 === 0)) return null;
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
				if (!isInt(a, 1, 99) || a % 10 === 0 || !isInt(p, 1, 2)) return null;
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
				if (!isInt(a, 11, 199) || a % 10 === 0) return null;
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
				if (!isInt(a, 1, 9) || !isInt(b, 2, 9)) return null;
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
				if (!(d === 100 ? isInt(n, 1, 99) : FRACTIONS_AS_DECIMALS.some(([x, y]) => x === n && y === d))) return null;
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
			if (!owned.has(key) || !isInt(v, 0, 1) || key !== `div:${d * q}/${d}`) return null;
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
				if (!isInt(d, 2, 6) || !isInt(q, 11, Math.floor(99 / d))) return null;
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
				if (!isInt(q, 11, 99) || q % 10 === 0 || !isInt(p, 1, 2)) return null;
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
				if (!isInt(d, 2, 9) || !isInt(q, 2, 12)) return null;
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
				if (!isInt(d, 3, 9) || !isInt(q, 2, 9) || !isInt(rem, 1, d - 1)) return null;
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
				if (!isInt(d, 3, 9) || !isInt(q, Math.ceil(100 / d), Math.floor(999 / d))) return null;
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
				].includes(d) || !isInt(q, 1, 10)) return null;
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
			make: (_k, [a, b, d]) => isInt(d, 3, 12) && isInt(a, 1, d - 1) && isInt(b, 1, d - 1) && a !== b ? bigger(a, d, b, d) : null
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
				].includes(d) || !isInt(n, 2, d - 1) || gcd(n, d) !== 1 || !isInt(q, 1, 10)) return null;
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
				if (!isInt(d, 2, 5) || !isInt(n, 1, d - 1) || gcd(n, d) !== 1 || !isInt(k, 2, 5) || !isInt(v, 0, 1)) return null;
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
			make: (_k, [n, d1, d2]) => DENOMINATORS.includes(d1) && DENOMINATORS.includes(d2) && d1 !== d2 && isInt(n, 1, Math.min(d1, d2) - 1) ? bigger(n, d1, n, d2) : null
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
				if (!isInt(d, 3, 12) || !isInt(a, 1, d - 2) || !isInt(b, 1, d - 1 - a)) return null;
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
				if (!isInt(d, 3, 12) || !isInt(a, 2, d) || !isInt(b, 1, a - 1)) return null;
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
				if (!isInt(d, 2, 8) || !isInt(w, 1, 4) || !isInt(n, 1, d - 1) || !isInt(v, 0, 1)) return null;
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
			make: (_k, [n1, d1, n2, d2]) => DENOMINATORS.includes(d1) && DENOMINATORS.includes(d2) && d1 !== d2 && isInt(n1, 1, d1 - 1) && isInt(n2, 1, d2 - 1) && n1 !== n2 && n1 * d2 !== n2 * d1 ? bigger(n1, d1, n2, d2) : null
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
				if (!isInt(d, 2, 6) || !isInt(n, 1, d - 1) || gcd(n, d) !== 1 || !isInt(k, 2, 6) || !isInt(v, 0, 1)) return null;
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
			if (!isInt(n, lo, hi) || !askablePlaces(n, 1).includes(place)) return null;
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
	const ok = (n, place) => isInt(n, lo, hi) && isInt(place, 1, digitCount(n) - 1) && digitAt(n, place) !== 0 && String(n).replace(/0/g, "").length >= 2;
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
	const ok = (n, v, step) => isInt(v, 0, 1) && steps.includes(step) && isInt(n, lo, hi) && isInt(v === 0 ? n + step : n - step, lo - step, hi + step);
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
	const ok = (n) => isInt(n, lo, hi) && n % to !== 0;
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
				if (!isInt(n, 2, 99) || !isInt(p, 1, 3)) return null;
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
function choicesFor$1(x, y, answer, isFactor, random) {
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
		return this.questionFor(picked.key, picked.band, ctx);
	}
	/** Whether this pack owns a mastery key. */
	owns(key) {
		return parseFactKey(key) !== null;
	}
	/** The question for a chosen fact (the picking was done by the caller, e.g. auto mode). */
	questionFor(key, band, ctx = {}) {
		const picked = {
			key,
			band
		};
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
			choices: ctx.multipleChoice ? choicesFor$1(x, y, answer, kind !== "multiply", this.random) : void 0,
			band: picked.band
		};
	}
	recordAnswer(q, answer, ms) {
		const correct = answer === q.answer;
		const before = this.records.get(q.factKey) ?? newStats(q.factKey);
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
//#endregion
//#region shared/maths/skillPacks/earlyFacts.ts
/**
* The first rungs of the maths ladder: number facts a student should know by heart before
* times tables. One mastery record per fact, like 7 × 8 in times tables.
*
* Keys: "bond10:3+7" (pairs that make 10), "bond20:8+12" (pairs that make 20), "dbl:7"
* (double 7) and "half:14" (half of 14). Adding and taking away within 20 keeps its own
* "add:7+8" records (add-sub pack), so nothing already saved changes.
*
* Bands: 1 bonds to 10, 2 doubles and halves to 10, 3 bonds to 20, 4 doubles and halves to 20.
*/
const bondKeys = (prefix, total, from) => {
	const keys = [];
	for (let a = from; a <= total / 2; a++) keys.push(`${prefix}:${a}+${total - a}`);
	return keys;
};
const parseBond = (key) => {
	const m = /^bond(10|20):(\d+)\+(\d+)$/.exec(key);
	return m ? {
		total: Number(m[1]),
		a: Number(m[2]),
		b: Number(m[3])
	} : null;
};
/** Variants: 0 a + ? = total, 1 ? + b = total, 2 total − a = ?, 3 total − b = ?. */
function bonds(label, tag, prefix, total, from) {
	const keys = bondKeys(prefix, total, from);
	return {
		label,
		curriculumTags: [tag],
		keys,
		roll: (key, r) => {
			const { a, b } = parseBond(key);
			return [
				a,
				b,
				int(r, 0, 3)
			];
		},
		make: (key, [a, b, v]) => {
			const bond = parseBond(key);
			if (!bond || bond.total !== total || bond.a !== a || bond.b !== b || !keys.includes(key) || !isInt(v, 0, 3)) return null;
			const t = String(total);
			const [parts, answer] = v === 0 ? [[
				String(a),
				"+",
				"?",
				"=",
				t
			], b] : v === 1 ? [[
				"?",
				"+",
				String(b),
				"=",
				t
			], a] : v === 2 ? [[
				t,
				"−",
				String(a),
				"=",
				"?"
			], b] : [[
				t,
				"−",
				String(b),
				"=",
				"?"
			], a];
			return {
				parts,
				spoken: speak(parts),
				answer,
				wrong: [
					answer + 1,
					answer - 1,
					total,
					answer + 2,
					answer - 2,
					a + b + 1
				]
			};
		}
	};
}
const range = (from, to, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
/** Doubles of dblFrom–dblTo and halves of the even numbers halfFrom–halfTo. */
function doublesHalves(label, tag, dblFrom, dblTo, halfFrom, halfTo) {
	const dbls = range(dblFrom, dblTo);
	const halves = range(halfFrom, halfTo, 2);
	const keys = [...dbls.map((n) => `dbl:${n}`), ...halves.map((n) => `half:${n}`)];
	return {
		label,
		curriculumTags: [tag],
		keys,
		roll: (key, r) => [Number(key.split(":")[1]), int(r, 0, 1)],
		make: (key, [n, v]) => {
			if (!keys.includes(key) || key.split(":")[1] !== String(n) || !isInt(v, 0, 1)) return null;
			if (key.startsWith("dbl:")) {
				const parts = v === 0 ? [
					String(n),
					"+",
					String(n),
					"=",
					"?"
				] : [
					"Double",
					String(n),
					"=",
					"?"
				];
				return {
					parts,
					spoken: speak(parts),
					answer: 2 * n,
					wrong: [
						2 * n + 1,
						2 * n - 1,
						2 * n + 2,
						2 * n - 2,
						n + 1,
						n * n
					]
				};
			}
			const parts = v === 0 ? [
				"Half",
				"of",
				String(n),
				"=",
				"?"
			] : [
				String(n),
				"÷",
				"2",
				"=",
				"?"
			];
			const answer = n / 2;
			return {
				parts,
				spoken: speak(parts),
				answer,
				wrong: [
					answer + 1,
					answer - 1,
					n,
					answer + 2,
					answer - 2
				]
			};
		}
	};
}
const EARLY_FACTS = {
	id: "early-facts",
	label: "Early number facts",
	families: {
		bond10: bonds("Pairs that make 10", "MS.Y1.NUM.OP.P1", "bond10", 10, 0),
		dblHalf10: doublesHalves("Doubles and halves to 10", "MS.Y1.NUM.OP.P2", 1, 5, 2, 10),
		bond20: bonds("Pairs that make 20", "MS.Y2.NUM.OP.P1", "bond20", 20, 1),
		dblHalf20: doublesHalves("Doubles and halves to 20", "MS.Y2.NUM.OP.P2", 6, 10, 12, 20)
	},
	bands: [
		["bond10"],
		["dblHalf10"],
		["bond20"],
		["dblHalf20"]
	]
};
const earlyFactsPack = (saved, random, now) => new BandedPack(EARLY_FACTS, saved, random, now);
//#endregion
//#region shared/maths/ladder.ts
/**
* The maths ladder: one ordered list of skills, easiest first (docs/MATHS-FOCUS-PLAN.md,
* sections 3 and 12). Auto mode walks a student up it, and `ladderProgress` tells a student
* (and a teacher) how far along they are.
*
* It's only data: to change the order, move a line in `LADDER`. A skill owns a set of mastery
* keys (the facts or question types that make it up) and its questions come from the pack
* that owns those keys. Skills with `built: false` are stubs for the later stages: they hold
* their place in the list, but auto skips them and they don't count towards progress yet.
*/
const earlyKeys = (family) => EARLY_FACTS.families[family].keys;
const addKeys = (test) => Object.values(BANDED_PACKS["add-sub"].families).flatMap((f) => f.keys).filter((k) => {
	const m = /^add:(\d+)\+(\d+)$/.exec(k);
	return m && test(Number(m[1]) + Number(m[2]));
});
/** Division fact keys ("div:56/8") whose divisor is one of these. */
const divKeys$1 = (divisors) => Object.values(BANDED_PACKS.division.families).flatMap((f) => f.keys).filter((k) => {
	const m = /^div:(\d+)\/(\d+)$/.exec(k);
	return m && divisors.includes(Number(m[2]));
});
/** Times tables, one skill per campaign step. The multiplication and division facts of a table go together. */
function tablesSkills() {
	const tags = [
		"MS.Y2.NUM.OP.P9",
		"MS.Y3.NUM.OP.P6",
		"MS.Y4.NUM.OP.P2",
		"MS.Y4.NUM.OP.P2",
		"MS.Y5.NUM.OP.P2"
	];
	const seen = new Set();
	return CAMPAIGN_STEPS.map((step, i) => {
		const upTo = step.upTo ?? 12;
		const mul = [...factsIn(step.add)].filter((k) => parseFactKey(k).b <= upTo && !seen.has(k));
		mul.forEach((k) => seen.add(k));
		const div = divKeys$1(step.add).filter((k) => !seen.has(k));
		div.forEach((k) => seen.add(k));
		return {
			id: `tables-${step.add.join("-")}`,
			label: "Times tables: " + step.add.map((t) => `×${t}`).join(", "),
			stage: "times-tables",
			curriculumTags: [tags[i] ?? tags[tags.length - 1]],
			keys: [...mul, ...div],
			built: true
		};
	});
}
const stub = (id, label, stage, ...curriculumTags) => ({
	id,
	label,
	stage,
	curriculumTags,
	keys: [],
	built: false
});
const tables = tablesSkills();
/** Easiest first. Table skills are in the order of `CAMPAIGN_STEPS`. */
const LADDER = [
	{
		id: "facts-10",
		label: "Number facts to 10",
		stage: "early-facts",
		curriculumTags: ["MS.Y1.NUM.OP.P1"],
		keys: [...earlyKeys("bond10"), ...addKeys((s) => s <= 10)],
		built: true
	},
	{
		id: "dbl-half-10",
		label: "Doubles and halves to 10",
		stage: "early-facts",
		curriculumTags: ["MS.Y1.NUM.OP.P2"],
		keys: earlyKeys("dblHalf10"),
		built: true
	},
	stub("ten-and", "Ten and a number (10 + 4)", "early-facts", "MS.Y1.NUM.OP.P6"),
	{
		id: "facts-20",
		label: "Number facts to 20",
		stage: "early-facts",
		curriculumTags: ["MS.Y2.NUM.OP.P1"],
		keys: [...earlyKeys("bond20"), ...addKeys((s) => s > 10)],
		built: true
	},
	{
		id: "dbl-half-20",
		label: "Doubles and halves to 20",
		stage: "early-facts",
		curriculumTags: ["MS.Y2.NUM.OP.P2"],
		keys: earlyKeys("dblHalf20"),
		built: true
	},
	tables[0],
	stub("bonds-100", "Pairs that make 100", "place-value", "MS.Y3.NUM.OP.P1"),
	tables[1],
	stub("round-10-100", "Rounding to the nearest 10 and 100", "rounding", "MS.Y3.NUM.NS.P5"),
	stub("bonds-1000", "Hundreds that make 1000", "place-value"),
	stub("unit-fraction-of", "A fraction of an amount (⅓ of 15)", "fractions-decimals-percentages", "MS.Y3.NUM.RN.P7"),
	tables[2],
	tables[3],
	stub("times-tens", "Times with tens and hundreds (30 × 4)", "place-value", "MS.Y4.NUM.OP.P3"),
	stub("tenths", "Tenths and decimals of a half", "fractions-decimals-percentages", "MS.Y4.NUM.RN.P3", "MS.Y4.NUM.RN.P5"),
	stub("add-tenths", "Adding and taking away tenths", "fractions-decimals-percentages", "MS.Y4.NUM.RN.P10"),
	stub("round-1000", "Rounding to the nearest 1000", "rounding", "MS.Y4.NUM.NS.K4"),
	tables[4],
	stub("factor-pairs", "Factor pairs", "place-value", "MS.Y5.NUM.NS.P2"),
	stub("round-big", "Rounding bigger numbers and decimals", "rounding", "MS.Y5.NUM.NS.P3", "MS.Y5.NUM.NS.P4"),
	stub("decimal-equivalents", "Fractions as decimals", "fractions-decimals-percentages", "MS.Y5.NUM.RN.P4"),
	stub("percent-basic", "10%, 25% and 50%", "fractions-decimals-percentages", "MS.Y5.NUM.RN.P5", "MS.Y5.NUM.RN.P15"),
	stub("fraction-of", "Fractions of an amount (⅔ of 24)", "fractions-decimals-percentages", "MS.Y5.NUM.RN.P13"),
	stub("times-decimals", "Times 10 and 100 with decimals", "fractions-decimals-percentages", "MS.Y5.NUM.RN.P7"),
	stub("equivalent-fractions", "Equivalent fractions and simplifying", "fractions-decimals-percentages", "MS.Y5.NUM.RN.P9", "MS.Y6.NUM.RN.P6"),
	stub("squares-cubes", "Square and cube numbers", "place-value", "MS.Y6.NUM.NS.P6"),
	stub("round-million", "Rounding to the nearest million", "rounding", "MS.Y6.NUM.NS.P3", "MS.Y6.NUM.NS.P4"),
	stub("fdp-equivalents", "Fractions, decimals and percentages", "fractions-decimals-percentages", "MS.Y6.NUM.RN.P3", "MS.Y6.NUM.RN.P4"),
	stub("percent-of", "Percentages of an amount", "fractions-decimals-percentages", "MS.Y6.NUM.RN.P13", "MS.Y6.NUM.RN.P14"),
	stub("whole-from-fraction", "Finding the whole from a fraction", "fractions-decimals-percentages", "MS.Y6.NUM.RN.P12"),
	stub("bedmas", "Order of operations", "order-of-operations", "MS.Y6.NUM.OP.P1")
];
/** The skill's keys once switched-off tables are taken out. */
function activeKeys(skill, enabledTables) {
	const on = new Set(enabledTables);
	return skill.keys.filter((k) => {
		const mul = parseFactKey(k);
		if (mul) return on.has(mul.a) || on.has(mul.b);
		const div = /^div:\d+\/(\d+)$/.exec(k);
		return div ? on.has(Number(div[1])) : true;
	});
}
/**
* Where a student is on the ladder, worked out from their records: the first built skill that
* isn't secure yet (70% of its facts in box 2 or higher, the same rule as the times-table
* campaign) is the one they're on. Skipped skills (all their tables switched off) are secure
* for free. The place can fall back if a student gets facts wrong; saving the furthest place
* so it never goes down comes with the stored focus in F.4.
*/
function ladderProgress(stats, opts = {}) {
	const byKey = new Map([...stats].map((s) => [s.key, s]));
	const enabled = opts.enabledTables ?? TABLES;
	let current = null;
	let secureCount = 0;
	let builtCount = 0;
	return {
		skills: LADDER.map((skill) => {
			if (!skill.built) return {
				skill,
				status: "later",
				share: 0
			};
			const keys = activeKeys(skill, enabled);
			if (keys.length === 0) return {
				skill,
				status: "upcoming",
				share: 1
			};
			builtCount++;
			const share = keys.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / keys.length;
			if (current === null && share < .7) {
				current = skill;
				return {
					skill,
					status: "current",
					share
				};
			}
			if (current === null) secureCount++;
			return {
				skill,
				status: current === null ? "secure" : "upcoming",
				share
			};
		}),
		current,
		secureCount,
		builtCount,
		percent: builtCount ? Math.round(100 * secureCount / builtCount) : 0
	};
}
/** The focus, review and stretch keys auto draws from for these records. */
function autoPools(progress, opts = {}) {
	const enabled = opts.enabledTables ?? TABLES;
	const live = progress.skills.filter((p) => p.skill.built).map((p) => ({
		...p,
		keys: activeKeys(p.skill, enabled)
	})).filter((p) => p.keys.length);
	const at = live.findIndex((p) => p.status === "current");
	if (at < 0) return {
		focus: [],
		review: live.flatMap((p) => p.keys),
		stretch: []
	};
	return {
		focus: live[at].keys,
		review: live.slice(0, at).flatMap((p) => p.keys),
		stretch: live[at + 1]?.keys ?? []
	};
}
/** The built ladder skills a focus really names, in ladder order. Unknown or not-yet-built names are ignored. */
function focusSkills(spec) {
	const wanted = new Set(spec.skills);
	return LADDER.filter((s) => s.built && wanted.has(s.id));
}
/**
* The keys a focus draws from. The chosen skills are the focus; earlier skills come up as review
* (about 30% of questions) unless the focus is "only these"; there is no stretch, so a teacher's
* ×6 never drifts on to ×7. Switched-off tables, and division when it's off, are left out.
*/
function focusPools(spec, opts = {}) {
	const enabled = opts.enabledTables ?? TABLES;
	const keysOf = (skill) => activeKeys(skill, enabled).filter((k) => opts.division !== false || !k.startsWith("div:"));
	const chosen = focusSkills(spec);
	if (chosen.length === 0) return {
		focus: [],
		review: [],
		stretch: []
	};
	const focus = [...new Set(chosen.flatMap(keysOf))];
	if (spec.onlyThese) return {
		focus,
		review: [],
		stretch: []
	};
	const mine = new Set(focus);
	return {
		focus,
		review: LADDER.slice(0, LADDER.indexOf(chosen[0])).filter((s) => s.built).flatMap(keysOf).filter((k) => !mine.has(k)),
		stretch: []
	};
}
/** Which skill pack records a mastery key ("mul:7x8" → "times-tables"), or null if it isn't a ladder key. */
function packIdOfKey(key) {
	if (/^mul:\d+x\d+$/.test(key)) return "times-tables";
	if (/^(bond10|bond20|dbl|half):/.test(key)) return "early-facts";
	if (key.startsWith("add:")) return "add-sub";
	if (key.startsWith("div:")) return "division";
	return null;
}
/** Every mastery key the built ladder asks, with the pack that keeps its record. */
function ladderKeyPacks() {
	const out = new Map();
	for (const skill of LADDER) {
		if (!skill.built) continue;
		for (const key of skill.keys) {
			const pack = packIdOfKey(key);
			if (pack) out.set(key, pack);
		}
	}
	return out;
}
/**
* One skill pack for the whole ladder. It picks the next fact (60% the skill the student is
* on, 30% review, 10% stretch, hard tables a bit likelier in review) and asks whichever pack
* owns that fact for the question, so records stay in the same keys the other games use.
*/
var AutoPack = class {
	random;
	opts;
	id = "auto";
	label = "Auto";
	curriculumTags = [...new Set(LADDER.filter((s) => s.built).flatMap((s) => s.curriculumTags))];
	packs;
	memory = newMemory();
	listeners = new Set();
	constructor(saved = [], random = Math.random, now = Date.now, opts = {}) {
		this.random = random;
		this.opts = opts;
		const only = (pack) => saved.filter((s) => pack.owns(s.key));
		const shells = [
			earlyFactsPack(),
			new BandedPack(BANDED_PACKS["add-sub"]),
			new TimesTables(),
			new BandedPack(BANDED_PACKS.division)
		];
		this.packs = [
			earlyFactsPack(only(shells[0]), random, now),
			new BandedPack(BANDED_PACKS["add-sub"], only(shells[1]), random, now),
			new TimesTables(only(shells[2]), random, now),
			new BandedPack(BANDED_PACKS.division, only(shells[3]), random, now)
		];
		for (const pack of this.packs) pack.onAnswer((a) => this.listeners.forEach((l) => l(a)));
	}
	ownerOf(key) {
		const pack = this.packs.find((p) => p.owns(key));
		if (!pack) throw new Error(`auto: nothing owns "${key}"`);
		return pack;
	}
	onAnswer(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	stats() {
		return this.packs.flatMap((p) => p.stats());
	}
	/** The pack that keeps the record for a key (so saving can sort answers by pack). */
	static packOf(key) {
		return packIdOfKey(key);
	}
	/** Where the student is on the ladder right now. */
	progress() {
		return ladderProgress(this.stats(), this.opts);
	}
	nextQuestion(ctx = {}) {
		const progress = this.progress();
		const focusSpec = this.opts.focus && focusSkills(this.opts.focus).length ? this.opts.focus : null;
		const pools = focusSpec ? focusPools(focusSpec, this.opts) : autoPools(progress, this.opts);
		const focus = new Set(pools.focus);
		const hardTable = (key) => {
			const mul = parseFactKey(key);
			if (mul) return HARD_TABLES.includes(mul.a) || HARD_TABLES.includes(mul.b);
			const div = /^div:\d+\/(\d+)$/.exec(key);
			return !!div && HARD_TABLES.includes(Number(div[1]));
		};
		const weight = (key) => !focus.has(key) && hardTable(key) ? HARD_TABLE_WEIGHT : 1;
		const picked = pickFromPools(pools, ctx, new Map(this.stats().map((s) => [s.key, s])), this.memory, this.random, weight);
		if (!picked) return null;
		const pack = this.ownerOf(picked.key);
		const firstTables = progress.skills.findIndex((p) => p.skill.stage === "times-tables");
		const at = focusSpec ? LADDER.indexOf(focusSkills(focusSpec)[0]) : progress.skills.findIndex((p) => p.status === "current");
		const missingFactor = focusSpec && ctx.missingFactor !== void 0 ? ctx.missingFactor : at < 0 || at > firstTables;
		return pack.questionFor(picked.key, picked.band, {
			...ctx,
			missingFactor
		});
	}
	recordAnswer(q, answer, ms) {
		const result = this.ownerOf(q.factKey).recordAnswer(q, answer, ms);
		if (!result.correct) scheduleRepeat(this.memory, q.factKey, this.random);
		return result;
	}
};
//#endregion
//#region shared/maths/focus.ts
/**
* The maths focus as the games see it (docs/MATHS-FOCUS-PLAN.md, sections 4 and 8).
*
* The server works out each student's focus (`my_maths_focus()`, `maths_focus_of()`); a game only
* reads the answer and never decides it. This file turns that answer into a safe shape, says it
* in words, builds the pack a game asks its questions from, and marks answers for every skill
* the ladder has built (the server uses `solveParts` to check answers it didn't see being asked).
*/
const AUTO_FOCUS = {
	source: "auto",
	skills: [],
	onlyThese: false,
	endsAt: null,
	canChoose: true,
	own: null
};
const SOURCES = [
	"teacher-student",
	"teacher-group",
	"teacher-class",
	"student",
	"auto"
];
const SKILL_ID = /^[a-z0-9-]{1,40}$/;
const cleanSkills = (raw) => Array.isArray(raw) ? [...new Set(raw.filter((s) => typeof s === "string" && SKILL_ID.test(s)))].slice(0, 12) : [];
/** Reads what the server sent. Anything odd counts as auto: nobody gets a strange focus by accident. */
function parseFocus(raw) {
	if (!raw || typeof raw !== "object") return AUTO_FOCUS;
	const r = raw;
	const source = SOURCES.find((s) => s === r.source) ?? "auto";
	const skills = cleanSkills(r.skills);
	const own = r.own && typeof r.own === "object" ? r.own : null;
	const ownSkills = own ? cleanSkills(own.skills) : [];
	const ends = typeof r.endsAt === "string" && !Number.isNaN(Date.parse(r.endsAt)) ? r.endsAt : null;
	return {
		source: source !== "auto" && skills.length === 0 ? "auto" : source,
		skills: source === "auto" ? [] : skills,
		onlyThese: r.onlyThese === true,
		endsAt: source.startsWith("teacher") ? ends : null,
		canChoose: r.canChoose !== false,
		own: ownSkills.length ? {
			skills: ownSkills,
			onlyThese: own.onlyThese === true
		} : null
	};
}
/** True when the focus names at least one skill the games can ask today. */
function hasFocus(focus) {
	return !!focus && focus.source !== "auto" && focusSkills(focus).length > 0;
}
/**
* The pack a game asks its questions from. With no focus it is the times-table pack, exactly
* as before (the campaign or the student's ready step decides). With a focus it is the ladder
* pack, asking only that focus. `stats` is every record the student has, whatever pack kept it.
*/
function makeFocusPack(stats, focus, opts = {}, random, now) {
	if (!hasFocus(focus)) return new TimesTables(stats.filter((s) => parseFactKey(s.key)), random, now);
	const spec = {
		skills: focus.skills,
		onlyThese: focus.onlyThese
	};
	return new AutoPack(stats, random, now, {
		enabledTables: opts.enabledTables,
		division: opts.division,
		focus: spec
	});
}
/** Splits answers by the pack that keeps their record (times tables, early facts, adding, division). */
function groupByPack(answers) {
	const out = new Map();
	for (const answer of answers) {
		const pack = packIdOfKey(answer.key);
		if (!pack) continue;
		out.set(pack, [...out.get(pack) ?? [], answer]);
	}
	return out;
}
const ladderKeys = ladderKeyPacks();
for (let a = 1; a <= 12; a++) for (let b = a; b <= 12; b++) ladderKeys.set(`mul:${a}x${b}`, "times-tables");
/** True for a mastery key the games record under a focus. */
const isFocusKey = (key) => ladderKeys.has(key);
const NUMBER = /^\d{1,4}$/;
const num = (text) => NUMBER.test(text) ? Number(text) : NaN;
const whole = (n) => Number.isInteger(n) && n >= 0;
/** The adding and pairs-that-make-N records for two numbers that add to `total`. */
function sumKeys(p, q, total) {
	const keys = [];
	const lo = Math.min(p, q);
	const hi = Math.max(p, q);
	keys.push(`add:${lo}+${hi}`);
	if (total === 10) keys.push(`bond10:${lo}+${hi}`);
	if (total === 20) keys.push(`bond20:${lo}+${hi}`);
	if (p === q) keys.push(`dbl:${p}`);
	return keys;
}
/** The times-table and division-fact records for n ÷ d = q. */
function divKeys(n, d, q) {
	const keys = [];
	if (d >= 1 && d <= 12 && q >= 1 && q <= 12) keys.push(`mul:${Math.min(d, q)}x${Math.max(d, q)}`);
	keys.push(`div:${n}/${d}`);
	if (d === 2) keys.push(`half:${n}`);
	return keys;
}
/**
* Works a question out from how it was shown (['7', '+', '?', '=', '10']): its answer, and the
* records it could count towards. Null if no ladder skill asks that shape. The server uses this
* to check answers from a solo game it didn't see being asked. It knows nothing the generators
* don't: the tests make thousands of questions and check this agrees with every one.
*/
function solveParts(parts) {
	if (!Array.isArray(parts) || !parts.every((p) => typeof p === "string")) return null;
	const p = parts;
	const blanks = p.filter((x) => x === "?").length;
	let answer = NaN;
	let keys = [];
	if (p.length === 4 && p[0] === "Double" && p[2] === "=" && p[3] === "?") {
		const n = num(p[1]);
		answer = 2 * n;
		keys = [`dbl:${n}`];
	} else if (p.length === 5 && p[0] === "Half" && p[1] === "of" && p[3] === "=" && p[4] === "?") {
		const n = num(p[2]);
		answer = n / 2;
		keys = [`half:${n}`];
	} else if (p.length === 5 && p[3] === "=" && blanks === 1) {
		const [x, op, y, , z] = p;
		const [a, b, c] = [
			num(x),
			num(y),
			num(z)
		];
		if (op === "+") {
			const [addendA, addendB, total] = z === "?" ? [
				a,
				b,
				a + b
			] : x === "?" ? [
				c - b,
				b,
				c
			] : [
				a,
				c - a,
				c
			];
			answer = z === "?" ? total : x === "?" ? addendA : addendB;
			if (whole(addendA) && whole(addendB)) keys = sumKeys(addendA, addendB, total);
		} else if (op === "−") {
			if (z === "?") {
				answer = a - b;
				if (whole(answer)) keys = sumKeys(b, answer, a);
			} else if (y === "?") {
				answer = a - c;
				if (whole(answer)) keys = sumKeys(c, answer, a);
			}
		} else if (op === "×") {
			const [f, g, product] = z === "?" ? [
				a,
				b,
				a * b
			] : x === "?" ? [
				c / b,
				b,
				c
			] : [
				a,
				c / a,
				c
			];
			answer = z === "?" ? product : x === "?" ? f : g;
			if (Number.isInteger(f) && Number.isInteger(g) && f * g === product && f >= 1 && f <= 12 && g >= 1 && g <= 12) keys = [`mul:${Math.min(f, g)}x${Math.max(f, g)}`];
		} else if (op === "÷") {
			if (z === "?") {
				answer = a / b;
				if (whole(answer) && b > 0) keys = divKeys(a, b, answer);
			} else if (y === "?") {
				answer = a / c;
				if (whole(answer) && c > 0) keys = divKeys(a, answer, c);
			}
		}
	}
	if (!whole(answer) || answer > 1e3) return null;
	keys = keys.filter(isFocusKey);
	return keys.length ? {
		answer,
		keys
	} : null;
}
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
const DT = 1 / 60;
/** How high one height level is, in tile widths. 0.5 means a slope that drops one level over one tile is a gentle hill. */
const LEVEL = .5;
const BALL_RADIUS = .3;
const MAX_SPEED = 4.5;
/** Sticky and slippery floors. `steer` multiplies the push, `drag` is the share of speed lost each step, `max` the speed limit. */
const SURFACES = {
	normal: {
		steer: 1,
		drag: .012,
		max: MAX_SPEED
	},
	ice: {
		steer: .3,
		drag: .0015,
		max: MAX_SPEED
	},
	mud: {
		steer: 1.3,
		drag: .06,
		max: 2.5
	}
};
/** In the air the player can only nudge the marble. */
const AIR_STEER = .3;
/** A bounce off a wall keeps this share of the speed. */
const BOUNCE = .45;
/** Bumpers push the marble out of a circle this big, at this speed. */
const BUMPER_RADIUS = .45;
const BUMPER_SPEED = 3.5;
/**
* Timed hazards. Everything is worked out from the step number, so the same run always meets the same hazard
* at the same moment (no randomness, nothing to remember). Times are in steps (60 a second).
*/
const TIMED = {
	/** A geyser puffs every `period` steps; for the first `warn` it only steams (a warning), then for `active` it throws the marble up. */
	geyser: {
		period: 180,
		warn: 15,
		active: 30,
		boost: 1.2
	},
	/** A trapdoor is solid for `solid` steps out of every `period`, then drops away. It flickers for the last `warn` steps before. */
	trapdoor: {
		period: 240,
		solid: 170,
		warn: 25
	},
	/** A gate (a sweeping arm) is open for `open` steps out of every `period`, then shuts. */
	gate: {
		period: 210,
		open: 120,
		warn: 25
	}
};
//#endregion
//#region shared/marble/course.ts
/**
* A course is data: one letter per tile for what it is, and one digit per tile for how high it is.
* `compileCourse` checks it and makes the lookup the engine uses.
*
* Tile letters
*   .  nothing (a gap, or off the edge): the marble falls
*   #  flat floor          i  ice (slippery)        m  mud (sticky)
*   >  <  ^  v  a slope going DOWN towards east, west, north (up the grid) or south.
*               Its digit is its HIGH edge; the low edge is one level lower.
*   =  a wall or rail the marble bounces off
*   b  a bumper (flat floor with a post in the middle)
*   j  a jump pad          c  a checkpoint        s  the start (exactly one)
*   f  the finish (one or more)
*   e w n o  a conveyor belt pushing east, west, north (up the grid) or south
*   g  a geyser: steams, then throws the marble into the air, on a timer
*   t  a trapdoor: solid, then drops away, on a timer
*   q  a gate (a sweeping arm): open, then shut like a wall, on a timer. Gates and trapdoors in the same column share a timer.
*   A–H  a shortcut door. Shut it is a wall; open it is flat floor. Which are open is decided
*        before the run starts and never changes during it (this is how maths gates will work).
*/
const SLOPES = {
	">": "E",
	"<": "W",
	"^": "N",
	v: "S"
};
const KNOWN = new Set(".#im><^v=bjcsfABCDEFGHewnogtq".split(""));
function compileCourse(def) {
	const height = def.rows.length;
	const width = def.rows[0]?.length ?? 0;
	if (!height || !width) throw new Error(`${def.id}: empty course`);
	if (def.heights.length !== height) throw new Error(`${def.id}: heights need ${height} rows`);
	const tiles = [];
	let start = null;
	let floorMin = Infinity;
	let doorCount = 0;
	let finishes = 0;
	for (let y = 0; y < height; y++) {
		if (def.rows[y].length !== width || def.heights[y].length !== width) throw new Error(`${def.id}: row ${y} is not ${width} wide`);
		for (let x = 0; x < width; x++) {
			const ch = def.rows[y][x];
			if (!KNOWN.has(ch)) throw new Error(`${def.id}: unknown tile "${ch}" at ${x},${y}`);
			const lv = parseInt(def.heights[y][x], 36);
			if (Number.isNaN(lv)) throw new Error(`${def.id}: bad height at ${x},${y}`);
			const door = ch >= "A" && ch <= "H" ? ch.charCodeAt(0) - 65 : -1;
			if (door >= 0) doorCount = Math.max(doorCount, door + 1);
			if (ch === "s") {
				if (start) throw new Error(`${def.id}: more than one start`);
				start = {
					x: x + .5,
					y: y + .5
				};
			}
			if (ch === "f") finishes++;
			const surface = ch === "i" ? "ice" : ch === "m" ? "mud" : "normal";
			const slope = SLOPES[ch] ?? null;
			if (ch !== "." && ch !== "=") floorMin = Math.min(floorMin, (slope ? lv - 1 : lv) * LEVEL);
			tiles.push({
				ch,
				level: lv,
				surface,
				slope,
				door
			});
		}
	}
	if (!start) throw new Error(`${def.id}: no start`);
	if (!finishes) throw new Error(`${def.id}: no finish`);
	const gates = def.gates ?? [];
	const tunnelAt = new Uint16Array(width * height);
	const doorsUsed = new Set();
	gates.forEach((g, gi) => {
		if (g.tunnels.length < 2 || g.tunnels.length > 3) throw new Error(`${def.id}: gate ${gi} needs 2 or 3 tunnels`);
		g.tunnels.forEach((t, ti) => {
			if (t.door < 0 || t.door >= doorCount || doorsUsed.has(t.door)) throw new Error(`${def.id}: gate ${gi} tunnel ${ti} has a bad or shared door`);
			doorsUsed.add(t.door);
			for (const [x, y] of t.cells) {
				if (x < 0 || y < 0 || x >= width || y >= height) throw new Error(`${def.id}: gate ${gi} tunnel ${ti} is off the course`);
				tunnelAt[y * width + x] = gi * 8 + ti + 1;
			}
		});
	});
	const gems = def.gems ?? [];
	const gemList = [];
	gems.forEach((trail, ti) => {
		const size = trail.groups[0]?.spots.length ?? 0;
		if (!trail.groups.length || size < 2 || size > 3) throw new Error(`${def.id}: gem trail ${ti} needs groups of 2 or 3 gems`);
		trail.groups.forEach((group, gi) => {
			if (group.spots.length !== size) throw new Error(`${def.id}: gem trail ${ti} has groups of different sizes`);
			group.spots.forEach(([x, y], si) => {
				const at = tiles[Math.floor(y) * width + Math.floor(x)];
				if (x < 0 || y < 0 || x >= width || y >= height || !at || at.ch === "." || at.ch === "=" || at.door >= 0) throw new Error(`${def.id}: gem ${ti}.${gi}.${si} is not over a floor tile`);
				gemList.push({
					trail: ti,
					group: gi,
					spot: si,
					x,
					y
				});
			});
		});
	});
	if (gemList.length > 16) throw new Error(`${def.id}: more than 16 gems`);
	const pitAt = new Int16Array(width * height).fill(-1);
	let pitCount = 0;
	for (let i = 0; i < tiles.length; i++) {
		if (tiles[i].ch !== "c" || pitAt[i] >= 0) continue;
		const todo = [i];
		pitAt[i] = pitCount;
		while (todo.length) {
			const at = todo.pop();
			const x = at % width;
			const y = Math.floor(at / width);
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
				const ni = ny * width + nx;
				if (tiles[ni].ch === "c" && pitAt[ni] < 0) {
					pitAt[ni] = pitCount;
					todo.push(ni);
				}
			}
		}
		pitCount++;
	}
	return {
		def,
		width,
		height,
		tiles,
		start,
		floorMin,
		doorCount,
		gates,
		gems,
		gemList,
		tunnelAt,
		pitAt,
		pitCount
	};
}
const NZ_COURSE_DEFS = [
	{
		id: "boulder-beach",
		name: "Boulder Beach",
		rows: [
			"......................................................",
			".==================...................................",
			".=#####>>>########=...................................",
			".=#####>>>########=...................................",
			".=s####>>>########=...................................",
			".=#####>>>##b#####=...................................",
			".=#####>>>########=...................................",
			".============#####=...................................",
			"............=#####=...................................",
			"............=#####=...................................",
			"............=vvvvv=...................................",
			"............=vvvvv=...................................",
			"............=vvvvv=...................................",
			"............=ccccc=...................................",
			"............=ccccc=...................................",
			"............=#####=...................................",
			"............=#####=...................................",
			"............=###b#==========================..........",
			"............=#######mm#####A####>>>>#######=..........",
			"............=#######mm#####A####>>>>#######=..........",
			"............=#######mm======####>>>>#######=..........",
			"............=#######mm#####B####>>>>#######=..........",
			"............=#######mm#####B####>>>>#######=..........",
			"............==========================#####=..........",
			".....................................=#####=..........",
			".....................................=vvvvv=..........",
			".....................................=vvvvv=..........",
			".....................................=vvvvv=..........",
			".....................................=#####==========.",
			".....................................=##########>>ff=.",
			".....................................=##########>>ff=.",
			".....................................=##########>>ff=.",
			".....................................=##########>>ff=.",
			".....................................=##########>>ff=.",
			".....................................================.",
			"......................................................"
		],
		heights: [
			"000000000000000000000000000000000000000000000000000000",
			"000000000000000000000000000000000000000000000000000000",
			"00mmmmmmlkjjjjjjjj000000000000000000000000000000000000",
			"00mmmmmmlkjjjjjjjj000000000000000000000000000000000000",
			"00mmmmmmlkjjjjjjjj000000000000000000000000000000000000",
			"00mmmmmmlkjjjjjjjj000000000000000000000000000000000000",
			"00mmmmmmlkjjjjjjjj000000000000000000000000000000000000",
			"0000000000000jjjjj000000000000000000000000000000000000",
			"0000000000000jjjjj000000000000000000000000000000000000",
			"0000000000000jjjjj000000000000000000000000000000000000",
			"0000000000000jjjjj000000000000000000000000000000000000",
			"0000000000000iiiii000000000000000000000000000000000000",
			"0000000000000hhhhh000000000000000000000000000000000000",
			"0000000000000ggggg000000000000000000000000000000000000",
			"0000000000000ggggg000000000000000000000000000000000000",
			"0000000000000ggggg000000000000000000000000000000000000",
			"0000000000000ggggg000000000000000000000000000000000000",
			"0000000000000ggggg000000000000000000000000000000000000",
			"0000000000000ggggggggggggggggggggfedccccccc00000000000",
			"0000000000000ggggggggggggggggggggfedccccccc00000000000",
			"0000000000000ggggggggg000000gggggfedccccccc00000000000",
			"0000000000000ggggggggggggggggggggfedccccccc00000000000",
			"0000000000000ggggggggggggggggggggfedccccccc00000000000",
			"00000000000000000000000000000000000000ccccc00000000000",
			"00000000000000000000000000000000000000ccccc00000000000",
			"00000000000000000000000000000000000000ccccc00000000000",
			"00000000000000000000000000000000000000bbbbb00000000000",
			"00000000000000000000000000000000000000aaaaa00000000000",
			"000000000000000000000000000000000000009999900000000000",
			"000000000000000000000000000000000000009999999999987700",
			"000000000000000000000000000000000000009999999999987700",
			"000000000000000000000000000000000000009999999999987700",
			"000000000000000000000000000000000000009999999999987700",
			"000000000000000000000000000000000000009999999999987700",
			"000000000000000000000000000000000000000000000000000000",
			"000000000000000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[7.5, 4.5],
			[8.5, 4.5],
			[9.5, 4.5],
			[12.5, 4.5],
			[14.5, 4.5],
			[15.5, 4.5],
			[15.5, 9.5],
			[15.5, 10.5],
			[15.5, 11.5],
			[15.5, 12.5],
			[15.5, 14.5],
			[15.5, 17.5],
			[15.5, 19.5],
			[15.5, 20.5],
			[18.5, 20.5],
			[21.5, 20.5],
			[30.5, 20.5],
			[31.5, 20.5],
			[32.5, 20.5],
			[33.5, 20.5],
			[34.5, 20.5],
			[35.5, 20.5],
			[38.5, 20.5],
			[39.5, 20.5],
			[40.5, 20.5],
			[40.5, 24.5],
			[40.5, 25.5],
			[40.5, 26.5],
			[40.5, 27.5],
			[40.5, 30.5],
			[40.5, 31.5],
			[45.5, 31.5],
			[47.5, 31.5],
			[48.5, 31.5],
			[49.5, 31.5],
			[51.5, 31.5]
		],
		medals: {
			gold: 22,
			silver: 33,
			bronze: 51,
			goldMaths: 20
		},
		hardSeconds: 44,
		gates: [{
			sign: [19, 20],
			after: 18,
			tunnels: [{
				door: 0,
				cells: [
					[22, 18],
					[22, 19],
					[23, 18],
					[23, 19],
					[24, 18],
					[24, 19],
					[25, 18],
					[25, 19],
					[26, 18],
					[26, 19]
				],
				route: [
					[22.5, 19],
					[24.5, 19],
					[26.5, 19],
					[27.5, 19]
				],
				dead: [
					[22.5, 19],
					[24.5, 19],
					[26.5, 19],
					[24.5, 19],
					[22.5, 19]
				]
			}, {
				door: 1,
				cells: [
					[22, 21],
					[22, 22],
					[23, 21],
					[23, 22],
					[24, 21],
					[24, 22],
					[25, 21],
					[25, 22],
					[26, 21],
					[26, 22]
				],
				route: [
					[22.5, 22],
					[24.5, 22],
					[26.5, 22],
					[27.5, 22]
				],
				dead: [
					[22.5, 22],
					[24.5, 22],
					[26.5, 22],
					[24.5, 22],
					[22.5, 22]
				]
			}]
		}]
	},
	{
		id: "crown-range",
		name: "Crown Range Zig-Zag",
		rows: [
			"..............................................",
			".....=====================....................",
			".....=##############>>#######.................",
			".....=#######b######>>#######.................",
			".....=s#############>>#######.................",
			".....=###########b##>>#######.................",
			".....=##############>>#######.................",
			".....===================#####.................",
			"....#####<<###B#####mm#######.................",
			"....#####<<###B#####mm#######.................",
			"....#####<<###======mm#######.................",
			"....#####<<###A#####mm#######.................",
			"....#####<<###A#####mm#######.................",
			"....#####================.....................",
			"....###############>>cc#####..................",
			"....############b##>>cc#####..................",
			"....###############>>cc#####..................",
			"....########b######>>cc#####..................",
			"....###############>>cc#####..................",
			"........===============#####==============....",
			".......................###############>>#####.",
			".......................############b##>>#####.",
			".......................###############>>#####.",
			".......................########b######>>#####.",
			".......................###############>>#####.",
			"........................================#####.",
			".....................#######<<###############.",
			".....................#######<<##b############.",
			".....................#######<<###############.",
			".....................#######<<######b########.",
			".....................#######<<###############.",
			"....=================#####===============.....",
			".#####<<###D#####mm#######....................",
			".#####<<###D#####mm#######....................",
			".#####<<###======mm#######....................",
			".#####<<###C#####mm#######....................",
			".#####<<###C#####mm#######....................",
			".#####================........................",
			".###########>>fff=............................",
			".###########>>fff=............................",
			".###########>>fff=............................",
			".###########>>fff=............................",
			".###########>>fff=............................",
			".....=============............................",
			".............................................."
		],
		heights: [
			"0000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000",
			"000000ooooooooooooooonmmmmmmm00000000000000000",
			"000000ooooooooooooooonmmmmmmm00000000000000000",
			"000000ooooooooooooooonmmmmmmm00000000000000000",
			"000000ooooooooooooooonmmmmmmm00000000000000000",
			"000000ooooooooooooooonmmmmmmm00000000000000000",
			"000000000000000000000000mmmmm00000000000000000",
			"0000kkkkklmmmmmmmmmmmmmmmmmmm00000000000000000",
			"0000kkkkklmmmmmmmmmmmmmmmmmmm00000000000000000",
			"0000kkkkklmmmm000000mmmmmmmmm00000000000000000",
			"0000kkkkklmmmmmmmmmmmmmmmmmmm00000000000000000",
			"0000kkkkklmmmmmmmmmmmmmmmmmmm00000000000000000",
			"0000kkkkk0000000000000000000000000000000000000",
			"0000kkkkkkkkkkkkkkkkjiiiiiii000000000000000000",
			"0000kkkkkkkkkkkkkkkkjiiiiiii000000000000000000",
			"0000kkkkkkkkkkkkkkkkjiiiiiii000000000000000000",
			"0000kkkkkkkkkkkkkkkkjiiiiiii000000000000000000",
			"0000kkkkkkkkkkkkkkkkjiiiiiii000000000000000000",
			"00000000000000000000000iiiii000000000000000000",
			"00000000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"00000000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"00000000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"00000000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"00000000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"0000000000000000000000000000000000000000ggggg0",
			"000000000000000000000eeeeeeefgggggggggggggggg0",
			"000000000000000000000eeeeeeefgggggggggggggggg0",
			"000000000000000000000eeeeeeefgggggggggggggggg0",
			"000000000000000000000eeeeeeefgggggggggggggggg0",
			"000000000000000000000eeeeeeefgggggggggggggggg0",
			"000000000000000000000eeeee00000000000000000000",
			"0cccccdeeeeeeeeeeeeeeeeeee00000000000000000000",
			"0cccccdeeeeeeeeeeeeeeeeeee00000000000000000000",
			"0cccccdeeee000000eeeeeeeee00000000000000000000",
			"0cccccdeeeeeeeeeeeeeeeeeee00000000000000000000",
			"0cccccdeeeeeeeeeeeeeeeeeee00000000000000000000",
			"0ccccc0000000000000000000000000000000000000000",
			"0ccccccccccccbaaa00000000000000000000000000000",
			"0ccccccccccccbaaa00000000000000000000000000000",
			"0ccccccccccccbaaa00000000000000000000000000000",
			"0ccccccccccccbaaa00000000000000000000000000000",
			"0ccccccccccccbaaa00000000000000000000000000000",
			"0000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000"
		],
		route: [
			[8.5, 4.5],
			[9.5, 4.5],
			[12.5, 4.5],
			[15.5, 4.5],
			[18.5, 4.5],
			[19.5, 4.5],
			[20.5, 4.5],
			[21.5, 4.5],
			[24.5, 4.5],
			[25.5, 4.5],
			[26.5, 4.5],
			[26.5, 9.5],
			[26.5, 10.5],
			[23.5, 10.5],
			[20.5, 10.5],
			[11.5, 10.5],
			[11.5, 10.5],
			[10.5, 10.5],
			[9.5, 10.5],
			[7.5, 10.5],
			[6.5, 10.5],
			[6.5, 15.5],
			[6.5, 16.5],
			[11.5, 16.5],
			[14.5, 16.5],
			[17.5, 16.5],
			[18.5, 16.5],
			[19.5, 16.5],
			[20.5, 16.5],
			[22.5, 16.5],
			[24.5, 16.5],
			[25.5, 16.5],
			[25.5, 21.5],
			[25.5, 22.5],
			[30.5, 22.5],
			[33.5, 22.5],
			[36.5, 22.5],
			[37.5, 22.5],
			[38.5, 22.5],
			[39.5, 22.5],
			[41.5, 22.5],
			[42.5, 22.5],
			[42.5, 27.5],
			[42.5, 28.5],
			[37.5, 28.5],
			[34.5, 28.5],
			[31.5, 28.5],
			[30.5, 28.5],
			[29.5, 28.5],
			[28.5, 28.5],
			[25.5, 28.5],
			[24.5, 28.5],
			[23.5, 28.5],
			[23.5, 33.5],
			[23.5, 34.5],
			[20.5, 34.5],
			[17.5, 34.5],
			[8.5, 34.5],
			[8.5, 34.5],
			[7.5, 34.5],
			[6.5, 34.5],
			[4.5, 34.5],
			[3.5, 34.5],
			[3.5, 39.5],
			[3.5, 40.5],
			[8.5, 40.5],
			[11.5, 40.5],
			[12.5, 40.5],
			[13.5, 40.5],
			[16.5, 40.5]
		],
		medals: {
			gold: 50,
			silver: 74,
			bronze: 115,
			goldMaths: 48
		},
		hardSeconds: 100,
		gates: [{
			sign: [22, 10],
			after: 15,
			tunnels: [{
				door: 0,
				cells: [
					[19, 12],
					[19, 11],
					[18, 12],
					[18, 11],
					[17, 12],
					[17, 11],
					[16, 12],
					[16, 11],
					[15, 12],
					[15, 11]
				],
				route: [
					[19.5, 12],
					[17.5, 12],
					[15.5, 12],
					[14.5, 12]
				],
				dead: [
					[19.5, 12],
					[17.5, 12],
					[15.5, 12],
					[17.5, 12],
					[19.5, 12]
				]
			}, {
				door: 1,
				cells: [
					[19, 9],
					[19, 8],
					[18, 9],
					[18, 8],
					[17, 9],
					[17, 8],
					[16, 9],
					[16, 8],
					[15, 9],
					[15, 8]
				],
				route: [
					[19.5, 9],
					[17.5, 9],
					[15.5, 9],
					[14.5, 9]
				],
				dead: [
					[19.5, 9],
					[17.5, 9],
					[15.5, 9],
					[17.5, 9],
					[19.5, 9]
				]
			}]
		}, {
			sign: [19, 34],
			after: 57,
			tunnels: [{
				door: 2,
				cells: [
					[16, 36],
					[16, 35],
					[15, 36],
					[15, 35],
					[14, 36],
					[14, 35],
					[13, 36],
					[13, 35],
					[12, 36],
					[12, 35]
				],
				route: [
					[16.5, 36],
					[14.5, 36],
					[12.5, 36],
					[11.5, 36]
				],
				dead: [
					[16.5, 36],
					[14.5, 36],
					[12.5, 36],
					[14.5, 36],
					[16.5, 36]
				]
			}, {
				door: 3,
				cells: [
					[16, 33],
					[16, 32],
					[15, 33],
					[15, 32],
					[14, 33],
					[14, 32],
					[13, 33],
					[13, 32],
					[12, 33],
					[12, 32]
				],
				route: [
					[16.5, 33],
					[14.5, 33],
					[12.5, 33],
					[11.5, 33]
				],
				dead: [
					[16.5, 33],
					[14.5, 33],
					[12.5, 33],
					[14.5, 33],
					[16.5, 33]
				]
			}]
		}]
	},
	{
		id: "geyser-valley",
		name: "Geyser Valley",
		rows: [
			".........................................................................",
			".===============================.........................................",
			".=#####>>mmm##=...###>>cc######=.........................................",
			".=#####>>mmm##=...###>>cc######=.........................................",
			".=s####>>mmm##g...###>>cc######=.........................................",
			".=#####>>mmm##=...###>>cc######=.........................................",
			".=#####>>mmm##=...###>>cc######=.........................................",
			".=========================#####=.........................................",
			".........................=vvvvv=.........................................",
			".........................=vvvvv=.........................................",
			".........................=#####=.........................................",
			".........................=#####=.........................................",
			".........................==ggg==.........................................",
			".........................=.....=.........................................",
			".........................=.....=.....................=============.......",
			".........................=.....=.....................=#mm#####C##=.......",
			".........................=#####=======================#mm#####C##=======.",
			".........................=#######mm#####A##mm>>>##..###mm======###>>fff=.",
			".........................=#######mm#####A##mm>>>##..###mm#####D###>>fff=.",
			".........................=#######mm======##mm>>>g#..###mm#####D###>>fff=.",
			".........................=#######mm#####B##mm>>>##..###mm======###>>fff=.",
			".........................=#######mm#####B##mm>>>##..###mm#####E###>>fff=.",
			".........................=============================#mm#####E##=======.",
			".....................................................=#mm======##=.......",
			".....................................................=====....====.......",
			"........................................................................."
		],
		heights: [
			"0000000000000000000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000000000000000000",
			"00ggggggfeeeee0000eeeedcccccccc000000000000000000000000000000000000000000",
			"00ggggggfeeeee0000eeeedcccccccc000000000000000000000000000000000000000000",
			"00ggggggfeeeeee000eeeedcccccccc000000000000000000000000000000000000000000",
			"00ggggggfeeeee0000eeeedcccccccc000000000000000000000000000000000000000000",
			"00ggggggfeeeee0000eeeedcccccccc000000000000000000000000000000000000000000",
			"00000000000000000000000000ccccc000000000000000000000000000000000000000000",
			"00000000000000000000000000ccccc000000000000000000000000000000000000000000",
			"00000000000000000000000000bbbbb000000000000000000000000000000000000000000",
			"00000000000000000000000000aaaaa000000000000000000000000000000000000000000",
			"00000000000000000000000000aaaaa000000000000000000000000000000000000000000",
			"000000000000000000000000000aaa0000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000007777777777700000000",
			"00000000000000000000000000aaaaa000000000000000000000007777777777700000000",
			"00000000000000000000000000aaaaaaaaaaaaaaaaaaaa987700777770000007777655500",
			"00000000000000000000000000aaaaaaaaaaaaaaaaaaaa987700777777777777777655500",
			"00000000000000000000000000aaaaaaaaa000000aaaaa987700777777777777777655500",
			"00000000000000000000000000aaaaaaaaaaaaaaaaaaaa987700777770000007777655500",
			"00000000000000000000000000aaaaaaaaaaaaaaaaaaaa987700777777777777777655500",
			"0000000000000000000000000000000000000000000000000000007777777777700000000",
			"0000000000000000000000000000000000000000000000000000007770000007700000000",
			"0000000000000000000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[7.5, 4.5],
			[8.5, 4.5],
			[11.5, 4.5],
			[13.5, 4.5],
			[14.5, 4.5],
			[15.5, 4.5],
			[16.5, 4.5],
			[17.5, 4.5],
			[20.5, 4.5],
			[21.5, 4.5],
			[22.5, 4.5],
			[24.5, 4.5],
			[27.5, 4.5],
			[28.5, 4.5],
			[28.5, 7.5],
			[28.5, 8.5],
			[28.5, 9.5],
			[28.5, 11.5],
			[28.5, 12.5],
			[28.5, 13.5],
			[28.5, 14.5],
			[28.5, 15.5],
			[28.5, 18.5],
			[28.5, 19.5],
			[31.5, 19.5],
			[34.5, 19.5],
			[43.5, 19.5],
			[44.5, 19.5],
			[45.5, 19.5],
			[46.5, 19.5],
			[47.5, 19.5],
			[49.5, 19.5],
			[50.5, 19.5],
			[51.5, 19.5],
			[53.5, 19.5],
			[56.5, 19.5],
			[65.5, 19.5],
			[65.5, 19.5],
			[66.5, 19.5],
			[67.5, 19.5],
			[70.5, 19.5]
		],
		medals: {
			gold: 28,
			silver: 43,
			bronze: 64,
			goldMaths: 26
		},
		hardSeconds: 56,
		gates: [{
			sign: [32, 19],
			after: 28,
			tunnels: [{
				door: 0,
				cells: [
					[35, 17],
					[35, 18],
					[36, 17],
					[36, 18],
					[37, 17],
					[37, 18],
					[38, 17],
					[38, 18],
					[39, 17],
					[39, 18]
				],
				route: [
					[35.5, 18],
					[37.5, 18],
					[39.5, 18],
					[40.5, 18]
				],
				dead: [
					[35.5, 18],
					[37.5, 18],
					[39.5, 18],
					[37.5, 18],
					[35.5, 18]
				]
			}, {
				door: 1,
				cells: [
					[35, 20],
					[35, 21],
					[36, 20],
					[36, 21],
					[37, 20],
					[37, 21],
					[38, 20],
					[38, 21],
					[39, 20],
					[39, 21]
				],
				route: [
					[35.5, 21],
					[37.5, 21],
					[39.5, 21],
					[40.5, 21]
				],
				dead: [
					[35.5, 21],
					[37.5, 21],
					[39.5, 21],
					[37.5, 21],
					[35.5, 21]
				]
			}]
		}, {
			sign: [54, 19],
			after: 38,
			tunnels: [
				{
					door: 2,
					cells: [
						[57, 15],
						[57, 16],
						[58, 15],
						[58, 16],
						[59, 15],
						[59, 16],
						[60, 15],
						[60, 16],
						[61, 15],
						[61, 16]
					],
					route: [
						[57.5, 16],
						[59.5, 16],
						[61.5, 16],
						[62.5, 16]
					],
					dead: [
						[57.5, 16],
						[59.5, 16],
						[61.5, 16],
						[59.5, 16],
						[57.5, 16]
					]
				},
				{
					door: 3,
					cells: [
						[57, 18],
						[57, 19],
						[58, 18],
						[58, 19],
						[59, 18],
						[59, 19],
						[60, 18],
						[60, 19],
						[61, 18],
						[61, 19]
					],
					route: [
						[57.5, 19],
						[59.5, 19],
						[61.5, 19],
						[62.5, 19]
					],
					dead: [
						[57.5, 19],
						[59.5, 19],
						[61.5, 19],
						[59.5, 19],
						[57.5, 19]
					]
				},
				{
					door: 4,
					cells: [
						[57, 21],
						[57, 22],
						[58, 21],
						[58, 22],
						[59, 21],
						[59, 22],
						[60, 21],
						[60, 22],
						[61, 21],
						[61, 22]
					],
					route: [
						[57.5, 22],
						[59.5, 22],
						[61.5, 22],
						[62.5, 22]
					],
					dead: [
						[57.5, 22],
						[59.5, 22],
						[61.5, 22],
						[59.5, 22],
						[57.5, 22]
					]
				}
			]
		}]
	},
	{
		id: "glacier-run",
		name: "Glacier Run",
		rows: [
			"..........................................................",
			".===========================..............................",
			".=iiiiiiiii>>>iiiij..i#####=..............................",
			".=iiiiiiiii>>>iiiij..i#####=..............................",
			".=siiiiiiii>>>iiiij..i#####=..............................",
			".=iiiiiiiii>>>iiiij..i#####=..............................",
			".=iiiiiiiii>>>iiiij..i#####=..............................",
			".=====================iiiii=..............................",
			".....................=#####=..............................",
			".....................=mmmmm=..............................",
			".....................=mmmmm=..............................",
			".....................=##=##=..............................",
			".....................=##=##=..............................",
			".....................=##=##=..............................",
			".....................=##=##=..............................",
			".....................=##=##=..............................",
			".....................=AA=BB=..............................",
			".....................=#####=..............................",
			".....................=#####=..............................",
			".....................=iiiii=..............................",
			".....................=vvvvv=..............................",
			".....................=vvvvv=..............................",
			".....................=vvvvv=..............................",
			".....................=iiiii=..............................",
			".....................=iiiii=..............................",
			".....................=iiiii=..............................",
			".....................=ccccc=..............................",
			".....................=ccccc=..............................",
			".....................=iiiii=..............................",
			".....................=iiiii=..............................",
			".....................=jjjjj=..............................",
			".....................=.....=....=============.............",
			".....................=.....=....=#mm#####C##=.............",
			".....................=iiiii======#mm#####C##=============.",
			".....................=#####iii>>m#mm======##mm>>mmmmmmff=.",
			".....................=#####iii>>m#mm#####D##mm>>mmmmmmff=.",
			".....................=#####iii>>m#mm#####D##mm>>mmmmmmff=.",
			".....................=#####iii>>m#mm======##mm>>mmmmbmff=.",
			".....................=#####iii>>m#mm#####E##mm>>mmmmmmff=.",
			".....................============#mm#####E##=============.",
			"................................=#mm======##=.............",
			"................................=====....====.............",
			".........................................................."
		],
		heights: [
			"0000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn0000000000000000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn0000000000000000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn0000000000000000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn0000000000000000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn0000000000000000000000000000000",
			"0000000000000000000000nnnnn0000000000000000000000000000000",
			"0000000000000000000000nnnnn0000000000000000000000000000000",
			"0000000000000000000000nnnnn0000000000000000000000000000000",
			"0000000000000000000000nnnnn0000000000000000000000000000000",
			"0000000000000000000000nn0nn0000000000000000000000000000000",
			"0000000000000000000000nn0nn0000000000000000000000000000000",
			"0000000000000000000000nn0nn0000000000000000000000000000000",
			"0000000000000000000000nn0nn0000000000000000000000000000000",
			"0000000000000000000000nn0nn0000000000000000000000000000000",
			"0000000000000000000000nn0nn0000000000000000000000000000000",
			"0000000000000000000000nnnnn0000000000000000000000000000000",
			"0000000000000000000000nnnnn0000000000000000000000000000000",
			"0000000000000000000000nnnnn0000000000000000000000000000000",
			"0000000000000000000000nnnnn0000000000000000000000000000000",
			"0000000000000000000000mmmmm0000000000000000000000000000000",
			"0000000000000000000000lllll0000000000000000000000000000000",
			"0000000000000000000000kkkkk0000000000000000000000000000000",
			"0000000000000000000000kkkkk0000000000000000000000000000000",
			"0000000000000000000000kkkkk0000000000000000000000000000000",
			"0000000000000000000000kkkkk0000000000000000000000000000000",
			"0000000000000000000000kkkkk0000000000000000000000000000000",
			"0000000000000000000000kkkkk0000000000000000000000000000000",
			"0000000000000000000000kkkkk0000000000000000000000000000000",
			"0000000000000000000000kkkkk0000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000",
			"000000000000000000000000000000000iiiiiiiiiii00000000000000",
			"0000000000000000000000kkkkk000000iiiiiiiiiii00000000000000",
			"0000000000000000000000kkkkkkkkkjiiii000000iiiiihgggggggg00",
			"0000000000000000000000kkkkkkkkkjiiiiiiiiiiiiiiihgggggggg00",
			"0000000000000000000000kkkkkkkkkjiiiiiiiiiiiiiiihgggggggg00",
			"0000000000000000000000kkkkkkkkkjiiii000000iiiiihgggggggg00",
			"0000000000000000000000kkkkkkkkkjiiiiiiiiiiiiiiihgggggggg00",
			"000000000000000000000000000000000iiiiiiiiiii00000000000000",
			"000000000000000000000000000000000iii000000ii00000000000000",
			"0000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[9.5, 4.5],
			[10.5, 4.5],
			[11.5, 4.5],
			[12.5, 4.5],
			[13.5, 4.5],
			[16.5, 4.5],
			[17.5, 4.5],
			[18.5, 4.5],
			[19.5, 4.5],
			[20.5, 4.5],
			[23.5, 4.5],
			[24.5, 4.5],
			[24.5, 7.5],
			[24.5, 10.5],
			[24.5, 19.5],
			[24.5, 19.5],
			[24.5, 20.5],
			[24.5, 21.5],
			[24.5, 22.5],
			[24.5, 25.5],
			[24.5, 27.5],
			[24.5, 29.5],
			[24.5, 30.5],
			[24.5, 31.5],
			[24.5, 32.5],
			[24.5, 35.5],
			[24.5, 36.5],
			[29.5, 36.5],
			[30.5, 36.5],
			[31.5, 36.5],
			[32.5, 36.5],
			[35.5, 36.5],
			[44.5, 36.5],
			[45.5, 36.5],
			[46.5, 36.5],
			[47.5, 36.5],
			[50.5, 36.5],
			[53.5, 36.5],
			[55.5, 36.5]
		],
		medals: {
			gold: 27,
			silver: 42,
			bronze: 62,
			goldMaths: 25
		},
		hardSeconds: 54,
		gates: [{
			sign: [24, 8],
			after: 16,
			tunnels: [{
				door: 0,
				cells: [
					[22, 11],
					[23, 11],
					[22, 12],
					[23, 12],
					[22, 13],
					[23, 13],
					[22, 14],
					[23, 14],
					[22, 15],
					[23, 15]
				],
				route: [
					[23, 11.5],
					[23, 13.5],
					[23, 15.5],
					[23, 16.5]
				],
				dead: [
					[23, 11.5],
					[23, 13.5],
					[23, 15.5],
					[23, 13.5],
					[23, 11.5]
				]
			}, {
				door: 1,
				cells: [
					[25, 11],
					[26, 11],
					[25, 12],
					[26, 12],
					[25, 13],
					[26, 13],
					[25, 14],
					[26, 14],
					[25, 15],
					[26, 15]
				],
				route: [
					[26, 11.5],
					[26, 13.5],
					[26, 15.5],
					[26, 16.5]
				],
				dead: [
					[26, 11.5],
					[26, 13.5],
					[26, 15.5],
					[26, 13.5],
					[26, 11.5]
				]
			}]
		}, {
			sign: [33, 36],
			after: 34,
			tunnels: [
				{
					door: 2,
					cells: [
						[36, 32],
						[36, 33],
						[37, 32],
						[37, 33],
						[38, 32],
						[38, 33],
						[39, 32],
						[39, 33],
						[40, 32],
						[40, 33]
					],
					route: [
						[36.5, 33],
						[38.5, 33],
						[40.5, 33],
						[41.5, 33]
					],
					dead: [
						[36.5, 33],
						[38.5, 33],
						[40.5, 33],
						[38.5, 33],
						[36.5, 33]
					]
				},
				{
					door: 3,
					cells: [
						[36, 35],
						[36, 36],
						[37, 35],
						[37, 36],
						[38, 35],
						[38, 36],
						[39, 35],
						[39, 36],
						[40, 35],
						[40, 36]
					],
					route: [
						[36.5, 36],
						[38.5, 36],
						[40.5, 36],
						[41.5, 36]
					],
					dead: [
						[36.5, 36],
						[38.5, 36],
						[40.5, 36],
						[38.5, 36],
						[36.5, 36]
					]
				},
				{
					door: 4,
					cells: [
						[36, 38],
						[36, 39],
						[37, 38],
						[37, 39],
						[38, 38],
						[38, 39],
						[39, 38],
						[39, 39],
						[40, 38],
						[40, 39]
					],
					route: [
						[36.5, 39],
						[38.5, 39],
						[40.5, 39],
						[41.5, 39]
					],
					dead: [
						[36.5, 39],
						[38.5, 39],
						[40.5, 39],
						[38.5, 39],
						[36.5, 39]
					]
				}
			]
		}],
		gems: [{
			sign: [40, 36],
			groups: [
				{
					after: 36,
					spots: [
						[45.5, 35.5],
						[45.5, 36.5],
						[45.5, 37.5]
					]
				},
				{
					after: 39,
					spots: [
						[50.5, 35.5],
						[50.5, 36.5],
						[50.5, 37.5]
					]
				},
				{
					after: 40,
					spots: [
						[53.5, 35.5],
						[53.5, 36.5],
						[53.5, 37.5]
					]
				}
			]
		}]
	},
	{
		id: "windy-welly",
		name: "Windy Welly",
		rows: [
			".........................................",
			".=======================================.",
			".=#####eeeeee##mm#####A###q###>>cc#####=.",
			".=#####eeeeee##mm#####A###q###>>cc#####=.",
			".=s####eeeeee##mm======###q###>>cc#####=.",
			".=#####eeeeee##mm#####B###q###>>cc#####=.",
			".=#####eeeeee##mm#####B###q###>>cc#####=.",
			".=================================ooooo=.",
			".................................=ooooo=.",
			".................................=ooooo=.",
			".................................=ooooo=.",
			".................................=ooooo=.",
			".................................=ooooo=.",
			".................................=ooooo=.",
			".................................=#####=.",
			".................................=#####=.",
			".................................=qqqqq=.",
			".................................=#####=.",
			".................................=#####=.",
			".................................=#####=.",
			".................................=vvvvv=.",
			".................................=vvvvv=.",
			"...===============================vvvvv=.",
			"...=#####cc<<###q###D#####mm##wwww#####=.",
			"...=#####cc<<###q###D#####mm##wwww#####=.",
			"...=#####cc<<###q###======mm##wwww#####=.",
			"...=#####cc<<###q###C#####mm##wwww#####=.",
			"...=#####cc<<###q###C#####mm##wwww#####=.",
			"...=#####===============================.",
			"...=#####=...............................",
			"...=#####=...............................",
			"...=qqqqq=...............................",
			"...=ooooo=...............................",
			"...=ooooo=...............................",
			"...=ooooo===================.............",
			"...=#######mm#####E###>>fff=.............",
			"...=#######mm#####E###>>fff=.............",
			"...=#######mm======###>>fff=.............",
			"...=#######mm#####F###>>fff=.............",
			"...=#######mm#####F###>>fff=.............",
			"...=========================.............",
			"........................................."
		],
		heights: [
			"00000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000",
			"00iiiiiiiiiiiiiiiiiiiiiiiiiiiiihggggggg00",
			"00iiiiiiiiiiiiiiiiiiiiiiiiiiiiihggggggg00",
			"00iiiiiiiiiiiiiii000000iiiiiiiihggggggg00",
			"00iiiiiiiiiiiiiiiiiiiiiiiiiiiiihggggggg00",
			"00iiiiiiiiiiiiiiiiiiiiiiiiiiiiihggggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000ggggg00",
			"0000000000000000000000000000000000fffff00",
			"0000000000000000000000000000000000eeeee00",
			"0000bbbbbbbcddddddddddddddddddddddddddd00",
			"0000bbbbbbbcddddddddddddddddddddddddddd00",
			"0000bbbbbbbcdddddddd000000ddddddddddddd00",
			"0000bbbbbbbcddddddddddddddddddddddddddd00",
			"0000bbbbbbbcddddddddddddddddddddddddddd00",
			"0000bbbbb00000000000000000000000000000000",
			"0000bbbbb00000000000000000000000000000000",
			"0000bbbbb00000000000000000000000000000000",
			"0000bbbbb00000000000000000000000000000000",
			"0000bbbbb00000000000000000000000000000000",
			"0000bbbbb00000000000000000000000000000000",
			"0000bbbbb00000000000000000000000000000000",
			"0000bbbbbbbbbbbbbbbbbbba99900000000000000",
			"0000bbbbbbbbbbbbbbbbbbba99900000000000000",
			"0000bbbbbbbbb000000bbbba99900000000000000",
			"0000bbbbbbbbbbbbbbbbbbba99900000000000000",
			"0000bbbbbbbbbbbbbbbbbbba99900000000000000",
			"00000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[8.5, 4.5],
			[11.5, 4.5],
			[12.5, 4.5],
			[13.5, 4.5],
			[16.5, 4.5],
			[25.5, 4.5],
			[25.5, 4.5],
			[26.5, 4.5],
			[29.5, 4.5],
			[30.5, 4.5],
			[31.5, 4.5],
			[33.5, 4.5],
			[35.5, 4.5],
			[36.5, 4.5],
			[36.5, 8.5],
			[36.5, 11.5],
			[36.5, 13.5],
			[36.5, 15.5],
			[36.5, 16.5],
			[36.5, 19.5],
			[36.5, 20.5],
			[36.5, 21.5],
			[36.5, 22.5],
			[36.5, 24.5],
			[36.5, 25.5],
			[31.5, 25.5],
			[30.5, 25.5],
			[29.5, 25.5],
			[26.5, 25.5],
			[17.5, 25.5],
			[17.5, 25.5],
			[16.5, 25.5],
			[13.5, 25.5],
			[12.5, 25.5],
			[11.5, 25.5],
			[9.5, 25.5],
			[7.5, 25.5],
			[6.5, 25.5],
			[6.5, 30.5],
			[6.5, 31.5],
			[6.5, 34.5],
			[6.5, 36.5],
			[6.5, 37.5],
			[9.5, 37.5],
			[12.5, 37.5],
			[21.5, 37.5],
			[21.5, 37.5],
			[22.5, 37.5],
			[23.5, 37.5],
			[26.5, 37.5]
		],
		medals: {
			gold: 49,
			silver: 73,
			bronze: 113,
			goldMaths: 45
		},
		hardSeconds: 98,
		gates: [
			{
				sign: [14, 4],
				after: 7,
				tunnels: [{
					door: 0,
					cells: [
						[17, 2],
						[17, 3],
						[18, 2],
						[18, 3],
						[19, 2],
						[19, 3],
						[20, 2],
						[20, 3],
						[21, 2],
						[21, 3]
					],
					route: [
						[17.5, 3],
						[19.5, 3],
						[21.5, 3],
						[22.5, 3]
					],
					dead: [
						[17.5, 3],
						[19.5, 3],
						[21.5, 3],
						[19.5, 3],
						[17.5, 3]
					]
				}, {
					door: 1,
					cells: [
						[17, 5],
						[17, 6],
						[18, 5],
						[18, 6],
						[19, 5],
						[19, 6],
						[20, 5],
						[20, 6],
						[21, 5],
						[21, 6]
					],
					route: [
						[17.5, 6],
						[19.5, 6],
						[21.5, 6],
						[22.5, 6]
					],
					dead: [
						[17.5, 6],
						[19.5, 6],
						[21.5, 6],
						[19.5, 6],
						[17.5, 6]
					]
				}]
			},
			{
				sign: [28, 25],
				after: 31,
				tunnels: [{
					door: 2,
					cells: [
						[25, 27],
						[25, 26],
						[24, 27],
						[24, 26],
						[23, 27],
						[23, 26],
						[22, 27],
						[22, 26],
						[21, 27],
						[21, 26]
					],
					route: [
						[25.5, 27],
						[23.5, 27],
						[21.5, 27],
						[20.5, 27]
					],
					dead: [
						[25.5, 27],
						[23.5, 27],
						[21.5, 27],
						[23.5, 27],
						[25.5, 27]
					]
				}, {
					door: 3,
					cells: [
						[25, 24],
						[25, 23],
						[24, 24],
						[24, 23],
						[23, 24],
						[23, 23],
						[22, 24],
						[22, 23],
						[21, 24],
						[21, 23]
					],
					route: [
						[25.5, 24],
						[23.5, 24],
						[21.5, 24],
						[20.5, 24]
					],
					dead: [
						[25.5, 24],
						[23.5, 24],
						[21.5, 24],
						[23.5, 24],
						[25.5, 24]
					]
				}]
			},
			{
				sign: [10, 37],
				after: 47,
				tunnels: [{
					door: 4,
					cells: [
						[13, 35],
						[13, 36],
						[14, 35],
						[14, 36],
						[15, 35],
						[15, 36],
						[16, 35],
						[16, 36],
						[17, 35],
						[17, 36]
					],
					route: [
						[13.5, 36],
						[15.5, 36],
						[17.5, 36],
						[18.5, 36]
					],
					dead: [
						[13.5, 36],
						[15.5, 36],
						[17.5, 36],
						[15.5, 36],
						[13.5, 36]
					]
				}, {
					door: 5,
					cells: [
						[13, 38],
						[13, 39],
						[14, 38],
						[14, 39],
						[15, 38],
						[15, 39],
						[16, 38],
						[16, 39],
						[17, 38],
						[17, 39]
					],
					route: [
						[13.5, 39],
						[15.5, 39],
						[17.5, 39],
						[18.5, 39]
					],
					dead: [
						[13.5, 39],
						[15.5, 39],
						[17.5, 39],
						[15.5, 39],
						[13.5, 39]
					]
				}]
			}
		],
		gems: [{
			sign: [24, 4],
			groups: [{
				after: 11,
				spots: [
					[29.5, 3.5],
					[29.5, 4.5],
					[29.5, 5.5]
				]
			}, {
				after: 22,
				spots: [
					[35.5, 19.5],
					[36.5, 19.5],
					[37.5, 19.5]
				]
			}]
		}, {
			sign: [18, 25],
			groups: [{
				after: 35,
				spots: [
					[13.5, 26.5],
					[13.5, 25.5],
					[13.5, 24.5]
				]
			}]
		}],
		wind: {
			dx: 0,
			dy: 1,
			period: 360,
			on: 70,
			warn: 40,
			force: 8
		}
	},
	{
		id: "alpine-crossing",
		name: "Alpine Crossing",
		rows: [
			".....................................................................................",
			".=======....................#mm#####A##..............................................",
			".=###########>##>##>##>##cc##mm#####A###t##t#####....................................",
			".=s##########>##>##>##>##cc##mm======###t##t#####....................................",
			".=###########>##>##>##>##cc##mm#####B###t##t#####....................................",
			".=======....................#mm#####B##.......###....................................",
			"...........................................#########.................................",
			"...........................................mmmmmmmmm.................................",
			"...........................................mmmmmmmmm.................................",
			"...........................................##=##=##..................................",
			"...........................................##=##=##..................................",
			"...........................................##=##=##..................................",
			"...........................................##=##=##..................................",
			"...........................................##=##=##..................................",
			"...........................................CC=DD=EE..................................",
			"...........................................#########.................................",
			"...........................................#########.................................",
			"..............................................###....................................",
			"..............................................###....................................",
			"..............................................vvv....................................",
			"..............................................vvv....................................",
			"..............................................###....................................",
			"..............................................###....................................",
			"..............................................ttt....................................",
			"..............................................###....................................",
			"..............................................###...................================.",
			"..............................................ccc...................=##mm#####F##ff=.",
			"..............................................########>##>##>##t###>>##mm#####F##ff=.",
			"..............................................########>##>##>##t###>>##mm======##ff=.",
			"..............................................########>##>##>##t###>>##mm#####G##ff=.",
			"....................................................................=##mm#####G##ff=.",
			"....................................................................================.",
			"....................................................................................."
		],
		heights: [
			"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000qqqqqqqqqqq0000000000000000000000000000000000000000000000",
			"00uuuuuuuuuuuutttsssrrrqqqqqqqqqqqqqqqqqqqqqqqqqq000000000000000000000000000000000000",
			"00uuuuuuuuuuuutttsssrrrqqqqqqqq000000qqqqqqqqqqqq000000000000000000000000000000000000",
			"00uuuuuuuuuuuutttsssrrrqqqqqqqqqqqqqqqqqqqqqqqqqq000000000000000000000000000000000000",
			"0000000000000000000000000000qqqqqqqqqqq0000000qqq000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qqqqqqqqq000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qqqqqqqqq000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qqqqqqqqq000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qq0qq0qq0000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qq0qq0qq0000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qq0qq0qq0000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qq0qq0qq0000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qq0qq0qq0000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qq0qq0qq0000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qqqqqqqqq000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000qqqqqqqqq000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000qqq000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000qqq000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000qqq000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000ppp000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000ooo000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000ooo000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000ooo000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000ooo000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000ooo000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000ooo00000000000000000000jjjjjjjjjjjjjj00",
			"0000000000000000000000000000000000000000000000ooooooooonnnmmmlllllllkjjjjjjjjjjjjjj00",
			"0000000000000000000000000000000000000000000000ooooooooonnnmmmlllllllkjjjj000000jjjj00",
			"0000000000000000000000000000000000000000000000ooooooooonnnmmmlllllllkjjjjjjjjjjjjjj00",
			"000000000000000000000000000000000000000000000000000000000000000000000jjjjjjjjjjjjjj00",
			"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 3.5],
			[6.5, 3.5],
			[9.5, 3.5],
			[12.5, 3.5],
			[13.5, 3.5],
			[15.5, 3.5],
			[16.5, 3.5],
			[18.5, 3.5],
			[19.5, 3.5],
			[21.5, 3.5],
			[22.5, 3.5],
			[24.5, 3.5],
			[26.5, 3.5],
			[27.5, 3.5],
			[30.5, 3.5],
			[39.5, 3.5],
			[39.5, 3.5],
			[40.5, 3.5],
			[42.5, 3.5],
			[43.5, 3.5],
			[45.5, 3.5],
			[46.5, 3.5],
			[47.5, 3.5],
			[47.5, 5.5],
			[47.5, 8.5],
			[47.5, 17.5],
			[47.5, 18.5],
			[47.5, 19.5],
			[47.5, 20.5],
			[47.5, 22.5],
			[47.5, 23.5],
			[47.5, 25.5],
			[47.5, 27.5],
			[47.5, 28.5],
			[51.5, 28.5],
			[52.5, 28.5],
			[53.5, 28.5],
			[54.5, 28.5],
			[56.5, 28.5],
			[57.5, 28.5],
			[59.5, 28.5],
			[60.5, 28.5],
			[62.5, 28.5],
			[63.5, 28.5],
			[66.5, 28.5],
			[67.5, 28.5],
			[68.5, 28.5],
			[69.5, 28.5],
			[72.5, 28.5],
			[81.5, 28.5],
			[82.5, 28.5]
		],
		medals: {
			gold: 35,
			silver: 57,
			bronze: 83,
			goldMaths: 31
		},
		hardSeconds: 70,
		gates: [
			{
				sign: [28, 3],
				after: 15,
				tunnels: [{
					door: 0,
					cells: [
						[31, 1],
						[31, 2],
						[32, 1],
						[32, 2],
						[33, 1],
						[33, 2],
						[34, 1],
						[34, 2],
						[35, 1],
						[35, 2]
					],
					route: [
						[31.5, 2],
						[33.5, 2],
						[35.5, 2],
						[36.5, 2]
					],
					dead: [
						[31.5, 2],
						[33.5, 2],
						[35.5, 2],
						[33.5, 2],
						[31.5, 2]
					]
				}, {
					door: 1,
					cells: [
						[31, 4],
						[31, 5],
						[32, 4],
						[32, 5],
						[33, 4],
						[33, 5],
						[34, 4],
						[34, 5],
						[35, 4],
						[35, 5]
					],
					route: [
						[31.5, 5],
						[33.5, 5],
						[35.5, 5],
						[36.5, 5]
					],
					dead: [
						[31.5, 5],
						[33.5, 5],
						[35.5, 5],
						[33.5, 5],
						[31.5, 5]
					]
				}]
			},
			{
				sign: [47, 6],
				after: 25,
				tunnels: [
					{
						door: 2,
						cells: [
							[43, 9],
							[44, 9],
							[43, 10],
							[44, 10],
							[43, 11],
							[44, 11],
							[43, 12],
							[44, 12],
							[43, 13],
							[44, 13]
						],
						route: [
							[44, 9.5],
							[44, 11.5],
							[44, 13.5],
							[44, 14.5]
						],
						dead: [
							[44, 9.5],
							[44, 11.5],
							[44, 13.5],
							[44, 11.5],
							[44, 9.5]
						]
					},
					{
						door: 3,
						cells: [
							[46, 9],
							[47, 9],
							[46, 10],
							[47, 10],
							[46, 11],
							[47, 11],
							[46, 12],
							[47, 12],
							[46, 13],
							[47, 13]
						],
						route: [
							[47, 9.5],
							[47, 11.5],
							[47, 13.5],
							[47, 14.5]
						],
						dead: [
							[47, 9.5],
							[47, 11.5],
							[47, 13.5],
							[47, 11.5],
							[47, 9.5]
						]
					},
					{
						door: 4,
						cells: [
							[49, 9],
							[50, 9],
							[49, 10],
							[50, 10],
							[49, 11],
							[50, 11],
							[49, 12],
							[50, 12],
							[49, 13],
							[50, 13]
						],
						route: [
							[50, 9.5],
							[50, 11.5],
							[50, 13.5],
							[50, 14.5]
						],
						dead: [
							[50, 9.5],
							[50, 11.5],
							[50, 13.5],
							[50, 11.5],
							[50, 9.5]
						]
					}
				]
			},
			{
				sign: [70, 28],
				after: 49,
				tunnels: [{
					door: 5,
					cells: [
						[73, 26],
						[73, 27],
						[74, 26],
						[74, 27],
						[75, 26],
						[75, 27],
						[76, 26],
						[76, 27],
						[77, 26],
						[77, 27]
					],
					route: [
						[73.5, 27],
						[75.5, 27],
						[77.5, 27],
						[78.5, 27]
					],
					dead: [
						[73.5, 27],
						[75.5, 27],
						[77.5, 27],
						[75.5, 27],
						[73.5, 27]
					]
				}, {
					door: 6,
					cells: [
						[73, 29],
						[73, 30],
						[74, 29],
						[74, 30],
						[75, 29],
						[75, 30],
						[76, 29],
						[76, 30],
						[77, 29],
						[77, 30]
					],
					route: [
						[73.5, 30],
						[75.5, 30],
						[77.5, 30],
						[78.5, 30]
					],
					dead: [
						[73.5, 30],
						[75.5, 30],
						[77.5, 30],
						[75.5, 30],
						[73.5, 30]
					]
				}]
			}
		],
		gems: [{
			sign: [7, 3],
			groups: [{
				after: 4,
				spots: [
					[12.5, 2.5],
					[12.5, 3.5],
					[12.5, 4.5]
				]
			}, {
				after: 21,
				spots: [
					[45.5, 2.5],
					[45.5, 3.5],
					[45.5, 4.5]
				]
			}]
		}, {
			sign: [47, 28],
			groups: [{
				after: 36,
				spots: [
					[52.5, 27.5],
					[52.5, 28.5],
					[52.5, 29.5]
				]
			}, {
				after: 45,
				spots: [
					[66.5, 27.5],
					[66.5, 28.5],
					[66.5, 29.5]
				]
			}]
		}],
		wind: {
			dx: 1,
			dy: 0,
			period: 420,
			on: 80,
			warn: 40,
			force: 6
		}
	}
];
//#endregion
//#region shared/marble/courses.ts
/**
* The courses, as frozen literals (docs/MARBLE-PLAN.md, section 3). The two `test-` courses are for the
* engine's tests and the first screens; the six New Zealand courses come in stage M.3.
* Medal times are set from each course's reference run (`reference.test.ts` keeps them honest).
*/
const TEST_EASY = {
	id: "test-easy",
	name: "Wide Hill",
	rows: [
		"================",
		"=##>>mm##>#>##f=",
		"=##>>mm##>#>##f=",
		"=s#>>mm#c>#>##f=",
		"=##>>mm##>#>##f=",
		"=##>>mm##>#>##f=",
		"================"
	],
	heights: [
		"0000000000000000",
		"0666544444332220",
		"0666544444332220",
		"0666544444332220",
		"0666544444332220",
		"0666544444332220",
		"0000000000000000"
	],
	route: [[8.5, 3.5], [14.5, 3.5]],
	medals: {
		gold: 4,
		silver: 7,
		bronze: 12
	},
	hardSeconds: 15
};
const TEST_HARD = {
	id: "test-hard",
	name: "Gap and Ice",
	rows: [
		"...................",
		"...................",
		"...................",
		".##>j..###iiii##>f.",
		".s#>j..#c#iiiib#>f.",
		".##>j..###iiii##>f.",
		"...................",
		"...................",
		"..................."
	],
	heights: [
		"0000000000000000000",
		"0000000000000000000",
		"0000000000000000000",
		"0555400444444444430",
		"0555400444444444430",
		"0555400444444444430",
		"0000000000000000000",
		"0000000000000000000",
		"0000000000000000000"
	],
	route: [
		[4.5, 4.5],
		[8.5, 4.5],
		[13.5, 3.5],
		[15.5, 3.5],
		[17.5, 4.5]
	],
	medals: {
		gold: 5,
		silver: 9,
		bronze: 15
	},
	hardSeconds: 20
};
const COURSES = [
	...NZ_COURSE_DEFS,
	TEST_EASY,
	TEST_HARD
].map(compileCourse);
function courseById(id) {
	return COURSES.find((c) => c.def.id === id);
}
function slotPlan(course) {
	const gates = course.gates.length;
	const pits = course.pitCount;
	const trails = course.gems.length;
	const rescues = Math.max(2, 10 - gates - pits - trails);
	return {
		gates,
		pits,
		trails,
		rescues,
		pitStart: gates,
		gemStart: gates + pits,
		rescueStart: gates + pits + trails,
		total: gates + pits + trails + rescues
	};
}
function publicQuestion(q, slot) {
	return {
		slot,
		parts: q.parts,
		spoken: q.spoken,
		...q.choices ? { choices: q.choices } : {},
		...q.choiceLabels ? { choiceLabels: q.choiceLabels } : {},
		...q.input ? { input: q.input } : {},
		...q.maxLength ? { maxLength: q.maxLength } : {}
	};
}
function hashSeed(text) {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
/** A small seeded random number generator. The same text always gives the same numbers. */
function seededRandom(text) {
	let a = hashSeed(text);
	return () => {
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function shuffled(items, random) {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
const DELTAS = [
	1,
	-1,
	2,
	-2,
	10,
	-10,
	3,
	-3,
	5,
	-5,
	20,
	-20,
	100,
	-100
];
/** How many digits a number has after the point (a decimal question's answer, like 0.45). */
function decimalPlaces(n) {
	const text = String(n);
	const dot = text.indexOf(".");
	return dot < 0 ? 0 : text.length - dot - 1;
}
/** Wrong answers a student could believe: the right answer nudged by a little, never below zero, never the same. */
function nearMisses(answer, random) {
	const places = decimalPlaces(answer);
	const step = places > 0 ? 10 ** -places : 1;
	const out = [];
	for (const d of shuffled(DELTAS.slice(0, 6), random).concat(DELTAS.slice(6))) {
		const v = Number((answer + d * step).toFixed(places));
		if (v >= 0 && v !== answer && !out.includes(v)) out.push(v);
	}
	return out;
}
/** What each of `k` signs (tunnels or gems) shows: the right answer in place `right`, the others wrong. */
function choicesFor(q, k, right, random) {
	const labelOf = new Map();
	const options = q.choices && q.choices.length >= k ? q.choices : null;
	options?.forEach((value, i) => labelOf.set(value, q.choiceLabels?.[i] ?? String(value)));
	const wrongs = options ? shuffled(options.filter((v) => v !== q.answer), random) : nearMisses(q.answer, random);
	const values = [];
	let w = 0;
	for (let t = 0; t < k; t++) values.push(t === right ? q.answer : wrongs[w++]);
	return {
		labels: values.map((v) => labelOf.get(v) ?? String(v)),
		values
	};
}
/**
* How each gate of a course looks for a run. `questions` is the run's question list, or null with maths off (arrows).
* Everything comes from the seed and the list, so it can be made again whenever it is needed.
*/
function gateLayout(course, seed, questions) {
	return course.gates.map((gate, g) => {
		const k = gate.tunnels.length;
		const random = seededRandom(`${seed}:gate:${g}`);
		const right = Math.floor(random() * k);
		const q = questions?.[g];
		if (!q) return {
			gate: g,
			slot: g,
			right,
			labels: null,
			values: null
		};
		const { labels, values } = choicesFor(q, k, right, random);
		return {
			gate: g,
			slot: g,
			right,
			labels,
			values
		};
	});
}
/** How each number-gem trail looks for a run. With maths off there are no gems. */
function gemLayout(course, seed, questions) {
	if (!questions) return [];
	const plan = slotPlan(course);
	return course.gems.map((trail, t) => {
		const q = questions[plan.gemStart + t];
		return {
			trail: t,
			slot: plan.gemStart + t,
			groups: trail.groups.map((group, g) => {
				const random = seededRandom(`${seed}:gem:${t}:${g}`);
				const right = Math.floor(random() * group.spots.length);
				return {
					right,
					labels: q ? choicesFor(q, group.spots.length, right, random).labels : []
				};
			})
		};
	});
}
/** The numbers (in `course.gemList`) of the right gems. */
function rightGems(course, layout) {
	const out = [];
	for (const t of layout) t.groups.forEach((g, gi) => {
		const id = course.gemList.findIndex((s) => s.trail === t.trail && s.group === gi && s.spot === g.right);
		if (id >= 0) out.push(id);
	});
	return out.sort((a, b) => a - b);
}
/** The shortcut doors (0 = A) that are open for a run. */
function openDoors(course, layout) {
	return layout.map((l) => course.gates[l.gate].tunnels[l.right].door).sort((a, b) => a - b);
}
/** Doors (0 = A) or gems (by number) as a number, to keep with a saved run: bit 0 is the first. */
function doorMask(doors) {
	return doors.reduce((mask, d) => mask | 1 << d, 0);
}
/** The open doors of a run (none for a course without gates). */
function doorsForSeed(course, seed, questions) {
	return openDoors(course, gateLayout(course, seed, questions));
}
/** The setup for a run. `questions` is the run's list (maths on) or null (maths off: arrows). */
function runSetup(course, seed, questions, rescue) {
	const layout = gateLayout(course, seed, questions);
	const gems = gemLayout(course, seed, questions);
	const plan = slotPlan(course);
	const pub = (slot) => publicQuestion(questions[slot], slot);
	return {
		maths: questions !== null,
		rescue: questions !== null && rescue,
		doors: openDoors(course, layout),
		gates: layout.map((l) => ({
			slot: l.slot,
			labels: l.labels,
			arrow: questions ? null : l.right,
			question: questions ? pub(l.slot) : null
		})),
		pits: questions ? Array.from({ length: plan.pits }, (_, i) => pub(plan.pitStart + i)) : [],
		rescues: questions && rescue ? Array.from({ length: plan.rescues }, (_, i) => pub(plan.rescueStart + i)) : [],
		gems: gems.map((t) => ({
			slot: t.slot,
			question: pub(t.slot),
			groups: t.groups.map((g) => ({ labels: g.labels }))
		})),
		rightGems: rightGems(course, gems)
	};
}
/** The right gems of a run (none with maths off, or on a course without gems). */
function rightGemsForSeed(course, seed, questions) {
	return rightGems(course, gemLayout(course, seed, questions));
}
//#endregion
//#region shared/space/mathsQuestion.ts
/**
* Which question Mission Control asks next: the same choice in the bot game (the browser) and
* with classmates (the server), from a student's records.
*
* With no maths focus it is the times-table step the student is ready for, as it has always been.
* With a focus (a teacher's, or the student's own: shared/maths/focus.ts) it is that focus.
*/
/** The pack a game keeps for a visit: all the student's records, asking the focus if there is one. */
function makeSpacePack(facts, focus, settings = {}, random, now) {
	return makeFocusPack(facts, focus, {
		enabledTables: settings.enabledTables,
		division: settings.division
	}, random, now);
}
function pickSpaceQuestion(pack, settings = {}) {
	const ctx = {
		enabledTables: settings.enabledTables,
		division: settings.division,
		missingFactor: settings.missingFactor,
		multipleChoice: settings.multipleChoice
	};
	if (pack instanceof TimesTables) return pack.nextQuestion({
		level: readyLevel(pack.stats(), settings.enabledTables),
		...ctx
	}) ?? pack.nextQuestion({ level: 1 });
	return pack.nextQuestion(ctx) ?? new TimesTables().nextQuestion({ level: 1 });
}
//#endregion
//#region shared/marble/questions.ts
/**
* Making and marking the questions of a Marble Rush run (docs/MARBLE-PLAN.md, section 7). The server makes the list when a
* run starts, keeps it where students can't read it, and marks every answer against it.
*
* Questions come from the shared focus system, as in Mission Control: `makeSpacePack` -> `makeFocusPack`, so a teacher's
* focus, a student's own pick or the whole ladder (auto) all decide what the gates, pit stops and rescues ask.
*/
/** The answer and the mastery record of a stored question. Null if it can't be marked. */
function markQuestion(q) {
	if (q && typeof q.answer === "number" && Number.isFinite(q.answer) && typeof q.factKey === "string" && isFocusKey(q.factKey)) return {
		answer: q.answer,
		key: q.factKey
	};
	const solved = solveParts(q?.parts);
	return solved ? {
		answer: solved.answer,
		key: solved.keys[0]
	} : null;
}
/** Decimal answers are typed as text, so compare with a hair of room. */
const sameAnswer = (typed, answer) => Math.abs(typed - answer) < 1e-9;
/**
* `count` questions for one run, different from each other where the focus allows. Every question can be marked
* (anything that can't is left out). Fewer than `count` come back only if the focus really has nothing more to ask.
*/
function makeRunQuestions(context, count, random) {
	const pack = makeSpacePack(context.facts, context.focus, context.settings, random);
	const out = [];
	const seen = new Set();
	const spare = [];
	for (let tries = 0; tries < count * 8 && out.length < count; tries++) {
		const q = pickSpaceQuestion(pack, context.settings);
		if (!q || !markQuestion(q)) continue;
		if (seen.has(q.factKey)) spare.push(q);
		else {
			seen.add(q.factKey);
			out.push({
				...q,
				id: out.length
			});
		}
	}
	while (out.length < count && spare.length) out.push({
		...spare.shift(),
		id: out.length
	});
	return out;
}
const RUN = /^([0-9ab])x([1-9]\d{0,5})$/;
/** Null if the text isn't a well-made list of runs. */
function decodeInputs(text) {
	if (text === "") return [];
	const runs = [];
	let total = 0;
	for (const part of text.split(",")) {
		const m = RUN.exec(part);
		if (!m) return null;
		const n = Number(m[2]);
		total += n;
		if (total > 21600) return null;
		runs.push([parseInt(m[1], 16), n]);
	}
	return runs;
}
/** How many steps of one input code a list of runs holds (e.g. how many REFUND inputs). */
function countCode(runs, code) {
	return runs.reduce((sum, [c, n]) => c === code ? sum + n : sum, 0);
}
//#endregion
//#region shared/marble/engine.ts
/**
* Marble Rush's rules and physics, as plain functions (docs/MARBLE-PLAN.md, section 4).
*
* `newRun` makes the starting state, `stepRun` moves it forward one 1/60-second step with one
* input, and `replay` plays a whole recorded run. The same inputs always give exactly the same
* run, in every browser and on the server, so the server can work out a run's real time itself.
*
* The state is plain numbers: it can be saved, hashed and compared.
*/
const R2 = .7071067811865476;
/** Index = input code. North is up the grid (smaller y). */
const DIRS = [
	[0, 0],
	[0, -1],
	[R2, -.7071067811865476],
	[1, 0],
	[R2, R2],
	[0, 1],
	[-.7071067811865476, R2],
	[-1, 0],
	[-.7071067811865476, -.7071067811865476]
];
const CONVEYORS = {
	e: [1, 0],
	w: [-1, 0],
	n: [0, -1],
	o: [0, 1]
};
const WALL = {
	ch: "=",
	level: 0,
	surface: "normal",
	slope: null,
	door: -1
};
const VOID = {
	ch: ".",
	level: 0,
	surface: "normal",
	slope: null,
	door: -1
};
function makeWorld(course, options = {}) {
	return {
		course,
		mode: options.mode ?? "up",
		open: new Set(options.openDoors ?? []),
		rightGems: [...new Set(options.rightGems ?? [])].sort((a, b) => a - b),
		t: 0
	};
}
function tileAt(w, tx, ty) {
	const c = w.course;
	if (tx < 0 || ty < 0 || tx >= c.width || ty >= c.height) return VOID;
	const t = c.tiles[ty * c.width + tx];
	if (t.door >= 0) return w.open.has(t.door) ? {
		...t,
		ch: "#"
	} : WALL;
	if (t.ch === "t") return trapdoorSolid(w.t, tx) ? t : VOID;
	if (t.ch === "q") return gateOpen(w.t, tx) ? {
		...t,
		ch: "#"
	} : WALL;
	return t;
}
/** Hazards in the same column share a timer, so a row of them moves together. */
const trapdoorSolid = (t, tx) => (t + tx * 53) % TIMED.trapdoor.period < TIMED.trapdoor.solid;
const gateOpen = (t, tx) => (t + tx * 53) % TIMED.gate.period < TIMED.gate.open;
/** 0 = quiet, 1 = steaming (a warning), 2 = throwing the marble up. */
function geyserPhase(t, tx, ty) {
	const p = (t + tx * 37 + ty * 91) % TIMED.geyser.period;
	return p < TIMED.geyser.warn ? 1 : p < TIMED.geyser.warn + TIMED.geyser.active ? 2 : 0;
}
/** The floor's height (in tiles) at a point, or null for a gap or a wall. */
function floorAt(w, x, y) {
	const tx = Math.floor(x);
	const ty = Math.floor(y);
	const t = tileAt(w, tx, ty);
	if (t.ch === "." || t.ch === "=") return null;
	if (!t.slope) return t.level * LEVEL;
	const u = x - tx;
	const v = y - ty;
	const down = t.slope === "E" ? u : t.slope === "W" ? 1 - u : t.slope === "S" ? v : 1 - v;
	return (t.level - down) * LEVEL;
}
const isWall = (w, x, y) => tileAt(w, Math.floor(x), Math.floor(y)).ch === "=";
/** True if the marble can't be there: a wall, or floor too far above it to step up onto. */
function blockedAt(w, s, x, y, axis, sign) {
	const R = BALL_RADIUS;
	const side = R * .7;
	for (let k = -1; k <= 1; k++) {
		const px = axis === "x" ? x + sign * R : x + k * side;
		const py = axis === "y" ? y + sign * R : y + k * side;
		if (isWall(w, px, py)) return true;
		const f = floorAt(w, px, py);
		if (f !== null && f > s.z + (s.grounded ? .3 : .02)) return true;
	}
	return false;
}
function newRun(w) {
	const { x, y } = w.course.start;
	return {
		x,
		y,
		z: floorAt(w, x, y) ?? 0,
		vx: 0,
		vy: 0,
		vz: 0,
		grounded: true,
		steps: 0,
		held: 0,
		penalty: 0,
		refundable: 0,
		bonus: 0,
		falls: 0,
		respawnX: x,
		respawnY: y,
		checkpoints: [],
		outcome: "running",
		finishSteps: 0,
		padCooldown: 0,
		gateChoices: w.course.gates.map(() => -1),
		pitStops: [],
		gemsTaken: []
	};
}
/** Time on the clock, in steps: count-up is the time so far; count-down is what is left. */
function clockSteps(w, s) {
	const used = s.steps + s.penalty;
	return w.mode === "up" ? used : w.course.def.hardSeconds * 60 + s.bonus - used;
}
function fall(w, s) {
	s.falls++;
	s.penalty += 180;
	s.refundable = 180;
	s.x = s.respawnX;
	s.y = s.respawnY;
	s.z = floorAt(w, s.x, s.y) ?? 0;
	s.vx = s.vy = s.vz = 0;
	s.grounded = true;
}
function checkClock(w, s) {
	if (s.outcome !== "running") return;
	const left = clockSteps(w, s);
	if (w.mode === "down" ? left <= 0 : left >= 18e3) s.outcome = "timeout";
}
/** Plays one 1/60-second step with one input. Changes `s`. Does nothing once the run is over. */
function stepRun(w, s, input) {
	if (s.outcome !== "running") return;
	if (input === 9) {
		s.held++;
		return;
	}
	if (input === 11) {
		s.penalty -= 120;
		return;
	}
	if (input === 10) {
		s.penalty -= s.refundable;
		s.refundable = 0;
		return;
	}
	const c = w.course;
	s.steps++;
	w.t = s.steps;
	const dir = DIRS[input] ?? DIRS[0];
	const here = tileAt(w, Math.floor(s.x), Math.floor(s.y));
	let max = SURFACES.normal.max;
	if (s.grounded) {
		const surf = SURFACES[here.surface];
		max = surf.max;
		let ax = dir[0] * 9 * surf.steer;
		let ay = dir[1] * 9 * surf.steer;
		if (here.slope) {
			const g = 9 * LEVEL;
			if (here.slope === "E") ax += g;
			else if (here.slope === "W") ax -= g;
			else if (here.slope === "S") ay += g;
			else ay -= g;
		}
		const belt = CONVEYORS[here.ch];
		if (belt) {
			ax += belt[0] * 6;
			ay += belt[1] * 6;
		}
		s.vx = (s.vx + ax * DT) * (1 - surf.drag);
		s.vy = (s.vy + ay * DT) * (1 - surf.drag);
	} else {
		s.vx += dir[0] * 9 * AIR_STEER * DT;
		s.vy += dir[1] * 9 * AIR_STEER * DT;
		s.vz -= 18 * DT;
	}
	const wind = c.def.wind;
	if (wind && s.steps % wind.period < wind.on) {
		s.vx += wind.dx * wind.force * DT;
		s.vy += wind.dy * wind.force * DT;
	}
	const v2 = s.vx * s.vx + s.vy * s.vy;
	if (v2 > max * max) {
		const k = max / Math.sqrt(v2);
		s.vx *= k;
		s.vy *= k;
	}
	const nx = s.x + s.vx * DT;
	if (s.vx !== 0 && blockedAt(w, s, nx, s.y, "x", s.vx > 0 ? 1 : -1)) s.vx = -s.vx * BOUNCE;
	else s.x = nx;
	const ny = s.y + s.vy * DT;
	if (s.vy !== 0 && blockedAt(w, s, s.x, ny, "y", s.vy > 0 ? 1 : -1)) s.vy = -s.vy * BOUNCE;
	else s.y = ny;
	const floor = floorAt(w, s.x, s.y);
	let gone = false;
	if (s.grounded) {
		if (floor === null || floor < s.z - .3) {
			s.grounded = false;
			s.vz = 0;
		} else s.z = floor;
	}
	if (!s.grounded) {
		s.z += s.vz * DT;
		if (floor !== null && s.z <= floor) {
			if (-s.vz > 9) gone = true;
			else {
				s.z = floor;
				s.vz = 0;
				s.grounded = true;
			}
		}
		if (s.z < c.floorMin - 1.5) gone = true;
	}
	if (gone) {
		fall(w, s);
		checkClock(w, s);
		return;
	}
	if (s.padCooldown > 0) s.padCooldown--;
	const tx = Math.floor(s.x);
	const ty = Math.floor(s.y);
	const on = tileAt(w, tx, ty);
	const tunnel = c.tunnelAt[ty * c.width + tx];
	if (tunnel) {
		const gate = tunnel - 1 >> 3;
		if (s.gateChoices[gate] < 0) s.gateChoices[gate] = tunnel - 1 & 7;
	}
	if (w.rightGems.length) for (const id of w.rightGems) {
		if (s.gemsTaken.includes(id)) continue;
		const gem = c.gemList[id];
		const gx = s.x - gem.x;
		const gy = s.y - gem.y;
		if (gx * gx + gy * gy >= .25) continue;
		s.gemsTaken.push(id);
		if (s.gemsTaken.length <= 5) s.penalty -= 60;
	}
	if (on.ch === "b") {
		const cx = tx + .5;
		const cy = ty + .5;
		const dx = s.x - cx;
		const dy = s.y - cy;
		const d2 = dx * dx + dy * dy;
		if (d2 < .2025) {
			const d = Math.sqrt(d2);
			const nxv = d < 1e-6 ? 0 : dx / d;
			const nyv = d < 1e-6 ? -1 : dy / d;
			s.x = cx + nxv * BUMPER_RADIUS;
			s.y = cy + nyv * BUMPER_RADIUS;
			s.vx = nxv * BUMPER_SPEED;
			s.vy = nyv * BUMPER_SPEED;
		}
	} else if (on.ch === "g" && s.grounded && s.padCooldown === 0 && geyserPhase(s.steps, tx, ty) === 2) {
		s.grounded = false;
		s.vz = 7 * TIMED.geyser.boost;
		s.padCooldown = 30;
	} else if (on.ch === "j" && s.grounded && s.padCooldown === 0) {
		s.grounded = false;
		s.vz = 7;
		s.padCooldown = 30;
	} else if (on.ch === "c") {
		const id = ty * c.width + tx;
		if (!s.checkpoints.includes(id)) {
			s.checkpoints.push(id);
			if (!s.pitStops.includes(c.pitAt[id])) s.pitStops.push(c.pitAt[id]);
			s.respawnX = tx + .5;
			s.respawnY = ty + .5;
			if (w.mode === "down") s.bonus += 300;
		}
	} else if (on.ch === "f") {
		s.outcome = "finished";
		s.finishSteps = s.steps + s.penalty;
		return;
	}
	checkClock(w, s);
}
/** Plays a recorded run from the start. Returns null if the inputs aren't well made. */
function replay(course, runs, options = {}) {
	const w = makeWorld(course, options);
	const s = newRun(w);
	let total = 0;
	for (const [code, n] of runs) {
		if (!Number.isInteger(code) || code < 0 || code > 11 || !Number.isInteger(n) || n < 1) return null;
		total += n;
		if (total > 21600) return null;
	}
	for (const [code, n] of runs) {
		for (let i = 0; i < n && s.outcome === "running"; i++) stepRun(w, s, code);
		if (s.outcome !== "running") break;
	}
	return {
		outcome: s.outcome === "running" ? "unfinished" : s.outcome,
		finishSteps: s.outcome === "finished" ? s.finishSteps : 0,
		falls: s.falls,
		checkpoints: s.checkpoints.length,
		held: s.held,
		steps: s.steps,
		state: s
	};
}
const SEED_PATTERN = /^m1-(\d{10})-[0-9a-f]{24}$/;
const COURSE_ID = /^[a-z0-9-]{1,40}$/;
/** A new seed: when it was made and 12 random bytes. */
function makeMarbleSeed(nowSeconds, randomHex) {
	return `m1-${String(Math.floor(nowSeconds)).padStart(10, "0")}-${randomHex}`;
}
/** What the server signs: who, which course and mode, and the seed, so a stamp is no use for another run. */
function marbleStampText(player, course, mode, seed) {
	return `marble-run:v1:${player}:${course}:${mode}:${seed}`;
}
/** When the seed was handed out (seconds since 1970), or null if it isn't a server seed. */
function marbleSeedTime(seed) {
	const match = SEED_PATTERN.exec(seed);
	return match ? Number(match[1]) : null;
}
/** Null if the seed is well made and still fresh, else what's wrong. */
function marbleSeedProblem(seed, nowSeconds) {
	const made = marbleSeedTime(seed);
	if (made === null) return "not a server seed";
	const age = nowSeconds - made;
	if (age < -300) return "seed from the future";
	if (age > 21600) return "seed too old";
	return null;
}
/** Null if it isn't shaped like a report. (Nothing about it is trusted yet.) */
function parseMarbleReport(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (typeof r.seed !== "string" || typeof r.stamp !== "string" || typeof r.course !== "string") return null;
	if (r.mode !== "up" && r.mode !== "down") return null;
	if (typeof r.inputs !== "string" || r.inputs.length > 6e4) return null;
	if (r.seed.length > 80 || r.stamp.length > 200 || !COURSE_ID.test(r.course)) return null;
	return {
		seed: r.seed,
		stamp: r.stamp,
		course: r.course,
		mode: r.mode,
		inputs: r.inputs
	};
}
/**
* Replays the recorded inputs and checks the run. `nowSeconds` and the seed's time give the real
* time that has passed since the seed was handed out. `doors` are the shortcut doors that were open and
* `rightGems` the gems that were right for this run (the server works both out from the run's seed and question
* list; none for a course with no gates or gems).
*/
function judgeRun(report, nowSeconds, run = {}) {
	const course = courseById(report.course);
	if (!course) return {
		ok: false,
		problem: "unknown course"
	};
	const runs = decodeInputs(report.inputs);
	if (!runs) return {
		ok: false,
		problem: "inputs not readable"
	};
	const result = replay(course, runs, {
		mode: report.mode,
		openDoors: run.doors ?? [],
		rightGems: run.rightGems ?? []
	});
	if (!result) return {
		ok: false,
		problem: "inputs not readable"
	};
	if (result.outcome !== "finished" || result.finishSteps <= 0) return {
		ok: false,
		problem: "no finish"
	};
	const made = marbleSeedTime(report.seed);
	if (made === null) return {
		ok: false,
		problem: "not a server seed"
	};
	if (nowSeconds - made + 1 + 3 < result.steps / 60) return {
		ok: false,
		problem: "faster than real time"
	};
	if (result.steps + result.held > 21600) return {
		ok: false,
		problem: "too long"
	};
	return {
		ok: true,
		run: {
			steps: result.finishSteps,
			falls: result.falls,
			checkpoints: result.checkpoints,
			held: result.held,
			played: result.steps,
			gateChoices: result.state.gateChoices,
			pitStops: result.state.pitStops.length,
			gems: result.state.gemsTaken.length,
			bonuses: countCode(runs, 11),
			refunds: countCode(runs, 10)
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
const TOO_MANY = "That's a lot of rolling today! Have a break and come back tomorrow.";
/** How long a gate answer is said to have taken. The server can't time a roll through a tunnel, so it is slow enough not to count as quick. */
const GATE_MS = 8e3;
const MAX_ANSWER_MS = 6e4;
/** Maths happens when the teacher says "on", or says "students choose" and this student chose it. */
function mathsWanted(mode, chosen) {
	return mode === "on" || mode === "choose" && chosen === true;
}
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleMarble(request) {
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
		const nowSeconds = Math.floor(services.now() / 1e3);
		/** Null if the seed is fresh and its stamp is the one this server made for this student, course and mode. */
		const stampProblem = async (course, mode, seed, given) => {
			const expected = await services.stamp(marbleStampText(player, course, mode, seed));
			return marbleSeedProblem(seed, nowSeconds) ?? (expected && sameText(expected, given) ? null : "bad stamp");
		};
		if (body.action === "start") {
			const mode = body.mode;
			const course = typeof body.course === "string" ? courseById(body.course) : void 0;
			if (!course || mode !== "up" && mode !== "down") return reply(400, { error: "That course couldn't be found." });
			const seed = makeMarbleSeed(nowSeconds, services.randomHex(12));
			const stamp = await services.stamp(marbleStampText(player, course.def.id, mode, seed));
			if (!stamp) return reply(500, { error: "The run couldn't start." });
			let questions = null;
			let rescue = false;
			if (course.gates.length) {
				const settings = await services.settings(player);
				const mathsMode = parseMathsSwitch(settings?.maths);
				if (settings && mathsWanted(mathsMode, body.maths)) {
					const context = await services.mathsContext(player);
					const list = context ? makeRunQuestions(context, slotPlan(course).total, () => services.random()) : [];
					if (list.length >= slotPlan(course).total) {
						rescue = settings.rescue;
						if (await services.storeRun(player, seed, rescue, list)) questions = list;
					}
				}
			}
			return reply(200, {
				seed,
				stamp,
				...runSetup(course, seed, questions, rescue)
			});
		}
		if (body.action === "answer") {
			const course = typeof body.course === "string" ? courseById(body.course) : void 0;
			const mode = body.mode;
			const { seed, stamp, slot, answer } = body;
			if (!course || mode !== "up" && mode !== "down" || typeof seed !== "string" || typeof stamp !== "string" || seed.length > 80 || stamp.length > 200) return reply(400, { error: "That answer couldn't be read." });
			if (!Number.isInteger(slot) || typeof answer !== "number" || !Number.isFinite(answer) || answer < 0 || answer > 1e6) return reply(400, { error: "That answer couldn't be read." });
			const problem = await stampProblem(course.def.id, mode, seed, stamp);
			if (problem) {
				console.warn(`marble: refused an answer (${problem})`);
				return reply(400, { error: "That answer couldn't be marked." });
			}
			const run = await services.loadRun(player, seed);
			if (run === "busy") return reply(503, { error: "We couldn't check your answer just now." });
			const plan = slotPlan(course);
			const at = slot;
			const allowed = at >= plan.pitStart && at < plan.rescueStart + (run?.rescue ? plan.rescues : 0);
			if (!run || !allowed) {
				console.warn("marble: refused an answer (no such question)");
				return reply(400, { error: "That answer couldn't be marked." });
			}
			const marked = markQuestion(run.questions[at]);
			if (!marked) return reply(400, { error: "That answer couldn't be marked." });
			const right = sameAnswer(answer, marked.answer);
			const claimed = await services.claimAnswer(player, seed, at, answer, right);
			if (claimed === "busy") return reply(503, { error: "We couldn't check your answer just now." });
			if (!claimed) return reply(400, { error: "You've already answered that one." });
			const claimedMs = typeof body.ms === "number" && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS;
			const ms = Math.round(Math.min(claimedMs, MAX_ANSWER_MS));
			await safeRecord(services, player, `${seed}:${at}`, [{
				key: marked.key,
				correct: right,
				ms,
				at: services.now()
			}]);
			return reply(200, {
				right,
				answer: marked.answer
			});
		}
		if (body.action === "save") {
			const report = parseMarbleReport(body);
			if (!report) return reply(400, { error: "That run couldn't be read." });
			const problem = await stampProblem(report.course, report.mode, report.seed, report.stamp);
			if (problem) {
				console.warn(`marble: refused a run (${problem})`);
				return reply(400, { error: "That run couldn't be saved." });
			}
			const course = courseById(report.course);
			const stored = await services.loadRun(player, report.seed);
			if (stored === "busy") return reply(503, { error: "We couldn't save your run just now." });
			const doors = doorsForSeed(course, report.seed, stored?.questions ?? null);
			const rightGems = rightGemsForSeed(course, report.seed, stored?.questions ?? null);
			const judged = judgeRun(report, nowSeconds, {
				doors,
				rightGems
			});
			if (!judged.ok) {
				console.warn(`marble: refused a run (${judged.problem})`);
				return reply(400, { error: "That run couldn't be saved." });
			}
			const plan = slotPlan(course);
			const rightIn = (from, to) => Object.entries(stored?.answered ?? {}).filter(([slot, a]) => a.right && Number(slot) >= from && Number(slot) < to).length;
			const bonusesAllowed = Math.min(rightIn(plan.pitStart, plan.rescueStart), judged.run.pitStops);
			const refundsAllowed = stored?.rescue ? Math.min(rightIn(plan.rescueStart, plan.total), judged.run.falls) : 0;
			if (judged.run.bonuses > bonusesAllowed || judged.run.refunds > refundsAllowed) {
				console.warn("marble: refused a run (more bonuses than right answers)");
				return reply(400, { error: "That run couldn't be saved." });
			}
			const saved = await services.record(player, report, judged.run, {
				maths: stored !== null,
				doors: doorMask(doors),
				gems: doorMask(rightGems)
			});
			if (!saved.ok) {
				if (saved.why === "too-many") return reply(429, { error: TOO_MANY });
				return saved.why === "refused" ? reply(400, { error: "That run couldn't be saved." }) : reply(503, { error: "We couldn't save your run just now." });
			}
			if (stored && saved.value !== "duplicate") await recordGateAnswers(services, player, course, report.seed, stored, judged.run);
			return reply(200, {
				result: saved.value,
				steps: judged.run.steps,
				falls: judged.run.falls
			});
		}
		return reply(400, { error: "That couldn't be read." });
	};
}
/**
* (Number gems are never recorded: the questions are asked, but rolling through a gem is not an answer.)
*
* The student's answer at each gate is the tunnel they rolled into first (read from the replay). Each is marked
* against the stored list and counted once, even if the run is sent twice. If the records can't be updated the run is still saved.
*/
async function recordGateAnswers(services, player, course, seed, stored, run) {
	const layout = gateLayout(course, seed, stored.questions);
	const answers = [];
	for (const gate of layout) {
		const choice = run.gateChoices[gate.gate];
		const marked = markQuestion(stored.questions[gate.slot]);
		if (choice === void 0 || choice < 0 || !marked || !gate.values) continue;
		const value = gate.values[choice];
		const right = sameAnswer(value, marked.answer);
		if (await services.claimAnswer(player, seed, gate.slot, value, right) === true) answers.push({
			key: marked.key,
			correct: right,
			ms: GATE_MS,
			at: services.now()
		});
	}
	if (answers.length) await safeRecord(services, player, `${seed}:gates`, answers);
}
/** The maths records are a bonus: if they can't be updated the game goes on (a run is never lost over them). */
async function safeRecord(services, player, once, answers) {
	try {
		await services.recordAnswers(player, once, answers);
	} catch {
		console.error("marble: the maths records could not be updated");
	}
}
/** Compares two stamps without stopping at the first difference, so timing gives nothing away. */
function sameText(a, b) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
//#endregion
//#region supabase/functions/marble/entry.ts
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
/** Calls a database function. Logs say which one and the error code, never who. */
async function call(name, args) {
	const { data, error } = await admin.rpc(name, args);
	if (!error) return {
		ok: true,
		value: data
	};
	console.error(`marble: ${name} failed (${error.code ?? "unknown"})`);
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
/** The same text always gives the same ID, so an answer sent twice is only counted once. */
async function batchIdFor(text) {
	const hex = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`marble-maths:${text}`))).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
Deno.serve(makeHandler({
	now: () => Date.now(),
	random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
	randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join(""),
	stamp: stamper(key, "marble-run"),
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async settings(player) {
		const { data, error } = await admin.rpc("settings_of", { player }).maybeSingle();
		if (error || !data) {
			console.error(`marble: settings failed (${error?.code ?? "none"})`);
			return null;
		}
		const row = data;
		return {
			maths: parseMathsSwitch(row.marble_maths),
			rescue: row.marble_rescue !== false
		};
	},
	async mathsContext(player) {
		const { data, error } = await admin.rpc("space_maths_context", { player });
		if (error || !data) {
			console.error(`marble: maths records failed (${error?.code ?? "none"})`);
			return null;
		}
		const context = data;
		const { enabledTables, division, missingFactor, multipleChoice } = context.settings;
		return {
			facts: context.facts,
			focus: parseFocus(context.focus),
			settings: {
				enabledTables,
				division,
				multipleChoice,
				...typeof missingFactor === "boolean" ? { missingFactor } : {}
			}
		};
	},
	async storeRun(player, seed, rescue, questions) {
		const { error } = await admin.rpc("marble_store_run", {
			player,
			seed,
			rescue,
			questions
		});
		if (error) console.error(`marble: keeping the questions failed (${error.code ?? "unknown"})`);
		return !error;
	},
	async loadRun(player, seed) {
		const { data, error } = await admin.rpc("marble_load_run", {
			player,
			seed
		});
		if (error) {
			console.error(`marble: loading the questions failed (${error.code ?? "unknown"})`);
			return "busy";
		}
		if (!data) return null;
		const row = data;
		return {
			rescue: row.rescue,
			questions: row.questions,
			answered: row.answered ?? {}
		};
	},
	async claimAnswer(player, seed, slot, value, right) {
		const { data, error } = await admin.rpc("marble_claim_answer", {
			player,
			seed,
			slot,
			value,
			right_answer: right
		});
		if (error) {
			console.error(`marble: marking an answer failed (${error.code ?? "unknown"})`);
			return "busy";
		}
		return data === true;
	},
	async recordAnswers(player, once, answers) {
		for (const [pack, group] of groupByPack(answers)) {
			const { error } = await admin.rpc("record_fact_answers", {
				player,
				pack,
				batch_id: await batchIdFor(`${once}:${pack}`),
				answers: group,
				quick_ms: QUICK_MS,
				fluent_days: 2,
				top_box: 4
			});
			if (error) console.error(`marble: record answers failed (${error.code ?? "unknown"})`);
		}
	},
	record: (player, report, run, extra) => call("record_marble_run", {
		player,
		seed: report.seed,
		course: report.course,
		mode: report.mode,
		maths: extra.maths,
		doors: extra.doors,
		gems: extra.gems,
		steps: run.steps,
		falls: run.falls,
		checkpoints: run.checkpoints,
		held: run.held,
		inputs: report.inputs,
		daily_limit: 400
	})
}));
//#endregion
