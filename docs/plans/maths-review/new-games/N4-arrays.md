# Pūkeko's Raupō Rows (equal groups and arrays, then the times tables): plan N4

Short id `pukeko`. **Status: plan written 7 Nov 2026 for the fundamental maths review (docs/reviews/maths-review/DECISIONS.md, gap 4). Not built, no code changed.** Guide: the Pūkeko. Chosen from `docs/plans/maths-review/new-games/IDEAS.md`.

## 1. The problem

- **Gap 4 in DECISIONS.md.** Times tables are the most-asked content in the hub (a campaign of steps in `shared/maths/ladder.ts:61-77`, used by ten or so games), yet every question is the bare text `6 × 4 = ?` (`Question.parts`, `shared/maths/serverQuestions.ts:46-64`). `docs/reviews/maths-review/coverage.md` lines 62 and 162 onwards: array and equal-group meaning is P (quiz) at best, C (a real mechanic) nowhere; Penguin Pairs has only "two equal groups" (a double) and sharing between two chicks (`shared/korora/round.ts:1-5`).
- **A child can pass every times-table step without knowing what × means** (rote, research-maths.md Part 2, Number). A child who has 6 × 4 forgotten has nothing to rebuild it from.
- **The hub has no pre-multiplication game** between Hop's skip counting and the tables, so juniors go straight to recall.

## 2. The research behind it

- **Multiplication starts as equal groups and arrays, not as facts** (NCETM Year 2 and 3 spines "multiplication and division structures"; Oak National Academy "Multiplication as equal groups" and "Arrays"; Clements and Sarama's multiplication trajectory; research-maths.md Part 2, Number). Arrays make *commutativity* visible (3 rows of 6 turned is 6 rows of 3) and link straight to area.
- **The array's structure matters:** children who draw or see rows and columns do better than children who see a scatter (Battista and others 1998 on spatial structuring of arrays). So the array is always in neat rows and columns, and a hidden array always shows its first row and first column.
- **Derive from the facts you know** (NCETM "derived facts"; Baroody 2006): ×6 as ×5 plus one more row, ×9 as ×10 minus one row, doubles for ×2, ×4, ×8. The array is cut with a line to show it.
- **Speak it the same way each time** (NCETM stem sentences): "4 rows of 6 is 24. 4 times 6 equals 24." The equation arrives after the picture and stays tied to it (concreteness fading).
- **Fluency still matters**, so each go also records into the existing `mul:AxB` keys, so the child's stage in the hub's times-tables campaign moves too (see "What is recorded").

## 3. The change

- **Branch and prerequisites:** create `pukeko` from `origin/main` in its own worktree. The shared maths families are a separate small branch first, `maths-pukeko-keys`, because `shared/maths/` can't be changed from a game branch (GAME_DEVELOPMENT_GUIDE.md section 2). It adds the new `ladderOnly` families to `shared/maths/skillPacks/earlyFacts.ts` and their ladder skills to `shared/maths/ladder.ts` (all `inWarmUp: false, inAuto: false`, so an older pupil's auto practice never meets them), with the curriculum tag checked against the NZ curriculum. It goes live before the game.
- **Built the same way as Tūī and Weka** (`docs/TUI-PLAN.md`, `docs/WEKA-PLAN.md`, `docs/EARLY-GAMES-PLAN.md` section 7): same look (clay, style B), Bella's voice, 10 goes a day, a server that makes and marks every round, a saved `reached` step.

The times-table campaign order and key format are already shared (`shared/maths/ladder.ts`, `shared/maths/facts.ts`), so no shared maths changes except the new `ladderOnly` families.

### The game in plain words (and the section 1a answers)

Pūkeko stalks the swamp and plants raupō (bulrush) shoots in neat rows for the swamp garden. **Big goal:** the 10 rows of the swamp garden turn from muddy brown to bronze, silver and gold, one change per NZ day played (30 counted days), and the Golden Raupō Garden is the prize. A pupil playing 3 or 4 days a week gets there in 8 to 10 weeks. After it: a new friend's garden (Kererū, Kea, Weka, Tūī, Kōtuku) starts at the child's step.

**1a answers, briefly:**

