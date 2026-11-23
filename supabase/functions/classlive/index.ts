// GENERATED FILE: don't edit. Edit supabase/functions/classlive/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "classlive" function.

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
//#region shared/classlive/stars.ts
const ARMS = [
	"turn",
	"divide",
	"double",
	"halve",
	"tens",
	"near",
	"wild"
];
/** Stars an arm needs before it counts as lit (the turn-around arm only has one fact to find). */
const ARM_GOAL = {
	turn: 1,
	divide: 3,
	double: 3,
	halve: 3,
	tens: 3,
	near: 3,
	wild: 3
};
const LEVELS = {
	small: [
		[3, 4],
		[4, 5],
		[5, 6],
		[3, 5],
		[2, 7],
		[4, 6]
	],
	middle: [
		[6, 7],
		[4, 8],
		[3, 9],
		[7, 8],
		[6, 9],
		[4, 7],
		[8, 9],
		[6, 8]
	],
	big: [
		[6, 12],
		[7, 12],
		[8, 12],
		[9, 11],
		[11, 12],
		[9, 12],
		[7, 11]
	]
};
function anchorOf(x, y) {
	if (!Number.isInteger(x) || !Number.isInteger(y) || x < 2 || y < 2 || x > 12 || y > 12 || x === y) return null;
	return {
		x,
		y,
		p: x * y
	};
}
function pickAnchor(level, random) {
	const list = LEVELS[level];
	const [x, y] = list[Math.floor(random() * list.length) % list.length];
	return {
		x,
		y,
		p: x * y
	};
}
/** 420 → "4.2", 4200 → "42". */
function show(h) {
	const sign = h < 0 ? "-" : "";
	const v = Math.abs(h);
	const whole = Math.floor(v / 100);
	const frac = v % 100;
	if (!frac) return `${sign}${whole}`;
	return `${sign}${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}
const factText = (f) => `${show(f.a)} ${f.op === "-" ? "−" : f.op} ${show(f.b)} = ${show(f.c)}`;
const NUM = "(\\d{1,6}(?:\\.\\d{1,2})?)";
const OPS = "([+\\-−–×xX*÷/:])";
const LEFT = new RegExp(`^${NUM}${OPS}${NUM}=${NUM}$`);
const RIGHT = new RegExp(`^${NUM}=${NUM}${OPS}${NUM}$`);
const hundredths = (s) => {
	const [w, f = ""] = s.split(".");
	return Number(w) * 100 + Number((f + "00").slice(0, 2));
};
const opOf = (s) => s === "+" ? "+" : "-−–".includes(s) ? "-" : "×xX*".includes(s) ? "×" : "÷";
/** A typed fact ("12 × 7 = 84", "84 = 12x7", "4.2÷0.6=7"), or null if it can't be read. */
function readFact(text) {
	if (typeof text !== "string" || text.length > 40) return null;
	const s = text.replace(/\s+/g, "");
	let m = LEFT.exec(s);
	let fact = null;
	if (m) fact = {
		a: hundredths(m[1]),
		op: opOf(m[2]),
		b: hundredths(m[3]),
		c: hundredths(m[4])
	};
	else if (m = RIGHT.exec(s)) fact = {
		a: hundredths(m[2]),
		op: opOf(m[3]),
		b: hundredths(m[4]),
		c: hundredths(m[1])
	};
	if (!fact) return null;
	if ([
		fact.a,
		fact.b,
		fact.c
	].some((n) => n > 1e7)) return null;
	return fact;
}
/** Is it true? (exact, in hundredths) */
function isTrue(f) {
	if (f.op === "+") return f.a + f.b === f.c;
	if (f.op === "-") return f.a - f.b === f.c;
	if (f.op === "×") return f.a * f.b === f.c * 100;
	return f.b !== 0 && f.a * 100 === f.c * f.b;
}
/** The same fact written another way gets the same key (6 + 7 and 7 + 6; 12 × 7 and 7 × 12). */
function factKey(f) {
	if (f.op === "+" || f.op === "×") return `${f.op}${Math.min(f.a, f.b)},${Math.max(f.a, f.b)}`;
	return `${f.op}${f.a},${f.b}`;
}
/** A ratio n / 100x as 2^i × 10^j, if it is one (i from -2 to 3, j from -3 to 3). */
function ratioOf(h, whole) {
	for (let ten = -3; ten <= 3; ten++) for (let two = -2; two <= 3; two++) {
		const num = 2 ** Math.max(0, two) * 10 ** Math.max(0, ten);
		if (h * (2 ** Math.max(0, -two) * 10 ** Math.max(0, -ten)) === 100 * whole * num) return {
			two,
			ten
		};
	}
	return null;
}
const times = (r) => {
	const parts = [];
	if (r.ten > 0) parts.push(`× ${10 ** r.ten}`);
	if (r.ten < 0) parts.push(`÷ ${10 ** -r.ten}`);
	if (r.two === 1) parts.push("double");
	if (r.two === 2) parts.push("double twice");
	if (r.two === 3) parts.push("double three times");
	if (r.two === -1) parts.push("half");
	if (r.two === -2) parts.push("half of half");
	return parts.join(", then ");
};
/** How a true multiplication u × v = w links to the anchor, if it does. */
function multiplyLink(u, v, w, k) {
	const pairs = k.x === k.y ? [[k.x, k.y]] : [[k.x, k.y], [k.y, k.x]];
	for (const [px, py] of pairs) if (u === px * 100 && v === py * 100) return px === k.x ? "same" : {
		arm: "turn",
		how: `Turn it around: ${px} × ${py} is the same as ${k.x} × ${k.y}.`
	};
	let best = null;
	for (const [px, py] of pairs) {
		const r1 = ratioOf(u, px);
		const r2 = ratioOf(v, py);
		if (r1 && r2 && !(r1.two === 0 && r1.ten === 0 && r2.two === 0 && r2.ten === 0)) {
			const steps = [r1, r2].map((r, i) => r.two || r.ten ? `${i ? py : px} → ${show(i ? v : u)} is ${times(r)}` : "").filter(Boolean);
			const total = {
				two: r1.two + r2.two,
				ten: r1.ten + r2.ten
			};
			const sameAnswer = total.two === 0 && total.ten === 0;
			const after = sameAnswer ? `so the answer stays ${show(w)}.` : `so ${k.p} → ${show(w)}.`;
			let arm;
			if (r1.ten || r2.ten) arm = "tens";
			else if (r1.two >= 0 && r2.two >= 0) arm = "double";
			else arm = "halve";
			const how = sameAnswer && (r1.two || r2.two) && !(r1.ten || r2.ten) ? `Double one, halve the other: ${steps.join(" and ")}, ${after}` : `${steps.join(" and ")}, ${after}`;
			best = {
				arm,
				how: how.charAt(0).toUpperCase() + how.slice(1)
			};
			break;
		}
		for (const [same, other, sv, ov] of [[
			px,
			py,
			u,
			v
		], [
			py,
			px,
			v,
			u
		]]) {
			if (sv !== same * 100 || ov % 100) continue;
			const d = ov / 100 - other;
			if (d !== 0 && Math.abs(d) <= 2) {
				const groups = Math.abs(d) === 1 ? "one group" : "two groups";
				const more = d > 0 ? "more" : "fewer";
				return {
					arm: "near",
					how: `${same} × ${ov / 100} is ${groups} of ${same} ${more}: ${k.p} ${d > 0 ? "+" : "−"} ${same * Math.abs(d)} = ${show(w)}.`
				};
			}
		}
	}
	return best;
}
/** Multiples of the answer that count as "using" it for a wild link (×1, ×2, ×4, ÷2, ×10, ×100, ÷10). */
const usesAnswer = (h, p) => [
	1,
	2,
	4,
	.5,
	10,
	100,
	.1
].some((m) => Math.abs(h - p * 100 * m) < 1e-6);
/** How a true fact links to the anchor: its arm and "how we know", 'same' for the anchor itself, or null for no link. */
function linkOf(f, k) {
	const P = k.p * 100;
	if (f.op === "×") {
		const m = multiplyLink(f.a, f.b, f.c, k);
		if (m) return m;
	}
	if (f.op === "÷") {
		const m = multiplyLink(f.b, f.c, f.a, k) ?? multiplyLink(f.c, f.b, f.a, k);
		if (m === "same" || m && m.arm === "turn") return {
			arm: "divide",
			how: `Division undoes it: ${show(f.b)} × ${show(f.c)} = ${show(f.a)}, so ${show(f.a)} ÷ ${show(f.b)} = ${show(f.c)}.`
		};
		if (m) return {
			arm: "divide",
			how: `${show(f.b)} × ${show(f.c)} = ${show(f.a)} (${m.how.charAt(0).toLowerCase()}${m.how.slice(1)}) So ${show(f.a)} ÷ ${show(f.b)} = ${show(f.c)}.`
		};
	}
	if (f.op === "+" || f.op === "-") {
		const factors = [k.x * 100, k.y * 100];
		if (f.op === "+" && f.a === P && f.b === P) return {
			arm: "double",
			how: `${k.p} + ${k.p} is double ${k.p}: ${k.x} × ${k.y * 2} = ${show(f.c)}.`
		};
		if (f.op === "+" && (f.a === P && factors.includes(f.b) || f.b === P && factors.includes(f.a))) {
			const g = f.a === P ? f.b : f.a;
			return {
				arm: "near",
				how: `Add one more group of ${show(g)}: ${k.p} + ${show(g)} = ${show(f.c)}.`
			};
		}
		if (f.op === "-" && f.a === P && factors.includes(f.b)) return {
			arm: "near",
			how: `Take one group of ${show(f.b)} away: ${k.p} − ${show(f.b)} = ${show(f.c)}.`
		};
	}
	if (!(f.a === 0 || f.b === 0 || (f.op === "×" || f.op === "÷") && (f.a === 100 || f.b === 100)) && [
		f.a,
		f.b,
		f.c
	].some((h) => usesAnswer(h, k.p))) return {
		arm: "wild",
		how: `Another way to reach ${[
			f.a,
			f.b,
			f.c
		].some((h) => h === P) ? k.p : show([
			f.a,
			f.b,
			f.c
		].find((h) => usesAnswer(h, k.p)))}.`
	};
	return null;
}
function newStars(anchor, level) {
	return {
		kind: "stars",
		level,
		anchor,
		stars: [],
		creature: false,
		supernova: false,
		spotlight: null,
		mine: {}
	};
}
const armCount = (g, arm) => g.stars.filter((s) => s.arm === arm).length;
const armLit = (g, arm) => armCount(g, arm) >= ARM_GOAL[arm];
/** The emptiest arm still to light (for the pupil's nudge), or null when all are lit. */
function nudgeOf(g) {
	let best = null;
	for (const arm of ARMS) {
		if (armLit(g, arm)) continue;
		if (best === null || armCount(g, arm) / ARM_GOAL[arm] < armCount(g, best) / ARM_GOAL[best]) best = arm;
	}
	return best;
}
/** A pupil's try at a fact. */
function tryFact(g, pupil, text, t) {
	const mine = g.mine[pupil] ??= {
		found: 0,
		glows: 0,
		tries: 0,
		lastAt: -Infinity
	};
	if (t - mine.lastAt < 1500) return {
		ok: false,
		reason: "too_soon"
	};
	mine.lastAt = t;
	mine.tries++;
	const fact = readFact(text);
	if (!fact) return {
		ok: true,
		reply: {
			result: "unreadable",
			nudge: nudgeOf(g)
		},
		events: []
	};
	const text2 = factText(fact);
	if (!isTrue(fact)) return {
		ok: true,
		reply: {
			result: "wrong",
			text: text2,
			nudge: nudgeOf(g)
		},
		events: []
	};
	const link = linkOf(fact, g.anchor);
	if (link === "same") return {
		ok: true,
		reply: {
			result: "same",
			text: text2,
			nudge: nudgeOf(g)
		},
		events: []
	};
	if (!link) return {
		ok: true,
		reply: {
			result: "unlinked",
			text: text2,
			nudge: nudgeOf(g)
		},
		events: []
	};
	const key = factKey(fact);
	const found = g.stars.find((s) => s.key === key);
	if (found) {
		if (found.by !== pupil) {
			found.glow++;
			mine.glows++;
		}
		return {
			ok: true,
			reply: {
				result: "again",
				star: found,
				nudge: nudgeOf(g)
			},
			events: found.by !== pupil ? [{
				type: "glow",
				t,
				id: found.id,
				pupil
			}] : []
		};
	}
	if (g.stars.length >= 120) return {
		ok: true,
		reply: {
			result: "full",
			text: text2,
			nudge: null
		},
		events: []
	};
	const wasLit = armLit(g, link.arm);
	const star = {
		id: g.stars.length + 1,
		key,
		text: text2,
		arm: link.arm,
		how: link.how,
		by: pupil,
		at: t,
		glow: 0
	};
	g.stars.push(star);
	mine.found++;
	const events = [{
		type: "star",
		t,
		star,
		pupil
	}];
	if (!wasLit && armLit(g, link.arm)) events.push({
		type: "arm_lit",
		t,
		arm: link.arm
	});
	if (!g.creature && ARMS.every((arm) => armLit(g, arm))) {
		g.creature = true;
		events.push({
			type: "creature",
			t
		});
	}
	if (!g.supernova && g.stars.length >= 30) {
		g.supernova = true;
		events.push({
			type: "supernova",
			t
		});
	}
	return {
		ok: true,
		reply: {
			result: "new",
			star,
			nudge: nudgeOf(g)
		},
		events
	};
}
/** The teacher puts a star in the middle of the big screen (null puts it back). */
function spotlight(g, id, t) {
	const pick = id === null ? null : g.stars.find((s) => s.id === id)?.id ?? null;
	if (pick === g.spotlight) return [];
	g.spotlight = pick;
	return [{
		type: "spotlight",
		t,
		id: pick
	}];
}
//#endregion
//#region shared/classlive/server.ts
/**
* Class Live's server steps (docs/CLASSLIVE-PLAN.md section 5), with the database passed in (`ClassLiveServices`), so the
* edge function (supabase/functions/classlive), the tests and the `?pretend=30` preview all run the same code. Copies
* Class Showdown's pattern (shared/showdown/server.ts): the room keeps the whole session (hidden from pupils), every step
* loads it, applies one change and saves it at the version it was loaded at (compare-and-swap); a refused save runs the
* step again on the newer session.
*
* Three rows come out of every save:
*   - the room's `view` (RoomView): what any pupil of the class may read: the game, its state, counts. No names.
*   - the room's `screen` (ScreenView): what the projector draws, with first names and the latest events. Teachers only.
*   - each changed pupil's own row (PlayerView).
*
* Teacher steps: open, view, start, end, spotlight. Pupil steps: join, play.
*/
const ACTIVITIES = ["stars"];
const LENGTHS = [
	0,
	5,
	10,
	15
];
const ok = (body) => ({
	status: 200,
	body
});
const no = (status, error, reason) => ({
	status,
	body: {
		error,
		...reason ? { reason } : {}
	}
});
const busy = () => no(503, "Class Live is very busy. Try again!", "busy");
const OFF = "Class Live is switched off for this class.";
const MAX_TRIES = 8;
const firstName = (name) => name.trim().split(/\s+/)[0]?.slice(0, 20) || "A player";
function publicGame(g) {
	const arms = Object.fromEntries(ARMS.map((a) => [a, armCount(g, a)]));
	return {
		kind: "stars",
		anchor: g.anchor,
		arms,
		total: g.stars.length,
		creature: g.creature,
		supernova: g.supernova
	};
}
function roomView(s, startedAt) {
	return {
		activity: s.activity,
		state: s.state,
		lengthMin: s.lengthMin,
		startedAt,
		players: s.order.length,
		game: publicGame(s.game)
	};
}
function screenView(row, s, startedAt) {
	const { game: _g, ...base } = roomView(s, startedAt);
	return {
		...base,
		showNames: row.showNames,
		people: s.order.map((id) => ({
			id,
			name: row.showNames ? firstName(s.players[id].name) : null,
			colour: s.players[id].colour
		})),
		game: s.game,
		seq: row.seq,
		events: row.events
	};
}
function playerView(s, id) {
	const p = s.players[id];
	const mine = s.game.mine[id];
	return {
		player: id,
		name: firstName(p.name),
		colour: p.colour,
		game: {
			kind: "stars",
			found: mine?.found ?? 0,
			glows: mine?.glows ?? 0,
			tries: mine?.tries ?? 0,
			mine: s.game.stars.filter((x) => x.by === id).map((x) => x.text)
		}
	};
}
/** Time in ms since the start (0 in the lobby). */
const timeOf = (row, now) => row.startedAt === null ? 0 : Math.max(0, now - row.startedAt);
/** Is a timed session past its end? */
const timeUp = (s, row, now) => s.state === "live" && s.lengthMin > 0 && timeOf(row, now) >= s.lengthMin * 6e4;
/** Loads the room, applies one step and saves it if nobody else saved first (else runs it again on the newer session). */
async function mutate(sv, room, step) {
	for (let tries = 0; tries < MAX_TRIES; tries++) {
		const row = await sv.loadRoom(room);
		if (row === "busy") return { refuse: busy() };
		if (!row) return { refuse: no(404, "That room couldn't be found.", "gone") };
		const s = structuredClone(row.session);
		const now = sv.now();
		const t = timeOf(row, now);
		const events = [];
		if (timeUp(s, row, now)) {
			s.state = "over";
			events.push({
				type: "over",
				t,
				why: "time"
			});
		}
		const out = step(s, t, row);
		if ("refuse" in out) {
			if (!events.length) return out;
		} else events.push(...out.events);
		const startedAt = "refuse" in out || out.startedAt === void 0 ? row.startedAt : out.startedAt;
		const changed = new Set("refuse" in out ? [] : out.players ?? []);
		if (!events.length && !changed.size && ("refuse" in out || out.startedAt === void 0)) return "refuse" in out ? out : {
			reply: out.reply,
			row,
			session: s
		};
		let seq = row.seq;
		const numbered = events.map((e) => ({
			...e,
			seq: ++seq
		}));
		const next = {
			...row,
			startedAt,
			seq,
			events: [...row.events, ...numbered].slice(-40),
			session: s
		};
		for (const e of events) if ("pupil" in e && typeof e.pupil === "string") changed.add(e.pupil);
		const players = [...changed].filter((id) => s.players[id]).map((id) => playerView(s, id));
		const saved = await sv.save(room, row.version, {
			session: s,
			view: roomView(s, startedAt),
			screen: screenView(next, s, startedAt),
			startedAt,
			players
		});
		if (saved === "busy") return { refuse: busy() };
		if (saved === "ok") return "refuse" in out ? out : {
			reply: out.reply,
			row: {
				...next,
				version: row.version + 1
			},
			session: s
		};
		await new Promise((done) => setTimeout(done, 5 + Math.floor(sv.random() * 25 * (tries + 1))));
	}
	return { refuse: busy() };
}
const readRoom = (v) => Number.isSafeInteger(v) && v > 0 ? v : null;
/** A new session from the teacher's choices, or a refusal. */
function newSession(body, seed, random) {
	const activity = ACTIVITIES.find((a) => a === body.activity) ?? "stars";
	const lengthMin = LENGTHS.includes(body.length) ? body.length : 0;
	let game;
	if (activity === "stars") {
		const own = anchorOf(Number(body.x), Number(body.y));
		const level = Object.keys(LEVELS).find((l) => l === body.level) ?? "middle";
		if ((body.x !== void 0 || body.y !== void 0) && !own) return "Pick two different numbers from 2 to 12.";
		game = newStars(own ?? pickAnchor(level, random), own ? "own" : level);
	} else return "Pick a game.";
	return {
		seed,
		activity,
		state: "lobby",
		lengthMin,
		players: {},
		order: [],
		game
	};
}
/** One request from a signed-in person (`who`). */
async function classLiveStep(sv, who, body) {
	const action = body.action;
	if (action === "open") {
		const classId = typeof body.classId === "string" && /^[0-9a-f-]{36}$/i.test(body.classId) ? body.classId : null;
		if (!classId) return no(400, "Pick a class first.");
		const teach = await sv.teacherClass(who, classId);
		if (teach === "busy") return busy();
		if (!teach) return no(403, "That isn't one of your classes.", "not-yours");
		if (!teach.enabled) return no(403, OFF, "off");
		const session = newSession(body, Math.floor(sv.random() * 2 ** 31), () => sv.random());
		if (typeof session === "string") return no(400, session);
		const row = {
			showNames: teach.showNames,
			seq: 0,
			events: []
		};
		const change = {
			session,
			view: roomView(session, null),
			screen: screenView(row, session, null),
			startedAt: null,
			players: []
		};
		const id = await sv.openRoom(classId, who, change);
		if (id === "busy") return busy();
		return ok({
			room: id,
			screen: change.screen,
			now: sv.now()
		});
	}
	if (action === "view" || action === "start" || action === "end" || action === "spotlight") {
		const room = readRoom(body.room);
		if (!room) return no(400, "That room couldn't be found.");
		const row = await sv.loadRoom(room);
		if (row === "busy") return busy();
		if (!row || row.teacher !== who) return no(403, "That isn't your room.", "not-yours");
		const teach = await sv.teacherClass(who, row.classId);
		if (teach === "busy") return busy();
		if (!teach) return no(403, "That isn't one of your classes.", "not-yours");
		if (!teach.enabled && action !== "view" && action !== "end") return no(403, OFF, "off");
		const done = await mutate(sv, room, (s, t) => {
			if (action === "view") return {
				reply: null,
				events: []
			};
			if (action === "start") {
				if (s.state !== "lobby") return { refuse: no(409, "It has already started.", "not-now") };
				s.state = "live";
				return {
					reply: null,
					events: [{
						type: "start",
						t: 0
					}],
					startedAt: sv.now()
				};
			}
			if (action === "spotlight") {
				const id = body.id === null ? null : Number.isInteger(body.id) ? body.id : void 0;
				if (id === void 0) return { refuse: no(400, "Pick a star.") };
				return {
					reply: null,
					events: spotlight(s.game, id, t)
				};
			}
			if (s.state === "over") return {
				reply: null,
				events: []
			};
			s.state = "over";
			return {
				reply: null,
				events: [{
					type: "over",
					t,
					why: "teacher"
				}]
			};
		});
		if ("refuse" in done) return done.refuse;
		return ok({
			room,
			screen: screenView(done.row, done.session, done.row.startedAt),
			now: sv.now()
		});
	}
	if (action === "join" || action === "play") {
		const me = await sv.pupil(who);
		if (me === "busy") return busy();
		if (!me) return no(403, "Class Live is for pupils in a class.", "no-class");
		if (!me.enabled) return no(403, OFF, "off");
		let room;
		if (action === "join") {
			const open = await sv.classRoom(me.classId);
			if (open === "busy") return busy();
			if (!open || open.session.state === "over") return no(404, "There is nothing on in your class right now.", "none");
			room = open.id;
		} else room = readRoom(body.room);
		if (!room) return no(400, "That room couldn't be found.");
		const cur = await sv.loadRoom(room);
		if (cur === "busy") return busy();
		if (!cur || cur.classId !== me.classId) return no(403, "That room isn't in your class.", "not-yours");
		if (action === "join") {
			const done = await mutate(sv, room, (s, t) => {
				if (s.state === "over") return { refuse: no(409, "This one has finished.", "over") };
				if (s.players[who]) return {
					reply: null,
					events: [],
					players: [who]
				};
				if (s.order.length >= 40) return { refuse: no(409, "This room is full.", "full") };
				s.players[who] = {
					id: who,
					name: me.name,
					joinedAt: t,
					colour: s.order.length % 12
				};
				s.order.push(who);
				return {
					reply: null,
					events: [{
						type: "join",
						t,
						pupil: who
					}]
				};
			});
			if ("refuse" in done) return done.refuse;
			return ok({
				room,
				view: roomView(done.session, done.row.startedAt),
				me: playerView(done.session, who),
				now: sv.now()
			});
		}
		if (!cur.session.players[who]) return no(409, "Join first.", "not-playing");
		const done = await mutate(sv, room, (s, t) => {
			if (s.state !== "live") return { refuse: no(409, s.state === "lobby" ? "Wait for the start!" : "This one has finished.", s.state) };
			const out = tryFact(s.game, who, body.fact, t);
			if (!out.ok) return { refuse: no(409, "One at a time!", out.reason) };
			return {
				reply: out.reply,
				events: out.events,
				players: [who]
			};
		});
		if ("refuse" in done) return done.refuse;
		return ok({
			room,
			reply: done.reply,
			view: roomView(done.session, done.row.startedAt),
			me: playerView(done.session, who),
			now: sv.now()
		});
	}
	return no(400, "That couldn't be read.");
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
	return async function handleClassLive(request) {
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
		const who = token ? await services.userIdFor(token) : null;
		if (!who) return reply(401, { error: "Please sign in again." });
		if (!limiter.allow(who, 60)) return reply(429, { error: "Slow down a little!" });
		const body = await readJsonBody(request);
		if (!body || typeof body !== "object") return reply(400, { error: "That couldn't be read." });
		try {
			const out = await classLiveStep(services, who, body);
			return reply(out.status, out.body);
		} catch {
			console.error(`classlive: ${String(body.action).slice(0, 20)} failed`);
			return reply(500, { error: "Something went wrong. Try again!" });
		}
	};
}
//#endregion
//#region supabase/functions/classlive/entry.ts
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
/** Calls a database function: its answer, or 'busy'. Logs say which one and the error code, never who. */
async function call(name, args) {
	const { data, error } = await admin.rpc(name, args);
	if (!error) return data;
	console.error(`classlive: ${name} failed (${error.code ?? "unknown"})`);
	return "busy";
}
const rowOf = (raw) => raw && {
	id: Number(raw.id),
	classId: raw.class_id,
	teacher: raw.teacher,
	version: raw.version,
	startedAt: raw.started_ms === null ? null : Number(raw.started_ms),
	showNames: raw.show_names !== false,
	session: raw.session,
	seq: Number(raw.seq) || 0,
	events: Array.isArray(raw.events) ? raw.events : []
};
Deno.serve(makeHandler({
	now: () => Date.now(),
	random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
	userIdFor: userIdFromToken(admin.auth),
	async teacherClass(teacher, classId) {
		const row = await call("classlive_teacher_class", {
			teacher,
			target_class: classId
		});
		if (row === "busy") return "busy";
		return row && {
			enabled: row.enabled === true,
			showNames: row.show_names !== false
		};
	},
	async pupil(player) {
		const row = await call("classlive_pupil", { player });
		if (row === "busy") return "busy";
		return row && {
			classId: row.class_id,
			name: (row.name ?? "A player").slice(0, 40),
			enabled: row.enabled === true
		};
	},
	async openRoom(classId, teacher, c) {
		const id = await call("classlive_open", {
			target_class: classId,
			teacher,
			activity: c.session.activity,
			session: c.session,
			view: c.view,
			screen: c.screen
		});
		return id === "busy" ? "busy" : Number(id);
	},
	async loadRoom(room) {
		const raw = await call("classlive_load", { target: room });
		return raw === "busy" ? "busy" : rowOf(raw);
	},
	async classRoom(classId) {
		const raw = await call("classlive_class_room", { target_class: classId });
		return raw === "busy" ? "busy" : rowOf(raw);
	},
	async save(room, version, c) {
		const out = await call("classlive_save", {
			target: room,
			seen_version: version,
			session: c.session,
			view: c.view,
			screen: c.screen,
			started_ms: c.startedAt === null ? null : Math.round(c.startedAt),
			players: c.players
		});
		return out === "ok" || out === "stale" ? out : "busy";
	}
}));
//#endregion
