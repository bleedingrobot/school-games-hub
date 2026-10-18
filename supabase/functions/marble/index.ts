// GENERATED FILE: don't edit. Edit supabase/functions/marble/handler.ts (and shared/),
// then run `npm run build:functions`. Deploy this file as the "marble" function.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
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
const DT = 1 / 60;
/** How high one height level is, in tile widths. 0.5 means a slope that drops one level over one tile is a gentle hill. */
const LEVEL = .5;
const BALL_RADIUS = .3;
const MAX_SPEED = 4.5;
/** Sticky and slippery floors. `steer` multiplies the push, `drag` is the share of speed lost each step, `max` the speed limit. */
const SURFACES = {
	normal: {
		steer: 1,
		drag: .012,
		max: MAX_SPEED
	},
	ice: {
		steer: .3,
		drag: .0015,
		max: MAX_SPEED
	},
	mud: {
		steer: 1.3,
		drag: .06,
		max: 2.5
	}
};
/** In the air the player can only nudge the marble. */
const AIR_STEER = .3;
/** A bounce off a wall keeps this share of the speed. */
const BOUNCE = .45;
/** Bumpers push the marble out of a circle this big, at this speed. */
const BUMPER_RADIUS = .45;
const BUMPER_SPEED = 3.5;
/**
* Timed hazards. Everything is worked out from the step number, so the same run always meets the same hazard
* at the same moment (no randomness, nothing to remember). Times are in steps (60 a second).
*/
const TIMED = {
	/** A geyser puffs every `period` steps; for the first `warn` it only steams (a warning), then for `active` it throws the marble up. */
	geyser: {
		period: 180,
		warn: 15,
		active: 30,
		boost: 1.2
	},
	/** A trapdoor is solid for `solid` steps out of every `period`, then drops away. It flickers for the last `warn` steps before. */
	trapdoor: {
		period: 240,
		solid: 170,
		warn: 25
	},
	/** A gate (a sweeping arm) is open for `open` steps out of every `period`, then shuts. */
	gate: {
		period: 210,
		open: 120,
		warn: 25
	}
};
//#endregion
//#region shared/marble/course.ts
/**
* A course is data: one letter per tile for what it is, and one digit per tile for how high it is.
* `compileCourse` checks it and makes the lookup the engine uses.
*
* Tile letters
*   .  nothing (a gap, or off the edge): the marble falls
*   #  flat floor          i  ice (slippery)        m  mud (sticky)
*   >  <  ^  v  a slope going DOWN towards east, west, north (up the grid) or south.
*               Its digit is its HIGH edge; the low edge is one level lower.
*   =  a wall or rail the marble bounces off
*   b  a bumper (flat floor with a post in the middle)
*   j  a jump pad          c  a checkpoint        s  the start (exactly one)
*   f  the finish (one or more)
*   e w n o  a conveyor belt pushing east, west, north (up the grid) or south
*   g  a geyser: steams, then throws the marble into the air, on a timer
*   t  a trapdoor: solid, then drops away, on a timer
*   q  a gate (a sweeping arm): open, then shut like a wall, on a timer. Gates and trapdoors in the same column share a timer.
*   A–H  a shortcut door. Shut it is a wall; open it is flat floor. Which are open is decided
*        before the run starts and never changes during it (this is how maths gates will work).
*/
const SLOPES = {
	">": "E",
	"<": "W",
	"^": "N",
	v: "S"
};
const KNOWN = new Set(".#im><^v=bjcsfABCDEFGHewnogtq".split(""));
function compileCourse(def) {
	const height = def.rows.length;
	const width = def.rows[0]?.length ?? 0;
	if (!height || !width) throw new Error(`${def.id}: empty course`);
	if (def.heights.length !== height) throw new Error(`${def.id}: heights need ${height} rows`);
	const tiles = [];
	let start = null;
	let floorMin = Infinity;
	let doorCount = 0;
	let finishes = 0;
	for (let y = 0; y < height; y++) {
		if (def.rows[y].length !== width || def.heights[y].length !== width) throw new Error(`${def.id}: row ${y} is not ${width} wide`);
		for (let x = 0; x < width; x++) {
			const ch = def.rows[y][x];
			if (!KNOWN.has(ch)) throw new Error(`${def.id}: unknown tile "${ch}" at ${x},${y}`);
			const lv = parseInt(def.heights[y][x], 36);
			if (Number.isNaN(lv)) throw new Error(`${def.id}: bad height at ${x},${y}`);
			const door = ch >= "A" && ch <= "H" ? ch.charCodeAt(0) - 65 : -1;
			if (door >= 0) doorCount = Math.max(doorCount, door + 1);
			if (ch === "s") {
				if (start) throw new Error(`${def.id}: more than one start`);
				start = {
					x: x + .5,
					y: y + .5
				};
			}
			if (ch === "f") finishes++;
			const surface = ch === "i" ? "ice" : ch === "m" ? "mud" : "normal";
			const slope = SLOPES[ch] ?? null;
			if (ch !== "." && ch !== "=") floorMin = Math.min(floorMin, (slope ? lv - 1 : lv) * LEVEL);
			tiles.push({
				ch,
				level: lv,
				surface,
				slope,
				door
			});
		}
	}
	if (!start) throw new Error(`${def.id}: no start`);
	if (!finishes) throw new Error(`${def.id}: no finish`);
	return {
		def,
		width,
		height,
		tiles,
		start,
		floorMin,
		doorCount
	};
}
const NZ_COURSE_DEFS = [
	{
		id: "boulder-beach",
		name: "Boulder Beach",
		rows: [
			"............................................",
			".==================.........................",
			".=#####>>>########=.........................",
			".=#####>>>########=.........................",
			".=s####>>>########=.........................",
			".=#####>>>##b#####=.........................",
			".=#####>>>########=.........................",
			".============#####=.........................",
			"............=#####=.........................",
			"............=#####=.........................",
			"............=vvvvv=.........................",
			"............=vvvvv=.........................",
			"............=vvvvv=.........................",
			"............=ccccc=.........................",
			"............=ccccc=.........................",
			"............=#####=.........................",
			"............=#####=.........................",
			"............=###b#================..........",
			"............=#########>>>>#######=..........",
			"............=#########>>>>#######=..........",
			"............=#########>>>>#######=..........",
			"............=#########>>>>#######=..........",
			"............=#########>>>>#######=..........",
			"............================#####=..........",
			"...........................=#####=..........",
			"...........................=vvvvv=..........",
			"...........................=vvvvv=..........",
			"...........................=vvvvv=..........",
			"...........................=#####==========.",
			"...........................=##########>>ff=.",
			"...........................=##########>>ff=.",
			"...........................=##########>>ff=.",
			"...........................=##########>>ff=.",
			"...........................=##########>>ff=.",
			"...........................================.",
			"............................................"
		],
		heights: [
			"00000000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000000",
			"00mmmmmmlkjjjjjjjj00000000000000000000000000",
			"00mmmmmmlkjjjjjjjj00000000000000000000000000",
			"00mmmmmmlkjjjjjjjj00000000000000000000000000",
			"00mmmmmmlkjjjjjjjj00000000000000000000000000",
			"00mmmmmmlkjjjjjjjj00000000000000000000000000",
			"0000000000000jjjjj00000000000000000000000000",
			"0000000000000jjjjj00000000000000000000000000",
			"0000000000000jjjjj00000000000000000000000000",
			"0000000000000jjjjj00000000000000000000000000",
			"0000000000000iiiii00000000000000000000000000",
			"0000000000000hhhhh00000000000000000000000000",
			"0000000000000ggggg00000000000000000000000000",
			"0000000000000ggggg00000000000000000000000000",
			"0000000000000ggggg00000000000000000000000000",
			"0000000000000ggggg00000000000000000000000000",
			"0000000000000ggggg00000000000000000000000000",
			"0000000000000ggggggggggfedccccccc00000000000",
			"0000000000000ggggggggggfedccccccc00000000000",
			"0000000000000ggggggggggfedccccccc00000000000",
			"0000000000000ggggggggggfedccccccc00000000000",
			"0000000000000ggggggggggfedccccccc00000000000",
			"0000000000000000000000000000ccccc00000000000",
			"0000000000000000000000000000ccccc00000000000",
			"0000000000000000000000000000ccccc00000000000",
			"0000000000000000000000000000bbbbb00000000000",
			"0000000000000000000000000000aaaaa00000000000",
			"00000000000000000000000000009999900000000000",
			"00000000000000000000000000009999999999987700",
			"00000000000000000000000000009999999999987700",
			"00000000000000000000000000009999999999987700",
			"00000000000000000000000000009999999999987700",
			"00000000000000000000000000009999999999987700",
			"00000000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[7.5, 4.5],
			[8.5, 4.5],
			[9.5, 4.5],
			[12.5, 4.5],
			[14.5, 4.5],
			[15.5, 4.5],
			[15.5, 9.5],
			[15.5, 10.5],
			[15.5, 11.5],
			[15.5, 12.5],
			[15.5, 14.5],
			[15.5, 17.5],
			[15.5, 19.5],
			[15.5, 20.5],
			[20.5, 20.5],
			[21.5, 20.5],
			[22.5, 20.5],
			[23.5, 20.5],
			[24.5, 20.5],
			[25.5, 20.5],
			[28.5, 20.5],
			[29.5, 20.5],
			[30.5, 20.5],
			[30.5, 24.5],
			[30.5, 25.5],
			[30.5, 26.5],
			[30.5, 27.5],
			[30.5, 30.5],
			[30.5, 31.5],
			[35.5, 31.5],
			[37.5, 31.5],
			[38.5, 31.5],
			[39.5, 31.5],
			[41.5, 31.5]
		],
		medals: {
			gold: 21,
			silver: 31,
			bronze: 48
		},
		hardSeconds: 43
	},
	{
		id: "crown-range",
		name: "Crown Range Zig-Zag",
		rows: [
			".........................................",
			".===================.....................",
			".=##############>>#####..................",
			".=#######b######>>#####..................",
			".=s#############>>#####..................",
			".=###########b##>>#####..................",
			".=##############>>#####..................",
			".=================#####..................",
			".#####<<###############..................",
			".#####<<######b########..................",
			".#####<<###############..................",
			".#####<<##b############..................",
			".#####<<###############..................",
			".#####==============.....................",
			".###############>>#####..................",
			".############b##>>#####..................",
			".###############>>#####..................",
			".########b######>>#####..................",
			".###############>>#####..................",
			".....=============#####==============....",
			"..................###############>>#####.",
			"..................############b##>>#####.",
			"..................###############>>#####.",
			"..................########b######>>#####.",
			"..................###############>>#####.",
			".....................==============#####.",
			"..................#####<<###############.",
			"..................#####<<##b############.",
			"..................#####<<###############.",
			"..................#####<<######b########.",
			"..................#####<<###############.",
			"....==============#####=============.....",
			".#####<<###############..................",
			".#####<<######b########..................",
			".#####<<###############..................",
			".#####<<##b############..................",
			".#####<<###############..................",
			".#####=============......................",
			".###########>>fff=.......................",
			".###########>>fff=.......................",
			".###########>>fff=.......................",
			".###########>>fff=.......................",
			".###########>>fff=.......................",
			".....=============.......................",
			"........................................."
		],
		heights: [
			"00000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000",
			"00ooooooooooooooonmmmmm000000000000000000",
			"00ooooooooooooooonmmmmm000000000000000000",
			"00ooooooooooooooonmmmmm000000000000000000",
			"00ooooooooooooooonmmmmm000000000000000000",
			"00ooooooooooooooonmmmmm000000000000000000",
			"000000000000000000mmmmm000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmm000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmm000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmm000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmm000000000000000000",
			"0kkkkklmmmmmmmmmmmmmmmm000000000000000000",
			"0kkkkk00000000000000000000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiii000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiii000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiii000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiii000000000000000000",
			"0kkkkkkkkkkkkkkkkjiiiii000000000000000000",
			"000000000000000000iiiii000000000000000000",
			"000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"000000000000000000iiiiiiiiiiiiiiiihggggg0",
			"00000000000000000000000000000000000ggggg0",
			"000000000000000000eeeeefgggggggggggggggg0",
			"000000000000000000eeeeefgggggggggggggggg0",
			"000000000000000000eeeeefgggggggggggggggg0",
			"000000000000000000eeeeefgggggggggggggggg0",
			"000000000000000000eeeeefgggggggggggggggg0",
			"000000000000000000eeeee000000000000000000",
			"0cccccdeeeeeeeeeeeeeeee000000000000000000",
			"0cccccdeeeeeeeeeeeeeeee000000000000000000",
			"0cccccdeeeeeeeeeeeeeeee000000000000000000",
			"0cccccdeeeeeeeeeeeeeeee000000000000000000",
			"0cccccdeeeeeeeeeeeeeeee000000000000000000",
			"0ccccc00000000000000000000000000000000000",
			"0ccccccccccccbaaa000000000000000000000000",
			"0ccccccccccccbaaa000000000000000000000000",
			"0ccccccccccccbaaa000000000000000000000000",
			"0ccccccccccccbaaa000000000000000000000000",
			"0ccccccccccccbaaa000000000000000000000000",
			"00000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[5.5, 4.5],
			[8.5, 4.5],
			[11.5, 4.5],
			[14.5, 4.5],
			[15.5, 4.5],
			[16.5, 4.5],
			[17.5, 4.5],
			[19.5, 4.5],
			[20.5, 4.5],
			[20.5, 9.5],
			[20.5, 10.5],
			[15.5, 10.5],
			[12.5, 10.5],
			[9.5, 10.5],
			[8.5, 10.5],
			[7.5, 10.5],
			[6.5, 10.5],
			[4.5, 10.5],
			[3.5, 10.5],
			[3.5, 15.5],
			[3.5, 16.5],
			[8.5, 16.5],
			[11.5, 16.5],
			[14.5, 16.5],
			[15.5, 16.5],
			[16.5, 16.5],
			[17.5, 16.5],
			[19.5, 16.5],
			[20.5, 16.5],
			[20.5, 21.5],
			[20.5, 22.5],
			[25.5, 22.5],
			[28.5, 22.5],
			[31.5, 22.5],
			[32.5, 22.5],
			[33.5, 22.5],
			[34.5, 22.5],
			[36.5, 22.5],
			[37.5, 22.5],
			[37.5, 27.5],
			[37.5, 28.5],
			[32.5, 28.5],
			[29.5, 28.5],
			[26.5, 28.5],
			[25.5, 28.5],
			[24.5, 28.5],
			[23.5, 28.5],
			[21.5, 28.5],
			[20.5, 28.5],
			[20.5, 33.5],
			[20.5, 34.5],
			[15.5, 34.5],
			[12.5, 34.5],
			[9.5, 34.5],
			[8.5, 34.5],
			[7.5, 34.5],
			[6.5, 34.5],
			[4.5, 34.5],
			[3.5, 34.5],
			[3.5, 39.5],
			[3.5, 40.5],
			[8.5, 40.5],
			[11.5, 40.5],
			[12.5, 40.5],
			[13.5, 40.5],
			[16.5, 40.5]
		],
		medals: {
			gold: 52,
			silver: 76,
			bronze: 116
		},
		hardSeconds: 91
	},
	{
		id: "geyser-valley",
		name: "Geyser Valley",
		rows: [
			"....................................................",
			".============================.......................",
			".=#####>>mmm##=...###>>#####=.......................",
			".=#####>>mmm##=...###>>#####=.......................",
			".=s####>>mmm##g...###>>#####=.......................",
			".=#####>>mmm##=...###>>#####=.......................",
			".=#####>>mmm##=...###>>#####=.......................",
			".======================#####=.......................",
			"......................=##mm#=.......................",
			"......................=#m###=.......................",
			"......................=#####=.......................",
			"......................=vvvvv=.......................",
			"......................=vvvvv=.......................",
			"......................=#####=.......................",
			"......................=#####=.......................",
			"......................==ggg==.......................",
			"......................=.....=.......................",
			"......................=.....=.......................",
			"......................=.....=.......................",
			"......................=#####=======================.",
			"......................=#####mmmm##>>>##..####>>fff=.",
			"......................=#####mmmm##>>>##..####>>fff=.",
			"......................=#####mmmm##>>>g#..####>>fff=.",
			"......................=#####mmmm##>>>##..####>>fff=.",
			"......................=#####mmmm##>>>##..####>>fff=.",
			"......................=============================.",
			"...................................................."
		],
		heights: [
			"0000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000",
			"00ggggggfeeeee0000eeeedccccc000000000000000000000000",
			"00ggggggfeeeee0000eeeedccccc000000000000000000000000",
			"00ggggggfeeeeee000eeeedccccc000000000000000000000000",
			"00ggggggfeeeee0000eeeedccccc000000000000000000000000",
			"00ggggggfeeeee0000eeeedccccc000000000000000000000000",
			"00000000000000000000000ccccc000000000000000000000000",
			"00000000000000000000000ccccc000000000000000000000000",
			"00000000000000000000000ccccc000000000000000000000000",
			"00000000000000000000000ccccc000000000000000000000000",
			"00000000000000000000000ccccc000000000000000000000000",
			"00000000000000000000000bbbbb000000000000000000000000",
			"00000000000000000000000aaaaa000000000000000000000000",
			"00000000000000000000000aaaaa000000000000000000000000",
			"000000000000000000000000aaa0000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000",
			"00000000000000000000000aaaaa000000000000000000000000",
			"00000000000000000000000aaaaaaaaaaaa98770077777655500",
			"00000000000000000000000aaaaaaaaaaaa98770077777655500",
			"00000000000000000000000aaaaaaaaaaaa98770077777655500",
			"00000000000000000000000aaaaaaaaaaaa98770077777655500",
			"00000000000000000000000aaaaaaaaaaaa98770077777655500",
			"0000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[7.5, 4.5],
			[8.5, 4.5],
			[11.5, 4.5],
			[13.5, 4.5],
			[14.5, 4.5],
			[15.5, 4.5],
			[16.5, 4.5],
			[17.5, 4.5],
			[20.5, 4.5],
			[21.5, 4.5],
			[22.5, 4.5],
			[24.5, 4.5],
			[25.5, 4.5],
			[25.5, 9.5],
			[25.5, 10.5],
			[25.5, 11.5],
			[25.5, 12.5],
			[25.5, 14.5],
			[25.5, 15.5],
			[25.5, 16.5],
			[25.5, 17.5],
			[25.5, 18.5],
			[25.5, 21.5],
			[25.5, 22.5],
			[30.5, 22.5],
			[31.5, 22.5],
			[33.5, 22.5],
			[34.5, 22.5],
			[35.5, 22.5],
			[36.5, 22.5],
			[38.5, 22.5],
			[39.5, 22.5],
			[40.5, 22.5],
			[43.5, 22.5],
			[44.5, 22.5],
			[45.5, 22.5],
			[46.5, 22.5],
			[49.5, 22.5]
		],
		medals: {
			gold: 22,
			silver: 32,
			bronze: 48
		},
		hardSeconds: 44
	},
	{
		id: "glacier-run",
		name: "Glacier Run",
		rows: [
			"...............................................",
			".===========================...................",
			".=iiiiiiiii>>>iiiij..i#####=...................",
			".=iiiiiiiii>>>iiiij..i#####=...................",
			".=siiiiiiii>>>iiiij..i#####=...................",
			".=iiiiiiiii>>>iiiij..i#####=...................",
			".=iiiiiiiii>>>iiiij..i#####=...................",
			".=====================iiiii=...................",
			".....................=iiiii=...................",
			".....................=iiiii=...................",
			".....................=iiiii=...................",
			".....................=iiiii=...................",
			".....................=vvvvv=...................",
			".....................=vvvvv=...................",
			".....................=vvvvv=...................",
			".....................=iiiii=...................",
			".....................=iiiii=...................",
			".....................=iiiii=...................",
			".....................=ccccc=...................",
			".....................=ccccc=...................",
			".....................=iiiii=...................",
			".....................=iiiii=...................",
			".....................=jjjjj=...................",
			".....................=.....=...................",
			".....................=.....=...................",
			".....................=iiiii===================.",
			".....................=#####iii>>mmmm>>mmmmmff=.",
			".....................=#####iii>>mmmm>>mmmmmff=.",
			".....................=#####iii>>mmmm>>mmmmmff=.",
			".....................=#####iii>>mmmm>>mbmmmff=.",
			".....................=#####iii>>mmmm>>mmmmmff=.",
			".....................=========================.",
			"..............................................."
		],
		heights: [
			"00000000000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn00000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn00000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn00000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn00000000000000000000",
			"00qqqqqqqqqqponnnnn00nnnnnn00000000000000000000",
			"0000000000000000000000nnnnn00000000000000000000",
			"0000000000000000000000nnnnn00000000000000000000",
			"0000000000000000000000nnnnn00000000000000000000",
			"0000000000000000000000nnnnn00000000000000000000",
			"0000000000000000000000nnnnn00000000000000000000",
			"0000000000000000000000nnnnn00000000000000000000",
			"0000000000000000000000mmmmm00000000000000000000",
			"0000000000000000000000lllll00000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"00000000000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000000000",
			"0000000000000000000000kkkkk00000000000000000000",
			"0000000000000000000000kkkkkkkkkjiiiiihggggggg00",
			"0000000000000000000000kkkkkkkkkjiiiiihggggggg00",
			"0000000000000000000000kkkkkkkkkjiiiiihggggggg00",
			"0000000000000000000000kkkkkkkkkjiiiiihggggggg00",
			"0000000000000000000000kkkkkkkkkjiiiiihggggggg00",
			"00000000000000000000000000000000000000000000000",
			"00000000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[9.5, 4.5],
			[10.5, 4.5],
			[11.5, 4.5],
			[12.5, 4.5],
			[13.5, 4.5],
			[16.5, 4.5],
			[17.5, 4.5],
			[18.5, 4.5],
			[19.5, 4.5],
			[20.5, 4.5],
			[23.5, 4.5],
			[24.5, 4.5],
			[24.5, 9.5],
			[24.5, 11.5],
			[24.5, 12.5],
			[24.5, 13.5],
			[24.5, 14.5],
			[24.5, 17.5],
			[24.5, 19.5],
			[24.5, 21.5],
			[24.5, 22.5],
			[24.5, 23.5],
			[24.5, 24.5],
			[24.5, 27.5],
			[24.5, 28.5],
			[29.5, 28.5],
			[30.5, 28.5],
			[31.5, 28.5],
			[34.5, 28.5],
			[35.5, 28.5],
			[36.5, 28.5],
			[37.5, 28.5],
			[40.5, 28.5],
			[42.5, 28.5],
			[44.5, 28.5]
		],
		medals: {
			gold: 21,
			silver: 31,
			bronze: 48
		},
		hardSeconds: 43
	},
	{
		id: "windy-welly",
		name: "Windy Welly",
		rows: [
			"............................",
			".==========================.",
			".=#####eeeeee##q###>>#####=.",
			".=#####eeeeee##q###>>#####=.",
			".=s####eeeeee##q###>>#####=.",
			".=#####eeeeee##q###>>#####=.",
			".=#####eeeeee##q###>>#####=.",
			".====================ooooo=.",
			"....................=ooooo=.",
			"....................=ooooo=.",
			"....................=ooooo=.",
			"....................=ooooo=.",
			"....................=ooooo=.",
			"....................=ooooo=.",
			"....................=#####=.",
			"....................=#####=.",
			"....................=qqqqq=.",
			"....................=#####=.",
			"....................=#####=.",
			"....................=#####=.",
			"....................=vvvvv=.",
			"....................=vvvvv=.",
			"..===================vvvvv=.",
			"..=#####<<###q###wwww#####=.",
			"..=#####<<###q###wwww#####=.",
			"..=#####<<###q###wwww#####=.",
			"..=#####<<###q###wwww#####=.",
			"..=#####<<###q###wwww#####=.",
			"..=#####===================.",
			"..=#####=...................",
			"..=#####=...................",
			"..=qqqqq=...................",
			"..=ooooo=...................",
			"..=ooooo=...................",
			"..=ooooo==========..........",
			"..=#########>>fff=..........",
			"..=#########>>fff=..........",
			"..=#########>>fff=..........",
			"..=#########>>fff=..........",
			"..=#########>>fff=..........",
			"..================..........",
			"............................"
		],
		heights: [
			"0000000000000000000000000000",
			"0000000000000000000000000000",
			"00iiiiiiiiiiiiiiiiiihggggg00",
			"00iiiiiiiiiiiiiiiiiihggggg00",
			"00iiiiiiiiiiiiiiiiiihggggg00",
			"00iiiiiiiiiiiiiiiiiihggggg00",
			"00iiiiiiiiiiiiiiiiiihggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000ggggg00",
			"000000000000000000000fffff00",
			"000000000000000000000eeeee00",
			"000bbbbbcddddddddddddddddd00",
			"000bbbbbcddddddddddddddddd00",
			"000bbbbbcddddddddddddddddd00",
			"000bbbbbcddddddddddddddddd00",
			"000bbbbbcddddddddddddddddd00",
			"000bbbbb00000000000000000000",
			"000bbbbb00000000000000000000",
			"000bbbbb00000000000000000000",
			"000bbbbb00000000000000000000",
			"000bbbbb00000000000000000000",
			"000bbbbb00000000000000000000",
			"000bbbbb00000000000000000000",
			"000bbbbbbbbbba99900000000000",
			"000bbbbbbbbbba99900000000000",
			"000bbbbbbbbbba99900000000000",
			"000bbbbbbbbbba99900000000000",
			"000bbbbbbbbbba99900000000000",
			"0000000000000000000000000000",
			"0000000000000000000000000000"
		],
		route: [
			[4.5, 4.5],
			[6.5, 4.5],
			[8.5, 4.5],
			[11.5, 4.5],
			[12.5, 4.5],
			[14.5, 4.5],
			[15.5, 4.5],
			[18.5, 4.5],
			[19.5, 4.5],
			[20.5, 4.5],
			[22.5, 4.5],
			[23.5, 4.5],
			[23.5, 8.5],
			[23.5, 11.5],
			[23.5, 13.5],
			[23.5, 15.5],
			[23.5, 16.5],
			[23.5, 19.5],
			[23.5, 20.5],
			[23.5, 21.5],
			[23.5, 22.5],
			[23.5, 24.5],
			[23.5, 25.5],
			[18.5, 25.5],
			[17.5, 25.5],
			[14.5, 25.5],
			[13.5, 25.5],
			[10.5, 25.5],
			[9.5, 25.5],
			[8.5, 25.5],
			[6.5, 25.5],
			[5.5, 25.5],
			[5.5, 30.5],
			[5.5, 31.5],
			[5.5, 34.5],
			[5.5, 36.5],
			[5.5, 37.5],
			[10.5, 37.5],
			[11.5, 37.5],
			[12.5, 37.5],
			[13.5, 37.5],
			[16.5, 37.5]
		],
		medals: {
			gold: 32,
			silver: 47,
			bronze: 72
		},
		hardSeconds: 60,
		wind: {
			dx: 0,
			dy: 1,
			period: 360,
			on: 70,
			warn: 40,
			force: 8
		}
	},
	{
		id: "alpine-crossing",
		name: "Alpine Crossing",
		rows: [
			"................................................................",
			".=======........................................................",
			".=###########>##>##>##>##cct##t#####............................",
			".=s##########>##>##>##>##cct##t#####............................",
			".=###########>##>##>##>##cct##t#####............................",
			".=======.........................###............................",
			".................................###............................",
			".................................###............................",
			".................................###............................",
			".................................###............................",
			".................................vvv............................",
			".................................vvv............................",
			".................................###............................",
			".................................###............................",
			".................................ttt............................",
			".................................###............................",
			".................................###...................========.",
			".................................ccc...................=####ff=.",
			".................................########>##>##>##t###>>####ff=.",
			".................................########>##>##>##t###>>####ff=.",
			".................................########>##>##>##t###>>####ff=.",
			".......................................................=####ff=.",
			".......................................................========.",
			"................................................................"
		],
		heights: [
			"0000000000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000000000",
			"00uuuuuuuuuuuutttsssrrrqqqqqqqqqqqqq0000000000000000000000000000",
			"00uuuuuuuuuuuutttsssrrrqqqqqqqqqqqqq0000000000000000000000000000",
			"00uuuuuuuuuuuutttsssrrrqqqqqqqqqqqqq0000000000000000000000000000",
			"000000000000000000000000000000000qqq0000000000000000000000000000",
			"000000000000000000000000000000000qqq0000000000000000000000000000",
			"000000000000000000000000000000000qqq0000000000000000000000000000",
			"000000000000000000000000000000000qqq0000000000000000000000000000",
			"000000000000000000000000000000000qqq0000000000000000000000000000",
			"000000000000000000000000000000000qqq0000000000000000000000000000",
			"000000000000000000000000000000000ppp0000000000000000000000000000",
			"000000000000000000000000000000000ooo0000000000000000000000000000",
			"000000000000000000000000000000000ooo0000000000000000000000000000",
			"000000000000000000000000000000000ooo0000000000000000000000000000",
			"000000000000000000000000000000000ooo0000000000000000000000000000",
			"000000000000000000000000000000000ooo0000000000000000000000000000",
			"000000000000000000000000000000000ooo00000000000000000000jjjjjj00",
			"000000000000000000000000000000000ooooooooonnnmmmlllllllkjjjjjj00",
			"000000000000000000000000000000000ooooooooonnnmmmlllllllkjjjjjj00",
			"000000000000000000000000000000000ooooooooonnnmmmlllllllkjjjjjj00",
			"00000000000000000000000000000000000000000000000000000000jjjjjj00",
			"0000000000000000000000000000000000000000000000000000000000000000",
			"0000000000000000000000000000000000000000000000000000000000000000"
		],
		route: [
			[4.5, 3.5],
			[6.5, 3.5],
			[9.5, 3.5],
			[12.5, 3.5],
			[13.5, 3.5],
			[15.5, 3.5],
			[16.5, 3.5],
			[18.5, 3.5],
			[19.5, 3.5],
			[21.5, 3.5],
			[22.5, 3.5],
			[24.5, 3.5],
			[26.5, 3.5],
			[27.5, 3.5],
			[29.5, 3.5],
			[30.5, 3.5],
			[33.5, 3.5],
			[34.5, 3.5],
			[34.5, 7.5],
			[34.5, 9.5],
			[34.5, 10.5],
			[34.5, 11.5],
			[34.5, 13.5],
			[34.5, 14.5],
			[34.5, 16.5],
			[34.5, 18.5],
			[34.5, 19.5],
			[38.5, 19.5],
			[40.5, 19.5],
			[41.5, 19.5],
			[43.5, 19.5],
			[44.5, 19.5],
			[46.5, 19.5],
			[47.5, 19.5],
			[49.5, 19.5],
			[50.5, 19.5],
			[53.5, 19.5],
			[54.5, 19.5],
			[55.5, 19.5],
			[58.5, 19.5],
			[59.5, 19.5],
			[61.5, 19.5]
		],
		medals: {
			gold: 22,
			silver: 32,
			bronze: 48
		},
		hardSeconds: 44,
		wind: {
			dx: 1,
			dy: 0,
			period: 420,
			on: 80,
			warn: 40,
			force: 6
		}
	}
];
//#endregion
//#region shared/marble/courses.ts
/**
* The courses, as frozen literals (docs/MARBLE-PLAN.md, section 3). The two `test-` courses are for the
* engine's tests and the first screens; the six New Zealand courses come in stage M.3.
* Medal times are set from each course's reference run (`reference.test.ts` keeps them honest).
*/
const TEST_EASY = {
	id: "test-easy",
	name: "Wide Hill",
	rows: [
		"================",
		"=##>>mm##>#>##f=",
		"=##>>mm##>#>##f=",
		"=s#>>mm#c>#>##f=",
		"=##>>mm##>#>##f=",
		"=##>>mm##>#>##f=",
		"================"
	],
	heights: [
		"0000000000000000",
		"0666544444332220",
		"0666544444332220",
		"0666544444332220",
		"0666544444332220",
		"0666544444332220",
		"0000000000000000"
	],
	route: [[8.5, 3.5], [14.5, 3.5]],
	medals: {
		gold: 4,
		silver: 7,
		bronze: 12
	},
	hardSeconds: 15
};
const TEST_HARD = {
	id: "test-hard",
	name: "Gap and Ice",
	rows: [
		"...................",
		"...................",
		"...................",
		".##>j..###iiii##>f.",
		".s#>j..#c#iiiib#>f.",
		".##>j..###iiii##>f.",
		"...................",
		"...................",
		"..................."
	],
	heights: [
		"0000000000000000000",
		"0000000000000000000",
		"0000000000000000000",
		"0555400444444444430",
		"0555400444444444430",
		"0555400444444444430",
		"0000000000000000000",
		"0000000000000000000",
		"0000000000000000000"
	],
	route: [
		[4.5, 4.5],
		[8.5, 4.5],
		[13.5, 3.5],
		[15.5, 3.5],
		[17.5, 4.5]
	],
	medals: {
		gold: 5,
		silver: 9,
		bronze: 15
	},
	hardSeconds: 20
};
const COURSES = [
	...NZ_COURSE_DEFS,
	TEST_EASY,
	TEST_HARD
].map(compileCourse);
function courseById(id) {
	return COURSES.find((c) => c.def.id === id);
}
const RUN = /^([0-9a])x([1-9]\d{0,5})$/;
/** Null if the text isn't a well-made list of runs. */
function decodeInputs(text) {
	if (text === "") return [];
	const runs = [];
	let total = 0;
	for (const part of text.split(",")) {
		const m = RUN.exec(part);
		if (!m) return null;
		const n = Number(m[2]);
		total += n;
		if (total > 21600) return null;
		runs.push([parseInt(m[1], 16), n]);
	}
	return runs;
}
//#endregion
//#region shared/marble/engine.ts
/**
* Marble Rush's rules and physics, as plain functions (docs/MARBLE-PLAN.md, section 4).
*
* `newRun` makes the starting state, `stepRun` moves it forward one 1/60-second step with one
* input, and `replay` plays a whole recorded run. The same inputs always give exactly the same
* run, in every browser and on the server, so the server can work out a run's real time itself.
*
* The state is plain numbers: it can be saved, hashed and compared.
*/
const R2 = .7071067811865476;
/** Index = input code. North is up the grid (smaller y). */
const DIRS = [
	[0, 0],
	[0, -1],
	[R2, -.7071067811865476],
	[1, 0],
	[R2, R2],
	[0, 1],
	[-.7071067811865476, R2],
	[-1, 0],
	[-.7071067811865476, -.7071067811865476]
];
const CONVEYORS = {
	e: [1, 0],
	w: [-1, 0],
	n: [0, -1],
	o: [0, 1]
};
const WALL = {
	ch: "=",
	level: 0,
	surface: "normal",
	slope: null,
	door: -1
};
const VOID = {
	ch: ".",
	level: 0,
	surface: "normal",
	slope: null,
	door: -1
};
function makeWorld(course, options = {}) {
	return {
		course,
		mode: options.mode ?? "up",
		open: new Set(options.openDoors ?? []),
		t: 0
	};
}
function tileAt(w, tx, ty) {
	const c = w.course;
	if (tx < 0 || ty < 0 || tx >= c.width || ty >= c.height) return VOID;
	const t = c.tiles[ty * c.width + tx];
	if (t.door >= 0) return w.open.has(t.door) ? {
		...t,
		ch: "#"
	} : WALL;
	if (t.ch === "t") return trapdoorSolid(w.t, tx) ? t : VOID;
	if (t.ch === "q") return gateOpen(w.t, tx) ? {
		...t,
		ch: "#"
	} : WALL;
	return t;
}
/** Hazards in the same column share a timer, so a row of them moves together. */
const trapdoorSolid = (t, tx) => (t + tx * 53) % TIMED.trapdoor.period < TIMED.trapdoor.solid;
const gateOpen = (t, tx) => (t + tx * 53) % TIMED.gate.period < TIMED.gate.open;
/** 0 = quiet, 1 = steaming (a warning), 2 = throwing the marble up. */
function geyserPhase(t, tx, ty) {
	const p = (t + tx * 37 + ty * 91) % TIMED.geyser.period;
	return p < TIMED.geyser.warn ? 1 : p < TIMED.geyser.warn + TIMED.geyser.active ? 2 : 0;
}
/** The floor's height (in tiles) at a point, or null for a gap or a wall. */
function floorAt(w, x, y) {
	const tx = Math.floor(x);
	const ty = Math.floor(y);
	const t = tileAt(w, tx, ty);
	if (t.ch === "." || t.ch === "=") return null;
	if (!t.slope) return t.level * LEVEL;
	const u = x - tx;
	const v = y - ty;
	const down = t.slope === "E" ? u : t.slope === "W" ? 1 - u : t.slope === "S" ? v : 1 - v;
	return (t.level - down) * LEVEL;
}
const isWall = (w, x, y) => tileAt(w, Math.floor(x), Math.floor(y)).ch === "=";
/** True if the marble can't be there: a wall, or floor too far above it to step up onto. */
function blockedAt(w, s, x, y, axis, sign) {
	const R = BALL_RADIUS;
	const side = R * .7;
	for (let k = -1; k <= 1; k++) {
		const px = axis === "x" ? x + sign * R : x + k * side;
		const py = axis === "y" ? y + sign * R : y + k * side;
		if (isWall(w, px, py)) return true;
		const f = floorAt(w, px, py);
		if (f !== null && f > s.z + (s.grounded ? .3 : .02)) return true;
	}
	return false;
}
function newRun(w) {
	const { x, y } = w.course.start;
	return {
		x,
		y,
		z: floorAt(w, x, y) ?? 0,
		vx: 0,
		vy: 0,
		vz: 0,
		grounded: true,
		steps: 0,
		held: 0,
		penalty: 0,
		refundable: 0,
		bonus: 0,
		falls: 0,
		respawnX: x,
		respawnY: y,
		checkpoints: [],
		outcome: "running",
		finishSteps: 0,
		padCooldown: 0
	};
}
/** Time on the clock, in steps: count-up is the time so far; count-down is what is left. */
function clockSteps(w, s) {
	const used = s.steps + s.penalty;
	return w.mode === "up" ? used : w.course.def.hardSeconds * 60 + s.bonus - used;
}
function fall(w, s) {
	s.falls++;
	s.penalty += 180;
	s.refundable = 180;
	s.x = s.respawnX;
	s.y = s.respawnY;
	s.z = floorAt(w, s.x, s.y) ?? 0;
	s.vx = s.vy = s.vz = 0;
	s.grounded = true;
}
function checkClock(w, s) {
	if (s.outcome !== "running") return;
	const left = clockSteps(w, s);
	if (w.mode === "down" ? left <= 0 : left >= 18e3) s.outcome = "timeout";
}
/** Plays one 1/60-second step with one input. Changes `s`. Does nothing once the run is over. */
function stepRun(w, s, input) {
	if (s.outcome !== "running") return;
	if (input === 9) {
		s.held++;
		return;
	}
	if (input === 10) {
		s.penalty -= s.refundable;
		s.refundable = 0;
		return;
	}
	const c = w.course;
	s.steps++;
	w.t = s.steps;
	const dir = DIRS[input] ?? DIRS[0];
	const here = tileAt(w, Math.floor(s.x), Math.floor(s.y));
	let max = SURFACES.normal.max;
	if (s.grounded) {
		const surf = SURFACES[here.surface];
		max = surf.max;
		let ax = dir[0] * 9 * surf.steer;
		let ay = dir[1] * 9 * surf.steer;
		if (here.slope) {
			const g = 9 * LEVEL;
			if (here.slope === "E") ax += g;
			else if (here.slope === "W") ax -= g;
			else if (here.slope === "S") ay += g;
			else ay -= g;
		}
		const belt = CONVEYORS[here.ch];
		if (belt) {
			ax += belt[0] * 6;
			ay += belt[1] * 6;
		}
		s.vx = (s.vx + ax * DT) * (1 - surf.drag);
		s.vy = (s.vy + ay * DT) * (1 - surf.drag);
	} else {
		s.vx += dir[0] * 9 * AIR_STEER * DT;
		s.vy += dir[1] * 9 * AIR_STEER * DT;
		s.vz -= 18 * DT;
	}
	const wind = c.def.wind;
	if (wind && s.steps % wind.period < wind.on) {
		s.vx += wind.dx * wind.force * DT;
		s.vy += wind.dy * wind.force * DT;
	}
	const v2 = s.vx * s.vx + s.vy * s.vy;
	if (v2 > max * max) {
		const k = max / Math.sqrt(v2);
		s.vx *= k;
		s.vy *= k;
	}
	const nx = s.x + s.vx * DT;
	if (s.vx !== 0 && blockedAt(w, s, nx, s.y, "x", s.vx > 0 ? 1 : -1)) s.vx = -s.vx * BOUNCE;
	else s.x = nx;
	const ny = s.y + s.vy * DT;
	if (s.vy !== 0 && blockedAt(w, s, s.x, ny, "y", s.vy > 0 ? 1 : -1)) s.vy = -s.vy * BOUNCE;
	else s.y = ny;
	const floor = floorAt(w, s.x, s.y);
	let gone = false;
	if (s.grounded) {
		if (floor === null || floor < s.z - .3) {
			s.grounded = false;
			s.vz = 0;
		} else s.z = floor;
	}
	if (!s.grounded) {
		s.z += s.vz * DT;
		if (floor !== null && s.z <= floor) {
			if (-s.vz > 9) gone = true;
			else {
				s.z = floor;
				s.vz = 0;
				s.grounded = true;
			}
		}
		if (s.z < c.floorMin - 1.5) gone = true;
	}
	if (gone) {
		fall(w, s);
		checkClock(w, s);
		return;
	}
	if (s.padCooldown > 0) s.padCooldown--;
	const tx = Math.floor(s.x);
	const ty = Math.floor(s.y);
	const on = tileAt(w, tx, ty);
	if (on.ch === "b") {
		const cx = tx + .5;
		const cy = ty + .5;
		const dx = s.x - cx;
		const dy = s.y - cy;
		const d2 = dx * dx + dy * dy;
		if (d2 < .2025) {
			const d = Math.sqrt(d2);
			const nxv = d < 1e-6 ? 0 : dx / d;
			const nyv = d < 1e-6 ? -1 : dy / d;
			s.x = cx + nxv * BUMPER_RADIUS;
			s.y = cy + nyv * BUMPER_RADIUS;
			s.vx = nxv * BUMPER_SPEED;
			s.vy = nyv * BUMPER_SPEED;
		}
	} else if (on.ch === "g" && s.grounded && s.padCooldown === 0 && geyserPhase(s.steps, tx, ty) === 2) {
		s.grounded = false;
		s.vz = 7 * TIMED.geyser.boost;
		s.padCooldown = 30;
	} else if (on.ch === "j" && s.grounded && s.padCooldown === 0) {
		s.grounded = false;
		s.vz = 7;
		s.padCooldown = 30;
	} else if (on.ch === "c") {
		const id = ty * c.width + tx;
		if (!s.checkpoints.includes(id)) {
			s.checkpoints.push(id);
			s.respawnX = tx + .5;
			s.respawnY = ty + .5;
			if (w.mode === "down") s.bonus += 300;
		}
	} else if (on.ch === "f") {
		s.outcome = "finished";
		s.finishSteps = s.steps + s.penalty;
		return;
	}
	checkClock(w, s);
}
/** Plays a recorded run from the start. Returns null if the inputs aren't well made. */
function replay(course, runs, options = {}) {
	const w = makeWorld(course, options);
	const s = newRun(w);
	let total = 0;
	for (const [code, n] of runs) {
		if (!Number.isInteger(code) || code < 0 || code > 10 || !Number.isInteger(n) || n < 1) return null;
		total += n;
		if (total > 21600) return null;
	}
	for (const [code, n] of runs) {
		for (let i = 0; i < n && s.outcome === "running"; i++) stepRun(w, s, code);
		if (s.outcome !== "running") break;
	}
	return {
		outcome: s.outcome === "running" ? "unfinished" : s.outcome,
		finishSteps: s.outcome === "finished" ? s.finishSteps : 0,
		falls: s.falls,
		checkpoints: s.checkpoints.length,
		held: s.held,
		steps: s.steps,
		state: s
	};
}
const SEED_PATTERN = /^m1-(\d{10})-[0-9a-f]{24}$/;
const COURSE_ID = /^[a-z0-9-]{1,40}$/;
/** A new seed: when it was made and 12 random bytes. */
function makeMarbleSeed(nowSeconds, randomHex) {
	return `m1-${String(Math.floor(nowSeconds)).padStart(10, "0")}-${randomHex}`;
}
/** What the server signs: who, which course and mode, and the seed, so a stamp is no use for another run. */
function marbleStampText(player, course, mode, seed) {
	return `marble-run:v1:${player}:${course}:${mode}:${seed}`;
}
/** When the seed was handed out (seconds since 1970), or null if it isn't a server seed. */
function marbleSeedTime(seed) {
	const match = SEED_PATTERN.exec(seed);
	return match ? Number(match[1]) : null;
}
/** Null if the seed is well made and still fresh, else what's wrong. */
function marbleSeedProblem(seed, nowSeconds) {
	const made = marbleSeedTime(seed);
	if (made === null) return "not a server seed";
	const age = nowSeconds - made;
	if (age < -300) return "seed from the future";
	if (age > 21600) return "seed too old";
	return null;
}
/** Null if it isn't shaped like a report. (Nothing about it is trusted yet.) */
function parseMarbleReport(input) {
	if (typeof input !== "object" || input === null) return null;
	const r = input;
	if (typeof r.seed !== "string" || typeof r.stamp !== "string" || typeof r.course !== "string") return null;
	if (r.mode !== "up" && r.mode !== "down") return null;
	if (typeof r.inputs !== "string" || r.inputs.length > 6e4) return null;
	if (r.seed.length > 80 || r.stamp.length > 200 || !COURSE_ID.test(r.course)) return null;
	return {
		seed: r.seed,
		stamp: r.stamp,
		course: r.course,
		mode: r.mode,
		inputs: r.inputs
	};
}
/**
* Replays the recorded inputs and checks the run. `nowSeconds` and the seed's time give the real
* time that has passed since the seed was handed out.
*/
function judgeRun(report, nowSeconds) {
	const course = courseById(report.course);
	if (!course) return {
		ok: false,
		problem: "unknown course"
	};
	const runs = decodeInputs(report.inputs);
	if (!runs) return {
		ok: false,
		problem: "inputs not readable"
	};
	const result = replay(course, runs, { mode: report.mode });
	if (!result) return {
		ok: false,
		problem: "inputs not readable"
	};
	if (result.outcome !== "finished" || result.finishSteps <= 0) return {
		ok: false,
		problem: "no finish"
	};
	const made = marbleSeedTime(report.seed);
	if (made === null) return {
		ok: false,
		problem: "not a server seed"
	};
	if (nowSeconds - made + 1 + 3 < result.steps / 60) return {
		ok: false,
		problem: "faster than real time"
	};
	if (result.steps + result.held > 21600) return {
		ok: false,
		problem: "too long"
	};
	return {
		ok: true,
		run: {
			steps: result.finishSteps,
			falls: result.falls,
			checkpoints: result.checkpoints,
			held: result.held,
			played: result.steps
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
const TOO_MANY = "That's a lot of rolling today! Have a break and come back tomorrow.";
function makeHandler(services) {
	const limiter = new RateLimiter(() => services.now());
	return async function handleMarble(request) {
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
		if (!body || typeof body !== "object") return reply(400, { error: "That couldn't be read." });
		const nowSeconds = Math.floor(services.now() / 1e3);
		if (body.action === "start") {
			const mode = body.mode;
			if (typeof body.course !== "string" || !courseById(body.course) || mode !== "up" && mode !== "down") return reply(400, { error: "That course couldn't be found." });
			const seed = makeMarbleSeed(nowSeconds, services.randomHex(12));
			const stamp = await services.stamp(marbleStampText(player, body.course, mode, seed));
			if (!stamp) return reply(500, { error: "The run couldn't start." });
			return reply(200, {
				seed,
				stamp
			});
		}
		if (body.action === "save") {
			const report = parseMarbleReport(body);
			if (!report) return reply(400, { error: "That run couldn't be read." });
			const expected = await services.stamp(marbleStampText(player, report.course, report.mode, report.seed));
			const problem = marbleSeedProblem(report.seed, nowSeconds) ?? (expected && sameText(expected, report.stamp) ? null : "bad stamp");
			if (problem) {
				console.warn(`marble: refused a run (${problem})`);
				return reply(400, { error: "That run couldn't be saved." });
			}
			const judged = judgeRun(report, nowSeconds);
			if (!judged.ok) {
				console.warn(`marble: refused a run (${judged.problem})`);
				return reply(400, { error: "That run couldn't be saved." });
			}
			const saved = await services.record(player, report, judged.run);
			if (!saved.ok) {
				if (saved.why === "too-many") return reply(429, { error: TOO_MANY });
				return saved.why === "refused" ? reply(400, { error: "That run couldn't be saved." }) : reply(503, { error: "We couldn't save your run just now." });
			}
			return reply(200, {
				result: saved.value,
				steps: judged.run.steps,
				falls: judged.run.falls
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
//#region supabase/functions/marble/entry.ts
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
/** Calls a database function. Logs say which one and the error code, never who. */
async function call(name, args) {
	const { data, error } = await admin.rpc(name, args);
	if (!error) return {
		ok: true,
		value: data
	};
	console.error(`marble: ${name} failed (${error.code ?? "unknown"})`);
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
	randomHex: (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join(""),
	stamp: stamper(key, "marble-run"),
	async userIdFor(token) {
		const { data, error } = await admin.auth.getUser(token);
		return error ? null : data.user?.id ?? null;
	},
	record: (player, report, run) => call("record_marble_run", {
		player,
		seed: report.seed,
		course: report.course,
		mode: report.mode,
		maths: false,
		steps: run.steps,
		falls: run.falls,
		checkpoints: run.checkpoints,
		held: run.held,
		inputs: report.inputs,
		daily_limit: 400
	})
}));
//#endregion