1. **Big goal:** the 10 rows of the swamp garden (see above), 30 finished days, then the Golden Raupō Garden. Recommended: yes; the simulator check is a script `scripts/pukeko-sim.mjs` that plays a pupil at 3 to 4 days a week and checks the prize lands in weeks 8 to 10.
2. **Season game?** No, because help and steps follow the child and nothing piles up that a late joiner can't catch (as Tūī and Weka: counted days, not dates, a missed day loses nothing). So there is no `season_fn` and no season reset; `keep_achievements` is true. Nothing needs the school's season date.
3. **Moves a day:** no daily limit, because this is practice and more maths is simply good (Gem Keep, Bond Match). The first finished challenge of each NZ day changes one row of the garden; playing again that day is for fun and changes nothing (as Tūī). No hub points for the daily (the prize and achievements are the reward). So there is nothing for the "Unlimited today" switch or "moves left" to do, and no change to `shared/unlimited.ts` or `my_moves_left()`.
4. **Progress bars:** in the game, the 10 rows of the swamp garden and a step bar (reuse `LevelBar` from `src/components/Progress.tsx` where it fits); on the home page the hub's level bar and next achievements come for free. A bar never shows maths results to classmates and never ranks.
5. **Achievements** (built through `hub_games`: `counts_fn`, `achievement_measures`, `achievement_types` with `game = 'pukeko'`; no `rules_fn` points line):

| Name | What it's for | Measure | Goal | Roughly who | Survives New Season |
|---|---|---|---|---|---|
| First row | Plant your first rows | `pukeko_days` | 1 | 90% of pupils who play | Yes: no season, so nothing resets |
| Rows and rows | Finish 10 days | `pukeko_days` | 10 | 50% of pupils who play | Yes: no season, so nothing resets |
| Turn it round | Pass step 2 (turn the garden) | `pukeko_step` | 3 | 40% of pupils who play | Yes: no season, so nothing resets |
| Cut it up | Pass step 5 (the 6, 7, 8 cuts) | `pukeko_step` | 6 | 15% of pupils who play | Yes: no season, so nothing resets |
| Golden Raupō Garden | The big goal: 30 finished days | `pukeko_prizes` | 1 | 10% of pupils who play | Yes: no season, so nothing resets |

6. **Card art scene for James to paint** (`docs/HOME-ART-PLAN.md` style, then `src/assets/home/pukeko.webp` and a line in `src/components/gameCardArt.ts`): A golden-green swamp edge at dawn: a blue-purple pūkeko with a red beak and shield wades beside a neat grid of bright raupō shoots (four rows of six) in the mud, reeds behind; flat storybook style, no text.
7. **Built-in guide:** the Pūkeko herself, in Bella's voice. A first walk through as a new pupil:

