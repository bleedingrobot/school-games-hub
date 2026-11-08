# Pipi's Hidden Shells: second review (blind)

Played in the preview on port 5304 (browser, desktop 1024x768, about 40 goes over levels 1, 2 and 3, bronze, silver and gold days, help on and off). Not tested at phone width. "Seen" means seen in play; "code" means read in code only. Faint help was never seen on screen (it needs a child's records to reach that rung), so that part is code only.

## How it works

Each day a child plays ten goes. A go shows a number on a sign ("7 altogether") and a row of pipi on the sand. A wave washes in, some pipi dig down, and the child taps one of four number shells: "How many are hiding?" A right shell lifts the sand and the hiding pipi pop up and wave. A wrong shell greys out and a short line and picture say why. The second wrong shell starts "Let's look together" (the sand lifts, "7 = 4 + 3" fills in) and then the same go comes back with the shells shuffled ("Now you try!"). Some goes (silver and gold days) ask "how many altogether?" from the two parts, and gold days have "two tides" (the hiding ones come up, the others dig in, how many are hiding now?). The first finish each NZ day turns one of ten magic shells bronze, silver then gold; 30 days gives a Golden Pearl and a new friend's beach. Bella's recorded voice reads each question.

## The maths

- **Idea:** part-whole within 10 (7 is 4 and 3). Facts are keys like `part7:4` (7 altogether, 4 showing). Keys come from `shared/pipi/round.ts:55-60` (every split 0..whole of every whole at the level).
- **Levels** (`round.ts:29-33`): 1 = wholes 3 to 5 (15 splits), 2 = wholes 6 and 7 (15 splits), 3 = wholes 8 to 10 (30 splits).
- **Next level** (`round.ts:69-73`): the first level, from the furthest reached, where fewer than 70% of its splits are in Leitner box 2 or higher (`STEP_SECURE_SHARE`, `shared/maths/selector.ts:60`). Box 2 means right and under 10 seconds (`shared/juniorQuick.ts:6`) on two answers; a wrong answer drops the fact to box 1. The level never drops (`server.ts:157-158`). Level 3 is the end: the child stays there forever.
- **Picking goes** (`round.ts:155-186`): ten distinct splits of the level, weakest box first, at most one edge split ("0 hiding" or "all hiding", always one at level 1) and the very first challenge starts with the guided go `part3:2`.
- **Question kinds** (`round.ts:35`, `211-241`): "hiding" on every day. "Altogether" (2 goes) from silver days. "Two tides" (2 goes) on gold days only. Which colour it is comes from the count of finished days (`progress.ts:47-61`), so kinds are tied to the calendar, not to the child's skill.
- **Wrong shells** (`round.ts:196-208`): one-off, the number showing, the whole, whole plus showing, with at most two shells sharing the answer's odd/even.
- **Help per go** (`round.ts:84-89`): full until box 2 and right-and-quick on 2 different days, faint until box 4 and 6 right, then none. Stored with the round (`h`).

## Scores (1 to 4)

**1. Maths fidelity: 3**
- Representation is correct and well matched: a five-frame or ten-frame with dashed outlines, the whole on a sign, parts coloured in the look-together sum (seen; `Goes.tsx:230-262`). Two tides is a real "3 and 4 is 4 and 3" idea (seen on gold).
- But on full help the answer can be found by counting the dashed outlines, with no part-whole thinking at all (seen: 5-frame, 2 pipi, 1 dashed outline, 2 empty spots). The maths only becomes necessary when help fades (seen with help off: "10 altogether", just 2 pipi in a row, no frame).
- Guessing works: four shells, wrong taps cost nothing, so every go can be finished by tapping shells in turn (at most 6 taps: 2 free wrongs, look together, then a redo with all four shells) and no maths (see Problems 1). Some wrong shells are silly (18 for a whole of 9, 11 for a whole of 7, 10 for a whole of 5; seen), so a child can rule them out by size alone.

**2. Clarity: 3**
- Pre-readers can start alone: Play button, voice reads "7 pipi. How many are hiding?", big shells (about 100 px wide, seen), no timer, a guided first go with a pointing hand on the right shell (seen), a ten-dot progress bar (seen).
- No way to hear the question again: the voice toggle only switches it on or off (`PipiGame.tsx:62-143`; the kit's `HearAgain` is not used). A child who missed it must read "How many are hiding?" or guess (code and seen).
- Slightly busy: sign, frame, friend, tree, rocks and shells at once; the why-panel overlaps the sign area (seen). The first-go hand points at a frame spot and at a shell (seen), which is a little mixed.

**3. Support and structure: 3**
- Model and help are automatic: the frame and outlines appear with no button (seen), the why-line and picture appear after the first wrong shell, "Let's look together" after the second (seen, `Goes.tsx:206-222`).
- Only the very first go has a demonstration. The new kinds "altogether" and "two tides" appear with no worked example or first-time tip; only a spoken line (seen: "Splash! Now how many are hiding?" with nothing explaining the swap). `FirstTimeTip` is not used.

**4. Fading: 4 (borderline, high confidence on the design, faint rung code only)**
- Help is per split, from each child's own record: full, faint, none (`round.ts:84-89`, code). A wrong answer drops the split to box 1 so full help returns for that split (code, `leitner.ts:56`). Three first-tap wrongs in a row bring full help back for the rest of the round (`Goes.tsx:207`, `kit/help.ts:17`, code). A new level has no records so it starts full (seen: level 2 ten-frame full on day 12).
- Help-off setting gives a clean "none" view: pipi in a row, no frame, no outline (seen).
- Weakness: a child who already knows a split still sees full help for the first two days on it, and a new level always starts at full (expertise reversal only partly met).

**5. Progression: 3**
- Sensible order: wholes 3 to 5, then 6 and 7, then 8 to 10 (code). Adapts: weakest splits first, level moves at 70% of splits secure (code).
- No mixing or return to old levels: a level-2 round contains only wholes 6 and 7 (seen), and level 3 only 8 to 10. Once level 3 is reached nothing from 3 to 7 returns, except by the weak-first rule within the level. No spacing across days is required; a child can move through splits on one day via "Play again" because answers are recorded every finish (code, `server.ts:165`).
- The kinds (altogether, two tides) follow the calendar, not the child (code).

**6. Feedback: 3**
- Each first wrong shell gets a specific reason and a picture matching the mistake kind (the number showing, the whole, "can't be more than we started with", "the whole stays 7"), e.g. "Look: 1 hiding." with two dots (seen; `words.ts:56-75`). The second wrong starts "Let's look together" with the sum filling in, then "Now you try!" with shuffled shells (seen). Wrong shells grey out (seen). Tone is kind; no timer, no penalty.
- The look-together shows the answer ("3 is 2 and 1. So 1 is hiding."), so the redo is partly copying (seen). Praise is "Yes! 3!", "Well done!", "You are so good at this!" (`words.ts:36-39`): there is no praise about strategy or effort, and the last one is ability praise.

**7. Progress recording: 3**
- Per split: attempts, correct, average ms, box, quick days, last seen in `gem_keep_facts` via `record_fact_answers` (code; migration 20261017001200). Per round: seed, level, colour, the ten goes with kind and help level `h`, every tap as `{pick, ms}` (so the wrong shell chosen is saved), mistakes, started and finished times in `pipi_rounds` (code; migration 20261104001400).
- Teacher view: the Foundational grid, "Needs you" alerts (same level for 5 days, guessing, low accuracy) and "Hardest right now" use per-split records and wrong-tap counts (`src/teacher/foundational/alerts.ts`, code). But the actual wrong shell chosen (the misconception) is never shown to a teacher, and the pupil page shows only a summary line (days, level, last played; `TeacherPipi.tsx:42-72`).

**8. Engagement: 3**
- Fun comes mostly from the action: wave, dig, pop-up and wave; painted clay beach and friends look warm and inviting (seen). One shell a day, a Golden Pearl in 30 days and a new friend's beach give visible growth (code and home screen seen).
- Real choices are few: no choice of beach, friend or task; the reward is the calendar, not the maths. Nothing social. A clear goal for a teacher ("how many are hiding, how do you know?") is there.

## The 25-item checklist

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Maths action is the game | yes | Tapping the number of hidden pipi is the whole game |
| 2 | Cannot win by guessing or tapping everything | no | Free wrong taps, 4 shells, 6 taps max (seen: 4 taps) |
| 3 | Representation right | yes | Five- and ten-frame, whole sign, coloured sum (seen) |
| 4 | Pre-reader can start alone, voice replayable | partly | Voice and guided go yes; no replay of the question button |
| 5 | One question, no split attention | partly | One question; busy beach, why-panel overlaps (seen) |
| 6 | Big targets, no timer, short | yes | About 100 px shells, no timer, ten goes (seen) |
| 7 | Model available for new skill | yes | Frame and outlines automatic (seen) |
| 8 | Help automatic after mistakes | yes | Why-line, look-together (seen) |
| 9 | Worked example for new type | partly | Guided first go only; altogether and two tides have none |
| 10 | Support fades stepwise | yes | Full, faint, none per split (code; none seen) |
| 11 | Support returns on failure | yes | Wrong drops box; 3 wrongs boost (code) |
| 12 | Expert not slowed by help | partly | Full help for first 2 days on each split even if known |
| 13 | Research order of difficulty | yes | 3-5, 6-7, 8-10; edges rarer |
| 14 | Adapts toward 75 to 90% | partly | Weakest first and 70% level rule; no target success rate |
| 15 | Spacing and mixing | no | Only the current level's wholes; kinds follow the calendar |
| 16 | Mastery before move-up | yes | 70% of splits in box 2 (two quick rights each) |
| 17 | Sees what went wrong with same model | yes | Picture per mistake kind in same frame (seen) |
| 18 | Another go with help | yes | Now you try with shuffled shells (seen) |
| 19 | Effort praise, no shaming | partly | Kind, but "so good at this"; no strategy praise |
| 20 | Server saves per child per skill | yes | gem_keep_facts and pipi_rounds (code) |
| 21 | Wrong answer chosen saved | partly | In taps json, never shown to a teacher |
| 22 | Teacher sees stuck and inactive | partly | Grid flags and alerts yes; pupil page thin, no wrong shells |
| 23 | Fun from the maths action | partly | Dig and pop are decoration around the tap; shells are calendar rewards |
| 24 | Choices, growth, kind social | partly | Visible growth; no choices; nothing social |
| 25 | Clear goal, active thinking | partly | Clear goal; on full help a child counts outlines rather than thinks |

## Problems found (most harmful first)

1. **Tap everything finishes a round with no maths.** Steps: Play, on any go tap shells in order. A go with answer 2 and shells 3, 6, 1, 2 took four taps in about 10 s (seen): 3 wrong, 6 wrong, look together, shells reshuffle, 1 wrong, 2 right. Nothing stops this and the child moves on. Cost: that go is recorded wrong at the first tap, the split drops to box 1, full help returns. So guessing is recorded as failure (good), but a lucky first tap (25%) is recorded as a right, quick answer and moves the split up (`play.ts:42-44`, `leitner.ts:56-63`). A pupil who guesses fast can therefore pass a level.
2. **On full help, the answer is found by counting dashed outlines.** Steps: new pupil, first challenge, "5 altogether", 2 pipi showing, 3 dashed outlines. No part-whole idea is needed. The maths only has to be done once help fades, which takes two quick-right days per split, and every new level starts at full again (seen at level 2 on day 12).
3. **Mastery can be reached in one day, and old levels never return.** Records are saved for every finished round including "Play again" (`server.ts:165`), so four rounds in a day can move a child up a level. Level 2 then contains only wholes 6 and 7 (seen) and level 3 only 8 to 10, so 3 to 5 is never retrieved later.
4. **New question kinds have no demonstration.** "Splash! Now how many are hiding?" (two tides) and "4 and 2 here and popped up. How many altogether?" appear without any example (seen). A child can think the sign's "4 and 2" is the question.
5. **Cannot hear the question again.** The only voice control is on or off. A child who was looking at the sand when the line was read has no replay.
6. **Silly wrong shells.** Whole 9 with 9 showing offered 18, 9, 1 and 0 (seen); whole 5 offered 10; whole 7 offered 11. The "add" slip can sit beyond the whole, so it is eliminated by size alone and the 75% guess chance rises to 33% for a child who just rules out big numbers.
7. **Teacher cannot see which wrong shell a child tapped.** It is saved in `pipi_rounds.taps` but the grid and pupil page show only counts.
8. **Look together hands over the answer.** After two wrong shells the sum is read out, then the same go returns, so the redo is partly copying. It is not scored (good), but it does not test understanding.
9. **Praise is not about effort.** "You are so good at this!" on a level up (`words.ts:39`).

## Saved per child on the server

- `pipi_progress` (one row per pupil): `days_done`, `last_shell_day`, `reached` (1 to 3), `played`, `version`, `updated_at`.
- `pipi_rounds` (one row per challenge, 30 days kept for finished ones): `seed`, `level`, `colour`, `goes` json array of `{key, kind, h}` (help level saved), `taps` json array of `{pick, ms}` (every shell tapped, wrong ones included), `mistakes`, `started_at`, `finished_at`, `open`.
- `gem_keep_facts` (shared maths records): per split key `part7:4`: `attempts`, `correct`, `avg_ms`, `box`, `quick_days`, `last_seen`. Only the first tap of a go is scored (`play.ts:42-44`). The wrong shell and help level are saved in the round, not in the facts.
- **What a teacher sees today:** the Games table (players and pearls), the student page line ("12 of 30 days done on this beach, reached wholes 6 and 7"), the Foundational grid, Today "Needs you" (same level 5+ days, looks like guessing at 10 or more wrong taps in 2 of the last 5 rounds, low accuracy, recent accuracy) and "Hardest right now" (splits with 6+ answers). Not shown: which shell was tapped, or the help level.

Read-only queries (not run):

```sql
-- Level reached, and how many pupils at each
select reached, count(*) as pupils, round(avg(days_done),1) as avg_days
from public.pipi_progress group by reached order by reached;

-- Which splits are hardest: attempts and error rate (pack name not checked; the key prefix is 'part')
select fact_key, sum(attempts) as attempts,
       round(100.0 * (sum(attempts) - sum(correct)) / nullif(sum(attempts),0), 1) as pct_wrong
from public.gem_keep_facts where fact_key like 'part%'
group by fact_key having sum(attempts) >= 6 order by pct_wrong desc limit 15;

-- Stuck or guessing pupils: rounds with 10+ wrong shells in the last two weeks
select p.display_name, r.level, r.mistakes, jsonb_array_length(r.taps) as taps, r.finished_at
from public.pipi_rounds r join public.profiles p on p.id = r.player
where r.finished_at > now() - interval '14 days' and r.mistakes >= 10
order by r.mistakes desc;
```

## Strengths

- Honest, correct part-whole maths with a frame that matches the idea, and the same frame carries the mistake pictures and the look-together sum.
- Help is per split and returns on a mistake; a teacher switch for help.
- Kind, quick feedback with a picture for each kind of mistake; no timer; no penalty.
- Strong data: every tap and its time, per-split Leitner records, help level saved, replayable on the server (the server does the scoring, not the browser).
- Warm painted art that does not hide the maths; spoken lines for every question.

## Gaps

- Tap-everything works and a lucky first tap counts as a right answer.
- Full help is solvable by counting outlines.
- No retrieval of earlier levels, no mixing; kinds follow the calendar.
- No demonstration for the second and third question kinds; no replay of the question.
- Teacher cannot see the actual wrong shells or the help level.

## Candidate improvements

1. **Make a tap-everything round visible and unrewarding.** Problem: a wrong shell is free and a lucky first tap raises the split. Change: after the first wrong shell, hide one more wrong shell (two left); score a first-tap right as "quick" only if it took over 1.5 s; flag 3 or more wrong taps in one go in the round data. Files: `shared/pipi/play.ts`, `Goes.tsx`, `shared/pipi/pipi.test.ts`. Effort S to M. Impact: medium (honest records, less mindless tapping).
2. **Hide the outlines until the child has had a go (full help as a second step).** Problem: counting dashes replaces thinking. Change: on a new split show the frame with pipi but only show the dashed outlines after the first wrong shell or after a short pause, so the first attempt is a real part-whole attempt. Files: `Goes.tsx`, `pipi.css`. Effort M. Impact: high.
3. **Mix older levels back in.** Problem: level 3 forgets 3 to 7. Change: one go in four from lower levels weakest-first (spaced retrieval), and a day gap rule: a level can only move up after at least two different days. Files: `shared/pipi/round.ts`, `server.ts`, tests. Effort M. Impact: high.
4. **Worked example for altogether and two tides.** Problem: no demonstration. Change: first time each kind appears, a short guided go (hand, voice "This time the pipi are here and popped up. Count them all."), like the first go. Files: `Goes.tsx`, `words.ts`, `shared/pipi/progress.ts` or round state, voice clips. Effort M. Impact: medium.
5. **Replay button for the question.** Problem: no way to hear the question again. Change: a speaker button using the kit's `HearAgain`. Files: `Goes.tsx`, `pipi.css`. Effort S. Impact: medium (pre-readers).
6. **Better wrong shells.** Problem: 18 for whole 9, 10 for whole 5. Change: never offer a shell above the whole for "hiding"; use the slips only when in range and fill with one-off numbers. Files: `shared/pipi/round.ts`, `pipi.test.ts`. Effort S. Impact: low to medium (guessing odds).
7. **Show wrong shells and help level to the teacher.** Problem: the misconception is saved but never shown. Change: on the pupil page, a short table of the last 10 rounds with the splits missed and the shell tapped (for example "7 = 4 + ?: tapped 4 (the number showing)") from `pipi_rounds`. Files: new SQL function, `src/pages/TeacherPipi.tsx`, `src/data/pipi.ts`. Effort M. Impact: medium (teacher can say "how did you know?").
8. **Strategy praise.** Problem: "You are so good at this!". Change: lines like "You counted the pipi that are hiding. Nice thinking!" and "That was tricky and you kept trying." with clips. Files: `words.ts`, voice clips. Effort S. Impact: low to medium.

## Learning-design rules

Read after the scores were written. Checked against the code, not the plan.

| # | Rule | Result | Evidence |
|---|------|--------|----------|
| 1 | The maths is the move | partly | Free taps are capped at 2 then look-together (`kit/mistakes.ts`, seen), and at most 2 shells share odd/even with the answer (`round.ts:196-208`). But a redo allows up to 3 more wrong shells, and full help lets counting outlines do the job |
| 2 | One thing at a time, voice first | partly | Voice for every question, big shells, no timer, 10 goes (seen). Goal written on the sign. No always-visible "Hear it again" |
| 3 | Concrete, then picture, then number | met | Pipi in a frame, then a row with no frame, then nothing (full, faint, none; none seen) |
| 4 | Help arrives by itself | partly | Why-line, look together, 3-in-a-row boost, guided first go (seen/code). No demo the first time altogether or two tides appears |
| 5 | Help follows the child | met | `helpForStats` per split with Leitner box and quick days; wrong drops the split back to full; teacher switch (on or off only, no "always"). Calendar colours only change the kinds of go. Faint not seen in play |
| 6 | Progression | partly | Research order and 70% rule (code). Practice replays DO move level and records (`server.ts:157-165`). No retrieval of earlier levels, no mixing; level 3 is a dead end with no "what's next" card |
| 7 | Mistakes teach | met | Wrong shells built from misconceptions with kinds (`round.ts:131`), why-line plus picture, look together, "Now you try" (seen). The kind itself is not saved as a field |
| 8 | Fair timing | met | Clock restarts after the voice (`Goes.tsx:140-143`), `JUNIOR_QUICK_MS` 10 s (code) |
| 9 | Record evidence a teacher can use | partly | Key, first-tap right or wrong, time, help level, taps saved (code). Wrong-choice kind is only derivable from taps, not shown. Grid, alerts and hardest exist; pupil page is thin |
| 10 | Fun from the maths | partly | Dig and pop-up are satisfying (seen) and growth is visible; but few choices and the day's shell is a calendar reward that a guesser also earns |

**Kit parts used:** `shared/kit/help` (`helpForFact`, `STRUGGLE_GOES`), `shared/kit/mistakes` (`tagWrongs`, `atMostShareTell`, `stepGo`), `src/kit/ShowWhy` (`ShowWhy`, `LookTogether`, `NowYouTry`, `useLookTogether`), and the shared `NextPartChip` and `teacherGrid` through the Foundational view.

**Kit parts it could use but doesn't:** `shared/kit/dayArc` and `shared/kit/replay` (it keeps its own copies in `shared/pipi/progress.ts` and `play.ts`); `TenFrame` and `DotPicture` (it draws its own frame in CSS and `PipiArt.tsx`); `HearAgain` (this is the missing replay button); `PointingHand` and `useGuidedFirstGo` (it has its own hand and guide); `FirstTimeTip` (for the new question kinds); `WhatsNext` (nothing shows at level 3 or at the end of the ladder); `shared/kit/help` `fadeAfter` and the teacher `HelpSetting` (fade, always, off; Pipi has on or off only).
