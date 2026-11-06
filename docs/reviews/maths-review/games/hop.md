# Hop's Glow-worm Pond: evaluation

Folder `hop` (src/games/hop, shared/hop, supabase/functions/hop, migrations 20261104000600_hop.sql and 20261104000900_hop_hub.sql). Evaluated 7 Nov 2026 by reading all the code and playing the vite preview (port 5302) in the browser as a new child, with deliberate wrong taps, then jumping to silver, gold and the 2s using the preview tools.

## How it works

Hop the frog must cross a night pond to the Glow-worm Party. Each day the child does one challenge of 10 hops. Each hop shows a row of 4 or 5 lily pads counting in equal steps with one glowing empty pad ("?"). Hop sits on the pad before the gap. Four glow-worms carry numbers; the child taps the right one and Hop jumps onto the pad. A wrong glow-worm wobbles, the voice says "Try again!", and the child just taps again (no penalty, no limit). After 10 hops the first finish of each NZ day turns one of 10 magic pads bronze, then silver, then gold (30 finished days = a Golden Glow Jar, then a new animal friend and a new pond). The game reads each hop aloud, has a 100 board the child can open, and the very first hop of the very first game has a pointing hand.

## The maths

- Skip counting in tens (to 100), then fives (to 50), then twos (to 20). `shared/maths/skillPacks/earlyFacts.ts:93-97` (SKIP_STEPS), questions built at `:132-163`.
- Three question kinds per step: missing pad (`up`: 20, 30, ?, 50), what comes next (`next`: 10, 20, 30, ?) and counting back (`back`: 10, 8, ?, 4). Each step has 26 facts (17 `up`/`next` plus 9 `back`). Each fact key is one answer, e.g. `skip10:up:40`. Rows always start at a multiple of the step (0 allowed), `earlyFacts.ts:107-114`.
- Which step: `stepFor` (`shared/hop/round.ts:49-54`). The first step (10, 5, 2) whose 17 `up`/`next` facts are at least 70% "secure" (box 2 or higher, 12 of 17 facts), and never below the furthest step reached (`reached`, saved in `hop_progress`). Counting back is left out of the test (`round.ts:35-36`). Once 2s are secure the child stays on 2s forever (top of the game).
- Which facts in a round: `makeRound` (`round.ts:105-124`): 10 different facts of the step, weakest box first, ties by the seed, then shuffled. On gold days (days 21 to 30 of each pond) the last 3 hops are `back` hops instead (`BACK_HOPS`, `round.ts:23`, `progress.ts:61-63`).
- Wrong glow-worms come from the shared pack (`earlyFacts.ts:149-163`): answer +1, answer -1, the number you would get with a different step (e.g. +5 or +2 from the pad before), and numbers already on the pads.
- What decides how the help looks is NOT the child's maths: the "+10" label on the arcs is bold for finished days 0 to 9 of each pond, faint for 10 to 19, gone for 20 to 29 (`shared/hop/progress.ts:50-65`, `Hops.tsx:121-125`), unless the teacher switches labels off. A teacher setting can remove labels from day 1.
- Box moves only on a correct answer given quickly: `shared/maths/leitner.ts:55-64`, `QUICK_MS = 5000` (`shared/maths/config.ts:53`), no early-facts exception in `QUICK_MS_BY_PACK`. Two quick correct first-tries on a fact take it from box 0 to box 2.

## Scores (1 to 4)

| # | Criterion | Score |
|---|---|---|
| 1 | Maths fidelity | 2 |
| 2 | Clarity | 3 |
| 3 | Support and structure | 3 |
| 4 | Fading | 2 |
| 5 | Progression | 2 |
| 6 | Feedback | 1 |
| 7 | Progress recording | 2 |
| 8 | Engagement | 3 |

### 1. Maths fidelity: 2
- The idea is the right one (equal steps along a number line of pads, missing number, what comes next, counting back) and the row of pads with arcs and "+10" is a good number-line picture (`Hops.tsx:121-135`).
- But a child can win without counting. Played: tens hop `30 ? 50 60` had glow-worms `39, 35, 40, 32`; `40 50 60 ?` had `62, 50, 60, 70`; `0 10 20 ?` had `30, 20, 22, 31`. In tens only one glow-worm ends in 0 (or 2 of 4), so "pick the one that ends in 0" wins with no counting. Same in fives (`15 20 25 30 ?` had `31, 30, 20, 35`) and in twos (`8 ? 12 14` had `11, 9, 18, 10`: tap the even one). The +1/-1 distractors (`earlyFacts.ts:158`) are the cause. Number-already-shown distractors are also easy to rule out.
- A wrong tap costs nothing and the child can just tap all four (4 taps maximum per hop). Only the first tap is scored in the records (`play.ts:38`), which is fair, but the pupil still "finishes" and turns a pad with several wrong first taps. Day 1: I got 3 hops wrong first and still got "A lily pad turned bronze!" (completion, not accuracy, earns the pad).
- Counting back only appears on gold days (`progress.ts:61-63`), 3 hops in 10, so a child has not met it before day 21 of 30.
- No starts that are not multiples of the step, no counting forward from a non-zero start (3, 6, 9), no 5s past 50, 2s past 20. That is reasonable for Year 1-2.
- Skip counting is shown, but never linked to groups, repeated addition, or "how many hops". Plan says that is intended (not multiplication).