| Moment | Why a new child gets stuck | The fix |
|---|---|---|
| Opens the game | A field, a number sentence, a button | Pūkeko says "Plant a row!"; the first go is one row of 2 shoots |
| First row plant | Child may tap the whole field | Only the next row slot is lit |
| Turn step | The garden spins and the numbers change places | The spin is slow, the shoot colours stay with their shoots |
| Under the mat | Hidden shoots feel like cheating | Mat edges show the first row and column; the tip says "Use the rows you can see" |
| Division | "Share" is unclear | A hand holds the heap; the first go shows the rows filling by themselves once |

   A guided first go (2 to 3 minutes, every step skippable, who gets it comes from the saved game: no days done), a next-step line that is always there with a "Show me" that lights the button it means, closable first-time tips, and a Lots / Some / Off help choice plus "Replay the guide" (copy Weka's `wekaGuide.test.tsx` shape). It never helps with the maths question itself, and it never chooses for the child. Its first go is chosen so it cannot fail (a pure function tested on many seeds).

### The levels and learning order

| Step | Name | Range | The new thing |
|---|---|---|---|
| 1 | Equal rows | 2, 5, 10 shoots in a row, up to 5 rows | Plant 4 rows of 5, one row at a time; count by rows (5, 10, 15, 20) |
| 2 | Turn the garden | 2, 5, 10 tables | The same shoots turned round: 3 rows of 5 is 5 rows of 3. Same total. |
| 3 | Under the mat | 3 and 4 times | A flax mat covers the garden except the first row and column; how many shoots? |
| 4 | Share them out | ÷2, 3, 4, 5, 10 | 24 shoots in 4 equal rows: how many in each row? (and how many rows if 6 in a row) |
| 5 | Cut the garden | 6, 7 and 8 times | A line cuts 6 rows into 5 and 1: 6 × 7 is 5 × 7 plus 7 |
| 6 | One row short | 9 times and mixed | 9 × 7 is 10 × 7 minus one row; every table mixed, weakest first |

- A step is **passed after two challenges at it with 8 or more of 10 right at the first tap** (Tūī's rule). The server saves the furthest step `reached`; the child never drops back. Inside a step the weakest keys come first (low Leitner box) and each challenge is about 7 new-kind goes to 3 earlier-kind goes.
- Each challenge is 10 goes; a go that needed more help after a wrong tap is still recorded as wrong.

### The kinds of go

- **Plant it:** "Plant **4 rows of 6**." The child taps to plant a row (6 shoots pop up in a neat row, Bella says the running total: "six, twelve, eighteen, twenty-four" at level 5). Then picks the total from four. Planting is the action.
- **Under the mat:** an array with a flax mat over it; first row and first column showing. Pick the total.
- **Turn it:** the garden spins 90 degrees, the child picks "Same" or "Different" and the new sentence (steps 2 and 5 only).
- **Share them out:** a heap of shoots and an empty field; the child taps rows into place until the heap is empty, then says the answer ("how many in each row?"). Division as sharing and as grouping, the two ways round.
- **Cut it:** a line splits an array into a part the child knows (5 rows) and one more row; pick the total.
- **Which garden?** Four little pictures; "Which one is 3 × 5?" (steps 2 onward: one of the four is the turned one, one is 3 + 5).

### Wrong choices and the feedback

Wrong cards are the real slips between add and multiply and between rows and columns:

| Question | Right | Wrong cards (the slip) |
|---|---|---|
| 4 rows of 6 | 24 | **10** (added the numbers: 4 + 6), **20** (skip counted one row short), **64** (joined the digits), **28** (off by a row of 4) |
| Which garden is 3 × 5 (3 rows of 5) | 3 rows of 5 | **5 rows of 3** (turned: the same total, so Pūkeko says "this one is also 15; the question was rows first"), **3 + 5 shoots in a row** (added), **a scatter of 15** (no rows) |
| 24 shoots in 4 equal rows | 6 each | **20** (24 − 4), **28** (added), **4**, **8** (rows of 3: confused rows and columns) |
| 6 × 7 cut into 5 rows and 1 | 42 | **35** (forgot the extra row), **12** (added), **48**, **13** |

- **Show why with the same model.** A wrong tap *plants it*: the child's number of shoots is drawn into the field and Pūkeko counts them with the rows ("4 rows of 6 only fills 24 spaces; your 28 has four spare"). A "which garden?" miss lights both gardens' rows so the child sees the match.
- **Free taps are capped:** after two wrong taps Pūkeko plants the rows with the child (the child taps) and the go is redone with fewer cards, recorded wrong. Three first-tap misses in a row keep level 5 for the round.
- **No guessing the tables:** the child also has to plant, share or choose a garden, not only tap a number; and each wrong card, when tapped, shows the picture of that wrong answer, so tapping them all still teaches.

### Help that follows each child (fading)

Six help levels (movement rules as Tūī: start at 5, two good challenges of 8 or more right at the first tap in a row go down one, 4 or fewer right goes up one, a new step puts help up two):

| Level | What the child sees |
|---|---|
| 5 | Neat shoots in rows and columns, each row a different shade, the running total said as rows are planted, the equation built under the picture ("4 × 6 = 24") |
| 4 | The same, no counting voice |
| 3 | Rows drawn as a bar of shoots (a row is one strip with a number), equation shown after the answer |
| 2 | Only the array's two edges (rows and columns counts), the picture covered by the mat |
| 1 | "4 × 6 = ?" with a **Peek** that brings back the garden |
| 0 | "4 × 6 = ?" only; a wrong tap still brings the garden back for that go |

A child whose records show a times-table skill secure (the hub's own "jumping ahead" rule, `shared/maths/ladder.ts:193-203`, 70 percent of the facts in box 2 or more) starts at step 5 and level 2; a child who has Hop's `skip-5` and `skip-10` secure starts at step 2. Everyone else starts at step 1 and level 5. Tables go in the order: 2, 5, 10, then 3, 4, then 6, 7, 8, then 9 (the hub's campaign order).

- After each day's first (counted) challenge: **8 or more of 10 right at the first tap** is a good challenge; **two good in a row** take the child down one level; **4 or fewer right** is a hard challenge and goes up one straight away; anything else stays. The server saves the level and `good_in_row` in `pukeko_progress`; play-again goes later the same day don't move it.
- Inside one go, a wrong tap puts help up one level for that go, and a second wrong tap up to level 5 for that go.
- **The quickMs rule (R2):** the quick-answer clock starts after the voice finishes and uses a junior value, so a careful child isn't stuck in a Leitner box (DECISIONS.md pattern 3); `afterAnswer` already takes a `quickMs` argument, so no shared change is needed.
- Teacher setting `pukeko_help`: **Fades / Always / Off** (Fades by default, like Tūī): Always keeps level 4; Off means level 0 with no Peek, though a wrong tap still brings the picture back for that go.

### What is recorded for teachers

Each go records into the **existing** times-tables keys, `mul:3x4` (a at most b, 1 to 12), so the child's place in the campaign moves with the game; `parseFactKey` is `shared/maths/facts.ts:16`. New `ladderOnly` families in `shared/maths/skillPacks/earlyFacts.ts` for the parts the tables do not cover: `rows:r*c` (equal rows, 2 to 10 by 2 to 5: 40), `turn:r*c` (the turned garden: 20), `share:t/r` (sharing: 30), `cut:6*7` (the split facts for 6, 7, 8 and 9: 20), `which:r*c` (which garden: 20); ladder skills `equal-rows`, `arrays-turn`, `sharing-rows`, `cut-arrays`. All through `recordMathsAnswers`, first tap only.

The record per child is the same as Tūī's and Weka's: `gem_keep_facts` (one row per key: correct, attempts, Leitner box) written with `recordMathsAnswers`, plus the saved round for the slips. The teacher's pupil line shows the step and help level, the five hardest keys, the **slip** most often made (added the numbers, mixed up rows and columns, one row short), and a class count by table for R7's grid. The mul: keys feed the existing times-tables report, so no teacher page changes.

### Look and voice

Clay look (style B), Bella reading the question aloud and saying the model sentence after every right answer; the child's help level fades the voice (level 5 counts along; levels 4 to 1 read the question; level 0 says only the short prompt; a speaker button always rereads it). The game's own mute `pukeko-voice`. Pictures are stand-ins drawn in code first; James paints the finals in ComfyUI (`docs/PUKEKO-ART-PLAN.md`, to be written in stage 1 as for `docs/WEKA-ART-PLAN.md`). Reduced motion respected. Wide screens first (Chromebooks, iPads); narrow phones in portrait must work without a second row.

## 4. Files affected

Mine (new, freely): `shared/pukeko/` (`round.ts`, `play.ts`, `progress.ts`, `server.ts`, `memoryServices.ts`, `pukeko.test.ts`, plus one config file for every tuning number), `src/games/pukeko/` (`index.tsx`, `switch.ts`, `pukeko.css`, `backend.ts`, `words.ts`, `voiceLines.ts` and its test, a guide and teacher.ts, `art/`), `src/data/pukeko.ts`, `supabase/functions/pukeko/` (`handler.ts`, `entry.ts`, `handler.test.ts`, generated `index.ts`), `supabase/migrations/<next free number>_pukeko.sql` (take the number from `node scripts/migration-numbers.mjs`), `supabase/tests/database/pukeko.test.sql`, `preview/pukeko/` + `vite.pukeko-preview.config.ts`, `scripts/pukeko-sim.mjs`, `docs/PUKEKO-PLAN.md` (copied from this file), `docs/prompts/pukeko-golive.md`.

**Shared files needing their own small branch (ask James first):**
- `shared/maths/skillPacks/earlyFacts.ts` and `shared/maths/ladder.ts`: the new families and ladder skills (branch `maths-pukeko-keys`, live first).
- `src/games/registry.ts` and `registry.test.ts` (the game's id, one line), `src/components/gameCardArt.ts` and `src/assets/home/pukeko.webp` (after James paints it), `scripts/build-functions.mjs` (the `FUNCTIONS` list), `package.json` scripts, `shared/README.md`, `docs/PRIVACY-SUMMARY.md` (the new `pukeko_progress`), `.gitignore` (`dist-preview-pukeko/`).
- The teacher's Games table line (`teacher_pukeko_class`) is in my migration; the class grid of stuck pupils is R7's.

## 5. Database / migration needs

One new migration file (`<next free number>_pukeko.sql`), pasted in by hand at go-live like the others, modelled on `supabase/migrations/20261106000100_tui.sql`:
- `pukeko_progress` (player, days_done, last_day, step, level, good_in_row, good_at_step, version, updated_at) and `pukeko_rounds` (player, seed, round), both with row level security; the round also keeps the slip data (taps, wrong cards).
- `app_settings` columns `pukeko_enabled boolean default true` and `pukeko_help text default 'fade'` (fade, always, off).
- `pukeko_counts(uuid)`, `pukeko_point_rules()` (no points line), `pukeko_players_list()`, `pukeko_last_played(uuid)`, `pukeko_last_day(who)` for the home page's next-part chip.
- A `hub_games` row (`switch_column 'pukeko_enabled'`, `season_fn null`, `keep_achievements true`), `achievement_measures` (`pukeko_days`, `pukeko_step`, `pukeko_prizes`) and the five `achievement_types` above.
- The teacher functions `teacher_pukeko_class`, `teacher_pukeko_student`. No change to other games' tables. Switched on for every class by default (the hub's rule for new games).

## 6. Test steps

At most 8 automated tests:
1. `makeRound` returns 10 goes, 7 new-kind and 3 earlier, the weakest keys first, and the same round from the same seed.
2. `play` replays the saved taps and marks them the same way the server did.
3. `progress`: 30 finished days make the prize, a second finish the same NZ day changes nothing, a missed day loses nothing.
4. `finish` saves `reached`, level, days and the slip data once.
5. Help moves: down after two good challenges, up after a hard one, up two on a new step, a wrong tap raises that go's level.
6. The wrong cards are never the right answer, are all different, and each matches its named slip (a test over every key).
7. The starting step and level for a child with prior records (the "who starts where" rule above).
8. The guided first go is right on 200 seeds (a pure function).

Plus the Weka-style `voiceLines.test.ts` and the `wekaGuide`-shaped guide test only if they stay inside the 8 (merge with 1 and 8).

**In the preview** (`npm run preview:pukeko` or its vite config): play a day as a new child (guide, first go, first success, the next-step line), then a wrong tap at each kind (the feedback), a wrong tap three times (the cap), play 3 days to see the help fade and a hard day to see it return, try Lots / Some / Off, mute, a Chromebook width and a phone portrait width, reduced motion, and the teacher's pupil line. Check no screen needs reading beyond the numbers. James tries the guided first go himself.

## 7. Effort and impact

**Effort L, impact Very high.** Gap 4: times tables are the most-asked content in the hub but always as a bare quiz; no game shows why 6 × 4 is 24. Build size: shared/pukeko about 800 lines + tests; src/games/pukeko about 1800 lines (rows planting, the spin, the mat, the cut line); one migration; one function. The largest of the five.

## 8. Session prompt (ready to paste)

```text
You are building a new Games Hub game: Pūkeko's Raupō Rows (id pukeko). Work in /Users/jriley/games-hub-isles. Create branch pukeko from origin/main in its own worktree. Read docs/GAME_DEVELOPMENT_GUIDE.md (especially section 1a, section 2 and section 8) and the plan docs/plans/maths-review/new-games/N4-arrays.md by path first; also read docs/TUI-PLAN.md, docs/WEKA-PLAN.md and docs/EARLY-GAMES-PLAN.md section 7, and look at shared/tui, shared/weka and src/games/weka for how an early game is built. Do not re-decide anything the plan settles.
Steps: (1) Tell James that the small shared branch maths-pukeko-keys (new ladderOnly families in shared/maths/skillPacks/earlyFacts.ts and ladder.ts) is needed first, and build it on its own branch only if he says so; until it is live, work against the same keys in your own test fixtures. (2) Copy the plan to docs/PUKEKO-PLAN.md. (3) Write shared/pukeko/ (config of every tuning number, round, play, progress, server, memory services) with the levels, wrong cards and help rules from the plan. (4) Write supabase/functions/pukeko/ and one migration (take the number from node scripts/migration-numbers.mjs) with the tables, settings, hub_games row, five achievements and teacher functions. (5) Write src/games/pukeko/ with the screens, stand-in art drawn in code, Bella voice lines, the guided first go and next-step line, Lots/Some/Off help, and the teacher line; add src/data/pukeko.ts, the preview folder and vite config, and scripts/pukeko-sim.mjs. (6) Add the registry and card-art lines on their own small branch only after asking James.
Tests: at most 8 for the game, as listed in section 6 of the plan, plus the preview checks there. Run npm test, the type check and the lint.
Stop and tell James before any live step (applying the migration, deploying the function, merging, switching on). Open a PR when done.
```
