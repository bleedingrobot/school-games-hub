# Fantail Flight: art plan

*Written 11 Nov 2026 with [FANTAIL-PLAN.md](FANTAIL-PLAN.md). James paints final art on his gaming PC (ComfyUI) after school; the game is built and played with drawn stand-ins first, and they stay as the fallback (guide section 2, "Painted art").*

**Status: look picked.** Pupils asked for cartoon-inspired art ("like a sponge bob inspired level"), and James asked on 11 Nov 2026 for **a different popular animated series' style for each level**. Section 1 matches each level to one. Still open: whether the bird changes style in each world (section 3).

**The one rule: the style, never the show.** An art style can be borrowed; a show's characters, names, logos, catchphrases and signature props can't. So Bubble Reef has the bright, goofy undersea look kids know, but our own coral houses and fish: no pineapple house, no sponge, no starfish in shorts. The "inspired by" column is for James's eye only. **ComfyUI prompts describe the style in words and never name a show or studio**, and nothing in the game ever names one. This keeps the school site clear of copyright trouble and keeps the game our own.

## 1. One cartoon style per level

| # | World | Style inspired by | The style in words (goes in the prompt) | Walls | Back layer |
|---|---|---|---|---|---|
| 1 | Toon Garden | *Bluey* | soft flat shapes, no outlines, warm pastel colours, gentle sunny suburban feel | picket-fence posts, giant sunflowers | backyard, gum trees, sunny sky |
| 2 | Wobbly Woods | *Adventure Time* | simple rounded shapes, thin even outlines, candy pastels, bendy noodle forms, whimsical | swaying trees with googly eyes | soft fantasy forest, round hills |
| 3 | Bubble Reef | *SpongeBob SquarePants* | bright saturated colours, goofy wobbly shapes, flower-pattern sky, thick outlines, zany undersea | coral towers, kelp stalks | undersea town of goofy coral houses, bubbles |
| 4 | Candy Canyon | *The Powerpuff Girls* | very thick black outlines, flat bold colours, big simple shapes, cute and punchy | lollipops, candy canes, jelly-bean stacks | pink canyon, ice-cream clouds |
| 5 | Dino Valley | *The Flintstones* | 1960s TV cartoon, limited animation look, painted backgrounds, chunky stone shapes | long friendly dinosaur necks | ferns, stone huts, a smoking volcano far off |
| 6 | Spooky Manor | *Scooby-Doo* (classic) | 1970s mystery cartoon, moody painted night backgrounds, flat characters, silly-spooky | crooked chimneys, wobbly bookshelves | purple night, creaky mansion, full moon |
| 7 | Robot City | *Astro Boy* / classic anime | Japanese TV anime, clean cel shading, speed lines, glowing neon, big sparkly eyes | neon towers, antenna poles | night skyline, flying cars |
| 8 | Volcano Island | *Avatar: The Last Airbender* | painterly anime-inspired backgrounds, rich warm colours, flowing fire and steam | lava rock pillars, temple columns | island volcano, glowing lava pools, steam |
| 9 | Frosty Peaks | *Pingu* | stop-motion clay look, rounded soft forms, fingerprint texture, cosy and simple | ice pillars, snowman stacks | snowy hills, igloos, penguins sliding |
| 10 | Cosmic Storm | *The Jetsons* | 1960s space-age retro future, atomic shapes, boomerang curves, teal and orange | rocket gantries, asteroid stacks | starry sky, ringed planets, flying-saucer houses |

The order runs soft and gentle (levels 1 to 2) to bold and busy (9 to 10), matching how the flying gets harder. A level's walls must always stand out from its back layer, whatever the style: the back layer is painted calmer and lower in contrast, and the walls keep a clear edge.

## 2. Stand-ins (built first, in code)

- **Bird:** a round body with big cartoon eyes, a fan tail and one wing on canvas; wing up/down on flap, squash on flap, dizzy stars on a bump.
- **Walls:** rounded shapes in each world's two colours with a clear edge; answer-gap numbers on white signs.
- **Sky and ground:** a two-stop gradient plus one flat shape per world, scrolling slower than the walls.
- **Perch** (a post with a flag) and the **nest** at the finish.
- Every colour in `src/games/fantail/palette.ts` by world, so painted art replaces pieces one world at a time.

## 3. Pictures needed

| Picture | Size | How many | Notes |
|---|---|---|---|
| Fantail in each world's style: glide, wing up, dizzy tumble | 256 × 256 each, cut out | 3 × 10 | Same bird every time (grey-brown back, cream chest, white-edged fan tail, big eyes), redrawn in the world's style. **Option:** one bird for all worlds, 6 poses, far less painting |
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
- **Walls, Dino Valley:** *1960s TV cartoon, chunky stone shapes; a tall friendly cartoon dinosaur neck and head, vertical, isolated on white*
- **Back layer, Cosmic Storm:** *1960s space-age retro future, atomic shapes, boomerang curves, teal and orange; starry sky with ringed planets and flying-saucer houses on stilts, seamless left-right, low detail*

Check each pick before it goes in: if it looks like a real character or copies a show's famous prop or logo, paint it again. Picks go in `docs/fantail-art/picks.json`; `scripts/fantail-art.py` (a copy of `trader-art.py`) makes the `.webp` files and cut-outs; `src/games/fantail/art/CREDITS.md` and one `art.test.ts`. Pictures go to an art inbox folder, never straight to `main`.

## 5. Order (each world can go live on its own)

1. Worlds 1 to 3 with their birds (the first week of play), and the home card.
2. Worlds 4 to 10.
3. Map.
