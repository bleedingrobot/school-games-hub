# Star Forge: pick up where we left off (branch `trader-system`, after 4 Nov 2026)

Reply to James in plain, simple words. Work only in the worktree `/Users/jriley/games-hub-trader-system` (branch `trader-system`). Start with `git -C ~/games-hub-trader-system status` and `git log --oneline -10`. Nothing is live: the Forge's migration is on hold (`supabase/migrations-on-hold.txt`) and nothing is deployed. Use Sonnet helpers for looking through contact sheets and other routine checks.

## Read first
- `docs/TRADER-SYSTEM-PLAN.md`: the whole plan. All the questions in section 13 are answered (4 Nov).
- `docs/TRADER-SYSTEM-ART-PLAN.md` section 8: the 4 Nov notes, including the 14 maps to repaint.
- Review page sent to James on 4 Nov: https://claude.ai/artifact/Nz5fPT6J9KBaEgjZ4T2gEQ (now with a Gallery section)

## Where it stood (4 Nov 2026, end of day)

**Committed on `trader-system`:**
- All the paintings except 14 weak planet maps (64 MB). Planets keep the big `-hd` copy only for the best 2 surfaces of each kind (`HD_PLANETS` in `scripts/trader-forge-art.py`).
- Six new night skies. Painted skies are dimmed in the viewer (`PAINTED_SKY_BRIGHT` in `viewer/index.ts`).
- Forge pieces show only once the pupil can afford them, with a "🔒 N more appear as you earn credits" line. Bolt's tips are reworded to match, and there is a test for it.
- **S.8 sharing (4 Nov afternoon, commit `976c7ab`):** the 🌌 Gallery tab (classmates' built systems, own first), gallery pictures drawn by each pupil's browser and saved by the trader function in the private bucket `trader-gallery` (at most every 5 minutes, never on Simple graphics), six preset stickers (counts only for the owner), look-only visits in full screen, and the teacher's "Show the class's systems" projector tour on the Star Trader settings. All in the on-hold migration `20261103000300_trader_forge.sql` (never applied live; checked 4 Nov). The preview has "Pretend classmates (Gallery)", "Pretend I built a system" and "Teacher's projector tour" in its tools. Tests: `handler.test.ts`, `supabase/tests/database/trader_gallery.test.sql`, `TraderGame.test.tsx`, `forge/ProjectorTour.test.tsx`. The screenshot script for headless Chrome is described in step 4.
- James's answers are in the plan: claim a star at about 3,000 first; affordable pieces only; keep as many silly pieces as possible; portraits later; stickers from a fixed set; New Season credits all carried over, up to a cap.

**Not committed, waiting for a repaint on the gaming PC:** `donut-1`, `donut-3`, `ringworld-1`, `ringworld-3`, `eyeball-0` to `eyeball-3`, `shattered-0`, `shattered-1`, `shattered-3`, `jungle-0`, `ocean-3` and `ice-2`. The old versions are still on disk, untracked, in `src/games/trader/forge/art/paint/planets/` and `buttons/surface-*`. Their prompts are already reworded in `scripts/trader-forge-art-gen.py`.

## Then
1. **Repaint the 14 (only when James is at home with the gaming PC on).** Check that ComfyUI is up, then run:
   `python3 scripts/trader-forge-art-gen.py --only planets/donut-1,planets/donut-3,planets/ringworld-1,planets/ringworld-3,planets/eyeball-0,planets/eyeball-1,planets/eyeball-2,planets/eyeball-3,planets/shattered-0,planets/shattered-1,planets/shattered-3,planets/jungle-0,planets/ocean-3,planets/ice-2`
   The old ones go to `_old/` by themselves. The log is `~/dragon-art-inbox/trader-forge-art/paint-log.txt`.
2. **Look at them.** Use a contact sheet with a Sonnet helper, then check by eye. Look for no drawn object in the middle, no Earth continents and no bars. The eyeball maps should be upright stripes: ice, land, sunlit middle, land, ice. Repaint any that are still poor, but only once more.
3. **Tidy:** delete those 14 (with `-normal` and any `-hd`) from `src/games/trader/forge/art/paint/planets/` and the matching `buttons/surface-*.webp`. Then run `~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py planets buttons`. Check that `HD_PLANETS` still picks the best 2 per kind; the eyeball and shattered picks were made before the repaint.
4. **Restart the `trader-forge-viewer` preview server** (Vite's file list goes stale), then take headless Chrome photos of the donut, ring world, eyeball and shattered planets. Use the command in the old prompt's style: `?d=Black&f=2&level=incredible&still&shot` and so on, and give each run its own `--user-data-dir`. The Forge picker and the gallery can be photographed by driving headless Chrome over `--remote-debugging-port=9333` (started with `--headless=new --use-angle=metal --enable-gpu`) with a small Node script that clicks buttons by their text and calls `Page.captureScreenshot`; on 4 Nov it clicked Start trading, Skip First Flight, the preview tools, then the tabs.
5. **Run the checks:** `npx tsc --noEmit -p .` and `npx vitest run shared/trader src/games/trader supabase/functions/trader`. Then commit, and update the review page (same URL) with a "Repainted" section.
6. **Update** the art plan section 8, the memory note `star-trader-forge.md`, and this prompt.

**Not yet:** going live. That needs James's OK and `docs/GAME_DEVELOPMENT_GUIDE.md` section 8: the code switch, the migration taken off hold, and the trader function deployed. Also not started:
- the New Season picture upload to the profile album
- achievements and points
- more silly pieces (James wants as many as possible)
- a closer camera for the gallery pictures, if James asks (systems with a bright sky show small planets)
