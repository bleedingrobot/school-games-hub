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
const divKeys = (divisors) => Object.values(BANDED_PACKS.division.families).flatMap((f) => f.keys).filter((k) => {
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
		const div = divKeys(step.add).filter((k) => !seen.has(k));
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
/** Which skill pack records a mastery key ("mul:7x8" → "times-tables"), or null if it isn't a ladder key. */
function packIdOfKey(key) {
	if (/^mul:\d+x\d+$/.test(key)) return "times-tables";
	if (/^(bond10|bond20|dbl|half):/.test(key)) return "early-facts";
	if (key.startsWith("add:")) return "add-sub";
	if (key.startsWith("div:")) return "division";
	return null;
}
/** The packs a game keeps records for under a focus (everything the built ladder uses). */
const FOCUS_PACKS = [
	"times-tables",
	"early-facts",
	"add-sub",
	"division"
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
//#region shared/maths/focus.ts
const ladderKeys = ladderKeyPacks();
for (let a = 1; a <= 12; a++) for (let b = a; b <= 12; b++) ladderKeys.set(`mul:${a}x${b}`, "times-tables");
/** True for a mastery key the games record under a focus. */
const isFocusKey = (key) => ladderKeys.has(key);
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
	recordAnswers: (player, pack, batchId, answers) => call("record_fact_answers", {
		player,
		pack,
		batch_id: batchId,
		answers,
		quick_ms: QUICK_MS,
		fluent_days: 2,
		top_box: 4
	}),
	importProgress: (player, levels) => call("import_gem_keep_progress", {
		player,
		levels
	})
}));
//#endregion
