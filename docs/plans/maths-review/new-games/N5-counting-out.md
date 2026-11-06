# Kākāpō's Berry Basket (counting out a set, giving exactly N): plan N5

> **Update 7 Nov 2026:** follow [LEARNING-DESIGN.md](../../../LEARNING-DESIGN.md) and check [GAME-KIT-PLAN.md](../../GAME-KIT-PLAN.md) first. Use any merged kit parts (K3 has `TenFrame`, `NumberLine`, `DotPicture`) instead of copying another game's code; for anything not in the kit yet, write it so it can move there later.

Short id `kakapo`. **Status: plan written 7 Nov 2026 for the fundamental maths review (docs/reviews/maths-review/DECISIONS.md, gap 5). Not built, no code changed.** Guide: the Kākāpō. Chosen from `docs/plans/maths-review/new-games/IDEAS.md`.

## 1. The problem

- **Gap 5 in DECISIONS.md.** Counting and cardinality (research-maths.md, idea 2) is the very first skill for new entrants (NZ Number Framework Stages 0 to 3), and the hub's youngest games start later: Quick looks (subitising) and Beanstalk (bonds) assume the child can already count and stop. `docs/reviews/maths-review/coverage.md` records counting out as not a game anywhere.
- **Nothing makes a child produce a count.** Quick looks shows 1 to 10 and asks "how many"; no game asks "give me 6" (Wynn's "give-a-number" task) and checks the child stopped.
- **No other planned game covers it** (checked `docs/EARLY-GAMES-PLAN.md`: its five games start at part-whole and teens). Ruru's number trail assumes counting.

## 2. The research behind it

- **Cardinality shows when a child can "give me N" and stop, not only count** (Gelman and Gallistel 1978; Wynn 1990, 1992). A child who counts correctly but hands over a handful has recited, not understood. See research-maths.md, idea 2.
- **Show the child's own count back to them** (research-maths.md: "highlight each object as it was counted so a skipped or doubled one is visible"): the replay is the feedback.
- **Learn it with things you can touch and mark** (CPA; Clements and Sarama's counting trajectory): a counted berry moves or dims so none is skipped or counted twice; later the marking fades.
- **Counting along models the number names but must not do the counting** (research-maths.md implications): Bella says each number as it is tapped, then says it a beat behind, then stops.
- **Then counting on and one more** (NZ Number Framework Stage 2 to 4): a plate of 5 covered, one more added, how many? This is the step to counting on, not from one; it feeds Weka and Tūī.

## 3. The change

- **Branch and prerequisites:** create `kakapo` from `origin/main` in its own worktree. The shared maths families are a separate small branch first, `maths-kakapo-keys`, because `shared/maths/` can't be changed from a game branch (GAME_DEVELOPMENT_GUIDE.md section 2). It adds the new `ladderOnly` families to `shared/maths/skillPacks/earlyFacts.ts` and their ladder skills to `shared/maths/ladder.ts` (all `inWarmUp: false, inAuto: false`, so an older pupil's auto practice never meets them), with the curriculum tag checked against the NZ curriculum. It goes live before the game.
- **Built the same way as Tūī and Weka** (`docs/TUI-PLAN.md`, `docs/WEKA-PLAN.md`, `docs/EARLY-GAMES-PLAN.md` section 7): same look (clay, style B), Bella's voice, 10 goes a day, a server that makes and marks every round, a saved `reached` step.

This is the smallest and the one most dependent on art (big, clear berries and baskets) and on Bella's voice for numbers 1 to 20, which already exists in the Kokoro clip set.

### The game in plain words (and the section 1a answers)

Kākāpō, the big, slow, owl-faced night parrot, waddles through the rimu forest at dusk picking berries into baskets for her chick. **Big goal:** the 10 berry baskets by the nest turn from plain to bronze, silver and gold, one per NZ day played (30 counted days), and the Golden Berry Feast is the prize. A pupil playing 3 or 4 days a week gets there in 8 to 10 weeks; most children will go much faster through the first steps. After it: a new friend's basket (Kiwi, Kea, Weka, Pūkeko, Tūī) starts at the child's step.

**1a answers, briefly:**

1. **Big goal:** the 10 berry baskets (see above), 30 finished days, then the Golden Berry Feast. Recommended: yes; the simulator check is a script `scripts/kakapo-sim.mjs` that plays a pupil at 3 to 4 days a week and checks the prize lands in weeks 8 to 10.
2. **Season game?** No, because help and steps follow the child and nothing piles up that a late joiner can't catch (as Tūī and Weka: counted days, not dates, a missed day loses nothing). So there is no `season_fn` and no season reset; `keep_achievements` is true. Nothing needs the school's season date.
3. **Moves a day:** no daily limit, because this is practice and more maths is simply good (Gem Keep, Bond Match). The first finished challenge of each NZ day changes one basket; playing again that day is for fun and changes nothing (as Tūī). No hub points for the daily (the prize and achievements are the reward). So there is nothing for the "Unlimited today" switch or "moves left" to do, and no change to `shared/unlimited.ts` or `my_moves_left()`.
4. **Progress bars:** in the game, the 10 berry baskets and a step bar (reuse `LevelBar` from `src/components/Progress.tsx` where it fits); on the home page the hub's level bar and next achievements come for free. A bar never shows maths results to classmates and never ranks.
5. **Achievements** (built through `hub_games`: `counts_fn`, `achievement_measures`, `achievement_types` with `game = 'kakapo'`; no `rules_fn` points line):

| Name | What it's for | Measure | Goal | Roughly who | Survives New Season |
|---|---|---|---|---|---|
| First berries | Fill your first basket | `kakapo_days` | 1 | 95% of pupils who play | Yes: no season, so nothing resets |
| Berry picker | Finish 10 days | `kakapo_days` | 10 | 55% of pupils who play | Yes: no season, so nothing resets |
| Stop at ten | Pass step 3 (give up to 10) | `kakapo_step` | 4 | 50% of pupils who play | Yes: no season, so nothing resets |
| Counts to twenty | Pass step 6 | `kakapo_step` | 7 | 20% of pupils who play | Yes: no season, so nothing resets |
| Golden Berry Feast | The big goal: 30 finished days | `kakapo_prizes` | 1 | 10% of pupils who play | Yes: no season, so nothing resets |

6. **Card art scene for James to paint** (`docs/HOME-ART-PLAN.md` style, then `src/assets/home/kakapo.webp` and a line in `src/components/gameCardArt.ts`): A moonlit rimu forest: a round, mossy-green kākāpō with an owl-like face stands with a woven basket of red berries at its feet, ten small baskets in a row on a log behind; soft glow-worm lights; flat storybook style, no text.
7. **Built-in guide:** the Kākāpō herself, in Bella's voice. A first walk through as a new pupil:

| Moment | Why a new child gets stuck | The fix |
|---|---|---|
| Opens the game | A pile and a basket and a voice | Kākāpō says "Give me four!" and the first go has the same basket slots lit |
| The first tap | Tap one berry, nothing seems to happen | The berry hops into the slot with a plop and the number is said |
| That's all button | Greyed until a berry is dropped | Says why with a picture, no words |
| A wrong count | "Oops" feels like failing | The replay is kind: "Let's count again" |
| Counting across ten | Teen names are hard | Groups of five light; the child counts the lit groups |

   A guided first go (2 to 3 minutes, every step skippable, who gets it comes from the saved game: no days done), a next-step line that is always there with a "Show me" that lights the button it means, closable first-time tips, and a Lots / Some / Off help choice plus "Replay the guide" (copy Weka's `wekaGuide.test.tsx` shape). It never helps with the maths question itself, and it never chooses for the child. Its first go is chosen so it cannot fail (a pure function tested on many seeds).

### The levels and learning order

| Step | Name | Range | The new thing |
|---|---|---|---|
| 1 | Give 1 to 5 | 1 to 5 | "Give me 4 berries." Tap berries into the basket; stop at 4 |
| 2 | How many? 1 to 5 | 1 to 5, in a line | Touch each berry to mark it, then pick the number |
| 3 | Give 6 to 10 | 6 to 10 | Same as step 1 with the bigger set; the basket has ten slots in two fives |
| 4 | How many? 6 to 10 | 6 to 10, scattered | Berries are scattered; touching marks each; a skipped one is shown |
| 5 | One more | a covered plate of 5 to 9, then one more | Count on: how many now? |
| 6 | Count to 20 | 11 to 20 | Counting across 10 and 20 in groups of five, give and how many |

- A step is **passed after two challenges at it with 8 or more of 10 right at the first tap** (Tūī's rule). The server saves the furthest step `reached`; the child never drops back. Inside a step the weakest keys come first (low Leitner box) and each challenge is about 7 new-kind goes to 3 earlier-kind goes.
- Each challenge is 10 goes; a go that needed more help after a wrong tap is still recorded as wrong.

### The kinds of go

- **Give me N:** "Give me **6** berries." Berries sit in a pile. Each tap moves one berry into the basket (a pre-schooler can do this), Bella says the number, and the child taps the big **That's all** button. The maths is *stopping*: the game never stops the child. At the higher levels the child must stop at N from a pile of up to 20; a miss is a plain count of what was given.
- **How many?** A group of berries. The child touches each berry in turn (it dims) and then picks the number from four. The pile layout goes from a line to scattered to a ring.
- **One more:** a plate of berries is covered; the kākāpō adds one more; how many now? (counting on from a shown number, step 5).
- **Count back** (gold days finale, not recorded): berries are eaten one at a time and Bella counts back.

### Wrong choices and the feedback

The cards (four, big, with a dot picture) and the wrong amounts come from the real slips:

| Task | Right | The slip |
|---|---|---|
| How many? 6 berries scattered | 6 | **7** (counted one berry twice), **5** (skipped one), **4** (counted a row), **10** (said the last number but did not count: "it looks like a lot") |
| Give me 6 | 6 | **7 or more** (didn't stop: counts but "the last word is just a name"), **5 or fewer** (stopped early), a **handful** (took without counting, shown as "fast") |
| One more (a plate of 5, plus one) | 6 | **5** (didn't count on: counted the new berry as 0), **7** (counted from one and added), **1** |

- **Show the child's own count.** After a wrong "give me" the basket replays: each berry lights as the child tapped it ("one, two, three, four, five, six, seven. You gave seven."). After a wrong "how many", the berries light in the order the child touched them; a skipped berry stays dark and a doubled one blinks. No red marks, no "wrong".
- **Free taps are capped:** after two wrong goes Bella counts along with the child ("one... two...") and the child redoes the go (recorded wrong). Three first-try misses in a row keep level 5 for the round. The answer is never said.
- **Never rewards a handful:** "That's all" works only once; a fast handful of the right count by luck still records right (we can't tell), so each "give" go is asked twice with a different N in the same challenge.

### Help that follows each child (fading)

Six help levels (movement rules as Tūī: start at 5, two good challenges of 8 or more right at the first try in a row go down one, 4 or fewer right goes up one, a new step puts help up two; because the children are four to six years old, level 5 is the **starting** level for almost everyone and the check is gentler: two good challenges in a row at 7 or more of 10):

| Level | What the child sees |
|---|---|
| 5 | Basket with numbered slots 1 to N (two fives), a berry fills the next slot as tapped, Bella counts along as each is tapped |
| 4 | Numbered slots, no counting voice |
| 3 | A plain basket, each berry says its number as it is dropped, tapped berries dim |
| 2 | A plain basket, the number appears above the basket and tapped berries dim |
| 1 | A plain basket and a pile with no dimming, with a **Peek** that shows the slots again |
| 0 | A free pile: move berries, tap That's all; a wrong try still shows the replay |

A child who has Quick looks at stage 2 or more and `facts-10` is **not** assumed to count out well: everyone starts at step 1 level 5 and moves quickly (a good challenge needs only 7 of 10 and two in a row, so a child who counts well is at level 3 after two days).

- After each day's first (counted) challenge: **8 or more of 10 right at the first tap** is a good challenge; **two good in a row** take the child down one level; **4 or fewer right** is a hard challenge and goes up one straight away; anything else stays. The server saves the level and `good_in_row` in `kakapo_progress`; play-again goes later the same day don't move it.
- Inside one go, a wrong tap puts help up one level for that go, and a second wrong tap up to level 5 for that go.
- **The quickMs rule (R2):** the quick-answer clock starts after the voice finishes and uses a junior value, so a careful child isn't stuck in a Leitner box (DECISIONS.md pattern 3); `afterAnswer` already takes a `quickMs` argument, so no shared change is needed.
- Teacher setting `kakapo_help`: **Fades / Always / Off** (Fades by default, like Tūī): Always keeps level 4; Off means level 0 with no Peek, though a wrong tap still brings the picture back for that go.

### What is recorded for teachers

New families in `shared/maths/skillPacks/earlyFacts.ts`, `ladderOnly`, ladder skills `count-out-10`, `count-out-20`, `count-on` (all `inWarmUp: false`). Keys:
`give:n6` (20: n 1 to 20), `howmany:n6:line`/`:scatter`/`:ring` (about 40 chosen), `counton:5+1` (16 with start 4 to 9 and one more), `countacross:n` (10). All through `recordMathsAnswers`, first try only. The round also saves, for each "give", the number given and whether it was over or under, and for each "how many", which berries were skipped or doubled, so a teacher can see the pattern (over, under, skipping).

The record per child is the same as Tūī's and Weka's: `gem_keep_facts` (one row per key: correct, attempts, Leitner box) written with `recordMathsAnswers`, plus the saved round for the slips. The teacher's pupil line shows the step and help level, the five hardest keys, and the **pattern**: over (didn't stop), under (stopped early), skipped berries, or doubled berries, from the saved round. This is the first time a teacher can see whether a new entrant has cardinality or is only reciting. Teacher grid: part of R7.

### Look and voice

Clay look (style B), Bella reading the question aloud and saying the model sentence after every right answer; the child's help level fades the voice (level 5 counts along; levels 4 to 1 read the question; level 0 says only the short prompt; a speaker button always rereads it). The game's own mute `kakapo-voice`. Pictures are stand-ins drawn in code first; James paints the finals in ComfyUI (`docs/KAKAPO-ART-PLAN.md`, to be written in stage 1 as for `docs/WEKA-ART-PLAN.md`). Reduced motion respected. Wide screens first (Chromebooks, iPads); narrow phones in portrait must work without a second row.

## 4. Files affected

Mine (new, freely): `shared/kakapo/` (`round.ts`, `play.ts`, `progress.ts`, `server.ts`, `memoryServices.ts`, `kakapo.test.ts`, plus one config file for every tuning number), `src/games/kakapo/` (`index.tsx`, `switch.ts`, `kakapo.css`, `backend.ts`, `words.ts`, `voiceLines.ts` and its test, a guide and teacher.ts, `art/`), `src/data/kakapo.ts`, `supabase/functions/kakapo/` (`handler.ts`, `entry.ts`, `handler.test.ts`, generated `index.ts`), `supabase/migrations/<next free number>_kakapo.sql` (take the number from `node scripts/migration-numbers.mjs`), `supabase/tests/database/kakapo.test.sql`, `preview/kakapo/` + `vite.kakapo-preview.config.ts`, `scripts/kakapo-sim.mjs`, `docs/KAKAPO-PLAN.md` (copied from this file), `docs/prompts/kakapo-golive.md`.

**Shared files needing their own small branch (ask James first):**
- `shared/maths/skillPacks/earlyFacts.ts` and `shared/maths/ladder.ts`: the new families and ladder skills (branch `maths-kakapo-keys`, live first).
- `src/games/registry.ts` and `registry.test.ts` (the game's id, one line), `src/components/gameCardArt.ts` and `src/assets/home/kakapo.webp` (after James paints it), `scripts/build-functions.mjs` (the `FUNCTIONS` list), `package.json` scripts, `shared/README.md`, `docs/PRIVACY-SUMMARY.md` (the new `kakapo_progress`), `.gitignore` (`dist-preview-kakapo/`).
- The teacher's Games table line (`teacher_kakapo_class`) is in my migration; the class grid of stuck pupils is R7's.

## 5. Database / migration needs

One new migration file (`<next free number>_kakapo.sql`), pasted in by hand at go-live like the others, modelled on `supabase/migrations/20261106000100_tui.sql`:
- `kakapo_progress` (player, days_done, last_day, step, level, good_in_row, good_at_step, version, updated_at) and `kakapo_rounds` (player, seed, round), both with row level security; the round also keeps the slip data (taps, wrong cards).
- `app_settings` columns `kakapo_enabled boolean default true` and `kakapo_help text default 'fade'` (fade, always, off).
- `kakapo_counts(uuid)`, `kakapo_point_rules()` (no points line), `kakapo_players_list()`, `kakapo_last_played(uuid)`, `kakapo_last_day(who)` for the home page's next-part chip.
- A `hub_games` row (`switch_column 'kakapo_enabled'`, `season_fn null`, `keep_achievements true`), `achievement_measures` (`kakapo_days`, `kakapo_step`, `kakapo_prizes`) and the five `achievement_types` above.
- The teacher functions `teacher_kakapo_class`, `teacher_kakapo_student`. No change to other games' tables. Switched on for every class by default (the hub's rule for new games).

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

**In the preview** (`npm run preview:kakapo` or its vite config): play a day as a new child (guide, first go, first success, the next-step line), then a wrong tap at each kind (the feedback), a wrong tap three times (the cap), play 3 days to see the help fade and a hard day to see it return, try Lots / Some / Off, mute, a Chromebook width and a phone portrait width, reduced motion, and the teacher's pupil line. Check no screen needs reading beyond the numbers. James tries the guided first go himself.

## 7. Effort and impact

**Effort M, impact Med.** Gap 5: no game asks a new entrant to count out "give me 7" and stop; the very first number skill is untouched. Build size: shared/kakapo about 450 lines + tests; src/games/kakapo about 900 lines (large touch targets, the replay, and the pile layouts); one migration; one function. The smallest of the five.

## 8. Session prompt (ready to paste)

```text
You are building a new Games Hub game: Kākāpō's Berry Basket (id kakapo). Work in /Users/jriley/games-hub-isles. Create branch kakapo from origin/main in its own worktree. Read docs/GAME_DEVELOPMENT_GUIDE.md (especially section 1a, section 2 and section 8) and the plan docs/plans/maths-review/new-games/N5-counting-out.md by path first; also read docs/TUI-PLAN.md, docs/WEKA-PLAN.md and docs/EARLY-GAMES-PLAN.md section 7, and look at shared/tui, shared/weka and src/games/weka for how an early game is built. Do not re-decide anything the plan settles.
Steps: (1) Tell James that the small shared branch maths-kakapo-keys (new ladderOnly families in shared/maths/skillPacks/earlyFacts.ts and ladder.ts) is needed first, and build it on its own branch only if he says so; until it is live, work against the same keys in your own test fixtures. (2) Copy the plan to docs/KAKAPO-PLAN.md. (3) Write shared/kakapo/ (config of every tuning number, round, play, progress, server, memory services) with the levels, wrong cards and help rules from the plan. (4) Write supabase/functions/kakapo/ and one migration (take the number from node scripts/migration-numbers.mjs) with the tables, settings, hub_games row, five achievements and teacher functions. (5) Write src/games/kakapo/ with the screens, stand-in art drawn in code, Bella voice lines, the guided first go and next-step line, Lots/Some/Off help, and the teacher line; add src/data/kakapo.ts, the preview folder and vite config, and scripts/kakapo-sim.mjs. (6) Add the registry and card-art lines on their own small branch only after asking James.
Tests: at most 8 for the game, as listed in section 6 of the plan, plus the preview checks there. Run npm test, the type check and the lint.
Stop and tell James before any live step (applying the migration, deploying the function, merging, switching on). Open a PR when done.
```
