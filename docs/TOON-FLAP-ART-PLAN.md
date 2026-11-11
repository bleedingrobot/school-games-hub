# Toon Flap: art plan

*Written 11 Nov 2026 with [TOON-FLAP-PLAN.md](TOON-FLAP-PLAN.md). James paints final art on his gaming PC (ComfyUI) after school; the game is built and played with drawn stand-ins first, and they stay as the fallback (guide section 2, "Painted art").*

**Status: look picked.** Pupils asked for cartoon-inspired art ("like a sponge bob inspired level"), and James asked on 11 Nov 2026 for **a different popular animated series' style for each level**. Section 1 matches each level to one. Each level has its own flyer in that level's style, unlocked by beating the level 3 times, plus earnable trails (James and his pupils, 11 Nov 2026; plan section 5a).

**The one rule: the style, never the show.** An art style can be borrowed; a show's characters, names, logos, catchphrases and signature props can't. So Bubble Reef has the bright, goofy undersea look kids know, but our own coral houses and fish: no pineapple house, no sponge, no starfish in shorts. The "inspired by" column is for James's eye only. **ComfyUI prompts describe the style in detail (section 1a) and never name a show or studio**, and nothing in the game ever names one. The aim is to match each look as closely as possible (James, 11 Nov 2026) using no copyrighted material. This keeps the school site clear of copyright trouble and keeps the game our own.

## 1. One cartoon style per level

| # | World | Style inspired by | The style in words (goes in the prompt) | Walls | Back layer |
|---|---|---|---|---|---|
| 1 | Toon Garden | *Bluey* | soft flat shapes, no outlines, warm pastel colours, gentle sunny suburban feel | picket-fence posts, giant sunflowers | backyard, gum trees, sunny sky |
| 2 | Mesa Mayhem | *Looney Tunes* (pupils) | classic 1950s theatrical cartoon, painted desert backgrounds, bold stretchy shapes, zany slapstick energy | tall red rock towers, giant cactus | desert canyon, mesas, dusty road |
| 3 | Bubble Reef | *SpongeBob SquarePants* (pupils) | bright saturated colours, goofy wobbly shapes, flower-pattern sky, thick outlines, zany undersea | coral towers, kelp stalks | undersea town of goofy coral houses, bubbles |
| 4 | Cheese Kitchen | *Tom and Jerry* (pupils) | classic 1940s cartoon, rich painted interiors, soft shading, chase-cartoon energy, everything giant from a mouse's view | table legs, stacked cheese, cupboard doors | huge kitchen, checked floor, a mouse hole in the skirting |
| 5 | Donut Town | *The Simpsons* (pupils) | flat bright colours, clean thin outlines, warm yellow tones, simple rounded suburban town | lamp posts, big chimneys | sunny town, power-station towers far off, clouds |
| 6 | Spooky Manor | *Scooby-Doo* (pupils) | 1970s mystery cartoon, moody painted night backgrounds, flat characters, silly-spooky | crooked chimneys, wobbly bookshelves | purple night, creaky mansion, full moon |
| 7 | Paper Peaks | *South Park*'s paper look (pupils) | construction-paper cut-out, flat shapes with visible paper edges, very simple, snowy mountain town | paper pine trees, paper chimneys | snowy mountains, little paper houses |
| 8 | Volcano Island | *Avatar: The Last Airbender* | painterly anime-inspired backgrounds, rich warm colours, flowing fire and steam | lava rock pillars, temple columns | island volcano, glowing lava pools, steam |
| 9 | Robot City | *Astro Boy* / classic anime | Japanese TV anime, clean cel shading, speed lines, glowing neon, big sparkly eyes | neon towers, antenna poles | night skyline, flying cars |
| 10 | Cosmic Storm | *The Jetsons* | 1960s space-age retro future, atomic shapes, boomerang curves, teal and orange | rocket gantries, asteroid stacks | starry sky, ringed planets, flying-saucer houses |

**South Park** is an adult show, so only its paper cut-out *look* is borrowed for Paper Peaks: nothing from the show, and (as with every level) the game never names it.

The order runs soft and gentle (levels 1 to 2) to bold and busy (9 to 10), matching how the flying gets harder. A level's walls must always stand out from its back layer, whatever the style: the back layer is painted calmer and lower in contrast, and the walls keep a clear edge.

## 1a. Style sheets: matching each look as closely as we can (James, 11 Nov 2026)

*James: "we need to match the style of the art as closely as possible for each cartoon without reusing any copyright material."*

**What we can match, and what we can't.** A drawing *style* (line weight, colours, shapes, how eyes and backgrounds are drawn, the texture) isn't owned by anyone, so we copy it as closely as we can. What we never use: a show's characters (or ones that are near-copies), names, logos, title lettering, catchphrases, music, sound effects, signature places or props, and **any frames, screenshots or official art**.

