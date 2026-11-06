# Tuatara's Bundles (tens and ones to 100, then hundreds): plan N3

Short id `tuatara`. **Status: plan written 7 Nov 2026 for the fundamental maths review (docs/reviews/maths-review/DECISIONS.md, gap 3). Not built, no code changed.** Guide: the Tuatara. Chosen from `docs/plans/maths-review/new-games/IDEAS.md`.

## 1. The problem

- **Gap 3 in DECISIONS.md.** Tūī's Ten Tree teaches "ten and some more" to 20 (`shared/tui`, ladder skill `ten-and`) and stops. After that, place value to 100 and beyond is asked only as banded quiz questions in Maths Monsters and Dragon Maths (`shared/maths/skillPacks/placeValue.ts`, `placeSkills.ts`): `docs/reviews/maths-review/coverage.md` lines 59 and 142 onwards show P (quiz) in six games and C (a real mechanic) in none.
- **No picture, no building.** Those questions are text ("What is the value of the 4 in 47?"). A child can answer by rule without ever having seen ten ones become one ten.
- **Tūī gives no "what's next".** DECISIONS.md pattern 5 and R8: the tens-and-ones game after Tūī does not exist. Tūī's `tenand` keys are the natural starting point.

## 2. The research behind it

- **Place value is built by grouping ones into tens, a thing you do, before it is a rule you read** (Fuson 1990; Ross 1989 on the five stages of place-value understanding; NCETM Year 2 spine "place value within 100"; Oak National Academy "Make two-digit numbers with tens and ones"). The same picture (bundles and singles) then carries to hundreds.
- **Use a model where ten ones visibly become one ten** (bundling sticks, Cuisenaire-style) before models where a ten is already a block (base-ten blocks), because the second hides the bundling (Fuson and Briars 1990; Thompson 1994; see research-maths.md Part 2, Number).
- **Flexible partitioning (47 is 4 tens and 7 ones, 3 tens and 17 ones) is the base for adding with carrying and subtracting with borrowing** (Fuson; NCETM). It gets its own step.
- **Common slips:** reading digits as face values (47 as 4 + 7), turning digits round (47 for 74), writing "three hundred and six" as 3006 (writing what you hear), and treating ten more as one more (47 to 48 not 57). Wrong cards are built from these.
- Help fades from a labelled mat to a bare picture to symbols and returns with struggle (concreteness fading, Fyfe and others 2014; Kalyuga), as Tūī and Weka.

## 3. The change

- **Branch and prerequisites:** create `tuatara` from `origin/main` in its own worktree. The shared maths families are a separate small branch first, `maths-tuatara-keys`, because `shared/maths/` can't be changed from a game branch (GAME_DEVELOPMENT_GUIDE.md section 2). It adds the new `ladderOnly` families to `shared/maths/skillPacks/earlyFacts.ts` and their ladder skills to `shared/maths/ladder.ts` (all `inWarmUp: false, inAuto: false`, so an older pupil's auto practice never meets them), with the curriculum tag checked against the NZ curriculum. It goes live before the game.
- **Built the same way as Tūī and Weka** (`docs/TUI-PLAN.md`, `docs/WEKA-PLAN.md`, `docs/EARLY-GAMES-PLAN.md` section 7): same look (clay, style B), Bella's voice, 10 goes a day, a server that makes and marks every round, a saved `reached` step.

Tūī (live) stops at 20, so this game is its natural next step; R8's "what's next" links are set up to add a Tūī to Tuatara link, which is a one-line change in each game's own folder.

### The game in plain words (and the section 1a answers)

Tuatara, the ancient lizard who has lived on the island for a hundred years and likes things tidy, stores sticks in his den in neat bundles of ten tied with flax. **Big goal:** the 10 bundles in his den turn from plain twine to bronze, silver and gold, one change per NZ day played (30 counted days), and the Golden Raft, a great raft of ten gold bundles, is the prize. A pupil playing 3 or 4 days a week gets there in 8 to 10 weeks. After it: a new friend's den (Kiwi, Pīwakawaka, Kākā, Kākāpō, Tīeke) starts at the child's step.

**1a answers, briefly:**

