// GENERATED FILE: don't edit. Edit supabase/functions/clans/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "clans" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
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
const TOPICS$1 = [
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
const int$3 = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
const choose = (random, list) => list[Math.floor(random() * list.length)];
const stepped = (random, lo, hi, step) => lo + step * Math.floor(random() * ((hi - lo) / step + 1));
const whole$2 = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const allWhole = (nums, lo, hi) => nums.every((n) => whole$2(n, lo, hi));
/** A total that is not an exact multiple of `per`, between lo and hi. */
function withRemainder(random, per, lo, hi) {
	for (let tries = 0; tries < 200; tries++) {
		const total = int$3(random, lo, hi);
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
		valid: (n) => n.length === 2 && n[0] > 0 && n[0] <= 100 && Math.round(n[0] * 10) === n[0] * 10 && whole$2(n[1], 1, 5e3),
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
		valid: (n) => n.length === 2 && whole$2(n[0], 1, 5e3) && n[1] >= 0 && n[1] <= 100 && Math.round(n[1] * 10) === n[1] * 10,
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
			if (random() < .5) return [1e3, int$3(random, 101, 999)];
			const first = int$3(random, 100, 499);
			return [
				1e3,
				first,
				int$3(random, 100, 999 - first)
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
			if (band === 4) return [int$3(random, 2, 6), int$3(random, 2, 6)];
			if (band === 5) return [int$3(random, 3, 12), int$3(random, 3, 12)];
			return [int$3(random, 6, 20), int$3(random, 5, 15)];
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
			if (band === 4) return [int$3(random, 2, 8), int$3(random, 2, 8)];
			if (band === 5) return [int$3(random, 3, 15), int$3(random, 3, 15)];
			return [int$3(random, 5, 25), int$3(random, 5, 25)];
		}
	},
	"share-whole": {
		topic: "division",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && whole$2(n[0], 0, 5e3) && whole$2(n[1], 1, 500),
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
				const per = int$3(random, 3, 9);
				return [withRemainder(random, per, 30, 99), per];
			}
			const per = int$3(random, 6, 12);
			return [withRemainder(random, per, 60, 199), per];
		}
	},
	"share-left": {
		topic: "division",
		bands: YEAR_BANDS,
		valid: (n) => n.length === 2 && whole$2(n[0], 0, 5e3) && whole$2(n[1], 1, 500),
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
		valid: (n) => n.length === 2 && whole$2(n[0], 1, 5e3) && whole$2(n[1], 1, 500),
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
				int$3(random, 2, 9),
				0,
				0
			];
			if (band === 5) return [
				int$3(random, 2, 12),
				int$3(random, 1, 6),
				0
			];
			return [
				int$3(random, 4, 20),
				int$3(random, 2, 10),
				int$3(random, 1, 6)
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
				int$3(random, 5, 35),
				int$3(random, 4, 25),
				int$3(random, 3, 20)
			];
			return [
				0,
				1e3,
				int$3(random, 100, 300),
				int$3(random, 100, 300),
				int$3(random, 100, 300)
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
				int$3(random, 2, 5),
				int$3(random, 2, 6)
			];
			if (band === 5) {
				const a = int$3(random, 2, 5);
				let b = int$3(random, 1, 9);
				if (b === a) b++;
				return [
					0,
					a,
					b,
					a * int$3(random, 2, 8)
				];
			}
			if (random() < .5) {
				const a = int$3(random, 1, 6);
				let b = int$3(random, 1, 7);
				if (b === a) b++;
				return [
					1,
					a,
					b,
					(a + b) * int$3(random, 3, 12)
				];
			}
			const a = int$3(random, 3, 8);
			let b = int$3(random, 2, 12);
			if (b === a) b++;
			return [
				0,
				a,
				b,
				a * int$3(random, 3, 12)
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
				const start = int$3(random, -10, 10);
				const change = int$3(random, -15, 15);
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
					const rateA = int$3(random, 5, 30);
					const rateB = int$3(random, 5, 30);
					const countA = int$3(random, 2, 6);
					const countB = int$3(random, 2, 6);
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
					const rateA = int$3(random, 10, 60);
					const rateB = int$3(random, 10, 60);
					const countA = int$3(random, 2, 10);
					const countB = int$3(random, 2, 10);
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
				const countA = int$3(random, 3, 12);
				const countB = int$3(random, 3, 12);
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
		valid: (n) => n.length >= 2 && n.length <= 8 && whole$2(n[0], 1, 1e3) && allWhole(n.slice(1), 1, 100),
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
				const level = int$3(random, 1, 9);
				return [10, ...Array.from({ length: int$3(random, 2, 3) }, () => level)];
			}
			if (band === 5) return [10, ...Array.from({ length: int$3(random, 2, 3) }, () => int$3(random, 2, 12))];
			return [10, ...Array.from({ length: int$3(random, 3, 4) }, () => int$3(random, 3, 18))];
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
			]), int$3(random, 2, band === 4 ? 10 : 12)];
		}
	}
};
/** Gold each kind of troop costs (the rule sheet's table; footmen 15, axemen 30, knights 60). */
const TROOP_COST = {
	footman: 15,
	axeman: 30,
	knight: 60
};
/** Which topic a kind belongs to. */
const topicOf = (kind) => KIND_DEFS[kind].topic;
/** The kinds that can be asked at a year band, optionally only from these topics. */
function kindsFor(band, topics = TOPICS$1) {
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
	enabledTopics: TOPICS$1.filter((t) => t !== "integers" && t !== "times"),
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
	const topics = Array.isArray(obj.enabledTopics) ? TOPICS$1.filter((t) => obj.enabledTopics.includes(t)) : DEFAULT_PRACTICAL_SETTINGS.enabledTopics;
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
	const topics = TOPICS$1.filter((t) => topicAvailable(settings, t));
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
	/** Percent added to monster supply prices (a fixed village tax). */
	shopTax: 10,
	/** Percent off an item when the Market's maths question is answered right. */
	shopDiscount: 10,
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
	/** Experience for a buff, debuff or tie-up spell that lands, before the depth boost (a heal earns by HP healed, like a hit by damage). */
	xpSupport: 2,
	/** When a fight ends, every member still standing gets at least this share of the standing members' average experience, so a healer keeps up with the hitters. */
	xpShare: .5,
	/** Experience: 30 to reach level 2, then 10 more for each level, but never more than this for one level. */
	xpLevelCap: 90,
	/** Experience: total needed to reach `level` (level 1 needs none). */
	xpToReach(level) {
		let total = 0;
		for (let l = 1; l < level; l++) total += Math.min(CONFIG.xpLevelCap, 30 + 10 * (l - 1));
		return total;
	},
	/** Mine depth hints, as depth minus the clan's average level (simulator, 27 Oct 2026, the smarter fight plan: a mixed clan wins 99% at -1, 94% at +1, 87% at +3, 84% at +4; an all-fighters clan 15-25 points fewer). */
	depthHint: {
		easyUpTo: -1,
		justRightUpTo: 1,
		toughUpTo: 3
	},
	/** The empire and "My Village". Every number is here. */
	empire: {
		/** Upgrades a clan may make a day, in total, across all its buildings. */
		buildsPerDay: 2,
		/** Builds not used pile up, up to this many extra (so at most buildsPerDay + this are available on one day). */
		buildsSavedMax: 4,
		/**
		* The eight buildings. `max` is the top level; going up to level n costs `base` times n gold, from the clan purse.
		* `per` is what each level does, in percent (or gold for the strongroom). The Training Hall, Smithy and Church keep their
		* old effects (trainCost, the shop and churchPerLevel/freeWakes read the level), so they have no `per`.
		*/
		buildings: {
			trainingHall: {
				max: 5,
				base: 50,
				per: 0
			},
			smithy: {
				max: 6,
				base: 50,
				per: 0
			},
			church: {
				max: 3,
				base: 50,
				per: 0
			},
			barracks: {
				max: 5,
				base: 50,
				per: 0
			},
			walls: {
				max: 5,
				base: 50,
				per: 10
			},
			tower: {
				max: 5,
				base: 50,
				per: 10
			},
			forge: {
				max: 5,
				base: 50,
				per: 10
			},
			strongroom: {
				max: 5,
				base: 50,
				per: 200
			}
		},
		/** The width of each building's plan; its length is the level plus `planLengthExtra` (the area and fence moment). */
		planWidth: {
			trainingHall: 4,
			smithy: 3,
			church: 4,
			barracks: 3,
			walls: 2,
			tower: 2,
			forge: 3,
			strongroom: 2
		},
		planLengthExtra: 2,
		/** Gold for one troop (the same numbers the troop-cost question uses). */
		troopCost: TROOP_COST,
		/** How many of each troop one level of Barracks holds. */
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
		battle: {
			/** Every battle is this many rounds and asks for this much loot (a percent); the only choice is the push. */
			rounds: 3,
			loot: 10,
			/** The most rounds `battle()` itself will play (a test or a sum may ask for more than the fixed 3). */
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
		},
		/** What the old (pre-village) empire cost, so `upgradeSave` can give the right gold back. Nothing else reads this. */
		legacy: {
			plotSide: {
				min: 2,
				max: 6
			},
			landPerSquare: 2,
			fencePerUnit: 1,
			/** Old building prices in gold, and the most of each a clan could have. */
			buildings: {
				barracks: {
					gold: 100,
					max: 12
				},
				walls: {
					gold: 40,
					max: 5
				},
				tower: {
					gold: 60,
					max: 5
				},
				steelMill: {
					gold: 120,
					max: 3
				},
				stables: {
					gold: 100,
					max: 3
				},
				gymnasium: {
					gold: 100,
					max: 2
				},
				developersHall: {
					gold: 150,
					max: 3
				}
			}
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
		/** A found item is this tier of the finder's line; if everyone already has that or better, the clan gets half its price in gold. */
		itemTier: 2
	},
	/**
	* The OLD class village (stage C.6 part A; no longer used by the game, kept so the SQL parity test and the old night job still have these numbers). The class built these with the village chest; building to level n costs
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
	/**
	* The season (5 weeks, days are 1-based: day 1 to `length`). From day `warnFrom` to the end (the "last two weeks")
	* raids on classmates rest. From day `monsterFrom` it is monster week (used later). Finishing the village earns `villageReward`.
	*/
	season: {
		length: 35,
		warnFrom: 22,
		monsterFrom: 29,
		villageReward: {
			fame: 50,
			points: 10
		}
	},
	/**
	* The season monster (part 2 of the season goals). One try a day in monster week. The village fights first (the siege knocks a
	* share off the monster's HP), then the four members fight it. Each lost try leaves it `tiredPerLoss` weaker, up to `tiredMax`.
	* Tuned with `npm run clans:sim -- --days 28 --empire 1 --monster 1 --play 4` (James, 28 Oct 2026: a strong clan should win about 40%
	* of its first tries). Simulator, 28 Oct 2026, first try / after 2 losses / after 4: a clan playing 4 days a week (about level 15,
	* village about 35 of 39) about 40% / 85% / 98%; every day (level 18 to 20, whole village) nearly always; 3 days a week (level 9) 0% / 0% / about 5%.
	*/
	monster: {
		/** HP before the siege and stats. Every monster shares them; only the big move differs. */
		hp: 1250,
		stats: {
			agility: 25,
			dexterity: 22,
			strength: 60,
			wisdom: 14,
			armor: 12,
			charisma: 0
		},
		/** Stats stop at `statCap`, so the monster's hits are multiplied by this instead (big moves too). Tiredness lowers it. */
		power: 1.5,
		/** Its gold and experience are worked out as if it lived at this mine depth. */
		depth: 12,
		/** A monster fight can last this many rounds; after that the monster stomps off for the night (a loss). */
		rounds: 12,
		/** Every this-many rounds the monster uses its big move, and warns the round before. */
		bigEvery: 3,
		/** The big moves' damage, as a multiple of a normal hit (boulder and icy breath on one member, slam on everyone). */
		boulder: 2.2,
		slam: .7,
		breath: 1,
		/** Each Walls level cuts the damage the monster does by this percent. */
		wallsCut: 4,
		/** Each lost try leaves the monster this share weaker (HP, strength), up to `tiredMax`. */
		tiredPerLoss: .1,
		tiredMax: .4,
		/** The siege: the army's share (full army of `fullMight`, more with the Forge), the tower's share per level, fire arrows, the maths. */
		siege: {
			armyShare: .22,
			fullMight: 300,
			towerShare: .03,
			arrowShare: .025,
			rightAnswer: 1.2,
			most: .6
		},
		/** A potion heals this share of a member's HP. */
		potionHeal: .5,
		/** Monster supplies (sold from day `warnFrom`): price before tax, and the most a clan can hold. */
		supplies: {
			arrows: {
				price: 900,
				max: 3
			},
			potions: {
				price: 1100,
				max: 4
			},
			net: {
				price: 1800,
				max: 1
			}
		},
		/** Beating the monster (the first time each season). */
		reward: {
			fame: 100,
			points: 10
		}
	},
	/** How much a Battle Cry answer adds. */
	battleCryDamage: 1.25,
	battleCryHeal: .2
};
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
const STATS = [
	"agility",
	"dexterity",
	"strength",
	"wisdom",
	"armor",
	"charisma"
];
/** The season monsters, in turn (season 1 the giant, 2 the golem, 3 the troll, then round again). */
const MONSTER_KINDS = [
	"giant",
	"golem",
	"troll"
];
const TROOP_KINDS = [
	"footman",
	"axeman",
	"knight"
];
/** The eight buildings of "My Village". Each has a level from 0 (not built) up to its own maximum. */
const VILLAGE_BUILDINGS = [
	"trainingHall",
	"smithy",
	"church",
	"barracks",
	"walls",
	"tower",
	"forge",
	"strongroom"
];
//#endregion
//#region shared/clans/empire.ts
/**
* The empire ("My Village"): eight buildings with levels, troops, six computer kingdoms, battles,
* Friendly War, and the rule for raids on classmates. Plain data and plain functions, like
* `fight.ts`: a battle is settled in one go from two armies, a battle plan and a seed, so the
* same inputs always give the same answer and the server can replay it.
*
* There is one purse, `clan.gold`: it pays for upgrades and troops, and a raider can take a share
* of it (the Strongroom keeps some safe). `empire.levels` is the truth about building levels;
* `clan.village` is only a copy of three of them, refreshed by `syncVillage`.
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
const noLevels = () => ({
	trainingHall: 0,
	smithy: 0,
	church: 0,
	barracks: 0,
	walls: 0,
	tower: 0,
	forge: 0,
	strongroom: 0
});
function newEmpire(day = 1) {
	return {
		version: 2,
		levels: noLevels(),
		buildsToday: 0,
		troops: noTroops(),
		day,
		createdDay: day,
		raidsToday: 0,
		kingdomRaidsToday: 0,
		shieldUntil: 0,
		raidedToday: []
	};
}
const BUILDING_NAMES = {
	trainingHall: "Training Hall",
	smithy: "Smithy",
	church: "Church",
	barracks: "Barracks",
	walls: "Walls",
	tower: "Tower",
	forge: "Forge",
	strongroom: "Strongroom"
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
/** True if this save still has to go through `upgradeSave` (an old empire, or none at all). */
const needsUpgrade = (clan) => clan.empire?.version !== 2;
const maxLevel = (b) => E.buildings[b].max;
const clampLevel = (b, n) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(maxLevel(b), Math.floor(n))) : 0;
/** Gold an old plot cost to develop, at full price (no Developer's Hall discount). */
const oldPlotPrice = (width, length) => width * length * E.legacy.landPerSquare + 2 * (width + length) * E.legacy.fencePerUnit;
/**
* Convert a saved clan to the "My Village" shape. Pure (the clan that comes in is not changed) and idempotent: a clan
* whose empire already has `version: 2` comes back as an unchanged copy, so a save is converted only once.
*
* - Vault gold goes into the purse.
* - Training Hall, Smithy and Church take the levels of the class (group) village passed in, or the clan's own `village` if none.
* - Barracks, Walls and Tower keep their count of buildings as a level, Steel Mills become the Forge, all capped at the top level.
* - Spare developed plots (no building) give back their develop price; Stables, Gymnasiums and Developer's Halls give back their gold price.
*   Wild and claimed land gives nothing.
* - Troops, the day, raid counts, shield and who was raided today are kept.
*/
function upgradeSave(clan, groupVillage) {
	const copy = structuredClone(clan);
	if (copy.empire?.version === 2) return copy;
	const old = copy.empire;
	const from = {
		...copy.village,
		...groupVillage ?? {}
	};
	const levels = noLevels();
	for (const b of [
		"trainingHall",
		"smithy",
		"church"
	]) levels[b] = clampLevel(b, from[b]);
	const e = newEmpire(old?.day ?? 1);
	if (old) {
		const count = (kind) => (old.plots ?? []).filter((p) => p.building === kind).length;
		let refund = Math.max(0, Math.floor(old.vault ?? 0));
		for (const [oldKind, b] of [
			["barracks", "barracks"],
			["walls", "walls"],
			["tower", "tower"],
			["steelMill", "forge"]
		]) {
			levels[b] = clampLevel(b, count(oldKind));
			refund += Math.max(0, count(oldKind) - levels[b]) * E.legacy.buildings[oldKind].gold;
		}
		for (const p of old.plots ?? []) if (!p.building) refund += oldPlotPrice(p.width, p.length);
		for (const kind of [
			"stables",
			"gymnasium",
			"developersHall"
		]) refund += count(kind) * E.legacy.buildings[kind].gold;
		copy.gold += refund;
		e.troops = {
			...noTroops(),
			...old.troops
		};
		e.createdDay = old.createdDay;
		e.raidsToday = old.raidsToday;
		e.kingdomRaidsToday = old.kingdomRaidsToday;
		e.shieldUntil = old.shieldUntil;
		e.raidedToday = [...old.raidedToday ?? []];
	}
	e.levels = levels;
	copy.empire = e;
	syncVillage(copy);
	return copy;
}
/** The clan's empire, made the first time it is needed. An old-shape empire is converted on the spot (using the clan's own `village`). */
function empireOf(clan) {
	if (!clan.empire || clan.empire.version !== 2) {
		const up = upgradeSave(clan);
		clan.gold = up.gold;
		clan.village = up.village;
		clan.empire = up.empire;
	}
	return clan.empire;
}
/** The level of one building. */
const levelOf = (clan, b) => empireOf(clan).levels[b];
/** Refresh `clan.village` (the copy of the Training Hall, Smithy and Church levels) from the empire. */
function syncVillage(clan) {
	const l = empireOf(clan).levels;
	clan.village = {
		trainingHall: l.trainingHall,
		smithy: l.smithy,
		church: l.church
	};
}
/** Gold to take `b` up to level `toLevel`: the base price times the level. */
const upgradeCost = (b, toLevel) => E.buildings[b].base * toLevel;
/** Builds left to use: today's that are not done yet, plus the saved ones. */
const buildsLeft = (e) => Math.max(0, E.buildsPerDay - e.buildsToday) + (e.buildsSaved ?? 0);
VILLAGE_BUILDINGS.reduce((t, b) => t + E.buildings[b].max, 0);
/** Can this building go up a level now, and what stops it? */
function canUpgrade(clan, b) {
	const e = empireOf(clan);
	if (!VILLAGE_BUILDINGS.includes(b)) return no$1("building", "Pick one of the buildings in your village.");
	const level = e.levels[b];
	if (level >= maxLevel(b)) return no$1("max", `The ${BUILDING_NAMES[b]} is already as big as it can be.`);
	if (buildsLeft(e) <= 0) return no$1("builds", "Your builders have done every job they can. They start again tomorrow!");
	const cost = upgradeCost(b, level + 1);
	if (clan.gold < cost) return no$1("gold", `The ${BUILDING_NAMES[b]} (level ${level + 1}) costs ${cost} gold and the clan has ${clan.gold}.`);
	return ok$1;
}
/** Pay for one level of a building from the purse. Uses one of today's builds first, a saved one only when today's are gone. */
function upgrade(clan, b) {
	const can = canUpgrade(clan, b);
	if (!can.ok) return can;
	const e = empireOf(clan);
	clan.gold -= upgradeCost(b, e.levels[b] + 1);
	e.levels[b]++;
	if (e.buildsToday < E.buildsPerDay) e.buildsToday++;
	else e.buildsSaved = Math.max(0, (e.buildsSaved ?? 0) - 1);
	syncVillage(clan);
	if (b === "barracks") joinFollowers(clan);
	return ok$1;
}
/** Gold raiders cannot take: 200 for each Strongroom level. */
const safeGold = (e) => e.levels.strongroom * E.buildings.strongroom.per;
const capacity = (e, kind) => e.levels.barracks * E.troopCap[kind];
const room = (e, kind) => Math.max(0, capacity(e, kind) - e.troops[kind]);
/** Buy troops from the purse, as far as the Barracks have room. */
function buyTroops(clan, kind, n) {
	const e = empireOf(clan);
	if (!Number.isInteger(n) || n < 1) return no$1("amount", "Pick how many to buy.");
	if (room(e, kind) < n) return no$1("room", `The barracks have room for ${room(e, kind)} more ${TROOP_NAMES[kind].many}.`);
	const cost = n * E.troopCost[kind];
	if (clan.gold < cost) return no$1("gold", `That costs ${cost} gold and the clan has ${clan.gold}.`);
	clan.gold -= cost;
	e.troops[kind] += n;
	return ok$1;
}
/**
* Followers join by themselves: as footmen, as far as the Barracks have room. The rest stay as followers
* (and join later, when there is room). Returns how many joined.
*/
function joinFollowers(clan) {
	const e = empireOf(clan);
	const joined = Math.min(Math.max(0, clan.followers), room(e, "footman"));
	e.troops.footman += joined;
	clan.followers -= joined;
	return joined;
}
/**
* A new day for the empire: fresh builds and raids. Builds not used (today's, and a full set for each day `missedDays` skipped)
* are saved, up to `buildsSavedMax`. (A shield ends by itself when the day number passes it.)
*/
function empireNewDay(clan, missedDays = 0) {
	const e = empireOf(clan);
	e.day++;
	const unused = Math.max(0, E.buildsPerDay - e.buildsToday) + Math.max(0, missedDays) * E.buildsPerDay;
	e.buildsSaved = Math.min(E.buildsSavedMax, (e.buildsSaved ?? 0) + unused);
	e.buildsToday = 0;
	e.raidsToday = 0;
	e.kingdomRaidsToday = 0;
	e.raidedToday = [];
}
/** What an army is worth in a battle: footmen 1, axemen 2, knights 4. */
const might = (t) => TROOP_KINDS.reduce((s, k) => s + t[k] * E.troopMight[k], 0);
const sideOf = (e) => ({
	troops: { ...e.troops },
	walls: e.levels.walls,
	towers: e.levels.tower,
	forge: e.levels.forge
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
	forge: 0
});
const PUSHES = Object.keys(E.battle.push);
/** The plan a raid or Friendly War plays: the child's push, 3 rounds, 10% loot. */
const fixedPlan = (push) => ({
	rounds: E.battle.rounds,
	push,
	loot: E.battle.loot
});
/** A plan with every part forced into what is allowed. */
function cleanPlan(plan, lootMax = Math.max(...E.battle.lootChoices)) {
	const rounds = Math.min(E.battle.maxRounds, Math.max(1, Math.round(plan.rounds ?? E.battle.rounds)));
	const push = plan.push && PUSHES.includes(plan.push) ? plan.push : "steady";
	const choices = E.battle.lootChoices.filter((c) => c <= lootMax);
	const asked = plan.loot ?? choices[0];
	return {
		rounds,
		push,
		loot: [...choices].reverse().find((c) => c <= asked) ?? choices[0]
	};
}
function lost(troops, start, left) {
	const hurt = start > 0 ? (start - left) / start : 0;
	const out = noTroops();
	for (const k of TROOP_KINDS) out[k] = Math.min(troops[k], Math.floor(troops[k] * hurt * E.battle.lossShare));
	return out;
}
/**
* Settle a whole battle. Each round both sides lose about a quarter of what they have left, a
* little more or less by luck. The Forge adds to the attacker's damage, each Walls level cuts the damage the
* defender takes by 10%, the Tower adds to the defender's; asking for more loot makes the defenders fight
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
		const outA = (1 + attacker.forge * E.buildings.forge.per / 100) * push.hit;
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
		attackerLost: lost(attacker.troops, startA, a),
		defenderLost: lost(defender.troops, startD, d)
	};
}
function takeLosses(e, lostTroops) {
	for (const k of TROOP_KINDS) e.troops[k] -= lostTroops[k];
}
/** Gold a raid takes from a treasury: the share asked for, rounded up like every "percent of" question, never more than there is. */
const lootGold = (treasury, percent) => Math.min(treasury, Math.ceil(treasury * percent / 100));
/** Raid a computer kingdom: your army fights, you lose the troops that do not come home, and a win takes loot into the purse. */
function raidKingdom(clan, kingdomId, push, seed) {
	const e = empireOf(clan);
	const k = kingdomById(kingdomId);
	if (!k) return no$1("kingdom", "Pick one of the six kingdoms.");
	if (might(e.troops) === 0) return no$1("army", "You need some troops to send.");
	if (e.kingdomRaidsToday >= E.raids.kingdomPerDay) return no$1("limit", `You have already raided ${E.raids.kingdomPerDay} times today. Try again tomorrow, or have a Friendly War.`);
	const result = battle(sideOf(e), kingdomSide(k), fixedPlan(push), seed);
	e.kingdomRaidsToday++;
	takeLosses(e, result.attackerLost);
	const gold = result.outcome === "won" ? lootGold(k.treasury, result.plan.loot) : 0;
	clan.gold += gold;
	return {
		ok: true,
		result,
		gold
	};
}
/** Friendly War: the same battle, but nobody loses or wins anything, and it does not count as a raid. */
function friendlyWar(e, kingdomId, push, seed) {
	const k = kingdomById(kingdomId);
	if (!k) return no$1("kingdom", "Pick one of the six kingdoms.");
	if (might(e.troops) === 0) return no$1("army", "You need some troops to send.");
	return {
		ok: true,
		result: battle(sideOf(e), kingdomSide(k), fixedPlan(push), seed)
	};
}
const TAKES = ["gold", "buildings"];
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
		say: "You cannot raid your own village."
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
	return `A raider from the ${raiderClan} clan knocked ${raid.destroyed.length} ${raid.destroyed.length === 1 ? "level" : "levels"} off the buildings.`;
}
/** Buildings a raid may damage: everything except the Walls and the Strongroom. */
const RAIDABLE = VILLAGE_BUILDINGS.filter((b) => b !== "walls" && b !== "strongroom" && b !== "barracks");
/** All the levels of all the buildings added up (what "10% of the buildings" is worked out from). */
const levelTotal = (e) => VILLAGE_BUILDINGS.reduce((t, b) => t + e.levels[b], 0);
/**
* Raid a classmate. The defender is a saved copy played by the computer (same battle, steady
* defence). Loot is 10%. A win takes gold (10% of the purse above the Strongroom's safe gold) or knocks levels off
* buildings (10% of all the levels, rounded up, less one for each Walls level; never the Walls or the Strongroom).
* Both sides lose the troops that do not come home, and the defender gets a shield. Both purses are in the parties.
*/
function raidClassmate(attacker, defender, take, push, seed, today, raidsOn = true) {
	const refused = raidRefusal(attacker, defender, today, raidsOn);
	if (refused) return {
		ok: false,
		...refused
	};
	if (!TAKES.includes(take)) return no$1("take", "Pick gold or buildings.");
	const a = attacker.empire;
	const d = defender.empire;
	const plan = cleanPlan(fixedPlan(push), E.raids.classmateLootMax);
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
		destroyed: []
	};
	if (result.outcome === "won") {
		if (take === "gold") {
			out.gold = lootGold(Math.max(0, defender.gold - safeGold(d)), plan.loot);
			defender.gold -= out.gold;
			attacker.gold += out.gold;
		} else {
			const count = Math.max(0, Math.ceil(levelTotal(d) * plan.loot / 100) - d.levels.walls);
			for (let i = 0; i < count; i++) {
				const hit = RAIDABLE.filter((b) => d.levels[b] > 0);
				if (hit.length === 0) break;
				const b = hit[roll(dice, hit.length)];
				d.levels[b]--;
				out.destroyed.push(b);
			}
		}
	}
	return {
		ok: true,
		...out
	};
}
//#endregion
//#region shared/clans/items.ts
/** Gold for each tier (index 0 is tier 1, which every member starts with). Round tens, so 10% off is always whole. */
const TIER_PRICES = {
	weapon: [
		0,
		20,
		50,
		90,
		160,
		260,
		450
	],
	armor: [
		0,
		20,
		40,
		70,
		120,
		200
	],
	shield: [
		0,
		20,
		40,
		70,
		120,
		200
	]
};
/** How much a stat grows tier by tier (index 0 is tier 1; index 6 is only used by the top weapons). */
const LADDERS = {
	/** A fighter's weapon strength. */
	big: [
		2,
		4,
		7,
		10,
		14,
		18,
		22
	],
	/** A quick fighter's weapon dexterity. */
	quick: [
		2,
		4,
		6,
		8,
		10,
		12,
		15
	],
	/** A spell caster's weapon wisdom. */
	magic: [
		2,
		4,
		6,
		9,
		12,
		15,
		18
	],
	/** Main armour. */
	mid: [
		1,
		2,
		3,
		5,
		6,
		8,
		10
	],
	/** A shield's armour. */
	guard: [
		1,
		2,
		2,
		3,
		4,
		5,
		6
	],
	/** Light armour's agility, a robe's wisdom. */
	light: [
		1,
		2,
		3,
		4,
		5,
		6,
		8
	],
	/** The helpful extra. */
	small: [
		1,
		1,
		2,
		2,
		3,
		3,
		4
	],
	/** A quick fighter's weapon strength (damage still comes from strength). */
	edge: [
		1,
		1,
		2,
		4,
		6,
		8,
		8
	],
	hp: [
		0,
		2,
		4,
		5,
		7,
		8,
		10
	],
	sp: [
		1,
		2,
		3,
		4,
		5,
		6,
		8
	]
};
const LINES = {
	Barbarian: {
		weapons: [
			"Knobbly Club",
			"Stone Hammer",
			"Hand Axe",
			"Bear Axe",
			"Battle Axe",
			"Thunder Axe",
			"Great Axe"
		],
		weapon: {
			strength: "big",
			dexterity: "small"
		},
		top: {
			armor: 2,
			hp: 6
		},
		armours: [
			"Rags",
			"Fur Wrap",
			"Hide Armour",
			"Bone Armour",
			"Wolf Pelt Armour",
			"Mammoth Hide"
		],
		armor: {
			armor: "mid",
			hp: "hp"
		},
		offhands: [
			"Hide Shield",
			"Wooden Shield",
			"Bone Shield",
			"Spiked Shield",
			"Tusk Shield",
			"Mammoth Shield"
		],
		shield: {
			armor: "guard",
			hp: "small"
		},
		offhandWord: "Shield"
	},
	Warrior: {
		weapons: [
			"Shortsword",
			"Mace",
			"Broadsword",
			"Silver Mace",
			"Morning Star",
			"Champion's Sword",
			"Sky Sword"
		],
		weapon: {
			strength: "big",
			dexterity: "small"
		},
		top: { agility: 4 },
		armours: [
			"Padded Jacket",
			"Leather Armour",
			"Wooden Armour",
			"Chainmail Armour",
			"Platemail Armour",
			"Champion's Plate"
		],
		armor: {
			armor: "mid",
			agility: "small"
		},
		offhands: [
			"Round Shield",
			"Iron Shield",
			"Platinum Shield",
			"Lion's Shield",
			"Crystal Shield",
			"Champion's Shield"
		],
		shield: {
			armor: "guard",
			agility: "small"
		},
		offhandWord: "Shield"
	},
	Knight: {
		weapons: [
			"Iron Sword",
			"Knight's Mace",
			"Long Sword",
			"Lance",
			"Silver Sword",
			"Royal Sword",
			"Falcon's Sword"
		],
		weapon: {
			strength: "big",
			dexterity: "small"
		},
		top: {
			charisma: 4,
			armor: 2
		},
		armours: [
			"Quilted Coat",
			"Ring Mail",
			"Scale Mail",
			"Knight's Plate",
			"Royal Plate",
			"Hero's Armour"
		],
		armor: {
			armor: "mid",
			hp: "hp"
		},
		offhands: [
			"Kite Shield",
			"Banner Shield",
			"Tower Shield",
			"Silver Shield",
			"Royal Shield",
			"Hero's Shield"
		],
		shield: {
			armor: "guard",
			charisma: "small"
		},
		offhandWord: "Shield"
	},
	"Martial Artist": {
		weapons: [
			"Hand Wraps",
			"Bo Staff",
			"Nunchaku",
			"Iron Fists",
			"Tiger Claws",
			"Jade Staff",
			"Dragon Fist Wraps"
		],
		weapon: {
			dexterity: "quick",
			strength: "edge"
		},
		top: {
			agility: 4,
			sp: 4
		},
		armours: [
			"Cloth Tunic",
			"Training Gi",
			"Kai Tunic",
			"Black Belt Gi",
			"Tiger Gi",
			"Master's Gi"
		],
		armor: {
			agility: "light",
			sp: "small"
		},
		offhands: [
			"Cloth Bracers",
			"Leather Bracers",
			"Iron Bracers",
			"Jade Bracers",
			"Tiger Bracers",
			"Dragon Bracers"
		],
		shield: {
			agility: "small",
			dexterity: "small",
			sp: "sp"
		},
		offhandWord: "Bracers"
	},
	Assassin: {
		weapons: [
			"Dagger",
			"Twin Daggers",
			"Hooked Blade",
			"Scythe",
			"Night Blade",
			"Moon Dagger",
			"Shadow Fang"
		],
		weapon: {
			dexterity: "quick",
			strength: "edge"
		},
		top: { agility: 4 },
		armours: [
			"Grey Hood",
			"Leather Vest",
			"Night Leathers",
			"Shadow Cloak",
			"Silent Leathers",
			"Midnight Cloak"
		],
		armor: {
			agility: "light",
			armor: "small"
		},
		offhands: [
			"Leather Gloves",
			"Throwing Stars",
			"Hooked Gloves",
			"Smoke Bombs",
			"Shadow Gloves",
			"Night Gloves"
		],
		shield: {
			agility: "small",
			dexterity: "small",
			sp: "sp"
		},
		offhandWord: "Gloves"
	},
	Pirate: {
		weapons: [
			"Cutlass",
			"Boarding Axe",
			"Sabre",
			"Boomerang",
			"Sea Sabre",
			"Coral Cutlass",
			"Storm Cutlass"
		],
		weapon: {
			dexterity: "quick",
			strength: "edge"
		},
		top: {
			charisma: 4,
			hp: 4
		},
		armours: [
			"Striped Shirt",
			"Sea Coat",
			"Captain's Vest",
			"Leather Longcoat",
			"Admiral's Coat",
			"Storm Coat"
		],
		armor: {
			agility: "light",
			hp: "hp"
		},
		offhands: [
			"Wooden Buckler",
			"Brass Buckler",
			"Ship's Buckler",
			"Anchor Buckler",
			"Captain's Buckler",
			"Storm Buckler"
		],
		shield: {
			agility: "light",
			charisma: "small"
		},
		offhandWord: "Buckler"
	},
	Samurai: {
		weapons: [
			"Wooden Sword",
			"Short Blade",
			"Curved Sword",
			"Steel Blade",
			"Crane Blade",
			"Moon Blade",
			"Dawn Blade"
		],
		weapon: {
			dexterity: "quick",
			strength: "edge"
		},
		top: { sp: 3 },
		armours: [
			"Padded Robe",
			"Bamboo Armour",
			"Lacquered Armour",
			"Plated Robe",
			"Crane Armour",
			"Moon Armour"
		],
		armor: {
			agility: "light",
			armor: "small"
		},
		offhands: [
			"Paper Fan",
			"War Fan",
			"Iron Fan",
			"Crane Fan",
			"Steel Fan",
			"Moon Fan"
		],
		shield: {
			dexterity: "small",
			agility: "small",
			sp: "sp"
		},
		offhandWord: "Fan"
	},
	Healer: {
		weapons: [
			"Staff",
			"Willow Rod",
			"Ash Staff",
			"Silver Sceptre",
			"Light Staff",
			"Crystal Sceptre",
			"Sunrise Sceptre"
		],
		weapon: {
			wisdom: "magic",
			sp: "sp"
		},
		top: { sp: 2 },
		armours: [
			"Cloth Robe",
			"Linen Robe",
			"White Robe",
			"Silver Robe",
			"Dawn Robe",
			"Sunlight Robe"
		],
		armor: {
			wisdom: "light",
			armor: "small",
			hp: "small"
		},
		offhands: [
			"Herb Pouch",
			"Lucky Charm",
			"Book of Herbs",
			"Sun Charm",
			"Healing Orb",
			"Golden Sun Charm"
		],
		shield: {
			sp: "sp",
			wisdom: "small",
			charisma: "small"
		},
		offhandWord: "Charm"
	},
	Sorcerer: {
		weapons: [
			"Wand",
			"Spark Wand",
			"Flame Staff",
			"Crystal Wand",
			"Blaze Staff",
			"Inferno Staff",
			"Ember Rod"
		],
		weapon: {
			wisdom: "magic",
			sp: "sp"
		},
		top: { wisdom: 1 },
		armours: [
			"Grey Robe",
			"Red Robe",
			"Ember Robe",
			"Flame Robe",
			"Phoenix Robe",
			"Firestorm Robe"
		],
		armor: {
			wisdom: "light",
			armor: "small",
			hp: "small"
		},
		offhands: [
			"Ember Stone",
			"Spark Charm",
			"Flame Orb",
			"Book of Fire",
			"Phoenix Feather",
			"Sun Orb"
		],
		shield: {
			sp: "sp",
			wisdom: "small",
			charisma: "small"
		},
		offhandWord: "Charm"
	},
	Necromancer: {
		weapons: [
			"Bone Wand",
			"Raven Staff",
			"Moonstone Wand",
			"Shadow Staff",
			"Ghost Staff",
			"Night Sceptre",
			"Moonbone Staff"
		],
		weapon: {
			wisdom: "magic",
			sp: "sp"
		},
		top: { hp: 4 },
		armours: [
			"Dark Robe",
			"Raven Robe",
			"Shadow Robe",
			"Moonlit Robe",
			"Ghostly Robe",
			"Midnight Robe"
		],
		armor: {
			wisdom: "light",
			armor: "small",
			hp: "small"
		},
		offhands: [
			"Raven Feather",
			"Candle Lantern",
			"Spirit Book",
			"Moonstone",
			"Ghost Lantern",
			"Night Orb"
		],
		shield: {
			sp: "sp",
			wisdom: "small",
			charisma: "small"
		},
		offhandWord: "Charm"
	},
	Wizard: {
		weapons: [
			"Apprentice Wand",
			"Oak Staff",
			"Rune Wand",
			"Wizard's Staff",
			"Star Wand",
			"Star Staff",
			"Starfall Staff"
		],
		weapon: {
			wisdom: "magic",
			sp: "sp"
		},
		top: { hp: 4 },
		armours: [
			"Apprentice Robe",
			"Wool Robe",
			"Blue Robe",
			"Rune Robe",
			"Mage Robe",
			"Star Robe"
		],
		armor: {
			wisdom: "light",
			armor: "small",
			hp: "hp"
		},
		offhands: [
			"Spell Book",
			"Crystal Orb",
			"Rune Tome",
			"Moon Orb",
			"Star Charm",
			"Book of Stars"
		],
		shield: {
			sp: "sp",
			wisdom: "small",
			charisma: "small"
		},
		offhandWord: "Charm"
	}
};
function makeItem(cls, kind, name, tier, gives, top = {}) {
	const bonus = {};
	for (const [stat, ladder] of Object.entries(gives)) {
		const v = LADDERS[ladder][tier - 1];
		if (v) bonus[stat] = v;
	}
	for (const [stat, v] of Object.entries(top)) bonus[stat] = (bonus[stat] ?? 0) + v;
	return {
		name,
		kind,
		cls,
		tier,
		price: TIER_PRICES[kind][tier - 1],
		bonus
	};
}
const ITEMS$1 = Object.entries(LINES).flatMap(([cls, line]) => [
	...line.weapons.map((n, i) => makeItem(cls, "weapon", n, i + 1, line.weapon, i === line.weapons.length - 1 ? line.top : {})),
	...line.armours.map((n, i) => makeItem(cls, "armor", n, i + 1, line.armor)),
	...line.offhands.map((n, i) => makeItem(cls, "shield", n, i + 1, line.shield))
]);
/** The item at a tier of a class's line (undefined past the top). */
const itemAt = (cls, kind, tier) => ITEMS$1.find((i) => i.cls === cls && i.kind === kind && i.tier === tier);
/**
* The highest tier the Smithy sells at each level, 0 to 6. Tier 2 is on sale from the start (everyone already has tier 1),
* each level adds one more, and the class's own top weapon (tier 7) needs a fully built Smithy.
*/
const SMITHY_TIERS = [
	2,
	3,
	4,
	5,
	6,
	6,
	7
];
const unlockedTier = (smithy) => SMITHY_TIERS[Math.max(0, Math.min(SMITHY_TIERS.length - 1, smithy))];
/** The Smithy level that first sells a tier. */
const smithyFor = (tier) => Math.max(0, SMITHY_TIERS.findIndex((t) => t >= tier));
/**
* The tier each item from before the class lines counts as, from its old price. Only the one-off gear conversion
* (`refreshGear`) reads it.
*/
const OLD_ITEM_TIERS = {
	"Knobbly Club": 1,
	Staff: 1,
	Dagger: 2,
	Wand: 2,
	Mace: 3,
	Axe: 3,
	"Great Axe": 3,
	Shortsword: 3,
	Scythe: 3,
	"Silver Mace": 3,
	Broadsword: 3,
	"Battle Axe": 3,
	"Morning Star": 4,
	"Wizard's Staff": 4,
	Boomerang: 4,
	"Thunder Axe": 4,
	"Moon Blade": 5,
	"Falcon's Sword": 5,
	"Sky Sword": 6,
	Rags: 1,
	"Cloth Robe": 1,
	"Leather Armor": 2,
	"Wooden Armor": 2,
	"Cloth Tunic": 2,
	"Chainmail Armor": 3,
	"Platemail Armor": 3,
	"Kai Tunic": 3,
	"Hero's Armor": 5,
	"Wooden Shield": 1,
	"Iron Shield": 2,
	"Platinum Shield": 3,
	"Crystal Shield": 3,
	"Lion's Shield": 3,
	"Hero's Shield": 5
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
		"name": "Horse Archer",
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
//#region shared/clans/character.ts
/** Making and growing clan members: rolling stats, gear, levels, training, the Church and the shop. */
const GEAR_KINDS = [
	"weapon",
	"armor",
	"shield"
];
const raceByName = (name) => RACES.find((r) => r.name === name);
const classByName = (name) => CLASSES.find((c) => c.name === name);
const itemByName = (name) => ITEMS$1.find((i) => i.name === name);
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
* Every member starts wearing tier 1 of their class's line in each slot.
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
	const m = {
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
	for (const kind of GEAR_KINDS) {
		const first = itemAt(cls, kind, 1);
		if (first) wear(m, first);
	}
	return m;
}
/** What a member fights with: base stats plus their gear. */
function fightStats(m) {
	const out = { ...m.stats };
	for (const name of [
		m.gear.weapon,
		m.gear.armor,
		m.gear.shield
	]) {
		const bonus = name ? itemByName(name)?.bonus ?? {} : {};
		for (const s of STATS) out[s] = clamp(out[s] + (bonus[s] ?? 0), 0, CONFIG.statCap);
	}
	return out;
}
/** The member's item in a slot, if it is one the shop knows. */
const wornItem = (m, kind) => m.gear[kind] ? itemByName(m.gear[kind]) : void 0;
/** The tier the member wears in a slot (0 if nothing, or something from another class's line). */
function wornTier(m, kind) {
	const item = wornItem(m, kind);
	return item && item.cls === m.cls ? item.tier : 0;
}
/** Put an item on (swapping out what was there). Its HP and SP move the member's max HP and SP. */
function wear(m, item) {
	const old = wornItem(m, item.kind)?.bonus ?? {};
	const hp = (item.bonus.hp ?? 0) - (old.hp ?? 0);
	const sp = (item.bonus.sp ?? 0) - (old.sp ?? 0);
	m.maxHp = Math.max(1, m.maxHp + hp);
	m.maxSp = Math.max(0, m.maxSp + sp);
	if (!m.knockedOut) m.hp = clamp(m.hp + hp, 1, m.maxHp);
	m.sp = clamp(m.sp + sp, 0, m.maxSp);
	m.gear[item.kind] = item.name;
}
/**
* Keep every member's gear on their own class's line. A save from before the class lines (no `gearVersion`) has each old
* item swapped for the same slot's item in the member's line at the tier its old price was worth. After that, an item from
* another class's line (a member who picked a new class) becomes the same tier of their own, and an empty slot gets tier 1.
* Returns true if anything changed.
*/
function refreshGear(clan) {
	let changed = false;
	const old = clan.gearVersion !== 2;
	for (const m of clan.members) for (const kind of GEAR_KINDS) {
		const name = m.gear[kind];
		const item = name ? itemByName(name) : void 0;
		if (!old && item && item.cls === m.cls) continue;
		const tier = old ? name ? OLD_ITEM_TIERS[name] ?? item?.tier ?? 1 : 1 : item?.tier ?? 1;
		const fresh = itemAt(m.cls, kind, tier) ?? itemAt(m.cls, kind, 1);
		if (!fresh) continue;
		if (old && item) delete m.gear[kind];
		if (fresh.name !== m.gear[kind]) {
			wear(m, fresh);
			changed = true;
		}
	}
	if (old) {
		clan.gearVersion = 2;
		changed = true;
	}
	return changed;
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
const freeWakes = (clan) => CONFIG.freeWakesPerDay + levelOf(clan, "church");
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
/** What an item costs: its price, or 10% less with the discount (the Market's maths question answered right). */
const shopPrice = (item, discount = false) => discount ? item.price - Math.round(item.price * CONFIG.shopDiscount / 100) : item.price;
/** Why this member can't buy this item now, or null if they can (gold aside). */
function cannotBuy(clan, m, item) {
	if (item.cls !== m.cls) return `That is for a ${item.cls}, and ${m.name} is a ${m.cls}.`;
	if (item.tier <= wornTier(m, item.kind)) return `${m.name} already has something as good.`;
	if (item.tier > unlockedTier(levelOf(clan, "smithy"))) return `The Smithy needs to be level ${smithyFor(item.tier)} to sell that.`;
	return null;
}
function buy(clan, m, item, discount = false) {
	const price = shopPrice(item, discount);
	if (clan.gold < price || cannotBuy(clan, m, item)) return false;
	clan.gold -= price;
	wear(m, item);
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
* dexterity beats agility, damage from half strength minus armour, experience per hit. Healers
* earn too: by HP healed, a little for each buff, debuff or tie-up that lands, and a share of the
* team's experience for still standing at the end.
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
/** The most rounds a fight lasts: a monster fight has its own. */
const maxRoundsOf = (s) => s.monster?.rounds ?? CONFIG.maxRounds;
const team = (s, side) => side === "clan" ? s.clan : s.enemies;
const foes = (s, f) => team(s, f.side === "clan" ? "enemy" : "clan");
const friends = (s, f) => team(s, f.side);
/** Experience for a clan member, with the deep-mine boost. */
function earn(s, who, base) {
	if (who.side === "clan") s.xp[who.index] += Math.round(base * (1 + Math.max(0, s.depth - CONFIG.xpBoostFrom) * CONFIG.xpDepthBoost));
}
function hurt(s, attacker, target, damage) {
	if (target.guarding) damage = Math.max(1, Math.ceil(damage / 2));
	damage = Math.min(damage, target.hp);
	target.hp -= damage;
	if (attacker.side === "clan") earn(s, attacker, Math.floor(damage / 3) + 1);
	if (target.hp <= 0) {
		s.log.push({
			type: "down",
			who: target.name
		});
		if (target.side === "enemy") s.gold += Math.round((target.difficulty * (20 + roll(s, 10)) + 50 + roll(s, 20)) / 10);
	}
	return damage;
}
/** In a monster fight the Walls take a share off every hit the monster does. */
const cutByWalls = (s, who, dmg) => s.monster && who.side === "enemy" ? Math.max(1, Math.ceil(dmg * (100 - s.monster.wallsCut) / 100)) : dmg;
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
	if (s.monster && who.side === "enemy") dmg = Math.floor(dmg * CONFIG.monster.power);
	dmg = cutByWalls(s, who, Math.max(1, dmg - stat(target, "armor")));
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
		const healed = Math.min(target.maxHp - target.hp, amount);
		target.hp += healed;
		if (healed > 0) earn(s, who, Math.floor(healed / 3) + 1);
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
		earn(s, who, CONFIG.xpSupport);
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
		earn(s, who, CONFIG.xpSupport);
		s.log.push({
			type: "cast",
			who: who.name,
			spell: spell.name,
			target: target.name,
			amount: spell.mod.amount
		});
	}
}
function pick$2(s, list) {
	const live = list.filter(alive);
	return live.length ? live[roll(s, live.length)] : void 0;
}
/** A hit that cannot miss, `times` a normal hit (a monster's big move). */
function smash(s, who, target, times) {
	const dmg = Math.floor(Math.floor(stat(who, "strength") / 2) * (80 + roll(s, 40)) * times * CONFIG.monster.power / 100);
	const done = hurt(s, who, target, cutByWalls(s, who, Math.max(1, dmg - stat(target, "armor"))));
	s.log.push({
		type: "hit",
		who: who.name,
		target: target.name,
		damage: done
	});
}
/** Is round `round` a monster fight's big-move round? */
const bigMoveRound = (round) => round > 0 && round % CONFIG.monster.bigEvery === 0;
/** The monster's turn: a stomp on two members, or every third round its big move (which the giant net stops once). */
function monsterTurn(s, who, m, cry) {
	const M = CONFIG.monster;
	if (bigMoveRound(s.round)) {
		if (m.net) {
			m.net = false;
			s.log.push({
				type: "net",
				who: who.name
			});
			return;
		}
		s.log.push({
			type: "big",
			who: who.name,
			move: m.kind
		});
		if (m.kind === "golem") {
			for (const t of s.clan.filter(alive)) smash(s, who, t, M.slam);
			return;
		}
		const target = pick$2(s, s.clan);
		if (!target) return;
		smash(s, who, target, m.kind === "giant" ? M.boulder : M.breath);
		if (m.kind === "troll" && alive(target)) {
			target.tied = 1;
			s.log.push({
				type: "tied",
				who: target.name
			});
		}
		return;
	}
	const first = pick$2(s, s.clan);
	if (!first) return;
	attack(s, who, first, cry);
	const rest = s.clan.filter((f) => alive(f) && f !== first);
	if (rest.length) attack(s, who, rest[roll(s, rest.length)], cry);
}
/** What an enemy does with its turn. */
function enemyTurn(s, who, cry) {
	if (s.monster) return monsterTurn(s, who, s.monster, cry);
	const spells = who.spells.map((id) => SPELLS[id]).filter((sp) => !!sp && canCast(who, sp.id));
	if (spells.length && roll(s, 3) === 0) {
		const spell = spells[roll(s, spells.length)];
		const target = spell.friendly ? friends(s, who).filter(alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] : pick$2(s, foes(s, who));
		if (target) return cast(s, who, spell, target);
	}
	const target = pick$2(s, foes(s, who));
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
	if (o.action === "potion") {
		const target = s.clan[o.target];
		if (s.monster && s.monster.potions > 0 && target && alive(target)) {
			s.monster.potions--;
			const amount = Math.min(target.maxHp - target.hp, Math.ceil(target.maxHp * CONFIG.monster.potionHeal));
			target.hp += amount;
			s.log.push({
				type: "potion",
				who: who.name,
				target: target.name,
				amount
			});
			return;
		}
		o = fallback();
	}
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
/** The end of a fight: everyone still standing gets at least `xpShare` of the standing members' average experience. */
function shareXp(s) {
	const standing = s.clan.filter(alive);
	if (!standing.length) return;
	const floor = Math.ceil(standing.reduce((t, f) => t + s.xp[f.index], 0) / standing.length * CONFIG.xpShare);
	for (const f of standing) s.xp[f.index] = Math.max(s.xp[f.index], floor);
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
	else if (!s.result && s.round >= maxRoundsOf(s)) s.result = "timeout";
	if (s.result) shareXp(s);
	if (!s.result && s.monster && bigMoveRound(s.round + 1) && s.enemies[0] && alive(s.enemies[0])) s.log.push({
		type: "warn",
		who: s.enemies[0].name,
		move: s.monster.kind
	});
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
/** Does this fight ask ladder questions? */
const isLadderFight = (maths) => Array.isArray(maths.questions);
/** Plain settings mean an old-style fight. */
const asMaths = (maths) => "enabledTopics" in maths ? { settings: maths } : maths;
/** The question the clan faces before `round` of a fight started from `seed`. Null if the teacher has every topic off. */
function cryQuestion(seed, round, settings) {
	const dice = { rng: Math.imul(seed | 0, 2654435761) ^ Math.imul(round + 1, 2246822507) };
	nextFloat(dice);
	nextFloat(dice);
	return pickQuestion(settings, () => nextFloat(dice));
}
/** The question for the round about to be played. */
const nextCryQuestion = (state, settings) => cryQuestion(state.seed, state.round + 1, settings);
/**
* A ladder fight's Battle Cry for `round`: the bonus counts only if the server marked an answer for this round, it was
* right, and it is the answer the round says was given. "No thanks" (or no question that round) is a normal round.
*/
function markLadderCry(maths, round, given) {
	if (!!!maths.questions?.[round - 1] || !given) return {
		answered: false,
		correct: false,
		cry: null,
		question: null
	};
	const mark = maths.marks?.[round - 1];
	const correct = !!mark && mark.correct && given.answer === mark.answer;
	return {
		answered: true,
		correct,
		cry: correct ? given.reward : null,
		question: null
	};
}
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
function playCryRound(state, fightMaths, orders, given) {
	if (state.result) return {
		answered: false,
		correct: false,
		cry: null,
		question: null
	};
	const maths = asMaths(fightMaths);
	const result = isLadderFight(maths) ? markLadderCry(maths, state.round + 1, given) : markCry(nextCryQuestion(state, maths.settings), given);
	playRound(state, orders, result.cry);
	return result;
}
/** Replay a whole recorded fight from its seed. The server uses this to check what the browser reports. */
function replayFight(members, depth, seed, boss, rounds, maths, first) {
	const state = first ? structuredClone(first) : newFight(members, depth, seed, boss);
	const cries = [];
	for (const r of rounds) {
		if (state.result) break;
		cries.push(playCryRound(state, maths, r.orders, r.cry));
	}
	return {
		state,
		cries
	};
}
/** The key a question kind is kept under in the teacher's private maths records: the kind and the year band, never the numbers. */
const factKey$1 = (band, kind) => `clan:y${band}:${kind}`;
/** The pack Clan Quest's answers are kept in (the same table Gem Keep and Dragon Maths use). */
const FACT_PACK = "clan-quest";
/** The server cannot know how long a child took, so every answer is kept as a slow one: it counts as tried and right, never as "fluent". */
const UNTIMED_MS = 6e4;
//#endregion
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
const int$2 = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
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
			int$2(r, 0, 4)
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
		"add:tens": kind("add:tens", "Adding tens (40 + 30)", "add-tens", (r) => [int$2(r, 1, 9) * 10, int$2(r, 1, 9) * 10], (a, b) => a % 10 === 0 && b % 10 === 0 && a >= 10 && a <= 90 && b >= 10 && b <= 90, (a, b) => sum(a, b, { wrong: [
			a + b + 10,
			a + b - 10,
			(a + b) / 10,
			a + b + 100
		] })),
		"sub:tens": kind("sub:tens", "Taking away tens (120 − 40)", "sub-tens", (r) => {
			const b = int$2(r, 1, 9) * 10;
			return [b + int$2(r, 1, 9) * 10, b];
		}, (a, b) => a % 10 === 0 && b % 10 === 0 && b >= 10 && b <= 90 && a - b >= 10 && a - b <= 90, (a, b) => diff(a, b, { wrong: [
			a - b + 10,
			a - b - 10,
			a + b
		] })),
		"add:2d+tens": kind("add:2d+tens", "Adding tens to a 2-digit number (47 + 30)", "add-tens-to-2d", (r) => [int$2(r, 1, 6) * 10 + int$2(r, 1, 9), int$2(r, 1, 3) * 10], (a, b) => a >= 11 && a <= 69 && ones$1(a) !== 0 && b % 10 === 0 && b >= 10 && b <= 30, (a, b) => sum(a, b, { wrong: addWrong(a, b).concat([a + b / 10]) })),
		"sub:2d-tens": kind("sub:2d-tens", "Taking tens from a 2-digit number (77 − 30)", "sub-tens-from-2d", (r) => {
			const b = int$2(r, 1, 3) * 10;
			return [b + int$2(r, 1, 5) * 10 + int$2(r, 1, 9), b];
		}, (a, b) => b % 10 === 0 && b >= 10 && b <= 30 && a - b >= 11 && a - b <= 59 && ones$1(a) !== 0, (a, b) => diff(a, b, { wrong: subWrong(a, b).concat([a - b / 10]) })),
		"add:bridge10": kind("add:bridge10", "Adding across a ten (47 + 8)", "add-bridge-ten", (r) => {
			const a = int$2(r, 1, 8) * 10 + int$2(r, 2, 9);
			return [a, int$2(r, 11 - ones$1(a), 9)];
		}, (a, b) => a >= 12 && a <= 89 && b >= 2 && b <= 9 && ones$1(a) + b >= 10, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:bridge10": kind("sub:bridge10", "Taking away across a ten (53 − 8)", "sub-bridge-ten", (r) => {
			const a = int$2(r, 2, 9) * 10 + int$2(r, 0, 7);
			return [a, int$2(r, Math.max(2, ones$1(a) + 1), 9)];
		}, (a, b) => a >= 20 && a <= 97 && b >= 2 && b <= 9 && ones$1(a) < b, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:2d+2d": kind("add:2d+2d", "Adding 2-digit numbers (34 + 25)", "add-2d", (r) => {
			const a = int$2(r, 1, 7) * 10 + int$2(r, 1, 8);
			return [a, int$2(r, 1, 8 - tens(a)) * 10 + int$2(r, 1, 9 - ones$1(a))];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && ones$1(a) + ones$1(b) <= 9 && a + b <= 99, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:2d-2d": kind("sub:2d-2d", "Taking away 2-digit numbers (59 − 25)", "sub-2d", (r) => {
			const b = int$2(r, 1, 7) * 10 + int$2(r, 1, 8);
			return [b + int$2(r, 1, 9 - tens(b)) * 10 + int$2(r, 0, 9 - ones$1(b)), b];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && a > b && ones$1(a) >= ones$1(b) && a - b >= 10, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:2d+2d:carry": kind("add:2d+2d:carry", "Adding 2-digit numbers, with regrouping (47 + 36)", "add-2d-regroup", (r) => {
			const a = int$2(r, 1, 7) * 10 + int$2(r, 2, 9);
			return [a, int$2(r, 1, 8 - tens(a)) * 10 + int$2(r, 10 - ones$1(a), 9)];
		}, (a, b) => a >= 10 && a <= 99 && b >= 10 && b <= 99 && ones$1(a) + ones$1(b) >= 10 && a + b <= 99, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:2d-2d:borrow": kind("sub:2d-2d:borrow", "Taking away 2-digit numbers, with regrouping (52 − 37)", "sub-2d-regroup", (r) => {
			const a = int$2(r, 3, 9) * 10 + int$2(r, 0, 8);
			return [a, int$2(r, 1, tens(a) - 2) * 10 + int$2(r, ones$1(a) + 1, 9)];
		}, (a, b) => a >= 30 && a <= 99 && b >= 10 && b <= 99 && ones$1(a) < ones$1(b) && a - b >= 10, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:to100": {
			label: "Pairs that make 100 (64 + ? = 100)",
			curriculumTags: TODO$6("pairs-to-100"),
			keys: ["add:to100"],
			roll: (_k, r) => [int$2(r, 1, 8) * 10 + int$2(r, 1, 9)],
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
			const a = int$2(r, 101, 799);
			return [a, int$2(r, 101, 999 - a)];
		}, (a, b) => a >= 101 && a <= 799 && b >= 101 && a + b <= 999, (a, b) => sum(a, b, { wrong: addWrong(a, b) })),
		"sub:3d-3d": kind("sub:3d-3d", "Taking away 3-digit numbers (502 − 178)", "sub-3d", (r) => {
			const b = int$2(r, 101, 799);
			return [int$2(r, b + 11, 999), b];
		}, (a, b) => a >= 112 && a <= 999 && b >= 101 && b <= 799 && a - b >= 11, (a, b) => diff(a, b, { wrong: subWrong(a, b) })),
		"add:near100": kind("add:near100", "Adding a number close to a hundred (398 + 250)", "add-compensate", (r) => [int$2(r, 1, 5) * 100 - int$2(r, 1, 3), int$2(r, 11, 49) * 10], (a, b) => a % 100 >= 97 && a >= 97 && a <= 499 && b % 10 === 0 && b >= 110 && b <= 490, (a, b) => sum(a, b, { wrong: [
			a + b + 2,
			Math.ceil(a / 100) * 100 + b,
			a + b - 10,
			a + b + 10
		] })),
		"sub:near100": kind("sub:near100", "Taking away a number close to a hundred (634 − 299)", "sub-compensate", (r) => {
			const b = int$2(r, 1, 4) * 100 - int$2(r, 1, 3);
			return [int$2(r, Math.ceil(b / 100) * 100 + 11, 999), b];
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
			roll: (_k, r) => [int$2(r, 1, 9), int$2(r, 1, 9)],
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
				const a = int$2(r, 2, 19);
				return [a, int$2(r, 1, Math.min(9, a - 1))];
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
			roll: (_k, r) => [int$2(r, 1, 9)],
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
			roll: (_k, r) => [int$2(r, 21, 199) * 5, int$2(r, 21, 199) * 5],
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
				return [paid, int$2(r, 21, paid / 5 - 1) * 5];
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
					a = int$2(r, 11, 99);
				while (a % 10 === 0);
				return [a, int$2(r, 1, 9) * 10];
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
				const a = int$2(r, 1, 9) * 10;
				let b;
				do
					b = int$2(r, 11, 99);
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
					a = int$2(r, 1, 99);
				while (a % 10 === 0);
				return [a, int$2(r, 1, 2)];
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
					a = int$2(r, 11, 199);
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
			roll: (_k, r) => [int$2(r, 1, 9), int$2(r, 2, 9)],
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
			roll: (_k, r) => r() < .3 ? [int$2(r, 1, 99), 100] : pickOne(r, FRACTIONS_AS_DECIMALS),
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
				int$2(r, 0, 3) === 0 ? 1 : 0
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
				const d = int$2(r, 2, 6);
				return [d, int$2(r, 11, Math.floor(99 / d))];
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
			roll: (_k, r) => [int$2(r, 1, 9) * 10 + int$2(r, 1, 9), int$2(r, 1, 2)],
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
			roll: (_k, r) => [int$2(r, 2, 9), int$2(r, 2, 12)],
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
				const d = int$2(r, 3, 9);
				return [
					d,
					int$2(r, 2, 9),
					int$2(r, 1, d - 1)
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
				const d = int$2(r, 3, 9);
				return [d, int$2(r, Math.ceil(100 / d), Math.floor(999 / d))];
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
			]), int$2(r, 1, 10)],
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
				const a = int$2(r, 1, d - 1);
				let b = int$2(r, 1, d - 2);
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
					n = int$2(r, 2, d - 1);
				while (gcd$2(n, d) !== 1);
				return [
					n,
					d,
					int$2(r, 1, 10)
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
				const d = int$2(r, 2, 5);
				let n;
				do
					n = int$2(r, 1, d - 1);
				while (gcd$2(n, d) !== 1);
				return [
					n,
					d,
					int$2(r, 2, 5),
					int$2(r, 0, 1)
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
					int$2(r, 1, Math.min(d1, d2) - 1),
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
				const d = int$2(r, 3, 12);
				const a = int$2(r, 1, d - 2);
				return [
					a,
					int$2(r, 1, d - 1 - a),
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
				const d = int$2(r, 3, 12);
				const a = int$2(r, 2, d);
				return [
					a,
					int$2(r, 1, a - 1),
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
				const d = int$2(r, 2, 8);
				return [
					int$2(r, 1, 4),
					int$2(r, 1, d - 1),
					d,
					int$2(r, 0, 1)
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
					const n1 = int$2(r, 1, d1 - 1);
					const n2 = int$2(r, 1, d2 - 1);
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
				const d = int$2(r, 2, 6);
				do
					n = int$2(r, 1, d - 1);
				while (gcd$2(n, d) !== 1);
				return [
					n,
					d,
					int$2(r, 2, 6),
					int$2(r, 0, 1)
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
				const n = int$2(r, lo, hi);
				const places = askablePlaces(n, 1);
				if (places.length) return [n, places[int$2(r, 0, places.length - 1)]];
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
				const n = int$2(r, lo, hi);
				const place = int$2(r, 1, digitCount(n) - 1);
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
			const step = steps[int$2(r, 0, steps.length - 1)];
			const v = int$2(r, 0, 1);
			for (;;) {
				let n = int$2(r, lo, hi);
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
				let n = int$2(r, lo, hi);
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
			roll: (_k, r) => [int$2(r, 2, 99), int$2(r, 1, 3)],
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
				int$2(r, 0, 3)
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
		roll: (key, r) => [Number(key.split(":")[1]), int$2(r, 0, 1)],
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
			roll: (key, r) => [Number(key.split(":")[1]), int$2(r, 0, 3)],
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
const lettersOf$1 = (src) => (src.match(/[a-d]/g) ?? []).length;
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
	if (!template || nums.length !== lettersOf$1(template.src) || !nums.every((n) => isInt(n, 2, MAX_NUMBER))) return null;
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
			const nums = Array.from({ length: lettersOf$1(t.src) }, (_, n) => int$2(r, 2, n === 0 && /^a [+−]/.test(t.src) ? 30 : 12));
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
const rollPick = (random, wrong = 3) => [int$2(random, 0, wrong), int$2(random, 0, 9)];
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
		return pick$1({
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
		return pick$1({
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
	oneKey("tenth:to-fraction", "A decimal as tenths (0.3 = 3/10)", TENTH_TAGS, 3, (_k, r) => [int$2(r, 2, 9), ...rollPick(r)], (_k, [d, slot, salt]) => {
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
	oneKey("tenth:to-decimal", "Tenths as a decimal (3/10 = 0.3)", TENTH_TAGS, 3, (_k, r) => [int$2(r, 1, 9), ...rollPick(r)], (_k, [d, slot, salt]) => {
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
	oneKey("tenth:half", "Half and double of tenths (half of 1.4 = 0.7)", TENTH_TAGS, 2, (_k, r) => r() < .5 ? [pickOne(r, range$3(2, 38, 2)), 0] : [int$2(r, 1, 24), 1], (_k, [t, v]) => {
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
		int$2(r, 1, 9),
		int$2(r, 1, 9),
		int$2(r, 0, 2)
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
		int$2(r, 1, 9),
		int$2(r, 1, 2),
		int$2(r, 0, 2)
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
	oneKey("deceq:to-fraction", "A decimal as a fraction (0.75 = 3/4)", EQUIV_TAGS$1, 3, (_k, r) => [int$2(r, 0, FRACTION_DECIMALS.length - 1), ...rollPick(r)], (_k, [i, slot, salt]) => {
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
				int$2(r, Math.floor(x / 10) + 1, 9),
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
	oneKey("timesdec:missing", "A missing 10 or 100 (0.6 × ? = 60)", TIMES_TAGS, 2, (_k, r) => [pickOne(r, range$3(11, 99).filter(notTen)), int$2(r, 0, 3)], (_k, [t, v]) => {
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
	return oneKey(key, label, UNIT_TAGS, 2, (_k, r) => [pickOne(r, dens), int$2(r, qLo, qHi)], (_k, [d, q]) => {
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
		int$2(r, 1, 10)
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
			int$2(r, 2, 6)
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
			int$2(r, 2, 6)
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
			int$2(r, 2, 5),
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
			int$2(r, 2, 5),
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
			int$2(r, 2, 5),
			int$2(r, 0, 1)
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
			int$2(r, qLo, qHi)
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
	return oneKey(key, label, tags, 1, (_k, r) => [int$2(r, qLo, qHi)], (_k, [q]) => {
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
	return [p, int$2(r, BIG[p].lo, BIG[p].hi)];
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
	return oneKey(key, label, OF_TAGS, 1, (_k, r) => [int$2(r, xLo, xHi)], (_k, [x]) => {
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
	return oneKey(key, label, tags, 2, (_k, r) => [pickOne(r, candidates), int$2(r, 0, 1)], (_k, [a, v]) => {
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
const divTens = oneKey("times:div-tens", "Dividing tens (240 ÷ 6)", ["MS.Y4.NUM.OP.P3"], 2, (_k, r) => [int$2(r, 2, 9), pickOne(r, TENS)], (_k, [d, q]) => {
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
	oneKey("square:of", "Square numbers (7 squared)", squareTags, 1, (_k, r) => [int$2(r, 2, 12)], (_k, [n]) => {
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
	oneKey("cube:of", "Cube numbers (4 cubed)", squareTags, 1, (_k, r) => [int$2(r, 2, 5)], (_k, [n]) => {
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
			const x = int$2(r, 5, 143);
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
			let n = int$2(r, lo, hi);
			if (suffix === "halfway") n = n - n % unit + half;
			else if (suffix === "near-halfway") n = n - n % unit + half + int$2(r, 1, zone) * (r() < .5 ? -1 : 1);
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
			let m = int$2(r, lo, hi);
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
//#region shared/clans/moments.ts
/**
* The maths moments in the shop, the Training Hall, the Church, on a building plan and at the barracks.
* Each takes the real numbers (the actual price, tax, level, member count) and makes the
* question from them, or returns null when the teacher has that topic switched off.
*
* A wrong answer never blocks anything: the caller shows the working and carries on with the
* right amount, which is always `question.answer` (the tests check it matches what the engine
* really charges). Maths here is how you check the bill, not a gate.
*/
function moment(settings, kind, nums, labels, item, about) {
	if (!topicAvailable(settings, topicOf(kind))) return null;
	return buildQuestion(kind, nums, {
		labels,
		item,
		about
	});
}
/** Market: "What is 10% of 80 gold?" Answered right, the item is 10% off (`shopPrice`). The server asks it again to mark it. */
function discountQuestion(settings, price, item) {
	const q = price > 0 ? moment(settings, "percent-of", [CONFIG.shopDiscount, price]) : null;
	return q && {
		...q,
		text: `${item ? `The ${item}` : "It"} costs ${price} gold. What is ${CONFIG.shopDiscount}% of ${price}?`,
		unit: "gold"
	};
}
/** True if `answer` is right for an item's discount question (and the question is on for the class). */
function earnedDiscount(settings, price, answer) {
	const q = answer === null || answer === void 0 ? null : discountQuestion(settings, price);
	return q !== null && answer === q.answer;
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
/** Letters, with at most one space, hyphen or apostrophe between two parts ("Te Ahi", "Jo-Jo", "O'Neil"). No numbers. */
const NAME_SHAPE = /^[A-Za-z]+(?:[ '-][A-Za-z]+)?$/;
const NEVER_INSIDE = [
	"fuck",
	"fuk",
	"fck",
	"shit",
	"cunt",
	"bitch",
	"bastard",
	"wank",
	"twat",
	"bollock",
	"nigg",
	"fagot",
	"faggot",
	"retard",
	"slut",
	"whore",
	"porn",
	"penis",
	"vagina",
	"boob",
	"dildo",
	"hitler",
	"pedo",
	"sexy",
	"horny",
	"poop",
	"pussy",
	"skank",
	"tits",
	"arsehole",
	"asshole",
	"dickhead",
	"killyourself"
];
const NEVER_ALONE = [
	"ass",
	"arse",
	"butt",
	"bum",
	"poo",
	"pee",
	"piss",
	"cock",
	"dick",
	"tit",
	"hell",
	"damn",
	"crap",
	"sex",
	"fag",
	"hoe",
	"nob",
	"knob",
	"prick",
	"wee",
	"weewee",
	"willy",
	"fart",
	"stupid",
	"dumb",
	"idiot",
	"loser",
	"ugly",
	"fat",
	"kill",
	"die",
	"dead",
	"gay",
	"homo",
	"nude",
	"naked",
	"drug",
	"drugs",
	"weed",
	"beer",
	"vape",
	"rape",
	"kys",
	"kkk",
	"shag",
	"puta",
	"nazi"
];
/** "boob" becomes b+o+o+b+: the same letters in order, each typed one or more times. */
const stretchy = (word) => [...word].map((ch) => `${ch}+`).join("");
const insideRule = new RegExp(NEVER_INSIDE.map(stretchy).join("|"));
const aloneRule = new RegExp(`^(?:${NEVER_ALONE.map(stretchy).join("|")})$`);
const lettersOf = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
/** A made-up name, tidied (spaces trimmed, each part starting with a capital), or why it can't be used. */
function checkTypedName(raw) {
	if (typeof raw !== "string") return {
		ok: false,
		say: "Type a name."
	};
	const trimmed = raw.trim().replace(/\s+/g, " ");
	if (trimmed === "") return {
		ok: false,
		say: "Type a name."
	};
	if (trimmed.length < 2) return {
		ok: false,
		say: `A name needs at least 2 letters.`
	};
	if (trimmed.length > 12) return {
		ok: false,
		say: `A name can be up to 12 letters long.`
	};
	if (!NAME_SHAPE.test(trimmed)) return {
		ok: false,
		say: "Use letters only (one space, dash or apostrophe is fine)."
	};
	const whole = lettersOf(trimmed);
	const parts = trimmed.split(/[ '-]/).map(lettersOf);
	if (insideRule.test(whole) || aloneRule.test(whole) || parts.some((p) => aloneRule.test(p))) return {
		ok: false,
		say: "Please pick a kinder name."
	};
	return {
		ok: true,
		name: trimmed.replace(/(^|[ '-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
	};
}
/** The name a hero will have: a name from the list as it is, or (when the teacher allows it) a made-up name, tidied. */
function memberNameFrom(raw, typedNames) {
	if (typeof raw === "string" && MEMBER_NAMES.includes(raw)) return {
		ok: true,
		name: raw
	};
	if (!typedNames) return {
		ok: false,
		say: "Pick member names from the list."
	};
	return checkTypedName(raw);
}
//#endregion
//#region shared/clans/looks.ts
const LOOKS = [
	"female-1",
	"female-2",
	"male-1",
	"male-2"
];
const isLook = (v) => typeof v === "string" && LOOKS.includes(v);
/** The same name always gives the same look. */
function lookFromName(name) {
	let h = 0;
	for (const ch of name) h = Math.imul(h, 31) + ch.charCodeAt(0) | 0;
	return LOOKS[Math.abs(h) % LOOKS.length];
}
/** "Change look" for one member. Allowed any time, free. */
function setLook(clan, memberIndex, look) {
	const m = clan.members[memberIndex];
	if (!m) return {
		ok: false,
		why: "member",
		say: "Pick one of your clan."
	};
	if (!isLook(look)) return {
		ok: false,
		why: "look",
		say: "Pick one of the four looks."
	};
	m.look = look;
	return { ok: true };
}
/** The member a draft shows right now. Slot 0 is the clan leader. */
function draftMember(d, slot) {
	return {
		...rollMember({ rng: Math.imul(d.seed | 0, 2654435761) + d.rolls * 7919 }, d.name, d.race, d.cls, slot === 0),
		look: d.look ?? lookFromName(d.name)
	};
}
/** The seed of slot `slot` of a clan with this seed. */
const slotSeed = (seed, slot) => seed + slot * 1013;
function makeClan(name, drafts) {
	return {
		name,
		members: drafts.map((d, i) => draftMember(d, i)),
		gold: CONFIG.startGold,
		followers: 0,
		gearVersion: 2,
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
* how many rolls); the stats are always rebuilt here from the clan's seed. `typedNames` is the teacher's switch:
* when it is on a hero may have a made-up name (checked and tidied here) as well as one from the list.
*/
function clanFromChoices(seed, name, drafts, typedNames = false) {
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
		const named = memberNameFrom(d.name, typedNames);
		if (!named.ok) return {
			ok: false,
			say: named.say
		};
		if (built.some((b) => b.name.toLowerCase() === named.name.toLowerCase())) return {
			ok: false,
			say: "Give each member a different name."
		};
		if (!Number.isInteger(d.rolls) || d.rolls < 0 || d.rolls > 3) return {
			ok: false,
			say: `You can roll again 3 times for each member.`
		};
		if (d.look !== void 0 && !isLook(d.look)) return {
			ok: false,
			say: "Pick one of the four looks."
		};
		built.push({
			race: d.race,
			cls: d.cls,
			name: named.name,
			rolls: d.rolls,
			seed: slotSeed(seed, slot),
			...d.look ? { look: d.look } : {}
		});
	}
	return {
		ok: true,
		clan: makeClan(name, built)
	};
}
//#endregion
//#region shared/clans/monster.ts
/**
* The season monster (Clan Quest season goals, part 2). In monster week (the last week of the season) a huge monster
* attacks every clan's village. One try a day:
*
* 1. **The siege.** The village fights first: the army (bigger with the Barracks, harder-hitting with the Forge), the Tower and
*    any fire arrows knock a share off the monster's HP. One maths question (the Battle Cry kind) makes the siege hit harder.
*    Buildings it "flattens" are for show only.
* 2. **The clan fight.** The four members fight what is left, as in the Mines, with a Battle Cry every round. The monster stomps on
*    two members each round and every third round uses its big move (you see it coming). The Walls cut every hit it does.
*
* Each lost try leaves the monster 10% more tired for that clan (up to 40%). Losing costs nothing real: members are knocked out
* until tomorrow, the village is not touched. Pure, so the server and the screens use the same sums.
*/
const M = CONFIG.monster;
const MONSTER_LOOKS = {
	giant: {
		name: "Grimmor the Storm Giant",
		short: "Grimmor",
		emoji: "🗿",
		blurb: "A huge mountain giant who throws boulders and stamps on everything.",
		warn: "Grimmor lifts a boulder!",
		big: "Grimmor throws the boulder!",
		bigHelp: "Every third round he throws a boulder at one member. Guard to take half.",
		beaten: "Grimmor stomps off back to the mountains for good!",
		stompsOff: "Grimmor stomps off for the night. He will be back tomorrow.",
		trophy: "Grimmor's club",
		signs: [
			"Giant footprints were found by the river.",
			"Trees on the hill have been pushed over.",
			"Thunder rumbles from the mountains every night."
		]
	},
	golem: {
		name: "Old Craghold the Stone Golem",
		short: "Craghold",
		emoji: "🪨",
		blurb: "A slow, walking hill of rock.",
		warn: "Craghold raises both fists!",
		big: "Craghold slams the ground!",
		bigHelp: "Every third round he slams the ground: everyone takes a little damage. Guard to take half.",
		beaten: "Craghold crumbles into a pile of pebbles!",
		stompsOff: "Craghold rumbles away for the night. He will be back tomorrow.",
		trophy: "Craghold's stone heart",
		signs: [
			"The ground shook in the night.",
			"A hill near the village has moved.",
			"Big round stones keep rolling down the road."
		]
	},
	troll: {
		name: "Frostjaw the Frost Troll",
		short: "Frostjaw",
		emoji: "🧊",
		blurb: "A shaggy, wintry brute with icy breath.",
		warn: "Frostjaw takes a deep, cold breath!",
		big: "Frostjaw breathes ice!",
		bigHelp: "Every third round he breathes ice on one member, who is frozen for a round. Guard to take half.",
		beaten: "Frostjaw runs off to the far north, shivering!",
		stompsOff: "Frostjaw slinks off for the night. He will be back tomorrow.",
		trophy: "Frostjaw's icy tooth",
		signs: [
			"The village pond froze in the middle of a warm day.",
			"Huge furry footprints were found in the frost.",
			"A cold wind howls from the north every night."
		]
	}
};
/** The monster of a season: the giant, the golem and the troll take turns. */
const monsterOf = (season) => MONSTER_KINDS[((Math.max(1, season) - 1) % MONSTER_KINDS.length + MONSTER_KINDS.length) % MONSTER_KINDS.length];
const noSupplies = () => ({
	arrows: 0,
	potions: 0,
	net: 0
});
/** This season's monster save (a fresh one if the clan has none for this season). */
function monsterSave(clan, season) {
	const m = clan.monster;
	return m && m.season === season ? m : {
		season,
		tries: 0,
		losses: 0,
		lastDay: 0,
		supplies: noSupplies()
	};
}
/** How tired the monster is for a clan that has lost `losses` tries: a share, 0 to `tiredMax`. */
const tiredShare = (losses) => Math.min(M.tiredMax, Math.max(0, losses) * M.tiredPerLoss);
/** The siege's maths question for a try (the Battle Cry kind, from the try's seed and the teacher's topics). Null with every topic off. */
const siegeQuestion = (seed, settings) => cryQuestion(seed, 0, settings);
/** Play the siege: 3 rounds, each a third of the share with a little luck. */
function playSiege(clan, arrows, right, seed) {
	const dice = { rng: Math.imul(seed | 0, 739982445) ^ 695872825 };
	const e = empireOf(clan);
	const S = M.siege;
	const boost = right ? S.rightAnswer : 1;
	const armyAll = S.armyShare * Math.min(1, might(e.troops) / S.fullMight) * (1 + e.levels.forge * CONFIG.empire.buildings.forge.per / 100) * boost;
	const towerAll = (S.towerShare * e.levels.tower + S.arrowShare * arrows) * boost;
	const rounds = [];
	let share = 0;
	for (let r = 0; r < 3; r++) {
		const luck = (90 + roll(dice, 21)) / 100;
		const army = Math.max(0, Math.min(S.most - share, armyAll / 3 * luck));
		share += army;
		const tower = Math.max(0, Math.min(S.most - share, towerAll / 3 * luck));
		share += tower;
		rounds.push({
			army,
			tower
		});
	}
	return {
		rounds,
		share,
		right,
		arrows
	};
}
/** Mark a siege answer (null: skipped, or no question). */
function markSiege(seed, settings, answer) {
	const question = siegeQuestion(seed, settings);
	if (!question || answer === null) return {
		question,
		right: question ? false : null
	};
	return {
		question,
		right: markAnswer(question, answer)
	};
}
/** The monster's full HP (after tiredness, before the siege) and the HP it starts the clan fight with. */
function monsterHp(setup) {
	const maxHp = Math.max(1, Math.round(M.hp * (1 - tiredShare(setup.losses))));
	return {
		maxHp,
		hp: Math.max(1, Math.round(maxHp * (1 - setup.siege)))
	};
}
function monsterFighter(setup) {
	const { maxHp, hp } = monsterHp(setup);
	const tired = 1 - tiredShare(setup.losses);
	return {
		side: "enemy",
		index: 0,
		name: MONSTER_LOOKS[setup.kind].short,
		level: M.depth + 8,
		hp,
		maxHp,
		sp: 0,
		maxSp: 0,
		stats: {
			...M.stats,
			strength: Math.round(M.stats.strength * tired)
		},
		spells: [],
		mods: [],
		tied: 0,
		guarding: false,
		difficulty: M.depth * 3
	};
}
/** Start the clan part of a monster try. Same seed and setup, same fight, so the server can replay it. */
function newMonsterFight(members, setup, seed) {
	const state = newFight(members, M.depth, seed, false);
	state.enemies = [monsterFighter(setup)];
	state.monster = {
		kind: setup.kind,
		potions: setup.potions,
		net: setup.net,
		wallsCut: Math.min(90, setup.walls * M.wallsCut),
		rounds: M.rounds
	};
	return state;
}
const SUPPLY_KINDS = [
	"arrows",
	"potions",
	"net"
];
const SUPPLY_NAMES = {
	arrows: {
		one: "fire arrow",
		many: "fire arrows",
		help: "Your tower hits harder in the siege."
	},
	potions: {
		one: "healing potion",
		many: "healing potions",
		help: "Heal a member in the middle of the monster fight."
	},
	net: {
		one: "giant net",
		many: "giant nets",
		help: "The monster misses its first big move."
	}
};
/** A supply's price with the village tax, like the shop's. */
const supplyPrice = (kind) => Math.ceil(M.supplies[kind].price * (100 + CONFIG.shopTax) / 100);
/** Buy `count` of a supply for this season (paid from the purse, never more than the most a clan may hold). */
function buySupply(clan, season, kind, count) {
	if (!SUPPLY_KINDS.includes(kind) || !Number.isInteger(count) || count < 1) return {
		ok: false,
		why: "amount",
		say: "Pick what to buy and how many."
	};
	const save = monsterSave(clan, season);
	const room = M.supplies[kind].max - save.supplies[kind];
	if (count > room) return {
		ok: false,
		why: "full",
		say: room > 0 ? `You can carry ${room} more ${room === 1 ? SUPPLY_NAMES[kind].one : SUPPLY_NAMES[kind].many}.` : `You already have as many ${SUPPLY_NAMES[kind].many} as you can carry.`
	};
	const cost = supplyPrice(kind) * count;
	if (clan.gold < cost) return {
		ok: false,
		why: "gold",
		say: `That costs ${cost} gold and the clan has ${clan.gold}.`
	};
	clan.gold -= cost;
	clan.monster = {
		...save,
		supplies: {
			...save.supplies,
			[kind]: save.supplies[kind] + count
		}
	};
	return { ok: true };
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
/**
* Pay for an item and put it on the member (swapping out what was there). `discount` is true when the Market's maths
* question was answered right (the caller has checked it): 10% off.
*/
function buyItem(clan, memberIndex, item, discount = false) {
	const m = memberAt(clan, memberIndex);
	if (!m) return no("member", "Pick one of your clan.");
	const why = cannotBuy(clan, m, item);
	if (why) return no("shelf", why);
	const price = shopPrice(item, discount);
	if (clan.gold < price) return no("gold", `That costs ${price} gold and the clan has ${clan.gold}.`);
	return buy(clan, m, item, discount) ? ok : no("gold", "That cannot be bought right now.");
}
/** Buy `count` of something at the Training Hall (stops early if the points run out). Fails if not even one could be bought. */
function trainMember(clan, memberIndex, key, count) {
	const m = memberAt(clan, memberIndex);
	if (!m) return no("member", "Pick one of your clan.");
	if (!TRAIN_KEYS.includes(key) || !Number.isInteger(count) || count < 1) return no("amount", "Pick what to train and how many.");
	const hall = levelOf(clan, "trainingHall");
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
	const before = {
		gold: clan.gold,
		troops: { ...e.troops }
	};
	for (const kind of TROOP_KINDS) {
		if (mix[kind] === 0) continue;
		const done = buyTroops(clan, kind, mix[kind]);
		if (!done.ok) {
			clan.gold = before.gold;
			e.troops = before.troops;
			return done;
		}
	}
	return ok;
}
/** The seed for the next raid or Friendly War: from the clan's seed and how many there have been. */
const raidSeed = (baseSeed, raidNo) => Math.imul(baseSeed | 0, 625341585) ^ Math.imul(raidNo + 1, 668265263);
/** Send the army to a kingdom: a real raid (loses troops, wins loot) or a Friendly War (changes nothing). Always 3 rounds and 10% loot; the child picks only the push. */
function sendArmyTo(clan, kingdomId, push, friendly, seed) {
	const e = empireOf(clan);
	if (friendly) {
		const r = friendlyWar(e, kingdomId, push, seed);
		return r.ok ? {
			ok: true,
			result: r.result,
			gold: 0,
			friendly
		} : r;
	}
	const r = raidKingdom(clan, kingdomId, push, seed);
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
	joinFollowers(clan);
	return {
		result: fight.result,
		gold: fight.gold,
		followers: fight.followers,
		xp: fight.xp,
		levels
	};
}
//#endregion
//#region shared/clans/season.ts
const S = CONFIG.season;
const whole = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0;
/** Read the clock the database sends. Anything odd (missing, wrong types) gives null. */
function readClock(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
	const r = raw;
	if (!whole(r.number) || !whole(r.day) || !whole(r.daysLeft) || typeof r.clockOn !== "boolean") return null;
	return {
		number: r.number,
		day: r.day,
		daysLeft: r.daysLeft,
		clockOn: r.clockOn
	};
}
/** Raids on classmates rest from day `warnFrom` to the end of the season (computer kingdoms stay open). */
const classRaidsResting = (clock) => clock?.clockOn === true && clock.day >= S.warnFrom;
/**
* The full reset for a new season. Returns a copy. Every member starts again at level 1 (same name, race, class and look; slot 0 leads),
* the purse goes back to the starting gold, followers, buildings, saved builds, the day's counts and last season's monster tries and supplies go,
* and everyone is back in tier 1 gear. The clan may then pick its members' races and classes again (`repick`) until it says it is done.
* Name, seed, day, fight numbers and the fights left are kept. The caller only does this when no fight is open.
*/
function newSeasonSave(state, season) {
	const copy = structuredClone(state);
	const members = copy.clan.members.map((m, slot) => {
		return {
			...rollMember({ rng: Math.imul(slotSeed(state.seed, slot) | 0, 2654435761) + season * 7919 }, m.name, m.race, m.cls, slot === 0),
			...m.look ? { look: m.look } : {}
		};
	});
	const { questDay: _q, monster: _m, repick: _r, ...rest } = copy.clan;
	copy.clan = {
		...rest,
		members,
		gold: CONFIG.startGold,
		followers: 0,
		gearVersion: 2,
		village: {
			trainingHall: 0,
			smithy: 0,
			church: 0
		},
		wakesToday: 0,
		empire: {
			...newEmpire(state.day),
			buildsSaved: 0
		},
		season,
		repick: season
	};
	return copy;
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
				text: "You fish out a bundle of clothes that someone dropped long ago. They are a little damp, but they dry out soft and warm.",
				item: "armor"
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
				text: "The giant yawns, then smiles. \"What good manners!\" He gives your clan something from his old toy box, which is tiny for him but just right for you.",
				item: "shield",
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
/** Who gets a found item: the first member whose gear in that slot is below the found tier, and the item they get. */
function wearer(clan, kind) {
	for (const who of clan.members) {
		const item = wornTier(who, kind) < Q.itemTier ? itemAt(who.cls, kind, Q.itemTier) : void 0;
		if (item) return {
			who,
			item
		};
	}
	return null;
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
		const found = wearer(clan, outcome.item);
		if (found) {
			wear(found.who, found.item);
			prize.item = {
				name: found.item.name,
				member: found.who.name
			};
		} else {
			prize.gold += Math.ceil(TIER_PRICES[outcome.item][Q.itemTier - 1] / 2);
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
CONFIG.village.order;
const partyOf = (id, empire, createdNzDay, gold = 0) => ({
	id,
	empire: {
		...empire,
		createdDay: createdNzDay
	},
	gold
});
/** Who this clan may raid, and why not for the rest. Allowed ones come first. */
function raidTargetList(state, today, self, raidsOn, sketches) {
	const attacker = partyOf(self, empireOf(state.clan), state.createdNzDay, state.clan.gold);
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
			say: refused ? refused.say : "",
			...s.shieldUntil >= today ? { shieldUntil: s.shieldUntil } : {}
		};
	});
	return [...list.filter((t) => t.allowed), ...list.filter((t) => !t.allowed)];
}
/** What the raided clan reads next time. The raiders' clan name only. */
function raidNote(raiderClan, raid) {
	if (raid.result.outcome !== "won") return `A raider from the ${raiderClan} clan attacked, and your defenders drove them off!`;
	if (raid.take === "gold") return `A raider from the ${raiderClan} clan beat your defenders and took ${raid.gold} gold from your purse.`;
	return `A raider from the ${raiderClan} clan beat your defenders and knocked ${raid.destroyed.length} ${raid.destroyed.length === 1 ? "level" : "levels"} off your buildings.`;
}
/**
* Raid a classmate with the attacker's saved state (which is changed: the caller passes a copy). The rules are
* `raidClassmate`, with day numbers turned into New Zealand days. The defender's empire and purse come back changed; the
* caller saves both clans in one go. The attacker's own empire and purse are changed in `state`.
*/
function raidClassmateNz(state, self, target, take, push, seed, today, raidsOn) {
	const mine = empireOf(state.clan);
	const keep = mine.createdDay;
	mine.createdDay = state.createdNzDay;
	let defenderEmpire;
	let defenderGold = target.gold;
	if (target.empire.version === 2) defenderEmpire = structuredClone(target.empire);
	else {
		const scratch = {
			name: target.name,
			members: [],
			gold: target.gold,
			followers: 0,
			village: {
				trainingHall: 0,
				smithy: 0,
				church: 0
			},
			empire: target.empire
		};
		const up = needsUpgrade(scratch) ? upgradeSave(scratch, target.village) : scratch;
		defenderEmpire = up.empire;
		defenderGold = up.gold;
	}
	const originalCreated = target.empire.createdDay;
	defenderEmpire.createdDay = target.createdNzDay;
	const attacker = {
		id: self,
		empire: mine,
		gold: state.clan.gold
	};
	const defender = {
		id: target.id,
		empire: defenderEmpire,
		gold: defenderGold
	};
	const out = raidClassmate(attacker, defender, take, push, seed, today, raidsOn);
	mine.createdDay = keep;
	if (!out.ok) return out;
	state.clan.gold = attacker.gold;
	defenderEmpire.createdDay = originalCreated;
	const { ok: _ok, ...raid } = out;
	return {
		ok: true,
		raid,
		defenderEmpire,
		defenderGold: defender.gold,
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
* rest waits until the fight is over. A ladder fight (the browser asks for one with `ladder: true`) also keeps the questions the
* server made from the child's maths focus, and `cryCheck` marks each Battle Cry answer as it is given (battleCry.ts).
* "My Village" gives every clan its own buildings (`upgrade`, paid from the purse) and raids on classmates (which also change the raided clan,
* saved in the same transaction). A save from before My Village is converted by `upgradeSave` when it loads.
*/
/** The most rounds any fight can have (a monster fight is longer than a mine fight). */
const MOST_ROUNDS = Math.max(CONFIG.maxRounds, CONFIG.monster.rounds);
/** Is it monster week (the clock is on, the season is set and it is day `monsterFrom` or later)? */
const monsterWeek = (clock) => !!clock && clock.clockOn && clock.number > 0 && clock.day >= CONFIG.season.monsterFrom;
/** Are monster supplies on sale (the clock is on and it is day `warnFrom` or later)? */
const suppliesOnSale = (clock) => !!clock && clock.clockOn && clock.number > 0 && clock.day >= CONFIG.season.warnFrom;
/** The fight an open fight starts from: a mine fight, or a monster try's clan fight. */
function fightOf(members, open) {
	return open.monster ? newMonsterFight(members, open.monster.setup, open.seed) : newFight(members, open.depth, open.seed, open.boss);
}
/** The seed for a monster try: from the clan's seed, the season and the try number. */
const monsterSeed = (baseSeed, season, tryNo) => Math.imul(baseSeed | 0, 1013904242) ^ Math.imul(season * 64 + tryNo + 1, 461845907);
const refuse = (why, say) => ({
	ok: false,
	why,
	say
});
const earnedPart = (earned) => earned ? { earned } : {};
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v, lo, hi) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null;
const parsePush = (v) => typeof v === "string" && PUSHES.includes(v) ? v : null;
const ORDER_ACTIONS = [
	"attack",
	"spell",
	"guard",
	"run",
	"skip",
	"potion"
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
		case "potion": {
			const target = int(v.target, 0, CONFIG.maxMembers - 1);
			return target === null ? null : {
				action: "potion",
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
		case "wakeAll": return { type: "wakeAll" };
		case "create":
			if (typeof raw.name !== "string" || !Array.isArray(raw.drafts) || raw.drafts.length > CONFIG.maxMembers) return null;
			return {
				type: "create",
				name: raw.name,
				drafts: raw.drafts
			};
		case "buy": {
			const answer = raw.answer === null || raw.answer === void 0 ? null : typeof raw.answer === "number" && Number.isFinite(raw.answer) ? raw.answer : void 0;
			return member !== null && typeof raw.item === "string" && answer !== void 0 ? {
				type: "buy",
				member,
				item: raw.item,
				answer
			} : null;
		}
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
		case "look": return member !== null && isLook(raw.look) ? {
			type: "look",
			member,
			look: raw.look
		} : null;
		case "upgrade": return typeof raw.building === "string" && VILLAGE_BUILDINGS.includes(raw.building) ? {
			type: "upgrade",
			building: raw.building
		} : null;
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
		case "raid":
		case "war": {
			const push = parsePush(raw.push);
			return push && typeof raw.kingdom === "string" && raw.kingdom.length <= 40 ? {
				type: raw.type,
				kingdom: raw.kingdom,
				push
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
			if (depth === null || typeof raw.boss !== "boolean") return null;
			return raw.ladder === true ? {
				type: "fightStart",
				depth,
				boss: raw.boss,
				ladder: true
			} : {
				type: "fightStart",
				depth,
				boss: raw.boss
			};
		}
		case "cryCheck": {
			const round = int(raw.round, 1, MOST_ROUNDS);
			const ok = (v) => typeof v === "number" && Number.isFinite(v);
			if (round === null || !ok(raw.answer) || Math.abs(raw.answer) > 1e9 || !ok(raw.ms) || raw.ms < 0) return null;
			return {
				type: "cryCheck",
				round,
				answer: raw.answer,
				ms: Math.min(Math.round(raw.ms), 36e5)
			};
		}
		case "fightRound": {
			const round = int(raw.round, 1, MOST_ROUNDS);
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
		case "raidTargets": return { type: "raidTargets" };
		case "monsterStart": {
			const siege = raw.siege === null || raw.siege === void 0 ? null : typeof raw.siege === "number" && Number.isFinite(raw.siege) && Math.abs(raw.siege) <= 1e9 ? raw.siege : void 0;
			if (siege === void 0) return null;
			return raw.ladder === true ? {
				type: "monsterStart",
				siege,
				ladder: true
			} : {
				type: "monsterStart",
				siege
			};
		}
		case "buySupply": {
			const count = int(raw.count, 1, 10);
			return count !== null && typeof raw.kind === "string" && SUPPLY_KINDS.includes(raw.kind) ? {
				type: "buySupply",
				kind: raw.kind,
				count
			} : null;
		}
		case "repick": return member !== null && typeof raw.race === "string" && raw.race.length <= 40 && typeof raw.cls === "string" && raw.cls.length <= 40 ? {
			type: "repick",
			member,
			race: raw.race,
			cls: raw.cls
		} : null;
		case "repickDone": return { type: "repickDone" };
		case "raidClass": {
			const push = parsePush(raw.push);
			const take = TAKES.includes(raw.take) ? raw.take : null;
			return push && take && typeof raw.target === "string" && raw.target.length >= 1 && raw.target.length <= 40 ? {
				type: "raidClass",
				target: raw.target,
				take,
				push
			} : null;
		}
		default: return null;
	}
}
/** The clan's day number for this New Zealand day. */
const clanDay = (createdNzDay, today) => Math.max(1, today - createdNzDay + 1);
/**
* If a new day has started since the clan was last saved, give it the night's rest: everyone heals, the Church's
* free wake-up comes back, the day's builds and raids reset and the fights come back. A clan that was away for
* a week gets one night's rest and moves to today's number (the days it skipped still save their builds). Returns true if anything changed.
*/
function catchUp(state, today, fightsPerDay = CONFIG.fightsPerDay) {
	const day = clanDay(state.createdNzDay, today);
	if (day <= state.day) return false;
	dayReset(state.clan);
	empireNewDay(state.clan, Math.max(0, day - state.day - 1));
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
	const flags = { newSeason: false };
	const out = applyInner(saved, action, ctx, flags);
	return out.ok && flags.newSeason ? {
		...out,
		newSeason: true
	} : out;
}
function applyInner(saved, action, ctx, flags) {
	const settings = ctx.settings ?? DEFAULT_PRACTICAL_SETTINGS;
	if (action.type === "create") {
		if (saved) return refuse("exists", "You already have a clan.");
		const made = clanFromChoices(ctx.seed, action.name, action.drafts, ctx.typedNames === true);
		if (!made.ok) return refuse("create", made.say);
		const state = {
			clan: made.clan,
			seed: ctx.seed,
			day: 1,
			createdNzDay: ctx.today,
			fightsLeft: ctx.fightsPerDay ?? CONFIG.fightsPerDay,
			fightNo: 0,
			raidNo: 0
		};
		return done(state, { type: "create" });
	}
	if (!saved) return action.type === "load" ? {
		ok: true,
		state: null,
		result: { type: "load" },
		changed: false
	} : refuse("no-clan", "Make a clan first.");
	let state = structuredClone(saved);
	let upgraded = needsUpgrade(state.clan);
	if (upgraded) state.clan = upgradeSave(state.clan, ctx.groupVillage ?? null);
	if (refreshGear(state.clan)) upgraded = true;
	let rested = state.fight ? false : catchUp(state, ctx.today, ctx.fightsPerDay);
	const clock = ctx.clock;
	if (clock && clock.number > 0) {
		if (state.clan.season === void 0) {
			state.clan.season = clock.number;
			rested = true;
		} else if (clock.clockOn && state.clan.season < clock.number && !state.fight) {
			state = newSeasonSave(state, clock.number);
			flags.newSeason = true;
			rested = true;
		}
	}
	if (state.fight && action.type !== "load" && action.type !== "fightStart" && action.type !== "monsterStart" && action.type !== "cryCheck" && action.type !== "fightRound" && action.type !== "raidTargets") return refuse("fight-open", "You are in the middle of a fight. Finish it first!");
	const { clan } = state;
	syncVillage(clan);
	const settle = (r, result) => r.ok ? done(state, result) : refuse(r.why ?? "no", r.say ?? "That cannot be done right now.");
	switch (action.type) {
		case "load": return done(state, { type: "load" }, rested || upgraded);
		case "buy": {
			const item = ITEMS$1.find((i) => i.name === action.item);
			if (!item) return refuse("item", "The shop does not have that.");
			const discount = earnedDiscount(settings, item.price, action.answer);
			return settle(buyItem(clan, action.member, item, discount), {
				type: "buy",
				discount
			});
		}
		case "train": return settle(trainMember(clan, action.member, action.key, action.count), { type: "train" });
		case "wake": return settle(wakeOne(clan, action.member), { type: "wake" });
		case "look": return settle(setLook(clan, action.member, action.look), { type: "look" });
		case "wakeAll": return settle(wakeEveryone(clan), { type: "wakeAll" });
		case "upgrade": {
			const out = upgrade(clan, action.building);
			return out.ok ? done(state, {
				type: "upgrade",
				building: action.building,
				level: empireOf(clan).levels[action.building]
			}) : refuse(out.why, out.say);
		}
		case "buyTroops": return settle(buyTroopMix(clan, action.mix), { type: "buyTroops" });
		case "raid":
		case "war": {
			const friendly = action.type === "war";
			const out = sendArmyTo(clan, action.kingdom, action.push, friendly, raidSeed(state.seed, state.raidNo));
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
				key: factKey$1(settings.yearBand, buildPuzzle(spec).kind),
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
		case "raidTargets": {
			if (classRaidsResting(clock)) return done(state, {
				type: "raidTargets",
				targets: [],
				resting: true
			}, rested || upgraded);
			const targets = raidTargetList(state, ctx.today, ctx.self ?? "", ctx.raidsOn ?? false, ctx.mates ?? []);
			return done(state, {
				type: "raidTargets",
				targets
			}, rested || upgraded);
		}
		case "raidClass": {
			if (classRaidsResting(clock)) return refuse("resting-season", "Raids on classmates rest for the last two weeks of the season. Computer kingdoms are still open!");
			if (!ctx.target || !ctx.self) return refuse("target", "That clan is not in your class.");
			const out = raidClassmateNz(state, ctx.self, ctx.target, action.take, action.push, raidSeed(state.seed, state.raidNo), ctx.today, ctx.raidsOn ?? false);
			if (!out.ok) return refuse(out.why, out.say);
			state.raidNo++;
			const { gold, destroyed } = out.raid;
			return {
				ok: true,
				state,
				changed: true,
				result: {
					type: "raidClass",
					take: action.take,
					result: out.raid.result,
					gold,
					destroyed,
					...earnedPart(earnedOrNone({ classRaids: out.raid.result.outcome === "won" ? 1 : 0 }))
				},
				effects: { raid: {
					targetId: ctx.target.id,
					empire: out.defenderEmpire,
					gold: out.defenderGold,
					news: out.news,
					note: out.note
				} }
			};
		}
		case "monsterStart": {
			if (state.fight) {
				if (!state.fight.monster) return refuse("fight-open", "You are in the middle of a fight. Finish it first!");
				return done(state, {
					type: "monsterStart",
					resumed: true,
					right: state.fight.monster.siege.right,
					answer: null
				}, false);
			}
			if (!monsterWeek(clock)) return refuse("not-yet", "The monster has not come yet. It arrives in the last week of the season.");
			const season = clock.number;
			const save = monsterSave(clan, season);
			if (save.lastDay === ctx.today) return refuse("tried-today", "You have had your try today. Come back tomorrow!");
			if (!clan.members.some((m) => !m.knockedOut)) return refuse("resting", "Everyone is resting. They wake up tomorrow.");
			const seed = monsterSeed(state.seed, season, save.tries);
			const marked = markSiege(seed, settings, action.siege);
			const arrows = save.supplies.arrows;
			const siege = playSiege(clan, arrows, marked.right, seed);
			const setup = {
				kind: monsterOf(season),
				losses: save.wonDay === void 0 ? save.losses : 0,
				siege: siege.share,
				potions: save.supplies.potions,
				net: save.supplies.net > 0,
				walls: empireOf(clan).levels.walls
			};
			state.fight = {
				depth: CONFIG.monster.depth,
				boss: false,
				seed,
				no: state.fightNo + 1,
				settings,
				rounds: [],
				monster: {
					setup,
					siege
				}
			};
			if (action.ladder && ctx.maths) {
				state.fight.questions = makeRunQuestions(ctx.maths, CONFIG.monster.rounds, seededRandom(`clans:monster:${seed}:${state.fightNo + 1}`));
				state.fight.marks = [];
			}
			state.fightNo++;
			clan.monster = {
				...save,
				tries: save.tries + 1,
				lastDay: ctx.today,
				supplies: {
					...save.supplies,
					arrows: 0
				}
			};
			const answers = marked.question && action.siege !== null ? [{
				key: factKey$1(settings.yearBand, marked.question.kind),
				correct: marked.right === true
			}] : void 0;
			return done(state, {
				type: "monsterStart",
				resumed: false,
				right: marked.right,
				answer: marked.question ? marked.question.answer : null
			}, true, answers ? { answers } : void 0);
		}
		case "buySupply": {
			if (!suppliesOnSale(clock)) return refuse("not-yet", "Monster supplies are sold in the last two weeks of the season.");
			const out = buySupply(clan, clock.number, action.kind, action.count);
			return out.ok ? done(state, { type: "buySupply" }) : refuse(out.why, out.say);
		}
		case "repick": {
			if (clan.repick === void 0 || clan.repick !== clan.season) return refuse("repick", "Your clan is already on its way this season.");
			const m = clan.members[action.member];
			if (!m) return refuse("member", "Pick one of your clan.");
			if (m.level !== 1 || m.xp !== 0) return refuse("repick", `${m.name} has already started this season.`);
			if (!raceByName(action.race) || !classByName(action.cls)) return refuse("choice", "Pick a race and a class from the lists.");
			const fresh = rollMember({ rng: Math.imul(slotSeed(state.seed, action.member) | 0, 2654435761) + (clan.season ?? 0) * 7919 }, m.name, action.race, action.cls, action.member === 0);
			clan.members[action.member] = {
				...fresh,
				...m.look ? { look: m.look } : {}
			};
			return done(state, { type: "repick" });
		}
		case "repickDone":
			if (clan.repick === void 0) return done(state, { type: "repickDone" }, rested || upgraded);
			delete clan.repick;
			return done(state, { type: "repickDone" });
		case "fightStart": {
			if (state.fight) return state.fight.monster ? refuse("fight-open", "You are in the middle of the monster fight. Finish it first!") : done(state, {
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
			if (action.ladder && ctx.maths) {
				state.fight.questions = makeRunQuestions(ctx.maths, CONFIG.maxRounds, seededRandom(`clans:${seed}:${state.fightNo + 1}`));
				state.fight.marks = [];
			}
			state.fightsLeft--;
			state.fightNo++;
			return done(state, {
				type: "fightStart",
				resumed: false
			});
		}
		case "cryCheck": {
			const open = state.fight;
			if (!open) return refuse("no-fight", "That fight is already over.");
			if (!open.questions || !open.marks) return refuse("no-question", "There is no question to answer.");
			if (action.round !== open.rounds.length + 1) return refuse("stale-round", "That round was already played.");
			const marked = markQuestion(open.questions[action.round - 1]);
			if (!marked) return refuse("no-question", "There is no question to answer.");
			const before = open.marks[action.round - 1];
			if (before) return done(state, {
				type: "cryCheck",
				round: action.round,
				correct: before.correct,
				answer: marked.answer,
				given: before.answer
			}, false);
			const correct = sameAnswer(action.answer, marked.answer);
			while (open.marks.length < action.round - 1) open.marks.push(null);
			open.marks[action.round - 1] = {
				answer: action.answer,
				correct
			};
			return done(state, {
				type: "cryCheck",
				round: action.round,
				correct,
				answer: marked.answer,
				given: action.answer
			}, true, { ladder: {
				once: `clans:${open.seed}:${open.no}:${action.round}`,
				answers: [{
					key: marked.key,
					correct,
					ms: action.ms
				}]
			} });
		}
		case "fightRound": {
			const open = state.fight;
			if (!open) return refuse("no-fight", "That fight is already over.");
			if (action.round !== open.rounds.length + 1) return refuse("stale-round", "That round was already played.");
			const played = {
				orders: action.orders,
				cry: action.cry
			};
			const { state: replayed, cries } = replayFight(clan.members, open.depth, open.seed, open.boss, [...open.rounds, played], open, open.monster ? fightOf(clan.members, open) : void 0);
			if (cries.length !== open.rounds.length + 1) return refuse("no-fight", "That fight is already over.");
			const cry = cries[cries.length - 1];
			const answers = cry.answered && cry.question ? [{
				key: factKey$1(open.settings.yearBand, cry.question.kind),
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
			if (open.monster) {
				const season = clan.season ?? clock?.number ?? 0;
				const save = monsterSave(clan, season);
				const potionsUsed = open.monster.setup.potions - (replayed.monster?.potions ?? open.monster.setup.potions);
				const netUsed = open.monster.setup.net && replayed.monster?.net === false ? 1 : 0;
				const first = won && save.wonDay === void 0;
				clan.monster = {
					...save,
					losses: won || save.wonDay !== void 0 ? save.losses : save.losses + 1,
					...first ? { wonDay: clock?.day ?? 0 } : {},
					supplies: {
						...save.supplies,
						potions: Math.max(0, save.supplies.potions - potionsUsed),
						net: Math.max(0, save.supplies.net - netUsed)
					}
				};
				const monster = {
					kind: open.monster.setup.kind,
					season,
					won,
					first,
					tries: clan.monster.tries
				};
				return done(state, {
					type: "fightRound",
					round: action.round,
					over: true,
					summary,
					monster,
					...earnedPart(earnedOrNone({ cries: rightCry }))
				}, true, effects);
			}
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
*
* Ladder fights (20 Oct 2026): a `fightStart` that asks for one loads the child's maths (records, class settings, focus) so the rules
* can make the fight's Battle Cry questions; `publicState` sends the browser only what to show of them, never an answer. Each
* `cryCheck` answer goes in the child's own maths records (ladder place, skill map, focus results) once its save is kept.
*/
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
/** A batch id for the answers of one request: the same request always gives the same id, so a retry is never counted twice. */
async function batchIdFor(key) {
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`clans:${key}`)));
	const h = hex(digest.slice(0, 16));
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The fight in progress as the browser may see it: a ladder fight's questions with no answers (the marks so far are its own). */
function publicFight(fight) {
	const { questions, ...rest } = fight;
	return questions ? {
		...rest,
		questions: questions.map((q, i) => publicQuestion(q, i))
	} : rest;
}
/** What the browser is told about a clan: everything it shows, nothing it could use to cheat. */
function publicState(state, settings, loaded, extras) {
	const { clan, seed, day, fightsLeft, fightNo, raidNo, fight } = state;
	return {
		clan,
		seed,
		day,
		fightsLeft,
		fightNo,
		raidNo,
		fight: fight ? publicFight(fight) : null,
		settings,
		news: loaded.news,
		raidsOn: loaded.raidsOn ?? false,
		notes: loaded.notes ?? [],
		fame: extras?.fame ?? 0,
		season: extras?.settings.season ?? 1,
		fightsPerDay: extras?.settings.fightsPerDay ?? CONFIG.fightsPerDay,
		achievements: extras?.achievements ?? [],
		clock: readClock(extras?.clock)
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
		const typedNames = extras.value.settings.typedNames === true;
		const clock = readClock(extras.value.clock);
		const maths = action.type === "fightStart" && action.ladder ? await services.mathsContext(player) : void 0;
		for (let attempt = 0; attempt < 4; attempt++) {
			const loaded = await services.load(player, requestId);
			if (!loaded.ok) return loaded.why === "busy" ? reply(503, { error: "We couldn't reach your clan just now." }) : reply(400, { error: "That couldn't be read." });
			const { seed, version, state, replay, enabled } = loaded.value;
			if (!enabled) return reply(403, {
				error: "Clan Quest is not switched on yet.",
				off: true
			});
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
				maths,
				fightsPerDay,
				groupVillage: loaded.value.groupVillage ?? null,
				self: loaded.value.self ?? void 0,
				raidsOn: loaded.value.raidsOn ?? false,
				typedNames,
				clock
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
			if (!applied.changed || !applied.state) return reply(200, {
				ok: true,
				replayed: false,
				seed,
				state: applied.state && shown(applied.state),
				result: applied.result,
				...applied.newSeason ? { newSeason: true } : {}
			});
			const saved = effects.raid ? target ? await services.saveRaid(player, version, {
				targetId: target.id,
				targetVersion: target.version,
				empire: effects.raid.empire,
				gold: effects.raid.gold,
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
				if (effects.ladder?.answers.length) {
					const at = services.now();
					await services.recordLadderAnswers(player, effects.ladder.once, effects.ladder.answers.map((a) => ({
						...a,
						at
					})));
				}
				const fresh = await services.extras(player);
				if (fresh.ok) extras = fresh;
				let latest = loaded.value;
				if (applied.result.type === "raidClass") {
					const again = await services.load(player, "00000000-0000-4000-8000-000000000000");
					if (again.ok) latest = again.value;
				}
				return reply(200, {
					ok: true,
					replayed: false,
					seed,
					state: shown(applied.state, latest),
					result: applied.result,
					...applied.newSeason ? { newSeason: true } : {}
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
	userIdFor: userIdFromToken(admin.auth),
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
	async mathsContext(player) {
		const { data, error } = await admin.rpc("space_maths_context", { player });
		if (error || !data) {
			console.error(`clans: maths records failed (${error?.code ?? "none"})`);
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
	async recordLadderAnswers(player, once, answers) {
		await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, "clans");
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
		defender_gold: raid.gold,
		result,
		news: raid.news,
		note: raid.note
	})
}));
//#endregion
