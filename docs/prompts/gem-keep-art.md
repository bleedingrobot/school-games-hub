# Gem Keep, painted art: Crystal Night (branch `gem-keep-art`)

Reply to James in plain, simple words. Nothing goes live without James's yes in this session, one step at a time. Stages A to D are all local. Stage E is the only live part.

This is the same kind of job as Dragon Maths (`docs/prompts/lord-art-golive.md`, `scripts/lord-art.py`, `src/games/lord/art.ts`) and Maths Monsters (`docs/prompts/maths-monsters-art.md`). Copy their pattern instead of inventing a new one.

## Where things stand (27 Oct 2026)

**The game today.** Everything is drawn in code, with no picture files:
- `src/games/gem-keep/render/draw.ts` draws the ground (checkered grass, sandy road, rocks, water), the Keep, towers, gems, enemies, shots and particles on a canvas. Pictures that never change are already drawn once into a sprite cache (`sprite()`), and the ground is drawn once and kept.
- `src/games/gem-keep/render/shapes.ts` holds the gem colours and shapes (red triangle, blue circle, green hexagon, yellow star). `ui/GemIcon.tsx` draws the same shapes as SVG for the gem panel.
- `ui/CampaignMap.tsx` is the level list. The HUD, gem panel and question box are plain HTML in `gem-keep.css`.

**The look: Crystal Night (James, 27 Oct 2026).** Five looks were tried on level 1 (storybook, bright cartoon, crystal night, toy diorama, pixel). The comparison page is https://claude.ai/artifact/H82KUeLRdUybnFpLsdnKno and the try-outs are in `~/dragon-art-inbox/gem-keep-styles/`. James chose **Crystal Night**: twilight in an enchanted forest, where the gems are the light. **Keep the other four as references.** James wants later level packs in some of those themes (see "Later: level packs in other looks").

## The pictures (24)

| Pictures | How many | Notes |
|---|---|---|
| Level boards `board-level-1..10` | 10 | Ground only: grass, road, rocks, water, plants. No towers, Keep or monsters (those are pictures drawn on top). Painted over each level's own layout, so the road stays exactly on the path. |
| Towers `tower-1..3` | 3 | One per tower level. An empty crystal socket on top; the gem picture sits in it. |
| Gems `gem-red`, `gem-blue`, `gem-green`, `gem-yellow` | 4 | One per colour, **keeping its shape** for colour-blind players. Grade is shown in code (size, pips, brighter glow), not with 20 pictures. Mixed gems are drawn in code from these, as now. |
| Enemies `walker`, `runner`, `brute`, `swarm`, `boss` | 5 | Flipped in code to face where they walk. |
| `keep` | 1 | Drawn at the end of the first path, as now. |
| `campaign` | 1 | The 10-level world map; level markers are HTML placed on top. |

No painted buttons or panels: the HUD is restyled in CSS.

**Dusk to midnight.** The boards get darker as the campaign goes on: levels 1–3 at violet dusk, 4–7 at night, 8–10 at deep midnight with storms and frost. That keeps the gentle early levels bright and easy to read, and gives the campaign a journey. Level names stay as they are ("Sunny Meadow" is a meadow at golden dusk).

## Stage A: lock the look (no code) — in progress

Two tries each of every sprite and three tries of level 1's board, so James can confirm the look before the rest is made. Tools:
- `~/dragon-art-inbox/tools/gem-keep-base.py LEVEL_JSON OUT night-ground` draws a level's rough night base: dark grass, a lit road (so the painter keeps it), rocks and water.
- `~/dragon-art-inbox/tools/gem-keep-art.py OUT TRY [names] [board-denoise]` paints the boards (over `~/dragon-art-inbox/gem-keep-art/bases/base-<level>.png`) and the sprites (on plain dark navy, to be cut out).
- Output: `~/dragon-art-inbox/gem-keep-art/`.

What we learned in the try-outs: at night the painter drifts off the road when the base is bright and the strength is above about 0.8. A dark base with a lit road keeps it.

**First round done (27 Oct 2026).** Review page with every try and Claude's picks: https://claude.ai/artifact/4hSSPMhaNnCcecUN3qcWim (source `~/dragon-art-inbox/gem-keep-art/page/`). Picks so far: tower-1 try 4, tower-2 try 3, tower-3 try 4, keep 1, gem-red 2, gem-blue 1, gem-green 2, gem-yellow 1, walker 2, runner 2, brute 1, swarm 2 (cut one beetle out), boss 4. Waiting for James to confirm or swap.
- Boards: 0.72 kept the road exactly but looked plain. 0.75–0.78 looked richer but added boulders on grass tiles and lost a pond, because the words said "grey boulders". Next round: drop boulders from the board words and use about 0.74.
- Towers drew their own crystal in the socket when the words said "crystal socket". "An empty shallow stone bowl" fixed that, but put a tiny figure in the bowl (the gem covers it; reword).
- The ogre king came out bare-chested. Now he wears "a long royal purple tunic with gold trim that covers his chest and belly".
- Letter-like runes appeared on tower 3. "Swirl patterns" avoids them.

James approved all the first-round picks (27 Oct 2026).

