# Ruru's Number Trail — art plan

The game will ship with clay-look SVG stand-ins drawn in code (`src/games/ruru/RuruArt.tsx`, stage 3). The final pictures
are painted in ComfyUI on James's gaming PC with `scripts/ruru-art.py` (clay style B, the same as Kiwi's Beanstalk), the
way Weka and Pipi were painted. Each picture shows up in the game as soon as it is tidied in; anything not painted keeps
its stand-in.

## Reused, not painted

`python3 scripts/ruru-art.py reuse` copies these into `src/games/ruru/art/paint/friends/` (run it in stage 3):

- `ruru-wait`, `ruru-cheer` from Kiwi's Beanstalk, so Ruru is the same owl. If they face left, the game flips them.
- `kiwi-`, `weta-`, `tuatara-` `wait` and `cheer` from Hop's Glow-worm Pond (three of the five friends).

## Pictures to paint (21)

| Group | Names | Notes |
| --- | --- | --- |
| Ruru | `ruru-fly`, `ruru-swoop`, `ruru-perch` | Beanstalk's exact Ruru words (purple scarf), **facing right**; the game turns her round to fly back for "one less" |
| Owlets | `owlet-wait`, `owlet-hoot` | hold up a blank sign; the number for "which is more?" is drawn on it in code. Two owlets on screen, one tinted a little lighter |
| Trail | `post`, `lantern-square` | drawn 11 to 21 times in a row, small, with numbers drawn on top in code: pale, plain and calm so dark numbers read clearly. The square is the track at help levels 5 and 4 |
| Magic lanterns | `lantern-grey`, `lantern-gold` | the ten on the posts; bronze and silver are tinted from gold |
| Things | `moth`, `golden-moon`, `golden-moon-cushion`, `sparkle` | the moth is what Ruru carries and the "where does it go?" marker; the Golden Moon is the 30-day prize |
| Friends | `kakapo`, `pekapeka` × `wait`, `cheer` | the two new night friends, facing right |
| Backs | `back-night`, `back-silver`, `back-gold` | a moonlit hillside from the side, a plain calm grassy band across the lower middle for the trail |
| Home card | `card` | goes to `src/assets/home/ruru.webp` (then add one line to `src/components/gameCardArt.ts`) |

## Steps

1. Check ComfyUI is up: `curl http://100.97.96.115:8188/system_stats` (Tailscale).
2. Paint Ruru and the trail first to check the style:
   `python3 scripts/ruru-art.py paint ~/dragon-art-inbox/ruru-art/set ruru-fly post lantern-square lantern-gold --tries 2`.
3. Paint the rest with 2 tries each: `python3 scripts/ruru-art.py paint ~/dragon-art-inbox/ruru-art/set --tries 2`.
4. Pick the best try of each into `docs/ruru-art/picks.json` (`{"name": try}`).
5. Tidy into the game: `~/.cache/rembg-venv/bin/python scripts/ruru-art.py tidy`.
6. Run `npx vitest run src/games/ruru`, look at `npm run ruru:single`, commit and push.

## Rules for the prompts

- Positive wording only: the model draws whatever is named.
- No numbers or writing in any picture (the owlets' signs are blank).
- Sprites on plain white so rembg can cut them out.
- Every creature faces right.
- Night scenes, but the trail band stays plain and the posts pale, so the numbers read on a Chromebook.
