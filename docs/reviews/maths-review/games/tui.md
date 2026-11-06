# Tūī's Ten Tree: maths review

Reviewed 7 Nov 2026. Read: docs/TUI-PLAN.md, all of src/games/tui, shared/tui, the `tui` function, migration 20261106000100_tui.sql, and the shared "ten and" facts (shared/maths/skillPacks/earlyFacts.ts:74). Played in the preview (port 5305, own tab) as a new child: first go, deliberate wrong taps, perfect days, then jumped to other steps and help levels with the preview tools. No game code was changed.

## How it works

Each day the child does 10 goes (about 5 minutes). A go shows a full ten and some loose berries on two ten-frames: "10 and 4". The child taps the right nest (3 or 4 numbered nests along the bottom). Bella reads the question. A right answer: the berries fly in, Tūī eats, Bella says "14! 10 and 4 is 14", and arrow cards slide the "4" onto the 0 of the "10" to make 14. A wrong tap wobbles the nest, says "Try again!", and brings more picture back. The first finish of each NZ day turns one of ten kōwhai flowers bronze, then silver, then gold; 30 days wins a Golden Nest and a new bird friend. Two things adapt separately: the step (which question types) and the help level (how much picture).

## The maths

Nine facts only: tenand:1 to tenand:9 (10+1 to 10+9, answers 11 to 19). Each can be asked four ways (the "way", saved as variant): 0 `10 + n`, 1 `n + 10`, 2 `10 + ? = 1n`, 3 `1n − 10`. (shared/tui/round.ts:41-47)

| Step | Name | Ways asked |
|---|---|---|
| 1 | How many? | 10 + n only |
| 2 | Turn it round | adds n + 10 |
| 3 | How many more? | adds 10 + ? = 1n |
| 4 | Take the ten away | adds 1n − 10 |
| 5 | All mixed | all four, evenly |

- Inside steps 2 to 4, 7 of the 10 goes are the new way and 3 are earlier ways (round.ts:162-170). Each fact is asked once, weakest (lowest Leitner box) first, plus the weakest again at the end (round.ts:189-194). So a round is 9 distinct facts with one repeat.
- Next step: two "good" challenges (8+ of 10 right at the first tap) pass a step; never drops back (round.ts:87-106). Hard (4 or fewer right) puts help up one level.
- Next help level: two good challenges in a row go down one level (5 every berry counted in, 4 every berry, 3 kete, 2 faint kete, 1 sum + Peek, 0 sum only).
- Only the day's first finish moves step or level; "Play again" goes never do (server.ts:155).
- A child who already knows 7 of 9 facts (box 2+) starts at step 3, level 4 (round.ts:36-37, 67-70).
- The wrong nests come from the shared pack (one more, one less, ten more) plus a reversal (41 for 14) on "how many?" goes when n is 2 or more (round.ts:225). From playing: typical nests for 10+4 were 14 / 20 / 41; for 10+1 were 2 / 10 / 11.

## Scores (1 to 4)

| # | Criterion | Score |
|---|---|---|
| 1 | Maths fidelity | 3 |
| 2 | Clarity | 3 |
| 3 | Support and structure | 4 |
| 4 | Fading | 2 |
| 5 | Progression | 2 |
| 6 | Feedback | 2 |
| 7 | Progress recording | 3 |
| 8 | Engagement | 3 |

**1. Maths fidelity: 3.** The ten is always shown as one full frame first, the sum and the voice say "ten and four" before the number, and the 41-for-14 reversal is a distractor (round.ts:225), which is exactly the research on English teens. Ways 2 and 3 are the same fact seen from the other side, and they are taught one at a time then mixed (round.ts:41-47). The arrow cards after every right answer (Goes.tsx:242-253, seen working) link the picture to the written number. Held back from a 4: at levels 5 and 4 the answer is the only teen-looking number among the nests in many goes (seen: 14/20/41, 18/20/81, 13/20/31, 16/20/61), so "tap the one that starts with 1 and isn't 10 or 20" often works without counting. The 20 distractor is always there on "how many?" goes. There are 3 nests at levels 5 and 4 (nestsFor, round.ts:209), so blind guessing is a 1 in 3 chance and a second wrong tap makes the answer the only nest left. Teen range only (11 to 19): nothing links to 10 + 10, 20 or "tens and ones to 100" (the plan parks this).