**Second round done (27 Oct 2026).** All 10 boards painted at 0.74 with per-level words (no "boulders"), two tries each, chosen by road check (`~/dragon-art-inbox/tools/gem-keep-roadcheck.py`). Water is drawn bright in every base (`gem-keep-base.py`), so ponds stay on their tiles. Rocks come from a `rock` sprite the game draws on every rock tile, because the painter leaves rock tiles empty once boulders aren't named. The campaign map is painted with an empty trail; the game places the 10 markers (`CAMPAIGN_MARKERS` in `art.ts`). All picks are in `docs/gem-keep-art/picks.json`.
- Tower 1 and the rock are painted on pale lavender (`LIGHT_BACKGROUND` in the inbox script), because dark stone melts into a dark background.
- Cutting out: rembg gives the outline only (it blackens what it removes), stone sprites get their inside holes filled (`SOLID`), and stray specks are dropped so the trim is tight.
- The tiny figure still appears in glowing bowls and holes. The gem covers it on towers.

## Stage B: make the rest and tidy into WebP (`scripts/gem-keep-art.py`) — done

1. Boards 2–10: draw each night base (levels 6, 8, 9 and 10 have two paths; the base draws both), paint with the level's own words (frost for Frost Ridge, lightning clouds for Storm Peaks, castle walls for Gem Keep Castle), one try each, remake only the bad ones.
2. **Road check.** For each board, draw the real path and the rock and water tiles over the painting in a contact sheet. Repaint any board where the road, a rock or the water is off its tiles: building is allowed only on grass, so a painted rock on a grass tile would confuse students.
3. Sprites: cut out with rembg (`~/.cache/rembg-venv`), trimmed and saved at 256 px (enemies 192 px, Keep 320 px).
4. Boards: 1600 × 1000 and a 800 × 500 copy for phones. Campaign map 1600 wide and 800 wide.
5. Files go in `src/games/gem-keep/art/<group>/<name>.webp`. Budget: about 1.5 MB in all, loaded only when Gem Keep opens.

## Stage C: code (in `src/games/gem-keep/` only)

1. **`art.ts`**, copied from `src/games/lord/art.ts`: `import.meta.glob('./art/**/*.webp')`, one function per group. **Every picture is optional.** When a file is missing, the game draws today's code shape, so nothing breaks while pictures arrive.
2. **Ground:** `drawGround` draws the level's board when there is one (the 800 copy on small screens), otherwise today's grass.
3. **Towers, gems, enemies, Keep:** the picture goes through the existing sprite cache, so drawing stays cheap. Enemies face their walking direction, bob gently, and flash white for a moment when hit. Health bars, range rings, the selected tile, the keyboard cursor, and the slow and poison rings stay drawn in code so they stay crisp.
4. **Light, the heart of Crystal Night:**
   - a soft pool of light in the gem's colour under every tower with a gem, bigger and brighter by grade
   - shots with a short glowing trail, and a spark burst on hit in the gem's colours
   - frost shimmer on slowed enemies, green bubbles on poisoned ones, a gold flash on critical hits
   - the Keep's windows dim as its health drops, and the Keep shakes a little when hit
   - All glow is pre-drawn radial-gradient sprites drawn with `globalCompositeOperation = 'lighter'`. Never use `shadowBlur`, which is slow on Chromebooks.
   - Reduced motion: no shake, fewer particles, and steady (not pulsing) glows, using the engine's existing `reducedMotion`.
5. **Readable at night:** enemies get a thin pale rim and a dark ground shadow, so they stand out from the board. A **Brighter map** button in the game bar (remembered on the device) draws the board at dusk brightness, for projectors and bright rooms.
6. **Screens:** the game bar, gem panel, campaign map and win screen get night panels with gold edges inside `.gk` only. The hub has no dark mode, so nothing outside Gem Keep changes. The **maths question box stays big, plain and high-contrast**, because nothing should get in the way of the fact. The campaign map is the painting with the 10 level markers placed on it by percentage, locked and starred as now.
7. **Gem icons in the panel** use the gem pictures when present (`GemIcon.tsx`), with the shape still clear.

## Stage D: check it (local)

- `npm run typecheck`, `npm test`. Tests follow `docs/TESTING.md`: at most **one** new test (every file in `art/` is a name `art.ts` looks for, as Dragon Maths has), and don't raise `MAX_TESTS`.
- Browser screenshots at Chromebook (1366 × 768), iPad and phone sizes, of a running wave on levels 1, 6 and 10, with "Brighter map" on and off.
- Speed: steady 60 frames a second with 60 enemies on a Chromebook-class setting (CPU slowed 4× in Chromium).
- A kid-safety look at every picture: friendly monsters, nothing scary for 8-year-olds, no writing.
- Build the stand-alone preview (`npm run gem-keep:preview`) so James can try it before anything goes live.

## Stage E: go live (ask James before each step)

Front end only: no migration, no function. Push the branch, open a PR, merge on James's yes, check the Pages run, check the live site, and write a went-live note at the end of this file.

## Later: level packs in other looks

James wants more levels later in some of the other try-out themes. Make room for that now, cheaply:
- Boards are already per level. A later `theme` field in the level file (`"crystal"` by default) can pick a sprite set and the HUD skin, so a "Storybook Meadows" or "Toy Box" pack is new pictures plus new level files, not new code.
- The try-out prompts for all five looks are in `~/dragon-art-inbox/tools/gem-keep-styles.py`. The toy diorama look needs the tilted board (perspective-warped base) and tilt-aware drawing, so keep that one for a pack of its own.

## Making or remaking a picture

ComfyUI runs on James's gaming PC (`http://100.97.96.115:8188`, Z-Image Turbo). The scripts reuse the graph saved inside a Dragon Maths PNG, so only the words, sizes and seeds change. **Use only positive wording**: this model draws whatever a prompt names, even after "no".
