# Star Trader: build your own solar system (brainstorm plan)

The new end game for Star Trader. Today the big goal is one button: save 20,000 credits and **buy your moon**. This plan turns that into **building your own solar system**: pupils pick their sun, their planets, how the planets look, what lives on them and what technology they build. Then they can watch it all in full screen, painted to a high standard and moving.

Written 3 November 2026 for James. **Status (4 Nov 2026): LIVE and switched on for every class.** Merged in PR #187 (with Choose your captain); migration `20261103000300_trader_forge.sql` applied and the trader function deployed by Test and publish on 4 Nov, 6:24 pm. Every class's `trader_forge` set on the same evening, and new classes start on (`20261104001200_trader_forge_on.sql`). The 14 weak planet maps were repainted and committed before going live. Not started: the New Season picture upload, achievements and points, more silly pieces.

## The short version

- **Dream it from day 1, build it with credits.** The **Star Forge** opens on the first day. Pupils can design their system for free, as a "plan", and see it in full screen as a ghostly hologram. Each piece is then **built for real with credits from trading**, and turns from hologram to solid. The goal is on screen from the start, and every trip earns towards a piece they chose.
- **Claim a star first.** The first purchase is your **sun** (about 3,000 credits, week 1 to 2), so almost every pupil owns something by the end of week 2. The moon stays as one of the pieces, and the Moon Owners list becomes the **Star Makers** list.
- **Thousands of different systems from a set of paintings.** Every surface, sun, ring and nebula is painted in ComfyUI on the gaming PC. The game then tints, mixes, layers and lights them in 3D, so 150 or so paintings make far more looks than any class could use up.
- **Real 3D in full screen** with three.js (already in the project for Marble Rush and the mine): glowing suns, atmospheres, clouds that drift, rings that throw shadows, city lights on the night side, auroras, asteroid belts, comets and a black hole that bends the starlight behind it.
- **Three graphics levels**, chosen automatically: *Incredible* (gaming PC, good laptop, classroom projector), *Normal* (Chromebook) and *Simple* (the painted 2D globes Star Trader already has).
- **Show it off:** a class gallery, visiting a classmate's system, and a **projector tour** for the teacher that flies through every system in the class.
- **Light science built in:** the Goldilocks zone, plant colour that changes with the sun, gas giants with no ground to stand on. It nudges, never blocks.

## 1. How it fits the game

### 1.1 The goal over a season

Today a pupil playing 4 days a week buys the moon around day 16 to 25 of a 35-day season, so a new end game that only opens *after* the moon would hardly be used. So the system **is** the goal, in steps:

| Step | Rough price | When a typical pupil gets there | What it feels like |
|---|---|---|---|
| Claim your star (the sun) | 3,000 | Week 1–2 | "I own a star!" The Forge goes from hologram to real |
| First planet | 2,000–4,000 | Week 2 | Picks a world type and look |
| Life on a planet | 1,500–5,000 | Week 2–3 | Microbes are cheap, a city is dear |
| More planets, moons, rings | 1,000–6,000 each | Week 3–5 | The system fills up |
| Big technology (Dyson ring, star gate, orbital ring) | 10,000–20,000 | Week 5 and later | The showpiece for keen traders |

- A **full system** (sun, 4 planets, life on 2 of them, one big piece of technology) costs about the old moon price and a bit more, so keen pupils still have something to aim at in week 5.
- Prices are numbers in `shared/trader/config.ts`, checked with the simulator (`npm run trader:sim`) as the moon was. The simulator's target: 90% of pupils who play 3 days a week own a star by day 14; the median pupil has a sun, 3 planets and life by day 35.
- **Nothing to do with credits once you're done?** There is always something dearer to add (a second sun, a ring world, a star gate). Gets checked in the simulator so credits don't pile up unused (guide section 1a, "Rewards and coins").

### 1.2 What happens at a New Season

**The pupil chooses (James, 3 Nov 2026).** At the start of a new season each pupil who built a system gets a choice screen:

