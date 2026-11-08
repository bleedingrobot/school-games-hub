# Parrot's See-saw: second review (blind)

Game id `parrot`. New game (not in the first review). Maths idea: the equals sign as a balance ("the same amount"), and missing numbers.

**How this was evaluated.** I read all the code (src/games/parrot, shared/parrot, the server handler, both migrations, the shared kit parts it uses). Then I **played it in the browser** on a built copy of the preview (port 5309, own tab): the first go as a brand-new pupil with no adult, right answers, one wrong tap, two wrong taps (look together), a stone go with a wrong Check, the tap-everything finish of two whole challenges (a stone round and a card round), and sampled screens at step 2 level 3 (cards), step 3 level 1 (Peek), step 4 level 4 (stones on Check), step 5 level 0 (true or false) and step 6 level 3 (subtraction). I could not listen to the voice (no sound in the tool) and I only played day 1 and day 2, so "keep going until difficulty moves" was checked with the preview's step and level buttons and in a code simulation (real `makeRound`/`replay`, run in a throw-away script, not kept), not by earning the changes. Tags below: **seen** (in the browser), **sim** (shared code, not on screen), **code** (read only). Where an earlier line of this file said "code only" it has been replaced with what I saw.

## Is it really switched on? (the "In development" sticker)

Yes, in the code it is fully on. The sticker is only a label, nothing hides the game because of it:
- `src/games/parrot/index.tsx:44` sets `inDevelopment: true`, and `src/components/GameCard.tsx:93` only draws the "In development" chip from that flag.
- `src/games/parrot/switch.ts:8` has `const PARROT_ON = true;` so `parrotOn()` is always true. `src/games/registry.ts:73` adds the game when `parrotOn()`.
- The per-class switch is `app_settings.parrot_enabled` with `default true` (supabase/migrations/20261107000500_parrot.sql, the `alter table ... add column parrot_enabled boolean not null default true` line). The card hides only if a teacher turns it off; the server also refuses with 403 `game-off` (shared/parrot/server.ts:120).
- Whether that migration has been applied to the live database I did not check (not allowed to run queries). The code needs `parrot_progress`, `parrot_rounds` and the widened `gem_keep_facts_fact_key_check` (20261107000800_parrot_keys.sql) to be live, or the server function fails on start and the home-card chip.

## How it works

Each day a child gets a ten-go "challenge" at Parrot's see-saw. Each go is an equation with a missing number that must keep the see-saw level, for example `8 = 5 + ?`. At help levels 5 and 4 (the stone levels) the child taps a heap to add stones to the empty pan and presses Check; at level 5 the see-saw tilts live as each stone lands. At lower help (levels 3 to 0) the child picks one of four number cards, with numbered weights on a see-saw (3), a small see-saw (2), a Peek button (1) or the equation alone (0). From step 5 some goes are "tips left / level / tips right" for a true-or-false sum. A wrong tap shows a short line and a small see-saw with the child's wrong number placed; a second wrong tap runs "Let's look together" (counting each side), then two cards with the right one marked. The server makes the round, replays the taps and moves the child's step and help level. The first finish each NZ day turns one of ten shiny things on a bell rope (30 days to a Golden Bell, then a friend's see-saw). (read in code, home screen seen)

## The maths

Six steps (shared/parrot/config.ts:26-33, shared/parrot/round.ts:51-58). Keys in shared/maths/skillPacks/equalsKeys.ts:

| Step | Name | New thing | Keys |
|---|---|---|---|
| 1 | Fill the gap | `a = b + ?` (a 3 to 10) in layout 0 only, all 10 goes new | 36 `eqmiss` keys (equalsKeys.ts:13-17) |
| 2 | Turn it round | same keys in layouts `b + ? = a`, `? + b = a`, `a = ? + b`; 3 review goes at layout 0 | `eqmiss` (round.ts:157, 164) |
| 3 | Swap places | `x + y = y + ?` (x,y to 7); review `eqmiss` | 21 `eqswap` (equalsKeys.ts:20-24) |
| 4 | Both sides | `a + b = c + ?` to 20; review swap and miss | 30 `eqboth` (equalsKeys.ts:26-37) |
| 5 | Level or not? | true or false `a + b = c + d` via three buttons; review both and swap | 30 `eqtf` (equalsKeys.ts:48-60) |
| 6 | Take away | `3 = 8 − ?` and `9 − 4 = 2 + ?`; review tf and both | 20 `eqsub` (equalsKeys.ts:38-41) |

