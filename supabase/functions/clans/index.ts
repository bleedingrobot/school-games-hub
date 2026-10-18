// GENERATED FILE: don't edit. Edit supabase/functions/clans/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "clans" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
//#region shared/maths/practical.ts
const YEAR_BANDS = [
	4,
	5,
	6
];
const KINDS = [
	"percent-of",
	"price-with-tax",
	"change",
	"area",
	"perimeter",
	"share-whole",
	"share-left",
	"round-up",
	"troop-cost",
	"budget-left",
	"ratio",
	"negative",
	"better-buy",
	"church-bill",
	"times"
];
/** What a teacher switches on and off. */
const TOPICS = [
	"times",
	"percentages",
	"money",
	"area",
	"division",
	"ratios",
	"rates",
	"integers"
];
const MINUS = "−";
/** A number for people: thousands commas, a proper minus sign, no trailing zeros. */
function fmt(n) {
	const rounded = Math.round(Math.abs(n) * 100) / 100;
	const [whole, decimals] = String(rounded).split(".");
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return (n < 0 && rounded !== 0 ? MINUS : "") + grouped + (decimals ? `.${decimals}` : "");
}
/** Round up, ignoring the tiny errors decimals can leave behind. */
const ceil = (x) => Math.ceil(Math.round(x * 1e6) / 1e6);
const isWhole = (x) => Math.round(x * 1e6) / 1e6 === Math.round(x);
/** A steady pick from a list that depends only on the numbers, so rebuilding gives the same wording. */
const variant = (nums, count) => Math.abs(Math.round(nums.reduce((t, x, i) => t + x * (i + 3), 0))) % count;
const int$2 = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
const choose = (random, list) => list[Math.floor(random() * list.length)];
const stepped = (random, lo, hi, step) => lo + step * Math.floor(random() * ((hi - lo) / step + 1));
const whole = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const allWhole = (nums, lo, hi) => nums.every((n) => whole(n, lo, hi));
/** A total that is not an exact multiple of `per`, between lo and hi. */
function withRemainder(random, per, lo, hi) {
	for (let tries = 0; tries < 200; tries++) {
		const total = int$2(random, lo, hi);
		if (total % per !== 0) return total;
	}
	return lo - lo % per + 1;
}
const PERCENT_WORDS = {
	50: "half",
	25: "a quarter",
	10: "a tenth",
	20: "a fifth",
	75: "three quarters",
	12.5: "an eighth"
};
const GOODS = [
	"shield",
	"helmet",
	"belt",
	"cloak",
	"lantern",
	"rope"
];
const SUPPLIES = [
	"arrows",
	"potions",
	"scrolls",
	"torches"
];
const KIND_DEFS = {
	"percent-of": {
		topic: "percentages",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && n[0] > 0 && n[0] <= 100 && Math.round(n[0] * 10) === n[0] * 10 && whole(n[1], 1, 5e3),
		build([pct, amount], options) {
			const exact = amount * pct / 100;
			const answer = ceil(exact);
			const rounding = isWhole(exact) ? "" : " Round up to a whole number.";
			const text = [
				`What is ${fmt(pct)}% of ${fmt(amount)}?`,
				`${fmt(amount)} followers watch you win. ${fmt(pct)}% of them join your clan. How many join?`,
				`A chest holds ${fmt(amount)} gold. You may take ${fmt(pct)}% of it. How much is that?`
			][options.about === "followers" ? 1 : options.about === "loot" ? 2 : variant([pct, amount], 3)] + rounding;
			const working = [];
			if (PERCENT_WORDS[pct]) {
				const parts = pct === 75 ? 4 : Math.round(100 / pct);
				working.push(`${fmt(pct)}% is ${PERCENT_WORDS[pct]}, so divide by ${parts}${pct === 75 ? " and times by 3" : ""}.`);
				working.push(pct === 75 ? `${fmt(amount)} ÷ 4 = ${fmt(amount / 4)}, then × 3 = ${fmt(amount * 3 / 4)}.` : `${fmt(amount)} ÷ ${parts} = ${fmt(exact)}.`);
			} else {
				working.push(`1% of ${fmt(amount)} is ${fmt(amount / 100)}, so ${fmt(pct)}% is ${fmt(pct)} × ${fmt(amount / 100)}.`);
				working.push(`${fmt(pct)} × ${fmt(amount / 100)} = ${fmt(exact)}.`);
			}
			if (!isWhole(exact)) working.push(`That is ${fmt(exact)}, rounded up to ${fmt(answer)}.`);
			return {
				text,
				answer,
				working
			};
		},
		generate(band, random) {
			if (band === 4) return [choose(random, [
				10,
				25,
				50
			]), choose(random, [
				20,
				40,
				60,
				80,
				100,
				120,
				160,
				200
			])];
			if (band === 5) return [choose(random, [
				10,
				20,
				25,
				50,
				75
			]), stepped(random, 40, 400, 20)];
			return [choose(random, [
				5,
				15,
				30,
				35,
				40,
				45,
				60,
				12.5
			]), stepped(random, 80, 800, 40)];
		}
	},
	"price-with-tax": {
		topic: "percentages",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && whole(n[0], 1, 5e3) && n[1] >= 0 && n[1] <= 100 && Math.round(n[1] * 10) === n[1] * 10,
		build([price, tax], options) {
			const taxAmount = price * tax / 100;
			const exact = price + taxAmount;
			const answer = ceil(exact);
			const text = `${options.item ? `The ${options.item}` : `A ${GOODS[variant([price, tax], GOODS.length)]}`} costs ${fmt(price)} gold. The village adds ${fmt(tax)}% tax. What do you pay?` + (isWhole(exact) ? "" : " Round up to a whole gold piece.");
			const working = [`Work out the tax first: ${fmt(tax)}% of ${fmt(price)} = ${fmt(taxAmount)}.`, `Then add it on: ${fmt(price)} + ${fmt(taxAmount)} = ${fmt(exact)}.`];
			if (!isWhole(exact)) working.push(`Round up to ${fmt(answer)} gold.`);
			return {
				text,
				answer,
				unit: "gold",
				working
			};
		},
		generate(band, random) {
			if (band === 4) return [stepped(random, 20, 200, 10), 10];
			if (band === 5) return [stepped(random, 40, 400, 20), choose(random, [
				10,
				20,
				25
			])];
			return [stepped(random, 80, 720, 40), choose(random, [
				5,
				12.5,
				15,
				30
			])];
		}
	},
	change: {
		topic: "money",
		bands: YEAR_BANDS,
		valid: (n) => n.length >= 2 && n.length <= 4 && allWhole(n, 1, 1e5) && n.slice(1).reduce((t, c) => t + c, 0) <= n[0],
		build([paid, ...costs], options) {
			const total = costs.reduce((t, c) => t + c, 0);
			const answer = paid - total;
			const goods = costs.map((_, i) => GOODS[(variant([paid, ...costs], GOODS.length) + i) % GOODS.length]);
			const things = costs.length === 1 ? `${options.item ? `the ${options.item}` : `a ${goods[0]}`} that costs ${fmt(costs[0])} gold` : `${costs.map((c, i) => `a ${goods[i]} (${fmt(c)} gold)`).join(" and ")}`;
			return {
				text: `You pay ${fmt(paid)} gold for ${things}. How much change do you get?`,
				answer,
				unit: "gold",
				working: costs.length === 1 ? [`Change = what you paid − the cost.`, `${fmt(paid)} − ${fmt(costs[0])} = ${fmt(answer)}.`] : [`First add up the cost: ${costs.map(fmt).join(" + ")} = ${fmt(total)}.`, `Then take it from what you paid: ${fmt(paid)} − ${fmt(total)} = ${fmt(answer)}.`]
			};
		},
		generate(band, random) {
			if (band === 4) return [1e3, stepped(random, 50, 950, 50)];
			if (band === 5) return [1e3, stepped(random, 10, 990, 10)];
			if (random() < .5) return [1e3, int$2(random, 101, 999)];
			const first = int$2(random, 100, 499);
			return [
				1e3,
				first,
				int$2(random, 100, 999 - first)
			];
		}
	},
	area: {
		topic: "area",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && allWhole(n, 1, 200),
		build([w, h]) {
			const answer = w * h;
			return {
				text: `A plot of land is ${fmt(w)} squares wide and ${fmt(h)} squares long. What is its area?`,
				answer,
				unit: "squares",
				working: [`Area = width × length.`, `${fmt(w)} × ${fmt(h)} = ${fmt(answer)} squares.`]
			};
		},
		generate(band, random) {
			if (band === 4) return [int$2(random, 2, 6), int$2(random, 2, 6)];
			if (band === 5) return [int$2(random, 3, 12), int$2(random, 3, 12)];
			return [int$2(random, 6, 20), int$2(random, 5, 15)];
		}
	},
	perimeter: {
		topic: "area",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && allWhole(n, 1, 200),
		build([w, h]) {
			const answer = 2 * (w + h);
			return {
				text: `You want a fence all the way round a plot ${fmt(w)} squares wide and ${fmt(h)} squares long. How many squares long is the fence?`,
				answer,
				unit: "squares",
				working: [`Go all the way round: two widths and two lengths.`, `${fmt(w)} + ${fmt(h)} + ${fmt(w)} + ${fmt(h)} = ${fmt(answer)} squares.`]
			};
		},
		generate(band, random) {
			if (band === 4) return [int$2(random, 2, 8), int$2(random, 2, 8)];
			if (band === 5) return [int$2(random, 3, 15), int$2(random, 3, 15)];
			return [int$2(random, 5, 25), int$2(random, 5, 25)];
		}
	},
	"share-whole": {
		topic: "division",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && whole(n[0], 0, 5e3) && whole(n[1], 1, 500),
		build([total, per]) {
			const answer = Math.floor(total / per);
			const left = total - answer * per;
			return {
				text: `You have ${fmt(total)} training points. Each +1 costs ${fmt(per)} points. How many can you buy?`,
				answer,
				working: [
					`Count how many lots of ${fmt(per)} fit into ${fmt(total)}.`,
					`${fmt(answer)} × ${fmt(per)} = ${fmt(answer * per)}, and ${fmt(answer + 1)} × ${fmt(per)} = ${fmt((answer + 1) * per)} is too many.`,
					`So you can buy ${fmt(answer)}${left ? `, with ${fmt(left)} left over` : ""}.`
				]
			};
		},
		generate(band, random) {
			if (band === 4) {
				const per = choose(random, [
					2,
					3,
					4,
					5,
					10
				]);
				return [withRemainder(random, per, 11, 49), per];
			}
			if (band === 5) {
				const per = int$2(random, 3, 9);
				return [withRemainder(random, per, 30, 99), per];
			}
			const per = int$2(random, 6, 12);
			return [withRemainder(random, per, 60, 199), per];
		}
	},
	"share-left": {
		topic: "division",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && whole(n[0], 0, 5e3) && whole(n[1], 1, 500),
		build([total, per]) {
			const bought = Math.floor(total / per);
			const answer = total - bought * per;
			return {
				text: `You have ${fmt(total)} training points. Each +1 costs ${fmt(per)} points. After buying as many as you can, how many points are left over?`,
				answer,
				working: [`First find how many you can buy: ${fmt(bought)} × ${fmt(per)} = ${fmt(bought * per)}.`, `Then what is left: ${fmt(total)} − ${fmt(bought * per)} = ${fmt(answer)}.`]
			};
		},
		generate: (band, random, tables) => KIND_DEFS["share-whole"].generate(band, random, tables)
	},
	"round-up": {
		topic: "division",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && whole(n[0], 1, 5e3) && whole(n[1], 1, 500),
		build([count, cap]) {
			const answer = ceil(count / cap);
			const exact = count % cap === 0;
			return {
				text: `You have ${fmt(count)} footmen. One barracks holds ${fmt(cap)}. How many barracks do you need?`,
				answer,
				working: [`${fmt(count)} ÷ ${fmt(cap)} = ${fmt(Math.floor(count / cap))}${exact ? "" : ` with ${fmt(count % cap)} left over`}.`, exact ? `It fits exactly, so ${fmt(answer)} barracks.` : `Those ${fmt(count % cap)} left over still need a roof, so round up to ${fmt(answer)} barracks.`]
			};
		},
		generate(band, random) {
			if (band === 4) {
				const cap = choose(random, [5, 10]);
				return [withRemainder(random, cap, 6, 49), cap];
			}
			if (band === 5) {
				const cap = choose(random, [
					5,
					10,
					20
				]);
				return [withRemainder(random, cap, 21, 149), cap];
			}
			const cap = choose(random, [
				5,
				10,
				20
			]);
			return [withRemainder(random, cap, 50, 399), cap];
		}
	},
	"troop-cost": {
		topic: "money",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 3 && allWhole(n, 0, 200) && n.some((x) => x > 0),
		build([footmen, axemen, knights]) {
			const lines = [
				...footmen ? [{
					name: footmen === 1 ? "footman" : "footmen",
					n: footmen,
					cost: TROOP_COST.footman
				}] : [],
				...axemen ? [{
					name: axemen === 1 ? "axeman" : "axemen",
					n: axemen,
					cost: TROOP_COST.axeman
				}] : [],
				...knights ? [{
					name: knights === 1 ? "knight" : "knights",
					n: knights,
					cost: TROOP_COST.knight
				}] : []
			];
			const answer = lines.reduce((t, l) => t + l.n * l.cost, 0);
			const list = lines.map((l) => `${fmt(l.n)} ${l.name}`);
			const joined = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0];
			const working = lines.map((l) => `${fmt(l.n)} × ${fmt(l.cost)} = ${fmt(l.n * l.cost)} gold for the ${l.name}.`);
			if (lines.length > 1) working.push(`Add them up: ${lines.map((l) => fmt(l.n * l.cost)).join(" + ")} = ${fmt(answer)}.`);
			return {
				text: `A footman costs ${TROOP_COST.footman} gold, an axeman ${TROOP_COST.axeman} and a knight ${TROOP_COST.knight}. How much do ${joined} cost?`,
				answer,
				unit: "gold",
				working
			};
		},
		generate(band, random) {
			if (band === 4) return [
				int$2(random, 2, 9),
				0,
				0
			];
			if (band === 5) return [
				int$2(random, 2, 12),
				int$2(random, 1, 6),
				0
			];
			return [
				int$2(random, 4, 20),
				int$2(random, 2, 10),
				int$2(random, 1, 6)
			];
		}
	},
	"budget-left": {
		topic: "money",
		bands: YEAR_BANDS,
		valid: (n) => n.length >= 3 && n.length <= 6 && (n[0] === 0 || n[0] === 1) && allWhole(n.slice(1), 1, 1e5) && n.slice(2).reduce((t, c) => t + c, 0) <= n[1],
		build([unit, total, ...spent]) {
			const sum = spent.reduce((t, c) => t + c, 0);
			const answer = total - sum;
			const money = unit === 0;
			const show = (x) => money ? `${fmt(x)} gold` : `${fmt(x)}%`;
			return {
				text: money ? `You have ${show(total)}. You spend ${spent.map(show).join(", then ")}. How much is left?` : `Your workers have ${show(total)} energy today. Your buildings use ${spent.map(show).join(", ")}. How much energy is left?`,
				answer,
				unit: money ? "gold" : "%",
				working: [`Add up what is used: ${spent.map(fmt).join(" + ")} = ${fmt(sum)}.`, `Take it from the total: ${fmt(total)} − ${fmt(sum)} = ${fmt(answer)}.`]
			};
		},
		generate(band, random) {
			if (band === 4) return [
				0,
				choose(random, [
					100,
					200,
					500,
					1e3
				]),
				stepped(random, 10, 90, 10)
			];
			if (band === 5) {
				const total = choose(random, [
					200,
					500,
					1e3
				]);
				return [
					0,
					total,
					stepped(random, 10, total * .4, 10),
					stepped(random, 10, total * .4, 10)
				];
			}
			if (random() < .5) return [
				1,
				100,
				int$2(random, 5, 35),
				int$2(random, 4, 25),
				int$2(random, 3, 20)
			];
			return [
				0,
				1e3,
				int$2(random, 100, 300),
				int$2(random, 100, 300),
				int$2(random, 100, 300)
			];
		}
	},
	ratio: {
		topic: "ratios",
		bands: YEAR_BANDS,
		valid: (n) => {
			if (n.length !== 4 || !allWhole(n, 0, 5e3) || n[1] < 1 || n[2] < 1 || n[3] < 1) return false;
			if (n[0] === 0) return n[3] % n[1] === 0;
			if (n[0] === 1) return n[1] !== n[2] && n[3] % (n[1] + n[2]) === 0;
			return false;
		},
		build([mode, a, b, n]) {
			if (mode === 0) {
				const lots = n / a;
				const answer = lots * b;
				return {
					text: `For every ${fmt(a)} ${a === 1 ? "axeman" : "axemen"} there ${b === 1 ? "is" : "are"} ${fmt(b)} ${b === 1 ? "footman" : "footmen"}. If you have ${fmt(n)} ${n === 1 ? "axeman" : "axemen"}, how many footmen do you have?`,
					answer,
					working: [`${fmt(n)} axemen is ${fmt(lots)} lots of ${fmt(a)}.`, `Each lot has ${fmt(b)} footmen: ${fmt(lots)} × ${fmt(b)} = ${fmt(answer)}.`]
				};
			}
			const parts = a + b;
			const one = n / parts;
			const answer = one * Math.max(a, b);
			return {
				text: `Two members share ${fmt(n)} gold in the ratio ${fmt(a)} : ${fmt(b)}. How much does the bigger share get?`,
				answer,
				unit: "gold",
				working: [`${fmt(a)} + ${fmt(b)} = ${fmt(parts)} parts altogether, so one part is ${fmt(n)} ÷ ${fmt(parts)} = ${fmt(one)}.`, `The bigger share is ${fmt(Math.max(a, b))} parts: ${fmt(Math.max(a, b))} × ${fmt(one)} = ${fmt(answer)}.`]
			};
		},
		generate(band, random) {
			if (band === 4) return [
				0,
				1,
				int$2(random, 2, 5),
				int$2(random, 2, 6)
			];
			if (band === 5) {
				const a = int$2(random, 2, 5);
				let b = int$2(random, 1, 9);
				if (b === a) b++;
				return [
					0,
					a,
					b,
					a * int$2(random, 2, 8)
				];
			}
			if (random() < .5) {
				const a = int$2(random, 1, 6);
				let b = int$2(random, 1, 7);
				if (b === a) b++;
				return [
					1,
					a,
					b,
					(a + b) * int$2(random, 3, 12)
				];
			}
			const a = int$2(random, 3, 8);
			let b = int$2(random, 2, 12);
			if (b === a) b++;
			return [
				0,
				a,
				b,
				a * int$2(random, 3, 12)
			];
		}
	},
	negative: {
		topic: "integers",
		bands: [6],
		valid: (n) => n.length === 2 && allWhole(n, -1e3, 1e3) && n[1] !== 0,
		build([start, change]) {
			const answer = start + change;
			const verb = change < 0 ? `loses ${fmt(-change)} points` : `wins ${fmt(change)} points`;
			return {
				text: `The clan's score is ${fmt(start)}. In the next duel it ${verb}. What is its score now?`,
				answer,
				working: change < 0 ? [`Losing points means taking away: ${fmt(start)} − ${fmt(-change)}.`, `${fmt(start)} − ${fmt(-change)} = ${fmt(answer)}.${answer < 0 ? " Below zero, so it is a negative number." : ""}`] : [`Winning points means adding: ${fmt(start)} + ${fmt(change)}.`, `${fmt(start)} + ${fmt(change)} = ${fmt(answer)}.`]
			};
		},
		generate(_band, random) {
			for (let tries = 0; tries < 200; tries++) {
				const start = int$2(random, -10, 10);
				const change = int$2(random, -15, 15);
				if (change !== 0 && Math.abs(start + change) <= 20 && (tries > 100 || start + change < 0 || start < 0)) return [start, change];
			}
			return [3, -8];
		}
	},
	"better-buy": {
		topic: "rates",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 4 && allWhole(n, 1, 5e3) && n[0] * n[3] !== n[2] * n[1],
		build([priceA, countA, priceB, countB], options) {
			const [nameA, nameB] = options.labels ?? ["Offer A", "Offer B"];
			const noun = SUPPLIES[variant([
				priceA,
				countA,
				priceB,
				countB
			], SUPPLIES.length)];
			const answer = priceA * countB < priceB * countA ? 1 : 2;
			const rateA = priceA / countA;
			const rateB = priceB / countB;
			const each = (x) => isWhole(x) ? fmt(x) : `about ${fmt(Math.round(x * 10) / 10)}`;
			return {
				text: `${nameA}: ${fmt(countA)} ${noun} for ${fmt(priceA)} gold. ${nameB}: ${fmt(countB)} ${noun} for ${fmt(priceB)} gold. Which is cheaper for each one?`,
				answer,
				choices: [{
					value: 1,
					label: nameA
				}, {
					value: 2,
					label: nameB
				}],
				working: [
					`Find the price of one: divide the gold by the number.`,
					`${nameA}: ${fmt(priceA)} ÷ ${fmt(countA)} = ${each(rateA)} gold each. ${nameB}: ${fmt(priceB)} ÷ ${fmt(countB)} = ${each(rateB)} gold each.`,
					`${answer === 1 ? nameA : nameB} is cheaper for each one.`
				]
			};
		},
		generate(band, random) {
			if (band === 4) {
				for (let tries = 0; tries < 200; tries++) {
					const rateA = int$2(random, 5, 30);
					const rateB = int$2(random, 5, 30);
					const countA = int$2(random, 2, 6);
					const countB = int$2(random, 2, 6);
					if (Math.abs(rateA - rateB) >= 2 && countA !== countB) return [
						rateA * countA,
						countA,
						rateB * countB,
						countB
					];
				}
				return [
					60,
					3,
					50,
					5
				];
			}
			if (band === 5) {
				for (let tries = 0; tries < 200; tries++) {
					const rateA = int$2(random, 10, 60);
					const rateB = int$2(random, 10, 60);
					const countA = int$2(random, 2, 10);
					const countB = int$2(random, 2, 10);
					if (Math.abs(rateA - rateB) >= 3 && countA !== countB) return [
						rateA * countA,
						countA,
						rateB * countB,
						countB
					];
				}
				return [
					120,
					4,
					150,
					6
				];
			}
			for (let tries = 0; tries < 500; tries++) {
				const countA = int$2(random, 3, 12);
				const countB = int$2(random, 3, 12);
				const priceA = stepped(random, 50, 800, 10);
				const priceB = stepped(random, 50, 800, 10);
				const rateA = priceA / countA;
				const rateB = priceB / countB;
				if (countA !== countB && Math.abs(rateA - rateB) / Math.min(rateA, rateB) >= .08 && Math.abs(rateA - rateB) / Math.min(rateA, rateB) <= .6) return [
					priceA,
					countA,
					priceB,
					countB
				];
			}
			return [
				500,
				7,
				750,
				8
			];
		}
	},
	"church-bill": {
		topic: "money",
		bands: YEAR_BANDS,
		valid: (n) => n.length >= 2 && n.length <= 8 && whole(n[0], 1, 1e3) && allWhole(n.slice(1), 1, 100),
		build([per, ...levels]) {
			const bills = levels.map((l) => (l + 1) * per);
			const answer = bills.reduce((t, b) => t + b, 0);
			const who = levels.length === 1 ? `1 member (level ${levels[0]})` : new Set(levels).size === 1 ? `${levels.length} members (all level ${levels[0]})` : `${levels.length} members (levels ${levels.slice(0, -1).join(", ")} and ${levels[levels.length - 1]})`;
			return {
				text: `The Church wakes a member for (level + 1) × ${fmt(per)} gold. You need to wake ${who}. What is the bill?`,
				answer,
				unit: "gold",
				working: [`Each member costs (level + 1) × ${fmt(per)}: ${levels.map((l, i) => `(${l} + 1) × ${fmt(per)} = ${fmt(bills[i])}`).join("; ")}.`, bills.length > 1 ? `Add them up: ${bills.map(fmt).join(" + ")} = ${fmt(answer)}.` : `The bill is ${fmt(answer)}.`]
			};
		},
		generate(band, random) {
			if (band === 4) {
				const level = int$2(random, 1, 9);
				return [10, ...Array.from({ length: int$2(random, 2, 3) }, () => level)];
			}
			if (band === 5) return [10, ...Array.from({ length: int$2(random, 2, 3) }, () => int$2(random, 2, 12))];
			return [10, ...Array.from({ length: int$2(random, 3, 4) }, () => int$2(random, 3, 18))];
		}
	},
	times: {
		topic: "times",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && allWhole(n, 0, 12),
		build([a, b]) {
			const answer = a * b;
			return {
				text: `${a} × ${b} = ?`,
				answer,
				working: [`${a} × ${b} = ${answer}.`]
			};
		},
		generate(band, random, tables) {
			return [choose(random, tables.length ? tables : [
				2,
				5,
				10
			]), int$2(random, 2, band === 4 ? 10 : 12)];
		}
	}
};
/** Gold each kind of troop costs (the rule sheet's table; footmen 15, axemen 30, knights 60). */
const TROOP_COST = {
	footman: 15,
	axeman: 30,
	knight: 60
};
/** The kinds that can be asked at a year band, optionally only from these topics. */
function kindsFor(band, topics = TOPICS) {
	return KINDS.filter((k) => KIND_DEFS[k].bands.includes(band) && topics.includes(KIND_DEFS[k].topic));
}
const isKind = (x) => typeof x === "string" && KINDS.includes(x);
/** True if these numbers make a sensible question of this kind. */
function isValidSpec(spec) {
	const def = isKind(spec.kind) ? KIND_DEFS[spec.kind] : void 0;
	return !!def && Array.isArray(spec.nums) && spec.nums.every((n) => typeof n === "number" && Number.isFinite(n)) && def.valid(spec.nums);
}
/** Make the question from its kind and numbers. Throws if the numbers don't make sense. */
function buildQuestion(kind, nums, options = {}) {
	if (!isValidSpec({
		kind,
		nums
	})) throw new Error(`Bad numbers for a "${kind}" question: ${JSON.stringify(nums)}`);
	const def = KIND_DEFS[kind];
	return {
		kind,
		nums: [...nums],
		topic: def.topic,
		...def.build(nums, options)
	};
}
/** Pick the numbers for a question of one kind at a year band. */
function generateSpec(kind, band, random, tables = []) {
	const def = KIND_DEFS[kind];
	if (!def.bands.includes(band)) throw new Error(`"${kind}" questions are not asked at Year ${band}`);
	return {
		kind,
		nums: def.generate(band, random, tables)
	};
}
/** A whole question at a band: pick the numbers, then build it. */
function generateQuestion(kind, band, random, tables = []) {
	const spec = generateSpec(kind, band, random, tables);
	return buildQuestion(spec.kind, spec.nums);
}
/** Check a typed or tapped answer. A missing answer ("No thanks") counts as not right. */
function markAnswer(q, given) {
	return typeof given === "number" && Number.isFinite(given) && given === q.answer;
}
const DEFAULT_PRACTICAL_SETTINGS = {
	enabledTopics: TOPICS.filter((t) => t !== "integers" && t !== "times"),
	yearBand: 5,
	enabledTables: [
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10
	]
};
/** Settings from anything saved (or nothing): unknown topics, bad bands and bad tables fall back to the defaults. */
function readPracticalSettings(raw) {
	const obj = raw && typeof raw === "object" ? raw : {};
	const topics = Array.isArray(obj.enabledTopics) ? TOPICS.filter((t) => obj.enabledTopics.includes(t)) : DEFAULT_PRACTICAL_SETTINGS.enabledTopics;
	const band = YEAR_BANDS.find((b) => b === obj.yearBand) ?? DEFAULT_PRACTICAL_SETTINGS.yearBand;
	const tables = Array.isArray(obj.enabledTables) ? [...new Set(obj.enabledTables.filter((t) => typeof t === "number" && Number.isInteger(t) && t >= 1 && t <= 12))].sort((a, b) => a - b) : DEFAULT_PRACTICAL_SETTINGS.enabledTables;
	return {
		enabledTopics: [...topics],
		yearBand: band,
		enabledTables: tables.length ? tables : [...DEFAULT_PRACTICAL_SETTINGS.enabledTables]
	};
}
/** Is a topic being asked at this year band? (Switched on, and has a kind for the band.) */
const topicAvailable = (settings, topic) => settings.enabledTopics.includes(topic) && kindsFor(settings.yearBand, [topic]).length > 0;
/** Pick a kind: first a switched-on topic, then one of its kinds, so each topic is asked about equally. Null if nothing is on. */
function pickKind(settings, random) {
	const topics = TOPICS.filter((t) => topicAvailable(settings, t));
	if (topics.length === 0) return null;
	const topic = choose(random, topics);
	return choose(random, kindsFor(settings.yearBand, [topic]));
}
/** A random question of the teacher's topics and year band, or null if all topics are off. */
function pickQuestion(settings, random) {
	const kind = pickKind(settings, random);
	return kind ? generateQuestion(kind, settings.yearBand, random, settings.enabledTables) : null;
}
//#endregion
//#region shared/clans/config.ts
/** Every tuning number for Clan Quest in one place, so the game can be balanced without hunting through code. */
const CONFIG = {
	maxLevel: 20,
	statCap: 60,
	pointsPerLevel: 12,
	minMembers: 4,
	maxMembers: 6,
	startGold: 200,
	fightsPerDay: 8,
	maxRounds: 8,
	/** Percent added to shop prices (a fixed village tax; the class lowers it by building). */
	shopTax: 10,
	/** Percent of a price it costs to look at an item's real stats. */
	examinePercent: 25,
	/** Church: gold to wake someone is (level + 1) times this. */
	churchPerLevel: 10,
	/** The first this-many wake-ups each day cost nothing. */
	freeWakesPerDay: 1,
	/** Training points to raise a stat by 1; each Training Hall level makes it 1 cheaper (never below 1). */
	trainCost: {
		agility: 3,
		dexterity: 3,
		strength: 3,
		wisdom: 3,
		armor: 5,
		charisma: 6
	},
	/** Points for one HP purchase and one SP purchase, and what each gives. */
	hpBuy: {
		cost: 2,
		amount: 4
	},
	spBuy: {
		cost: 2,
		amount: 3
	},
	/** After each fight survivors get back this share of their missing HP and SP. */
	betweenFightHeal: .5,
	/** Mines deeper than `xpBoostFrom` give more experience per hit: multiplied by 1 + (depth - xpBoostFrom) times `xpDepthBoost`. */
	xpBoostFrom: 8,
	xpDepthBoost: .25,
	/** Experience: 30 to reach level 2, then 10 more for each level, but never more than this for one level. */
	xpLevelCap: 90,
	/** Experience: total needed to reach `level` (level 1 needs none). */
	xpToReach(level) {
		let total = 0;
		for (let l = 1; l < level; l++) total += Math.min(CONFIG.xpLevelCap, 30 + 10 * (l - 1));
		return total;
	},
	/** Mine depth hints, as depth minus the clan's average level (from the simulator: 100% wins up to -1, 99% to +1, about 90% to +3, under 80% from +4). */
	depthHint: {
		easyUpTo: -1,
		justRightUpTo: 1,
		toughUpTo: 3
	},
	/** The empire (stage C.4). Every number is in the rule sheet's section 12. */
	empire: {
		/** Wild land plots a new empire starts with. */
		startWild: 10,
		/** Claiming one more plot of wild land costs `base` gold plus `step` for each one claimed before it, up to `max` claims. */
		claim: {
			base: 50,
			step: 25,
			max: 24
		},
		/** A plot is between this many and this many squares along each side. */
		plotSide: {
			min: 2,
			max: 6
		},
		/** Gold to develop a plot: this much a square of area, plus this much for each unit of fence round it. */
		landPerSquare: 2,
		fencePerUnit: 1,
		/** Worker energy a day, in percent. */
		energyPerDay: 100,
		/** Gold for one troop (the same numbers the troop-cost question uses). */
		troopCost: TROOP_COST,
		/** How many of each troop one barracks holds. */
		troopCap: {
			footman: 20,
			axeman: 10,
			knight: 5
		},
		/** How much each troop counts for in a battle (a knight is worth four footmen, like its price). */
		troopMight: {
			footman: 1,
			axeman: 2,
			knight: 4
		},
		/** The most followers a village will send, as a percent. */
		draftMax: 20,
		draftStep: 5,
		/** Size in squares, worker energy in percent, gold, and how many you can have. `per` is the effect of each one, in percent (or points). */
		buildings: {
			barracks: {
				size: 15,
				energy: 30,
				gold: 100,
				max: 12,
				per: 0
			},
			walls: {
				size: 6,
				energy: 7,
				gold: 40,
				max: 5,
				per: 10
			},
			tower: {
				size: 5,
				energy: 12,
				gold: 60,
				max: 5,
				per: 10
			},
			steelMill: {
				size: 12,
				energy: 25,
				gold: 120,
				max: 3,
				per: 10
			},
			stables: {
				size: 10,
				energy: 20,
				gold: 100,
				max: 3,
				per: 20
			},
			gymnasium: {
				size: 10,
				energy: 20,
				gold: 100,
				max: 2,
				per: 5
			},
			developersHall: {
				size: 15,
				energy: 35,
				gold: 150,
				max: 3,
				per: 10
			}
		},
		battle: {
			maxRounds: 5,
			/** A side loses about this share of its strength each round. */
			roundDamage: .25,
			/** `hit` scales the damage you do, `takes` the damage you suffer. */
			push: {
				careful: {
					hit: .6,
					takes: .6
				},
				steady: {
					hit: 1,
					takes: 1
				},
				bold: {
					hit: 1.5,
					takes: 1.5
				}
			},
			/** Each round's luck: a side does between `min`% and `min + span - 1`% of its usual damage. */
			luck: {
				min: 60,
				span: 80
			},
			/** The defenders give way if they end the battle down to this share of where they began (and worse off than the attackers). */
			retreatAt: .5,
			/** Of the troops who were hurt, this share do not come home. */
			lossShare: .25,
			lootChoices: [
				5,
				10,
				15,
				20
			]
		},
		raids: {
			newClanDays: 3,
			/** Raids on classmates a day, and on computer kingdoms a day. */
			perDay: 1,
			kingdomPerDay: 1,
			shieldDays: 1,
			/** A classmate must have between 1/this and this times your strength. */
			fairRatio: 2,
			/** Most you may take from a classmate, in percent. */
			classmateLootMax: 10
		}
	},
	/** Quests (stage C.4 part C): one a day, small rewards next to the Mines (a fight earns about 50 gold and 4-13 followers). */
	quests: {
		perDay: 1,
		/** The best charisma in the clan has to reach `open` for a charm choice, `high` for a very charming one. */
		charm: {
			open: 8,
			high: 11
		},
		/** What "small", "medium" and "big" mean in a quest. Points go to every member. */
		reward: {
			gold: {
				small: 15,
				medium: 30,
				big: 50
			},
			followers: {
				small: 3,
				medium: 7,
				big: 12
			},
			points: {
				small: 1,
				medium: 2,
				big: 3
			}
		},
		/** A found item is never worth more than this in the shop; if nobody can use it, the clan gets half its price in gold. */
		itemMaxPrice: 70
	},
	/**
	* The class village (stage C.6 part A). The class builds these with the village chest; building to level n costs
	* `base` times n gold. Training Hall and Smithy already work in the rules; each Church level gives one more free wake-up a day.
	* The same costs are in the SQL function clan_village_cost (a test keeps them equal). `order` breaks a tie in the vote.
	*/
	village: {
		trainingHall: {
			max: 5,
			base: 300
		},
		smithy: {
			max: 6,
			base: 250
		},
		church: {
			max: 3,
			base: 400
		},
		order: [
			"trainingHall",
			"smithy",
			"church"
		],
		/** The most gold anyone can give the chest in one go. */
		giveMax: 1e5
	},
	/**
	* Fame and points (stage C.6 part B). Fame is earned, never lost, and never comes from maths scores. Points sit inside the hub's
	* 40-a-day cap; raids earn fame but no points. `minesPerPoint`: every 3rd mine fight won is a point (a boss is worth `boss`
	* and does not count toward the 3). The village rewards go to everyone who voted in the week the class built a building.
	* The same numbers are in the SQL function clan_reward_rules (a test keeps them equal).
	*/
	rewards: {
		fame: {
			mineWin: 1,
			bossWin: 5,
			warWin: 2,
			kingdomRaidWin: 2,
			classRaidWin: 3,
			villageBuilt: 10
		},
		points: {
			minesPerPoint: 3,
			boss: 3,
			war: 2,
			villageBuilt: 5
		},
		/** Mine fights a day a teacher may choose (the default is `fightsPerDay`). */
		fightsPerDayRange: {
			min: 1,
			max: 30
		}
	},
	/** How much a Battle Cry answer adds. */
	battleCryDamage: 1.25,
	battleCryHeal: .2
};
//#endregion
//#region shared/clans/gamedata.ts
const RACES = [
	{
		"name": "Human",
		"stats": {
			"agility": 5,
			"dexterity": 5,
			"strength": 5,
			"wisdom": 4,
			"armor": 0,
			"charisma": 4
		},
		"hp": 12,
		"sp": 4,
		"spells": []
	},
	{
		"name": "Dwarf",
		"stats": {
			"agility": 4,
			"dexterity": 5,
			"strength": 8,
			"wisdom": 3,
			"armor": 2,
			"charisma": 3
		},
		"hp": 17,
		"sp": 3,
		"spells": []
	},
	{
		"name": "Elf",
		"stats": {
			"agility": 7,
			"dexterity": 8,
			"strength": 4,
			"wisdom": 7,
			"armor": 0,
			"charisma": 5
		},
		"hp": 16,
		"sp": 6,
		"spells": []
	},
	{
		"name": "Half-Elf",
		"stats": {
			"agility": 6,
			"dexterity": 7,
			"strength": 5,
			"wisdom": 6,
			"armor": 0,
			"charisma": 4
		},
		"hp": 14,
		"sp": 4,
		"spells": []
	},
	{
		"name": "Halfling",
		"stats": {
			"agility": 8,
			"dexterity": 7,
			"strength": 3,
			"wisdom": 4,
			"armor": 0,
			"charisma": 3
		},
		"hp": 15,
		"sp": 8,
		"spells": []
	},
	{
		"name": "Orc",
		"stats": {
			"agility": 4,
			"dexterity": 3,
			"strength": 8,
			"wisdom": 2,
			"armor": 2,
			"charisma": 0
		},
		"hp": 14,
		"sp": 3,
		"spells": []
	},
	{
		"name": "Muya",
		"stats": {
			"agility": 6,
			"dexterity": 5,
			"strength": 4,
			"wisdom": 7,
			"armor": 0,
			"charisma": 6
		},
		"hp": 8,
		"sp": 7,
		"spells": []
	},
	{
		"name": "Minotaur",
		"stats": {
			"agility": 2,
			"dexterity": 2,
			"strength": 9,
			"wisdom": 0,
			"armor": 3,
			"charisma": 0
		},
		"hp": 15,
		"sp": 0,
		"spells": []
	},
	{
		"name": "Imp",
		"stats": {
			"agility": 5,
			"dexterity": 8,
			"strength": 5,
			"wisdom": 4,
			"armor": 1,
			"charisma": 0
		},
		"hp": 12,
		"sp": 5,
		"spells": [19, 18]
	}
];
const CLASSES = [
	{
		"name": "Barbarian",
		"stats": {
			"agility": 2,
			"dexterity": 2,
			"strength": 5,
			"wisdom": -1,
			"armor": 1,
			"charisma": -1
		},
		"hp": 10,
		"sp": -3,
		"spells": []
	},
	{
		"name": "Warrior",
		"stats": {
			"agility": 4,
			"dexterity": 3,
			"strength": 3,
			"wisdom": 1,
			"armor": 0,
			"charisma": 0
		},
		"hp": 8,
		"sp": 6,
		"spells": [
			20,
			11,
			18
		]
	},
	{
		"name": "Martial Artist",
		"stats": {
			"agility": 6,
			"dexterity": 5,
			"strength": 1,
			"wisdom": 1,
			"armor": 0,
			"charisma": 2
		},
		"hp": 12,
		"sp": 7,
		"spells": [
			8,
			9,
			10,
			21
		]
	},
	{
		"name": "Knight",
		"stats": {
			"agility": 4,
			"dexterity": 3,
			"strength": 4,
			"wisdom": 2,
			"armor": 1,
			"charisma": 4
		},
		"hp": 13,
		"sp": 6,
		"spells": [14, 22]
	},
	{
		"name": "Assassin",
		"stats": {
			"agility": 4,
			"dexterity": 6,
			"strength": 1,
			"wisdom": 2,
			"armor": 0,
			"charisma": 1
		},
		"hp": 8,
		"sp": 9,
		"spells": [
			16,
			5,
			23
		]
	},
	{
		"name": "Healer",
		"stats": {
			"agility": 3,
			"dexterity": 2,
			"strength": 0,
			"wisdom": 3,
			"armor": 0,
			"charisma": 2
		},
		"hp": 7,
		"sp": 12,
		"spells": [
			1,
			2,
			4
		]
	},
	{
		"name": "Sorcerer",
		"stats": {
			"agility": 2,
			"dexterity": 0,
			"strength": -1,
			"wisdom": 4,
			"armor": 0,
			"charisma": 0
		},
		"hp": 10,
		"sp": 9,
		"spells": [
			8,
			12,
			13,
			25
		]
	},
	{
		"name": "Necromancer",
		"stats": {
			"agility": 2,
			"dexterity": 1,
			"strength": -1,
			"wisdom": 5,
			"armor": 0,
			"charisma": 0
		},
		"hp": 11,
		"sp": 10,
		"spells": [
			8,
			6,
			7,
			19
		]
	},
	{
		"name": "Wizard",
		"stats": {
			"agility": 2,
			"dexterity": -1,
			"strength": -1,
			"wisdom": 5,
			"armor": 0,
			"charisma": 1
		},
		"hp": 7,
		"sp": 13,
		"spells": [
			13,
			15,
			8,
			2,
			4,
			7
		]
	},
	{
		"name": "Pirate",
		"stats": {
			"agility": 7,
			"dexterity": 3,
			"strength": 2,
			"wisdom": 1,
			"armor": 0,
			"charisma": 4
		},
		"hp": 5,
		"sp": 0,
		"spells": []
	},
	{
		"name": "Samurai",
		"stats": {
			"agility": 5,
			"dexterity": 4,
			"strength": 2,
			"wisdom": 1,
			"armor": 1,
			"charisma": 2
		},
		"hp": 10,
		"sp": 5,
		"spells": [8, 9]
	}
];
const ITEMS = [
	{
		"name": "Shortsword",
		"kind": "weapon",
		"price": 65,
		"bonus": {
			"strength": 5,
			"agility": -1
		},
		"needs": {
			"strength": 6,
			"agility": 4,
			"dexterity": 6
		},
		"shopLevel": 6
	},
	{
		"name": "Broadsword",
		"kind": "weapon",
		"price": 75,
		"bonus": {
			"strength": 6,
			"agility": -2,
			"dexterity": 1,
			"charisma": 1
		},
		"needs": {
			"strength": 10,
			"dexterity": 6
		},
		"shopLevel": 6
	},
	{
		"name": "Axe",
		"kind": "weapon",
		"price": 50,
		"bonus": {
			"strength": 7,
			"dexterity": -1,
			"agility": -2,
			"charisma": 1
		},
		"needs": { "strength": 13 },
		"shopLevel": 6
	},
	{
		"name": "Mace",
		"kind": "weapon",
		"price": 45,
		"bonus": {
			"strength": 4,
			"dexterity": 1
		},
		"needs": {
			"strength": 4,
			"agility": 3,
			"dexterity": 5
		},
		"shopLevel": 6
	},
	{
		"name": "Dagger",
		"kind": "weapon",
		"price": 20,
		"bonus": {
			"strength": 3,
			"dexterity": 1
		},
		"needs": { "dexterity": 3 },
		"shopLevel": 6
	},
	{
		"name": "Staff",
		"kind": "weapon",
		"price": 13,
		"bonus": {
			"strength": 5,
			"agility": -1,
			"dexterity": 1
		},
		"needs": {
			"agility": 6,
			"dexterity": 9
		},
		"shopLevel": 6
	},
	{
		"name": "Wand",
		"kind": "weapon",
		"price": 25,
		"bonus": {
			"strength": 1,
			"dexterity": 1,
			"wisdom": 4
		},
		"needs": { "wisdom": 11 },
		"shopLevel": 6
	},
	{
		"name": "Battle Axe",
		"kind": "weapon",
		"price": 75,
		"bonus": {
			"strength": 8,
			"agility": -1,
			"dexterity": -3,
			"charisma": 1
		},
		"needs": { "strength": 13 },
		"shopLevel": 5
	},
	{
		"name": "Morning Star",
		"kind": "weapon",
		"price": 80,
		"bonus": {
			"strength": 5,
			"dexterity": 2
		},
		"needs": {
			"strength": 6,
			"agility": 8,
			"dexterity": 7
		},
		"shopLevel": 4
	},
	{
		"name": "Scythe",
		"kind": "weapon",
		"price": 65,
		"bonus": {
			"strength": 3,
			"dexterity": 3
		},
		"needs": {
			"strength": 2,
			"agility": 4,
			"dexterity": 3
		},
		"shopLevel": 3
	},
	{
		"name": "Boomerang",
		"kind": "weapon",
		"price": 110,
		"bonus": {
			"strength": 5,
			"dexterity": 4
		},
		"needs": {
			"strength": 2,
			"agility": 6,
			"dexterity": 7
		},
		"shopLevel": 2
	},
	{
		"name": "Falcon's Sword",
		"kind": "weapon",
		"price": 250,
		"bonus": {
			"strength": 8,
			"agility": -3,
			"dexterity": 1,
			"charisma": 3
		},
		"needs": {
			"strength": 12,
			"dexterity": 10
		},
		"shopLevel": 1
	},
	{
		"name": "Sky Sword",
		"kind": "weapon",
		"price": 500,
		"bonus": {
			"strength": 22,
			"dexterity": 2,
			"charisma": 5
		},
		"needs": {
			"strength": 10,
			"dexterity": 6
		},
		"shopLevel": 0
	},
	{
		"name": "Knobbly Club",
		"kind": "weapon",
		"price": 10,
		"bonus": {
			"strength": 6,
			"agility": -1,
			"dexterity": -1
		},
		"needs": {
			"agility": 7,
			"dexterity": 9,
			"strength": 8
		},
		"shopLevel": 2
	},
	{
		"name": "Thunder Axe",
		"kind": "weapon",
		"price": 150,
		"bonus": {
			"strength": 8,
			"agility": -3,
			"dexterity": -1
		},
		"needs": {
			"agility": 8,
			"dexterity": 8,
			"strength": 13
		},
		"shopLevel": 1
	},
	{
		"name": "Moon Blade",
		"kind": "weapon",
		"price": 200,
		"bonus": {
			"strength": 8,
			"agility": -1,
			"dexterity": -1
		},
		"needs": {
			"agility": 11,
			"dexterity": 5,
			"strength": 10
		},
		"shopLevel": 1
	},
	{
		"name": "Wizard's Staff",
		"kind": "weapon",
		"price": 100,
		"bonus": {
			"strength": 2,
			"wisdom": 6,
			"dexterity": 2,
			"agility": 1
		},
		"needs": { "wisdom": 11 },
		"shopLevel": 6
	},
	{
		"name": "Cloth Robe",
		"kind": "armor",
		"price": 11,
		"bonus": { "armor": 1 },
		"needs": {},
		"shopLevel": 6
	},
	{
		"name": "Leather Armor",
		"kind": "armor",
		"price": 25,
		"bonus": {
			"armor": 2,
			"agility": -1,
			"dexterity": -1
		},
		"needs": {
			"strength": 9,
			"dexterity": 7
		},
		"shopLevel": 6
	},
	{
		"name": "Chainmail Armor",
		"kind": "armor",
		"price": 40,
		"bonus": {
			"armor": 3,
			"agility": -2,
			"dexterity": -1
		},
		"needs": {
			"strength": 12,
			"dexterity": 8
		},
		"shopLevel": 6
	},
	{
		"name": "Platemail Armor",
		"kind": "armor",
		"price": 55,
		"bonus": {
			"armor": 4,
			"agility": -3,
			"dexterity": -2,
			"charisma": 1
		},
		"needs": {
			"strength": 14,
			"dexterity": 9
		},
		"shopLevel": 6
	},
	{
		"name": "Wooden Armor",
		"kind": "armor",
		"price": 25,
		"bonus": {
			"armor": 3,
			"agility": -1,
			"dexterity": -1
		},
		"needs": {
			"strength": 9,
			"dexterity": 6
		},
		"shopLevel": 6
	},
	{
		"name": "Cloth Tunic",
		"kind": "armor",
		"price": 25,
		"bonus": { "armor": 2 },
		"needs": { "dexterity": 5 },
		"shopLevel": 5
	},
	{
		"name": "Kai Tunic",
		"kind": "armor",
		"price": 75,
		"bonus": { "armor": 3 },
		"needs": {
			"agility": 9,
			"dexterity": 8
		},
		"shopLevel": 3
	},
	{
		"name": "Hero's Armor",
		"kind": "armor",
		"price": 225,
		"bonus": {
			"armor": 4,
			"agility": -2,
			"dexterity": -1,
			"charisma": 2
		},
		"needs": {
			"strength": 12,
			"dexterity": 10
		},
		"shopLevel": 2
	},
	{
		"name": "Rags",
		"kind": "armor",
		"price": 5,
		"bonus": { "armor": 1 },
		"needs": {},
		"shopLevel": 5
	},
	{
		"name": "Wooden Shield",
		"kind": "shield",
		"price": 15,
		"bonus": { "armor": 1 },
		"needs": { "strength": 10 },
		"shopLevel": 6
	},
	{
		"name": "Iron Shield",
		"kind": "shield",
		"price": 25,
		"bonus": {
			"armor": 2,
			"dexterity": -1
		},
		"needs": { "strength": 13 },
		"shopLevel": 6
	},
	{
		"name": "Platinum Shield",
		"kind": "shield",
		"price": 45,
		"bonus": {
			"charisma": 1,
			"armor": 2
		},
		"needs": { "strength": 11 },
		"shopLevel": 6
	},
	{
		"name": "Crystal Shield",
		"kind": "shield",
		"price": 65,
		"bonus": {
			"charisma": 3,
			"armor": 3
		},
		"needs": {
			"strength": 12,
			"agility": 8
		},
		"shopLevel": 5
	},
	{
		"name": "Hero's Shield",
		"kind": "shield",
		"price": 250,
		"bonus": {
			"charisma": 5,
			"armor": 4
		},
		"needs": {
			"strength": 13,
			"agility": 10
		},
		"shopLevel": 2
	},
	{
		"name": "Silver Mace",
		"kind": "weapon",
		"price": 65,
		"bonus": {
			"strength": 6,
			"dexterity": 1
		},
		"needs": {
			"strength": 3,
			"agility": 3,
			"dexterity": 5
		},
		"shopLevel": 3
	},
	{
		"name": "Lion's Shield",
		"kind": "shield",
		"price": 70,
		"bonus": { "armor": 2 },
		"needs": { "strength": 7 },
		"shopLevel": 2
	},
	{
		"name": "Great Axe",
		"kind": "weapon",
		"price": 50,
		"bonus": {
			"strength": 9,
			"dexterity": -1,
			"agility": -2,
			"charisma": 1
		},
		"needs": { "strength": 15 },
		"shopLevel": 2
	}
];
const MONSTERS = [
	{
		"name": "Scruffy Dog",
		"zone": "Meadow",
		"mine": 0,
		"boss": false,
		"difficulty": 1,
		"hp": 7,
		"sp": 0,
		"stats": {
			"agility": 5,
			"dexterity": 8,
			"strength": 11,
			"wisdom": 1,
			"armor": 0,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Giant Rat",
		"zone": "Meadow",
		"mine": 0,
		"boss": false,
		"difficulty": 1,
		"hp": 14,
		"sp": 0,
		"stats": {
			"agility": 8,
			"dexterity": 9,
			"strength": 8,
			"wisdom": 1,
			"armor": 0,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Hedge Witch",
		"zone": "Meadow",
		"mine": 1,
		"boss": false,
		"difficulty": 1,
		"hp": 13,
		"sp": 10,
		"stats": {
			"agility": 8,
			"dexterity": 5,
			"strength": 8,
			"wisdom": 10,
			"armor": 0,
			"charisma": 0
		},
		"spells": [10]
	},
	{
		"name": "Rock Pal",
		"zone": "Meadow",
		"mine": 1,
		"boss": false,
		"difficulty": 1,
		"hp": 12,
		"sp": 0,
		"stats": {
			"agility": 10,
			"dexterity": 9,
			"strength": 12,
			"wisdom": 3,
			"armor": 0,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Goblin",
		"zone": "Meadow",
		"mine": 2,
		"boss": false,
		"difficulty": 2,
		"hp": 16,
		"sp": 0,
		"stats": {
			"agility": 7,
			"dexterity": 9,
			"strength": 10,
			"wisdom": 4,
			"armor": 1,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Grumpy Orc",
		"zone": "Meadow",
		"mine": 2,
		"boss": false,
		"difficulty": 2,
		"hp": 19,
		"sp": 0,
		"stats": {
			"agility": 8,
			"dexterity": 7,
			"strength": 10,
			"wisdom": 3,
			"armor": 0,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Moon Wolf",
		"zone": "Meadow",
		"mine": 3,
		"boss": false,
		"difficulty": 3,
		"hp": 18,
		"sp": 0,
		"stats": {
			"agility": 10,
			"dexterity": 9,
			"strength": 12,
			"wisdom": 2,
			"armor": 0,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Marsh Snake",
		"zone": "Meadow",
		"mine": 3,
		"boss": false,
		"difficulty": 3,
		"hp": 20,
		"sp": 0,
		"stats": {
			"agility": 10,
			"dexterity": 8,
			"strength": 14,
			"wisdom": 3,
			"armor": 1,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Giant Spider",
		"zone": "Caves",
		"mine": 4,
		"boss": false,
		"difficulty": 4,
		"hp": 22,
		"sp": 0,
		"stats": {
			"agility": 11,
			"dexterity": 9,
			"strength": 14,
			"wisdom": 2,
			"armor": 1,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Hobgoblin",
		"zone": "Caves",
		"mine": 4,
		"boss": false,
		"difficulty": 4,
		"hp": 25,
		"sp": 0,
		"stats": {
			"agility": 11,
			"dexterity": 10,
			"strength": 13,
			"wisdom": 3,
			"armor": 1,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Skeleton",
		"zone": "Caves",
		"mine": 5,
		"boss": false,
		"difficulty": 5,
		"hp": 27,
		"sp": 0,
		"stats": {
			"agility": 12,
			"dexterity": 10,
			"strength": 18,
			"wisdom": 4,
			"armor": 3,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Lizard Warrior",
		"zone": "Caves",
		"mine": 5,
		"boss": false,
		"difficulty": 5,
		"hp": 25,
		"sp": 0,
		"stats": {
			"agility": 13,
			"dexterity": 11,
			"strength": 17,
			"wisdom": 3,
			"armor": 2,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Cave Minotaur",
		"zone": "Caves",
		"mine": 6,
		"boss": false,
		"difficulty": 6,
		"hp": 28,
		"sp": 0,
		"stats": {
			"agility": 15,
			"dexterity": 10,
			"strength": 19,
			"wisdom": 4,
			"armor": 5,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Green Slime",
		"zone": "Caves",
		"mine": 6,
		"boss": false,
		"difficulty": 6,
		"hp": 27,
		"sp": 0,
		"stats": {
			"agility": 13,
			"dexterity": 9,
			"strength": 19,
			"wisdom": 4,
			"armor": 3,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Dusk Mage",
		"zone": "Caves",
		"mine": 7,
		"boss": false,
		"difficulty": 6,
		"hp": 24,
		"sp": 10,
		"stats": {
			"agility": 13,
			"dexterity": 10,
			"strength": 21,
			"wisdom": 10,
			"armor": 2,
			"charisma": 0
		},
		"spells": [
			8,
			13,
			14
		]
	},
	{
		"name": "Wyvern",
		"zone": "Caves",
		"mine": 7,
		"boss": false,
		"difficulty": 7,
		"hp": 26,
		"sp": 0,
		"stats": {
			"agility": 16,
			"dexterity": 10,
			"strength": 21,
			"wisdom": 4,
			"armor": 4,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Gargoyle",
		"zone": "Swamp",
		"mine": 8,
		"boss": false,
		"difficulty": 8,
		"hp": 32,
		"sp": 0,
		"stats": {
			"agility": 14,
			"dexterity": 11,
			"strength": 21,
			"wisdom": 4,
			"armor": 6,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Baby Dragon",
		"zone": "Swamp",
		"mine": 8,
		"boss": false,
		"difficulty": 8,
		"hp": 30,
		"sp": 15,
		"stats": {
			"agility": 11,
			"dexterity": 10,
			"strength": 23,
			"wisdom": 4,
			"armor": 5,
			"charisma": 0
		},
		"spells": [24]
	},
	{
		"name": "Swamp Ogre",
		"zone": "Swamp",
		"mine": 9,
		"boss": false,
		"difficulty": 8,
		"hp": 31,
		"sp": 0,
		"stats": {
			"agility": 15,
			"dexterity": 9,
			"strength": 21,
			"wisdom": 2,
			"armor": 5,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Large Spider",
		"zone": "Swamp",
		"mine": 9,
		"boss": false,
		"difficulty": 9,
		"hp": 34,
		"sp": 0,
		"stats": {
			"agility": 12,
			"dexterity": 11,
			"strength": 24,
			"wisdom": 3,
			"armor": 3,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Satyr",
		"zone": "Swamp",
		"mine": 10,
		"boss": false,
		"difficulty": 10,
		"hp": 34,
		"sp": 0,
		"stats": {
			"agility": 13,
			"dexterity": 12,
			"strength": 23,
			"wisdom": 5,
			"armor": 5,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Centaur",
		"zone": "Swamp",
		"mine": 11,
		"boss": false,
		"difficulty": 11,
		"hp": 32,
		"sp": 10,
		"stats": {
			"agility": 12,
			"dexterity": 12,
			"strength": 26,
			"wisdom": 10,
			"armor": 5,
			"charisma": 0
		},
		"spells": [4, 5]
	},
	{
		"name": "Stone Golem",
		"zone": "Ruins",
		"mine": 12,
		"boss": false,
		"difficulty": 12,
		"hp": 40,
		"sp": 0,
		"stats": {
			"agility": 14,
			"dexterity": 13,
			"strength": 29,
			"wisdom": 4,
			"armor": 6,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Cyclops",
		"zone": "Ruins",
		"mine": 12,
		"boss": false,
		"difficulty": 12,
		"hp": 43,
		"sp": 0,
		"stats": {
			"agility": 12,
			"dexterity": 12,
			"strength": 27,
			"wisdom": 5,
			"armor": 5,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Giant",
		"zone": "Ruins",
		"mine": 13,
		"boss": false,
		"difficulty": 13,
		"hp": 41,
		"sp": 0,
		"stats": {
			"agility": 13,
			"dexterity": 12,
			"strength": 27,
			"wisdom": 4,
			"armor": 5,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Ruin Sorcerer",
		"zone": "Ruins",
		"mine": 13,
		"boss": false,
		"difficulty": 13,
		"hp": 42,
		"sp": 17,
		"stats": {
			"agility": 11,
			"dexterity": 13,
			"strength": 28,
			"wisdom": 6,
			"armor": 6,
			"charisma": 0
		},
		"spells": [
			6,
			7,
			8
		]
	},
	{
		"name": "Bandaged Mummy",
		"zone": "Ruins",
		"mine": 14,
		"boss": false,
		"difficulty": 15,
		"hp": 44,
		"sp": 0,
		"stats": {
			"agility": 12,
			"dexterity": 12,
			"strength": 33,
			"wisdom": 6,
			"armor": 6,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Fire Spirit",
		"zone": "Ruins",
		"mine": 15,
		"boss": false,
		"difficulty": 15,
		"hp": 44,
		"sp": 0,
		"stats": {
			"agility": 15,
			"dexterity": 13,
			"strength": 38,
			"wisdom": 7,
			"armor": 7,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Young Dragon",
		"zone": "Mountain",
		"mine": 16,
		"boss": false,
		"difficulty": 16,
		"hp": 48,
		"sp": 0,
		"stats": {
			"agility": 14,
			"dexterity": 13,
			"strength": 39,
			"wisdom": 8,
			"armor": 7,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Rock Beast",
		"zone": "Mountain",
		"mine": 17,
		"boss": false,
		"difficulty": 17,
		"hp": 50,
		"sp": 0,
		"stats": {
			"agility": 15,
			"dexterity": 14,
			"strength": 40,
			"wisdom": 7,
			"armor": 8,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Emerald Wizard",
		"zone": "Mountain",
		"mine": 17,
		"boss": false,
		"difficulty": 17,
		"hp": 50,
		"sp": 20,
		"stats": {
			"agility": 16,
			"dexterity": 15,
			"strength": 43,
			"wisdom": 5,
			"armor": 5,
			"charisma": 0
		},
		"spells": [
			4,
			5,
			7
		]
	},
	{
		"name": "Storm Wizard",
		"zone": "Mountain",
		"mine": 18,
		"boss": false,
		"difficulty": 18,
		"hp": 49,
		"sp": 30,
		"stats": {
			"agility": 15,
			"dexterity": 14,
			"strength": 45,
			"wisdom": 5,
			"armor": 7,
			"charisma": 0
		},
		"spells": [
			12,
			10,
			15
		]
	},
	{
		"name": "Storm Knight",
		"zone": "Mountain",
		"mine": 19,
		"boss": false,
		"difficulty": 19,
		"hp": 41,
		"sp": 0,
		"stats": {
			"agility": 14,
			"dexterity": 13,
			"strength": 43,
			"wisdom": 4,
			"armor": 8,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Ember Hound",
		"zone": "Mountain",
		"mine": 20,
		"boss": false,
		"difficulty": 20,
		"hp": 51,
		"sp": 0,
		"stats": {
			"agility": 15,
			"dexterity": 16,
			"strength": 52,
			"wisdom": 7,
			"armor": 8,
			"charisma": 0
		},
		"spells": []
	},
	{
		"name": "Baron Moonbat",
		"zone": "Caves",
		"mine": 5,
		"boss": true,
		"difficulty": 5,
		"hp": 26,
		"sp": 18,
		"stats": {
			"agility": 13,
			"dexterity": 9,
			"strength": 19,
			"wisdom": 14,
			"armor": 3,
			"charisma": 0
		},
		"spells": [19]
	},
	{
		"name": "Stone Warden",
		"zone": "Swamp",
		"mine": 10,
		"boss": true,
		"difficulty": 10,
		"hp": 46,
		"sp": 12,
		"stats": {
			"agility": 11,
			"dexterity": 12,
			"strength": 24,
			"wisdom": 4,
			"armor": 4,
			"charisma": 0
		},
		"spells": [11]
	},
	{
		"name": "Ember Lord",
		"zone": "Ruins",
		"mine": 15,
		"boss": true,
		"difficulty": 15,
		"hp": 54,
		"sp": 20,
		"stats": {
			"agility": 15,
			"dexterity": 13,
			"strength": 38,
			"wisdom": 7,
			"armor": 7,
			"charisma": 0
		},
		"spells": [15]
	},
	{
		"name": "Emerald Dragon",
		"zone": "Mountain",
		"mine": 20,
		"boss": true,
		"difficulty": 20,
		"hp": 53,
		"sp": 21,
		"stats": {
			"agility": 15,
			"dexterity": 14,
			"strength": 54,
			"wisdom": 7,
			"armor": 9,
			"charisma": 0
		},
		"spells": [17]
	}
];
//#endregion
//#region shared/clans/rng.ts
/** A number from 0 up to (not including) 1. */
function nextFloat(holder) {
	holder.rng = holder.rng + 1831565813 | 0;
	let t = holder.rng;
	t = Math.imul(t ^ t >>> 15, t | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
/** A whole number from 0 up to (not including) n. */
function roll(holder, n) {
	return Math.floor(nextFloat(holder) * n);
}
//#endregion
//#region shared/clans/types.ts
/** Plain data shapes for Clan Quest. Everything here is JSON-safe so the server can save it. */
const STATS = [
	"agility",
	"dexterity",
	"strength",
	"wisdom",
	"armor",
	"charisma"
];
const TROOP_KINDS = [
	"footman",
	"axeman",
	"knight"
];
const BUILDING_KINDS = [
	"barracks",
	"walls",
	"tower",
	"steelMill",
	"stables",
	"gymnasium",
	"developersHall"
];
//#endregion
//#region shared/clans/character.ts
/** Making and growing clan members: rolling stats, gear, levels, training, the Church and the shop. */
const raceByName = (name) => RACES.find((r) => r.name === name);
const classByName = (name) => CLASSES.find((c) => c.name === name);
const itemByName$1 = (name) => ITEMS.find((i) => i.name === name);
const emptyStats = () => ({
	agility: 0,
	dexterity: 0,
	strength: 0,
	wisdom: 0,
	armor: 0,
	charisma: 0
});
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
/**
* Race + class, then a small roll (-1 to +1 on each stat, -2 to +2 on HP and SP) for "Roll again".
* The clan leader gets +2 on every stat but armour and +4 HP. Same dice state, same roll.
*/
function rollMember(dice, name, race, cls, leader = false) {
	const r = raceByName(race);
	const c = classByName(cls);
	if (!r || !c) throw new Error(`Unknown race or class: ${race} ${cls}`);
	const stats = emptyStats();
	for (const s of STATS) {
		const wobble = s === "armor" ? 0 : roll(dice, 3) - 1;
		stats[s] = clamp(r.stats[s] + c.stats[s] + wobble + (leader && s !== "armor" ? 2 : 0), 0, CONFIG.statCap);
	}
	const maxHp = Math.max(5, r.hp + c.hp + roll(dice, 5) - 2 + (leader ? 4 : 0));
	const maxSp = Math.max(0, r.sp + c.sp + roll(dice, 5) - 2);
	return {
		name,
		race,
		cls,
		level: 1,
		xp: 0,
		hp: maxHp,
		maxHp,
		sp: maxSp,
		maxSp,
		stats,
		spells: [...new Set([...r.spells, ...c.spells])],
		gear: {},
		points: 0,
		knockedOut: false
	};
}
/** Gear bonuses count only if the member's base stats meet the item's needs. */
function usableBonus(m, item) {
	if (!item) return {};
	for (const s of STATS) if ((item.needs[s] ?? 0) > m.stats[s]) return {};
	return item.bonus;
}
/** What a member fights with: base stats plus usable gear. */
function fightStats(m) {
	const out = { ...m.stats };
	for (const name of [
		m.gear.weapon,
		m.gear.armor,
		m.gear.shield
	]) {
		const bonus = usableBonus(m, name ? itemByName$1(name) : void 0);
		for (const s of STATS) out[s] = clamp(out[s] + (bonus[s] ?? 0), 0, CONFIG.statCap);
	}
	return out;
}
/** Add experience and level up as often as it earns. Returns how many levels were gained. */
function gainXp(m, amount) {
	m.xp += amount;
	let gained = 0;
	while (m.level < CONFIG.maxLevel && m.xp >= CONFIG.xpToReach(m.level + 1)) {
		m.level++;
		m.points += CONFIG.pointsPerLevel;
		gained++;
	}
	return gained;
}
/** Points to raise a stat by 1 with the Training Hall at `hall` (never below 1). */
const trainCost = (stat, hall) => Math.max(1, CONFIG.trainCost[stat] - hall);
/** Spend points on +1 of a stat. Returns false (and changes nothing) if it can't. */
function trainStat(m, stat, hall) {
	const cost = trainCost(stat, hall);
	if (m.points < cost || m.stats[stat] >= CONFIG.statCap) return false;
	m.points -= cost;
	m.stats[stat]++;
	return true;
}
/** Points for one HP purchase and one SP purchase with the Training Hall at `hall` (never below 1). */
const hpCost = (hall) => Math.max(1, CONFIG.hpBuy.cost - Math.floor(hall / 2));
const spCost = (hall) => Math.max(1, CONFIG.spBuy.cost - Math.floor(hall / 2));
function trainHp(m, hall) {
	const cost = hpCost(hall);
	if (m.points < cost) return false;
	m.points -= cost;
	m.maxHp += CONFIG.hpBuy.amount;
	m.hp += CONFIG.hpBuy.amount;
	return true;
}
function trainSp(m, hall) {
	const cost = spCost(hall);
	if (m.points < cost) return false;
	m.points -= cost;
	m.maxSp += CONFIG.spBuy.amount;
	m.sp += CONFIG.spBuy.amount;
	return true;
}
/** The Church: gold to wake a knocked-out member. */
const churchCost = (m) => (m.level + 1) * CONFIG.churchPerLevel;
/** Free wake-ups a day: the usual one, plus one for each level of the village Church. */
const freeWakes = (clan) => CONFIG.freeWakesPerDay + clan.village.church;
/** What waking this member costs the clan right now (nothing while free wake-ups are left today). */
const wakeCost = (clan, m) => (clan.wakesToday ?? 0) < freeWakes(clan) ? 0 : churchCost(m);
function wake(clan, m) {
	const cost = wakeCost(clan, m);
	if (!m.knockedOut || clan.gold < cost) return false;
	clan.gold -= cost;
	clan.wakesToday = (clan.wakesToday ?? 0) + 1;
	m.knockedOut = false;
	m.hp = Math.max(1, Math.ceil(m.maxHp / 2));
	return true;
}
/** Shop price including the village tax, rounded up. */
const shopPrice = (item, tax = CONFIG.shopTax) => Math.ceil(item.price * (100 + tax) / 100);
/** Cost to look at an item's real stats. */
const examineCost = (item) => Math.ceil(item.price * CONFIG.examinePercent / 100);
/** What the Smithy has on its shelves at a given level. */
const inShop = (smithy) => ITEMS.filter((i) => i.shopLevel >= 6 - smithy);
function buy(clan, m, item) {
	const price = shopPrice(item);
	if (clan.gold < price || !inShop(clan.village.smithy).includes(item)) return false;
	clan.gold -= price;
	m.gear[item.kind] = item.name;
	return true;
}
/** Overnight: everyone wakes up healed. */
function dayReset(clan) {
	clan.wakesToday = 0;
	for (const m of clan.members) {
		m.knockedOut = false;
		m.hp = m.maxHp;
		m.sp = m.maxSp;
	}
}
const SPELLS = Object.fromEntries([
	{
		id: 1,
		name: "Little Heal",
		kind: "heal",
		value: 10,
		sp: 8,
		level: 0,
		friendly: true
	},
	{
		id: 2,
		name: "Heal",
		kind: "heal",
		value: 14,
		sp: 13,
		level: 0,
		friendly: true
	},
	{
		id: 3,
		name: "Slow",
		kind: "debuff",
		value: 0,
		sp: 4,
		level: 3,
		mod: {
			stat: "agility",
			amount: -2,
			rounds: 3
		}
	},
	{
		id: 4,
		name: "Strength",
		kind: "buff",
		value: 0,
		sp: 6,
		level: 5,
		friendly: true,
		mod: {
			stat: "strength",
			amount: 5,
			rounds: 4
		}
	},
	{
		id: 5,
		name: "Ropes",
		kind: "tie",
		value: 0,
		sp: 9,
		level: 3
	},
	{
		id: 6,
		name: "Call Spirit Helper",
		kind: "summon",
		value: 1,
		sp: 13,
		level: 5,
		friendly: true,
		notYet: true
	},
	{
		id: 7,
		name: "Send Spirits Away",
		kind: "summon",
		value: 0,
		sp: 9,
		level: 5,
		notYet: true
	},
	{
		id: 8,
		name: "Fireball",
		kind: "damage",
		value: 9,
		sp: 4,
		level: 6
	},
	{
		id: 9,
		name: "Dragon's Uppercut",
		kind: "damage",
		value: 12,
		sp: 6,
		level: 8
	},
	{
		id: 10,
		name: "Call Ghost Warrior",
		kind: "summon",
		value: 1,
		sp: 7,
		level: 5,
		friendly: true,
		notYet: true
	},
	{
		id: 11,
		name: "Heavy Blow",
		kind: "damage",
		value: 10,
		sp: 6,
		level: 9
	},
	{
		id: 12,
		name: "Wither",
		kind: "damage",
		value: 3,
		sp: 7,
		level: 9,
		all: true
	},
	{
		id: 13,
		name: "Magic Chains",
		kind: "tie",
		value: 0,
		sp: 12,
		level: 4
	},
	{
		id: 14,
		name: "Holy Heal",
		kind: "heal",
		value: 4,
		sp: 7,
		level: 0,
		friendly: true
	},
	{
		id: 15,
		name: "Lightning Bolt",
		kind: "damage",
		value: 25,
		sp: 15,
		level: 8
	},
	{
		id: 16,
		name: "Sneak Attack",
		kind: "damage",
		value: 17,
		sp: 9,
		level: 9
	},
	{
		id: 17,
		name: "Fire Breath",
		kind: "damage",
		value: 10,
		sp: 9,
		level: 15
	},
	{
		id: 18,
		name: "Battle Fury",
		kind: "buff",
		value: 0,
		sp: 7,
		level: 6,
		friendly: true,
		mod: {
			stat: "strength",
			amount: 6,
			rounds: 4
		}
	},
	{
		id: 19,
		name: "Scare",
		kind: "debuff",
		value: 0,
		sp: 9,
		level: 6,
		mod: {
			stat: "strength",
			amount: -3,
			rounds: 3
		}
	},
	{
		id: 20,
		name: "Light Blow",
		kind: "damage",
		value: 13,
		sp: 4,
		level: 3
	},
	{
		id: 21,
		name: "Hurricane Kick",
		kind: "damage",
		value: 10,
		sp: 4,
		level: 5
	},
	{
		id: 22,
		name: "Divine Warrior",
		kind: "summon",
		value: 1,
		sp: 8,
		level: 5,
		friendly: true,
		notYet: true
	},
	{
		id: 23,
		name: "Dazzle",
		kind: "debuff",
		value: 0,
		sp: 6,
		level: 5,
		mod: {
			stat: "dexterity",
			amount: -3,
			rounds: 3
		}
	},
	{
		id: 24,
		name: "Fire Breath",
		kind: "damage",
		value: 6,
		sp: 9,
		level: 15
	},
	{
		id: 25,
		name: "Thunder Rain",
		kind: "damage",
		value: 4,
		sp: 14,
		level: 12,
		all: true
	}
].map((s) => [s.id, s]));
//#endregion
//#region shared/clans/fight.ts
/**
* A mine fight, as a pure state machine. `newFight` picks the enemies from a seed; `playRound`
* takes one order per clan member and runs a whole round. The same seed and the same orders
* always give the same fight, so the server can replay what the browser played. The whole
* state is plain JSON, so a half-finished fight can be saved.
*
* Rules and numbers are The Clans': agility-first turns (hurt fighters slow down), hit when
* dexterity beats agility, damage from half strength minus armour, experience per hit.
*/
const stat = (f, s) => {
	let v = f.stats[s];
	for (const m of f.mods) v += m.amount;
	return Math.max(0, Math.min(CONFIG.statCap, v));
};
const alive = (f) => f.hp > 0;
function clanFighter(m, index) {
	return {
		side: "clan",
		index,
		name: m.name,
		level: m.level,
		hp: m.knockedOut ? 0 : m.hp,
		maxHp: m.maxHp,
		sp: m.sp,
		maxSp: m.maxSp,
		stats: fightStats(m),
		spells: m.spells,
		mods: [],
		tied: 0,
		guarding: false,
		difficulty: 0
	};
}
/** One enemy, with the original's wobble: stats 80-139%, HP 80-109%. */
function spawn(dice, def, index) {
	const stats = { ...def.stats };
	for (const s of STATS) stats[s] = Math.floor(def.stats[s] * (80 + roll(dice, 60)) / 100);
	const hp = Math.max(1, Math.floor(def.hp * (80 + roll(dice, 30)) / 100));
	return {
		side: "enemy",
		index,
		name: def.name,
		level: def.difficulty,
		hp,
		maxHp: hp,
		sp: def.sp,
		maxSp: def.sp,
		stats,
		spells: def.spells,
		mods: [],
		tied: 0,
		guarding: false,
		difficulty: def.difficulty
	};
}
/** Monsters that can turn up at a mine depth: from 2 levels above to 1 below (bosses only on request). */
function monstersAt(depth) {
	const pool = MONSTERS.filter((m) => !m.boss && m.mine <= depth + 1 && m.mine >= depth - 2);
	return pool.length ? pool : MONSTERS.filter((m) => !m.boss && Math.abs(m.mine - depth) <= 4);
}
function bossAt(depth) {
	return MONSTERS.find((m) => m.boss && m.mine === depth);
}
/** Start a fight at a mine depth (0-20). `boss` fights the depth's boss with two helpers. */
function newFight(members, depth, seed, boss = false) {
	const state = {
		rng: seed | 0,
		seed: seed | 0,
		depth,
		round: 0,
		clan: members.map(clanFighter),
		enemies: [],
		result: null,
		xp: members.map(() => 0),
		gold: 0,
		followers: 0,
		log: []
	};
	const pool = monstersAt(depth);
	const bossDef = boss ? bossAt(depth) : void 0;
	const count = bossDef ? 2 : depth < 3 ? 2 + roll(state, 2) : 3 + roll(state, 2);
	const list = bossDef ? [bossDef] : [];
	while (list.length < count + (bossDef ? 1 : 0)) list.push(pool[roll(state, pool.length)]);
	state.enemies = list.map((def, i) => spawn(state, def, i));
	if (state.clan.every((f) => !alive(f))) state.result = "lost";
	return state;
}
const team = (s, side) => side === "clan" ? s.clan : s.enemies;
const foes = (s, f) => team(s, f.side === "clan" ? "enemy" : "clan");
const friends = (s, f) => team(s, f.side);
function hurt(s, attacker, target, damage) {
	if (target.guarding) damage = Math.max(1, Math.ceil(damage / 2));
	damage = Math.min(damage, target.hp);
	target.hp -= damage;
	if (attacker.side === "clan") s.xp[attacker.index] += Math.round((Math.floor(damage / 3) + 1) * (1 + Math.max(0, s.depth - CONFIG.xpBoostFrom) * CONFIG.xpDepthBoost));
	if (target.hp <= 0) {
		s.log.push({
			type: "down",
			who: target.name
		});
		if (target.side === "enemy") s.gold += Math.round((target.difficulty * (20 + roll(s, 10)) + 50 + roll(s, 20)) / 10);
	}
	return damage;
}
function attack(s, who, target, cry) {
	if (stat(who, "dexterity") + roll(s, 4) + roll(s, 4) + 2 < stat(target, "agility") + roll(s, 4)) {
		s.log.push({
			type: "miss",
			who: who.name,
			target: target.name
		});
		return;
	}
	let dmg = Math.floor(Math.floor(stat(who, "strength") / 2) * (80 + roll(s, 40)) / 100);
	if (who.side === "clan" && cry === "damage") dmg = Math.floor(dmg * CONFIG.battleCryDamage);
	dmg = Math.max(1, dmg - stat(target, "armor"));
	const done = hurt(s, who, target, dmg);
	s.log.push({
		type: "hit",
		who: who.name,
		target: target.name,
		damage: done
	});
}
/** Does this spell go off against a target? Healing and damage always do; the rest can be shrugged off. */
function lands(s, who, spell, target) {
	if (spell.kind === "heal" || spell.kind === "damage" || spell.kind === "buff") return true;
	return who.level + stat(who, "wisdom") + roll(s, 8) + spell.level >= target.level + stat(target, "wisdom") + roll(s, 4);
}
function canCast(f, spellId) {
	const sp = SPELLS[spellId];
	return !!sp && !sp.notYet && f.spells.includes(spellId) && f.sp >= sp.sp;
}
function cast(s, who, spell, target) {
	who.sp -= spell.sp;
	const lvl = Math.min(who.level, 10);
	if (spell.kind === "heal") {
		const amount = Math.floor((spell.value + Math.floor(lvl / 2)) * (50 + roll(s, 50)) / 100);
		target.hp = Math.min(target.maxHp, target.hp + amount);
		s.log.push({
			type: "cast",
			who: who.name,
			spell: spell.name,
			target: target.name,
			amount
		});
	} else if (spell.kind === "damage") {
		const targets = spell.all ? foes(s, who).filter(alive) : [target];
		for (const t of targets) {
			const done = hurt(s, who, t, Math.max(1, Math.floor((spell.value + Math.floor((lvl + stat(who, "wisdom")) / 3)) * (50 + roll(s, 60)) / 100)));
			s.log.push({
				type: "cast",
				who: who.name,
				spell: spell.name,
				target: t.name,
				amount: done
			});
		}
	} else if (!lands(s, who, spell, target)) s.log.push({
		type: "resist",
		who: who.name,
		spell: spell.name,
		target: target.name
	});
	else if (spell.kind === "tie") {
		target.tied = 1;
		s.log.push({
			type: "cast",
			who: who.name,
			spell: spell.name,
			target: target.name,
			amount: 0
		});
	} else if (spell.mod) {
		target.mods.push({
			stat: spell.mod.stat,
			amount: spell.mod.amount,
			until: s.round + spell.mod.rounds - 1
		});
		s.log.push({
			type: "cast",
			who: who.name,
			spell: spell.name,
			target: target.name,
			amount: spell.mod.amount
		});
	}
}
function pick$1(s, list) {
	const live = list.filter(alive);
	return live.length ? live[roll(s, live.length)] : void 0;
}
/** What an enemy does with its turn. */
function enemyTurn(s, who, cry) {
	const spells = who.spells.map((id) => SPELLS[id]).filter((sp) => !!sp && canCast(who, sp.id));
	if (spells.length && roll(s, 3) === 0) {
		const spell = spells[roll(s, spells.length)];
		const target = spell.friendly ? friends(s, who).filter(alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] : pick$1(s, foes(s, who));
		if (target) return cast(s, who, spell, target);
	}
	const target = pick$1(s, foes(s, who));
	if (target) attack(s, who, target, cry);
}
function clanTurn(s, who, order, cry) {
	const fallback = () => ({
		action: "attack",
		target: s.enemies.findIndex(alive)
	});
	let o = order ?? fallback();
	if (o.action === "run") {
		const dex = s.clan.filter(alive).reduce((t, f) => t + stat(f, "dexterity"), 0) / Math.max(1, s.clan.filter(alive).length);
		const agi = s.enemies.filter(alive).reduce((t, f) => t + stat(f, "agility"), 0) / Math.max(1, s.enemies.filter(alive).length);
		const ok = dex + roll(s, 15) >= agi + roll(s, 15);
		s.log.push({
			type: "run",
			ok
		});
		if (ok) s.result = "fled";
		return;
	}
	if (o.action === "skip") return;
	if (o.action === "guard") {
		who.guarding = true;
		s.log.push({
			type: "guard",
			who: who.name
		});
		return;
	}
	if (o.action === "spell") {
		const spell = SPELLS[o.spell];
		const target = (spell && spell.friendly ? s.clan : s.enemies)[o.target];
		if (spell && canCast(who, spell.id) && target && alive(target)) return cast(s, who, spell, target);
		o = fallback();
	}
	if (o.action === "attack") {
		let target = s.enemies[o.target];
		if (!target || !alive(target)) target = s.enemies.find(alive);
		if (target) attack(s, who, target, cry);
	}
}
function checkEnd(s) {
	if (s.result) return;
	if (s.enemies.every((f) => !alive(f))) s.result = "won";
	else if (s.clan.every((f) => !alive(f))) s.result = "lost";
}
/** Followers who watched you win: more the deeper you go. */
function followersFor(s) {
	const d = s.depth;
	return (d <= 5 ? 4 : d <= 10 ? 7 : d <= 15 ? 11 : 14) + roll(s, 3);
}
/**
* Play one round. `orders[i]` is clan member i's order (anything missing or not allowed becomes
* a plain attack). `cry` is the Battle Cry bonus the server has already decided was earned.
*/
function playRound(s, orders, cry = null) {
	if (s.result) return;
	s.round++;
	s.log.push({
		type: "round",
		round: s.round
	});
	for (const f of [...s.clan, ...s.enemies]) {
		f.guarding = false;
		f.mods = f.mods.filter((m) => m.until >= s.round);
		if (alive(f) && f.maxHp && f.spells.length) f.sp = Math.min(f.maxSp, f.sp + Math.floor(stat(f, "wisdom") * (roll(s, 15) + 5) / 150) + 1);
	}
	if (cry) s.log.push({
		type: "cry",
		kind: cry
	});
	if (cry === "heal") for (const f of s.clan.filter(alive)) f.hp = Math.min(f.maxHp, f.hp + Math.ceil(f.maxHp * CONFIG.battleCryHeal));
	const order = [...s.clan, ...s.enemies].filter(alive).map((f) => ({
		f,
		key: stat(f, "agility") + Math.floor(f.hp * 10 / f.maxHp) + roll(s, 2)
	})).sort((a, b) => b.key - a.key).map((x) => x.f);
	for (const who of order) {
		if (s.result) break;
		if (!alive(who)) continue;
		if (who.tied > 0) {
			who.tied--;
			s.log.push({
				type: "tied",
				who: who.name
			});
			continue;
		}
		if (who.side === "clan") clanTurn(s, who, orders[who.index], cry);
		else enemyTurn(s, who, cry);
		checkEnd(s);
	}
	if (s.result === "won") s.followers = followersFor(s);
	else if (!s.result && s.round >= CONFIG.maxRounds) s.result = "timeout";
}
/**
* Write a finished fight back onto the members: surviving HP/SP (with the between-fight rest),
* knock-outs, and experience. Gold and followers are for the clan to take. Returns how many
* levels each member gained.
*/
function settle(members, s, gain) {
	return members.map((m, i) => {
		const f = s.clan[i];
		if (!f) return 0;
		const wasOut = m.knockedOut;
		m.sp = f.sp;
		if (wasOut) return 0;
		m.hp = Math.max(0, f.hp);
		if (m.hp === 0) m.knockedOut = true;
		else {
			m.hp = Math.min(m.maxHp, m.hp + Math.ceil((m.maxHp - m.hp) * CONFIG.betweenFightHeal));
			m.sp = Math.min(m.maxSp, m.sp + Math.ceil((m.maxSp - m.sp) * CONFIG.betweenFightHeal));
		}
		return gain(m, s.xp[i]);
	});
}
//#endregion
//#region shared/clans/battleCry.ts
/** The question the clan faces before `round` of a fight started from `seed`. Null if the teacher has every topic off. */
function cryQuestion(seed, round, settings) {
	const dice = { rng: Math.imul(seed | 0, 2654435761) ^ Math.imul(round + 1, 2246822507) };
	nextFloat(dice);
	nextFloat(dice);
	return pickQuestion(settings, () => nextFloat(dice));
}
/** The question for the round about to be played. */
const nextCryQuestion = (state, settings) => cryQuestion(state.seed, state.round + 1, settings);
/** Mark the player's Battle Cry answer. */
function markCry(question, given) {
	if (!question) return {
		answered: false,
		correct: false,
		cry: null,
		question: null
	};
	const correct = !!given && markAnswer(question, given.answer);
	return {
		answered: !!given,
		correct,
		cry: correct ? given.reward : null,
		question
	};
}
/** Play a round with the Battle Cry marked: the one place a round and its question meet. */
function playCryRound(state, settings, orders, given) {
	if (state.result) return {
		answered: false,
		correct: false,
		cry: null,
		question: null
	};
	const result = markCry(nextCryQuestion(state, settings), given);
	playRound(state, orders, result.cry);
	return result;
}
/** Replay a whole recorded fight from its seed. The server uses this to check what the browser reports. */
function replayFight(members, depth, seed, boss, rounds, settings) {
	const state = newFight(members, depth, seed, boss);
	const cries = [];
	for (const r of rounds) {
		if (state.result) break;
		cries.push(playCryRound(state, settings, r.orders, r.cry));
	}
	return {
		state,
		cries
	};
}
/** The key a question kind is kept under in the teacher's private maths records: the kind and the year band, never the numbers. */
const factKey = (band, kind) => `clan:y${band}:${kind}`;
/** The pack Clan Quest's answers are kept in (the same table Gem Keep and Dragon Maths use). */
const FACT_PACK = "clan-quest";
/** The server cannot know how long a child took, so every answer is kept as a slow one: it counts as tried and right, never as "fluent". */
const UNTIMED_MS = 6e4;
//#endregion
//#region shared/maths/config.ts
/** Answering correctly within this many milliseconds counts as quick. */
const QUICK_MS = 5e3;
//#endregion
//#region shared/clans/empire.ts
/**
* The empire: land, buildings, worker energy, troops, the draft, six computer kingdoms, battles,
* Friendly War, and the rule for raids on classmates. Plain data and plain functions, like
* `fight.ts`: a battle is settled in one go from two armies, a battle plan and a seed, so the
* same inputs always give the same answer and the server can replay it.
*
* The empire has its own vault. The clan's purse (mine gold) is never at risk; only the vault is.
* Every number is in `config.ts` (CONFIG.empire).
*/
const E = CONFIG.empire;
const ok$1 = { ok: true };
const no$1 = (why, say) => ({
	ok: false,
	why,
	say
});
const noTroops = () => ({
	footman: 0,
	axeman: 0,
	knight: 0
});
function newEmpire(day = 1) {
	return {
		vault: 0,
		wild: E.startWild,
		claimed: 0,
		plots: [],
		troops: noTroops(),
		draftPercent: 0,
		day,
		createdDay: day,
		energyUsed: 0,
		raidsToday: 0,
		kingdomRaidsToday: 0,
		shieldUntil: 0,
		raidedToday: []
	};
}
/** The clan's empire, made the first time it is needed. */
function empireOf(clan) {
	return clan.empire ??= newEmpire();
}
const BUILDING_NAMES = {
	barracks: "Barracks",
	walls: "Walls",
	tower: "Tower",
	steelMill: "Steel Mill",
	stables: "Stables",
	gymnasium: "Gymnasium",
	developersHall: "Developer's Hall"
};
const TROOP_NAMES = {
	footman: {
		one: "footman",
		many: "footmen"
	},
	axeman: {
		one: "axeman",
		many: "axemen"
	},
	knight: {
		one: "knight",
		many: "knights"
	}
};
const area = (width, length) => width * length;
const fence = (width, length) => 2 * (width + length);
const countBuildings = (e, kind) => e.plots.filter((p) => p.building === kind).length;
const buildingTotal = (e) => e.plots.filter((p) => p.building).length;
/** Plots with nothing on them: wild land and developed plots with no building. */
const emptyLand = (e) => e.wild + e.plots.filter((p) => !p.building).length;
/** What the effect of N buildings of one kind is, in percent (or points), stopping at the most that count. */
const effect = (e, kind) => countBuildings(e, kind) * E.buildings[kind].per;
/** Gold to develop a plot: the squares plus the fence, less the Developer's Hall discount, rounded up. */
function plotCost(e, width, length) {
	const base = area(width, length) * E.landPerSquare + fence(width, length) * E.fencePerUnit;
	return Math.ceil(base * (100 - effect(e, "developersHall")) / 100);
}
const validSide = (n) => Number.isInteger(n) && n >= E.plotSide.min && n <= E.plotSide.max;
/** Gold to claim one more plot of wild land. */
const claimCost = (e) => E.claim.base + E.claim.step * e.claimed;
function claimLand(e) {
	if (e.claimed >= E.claim.max) return no$1("max", "There is no more land to claim nearby.");
	const cost = claimCost(e);
	if (e.vault < cost) return no$1("gold", `Claiming land costs ${cost} gold and the vault has ${e.vault}.`);
	e.vault -= cost;
	e.claimed++;
	e.wild++;
	return ok$1;
}
/** Turn one piece of wild land into a developed plot. Paid from the empire's vault. */
function developPlot(e, width, length) {
	if (!validSide(width) || !validSide(length)) return no$1("size", `A plot is between ${E.plotSide.min} and ${E.plotSide.max} squares on each side.`);
	if (e.wild < 1) return no$1("land", "There is no wild land left to develop.");
	const cost = plotCost(e, width, length);
	if (e.vault < cost) return no$1("gold", `That plot costs ${cost} gold and the vault has ${e.vault}.`);
	e.vault -= cost;
	e.wild--;
	e.plots.push({
		width,
		length
	});
	return ok$1;
}
const energyLeft = (e) => E.energyPerDay - e.energyUsed;
/** Can this building go on this plot, and what stops it? */
function canBuild(e, plotIndex, kind) {
	const plot = e.plots[plotIndex];
	const def = E.buildings[kind];
	if (!plot) return no$1("plot", "Pick one of your developed plots.");
	if (plot.building) return no$1("taken", "That plot already has a building on it.");
	if (area(plot.width, plot.length) < def.size) return no$1("size", `A ${BUILDING_NAMES[kind]} needs ${def.size} squares and this plot has ${area(plot.width, plot.length)}.`);
	if (countBuildings(e, kind) >= def.max) return no$1("max", `You already have as many ${BUILDING_NAMES[kind]} as you can use (${def.max}).`);
	if (energyLeft(e) < def.energy) return no$1("energy", `The ${BUILDING_NAMES[kind]} needs ${def.energy}% of a day's work and only ${energyLeft(e)}% is left today.`);
	if (e.vault < def.gold) return no$1("gold", `The ${BUILDING_NAMES[kind]} costs ${def.gold} gold and the vault has ${e.vault}.`);
	return ok$1;
}
function build(e, plotIndex, kind) {
	const can = canBuild(e, plotIndex, kind);
	if (!can.ok) return can;
	const def = E.buildings[kind];
	e.vault -= def.gold;
	e.energyUsed += def.energy;
	e.plots[plotIndex].building = kind;
	return ok$1;
}
function deposit(clan, gold) {
	const e = empireOf(clan);
	if (!Number.isInteger(gold) || gold < 1) return no$1("amount", "Pick a number of gold to move.");
	if (clan.gold < gold) return no$1("gold", `The clan purse only has ${clan.gold} gold.`);
	clan.gold -= gold;
	e.vault += gold;
	return ok$1;
}
function withdraw(clan, gold) {
	const e = empireOf(clan);
	if (!Number.isInteger(gold) || gold < 1) return no$1("amount", "Pick a number of gold to move.");
	if (e.vault < gold) return no$1("gold", `The vault only has ${e.vault} gold.`);
	e.vault -= gold;
	clan.gold += gold;
	return ok$1;
}
const capacity = (e, kind) => countBuildings(e, "barracks") * E.troopCap[kind];
const room = (e, kind) => Math.max(0, capacity(e, kind) - e.troops[kind]);
function buyTroops(e, kind, n) {
	if (!Number.isInteger(n) || n < 1) return no$1("amount", "Pick how many to buy.");
	if (room(e, kind) < n) return no$1("room", `The barracks have room for ${room(e, kind)} more ${TROOP_NAMES[kind].many}.`);
	const cost = n * E.troopCost[kind];
	if (e.vault < cost) return no$1("gold", `That costs ${cost} gold and the vault has ${e.vault}.`);
	e.vault -= cost;
	e.troops[kind] += n;
	return ok$1;
}
/** The most the draft can ask for: 20%, and 5% more for each Gymnasium. */
const draftMax = (e) => E.draftMax + effect(e, "gymnasium");
function setDraft(e, percent) {
	const most = draftMax(e);
	if (!Number.isInteger(percent) || percent < 0 || percent > most || percent % E.draftStep !== 0) return no$1("draft", `The draft is 0 to ${most}%, in steps of ${E.draftStep}.`);
	e.draftPercent = percent;
	return ok$1;
}
/** How many of this many followers the draft asks for (rounded up, like every "percent of" question). */
const draftWanted = (followers, percent) => Math.ceil(followers * percent / 100);
/**
* Followers join as footmen at the draft share, as far as the barracks have room. All the
* followers are used up: the ones not drafted go back to their villages.
*/
function draft(clan) {
	const e = empireOf(clan);
	const followers = clan.followers;
	const wanted = draftWanted(followers, e.draftPercent);
	const joined = Math.min(wanted, room(e, "footman"));
	e.troops.footman += joined;
	clan.followers = 0;
	return {
		wanted,
		joined,
		followers
	};
}
/** A new day for the empire: fresh worker energy and raids. (A shield ends by itself when the day number passes it.) */
function empireNewDay(clan) {
	const e = empireOf(clan);
	e.day++;
	e.energyUsed = 0;
	e.raidsToday = 0;
	e.kingdomRaidsToday = 0;
	e.raidedToday = [];
}
/** What an army is worth in a battle: footmen 1, axemen 2, knights 4. */
const might = (t) => TROOP_KINDS.reduce((s, k) => s + t[k] * E.troopMight[k], 0);
const sideOf = (e) => ({
	troops: { ...e.troops },
	walls: countBuildings(e, "walls"),
	towers: countBuildings(e, "tower"),
	mills: countBuildings(e, "steelMill"),
	stables: countBuildings(e, "stables")
});
const KINGDOMS = [
	{
		id: "bunny-hollow",
		name: "Bunny Hollow",
		feel: "an easy one",
		blurb: "A sleepy village with a few farmers on guard.",
		troops: {
			footman: 12,
			axeman: 0,
			knight: 0
		},
		walls: 0,
		towers: 0,
		treasury: 300
	},
	{
		id: "pebble-bridge",
		name: "Pebble Bridge",
		feel: "quite easy",
		blurb: "Bridge keepers who like a quiet life.",
		troops: {
			footman: 24,
			axeman: 6,
			knight: 0
		},
		walls: 0,
		towers: 0,
		treasury: 600
	},
	{
		id: "hilltop-hold",
		name: "Hilltop Hold",
		feel: "a fair fight",
		blurb: "A hill fort with a sturdy fence.",
		troops: {
			footman: 40,
			axeman: 15,
			knight: 3
		},
		walls: 1,
		towers: 0,
		treasury: 1e3
	},
	{
		id: "ironwood",
		name: "Ironwood",
		feel: "a bit tough",
		blurb: "Woodcutters with very sharp axes.",
		troops: {
			footman: 50,
			axeman: 30,
			knight: 6
		},
		walls: 2,
		towers: 1,
		treasury: 1600
	},
	{
		id: "stormcrag",
		name: "Stormcrag",
		feel: "tough",
		blurb: "A castle on a windy cliff.",
		troops: {
			footman: 60,
			axeman: 40,
			knight: 14
		},
		walls: 3,
		towers: 2,
		treasury: 2500
	},
	{
		id: "dragons-rest",
		name: "Dragon's Rest",
		feel: "very tough",
		blurb: "The biggest kingdom around, with tall walls.",
		troops: {
			footman: 80,
			axeman: 50,
			knight: 25
		},
		walls: 4,
		towers: 4,
		treasury: 3700
	}
];
const kingdomById = (id) => KINGDOMS.find((k) => k.id === id);
const kingdomSide = (k) => ({
	troops: { ...k.troops },
	walls: k.walls,
	towers: k.towers,
	mills: 0,
	stables: 0
});
const PUSHES = Object.keys(E.battle.push);
/** A plan with every part forced into what is allowed. */
function cleanPlan(plan, lootMax = Math.max(...E.battle.lootChoices)) {
	const rounds = Math.min(E.battle.maxRounds, Math.max(1, Math.round(plan.rounds ?? 3)));
	const push = plan.push && PUSHES.includes(plan.push) ? plan.push : "steady";
	const choices = E.battle.lootChoices.filter((c) => c <= lootMax);
	const asked = plan.loot ?? choices[0];
	return {
		rounds,
		push,
		loot: [...choices].reverse().find((c) => c <= asked) ?? choices[0]
	};
}
function lost(troops, start, left, stables) {
	const hurt = start > 0 ? (start - left) / start : 0;
	const keep = Math.max(0, 100 - stables * E.buildings.stables.per) / 100;
	const out = noTroops();
	for (const k of TROOP_KINDS) out[k] = Math.min(troops[k], Math.floor(troops[k] * hurt * E.battle.lossShare * keep));
	return out;
}
/**
* Settle a whole battle. Each round both sides lose about a quarter of what they have left, a
* little more or less by luck. Mills add to the attacker's damage, walls cut the damage the
* defender takes, towers add to the defender's; asking for more loot makes the defenders fight
* harder. When the rounds are over, the defenders have given way if they are down to half
* strength and worse off than the attackers; if the attackers are worse off they fall back; if
* not, it is a stalemate and nobody wins. A careful push does less damage but takes much less,
* a bold one does more but takes more, so more rounds means more troops hurt on both sides.
* Nothing is taken from either side here: `raidKingdom` and `raidClassmate` do that.
*/
function battle(attacker, defender, planIn, seed) {
	const plan = cleanPlan(planIn);
	const dice = { rng: seed | 0 };
	const b = E.battle;
	const push = b.push[plan.push];
	const startA = might(attacker.troops);
	const startD = might(defender.troops);
	let a = startA;
	let d = startD;
	const rounds = [];
	let outcome = "stalemate";
	if (startA === 0) outcome = "lost";
	else if (startD === 0) outcome = "won";
	else {
		const outA = (1 + attacker.mills * E.buildings.steelMill.per / 100) * push.hit;
		const outD = (1 + defender.towers * E.buildings.tower.per / 100) * (1 + plan.loot / 100) * push.takes;
		const soak = 1 + defender.walls * E.buildings.walls.per / 100;
		for (let r = 1; r <= plan.rounds; r++) {
			const toD = Math.floor(a * outA * b.roundDamage * (b.luck.min + roll(dice, b.luck.span)) / 100 / soak);
			const toA = Math.floor(d * outD * b.roundDamage * (b.luck.min + roll(dice, b.luck.span)) / 100);
			d = Math.max(0, d - toD);
			a = Math.max(0, a - toA);
			rounds.push({
				round: r,
				attacker: a,
				defender: d
			});
			if (a === 0 || d === 0) break;
		}
		const aLeft = a / startA;
		const dLeft = d / startD;
		outcome = dLeft < aLeft && dLeft <= b.retreatAt ? "won" : aLeft < dLeft ? "lost" : "stalemate";
	}
	return {
		outcome,
		plan,
		startAttacker: startA,
		startDefender: startD,
		rounds,
		attackerLost: lost(attacker.troops, startA, a, attacker.stables),
		defenderLost: lost(defender.troops, startD, d, defender.stables)
	};
}
function takeLosses(e, lostTroops) {
	for (const k of TROOP_KINDS) e.troops[k] -= lostTroops[k];
}
/** Gold a raid takes from a treasury: the share asked for, rounded up like every "percent of" question, never more than there is. */
const lootGold = (treasury, percent) => Math.min(treasury, Math.ceil(treasury * percent / 100));
/** Raid a computer kingdom: your army fights, you lose the troops that do not come home, and a win takes loot into the vault. */
function raidKingdom(e, kingdomId, plan, seed) {
	const k = kingdomById(kingdomId);
	if (!k) return no$1("kingdom", "Pick one of the six kingdoms.");
	if (might(e.troops) === 0) return no$1("army", "You need some troops to send.");
	if (e.kingdomRaidsToday >= E.raids.kingdomPerDay) return no$1("limit", `You have already raided ${E.raids.kingdomPerDay} times today. Try again tomorrow, or have a Friendly War.`);
	const result = battle(sideOf(e), kingdomSide(k), plan, seed);
	e.kingdomRaidsToday++;
	takeLosses(e, result.attackerLost);
	const gold = result.outcome === "won" ? lootGold(k.treasury, result.plan.loot) : 0;
	e.vault += gold;
	return {
		ok: true,
		result,
		gold
	};
}
/** Friendly War: the same battle, but nobody loses or wins anything, and it does not count as a raid. */
function friendlyWar(e, kingdomId, plan, seed) {
	const k = kingdomById(kingdomId);
	if (!k) return no$1("kingdom", "Pick one of the six kingdoms.");
	if (might(e.troops) === 0) return no$1("army", "You need some troops to send.");
	return {
		ok: true,
		result: battle(sideOf(e), kingdomSide(k), plan, seed)
	};
}
/** Why a classmate raid is not allowed, or null if it is. `raidsOn` is the teacher's switch. */
function raidRefusal(attacker, defender, today, raidsOn = true) {
	const a = attacker.empire;
	const d = defender.empire;
	const r = E.raids;
	if (!raidsOn) return {
		why: "off",
		say: "Your teacher has switched raids on classmates off."
	};
	if (attacker.id === defender.id) return {
		why: "self",
		say: "You cannot raid your own empire."
	};
	if (today < a.createdDay + r.newClanDays) return {
		why: "new-attacker",
		say: `Your clan is new. Raids on classmates start on day ${a.createdDay + r.newClanDays}.`
	};
	if (today < d.createdDay + r.newClanDays) return {
		why: "new-defender",
		say: "That clan is brand new and is still protected."
	};
	if (a.raidsToday >= r.perDay) return {
		why: "limit",
		say: `You have already raided ${r.perDay === 1 ? "once" : `${r.perDay} times`} today.`
	};
	if (a.raidedToday.includes(defender.id)) return {
		why: "same",
		say: "You already raided that clan today."
	};
	if (today <= d.shieldUntil) return {
		why: "shield",
		say: "That clan was raided recently and is resting behind its shield."
	};
	const mine = might(a.troops);
	const theirs = might(d.troops);
	if (mine === 0) return {
		why: "army",
		say: "You need some troops to send."
	};
	if (theirs * r.fairRatio < mine || mine * r.fairRatio < theirs) return {
		why: "unfair",
		say: "That clan is not a fair match for the size of your army."
	};
	return null;
}
/** The shortest news line, safe to show: the raiders' clan name and what happened, never a student's name. */
function raidNews(raiderClan, raid) {
	if (raid.result.outcome !== "won") return `A raider from the ${raiderClan} clan was driven off.`;
	if (raid.take === "gold") return `A raider from the ${raiderClan} clan took ${raid.gold} gold.`;
	if (raid.take === "land") return `A raider from the ${raiderClan} clan took ${raid.land} ${raid.land === 1 ? "plot" : "plots"} of land.`;
	return `A raider from the ${raiderClan} clan knocked down ${raid.destroyed.length} ${raid.destroyed.length === 1 ? "building" : "buildings"}.`;
}
/**
* Raid a classmate. The defender is a saved copy played by the computer (same battle, steady
* defence). Loot is at most 10%. A win takes gold, land or buildings; buildings are made harder
* to knock down by Walls. Both sides lose the troops that do not come home, and the defender gets a shield.
*/
function raidClassmate(attacker, defender, take, planIn, seed, today, raidsOn = true) {
	const refused = raidRefusal(attacker, defender, today, raidsOn);
	if (refused) return {
		ok: false,
		...refused
	};
	const a = attacker.empire;
	const d = defender.empire;
	const plan = cleanPlan(planIn, E.raids.classmateLootMax);
	const result = battle(sideOf(a), sideOf(d), plan, seed);
	const dice = { rng: seed ^ 1540483477 | 0 };
	a.raidsToday++;
	a.raidedToday.push(defender.id);
	d.shieldUntil = today + E.raids.shieldDays;
	takeLosses(a, result.attackerLost);
	takeLosses(d, result.defenderLost);
	const out = {
		result,
		take,
		gold: 0,
		land: 0,
		destroyed: []
	};
	if (result.outcome === "won") {
		if (take === "gold") {
			out.gold = lootGold(d.vault, plan.loot);
			d.vault -= out.gold;
			a.vault += out.gold;
		} else if (take === "land") {
			out.land = Math.min(emptyLand(d), Math.ceil(emptyLand(d) * plan.loot / 100));
			for (let i = 0; i < out.land; i++) if (d.wild > 0) d.wild--;
			else d.plots.splice(d.plots.map((p) => !p.building).lastIndexOf(true), 1);
			a.wild += out.land;
		} else {
			const walls = countBuildings(d, "walls");
			const count = Math.max(0, Math.ceil(buildingTotal(d) * plan.loot / 100) - walls);
			for (let i = 0; i < count; i++) {
				const hit = d.plots.map((p, n) => p.building && p.building !== "walls" ? n : -1).filter((n) => n >= 0);
				if (hit.length === 0) break;
				const plot = d.plots[hit[roll(dice, hit.length)]];
				out.destroyed.push(plot.building);
				plot.building = void 0;
			}
		}
	}
	return {
		ok: true,
		...out
	};
}
//#endregion
//#region shared/clans/words.ts
/** Names come from word lists (the hub's rule: nobody types a name). */
const MEMBER_NAMES = [
	"Aria",
	"Bram",
	"Cleo",
	"Dax",
	"Elin",
	"Finn",
	"Gwen",
	"Hugo",
	"Isla",
	"Jory",
	"Kira",
	"Leif",
	"Mira",
	"Nico",
	"Orla",
	"Pip",
	"Quill",
	"Rowan",
	"Sage",
	"Tam",
	"Una",
	"Vik",
	"Wren",
	"Xara",
	"Yuri",
	"Zed",
	"Ember",
	"Moss",
	"Tilly",
	"Bodhi",
	"Kiri",
	"Hemi"
];
const CLAN_ADJECTIVES = [
	"Red",
	"Silver",
	"Brave",
	"Golden",
	"Swift",
	"Jolly",
	"Mighty",
	"Clever",
	"Misty",
	"Bold",
	"Lucky",
	"Iron"
];
const CLAN_NOUNS = [
	"Banner",
	"Foxes",
	"Lanterns",
	"Wolves",
	"Shields",
	"Owls",
	"Pennants",
	"Bears",
	"Falcons",
	"Hammers",
	"Stars",
	"Rangers"
];
/** The member a draft shows right now. Slot 0 is the clan leader. */
function draftMember(d, slot) {
	return rollMember({ rng: Math.imul(d.seed | 0, 2654435761) + d.rolls * 7919 }, d.name, d.race, d.cls, slot === 0);
}
/** The seed of slot `slot` of a clan with this seed. */
const slotSeed = (seed, slot) => seed + slot * 1013;
function makeClan(name, drafts) {
	return {
		name,
		members: drafts.map((d, i) => draftMember(d, i)),
		gold: CONFIG.startGold,
		followers: 0,
		village: {
			trainingHall: 0,
			smithy: 0,
			church: 0
		},
		wakesToday: 0,
		empire: newEmpire()
	};
}
/** True if this is a clan name the creator can make: one adjective and one noun from the lists. */
function isClanName(name) {
	if (typeof name !== "string") return false;
	const [adjective, noun, ...rest] = name.split(" ");
	return rest.length === 0 && CLAN_ADJECTIVES.includes(adjective) && CLAN_NOUNS.includes(noun);
}
/**
* Check what the creator sent and build the clan from it. Only the choices matter (race, class, name,
* how many rolls); the stats are always rebuilt here from the clan's seed.
*/
function clanFromChoices(seed, name, drafts) {
	if (!isClanName(name)) return {
		ok: false,
		say: "Pick a clan name from the lists."
	};
	if (!Array.isArray(drafts) || drafts.length !== CONFIG.minMembers) return {
		ok: false,
		say: `A new clan has ${CONFIG.minMembers} members.`
	};
	const built = [];
	for (const [slot, raw] of drafts.entries()) {
		const d = raw;
		if (!d || typeof d !== "object") return {
			ok: false,
			say: "Those members could not be read."
		};
		if (typeof d.race !== "string" || !raceByName(d.race) || typeof d.cls !== "string" || !classByName(d.cls)) return {
			ok: false,
			say: "Pick a race and a class from the lists."
		};
		if (typeof d.name !== "string" || !MEMBER_NAMES.includes(d.name)) return {
			ok: false,
			say: "Pick member names from the list."
		};
		if (!Number.isInteger(d.rolls) || d.rolls < 0 || d.rolls > 3) return {
			ok: false,
			say: `You can roll again 3 times for each member.`
		};
		built.push({
			race: d.race,
			cls: d.cls,
			name: d.name,
			rolls: d.rolls,
			seed: slotSeed(seed, slot)
		});
	}
	return {
		ok: true,
		clan: makeClan(name, built)
	};
}
//#endregion
//#region shared/clans/rewards.ts
const NOTHING = {
	wins: 0,
	bosses: 0,
	wars: 0,
	kingdomRaids: 0,
	classRaids: 0,
	cries: 0
};
/** Counts for an event, or undefined if it earned nothing (so results stay small). */
function earnedOrNone(part) {
	const e = {
		...NOTHING,
		...part
	};
	return Object.keys(NOTHING).some((k) => e[k] > 0) ? e : void 0;
}
//#endregion
//#region shared/clans/play.ts
/**
* Everyday actions on a clan: shop, Training Hall, Church, troops, raids. Each one changes the clan it is given and says
* yes or no (with a kind sentence). The screens call these through `places.ts` on a copy of the clan; the server
* calls the very same functions, so a changed browser cannot do anything the rules refuse.
*/
const ok = { ok: true };
const no = (why, say) => ({
	ok: false,
	why,
	say
});
const TRAIN_KEYS = [
	...STATS,
	"hp",
	"sp"
];
const memberAt = (clan, index) => clan.members[index] ?? null;
/** Pay the shop price and put the item on the member (swapping out what was there). */
function buyItem(clan, memberIndex, item) {
	const m = memberAt(clan, memberIndex);
	if (!m) return no("member", "Pick one of your clan.");
	if (!inShop(clan.village.smithy).includes(item)) return no("shelf", "The shop does not sell that yet.");
	const price = shopPrice(item);
	if (clan.gold < price) return no("gold", `That costs ${price} gold and the clan has ${clan.gold}.`);
	return buy(clan, m, item) ? ok : no("gold", "That cannot be bought right now.");
}
/** Pay to look closely at an item for a member (the real bonuses show). `examined` keeps who looked at what. */
function examineItemFor(clan, examined, memberIndex, item) {
	const m = memberAt(clan, memberIndex);
	if (!m) return no("member", "Pick one of your clan.");
	const cost = examineCost(item);
	if (clan.gold < cost) return no("gold", `Looking closely costs ${cost} gold and the clan has ${clan.gold}.`);
	clan.gold -= cost;
	const key = `${m.name}|${item.name}`;
	if (!examined.includes(key)) examined.push(key);
	return ok;
}
/** Buy `count` of something at the Training Hall (stops early if the points run out). Fails if not even one could be bought. */
function trainMember(clan, memberIndex, key, count) {
	const m = memberAt(clan, memberIndex);
	if (!m) return no("member", "Pick one of your clan.");
	if (!TRAIN_KEYS.includes(key) || !Number.isInteger(count) || count < 1) return no("amount", "Pick what to train and how many.");
	const hall = clan.village.trainingHall;
	let done = 0;
	for (let i = 0; i < count; i++) {
		if (!(key === "hp" ? trainHp(m, hall) : key === "sp" ? trainSp(m, hall) : trainStat(m, key, hall))) break;
		done++;
	}
	if (done > 0) return ok;
	const cost = key === "hp" ? hpCost(hall) : key === "sp" ? spCost(hall) : Math.max(1, CONFIG.trainCost[key] - hall);
	return no("points", `That needs ${cost} training points and ${m.name} has ${m.points}, or is already as strong as can be.`);
}
/** Wake one member at the Church (the first wake-up each day is free). */
function wakeOne(clan, memberIndex) {
	const m = memberAt(clan, memberIndex);
	if (!m) return no("member", "Pick one of your clan.");
	if (!m.knockedOut) return no("awake", `${m.name} is already awake.`);
	const cost = wakeCost(clan, m);
	if (clan.gold < cost) return no("gold", `Waking ${m.name} costs ${cost} gold and the clan has ${clan.gold}.`);
	return wake(clan, m) ? ok : no("gold", "That cannot be done right now.");
}
const knockedOutMembers = (clan) => clan.members.map((m, i) => ({
	m,
	i
})).filter(({ m }) => m.knockedOut);
/** The order "wake everyone" goes in: dearest first, so the free wake-up saves the most. */
const wakeOrder = (clan) => knockedOutMembers(clan).sort((a, b) => churchCost(b.m) - churchCost(a.m) || a.i - b.i);
/** Levels of the members who would have to pay if everyone were woken now (everyone but the free ones). */
function wakeAllPayers(clan) {
	const free = Math.max(0, freeWakes(clan) - (clan.wakesToday ?? 0));
	return wakeOrder(clan).slice(free).map(({ m }) => m.level);
}
/** What waking everyone costs in gold right now. */
const wakeAllCost = (clan) => wakeAllPayers(clan).reduce((t, l) => t + (l + 1) * CONFIG.churchPerLevel, 0);
/** Wake everyone, dearest first. Nobody is woken unless the clan can afford the lot. */
function wakeEveryone(clan) {
	const order = wakeOrder(clan);
	if (order.length === 0) return no("awake", "Everyone is already awake.");
	const cost = wakeAllCost(clan);
	if (clan.gold < cost) return no("gold", `Waking everyone costs ${cost} gold and the clan has ${clan.gold}.`);
	return order.every(({ i }) => wake(clan, clan.members[i])) ? ok : no("gold", "That cannot be done right now.");
}
const noMix = (mix) => TROOP_KINDS.every((k) => mix[k] === 0);
/** Buy a mix of troops in one go, or none of them: the first thing that cannot be done is the answer. Works on the clan it is given, so callers keep a copy. */
function buyTroopMix(clan, mix) {
	const e = empireOf(clan);
	if (noMix(mix)) return no("amount", "Pick how many to buy.");
	const before = structuredClone(e);
	for (const kind of TROOP_KINDS) {
		if (mix[kind] === 0) continue;
		const done = buyTroops(e, kind, mix[kind]);
		if (!done.ok) {
			Object.assign(e, before);
			return done;
		}
	}
	return ok;
}
/** Draft the followers: they all leave, some join as footmen as far as there is room. */
const draftFollowers = (clan) => draft(clan);
/** The seed for the next raid or Friendly War: from the clan's seed and how many there have been. */
const raidSeed = (baseSeed, raidNo) => Math.imul(baseSeed | 0, 625341585) ^ Math.imul(raidNo + 1, 668265263);
/** Send the army to a kingdom: a real raid (loses troops, wins loot) or a Friendly War (changes nothing). */
function sendArmyTo(clan, kingdomId, plan, friendly, seed) {
	const e = empireOf(clan);
	if (friendly) {
		const r = friendlyWar(e, kingdomId, plan, seed);
		return r.ok ? {
			ok: true,
			result: r.result,
			gold: 0,
			friendly
		} : r;
	}
	const r = raidKingdom(e, kingdomId, plan, seed);
	return r.ok ? {
		ok: true,
		result: r.result,
		gold: r.gold,
		friendly
	} : r;
}
/** The seed for a mine fight: from the clan's seed and how many fights there have been (the fight about to start is number `fightNo` + 1). */
const fightSeed = (baseSeed, fightNo) => Math.imul(baseSeed | 0, 2654435761) ^ Math.imul(fightNo + 1, 2246822507);
/**
* Pay out a finished fight on the clan it was played for: surviving HP and SP (with the rest between fights), knock-outs,
* experience and levels, then the gold and followers. The browser's test page and the server both call this one function.
*/
function payFight(clan, fight) {
	const levels = settle(clan.members, fight, gainXp);
	clan.gold += fight.gold;
	clan.followers += fight.followers;
	return {
		result: fight.result,
		gold: fight.gold,
		followers: fight.followers,
		xp: fight.xp,
		levels
	};
}
//#endregion
//#region shared/clans/quests.ts
/**
* Quests: one short story a day, written by us. Each has one or two choices; some choices need a charming
* clan, some lead to a puzzle. Puzzles are made and marked by code (never an AI) and rebuilt from their kind and numbers.
* A wrong puzzle answer never blocks: the story carries on and the prize is just the smaller one.
* Plain data and plain functions on plain JSON, like empire.ts. Every tuning number is in config.ts (CONFIG.quests).
*/
const Q = CONFIG.quests;
const int$1 = (h, lo, hi) => lo + roll(h, hi - lo + 1);
const pick = (h, list) => list[roll(h, list.length)];
const ANIMALS = [
	{
		word: "crows",
		where: "on a fence",
		names: [
			"Ash",
			"Bree",
			"Cob",
			"Dot"
		]
	},
	{
		word: "frogs",
		where: "on a log",
		names: [
			"Fern",
			"Gus",
			"Hob",
			"Ivy"
		]
	},
	{
		word: "owls",
		where: "on a branch",
		names: [
			"Jem",
			"Kit",
			"Lark",
			"Moss"
		]
	}
];
const COUNT_WORDS = [
	"",
	"",
	"Two",
	"Three",
	"Four"
];
const ASKS = [
	"far left",
	"far right",
	"middle"
];
/** The pattern variants: 0 = count on by the same step, 1 = the step grows by one each time, 2 = doubling. */
const PATTERN_COUNT = 5;
function patternSequence(variant, start, step, count) {
	const out = [start];
	let diff = step;
	for (let i = 1; i < count; i++) {
		const last = out[i - 1];
		if (variant === 0) out.push(last + step);
		else if (variant === 1) {
			out.push(last + diff);
			diff++;
		} else out.push(last * 2);
	}
	return out;
}
/** True if these numbers make a sensible puzzle of this kind. */
function isValidPuzzle(spec) {
	const n = spec.nums;
	if (!n.every((x) => Number.isInteger(x))) return false;
	switch (spec.kind) {
		case "pattern": return n.length === 4 && n[0] >= 0 && n[0] <= 2 && n[1] >= 1 && n[1] <= 50 && n[2] >= 1 && n[2] <= 20 && n[3] === PATTERN_COUNT;
		case "order": {
			const [theme, count, ask] = n;
			return n.length === 3 + (count ?? 0) && theme >= 0 && theme < ANIMALS.length && (count === 3 || count === 4) && ask >= 0 && ask < ASKS.length && isPermutation(n.slice(3), count);
		}
		case "riddle": return n.length === 4 && n[0] >= 1 && n[0] <= 30 && n[1] >= 2 && n[1] <= 9 && n[2] >= 1 && n[2] <= 30 && (n[3] === 0 || n[3] === 1);
		case "cold": return n.length === 2 && n[0] >= -20 && n[0] <= 20 && n[1] !== 0 && Math.abs(n[1]) <= 40 && Math.abs(n[0] + n[1]) <= 40;
	}
}
function isPermutation(list, count) {
	return list.length === count && [...list].sort((a, b) => a - b).every((x, i) => x === i);
}
/** Make the puzzle (as a question the question box can show and mark) from its kind and numbers. Throws if they make no sense. */
function buildPuzzle(spec) {
	if (!isValidPuzzle(spec)) throw new Error(`Bad numbers for a "${spec.kind}" puzzle: ${JSON.stringify(spec.nums)}`);
	const n = spec.nums;
	const base = {
		kind: `quest-${spec.kind}`,
		nums: [...n]
	};
	if (spec.kind === "pattern") {
		const [variant, start, step, count] = n;
		const seq = patternSequence(variant, start, step, count);
		const next = variant === 0 ? seq[count - 1] + step : variant === 1 ? seq[count - 1] + step + count - 1 : seq[count - 1] * 2;
		const rule = variant === 0 ? `Each number is ${step} more than the one before: ${seq[count - 1]} + ${step} = ${next}.` : variant === 1 ? `The jumps go up by one each time (${seq.slice(1).map((v, i) => v - seq[i]).join(", ")}), so the next jump is ${step + count - 1}: ${seq[count - 1]} + ${step + count - 1} = ${next}.` : `Each number is double the one before: ${seq[count - 1]} × 2 = ${next}.`;
		return {
			...base,
			topic: "times",
			text: `The glowing numbers go ${seq.map(fmt).join(", ")}, and then... What number comes next?`,
			answer: next,
			working: ["Look at how the numbers change from one to the next.", rule]
		};
	}
	if (spec.kind === "order") {
		const [theme, count, ask] = n;
		const order = n.slice(3);
		const a = ANIMALS[theme];
		const nameAt = (place) => a.names[order[place]];
		const clues = Array.from({ length: count - 1 }, (_, i) => (i + theme) % 2 === 0 ? `${nameAt(i)} sits left of ${nameAt(i + 1)}.` : `${nameAt(i + 1)} sits right of ${nameAt(i)}.`);
		if (clues.length > 1) clues.push(clues.shift());
		const askPlace = ask === 0 ? 0 : ask === 1 ? count - 1 : Math.floor((count - 1) / 2) + (count === 4 ? 1 : 0);
		const question = ask === 0 ? "Who sits furthest left?" : ask === 1 ? "Who sits furthest right?" : count === 4 ? "Who sits third from the left?" : "Who sits in the middle?";
		const names = [...a.names].slice(0, count);
		const choices = [...names].sort().map((nm) => ({
			value: a.names.indexOf(nm) + 1,
			label: nm
		}));
		return {
			...base,
			topic: "times",
			text: `${COUNT_WORDS[count]} ${a.word} sit in a row ${a.where}: ${names.slice(0, -1).join(", ")} and ${names[count - 1]}. ${clues.join(" ")} ${question}`,
			answer: order[askPlace] + 1,
			choices,
			working: [
				"Put the clues together to find the order, left to right.",
				`The order is ${order.map((_, i) => nameAt(i)).join(", ")}.`,
				`${question.replace("?", "")}: ${nameAt(askPlace)}.`
			]
		};
	}
	if (spec.kind === "riddle") {
		const [x, mul, add, minus] = n;
		const result = minus ? x * mul - add : x * mul + add;
		const op = minus ? "take away" : "add";
		return {
			...base,
			topic: "times",
			text: `I am a secret number. Multiply me by ${mul}, then ${op} ${add}, and you get ${fmt(result)}. What number am I?`,
			answer: x,
			working: [`Work backwards. Undo the last step: ${minus ? `${fmt(result)} + ${add}` : `${fmt(result)} − ${add}`} = ${fmt(x * mul)}.`, `Now undo the multiplying: ${fmt(x * mul)} ÷ ${mul} = ${fmt(x)}.`]
		};
	}
	const [start, change] = n;
	const answer = start + change;
	return {
		...base,
		topic: "integers",
		text: `At the cave door it is ${fmt(start)} degrees. Deeper in, it is ${fmt(Math.abs(change))} degrees ${change < 0 ? "colder" : "warmer"}. What is the temperature there?`,
		answer,
		unit: "degrees",
		working: [`${change < 0 ? "Colder means taking away" : "Warmer means adding"}: ${fmt(start)} ${change < 0 ? "−" : "+"} ${fmt(Math.abs(change))}.`, `${fmt(start)} ${change < 0 ? "−" : "+"} ${fmt(Math.abs(change))} = ${fmt(answer)}.${answer < 0 ? " That is below zero, so it is a negative number." : ""}`]
	};
}
/** Pick the numbers for a puzzle at a year band from a seed. */
function makePuzzle(kind, band, seed) {
	const h = { rng: seed | 0 };
	if (kind === "pattern") {
		const variant = band === 4 ? 0 : band === 5 ? pick(h, [0, 1]) : pick(h, [1, 2]);
		return {
			kind,
			nums: [
				variant,
				variant === 2 ? int$1(h, 1, 5) : int$1(h, 1, band === 4 ? 12 : 20),
				variant === 0 ? band === 4 ? int$1(h, 2, 6) : int$1(h, 4, 12) : variant === 1 ? int$1(h, 1, 3) : 2,
				PATTERN_COUNT
			]
		};
	}
	if (kind === "order") {
		const count = band === 4 ? 3 : 4;
		const order = Array.from({ length: count }, (_, i) => i);
		for (let i = count - 1; i > 0; i--) {
			const j = roll(h, i + 1);
			[order[i], order[j]] = [order[j], order[i]];
		}
		return {
			kind,
			nums: [
				roll(h, ANIMALS.length),
				count,
				roll(h, ASKS.length),
				...order
			]
		};
	}
	if (kind === "riddle") {
		const minus = band === 4 ? 0 : roll(h, 2);
		const mul = band === 4 ? int$1(h, 2, 5) : int$1(h, 3, 9);
		const x = int$1(h, 2, band === 4 ? 10 : 15);
		const add = int$1(h, 2, band === 4 ? 9 : 20);
		return {
			kind,
			nums: [
				x,
				mul,
				minus ? Math.min(add, x * mul - 1) : add,
				minus
			]
		};
	}
	const start = int$1(h, 2, 9);
	return {
		kind,
		nums: [start, -(start + int$1(h, 1, 10))]
	};
}
const ALL = [
	4,
	5,
	6
];
const QUESTS = [
	{
		id: 1,
		title: "The Wandering Goat",
		years: ALL,
		story: ["A goat with a bell round its neck trots into your camp and starts eating the cabbages. It does not seem sorry at all.", "A farmer far down the road is probably missing it. But the goat keeps looking at a hill, as if it wants you to follow."],
		choices: [
			{
				label: "Walk the goat home to the farmer",
				win: {
					text: "The farmer is so happy that he gives you a bag of coins and a very large cheese. The goat nibbles your sleeve to say thank you.",
					gold: "medium"
				}
			},
			{
				label: "Follow the goat up the hill",
				win: {
					text: "Over the hill is a camp of travellers who lost their goat-cart. They like your clan so much that some of them join you.",
					followers: "medium"
				}
			},
			{
				label: "Charm the farmer’s grumpy aunt, too",
				charm: "open",
				win: {
					text: "Auntie scowls at first, but your charming chat makes her laugh until she cries. She gives your clan a big reward and tells all her friends how kind you are.",
					gold: "big",
					followers: "small"
				}
			}
		]
	},
	{
		id: 2,
		title: "The Stepping Stones",
		years: ALL,
		story: ["A wide river bubbles across your path. There is a bridge, but it is a day’s walk away.", "Across the water, flat stones are painted with glowing numbers. A sign says: \"Step where the pattern goes.\""],
		choices: [{
			label: "Hop across the stones",
			puzzle: "pattern",
			win: {
				text: "You hop across without a splash! On the far bank you find a purse that a very wet frog left behind.",
				gold: "big"
			},
			lose: {
				text: "Splash! You land in the shallow water and everyone laughs, even you. You still reach the other side, and find a coin stuck to your boot.",
				gold: "small"
			}
		}, {
			label: "Wade through the shallows",
			win: {
				text: "It is a bit chilly, but nobody minds. A fisher on the bank thinks you are very sensible and asks to join the clan.",
				followers: "small"
			}
		}]
	},
	{
		id: 3,
		title: "The Three Guards",
		years: ALL,
		story: ["A narrow bridge is guarded by a row of sleepy birds. A little sign says: \"Only the clever may pass.\"", "The head guard clears its throat. \"Tell me who sits where, and the toll is free. Listen to the clues.\""],
		choices: [{
			label: "Work out the puzzle",
			puzzle: "order",
			win: {
				text: "The guards cheer! \"Clever clan!\" They let you cross, hand you a toll refund and teach you a few tricks.",
				gold: "medium",
				points: "small"
			},
			lose: {
				text: "The guards chuckle and tell you the answer anyway. \"Good try!\" They let you cross for a small fee, and wave you off kindly.",
				gold: "small"
			}
		}]
	},
	{
		id: 4,
		title: "The Riddling Troll",
		years: ALL,
		story: ["Under a bridge lives a troll who loves riddles more than anything. He is not scary, just bored.", "\"Nobody ever stops to chat,\" he sighs. \"Will you play with me?\""],
		choices: [{
			label: "Answer the troll’s riddle",
			puzzle: "riddle",
			win: {
				text: "The troll claps so hard that the bridge wobbles. \"Wonderful!\" he says. He is so pleased that his cousins come and join your clan.",
				followers: "big"
			},
			lose: {
				text: "The troll shows you how the riddle works, and you both laugh. He gives you a friendly handshake and one of his cousins comes to meet you.",
				followers: "small"
			}
		}, {
			label: "Tell the troll a joke about a sheep",
			charm: "open",
			win: {
				text: "The troll laughs until he falls off his stool. \"Best joke ever!\" He sends two of his friends to join you and gives you a coin for the joke.",
				followers: "medium",
				gold: "small"
			}
		}]
	},
	{
		id: 5,
		title: "The Frozen Cave",
		years: [6],
		story: ["A cave in the side of a mountain breathes out cold air that makes your breath puff in white clouds.", "Inside, a sleeping dragon’s treasure sparkles, and a sign on the wall says: \"Learn how cold it gets before you go in.\""],
		choices: [{
			label: "Check the cold before going in",
			puzzle: "cold",
			win: {
				text: "You wrap up warm, tiptoe past the snoring dragon and scoop up a handful of coins. Your clan stays toasty the whole time.",
				gold: "big"
			},
			lose: {
				text: "You get a bit chilly, and your teeth chatter so loudly that the dragon rolls over in its sleep. You grab a few coins and sneak out.",
				gold: "small"
			}
		}, {
			label: "Wait outside and warm up the clan",
			win: {
				text: "You make a campfire and share hot soup. A passing traveller smells it and asks to join.",
				followers: "small"
			}
		}]
	},
	{
		id: 6,
		title: "The Village Fair",
		years: ALL,
		story: ["Bunting flaps in the breeze, a band plays out of tune, and the smell of pies drifts across the green.", "The fair needs helpers. Everybody looks hopefully at your clan."],
		choices: [
			{
				label: "Help at the pie stall",
				win: {
					text: "You sell pies all afternoon. The pie-maker pays you with gold and some very warm pies.",
					gold: "small",
					followers: "small"
				}
			},
			{
				label: "Juggle for the crowd",
				win: {
					text: "You drop two apples, but the crowd loves it. People throw coins in your hat.",
					gold: "medium"
				}
			},
			{
				label: "Give a speech from the cart",
				charm: "open",
				win: {
					text: "Your clan’s speech is so charming that the whole fair cheers. Lots of people ask to join, and the mayor gives you a thank-you purse.",
					followers: "big",
					gold: "small"
				}
			}
		]
	},
	{
		id: 7,
		title: "The Wishing Well",
		years: ALL,
		story: ["In the middle of a forgotten garden stands a mossy well. Something glints at the bottom.", "A little sign, half hidden in ivy, reads: \"Be kind, and the well is kind back.\""],
		choices: [{
			label: "Reach down with a long stick",
			win: {
				text: "You fish out a tunic that someone dropped long ago. It is a little damp, but it dries out soft and warm.",
				item: "Cloth Tunic"
			}
		}, {
			label: "Make a kind wish for the whole clan",
			win: {
				text: "You wish that everyone in the clan gets better at something. The well glows softly and every member feels a tiny bit wiser.",
				points: "medium"
			}
		}]
	},
	{
		id: 8,
		title: "The Pattern Door",
		years: ALL,
		story: ["At the end of a corridor is a round stone door covered in glowing tiles. The tiles show a row of numbers, and an empty circle at the end.", "Humming from behind the door sounds like a very friendly cat."],
		choices: [{
			label: "Press the right number into the circle",
			puzzle: "pattern",
			win: {
				text: "Click! The door swings open. Behind it a very friendly cat gives you a pat of thanks, a few coins and a lesson in thinking.",
				gold: "small",
				points: "medium"
			},
			lose: {
				text: "The door gives a polite buzz, then opens anyway. \"Nearly!\" says the cat, and shows you the pattern. You learn a bit.",
				points: "small"
			}
		}]
	},
	{
		id: 9,
		title: "The Sleepy Giant",
		years: ALL,
		story: ["A giant is snoring across the road, with a hat over his face. Each snore blows leaves into the air.", "You could tiptoe round him. Or you could wake him up and see what happens."],
		choices: [{
			label: "Tiptoe past, very quietly",
			win: {
				text: "You make it past without a single creak! A pouch of coins has fallen out of his pocket, and you leave a note to say sorry.",
				gold: "small"
			}
		}, {
			label: "Wake him gently and ask for a favour",
			charm: "high",
			win: {
				text: "The giant yawns, then smiles. \"What good manners!\" He gives your clan his old shield, which is huge for him but just right for you.",
				item: "Lion's Shield",
				gold: "small"
			}
		}]
	},
	{
		id: 10,
		title: "The Pie Cart Puzzle",
		years: ALL,
		story: ["A pie seller waves you over. His cart is full of pies, but he has lost count and cannot remember his secret number.", "\"Each day I count the pies a special way,\" he says. \"Can you help?\""],
		choices: [{
			label: "Help him work out the number",
			puzzle: "riddle",
			win: {
				text: "The pie seller does a happy dance. \"That is the number!\" He gives you coins for your help and a few pies for the journey.",
				gold: "medium",
				followers: "small"
			},
			lose: {
				text: "You and the pie seller work it out together, with plenty of pie crumbs. He pays you a little for your time.",
				gold: "small"
			}
		}]
	}
];
/** Does this quest suit the settings? Year 6 puzzles about below-zero numbers only appear at Year 6 and only while the teacher has that topic on. */
function suits(q, settings) {
	if (!q.years.includes(settings.yearBand)) return false;
	return q.choices.every((c) => c.puzzle !== "cold" || topicAvailable(settings, "integers"));
}
const questsFor = (settings) => QUESTS.filter((q) => suits(q, settings));
const mix = (a, b) => Math.imul((a | 0) ^ 2654435769, 2246822507) ^ Math.imul((b | 0) + 2135587861, 3266489909) | 0;
/**
* Today's quest: the suitable quests in an order fixed by the clan's seed, one per day, cycling.
* Null if none suits the settings.
*/
function todaysQuest(baseSeed, day, settings) {
	const list = questsFor(settings);
	if (list.length === 0) return null;
	const h = { rng: mix(baseSeed, 1234) };
	const order = list.map((_, i) => i);
	for (let i = order.length - 1; i > 0; i--) {
		const j = roll(h, i + 1);
		[order[i], order[j]] = [order[j], order[i]];
	}
	return list[order[(Math.max(1, day) - 1) % order.length]];
}
/** Has the clan done today's quest? */
const questDoneToday = (clan, day) => clan.questDay === day;
/** The best charisma in the clan: the one who does the talking. */
function bestCharm(clan) {
	let best = null;
	for (const m of clan.members) if (!best || m.stats.charisma > best.stats.charisma) best = m;
	return {
		value: best ? best.stats.charisma : 0,
		member: best
	};
}
/** Can the clan pick this choice? If not, a kind sentence saying what would unlock it. */
function choiceOpen(clan, choice) {
	if (!choice.charm) return { open: true };
	const need = Q.charm[choice.charm];
	const { value } = bestCharm(clan);
	if (value >= need) return { open: true };
	return {
		open: false,
		say: `This needs a charming member (charisma ${need} or more). Your most charming member has ${value}. Training charisma at the Training Hall can open it.`
	};
}
/** The numbers for a choice's puzzle today: fixed by the seed, the day, the quest and the choice. */
function puzzleFor(q, choiceIndex, baseSeed, day, settings) {
	const kind = q.choices[choiceIndex]?.puzzle;
	if (!kind) return null;
	return makePuzzle(kind, settings.yearBand, mix(mix(baseSeed, day), q.id * 10 + choiceIndex));
}
const itemByName = (name) => ITEMS.find((i) => i.name === name);
/** Who can use an item: has nothing in that slot and meets its base-stat needs. Weakest-kitted first. */
function wearer(clan, item) {
	const needsMet = (m) => Object.entries(item.needs).every(([stat, v]) => m.stats[stat] >= (v ?? 0));
	return clan.members.find((m) => !m.gear[item.kind] && needsMet(m)) ?? null;
}
/**
* Do the quest: check it is allowed, put the prize on the clan, and mark the day as done.
* `right` is how the puzzle went (true right, false wrong or skipped), or null if the choice had no puzzle.
*/
function finishQuest(clan, day, q, choiceIndex, right) {
	const choice = q.choices[choiceIndex];
	if (!choice) return {
		ok: false,
		say: "That choice is not in this story."
	};
	if (questDoneToday(clan, day)) return {
		ok: false,
		say: "Your clan has already done its quest today. Come back tomorrow for a new one."
	};
	const open = choiceOpen(clan, choice);
	if (!open.open) return {
		ok: false,
		say: open.say
	};
	const outcome = choice.puzzle && !right ? choice.lose ?? choice.win : choice.win;
	const prize = {
		gold: outcome.gold ? Q.reward.gold[outcome.gold] : 0,
		followers: outcome.followers ? Q.reward.followers[outcome.followers] : 0,
		points: outcome.points ? Q.reward.points[outcome.points] : 0
	};
	let text = outcome.text;
	if (outcome.item) {
		const item = itemByName(outcome.item);
		const who = item && item.price <= Q.itemMaxPrice ? wearer(clan, item) : null;
		if (item && who) {
			who.gear[item.kind] = item.name;
			prize.item = {
				name: item.name,
				member: who.name
			};
		} else if (item) {
			prize.gold += Math.ceil(item.price / 2);
			text += " Nobody in the clan could use it just now, so you sold it for a fair price.";
		}
	}
	clan.gold += prize.gold;
	clan.followers += prize.followers;
	for (const m of clan.members) m.points += prize.points;
	clan.questDay = day;
	return {
		ok: true,
		text,
		right: choice.puzzle ? !!right : null,
		prize
	};
}
//#endregion
//#region shared/clans/village.ts
/**
* The class village (Clan Quest stage C.6 part A), as plain rules the server and the screens share.
*
* - The village: a chest of gold the class gives to, three buildings to level up (Training Hall, Smithy, Church), and a
*   vote each week on which one to build next. `closeWeek` decides what the week's vote does. The midnight job
*   does the same in SQL (`clan_village_close`); a test keeps the two equal.
* - Raids on classmates: `raidTargetList` says who a clan may raid (and why not, in kind words), and `raidClassmateNz`
*   does a raid. Clans count their days from their own first day, so classmate raids use New Zealand day numbers.
*
* Nothing here knows a student's name or id. A clan is known by its name (adjective + noun from the word lists) and a
* hidden `public_id` made for the purpose.
*/
const V = CONFIG.village;
const VILLAGE_KINDS = V.order;
const isVillageKind = (v) => typeof v === "string" && VILLAGE_KINDS.includes(v);
/** Gold to build `kind` up to level `toLevel`. */
const villageCost = (kind, toLevel) => V[kind].base * toLevel;
/** What the class can vote for: every building that is not yet at its top level. */
function voteOptions(levels) {
	return VILLAGE_KINDS.filter((k) => levels[k] < V[k].max).map((kind) => ({
		kind,
		level: levels[kind] + 1,
		cost: villageCost(kind, levels[kind] + 1)
	}));
}
const partyOf = (id, empire, createdNzDay) => ({
	id,
	empire: {
		...empire,
		createdDay: createdNzDay
	}
});
/** Who this clan may raid, and why not for the rest. Allowed ones come first. */
function raidTargetList(state, today, self, raidsOn, sketches) {
	const attacker = partyOf(self, empireOf(state.clan), state.createdNzDay);
	const list = sketches.map((s) => {
		const defender = partyOf(s.id, {
			...newEmpire(),
			troops: s.troops,
			shieldUntil: s.shieldUntil
		}, s.createdNzDay);
		const refused = raidRefusal(attacker, defender, today, raidsOn);
		return {
			id: s.id,
			name: s.name,
			allowed: !refused,
			say: refused ? refused.say : ""
		};
	});
	return [...list.filter((t) => t.allowed), ...list.filter((t) => !t.allowed)];
}
/** What the raided clan reads next time. The raiders' clan name only. */
function raidNote(raiderClan, raid) {
	if (raid.result.outcome !== "won") return `A raider from the ${raiderClan} clan attacked, and your defenders drove them off!`;
	if (raid.take === "gold") return `A raider from the ${raiderClan} clan beat your defenders and took ${raid.gold} gold from your vault.`;
	if (raid.take === "land") return `A raider from the ${raiderClan} clan beat your defenders and took ${raid.land} ${raid.land === 1 ? "plot" : "plots"} of your land.`;
	return `A raider from the ${raiderClan} clan beat your defenders and knocked down ${raid.destroyed.length} ${raid.destroyed.length === 1 ? "building" : "buildings"}.`;
}
/**
* Raid a classmate with the attacker's saved state (which is changed: the caller passes a copy). The rules are
* `raidClassmate`, with day numbers turned into New Zealand days. The defender's empire comes back changed; the caller
* saves both clans in one go. The attacker's own empire is changed in `state`.
*/
function raidClassmateNz(state, self, target, take, plan, seed, today, raidsOn) {
	const mine = empireOf(state.clan);
	const keep = mine.createdDay;
	mine.createdDay = state.createdNzDay;
	const defenderEmpire = structuredClone(target.empire);
	defenderEmpire.createdDay = target.createdNzDay;
	const out = raidClassmate({
		id: self,
		empire: mine
	}, {
		id: target.id,
		empire: defenderEmpire
	}, take, plan, seed, today, raidsOn);
	mine.createdDay = keep;
	if (!out.ok) return out;
	defenderEmpire.createdDay = target.empire.createdDay;
	const { ok: _ok, ...raid } = out;
	return {
		ok: true,
		raid,
		defenderEmpire,
		news: raidNews(state.clan.name, raid),
		note: raidNote(state.clan.name, raid)
	};
}
//#endregion
//#region shared/clans/actions.ts
/**
* The server side of Clan Quest, as plain functions: an action comes in (what the child pressed), the saved clan
* goes in, and either a new clan and a result come out, or a kind refusal. The server function `clans` is only
* the plumbing around `applyAction`; the rules are the same `shared/clans` code the screens use, so a changed
* browser cannot make the server do anything the rules refuse.
*
* Maths never blocks: the shop, Church and Training Hall take the true price whatever the child answered, so
* those actions carry no answers. A quest puzzle changes the prize, so the quest action carries the answer and
* the server rebuilds the puzzle from the clan's seed, the day, the quest and the choice to mark it.
*
* A mine fight is three kinds of request. `fightStart`: the server takes one off today's fights, picks the monsters from
* the clan's seed and the fight number, and keeps the fight open. `fightRound`: the browser plays each round itself, and
* sends what it did (the orders and the Battle Cry answer); the server replays the whole fight from its seed with
* `replayFight`, marks the answer by rebuilding the question, keeps the round, and when the fight is over pays out
* (gold, followers, experience, knocked-out members) in the same save that closes the fight, so it can only pay once.
* While a fight is open nothing else about the clan can change (that is what keeps the replay honest), and the night's
* rest waits until the fight is over. Stage C.6 part A adds the village chest, the weekly vote and raids on classmates (which also change the raided clan, saved in the same transaction).
*/
const refuse = (why, say) => ({
	ok: false,
	why,
	say
});
const earnedPart = (earned) => earned ? { earned } : {};
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v, lo, hi) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null;
function parsePlan(v) {
	if (!isObj(v)) return null;
	const rounds = int(v.rounds, 1, CONFIG.empire.battle.maxRounds);
	const loot = int(v.loot, 0, 100);
	if (rounds === null || loot === null || typeof v.push !== "string" || !PUSHES.includes(v.push)) return null;
	return {
		rounds,
		push: v.push,
		loot
	};
}
const ORDER_ACTIONS = [
	"attack",
	"spell",
	"guard",
	"run",
	"skip"
];
/** One member's order for a round. `undefined` for "none" (sent as null). Null if it is not an order. */
function parseOrder(v) {
	if (v === null || v === void 0) return void 0;
	if (!isObj(v) || typeof v.action !== "string" || !ORDER_ACTIONS.includes(v.action)) return null;
	switch (v.action) {
		case "attack": {
			const target = int(v.target, -1, 20);
			return target === null ? null : {
				action: "attack",
				target
			};
		}
		case "spell": {
			const spell = int(v.spell, 0, 500);
			const target = int(v.target, -1, 20);
			return spell === null || target === null ? null : {
				action: "spell",
				spell,
				target
			};
		}
		default: return { action: v.action };
	}
}
function parseCry(v) {
	if (v === null || v === void 0) return null;
	if (!isObj(v) || v.reward !== "damage" && v.reward !== "heal") return void 0;
	const answer = v.answer === null || v.answer === void 0 ? null : typeof v.answer === "number" && Number.isFinite(v.answer) ? v.answer : void 0;
	return answer === void 0 ? void 0 : {
		answer,
		reward: v.reward
	};
}
/** Reads an action sent by a browser. Null if it is not one the server knows, however it is changed. */
function parseAction(raw) {
	if (!isObj(raw) || typeof raw.type !== "string") return null;
	const member = int(raw.member, 0, CONFIG.maxMembers - 1);
	switch (raw.type) {
		case "load": return { type: "load" };
		case "claim": return { type: "claim" };
		case "wakeAll": return { type: "wakeAll" };
		case "draft": return { type: "draft" };
		case "create":
			if (typeof raw.name !== "string" || !Array.isArray(raw.drafts) || raw.drafts.length > CONFIG.maxMembers) return null;
			return {
				type: "create",
				name: raw.name,
				drafts: raw.drafts
			};
		case "buy":
		case "examine": return member !== null && typeof raw.item === "string" ? {
			type: raw.type,
			member,
			item: raw.item
		} : null;
		case "train": {
			const count = int(raw.count, 1, 500);
			return member !== null && count !== null && typeof raw.key === "string" && TRAIN_KEYS.includes(raw.key) ? {
				type: "train",
				member,
				key: raw.key,
				count
			} : null;
		}
		case "wake": return member !== null ? {
			type: "wake",
			member
		} : null;
		case "deposit":
		case "withdraw": {
			const gold = int(raw.gold, 1, 1e6);
			return gold !== null ? {
				type: raw.type,
				gold
			} : null;
		}
		case "develop": {
			const width = int(raw.width, 0, 100);
			const length = int(raw.length, 0, 100);
			return width !== null && length !== null ? {
				type: "develop",
				width,
				length
			} : null;
		}
		case "build": {
			const plot = int(raw.plot, 0, 1e3);
			return plot !== null && typeof raw.kind === "string" && BUILDING_KINDS.includes(raw.kind) ? {
				type: "build",
				plot,
				kind: raw.kind
			} : null;
		}
		case "buyTroops": {
			if (!isObj(raw.mix)) return null;
			const mix = {};
			for (const k of TROOP_KINDS) {
				const n = int(raw.mix[k], 0, 1e5);
				if (n === null) return null;
				mix[k] = n;
			}
			return {
				type: "buyTroops",
				mix
			};
		}
		case "setDraft": {
			const percent = int(raw.percent, 0, 100);
			return percent !== null ? {
				type: "setDraft",
				percent
			} : null;
		}
		case "raid":
		case "war": {
			const plan = parsePlan(raw.plan);
			return plan && typeof raw.kingdom === "string" && raw.kingdom.length <= 40 ? {
				type: raw.type,
				kingdom: raw.kingdom,
				plan
			} : null;
		}
		case "quest": {
			const choice = int(raw.choice, 0, 5);
			const answer = raw.answer === null || raw.answer === void 0 ? null : typeof raw.answer === "number" && Number.isFinite(raw.answer) ? raw.answer : void 0;
			return choice !== null && answer !== void 0 ? {
				type: "quest",
				choice,
				answer
			} : null;
		}
		case "fightStart": {
			const depth = int(raw.depth, 0, CONFIG.maxLevel);
			return depth !== null && typeof raw.boss === "boolean" ? {
				type: "fightStart",
				depth,
				boss: raw.boss
			} : null;
		}
		case "fightRound": {
			const round = int(raw.round, 1, CONFIG.maxRounds);
			if (round === null || !Array.isArray(raw.orders) || raw.orders.length > CONFIG.maxMembers) return null;
			const orders = [];
			for (const o of raw.orders) {
				const order = parseOrder(o);
				if (order === null) return null;
				orders.push(order);
			}
			const cry = parseCry(raw.cry);
			return cry === void 0 ? null : {
				type: "fightRound",
				round,
				orders,
				cry
			};
		}
		case "chestGive": {
			const gold = int(raw.gold, 1, CONFIG.village.giveMax);
			return gold !== null ? {
				type: "chestGive",
				gold
			} : null;
		}
		case "vote": return isVillageKind(raw.kind) ? {
			type: "vote",
			kind: raw.kind
		} : null;
		case "raidTargets": return { type: "raidTargets" };
		case "raidClass": {
			const plan = parsePlan(raw.plan);
			const take = raw.take === "gold" || raw.take === "land" || raw.take === "buildings" ? raw.take : null;
			return plan && take && typeof raw.target === "string" && raw.target.length >= 1 && raw.target.length <= 40 ? {
				type: "raidClass",
				target: raw.target,
				take,
				plan
			} : null;
		}
		default: return null;
	}
}
/** The clan's day number for this New Zealand day. */
const clanDay = (createdNzDay, today) => Math.max(1, today - createdNzDay + 1);
/**
* If a new day has started since the clan was last saved, give it the night's rest: everyone heals, the Church's
* free wake-up comes back, the empire's energy and raids reset and the fights come back. A clan that was away for
* a week gets one night's rest and moves to today's number. Returns true if anything changed.
*/
function catchUp(state, today, fightsPerDay = CONFIG.fightsPerDay) {
	const day = clanDay(state.createdNzDay, today);
	if (day <= state.day) return false;
	dayReset(state.clan);
	empireNewDay(state.clan);
	empireOf(state.clan).day = day;
	state.fightsLeft = fightsPerDay;
	state.day = day;
	return true;
}
const done = (state, result, changed = true, effects) => ({
	ok: true,
	state,
	result,
	changed,
	...effects ? { effects } : {}
});
/**
* Apply one action to the saved clan (null if the student has none yet). Works on a copy: the state that
* comes in is never changed, so a refusal leaves everything as it was.
*/
function applyAction(saved, action, ctx) {
	const settings = ctx.settings ?? DEFAULT_PRACTICAL_SETTINGS;
	if (action.type === "create") {
		if (saved) return refuse("exists", "You already have a clan.");
		const made = clanFromChoices(ctx.seed, action.name, action.drafts);
		if (!made.ok) return refuse("create", made.say);
		const state = {
			clan: made.clan,
			seed: ctx.seed,
			day: 1,
			createdNzDay: ctx.today,
			fightsLeft: ctx.fightsPerDay ?? CONFIG.fightsPerDay,
			fightNo: 0,
			raidNo: 0,
			examined: []
		};
		return done(state, { type: "create" });
	}
	if (!saved) return action.type === "load" ? {
		ok: true,
		state: null,
		result: { type: "load" },
		changed: false
	} : refuse("no-clan", "Make a clan first.");
	const state = structuredClone(saved);
	const rested = state.fight ? false : catchUp(state, ctx.today, ctx.fightsPerDay);
	if (state.fight && action.type !== "load" && action.type !== "fightStart" && action.type !== "fightRound" && action.type !== "vote" && action.type !== "raidTargets") return refuse("fight-open", "You are in the middle of a fight. Finish it first!");
	const { clan } = state;
	const settle = (r, result) => r.ok ? done(state, result) : refuse(r.why ?? "no", r.say ?? "That cannot be done right now.");
	switch (action.type) {
		case "load": return done(state, { type: "load" }, rested);
		case "buy": {
			const item = ITEMS.find((i) => i.name === action.item);
			return item ? settle(buyItem(clan, action.member, item), { type: "buy" }) : refuse("item", "The shop does not have that.");
		}
		case "examine": {
			const item = ITEMS.find((i) => i.name === action.item);
			return item ? settle(examineItemFor(clan, state.examined, action.member, item), { type: "examine" }) : refuse("item", "The shop does not have that.");
		}
		case "train": return settle(trainMember(clan, action.member, action.key, action.count), { type: "train" });
		case "wake": return settle(wakeOne(clan, action.member), { type: "wake" });
		case "wakeAll": return settle(wakeEveryone(clan), { type: "wakeAll" });
		case "deposit": return settle(deposit(clan, action.gold), { type: "deposit" });
		case "withdraw": return settle(withdraw(clan, action.gold), { type: "withdraw" });
		case "develop": return settle(developPlot(empireOf(clan), action.width, action.length), { type: "develop" });
		case "claim": return settle(claimLand(empireOf(clan)), { type: "claim" });
		case "build": return settle(build(empireOf(clan), action.plot, action.kind), { type: "build" });
		case "buyTroops": return settle(buyTroopMix(clan, action.mix), { type: "buyTroops" });
		case "setDraft": return settle(setDraft(empireOf(clan), action.percent), { type: "setDraft" });
		case "draft": {
			const out = draftFollowers(clan);
			return done(state, {
				type: "draft",
				...out
			});
		}
		case "raid":
		case "war": {
			const friendly = action.type === "war";
			const out = sendArmyTo(clan, action.kingdom, action.plan, friendly, raidSeed(state.seed, state.raidNo));
			if (!out.ok) return refuse(out.why, out.say);
			state.raidNo++;
			const won = out.result.outcome === "won";
			const earned = earnedOrNone({
				wars: friendly && won ? 1 : 0,
				kingdomRaids: !friendly && won ? 1 : 0
			});
			return done(state, {
				type: action.type,
				friendly,
				result: out.result,
				gold: out.gold,
				...earned ? { earned } : {}
			});
		}
		case "quest": {
			const q = todaysQuest(state.seed, state.day, settings);
			if (!q) return refuse("quest", "There is no quest for you today.");
			if (action.choice >= q.choices.length) return refuse("choice", "That choice is not in this story.");
			const spec = puzzleFor(q, action.choice, state.seed, state.day, settings);
			const right = spec ? action.answer !== null && buildPuzzle(spec).answer === action.answer : null;
			const finished = finishQuest(clan, state.day, q, action.choice, right);
			const answers = spec && finished.ok ? [{
				key: factKey(settings.yearBand, buildPuzzle(spec).kind),
				correct: right === true
			}] : void 0;
			return finished.ok ? done(state, {
				type: "quest",
				questId: q.id,
				text: finished.text,
				right: finished.right,
				prize: finished.prize
			}, true, answers ? { answers } : void 0) : refuse("quest", finished.say);
		}
		case "chestGive":
			if (ctx.village && voteOptions(ctx.village.levels).length === 0) return refuse("full", "The village has built everything already!");
			if (action.gold > clan.gold) return refuse("gold", `The clan purse has ${clan.gold} gold.`);
			clan.gold -= action.gold;
			return done(state, {
				type: "chestGive",
				gold: action.gold
			});
		case "vote":
			if (!ctx.village) return refuse("village", "There is no village to vote in.");
			if (!voteOptions(ctx.village.levels).some((o) => o.kind === action.kind)) return refuse("built", "That building is already as big as it can be.");
			return {
				ok: true,
				state,
				result: { type: "vote" },
				changed: rested,
				effects: { vote: action.kind }
			};
		case "raidTargets": {
			const targets = raidTargetList(state, ctx.today, ctx.self ?? "", ctx.raidsOn ?? false, ctx.mates ?? []);
			return done(state, {
				type: "raidTargets",
				targets
			}, rested);
		}
		case "raidClass": {
			if (!ctx.target || !ctx.self) return refuse("target", "That clan is not in your village.");
			const out = raidClassmateNz(state, ctx.self, ctx.target, action.take, action.plan, raidSeed(state.seed, state.raidNo), ctx.today, ctx.raidsOn ?? false);
			if (!out.ok) return refuse(out.why, out.say);
			state.raidNo++;
			const { gold, land, destroyed } = out.raid;
			return {
				ok: true,
				state,
				changed: true,
				result: {
					type: "raidClass",
					take: action.take,
					result: out.raid.result,
					gold,
					land,
					destroyed,
					...earnedPart(earnedOrNone({ classRaids: out.raid.result.outcome === "won" ? 1 : 0 }))
				},
				effects: { raid: {
					targetId: ctx.target.id,
					empire: out.defenderEmpire,
					news: out.news,
					note: out.note
				} }
			};
		}
		case "fightStart": {
			if (state.fight) return done(state, {
				type: "fightStart",
				resumed: true
			}, false);
			if (state.fightsLeft <= 0) return refuse("fights", "That's all the fights for today. Come back tomorrow!");
			if (!clan.members.some((m) => !m.knockedOut)) return refuse("resting", "Everyone is resting. They wake up tomorrow.");
			if (action.boss && !bossAt(action.depth)) return refuse("boss", "There is no boss at that depth.");
			const seed = fightSeed(state.seed, state.fightNo);
			if (newFight(clan.members, action.depth, seed, action.boss).result) return refuse("resting", "Everyone is resting. They wake up tomorrow.");
			state.fight = {
				depth: action.depth,
				boss: action.boss,
				seed,
				no: state.fightNo + 1,
				settings,
				rounds: []
			};
			state.fightsLeft--;
			state.fightNo++;
			return done(state, {
				type: "fightStart",
				resumed: false
			});
		}
		case "fightRound": {
			const open = state.fight;
			if (!open) return refuse("no-fight", "That fight is already over.");
			if (action.round !== open.rounds.length + 1) return refuse("stale-round", "That round was already played.");
			const played = {
				orders: action.orders,
				cry: action.cry
			};
			const { state: replayed, cries } = replayFight(clan.members, open.depth, open.seed, open.boss, [...open.rounds, played], open.settings);
			if (cries.length !== open.rounds.length + 1) return refuse("no-fight", "That fight is already over.");
			const cry = cries[cries.length - 1];
			const answers = cry.answered && cry.question ? [{
				key: factKey(open.settings.yearBand, cry.question.kind),
				correct: cry.correct
			}] : void 0;
			const effects = answers ? { answers } : void 0;
			const rightCry = cry.answered && cry.correct ? 1 : 0;
			if (!replayed.result) {
				open.rounds.push(played);
				return done(state, {
					type: "fightRound",
					round: action.round,
					over: false,
					summary: null,
					...earnedPart(earnedOrNone({ cries: rightCry }))
				}, true, effects);
			}
			const boss = open.boss;
			const summary = payFight(clan, replayed);
			state.fight = null;
			const won = summary.result === "won";
			const earned = earnedOrNone({
				wins: won && !boss ? 1 : 0,
				bosses: won && boss ? 1 : 0,
				cries: rightCry
			});
			return done(state, {
				type: "fightRound",
				round: action.round,
				over: true,
				summary,
				...earnedPart(earned)
			}, true, effects);
		}
	}
}
//#endregion
//#region shared/clans/clock.ts
/** Clan Quest's days are New Zealand calendar days, like the other daily games. */
const nz = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Pacific/Auckland",
	year: "numeric",
	month: "2-digit",
	day: "2-digit"
});
/** Whole days since 1970 of the New Zealand date at this moment (milliseconds since 1970). */
function nzDayNumber(ms) {
	const [y, m, d] = nz.format(new Date(ms)).split("-").map(Number);
	return Math.round(Date.UTC(y, m - 1, d) / 864e5);
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
//#region supabase/functions/clans/handler.ts
/**
* The clans server function (Clan Quest, stage C.5 part A). The website sends one action at a time ("buy this",
* "wake her", "do today's quest with this answer"); this loads the clan, runs the very same shared/clans rules the
* screens use, and saves the result. The browser is never believed about gold, levels, days or prizes.
*
* Every request carries an id the browser made. If the same id arrives twice (a slow connection, a double tap)
* the first answer is sent back and nothing is paid again. If two requests race, the database refuses the second
* save (its copy was old), and this loads again and redoes the action.
*
* Mine fights go through the same door as everything else: `fightStart` and one `fightRound` per round played, replayed
* and paid by shared/clans (see actions.ts). The teacher's switch is checked on every request, with the clan itself, so
* switching Clan Quest off stops it at once.
*
* Stage C.6 part B: the teacher's maths settings (year band, topics, times tables, mine fights a day) are read from the database on every
* request and sent with the clan, so the browser and the server always use the same ones. Fame, points and achievements are added by the
* database in the same save (from the counts the rules put in the result); this only asks for the new fame and achievements afterwards.
* The maths answers a request produced go in the teacher's private records once the save is kept (a retry reuses the same batch id).
*/
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
/** A batch id for the answers of one request: the same request always gives the same id, so a retry is never counted twice. */
async function batchIdFor(key) {
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`clans:${key}`)));
	const h = hex(digest.slice(0, 16));
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** What the browser is told about a clan: everything it shows, nothing it could use to cheat. */
function publicState(state, settings, loaded, extras) {
	const { clan, seed, day, fightsLeft, fightNo, raidNo, examined, fight } = state;
	return {
		clan,
		seed,
		day,
		fightsLeft,
		fightNo,
		raidNo,
		examined,
		fight: fight ?? null,
		settings,
		news: loaded.news,
		village: loaded.village ?? null,
		raidsOn: loaded.raidsOn ?? false,
		notes: loaded.notes ?? [],
		fame: extras?.fame ?? 0,
		season: extras?.settings.season ?? 1,
		fightsPerDay: extras?.settings.fightsPerDay ?? CONFIG.fightsPerDay,
		achievements: extras?.achievements ?? []
	};
}
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleClans(request) {
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
		if (!limiter.allow(player, 40)) return reply(429, { error: "Slow down a little!" });
		const body = await readJsonBody(request);
		const action = body ? parseAction(body.action) : null;
		if (!body || typeof body.requestId !== "string" || !UUID.test(body.requestId) || !action) {
			console.warn("clans: refused a request that could not be read");
			return reply(400, { error: "That couldn't be read." });
		}
		const requestId = body.requestId.toLowerCase();
		const today = nzDayNumber(services.now());
		let extras = await services.extras(player);
		if (!extras.ok) return extras.why === "busy" ? reply(503, { error: "We couldn't reach your clan just now." }) : reply(400, { error: "That couldn't be read." });
		const settings = readPracticalSettings(extras.value.settings);
		const fightsPerDay = Number.isInteger(extras.value.settings.fightsPerDay) ? extras.value.settings.fightsPerDay : CONFIG.fightsPerDay;
		for (let attempt = 0; attempt < 4; attempt++) {
			const loaded = await services.load(player, requestId);
			if (!loaded.ok) return loaded.why === "busy" ? reply(503, { error: "We couldn't reach your clan just now." }) : reply(400, { error: "That couldn't be read." });
			const { seed, version, state, replay, enabled } = loaded.value;
			if (!enabled) return reply(403, {
				error: "Clan Quest is not switched on yet.",
				off: true
			});
			if (state && loaded.value.village) state.clan.village = loaded.value.village.levels;
			const shown = (s, from = loaded.value) => publicState(s, settings, from, extras.ok ? extras.value : void 0);
			if (replay) return reply(200, {
				ok: true,
				replayed: true,
				seed,
				state: state && shown(state),
				result: replay
			});
			const ctx = {
				seed,
				today,
				settings,
				fightsPerDay,
				village: loaded.value.village ?? null,
				self: loaded.value.self ?? void 0,
				raidsOn: loaded.value.raidsOn ?? false
			};
			let target = null;
			if (state && action.type === "raidTargets") {
				const mates = await services.mates(player);
				if (!mates.ok) return mates.why === "busy" ? reply(503, { error: "We couldn't reach your village just now." }) : reply(400, { error: "That couldn't be read." });
				Object.assign(ctx, { mates: mates.value });
			}
			if (state && action.type === "raidClass") {
				const found = await services.target(player, action.target);
				if (!found.ok) return found.why === "busy" ? reply(503, { error: "We couldn't reach your village just now." }) : reply(400, { error: "That couldn't be read." });
				target = found.value;
				Object.assign(ctx, { target });
			}
			const applied = applyAction(state, action, ctx);
			if (!applied.ok) {
				const current = state && applyAction(state, { type: "load" }, ctx);
				return reply(200, {
					ok: false,
					why: applied.why,
					say: applied.say,
					seed,
					state: current && current.ok && current.state ? shown(current.state) : null
				});
			}
			const effects = applied.effects ?? {};
			if (effects.vote) {
				const voted = await services.vote(player, effects.vote);
				if (!voted.ok) return voted.why === "busy" ? reply(503, { error: "We couldn't count your vote just now." }) : reply(400, { error: "That couldn't be read." });
				if (!voted.value.ok) return reply(200, {
					ok: false,
					why: "built",
					say: "That building is already as big as it can be.",
					seed,
					state: state && shown(state)
				});
			}
			if (!applied.changed || !applied.state) {
				let latest = loaded.value;
				if (effects.vote) {
					const again = await services.load(player, requestId);
					if (again.ok) latest = again.value;
				}
				return reply(200, {
					ok: true,
					replayed: false,
					seed,
					state: applied.state && shown(applied.state, latest),
					result: applied.result
				});
			}
			const saved = effects.raid ? target ? await services.saveRaid(player, version, {
				targetId: target.id,
				targetVersion: target.version,
				empire: effects.raid.empire,
				news: effects.raid.news,
				note: effects.raid.note
			}, requestId, applied.state, applied.result) : {
				ok: false,
				why: "refused"
			} : await services.save(player, version, requestId, action.type, applied.state, applied.result);
			if (!saved.ok) return saved.why === "busy" ? reply(503, { error: "We couldn't save your clan just now." }) : reply(400, { error: "That couldn't be saved." });
			if (saved.value.status === "saved") {
				if (effects.answers?.length) {
					const at = services.now();
					const answers = effects.answers.map((a) => ({
						key: a.key,
						correct: a.correct,
						ms: UNTIMED_MS,
						at
					}));
					await services.recordAnswers(player, requestId, answers);
				}
				const fresh = await services.extras(player);
				if (fresh.ok) extras = fresh;
				let latest = loaded.value;
				if (applied.result.type === "chestGive" || applied.result.type === "raidClass") {
					const again = await services.load(player, "00000000-0000-4000-8000-000000000000");
					if (again.ok) latest = again.value;
				}
				return reply(200, {
					ok: true,
					replayed: false,
					seed,
					state: shown(applied.state, latest),
					result: applied.result
				});
			}
		}
		return reply(409, { error: "Your clan was busy. Please try that again." });
	};
}
//#endregion
//#region supabase/functions/clans/entry.ts
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
	console.error(`clans: ${name} failed (${error.code ?? "unknown"})`);
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
	extras: (player) => call("clan_extras", { player }),
	async recordAnswers(player, batchKey, answers) {
		return call("record_fact_answers", {
			player,
			pack: FACT_PACK,
			batch_id: await batchIdFor(batchKey),
			answers,
			quick_ms: QUICK_MS,
			fluent_days: 2,
			top_box: 4
		});
	},
	load: (player, requestId) => call("load_clan", {
		player,
		request_id: requestId
	}),
	save: (player, expectedVersion, requestId, action, state, result) => call("save_clan", {
		player,
		expected_version: expectedVersion,
		request_id: requestId,
		action,
		state,
		result
	}),
	vote: (player, kind) => call("clan_vote", {
		player,
		kind
	}),
	mates: (player) => call("clan_village_mates", { player }),
	target: (player, targetId) => call("clan_raid_target", {
		player,
		target: targetId
	}),
	saveRaid: (player, expectedVersion, raid, requestId, state, result) => call("save_raid", {
		player,
		expected_version: expectedVersion,
		target: raid.targetId,
		target_version: raid.targetVersion,
		request_id: requestId,
		state,
		defender_empire: raid.empire,
		result,
		news: raid.news,
		note: raid.note
	})
}));
//#endregion
