# Star Forge: pick up where we left off (branch `trader-system`, 4 Nov 2026)

Reply to James in plain, simple words. Work only in the worktree `/Users/jriley/games-hub-trader-system` (branch `trader-system`). Start with `git -C ~/games-hub-trader-system status` and `git log --oneline -8`. Nothing is live: the Forge's migration is on hold (`supabase/migrations-on-hold.txt`) and nothing is deployed. Use Sonnet helpers for looking through contact sheets and other routine checks.

## Read first
- `docs/TRADER-SYSTEM-PLAN.md`: the whole plan.
- `docs/TRADER-SYSTEM-ART-PLAN.md`: the paintings. Section 8 has the 4 Nov notes: night maps left out, first-look remakes.
- `scripts/trader-forge-art-gen.py` paints on the PC. `scripts/trader-forge-art.py` tidies the paintings into `src/games/trader/forge/art/paint/`.

## Where it stood (4 Nov 2026, morning)

**Committed:**
- **Viewer fixes:** bigger planets, the ocean close-up fixed, a brighter black hole with light bending, the ring world as a solid band with a better close-up, and labels using `pieceName()`.
- **Paintings in the viewer:**
  - Painted cloud maps use their brightness as cover. Before this they laid a black sheet over the planet.
  - Painted surfaces are lifted ×1.7, and only blue water shines.
  - The ring world loads its painting.
- **Art scripts:**
  - Reworded prompts for suns, gas giants, clouds, skies, buttons, crystal folk, microbes and the solar sail. Buttons must never say "icon": the model draws an app-icon glyph.
  - The cloud tidy step treats the darkest fifth as black, with a 1.7 curve.
  - The button tidy step trims a canvas-on-a-wall frame (`trim_frame`). This last change may not be committed yet; check `git status`.

**Painted and tidied, NOT committed:**
- Everything in `src/games/trader/forge/art/paint/`: about 108 MB, 90 MB of it `-hd` copies.
- Night maps were deliberately left out. The model painted Earth's continents, and the viewer draws its own city lights (`bakeShaders.ts`).
- One remake each has been used on:
  - 20 batch-1 pictures
  - 2 postcards
  - 36 buttons
  - the solar sail
- **Still poor after their remake:** `planets/donut-3` and `planets/ringworld-3`, which each have a shape drawn inside.
- `clouds/thick` uses its first painting, a full blanket. The remake came out as an Earth map and is kept in `_old/`.

**Last 6 skies:** `skies/0, 2, 4, 5, 6, 7` were being repainted with new "night sky photo, faint coloured band" prompts. The old ones were one giant galaxy with dark branchy lumps, which swamped the viewer. Skies 1 and 3 are kept.
- Check `tail ~/dragon-art-inbox/trader-forge-art/paint-log.txt` for "SKIES DONE".
- If they never finished: `pgrep -fl trader-forge-art-gen` first, then `python3 scripts/trader-forge-art-gen.py --only skies/0,skies/2,skies/4,skies/5,skies/6,skies/7`.

## Then
1. **Tidy the new skies.** Delete `src/games/trader/forge/art/paint/skies/{0,2,4,5,6,7}*.webp` and the derived `buttons/sky-*.webp`, then run `~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py skies buttons`. Look at them: they should be mostly black with stars and a faint band. If they still swamp the planets, dim the sky in the viewer (`extras.ts` `sky()`) rather than painting again.
2. **Decide donut-3 and ringworld-3** with James on a card. The options: paint once more with reworded prompts, or copy a good surface of the same kind over them.
3. **Run the checks:** `npx tsc --noEmit -p .` and `npx vitest run shared/trader src/games/trader supabase/functions/trader`, then commit the code and script changes.
4. **Take viewer photos with a headless browser.** The Browser pane runs in slow background mode and gives stale WebGL pictures.
   - Restart the preview server after adding art. Vite's `import.meta.glob` list goes stale: `allForgeArt().length` was 0 until a restart, so the first photos showed stand-in art.
   - `.claude/launch.json` entries (main checkout): `trader-forge-viewer` (port 5211) and `trader-forge-game` (port 5212, the whole Star Trader game with the Forge tab).
   - Preview URL options: `?d=<design name start>&f=<planet number|sun|wide>&level=<incredible|normal|simple>&still&shot`.
   - Command: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu-sandbox --use-angle=metal --hide-scrollbars --window-size=1366,768 --virtual-time-budget=30000 --screenshot=out.png "http://localhost:5211/?d=Lush&f=3&level=incredible&still&shot"`.
   - Take: each example design wide, close-ups (ocean, gas giant, ice giant, crystal, ring world, sun, black hole), all three levels, and a 700×400 Forge-box size.
5. **Review page for James.** Quickstart intent "other", then a plain private artifact with:
   - contact sheets per group (`scripts/trader-forge-art.py --sheets DIR <groups>`)
   - the viewer photos
   - the Forge picker with painted buttons
   - notes: remade pictures, night maps left out, the two weak surfaces, and the buttons' painted-canvas style mixed with the first, more photo-like ones
   Send him the link.
6. **Repo size.** The `-hd` copies are about 90 MB, more than the art plan's 100 MB-ish line once everything is counted. Ask James on a card (recommended first): commit them all, lower `HD_QUALITY`, or keep `-hd` only for the best 2 surfaces per kind. Then commit the `.webp` files.
7. **Update the plan and memory.** Update the plan's Status line and the memory note `star-trader-forge.md`. Ask James plan section 13 questions 2–6 on cards, recommended first. They are still unanswered.

**Not yet:** going live. That needs James's OK and `docs/GAME_DEVELOPMENT_GUIDE.md` section 8: the code switch, the migration taken off hold, and the trader function deployed. Also not started:
- the class gallery, stickers and teacher projector tour (S.8)
- the New Season picture upload to the profile album
- achievements and points
