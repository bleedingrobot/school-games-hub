// GENERATED FILE: don't edit. Edit supabase/functions/archery/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "archery" function.

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
const EARLY_FACTS = {
	id: "early-facts",
	label: "Early number facts",
	families: {
		tenAnd: {
			label: "\"Ten and\" facts (10 + 4)",
			curriculumTags: ["MS.Y1.NUM.OP.P6"],
			keys: range$5(1, 9).map((n) => `tenand:${n}`),
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
const whole$1 = (n) => Number.isInteger(n) && n >= 0;
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
			if (whole$1(addendA) && whole$1(addendB)) keys = sumKeys(addendA, addendB, total);
		} else if (op === "−") {
			if (z === "?") {
				answer = a - b;
				if (whole$1(answer)) keys = sumKeys(b, answer, a);
			} else if (y === "?") {
				answer = a - c;
				if (whole$1(answer)) keys = sumKeys(c, answer, a);
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
				if (whole$1(answer) && b > 0) keys = divKeys(a, b, answer);
			} else if (y === "?") {
				answer = a / c;
				if (whole$1(answer) && c > 0) keys = divKeys(a, answer, c);
			}
		}
	}
	if (!whole$1(answer) || answer > 1e3) return null;
	keys = keys.filter(isFocusKey);
	return keys.length ? {
		answer,
		keys
	} : null;
}
const DT = 1 / 240;
/** Midpoint displacement: the first split moves the middle by up to this share of the field's height… */
const LAND_START_ROUGHNESS = .65;
/** …and each later split by this share of the one before (a little over half keeps the edges jagged). */
const LAND_ROUGHNESS_DECAY = .58;
/** The highest peak can reach this share of the field's height (measured from the bottom). */
const LAND_MAX_HEIGHT = .75;
/** Land whose highest peak is lower than this share of the height is stretched up to LAND_MAX_HEIGHT. */
const LAND_MIN_PEAK = .65;
/** The lowest valley floor stays at least this share of the height above the bottom. */
const LAND_MIN_HEIGHT = .08;
/** The two ends start at a random height between these shares of the field's height. */
const LAND_END_LOW = .2;
/** The left archer stands somewhere in this share of the width, the right one mirrored. */
const ARCHER_ZONE_FROM = .06;
const ARCHER_ZONE_TO = .3;
/** Each world's wind runs from −n to +n (the wind stays the same all round). The Forest is calm, the Desert strong. */
const WORLD_WIND_MAX = {
	forest: 6,
	desert: 14,
	snow: 10,
	city: 10
};
const LAND_STYLE = {
	forest: {
		startRoughness: LAND_START_ROUGHNESS,
		roughnessDecay: LAND_ROUGHNESS_DECAY,
		maxHeight: LAND_MAX_HEIGHT,
		minPeak: LAND_MIN_PEAK
	},
	desert: {
		startRoughness: LAND_START_ROUGHNESS,
		roughnessDecay: .52,
		maxHeight: LAND_MAX_HEIGHT,
		minPeak: LAND_MIN_PEAK
	},
	snow: {
		startRoughness: LAND_START_ROUGHNESS,
		roughnessDecay: LAND_ROUGHNESS_DECAY,
		maxHeight: LAND_MAX_HEIGHT,
		minPeak: LAND_MIN_PEAK
	},
	city: {
		startRoughness: .45,
		roughnessDecay: .5,
		maxHeight: .5,
		minPeak: .4
	}
};
/** Trees are easy to blast away: a blast clears tree cells this many times further than dirt. */
const TREE_BLAST_SCALE = 1.4;
/** At most this many cells of sand move after one shot (so a shot always finishes quickly). */
const SAND_MAX_MOVES = 4e3;
/** An arrow keeps this share of its speed when it bounces off ice. */
const ICE_BOUNCE = .6;
/** A blast clears building cells only this share of its radius from the middle. */
const BUILDING_CHIP = .3;
/** Roughly this share of the street gets no building at all (an open lot). */
const BUILDING_SKIP = .2;
const LOG_FRICTION = .25;
const SKIP_BLASTS = [
	{
		r: 16,
		peak: 14
	},
	{
		r: 20,
		peak: 18
	},
	{
		r: 26,
		peak: 24
	}
];
/** Each hop keeps this share of the sideways speed (at least SKIP_MIN_VX px/s) and leaves at this share of the fall speed (at least SKIP_MIN_UP). */
const SKIP_KEEP_VX = .7;
const SKIP_UP = .45;
const SHAKER_MOVES = 6e3;
const OWL_PULL = 3e3;
const FIREWORK_POPS = [
	[0, 0],
	[30, -14],
	[-30, -14],
	[18, 20],
	[-18, 20]
];
const BOLT_RANGE_PER = 3.2;
const BOLT_CUT_RADIUS = 4.5;
const BUBBLE_KEEP = .7;
/** Each turn has this long (the server's clock decides); then the turn is used up. */
const DUEL_TURN_MS = 45e3;
/** The server waits this much past a deadline before it lets anyone end the turn (screens' clocks and the network differ). */
const DUEL_GRACE_MS = 2e3;
/** A challenge waits this long for an answer. */
const CHALLENGE_MS = 6e4;
/** Once a challenge is accepted, both have this long to pack their quivers. */
const PACK_MS = 12e4;
const ARROWS = [
	{
		id: "plain",
		name: "Plain Arrow",
		does: "A small blast. You never run out.",
		blastRadius: 24,
		peakDamage: 25,
		price: 0,
		perPurchase: null,
		level: 0,
		forSale: false,
		unlimited: true
	},
	{
		id: "steel",
		name: "Steel Arrow",
		does: "A bigger blast.",
		blastRadius: 34,
		peakDamage: 40,
		price: 50,
		perPurchase: 2,
		level: 1
	},
	{
		id: "log",
		name: "Rolling Log",
		does: "Lands, rolls downhill, bursts in a dip or at an archer.",
		blastRadius: 28,
		peakDamage: 35,
		price: 60,
		perPurchase: 1,
		level: 1
	},
	{
		id: "mole",
		name: "Mole Arrow",
		does: "Digs a deep hole straight down. Knock the ground out from under someone.",
		blastRadius: 12,
		peakDamage: 10,
		price: 40,
		perPurchase: 1,
		level: 1
	},
	{
		id: "mud",
		name: "Mud Ball",
		does: "Drops a big ball of dirt: bury someone, or build a wall.",
		blastRadius: 36,
		peakDamage: 0,
		price: 50,
		perPurchase: 1,
		level: 1
	},
	{
		id: "rain",
		name: "Arrow Rain",
		does: "Splits at the top of its flight into 5 small arrows.",
		blastRadius: 16,
		peakDamage: 15,
		price: 150,
		perPurchase: 1,
		level: 2
	},
	{
		id: "skip",
		name: "Skipping Arrow",
		does: "Hops forward twice, with 3 growing blasts.",
		blastRadius: 26,
		peakDamage: 24,
		price: 120,
		perPurchase: 1,
		level: 2
	},
	{
		id: "goo",
		name: "Sticky Goo Arrow",
		does: "A goo puddle runs into the dip and hurts anyone standing in it.",
		blastRadius: 30,
		peakDamage: 12,
		price: 120,
		perPurchase: 1,
		level: 3
	},
	{
		id: "shaker",
		name: "Earth Shaker",
		does: "Shakes the ground: cliffs crumble and anyone on a ledge tumbles down.",
		blastRadius: 14,
		peakDamage: 10,
		price: 100,
		perPurchase: 1,
		level: 3
	},
	{
		id: "owl",
		name: "Owl Arrow",
		does: "Steers itself toward an archer it passes close to.",
		blastRadius: 24,
		peakDamage: 30,
		price: 250,
		perPurchase: 1,
		level: 3
	},
	{
		id: "firework",
		name: "Firework Arrow",
		does: "5 sparkly pops around where it lands.",
		blastRadius: 18,
		peakDamage: 16,
		price: 180,
		perPurchase: 1,
		level: 4
	},
	{
		id: "sneaky",
		name: "Sneaky Mole",
		does: "Tunnels toward the other archer and pops up under them.",
		blastRadius: 22,
		peakDamage: 35,
		price: 220,
		perPurchase: 1,
		level: 4
	},
	{
		id: "bolt",
		name: "Crossbow Bolt",
		does: "Flies dead straight through dirt. Power sets how far it goes.",
		blastRadius: 14,
		peakDamage: 35,
		price: 150,
		perPurchase: 1,
		level: 4
	},
	{
		id: "giant",
		name: "Giant Arrow",
		does: "A huge blast with a shockwave of leaves and confetti.",
		blastRadius: 75,
		peakDamage: 55,
		price: 400,
		perPurchase: 1,
		level: 5
	},
	{
		id: "glass",
		name: "Glass Arrow",
		does: "Its glass shards stick in them. They must hit you back next turn, or they pop.",
		blastRadius: 26,
		peakDamage: 30,
		price: 500,
		perPurchase: 1,
		level: 5
	}
].map((e) => ({
	forSale: true,
	unlimited: false,
	...e
}));
const BY_ID = new Map(ARROWS.map((a) => [a.id, a]));
function arrowKind(id) {
	const a = BY_ID.get(id);
	if (!a) throw new Error(`no arrow called ${id}`);
	return a;
}
function isArrowId(id) {
	return typeof id === "string" && BY_ID.has(id);
}
/** Can this arrow be used in a fight at all? Only unlimited ones and ones the Armory sells. */
function usable(a) {
	return a.unlimited || a.forSale;
}
/**
* The arrows a bot may choose from: never one that isn't for sale, and never the pupil's Glass Arrow (its
* "hit back or pop" curse is for pupils to use on each other and on bots, not for a bot to use on a pupil).
*/
function botArrows() {
	return ARROWS.filter((a) => usable(a) && a.id !== "glass");
}
//#endregion
//#region shared/archery/random.ts
function makeRandom(seed) {
	let s = seed >>> 0;
	const next = () => {
		s = s + 1831565813 >>> 0;
		let t = s;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return (t ^ t >>> 14) >>> 0;
	};
	return {
		next,
		int: (n) => next() % n,
		range: (lo, hi) => lo + next() % (hi - lo + 1),
		fraction: () => next() / 4294967296,
		state: () => s
	};
}
/** A new seed made from a seed and a number (a round, a retry), mixed so neighbours look unrelated. */
function mixSeed(seed, n) {
	let h = (seed ^ Math.imul(n + 1, 2654435761)) >>> 0;
	h = Math.imul(h ^ h >>> 16, 2246822507) >>> 0;
	h = Math.imul(h ^ h >>> 13, 3266489909) >>> 0;
	return (h ^ h >>> 16) >>> 0;
}
//#endregion
//#region shared/archery/types.ts
const WORLD_IDS = [
	"forest",
	"desert",
	"snow",
	"city"
];
//#endregion
//#region shared/archery/land.ts
/**
* The land: a grid of 3 px cells that blasts carve and some arrows add to (docs/ARCHERY-PLAN.md, sections 2 and 3).
*
* It's made by midpoint displacement from a seed, with no smoothing, so it has Scorched Earth's big
* jagged cliffs and deep narrow valleys (James, 21 Oct 2026). The two archers stand left and right,
* and the land is remade from the next seed until there's a real hill (or building) between them that
* they can't see over, so angle and power both matter.
*
* Each world adds its own twist: Forest trees, Desert sand that slides, Snow's slippery slopes and
* ice blocks, and the City's tough buildings.
*/
function emptyLand() {
	return { cells: new Uint8Array(57600) };
}
function copyLand(land) {
	return { cells: land.cells.slice() };
}
/** The cell at (col, row). Off the sides and above the top is air; below the bottom is solid floor. */
function cellAt(land, col, row) {
	if (row >= 180) return 1;
	if (row < 0 || col < 0 || col >= 320) return 0;
	return land.cells[row * 320 + col];
}
/** Is there land at this point of the field (in pixels)? */
function solidAt(land, x, y) {
	return cellAt(land, Math.floor(x / 3), Math.floor(y / 3)) !== 0;
}
/** The first solid row from the top in a column (ROWS if the column is empty). */
function surfaceRow(land, col) {
	return solidFrom(land, col, 0);
}
/** The first solid row in a column at or below `row` (ROWS if there's none). */
function solidFrom(land, col, row) {
	for (let r = row < 0 ? 0 : row; r < 180; r++) if (land.cells[r * 320 + col] !== 0) return r;
	return 180;
}
/**
* Heights of the land's top edge (px above the bottom) at COLS + 1 points, by midpoint displacement:
* each split moves the middle up or down by up to `scale`, and the scale shrinks by the decay each time.
* Then, if it went past the top or bottom limit, it's squeezed in (not cut off, so peaks stay sharp),
* and if its highest peak is too low, it's stretched up so it fills the screen like Scorched Earth's.
*/
function makeHeights(rng, style = LAND_STYLE.forest) {
	const n = 321;
	const h = new Float64Array(n);
	const lo = LAND_END_LOW * 540;
	h[0] = lo + rng.fraction() * 216;
	h[320] = lo + rng.fraction() * 216;
	const split = (a, b, scale) => {
		if (b - a < 2) return;
		const m = a + b >> 1;
		h[m] = (h[a] + h[b]) / 2 + (rng.fraction() * 2 - 1) * scale;
		split(a, m, scale * style.roughnessDecay);
		split(m, b, scale * style.roughnessDecay);
	};
	split(0, 320, style.startRoughness * 540);
	let min = h[0];
	let max = h[0];
	for (let i = 1; i < n; i++) {
		if (h[i] < min) min = h[i];
		if (h[i] > max) max = h[i];
	}
	const floorH = LAND_MIN_HEIGHT * 540;
	const topH = style.maxHeight * 540;
	const lowPeak = max < style.minPeak * 540;
	if (min < floorH || max > topH || lowPeak) {
		const newMin = min < floorH ? floorH : min;
		const k = max > min ? ((max > topH || lowPeak ? topH : max) - newMin) / (max - min) : 0;
		for (let i = 0; i < n; i++) h[i] = newMin + (h[i] - min) * k;
	}
	return h;
}
/** Fills each column from its height down to the bottom. */
function landFromHeights(h) {
	const land = emptyLand();
	for (let c = 0; c < 320; c++) {
		const height = (h[c] + h[c + 1]) / 2;
		const top = 180 - Math.floor(height / 3);
		for (let r = top < 0 ? 0 : top; r < 180; r++) land.cells[r * 320 + c] = 1;
	}
	return land;
}
/** The first column an archer standing at x covers, and the last. */
function archerCols(x) {
	return [Math.floor((x - 6) / 3), Math.floor((x + 6) / 3) - 1];
}
/** An archer standing on the land with their box starting at column c0. */
function archerAt$1(c0, row) {
	return {
		x: c0 * 3 + 6,
		y: row * 3,
		health: 100,
		shield: 0,
		popped: false
	};
}
/** Makes a flat spot the archer's width at `row`: clears above it, and fills any gap below it with dirt. */
function flatten(land, c0, row) {
	const w = 4;
	for (let c = c0; c < c0 + w; c++) for (let r = 0; r < 180; r++) {
		const i = r * 320 + c;
		if (r < row) land.cells[i] = 0;
		else if (land.cells[i] === 0) land.cells[i] = 1;
	}
}
/**
* Picks a spot in one side's zone. Half the time the archer stays where they landed (a ledge or a
* slope, flattened); the other half they walk downhill to the bottom of a dip, inside the zone.
*/
function pickSpot(land, rng, from, to) {
	let c = rng.range(from, to);
	if (rng.int(2) === 0) for (let guard = 0; guard < 320; guard++) {
		const here = surfaceRow(land, c + 1);
		const left = c > from ? surfaceRow(land, c) : -1;
		const right = c < to ? surfaceRow(land, c + 2) : -1;
		if (left > here && left >= right) c--;
		else if (right > here) c++;
		else break;
	}
	return c;
}
/** Puts the two archers on the land (left, then right) and flattens their spots. */
function placeArchers(land, rng) {
	const left = pickSpot(land, rng, Math.floor(320 * ARCHER_ZONE_FROM), Math.floor(320 * ARCHER_ZONE_TO) - 4);
	const right = pickSpot(land, rng, 224, 297);
	const mid = (c) => surfaceRow(land, c + 2);
	const lRow = mid(left);
	const rRow = mid(right);
	flatten(land, left, lRow);
	flatten(land, right, rRow);
	return [archerAt$1(left, lRow), archerAt$1(right, rRow)];
}
/** Can the two archers see each other (hands to hands) in a straight line with no land in the way? */
function canSee(land, a, b) {
	const ax = a.x, ay = a.y - 15, bx = b.x, by = b.y - 15;
	const dx = bx - ax, dy = by - ay;
	const n = Math.ceil(Math.sqrt(dx * dx + dy * dy));
	for (let i = 1; i < n; i++) if (solidAt(land, ax + dx * i / n, ay + dy * i / n)) return false;
	return true;
}
/** How many px the highest land between the archers rises above the higher archer's feet. */
function hillRise(land, a, b) {
	const [l, r] = a.x < b.x ? [a, b] : [b, a];
	const from = archerCols(l.x)[1] + 1;
	const to = archerCols(r.x)[0] - 1;
	let top = 180;
	for (let c = from; c <= to; c++) {
		const s = surfaceRow(land, c);
		if (s < top) top = s;
	}
	return Math.min(l.y, r.y) - top * 3;
}
/**
* Makes a round's land in a world from its seed, remaking it from the next seed until it's properly hilly.
* The checks look at the land itself (with the City's buildings, which are part of it). The Forest's
* trees and the Snow's ice blocks are added after the checks, so they never stand in for a real hill.
*/
function makeRoundLand(seed, world) {
	let last = null;
	for (let t = 0; t < 40; t++) {
		const rng = makeRandom(mixSeed(seed, t));
		const land = landFromHeights(makeHeights(rng, LAND_STYLE[world]));
		if (world === "city") addBuildings(land, rng);
		const archers = placeArchers(land, rng);
		if (world === "city") lowerBuildingsNear(land, archers);
		const passed = !canSee(land, archers[0], archers[1]) && hillRise(land, archers[0], archers[1]) >= 40;
		last = {
			land,
			archers,
			tries: t + 1,
			passed
		};
		if (passed) break;
	}
	const done = last;
	const extras = makeRandom(mixSeed(seed, 500 + done.tries));
	if (world === "forest") plantTrees(done.land, extras, done.archers);
	else if (world === "snow") placeIce(done.land, extras, done.archers);
	return done;
}
/** Is any column from c0 to c1 within `gap` cells of an archer's box? */
function nearArcher(archers, c0, c1, gap) {
	for (const a of archers) {
		const [a0, a1] = archerCols(a.x);
		if (c1 >= a0 - gap && c0 <= a1 + gap) return true;
	}
	return false;
}
/** The highest and lowest ground (surface rows) across columns c0 to c1. */
function groundSpan(land, c0, c1) {
	let hi = 180, lo = 0;
	for (let c = c0; c <= c1; c++) {
		const s = surfaceRow(land, c);
		if (s < hi) hi = s;
		if (s > lo) lo = s;
	}
	return [hi, lo];
}
/** Fills the air in column c from row `top` down to the first solid cell with `kind`. */
function fillDown(land, c, top, kind) {
	for (let r = top < 0 ? 0 : top; r < 180 && land.cells[r * 320 + c] === 0; r++) land.cells[r * 320 + c] = kind;
}
/**
* The City's buildings: a street of flat-roofed blocks with gaps between them, standing on the ground.
* Their roofs are ledges an archer can stand on. Each column of a building reaches down to the ground,
* so there's never a gap under one.
*/
function addBuildings(land, rng) {
	const topLimit = 180 - Math.floor(LAND_MAX_HEIGHT * 180);
	let c = rng.range(0, 8);
	while (c < 320) {
		const w = rng.range(10, 22);
		const h = rng.range(10, 50);
		const skip = rng.fraction() < BUILDING_SKIP;
		const c1 = c + w - 1 < 320 ? c + w - 1 : 319;
		if (!skip) {
			const [ground] = groundSpan(land, c, c1);
			const roof = ground - h < topLimit ? topLimit : ground - h;
			for (let col = c; col <= c1; col++) fillDown(land, col, roof, 4);
		}
		c = c1 + 1 + rng.range(0, 8);
	}
}
/** Cuts the buildings beside each archer down to a low wall (BUILDING_NEAR, BUILDING_NEAR_RISE). */
function lowerBuildingsNear(land, archers) {
	for (const a of archers) {
		const [a0, a1] = archerCols(a.x);
		const lowest = Math.floor(a.y / 3) - 3;
		for (let c = a0 - 20 < 0 ? 0 : a0 - 20; c <= a1 + 20 && c < 320; c++) for (let r = 0; r < lowest; r++) if (land.cells[r * 320 + c] === 4) land.cells[r * 320 + c] = 0;
	}
}
/**
* The Forest's trees: pine shapes standing on fairly level ground, kept away from the archers. Each
* column of a tree reaches down to the ground, so a tree has no gaps under it.
*/
function plantTrees(land, rng, archers) {
	const want = rng.range(5, 8);
	let planted = 0;
	for (let tries = 0; tries < want * 6 && planted < want; tries++) {
		const half = rng.range(2, 4);
		const height = rng.range(12, 24);
		const c = rng.range(half, 319 - half);
		if (nearArcher(archers, c - half, c + half, 6)) continue;
		const [hi, lo] = groundSpan(land, c - half, c + half);
		if (hi >= 180 || lo - hi > half + 1) continue;
		const base = surfaceRow(land, c);
		for (let dx = -half; dx <= half; dx++) {
			const reach = half + 1 - (dx < 0 ? -dx : dx);
			fillDown(land, c + dx, base - Math.floor(height * reach / (half + 1)), 2);
		}
		planted++;
	}
}
/** The Snow's ice blocks: sitting on the ground, kept away from the archers. */
function placeIce(land, rng, archers) {
	const want = rng.range(3, 6);
	let placed = 0;
	for (let tries = 0; tries < want * 6 && placed < want; tries++) {
		const w = rng.range(4, 8);
		const h = rng.range(3, 6);
		const c0 = rng.range(0, 320 - w);
		const c1 = c0 + w - 1;
		if (nearArcher(archers, c0, c1, 5)) continue;
		const [hi, lo] = groundSpan(land, c0, c1);
		if (hi >= 180 || lo - hi > 4) continue;
		for (let c = c0; c <= c1; c++) fillDown(land, c, hi - h, 3);
		placed++;
	}
}
/** The columns a circle covers, kept inside the field. */
function circleCols(x, r) {
	const c0 = Math.floor((x - r) / 3);
	const c1 = Math.floor((x + r) / 3);
	return [c0 < 0 ? 0 : c0, c1 >= 320 ? 319 : c1];
}
/** The rows a circle covers, kept inside the field. */
function circleRows(y, r) {
	const r0 = Math.floor((y - r) / 3);
	const r1 = Math.floor((y + r) / 3);
	return [r0 < 0 ? 0 : r0, r1 >= 180 ? 179 : r1];
}
/**
* A blast at (x, y) of radius r: clears dirt and ice whose middle is within r px. Trees are easy to blast
* away (TREE_BLAST_SCALE × r) and buildings are tough, so only a chip comes off (BUILDING_CHIP × r).
* Returns the columns it reached.
*/
function carve(land, x, y, r) {
	const reach = r * TREE_BLAST_SCALE;
	const [c0, c1] = circleCols(x, reach);
	const [r0, r1] = circleRows(y, reach);
	const rr = r * r;
	const rt = reach * reach;
	const rb = r * BUILDING_CHIP * (r * BUILDING_CHIP);
	for (let row = r0; row <= r1; row++) {
		const cy = row * 3 + 3 / 2 - y;
		for (let col = c0; col <= c1; col++) {
			const i = row * 320 + col;
			const v = land.cells[i];
			if (v === 0) continue;
			const cx = col * 3 + 3 / 2 - x;
			if (cx * cx + cy * cy <= (v === 2 ? rt : v === 4 ? rb : rr)) land.cells[i] = 0;
		}
	}
	return [c0, c1];
}
/** Adds a ball of dirt of radius r at (x, y) (only into air). Returns the columns it touched. */
function addDirt(land, x, y, r) {
	const [c0, c1] = circleCols(x, r);
	const [r0, r1] = circleRows(y, r);
	const rr = r * r;
	for (let row = r0; row <= r1; row++) {
		const cy = row * 3 + 3 / 2 - y;
		for (let col = c0; col <= c1; col++) {
			const cx = col * 3 + 3 / 2 - x;
			const i = row * 320 + col;
			if (cx * cx + cy * cy <= rr && land.cells[i] === 0) land.cells[i] = 1;
		}
	}
	return [c0, c1];
}
/** Does this kind of cell fall when there's nothing under it? Dirt and trees do; ice and buildings stay put. */
function falls(kind) {
	return kind === 1 || kind === 2;
}
/**
* Loose dirt falls: in each column from c0 to c1, any dirt (or tree) with a gap under it drops until it
* lands. Ice and buildings stay put and hold up what's on them. Returns true if anything moved.
*/
function settle(land, c0, c1) {
	let moved = false;
	for (let c = c0 < 0 ? 0 : c0; c <= c1 && c < 320; c++) {
		let w = 179;
		for (let r = 179; r >= 0; r--) {
			const i = r * 320 + c;
			const v = land.cells[i];
			if (v === 0) continue;
			if (!falls(v)) {
				w = r - 1;
				continue;
			}
			if (r !== w) {
				land.cells[w * 320 + c] = v;
				land.cells[i] = 0;
				moved = true;
			}
			w--;
		}
	}
	return moved;
}
/** Is the cell (col, row) inside the box of an archer who's still in the round? */
function inArcherCell(archers, col, row) {
	for (const a of archers) {
		if (a.popped) continue;
		const [a0, a1] = archerCols(a.x);
		if (col < a0 || col > a1) continue;
		const feet = Math.floor(a.y / 3);
		if (row >= feet - 8 && row < feet) return true;
	}
	return false;
}
/**
* The Desert's sand slides: within SAND_REACH columns of what a blast touched, a column of sand that
* stands more than SAND_MAX_STEP cells above a neighbour drops its top cell onto that neighbour, until
* nothing more can slide (at most SAND_MAX_MOVES cells). Only sand (dirt) slides, never into an archer.
* The Earth Shaker uses the same crumbling with its own reach, step and limit, in every world.
* Returns how many cells moved.
*/
function slideSand(land, c0, c1, archers, reach = 12, maxStep = 2, maxMoves = SAND_MAX_MOVES) {
	const lo = c0 - reach < 0 ? 0 : c0 - reach;
	const hi = c1 + reach >= 320 ? 319 : c1 + reach;
	const top = new Int32Array(hi - lo + 1);
	for (let c = lo; c <= hi; c++) top[c - lo] = surfaceRow(land, c);
	let moves = 0;
	let moved = true;
	while (moved && moves < maxMoves) {
		moved = false;
		for (let c = lo; c <= hi && moves < maxMoves; c++) {
			const t = top[c - lo];
			if (t >= 180 || land.cells[t * 320 + c] !== 1) continue;
			let to = -1;
			let toTop = t + maxStep;
			if (c > lo && top[c - 1 - lo] > toTop) {
				to = c - 1;
				toTop = top[c - 1 - lo];
			}
			if (c < hi && top[c + 1 - lo] > toTop) {
				to = c + 1;
				toTop = top[c + 1 - lo];
			}
			if (to < 0 || inArcherCell(archers, to, toTop - 1)) continue;
			land.cells[t * 320 + c] = 0;
			land.cells[(toTop - 1) * 320 + to] = 1;
			top[c - lo] = solidFrom(land, c, t + 1);
			top[to - lo] = toTop - 1;
			moved = true;
			moves++;
		}
	}
	return moves;
}
/** Is there land (or the bottom of the field) right under the archer's feet? */
function standing(land, a) {
	const row = Math.floor(a.y / 3);
	const [c0, c1] = archerCols(a.x);
	for (let c = c0; c <= c1; c++) if (cellAt(land, c, row) !== 0) return true;
	return false;
}
/**
* Drops an archer with nothing under them until they land, and returns how many cells they fell.
* Their feet stay on the cell grid. The caller turns the fall into damage (`fallDamage`).
*/
function dropArcher(land, a) {
	let fell = 0;
	while (!standing(land, a)) {
		a.y += 3;
		fell++;
	}
	return fell;
}
/** Is the archer's box at (x, y) inside the field and clear of land? */
function boxClear(land, x, y) {
	const [c0, c1] = archerCols(x);
	if (c0 < 0 || c1 >= 320) return false;
	const feet = Math.floor(y / 3);
	for (let r = feet - 8; r < feet; r++) for (let c = c0; c <= c1; c++) if (cellAt(land, c, r) !== 0) return false;
	return true;
}
/** How many cells an archer at (x, y) would fall before landing. */
function dropDepth(land, x, y) {
	return dropArcher(land, {
		x,
		y,
		health: 0,
		shield: 0,
		popped: false
	});
}
/**
* Snow is slippery: an archer standing on a slope slides downhill, one cell at a time, falling as they
* go, until they're on level ground, in a dip, against a wall or another archer, or SNOW_SLIDE_MAX
* cells on. A step "downhill" is one that drops them at least a cell; if both ways do, the deeper one
* wins (the left on a tie). Returns how far they slid and each drop on the way (for fall damage).
*/
function slideArcher(land, archers, i) {
	const a = archers[i];
	const drops = [];
	let slid = 0;
	for (; slid < 40; slid++) {
		let dir = 0;
		let deepest = 0;
		for (const d of [-1, 1]) {
			const nx = a.x + d * 3;
			if (!boxClear(land, nx, a.y)) continue;
			let blocked = false;
			for (let j = 0; j < archers.length; j++) {
				const b = archers[j];
				if (j !== i && !b.popped && Math.abs(b.x - nx) < 12 && Math.abs(b.y - a.y) < 24) blocked = true;
			}
			if (blocked) continue;
			const depth = dropDepth(land, nx, a.y);
			if (depth > deepest) {
				deepest = depth;
				dir = d;
			}
		}
		if (dir === 0) break;
		a.x += dir * 3;
		drops.push(dropArcher(land, a));
	}
	return {
		slid,
		drops
	};
}
/** True if a point (in px) is inside an archer's box. */
function inArcherBox(a, x, y) {
	return x >= a.x - 6 && x < a.x + 6 && y >= a.y - 24 && y < a.y;
}
/** How many cells of fall count for damage. */
function fallCells(fell) {
	return fell > 2 ? fell : 0;
}
//#endregion
//#region shared/archery/damage.ts
/**
* Damage (docs/ARCHERY-PLAN.md, section 2). A blast's damage fades in a straight line from its
* peak at the centre to nothing at its edge. A direct hit adds a small bonus. Shields take damage
* first. One shot can never take more than MAX_SHOT_DAMAGE from one archer, which is less than a
* full archer's health, so no single arrow is ever a knock-out. At 0 health an archer pops.
*/
/** Rounds half up to a whole number (exact everywhere). */
function whole(n) {
	return Math.floor(n + .5);
}
/** How far (px) a point is from the nearest part of an archer's box (0 inside it). */
function distanceToArcher(a, x, y) {
	const left = a.x - 6;
	const right = a.x + 6;
	const top = a.y - 24;
	const dx = x < left ? left - x : x > right ? x - right : 0;
	const dy = y < top ? top - y : y > a.y ? y - a.y : 0;
	return Math.sqrt(dx * dx + dy * dy);
}
/** A blast's damage to one archer: `peak` at the centre, fading to 0 at `radius`. */
function blastDamage(a, x, y, radius, peak) {
	if (radius <= 0 || peak <= 0) return 0;
	const d = distanceToArcher(a, x, y);
	if (d >= radius) return 0;
	return whole(peak * (1 - d / radius));
}
/** Damage for a fall of this many cells (short steps are free, long falls are capped). */
function fallDamage(cells) {
	const d = fallCells(cells) * 1;
	return d > 25 ? 25 : d;
}
/** One shot's total for one archer, kept to the most a shot may ever do. */
function capShotDamage(total) {
	return total > 70 ? 70 : total < 0 ? 0 : total;
}
/**
* Takes `amount` from the archer: shield first, the rest from health. At 0 health the archer pops.
* Returns how much was actually taken (health plus shield).
*/
function hurt(a, amount) {
	if (a.popped || amount <= 0) return 0;
	const fromShield = amount < a.shield ? amount : a.shield;
	a.shield -= fromShield;
	const rest = amount - fromShield;
	const fromHealth = rest < a.health ? rest : a.health;
	a.health -= fromHealth;
	if (a.health <= 0) {
		a.health = 0;
		a.popped = true;
	}
	return fromShield + fromHealth;
}
//#endregion
//#region shared/archery/aim.ts
/**
* Aim directions, one per whole degree from 0 (right) to 180 (left), with 90 straight up.
* Written by scripts/archery-aim-table.mjs and checked in as plain numbers, so nothing works out
* a sine or cosine while the game runs (aim.test.ts checks they match Math.cos and Math.sin).
*/
/** How far right each degree points (cos). */
const AIM_X = [
	1,
	.999847695156391,
	.999390827019096,
	.998629534754574,
	.997564050259824,
	.996194698091746,
	.994521895368273,
	.992546151641322,
	.99026806874157,
	.987688340595138,
	.984807753012208,
	.981627183447664,
	.978147600733806,
	.974370064785235,
	.970295726275996,
	.965925826289068,
	.961261695938319,
	.956304755963035,
	.951056516295154,
	.945518575599317,
	.939692620785908,
	.933580426497202,
	.927183854566787,
	.92050485345244,
	.913545457642601,
	.90630778703665,
	.898794046299167,
	.891006524188368,
	.882947592858927,
	.874619707139396,
	.866025403784439,
	.857167300702112,
	.848048096156426,
	.838670567945424,
	.829037572555042,
	.819152044288992,
	.809016994374947,
	.798635510047293,
	.788010753606722,
	.777145961456971,
	.766044443118978,
	.754709580222772,
	.743144825477394,
	.731353701619171,
	.719339800338651,
	.707106781186548,
	.694658370458997,
	.681998360062498,
	.669130606358858,
	.656059028990507,
	.642787609686539,
	.629320391049838,
	.615661475325658,
	.601815023152048,
	.587785252292473,
	.573576436351046,
	.559192903470747,
	.544639035015027,
	.529919264233205,
	.515038074910054,
	.5,
	.484809620246337,
	.469471562785891,
	.453990499739547,
	.438371146789077,
	.422618261740699,
	.4067366430758,
	.390731128489274,
	.374606593415912,
	.3583679495453,
	.342020143325669,
	.325568154457157,
	.309016994374947,
	.292371704722737,
	.275637355816999,
	.258819045102521,
	.241921895599668,
	.224951054343865,
	.207911690817759,
	.190808995376545,
	.17364817766693,
	.156434465040231,
	.139173100960066,
	.121869343405147,
	.104528463267653,
	.087155742747658,
	.069756473744125,
	.052335956242944,
	.034899496702501,
	.017452406437283,
	0,
	-.017452406437283,
	-.034899496702501,
	-.052335956242944,
	-.069756473744125,
	-.087155742747658,
	-.104528463267653,
	-.121869343405147,
	-.139173100960065,
	-.156434465040231,
	-.17364817766693,
	-.190808995376545,
	-.207911690817759,
	-.224951054343865,
	-.241921895599668,
	-.258819045102521,
	-.275637355816999,
	-.292371704722737,
	-.309016994374947,
	-.325568154457156,
	-.342020143325669,
	-.3583679495453,
	-.374606593415912,
	-.390731128489274,
	-.4067366430758,
	-.422618261740699,
	-.438371146789078,
	-.453990499739547,
	-.469471562785891,
	-.484809620246337,
	-.5,
	-.515038074910054,
	-.529919264233205,
	-.544639035015027,
	-.559192903470747,
	-.573576436351046,
	-.587785252292473,
	-.601815023152048,
	-.615661475325658,
	-.629320391049837,
	-.642787609686539,
	-.656059028990507,
	-.669130606358858,
	-.681998360062498,
	-.694658370458997,
	-.707106781186547,
	-.719339800338651,
	-.73135370161917,
	-.743144825477394,
	-.754709580222772,
	-.766044443118978,
	-.777145961456971,
	-.788010753606722,
	-.798635510047293,
	-.809016994374947,
	-.819152044288992,
	-.829037572555042,
	-.838670567945424,
	-.848048096156426,
	-.857167300702112,
	-.866025403784439,
	-.874619707139396,
	-.882947592858927,
	-.891006524188368,
	-.898794046299167,
	-.90630778703665,
	-.913545457642601,
	-.92050485345244,
	-.927183854566787,
	-.933580426497202,
	-.939692620785908,
	-.945518575599317,
	-.951056516295154,
	-.956304755963035,
	-.961261695938319,
	-.965925826289068,
	-.970295726275996,
	-.974370064785235,
	-.978147600733806,
	-.981627183447664,
	-.984807753012208,
	-.987688340595138,
	-.99026806874157,
	-.992546151641322,
	-.994521895368273,
	-.996194698091746,
	-.997564050259824,
	-.998629534754574,
	-.999390827019096,
	-.999847695156391,
	-1
];
/** How far up each degree points (sin). Screens' y grows downwards, so a shot's vy starts at −AIM_Y. */
const AIM_Y = [
	0,
	.017452406437284,
	.034899496702501,
	.052335956242944,
	.069756473744125,
	.087155742747658,
	.104528463267653,
	.121869343405147,
	.139173100960065,
	.156434465040231,
	.17364817766693,
	.190808995376545,
	.207911690817759,
	.224951054343865,
	.241921895599668,
	.258819045102521,
	.275637355816999,
	.292371704722737,
	.309016994374947,
	.325568154457157,
	.342020143325669,
	.3583679495453,
	.374606593415912,
	.390731128489274,
	.4067366430758,
	.422618261740699,
	.438371146789077,
	.453990499739547,
	.469471562785891,
	.484809620246337,
	.5,
	.515038074910054,
	.529919264233205,
	.544639035015027,
	.559192903470747,
	.573576436351046,
	.587785252292473,
	.601815023152048,
	.615661475325658,
	.629320391049837,
	.642787609686539,
	.656059028990507,
	.669130606358858,
	.681998360062498,
	.694658370458997,
	.707106781186547,
	.719339800338651,
	.73135370161917,
	.743144825477394,
	.754709580222772,
	.766044443118978,
	.777145961456971,
	.788010753606722,
	.798635510047293,
	.809016994374947,
	.819152044288992,
	.829037572555042,
	.838670567945424,
	.848048096156426,
	.857167300702112,
	.866025403784439,
	.874619707139396,
	.882947592858927,
	.891006524188368,
	.898794046299167,
	.90630778703665,
	.913545457642601,
	.92050485345244,
	.927183854566787,
	.933580426497202,
	.939692620785908,
	.945518575599317,
	.951056516295154,
	.956304755963035,
	.961261695938319,
	.965925826289068,
	.970295726275996,
	.974370064785235,
	.978147600733806,
	.981627183447664,
	.984807753012208,
	.987688340595138,
	.99026806874157,
	.992546151641322,
	.994521895368273,
	.996194698091746,
	.997564050259824,
	.998629534754574,
	.999390827019096,
	.999847695156391,
	1,
	.999847695156391,
	.999390827019096,
	.998629534754574,
	.997564050259824,
	.996194698091746,
	.994521895368273,
	.992546151641322,
	.99026806874157,
	.987688340595138,
	.984807753012208,
	.981627183447664,
	.978147600733806,
	.974370064785235,
	.970295726275996,
	.965925826289068,
	.961261695938319,
	.956304755963036,
	.951056516295154,
	.945518575599317,
	.939692620785908,
	.933580426497202,
	.927183854566787,
	.92050485345244,
	.913545457642601,
	.90630778703665,
	.898794046299167,
	.891006524188368,
	.882947592858927,
	.874619707139396,
	.866025403784439,
	.857167300702112,
	.848048096156426,
	.838670567945424,
	.829037572555042,
	.819152044288992,
	.809016994374947,
	.798635510047293,
	.788010753606722,
	.777145961456971,
	.766044443118978,
	.754709580222772,
	.743144825477394,
	.731353701619171,
	.719339800338651,
	.707106781186548,
	.694658370458997,
	.681998360062499,
	.669130606358858,
	.656059028990507,
	.642787609686539,
	.629320391049838,
	.615661475325658,
	.601815023152048,
	.587785252292473,
	.573576436351046,
	.559192903470747,
	.544639035015027,
	.529919264233205,
	.515038074910054,
	.5,
	.484809620246337,
	.469471562785891,
	.453990499739547,
	.438371146789077,
	.422618261740699,
	.4067366430758,
	.390731128489274,
	.374606593415912,
	.3583679495453,
	.342020143325669,
	.325568154457157,
	.309016994374948,
	.292371704722737,
	.275637355817,
	.258819045102521,
	.241921895599668,
	.224951054343865,
	.207911690817759,
	.190808995376545,
	.17364817766693,
	.156434465040231,
	.139173100960066,
	.121869343405148,
	.104528463267654,
	.087155742747659,
	.069756473744126,
	.052335956242944,
	.034899496702501,
	.017452406437283,
	0
];
/** A whole-degree angle kept to 0–180. */
function clampAngle(angle) {
	const a = Math.floor(angle);
	return a < 0 ? 0 : a > 180 ? 180 : a;
}
//#endregion
//#region shared/archery/gear.ts
const SHIELDS = [
	{
		id: "wood",
		name: "Wooden Shield",
		does: "Soaks 40 damage, then breaks.",
		soak: 40,
		price: 100,
		level: 1
	},
	{
		id: "charm",
		name: "Wind Charm",
		does: "Soaks 30. Until it breaks, its wind lifts arrows that come down on you.",
		soak: 30,
		price: 150,
		level: 2
	},
	{
		id: "bubble",
		name: "Bubble Shield",
		does: "Soaks 60, and bounces away the first arrow that reaches it.",
		soak: 60,
		price: 250,
		level: 3
	}
];
const HELPERS = [{
	id: "apple",
	name: "Apple",
	does: "Eat it on your turn for +15 health.",
	price: 50,
	level: 1
}, {
	id: "umbrella",
	name: "Umbrella",
	does: "Opens by itself when you fall, so the fall doesn't hurt.",
	price: 40,
	level: 1
}];
const BOWS = [
	{
		id: "starter",
		name: "Starter Bow",
		does: "Your trusty bow.",
		power: 1,
		wind: 1,
		price: 0
	},
	{
		id: "long",
		name: "Longbow",
		does: "10% more top power: reach the far side in a strong headwind.",
		power: 1.1,
		wind: 1,
		price: 300
	},
	{
		id: "recurve",
		name: "Recurve Bow",
		does: "Faster arrows that drift less in the wind.",
		power: 1.05,
		wind: .7,
		price: 400
	},
	{
		id: "hunter",
		name: "Hunter's Bow",
		does: "Shows what the wind will be next round.",
		power: 1,
		wind: 1,
		price: 250
	},
	{
		id: "golden",
		name: "Golden Bow",
		does: "Looks amazing. 10% more top power and a little less drift.",
		power: 1.1,
		wind: .85,
		price: 600
	}
];
const SHIELD_BY = new Map(SHIELDS.map((s) => [s.id, s]));
const BOW_BY = new Map(BOWS.map((b) => [b.id, b]));
const HELPER_BY = new Map(HELPERS.map((h) => [h.id, h]));
function shieldKind(id) {
	const s = SHIELD_BY.get(id);
	if (!s) throw new Error(`no shield called ${id}`);
	return s;
}
function bowKind(id) {
	return BOW_BY.get(id ?? "starter") ?? BOWS[0];
}
function isShieldId(id) {
	return typeof id === "string" && SHIELD_BY.has(id);
}
function isBowId(id) {
	return typeof id === "string" && BOW_BY.has(id);
}
function isHelperId(id) {
	return typeof id === "string" && HELPER_BY.has(id);
}
//#endregion
//#region shared/archery/shot.ts
/**
* Flies one arrow (docs/ARCHERY-PLAN.md, section 2): a fixed time step, gravity and wind, checked
* against each archer's box and the land cells every step. It moves at most 2.5 px a step (full
* power), less than one 3 px cell, so it can't skip through a thin wall.
*
* The path is only for drawing the flight. James (21 Oct 2026): no aiming help, so screens fade it
* within half a second and never keep it on screen.
*/
/** A whole-number power kept to 0–100. */
function clampPower(power) {
	const p = Math.floor(power);
	return p < 0 ? 0 : p > 100 ? 100 : p;
}
/** Where an archer's arrow starts, and how fast it's going (px, px/s). Their bow can add speed. */
function launch(a, angle, power) {
	const d = clampAngle(angle);
	const dx = AIM_X[d];
	const dy = -AIM_Y[d];
	const speed = clampPower(power) * 6 * bowKind(a.bow).power;
	return {
		x: a.x + dx * 4,
		y: a.y - 15 + dy * 4,
		vx: dx * speed,
		vy: dy * speed
	};
}
/** The kind of land cell at a point of the field (in pixels). */
function kindAt(land, x, y) {
	return cellAt(land, Math.floor(x / 3), Math.floor(y / 3));
}
/** Is this archer's Bubble Shield still able to bounce an arrow? */
const bubbleUp = (a) => a.guard === "bubble" && !!a.bubble && a.shield > 0 && !a.popped;
/** Is this archer's Wind Charm still working? */
const charmUp = (a) => a.guard === "charm" && a.shield > 0 && !a.popped;
/**
* Flies an arrow from `start` until it hits an archer, the land or the bottom, leaves the sides, or runs
* out of time (or splits, or runs out of range, as `opts` says). The shooter's own box only counts once the
* arrow has left it (so a shot straight up can come down on its own archer). Popped archers don't stop arrows.
*
* Snow's ice blocks bounce an arrow once: it goes back to where it was a step before and flips the part of
* its speed that ran into the ice (sideways, up-and-down, or both at a corner), keeping ICE_BOUNCE of its
* speed. The second time it meets ice, it stops there like on any land.
*
* The other archer's shield can push back: a Wind Charm lifts and pushes away an arrow coming down near them,
* and a Bubble Shield bounces the first arrow of the round that reaches it (this changes the archer: their
* `bubble` is used up).
*/
function fly(land, archers, shooter, start, wind, opts = {}) {
	let { x, y, vx, vy } = start;
	const gravity = opts.gravity === false ? 0 : 300;
	const ax = wind * 6 * (opts.windScale ?? 1);
	const maxSteps = opts.maxSteps ?? 4800;
	const path = [x, y];
	let armed = opts.armed ?? !inArcherBox(archers[shooter], x, y);
	let canIce = opts.iceBounce ?? true;
	let bounce = null;
	const bubbles = [];
	let cutSteps = 0;
	const done = (kind, steps, archer = null) => {
		if (path[path.length - 2] !== x || path[path.length - 1] !== y) path.push(x, y);
		return {
			hit: {
				kind,
				x,
				y,
				archer,
				steps
			},
			bounce,
			path,
			end: {
				x,
				y,
				vx,
				vy
			},
			bubbles
		};
	};
	if (solidAt(land, x, y) && !opts.cut) return done("land", 0);
	for (let step = 1; step <= maxSteps; step++) {
		let axs = ax;
		let ays = gravity;
		if (vy > 0) for (let i = 0; i < archers.length; i++) {
			const a = archers[i];
			if (i === shooter) continue;
			if (charmUp(a) && y < a.y) {
				const dx = x - a.x;
				if (dx < 70 && dx > -70) {
					ays -= 350;
					axs += (dx > 0 || dx === 0 && vx >= 0 ? 1 : -1) * 250;
				}
			}
			if (opts.steer && !a.popped) {
				const tx = a.x - x;
				const ty = a.y - 12 - y;
				const d = Math.sqrt(tx * tx + ty * ty);
				if (d > 0 && d < 90) {
					axs += tx / d * OWL_PULL;
					ays += ty / d * OWL_PULL;
				}
			}
		}
		vx += axs * DT;
		vy += ays * DT;
		if (opts.apex && vy >= 0) return done("split", step);
		const px = x;
		const py = y;
		x += vx * DT;
		y += vy * DT;
		if (step % 4 === 0) path.push(x, y);
		if (x < -0 || x >= 960) return done("gone", step);
		if (y >= 540) {
			y = 540;
			return done("floor", step);
		}
		for (let i = 0; i < archers.length; i++) {
			const a = archers[i];
			if (a.popped) continue;
			if (i === shooter && !armed) {
				if (!inArcherBox(a, x, y)) armed = true;
				continue;
			}
			if (i !== shooter && bubbleUp(a)) {
				const cx = x - a.x;
				const cy = y - (a.y - 12);
				const d2 = cx * cx + cy * cy;
				if (d2 < 576) {
					const d = Math.sqrt(d2) || 1;
					const nx = cx / d;
					const ny = cy / d;
					const dot = vx * nx + vy * ny;
					if (dot < 0) {
						vx = (vx - 2 * dot * nx) * BUBBLE_KEEP;
						vy = (vy - 2 * dot * ny) * BUBBLE_KEEP;
					}
					a.bubble = false;
					x = px;
					y = py;
					bubbles.push([
						x,
						y,
						step
					]);
					path.push(x, y);
					continue;
				}
			}
			if (inArcherBox(a, x, y)) return done("archer", step, i);
		}
		if (step === maxSteps && opts.maxSteps !== void 0) return done("spent", step);
		if (!solidAt(land, x, y)) continue;
		const kind = kindAt(land, x, y);
		if (opts.cut && kind !== 3 && kind !== 4 && kind !== 0) {
			if (cutSteps++ >= (opts.cutMost ?? 0)) return done("land", step);
			opts.cut(x, y);
			continue;
		}
		if (!canIce || kind !== 3) return done("land", step);
		const side = solidAt(land, x, py);
		const top = solidAt(land, px, y);
		if (side || !top) vx = -vx;
		if (top || !side) vy = -vy;
		vx *= ICE_BOUNCE;
		vy *= ICE_BOUNCE;
		x = px;
		y = py;
		canIce = false;
		bounce = [x, y];
		path.push(x, y);
	}
	return done(opts.maxSteps !== void 0 ? "spent" : "timeout", maxSteps);
}
//#endregion
//#region shared/archery/effects.ts
/**
* What every arrow does (docs/ARCHERY-PLAN.md, section 4): its flight and what happens where it lands.
* `runArrow` plays one shot's arrow on the round's land and archers, adding up the raw damage each archer
* takes; `fight.ts` then lets dirt fall, archers fall, caps the damage and applies it.
*
* Same rules as the rest of the engine: only + − × ÷, square root and floor, no Math.random, so a replay
* on the server gives exactly the same result. Each arrow is one small function.
*/
const WIND_OF = (w) => w.round.wind;
function touch(w, [a, b]) {
	if (a < w.c0) w.c0 = a;
	if (b > w.c1) w.c1 = b;
}
function note(w, e) {
	if (w.events) w.events.push(e);
}
/** A blast at (x, y): hurts archers within `radius` (fading from `peak`), and clears the land unless `carveIt` is false. */
function blast(w, t, x, y, radius, peak, carveIt = true) {
	for (let i = 0; i < w.archers.length; i++) {
		const a = w.archers[i];
		if (a.popped) continue;
		if (i === w.shooter && w.spareShooter) continue;
		const d = blastDamage(a, x, y, radius, peak);
		w.raw[i] += d;
		if (d > 0 && w.arrow.id === "glass" && i !== w.shooter) w.stabbed[i] = true;
	}
	if (carveIt && radius > 0) touch(w, carve(w.land, x, y, radius));
	note(w, {
		k: "blast",
		t,
		x,
		y,
		r: radius,
		carve: carveIt
	});
}
function bonus(w, hit) {
	if (hit.kind !== "archer" || hit.archer === null) return;
	if (w.archers[hit.archer].popped) return;
	w.raw[hit.archer] += 10;
	if (w.arrow.id === "glass" && hit.archer !== w.shooter) w.stabbed[hit.archer] = true;
}
const landed = (h) => h.kind === "land" || h.kind === "archer" || h.kind === "floor";
/** Flies a part of the shot, notes it for drawing, and returns it. The first flight is the main one. */
function flight(w, t, start, opts, part) {
	const a = w.archers[w.shooter];
	const f = fly(w.land, w.archers, w.shooter, start, WIND_OF(w), {
		windScale: bowKind(a.bow).wind,
		...opts
	});
	if (part === "main") {
		w.hit = f.hit;
		w.bounce = f.bounce;
		w.path = f.path;
		if (f.hit.kind === "land" && f.hit.steps <= 12) w.spareShooter = true;
	}
	if (w.events) {
		note(w, {
			k: "fly",
			t,
			path: f.path,
			part
		});
		if (f.bounce) note(w, {
			k: "bounce",
			t: t + stepOfPoint(f.path, f.bounce),
			x: f.bounce[0],
			y: f.bounce[1],
			what: "ice"
		});
		for (const [x, y, s] of f.bubbles) note(w, {
			k: "bounce",
			t: t + s,
			x,
			y,
			what: "bubble"
		});
	}
	return f;
}
/** Roughly when a flight passed a point of its path (for drawing only). */
function stepOfPoint(path, [x, y]) {
	for (let i = 0; i < path.length; i += 2) if (path[i] === x && path[i + 1] === y) return i / 2 * 4;
	return 0;
}
/** The normal landing: one blast of the arrow's size where it hit, plus the direct-hit bonus. */
function burst(w, t, hit, radius = w.arrow.blastRadius, peak = w.arrow.peakDamage) {
	if (!landed(hit) && hit.kind !== "spent") return;
	blast(w, t, hit.x, hit.y, radius, peak);
	bonus(w, hit);
}
function plain(w, start, opts = {}) {
	const f = flight(w, 0, start, opts, "main");
	burst(w, f.hit.steps, f.hit);
}
/** Arrow Rain: splits at the top of its flight into RAIN_PIECES small arrows, spread sideways. */
function rain(w, start) {
	const f = flight(w, 0, start, { apex: true }, "main");
	if (f.hit.kind !== "split") {
		burst(w, f.hit.steps, f.hit);
		return;
	}
	const t0 = f.hit.steps;
	const mid = 2;
	for (let k = 0; k < 5; k++) {
		const piece = flight(w, t0, {
			x: f.end.x,
			y: f.end.y,
			vx: f.end.vx + (k - mid) * 28,
			vy: f.end.vy
		}, { armed: true }, "child");
		if (k === mid) w.hit = {
			...piece.hit,
			steps: t0 + piece.hit.steps
		};
		burst(w, t0 + piece.hit.steps, piece.hit);
	}
}
/** Rolling Log: lands, then rolls along the land, bursting in a dip, against a wall, or at an archer. */
function log(w, start) {
	const f = flight(w, 0, start, {}, "main");
	const hit = f.hit;
	if (hit.kind !== "land") {
		burst(w, hit.steps, hit);
		return;
	}
	let col = clampCol(Math.floor(hit.x / 3));
	let top = solidBelow(w.land, col, Math.floor(hit.y / 3) - 1);
	const left = surfaceAt(w.land, col - 1, top);
	const right = surfaceAt(w.land, col + 1, top);
	let dir = right > left ? 1 : left > right ? -1 : f.end.vx >= 0 ? 1 : -1;
	let speed = 4 + Math.floor((f.end.vx < 0 ? -f.end.vx : f.end.vx) / 40);
	const path = [col * 3 + 3 / 2, top * 3];
	let at = {
		kind: "land",
		x: col * 3 + 3 / 2,
		y: top * 3,
		archer: null,
		steps: hit.steps
	};
	for (let n = 0; n < 320 && speed > 0; n++) {
		const next = col + dir;
		if (next < 0 || next >= 320) break;
		if (cellAt(w.land, next, top - 1) !== 0 && cellAt(w.land, next, top - 2) !== 0) break;
		const nt = solidBelow(w.land, next, top - 2);
		if (nt >= 180) break;
		speed += nt - top - LOG_FRICTION;
		if (speed > 30) speed = 30;
		col = next;
		top = nt;
		const x = col * 3 + 3 / 2;
		const y = top * 3;
		path.push(x, y);
		at = {
			kind: "land",
			x,
			y,
			archer: null,
			steps: hit.steps + (path.length / 2 - 1) * 4
		};
		const struck = archerAt(w, x, y - 4);
		if (struck !== null) {
			at = {
				...at,
				kind: "archer",
				archer: struck
			};
			break;
		}
	}
	if (at.kind === "land") {
		const way = downhill(w.land, col, top);
		for (let n = 0; way !== 0 && n < 320; n++) {
			const c = col + way;
			if (c < 0 || c >= 320 || cellAt(w.land, c, top - 1) !== 0) break;
			const nt = solidBelow(w.land, c, top - 1);
			if (nt >= 180) break;
			col = c;
			top = nt;
			const x = col * 3 + 3 / 2;
			const y = top * 3;
			path.push(x, y);
			at = {
				kind: "land",
				x,
				y,
				archer: null,
				steps: hit.steps + (path.length / 2 - 1) * 4
			};
			const struck = archerAt(w, x, y - 4);
			if (struck !== null) {
				at = {
					...at,
					kind: "archer",
					archer: struck
				};
				break;
			}
		}
	}
	note(w, {
		k: "roll",
		t: hit.steps,
		path
	});
	burst(w, at.steps, at);
}
/** Mole Arrow: digs a tunnel straight down from where it lands. */
function mole(w, start) {
	const f = flight(w, 0, start, {}, "main");
	const hit = digFrom(w, f.hit);
	if (!hit) {
		burst(w, f.hit.steps, f.hit);
		return;
	}
	bonus(w, f.hit);
	const path = [];
	let y = hit.y;
	for (let d = 0; d <= 96; d += 3) {
		y = hit.y + d;
		touch(w, carve(w.land, hit.x, y, 7));
		path.push(hit.x, y);
	}
	note(w, {
		k: "dig",
		t: hit.steps,
		path,
		r: 7
	});
	blast(w, hit.steps + path.length / 2 * 4, hit.x, y, w.arrow.blastRadius, w.arrow.peakDamage);
}
/** Sneaky Mole: lands, tunnels toward the other archer, and pops up under them. */
function sneaky(w, start) {
	const f = flight(w, 0, start, {}, "main");
	const hit = digFrom(w, f.hit);
	const target = otherArcher(w);
	if (!hit || target === null) {
		burst(w, f.hit.steps, f.hit);
		return;
	}
	const a = w.archers[target];
	let tx = a.x - hit.x;
	let ty = a.y + 4 - hit.y;
	const d = Math.sqrt(tx * tx + ty * ty);
	if (d > 150) {
		tx = tx / d * 150;
		ty = ty / d * 150;
	}
	const n = Math.floor((d > 150 ? 150 : d) / 3);
	const path = [hit.x, hit.y];
	for (let k = 1; k <= n; k++) {
		const x = hit.x + tx * k / (n || 1);
		const y = hit.y + ty * k / (n || 1);
		touch(w, carve(w.land, x, y, 5));
		path.push(x, y);
	}
	const ex = hit.x + tx;
	const ey = hit.y + ty;
	note(w, {
		k: "dig",
		t: hit.steps,
		path,
		r: 5
	});
	blast(w, hit.steps + path.length / 2 * 4, ex, ey, w.arrow.blastRadius, w.arrow.peakDamage);
}
/** Skipping Arrow: lands, then hops forward twice, a bigger blast each time. */
function skip(w, start) {
	let f = flight(w, 0, start, {}, "main");
	let t = 0;
	for (let k = 0; k < SKIP_BLASTS.length; k++) {
		const hit = f.hit;
		t += hit.steps;
		const { r, peak } = SKIP_BLASTS[k];
		burst(w, t, hit, r, peak);
		if (hit.kind !== "land" || k === SKIP_BLASTS.length - 1) return;
		const vx = f.end.vx * SKIP_KEEP_VX;
		const sideways = vx >= 0 ? vx < 60 ? 60 : vx : vx > -60 ? -60 : vx;
		const up = f.end.vy * SKIP_UP;
		const vy = -(up > 120 ? up : 120);
		f = flight(w, t, {
			x: hit.x,
			y: hit.y - 3,
			vx: sideways,
			vy
		}, { armed: true }, "hop");
	}
}
/** Mud Ball: a big ball of dirt where it lands (it settles into a heap). */
function mud(w, start) {
	const hit = flight(w, 0, start, {}, "main").hit;
	if (!landed(hit)) return;
	touch(w, addDirt(w.land, hit.x, hit.y, w.arrow.blastRadius));
	note(w, {
		k: "dirt",
		t: hit.steps,
		x: hit.x,
		y: hit.y,
		r: w.arrow.blastRadius
	});
}
/** Sticky Goo: a splash with no crater, then a puddle that runs into the dip and stays a few turns. */
function goo(w, start) {
	const hit = flight(w, 0, start, {}, "main").hit;
	if (!landed(hit)) return;
	blast(w, hit.steps, hit.x, hit.y, w.arrow.blastRadius, w.arrow.peakDamage, false);
	bonus(w, hit);
	const puddle = pool(w.land, clampCol(Math.floor(hit.x / 3)));
	if (puddle) {
		w.puddles.push(puddle);
		note(w, {
			k: "goo",
			t: hit.steps,
			puddle
		});
	}
}
/** Earth Shaker: a small blast, then the land around crumbles and archers on slopes tumble. */
function shaker(w, start) {
	const hit = flight(w, 0, start, {}, "main").hit;
	if (!landed(hit)) return;
	burst(w, hit.steps, hit);
	const c = clampCol(Math.floor(hit.x / 3));
	const from = c - 45 < 0 ? 0 : c - 45;
	const to = c + 45 >= 320 ? 319 : c + 45;
	w.shaken = [from, to];
	touch(w, [from, to]);
	note(w, {
		k: "shake",
		t: hit.steps,
		x: hit.x,
		y: hit.y,
		reach: 135
	});
}
/** Firework Arrow: five pops around where it lands, one after another. */
function firework(w, start) {
	const hit = flight(w, 0, start, {}, "main").hit;
	if (!landed(hit)) return;
	bonus(w, hit);
	FIREWORK_POPS.forEach(([dx, dy], k) => blast(w, hit.steps + k * 14, hit.x + dx, hit.y + dy, w.arrow.blastRadius, w.arrow.peakDamage));
}
/** Crossbow Bolt: dead straight with no drop and no wind, cutting through dirt, popping at the end of its range. */
function bolt(w) {
	const a = w.archers[w.shooter];
	const d = clampAngle(w.shot.angle);
	const dx = AIM_X[d];
	const dy = -AIM_Y[d];
	const range = 60 + clampPower(w.shot.power) * BOLT_RANGE_PER;
	const start = {
		x: a.x + dx * 4,
		y: a.y - 15 + dy * 4,
		vx: dx * 600,
		vy: dy * 600
	};
	const steps = Math.floor(range / (600 * DT));
	const cuts = [];
	let cutAt = -1;
	const f = flight(w, 0, start, {
		gravity: false,
		windScale: 0,
		maxSteps: steps,
		iceBounce: false,
		cutMost: Math.floor(90 / (600 * DT)),
		cut: (x, y) => {
			touch(w, carve(w.land, x, y, BOLT_CUT_RADIUS));
			if (w.events) {
				if (cutAt < 0) cutAt = Math.round(Math.sqrt((x - start.x) * (x - start.x) + (y - start.y) * (y - start.y)) / (600 * DT));
				cuts.push(x, y);
			}
		}
	}, "main");
	if (cuts.length) note(w, {
		k: "dig",
		t: cutAt,
		path: cuts,
		r: BOLT_CUT_RADIUS,
		every: 1,
		quiet: true
	});
	burst(w, f.hit.steps, f.hit);
}
/** Plays the shot's arrow: its flight and its landing (each arrow's own way). */
function runArrow(w) {
	const a = w.archers[w.shooter];
	const start = launch(a, w.shot.angle, w.shot.power);
	switch (w.arrow.id) {
		case "rain": return rain(w, start);
		case "log": return log(w, start);
		case "mole": return mole(w, start);
		case "sneaky": return sneaky(w, start);
		case "skip": return skip(w, start);
		case "mud": return mud(w, start);
		case "goo": return goo(w, start);
		case "shaker": return shaker(w, start);
		case "firework": return firework(w, start);
		case "bolt": return bolt(w);
		case "owl": return plain(w, start, { steer: true });
		default: return plain(w, start);
	}
}
/** A new piece of shot work for `shooter` in the round. */
function newWork(round, shooter, shot, keep) {
	return {
		round,
		land: round.land,
		archers: round.archers,
		shooter,
		shot,
		arrow: arrowKind(shot.arrow),
		raw: round.archers.map(() => 0),
		c0: Infinity,
		c1: -Infinity,
		hit: null,
		bounce: null,
		path: [],
		events: keep ? [] : null,
		spareShooter: false,
		puddles: [],
		shaken: null,
		stabbed: round.archers.map(() => false)
	};
}
/**
* After the dirt has fallen: an Earth Shaker's cliffs crumble into slopes. Returns which archers stand in
* the shaken land (fight.ts makes them tumble down any slope, like on the Snow's slippery slopes).
*/
function shake(w) {
	const tumble = w.archers.map(() => false);
	if (!w.shaken) return tumble;
	const [from, to] = w.shaken;
	slideSand(w.land, from, to, w.archers, 0, 1, SHAKER_MOVES);
	for (let i = 0; i < w.archers.length; i++) {
		const a = w.archers[i];
		if (a.popped) continue;
		const [a0, a1] = archerCols(a.x);
		tumble[i] = !(a1 < from || a0 > to);
	}
	return tumble;
}
/** Where a digging arrow starts digging: where it hit the land, or under the feet of the archer it hit. Null if neither. */
function digFrom(w, hit) {
	if (hit.kind === "land") return hit;
	if (hit.kind === "archer" && hit.archer !== null) return {
		...hit,
		x: w.archers[hit.archer].x,
		y: w.archers[hit.archer].y + 1
	};
	return null;
}
const clampCol = (c) => c < 0 ? 0 : c >= 320 ? 319 : c;
/** The first solid row in column `col` at or below `row` (ROWS if none). */
function solidBelow(land, col, row) {
	for (let r = row < 0 ? 0 : row; r < 180; r++) if (cellAt(land, col, r) !== 0) return r;
	return 180;
}
/** The ground row a roller would sit on in a column, starting from a row near `top` (−1 off the field). */
function surfaceAt(land, col, top) {
	if (col < 0 || col >= 320) return -1;
	return solidBelow(land, col, top - 2);
}
/** LOG_LOOK columns ahead: which way the land first goes down from (col, top), before it goes up (0 if neither). */
const LOG_LOOK = 8;
function downhill(land, col, top) {
	let best = 0;
	let bestK = 9;
	for (const d of [1, -1]) for (let k = 1; k <= LOG_LOOK; k++) {
		const c = col + d * k;
		if (c < 0 || c >= 320 || cellAt(land, c, top - 1) !== 0) break;
		const nt = solidBelow(land, c, top - 1);
		if (nt === top) continue;
		if (nt > top && nt < 180 && k < bestK) {
			best = d;
			bestK = k;
		}
		break;
	}
	return best;
}
/** The other archer still in the round (null if none). */
function otherArcher(w) {
	for (let i = 0; i < w.archers.length; i++) if (i !== w.shooter && !w.archers[i].popped) return i;
	return null;
}
/** Which archer (still in the round) has a box at this point, if any. */
function archerAt(w, x, y) {
	for (let i = 0; i < w.archers.length; i++) {
		const a = w.archers[i];
		if (a.popped) continue;
		if (x >= a.x - 8 && x <= a.x + 8 && y >= a.y - 24 && y <= a.y + 3) return i;
	}
	return null;
}
/**
* Where Sticky Goo pools: it runs downhill from column `c` (at most GOO_RUN columns) to the bottom of the
* dip, then fills it up to GOO_CELLS cells, rising at most GOO_MAX_RISE rows. Null if there's no ground.
*/
function pool(land, c) {
	let col = c;
	let top = surfaceRow(land, col);
	if (top >= 180) return null;
	for (let n = 0; n < 60; n++) {
		const l = col > 0 ? surfaceRow(land, col - 1) : -1;
		const r = col < 319 ? surfaceRow(land, col + 1) : -1;
		if (l > top && l >= r && l < 180) {
			col--;
			top = l;
		} else if (r > top && r < 180) {
			col++;
			top = r;
		} else break;
	}
	let level = top;
	let c0 = col;
	let c1 = col;
	let cells = 0;
	for (let rise = 1; rise <= 8 && cells < 70; rise++) {
		const lv = top - rise;
		let n0 = c0;
		let n1 = c1;
		while (n0 > 0 && surfaceRow(land, n0 - 1) > lv && n1 - n0 < 30) n0--;
		while (n1 < 319 && surfaceRow(land, n1 + 1) > lv && n1 - n0 < 30) n1++;
		if (n1 - n0 + 1 > 30) break;
		level = lv;
		c0 = n0;
		c1 = n1;
		cells = 0;
		for (let k = c0; k <= c1; k++) cells += surfaceRow(land, k) - level;
	}
	if (level === top) {
		c0 = col - 6 < 0 ? 0 : col - 6;
		c1 = col + 6 >= 320 ? 319 : col + 6;
		level = top - 1;
	}
	return {
		c0,
		c1,
		level,
		shots: 4
	};
}
/** Is this archer standing in the puddle? */
function inPuddle(p, a) {
	if (a.popped) return false;
	const [a0, a1] = archerCols(a.x);
	if (a1 < p.c0 || a0 > p.c1) return false;
	return Math.floor(a.y / 3) > p.level;
}
//#endregion
//#region shared/archery/fight.ts
/**
* Turns, rounds and fights (docs/ARCHERY-PLAN.md, section 2). A fight is a seed, its setup (the world
* and what each player brought), and a list of shots. `playFight` plays them all and gives the whole
* result: every shot's landing, the damage, who won each round and the fight, and which arrows each
* player used. The server replays fights with exactly this (Stage 4) to count the arrows used.
*
* Players take turns. Each round has fresh land and new wind from the seed (the wind stays the same
* all round), and the first turn swaps each round (player 0 starts round 1). A round ends when one
* archer is left (both popping at once is a draw), or after MAX_SHOTS_PER_ROUND, when more health
* wins. First to win ROUNDS_TO_WIN rounds wins the fight; a classmate fight (`setup.oneRound`) is one round only.
* A classmate's turn the timer used up is a shot with `pass` (nothing flies, but the turn still ends).
*
* Screens and bots play a fight one shot at a time with `startFight` and `takeShot`, which is exactly
* what `playFight` does, so they always agree with a replay.
*/
const copyArcher = (a) => ({ ...a });
/** The seed for a round's land, and its wind (each world has its own wind range). */
function roundSeeds(seed, index, world) {
	const landSeed = mixSeed(seed, 1e3 + index);
	const most = WORLD_WIND_MAX[world];
	return {
		landSeed,
		wind: makeRandom(mixSeed(seed, 2e3 + index)).range(-most, most)
	};
}
/**
* Starts round `index` of a fight, with the bow each archer brought. A shield lasts the whole fight: it
* starts full, and later rounds carry on with what was left of it at the end of the last round (`carry`),
* Bubble bounce and all, so shields soak and then break. `used` is what each player has used so far in
* the fight (for the Umbrellas they have left).
*/
function newRound(seed, index, setup, used = [{}, {}], carry = null) {
	const { landSeed, wind } = roundSeeds(seed, index, setup.world);
	const { land, archers } = makeRoundLand(landSeed, setup.world);
	for (let i = 0; i < 2; i++) {
		const p = setup.players[i];
		const a = archers[i];
		const guard = p.shield && isShieldId(p.shield) ? p.shield : null;
		a.guard = guard;
		a.shield = !guard ? 0 : carry ? carry[i].shield : shieldKind(guard).soak;
		a.bubble = guard === "bubble" && (carry ? !!carry[i].bubble : true);
		a.bow = p.bow && isBowId(p.bow) ? p.bow : "starter";
		a.shardsBy = -1;
		a.umbrellas = Math.max(0, (p.quiver.umbrella ?? 0) - (used[i].umbrella ?? 0));
	}
	return {
		world: setup.world,
		index,
		landSeed,
		wind,
		land,
		archers,
		turn: index % 2,
		shots: 0,
		winner: null,
		goo: []
	};
}
/**
* Plays one shot by `player` in the round (changing the round's land and archers): an Apple first if they
* eat one, the arrow's flight and landing (each arrow's own way, in effects.ts), loose dirt falling (and the
* Desert's sand sliding, and an Earth Shaker's cliffs crumbling), archers falling (an Umbrella stops a fall
* hurting; on the Snow, or shaken loose, they slide down slopes), then the damage, at most MAX_SHOT_DAMAGE
* per archer. Then the end of the turn: Sticky Goo hurts anyone standing in it, and Glass shards in the
* shooter either break (they hit back) or pop them. Doesn't change whose turn it is.
*/
function playShot(round, player, shot, keepPath = false) {
	const { land, archers } = round;
	const me = archers[player];
	const pass = shot.pass === true;
	let apple = 0;
	if (!pass && shot.apple && !me.popped) {
		apple = Math.min(15, 100 - me.health);
		me.health += apple;
	}
	const w = pass ? null : newWork(round, player, shot, keepPath);
	if (w) runArrow(w);
	const raw = w ? w.raw : [0, 0];
	if (w && w.c1 >= w.c0) {
		settle(land, w.c0, w.c1);
		if (round.world === "desert") slideSand(land, w.c0, w.c1, archers);
	}
	const tumble = w ? shake(w) : [false, false];
	if (w?.shaken) settle(land, w.shaken[0], w.shaken[1]);
	const fell = [0, 0];
	const slid = [0, 0];
	const umbrella = [false, false];
	for (let i = 0; w && i < archers.length; i++) {
		const a = archers[i];
		if (a.popped) continue;
		fell[i] = dropArcher(land, a);
		let fall = fallDamage(fell[i]);
		if (round.world === "snow" || tumble[i]) {
			const slide = slideArcher(land, archers, i);
			slid[i] = slide.slid;
			for (const d of slide.drops) {
				fell[i] += d;
				fall += fallDamage(d);
			}
		}
		if (fall > 0 && (a.umbrellas ?? 0) > 0) {
			a.umbrellas = (a.umbrellas ?? 0) - 1;
			umbrella[i] = true;
			fall = 0;
		}
		raw[i] += fall;
	}
	const damage = [0, 0];
	for (let i = 0; i < archers.length; i++) damage[i] = hurt(archers[i], capShotDamage(raw[i]));
	/** What the shot itself did (before goo), for "did they hit back?". */
	const struck = [damage[0], damage[1]];
	const goo = [0, 0];
	const puddles = [...round.goo, ...w ? w.puddles : []];
	for (let i = 0; i < archers.length; i++) if (puddles.some((p) => inPuddle(p, archers[i]))) {
		goo[i] = hurt(archers[i], 8);
		damage[i] += goo[i];
	}
	round.goo = puddles.map((p) => ({
		...p,
		shots: p.shots - 1
	})).filter((p) => p.shots > 0);
	let glass = null;
	let sting = 0;
	const by = me.shardsBy ?? -1;
	if (by >= 0 && !me.popped) {
		if (archers[by].popped) glass = "broke";
		else if (struck[by] > 0) {
			glass = "broke";
			sting = hurt(me, 12);
		} else {
			glass = "popped";
			sting = me.health;
			me.health = 0;
			me.popped = true;
		}
		damage[player] += sting;
		me.shardsBy = -1;
	} else if (by >= 0) me.shardsBy = -1;
	for (let i = 0; w && i < archers.length; i++) if (w.stabbed[i] && !archers[i].popped) archers[i].shardsBy = player;
	round.shots++;
	const hit = w?.hit ?? {
		kind: "timeout",
		x: me.x,
		y: me.y,
		archer: null,
		steps: 0
	};
	const record = {
		round: round.index,
		player,
		shot: { ...shot },
		wind: round.wind,
		hit,
		bounce: w ? w.bounce : null,
		damage,
		fell,
		slid,
		after: [copyArcher(archers[0]), copyArcher(archers[1])],
		apple,
		umbrella,
		goo,
		glass,
		sting
	};
	if (keepPath) {
		record.path = w ? w.path : [];
		record.events = w?.events ?? [];
	}
	return record;
}
/** Who won the round so far: null while it's still going. */
function roundWinner(round) {
	const [a, b] = round.archers;
	if (a.popped && b.popped) return "draw";
	if (a.popped) return 1;
	if (b.popped) return 0;
	if (round.shots >= 60) {
		const ha = a.health + a.shield, hb = b.health + b.shield;
		return ha > hb ? 0 : hb > ha ? 1 : "draw";
	}
	return null;
}
/** Why a shot can't be played, or null if it's fine. `used` is what the player has already used. */
function shotProblem(shot, setup, player, used) {
	if (!shot || typeof shot !== "object") return "not a shot";
	if (shot.pass === true) return null;
	if (!Number.isInteger(shot.angle) || shot.angle < 0 || shot.angle > 180) return "angle must be a whole number from 0 to 180";
	if (!Number.isInteger(shot.power) || shot.power < 0 || shot.power > 100) return "power must be a whole number from 0 to 100";
	if (!isArrowId(shot.arrow)) return "no such arrow";
	const arrow = arrowKind(shot.arrow);
	if (!usable(arrow)) return `${arrow.name} can't be used yet`;
	if (shot.apple !== void 0 && typeof shot.apple !== "boolean") return "apple must be true or false";
	if (shot.apple && (used.apple ?? 0) >= (setup.players[player].quiver.apple ?? 0)) return "no Apples left";
	if (arrow.unlimited) return null;
	const have = setup.players[player].quiver[shot.arrow] ?? 0;
	if ((used[shot.arrow] ?? 0) >= have) return `no ${arrow.name} left`;
	return null;
}
function startFight(seed, setup) {
	return {
		seed,
		setup,
		round: newRound(seed, 0, setup),
		records: [],
		rounds: [],
		roundWins: [0, 0],
		used: [{}, {}],
		winner: null
	};
}
/** Plays the next shot of the fight (by whoever's turn it is), and starts the next round if this one ended. */
function takeShot(run, shot, keepPath = false) {
	if (run.winner !== null) return {
		problem: "a shot after the fight ended",
		record: null,
		ended: null
	};
	const round = run.round;
	const player = round.turn;
	const problem = shotProblem(shot, run.setup, player, run.used[player]);
	if (problem) return {
		problem,
		record: null,
		ended: null
	};
	const record = playShot(round, player, shot, keepPath);
	run.records.push(record);
	const used = run.used[player];
	if (!shot.pass && !arrowKind(shot.arrow).unlimited) used[shot.arrow] = (used[shot.arrow] ?? 0) + 1;
	if (!shot.pass && shot.apple) used.apple = (used.apple ?? 0) + 1;
	for (let i = 0; i < 2; i++) if (record.umbrella[i]) run.used[i].umbrella = (run.used[i].umbrella ?? 0) + 1;
	const w = roundWinner(round);
	if (w === null) {
		round.turn = 1 - player;
		return {
			problem: null,
			record,
			ended: null
		};
	}
	round.winner = w;
	run.rounds.push({
		index: round.index,
		landSeed: round.landSeed,
		wind: round.wind,
		winner: w,
		shots: round.shots
	});
	if (w !== "draw") run.roundWins[w]++;
	if (run.setup.oneRound) run.winner = w;
	else if (run.roundWins[0] >= 2) run.winner = 0;
	else if (run.roundWins[1] >= 2) run.winner = 1;
	else if (run.rounds.length >= 5) run.winner = run.roundWins[0] > run.roundWins[1] ? 0 : run.roundWins[1] > run.roundWins[0] ? 1 : "draw";
	else run.round = newRound(run.seed, round.index + 1, run.setup, run.used, round.archers);
	return {
		problem: null,
		record,
		ended: round
	};
}
/** Whose turn it is in a fight that's still going (null once it's over). */
function nextPlayer(run) {
	return run.winner === null ? run.round.turn : null;
}
/** Coins spent in all to reach Armory levels 1, 2, 3, 4 and 5. */
const LEVEL_SPEND = [
	0,
	200,
	600,
	1200,
	2e3
];
LEVEL_SPEND.length;
/** Levels for the shields and helpers (arrows carry their own in arrows.ts; bows are open to everyone). */
const SHIELD_LEVEL = {
	wood: 1,
	charm: 2,
	bubble: 3
};
const SHOP = [
	...ARROWS.filter((a) => a.forSale).map((a) => ({
		id: a.id,
		kind: "gear",
		name: a.name,
		does: a.does,
		price: a.price,
		qty: a.perPurchase ?? 1,
		level: Math.max(1, a.level)
	})),
	...HELPERS.map((h) => ({
		id: h.id,
		kind: "gear",
		name: h.name,
		does: h.does,
		price: h.price,
		qty: 1,
		level: h.level
	})),
	...SHIELDS.map((s) => ({
		id: s.id,
		kind: "shield",
		name: s.name,
		does: s.does,
		price: s.price,
		qty: 1,
		level: SHIELD_LEVEL[s.id]
	})),
	...BOWS.filter((b) => b.price > 0).map((b) => ({
		id: b.id,
		kind: "bow",
		name: b.name,
		does: b.does,
		price: b.price,
		qty: 1,
		level: 1
	}))
];
const SHOP_BY = new Map(SHOP.map((s) => [`${s.kind}:${s.id}`, s]));
/** Everything the Armory sells, in shop order. */
function shopItems() {
	return SHOP;
}
/** One shop item, or null if there's no such thing for sale. */
function shopItem(kind, id) {
	if (kind !== "gear" && kind !== "shield" && kind !== "bow") return null;
	if (typeof id !== "string") return null;
	return SHOP_BY.get(`${kind}:${id}`) ?? null;
}
/** What one item sells back for: half what one cost, rounded down. */
function sellPrice(item) {
	return Math.floor(item.price / item.qty / 2);
}
/** Is this an item a pupil can pack (an arrow that isn't the Plain Arrow, or a helper)? */
function isPackable(id) {
	if (isHelperId(id)) return true;
	return isArrowId(id) && !arrowKind(id).unlimited;
}
/**
* Reads a packed quiver from a request: arrows and helpers the pupil owns enough of, the shield and bow they own.
* Returns the cleaned-up setup, or why it can't be packed.
*/
function readPack(raw, a) {
	if (!raw || typeof raw !== "object") return { problem: "not a quiver" };
	const r = raw;
	const quiver = {};
	if (r.quiver !== void 0) {
		if (!r.quiver || typeof r.quiver !== "object" || Array.isArray(r.quiver)) return { problem: "not a quiver" };
		for (const [id, n] of Object.entries(r.quiver)) {
			if (!isPackable(id)) return { problem: `can't pack ${id}` };
			if (!Number.isInteger(n) || n < 0 || n > 5) return { problem: "a count is wrong" };
			if (n > (a.gear[id] ?? 0)) return { problem: `not enough ${id}` };
			if (n > 0) quiver[id] = n;
		}
	}
	let shield = null;
	if (r.shield !== void 0 && r.shield !== null) {
		if (!isShieldId(r.shield) || !a.shields.includes(r.shield)) return { problem: "not your shield" };
		shield = r.shield;
	}
	let bow = "starter";
	if (r.bow !== void 0 && r.bow !== null && r.bow !== "starter") {
		if (!isBowId(r.bow) || !a.bows.includes(r.bow)) return { problem: "not your bow" };
		bow = r.bow;
	}
	return { pack: {
		quiver,
		shield,
		bow
	} };
}
/** What comes back after a fight: everything packed that wasn't used. */
function unused(pack, used) {
	const back = {};
	for (const [id, n] of Object.entries(pack.quiver)) {
		const left = n - (used[id] ?? 0);
		if (left > 0) back[id] = left;
	}
	return back;
}
//#endregion
//#region shared/archery/duel.ts
/**
* Fights against classmates (docs/ARCHERY-PLAN.md, section 7, Stage 6): the rules the server function and both
* screens share. A classmate fight is **one round** (James, 22 Oct 2026). It's kept as a seed, the world, both packed
* quivers and the list of turns played so far, where a turn the timer used up is `PASS`. Replaying that list with the
* engine gives the fight exactly as it is now, on the server and on both pupils' screens, so nobody's browser ever
* decides what a shot did.
*/
/** A turn the timer used up. */
const PASS = {
	angle: 0,
	power: 0,
	arrow: "plain",
	pass: true
};
/** The most turns a classmate fight can have (the round's shot cap). */
const MAX_DUEL_TURNS = 60;
/** A classmate fight's setup: the world, both packs (seat 0 is the left archer: the one who challenged), one round. */
function duelSetup(world, packs) {
	return {
		world,
		players: [copyPack(packs[0]), copyPack(packs[1])],
		oneRound: true
	};
}
const copyPack = (p) => ({
	quiver: { ...p.quiver },
	shield: p.shield ?? null,
	bow: p.bow ?? "starter"
});
/**
* Replays the turns so far. `problem` says if one broke the rules (it never should: the server checked each one when
* it was played), and the run stops there.
*/
function replayDuel(seed, setup, turns, keepPaths = false) {
	const run = startFight(seed, setup);
	for (const turn of turns) {
		const taken = takeShot(run, turn, keepPaths);
		if (taken.problem) return {
			run,
			problem: taken.problem
		};
	}
	return {
		run,
		problem: null
	};
}
/** Reads one shot a pupil sent (null if it isn't one). A pass can't be sent: only the timer makes those. */
function readShot(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const { angle, power, arrow, apple, pass } = raw;
	if (pass !== void 0) return null;
	if (typeof arrow !== "string" || typeof angle !== "number" || typeof power !== "number") return null;
	if (apple !== void 0 && typeof apple !== "boolean") return null;
	return {
		angle,
		power,
		arrow,
		...apple ? { apple: true } : {}
	};
}
/** Reads the turn list as the database keeps it (null if it isn't one). */
function readTurns(raw) {
	if (!Array.isArray(raw) || raw.length > MAX_DUEL_TURNS) return null;
	const out = [];
	for (const t of raw) if (t && typeof t === "object" && t.pass === true) out.push({ ...PASS });
	else {
		const shot = readShot(t);
		if (!shot) return null;
		out.push(shot);
	}
	return out;
}
/** Used-up turns in a row for each seat, after `seat`'s turn: a real shot clears theirs, a pass adds one. */
function timeoutsAfter(timeouts, seat, timedOut) {
	const next = [timeouts[0], timeouts[1]];
	next[seat] = timedOut ? next[seat] + 1 : 0;
	return next;
}
/** Has someone let the timer use up DUEL_MAX_TIMEOUTS of their turns in a row? */
const tooManyTimeouts = (t) => t[0] >= 3 || t[1] >= 3;
/** Is it still going (or about to)? */
const duelOpen = (d) => d.status === "asked" || d.status === "packing" || d.status === "playing";
/** Which seat this player has (0 or 1), or −1 if it isn't their fight. */
const seatOf = (d, player) => d.seat_a === player ? 0 : d.seat_b === player ? 1 : -1;
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
/**
* Reads a fight row from the database, the server function or Realtime (null if it isn't one, or is missing parts: a
* Realtime change can leave out big unchanged columns, so then the screen reads the row again).
*/
function parseDuel(raw) {
	if (!isObj(raw)) return null;
	const r = raw;
	const id = Number(r.id);
	const seed = Number(r.seed);
	if (!Number.isSafeInteger(id) || !Number.isSafeInteger(seed) || typeof r.seat_a !== "string" || typeof r.seat_b !== "string") return null;
	if (!Array.isArray(r.packs) || r.packs.length !== 2 || !Array.isArray(r.used) || r.used.length !== 2 || !Array.isArray(r.timeouts)) return null;
	const turns = readTurns(r.turns);
	if (!turns || typeof r.deadline !== "string" || typeof r.status !== "string" || typeof r.version !== "number") return null;
	const pack = (p) => isObj(p) ? {
		quiver: isObj(p.quiver) ? p.quiver : {},
		shield: p.shield ?? null,
		bow: p.bow ?? "starter"
	} : null;
	const seatNum = (v) => v === 0 || v === 1 ? v : null;
	return {
		id,
		seed,
		seat_a: r.seat_a,
		seat_b: r.seat_b,
		name_a: String(r.name_a ?? ""),
		name_b: String(r.name_b ?? ""),
		world: r.world,
		status: r.status,
		packs: [pack(r.packs[0]), pack(r.packs[1])],
		turns,
		used: [isObj(r.used[0]) ? r.used[0] : {}, isObj(r.used[1]) ? r.used[1] : {}],
		timeouts: [Number(r.timeouts[0]) || 0, Number(r.timeouts[1]) || 0],
		deadline: r.deadline,
		winner: seatNum(r.winner),
		ending: r.ending ?? null,
		leaver: seatNum(r.leaver),
		version: r.version,
		created_at: String(r.created_at ?? ""),
		last_action_at: String(r.last_action_at ?? ""),
		finished_at: typeof r.finished_at === "string" ? r.finished_at : null
	};
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
async function recordMathsAnswers(rpc, player, answers, once, from, batchId = (o, pack) => batchIdFor(`${from}:${o}:${pack}`)) {
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
//#region shared/maths/serverQuestions.ts
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
//#endregion
//#region shared/archery/bot.ts
/**
* Archery Challenge's bots (docs/ARCHERY-PLAN.md, section 6). Pure functions: a bot gets the fight so
* far (seed, setup, shots) and picks the next shot for whoever's turn it is. It only uses the fight's
* own seeded random numbers, so the same fight always gets the same bot shot (and a replay agrees).
*
* - Easy: an angle that looks like it gets over the hill (50–65°, with its own lean for the round),
*   a guessed power first, then walks its power towards the target (too far → less, too short →
*   more), with big wobble (±8 power, ±5°) that settles a little as the round goes on. It ignores the
*   wind (short at full power → it aims flatter).
* - Medium: works out the power for a 45–60° shot with no wind, picking (by sums, not by flying) the
*   flattest angle whose arc clears the land between the archers (up to 80° if nothing in 45–60
*   clears). It keeps that angle for the round while it still clears, and corrects its power from
*   where its own last arrow landed (70% of the miss). ±4 power wobble, settling to ±2.
* - Hard: the same, but its sums allow for the wind; then it flies the shot on a copy of the round,
*   up to 3 times, correcting the power (a step, then a secant step; a steeper angle if the hill
*   keeps stopping it). ±3 power wobble. It shoots a Steel Arrow when its flights say it will land close.
* - Every bot misses on purpose some of the time (BOT_TUNING.missChance), so a 9-year-old can win.
*
* Stage 3: each level has a small fixed kit of special arrows (BOT_KITS) and a shield (BOT_SHIELDS), and only
* ever picks arrows in `botArrows()` (never the pupil's Glass Arrow). When a bot decides to shoot a special
* arrow, it picks its strongest one left (BOT_SPECIALS: arrows that fly like a Plain Arrow, so its aim holds).
* Directions come from the aim table (AIM_X/AIM_Y), never Math.sin/cos.
*/
const BOT_LEVELS = [
	"easy",
	"medium",
	"hard"
];
/** Each level's fixed small kit (special arrows for the whole fight; Plain is unlimited). Tuned with scripts/archery-sim.mjs. */
const BOT_KITS = {
	easy: { steel: 1 },
	medium: {
		steel: 2,
		rain: 1
	},
	hard: {
		steel: 3,
		firework: 1
	}
};
/** Each level's shield (full every round). */
const BOT_SHIELDS = {
	easy: null,
	medium: null,
	hard: null
};
/** The special arrows a bot will shoot, strongest first. They all fly like a Plain Arrow, so the bot's aim still holds. */
const BOT_SPECIALS = [
	"giant",
	"firework",
	"rain",
	"steel"
];
/** A bot's whole setup for a fight: its kit and its shield. */
function botSetup(level) {
	return {
		quiver: { ...BOT_KITS[level] },
		shield: BOT_SHIELDS[level]
	};
}
const BOT_TUNING = {
	easy: {
		powerWobble: 8,
		angleWobble: 5,
		missChance: .15,
		missMin: 8,
		missMax: 16,
		settle: .2,
		floor: .25
	},
	medium: {
		powerWobble: 4,
		angleWobble: 0,
		missChance: .2,
		missMin: 8,
		missMax: 16,
		settle: .15,
		floor: .5
	},
	hard: {
		powerWobble: 3,
		angleWobble: 0,
		missChance: .25,
		missMin: 8,
		missMax: 16,
		settle: 0,
		floor: 1
	}
};
/** Easy's angle: the flattest from 50° that looks like it clears the hill (preferring up to 65°), leaning up to ±EASY_LEAN° for the round. */
const EASY_ANGLE_FROM = 50;
const EASY_ANGLE_PREFER = 65;
const EASY_LEAN = 4;
/** A shot at this power or more counts as full power (see shortAtFullPower). */
const FULL_POWER = 97;
const LOWER_STEP = 5;
const LOWER_MOST = 30;
/** Easy's walk: power points changed per px of miss, and the smallest and biggest step. */
const EASY_PX_PER_POINT = 12;
const EASY_STEP_MIN = 2;
const EASY_STEP_MAX = 12;
/** Medium corrects this share of its last miss (if that arrow went at about the same angle and landed within reach). */
const MEDIUM_CORRECT = .7;
const MEDIUM_CORRECT_RANGE = 220;
const MEDIUM_CORRECT_MAX = 15;
/** The arc should clear the land between the archers by the first of these (px) it can, else the next. */
const CLEAR_MARGINS = [24, 6];
/** The steepest angle Medium and Hard aim with. */
const ANGLE_MOST = 80;
/** Medium's angles: the flattest that clears from MEDIUM_FROM°, preferring up to MEDIUM_PREFER°. Hard's likewise. */
const MEDIUM_FROM = 45;
const MEDIUM_PREFER = 60;
const HARD_FROM = 40;
const HARD_PREFER = 60;
/** Hard: biggest power change one correction makes. */
const HARD_STEP_MAX = 25;
/** Hard shoots a special arrow when its best flight hurts the target or lands this close (px). */
const HARD_STEEL_NEAR = 30;
/** Medium shoots a special arrow (this often) when its last arrow this round hurt the target. */
const MEDIUM_STEEL_CHANCE = .5;
/** Easy shoots a special arrow at random this often, while it has one. */
const EASY_STEEL_CHANCE = .15;
function aimFor(round, player) {
	const me = round.archers[player];
	const them = round.archers[1 - player];
	const dir = them.x >= me.x ? 1 : -1;
	const [l, r] = dir > 0 ? [me, them] : [them, me];
	const from = archerCols(l.x)[1] + 1;
	const to = archerCols(r.x)[0] - 1;
	const between = [];
	for (let c = from; c <= to; c++) between.push({
		x: c * 3 + 3 / 2,
		top: surfaceRow(round.land, c) * 3
	});
	return {
		player,
		round,
		dir,
		dist: Math.abs(them.x - me.x),
		tx: them.x,
		ty: them.y - 12,
		between
	};
}
/** The angle a shooter uses for an "up and over" angle a (0–90) towards the target. */
const toward = (aim, a) => aim.dir > 0 ? a : 180 - a;
/** The 0–90 angle of a shot towards the target. */
const upAngle = (aim, angle) => aim.dir > 0 ? angle : 180 - angle;
/** Where the arrow leaves the bow for angle a (0–90, towards the target). */
function launchPoint(aim, a) {
	const me = aim.round.archers[aim.player];
	return {
		x: me.x + aim.dir * AIM_X[a] * 4,
		y: me.y - 15 - AIM_Y[a] * 4
	};
}
/**
* How high (px, up from the launch point) an arc is when it has gone `dx` px towards the target, or
* -Infinity if it never gets that far (a strong headwind). `ax` is the wind's push towards the target
* (px/s²; 0 for "no wind" sums). Worked out with sums, not by flying it.
*/
function arcHeight(a, power, ax, dx) {
	const v = power * 6;
	const vx = AIM_X[a] * v;
	const vy = AIM_Y[a] * v;
	let t;
	if (ax === 0) {
		if (vx <= 0) return -Infinity;
		t = dx / vx;
	} else {
		const disc = vx * vx + 2 * ax * dx;
		if (disc < 0) return -Infinity;
		t = (Math.sqrt(disc) - vx) / ax;
		if (!(t > 0)) return -Infinity;
	}
	return vy * t - 300 * t * t / 2;
}
/** The wind's push towards the target, px/s² (what Hard allows for; the others use 0). */
const windToward = (aim) => aim.round.wind * 6 * aim.dir;
/**
* The power (not rounded) that lands an angle-a shot on the target's middle, or Infinity if even full
* power can't. With `ax` = 0 it's the exact no-wind sum; with wind it's found by halving the range
* (the arc at the target gets higher as the power goes up).
*/
function powerFor(aim, a, ax = 0) {
	const p = launchPoint(aim, a);
	const d = (aim.tx - p.x) * aim.dir;
	const rise = p.y - aim.ty;
	if (d <= 0) return Infinity;
	if (ax === 0) {
		const c = AIM_X[a];
		const s = AIM_Y[a];
		if (c <= 0) return Infinity;
		const denom = 2 * c * (d * s - rise * c);
		if (denom <= 0) return Infinity;
		return Math.sqrt(300 * d * d / denom) / 6;
	}
	if (arcHeight(a, 100, ax, d) < rise) return Infinity;
	let lo = 0;
	let hi = 100;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (arcHeight(a, mid, ax, d) < rise) lo = mid;
		else hi = mid;
	}
	return hi;
}
/** How far (px) an arc clears the land between the archers at its lowest (negative: it hits). */
function clearance(aim, a, power, ax) {
	const p = launchPoint(aim, a);
	let worst = Infinity;
	for (const col of aim.between) {
		const dx = (col.x - p.x) * aim.dir;
		if (dx <= 0) continue;
		const margin = arcHeight(a, power, ax, dx) - (p.y - col.top);
		if (margin < worst) worst = margin;
	}
	return worst;
}
/**
* The angle (0–90, towards the target) and power for a shot: the flattest angle from `from`° up whose
* arc clears the land between the archers, preferring `from`–`prefer`°, then up to ANGLE_MOST; if none
* clears, the one that clears best (its arrow will blast the hill down).
*/
function pickAim(aim, ax, from, prefer) {
	let best = {
		a: from,
		power: 100
	};
	let bestClear = -Infinity;
	const tried = [];
	for (let a = from; a <= ANGLE_MOST; a++) {
		const power = powerFor(aim, a, ax);
		if (power > 100) continue;
		const clear = clearance(aim, a, power, ax);
		tried.push({
			a,
			power,
			clear
		});
		if (clear > bestClear) {
			bestClear = clear;
			best = {
				a,
				power
			};
		}
	}
	for (const margin of CLEAR_MARGINS) {
		for (const t of tried) if (t.a <= prefer && t.clear >= margin) return t;
		for (const t of tried) if (t.clear >= margin) return t;
	}
	return best;
}
/** How far past the target (along the shot, px) a hit landed: + too far, − too short. */
function missOf(aim, hit) {
	if (hit.kind === "archer" && hit.archer === 1 - aim.player) return 0;
	return (hit.x - aim.tx) * aim.dir;
}
/** This player's last shot in the round being played, or null. */
function lastOwnShot(run, player) {
	for (let i = run.records.length - 1; i >= 0; i--) {
		const r = run.records[i];
		if (r.round !== run.round.index) return null;
		if (r.player === player) return r;
	}
	return null;
}
/** Flies a shot on a copy of the round (the real round never changes). */
function trial(aim, shot) {
	const round = aim.round;
	const rec = playShot({
		...round,
		land: copyLand(round.land),
		archers: [{ ...round.archers[0] }, { ...round.archers[1] }]
	}, aim.player, shot);
	return {
		shot,
		damage: rec.damage[1 - aim.player],
		selfDamage: rec.damage[aim.player],
		miss: missOf(aim, rec.hit),
		hit: rec.hit
	};
}
const clampP = (p) => p < 0 ? 0 : p > 100 ? 100 : Math.round(p);
const clampA = (a) => a < 0 ? 0 : a > 180 ? 180 : Math.round(a);
const limit = (n, most) => n > most ? most : n < -most ? -most : n;
/** Power change that moves the landing by `miss` px (range grows with power², so dRange/dPower ≈ 2·range/power). */
const powerStep = (aim, power, miss) => -miss * (power > 1 ? power : 1) / (2 * (aim.dist > 50 ? aim.dist : 50));
let override = null;
/** The strongest special arrow this player can shoot now (in their setup, their level's kit and the bots' list, with one left), or null. */
function bestSpecial(run, player, level) {
	const allowed = new Set(botArrows().map((a) => a.id));
	const kit = override?.kit ?? BOT_KITS[level];
	for (const id of override?.specials ?? BOT_SPECIALS) {
		if (!override?.specials && !allowed.has(id)) continue;
		const have = Math.min(run.setup.players[player].quiver[id] ?? 0, kit[id] ?? 0);
		if ((run.used[player][id] ?? 0) < have) return id;
	}
	return null;
}
/** How many shots this player has taken in the round being played. */
function ownShots(run, player) {
	let n = 0;
	for (let i = run.records.length - 1; i >= 0 && run.records[i].round === run.round.index; i--) if (run.records[i].player === player) n++;
	return n;
}
/** A whole-number wobble of up to ±`most`, settling as the bot gets its eye in this round (BotTuning.settle). */
function wobble(rng, run, player, level, most) {
	const t = BOT_TUNING[level];
	const k = 1 - t.settle * ownShots(run, player);
	const w = Math.round(most * (k > t.floor ? k : t.floor));
	return w > 0 ? rng.range(-w, w) : 0;
}
/**
* How many of this player's arrows this round fell short at (nearly) full power. Easy and Medium don't
* allow for the wind, so a headwind can leave them short at full power: each such arrow makes them aim
* LOWER_STEP° flatter (a flatter arrow goes further), down to LOWER_MOST°.
*/
function shortAtFullPower(run, aim) {
	let n = 0;
	for (let i = run.records.length - 1; i >= 0 && run.records[i].round === run.round.index; i--) {
		const r = run.records[i];
		if (r.player === aim.player && r.shot.power >= FULL_POWER && missOf(aim, r.hit) < -20) n++;
	}
	return n;
}
function planEasy(run, aim, rng) {
	const p = aim.player;
	const lean = makeRandom(mixSeed(run.seed, 8e3 + run.round.index * 2 + p)).range(-4, EASY_LEAN);
	const flatter = shortAtFullPower(run, aim) * LOWER_STEP;
	const angleBase = Math.max(LOWER_MOST, pickAim(aim, 0, EASY_ANGLE_FROM, EASY_ANGLE_PREFER).a + lean - flatter);
	const last = lastOwnShot(run, p);
	let power;
	if (!last) power = 30 + aim.dist / 22 + rng.range(-10, 10);
	else {
		const miss = missOf(aim, last.hit);
		const step = last.damage[1 - p] > 0 && Math.abs(miss) < 20 ? 0 : Math.min(EASY_STEP_MAX, Math.max(EASY_STEP_MIN, Math.round(Math.abs(miss) / EASY_PX_PER_POINT)));
		power = last.shot.power - Math.sign(miss) * step;
	}
	const t = BOT_TUNING.easy;
	const angle = toward(aim, angleBase + wobble(rng, run, p, "easy", t.angleWobble));
	power += wobble(rng, run, p, "easy", t.powerWobble);
	const special = bestSpecial(run, p, "easy");
	const arrow = special && rng.fraction() < EASY_STEEL_CHANCE ? special : "plain";
	return {
		angle,
		power,
		arrow,
		sims: 0
	};
}
function planMedium(run, aim, rng) {
	const p = aim.player;
	const last = lastOwnShot(run, p);
	let a = -1;
	let power = 0;
	if (last && last.hit.kind !== "timeout") {
		const la = upAngle(aim, last.shot.angle);
		const miss = missOf(aim, last.hit);
		const stuckShort = last.shot.power >= FULL_POWER && miss < -20;
		if (la >= LOWER_MOST && la <= ANGLE_MOST && Math.abs(miss) < MEDIUM_CORRECT_RANGE && !stuckShort) {
			const fresh = powerFor(aim, la, 0);
			if (fresh <= 100 && clearance(aim, la, fresh, 0) >= CLEAR_MARGINS[CLEAR_MARGINS.length - 1]) {
				a = la;
				power = last.shot.power + limit(powerStep(aim, last.shot.power, miss) * MEDIUM_CORRECT, MEDIUM_CORRECT_MAX);
			}
		}
	}
	if (a < 0) {
		const fresh = pickAim(aim, 0, MEDIUM_FROM, MEDIUM_PREFER);
		const flatter = shortAtFullPower(run, aim) * LOWER_STEP;
		a = Math.max(LOWER_MOST, fresh.a - flatter);
		const p1 = flatter ? powerFor(aim, a, 0) : fresh.power;
		power = p1 > 100 ? 100 : p1;
	}
	const t = BOT_TUNING.medium;
	power += wobble(rng, run, p, "medium", t.powerWobble);
	const lastHurt = !!last && last.damage[1 - p] > 0;
	const special = bestSpecial(run, p, "medium");
	const arrow = lastHurt && special && rng.fraction() < MEDIUM_STEEL_CHANCE ? special : "plain";
	return {
		angle: toward(aim, a + wobble(rng, run, p, "medium", t.angleWobble)),
		power,
		arrow,
		sims: 0
	};
}
/** Is a trial blocked by land well short of the target (so more power alone may not help)? */
const blocked = (t) => t.hit.kind === "land" && t.miss < -60;
function better(a, b) {
	const sa = a.damage - a.selfDamage;
	const sb = b.damage - b.selfDamage;
	if (sa !== sb) return sa > sb;
	return Math.abs(a.miss) < Math.abs(b.miss);
}
function planHard(run, aim, rng) {
	const p = aim.player;
	const ax = windToward(aim);
	const first = pickAim(aim, ax, HARD_FROM, HARD_PREFER);
	let a = first.a;
	const p0 = clampP(Math.min(first.power, 100));
	const trials = [];
	const fly = (angle, power) => {
		const t = trial(aim, {
			angle: toward(aim, angle),
			power: clampP(power),
			arrow: "plain"
		});
		trials.push(t);
		return t;
	};
	const t0 = fly(a, p0);
	let next = null;
	if (t0.damage <= 0) {
		let p1 = clampP(p0 + limit(powerStep(aim, p0, t0.miss), HARD_STEP_MAX));
		if (p1 === p0) p1 = clampP(p0 + (t0.miss > 0 ? -1 : 1));
		const t1 = fly(a, p1);
		if (t1.damage <= 0) {
			if (blocked(t0) && blocked(t1) && a < ANGLE_MOST) {
				a = a + 12 > ANGLE_MOST ? ANGLE_MOST : a + 12;
				const p2 = clampP(Math.min(powerFor(aim, a, ax), 100));
				const t2 = fly(a, p2);
				if (t2.damage <= 0) next = {
					angle: toward(aim, a),
					power: clampP(p2 + limit(powerStep(aim, p2, t2.miss), HARD_STEP_MAX)),
					arrow: "plain"
				};
			} else {
				const secant = (pa, ma, pz, mz, fallback) => mz !== ma ? pz - mz * (pz - pa) / (mz - ma) : fallback;
				const p2 = clampP(nearGuess(secant(p0, t0.miss, p1, t1.miss, p1 + powerStep(aim, p1, t1.miss)), p1));
				const t2 = fly(a, p2);
				if (t2.damage <= 0) {
					const [u, w] = Math.abs(t1.miss) < Math.abs(t0.miss) ? [t0, t1] : [t1, t0];
					next = {
						angle: toward(aim, a),
						power: clampP(nearGuess(secant(u.shot.power, u.miss, t2.shot.power, t2.miss, t2.shot.power + powerStep(aim, t2.shot.power, t2.miss)), w.shot.power)),
						arrow: "plain"
					};
				}
			}
		}
	}
	let best = trials[0];
	for (const t of trials) if (better(t, best)) best = t;
	const chosen = best.damage > 0 || !next || Math.abs(best.miss) < 12 ? best.shot : next;
	const t = BOT_TUNING.hard;
	const arrow = ((best.damage > 0 || Math.abs(best.miss) < HARD_STEEL_NEAR) && chosen === best.shot ? bestSpecial(run, p, "hard") : null) ?? "plain";
	const power = chosen.power + wobble(rng, run, p, "hard", t.powerWobble);
	return {
		angle: chosen.angle,
		power,
		arrow,
		sims: trials.length
	};
}
/** Keeps a secant guess sensible: a finite number within HARD_STEP_MAX of where it started. */
function nearGuess(guess, from) {
	if (!Number.isFinite(guess)) return from;
	return from + limit(guess - from, HARD_STEP_MAX);
}
/**
* Picks the next shot for whoever's turn it is in a fight being played (the run isn't changed).
* `chooseBotShot` replays the fight and calls this; the simulator calls it on its own run.
*/
function chooseForRun(run, level, simOverride = null) {
	const player = nextPlayer(run);
	if (player === null) throw new Error("bot: the fight is over");
	override = simOverride;
	try {
		return choose(run, level, player);
	} finally {
		override = null;
	}
}
function choose(run, level, player) {
	const rng = makeRandom(mixSeed(run.seed, 7e3 + run.records.length));
	const aim = aimFor(run.round, player);
	const plan = level === "easy" ? planEasy(run, aim, rng) : level === "medium" ? planMedium(run, aim, rng) : planHard(run, aim, rng);
	const t = BOT_TUNING[level];
	let power = plan.power;
	let arrow = override?.always ? bestSpecial(run, player, level) ?? plan.arrow : plan.arrow;
	const deliberateMiss = rng.fraction() < t.missChance;
	if (deliberateMiss) {
		power += (rng.int(2) === 0 ? -1 : 1) * rng.range(t.missMin, t.missMax);
		arrow = "plain";
	}
	return {
		shot: {
			angle: clampA(plan.angle),
			power: clampP(power),
			arrow
		},
		player,
		sims: plan.sims,
		deliberateMiss
	};
}
//#endregion
//#region shared/archery/judge.ts
/**
* How the server checks a fight against a bot (docs/ARCHERY-PLAN.md, section 7). The browser sends every shot of
* the fight; the server replays them all with the engine and, for each of the bot's turns, works out the bot's shot
* itself and checks it's the one in the list. So the pupil's own shots are the only thing the browser decides: a
* made-up bot that always misses isn't possible. It's quick (the bot thinks in about 0.1 ms a turn on a running fight).
*
* A finished fight must have ended; a fight left part-way must still be going. Either way the server counts which
* arrows and helpers were used and gives back the rest.
*/
/** The most shots a fight can have (every round to the cap). */
const MAX_FIGHT_SHOTS = 300;
/** Reads a list of shots from a request (null if it isn't one). */
function readShots(raw) {
	if (!Array.isArray(raw) || raw.length > MAX_FIGHT_SHOTS) return null;
	const out = [];
	for (const s of raw) {
		if (!s || typeof s !== "object") return null;
		const { angle, power, arrow, apple } = s;
		if (typeof arrow !== "string" || typeof angle !== "number" || typeof power !== "number") return null;
		if (apple !== void 0 && typeof apple !== "boolean") return null;
		out.push({
			angle,
			power,
			arrow,
			...apple ? { apple: true } : {}
		});
	}
	return out;
}
/**
* Replays a fight against a bot (the pupil is player 0), checking every shot is allowed and every bot shot is the
* bot's own. `finished` says whether the fight should have ended. Returns the judged fight or why it's refused.
*/
function judgeBotFight(seed, setup, level, shots, finished) {
	const run = startFight(seed, setup);
	let score = 0;
	for (let i = 0; i < shots.length; i++) {
		if (run.winner !== null) return {
			ok: false,
			problem: "shots after the fight ended"
		};
		const shot = shots[i];
		if (run.round.turn === 1) {
			const bot = chooseForRun(run, level).shot;
			if (bot.angle !== shot.angle || bot.power !== shot.power || bot.arrow !== shot.arrow || !!shot.apple) return {
				ok: false,
				problem: `shot ${i} is not the bot's`
			};
		}
		const taken = takeShot(run, shot);
		if (taken.problem) return {
			ok: false,
			problem: `shot ${i}: ${taken.problem}`
		};
		if (taken.record && taken.record.player === 0) score += taken.record.damage[1];
	}
	const done = run.winner !== null;
	if (done !== finished) return {
		ok: false,
		problem: finished ? "the fight has not ended" : "the fight has ended"
	};
	return {
		ok: true,
		fight: {
			status: done ? "done" : "playing",
			winner: run.winner,
			roundWins: [...run.roundWins],
			used: { ...run.used[0] },
			score,
			shots: shots.length
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
/** The time limit for a question (ms): 10 s for the first, 9 s for the second … 1 s for the tenth. */
function limitMs(slot) {
	return (10 - slot) * 1e3;
}
/** Was this answer in time? `ms` is the pupil's screen's measure; `servedAgo` the server's, since it sent the question. */
function inTime(slot, ms, servedAgo) {
	const limit = limitMs(slot);
	return ms <= limit + 200 && servedAgo <= limit + 2500;
}
/** The answer's time for the maths records: the smaller of the two measures. */
function recordedMs(ms, servedAgo) {
	return Math.max(0, Math.round(Math.min(ms, servedAgo)));
}
/** A stored question's right answer and its record key (null if it can't be marked). */
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
const sameAnswer = (typed, answer) => Math.abs(typed - answer) < 1e-9;
/**
* A round's questions from the pupil's maths focus (or the times-table step without one), all different where the
* pack allows. Seeded, so the same seed makes the same round.
*/
function makeRoundQuestions(context, random, count = 10) {
	const pack = makeSpacePack(context.facts, context.focus ?? null, context.settings, random);
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
//#region supabase/functions/archery/duels.ts
/**
* Fights against classmates, in the Archery Challenge server function (docs/ARCHERY-PLAN.md, section 7, Stage 6). The
* same pattern as Power Clash: the browser only ever asks ("challenge Mia in the Snow", "yes", "here's my quiver",
* "shoot at 52° and 67", "the clock ran out", "I'm leaving"); this works out who's asking from their sign-in, checks it's
* their turn, plays the shot with the game's own engine and saves "only if nothing has changed since it looked".
*
*   duel-challenge  {request, other, world}   sends a challenge (same school and class only);
*   duel-answer     {duel, accept}            the classmate says yes (both pack) or no;
*   duel-pack       {duel, pack}              packs a quiver (the gear comes out of the bag); both packed = the fight starts;
*   shot            {duel, version, shot}     a shot on your own turn;
*   times-up        {duel}                    the turn's time ran out (the server checks its own clock): the turn is used up;
*   leave           {duel}                    gives up (the other player wins, nobody gets points) or calls off a challenge.
*
* One round (James, 22 Oct 2026). Finishing earns DUEL_POINTS, or DUEL_WIN_POINTS for the winner; a fight someone left,
* or that the timer ended, gives nobody points. Every reply carries the fight as it now is.
*/
const DUEL_ACTIONS = [
	"duel-challenge",
	"duel-answer",
	"duel-pack",
	"shot",
	"times-up",
	"leave"
];
/** Words pupils see. Kind, short, nothing technical. */
const SAY = {
	bad: "That couldn't be read.",
	busy: "That couldn't be done just now. Try again in a moment.",
	notYours: "That isn't your fight.",
	away: "That classmate isn't in Archery Challenge right now.",
	otherClass: "You can only challenge classmates in your own class.",
	inFight: "One of you is already in a fight. Try again when it's over.",
	theirsOff: "Archery Challenge isn't switched on for their class.",
	late: "That challenge has run out.",
	notStarted: "The fight hasn't started yet.",
	over: "This fight has already ended.",
	changed: "The fight changed just then. Have another look.",
	notYourTurn: "It's not your turn yet.",
	notYet: "There's still time on the clock.",
	gear: "You don't have all of that in your bag.",
	switchedOff: "Your teacher has switched Archery Challenge off, so this fight has stopped. Any arrows you didn't use are back in your bag."
};
const isRequestId$1 = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(v);
const isUuid = (v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const isDuelId = (v) => Number.isSafeInteger(v) && v >= 1;
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
/** Plays the fight's turns so far. Null if they don't replay (which would be a bug: each was checked when played). */
function replay(d) {
	if (!d.packs[0] || !d.packs[1]) return null;
	const { run, problem } = replayDuel(d.seed, duelSetup(d.world, [d.packs[0], d.packs[1]]), d.turns);
	if (problem) {
		console.error(`archery: a classmate fight does not replay (${problem})`);
		return null;
	}
	return run;
}
const sameShot = (a, b) => !!a && !a.pass && a.angle === b.angle && a.power === b.power && a.arrow === b.arrow && !!a.apple === !!b.apple;
/**
* Handles one classmate-fight request from `player`. `on` is whether the game is switched on for their own class (the
* handler has read it): while it's off they can only end a fight, never play one.
*/
async function handleDuel(services, player, action, body, on, everything) {
	if (action === "duel-challenge") {
		const { other, world, request } = body;
		if (!isUuid(other) || !WORLD_IDS.includes(world) || !isRequestId$1(request)) return no(400, SAY.bad);
		const seed = parseInt(services.randomHex(4), 16) >>> 0;
		const r = await services.duelChallenge(player, request, other, world, seed, CHALLENGE_MS);
		if (!r.ok) return r.why === "refused" ? no(400, SAY.bad) : no(503, SAY.busy);
		const why = r.value.result;
		if (why !== "ok" || r.value.duel === null) {
			const words = why === "away" ? SAY.away : why === "class" ? SAY.otherClass : why === "busy" ? SAY.inFight : why === "off" ? SAY.theirsOff : SAY.bad;
			return no(409, words, { code: why });
		}
		const loaded = await services.duelLoad(r.value.duel);
		if (loaded === "busy" || !loaded) return no(503, SAY.busy);
		return ok({ duel: loaded.duel });
	}
	if (!isDuelId(body.duel)) return no(400, SAY.bad);
	const id = body.duel;
	if (action === "duel-answer") {
		if (typeof body.accept !== "boolean") return no(400, SAY.bad);
		const r = await services.duelAnswer(player, id, body.accept, PACK_MS);
		if (!r.ok) return r.why === "refused" ? no(400, SAY.bad) : no(503, SAY.busy);
		const { result, duel } = r.value;
		if (result === "not-yours") return no(403, SAY.notYours);
		if (result === "late") return no(409, SAY.late, {
			code: "late",
			duel
		});
		if (result === "busy") return no(409, SAY.inFight, {
			code: "busy",
			duel
		});
		return ok({ duel });
	}
	if (action === "duel-pack") {
		const packed = readPack(body.pack, everything);
		if ("problem" in packed) return no(400, SAY.gear, { code: "gear" });
		const r = await services.duelPack(player, id, packed.pack, DUEL_TURN_MS);
		if (!r.ok) return r.why === "refused" ? no(400, SAY.bad) : no(503, SAY.busy);
		const { result, duel, state } = r.value;
		if (result === "not-yours") return no(403, SAY.notYours);
		if (result === "gear") return no(400, SAY.gear, {
			code: "gear",
			duel,
			state
		});
		if (result === "late") return no(409, duel?.status === "packing" ? SAY.late : SAY.over, {
			code: "late",
			duel,
			state
		});
		return ok({
			duel,
			state
		});
	}
	const loaded = await services.duelLoad(id);
	if (loaded === "busy") return no(503, SAY.busy);
	const seat = loaded ? seatOf(loaded.duel, player) : -1;
	if (!loaded || seat < 0) return no(403, SAY.notYours);
	const d = loaded.duel;
	if ((!on || !loaded.on[0] || !loaded.on[1]) && duelOpen(d)) {
		const run = d.status === "playing" ? replay(d) : null;
		const ended = await services.duelEnd(d.id, d.version, d.status === "playing" ? "done" : "cancelled", d.status === "playing" ? "switched-off" : null, null, null, null, run ? run.used : null, null);
		if (ended === "busy") return no(503, SAY.busy);
		if (!ended) return no(409, SAY.changed, { code: "changed" });
		return no(403, SAY.switchedOff, {
			code: "game-off",
			duel: ended
		});
	}
	if (!on) return no(403, SAY.switchedOff, {
		code: "game-off",
		duel: d
	});
	if (action === "leave") {
		if (!duelOpen(d)) return ok({ duel: d });
		if (d.status !== "playing") {
			const status = d.status === "asked" && seat === 1 ? "declined" : "cancelled";
			const ended = await services.duelEnd(d.id, d.version, status, null, null, null, null, null, null);
			if (ended === "busy") return no(503, SAY.busy);
			if (!ended) return no(409, SAY.changed, { code: "changed" });
			return ok({ duel: ended });
		}
		const run = replay(d);
		if (!run) return no(500, SAY.busy);
		const ended = await services.duelEnd(d.id, d.version, "done", "left", 1 - seat, seat, null, run.used, null);
		if (ended === "busy") return no(503, SAY.busy);
		if (!ended) return no(409, SAY.changed, { code: "changed" });
		return ok({ duel: ended });
	}
	if (d.status === "asked" || d.status === "packing") return no(409, SAY.notStarted, {
		code: "not-started",
		duel: d
	});
	if (d.status !== "playing") {
		if (action === "shot" && body.version === d.version - 1 && isLastMine(d, seat, body.shot)) return ok({ duel: d });
		return no(409, SAY.over, {
			code: "over",
			duel: d
		});
	}
	if (action === "shot") {
		const shot = readShot(body.shot);
		if (!shot || !Number.isInteger(body.version)) return no(400, SAY.bad);
		if (body.version !== d.version) {
			if (body.version === d.version - 1 && isLastMine(d, seat, shot)) return ok({ duel: d });
			return no(409, SAY.changed, {
				code: "changed",
				duel: d
			});
		}
		const run = replay(d);
		if (!run) return no(500, SAY.busy);
		if (run.round.turn !== seat) return no(409, SAY.notYourTurn, {
			code: "not-your-turn",
			duel: d
		});
		const taken = takeShot(run, shot);
		if (taken.problem) return no(400, `That shot can't be played: ${taken.problem}.`, {
			code: "illegal",
			duel: d
		});
		return afterTurn(services, d, run, [...d.turns, shot], timeoutsAfter(d.timeouts, seat, false), true);
	}
	const left = Date.parse(d.deadline) + DUEL_GRACE_MS - services.now();
	if (!(left <= 0)) return no(409, SAY.notYet, {
		code: "not-yet",
		secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1e3) : 45,
		duel: d
	});
	const run = replay(d);
	if (!run) return no(500, SAY.busy);
	const turnSeat = run.round.turn;
	takeShot(run, PASS);
	const timeouts = timeoutsAfter(d.timeouts, turnSeat, true);
	if (tooManyTimeouts(timeouts) && run.winner === null) {
		const ended = await services.duelEnd(d.id, d.version, "done", "timeouts", null, turnSeat, [...d.turns, PASS], run.used, timeouts);
		if (ended === "busy") return no(503, SAY.busy);
		if (!ended) return no(409, SAY.changed, { code: "changed" });
		return ok({ duel: ended });
	}
	return afterTurn(services, d, run, [...d.turns, PASS], timeouts, false);
}
/** Was this player's shot the last turn played (so the same shot sent again is the same request)? */
function isLastMine(d, seat, raw) {
	const shot = readShot(raw);
	if (!shot || d.turns.length === 0) return false;
	const last = d.turns.length - 1;
	return last % 2 === seat && sameShot(d.turns[last], shot);
}
/** Saves the turn just played: the fight goes on (the next player's 45 seconds start) or it's over (points to both). */
async function afterTurn(services, d, run, turns, timeouts, real) {
	if (run.winner === null) {
		const saved = await services.duelMove(d.id, d.version, turns, run.used, timeouts, services.now() + DUEL_TURN_MS, real);
		if (saved === "busy") return no(503, SAY.busy);
		if (!saved) return no(409, SAY.changed, { code: "changed" });
		return ok({ duel: saved });
	}
	const winner = run.winner === "draw" ? null : run.winner;
	const ended = await services.duelEnd(d.id, d.version, "done", "finished", winner, null, turns, run.used, timeouts);
	if (ended === "busy") return no(503, SAY.busy);
	if (!ended) return no(409, SAY.changed, { code: "changed" });
	const points = [winner === 0 ? 4 : 3, winner === 1 ? 4 : 3];
	for (const i of [0, 1]) try {
		await services.awardPoints(i === 0 ? d.seat_a : d.seat_b, points[i], `archery-duel:${d.id}:${i}`);
	} catch {
		console.error("archery: classmate fight points could not be given");
	}
	return ok({
		duel: ended,
		points
	});
}
/** An Armory with everything, for checking a quiver's shape. */
const EVERYTHING = {
	coins: 0,
	spent: 0,
	shields: [
		"wood",
		"charm",
		"bubble"
	],
	bows: [
		"long",
		"recurve",
		"hunter",
		"golden"
	],
	gear: Object.fromEntries(shopItems().filter((i) => i.kind === "gear").map((i) => [i.id, 5]))
};
const isRequestId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(v);
const isSeed = (v) => typeof v === "string" && /^[a-f0-9-]{10,80}$/.test(v);
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleArchery(request) {
		const cors = corsHeaders(request.headers.get("Origin"));
		const reply = (status, body) => new Response(JSON.stringify(body), {
			status,
			headers: {
				...cors,
				"Content-Type": "application/json"
			}
		});
		const busy = (what = "That") => reply(503, { error: `${what} couldn't be done just now. Try again in a moment.` });
		if (request.method === "OPTIONS") return new Response(null, {
			status: 204,
			headers: cors
		});
		if (request.method !== "POST") return reply(405, { error: "Not allowed." });
		const token = bearerToken(request);
		const player = token ? await services.userIdFor(token) : null;
		if (!player) return reply(401, { error: "Please sign in again." });
		if (!limiter.allow(player, 90)) return reply(429, { error: "Slow down a little!" });
		const raw = await readJsonBody(request);
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) return reply(400, { error: "That couldn't be read." });
		const body = raw;
		const on = await services.enabled(player);
		if (on === null) return busy("The Armory");
		const duelAction = DUEL_ACTIONS.includes(body.action) ? body.action : null;
		if (duelAction && (on || duelAction === "shot" || duelAction === "times-up" || duelAction === "leave")) {
			const r = await handleDuel(services, player, duelAction, body, on, EVERYTHING);
			return reply(r.status, r.body);
		}
		if (!on) return reply(403, {
			error: "Archery Challenge is not switched on for your class.",
			code: "game-off"
		});
		switch (body.action) {
			case "load": {
				const s = await services.state(player);
				if (!s.ok) return busy("Your Armory");
				return reply(200, {
					state: withoutCount(s.value),
					roundsLeft: Math.max(0, 8 - s.value.roundsToday)
				});
			}
			case "round-start": {
				const s = await services.state(player);
				if (!s.ok) return busy("The speed round");
				const earns = s.value.roundsToday < 8;
				const context = await services.mathsContext(player);
				if (!context) return busy("The speed round");
				const seed = services.randomHex(12);
				const questions = makeRoundQuestions(context, seededRandom(seed));
				if (!questions.length) return busy("The speed round");
				const at = services.now();
				if (!await services.roundStart(player, seed, questions, earns, at)) return busy("The speed round");
				return reply(200, {
					seed,
					earns,
					questions: questions.length,
					question: publicQuestion(questions[0], 0),
					limitMs: limitMs(0),
					roundsLeft: Math.max(0, 8 - s.value.roundsToday - (earns ? 1 : 0))
				});
			}
			case "round-answer": {
				const { seed, slot } = body;
				const timedOut = body.timedOut === true;
				const value = body.value;
				if (!isSeed(seed) || !Number.isInteger(slot) || slot < 0 || slot > 20) return reply(400, { error: "That answer couldn't be read." });
				if (!timedOut && (typeof value !== "number" || !Number.isFinite(value) || value < -1e6 || value > 1e6)) return reply(400, { error: "That answer couldn't be read." });
				const round = await services.roundLoad(player, seed);
				if (round === "busy") return busy("Marking");
				const at = slot;
				const marked = round ? markQuestion(round.questions[at]) : null;
				if (!round || !marked || round.served[String(at)] === void 0) return reply(400, { error: "That answer couldn't be marked." });
				const sentAt = round.served[String(at)];
				const before = round.answered[String(at)];
				const nextSlot = at + 1 < round.questions.length ? at + 1 : null;
				const rightSoFar = Object.values(round.answered).filter((a) => a.right).length;
				if (before) {
					if (!(timedOut ? before.value === null : before.value !== null && sameAnswer(before.value, value))) return reply(400, { error: "You've already answered that one." });
					return reply(200, answerReply(round, before.right, marked.answer, before.coins, null, nextSlot, rightSoFar, void 0));
				}
				const now = services.now();
				const ago = Math.max(0, now - sentAt);
				const claimedMs = typeof body.ms === "number" && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : ago;
				const correct = !timedOut && sameAnswer(value, marked.answer);
				const coins = correct && round.earns && inTime(at, claimedMs, ago) ? 10 : 0;
				const done = await services.roundAnswer(player, seed, at, timedOut ? null : value, correct, coins, nextSlot === null ? null : now);
				if (done === "busy") return busy("Marking");
				if (!done.claimed) return reply(400, { error: "You've already answered that one." });
				if (!timedOut) await safely(() => services.recordAnswers(player, `${seed}:${at}`, [{
					key: marked.key,
					correct,
					ms: recordedMs(claimedMs, ago),
					at: now
				}]));
				const right = rightSoFar + (correct ? 1 : 0);
				let point = false;
				if (nextSlot === null && right >= 5) {
					point = true;
					await safely(() => services.awardPoints(player, 1, `archery-round:${seed}`));
				}
				return reply(200, { ...answerReply(round, correct, marked.answer, coins, done.coins ?? null, nextSlot, right, point) });
			}
			case "buy":
			case "sell": {
				const item = shopItem(body.kind, body.item);
				if (!item || !isRequestId(body.request)) return reply(400, { error: "That isn't in the Armory." });
				const action = body.action;
				const price = action === "buy" ? item.price : sellPrice(item);
				const done = await services.shop(player, body.request, action, item.kind, item.id, price, action === "buy" ? item.qty : 1, LEVEL_SPEND[item.level - 1] ?? 0, 5);
				if (!done.ok) return done.why === "refused" ? reply(400, { error: "That couldn't be done." }) : busy("The Armory");
				return reply(200, done.value);
			}
			case "fight-start": {
				const world = body.world;
				const opponent = body.opponent;
				if (!WORLD_IDS.includes(world) || !BOT_LEVELS.includes(opponent) || !isRequestId(body.request)) return reply(400, { error: "That fight couldn't be started." });
				const packed = readPack(body.pack, EVERYTHING);
				if ("problem" in packed) return reply(400, {
					error: "You don't have all of that in your bag.",
					code: "gear"
				});
				const seed = parseInt(services.randomHex(4), 16) >>> 0;
				const done = await services.fightStart(player, body.request, seed, world, opponent, packed.pack);
				if (!done.ok) return done.why === "refused" ? reply(400, { error: "That fight couldn't be started." }) : busy("The fight");
				if (done.value.result !== "ok") return reply(400, {
					error: "You don't have all of that in your bag.",
					code: "gear",
					state: done.value.state
				});
				const kept = await services.fightLoad(player, done.value.fight);
				if (kept === "busy" || !kept) return busy("The fight");
				return reply(200, {
					fight: done.value.fight,
					seed: kept.seed,
					world: kept.world,
					opponent: kept.opponent,
					pack: kept.pack,
					state: done.value.state
				});
			}
			case "fight-finish": {
				const id = body.fight;
				const shots = readShots(body.shots);
				const left = body.left === true;
				if (!Number.isSafeInteger(id) || id < 1 || !shots) return reply(400, { error: "That fight couldn't be read." });
				const fight = await services.fightLoad(player, id);
				if (fight === "busy") return busy("Saving the fight");
				if (!fight) return reply(400, { error: "That fight couldn't be found." });
				const setup = {
					world: fight.world,
					players: [fight.pack, botSetup(fight.opponent)]
				};
				const judged = judgeBotFight(fight.seed, setup, fight.opponent, shots, !left);
				if (!judged.ok) {
					console.warn(`archery: refused a fight (${judged.problem})`);
					return reply(400, { error: "That fight couldn't be saved." });
				}
				const f = judged.fight;
				const won = f.winner === 0;
				const done = await services.fightEnd(player, id, left ? "left" : "done", unused(fight.pack, f.used), f.score, won);
				if (!done.ok) return done.why === "refused" ? reply(400, { error: "That fight couldn't be saved." }) : busy("Saving the fight");
				let points = 0;
				if (!left && done.value.result === "ok") {
					points = won ? 3 : 2;
					await safely(() => services.awardPoints(player, points, `archery-fight:${id}`));
				}
				return reply(200, {
					result: done.value.result,
					winner: f.winner,
					roundWins: f.roundWins,
					score: f.score,
					best: done.value.best,
					points,
					state: done.value.state
				});
			}
		}
		return reply(400, { error: "That couldn't be read." });
	};
}
/** The reply to an answer: right or not, the right answer, coins, and the next question (null at the end). */
function answerReply(round, correct, answer, coins, total, nextSlot, right, point) {
	return {
		correct,
		answer,
		coins,
		...total === null ? {} : { total },
		right,
		next: nextSlot === null ? null : {
			question: publicQuestion(round.questions[nextSlot], nextSlot),
			limitMs: limitMs(nextSlot)
		},
		...point === void 0 ? {} : { point }
	};
}
function withoutCount(s) {
	const { roundsToday: _skip, ...rest } = s;
	return rest;
}
/** Records and points are a bonus: if they fail, the round or fight is never lost over them. */
async function safely(f) {
	try {
		await f();
	} catch {
		console.error("archery: the maths records or points could not be updated");
	}
}
//#endregion
//#region supabase/functions/archery/entry.ts
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
	console.error(`archery: ${name} failed (${error.code ?? "unknown"})`);
	if (error.code && /^2[23]/.test(error.code)) return {
		ok: false,
		why: "refused"
	};
	return {
		ok: false,
		why: "busy"
	};
}
/** Like `call`, for reads that give null when there's nothing: 'busy' if the database couldn't be reached. */
async function read(name, args) {
	const r = await call(name, args);
	return r.ok ? r.value : "busy";
}
/** A classmate fight row from a database function: 'busy' if it couldn't be reached, null if it had changed. */
async function duelRow(name, args) {
	const r = await call(name, args);
	if (!r.ok) return "busy";
	return r.value && r.value.id != null ? parseDuel(r.value) : null;
}
/** A reply with a fight row in it ({ result, duel, … }), with the row read properly. */
function withDuel(r) {
	if (!r.ok) return r;
	const duel = r.value.duel === void 0 || r.value.duel === null ? void 0 : parseDuel(r.value.duel) ?? void 0;
	return {
		ok: true,
		value: {
			...r.value,
			duel
		}
	};
}
Deno.serve(makeHandler({
	now: () => Date.now(),
	randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join(""),
	userIdFor: userIdFromToken(admin.auth),
	async enabled(player) {
		const { data, error } = await admin.rpc("settings_of", { player }).maybeSingle();
		if (error || !data) {
			console.error(`archery: settings failed (${error?.code ?? "none"})`);
			return null;
		}
		return data.archery_enabled === true;
	},
	async mathsContext(player) {
		const { data, error } = await admin.rpc("space_maths_context", { player });
		if (error || !data) {
			console.error(`archery: maths records failed (${error?.code ?? "none"})`);
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
	state: (player) => call("archery_state", { player }),
	shop: (player, request, action, kind, item, price, qty, needSpent, carry) => call("archery_shop", {
		player,
		request_id: request,
		action,
		kind,
		item,
		price,
		qty,
		need_spent: needSpent,
		carry
	}),
	async roundStart(player, seed, questions, earns, servedMs) {
		return (await call("archery_round_start", {
			player,
			seed,
			questions,
			earns,
			served_ms: servedMs
		})).ok;
	},
	roundLoad: (player, seed) => read("archery_round_load", {
		player,
		seed
	}),
	async roundAnswer(player, seed, slot, value, right, coins, nextMs) {
		const r = await call("archery_round_answer", {
			player,
			seed,
			slot,
			value,
			right_answer: right,
			coins,
			next_ms: nextMs
		});
		return r.ok ? r.value : "busy";
	},
	fightStart: (player, request, seed, world, opponent, pack) => call("archery_fight_start", {
		player,
		request_id: request,
		seed,
		world,
		opponent,
		pack
	}),
	async fightLoad(player, fight) {
		const r = await read("archery_fight_load", {
			player,
			fight
		});
		if (r === "busy" || r === null) return r;
		return {
			...r,
			seed: Number(r.seed)
		};
	},
	fightEnd: (player, fight, status, back, score, won) => call("archery_fight_end", {
		player,
		fight,
		status,
		back,
		score,
		won
	}),
	async recordAnswers(player, once, answers) {
		await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, "archery");
	},
	async duelLoad(duel) {
		const r = await read("archery_duel_load", { duel });
		if (r === "busy" || r === null) return r;
		const row = parseDuel(r.duel);
		return row ? {
			duel: row,
			on: [r.on[0] === true, r.on[1] === true]
		} : null;
	},
	duelChallenge: (player, request, other, world, seed, waitMs) => call("archery_duel_challenge", {
		player,
		request_id: request,
		other,
		world,
		seed,
		wait_ms: waitMs
	}),
	async duelAnswer(player, duel, accept, packMs) {
		return withDuel(await call("archery_duel_answer", {
			player,
			duel,
			accept,
			pack_ms: packMs
		}));
	},
	async duelPack(player, duel, pack, turnMs) {
		return withDuel(await call("archery_duel_pack", {
			player,
			duel,
			pack,
			turn_ms: turnMs
		}));
	},
	duelMove: (duel, version, turns, used, timeouts, deadlineMs, real) => duelRow("archery_duel_move", {
		duel,
		version,
		turns,
		used,
		timeouts,
		deadline_ms: deadlineMs,
		real
	}),
	duelEnd: (duel, version, status, ending, winner, leaver, turns, used, timeouts) => duelRow("archery_duel_end", {
		duel,
		version,
		status,
		ending,
		winner,
		leaver,
		turns,
		used,
		timeouts
	}),
	async awardPoints(player, points, once) {
		const { error } = await admin.rpc("add_game_points", {
			player,
			game: "archery",
			points,
			once
		});
		if (error) console.error(`archery: points failed (${error.code ?? "unknown"})`);
	}
}));
//#endregion
