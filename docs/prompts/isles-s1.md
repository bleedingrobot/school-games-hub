# Prompt: Sky Isles stage S.1 (the rules engine: races, starterRace, nextStep, tests 5 and 6)

Paste everything below the line into a new Claude session opened in `~/games-hub-isles`.

---

You are continuing **Sky Isles** (short id `isles`) for James's **School Games Hub**. James teaches Years 4–6 at Douglas Park School, and the hub has games for his class. Sky Isles is an **original** kingdom-building game in the genre of Immortal Barons: each pupil grows a floating island in a sky shared by the class. Reply to James in plain, simple words, without jargon, file paths or commit hashes unless he asks. Use Sonnet or Haiku helper agents whenever they fit (searching, reading widely, checking tests, routine edits); no need to ask.

Stage S.0 (rules, config, simulator and rule sheet) is done. The look is chosen too (stage S.L): **hand-painted anime**. **This session builds stage S.1: finish the rules engine in `shared/isles/` so that every rule the game needs is a pure, seeded function, with tests 5 and 6.** There's nothing to play yet: no screens, server or database.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Read `docs/ISLES-PLAN.md` all the way through. Pay most attention to:
   - Sections 1–5 (the turn, plots, upgrades, and classmates: races, ropes, market, news).
   - Section 6 (maths, way A).
   - The guided first go and `nextStep`.
   - Section 10 (tests), section 11 (stages) and section 13 (stage results), including **"Rule change: building spots and levels, 2 Nov 2026"**.
3. Read `docs/ISLES-RULES.md`. Then read every file in `shared/isles/` (`config.ts` holds every number; `engine.ts` is the turn) and `scripts/isles-sim.mjs`.
4. Work only in this worktree, on branch `isles`. Never commit to `main`, never `supabase db reset`, and push only with `git push origin isles`. Merge `origin/main` into the branch first (`git fetch`, then `git merge origin/main`).
5. Keep the game original. No rules, numbers or names from Immortal Barons or Barren Realms Elite.

## Where things stand (2 Nov 2026)
- **Building spots with levels.** An island starts with 6 spots and becomes a Grand Isle at 16. Every building has levels 1 to 3, and actions name a spot (`build`, `raise`). A chunk of land costs 85 × the spots the island already has. The drift is 1 chunk a day, and up to 3 can wait. James chose this because 40 small plot tiles looked crowded.
- **Race prizes are coins and goods, not land.** The day's first win brings 30 coins and 5 goods; a later win brings 15 coins. The other island gets a small "well raced" gift, and nobody ever loses anything.
- **Upgrades renamed:** Tall Houses is now Bunk Beds, and Bright Docks is now Welcome Lanterns.
- **Simulator pace:** daily players reach Grand Isle in week 3, and 3-days-a-week players in week 4. The simulator only guesses races (an even chance each).
- **Known issues to keep in mind (not this stage's job unless they fall out naturally):**
  - A pupil who plays 1 day a week doesn't reach Grand Isle (about 8 or 9 spots).
  - Coins pile up once the Lighthouse is lit.

## What to build (all pure functions, seeded, numbers in `config.ts`)
1. **Sky Races** (plan section 4):
   - Three questions per race. Each right answer adds a gust to your boats.
   - Sky-boats from the Workshop and Swift Sails matter, but a race must stay close enough that a small island can win.
   - The result comes only from the race's seed and the marked answers, so the server can decide it later and the browser can't rig it.
   - At most 2 races a day, one a turn. Prizes as above, and the "well raced" gift for the other side.
   - The **Gull Riders** are a computer crew that is always free to race.
   - Return what the race animation needs, such as each boat's position over time.
2. **`starterRace`:** the first race, against the Gull Riders during turn 2's guide, can't be lost whatever the answers.
3. **`nextStep(island)`:**
   - One short sentence with real names and numbers, plus which button it means (for the "Show me" button).
   - Example: "Your food runs out in 2 turns: build a Farm on your empty spot".
   - It must cover spots and levels: an empty spot, food running out, people crowded, a building worth raising, a chunk waiting in the drift, an upgrade ready, the Lighthouse.
   - Write it in the plain words a 9-year-old reads easily.
4. **Anything else S.1 lists that is still missing** from the engine (check the plan's stage table against `engine.ts`).
5. **Put races into the simulator** in place of the guessed even chance, re-run `npm run isles:sim`, and check the pace still holds. Update the pace table in `docs/ISLES-RULES.md` if it moved.

## Tests (at most 8 for the whole game, per the guide)
- **Test 5:** a turn rolls the same from the same seed and choices, so the server and the preview agree. Include a race.
- **Test 6:** `starterRace` can't be lost on any of 1,000 seeds.

## When done
- Run the type check and the tests.
- Update `docs/ISLES-RULES.md` and `docs/ISLES-PLAN.md`: write up "S.1 results", and list any questions for James.
- Commit, then `git push origin isles`.
- Tell James in a few plain sentences how a Sky Race works now, and whether the pace changed. Then stop: S.2 (the island screen) is a separate session.

## Art, for reference only (not this stage)
- The paintings are in `~/isles-art-inbox/`. Building levels are in `levels/` and the Sky Keepers are in `keepers/`.
- `scripts/isles-art.py` paints them on James's gaming PC.
- The live picture page is https://claude.ai/artifact/X2QffjCFwbVNAyFcWy73CQ (read it with the Artifact tool). James's picks are outlined in gold there.
- Dark skin tones on a few Sky Keepers (b06, g06, b11 and g11) still paint too light. Fix that by hand when the pictures are tidied for the game.