- A round is 10 goes: step 1 all new; later steps 7 new and 3 earlier (round.ts:139, config.ts:9), weakest Leitner box first, same key not twice in a row where possible (round.ts:97-107, 130-132).
- **Who starts where:** 5 or more "make 10" pairs at Leitner box 2 and some adding done starts at step 3, help level 3; everyone else at step 1, level 5 (round.ts:73-77, config.ts:14-15).
- **Next step:** a step is passed after 2 good challenges (8 or more of 10 right at the first tap) at that step; the step never goes back (config.ts:12 `goodToPass: 2`; kit `placeAfter` in shared/kit/help.ts). Step moves only on the day's first finish (server.ts:167). A new step puts help up by two.
- **Next help level:** two good challenges in a row take help down one; a hard one (4 or fewer) takes it up one at once (help.ts:71-82, `ROUND_OF_TEN`). Inside one go, one wrong tap lifts the go's level by one, two wrong taps put it at 5, and three goes in a row wrong at the first tap keep level 5 for the round (round.ts:239-247, Goes.tsx:276).
- Teacher setting `parrot_help` Fades/Always/Off: Always shows level 4, Off shows level 0 and hides Peek (round.ts:79-80, 241-246).
- The first go for a brand-new pupil is always the fixed `5 = 2 + ?` at level 5 with a pointing hand (round.ts:90, 129-130, Goes.tsx:179).

## Scores (each 1 to 4)

**1. Maths fidelity: 3**
- The stone goes (levels 5 and 4, on `eqmiss`, `eqswap`, `eqboth`) are the idea itself: the child builds the missing amount until the see-saw levels, and the equals sign is the pivot. Code (round.ts:177, Goes.tsx:309-315); sim: 10 of 10 goes are stone goes at level 5 in steps 1 to 4.
- Card goes have a guessing loophole (sim, see Problems 1). In the four cards, two are numbers already printed in the equation (the "copy" and "total" wrong cards, round.ts:197, 203, 209) and one is always the largest (the "all" card). The right number is the one not written on the page and is never the biggest card. Sampled round (step 3, level 3): `7 = 2 + ?` cards 2,5,7,9, answer 5 (2 and 7 are printed, 9 is the sum 2+7).
- True or false has only 3 buttons (1 in 3 by luck) and no tilt picture after a wrong tap (Goes.tsx:134-141).
- Subtraction see-saw uses "minus" blocks in a pan (Goes.tsx:60-71), a harder model for 5 to 7 year olds; seen at step 6 level 3: the blocks in the pan read clearly once Bella has said it, but a 5 to 7 year old still needs the voice.
- Not a 4: guessing "which number isn't on the page" works on most card goes.

**2. Clarity: 3** (seen and code)
- Voice for everything, "Hear it again" always visible, one thing per screen, no timers, a first-time tip and a guided first go with a pointing hand. Code (ParrotGame.tsx:145-149, Goes.tsx:303, 179-203); home screen seen with the two-part tip.
- No text a child must read: the goal at stone levels is only said aloud (`stoneLive`) and shown by the empty gap (words.ts:62). With Voice off a pre-reader has the see-saw and a heap with +1, which is readable but the "Check" label is text (code).
- "Tips left" means "left side heavier" (round.ts:206), and the three tilt buttons are worded not drawn only; a child could read "tips left" as which side goes up. Seen: the three buttons are words with small arrows; fine for readers, worded for the rest.
- **Seen:** the numbered see-saw (cards, levels 3 to 1) is drawn flat (level) even when the sum is NOT equal, and a false true-or-false statement is shown with an "=" between the pans. After a wrong true-or-false tap the picture keeps that level look, which is the opposite of the lesson (Goes.tsx:134-141).
- Stone play needs many taps (one tap per stone, up to 20); no drag (Goes.tsx:283). Fine for tablets, slow for a 10 stone go.
- Seen: buttons and cards are large and easy to hit; the preview tools panel (preview only) overlays the see-saw; stone piles at big sums (about 17) are small and dense and hard to count, with no equation shown to help.

