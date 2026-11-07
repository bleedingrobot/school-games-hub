// GENERATED FILE: don't edit. Edit supabase/functions/decree/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "decree" function.

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
/**
* The longest an answer is kept as taking. A student who looks away for ten minutes mid-question has not spent ten minutes on
* the sum: kept as it is, one such answer would swamp the average time teachers see for that fact. Longer answers still count,
* as this long (right or wrong is untouched, and anything this slow is far from quick).
*/
const LONGEST_ANSWER_MS = 12e4;
/** An answer's time as it is kept: whole milliseconds, 0 to `LONGEST_ANSWER_MS`. */
const keptMs = (ms) => Math.min(LONGEST_ANSWER_MS, Math.max(0, Math.round(ms)));
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
function afterAnswer(stats, correct, rawMs, at, quickMs = QUICK_MS) {
	const ms = keptMs(rawMs);
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
const sameAnswer$1 = (a, b) => Math.abs(a - b) < 1e-6;
/** Digits a typed answer needs, allowing one extra so the length doesn't give the answer away. */
const lengthFor = (answer) => String(tidy(answer)).length;
/** Four choices: the answer plus believable wrong ones, padded with near misses when short. */
function choicesFor$1(answer, wrong, decimal, random) {
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
		} else if (multipleChoice || made.choose) choices = choicesFor$1(answer, made.wrong ?? [], decimal, random);
		return {
			skill: this.id,
			factKey: key,
			kind: key,
			parts: made.parts,
			spoken: made.spoken,
			...made.prompt ? { prompt: made.prompt } : {},
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
		if (!Number.isFinite(n) || n < 0 || sameAnswer$1(n, answer)) continue;
		if (!opts.decimal && !Number.isInteger(n)) continue;
		if (opts.ok && !opts.ok(n)) continue;
		if (seen.some((s) => sameAnswer$1(s, n))) continue;
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
/** Shown above a typed "3/4 = ?" or "35% = ?", which on its own could want any kind of answer. */
const AS_DECIMAL = "Write it as a decimal.";
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
					prompt: AS_DECIMAL,
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
* Each kind of question, with its NZ Curriculum codes: the codes the ladder gives its times-table skills (`tablesSkills` in
* ladder.ts, one per campaign step), shared by all three kinds because each is the same fact asked a different way
* (James, 20 Oct 2026; to check against his curriculum alignment tool). A test keeps them the same as the ladder's.
*/
const TIMES_TABLES_TAGS = [
	"MS.Y2.NUM.OP.P9",
	"MS.Y3.NUM.OP.P6",
	"MS.Y4.NUM.OP.P2",
	"MS.Y5.NUM.OP.P2"
];
const TIMES_TABLES_KINDS = {
	multiply: {
		label: "Multiplication facts",
		curriculumTags: TIMES_TABLES_TAGS
	},
	"missing-factor": {
		label: "Missing factor",
		curriculumTags: TIMES_TABLES_TAGS
	},
	divide: {
		label: "Division facts",
		curriculumTags: TIMES_TABLES_TAGS
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
	curriculumTags = [...new Set(Object.values(TIMES_TABLES_KINDS).flatMap((k) => k.curriculumTags))];
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
	fractions: FRACTIONS$1,
	decimals: DECIMALS
};
PLACE_VALUE.label, ADD_SUB.label, DIVISION.label, FRACTIONS$1.label, DECIMALS.label;
//#endregion
//#region shared/seededRandom.ts
/** A tiny repeatable random number generator, so "random" test games are the same every run. */
function seeded(seed) {
	return () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};
}
//#endregion
//#region shared/maths/skillPacks/equalsKeys.ts
/**
* The keys Parrot's See-saw records (docs/PARROT-PLAN.md): equations with a missing number that keeps a see-saw level.
* They live here, beside the early facts that own them (`equals` families in earlyFacts.ts), and shared/parrot/round.ts
* reads them from here so there is one list.
*
*   eqmiss:8=5+?       eqswap:3+5       eqboth:6+7=8+?       eqsub:3=8-? and eqsub:9-4=2+?       eqtf:5+3=4+4
*/
/** `eqmiss:8=5+?`: a = b + ?, a 3 to 10. */
const missKeys = () => {
	const out = [];
	for (let a = 3; a <= 10; a++) for (let b = 1; b < a; b++) out.push(`eqmiss:${a}=${b}+?`);
	return out;
};
/** `eqswap:3+5`: two different numbers to 7, asked as `x + y = y + ?` and `y + x = x + ?`. */
const swapKeys = () => {
	const out = [];
	for (let x = 1; x <= 7; x++) for (let y = x + 1; y <= 7; y++) out.push(`eqswap:${x}+${y}`);
	return out;
};
/** `eqboth:6+7=8+?`: thirty fixed sums to 20, half with the first number moved by one. */
const bothKeys = () => {
	const random = seeded(20261107);
	const out = new Set();
	const sums = [];
	for (let a = 3; a <= 10; a++) for (let b = 3; b <= 10; b++) sums.push([a, b]);
	while (out.size < 30) {
		const [a, b] = sums[Math.floor(random() * sums.length)];
		const c = a + (out.size % 2 === 0 ? random() < .5 ? 1 : -1 : (random() < .5 ? 2 : -2) * (1 + Math.floor(random() * 2)));
		if (c < 1 || c === a || c === b || a + b - c < 1) continue;
		out.add(`eqboth:${a}+${b}=${c}+?`);
	}
	return [...out].sort();
};
const SUB1 = [
	[3, 8],
	[4, 9],
	[5, 9],
	[6, 10],
	[7, 12],
	[8, 13],
	[9, 14],
	[6, 15],
	[12, 17],
	[11, 20]
];
const SUB2 = [
	[
		9,
		4,
		2
	],
	[
		10,
		3,
		4
	],
	[
		12,
		5,
		3
	],
	[
		11,
		6,
		2
	],
	[
		14,
		6,
		4
	],
	[
		13,
		4,
		5
	],
	[
		15,
		5,
		6
	],
	[
		16,
		7,
		4
	],
	[
		18,
		8,
		5
	],
	[
		20,
		9,
		6
	]
];
/** `eqsub:3=8-?` and `eqsub:9-4=2+?`. */
const subKeys = () => [...SUB1.map(([a, b]) => `eqsub:${a}=${b}-?`), ...SUB2.map(([a, b, c]) => `eqsub:${a}-${b}=${c}+?`)];
/** `eqtf:5+3=4+4`: half are true, about a quarter are one out, the rest are further out. */
const tfKeys = () => {
	const random = seeded(20261108);
	const out = new Set();
	const pick = (hi) => 1 + Math.floor(random() * hi);
	while (out.size < 30) {
		const a = pick(9), b = pick(9), c = pick(9);
		const i = out.size;
		const d = i % 2 === 0 ? a + b - c : i % 4 === 1 ? a + b - c + (random() < .5 ? 1 : -1) : a + b - c + (random() < .5 ? 1 : -1) * (2 + pick(2));
		if (d < 1 || d > 10 || a === c && b === d || a === d && b === c && i % 2 === 0 && out.size % 6 !== 0) continue;
		out.add(`eqtf:${a}+${b}=${c}+${d}`);
	}
	return [...out].sort();
};
const KEYS = {
	miss: missKeys(),
	swap: swapKeys(),
	both: bothKeys(),
	sub: subKeys(),
	tf: tfKeys()
};
Object.values(KEYS).flat();
//#endregion
//#region shared/maths/skillPacks/countingKeys.ts
const LAYOUTS = [
	"line",
	"scatter",
	"ring"
];
const range$6 = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const COUNT_KEYS = {
	give: range$6(1, 20).map((n) => `give:n${n}`),
	howmany: LAYOUTS.flatMap((layout) => range$6(1, 10).map((n) => `howmany:n${n}:${layout}`)),
	counton: range$6(4, 9).map((s) => `counton:${s}+1`),
	across: range$6(11, 20).map((n) => `across:n${n}`)
};
Object.values(COUNT_KEYS).flat();
/** The numbers a key names: give:n6 is [6], howmany:n6:ring is [6], counton:5+1 is [5, 1]. */
const countNumbers = (key) => (key.split(":").slice(1).join(":").match(/\d+/g) ?? []).map(Number);
//#endregion
//#region shared/maths/skillPacks/earlyFacts.ts
/**
* The first rungs of the maths ladder: number facts a student should know by heart before
* times tables. One mastery record per fact, like 7 × 8 in times tables.
*
* Keys: "bond10:3+7" (pairs that make 10), "bond20:8+12" (pairs that make 20), "dbl:7"
* (double 7), "half:14" (half of 14) and "skip5:next:25" (skip counting: see `skipCounting`), "part7:4" (7 altogether, 4 showing: see `partWhole`), "oddeven:7" (is 7 odd or even? see `oddEven`), the number-line keys "place100:n63", "read1000:h300", "tens100:+63", "near10:h65", "zoom:40-50:47" (see `lineFamilies`). Adding and taking away within 20 keeps its own
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
const range$5 = (from, to, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
/** Doubles of dblFrom–dblTo and halves of the even numbers halfFrom–halfTo. */
function doublesHalves(label, tag, dblFrom, dblTo, halfFrom, halfTo) {
	const dbls = range$5(dblFrom, dblTo);
	const halves = range$5(halfFrom, halfTo, 2);
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
/**
* "Ten and" facts, one record for each of the nine, key "tenand:4": 10 + 4 and 4 + 10 (variants 0 and 1, the only ones rolled).
* Variants 2 and 3 (10 + ? = 14, 14 − 10) are still made, for a Tūī challenge saved before they moved to "tenless:4", but never rolled.
*/
const tenAnd = {
	label: "\"Ten and\" facts (10 + 4)",
	curriculumTags: ["MS.Y1.NUM.OP.P6"],
	keys: range$5(1, 9).map((n) => `tenand:${n}`),
	roll: (key, r) => [Number(key.split(":")[1]), int(r, 0, 1)],
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
};
/** The same nine numbers taken the other way, kept apart because they are separate memories (R9): variants 0 "14 − 10 = ?", 1 "10 + ? = 14". Key "tenless:4". */
const tenLess = {
	label: "\"Ten less\" facts (14 − 10)",
	curriculumTags: ["MS.Y1.NUM.OP.P6"],
	keys: range$5(1, 9).map((n) => `tenless:${n}`),
	roll: (key, r) => [Number(key.split(":")[1]), int(r, 0, 1)],
	make: (key, [n, v]) => {
		if (!isInt(n, 1, 9) || key !== `tenless:${n}` || !isInt(v, 0, 1)) return null;
		const t = String(10 + n);
		const parts = v === 0 ? [
			t,
			"−",
			"10",
			"=",
			"?"
		] : [
			"10",
			"+",
			"?",
			"=",
			t
		];
		return {
			parts,
			spoken: speak(parts),
			answer: n,
			wrong: [
				n + 1,
				n - 1,
				n + 10,
				20,
				1 + n
			]
		};
	}
};
const tenMove = (up) => {
	const keys = range$5(up ? 10 : 20, (up ? 10 : 20) + 9).map((n) => `${up ? "tenup" : "tendown"}:${n}`);
	return {
		label: up ? "Ten more than a teen (14 + 10)" : "Ten less than a number in the twenties (24 − 10)",
		curriculumTags: ["MS.Y1.NUM.OP.P6"],
		keys,
		roll: (key, r) => [Number(key.split(":")[1]), int(r, 0, 1)],
		make: (key, [n, v]) => {
			if (!keys.includes(key) || key.split(":")[1] !== String(n) || !isInt(v, 0, 1)) return null;
			const [parts, answer] = up ? v === 0 ? [[
				String(n),
				"+",
				"10",
				"=",
				"?"
			], n + 10] : [[
				"10",
				"+",
				String(n),
				"=",
				"?"
			], n + 10] : v === 0 ? [[
				String(n),
				"−",
				"10",
				"=",
				"?"
			], n - 10] : [[
				"10",
				"+",
				"?",
				"=",
				String(n)
			], n - 10];
			const a = answer;
			return {
				parts,
				spoken: speak(parts),
				answer: a,
				wrong: up ? [
					a - 10,
					a + 10,
					a + 1,
					a - 1,
					11
				] : [
					n,
					a - 10,
					a + 1,
					a - 1,
					n + 10
				]
			};
		}
	};
};
/** The steps juniors skip count in, how far each goes and its word ("Counting in tens"). Up to 20 for twos to start with. */
const SKIP_STEPS = [
	{
		step: 10,
		upTo: 100,
		word: "tens"
	},
	{
		step: 5,
		upTo: 50,
		word: "fives"
	},
	{
		step: 2,
		upTo: 20,
		word: "twos"
	}
];
/**
* More skip counting, beside the ladder (ladder-only, so auto practice never meets it; Hop asks it from its own rules):
* threes to 30 ("skip3:next:12") and fours to 40 ("skip4:up:20"), the same kinds of question as the first three.
*/
const SKIP_MORE_STEPS = [{
	step: 3,
	upTo: 30,
	word: "threes"
}, {
	step: 4,
	upTo: 40,
	word: "fours"
}];
/** Tens past 100, to 200: "skip10h:next:110" (80, 90, 100, ?). Only answers past 100, so no key is also a "skip10" one. */
const SKIP_HIGH = {
	step: 10,
	from: 100,
	upTo: 200,
	word: "tens past 100"
};
/**
* Skip counting from a start that isn't a multiple of the step (start at 3, hop by 10: 3, 13, 23, ?), to 4 hops. The first
* pad is always the start, so "skip10o3:next:33" really is "from 3": the key names the start. Offsets are 1 up to one
* less than the step.
*/
const SKIP_FROM_STEPS = [
	{
		step: 10,
		word: "tens"
	},
	{
		step: 5,
		word: "fives"
	},
	{
		step: 4,
		word: "fours"
	},
	{
		step: 3,
		word: "threes"
	},
	{
		step: 2,
		word: "twos"
	}
];
/**
* One way to show a skip-counting question with this answer, or null. `at` is where the gap is: 1 or 2 for up and back
* (four pads, the gap in the middle), 3 or 4 for next (that many pads shown before the gap). Every pad is a multiple of
* the step from 0 to `upTo`; with an offset the first pad is the offset itself and counting only goes up.
*/
function skipTerms(spec, kind, answer, at, offset = 0) {
	const { step, upTo } = spec;
	if (kind === "next" ? at !== 3 && at !== 4 : at !== 1 && at !== 2) return null;
	const terms = kind === "up" ? range$5(answer - at * step, answer + (3 - at) * step, step) : kind === "back" ? range$5(answer - (3 - at) * step, answer + at * step, step).reverse() : range$5(answer - at * step, answer, step);
	if (spec.offsets && (kind === "back" || terms[0] !== offset)) return null;
	if (spec.above !== void 0 && answer <= spec.above) return null;
	return terms.every((n) => n >= 0 && n <= upTo) && answer % step === offset ? terms : null;
}
const skipOffsets = (spec) => spec.offsets ?? [0];
const skipKeys = (spec) => skipOffsets(spec).flatMap((offset) => (spec.offsets ? ["up", "next"] : [
	"up",
	"next",
	"back"
]).flatMap((kind) => range$5(offset, spec.upTo, spec.step).filter((n) => [
	1,
	2,
	3,
	4
].some((at) => skipTerms(spec, kind, n, at, offset))).map((n) => `${spec.prefix(offset)}:${kind}:${n}`)));
/** A skip-counting key read apart: "skip10o3:next:33" is step 10, start 3 (offset 3), what comes next, 33; "skip10h:up:110" is high. */
const parseSkip = (key) => {
	const m = /^skip(\d+)(?:o(\d+)|(h))?:(up|next|back):(\d+)$/.exec(key);
	return m ? {
		step: Number(m[1]),
		offset: m[2] ? Number(m[2]) : 0,
		high: !!m[3],
		kind: m[4],
		answer: Number(m[5])
	} : null;
};
/**
* Skip counting in tens, fives or twos (NZ Years 1–2), one record for each missing number of each kind: "skip10:up:40" is
* the 40 in 20, 30, ?, 50 (or 30, ?, 50, 60). The parts are the pads, the gap as "?": ["20,", "30,", "?,", "50"].
* Wrong choices: one more or less, the wrong step from the pad before, and a number already shown.
*/
function skipCounting(spec) {
	const { step, word } = spec;
	const keys = skipKeys(spec);
	const ats = (kind) => kind === "next" ? [3, 4] : [1, 2];
	return {
		label: `Counting in ${word}`,
		curriculumTags: [],
		keys,
		roll: (key, r) => {
			const { kind, answer, offset } = parseSkip(key);
			const fits = ats(kind).filter((at) => skipTerms(spec, kind, answer, at, offset));
			return [answer, fits[int(r, 0, fits.length - 1)]];
		},
		make: (key, [answer, at]) => {
			const skip = parseSkip(key);
			if (!skip || skip.step !== step || skip.answer !== answer || !keys.includes(key)) return null;
			const terms = skipTerms(spec, skip.kind, answer, at, skip.offset);
			if (!terms) return null;
			const gap = terms.indexOf(answer);
			const parts = terms.map((n, i) => (i === gap ? "?" : String(n)) + (i < terms.length - 1 ? "," : ""));
			const said = terms.map((n, i) => i === gap ? skip.kind === "next" ? "" : "something" : String(n)).filter(Boolean).join(", ");
			const prompt = skip.kind === "next" ? "What comes next?" : "What is missing?";
			const before = terms[gap - 1];
			const back = skip.kind === "back" ? -1 : 1;
			const wrongSteps = [
				10,
				5,
				2,
				1
			].filter((s) => s !== step);
			return {
				parts,
				spoken: `Counting ${skip.kind === "back" ? "back " : ""}in ${word}${skip.offset ? ` from ${skip.offset}` : ""}: ${said}. ${prompt}`,
				prompt,
				answer,
				wrong: [
					answer + 1,
					answer - 1,
					...wrongSteps.map((s) => before + back * s),
					...terms.filter((n) => n !== answer)
				]
			};
		}
	};
}
const skipSpec = (step, upTo, word) => ({
	step,
	upTo,
	word,
	prefix: () => `skip${step}`
});
const skipFamilies = {
	...Object.fromEntries([...SKIP_STEPS, ...SKIP_MORE_STEPS].map(({ step, upTo, word }) => [`skip${step}`, skipCounting(skipSpec(step, upTo, word))])),
	skip10h: skipCounting({
		step: 10,
		upTo: SKIP_HIGH.upTo,
		word: SKIP_HIGH.word,
		above: SKIP_HIGH.from,
		prefix: () => "skip10h"
	}),
	...Object.fromEntries(SKIP_FROM_STEPS.map(({ step, word }) => [`skip${step}o`, skipCounting({
		step,
		upTo: step * 5,
		word,
		offsets: range$5(1, step - 1),
		prefix: (offset) => `skip${step}o${offset}`
	})]))
};
/** The family names of the skip counting kept beside the ladder (threes, fours, tens past 100, and from a start). */
const SKIP_MORE_FAMILY_NAMES = Object.keys(skipFamilies).filter((n) => !SKIP_STEPS.some(({ step }) => n === `skip${step}`));
/** The wholes in each part-whole skill: small wholes first, then up to 10. */
const PART_WHOLES = {
	parts5: [3, 5],
	parts10: [6, 10]
};
const partKeys = (from, to) => range$5(from, to).flatMap((w) => range$5(0, w).map((s) => `part${w}:${s}`));
const parsePart = (key) => {
	const m = /^part(\d+):(\d+)$/.exec(key);
	return m ? {
		whole: Number(m[1]),
		shown: Number(m[2])
	} : null;
};
/**
* The part-whole idea (NZ Year 1, composition): "part7:4" is 7 altogether with 4 showing, so 3 hiding. Every split
* counts, 0 hiding and all hiding too. The parts are ["7", "=", "4", "+", "?"]. Wrong choices: one more or less, the
* number showing, the whole and two more.
*/
function partWhole(label, from, to) {
	const keys = partKeys(from, to);
	return {
		label,
		curriculumTags: ["MS.Y1.NUM.OP.P1"],
		keys,
		roll: (key) => {
			const { whole, shown } = parsePart(key);
			return [whole, shown];
		},
		make: (key, [whole, shown]) => {
			if (!keys.includes(key) || key !== `part${whole}:${shown}`) return null;
			const answer = whole - shown;
			return {
				parts: [
					String(whole),
					"=",
					String(shown),
					"+",
					"?"
				],
				spoken: `${whole} is ${shown} and how many more?`,
				answer,
				wrong: [
					answer + 1,
					answer - 1,
					shown,
					whole,
					answer + 2
				]
			};
		}
	};
}
/** A part-whole question read back from how it was shown (["7", "=", "4", "+", "?"]), or null when it isn't one. */
function solvePart(parts) {
	if (parts.length !== 5 || parts[1] !== "=" || parts[3] !== "+" || parts[4] !== "?") return null;
	if (!/^\d{1,2}$/.test(parts[0]) || !/^\d{1,2}$/.test(parts[2])) return null;
	const key = `part${Number(parts[0])}:${Number(parts[2])}`;
	if (key !== `part${parts[0]}:${parts[2]}`) return null;
	return Object.values(PART_WHOLES).some(([from, to]) => partKeys(from, to).includes(key)) ? {
		answer: Number(parts[0]) - Number(parts[2]),
		key
	} : null;
}
const ODD_EVEN_LABELS = ["odd", "even"];
const oddEven = {
	label: "Odd and even numbers to 20",
	curriculumTags: ["MS.Y2.NUM.OP.P2"],
	keys: range$5(1, 20).map((n) => `oddeven:${n}`),
	roll: (key) => [Number(key.split(":")[1])],
	make: (key, [n]) => {
		if (!isInt(n, 1, 20) || key !== `oddeven:${n}`) return null;
		const answer = n % 2 === 0 ? 1 : 0;
		return {
			parts: [
				"Is",
				String(n),
				"odd",
				"or",
				"even?"
			],
			spoken: `Is ${n} odd or even?`,
			answer,
			pick: [...ODD_EVEN_LABELS],
			fact: `${n} is ${ODD_EVEN_LABELS[answer]}`
		};
	}
};
/** An odd-or-even question read back from how it was shown (["Is", "7", "odd", "or", "even?"]): the index of the right choice. */
function solveOddEven(parts) {
	if (parts.length !== 5 || parts[0] !== "Is" || parts[2] !== "odd" || parts[3] !== "or" || parts[4] !== "even?") return null;
	if (!/^[1-9]\d?$/.test(parts[1])) return null;
	const n = Number(parts[1]);
	return n <= 20 ? {
		answer: n % 2 === 0 ? 1 : 0,
		key: `oddeven:${n}`
	} : null;
}
/** A skip-counting question read back from how it was shown (its parts), made again and checked, or null when it isn't one. */
function solveSkip(parts) {
	if (parts.length < 4 || parts.length > 5 || parts.filter((p) => p === "?" || p === "?,").length !== 1) return null;
	const nums = parts.map((p) => p.replace(/,$/, "")).map((p) => p === "?" ? null : /^\d{1,3}$/.test(p) ? Number(p) : NaN);
	if (nums.some((n) => Number.isNaN(n))) return null;
	const gap = nums.indexOf(null);
	const known = nums.flatMap((n, i) => n === null ? [] : [{
		n,
		i
	}]);
	const diff = (known[1].n - known[0].n) / (known[1].i - known[0].i);
	const step = Math.abs(diff);
	const answer = known[0].n + diff * (gap - known[0].i);
	const kind = gap === parts.length - 1 ? "next" : diff < 0 ? "back" : "up";
	if (kind === "next" && diff < 0) return null;
	const first = known[0].i === 0 ? known[0].n : NaN;
	const prefixes = [
		`skip${step}`,
		`skip${step}h`,
		`skip${step}o${first}`
	];
	for (const prefix of prefixes) {
		const key = `${prefix}:${kind}:${answer}`;
		const made = Object.values(families$2).find((f) => f.keys.includes(key))?.make(key, [answer, gap]);
		if (made && made.parts.length === parts.length && made.parts.every((p, i) => p === parts[i])) return {
			answer,
			key
		};
	}
	return null;
}
const LINE_TENS = range$5(1, 9).map((n) => n * 10);
const LINE_OTHERS_100 = [
	11,
	14,
	18,
	23,
	27,
	32,
	36,
	41,
	45,
	49,
	54,
	58,
	63,
	67,
	72,
	76,
	81,
	85,
	89,
	94,
	97
];
const LINE_HUNDREDS = range$5(1, 9).map((n) => n * 100);
const LINE_OTHERS_1000 = [
	120,
	140,
	170,
	230,
	250,
	270,
	310,
	340,
	360,
	390,
	410,
	450,
	480,
	520,
	540,
	570,
	610,
	640,
	660,
	690,
	720,
	750,
	780,
	810,
	830,
	860,
	880,
	910,
	940,
	960,
	980
];
const TENS_MORE = [
	14,
	20,
	27,
	35,
	42,
	56,
	63,
	78,
	85,
	90
];
const TENS_LESS = [
	10,
	19,
	24,
	38,
	47,
	63,
	71,
	86,
	92,
	100
];
/** Not a tens number and not halfway: every third, so the spread covers the whole line. */
const NEAR10_OTHERS = range$5(1, 99).filter((n) => n % 5 !== 0).filter((_, i) => i % 3 === 0).slice(0, 26);
const NEAR10_HALF = range$5(5, 95, 10);
const NEAR100_OTHERS = [
	130,
	180,
	220,
	280,
	340,
	390,
	430,
	480,
	530,
	580,
	610,
	640,
	680,
	730,
	790,
	830,
	870,
	920,
	960
].filter((_, i) => i % 2 === 0).concat([440]);
const NEAR100_HALF = range$5(150, 950, 100);
const ZOOM_KEYS = [
	...range$5(41, 49).map((n) => `zoom:40-50:${n}`),
	...range$5(71, 79).map((n) => `zoom:70-80:${n}`),
	"zoom:0-200:130",
	"zoom:300-400:350"
];
const PV_TENS = range$5(1, 9).map((n) => n * 10);
/** Two-digit numbers that are not tens: four ones digits for each ten, spread so no two ends repeat. */
const PV_OTHERS = range$5(1, 9).flatMap((t) => [
	1,
	3,
	5,
	7
].map((j) => t * 10 + (t + j) % 9 + 1));
const PV_REGROUP_BUNDLE = [
	23,
	31,
	38,
	42,
	46,
	54,
	59,
	25,
	37,
	48,
	51,
	33
];
const PV_REGROUP_SWAP = [
	32,
	41,
	47,
	53,
	56,
	62,
	65,
	71,
	74,
	78,
	83,
	86,
	29,
	35,
	44,
	58,
	67,
	92
];
const PV_TEN_MORE = [
	14,
	27,
	35,
	42,
	56,
	63,
	78,
	85,
	91,
	49,
	68,
	73
];
const PV_TEN_LESS = [
	19,
	32,
	47,
	54,
	61,
	76,
	83,
	98,
	25,
	66,
	39,
	72
];
const PV_HUNDREDS = range$5(1, 9).map((h) => h * 100);
/** Three-digit numbers that are not hundreds: for each hundred, one with every digit, one with a zero in the middle, one with a zero at the end. */
const PV3_OTHERS = range$5(1, 9).flatMap((h) => [
	h * 100 + (h * 3 % 9 + 1) * 10 + h * 2 % 9 + 1,
	h * 100 + h * 2 % 9 + 1,
	h * 100 + ((h + 4) % 9 + 1) * 10
]);
const PV_HUN_MORE = [
	147,
	232,
	356,
	418,
	563,
	694
];
const PV_HUN_LESS = [
	320,
	451,
	587,
	642,
	778,
	905
];
/** The number a key names ("place100:n63" → 63, "tens100:-63" → 63, "zoom:40-50:47" → 47). */
const lineNumber = (key) => Number(/(\d+)$/.exec(key)[1]);
/** A line question typed out, as its parts: each family says its own words, so the parts name the key (see `solveLine`). */
const numLine = (label, tag, keys, parts, spoken) => ({
	label,
	curriculumTags: [tag],
	keys,
	roll: (key) => [lineNumber(key)],
	make: (key, [n]) => {
		if (!keys.includes(key) || lineNumber(key) !== n) return null;
		return {
			parts: parts(n, key),
			spoken: spoken(n, key),
			answer: n,
			wrong: [
				n + 1,
				n - 1,
				n + 10,
				n + 2
			]
		};
	}
});
const nearWords = (n, size) => `Is ${n} closer to ${Math.floor(n / size) * size} or ${Math.floor(n / size) * size + size}?`;
const lineFamilies = {
	place100: numLine("Where a number goes on a 0 to 100 line", "MS.Y3.NUM.NS.P1", [...LINE_TENS.map((n) => `place100:t${n}`), ...LINE_OTHERS_100.map((n) => `place100:n${n}`)], (n) => [
		"Place",
		String(n),
		"on",
		"the",
		"100",
		"line"
	], (n) => `Where does ${n} go on the line to 100?`),
	read100: numLine("Reading a point on a 0 to 100 line", "MS.Y3.NUM.NS.P1", [...LINE_TENS.map((n) => `read100:t${n}`), ...LINE_OTHERS_100.map((n) => `read100:n${n}`)], (n) => [
		"Read",
		String(n),
		"on",
		"the",
		"100",
		"line"
	], () => "What number is at the arrow?"),
	tens100: numLine("Ten more and ten less on a 0 to 100 line", "MS.Y3.NUM.NS.P1", [...TENS_MORE.map((n) => `tens100:+${n}`), ...TENS_LESS.map((n) => `tens100:-${n}`)], (n, key) => [
		"Ten",
		key.includes("+") ? "more" : "less",
		"than",
		String(n)
	], (n, key) => `What is ten ${key.includes("+") ? "more" : "less"} than ${n}?`),
	near10: numLine("Which ten a number is closer to", "MS.Y3.NUM.NS.P5", [...NEAR10_OTHERS.map((n) => `near10:n${n}`), ...NEAR10_HALF.map((n) => `near10:h${n}`)], (n) => [
		"Nearest",
		"ten",
		"to",
		String(n)
	], (n) => nearWords(n, 10)),
	zoom: numLine("Reading and placing on a zoomed line", "MS.Y3.NUM.NS.P1", ZOOM_KEYS, (n, key) => [
		"Zoom",
		/zoom:(\d+-\d+)/.exec(key)[1],
		"at",
		String(n)
	], (n) => `Where is ${n} on the zoomed line?`),
	place1000: numLine("Where a number goes on a 0 to 1000 line", "MS.Y4.NUM.NS.P1", [...LINE_HUNDREDS.map((n) => `place1000:h${n}`), ...LINE_OTHERS_1000.map((n) => `place1000:n${n}`)], (n) => [
		"Place",
		String(n),
		"on",
		"the",
		"1000",
		"line"
	], (n) => `Where does ${n} go on the line to 1000?`),
	read1000: numLine("Reading a point on a 0 to 1000 line", "MS.Y4.NUM.NS.P1", [...LINE_HUNDREDS.map((n) => `read1000:h${n}`), ...LINE_OTHERS_1000.map((n) => `read1000:n${n}`)], (n) => [
		"Read",
		String(n),
		"on",
		"the",
		"1000",
		"line"
	], () => "What number is at the arrow?"),
	near100: numLine("Which hundred a number is closer to", "MS.Y4.NUM.NS.P5", [...NEAR100_OTHERS.map((n) => `near100:n${n}`), ...NEAR100_HALF.map((n) => `near100:h${n}`)], (n) => [
		"Nearest",
		"hundred",
		"to",
		String(n)
	], (n) => nearWords(n, 100)),
	pvbuild: numLine("Build a number with bundles and sticks", "MS.Y2.NUM.NS.P1", [...PV_TENS.map((n) => `pvbuild:t${n}`), ...PV_OTHERS.map((n) => `pvbuild:n${n}`)], (n) => [
		"Build",
		String(n),
		"with",
		"bundles"
	], (n) => `Build ${n} with bundles and sticks.`),
	pvread: numLine("Read bundles and sticks as a number", "MS.Y2.NUM.NS.P1", PV_OTHERS.map((n) => `pvread:n${n}`), (n) => [
		"Read",
		String(n),
		"from",
		"bundles"
	], () => "What number is this?"),
	pvzero: numLine("Read bundles with no sticks left over", "MS.Y2.NUM.NS.P1", PV_TENS.map((n) => `pvzero:n${n}`), (n) => [
		"Read",
		String(n),
		"from",
		"bundles",
		"only"
	], () => "What number is this?"),
	pvregroup: numLine("Tie sticks into bundles and untie a bundle", "MS.Y2.NUM.NS.P2", [...PV_REGROUP_BUNDLE.map((n) => `pvregroup:b${n}`), ...PV_REGROUP_SWAP.map((n) => `pvregroup:s${n}`)], (n, key) => key.includes(":b") ? [
		"Tie",
		String(n),
		"sticks",
		"into",
		"bundles"
	] : [
		"Untie",
		"a",
		"bundle",
		"of",
		String(n)
	], (n, key) => key.includes(":b") ? `Tie ${n} sticks into bundles.` : `${n} is one bundle fewer and ten more sticks.`),
	pvten: numLine("Ten more and ten less with bundles", "MS.Y2.NUM.NS.P1", [...PV_TEN_MORE.map((n) => `pvten:+${n}`), ...PV_TEN_LESS.map((n) => `pvten:-${n}`)], (n, key) => [
		"Bundle",
		key.includes("+") ? "added" : "taken",
		"from",
		String(n)
	], (n, key) => `What is ten ${key.includes("+") ? "more" : "less"} than ${n}?`),
	pvbuild3: numLine("Build a number with rafts, bundles and sticks", "MS.Y3.NUM.NS.P1", [...PV_HUNDREDS.map((n) => `pvbuild3:t${n}`), ...PV3_OTHERS.map((n) => `pvbuild3:n${n}`)], (n) => [
		"Build",
		String(n),
		"with",
		"rafts"
	], (n) => `Build ${n} with rafts, bundles and sticks.`),
	pvread3: numLine("Read rafts, bundles and sticks as a number", "MS.Y3.NUM.NS.P1", [...PV_HUNDREDS.map((n) => `pvread3:t${n}`), ...PV3_OTHERS.map((n) => `pvread3:n${n}`)], (n) => [
		"Read",
		String(n),
		"from",
		"rafts"
	], () => "What number is this?"),
	pvhun: numLine("A hundred more and a hundred less", "MS.Y3.NUM.NS.P1", [...PV_HUN_MORE.map((n) => `pvhun:+${n}`), ...PV_HUN_LESS.map((n) => `pvhun:-${n}`)], (n, key) => [
		"Raft",
		key.includes("+") ? "added" : "taken",
		"from",
		String(n)
	], (n, key) => `What is a hundred ${key.includes("+") ? "more" : "less"} than ${n}?`)
};
const LINE_FAMILY_NAMES = Object.keys(lineFamilies);
/** A number-line question read back from its parts (["Place", "63", "on", "the", "100", "line"]): its number and key, or null when it isn't one. */
function solveLine(parts) {
	const n = parts.map((p) => /^[1-9]\d{0,2}$/.test(p) ? Number(p) : NaN).find((x) => !Number.isNaN(x));
	if (n === void 0) return null;
	for (const family of Object.values(lineFamilies)) for (const key of family.keys) {
		if (lineNumber(key) !== n) continue;
		const made = family.make(key, [n]);
		if (made && made.parts.length === parts.length && made.parts.every((x, i) => x === parts[i])) return {
			answer: n,
			key
		};
	}
	return null;
}
const equalsNumbers = (key) => (key.split(":")[1].match(/\d+/g) ?? []).map(Number);
const equalsParts = (key, n) => {
	const w = (...x) => [
		"Level",
		"see-saw:",
		...x.map(String)
	];
	if (key.startsWith("eqmiss:")) return w(n[0], "=", n[1], "+", "?");
	if (key.startsWith("eqswap:")) return w(n[0], "+", n[1], "=", n[1], "+", "?");
	if (key.startsWith("eqboth:")) return w(n[0], "+", n[1], "=", n[2], "+", "?");
	if (key.startsWith("eqtf:")) return [
		"True",
		"or",
		"false?",
		String(n[0]),
		"+",
		String(n[1]),
		"=",
		String(n[2]),
		"+",
		String(n[3])
	];
	return key.includes("-?") ? w(n[0], "=", n[1], "-", "?") : w(n[0], "-", n[1], "=", n[2], "+", "?");
};
const equalsAnswer = (key, n) => {
	if (key.startsWith("eqmiss:")) return n[0] - n[1];
	if (key.startsWith("eqswap:")) return n[0];
	if (key.startsWith("eqboth:")) return n[0] + n[1] - n[2];
	if (key.startsWith("eqtf:")) return n[0] + n[1] === n[2] + n[3] ? 0 : 1;
	return key.includes("-?") ? n[1] - n[0] : n[0] - n[1] - n[2];
};
const equals = (label, keys) => ({
	label,
	curriculumTags: [],
	keys,
	roll: (key) => equalsNumbers(key),
	make: (key, params) => {
		const n = equalsNumbers(key);
		if (!keys.includes(key) || n.length !== params.length || n.some((x, i) => x !== params[i])) return null;
		const answer = equalsAnswer(key, n);
		const parts = equalsParts(key, n);
		if (key.startsWith("eqtf:")) return {
			parts,
			spoken: `True or false: ${n[0]} plus ${n[1]} equals ${n[2]} plus ${n[3]}?`,
			answer,
			pick: ["True", "False"]
		};
		return {
			parts,
			spoken: `What number keeps the see-saw level?`,
			answer,
			wrong: [
				answer + 1,
				answer - 1,
				answer + 2
			]
		};
	}
});
const equalsFamilies = {
	eqmiss: equals("See-saw with a missing number (to 10)", KEYS.miss),
	eqswap: equals("Swapping the two numbers of a sum", KEYS.swap),
	eqboth: equals("See-saw with two numbers on each side (to 20)", KEYS.both),
	eqsub: equals("See-saw with taking away", KEYS.sub),
	eqtf: equals("True or false: is the see-saw level?", KEYS.tf)
};
/** An equals-sign question read back from its parts (["Level", "see-saw:", "8", "=", "5", "+", "?"]): its answer and key, or null when it isn't one. */
function solveEquals(parts) {
	if (!parts.some((x) => x === "see-saw:" || x === "false?")) return null;
	for (const family of Object.values(equalsFamilies)) for (const key of family.keys) {
		const n = equalsNumbers(key);
		const made = family.make(key, n);
		if (made && made.parts.length === parts.length && made.parts.every((x, k) => x === parts[k])) return {
			answer: made.answer,
			key
		};
	}
	return null;
}
const countingTyped = (key, n) => {
	if (key.startsWith("give:")) return {
		parts: [
			"Count",
			"out",
			String(n[0]),
			"berries:",
			"how",
			"many?"
		],
		spoken: `Count out ${n[0]} berries. How many is that?`,
		answer: n[0]
	};
	if (key.startsWith("counton:")) return {
		parts: [
			"Plate",
			"of",
			String(n[0]),
			"and",
			"one",
			"more:",
			"how",
			"many?"
		],
		spoken: `A plate of ${n[0]} berries and one more. How many now?`,
		answer: n[0] + 1
	};
	const layout = key.split(":")[2];
	return {
		parts: [
			"Count",
			String(n[0]),
			...layout ? [layout] : [],
			"berries:",
			"how",
			"many?"
		],
		spoken: `Count the ${n[0]} berries. How many are there?`,
		answer: n[0]
	};
};
const counting = (label, keys) => ({
	label,
	curriculumTags: [],
	keys,
	roll: (key) => countNumbers(key),
	make: (key, params) => {
		const n = countNumbers(key);
		if (!keys.includes(key) || n.length !== params.length || n.some((x, i) => x !== params[i])) return null;
		const { parts, spoken, answer } = countingTyped(key, n);
		return {
			parts,
			spoken,
			answer,
			wrong: [
				answer + 1,
				answer - 1,
				answer + 2,
				answer - 2
			]
		};
	}
});
const countingFamilies = {
	give: counting("Giving exactly N (count out a set)", COUNT_KEYS.give),
	howMany: counting("How many berries? (count a set, 1 to 10)", COUNT_KEYS.howmany),
	countOn: counting("One more (count on from a covered plate)", COUNT_KEYS.counton),
	across: counting("How many berries? (11 to 20, past ten)", COUNT_KEYS.across)
};
/** A counting question read back from its parts (["Count", "out", "6", "berries:", "how", "many?"]): its answer and key, or null when it isn't one. */
function solveCounting(parts) {
	if (!parts.some((x) => x === "berries:" || x === "more:")) return null;
	for (const family of Object.values(countingFamilies)) for (const key of family.keys) {
		const made = family.make(key, countNumbers(key));
		if (made && made.parts.length === parts.length && made.parts.every((x, k) => x === parts[k])) return {
			answer: made.answer,
			key
		};
	}
	return null;
}
const ROWS_KEYS = range$5(2, 5).flatMap((r) => range$5(2, 10).map((c) => `rows:${r}x${c}`));
const TURN_PAIRS = range$5(2, 6).flatMap((r) => range$5(2, 6).filter((c) => c !== r).map((c) => [r, c]));
const SHARE_KEYS = [
	2,
	3,
	4,
	5,
	10
].flatMap((r) => range$5(2, 7).map((a) => `share:${r * a}/${r}`));
const CUT_KEYS = range$5(6, 9).flatMap((r) => range$5(3, 9).map((c) => `cut:${r}x${c}`));
const keyPair = (key) => {
	const m = /(\d+)[x/](\d+)$/.exec(key);
	return [Number(m[1]), Number(m[2])];
};
const rowsWords = (r, c) => `${r} rows of ${c}`;
const arrayFamily = (label, tag, keys, parts, spoken, answer, wrong) => ({
	label,
	curriculumTags: [tag],
	keys,
	roll: (key) => keyPair(key),
	make: (key, [a, b]) => {
		if (!keys.includes(key)) return null;
		const [ka, kb] = keyPair(key);
		if (ka !== a || kb !== b) return null;
		return {
			parts: parts(a, b),
			spoken: spoken(a, b),
			answer: answer(a, b),
			wrong: wrong(a, b)
		};
	}
});
const product = (a, b) => a * b;
const arrayFamilies = {
	rows: arrayFamily("Equal rows (4 rows of 6)", "MS.Y2.NUM.OP.P3", ROWS_KEYS, (r, c) => [
		"Plant",
		String(r),
		"rows",
		"of",
		String(c)
	], (r, c) => `Plant ${rowsWords(r, c)}. How many shoots?`, product, (r, c) => [
		r + c,
		(r - 1) * c,
		Number(`${r}${c}`),
		r * c + r
	]),
	turn: arrayFamily("The same array turned round (3 rows of 5 is 5 rows of 3)", "MS.Y2.NUM.OP.P3", TURN_PAIRS.map(([r, c]) => `turn:${r}x${c}`), (r, c) => [
		"Turn",
		String(r),
		"rows",
		"of",
		String(c)
	], (r, c) => `Turn ${rowsWords(r, c)}. How many shoots?`, product, (r, c) => [
		r + c,
		(r - 1) * c,
		Number(`${r}${c}`),
		r * c + c
	]),
	share: arrayFamily("Sharing into equal rows (24 into 4 rows)", "MS.Y3.NUM.OP.P4", SHARE_KEYS, (t, r) => [
		"Share",
		String(t),
		"into",
		String(r),
		"rows"
	], (t, r) => `${t} shoots in ${r} equal rows. How many in each row?`, (t, r) => t / r, (t, r) => [
		t - r,
		t + r,
		r,
		t / r + r
	]),
	cut: arrayFamily("Cutting an array into parts you know (6 rows of 7)", "MS.Y3.NUM.OP.P3", CUT_KEYS, (r, c) => [
		"Cut",
		String(r),
		"rows",
		"of",
		String(c)
	], (r, c) => `Cut ${rowsWords(r, c)} into a row you know and one more. How many shoots?`, product, (r, c) => [
		(r - 1) * c,
		r + c,
		r * c + 6,
		r * c - r
	]),
	which: arrayFamily("Which picture is 3 rows of 5", "MS.Y2.NUM.OP.P3", TURN_PAIRS.map(([r, c]) => `which:${r}x${c}`), (r, c) => [
		"Which",
		"is",
		String(r),
		"rows",
		"of",
		String(c)
	], (r, c) => `Which garden is ${rowsWords(r, c)}?`, product, (r, c) => [
		r + c,
		c * r + r,
		(r - 1) * c,
		Number(`${r}${c}`)
	])
};
const ARRAY_FAMILY_NAMES = Object.keys(arrayFamilies);
/** An equal-rows question read back from its parts (["Plant", "4", "rows", "of", "6"]): its answer and key, or null when it isn't one. */
function solveArray(parts) {
	const nums = parts.filter((p) => /^\d{1,3}$/.test(p)).map(Number);
	if (nums.length !== 2) return null;
	for (const family of Object.values(arrayFamilies)) for (const key of family.keys) {
		const [a, b] = keyPair(key);
		if (a !== nums[0] || b !== nums[1]) continue;
		const made = family.make(key, [a, b]);
		if (made && made.parts.length === parts.length && made.parts.every((x, i) => x === parts[i])) return {
			answer: made.answer,
			key
		};
	}
	return null;
}
const families$2 = {
	...lineFamilies,
	...equalsFamilies,
	...countingFamilies,
	...arrayFamilies,
	tenAnd,
	tenLess,
	tenUp: tenMove(true),
	tenDown: tenMove(false),
	oddEven,
	parts5: partWhole("Parts of 3, 4 and 5 (5 is 2 and 3)", ...PART_WHOLES.parts5),
	parts10: partWhole("Parts of 6 to 10 (7 is 4 and 3)", ...PART_WHOLES.parts10),
	...skipFamilies,
	bond10: bonds("Pairs that make 10", "MS.Y1.NUM.OP.P1", "bond10", 10, 0),
	dblHalf10: doublesHalves("Doubles and halves to 10", "MS.Y1.NUM.OP.P2", 1, 5, 2, 10),
	bond20: bonds("Pairs that make 20", "MS.Y2.NUM.OP.P1", "bond20", 20, 1),
	dblHalf20: doublesHalves("Doubles and halves to 20", "MS.Y2.NUM.OP.P2", 6, 10, 12, 20)
};
const EARLY_FACTS = {
	id: "early-facts",
	label: "Early number facts",
	families: families$2,
	bands: [
		["bond10"],
		["dblHalf10"],
		["bond20"],
		["dblHalf20"]
	],
	ladderOnly: [
		"tenAnd",
		"tenLess",
		"tenUp",
		"tenDown",
		"oddEven",
		"parts5",
		"parts10",
		...SKIP_STEPS.map(({ step }) => `skip${step}`),
		...SKIP_MORE_FAMILY_NAMES,
		...LINE_FAMILY_NAMES,
		...Object.keys(equalsFamilies),
		...ARRAY_FAMILY_NAMES,
		...Object.keys(countingFamilies)
	]
};
const earlyFactsPack = (saved, random, now) => new BandedPack(EARLY_FACTS, saved, random, now);
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
function pick(base, right, named, opts) {
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
//#region shared/maths/skillPacks/bondSkills.ts
/**
* Decimal and fraction bonds (ladder skills `fraction-bonds` and `decimal-bonds`, stage M.5 of docs/BOND-MATCH-PLAN.md): pairs
* that make 1 or 10. Bonds to 10, 20, 100 and 1000 are elsewhere (earlyFacts.ts, placeSkills.ts); tenths that make 1 is
* `addten:to-one` in decimalSkills.ts.
*
* Decimal answers are typed on the pad with the point key; fraction answers are four choices to tap ("5/8"), except the missing
* top number ("3/8 + ?/8 = 1"), which is typed. Wrong choices are the answer a named mistake gives, never a random number.
* Decimals are made from whole numbers of tenths or hundredths (0.35 is 35 hundredths), so no question is made from a number
* that carries floating-point dust. Fractions stay at or under one.
*
* These are asked only by the other maths games. Bond Match never counts towards them (James, 19 and 20 Oct 2026).
*
* Types:
*   fraction-bonds  bondf1:whole  bondf1:missing-top  bondf1:small  bondf1:big  bondf1:take
*   decimal-bonds   bondd1:next-whole  bondd1:hundredths  bondd1:take  bondd10:tenths  bondd10:take
*/
const range$4 = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const notTen$1 = (n) => n % 10 !== 0;
const FRACTION_TAGS = ["MS.Y3.NUM.RN.P6", "MS.Y3.NUM.RN.K6"];
const ALL_DENS = [
	2,
	3,
	4,
	5,
	6,
	8,
	10
];
const SMALL_DENS = [
	3,
	4,
	5
];
const BIG_DENS = [
	6,
	8,
	10
];
/** A top number and bottom number under one: 1/d up to (d - 1)/d. */
const goodFraction = (n, d, dens) => dens.includes(d) && isInt(n, 1, d - 1);
const rollFraction = (r, dens) => {
	const d = pickOne(r, dens);
	return [Math.min(d - 1, 1 + Math.floor(r() * (d - 1))), d];
};
/** The wrong fractions a student gets by following each named mistake, when the answer is (d - n)/d. */
function fractionMistakes(n, d) {
	return {
		"gave the same fraction": frac(n, d),
		"thought a whole is 10 parts": frac(10 - n, 10),
		...d - n + 1 < d ? { "one part too many": frac(d - n + 1, d) } : {},
		"one part too few": frac(d - n - 1, d),
		"used 10 as the bottom number": frac(d - n, 10),
		"made the top number up to 10": frac(10 - n, d),
		"gave one part": frac(1, d)
	};
}
/** "3/8 + ? = 1" (or "? + 3/8 = 1"): tap the fraction that makes 1. */
function pairFamily(key, label, dens) {
	return oneKey(key, label, FRACTION_TAGS, 5, (_k, r) => [
		...rollFraction(r, dens),
		Math.floor(r() * 2),
		...rollPick(r)
	], (_k, [n, d, v, slot, salt]) => {
		if (!goodFraction(n, d, dens) || !isInt(v, 0, 1) || !goodPick(slot, salt)) return null;
		const right = frac(d - n, d);
		const parts = v === 0 ? [
			frac(n, d),
			"+",
			"?",
			"=",
			"1"
		] : [
			"?",
			"+",
			frac(n, d),
			"=",
			"1"
		];
		return pick({
			parts,
			spoken: talk(parts),
			fact: `${frac(n, d)} + ${right} = 1`
		}, right, fractionMistakes(n, d), {
			slot,
			salt
		});
	});
}
const fractionFamilies = [
	oneKey("bondf1:whole", "One whole as a fraction (1 = ?/8)", FRACTION_TAGS, 1, (_k, r) => [pickOne(r, ALL_DENS)], (_k, [d]) => {
		if (!ALL_DENS.includes(d)) return null;
		const parts = [
			"1",
			"=",
			`?/${d}`
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: d
		}, {
			"thought one whole is one part": 1,
			"thought a whole is 10 parts": 10,
			"one part too many": d + 1,
			"one part too few": d - 1,
			"doubled the bottom number": d * 2
		});
	}),
	oneKey("bondf1:missing-top", "The missing top number (3/8 + ?/8 = 1)", FRACTION_TAGS, 3, (_k, r) => [...rollFraction(r, ALL_DENS), Math.floor(r() * 2)], (_k, [n, d, v]) => {
		if (!goodFraction(n, d, ALL_DENS) || !isInt(v, 0, 1)) return null;
		const blank = `?/${d}`;
		const parts = v === 0 ? [
			frac(n, d),
			"+",
			blank,
			"=",
			"1"
		] : [
			blank,
			"+",
			frac(n, d),
			"=",
			"1"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: d - n
		}, {
			"gave the same top number": n,
			"gave the bottom number": d,
			"added the top and bottom": n + d,
			"made the top number up to 10": 10 - n,
			"one part too many": d - n + 1,
			"one part too few": d - n - 1
		});
	}),
	pairFamily("bondf1:small", "Thirds, quarters and fifths that make 1 (1/4 + 3/4)", SMALL_DENS),
	pairFamily("bondf1:big", "Sixths, eighths and tenths that make 1 (3/8 + 5/8)", BIG_DENS),
	oneKey("bondf1:take", "A fraction taken from 1 (1 − 3/8)", FRACTION_TAGS, 4, (_k, r) => [...rollFraction(r, ALL_DENS.slice(1)), ...rollPick(r)], (_k, [n, d, slot, salt]) => {
		if (!goodFraction(n, d, ALL_DENS.slice(1)) || !goodPick(slot, salt)) return null;
		const right = frac(d - n, d);
		const parts = [
			"1",
			"−",
			frac(n, d),
			"=",
			"?"
		];
		return pick({
			parts,
			spoken: talk(parts),
			fact: `1 − ${frac(n, d)} = ${right}`
		}, right, fractionMistakes(n, d), {
			slot,
			salt
		});
	})
];
const DECIMAL_TAGS = ["MS.Y4.NUM.RN.P10", "MS.Y5.NUM.RN.P12"];
/** Hundredths that are not whole tenths (0.01 to 0.99, not 0.3): those are tenths to 1, in add-tenths. */
const HUNDREDTHS = range$4(1, 99).filter(notTen$1);
/** Tenths from 0.1 to 9.9 that are not whole numbers. */
const TENTHS = range$4(1, 99).filter(notTen$1);
/**
* A number of small units (hundredths or tenths) and a target of `whole` such units: the answer is `whole - u`, written with
* `scale` (100 for hundredths, 10 for tenths). Every value is worked out in whole units and only divided at the end.
*/
function decimalBond(u, whole, scale, target) {
	const tens = Math.floor(u / 10);
	const ones = u % 10;
	const answer = whole - u;
	return {
		answer: answer / scale,
		shown: show(u / scale),
		named: {
			"made each digit up to 10": ((10 - tens) * 10 + (10 - ones)) / scale,
			"made each digit up to 9": (whole - 1 - u) / scale,
			"forgot the point": answer,
			"made it up to ten times as much": (whole * 10 - u) / scale,
			"added instead": (target * scale + u) / scale,
			"one too many in the last place": (answer + 1) / scale
		}
	};
}
/** "0.35 + ? = 1" or "? + 0.35 = 1", and the take-away "1 − 0.35 = ?", for one target. */
function decimalFamilies(prefix, word, labels, pool, scale, target) {
	const whole = target * scale;
	return [oneKey(`${prefix}:${word}`, labels[0], DECIMAL_TAGS, 2, (_k, r) => [pickOne(r, pool), Math.floor(r() * 2)], (_k, [u, v]) => {
		if (!pool.includes(u) || !isInt(v, 0, 1)) return null;
		const b = decimalBond(u, whole, scale, target);
		const parts = v === 0 ? [
			b.shown,
			"+",
			"?",
			"=",
			String(target)
		] : [
			"?",
			"+",
			b.shown,
			"=",
			String(target)
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: b.answer,
			input: "decimal"
		}, b.named);
	}), oneKey(`${prefix}:take`, labels[1], DECIMAL_TAGS, 1, (_k, r) => [pickOne(r, pool)], (_k, [u]) => {
		if (!pool.includes(u)) return null;
		const b = decimalBond(u, whole, scale, target);
		const parts = [
			String(target),
			"−",
			b.shown,
			"=",
			"?"
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: b.answer,
			input: "decimal"
		}, b.named);
	})];
}
/** Tenths up to the next whole number, the step that makes 10 easy: 6.3 + ? = 7. Tenth counts 11 to 89 that are not whole. */
const PAST_ONE = range$4(11, 89).filter(notTen$1);
const decimalBondFamilies = [
	oneKey("bondd1:next-whole", "Tenths up to the next whole number (6.3 + ? = 7)", DECIMAL_TAGS, 1, (_k, r) => [pickOne(r, PAST_ONE)], (_k, [u]) => {
		if (!PAST_ONE.includes(u)) return null;
		const next = Math.floor(u / 10) + 1;
		const answer = next * 10 - u;
		const parts = [
			show(u / 10),
			"+",
			"?",
			"=",
			String(next)
		];
		return withMistakes({
			parts,
			spoken: talk(parts),
			answer: answer / 10,
			input: "decimal"
		}, {
			"made it up to the whole number before": (u - Math.floor(u / 10) * 10) / 10,
			"made it up to 10": (100 - u) / 10,
			"forgot the point": answer,
			"made it up to 9 tenths": (answer - 1) / 10,
			"one tenth too many": (answer + 1) / 10,
			"added instead": (next * 10 + u) / 10
		});
	}),
	...decimalFamilies("bondd1", "hundredths", ["Hundredths that make 1 (0.35 + 0.65)", "Hundredths taken from 1 (1 − 0.35)"], HUNDREDTHS, 100, 1),
	...decimalFamilies("bondd10", "tenths", ["Tenths that make 10 (3.4 + 6.6)", "Tenths taken from 10 (10 − 3.4)"], TENTHS, 10, 10)
];
const BOND_FAMILIES = Object.fromEntries([...fractionFamilies, ...decimalBondFamilies].map((f) => [f.keys[0], f]));
const BOND_SKILL_KEYS = {
	"fraction-bonds": [
		"bondf1:whole",
		"bondf1:missing-top",
		"bondf1:small",
		"bondf1:big",
		"bondf1:take"
	],
	"decimal-bonds": [
		"bondd1:next-whole",
		"bondd1:hundredths",
		"bondd1:take",
		"bondd10:tenths",
		"bondd10:take"
	]
};
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
		return pick({
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
		return pick({
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
			prompt: AS_DECIMAL,
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
		return pick({
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
			prompt: AS_DECIMAL,
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
		return pick({
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
		return pick({
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
		return pick({
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
			prompt: AS_DECIMAL,
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
		return pick({
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
		return pick({
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
		return pick({
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
/**
* "p% of ? = x": the whole from a percentage. New questions roll the part x as a multiple of `step`, so the whole is a
* tidy round number (25% of ? = 35 → 140, not 25% of ? = 37 → 148). Any whole number part in range still makes a question,
* so questions rolled before this change keep working.
*/
function wholeFamily$1(key, label, p, xLo, xHi, step = 1) {
	return oneKey(key, label, OF_TAGS, 1, (_k, r) => [step * int(r, Math.ceil(xLo / step), Math.floor(xHi / step))], (_k, [x]) => {
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
	return pick({
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
		prompt: AS_DECIMAL,
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
	wholeFamily$1("pct:whole:fifty", "The whole from 50% (50% of ? = 15)", 50, 5, 60, 5),
	wholeFamily$1("pct:whole:quarter", "The whole from 25% (25% of ? = 15)", 25, 3, 40, 5)
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
	...FDP_FAMILIES,
	...BOND_FAMILIES
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
	...FDP_SKILL_KEYS,
	...BOND_SKILL_KEYS
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
* that owns those keys. Skills with `built: true` are stubs for the later stages: they hold
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
		id: "parts-5",
		label: "Parts of numbers to 5",
		stage: "early-facts",
		curriculumTags: ["MS.Y1.NUM.OP.P1"],
		keys: earlyKeys("parts5"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "parts-10",
		label: "Parts of numbers to 10",
		stage: "early-facts",
		curriculumTags: ["MS.Y1.NUM.OP.P1"],
		keys: earlyKeys("parts10"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
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
		keys: [...earlyKeys("tenAnd"), ...earlyKeys("tenLess")],
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
	...SKIP_STEPS.map(({ step, word }) => ({
		id: `skip-${step}`,
		label: `Counting in ${word}`,
		stage: "early-facts",
		curriculumTags: [],
		keys: earlyKeys(`skip${step}`),
		built: true,
		inWarmUp: false
	})),
	{
		id: "odd-even",
		label: "Odd and even numbers to 20",
		stage: "early-facts",
		curriculumTags: ["MS.Y2.NUM.OP.P2"],
		keys: earlyKeys("oddEven"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	...SKIP_MORE_STEPS.map(({ step, word }) => ({
		id: `skip-${step}`,
		label: `Counting in ${word}`,
		stage: "early-facts",
		curriculumTags: [],
		keys: earlyKeys(`skip${step}`),
		built: true,
		inWarmUp: false,
		inAuto: false
	})),
	{
		id: "skip-10-past-100",
		label: "Counting in tens past 100",
		stage: "early-facts",
		curriculumTags: [],
		keys: earlyKeys("skip10h"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "skip-from",
		label: "Counting on from a start (3, 13, 23)",
		stage: "early-facts",
		curriculumTags: [],
		keys: SKIP_FROM_STEPS.flatMap(({ step }) => earlyKeys(`skip${step}o`)),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "ten-more-less-teens",
		label: "Ten more and ten less (14 + 10, 24 − 10)",
		stage: "early-facts",
		curriculumTags: ["MS.Y1.NUM.OP.P6"],
		keys: [...earlyKeys("tenUp"), ...earlyKeys("tenDown")],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "number-line-100",
		label: "The number line to 100",
		stage: "place-value",
		curriculumTags: ["MS.Y3.NUM.NS.P1"],
		keys: [
			...earlyKeys("place100"),
			...earlyKeys("read100"),
			...earlyKeys("near10"),
			...earlyKeys("zoom")
		],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "ten-more-less",
		label: "Ten more and ten less",
		stage: "place-value",
		curriculumTags: ["MS.Y3.NUM.NS.P1"],
		keys: earlyKeys("tens100"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "number-line-1000",
		label: "The number line to 1000",
		stage: "place-value",
		curriculumTags: ["MS.Y4.NUM.NS.P1"],
		keys: [
			...earlyKeys("place1000"),
			...earlyKeys("read1000"),
			...earlyKeys("near100")
		],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "balance-10",
		label: "The equals sign: a missing number to 10",
		stage: "early-facts",
		curriculumTags: [],
		keys: [...earlyKeys("eqmiss"), ...earlyKeys("eqswap")],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "balance-20",
		label: "The equals sign: two numbers each side, and taking away",
		stage: "early-facts",
		curriculumTags: [],
		keys: [...earlyKeys("eqboth"), ...earlyKeys("eqsub")],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "true-false",
		label: "The equals sign: true or false",
		stage: "early-facts",
		curriculumTags: [],
		keys: earlyKeys("eqtf"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "bundles-50",
		label: "Bundles of ten and tens and ones to 50",
		stage: "place-value",
		curriculumTags: ["MS.Y2.NUM.NS.P1"],
		keys: [...earlyKeys("pvbuild"), ...earlyKeys("pvread")].filter((k) => Number(/(\d+)$/.exec(k)[1]) <= 50),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "place-value-100",
		label: "Tens and ones to 100, and zero",
		stage: "place-value",
		curriculumTags: ["MS.Y2.NUM.NS.P1"],
		keys: [...[...earlyKeys("pvbuild"), ...earlyKeys("pvread")].filter((k) => Number(/(\d+)$/.exec(k)[1]) > 50), ...earlyKeys("pvzero")],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "regroup-100",
		label: "Tying and untying bundles",
		stage: "place-value",
		curriculumTags: ["MS.Y2.NUM.NS.P2"],
		keys: earlyKeys("pvregroup"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "ten-more-less-100",
		label: "Ten more and ten less with bundles",
		stage: "place-value",
		curriculumTags: ["MS.Y2.NUM.NS.P1"],
		keys: earlyKeys("pvten"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "place-value-1000",
		label: "Hundreds, tens and ones",
		stage: "place-value",
		curriculumTags: ["MS.Y3.NUM.NS.P1"],
		keys: [
			...earlyKeys("pvbuild3"),
			...earlyKeys("pvread3"),
			...earlyKeys("pvhun")
		],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "equal-rows",
		label: "Equal rows (4 rows of 6)",
		stage: "early-facts",
		curriculumTags: ["MS.Y2.NUM.OP.P3"],
		keys: earlyKeys("rows"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "arrays-turn",
		label: "Turning an array round",
		stage: "early-facts",
		curriculumTags: ["MS.Y2.NUM.OP.P3"],
		keys: [...earlyKeys("turn"), ...earlyKeys("which")],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "sharing-rows",
		label: "Sharing into equal rows",
		stage: "early-facts",
		curriculumTags: ["MS.Y3.NUM.OP.P4"],
		keys: earlyKeys("share"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "cut-arrays",
		label: "Cutting an array into known parts",
		stage: "early-facts",
		curriculumTags: ["MS.Y3.NUM.OP.P3"],
		keys: earlyKeys("cut"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "count-out-10",
		label: "Counting out and counting a set to 10",
		stage: "early-facts",
		curriculumTags: [],
		keys: [...earlyKeys("give").filter((k) => Number(k.slice(6)) <= 10), ...earlyKeys("howMany")],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "count-out-20",
		label: "Counting out and counting a set to 20",
		stage: "early-facts",
		curriculumTags: [],
		keys: [...earlyKeys("give").filter((k) => Number(k.slice(6)) > 10), ...earlyKeys("across")],
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	{
		id: "count-on",
		label: "One more: counting on from a covered plate",
		stage: "early-facts",
		curriculumTags: [],
		keys: earlyKeys("countOn"),
		built: true,
		inWarmUp: false,
		inAuto: false
	},
	tables[0],
	generated("bonds-100", "Pairs that make 100", "place-value", GENERATED_SKILL_KEYS["bonds-100"], "MS.Y3.NUM.OP.P1"),
	tables[1],
	generated("round-10-100", "Rounding to the nearest 10 and 100", "rounding", GENERATED_SKILL_KEYS["round-10-100"], "MS.Y3.NUM.NS.P5"),
	generated("bonds-1000", "Hundreds that make 1000", "place-value", GENERATED_SKILL_KEYS["bonds-1000"]),
	generated("unit-fraction-of", "A fraction of an amount (⅓ of 15)", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["unit-fraction-of"], "MS.Y3.NUM.RN.P7"),
	generated("fraction-bonds", "Fractions that make 1 (⅜ + ⅝)", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["fraction-bonds"], "MS.Y3.NUM.RN.P6", "MS.Y3.NUM.RN.K6"),
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
	generated("decimal-bonds", "Decimals that make 1 and 10 (0.35 + 0.65)", "fractions-decimals-percentages", GENERATED_SKILL_KEYS["decimal-bonds"], "MS.Y4.NUM.RN.P10", "MS.Y5.NUM.RN.P12"),
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
* Jumping ahead (James, 22 Oct 2026): a student whose records show a times-table skill secure (70% of its times facts in box 2
* or higher) is past every easier skill below it, even ones they have never been asked: someone who knows ×3, ×4 and ×8 isn't
* kept on bonds to 10. Only times-table skills count, as they are big (30 to 60 facts) so a lucky run can't do it, and only their
* times facts, so a class with division off (or a student who hasn't met it yet) jumps all the same. Returns the index just
* after the highest such skill, or 0.
*/
function tablesJumpFloor(byKey, enabled = TABLES) {
	let jump = 0;
	LADDER.forEach((skill, index) => {
		if (!skill.built || skill.stage !== "times-tables") return;
		const times = activeKeys(skill, enabled, false).filter((k) => k.startsWith("mul:"));
		if (times.length === 0) return;
		if (times.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / times.length >= .7) jump = index + 1;
	});
	return jump;
}
/**
* Where a student is on the ladder, worked out from their records: the first built skill that
* isn't secure yet (70% of its facts in box 2 or higher, the same rule as the times-table
* campaign) is the one they're on. A skill with all its tables switched off is left out: it never becomes the
* current skill and doesn't count towards progress (it shows as 'upcoming' with a share of 1). With a `floor` (placement or the furthest place reached, see place.ts) the
* built skills before it are behind the student (passed over, and secure only if their records say so), so forgetting a fact brings more review but never
* drops the student's place below the floor.
*/
function ladderProgress(stats, opts = {}) {
	const byKey = new Map([...stats].map((s) => [s.key, s]));
	const enabled = opts.enabledTables ?? TABLES;
	let current = null;
	let secureCount = 0;
	let builtCount = 0;
	const floor = Math.max(opts.floor ?? 0, tablesJumpFloor(byKey, enabled));
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
			const share = keys.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / keys.length;
			if (skill.inAuto === false) return {
				skill,
				status: "secure",
				share,
				passedOver: share < STEP_SECURE_SHARE
			};
			builtCount++;
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
	const live = progress.skills.filter((p) => p.skill.built && p.skill.inAuto !== false).map((p) => ({
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
		review: LADDER.slice(0, LADDER.indexOf(chosen[0])).filter((s) => s.built && (s.inAuto !== false || chosen[0].inAuto === false)).flatMap(keysOf).filter((k) => !mine.has(k)),
		stretch: []
	};
}
/** Which skill pack records a mastery key ("mul:7x8" → "times-tables"), or null if it isn't a ladder key. */
function packIdOfKey(key) {
	if (/^mul:\d+x\d+$/.test(key)) return "times-tables";
	if (/^(rows|turn|share|cut|which):/.test(key)) return "early-facts";
	if (isGeneratedKey(key)) return "generated";
	if (/^eq(miss|swap|both|sub|tf):/.test(key)) return "early-facts";
	if (/^(give|howmany|counton|across):/.test(key)) return "early-facts";
	if (/^(bond10|bond20|dbl|half|tenand|tenless|tenup|tendown|skip\d+(?:o\d+|h)?|part\d+|oddeven|place100|read100|tens100|near10|near100|zoom|place1000|read1000|pvbuild3?|pvread3?|pvzero|pvregroup|pvten|pvhun):/.test(key)) return "early-facts";
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
const NO_LADDER = {
	on: false,
	placed: null,
	placement: null,
	furthest: null
};
const ID = /^[a-z0-9-]{1,40}$/;
const skillId = (v) => typeof v === "string" && ID.test(v) && LADDER.some((s) => s.id === v && s.built) ? v : null;
function parseLadderInfo(raw) {
	if (!raw || typeof raw !== "object") return NO_LADDER;
	const r = raw;
	const placement = skillId(r.placement);
	const placed = r.placed === "skipped" ? "skipped" : r.placed === "done" && placement ? "done" : null;
	return {
		on: r.on === true,
		placed,
		placement: placed === "done" ? placement : null,
		furthest: skillId(r.furthest)
	};
}
const indexOfSkill = (id) => id ? LADDER.findIndex((s) => s.id === id) : -1;
/** The floor under a student's place: an index into `LADDER`. */
function floorRank(info) {
	const start = info.placed === "done" ? indexOfSkill(info.placement) : -1;
	return Math.max(0, start, indexOfSkill(info.furthest));
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
/** Splits answers by the pack that keeps their record (times tables, early facts, adding, division, generated skills). */
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
function sumKeys(p, q, total, tenLess = false) {
	const keys = [];
	const lo = Math.min(p, q);
	const hi = Math.max(p, q);
	keys.push(`add:${lo}+${hi}`);
	if (total === 10) keys.push(`bond10:${lo}+${hi}`);
	if (total === 20) keys.push(`bond20:${lo}+${hi}`);
	if (p === q) keys.push(`dbl:${p}`);
	if (hi === 10 && lo >= 1 && lo <= 9) keys.push(`${tenLess ? "tenless" : "tenand"}:${lo}`);
	if (lo === 10 && hi >= 10 && hi <= 19) keys.push(`tenup:${hi}`, `tendown:${hi + 10}`);
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
	const skip = solveSkip(p);
	if (skip) return isFocusKey(skip.key) ? {
		answer: skip.answer,
		keys: [skip.key]
	} : null;
	const part = solvePart(p);
	if (part) return isFocusKey(part.key) ? {
		answer: part.answer,
		keys: [part.key]
	} : null;
	const oddEven = solveOddEven(p);
	if (oddEven) return isFocusKey(oddEven.key) ? {
		answer: oddEven.answer,
		keys: [oddEven.key]
	} : null;
	const equals = solveEquals(p);
	if (equals) return isFocusKey(equals.key) ? {
		answer: equals.answer,
		keys: [equals.key]
	} : null;
	const counting = solveCounting(p);
	if (counting) return isFocusKey(counting.key) ? {
		answer: counting.answer,
		keys: [counting.key]
	} : null;
	const line = solveLine(p);
	if (line) return isFocusKey(line.key) ? {
		answer: line.answer,
		keys: [line.key]
	} : null;
	const array = solveArray(p);
	if (array) return isFocusKey(array.key) ? {
		answer: array.answer,
		keys: [array.key]
	} : null;
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
			if (whole(addendA) && whole(addendB)) keys = sumKeys(addendA, addendB, total, z !== "?");
		} else if (op === "−") {
			if (z === "?") {
				answer = a - b;
				if (whole(answer)) keys = sumKeys(b, answer, a, true);
			} else if (y === "?") {
				answer = a - c;
				if (whole(answer)) keys = sumKeys(c, answer, a, true);
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
//#region shared/maths/focusResults.ts
/**
* What the game servers tell the database about answers given while a maths focus ran (docs/MATHS-FOCUS-PLAN.md, "Stage F.8
* results"). The database matches each answer to the focuses that were running at its time; the server works out the two
* things only the maths code knows: which ladder skills own the answer's key, and whether it was quick.
*/
let owners = null;
/** The ladder skills that own a mastery key (usually one). Empty if the key isn't on the ladder. */
function skillsOfKey(key) {
	if (!owners) {
		owners = new Map();
		for (const skill of LADDER) for (const k of skill.keys) owners.set(k, [...owners.get(k) ?? [], skill.id]);
	}
	return owners.get(key) ?? [];
}
/** The answers worth sending: those on a ladder skill. */
function focusResultAnswers(answers, pack) {
	const quickMs = quickMsForPack(pack);
	const out = [];
	for (const a of answers) {
		const skills = skillsOfKey(a.key);
		if (skills.length > 0) out.push({
			skills,
			at: a.at,
			correct: a.correct,
			quick: a.correct && a.ms <= quickMs
		});
	}
	return out;
}
//#endregion
//#region supabase/functions/_shared/focusResults.ts
/**
* Adds a batch of answers to the results of the maths focuses running for the student (stage F.8). Call it only for a batch the
* records took for the first time (record_fact_answers says 0 for one it has seen), so a retry never counts twice. It never
* throws and never blocks saving: the answers are already saved, and a problem here is only logged (the code, never who).
*/
async function countForFocuses(rpc, player, pack, answers, from) {
	try {
		const rows = focusResultAnswers(answers, pack);
		if (rows.length === 0) return;
		const { error } = await rpc("add_maths_focus_results", {
			player,
			answers: rows
		});
		if (error) console.error(`${from}: focus results not counted (${error.code ?? "unknown"})`);
	} catch {
		console.error(`${from}: focus results not counted`);
	}
}
//#endregion
//#region supabase/functions/_shared/recordAnswers.ts
/** A UUID made from text: the same text always gives the same id, so a save sent twice is one batch. */
async function batchIdFor(text) {
	const hex = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`maths-answers:${text}`))).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
/**
* Saves answers the server has marked, the one approved way (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.1 rule 6):
* split by the pack that keeps each record, one batch per pack with an id made from `once` (something unique to this
* save, such as the run's seed and the question's slot), each pack's own quick time, times kept to at most two
* minutes (`keptMs`), and the running maths focuses'
* results counted for a batch the records took for the first time, so a retry never counts twice.
* It never throws: a problem is logged with its code (never who) and the game goes on.
*/
async function recordMathsAnswers(rpc, player, answers, once, from, batchId = (o, pack) => batchIdFor(`${from}:${o}:${pack}`), quickMs) {
	const result = {
		saved: 0,
		failed: 0
	};
	for (const [pack, group] of groupByPack(answers)) try {
		const { data, error } = await rpc("record_fact_answers", {
			player,
			pack,
			batch_id: await batchId(once, pack),
			answers: group.map((a) => ({
				...a,
				ms: keptMs(a.ms)
			})),
			quick_ms: quickMs ?? quickMsForPack(pack),
			fluent_days: 2,
			top_box: 4
		});
		if (error) {
			result.failed++;
			console.error(`${from}: record answers failed (${error.code ?? "unknown"})`);
			continue;
		}
		const saved = typeof data === "number" ? data : 0;
		result.saved += saved;
		if (saved > 0) await countForFocuses(rpc, player, pack, group, from);
	} catch {
		result.failed++;
		console.error(`${from}: record answers failed`);
	}
	return result;
}
//#endregion
//#region supabase/functions/_shared/signIn.ts
/**
* Who owns this sign-in token? Null if it's missing, expired, fake or not a signed-in user's.
*
* With the project's newer sign-in keys, the token's signature is checked right here against the
* project's public keys (fetched once and kept for 10 minutes), with no trip to the sign-in
* service. With the older shared secret (or a token signed with a key we don't know), the library
* asks the sign-in service instead, exactly as `getUser` did. So this works the same before and
* after the keys are switched in the Supabase dashboard; it only gets cheaper after.
*/
function userIdFromToken(auth) {
	return async (token) => {
		try {
			const { data, error } = await auth.getClaims(token);
			const claims = error ? null : data?.claims;
			if (!claims || claims.role !== "authenticated" || typeof claims.sub !== "string" || !claims.sub) return null;
			return claims.sub;
		} catch {
			return null;
		}
	};
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
//#region shared/maths/serverQuestions.ts
/**
* For games whose server makes the maths questions and marks them itself (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.2 A):
* a random number generator made from a text seed, so the server can make the same questions again, and the part of a
* question the browser may see (never its answer).
*
* Moved here from shared/marble/questions.ts (20 Oct 2026) so Clan Quest's Battle Cry makes its questions the same way;
* Marble's file re-exports them, so nothing about a Marble run changed.
*
* `seededRandom` gives exactly the same numbers as Marble Rush's own copy (shared/marble/maths.ts on its branch), so
* Marble can switch to this one without any run changing.
*/
function hashSeed(text) {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
/** A small seeded random number generator (numbers from 0 up to 1). The same text always gives the same numbers. */
function seededRandom(text) {
	let a = hashSeed(text);
	return () => {
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function publicQuestion(q, slot) {
	return {
		slot,
		parts: q.parts,
		spoken: q.spoken,
		...q.prompt ? { prompt: q.prompt } : {},
		...q.choices ? { choices: q.choices } : {},
		...q.choiceLabels ? { choiceLabels: q.choiceLabels } : {},
		...q.input ? { input: q.input } : {},
		...q.maxLength ? { maxLength: q.maxLength } : {}
	};
}
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
//#endregion
//#region shared/decree/config.ts
/**
* Every number in Royal Decree (docs/DECREE-PLAN.md), so the rules, How to play and the simulator read the same ones.
*/
/** The four things a ruler keeps an eye on. */
const METERS = [
	"food",
	"gold",
	"happy",
	"safe"
];
/** Points: 1 for any reign, +1 for each year lived through (beyond the first), +1 for a full reign; at most 5. */
const POINTS = {
	played: 1,
	perYear: 1,
	yearsCounted: 3,
	full: 1
};
//#endregion
//#region shared/decree/cards.ts
/** Build a Choice from [food, gold, happy, safe]. */
function ch(label, fx, reply, sets) {
	const names = [
		"food",
		"gold",
		"happy",
		"safe"
	];
	const effect = {};
	names.forEach((m, i) => {
		if (fx[i] !== 0) effect[m] = fx[i];
	});
	const c = {
		label,
		effect
	};
	if (reply) c.reply = reply;
	if (sets) c.sets = sets;
	return c;
}
/** Build a Card: `no` is the left swipe, `yes` the right. */
function card(id, who, text, no, yes, extra = {}) {
	return {
		id,
		who,
		text,
		no,
		yes,
		...extra
	};
}
const CARDS = [
	card("steward-roof", "steward", "The roof leaks in 4 rooms. Bram says fixing them costs 40 gold coins.", ch("Use buckets", [
		0,
		1,
		-1,
		0
	], "Plink. Plonk. Plink. The buckets are playing a song."), ch("Fix the roof", [
		0,
		-2,
		1,
		1
	], "Lovely and dry! Even the spiders say thanks.")),
	card("steward-flags", "steward", "We have 9 old flags. Shall we sew one big new flag for the town fair?", ch("Keep the old ones", [
		1,
		1,
		-1,
		0
	], "Hale pats the flags. They fall apart a little."), ch("Big new flag!", [
		0,
		-1,
		1,
		0
	], "It is so big, three people got lost inside it.")),
	card("reeve-seeds", "reeve", "I need 50 bags of seed to plant the big field. Peas, mostly.", ch("Plant less", [
		-1,
		1,
		0,
		0
	], "Marigold sighs. The field looks a bit bald."), ch("Buy the seed", [
		2,
		-2,
		0,
		0
	], "Pea-rfect! Sorry. Pea-rfect!")),
	card("reeve-crows", "reeve", "Crows ate 30 of my turnips! Can we build a very scary scarecrow?", ch("Share with crows", [
		-1,
		0,
		1,
		0
	], "The crows sent a thank-you feather. Very polite."), ch("Build one", [
		2,
		-1,
		0,
		0
	], "The scarecrow is so scary that even I jumped.")),
	card("ratcatcher-rats", "ratcatcher", "There are 20 rats in the pantry! I have a plan with lots of cheese.", ch("They seem polite", [
		-1,
		0,
		1,
		0
	], "One rat is wearing a tiny hat. I cannot catch him now."), ch("Use the plan", [
		2,
		-1,
		0,
		0
	], "Done! The rats moved to the barn. They left a note.")),
	card("ratcatcher-flute", "ratcatcher", "My magic flute makes rats follow me out of town. It costs 15 gold.", ch("Too loud", [
		-1,
		1,
		0,
		0
	], "Nettle puts the flute away. A rat sighs sadly."), ch("Play the flute", [
		2,
		-2,
		1,
		0
	], "Everyone danced. Even the rats. Even the cat. Rude cat.")),
	card("trader-cheese", "trader", "I will pay 30 gold for 20 wheels of your best cheese.", ch("Keep the cheese", [
		1,
		0,
		-1,
		0
	], "Quince sulks and counts his coins twice."), ch("Sell the cheese", [
		-2,
		2,
		0,
		0
	], "A good deal! The mice are very upset.")),
	card("trader-road", "trader", "A new road to the next town brings 5 more shops. It costs 25 gold.", ch("No new road", [
		0,
		1,
		-1,
		0
	], "The old road is bumpy. Quince calls it \"cosy\"."), ch("Build the road", [
		1,
		-2,
		1,
		0
	], "Five new shops! One only sells hats for dogs.")),
	card("healer-soup", "healer", "30 people have the sniffles. I need a giant pot of onion soup!", ch("Hanky time", [
		1,
		0,
		0,
		-1
	], "ATCHOO! That one was a whopper."), ch("Make the soup", [
		-1,
		0,
		1,
		1
	], "Everyone cried a bit from the onions. Then felt better.")),
	card("healer-garden", "healer", "A herb garden would grow 8 kinds of medicine plants. Mint is my favourite.", ch("Not now", [
		0,
		1,
		0,
		-1
	], "Rowan sniffs a dried leaf and sighs."), ch("Plant it", [
		1,
		-1,
		0,
		2
	], "Smells so minty that the whole town breathes better.")),
	card("builder-bridge", "builder", "The river bridge has 3 loose planks. Fix it now, or wait for spring?", ch("Hop over them", [
		0,
		1,
		0,
		-2
	], "Boing! Bram counts four people who fell in."), ch("Fix it now", [
		0,
		-1,
		0,
		2
	], "Smooth as a pancake. A very wooden pancake.")),
	card("builder-slide", "builder", "Can I build a 10-metre slide down the castle hill? Just for fun!", ch("Too slippery", [
		0,
		1,
		-1,
		0
	], "Bram pats the hill. It looks disappointed."), ch("Build the slide!", [
		0,
		-2,
		2,
		-1
	], "WHEEEE! Hale went down 11 times. Hale says he was \"inspecting\".")),
	card("builder-gap", "builder", "The town wall has 5 gaps. Sheep keep walking through to say hello.", ch("Welcome, sheep", [
		1,
		1,
		0,
		-1
	], "Baaa. Hello sheep."), ch("Patch the gaps", [
		0,
		-2,
		0,
		2
	], "The sheep are cross. One baa-ed rudely.")),
	card("baker-pies", "baker", "I need 12 sacks of flour for 60 pies. The whole town smells hungry!", ch("Not today", [
		0,
		1,
		-1,
		0
	], "Pip eats a pie to feel better. Just one. Maybe two."), ch("Yes, bake them!", [
		2,
		-2,
		0,
		0
	], "Sixty pies! One has a surprise inside. It is a sock.")),
	card("baker-bell", "baker", "My new oven rings a bell when bread is ready. It rings at 4 in the morning.", ch("Quiet bread", [
		-1,
		0,
		1,
		0
	], "Pip tiptoes. The bread sulks in the oven."), ch("Keep the bell", [
		1,
		0,
		-1,
		0
	], "DING! The whole street is awake and very hungry.")),
	card("baker-pumpkin", "baker", "Moss has a pumpkin as big as a cart. It could make 100 pies!", ch("Save the seeds", [
		1,
		0,
		-1,
		0
	], "Pip is sad. But the seeds are very nice."), ch("Pumpkin pie party", [
		3,
		-2,
		1,
		0
	], "Pie for everyone! One slice was shaped like a cat."), {
		needs: "giant-pumpkin",
		from: 8
	}),
	card("baker-sprinkles", "baker", "I want 5 jars of rainbow sprinkles for the birthday cakes. Pretty please?", ch("Plain cakes", [
		0,
		1,
		-1,
		0
	], "Plain cakes. Pip pretends it is fine. It is not fine."), ch("Add sprinkles", [
		0,
		-1,
		1,
		0
	], "The cakes sparkle! The cat sparkled too, by accident.")),
	card("fisher-catch", "fisher", "I caught 40 fish and one very grumpy boot!", ch("Sell the fish", [
		-1,
		2,
		0,
		0
	], "Fish for sale! The boot is not for sale. It is Tama's now."), ch("Share them", [
		2,
		-1,
		1,
		0
	], "Fish for supper! The boot got a bath.")),
	card("fisher-storm", "fisher", "Dark clouds are coming! Should the boats stay in the harbour for 3 days?", ch("Fish anyway", [
		2,
		0,
		0,
		-2
	], "Splash! The fish were great. The wet socks were not."), ch("Stay safe", [
		-2,
		0,
		0,
		2
	], "Everyone plays cards in the boats. Tama wins 17 times.")),
	card("fisher-net", "fisher", "My net has 7 holes. Mostly the fish use them to wave goodbye.", ch("Patch it up", [
		-1,
		1,
		0,
		0
	], "Tama ties a knot. Then another. Then eleven more."), ch("Buy a new net", [
		2,
		-1,
		0,
		0
	], "The new net is so big it caught a small island.")),
	card("knight-boots", "knight", "3 knights want new boots. Our old ones let in puddles.", ch("Puddle patrol", [
		0,
		1,
		-1,
		-1
	], "Squelch squelch squelch. The knights march sadly."), ch("Buy boots", [
		0,
		-2,
		1,
		1
	], "Shiny boots! Sir Ash jumped in a puddle on purpose.")),
	card("knight-joust", "knight", "May we hold a jousting day? Two teams, 20 hobby horses, no real horses!", ch("Not this year", [
		0,
		1,
		-1,
		0
	], "Sir Ash trots away sadly on his hobby horse."), ch("Joust away!", [
		0,
		-1,
		2,
		0
	], "The winning horse was a stick. He got a medal.")),
	card("knight-armour", "knight", "My armour squeaks when I walk. Squeak, squeak, squeak, all day!", ch("Squeak on", [
		0,
		0,
		1,
		-1
	], "Squeak. Every thief hears him coming. Maybe that is good."), ch("Oil the armour", [
		0,
		-1,
		-1,
		1
	], "Sir Ash sneaks up behind Hale. Hale screams. Oops.")),
	card("wizard-rain", "wizard", "I can make it rain for 5 days. The crops are thirsty and so am I.", ch("Skip the rain", [
		-1,
		0,
		1,
		0
	], "Old Fern sulks. A small grey cloud follows him anyway."), ch("Make it rain", [
		2,
		0,
		-1,
		0
	], "Splash! Everyone's hair goes frizzy. The crops cheer.")),
	card("wizard-frogs", "wizard", "Oops! I turned 6 guards into frogs. Only for an hour, I think.", ch("Turn them back", [
		0,
		0,
		-1,
		1
	], "Pop! Six guards, slightly green, very embarrassed."), ch("Let them hop", [
		0,
		0,
		1,
		-2
	], "Ribbit! The frogs did a great show. The gate is open.")),
	card("wizard-shield", "wizard", "A spell can keep the gates strong for a year. It uses 10 gold of sparkle dust.", ch("Save the dust", [
		1,
		1,
		0,
		-1
	], "Old Fern puts the sparkle dust away. Achoo. Sparkles everywhere."), ch("Cast the spell", [
		0,
		-2,
		0,
		2
	], "The gates glow. They hum a happy little tune.")),
	card("goatherd-garden", "goatherd", "My 25 goats want to eat in the royal garden. They asked nicely. Maaa.", ch("Not the roses!", [
		-1,
		0,
		1,
		0
	], "The goats look at the roses. Then at you. Then at the roses."), ch("Let them graze", [
		2,
		0,
		-1,
		0
	], "The garden is trimmed! Moss is crying a bit.")),
	card("goatherd-cheese", "goatherd", "Goat cheese festival! We have 8 kinds of cheese. One is blue and one is bouncy.", ch("No festival", [
		0,
		1,
		-1,
		0
	], "Hettie nibbles the bouncy cheese. It bounces away."), ch("Cheese party!", [
		-1,
		0,
		1,
		0
	], "Everyone ate cheese. Everyone smelled of cheese. Happy cheese.")),
	card("goatherd-curtains", "goatherd", "A goat ate the town hall curtains. She says they were \"crunchy\".", ch("Goat curtains", [
		0,
		1,
		0,
		-1
	], "The new curtains are a bit nibbled. Very stylish."), ch("Buy new ones", [
		0,
		-1,
		1,
		0
	], "New curtains! The goat is looking at them too.")),
	card("jester-show", "jester", "I have a new show with 12 jokes. Three are good and one has a wobbly bit.", ch("No show", [
		1,
		1,
		-1,
		0
	], "Bobbin does one sad cartwheel. Plop."), ch("Big show!", [
		0,
		-1,
		1,
		0
	], "Everyone laughed. At joke number 9, a goat laughed too.")),
	card("jester-cushion", "jester", "I put a squeaky cushion on the throne. May I do it to the whole council too?", ch("Be serious", [
		0,
		0,
		-1,
		1
	], "Bobbin sits on his own cushion. Pffft. He is sad."), ch("Squeak them all!", [
		0,
		0,
		1,
		-1
	], "Pffft! Hale went the colour of a tomato.")),
	card("jester-eggs", "jester", "I can juggle 7 eggs! Please can I borrow 7 eggs?", ch("Boo, no eggs", [
		1,
		0,
		-1,
		0
	], "Bobbin juggles 7 grapes instead. They are rude to him."), ch("Juggle away", [
		-1,
		0,
		1,
		0
	], "He dropped 5 eggs. Omelette day! Splat.")),
	card("smith-shoes", "smith", "I need iron for 40 horseshoes. The horses are walking with their toes out.", ch("Hmm, later", [
		-1,
		1,
		0,
		0
	], "The horses will use socks. Ingrid is not amused."), ch("Order the iron", [
		1,
		-2,
		0,
		1
	], "Clip-clop! The horses are so proud they are prancing.")),
	card("smith-shields", "smith", "The guards need 6 shiny new shields. Their old ones are for the cat's bed.", ch("Old shields do", [
		1,
		1,
		0,
		-1
	], "The guards hold up the cat's bed. The cat stays inside."), ch("Forge shields", [
		0,
		-2,
		0,
		2
	], "Shiny! The guards see themselves in them and wave.")),
	card("smith-bell", "smith", "I made a bell as big as a cow. It goes BONG. It is also quite shiny.", ch("Too loud", [
		0,
		1,
		-1,
		0
	], "Ingrid sulks and gives the bell a tiny tap. bong."), ch("Hang the bell", [
		0,
		-1,
		-1,
		2
	], "BONG! Everyone jumps. The cat falls off the wall.")),
	card("shepherd-lamb", "shepherd", "I counted 100 sheep but 1 is missing! It is on the hill, I think.", ch("It will come back", [
		0,
		1,
		-1,
		0
	], "The lamb wandered home alone. It was a bit embarrassed."), ch("Send a search", [
		0,
		-1,
		1,
		0
	], "Found it! It was in a barrel. It was wearing a barrel.")),
	card("shepherd-wool", "shepherd", "We have 60 bags of wool. Shall we knit warm scarves for winter?", ch("Sell the wool", [
		0,
		2,
		-1,
		0
	], "Kit sighs. The sheep look cold."), ch("Knit the scarves", [
		0,
		-1,
		1,
		1
	], "Everyone has a scarf! The tallest one is 7 metres.")),
	card("shepherd-dog", "shepherd", "A new sheepdog costs 8 gold. She is very bouncy and loves hats.", ch("No dog", [
		-1,
		1,
		0,
		0
	], "The sheep run in circles. Kit runs in circles too."), ch("Get the dog", [
		1,
		-1,
		0,
		0
	], "The dog herded all the sheep into the barn. And the mayor.")),
	card("merchant-spices", "merchant", "I have 15 jars of spice from far away. It makes soup taste like a party!", ch("No, thank you", [
		0,
		1,
		-1,
		0
	], "Lady Saffron sniffs. \"Your soup will stay boring.\""), ch("Buy the spice", [
		1,
		-2,
		1,
		0
	], "Achoo! The soup was so tasty. Everyone sneezed.")),
	card("merchant-silk", "merchant", "Silk sale! 20 gold of silk for just 10. The market will shimmer!", ch("Pass", [
		0,
		1,
		-1,
		0
	], "She puts the silk away. It shimmers sadly in the dark."), ch("Buy silk", [
		-1,
		-1,
		1,
		0
	], "Everyone looked like a rainbow. The cat wore a silk bow tie.")),
	card("inventor-wings", "inventor", "I built wings out of 12 umbrellas! May I test them off the castle tower?", ch("Too high", [
		0,
		0,
		-1,
		1
	], "Cog tests them off a chair. Flap. Flap. Small hop."), ch("Test them!", [
		0,
		0,
		1,
		-2
	], "Whoosh! Cog flew 3 metres and landed in the haystack.", "flying-machine")),
	card("inventor-flight", "inventor", "Cog's wings flew 40 metres and landed in the pond. Fund Wings Mark Two?", ch("Stay on the ground", [
		0,
		1,
		-1,
		0
	], "Cog pats his wings. They drip a bit."), ch("Fund it", [
		0,
		-2,
		1,
		-1
	], "Mark Two has a seat belt and a very tiny cup holder.", "sky-post"), {
		needs: "flying-machine",
		from: 8
	}),
	card("inventor-washer", "inventor", "My machine washes 50 dishes by itself! It also washes the cat. He is not pleased.", ch("Wash by hand", [
		0,
		1,
		-1,
		0
	], "Pip ends up with 50 soapy plates and bubbles in his hair."), ch("Build it", [
		0,
		-1,
		1,
		0
	], "Sparkly plates! The cat is damp and furious, but clean.")),
	card("musician-concert", "musician", "Shall I play in the square? 3 songs, and 1 is very long. It has a dancing bit.", ch("Not today", [
		0,
		0,
		-1,
		1
	], "Lark plays to a pigeon. The pigeon claps."), ch("Play for us!", [
		-1,
		1,
		1,
		0
	], "A snack stall sold out in 5 minutes. Everybody danced.")),
	card("musician-drum", "musician", "A new drum costs 9 gold. The old one has a hole in it and a mouse inside.", ch("Keep the mouse", [
		1,
		1,
		-1,
		0
	], "Boom! Squeak. Boom! Squeak. It is a duet."), ch("Buy the drum", [
		0,
		-1,
		1,
		0
	], "BOOM! The mouse now has a tiny drum of its own.")),
	card("musician-lullaby", "musician", "I wrote a lullaby so 20 babies sleep. The guards might nap too.", ch("No lullaby", [
		0,
		0,
		-1,
		1
	], "The babies cry. The guards wake up. Everyone is cranky."), ch("Play it", [
		0,
		0,
		1,
		-1
	], "Zzz. Even Captain Bryn nodded off at his post.")),
	card("gardener-seed", "gardener", "A magic seed! It might grow a giant pumpkin in 5 days. It drinks 6 buckets a day.", ch("Too thirsty", [
		0,
		1,
		-1,
		0
	], "Moss sets it on the windowsill. It looks at him sadly."), ch("Plant it!", [
		0,
		-1,
		1,
		0
	], "Glug glug. The seed is already making a tiny sprout.", "giant-pumpkin")),
	card("gardener-pumpkin", "gardener", "The pumpkin is as big as a cart! 200 people could eat from it.", ch("Pumpkin contest", [
		-1,
		1,
		2,
		0
	], "Contest day! First prize: a very small trophy shaped like a pumpkin."), ch("Pumpkin soup", [
		3,
		0,
		-1,
		0
	], "A week of soup! Orange moustaches everywhere."), {
		needs: "giant-pumpkin",
		from: 8
	}),
	card("gardener-compost", "gardener", "A compost heap of 30 wheelbarrows grows super veggies. It also stinks.", ch("Smells too bad", [
		-1,
		0,
		1,
		0
	], "Moss holds his nose and walks away. The heap waves."), ch("Dig it in", [
		2,
		0,
		-1,
		0
	], "Phew! But the carrots are as big as my arm.")),
	card("gardener-hedge", "gardener", "May I clip the hedge into a dragon? It will need 40 leaves for scales.", ch("Plain hedge", [
		0,
		1,
		-1,
		0
	], "The hedge stays boring. Moss draws a tiny dragon in the dirt."), ch("Dragon hedge!", [
		0,
		-1,
		1,
		0
	], "It looks so real that Wren says hello to it.")),
	card("captain-night", "captain", "The gates need a 5th guard for the night watch. He snores a bit.", ch("Four is enough", [
		0,
		1,
		0,
		-1
	], "Four guards watch. They sing songs to stay awake."), ch("Hire him", [
		0,
		-1,
		0,
		2
	], "Snore. A new guard stays awake for 20 minutes. Then, snore.")),
	card("captain-parade", "captain", "A parade! 30 guards in a straight line. Mostly straight. Sort of.", ch("No parade", [
		0,
		0,
		-1,
		1
	], "The guards stay on duty. They march on the spot, softly."), ch("March, march!", [
		0,
		0,
		1,
		-1
	], "The line wobbled. Bryn did not notice. Everyone cheered.")),
	card("captain-helmet", "captain", "A seagull stole my helmet! May I send 3 guards to get it back?", ch("Wear a pan", [
		0,
		0,
		-1,
		1
	], "Bryn wears a saucepan. It is quite shiny. It dings."), ch("Chase the gull", [
		0,
		0,
		1,
		-1
	], "Three guards chased a seagull. The seagull won.")),
	card("scholar-shelves", "scholar", "The library needs 3 new shelves. 200 books are sleeping on the floor.", ch("Floor is fine", [
		1,
		1,
		-1,
		0
	], "Ada tiptoes around the books. Squeak. Thud. Oops."), ch("Build shelves", [
		0,
		-2,
		1,
		0
	], "Every book has a bed now. One book is already snoring.")),
	card("scholar-shh", "scholar", "Can we have a \"shh\" rule on Fridays? Only 1 day a week. Whisper time!", ch("No whispering", [
		0,
		0,
		1,
		-1
	], "Loud Friday! The library has a drum solo. Ada hides."), ch("Shh Fridays", [
		0,
		0,
		-1,
		1
	], "Whisper whisper. The whole town sounds like leaves.")),
	card("explorer-map", "explorer", "I found an old map in a bottle. It shows an X near the old oak. 20 steps from the bridge.", ch("Too muddy", [
		1,
		1,
		-1,
		0
	], "Rua puts the map in a frame. It says \"X\". Very nice."), ch("Let's dig!", [
		0,
		-1,
		1,
		-1
	], "Everyone got a shovel. Marigold brought a spoon.", "treasure-map")),
	card("explorer-dig", "explorer", "We dug 3 holes and found an old boot. Shall we dig 2 more holes?", ch("No more holes", [
		0,
		0,
		-1,
		1
	], "Rua fills the holes. The boot stays. It is a good boot."), ch("Dig, dig, dig!", [
		0,
		-1,
		1,
		0
	], "Clang! A shovel hit something metal. Something big.", "big-treasure"), {
		needs: "treasure-map",
		from: 8
	}),
	card("explorer-chest", "explorer", "The chest is FULL! 200 gold coins and one very old sandwich.", ch("Lock the vault", [
		0,
		3,
		-1,
		0
	], "The vault is heavy. The sandwich is heavier. We do not eat it."), ch("Throw a party", [
		-1,
		1,
		2,
		0
	], "Party! The sandwich got to be guest of honour."), {
		needs: "big-treasure",
		from: 12
	}),
	card("beekeeper-hive", "beekeeper", "My bees want 4 new hives. They are already buzzing about it.", ch("Too many stings", [
		-1,
		0,
		0,
		1
	], "Honey pats the old hive. Bzzzzt. Fine, fine."), ch("Build hives", [
		1,
		-1,
		0,
		0
	], "Bzzz! The bees threw a tiny hive party.", "bee-hive")),
	card("beekeeper-honey", "beekeeper", "We made 100 jars of honey! The bees also made a very tiny crown.", ch("Sell the honey", [
		0,
		3,
		-1,
		0
	], "The honey sold quickly. The bees kept the crown."), ch("Share the honey", [
		2,
		-1,
		1,
		0
	], "Sticky fingers! Sticky doors! Sticky cat! Yum!"), {
		needs: "bee-hive",
		from: 8
	}),
	card("beekeeper-swarm", "beekeeper", "A cloud of 1000 bees landed on the town hall. They are friendly. Mostly.", ch("Shoo gently", [
		0,
		0,
		-1,
		1
	], "Bzz. The bees leave in a tidy line. One waves."), ch("Let them stay", [
		1,
		0,
		1,
		-1
	], "The hall hums a tune. The mayor is wearing a bee hat.")),
	card("dragonkeeper-egg", "dragonkeeper", "I found a big warm egg in the hay! It wobbles when I sing. Can we keep it?", ch("Put it back", [
		0,
		0,
		-1,
		1
	], "Wren puts the egg back. It rolls out again. Cheeky."), ch("Keep it warm", [
		-1,
		0,
		1,
		0
	], "Wren sings a lullaby to the egg. It wobbles in time.", "dragon-egg"), { from: 3 }),
	card("dragonkeeper-hatch", "dragonkeeper", "CRACK! A baby dragon! It is one foot tall and hiccups sparks. It is very hungry.", ch("Find it a farm", [
		1,
		0,
		-2,
		0
	], "Wren waves goodbye. The baby dragon hiccups a small sad spark."), ch("Adopt it", [
		-2,
		0,
		1,
		0
	], "It ate 4 loaves of bread. Then a candle. Then a sock.", "baby-dragon"), {
		needs: "dragon-egg",
		from: 6
	}),
	card("dragonkeeper-grown", "dragonkeeper", "The dragon is horse-sized now! She sneezes sparks and keeps 30 houses warm.", ch("Too hot!", [
		0,
		0,
		-1,
		1
	], "The dragon sulks and sits on the roof to watch."), ch("Warm the town", [
		1,
		0,
		1,
		-1
	], "Toasty! She roasted chestnuts too. She burnt one. Sorry!"), {
		needs: "baby-dragon",
		from: 12
	}),
	card("cook-stew", "cook", "Shall I make a stew for 100 people? I need 30 potatoes, 12 carrots and one big spoon.", ch("Too much work", [
		1,
		0,
		-1,
		0
	], "Lupe stirs a tiny pot. It is for one very small mouse."), ch("Stir the stew", [
		-2,
		0,
		1,
		0
	], "The big spoon was used up. The stew was gone in 10 minutes.")),
	card("cook-cake", "cook", "A cake as tall as 3 cats! It needs 40 eggs and a ladder.", ch("A small cake", [
		1,
		0,
		-1,
		0
	], "A small cake. Lupe says, \"Very small.\" The cat agrees."), ch("Giant cake!", [
		-2,
		0,
		2,
		0
	], "It leaned a bit, like a tower. It still tasted great.")),
	card("cook-feast", "cook", "Queen Ysolde is coming! Feast for 50: 8 roast chickens and a mountain of peas.", ch("Just sandwiches", [
		1,
		0,
		-1,
		0
	], "Sandwiches. The queen ate one in 3 bites. She ate 40."), ch("A grand feast", [
		-2,
		0,
		1,
		0
	], "Chicken! Peas! Even the soup said hello.", "feast-ready"), {
		needs: "queen-coming",
		from: 8
	}),
	card("fortune-tea", "fortune", "My tea leaves show a big surprise coming. For 5 gold I will look more closely.", ch("I like surprises", [
		0,
		1,
		-1,
		0
	], "Opal shrugs. \"Surprises are better as surprises.\""), ch("Look closer", [
		0,
		-1,
		1,
		0
	], "The tea leaves say: \"bird\". Opal shrugs. Birds are good.", "prophecy")),
	card("fortune-bird", "fortune", "A small blue bird landed on the castle at noon, just like the tea leaves said!", ch("Shoo the bird", [
		0,
		0,
		-1,
		1
	], "The bird huffs, flaps once, then lands on Hale."), ch("Feed the bird", [
		-1,
		2,
		0,
		0
	], "It dropped a gold coin. Then it asked for more seed."), {
		needs: "prophecy",
		from: 8
	}),
	card("fortune-picnic", "fortune", "My crystal ball says it will be sunny for 4 days. Throw a picnic by the river?", ch("Stay inside", [
		1,
		0,
		-1,
		0
	], "It was sunny. Opal says, \"Told you.\""), ch("Picnic time!", [
		-1,
		0,
		1,
		0
	], "A seagull ate a whole sausage roll. Rude and funny.")),
	card("taxman-fountain", "taxman", "I counted 90 coins in the wishing fountain! Shall we take them for the treasury?", ch("Keep the wishes", [
		0,
		-1,
		2,
		0
	], "The wishes stay. Penny sighs and writes \"-1\"."), ch("Take the coins", [
		1,
		2,
		-1,
		0
	], "Splash! Penny waded in. She found a frog and 90 coins.")),
	card("taxman-hats", "taxman", "A tiny tax on hats: 1 coin each. There are 200 hats in town. Tiny, tiny tax!", ch("No hat tax", [
		0,
		-1,
		1,
		0
	], "Hats off to the town! Penny puts hers in the bin."), ch("Tax the hats", [
		1,
		3,
		-2,
		0
	], "Hats got smaller. One wore a thimble.")),
	card("ringmaster-circus", "ringmaster", "The circus has 4 elephants, 12 clowns and 1 clever flea! May we stay for 3 days?", ch("Not now", [
		1,
		0,
		-1,
		0
	], "The elephants droop. The flea tips its tiny hat."), ch("Come in!", [
		-2,
		1,
		2,
		0
	], "Clowns in the fountain! The flea jumped over a bread roll.", "circus-came")),
	card("ringmaster-return", "ringmaster", "We're back! New trick: a cannon that shoots confetti. 20 tickets for 10 gold?", ch("Sorry, no", [
		0,
		0,
		-1,
		1
	], "Dash puts the cannon away. A little confetti falls out. Poof."), ch("Fire the cannon", [
		1,
		2,
		0,
		-1
	], "Pop! Confetti in everyone's hair. The cat is covered. Pink."), {
		needs: "circus-came",
		from: 12
	}),
	card("miller-wheel", "miller", "The mill wheel turns slowly and 30 sacks of wheat are waiting.", ch("Wait a bit", [
		-1,
		1,
		0,
		0
	], "The wheat waits. The wheel spins. The wheat dozes."), ch("Oil the wheel", [
		2,
		-1,
		0,
		0
	], "Whirr! The new squeak goes \"eeeee\". Everyone likes it.")),
	card("miller-windmill", "miller", "A second windmill would grind twice the flour. It is three times taller than me.", ch("One is enough", [
		-1,
		1,
		0,
		0
	], "Ox sighs. The first windmill gets a pat."), ch("Build it", [
		2,
		-2,
		1,
		0
	], "Whoosh! Two windmills! The town feels fresh and floury.")),
	card("cat-throne", "cat", "Meow. (Sir Whiskers wants the throne for 1 hour. He is already sitting on it.)", ch("Down, please", [
		0,
		0,
		-1,
		1
	], "Sir Whiskers walks off. He flicks his tail like a very rude cape."), ch("Cat day!", [
		0,
		0,
		1,
		-1
	], "The cat wears the crown. He looks very pleased. Purr.", "cat-king")),
	card("cat-laws", "cat", "Meow. (Sir Whiskers has made 5 laws: fish for cats, naps at noon, and belly rubs.)", ch("No cat laws", [
		1,
		0,
		-1,
		0
	], "The cat gives a long, hard stare. Then he sits on your shoes."), ch("Pass the laws", [
		-1,
		0,
		1,
		0
	], "Everyone naps at noon. The cat naps hardest."), {
		needs: "cat-king",
		from: 8
	}),
	card("cat-fish", "cat", "Meow. (7 fish are missing from the kitchen. There is fur on the table.)", ch("Hide the fish", [
		1,
		0,
		-1,
		0
	], "The cat finds them anyway. Behind the cabbages."), ch("Share the fish", [
		-1,
		0,
		1,
		0
	], "Purrrr. The cat has a very round tummy.")),
	card("messenger-news", "messenger", "News from 3 villages! Reading it takes 1 hour. All of it is very exciting. Probably.", ch("Just headlines", [
		0,
		0,
		1,
		-1
	], "Zip speed-reads: \"Cows. Rain. Cows. The end.\" Good news."), ch("Read it all", [
		0,
		0,
		-1,
		1
	], "Village 2 had a cow who sang. Village 3 had a cow who didn't.")),
	card("messenger-boots", "messenger", "I ran 50 kilometres today! My boots have holes. My toes wave hello to everyone.", ch("Wear thick socks", [
		0,
		1,
		0,
		-1
	], "Zip wears 5 socks. He is not very fast now."), ch("Buy boots", [
		0,
		-1,
		1,
		0
	], "Fast boots! Zip zoomed past and left a trail of dust.")),
	card("messenger-sky", "messenger", "Cog's wings now carry my letters! 6 letters flew in 1 hour and one landed on a goat.", ch("Keep walking", [
		0,
		1,
		-1,
		0
	], "Zip trots on. The goat keeps the letter."), ch("Fund sky post", [
		0,
		-1,
		1,
		1
	], "Letters raced overhead! Zip waves from below."), {
		needs: "sky-post",
		from: 12
	}),
	card("queen-visit", "queen", "Queen Ysolde would like to visit Riverstone with her 12 coaches. May she come?", ch("Not this time", [
		0,
		0,
		-1,
		1
	], "The queen writes back: \"How rude! Well, fine. Another time.\""), ch("Welcome her!", [
		0,
		-1,
		1,
		0
	], "The red carpet comes out. It was a bit short, so we used a blanket.", "queen-coming"), { from: 6 }),
	card("queen-trade", "queen", "My kingdom has 40 wheels of cheese. Yours has 40 pies. Shall we swap for a week?", ch("Keep our pies", [
		1,
		0,
		-1,
		0
	], "The queen sniffs. \"Fine.\" She takes only 1 pie. Then 2."), ch("Swap!", [
		-1,
		1,
		1,
		0
	], "We swapped. Cheese pie! Pie cheese! Very cheesy.")),
	card("queen-return", "queen", "Your feast was the best ever! May we trade grain, 2 boats a month, as friends?", ch("Thank you, no", [
		0,
		1,
		-1,
		0
	], "The queen smiles. \"Perhaps one day.\" She takes a pie."), ch("Be friends", [
		2,
		-1,
		1,
		0
	], "The queen cheered. The grain boat is called \"Pie Friend\"."), {
		needs: "feast-ready",
		from: 12
	}),
	card("ghost-necklace", "ghost", "Whoooo... I lost my silver necklace 100 years ago. May we search the cellar?", ch("Maybe later", [
		0,
		1,
		-1,
		0
	], "Gilbert floats off, singing a tiny sad song."), ch("Search the cellar", [
		0,
		-1,
		1,
		0
	], "We found 3 spoons, 2 socks and an old key. No necklace.", "lost-necklace")),
	card("ghost-found", "ghost", "You found it! It was in a sock! Shall I haunt only on Tuesdays, or throw a ghost party?", ch("Quiet Tuesdays", [
		0,
		0,
		-1,
		1
	], "Gilbert smiles. Only Tuesdays: \"Boooo, but quietly.\""), ch("Ghost party!", [
		-1,
		0,
		1,
		-1
	], "The party was spooky and silly. Even the cat danced. Wooo!"), {
		needs: "lost-necklace",
		from: 8
	}),
	card("ghost-boo", "ghost", "I practised my BOO 8 times. It sounds like a sneeze. May I try on the guards?", ch("Boo a pillow", [
		0,
		0,
		-1,
		1
	], "Gilbert booed the pillow. The pillow did not mind."), ch("Boo the guards", [
		0,
		0,
		1,
		-1
	], "Achoo-OOO! Bryn jumped 2 metres. Then he laughed."))
];
const RIDDLES = [
	{
		who: "steward",
		ask: "The castle books are in a muddle. Could you help me with this sum?",
		meter: "gold",
		thanks: "Splendid! The books balance. Hale does a happy hop."
	},
	{
		who: "reeve",
		ask: "My farm needs counting before the sun sets. Can you help me with this?",
		meter: "food",
		thanks: "That's it! The harvest is all counted. Lovely."
	},
	{
		who: "ratcatcher",
		ask: "I counted the rats three times and got three answers. Help me with this?",
		meter: "safe",
		thanks: "Right! One less problem. Squeak, said the rat."
	},
	{
		who: "trader",
		ask: "A customer is waiting and my head is in a spin. Can you help me work this out?",
		meter: "gold",
		thanks: "Ha! You are a better trader than me. Here is a coin."
	},
	{
		who: "healer",
		ask: "I am mixing up the medicine and need to be careful. Can you help me with this?",
		meter: "safe",
		thanks: "Just right! Everyone will feel better soon."
	},
	{
		who: "builder",
		ask: "I need to measure twice and cut once. Can you help me work this out?",
		meter: "safe",
		thanks: "Perfect fit! Bram hammers in a nail and then another."
	},
	{
		who: "baker",
		ask: "My oven is hot and my head is hotter. Can you help me with this sum?",
		meter: "food",
		thanks: "Yes! Extra pies for everyone. Thank you!"
	},
	{
		who: "fisher",
		ask: "The tide is coming in and I need an answer fast. Can you help me with this?",
		meter: "food",
		thanks: "Hooray! You're a real catch. Here is a fish."
	},
	{
		who: "knight",
		ask: "Even brave knights need help sometimes. Can you help me with this one?",
		meter: "safe",
		thanks: "Brilliant! I knew you would know. Hip hip hooray!"
	},
	{
		who: "wizard",
		ask: "My spell needs an exact number or it all goes funny. Can you help me?",
		meter: "safe",
		thanks: "Abracadabra! It worked. No more frogs. For now."
	},
	{
		who: "goatherd",
		ask: "My goats keep moving and I keep losing count. Can you help me with this?",
		meter: "food",
		thanks: "Maaa-vellous! Thank you. The goats are impressed."
	},
	{
		who: "jester",
		ask: "I have a joke but the answer is a number. Can you help me work it out?",
		meter: "happy",
		thanks: "Ha ha! The best punchline: you got it right!"
	},
	{
		who: "smith",
		ask: "The iron is hot, so I need to be quick. Can you help me with this sum?",
		meter: "safe",
		thanks: "Spot on! Ingrid hits the anvil with joy. Clang!"
	},
	{
		who: "shepherd",
		ask: "The sheep got muddled again. Can you help me count and work this out?",
		meter: "food",
		thanks: "Baa-rilliant! All the sheep clapped. Sort of."
	},
	{
		who: "merchant",
		ask: "My customers are waiting and my spices are spilling. Can you help me with this?",
		meter: "gold",
		thanks: "Wonderful! A pinch of gold for you."
	},
	{
		who: "inventor",
		ask: "My latest invention needs the right numbers. Can you help me check this?",
		meter: "happy",
		thanks: "It works! Whirr, whirr, ding! Thank you!"
	},
	{
		who: "musician",
		ask: "I am counting beats in my song and lost my place. Can you help me with this?",
		meter: "happy",
		thanks: "One, two, three, four! You're in tune with maths!"
	},
	{
		who: "gardener",
		ask: "The plants need exact amounts of water. Can you help me work this out?",
		meter: "food",
		thanks: "The seeds are happy. So am I. Thank you!"
	},
	{
		who: "captain",
		ask: "The guards are lined up and I need to check the numbers. Can you help me?",
		meter: "safe",
		thanks: "Spot on! Not a number out of place. Well done!"
	},
	{
		who: "scholar",
		ask: "This book has a puzzle and the answer is a number. Can you help me?",
		meter: "happy",
		thanks: "Correct! Ada gives a very quiet, very happy cheer. Shhh!"
	},
	{
		who: "explorer",
		ask: "The map is blotchy and I need some numbers to read it. Can you help me?",
		meter: "gold",
		thanks: "You found it! X marks the spot. Rua high-fives you."
	},
	{
		who: "beekeeper",
		ask: "My bees have been busy and I lost count. Can you help me with this sum?",
		meter: "food",
		thanks: "Bzzz-illiant! A jar of honey for you!"
	},
	{
		who: "dragonkeeper",
		ask: "My dragon wants an answer before she sneezes. Can you help me with this?",
		meter: "happy",
		thanks: "Roar-some! The dragon is doing a happy wiggle."
	},
	{
		who: "cook",
		ask: "The soup pot is bubbling and I cannot find my glasses. Can you help me?",
		meter: "food",
		thanks: "Delicious answer! Lupe gives you a spoon of soup."
	},
	{
		who: "fortune",
		ask: "My crystal ball is fuzzy today. Can you help me find this answer?",
		meter: "happy",
		thanks: "The ball says: \"You are very clever!\" It is never wrong."
	},
	{
		who: "taxman",
		ask: "I have a very long list of coins. Can you help me with this one?",
		meter: "gold",
		thanks: "Right to the penny! Penny is delighted. Cling!"
	},
	{
		who: "ringmaster",
		ask: "The show starts in five minutes and the numbers are mixed up! Can you help me?",
		meter: "happy",
		thanks: "Ta-da! The show goes on! Thanks to you!"
	},
	{
		who: "miller",
		ask: "The flour is piling up and my head is dusty. Can you help me with this?",
		meter: "food",
		thanks: "Flour-ishing! That is correct. Thank you, Ox pats your back."
	},
	{
		who: "cat",
		ask: "Meow. (Sir Whiskers pushes a number puzzle off the table. Help him with it?)",
		meter: "happy",
		thanks: "Purrrr. (He knocks over a vase to say thank you.)"
	},
	{
		who: "messenger",
		ask: "I have a message to send, but it has numbers in it. Can you help me?",
		meter: "safe",
		thanks: "Message sent! Zip zoomed off in a puff of dust."
	},
	{
		who: "queen",
		ask: "A royal puzzle for you, my young friend. Can you help me with this one?",
		meter: "gold",
		thanks: "How clever! Riverstone is lucky to have you."
	},
	{
		who: "ghost",
		ask: "I have been floating over this puzzle for 100 years. Can you help me?",
		meter: "happy",
		thanks: "Wooo-hoo! Gilbert does a spooky spin of joy."
	}
];
//#endregion
//#region shared/decree/engine.ts
/**
* Royal Decree's rules, as pure functions (docs/DECREE-PLAN.md): the same seed and the same moves always give the same
* reign. The browser plays with these for instant feedback; the server replays the same moves to save the reign and
* give points, using only the riddle answers it marked itself.
*
* A reign is a run of cards. Every RIDDLE_EVERY-th card is a riddle (a maths question from the pupil's focus); the
* rest are villagers' requests, answered yes or no, each nudging the four meters. A meter at 0 ends the reign. Each
* new year the food goes down a little. Living through all the cards is a full reign.
*/
const newReign = (seed) => ({
	seed,
	meters: {
		food: 5,
		gold: 5,
		happy: 5,
		safe: 5
	},
	turn: 0,
	flags: [],
	used: [],
	stars: 0,
	met: [],
	status: "playing"
});
/** Is card number n (1-based) a riddle? */
const isRiddleTurn = (n) => n % 3 === 0;
/** The riddle slot (0-based) for card number n. */
const riddleSlot = (n) => n / 3 - 1;
/** How many riddles a full reign has (the server makes this many questions). */
const RIDDLES_IN_REIGN = Math.floor(8);
/** Whole years lived through. */
const yearsLived = (reign) => Math.floor(reign.turn / 4);
function pickWeighted(items, weight, random) {
	const total = items.reduce((s, t) => s + weight(t), 0);
	let r = random() * total;
	for (const t of items) {
		r -= weight(t);
		if (r < 0) return t;
	}
	return items[items.length - 1];
}
/** The card that comes next. Same reign, same card: the random numbers come from the seed and the card number. */
function nextCard(reign, deck) {
	if (reign.status !== "playing") return null;
	const n = reign.turn + 1;
	const random = seededRandom(`${reign.seed}:${n}`);
	if (isRiddleTurn(n)) return {
		kind: "riddle",
		riddle: deck.riddles[Math.floor(random() * deck.riddles.length)],
		slot: riddleSlot(n)
	};
	const open = deck.cards.filter((c) => !reign.used.includes(c.id) && (!c.needs || reign.flags.includes(c.needs)) && (c.from ?? 1) <= n);
	if (!open.length) return null;
	return {
		kind: "card",
		card: pickWeighted(open, (c) => (c.weight ?? 1) * (c.needs ? 4 : 1), random)
	};
}
const clampMeter = (v) => Math.max(0, Math.min(10, v));
/** The meters after an effect (each kept between 0 and METER_MOST). */
function applyEffect(meters, effect) {
	const out = { ...meters };
	for (const m of METERS) out[m] = clampMeter(out[m] + Math.max(-3, Math.min(3, effect[m] ?? 0)));
	return out;
}
const emptyMeter = (meters) => METERS.find((m) => meters[m] <= 0);
/** What happens after the card: winter at a new year, an empty meter ending the reign, or a full reign. */
function afterCard(reign) {
	let r = reign;
	let empty = emptyMeter(r.meters);
	if (!empty && r.turn < 24 && r.turn % 4 === 0) {
		r = {
			...r,
			meters: applyEffect(r.meters, { food: -1 })
		};
		empty = emptyMeter(r.meters);
	}
	if (empty) return {
		...r,
		status: "over",
		ending: empty
	};
	if (r.turn >= 24) return {
		...r,
		status: "full",
		ending: "full"
	};
	return r;
}
/**
* Plays one move. For a riddle, `right` says whether the server marked the answer right (false when skipped or
* wrong: nothing is lost). A move that doesn't fit the card (a side on a riddle, or the other way) is refused (null).
*/
const meet = (met, who) => met.includes(who) ? met : [...met, who];
function play(reign, deck, move, right = false) {
	const next = nextCard(reign, deck);
	if (!next) return null;
	if (next.kind === "riddle") {
		if (move !== "riddle") return null;
		const meters = right ? applyEffect(reign.meters, { [next.riddle.meter]: 2 }) : reign.meters;
		return afterCard({
			...reign,
			meters,
			turn: reign.turn + 1,
			stars: reign.stars + (right ? 1 : 0),
			met: meet(reign.met, next.riddle.who)
		});
	}
	if (move === "riddle") return null;
	const choice = next.card[move];
	return afterCard({
		...reign,
		meters: applyEffect(reign.meters, choice.effect),
		turn: reign.turn + 1,
		used: [...reign.used, next.card.id],
		met: meet(reign.met, next.card.who),
		flags: choice.sets && !reign.flags.includes(choice.sets) ? [...reign.flags, choice.sets] : reign.flags
	});
}
/** Plays a list of moves from a reign; riddle results come from `rightAt(slot)`. Null if any move doesn't fit. */
function playAll(reign, deck, moves, rightAt) {
	let r = reign;
	for (const move of moves) {
		if (!r) return null;
		const n = r.turn + 1;
		r = play(r, deck, move, isRiddleTurn(n) && rightAt(riddleSlot(n)));
	}
	return r;
}
/** Points for a finished reign: 1, +1 a year lived (up to 3), +1 for a full reign. */
function pointsFor(reign) {
	if (reign.status === "playing") return 0;
	return POINTS.played + Math.min(POINTS.yearsCounted, yearsLived(reign)) * POINTS.perYear + (reign.status === "full" ? POINTS.full : 0);
}
//#endregion
//#region shared/decree/server.ts
const DECK = {
	cards: CARDS,
	riddles: RIDDLES
};
/** The rulers a pupil can pick (Kingdom Keeper's painted rulers, copied into src/games/decree/art/rulers/). */
const LOOKS = [
	"ruler-girl-1",
	"ruler-boy-1",
	"ruler-girl-2",
	"ruler-boy-2",
	"ruler-girl-3",
	"ruler-boy-3",
	"ruler-girl-4",
	"ruler-boy-4"
];
const isLook = (v) => typeof v === "string" && LOOKS.includes(v);
const MAX_ANSWER_MS = 12e4;
const ok = (body) => ({
	status: 200,
	body
});
const no = (status, error, extra = {}) => ({
	status,
	body: {
		error,
		...extra
	}
});
const busy = () => no(503, "The castle couldn't be reached just now. Try again in a moment.");
function publicReign(s, points) {
	const answered = {};
	for (const [slot, a] of Object.entries(s.answered)) {
		const marked = markQuestion(s.questions[Number(slot)]);
		if (marked) answered[slot] = {
			right: a.right,
			answer: marked.answer
		};
	}
	return {
		id: s.id,
		look: s.look,
		reign: s.reign,
		questions: s.questions.map((q, slot) => publicQuestion(q, slot)),
		answered,
		...points === void 0 ? {} : { points }
	};
}
const readMoves = (v) => Array.isArray(v) && v.length <= 24 && v.every((m) => m === "yes" || m === "no" || m === "riddle") ? v : null;
async function handleDecree(services, player, body) {
	const on = await services.enabled(player);
	if (on === null) return busy();
	if (!on) return no(403, "Royal Decree is not switched on for your class.", { code: "game-off" });
	if (body.action === "load") {
		const s = await services.load(player);
		if (s === "busy") return busy();
		return ok({
			reign: s.reign ? publicReign(s.reign) : null,
			album: s.album,
			pointReignsLeft: Math.max(0, 5 - s.finishedToday)
		});
	}
	if (body.action === "start") {
		if (!isLook(body.look)) return no(400, "That ruler couldn't be found.");
		const reign = newReign(services.randomHex(16));
		const context = await services.mathsContext(player);
		const questions = context ? makeRunQuestions(context, RIDDLES_IN_REIGN, () => services.random()) : [];
		const id = await services.start(player, body.look, reign, questions);
		if (id === "busy") return busy();
		return ok({ reign: publicReign({
			id,
			look: body.look,
			reign,
			moves: [],
			questions,
			answered: {}
		}) });
	}
	if (body.action !== "answer" && body.action !== "save") return no(400, "That couldn't be read.");
	const s = await services.load(player);
	if (s === "busy") return busy();
	const stored = s.reign;
	if (!stored || stored.id !== body.reign) return no(409, "That reign is over. Open Royal Decree again to carry on.", { code: "gone" });
	if (body.action === "answer") {
		const { slot, value } = body;
		if (!Number.isInteger(slot) || typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e6) return no(400, "That answer couldn't be read.");
		const marked = markQuestion(stored.questions[slot]);
		if (!marked) return no(400, "That answer couldn't be marked.");
		const right = sameAnswer(value, marked.answer);
		const claimed = await services.answer(player, stored.id, slot, value, right);
		if (claimed === "busy") return busy();
		if (!claimed) return no(400, "You've already answered that one.");
		const ms = typeof body.ms === "number" && Number.isFinite(body.ms) && body.ms >= 0 ? Math.min(body.ms, MAX_ANSWER_MS) : MAX_ANSWER_MS;
		try {
			await services.recordAnswers(player, `decree:${stored.reign.seed}:${slot}`, [{
				key: marked.key,
				correct: right,
				ms: Math.round(ms),
				at: services.now()
			}]);
		} catch {}
		return ok({
			right,
			answer: marked.answer
		});
	}
	const fromTurn = body.from;
	const moves = readMoves(body.moves);
	if (!Number.isInteger(fromTurn) || !moves) return no(400, "Those moves couldn't be read.");
	if (fromTurn !== stored.reign.turn) return ok({
		reign: publicReign(stored),
		already: true
	});
	const reign = playAll(stored.reign, DECK, moves, (slot) => stored.answered[String(slot)]?.right === true);
	if (!reign) return no(400, "Those moves don't fit this reign.", { code: "bad-moves" });
	const over = reign.status !== "playing";
	const points = over && s.finishedToday < 5 ? pointsFor(reign) : 0;
	const kept = await services.save(player, stored.id, stored.reign.turn, reign, [...stored.moves, ...moves], over ? { points } : null);
	if (kept === "busy") return busy();
	if (!kept) {
		const again = await services.load(player);
		if (again === "busy") return busy();
		return again.reign ? ok({
			reign: publicReign(again.reign),
			already: true
		}) : no(409, "That reign is over.", { code: "gone" });
	}
	if (over) {
		if (points > 0) await services.awardPoints(player, points, `decree:${stored.id}`);
		await services.progressChanged(player);
	}
	return ok({ reign: publicReign({
		...stored,
		reign,
		moves: [...stored.moves, ...moves]
	}, over ? points : void 0) });
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
	return async function handleDecreeRequest(request) {
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
		const raw = await readJsonBody(request);
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) return reply(400, { error: "That couldn't be read." });
		const r = await handleDecree(services, player, raw);
		return reply(r.status, r.body);
	};
}
//#endregion
//#region supabase/functions/decree/entry.ts
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
/** Calls a database function: its answer, or 'busy'. Logs say which one and the error code, never who. */
async function call(name, args) {
	const { data, error } = await admin.rpc(name, args);
	if (!error) return data;
	console.error(`decree: ${name} failed (${error.code ?? "unknown"})`);
	return "busy";
}
Deno.serve(makeHandler({
	now: () => Date.now(),
	random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
	randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join(""),
	userIdFor: userIdFromToken(admin.auth),
	async enabled(player) {
		const { data, error } = await admin.rpc("settings_of", { player }).maybeSingle();
		if (error || !data) {
			console.error(`decree: settings failed (${error?.code ?? "none"})`);
			return null;
		}
		return data.decree_enabled === true;
	},
	async mathsContext(player) {
		const { data, error } = await admin.rpc("space_maths_context", { player });
		if (error || !data) {
			console.error(`decree: maths records failed (${error?.code ?? "none"})`);
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
	async load(player) {
		const r = await call("decree_load", { player });
		if (r === "busy") return r;
		const a = r.album;
		const album = {
			...a,
			reigns: Number(a.reigns),
			full: Number(a.full),
			best: Number(a.best)
		};
		return {
			reign: r.reign ? {
				...r.reign,
				id: Number(r.reign.id)
			} : null,
			album,
			finishedToday: Number(r.finishedToday)
		};
	},
	async start(player, look, reign, questions) {
		const id = await call("decree_start", {
			player,
			look,
			reign,
			questions
		});
		return id === "busy" ? id : Number(id);
	},
	answer: (player, id, slot, value, right) => call("decree_answer", {
		player,
		reign: id,
		slot,
		value,
		right_answer: right
	}),
	save: (player, id, fromTurn, reign, moves, end) => call("decree_save", {
		player,
		reign: id,
		from_turn: fromTurn,
		state: reign,
		new_moves: moves,
		points: end ? end.points : null
	}),
	async recordAnswers(player, once, answers) {
		await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, "decree");
	},
	async awardPoints(player, points, once) {
		const { error } = await admin.rpc("add_game_points", {
			player,
			game: "decree",
			points,
			once
		});
		if (error) console.error(`decree: points failed (${error.code ?? "unknown"})`);
	},
	async progressChanged(player) {
		const { error } = await admin.rpc("game_progress_changed", {
			player,
			game: "decree"
		});
		if (error) console.error(`decree: achievements failed (${error.code ?? "unknown"})`);
	}
}));
//#endregion
