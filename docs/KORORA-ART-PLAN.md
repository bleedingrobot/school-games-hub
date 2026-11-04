# Penguin Pairs — art plan

The game ships with clay-look SVG stand-ins (`src/games/korora/KororaArt.tsx`). The final pictures are painted in
ComfyUI on James's gaming PC with `scripts/korora-art.py` (clay style, the same as Beanstalk and Hop), the way Hop and
Pipi were painted.

## Pictures (26)

James's changes (4 Nov 2026): the penguin is Two-Shoes, the stones go across the water and the prize is dancing shoes. Repaint `pebble-grey`, `pebble-gold`, `shoes-gold`, the three `back-across-*`, `card`, `sparkle` and `takahe-*` (the tidy step makes `shoes-bronze` and `shoes-silver` from the gold pair).

| Group | Names | Notes |
| --- | --- | --- |
| Two-Shoes | `korora-wait`, `korora-dive`, `korora-gulp`, `korora-cheer` | little blue penguin with a red knitted scarf |
| Stepping stones | `pebble-grey`, `pebble-gold` | flat stones to stand on; bronze and silver are tinted from gold; numbers are drawn in code |
| Things | `chick-wait`, `chick-happy`, `fish`, `shoes-gold`, `splash`, `sparkle` | the fish is drawn many times, so it must read small |
| Friends | `hoiho`, `kiwi`, `pukeko`, `kereru`, `takahe` × `wait`, `cheer` | one new pool friend per Golden Fish |
| Backs | `back-across-day`, `back-across-silver`, `back-across-evening` | calm water right across the scene, a bank at each side, for the stepping stones |
| Home card | `card` | goes to `src/assets/home/korora.webp`, Marble Rush card style |

## Steps

1. Check ComfyUI is up: `curl http://100.97.96.115:8188/system_stats` (Tailscale).
2. Paint pebbles first to check the style: `python3 scripts/korora-art.py paint ~/dragon-art-inbox/korora-art/set pebble-grey pebble-gold --tries 2`.
3. Paint the rest with 2 tries each: `python3 scripts/korora-art.py paint ~/dragon-art-inbox/korora-art/set --tries 2`.
4. Pick the best try of each into `docs/korora-art/picks.json` (`{"name": try}`).
5. Tidy into the game: `~/.cache/rembg-venv/bin/python scripts/korora-art.py tidy`.
6. Run `npx vitest run src/games/korora`, look at `npm run korora:single`, commit and push.

## Rules for the prompts

- Positive wording only: the model draws whatever is named.
- No numbers or writing in any picture.
- Sprites on plain white so rembg can cut them out.
- The backgrounds keep the middle band calm so the reflection and fish read clearly.
