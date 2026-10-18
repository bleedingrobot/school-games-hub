// GENERATED FILE: don't edit. Edit supabase/functions/power-clash/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "power-clash" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
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
//#region shared/power-clash/engine.ts
const POWER_IDS = [
	"body-swap",
	"freeze-ray",
	"board-wipe",
	"force-field",
	"portal-chaos",
	"wild-card",
	"time-heist"
];
/**
* The dice used when nobody passes any: always the middle choice. Only for a bot looking ahead
* (it can't know how the dice will fall) and for tests. A real game always passes its own.
*/
const FIXED_RANDOM = () => .5;
const LINES = [
	[
		0,
		1,
		2
	],
	[
		3,
		4,
		5
	],
	[
		6,
		7,
		8
	],
	[
		0,
		3,
		6
	],
	[
		1,
		4,
		7
	],
	[
		2,
		5,
		8
	],
	[
		0,
		4,
		8
	],
	[
		2,
		4,
		6
	]
];
const other = (p) => p === "X" ? "O" : "X";
function winningLine(board, player) {
	return LINES.find((line) => line.every((i) => board[i] === player)) ?? null;
}
function validLoadout(powers) {
	return powers.length === 3 && new Set(powers).size === 3 && powers.every((p) => POWER_IDS.includes(p));
}
const pickFrom = (random, list) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
/** How things stand right now, for Time Heist to come back to. */
function snapshot(state, heist = false) {
	return {
		board: state.board.slice(),
		frozen: state.frozen.map((f) => ({ ...f })),
		shields: state.shields.map((s) => ({ ...s })),
		used: {
			X: [...state.used.X],
			O: [...state.used.O]
		},
		heist
	};
}
function newRound(loadout, starter, chaos = false) {
	if (!validLoadout(loadout.X) || !validLoadout(loadout.O)) throw new Error("Each player needs three different powers");
	const base = {
		board: Array(9).fill(null),
		frozen: [],
		shields: [],
		used: {
			X: [],
			O: []
		}
	};
	return {
		...base,
		active: starter,
		status: "active",
		loadout: {
			X: [...loadout.X],
			O: [...loadout.O]
		},
		powerThisTurn: null,
		placesLeft: 1,
		line: null,
		chaos,
		turns: 0,
		turnStart: snapshot(base),
		rewind: null
	};
}
/** Squares the active player may place on right now. */
function placeableSquares(state) {
	if (state.status !== "active") return [];
	const blocked = new Set(state.frozen.filter((f) => f.blockedFor === state.active).map((f) => f.square));
	return state.board.flatMap((c, i) => c === null && !blocked.has(i) ? [i] : []);
}
function hasPower(state, player, power) {
	return state.loadout[player].includes(power) && !state.used[player].includes(power);
}
const shieldedSquares = (state) => new Set(state.shields.map((s) => s.square));
/** Squares holding a symbol (of `who`, or anyone) that no Force Field protects. */
function unprotected(state, who) {
	const shielded = shieldedSquares(state);
	return state.board.flatMap((c, i) => c !== null && (who === void 0 || c === who) && !shielded.has(i) ? [i] : []);
}
/** Would this board give `me`'s opponent a line and not `me`? The dice never allow that. */
const handsOverWin = (board, me) => winningLine(board, other(me)) !== null && winningLine(board, me) === null;
/**
* Every way the portals can throw the symbols on `a` and `b`: the first goes to `to[0]`, the
* second to `to[1]`, two different squares among a, b and the empty squares that aren't
* frozen. The board always ends up different, and the other player never gets a line from it.
*/
function portalOutcomes(state, a, b, limit = Infinity) {
	const me = state.active;
	const frozen = new Set(state.frozen.map((f) => f.square));
	const pool = [
		a,
		b,
		...state.board.flatMap((c, i) => c === null && !frozen.has(i) ? [i] : [])
	].sort((x, y) => x - y);
	const same = state.board[a] === state.board[b];
	const out = [];
	for (const d1 of pool) for (const d2 of pool) {
		if (d1 === d2 || d1 === a && d2 === b || same && d1 === b && d2 === a) continue;
		const board = state.board.slice();
		board[a] = null;
		board[b] = null;
		board[d1] = state.board[a];
		board[d2] = state.board[b];
		if (handsOverWin(board, me)) continue;
		out.push([d1, d2]);
		if (out.length >= limit) return out;
	}
	return out;
}
const WILD_EFFECTS = [
	"bonus",
	"freeze",
	"swap",
	"remove"
];
const swapped = (board, a, b) => {
	const next = board.slice();
	next[a] = board[b];
	next[b] = board[a];
	return next;
};
/** Everything the Wild Card could do right now: only legal targets, never touching protection, never handing over a win. */
function wildOutcomes(state) {
	const me = state.active;
	const they = other(me);
	const out = [];
	if (placeableSquares(state).length >= 2) out.push({ effect: "bonus" });
	const frozenForThem = new Set(state.frozen.filter((f) => f.blockedFor === they).map((f) => f.square));
	state.board.forEach((c, i) => {
		if (c === null && !frozenForThem.has(i)) out.push({
			effect: "freeze",
			square: i
		});
	});
	for (const a of unprotected(state, me)) for (const b of unprotected(state, they)) if (!handsOverWin(swapped(state.board, a, b), me)) out.push({
		effect: "swap",
		squares: [a, b]
	});
	for (const i of unprotected(state)) out.push({
		effect: "remove",
		square: i
	});
	return out;
}
const CHAOS_KINDS = [
	"earthquake",
	"frost-wave",
	"meteor",
	"lucky-star",
	"recharge"
];
/** The surprises that could happen now, for the player about to move. None of them can make a line. */
function chaosOutcomes(state) {
	const next = state.active;
	const out = [];
	const x = unprotected(state, "X");
	const o = unprotected(state, "O");
	for (const a of x) for (const b of o) {
		const board = swapped(state.board, a, b);
		if (!winningLine(board, "X") && !winningLine(board, "O")) out.push({
			event: "earthquake",
			squares: [a, b]
		});
	}
	const placeable = placeableSquares(state);
	const frozen = new Set(state.frozen.map((f) => f.square));
	if (placeable.length >= 3) {
		for (const i of placeable) if (!frozen.has(i)) out.push({
			event: "frost-wave",
			squares: [i]
		});
	}
	for (const i of unprotected(state)) out.push({
		event: "meteor",
		squares: [i]
	});
	if (placeable.length >= 2) out.push({
		event: "lucky-star",
		squares: []
	});
	for (const power of state.used[next]) out.push({
		event: "recharge",
		squares: [],
		power
	});
	return out;
}
/** The surprise after a finished go. `state.active` is already the player about to move. */
function chaosEvent(state, events, random) {
	const options = chaosOutcomes(state);
	const kinds = CHAOS_KINDS.filter((k) => options.some((o) => o.event === k));
	if (kinds.length === 0) return state;
	const kind = pickFrom(random, kinds);
	const chosen = pickFrom(random, options.filter((o) => o.event === kind));
	const affects = state.active;
	let next = state;
	switch (chosen.event) {
		case "earthquake":
			next = {
				...state,
				board: swapped(state.board, chosen.squares[0], chosen.squares[1])
			};
			break;
		case "frost-wave":
			next = {
				...state,
				frozen: [...state.frozen, {
					square: chosen.squares[0],
					blockedFor: affects
				}]
			};
			break;
		case "meteor": {
			const board = state.board.slice();
			board[chosen.squares[0]] = null;
			next = {
				...state,
				board
			};
			break;
		}
		case "lucky-star":
			next = {
				...state,
				placesLeft: 2
			};
			break;
		case "recharge": next = {
			...state,
			used: {
				...state.used,
				[affects]: state.used[affects].filter((p) => p !== chosen.power)
			}
		};
	}
	events.push({
		kind: "chaos",
		event: chosen.event,
		affects,
		squares: [...chosen.squares],
		...chosen.event === "recharge" ? { power: chosen.power } : {}
	});
	return next;
}
/** Squares the active player can pick for the next target of a power. [] = none. */
function targetChoices(state, power, picked) {
	const me = state.active;
	const they = other(me);
	const all = state.board.map((_, i) => i);
	switch (power) {
		case "wild-card":
		case "time-heist": return [];
		case "body-swap":
			if (picked.length === 0) return unprotected(state, me);
			if (picked.length === 1) return unprotected(state, they);
			return [];
		case "freeze-ray": return picked.length === 0 ? all.filter((i) => state.board[i] === null) : [];
		case "board-wipe": return picked.length === 0 ? unprotected(state) : [];
		case "force-field": return picked.length === 0 ? unprotected(state, me) : [];
		case "portal-chaos":
			if (picked.length === 0) return unprotected(state).filter((a) => unprotected(state).some((b) => b !== a && portalOutcomes(state, a, b, 1).length > 0));
			if (picked.length === 1) return unprotected(state).filter((b) => b !== picked[0] && portalOutcomes(state, picked[0], b, 1).length > 0);
			return [];
	}
}
function targetsNeeded(power) {
	switch (power) {
		case "body-swap":
		case "portal-chaos": return 2;
		case "wild-card":
		case "time-heist": return 0;
		default: return 1;
	}
}
const sameStuff = (a, b) => {
	const key = (s) => JSON.stringify([
		s.board,
		[...s.frozen].sort((p, q) => p.square - q.square),
		[...s.shields].sort((p, q) => p.square - q.square),
		s.used
	]);
	return key(a) === key(b);
};
/** Why the active player can't play this power right now, or null if they can. */
function powerBlockedReason(state, power) {
	if (state.status !== "active") return "The round is over";
	if (!hasPower(state, state.active, power)) return "You have already used this power";
	if (state.powerThisTurn) return "One power per turn";
	switch (power) {
		case "body-swap": return targetChoices(state, power, []).length > 0 && targetChoices(state, power, [0]).length > 0 ? null : state.shields.length > 0 ? "Needs one X and one O that aren’t protected" : "Needs one X and one O on the board";
		case "freeze-ray": return targetChoices(state, power, []).length > 0 ? null : "Needs an empty square";
		case "board-wipe": return targetChoices(state, power, []).length > 0 ? null : state.shields.length > 0 ? "Needs a symbol that isn’t protected" : "Needs a symbol on the board";
		case "force-field": return targetChoices(state, power, []).length > 0 ? null : "Needs one of your symbols that isn’t protected";
		case "portal-chaos": return targetChoices(state, power, []).length > 0 ? null : "Needs two symbols that aren’t protected";
		case "wild-card": return wildOutcomes(state).length > 0 ? null : "Nothing wild can happen right now";
		case "time-heist":
			if (!state.rewind) return "Nobody has finished a go yet";
			if (state.rewind.heist) return "A Time Heist can’t be undone";
			if (sameStuff(state.rewind, snapshot(state))) return "Their last go changed nothing";
			return null;
	}
}
/** Win/draw check after any board change. The player who just acted wins ties. */
function judge(state, mover, events) {
	const lineMover = winningLine(state.board, mover);
	const lineOther = winningLine(state.board, other(mover));
	const winner = lineMover ? mover : lineOther ? other(mover) : null;
	if (winner) {
		const line = lineMover ?? lineOther;
		events.push({
			kind: "win",
			player: winner,
			line
		});
		return {
			...state,
			status: winner,
			line
		};
	}
	if (state.board.every((c) => c !== null)) {
		events.push({ kind: "draw" });
		return {
			...state,
			status: "draw"
		};
	}
	return state;
}
function endTurn(state, events, random) {
	const done = state.active;
	for (const f of state.frozen) if (f.blockedFor === done) events.push({
		kind: "thaw",
		square: f.square
	});
	for (const s of state.shields) if (s.owner !== done) events.push({
		kind: "shield-off",
		square: s.square
	});
	let next = {
		...state,
		frozen: state.frozen.filter((f) => f.blockedFor !== done),
		shields: state.shields.filter((s) => s.owner === done),
		active: other(done),
		powerThisTurn: null,
		placesLeft: 1,
		turns: state.turns + 1,
		rewind: {
			...state.turnStart,
			heist: state.powerThisTurn === "time-heist"
		}
	};
	if (next.chaos && next.turns % 3 === 0) next = chaosEvent(next, events, random);
	return {
		...next,
		turnStart: snapshot(next)
	};
}
/**
* The clock ran out on a turn (classmates games only): the turn passes to the other player
* without a symbol being placed. Never a loss by itself. A power already played this turn
* stays played. The engine's own 'skip' event tells the screen what happened.
*/
function timeoutTurn(state, random = FIXED_RANDOM) {
	if (state.status !== "active") return {
		ok: false,
		reason: "The round is over"
	};
	const events = [{
		kind: "skip",
		player: state.active
	}];
	return {
		ok: true,
		state: endTurn(state, events, random),
		events
	};
}
function legalSkip(state) {
	return state.status === "active" && state.placesLeft > 0 && placeableSquares(state).length === 0;
}
function play(state, action, random = FIXED_RANDOM) {
	if (state.status !== "active") return {
		ok: false,
		reason: "The round is over"
	};
	const me = state.active;
	const events = [];
	if (action.type === "skip") {
		if (!legalSkip(state)) return {
			ok: false,
			reason: "You can still place a symbol"
		};
		events.push({
			kind: "skip",
			player: me
		});
		return {
			ok: true,
			state: endTurn(state, events, random),
			events
		};
	}
	if (action.type === "place") {
		if (!placeableSquares(state).includes(action.square)) return {
			ok: false,
			reason: "You cannot place there"
		};
		const board = state.board.slice();
		board[action.square] = me;
		events.push({
			kind: "place",
			player: me,
			square: action.square
		});
		let next = {
			...state,
			board,
			placesLeft: state.placesLeft - 1
		};
		next = judge(next, me, events);
		if (next.status !== "active") return {
			ok: true,
			state: next,
			events
		};
		if (next.placesLeft <= 0 || placeableSquares(next).length === 0) next = endTurn(next, events, random);
		return {
			ok: true,
			state: next,
			events
		};
	}
	const { power, targets } = action;
	const blocked = powerBlockedReason(state, power);
	if (blocked) return {
		ok: false,
		reason: blocked
	};
	if (targets.length !== targetsNeeded(power)) return {
		ok: false,
		reason: "Wrong number of targets"
	};
	for (let i = 0; i < targets.length; i++) if (!targetChoices(state, power, targets.slice(0, i)).includes(targets[i])) return {
		ok: false,
		reason: "That is not a legal target"
	};
	let next = {
		...state,
		used: {
			...state.used,
			[me]: [...state.used[me], power]
		},
		powerThisTurn: power
	};
	switch (power) {
		case "body-swap": {
			const [a, b] = targets;
			next.board = swapped(state.board, a, b);
			events.push({
				kind: "body-swap",
				player: me,
				squares: [a, b]
			});
			break;
		}
		case "freeze-ray":
			next.frozen = [...state.frozen, {
				square: targets[0],
				blockedFor: other(me)
			}];
			events.push({
				kind: "freeze",
				player: me,
				square: targets[0]
			});
			break;
		case "board-wipe": {
			const board = state.board.slice();
			board[targets[0]] = null;
			next.board = board;
			events.push({
				kind: "wipe",
				player: me,
				square: targets[0]
			});
			break;
		}
		case "force-field":
			next.shields = [...state.shields, {
				square: targets[0],
				owner: me
			}];
			events.push({
				kind: "force-field",
				player: me,
				square: targets[0]
			});
			break;
		case "portal-chaos": {
			const [a, b] = targets;
			const [d1, d2] = pickFrom(random, portalOutcomes(state, a, b));
			const board = state.board.slice();
			board[a] = null;
			board[b] = null;
			board[d1] = state.board[a];
			board[d2] = state.board[b];
			next.board = board;
			events.push({
				kind: "portal-chaos",
				player: me,
				from: [a, b],
				to: [d1, d2]
			});
			break;
		}
		case "wild-card": {
			const all = wildOutcomes(state);
			const effect = pickFrom(random, WILD_EFFECTS.filter((e) => all.some((o) => o.effect === e)));
			const chosen = pickFrom(random, all.filter((o) => o.effect === effect));
			events.push({
				kind: "wild-card",
				player: me,
				effect
			});
			switch (chosen.effect) {
				case "bonus":
					next.placesLeft = 2;
					events.push({
						kind: "bonus-move",
						player: me
					});
					break;
				case "freeze":
					next.frozen = [...state.frozen, {
						square: chosen.square,
						blockedFor: other(me)
					}];
					events.push({
						kind: "freeze",
						player: me,
						square: chosen.square
					});
					break;
				case "swap":
					next.board = swapped(state.board, chosen.squares[0], chosen.squares[1]);
					events.push({
						kind: "body-swap",
						player: me,
						squares: chosen.squares
					});
					break;
				case "remove": {
					const board = state.board.slice();
					board[chosen.square] = null;
					next.board = board;
					events.push({
						kind: "wipe",
						player: me,
						square: chosen.square
					});
					break;
				}
			}
			break;
		}
		case "time-heist": {
			const back = state.rewind;
			events.push({
				kind: "time-heist",
				player: me,
				board: state.board.slice()
			});
			next = {
				...next,
				board: back.board.slice(),
				frozen: back.frozen.map((f) => ({ ...f })),
				shields: back.shields.map((s) => ({ ...s })),
				used: {
					...back.used,
					[me]: [...back.used[me], power]
				},
				rewind: null,
				turns: Math.max(0, state.turns - 1)
			};
			break;
		}
	}
	next = judge(next, me, events);
	return {
		ok: true,
		state: next,
		events
	};
}
function newMatch(loadout, starter = "X", chaos = false) {
	return {
		score: {
			X: 0,
			O: 0
		},
		draws: 0,
		round: 1,
		loadout,
		starter,
		chaos,
		state: newRound(loadout, starter, chaos),
		winner: null,
		counted: false
	};
}
/** Call once the round is over: adds the result to the score. Safe to call more than once. */
function scoreRound(match) {
	const { status } = match.state;
	if (status === "active") return match;
	if (match.counted) return match;
	const score = { ...match.score };
	let draws = match.draws;
	if (status === "draw") draws += 1;
	else score[status] += 1;
	const winner = score.X >= 3 ? "X" : score.O >= 3 ? "O" : null;
	return {
		...match,
		score,
		draws,
		winner,
		counted: true
	};
}
/** Next round: the starter swaps, and powers refresh (loadout may be changed). */
function nextRound(match, loadout = match.loadout) {
	const starter = other(match.starter);
	return {
		...match,
		round: match.round + 1,
		loadout,
		starter,
		state: newRound(loadout, starter, match.chaos),
		counted: false
	};
}
//#endregion
//#region shared/power-clash/live.ts
/**
* Power Clash with a classmate. Shared by the `power-clash` server function and the website.
*
* The server is the referee: the browser only ever says "place on 4" or "use Freeze Ray on 7".
* This file holds the part with no network and no clock, so it can be tested on its own and
* so the screen and the server can't disagree: it plays an action through the same rules
* engine (engine.ts) and the same match scoring (match.ts) the bot and pass-and-play games
* use, keeps the stats the badges need, and works out the clock and the result.
*
* Seats: seat 0 plays X, seat 1 plays O, for the whole match. X starts round 1 and the starter
* alternates by round. A rematch swaps who is X. Nothing is hidden in this game, so the whole
* state goes to both players.
*
* Clocks (plan section 5): 60 seconds a turn and 30 to press Next between rounds, plus time
* for the animations. A turn that runs out is a skipped placement (never a loss by itself).
* Three in a row by the same player ends the game as abandoned, and it earns nobody anything.
*/
const TURN_MS = 6e4;
const NEXT_ROUND_MS = 3e4;
/** The server waits this long past a deadline before it lets a page ask for the time-out. */
const GRACE_MS = 1500;
/** Thrown for anything the rules don't allow. The message is written for students. */
var LiveRuleError = class extends Error {};
const sideOf = (seat) => seat === 0 ? "X" : "O";
const seatOf = (side) => side === "X" ? 0 : 1;
const freshStats = () => ({
	powersUsed: 0,
	bodySwapWins: 0,
	noPowerWin: false,
	roundsWon: 0,
	roundsLost: 0,
	roundsDrawn: 0
});
/** A power list from outside (the browser): exactly three different powers, or null. */
function parseLoadout(input) {
	if (!Array.isArray(input) || input.length !== 3) return null;
	if (!input.every((p) => POWER_IDS.includes(p))) return null;
	const powers = input;
	return validLoadout(powers) ? powers : null;
}
/** Round one of a new match. `x` and `o` are the powers of the seat-0 and seat-1 players. */
function newLiveGame(x, o, chaos = false) {
	return {
		match: newMatch({
			X: x,
			O: o
		}, "X", chaos),
		stats: [freshStats(), freshStats()],
		timeouts: [0, 0],
		ready: [false, false]
	};
}
const copy = (game) => ({
	match: game.match,
	stats: [{ ...game.stats[0] }, { ...game.stats[1] }],
	timeouts: [game.timeouts[0], game.timeouts[1]],
	ready: [game.ready[0], game.ready[1]]
});
const roundIsOver = (game) => game.match.state.status !== "active";
const matchIsOver = (game) => game.match.winner !== null;
/** Whose turn it is, as a seat. Meaningful while the round is active. */
const turnSeat = (game) => seatOf(game.match.state.active);
/** Adds the result of a round that has just ended to both players' stats. */
function noteRound(game, mover, powerThisTurn) {
	const { status } = game.match.state;
	if (status === "active") return;
	if (status === "draw") {
		game.stats[0].roundsDrawn++;
		game.stats[1].roundsDrawn++;
		return;
	}
	const winner = seatOf(status);
	game.stats[winner].roundsWon++;
	game.stats[1 - winner].roundsLost++;
	if (mover === status && powerThisTurn === "body-swap") game.stats[winner].bodySwapWins++;
}
/** Plays the engine's result for one action by `mover`, and keeps the score and stats. */
function applyResult(game, mover, action, result) {
	const countedBefore = game.match.counted;
	const before = game.match.state;
	game.match = scoreRound({
		...game.match,
		state: result.state
	});
	if (action?.type === "use-power") game.stats[seatOf(mover)].powersUsed++;
	if (action?.type === "use-power" && action.power === "time-heist") {
		const foe = seatOf(mover === "X" ? "O" : "X");
		const back = before.used[mover === "X" ? "O" : "X"].length - result.state.used[mover === "X" ? "O" : "X"].length;
		game.stats[foe].powersUsed = Math.max(0, game.stats[foe].powersUsed - back);
	}
	if (!countedBefore && game.match.counted) {
		noteRound(game, mover, result.state.powerThisTurn);
		const winner = game.match.winner;
		if (winner && game.stats[seatOf(winner)].powersUsed === 0) game.stats[seatOf(winner)].noPowerWin = true;
	}
}
/**
* A player's move. Throws LiveRuleError if it isn't their turn or isn't legal. `random` is the
* dice for Portal Chaos, Wild Card and Chaos Mode: the server always passes its own secure numbers;
* the screens never roll anything, they only show the result.
*/
function playerAction(previous, seat, action, random = Math.random) {
	if (matchIsOver(previous)) throw new LiveRuleError("The match is over.");
	if (roundIsOver(previous)) throw new LiveRuleError("This round is over. Press Next round.");
	if (turnSeat(previous) !== seat) throw new LiveRuleError("It’s not your turn yet.");
	const result = play(previous.match.state, action, random);
	if (!result.ok) throw new LiveRuleError(result.reason);
	const game = copy(previous);
	applyResult(game, sideOf(seat), action, result);
	game.timeouts[seat] = 0;
	return {
		game,
		events: result.events
	};
}
/**
* Between rounds: I have seen the result. When both players have pressed Next the next round
* starts. Pressing twice is fine. Throws if there is no round to move on from.
*/
function pressNext(previous, seat) {
	if (matchIsOver(previous)) throw new LiveRuleError("The match is over.");
	if (!roundIsOver(previous)) throw new LiveRuleError("The round isn’t over yet.");
	const game = copy(previous);
	game.ready[seat] = true;
	if (!game.ready[0] || !game.ready[1]) return {
		game,
		events: [],
		advanced: false
	};
	return {
		game: dealNext(game),
		events: [],
		advanced: true
	};
}
function dealNext(game) {
	return {
		...game,
		match: nextRound(game.match),
		ready: [false, false]
	};
}
/** The clock ran out: a skipped placement, or the next round starts by itself. */
function timeOut(previous, random = Math.random) {
	if (matchIsOver(previous)) throw new LiveRuleError("The match is over.");
	if (roundIsOver(previous)) return {
		game: dealNext(copy(previous)),
		events: [],
		abandoned: false,
		seat: null
	};
	const seat = turnSeat(previous);
	const result = timeoutTurn(previous.match.state, random);
	if (!result.ok) throw new LiveRuleError(result.reason);
	const game = copy(previous);
	game.match = {
		...game.match,
		state: result.state
	};
	game.timeouts[seat]++;
	return {
		game,
		events: result.events,
		abandoned: game.timeouts[seat] >= 3,
		seat
	};
}
/** Roughly how long the screens take to show these events, in milliseconds. */
function animationMs(events) {
	let ms = 0;
	for (const e of events) switch (e.kind) {
		case "place":
			ms += 600;
			break;
		case "bonus-move":
			ms += 900;
			break;
		case "body-swap":
			ms += 1300;
			break;
		case "freeze":
			ms += 1e3;
			break;
		case "wipe":
			ms += 1400;
			break;
		case "force-field":
			ms += 1e3;
			break;
		case "portal-chaos":
			ms += 1500;
			break;
		case "wild-card":
			ms += 1500;
			break;
		case "time-heist":
			ms += 1500;
			break;
		case "chaos":
			ms += 1500;
			break;
		case "skip":
			ms += 700;
			break;
		case "win":
			ms += 2e3;
			break;
		case "draw": ms += 1500;
	}
	return Math.min(ms, 6e3);
}
/**
* When the clock should next run out, after a change. `restart` is false for a change that
* doesn't give anyone new time (someone pressing Next, but not the second): the clock keeps
* running. A finished match has no clock.
*/
function deadlineAfter(game, events, now, previous, restart = true) {
	if (matchIsOver(game)) return null;
	if (!restart && previous !== null) return previous;
	return now + (roundIsOver(game) ? NEXT_ROUND_MS : TURN_MS) + animationMs(events);
}
function outcomeOf(game, ending) {
	const finished = ending === "finished" && game.match.winner !== null;
	return {
		won: [finished && game.match.winner === "X", finished && game.match.winner === "O"],
		counts: [finished, finished],
		stats: [{ ...game.stats[0] }, { ...game.stats[1] }]
	};
}
/** True if this value looks like a LiveGame (the database is trusted, but a bad row must not crash the server). */
function isLiveGame(value) {
	if (typeof value !== "object" || value === null) return false;
	const v = value;
	return typeof v.match === "object" && v.match !== null && Array.isArray(v.stats) && v.stats.length === 2 && Array.isArray(v.timeouts) && v.timeouts.length === 2 && Array.isArray(v.ready) && v.ready.length === 2 && (v.match.state.active === "X" || v.match.state.active === "O");
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
//#region supabase/functions/power-clash/handler.ts
/**
* The Power Clash server function: the referee for Power Clash with a classmate.
*
* The browser only ever asks: "place on square 4", "use Freeze Ray on 7", "press Next", "join
* the game with this code". This works out who's asking from their sign-in token (never from
* the request), checks it's their turn, runs the shared rules engine (shared/power-clash) and
* saves the new state "only if the version is still N", so a double tap can't play twice.
*
* Nothing is hidden in this game, so there is one table and one row per game: both players
* read the whole row (the database lets only them read it) and Realtime sends them each change.
* Each player picks their three powers in the waiting room; the match starts the moment both
* have, and the powers can't change once it has.
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
	started: [409, "The match has already started, so the powers can’t change now."],
	"not-your-turn": [409, "It’s not your turn yet."],
	illegal: [400, "You can’t do that right now."],
	over: [409, "This game has already finished."],
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
function powerClashHandler(services) {
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
			return reply(200, { game: await action({
				services,
				limiter,
				me,
				body
			}) });
		} catch (error) {
			if (error instanceof Refused) {
				if (![
					"not-your-turn",
					"changed",
					"not-yet",
					"not-found",
					"illegal"
				].includes(error.problem)) console.warn(`power-clash: refused ${String(body.action)} (${error.problem})`);
				return refuse(error);
			}
			console.error(`power-clash: ${String(body.action)} failed${error instanceof Error ? ` (${error.message.slice(0, 80)})` : ""}`);
			return refuse(new Refused("failed"));
		}
	};
}
const ACTIONS = {
	create,
	join,
	cancel: leave,
	leave,
	"set-powers": setPowers,
	place: (c) => playerTurn(c, placeAction(c.body)),
	"use-power": (c) => playerTurn(c, powerAction(c.body)),
	skip: (c) => playerTurn(c, { type: "skip" }),
	next,
	"times-up": timesUp,
	rematch
};
const seatsOf = (g) => [g.seat1, g.seat2];
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
function mustBePlaying(row) {
	if (row.status === "waiting") throw new Refused("not-started");
	if (row.status !== "playing" || !isLiveGame(row.game)) throw new Refused("over");
	return row.game;
}
async function save(services, row, patch) {
	const saved = await services.updateGame(row.id, row.version, {
		...patch,
		version: row.version + 1
	});
	if (!saved) throw new Refused("changed");
	return saved;
}
/** Plays the rules engine's step; its messages are written for students. */
function rules(step) {
	try {
		return step();
	} catch (error) {
		if (error instanceof LiveRuleError) throw new Refused("illegal", { error: error.message });
		throw error;
	}
}
/** The changes to save after the engine has played. `real` is a move or button press (not a time-out). */
function afterPlay(services, row, game, events, opts) {
	const now = services.now();
	const patch = {
		game,
		events,
		...opts.real ? { last_action_at: iso(now) } : {}
	};
	if (matchIsOver(game)) {
		const outcome = outcomeOf(game, "finished");
		return {
			...patch,
			status: "finished",
			ending: "finished",
			deadline: null,
			finished_at: iso(now),
			won: outcome.won,
			counts: outcome.counts,
			stats: outcome.stats
		};
	}
	const deadline = deadlineAfter(game, events, now, row.deadline ? Date.parse(row.deadline) : null, opts.restart ?? true);
	return {
		...patch,
		deadline: deadline === null ? null : iso(deadline)
	};
}
/** The game ends as abandoned: nobody earns anything, and the other player is told who left. */
function abandonedPatch(services, game, leaver) {
	const outcome = outcomeOf(game, "abandoned");
	return {
		game,
		events: [],
		status: "finished",
		ending: "abandoned",
		leaver,
		deadline: null,
		finished_at: iso(services.now()),
		won: outcome.won,
		counts: outcome.counts,
		stats: outcome.stats
	};
}
/**
* A student the teacher has hidden (or who has been deleted) can't keep playing: the game
* ends as abandoned the next time the other player does something. Returns the saved game if so.
*/
async function endIfGone(services, row, me) {
	const status = await mustBeAllowed(services, me, true, seatsOf(row).filter((p) => p !== null && p !== me));
	const empty = seatsOf(row).some((p) => p === null);
	const gone = seatsOf(row).find((p) => p !== null && status.gone.includes(p)) ?? null;
	if (!empty && gone === null) return null;
	if (!isLiveGame(row.game)) return null;
	return save(services, row, abandonedPatch(services, row.game, gone));
}
async function create({ services, me, body }) {
	if ((await mustBeAllowed(services, me, true)).createdLastHour >= 20) throw new Refused("too-many");
	return newWaitingGame(services, me, body.lobby === true, null, null);
}
async function newWaitingGame(services, me, inLobby, firstPlayer, myPowers) {
	const waiting = await services.findWaitingHostedBy(me);
	if (waiting) await services.updateGame(waiting.id, waiting.version, {
		status: "cancelled",
		version: waiting.version + 1,
		events: []
	});
	for (let tries = 0; tries < 5; tries++) {
		const code = makeCode(() => services.random());
		if (await services.codeTaken(code)) continue;
		const inserted = await services.insertGame({
			code,
			in_lobby: inLobby,
			host: me,
			seat1: me,
			status: "waiting",
			expires_at: iso(services.now() + WAITING_GAME_MS),
			first_player: firstPlayer,
			loadouts: [myPowers, null]
		});
		if (inserted === "code-taken") continue;
		if (inserted === "already-waiting") throw new Refused("changed");
		if (inserted === "failed") throw new Refused("failed");
		return inserted;
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
		if (typeof body.gameId !== "string" || body.gameId.length > 64) throw new Refused("bad-request");
		row = await services.loadGame(body.gameId);
		if (!row || !row.in_lobby) throw new Refused("not-found");
	}
	await mustBeAllowed(services, me, true);
	return joinWaiting(services, me, row, null);
}
/**
* Takes the empty seat in a waiting game. Already in it? Then that's fine. `powers` are the
* joiner's powers if they already have some (a rematch keeps last game's), which starts the
* match straight away if the host has theirs too.
*/
async function joinWaiting(services, me, first, powers) {
	let row = first;
	for (let tries = 0; tries < 4 && row; tries++) {
		if (seatsOf(row).includes(me)) return row;
		if (row.status === "playing" || row.status === "finished") throw new Refused("full");
		if (row.status !== "waiting" || Date.parse(row.expires_at) <= services.now()) throw new Refused("expired");
		const host = row.host && await services.playerStatus(row.host);
		if (!host || !host.school || host.hidden) throw new Refused("expired");
		if (row.seat2 !== null) throw new Refused("full");
		const loadouts = [row.loadouts[0], powers];
		const joined = {
			...row,
			seat2: me,
			loadouts
		};
		try {
			if (loadouts[0] && loadouts[1]) return await startMatch(services, row, joined);
			return await save(services, row, {
				seat2: me,
				loadouts
			});
		} catch (error) {
			if (!(error instanceof Refused && error.problem === "changed")) throw error;
		}
		row = await services.loadGame(row.id);
	}
	throw new Refused("changed");
}
/** Both players have their powers: deal the first round. Last game's O (if any) plays X; otherwise it's a coin toss. */
async function startMatch(services, row, ready) {
	const [a, b] = [ready.seat1, ready.seat2];
	const [loadA, loadB] = [ready.loadouts[0], ready.loadouts[1]];
	const aPlaysX = ready.first_player === a ? true : ready.first_player === b ? false : services.random() < .5;
	const [x, o] = aPlaysX ? [a, b] : [b, a];
	const [powersX, powersO] = aPlaysX ? [loadA, loadB] : [loadB, loadA];
	const game = newLiveGame(powersX, powersO);
	const now = services.now();
	return save(services, row, {
		seat1: x,
		seat2: o,
		loadouts: [powersX, powersO],
		status: "playing",
		code: null,
		game,
		events: [],
		started_at: iso(now),
		last_action_at: iso(now),
		deadline: iso(now + TURN_MS)
	});
}
async function leave({ services, me, body }) {
	for (let tries = 0;; tries++) {
		const { game: row } = await loadMyGame(services, me, body.gameId);
		try {
			if (row.status === "waiting") {
				if (row.host === me) return await save(services, row, {
					status: "cancelled",
					events: []
				});
				return await save(services, row, {
					seat2: null,
					loadouts: [row.loadouts[0], null]
				});
			}
			if (row.status !== "playing" || !isLiveGame(row.game)) return row;
			return await save(services, row, abandonedPatch(services, row.game, me));
		} catch (error) {
			if (!(error instanceof Refused && error.problem === "changed") || tries >= 2) throw error;
		}
	}
}
/** Picks (or changes) my three powers, until the match starts. It starts when both have picked. */
async function setPowers({ services, me, body }) {
	const powers = parseLoadout(body.powers);
	if (!powers) throw new Refused("bad-request");
	for (let tries = 0;; tries++) {
		const { game: row, seat } = await loadMyGame(services, me, body.gameId);
		if (row.status === "playing") throw new Refused("started");
		if (row.status !== "waiting") throw new Refused("over");
		await mustBeAllowed(services, me, true);
		const loadouts = seat === 0 ? [powers, row.loadouts[1]] : [row.loadouts[0], powers];
		try {
			if (row.seat1 && row.seat2 && loadouts[0] && loadouts[1]) return await startMatch(services, row, {
				...row,
				loadouts
			});
			return await save(services, row, { loadouts });
		} catch (error) {
			if (!(error instanceof Refused && error.problem === "changed") || tries >= 2) throw error;
		}
	}
}
const square = (value) => Number.isInteger(value) && value >= 0 && value <= 8;
function placeAction(body) {
	return square(body.square) ? {
		type: "place",
		square: body.square
	} : null;
}
function powerAction(body) {
	const power = body.power;
	if (!POWER_IDS.includes(power)) return null;
	const targets = body.targets ?? [];
	if (!Array.isArray(targets) || targets.length > 2 || !targets.every(square)) return null;
	return {
		type: "use-power",
		power,
		targets
	};
}
/** A move on your own turn. The page says which version it's looking at, so a double tap can't play twice. */
async function playerTurn({ services, me, body }, action) {
	if (!action) throw new Refused("bad-request");
	const { game: row, seat } = await loadMyGame(services, me, body.gameId);
	const game = mustBePlaying(row);
	if (body.version !== row.version) throw new Refused("changed");
	if (await endIfGone(services, row, me)) throw new Refused("changed");
	if (!roundIsOver(game) && !matchIsOver(game) && turnSeat(game) !== seat) throw new Refused("not-your-turn");
	const played = rules(() => playerAction(game, seat, action, () => services.random()));
	return save(services, row, afterPlay(services, row, played.game, played.events, { real: true }));
}
/**
* Between rounds: I've seen the result. When both players have pressed Next, the next round
* starts. If the round it names has already moved on (or the match is over), this just hands
* back the game as it is, so a late tap does nothing.
*/
async function next({ services, me, body }) {
	for (let tries = 0;; tries++) {
		const { game: row, seat } = await loadMyGame(services, me, body.gameId);
		const game = mustBePlaying(row);
		if (!roundIsOver(game) || matchIsOver(game) || body.round !== void 0 && body.round !== game.match.round) return row;
		if (await endIfGone(services, row, me)) throw new Refused("changed");
		try {
			const pressed = rules(() => pressNext(game, seat));
			if (game.ready[seat] && !pressed.advanced) return row;
			return await save(services, row, afterPlay(services, row, pressed.game, pressed.events, {
				real: true,
				restart: pressed.advanced
			}));
		} catch (error) {
			if (!(error instanceof Refused && error.problem === "changed") || tries >= 2) throw error;
		}
	}
}
/**
* The clock ran out: a turn is skipped (never a loss by itself), or the next round starts.
* Any player's page can ask (server functions can't wake themselves up); the server checks
* the clock itself, so nobody can hurry anyone. Three missed turns in a row end the game.
*/
async function timesUp({ services, me, body }) {
	const { game: row } = await loadMyGame(services, me, body.gameId);
	const game = mustBePlaying(row);
	const after = await endIfGone(services, row, me);
	if (after) return after;
	const left = Date.parse(row.deadline ?? "") + GRACE_MS - services.now();
	if (!(left <= 0)) throw new Refused("not-yet", { secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1e3) : 60 });
	const out = rules(() => timeOut(game, () => services.random()));
	if (out.abandoned) {
		const leaver = out.seat === null ? null : seatsOf(row)[out.seat] ?? null;
		return save(services, row, abandonedPatch(services, out.game, leaver));
	}
	return save(services, row, afterPlay(services, row, out.game, out.events, { real: false }));
}
/**
* The first to press Rematch starts a new waiting game linked to this one, with the same
* powers, and last game's O plays X (so the other player starts). The other player's Rematch
* joins it, and the match starts straight away.
*/
async function rematch(context, tries = 0) {
	const { services, me, body } = context;
	const { game: row, seat } = await loadMyGame(services, me, body.gameId);
	if (row.status !== "finished") throw new Refused("bad-request");
	await mustBeAllowed(services, me, true);
	const mine = row.loadouts[seat];
	if (row.rematch_game) {
		const nextGame = await services.loadGame(row.rematch_game);
		if (!nextGame) throw new Refused("rematch-gone");
		if (seatsOf(nextGame).includes(me)) return nextGame;
		if (nextGame.status !== "waiting") throw new Refused("rematch-gone");
		return joinWaiting(services, me, nextGame, mine);
	}
	const nextGame = await newWaitingGame(services, me, false, row.seat2, mine);
	if (await services.updateGame(row.id, row.version, {
		rematch_game: nextGame.id,
		version: row.version + 1,
		events: []
	})) return nextGame;
	await services.updateGame(nextGame.id, nextGame.version, {
		status: "cancelled",
		version: nextGame.version + 1
	});
	if (tries >= 2) throw new Refused("changed");
	return rematch(context, tries + 1);
}
//#endregion
//#region supabase/functions/power-clash/entry.ts
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
const games = () => admin.from("power_games");
/** Logs say which step went wrong and the database's error code, never who. */
function logProblem(step, code) {
	console.error(`power-clash: ${step} failed (${code ?? "unknown"})`);
}
const isUuid = (id) => /^[0-9a-f-]{36}$/i.test(id);
Deno.serve(powerClashHandler({
	now: () => Date.now(),
	random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async playerStatus(player, others = []) {
		const { data, error } = await admin.rpc("power_player_status", {
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
	}
}));
//#endregion
