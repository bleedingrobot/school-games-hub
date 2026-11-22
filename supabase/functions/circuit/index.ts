// GENERATED FILE: don't edit. Edit supabase/functions/circuit/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "circuit" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
//#region shared/unlimited.ts
/** Today's date in New Zealand, 'YYYY-MM-DD'. */
const nzToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", {
	timeZone: "Pacific/Auckland",
	year: "numeric",
	month: "2-digit",
	day: "2-digit"
}).format(now);
/**
* Is this game's switch on today? `days` is the settings row's `unlimited_days` ({ game id: NZ date }). Anything that
* isn't today's date (missing, an old day, junk) is off.
*/
function isUnlimitedFor(days, game, now = new Date()) {
	if (!days || typeof days !== "object") return false;
	return days[game] === nzToday(now);
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
//#region supabase/functions/_shared/stamp.ts
/**
* Stamps (signatures) only the server can make: an HMAC-SHA256 of some text, as URL-safe
* base64. The key is made from the server's own secret key and a purpose, so there's nothing
* new to set up, and a stamp made for one purpose is no use for another.
*/
const encoder = new TextEncoder();
async function hmac(key, text) {
	const raw = typeof key === "string" ? encoder.encode(key) : key;
	const imported = await crypto.subtle.importKey("raw", raw, {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(text)));
}
function base64Url(bytes) {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** Returns a function that stamps text for one purpose. Null stamps if there's no secret. */
function stamper(secret, purpose) {
	let key = null;
	return async (text) => {
		if (!secret) return null;
		key ??= hmac(secret, `school-games-hub:${purpose}`);
		return base64Url(await hmac(await key, text));
	};
}
const DT = 1 / 30;
const START_X = 3.5;
const START_Z = .5;
/** How tall the blocks are: `1`, `2` and `3` in a road. */
const BLOCK_HEIGHTS = {
	"1": .5,
	"2": .75,
	"3": 1
};
/** A tunnel (data cable) has a roof this high, this thick: jump inside and you bump your head. */
const TUNNEL_ROOF = 1.2;
const LOW_BRAKE_SHARE = .4;
/**
* Steering, lanes a second at top speed (OpenRoads' grip plus 20% for kids). Sideways speed grows with forward
* speed, from TURN_AT_REST of it when stopped, so a stopped racer can still edge sideways.
*/
const TURN_RATE = 3.6;
const TURN_AT_REST = .4;
/** Gravity per world, units a second each second (world 1 a little lighter for longer hang time). */
const GRAVITY = {
	motherboard: 16,
	graphics: 18,
	memory: 26,
	cloud: 11,
	quantum: 9
};
/** Clip a block's corner and you are pushed sideways this far instead of stopping. */
const WALL_NUDGE = .25;
/** Steering into a block's side costs this much speed each step you scrape it. */
const SCRAPE_SLOW = .4;
/** Half the racer's width: it checks for floor this far either side, for the ledge slip. */
const HALF_WIDTH = .3;
const BOUNCE = .5;
/**
* Battery drain by speed. A road's `battery` is how many seconds it lasts at top speed; slower driving drains it
* by this mix of the speed share and its square, so a careful racer goes further on one charge.
*/
const BATTERY_LINEAR = .25;
const BATTERY_SQUARED = .75;
/** A road's `signal` is how many seconds it lasts; it drains with time whatever you do. */
/** Auto-Pilot: when a jump would miss, it tries changing steering, then speed, by these shares until it would land. */
const AUTO_PILOT_TRIES = [
	.1,
	.2,
	.3,
	.4,
	.5,
	.6
];
function inputCode(i) {
	return i.turn + 1 + 3 * (i.accel + 1) + (i.jump ? 9 : 0);
}
function decodeInput(code) {
	return {
		turn: code % 3 - 1,
		accel: Math.floor(code / 3) % 3 - 1,
		jump: code >= 9
	};
}
/** Nothing pressed: every run starts with this. */
const NEUTRAL = inputCode({
	turn: 0,
	accel: 0,
	jump: false
});
/** Plays a log back: give it the state before each step, it gives that step's input code. */
function inputPlayer(log) {
	let i = 0;
	let current = NEUTRAL;
	return (s) => {
		while (i < log.length && (log[i][0] < s.slot || log[i][0] === s.slot && log[i][1] <= s.slotSteps)) current = log[i++][2];
		return current;
	};
}
const CHANGE = /^(\d{1,6})\.(\d{1,5})\.(\d{1,2})$/;
/** Null if the text isn't a well-made log (in order, codes in range, not too long). */
function decodeLog(text) {
	if (text === "") return [];
	const parts = text.split(",");
	if (parts.length > 6e3) return null;
	const log = [];
	for (const part of parts) {
		const m = CHANGE.exec(part);
		if (!m) return null;
		const change = [
			Number(m[1]),
			Number(m[2]),
			Number(m[3])
		];
		const last = log[log.length - 1];
		if (change[2] > 17) return null;
		if (last && (change[0] < last[0] || change[0] === last[0] && change[1] <= last[1])) return null;
		log.push(change);
	}
	return log;
}
//#endregion
//#region shared/circuit/road.ts
/**
* Circuit Racer's road format (docs/CIRCUIT-PLAN.md, section 3): our own text grid.
*
* A road is a list of rows, the start first. Each row is 7 letters, one per lane, left to right:
*
*   .  gap (nothing)          g  cooling gel (slippery: no steering)
*   -  plain trace            +  recharge port (full battery and signal)
*   >  overclock (speed up)   1 2 3  blocks, 0.5 / 0.75 / 1.0 high
*   r  resistor (slow down)   t  tunnel (a data cable: floor with a roof)
*   x  short circuit (boom)   ?  data gate (from world 2; plain trace until Stage 3)
*
* A row may end with ` xN` to repeat it N times (`"--...-- x6"`), so long straight bits stay short in a PR.
* Each road also sets its own gravity, battery (seconds at top speed) and signal (seconds).
*/
const CELLS = ".->rxg+123t?";
const ROW = /^([.\->rxg+123t?]{7})(?: x([1-9]\d{0,3}))?$/;
/** Reads a road, or throws with the row that is wrong. */
function parseRoad(def) {
	let cells = "";
	def.rows.forEach((text, i) => {
		const m = ROW.exec(text);
		if (!m) throw new Error(`${def.id}: row ${i + 1} "${text}" is not 7 road letters (${CELLS}), with an optional " xN"`);
		cells += m[1].repeat(m[2] ? Number(m[2]) : 1);
	});
	if (cells.length === 0) throw new Error(`${def.id}: no rows`);
	return {
		def,
		length: cells.length / 7,
		cells
	};
}
/** The cell in a lane and row. Outside the road (either side, before the start, after the end) is a gap. */
function cellAt(road, lane, row) {
	if (lane < 0 || lane >= 7 || row < 0 || row >= road.length) return ".";
	return road.cells[row * 7 + lane];
}
/** The height of a block cell's top, or 0 for a floor tile, or null for a gap. */
function topOf(cell) {
	if (cell === ".") return null;
	if (cell === "1" || cell === "2" || cell === "3") return BLOCK_HEIGHTS[cell];
	return 0;
}
//#endregion
//#region shared/circuit/physics.ts
/**
* Circuit Racer's physics as one pure function (docs/CIRCUIT-PLAN.md, section 2).
*
* `newRace` makes the starting state and `step(state, input, road)` gives the next state 1/30 s later, plus what
* happened (events for sounds and sparks). Nothing else changes: the same inputs give exactly the same run on
* every device and on the server, which replays a run's inputs (`replay`) to check its finish and time.
*
* The ideas follow OpenRoads (github.com/praveenscience/OpenRoads-SkyRoads-Clone, MIT licence,
* copyright (c) 2014 anprogrammer), which copies how the 1993 game SkyRoads moves its ship: fixed steps, move in
* small tries and stop flush against anything solid, a sideways nudge off clipped corners, crash or bonk by speed,
* half-speed bounces, sliding off half-landed ledges, a jump helper that tries ±10% to ±60%, fuel by speed and air
* by time, and inputs recorded by distance. The code and units here are our own, tuned for 8 to 11 year olds.
*
* Space: x across the road (lane i is x from i to i+1), y up (floor tops at 0), z along the road (row r is z from r
* to r+1). The racer is a point for hitting things, HALF_WIDTH wide for the ledge slip.
*/
const EPS = 1e-6;
function newRace(_road, opts = {}) {
	return {
		x: START_X,
		y: 0,
		z: START_Z,
		vy: 0,
		vz: 0,
		steer: 0,
		steerScale: 1,
		slide: 0,
		grounded: true,
		jumping: false,
		airSteps: 0,
		autoPilot: opts.autoPilot ?? true,
		autoPilotChecked: false,
		autoPilotOn: false,
		autoPilotGiveBack: 0,
		battery: 100,
		signal: 100,
		outcome: "racing",
		steps: 0,
		deadSteps: 0,
		slot: Math.floor(START_Z * 8),
		slotSteps: 0,
		lastPortRow: -2,
		ports: 0
	};
}
/** True if the point is inside something solid. */
function solid(road, x, y, z) {
	const c = cellAt(road, Math.floor(x), Math.floor(z));
	if (c === "." || y <= -.25) return false;
	if (c === "t") return y < 0 || y > 1.2 && y < 1.4;
	return y < (topOf(c) ?? 0);
}
/** The top and bottom of the solid piece at a point (the point must be inside it). */
function pieceAt(road, x, y, z) {
	const c = cellAt(road, Math.floor(x), Math.floor(z));
	if (c === "t") return y < 0 ? {
		top: 0,
		bottom: -.25
	} : {
		top: 1.4,
		bottom: TUNNEL_ROOF
	};
	return {
		top: topOf(c) ?? 0,
		bottom: -.25
	};
}
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
/** One step of the race. Pure: `prev` is not changed. */
function step(prev, input, road) {
	const s = { ...prev };
	const events = [];
	if (s.outcome !== "racing") {
		if (s.outcome !== "finished") s.deadSteps++;
		return {
			state: s,
			events
		};
	}
	const g = road.def.gravity;
	if (s.autoPilot && s.jumping && !s.autoPilotChecked && s.vy <= 6 * .4) {
		s.autoPilotChecked = true;
		if (runAutoPilot(s, input, road)) events.push("autopilot");
	}
	const row = Math.floor(s.z);
	const under = s.grounded && s.y < EPS * 10 && s.y > -1e-6 * 10 ? cellAt(road, Math.floor(s.x), row) : ".";
	if (under === ">") s.vz += 16 * DT;
	else if (under === "r") s.vz -= 16 * DT;
	else if (under === "x") return end(s, events, "crashed", "crash");
	else if (under === "+") {
		s.battery = 100;
		s.signal = 100;
		if (row > s.lastPortRow + 1) {
			s.ports++;
			events.push("recharge");
		}
		s.lastPortRow = row;
	}
	if (input.accel > 0) s.vz += 7 * DT;
	else if (input.accel < 0) s.vz -= (s.vz < 2.5 ? 10 * LOW_BRAKE_SHARE : 10) * DT;
	s.vz = clamp(s.vz, 0, 12);
	if (under !== "g" && (s.grounded || s.jumping && s.airSteps < 4)) {
		if (s.steer !== input.turn) s.steerScale = 1;
		s.steer = input.turn;
	}
	if (input.jump && s.grounded && g < 40) {
		s.vy = 6;
		s.grounded = false;
		s.jumping = true;
		s.airSteps = 0;
		s.autoPilotChecked = false;
		events.push("jump");
	}
	s.vy = Math.max(s.vy - g * DT, -14);
	if (!s.grounded) s.airSteps++;
	const wasGrounded = s.grounded;
	const hit = move(s, road, events);
	if (hit === "crash") return end(s, events, "crashed", "crash");
	if (hit === "scrape") {
		s.vz = Math.max(0, s.vz - SCRAPE_SLOW);
		s.slide = 0;
		events.push("scrape");
	}
	if (hit === "land") {
		if (s.y === 0 && cellAt(road, Math.floor(s.x), Math.floor(s.z)) === "x") return end(s, events, "crashed", "crash");
		const fall = -s.vy;
		if (fall > 4.5) {
			s.vy = fall * BOUNCE;
			s.grounded = false;
			events.push("bounce");
		} else {
			s.vy = 0;
			s.grounded = true;
			if (!wasGrounded) events.push("land");
		}
		if (s.jumping) {
			s.jumping = false;
			s.vz = clamp(s.vz + s.autoPilotGiveBack, 0, 12);
			s.autoPilotGiveBack = 0;
			s.autoPilotOn = false;
			s.steerScale = 1;
		}
	} else s.grounded = false;
	if (s.grounded) {
		const left = solid(road, s.x - HALF_WIDTH, s.y - .01, s.z);
		const right = solid(road, s.x + HALF_WIDTH, s.y - .01, s.z);
		if (left && right) s.slide = 0;
		else if (!left && right) s.slide -= 6 * DT;
		else if (left && !right) s.slide += 6 * DT;
	}
	s.steps++;
	const slot = Math.floor(s.z * 8);
	if (slot !== s.slot) {
		s.slot = slot;
		s.slotSteps = 0;
	} else s.slotSteps++;
	if (s.y < -2) return end(s, events, "fell", "fall");
	if (s.z >= road.length && s.y > -.5) return end(s, events, "finished", "finish");
	const share = s.vz / 12;
	s.battery -= 100 / road.def.battery * (BATTERY_LINEAR * share + BATTERY_SQUARED * share * share) * DT;
	s.signal -= 100 / road.def.signal * DT;
	if (s.battery <= EPS) {
		s.battery = 0;
		return end(s, events, "outOfBattery", "outOfBattery");
	}
	if (s.signal <= EPS) {
		s.signal = 0;
		return end(s, events, "outOfSignal", "outOfSignal");
	}
	return {
		state: s,
		events
	};
}
function end(s, events, outcome, event) {
	s.outcome = outcome;
	events.push(event);
	return {
		state: s,
		events
	};
}
/**
* Moves the racer for one step in SUBSTEPS small pieces: forward, then sideways, then up or down, each stopping flush
* against anything solid. Returns what it hit (a crash ends the move at once).
*/
function move(s, road, events) {
	let dz = s.vz * DT / 4;
	let dx = (s.steer * s.steerScale * TURN_RATE * (TURN_AT_REST + .6 * (s.vz / 12)) + s.slide) * DT / 4;
	let dy = s.vy * DT / 4;
	let result = null;
	for (let k = 0; k < 4; k++) {
		if (dz > 0) {
			const nz = s.z + dz;
			if (!solid(road, s.x, s.y, nz)) s.z = nz;
			else {
				const first = s.x - Math.floor(s.x) < .5 ? -1 : 1;
				let nudged = false;
				for (const d of [first, -first]) {
					const nx = s.x + d * WALL_NUDGE;
					if (!solid(road, nx, s.y, s.z) && !solid(road, nx, s.y, nz)) {
						s.x = nx;
						s.z = nz;
						nudged = true;
						events.push("nudge");
						break;
					}
				}
				if (!nudged) {
					s.z = Math.floor(nz) - EPS;
					if (s.vz > 6) return "crash";
					s.vz = 0;
					dz = 0;
					events.push("bonk");
				}
			}
		}
		if (dx !== 0) {
			const nx = s.x + dx;
			if (!solid(road, nx, s.y, s.z)) s.x = nx;
			else {
				s.x = dx > 0 ? Math.floor(nx) - EPS : Math.floor(nx) + 1 + EPS;
				dx = 0;
				if (result === null) result = "scrape";
			}
		}
		if (dy !== 0) {
			const ny = s.y + dy;
			if (!solid(road, s.x, ny, s.z)) s.y = ny;
			else {
				const piece = pieceAt(road, s.x, ny, s.z);
				if (dy < 0) {
					s.y = piece.top;
					result = "land";
				} else {
					s.y = piece.bottom - EPS;
					s.vy = 0;
				}
				dy = 0;
			}
		}
	}
	return result;
}
/** True if the jump, played forward with this input held and no Auto-Pilot, comes down safely. */
function willLand(start, input, road) {
	let t = {
		...start,
		autoPilot: false
	};
	const held = {
		turn: input.turn,
		accel: input.accel,
		jump: false
	};
	for (let i = 0; i < 90; i++) {
		const r = step(t, held, road);
		t = r.state;
		if (t.outcome !== "racing") return t.outcome === "finished";
		if (r.events.includes("land") || r.events.includes("bounce")) return cellAt(road, Math.floor(t.x), Math.floor(t.z)) !== "x";
	}
	return false;
}
/** Tries steering, then speed, ±10% … ±60% until the jump would land. Changes `s` and returns true if it saved it. */
function runAutoPilot(s, input, road) {
	if (willLand(s, input, road)) return false;
	const vz = s.vz;
	const scale = s.steerScale;
	for (const share of AUTO_PILOT_TRIES) {
		if (s.steer !== 0) {
			for (const tryScale of [scale * (1 + share), scale * (1 - share)]) if (willLand({
				...s,
				steerScale: tryScale
			}, input, road)) {
				s.steerScale = tryScale;
				s.autoPilotOn = true;
				return true;
			}
		}
		for (const tryVz of [vz * (1 + share), vz * (1 - share)]) {
			if (tryVz > 12 || tryVz === vz) continue;
			if (willLand({
				...s,
				vz: tryVz
			}, input, road)) {
				s.autoPilotGiveBack = vz - tryVz;
				s.vz = tryVz;
				s.autoPilotOn = true;
				return true;
			}
		}
	}
	return false;
}
/** Plays a recorded run from the start. The server uses this to find the real finish and time. */
function replay(road, log, opts = {}) {
	const play = inputPlayer(log);
	let s = newRace(road, opts);
	while (s.outcome === "racing" && s.steps < 18e3) s = step(s, decodeInput(play(s)), road).state;
	return s;
}
//#endregion
//#region shared/circuit/roads/motherboard.ts
/**
* World 1, the Motherboard: six gentle, wide roads that teach driving (docs/CIRCUIT-PLAN.md, section 3).
* No data gates in this world; recharge ports from road 3. Each row is the road from left lane to right lane,
* start first (letters in road.ts).
*/
const world = "motherboard";
const gravity = GRAVITY.motherboard;
/** Every road pupils can play, in the order they open (world 1 only until Stage 4). */
const ROADS = [
	{
		id: "power-on",
		name: "Power On",
		world,
		gravity,
		battery: 60,
		signal: 65,
		rows: [
			"------- x30",
			"--111-- x2",
			"------- x16",
			"1-----1 x20",
			"------- x10",
			"111---- x2",
			"------- x14",
			"----111 x2",
			"------- x16",
			"-11-11- x2",
			"------- x20",
			"....... x2",
			"------- x20",
			"....... x2",
			"------- x24"
		]
	},
	{
		id: "clock-speed",
		name: "Clock Speed",
		world,
		gravity,
		battery: 60,
		signal: 72,
		rows: [
			"------- x20",
			"-->>>-- x6",
			"------- x12",
			"xx---xx x4",
			"------- x12",
			"rrrrrrr x3",
			"------- x12",
			"....... x2",
			"------- x14",
			"-->>>-- x6",
			"------- x10",
			"....... x3",
			"------- x12",
			"x--x--x x2",
			"------- x14",
			".-----. x24",
			"..---.. x20",
			"....... x3",
			"..---.. x10",
			"------- x24"
		]
	},
	{
		id: "first-charge",
		name: "First Charge",
		world,
		gravity,
		battery: 18,
		signal: 42,
		rows: [
			"------- x24",
			"-->>>-- x8",
			"------- x12",
			".11111. x8",
			"------- x10",
			"....... x3",
			"------- x16",
			"-->>>-- x8",
			"------- x14",
			"..111.. x10",
			"..---.. x8",
			"....... x3",
			"------- x12",
			"-+++++- x3",
			"------- x16",
			"x--1--x x6",
			"------- x12",
			"....... x4",
			"------- x14",
			".11111. x6",
			"------- x8",
			"....... x3",
			"------- x24"
		]
	},
	{
		id: "data-bus",
		name: "Data Bus",
		world,
		gravity,
		battery: 20,
		signal: 50,
		rows: [
			"------- x20",
			".-----. x10",
			"..---.. x14",
			"..ggg.. x8",
			"..---.. x10",
			"------- x8",
			"-+++++- x3",
			"------- x10",
			"..ttt.. x20",
			"------- x10",
			"....... x3",
			"---.--- x12",
			"--...-- x12",
			"-.....- x10",
			"------- x8",
			"ggggggg x6",
			"------- x10",
			".--.--. x14",
			"....... x3",
			"..---.. x16",
			"..ttt.. x16",
			"------- x8",
			"-+++++- x3",
			"------- x10",
			"x-----x x16",
			"....... x4",
			"------- x10",
			"..ggg.. x8",
			"..---.. x8",
			"....... x3",
			".--.--. x12",
			"-.....- x10",
			"------- x8",
			"..ttt.. x14",
			"------- x24"
		]
	},
	{
		id: "bridge-chips",
		name: "Bridge Chips",
		world,
		gravity,
		battery: 16,
		signal: 34,
		rows: [
			"------- x20",
			"-->>>-- x6",
			"------- x8",
			"....... x3",
			"--111-- x6",
			"....... x3",
			"--111-- x6",
			"....... x3",
			"------- x14",
			"-+++++- x3",
			"------- x10",
			"..---.. x8",
			"....... x4",
			"..---.. x8",
			"....... x4",
			"------- x12",
			"-11-11- x8",
			"------- x10",
			"rrrrrrr x3",
			"------- x8",
			".-...-. x12",
			"....... x3",
			"------- x12",
			"-+++++- x3",
			"------- x10",
			"-->>>-- x6",
			"------- x6",
			"....... x4",
			"..111.. x6",
			"....... x3",
			"..111.. x6",
			"....... x4",
			"------- x10",
			"-+++++- x3",
			"------- x8",
			"--.-.-- x12",
			"....... x3",
			"-1---1- x6",
			"....... x3",
			"---1--- x6",
			"....... x4",
			"------- x24"
		]
	},
	{
		id: "kernel-run",
		name: "Kernel Run",
		world,
		gravity,
		battery: 17,
		signal: 40,
		rows: [
			"------- x20",
			"-->>>-- x6",
			"------- x10",
			"..111.. x6",
			"..222.. x6",
			"..333.. x8",
			"..---.. x4",
			"....... x3",
			"------- x12",
			"-+++++- x3",
			"------- x10",
			"..--... x12",
			"...--.. x12",
			"....... x4",
			"------- x10",
			"..ttt.. x24",
			"------- x8",
			"ggggggg x6",
			"------- x10",
			"xx---xx x8",
			"------- x8",
			"....... x4",
			"------- x10",
			"-+++++- x3",
			"------- x10",
			".11.11. x8",
			"------- x8",
			"-->>>-- x6",
			"------- x6",
			"....... x5",
			"--...-- x12",
			"....... x3",
			"------- x8",
			"-+++++- x3",
			"------- x8",
			"..111.. x6",
			"..222.. x6",
			"....... x4",
			"..222.. x6",
			"..---.. x4",
			"..----- x12",
			"-----.. x12",
			"....... x4",
			"------- x24"
		]
	}
];
const parsed = new Map();
/** A road by id, read once. */
function roadById(id) {
	const def = ROADS.find((r) => r.id === id);
	if (!def) return void 0;
	let road = parsed.get(id);
	if (!road) parsed.set(id, road = parseRoad(def));
	return road;
}
/** The road a road needs finished first (null for the first road). Roads open in order. */
function roadBefore(id) {
	const i = ROADS.findIndex((r) => r.id === id);
	return i > 0 ? ROADS[i - 1].id : null;
}
/**
* Medal times in seconds, from the Stage 1 simulator's suggestions (docs/CIRCUIT-PLAN.md, "Stage 1 results"): gold is 10%
* slower than the wild bot, silver 15% slower than the average bot, bronze is any finish. Stage 4 sets them for real.
*/
const MEDAL_SECONDS = {
	"power-on": {
		gold: 18,
		silver: 23
	},
	"clock-speed": {
		gold: 21,
		silver: 26
	},
	"first-charge": {
		gold: 23,
		silver: 31
	},
	"data-bus": {
		gold: 35,
		silver: 46
	},
	"bridge-chips": {
		gold: 30,
		silver: 38
	},
	"kernel-run": {
		gold: 36,
		silver: 50
	}
};
function medalFor(roadId, steps) {
	const m = MEDAL_SECONDS[roadId];
	const seconds = steps / 30;
	if (m && seconds <= m.gold) return "gold";
	if (m && seconds <= m.silver) return "silver";
	return "bronze";
}
/** Is a road open? The first is; each next one when the one before has been finished. */
function roadOpen(roads, id) {
	const before = roadBefore(id);
	return ROADS.some((r) => r.id === id) && (before === null || (roads[before]?.finishes ?? 0) > 0);
}
const finishesLeft = (today, unlimited) => unlimited ? null : Math.max(0, 5 - today);
const SEED_PATTERN = /^c1-(\d{10})-[0-9a-f]{24}$/;
const ROAD_ID = /^[a-z0-9-]{1,40}$/;
const makeSeed = (nowSeconds, randomHex) => `c1-${String(Math.floor(nowSeconds)).padStart(10, "0")}-${randomHex}`;
/** What the server signs: who, which road and the seed, so a stamp is no use for another pupil or road. */
const stampText = (player, road, seed) => `circuit-run:v1:${player}:${road}:${seed}`;
function seedTime(seed) {
	const m = SEED_PATTERN.exec(seed);
	return m ? Number(m[1]) : null;
}
/** Null if the seed is well made and still fresh, else what's wrong. */
function seedProblem(seed, nowSeconds) {
	const made = seedTime(seed);
	if (made === null) return "not a server seed";
	if (nowSeconds - made < -300) return "seed from the future";
	if (nowSeconds - made > 21600) return "seed too old";
	return null;
}
function parseFinish(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (typeof r.road !== "string" || !ROAD_ID.test(r.road)) return null;
	if (typeof r.seed !== "string" || r.seed.length > 80 || typeof r.stamp !== "string" || r.stamp.length > 200) return null;
	if (typeof r.inputs !== "string" || r.inputs.length > 6e4) return null;
	const crashes = Number.isInteger(r.crashes) && r.crashes >= 0 ? Math.min(r.crashes, 999) : 0;
	return {
		road: r.road,
		seed: r.seed,
		stamp: r.stamp,
		inputs: r.inputs,
		crashes
	};
}
/** Replays the inputs from the start of the road. Only a real finish, no faster than real time, is accepted. */
function judgeFinish(report, nowSeconds) {
	const road = roadById(report.road);
	if (!road) return {
		ok: false,
		problem: "unknown road"
	};
	const log = decodeLog(report.inputs);
	if (!log) return {
		ok: false,
		problem: "inputs not readable"
	};
	const end = replay(road, log);
	if (end.outcome !== "finished") return {
		ok: false,
		problem: "no finish"
	};
	const made = seedTime(report.seed);
	if (made === null) return {
		ok: false,
		problem: "not a server seed"
	};
	if (nowSeconds - made + 1 + 3 < end.steps / 30) return {
		ok: false,
		problem: "faster than real time"
	};
	return {
		ok: true,
		run: {
			steps: end.steps,
			medal: medalFor(report.road, end.steps),
			clean: report.crashes === 0,
			charged: end.battery > 50,
			battery: end.battery
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
const DONE_TODAY = "All done for today. See you tomorrow!";
const OFF = "Circuit Racer is switched off for your class.";
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleCircuit(request) {
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
		const body = await readJsonBody(request);
		if (!body || typeof body !== "object") return reply(400, { error: "That couldn't be read." });
		const nowSeconds = Math.floor(services.now() / 1e3);
		const settings = await services.settings(player);
		if (!settings) return reply(503, { error: "We couldn't reach the circuit just now." });
		if (!settings.enabled) return reply(403, {
			error: OFF,
			code: "off"
		});
		if (body.action === "load") {
			const saved = await services.load(player);
			if (saved === "busy") return reply(503, { error: "We couldn't load your roads just now." });
			return reply(200, {
				...saved,
				left: finishesLeft(saved.today, settings.unlimited)
			});
		}
		if (body.action === "start") {
			const roadId = typeof body.road === "string" ? body.road : "";
			if (!roadById(roadId)) return reply(400, { error: "That road couldn't be found." });
			const saved = await services.load(player);
			if (saved === "busy") return reply(503, { error: "We couldn't start the road just now." });
			if (!roadOpen(saved.roads, roadId)) return reply(409, {
				error: "Finish the road before to open this one.",
				code: "locked"
			});
			const left = finishesLeft(saved.today, settings.unlimited);
			if (left === 0) return reply(409, {
				error: DONE_TODAY,
				code: "done-today"
			});
			const seed = makeSeed(nowSeconds, services.randomHex(12));
			const stamp = await services.stamp(stampText(player, roadId, seed));
			if (!stamp) return reply(500, { error: "The road couldn't start." });
			return reply(200, {
				seed,
				stamp,
				left
			});
		}
		if (body.action === "finish") {
			const report = parseFinish(body);
			if (!report) return reply(400, { error: "That run couldn't be read." });
			const expected = await services.stamp(stampText(player, report.road, report.seed));
			const problem = seedProblem(report.seed, nowSeconds) ?? (expected && sameText(expected, report.stamp) ? null : "bad stamp");
			if (problem) {
				console.warn(`circuit: refused a finish (${problem})`);
				return reply(400, { error: "That run couldn't be saved." });
			}
			const judged = judgeFinish(report, nowSeconds);
			if (!judged.ok) {
				console.warn(`circuit: refused a finish (${judged.problem})`);
				return reply(400, { error: "That run couldn't be saved." });
			}
			const saved = await services.record(player, {
				road: report.road,
				before: roadBefore(report.road),
				seed: report.seed,
				inputs: report.inputs,
				unlimited: settings.unlimited,
				...judged.run
			});
			if (saved === "busy") return reply(503, { error: "We couldn't save your run just now." });
			if (saved.status === "done-today") return reply(409, {
				error: DONE_TODAY,
				code: "done-today"
			});
			if (saved.status === "locked") return reply(409, {
				error: "Finish the road before to open this one.",
				code: "locked"
			});
			const { steps, medal, clean, charged, battery } = judged.run;
			return reply(200, {
				result: saved.status,
				steps,
				medal,
				clean,
				charged,
				battery,
				left: finishesLeft(saved.today, settings.unlimited)
			});
		}
		return reply(400, { error: "That couldn't be read." });
	};
}
/** Compares two stamps without stopping at the first difference, so timing gives nothing away. */
function sameText(a, b) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
//#endregion
//#region supabase/functions/circuit/entry.ts
/** The server's own key. Supabase provides it automatically; it never leaves the server. */
function serverKey() {
	const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (legacy) return legacy;
	const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
	return keys.default ?? Object.values(keys)[0] ?? "";
}
const key = serverKey();
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", key, { auth: {
	persistSession: false,
	autoRefreshToken: false
} });
/** Calls a database function: its answer, or 'busy'. Logs say which one and the error code, never who. */
async function call(name, args) {
	const { data, error } = await admin.rpc(name, args);
	if (!error) return data;
	console.error(`circuit: ${name} failed (${error.code ?? "unknown"})`);
	return "busy";
}
Deno.serve(makeHandler({
	now: () => Date.now(),
	randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join(""),
	stamp: stamper(key, "circuit-run"),
	userIdFor: userIdFromToken(admin.auth),
	async settings(player) {
		const { data, error } = await admin.rpc("settings_of", { player }).maybeSingle();
		if (error || !data) {
			console.error(`circuit: settings failed (${error?.code ?? "none"})`);
			return null;
		}
		const row = data;
		return {
			enabled: row.circuit_enabled === true,
			unlimited: isUnlimitedFor(row.unlimited_days, "circuit")
		};
	},
	async load(player) {
		const saved = await call("circuit_load", { player });
		if (saved === "busy") return "busy";
		return {
			roads: saved?.roads ?? {},
			today: saved?.today ?? 0
		};
	},
	async record(player, f) {
		return await call("record_circuit_finish", {
			player,
			road: f.road,
			before_road: f.before,
			seed: f.seed,
			steps: f.steps,
			medal: f.medal,
			clean: f.clean,
			charged: f.charged,
			inputs: f.inputs,
			unlimited: f.unlimited
		});
	}
}));
//#endregion
