# Penguin Pairs — art plan

The game ships with clay-look SVG stand-ins (`src/games/korora/KororaArt.tsx`). The final pictures are painted in
ComfyUI on James's gaming PC with `scripts/korora-art.py` (clay style, the same as Beanstalk and Hop), the way Hop and
Pipi were painted.

## Pictures (27)

| Group | Names | Notes |
| --- | --- | --- |
| Kororā | `korora-wait`, `korora-dive`, `korora-gulp`, `korora-cheer` | little blue penguin with a red knitted scarf |
| Pebbles | `pebble-grey`, `pebble-gold` | bronze and silver are tints of grey in code; numbers are drawn in code |
| Things | `chick-wait`, `chick-happy`, `fish`, `golden-fish`, `golden-fish-cushion`, `splash`, `sparkle` | the fish is drawn many times, so it must read small |
| Friends | `hoiho`, `kiwi`, `pukeko`, `kereru`, `takahe` × `wait`, `cheer` | one new pool friend per Golden Fish |
| Backs | `back-day`, `back-silver`, `back-evening` | rock pool with a calm mirror line across the middle third |
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
