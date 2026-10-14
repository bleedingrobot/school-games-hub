// GENERATED FILE: don't edit. Edit supabase/functions/save-bot-game/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "save-bot-game" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { Chess } from "npm:chess.js@1.4.0";
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
//#region shared/chess/botGame.ts
/**
* Deciding the result of a game against a bot. The website uses this to show the result
* straight away, and the server runs the very same code before saving, so a student
* can't send in a pretend win.
*/
const BOT_LEVEL_IDS = [
	"very-easy",
	"easy",
	"medium"
];
/** Checks the shape of a report that came from outside (e.g. the browser). */
function parseReport(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (!BOT_LEVEL_IDS.includes(r.level)) return null;
	if (r.studentColour !== "white" && r.studentColour !== "black") return null;
	if (r.ending !== "finished" && r.ending !== "resigned" && r.ending !== "abandoned") return null;
	if (!Array.isArray(r.moves) || r.moves.length > 1e3 || !r.moves.every((m) => typeof m === "string")) return null;
	return {
		level: r.level,
		studentColour: r.studentColour,
		moves: r.moves,
		ending: r.ending
	};
}
function studentMoveCount(moves, studentColour) {
	return studentColour === "white" ? Math.ceil(moves.length / 2) : Math.floor(moves.length / 2);
}
function judgeBotGame(report) {
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
* The save-bot-game server function: the browser sends the moves of a finished bot game,
* and this decides the result and saves it.
*
* It never trusts the browser's word for the result. It replays every move with chess.js
* (the same rules code the website uses), works out who won, and only then saves it.
* The bot's moves are checked for legality too; a determined student could still fake
* the bot's moves, which is why bot games will only ever earn small, capped points.
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
	const report = parseReport(body);
	if (!report) return reply(400, { error: "That game couldn't be read." });
	const judged = judgeBotGame(report);
	if (!judged.ok) {
		console.warn(`save-bot-game: refused a game (${judged.problem})`);
		return reply(400, { error: "That game couldn't be checked." });
	}
	const { game } = judged;
	const saved = await services.record({
		player,
		game: "chess",
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
