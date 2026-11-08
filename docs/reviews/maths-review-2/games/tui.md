# Tūī's Ten Tree: second review (blind)

Maths idea: teen numbers as a full ten and some more. Folder `tui`. Played in the preview (`vite.tui-preview.config.ts`, port 5305) with the trial backend, 8 Nov 2026. Marked "seen" where I saw it in play, "code" where I only read it.

## How it works

Each day a child does one challenge of ten goes. Tūī the bird sits by a big kōwhai tree. Berries show as a full ten-frame (the "branch") and some loose berries in a second frame; Bella's voice asks "How many berries?" and the child taps one of four nests (14, 15, 41, 4, and so on). A right answer: the arrow cards slide together ("10 and 4 is 14"), Tūī eats, and the next go starts after about 3.4 seconds. A wrong tap greys that nest out and says why, with a picture. A second wrong tap in the same go starts "Let's look together", which plays the whole sum, and then "Now you try!" asks the same go again with the nests re-ordered. Ten goes finish the day; one kōwhai flower changes colour per NZ day (30 days to a Golden Nest, then a new bird friend). Help is a picture that fades over six levels as the child has good days.

## The maths

Facts are the shared "ten and" facts: nine numbers (ones 1 to 9) kept as `tenand:n` (10 + n, n + 10) and `tenless:n` (10 + ? = teen, teen − 10) in the hub's maths records (`shared/tui/round.ts:44-47`, shared pack `shared/maths/skillPacks/earlyFacts.ts:77-105`).

Four "ways" of asking (`round.ts:49-54`): 0 "10 + 4 = ?", 1 "4 + 10 = ?", 2 "10 + ? = 14", 3 "14 − 10 = ?". Five steps in a fixed order: 1 How many? (way 0 only), 2 Turn it round (0, 1), 3 How many more? (0, 1, 2), 4 Take the ten away (0 to 3), 5 All mixed (`round.ts:49-55`). From step 2 to 4, 7 goes are the new way and 3 are earlier ways (`waysFor`, `round.ts:~200`, `REVIEW_GOES`). Each round has every number 1 to 9 once, weakest first (by Leitner box), then the weakest again (`makeRound`, `round.ts:~215-235`).

Next step: a step is passed after two "good" challenges at it (8+ of 10 right at the first tap) (`placeAfter`, `round.ts:121-142`; `GOOD_TO_PASS = 2`). It never goes back. A child who has box 2 or more on seven of nine "ten and" facts at first play starts at step 3, level 4 (`startFor`, `round.ts:~108`).

Help level (separate): 5 every berry counted in (popping in), 4 both ten-frames with the sum written, 3 a kete (bag) with "10", 2 kete small and faint with a big sum, 1 sum only plus a Peek button, 0 sum only (`Goes.tsx:262-296`). Two good challenges in a row take it down one; a hard one (4 or fewer right) puts it up one; a new step puts it up one only if it didn't just fade, never below level 4 (`round.ts:121-142`). Teacher can set Fades / Always (level 4) / Off (level 0) (`shownLevel`, `round.ts:~97`).

Wrong nests are built from named mistakes (`wrongNests`, `round.ts:~250-275`): reversal 41 for 14, 20 (two tens), the loose berries alone (4), one berry out, the whole when asked for a part, the ten added on (24 for 14).

## Scores

### 1. Maths fidelity: 3
- Maths is correct and is the action: counting a full ten plus loose berries, matching a number to the picture and the arrow cards (code `Goes.tsx:258-311`; seen).
- Representation is right: two ten-frames (full branch plus the ones), "10 + ? = 12" with empty dashed spaces for the missing berries, the ten flying away for take-away; arrow cards "10 and 2 is 12" (seen at steps 1, 3, 4).
- Guessing is possible: four nests, 25% by chance, and the round can be finished by tapping everything (seen, below). Elimination works: after five wrong taps in one go only the answer was left enabled.
- The "Let's look together" panel says and shows the answer ("17! 10 and 7 is 17") and then "Now you try!" with the answer one tap away (seen; `Goes.tsx:157-171`). The child can copy, and it is scored as wrong, but nothing needs thinking.
- At help levels 5 and 4 the picture has the ones counted for the child, so the answer is a count (that is the lesson); at level 2 the "take the ten away" picture shows the leftover berries, so it shows the answer. Acceptable support, but no maths needed at those levels (seen).