| Choice | The system | Ship and credits | Kept for good |
|---|---|---|---|
| **🌌 Keep my solar system** | Stays, and they carry on adding to it | Reset to the start (a Flea and 100 credits) | The system itself |
| **📸 Save a picture and start a new one** | A full-screen picture of it is saved to their **profile page**, then the system is cleared and they design a new one | **Kept**: they start the season with the ship and credits they ended on | The picture on their profile (and any earlier ones, as a little album) |

- Both are fair trades: keep the thing you built, or keep your trading riches and build something new. Bolt explains it in two lines with the numbers ("Keep your system, or keep your Beetle and 8,400 credits").
- **Until they choose**, nothing changes and they can't trade, so nobody loses anything by accident. Pupils who never built a system just start fresh as now.
- **The picture** is taken by the viewer itself (the photo-mode shot from section 5.1, at a set nice angle unless they pick their own), saved as a `.webp` of about 1600 × 900, under 300 KB. The profile page shows the latest one large and older ones small, with the system's name and the season.
- **Credits carried over could make a season too easy** for that pupil. Simulator check in S.1; if needed, carry over a share or a cap (say, up to 10,000 credits), set in `config.ts`.
- **The profile page is shared hub code**, not Star Trader's, so adding the picture album is its own small step on its own branch with James's OK (guide section 3).
- Each season can also add a new "era" of pieces (section 9). The Star Makers list is per season, so a newcomer can still be on this season's list.

### 1.3 Points and achievements

Inside the shared 40-a-day cap, `ranked: false`, as now. Right answers never earn points (hub rule).

| Achievement | In pupil words | Measure | Who gets it | Kept after New Season |
|---|---|---|---|---|
| Star Maker | Claim your own star | owns a sun | most pupils, week 1–2 | yes |
| World Builder | Build 3 planets | planets ≥ 3 | about two thirds | yes |
| Spark of Life | Put life on a planet | life ≥ 1 | most | yes |
| Goldilocks | Put life on a planet in the "just right" zone | life in the zone ≥ 1 | about half | yes |
| Moon Owner | Buy a moon (kept from today) | moons ≥ 1 | most | yes |
| Engineer | Build a big piece of technology | tech tier 3 ≥ 1 | about a quarter | yes |
| Wonder of the Galaxy | A full system: sun, 5 planets, 3 with life, 1 big technology | as it says | keen traders | yes |

Points: 10 for claiming your star (replaces 10 for the moon), 3 for each planet or life, 5 for big technology.

## 2. The Star Forge (where pupils design)

A new tab beside Market, Ship and Bank: **🌟 Forge**. Built in the same dark panels as the rest of Star Trader.

### 2.1 The screen

- **Big view on top:** their system in live 3D, slowly turning. Tap a planet to fly to it.
- **Underneath, a row of slots:** Sun, then planet 1, 2, 3 … in order from the sun, then extras (belt, comet, nebula). Each slot is a card: empty (+), **planned** (hologram, with its price), or **built** (solid).
- **Pick a slot → choose its pieces** in a few simple steps with big picture buttons (section 3): type, look, effects, life, technology. Every choice shows on the 3D view straight away.
- **"Build it" button** with the price and "You need 1,200 more" when they can't afford it, the same wording as the moon card today.
- **Full screen button** (section 5).

### 2.2 Planning is free, building costs

- Changing a *planned* piece is free and unlimited. Kids can redesign all week.
- A piece shows in the picker only once the pupil has enough credits for it (James, 4 Nov). A line under each set of choices says how many more appear as they earn credits, and a piece already picked always stays.
- Once **built**, changing the look of a piece is cheap (a tenth of its price: "repaint"), and removing it gives half back. Kept simple so a pupil can't wreck their own savings by accident: removing asks "Are you sure?" and shows what they get back.
- The server checks every build against the shared rules (as every move is checked now: `shared/trader/server.ts`), so the browser can't give itself free planets.

### 2.3 Naming things, safely

No free typing. Names are put together from two word lists, as Maths Monsters does: *"Zephyr" + "Prime"*, *"Nova" + "Nine"*. About 60 × 40 parts, checked by James once. The sun and every planet can be named; the system is named "the [Name] System".

