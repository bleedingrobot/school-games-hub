# Prompt: Sky Isles, pick up tonight's paintings (after 3 Nov 2026)

Paste everything below the line into a new Claude session opened in `~/games-hub-isles` (branch `isles`).

---
You are continuing **Sky Isles** (short id `isles`) for James's **School Games Hub** (Years 4–6). Reply to James in plain, simple words, no jargon or file paths unless he asks. Ask questions on clickable cards (AskUserQuestion), recommended option first. Use Sonnet helpers for judging pictures and Haiku for quick jobs, without asking. Push only with `git push origin isles`. Never draw art in code.

## Where things stand
- On 3 Nov 2026 the gaming PC (ComfyUI, `http://100.97.96.115:8188`) was sent a long painting job: `~/isles-art-inbox/paint-all.sh`, logging to `~/isles-art-inbox/paint-all-log.txt` (it ends with `ALL DONE`). It skips tries already painted, so if it stopped early, check the PC answers (`curl -s http://100.97.96.115:8188/system_stats`) and run it again: `nohup ~/isles-art-inbox/paint-all.sh > ~/isles-art-inbox/paint-all-log.txt 2>&1 &`.
- The words for every picture are in `scripts/isles-art.py` (`PICTURES`). What was painted:
  1. **Cosy batch (stage C.A, `docs/prompts/isles-cosy-art.md`), 6 tries each:**
     - Repaints in `~/isles-art-inbox/levels/`: `bld-farm-2`, `bld-farm-3`, `bld-workshop-1`, tries **4–9**. Tries 1–3 are the old pictures. Try 4 of `bld-farm-2` was checked: no wheat slab, good.
     - `base-garden` in `~/isles-art-inbox/levels/`, tries 1–9.
     - In `~/isles-art-inbox/art/`, tries 1–6: `dec-…` (12), `walker-1…6`, `icon-coin`, `icon-crystal`, `gift-flowers/cake/lantern`.
  2. **Stage S.7, cosy version, 3 tries each, in `~/isles-art-inbox/art/`:**
     - `weather-rainbow/geese/traveller/breeze`
     - `lighthouse-1…4` (cut-outs)
     - `boat-gulls` (the Gull Riders' boat)
     - `scene-night` ("see you tomorrow"), `scene-season` (season's end), `scene-hall` (Hall of the Skies)
     - `home-card` (the home page card)
     - Fog, storms, the market and upgrades were dropped by the cosy rules, so they aren't painted.

## What to do
1. Read `docs/ISLES-ART-PLAN.md` ("Checks for every picture"), `docs/ISLES-COSY-PLAN.md` and `docs/prompts/isles-cosy-art.md` ("Picking and putting them in").
2. A Sonnet helper looks at each set of tries beside the existing pieces (`src/games/isles/art/bld-*.webp`, `base-*.webp`) and suggests a pick with one short reason. It checks: right for 8 to 11-year-olds, no melted shapes or lettering, the same light, grass and three-quarter view.
3. Build one page with every try side by side and the suggested pick marked. `/private/tmp` may be gone, so recreate the page builder: thumbnails as webp data URLs, groups by kind, today's picture dashed beside the repaints. Publish it as a private Artifact and ask James on cards which to keep, a few groups per card ("Keep all suggested picks" first). Repaint anything he doesn't like, with more tries.
4. Add the picks to `docs/isles-art/picks.json`. Teach `tidy`:
   - `source()`: repaints and the garden are in `levels/`, the rest in `art/`.
   - Sizes in `PIECE_SIZE` are already there for dec, walker, icon and gift. Add `lighthouse` 384.
   - `boat-gulls` is a cut-out like the boats.
   - Weather cards and scenes are backgrounds (not cut out, like `bg-`), 1600 and 800 px wide.
   - `home-card` becomes `src/assets/home/isles.webp` (about 1600 px) and `isles-small.webp` (about 800 px), but only add it to `src/components/gameCardArt.ts` at go-live (a shared file).

   Then run `~/.cache/rembg-venv/bin/python scripts/isles-art.py tidy <names> --force`.
5. Wire the new pictures into the screens with their drawn fallbacks kept:
   - Decorations, walkers, the coin, the crystal, gifts and the garden are already looked for by name (`src/games/isles/art.ts`).
   - Still to wire: the weather cards on the turn report, the Lighthouse stages on Grand Isle, the Gull Riders' boat in races, the night scene on the resting screen, the season scene, and the Hall scene at the top of the Hall of the Skies.
   - After picking the garden, place its 20 decoration spots by hand (`GARDEN_PLACES` / `DECOR_PLACES` in `art.ts`).
6. Update `ISLES-ART-PLAN.md` (a "Cosy batch" section), `src/games/isles/art/CREDITS.md`, and the art test's expected files. Run `npx tsc --noEmit -p .` and `npm run test:all`. Rebuild and republish the preview to the same page, https://claude.ai/artifact/AbCJrV8AhotXCHaedgVe6V (`ISLES_INLINE=1 npm run isles:preview`, then `node scripts/inline-monsters-preview.mjs dist-preview-isles sky-isles-test-page.html`, then publish the file), then screenshot My island at laptop and phone width for James. Commit to `isles` and push.

## Also half-finished from 3 Nov
"New land" sparkles: when a chunk is anchored, the new spot gets a "✨ New land!" tag, a glowing ring and 48 looping sparkles, and the turn report says "Your island grew!". The code is committed. The tag shows, but the ring and sparkles looked faint in a paused screenshot. James asked for **lots** of sparkles, so check them playing in the preview (`isles-preview` launch config), make them bigger and brighter if needed, and republish.
