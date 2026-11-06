# Penguin Pairs (korora): evaluation

Folder `korora` (src/games/korora, shared/korora, supabase/functions/korora, migrations 20261105000100_korora.sql and 20261105000300_korora_shoes.sql). Evaluated 7 Nov 2026 by reading all the code and playing the vite preview (port 5303, in-browser trial backend running the same rules as the server). Played day 1 as a new child (one wrong tap on purpose, a 3-wrong-taps go), then perfect rounds until the level moved, then the "jump to day" tool for a gold day at level 3.

## How it works

Each day a child does one challenge of 10 goes with Two-Shoes the penguin. A double shows fish on a rock and the same fish upside down in the still water ("2 + 2 = ?" or "Double 3 = ?"). A half shows a pile of fish to share between two chicks ("Half of 12 = ?"). The child taps one of four number stones. A wrong tap wobbles and they try again with no penalty. The first finish each NZ day turns one of ten stepping stones bronze, then silver, then gold; a crossing (10 days) wins bronze, silver, then gold dancing shoes (30 days), then a new bird friend. Gold days end with 2 "fair or not?" goes (odd and even). The game talks (Bella clips) and has a "Hear it again" button.

## The maths

- Four fixed levels (`shared/korora/round.ts:26-31`): 1 doubles 1 to 5 (5 facts); 2 halves of 2 to 10 even (5 facts); 3 doubles 6 to 10; 4 halves of 12 to 20. Always in that order. Odd/even ("fair or not") has 3 to 10 at levels 1 and 2, 5 to 20 at levels 3 and 4 (`:49-52`).
- Level choice: `levelFor` (`round.ts:69-73`): first level not below the furthest reached whose facts are at least 70% in box 2 or higher (`STEP_SECURE_SHARE`, `shared/maths/selector.ts:60`). With 5 facts that means 4 of 5. The server keeps the furthest level so a child never drops (`shared/korora/server.ts:161-162`, db column `reached`).
- A box rises only for a correct FIRST tap made within 5 seconds (`shared/maths/leitner.ts:44-65`, `QUICK_MS = 5000`, no early-facts exception in `shared/maths/config.ts:57`); a wrong first tap sends the fact to box 1; a slow correct tap changes nothing. Box 2 therefore needs two quick correct answers. I moved from level 1 to 2 after 3 days of (nearly) perfect, instant-click play.
- Round make-up (`makeRound`, `round.ts:166-191`): each of today's 5 facts once, then the weakest facts again to fill 10 goes, with 3 review goes from earlier levels from level 2 on. So level 1 is just five facts, each asked about twice. Gold days swap 2 goes for fair-or-not. The same fact is not asked twice in a row (`spreadOut`, `:122-132`). A half straight after its double is moved together (`pairUp`, `:138-153`) and Bella says "Double 6 is 12. So what is half of 12?" (`words.ts:30`).
- First ever go is always double 2 with a pointing hand (`round.ts:36`, `Goes.tsx:174`).
- Wrong choices come from the shared pack (`shared/maths/skillPacks/earlyFacts.ts:65, 69`): answer +/-1, +/-2, n+1 and n*n for doubles (I saw 5 + 5 offering 25, and 10 + 10 offering 100: a times-tables slip, not a doubles error); halves offer answer +/-1, +/-2 and n itself (the "didn't share" mistake). Four are shown, order fixed by the seed.
- What changes how much the picture helps is NOT the child's level but the count of finished days at this pool (`shared/korora/progress.ts:52-67`): days 0 to 9 "full", 10 to 19 "faint", 20 to 29 "none". Teacher can force always or off (`shared/korora/server.ts:42-52`).

## Scores (1 to 4)

| # | Criterion | Score |
|---|---|---|
| 1 | Maths fidelity | 2 |
| 2 | Clarity | 3 |
| 3 | Support and structure | 3 |
| 4 | Fading | 2 |
| 5 | Progression | 2 |
| 6 | Feedback | 2 |
| 7 | Progress recording | 2 |
| 8 | Engagement | 3 |