### 2.4 Bolt helps

Bolt, the ship's robot (`docs/TRADER-HINTS-PLAN.md`), gets Forge lines: the next-step line ("Your star needs 600 more credits. Sell your Medicine at Titan."), a first-time tour of the Forge, and short science tips (section 4). Help levels Lots / Some / Off work here too.

## 3. What you can choose

Each list is a starting menu. Every piece has a price, a painting (or several), and a line or two of what makes it special. Look and effects are mixed freely.

### 3.1 Suns

| Sun | Look in the viewer | What it changes |
|---|---|---|
| **Yellow star** (like ours) | Warm white-gold, boiling surface, soft corona | The normal choice; Goldilocks zone in the middle |
| **Red dwarf** | Deep orange-red, big dark spots, slow flares | Zone very close in; plants turn **black or dark purple** |
| **Blue giant** | Huge, blinding blue-white, long corona streamers | Zone far out; plants turn **red or orange**; fierce light on every planet |
| **White dwarf** | Tiny, hard white point with a glowing shell of old gas | Small zone; a "ghost of a star" story |
| **Pulsar** | Spinning star with two light beams sweeping round | Beams light up planets as they pass; no life without a shield |
| **Two suns** (binary) | Two stars circling each other, two shadows on every planet | Double sunsets; dearer |
| **Black hole** | Black disc with a glowing, swirling ring; the stars behind bend round it | No zone at all: life needs technology (section 3.5). The showpiece |
| **Baby star** | Glowing in a cloud of dust and gas, sparkling | A young system; rocks still forming |

Sun colour lights everything in the system, so a planet looks different under a red sun than a blue one. That is free variety, and it's real science.

### 3.2 Planet types

Rocky, **ocean**, **desert**, **ice**, **lava**, **jungle**, **gas giant**, **ice giant**, **crystal**, **toxic swamp**, **eyeball world** (one side always day, one always night, a ring of life between), **shattered world** (a planet in pieces, slowly drifting), **ring world** (a huge built band round the sun, very dear, tier 3 technology), and two silly ones kids will love: **cube planet** and **donut planet** (a real idea scientists have worked out could exist).

Each type has a size (small, medium, large, huge) and a place (its slot from the sun).

### 3.3 How a planet looks: surface, sky and effects

