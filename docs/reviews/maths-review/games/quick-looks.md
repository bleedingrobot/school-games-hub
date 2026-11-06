# Quick looks (subitising): evaluation

Evaluated 7 Nov 2026. Code read: `shared/subitising/*` (config, engine, trials, placement, patterns, keys, saved), `src/subitising/*` (SubitisingApp, FlashRunner, Garden, voiceLines, saving), `shared/training/save.ts`, `src/data/training.ts`, `supabase/functions/training/index.ts`, migrations `20261018002200_training.sql`, `20261022000300_training_first.sql`, `20261104000300_training_keep_quick_settings.sql`. Played in the preview on port 5307 (the browser worked; the flash itself is too quick to catch with a tool, so I checked the pictures, buttons and feedback by script and screenshot). No game code was changed.

Quick looks is not a game folder. It is a Training activity (`/training?quick=1`) shown on the dashboard card at `src/pages/Dashboard.tsx:244-258`.

## How it works

A child does a 6-picture "starting check", which places them on one of 7 stages. Then each round is 12 pictures. For each one: "Get ready" (0.7 s), a picture flashes (0.6 to 1.2 s), it disappears, the five answer buttons stay locked for 1 s, then the child taps how many dots they saw. After the tap, the picture comes back with the groups marked ("It was 7: 5 and 2") and a friendly ladybird. Two wrong in a row, or thinking for over 4 s, makes the next picture stay on screen with "Can you see smaller groups?". Each stage is a plant in a garden that grows as the child gets answers right. No clocks, scores or red colours. A "Keep the picture on the screen" switch removes flashing completely.

## The maths

Stages (`shared/subitising/config.ts:51-59`), in this order:

| # | Name | Pictures | Numbers | Flash (start / good) |
|---|---|---|---|---|
| 1 | A few dots | line, cluster, angled | 1 to 3 | 1200 / 800 ms |
| 2 | Ten-frame to 5 | ten-frame, top row | 1 to 5 | 1200 / 800 |
| 3 | Dice and dots | dice, turned dice, dice-like dots | 4 to 5 | 1000 / 1000 |
| 4 | Five-frames | five-frame, 5+more in 2 colours, two colour groups | 3 to 7 | 1000 / 600 |
| 5 | Ten-frame to 10 | ten-frame by rows, by pairs | 5 to 10 | 1000 / 800 |
| 6 | Empty squares | five-frame, ten-frame, pair ten-frame (count the EMPTY squares) | answer 1 to 7 | 1000 / 800 |
| 7 | Mix it up | scattered ten-frame, dots or empty squares 50/50 | 5 to 10 | 1000 / 800 |

- Moving on (`shared/subitising/engine.ts:46-54, 70-89`): a stage is finished when 85% of the last 8 counted answers are right (so 7 of 8) AND each picture type in the stage has been seen at least twice in the last 24 answers. A finished stage stays finished (`finishedBefore`, `saved.ts:19`).
- Placement (`placement.ts:34-65`): a binary search over the 7 stages, 2 pictures per stage tested, pass = both right, always 3 tests (6 pictures), starting at stage 4. Check answers are not kept as practice.
- Choosing the next picture (`trials.ts:50-62, 66-95`): current stage, 20% review from finished stages (`reviewShare`), and the least-seen picture type first so none is skipped. Step back (`engine.ts:81-86`): under 60% right in the last 5 answers gives smaller numbers and the first picture type of the stage.
- Flash time (`engine.ts:100-105`): shorter ("good") once the stage is at mastery accuracy. Stage 3 never changes (1000/1000).
- Answer buttons (`trials.ts:30-44`): always 5 consecutive numbers around the answer, so there are always 4 wrong choices.

## Scores

