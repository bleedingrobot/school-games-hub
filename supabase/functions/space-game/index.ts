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
/**
* Packs whose questions take longer to think through have a longer quick time (James can change these): the generated
* skills (rounding a 7-digit number, 2 + 3 × 4 − 1 with four choices) can't be answered in 5 seconds by a student who knows
* them well, and a box only moves up on a quick answer, so with 5 seconds those skills would never be secure.
*/
const QUICK_MS_BY_PACK = { generated: 8e3 };
/** The quick time for the records of a pack ("times-tables", "generated"...). */
const quickMsForPack = (pack) => pack && Object.hasOwn(QUICK_MS_BY_PACK, pack) ? QUICK_MS_BY_PACK[pack] : QUICK_MS;
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
/** A step's tables count as secure when this share of their facts are in box 2 or higher. */
const STEP_SECURE_SHARE = .7;
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
	r: "remainder",
	"%": "percent"
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
/**
* One part or choice in words for a screen reader: "3/4" is "3 quarters", "25%" is "25 percent", "0.25" is "0 point 2 5".
* Anything else is read as it is.
*/
function spokenLabel(part) {
	const percent = /^(\d+(?:\.\d+)?)%$/.exec(part);
	if (percent) return `${spokenLabel(percent[1])} percent`;
	if (/^\d+\.\d+$/.test(part)) {
		const [whole, frac] = part.split(".");
		return `${whole} point ${frac.split("").join(" ")}`;
	}
	return part.includes("/") ? spokenFraction(part) : part;
}
/** The spoken version of a question's parts, for screen readers. */
function speak(parts) {
	const text = parts.map((p) => SPOKEN_WORDS[p] ?? (/^\d+(?:\.\d+)?%$/.test(p) ? spokenLabel(p) : p.includes("/") ? spokenFraction(p) : p.replace(/^\$/, "$"))).join(" ").replace(/\s+/g, " ").trim();
	return /[?.!:]$/.test(text) ? text : text + "?";
}
/** The parts with the blank filled in: "7 + 8 = ?" → "7 + 8 = 15", "1/2 = ?/8" → "1/2 = 4/8". */
const fillBlank = (parts, answer) => parts.map((p) => p.includes("?") ? p.replace("?", show(answer)) : p).join(" ").replace(/\$ /g, "$");
/** Same answer, allowing for floating-point dust (0.30000000000000004). */
const sameAnswer = (a, b) => Math.abs(a - b) < 1e-6;
/** Digits a typed answer needs, allowing one extra so the length doesn't give the answer away. */
const lengthFor = (answer) => String(tidy(answer)).length;
/** Four choices: the answer plus believable wrong ones, padded with near misses when short. */
function choicesFor$1(answer, wrong, decimal, random) {
	const ok = (n) => Number.isFinite(n) && n >= 0 && !sameAnswer(n, answer) && (decimal || Number.isInteger(n));
	const picked = [];
	for (const n of shuffle$1(wrong.map(tidy), random)) if (ok(n) && !picked.some((p) => sameAnswer(p, n)) && picked.length < 3) picked.push(n);
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
		} else if (multipleChoice || made.choose) choices = choicesFor$1(answer, made.wrong ?? [], decimal, random);
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
const ones$1 = (n) => n % 10;
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
		"add:2d+tens": kind("add:2d+tens", "Adding tens to a 2-digit number (47 + 30)", "add-tens-to-2d", (r) => [int(r, 1, 6) * 10 + int(r, 1, 9), int(r, 1, 3) * 10], (a, b) => a >= 11 && a <= 69 && ones$1(a) !== 0 && b % 10 === 0 && b >= 10 && b <= 30, (a, b) => sum(a, b, { wrong: addWrong(a, b).concat([a + b / 10]) })),
		"sub:2d-tens": kind("sub:2d-tens", "Taking tens from a 2-digit number (77 − 30)", "sub-tens-from-2d", (r) => {
			const b = int(r, 1, 3) * 10;
			return [b + int(r, 1, 5) * 10 + int(r, 1, 9), b];
		}, (a, b) => b % 10 === 0 && b >= 10 && b <= 30 && a - b >= 11 && a - b <= 59 && ones$1(a) !== 0, (a, b) => diff(a, b, { wrong: subWrong(a, b).concat([a - b / 10]) })),
		"add:bridge10": kind("add:bridge10", "Adding across a ten (47 + 8)", "add-bridge-ten", (r) => {
			const a = int(r, 1, 8) * 10 + int(r, 2, 9);
			return [a, int(r, 11 - ones$1(a), 9)];
		}, (a, b) => a >= 12 && a <= 89 && b >= 2 && b <= 9 && ones$1(a) + b >= 10, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:bridge10": kind("sub:bridge10", "Taking away across a ten (53 − 8)", "sub-bridge-ten", (r) => {
			const a = int(r, 2, 9) * 10 + int(r, 0, 7);
			return [a, int(r, Math.max(2, ones$1(a) + 1), 9)];
		}, (a, b) => a >= 20 && a <= 97 && b >= 2 && b <= 9 && ones$1(a) < b, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:2d+2d": kind("add:2d+2d", "Adding 2-digit numbers (34 + 25)", "add-2d", (r) => {
			const a = int(r, 1, 7) * 10 + int(r, 1, 8);
			return [a, int(r, 1, 8 - tens(a)) * 10 + int(r, 1, 9 - ones$1(a))];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && ones$1(a) + ones$1(b) <= 9 && a + b <= 99, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:2d-2d": kind("sub:2d-2d", "Taking away 2-digit numbers (59 − 25)", "sub-2d", (r) => {
			const b = int(r, 1, 7) * 10 + int(r, 1, 8);
			return [b + int(r, 1, 9 - tens(b)) * 10 + int(r, 0, 9 - ones$1(b)), b];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && a > b && ones$1(a) >= ones$1(b) && a - b >= 10, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:2d+2d:carry": kind("add:2d+2d:carry", "Adding 2-digit numbers, with regrouping (47 + 36)", "add-2d-regroup", (r) => {
			const a = int(r, 1, 7) * 10 + int(r, 2, 9);
			return [a, int(r, 1, 8 - tens(a)) * 10 + int(r, 10 - ones$1(a), 9)];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && ones$1(a) + ones$1(b) >= 10 && a + b <= 99, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:2d-2d:borrow": kind("sub:2d-2d:borrow", "Taking away 2-digit numbers, with regrouping (52 − 37)", "sub-2d-regroup", (r) => {
			const a = int(r, 3, 9) * 10 + int(r, 0, 8);
			return [a, int(r, 1, tens(a) - 2) * 10 + int(r, ones$1(a) + 1, 9)];
		}, (a, b) => a >= 30 && a <= 99 && b >= 10 && b <= 99 && ones$1(a) < ones$1(b) && a - b >= 10, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
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
						(10 - tens(a)) * 10 + (10 - ones$1(a)),
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
const tenths$1 = (n) => show(n / 10);
const hundredths$1 = (n) => show(n / 100);
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
					tenths$1(a),
					"+",
					tenths$1(b),
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
					tenths$1(a),
					"−",
					tenths$1(b),
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
					hundredths$1(a),
					"+",
					hundredths$1(b),
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
				const labels = [hundredths$1(a), hundredths$1(b)];
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
					tenths$1(a),
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
					tenths$1(a),
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
					fact: `${tenths$1(a)} rounded to the nearest whole number is ${answer}`
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
					tenths$1(a),
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
const gcd$2 = (a, b) => b === 0 ? a : gcd$2(b, a % b);
const frac$1 = (n, d) => `${n}/${d}`;
/** A "which is bigger?" question: the answer is the index of the bigger fraction. */
function bigger(n1, d1, n2, d2) {
	const labels = [frac$1(n1, d1), frac$1(n2, d2)];
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
const FRACTIONS$1 = {
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
					frac$1(1, d),
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
				while (gcd$2(n, d) !== 1);
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
				].includes(d) || !isInt(n, 2, d - 1) || gcd$2(n, d) !== 1 || !isInt(q, 1, 10)) return null;
				const parts = [
					frac$1(n, d),
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
				while (gcd$2(n, d) !== 1);
				return [
					n,
					d,
					int(r, 2, 5),
					int(r, 0, 1)
				];
			},
			make: (_k, [n, d, k, v]) => {
				if (!isInt(d, 2, 5) || !isInt(n, 1, d - 1) || gcd$2(n, d) !== 1 || !isInt(k, 2, 5) || !isInt(v, 0, 1)) return null;
				const blank = v === 0 ? `?/${d * k}` : `${n * k}/?`;
				const parts = [
					frac$1(n, d),
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
					frac$1(a, d),
					"+",
					frac$1(b, d),
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
					frac$1(a, d),
					"−",
					frac$1(b, d),
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
						`${w} ${frac$1(n, d)}`,
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
					frac$1(top, d),
					"=",
					`? ${frac$1(n, d)}`
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
				while (gcd$2(n, d) !== 1);
				return [
					n,
					d,
					int(r, 2, 6),
					int(r, 0, 1)
				];
			},
			make: (_k, [n, d, k, v]) => {
				if (!isInt(d, 2, 6) || !isInt(n, 1, d - 1) || gcd$2(n, d) !== 1 || !isInt(k, 2, 6) || !isInt(v, 0, 1)) return null;
				const parts = [
					frac$1(n * k, d * k),
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
//#region shared/maths/skillPacks/index.ts
/** The banded packs (everything except times tables, which has its own campaign steps). */
const BANDED_PACKS = {
	"place-value": PLACE_VALUE,
	"add-sub": ADD_SUB,
	division: DIVISION,
	fractions: FRACTIONS$1,
	decimals: DECIMALS
};
PLACE_VALUE.label, ADD_SUB.label, DIVISION.label, FRACTIONS$1.label, DECIMALS.label;
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
const parseBond$1 = (key) => {
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
			const { a, b } = parseBond$1(key);
			return [
				a,
				b,
				int(r, 0, 3)
			];
		},
		make: (key, [a, b, v]) => {
			const bond = parseBond$1(key);
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
const range$4 = (from, to, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
/** Doubles of dblFrom–dblTo and halves of the even numbers halfFrom–halfTo. */
function doublesHalves(label, tag, dblFrom, dblTo, halfFrom, halfTo) {
	const dbls = range$4(dblFrom, dblTo);
	const halves = range$4(halfFrom, halfTo, 2);
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
		tenAnd: {
			label: "\"Ten and\" facts (10 + 4)",
			curriculumTags: ["MS.Y1.NUM.OP.P6"],
			keys: range$4(1, 9).map((n) => `tenand:${n}`),
			roll: (key, r) => [Number(key.split(":")[1]), int(r, 0, 3)],
			make: (key, [n, v]) => {
				if (!isInt(n, 1, 9) || key !== `tenand:${n}` || !isInt(v, 0, 3)) return null;
				const t = String(10 + n);
				const [parts, answer] = v === 0 ? [[
					"10",
					"+",
					String(n),
					"=",
					"?"
				], 10 + n] : v === 1 ? [[
					String(n),
					"+",
					"10",
					"=",
					"?"
				], 10 + n] : v === 2 ? [[
					"10",
					"+",
					"?",
					"=",
					t
				], n] : [[
					t,
					"−",
					"10",
					"=",
					"?"
				], n];
				return {
					parts,
					spoken: speak(parts),
					answer,
					wrong: [
						answer + 1,
						answer - 1,
						answer + 10,
						n + 1,
						20,
						1 + n
					]
				};
			}
		},
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
	],
	ladderOnly: ["tenAnd"]
};
const earlyFactsPack = (saved, random, now) => new BandedPack(EARLY_FACTS, saved, random, now);
//#endregion
//#region shared/maths/skillPacks/generatedKit.ts
/**
* Small tools shared by the generated skills (bonds to 100 and 1000, rounding, times with tens and hundreds, factor pairs,
* squares and cubes, order of operations). These skills make endless questions, so mastery is kept per question TYPE, not per
* fact (docs/MATHS-FOCUS-PLAN.md section 3 and the F.5 results).
*
* Key format: `<skill word>:<detail>[:<detail>]`, lower case, for example `round:100:3digit`, `round:100:near-halfway`,
* `bond100:fives` or `bedmas:brackets-first`. The part before the first colon is 1 to 10 letters or digits (it starts with a
* letter); the rest uses only a-z, 0-9, ':', '+', '/' and '-', and is at most 40 characters. The database check on
* `gem_keep_facts.fact_key` allows exactly that, so no key here needs a migration of its own.
*/
/** The shape the database accepts for a record key (kept in step with `gem_keep_facts_fact_key_check`). */
const RECORD_KEY = /^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$/;
/** "12 500" → 12500, "4.15" → 4.15. Null when it isn't written the way `show` writes numbers. */
function readNumber(text) {
	if (!/^\d+(?: \d{3})*(?:\.\d+)?$/.test(text)) return null;
	const n = Number(text.replace(/ /g, ""));
	return Number.isFinite(n) ? n : null;
}
/** Numbers of decimal places in how a number was written ("4.15" → 2, "7" → 0). */
const decimalPlaces = (text) => (text.split(".")[1] ?? "").length;
/**
* Wrong choices that come from named common mistakes, never from random numbers. Every kept value is different from the
* answer and from each other, a real number the student could type (whole unless `decimal`), and passes `ok` (used when a
* mistake can't be allowed to be right by accident, e.g. a "factor of 24" choice that really is a factor).
* Null when fewer than three are left: the question can't be a multiple-choice one, so the generator must roll again.
*/
function mistakes(answer, named, opts = {}) {
	const kept = {};
	const seen = [];
	for (const [name, raw] of Object.entries(named)) {
		const n = tidy(raw);
		if (!Number.isFinite(n) || n < 0 || sameAnswer(n, answer)) continue;
		if (!opts.decimal && !Number.isInteger(n)) continue;
		if (opts.ok && !opts.ok(n)) continue;
		if (seen.some((s) => sameAnswer(s, n))) continue;
		seen.push(n);
		kept[name] = n;
	}
	return seen.length >= 3 ? {
		wrong: seen,
		named: kept
	} : null;
}
/** A question made from named mistakes (null when there aren't enough). */
function withMistakes(base, named, opts = {}) {
	const found = mistakes(base.answer, named, {
		decimal: base.input === "decimal",
		...opts
	});
	return found ? {
		...base,
		wrong: found.wrong,
		named: found.named
	} : null;
}
const sameParts = (a, b) => a.length === b.length && a.every((p, i) => p === b[i]);
/**
* A family that owns one question type. `size` is how many numbers a question is made from (null if it varies): numbers of
* any other count are refused. A roll that makes a question which could not be asked (too few named mistakes, say) is thrown
* away and rolled again, so every roll is a question the server will also accept.
*/
function oneKey(key, label, tags, size, roll, make) {
	const safe = (k, params) => size === null || params.length === size ? make(k, params) : null;
	return {
		label,
		curriculumTags: tags,
		keys: [key],
		make: safe,
		roll: (k, random) => {
			for (let tries = 0; tries < 1e3; tries++) {
				const params = roll(k, random);
				if (safe(k, params)) return params;
			}
			throw new Error(`${key}: no question could be rolled`);
		}
	};
}
/** A number for a screen reader: 12500 → "12500", 4.15 → "4 point 1 5" (a point and then the digits one by one). */
function say(n) {
	const [whole, frac] = String(tidy(n)).split(".");
	return frac ? `${whole} point ${frac.split("").join(" ")}` : whole;
}
//#endregion
//#region shared/maths/skillPacks/bedmas.ts
/**
* Order of operations (the ladder skill "bedmas"). NZ Curriculum order: brackets first, then × and ÷ left to right, then
* + and − left to right. (Exponents have their own skill, squares and cubes; a square isn't written in these questions.)
*
* Question types (one mastery record each), from the first two-step questions to the mixed ones:
*   bedmas:mul-first       2 + 3 × 4       times before adding or taking away
*   bedmas:div-first       12 − 8 ÷ 4      dividing before adding or taking away
*   bedmas:left-to-right   12 − 4 + 2      same rank: left to right
*   bedmas:brackets-first  (2 + 3) × 4     brackets, then times
*   bedmas:brackets-div    (10 − 4) ÷ 3    brackets, then divide
*   bedmas:mixed           2 + 3 × 4 − 5   three steps, no brackets
*   bedmas:mixed-brackets  (2 + 3) × 4 − 5 three steps with brackets
*
* Every question is four choices to tap (James, 19 Oct 2026). The wrong choices are what a student gets by following a named
* mistake (working left to right gives 20 for 2 + 3 × 4), never a random number, and they are always different from the right
* answer and from each other. A question where fewer than three mistakes give a different whole number is never asked.
*/
const isOp = (t) => t === "+" || t === "−" || t === "×" || t === "÷";
const TEMPLATES = [
	...[
		"a + b × c",
		"a − b × c",
		"a × b + c",
		"a × b − c"
	].map((src) => ({
		key: "bedmas:mul-first",
		src
	})),
	...[
		"a + b ÷ c",
		"a − b ÷ c",
		"a ÷ b + c",
		"a ÷ b − c"
	].map((src) => ({
		key: "bedmas:div-first",
		src
	})),
	...[
		"a − b + c",
		"a − b − c",
		"a ÷ b × c",
		"a × b ÷ c"
	].map((src) => ({
		key: "bedmas:left-to-right",
		src
	})),
	...[
		"(a + b) × c",
		"(a − b) × c",
		"a × (b + c)",
		"a × (b − c)"
	].map((src) => ({
		key: "bedmas:brackets-first",
		src
	})),
	...[
		"(a + b) ÷ c",
		"(a − b) ÷ c",
		"a ÷ (b + c)",
		"a ÷ (b − c)"
	].map((src) => ({
		key: "bedmas:brackets-div",
		src
	})),
	...[
		"a + b × c − d",
		"a × b + c × d",
		"a × b − c × d",
		"a − b ÷ c + d",
		"a + b × c + d"
	].map((src) => ({
		key: "bedmas:mixed",
		src
	})),
	...[
		"(a + b) × c − d",
		"a + b × (c − d)",
		"(a − b) × c + d",
		"a × (b + c) − d",
		"(a + b) × (c − d)",
		"(a + b) ÷ c + d"
	].map((src) => ({
		key: "bedmas:mixed-brackets",
		src
	}))
];
const BEDMAS_KEYS = [...new Set(TEMPLATES.map((t) => t.key))];
const lettersOf = (src) => (src.match(/[a-d]/g) ?? []).length;
/** The template with its numbers put in, as tokens. */
function tokensOf(src, nums) {
	let next = 0;
	return (src.match(/[a-d]|[+−×÷]|[()]/g) ?? []).map((t) => /[a-d]/.test(t) ? nums[next++] : t);
}
/** What the student sees: a bracket group is one part, '(2 + 3)'. */
function partsOf(tokens) {
	const parts = [];
	let group = null;
	for (const t of tokens) if (t === "(") group = [];
	else if (t === ")") {
		parts.push(`(${group.join(" ")})`);
		group = null;
	} else (group ?? parts).push(String(t));
	return [
		...parts,
		"=",
		"?"
	];
}
const words = (tokens) => tokens.map((t) => t === "+" ? "plus" : t === "−" ? "minus" : t === "×" ? "times" : t === "÷" ? "divided by" : t === "(" ? "open bracket" : t === ")" ? "close bracket" : String(t)).join(" ");
const RIGHT = {
	rank: "normal",
	brackets: true,
	exact: true
};
function evaluate(all, way) {
	const tokens = way.brackets ? all : all.filter((t) => t !== "(" && t !== ")");
	let i = 0;
	const level = (op) => way.rank === "flat" ? 1 : (op === "×" || op === "÷") === (way.rank === "normal") ? 2 : 1;
	const apply = (op, a, b) => {
		const v = op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;
		return way.exact && (!Number.isInteger(v) || v < 0) ? NaN : v;
	};
	const atom = () => {
		const t = tokens[i++];
		if (t === "(") {
			const v = expr(1);
			i++;
			return v;
		}
		return typeof t === "number" ? t : NaN;
	};
	const expr = (min) => {
		let left = atom();
		while (i < tokens.length) {
			const op = tokens[i];
			if (!isOp(op) || level(op) < min) break;
			i++;
			const right = expr(way.right ? level(op) : level(op) + 1);
			left = apply(op, left, right);
		}
		return left;
	};
	const value = expr(1);
	return i === tokens.length ? value : NaN;
}
/** The tokens with the first number (or bracket group) and the sign after it taken off. */
function withoutFirst(tokens) {
	let i = 0;
	if (tokens[0] === "(") i = tokens.indexOf(")") + 1;
	else i = 1;
	return tokens.slice(i + 1);
}
/** The tokens with the last number (or bracket group) and the sign before it taken off. */
function withoutLast(tokens) {
	let end = tokens.length;
	if (tokens[end - 1] === ")") end = tokens.lastIndexOf("(");
	else end -= 1;
	return tokens.slice(0, end - 1);
}
/** The named mistakes, as the number each one gives for this expression. */
function mistakesFor(tokens) {
	const left = {
		rank: "flat",
		brackets: true
	};
	const noBrackets = { rank: "normal" };
	const sum = tokens.filter((t) => typeof t === "number").reduce((a, b) => a + b, 0);
	const hasBrackets = tokens.includes("(");
	const named = {
		"worked left to right": evaluate(tokens, left),
		"did adding and taking away first": evaluate(tokens, {
			rank: "reversed",
			brackets: true
		}),
		"worked right to left": evaluate(tokens, {
			rank: "flat",
			right: true,
			brackets: true
		}),
		"worked equal steps right to left": evaluate(tokens, {
			rank: "normal",
			right: true,
			brackets: true
		}),
		"added every number": sum,
		"left out the first number": evaluate(withoutFirst(tokens), {
			rank: "normal",
			brackets: true
		}),
		"left out the last number": evaluate(withoutLast(tokens), {
			rank: "normal",
			brackets: true
		})
	};
	if (hasBrackets) {
		named["ignored the brackets"] = evaluate(tokens, noBrackets);
		named["ignored the brackets and worked left to right"] = evaluate(tokens, { rank: "flat" });
	}
	return named;
}
const MAX_NUMBER = 30;
const MAX_ANSWER = 300;
function build(templateIndex, nums) {
	const template = TEMPLATES[templateIndex];
	if (!template || nums.length !== lettersOf(template.src) || !nums.every((n) => isInt(n, 2, MAX_NUMBER))) return null;
	const tokens = tokensOf(template.src, nums);
	const answer = evaluate(tokens, RIGHT);
	if (!Number.isInteger(answer) || answer < 1 || answer > MAX_ANSWER) return null;
	return {
		tokens,
		answer
	};
}
function bedmasFamily(key, label) {
	const mine = TEMPLATES.map((t, i) => ({
		...t,
		i
	})).filter((t) => t.key === key);
	return oneKey(key, label, ["MS.Y6.NUM.OP.P1"], null, (_k, r) => {
		for (;;) {
			const t = pickOne(r, mine);
			const nums = Array.from({ length: lettersOf(t.src) }, (_, n) => int(r, 2, n === 0 && /^a [+−]/.test(t.src) ? 30 : 12));
			const made = build(t.i, nums);
			if (made && withMistakes({
				parts: [],
				spoken: "",
				answer: made.answer
			}, mistakesFor(made.tokens))) return [t.i, ...nums];
		}
	}, (k, [index, ...nums]) => {
		if (TEMPLATES[index]?.key !== k) return null;
		const made = build(index, nums);
		if (!made) return null;
		const parts = partsOf(made.tokens);
		return withMistakes({
			parts,
			spoken: `What is ${words(made.tokens)}?`,
			answer: made.answer,
			choose: true,
			fact: `${parts.slice(0, -2).join(" ")} = ${made.answer}`
		}, mistakesFor(made.tokens));
	});
}
const LABELS = {
	"bedmas:mul-first": "Times before adding or taking away (2 + 3 × 4)",
	"bedmas:div-first": "Dividing before adding or taking away (12 − 8 ÷ 4)",
	"bedmas:left-to-right": "Same-rank steps from left to right (12 − 4 + 2)",
	"bedmas:brackets-first": "Brackets first, then times ((2 + 3) × 4)",
	"bedmas:brackets-div": "Brackets first, then divide ((10 − 4) ÷ 3)",
	"bedmas:mixed": "Three steps without brackets (2 + 3 × 4 − 5)",
	"bedmas:mixed-brackets": "Three steps with brackets ((2 + 3) × 4 − 5)"
};
const BEDMAS_FAMILIES = Object.fromEntries(BEDMAS_KEYS.map((k) => [k, bedmasFamily(k, LABELS[k])]));
/** The expression of a template as a pattern for reading it back: '(a + b) × c' → /^\((\d+) \+ (\d+)\) × (\d+)$/. */
const PATTERNS = TEMPLATES.map((t) => new RegExp("^" + t.src.replace(/[()+×÷]/g, "\\$&").replace(/[a-d]/g, "(\\d{1,2})") + "$"));
/** Reads '2 + 3 × 4 = ?' (as shown) back into its type and numbers. */
const parseBedmas = (parts) => {
	if (parts.length < 4 || parts[parts.length - 2] !== "=" || parts[parts.length - 1] !== "?") return null;
	const text = parts.slice(0, -2).join(" ");
	for (let i = 0; i < TEMPLATES.length; i++) {
		const m = PATTERNS[i].exec(text);
		if (!m) continue;
		const nums = m.slice(1).map(Number);
		const made = BEDMAS_FAMILIES[TEMPLATES[i].key].make(TEMPLATES[i].key, [i, ...nums]);
		if (made && sameParts(made.parts, parts)) return {
			key: TEMPLATES[i].key,
			params: [i, ...nums]
		};
	}
	return null;
};
TEMPLATES.length;
//#endregion
//#region shared/maths/skillPacks/pickKit.ts
/**
* Tools for the fraction, decimal and percentage skills (F.6): questions where the student taps one of several text choices
* ("3/4", "0.25", "25%"), and spoken text that reads fractions, decimals and percentages well.
*
* A pick question is made from its numbers like every other: the numbers end with two more, `slot` (where the right choice sits)
* and `salt` (which of the named mistakes are used), both rolled once and kept in `Question.params`. So the same numbers always
* make the same question, choices in the same order, and the server can rebuild it to mark the tap (the answer is the index of
* the choice, 0 to 3).
*
* Wrong choices are always the answer a student gets by following a named mistake, never a random number. Fractions stay under
* one (James, 19 Oct 2026): no 7/4 or 1 3/4 as a question or a choice.
*/
/** The value a choice shows: "3/4" → 0.75, "25%" → 0.25, "0.25" → 0.25. Null for anything else. */
function labelValue(label) {
	const f = /^(\d+)\/(\d+)$/.exec(label);
	if (f) return Number(f[2]) > 0 ? Number(f[1]) / Number(f[2]) : null;
	const p = /^(\d+(?:\.\d+)?)%$/.exec(label);
	if (p) return Number(p[1]) / 100;
	return /^\d+(?:\.\d+)?$/.test(label) ? Number(label) : null;
}
const frac = (n, d) => `${n}/${d}`;
const gcd$1 = (a, b) => b === 0 ? a : gcd$1(b, a % b);
/** A question's parts spoken for a screen reader: "3/4" is "3 quarters", "25%" is "25 percent", "0.25" is "0 point 2 5". */
function talk(parts) {
	const words = {
		"+": "plus",
		"−": "minus",
		"×": "times",
		"÷": "divided by",
		"=": "equals",
		"?": "what",
		"%": "percent"
	};
	const text = parts.map((p) => words[p] ?? (/^\d+\.\d+$/.test(p) ? say(Number(p)) : spokenLabel(p))).join(" ").replace(/\s+/g, " ").trim();
	return /[?.!:]$/.test(text) ? text : `${text}?`;
}
/** The two numbers every pick question ends with. */
const rollPick = (random, wrong = 3) => [int(random, 0, wrong), int(random, 0, 9)];
/** Are `slot` and `salt` numbers a roll could have given? */
const goodPick = (slot, salt, wrong = 3) => isInt(slot, 0, wrong) && isInt(salt, 0, 9);
/**
* A question with the right choice and choices from named mistakes. `named` maps the name of each mistake to the choice it
* gives. Choices that repeat the right one (or each other, in value) are dropped; null when fewer than needed are left, so the
* generator rolls again.
*/
function pick$1(base, right, named, opts) {
	const need = opts.wrong ?? 3;
	if (!goodPick(opts.slot, opts.salt, need)) return null;
	const kept = [];
	const labels = new Set([right]);
	const values = [];
	const rightValue = labelValue(right);
	if (rightValue !== null) values.push(rightValue);
	for (const [name, label] of Object.entries(named)) {
		if (labels.has(label)) continue;
		const v = labelValue(label);
		if (/^\d+\/\d+$/.test(label) && (v === null || v > 1 || v === 0)) continue;
		if (!opts.allowEqual && v !== null && values.some((x) => Math.abs(x - v) < 1e-9)) continue;
		labels.add(label);
		if (v !== null) values.push(v);
		kept.push([name, label]);
	}
	if (kept.length < need) return null;
	const start = opts.salt % kept.length;
	const used = Array.from({ length: need }, (_, i) => kept[(start + i) % kept.length]);
	const choices = used.map(([, label]) => label);
	choices.splice(opts.slot, 0, right);
	return {
		...base,
		answer: opts.slot,
		pick: choices,
		namedLabels: Object.fromEntries(used),
		fact: base.fact
	};
}
//#endregion
//#region shared/maths/skillPacks/decimalSkills.ts
/**
* Tenths and decimals (ladder skills `tenths`, `add-tenths`, `decimal-equivalents` and `times-decimals`).
*
* Number answers (1.3 + 0.2, 34 ÷ 10) are typed on the pad with the point key. A question whose answer is a fraction or a
* decimal that is picked from a list is always four choices to tap, with text labels ("3/10", "0.3"). Wrong choices are the
* answer a named mistake gives ("put it in the hundredths place", "thought the longer decimal is bigger"), never a random number.
*
* Decimals are made from whole numbers of tenths or hundredths (1.3 is 13 tenths), so no question is ever made from a number that
* carries floating-point dust.
*
* Types:
*   tenths              tenth:to-fraction  tenth:to-decimal  tenth:divide  tenth:count  tenth:half
*   add-tenths          addten:add  addten:carry  addten:take  addten:borrow  addten:whole  addten:to-one
*   decimal-equivalents deceq:common  deceq:pick  deceq:hundredths  deceq:to-fraction  deceq:compare
*   times-decimals      timesdec:ten  timesdec:hundred  timesdec:div-ten  timesdec:div-hundred  timesdec:missing
*/
const range$3 = (from, to, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const tenths = (n) => show(n / 10);
const hundredths = (n) => show(n / 100);
const notTen = (n) => n % 10 !== 0;
const TENTH_TAGS = ["MS.Y4.NUM.RN.P3", "MS.Y4.NUM.RN.P5"];
/** Whole tenths, which a tenth count of 1 to 39 that is not a whole number can be shown as (0.7, 1.4, 3.9). */
const COUNTS = range$3(1, 39).filter(notTen);
const tenthFamilies = [
	oneKey("tenth:to-fraction", "A decimal as tenths (0.3 = 3/10)", TENTH_TAGS, 3, (_k, r) => [int(r, 2, 9), ...rollPick(r)], (_k, [d, slot, salt]) => {
		if (!isInt(d, 2, 9) || !goodPick(slot, salt)) return null;
		const right = frac(d, 10);
		const parts = [
			tenths(d),
			"=",
			"?"
		];
		return pick$1({
			parts,
			spoken: talk(parts),
			fact: `${tenths(d)} = ${right}`
		}, right, {
			"put it over 100": frac(d, 100),
			"put 1 over the digit": frac(1, d),
			"counted from the other end": frac(10 - d, 10),
			"put 1 over the digit with a zero": frac(1, d * 10)
		}, {
			slot,
			salt
		});
	}),
	oneKey("tenth:to-decimal", "Tenths as a decimal (3/10 = 0.3)", TENTH_TAGS, 3, (_k, r) => [int(r, 1, 9), ...rollPick(r)], (_k, [d, slot, salt]) => {
		if (!isInt(d, 1, 9) || !goodPick(slot, salt)) return null;
		const right = tenths(d);
		const parts = [
			frac(d, 10),
			"=",
			"?"
		];
		return pick$1({
			parts,
			spoken: talk(parts),
			fact: `${frac(d, 10)} = ${right}`
		}, right, {
			"put it in the hundredths place": hundredths(d),
			"read it as a whole number and a tenth": `${d}.1`,
			"counted from the other end": tenths(10 - d),
			"wrote just the top number": String(d)
		}, {
			slot,
			salt
		});
	}),
	oneKey("tenth:divide", "Dividing by 10 to make tenths (27 ÷ 10 = 2.7)", TENTH_TAGS, 1, (_k, r) => [pickOne(r, range$3(1, 99).filter(notTen))], (_k, [n]) => {
		if (!isInt(n, 1, 99) || !notTen(n)) return null;
		const parts = [
			show(n),
			"÷",
			"10",
			"=",
			"?"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: n / 10,
			input: "decimal"
		}, {
			"multiplied by 10 instead": n * 10,
			"moved the point two places": n / 100,
			"left it as it was": n,
			"moved the point two places the wrong way": n * 100
		});
	}),
	oneKey("tenth:count", "How many tenths (1.4 = ?/10)", TENTH_TAGS, 1, (_k, r) => [pickOne(r, COUNTS)], (_k, [t]) => {
		if (!COUNTS.includes(t)) return null;
		const parts = [
			tenths(t),
			"=",
			"?/10"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: t
		}, {
			"used the digit after the point only": t % 10,
			"added a zero": t * 10,
			"used the whole number only": Math.floor(t / 10),
			"one tenth too many": t + 1,
			"one tenth too few": t - 1
		});
	}),
	oneKey("tenth:half", "Half and double of tenths (half of 1.4 = 0.7)", TENTH_TAGS, 2, (_k, r) => r() < .5 ? [pickOne(r, range$3(2, 38, 2)), 0] : [int(r, 1, 24), 1], (_k, [t, v]) => {
		if (v === 0) {
			if (!isInt(t, 2, 38) || t % 2 !== 0) return null;
			const parts = [
				"Half",
				"of",
				tenths(t),
				"=",
				"?"
			];
			const whole = Math.floor(t / 10);
			const part = t % 10;
			return withMistakes({
				parts,
				spoken: talk(parts),
				answer: t / 20,
				input: "decimal"
			}, {
				"halved only the whole number": whole / 2 + part / 10,
				"halved only the tenths": whole + part / 20,
				"doubled instead of halving": t / 5,
				"gave the number back": t / 10,
				"took half off the number": t / 10 - .5
			});
		}
		if (v !== 1 || !isInt(t, 1, 24)) return null;
		const parts = [
			"Double",
			tenths(t),
			"=",
			"?"
		];
		const whole = Math.floor(t / 10);
		const part = t % 10;
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: t / 5,
			input: "decimal"
		}, {
			"doubled only the whole number": whole * 2 + part / 10,
			"doubled only the tenths": whole + part / 5,
			"halved instead of doubling": t / 20,
			"gave the number back": t / 10,
			"added 2": t / 10 + 2
		});
	})
];
const ADD_TAGS = ["MS.Y4.NUM.RN.P10"];
const ones = (t) => Math.floor(t / 10);
const dig = (t) => t % 10;
/** A pair of tenth counts for "a + b" or "a − b", made by `make`; the type checks which kind of pair it is. */
function twoTenths(key, label, ok, sign, named, aLo, aHi) {
	const pool = range$3(aLo, aHi).flatMap((a) => range$3(1, aHi).filter((b) => ok(a, b)).map((b) => [a, b]));
	return oneKey(key, label, ADD_TAGS, 2, (_k, r) => pickOne(r, pool), (_k, [a, b]) => {
		if (!isInt(a, 1, 99) || !isInt(b, 1, 99) || !ok(a, b)) return null;
		const parts = [
			tenths(a),
			sign,
			tenths(b),
			"=",
			"?"
		];
		const answer = (sign === "+" ? a + b : a - b) / 10;
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer,
			input: "decimal"
		}, {
			...named(a, b),
			"one tenth too many": answer + .1,
			"one tenth too few": answer - .1
		});
	});
}
const addFamilies = [
	twoTenths("addten:add", "Adding tenths (1.3 + 0.2)", (a, b) => dig(a) > 0 && dig(b) > 0 && dig(a) + dig(b) < 10 && a + b <= 49, "+", (a, b) => ({
		"forgot the point": a + b,
		"put the point in the hundredths place": (a + b) / 100
	}), 1, 49),
	twoTenths("addten:carry", "Adding tenths that make a whole (0.7 + 0.5)", (a, b) => dig(a) > 0 && dig(b) > 0 && dig(a) + dig(b) >= 10 && a + b <= 59, "+", (a, b) => ({
		"wrote the tenths total after the point": Number(`${ones(a) + ones(b)}.${dig(a) + dig(b)}`),
		"forgot to carry the ten tenths": ones(a) + ones(b) + (dig(a) + dig(b) - 10) / 10,
		"carried to the wrong place": ones(a) + ones(b) + (dig(a) + dig(b)) / 10,
		"forgot the point": a + b
	}), 1, 49),
	twoTenths("addten:take", "Taking away tenths (1.5 − 0.2)", (a, b) => a > b && dig(b) > 0 && dig(b) <= dig(a) && a - b >= 1, "−", (a, b) => ({
		"added instead": (a + b) / 10,
		"forgot the point": a - b
	}), 2, 49),
	twoTenths("addten:borrow", "Taking away tenths across a whole (1.2 − 0.5)", (a, b) => a > b && dig(b) > dig(a) && a - b >= 1 && a <= 49, "−", (a, b) => ({
		"took the smaller tenths digit from the bigger": ones(a) - ones(b) + Math.abs(dig(a) - dig(b)) / 10,
		"did not take one off the whole after borrowing": (a - b) / 10 + 1,
		"added instead": (a + b) / 10,
		"forgot the point": a - b
	}), 2, 49),
	oneKey("addten:whole", "A whole number and tenths (3 + 0.4, 5 − 0.3)", ADD_TAGS, 3, (_k, r) => [
		int(r, 1, 9),
		int(r, 1, 9),
		int(r, 0, 2)
	], (_k, [w, t, v]) => {
		if (!isInt(w, 1, 9) || !isInt(t, 1, 9) || !isInt(v, 0, 2)) return null;
		const small = tenths(t);
		if (v === 2) {
			const parts = [
				String(w),
				"−",
				small,
				"=",
				"?"
			];
			const answer = w - t / 10;
			return withMistakes({
				parts,
				spoken: talk(parts),
				answer,
				input: "decimal"
			}, {
				"took off whole ones, not tenths": w - t,
				"added instead": w + t / 10,
				"took one off the whole and kept the tenths": w - 1 + t / 10,
				"one tenth too many": answer + .1,
				"one tenth too few": answer - .1
			});
		}
		const parts = v === 0 ? [
			String(w),
			"+",
			small,
			"=",
			"?"
		] : [
			small,
			"+",
			String(w),
			"=",
			"?"
		];
		const answer = w + t / 10;
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer,
			input: "decimal"
		}, {
			"ignored the point": w * 10 + t,
			"put the tenths in the hundredths place": w + t / 100,
			"added the digits": w + t,
			"one tenth too many": answer + .1,
			"one tenth too few": answer - .1
		});
	}),
	oneKey("addten:to-one", "Tenths that make a whole (0.4 + ? = 1)", ADD_TAGS, 3, (_k, r) => [
		int(r, 1, 9),
		int(r, 1, 2),
		int(r, 0, 2)
	], (_k, [t, target, v]) => {
		if (!isInt(t, 1, 9) || !isInt(target, 1, 2) || !isInt(v, 0, 2)) return null;
		const small = tenths(t);
		const parts = v === 0 ? [
			small,
			"+",
			"?",
			"=",
			String(target)
		] : v === 1 ? [
			"?",
			"+",
			small,
			"=",
			String(target)
		] : [
			String(target),
			"−",
			small,
			"=",
			"?"
		];
		const answer = target - t / 10;
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer,
			input: "decimal"
		}, {
			"wrote the same tenths": t / 10,
			"added instead": target + t / 10,
			"forgot the point": answer * 10,
			"put it in the hundredths place": answer / 10,
			"one tenth too many": answer + .1,
			"one tenth too few": answer - .1
		});
	})
];
const EQUIV_TAGS$1 = ["MS.Y5.NUM.RN.P4"];
/** Fractions with an easy decimal: [top, bottom]. */
const COMMON = [
	[1, 2],
	[1, 4],
	[3, 4],
	[1, 5],
	[2, 5],
	[3, 5],
	[4, 5]
];
const isCommon = (n, d) => COMMON.some(([a, b]) => a === n && b === d);
const decimalOf = (n, d) => n / d;
/** What a student gets by following each named mistake, as a decimal. */
function decimalMistakes(n, d) {
	return {
		"put the top and bottom either side of the point": Number(`${n}.${d}`),
		"put the top and bottom after a zero point": Number(`0.${n}${d}`),
		"put the bottom and top either side of the point": Number(`${d}.${n}`),
		"gave the part that is left": 1 - n / d,
		"used the bottom number after the point": Number(`0.${d}`),
		"used the top number after the point": Number(`0.${n}`)
	};
}
const fractionOf = {
	"0.5": {
		"put 1 over the digit": "1/5",
		"put 1 over the number": "1/50",
		"put it over 100": "5/100",
		"mixed up with 0.25": "1/4"
	},
	"0.25": {
		"put 1 over the digits": "1/25",
		"used the digits as top and bottom": "2/5",
		"mixed up with 0.5": "1/2",
		"mixed up with 0.2": "1/5"
	},
	"0.75": {
		"put 1 over the digits": "1/75",
		"swapped the digits": "5/7",
		"mixed up with 0.25": "1/4",
		"used only the tenths digit": "7/10"
	},
	"0.2": {
		"swapped the digit and the point": "1/2",
		"put it over 100": "2/100",
		"put 1 over the number with a zero": "1/20",
		"mixed up with 0.4": "2/5"
	}
};
const FRACTION_DECIMALS = [
	["0.5", "1/2"],
	["0.25", "1/4"],
	["0.75", "3/4"],
	["0.2", "1/5"]
];
const equivFamilies$1 = [
	oneKey("deceq:common", "A fraction as a decimal (3/4 = 0.75)", EQUIV_TAGS$1, 2, (_k, r) => pickOne(r, COMMON), (_k, [n, d]) => {
		if (!isCommon(n, d)) return null;
		const parts = [
			frac(n, d),
			"=",
			"?"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: decimalOf(n, d),
			input: "decimal"
		}, decimalMistakes(n, d));
	}),
	oneKey("deceq:pick", "Which decimal is the same as the fraction? (3/4 = 0.75)", EQUIV_TAGS$1, 4, (_k, r) => [...pickOne(r, COMMON), ...rollPick(r)], (_k, [n, d, slot, salt]) => {
		if (!isCommon(n, d) || !goodPick(slot, salt)) return null;
		const right = show(decimalOf(n, d));
		const parts = [
			frac(n, d),
			"=",
			"?"
		];
		const named = Object.fromEntries(Object.entries(decimalMistakes(n, d)).map(([name, v]) => [name, show(v)]));
		return pick$1({
			parts,
			spoken: talk(parts),
			fact: `${frac(n, d)} = ${right}`
		}, right, named, {
			slot,
			salt
		});
	}),
	oneKey("deceq:hundredths", "Hundredths as a decimal (7/100 = 0.07)", EQUIV_TAGS$1, 1, (_k, r) => [pickOne(r, range$3(1, 99).filter(notTen))], (_k, [n]) => {
		if (!isInt(n, 1, 99) || !notTen(n)) return null;
		const parts = [
			frac(n, 100),
			"=",
			"?"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: n / 100,
			input: "decimal"
		}, {
			"put it in the tenths place": n / 10,
			"wrote it as a whole number": n,
			"put it in the thousandths place": n / 1e3,
			...n >= 10 ? { "swapped the digits": Number(`0.${String(n).split("").reverse().join("")}`) } : {}
		});
	}),
	oneKey("deceq:to-fraction", "A decimal as a fraction (0.75 = 3/4)", EQUIV_TAGS$1, 3, (_k, r) => [int(r, 0, FRACTION_DECIMALS.length - 1), ...rollPick(r)], (_k, [i, slot, salt]) => {
		const pair = FRACTION_DECIMALS[i];
		if (!pair || !isInt(i, 0, FRACTION_DECIMALS.length - 1) || !goodPick(slot, salt)) return null;
		const [decimal, right] = pair;
		const parts = [
			decimal,
			"=",
			"?"
		];
		return pick$1({
			parts,
			spoken: talk(parts),
			fact: `${decimal} = ${right}`
		}, right, fractionOf[decimal], {
			slot,
			salt
		});
	}),
	oneKey("deceq:compare", "Which decimal is bigger? (0.25 or 0.3)", EQUIV_TAGS$1, 5, (_k, r) => {
		if (r() < .5) {
			const x = pickOne(r, range$3(1, 98).filter(notTen));
			return [
				x,
				int(r, Math.floor(x / 10) + 1, 9),
				0,
				...rollPick(r, 1)
			];
		}
		const x = pickOne(r, range$3(11, 99).filter(notTen));
		return [
			x,
			Math.floor(x / 10),
			1,
			...rollPick(r, 1)
		];
	}, (_k, [x, y, v, slot, salt]) => {
		if (!goodPick(slot, salt, 1) || !isInt(x, 1, 99) || !notTen(x) || !isInt(v, 0, 1)) return null;
		const smaller = v === 0 ? x : y * 10;
		const bigger = v === 0 ? y * 10 : x;
		if (v === 0 && !(isInt(y, 1, 9) && y * 10 > x)) return null;
		if (v === 1 && !(isInt(y, 1, 9) && y === Math.floor(x / 10))) return null;
		const right = hundredths(bigger);
		const wrong = hundredths(smaller);
		return pick$1({
			parts: ["Which is bigger?"],
			spoken: "Which is bigger?",
			fact: `${right} is bigger than ${wrong}`
		}, right, { [v === 0 ? "thought the longer decimal is bigger" : "ignored the last digit"]: wrong }, {
			slot,
			salt,
			wrong: 1
		});
	})
];
const TIMES_TAGS = ["MS.Y5.NUM.RN.P7"];
/** The four ways a student gets the number of zeros or places wrong. */
const places = (answer) => {
	const all = {
		"moved the point one place too far": answer * 10,
		"moved the point one place too few": answer / 10,
		"moved the point two places too far": answer * 100,
		"moved the point two places too few": answer / 100
	};
	return Object.fromEntries(Object.entries(all).filter(([, v]) => v >= .01));
};
function moveFamily(key, label, make, check, build) {
	return oneKey(key, label, TIMES_TAGS, 1, (_k, r) => make(r), (_k, [n]) => {
		if (!isInt(n, 1, 1e5) || !check(n)) return null;
		const { parts, answer, named } = build(n);
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer,
			input: "decimal"
		}, named);
	});
}
const timesFamilies = [
	moveFamily("timesdec:ten", "Times 10 with a decimal (3.4 × 10)", (r) => [pickOne(r, range$3(11, 99).filter(notTen))], (t) => t >= 11 && t <= 99 && notTen(t), (t) => ({
		parts: [
			tenths(t),
			"×",
			"10",
			"=",
			"?"
		],
		answer: t,
		named: {
			"moved the point the wrong way": t / 100,
			"did not move the point": t / 10,
			"moved the point two places": t * 10,
			"moved the point two places the wrong way": t / 1e3
		}
	})),
	moveFamily("timesdec:hundred", "Times 100 with a decimal (0.35 × 100)", (r) => [pickOne(r, range$3(11, 999).filter((h) => h % 100 !== 0))], (h) => h >= 11 && h <= 999 && h % 100 !== 0, (h) => ({
		parts: [
			hundredths(h),
			"×",
			"100",
			"=",
			"?"
		],
		answer: h,
		named: {
			"moved the point only one place": h / 10,
			"moved the point the wrong way": h / 1e4,
			"did not move the point": h / 100,
			"moved the point three places": h * 10
		}
	})),
	moveFamily("timesdec:div-ten", "Dividing a decimal by 10 (3.4 ÷ 10)", (r) => [pickOne(r, range$3(11, 199).filter(notTen))], (t) => t >= 11 && t <= 199 && notTen(t), (t) => ({
		parts: [
			tenths(t),
			"÷",
			"10",
			"=",
			"?"
		],
		answer: t / 100,
		named: {
			"moved the point the wrong way": t,
			"moved the point two places": t / 1e3,
			"did not move the point": t / 10,
			"moved the point two places the wrong way": t * 10
		}
	})),
	moveFamily("timesdec:div-hundred", "Dividing by 100 (345 ÷ 100)", (r) => [pickOne(r, range$3(12, 999).filter((n) => n % 100 !== 0))], (n) => n >= 12 && n <= 999 && n % 100 !== 0, (n) => ({
		parts: [
			show(n),
			"÷",
			"100",
			"=",
			"?"
		],
		answer: n / 100,
		named: {
			"moved the point only one place": n / 10,
			"moved the point the wrong way": n * 100,
			"moved the point three places": n / 1e3,
			"did not move the point": n
		}
	})),
	oneKey("timesdec:missing", "A missing 10 or 100 (0.6 × ? = 60)", TIMES_TAGS, 2, (_k, r) => [pickOne(r, range$3(11, 99).filter(notTen)), int(r, 0, 3)], (_k, [t, v]) => {
		if (!isInt(t, 11, 99) || !notTen(t) || !isInt(v, 0, 3)) return null;
		const small = tenths(t);
		const [parts, answer] = v === 0 ? [[
			small,
			"×",
			"?",
			"=",
			String(t)
		], 10] : v === 1 ? [[
			small,
			"×",
			"?",
			"=",
			String(t * 10)
		], 100] : v === 2 ? [[
			"?",
			"×",
			"10",
			"=",
			small
		], t / 100] : [[
			"?",
			"÷",
			"10",
			"=",
			small
		], t];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer,
			input: "decimal"
		}, places(answer));
	})
];
const DECIMAL_FAMILIES = Object.fromEntries([
	...tenthFamilies,
	...addFamilies,
	...equivFamilies$1,
	...timesFamilies
].map((f) => [f.keys[0], f]));
const DECIMAL_SKILL_KEYS = {
	tenths: [
		"tenth:to-fraction",
		"tenth:to-decimal",
		"tenth:divide",
		"tenth:count",
		"tenth:half"
	],
	"add-tenths": [
		"addten:add",
		"addten:carry",
		"addten:take",
		"addten:borrow",
		"addten:whole",
		"addten:to-one"
	],
	"decimal-equivalents": [
		"deceq:common",
		"deceq:pick",
		"deceq:hundredths",
		"deceq:to-fraction",
		"deceq:compare"
	],
	"times-decimals": [
		"timesdec:ten",
		"timesdec:hundred",
		"timesdec:div-ten",
		"timesdec:div-hundred",
		"timesdec:missing"
	]
};
//#endregion
//#region shared/maths/skillPacks/fdpSkills.ts
/**
* Fractions, decimals and percentages that mean the same thing (ladder skill `fdp-equivalents`): fifths, tenths, twentieths and
* hundredths as percentages and decimals.
*
* A number answer (3/5 = ?%) is typed on the pad; picking the fraction or the percentage is always four choices to tap. Wrong
* choices are the answer a named mistake gives, never a random number. Fractions stay under one.
*
* Types: fdp:frac-to-pct  fdp:pct-to-frac  fdp:dec-to-pct  fdp:pct-to-dec  fdp:match
*/
const TAGS = ["MS.Y6.NUM.RN.P3", "MS.Y6.NUM.RN.P4"];
const range$2 = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const reversed = (n) => Number(String(n).split("").reverse().join(""));
/** Fractions with an easy percentage: [top, bottom]. */
const FRACTIONS = [
	[1, 5],
	[2, 5],
	[3, 5],
	[4, 5],
	[1, 20],
	[3, 10],
	[7, 10],
	[9, 10]
];
const percentOf = (n, d) => n * 100 / d;
/** The fraction for each percentage in `pct:pct-to-frac`, and what a student gets by following a named mistake. */
const FRACTION_FOR = {
	20: {
		right: "1/5",
		named: {
			"put 1 over the percent": "1/20",
			"mixed up with 50%": "1/2",
			"mixed up with 25%": "1/4",
			"mixed up with 10%": "1/10"
		}
	},
	40: {
		right: "2/5",
		named: {
			"put 1 over the percent": "1/40",
			"doubled the right fraction": "4/5",
			"put 1 over the tens digit": "1/4",
			"mixed up with 50%": "1/2"
		}
	},
	60: {
		right: "3/5",
		named: {
			"put 1 over the percent": "1/60",
			"put 1 over the tens digit": "1/6",
			"mixed up with 40%": "2/5",
			"mixed up with 75%": "3/4"
		}
	},
	80: {
		right: "4/5",
		named: {
			"put 1 over the percent": "1/80",
			"put 1 over the tens digit": "1/8",
			"mixed up with 75%": "3/4",
			"mixed up with 40%": "2/5"
		}
	},
	5: {
		right: "1/20",
		named: {
			"put 1 over the digit": "1/5",
			"put 1 over the number with a zero": "1/50",
			"mixed up with 50%": "1/2",
			"mixed up with 10%": "1/10"
		}
	},
	30: {
		right: "3/10",
		named: {
			"put 1 over the percent": "1/30",
			"put 1 over the tens digit": "1/3",
			"put it over 100": "3/100",
			"counted from the other end": "7/10"
		}
	},
	70: {
		right: "7/10",
		named: {
			"put 1 over the percent": "1/70",
			"put 1 over the tens digit": "1/7",
			"put it over 100": "7/100",
			"counted from the other end": "3/10"
		}
	},
	90: {
		right: "9/10",
		named: {
			"put 1 over the percent": "1/90",
			"put 1 over the tens digit": "1/9",
			"put it over 100": "9/100",
			"counted from the other end": "1/10"
		}
	}
};
const FRACTION_PERCENTS = Object.keys(FRACTION_FOR).map(Number);
/** Percentages for the typed percentage-to-decimal and the match question: not the ones other skills already ask. */
const OTHERS = range$2(1, 99).filter((p) => ![
	10,
	25,
	50,
	75
].includes(p));
const MATCH = range$2(1, 99).filter((h) => h % 10 !== 0 && h !== 25 && h !== 75);
const families$1 = [
	oneKey("fdp:frac-to-pct", "A fraction as a percentage (3/5 = 60%)", TAGS, 2, (_k, r) => pickOne(r, FRACTIONS), (_k, [n, d]) => {
		if (!FRACTIONS.some(([a, b]) => a === n && b === d)) return null;
		const p = percentOf(n, d);
		const parts = [
			frac(n, d),
			"=",
			"?",
			"%"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: p
		}, {
			"used the bottom number": d,
			"used the top number": n,
			"gave the part that is left": 100 - p,
			"ten times too big": p * 10,
			"ten times too small": p / 10,
			"multiplied the top number by 10": n * 10
		});
	}),
	oneKey("fdp:pct-to-frac", "A percentage as a fraction (60% = 3/5)", TAGS, 3, (_k, r) => [pickOne(r, FRACTION_PERCENTS), ...rollPick(r)], (_k, [p, slot, salt]) => {
		const f = FRACTION_FOR[p];
		if (!f || !goodPick(slot, salt)) return null;
		const parts = [
			`${p}%`,
			"=",
			"?"
		];
		return pick$1({
			parts,
			spoken: talk(parts),
			fact: `${p}% = ${f.right}`
		}, f.right, f.named, {
			slot,
			salt
		});
	}),
	oneKey("fdp:dec-to-pct", "A decimal as a percentage (0.35 = 35%)", TAGS, 1, (_k, r) => [pickOne(r, range$2(1, 99))], (_k, [h]) => {
		if (!isInt(h, 1, 99)) return null;
		const parts = [
			show(h / 100),
			"=",
			"?",
			"%"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: h,
			input: "decimal"
		}, {
			"moved the point one place only": h / 10,
			"did not move the point": h / 100,
			"moved the point three places": h * 10,
			...h >= 10 && h % 11 !== 0 && h % 10 !== 0 ? { "swapped the digits": reversed(h) } : {}
		});
	}),
	oneKey("fdp:pct-to-dec", "A percentage as a decimal (35% = 0.35)", TAGS, 1, (_k, r) => [pickOne(r, OTHERS)], (_k, [p]) => {
		if (!OTHERS.includes(p)) return null;
		const parts = [
			`${p}%`,
			"=",
			"?"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: p / 100,
			input: "decimal"
		}, {
			"moved the point one place only": p / 10,
			"did not move the point": p,
			"moved the point three places": p / 1e3,
			...p >= 10 && p % 11 !== 0 && p % 10 !== 0 ? { "swapped the digits": Number(`0.${reversed(p)}`) } : {}
		});
	}),
	oneKey("fdp:match", "Which percentage is the same as the decimal? (0.35 = 35%)", TAGS, 3, (_k, r) => [pickOne(r, MATCH), ...rollPick(r)], (_k, [h, slot, salt]) => {
		if (!MATCH.includes(h) || !goodPick(slot, salt)) return null;
		const right = `${h}%`;
		const parts = [
			show(h / 100),
			"=",
			"?"
		];
		return pick$1({
			parts,
			spoken: talk(parts),
			fact: `${show(h / 100)} = ${right}`
		}, right, {
			"did not move the point": `${show(h / 100)}%`,
			"moved the point one place only": `${show(h / 10)}%`,
			"moved the point three places": `${h * 10}%`,
			...h >= 10 && h % 11 !== 0 ? { "swapped the digits": `${reversed(h)}%` } : {}
		}, {
			slot,
			salt
		});
	})
];
const FDP_FAMILIES = Object.fromEntries(families$1.map((f) => [f.keys[0], f]));
const FDP_SKILL_KEYS = { "fdp-equivalents": [
	"fdp:frac-to-pct",
	"fdp:pct-to-frac",
	"fdp:dec-to-pct",
	"fdp:pct-to-dec",
	"fdp:match"
] };
//#endregion
//#region shared/maths/skillPacks/fractionSkills.ts
/**
* Fractions of an amount, equivalent fractions and finding the whole (ladder skills `unit-fraction-of`, `fraction-of`,
* `equivalent-fractions` and `whole-from-fraction`). Fractions stay under one: no 7/4 or 1 3/4 as a question or a choice.
*
* One mastery record per question type (generatedKit.ts). Number answers are typed on the pad (and become four choices when the
* class has multiple choice on); fraction answers are always four choices to tap, with text labels ("3/4"). Wrong choices are
* the answer a named mistake gives, never a random number.
*
* Types:
*   unit-fraction-of     fracof:half  fracof:third  fracof:quarter  fracof:fifth  fracof:tenth  fracof:big
*   fraction-of          fracof:non:thirds  :quarters  :fifths  :sixths  :eighths  :tenths
*   equivalent-fractions equiv:missing-top  equiv:missing-bottom  equiv:same-as  equiv:simplify  equiv:simplify-blank
*   whole-from-fraction  whole:half  whole:unit  whole:thirds  whole:quarters  whole:other
*/
const range$1 = (from, to, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const UNIT_TAGS = ["MS.Y3.NUM.RN.P7"];
/** 1/d of an amount that d goes into exactly. `dens` are the bottom numbers this type uses. */
function unitFamily(key, label, dens, qLo, qHi) {
	return oneKey(key, label, UNIT_TAGS, 2, (_k, r) => [pickOne(r, dens), int(r, qLo, qHi)], (_k, [d, q]) => {
		if (!dens.includes(d) || !isInt(q, qLo, qHi)) return null;
		const amount = d * q;
		const parts = [
			frac(1, d),
			"of",
			show(amount),
			"=",
			"?"
		];
		const named = {
			"used the bottom number as the answer": d,
			"took one share away from the amount": amount - q,
			"one share too many": q + 1,
			"one share too few": q - 1,
			"multiplied instead of dividing": amount * d,
			"took the bottom number off the amount": amount - d,
			"halved the amount": amount / 2
		};
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: q
		}, named);
	});
}
const NON_TAGS = ["MS.Y5.NUM.RN.P13"];
/** The fractions each non-unit type uses (all under one, all in their simplest form). */
const NON_UNIT = {
	thirds: {
		d: 3,
		tops: [2],
		label: "Two thirds of an amount (2/3 of 24)"
	},
	quarters: {
		d: 4,
		tops: [3],
		label: "Three quarters of an amount (3/4 of 20)"
	},
	fifths: {
		d: 5,
		tops: [
			2,
			3,
			4
		],
		label: "Fifths of an amount (3/5 of 40)"
	},
	sixths: {
		d: 6,
		tops: [5],
		label: "Five sixths of an amount (5/6 of 30)"
	},
	eighths: {
		d: 8,
		tops: [
			3,
			5,
			7
		],
		label: "Eighths of an amount (3/8 of 40)"
	},
	tenths: {
		d: 10,
		tops: [
			3,
			7,
			9
		],
		label: "Tenths of an amount (7/10 of 50)"
	}
};
function nonUnitFamily(word) {
	const { d, tops, label } = NON_UNIT[word];
	return oneKey(`fracof:non:${word}`, label, NON_TAGS, 3, (_k, r) => [
		pickOne(r, tops),
		d,
		int(r, 1, 10)
	], (_k, [n, den, q]) => {
		if (den !== d || !tops.includes(n) || !isInt(q, 1, 10)) return null;
		const parts = [
			frac(n, d),
			"of",
			show(d * q),
			"=",
			"?"
		];
		const named = {
			"stopped at one share": q,
			"divided by the top number": d * q / n,
			"one share too many": n * q + q,
			"one share too few": n * q - q,
			"found the part that is left": (d - n) * q,
			"added the top number to one share": q + n,
			"multiplied the amount by the top number": n * d * q
		};
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: n * q
		}, named);
	});
}
const EQUIV_TAGS = ["MS.Y5.NUM.RN.P9", "MS.Y6.NUM.RN.P6"];
/** Fractions in their simplest form, under one, with a bottom number up to 6. */
const SIMPLEST = range$1(2, 6).flatMap((d) => range$1(1, d - 1).filter((n) => gcd$1(n, d) === 1).map((n) => [n, d]));
const isSimplest = (n, d) => isInt(d, 2, 6) && isInt(n, 1, d - 1) && gcd$1(n, d) === 1;
/** Smallest number that divides k other than 1, if k is not prime (so 12/16 can be "only halved"). */
const smallestFactor = (k) => range$1(2, k - 1).find((p) => k % p === 0);
const equivFamilies = [
	oneKey("equiv:missing-top", "Equivalent fractions, the top number (1/2 = ?/8)", EQUIV_TAGS, 3, (_k, r) => {
		const [n, d] = pickOne(r, SIMPLEST);
		return [
			n,
			d,
			int(r, 2, 6)
		];
	}, (_k, [n, d, k]) => {
		if (!isSimplest(n, d) || !isInt(k, 2, 6)) return null;
		const parts = [
			frac(n, d),
			"=",
			`?/${d * k}`
		];
		const named = {
			"added the same to the top as the bottom grew by": n + (d * k - d),
			"kept the top the same": n,
			"top one too many": n * k + 1,
			"top one too few": n * k - 1,
			"used the multiplier": k,
			"added the multiplier to the top": n + k
		};
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: n * k
		}, named);
	}),
	oneKey("equiv:missing-bottom", "Equivalent fractions, the bottom number (3/4 = 9/?)", EQUIV_TAGS, 3, (_k, r) => {
		const [n, d] = pickOne(r, SIMPLEST);
		return [
			n,
			d,
			int(r, 2, 6)
		];
	}, (_k, [n, d, k]) => {
		if (!isSimplest(n, d) || !isInt(k, 2, 6)) return null;
		const parts = [
			frac(n, d),
			"=",
			`${n * k}/?`
		];
		const named = {
			"added the same to the bottom as the top grew by": d + (n * k - n),
			"kept the bottom the same": d,
			"bottom one too many": d * k + 1,
			"bottom one too few": d * k - 1,
			"used the multiplier": k,
			"added the multiplier to the bottom": d + k,
			"used the new top number": n * k
		};
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: d * k
		}, named);
	}),
	oneKey("equiv:same-as", "Which fraction is the same? (1/2 = 4/8)", EQUIV_TAGS, 5, (_k, r) => {
		const [n, d] = pickOne(r, SIMPLEST);
		return [
			n,
			d,
			int(r, 2, 5),
			...rollPick(r)
		];
	}, (_k, [n, d, k, slot, salt]) => {
		if (!isSimplest(n, d) || !isInt(k, 2, 5) || !goodPick(slot, salt)) return null;
		const right = frac(n * k, d * k);
		const parts = [
			frac(n, d),
			"=",
			"?"
		];
		return pick$1({
			parts,
			spoken: talk(parts),
			fact: `${frac(n, d)} = ${right}`
		}, right, {
			"added the same number to the top and bottom": frac(n + k, d + k),
			"changed only the bottom": frac(n, d * k),
			"changed only the top": frac(n * k, d),
			"top and bottom not changed the same": frac(n * k, d * k + 1),
			"top one too many": frac(n * k + 1, d * k)
		}, {
			slot,
			salt
		});
	}),
	oneKey("equiv:simplify", "Simplifying a fraction (6/8 = 3/4)", EQUIV_TAGS, 5, (_k, r) => {
		const [n, d] = pickOne(r, SIMPLEST);
		return [
			n,
			d,
			int(r, 2, 5),
			...rollPick(r)
		];
	}, (_k, [n, d, k, slot, salt]) => {
		if (!isSimplest(n, d) || !isInt(k, 2, 5) || !goodPick(slot, salt)) return null;
		const shown = frac(n * k, d * k);
		const parts = [
			"Simplify",
			shown,
			"=",
			"?"
		];
		const p = smallestFactor(k);
		return pick$1({
			parts,
			spoken: talk(parts),
			fact: `${shown} = ${frac(n, d)} in its simplest form`
		}, frac(n, d), {
			"divided only the top": frac(n, d * k),
			"divided only the bottom": frac(n * k, d),
			"took the same off the top and bottom": frac(n * k - k, d * k - k),
			...p ? { "stopped before the simplest": frac(n * k / p, d * k / p) } : {},
			"top and bottom not divided the same": frac(n, d + 1)
		}, {
			slot,
			salt,
			allowEqual: true
		});
	}),
	oneKey("equiv:simplify-blank", "Simplifying with a missing number (6/8 = 3/?)", EQUIV_TAGS, 4, (_k, r) => {
		const [n, d] = pickOne(r, SIMPLEST);
		return [
			n,
			d,
			int(r, 2, 5),
			int(r, 0, 1)
		];
	}, (_k, [n, d, k, v]) => {
		if (!isSimplest(n, d) || !isInt(k, 2, 5) || !isInt(v, 0, 1)) return null;
		const shown = frac(n * k, d * k);
		if (v === 0) {
			const parts = [
				shown,
				"=",
				`${n}/?`
			];
			return withMistakes({
				parts,
				spoken: talk(parts),
				answer: d
			}, {
				"took the same off the bottom as the top": d * k - (n * k - n),
				"bottom one too many": d + 1,
				"bottom one too few": d - 1,
				"kept the bottom the same": d * k,
				"used the divisor": k
			});
		}
		const parts = [
			shown,
			"=",
			`?/${d}`
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: n
		}, {
			"took the same off the top as the bottom": n * k - (d * k - d),
			"top one too many": n + 1,
			"top one too few": n - 1,
			"kept the top the same": n * k,
			"used the divisor": k
		});
	})
];
const WHOLE_TAGS = ["MS.Y6.NUM.RN.P12"];
/** "3/4 of ? = 90": the part shown is n × q, the whole to find is d × q. */
function wholeFamily$2(key, label, shapes, qLo, qHi) {
	return oneKey(key, label, WHOLE_TAGS, 3, (_k, r) => {
		const [n, d] = pickOne(r, shapes);
		return [
			n,
			d,
			int(r, qLo, qHi)
		];
	}, (_k, [n, d, q]) => {
		if (!shapes.some(([a, b]) => a === n && b === d) || !isInt(q, qLo, qHi)) return null;
		const part = n * q;
		const whole = d * q;
		const parts = [
			frac(n, d),
			"of",
			"?",
			"=",
			show(part)
		];
		const named = {
			"gave the part back as the answer": part,
			"found the fraction of the number instead": part * n / d,
			"multiplied the part by the bottom number": part * d,
			"stopped at one share": q,
			"one share too few": whole - q,
			"one share too many": whole + q,
			"added the bottom number to the part": part + d
		};
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: whole
		}, named);
	});
}
const FRACTION_FAMILIES = Object.fromEntries([
	unitFamily("fracof:half", "Half of an amount (1/2 of 18)", [2], 1, 12),
	unitFamily("fracof:third", "A third of an amount (1/3 of 15)", [3], 1, 10),
	unitFamily("fracof:quarter", "A quarter of an amount (1/4 of 20)", [4], 1, 10),
	unitFamily("fracof:fifth", "A fifth of an amount (1/5 of 35)", [5], 1, 10),
	unitFamily("fracof:tenth", "A tenth of an amount (1/10 of 70)", [10], 1, 10),
	unitFamily("fracof:big", "A unit fraction of a bigger amount (1/4 of 80)", [
		2,
		3,
		4,
		5,
		10
	], 11, 25),
	...Object.keys(NON_UNIT).map(nonUnitFamily),
	...equivFamilies,
	wholeFamily$2("whole:half", "The whole from a half (1/2 of ? = 14)", [[1, 2]], 2, 30),
	wholeFamily$2("whole:unit", "The whole from a unit fraction (1/4 of ? = 6)", [
		[1, 3],
		[1, 4],
		[1, 5],
		[1, 10]
	], 2, 12),
	wholeFamily$2("whole:thirds", "The whole from two thirds (2/3 of ? = 12)", [[2, 3]], 2, 12),
	wholeFamily$2("whole:quarters", "The whole from three quarters (3/4 of ? = 90)", [[3, 4]], 2, 12),
	wholeFamily$2("whole:other", "The whole from another fraction (3/5 of ? = 18)", [
		[2, 5],
		[3, 5],
		[4, 5],
		[3, 8],
		[5, 8],
		[3, 10],
		[7, 10],
		[5, 6]
	], 2, 10)
].map((f) => [f.keys[0], f]));
const FRACTION_SKILL_KEYS = {
	"unit-fraction-of": [
		"fracof:half",
		"fracof:third",
		"fracof:quarter",
		"fracof:fifth",
		"fracof:tenth",
		"fracof:big"
	],
	"fraction-of": Object.keys(NON_UNIT).map((w) => `fracof:non:${w}`),
	"equivalent-fractions": [
		"equiv:missing-top",
		"equiv:missing-bottom",
		"equiv:same-as",
		"equiv:simplify",
		"equiv:simplify-blank"
	],
	"whole-from-fraction": [
		"whole:half",
		"whole:unit",
		"whole:thirds",
		"whole:quarters",
		"whole:other"
	]
};
//#endregion
//#region shared/maths/skillPacks/percentSkills.ts
/**
* Percentages (ladder skills `percent-basic` and `percent-of`).
*
* `percent-basic`: 50%, 10% and 25% of an amount, and what those percentages are as a fraction and as a decimal (75% comes in
* beside 25%). `percent-of`: 1%, 20% and 75% of an amount, bigger amounts, and finding the whole from a percentage.
*
* Number answers are typed on the pad (four choices when the class has multiple choice on); a percentage as a fraction is
* always four choices to tap. Wrong choices are the answer a named mistake gives ("found 25% instead", "divided by the percent").
*
* Types:
*   percent-basic  pct:half  pct:ten  pct:quarter  pct:to-fraction  pct:from-fraction  pct:to-decimal
*   percent-of     pct:one  pct:twenty  pct:three-quarters  pct:big  pct:whole:ten  pct:whole:fifty  pct:whole:quarter
*/
const BASIC_TAGS = ["MS.Y5.NUM.RN.P5", "MS.Y5.NUM.RN.P15"];
const OF_TAGS = ["MS.Y6.NUM.RN.P13", "MS.Y6.NUM.RN.P14"];
const pct = (p) => `${p}%`;
/** The answer a student gets by following a named mistake, for "p% of a". */
function ofMistakes(p, a) {
	const named = {};
	for (const other of [
		1,
		10,
		20,
		25,
		50,
		75
	]) if (other !== p) named[`found ${other}% instead`] = a * other / 100;
	named["took the percent off the amount"] = a - p;
	named["multiplied by the percent"] = a * p;
	named["divided by the percent"] = a / p;
	return named;
}
/** "p% of an amount that is q × step". */
function ofFamily(key, label, tags, p, step, qLo, qHi) {
	return oneKey(key, label, tags, 1, (_k, r) => [int(r, qLo, qHi)], (_k, [q]) => {
		if (!isInt(q, qLo, qHi)) return null;
		const amount = q * step;
		const parts = [
			pct(p),
			"of",
			show(amount),
			"=",
			"?"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: amount * p / 100
		}, ofMistakes(p, amount));
	});
}
/** "p% of an amount" for bigger amounts: 10%, 25% or 50%. */
const BIG = {
	10: {
		step: 10,
		lo: 21,
		hi: 100
	},
	25: {
		step: 4,
		lo: 26,
		hi: 100
	},
	50: {
		step: 2,
		lo: 51,
		hi: 250
	}
};
const bigFamily = oneKey("pct:big", "A simple percentage of a bigger amount (25% of 360)", OF_TAGS, 2, (_k, r) => {
	const p = pickOne(r, [
		10,
		25,
		50
	]);
	return [p, int(r, BIG[p].lo, BIG[p].hi)];
}, (_k, [p, q]) => {
	const shape = BIG[p];
	if (!shape || !isInt(q, shape.lo, shape.hi)) return null;
	const amount = q * shape.step;
	const parts = [
		pct(p),
		"of",
		show(amount),
		"=",
		"?"
	];
	return withMistakes({
		parts,
		spoken: talk(parts),
		answer: amount * p / 100
	}, ofMistakes(p, amount));
});
/** "p% of ? = x": the whole from a percentage. */
function wholeFamily$1(key, label, p, xLo, xHi) {
	return oneKey(key, label, OF_TAGS, 1, (_k, r) => [int(r, xLo, xHi)], (_k, [x]) => {
		if (!isInt(x, xLo, xHi)) return null;
		const parts = [
			pct(p),
			"of",
			"?",
			"=",
			show(x)
		];
		const named = {
			"gave the part back as the answer": x,
			"found the percentage of it instead": x * p / 100,
			"multiplied the part by the percent": x * p,
			"added the percent to the part": x + p
		};
		for (const other of [
			10,
			20,
			25,
			50
		]) if (other !== p) named[`used ${other}% instead`] = x * 100 / other;
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: x * 100 / p
		}, named);
	});
}
/** The percentages in these conversions, with the fraction each one is. */
const CONVERT = {
	10: [1, 10],
	25: [1, 4],
	50: [1, 2],
	75: [3, 4]
};
const CONVERT_PERCENTS = Object.keys(CONVERT).map(Number);
const toFraction = oneKey("pct:to-fraction", "A percentage as a fraction (25% = 1/4)", BASIC_TAGS, 3, (_k, r) => [pickOne(r, CONVERT_PERCENTS), ...rollPick(r)], (_k, [p, slot, salt]) => {
	const f = CONVERT[p];
	if (!f || !goodPick(slot, salt)) return null;
	const right = frac(...f);
	const parts = [
		pct(p),
		"=",
		"?"
	];
	return pick$1({
		parts,
		spoken: talk(parts),
		fact: `${pct(p)} = ${right}`
	}, right, {
		10: {
			"put 1 over 100": "1/100",
			"mixed up with 20%": "1/5",
			"mixed up with 25%": "1/4",
			"mixed up with 50%": "1/2"
		},
		25: {
			"put 1 over the percent": "1/25",
			"used the digits as top and bottom": "2/5",
			"mixed up with 50%": "1/2",
			"mixed up with 10%": "1/10",
			"mixed up with 75%": "3/4"
		},
		50: {
			"put 1 over the percent": "1/50",
			"dropped the zero": "1/5",
			"mixed up with 25%": "1/4",
			"mixed up with 10%": "1/10"
		},
		75: {
			"put 1 over the percent": "1/75",
			"swapped the digits": "5/7",
			"mixed up with 25%": "1/4",
			"mixed up with 50%": "1/2",
			"used only the tens digit": "7/10"
		}
	}[p], {
		slot,
		salt
	});
});
const fromFraction = oneKey("pct:from-fraction", "A fraction as a percentage (1/4 = ?%)", BASIC_TAGS, 1, (_k, r) => [pickOne(r, CONVERT_PERCENTS)], (_k, [p]) => {
	const f = CONVERT[p];
	if (!f) return null;
	const [n, d] = f;
	const parts = [
		frac(n, d),
		"=",
		"?",
		"%"
	];
	return withMistakes({
		parts,
		spoken: talk(parts),
		answer: p
	}, {
		"used the bottom number": d,
		"used the top number": n,
		"gave the part that is left": 100 - p,
		"ten times too big": p * 10,
		"ten times too small": p / 10
	});
});
const swapDigits = (p) => Number(`0.${String(p).split("").reverse().join("")}`);
const toDecimal = oneKey("pct:to-decimal", "A percentage as a decimal (25% = 0.25)", BASIC_TAGS, 1, (_k, r) => [pickOne(r, CONVERT_PERCENTS)], (_k, [p]) => {
	if (!CONVERT[p]) return null;
	const parts = [
		pct(p),
		"=",
		"?"
	];
	return withMistakes({
		parts,
		spoken: talk(parts),
		answer: p / 100,
		input: "decimal"
	}, {
		"ten times too big": p / 10,
		"ten times too small": p / 1e3,
		"used the percent number as it is": p,
		"swapped the digits": swapDigits(p)
	});
});
const PERCENT_FAMILIES = Object.fromEntries([
	ofFamily("pct:half", "50% of an amount (50% of 60)", BASIC_TAGS, 50, 2, 1, 50),
	ofFamily("pct:ten", "10% of an amount (10% of 70)", BASIC_TAGS, 10, 10, 1, 20),
	ofFamily("pct:quarter", "25% of an amount (25% of 80)", BASIC_TAGS, 25, 4, 1, 25),
	toFraction,
	fromFraction,
	toDecimal,
	ofFamily("pct:one", "1% of an amount (1% of 300)", OF_TAGS, 1, 100, 1, 10),
	ofFamily("pct:twenty", "20% of an amount (20% of 45)", OF_TAGS, 20, 5, 2, 40),
	ofFamily("pct:three-quarters", "75% of an amount (75% of 60)", OF_TAGS, 75, 4, 2, 50),
	bigFamily,
	wholeFamily$1("pct:whole:ten", "The whole from 10% (10% of ? = 7)", 10, 2, 30),
	wholeFamily$1("pct:whole:fifty", "The whole from 50% (50% of ? = 18)", 50, 5, 60),
	wholeFamily$1("pct:whole:quarter", "The whole from 25% (25% of ? = 12)", 25, 3, 40)
].map((f) => [f.keys[0], f]));
const PERCENT_SKILL_KEYS = {
	"percent-basic": [
		"pct:half",
		"pct:ten",
		"pct:quarter",
		"pct:to-fraction",
		"pct:from-fraction",
		"pct:to-decimal"
	],
	"percent-of": [
		"pct:one",
		"pct:twenty",
		"pct:three-quarters",
		"pct:big",
		"pct:whole:ten",
		"pct:whole:fifty",
		"pct:whole:quarter"
	]
};
//#endregion
//#region shared/maths/skillPacks/placeSkills.ts
/**
* The generated place-value skills of the ladder: pairs that make 100 (bonds-100) and 1000 (bonds-1000), times with tens and
* hundreds (times-tens), factor pairs (factor-pairs), and square and cube numbers (squares-cubes).
*
* One mastery record per question type (generatedKit.ts). Every question here can be worked out again from how it is shown
* (its parts), because the server marks solo-game and placement answers that way. That is why no question here asks the
* student to pick from choices that aren't in the parts. Wrong choices (when the class has multiple choice on) come from
* named common mistakes.
*
* Types:
*   bonds-100    bond100:tens  bond100:fives  bond100:any  bond100:take
*   bonds-1000   bond1000:hundreds  bond1000:fifties  bond1000:tens  bond1000:take
*   times-tens   times:tens  times:hundreds  times:tens-tens  times:shift  times:powers  times:div-tens
*   factor-pairs factor:pair  factor:count  factor:largest  factor:common
*   squares-cubes square:of  cube:of  square:root  cube:root  square:next
*/
const range = (from, to, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const divisorsOf = (n) => range(1, n).filter((d) => n % d === 0);
/** Which type "a + ? = total" is, from the number shown (a pair of tens, of fives, or any). */
function bondTypeOf(total, a) {
	if (!Number.isInteger(a) || a < 1 || a >= total) return null;
	if (total === 100) return a % 10 === 0 ? "tens" : a % 5 === 0 ? "fives" : "any";
	return a % 100 === 0 ? "tens" : a % 50 === 0 ? "fives" : a % 10 === 0 ? "any" : null;
}
/** Bond1000 names its types for hundreds (100s), fifties (50s) and tens, so its type words differ. */
const BOND_WORD = {
	100: {
		tens: "tens",
		fives: "fives",
		any: "any",
		take: "take"
	},
	1e3: {
		tens: "hundreds",
		fives: "fifties",
		any: "tens",
		take: "take"
	}
};
function bondFamily(total, type, label, tags) {
	const key = `bond${total}:${BOND_WORD[total][type]}`;
	const valid = (a) => type === "take" ? total === 100 ? isInt(a, 1, 99) : isInt(a, 10, 990) && a % 10 === 0 : bondTypeOf(total, a) === type;
	const candidates = range(1, total - 1).filter(valid);
	return oneKey(key, label, tags, 2, (_k, r) => [pickOne(r, candidates), int(r, 0, 1)], (_k, [a, v]) => {
		if (!valid(a) || !isInt(v, 0, 1)) return null;
		const t = String(total);
		const answer = total - a;
		const parts = type === "take" ? [
			t,
			"−",
			String(a),
			"=",
			"?"
		] : v === 0 ? [
			String(a),
			"+",
			"?",
			"=",
			t
		] : [
			"?",
			"+",
			String(a),
			"=",
			t
		];
		const named = total === 100 ? {
			"forgot to carry the one": answer - 1,
			"made both digits add to ten": (10 - Math.floor(a / 10)) * 10 + (10 - a % 10),
			"ignored the ones": 100 - Math.floor(a / 10) * 10,
			"one ten too many": answer + 10,
			"one ten too few": answer - 10
		} : {
			"one hundred too many": answer + 100,
			"one hundred too few": answer - 100,
			"one ten too many": answer + 10,
			"one ten too few": answer - 10,
			"made the hundreds add to ten": a % 100 === 0 ? 10 - a / 100 : -1
		};
		return withMistakes({
			parts,
			spoken: speak(parts),
			answer
		}, named, { ok: (n) => n >= 1 && n < total });
	});
}
const parseBond = (total) => (parts) => {
	const t = String(total);
	if (parts.length !== 5 || parts[3] !== "=") return null;
	let a = null;
	let type = null;
	if (parts[1] === "+" && parts[0] === "?" && parts[2] !== "?" && parts[4] === t) a = readNumber(parts[2]);
	else if (parts[1] === "+" && parts[2] === "?" && parts[0] !== "?" && parts[4] === t) a = readNumber(parts[0]);
	else if (parts[1] === "−" && parts[0] === t && parts[4] === "?") {
		a = readNumber(parts[2]);
		type = "take";
	}
	if (a === null) return null;
	type ??= bondTypeOf(total, a);
	if (!type) return null;
	return {
		key: `bond${total}:${BOND_WORD[total][type]}`,
		params: [a, parts[0] === "?" ? 1 : 0]
	};
};
const TENS = range(20, 90, 10);
const HUNDREDS = range(200, 900, 100);
const POWERS = [
	10,
	100,
	1e3
];
const isTens = (n) => TENS.includes(n);
const isHundreds = (n) => HUNDREDS.includes(n);
/** The type of "x × y" (in the order shown), or null. A fact from the times tables is never one of these. */
function timesKeyOf(x, y) {
	const pair = (test, other) => test(x) && other(y) || test(y) && other(x);
	const digit = (n) => n >= 2 && n <= 9;
	if (pair(digit, isTens)) return "times:tens";
	if (pair(digit, isHundreds)) return "times:hundreds";
	if (isTens(x) && isTens(y)) return "times:tens-tens";
	if (pair((n) => n >= 13 && n <= 99 && n % 10 !== 0, (n) => n === 10 || n === 100)) return "times:shift";
	if (POWERS.includes(x) && POWERS.includes(y) && !(x === 10 && y === 10)) return "times:powers";
	return null;
}
function timesFamily(key, label, pools) {
	return oneKey(key, label, ["MS.Y4.NUM.OP.P3"], 2, (_k, r) => {
		const pair = [pickOne(r, pools[0]), pickOne(r, pools[1])];
		return r() < .5 ? pair : pair.reverse();
	}, (_k, [x, y]) => {
		if (!isInt(x, 1, 1e3) || !isInt(y, 1, 1e3) || timesKeyOf(x, y) !== key) return null;
		const answer = x * y;
		const parts = [
			show(x),
			"×",
			show(y),
			"=",
			"?"
		];
		const named = {
			"left out a zero": answer / 10,
			"put in an extra zero": answer * 10,
			"added instead of multiplying": x + y,
			"one step too many": answer + Math.max(x, y),
			"one step too few": answer - Math.max(x, y)
		};
		if (key === "times:tens-tens") named["multiplied the tens only"] = x / 10 * (y / 10);
		if (key === "times:powers") named["two zeros too many"] = answer * 100;
		return withMistakes({
			parts,
			spoken: speak(parts),
			answer
		}, named);
	});
}
const divTens = oneKey("times:div-tens", "Dividing tens (240 ÷ 6)", ["MS.Y4.NUM.OP.P3"], 2, (_k, r) => [int(r, 2, 9), pickOne(r, TENS)], (_k, [d, q]) => {
	if (!isInt(d, 2, 9) || !isTens(q)) return null;
	const n = d * q;
	const parts = [
		show(n),
		"÷",
		String(d),
		"=",
		"?"
	];
	return withMistakes({
		parts,
		spoken: speak(parts),
		answer: q
	}, {
		"left out a zero": q / 10,
		"put in an extra zero": q * 10,
		"took away instead of dividing": n - d,
		"one ten too many": q + 10,
		"one ten too few": q - 10
	});
});
const parseTimes = (parts) => {
	if (parts.length !== 5 || parts[3] !== "=" || parts[4] !== "?") return null;
	const x = readNumber(parts[0]);
	const y = readNumber(parts[2]);
	if (x === null || y === null) return null;
	if (parts[1] === "×") {
		const key = timesKeyOf(x, y);
		return key ? {
			key,
			params: [x, y]
		} : null;
	}
	return parts[1] === "÷" && y >= 2 && y <= 9 && isTens(x / y) ? {
		key: "times:div-tens",
		params: [y, x / y]
	} : null;
};
const PAIR_NUMBERS = [
	12,
	16,
	18,
	20,
	24,
	28,
	30,
	32,
	36,
	40,
	42,
	45,
	48,
	50,
	54,
	56,
	60,
	63,
	64,
	72,
	80,
	81,
	84,
	90,
	96,
	100
];
const COUNT_NUMBERS = [
	6,
	8,
	10,
	12,
	14,
	15,
	16,
	18,
	20,
	21,
	24,
	28,
	30,
	32,
	36,
	40,
	42,
	45,
	48
];
const LARGEST_NUMBERS = [
	6,
	8,
	9,
	10,
	12,
	14,
	15,
	16,
	18,
	20,
	21,
	24,
	25,
	27,
	28,
	30,
	32,
	35,
	36,
	40,
	42,
	45,
	48,
	49,
	50,
	54,
	56,
	60,
	63,
	64,
	72,
	81
];
const factorTags = ["MS.Y5.NUM.NS.P2"];
const smallestPrime = (n) => range(2, n).find((d) => n % d === 0);
/** Two numbers whose biggest shared factor is `g`, found as g × a and g × b with a and b sharing nothing. */
const commonPairs = range(2, 12).flatMap((g) => range(2, 6).flatMap((a) => range(a + 1, 7).filter((b) => gcd(a, b) === 1 && g * b <= 60).map((b) => [g * a, g * b])));
const factorFamilies = [
	oneKey("factor:pair", "Finding the other number in a factor pair", factorTags, 2, (_k, r) => {
		const n = pickOne(r, PAIR_NUMBERS);
		return [n, pickOne(r, divisorsOf(n).filter((d) => d >= 2 && d < n))];
	}, (_k, [n, a]) => {
		if (!PAIR_NUMBERS.includes(n) || !isInt(a, 2, n - 1) || n % a !== 0) return null;
		const answer = n / a;
		return withMistakes({
			parts: [
				String(a),
				"and",
				"?",
				"are a factor pair of",
				String(n)
			],
			spoken: `${a} and what are a factor pair of ${n}?`,
			answer,
			fact: `${a} × ${answer} = ${n}, so ${a} and ${answer} are a factor pair of ${n}`
		}, {
			"took away": n - a,
			"added": n + a,
			"one too many": answer + 1,
			"one too few": answer - 1,
			"the number itself": n
		});
	}),
	oneKey("factor:count", "Counting the factors of a number", factorTags, 1, (_k, r) => [pickOne(r, COUNT_NUMBERS)], (_k, [n]) => {
		if (!COUNT_NUMBERS.includes(n)) return null;
		const answer = divisorsOf(n).length;
		return withMistakes({
			parts: [
				"How many factors does",
				String(n),
				"have",
				"?"
			],
			spoken: `How many factors does ${n} have?`,
			answer,
			fact: `${n} has ${answer} factors: ${divisorsOf(n).join(", ")}`
		}, {
			"left out 1 and the number": answer - 2,
			"counted the pairs": answer / 2,
			"one too many": answer + 1,
			"one too few": answer - 1,
			"two too many": answer + 2
		});
	}),
	oneKey("factor:largest", "The biggest factor of a number apart from itself", factorTags, 1, (_k, r) => [pickOne(r, LARGEST_NUMBERS)], (_k, [n]) => {
		if (!LARGEST_NUMBERS.includes(n)) return null;
		const answer = n / smallestPrime(n);
		return withMistakes({
			parts: [
				"Biggest factor of",
				String(n),
				"except itself",
				"=",
				"?"
			],
			spoken: `What is the biggest factor of ${n}, except ${n} itself?`,
			answer
		}, {
			"one less than the number": n - 1,
			"half of it": n / 2,
			"a third of it": n / 3,
			"the smallest factor": smallestPrime(n),
			"one more": answer + 1,
			"one less": answer - 1
		});
	}),
	oneKey("factor:common", "The biggest number that goes into two numbers", factorTags, 2, (_k, r) => [...pickOne(r, commonPairs)], (_k, [a, b]) => {
		if (!commonPairs.some(([x, y]) => x === a && y === b)) return null;
		const answer = gcd(a, b);
		return withMistakes({
			parts: [
				"Biggest number that goes into",
				String(a),
				"and",
				String(b),
				"=",
				"?"
			],
			spoken: `What is the biggest number that goes into both ${a} and ${b}?`,
			answer
		}, {
			"the smaller number": a,
			"one more": answer + 1,
			"one less": answer - 1,
			"half of it": answer / 2,
			"the difference": b - a,
			"double": answer * 2
		});
	})
];
const parseFactors = (parts) => {
	const n = (i) => readNumber(parts[i] ?? "");
	if (parts.length === 5 && parts[1] === "and" && parts[2] === "?" && parts[3] === "are a factor pair of") {
		const a = n(0);
		const big = n(4);
		return a !== null && big !== null ? {
			key: "factor:pair",
			params: [big, a]
		} : null;
	}
	if (parts.length === 4 && parts[0] === "How many factors does" && parts[2] === "have" && parts[3] === "?") {
		const big = n(1);
		return big !== null ? {
			key: "factor:count",
			params: [big]
		} : null;
	}
	if (parts.length === 5 && parts[0] === "Biggest factor of" && parts[2] === "except itself" && parts[3] === "=" && parts[4] === "?") {
		const big = n(1);
		return big !== null ? {
			key: "factor:largest",
			params: [big]
		} : null;
	}
	if (parts.length === 6 && parts[0] === "Biggest number that goes into" && parts[2] === "and" && parts[4] === "=" && parts[5] === "?") {
		const a = n(1);
		const b = n(3);
		return a !== null && b !== null ? {
			key: "factor:common",
			params: [a, b]
		} : null;
	}
	return null;
};
const squareTags = ["MS.Y6.NUM.NS.P6"];
const SQUARES = range(2, 12).map((n) => n * n);
const CUBES = range(2, 5).map((n) => n ** 3);
const isSquare = (n) => Number.isInteger(Math.sqrt(n));
const squareFamilies = [
	oneKey("square:of", "Square numbers (7 squared)", squareTags, 1, (_k, r) => [int(r, 2, 12)], (_k, [n]) => {
		if (!isInt(n, 2, 12)) return null;
		return withMistakes({
			parts: [
				String(n),
				"squared",
				"=",
				"?"
			],
			spoken: `${n} squared equals what?`,
			answer: n * n,
			fact: `${n} squared is ${n} × ${n} = ${n * n}`
		}, {
			"doubled it": 2 * n,
			"cubed it": n ** 3,
			"the square before": (n - 1) ** 2,
			"the square after": (n + 1) ** 2,
			"times the next number": n * (n + 1)
		});
	}),
	oneKey("cube:of", "Cube numbers (4 cubed)", squareTags, 1, (_k, r) => [int(r, 2, 5)], (_k, [n]) => {
		if (!isInt(n, 2, 5)) return null;
		return withMistakes({
			parts: [
				String(n),
				"cubed",
				"=",
				"?"
			],
			spoken: `${n} cubed equals what?`,
			answer: n ** 3,
			fact: `${n} cubed is ${n} × ${n} × ${n} = ${n ** 3}`
		}, {
			"times 3": 3 * n,
			"squared it": n * n,
			"the cube before": (n - 1) ** 3,
			"the cube after": (n + 1) ** 3,
			"doubled the square": 2 * n * n
		});
	}),
	oneKey("square:root", "Square roots of square numbers", squareTags, 1, (_k, r) => [pickOne(r, SQUARES)], (_k, [sq]) => {
		if (!SQUARES.includes(sq)) return null;
		const root = Math.sqrt(sq);
		return withMistakes({
			parts: [
				"Square root of",
				String(sq),
				"=",
				"?"
			],
			spoken: `What is the square root of ${sq}?`,
			answer: root,
			fact: `The square root of ${sq} is ${root}, because ${root} × ${root} = ${sq}`
		}, {
			"half of it": sq / 2,
			"one root too many": root + 1,
			"one root too few": root - 1,
			"a quarter of it": sq / 4,
			"two roots too many": root + 2
		});
	}),
	oneKey("cube:root", "Cube roots of cube numbers", squareTags, 1, (_k, r) => [pickOne(r, CUBES)], (_k, [cube]) => {
		if (!CUBES.includes(cube)) return null;
		const root = Math.round(Math.cbrt(cube));
		return withMistakes({
			parts: [
				"Cube root of",
				String(cube),
				"=",
				"?"
			],
			spoken: `What is the cube root of ${cube}?`,
			answer: root,
			fact: `The cube root of ${cube} is ${root}, because ${root} × ${root} × ${root} = ${cube}`
		}, {
			"one root too many": root + 1,
			"one root too few": root - 1,
			"a third of it": cube / 3,
			"the square root": Math.sqrt(cube),
			"two roots too many": root + 2
		});
	}),
	oneKey("square:next", "The next square number", squareTags, 1, (_k, r) => {
		for (;;) {
			const x = int(r, 5, 143);
			if (!isSquare(x)) return [x];
		}
	}, (_k, [x]) => {
		if (!isInt(x, 5, 143) || isSquare(x)) return null;
		const root = Math.floor(Math.sqrt(x)) + 1;
		return withMistakes({
			parts: [
				"The next square number after",
				String(x),
				"=",
				"?"
			],
			spoken: `What is the next square number after ${x}?`,
			answer: root * root
		}, {
			"the square before": (root - 1) ** 2,
			"the square after that": (root + 1) ** 2,
			"the root, not the square": root,
			"one more": x + 1,
			"one less than the square": root * root - 1
		});
	})
];
const parseSquares = (parts) => {
	const n = (i) => readNumber(parts[i] ?? "");
	if (!(parts[parts.length - 2] === "=" && parts[parts.length - 1] === "?")) return null;
	if (parts.length === 4 && parts[1] === "squared") return n(0) === null ? null : {
		key: "square:of",
		params: [n(0)]
	};
	if (parts.length === 4 && parts[1] === "cubed") return n(0) === null ? null : {
		key: "cube:of",
		params: [n(0)]
	};
	if (parts.length === 4 && parts[0] === "Square root of") return n(1) === null ? null : {
		key: "square:root",
		params: [n(1)]
	};
	if (parts.length === 4 && parts[0] === "Cube root of") return n(1) === null ? null : {
		key: "cube:root",
		params: [n(1)]
	};
	if (parts.length === 4 && parts[0] === "The next square number after") return n(1) === null ? null : {
		key: "square:next",
		params: [n(1)]
	};
	return null;
};
const bondTags100 = ["MS.Y3.NUM.OP.P1"];
const bondTags1000 = [];
const PLACE_FAMILIES = Object.fromEntries([
	bondFamily(100, "tens", "Pairs of tens that make 100", bondTags100),
	bondFamily(100, "fives", "Pairs that make 100, ending in 5", bondTags100),
	bondFamily(100, "any", "Any pair that makes 100", bondTags100),
	bondFamily(100, "take", "Taking a number away from 100", bondTags100),
	bondFamily(1e3, "tens", "Hundreds that make 1000", bondTags1000),
	bondFamily(1e3, "fives", "Pairs ending in 50 that make 1000", bondTags1000),
	bondFamily(1e3, "any", "Pairs of tens that make 1000", bondTags1000),
	bondFamily(1e3, "take", "Taking a number away from 1000", bondTags1000),
	timesFamily("times:tens", "Times a number of tens (4 × 30)", [range(2, 9), TENS]),
	timesFamily("times:hundreds", "Times a number of hundreds (6 × 300)", [range(2, 9), HUNDREDS]),
	timesFamily("times:tens-tens", "Tens times tens (20 × 30)", [TENS, TENS]),
	timesFamily("times:shift", "Times 10 and 100 (34 × 10)", [range(13, 99).filter((n) => n % 10 !== 0), [10, 100]]),
	timesFamily("times:powers", "Times 10, 100 and 1000 together (10 × 100)", [POWERS, POWERS]),
	divTens,
	...factorFamilies,
	...squareFamilies
].map((f) => [f.keys[0], f]));
const PLACE_SKILL_KEYS = {
	"bonds-100": [
		"bond100:tens",
		"bond100:fives",
		"bond100:any",
		"bond100:take"
	],
	"bonds-1000": [
		"bond1000:hundreds",
		"bond1000:fifties",
		"bond1000:tens",
		"bond1000:take"
	],
	"times-tens": [
		"times:tens",
		"times:hundreds",
		"times:tens-tens",
		"times:shift",
		"times:powers",
		"times:div-tens"
	],
	"factor-pairs": [
		"factor:pair",
		"factor:count",
		"factor:largest",
		"factor:common"
	],
	"squares-cubes": [
		"square:of",
		"cube:of",
		"square:root",
		"cube:root",
		"square:next"
	]
};
/** Reads a question back into its type and numbers, or null when none of these skills asks it. */
const parsePlace = (parts) => parseBond(100)(parts) ?? parseBond(1e3)(parts) ?? parseTimes(parts) ?? parseFactors(parts) ?? parseSquares(parts);
//#endregion
//#region shared/maths/skillPacks/rounding.ts
/**
* Rounding, for the ladder skills round-10-100, round-1000, round-big and round-million.
*
* One mastery record per question TYPE (see generatedKit.ts). The type says how big the number is and whether it is the tricky
* "exactly halfway" or "close to halfway" kind:
*   whole numbers   round:<unit>:<n>digit   round:<unit>:halfway   round:<unit>:near-halfway     (unit 10 to 1 000 000)
*   decimals        round:whole:tenths  round:whole:hundredths  round:whole:halfway             (to a whole number)
*                   round:tenth:hundredths  round:tenth:halfway                                  (to a tenth, decimal answer)
*                   round:hundredth:thousandths  round:hundredth:halfway                         (to a hundredth, decimal answer)
* Halfway rounds up (65 → 70, 4.15 → 4.2). Wrong choices come from named mistakes: rounding the wrong way, rounding to a
* smaller or bigger place, and being a whole step out.
*/
const TAG = {
	r10: ["MS.Y3.NUM.NS.P5"],
	r1000: ["MS.Y4.NUM.NS.K4"],
	big: ["MS.Y5.NUM.NS.P3", "MS.Y5.NUM.NS.P4"],
	million: ["MS.Y6.NUM.NS.P3", "MS.Y6.NUM.NS.P4"]
};
const roundTo = (n, unit) => Math.floor((n + unit / 2) / unit) * unit;
/** The question type of rounding n to the nearest unit, or null if n is already a multiple of it. */
function wholeKeyOf(unit, n) {
	const mod = n % unit;
	if (mod === 0) return null;
	const half = unit / 2;
	if (mod === half) return `round:${unit}:halfway`;
	if (Math.abs(mod - half) <= unit / 10) return `round:${unit}:near-halfway`;
	return `round:${unit}:${String(n).length}digit`;
}
const unitText = (unit) => `to the nearest ${show(unit)}`;
function wholeFamily(unit, suffix, lo, hi, tags, label) {
	const key = `round:${unit}:${suffix}`;
	const half = unit / 2;
	const zone = unit / 10;
	return oneKey(key, label, tags, 1, (_k, r) => {
		for (;;) {
			let n = int(r, lo, hi);
			if (suffix === "halfway") n = n - n % unit + half;
			else if (suffix === "near-halfway") n = n - n % unit + half + int(r, 1, zone) * (r() < .5 ? -1 : 1);
			if (n >= lo && n <= hi && wholeKeyOf(unit, n) === key) return [n];
		}
	}, (_k, [n]) => {
		if (!isInt(n, lo, hi) || wholeKeyOf(unit, n) !== key) return null;
		const down = n - n % unit;
		const up = down + unit;
		const answer = n % unit >= half ? up : down;
		const named = {
			"rounded the wrong way": answer === up ? down : up,
			"rounded to a smaller place": unit >= 100 ? roundTo(n, unit / 10) : n,
			"rounded to a bigger place": roundTo(n, unit * 10),
			"one step too far": answer + unit,
			"one step too few": answer - unit
		};
		return withMistakes({
			parts: [
				"Round",
				show(n),
				unitText(unit),
				"=",
				"?"
			],
			spoken: `Round ${n} ${unitText(unit)}. What is it?`,
			answer,
			fact: `${show(n)} rounded ${unitText(unit)} is ${show(answer)}`
		}, named);
	});
}
/** How many units of the answer fit in 1 (a tenth: 10). */
const UNIT_SCALE = {
	whole: 1,
	tenth: 10,
	hundredth: 100
};
const UNIT_WORDS = {
	whole: "to the nearest whole number",
	tenth: "to the nearest tenth",
	hundredth: "to the nearest hundredth"
};
/** The question type of a decimal (written with `dp` places, as m units of 1/10^dp), or null if it ends in 0. */
function decimalKeyOf(unit, dp, m) {
	if (m % 10 === 0) return null;
	const half = m % 10 === 5;
	if (unit === "whole") {
		if (dp === 1) return half ? "round:whole:halfway" : "round:whole:tenths";
		return dp === 2 ? "round:whole:hundredths" : null;
	}
	if (unit === "tenth") return dp === 2 ? half ? "round:tenth:halfway" : "round:tenth:hundredths" : null;
	return dp === 3 ? half ? "round:hundredth:halfway" : "round:hundredth:thousandths" : null;
}
function decimalFamily({ key, unit, dp, lo, hi, label, tags }) {
	const scale = 10 ** dp;
	const step = scale / UNIT_SCALE[unit];
	const halfway = key.endsWith(":halfway");
	const unitScale = UNIT_SCALE[unit];
	return oneKey(key, label, tags, 1, (_k, r) => {
		for (;;) {
			let m = int(r, lo, hi);
			if (halfway) m = m - m % 10 + 5;
			if (m >= lo && m <= hi && decimalKeyOf(unit, dp, m) === key) return [m];
		}
	}, (_k, [m]) => {
		if (!isInt(m, lo, hi) || decimalKeyOf(unit, dp, m) !== key) return null;
		const lower = Math.floor(m / step);
		const upper = lower + 1;
		const up = m % step >= step / 2;
		const answer = (up ? upper : lower) / unitScale;
		const value = m / scale;
		const shown = show(value);
		const named = { "rounded the wrong way": (up ? lower : upper) / unitScale };
		if (unit === "whole") {
			named["one too many"] = answer + 1;
			named["one too few"] = answer - 1;
			named["two too many"] = answer + 2;
		} else {
			named[unit === "tenth" ? "rounded to a whole number" : "rounded to a tenth"] = Math.floor((m + 50) / 100) / (unit === "tenth" ? 1 : 10);
			named["did not round"] = value;
			named["one place too many"] = answer + 1 / unitScale;
			named["one place too few"] = answer - 1 / unitScale;
		}
		return withMistakes({
			parts: [
				"Round",
				shown,
				UNIT_WORDS[unit],
				"=",
				"?"
			],
			spoken: `Round ${say(value)} ${UNIT_WORDS[unit]}. What is it?`,
			answer,
			input: unit === "whole" ? "whole" : "decimal",
			fact: `${shown} rounded ${UNIT_WORDS[unit]} is ${show(answer)}`
		}, named);
	});
}
const W = wholeFamily;
const D = decimalFamily;
/** Every rounding question type, by key. */
const ROUNDING_FAMILIES = Object.fromEntries([
	W(10, "2digit", 11, 99, TAG.r10, "Rounding 2-digit numbers to the nearest 10"),
	W(10, "3digit", 101, 999, TAG.r10, "Rounding 3-digit numbers to the nearest 10"),
	W(10, "halfway", 15, 995, TAG.r10, "Rounding to the nearest 10 when the last digit is 5"),
	W(10, "near-halfway", 14, 996, TAG.r10, "Rounding to the nearest 10 when the last digit is 4 or 6"),
	W(100, "3digit", 101, 999, TAG.r10, "Rounding 3-digit numbers to the nearest 100"),
	W(100, "4digit", 1001, 9999, TAG.r10, "Rounding 4-digit numbers to the nearest 100"),
	W(100, "halfway", 150, 9950, TAG.r10, "Rounding to the nearest 100 when it is exactly halfway"),
	W(100, "near-halfway", 140, 9960, TAG.r10, "Rounding to the nearest 100 when it is close to halfway"),
	W(1e3, "4digit", 1001, 9999, TAG.r1000, "Rounding 4-digit numbers to the nearest 1000"),
	W(1e3, "5digit", 10001, 99999, TAG.r1000, "Rounding 5-digit numbers to the nearest 1000"),
	W(1e3, "halfway", 1500, 99500, TAG.r1000, "Rounding to the nearest 1000 when it is exactly halfway"),
	W(1e3, "near-halfway", 1400, 99600, TAG.r1000, "Rounding to the nearest 1000 when it is close to halfway"),
	W(1e4, "5digit", 10001, 99999, TAG.big, "Rounding to the nearest 10 000"),
	W(1e4, "halfway", 15e3, 95e3, TAG.big, "Rounding to the nearest 10 000 when it is exactly halfway"),
	W(1e5, "6digit", 100001, 999999, TAG.big, "Rounding to the nearest 100 000"),
	W(1e5, "halfway", 15e4, 95e4, TAG.big, "Rounding to the nearest 100 000 when it is exactly halfway"),
	D({
		key: "round:whole:tenths",
		unit: "whole",
		dp: 1,
		lo: 21,
		hi: 989,
		label: "Rounding tenths to a whole number",
		tags: TAG.big
	}),
	D({
		key: "round:whole:hundredths",
		unit: "whole",
		dp: 2,
		lo: 201,
		hi: 9899,
		label: "Rounding hundredths to a whole number",
		tags: TAG.big
	}),
	D({
		key: "round:whole:halfway",
		unit: "whole",
		dp: 1,
		lo: 25,
		hi: 985,
		label: "Rounding to a whole number when the tenths digit is 5",
		tags: TAG.big
	}),
	D({
		key: "round:tenth:hundredths",
		unit: "tenth",
		dp: 2,
		lo: 101,
		hi: 2999,
		label: "Rounding hundredths to the nearest tenth",
		tags: TAG.big
	}),
	D({
		key: "round:tenth:halfway",
		unit: "tenth",
		dp: 2,
		lo: 105,
		hi: 2995,
		label: "Rounding to the nearest tenth when the hundredths digit is 5",
		tags: TAG.big
	}),
	W(1e6, "7digit", 1000001, 9999999, TAG.million, "Rounding to the nearest million"),
	W(1e6, "halfway", 15e5, 95e5, TAG.million, "Rounding to the nearest million when it is exactly halfway"),
	W(1e6, "near-halfway", 14e5, 96e5, TAG.million, "Rounding to the nearest million when it is close to halfway"),
	W(1e5, "7digit", 1000001, 9999999, TAG.million, "Rounding a 7-digit number to the nearest 100 000"),
	D({
		key: "round:hundredth:thousandths",
		unit: "hundredth",
		dp: 3,
		lo: 1001,
		hi: 19999,
		label: "Rounding thousandths to the nearest hundredth",
		tags: TAG.million
	}),
	D({
		key: "round:hundredth:halfway",
		unit: "hundredth",
		dp: 3,
		lo: 1005,
		hi: 19995,
		label: "Rounding to the nearest hundredth when the thousandths digit is 5",
		tags: TAG.million
	})
].map((f) => [f.keys[0], f]));
const WHOLE_UNITS = [
	10,
	100,
	1e3,
	1e4,
	1e5,
	1e6
];
const DECIMAL_UNITS = Object.entries(UNIT_WORDS);
/** Reads ['Round', '347', 'to the nearest 100', '=', '?'] back into its type and number. */
const parseRounding = (parts) => {
	if (parts.length !== 5 || parts[0] !== "Round" || parts[3] !== "=" || parts[4] !== "?") return null;
	const n = readNumber(parts[1]);
	if (n === null) return null;
	const check = (key, params) => {
		const made = key ? ROUNDING_FAMILIES[key]?.make(key, params) : null;
		return key && made && sameParts(made.parts, parts) ? {
			key,
			params
		} : null;
	};
	const whole = WHOLE_UNITS.find((u) => unitText(u) === parts[2]);
	if (whole !== void 0) return Number.isInteger(n) ? check(wholeKeyOf(whole, n), [n]) : null;
	const decimal = DECIMAL_UNITS.find(([, words]) => words === parts[2]);
	if (!decimal) return null;
	const dp = decimalPlaces(parts[1]);
	const m = Math.round(n * 10 ** dp);
	return check(decimalKeyOf(decimal[0], dp, m), [m]);
};
/** The keys of each ladder skill, in the order they are listed here. */
const ROUNDING_SKILL_KEYS = {
	"round-10-100": Object.keys(ROUNDING_FAMILIES).filter((k) => /^round:(10|100):/.test(k)),
	"round-1000": Object.keys(ROUNDING_FAMILIES).filter((k) => k.startsWith("round:1000:")),
	"round-big": Object.keys(ROUNDING_FAMILIES).filter((k) => /^round:(10000|100000):(5digit|6digit|halfway)$|^round:whole:|^round:tenth:/.test(k)),
	"round-million": Object.keys(ROUNDING_FAMILIES).filter((k) => /^round:1000000:|^round:100000:7digit$|^round:hundredth:/.test(k))
};
//#endregion
//#region shared/maths/skillPacks/generated.ts
/**
* The generated skills of the ladder as one pack: bonds to 100 and 1000, rounding, times with tens and hundreds, factor
* pairs, squares and cubes, and order of operations. They make endless questions, so a mastery record is a question TYPE
* (see generatedKit.ts for the key format), kept in the same table as the facts under the pack name "generated".
*
* The pack's families sit outside every band: only the auto ladder and a focus ask for them, so Maths Monsters and the
* other games that ask by band are unchanged.
*
* `solveGenerated` is what the server uses to mark an answer it did not see being asked: it reads the question's parts
* back into a type and numbers, builds the question again from them, and only accepts it if it comes out exactly as shown.
*/
const families = {
	...PLACE_FAMILIES,
	...ROUNDING_FAMILIES,
	...BEDMAS_FAMILIES,
	...FRACTION_FAMILIES,
	...PERCENT_FAMILIES,
	...DECIMAL_FAMILIES,
	...FDP_FAMILIES
};
for (const key of Object.keys(families)) if (!RECORD_KEY.test(key)) throw new Error(`generated skill key "${key}" is not a valid record key`);
const GENERATED = {
	id: "generated",
	label: "Place value, rounding, order of operations, fractions, decimals and percentages",
	families,
	bands: [],
	ladderOnly: Object.keys(families),
	quickMs: quickMsForPack("generated")
};
const generatedPack = (saved, random, now) => new BandedPack(GENERATED, saved, random, now);
/** The question types of each ladder skill built here, in the order the skills are asked. */
const GENERATED_SKILL_KEYS = {
	...PLACE_SKILL_KEYS,
	...ROUNDING_SKILL_KEYS,
	bedmas: BEDMAS_KEYS,
	...FRACTION_SKILL_KEYS,
	...PERCENT_SKILL_KEYS,
	...DECIMAL_SKILL_KEYS,
	...FDP_SKILL_KEYS
};
/** Every question type this pack owns. */
const GENERATED_KEYS = new Set(Object.keys(families));
const isGeneratedKey = (key) => GENERATED_KEYS.has(key);
const PARSERS = [
	parseRounding,
	parsePlace,
	parseBedmas
];
/**
* A question as it was shown (its parts) worked out again: its right answer and the record it counts towards.
* Null if no generated skill asks that question.
*/
function solveGenerated(parts) {
	for (const parse of PARSERS) {
		const found = parse(parts);
		if (!found) continue;
		const made = families[found.key]?.make(found.key, found.params);
		if (made && sameParts(made.parts, parts)) return {
			answer: tidy(made.answer),
			key: found.key
		};
	}
	return null;
}
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
/** A skill made of generated question types (kept per type, not per fact). */
const generated = (id, label, stage, keys, ...curriculumTags) => ({
	id,
	label,
	stage,
	curriculumTags,
	keys: [...keys],
	built: true
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
	{
		id: "ten-and",
		label: "Ten and a number (10 + 4)",
		stage: "early-facts",
		curriculumTags: ["MS.Y1.NUM.OP.P6"],
		keys: earlyKeys("tenAnd"),
		built: true
	},
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
	generated("bonds-100", "Pairs that make 100", "place-value", GENERATED_SKILL_KEYS["bonds-100"], "MS.Y3.NUM.OP.P1"),
	tables[1],
	generated("round-10-100", "Rounding to the nearest 10 and 100", "rounding", GENERATED_SKILL_KEYS["round-10-100"], "MS.Y3.NUM.NS.P5"),
	generated("bonds-1000", "Hundreds that make 1000", "place-value", GENERATED_SKILL_KEYS["bonds-1000"]),
	generated("unit-fraction-of", "A fraction of an amount (⅓ of 15)", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["unit-fraction-of"], "MS.Y3.NUM.RN.P7"),
	tables[2],
	tables[3],
	generated("times-tens", "Times with tens and hundreds (30 × 4)", "place-value", GENERATED_SKILL_KEYS["times-tens"], "MS.Y4.NUM.OP.P3"),
	generated("tenths", "Tenths and decimals of a half", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["tenths"], "MS.Y4.NUM.RN.P3", "MS.Y4.NUM.RN.P5"),
	generated("add-tenths", "Adding and taking away tenths", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["add-tenths"], "MS.Y4.NUM.RN.P10"),
	generated("round-1000", "Rounding to the nearest 1000", "rounding", GENERATED_SKILL_KEYS["round-1000"], "MS.Y4.NUM.NS.K4"),
	tables[4],
	generated("factor-pairs", "Factor pairs", "place-value", GENERATED_SKILL_KEYS["factor-pairs"], "MS.Y5.NUM.NS.P2"),
	generated("round-big", "Rounding bigger numbers and decimals", "rounding", GENERATED_SKILL_KEYS["round-big"], "MS.Y5.NUM.NS.P3", "MS.Y5.NUM.NS.P4"),
	generated("decimal-equivalents", "Fractions as decimals", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["decimal-equivalents"], "MS.Y5.NUM.RN.P4"),
	generated("percent-basic", "10%, 25% and 50%", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["percent-basic"], "MS.Y5.NUM.RN.P5", "MS.Y5.NUM.RN.P15"),
	generated("fraction-of", "Fractions of an amount (⅔ of 24)", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["fraction-of"], "MS.Y5.NUM.RN.P13"),
	generated("times-decimals", "Times 10 and 100 with decimals", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["times-decimals"], "MS.Y5.NUM.RN.P7"),
	generated("equivalent-fractions", "Equivalent fractions and simplifying", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["equivalent-fractions"], "MS.Y5.NUM.RN.P9", "MS.Y6.NUM.RN.P6"),
	generated("squares-cubes", "Square and cube numbers", "place-value", GENERATED_SKILL_KEYS["squares-cubes"], "MS.Y6.NUM.NS.P6"),
	generated("round-million", "Rounding to the nearest million", "rounding", GENERATED_SKILL_KEYS["round-million"], "MS.Y6.NUM.NS.P3", "MS.Y6.NUM.NS.P4"),
	generated("fdp-equivalents", "Fractions, decimals and percentages", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["fdp-equivalents"], "MS.Y6.NUM.RN.P3", "MS.Y6.NUM.RN.P4"),
	generated("percent-of", "Percentages of an amount", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["percent-of"], "MS.Y6.NUM.RN.P13", "MS.Y6.NUM.RN.P14"),
	generated("whole-from-fraction", "Finding the whole from a fraction", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["whole-from-fraction"], "MS.Y6.NUM.RN.P12"),
	generated("bedmas", "Order of operations", "order-of-operations", GENERATED_SKILL_KEYS.bedmas, "MS.Y6.NUM.OP.P1")
];
/** The skill's keys once switched-off tables are taken out. */
function activeKeys(skill, enabledTables, division = true) {
	const on = new Set(enabledTables);
	return skill.keys.filter((k) => {
		const mul = parseFactKey(k);
		if (mul) return on.has(mul.a) || on.has(mul.b);
		const div = /^div:\d+\/(\d+)$/.exec(k);
		return div ? division && on.has(Number(div[1])) : true;
	});
}
/**
* Where a student is on the ladder, worked out from their records: the first built skill that
* isn't secure yet (70% of its facts in box 2 or higher, the same rule as the times-table
* campaign) is the one they're on. Skipped skills (all their tables switched off) are secure
* for free. With a `floor` (placement, year level or the furthest place reached, see place.ts) the
* built skills before it are behind the student (passed over, and secure only if their records say so), so forgetting a fact brings more review but never
* drops the student's place below the floor.
*/
function ladderProgress(stats, opts = {}) {
	const byKey = new Map([...stats].map((s) => [s.key, s]));
	const enabled = opts.enabledTables ?? TABLES;
	let current = null;
	let secureCount = 0;
	let builtCount = 0;
	const floor = opts.floor ?? 0;
	return {
		skills: LADDER.map((skill, index) => {
			if (!skill.built) return {
				skill,
				status: "later",
				share: 0
			};
			const keys = activeKeys(skill, enabled, opts.division !== false);
			if (keys.length === 0) return {
				skill,
				status: "upcoming",
				share: 1
			};
			builtCount++;
			const share = keys.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / keys.length;
			if (index < floor) {
				const real = share >= STEP_SECURE_SHARE;
				if (real) secureCount++;
				return {
					skill,
					status: "secure",
					share,
					passedOver: !real
				};
			}
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
		keys: activeKeys(p.skill, enabled, opts.division !== false)
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
	if (isGeneratedKey(key)) return "generated";
	if (/^(bond10|bond20|dbl|half|tenand):/.test(key)) return "early-facts";
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
	/** Each pack numbers its own questions, so the ladder numbers them again: a question box tells questions apart by this. */
	asked = 0;
	listeners = new Set();
	constructor(saved = [], random = Math.random, now = Date.now, opts = {}) {
		this.random = random;
		this.opts = opts;
		const only = (pack) => saved.filter((s) => pack.owns(s.key));
		const shells = [
			earlyFactsPack(),
			new BandedPack(BANDED_PACKS["add-sub"]),
			new TimesTables(),
			new BandedPack(BANDED_PACKS.division),
			generatedPack()
		];
		this.packs = [
			earlyFactsPack(only(shells[0]), random, now),
			new BandedPack(BANDED_PACKS["add-sub"], only(shells[1]), random, now),
			new TimesTables(only(shells[2]), random, now),
			new BandedPack(BANDED_PACKS.division, only(shells[3]), random, now),
			generatedPack(only(shells[4]), random, now)
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
		return {
			...pack.questionFor(picked.key, picked.band, {
				...ctx,
				missingFactor
			}),
			id: ++this.asked
		};
	}
	recordAnswer(q, answer, ms) {
		const result = this.ownerOf(q.factKey).recordAnswer(q, answer, ms);
		if (!result.correct) scheduleRepeat(this.memory, q.factKey, this.random);
		return result;
	}
};
//#endregion
//#region shared/maths/place.ts
/**
* A student's place on the ladder (docs/MATHS-FOCUS-PLAN.md section 5). Three things set the floor under it:
*  - their class's year level, until they have done the placement check;
*  - the placement check (about 10 questions that jump up while they answer right and quickly and step back when they don't);
*  - the furthest place they have ever reached, kept on the server so it only ever moves forward.
* Skills before the floor count as passed. Forgetting ×7 gives more ×7 review, but never drops the place.
*
* The server keeps the furthest place and the placement; the database cannot see the ladder, so the server functions that save
* answers work the place out with this file (`placeToStore`) and the database only checks that it never goes back.
*/
const NO_LADDER = {
	on: false,
	yearLevel: null,
	placed: null,
	placement: null,
	furthest: null
};
const ID = /^[a-z0-9-]{1,40}$/;
const skillId = (v) => typeof v === "string" && ID.test(v) && LADDER.some((s) => s.id === v && s.built) ? v : null;
function parseLadderInfo(raw) {
	if (!raw || typeof raw !== "object") return NO_LADDER;
	const r = raw;
	const year = typeof r.yearLevel === "number" && Number.isInteger(r.yearLevel) && r.yearLevel >= 0 && r.yearLevel <= 13 ? r.yearLevel : null;
	const placement = skillId(r.placement);
	const placed = r.placed === "skipped" ? "skipped" : r.placed === "done" && placement ? "done" : null;
	return {
		on: r.on === true,
		yearLevel: year,
		placed,
		placement: placed === "done" ? placement : null,
		furthest: skillId(r.furthest)
	};
}
/** The year a skill is taught, from its first NZ Curriculum tag ("MS.Y4.NUM.OP.P2" → 4). */
function skillYear(skill) {
	const m = /^MS\.Y(\d+)\./.exec(skill.curriculumTags[0] ?? "");
	return m ? Number(m[1]) : null;
}
const builtSkills = () => LADDER.filter((s) => s.built);
const indexOfSkill = (id) => id ? LADDER.findIndex((s) => s.id === id) : -1;
/** Where a class's year level starts students: an index into `LADDER`. No year level = the first skill. */
function yearStartRank(yearLevel) {
	const built = builtSkills();
	if (yearLevel === null) return LADDER.indexOf(built[0]);
	const want = yearLevel - 1;
	const found = built.find((s) => (skillYear(s) ?? 0) >= want) ?? built[built.length - 1];
	return LADDER.indexOf(found);
}
/** The floor under a student's place: an index into `LADDER`. */
function floorRank(info) {
	const start = info.placed === "done" ? indexOfSkill(info.placement) : yearStartRank(info.yearLevel);
	return Math.max(0, start, indexOfSkill(info.furthest));
}
/** The student's place on the ladder, with the floor applied. */
function placeProgress(stats, info, opts = {}) {
	return ladderProgress(stats, {
		...opts,
		floor: floorRank(info)
	});
}
/** The furthest place to keep: where they are now, or the last built skill once all of them are secure. */
function placeToStore(stats, info, opts = {}) {
	const skill = placeProgress(stats, info, opts).current ?? builtSkills().at(-1) ?? null;
	return skill ? {
		skill: skill.id,
		rank: LADDER.indexOf(skill)
	} : null;
}
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
	own: null,
	ladder: NO_LADDER
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
		} : null,
		ladder: parseLadderInfo(r.ladder)
	};
}
/** True when the focus names at least one skill the games can ask today. */
function hasFocus(focus) {
	return !!focus && focus.source !== "auto" && focusSkills(focus).length > 0;
}
/** The class has auto switched on and the student has no focus: the games ask from the whole ladder. */
const usesLadder = (focus) => !hasFocus(focus) && !!focus?.ladder?.on;
/** The ladder facts of a focus (auto off, nothing known, when it has none). */
const ladderOf = (focus) => focus?.ladder ?? NO_LADDER;
/**
* The pack a game asks its questions from. With no focus it is the times-table pack, exactly
* as before (the campaign or the student's ready step decides), unless the class has auto switched on:
* then it is the whole ladder from the student's place. With a focus it is the ladder
* pack, asking only that focus. `stats` is every record the student has, whatever pack kept it.
*/
function makeFocusPack(stats, focus, opts = {}, random, now) {
	if (usesLadder(focus)) return new AutoPack(stats, random, now, {
		enabledTables: opts.enabledTables,
		division: opts.division,
		floor: floorRank(ladderOf(focus))
	});
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
	if (hi === 10 && lo >= 1 && lo <= 9) keys.push(`tenand:${lo}`);
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
	const generated = solveGenerated(p);
	if (generated) return {
		answer: generated.answer,
		keys: [generated.key]
	};
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
//#region shared/maths/placeContext.ts
/**
* Reads what the database sends about a student's ladder (`space_maths_context`: records, question settings and focus) into the
* pieces the ladder code wants.
*/
function ladderOfContext(context) {
	return {
		facts: Array.isArray(context.facts) ? context.facts : [],
		info: ladderOf(parseFocus(context.focus)),
		opts: {
			enabledTables: context.settings?.enabledTables,
			division: context.settings?.division
		}
	};
}
//#endregion
//#region shared/maths/syncPlace.ts
/**
* The server side of a student's place on the ladder (docs/MATHS-FOCUS-PLAN.md section 5). The functions that save answers call
* `makePlaceSyncer` after saving, which works the place out from the student's records and hands it to the database, which only
* ever moves it forward. `savePlacement` checks a placement check before storing where to start. Both take their database calls
* as ports, so the tests (and each function's entry file) can stand in for Supabase.
*/
/** Looks at a student's records and keeps their furthest place up to date. Never throws: a late or missing update is harmless. */
function makePlaceSyncer(ports, now = Date.now, minGapMs = 3e4) {
	const last = new Map();
	return async function syncPlace(player) {
		const at = now();
		const before = last.get(player);
		if (before !== void 0 && at - before < minGapMs) return;
		last.set(player, at);
		if (last.size > 5e3) last.clear();
		try {
			const context = await ports.loadContext(player);
			if (!context) return;
			const { facts, info, opts } = ladderOfContext(context);
			if (!info.on) return;
			const place = placeToStore(facts, info, opts);
			if (place) await ports.savePlace(player, place.skill, place.rank);
		} catch {
			console.error("place: not updated");
		}
	};
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
	const mathsSwitch = await services.mathsSwitch(me);
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
	await mustBeSameSchool(services, await mustBeAllowed(services, me, true), game.host);
	return joinWaiting(services, me, game);
}
/** A game made at another school looks exactly like a code that doesn't exist: nothing is shared between schools. */
async function mustBeSameSchool(services, me, host) {
	const theirs = host ? await services.playerStatus(host) : null;
	if (theirs && theirs.schoolId !== me.schoolId) throw new Refused("not-found");
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
	const setup = withMathsSwitch(game.setup, await services.mathsSwitch(me));
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
	const { id, skill, kind, parts, spoken, choices, choiceLabels, input, maxLength } = q;
	return {
		id,
		skill,
		kind,
		parts,
		spoken,
		...choices ? { choices } : {},
		...choiceLabels ? { choiceLabels } : {},
		...input === "decimal" ? { input } : {},
		...maxLength ? { maxLength } : {}
	};
}
/**
* The answer and the record of a question this server asked (it keeps the whole question, answer and all). A question
* saved before the maths focus existed is checked the old way: worked out from how it was shown.
*/
function markStored(q) {
	if (q && Number.isFinite(q.answer) && typeof q.factKey === "string" && isFocusKey(q.factKey)) return {
		answer: q.answer,
		key: q.factKey
	};
	const solved = solveParts(q?.parts);
	return solved ? {
		answer: solved.answer,
		key: solved.keys[0]
	} : null;
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
	const question = pickSpaceQuestion(makeSpacePack(context.facts, context.focus, context.settings, services.random), context.settings);
	if (!question) throw new Refused("failed");
	await services.saveQuestion(game.id, seat, body.kind, stamp, question);
	return new WithGame(game, { question: publicQuestion(question) });
}
/** The student's typed answer, marked here. */
async function answerQuestion({ services, me, body }) {
	const typed = body.answer;
	if (!isKind(body.kind) || typeof typed !== "number" || !Number.isFinite(typed) || typed < 0 || typed > 1e9) throw new Refused("bad-request");
	const { game, seat } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	await mustBeAllowed(services, me, true, otherPlayers(game, me));
	const kind = body.kind;
	const stamp = questionStamp(game, seat, kind, body);
	const stored = await services.loadQuestion(game.id, seat, kind);
	if (!stored || stored.stamp !== stamp) throw new Refused("changed");
	if (stored.answered) throw new Refused("illegal", { error: "You’ve already answered that one." });
	const solved = markStored(stored.question);
	if (!solved) throw new Refused("failed");
	const right = sameAnswer(typed, solved.answer);
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
	const next = await newWaitingGame(services, me, withMathsSwitch(game.setup, await services.mathsSwitch(me)), false);
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
/** The database calls the ladder needs: the student's records and focus, and their furthest place. Placement is saved by gem-keep. */
const syncPlace = makePlaceSyncer({
	async loadContext(player) {
		const { data, error } = await admin.rpc("space_maths_context", { player });
		if (error) throw new Error(error.code ?? "unknown");
		return data ?? null;
	},
	async savePlace(player, skill, rank) {
		const { error } = await admin.rpc("record_ladder_place", {
			player,
			skill,
			rank
		});
		if (error) throw new Error(error.code ?? "unknown");
	},
	async savePlacementRow() {
		return false;
	}
});
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
			schoolId: row.school_id ?? null,
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
	async mathsSwitch(player) {
		const { data, error } = await admin.rpc("settings_of", { player }).maybeSingle();
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
			focus: parseFocus(context.focus),
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
		const pack = packIdOfKey(answer.key) ?? "times-tables";
		const { error } = await admin.rpc("record_fact_answers", {
			player,
			pack,
			batch_id: await batchIdFor(once),
			answers: [answer],
			quick_ms: quickMsForPack(pack),
			fluent_days: 2,
			top_box: 4
		});
		if (error) logProblem("record answer", error.code);
		else await syncPlace(player);
	}
}));
//#endregion
