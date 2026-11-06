# Weka's Stepping Stones: evaluation

Folder `weka`. Plan: docs/WEKA-PLAN.md. Played in the browser preview (port 5306) on 7 Nov 2026: day 1 (all ten goes, with deliberate wrong taps), day 2 (all ten), the start of day 3 (level 2) and the start of a "day 26" gold day (jumped with the preview tools). I could not play the last two goes of a gold day (the hop-backs), so those are judged from the code. The browser pane slowed my scripted taps badly after day 2, so I did not get through a full level-2 or gold round.

## 1. How it works

Weka the bird stands on a row of numbered stepping stones (5 to 20) with a big rock at 10. The child is shown an adding fact that crosses ten ("9 + 7", "8 + 5"). In the full-help version they first tap "how many hops to 10?" (4 numbers), Weka hops to the big rock, the make-ten sentence appears ("9 + 1 = 10, then + 6") and the child taps where Weka will land (4 numbers). After a right answer they get the same question again with pebbles (gold pebbles in one ten-frame, silver in the next; tap or drag silver across until the first frame is full), then fill in a part-whole bond ("how did you split the 7?": hops to the rock, then hops after). One round is 10 goes. One round a day turns one of 10 stones on the far bank bronze, then silver, then gold (30 days), then a new bird friend and a new stream. Bella reads everything aloud. Later in the game the help fades per fact: first the child splits the number before answering, then a faint picture, then numbers only.

## 2. The maths