**1. Maths fidelity: 3**
- Real subitising: the picture goes away before the child can answer, answer buttons stay locked for 1 s (`config.ts:84`, `FlashRunner.tsx:84-91`), so a child cannot count slowly or tap early. Perceptual to conceptual order (dots in a line, then dice and five-frames, then ten-frames) fits the research.
- Pictures show groups ("5 and 2") on feedback, and the "make 5 / make 10" gap stage (6 and 7) is the right bridge to bonds (`trials.ts:100-108`).
- Guessing: five buttons means 20% per picture. Guessing 7 of 8 is very unlikely, so mastery cannot be gamed. But in the check, only 2 pictures per stage decide placement, and a lucky guess at stage 4 gives a harder start.
- Weakness: stage 1 (1 to 3 dots) shows for 1.2 s and the child barely needs subitising; stage 3 has only two numbers (4, 5), there are only two answers (4 and 5) across three picture types, so it risks pattern memory of "the dice" rather than number. The set stops at 10 (no 6-to-10 dice or 5-and-5 pairs beyond the ten-frame), which matches the document.
- Stage 6 "empty squares" is ten-frame complement, not subitising. It is good maths but is a different skill inside the same activity.

**2. Clarity: 3**
- One question per screen, one big prompt, buttons big. Read-aloud button with Kokoro clips for every line (`voiceLines.ts`), answer never spoken before the child answers (`FlashRunner.tsx:158`).
- Reading is off by default, and the home screen has two switch labels that a 5-year-old cannot read. A pre-reader sees a blank frame with disabled numbers during "Get ready", before the picture; I saw the five buttons already on screen and greyed out, which could invite early tapping (they are locked, so it is only confusing).
- No demo or example before the first picture; the very first thing a new child sees is "Get ready: how many dots?" then a frame that goes blank in a second. Starting check opens on stage 4 (hardest of the first test), which is a bit harsh for a 5-year-old with no practice picture.

**3. Support and structure: 3**
- Good help: after two wrong or a long think, the picture stays up with coloured groups and loops (`FlashRunner.tsx:158-172`, `PictureSvg.tsx`). One "Peek again" (0.5 s) after a help picture. Guided "no flashing" mode. Feedback re-shows the picture with the split.
- No "see it as a ten-frame" or number-bond model between steps. A single dot in help mode still says "Can you see smaller groups?" (I saw this on a 1-dot picture, screenshot taken).
- Help in a gap picture (stage 6) replaces "How many empty squares?" with "smaller groups?" which is the wrong clue for that question (`FlashRunner.tsx:237`).

