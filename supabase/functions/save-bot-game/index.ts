// GENERATED FILE: don't edit. Edit supabase/functions/save-bot-game/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "save-bot-game" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { Chess } from "npm:chess.js@1.4.0";
//#region shared/botGame.ts
const BOT_LEVEL_IDS = [
	"very-easy",
	"easy",
	"medium"
];
function isClaimedEnding(value) {
	return value === "finished" || value === "resigned" || value === "abandoned";
}
function isBotLevelId(value) {
	return BOT_LEVEL_IDS.includes(value);
}
/** A list of moves that came from outside: an array of short strings, not too long. */
function isMoveList(value) {
	return Array.isArray(value) && value.length <= 1e3 && value.every((m) => typeof m === "string" && m.length <= 64);
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
function boardResult$1(chess) {
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
function replay$1(moves) {
	const chess = new Chess();
	for (let i = 0; i < moves.length; i++) if (boardResult$1(chess) || !playUci(chess, moves[i])) return {
		ok: false,
		badMoveIndex: i
	};
	return {
		ok: true,
		chess,
		result: boardResult$1(chess)
	};
}
//#endregion
//#region shared/chess/botGame.ts
/**
* Deciding the result of a game against a bot. The website uses this to show the result
* straight away, and the server runs the very same code before saving, so a student
* can't send in a pretend win.
*/
/** Checks the shape of a report that came from outside (e.g. the browser). */
function parseReport(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (!isBotLevelId(r.level)) return null;
	if (r.studentColour !== "white" && r.studentColour !== "black") return null;
	if (!isClaimedEnding(r.ending) || !isMoveList(r.moves)) return null;
	return {
		level: r.level,
		studentColour: r.studentColour,
		moves: r.moves,
		ending: r.ending
	};
}
function studentMoveCount$1(moves, studentColour) {
	return studentColour === "white" ? Math.ceil(moves.length / 2) : Math.floor(moves.length / 2);
}
function judgeBotGame(report) {
	if (report.moves.length > 1e3) return {
		ok: false,
		problem: "too many moves"
	};
	const replayed = replay$1(report.moves);
	if (!replayed.ok) return {
		ok: false,
		problem: `illegal move at ${replayed.badMoveIndex + 1}`
	};
	const studentMoves = studentMoveCount$1(report.moves, report.studentColour);
	const longEnough = studentMoves >= 10;
	if (replayed.result) {
		const { ending, winner } = replayed.result;
		return {
			ok: true,
			game: {
				outcome: winner === null ? "drawn" : winner === report.studentColour ? "won" : "lost",
				reason: ending,
				studentMoves,
				countsForPoints: longEnough
			}
		};
	}
	if (report.ending === "finished") return {
		ok: false,
		problem: "the game is not over"
	};
	return {
		ok: true,
		game: {
			outcome: "lost",
			reason: report.ending,
			studentMoves,
			countsForPoints: report.ending === "resigned" && longEnough
		}
	};
}
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
function boardResult(position) {
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
function replay(moves) {
	let position = startPosition();
	const played = [];
	for (let i = 0; i < moves.length; i++) {
		const move = boardResult(position) ? null : findMove(position, moves[i]);
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
		result: boardResult(position)
	};
}
//#endregion
//#region shared/checkers/botGame.ts
/**
* Deciding the result of a checkers game against a bot. The website uses this to show the
* result straight away, and the save-bot-game server function runs the very same code
* before saving, so a student can't send in a pretend win.
*/
/** Checks the shape of a report that came from outside (e.g. the browser). */
function parseCheckersReport(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (!isBotLevelId(r.level)) return null;
	if (r.studentColour !== "red" && r.studentColour !== "white") return null;
	if (!isClaimedEnding(r.ending) || !isMoveList(r.moves)) return null;
	return {
		level: r.level,
		studentColour: r.studentColour,
		moves: r.moves,
		ending: r.ending
	};
}
function studentMoveCount(moves, studentColour) {
	return studentColour === "red" ? Math.ceil(moves.length / 2) : Math.floor(moves.length / 2);
}
function judgeCheckersGame(report) {
	if (report.moves.length > 1e3) return {
		ok: false,
		problem: "too many moves"
	};
	const replayed = replay(report.moves);
	if (!replayed.ok) return {
		ok: false,
		problem: `illegal move at ${replayed.badMoveIndex + 1}`
	};
	const studentMoves = studentMoveCount(report.moves, report.studentColour);
	const longEnough = studentMoves >= 10;
	if (replayed.result) {
		const { ending, winner } = replayed.result;
		return {
			ok: true,
			game: {
				outcome: winner === null ? "drawn" : winner === report.studentColour ? "won" : "lost",
				reason: ending,
				studentMoves,
				countsForPoints: longEnough
			}
		};
	}
	if (report.ending === "finished") return {
		ok: false,
		problem: "the game is not over"
	};
	return {
		ok: true,
		game: {
			outcome: "lost",
			reason: report.ending,
			studentMoves,
			countsForPoints: report.ending === "resigned" && longEnough
		}
	};
}
//#endregion
//#region supabase/functions/save-bot-game/handler.ts
/**
* The save-bot-game server function: the browser sends the moves of a finished chess or
* checkers game against a bot, and this decides the result and saves it.
*
* It never trusts the browser's word for the result. It replays every move with the same
* rules code the website uses (chess.js for chess, shared/checkers for checkers), works
* out who won, and only then saves it. The bot's moves are checked for legality too; a
* determined student could still fake the bot's moves, which is why bot games will only
* ever earn small, capped points.
*/
/** Websites allowed to call this from a browser. */
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
		Vary: "Origin"
	};
}
async function handleSaveBotGame(request, services) {
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
	const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
	const player = token ? await services.userIdFor(token) : null;
	if (!player) return reply(401, { error: "Please sign in again." });
	let body;
	try {
		body = await request.json();
	} catch {
		body = null;
	}
	const checked = check(body);
	if (!checked) return reply(400, { error: "That game couldn't be read." });
	const { game: gameName, report, judged } = checked;
	if (!judged.ok) {
		console.warn(`save-bot-game: refused a game (${judged.problem})`);
		return reply(400, { error: "That game couldn't be checked." });
	}
	const { game } = judged;
	const saved = await services.record({
		player,
		game: gameName,
		bot_level: report.level,
		player_side: report.studentColour,
		moves: report.moves,
		result: game.outcome,
		reason: game.reason,
		player_moves: game.studentMoves,
		counts_for_points: game.countsForPoints
	});
	if (saved === "too-many") return reply(429, { error: "That's a lot of games today! Have a break and come back tomorrow." });
	if (saved !== "saved") return reply(500, { error: "The game couldn't be saved." });
	return reply(200, {
		result: game.outcome,
		reason: game.reason,
		countsForPoints: game.countsForPoints
	});
}
/**
* Reads and judges a report. Reports without a "game" are chess: that's what the website
* sent before checkers existed.
*/
function check(body) {
	const game = body?.game ?? "chess";
	if (game === "chess") {
		const report = parseReport(body);
		return report && {
			game: "chess",
			report,
			judged: judgeBotGame(report)
		};
	}
	if (game === "checkers") {
		const report = parseCheckersReport(body);
		return report && {
			game: "checkers",
			report,
			judged: judgeCheckersGame(report)
		};
	}
	return null;
}
//#endregion
//#region supabase/functions/save-bot-game/entry.ts
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
Deno.serve((request) => handleSaveBotGame(request, {
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	async record(row) {
		const { error } = await admin.rpc("record_bot_game", row);
		if (!error) return "saved";
		if (error.code === "54000") return "too-many";
		console.error(`save-bot-game: database refused the game (${error.code})`);
		return "refused";
	}
}));
//#endregion
