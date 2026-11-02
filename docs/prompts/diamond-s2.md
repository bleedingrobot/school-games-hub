# Prompt: Diamond Drop Stage 2 (screens, drawn art, phone preview and the art plan)

Paste everything below the line into a new Claude session opened in `~/games-hub-claw`.

---

You are continuing **Diamond Drop** (short id `diamond`, CSS prefix `.dd-`, branch `claw`) for James's **School Games Hub**. James teaches Years 4–6 at Douglas Park School, and the hub has games for his class. Diamond Drop is an **original** claw-and-winch digging game: a claw swings at the top of a cut-away view of the ground, one Drop button grabs gems, and pupils work down 10 levels towards a Heart Diamond. Rare gems can slip on the way up, and a maths question from the pupil's own focus ("Hold on!") keeps them. Reply to James in plain, simple words, without jargon, file paths or commit hashes unless he asks. **Ask James every question on clickable cards** (AskUserQuestion), your recommendation first. Use Sonnet or Haiku helper agents whenever they fit (searching, reading widely, writing lists and prompts, reviewing screenshots, checking tests, routine edits); no need to ask.

Stages 0 (the plan) and 1 (the rules engine and simulator) are done. **This session builds Stage 2: the screens with drawn (code) art, a phone preview James can try without signing in, and the art plan so James can start painting.** There's no server or database yet: the preview runs the shared rules in the browser.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Read `docs/DIAMOND-PLAN.md` all the way through, especially:
   - Section 3 (the rules), section 7 (screens), section 8 (Nugget, the new-player guide) and section 9 (painted art).
   - **"Stage 1 results"** at the end: what each file in `shared/diamond/` does, and the decisions made.
3. Read `docs/DIAMOND-RULES.md` and skim `shared/diamond/` (`config.ts`, `engine.ts`, `field.ts`, `progress.ts`, `workshop.ts`, `nextStep.ts`). The screens must use these, not copies of the rules.
4. Copy the shape of Star Trader, the newest game: `src/games/trader/` (screens, `trader.css`, `switch.ts`, `trialBackend.ts`, `index.tsx`), `preview/trader/` + `vite.trader-preview.config.ts`, and `docs/TRADER-ART-PLAN.md`. For the accessibility test, copy Clan Quest's `Accessibility.test.tsx`.
5. Work only in this worktree, on branch `claw`. Never commit to `main`, never `supabase db reset`, and push only with `git push origin claw`. Merge `origin/main` into the branch first (`git fetch`, then `git merge origin/main`). Run `npm ci` if `node_modules` is missing.
6. Keep the game original. Take nothing from the gold-miner repo the idea came from (no code, art, names or numbers): the genre idea only.

## Decided by James (2 Nov 2026)
- Everything in the plan's "Decisions" and section 13, plus Stage 1's: 10 levels, one new level a day (New Zealand date, unlimited tries until passed), the clock pauses during Hold on!, a wrong answer drops the gem back into the rock, boosts for the next level only, the Claw Workshop (looks only, kept through New Season, special of the week).
- **Keep the climb at about 3 weeks** for pupils playing 3 to 4 days a week. Don't retune the levels to slow it down.
- **High-quality painted art** from James's gaming PC (ComfyUI). This stage writes the art plan and style mock-ups; the paintings come in later, and the drawn art stays as the fallback for good.

