// GENERATED FILE: don't edit. Edit supabase/functions/pupils/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "pupils" function.

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
//#region shared/pupils/emails.ts
/** Reading school emails out of pasted text or a Google Doc/Sheet link: used by the Add pupils page and the "pupils" server function. */
const EMAIL = /^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
/** Every email address in some pasted or exported text, lower case, each once, in order. */
function emailsIn(text) {
	const found = text.toLowerCase().match(/[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) ?? [];
	return [...new Set(found.map((e) => e.replace(/\.+$/, "")))].filter((e) => EMAIL.test(e));
}
/** The plain-text export address for a Google Doc or Sheet link, or null if it isn't one. Only docs.google.com. */
function exportUrlFor(link) {
	let url;
	try {
		url = new URL(link.trim());
	} catch {
		return null;
	}
	if (url.protocol !== "https:" || url.hostname !== "docs.google.com") return null;
	const m = url.pathname.match(/^\/(document|spreadsheets)\/d\/([A-Za-z0-9_-]{10,100})(?:\/|$)/);
	if (!m) return null;
	if (m[1] === "document") return `https://docs.google.com/document/d/${m[2]}/export?format=txt`;
	const gid = (url.hash.match(/gid=(\d{1,12})/) ?? url.search.match(/gid=(\d{1,12})/))?.[1];
	return `https://docs.google.com/spreadsheets/d/${m[2]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
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
	return async function handlePupilsRequest(request) {
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
		const teacher = token ? await services.userIdFor(token) : null;
		if (!teacher) return reply(401, { error: "Please sign in again." });
		if (!limiter.allow(teacher, 10)) return reply(429, { error: "That’s a lot at once. Wait a minute and try again." });
		const raw = await readJsonBody(request);
		if (typeof raw?.link === "string") {
			const url = exportUrlFor(raw.link);
			if (!url) return reply(400, { error: "That isn’t a Google Doc or Sheet link." });
			const text = await services.fetchText(url);
			if (text === null) return reply(422, { error: "Couldn’t open that file. In Google, tap Share and set it to “Anyone with the link can view”, or copy the emails and paste them instead." });
			return reply(200, { emails: emailsIn(text).slice(0, 500) });
		}
		if (!Array.isArray(raw?.emails)) return reply(400, { error: "Send a list of emails." });
		const emails = emailsIn(raw.emails.filter((e) => typeof e === "string").join("\n"));
		if (emails.length > 100) return reply(400, { error: `Add up to 100 pupils at a time.` });
		if (!emails.length) return reply(200, {
			made: [],
			failed: []
		});
		const allowed = await services.mayCreate(teacher, emails);
		if (allowed === "busy") return reply(503, { error: "The server is busy. Try again in a minute." });
		const made = [];
		const failed = [];
		for (const email of allowed) (await services.createAccount(email) === "failed" ? failed : made).push(email);
		return reply(200, {
			made,
			failed
		});
	};
}
//#endregion
//#region supabase/functions/pupils/entry.ts
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
/** The biggest Doc or Sheet export read: a class list is a few KB. */
const MAX_TEXT = 1048576;
Deno.serve(makeHandler({
	now: () => Date.now(),
	userIdFor: userIdFromToken(admin.auth),
	async mayCreate(teacher, emails) {
		const { data, error } = await admin.rpc("pupils_may_create", {
			teacher,
			emails
		});
		if (error) {
			console.error(`pupils: pupils_may_create failed (${error.code ?? "unknown"})`);
			return "busy";
		}
		return Array.isArray(data) ? data : [];
	},
	async createAccount(email) {
		const { error } = await admin.auth.admin.createUser({
			email,
			email_confirm: true
		});
		if (!error) return "made";
		if (error.code === "email_exists" || error.status === 422) return "exists";
		console.error(`pupils: create failed (${error.code ?? error.status ?? "unknown"})`);
		return "failed";
	},
	async fetchText(url) {
		try {
			const response = await fetch(url, {
				redirect: "follow",
				signal: AbortSignal.timeout(1e4)
			});
			if (!response.ok || (response.headers.get("Content-Type") ?? "").includes("text/html")) return null;
			const text = await response.text();
			return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
		} catch {
			return null;
		}
	}
}));
//#endregion