### 2. Clarity: 3
- Home screen: one big Play button, "Counting in tens" chip, day count. The question text ("What is missing?", "What comes next?") is short, and every hop is read aloud (`Hops.tsx:63-70`, `voiceLines.ts`, Kokoro clips, `say(...)` with the maths words "Counting in tens: 20, 30, something, 50. What is missing?").
- The first hop of the first game has a pointing hand and says how to play (`Hops.tsx:107-108`, `WORDS.guideStart`). Played: the hand pointed to 50 on the first "What comes next?" hop; it only guides one hop, which is probably enough as there is only one thing to do.
- Pre-readers cope: no reading needed apart from numbers. Voice can be turned off; falls back to the browser voice if a clip is missing.
- Weak points: "What is missing?" with a pad gap is clear, but "What comes next?" has Hop sitting on the last pad with the glow-worm choices below, and nothing says "count in tens": the arc label "+10" is the only cue, which vanishes after day 20. The first word on the Play screen on gold days (counting back) has no explanation, just "Counting back in tens: ..." spoken (`earlyFacts.ts:158`).

### 3. Support and structure: 3
- Pads in a row with arcs and "+10" step labels is a proper number-line model, shown bold at first. There is a 100 board (`HundredsBoard.tsx`, button "100 board" at the top of every hop) that the child can tap numbers on; it is off by default, unlabelled as to why it helps, and the tens column is highlighted. Good for tens and fives.
- A pointing hand on the very first hop.
- There is no help that appears when the child is stuck: no "Hop shows you the hops" animation, no hint after two wrong taps, no showing of the count (e.g. highlight +10 jumps on the 100 board). After a wrong tap the child only gets "Try again!". The 100 board does not auto-open and nothing nudges to it.
- The teacher can switch step labels off (`src/pages/TeacherHop.tsx:12-24`), which is only a lessening of support, not an add.

### 4. Fading: 2
- Fading exists, but it is by calendar, not by child. Labels go bold (days 1-10), faint (11-20), gone (21-30) from the count of finished days alone (`progress.ts:50-65`). A child who is struggling on fives still loses the "+5" labels on day 21; a child who is flying still has bold labels for 10 days. There is no link to accuracy, and support does not come back after mistakes.
- The pad colour in the row of hops also changes with the day (`padMetal`, `HopGame.tsx`), but that is decoration.
- When the step moves up (10s to 5s to 2s), the labels do NOT come back to full for the new, harder step: a child on silver/gold days jumping to 2s has faint or no "+2" labels. Played: jumped to day 20 and 2s, hop `8 ? 12 14` had no step label at all.
- The step does adapt to the child's records (see Progression), and that does "fade" the content, never the help.

### 5. Progression: 2
- Order is the right research order: tens, fives, twos, with next/missing then counting back. The step is chosen from the child's own records (`round.ts:49-54`) and never drops back. Weakest facts come first (`round.ts:94-98`). Good.
- Weaknesses: (a) the "secure" test needs a correct answer within 5 seconds (`leitner.ts:59`) and the time starts when the hop appears (`Hops.tsx:64`, `since.current = Date.now()`) while the voice reads the question aloud (about 4 to 6 seconds, `voiceLines.ts`). A slow, careful 5-year-old who is getting everything right can get no box moves at all and sit on tens indefinitely; a fast pupil can tap-guess quickly and be moved on. (b) A bot playing with fast taps moved from tens to fives after only about 2 to 3 rounds (the preview state shows `reached: 5` after 3 rounds the same day), since only 12 of 17 facts at box 2 are needed and the 10 weakest are always picked. (c) Replaying the same day also changes the records and the step (`Home` "Play again", `server.ts:157-163` records answers on every finish), so progress is not per day. (d) The first round on tens is mostly "next" and "missing" from 0 to 100 with no easy start (5 kinds of gap appear on day 1). (e) Day count and step are separate: a Day 1 pupil can be counting in fives (played), but a Day 29 pupil can still be on tens if slow.
- 2s stop at 20 and 5s at 50; top of the game is "2s forever", so a strong child has nothing further to do (no 3s, 4s, no multiples of 10 past 100).