## What to build
1. **The game's own folder, `src/games/diamond/`**, switched off:
   - `switch.ts` with the code switch **off** (`ON = false`, plus `VITE_DIAMOND_ON` for your own computer, as in the guide section 7). **Don't** add the game to `src/games/registry.ts` yet: that is a merge-step change.
   - `index.tsx` (the `GameDefinition`, group `complex-maths`), `diamond.css` (every class starts `.dd-`, the hub's colour tokens and shared buttons outside the play area), and a `trialBackend.ts` with the same shape the real server will have in Stage 3 (`levelStart`, `answer`, `levelEnd`, `buy`, `wear`, `load`).
2. **The screens** (plan section 7), each moving focus to its heading:
   - **Level map:** the depth gauge as a cut-away of the ground, each level a chamber, locked ones dark, "opens tomorrow" once today's level is passed, the deepest level marked, the diamond glowing at the bottom. Buttons: Play, Shop, Workshop, Gem Book, How to play. The next-step line (`nextStep`) always shown, with a "Show me" that lights up its button.
   - **Play:** drawn on a `<canvas>` from the engine's state, stepped at 30 ticks a second with `step`, recording each Drop's tick. The winch and claw at the top, the field below, the clock, the target bar, a big Drop button (also Space, Enter, or tapping the field), Pause and Finish (once passed). Crabs scuttle (`thingAt`). Draw from the engine's shots and state only: never change the rules for the look.
   - **Hold on!:** the shared `QuestionModal` over the frozen moment, the clock stopped. In the preview the questions come from a fixed fake focus (see 4). The claw grips on a right answer; on a wrong one the gem tumbles to where `answer` says it landed.
   - **Level end:** passed or "So close!", gems caught, coins kept (say the real number: a try that falls short keeps 12%), stars, then on to the shop.
   - **Shop:** the 4 boosts with prices as sums ("You have 85. Lucky Charm 45. You'll have 40 left"), at most one of each, the free boost from a sack.
   - **Workshop:** the 6 slots, every upgrade with its rarity and price, the special of the week first, earned ones showing how to win them, "try it on" on a swinging claw, buy and wear.
   - **Gem Book:** a page per gem, how many caught and the first date; unknown gems as shadows; the diamond last.
   - **How to play:** numbers read from `config.ts`, so changing a number changes the page.
3. **Drawn art in code** for everything: the 10 level backgrounds (layers of earth that get deeper and stranger: topsoil, clay, gravel, glow-worms, crystals, a lake, fossils, hot springs, magma, the diamond heart), the 10 gems (easy to tell apart at small size, by shape as well as colour, for colour-blind pupils), rocks, sacks, crabs, the winch and claw (open and closed), Nugget the kiwi in a hard hat, and a simple drawn version of **every** Workshop upgrade. The six claw-head, rope and trail looks must show on the swinging claw. Trails and catch effects are drawn in code; with reduced motion they become a small still glow.
4. **The phone preview:** `preview/diamond/` + `vite.diamond-preview.config.ts` and a `diamond:preview` script added at the **end** of `package.json`'s `scripts`. It uses a fake signed-in pupil, the trial backend, and a fixed fake focus and facts. **It must never call the live server.** Add a preview-only way to start the next level today and to give coins, so James can see every level and the Workshop without waiting days. Build it as a single page and publish it as a **private Artifact** for James to try on his phone.
5. **`docs/DIAMOND-ART-PLAN.md`** (copy the shape of `docs/TRADER-ART-PLAN.md`): every picture needed, its size, a ComfyUI prompt for each, and batches so each can go live on its own (see plan section 9: about 40 for the game plus about 40 for the Workshop, and the home page card). Make 2 or 3 **style mock-ups** of one level (for example a bright storybook painting, a richer glowing cave look, and a cleaner flat look) as screenshots or a small Artifact, and ask James on a card which style to paint in.
6. **Accessibility:** 44 px targets, 4.5:1 contrast, visible keyboard focus, `prefers-reduced-motion` respected (no shake, sparkle or swaying background; the swing stays, with a slower-swing setting). Check it at 1366 × 640 (classroom Chromebook) and 844 × 390 (phone) in the browser pane, and screenshot both for James.

## Tests (at most 8 for the whole game; Stage 1 used 3, this stage uses 2)
- **Screen test 1:** the accessibility check, copied from Clan Quest's (contrast, target size, reduced motion, read from `diamond.css`).
- **Screen test 2:** the main screen opens and the main button works: from the level map, Play starts level 1, Drop records a press, and the level can reach its end screen (use the trial backend).
- Run them with `npx vitest run shared/diamond src/games/diamond`. No tests of wording, colours or tuning numbers.

## When done
- Run `npm run check` (type check, every test and the build). If a few busy-computer timeouts fail, re-run them alone with `--testTimeout=30000` and say so.
- In `docs/DIAMOND-PLAN.md`, write a "Stage 2 results" section: what you built, decisions you made, screenshots taken, what is untested, the art plan's batches, and any questions for James.
- Commit, then `git push origin claw`. Update the memory note `diamond-drop.md`.
- Give James the preview link and tell him in a few plain sentences what to try on his phone and which art style needs his choice (on cards). Then stop: Stage 3 (the server function and the database) is a separate session.