Only the 20 adding facts with both numbers 9 or less and a total 11 to 18 (the hub's `add:a+b` facts, `shared/weka/round.ts:25-30, 69-83`).

Levels (`round.ts:25-30`):
1. Starting on 9: 9+2 to 9+9 (8 facts)
2. Starting on 8: 8+3 to 8+8 (6 facts)
3. Starting on 7 and 6: 7+4..7+7, 6+5, 6+6 (6 facts)
4. All 20 mixed.

How the level is chosen: `levelFor` (`round.ts:92-96`) gives the first level where fewer than 70% of its facts are in Leitner box 2 or more, and never below the furthest reached (`reached` saved in `weka_progress`). Box 2 means two quick (5 s) right first-answers (`shared/maths/leitner.ts:44-64`). A fact is only recorded once per round (`play.ts:41-45`), so a level needs at least 2 days of play. I saw this: all-correct and quick on days 1 and 2 gave "Next time: starting on 8" at the end of day 2.

Round make-up (`round.ts:156-196`): each fact of the level once (weakest first), then the weakest again, plus up to 3 review facts from earlier levels from level 2 on. Level 1 only has 8 facts for 10 goes so two facts repeat in the same round (I saw 9+3 and 9+9 twice on day 1). Silver days (days 11-20) turn about 30% of goes round to the smaller number first ("5 + 8", start on the bigger number). Gold days (21-30) end with two hop-backs ("13 − 5": 3 back to 10, then 2 more).

How a go is asked: the shared maths pack makes the question and the 4 choices (`shared/maths/skillPacks/addSub.ts:67-72`). Wrong choices are always the answer ±1 and ±2 (for hop-backs: b±1, b±2, and the total). They are not designed around the real errors.

Help per fact (`round.ts:101-108`): full until box 2 and quick on two different days; then split-first until box 4 and 8 right; then faint (one tap) until 12 right; then none. One wrong answer drops the fact to box 1 so full help returns. The teacher can set help to always on or off (`server.ts:44-53`). After 3 goes in a row with a wrong first tap, full help comes back for the rest of the round (`Goes.tsx:47, 97-99`).

## 3. Scores (1 to 4)

**1. Maths fidelity: 3**
- Teaches the right strategy: make ten, then add the rest (`Goes.tsx:4-6`, stem line "9 + 1 = 10, then + 6" shown once Weka is on the rock). The number line with a big rock at 10 and light/dark fives (`Goes.tsx:49-52`), ten-frame pebbles and the part-whole bond are all research-aligned models.
- The first step ("hops to 10?") has to be right to go on, so the child cannot skip the idea in full-help goes. The answer step needs the second half of the sum.
- Weakness: only 4 choices, always within ±2 of the answer, and tapping 4 buttons costs nothing (no penalty). A child can tap their way to the answer; with level 1 the step-1 answer is always 1, so it is guessable (and a hand points after 3 wrongs).
- On faint/none goes it is a plain tap-the-sum on 4 near numbers; it checks fluency but not method.
- Pebbles step: tapping any silver pebble moves one, and the game stops at 10. The child does not choose how many to move, so the "make ten" decision is done for them (`Pebbles.tsx:66-76`).
- The bond ("how did you split the 7") is multiple choice again with 4 numbers, after the answer is already known.

**2. Clarity: 3**
- Everything is read aloud in Bella's voice with a "Hear it again" button and a pointing hand on the first go (`Goes.tsx:151-152, 310`). One question at a time, big stones as buttons, no reading needed. I played the first go with no instructions and it was easy to follow.
- Odd points: the first go's step 1 has the right answer pointed at 2.6 s in, fine. After a right answer the child has to work through pebbles and then the bond before the next go: three screens per go. The Next button on the bond is small text ("Next ➜"). The Weka stones row is small at the top of a big screen and the answer buttons are partly cut off at the bottom in a screenshot at 800x600.
- The "9 + 7 = ?" text uses the symbols, which are fine for 6-7 but the question is also in the voice line.

**3. Support and structure: 4**
- This is the strongest part. Number line with big rock, hops drawn as dots in two colours (orange to the rock, blue after), the make-ten sentence, counting together (Bella counts hops and lights stones after 2 wrong taps, `Goes.tsx:157-168, 182-187`), the pointing hand after 3 wrongs, pebble ten-frames and a bond with coloured arrows (`Jumps`, `Goes.tsx:413-479`). Help never gives the answer in speech (`voiceLines.ts` header).
- A child who is stuck is never left stuck, and there is no penalty.

**4. Fading: 3**
- Real, per-fact fading in four steps: full, split-first, faint, none (`round.ts:101-108`), plus a teacher setting (always / fade / off). Help comes back after a wrong answer (box drops to 1) and after 3 struggling goes in a round (`Goes.tsx:47`).
- Fading is slow (12 right answers on a fact before "none", one record per fact per day so about 12 days), which fits young children but means for weeks the child still has the pictures.
- Fading is based on right/quick only, using a 5 s quick time (`leitner.ts`, `config.ts:53`). On a full-help go the clock only starts after the hop-to-ten step (`Goes.tsx:204`), so "quick" is easier to earn with help on than it should be. Hint-use is not counted: a child who needed the hand to point (3 wrong taps) still has only that first wrong pick recorded, which is right, but a child who tapped 4 times before the right answer and one who got it first time look the same only if the first tap was right.
- No fading of the pebbles/bond tasks inside full help: every full go has them.

**5. Progression: 3**
- Starting on 9 (one hop to ten), then 8, then 7 and 6, then all mixed. This is the standard research order for bridging ten (add to 9 first, then 8, 7, 6) and is slow and careful. Review goes from earlier levels are mixed in. Silver and gold days add turn-arounds (commutativity, start on the bigger number) and subtraction from 13 back across ten.
- Adaptive: levels move on the 70% rule; facts get weaker-first selection (`weakest`, `round.ts:127-134`).
- Gaps: level 1 is 8 facts of "9 + n" where step 1 is always the same answer (1), so day 1-2 are very repetitive. Levels 3 and 4 jump to a big mixed set with no 5+n, 4+n of the "5 and 5" type or doubles-plus-one links. Facts with a total over 18 do not exist (fine). Hop-backs on gold days are only 2 goes, so subtraction across ten is barely practised. The day type (bronze/silver/gold) is set by days played, not by how well the child knows the facts, so a struggling child gets silver and gold content (turn-arounds, hop-backs) on day 11 and day 21 regardless.

**6. Feedback: 2**
- After a wrong tap: a wobble, "Try again!" (`words.ts`), then on the 2nd wrong the make-ten sentence or counting of hops, then the hand. That is a good ladder of hints but it is the same whatever the child chose; the game never says why 11 is wrong (e.g. "that is where you stop at the rock" or "you counted on one too few").
- Right answers are praised with the make-ten sentence ("13! 10 and 3 make 13."), which is good.
- There is no end-of-round summary of which facts were hard (I saw only "Well done! A stone turned bronze!" and "Next time: starting on 8"). The child and the adult get no picture of the mistakes.
- The wrong choices are not tied to misconceptions, so no feedback can be.

**7. Progress recording: 3**
- Server saves a lot (section 5): every round's goes, every tap with timing, the mistakes, plus per-fact boxes in `gem_keep_facts`. The teacher student page shows days done, level reached, last played and the 3 hardest facts. Class page shows number of players and baskets.
- Gaps: nothing on the Today page or any "who is stuck" alert for Weka (searched src: no reference outside the Weka files, registry, card art and teacher page). No per-fact grid for the class. Level is shown but not how long they have been on it, or how many days stuck. The taps and mistakes per round are stored but never shown.

**8. Engagement: 3**
- Lovely clay-style art, Weka hopping stone by stone, sounds, and a long-term goal of 10 stones and a Golden Picnic Basket with new bird friends. No points, no ranking.
- The core loop is the maths (hops are the answer), which is good. But each go has up to three parts and takes about 7 s even when it is a one-hop fact; a day is about 10 goes x 3 screens. Day 1 and 2 are all "9 + n". The reward (stone changes) is once per day and quite abstract.

## 4. Problems found while playing

- Level 1 step 1 ("how many hops to 10?") is always 1, and the choices are 1 to 4; trivial and guessable. Every go of days 1-2 does this.
- Wrong choices are answer ±1/±2 only. I saw `9+9: 15,14,18,16` (no 17 or 19) on one round and `18,19,20,16` on another: the choice set is not stable and sometimes leaves out the nearest numbers, so guessing odds change.
- The pebbles step: tapping any silver pebble does it. Nothing to get wrong, so it is "tap until done"; and it has to be finished before the bond. Pebbles for 9+2 means one move and one tap, which feels like a lot of ceremony for a fact the child has just answered.
- On a wrong answer there is no information about what the child did. After 3 wrongs the hand points at the right number, so a child can finish any go by tapping everything in turn.
- In a round with fewer facts than goes (level 1: 8 facts, 10 goes) the same fact comes twice; I saw 9+3 and 9+9 repeat. The second time does not count for the records (`play.ts:41-45`), so those goes are practice only.
- Guided first go: the stem "9 + 1 = 10, then + 1" is shown and the hand points at the answer, so the first go is fully told. Fine for a first go but the child is shown how without having to try.
- In a headless/hidden browser the hop animations stall (timers), which made my script click the wrong thing; real children on a tablet would not see this, but a very slow device would show a long gap between a tap and the next screen (about 1.8 s of "right" time plus 260 ms a hop, `Goes.tsx:41-45, 223`).
- At 800x600 the choice stones sit partly off the bottom of the screen on some goes (seen on the "+4" screen).

## 5. What is saved, what teachers see, and queries

Tables (`supabase/migrations/20261105000600_weka.sql`):
- `weka_progress` (player, days_done, last_stone_day, reached 1-4, version, updated_at).
- `weka_rounds` (player, seed, level 1-4, day bronze/silver/gold, `goes` jsonb [{key, v, h}] for the 10 goes, open, `taps` jsonb [{pick, ms}], mistakes int, started_at, finished_at). Finished rounds over 30 days old are deleted on the next start (`weka_start`, line 89), so long-term history is not kept.
- Maths records go to the hub's `gem_keep_facts` (player, pack='add-sub', fact_key 'add:5+8', attempts, correct, avg_ms, box 0-4, last_seen, quick_days). One answer per fact per round.
- Teacher: Games table has the on/off switch, a help setting (fade/always/off) and a line "Making ten to add · N playing · B Golden Picnic Baskets" (`teacher_weka_class`, `src/games/weka/teacher.ts`). A student's page shows stream, stones, level reached ("Starting on 8"), last played and up to 3 hardest facts (tried at least twice, box under 2; `teacher_weka_student`). Nothing on Today or any alert.

Queries (do not run here):

```sql
-- 1. Where is each pupil? Level reached, days played, last played.
select p.display_name, w.reached as level, w.days_done, w.last_stone_day, w.updated_at
from public.weka_progress w join public.profiles p on p.id = w.player
order by w.reached, w.days_done;

-- 2. Error rate by fact, across all finished rounds (first-pick wrong rate; goes
--    stored per round, taps in order, so this uses mistakes per round as a rough guide).
select r.level, count(*) as rounds, avg(r.mistakes)::numeric(4,1) as avg_mistakes,
       count(*) filter (where r.mistakes >= 6) as rounds_6plus_mistakes
from public.weka_rounds r where not r.open
group by r.level order by r.level;

-- 3. Stuck pupils: on the same level for 5+ rounds, or facts still in box 0-1 after 6+ tries.
select p.display_name, w.reached, w.days_done, g.fact_key, g.attempts, g.correct, g.box
from public.gem_keep_facts g
join public.profiles p on p.id = g.player
join public.weka_progress w on w.player = g.player
where g.pack = 'add-sub' and g.attempts >= 6 and g.box < 2
  and g.fact_key ~ '^add:[1-9]\+[1-9]$'
  and ((substring(g.fact_key from 5 for 1))::int + (substring(g.fact_key from 7 for 1))::int) between 11 and 18
order by g.correct::numeric / g.attempts, g.attempts desc;
```

## 6. Strengths

- Teaches the right strategy with the right models, in a research-based order (9, 8, 7 and 6, then mixed).
- Support is rich, builds up gently after wrong taps, and never speaks the answer.
- Fading is real, per fact, in four steps, and comes back when the child slips. The teacher can force help on or off.
- The server replays taps, so nothing that counts comes from the browser; records feed the hub-wide maths records.
- Very warm look and sound; no points or ranking; small daily dose with a long-term picnic goal.
- Missed days cost nothing; level never drops back.

## 7. Gaps

- Wrong answers get a hint but no reason; wrong choices are not built around real errors (stopping at 10, counting on from the wrong number, 10 + the whole number).
- Tapping 4 choices with no cost, and a pointing hand after 3 wrongs, means a child can pass any go by guessing; guessing is not visible to the teacher (only the first pick counts and no "needed hint" flag is saved).
- Pebbles and bond steps are done for the child (no choice to make) and run after every full-help go: much ceremony, little thinking.
- Day 1-2 level 1 is very repetitive, and the 70% rule needs a minimum of 2 days per level anyway.
- Day type (silver/gold) follows the calendar count, not mastery.
- Hop-backs (subtraction across ten) are two goes on gold days only.
- No Today-page alert or class grid for stuck pupils; no round summary; finished rounds are deleted after 30 days.
- No saving of whether hints were used, or of the wrong picks (taps are saved, but only for 30 days).

## 8. Candidate improvements

1. **Wrong choices built around real errors.** Problem: choices are the answer ±1/±2, so feedback can't be specific and guessing works. Change: for `add` goes use the rock (10), the total of the two numbers' parts mistaken (big + toTen... e.g. 8+5: 10, 15 = 10+5, 11 = 8+3), and 18-style "all the numbers added" distractors; then say a one-line reason on the first wrong ("That is where Weka is on the rock. 3 more hops."). Files: `shared/weka/round.ts` (own choices instead of the shared pack, keeping `rebuild` check), `server.ts`/`play.ts` unaffected as long as choices stay replayable; `Goes.tsx`, `words.ts`, `voiceLines.ts` (new lines + clips). Effort M. Impact: high (feedback 2 to 3, fidelity up).
2. **Make the pebble step a real choice.** Problem: child taps silver and the game stops at 10, so no thinking. Change: let the child drag as many as they think make ten (and show a wrong try), with "10 is full / 2 gone / 3 left" feedback; drop the step once a fact is in split help. Files: `Pebbles.tsx`, `round.ts` (`pebblesFor`). Effort S/M. Impact: medium.
3. **Save and show hint use and wrong picks per fact.** Problem: a teacher can't tell a guesser from a fluent child. Change: store first-pick wrong count and "needed the hand" per go in the finished round (new jsonb field or reuse `taps`), keep finished rounds longer (90 days or summarised), and add to the student page "needed hints on 5/10 goes". Files: new migration (weka_rounds), `server.ts`, `play.ts`, `teacher_weka_student`, `TeacherWeka.tsx`. Effort M. Impact: high (progress recording 3 to 4).
4. **Today-page alert and a class grid.** Problem: no way to see who is stuck. Change: alert when a pupil has played 5+ days at the same level or has a fact under box 2 after 6 tries; a small class table of level x days. Files: teacher Today code, a new `teacher_weka_class_rows` function, `TeacherWeka.tsx`. Effort M. Impact: high for the teacher.
5. **End-of-round picture.** Problem: only "Well done" is shown. Change: show the 10 facts as dots (green first-try, amber needed help) and name the hardest, with Bella saying "Next time we will practise 9 + 7". Files: `WekaGame.tsx` (finish screen), `words.ts`, `voiceLines.ts`. Effort S/M. Impact: medium (feedback, engagement).
6. **Vary level 1.** Problem: step 1 is always "1", 8 repeated facts. Change: skip the trivial step 1 for starting-on-9 (just show one hop), or mix in 5 doubles-plus (6+5, 7+4) from day 3; alter round length for level 1 to 8 goes. Files: `round.ts` (GOES, level facts), `Goes.tsx`. Effort S. Impact: medium.
7. **Shorten the three-part go for confident goes.** Problem: every full go has hops, pebbles, bond; about 7 s and three screens. Change: pebbles only on the first two right goes of a fact per day; bond only when the fact was wrong or new. Files: `Goes.tsx`, `round.ts`. Effort S. Impact: medium (engagement, fading).
8. **Tie silver/gold days to mastery.** Problem: turn-arounds and hop-backs arrive on day 11 and 21 for everyone. Change: offer them when the level is 4 or 80% of facts are in box 2; give hop-backs 4 goes rather than 2 and separate subtraction facts in the records. Files: `shared/weka/progress.ts`, `round.ts` (`day`), `server.ts`. Effort M. Impact: medium.