**2. Clarity: 3.** Pre-reader friendly: the question is read aloud on each go (Goes.tsx:83), "Hear it again" is always on screen (Goes.tsx:153), one task and one tap per go, a guided first go with a hand (Goes.tsx:85-87, plan section 6). The picture is calm and it was obvious on first sight what to do. Problems: the "Hear it again" button reads the sum line, not the story line shown at level 5 (voiceLines.ts / Goes.tsx:153), so a child who asks to hear it again gets different words; the pointing hand covers the berries during the guided go (screenshot); the progress pips sit under the "Preview tools" button only in the preview. "10 + ? = 14" and "14 − 10 = ?" are written with symbols that a 5-year-old may not read, so the voice carries them at every level, which is fine while Bella is on, but a child with the voice off (the game has a Voice off button) on a "how many more?" go at level 5 only has the sum to go on (the picture cannot say the target, noted in the plan).

**3. Support and structure: 4.** The best part. Six levels of pictures, all built from the same ten-frame (the shape Quick looks and Weka use), the 5 and 5 colour split in a ten (art), the kete as "ten becomes one thing", the written sum beside the picture from level 4, a Peek button at level 1, and arrow cards at every level. After a wrong tap the picture rises one level; after a second wrong tap it goes to level 5 and Bella tells the story (round.ts:244-264, Goes.tsx:128; I saw each of these). The teacher can also set Fades / Always / Off.

**4. Fading: 2.** The design is lovely on paper (levels move by the child's results, not the clock) but the numbers cancel it for a child who does well. A perfect child hits two good challenges at step 1, which does two things on the same day: fades the help 5 to 4 (round.ts:92-95) and passes the step, which adds 2 levels back with the cap at 5 (round.ts:99-104). I played two perfect days and saved state read `step 2, level 5, goodInRow 0` (not level 4). The same happens at every step change (1 to 2, 2 to 3, 3 to 4, 4 to 5), because passing a step and fading both take exactly two good challenges. So a strong child sees every berry counted in, one at a time, for at least the first 8 school days, and only starts fading at step 5; a full run 5 to 0 at step 5 is another 10 good days. Also only the day's first finish counts, so that is about 18+ school days of top-level help for a perfect child, and the hub 30-day tree is the whole game. Fading also never changes the question; the picture is the only thing that fades. The in-go fade-back after wrong taps is good. The strong child who knows it already is helped by the 7-of-9 start (step 3, level 4), but that depends on the maths records being there.

**5. Progression: 2.** Order is sensible (how many, turn round, how many more, take away, mix) and matches the plan's research (Clements and Sarama's composing). It only adapts at day level: whole days at a step, and a child must have two good days to move. A child can wait 2 school days per step and 8 to reach mixed, with one number range (11 to 19) throughout and no new maths at the end of 30 days: the child sees the same nine facts for a term. There is no spiral into 10 + 10, tens and ones, or "ten more, ten less" and no link to Weka (bridging ten) so Foundational games do not hand on to each other. Within a day nothing adapts: a child who gets 10 of 10 does the same ten goes at the same level and the same ways. Within a step, the 7/3 split is fixed. Hard-day (4 or fewer) brings the help up but the step stays, which is correct.

**6. Feedback: 2.** After a right answer the feedback is excellent: the spoken stem "10 and 4 is 14" and the arrow cards. After a wrong answer there is almost none about the mistake: the nest wobbles and Bella says "Try again!" (Goes.tsx:128, words.ts `tryAgain`). The extra picture is helpful but generic, and the game does not say or show why 41 or 20 is wrong (the 41 reversal is the one wrong answer the research says needs naming: "that is four tens and one"). Because answers are never shown and the second wrong tap brings every berry, an anxious child can still get stuck on one go with 3 nests; there is no "ask for help" or "show me together" path. The plan says "the answer isn't shown", but the third-wrong-tap fade (round.ts:259-262) never runs at levels 5 and 4, since there are only two wrong nests, so the third-tap case is unreachable there (I confirmed 3 nests only reach "2 wrong" then the answer is the only choice).

**7. Progress recording: 3.** The server keeps the step, level, days, good-in-row (all on tui_progress), every round with its seed, goes, every tap with its time, mistakes, and first-right count (tui_rounds), and one record per fact in the shared records (gem_keep_facts, pack early-facts). It replays the taps on the server so nothing is trusted from the browser (shared/tui/play.ts:31-58, server.ts:132-170). A teacher sees on the student page: days done, step and level, last played, and the three hardest facts (migration teacher_tui_student). The class line is "n playing, m Golden Nests". Gaps: no Today-page alert or Hardest list entry for this game (nothing in Today.tsx or Hardest.tsx mentions tui); the fact record keys are `tenand:n`, not the way, so "she can do 10 + 4 but not 14 − 10" cannot be seen from the records (the way is only in tui_rounds.round JSON); the 41/20 reversal and which wrong nest was tapped is also only inside tui_rounds.taps and is never shown to a teacher; step and level are saved but not their history; and there is no "stuck" signal (days at the same step) in any teacher view.

