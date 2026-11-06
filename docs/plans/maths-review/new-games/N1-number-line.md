# Kererū's Number Line (reading, placing and jumping on lines to 100 and 1000): plan N1

Short id `kereru`. **Status: plan written 7 Nov 2026 for the fundamental maths review (docs/reviews/maths-review/DECISIONS.md, gap 1). Not built, no code changed.** Guide: the Kererū (NZ wood pigeon). Chosen from `docs/plans/maths-review/new-games/IDEAS.md`.

## 1. The problem

- **Gap 1 in DECISIONS.md** (comparing, ordering and the number line) is the base for place value, rounding and mental strategies. `docs/reviews/maths-review/coverage.md` rates number lines, ordering and "one more, one less" as absent from every game (only Hop's skip counting and Weka's stones touch a line).
- **A planned game already covers the bottom of it.** `docs/RURU-PLAN.md` (Ruru's Number Trail, written 5 Nov 2026, not built: there is no `src/games/ruru` or `shared/ruru`) covers one more, one less, which is more and "where does it go?" on **0 to 10 and 0 to 20** for ages 5 to 7. **Build Ruru first, as planned.** This plan builds on it and does not repeat it.
- **What nobody covers: the line past 20.** Children aged 7 to 9 meet 0 to 100 and 0 to 1000 lines in Years 3 to 4 and in rounding, but the hub only asks about them as bare quiz sums (`shared/maths/skillPacks/rounding.ts`, `placeValue.ts`): no picture, no line, nothing that shows a child who puts 100 "in the middle" of 0 to 1000 that they are squashing the big numbers (research-maths.md, number-line sections).
- A child who finishes Ruru has no next step on the line. `docs/reviews/maths-review/DECISIONS.md` pattern 5 ("short ladders with no what's next") applies.

## 2. The research behind it

- **Estimates on a 0 to 100 and 0 to 1000 line grow from "squashed" to even, and feedback on where the number really goes speeds it up** (Siegler and Opfer 2003; Siegler and Booth 2004; Opfer and Siegler 2007), as in Ruru's plan section 2 point 7. How evenly a child places numbers predicts later sums (Booth and Siegler 2008).
- **Landmarks (the middle, then the tens) are how children place well** (Peeters and others 2016). So the help ladder shows the middle and the tens first and removes them last.
- **Reading an unmarked point and zoomed lines are the harder half** (Y3 to 4 number-line tasks, NCETM Years 3 and 4 spine "number line to 1000"); zooming (40 to 50 inside 0 to 100) is the base for decimals later.
- **Ten more and ten less as a jump of one big gap** (NCETM: "10 more is the number below on a 100 square"); the line shows the same jump, so the two pictures link. Say it the same way every time (NCETM stem sentences): "Ten more than 63 is 73."
- Help that fades with the child and comes back (Wood, Bruner and Ross 1976; Kalyuga's expertise reversal; Fyfe and others 2014 concreteness fading), as Tūī and Weka.

## 3. The change

- **Branch and prerequisites:** create `kereru` from `origin/main` in its own worktree. The shared maths families are a separate small branch first, `maths-kereru-keys`, because `shared/maths/` can't be changed from a game branch (GAME_DEVELOPMENT_GUIDE.md section 2). It adds the new `ladderOnly` families to `shared/maths/skillPacks/earlyFacts.ts` and their ladder skills to `shared/maths/ladder.ts` (all `inWarmUp: false, inAuto: false`, so an older pupil's auto practice never meets them), with the curriculum tag checked against the NZ curriculum. It goes live before the game.
- **Built the same way as Tūī and Weka** (`docs/TUI-PLAN.md`, `docs/WEKA-PLAN.md`, `docs/EARLY-GAMES-PLAN.md` section 7): same look (clay, style B), Bella's voice, 10 goes a day, a server that makes and marks every round, a saved `reached` step.

**Order of work:** Ruru (its own plan) is built and live first, because it lays the shared families (`more1`, `less1`, `cmp`, `line10`, `line20`) and the line component that this game copies. If James would rather have one game, steps 1 to 7 here can be added to Ruru as its steps 8 to 14 instead; this plan says what to build either way.

### The game in plain words (and the section 1a answers)

Kererū flies along the great branch of a rātā tree at dawn gathering miro berries for the forest. The branch is a number line. **Big goal:** the 10 berry clusters on the great branch turn from green to bronze, silver and gold (one change per NZ day played, 30 counted days), and the Golden Berry Branch is the prize; then a new friend's branch (Tūī, Pīwakawaka, Korimako, Kākā), as in the other early games' `FRIENDS` lists. A pupil playing 3 or 4 days a week gets there in about 8 to 10 weeks. After it: the next branch starts at the child's step (never back at step 1).

**1a answers, briefly:**

1. **Big goal:** the 10 berry clusters on the great branch (see above), 30 finished days, then the Golden Berry Branch. Recommended: yes; the simulator check is a script `scripts/kereru-sim.mjs` that plays a pupil at 3 to 4 days a week and checks the prize lands in weeks 8 to 10.
2. **Season game?** No, because help and steps follow the child and nothing piles up that a late joiner can't catch (as Tūī and Weka: counted days, not dates, a missed day loses nothing). So there is no `season_fn` and no season reset; `keep_achievements` is true. Nothing needs the school's season date.
3. **Moves a day:** no daily limit, because this is practice and more maths is simply good (Gem Keep, Bond Match). The first finished challenge of each NZ day changes one berry cluster; playing again that day is for fun and changes nothing (as Tūī). No hub points for the daily (the prize and achievements are the reward). So there is nothing for the "Unlimited today" switch or "moves left" to do, and no change to `shared/unlimited.ts` or `my_moves_left()`.
4. **Progress bars:** in the game, the 10 berry clusters on the great branch and a step bar (reuse `LevelBar` from `src/components/Progress.tsx` where it fits); on the home page the hub's level bar and next achievements come for free. A bar never shows maths results to classmates and never ranks.
5. **Achievements** (built through `hub_games`: `counts_fn`, `achievement_measures`, `achievement_types` with `game = 'kereru'`; no `rules_fn` points line):

| Name | What it's for | Measure | Goal | Roughly who | Survives New Season |
|---|---|---|---|---|---|
| First flight | Finish your first berry run | `kereru_days` | 1 | 90% of pupils who play | Yes: no season, so nothing resets |
| Steady wings | Finish 10 days | `kereru_days` | 10 | 50% of pupils who play | Yes: no season, so nothing resets |
| Past the middle | Pass step 4 (ten more, ten less) | `kereru_step` | 5 | 35% of pupils who play | Yes: no season, so nothing resets |
| The whole branch | Pass step 7 and reach the long branch | `kereru_step` | 8 | 15% of pupils who play | Yes: no season, so nothing resets |
| Golden Berry Branch | The big goal: 30 finished days | `kereru_prizes` | 1 | 10% of pupils who play | Yes: no season, so nothing resets |

6. **Card art scene for James to paint** (`docs/HOME-ART-PLAN.md` style, then `src/assets/home/kereru.webp` and a line in `src/components/gameCardArt.ts`): A big, soft-lit rātā tree on a hillside at dawn: a very long straight pale branch crossing the whole picture left to right, with a chubby green-and-white Kererū in the middle, a miro berry in her beak, ten red berry clusters hanging below it. Flat storybook style, no text.
7. **Built-in guide:** the Kererū (NZ wood pigeon) herself, in Bella's voice. A first walk through as a new pupil:

| Moment | Why a new child gets stuck | The fix |
|---|---|---|
| Opens the game | Branch, berries, a number to place, all at once | A big "Fly!" button first; the first go is only 'tap the 50 post' |
| First "where does it go" | Child taps anywhere on a long empty-looking line | Level 5 puts a ruler of ticks and numbers; Kererū's wing points at the middle |
| After a wrong tap | A card flies to a new place, unclear why | Bella says "36 is here. Kererū is here. Further along is more." |
| Zoom step | The line suddenly shows 40 to 50 with no explanation | A short lens animation from 0 to 100 into the gap, every time level 5 or 4 meets zoom |
| End of the run | Berry changes colour, child may not notice | Berries ripple one by one and the next-step line says "Tomorrow: ten more!" |

   A guided first go (2 to 3 minutes, every step skippable, who gets it comes from the saved game: no days done), a next-step line that is always there with a "Show me" that lights the button it means, closable first-time tips, and a Lots / Some / Off help choice plus "Replay the guide" (copy Weka's `wekaGuide.test.tsx` shape). It never helps with the maths question itself, and it never chooses for the child. Its first go is chosen so it cannot fail (a pure function tested on many seeds).

### The levels and learning order

| Step | Name | Range | The new thing |
|---|---|---|---|
| 1 | The tens branch | 0 to 100, tens marked | Place a tens number (30, 70) with every tick showing |
| 2 | Read the arrow | 0 to 100 | Kererū is on an unlabelled point; pick its number from four |
| 3 | Place any number | 0 to 100 | Where does 63 go? Middle mark first, then only the ends |
| 4 | Ten more, ten less | 0 to 100 | Kererū jumps one big gap: ten more than 63 (73), ten less |
| 5 | Which ten is closer? | 0 to 100 | Is 63 closer to 60 or 70? Tap the nearer tens post; halfway (65) taught as a rule |
| 6 | Zoom in | 40 to 50, 0 to 200, 300 to 400 | Read and place on a lens that zooms into one gap |
| 7 | The long branch | 0 to 1000, hundreds marked | Place and read 3-digit numbers (640), nearest hundred; all kinds mixed |

- A step is **passed after two challenges at it with 8 or more of 10 right at the first tap** (Tūī's rule). The server saves the furthest step `reached`; the child never drops back. Inside a step the weakest keys come first (low Leitner box) and each challenge is about 7 new-kind goes to 3 earlier-kind goes.
- Each challenge is 10 goes; a go that needed more help after a wrong tap is still recorded as wrong.

### The kinds of go

- **Where does it go?** "Drop the berry where **63** goes." The child taps the branch. A lantern-berry lights at the true place and Kererū flies there from the child's tap (Ruru's feedback). Marked right when the tap is within **one twentieth of the line** (5 on 0 to 100, 50 on 0 to 1000; 2 on 40 to 50, tighter when tens are the target). Recorded as plain right or wrong, with the tap position saved for the teacher (as Ruru).
- **Read the arrow.** An arrow points at an unlabelled spot. Pick the number from four cards. This is the only kind with a taught set of wrong choices (below).
- **Ten more, ten less** (and, on the long branch, a hundred more): Kererū hops one big arc; the child taps the landing number from four, or taps the landing spot on the branch at the first two help levels.
- **Which ten is closer?** The child taps the nearer of two tens posts (or hundreds posts on the long branch). Halfway numbers (65, 350) appear from step 5 only after the child has the others, and Bella says "halfway goes up".
- **Order three berries** (gold days finale, not recorded): three numbers hang on the branch's berries, tap smallest to biggest; the branch shows where each one sits.

### Wrong choices and the feedback

The only kind with fixed wrong cards is **Read the arrow** (and ten more and ten less). The cards are the real slips, not answer plus or minus one:

| Arrow at | Right | Wrong cards (the slip each one is) |
|---|---|---|
| 63 on 0 to 100, tens marked | 63 | **53** (counted the tens from the wrong post), **36** (digits turned round), **60** (rounded: read the nearest mark), **73** (nearest-end guess) |
| 47 on 40 to 50 | 47 | **7** (read ones only), **43** (counted from the wrong end), **57** (added the end's tens twice), **4** |
| 640 on 0 to 1000, hundreds marked | 640 | **604** (wrote "six hundred" then "four"), **64** (dropped the hundreds), **740** (one post out), **460** (digits turned round) |
| Ten more than 63 | 73 | **64** (added one), **53** (went the wrong way), **163** (wrote ten beside it) |

- After a wrong tap the card's number **flies to its own place on the branch**, so the child sees where 36 really sits against the arrow ("36 is here. Kererū is further along"). The shared model is the line itself. For Where does it go, the lantern-berry lighting up is the feedback (a tap is never wrong twice).
- Free taps are capped: at the third wrong tap only the two nearest tens posts and the arrow stay bright; the answer is never shown or said. After three first-tap misses in a row the level stays at 5 for the rest of the round (Weka's rule).

### Help that follows each child (fading)

Six help levels (same ladder and same movement rules as Ruru: start at 5, two good challenges of 8 or more right at the first tap in a row go down one, 4 or fewer right goes up one, a new step puts help up two, a new line length puts help to at least 3):

| Level | 0 to 100 | 0 to 1000 |
|---|---|---|
| 5 | Every ten ticked as a ruler (ten small steps in each gap), tens numbered, Kererū's own post numbered, Bella counts on by tens | Hundreds numbered, each hundred split in tens |
| 4 | Ticks and tens numbered, no counting voice | Hundreds numbered, tens ticks |
| 3 | Only the tens ticked and numbered in fives of tens (0, 50, 100) | Only hundreds ticked, 0, 500, 1000 numbered |
| 2 | Only 0, 50, 100 and the arrow | Only 0, 500, 1000 |
| 1 | Ends only, with a **Peek** (brings back level 3 for one go) | Same |
| 0 | Ends only, no Peek (numbers only for ten more and ten less) | Same |

A child who already passes Ruru (its `number-line-20` skill, or 30 of 40 one more and one less keys at box 2 or more) starts at step 3 and level 2. A child who has Tūī's `ten-and` secure and nothing else starts at step 1 and level 4.

- After each day's first (counted) challenge: **8 or more of 10 right at the first tap** is a good challenge; **two good in a row** take the child down one level; **4 or fewer right** is a hard challenge and goes up one straight away; anything else stays. The server saves the level and `good_in_row` in `kereru_progress`; play-again goes later the same day don't move it.
- Inside one go, a wrong tap puts help up one level for that go, and a second wrong tap up to level 5 for that go.
- **The quickMs rule (R2):** the quick-answer clock starts after the voice finishes and uses a junior value, so a careful child isn't stuck in a Leitner box (DECISIONS.md pattern 3); `afterAnswer` already takes a `quickMs` argument, so no shared change is needed.
- Teacher setting `kereru_help`: **Fades / Always / Off** (Fades by default, like Tūī): Always keeps level 4; Off means level 0 with no Peek, though a wrong tap still brings the picture back for that go.

### What is recorded for teachers

New families in `shared/maths/skillPacks/earlyFacts.ts`, `ladderOnly`, ladder skills `number-line-100` (place100, read100), `ten-more-less` (tens100) and `number-line-1000` (place1000, read1000, near100). Keys:
`place100:t30` (nine tens) and `place100:n63` (21 chosen others), `read100:` the same 30, `tens100:+63`/`tens100:-63` (20, spread over crossings 90 to 100 and 10 to 0), `near10:n63` (36, with 12 halfway), `zoom:40-50:47` (20), `place1000:n640`, `read1000:n640` (40 each, hundreds and others), `near100:n640` (20). All come back through `recordMathsAnswers` as plain right or wrong, first tap only.

The record per child is the same as Tūī's and Weka's: `gem_keep_facts` (one row per key: correct, attempts, Leitner box) written with `recordMathsAnswers`, plus the saved round for the slips. The teacher's pupil line shows the step and help level, the five hardest keys, the average distance (in line units, as a percent of the line) of the last 10 "where does it go" taps, and whether big numbers are squashed (the average signed error for numbers over 70 percent of the line). A class view of how many pupils are at each step comes with R7's teacher grid; until then it is the pupil page only.

### Look and voice

Clay look (style B), Bella reading the question aloud and saying the model sentence after every right answer; the child's help level fades the voice (level 5 counts along; levels 4 to 1 read the question; level 0 says only the short prompt; a speaker button always rereads it). The game's own mute `kereru-voice`. Pictures are stand-ins drawn in code first; James paints the finals in ComfyUI (`docs/KERERU-ART-PLAN.md`, to be written in stage 1 as for `docs/WEKA-ART-PLAN.md`). Reduced motion respected. Wide screens first (Chromebooks, iPads); narrow phones in portrait must work without a second row.

## 4. Files affected

Mine (new, freely): `shared/kereru/` (`round.ts`, `play.ts`, `progress.ts`, `server.ts`, `memoryServices.ts`, `kereru.test.ts`, plus one config file for every tuning number), `src/games/kereru/` (`index.tsx`, `switch.ts`, `kereru.css`, `backend.ts`, `words.ts`, `voiceLines.ts` and its test, a guide and teacher.ts, `art/`), `src/data/kereru.ts`, `supabase/functions/kereru/` (`handler.ts`, `entry.ts`, `handler.test.ts`, generated `index.ts`), `supabase/migrations/<next free number>_kereru.sql` (take the number from `node scripts/migration-numbers.mjs`), `supabase/tests/database/kereru.test.sql`, `preview/kereru/` + `vite.kereru-preview.config.ts`, `scripts/kereru-sim.mjs`, `docs/KERERU-PLAN.md` (copied from this file), `docs/prompts/kereru-golive.md`.

**Shared files needing their own small branch (ask James first):**
- `shared/maths/skillPacks/earlyFacts.ts` and `shared/maths/ladder.ts`: the new families and ladder skills (branch `maths-kereru-keys`, live first).
- `src/games/registry.ts` and `registry.test.ts` (the game's id, one line), `src/components/gameCardArt.ts` and `src/assets/home/kereru.webp` (after James paints it), `scripts/build-functions.mjs` (the `FUNCTIONS` list), `package.json` scripts, `shared/README.md`, `docs/PRIVACY-SUMMARY.md` (the new `kereru_progress`), `.gitignore` (`dist-preview-kereru/`).
- The teacher's Games table line (`teacher_kereru_class`) is in my migration; the class grid of stuck pupils is R7's.

## 5. Database / migration needs

One new migration file (`<next free number>_kereru.sql`), pasted in by hand at go-live like the others, modelled on `supabase/migrations/20261106000100_tui.sql`:
- `kereru_progress` (player, days_done, last_day, step, level, good_in_row, good_at_step, version, updated_at) and `kereru_rounds` (player, seed, round), both with row level security; the round also keeps the slip data (taps, wrong cards).
- `app_settings` columns `kereru_enabled boolean default true` and `kereru_help text default 'fade'` (fade, always, off).
- `kereru_counts(uuid)`, `kereru_point_rules()` (no points line), `kereru_players_list()`, `kereru_last_played(uuid)`, `kereru_last_day(who)` for the home page's next-part chip.
- A `hub_games` row (`switch_column 'kereru_enabled'`, `season_fn null`, `keep_achievements true`), `achievement_measures` (`kereru_days`, `kereru_step`, `kereru_prizes`) and the five `achievement_types` above.
- The teacher functions `teacher_kereru_class`, `teacher_kereru_student`. No change to other games' tables. Switched on for every class by default (the hub's rule for new games).

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

**In the preview** (`npm run preview:kereru` or its vite config): play a day as a new child (guide, first go, first success, the next-step line), then a wrong tap at each kind (the feedback), a wrong tap three times (the cap), play 3 days to see the help fade and a hard day to see it return, try Lots / Some / Off, mute, a Chromebook width and a phone portrait width, reduced motion, and the teacher's pupil line. Check no screen needs reading beyond the numbers. James tries the guided first go himself.

## 7. Effort and impact

**Effort L, impact High.** Gap 1 beyond Ruru: Ruru's planned trail stops at 20; nothing teaches where 63 or 640 goes, reading an unmarked point, or ten more and nearest ten. Build size: shared/kereru about 600 lines + tests; src/games/kereru about 1400 lines (the line component is the big part, it can be copied from Ruru's, not imported: games don't import each other); one migration; one function. Roughly 60 to 70 percent of Ruru's size, if Ruru is built first.

## 8. Session prompt (ready to paste)

```text
You are building a new Games Hub game: Kererū's Number Line (id kereru). Work in /Users/jriley/games-hub-isles. Create branch kereru from origin/main in its own worktree. Read docs/GAME_DEVELOPMENT_GUIDE.md (especially section 1a, section 2 and section 8) and the plan docs/plans/maths-review/new-games/N1-number-line.md by path first; also read docs/TUI-PLAN.md, docs/WEKA-PLAN.md and docs/EARLY-GAMES-PLAN.md section 7, and look at shared/tui, shared/weka and src/games/weka for how an early game is built. Do not re-decide anything the plan settles.
Steps: (1) Tell James that the small shared branch maths-kereru-keys (new ladderOnly families in shared/maths/skillPacks/earlyFacts.ts and ladder.ts) is needed first, and build it on its own branch only if he says so; until it is live, work against the same keys in your own test fixtures. (2) Copy the plan to docs/KERERU-PLAN.md. (3) Write shared/kereru/ (config of every tuning number, round, play, progress, server, memory services) with the levels, wrong cards and help rules from the plan. (4) Write supabase/functions/kereru/ and one migration (take the number from node scripts/migration-numbers.mjs) with the tables, settings, hub_games row, five achievements and teacher functions. (5) Write src/games/kereru/ with the screens, stand-in art drawn in code, Bella voice lines, the guided first go and next-step line, Lots/Some/Off help, and the teacher line; add src/data/kereru.ts, the preview folder and vite config, and scripts/kereru-sim.mjs. (6) Add the registry and card-art lines on their own small branch only after asking James.
Tests: at most 8 for the game, as listed in section 6 of the plan, plus the preview checks there. Run npm test, the type check and the lint.
Stop and tell James before any live step (applying the migration, deploying the function, merging, switching on). Open a PR when done.
```
