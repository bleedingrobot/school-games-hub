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
		} else if (multipleChoice || made.choose) choices = choicesFor$2(answer, made.wrong ?? [], decimal, random);
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
const decimalPlaces$1 = (text) => (text.split(".")[1] ?? "").length;
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
	const dp = decimalPlaces$1(parts[1]);
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
* for free. With a `floor` (placement or the furthest place reached, see place.ts) the
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
async function batchIdFor$1(text) {
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
async function recordMathsAnswers(rpc, player, answers, once, from, batchId = (o, pack) => batchIdFor$1(`${from}:${o}:${pack}`)) {
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
			quick_ms: quickMsForPack(pack),
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
* Question stops (James, 20 Oct 2026: "2 more maths checks, for 1 sec off and .5 second off"). Like a pit stop (the clock
* stops, a question, recorded), but not a checkpoint: `k` takes 1 second off for a right answer, `h` half a second.
* What each kind of stop takes off for a right answer, in steps, by tile letter.
*/
const STOP_BONUS_STEPS = {
	c: 120,
	k: 60,
	h: 30
};
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
*   j  a jump pad          c  a checkpoint (and pit stop)   s  the start (exactly one)
*   k  a 1-second question stop      h  a half-second question stop (maths; flat floor otherwise)
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
const KNOWN = new Set(".#im><^v=bjcsfABCDEFGHewnogtqkh".split(""));
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
	const pitValue = [];
	const pitKind = [];
	for (let i = 0; i < tiles.length; i++) {
		const kind = tiles[i].ch;
		if (!(kind in STOP_BONUS_STEPS) || pitAt[i] >= 0) continue;
		pitValue.push(STOP_BONUS_STEPS[kind]);
		pitKind.push(kind);
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
				if (tiles[ni].ch === kind && pitAt[ni] < 0) {
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
		pitCount,
		pitValue,
		pitKind
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
			"............=#######mm#####A####>>>>#k#####=..........",
			"............=#######mm#####A####>>>>#k#####=..........",
			"............=#######mm======####>>>>#k#####=..........",
			"............=#######mm#####B####>>>>#k#####=..........",
			"............=#######mm#####B####>>>>#k#####=..........",
			"............==========================#####=..........",
			".....................................=#####=..........",
			".....................................=vvvvv=..........",
			".....................................=vvvvv=..........",
			".....................................=vvvvv=..........",
			".....................................=#####==========.",
			".....................................=#######h##>>ff=.",
			".....................................=#######h##>>ff=.",
			".....................................=#######h##>>ff=.",
			".....................................=#######h##>>ff=.",
			".....................................=#######h##>>ff=.",
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
			goldMaths: 18
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
			"..=====================.......................",
			"..=##############>>#######....................",
			"..=#######b######>>#######....................",
			"..=s#############>>#######....................",
			"..=###########b##>>#######....................",
			"..=##############>>#######....................",
			"..===================#####....................",
			".#####<<###B#####mm#######....................",
			".#####<<###B#####mm#######....................",
			".#####<<###======mm#######....................",
			".#####<<###A#####mm#######....................",
			".#####<<###A#####mm#######....................",
			".#####================........................",
			".#######k#######>>cc#####.....................",
			".#######k####b##>>cc#####.....................",
			".#######k#######>>cc#####.....................",
			".#######kb######>>cc#####.....................",
			".#######k#######>>cc#####.....................",
			".....===============#####=================....",
			"....................#######mm#####C###>>#####.",
			"....................#######mm#####C###>>#####.",
			"....................#######mm======###>>#####.",
			"....................#######mm#####D###>>#####.",
			"....................#######mm#####D###>>#####.",
			"........................================#####.",
			".....................#######<<####h##########.",
			".....................#######<<##b#h##########.",
			".....................#######<<####h##########.",
			".....................#######<<####h#b########.",
			".....................#######<<####h##########.",
			"....=================#####===============.....",
			".#####<<###F#####mm#######....................",
			".#####<<###F#####mm#######....................",
			".#####<<###======mm#######....................",
			".#####<<###E#####mm#######....................",
			".#####<<###E#####mm#######....................",
			".kkkkk================........................",
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
			"000ooooooooooooooonmmmmmmm00000000000000000000",
			"000ooooooooooooooonmmmmmmm00000000000000000000",
			"000ooooooooooooooonmmmmmmm00000000000000000000",
			"000ooooooooooooooonmmmmmmm00000000000000000000",
			"000ooooooooooooooonmmmmmmm00000000000000000000",
			"000000000000000000000mmmmm00000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmmmmm00000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmmmmm00000000000000000000",
			"0kkkkklmmmm000000mmmmmmmmm00000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmmmmm00000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmmmmm00000000000000000000",
			"0kkkkk0000000000000000000000000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiiiii000000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiiiii000000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiiiii000000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiiiii000000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiiiii000000000000000000000",
			"00000000000000000000iiiii000000000000000000000",
			"00000000000000000000iiiiiiiiiiiiiiiiiiihggggg0",
			"00000000000000000000iiiiiiiiiiiiiiiiiiihggggg0",
			"00000000000000000000iiiiiiiii000000iiiihggggg0",
			"00000000000000000000iiiiiiiiiiiiiiiiiiihggggg0",
			"00000000000000000000iiiiiiiiiiiiiiiiiiihggggg0",
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
			[5.5, 4.5],
			[6.5, 4.5],
			[9.5, 4.5],
			[12.5, 4.5],
			[15.5, 4.5],
			[16.5, 4.5],
			[17.5, 4.5],
			[18.5, 4.5],
			[21.5, 4.5],
			[22.5, 4.5],
			[23.5, 4.5],
			[23.5, 9.5],
			[23.5, 10.5],
			[20.5, 10.5],
			[17.5, 10.5],
			[8.5, 10.5],
			[8.5, 10.5],
			[7.5, 10.5],
			[6.5, 10.5],
			[4.5, 10.5],
			[3.5, 10.5],
			[3.5, 15.5],
			[3.5, 16.5],
			[8.5, 16.5],
			[11.5, 16.5],
			[14.5, 16.5],
			[15.5, 16.5],
			[16.5, 16.5],
			[17.5, 16.5],
			[19.5, 16.5],
			[21.5, 16.5],
			[22.5, 16.5],
			[22.5, 21.5],
			[22.5, 22.5],
			[25.5, 22.5],
			[28.5, 22.5],
			[37.5, 22.5],
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
			gold: 52,
			silver: 77,
			bronze: 120,
			goldMaths: 47
		},
		hardSeconds: 104,
		gates: [
			{
				sign: [19, 10],
				after: 15,
				tunnels: [{
					door: 0,
					cells: [
						[16, 12],
						[16, 11],
						[15, 12],
						[15, 11],
						[14, 12],
						[14, 11],
						[13, 12],
						[13, 11],
						[12, 12],
						[12, 11]
					],
					route: [
						[16.5, 12],
						[14.5, 12],
						[12.5, 12],
						[11.5, 12]
					],
					dead: [
						[16.5, 12],
						[14.5, 12],
						[12.5, 12],
						[14.5, 12],
						[16.5, 12]
					]
				}, {
					door: 1,
					cells: [
						[16, 9],
						[16, 8],
						[15, 9],
						[15, 8],
						[14, 9],
						[14, 8],
						[13, 9],
						[13, 8],
						[12, 9],
						[12, 8]
					],
					route: [
						[16.5, 9],
						[14.5, 9],
						[12.5, 9],
						[11.5, 9]
					],
					dead: [
						[16.5, 9],
						[14.5, 9],
						[12.5, 9],
						[14.5, 9],
						[16.5, 9]
					]
				}]
			},
			{
				sign: [26, 22],
				after: 36,
				tunnels: [{
					door: 2,
					cells: [
						[29, 20],
						[29, 21],
						[30, 20],
						[30, 21],
						[31, 20],
						[31, 21],
						[32, 20],
						[32, 21],
						[33, 20],
						[33, 21]
					],
					route: [
						[29.5, 21],
						[31.5, 21],
						[33.5, 21],
						[34.5, 21]
					],
					dead: [
						[29.5, 21],
						[31.5, 21],
						[33.5, 21],
						[31.5, 21],
						[29.5, 21]
					]
				}, {
					door: 3,
					cells: [
						[29, 23],
						[29, 24],
						[30, 23],
						[30, 24],
						[31, 23],
						[31, 24],
						[32, 23],
						[32, 24],
						[33, 23],
						[33, 24]
					],
					route: [
						[29.5, 24],
						[31.5, 24],
						[33.5, 24],
						[34.5, 24]
					],
					dead: [
						[29.5, 24],
						[31.5, 24],
						[33.5, 24],
						[31.5, 24],
						[29.5, 24]
					]
				}]
			},
			{
				sign: [19, 34],
				after: 57,
				tunnels: [{
					door: 4,
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
					door: 5,
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
			}
		]
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
			".........................=kkkkk=.........................................",
			".........................=#####=.........................................",
			".........................==ggg==.........................................",
			".........................=.....=.........................................",
			".........................=.....=.....................=============.......",
			".........................=.....=.....................=#mm#####C##=.......",
			".........................=#####=======================#mm#####C##=======.",
			".........................=#######mm#####A##mh>>>##..###mm======###>>fff=.",
			".........................=#######mm#####A##mh>>>##..###mm#####D###>>fff=.",
			".........................=#######mm======##mh>>>g#..###mm#####D###>>fff=.",
			".........................=#######mm#####B##mh>>>##..###mm======###>>fff=.",
			".........................=#######mm#####B##mh>>>##..###mm#####E###>>fff=.",
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
			goldMaths: 24
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
			".=iiiiiiiii>>>iiiij..k#####=..............................",
			".=iiiiiiiii>>>iiiij..k#####=..............................",
			".=siiiiiiii>>>iiiij..k#####=..............................",
			".=iiiiiiiii>>>iiiij..k#####=..............................",
			".=iiiiiiiii>>>iiiij..k#####=..............................",
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
			".....................=#####ihi>>m#mm======##mm>>mmmmmmff=.",
			".....................=#####ihi>>m#mm#####D##mm>>mmmmmmff=.",
			".....................=#####ihi>>m#mm#####D##mm>>mmmmmmff=.",
			".....................=#####ihi>>m#mm======##mm>>mmmmbmff=.",
			".....................=#####ihi>>m#mm#####E##mm>>mmmmmmff=.",
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
			goldMaths: 23
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
			".................................=kkkkk=.",
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
			"...=hhhhh===================.............",
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
			goldMaths: 43
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
			".=###########>##>##>##>##cc##mm#####A###tk#t#####....................................",
			".=s##########>##>##>##>##cc##mm======###tk#t#####....................................",
			".=###########>##>##>##>##cc##mm#####B###tk#t#####....................................",
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
			"..............................................ccc....................................",
			"..............................................ccc...................================.",
			"..............................................###...................=##mm#####F##ff=.",
			"..............................................########>##>##>##t#h#>>##mm#####F##ff=.",
			"..............................................########>##>##>##t#h#>>##mm======##ff=.",
			"..............................................########>##>##>##t#h#>>##mm#####G##ff=.",
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
			goldMaths: 30
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
	},
	{
		id: "wide-hill",
		name: "Wide Hill",
		rows: [
			"..................................................",
			".=========================........................",
			".=#########>>mmm#k#######=........................",
			".=#########>>mmm#k#######=........................",
			".=s########>>mmm#k#######=........................",
			".=#########>>mmm#k#######=........................",
			".=#########>>mmm#k#######=........................",
			".===================#####=........................",
			"...................=#####=........................",
			"...................=vvvvv=........................",
			"...................=vvvvv=........................",
			"...................=ccccc=........................",
			"...................=ccccc=........................",
			"...................=#####=........................",
			"...................=#####========================.",
			"...................=#######mm#####A####>>#######=.",
			"...................=#######mm#####A####>>#######=.",
			"...................=#######mm======####>>#######=.",
			"...................=#######mm#####B####>>#######=.",
			"...................=#######mm#####B####>>#######=.",
			"...................========================#####=.",
			"..........................................=#####=.",
			"..........................................=vvvvv=.",
			"..........................................=vvvvv=.",
			".................................==========hhhhh=.",
			".................................=ff<###########=.",
			".................................=ff<###########=.",
			".................................=ff<###########=.",
			".................................=ff<###########=.",
			".................................=ff<###########=.",
			".................................================.",
			".................................................."
		],
		heights: [
			"00000000000000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000000000000",
			"00kkkkkkkkkkjiiiiiiiiiiii0000000000000000000000000",
			"00kkkkkkkkkkjiiiiiiiiiiii0000000000000000000000000",
			"00kkkkkkkkkkjiiiiiiiiiiii0000000000000000000000000",
			"00kkkkkkkkkkjiiiiiiiiiiii0000000000000000000000000",
			"00kkkkkkkkkkjiiiiiiiiiiii0000000000000000000000000",
			"00000000000000000000iiiii0000000000000000000000000",
			"00000000000000000000iiiii0000000000000000000000000",
			"00000000000000000000iiiii0000000000000000000000000",
			"00000000000000000000hhhhh0000000000000000000000000",
			"00000000000000000000ggggg0000000000000000000000000",
			"00000000000000000000ggggg0000000000000000000000000",
			"00000000000000000000ggggg0000000000000000000000000",
			"00000000000000000000ggggg0000000000000000000000000",
			"00000000000000000000ggggggggggggggggggggfeeeeeee00",
			"00000000000000000000ggggggggggggggggggggfeeeeeee00",
			"00000000000000000000ggggggggg000000gggggfeeeeeee00",
			"00000000000000000000ggggggggggggggggggggfeeeeeee00",
			"00000000000000000000ggggggggggggggggggggfeeeeeee00",
			"0000000000000000000000000000000000000000000eeeee00",
			"0000000000000000000000000000000000000000000eeeee00",
			"0000000000000000000000000000000000000000000eeeee00",
			"0000000000000000000000000000000000000000000ddddd00",
			"0000000000000000000000000000000000000000000ccccc00",
			"0000000000000000000000000000000000bbcccccccccccc00",
			"0000000000000000000000000000000000bbcccccccccccc00",
			"0000000000000000000000000000000000bbcccccccccccc00",
			"0000000000000000000000000000000000bbcccccccccccc00",
			"0000000000000000000000000000000000bbcccccccccccc00",
			"00000000000000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[9.5, 4.5],
			[10.5, 4.5],
			[11.5, 4.5],
			[12.5, 4.5],
			[15.5, 4.5],
			[18.5, 4.5],
			[21.5, 4.5],
			[22.5, 4.5],
			[22.5, 8.5],
			[22.5, 9.5],
			[22.5, 10.5],
			[22.5, 12.5],
			[22.5, 15.5],
			[22.5, 16.5],
			[22.5, 17.5],
			[25.5, 17.5],
			[28.5, 17.5],
			[37.5, 17.5],
			[38.5, 17.5],
			[39.5, 17.5],
			[40.5, 17.5],
			[43.5, 17.5],
			[44.5, 17.5],
			[45.5, 17.5],
			[45.5, 21.5],
			[45.5, 22.5],
			[45.5, 23.5],
			[45.5, 26.5],
			[45.5, 27.5],
			[40.5, 27.5],
			[37.5, 27.5],
			[36.5, 27.5],
			[34.5, 27.5]
		],
		medals: {
			gold: 23,
			silver: 34,
			bronze: 53,
			goldMaths: 19
		},
		hardSeconds: 46,
		gates: [{
			sign: [26, 17],
			after: 19,
			tunnels: [{
				door: 0,
				cells: [
					[29, 15],
					[29, 16],
					[30, 15],
					[30, 16],
					[31, 15],
					[31, 16],
					[32, 15],
					[32, 16],
					[33, 15],
					[33, 16]
				],
				route: [
					[29.5, 16],
					[31.5, 16],
					[33.5, 16],
					[34.5, 16]
				],
				dead: [
					[29.5, 16],
					[31.5, 16],
					[33.5, 16],
					[31.5, 16],
					[29.5, 16]
				]
			}, {
				door: 1,
				cells: [
					[29, 18],
					[29, 19],
					[30, 18],
					[30, 19],
					[31, 18],
					[31, 19],
					[32, 18],
					[32, 19],
					[33, 18],
					[33, 19]
				],
				route: [
					[29.5, 19],
					[31.5, 19],
					[33.5, 19],
					[34.5, 19]
				],
				dead: [
					[29.5, 19],
					[31.5, 19],
					[33.5, 19],
					[31.5, 19],
					[29.5, 19]
				]
			}]
		}]
	},
	{
		id: "gap-and-ice",
		name: "Gap and Ice",
		rows: [
			"..........................................",
			".=========================................",
			".=########>>###j..#k#####=................",
			".=########>>###j..#k#####=................",
			".=s#######>>###j..#k#####=................",
			".=########>>###j..#k#####=................",
			".=########>>###j..#k#####=................",
			".===================#####=................",
			"...................=#####=................",
			"...................=mmmmm=................",
			"...................=mmmmm=................",
			"...................=##=##=................",
			"...................=##=##=................",
			"...................=##=##=................",
			"...................=##=##=................",
			"...................=##=##=................",
			"...................=AA=BB=................",
			"...................=#####=................",
			"...................=#####=................",
			"...................=#####=................",
			"...................=vvvvv=................",
			"...................=vvvvv=................",
			"...................=ccccc=................",
			"...................=ccccc=................",
			"...................=iiiii=................",
			"...................=iiiii=................",
			"...................=iiiii=................",
			"...................=iiiii=................",
			"...................=iiiii=................",
			"...................=#####================.",
			"...................=##########h#>>######=.",
			"...................=##########h#>>######=.",
			"...................=#######b##h#>>######=.",
			"...................=##########h#>>######=.",
			"...................=##########h#>>######=.",
			"...................================#####=.",
			"..................................=#####=.",
			"..................................=#####=.",
			"..................................=#####=.",
			"..................................=#####=.",
			"..................................=vvvvv=.",
			"..................................=fffff=.",
			"..................................=fffff=.",
			"..................................=======.",
			".........................................."
		],
		heights: [
			"000000000000000000000000000000000000000000",
			"000000000000000000000000000000000000000000",
			"00mmmmmmmmmlkkkk00kkkkkkk00000000000000000",
			"00mmmmmmmmmlkkkk00kkkkkkk00000000000000000",
			"00mmmmmmmmmlkkkk00kkkkkkk00000000000000000",
			"00mmmmmmmmmlkkkk00kkkkkkk00000000000000000",
			"00mmmmmmmmmlkkkk00kkkkkkk00000000000000000",
			"00000000000000000000kkkkk00000000000000000",
			"00000000000000000000kkkkk00000000000000000",
			"00000000000000000000kkkkk00000000000000000",
			"00000000000000000000kkkkk00000000000000000",
			"00000000000000000000kk0kk00000000000000000",
			"00000000000000000000kk0kk00000000000000000",
			"00000000000000000000kk0kk00000000000000000",
			"00000000000000000000kk0kk00000000000000000",
			"00000000000000000000kk0kk00000000000000000",
			"00000000000000000000kk0kk00000000000000000",
			"00000000000000000000kkkkk00000000000000000",
			"00000000000000000000kkkkk00000000000000000",
			"00000000000000000000kkkkk00000000000000000",
			"00000000000000000000kkkkk00000000000000000",
			"00000000000000000000jjjjj00000000000000000",
			"00000000000000000000iiiii00000000000000000",
			"00000000000000000000iiiii00000000000000000",
			"00000000000000000000iiiii00000000000000000",
			"00000000000000000000iiiii00000000000000000",
			"00000000000000000000iiiii00000000000000000",
			"00000000000000000000iiiii00000000000000000",
			"00000000000000000000iiiii00000000000000000",
			"00000000000000000000iiiii00000000000000000",
			"00000000000000000000iiiiiiiiiiiiihgggggg00",
			"00000000000000000000iiiiiiiiiiiiihgggggg00",
			"00000000000000000000iiiiiiiiiiiiihgggggg00",
			"00000000000000000000iiiiiiiiiiiiihgggggg00",
			"00000000000000000000iiiiiiiiiiiiihgggggg00",
			"00000000000000000000000000000000000ggggg00",
			"00000000000000000000000000000000000ggggg00",
			"00000000000000000000000000000000000ggggg00",
			"00000000000000000000000000000000000ggggg00",
			"00000000000000000000000000000000000ggggg00",
			"00000000000000000000000000000000000ggggg00",
			"00000000000000000000000000000000000fffff00",
			"00000000000000000000000000000000000fffff00",
			"000000000000000000000000000000000000000000",
			"000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[9.5, 4.5],
			[10.5, 4.5],
			[11.5, 4.5],
			[14.5, 4.5],
			[15.5, 4.5],
			[16.5, 4.5],
			[17.5, 4.5],
			[20.5, 4.5],
			[21.5, 4.5],
			[22.5, 4.5],
			[22.5, 7.5],
			[22.5, 10.5],
			[22.5, 19.5],
			[22.5, 19.5],
			[22.5, 20.5],
			[22.5, 21.5],
			[22.5, 23.5],
			[22.5, 26.5],
			[22.5, 28.5],
			[22.5, 31.5],
			[22.5, 32.5],
			[27.5, 32.5],
			[28.5, 32.5],
			[31.5, 32.5],
			[32.5, 32.5],
			[33.5, 32.5],
			[36.5, 32.5],
			[37.5, 32.5],
			[37.5, 37.5],
			[37.5, 39.5],
			[37.5, 40.5],
			[37.5, 42.5]
		],
		medals: {
			gold: 23,
			silver: 34,
			bronze: 53,
			goldMaths: 19
		},
		hardSeconds: 46,
		gates: [{
			sign: [22, 8],
			after: 14,
			tunnels: [{
				door: 0,
				cells: [
					[20, 11],
					[21, 11],
					[20, 12],
					[21, 12],
					[20, 13],
					[21, 13],
					[20, 14],
					[21, 14],
					[20, 15],
					[21, 15]
				],
				route: [
					[21, 11.5],
					[21, 13.5],
					[21, 15.5],
					[21, 16.5]
				],
				dead: [
					[21, 11.5],
					[21, 13.5],
					[21, 15.5],
					[21, 13.5],
					[21, 11.5]
				]
			}, {
				door: 1,
				cells: [
					[23, 11],
					[24, 11],
					[23, 12],
					[24, 12],
					[23, 13],
					[24, 13],
					[23, 14],
					[24, 14],
					[23, 15],
					[24, 15]
				],
				route: [
					[24, 11.5],
					[24, 13.5],
					[24, 15.5],
					[24, 16.5]
				],
				dead: [
					[24, 11.5],
					[24, 13.5],
					[24, 15.5],
					[24, 13.5],
					[24, 11.5]
				]
			}]
		}]
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
		safeSpots: [],
		checkpoints: [],
		outcome: "running",
		finishSteps: 0,
		padCooldown: 0,
		gateChoices: w.course.gates.map(() => -1),
		pitStops: [],
		pitsPaid: [],
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
	const spots = s.safeSpots;
	let spot = -1;
	for (let i = spots.length - 2; i >= 0; i -= 2) if (spots[i + 1] <= s.steps - 60) {
		spot = spots[i];
		break;
	}
	const W = w.course.width;
	s.x = spot >= 0 ? spot % W + .5 : s.respawnX;
	s.y = spot >= 0 ? Math.floor(spot / W) + .5 : s.respawnY;
	s.z = floorAt(w, s.x, s.y) ?? 0;
	s.safeSpots = [Math.floor(s.y) * W + Math.floor(s.x), s.steps - 60];
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
		const stop = s.pitStops[s.pitStops.length - 1];
		if (stop !== void 0 && !s.pitsPaid.includes(stop)) {
			s.pitsPaid.push(stop);
			s.penalty -= w.course.pitValue[stop];
		}
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
	if (s.grounded && !on.slope && on.surface !== "ice" && !".=fqtgjbewno".includes(on.ch)) {
		const id = ty * c.width + tx;
		const spots = s.safeSpots;
		if (spots[spots.length - 2] !== id) {
			spots.push(id, s.steps);
			if (spots.length > 32) spots.splice(0, 2);
		}
	}
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
	} else if (on.ch === "k" || on.ch === "h") {
		const stop = c.pitAt[ty * c.width + tx];
		if (!s.pitStops.includes(stop)) s.pitStops.push(stop);
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
			paidStops: result.state.pitsPaid,
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
			const allowed = at >= plan.pitStart && at < plan.gemStart || run?.rescue === true && at >= plan.rescueStart && at < plan.total;
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
			const answered = stored?.answered ?? {};
			const rightIn = (from, to) => Object.entries(answered).filter(([slot, a]) => a.right && Number(slot) >= from && Number(slot) < to).length;
			const paidRight = judged.run.paidStops.every((stop) => answered[plan.pitStart + stop]?.right === true);
			const refundsAllowed = stored?.rescue ? Math.min(rightIn(plan.rescueStart, plan.total), judged.run.falls) : 0;
			if (!paidRight || judged.run.bonuses > judged.run.pitStops || judged.run.refunds > refundsAllowed) {
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
	userIdFor: userIdFromToken(admin.auth),
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
		await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, "marble", (o, pack) => batchIdFor(`${o}:${pack}`));
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
