// GENERATED FILE: don't edit. Edit supabase/functions/card-game/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "card-game" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
//#region shared/space/random.ts
/** A shuffled copy (Fisher–Yates), using the dice. */
function shuffled(dice, list) {
	const copy = [...list];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = dice(i + 1) - 1;
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}
//#endregion
//#region shared/card101/random.ts
/**
* Dice from secure randomness (crypto.getRandomValues, in Deno, browsers and Node).
* Uses "rejection sampling", so every side is exactly as likely as every other.
*/
const secureDice = (sides) => {
	if (!Number.isInteger(sides) || sides < 1 || sides > 2 ** 32) throw new Error("secureDice: bad number of sides");
	const limit = 2 ** 32 - 2 ** 32 % sides;
	const buffer = new Uint32Array(1);
	for (;;) {
		crypto.getRandomValues(buffer);
		if (buffer[0] < limit) return 1 + buffer[0] % sides;
	}
};
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
//#region shared/card101/cards.ts
/**
* The pack for 101: 52 cards, each written as two characters, rank then suit.
* Ranks: A 2 3 4 5 6 7 8 9 T(en) J Q K. Suits: C(lubs) D(iamonds) H(earts) S(pades).
* So "QH" is the Queen of hearts and "TS" the 10 of spades.
*
* Two characters, always upper case, so a test can find every card in any message
* with one pattern (CARD_PATTERN) and prove no hidden card ever leaves the server.
*/
const RANKS = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"T",
	"J",
	"Q",
	"K"
];
/** Every card, in a fixed order (shuffle a copy). */
const PACK = [
	"C",
	"D",
	"H",
	"S"
].flatMap((suit) => RANKS.map((rank) => `${rank}${suit}`));
const rankOf = (card) => card[0];
/** What a card scores on its own: King 0, 3 0, Ace 1, 2 and 4–10 face value, Jack and Queen 10. */
function cardValue(card) {
	const rank = rankOf(card);
	if (rank === "K" || rank === "3") return 0;
	if (rank === "A") return 1;
	if (rank === "T" || rank === "J" || rank === "Q") return 10;
	return Number(rank);
}
/** Where each of your four cards sits. The bottom two (nearest you) are the ones you peek at. */
const SLOTS = [
	0,
	1,
	2,
	3
];
const PEEK_SLOTS = [2, 3];
const isSlot = (value) => SLOTS.includes(value);
//#endregion
//#region shared/card101/score.ts
/**
* Scoring a hand of four cards, the way James's family plays (docs/101-RULES.md):
*
*   1. Three or four of a kind: the whole hand scores 0.
*   2. Pairs: two cards of the same rank, anywhere, cancel each other (both score 0).
*   3. 3s: each 3 scores 0 and cancels the highest card still counting. A tie for highest
*      cancels just one card. Two 3s cancel two cards (even though they're also a pair).
*   4. Add up what's left.
*
* Besides the total, it returns each step, so the end-of-round screen can show the
* working: "the 7s cancel", "the 3 cancels the Queen", "4 + 0 = 4".
*/
function scoreHand(hand) {
	const values = hand.map(cardValue);
	const steps = [];
	const slotsByRank = new Map();
	hand.forEach((card, slot) => {
		const rank = rankOf(card);
		slotsByRank.set(rank, [...slotsByRank.get(rank) ?? [], slot]);
	});
	for (const [rank, slots] of slotsByRank) if (slots.length >= 3) {
		steps.push({
			kind: "triple",
			rank,
			slots
		});
		return {
			total: 0,
			values: values.map(() => 0),
			steps
		};
	}
	const cancelled = new Set();
	for (const [rank, slots] of slotsByRank) if (slots.length === 2) {
		steps.push({
			kind: "pair",
			rank,
			slots: [slots[0], slots[1]]
		});
		for (const slot of slots) cancelled.add(slot);
	}
	for (const three of slotsByRank.get("3") ?? []) {
		let highest = -1;
		hand.forEach((_, slot) => {
			if (cancelled.has(slot) || values[slot] === 0) return;
			if (highest < 0 || values[slot] > values[highest]) highest = slot;
		});
		if (highest < 0) break;
		steps.push({
			kind: "three-cancels",
			three,
			cancels: highest,
			value: values[highest]
		});
		cancelled.add(highest);
	}
	const finalValues = values.map((value, slot) => cancelled.has(slot) ? 0 : value);
	return {
		total: finalValues.reduce((a, b) => a + b, 0),
		values: finalValues,
		steps
	};
}
const TARGETS = [101, 50];
var RuleError = class extends Error {};
const fail = (message) => {
	throw new RuleError(message);
};
const activeSeats = (game) => game.totals.map((_, seat) => seat).filter((seat) => !game.out[seat]);
/** Starts a game. The first round is dealt straight away; `dice` shuffles and picks who starts. */
function newGame(players, settings, dice) {
	if (!Number.isInteger(players) || players < 2 || players > 4) fail("2 to 4 players");
	if (!TARGETS.includes(settings.target)) fail("Unknown target");
	const game = {
		settings: { target: settings.target },
		players,
		totals: Array(players).fill(0),
		out: Array(players).fill(false),
		round: 0,
		starter: dice(players) - 1,
		phase: "round-over",
		hands: Array.from({ length: players }, () => []),
		faceUp: Array.from({ length: players }, () => []),
		stack: [],
		discard: [],
		turn: 0,
		holding: null,
		turnsThisRound: Array(players).fill(0),
		knocker: null,
		owesLastTurn: Array(players).fill(false),
		peeked: Array(players).fill(false),
		skips: Array(players).fill(0),
		results: [],
		winners: null
	};
	const events = [];
	deal(game, dice, events, false);
	return {
		game,
		events
	};
}
/** Plays one action. Throws RuleError (and changes nothing) if it isn't allowed. */
function play(game, actor, action, dice) {
	const g = structuredClone(game);
	const events = [];
	apply(g, actor, action, dice, events);
	return {
		game: g,
		events
	};
}
function apply(g, actor, action, dice, events) {
	if (g.phase === "over") fail("The game is over");
	const seat = actor === "system" ? null : actor;
	if (seat !== null && (!Number.isInteger(seat) || seat < 0 || seat >= g.players)) fail("No such player");
	if (seat !== null && g.out[seat]) fail("You're out of this game");
	switch (action.type) {
		case "peek-done":
			if (seat === null) fail("Only a player can finish their peek");
			if (g.phase !== "peek") fail("It isn't peek time");
			if (g.peeked[seat]) fail("Your peek is already over");
			g.peeked[seat] = true;
			events.push({
				kind: "peek-done",
				seat
			});
			startPlayIfPeeksDone(g, events);
			return;
		case "end-peek":
			if (seat !== null) fail("Only the referee can end the peek");
			if (g.phase !== "peek") fail("It isn't peek time");
			for (const s of activeSeats(g)) g.peeked[s] = true;
			startPlayIfPeeksDone(g, events);
			return;
		case "next-round":
			if (seat !== null) fail("Only the referee deals");
			if (g.phase !== "round-over") fail("The round isn't over");
			deal(g, dice, events, true);
			return;
		case "leave":
			if (seat === null) fail("Only a player can leave");
			putOut(g, seat, "left", events);
			return;
		case "skip": {
			if (seat !== null) fail("Only the referee can skip a turn");
			if (g.phase !== "play") fail("Nobody's turn to skip");
			const skipped = g.turn;
			const discarded = g.holding ? g.holding.card : null;
			if (g.holding) g.discard.push(g.holding.card);
			g.holding = null;
			events.push({
				kind: "skip",
				seat: skipped,
				discarded
			});
			g.skips[skipped] += 1;
			if (g.skips[skipped] >= 3) {
				putOut(g, skipped, "skipped", events);
				return;
			}
			endTurn(g, events);
			return;
		}
	}
	if (g.phase !== "play") fail("It isn't time to play");
	if (seat === null) fail("Only a player can do that");
	if (seat !== g.turn) fail("It isn't your turn");
	g.skips[seat] = 0;
	switch (action.type) {
		case "draw":
			if (g.holding) fail("You're already holding a card");
			if (action.from === "discard") {
				const card = g.discard.pop() ?? fail("The discard pile is empty");
				g.holding = {
					card,
					from: "discard"
				};
				events.push({
					kind: "draw",
					seat,
					from: "discard",
					card
				});
			} else if (action.from === "stack") {
				if (g.stack.length === 0) reshuffle(g, dice, events);
				const card = g.stack.pop() ?? fail("There are no cards left to draw");
				g.holding = {
					card,
					from: "stack"
				};
				events.push({
					kind: "draw",
					seat,
					from: "stack",
					card
				});
			} else fail("Draw from the stack or the discard pile");
			return;
		case "swap": {
			if (!g.holding) fail("Take a card first");
			if (!isSlot(action.slot)) fail("Pick one of your four cards");
			if (g.faceUp[seat][action.slot]) fail("That card is face up, so it stays. Pick a face-down card, or throw it away");
			const discarded = g.hands[seat][action.slot];
			const placed = g.holding.card;
			g.hands[seat][action.slot] = placed;
			g.faceUp[seat][action.slot] = true;
			g.discard.push(discarded);
			g.holding = null;
			events.push({
				kind: "swap",
				seat,
				slot: action.slot,
				placed,
				discarded
			});
			endTurn(g, events);
			return;
		}
		case "throw": {
			if (!g.holding) fail("Take a card first");
			const card = g.holding.card;
			g.discard.push(card);
			g.holding = null;
			events.push({
				kind: "throw",
				seat,
				card
			});
			endTurn(g, events);
			return;
		}
		case "knock":
			if (!canKnock(g, seat)) fail(g.knocker !== null ? "Someone has already knocked" : "You can knock once everyone has had a turn");
			g.knocker = seat;
			for (const s of activeSeats(g)) g.owesLastTurn[s] = s !== seat;
			events.push({
				kind: "knock",
				seat
			});
			endTurn(g, events);
			return;
		default: fail("Unknown move");
	}
}
/** Whether this player could knock right now. */
function canKnock(g, seat) {
	return g.phase === "play" && g.turn === seat && !g.holding && g.knocker === null && activeSeats(g).every((s) => g.turnsThisRound[s] >= 1);
}
function startPlayIfPeeksDone(g, events) {
	if (activeSeats(g).some((s) => !g.peeked[s])) return;
	g.phase = "play";
	g.turn = g.out[g.starter] ? nextActive(g, g.starter) : g.starter;
	events.push({
		kind: "play-starts",
		turn: g.turn
	});
}
/** Shuffles a fresh pack and deals a round. `moveStarter`: the start moves one player along. */
function deal(g, dice, events, moveStarter) {
	g.round += 1;
	if (moveStarter) g.starter = nextActive(g, g.starter);
	const pack = shuffled(dice, PACK);
	g.hands = g.totals.map((_, seat) => g.out[seat] ? [] : pack.splice(0, 4));
	g.faceUp = g.hands.map((hand) => hand.map(() => false));
	g.discard = [pack.pop()];
	g.stack = pack;
	g.holding = null;
	g.turn = g.starter;
	g.turnsThisRound = Array(g.players).fill(0);
	g.knocker = null;
	g.owesLastTurn = Array(g.players).fill(false);
	g.peeked = g.out.map((out) => out);
	g.phase = "peek";
	events.push({
		kind: "deal",
		round: g.round,
		starter: g.starter,
		discardTop: g.discard[g.discard.length - 1]
	});
}
/** The stack is empty: shuffle the discard pile, except its top card, into a new stack. */
function reshuffle(g, dice, events) {
	const top = g.discard.pop();
	if (top === void 0 || g.discard.length === 0) {
		if (top !== void 0) g.discard.push(top);
		fail("There are no cards left to draw");
	}
	g.stack = shuffled(dice, g.discard);
	g.discard = [top];
	events.push({
		kind: "reshuffle",
		cards: g.stack.length
	});
}
function nextActive(g, from) {
	for (let step = 1; step <= g.players; step++) {
		const seat = (from + step) % g.players;
		if (!g.out[seat]) return seat;
	}
	return from;
}
/** The current player's turn is over: pass it on, or score the round after the last turns. */
function endTurn(g, events) {
	const finished = g.turn;
	g.turnsThisRound[finished] += 1;
	if (g.knocker !== null) g.owesLastTurn[finished] = false;
	passTurn(g, finished, events);
}
function passTurn(g, from, events) {
	if (g.knocker !== null) {
		for (let step = 1; step <= g.players; step++) {
			const seat = (from + step) % g.players;
			if (!g.out[seat] && g.owesLastTurn[seat]) {
				g.turn = seat;
				events.push({
					kind: "turn",
					seat,
					lastTurn: true
				});
				return;
			}
		}
		scoreRound(g, events);
		return;
	}
	g.turn = nextActive(g, from);
	events.push({
		kind: "turn",
		seat: g.turn,
		lastTurn: false
	});
}
function scoreRound(g, events) {
	const scores = g.hands.map((hand, seat) => g.out[seat] ? null : scoreHand(hand));
	const live = activeSeats(g);
	const lowest = Math.min(...live.map((s) => scores[s].total));
	for (const s of live) g.totals[s] += scores[s].total;
	const result = {
		round: g.round,
		hands: g.hands.map((hand, seat) => g.out[seat] ? [] : [...hand]),
		scores,
		winners: live.filter((s) => scores[s].total === lowest),
		knocker: g.knocker,
		totals: [...g.totals]
	};
	g.results.push(result);
	g.phase = "round-over";
	g.holding = null;
	events.push({
		kind: "round-end",
		result
	});
	if (live.some((s) => g.totals[s] >= g.settings.target)) finishGame(g, events);
}
function finishGame(g, events) {
	const live = activeSeats(g);
	const best = Math.min(...live.map((s) => g.totals[s]));
	g.winners = live.filter((s) => g.totals[s] === best);
	g.phase = "over";
	events.push({
		kind: "game-over",
		winners: g.winners,
		totals: [...g.totals]
	});
}
/** A player leaves or is skipped out: their cards leave the table and the others carry on. */
function putOut(g, seat, reason, events) {
	if (g.out[seat]) fail("You're out of this game");
	const wasTheirTurn = g.phase === "play" && g.turn === seat;
	if (wasTheirTurn && g.holding) {
		g.discard.push(g.holding.card);
		g.holding = null;
	}
	g.out[seat] = true;
	g.hands[seat] = [];
	g.faceUp[seat] = [];
	g.owesLastTurn[seat] = false;
	g.peeked[seat] = true;
	events.push({
		kind: "out",
		seat,
		reason
	});
	const live = activeSeats(g);
	if (live.length < 2) {
		g.winners = live;
		g.phase = "over";
		events.push({
			kind: "game-over",
			winners: live,
			totals: [...g.totals]
		});
		return;
	}
	if (g.phase === "peek") startPlayIfPeeksDone(g, events);
	else if (wasTheirTurn) passTurn(g, seat, events);
}
//#endregion
//#region shared/card101/view.ts
/**
* What one player is allowed to know. This is the ONLY way card information leaves the
* server in a classmates game: every function reply, every live update and every bot
* goes through `viewFor` and `eventsFor`.
*
* A player may see: the top of the discard pile; a card they've just drawn, while they
* hold it; a card anyone took from the discard pile (everyone saw it face up); every
* card swapped into a hand (those go in face up); their bottom two cards during the
* peek, and never again; and everyone's cards once a round is over. Nothing else: never
* the stack, never anyone's face-down cards, not even their own. `view.test.ts` plays thousands of games and checks every view for leaks.
*/
function viewFor(game, seat) {
	const holding = game.holding ? {
		seat: game.turn,
		from: game.holding.from,
		card: game.turn === seat || game.holding.from === "discard" ? game.holding.card : null
	} : null;
	const peekOn = game.phase === "peek" && !game.out[seat] && !game.peeked[seat];
	const roundShown = game.phase === "round-over" || game.phase === "over";
	const last = game.results[game.results.length - 1];
	return {
		seat,
		players: game.players,
		settings: { ...game.settings },
		round: game.round,
		phase: game.phase,
		turn: game.turn,
		starter: game.starter,
		totals: [...game.totals],
		out: [...game.out],
		cardsOnTable: game.hands.map((hand) => hand.length),
		faceUp: game.hands.map((hand, s) => hand.map((card, slot) => game.faceUp[s][slot] ? card : null)),
		stackCount: game.stack.length,
		discardTop: game.discard.length ? game.discard[game.discard.length - 1] : null,
		holding,
		peek: peekOn ? {
			slots: PEEK_SLOTS,
			cards: PEEK_SLOTS.map((slot) => game.hands[seat][slot])
		} : null,
		peeked: [...game.peeked],
		turnsThisRound: [...game.turnsThisRound],
		knocker: game.knocker,
		owesLastTurn: [...game.owesLastTurn],
		canKnock: canKnock(game, seat),
		skips: [...game.skips],
		lastRound: roundShown && last && last.round === game.round ? structuredClone(last) : null,
		history: game.results.map((r) => ({
			round: r.round,
			hands: r.scores.map((s) => s ? s.total : null),
			winners: [...r.winners],
			knocker: r.knocker,
			totals: [...r.totals]
		})),
		winners: game.winners ? [...game.winners] : null
	};
}
/**
* The events one player may see. A card drawn from the stack is shown only to the
* player who drew it, and only while they're still holding it (`game` is the game
* after the events), so once it's swapped in it's gone from their screen too.
*/
function eventsFor(events, seat, game) {
	return events.map((event) => {
		if (event.kind === "round-end") return (game.phase === "round-over" || game.phase === "over") && game.round === event.result.round ? structuredClone(event) : {
			kind: "round-end",
			result: {
				...structuredClone(event.result),
				hands: []
			}
		};
		if (event.kind !== "draw" || event.from !== "stack") return structuredClone(event);
		const stillHolding = game.phase === "play" && game.turn === seat && game.holding?.card === event.card;
		if (event.seat === seat && stillHolding) return { ...event };
		return {
			kind: "draw",
			seat: event.seat,
			from: "stack"
		};
	});
}
//#endregion
//#region shared/card101/save.ts
/** One player's stats from a game's rounds (bot games and classmates games alike). */
function statsFor(game, seat) {
	const stats = {
		zeroHands: 0,
		triples: 0,
		knockWins: 0,
		savedByThree: 0
	};
	for (const result of game.results) {
		const score = result.scores[seat];
		if (!score) continue;
		if (score.total === 0) stats.zeroHands += 1;
		if (score.steps.some((s) => s.kind === "triple")) stats.triples += 1;
		if (result.knocker === seat && result.winners.includes(seat)) stats.knockWins += 1;
		stats.savedByThree += score.steps.filter((s) => s.kind === "three-cancels" && s.value === 10).length;
	}
	return stats;
}
//#endregion
//#region shared/card101/live.ts
const PEEK_MS = 15e3;
const TURN_MS = 6e4;
const NEXT_ROUND_MS = 3e4;
/** A little extra on every clock, for slow Wi-Fi. Pages show the clock without it. */
const GRACE_MS = 1500;
function parseSettings(input) {
	if (typeof input !== "object" || input === null) return null;
	const s = input;
	if (Object.keys(s).length !== 1 || !TARGETS.includes(s.target)) return null;
	return { target: s.target };
}
const isWanted = (n) => Number.isInteger(n) && n >= 2 && n <= 4;
/** The seat rows for a game: one per student, each with only what they may know. */
function seatRows(id, info, game, events) {
	return info.players.flatMap((player, seat) => player ? [{
		game: id,
		player,
		seat,
		version: info.version,
		status: info.status,
		info,
		view: game ? viewFor(game, seat) : null,
		events: game ? eventsFor(events, seat, game) : []
	}] : []);
}
/** When the clock should next run out, after a change that produced `events`. */
function deadlineAfter(game, events, now, previous) {
	if (game.phase === "over") return null;
	if (!events.some((e) => e.kind === "deal" || e.kind === "play-starts" || e.kind === "turn" || e.kind === "round-end") && previous !== null) return previous;
	if (game.phase === "peek") return now + PEEK_MS;
	if (game.phase === "play") return now + TURN_MS;
	return now + NEXT_ROUND_MS;
}
/** What the referee does when the clock runs out. */
function timesUpAction(game) {
	if (game.phase === "peek") return { type: "end-peek" };
	if (game.phase === "play") return { type: "skip" };
	if (game.phase === "round-over") return { type: "next-round" };
	return null;
}
/** Between rounds: everyone still in has pressed Next. */
const allReady = (game, ready) => game.out.every((out, seat) => out || ready[seat]);
/** Places, wins and points at the end of a game. Players who are out place 0 and earn nothing. */
function outcomeOf(game) {
	const live = game.out.map((out) => !out);
	const places = game.totals.map((total, seat) => live[seat] ? 1 + game.totals.filter((t, other) => live[other] && t < total).length : 0);
	const enough = game.results.length >= 2;
	return {
		places,
		won: game.totals.map((_, seat) => live[seat] && (game.winners ?? []).includes(seat)),
		counts: live.map((stillIn) => stillIn && enough),
		stats: game.totals.map((_, seat) => statsFor(game, seat))
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
//#endregion
//#region supabase/functions/card-game/handler.ts
/**
* The card-game server function: the referee for 101 with classmates.
*
* The browser only ever asks: "take from the stack", "swap with my top-left card", "join the
* game with this code". This works out who's asking from their sign-in token (never from the
* request), shuffles with secure randomness, runs the shared rules engine (shared/card101),
* and saves the new game "only if the version is still N", so a double tap can't play twice.
*
* Hidden cards: the whole game lives in card_games, which no student can read. Every reply
* and every live update is one player's seat row, made by `viewFor` and `eventsFor`
* (shared/card101/view.ts): only what that player may know.
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
	"not-started": [409, "The game hasn’t started yet."],
	"not-host": [403, "Only the person who started the game can do that."],
	"need-players": [409, "You need at least 2 players to start. Share the code!"],
	illegal: [400, "You can’t do that right now."],
	over: [409, "This game has already finished."],
	out: [409, "You’re out of this game."],
	changed: [409, "The game changed just then. Have another look."],
	"too-many": [429, "Slow down a little! Try again in a minute."],
	"too-many-codes": [429, "That’s a lot of codes. Wait a minute, then try again."],
	"not-yet": [409, "There’s still time on the clock."],
	full: [409, "That game is full, or it has already started."],
	expired: [410, "That game stopped waiting. Ask your friend to make a new one."],
	"rematch-gone": [409, "That rematch has already started or stopped waiting."],
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
function cardGameHandler(services) {
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
			return reply(200, { seat: mySeat(await action({
				services,
				limiter,
				me,
				body
			}), me) });
		} catch (error) {
			if (error instanceof Refused) {
				if (![
					"changed",
					"not-yet",
					"not-found",
					"illegal"
				].includes(error.problem)) console.warn(`card-game: refused ${String(body.action)} (${error.problem})`);
				return refuse(error);
			}
			console.error(`card-game: ${String(body.action)} failed${error instanceof Error ? ` (${error.message.slice(0, 80)})` : ""}`);
			return refuse(new Refused("failed"));
		}
	};
}
/** My seat row from what was just saved. The log isn't sent back (the page keeps its own). */
function mySeat(saved, me) {
	const seat = saved.seats.find((s) => s.player === me);
	if (seat) return {
		...seat,
		log: []
	};
	const info = publicInfo(saved.row);
	return {
		game: saved.row.id,
		player: me,
		seat: -1,
		version: info.version,
		status: info.status,
		info,
		view: null,
		events: [],
		log: []
	};
}
const ACTIONS = {
	create,
	join,
	cancel: leave,
	leave,
	start,
	"peek-done": (c) => withRetries(c, (row, seat) => playAs(c, row, seat, { type: "peek-done" })),
	draw: (c) => turn(c, drawAction(c.body)),
	swap: (c) => turn(c, swapAction(c.body)),
	throw: (c) => turn(c, { type: "throw" }),
	knock: (c) => turn(c, { type: "knock" }),
	next: (c) => withRetries(c, (row, seat) => readyForNext(c, row, seat)),
	"times-up": timesUp,
	rematch
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
/** The players by seat: four slots while waiting, exactly one per player once dealt. */
const playersOf = (row) => row.game ? seatsOf(row).slice(0, row.game.players) : seatsOf(row);
function publicInfo(row) {
	return {
		code: row.status === "waiting" ? row.code : null,
		inLobby: row.in_lobby,
		host: row.host,
		players: playersOf(row),
		wanted: row.wanted,
		settings: row.settings,
		status: row.status,
		version: row.version,
		expiresAt: row.expires_at,
		deadline: row.deadline,
		ready: row.ready,
		ending: row.ending,
		places: row.places,
		counts: row.counts,
		rematchGame: row.rematch_game
	};
}
/** Saves a change (the version goes up by one) and every seat row with it. */
async function commit(services, row, patch, events = []) {
	const next = {
		...row,
		...patch,
		version: row.version + 1
	};
	const seats = seatRows(next.id, publicInfo(next), next.game, events);
	const saved = await services.write(row.version, next, seats);
	if (saved === "changed") throw new Refused("changed");
	if (typeof saved === "string") throw new Refused("failed");
	return {
		row: saved,
		seats
	};
}
/** The changes to save after the engine has played. */
function afterPlay(services, row, game, events) {
	const now = services.now();
	const patch = {
		game,
		last_action_at: iso(now)
	};
	if (game.phase === "over") {
		const outcome = outcomeOf(game);
		return {
			...patch,
			status: "finished",
			ending: "finished",
			deadline: null,
			ready: null,
			finished_at: iso(now),
			places: outcome.places,
			won: outcome.won,
			out_of_game: [...game.out],
			counts: outcome.counts,
			stats: outcome.stats
		};
	}
	const deadline = deadlineAfter(game, events, now, row.deadline ? Date.parse(row.deadline) : null);
	if (events.some((e) => e.kind === "round-end")) patch.ready = game.out.map(() => false);
	if (events.some((e) => e.kind === "deal")) patch.ready = null;
	return {
		...patch,
		deadline: deadline === null ? null : iso(deadline)
	};
}
/** Plays one action with the rules engine. Its messages are written for students. */
function runEngine(services, game, actor, action) {
	try {
		return play(game, actor, action, services.dice);
	} catch (error) {
		if (error instanceof RuleError) throw new Refused("illegal", { error: error.message });
		throw error;
	}
}
async function mustBeAllowed(services, player, forPlaying, others = []) {
	const status = await services.playerStatus(player, others);
	if (!status?.school) throw new Refused("sign-in");
	if (status.hidden) throw new Refused("hidden");
	if (forPlaying && !status.multiplayerEnabled) throw new Refused("paused");
	return status;
}
const gameId = (body) => {
	if (typeof body.gameId !== "string" || body.gameId.length > 64) throw new Refused("bad-request");
	return body.gameId;
};
async function loadMyGame(services, me, id) {
	const row = await services.loadGame(id);
	const seat = row ? playersOf(row).indexOf(me) : -1;
	if (!row || seat < 0) throw new Refused("not-yours");
	return {
		row,
		seat
	};
}
function mustBePlaying(row, seat) {
	if (row.status === "waiting") throw new Refused("not-started");
	if (row.status !== "playing" || !row.game) throw new Refused("over");
	if (row.game.out[seat]) throw new Refused("out");
	return row.game;
}
const otherPlayers = (row, me) => playersOf(row).filter((p) => p !== null && p !== me);
/**
* Students the teacher has hidden (or who have been deleted) can't keep playing: they're out,
* the next time anyone in the game does something. Returns the saved game if anything changed.
*/
async function putOutGone(services, row, status) {
	let game = row.game;
	const events = [];
	playersOf(row).forEach((player, seat) => {
		if (game.phase === "over" || game.out[seat]) return;
		if (player !== null && !status.gone.includes(player)) return;
		const played = play(game, seat, { type: "leave" }, () => 1);
		game = played.game;
		events.push(...played.events);
	});
	if (events.length === 0) return null;
	return commit(services, row, afterPlay(services, row, game, events), events);
}
/**
* Actions anyone may do at any moment (finishing the peek, pressing Next) shouldn't fail just
* because someone else's tap got there first: load the game again and have another go.
*/
async function withRetries(c, act) {
	const id = gameId(c.body);
	for (let tries = 0;; tries++) {
		const { row, seat } = await loadMyGame(c.services, c.me, id);
		try {
			return await act(row, seat);
		} catch (error) {
			if (!(error instanceof Refused && error.problem === "changed") || tries >= 2) throw error;
		}
	}
}
async function create({ services, me, body }) {
	const settings = parseSettings(body.settings);
	if (!settings || !isWanted(body.players)) throw new Refused("bad-request");
	if ((await mustBeAllowed(services, me, true)).createdLastHour >= 20) throw new Refused("too-many");
	return newWaitingGame(services, me, body.players, settings, body.lobby === true);
}
async function newWaitingGame(services, me, wanted, settings, inLobby) {
	const waiting = await services.findWaitingHostedBy(me);
	if (waiting) await commit(services, waiting, { status: "cancelled" }).catch(() => null);
	for (let tries = 0; tries < 5; tries++) {
		const code = makeCode(() => services.random());
		if (await services.codeTaken(code)) continue;
		const row = {
			id: services.newId(),
			code,
			in_lobby: inLobby,
			host: me,
			...seatPatch([me]),
			wanted,
			settings,
			status: "waiting",
			game: null,
			ready: null,
			version: 0,
			expires_at: iso(services.now() + WAITING_GAME_MS),
			started_at: null,
			deadline: null,
			last_action_at: null,
			finished_at: null,
			ending: null,
			places: null,
			won: null,
			out_of_game: null,
			counts: null,
			stats: null,
			rematch_game: null
		};
		const seats = seatRows(row.id, publicInfo(row), null, []);
		const inserted = await services.write(null, row, seats);
		if (inserted === "code-taken") continue;
		if (inserted === "already-waiting" || inserted === "changed") throw new Refused("changed");
		if (inserted === "failed") throw new Refused("failed");
		return {
			row: inserted,
			seats
		};
	}
	throw new Refused("failed");
}
async function join({ services, limiter, me, body }) {
	let row;
	if (body.code !== void 0) {
		if (!limiter.allow(`code:${me}`, 10)) throw new Refused("too-many-codes");
		const code = normaliseCode(body.code);
		row = code ? await services.findWaitingByCode(code) : null;
		if (!row) throw new Refused("not-found");
	} else {
		row = await services.loadGame(gameId(body));
		if (!row || !row.in_lobby) throw new Refused("not-found");
	}
	await mustBeSameSchool(services, await mustBeAllowed(services, me, true), row.host);
	return joinWaiting(services, me, row);
}
/** A game made at another school looks exactly like a code that doesn't exist: nothing is shared between schools. */
async function mustBeSameSchool(services, me, host) {
	const theirs = host ? await services.playerStatus(host) : null;
	if (theirs && theirs.schoolId !== me.schoolId) throw new Refused("not-found");
}
/** Takes the first empty seat in a waiting game, and starts it if that fills it. */
async function joinWaiting(services, me, first) {
	let row = first;
	for (let tries = 0; tries < 4 && row; tries++) {
		if (playersOf(row).includes(me)) return {
			row,
			seats: seatRows(row.id, publicInfo(row), row.game, [])
		};
		if (row.status === "playing" || row.status === "finished") throw new Refused("full");
		if (row.status !== "waiting" || Date.parse(row.expires_at) <= services.now()) throw new Refused("expired");
		const host = row.host && await services.playerStatus(row.host);
		if (!host || !host.school || host.hidden) throw new Refused("expired");
		const seats = seatsOf(row);
		const empty = seats.indexOf(null);
		if (empty < 0 || empty >= row.wanted) throw new Refused("full");
		seats[empty] = me;
		try {
			if (seats.filter(Boolean).length === row.wanted) return await startGame(services, row, seats, seatPatch(seats));
			return await commit(services, row, seatPatch(seats));
		} catch (error) {
			if (!(error instanceof Refused && error.problem === "changed")) throw error;
		}
		row = await services.loadGame(row.id);
	}
	throw new Refused("changed");
}
/** Deals the first round. Players keep their waiting-room seats; the engine picks who starts. */
async function startGame(services, row, seats, extra = {}) {
	const players = seats.filter((p) => p !== null);
	const { game, events } = newGame(players.length, row.settings, services.dice);
	const now = services.now();
	const started = {
		...row,
		...extra,
		...seatPatch(players),
		status: "playing",
		started_at: iso(now),
		code: null
	};
	return commit(services, row, {
		...started,
		...afterPlay(services, {
			...started,
			deadline: null
		}, game, events)
	}, events);
}
async function leave({ services, me, body }) {
	const id = gameId(body);
	for (let tries = 0;; tries++) {
		const { row, seat } = await loadMyGame(services, me, id);
		try {
			if (row.status === "waiting") {
				if (row.host === me) return await commit(services, row, { status: "cancelled" });
				return await commit(services, row, seatPatch(seatsOf(row).filter((p) => p !== me)));
			}
			if (row.status !== "playing" || !row.game || row.game.out[seat]) return {
				row,
				seats: seatRows(row.id, publicInfo(row), row.game, [])
			};
			const played = runEngine(services, row.game, seat, { type: "leave" });
			return await commit(services, row, afterPlay(services, row, played.game, played.events), played.events);
		} catch (error) {
			if (!(error instanceof Refused && error.problem === "changed") || tries >= 2) throw error;
		}
	}
}
/** The host starts early, with at least 2 players. (A full game starts by itself.) */
async function start({ services, me, body }) {
	const { row } = await loadMyGame(services, me, gameId(body));
	if (row.host !== me) throw new Refused("not-host");
	if (row.status === "playing") return {
		row,
		seats: seatRows(row.id, publicInfo(row), row.game, [])
	};
	if (row.status !== "waiting") throw new Refused("over");
	const status = await mustBeAllowed(services, me, true, otherPlayers(row, me));
	const players = seatsOf(row).filter((p) => p !== null && !status.gone.includes(p));
	if (players.length < 2) throw new Refused("need-players");
	return startGame(services, row, players);
}
function drawAction(body) {
	return body.from === "stack" || body.from === "discard" ? {
		type: "draw",
		from: body.from
	} : null;
}
function swapAction(body) {
	return isSlot(body.slot) ? {
		type: "swap",
		slot: body.slot
	} : null;
}
/** Plays an action for a seat, after putting out anyone who's gone. */
async function playAs(c, row, seat, action) {
	const game = mustBePlaying(row, seat);
	const status = await mustBeAllowed(c.services, c.me, true, otherPlayers(row, c.me));
	if (await putOutGone(c.services, row, status)) throw new Refused("changed");
	const played = runEngine(c.services, game, seat, action);
	return commit(c.services, row, afterPlay(c.services, row, played.game, played.events), played.events);
}
/** A move on your own turn. The page says which version it's looking at, so a double tap can't play twice. */
async function turn(c, action) {
	if (!action) throw new Refused("bad-request");
	const { row, seat } = await loadMyGame(c.services, c.me, gameId(c.body));
	mustBePlaying(row, seat);
	if (c.body.version !== row.version) throw new Refused("changed");
	return playAs(c, row, seat, action);
}
/** Between rounds: I've seen the scores. When everyone still in has pressed Next, deal. */
async function readyForNext(c, row, seat) {
	const game = mustBePlaying(row, seat);
	if (game.phase !== "round-over") throw new Refused("changed");
	await mustBeAllowed(c.services, c.me, true);
	const ready = (row.ready ?? game.out.map(() => false)).map((r, s) => r || s === seat);
	if (!allReady(game, ready)) {
		if (row.ready?.[seat]) return {
			row,
			seats: seatRows(row.id, publicInfo(row), game, [])
		};
		return commit(c.services, row, { ready });
	}
	const played = runEngine(c.services, game, "system", { type: "next-round" });
	return commit(c.services, row, afterPlay(c.services, row, played.game, played.events), played.events);
}
/**
* The clock ran out: the peek ends, a turn is skipped, or the next round is dealt. Any
* player's page can ask (server functions can't wake themselves up); the server checks the
* clock itself, so nobody can hurry anyone.
*/
async function timesUp({ services, me, body }) {
	const { row } = await loadMyGame(services, me, gameId(body));
	if (row.status !== "playing" || !row.game) throw new Refused("over");
	const after = await putOutGone(services, row, await mustBeAllowed(services, me, true, otherPlayers(row, me)));
	if (after) return after;
	const left = Date.parse(row.deadline ?? "") + GRACE_MS - services.now();
	if (!(left <= 0)) throw new Refused("not-yet", { secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1e3) : 60 });
	const action = timesUpAction(row.game);
	if (!action) throw new Refused("over");
	const played = runEngine(services, row.game, "system", action);
	return commit(services, row, afterPlay(services, row, played.game, played.events), played.events);
}
/**
* The first to press Rematch starts a new waiting game (same size and length) linked to this
* one. Everyone else's Rematch joins it, and it starts by itself when everyone is in.
*/
async function rematch(context, tries = 0) {
	const { services, me, body } = context;
	const { row } = await loadMyGame(services, me, gameId(body));
	if (row.status !== "finished") throw new Refused("bad-request");
	await mustBeAllowed(services, me, true);
	if (row.rematch_game) {
		const next = await services.loadGame(row.rematch_game);
		if (!next) throw new Refused("rematch-gone");
		if (playersOf(next).includes(me)) return {
			row: next,
			seats: seatRows(next.id, publicInfo(next), next.game, [])
		};
		if (next.status !== "waiting") throw new Refused("rematch-gone");
		return joinWaiting(services, me, next);
	}
	const next = await newWaitingGame(services, me, Math.max(2, playersOf(row).filter(Boolean).length), row.settings, false);
	try {
		await commit(services, row, { rematch_game: next.row.id });
		return next;
	} catch (error) {
		if (!(error instanceof Refused && error.problem === "changed")) throw error;
	}
	await commit(services, next.row, { status: "cancelled" }).catch(() => null);
	if (tries >= 2) throw new Refused("changed");
	return rematch(context, tries + 1);
}
//#endregion
//#region supabase/functions/card-game/entry.ts
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
const games = () => admin.from("card_games");
/** Logs say which step went wrong and the database's error code, never who. */
function logProblem(step, code) {
	console.error(`card-game: ${step} failed (${code ?? "unknown"})`);
}
const isUuid = (id) => /^[0-9a-f-]{36}$/i.test(id);
Deno.serve(cardGameHandler({
	now: () => Date.now(),
	random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
	dice: secureDice,
	newId: () => crypto.randomUUID(),
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async playerStatus(player, others = []) {
		const { data, error } = await admin.rpc("card_player_status", {
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
	async codeTaken(code) {
		const { data, error } = await admin.rpc("waiting_code_taken", { code });
		if (error) logProblem("check code", error.code);
		return data === true;
	},
	async findWaitingHostedBy(player) {
		const { data, error } = await games().select("*").eq("host", player).eq("status", "waiting").maybeSingle();
		if (error) logProblem("find waiting", error.code);
		return data ?? null;
	},
	async write(expected, row, seats) {
		const { data, error } = await admin.rpc("card_game_write", {
			expected_version: expected,
			game_row: row,
			seats
		}).maybeSingle();
		if (error) {
			if (error.code === "23505") return error.message.includes("one_waiting_each") ? "already-waiting" : "code-taken";
			logProblem("save", error.code);
			return "failed";
		}
		return data ?? "changed";
	}
}));
//#endregion
