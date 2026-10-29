# Marble Rush: graphics upgrade plan

How to make Marble Rush look much better, without making it slower on school Chromebooks or changing how it plays.
Written 28 October 2026 for James, after reading the drawing code (`src/games/marble/renderer.ts`, `palette.ts`) and taking screenshots of the live preview.
**Status: the new look and scenery are LIVE on all 8 courses, 29 Oct 2026 (Boulder Beach and course cards PR #90, the other 7 courses PR #95, scenery G.4 after that).** Left: G.6 real-device check and How to play pictures.

## The short version

- **Today the game is plain on purpose.** Every course is a checkerboard of flat-coloured blocks floating on a one-colour sky. There is **no scenery at all**: Boulder Beach has no boulders, Geyser Valley no steam, Glacier Run no glacier. The marble is small and the light is flat, so slopes are hard to read.
- **The upgrade is drawing only.** The physics, the server replay, the saved runs and the medal times never look at the drawing code, so none of them change and no old run or ghost breaks. No database change.
- **Recommended look: a "toy diorama".** Keep the chunky low-poly blocks (they suit the isometric view and are clear for children), but give each course a little world: soft light and shadows, textured tops (sand ripples, tarmac, ice, scoria), scenery around and below the track, a painted sky and distant landscape for each place, and small effects (dust, splashes, steam, confetti at the finish).
- **Where the pictures come from:**
  1. **Code** for the light, the shading, the textured tops and the effects (no files to download).
  2. **Free 3D model packs** (Kenney and Quaternius, both CC0: free for anything, no credit needed) for scenery: rocks, trees, ferns, fences, cranes, signs. The site already uses Kenney art in Clan Quest.
  3. **ComfyUI on James's gaming PC** for the painted parts: one wide sky-and-landscape backdrop per course, and a picture on each course card in the picker. Same way as the Clan Quest pictures.
- **Three quality levels**, picked automatically: a slow Chromebook gets the simple version (no shadows, fewer props), an iPad or iMac gets everything. A student never has to choose, and the game drops a level by itself if it gets slow.
- **Six stages** (section 4). Stage G.1 (light and textures) is the biggest change for the least work, and can go live on its own.

## 1. What it looks like now (28 Oct 2026)

Screenshots: `/mnt/project-files/marble-art/now-boulder-beach.png` and `now-alpine-crossing.png`.

| Part | Now | What's weak |
|---|---|---|
| Track | Flat-coloured blocks in a two-tone checkerboard, one palette per course (`palette.ts`) | Looks like a test level. Slopes are only a slightly different shade, so they're hard to see |
| Walls and rails | Tall plain brown blocks | Heavy, the same on every course, hide the track at the top of the screen |
| Background | One flat colour (`palette.sky`) | Nothing says "beach", "glacier" or "volcano" |
| Scenery | None | The New Zealand places only exist in the names and the "Did you know?" cards |
| Light | One sun and a sky light, no shadows except a soft blob under the marble | Flat; heights and drops are hard to judge |
| Marble | Blue-and-white striped ball, a little shine | Small on screen and plain; the ghost and player 2 are plain spheres |
| Hazards | Simple shapes: cylinders for bumpers, a white column for geysers, white lines for wind | They work, but don't look like geysers, mud pots or wind |
| Effects | None (no dust, splash, sparkle, finish celebration) | Falling off and finishing feel the same as rolling |
| Page | School-red page and white bars around the game (the Douglas Park look) | Fine, but the game sits in a small box |

What's already good and stays: the clear isometric view, the readable answer signs, the patterns on ice, mud and belts so they don't rely on colour, the "less motion" setting, and the low-quality switch for slow devices.

## 2. The recommended look: a toy diorama

Think of each course as a **model railway layout of the real place**, seen from above at an angle. Bright, clean and chunky, so a child can always see where the edge is.

**For every course:**

- **Light:** a warm sun with real shadows on the bigger devices, and a soft "ambient occlusion" darkening where blocks meet walls, so every step and drop is easy to see.
- **Track tops with a pattern instead of a checkerboard:** made in code (a small texture drawn once on a canvas), so nothing extra to download. Edges get a thin lighter line so the drop-off is obvious. Slopes get faint arrows or stripes going downhill.
- **Lighter rails:** low posts and rope, driftwood, snow poles or steel barriers, so they don't hide the track.
- **The ground below:** the track sits on a little island of land (rock, sand, grass, water) that fades into the backdrop, instead of floating in empty sky.
- **Scenery** in the empty spaces around the track, never on it, so it can't be mistaken for a hazard.
- **A painted backdrop** behind everything, slowly moving as the camera follows the marble.
- **The marble:** a glassy marble with a swirl inside, a little bigger shine, and a short trail at high speed. The ghost gets a soft glow, player 2 a different swirl colour.
- **Effects:** sand or gravel puffs on landing, a splash and a "plop" when you fall into water, sparkles from a right gem, a door that swings open on a right answer, confetti and a medal pop at the finish.

**Each place:**

| Course | Scenery | Effects |
|---|---|---|
| Boulder Beach | The round Moeraki boulders (made in code: simple shapes with cracks), driftwood, waves lapping at the edge, seagulls | Sand puffs, splash |
| Crown Range Zig-Zag | Tussock, snow poles, a road sign or two (no real brand names), the Remarkables in the backdrop | Gravel puffs, snow on the high bends |
| Geyser Valley | Steaming pools, silica terraces, boardwalk rails | Real-looking geyser spouts, bubbling mud pots, drifting steam |
| Glacier Run | Ice blocks and crevasses at the top, rainforest ferns and rimu lower down | Ice sparkle, snow spray on turns |
| Windy Welly | The red cable car, wharf cranes, shipping containers, the harbour | Wind lines with blown leaves, seagulls struggling |
| Alpine Crossing | Volcanic rock, the Emerald Lakes glowing at the finish, steam vents (summits stay out of view, as the main plan says) | Scoria dust, steam |

The same care as section 3 of the main plan: no photos, logos or brand names, nothing silly happening to a maunga.

## 3. How it stays quick on school devices

Players are almost all on **iPads, Chromebooks and iMacs**. The Chromebooks are the limit: many have small built-in graphics chips.

- **Three levels, chosen for the student.** *Simple* (slow Chromebooks): no real shadows, fewer props, no backdrop movement. *Normal*: soft shadows, all scenery. *Best* (iPads, iMacs): sharper shadows, extra effects. The game starts on Normal, measures the frame rate for the first few seconds, and drops a level if it's slow (the existing low-quality switch already does a small version of this).
- **Draw everything in few pieces.** The track is already one big piece. Scenery is drawn with "instancing" (one rock shape drawn 200 times costs about the same as once), and textures are shared.
- **Small downloads.** Models are compressed (glTF with Draco or meshopt), backdrops are `.webp` at about 2048 px wide (and a 1024 px copy for the Simple level). Target: under **1.5 MB extra per course**, fetched only when that course is opened, and kept by the browser afterwards. Everything is optional: if a file fails to load, the course draws as it does today.
- **Battery and heat on iPads:** stop drawing when the run is paused or the tab is hidden, and cap the pixel ratio (already 1.5).
- **Check on real devices:** James plays a test page on a school Chromebook and an iPad before anything goes live. Claude also checks with a slowed-down browser in tests.

## 4. Stages

Each stage ends with tests passing, before-and-after screenshots for James (laptop and iPad sizes), and a try-out page (`npm run marble:preview`, the same as before). Each stage can go live by itself.

| Stage | What | Needs James? | Size |
|---|---|---|---|
| **G.1 Light and track** | Shadows, ambient darkening, patterned track tops per course, edge lines, slope stripes, lighter rails, the quality levels | A look at the screenshots | Medium |
| **G.2 The marble and effects** | Glass marble, trail, better ghost and player 2, dust and splash, gem sparkle, door opening, finish confetti, nicer geysers, mud pots and wind | A look | Medium |
| **G.3 Ground and backdrops** | The island of land under each course, and a painted backdrop per course from ComfyUI | Turn on ComfyUI; pick the backdrops on a picking page | Medium |
| **G.4 Scenery** | Props around each course, from the CC0 packs plus a few made in code (the boulders) | A look | Big (mostly placing things on 8 courses) |
| **G.5 Course picker** | A painted picture on each course card, and the medal times shown more clearly | Pick pictures | Small |
| **G.6 Finish** | Real-device check (Chromebook and iPad), credits line for the packs, How to play pictures updated, docs, go live | Play it on the devices | Small |

Rough order of effect: G.1 and G.2 change the feel the most; G.3 and G.4 give each place its character.

**Not in this plan (could come later):** marble skins earned by medals (needs saving, so it's its own small step; already in the main plan's "ideas for later"), music per course, and tilt controls.

## 5. Questions for James

Asked as question cards on 28 Oct 2026. Answers go here.

**James's answers (28 Oct 2026):** 1 toy diorama; 2 yes, ComfyUI backdrops and course pictures; 3 start with a try-out page of Boulder Beach (G.1 + G.2 on that one course), then the rest.

1. **Overall look:** toy diorama (recommended) / keep the plain blocks and only add light and effects / a painted look to match Dragon Maths and Clan Quest.
2. **Painted backdrops and course pictures from ComfyUI:** yes, made on the gaming PC like Clan Quest (recommended) / no, code and free packs only.
3. **Where to start:** G.1 + G.2 on Boulder Beach first as a try-out page, then the rest (recommended) / all six stages planned in full first.

## 6. Technical notes (for whoever builds it)

- All changes are in `src/games/marble/` (mainly `renderer.ts`, `palette.ts`, a new `scenery.ts` and an `art/` folder). Nothing in `shared/marble/` changes, so `npm run marble:determinism` and the medal times are untouched. Add a test that the renderer never imports from the engine anything but read-only helpers.
- Scenery positions are data per course (like `courses.ts`), placed only on void tiles (`.`) at least one tile from the track, checked by a test.
- three.js stays on the pinned version (0.186.0). Any extra loader (GLTFLoader, DRACOLoader or meshopt) comes from `three/examples/jsm`, so no new package.
- Shadows: one directional light shadow map that follows the camera (1024 px on Normal, 2048 on Best, off on Simple).
- The art goes through a tidy-up script like `scripts/clans-art.py` (resize, `.webp`), with an `art.test.ts` checking every course has what it needs and nothing is spare.
- Credits: Kenney and Quaternius are CC0, but add a thank-you line on the How to play screen, as Clan Quest does.

## 7. Results

**Boulder Beach try-out (G.1 + G.2, plus its G.3 backdrop), built 29 Oct 2026, not live yet.** Only Boulder Beach has the new look (`lookFor` in `src/games/marble/look.ts`); every other course draws exactly as before.

- **G.1:** warm sun with real shadows that follow the marble (`PCFSoftShadowMap`), corner darkening in the vertex colours, a sand texture drawn in code (`trackTextures.ts`) instead of the checkerboard, light edge strips where the track drops away, downhill chevrons on slopes, lower driftwood rails (0.45 high, same footprint as the physics walls), and a red-and-white buoy for bumpers.
- **Quality levels** (`quality.ts`): Simple / Normal / Best. ChromeOS or a low-density screen starts on Normal, iPads and iMacs on Best. The slow-frame check can drop a level twice (Best to Simple in about 5 s); skipping every other frame only happens on Simple.
- **G.2** (`fx/`): glassy swirl marble whose highlight doesn't roll, an orange one for player 2 and a glowing ghost, a trail at speed, and effects from `runEvents` (landing dust, fall splash, respawn sparkle, gem sparkle, finish confetti, door puff). One particle pool, capped per level. Reduced motion: fewer and gentler particles, no parallax.
- **Backdrop:** painted in ComfyUI on James's PC (6 tries; James picked "bay, softer"), `src/games/marble/art/boulder-beach.webp` (53 KB) and a small copy for Simple. Fitted without stretching, slightly softened so the track reads in front, with a small parallax.
- **Untouched:** nothing in `shared/` changed; `npm run marble:determinism` gives the same fingerprint (`47774b85`). All 5,498 tests pass.
- **Still to check on real devices:** the size and colour of the effects (software rendering here was too slow to catch the splash and confetti in a screenshot) and the frame rate on a school Chromebook.
- **Try-out page:** `npm run marble:single`, published for James.

**Went live 29 Oct 2026 (PR #90, Test and publish run 170 green).** Also in it, from James's feedback on the try-out: driftwood fence walls with log rails and posts (no see-through gaps), course cards with a painting for every course (picks: try 1 each, Windy Welly try 2; tries on branch `marble-art-inbox`), and a simpler picker: maths and Read time always on (the teacher's "Students choose" now works as On; only Off turns maths off), instructions moved to How to play, and a compact "Race a ghost" bar. No database or function change.

**Other 7 courses went live 29 Oct 2026 (PR #95).** Each place has its own track pattern and walls: Crown Range tarmac with concrete kerb, crash barrier and snow poles; Geyser Valley silica crust with boardwalk; Glacier Run snow with rounded snow banks (ice tiles unchanged); Windy Welly concrete with hazard kerb, steel rail and bollards; Alpine Crossing red scoria with volcanic rock blocks; Wide Hill grass with farm fence; Gap and Ice snow with a snowy fence. Textures are drawn in code (`trackTextures.ts`), looks are in `look.ts`. Boulder Beach is unchanged and physics untouched (fingerprint `47774b85`).

**Scenery (G.4) went live 29 Oct 2026.** James said to go straight to live without a try-out. The free model sites can't be reached from the build machine, so all 26 props are made in code (`props.ts`: Moeraki boulders, driftwood, tussock, road signs, hot pools, silica terraces, mud pots, steam vents, ice blocks, ponga ferns, rimu, snowy pines, containers, cranes, a cable car, buoys, volcanic rock, the Emerald Lakes, trees, hay bales, sheep and flowers). They stand on small islands of land in the empty space beside the track, always with at least one empty tile between an island and the track (`scenery.ts`, checked by tests), a little lower than the track. One instanced mesh per kind keeps it to a couple of dozen draw calls; Simple quality shows only the most important props and no steam. Gulls circle, buoys bob, ferns and grass sway, and the pools and vents steam (all calmer with reduced motion). No credits line is needed, as no packs were used.