### 1. Maths fidelity: 2
- Good picture of a double (fish and their reflection, rows of five like a ten-frame, `Goes.tsx:35, 267-295`) and of a half (fair sharing one each in turn, `Goes.tsx:333-370`). The link "double then its half is the same picture backwards" is built in (`pairUp`).
- But the maths is not needed to win on bronze days. All fish are on screen and the answer can be got by counting (that is fine for a first go, and it is the intended support), but bronze-day halves are shared out BY THE GAME (`Goes.tsx:100`, `help === 'full'`), so the answer is simply the count in one chick's nest. I saw it: for "Half of 4" two fish sat by each chick before I tapped anything.
- Wrong taps cost nothing and the next hint is free: a child can tap all four stones. Only the first tap is recorded (`shared/korora/play.ts:40-44`), so tapping about does hurt the record, but the child still "wins" the day and the pebble turns. The 3rd wrong tap points a hand at the answer (`Goes.tsx:174`).
- Fair-or-not has only 2 choices (50% guess), and on a gold day the pile is a basket with a number (e.g. 15) and no fish, so the child must already know odd/even from the numeral. The two buttons carry 2-fish and 3-fish icons (`Goes.tsx:236`) that are not the pile, so they mean nothing.
- Doubles never go past "n + n" as a fact: no link to near doubles or to the ×2 table (plan says it leads there), and no "double and add one". No missing-number or reverse forms ("? + ? = 8", "what is the double of... / which number halved gives 5").

### 2. Clarity: 3
- One question on screen, the question line big at the top, four large number stones, "Hear it again", all questions read aloud by Bella with clips (`voiceLines.ts`); a hand shows the very first go. Works without reading.
- The question line "2 + 2 = ?" or "Double 3 = ?" is text only; the first go explains it by the hand pointing rock, water, number (`Goes.tsx:98-100`). On later goes no one tells the child why the water fish matter (the idea of "same again").
- Odd: bronze-day halves finish with the pile area showing an empty grey box (screenshot of "Half of 4") once the fish are all shared. The jump from "Half of 4" grey blank to pile on a gold day is not explained.
- Number order on the stones is shuffled each go (5/4/3/6) and not in order, which is fine, but with no number line a child can't see "near" answers.

### 3. Support and structure: 3
- Models are present and good: rows of five (ten-frame feel), linked fish to mirror fish (bronze), counting together with Bella lighting each fish (`countTogether`, `Goes.tsx:111-126`), tap a fish to count it, tap to give fish to a chick, Hear it again.
- Hints build: 1st wrong = wobble, "Try again"; 2nd wrong = pictures return and Bella counts (`Goes.tsx:145-148`); 3rd = hand points at the answer.
- Missing: no ten-frame or number line for doubles beyond 10; for the larger doubles (6 to 10) the rock is two rows and the water is two rows, which is good, but there is no "double = 2 lots of n" bridge to the numbers, and no visible link between the double fact and the halving fact other than the spoken line.
- Count-together on a 2-choice fair-or-not is skipped (`w === 2 && go.kind !== 'fair'`, `Goes.tsx:147`), so a child stuck on odd/even has no hint beyond brute-forcing the second button.

### 4. Fading: 2
- Fading is real in the picture (full, faint, none) but it is by calendar, not by the child's skill: `poolAfter` (`progress.ts:52-67`) uses days played only. A child at level 1 on day 21 gets no pictures; a child who jumps to level 3 on day 1 gets full. The plan promised "help fades with the pebbles" and that is what was built, but it is not "as the child succeeds". Level-up does not reset the help.
- Support returns only inside a round: 3 goes in a row with a wrong first tap turns on full pictures for the rest of that round (`Goes.tsx:36, 155-160`); the 2nd wrong tap on a go brings the picture back for that go. The boost is not saved: the next day at the same level the help is still as the calendar says.
- Gold days (no pictures) also add fair-or-not, so two new demands arrive at once.

