# Pipi's Hidden Shells: maths review

Reviewed 7 Nov 2026. Code read in full (src/games/pipi, shared/pipi, src/data/pipi.ts, supabase/functions/pipi, migrations 20261104001400_pipi.sql and 20261105000500_next_part_chips.sql, docs/PIPI-PLAN.md). Played in the preview (http://localhost:5304/) on days 1 to 6, then jumped to silver (day 10) and gold (day 20) with the preview tools. Nothing changed in the game code.

## How the game works

A family of pipi sits on a beach. A wave washes in, some pipi dig under the sand, and the child taps one of four number shells to say how many are hiding ("7 altogether, 4 showing, how many hiding?"). A right shell lifts the sand and the hiding pipi pop up and wave. A wrong shell wobbles and the child tries again with no penalty. Ten goes make one day's challenge. The first finish each NZ day turns one of 10 shells bronze, then silver, then gold, so 30 days earns a Golden Pearl and a new friend's beach. The game is read aloud (Bella clips), so a pre-reader can play. The very first go is guided: 3 pipi, 2 showing, and a hand points at the right shell.

## The maths

- One idea: part-whole within 10 (composition: 7 is 4 and 3). The facts are keys like `part7:4` (7 altogether, 4 showing, answer 3). Wholes 3 to 10, every split including 0 hiding and all hiding (shared/pipi/round.ts:54-60, shared/maths/skillPacks/earlyFacts.ts:167-200).
- Levels (round.ts:29-33): level 1 = wholes 3 to 5 (15 facts), level 2 = wholes 6 and 7 (17 facts), level 3 = wholes 8 to 10 (30 facts).
- Question kinds (round.ts:35, showGo 162-187):
  - Hiding: "7 pipi. How many are hiding?" Every day.
  - Altogether: "4 here and 3 popped up, how many altogether?" Silver and gold days only, 2 goes a day, never an edge split (round.ts:25, 153-155).
  - Two tides: the hiding ones come up and the others dig in, "now how many hiding?" Gold days only, 2 goes a day (round.ts:150-152). This is the "4 and 3 is the same as 3 and 4" idea.
- Wrong shells: answer plus or minus 1 or 2, the number showing, the whole (earlyFacts.ts:197). For "altogether": whole plus or minus 1, the two parts (round.ts:183). These are sensible distractors.
- How the level is chosen (round.ts:69-73): the first level, at or above the furthest reached, where fewer than 70% of its facts are in Leitner box 2 or higher. The furthest level is saved and never drops (server.ts:157-158). Box rises by 1 for each right-and-quick answer (under 5 seconds, config.ts:53, leitner.ts:44-64); a wrong answer drops the fact to box 1; a right-but-slow answer changes nothing.
- How the goes are chosen (round.ts:127-157): ten different facts from today's level, weakest (lowest box) first, ties by seed. At most one "none hiding" or "all hiding" edge fact a round (always one at level 1 because it only has 9 middle facts).
- What I saw: an all-correct, fast child stayed at level 1 for 5 days (days 1 to 5), moved to level 2 on the sixth finish ("Next time the pipi families are 6 and 7"), and, after I jumped on to day 20, moved to level 3 after one silver and one gold round. Each fact needs two quick right answers, and only 10 of 15 facts are asked a day, so level 1 takes at least 3 days even for a flawless child.
- The day colour decides the help and the question kinds, not the child's level: day 1 to 10 bronze, 11 to 20 silver, 21 to 30 gold (progress.ts:47-61).

## Scores (1 to 4)

| # | Criterion | Score |
|---|---|---|
| 1 | Maths fidelity | 3 |
| 2 | Clarity | 3 |
| 3 | Support and structure | 2 |
| 4 | Fading | 2 |
| 5 | Progression | 3 |
| 6 | Feedback | 2 |
| 7 | Progress recording | 2 |
| 8 | Engagement | 3 |

### 1. Maths fidelity: 3
- The idea is right and the question is a real part-whole one: the child sees the whole and one part and finds the other (Goes.tsx:47-66). Gold days remove the outlines and close the row up, so "7 altogether, 6 showing" has to be worked out (Goes.tsx:104-107). I saw this on gold: a row of 6 pipi, "7 altogether", shells 7, 1, 6, 8.
- Two tides and "altogether" give three views of the same split, which is good composition teaching (round.ts:9-10).
- It is not a 4 because: a wrong tap has no cost and the choices stay on screen, so tapping all four shells always wins the go (play.ts:7-8, Goes.tsx:109-120). Only the first tap is recorded, but the day still counts. A shell turns and a pearl is won whatever the accuracy (server.ts:159-160; the day count only needs 10 goes finished). Also there is never an equation, number bond or "7 = 4 + 3" shown, so there is no bridge from pictures to number sentences (the parts form exists in earlyFacts.ts:194 but the game never shows it).
- On bronze, with the dashed outline and the five or ten frame, the answer can be got by counting the outlines, which is good scaffolding but at that point the maths is "count the dashed circles". Fine for a first step.

### 2. Clarity: 3
- A pre-reader can play: one screen, one number sign, four big shells, voice reads the question ("7 pipi. How many are hiding?", round.ts:171) and never says the answer. Voice can be turned off (PipiGame.tsx:135-139).
- The guided first go points a hand at the right shell and says what to do (Goes.tsx:145, 191-205; words.ts:25). I saw the hand on the "1" shell on the first go.
- The wave hides the pipi for 1.3 seconds before shells can be tapped (Goes.tsx:24, 76-87). Good, it makes the child watch.
- Weak points: the large number sign says "altogether" and "How many are hiding?" in print, and silver and gold "altogether" goes show "3 and 3 here and popped up" with no picture of the total, which a young child may find odd. The preview tools panel covers part of the play area but that is preview only.
- No visible way to hear the question again (no replay or speaker button on the play screen).

### 3. Support and structure: 2
- Models: five frame (wholes up to 5) or ten frame (6 to 10) with dashed outlines where the hiding pipi are (Goes.tsx:47-66, 104-109), and the pipi popping up after a right answer (Goes.tsx:122-128). That is a good model for part-whole.
- But there is nothing the child can ask for when stuck: no hint button, no "show me" button, no number line, no counters to move, no step-by-step reveal. A wrong tap just says "Try again!" (Goes.tsx:115-118). Nothing changes on screen after a wrong tap (I checked: only the shell wobbles).
- The teacher can turn the frame and outlines off for the class (teacher.ts, switch `pipi_help`) but cannot turn it on for one child or keep a child on small wholes.
- The model is good but support is not available on request, so 2.

### 4. Fading: 2
- Fading is by calendar, not by the child. Help is bronze (frame and dashed outline), silver (no frame, faint outline), gold (nothing) by day count alone (progress.ts:47-61, PipiGame.tsx:115, Goes.tsx:104-107).
- It never comes back if the child struggles. Level rises independently, so a child can be moved to wholes 8 to 10 on a gold day with no help at all. I saw exactly this: on day 20 the level rose to "up to 10" and the next round had 7 and 10 pipi in a plain row with no outlines.
- A slow learner reaches gold at day 21 with the same unaided questions as a fast one. A quick learner is held on frames for 10 days.
- It does fade in a sensible order (frame, outline, none, then altogether and two tides), so there is structure, but it is not responsive.

### 5. Progression: 3
- Order is sensible: small wholes, then 6 and 7, then 8 to 10; edges (0 and all) rare; weakest facts first; never goes back (round.ts:69-73, 127-157).
- It adapts by the child's own records, which is good. Level 1 to 2 took 5 days of all-right play in my test.
- Gaps: only 3 levels, so there is little visible gradation inside "8 to 10" (30 facts); no focus on friendly splits (5 and something, doubles, near-10) or on the "ten" whole as its own step; edge splits (0 hiding or all hiding) are mixed in from day one, which can look odd; the levels pass on 70% of facts at box 2 (two quick right answers), so a fact answered right but slowly (over 5 seconds, which is easy for a 5-year-old counting) never rises (leitner.ts:60-62). A slow, careful counter could be stuck even though they are always right.
- It does not go on to bonds to 10 symbols or to number sentences; that is the next game (Beanstalk).

### 6. Feedback: 2
- Right answer: the sand lifts and the hiding pipi pop up and wave, which confirms the answer and shows the hidden part (Goes.tsx:122-128). That is good feedback.
- Wrong answer: shell wobbles, voice says "Try again!" and that is all (Goes.tsx:115-118). It does not show why (no "you said 3, count the empty spots"), does not say too high or too low, and does not reveal the right answer or the hidden pipi after a second miss. The shells stay and the child can keep tapping.
- Nothing at the end of the round says which facts were tricky (the finish screen only shows shell colour and "level up", PipiGame.tsx:181-211).

### 7. Progress recording: 2
- The server saves enough but the teacher sees little (see next section). Per-fact records are good: right or wrong at first tap and time, for every go. The teacher page shows only days done, level and last played (TeacherPipi.tsx:31-65). Nothing shows who is stuck on which splits, error rates or taps per go, and there is no Today page alert for Pipi (no pipi match in src/pages other than TeacherPipi.tsx).

### 8. Engagement: 3
- Warm painted clay beach, a friend who cheers, ten shells that change, a Golden Pearl at 30 days, new beaches (PipiGame.tsx:147-213). The wave and the pipi popping up are charming, and the maths is the game (no mini-game bolt-on).
- Held back by: a 30-day arc at one challenge a day is slow for a 5-year-old (it feels like a term-long project), 10 goes of the same screen layout (only the numbers change), no variety in the interaction (always "tap a number"), and replaying the same day gives no reward (progress.ts:78-81). It is also the kind of game where a bored child can tap shells at random and still earn the shell.

## Problems found while playing

1. Tap-all guessing works. Four shells, no cost for wrong taps, so a child can always get through a go by tapping each shell. Only the first tap counts for the maths record, but the shell and Pearl still arrive. Nothing stops a child doing this all 30 days.
2. Wrong answer gets no help. Same screen, same hint (none); the child may tap the same wrong shell again.
3. Level can jump up on a gold day, so the harder wholes arrive with no frame or outline (seen on day 20: level 3 with 7 and 10 pipi in a plain row).
4. Level 1 felt slow for a quick child: 5 days at wholes up to 5, even all right and fast.
5. The edge splits give odd screens: "5 altogether, 0 showing" on gold shows an empty row (the spots are filtered away, Goes.tsx:106), "all showing, how many hiding?" gives 0. Sometimes a distractor is impossible (shells 6 or 7 for 5 altogether, seen as "[6,4,5,0]"), which a child who understands the whole can rule out; good, but a child may find "0" confusing. This is a small point.
6. In "altogether" goes the sign shows "3 and 3 here and popped up" (print) with no total; the pipi are drawn as 3 sitting and 3 waving. It reads fine for a Year 2 child but a 5-year-old may not read "here and popped up".
7. The preview's finish screen says "A magic shell turned bronze!" for several days in a row; that is correct (it only changes the colour of one new shell) but could feel the same each day.
8. No repeat-the-question button on the play screen (voice says it once).

## What is saved on the server

- `pipi_progress` (one row per pupil, migration 20261104001400_pipi.sql:18-26): `player`, `days_done`, `last_shell_day`, `reached` (1 to 3), `played` (challenges finished), `version`, `updated_at`.
- `pipi_rounds` (one row per challenge started, :28-40): `player`, `seed`, `level`, `colour` (bronze, silver, gold), `goes` (jsonb array of 10: `{key, kind}`), `open`, `taps` (jsonb array of `{pick, ms}`, every tap including wrong ones), `mistakes` (wrong taps), `started_at`, `finished_at`. Finished rounds over 30 days old are deleted when the pupil starts another (:83-84).
- The maths records, shared with every game: `gem_keep_facts` (primary key player, pack, fact_key; columns attempts, correct, avg_ms, box, last_seen, quick_days). Pipi's answers go in under pack `parts5` (wholes 3 to 5) and `parts10` (6 to 10), key `partW:S` (supabase/functions/pipi/entry.ts:70-73, supabase/functions/_shared/recordAnswers.ts:31-66). One answer per go, correct only if the first tap was right.
- Not saved: which wrong shell was picked per fact in a queryable form (it is in `pipi_rounds.taps` as raw JSON only), and no stuck flag.

### What a teacher can see now
- Games table: on/off switch, a line "Parts of numbers to 10 · N playing · M Golden Pearls" for the class (teacher.ts:17-24, `teacher_pipi_class`), and a drawer with the "Help in the sand" toggle (TeacherPipi.tsx:12-26).
- A student's page: "N of 30 days done on this beach · reached wholes 6 and 7 · Golden Pearls", last shell day and last played (TeacherPipi.tsx:31-65, `teacher_pipi_student`).
- Maths focus results count (via recordMathsAnswers), and the parts5/parts10 skills can be set as a teacher focus (PIPI-PLAN.md section 10).
- Not seen: no list of stuck pupils, no error rate, no per-fact grid for part-whole, no Today page alert for Pipi.

### SQL to run on the live database (do not run here)

Which level each pupil has reached, and how long ago they played:
```sql
select p.player, p.reached, p.days_done, p.played, p.last_shell_day, p.updated_at
from public.pipi_progress p
order by p.reached desc, p.days_done desc;
```

Wrong taps per challenge, by level and day colour (how hard each stage really is):
```sql
select r.level, r.colour, count(*) as challenges,
       round(avg(r.mistakes), 1) as avg_wrong_taps_per_challenge,
       round(avg(r.mistakes) / 10.0, 2) as avg_wrong_taps_per_go
from public.pipi_rounds r
where not r.open
group by r.level, r.colour
order by r.level, r.colour;
```

Stuck pupils: level 1 or 2 after 8 or more finished challenges, with the part-whole facts they get wrong (first-attempt accuracy under 60%):
```sql
select p.player, p.reached, p.played,
       sum(f.attempts) as attempts, sum(f.correct) as right,
       round(100.0 * sum(f.correct) / nullif(sum(f.attempts), 0)) as pct_right,
       count(*) filter (where f.box < 2) as facts_below_box2
from public.pipi_progress p
join public.gem_keep_facts f on f.player = p.player and f.pack in ('parts5', 'parts10')
where p.played >= 8 and p.reached < 3
group by p.player, p.reached, p.played
having sum(f.correct)::numeric / nullif(sum(f.attempts), 0) < 0.6
    or count(*) filter (where f.box < 2) >= 8
order by pct_right;
```

Tap-all guessing (finished rounds with 20 or more wrong taps, i.e. two per go or more):
```sql
select r.player, count(*) as guessy_rounds, max(r.mistakes) as worst
from public.pipi_rounds r
where not r.open and r.mistakes >= 20
group by r.player
order by guessy_rounds desc;
```

## Strengths
- Right idea at the right age, with real part-whole work and rare "none" and "all" splits.
- Read aloud, one task at a time, guided first go, a calm wave pause before answering.
- Good model: frame plus dashed outline on bronze, popping pipi after a right answer.
- Three views of the same split (hiding, altogether, two tides) on silver and gold.
- Level adapts to the child's own fact records, weakest facts first, never drops back.
- Server replays the taps itself, so the records cannot be forged from the browser (server.ts:145-150).
- Teacher can switch the help off for the class; each go records right or wrong at first tap and time.
- Friendly art, pearls and achievements, no points, no ranking.

## Gaps
- No response to struggling: help fades by calendar and never returns.
- Wrong answers get a wobble and "Try again!", nothing more; tap-all guessing always wins.
- The reward (shell, pearl) does not depend on accuracy.
- Teacher sees days and level only: nothing on stuck pupils, error rates or particular splits.
- No hint or "show me" tool and no replay-the-question button.
- No bridge from pictures to number sentences.
- Slow and careful correct answers do not move a fact up (quick time 5 seconds).
- 30 days per pearl is long, and every go looks the same.

## Candidate improvements

1. **Bring the help back after a struggle (and do not fade on the calendar alone).**
   - Problem: help fades by day count; a child moved to a new level on a gold day gets no frame; a child who keeps failing never gets help back.
   - Change: choose help for each go from the child's box for that fact (new or box 0 to 1: frame and outline; box 2: faint; box 3 or more: none), and after two wrong taps on a go bring the outline back. Keep the day colour for the look and the kinds of go.
   - Files: shared/pipi/round.ts (add `help` per go or compute from the box), src/games/pipi/Goes.tsx, PipiGame.tsx, shared/pipi/play.ts if the help is saved.
   - Effort: M. Impact: high (fading and support go from 2 to 3 or 4).

2. **Make a wrong answer show why.**
   - Problem: wobble and "Try again!" only; the same wrong shell can be tapped again.
   - Change: after the first wrong tap, light up the dashed outlines and count them aloud ("Look: 1, 2 hiding"); after the second, remove the wrong shell (leaving 3 choices, then 2) and after the third show the answer with pipi popping up. Then count this go as wrong anyway.
   - Files: Goes.tsx (pick, spotsFor, shell buttons), words.ts, voice lines (public/voice/pipi, scripts/voice-clips.py).
   - Effort: M. Impact: high (feedback 2 to 3 or 4, and fewer random taps).

3. **Make tap-all guessing pointless.**
   - Problem: unlimited free taps; shell and pearl come regardless.
   - Change: remove each wrong shell once tapped (so at most 3 taps), and give the day's shell only after at least 6 of 10 goes right at first tap (otherwise "come back tomorrow" with an easier round, no shame). Keep the pearl count honest.
   - Files: Goes.tsx, shared/pipi/server.ts and progress.ts (the finish rule), PipiGame.tsx (finish screen), words.ts.
   - Effort: M. Impact: medium to high (fidelity 3 to 4; but check with James that withholding shells does not discourage 5-year-olds).

4. **Give the teacher a "who is stuck" view.**
   - Problem: the teacher sees days, level and last played only.
   - Change: add a `teacher_pipi_stuck(class)` function and a small table on the Pipi drawer or the Today page: pupils with at least 8 challenges and level below 3, or first-tap accuracy under 60%, or 20+ wrong taps in a round; with the splits they miss most (from `gem_keep_facts` packs parts5 and parts10). A per-split grid (wholes by showing) for each pupil.
   - Files: new migration (teacher_pipi_stuck, teacher_pipi_facts), src/data/pipi.ts, src/pages/TeacherPipi.tsx, Today page alert component.
   - Effort: M. Impact: high (progress recording 2 to 3 or 4).

5. **Count slow right answers kindly for young children.**
   - Problem: a right answer over 5 seconds never moves a fact up, so a careful counter can be stuck at level 1.
   - Change: a longer quick time for the early-facts packs (for example 8 to 10 seconds, as `QUICK_MS_BY_PACK` already allows per pack) or let two right answers in a row move a fact up whatever the speed at this age.
   - Files: shared/maths/config.ts (QUICK_MS_BY_PACK), shared/pipi/server.ts (withAnswers uses it), supabase function uses the same value.
   - Effort: S. Impact: medium (progression and fidelity; also affects Hop, Beanstalk and others reading early-facts).

6. **A "show me" and "say it again" button.**
   - Problem: no way to ask for help or to hear the question again.
   - Change: a speaker button that repeats the question and a hint button (a shell with a hand) that flashes the outlines and counts them; using it records the go as a helped go (not a clean right).
   - Files: Goes.tsx, words.ts, play.ts (a `hint` flag per tap), shared/pipi/server.ts, voice clips.
   - Effort: M. Impact: medium (support 2 to 3).

7. **Show the number sentence after a right answer, later in the game.**
   - Problem: no bridge from pipi to numbers (7 = 4 + 3).
   - Change: after a right answer on silver and gold, show "4 + 3 = 7" under the pipi with the parts coloured to match, said aloud. Start with bronze never showing it.
   - Files: Goes.tsx, words.ts, voice lines, pipi.css.
   - Effort: S to M. Impact: medium (fidelity and progression to Beanstalk).

8. **Make days faster to move for a quick child and add variety.**
   - Problem: level 1 lasts at least 3 days even for a perfect child; every go is "tap a number".
   - Change: after a round with at most 1 wrong tap, let the next challenge start at the next level when 70% of the next level's neighbours are secure (or allow a second challenge a day that counts toward the level but not the shell). Add one other action, for example dragging pipi under the sand to make the split.
   - Files: shared/pipi/round.ts (levelFor), server.ts, Goes.tsx.
   - Effort: L for the new action, S for the level speed-up. Impact: medium (progression and engagement).