**3. Support and structure: 3**
- A model is always available at the start (stones and see-saw at levels 5 and 4), Peek at levels 1 and 0, and help appears automatically after a wrong tap. Code (Goes.tsx:324-329, 331-335).
- A demonstration only for the very first go (guided, `useGuidedFirstGo`, Goes.tsx:179), not the first time step 4 (both sides), step 5 (true or false, three buttons) or step 6 (subtraction) appears. `newStepHelp: 2` brings the picture up but not a worked example. Item 9 is only partly met.
- After each right go Bella says a model sentence ("Eight is five plus three.") (voiceLines.ts:61-69, Goes.tsx:278).

**4. Fading: 4** (code and sim; the level buttons were seen to change the picture as described; borderline)
- Six help levels, 5 to 0, each a different picture (stones live, stones on Check, numbered weights, small see-saw, Peek, equation only). Fades by 1 after 2 good challenges, returns by 1 at once after a hard challenge, plus 2 on a new step; per-go lifts after wrong taps and a three-in-a-row struggle rule (shared/kit/help.ts:71-82, round.ts:239-247).
- Teacher Off/Always for children who need none or all. Help is for the child, not per fact kind (one level for all kinds), but new steps push help up so it works as per skill in practice.
- Never saw it fade on screen; confirmed in code and by `replay` sim only.

**5. Progression: 3**
- Research-ordered steps: stones, then one missing number in 4 layouts, then swap, then two sums either side, then true or false, then subtraction. Weakest keys first; step passes need 2 good challenges; 3 review goes of earlier kinds. Code (round.ts:57-58, 139).
- Difficulty is adapted mostly through help, not through the maths: within a step the keys are random over the whole key list (e.g. all `eqmiss` 3 to 10), so a child sees both easy and harder sums with no aim at 75 to 90 percent. Step 2 repeats step 1's keys, only in other layouts.
- Steps 5 and 6 add a new response type (3 buttons) or subtraction as the "new" 7 goes, so the jump is big; review is only the previous kinds (step 6 reviews tf and both, not miss or swap). Older steps do not come back after 2 steps.

**6. Feedback: 3**
- Wrong tap 1: a short why line by slip kind (all, copy, total, off1, dbl, near, both, first, side) spoken and written, with a small see-saw showing the wrong number in the gap, tipping. Code (words.ts:30-42, Goes.tsx:134-141, 331); this matches rubric item 17 on card goes.
- Wrong tap 2: count each side together, then a redo with the right card marked and a pointing hand. Another go is given, not just the answer. Item 18 met. But the redo card is shown marked, so the child just taps the marked card; there is no thinking (Problem 2).
- Stone goes: a wrong Check count has no card number so `kind` is "near" and the line is the generic "Not quite. Does it make both sides the same?" (Goes.tsx:265, words.ts:41). At level 5 the see-saw already shows it live.
- True or false: the why picture "stays still" (Goes.tsx:134-137), so the tilt is not shown with the same model.
- Praise: "Well done!" and "A little less help next time" are generic, no strategy-specific praise ("you counted both sides").

**7. Progress recording: 3**
- Per fact key (first tap only): correct, attempts, ms, Leitner box in `gem_keep_facts` via `recordAnswers` (shared/parrot/server.ts:170-174, kit replay.ts:53-65). Progress per pupil: step, level, good_in_row, good_at_step, days_done, last_day (migration lines for `parrot_progress`).
- Every pick, with ms, is kept in `parrot_rounds.taps`, so the wrong number actually chosen is saved for every go, plus `slips` = the slip kind of each go's first wrong pick (play.ts:25-37) and each go's planned help level `l` in `round`. Item 21 met.
- Teacher can see: pupil line and panel (step, help level, usual slip over the last 10 challenges, 3 hardest keys). Not in the Foundational class grid or Today alerts (src/teacher/foundational/config.ts `GAMES` has no `parrot`), so there is no "who is stuck" or "who has not played" view across the class. Item 22 only partly met.
- Help used per go is in the round JSON but is not summarised for the teacher.

