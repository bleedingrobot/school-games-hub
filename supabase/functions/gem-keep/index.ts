// GENERATED FILE: don't edit. Edit supabase/functions/gem-keep/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "gem-keep" function.

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
/** A step's tables count as secure when this share of their facts are in box 2 or higher. */
const STEP_SECURE_SHARE = .7;
new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" });
//#endregion
//#region shared/maths/banded.ts
/** A whole number from lo to hi (both included). */
const int = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
const pickOne = (random, items) => items[Math.floor(random() * items.length)];
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
/** Same answer, allowing for floating-point dust (0.30000000000000004). */
const sameAnswer = (a, b) => Math.abs(a - b) < 1e-6;
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
				if (!isInt$1(a, 1, 9) || !isInt$1(b, 1, 9)) return null;
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
				if (!isInt$1(a, 2, 19) || !isInt$1(b, 1, Math.min(9, a - 1))) return null;
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
				if (!isInt$1(n, 1, 9)) return null;
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
				if (!isInt$1(a, 1, 99) || !isInt$1(b, 1, 99) || a === b || a % 10 === 0 === (b % 10 === 0)) return null;
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
				if (!isInt$1(a, 1, 99) || a % 10 === 0 || !isInt$1(p, 1, 2)) return null;
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
				if (!isInt$1(a, 11, 199) || a % 10 === 0) return null;
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
				if (!isInt$1(a, 1, 9) || !isInt$1(b, 2, 9)) return null;
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
				].includes(d) || !isInt$1(q, 1, 10)) return null;
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
				].includes(d) || !isInt$1(n, 2, d - 1) || gcd$2(n, d) !== 1 || !isInt$1(q, 1, 10)) return null;
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
				if (!isInt$1(d, 2, 5) || !isInt$1(n, 1, d - 1) || gcd$2(n, d) !== 1 || !isInt$1(k, 2, 5) || !isInt$1(v, 0, 1)) return null;
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
				if (!isInt$1(d, 3, 12) || !isInt$1(a, 2, d) || !isInt$1(b, 1, a - 1)) return null;
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
				if (!isInt$1(d, 2, 8) || !isInt$1(w, 1, 4) || !isInt$1(n, 1, d - 1) || !isInt$1(v, 0, 1)) return null;
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
				while (gcd$2(n, d) !== 1);
				return [
					n,
					d,
					int(r, 2, 6),
					int(r, 0, 1)
				];
			},
			make: (_k, [n, d, k, v]) => {
				if (!isInt$1(d, 2, 6) || !isInt$1(n, 1, d - 1) || gcd$2(n, d) !== 1 || !isInt$1(k, 2, 6) || !isInt$1(v, 0, 1)) return null;
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
			if (!bond || bond.total !== total || bond.a !== a || bond.b !== b || !keys.includes(key) || !isInt$1(v, 0, 3)) return null;
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
			if (!keys.includes(key) || key.split(":")[1] !== String(n) || !isInt$1(v, 0, 1)) return null;
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
				if (!isInt$1(n, 1, 9) || key !== `tenand:${n}` || !isInt$1(v, 0, 3)) return null;
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
	if (!template || nums.length !== lettersOf(template.src) || !nums.every((n) => isInt$1(n, 2, MAX_NUMBER))) return null;
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
const goodPick = (slot, salt, wrong = 3) => isInt$1(slot, 0, wrong) && isInt$1(salt, 0, 9);
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
		if (!isInt$1(d, 2, 9) || !goodPick(slot, salt)) return null;
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
		if (!isInt$1(d, 1, 9) || !goodPick(slot, salt)) return null;
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
		if (!isInt$1(n, 1, 99) || !notTen(n)) return null;
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
			if (!isInt$1(t, 2, 38) || t % 2 !== 0) return null;
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
		if (v !== 1 || !isInt$1(t, 1, 24)) return null;
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
		if (!isInt$1(a, 1, 99) || !isInt$1(b, 1, 99) || !ok(a, b)) return null;
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
		if (!isInt$1(w, 1, 9) || !isInt$1(t, 1, 9) || !isInt$1(v, 0, 2)) return null;
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
		if (!isInt$1(t, 1, 9) || !isInt$1(target, 1, 2) || !isInt$1(v, 0, 2)) return null;
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
		if (!isInt$1(n, 1, 99) || !notTen(n)) return null;
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
		if (!pair || !isInt$1(i, 0, FRACTION_DECIMALS.length - 1) || !goodPick(slot, salt)) return null;
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
		if (!goodPick(slot, salt, 1) || !isInt$1(x, 1, 99) || !notTen(x) || !isInt$1(v, 0, 1)) return null;
		const smaller = v === 0 ? x : y * 10;
		const bigger = v === 0 ? y * 10 : x;
		if (v === 0 && !(isInt$1(y, 1, 9) && y * 10 > x)) return null;
		if (v === 1 && !(isInt$1(y, 1, 9) && y === Math.floor(x / 10))) return null;
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
		if (!isInt$1(n, 1, 1e5) || !check(n)) return null;
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
		if (!isInt$1(t, 11, 99) || !notTen(t) || !isInt$1(v, 0, 3)) return null;
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
		if (!isInt$1(h, 1, 99)) return null;
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
		if (!dens.includes(d) || !isInt$1(q, qLo, qHi)) return null;
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
		if (den !== d || !tops.includes(n) || !isInt$1(q, 1, 10)) return null;
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
const isSimplest = (n, d) => isInt$1(d, 2, 6) && isInt$1(n, 1, d - 1) && gcd$1(n, d) === 1;
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
		if (!isSimplest(n, d) || !isInt$1(k, 2, 6)) return null;
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
		if (!isSimplest(n, d) || !isInt$1(k, 2, 6)) return null;
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
		if (!isSimplest(n, d) || !isInt$1(k, 2, 5) || !goodPick(slot, salt)) return null;
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
		if (!isSimplest(n, d) || !isInt$1(k, 2, 5) || !goodPick(slot, salt)) return null;
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
		if (!isSimplest(n, d) || !isInt$1(k, 2, 5) || !isInt$1(v, 0, 1)) return null;
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
		if (!shapes.some(([a, b]) => a === n && b === d) || !isInt$1(q, qLo, qHi)) return null;
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
		if (!isInt$1(q, qLo, qHi)) return null;
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
	if (!shape || !isInt$1(q, shape.lo, shape.hi)) return null;
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
		if (!isInt$1(x, xLo, xHi)) return null;
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
	const valid = (a) => type === "take" ? total === 100 ? isInt$1(a, 1, 99) : isInt$1(a, 10, 990) && a % 10 === 0 : bondTypeOf(total, a) === type;
	const candidates = range(1, total - 1).filter(valid);
	return oneKey(key, label, tags, 2, (_k, r) => [pickOne(r, candidates), int(r, 0, 1)], (_k, [a, v]) => {
		if (!valid(a) || !isInt$1(v, 0, 1)) return null;
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
		if (!isInt$1(x, 1, 1e3) || !isInt$1(y, 1, 1e3) || timesKeyOf(x, y) !== key) return null;
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
	if (!isInt$1(d, 2, 9) || !isTens(q)) return null;
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
		if (!PAIR_NUMBERS.includes(n) || !isInt$1(a, 2, n - 1) || n % a !== 0) return null;
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
		if (!isInt$1(n, 2, 12)) return null;
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
		if (!isInt$1(n, 2, 5)) return null;
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
		if (!isInt$1(x, 5, 143) || isSquare(x)) return null;
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
		if (!isInt$1(n, lo, hi) || wholeKeyOf(unit, n) !== key) return null;
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
		if (!isInt$1(m, lo, hi) || decimalKeyOf(unit, dp, m) !== key) return null;
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
Object.keys(families), quickMsForPack("generated");
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
/**
* A question made again from its record key and the numbers it was made from (`Question.params`), accepted only when it comes out
* exactly as it was shown. This is how the server marks answers to every generated question, including the pick-one ones whose
* choices are not in the parts. Null if no generated skill owns the key, the numbers are not ones it could have rolled, or the
* question they make is not the one shown. See claim.ts.
*/
function solveByNumbers(key, params, parts) {
	const made = Object.hasOwn(families, key) ? families[key].make(key, params) : null;
	return made && sameParts(made.parts, parts) ? {
		answer: tidy(made.answer),
		key
	} : null;
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
/** Which skill pack records a mastery key ("mul:7x8" → "times-tables"), or null if it isn't a ladder key. */
function packIdOfKey(key) {
	if (/^mul:\d+x\d+$/.test(key)) return "times-tables";
	if (isGeneratedKey(key)) return "generated";
	if (/^(bond10|bond20|dbl|half|tenand):/.test(key)) return "early-facts";
	if (key.startsWith("add:")) return "add-sub";
	if (key.startsWith("div:")) return "division";
	return null;
}
/** The packs a game keeps records for under a focus (everything the built ladder uses). */
const FOCUS_PACKS = [
	"times-tables",
	"early-facts",
	"add-sub",
	"division",
	"generated"
];
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
/**
* Where the check goes next, given the answers so far: the skill to ask about, or null when it is finished.
* It starts at the class's year start and moves up three skills (`PLACEMENT_JUMP`) after a right, quick answer (one after it has missed
* once) and back one when the answer is wrong or slow. All steps are over the built skills only.
*/
function placementNext(yearLevel, steps) {
	const built = builtSkills();
	const top = built.length - 1;
	let level = Math.max(0, built.findIndex((s) => LADDER.indexOf(s) >= yearStartRank(yearLevel)));
	let jump = 3;
	for (const step of steps) if (step.correct && step.quick) level = Math.min(top, level + jump);
	else {
		level = Math.max(0, level - 1);
		jump = 1;
	}
	return steps.length >= 10 ? null : built[level];
}
/** Where to start: just below the highest skill they answered right and quickly. A student who got nothing right starts at the first skill. */
function placementResult(steps) {
	const built = builtSkills();
	let best = -1;
	for (const step of steps) {
		const at = built.findIndex((s) => s.id === step.skill);
		if (step.correct && step.quick && at > best) best = at;
	}
	return built[Math.max(0, best - 1)];
}
/** Quick enough for the skill: its records' own quick time (a rounding or order-of-operations question gets longer than a fact). */
const isQuick = (ms, skill) => ms <= quickMsForPack(skill?.keys[0] ? packIdOfKey(skill.keys[0]) : null);
//#endregion
//#region shared/maths/focus.ts
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
/** The ladder facts of a focus (auto off, nothing known, when it has none). */
const ladderOf = (focus) => focus?.ladder ?? NO_LADDER;
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
/** The numbers if they are a plausible list, else null. */
function cleanParams(raw) {
	if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) return null;
	return raw.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e9) ? raw : null;
}
/** The right answer and the record of a question as the browser says it was asked, or null when it does not hold up. */
function solveClaim(claim) {
	if (typeof claim.key === "string" && claim.params !== void 0) {
		const params = cleanParams(claim.params);
		if (params && Array.isArray(claim.parts) && claim.parts.every((p) => typeof p === "string")) {
			const found = solveByNumbers(claim.key, params, claim.parts);
			if (found) return {
				answer: found.answer,
				keys: [found.key]
			};
		}
	}
	return solveParts(claim.parts);
}
//#endregion
//#region shared/maths/placementCheck.ts
/**
* Checking a placement check on the server (docs/MATHS-FOCUS-PLAN.md section 5). The website sends the ten questions it showed
* and what the student answered. The server asks the same walk where each question should have come from, works each question
* out from how it was shown (`solveParts`), and only then says where the student starts. The result only says where to start.
*/
/** The most parts a question can have (order of operations is the longest). */
const MAX_QUESTION_PARTS = 12;
/** True if this looks like a placement answer; anything else is thrown away. */
function parsePlacementAnswers(raw) {
	if (!Array.isArray(raw) || raw.length !== 10) return null;
	const out = [];
	for (const r of raw) {
		if (!r || typeof r !== "object") return null;
		const { skill, parts, answer, ms, key, params } = r;
		if (key !== void 0 && (typeof key !== "string" || key.length > 51)) return null;
		if (params !== void 0 && !cleanParams(params)) return null;
		if (typeof skill !== "string" || !Array.isArray(parts) || !parts.every((p) => typeof p === "string") || parts.length > MAX_QUESTION_PARTS) return null;
		if (typeof answer !== "number" || !Number.isFinite(answer) || typeof ms !== "number" || !Number.isFinite(ms)) return null;
		out.push({
			skill,
			parts,
			answer,
			ms: Math.max(0, ms),
			...typeof key === "string" ? { key } : {},
			...params ? { params } : {}
		});
	}
	return out;
}
/** The skill to start at, or null if the answers can't be a placement check for this year level. */
function checkPlacement(yearLevel, answers) {
	const steps = [];
	for (const a of answers) {
		const expected = placementNext(yearLevel, steps);
		if (!expected || expected.id !== a.skill) return null;
		const solved = solveClaim(a);
		if (!solved || !solved.keys.some((k) => expected.keys.includes(k))) return null;
		const correct = sameAnswer(a.answer, solved.answer);
		steps.push({
			skill: a.skill,
			correct,
			quick: correct && isQuick(a.ms, expected)
		});
	}
	if (placementNext(yearLevel, steps) !== null) return null;
	return placementResult(steps).id;
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
/** Checks a placement from the website (`{ skip: true }` or `{ answers: [...] }`) and stores where to start. */
async function savePlacement(ports, player, raw) {
	const context = await ports.loadContext(player);
	if (!context) throw new Error("place: cannot read the ladder");
	const { info } = ladderOfContext(context);
	if (!info.on) return { outcome: "refused" };
	if (info.placed) return { outcome: "already" };
	const body = raw && typeof raw === "object" ? raw : {};
	if (body.skip === true) return { outcome: await ports.savePlacementRow(player, null, true) ? "saved" : "already" };
	const answers = parsePlacementAnswers(body.answers);
	const start = answers ? checkPlacement(info.yearLevel, answers) : null;
	if (!start) return { outcome: "refused" };
	return {
		outcome: await ports.savePlacementRow(player, start, false) ? "saved" : "already",
		start
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
function checkAnswers(x, nowMs) {
	const pack = FOCUS_PACKS.find((p) => p === x.pack);
	if (!pack) return {
		ok: false,
		problem: "pack"
	};
	if (typeof x.batchId !== "string" || !UUID.test(x.batchId)) return {
		ok: false,
		problem: "batch-id"
	};
	if (!Array.isArray(x.answers) || x.answers.length > 500) return {
		ok: false,
		problem: "answers"
	};
	const answers = [];
	for (const raw of x.answers) {
		const a = raw ?? {};
		if (typeof a.key !== "string" || !isFocusKey(a.key) || packIdOfKey(a.key) !== pack || typeof a.correct !== "boolean") continue;
		if (!isInt(a.ms, 250, 36e5) || !isInt(a.at, nowMs - 5184e6, nowMs + 864e5)) continue;
		answers.push({
			key: a.key,
			correct: a.correct,
			ms: a.ms,
			at: a.at
		});
	}
	return {
		ok: true,
		item: {
			type: "answers",
			pack,
			batchId: x.batchId,
			answers
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
		case "answers": return checkAnswers(x, nowMs);
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
		if (body && body.placement !== void 0 && body.items === void 0) {
			if (!services.savePlacement) return reply(404, { error: "Not here." });
			try {
				const saved = await services.savePlacement(player, body.placement);
				return saved.outcome === "refused" ? reply(400, { error: "That couldn't be used." }) : reply(200, saved);
			} catch {
				return reply(503, { error: "We couldn't save that just now." });
			}
		}
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
		if (services.syncPlace && results.some((r) => r.type === "answers" && r.added > 0 || r.type === "facts" && r.changed > 0)) await services.syncPlace(player);
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
		case "answers":
			if (item.answers.length === 0) return {
				type: "answers",
				added: 0
			};
			return settle(await services.recordAnswers(player, item.pack, item.batchId, item.answers), (added) => ({
				type: "answers",
				added
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
/** The database calls the ladder needs: the student's records and focus, their furthest place and their placement. */
const placePorts = {
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
	async savePlacementRow(player, skill, skipped) {
		const { data, error } = await admin.rpc("record_placement", {
			player,
			start_skill: skill,
			was_skipped: skipped
		});
		if (error) throw new Error(error.code ?? "unknown");
		return data === true;
	}
};
Deno.serve(makeHandler({
	syncPlace: makePlaceSyncer(placePorts),
	savePlacement: (player, raw) => savePlacement(placePorts, player, raw),
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
	recordAnswers: async (player, pack, batchId, answers) => {
		const saved = await call("record_fact_answers", {
			player,
			pack,
			batch_id: batchId,
			answers,
			quick_ms: quickMsForPack(pack),
			fluent_days: 2,
			top_box: 4
		});
		if (saved.ok && saved.value > 0) await countForFocuses((name, args) => admin.rpc(name, args), player, pack, answers, "gem-keep");
		return saved;
	},
	importProgress: (player, levels) => call("import_gem_keep_progress", {
		player,
		levels
	})
}));
//#endregion
