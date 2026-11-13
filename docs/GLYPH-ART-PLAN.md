# Glyph Gates: art plan

Style: James's mock-up (project files `glyph/glyph-mockup.png`): painted cartoon, mossy green temple stone, warm torchlight, gold. An original jungle temple. Every prompt is in `docs/glyph-art/config.json` (style key `t`).

Paint: `python3 scripts/game_art.py glyph paint ~/dragon-art-inbox/glyph-art/set [names] --tries 3`. Picks go in `docs/glyph-art/picks.json`; `tidy` writes the `.webp` files. Drawn stand-ins stay as the fallback.

| Picture | Kind | Size | Used for | Stage |
|---|---|---|---|---|
| back-wall | scene | 1344 × 768 | behind the tile grid and glyphs | 3 |
| back-map | scene | 1344 × 768 | the 6-temple jungle map | 3 |
| gold-stone | cut | 768 × 768 | the target stone (fraction drawn on top in code) | 3 |
| tile-stone | cut | 768 × 768 | each tile (fraction drawn on top; green glow in code) | 3 |
| monkey-brown, monkey-grey, monkey-gold | cut | 768 × 1024 | cheer when a wall opens; Mango is the brown one | 3 |
| card | card | 1216 × 688 | home page card | 3 |

Later (stage 6): one wall per temple (snake carvings, waterfall, roots, bats, gold), the wall-opening frames (stone slides down), Mango's pointing pose for the guide.

Numbers, glyph shapes and the glow are always drawn in code, never painted, so they stay sharp and exact.