**8. Engagement: 3**
- Fun is mostly the stone/see-saw action and the voice and painted clay art; the rope of ten shiny things and a Golden Bell are decoration. A shiny thing changes on any finished challenge, even with 0 of 10 right (server.ts:166-170, `finishChallenge` does not look at `firstRight`) so the reward pays for finishing, not for the maths. A random tapper still collects it.
- Choices: only Voice on/off and, afterward, a Play again button; no child choice of step, no choice of friend.
- Clear learning goal (a teacher can ask "how did you know it was level?"); no social features, no ranking.

**Total: 25 of 32** (3, 3, 3, 4, 3, 3, 3, 3). Scored on what the code does and a partial play; I was not able to play it by hand.

## The 25-item checklist

| # | Item | Result | Note |
|---|---|---|---|
| 1 | Maths action is the game | yes | stone goes build the missing amount (code, sim) |
| 2 | Cannot win by guessing or tapping | partly | cards: not-printed-number tell; tf 1 in 3; reward ignores score |
| 3 | Representation matches idea | yes | see-saw with equals as pivot; subtraction blocks less clear |
| 4 | Pre-reader can start alone | yes | voice, tip, guided first go, pointing hand |
| 5 | One question, one action | yes | one go at a time; friend picture is decoration |
| 6 | Big targets, no timer, short | yes | 10 goes a day, no timer; sizes seen, large |
| 7 | A model is available | yes | stones/see-saw at 5 to 3, Peek at 1 to 0 |
| 8 | Help appears automatically | yes | why line, look together, struggle rule |
| 9 | Worked example the first time | partly | only the very first go |
| 10 | Support reduced in steps | yes | six levels |
| 11 | Support returns on failure | yes | hard challenge +1, new step +2, per-go lift |
| 12 | Expert not slowed | partly | fades after 2 good days; Off setting; Peek hidden at 0 |
| 13 | Research-ordered difficulty | yes | stones, layouts, swap, both sides, tf, subtraction |
| 14 | Adapts toward 75 to 90 percent | partly | help adapts; keys in a step are random |
| 15 | Old skills return, mixed | partly | 3 review goes of the previous kind(s) only |
| 16 | Move-up needs steady success | yes | 2 challenges of 8 or more |
| 17 | Shows what went wrong, same model | partly | yes on card goes; generic for stones; none for tf |
| 18 | Another go with help | yes | redo with two cards, right one marked |
| 19 | Praise about effort, kind | partly | kind and no red cross; generic, not strategy praise |
| 20 | Server saves per skill: attempts, level, help, time, date | yes | facts, progress, rounds with taps and ms |
| 21 | Wrong answer chosen saved | yes | all picks in `taps`, `slips` per go |
| 22 | Teacher sees who is stuck/not played | partly | pupil page only; not in the grid or Today |
| 23 | Rewards decorate success | partly | day reward given for any finish |
| 24 | Choices and visible growth | partly | rope and step are visible; almost no choice |
| 25 | Clear goal, active thinking | yes | "make it level"; counting each side |

## Problems found (worst for learning first)