1. **Big goal:** the 10 bundles in the den (see above), 30 finished days, then the Golden Raft. Recommended: yes; the simulator check is a script `scripts/tuatara-sim.mjs` that plays a pupil at 3 to 4 days a week and checks the prize lands in weeks 8 to 10.
2. **Season game?** No, because help and steps follow the child and nothing piles up that a late joiner can't catch (as Tūī and Weka: counted days, not dates, a missed day loses nothing). So there is no `season_fn` and no season reset; `keep_achievements` is true. Nothing needs the school's season date.
3. **Moves a day:** no daily limit, because this is practice and more maths is simply good (Gem Keep, Bond Match). The first finished challenge of each NZ day changes one bundle; playing again that day is for fun and changes nothing (as Tūī). No hub points for the daily (the prize and achievements are the reward). So there is nothing for the "Unlimited today" switch or "moves left" to do, and no change to `shared/unlimited.ts` or `my_moves_left()`.
4. **Progress bars:** in the game, the 10 bundles in the den and a step bar (reuse `LevelBar` from `src/components/Progress.tsx` where it fits); on the home page the hub's level bar and next achievements come for free. A bar never shows maths results to classmates and never ranks.
5. **Achievements** (built through `hub_games`: `counts_fn`, `achievement_measures`, `achievement_types` with `game = 'tuatara'`; no `rules_fn` points line):

| Name | What it's for | Measure | Goal | Roughly who | Survives New Season |
|---|---|---|---|---|---|
| First bundle | Finish your first day of bundling | `tuatara_days` | 1 | 90% of pupils who play | Yes: no season, so nothing resets |
| Tidy den | Finish 10 days | `tuatara_days` | 10 | 50% of pupils who play | Yes: no season, so nothing resets |
| Tens and ones | Pass step 3 (tens and ones to 100) | `tuatara_step` | 4 | 40% of pupils who play | Yes: no season, so nothing resets |
| Hundred Raft | Pass step 6 (hundreds) | `tuatara_step` | 7 | 15% of pupils who play | Yes: no season, so nothing resets |
| Golden Raft | The big goal: 30 finished days | `tuatara_prizes` | 1 | 10% of pupils who play | Yes: no season, so nothing resets |

6. **Card art scene for James to paint** (`docs/HOME-ART-PLAN.md` style, then `src/assets/home/tuatara.webp` and a line in `src/components/gameCardArt.ts`): A sunny offshore-island clearing: a green, spiky-backed tuatara with a wise face sits by a neat row of ten flax-tied stick bundles in a rocky den, a few loose sticks beside him; flax and pōhutukawa behind. Flat storybook style, no text.
7. **Built-in guide:** the Tuatara herself, in Bella's voice. A first walk through as a new pupil:

