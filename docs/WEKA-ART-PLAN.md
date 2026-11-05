# Weka's Stepping Stones — art plan

**Status: all 26 painted 5 Nov 2026 (2 tries each, picks in `docs/weka-art/picks.json`; the tries are on branch
`weka-art-inbox`).** The big rock, takahē and kiwi were repainted the same night with clearer prompts (tries 3 to 5). Big rock
try 6 is try 4 with a stray small pebble below it painted out; the kiwi still shows small wings.

The game ships with clay-look SVG stand-ins (`src/games/weka/WekaArt.tsx`). The final pictures are painted in ComfyUI on
James's gaming PC with `scripts/weka-art.py` (clay style, the same as Kiwi's Beanstalk), the way Penguin Pairs and Pipi
were painted. Each picture shows up in the game as soon as it is tidied in; anything not painted keeps its stand-in.

## Pictures (26)

| Group | Names | Notes |
| --- | --- | --- |
| Weka | `weka-wait`, `weka-hop`, `weka-land`, `weka-cheer` | brown bush bird, green knitted scarf, **facing right** (the game turns it round to hop back) |
| Stepping stones | `step-stone`, `big-rock` | drawn 16 to 20 times in a row, small, with numbers drawn on top in code: plain, flat tops. The big rock (10) is wider and sandy-gold so it always stands out |
| Magic stones | `stone-grey`, `stone-gold` | the ten on the far bank and the answer stones; bronze and silver are tinted from gold |
| Things | `golden-basket`, `golden-basket-cushion`, `splash`, `sparkle` | the Golden Picnic Basket is the 30-day prize |
| Friends | `kiwi`, `takahe`, `kakapo`, `pukeko`, `kea` × `wait`, `cheer` | one new friend per Golden Picnic Basket, all facing right |
| Backs | `back-morning`, `back-silver`, `back-evening` | a bush stream from the side, calm plain water across the middle band for the line of stones |
| Home card | `card` | goes to `src/assets/home/weka.webp` (then add one line to `src/components/gameCardArt.ts`) |

## Steps

1. Check ComfyUI is up: `curl http://100.97.96.115:8188/system_stats` (Tailscale).
2. Paint Weka and the stones first to check the style: `python3 scripts/weka-art.py paint ~/dragon-art-inbox/weka-art/set weka-wait step-stone big-rock stone-gold --tries 2`.
3. Paint the rest with 2 tries each: `python3 scripts/weka-art.py paint ~/dragon-art-inbox/weka-art/set --tries 2`.
4. Pick the best try of each into `docs/weka-art/picks.json` (`{"name": try}`).
5. Tidy into the game: `~/.cache/rembg-venv/bin/python scripts/weka-art.py tidy`.
6. Run `npx vitest run src/games/weka`, look at `npm run weka:single`, commit and push.

## Rules for the prompts

- Positive wording only: the model draws whatever is named.
- No numbers or writing in any picture.
- Sprites on plain white so rembg can cut them out.
- Every bird faces right.
- The backgrounds keep the middle band of water calm so the numbered stones read clearly.