1. **Card goes can be won by "pick the number that is not in the sum".** Steps: start a pupil at step 2, level 3 (or use the preview tool: step 2, help level 3) and look at `7 = ? + 2` with cards 2, 5, 7, 9. 2 and 7 are printed, 9 is the sum of the printed numbers, 5 is the answer. The rule works for `eqmiss`, `eqswap`, `eqboth`, `eqsub` cards in the sim (round.ts:197-228). The answer is also never the largest card. A child who learns this finishes without thinking about balance. This is the main loophole. Fix: make a wrong card that is not printed and a right answer sometimes equal to a printed number; always test the tell (docs/LEARNING-DESIGN.md Rule 1 limit of 2 shared tells).
2. **Tap-all finishes a day and earns the reward.** In the sim, tapping every choice in turn finished all steps with `firstRight` 0 to 3 and `done true`. The cost is a few extra taps per go: after 2 wrong taps, Parrot counts and the redo shows the right card marked with a pointing hand (Goes.tsx:249-263, 360-371), so the child taps it with no maths. The only costs are help going up by 1 (hard challenge) and a wrong fact record. The day, the shiny thing and the Golden Bell progress still happen (server.ts:166-176). Steps: play any go, tap the wrong cards until "Now you try!".
3. **No worked example for new kinds of go after the first go.** A step 5 child meets three buttons "Tips left / Level / Tips right" and `a + b = c + d` for the first time with only the generic voice line (voiceLines.ts:44-47) and the help level reset. Check by choosing step 5 in the preview tools.
4. **True or false is the weakest part.** Only 3 choices (random 1 in 3); wrong tap does not tip the see-saw (Goes.tsx:134-141); the `both` and `side` slip lines are generic; the answer is "tips left/right" by which side is heavier but no picture with weights is shown at level 0 until a wrong tap. Item 17 partly met here.
5. **Stone goes get a specific line only when the count happens to equal a wrong card** (seen: a count equal to the printed number or the total got the matching why line). Any other count gets the generic "Not quite. Does it make both sides the same?" (Goes.tsx:265). Level 5 hides this because the tilt is live.
6. **Stone play is one tap per stone, up to 20.** `5 = 2 + ?` needs 3 taps, `11 + ? = ...` up to 9; no drag or add-5 button (Goes.tsx:283). Slow for the biggest sums but it is also what makes the counting real.
7. **Not in the class teacher view.** `foundational/config.ts` `GAMES` has no `parrot`, so no "stuck", "guessing" or "gone quiet" flag; the teacher must open each pupil.
8. **Reward ignores correctness** (see Score 8). Minor, since the game is kind by design.
9. **Seen: the numbered see-saw is flat and the "=" is shown for a false statement** (cards at levels 3 to 1, and after a wrong true-or-false tap). The picture says "level" when it is not. Fix: tilt it when the sum is unequal, or hide the picture until it is true.
10. **Seen: the redo's second card is the obvious huge "all" card**, so the redo is two cards of which one is absurd plus the hand-marked right one: no thinking.
11. **Seen: stone piles at larger sums (about 17) are tiny and dense**, hard to count; no equation is shown at level 5 to anchor them.
12. **Seen: the tell is not printed for miss, both and sub cards, but swap shows the answer's neighbour once**, which confirms Problem 1 across the card kinds.
13. **Seen: praise "Well done! A shiny thing turned bronze!" was given after a finish by tapping everything** (confirms Problem 2).
14. **Seen: "Let's look together" takes about 8 seconds** with no skip; fine for a 5 year old, slow for a repeat.
15. Minor: `STEP_RULES` `newStepLevel: 0` with `newStepHelp: 2` can push help to level 2 only for a child at level 0 (kit rule) so a new step may arrive with little picture after step 3's equation-only; still sim only.

## Saved per child on the server

- `parrot_progress` (one row per pupil): `days_done`, `last_day`, `step`, `level`, `good_in_row`, `good_at_step`, `version`, `updated_at`.
- `parrot_rounds` (one row per challenge): `seed`, `round` JSON (every go's `key`, layout `v`, planned help level `l`, plus `step`, `level`, `help` setting), `taps` JSON (every pick and its ms), `mistakes`, `first_right`, `slips` (the slip kind of each go's first wrong pick, null if right first), `started_at`, `finished_at`. Finished rounds over 30 days old are deleted when a new one starts.
- `gem_keep_facts` (first tap per key per challenge only): `fact_key` like `eqmiss:8=5+?`, correct, attempts, Leitner box (pack `early-facts`; ladder skills `balance-10`, `balance-20`, `true-false`, all `inAuto: false`).
- The wrong choice and the help level are saved (in `taps` and in `round.goes[].l`), but not as columns, so they take JSON queries. The teacher's pupil page shows step, help level, last played, days, usual slip (copy, total, all only) and the 3 hardest `eq` keys. Hardest across the class, Today alerts and the class grid: none for Parrot today.

Read-only SQL James could run (not run by me; the CLI hangs, use the Management API as in memory):