**How to get close in ComfyUI without copying:**
- **Describe, don't name.** Each sheet below is the prompt's style block. Naming a show in a prompt tends to pull its characters and props into the picture, so a detailed description gets closer *and* safer.
- **No show images as inputs.** Don't use screenshots or fan art as an image prompt, IP-Adapter or ControlNet reference, and don't use a LoRA trained on a show's frames (those are built from the copyrighted pictures). Generic style LoRAs ("1940s cartoon", "paper cut-out", "cel anime") are fine.
- **Our first good picture becomes the reference.** Once one picture in a level looks right, use *it* as the reference for the rest of that level, so the level stays consistent.
- **Check each pick side by side** (in your head or with a show image open on another screen, never as an input): does it *feel* like the show? Could anyone point at one thing and say "that's from the show"? First yes, second no = keep it.

Colours are close starting points to tune, given as hex codes for the stand-ins and the prompt's colour words.

### 1 Toon Garden (Bluey look)
- **Lines:** none on backgrounds; characters have no outline either, just flat shapes with a slightly darker edge colour.
- **Colours:** soft warm pastels: sky #A9D8F0, grass #9CCB6B, warm cream #F6E7C8, terracotta roofs #D9825B, blue-grey shadows #7E9CB3.
- **Shapes:** simple, rounded, slightly squat; houses on stilts with verandas and lattice, gum trees with pale trunks.
- **Shading:** flat colour with one soft shadow tone; light gentle gradients in the sky.
- **Faces/eyes:** small dot eyes, simple snouts, no eye whites.
- **Feel:** calm, sunny Brisbane-suburb afternoon. *Not ours to use:* blue and red heeler dog family, their house layout.

### 2 Mesa Mayhem (Looney Tunes look)
- **Lines:** thick-to-thin brush ink lines on characters and props; backgrounds have **no outlines** at all, painted in gouache.
- **Colours:** desert backgrounds of burnt orange #D9783B, ochre #E5B458, dusty pink #E8A9A0, purple shadow mesas #8A6A9E, pale yellow sky #F7E3A1.
- **Shapes:** tall, skinny, impossible rock towers and mesas; long straight desert road; stylised flat cactus; strong perspective.
- **Shading:** backgrounds painted with soft dry-brush texture; characters flat with no shading.
- **Faces/eyes:** big expressive eyes with black "pie-cut" pupils, huge stretchy expressions, squash and stretch, speed puffs of dust.
- **Feel:** 1950s theatrical short, slapstick. *Not ours to use:* the rabbit, coyote, roadrunner, duck, the "ACME" crates, the ring-and-title ending.

### 3 Bubble Reef (SpongeBob look)
- **Lines:** medium-thick black outlines, slightly wobbly, on everything.
- **Colours:** very saturated: ocean #2E9BD6, sand #F2D16B, coral pink #FF7FA8, lime #9BE04A, purple #8E5CC7, and **"sky flowers"** (flat flower-shaped clouds in the water) in pale blue-green #A6E3D9 and pink.
- **Shapes:** goofy, lopsided buildings with round porthole windows, bendy rubbery forms, tiki and boat shapes, flat cartoon kelp.
- **Shading:** flat colour, simple single-tone shadows, bubbles with a white highlight.
- **Faces/eyes:** big round eyes with eyelash lines, buck-tooth grins, wild exaggerated expressions.
- **Feel:** zany, loud, happy. *Not ours to use:* the pineapple house, the rock house, the Easter-island head house, the burger restaurant, a yellow sponge, a pink starfish, a squid, a crab, a snail, the scene "card" captions.

### 4 Cheese Kitchen (Tom and Jerry look)
- **Lines:** soft dark-brown outlines on characters; painted backgrounds with no outlines.
- **Colours:** rich mid-century interiors: warm wood #A0663C, cream walls #EFE2C2, black-and-white checked floor, mint #B9DCC8, deep red #B5413B, cheese gold #F2C744.
- **Shapes:** everything enormous from a mouse's eye: table legs like towers, cupboard doors, giant bowls; a mouse hole arch in the skirting board.
- **Shading:** full painted backgrounds with soft light and real shadows, like 1940s cel animation; characters lightly shaded with a soft shadow tone.
- **Faces/eyes:** large oval eyes, very elastic expressions, smooth fluid poses.
- **Feel:** a lively 1940s chase short. *Not ours to use:* the grey-blue cat, the brown mouse, the bulldog, the housekeeper character, the title card.