### 5. Progression: 2
- The order doubles to 5, halves to 10, doubles to 10, halves to 20 is sensible and matches NZ Years 1 and 2. A child never drops back; only 4 levels.
- It is too coarse. Level 1 is only 5 facts (1 to 5 doubled), asked about twice each in a 10-go round; there is no variety (no "double 0", no mixing forms like "? + 3 = 6"). Passing needs 4 of 5 facts at box 2, i.e. 2 quick correct answers each.
- No adaptive within a day: difficulty never moves inside a round. Slow but correct answers (over 5 s, normal for a 5 year old counting fish) never move a box, so such a child can be stuck on a level with no wrong answers at all, and the teacher panel won't show them as "hard" (hardest needs `box < 2` and attempts >= 2 which it would match, but only shows the 3 weakest; see Recording).
- At level 4 a child stays forever. After 30 days a new bird friend arrives with the same level 4 questions; there is nothing beyond halves to 20 (near doubles, 3x, doubles of teens). A child needing about 4 days at level 1 and 4 at level 2 would be at level 4 by about day 12 and then sees the same 5 facts for 18 more days.

### 6. Feedback: 2
- A wrong tap: the stone wobbles, Bella says "Try again!" (`words.ts:23`), no picture change on the first wrong tap. It does not show why the answer was wrong. There is no "you tapped 5, that is one more" or showing the n + 1 / n x n / n errors the wrong choices are built from.
- Second wrong: counting together helps, though Bella counts all the fish (e.g. 1 to 8) and says only numbers.
- On a right answer: Bella says the number, the penguin gulps, halves visibly share out to show fairness (`Goes.tsx:162-168`). Nice. The finish screen says "Well done! A stepping stone turned bronze!" and "Next time: halves to 10". No summary of what went well or which fact to practise.
- Fair-or-not wrong tap: "Try again", nothing shows the left-over fish.