- **Surface:** 3 to 4 painted maps per type, then a **colour shift** (the game tints the painting: a blue desert, a pink ice world). With 3 maps × 8 tints per type there are about 24 surfaces per type before effects.
- **Clouds:** none, thin, thick, swirling storms, a giant storm spot (like Jupiter's). Clouds turn a bit faster than the ground.
- **Atmosphere glow:** colour and thickness (a thin blue rim like Earth, a thick orange haze like Titan).
- **Rings:** none, dusty, icy, glittering crystal, rainbow, double rings, tilted. Rings throw a shadow on the planet, and the planet throws one on the rings.
- **Moons:** 0 to 3 small moons, each its own painted look. Your bought moon is one of these, and can be put round any planet.
- **Effects (pick up to 2 or 3, dearer ones cost more):**
  - Auroras (green and pink curtains at the poles)
  - Lightning flickering in the clouds
  - Volcanoes glowing on the night side
  - Ice geysers spraying from the south pole (like Enceladus)
  - Meteor showers burning in the sky
  - Glowing oceans at night (living light)
  - Floating islands (a fantasy pick)
  - Night-time city lights (from life with cities)
  - Tail of dust like a comet (a planet too close to its sun)

### 3.4 Life

Life is put on one planet at a time. It changes what you see from space, and each kind gets a painted **postcard**: a close-up picture of the surface as if you landed there.

| Life | From space you see | Postcard | Price |
|---|---|---|---|
| Microbes | Faint coloured patches in the seas | Glowing slime in a rock pool | Cheap |
| Plants and forests | Green (or red, or purple, by the sun) spreading over the land | A forest under your sun | Cheap–medium |
| Sea creatures | Patterns moving under the water; glowing seas at night | Giant creatures under the waves | Medium |
| Land animals | Herds as moving specks when you zoom right in | A plain of strange beasts | Medium |
| Sky floaters (gas giants only) | Drifting jellyfish shapes in the cloud bands | Huge floating jellies in pink clouds | Medium |
| Crystal beings (crystal worlds only) | The crystals pulse with light | Walking crystal shapes | Dear |
| Robots | Neat lines of light, solar fields | A shining robot town | Dear |
| Cities (a civilisation) | City lights on the night side, satellites | A busy city with ships taking off | Dear |

Children love creatures. Each creature-type life lets them pick one of several painted creatures for the postcard (cute, strange, giant), and the plan doesn't need body-part mixing for version 1.

### 3.5 Technology

Three tiers. Tier 3 is what keen traders save for.

| Tier | Pieces |
|---|---|
| 1 (cheap) | Satellites orbiting, a moon base with lights, a space station, trade ships flying between your planets on glowing lanes, a big telescope |
| 2 | Space elevator (a thread from the ground to a station), domes that let life live outside the Goldilocks zone, asteroid miners in the belt, solar sail ships, a terraformer that slowly turns a planet greener |
| 3 (showpiece) | **Dyson ring** (a band of solar panels round the sun), **orbital ring** round a planet, **star gate** (a glowing ring with a swirling portal), **ring world**, **planet engine** (a giant engine that pushes the planet: a blue flame trail) |

Big pieces are 3D shapes built in code with painted textures (section 6.3). Small ones are painted cut-outs that always face the camera.

### 3.6 Extras for the whole system

- **Asteroid belt** (rocky, icy or golden): thousands of tumbling rocks.
- **Comets** with a glowing tail that always points away from the sun.
- **Background:** the nebula and stars behind the system, 6 to 8 painted skies (purple nebula, the Milky Way edge-on, a galaxy close by, deep dark sky with a few bright stars).
- **Music:** pick a soundtrack for your system from 4 or 5 calm space tracks (if the hub has the music; otherwise later).

## 4. Light science (nudges, never blocks)

Put in gently, with Bolt saying it in a sentence and nothing ever refused for being "wrong":

- **The Goldilocks zone:** a soft green band in the Forge view shows where water stays liquid. Life outside it is allowed only with domes (tier 2). Life inside it is cheaper. The Goldilocks achievement rewards it.
- **The sun decides the plants' colour** (red dwarf: dark plants; blue giant: red plants), done automatically. Bolt: "Plants here are nearly black, to catch every bit of your red sun's light."
- **Gas giants have no ground:** only sky floaters live there.
- **Planets near the sun go round faster.** The viewer runs the real rule (Kepler's third law, simplified), so inner planets zip round and outer ones crawl.
- **Facts cards** for each sun and planet type, written like the ones in `shared/space/facts.ts`.

## 5. The full-screen viewer

The part that has to look incredible. A button **"View in full screen"** in the Forge, in the gallery and on the after-the-build celebration.

### 5.1 What you can do

- **Free look:** drag to turn, pinch or scroll to zoom, tap a planet to fly to it smoothly. Keys: arrows, + and −, Esc.
- **Cinematic tour:** a gentle camera flies round the system by itself: a wide shot, then swings past each planet close up, through the rings, along an asteroid belt, ending on the sun. 60 to 90 seconds, then loops. Great on a projector.
- **Time speed:** pause, normal, fast (planets race round their orbits).
- **Planet close-up:** clouds drifting, night side lights, the postcard button ("Land here").
- **Photo mode:** hide the buttons, pick an angle, press 📷 to save a picture to the Chromebook (a normal save, the picture of their own system).
- **Labels on/off:** the names they gave.

### 5.2 How it's drawn (three.js, WebGL)

- **Suns:** a sphere with an animated "boiling" surface (the painted sun map moved with noise), an outer corona drawn as glowing layers, and **bloom** so the light spills into the black. Sun flares now and then. Lens flare and a soft glare when the camera looks at the sun.
- **Planets:** a sphere with the painted surface map, plus a **bump (normal) map** made from it so mountains and craters catch the light. The sun is the only light, so the day/night line is real. A separate cloud sphere a little bigger, turning faster, throwing soft shadows.
- **Atmosphere:** a glowing rim shader (bright at the edge, coloured by the chosen sky), brighter on the side facing the sun, red-orange at the sunset edge.
- **Night side:** city lights and glowing lava from an "emissive" map that only shows in the dark.
- **Rings:** a flat ring with a painted strip, see-through, with real shadows both ways.
- **Oceans:** shiny where the sun reflects on them (a moving glint), dull on land.
- **Auroras, lightning, geysers, meteors:** small shaders and particles.
- **Asteroid belts:** thousands of rocks drawn in one go (`InstancedMesh`), each tumbling.
- **Comets:** a particle tail pointing away from the sun.
- **Black hole:** a screen effect that bends the stars behind it (gravitational lensing), with a hot spinning disc of light round it. The coolest single thing in the plan.
- **Background:** a painted all-round sky (a 360° panorama) plus a layer of real twinkling stars.
- **Finish:** film-style colour (ACES tone mapping), bloom, a soft vignette, a slight film grain in Incredible mode.
- **Hologram look** for planned pieces: see-through blue lines and a scan glow, so it's obvious what is still a plan.

### 5.3 Graphics levels

Picked automatically by timing the first few seconds (as Star Trader's "Simpler graphics" does today), with a setting to change it.

| | Incredible | Normal (Chromebook) | Simple |
|---|---|---|---|
| Who | Gaming PC, good laptops, the teacher's projector PC | School Chromebooks | Very slow devices, reduced motion |
| Paintings | 4096 × 2048 | 1024 × 512 | 512 × 256 |
| Bloom, film finish | Full | Half size, light | None |
| Shadows | Rings and clouds | Rings only | None |
| Asteroids | 20,000 | 3,000 | Painted strip |
| Black hole bending | Full | Simpler version | Still picture |
| Frames | Up to 60 (or 120 on fast screens) | 30 | The 2D painted globes from `globe.ts` |
| Pixel ratio | Screen's own | 1.5 at most | 1 |

- **Big paintings load only in full screen on Incredible**, so a Chromebook never downloads them. Everything is `.webp`, as now.
- Reduced motion: no camera flights; planets still, with a play button.

## 6. The paintings (ComfyUI on the gaming PC)

Same pipeline as `docs/TRADER-ART-PLAN.md`: James's PC paints, Claude checks each one for child safety and quality, remakes the bad ones, shows James a review page. The art style stays **Cinematic**, so the systems match the planets kids already know from the game.

### 6.1 What gets painted

| Group | How many | Size painted | Notes |
|---|---|---|---|
| Planet surface maps | about 60 (15 types × 4) | 4096 × 2048, seamless | Flat maps wrapped round a ball, edges blended (the script already does this) |
| Height maps for bumps | the same 60 | from each surface | Made automatically from each surface with a depth model in ComfyUI (Depth Anything), then turned into normal maps by the script |
| Night maps (city lights, lava) | about 10 | 4096 × 2048 | Black with lights |
| Cloud maps | 8 | 4096 × 2048 | White on black, see-through in the game |
| Sun surfaces | 8 | 2048 × 1024 | One per sun type, animated in code |
| Ring strips | 6 | 2048 × 64 | One line from inside to outside |
| Moon surfaces | 8 | 2048 × 1024 | |
| Skies (360°) | 6–8 | 8192 × 4096 | Seamless panoramas; the biggest paintings |
| Life postcards | about 40 | 2016 × 1152 | Each life type × 3–5 looks, painted for different planet types |
| Technology textures and cut-outs | about 20 | various | Station, satellites, ships, panels, the star gate swirl |
| Forge buttons | about 80 small | 512 × 512 | A picture on every choice button |

**About 300 paintings**, mostly small. The planets and skies are the ones that matter. Painted in stages so each part can go live by itself.

### 6.2 Making a few paintings go a long way

- **Tint:** the game shifts the colours of a painting (a sliders-free "colour" choice of 8 swatches), so one desert map is also a red, white, blue and green desert.
- **Mix:** surface + clouds + atmosphere colour + rings + effects + sun colour are chosen separately, so the combinations run into the millions.
- **Light:** the same map looks completely different under a red dwarf and a blue giant.

### 6.3 Big technology

Built as 3D shapes in code (a ring of panels, a station, a gate) with painted metal and light textures, because it has to be seen from every side as the camera flies round.

### 6.4 Something extra: a painted portrait of your system (later, optional)

Once a pupil's system is built, the gaming PC could paint a **one-off portrait** of it overnight: a cinematic picture made from their choices ("a jungle world with purple plants under a red dwarf, with rings and a space elevator"). Their own painting, nobody else's.

- **Safe by design:** the prompt is made only from their pick-list choices, never typed words. Claude checks each picture before it goes to the pupil.
- **Overnight queue:** builds since yesterday are painted at night when the PC is free. If the PC is off, they wait for the next night.
- Needs a small queue table and a script on the PC. Its own stage at the end (S.9), only if James wants it.

## 7. Sharing

- **Class gallery:** a grid of every classmate's system (a small still picture of each). Tap one to visit it in the viewer (look only).
- **Stickers, not comments:** visitors can leave one of 6 preset stickers (🌟 Wow, 🪐 Cool planets, 👽 Love the life, 🚀 Great tech, 🌈 Pretty, 🤯 Amazing). Count shown to the owner, no names. No typing.
- **Classmates only**, never other schools (hub rule).
- **Projector tour (teacher):** on the Teacher page, "Show the class's systems" flies through each pupil's system in turn in full screen, with their system's name. Great for the last day of a season. The teacher can skip any.
- **Star Makers list** replaces Moon Owners: each season, who claimed a star, kept for good.

## 8. Maths

Kept optional and inside the existing switch (`trader_maths` off / choose / on), the same way questions work now (guide section 4). Right answers never earn points.

- **Budget:** "You have 4,350 credits. The ice world is 2,800 and its rings are 900. How much is left?" when building.
- **How many trips?** Bolt's next-step line can say "That's about 3 good trips" and ask the pupil first, now and then.
- **Order and distance:** placing planets by distance from the sun; reading orbit sizes.
- **Comparing sizes:** "Your gas giant is 11 times as wide as your rocky world."
- **Orbit times:** in the facts card, "Your outer world takes 8 of your inner world's years to go round once."

## 9. Seasons and new pieces

Because systems are kept (section 1.2), each new season can bring an **era** with new pieces, so returning pupils have something new to save for: e.g. season 2 "The Age of Life" (more creatures), season 3 "Wonders" (more big technology), season 4 "Strange Space" (wormholes, rogue planets, a purple sun). Each era is just more paintings and catalogue lines, no new systems.

## 10. Server and data

- **`shared/trader/system.ts`:** the catalogue (every piece, its price, its rules), and pure functions: `planSystem`, `buildPiece`, `repaint`, `removePiece`, `describeSystem` (the sentence for screen readers) and the Goldilocks zone. Tested on many seeds, as the rest of `shared/trader/`.
- **New moves** in `shared/trader/server.ts`: `{ type: 'build', slot, piece }`, `repaint`, `remove`. The plan (free) is saved too, with a size limit.
- **New table `trader_systems`**: one row per pupil (`player`, `school_id`, `design` as JSON with a version number, `built_at`), not cleared by New Season: the pupil's choice (section 1.2) clears or keeps it. `trader_carry` holds the ship and credits waiting for a pupil who picked "start a new one", and `trader_system_pictures` (player, season, system name, picture path) holds the saved pictures for the profile page. The season hook (`season_fn`) only marks each system "choice needed". Row security on, no direct pupil access, as the other trader tables. `trader_stickers` for the gallery (player, visitor, sticker, season; one each).
- **The moon:** `t.moon` and `trader_moons` stay; owning a moon becomes one piece of the system, and existing Moon Owners get their moon in their system automatically.
- A new migration with the next free number (guide section 3). Trader function redeployed; ask James before deploying (as always).
- **Gallery pictures:** a small still picture of each system, drawn by the pupil's own browser after a build and saved (a 512 × 288 `.webp`, under 40 KB), so the gallery never has to draw 30 systems in 3D at once.

## 11. Accessibility and phones

- Every piece has words: the screen reader hears "The Zephyr System: a blue giant with 4 planets. Nova Prime, an ocean world with rings and sea creatures, …" (`describeSystem`).
- The Forge works with keyboard only; the viewer's camera works with arrow keys.
- Reduced motion: no camera flights, no spinning, still planets.
- Phone width (844 × 390): the Forge goes to one column; full screen works on phones too.
- Contrast 4.5:1 on all Forge panels (the existing dark panels already pass).

## 12. Stages

Each stage on its own branch from `main` (guide section 6), tests passing, screenshots at laptop and phone width, James looks where marked. The Forge stays behind a switch (`trader_forge`, off) until S.7.

| Stage | What | Who | James looks? |
|---|---|---|---|
| **S.0 Style tries** | Paint 3 tries of one system in full screen (a lush system under a yellow sun, a strange one round a black hole, an icy one round a blue giant) on the gaming PC, as still pictures and a short turntable | Claude + gaming PC | **Yes: pick the look** |
| **S.1 Catalogue and rules** | `shared/trader/system.ts`, the catalogue, prices, Goldilocks zone, tests. Simulator updated: star by day 14 for most pupils | Claude | Prices table |
| **S.2 Viewer first try** | The three.js viewer with code-drawn stand-ins: suns, planets, atmosphere, rings, bloom, the three graphics levels. Speed check on a slow-Chromebook setting | Claude | **Yes: try it on the gaming PC and a Chromebook** |
| **S.3 First paintings** | Planet maps, clouds, suns, skies, rings (about 120); normal maps made by script; review page | Claude + gaming PC | **Yes: review page** |
| **S.4 The Forge** | The Forge tab, slots, picture buttons, hologram plans, naming from word lists, live 3D preview | Claude | **Yes** |
| **S.5 Server and saving** | Migration, moves, `trader_systems`, building with credits, moon carried over, the New Season choice screen (keep, or picture + carry ship and credits). Preview only. The profile-page album is a separate small step on its own branch | Claude | Ask before deploying |
| **S.6 Life, technology, effects** | Postcards, creatures, tier 1–3 tech, auroras, geysers, comets, belts, the black hole | Claude + gaming PC | **Yes** |
| **S.7 Bolt, maths, achievements, go live** | Forge tour, next-step lines, science tips, budget questions, achievements, Star Makers list. Switch on for one class first | Claude | **Yes: guided first go** |
| **S.8 Sharing** ✅ built 4 Nov | Gallery, stickers, teacher's projector tour, photo mode. Pictures in the private bucket `trader-gallery`, saved through the trader function at most every 5 minutes; stickers in `trader_stickers`; all in the on-hold migration | Claude | Yes: review page |
| **S.9 Painted portraits (optional)** | Overnight portraits of each pupil's system on the gaming PC | Claude + gaming PC | Only if wanted |

S.0 and S.1 can run side by side. S.2 is the riskiest (does it look incredible *and* run on a Chromebook?), so it comes before most of the painting.

## 13. Questions for James

1. ~~Keep or clear at a New Season?~~ **Decided (3 Nov):** the pupil chooses: keep the system and reset the ship and credits, or save a picture to their profile, clear it, and keep the ship and credits (section 1.2). **Credits (4 Nov):** all of them carry over, up to a cap.
2. ~~First step~~ **Decided (4 Nov):** claim your star at about 3,000 credits.
3. ~~Free planning?~~ **Decided (4 Nov):** pieces show only once the pupil can afford them, with a line saying how many more appear as they earn credits. A piece already picked stays. Planning what they can see is still free.
4. ~~Silly pieces?~~ **Decided (4 Nov):** keep them, as many as possible. More silly pieces are welcome later.
5. ~~Painted portraits?~~ **Decided (4 Nov):** yes, later.
6. ~~Stickers?~~ **Decided (4 Nov):** stickers from a fixed set of friendly ones, no typing.
