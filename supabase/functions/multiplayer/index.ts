// GENERATED FILE: don't edit. Edit supabase/functions/multiplayer/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "multiplayer" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { Chess } from "npm:chess.js@1.4.0";
function otherColour(colour) {
	return colour === "red" ? "white" : "red";
}
/** Which row (0 = top, Red's back row) and column (0 = left) a square is on. */
function rowCol(square) {
	const row = Math.floor((square - 1) / 4);
	const index = (square - 1) % 4;
	return {
		row,
		col: row % 2 === 0 ? index * 2 + 1 : index * 2
	};
}
/** The square number at a row and column, or null for a light square or off the board. */
function squareAt(row, col) {
	if (row < 0 || row > 7 || col < 0 || col > 7 || (row + col) % 2 === 0) return null;
	return row * 4 + Math.floor(col / 2) + 1;
}
/** The far row, where a man is crowned. */
function crownRow(colour) {
	return colour === "red" ? 7 : 0;
}
/** Red men move down the board (towards row 7), White men move up. */
function directions(piece) {
	const forward = piece.colour === "red" ? 1 : -1;
	const steps = [[forward, -1], [forward, 1]];
	if (piece.king) steps.push([-forward, -1], [-forward, 1]);
	return steps;
}
function startPosition() {
	const board = [];
	for (let square = 1; square <= 32; square++) if (square <= 12) board.push({
		colour: "red",
		king: false
	});
	else if (square >= 21) board.push({
		colour: "white",
		king: false
	});
	else board.push(null);
	return {
		board,
		turn: "red",
		quietPlies: 0
	};
}
function pieceAt(position, square) {
	return position.board[square - 1] ?? null;
}
function makeMove(path, captures, crowns) {
	return {
		path,
		captures,
		crowns,
		notation: path.join(captures.length > 0 ? "x" : "-")
	};
}
/** Every complete jump the piece on `from` can make. Each one carries on as far as it can. */
function jumpsFrom(position, from) {
	const piece = pieceAt(position, from);
	const board = [...position.board];
	board[from - 1] = null;
	const found = [];
	function explore(at, path, captured) {
		const { row, col } = rowCol(at);
		let canJump = false;
		for (const [dr, dc] of directions(piece)) {
			const over = squareAt(row + dr, col + dc);
			const land = squareAt(row + 2 * dr, col + 2 * dc);
			if (over === null || land === null) continue;
			const victim = board[over - 1];
			if (!victim || victim.colour === piece.colour || captured.includes(over) || board[land - 1]) continue;
			canJump = true;
			const nextPath = [...path, land];
			const nextCaptured = [...captured, over];
			if (!piece.king && rowCol(land).row === crownRow(piece.colour)) found.push(makeMove(nextPath, nextCaptured, true));
			else explore(land, nextPath, nextCaptured);
		}
		if (!canJump && captured.length > 0) found.push(makeMove(path, captured, false));
	}
	explore(from, [from], []);
	return found;
}
function stepsFrom(position, from) {
	const piece = pieceAt(position, from);
	const { row, col } = rowCol(from);
	const moves = [];
	for (const [dr, dc] of directions(piece)) {
		const to = squareAt(row + dr, col + dc);
		if (to === null || pieceAt(position, to)) continue;
		moves.push(makeMove([from, to], [], !piece.king && rowCol(to).row === crownRow(piece.colour)));
	}
	return moves;
}
function ownSquares(position) {
	const squares = [];
	for (let square = 1; square <= 32; square++) if (pieceAt(position, square)?.colour === position.turn) squares.push(square);
	return squares;
}
/**
* Every legal move for the side to move. If any jump is possible, only jumps are legal
* (captures are compulsory), but the player may pick whichever jump they like.
*/
function legalMoves(position) {
	const mine = ownSquares(position);
	const jumps = mine.flatMap((square) => jumpsFrom(position, square));
	if (jumps.length > 0) return jumps;
	return mine.flatMap((square) => stepsFrom(position, square));
}
/** Makes a move (assumed legal: get it from legalMoves). Returns the new position. */
function applyMove(position, move) {
	const board = [...position.board];
	const from = move.path[0];
	const to = move.path[move.path.length - 1];
	const piece = board[from - 1];
	board[from - 1] = null;
	for (const square of move.captures) board[square - 1] = null;
	board[to - 1] = {
		colour: piece.colour,
		king: piece.king || move.crowns
	};
	const quiet = move.captures.length === 0 && !move.crowns;
	return {
		board,
		turn: otherColour(position.turn),
		quietPlies: quiet ? position.quietPlies + 1 : 0
	};
}
/** Finds a legal move from its notation, e.g. "11-15" or "15x24x31". Null if it isn't legal here. */
function findMove(position, notation) {
	return legalMoves(position).find((move) => move.notation === notation) ?? null;
}
/** Has the game ended by the rules? */
function boardResult$1(position) {
	const winner = otherColour(position.turn);
	if (ownSquares(position).length === 0) return {
		ending: "no-pieces",
		winner
	};
	if (legalMoves(position).length === 0) return {
		ending: "no-moves",
		winner
	};
	if (position.quietPlies >= 80) return {
		ending: "forty-moves",
		winner: null
	};
	return null;
}
/**
* Replays a whole game from the starting position. Fails if any move is illegal, or if
* a move comes after the game has already ended.
*/
function replay$1(moves) {
	let position = startPosition();
	const played = [];
	for (let i = 0; i < moves.length; i++) {
		const move = boardResult$1(position) ? null : findMove(position, moves[i]);
		if (!move) return {
			ok: false,
			badMoveIndex: i
		};
		position = applyMove(position, move);
		played.push(move);
	}
	return {
		ok: true,
		position,
		played,
		result: boardResult$1(position)
	};
}
//#endregion
//#region shared/chess/rules.ts
/**
* Chess rules, shared by the website and the server.
*
* chess.js does the real work (legal moves, check, castling, en passant, promotion and
* every draw rule). This file only adds the few things both sides need: replaying a
* game from its list of moves, and saying how a finished game ended.
*
* Moves are stored in "UCI" form: from-square + to-square, plus the promotion piece
* if there is one. For example "e2e4", "e1g1" (castling), "e7e8q" (promote to a queen).
*/
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
function isUciMove(text) {
	return typeof text === "string" && UCI.test(text);
}
function toUci(move) {
	return move.from + move.to + (move.promotion ?? "");
}
/** Plays one UCI move. Returns the move, or null if it isn't legal here. Never throws. */
function playUci(chess, uci) {
	if (!isUciMove(uci)) return null;
	try {
		return chess.move({
			from: uci.slice(0, 2),
			to: uci.slice(2, 4),
			promotion: uci[4]
		});
	} catch {
		return null;
	}
}
/**
* Has the game ended by the rules? Draws end the game automatically: threefold
* repetition, 50 moves each with no capture or pawn move, and too few pieces to mate.
*/
function boardResult(chess) {
	if (chess.isCheckmate()) return {
		ending: "checkmate",
		winner: chess.turn() === "w" ? "black" : "white"
	};
	if (chess.isStalemate()) return {
		ending: "stalemate",
		winner: null
	};
	if (chess.isInsufficientMaterial()) return {
		ending: "not-enough-pieces",
		winner: null
	};
	if (chess.isThreefoldRepetition()) return {
		ending: "threefold-repetition",
		winner: null
	};
	if (chess.isDrawByFiftyMoves()) return {
		ending: "fifty-moves",
		winner: null
	};
	return null;
}
/**
* Replays a whole game from the starting position. Fails if any move is illegal, or if
* a move comes after the game has already ended.
*/
function replay(moves) {
	const chess = new Chess();
	for (let i = 0; i < moves.length; i++) if (boardResult(chess) || !playUci(chess, moves[i])) return {
		ok: false,
		badMoveIndex: i
	};
	return {
		ok: true,
		chess,
		result: boardResult(chess)
	};
}
//#endregion
//#region shared/multiplayer.ts
/**
* Games between two students, shared by the website and the "multiplayer" server function.
*
* The server uses this to referee: whose turn it is, whether a move is legal, and whether
* the game has ended. The website uses the very same code to draw the board. Moves are the
* same short codes as bot games: 'e2e4' for chess, '11-15' or '15x24' for checkers.
*
* The two players are called 'first' (moves first: White in chess, Red in checkers) and
* 'second'.
*/
const GAME_KINDS = ["chess", "checkers"];
/** If it's your opponent's turn and they haven't moved for this long, you can claim the win. */
const CLAIM_WIN_AFTER_MS = 12e4;
/** Game codes use these: no vowels (so no rude words) and no lookalikes like O/0 or I/1. */
const CODE_ALPHABET = "CDFGHJKMNPQRTVWXY34679";
function isGameKind(value) {
	return GAME_KINDS.includes(value);
}
function otherSide(side) {
	return side === "first" ? "second" : "first";
}
/** Whose turn it is after this many moves. */
function sideToMove(plies) {
	return plies % 2 === 0 ? "first" : "second";
}
/** How many moves a side has made after this many moves in total. */
function movesBy(side, plies) {
	return side === "first" ? Math.ceil(plies / 2) : Math.floor(plies / 2);
}
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
/** Replays a game's moves and says whose turn it is, or how it ended by the rules. */
function replayGame(game, moves) {
	if (game === "chess") {
		const replayed = replay(moves);
		if (!replayed.ok) return { ok: false };
		const result = replayed.result;
		return {
			ok: true,
			toMove: sideToMove(moves.length),
			ended: result && {
				winner: result.winner && (result.winner === "white" ? "first" : "second"),
				reason: result.ending
			}
		};
	}
	const replayed = replay$1(moves);
	if (!replayed.ok) return { ok: false };
	const result = replayed.result;
	return {
		ok: true,
		toMove: sideToMove(moves.length),
		ended: result && {
			winner: result.winner && (result.winner === "red" ? "first" : "second"),
			reason: result.ending
		}
	};
}
/** Is this move legal next? Returns the move in its standard form, or null. */
function checkMove(game, moves, move) {
	if (typeof move !== "string" || move.length > 64) return null;
	if (game === "chess") {
		const replayed = replay(moves);
		if (!replayed.ok || replayed.result) return null;
		const played = playUci(replayed.chess, move);
		return played ? toUci(played) : null;
	}
	const replayed = replay$1(moves);
	if (!replayed.ok || replayed.result) return null;
	return findMove(replayed.position, move)?.notation ?? null;
}
/** Recorded games earn nothing in Stage 7 if they were abandoned, or either player made fewer than 10 moves. */
function countsForPoints(plies, reason) {
	return reason !== "abandoned" && movesBy("second", plies) >= 10;
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
//#region supabase/functions/multiplayer/handler.ts
/**
* The multiplayer server function: the referee for games between two students.
*
* The browser only ever *asks*: "make this move", "I resign", "join the game with this
* code". This works out who's asking from their sign-in token (never from the request),
* checks it against the rules in shared/multiplayer.ts, and only then saves the change.
*
* Every save says "only if the game's version is still N". If two requests arrive at
* once, the database lets one through and the other is refused, so there are no double
* moves and nothing sneaks in after a game has ended.
*/
/** Waiting games disappear after this long if nobody joins. */
const WAITING_GAME_MS = 6e5;
/** What students see. Friendly, and nothing technical. */
const MESSAGES = {
	"sign-in": [401, "Please sign in again."],
	"bad-request": [400, "Something went wrong. Please try again."],
	paused: [403, "Your teacher has paused games against friends for now."],
	hidden: [403, "Playing friends isn’t available for you right now. Ask your teacher."],
	"not-found": [404, "We couldn’t find a game with that code. Check it and try again."],
	"not-yours": [403, "That isn’t your game."],
	"not-started": [409, "Your friend hasn’t joined yet."],
	"not-your-turn": [409, "It’s not your turn yet."],
	illegal: [400, "That move isn’t allowed."],
	over: [409, "This game has already finished."],
	changed: [409, "The game changed just then. Have another look."],
	"too-many": [429, "Slow down a little! Try again in a minute."],
	"too-many-codes": [429, "That’s a lot of codes. Wait a minute, then try again."],
	"not-yet": [409, "You can claim the win once they’ve had 2 minutes."],
	"own-game": [409, "That’s your own game! Give the code to a friend."],
	full: [409, "Someone else has already joined that game."],
	expired: [410, "That game stopped waiting. Ask your friend to make a new one."],
	"no-offer": [409, "There’s no draw offer to answer."],
	"draw-limit": [409, "You’ve offered all the draws you can in this game."],
	"draw-wait": [409, `Make 5 more moves before offering another draw.`],
	"no-opponent": [409, "Your opponent can’t play a rematch right now."],
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
/** Counts requests per student in this server's memory. A soft limit: each server copy counts separately. */
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
/** Makes the request handler. Keep one per server, so the rate limits are remembered. */
function multiplayerHandler(services) {
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
					"not-found"
				].includes(error.problem)) console.warn(`multiplayer: refused ${String(body.action)} (${error.problem})`);
				return refuse(error);
			}
			console.error(`multiplayer: ${String(body.action)} failed`);
			return refuse(new Refused("failed"));
		}
	};
}
const ACTIONS = {
	create,
	join,
	cancel,
	move,
	resign,
	"offer-draw": offerDraw,
	"answer-draw": answerDraw,
	"claim-win": claimWin,
	rematch
};
/** Can this student play right now? `forPlaying` also checks the teacher's switch. */
async function mustBeAllowed(services, player, forPlaying) {
	const status = await services.playerStatus(player);
	if (!status?.school) throw new Refused("sign-in");
	if (status.hidden) throw new Refused("hidden");
	if (forPlaying && !status.multiplayerEnabled) throw new Refused("paused");
	return status;
}
async function loadMyGame(services, me, id) {
	if (typeof id !== "string" || id.length > 64) throw new Refused("bad-request");
	const game = await services.loadGame(id);
	if (!game) throw new Refused("not-yours");
	if (game.first_player === me) return {
		game,
		side: "first"
	};
	if (game.second_player === me) return {
		game,
		side: "second"
	};
	throw new Refused("not-yours");
}
function mustBePlaying(game) {
	if (game.status === "waiting") throw new Refused("not-started");
	if (game.status !== "playing") throw new Refused("over");
}
async function save(services, game, patch) {
	const saved = await services.updateGame(game.id, game.version, {
		...patch,
		version: game.version + 1
	});
	if (!saved) throw new Refused("changed");
	return saved;
}
function iso(ms) {
	return new Date(ms).toISOString();
}
/** The changes that end a game. */
function ending(services, game, winner, reason, plies = game.moves.length) {
	return {
		status: "finished",
		winner,
		reason,
		counts_for_points: countsForPoints(plies, reason),
		finished_at: iso(services.now()),
		draw_offer: null
	};
}
async function create({ services, me, body }) {
	if (!isGameKind(body.game)) throw new Refused("bad-request");
	const choice = body.side;
	if (choice !== "first" && choice !== "second" && choice !== "random") throw new Refused("bad-request");
	if ((await mustBeAllowed(services, me, true)).createdLastHour >= 20) throw new Refused("too-many");
	await cancelWaitingGame(services, me);
	const side = choice === "random" ? services.random() < .5 ? "first" : "second" : choice;
	for (let tries = 0; tries < 5; tries++) {
		const inserted = await services.insertGame({
			game: body.game,
			code: makeCode(() => services.random()),
			in_lobby: body.lobby === true,
			created_by: me,
			first_player: side === "first" ? me : null,
			second_player: side === "second" ? me : null,
			status: "waiting",
			expires_at: iso(services.now() + WAITING_GAME_MS)
		});
		if (inserted === "code-taken") continue;
		if (inserted === "already-waiting") throw new Refused("changed");
		if (inserted === "failed") throw new Refused("failed");
		return inserted;
	}
	throw new Refused("failed");
}
async function cancelWaitingGame(services, me) {
	const waiting = await services.findWaitingCreatedBy(me);
	if (waiting) await services.updateGame(waiting.id, waiting.version, {
		status: "cancelled",
		version: waiting.version + 1
	});
}
async function join({ services, limiter, me, body }) {
	let game;
	if (body.code !== void 0) {
		if (!limiter.allow(`code:${me}`, 10)) throw new Refused("too-many-codes");
		const code = normaliseCode(body.code);
		game = code ? await services.findWaitingByCode(code) : null;
		if (!game) throw new Refused("not-found");
	} else {
		if (typeof body.gameId !== "string" || body.gameId.length > 64) throw new Refused("bad-request");
		game = await services.loadGame(body.gameId);
		if (!game || !game.in_lobby) throw new Refused("not-found");
	}
	await mustBeAllowed(services, me, true);
	if (game.created_by === me) throw new Refused("own-game");
	if (game.status === "playing" || game.status === "finished") throw new Refused("full");
	if (game.status !== "waiting" || Date.parse(game.expires_at) <= services.now()) throw new Refused("expired");
	const creator = game.created_by && await services.playerStatus(game.created_by);
	if (!creator || !creator.school || creator.hidden) throw new Refused("expired");
	const now = iso(services.now());
	const joined = await services.updateGame(game.id, game.version, {
		first_player: game.first_player ?? me,
		second_player: game.second_player ?? me,
		status: "playing",
		started_at: now,
		turn_started_at: now,
		version: game.version + 1
	});
	if (!joined) throw new Refused("full");
	await cancelWaitingGame(services, me);
	return joined;
}
async function cancel({ services, me, body }) {
	const { game } = await loadMyGame(services, me, body.gameId);
	if (game.created_by !== me) throw new Refused("not-yours");
	if (game.status !== "waiting") return game;
	return await services.updateGame(game.id, game.version, {
		status: "cancelled",
		version: game.version + 1
	}) ?? await services.loadGame(game.id) ?? game;
}
async function move({ services, me, body }) {
	const { game, side } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	await mustBeAllowed(services, me, true);
	if (body.ply !== game.moves.length) throw new Refused("changed");
	const replayed = replayGame(game.game, game.moves);
	if (!replayed.ok) throw new Refused("failed");
	if (replayed.toMove !== side) throw new Refused("not-your-turn");
	const played = checkMove(game.game, game.moves, body.move);
	if (!played) throw new Refused("illegal");
	const moves = [...game.moves, played];
	const after = replayGame(game.game, moves);
	if (!after.ok) throw new Refused("failed");
	return save(services, game, {
		moves,
		turn_started_at: iso(services.now()),
		draw_offer: null,
		...after.ended && ending(services, game, after.ended.winner, after.ended.reason, moves.length)
	});
}
async function resign({ services, me, body }) {
	const { game, side } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	return save(services, game, ending(services, game, otherSide(side), "resigned"));
}
async function offerDraw({ services, me, body }) {
	const { game, side } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	await mustBeAllowed(services, me, false);
	if (game.draw_offer === otherSide(side)) return save(services, game, ending(services, game, null, "agreed-draw"));
	if (game.draw_offer === side) return game;
	const made = side === "first" ? game.first_draw_offers : game.second_draw_offers;
	const lastPly = side === "first" ? game.first_offer_ply : game.second_offer_ply;
	if (made >= 3) throw new Refused("draw-limit");
	const plies = game.moves.length;
	if (lastPly !== null && movesBy(side, plies) - movesBy(side, lastPly) < 5) throw new Refused("draw-wait");
	return save(services, game, side === "first" ? {
		draw_offer: side,
		first_draw_offers: made + 1,
		first_offer_ply: plies
	} : {
		draw_offer: side,
		second_draw_offers: made + 1,
		second_offer_ply: plies
	});
}
async function answerDraw({ services, me, body }) {
	const { game, side } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	if (typeof body.accept !== "boolean") throw new Refused("bad-request");
	if (game.draw_offer !== otherSide(side)) throw new Refused("no-offer");
	if (body.accept) return save(services, game, ending(services, game, null, "agreed-draw"));
	return save(services, game, { draw_offer: null });
}
async function claimWin({ services, me, body }) {
	const { game, side } = await loadMyGame(services, me, body.gameId);
	mustBePlaying(game);
	const replayed = replayGame(game.game, game.moves);
	if (!replayed.ok) throw new Refused("failed");
	if (replayed.toMove === side) throw new Refused("not-yet", { secondsLeft: CLAIM_WIN_AFTER_MS / 1e3 });
	const waited = services.now() - Date.parse(game.turn_started_at ?? game.started_at ?? "");
	if (!(waited >= 12e4)) {
		const left = Number.isFinite(waited) ? CLAIM_WIN_AFTER_MS - waited : CLAIM_WIN_AFTER_MS;
		throw new Refused("not-yet", { secondsLeft: Math.ceil(left / 1e3) });
	}
	return save(services, game, ending(services, game, side, "abandoned"));
}
async function rematch(context, tries = 0) {
	const { services, me, body } = context;
	const { game, side } = await loadMyGame(services, me, body.gameId);
	if (game.status !== "finished") throw new Refused("bad-request");
	if (game.rematch_game) return game;
	await mustBeAllowed(services, me, true);
	const opponent = side === "first" ? game.second_player : game.first_player;
	const them = opponent && await services.playerStatus(opponent);
	if (!them || !them.school || them.hidden) throw new Refused("no-opponent");
	const flag = side === "first" ? "first_wants_rematch" : "second_wants_rematch";
	let asked;
	try {
		asked = game[flag] ? game : await save(services, game, { [flag]: true });
	} catch (error) {
		if (error instanceof Refused && error.problem === "changed" && tries < 2) return rematch(context, tries + 1);
		throw error;
	}
	if (!(asked.first_wants_rematch && asked.second_wants_rematch)) return asked;
	const now = iso(services.now());
	const next = await services.insertGame({
		game: asked.game,
		code: null,
		in_lobby: false,
		created_by: me,
		first_player: asked.second_player,
		second_player: asked.first_player,
		status: "playing",
		expires_at: now,
		started_at: now,
		turn_started_at: now
	});
	if (typeof next === "string") throw new Refused("failed");
	const linked = await services.updateGame(asked.id, asked.version, {
		rematch_game: next.id,
		version: asked.version + 1
	});
	if (linked) return linked;
	await services.updateGame(next.id, next.version, {
		status: "cancelled",
		version: next.version + 1
	});
	return await services.loadGame(asked.id) ?? asked;
}
//#endregion
//#region supabase/functions/multiplayer/entry.ts
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
const games = () => admin.from("mp_games");
/** Logs say which step went wrong and the database's error code, never who. */
function logProblem(step, code) {
	console.error(`multiplayer: ${step} failed (${code ?? "unknown"})`);
}
Deno.serve(multiplayerHandler({
	now: () => Date.now(),
	random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async playerStatus(player) {
		const { data, error } = await admin.rpc("mp_player_status", { player }).maybeSingle();
		if (error || !data) {
			if (error) logProblem("player check", error.code);
			return null;
		}
		const row = data;
		return {
			school: row.school,
			hidden: row.hidden,
			multiplayerEnabled: row.multiplayer_enabled,
			createdLastHour: row.created_last_hour
		};
	},
	async loadGame(id) {
		if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
		const { data, error } = await games().select("*").eq("id", id).maybeSingle();
		if (error) logProblem("load", error.code);
		return data ?? null;
	},
	async findWaitingByCode(code) {
		const { data, error } = await games().select("*").eq("code", code).eq("status", "waiting").maybeSingle();
		if (error) logProblem("find code", error.code);
		return data ?? null;
	},
	async findWaitingCreatedBy(player) {
		const { data, error } = await games().select("*").eq("created_by", player).eq("status", "waiting").maybeSingle();
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