| Moment | Why a new child gets stuck | The fix |
|---|---|---|
| Opens the game | A mat, a heap and a number | Tuatara says "Tie ten, tie ten"; the first go is 10 sticks and one bundle |
| The first bundle | Child may not see that ten sticks can be tied | When ten are on the mat they glow and a flax cord blinks |
| Zero place | "What is the empty box for?" | At level 5 the empty ones place shows a small 0 in a circle; Bella: "No sticks left" |
| Swap | Child doesn't know bundles can be untied | Untie is the lit button for the whole first swap go |
| Hundreds | The raft is a new thing | A short first-time tip: "Ten bundles tied together make a raft: a hundred." |

   A guided first go (2 to 3 minutes, every step skippable, who gets it comes from the saved game: no days done), a next-step line that is always there with a "Show me" that lights the button it means, closable first-time tips, and a Lots / Some / Off help choice plus "Replay the guide" (copy Weka's `wekaGuide.test.tsx` shape). It never helps with the maths question itself, and it never chooses for the child. Its first go is chosen so it cannot fail (a pure function tested on many seeds).

### The levels and learning order

| Step | Name | Range | The new thing |
|---|---|---|---|
| 1 | Bundles of ten | 10 to 50, tens only | Make 30: tie three bundles; count by tens |
| 2 | Tens and ones to 50 | 11 to 50 | Build 47 from loose sticks and bundles; read a picture (4 bundles, 7 sticks) |
| 3 | To 100, and zero | to 100, with 30, 70, 100 | The mat with an empty ones place: 4 tens is 40, not 4 |
| 4 | Bundle up, swap | 23 loose sticks; 47 = 3 tens and 17 ones | Regrouping both ways: tie ten loose sticks, untie one bundle |
| 5 | Ten more, ten less | any number to 100 | Add or remove a bundle: only the tens change |
| 6 | Hundreds | to 999, with a zero in the middle (306) | The raft (ten bundles tied) is a hundred; reading and building 3 digits |
| 7 | All mixed | to 999 | Weakest keys first, "hundred more, hundred less" joins |

- A step is **passed after two challenges at it with 8 or more of 10 right at the first tap** (Tūī's rule). The server saves the furthest step `reached`; the child never drops back. Inside a step the weakest keys come first (low Leitner box) and each challenge is about 7 new-kind goes to 3 earlier-kind goes.
- Each challenge is 10 goes; a go that needed more help after a wrong tap is still recorded as wrong.

### The kinds of go

- **Build it:** "Tuatara needs **47** sticks." The child drags loose sticks onto the mat; **when ten are on the mat they glow and the child taps the flax to tie them** (the bundling is the child's action: nothing ties itself). The child presses **That's it**.
- **Read it:** a picture of 4 bundles and 7 sticks; pick the number from four cards.
- **Bundle up:** "23 loose sticks: tie them. How many bundles? How many left?" The child ties and the mat counts.
- **Swap:** "47 is 3 bundles and ? sticks": the child unties one bundle (it spills 10 sticks) and counts the ones.
- **Ten more, ten less:** the child adds or removes a bundle and picks the number (steps 5 and 7; "hundred more" at step 7).
- Each goes asks one idea so it is clear what is being asked.

### Wrong choices and the feedback

Read-it and ten-more cards come from real slips:

| Picture or question | Right | Wrong cards (the slip) |
|---|---|---|
| 4 bundles and 7 sticks | 47 | **74** (digits turned round), **11** (added the digits: face value), **407** (a zero put in for the space), **4 tens** |
| 3 bundles, no sticks | 30 | **3** (ignored the empty ones place), **300** (added a zero too many), **33** |
| 3 hundred rafts, 0 bundles, 6 sticks | 306 | **3006** (writes what you hear), **360** (fills the empty place with the six), **36**, **63** |
| 47 and one more bundle (ten more) | 57 | **48** (added one: ones change), **147** (wrote ten in front), **37** (went the wrong way) |
| 5 tens and 12 ones | 62 | **512** (joined the two numbers), **17** (added them), **52** (ignored the extra ten in the ones) |

- **Show why with the same model.** A wrong tap builds the child's number next to the real picture: the 74 card turns into 7 bundles and 4 sticks beside Tuatara's 4 and 7, and Bella says "That is seven bundles. Tuatara has four bundles."
- **Free taps are capped:** two wrong taps and Tuatara counts the bundles by tens, the child redoes the go with two fewer cards (recorded wrong). Three first-tap misses in a row keep level 5 for the round.
- **Building tasks cannot be guessed:** the mat only accepts the right count of sticks for "That's it"; a wrong total tells the child the count ("You made 46") and the sticks stay for fixing. The first "That's it" is the recorded answer.

### Help that follows each child (fading)

Six help levels (movement rules as Tūī: start at 5, two good challenges in a row go down one, 4 or fewer right goes up one, a new step puts help up two, step 6 hundreds puts help to at least 3):

| Level | What the child sees |
|---|---|
| 5 | A mat labelled Tens and Ones, loose sticks drawn in ten-shaped groups, bundles red and ones green, count under each place, Bella counts by tens then ones |
| 4 | The labelled mat and colours, no counts, no counting voice |
| 3 | Bundles and sticks only (colours stay), no mat labels |
| 2 | Bundles and sticks in plain colour, digits appear only after the child finishes |
| 1 | Numbers ("47 = 4 tens and ? ones", "ten more than 47") with a **Peek** that brings back the bundles |
| 0 | Numbers only; a wrong tap still brings the bundles back for that go |

A child who has Tūī's `ten-and` keys secure (all nine at box 2 or more) starts at step 3 and level 3; a child who has only `ten-and` starts at step 2. Everyone else starts at step 1 and level 5.

- After each day's first (counted) challenge: **8 or more of 10 right at the first tap** is a good challenge; **two good in a row** take the child down one level; **4 or fewer right** is a hard challenge and goes up one straight away; anything else stays. The server saves the level and `good_in_row` in `tuatara_progress`; play-again goes later the same day don't move it.
- Inside one go, a wrong tap puts help up one level for that go, and a second wrong tap up to level 5 for that go.
- **The quickMs rule (R2):** the quick-answer clock starts after the voice finishes and uses a junior value, so a careful child isn't stuck in a Leitner box (DECISIONS.md pattern 3); `afterAnswer` already takes a `quickMs` argument, so no shared change is needed.
- Teacher setting `tuatara_help`: **Fades / Always / Off** (Fades by default, like Tūī): Always keeps level 4; Off means level 0 with no Peek, though a wrong tap still brings the picture back for that go.

### What is recorded for teachers

New families in `shared/maths/skillPacks/earlyFacts.ts`, `ladderOnly`, ladder skills `bundles-50`, `place-value-100`, `regroup-100`, `ten-more-less-100`, `place-value-1000`. Keys:
`pvbuild:n47` and `pvread:n47` (60 chosen numbers 11 to 99 with 12 tens-only), `pvzero:n40` (9 tens plus 100), `pvregroup:47=3t17` (30), `pvten:+47`/`pvten:-47` (24), `pv3:n306` (40: hundreds and zeros in the middle), `pvhun:+347`/`-347` (12). Recorded through `recordMathsAnswers`, first "That's it" or first tap only.

The record per child is the same as Tūī's and Weka's: `gem_keep_facts` (one row per key: correct, attempts, Leitner box) written with `recordMathsAnswers`, plus the saved round for the slips. The teacher's pupil line shows the step and help level, the five hardest keys, and the **slip** most often made (digits turned round, face value, zero in the wrong place, ten more changing the ones): from the wrong card tapped first. Teacher grid: part of R7.

### Look and voice

Clay look (style B), Bella reading the question aloud and saying the model sentence after every right answer; the child's help level fades the voice (level 5 counts along; levels 4 to 1 read the question; level 0 says only the short prompt; a speaker button always rereads it). The game's own mute `tuatara-voice`. Pictures are stand-ins drawn in code first; James paints the finals in ComfyUI (`docs/TUATARA-ART-PLAN.md`, to be written in stage 1 as for `docs/WEKA-ART-PLAN.md`). Reduced motion respected. Wide screens first (Chromebooks, iPads); narrow phones in portrait must work without a second row.

## 4. Files affected

Mine (new, freely): `shared/tuatara/` (`round.ts`, `play.ts`, `progress.ts`, `server.ts`, `memoryServices.ts`, `tuatara.test.ts`, plus one config file for every tuning number), `src/games/tuatara/` (`index.tsx`, `switch.ts`, `tuatara.css`, `backend.ts`, `words.ts`, `voiceLines.ts` and its test, a guide and teacher.ts, `art/`), `src/data/tuatara.ts`, `supabase/functions/tuatara/` (`handler.ts`, `entry.ts`, `handler.test.ts`, generated `index.ts`), `supabase/migrations/<next free number>_tuatara.sql` (take the number from `node scripts/migration-numbers.mjs`), `supabase/tests/database/tuatara.test.sql`, `preview/tuatara/` + `vite.tuatara-preview.config.ts`, `scripts/tuatara-sim.mjs`, `docs/TUATARA-PLAN.md` (copied from this file), `docs/prompts/tuatara-golive.md`.

**Shared files needing their own small branch (ask James first):**
- `shared/maths/skillPacks/earlyFacts.ts` and `shared/maths/ladder.ts`: the new families and ladder skills (branch `maths-tuatara-keys`, live first).
- `src/games/registry.ts` and `registry.test.ts` (the game's id, one line), `src/components/gameCardArt.ts` and `src/assets/home/tuatara.webp` (after James paints it), `scripts/build-functions.mjs` (the `FUNCTIONS` list), `package.json` scripts, `shared/README.md`, `docs/PRIVACY-SUMMARY.md` (the new `tuatara_progress`), `.gitignore` (`dist-preview-tuatara/`).
- The teacher's Games table line (`teacher_tuatara_class`) is in my migration; the class grid of stuck pupils is R7's.

## 5. Database / migration needs

One new migration file (`<next free number>_tuatara.sql`), pasted in by hand at go-live like the others, modelled on `supabase/migrations/20261106000100_tui.sql`:
- `tuatara_progress` (player, days_done, last_day, step, level, good_in_row, good_at_step, version, updated_at) and `tuatara_rounds` (player, seed, round), both with row level security; the round also keeps the slip data (taps, wrong cards).
- `app_settings` columns `tuatara_enabled boolean default true` and `tuatara_help text default 'fade'` (fade, always, off).
- `tuatara_counts(uuid)`, `tuatara_point_rules()` (no points line), `tuatara_players_list()`, `tuatara_last_played(uuid)`, `tuatara_last_day(who)` for the home page's next-part chip.
- A `hub_games` row (`switch_column 'tuatara_enabled'`, `season_fn null`, `keep_achievements true`), `achievement_measures` (`tuatara_days`, `tuatara_step`, `tuatara_prizes`) and the five `achievement_types` above.
- The teacher functions `teacher_tuatara_class`, `teacher_tuatara_student`. No change to other games' tables. Switched on for every class by default (the hub's rule for new games).

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

**In the preview** (`npm run preview:tuatara` or its vite config): play a day as a new child (guide, first go, first success, the next-step line), then a wrong tap at each kind (the feedback), a wrong tap three times (the cap), play 3 days to see the help fade and a hard day to see it return, try Lots / Some / Off, mute, a Chromebook width and a phone portrait width, reduced motion, and the teacher's pupil line. Check no screen needs reading beyond the numbers. James tries the guided first go himself.

## 7. Effort and impact

**Effort L, impact High.** Gap 3: Tūī's teen game stops at 20; place value to 100 and 1000 is only a quiz, never built by bundling tens. Build size: shared/tuatara about 700 lines + tests; src/games/tuatara about 1800 lines (the drag-to-mat and tie-and-untie bundling is the large piece, tap-to-move is the fallback for small phones); one migration; one function. The biggest of the five after Pūkeko.

## 8. Session prompt (ready to paste)

```text
You are building a new Games Hub game: Tuatara's Bundles (id tuatara). Work in /Users/jriley/games-hub-isles. Create branch tuatara from origin/main in its own worktree. Read docs/GAME_DEVELOPMENT_GUIDE.md (especially section 1a, section 2 and section 8) and the plan docs/plans/maths-review/new-games/N3-place-value.md by path first; also read docs/TUI-PLAN.md, docs/WEKA-PLAN.md and docs/EARLY-GAMES-PLAN.md section 7, and look at shared/tui, shared/weka and src/games/weka for how an early game is built. Do not re-decide anything the plan settles.
Steps: (1) Tell James that the small shared branch maths-tuatara-keys (new ladderOnly families in shared/maths/skillPacks/earlyFacts.ts and ladder.ts) is needed first, and build it on its own branch only if he says so; until it is live, work against the same keys in your own test fixtures. (2) Copy the plan to docs/TUATARA-PLAN.md. (3) Write shared/tuatara/ (config of every tuning number, round, play, progress, server, memory services) with the levels, wrong cards and help rules from the plan. (4) Write supabase/functions/tuatara/ and one migration (take the number from node scripts/migration-numbers.mjs) with the tables, settings, hub_games row, five achievements and teacher functions. (5) Write src/games/tuatara/ with the screens, stand-in art drawn in code, Bella voice lines, the guided first go and next-step line, Lots/Some/Off help, and the teacher line; add src/data/tuatara.ts, the preview folder and vite config, and scripts/tuatara-sim.mjs. (6) Add the registry and card-art lines on their own small branch only after asking James.
Tests: at most 8 for the game, as listed in section 6 of the plan, plus the preview checks there. Run npm test, the type check and the lint.
Stop and tell James before any live step (applying the migration, deploying the function, merging, switching on). Open a PR when done.
```
