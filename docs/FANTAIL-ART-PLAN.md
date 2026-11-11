# Fantail Flight: art plan

*Written 11 Nov 2026 with [FANTAIL-PLAN.md](FANTAIL-PLAN.md). James paints final art on his gaming PC (ComfyUI) after school; the game is built and played with drawn stand-ins first, and they stay as the fallback (guide section 2, "Painted art").*

**Status: style not picked yet.** Prompts below are written for the recommended style (B) and get one style line swapped if James picks another.

## 1. Style options

| | Style | Looks like | Good for | Watch out |
|---|---|---|---|---|
| **A** | Painted storybook | The home page cards and Marble Rush course cards: bright, flat NZ landscapes | Matches the hub best; one style everywhere | Busy backgrounds can hide the gaps; walls need strong outlines |
| **B (recommended)** | Paper cut-out | Layered craft paper, soft drop shadows between layers, like a diorama | Side-scrolling layers (parallax) come out naturally; walls read clearly as cut shapes; looks nothing like the arcade game's pixel pipes | Needs a consistent paper texture across 10 levels |
| **C** | Chunky pixel art | Retro arcade, big pixels | Feels like a "real" arcade game to kids; tiny files | ComfyUI pixel art is often messy and needs cleaning; closest to the arcade original, so a bit too near its look |
| **D** | Soft clay | Rounded clay models, like Pipi's clay art sheet | Cute bird with lots of character | Reads younger (fits Foundational more than Years 4 to 6) |

## 2. Stand-ins (built first, in code)

- **Bird:** a round body, a fan tail and one wing drawn on canvas, wing up/down on flap, a tumble on a bump.
- **Walls:** rounded rectangles in each level's two colours with a darker outline; answer-gap numbers on white signs.
- **Sky and ground:** a two-stop gradient plus one flat hill shape per level, scrolling slower than the walls.
- **Perch:** a post with a small flag; nest at the finish.
- Every colour in `src/games/fantail/palette.ts`, so the painted art can replace pieces one at a time.

## 3. Pictures needed

Levels share themes in pairs to halve the painting (5 themes, each used by 2 levels with a light change: day/dusk, calm/windy).

| Picture | Size | How many | Notes |
|---|---|---|---|
| Fantail sprite sheet: glide, wing up, wing down, tumble, perched | 256 × 256 each, cut out | 5 | Same bird in every pose; fan tail clearly visible |
| Back layer (far hills, sky) per theme | 2048 × 768, tiles left-right | 5 | Calm, low detail so walls stand out |
| Middle layer (trees, cliffs) per theme | 2048 × 512, tiles, cut out | 5 | |
| Wall pieces per theme (top end, bottom end, middle that stretches) | 256 × 512 pieces, cut out | 5 × 3 | Flax, tree fern, kauri trunk, rock stack, ice pillar |
| Perch post and nest | 256 × 384, cut out | 2 | |
| Answer-gap sign | 384 × 192, cut out | 1 | Blank: the number is drawn on top in code |
| Map of the trip (10 stops) | 1600 × 1000 | 1 | No text; stops are drawn on top in code |
| Home card | 1600 wide (and 800 small) | 1 | Section 4 |

**Themes:** 1-2 garden and bush (flax walls), 3-4 river and waterfall (tree-fern walls), 5-6 kauri and coast (kauri trunks, rock stacks), 7-8 harbour and steam (wharf posts, steaming rock), 9-10 mountains and storm (ice pillars).

## 4. Prompts (style B)

Style line for every prompt: *layered paper cut-out craft, soft shadows between paper layers, bright colours, children's picture book, clean edges, no text.*

- **Fantail:** *a New Zealand fantail (pīwakawaka) bird, side view facing right, wings [up / down / folded], fan tail spread, cheerful, on plain white background*
- **Back layer, garden and bush:** *wide panoramic New Zealand native bush hills under a pale blue sky, gentle, low contrast, seamless left-right*
- **Walls, garden and bush:** *a tall clump of harakeke flax leaves, vertical, isolated on white*
- **Home card:** *a fantail flying over a braided river with tree ferns, a tall wall of flax ahead with a clear gap of sky, wide landscape*

The other themes swap the subject words using the themes list above. Picks go in `docs/fantail-art/picks.json`; `scripts/fantail-art.py` (a copy of `trader-art.py`) makes the `.webp` files and cut-outs; `src/games/fantail/art/CREDITS.md` and one `art.test.ts`. Pictures go to an art inbox folder, never straight to `main`.

## 5. Order (each can go live on its own)

1. Bird sprite sheet (biggest lift, every level).
2. Theme 1 (levels 1-2) layers and walls, and the home card.
3. Themes 2 to 5.
4. Map.