### 6. Feedback: 1
- A wrong glow-worm wobbles, drifts back and the voice says "Try again!" (`Hops.tsx:81-89`, `words.ts:11`). That is all. Nothing shows what went wrong: no "that's one more than", no Hop jumping to show where the count goes, no animation of the +10 hops, no highlight of the pad's neighbours. After a right answer the voice only says the number ("50!") and Hop jumps.
- The child cannot learn from a wrong tap, so tapping all four is the quickest route and teaches nothing.
- No feedback at the end either: the finish screen says "A lily pad turned bronze!" regardless of accuracy. Played: three wrong first taps and the screen looked identical to a perfect round. The step-up message ("Next time we count in fives!") is the only sign the maths is noticed.
- Good: no punishing, no red crosses, the right answer's number lands on the pad so the finished row reads correctly.

### 7. Progress recording: 2
- Server saves (see below) answers per hop in the shared maths records, which is real, per-fact, quick/slow data. Taps and mistakes per round are saved too.
- But the teacher sees almost nothing: a Games-table line "Skip counting · N playing · N Golden Glow Jars" and, on the student page, "N of 30 days done on this pond · reached counting in fives · jars" plus last played (`TeacherHop.tsx:36-60`, `teacher.ts:17-24`, `teacher_hop_student` in the migration). Nothing about how accurate a pupil is, which facts they get wrong, how many days they have been stuck on the same step, or error counts. No Today-page alert for Hop (nothing in `useClassAlerts.ts` or the Today page mentions it).
- The skip-counting facts do appear in the general maths records (`gem_keep_facts`, pack `early-facts`), so a teacher who opens the maths grid for a student may see them, but nothing links back to Hop.
- Per-round `mistakes` and `taps` exist in `hop_rounds` for 30 days only (finished rounds older than 30 days are deleted).

### 8. Engagement: 3
- Painted clay art, a frog with a scarf, glow-worms with beads, jar achievements for 6 animal friends, a night pond with sparkle, sound effects, the home pond showing the 10 pads curving to the party. Hop jumping to the pad is satisfying and ties to the maths (each jump is one step). The glow-worm choice buttons are big (good on touch).
- Daily 30-day arc is a good pull for a 5-year-old, one pad a day, but also slow: day-by-day the visible reward is only a colour change, and the same hop can be replayed the same day for nothing (no extra reward).
- Fun is partly the maths (jumping along the line) and partly despite it: tapping the "ends in 0" glow-worm is fun but not mathematical. No variety of challenge during the 10 hops (every hop the same layout).

## Problems found while playing

1. Guessable by looking at endings: tens answers are the only choice ending in 0, fives answers end in 0 or 5 (the +1/-1 distractors never do), twos answers are the only even number among +1/-1 choices (see `[11,9,18,10]`, `[19,24,14,16]`, `[30,20,15,35]`). The shown-pad distractors still have to be thought about, but a child can almost always cut 4 choices to 2 without counting.
2. A child can tap all four choices at no cost; only the first tap is recorded, and the pad still changes. A child who guesses wrongly 3 times per hop gets the same reward as one who is perfect (played: 3 wrong, got bronze).
3. Mistakes teach nothing: the only reaction is the wobble and "Try again!".
4. Help (step label) fades by day count, not by child, and does not come back after a step-up. On a gold day with 2s there is no label at all (`8 ? 12 14`).
5. "Quick" is 5 seconds from when the hop appears, but the hop is read out loud first (4 to 6 seconds). Careful, correct pupils may not move up a step, and the step is the only adaptation in the game.
6. Replaying on the same day ("Play again") records answers and can move the step up (server.ts `finish` has no day limit on records). I reached fives after 3 rounds on one day.
7. Counting back (the hardest kind) first appears on gold days (day 21 onwards), only 3 hops per day, for a pupil who may have never practised it in the 20 days before.
8. Pace: some "next" hops show 4 pads then a gap, some show 3 pads; Hop sits on the last known pad; the gap number is hidden but the "?" lily pad for `next` is at the far right edge on 800px screens (looked tight but readable).
9. The preview's tools show "Count in 10s/5s/2s" etc.; not in the real game, no issue.
10. Not a bug but worth knowing: a brand new child might be placed on fives after one day if they answer quickly (the 12 of 17 rule is met by quick repeats), without ever having seen 10s as a "skip count"-- placement test would be better than guessing.