### 7. Progress recording: 2
- Server saves are solid and tamper-proof (see below). A teacher can see: switch and class summary ("N playing · M gold shoes"), and on a student's page the days done, level reached, last played, and up to 3 hardest facts. There is no class list of who is stuck, no Today page alert, no error rate, no time per fact, no days-at-this-level, and no per-fact table in this game's panel (the hub's shared "early-facts" mastery grid may show the records; I did not find a Korora-specific link).
- The record counts only first taps, once per fact per round, which is the right thing for the leitner box. Taps (all picks and ms) are kept 30 days in `korora_rounds.taps` (a teacher cannot see these).
- The help the child actually saw (boost, hint step) is not saved, so a child who got through on the 3rd-wrong hand looks the same as one who was right first time except in `taps`.

### 8. Engagement: 3
- Clay art, a penguin who gulps and cheers, stepping stones that turn colour, dancing shoes as a goal, a new bird friend after 30 days. Pretty and friendly for 5 to 7.
- The reward is attendance-based: one stone a day for finishing, however many wrong taps. The motivation is the shoes, not the maths, and a day is 10 goes of 5 facts at level 1 (repetitive: double 2, double 4 twice each).
- Thirty days to the gold pair is very long for a 5 year old; the fade into empty "gold" days with no pictures is when it will feel hardest and the child gets the least maths help while earning the best-looking stone.
- Good: no timer on screen, no lives, no penalty.

## Specific problems found while playing

- Bronze-day halves are shared out by the game before the child does anything, so the answer is read off the nest. No thinking needed. (`Goes.tsx:100`.)
- A child can win any go by tapping stones in turn. The 3rd wrong tap shows a hand on the right number. Nothing reduces the reward for that (only the first tap is recorded).
- Fair-or-not is a 2-button 50% guess; after a wrong tap the only choice left is the right one. Gold-day pile shows just a number in a basket, and the buttons' fish icons (2 vs 3 fish) don't match the pile. The "hint at 2nd wrong" (count together) is switched off for it.
- Distractors include 25 for 5 + 5 and 100 for 10 + 10 (n squared); a child who has not learned times tables will never pick them, so they give no information, and a child who confuses doubles with multiplying is not helped to see why.
- Level 1 repeats: five facts across ten goes, so every fact comes twice (e.g. "Double 4" ... "Double 4"), and four days of that to move up.
- Help depends on days not level: day 21 at level 1 shows no pictures; the full-pictures boost is only for the round.
- Empty grey box left in the middle once bronze halves are fully shared (screenshot, "Half of 4").
- "Quick" is 5 seconds, including the 1.2 s the bronze halves spend sharing before the child can start (`since.current` is reset on each new go, `Goes.tsx:96`, and the share animation then runs 1.2 s plus 320 ms per fish). A child answering "Half of 18" gets 9 fish x 320 ms = about 4 s of animation before... (the timer runs during it), so a correct answer is rarely "quick" for bigger halves on bronze days. I did not measure this in play; it follows from the code.
- My timing script clicked during the right-answer animation (halves wait longer, `Goes.tsx:164`) and the click is ignored; a fast child can also tap during that and nothing happens, which is fine.

## What is saved on the server

- `korora_progress` (one row per pupil, `20261105000100_korora.sql:24-31`): `player`, `days_done`, `last_pebble_day`, `reached` (1 to 4), `version`, `updated_at`.
- `korora_rounds` (one row per challenge, `:33-47`): `player`, `seed`, `level`, `gold`, `goes` (jsonb, 10 items of `{key, v}`), `open`, `taps` (jsonb array of `{pick, ms}`), `mistakes`, `started_at`, `finished_at`. Finished rows over 30 days old are deleted when the pupil starts a new one (`:88-89`).
- Maths records in the shared table `gem_keep_facts` (pack `early-facts`, keys `dbl:n`, `half:n`, `oddeven:n`; columns `attempts`, `correct`, `avg_ms`, `box`, `last_seen`, `quick_days`), written by `record_fact_answers`, once per fact per challenge.
- Achievements: one per gold pair of shoes (`korora_fish` measure).
- Teacher view: Games table row (switch and "Doubles and halves · N playing · M gold shoes", `src/games/korora/teacher.ts`), drawer for the help setting (`src/pages/TeacherKorora.tsx`), and a student panel with stone counts, level reached, last played and the 3 hardest facts (`teacher_korora_student`, `:152-173`). Nothing on the Today page; no class "stuck" list.

### SQL to run on the live database (not run)

1. Levels reached and days played (how far real pupils are):
```sql
select p.reached, count(*) as pupils, round(avg(p.days_done),1) as avg_days, max(p.days_done) as max_days
from korora_progress p group by p.reached order by p.reached;
```
2. Error rate per fact (first tap is what counts, so use `gem_keep_facts`):
```sql
select fact_key, count(*) as pupils, sum(attempts) as attempts,
       round(100.0*(sum(attempts)-sum(correct))/nullif(sum(attempts),0),1) as pct_wrong,
       round(avg(avg_ms)) as avg_ms, round(avg(box),1) as avg_box
from gem_keep_facts
where pack='early-facts' and fact_key ~ '^(dbl|half|oddeven):'
group by fact_key order by pct_wrong desc;
```
3. Stuck pupils (played 6 or more days, still at the same level, a recent finish; plus mistakes per round):
```sql
select pr.full_name, p.reached, p.days_done, p.last_pebble_day,
       (select round(avg(r.mistakes),1) from korora_rounds r where r.player=p.player and not r.open) as avg_mistakes,
       (select count(*) from korora_rounds r where r.player=p.player and r.level=p.reached and not r.open) as rounds_at_level
from korora_progress p join profiles pr on pr.id=p.player
where p.days_done >= 6
order by rounds_at_level desc, avg_mistakes desc limit 30;
```
(Table and column names for names on `profiles` may differ; check before running.)

## Strengths

- The idea fits the age: a mirror for doubles, fair sharing for halves; double-then-its-half pairing; fish in fives.
- Strong support menu built in: counting with Bella, tap to count, tap to share, linked fish, hand pointer, Hear it again, and teacher option for pictures always or off.
- Safe, tamper-proof server: taps replayed against the saved round, a challenge finishes once, only the first tap of each fact counts.
- Gentle: no penalty, no timers on screen, missed days lose nothing; fully read aloud.
- Struggle response exists in round (3 wrong goes in a row brings pictures back).

## Gaps

- Fading follows the calendar, not the child's skill, and the "struggle boost" is forgotten after the round.
- Bronze halves can be answered by reading the nest the game fills; fair-or-not is a 50% guess with weak model.
- Feedback after a mistake says "Try again" only; the chosen wrong answer is never explained.
- Only 4 levels and 5 facts per level; no variety of question form, and nothing after halves to 20.
- Teacher can't see who is stuck (no class list, no alerts, no error rate or time).
- Quick-answer rule (5 s) may be harsh on counting-based answers, especially for large halves.

## Candidate improvements

1. **Link the picture help to the child's own records, not the day count.**
   - Problem: help fades by days played (`progress.ts:52-67`), and the struggle boost lasts one round.
   - Change: choose help per go from the box of that fact (0 to 1 full, 2 faint, 3+ none), with the teacher setting kept as an override; save a "needed help" flag so tomorrow starts with pictures for that fact.
   - Files: `shared/korora/progress.ts`, `round.ts` (add help per go to `GoPlan`), `Goes.tsx`, `server.ts`, tests.
   - Effort: M. Impact: high (real fading and return of support).
2. **Make the child do the sharing on bronze days.**
   - Problem: halves share themselves, so the answer is read off.
   - Change: on bronze, the child taps fish one at a time to the chicks (the half-way "tap to share" already exists on silver), with the game helping only after a wrong tap; keep auto-share for the correct-answer celebration only.
   - Files: `Goes.tsx` (`help === 'full'` branch at `:100`), css, `kororaGuide.test.tsx`. Effort: S. Impact: medium to high.
3. **Show why a wrong answer was wrong.**
   - Problem: the wrobble and "Try again" only.
   - Change: on a wrong tap of a distractor, show a short picture/line from its type (answer + 1 or - 1: "one more fish than the pool has", n itself on a half: "that's all the fish, we need one chick's"), say it in Bella clips; for halves show the nest count against the pile.
   - Files: `round.ts` (tag each choice with its kind from the pack), `words.ts`, `voiceLines.ts`, `Goes.tsx`, new voice clips (`scripts/voice-clips.py korora`). Effort: M. Impact: high.
4. **Rebuild fair-or-not.**
   - Problem: 2 choices, no pile, mismatched icons.
   - Change: show the real pile of fish (as halves do), let the child tap fish out two at a time, or make it a drag-two-by-two model; use a hint at the 2nd wrong tap; show the odd fish glowing. Consider 3 choices ("fair", "one left over" plus a number-of-pairs question).
   - Files: `Goes.tsx` (Share, `:236` and `:147`), `words.ts`, css. Effort: M. Impact: medium.
5. **More levels and more question forms.**
   - Problem: 4 levels, 5 facts each, nothing after halves to 20.
   - Change: add "double 0", near doubles (6 + 7 from 6 + 6), missing-number forms (`? + ? = 8`, `8 is double ?`), then doubles of teens or "half of 30" and double-and-halve chains. Needs a shared-maths branch.
   - Files: `shared/maths/skillPacks/earlyFacts.ts`, `shared/korora/round.ts`, `migration` (`reached` check 1 to 4, `:28`), `words.ts`, tests. Effort: L. Impact: high.
6. **Give the teacher a "who is stuck" view and a Today alert.**
   - Problem: only 3 hardest facts, no list, no alert.
   - Change: add a class RPC `teacher_korora_class_detail` (per pupil: level, rounds at level, days since last played, average mistakes per round, hardest facts) and show it on the Games drawer; an alert when a pupil has 5 or more rounds at one level or is not progressing.
   - Files: new migration, `src/data/korora.ts`, `src/pages/TeacherKorora.tsx`, Today alerts file. Effort: M. Impact: high for James.
7. **Let slow but right answers count.**
   - Problem: boxes move only for quick answers (5 s), and the bronze share animation eats the clock.
   - Change: start the clock when the animation ends; give early-facts a longer quick time (for example 8 s as `generated`); count a right first tap that is slower as "learning" progress (level by days at ≥70% correct).
   - Files: `shared/maths/config.ts`, `Goes.tsx` (`since.current`), tests. Effort: S. Impact: medium.
8. **Better distractors.**
   - Problem: n squared (25, 100) does not teach a doubles mistake.
   - Change: for doubles use +1, -1, n + 1, 2n + 2... and "n" itself (forgot to double); for halves keep n and half + 1; only use n x n above times-tables level. Edit the shared pack once, so other games stay consistent (check tests).
   - Files: `shared/maths/skillPacks/earlyFacts.ts:65`, tests. Effort: S. Impact: low to medium.