**8. Engagement: 3.** The clay art is warm, the kete and berries popping into the frame are satisfying, Tūī eats, the arrow-card slide is a nice moment, and the 30 flowers to a Golden Nest give a reason to come back. The maths is the game (counting berries IS the task), not decoration. Each right answer holds the screen for 3.4 seconds (Goes.tsx:24), so 10 goes take about 45 seconds of waiting alone; a quick child will find it slow. No variety inside a day (same picture and same tap ten times); the "10 + 10 = 20" gold-day finale is a nice touch. A fixed ten goes means a keen child has "Play again" but nothing new in it.

## Problems seen while playing

1. A perfect child stays at help level 5 through steps 1 to 4 (see criterion 4). I played two perfect days; saved state was step 2, level 5, goodInRow 0.
2. Guessing: on levels 5 and 4 there are 3 nests and the first tapped wrong one is not removed, so "tap the lowest/highest" or "tap the one starting with 1" often works. After two wrong taps the last nest is the answer. Three picks cover every go; nothing in the maths stops that, and a wrong first tap still brings the whole picture back, which teaches by trial.
3. A wrong first tap brings the picture back, but a child who then taps the right nest gets exactly the same praise and the same arrow cards, and the go is recorded as wrong. Fine for the data, but the child cannot tell.
4. "Hear it again" says a different line (the sum) from the one played at level 5 (the story).
5. In the "take the ten away" goes the picture still shows the full frame plus the loose berries with the ten flying (`tui-ten--fly`); the ones left are not isolated for the child. At the screenshot for 11 − 10 the frames still show 11 berries with a sum, which is fine for early levels, but at level 3 and 4 the child can read "14 − 10" and still has the 14 berries on screen, so answering needs a visible subtraction the picture does not make.
6. The same fact appears twice in a round (the weakest, first and last, e.g. 10+1 at go 2 and go 10 in both rounds I saw).
7. Preview only: the tools panel covers the top-left of the screen and the pips.
8. The home page shows "Day 3 of 30" while daysDone is 2 (it counts the day you are on). Harmless.

## What is saved and what a teacher sees

**Tables** (migration supabase/migrations/20261106000100_tui.sql):
- `tui_progress` (one row per pupil): player, days_done, last_flower_day, step (1-5), level (0-5), good_in_row, good_at_step, version, updated_at.
- `tui_rounds` (one row per challenge started): player, seed, round (jsonb: step, level, help, goes [{key, v, l}]), open, taps (jsonb [{pick, ms}]), mistakes, first_right, started_at, finished_at. Finished rounds over 30 days old are deleted when a new one starts, so history is at most 30 days.
- `gem_keep_facts` (shared): rows with pack = 'early-facts' and fact_key like 'tenand:%': attempts, correct, avg_ms, box, last_seen, quick_days. One answer per fact per round, right only if the first tap was right.
- Settings: `app_settings.tui_enabled`, `tui_help` per class.

**Teacher sees** (src/pages/TeacherTui.tsx, migration teacher_tui_student / teacher_tui_class): per student, "n of 30 days, Step 3 How many more?, help level 2, last played, hardest facts (up to 3, tried 2+ times and box under 2)". Per class, "n playing, m Golden Nests". Nothing on Today or Hardest.

**SQL to run on the live database** (use the Management API; I have not run them):

1. Where pupils are: step and level, with days and last play.
```sql
select p.display_name, t.step, t.level, t.days_done, t.good_in_row, t.good_at_step, t.updated_at::date as last_played
from public.tui_progress t join public.profiles p on p.id = t.player
order by t.step desc, t.level, t.updated_at desc;
```

2. Error rates by way and by step, from finished rounds (the way is inside the round JSON; a go is "right at first tap" if its first tap in the sequence was the answer, so this uses the stored first_right and mistakes as a rough measure).
```sql
select (r.round->>'step')::int as step, (r.round->>'level')::int as level,
       count(*) as rounds, round(avg(r.first_right),1) as avg_first_right_of_10, round(avg(r.mistakes),1) as avg_wrong_taps
from public.tui_rounds r where not r.open and r.finished_at is not null
group by 1,2 order by 1,2;
```

3. Stuck pupils: same step for many days with low scores, and weakest facts across the class.
```sql
-- pupils who played 4+ finished rounds in the last 30 days and still average under 7 of 10 right at the first tap
select p.display_name, count(*) as rounds, round(avg(r.first_right),1) as avg_right, max((r.round->>'step')::int) as step
from public.tui_rounds r join public.profiles p on p.id = r.player
where not r.open and r.finished_at > now() - interval '30 days'
group by p.display_name having count(*) >= 4 and avg(r.first_right) < 7 order by avg_right;

-- hardest "ten and" facts across all pupils
select fact_key, sum(attempts) as tries, round(100.0*sum(correct)/nullif(sum(attempts),0)) as pct_right
from public.gem_keep_facts where pack = 'early-facts' and fact_key like 'tenand:%'
group by fact_key order by pct_right;
```