## What is saved on the server per child

- `hop_progress` (one row per pupil): `player`, `days_done` (count of finished NZ days; pads, jars and friend are worked out from it), `last_pad_day` (date), `reached` (10, 5 or 2: the furthest step), `version`, `updated_at`.
- `hop_rounds` (one row per challenge): `player`, `seed`, `step`, `gold`, `hops` (jsonb: 10 of `{key, answer, at}`), `open`, `taps` (jsonb array of `{pick, ms}`), `mistakes`, `started_at`, `finished_at`. Finished rounds over 30 days old are deleted.
- Maths records: `gem_keep_facts` rows with `pack = 'early-facts'` and `fact_key` like `skip10:up:40` (`attempts`, `correct`, `avg_ms`, `box`, `last_seen`, `quick_days`), written once per hop via `record_fact_answers` (`server.ts:163`, key `hop:<seed>`). A hop counts as correct only if the FIRST glow-worm tapped was right.
- Hub: achievement measure `hop_jars` (`days_done / 30`) and achievements `hop-hop`, `hop-gecko` ... `hop-ruru`; settings `hop_enabled` and `hop_labels` per class in `app_settings`.
- Teacher sees: Games table switch and line "Skip counting · N playing · N Golden Glow Jars" (`teacher_hop_class`), settings drawer with a Step labels toggle, student page line and panel (`teacher_hop_student`): days on this pond, pads by colour, furthest step reached, last pad day, last played. No accuracy, no mistakes, no stuck alert, nothing on the Today page.

### Queries to run on the live database (not run)

1. Where pupils are: step reached and days done.
```sql
select h.reached, count(*) as pupils,
       round(avg(h.days_done), 1) as avg_days,
       count(*) filter (where h.updated_at < now() - interval '14 days') as not_played_14_days
from public.hop_progress h
group by h.reached
order by h.reached desc;
```
2. Error rates by step over the last 30 days (needs the tap log; first-tap mistakes are `taps` where the first pick of each hop was wrong, so this approximates with total mistakes per round).
```sql
select r.step, count(*) as rounds, round(avg(r.mistakes), 2) as avg_wrong_taps_per_round,
       round(100.0 * count(*) filter (where r.mistakes = 0) / count(*), 0) as pct_perfect_rounds,
       round(100.0 * count(*) filter (where r.mistakes >= 10) / count(*), 0) as pct_ten_or_more_wrong
from public.hop_rounds r
where r.open = false and r.finished_at > now() - interval '30 days'
group by r.step order by r.step desc;
```
3. Stuck pupils: on tens or fives after many rounds, with their skip-counting facts.
```sql
select p.display_name, h.reached, h.days_done,
       count(f.*) as facts_tried,
       count(*) filter (where f.box >= 2) as facts_secure,
       round(100.0 * sum(f.correct) / nullif(sum(f.attempts), 0), 0) as pct_first_try_right,
       round(avg(f.avg_ms)) as avg_ms
from public.hop_progress h
join public.profiles p on p.id = h.player
left join public.gem_keep_facts f on f.player = h.player and f.pack = 'early-facts' and f.fact_key like 'skip%'
where h.days_done >= 8
group by p.display_name, h.reached, h.days_done
having count(*) filter (where f.box >= 2) < 10
order by h.days_done desc;
```
(Column name `display_name` is a guess; check the `profiles` table.) Also useful: how many hops are slower than 5 seconds: `avg_ms > 5000` on `fact_key like 'skip%'`.

## Strengths

- Right maths idea with a good, simple picture: a row of pads and arcs is a real number line, and the jump is one step.
- Server-checked: the round is made on the server, the taps are replayed, answers go into the shared maths records (first tap only), so records are honest and cannot be faked from the browser.
- The step (10s, 5s, 2s) adapts to what the child has shown (weakest facts first, never drops back).
- Gentle: no timer on screen, no penalty, everything read aloud, no reading needed, voice off switch, big buttons.
- Good first-time guide, a 100 board, teacher switch for labels, no ranking.
- Strong art and a 30-day habit loop with six friends; matches Beanstalk.

## Gaps

- Distractors that are +/-1 let children win by the last digit or by even/odd, with no counting.
- No explanation after a mistake (just "Try again!"), and wrong taps cost nothing.
- Help fading is by day count, not by the child; it does not return on a step-up or after struggling, and there is no extra help when stuck.
- The quick-answer rule (5 s from when the question appears, while the voice is still reading) can stop careful pupils moving up.
- Counting back is limited to 3 hops on days 21 to 30; replays on the same day move the step.
- Teachers see days, pads and furthest step only: no accuracy, no stuck alert, no facts, no Today alert.