```sql
-- 1. Where each pupil is: step, help level, days done, last played
select p.player, p.step, p.level, p.days_done, p.last_day, p.updated_at
from public.parrot_progress p order by p.step desc, p.days_done desc;

-- 2. Slips by kind over the last 14 days (what kind of wrong first tap)
select s.kind, count(*) as n
from public.parrot_rounds r, lateral jsonb_array_elements_text(r.slips) s(kind)
where r.finished_at > now() - interval '14 days' and r.slips is not null
group by s.kind order by n desc;

-- 3. Hardest equals keys across all pupils (at least 6 answers)
select g.fact_key, sum(g.attempts) as tries, round(100.0 * sum(g.correct) / sum(g.attempts)) as pct_right
from public.gem_keep_facts g where g.fact_key like 'eq%'
group by g.fact_key having sum(g.attempts) >= 6 order by pct_right limit 15;

-- 4. Challenges with a lot of wrong taps (possible tap-all)
select r.player, r.finished_at, r.mistakes, r.first_right
from public.parrot_rounds r where not r.open and r.mistakes >= 15 order by r.mistakes desc limit 30;
```

## Strengths

- The equals sign is taught as a balance with a real model (see-saw, stones, live tilt), filling a gap the first foundational games left (plan N2, gap 2). (code)
- Server makes and replays every round; only picks go to the server; first tap only counts (server.ts, replay.ts).
- Wrong cards are named slips (copy, total, all, off by one), so a wrong tap tells a teacher the misconception; why-line and picture shown. (code, sim)
- Help follows the child: six levels, steps, two good challenges to fade, a hard one to return, struggle rule, teacher Off/Always.
- Kind and calm: no red cross, no timer, no points, no ranking; voice and painted art; a guided first go that cannot fail.
- Teacher panel shows the child's usual slip, which is the most useful single fact for this idea.

## Gaps

- Card goes have a not-printed-number tell; true or false has 3 buttons.
- Tap-all still finishes and earns the day's reward.
- No worked example for new kinds after the first go; the redo marks the answer.
- Not in the Foundational class grid or Today alerts; slip is only copy/total/all.
- True or false and stone-count mistakes get generic feedback; praise is generic.
- Within a step the keys are random over the whole list, so success is not steered to 75 to 90 percent.
- Not heard: the voice (no sound in the tool). Played only days 1 and 2 by hand; later days and the fade over many days are sim and code.

## Candidate improvements

1. **Remove the "not printed" tell.** Problem: answer is the only card not in the sum and never the largest. Change: pick wrong cards so that sometimes the right answer is also a printed number or the biggest card (e.g. add an "answer plus 2" card, drop "all" half the time), and add a test over every key that the answer has no fixed tell. Files: shared/parrot/round.ts (`showGo`, `pickWrongs`), shared/parrot/parrot.test.ts. Effort S to M. Impact: High, it makes the card goes need the maths.
2. **Stop the redo giving the answer.** Problem: after 2 wrong taps the right card is marked with a hand. Change: at redo, run the counting and then ask the child to put stones or tap without the hand at high levels, or make redo a stone go; keep the hand only for the guided first go. Files: Goes.tsx (`redoCards`, `hint`), round.ts. Effort S. Impact: Medium to High.
3. **Make the day's reward depend on real work.** Problem: 0 of 10 right still turns a shiny thing. Change: turn a shiny thing only when 5 or more goes are right at the first tap or when the challenge was finished without the cap, else a "try again tomorrow" shiny thing that stays. Needs James's choice; discuss against the kit's day arc. Files: shared/parrot/progress.ts/server.ts, shared/kit/dayArc.ts (shared, own branch). Effort S to M. Impact: Medium.
4. **A short demo the first time each new kind appears.** Problem: steps 4, 5, 6 start cold. Change: reuse `useGuidedFirstGo` and `FirstTimeTip` for a three-line demo (a see-saw with weights tipping, then level) once per kind, stored with the pupil's saved step. Files: Goes.tsx, words.ts, voiceLines.ts, parrot.css, maybe server `reached` per kind. Effort M. Impact: High for true or false.
5. **Make true or false show its model.** Problem: no tilt after a wrong tap; 3 buttons. Change: after a wrong tap, show the numbered see-saw tilting the right way (weights on each pan), and add a fourth distractor action or "how much heavier?" follow-up so a guess costs more. Files: Goes.tsx (`WhyPicture`, `Weights`), round.ts. Effort M. Impact: Medium to High.
6. **Name the slip for a stone count.** Problem: generic line on a wrong Check. Change: map the count to a slip (equals the total, equals the number beside it, equals everything) and use the same why-lines. Files: round.ts, Goes.tsx. Effort S. Impact: Medium (feedback and teacher data).
7. **Put Parrot in the Foundational teacher view.** Problem: no "stuck" or "gone quiet" flags. Change: add `parrot` to the `FoundationalGameId` list, `GAMES` words (steps), the `ENABLED` map and the class query. Files: src/teacher/foundational/config.ts, alerts.ts, src/data/foundational.ts, a migration function for class rows. Effort M. Impact: High for the teacher.
8. **Steer the keys inside a step to about 80 percent.** Problem: a step shows easy and hard keys at random. Change: choose the 7 new goes from the child's weakest and a few secure keys in a ratio that aims at 8 of 10; add review goes from steps older than the previous one. Files: round.ts `makeRound`, config.ts. Effort M. Impact: Medium.

