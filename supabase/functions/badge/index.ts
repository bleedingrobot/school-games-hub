// GENERATED FILE: don't edit. Edit supabase/functions/badge/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "badge" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
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
const BADGE_CODE = /^[0-9a-f]{32}$/;
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	/** When each address last tried a wrong code, so a run of wrong codes can be slowed down. */
	const wrongAt = new Map();
	const recentWrong = (from) => (wrongAt.get(from) ?? []).filter((t) => services.now() - t < 6e4);
	return async function handleBadgeRequest(request) {
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
		const from = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
		if (!limiter.allow(from, 300)) return reply(429, { error: "Too many scans. Wait a minute and try again." });
		const raw = await readJsonBody(request);
		const code = typeof raw?.code === "string" ? raw.code.trim().toLowerCase() : "";
		if (!BADGE_CODE.test(code)) return reply(400, { error: "That isn’t a sign-in badge." });
		if (recentWrong(from).length >= 20) return reply(429, { error: "Too many scans. Wait a minute and try again." });
		const email = await services.emailForBadge(code);
		if (email === "busy") return reply(503, { error: "Sign-in is busy. Try again in a minute." });
		if (!email) {
			if (wrongAt.size > 5e3) wrongAt.clear();
			wrongAt.set(from, [...recentWrong(from), services.now()]);
			return reply(404, { error: "That badge doesn’t work any more. Ask your teacher for a new one." });
		}
		const key = await services.signInKeyFor(email);
		if (key === "busy") return reply(503, { error: "Sign-in is busy. Try again in a minute." });
		return reply(200, { key });
	};
}
//#endregion
//#region supabase/functions/badge/entry.ts
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
Deno.serve(makeHandler({
	now: () => Date.now(),
	async emailForBadge(code) {
		const { data, error } = await admin.rpc("badge_sign_in", { badge_code: code });
		if (error) {
			console.error(`badge: lookup failed (${error.code ?? "unknown"})`);
			return "busy";
		}
		return typeof data === "string" && data ? data : null;
	},
	async signInKeyFor(email) {
		const { data, error } = await admin.auth.admin.generateLink({
			type: "magiclink",
			email
		});
		const key = data?.properties?.hashed_token;
		if (error || !key) {
			console.error(`badge: sign-in key failed (${error?.code ?? error?.status ?? "none"})`);
			return "busy";
		}
		return key;
	}
}));
//#endregion