**4. Fading: 3**
- Real fading is built in: flash time shortens when the stage is going well (`engine.ts:100-105`), help only appears after a struggle and then goes away, step-back makes numbers smaller, mastered stages come back as 20% review.
- But fading of support is one-way per picture and coarse: guided mode is a manual child/teacher switch, not automatic. The flash time is fixed per stage (no adaption to the child's own speed beyond the one threshold). Helped answers do not count at all (`engine.ts:61`), which is fair, but means a child who is helped a lot stays in stage with no progress and no signal.

**5. Progression: 3**
- Placed by a short binary-search check and given a clear 7-stage order based on research. Mastery rule needs picture-type coverage as well as accuracy, which is excellent design (`engine.ts:46-54`).
- Gaps: 6 pictures for placement is thin and the child is not told they can be moved. Stage 3 to 4 jump (4 to 5 → 3 to 7 with new colour pairings) is steep. After stage 7 there is nothing more ("More pictures are coming soon", `SubitisingApp.tsx:167`).
- The 8-answer window means a stage can be done in 8 to 10 pictures (under 1 round), so the garden fills fast for a strong child and the practice is quickly done.

**6. Feedback: 3**
- After any answer the picture comes back with the groups: "Let me show you again. It was 7: 5 and 2." and for gaps "3 counters and 2 empty squares make 5" (`voiceLines.ts:21-27`). This shows why, not just right/wrong. That is the best part.
- For a single-group picture (a line of 4, a dice 4) the feedback is only "It was 4." with no split, so a wrong answer there teaches nothing. A gap answer gives the same sentence right or wrong, which is neutral but does not tell the child they were wrong (see below). The child's wrong number is never shown or compared.
- Feedback needs a tap on "Next" every time (slows the round but gives time to look).

**7. Progress recording: 2**
- Every answer is saved to `training_answers` (key like `sub:five-6`, given, correct), a helped answer under `subh:`/`gaph:`, stage/start/finished in `training_students.typing.q`. That is enough to rebuild the stage exactly. Good design.
- But the teacher site never shows it. `teacher_training_student()` exists (`supabase/migrations/20261018002600_clans_schools_and_classes.sql:875`) and returns the answers, but no teacher screen calls it (grep of `src/teacher`: only the Training-before-games switch in `Today.tsx:54-89`). No stuck alert, no stage per pupil. `ms` is always 0 so no reaction time is kept (`saving.ts:15-21`), so a teacher could never see hesitation even in the database.
- Answers stored: only "given"; the picture itself (seed) is not saved per answer in a way a person can look up; the key gives type and number so that is enough.

**8. Engagement: 3**
- The garden (7 painted plants that grow, `Garden.tsx`) and ladybird friend are warm and the "no clock, no red" rule keeps it calm. Maths is the whole point of the activity: there is no game wrapper to distract.
- It is a short, repeated, same-shaped loop: it is nice for a 3 minute use but dull for a long time. The garden reward is the only goal, and a child who is placed high sees a mostly "In flower" garden after the check.
- Tapping "Next" after each picture and the 1 s lock make rounds feel slow, but that is intended.

Total: 23 out of 32.

## Problems found while playing

1. Check started at stage 4 (3 to 7 dots, five-frames), so a new 5-year-old's very first picture is among the harder ones. It then went down to stage 1 after wrong answers. A friendlier first picture would be better.
2. Answer buttons are visible but greyed out during "Get ready" and the picture, and for 1 s after. Pre-readers will try to tap them (nothing happens, no message).
3. Single-dot help picture says "Can you see smaller groups?" (nonsense for 1). Gap help says the same instead of "How many empty squares?" (`FlashRunner.tsx:237`).
4. A correct gap answer and a wrong one get the same sentence ("3 counters and 2 empty squares make 5.") so the child does not clearly hear "yes" or "not quite".
5. When I picked the biggest button each time I was right once (the 7), as expected at 20%. The check is only 2 pictures per stage, so two lucky guesses move a child up a stage (4% chance per test).
6. Single-group pictures (a line of 4, a dice 4) give no split in feedback ("It was 4."), so it teaches nothing about structure.
7. In stage 6, review pictures from stage 5 are asked as flash pictures, but the heading in feedback still reads "How many did you see?" while the stage name is "Empty squares". Slightly confusing mixing; fine but not signposted.
8. Guided mode (no flashing) still counts towards the stage. A child (or a teacher with a switch) can pass every stage with the picture always on screen, which is counting, not subitising (`FlashRunner.tsx:98` thinkingMs 0; `engine.ts` has no guided flag). Saved key looks the same, so a teacher could not tell.

## What is saved and what a teacher sees

- `training_answers`: `player, batch_id, seed, fact_key ('sub:<type>-<n>' | 'gap:<type>-<n>' | 'subh:' | 'gaph:'), given, correct, answer_ms (always 0 here), typing_ms (0), day, answered_at`. Oldest answers per key are trimmed (`keep_per_fact` in the training server function).
- `training_students`: `player, typing jsonb (Quick looks settings under "q": p=placed, s=start stage, f=finished stages, g=guided, v=2), auto_submit, sessions_done`. Note `sessions_done` mixes facts and quick sessions.
- `training_sessions`: `player, kind ('facts'|'quick'), seed, answers, finished_at` (one row per finished 12-picture round, for Training before games).
- Teacher view: only the class switch "Training before games" on the Today page (`Today.tsx:84-92`). Nothing about stages, accuracy or who is stuck. The RPC `teacher_training_student(student)` exists and returns everything, but no page uses it.

Queries to run on the live database (not run):

```sql
-- 1. Where each pupil is: stages finished, start stage, and guided mode (Quick looks only)
select p.display_name, (s.typing->'q'->>'s')::int as start_stage, (s.typing->'q'->>'f')::int as stages_finished,
       (s.typing->'q'->>'g')::int as guided, s.updated_at
from training_students s join profiles p on p.id = s.player
where s.typing ? 'q'
order by stages_finished desc, p.display_name;

-- 2. Accuracy by stage-type, last 30 days, counted (not helped) answers only
select split_part(fact_key, '-', 1) as picture, count(*) as answers,
       round(100.0 * avg(correct::int)) as pct_right
from training_answers
where fact_key ~ '^(sub|gap):' and answered_at > now() - interval '30 days'
group by 1 order by pct_right;

-- 3. Stuck pupils: lots of helped answers and low accuracy recently
select p.display_name,
       count(*) filter (where a.fact_key ~ '^(sub|gap)h:') as helped,
       count(*) filter (where a.fact_key ~ '^(sub|gap):') as counted,
       round(100.0 * avg(a.correct::int) filter (where a.fact_key ~ '^(sub|gap):')) as pct_right
from training_answers a join profiles p on p.id = a.player
where a.fact_key ~ '^(sub|gap)h?:' and a.answered_at > now() - interval '14 days'
group by p.display_name
having count(*) filter (where a.fact_key ~ '^(sub|gap):') >= 20
order by pct_right nulls first;
```

(Guided-mode answers cannot be told apart from flashed ones in `training_answers`; only the pupil's current setting `q.g` is kept.)

## Strengths

- Real subitising design: picture disappears, answer lock, groups shown after (the research design is followed closely).
- Stage progress rebuilt from the saved answers, so it can never drift; finished stages stay finished.
- Mastery needs every picture type, not just a good score.
- Good help route (groups shown after a struggle, one peek) and automatic step-back.
- Calm: no clock, no red, no speed scoring; garden growth; full recorded read-aloud.
- Large test set (`shared/subitising/subitising.test.ts`, 466 lines).

## Gaps

- Teachers cannot see any of it (no page uses the existing RPC; no alerts).
- Guided mode (picture stays on) counts as full progress and is invisible in the data.
- No reaction time or hesitation stored (ms = 0).
- Check is short (6 pictures) and starts at stage 4.
- Single-group feedback teaches nothing; gap feedback hides right/wrong.
- Nothing after stage 7; no link on to bonds games (Weka, Beanstalk).
- No demo/example before the very first picture.

## Candidate improvements

1. **Teacher view of Quick looks.** Problem: nobody can see who is stuck. Change: a "Quick looks" panel on the teacher student page and a Today alert for pupils with 20+ answers under 60% or 3+ sessions at the same stage; call the existing `teacher_training_student` and use `progressFrom`. Files: `src/teacher/StudentPage.tsx`, `src/teacher/alerts.ts`, a small new component, `src/data/training.ts`. Effort M. Impact: high.
2. **Do not count guided-mode answers as mastery (or mark them).** Problem: can pass by counting. Change: save guided answers under a helped-style key (or a `subg:` key) so they don't count toward stages; show the setting in teacher view. Files: `saving.ts`, `keys.ts`, `engine.ts`, `FlashRunner.tsx`, server copy in `supabase/functions/training`. Effort M. Impact: medium-high.
3. **Better feedback on a wrong answer.** Problem: "It was 4." teaches nothing; gaps hide right/wrong. Change: for single-group pictures show a split (4 as 2 and 2, or the 5-frame minus one); for gaps say "Not quite" vs "Yes"; say what the child tapped ("You tapped 6; it was 5"). Files: `voiceLines.ts` (and new clips), `FlashRunner.tsx`, `patterns.ts`. Effort M (new voice clips). Impact: medium.
4. **Gentler start and a demo.** Problem: first check picture is stage 4 with no example. Change: start the check at stage 2 (and make it 8 pictures), with one slow practice picture that stays on screen first ("This is how it works"). Files: `placement.ts`, `FlashRunner.tsx`, `config.ts`. Effort S-M. Impact: medium.
5. **Fix help prompts.** Problem: wrong help wording for 1 dot and for gap pictures. Change: help prompt uses "How many empty squares?" for gaps and "Look carefully" for 1 dot. Files: `FlashRunner.tsx:237`, `voiceLines.ts`. Effort S. Impact: low-medium.
6. **Save thinking time.** Problem: ms is always 0. Change: send `thinkingMs` (rounded) as `ms` so a teacher could see hesitation. Files: `saving.ts`, check in `shared/training/save.ts` (typing check) and the server copy. Effort S. Impact: medium (needed by #1).
7. **Hide or explain the greyed buttons during "Get ready"/flash.** Change: hide answer buttons until they unlock, or show a small "wait" cue. Files: `FlashRunner.tsx`, `subitising.css`. Effort S. Impact: low-medium.
8. **Link on to the bonds games.** Problem: stage 6 and 7 lead nowhere. Change: when stage 6 is finished, suggest Weka's Stepping Stones and Beanstalk from the summary; or add more stages (6 to 10 with two colours, 10 to 20 double ten-frame). Files: `SubitisingApp.tsx`, `config.ts`, `patterns.ts`. Effort M-L. Impact: medium.
