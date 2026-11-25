# Star Web solo: art plan

Style: the same storybook night as Class Live's Star Web (`docs/classlive-art/config.json`, style `s`): bold painterly digital
art, deep blues and purples, warm light, no text. Every prompt is in `docs/starweb-art/config.json`.

Paint: `python3 scripts/game_art.py starweb paint ~/dragon-art-inbox/starweb-art/set [names] --tries 2`. Picks go in
`docs/starweb-art/picks.json`; `tidy` writes the `.webp` files into `src/games/starweb/art/paint/back/` (and the card into
`src/assets/home/`). The drawn sky stays as the fallback, and until these are painted a sky uses Class Live's painted
`back/star-sky` and the home card is a copy of Class Live's `pick/stars` card.

| Picture | Kind | Size | Used for |
|---|---|---|---|
| back-map | scene | 1536 × 864 | behind the Star Map (`map.webp`), shown at 55% so the drawn table stars stay bright |
| back-sky-dusk | scene | 1536 × 864 | one of the sky backdrops, picked from the sky's seed (`sky-dusk.webp`) |
| back-sky-aurora | scene | 1536 × 864 | another sky backdrop (`sky-aurora.webp`) |
| card | card | 1536 × 864 | the home page card (`src/assets/home/starweb.webp` + `-small`) |

The stars, arms, constellation lines, numbers and the line-art creatures (whale, falcon, dragon) are always drawn in code,
never painted, so they stay sharp and exact.
