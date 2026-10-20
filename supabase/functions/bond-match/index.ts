// GENERATED FILE: don't edit. Edit supabase/functions/bond-match/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "bond-match" function.

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
//#region shared/bond-match/exact.ts
const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);
function exact(n, d = 1) {
	const g = gcd(n, d) || 1;
	return {
		n: n / g,
		d: d / g
	};
}
const addExact = (a, b) => exact(a.n * b.d + b.n * a.d, a.d * b.d);
const sameExact = (a, b) => a.n === b.n && a.d === b.d;
function sideValue(side) {
	if (side.kind === "whole") return exact(side.n);
	if (side.kind === "decimal") return exact(side.units, 10 ** side.places);
	return exact(side.num, side.den);
}
const formatUnits = (units, places) => {
	if (places === 0) return String(units);
	const scale = 10 ** places;
	return `${Math.floor(units / scale)}.${String(units % scale).padStart(places, "0")}`;
};
/** How a side is written: "7", "0.30", "3/8". */
function sideText(side) {
	if (side.kind === "whole") return String(side.n);
	if (side.kind === "decimal") return formatUnits(side.units, side.places);
	return `${side.num}/${side.den}`;
}
/** The sum of some sides written exactly: "1.0", "0.75", "100", "9/8". Never has floating point noise. */
function sumText(sides) {
	const sum = sides.map(sideValue).reduce(addExact, exact(0));
	if (sides.some((s) => s.kind === "fraction")) return sum.d === 1 ? String(sum.n) : `${sum.n}/${sum.d}`;
	const places = Math.max(0, ...sides.map((s) => s.kind === "decimal" ? s.places : 0));
	return formatUnits(sum.n * 10 ** places / sum.d, places);
}
//#endregion
//#region shared/bond-match/bonds.ts
/**
* The bond sets: what a player can choose to practise. A bond set is data, so a new bond is one
* entry in BOND_SETS. A pair is two sides that add up to the target; each side can be a whole
* number, a decimal or a fraction, so the "mixed forms" shelf (1/4 with 0.75) fits the same shape.
*/
const range = (from, to, step = 1) => {
	const out = [];
	for (let n = from; n <= to; n += step) out.push(n);
	return out;
};
const whole = (n) => ({
	kind: "whole",
	n
});
const decimal = (units, places) => ({
	kind: "decimal",
	units,
	places
});
const fraction = (num, den) => ({
	kind: "fraction",
	num,
	den
});
/** Whole numbers a + (total - a), for a = from, from + step, ... up to half of the total. */
function wholeSet(id, label, total, from, step) {
	return {
		id,
		label,
		shelf: "whole",
		target: exact(total),
		pairs: range(from, total / 2, step).map((a) => [whole(a), whole(total - a)])
	};
}
/** Decimals with a fixed number of places: `totalUnits` is the target in units of 10^-places. */
function decimalSet(id, label, places, totalUnits) {
	return {
		id,
		label,
		shelf: "decimal",
		target: exact(totalUnits, 10 ** places),
		pairs: range(1, totalUnits / 2).map((a) => [decimal(a, places), decimal(totalUnits - a, places)])
	};
}
/** Fractions that make 1 whole, all over the same denominator. */
function fractionSet(id, label, den) {
	return {
		id,
		label,
		shelf: "fraction",
		target: exact(1),
		pairs: range(1, Math.floor(den / 2)).map((a) => [fraction(a, den), fraction(den - a, den)])
	};
}
const BOND_SETS = [
	wholeSet("whole-10", "To 10", 10, 1, 1),
	wholeSet("whole-20", "To 20", 20, 1, 1),
	wholeSet("whole-100-tens", "To 100 (tens)", 100, 10, 10),
	wholeSet("whole-100-any", "To 100 (any)", 100, 1, 1),
	wholeSet("whole-1000-hundreds", "To 1000 (hundreds)", 1e3, 100, 100),
	wholeSet("whole-1000-tens", "To 1000 (tens)", 1e3, 10, 10),
	decimalSet("decimal-1-tenths", "To 1 (tenths)", 1, 10),
	decimalSet("decimal-1-hundredths", "To 1 (hundredths)", 2, 100),
	decimalSet("decimal-10-tenths", "To 10 (tenths)", 1, 100),
	fractionSet("fraction-halves", "Halves", 2),
	fractionSet("fraction-thirds", "Thirds", 3),
	fractionSet("fraction-quarters", "Quarters", 4),
	fractionSet("fraction-fifths", "Fifths", 5),
	fractionSet("fraction-sixths", "Sixths", 6),
	fractionSet("fraction-eighths", "Eighths", 8),
	fractionSet("fraction-tenths", "Tenths", 10)
];
const findBondSet = (id) => BOND_SETS.find((b) => b.id === id);
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
//#region shared/bond-match/deck.ts
/**
* Building a deck: which pairs go on the board and where the cards lie. Everything comes from
* (bond set, board size, seed), so the same inputs always give the same deck.
*/
const BOARD_SIZES = [
	"small",
	"medium",
	"large"
];
/** Pairs wanted on each board: 12, 16 and 20 cards. */
const BOARD_PAIRS = {
	small: 6,
	medium: 8,
	large: 10
};
const isSeed = (n) => Number.isInteger(n) && n >= 0 && n <= 2147483647;
/**
* How many pairs the board can really hold: what was asked for, but no more than every pair twice.
* A set with only one pair (halves) makes a board of 2 pairs, not 6.
*/
const pairsOnBoard = (set, size) => Math.min(BOARD_PAIRS[size], set.pairs.length * 2);
function shuffle(items, random) {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
function buildDeck(set, size, seed) {
	if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
	const random = seeded(seed);
	random();
	random();
	const wanted = pairsOnBoard(set, size);
	const first = shuffle(set.pairs, random).slice(0, wanted);
	const again = shuffle(set.pairs, random).slice(0, wanted - first.length);
	const cards = [];
	[...first.map((p) => ({
		p,
		set: 0
	})), ...again.map((p) => ({
		p,
		set: 1
	}))].forEach(({ p, set: colour }, pair) => {
		cards.push({
			side: p[0],
			set: colour,
			pair
		}, {
			side: p[1],
			set: colour,
			pair
		});
	});
	return {
		bondId: set.id,
		target: set.target,
		size,
		seed,
		cards: shuffle(cards, random),
		pairCount: wanted
	};
}
/**
* Do these two cards add up to the target? That is all a match needs (James, 20 Oct 2026): any 3 matches any 7, so a
* child who finds a right pair is never told it's wrong. (A card's `set` only says which round of dealing it came from.)
*/
const arePartners = (target, a, b) => sameExact(addExact(sideValue(a.side), sideValue(b.side)), target);
//#endregion
//#region shared/bond-match/engine.ts
/**
* The rules of Bond Match, as pure functions: flip a card, get the new state and what happened.
* No clock, no random, no screen, so the browser and the server run exactly the same game.
*
* A turn is two flips. If the two cards add up to the target they match and stay up. If not they stay face up (so the screen can show "3 + 4 = 7") until the next
* flip, which turns them back first.
*/
const newGame = (deck) => ({
	deck,
	matched: deck.cards.map(() => false),
	pairedWith: deck.cards.map(() => -1),
	matchNo: deck.cards.map(() => -1),
	shown: [],
	flips: 0,
	log: [],
	finished: false
});
function flip(state, index) {
	const { deck } = state;
	const refuse = (refused) => ({
		state,
		events: [],
		refused
	});
	if (!Number.isInteger(index) || index < 0 || index >= deck.cards.length) return refuse("no-such-card");
	if (state.matched[index]) return refuse("already-matched");
	const waiting = state.shown.length === 1 ? state.shown[0] : void 0;
	if (waiting === index) return refuse("same-card");
	const log = [...state.log, index];
	const card = deck.cards[index];
	if (waiting === void 0) return {
		state: {
			...state,
			shown: [index],
			log
		},
		events: [{
			type: "first",
			card: index,
			text: sideText(card.side)
		}]
	};
	const other = deck.cards[waiting];
	const texts = [sideText(other.side), sideText(card.side)];
	const flips = state.flips + 1;
	if (arePartners(deck.target, other, card)) {
		const matched = state.matched.map((m, i) => m || i === index || i === waiting);
		const pairedWith = state.pairedWith.map((p, i) => i === index ? waiting : i === waiting ? index : p);
		const n = Math.max(-1, ...state.matchNo) + 1;
		const matchNo = state.matchNo.map((m, i) => i === index || i === waiting ? n : m);
		const finished = matched.every(Boolean);
		const events = [{
			type: "match",
			cards: [waiting, index],
			texts,
			sumText: sumText([other.side, card.side])
		}];
		if (finished) events.push({
			type: "finish",
			flips
		});
		return {
			state: {
				...state,
				matched,
				pairedWith,
				matchNo,
				shown: [],
				flips,
				log,
				finished
			},
			events
		};
	}
	const values = [sideValue(other.side), sideValue(card.side)];
	const sum = addExact(values[0], values[1]);
	return {
		state: {
			...state,
			shown: [waiting, index],
			flips,
			log
		},
		events: [{
			type: "mismatch",
			cards: [waiting, index],
			texts,
			values,
			sum,
			sumText: sumText([other.side, card.side])
		}]
	};
}
//#endregion
//#region shared/bond-match/score.ts
/** The star thresholds, in one place. Gold: flips within goldWithin x the minimum. Silver: within silverWithin x. Finishing is bronze. */
const STAR_CONFIG = {
	goldWithin: 1.5,
	silverWithin: 2.5
};
/** The fewest flips that can clear this deck: one per pair. */
const minFlips = (state) => state.deck.pairCount;
function starsFor(flips, min, config = STAR_CONFIG) {
	if (flips <= min * config.goldWithin) return 3;
	if (flips <= min * config.silverWithin) return 2;
	return 1;
}
/** The score of a finished game, or null if it isn't finished. `seconds` is rounded down to a whole number. */
function scoreGame(state, seconds) {
	if (!state.finished) return null;
	const min = minFlips(state);
	return {
		flips: state.flips,
		seconds: Math.max(0, Math.floor(seconds)),
		minFlips: min,
		stars: starsFor(state.flips, min)
	};
}
function replay(save) {
	if (!isSeed(save.seed)) return {
		ok: false,
		error: "bad seed"
	};
	const set = findBondSet(save.bondId);
	if (!set) return {
		ok: false,
		error: "unknown bond set"
	};
	if (!BOARD_SIZES.includes(save.size)) return {
		ok: false,
		error: "unknown board size"
	};
	if (!Number.isInteger(save.seconds) || save.seconds < 0 || save.seconds > 86400) return {
		ok: false,
		error: "bad time"
	};
	if (!Array.isArray(save.flips)) return {
		ok: false,
		error: "bad flips"
	};
	let state = newGame(buildDeck(set, save.size, save.seed));
	for (const [n, index] of save.flips.entries()) {
		if (state.finished) return {
			ok: false,
			error: `flip ${n + 1} came after the game finished`
		};
		const result = flip(state, index);
		if (result.refused) return {
			ok: false,
			error: `flip ${n + 1} is illegal (${result.refused})`
		};
		state = result.state;
	}
	const score = scoreGame(state, save.seconds);
	if (!score) return {
		ok: false,
		error: "the game did not finish"
	};
	return {
		ok: true,
		state,
		score
	};
}
/**
* The numbers the server and the website share, in one place.
* - minSecondsPerCardFlip: a game faster than this is not a human (one flip of a card, not of a pair).
* - pointsPerGame: small taking-part points for a finished game, whatever the stars. Grinding easy decks earns little.
* - pointsGamesPerDay: only this many finished games a day earn points. They also share the hub's daily cap with the bot games.
* - maxGamesPerDay: more finished games than this in a day are refused (a stuck loop, not a child).
*/
const BOND_MATCH_SAVE = {
	minSecondsPerCardFlip: .5,
	pointsPerGame: 2,
	pointsGamesPerDay: 10,
	maxGamesPerDay: 100
};
const GAME_MODES = [
	"solo",
	"pass",
	"bot"
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The fewest seconds a game with this many card flips can honestly take. */
const minSecondsFor = (cardFlips) => cardFlips * BOND_MATCH_SAVE.minSecondsPerCardFlip;
/**
* Checks one item from the website: the right shape, then the replay (the server's own stars, flips
* and deck, never the browser's), then that the time is possible for a human.
*/
function checkItem(raw) {
	if (typeof raw !== "object" || raw === null) return {
		ok: false,
		problem: "not an object"
	};
	const r = raw;
	if (typeof r.runId !== "string" || !UUID.test(r.runId)) return {
		ok: false,
		problem: "bad run id"
	};
	if (typeof r.bondId !== "string" || typeof r.size !== "string") return {
		ok: false,
		problem: "bad bond or size"
	};
	if (!Number.isInteger(r.seed) || !Number.isInteger(r.seconds)) return {
		ok: false,
		problem: "bad numbers"
	};
	if (!Array.isArray(r.flips) || r.flips.length > 400 || !r.flips.every((n) => Number.isInteger(n))) return {
		ok: false,
		problem: "bad flips"
	};
	if (r.mode !== void 0 && !GAME_MODES.includes(r.mode)) return {
		ok: false,
		problem: "bad mode"
	};
	const item = {
		runId: r.runId,
		mode: r.mode ?? "solo",
		seed: r.seed,
		bondId: r.bondId,
		size: r.size,
		flips: r.flips,
		seconds: r.seconds
	};
	const played = replay(item);
	if (!played.ok) return {
		ok: false,
		problem: played.error
	};
	if (item.seconds < minSecondsFor(item.flips.length)) return {
		ok: false,
		problem: "too fast"
	};
	return {
		ok: true,
		item,
		score: played.score
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
function makeHandler(services, now = () => Date.now()) {
	const limiter = new RateLimiter(now);
	return async function handleBondMatch(request) {
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
		const on = await services.isOn(player);
		if (on === null) return reply(503, { error: "We couldn't save your game just now." });
		if (!on) return reply(403, { error: "Bond Match isn’t switched on for your class." });
		const body = await readJsonBody(request);
		if (!body || !Array.isArray(body.items) || body.items.length > 20) return reply(400, { error: "That couldn't be read." });
		const results = [];
		for (const raw of body.items) {
			const checked = checkItem(raw);
			if (!checked.ok) {
				console.warn(`bond-match: refused an item (${checked.problem})`);
				results.push({
					status: "invalid",
					problem: checked.problem
				});
				continue;
			}
			const { item, score } = checked;
			const saved = await services.recordGame(player, {
				...item,
				flipCount: score.flips,
				stars: score.stars
			});
			if (saved.ok) results.push(saved.value);
			else if (saved.why === "refused") results.push({
				status: "invalid",
				problem: "refused"
			});
			else break;
		}
		if (results.length < body.items.length && results.length === 0) return reply(503, { error: "We couldn't save your game just now." });
		return reply(200, {
			handled: results.length,
			results
		});
	};
}
//#endregion
//#region supabase/functions/bond-match/entry.ts
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
	console.error(`bond-match: ${name} failed (${error.code ?? "unknown"})`);
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
	userIdFor: userIdFromToken(admin.auth),
	async isOn(player) {
		const { data, error } = await admin.rpc("settings_of", { player }).maybeSingle();
		if (error || !data) {
			console.error(`bond-match: settings failed (${error?.code ?? "none"})`);
			return null;
		}
		return data.bond_match_enabled === true;
	},
	recordGame: (player, game) => call("record_bond_match_game", {
		player,
		game
	})
}));
//#endregion
