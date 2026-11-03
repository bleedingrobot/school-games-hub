# Star Forge: pick up where we left off (branch `trader-system`)

Reply to James in plain, simple words. Work only in the worktree `/Users/jriley/games-hub-trader-system` (branch `trader-system`). Start with `git -C ~/games-hub-trader-system status` and `git log --oneline -10`. Nothing is live: the Forge's migration is on hold (`supabase/migrations-on-hold.txt`) and nothing is deployed.

## Read first
- `docs/TRADER-SYSTEM-PLAN.md`: the whole plan. James's decisions: at a New Season pupils choose to keep their system or save a picture and keep their ship and credits; pupils TYPE their own names, rude words refused, classmates see them; planets must be "quite a bit bigger".
- `docs/TRADER-SYSTEM-ART-PLAN.md` and `docs/prompts/trader-forge-paint.md`: the paintings.
- `shared/trader/system.ts` (catalogue and rules), `shared/trader/names.ts` (rude-word filter), `src/games/trader/forge/` (the Forge screens), and `src/games/trader/forge/viewer/` (the three.js viewer).

## Where it stood (3 Nov 2026, evening)
Done and committed: the plan, the catalogue and rules, the server side (switch, kept systems, season choice, Star Makers), the simulator (orbital ring raised to 20,000, domes to 4,000), the Forge tab, the New Season choice screen, the 3D viewer with drawn stand-in art, its preview (`.claude/launch.json` entry `trader-forge-viewer`, port 5211), the painting plan and scripts, and the typed-name rule (`label` on sun, planets and system).

**Possibly unfinished when the session ended.** Check `git status` and the diff for each:
1. **Viewer fixes.**
   - A hard black half-disc on the ocean planet's close-up (planet 3 in the "Lush yellow star" example).
   - Planets much bigger in the whole-system view: roughly 40–70 px across at 1366×768 by size, with the sun not swamping them, and readable in the Forge's smaller box.
   - A brighter black-hole disc with visible light bending.
   - The ring world as a solid band with land inside.
   - No empty label boxes.
   - Labels use `pieceName()`.
   - Typecheck was failing in `viewer/index.ts` around line 493 mid-edit.
2. **Typed names, screens and teacher.**
   - A "Type a name" box in the Picker that checks with `checkTypedName` as you type, with the word lists below.
   - `trader_forge_typing` added to the on-hold migration `20261103000300_trader_forge.sql`.
   - The handler passes `forgeTyping`, with the trader function rebuilt (`npm run build:functions -- trader`).
   - `teacher_clear_trader_names(target)`.
   - On the Teacher page: the switch, and a "Clear Forge names" button.
   - Trial backend: typing on.
   - 2 pgTAP checks and 1 screen test.
   Finish whatever is missing. Use Sonnet helpers.

**Paintings.** All three batches were queued unattended on the gaming PC. The progress log is `~/dragon-art-inbox/trader-forge-art/paint-log.txt`; it ends with "ALL DONE". The pictures are in `~/dragon-art-inbox/trader-forge-art/<group>/`.
- If it stopped or the PC was off, check it with `python3 scripts/trader-forge-art-gen.py --check`, then re-run `batch1`, `batch2` and `batch3` in the background. It skips pictures already painted.
- Only one copy should run at a time: check with `pgrep -fl trader-forge-art-gen` first.

## Then
1. Make the code changes above pass: `npx tsc --noEmit -p .` and `npx vitest run shared/trader src/games/trader supabase/functions/trader`. Commit.
2. **Tidy each finished batch:** `~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py <groups>` with `--sheets DIR` for contact sheets.
3. **Look at every picture.**
   - Do the Year 4–6 child-safety and quality checks in section 6 of the art plan.
   - Remake bad ones once: `--only <group>/<name>`.
   - Batch 1 test pictures `planets/rocky-0` and `planets/ocean-0` looked good. `rocky-0` had a couple of bright star-like dots; remake it if they show on the globe.
   - Sonnet helpers can look through the contact sheets.
4. **See the paintings in the viewer.** Use the `trader-forge-viewer` preview, and the Forge tab in the Star Trader preview (`vite.trader-preview.config.ts`, port 5212). Check close-ups, the wide view with bigger planets, and the three graphics levels.
5. **Review page for James.** Make a private artifact of the paintings, with screenshots of the viewer using them. Send him the link.
6. **Commit the tidied `.webp` files.** If the `-hd` copies come to more than about 100 MB, ask James on a card before committing them (art plan section 8).
7. Update the plan's Status line and the memory note `star-trader-forge.md`. Ask James (cards, recommended first) about plan section 13 questions 2–6 if still open.

**Not yet:** going live. That needs James's OK and follows `docs/GAME_DEVELOPMENT_GUIDE.md` section 8: the code switch, the migration taken off hold, and the trader function deployed. Also not started:
- the class gallery, stickers and the teacher's projector tour (stage S.8)
- uploading the New Season picture to the profile album (a later step that needs storage and the shared profile page, with James's OK)
- achievements and points (the trader has none wired yet)