## Learning-design rules (read after the scores)

| Rule | Met? | Evidence |
|---|---|---|
| 1. The maths is the move | partly | stone goes yes; card goes have a not-printed tell (Problem 1) and a 2-card tell (copy and total printed); free taps are capped at 2 (Goes.tsx:246) but the redo marks the answer; first tap only counts (replay.ts) |
| 2. One thing at a time, voice first | met | voice lines for every go (voiceLines.ts), Hear it again, tip, no timers; stone goal said aloud only; button sizes not checked by eye |
| 3. Concrete, picture, number | met | stones, see-saw weights, small see-saw, equation (levels 5 to 0, Goes.tsx:318-322); subtraction blocks not shown to me |
| 4. Help arrives by itself | partly | why line, look together, struggle rule (Goes.tsx:246-267, 276); a demo only for the first go, not each new kind |
| 5. Help follows the child | met | `placeAfter` and `fadeAfter` (shared/kit/help.ts), start step/level from earlier records (round.ts:73-77), Fades/Always/Off |
| 6. Progression | partly | researched steps and mastery of 2 good challenges; no steering to 75 to 90 percent inside a step; only the previous kinds are reviewed (round.ts:57-58) |
| 7. Mistakes teach | partly | named slips with a why picture on card goes (words.ts:30-42); generic for stones, none for tf (Goes.tsx:134-141) |
| 8. Fair timing | partly | the clock restarts after the voice ends (Goes.tsx:199-201); I did not check the junior quick-answer value used in the records, and the 2-tap cap; no visible timer |
| 9. Record evidence, show the teacher | partly | taps, slips, level, step, facts saved; pupil page shows slip and hardest; not in the class grid or Today |
| 10. Fun from the maths; rewards for real success | partly | see-saw and stones are fun; rope reward is given for any finish (server.ts:166-176) |

**Game kit use** (checked in code, docs/plans/GAME-KIT-PLAN.md):
- Uses: `shared/kit/help.ts` (fade rules, steps, Fades/Always/Off, struggle goes), `shared/kit/mistakes.ts` (`tagWrongs`, `stepGo`, `NEW_GO`), `shared/kit/replay.ts`, `shared/kit/dayArc.ts` (rope), and in the screens `FirstTimeTip`, `HearAgain`, `PointingHand`, `ShowWhy` (with `LookTogether`, `NowYouTry`, `useLookTogether`), `useGuidedFirstGo`, `WhatsNext`, and `voiceLinesSuite` in the voice test.
- Could use but does not: `shared/kit/teacherGrid.ts` and the Foundational teacher wiring (no `parrot` in src/teacher/foundational/config.ts), `atMostShareTell` and `sharingTell` from `mistakes.ts` to stop the answer having a tell (not called in round.ts), and the kit's `TenFrame`, `NumberLine`, `DotPicture` (not a fit for a see-saw, but a ten-frame could show the "stones" for small sums). The game also draws its own `SeeSaw` and `StoneHeap` in art.tsx (305 lines) rather than from the kit.
