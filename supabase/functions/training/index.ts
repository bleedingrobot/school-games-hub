// GENERATED FILE: don't edit. Edit supabase/functions/training/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "training" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
//#region shared/training/config.ts
const TRAINING_CONFIG = {
	/** How many of the latest answers decide its colour (the middle of these). */
	colourFromLastAnswers: 3,
	/** How many answers we remember per fact. */
	historyLength: 10,
	/** "Known" = bright green on this many different days. */
	knownGreenDays: 2,
	/** A fact at this band or faster is secure enough to move on to the next set of facts. */
	secureBand: "light",
	/** A session: about 3 minutes or this many questions, whichever comes first. */
	session: {
		questions: 24,
		minQuestions: 20,
		maxQuestions: 30,
		maxMs: 18e4,
		/** Share of the questions in each group. Learning gets whatever is left over. */
		reviewShare: .25,
		knownShare: .15,
		/** How many facts are being learned at once (the rest wait their turn). */
		learningFacts: 6,
		/** How many different known facts are used for the easy wins and the last question. */
		knownFacts: 6,
		/** Struggling students: 2 new facts among about 4 known ones. */
		struggling: {
			learningFacts: 2,
			knownFacts: 4,
			reviewShare: .2,
			knownShare: .4
		},
		/** Nobody sees the same fact twice in a row, and no fact is asked more than this often in one session. */
		maxAsksPerFact: 5
	},
	/** Struggling = fewer than this share right over the last `window` answers (needs at least `minAnswers`). */
	struggling: {
		window: 12,
		minAnswers: 8,
		belowCorrect: .6
	},
	/**
	* Saving answers (stage T.2). The newest `answersPerFact` answers of each fact are kept in the
	* database (enough to rebuild its colour, green days and review date), and a student can save
	* `answersPerDay` answers a day. The browser stops timing an answer at `longestAnswerMs`
	* (anything slower is "New to me" anyway), and the server turns away times over `rejectAnswerMs`.
	*/
	storage: {
		answersPerFact: 30,
		answersPerDay: 600,
		longestAnswerMs: 12e4,
		rejectAnswerMs: 6e5,
		longestTypingMs: 1e4
	},
	/** Days before a fact is due for review again, by how many green days it has. */
	reviewDays: [
		1,
		2,
		4,
		7,
		14
	],
	/** Typing check: how many recent checks we keep per answer length, and what we assume before any. */
	typing: {
		keep: 5,
		defaultMs: {
			1: 700,
			2: 1100,
			3: 1500
		}
	},
	/** The ladder: the NZC order times tables are taught in (plan section 8). The order inside a step is the order facts are introduced. */
	tableFamilies: [
		{
			step: 1,
			tables: [
				2,
				5,
				10,
				1
			]
		},
		{
			step: 2,
			tables: [
				3,
				4,
				8
			]
		},
		{
			step: 3,
			tables: [6, 9]
		},
		{
			step: 4,
			tables: [7]
		},
		{
			step: 5,
			tables: [11, 12]
		}
	],
	maxFactor: 12
};
//#endregion
//#region shared/training/facts.ts
/**
* Times-table and division facts up to 12 x 12, grouped into fact families.
* Keys match the maths focus plan's style: "mul:6x7" (smaller number first) and "div:42/6".
*/
const mulKey = (x, y) => `mul:${Math.min(x, y)}x${Math.max(x, y)}`;
const divKey = (product, divisor) => `div:${product}/${divisor}`;
const familyKeyOf = (x, y) => `fam:${Math.min(x, y)}x${Math.max(x, y)}`;
/** The step a times table is taught at (the "x6 table" is step 3, and so on). */
function tableStep(table, config = TRAINING_CONFIG) {
	const found = config.tableFamilies.find((f) => f.tables.includes(table));
	return found ? found.step : config.tableFamilies.length;
}
/** A fact is learned with the earlier of its two tables: 2 x 7 comes with the x2 table, not the x7 one. */
function factStep(x, y, config = TRAINING_CONFIG) {
	return Math.min(tableStep(x, config), tableStep(y, config));
}
function buildFamilies(config = TRAINING_CONFIG) {
	const out = [];
	for (let a = 1; a <= config.maxFactor; a++) for (let b = a; b <= config.maxFactor; b++) {
		const product = a * b;
		out.push({
			key: familyKeyOf(a, b),
			a,
			b,
			product,
			step: factStep(a, b, config),
			mulKey: mulKey(a, b),
			divKeys: a === b ? [divKey(product, a)] : [divKey(product, a), divKey(product, b)]
		});
	}
	return out;
}
function buildFacts(config = TRAINING_CONFIG) {
	const out = [];
	for (const f of buildFamilies(config)) {
		out.push({
			key: f.mulKey,
			kind: "mul",
			a: f.a,
			b: f.b,
			answer: f.product,
			step: f.step,
			familyKey: f.key
		});
		for (const k of f.divKeys) {
			const divisor = Number(k.split("/")[1]);
			out.push({
				key: k,
				kind: "div",
				a: f.product,
				b: divisor,
				answer: f.product / divisor,
				step: f.step,
				familyKey: f.key
			});
		}
	}
	return out;
}
const FAMILIES = buildFamilies();
const FACTS = buildFacts();
const FACT_BY_KEY = new Map(FACTS.map((f) => [f.key, f]));
new Map(FAMILIES.map((f) => [f.key, f]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 864e5;
const isInt = (v, min, max) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
/** "YYYY-MM-DD" as a day number, or null if it isn't a real date. */
function dayNumber(day) {
	if (typeof day !== "string" || !DAY.test(day)) return null;
	const t = Date.parse(`${day}T00:00:00Z`);
	if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== day) return null;
	return Math.round(t / DAY_MS);
}
function checkAnswer(raw, now) {
	if (typeof raw !== "object" || raw === null) return {
		ok: false,
		problem: "answer-shape"
	};
	const a = raw;
	const { storage } = TRAINING_CONFIG;
	if (typeof a.key !== "string") return {
		ok: false,
		problem: "fact"
	};
	const fact = FACT_BY_KEY.get(a.key);
	if (!fact) return {
		ok: false,
		problem: "fact"
	};
	if (!isInt(a.given, 0, 999999)) return {
		ok: false,
		problem: "given"
	};
	if (!isInt(a.ms, 0, storage.rejectAnswerMs)) return {
		ok: false,
		problem: "time"
	};
	if (!isInt(a.typingMs, 0, storage.longestTypingMs)) return {
		ok: false,
		problem: "typing"
	};
	if (!isInt(a.at, now - 30 * DAY_MS, now + 6e5)) return {
		ok: false,
		problem: "when"
	};
	const day = dayNumber(a.day);
	if (day === null || Math.abs(day - Math.floor(a.at / DAY_MS)) > 1) return {
		ok: false,
		problem: "day"
	};
	return {
		ok: true,
		item: {
			key: a.key,
			given: a.given,
			ms: a.ms,
			typingMs: a.typingMs,
			at: a.at,
			day: a.day,
			correct: a.given === fact.answer
		}
	};
}
function checkTyping(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
	const out = {};
	for (const [digits, samples] of Object.entries(raw)) {
		if (![
			"1",
			"2",
			"3"
		].includes(digits) || !Array.isArray(samples) || samples.length > TRAINING_CONFIG.typing.keep * 2) return null;
		if (!samples.every((ms) => isInt(ms, 1, TRAINING_CONFIG.storage.longestTypingMs))) return null;
		out[digits] = samples;
	}
	return out;
}
/** Checks one queue item. A bad one is dropped for good, so the problem is a short word for the logs. */
function checkItem(raw, now) {
	if (typeof raw !== "object" || raw === null) return {
		ok: false,
		problem: "shape"
	};
	const item = raw;
	if (item.type === "answers") {
		if (typeof item.batchId !== "string" || !UUID.test(item.batchId)) return {
			ok: false,
			problem: "batch-id"
		};
		if (!isInt(item.seed, 0, 2147483647)) return {
			ok: false,
			problem: "seed"
		};
		if (!Array.isArray(item.answers) || item.answers.length === 0 || item.answers.length > 60) return {
			ok: false,
			problem: "answers"
		};
		const answers = [];
		for (const a of item.answers) {
			const checked = checkAnswer(a, now);
			if (!checked.ok) return checked;
			answers.push(checked.item);
		}
		return {
			ok: true,
			item: {
				type: "answers",
				batchId: item.batchId.toLowerCase(),
				seed: item.seed,
				answers
			}
		};
	}
	if (item.type === "student") {
		const typing = checkTyping(item.typing);
		if (!typing) return {
			ok: false,
			problem: "typing"
		};
		if (typeof item.autoSubmit !== "boolean") return {
			ok: false,
			problem: "auto-submit"
		};
		if (!isInt(item.sessionsDone, 0, 1e5)) return {
			ok: false,
			problem: "sessions"
		};
		return {
			ok: true,
			item: {
				type: "student",
				typing,
				autoSubmit: item.autoSubmit,
				sessionsDone: item.sessionsDone
			}
		};
	}
	return {
		ok: false,
		problem: "type"
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
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleTraining(request) {
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
		const body = await readJsonBody(request);
		if (!body || !Array.isArray(body.items) || body.items.length > 40) return reply(400, { error: "That couldn't be read." });
		const results = [];
		for (const raw of body.items) {
			const checked = checkItem(raw, services.now());
			if (!checked.ok) {
				console.warn(`training: refused an item (${checked.problem})`);
				results.push({
					type: "invalid",
					problem: checked.problem
				});
				continue;
			}
			const result = await save(player, checked.item, services);
			if (result === "stop") break;
			results.push(result);
		}
		if (results.length < body.items.length && results.length === 0) return reply(503, { error: "We couldn't save your training just now." });
		return reply(200, {
			handled: results.length,
			results
		});
	};
}
async function save(player, item, services) {
	const saved = item.type === "answers" ? await services.recordAnswers(player, item) : await services.recordStudent(player, item);
	if (!saved.ok) return saved.why === "refused" ? {
		type: "invalid",
		problem: "refused"
	} : "stop";
	return item.type === "answers" ? {
		type: "answers",
		added: saved.value
	} : { type: "student" };
}
/** What the database function needs besides the answers: how many of each fact to keep, and the daily limit. */
const SAVE_LIMITS = {
	keepPerFact: TRAINING_CONFIG.storage.answersPerFact,
	dailyLimit: TRAINING_CONFIG.storage.answersPerDay
};
//#endregion
//#region supabase/functions/training/entry.ts
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
	console.error(`training: ${name} failed (${error.code ?? "unknown"})`);
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
	now: () => Date.now(),
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	recordAnswers: (player, item) => call("record_training_answers", {
		player,
		batch_id: item.batchId,
		seed: item.seed,
		answers: item.answers,
		keep_per_fact: SAVE_LIMITS.keepPerFact,
		daily_limit: SAVE_LIMITS.dailyLimit
	}),
	recordStudent: (player, item) => call("record_training_student", {
		player,
		typing: item.typing,
		auto_submit: item.autoSubmit,
		sessions_done: item.sessionsDone
	})
}));
//#endregion