## Strengths

- Strong research base, and the game is actually built to it (ten shown first, ten-frame layout, kete as one unit, arrow cards, reversal distractor, concreteness fading, help follows the child).
- The best support set of the early games: six picture levels, in-go help after wrong taps, teacher setting Fades / Always / Off.
- Answers are never shown or said before a right tap; the server replays taps, so records can be trusted.
- Voice fades with the level; clear, short, Bella reads everything; no te reo numbers (James's choice, consistent with Weka).
- Rich record of every tap and the time, even though little is surfaced.

## Gaps

- Fading is cancelled by the step change for a good child (help stays at 5 for about 8 good days).
- Only nine facts, 11 to 19; no new maths in 30 days; no hand-on to Weka or to 10 + 10, tens and ones.
- Wrong-answer feedback is only "Try again" plus more picture; the reversal is never named.
- 3 nests at the top levels: guessable, and the 20 and x1 distractors give the answer away by shape.
- Nothing on the teacher Today or Hardest pages; no "stuck" signal; the way (10+4 vs 14−10) is not in the fact records.
- 3.4 s pause after every right answer makes a round slow for a quick child.

## Candidate improvements

1. **Fix the fade and step clash.** Problem: a perfect child is back at level 5 every time they change step, so help never fades until step 5. Change: when a step passes, only add help back if the child was not already at or above the step's level (or stop the +2 and keep level, just never below 4); or let the fade happen first and put the +2 only on the first challenge of the new step; or count good challenges for the step separately from the day the fade ran. Files: shared/tui/round.ts (placeAfter), shared/tui/tui.test.ts, docs/TUI-PLAN.md section 4, TeacherTui detail text. Effort S. Impact: high; this is the one real bug in the adaptive design.
2. **Name the mistake.** Problem: a wrong tap gets only "Try again". Change: for a wrong nest, show it next to the picture with a short line: for the reversal "41 is four tens and one", for 20 "that is two tens", for the nest equal to the ones "that is just the loose berries". Bella says it, the right-answer line is kept. Files: src/games/tui/Goes.tsx, voiceLines.ts, words.ts, clips (scripts/voice-clips.py), shared/tui/round.ts (tag each wrong choice by kind). Effort M. Impact: high on criterion 6.
3. **Make guessing cost the maths.** Problem: 3 nests, and the distractors differ in shape. Change: 4 nests at every level, distractors that all look like teens (14, 15, 13, 41 only sometimes); after one wrong tap remove that nest, not add picture, first time. Files: shared/tui/round.ts (nestsFor, showGo), tests, the plan. Effort S/M. Impact: medium to high.
4. **Show the take-away.** Problem: the "14 − 10" picture shows all 14 berries. Change: at levels 5 to 3 the ten visibly leaves and the loose berries stay alone before the child answers, and the sum is the only thing left to read. Files: Goes.tsx (Picture), tui.css. Effort S. Impact: medium on fidelity.
5. **Show teachers who is stuck.** Problem: no Today or Hardest entry, no way split. Change: add a Today alert "same step for 5+ days or under 6 of 10 on three days", store `v` with the fact records or add a small view from tui_rounds (way-by-way right/wrong), show the way breakdown on the student line ("14 − 10: 3 of 8"). Files: new migration (teacher_tui_stuck or extend teacher_tui_student), src/teacher/Today.tsx, src/pages/TeacherTui.tsx, src/data/tui.ts. Effort M. Impact: high for the teacher.
6. **Grow past the nine facts.** Problem: the same nine facts all term. Change: a later step (6, "Ten more, ten less" and 10 + 10, 20, then 10 and 14 to 24 as ten and some more) with new shared maths keys, and a "ready for Weka's bridging ten" note on the student line. Files: shared/maths/skillPacks/earlyFacts.ts, shared/tui/round.ts, art, migrations (step check to 6). Effort L. Impact: medium (long term); needs the shared-maths branch.
7. **Speed up for quick children.** Problem: 3.4 s hold after each right answer. Change: shorten to about 1.8 s after the child has had two good days, or tap-to-skip; keep the arrow cards. Files: Goes.tsx (RIGHT_MS). Effort S. Impact: medium on engagement.
8. **Make "Hear it again" say the same line as the go.** Problem: at level 5 it says the sum, not the story. Change: use askLine(go) at the child's current level. Files: Goes.tsx:153. Effort S. Impact: low but a real confusion for a pre-reader.