### 2. Clarity: 3
- Pre-readers can start: voice reads every go (story line at level 5, sum at levels 4 to 1), "Hear it again" button on screen, Voice on/off (`voiceLines.ts`; button seen, 140 x 56 px). I could not hear the audio in the preview (code only for the sound itself).
- First go has a pointing hand over the branch, loose berries and nests (`GUIDE_AT`, `Goes.tsx:37`; seen). The hand ends on the last nest (21 on my go), which is a wrong nest, and could look like a tip.
- Targets: nests 132 x 94 px, same four positions, no timer on the child (no countdown anywhere; seen). Good.
- Level 5 shows no written number at all, so the child relies on voice for "10 and 7"; level 0 reads only "How many?" and the child must read the sum. A non-reader who has got to level 0 or 1 loses the voice for the actual numbers (`shortLine`, `voiceLines.ts`; code).
- Why-panels sit over the nests at the bottom ("Let's look together" box overlapped the top of the nests in my screenshot) and the faint level-2 picture sits over yellow tree berries and is hard to see (seen).
- A round is exactly ten goes with a flower at the end: a clear stop point (seen).

### 3. Support and structure: 3
- A model is always there at levels 5 to 2 (ten-frames, then kete) and returns after wrong taps; Peek at level 1 (seen).
- Help is automatic: after the first wrong tap the picture steps up a level; after two the "look together" demonstration plays itself (seen; `pictureFor`, `round.ts`; `Goes.tsx:89-94`).
- No worked example when a new type first appears. A new step (for example "10 + ? = 14") just starts with level 4 frames and the sum; the only demonstration is the guided first go on day one for way 0, and the after-answer arrow cards. Not a worked example per type (code and seen at step 3 and 4).
- The planned "third wrong tap fades the nests to two" is built in `pictureFor` (`round.ts`) and tested (`tui.test.ts:99`), but `Goes.tsx` never uses `pic.nests` (grep finds no use); I confirmed in play that after five wrong taps all other nests were just grey.

### 4. Fading: 3
- Fading is gradual in six levels and per child, tied to results: two good challenges lower the level; one hard challenge raises it (`round.ts:121-142`; seen: after two perfect days the level only went from 5 to 4).
- It returns with struggle (hard challenge, and within a go a wrong tap raises the picture) (code, partly seen).
- But it is one level for the whole game, not per skill: a child secure at "10 + n" but weak at "n − 10" gets the same help for both; the step moves help up by one but only to level 4 at minimum (`NEW_STEP_HELP`, `FRAMES_LEVEL`). There is no way to tell an expert to skip the berries other than the start at step 3/level 4 on first play (`KNOWN_START`).
- It is also slow: from the preview, 6 days of all-right play went level 5 to 4. Reaching level 0 takes around 10 good challenges, which a quick child will feel as expertise reversal (seen and code).
- Fading per day not per go; no within-challenge fade for a child who gets the first five right.

### 5. Progression: 3
- Order is sensible: ten-and-n, then 4 + 10, then "how many more", then take away, then mixed (`STEPS`). Numbers 1 to 9 all at once from day one; no easier subset (11, 12 first) (code).
- Adapts per child by streak: two good challenges to pass a step, level moves with results, weakest facts come first and last in each round (code).
- No mastery bar beyond "8 of 10 right at the first tap, twice" and the step never goes back, even after a hard challenge (code; `placeAfter` leaves `step` alone on hard).
- Spacing: earlier ways return 3 goes in 10; weakest-first uses the Leitner box; step 5 is an even mix. No old-day revisit beyond that (code).
- Success target: the 8 of 10 line is about 80%, near the 75 to 90% aim, but only checked per day.

### 6. Feedback: 3
- Every wrong nest has a reason in words and often a picture: 71 "seven tens and one" with the arrow cards pulled apart; 20 shows two tens; "Nearly! Count the berries one at a time"; "Take away makes it smaller" (seen for 71, 20, 18; code for the rest; `words.ts:21-40`, `Goes.tsx:313-338`).
- Retry: after the first wrong the child gets another free go; after the second, a look-together and "Now you try!" (seen).
- Tone is kind: "Nearly!", no shame, no penalty, answer not said after one wrong tap (seen). "Not yet" language is never used but nothing negative either.
- Praise is generic: "Well done! A flower turned bronze!" and "You are so good at this!", not about effort or strategy (seen; `words.ts`).
- The same wrong-reason is shown for every miss of that kind even when the child has the same slip repeatedly; no change in feedback (code).

