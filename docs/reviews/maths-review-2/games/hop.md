# Hop's Glow-worm Pond: second review (8 Nov 2026)

Blind rerun: scored from today's code and from playing the preview. No earlier score was read. Skip counting, ages 5 to 7. Evidence is marked **(play)** = seen in the preview, **(code)** = read in code, **(code only)** = could not be checked by playing (voice audio cannot be heard here, so all voice claims are code only).

Playing note: `vite dev` on port 5302 kept returning "504 Outdated Optimize Dep" and a blank page (another helper's server shares the same dependency cache). I built the preview into the scratchpad and served that on 5302 instead. The built game is the same code, with the pretend server in the browser.

## How it works

Hop (a frog; later friends gecko, wētā, tuatara, kiwi, ruru) must cross a dark pond. Each day the child plays ten "hops". Each hop shows a row of 4 or 5 lily pads on the pond, evenly spaced, counting in equal steps, with one pad empty and glowing ("What comes next?" or "What is missing?"). Four glow-worms carry numbers. The child taps the right glow-worm; Hop jumps onto the pad. The step ("+10") is written over each jump arc, bold, faint or not at all depending on how well the child knows that fact. A wrong glow-worm greys out and a small picture and a line explain the slip; a second wrong one starts "Let's look together" (Hop counts the row, a 100 board lights up on wide screens), then "Now you try" with the worms reshuffled. Finishing ten hops turns one of ten pads on the home pond (bronze, then silver, then gold; 30 days in all, then a Golden Glow Jar and a new friend). Playing again the same day gives no new pad.

## The maths

Questions are the shared skip-counting facts (`shared/maths/skillPacks/earlyFacts.ts`, `parseSkip` ~line 207), asked as a missing pad in a row of pads (a number line with arcs), with the answer picked from four numbers.

Steps, in this order (`shared/hop/round.ts:41-48`): tens (to 100), fives (to 100), twos (to 100), threes (to 100), fours (to 100), tens past 100 (to 200).

Question types inside a step: "what comes next" (gap at the end, `next`), "what is missing" (gap in the middle, `up`), and counting back (`back`). Gold days (days 21 to 30 of a pond) also add two hops that start off a multiple ("from 3", `GOLD_FROM_HOPS = 2`, round.ts:34, 251-253).

How the next step is chosen:
- Today's step is the first step in the list, not below the furthest step reached, where fewer than 70% of its `up` and `next` facts are in Leitner box 2 or more (`stepFor`, round.ts:94-99; `STEP_SECURE_SHARE = 0.7`, `shared/maths/selector.ts:60`; `stepShare`, round.ts:84-88). Counting back is left out of this share.
- The furthest step reached is saved and a child never drops below it (round.ts:94; `hop_finish` in `20261104000600_hop.sql` and `20261107000600_hop_longer_ladder.sql`).
- Inside a round the ten hops are the child's weakest facts in the step (lowest box first, ties by seed), shuffled (`pickKeys`, round.ts:229-233; `makeRound`, 240-265).
- Counting back: once a step is secure going forward, 1 hop a round counts back, 2 when a third of that step's back facts are box 2+, 3 at 70%; always 3 on gold days (`backPlan`, round.ts:123-132). Back hops come from the latest secure step up to today's, so older steps do come back through this route only.
- A fact moves up a box only when right and within 10 seconds of the question being read (`JUNIOR_QUICK_MS`; `shared/maths/leitner.ts:44-65`), and any wrong first tap drops it to box 1.
- Wrong glow-worms are built from real slips (`showHop`, round.ts:274-313): one more or less ("off1": counted the jump as a pad), the pad Hop is sitting on ("stay"), one hop too far ("far"), where a different step would land ("step"), and for back hops "going the wrong way". Exactly two of the four share the answer's ending, so "ends in 0" does not give it away (round.ts:212, 311).

## Scores (1 to 4)

| Criterion | Score |
|---|---|
| 1. Maths fidelity | 3 |
| 2. Clarity | 3 |
| 3. Support and structure | 3 |
| 4. Fading | 4 |
| 5. Progression | 3 |
| 6. Feedback | 3 |
| 7. Progress recording | 3 |
| 8. Engagement | 3 |
| **Total** | **25 / 32** |

### 1. Maths fidelity: 3
- The representation is right: equal arcs on a row of pads labelled "+10", with the empty pad one jump on from where Hop sits; a 100 board lights up the counted numbers in Look together (play; `HundredsBoard.tsx`, `Hops.tsx:204`). Counting back shows "−5" arcs and the numbers go down (play, gold day).
- The wrong choices are real slips (`round.ts:274-313`) and the "ends in 0 / ends in 5" tell is blocked: 2 of 4 share it (code; seen in play: 40, 30, 35, 41 for "20 30 ?" where 30 is the pad Hop sits on and 35 and 41 are off-step slips).
- Loophole: the round cannot be failed. I tapped every glow-worm in order for the second half of a round and one right in the first hop only: the round finished, the screen said "Well done! A lily pad turned bronze!" and the saved facts were 9 wrong of 10 (play; `shared/server.ts:156-158`, `progress.ts:82-86`). Day count and the 30 day jar depend only on finishing, not on being right. The maths records are honest, so the step does not move, but the pad and jar are free.
- Only the first tap is scored (`play.ts:38`), and two wrong taps open "Let's look together" which says the counted numbers up to the answer ("Counting in tens: 0, 10"), so a child can copy the answer in "Now you try" (play). That is fine for teaching, but together with the free pad it means tapping without maths always finishes.
- The question is a four-choice pick of the missing number, not building the jump or counting on a line; it is a close skill match but still a pick-an-answer quiz on a picture.

### 2. Clarity: 3
- Voice on by default, every hop read aloud with the numbers and "What comes next?" (`Hops.tsx:94-102`, `words.ts`, code only; I could not hear it). There is a Voice on/off button but no "hear it again" button on the play screen (play; `HopGame.tsx:148-152`; `HearAgain` is not used). A child who missed the line cannot replay it.
- The first ever go has a pointing hand on the right glow-worm of hop 1 (play, `hopGuide.test.tsx`; `Hops.tsx:188`). Only the first hop is guided.
- Targets are large: glow-worm buttons 130 x 150 px at 1024 wide (play, measured); no timer; ten hops, one pip row (play).
- One thing at a time: the pond, the one line of text and four numbers. In Look together on a wide screen the 100 board opens at left and was covering the Preview tools (play; preview only, not a child issue) and the board is a lot to take in. On phones it stays shut (`Hops.tsx:32-33`).
- Gold days change the rules without saying so: "from 3" hops and counting back both just appear (play, day 21). The "from 3" wording is only in the voice line ("Counting in tens from 3"); the screen shows only the numbers.

### 3. Support and structure: 3
- The model (pads, arcs, step label, 100 board) is always there (play).
- Help is automatic: the first wrong tap shows a why picture and line, the second starts Look together, three first-wrong hops in a row put full labels back (`Hops.tsx:140-185`; play for the first two, code for the third). The child never hunts for a hint.
- Demonstration for new things: only the guided hand on the very first hop of the first go (`Hops.tsx:188`, `HopGame.tsx:131`). Counting back, a new step (threes, fours, past 100) and "from 3" hops have no demonstration; the finish screen says "Next time we count in fives" and nothing more (`words.ts:54`). That is why this is a 3 and not a 4.

### 4. Fading: 4
- Per-fact label ladder: full until the fact is box 2 and right quickly on two different days; faint until box 4 and 6 right; then none (`round.ts:146-151`, `shared/kit/help.ts` `helpForFact`). The help level is chosen when the round starts and saved in each hop (`h`, round.ts:263).
- Returns after a slip: a wrong first tap drops the fact to box 1, so its full label comes back (`leitner.ts:55-57`). Three first-wrong hops in a row put full labels back for the round (`Hops.tsx:154-156`, `play.ts:49-53`). Seen in play: a new step (fives on a gold day) started with full "+5" labels even though the calendar said gold (play).
- A strong child is not slowed: labels go to none, and counting-back hops and bigger steps take over when facts are secure (code).
- Teacher can switch labels off for the class (`teacher.ts`, migration `hop_labels`).
- Small caveat: the 100 board is only in Look together, so there is no step down of the board itself; the only fading picture is the label.

### 5. Progression: 3
- A sensible research order and per-child adaptation: step by the 70% rule, weakest facts first, counting back added as each step is secure, offset starts on gold days, a long ladder to 200 (`round.ts:41-48, 94-99, 123-132, 240-265`).
- Mastery: a step needs 70% of its facts in box 2, and a box up needs a quick right answer, so one lucky tap does not move a child on (code). But box 2 only needs two quick rights, not two days.
- No success-rate target: nothing aims for 75 to 90% right. Children who find a step hard keep the same pool of weakest facts but there is no easier rung (no smaller step or shorter row) to drop to; the `reached` ratchet means they stay in the step (code).
- Spacing and mixing: a round is all in one step plus the back hops; older steps' forward facts are not revisited once the step is passed (only back hops and gold offsets reach older steps). Types are not mixed except on gold days (play: gold day mixed 5s, 10s with "9 19 29" and back hops).
- Ladder includes a signpost to Penguin Pairs when twos are secure (`HopGame.tsx:205`).

### 6. Feedback: 3
- A mistake gets a reason on a picture with a line read aloud: "70, then 10 more is 80", "That is the pad we are sitting on. We need to hop", "We are counting in tens. Each hop is 10" (play; `words.ts:30-44`, `WhyPicture.tsx`). Wrong choices are tagged by kind and the picture matches (code).
- Second wrong tap: Hop counts the numbers aloud to the answer while the board lights them; then "Now you try" with the worms reshuffled (play; `Hops.tsx:121-138`, `useLookTogether`). A redo is not saved as a new answer.
- Tone is kind and there is no penalty (play).
- Gaps: the "Now you try" can be done by copying the number just said. The reasons show the same model only in part: the why picture is a small separate row of pads, not the pond row itself (play, screenshot; `WhyPicture.tsx`). Praise is generic and does not depend on how the day went: "Well done! A lily pad turned bronze!" showed after 9 wrong of 10 (play), and "You are so good at this!" appears only on a step-up. No effort or strategy praise.

### 7. Progress recording: 3
- Per answer, in the shared maths records via `record_fact_answers`: fact key (e.g. `skip10:next:40`), attempts, correct, box, avg ms, last seen, quick days, one answer a hop, first tap only (`server.ts:149,163`; saved facts seen in play: key, attempts, correct, box).
- Per round, in `hop_rounds` (`20261104000600_hop.sql`): seed, step, gold, the ten hops with their saved help level `h`, `taps` (every pick and ms, so every wrong glow-worm number is kept), `mistakes`, started and finished times. Wrong choices and help level are therefore saved, but only inside JSON; nothing groups them by kind of slip (the kind is not stored, only derivable by rebuilding the hop).
- The teacher sees: a line on the pupil page (days done, step reached, jars, last pad day: `TeacherHop.tsx`); Today alerts via the Foundational alerts (same step too long, guessing, low accuracy, quiet: `FLAG_RULES` in `teacher/foundational/config.ts:9-20`) fed by `recent` rounds (date, mistakes, taps, step) from `20261107000100_foundational_teacher_views.sql`; a class grid column "Counting in steps" (`ideas.ts:57`). 
- Gap: the teacher side only knows steps 10, 5 and 2 (`config.ts:45` levels and `top: 2`, `ideas.ts:57` keys skip-10/5/2). Children on threes, fours or tens past 100 have no level name, and the grid column ignores those facts (code). The wrong numbers a child chose, and which slip they were, are not shown.

### 8. Engagement: 3
- The pull is a clear goal and visible growth: ten pads turning bronze, silver, gold; new friends; a Golden Glow Jar after 30 days; no points, nobody ranked (code; `progress.ts`, play: home pond with pads).
- The maths is the action (hop where the pads count), the jump animation is a pleasing result, and the voice and painted art are warm (play).
- The reward does not depend on being right: a pad turns on any finished round (loophole above), so the main reward pays for finishing. Choices: the child chooses nothing (no friend, no step, no pond choice). No social features (which is fine and kind). Good: a teacher could ask "how did you know it was 40?" (play).

## The 25-item checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Maths action is the game | partly | Pick the missing pad on a pad row (play); a pick-a-number quiz on a picture, not making the jump |
| 2 | Cannot win by guessing/tapping everything | no | Tap-everything finishes the round and turns a pad; 3 wrong at most per hop then look together (play) |
| 3 | Representation matches and is correct | yes | Equal arcs, +step labels, 100 board in look together (play) |
| 4 | Pre-reader can start alone | yes | Voice on, guided hand on first hop (code; play for hand). No replay of the line |
| 5 | One question, one action, labels next to things | partly | Clear (play); the board and why-picture add a second row in help moments |
| 6 | Big targets, no timer, short sessions | yes | 130 x 150 px worms, no timer, ten hops (play) |
| 7 | Model available for new skill | yes | Pads and arcs always shown (play) |
| 8 | Help appears automatically | yes | Why line after 1st wrong, Look together after 2nd (play) |
| 9 | Worked example first time a new type appears | partly | Hand on hop 1 of first go only; none for back, from-3, new steps (code, play) |
| 10 | Support reduced in steps | yes | full, faint, none per fact (`round.ts:146-151`) |
| 11 | Support returns on failing | yes | Box 1 on a wrong tap; 3 in a row boost (`Hops.tsx:154`; `leitner.ts:55`) |
| 12 | Expert not slowed | yes | Labels go to none; steps move on at 70% (code) |
| 13 | Research order | yes | 10, 5, 2, 3, 4, 10 past 100 (`round.ts:41-48`) |
| 14 | Adapts toward 75 to 90% | partly | Adapts by step and weakest facts; no success-rate target and no easier rung |
| 15 | Old skills return; types mixed | partly | Back hops and gold-day from-3 hops only; passed steps' forward facts are not revisited |
| 16 | Move up needs steady success | yes | 70% of a step in box 2, quick rights needed (`round.ts:94-99`) |
| 17 | See what went wrong, same model | partly | Why picture with a line (play); picture is a mini row, not the pond itself |
| 18 | Another go with help | yes | Now you try after Look together (play) |
| 19 | Praise effort, "not yet" | partly | Kind, no shame (play); praise is generic and shown even after 9 wrong |
| 20 | Server saves per child, per skill | yes | Facts per key, rounds with taps, mistakes, help level, dates |
| 21 | Wrong answer chosen saved | partly | Every pick saved in `hop_rounds.taps`; kind and counts not surfaced to teachers |
| 22 | Teacher sees who is stuck/not played | partly | Alerts, grid, pupil page; levels 3, 4, 200 missing from the teacher config |
| 23 | Fun from maths; rewards decorate success | partly | Pads and jar pay for finishing, not for being right (play) |
| 24 | Real choices, visible growth, kind social | partly | Visible growth yes; no choices; no social |
| 25 | Clear goal, active thinking | yes | Clear goal and talk-about-able (play) |

## Problems found, ranked by harm to learning

1. **A day can be "won" with almost no maths.** Steps: Play, tap the first glow-worm each time (or tap in order, whatever it says). Each wrong glow-worm greys out; after two wrong, Look together reads out the counted numbers up to the answer, then Now you try. Ten hops finish with 9 of 10 first taps wrong and the screen says "Well done! A lily pad turned bronze!". (I saw exactly this in play.) The pad and the 30-day jar depend only on finishing. Cost to the tapper: about 10 to 15 seconds a hop. Learning cost: the records stay honest, but the child does not move on and is praised.
2. **Praise is not tied to the day.** Same finish screen after 9 wrong or 10 right (`HopGame.tsx:202-207`, `words.ts:52-53`). No "that was tricky, we will practise" for a hard day.
3. **Look together gives the answer, and Now you try can be copied.** After two wrong taps the numbers up to the answer are shown and said, then the child picks the same number from reshuffled worms (play). It teaches the counting but proves little.
4. **New things start with no demonstration.** Counting back, "from 3" hops (gold days) and a new step (threes, fours, past 100) arrive unannounced; the finish says "Next time we count in fives" only (play, day 21; `words.ts:54`). Full labels help but the idea of counting back or "from 3" is not shown first.
5. **Teacher view is out of step with the ladder.** `config.ts:45` names only 10, 5, 2 (`top: 2`), and `ideas.ts:57` collects only skip-10/5/2 keys. A pupil on threes, fours or tens past 100 has no level name and their facts are not in the grid column (code). "Same level for 5 days" alerts for those steps rely on `levels` names that do not exist.
6. **No replay of the spoken question** on the play screen (play: only a Voice on/off button). A child who missed the question cannot hear it again without answering.
7. **Gold-day change is silent on screen.** "from 3" starts and counting back appear with no sign other than a "−5" label and the spoken words (play).
8. **100 board.** Opens by itself in Look together on screens 900 px and wider and sits over part of the page (in the preview it hid the Preview tools button). It is a lot of numbers for a 5 year old at a moment of struggle.

## Saved per child on the server

- `hop_progress` (one row per pupil): `days_done`, `last_pad_day`, `reached` (10, 5, 2, 3, 4, 200), `version`, `updated_at` (`20261104000600_hop.sql`, widened by `20261107000600_hop_longer_ladder.sql`).
- `hop_rounds` (one per challenge started): `seed`, `step`, `gold`, `hops` (JSON: `key`, `answer`, `at`, `h` = help level shown), `open`, `taps` (JSON list of `{pick, ms}`: every glow-worm tapped, wrong ones included), `mistakes`, `started_at`, `finished_at`. Rounds over 30 days old that are closed are deleted when the pupil starts a new one.
- The shared maths records (one row of stats per fact key, via `record_fact_answers`): attempts, correct, box, avg ms, quick days, last seen. First tap only, once per hop.
- Wrong choice: saved (as a number inside `taps`); its kind is not saved. Help level: saved per hop inside `hops`.
- Teacher can see today: a pupil-page line (days, step reached, jars, last pad day, last played); Foundational Today alerts (same step too long, many wrong taps or looks like guessing, low accuracy, quiet) from the last ten finished rounds (date, mistakes, taps, step); a class grid column "Counting in steps" built from skip-10/5/2 facts; the Games table line (players, jars). The wrong numbers chosen and the step labels shown are not on any teacher screen. Hardest facts: from the shared maths records; not specific to Hop.

Read-only SQL for the live database (not run):

```sql
-- 1. Who is on which step (levels reached)
select reached, count(*) as pupils, round(avg(days_done), 1) as avg_days
from public.hop_progress
group by reached
order by public.hop_step_rank(reached);

-- 2. Error rates: wrong glow-worms per finished challenge, by step, last 30 days
select step, count(*) as rounds, round(avg(mistakes), 1) as avg_wrong_taps,
       count(*) filter (where mistakes >= 10) as rounds_with_10_plus_wrong
from public.hop_rounds
where finished_at > now() - interval '30 days'
group by step
order by public.hop_step_rank(step);

-- 3. Possibly stuck or tapping: pupils with 5+ finished rounds in 14 days on one step, and their wrong taps
select player, step, count(*) as rounds, sum(mistakes) as wrong_taps, round(avg(mistakes), 1) as avg_wrong
from public.hop_rounds
where finished_at > now() - interval '14 days'
group by player, step
having count(*) >= 5
order by avg(mistakes) desc;
```

## Strengths

- Pads on a number line with equal arcs and "+step" labels is the right model; counting back and the 100 board fit it (play).
- Wrong glow-worms are built from real slips and cannot be picked by their ending (round.ts:212, 274-313).
- Help is per fact, saved with the round, fades in three steps and comes back after a wrong tap or three in a row (round.ts:146-151; Hops.tsx:154).
- Mistake flow: why line and picture, then Look together, then Now you try, all voiced (play, code).
- Honest, server-replayed records with per-hop saved help and every tap kept; replay of taps is checked by the server (`play.ts`, `server.ts:133-174`).
- Calm: no timer, big targets, the clock starts after the voice (`Hops.tsx:94-102`), no ranks.
- A long ladder (to 200, back hops, offset starts) and a signpost to Penguin Pairs.

## Gaps

- Finishing is rewarded whatever the accuracy; tapping everything works to get the pad and the jar.
- Praise is not related to how the day went or to strategy.
- No demonstration for counting back, offset starts or new steps; no replay of the spoken question.
- No success-rate target, no easier rung for a struggling child, no revisit of passed steps' forward facts.
- Teacher screens do not know steps 3, 4 and 200; the kind and content of wrong choices are saved only as raw numbers and are not shown.
- The child makes no choices.

## Candidate improvements

1. **Make the pad depend on a fair try.** Problem: a pad, and so the jar, comes from finishing even with 9 of 10 wrong. Change: on a day with fewer than, say, 5 right first taps, keep the pad grey ("not yet, play again") and bring in an easier round on retry (same step, labels full, 5 hops); the day still counts but tomorrow starts with full labels. Files: `shared/hop/progress.ts`, `shared/hop/server.ts` (finish), `HopGame.tsx` finish screen, tests. Effort: M. Impact: high (removes the main loophole and says honestly when a child needs help).
2. **Praise by effort and strategy.** Problem: same "Well done" on any result. Change: finish screen lines by how the day went ("You counted in tens all the way", "That was tricky. We will practise these"), no shaming. Files: `words.ts`, `voiceLines.ts`, `HopGame.tsx`, voice clips. Effort: S. Impact: medium.
3. **Make "Now you try" prove something.** Problem: the answer is shown, then copied. Change: after Look together, redo with a different hop of the same fact type (a new gap or start), not the same one. Files: `Hops.tsx`, `round.ts` (a spare hop per fact). Effort: M. Impact: medium to high.
4. **Show new ideas before they are asked.** Problem: counting back, "from 3" starts and new steps appear with no demonstration. Change: the first time each appears, Hop does one guided example (a hand and a spoken "now we hop back"), saved per child so it shows once (use the kit's `FirstTimeTip`/`useGuidedFirstGo`). Files: `Hops.tsx`, `HopGame.tsx`, server first-seen flags (a small migration or the existing maths records), voice. Effort: M. Impact: high for the harder types.
5. **Add "Hear it again" to the play screen.** Problem: a missed question cannot be replayed. Change: use the kit's `HearAgain` beside the question. Files: `Hops.tsx`, `hop.css`. Effort: S. Impact: medium for pre-readers.
6. **Teach the teacher screens the whole ladder.** Problem: threes, fours and past 100 are missing from `config.ts` levels, `top`, and the `steps` idea keys. Change: add 3, 4, 200 level names, set the top step to 200 and add skip-3/4/10h keys (or a second column). Files: `src/teacher/foundational/config.ts`, `ideas.ts`, tests. Effort: S. Impact: medium (right alerts and a true picture for advanced pupils).
7. **Show teachers the slips.** Problem: wrong picks are saved but not shown. Change: store the kind of each wrong choice (from `showHop`) with the tap, count the main kind per pupil, show "often counts the jump as a pad" on the pupil page and as a Hardest line. Files: `shared/hop/play.ts`, `hop_finish` (new column or JSON field), `TeacherHop.tsx`. Effort: M. Impact: medium.
8. **Revisit passed steps and give an easier rung.** Problem: no spacing for forward facts of older steps; no step down for a struggling child. Change: one hop a round from a passed step's secure facts; a child under about 60% over their last 20 hops gets shorter jumps or a longer row. Files: `shared/hop/round.ts`, tests. Effort: M. Impact: medium.

## Learning-design rules (read after scoring)

| Rule | Result | Evidence |
|---|---|---|
| 1. The maths is the move | partly | Pad picking is close to the skill and 2 of 4 choices share the tell (round.ts:212). Wrong taps are capped at 2 before Look together. But the day finishes and the pad turns whatever the accuracy, and the redo can be copied |
| 2. One thing at a time, voice first | partly | Voice default, guided hand, big targets, no timer (play). No "Hear it again" on the play screen; the 100 board adds a second thing in help moments |
| 3. Concrete, then picture, then number | met | Number-line pads with arcs, labels fade, board in help (play, code) |
| 4. Help arrives by itself | partly | Why line, Look together, three-in-a-row boost (play, code). First-time demo only for the very first hop; none for back, from-3 or new steps |
| 5. Help follows the child, not the calendar | met | Per-fact ladder from records; calendar only sets scenery (`round.ts:146-151`; the calendar `help` is only the fallback for old rounds, `Hops.tsx:115`) |
| 6. Progression | partly | Research order, 70% rule, long ladder, back hops, signpost. No 75 to 90% target, passed steps' forward facts not revisited. Practice replays do not move the pad but do record facts (play: step records change on any round; `progress.ts:82`) |
| 7. Mistakes teach | partly | Why picture and line, Look together, Now you try (play). Kind not recorded; redo copyable; praise generic |
| 8. Fair timing | met | Clock starts after the voice (`Hops.tsx:94-102`), `JUNIOR_QUICK_MS` for records (`server.ts:102`) |
| 9. Record evidence a teacher can use | partly | Every pick and the help level are saved; alerts and grid exist. No wrong-choice kind, steps 3, 4, 200 missing from teacher config |
| 10. Fun comes from the maths | partly | Visible growth and a long goal. Reward pays for finishing, not for correct work; no choices |

### Game kit parts (`docs/plans/GAME-KIT-PLAN.md`), checked against the code

Used today:
- `shared/kit/help.ts`: `helpForFact` and `STRUGGLE_GOES` (`round.ts:16,146`, `Hops.tsx:17`).
- `shared/kit/mistakes.ts`: `tagWrongs`, `atMostShareTell`, `sharingTell`, `NEW_GO`, `stepGo` (`round.ts:17`, `Hops.tsx:18`).
- `src/kit/ShowWhy.tsx`: `ShowWhy`, `LookTogether`, `NowYouTry`, `useLookTogether` (`Hops.tsx:19`).
- `src/kit/WhatsNext.tsx` (`HopGame.tsx:11`).
- The shared teacher grid and alerts (`shared/kit/teacherGrid.ts`, `src/teacher/foundational/`) are used through the Foundational views, though without the newer steps.

Could use but does not:
- `src/kit/NumberLine.tsx`: the pond is drawn by its own `LilyPad`/arc art, which is fine as painted art, but a real `NumberLine` (with `lens`) could show the counted hops under the pond in Look together and for the 100 board alternative.
- `src/kit/HearAgain.tsx`: no replay of the spoken question.
- `src/kit/FirstTimeTip.tsx` and `src/kit/useGuidedFirstGo.ts` / `PointingHand.tsx`: the guided first go is hand-built (`Hops.tsx:188`) and covers only the first hop ever; the kit parts could give a first-time demo for counting back, "from 3" and each new step.
- `shared/kit/help.ts` per-child `fadeAfter`/`placeAfter`: not needed (per-fact works here).
- `shared/kit/replay.ts` and `dayArc.ts`: Hop has its own `replay` (`shared/hop/play.ts`) and its own pond/days arc (`progress.ts`); these could be moved onto the kit when next touched.
- `src/kit/voiceLinesSuite.ts`: not used; Hop's own `voiceLines.test.ts` does the clip checks by hand.