### 5 Donut Town (The Simpsons look)
- **Lines:** clean, even, medium-thin black outlines on everything.
- **Colours:** flat bright TV colours: sky #6FB8E8 with puffy white clouds, lawn #6FBF4A, warm suburban pinks and lilacs #E7A6C0 #B9A3D6, road grey #8C8C8C. Our people are **not yellow-skinned**, so it can't be mistaken for the show.
- **Shapes:** simple rounded American suburb, flat-front houses, round-topped trees, a far-off power station with two cooling towers (generic, no logo).
- **Shading:** flat with almost no shadows; one hard-edged shadow tone at most.
- **Faces/eyes:** big round white eyes with dot pupils, simple four-finger hands.
- **Feel:** cheerful, slightly satirical Saturday TV town. *Not ours to use:* the family, their purple house, the town's name, the donut shop sign, the power plant logo, yellow skin, the opening-credits cloud zoom.

### 6 Spooky Manor (Scooby-Doo look)
- **Lines:** characters and props have thick black outlines; backgrounds are painted without them.
- **Colours:** moody night: deep indigo #2B2A5C, teal fog #4F8C8B, sickly green #7FB069, orange lamp glow #F2A541, purple shadows #5B3F7A.
- **Shapes:** creaky mansion with crooked towers, long corridors with suits of armour, cobwebs, a full moon; slightly flat, layered painted sets.
- **Shading:** backgrounds richly painted (watercolour-like gradients); characters flat colour, a classic Hanna-Barbera "limited animation" look with simple poses.
- **Faces/eyes:** oval eyes, simple mouths, wobbly-knee scared poses.
- **Feel:** silly-spooky 1970s mystery. *Not ours to use:* the Great Dane, the gang, the green van with flowers and its lettering, the "unmasking" scene, the laugh track.

### 7 Paper Peaks (South Park's paper cut-out look)
- **Lines:** no outlines; every shape is a flat piece of construction paper with a slightly uneven cut edge.
- **Colours:** construction-paper flat colours: snow white #F4F6F8, mountain grey-blue #8EA2B8, pine green #2F6B3A, paper sky blue #8FC3E8, little houses in red #C8423B and yellow #E9C24B.
- **Shapes:** very simple geometric cut-outs, round heads, mittens, flat front-on views; small mountain town with snowy roofs and pine trees.
- **Shading:** none, or a faint paper texture and a tiny drop shadow between layers.
- **Faces/eyes:** two touching round white eyes with dot pupils, a tiny mouth.
- **Feel:** a snowy little mountain town, deliberately crude and simple. Kept fully kid-friendly. *Not ours to use:* the four boys, their hats and jackets, the town sign, the bus stop scene, any of the show's content or jokes. Never named or described to pupils.

### 8 Volcano Island (Avatar: The Last Airbender look)
- **Lines:** fine, clean outlines on characters; backgrounds painted with no outlines.
- **Colours:** rich warm volcanic palette: lava orange #F26B1D, deep red #A62B1F, basalt #3B3434, gold #E8B33C, soft steam white #F1E9DF, distant teal sea #3F8F8C.
- **Shapes:** East Asian-inspired temple roofs and stone columns, terraced cliffs, curling stylised flames and steam (swirly, like brush calligraphy).
- **Shading:** painterly backgrounds with soft light and atmosphere; characters cel-shaded with one shadow tone.
- **Faces/eyes:** anime-influenced, expressive but grounded.
- **Feel:** grand, adventurous. *Not ours to use:* the arrow-headed monk, the sky bison, the flying lemur, any nation's symbols or logo.

### 9 Robot City (classic anime look)
- **Lines:** crisp black outlines, clean cel animation.
- **Colours:** neon night: navy #141E4A, hot pink #FF3E9A, cyan #3EE0FF, electric purple #7B4BFF, window yellow #FFD84A.
- **Shapes:** tall rounded-futuristic towers, tubes and sky-bridges, flying cars, glowing signs with no words.
- **Shading:** two-tone cel shading with hard edges; glow and speed lines.
- **Faces/eyes:** big sparkly eyes with highlights, small nose and mouth.
- **Feel:** fast, bright, retro-future. *Not ours to use:* the boy robot with rocket boots and spiky hair, any robot or monster from a real series, Japanese logos.

### 10 Cosmic Storm (The Jetsons look)
- **Lines:** clean thin black outlines, Hanna-Barbera 1960s style.
- **Colours:** space-age pastels on dark sky: deep space #1D2340, teal #3FB8AF, atomic orange #F28C38, cream #F5ECD7, pale lilac #C3B1E1.
- **Shapes:** Googie / atomic-age architecture: saucer-topped buildings on tall stilts, boomerangs, starbursts, bubble domes, ringed planets.
- **Shading:** flat colour, simple gradients on planets, starburst highlights.
- **Faces/eyes:** simple oval eyes, smooth 1960s TV character design.
- **Feel:** cheerful retro future in space. *Not ours to use:* the family, their robot maid, their dog, the bubble car's exact design, the show's apartment tower.