## Candidate improvements

1. **Smarter glow-worm choices.**
   - Problem: the +1/-1 distractors make the right answer the only one that "looks right" (ends in 0, 5 or even).
   - Change: in the skip-counting pack, make all four choices valid members of the same step (e.g. for 40 in tens: 30, 40, 50, 60 and 20/70) plus one near-miss from a wrong step; or at least keep all choices in the same last digit class. Keep +1/-1 only for a "not sure" bonus.
   - Files: `shared/maths/skillPacks/earlyFacts.ts` (`skipCounting` `wrong` list), tests in `shared/hop/hop.test.ts` and the pack tests. This is shared maths so needs its own branch (per the guide).
   - Effort: S. Impact: high (turns guessing into counting).
2. **Show what went wrong on a mistake.**
   - Problem: only "Try again!".
   - Change: after the first wrong tap, light the pads and play a small hop animation of the step from the pad before the gap ("10, 20, 30, 40, ... +10, +10"), and say it; after the second wrong tap, turn the 100 board on with the pads' numbers lit. Wrong choice could also say "that is one more than" for the near-misses.
   - Files: `src/games/hop/Hops.tsx`, `HundredsBoard.tsx`, `hop.css`, `voiceLines.ts` and `words.ts` (new lines with clips).
   - Effort: M. Impact: high.
3. **Make the reward depend on the maths a little.**
   - Problem: three wrong first taps per hop earns the same pad as a perfect round.
   - Change: keep the pad for finishing (so a slow child still wins), but add a small visible mark for hops done first try (glow-worm count or a star trail), and replay a missed hop at the end of the round once ("one more go") so each fact is eventually answered right with help gone.
   - Files: `shared/hop/play.ts`, `Hops.tsx`, the finish screen in `HopGame.tsx`.
   - Effort: M. Impact: medium.
4. **Fade support by the child, not the day.**
   - Problem: labels fade by day count and do not return.
   - Change: use the step's own secure share (or recent accuracy, e.g. last 20 hops of this step) to choose labels `full/faint/none`; show full labels again on the first days of a new step; bring labels back for a hop after two wrong taps. Keep the teacher off switch.
   - Files: `shared/hop/progress.ts` (`Help` from `pondAfter`), `shared/hop/server.ts` (`load` returns help), `Hops.tsx`, tests.
   - Effort: M. Impact: high.
5. **Fix the "quick" time for Hop.**
   - Problem: 5 s from the hop appearing, while the voice is still reading; slow careful pupils cannot move up.
   - Change: start the clock when the voice finishes (or add `early-facts: 10000` to `QUICK_MS_BY_PACK`, which lives in shared maths), and add a second route up a step: 8 of the last 10 first-try correct even if slow.
   - Files: `shared/maths/config.ts` (shared, own branch) and `src/games/hop/Hops.tsx`, `shared/hop/round.ts` (`stepFor`).
   - Effort: S to M. Impact: high.
6. **Teach counting back earlier and give strong pupils more.**
   - Problem: counting back first on day 21, and the game ends at 2s to 20.
   - Change: add 1 counting-back hop from silver days, and a "next level" for strong children (e.g. 3s, 4s, 10s past 100, starting from non-multiples such as 3, 6, 9... decided with James).
   - Files: `shared/hop/round.ts` (`BACK_HOPS`), `shared/hop/progress.ts`, `earlyFacts.ts`.
   - Effort: M. Impact: medium.
7. **Teacher view: who is stuck.**
   - Problem: the teacher sees days and furthest step only.
   - Change: add to `teacher_hop_student` / `teacher_hop_class` per-step accuracy (first-try right %), average time, days on the current step, and a "stuck on fives for 8+ days" line in the class table and on the Today page alerts (src/teacher/useClassAlerts.ts, Today.tsx). Use `gem_keep_facts` pack `early-facts` and `hop_rounds`.
   - Files: new migration with replaced functions, `src/data/hop.ts`, `src/pages/TeacherHop.tsx`, `src/teacher/useClassAlerts.ts`.
   - Effort: M. Impact: high for you as a teacher.
8. **Stop replays moving the step the same day.**
   - Problem: "Play again" records answers and can move the step; a child can finish a day on tens and come back on fives.
   - Change: either do not record answers for a second finish on the same NZ day or cap the step moves to one per day; keep the practice for fun.
   - Files: `shared/hop/server.ts` (`finish`), tests.
   - Effort: S. Impact: low to medium.
