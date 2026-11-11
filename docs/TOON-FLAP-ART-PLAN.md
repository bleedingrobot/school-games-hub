# Toon Flap: art plan

*Written 11 Nov 2026 with [TOON-FLAP-PLAN.md](TOON-FLAP-PLAN.md). James paints final art on his gaming PC (ComfyUI) after school; the game is built and played with drawn stand-ins first, and they stay as the fallback (guide section 2, "Painted art").*

**Status: look picked.** Pupils asked for cartoon-inspired art ("like a sponge bob inspired level"), and James asked on 11 Nov 2026 for **a different popular animated series' style for each level**. Section 1 matches each level to one. Each level has its own flyer in that level's style, unlocked by beating the level 3 times, plus earnable trails (James and his pupils, 11 Nov 2026; plan section 5a).

**The one rule: the style, never the show.** An art style can be borrowed; a show's characters, names, logos, catchphrases and signature props can't. So Bubble Reef has the bright, goofy undersea look kids know, but our own coral houses and fish: no pineapple house, no sponge, no starfish in shorts. The "inspired by" column is for James's eye only. **ComfyUI prompts describe the style in words and never name a show or studio**, and nothing in the game ever names one. This keeps the school site clear of copyright trouble and keeps the game our own.

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

Every prompt = the style in words (section 1) + the subject + *children's cartoon, no text, no logos, no existing characters*. Examples:

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