### 7. Progress recording: 3
- Server keeps `tui_progress` (days, step, level, streak counters) and `tui_rounds` (the round JSON with every go's fact, way and help level, plus every tap `{pick, ms}` and counts) per child (`supabase/migrations/20261106000100_tui.sql:25-50`). The wrong nest chosen is in `taps`, and the help level in `round.goes[].l`, so misconceptions are recoverable (code).
- Per-fact attempts, correct, avg time, box and last seen go to `gem_keep_facts` under pack `early-facts` through `record_fact_answers` (once per fact per round, first tap only) (code).
- Teacher: a "Tūī" tab in the student's page (step, level, days, last played, three hardest facts) and the class grid line (recent challenges with mistakes, taps and step) (`TeacherTui.tsx:56-82`; code). It does not show which wrong answer or which mistake kind: the wrong answer is saved but never surfaced.
- No stuck alerts specific to Tūī that I could find; who has not played comes from last played (code).

### 8. Engagement: 3
- The maths action (tap the nest that matches the berries) is the game; the tree, flowers and bird are decoration that follow a finished day, not paid per tap (seen). Painted art is warm and fits the topic.
- The reward (flower) comes for finishing, not for being right, so a random tapper gets the same flower (seen in code: `finishChallenge`, `progress.ts:60`).
- Choice is thin: no choice of friend or path, one fixed daily challenge, play again for fun. Growth is visible (flowers, nests) but is days, not skill (`progress.ts:4`).
- Goal is clear to a teacher ("ten and some more", arrow cards) and the child does think (count, match). Social features: none, so no harm.
- Berries pop in one at a time at level 5 and the same 3.4 s right-answer animation plays after every go, so a fast child waits (`RIGHT_MS`, `Goes.tsx:33`; seen).

## The 25-item checklist

| # | Item | Answer | Evidence |
|---|---|---|---|
| 1 | Maths action is the game | yes | count and match berries to number (seen) |
| 2 | Cannot win by guessing | no | 4 nests, elimination after wrong taps works, round finishable by tapping all (seen) |
| 3 | Representation right | yes | ten-frames, arrow cards, empty spaces, ten flies off (seen) |
| 4 | Pre-reader can start alone | partly | voice and hand on go 1; level 0/1 sums are read only by sight |
| 5 | One question, one action | partly | clean screen; why-panel crowds nests, faint picture over tree art |
| 6 | Big targets, no timer, short | yes | 132 x 94 nests, no timer, ten goes |
| 7 | Model available | yes | frames/kete levels 5 to 2, Peek at 1 |
| 8 | Help automatic | yes | wrong tap steps the picture; look-together after two |
| 9 | Worked example for new types | partly | guided first go (way 0) only; new ways have none |
| 10 | Support reduced stepwise | yes | six levels |
| 11 | Support returns on failing | yes | hard challenge +1; wrong tap +1 inside a go |
| 12 | Expert not slowed | partly | fast start only at first play; otherwise ~10 good days to level 0 |
| 13 | Sensible order | yes | one way, reversed, missing, take away, mixed |
| 14 | Adapts per child, 75 to 90% | partly | streak based per day; one level for all skills |
| 15 | Old skills return, mixed | partly | 3 of 10 earlier ways; weakest facts first; no cross-day spacing |
| 16 | Move-up needs mastery | partly | two 8-of-10 days; never goes back |
| 17 | See what went wrong, same model | yes | arrow cards, frames, lit ten (seen) |
| 18 | Another go with help | yes | greyed nest, then look-together and redo (seen) |
| 19 | Praise effort, "not yet" | partly | kind but generic "Well done" |
| 20 | Server saves per skill | yes | rounds, taps, `gem_keep_facts` |
| 21 | Wrong answer saved | yes | in `tui_rounds.taps`; not shown to teacher |
| 22 | Teacher sees stuck/not played | partly | step/level and hardest facts per pupil; no stuck alert |
| 23 | Rewards decorate success | partly | flower for finishing, even with random taps |
| 24 | Choices and visible growth | partly | flowers/nests, no choices |
| 25 | Clear goal, active thinking | yes | "10 and 4 is 14" talk-about-able |

## Problems found

Ranked by harm to learning.

1. **The round can be finished with no maths, and the flower is the same.** Steps: new pupil, Play, tap every nest in turn on each go. After 71 and 20 (two wrong) the look-together plays the answer; "Now you try!" then shows four nests again; I tapped 71, 20, 18 and only then the answer was left. Cost: the go counts wrong, so the day counts as "hard" if this happens often and the help goes up, but the flower still turns. A rapid tapper gets the flower and a daily "good" streak is unlikely, so the fix is mainly the reward and the redo.
2. **"Now you try!" after the look-together is copy-the-answer.** Steps: tap two wrong nests on any go; the panel says the answer ("17! 10 and 7 is 17"), then the same four nests return (reordered). The child taps what they just heard. It is not scored as right, but learning is shallow.
3. **Third-wrong "fade to two nests" is built but never used.** `pictureFor(...).nests` exists in `shared/tui/round.ts` and is tested, but `Goes.tsx` does not read it, so elimination continues to five wrong taps.
4. **No worked example when a new way of asking begins.** Steps: preview tool, Step 3, Play. "10 + ? = 12" appears with only the empty-spaces picture and the sum; the voice reads it, but nothing shows the first time how to read "missing". The same at Step 4.
5. **Fading is one number for the whole game and slow.** In 6 days of perfect play the level went 5 to 4 (stored `level: 4, goodInRow: 1`). A child who knows teens stays on every-berry help for days; and one hard day at a new way pushes help up for the old ways too.
6. **Levels 1 and 0 rely on reading the sum.** Level 0 voice says only "How many?" (`shortLine`); a pre-reader who has faded that far no longer hears the numbers except with "Hear it again" (which reads the sum, `voiceLines.ts` comment). Might cause a drop in the data for non-readers.
7. **Level 2 picture is faint over the painted tree.** Steps: Step 4, level 2, Play on a "17 − 10" go: the little leftover ten-frame sits on yellow tree berries and is hard to see (screenshot).
8. **Pointing hand on the first go ends on a wrong nest.** The hover hand rests on the last nest, which was 21 on my first go.
9. **Fixed 3.4 s wait after every right answer**, with no skip, slows quick children (`RIGHT_MS`).
10. **Step never goes back** after a bad run (`placeAfter`), and the teacher view hides the actual wrong answers.

## Saved per child on the server

- `public.tui_progress` (one row per pupil): `days_done`, `last_flower_day`, `step`, `level`, `good_in_row`, `good_at_step`, `version`, `updated_at`.
- `public.tui_rounds` (one row per challenge): `seed`, `round` jsonb (step, level, help setting, each go's key, way `v` and shown help level `l`), `open`, `taps` jsonb (every tap: the nest picked and ms), `mistakes`, `first_right`, `started_at`, `finished_at`.
- `public.gem_keep_facts` (pack `early-facts`, keys `tenand:n`, `tenless:n`): attempts, correct, avg_ms, box, last_seen, quick_days. First tap per fact per round only; not the wrong choice.
- `app_settings.tui_enabled`, `tui_help` per class.
- Wrong choice and help level are saved (taps and round JSON) but only together; no column and no teacher view reads them. The help the child got inside a go (greyed nests, look-together) is not saved except as extra taps.
- Teacher sees today: the student page line ("At Tūī's tree. Step 3, help level 2, last played, hardest facts", `TeacherTui.tsx`), the class Games row (players, Golden Nests), and the foundational class grid line (recent finished challenges with mistakes, taps, step; `20261107000100_foundational_teacher_views.sql:54`). No Today alert and no list of who has not played, apart from the grid's last day.

Read-only SQL James could run (not run by me):

```sql
-- 1. Where children are: step and help level
select step, level, count(*) from public.tui_progress group by 1,2 order by 1,2;

-- 2. Mistakes per finished challenge by step, last 14 days
select (round->>'step')::int as step, count(*) as rounds,
       round(avg(mistakes),1) as avg_mistakes, round(avg(first_right),1) as avg_first_right
from public.tui_rounds
where open = false and finished_at > now() - interval '14 days'
group by 1 order by 1;

-- 3. Hardest facts across the school
select fact_key, sum(attempts) as tries, round(100.0*sum(correct)/nullif(sum(attempts),0)) as pct_right
from public.gem_keep_facts
where pack = 'early-facts' and (fact_key like 'tenand:%' or fact_key like 'tenless:%')
group by 1 order by pct_right asc, tries desc limit 10;

-- 4. Stuck: step not moved and low first_right on the last three challenges
select r.player, p.step, p.level, array_agg(r.first_right order by r.finished_at desc) as last_scores
from public.tui_rounds r join public.tui_progress p on p.player = r.player
where r.open = false
group by 1,2,3 having count(*) >= 3 and max(r.first_right) filter (where true) <= 5;
```

## Strengths

- Strong, correct representation: two ten-frames, empty spaces for "how many more", arrow cards that slide "10 and 4" into 14, directly addressing the 41-for-14 reversal.
- Wrong nests are built from real misconceptions and each gets a reason line and picture; four nests at every level.
- Automatic, graded help inside a go (one level up, then the demonstration), no hint hunting.
- Clear daily structure, no timers, large nests, painted art, voice on by default, hear-again.
- Good server design: the server replays taps and keeps them, so raw data is rich.

## Gaps

- Guessing and elimination are not blocked; the flower is for finishing.
- "Now you try!" is copyable and the planned two-nest fade is not wired in.
- No worked example for new ways; one fading dial for all skills; very slow to fade.
- Praise is generic; teacher view hides wrong answers and mistake kinds; no stuck alert.
- Low levels depend on reading.

## Candidate improvements

1. **Wire in the two-nest fade after the third wrong tap.** Problem: elimination to the answer. Change: use `pictureFor(...).nests` in the nest list in `Goes.tsx`; tests exist. Files: `src/games/tui/Goes.tsx`. Effort S. Impact: medium (fewer maths-free wins).
2. **Make "Now you try!" a different go.** Problem: copying. Change: after the look-together, ask a new number of the same way (fact and way kept), or hide the answer line from the panel's text and play the arrow cards only. Files: `Goes.tsx`, `round.ts`/`play.ts` for the replay. Effort M. Impact: high.
3. **Flower for effort that counts.** Problem: random tapping gets the same reward. Change: keep the flower, but add a small "quick-tap" detector (three taps under about 700 ms in a go) that shows "Look at the berries first" and asks the child to wait or hear the question again. Files: `Goes.tsx`, `words.ts`, voice clips. Effort S to M. Impact: medium.
4. **Worked example when a new way first appears.** Change: the first time a child meets way 2 or 3 (use `tui_rounds` history or a field on `tui_progress`), play one demonstrated go with the hand and voice. Files: `Goes.tsx`, `shared/tui/server.ts`, migration for a seen-ways field, voice clips. Effort M. Impact: high.
5. **Fade help per way, not per child.** Change: keep the level per way (0 to 3) so a new way starts at frames while old ways keep fading; speed up (one good challenge in a row for a child above 9 of 10). Files: `round.ts`, `server.ts`, `tui_progress` columns, tests. Effort L. Impact: high.
6. **Voice for numbers at levels 1 and 0.** Change: `shortLine` should read the sum, with Hear-it-again unchanged. Files: `voiceLines.ts`, voice clips. Effort S. Impact: medium for non-readers.
7. **Show teachers the wrong answers.** Change: add "most common wrong choices" (mistake kind, from `taps` and the round) to the student page and the class grid; a "stuck at step" flag. Files: new migration function, `TeacherTui.tsx`, `src/data/tui.ts`. Effort M. Impact: high for teachers.
8. **Praise the strategy and shorten the wait.** Change: "You counted the ten and the loose ones" style lines for good rounds and a tap-to-skip on the right-answer animation. Files: `words.ts`, `Goes.tsx`, voice clips. Effort S. Impact: low to medium.


## Learning-design rules

Read after the scores were written. Checked against the code and the play, not the plan.

| # | Rule | Verdict | Evidence |
|---|---|---|---|
| 1 | The maths is the move | partly | Counting and matching berries is the action (seen). But the rule's "at most two wrong taps, then show the answer" is not true: the look-together shows the answer and then four free nests return, so a child could tap 5 times in one go; the planned two-nest fade is not wired in (`Goes.tsx` never reads `pic.nests`). Four choices have good tells: at most two teens, reversal, 20 (`round.ts` `wrongNests`). |
| 2 | One thing at a time, voice first | partly | Voice on by default, Hear again, 132 x 94 nests, no timer, answer clock restarts after the voice (`Goes.tsx:105-107`). But the goal number is not written at level 5, level 0 voice drops the numbers, and the 3.4 s wait after every right answer is still there (`RIGHT_MS`, `Goes.tsx:33`). |
| 3 | Concrete, then picture, then number | met | Six-level ladder: every berry, frames with sum, kete, faint kete, sum with Peek, sum only; arrow cards after every right answer (seen). |
| 4 | Help arrives by itself | partly | The picture rises one level on a wrong tap and the look-together plays itself (seen). No demonstration the first time a new way appears (only the guided go 1); "3 goes in a row wrong gives full help for the round" is not in the code. |
| 5 | Help follows the child | partly | Two good challenges lower the level, a hard one raises it, teacher can set Fades/Always/Off, strong first-time starters begin at step 3 (`round.ts:121-142`). One dial for the whole game, not per fact; the fade is slow (6 perfect days moved level 5 to 4, seen). |
| 6 | Progression | partly | Research-ordered steps; weakest first; 3 of 10 revisit earlier ways; step 5 mixed; a "what's next" card to Weka when 13 of 18 facts are in box 2+ (`topSecure`). Step passes on two 8-of-10 days and never goes back; same numbers 1 to 9 from day one; a 30-day tree is a long goal but the ladder is only five steps. |
| 7 | Mistakes teach | partly | Wrong nests built from misconceptions with kinds, why-line and picture on the game's own picture, look-together, "Now you try" (seen; this game is a best example). Not met: the "Now you try" redo follows the answer being shown, praise is generic ("Well done!"), the redo's kind is not stored. |
| 8 | Fair timing | met | No visible timer; clock starts after the voice; `JUNIOR_QUICK_MS` passed to `recordMathsAnswers` (`supabase/functions/tui/entry.ts:74`). |
| 9 | Record evidence | partly | Taps with the wrong pick, the help level per go and per-fact records are saved; hardest facts on the pupil page and the class grid line exist (R7 grid). The kind of wrong choice is derivable but not saved or shown; no Today alert for Tūī. |
| 10 | Fun comes from the maths | partly | Berries and arrow cards are satisfying, a flower per day, no ranks; but the flower comes for finishing even with random taps, and there is little choice. |

### Shared kit (`docs/plans/GAME-KIT-PLAN.md`) use

Uses (checked in imports):
- `shared/kit/mistakes.ts`: `NEW_GO`, `stepGo` (the two-tap flow) and `tagWrongs` for the wrong nests (`Goes.tsx:25`, `round.ts`).
- `src/kit/ShowWhy.tsx`: `ShowWhy`, `LookTogether`, `NowYouTry`, `useLookTogether` (`Goes.tsx:27`).
- `src/kit/WhatsNext.tsx` for the finish card (`TuiGame.tsx:15`).
- `shared/juniorQuick.ts` for the quick time; the teacher grid view includes `tui` (migration `20261107000100`).

Could use but does not:
- `src/kit/TenFrame.tsx`: the game has its own `TenFrame` in `src/games/tui/art.tsx`.
- `src/kit/HearAgain.tsx` and `PointingHand.tsx`, `useGuidedFirstGo`: the game has its own "Hear it again" button and hand (`Goes.tsx:202`, `GUIDE_AT`).
- `src/kit/FirstTimeTip.tsx`: the right fit for a worked example on a new way of asking.
- `shared/kit/help.ts` (`placeAfter`, `fadeAfter`, `helpForFact`): the game has its own `placeAfter` in `round.ts`; the kit's per-fact `helpForFact` would give per-fact fading.
- `shared/kit/replay.ts` (`replayTaps`): game has its own `replay` in `play.ts`.
- `shared/kit/dayArc.ts`: its own `progress.ts` flower arc.
