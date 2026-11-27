# Maths Monsters puzzles: "make them look MUCH better" (art + presentation plan)

*Written 28 Nov 2026 NZ for James ("can we make the mini games look MUCH better! we can paint new art, but just plan it at
the moment please"), after he played Stepping stones and found it plain. **Status: PLAN ONLY, nothing built, nothing painted.***

Plan page with before shots and mock-ups: https://claude.ai/artifact/VBPqyi7NVA2CSpDBD1b7zV . Shots and mock-ups are in project
files `monsters-puzzles/` (before-*.png, mock-*.png at 1366x768 and 390x844).

Not in scope (other threads own them): the puzzle **words** (`says`, `hint`, `clues` in `shared/monsters/quests/puzzles.ts`
are being rewritten by the Maths Monsters text thread; do not edit them), and the Space hot key thread. The puzzle **rules**
(`shared/monsters/quests/puzzles.ts` functions) stay as they are: this is a look-only upgrade.

---

## 1. What is there now (checked in the code, 28 Nov 2026)

- Screen: `src/games/monsters/world/PuzzlePage.tsx`, opened from the map via `MapMenu` (page `puzzle`) inside the normal
  menu sheet (dark bar with the title and Close, white page). Styles: `.mz-*` in `src/games/monsters/world/world.css`.
- Rules + data: `shared/monsters/quests/puzzles.ts`. Nine puzzles, six kinds:

| id | kind | area (scene) | person | prize |
|---|---|---|---|---|
| kauri-seeds | pods (on the map, no screen) | kauri-bush | hermit | 3 leaf bits |
| shell-stones | stones, 3s | shell-beach | diver-ngaio | 3 water bits |
| fire-lanterns | lanterns, 3s | fire-mountain | firefighter-kate | 3 fire bits |
| snow-slide | slide (ice) | snowy-peaks | ranger-fern | 3 ice bits |
| cave-count | lock (glowworm counts 4-7-2) | glowworm-caves | glow-gran | 3 spark bits |
| wharf-crates | crates (push puzzle) | harbour-city | dock-worker-sione | 3 stone bits |
| lagoon-stones | stones, 4s | lagoon-isle | swimmer-aroha | water egg |
| aurora-slide | slide (ice, night) | aurora-hollow | skier-jo | cold egg |
| steam-lock | lock (word clues) | steam-valley | geyser-gus | warm egg |

  (The person column is my pick for the speech bubble face; check `src/games/monsters/art/painted/people/` and swap if a
  puzzle's story names someone else.)
- Art now: ten 128 px tiles/sprites in `src/games/monsters/world/assets/puzzles/` (stone, pool, ice, rock, chest, crate,
  wharf, wall, lantern, lantern-lit) from `scripts/monsters-puzzle-art.py`. They are drawn tiny on a white page.
- Why it looks plain: white page with one thin strip; stones spread over the full width with big gaps; numbers in small
  dark text on grey; the far bank is four yellow boxes with a 🏁 emoji; the player is a 🧒 emoji; arrow buttons are plain
  page buttons; nothing moves (no hop, no splash, no slide, no flame); "You solved it!" is a line of blue text; the glowworm
  clue is a line of ✦ characters; the prize is never shown.

## 2. The idea in one line

Each puzzle becomes a **little painted scene**: the area's battle backdrop full-bleed behind it, a chunky title plank, the
area's person saying the instructions in a speech bubble, a big painted board in the middle, the pupil's **own walker** as the
player, real movement (hop, splash, slide, push, flicker, roll), and a **prize card** at the end that shows what they won.

Most of that needs **no new painting**: the 15 area scenes (`art/painted/scenes/*.webp`, 1600x900 + 800 px copies), 50+
people portraits, 312 walker sprites (4 directions, the pupil's chosen look via `walkerPic(look, dir)`), egg and badge
pictures are all painted already. New painting is only for the board pieces (section 5).

## 3. Shared puzzle stage (P1, code only)

Replace the menu-sheet look for `page === 'puzzle'` with a full-screen stage (still a dialog: Close and Escape work the same,
focus goes to the board).

- **Backdrop**: the area scene for the puzzle (`scenes/<area>.webp`, 800 copy on phones), `background-size: cover`, with a
  dark top and bottom gradient so the text stays readable. Add `scene` to each puzzle (a field in a new look table in
  `src/games/monsters/world/puzzleLook.ts`, not in `shared/…/puzzles.ts`, so the text thread's file is untouched).
- **Title plank**: wooden plank (stone for the lantern and stone doors, ice for the slides), CSS now, painted plank later
  (optional, section 5). Round ✕ Close button top right (keep the word "Close" as its accessible name).
- **Tries pips**: three dots top right that fill as tries go up (`tries` is already reported). At 3 the **Show me** button
  appears (purple, 💡), and tapping it opens the hint in the speech bubble instead of a yellow box under the board.
- **Speech bubble**: the person's round portrait + `says` text in a cream bubble. Same words as now.
- **Player**: the pupil's walker (`walkerPic(world.look ?? DEFAULT_LOOK, dir)`) instead of 🧒, facing the way they last
  moved. On the stones it stands on top of the stone, on grids it stands in the cell, feet at the bottom.
- **Bottom bar**: Start again (where the puzzle has it), a progress chip (stones: "6 → 9 → 12", crates: "Crates: 1 of 2"),
  Show me.
- **Win card** (replaces "You solved it!" text): cream card with a spinning ray burst and confetti, title "You solved it!",
  the prize shown big (3 bit pictures, or the egg picture with a wobble), one line saying where it went ("+3 water bits for
  your bag" / "A water egg! It's in your egg basket."), and **Back to the map**. Prize pictures: eggs exist
  (`items/egg-*.webp`); bits have no pictures yet (paint, section 5; until then use the type badge `badges/<type>.webp`).
- **Sizes**: board fits the space between bubble and bottom bar; laptop board max ~760 px wide, phone full width minus 16 px
  gutters. Nothing scrolls sideways at 390 px. Buttons at least 48 px.
- **Reduced motion**: every animation below has a `prefers-reduced-motion` version (jump to the end state, keep colour changes).
- **Sounds**: use the existing sound kit (`src/sound`): hop, splash, whoosh (slide), bump, scrape (crate), clunk (lock),
  whoomph (lantern), cheer (win). Muted when the game is muted.

## 4. Per puzzle

### 4.1 Stepping stones (shell-stones, lagoon-stones) — P2
Mock-ups: `mock-stones-*`, `mock-splash-*`. Before: `before-shell-stones-*`.
- **Board**: a rock pool with a sandy shore on the left (start) and a sandy far bank on the right with a flag post (one tall
  painted bank strip, not four yellow boxes; tapping anywhere on a row of the bank still counts as that row). Stones sit close
  together (80 px laptop, 44 px phone) with water showing between. Pool texture repainted bigger (256 px) with soft
  caustic light; lagoon gets its own brighter turquoise tile with coral.
- **Stones**: 4 painted stone shapes (round, oval, flat, mossy) chosen by position so the grid looks natural; slight random
  tilt; the number painted on in big white text with a dark outline (2.2 rem laptop, 1.1 rem phone). Lagoon uses 4 painted
  **lily pad / coral stone** variants instead.
- **States**: stones you stepped on turn **gold** and stay lit (the path is the times-table count, visible at a glance);
  the stone you're on has a white ring and your walker on it; stones next to you get a faint white ring (where you can go).
- **Animations**: hop = walker jumps in an arc (300 ms) with a small water ring where it lands. Wrong number = the stone sinks,
  a **splash** sprite plays (4 frames), "SPLASH!" pops, the walker reappears on the left shore and the gold path fades.
  Gentle bob on all stones (2 px, 3 s, out of step). Reach the bank = walker hops onto the sand, flag waves, win card.
- **Progress chip**: "6 → 9 → 12 → 15" built from the gold stones.

### 4.2 The lantern door (fire-lanterns) — P3
Mock-up: `mock-lanterns-*`.
- **Board**: a carved stone archway (painted door panel) in the Fire Mountain scene, with a wooden beam across the top and
  six lanterns hanging on chains of different lengths. Each lantern has a **wooden number tag** under it (big number, 1.6 rem).
  On phones: two rows of three.
- **States**: unlit = dark iron lantern; lit = painted lit lantern + orange glow + flicker (CSS scale/opacity on a glow layer,
  0.15 s random). A row of six order slots under the lanterns fills "3, 6, 9, ?, ?, ?" as they're lit.
- **Animations**: tap = flame whooshes in (scale from 0), lantern swings a little on its chain. Wrong = a **smoke puff**
  sprite on every lantern, all go dark, slots empty. Solved = all six blaze, the door **grinds open** (two halves slide
  apart, glow behind), then the win card.

### 4.3 The ice slide / The frozen lake (snow-slide, aurora-slide) — P4
Mock-up: `mock-slide-*`.
- **Board**: a frozen pond with a thick snowbank frame (painted 9-slice border), ice texture repainted at 256 px with
  reflections and cracks, snowy boulders in 3 painted variants, Ranger Fern's chest (`props/chest.webp`, opens to
  `props/chest-open.webp` on solve) with a gold dashed ring. Board up to 470 px laptop, full width phone.
- **Controls**: four round **ice buttons** in a cross beside the board (laptop) or under it (phone); also **swipe on the
  board** (touch) and the arrow keys (already there). Start again stays.
- **Animations**: walker slides with ease-out (speed by distance, ~90 ms a cell), a white **spray trail** behind it, a
  little bump shake + "thunk" when it hits a rock or the edge. On the chest: chest pops open with sparkles, win card.
- **Aurora**: same board with the aurora-hollow backdrop, a darker teal ice tile with green-purple reflections.

### 4.4 The stone door / hot spring chest (cave-count, steam-lock) — P5
Mock-up: `mock-lock-*`.
- **cave-count board**: left panel "glowworms on the cave roof" (dark cave ceiling painting) with the three groups drawn as
  real **glowworms** (painted glowworm sprite: blue glow dot with a hanging silk thread), twinkling slowly. Counting real
  glowworms is the maths (subitising/counting), much better than reading ✦✦✦✦. Needs a number per group: add
  `glow: [4, 7, 2]` to the **look table** (P1 file), not to the clue text. The clue lines stay for screen readers.
- **Lock**: a stone door panel with three stone **drum wheels** that roll (the numbers above and below show faintly), big
  ▲/▼ stone buttons, a gold "Try the code" button. Wrong = door shakes + clunk. Right = drums glow blue, door slides up.
- **steam-lock board**: same lock on a wooden chest by a steaming hot spring; each clue on a painted **wooden signpost**
  (words unchanged), steam wisps drifting (CSS). Right = chest lid opens, egg rises out.

### 4.5 The busy wharf (wharf-crates) — P6
Mock-up: `mock-crates-*`.
- **Board**: the wharf deck (planks repainted at 256 px, darker edge planks where it meets the water), water around it with a
  slow moving texture (two layers drifting), bollards and coiled rope on the edge, a small boat bobbing in one corner.
- **Spots**: painted chalk circle with an ✕ (cargo mark), not a green square. **Crates** repainted at 256 px. A crate on a spot
  gets a green tick badge and a green glow; "Crates: 1 of 2" chip.
- **Animations**: walker steps (120 ms); a pushed crate slides with a scrape sound and a dust puff; pushing into a wall = the
  crate wobbles. Solved = horn toot, crates stamp "✓", win card.
- Controls as the ice slide (wooden buttons, swipe, arrow keys).

### 4.6 Seed pods on the map (kauri-seeds) — P7
No screen; this one is in the world.
- Searching a tree that hides a pod: the tree **shakes**, a painted **seed pod** pops out in an arc and lands in a sparkle,
  and a chip "Seed pods 1 of 3" with the pod picture slides in at the top (stays until all 3 are found).
- Searching an empty tree: a small leaf flutter, nothing else.
- Also for all puzzles: the twinkle that marks a puzzle spot on the map (`puzzleTwinkles`) becomes a small painted
  **puzzle sign** (a wooden sign with a "?" carved in) so pupils can see where the puzzles are.

## 5. New painted art (ComfyUI on James's gaming PC)

Pipeline: `scripts/monsters-puzzle-art.py` (z-image turbo, same STYLE/SPR/TILE strings). Raise `SIZE` to **256** and
`MAXKB` to **45** for the new pieces so they stay sharp on iPads (they show at ~80-120 px CSS, 2x screens). Sprites are cut out
with rembg like now; tiles go through `tileable()`. Paint 3 seeds each, pick, `sheet` for a contact sheet. Old 128 px files
are replaced in place where the name is the same.

Prompts are added to `ITEMS` (STYLE/SPR/TILE are the script's strings):

| name | kind | size | prompt (before SPR/TILE suffix) |
|---|---|---|---|
| stone-round, stone-oval, stone-flat, stone-moss | sprite | 256 | one single flat round/oval/wide flat/moss-patched grey stepping stone seen straight from above, smooth plain flat top surface with no marks, wet shiny rim, a little seaweed at the waterline |
| lily-1, lily-2, coral-1, coral-2 | sprite | 256 | one single big round green lily pad seen from above, flat, a small pink flower at one edge / one single flat round pink and orange coral rock seen from above, flat top |
| pool (repaint) | tile | 256 | shallow clear turquoise rock-pool water over smooth sand, soft sunlight caustic patterns, a few small pebbles, uniform all over |
| lagoon | tile | 256 | bright clear tropical lagoon water, very light turquoise over white sand, soft caustic light, tiny coral bits, uniform all over |
| bank | sprite | 256x768 | a tall narrow strip of golden sandy beach seen from above, wet sand edge on the left side, a few shells, plain, no objects in the middle |
| splash | sheet | 4x256 | a white water splash seen from above, four frames: small ring, big crown splash, falling droplets, fading ripples (paint each frame, then join) |
| door-arch | sprite | 1024x768 | a huge carved dark volcanic stone archway door seen from the front, glowing orange cracks, an empty wooden beam across the top, plain flat door in the middle with no handles |
| lantern, lantern-lit (repaint) | sprite | 256 | as now, bigger |
| tag | sprite | 256x128 | one blank rectangular wooden tag with a rope hole, warm honey wood, nothing written on it |
| smoke | sprite | 256 | one small soft grey puff of smoke |
| snowbank | 9-slice | 512 | a square frame of soft deep snowbank seen from above, round lumpy edges, empty clear middle |
| ice (repaint), ice-night | tile | 256 | pale blue glassy ice with faint white cracks and reflections / dark teal night ice reflecting green and purple aurora light |
| rock-a, rock-b, rock-c | sprite | 256 | one single snowy boulder, three shapes: round, tall, flat wide |
| glowworm | sprite | 128x256 | one single tiny glowing blue-green glowworm light hanging on a long thin shiny silk thread with drops of dew, on plain black |
| cave-roof | tile | 512 | dark wet cave ceiling rock seen from below, deep blue-black, faint texture, uniform, no lights |
| lock-door | sprite | 1024x768 | a carved grey stone door seen from the front with three empty round slots in a row in the middle, mossy edges, plain |
| drum | sprite | 128x256 | one stone cylinder drum seen from the front, smooth pale stone, blank, nothing written |
| sign | sprite | 512x256 | one blank wooden signpost board on a post, nothing written on it |
| chest-lock | sprite | 512 | a sturdy wooden treasure chest with brass bands and a brass three-dial number lock on the front, closed |
| wharf (repaint), wharf-edge | tile | 256 | old weathered brown wharf planks / the same planks with a dark thick edge beam along one side |
| water (was "wall", repaint) | tile | 256 | deep blue harbour water, gentle ripples, uniform |
| crate (repaint) | sprite | 256 | as now, bigger |
| mark | sprite | 256 | a chalk-white painted cargo circle with a cross in it on wood, seen from above (cut out) |
| bollard, rope, boat | sprite | 256 | one iron wharf bollard / one coiled rope / one small red and white dinghy, from above |
| seed-pod | sprite | 128 | one single brown kauri seed cone pod |
| puzzle-sign | sprite | 128 | one small wooden sign on a post with a big question mark carved in it |
| bits: leaf, shell, ember, frost, glow, pebble | sprite | 128 | one kawakawa leaf / one shell / one glowing ember / one frost crystal / one pinch of glow dust / one round pebble (the bit pictures for the win card and bag) |

About 45 pictures. At ~30 s each when the PC is free (~5 min each if James is gaming), one evening. Paint per stage, not all
at once: each stage's pieces are listed above by puzzle.

## 6. Stages (each one PR, straight to live per James's usual rule)

| stage | what | painting |
|---|---|---|
| P1 | Shared stage: backdrop, plank, bubble, walker player, pips, Show me, win card with prize; puzzleLook.ts | none (uses painted scenes, people, walkers, eggs, badges) |
| P2 | Stepping stones (both) | stones x4, lily/coral x4, pool, lagoon, bank, splash |
| P3 | Lantern door | door-arch, lantern x2, tag, smoke |
| P4 | Ice slides (both) + swipe | snowbank, ice x2, rock x3 |
| P5 | Stone door + hot spring chest | glowworm, cave-roof, lock-door, drum, sign, chest-lock |
| P6 | Busy wharf | wharf x2, water, crate, mark, bollard, rope, boat |
| P7 | Seed pods on the map + puzzle signs + bit pictures | seed-pod, puzzle-sign, bits x6 |

P1 alone fixes most of "plain" with no painting. P2-P6 can go in any order; start with P2 (the one James saw).

Tests: keep `MonstersPlay.test.tsx` passing; add a PuzzlePage test per stage that the board still has the same buttons
(names "Far bank, row N", "Number 1 up", etc.) and the win card shows the prize. Rules tests in shared are untouched.

## 7. Design checklist

- Same rules, same words, same prizes: look only.
- Every tap target ≥ 48 px; numbers readable at arm's length on an iPad (≥ 1.1 rem phone, ≥ 1.6 rem laptop).
- Gold path / lit lanterns / ticked crates show progress without reading.
- No sideways scroll at 390 px; board never taller than the screen on a 1366x768 Chromebook.
- Reduced motion respected; mute respected.
- Art loads lazily per puzzle (only that puzzle's pieces), each under 45 KB.
