// GENERATED FILE: don't edit. Edit supabase/functions/starweb/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "starweb" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
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
//#endregion
//#region shared/kit/dayArc.ts
/** NZ calendar day ('2026-11-04') of a moment, by the server clock. The same as Lord's `nzDate`. */
const nzDate = (now) => new Intl.DateTimeFormat("en-CA", {
	timeZone: "Pacific/Auckland",
	year: "numeric",
	month: "2-digit",
	day: "2-digit"
}).format(now);
//#endregion
//#region shared/starweb/config.ts
/**
* Star Web solo's tuning numbers (docs/STARWEB-PLAN.md). The class game's rules (shared/classlive/stars.ts) are imported,
* never changed; these are the solo game's own.
*/
/** Counted stars for gold: the supernova. */
const GOLD = 30;
/** Hub points for a finished sky by its medal (bronze 2, silver 3, gold 4), for the first skies of the NZ day. */
const POINTS = {
	1: 2,
	2: 3,
	3: 4
};
/** The Star Map's tables. */
const TABLES = [
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	11,
	12
];
/** The guided first sky's known fact (docs/STARWEB-PLAN.md design 7). */
const GUIDE_ANCHOR = {
	x: 3,
	y: 4,
	p: 12
};
//#endregion
//#region shared/starweb/map.ts
/**
* Star Web solo's Star Map (docs/STARWEB-PLAN.md design 1): one star per times table 2 to 12, each at the best medal of a
* sky that used it, and which known fact the next sky starts from. Pure, so the browser, the preview and the server agree.
*/
const emptyProgress = () => ({
	tables: {},
	lit: 0,
	gold: 0,
	stars: 0,
	nohint: 0,
	recent: [],
	guideSeen: false
});
const tableMedal = (p, t) => p.tables[String(t)] ?? 0;
const freeOpen = (p) => p.lit >= 5;
const anchorId = (a) => `${Math.min(a.x, a.y)}x${Math.max(a.x, a.y)}`;
/** The progress after a finished sky. A free sky changes nothing on the map (it's practice). */
function progressAfter(p, done) {
	if (done.mode === "free" || done.medal === 0) return {
		...p,
		guideSeen: true
	};
	const tables = { ...p.tables };
	for (const t of new Set([done.anchor.x, done.anchor.y])) if (TABLES.includes(t) && done.medal > tableMedal(p, t)) tables[String(t)] = done.medal;
	return {
		...p,
		tables,
		lit: p.lit + 1,
		gold: p.gold + (done.medal === 3 ? 1 : 0),
		stars: p.stars + done.counted,
		nohint: p.nohint + (done.hints === 0 ? 1 : 0),
		guideSeen: true
	};
}
/** Remembers a sky's known fact so the next few don't repeat it. */
const withRecent = (p, a) => ({
	...p,
	recent: [anchorId(a), ...p.recent.filter((r) => r !== anchorId(a))].slice(0, 5)
});
const factOf = (key) => {
	const m = /^mul:(\d+)x(\d+)$/.exec(key);
	return m ? [Number(m[1]), Number(m[2])] : null;
};
/**
* The known fact for a new Star Map sky (James, 25 Nov 2026: from the times tables each pupil knows). From the pupil's
* records: × facts from 2 × 3 to 12 × 12 (no squares), in the top two mastery boxes, with a table the class has on, not one
* of the last few skies. Facts whose tables aren't gold yet come first. Fewer than 3 such facts: the class game's easy list.
* Reads the records only; it never works out a pupil's level (docs/game-guide/4-maths.md rule 1).
*/
function pickAnchor(p, facts, enabledTables, random) {
	if (!p.guideSeen && p.lit === 0) return { ...GUIDE_ANCHOR };
	const on = enabledTables && enabledTables.length ? new Set(enabledTables) : null;
	const known = facts.flatMap((f) => {
		const xy = f.box >= 3 ? factOf(f.key) : null;
		if (!xy) return [];
		const [a, b] = xy;
		if (!anchorOf(a, b) || on && !on.has(a) && !on.has(b)) return [];
		return [[a, b]];
	});
	const pickFrom = (list) => {
		const fresh = list.filter(([a, b]) => !p.recent.includes(anchorId({
			x: a,
			y: b
		})));
		const pool = fresh.length ? fresh : list;
		const notGold = pool.filter(([a, b]) => tableMedal(p, a) < 3 || tableMedal(p, b) < 3);
		const from = notGold.length ? notGold : pool;
		const [a, b] = from[Math.floor(random() * from.length) % from.length];
		return random() < .5 ? {
			x: a,
			y: b,
			p: a * b
		} : {
			x: b,
			y: a,
			p: a * b
		};
	};
	return pickFrom(known.length >= 3 ? known : LEVELS.small);
}
//#endregion
//#region shared/starweb/sky.ts
/**
* One Star Web solo sky (docs/STARWEB-PLAN.md "Changes from the class rules"): the class game's fact reader, checker and
* link finder (shared/classlive/stars.ts), with the solo caps on top. The browser runs this for instant feedback and the
* server runs it again on every save, so both agree on every star.
*/
/** A pupil's try at a fact: what it is and, if it's a new linked fact, the star (not added: see `addTry`). */
function judge(sky, text) {
	const fact = readFact(text);
	if (!fact) return { result: "unreadable" };
	const t = factText(fact);
	if (!isTrue(fact)) return {
		result: "wrong",
		text: t,
		fact
	};
	const link = linkOf(fact, sky.anchor);
	if (link === "same") return {
		result: "same",
		text: t,
		fact
	};
	if (!link) return {
		result: "unlinked",
		text: t,
		fact
	};
	const k = factKey(fact);
	const found = sky.stars.find((s) => s.k === k);
	if (found) return {
		result: "again",
		star: found
	};
	if (sky.stars.length >= 120) return { result: "full" };
	return {
		result: "new",
		star: {
			k,
			t,
			a: link.arm,
			h: link.how
		}
	};
}
/** The sky after a try (a new star added), and the reply. */
function addTry(sky, text) {
	const reply = judge(sky, text);
	return {
		sky: reply.result === "new" ? {
			...sky,
			stars: [...sky.stars, reply.star]
		} : sky,
		reply
	};
}
const armLit = (stars, arm) => stars.filter((s) => s.a === arm).length >= ARM_GOAL[arm];
const allLit = (stars) => ARMS.every((a) => armLit(stars, a));
/** Stars that count for silver and gold: every star but Wild links past WILD_CAP. */
function countedStars(stars) {
	let wild = 0;
	let n = 0;
	for (const s of stars) {
		if (s.a === "wild" && ++wild > 5) continue;
		n++;
	}
	return n;
}
/** Bronze when every arm is lit, silver at 25 counted stars, gold (supernova) at 30. */
function medalOf(stars) {
	if (!allLit(stars)) return 0;
	const n = countedStars(stars);
	return n >= GOLD ? 3 : n >= 25 ? 2 : 1;
}
//#endregion
//#region shared/starweb/server.ts
/**
* What the `starweb` server function does with a request from a signed-in pupil (docs/STARWEB-PLAN.md "Server, data and
* cost"). The function (supabase/functions/starweb/handler.ts) checks the sign-in and the rate first; the preview calls
* this with services kept in the browser (memoryServices.ts), so both run exactly the same rules.
*
*   load        { enabled, progress, open (the sky left part-way, if any), today, pointsLeft };
*   open        a sky: the open one again (Carry on), or a new one (`fresh`, or a different mode). A new Star Map sky's
*               known fact comes from the pupil's own times-table records (pickAnchor); a Free sky's is the pupil's pick.
*               An open sky with every arm lit is finished first, so its medal is never lost;
*   save        the tries typed since the last save: the server re-reads, re-checks and re-links each one with the same
*               rules (shared/starweb/sky.ts) and keeps only what holds, at most one new star a second (plus a burst);
*   finish      the last tries, then the medal (every arm lit needed), the Star Map, points for the first 5 skies of
*               the NZ day, achievements;
*   guide-seen  remembers the guided first sky was shown.
*
* Nothing that counts comes from the browser: every star, the medal, the map and the points are the server's.
*/
const unplayed = () => ({
	progress: emptyProgress(),
	version: 0
});
const publicSky = ({ seed, mode, anchor, stars, hints }) => ({
	seed,
	mode,
	anchor,
	stars,
	hints
});
const busy = () => ({
	status: 503,
	body: {
		error: "The server is busy. Try again in a moment.",
		code: "busy"
	}
});
const bad = (why = "That couldn’t be read.") => ({
	status: 400,
	body: {
		error: why,
		code: "bad"
	}
});
const ok = (body) => ({
	status: 200,
	body
});
const isSeed = (v) => typeof v === "string" && /^[0-9a-f]{16,32}$/.test(v);
const newSeed = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
/**
* The sky's stars after the sent tries, re-checked with the shared rules. At most one new star a second since the last
* save (plus STAR_BURST): extra ones are dropped, and the browser takes the server's stars.
*/
function replayTries(kept, tries, now) {
	if (tries === void 0) return kept.stars;
	if (!Array.isArray(tries) || tries.length > 40 || tries.some((t) => typeof t !== "string" || t.length > 40)) return null;
	const allowed = 3 + Math.max(0, Math.floor((now - kept.savedAt) / 1e3));
	let sky = {
		anchor: kept.anchor,
		stars: kept.stars
	};
	let added = 0;
	for (const t of tries) {
		if (added >= allowed) break;
		const next = addTry(sky, t);
		if (next.reply.result === "new") added++;
		sky = next.sky;
	}
	return sky.stars;
}
const hintsOf = (kept, v) => Math.max(kept.hints, typeof v === "number" && Number.isInteger(v) ? Math.min(99, Math.max(0, v)) : 0);
async function finishSky(services, player, kept, stars, hints, saved) {
	const medal = medalOf(stars);
	if (medal === 0) return {
		status: 409,
		body: {
			error: "Light every arm first.",
			code: "not-lit"
		}
	};
	const day = nzDate(new Date(services.now()));
	let points = 0;
	if (kept.mode === "map") {
		const today = await services.pointSkiesToday(player, day);
		if (today === "busy") return busy();
		if (today < 5) points = POINTS[medal];
	}
	const progress = withRecent(progressAfter(saved.progress, {
		anchor: kept.anchor,
		medal,
		counted: countedStars(stars),
		hints,
		mode: kept.mode
	}), kept.anchor);
	const done = await services.finish(player, kept.seed, kept.version, stars, hints, medal, points, saved.version, progress);
	if (done === "busy") return busy();
	if (!done) return {
		status: 409,
		body: {
			error: "Try that again.",
			code: "moved"
		}
	};
	if (points) await services.awardPoints(player, points, `starweb:${kept.seed}`);
	await services.progressChanged(player);
	return ok({
		medal,
		points,
		progress,
		stars
	});
}
async function handleStarWeb(services, player, body) {
	const type = body.type;
	const today = nzDate(new Date(services.now()));
	if (type === "load") {
		const [settings, saved, open, scored] = await Promise.all([
			services.settings(player),
			services.load(player),
			services.openSky(player),
			services.pointSkiesToday(player, today)
		]);
		if (!settings || saved === "busy" || open === "busy") return busy();
		return ok({
			enabled: settings.enabled,
			progress: saved.progress,
			open: open ? publicSky(open) : null,
			today,
			pointsLeft: Math.max(0, 5 - (scored === "busy" ? 0 : scored))
		});
	}
	const settings = await services.settings(player);
	if (!settings) return busy();
	if (!settings.enabled) return {
		status: 403,
		body: {
			error: "Star Web isn’t switched on for your class yet.",
			code: "off"
		}
	};
	if (type === "guide-seen") {
		const saved = await services.load(player);
		if (saved === "busy") return busy();
		if (saved.progress.guideSeen) return ok({ progress: saved.progress });
		const progress = {
			...saved.progress,
			guideSeen: true
		};
		const done = await services.saveProgress(player, saved.version, progress);
		if (done === "busy") return busy();
		if (!done) return {
			status: 409,
			body: {
				error: "Try that again.",
				code: "moved"
			}
		};
		return ok({ progress });
	}
	if (type === "open") {
		const mode = body.mode;
		if (mode !== "map" && mode !== "free") return bad();
		let [saved, open] = await Promise.all([services.load(player), services.openSky(player)]);
		if (saved === "busy" || open === "busy") return busy();
		if (open && open.mode === mode && body.fresh !== true) return ok({ sky: publicSky(open) });
		if (open && medalOf(open.stars) > 0) {
			const r = await finishSky(services, player, open, open.stars, open.hints, saved);
			if (r.status !== 200) return r;
			saved = {
				progress: r.body.progress,
				version: saved.version + 1
			};
		}
		let anchor;
		if (mode === "free") {
			if (!freeOpen(saved.progress)) return {
				status: 403,
				body: {
					error: "Free sky opens after 5 lit skies.",
					code: "locked"
				}
			};
			anchor = anchorOf(Number(body.x), Number(body.y));
			if (!anchor) return bad("Pick two different numbers from 2 to 12.");
		} else {
			const maths = await services.maths(player);
			if (maths === "busy") return busy();
			anchor = pickAnchor(saved.progress, maths.facts, maths.enabledTables, () => services.random());
		}
		const seed = newSeed();
		const kept = await services.start(player, seed, mode, anchor);
		if (kept === "busy" || !kept) return busy();
		return ok({
			sky: {
				seed,
				mode,
				anchor,
				stars: [],
				hints: 0
			},
			progress: saved.progress
		});
	}
	if (type === "save" || type === "finish") {
		const { seed } = body;
		if (!isSeed(seed)) return bad();
		const [kept, saved] = await Promise.all([services.sky(player, seed), services.load(player)]);
		if (kept === "busy" || saved === "busy") return busy();
		if (!kept) return {
			status: 404,
			body: {
				error: "That sky isn’t yours.",
				code: "not-yours"
			}
		};
		if (!kept.open) return ok({
			already: true,
			stars: kept.stars
		});
		const stars = replayTries(kept, body.tries, services.now());
		if (!stars) return bad();
		const hints = hintsOf(kept, body.hints);
		if (type === "finish") return finishSky(services, player, kept, stars, hints, saved);
		if (stars.length !== kept.stars.length || hints !== kept.hints) {
			const done = await services.save(player, seed, kept.version, stars, hints);
			if (done === "busy") return busy();
			if (!done) return {
				status: 409,
				body: {
					error: "Try that again.",
					code: "moved"
				}
			};
		}
		return ok({
			stars,
			medal: medalOf(stars)
		});
	}
	return bad();
}
//#endregion
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
	return async function handleStarWebRequest(request) {
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
		if (!limiter.allow(player, 40)) return reply(429, { error: "Slow down a little!" });
		const raw = await readJsonBody(request);
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) return reply(400, { error: "That couldn’t be read." });
		const r = await handleStarWeb(services, player, raw);
		return reply(r.status, r.body);
	};
}
//#endregion
//#region supabase/functions/starweb/entry.ts
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
	console.error(`starweb: ${name} failed (${error.code ?? "unknown"})`);
	return "busy";
}
Deno.serve(makeHandler({
	now: () => Date.now(),
	random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
	userIdFor: userIdFromToken(admin.auth),
	async settings(player) {
		const { data, error } = await admin.rpc("settings_of", { player }).maybeSingle();
		if (error || !data) {
			console.error(`starweb: settings failed (${error?.code ?? "none"})`);
			return null;
		}
		return { enabled: data.starweb_enabled === true };
	},
	async load(player) {
		const saved = await call("starweb_load", { player });
		return saved === "busy" ? "busy" : saved ?? unplayed();
	},
	openSky: (player) => call("starweb_open_sky", { player }),
	sky: (player, seed) => call("starweb_sky", {
		player,
		seed
	}),
	async maths(player) {
		const context = await call("space_maths_context", { player });
		if (context === "busy" || !context) return "busy";
		return {
			facts: context.facts ?? [],
			enabledTables: context.settings?.enabledTables
		};
	},
	start: (player, seed, mode, anchor) => call("starweb_start", {
		player,
		seed,
		mode,
		x: anchor.x,
		y: anchor.y
	}),
	save: (player, seed, version, stars, hints) => call("starweb_save", {
		player,
		seed,
		sky_version: version,
		stars,
		hints
	}),
	finish: (player, seed, skyVersion, stars, hints, medal, points, version, progress) => call("starweb_finish", {
		player,
		seed,
		sky_version: skyVersion,
		stars,
		hints,
		medal,
		points,
		version,
		progress
	}),
	pointSkiesToday: (player, day) => call("starweb_point_skies", {
		player,
		day
	}),
	saveProgress: (player, version, progress) => call("starweb_save_progress", {
		player,
		version,
		progress
	}),
	async awardPoints(player, points, once) {
		const { error } = await admin.rpc("add_game_points", {
			player,
			game: "starweb",
			points,
			once
		});
		if (error) console.error(`starweb: points failed (${error.code ?? "unknown"})`);
	},
	async progressChanged(player) {
		const { error } = await admin.rpc("game_progress_changed", {
			player,
			game: "starweb"
		});
		if (error) console.error(`starweb: achievements failed (${error.code ?? "unknown"})`);
	}
}));
//#endregion
