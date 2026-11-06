# Kea's See-saw (equals means the same amount, and missing numbers): plan N2

Short id `kea`. **Status: plan written 7 Nov 2026 for the fundamental maths review (docs/reviews/maths-review/DECISIONS.md, gap 2). Not built, no code changed.** Guide: the Kea. Chosen from `docs/plans/maths-review/new-games/IDEAS.md`.

## 1. The problem

- **Gap 2 in DECISIONS.md.** `docs/reviews/maths-review/coverage.md` (line 71) marks "Equals as same amount (balance)" with no coverage in any game: every cell is a dash. The only equals the hub teaches is "the answer comes after the equals sign".
- **The foundational games reinforce the wrong idea.** Beanstalk, Weka and Quick looks ask "8 + 5 = ?" or the missing partner as a picture (`shared/beanstalk/round.ts:1-12`, `shared/weka/round.ts:14-18`), so a child meets `=` only as "now write the answer". Research-maths.md (Part 2, Algebra) names this as the misconception that blocks algebra.
- **No other planned game covers it.** I checked `docs/EARLY-GAMES-PLAN.md` and every `docs/*-PLAN.md` for balance or missing-number work: none.

## 2. The research behind it

- **The "operator" view of =** ("the answer goes next") is common even in Year 6 and predicts later algebra trouble; children who are shown equations with operations on both sides (7 = 3 + 4, 3 + 4 = 4 + 3) and asked what makes them true learn the relational meaning (Knuth, Stephens, McNeil and Alibali 2006; McNeil and Alibali 2005; Carpenter, Franke and Levi 2003, Thinking Mathematically). See research-maths.md Part 2 (Algebra).
- **A balance is the best first model** (Carpenter and others; Oak National Academy and NCETM Year 1 to 2 "equal and not equal"): both sides must be level. It shows an unequal sum as a tilt, which is the feedback.
- **Compensation is the strategy to build** (6 + 7 = 7 + 6, 6 + 7 = 5 + 8: change one side by the same on the other): this is where "relational thinking" starts and it leads straight into Weka's make-ten and doubles plus one.
- **Move from the model to the symbols with the link shown** (concreteness fading, Fyfe, McNeil, Son and Goldstone 2014), and take the support away when the child no longer needs it (Kalyuga). Help follows the child, not the calendar (James's choice for Tūī and Weka, DECISIONS.md pattern 2).
- **Feedback that shows why** (research-design.md rubric criterion 6, DECISIONS.md pattern 1): try the child's wrong number in the box and let the see-saw tip.

## 3. The change

- **Branch and prerequisites:** create `kea` from `origin/main` in its own worktree. The shared maths families are a separate small branch first, `maths-kea-keys`, because `shared/maths/` can't be changed from a game branch (GAME_DEVELOPMENT_GUIDE.md section 2). It adds the new `ladderOnly` families to `shared/maths/skillPacks/earlyFacts.ts` and their ladder skills to `shared/maths/ladder.ts` (all `inWarmUp: false, inAuto: false`, so an older pupil's auto practice never meets them), with the curriculum tag checked against the NZ curriculum. It goes live before the game.
- **Built the same way as Tūī and Weka** (`docs/TUI-PLAN.md`, `docs/WEKA-PLAN.md`, `docs/EARLY-GAMES-PLAN.md` section 7): same look (clay, style B), Bella's voice, 10 goes a day, a server that makes and marks every round, a saved `reached` step.

Kea's see-saw reuses the shape of Weka's round and the shared pick-one question, so nothing in `shared/maths` needs to change except the new `ladderOnly` families, which is its own small branch.

### The game in plain words (and the section 1a answers)

Kea, the cheeky mountain parrot, sits at one end of a see-saw log over a snow tarn, and **will not stop playing until it is level**. Kea collects shiny things (kea steal shiny things); the ten shiny things on the ridge turn bronze, silver and gold, one change per NZ day played (30 counted days). **Big goal:** the Golden Bell, the shiniest thing of all. A pupil playing 3 or 4 days a week gets there in 8 to 10 weeks. After it: a new friend's see-saw (Weka, Pūkeko, Tūī, Kiwi, Takahē) starts at the child's step.