### Flyers in each style

Each level's flyer is drawn to that level's sheet, so the Rocket Carrot looks 1950s theatrical, the Donut Cruiser looks like Saturday TV, and the Toilet Rocket is construction paper. Every rider is a brand-new character: different face, colours and clothes from anyone in the show it nods to (the donut rider is a cheerful man in our own design, not a bald man in a white shirt; the round boy has our own hat and jacket).

## 2. Stand-ins (built first, in code)

- **Bird:** a round body with big cartoon eyes, a fan tail and one wing on canvas; wing up/down on flap, squash on flap, dizzy stars on a bump.
- **Walls:** rounded shapes in each world's two colours with a clear edge; answer-gap numbers on white signs.
- **Sky and ground:** a two-stop gradient plus one flat shape per world, scrolling slower than the walls.
- **Perch** (a post with a flag) and the **nest** at the finish.
- Every colour in `src/games/toonflap/palette.ts` by world, so painted art replaces pieces one world at a time.

## 3. Pictures needed

| Picture | Size | How many | Notes |
|---|---|---|---|
| Each level's flyer (plan section 5a): glide, up, dizzy tumble | 256 × 256 each, cut out | 3 × 10 | In that level's style; must fit inside the fantail's outline (same hit box). Riders are our own made-up characters. Shiny versions are a code effect |
| Trail pieces: flower, cookie, donut crumb, pineapple, cheese, mouse tail, star | 64 × 64 each, cut out | 7 | Small and bright; the sparkle is added in code |
| Revive potion bottle | 128 × 128, cut out | 1 | A glowing cartoon potion |
| Starter Toon Fantail and the secret Rainbow Toon: glide, wing up, dizzy tumble, perched, cheering | 256 × 256 each, cut out | 5 + 3 | Plain cartoon look; the Rainbow Toon only needs the 3 flying poses |
| Hangar screen (pick your flyer and trail) | 1600 × 1000 | 1 | A cartoon hangar with 12 bays; flyers drawn on top |
| Back layer per world | 2048 × 768, tiles left-right | 10 | Calm, low detail |
| Middle layer per world | 2048 × 512, tiles, cut out | 10 | |
| Wall pieces per world (top end, bottom end, stretchy middle) | 256 × 512, cut out | 10 × 3 | |
| Moving extras (jellyfish, ghost, steam puff, comet) | 256 × 256, cut out | 4 | Levels 3, 6, 8, 10 |
| Perch post, nest, answer-gap sign (blank) | cut out | 3 | One neutral cartoon style; numbers drawn on top in code |
| Map: a trail through the 10 worlds, each stop in its own style | 1600 × 1000 | 1 | No text; stops drawn in code |
| Home card | 1600 wide (and 800 small) | 1 | The bird bursting through a gap where four worlds meet |

## 4. Prompts

Every prompt = the level's style sheet in words (section 1a) + the subject + *children's cartoon, no text, no logos, no existing characters*. Examples:

- **Fantail, Bubble Reef:** *bright saturated colours, goofy wobbly shapes, thick outlines, zany undersea cartoon; a cute New Zealand fantail bird with big eyes, side view facing right, wings up, fan tail spread, plain white background, children's cartoon, no text, no logos, no existing characters*
- **Back layer, Bubble Reef:** *[style]; wide underwater cartoon town, goofy rounded coral houses with round windows, bubbles, sea plants, flower-shaped clouds in the water above, seamless left-right, low detail*
- **Flyer, Mesa Mayhem:** *[style]; a cartoon orange carrot flying like a rocket with a small original grey rabbit riding it, side view facing right, plain white background*
- **Walls, Cheese Kitchen:** *[style]; a tall wooden table leg with a wedge of holey cheese on top, vertical, isolated on white*
- **Back layer, Cosmic Storm:** *1960s space-age retro future, atomic shapes, boomerang curves, teal and orange; starry sky with ringed planets and flying-saucer houses on stilts, seamless left-right, low detail*

Check each pick before it goes in: if it looks like a real character or copies a show's famous prop or logo, paint it again. Picks go in `docs/toonflap-art/picks.json`; `scripts/toonflap-art.py` (a copy of `trader-art.py`) makes the `.webp` files and cut-outs; `src/games/toonflap/art/CREDITS.md` and one `art.test.ts`. Pictures go to an art inbox folder, never straight to `main`.

## 5. Order (each world can go live on its own)

1. Worlds 1 to 3 with their flyers (the first week of play), and the home card.
2. Worlds 4 to 10.
3. Trails and the potion (small, quick wins any evening).
4. Map and Hangar.