**1a answers, briefly:**

1. **Big goal:** the 10 shiny things on the ridge (see above), 30 finished days, then the Golden Bell. Recommended: yes; the simulator check is a script `scripts/kea-sim.mjs` that plays a pupil at 3 to 4 days a week and checks the prize lands in weeks 8 to 10.
2. **Season game?** No, because help and steps follow the child and nothing piles up that a late joiner can't catch (as Tūī and Weka: counted days, not dates, a missed day loses nothing). So there is no `season_fn` and no season reset; `keep_achievements` is true. Nothing needs the school's season date.
3. **Moves a day:** no daily limit, because this is practice and more maths is simply good (Gem Keep, Bond Match). The first finished challenge of each NZ day changes one shiny thing; playing again that day is for fun and changes nothing (as Tūī). No hub points for the daily (the prize and achievements are the reward). So there is nothing for the "Unlimited today" switch or "moves left" to do, and no change to `shared/unlimited.ts` or `my_moves_left()`.
4. **Progress bars:** in the game, the 10 shiny things on the ridge and a step bar (reuse `LevelBar` from `src/components/Progress.tsx` where it fits); on the home page the hub's level bar and next achievements come for free. A bar never shows maths results to classmates and never ranks.
5. **Achievements** (built through `hub_games`: `counts_fn`, `achievement_measures`, `achievement_types` with `game = 'kea'`; no `rules_fn` points line):

| Name | What it's for | Measure | Goal | Roughly who | Survives New Season |
|---|---|---|---|---|---|
| First level | Level your first see-saw | `kea_days` | 1 | 90% of pupils who play | Yes: no season, so nothing resets |
| Always the same | Finish 10 days | `kea_days` | 10 | 50% of pupils who play | Yes: no season, so nothing resets |
| Both sides | Pass step 3 | `kea_step` | 4 | 35% of pupils who play | Yes: no season, so nothing resets |
| Level Sorter | Pass step 5 (true or false) | `kea_step` | 6 | 15% of pupils who play | Yes: no season, so nothing resets |
| Golden Bell | The big goal: 30 finished days | `kea_prizes` | 1 | 10% of pupils who play | Yes: no season, so nothing resets |

6. **Card art scene for James to paint** (`docs/HOME-ART-PLAN.md` style, then `src/assets/home/kea.webp` and a line in `src/components/gameCardArt.ts`): A snowy mountain tarn at sunrise with a wooden see-saw log across it; an olive-green kea with orange under-wings sits on the left end looking cheeky, a small pile of shiny things (a bell, a spoon, a button) on the right end; ten sparkles along the ridge behind. Flat storybook style, no text.
7. **Built-in guide:** the Kea herself, in Bella's voice. A first walk through as a new pupil:

| Moment | Why a new child gets stuck | The fix |
|---|---|---|
| Opens the game | Two sides, a bag, stones: what is the aim? | Kea says "Make it level!" and shakes the log; the first go has one stone to drag |
| The mystery bag | What does ? mean? | The bag glows with the number to find; Bella says "how many more" |
| Check button | Greyed until stones move | Says why: "Move a stone first" |
| A tip | Child thinks they were punished | Kea laughs and slides, never a red cross |
| Equation with no picture (level 1) | = sign meaning is lost | Peek shows the same see-saw |

   A guided first go (2 to 3 minutes, every step skippable, who gets it comes from the saved game: no days done), a next-step line that is always there with a "Show me" that lights the button it means, closable first-time tips, and a Lots / Some / Off help choice plus "Replay the guide" (copy Weka's `wekaGuide.test.tsx` shape). It never helps with the maths question itself, and it never chooses for the child. Its first go is chosen so it cannot fail (a pure function tested on many seeds).

### The levels and learning order

| Step | Name | Range | The new thing |
|---|---|---|---|
| 1 | Level it with stones | sums to 10, stones | Kea's end is full; the other end has some stones and a bag marked ?; drag stones in until it levels |
| 2 | One number and a mystery | 8 = 5 + ?, 5 + ? = 8, to 10 | Weights show numbers; pick the missing one |
| 3 | The same, both ways round | 3 + 4 = 4 + ?, 7 = ? + 3, to 10 | Swapping and the "= in the middle" feel |
| 4 | Both sides have sums | to 20: 6 + 7 = 5 + ? | The compensation step: one side changes, so does the other |
| 5 | Tips or level? | true or false: 6 + 2 = 5 + 4 | Kea says it; the child taps "tips left", "level" or "tips right" |
| 6 | Taking away too | 9 = 12 − ?, 10 − 3 = 4 + ? | Subtraction and mixed, to 20 |

- A step is **passed after two challenges at it with 8 or more of 10 right at the first tap** (Tūī's rule). The server saves the furthest step `reached`; the child never drops back. Inside a step the weakest keys come first (low Leitner box) and each challenge is about 7 new-kind goes to 3 earlier-kind goes.
- Each challenge is 10 goes; a go that needed more help after a wrong tap is still recorded as wrong.

### The kinds of go

- **Level it** (levels 5 and 4 only): the child drags stones from a heap into the empty pan until the see-saw levels; the tilt moves as each stone lands (level 5) or only when they press **Check** (level 4). The maths is *how many more*.
- **Missing number:** the see-saw has weights with numbers on (level 3) or just the equation `8 = 5 + ?` (levels 2 to 0). Pick from four.
- **Both sides:** `3 + 4 = 4 + ?`, `6 + 7 = 5 + ?`, to 20 from step 4.
- **Tips or level?** From step 5 a true or false equation; three big buttons. At level 0 the picture is gone (a Peek brings it back).
- All four look the same on the screen, with the **= sign as the see-saw's pivot** so the symbol and the model stay linked.

### Wrong choices and the feedback

The four cards are chosen from the real slips, so tapping all of them teaches something and guessing does not help:

| Question | Right | Wrong cards (the slip) |
|---|---|---|
| 8 = 5 + ? | 3 | **13** (added every number on the page), **5** (copied the number beside it), **8** (the number before the = sign: "the answer goes there"), **2** |
| 3 + 4 = 4 + ? | 3 | **7** (put the total in the box: "= means makes"), **4** (copied), **11** (added every number), **8** |
| 6 + 7 = 5 + ? | 8 | **13** (the total), **7**, **18** (added everything: 6 + 7 + 5), **9** (off by one on the compensation) |
| true or false 6 + 2 = 5 + 4 | false (tips right) | child says **level** because both sides "have an answer" or **tips left** because 6 is first and bigger |

- **Show why with the same model.** A wrong tap *is tried*: the child's number goes into the box, and the see-saw tips. Stones count themselves each side ("7 stones here, 4 and 7 is 11 stones there. The big side drops."). This takes three seconds and needs no extra rule for the child to learn.
- **Free taps are capped.** After two wrong taps Kea counts both sides with the child (counting along, as Bella does) and the child redoes the go with the right number highlighted among fewer cards; this go is recorded as wrong. Three goes in a row with a wrong first tap keep level 5 for the round (Weka's rule).
- Bella never says the answer; she says "Is it level yet?".

### Help that follows each child (fading)

Six help levels (the same movement rules as Tūī and Weka: start at 5, two good challenges of 8 or more right at the first tap in a row go down one, 4 or fewer right goes up one, a new step puts help up two):

| Level | What the child sees |
|---|---|
| 5 | Stones in the pans, live tilt as stones land, Bella counts each side |
| 4 | Stones, tilt only on **Check** |
| 3 | The see-saw with numbered weights (no stones), tilt on Check |
| 2 | The equation with the see-saw drawn small beside it, tilt on a wrong tap |
| 1 | The equation only, with a **Peek** that brings the see-saw back |
| 0 | The equation only; a wrong tap still brings the see-saw back for that go |

A child who has `facts-10` (bonds to 10) secure and Weka's make-ten started begins at step 3 and level 3; everyone else at step 1 and level 5. The colours of the shiny things mark days, not skill.

- After each day's first (counted) challenge: **8 or more of 10 right at the first tap** is a good challenge; **two good in a row** take the child down one level; **4 or fewer right** is a hard challenge and goes up one straight away; anything else stays. The server saves the level and `good_in_row` in `kea_progress`; play-again goes later the same day don't move it.
- Inside one go, a wrong tap puts help up one level for that go, and a second wrong tap up to level 5 for that go.
- **The quickMs rule (R2):** the quick-answer clock starts after the voice finishes and uses a junior value, so a careful child isn't stuck in a Leitner box (DECISIONS.md pattern 3); `afterAnswer` already takes a `quickMs` argument, so no shared change is needed.
- Teacher setting `kea_help`: **Fades / Always / Off** (Fades by default, like Tūī): Always keeps level 4; Off means level 0 with no Peek, though a wrong tap still brings the picture back for that go.

### What is recorded for teachers

New families in `shared/maths/skillPacks/earlyFacts.ts`, `ladderOnly`, ladder skills `balance-10` (eqmiss10, eqswap), `balance-20` (eqboth, eqsub) and `true-false` (eqtf). Keys:
`eqmiss:a=b+?` (10 to 10: total `a` 3 to 10, known part `b`: about 36 keys; variants are the four layouts `a = b + ?`, `b + ? = a`, `? + b = a`, `a = ? + b`), `eqswap:a+b=b+?` (21), `eqboth:a+b=c+?` (30 chosen, to 20, half need a shift of one), `eqsub:` (20), `eqtf:a+b=c+d` (30, half true, a quarter near misses like 6 + 2 = 5 + 4). Same as the other early games: `recordMathsAnswers`, first tap only, recorded into `gem_keep_facts`.

The record per child is the same as Tūī's and Weka's: `gem_keep_facts` (one row per key: correct, attempts, Leitner box) written with `recordMathsAnswers`, plus the saved round for the slips. The teacher's pupil line shows the step and help level, the five hardest keys, and the **slip** each pupil makes most often: copied the number, put in the total, or added everything (taken from which wrong card was tapped first, saved with the round). That is the single most useful thing the game can tell a teacher about a child's idea of equals. Teacher grid: part of R7.

### Look and voice

Clay look (style B), Bella reading the question aloud and saying the model sentence after every right answer; the child's help level fades the voice (level 5 counts along; levels 4 to 1 read the question; level 0 says only the short prompt; a speaker button always rereads it). The game's own mute `kea-voice`. Pictures are stand-ins drawn in code first; James paints the finals in ComfyUI (`docs/KEA-ART-PLAN.md`, to be written in stage 1 as for `docs/WEKA-ART-PLAN.md`). Reduced motion respected. Wide screens first (Chromebooks, iPads); narrow phones in portrait must work without a second row.

## 4. Files affected

Mine (new, freely): `shared/kea/` (`round.ts`, `play.ts`, `progress.ts`, `server.ts`, `memoryServices.ts`, `kea.test.ts`, plus one config file for every tuning number), `src/games/kea/` (`index.tsx`, `switch.ts`, `kea.css`, `backend.ts`, `words.ts`, `voiceLines.ts` and its test, a guide and teacher.ts, `art/`), `src/data/kea.ts`, `supabase/functions/kea/` (`handler.ts`, `entry.ts`, `handler.test.ts`, generated `index.ts`), `supabase/migrations/<next free number>_kea.sql` (take the number from `node scripts/migration-numbers.mjs`), `supabase/tests/database/kea.test.sql`, `preview/kea/` + `vite.kea-preview.config.ts`, `scripts/kea-sim.mjs`, `docs/KEA-PLAN.md` (copied from this file), `docs/prompts/kea-golive.md`.

**Shared files needing their own small branch (ask James first):**
- `shared/maths/skillPacks/earlyFacts.ts` and `shared/maths/ladder.ts`: the new families and ladder skills (branch `maths-kea-keys`, live first).
- `src/games/registry.ts` and `registry.test.ts` (the game's id, one line), `src/components/gameCardArt.ts` and `src/assets/home/kea.webp` (after James paints it), `scripts/build-functions.mjs` (the `FUNCTIONS` list), `package.json` scripts, `shared/README.md`, `docs/PRIVACY-SUMMARY.md` (the new `kea_progress`), `.gitignore` (`dist-preview-kea/`).
- The teacher's Games table line (`teacher_kea_class`) is in my migration; the class grid of stuck pupils is R7's.

## 5. Database / migration needs

One new migration file (`<next free number>_kea.sql`), pasted in by hand at go-live like the others, modelled on `supabase/migrations/20261106000100_tui.sql`:
- `kea_progress` (player, days_done, last_day, step, level, good_in_row, good_at_step, version, updated_at) and `kea_rounds` (player, seed, round), both with row level security; the round also keeps the slip data (taps, wrong cards).
- `app_settings` columns `kea_enabled boolean default true` and `kea_help text default 'fade'` (fade, always, off).
- `kea_counts(uuid)`, `kea_point_rules()` (no points line), `kea_players_list()`, `kea_last_played(uuid)`, `kea_last_day(who)` for the home page's next-part chip.
- A `hub_games` row (`switch_column 'kea_enabled'`, `season_fn null`, `keep_achievements true`), `achievement_measures` (`kea_days`, `kea_step`, `kea_prizes`) and the five `achievement_types` above.
- The teacher functions `teacher_kea_class`, `teacher_kea_student`. No change to other games' tables. Switched on for every class by default (the hub's rule for new games).

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

**In the preview** (`npm run preview:kea` or its vite config): play a day as a new child (guide, first go, first success, the next-step line), then a wrong tap at each kind (the feedback), a wrong tap three times (the cap), play 3 days to see the help fade and a hard day to see it return, try Lots / Some / Off, mute, a Chromebook width and a phone portrait width, reduced motion, and the teacher's pupil line. Check no screen needs reading beyond the numbers. James tries the guided first go himself.

## 7. Effort and impact

**Effort M, impact High.** Gap 2: no game touches "equals means the same as" (8 = ? + 5), the misconception that blocks algebra. Build size: shared/kea about 500 lines + tests; src/games/kea about 1000 lines (a see-saw with a tilt that follows the sums is the main piece, SVG with CSS rotation); one migration; one function. Smaller than Tūī.

## 8. Session prompt (ready to paste)

```text
You are building a new Games Hub game: Kea's See-saw (id kea). Work in /Users/jriley/games-hub-isles. Create branch kea from origin/main in its own worktree. Read docs/GAME_DEVELOPMENT_GUIDE.md (especially section 1a, section 2 and section 8) and the plan docs/plans/maths-review/new-games/N2-balance.md by path first; also read docs/TUI-PLAN.md, docs/WEKA-PLAN.md and docs/EARLY-GAMES-PLAN.md section 7, and look at shared/tui, shared/weka and src/games/weka for how an early game is built. Do not re-decide anything the plan settles.
Steps: (1) Tell James that the small shared branch maths-kea-keys (new ladderOnly families in shared/maths/skillPacks/earlyFacts.ts and ladder.ts) is needed first, and build it on its own branch only if he says so; until it is live, work against the same keys in your own test fixtures. (2) Copy the plan to docs/KEA-PLAN.md. (3) Write shared/kea/ (config of every tuning number, round, play, progress, server, memory services) with the levels, wrong cards and help rules from the plan. (4) Write supabase/functions/kea/ and one migration (take the number from node scripts/migration-numbers.mjs) with the tables, settings, hub_games row, five achievements and teacher functions. (5) Write src/games/kea/ with the screens, stand-in art drawn in code, Bella voice lines, the guided first go and next-step line, Lots/Some/Off help, and the teacher line; add src/data/kea.ts, the preview folder and vite config, and scripts/kea-sim.mjs. (6) Add the registry and card-art lines on their own small branch only after asking James.
Tests: at most 8 for the game, as listed in section 6 of the plan, plus the preview checks there. Run npm test, the type check and the lint.
Stop and tell James before any live step (applying the migration, deploying the function, merging, switching on). Open a PR when done.
```
