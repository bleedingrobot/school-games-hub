# Penguin Pairs (Kororā): second review, 8 Nov 2026

Maths idea: doubles and halves (then near doubles, and "fair or not" on gold days). Folder `korora`. Played in the preview at http://localhost:5303/ (a pretend server in the browser, the real rules). I could not hear the voice (no audio in the browser tool), so "voice" evidence is **code only** (256 clips exist in `public/voice/korora/`, every line routed through `say` in `src/games/korora/voiceLines.ts`). "Faint" picture help was read in code, not seen. Everything else marked "seen" was played.

Blind rule kept: I did not open the first review, its scores, the old plans `R*.md`, or anything with an earlier score. One slip to report: I opened `docs/LEARNING-DESIGN.md` while still gathering evidence, before writing this file (the task says after). I had already decided the scores from play and code, and nothing in it changed them, but it is a deviation.

## How it works

Two-Shoes, a little blue penguin, wants to cross a row of ten stepping stones to win dancing shoes. Each day the child does ten goes. A **double** shows fish on a rock and the same fish reflected upside down in the still water ("Double 3 = ?" or "3 + 3 = ?"). A **half** shows a pile of fish to share between two chicks ("Half of 12 = ?"). The child taps one of four grey pebbles. A wrong pebble greys out and a small picture explains the mistake; a second wrong pebble starts "Let's look together" (Bella counts the fish), then "Now you try" with the pebbles shuffled. Level 5 is near doubles (7 + 8: the double and one more fish). On gold days (days 21 to 30 of a crossing) the last two goes are "fair or not?": the child shares a pile into two bowls two fish at a time and says whether it is fair, one too many or one too few. The first finish each NZ day turns one stone bronze, silver, then gold; ten stones is a pair of shoes; 30 days is the gold pair, then a new bird friend.

## The maths

Question types and levels (`shared/korora/round.ts:34-40`):

| Level | Facts (5 each) | Key |
|---|---|---|
| 1 | Doubles of 1 to 5 | `dbl:1`..`dbl:5` |
| 2 | Halves of 2, 4, 6, 8, 10 | `half:n` |
| 3 | Doubles of 6 to 10 | `dbl:6`..`dbl:10` |
| 4 | Halves of 12 to 20 (evens) | `half:12`..`half:20` |
| 5 | Near doubles 5+6, 6+7, 7+8, 8+9 (Weka's `add:` keys) | `add:n+n+1` |
| gold days | Fair or not, piles 6 to 10 (levels 1 and 2), 6 to 20 (3 and up) | `oddeven:n` (`round.ts:60-64`) |

- **Which level today:** the first level at or above the furthest reached whose facts are not secure; secure means 70% of its 5 facts (so 4 of 5) are in Leitner box 2 or more (`levelFor`, `round.ts:86-90`; `STEP_SECURE_SHARE = 0.7`, `shared/maths/selector.ts:60`). The server keeps the furthest level and never drops it (`shared/korora/server.ts:136-140`). At level 5 the child stays there.
- **The round** (`makeRound`, `round.ts:213-243`): today's 5 facts once each, then the weakest again to make 10; from level 2, 3 of the 10 goes are the weakest facts from earlier levels (`REVIEW_GOES = 3`). A double is placed just before its half when both are in the round ("Double 6 is 12. So what is half of 12?", `pairUp`, `round.ts:185`). Gold days swap the last two goes for fair-or-not. The first ever go is always double 2 (`round.ts:49`, `GUIDED_KEY`). I ran 400 seeds per level in a throwaway test (deleted): no round ever had the same fact twice in a row.
- **Wrong choices** (`mistakeChoices`, `round.ts:266-293`): doubles offer n (forgot to double), n+1, n+2, or a miscount; halves offer n (did not share), n-2, 2n (doubled instead), or a miscount; near doubles offer 2n (no extra fish), 2n+2, or off by 2. No n x n. At most two of the four choices share the right answer's odd/even.
- **Only the first tap of a fact in a round counts** for the records, and a fact asked twice in a round counts once (`shared/korora/play.ts:40`). A correct answer only moves a fact up a box if it is quick (10 s, `JUNIOR_QUICK_MS`, clock starts after the voice finishes: `Goes.tsx:147-150`).

## Scores (1 to 4)

**1. Maths fidelity: 3**
- The action is the maths: tapping the number of fish in a mirror or share picture, representations are correct (rows of five like a ten-frame, reflection reversed so the pairs line up, `Goes.tsx:369-381`). Seen.
- Guessing does not advance anyone: the random tapper (tap every pebble in turn, one round: 33 taps, 23 wrong) finished both rounds but stayed on level 1 with 0 or 1 correct per fact. Seen, and the saved facts confirmed it (`dbl:3`, `dbl:4`, `dbl:5` all 0 correct).
- Loophole 1: a round can be finished with no maths (after 2 wrong taps the pebble count shrinks and after 4 the hand points at the answer, `Goes.tsx:281-283`). The cost is only that the fact is marked wrong. The stone still turns, so the day's reward is paid for finishing, not for being right. Seen.
- Loophole 2: on a new fact (full help) a half shares itself out before the child does anything, so each chick visibly holds the answer (2 and 2 for half of 4); the child only has to count one chick (`Goes.tsx:157`). Seen. The "full" picture of a double also lines the fish up, but the child must still add.
- The near-double picture shows 7 fish on the rock and 8 in the "reflection" (one glowing extra fish), so the water is not a true reflection there. Correct maths, slightly muddled metaphor. Seen.

**2. Clarity: 3**
- Voice on by default, "Hear it again" always visible, no timer, 4 big pebbles (width `clamp(76px, ...)`, `korora.css:13`), the same place every go, a number question printed at the top. The first ever go has a pointing hand (`Goes.tsx:283`). Code plus seen layout.
- Home and finish screens are simple: one button each. Seen.
- Fair or not is wordy for a pre-reader: "15 fish: share them, then fair or not?" printed, and choices "Fair share / One too many / One too few" with fish icons. The answer buttons are greyed until the pile is shared. Seen. The pairing-off hint and the idea of "one too few" (never right) add noise.
- The "why" panel and the "Let's look together" panel sit over the lower scene and cover Two-Shoes and the water edge. Seen (screenshots). Fish are small (about 40 px at 800 px wide) and the "rock" and "water" boxes sit over busy painted hills.

**3. Support and structure: 3**
- A model is always there for a new fact: mirror pictures and fish in rows of five; halves slide fish to two chicks; tapping a fish counts it (`Goes.tsx:239-250`). Seen.
- Help arrives by itself: wrong tap 1 shows a picture and line, wrong tap 2 is "Let's look together", then a pointing hand (`shared/kit/mistakes.ts`, `Goes.tsx:195-250`). Seen. There is no help after a long pause, only after taps.
- A demonstration only on the very first go of all (double 2, hand points to the rock, the water, the answer). The first halves go (level 2), first near double (level 5) and first fair-or-not (gold day 21) have no demonstration of their own beyond the full picture. Code (`Goes.tsx:132`, `KororaGame.tsx:107`) and seen.

**4. Fading: 4** (silver "faint" picture read in code only)
- Per fact, not per calendar: full until the fact is box 2 and quick on two different days, faint until box 4 and 6 right, then none (`HELP_LADDER`, `round.ts:101-106`; `shared/kit/help.ts` `helpForFact`). The server saves each go's `h` in `korora_rounds.goes`, so browser and replay agree. A new level's facts start full (seen: after jumping to level 2 every half was full; at "off" setting doubles showed only fish on the rock and a blank pool).
- Support returns: a wrong first tap drops the fact to box 1 so its full help comes back next time (`leitner.ts:55-58`); three goes in a row with a wrong first tap bring the full picture back for the rest of the round (`Goes.tsx:204-216`, `STRUGGLE_GOES = 3`). Seen for the three-in-a-row case in the first round (every go was already full there, so the "pictures are back" line is not said, by design, `Goes.tsx:212`). Teacher can choose Fades, Always, Off (`HelpSetting`).
- Cost of being strict: one slip on a fluent fact goes straight from "none" to "full", not one step. Reasonable for 5 to 7 year olds.

**5. Progression: 3**
- Order is sensible: small doubles, halves to 10, doubles to 10, halves to 20, near doubles, with a double placed just before its half. Seen in levels 1 to 5.
- Adapts per child on records; secure = 70% of facts in box 2 (needs two quick correct first taps per fact, `leitner.ts:55-64`); never drops back; 3 of 10 goes revisit the weakest earlier facts; mixed from level 2. Seen (level 2 round had a double 3 in it, level 4 asked `dbl:1`).
- Not tuned to 75 to 90% success: difficulty only moves between levels and is not eased within a level. A level is only five facts, so each is asked twice a round. A child can pass a level in two rounds. Practice rounds on the same day count in the records, so "Play again" can move the level up (`server.ts:136-140`, `recordAnswers` is not skipped for a repeat day).
- The ladder stops at near doubles (top level 5, "what's next" card to Weka only if Weka is on). After that the same five facts repeat.

**6. Feedback: 3**
- Every wrong pebble of a double or half is a real mistake and gets its own line and picture on the same model ("Double means the same again, not one more", "Half is smaller. The pile goes into two nests", `words.ts`, `WhyPicture.tsx`). Seen on a double (3 then 4 for 3+3) and a half (8 for half of 4).
- A retry with help: after two wrong taps Bella explains and counts, then the same go with pebbles shuffled, wrong taps show why again (`Goes.tsx:173-193`). Seen. Note the "look together" line says the answer out loud ("Count them all: 6"), so the retry is copy-the-answer, though the first tap was already scored wrong.
- Tone is kind: "Try again!", "Let's look together", "Now you try". Praise is generic: "Well done! A stepping stone turned bronze!" is read even to the random tapper; "You are so good at this!" on a level-up is ability praise, not strategy (`words.ts`). Seen (finish screen after the random tapper).
- Fair or not has the weakest feedback: no mistake kind, just "Try again!", and after two wrong choices a pairing-off hint (`Goes.tsx:219-228`). Seen.

**7. Progress recording: 3**
- Per fact in `gem_keep_facts` (pack `early-facts`, plus `add-sub` for near doubles): attempts, correct, avg_ms, box, last_seen, quick_days (`20261017001100_gem_keep.sql:65-78`). Code.
- Per round in `korora_rounds`: level, gold, goes (key, wording, planned help level), taps as `[pick, ms]` pairs, mistakes count, finished_at. The wrong number chosen is saved, but only as a raw number inside `taps`; the mistake kind is not saved and must be re-derived by running the round again from the seed. Help level is saved per go (as planned, not whether the three-in-a-row boost fired). Code.
- Teacher sees: pupil page line with days, level, last played and up to 3 hardest facts (`teacher_korora_student`), the Foundational class grid with last 10 rounds and flags (same level, guessing, low accuracy), and a Today line (`src/teacher/foundational/alerts.ts`). Code.
- Bug: the teacher config knows only levels 1 to 4 and sets `top: 4` (`src/teacher/foundational/config.ts:46`). A pupil on level 5 (near doubles) gets no level name, is never counted as "at the top", so after 5 days there they can be flagged "same level too long" (`shared/kit/teacherGrid.ts:148`). Also `hardest` only reads `dbl|half|oddeven` facts, so near doubles never appear (`20261105000100_korora.sql`, `teacher_korora_student`). Code.

**8. Engagement: 3**
- The doing is the maths (counting fish, sharing, reflections), and it is short: ten goes, a stopping point, no timer. Painted clay art is warm and the stepping stone walk after finishing is a nice reward. Seen.
- The reward (a turned stone) is paid for finishing the ten goes, not for being right, and the finish screen is the same for any accuracy. Seen. Rewards decorate, but do not reward the maths itself.
- Choices are few: nothing to choose except the number (no friend, no stone, no speed). Visible growth: 10 stones, 3 pairs of shoes, a new bird each crossing, a "Doubles to 5 / Halves to 10" label. No social features. Teacher can talk about it ("how did you know 7 + 7?"). Code plus seen.

Total: 3 + 3 + 3 + 4 + 3 + 3 + 3 + 3 = **25 / 32**.

## The 25-item checklist

| # | Item | Result | Evidence (seen or code) |
|---|---|---|---|
| 1 | Maths action is the game | yes | counting and sharing fish is the question (seen) |
| 2 | Cannot win by guessing or tapping everything | partly | tapping all finishes a round, not the level or the fact record; stone still turns (seen) |
| 3 | Representation matches idea and is correct | yes | rows of five, true reflection, halves into two nests (seen); near-double "reflection" has an extra fish |
| 4 | Pre-reader can start alone | yes | voice, hear-again, hand on go 1 (code), pictures (seen) |
| 5 | One question, one action, no split attention | partly | fair or not has pile, bowls, button and 3 long choices; why panel covers penguin (seen) |
| 6 | Big targets, no timer, short sessions | yes | 76 px+ pebbles, 10 goes, no timer (code, seen) |
| 7 | A model for a new skill | yes | mirror and share pictures on full help (seen) |
| 8 | Help appears automatically | yes | why line, look together, hand after taps; no pause-based help (seen) |
| 9 | Worked example the first time | partly | only the very first go is demonstrated; halves, near doubles, fair-or-not are not (code) |
| 10 | Support reduces with success | yes | full to faint to none per fact (code; none seen at "off") |
| 11 | Support returns on struggle | yes | wrong drops a fact to box 1; 3-in-a-row boost (code, boost path seen) |
| 12 | Experts not slowed | yes | known facts get no picture at all (code) |
| 13 | Research order | yes | doubles to 5, halves to 10, doubles to 10, halves to 20, near doubles (seen, code) |
| 14 | Adapts toward 75 to 90% | partly | level and help follow records; no in-level easing; no accuracy target (code) |
| 15 | Old skills return; mixed | yes | 3 weakest earlier facts per round (seen, code) |
| 16 | Mastery before moving up | yes | 4 of 5 facts at box 2 (two quick correct first taps each); a same-day replay can count (code) |
| 17 | After a mistake, see why on same model | yes | per-kind picture and line (seen); fair or not only "Try again" |
| 18 | Another go with help | yes | "Now you try" with shuffled pebbles; but look-together states the answer (seen) |
| 19 | Praise effort, not shame | partly | kind tone; "Well done!" to everyone, "You are so good at this!" (seen) |
| 20 | Server saves per child per skill | yes | attempts, correct, level, time, date, per-go help (code) |
| 21 | Wrong answer chosen saved | partly | the number is in `taps`, the kind is not; nothing shows it to a teacher (code) |
| 22 | Teacher sees stuck and inactive | partly | grid flags and Today line exist, but level 5 has no name or top flag, hardest ignores near doubles (code) |
| 23 | Fun from the maths, rewards decorate | partly | stones turn on finishing, right or not (seen) |
| 24 | Real choices, visible growth, kind social | partly | growth yes (stones, shoes, friends); no choices; no social (code) |
| 25 | Clear goal and active thinking | yes | double and half with a mirror and a share; easy to talk about (seen) |

## Problems found, worst for learning first

1. **Stones turn whether the child is right or not.** Steps: play a round tapping pebbles left to right (the random tapper). It ends with "Well done! A stepping stone turned bronze!". 33 taps, 23 wrong, the stone still turned. Fact records stay honest and the level will not move, but a child can earn 30 days of shoes with no maths, and the finish praise does not tell them so.
2. **A new half shares itself out before the child acts.** Steps: preview tools, level 2, Play. "Half of 4": each chick already holds 2 fish when the screen settles, no tap needed. The child counts one nest. On full help every new half carries its own answer.
3. **Level 5 is invisible to the teacher.** `GAMES.korora` stops at level 4 with `top: 4`, so near-doubles pupils have no level label and can be flagged as stuck (grid and Today) just for being at the top. Near doubles also miss the `hardest` list. Steps: read `src/teacher/foundational/config.ts:46` and `teacher_korora_student`.
4. **Same-day replays change the level.** Playing again the same day sends answers to the records, and level moves follow the records. A child who repeats the same five facts in two rounds can pass a level in one day.
5. **"Look together" says the answer out loud and shows it**, then asks the child to retry (copy). It also shows the result in the panel text ("Count them all: 6"). Steps: wrong tap twice on 3 + 3. The first tap is already scored wrong, so it is a feedback choice more than a data problem.
6. **Fair or not is wordy and loose.** The question text and choices are long for a 5 year old; "One too few" is never right for a real pile so a wrong choice teaches nothing about parity. After two wrong choices a hand points at the answer after 3 wrongs. Steps: day 21 jump, play to the last two goes.
7. **Panels cover Two-Shoes and the water** (the "why" panel and the look-together panel). Small fish (about 40 px) sit in grey boxes over busy hills. Steps: any wrong tap.
8. **Praise is about finishing** ("Well done!"), and level-up praise ("You are so good at this!") is about ability. Not harmful but not strategy praise.

## Saved per child on the server

- `korora_progress` (one row a pupil): `days_done`, `last_pebble_day`, `reached` (1 to 5), `version`, `updated_at` (`20261105000100_korora.sql`, level 5 widening in `20261107000900_korora_near_doubles.sql`).
- `korora_rounds` (one row a challenge): `seed`, `level`, `gold`, `goes` (JSON: `key`, wording `v`, planned help `h`), `open`, `taps` (JSON array of `{pick, ms}`: the number chosen on every tap, right or wrong, with its time), `mistakes`, `started_at`, `finished_at`. Finished rounds older than 30 days are deleted when a new one starts.
- `gem_keep_facts` (pack `early-facts` for `dbl:`, `half:`, `oddeven:`; pack `add-sub` for near doubles `add:n+n+1`): `attempts`, `correct`, `avg_ms`, `box`, `last_seen`, `quick_days`. Only the first tap of a fact counts per round, once a round.
- Wrong choice saved: yes as a raw number in `taps` (not as a mistake kind). Help level saved: the planned level per go yes; the round boost no. Time saved: per tap yes.
- Teacher today: pupil page line (days, level, last played, up to 3 hardest facts from `dbl|half|oddeven`), class grid and flags (same level 5 days, guessing, low accuracy, quiet), a Today line, a Games table line ("N playing, M gold shoes"), and the help setting. Not shown: the mistake kind picked, near doubles in hardest, level 5's name.

Read-only SQL for James (not run):

```sql
-- 1. Levels reached and days played, per pupil
select p.player, p.days_done, p.reached, p.last_pebble_day, p.updated_at
from public.korora_progress p order by p.reached desc, p.days_done desc;

-- 2. Error rate per round, last 14 days (taps beyond 10 are wrong taps)
select r.player, r.level, r.gold, r.mistakes, jsonb_array_length(r.taps) as taps, r.finished_at
from public.korora_rounds r
where r.finished_at > now() - interval '14 days'
order by r.mistakes desc;

-- 3. Stuck facts: tried 4+ times, under 60% right, not secure
select g.player, g.fact_key, g.attempts, g.correct, g.box, g.avg_ms
from public.gem_keep_facts g
where g.pack in ('early-facts','add-sub') and g.attempts >= 4 and g.box < 2
  and g.correct::numeric / g.attempts < 0.6
  and (g.fact_key ~ '^(dbl|half|oddeven):[0-9]+$' or g.fact_key ~ '^add:[0-9]+\+[0-9]+$')
order by g.correct::numeric / g.attempts, g.attempts desc;
```

## Strengths

- Mistakes are real misconceptions (same, plus 1, plus 2, did not share, doubled, forgot the extra fish) and each shows on the same model with a one-line reason.
- Help follows each fact, comes back after a slip, and can be set by the teacher; a double and its half are paired for transfer.
- Honest records: first tap only, the server replays the taps, so the random tapper's 30 wrong taps could not move a level.
- Clean pre-reader screen: voice, hear-again, 4 large pebbles, no timer, short day; warm painted art.
- Fair timing for young children: 10 s quick window, clock starts after the voice.

## Gaps

- The reward (stones, shoes) is for finishing, not for correctness, and the finish message is the same for any accuracy.
- New halves share themselves before the child acts; only go 1 has a demonstration.
- Level 5 missing from the teacher config (no name, wrong "top"), near doubles missing from hardest; mistake kind not saved.
- Ladder is short (5 facts a level, near doubles the top) and replays on the same day count to level-up.
- Fair or not is wordy and gives little feedback; no choices for the child; no social features.

## Candidate improvements

1. **Level 5 in the teacher config and hardest list.** Problem: pupils at the top are flagged as stuck and near doubles are hidden. Change: add `5: 'Near doubles'`, `top: 5`, and include `add:n+n+1` keys in `teacher_korora_student`. Files: `src/teacher/foundational/config.ts`, a new migration for `teacher_korora_student`, `src/pages/TeacherKorora.tsx`. Effort S. Impact: stops false "stuck" alerts and makes the near-doubles level visible to teachers.
2. **Do not auto-share a new half.** Problem: full help gives the answer. Change: on full help show the pile and tap-to-share as on silver (maybe auto-share only the first two fish); keep the full automatic share only inside "Let's look together". Files: `src/games/korora/Goes.tsx:157`, `Goes.tsx` Share component. Effort S. Impact: makes the first halves require sharing and counting, not reading.
3. **Praise about what the child did.** Problem: "Well done!" for everyone. Change: finish line says what was right ("You shared fairly 7 times") or what to try next, and does not turn a stone for a round with 6 or more wrong first taps (the stone waits until a better round, or a smaller "keep practising" stone). Files: `src/games/korora/words.ts`, `KororaGame.tsx` `Finish`, `shared/korora/progress.ts`. Effort M. Impact: stops pay-for-finishing, tells the child the truth kindly.
4. **Save the mistake kind and help boost per tap.** Problem: teacher cannot see "forgets to double" versus "miscounts". Change: save `wrong` kind for each wrong tap in `taps` or a new column, and show "most common mistake" on the pupil page. Files: `shared/korora/play.ts`, `server.ts`, a migration, `TeacherKorora.tsx`. Effort M. Impact: the teacher can talk to the child about the specific idea.
5. **Demonstrate each new kind once.** Problem: halves, near doubles and fair-or-not start cold. Change: a short guided first go (hand, same as go 1) the first time each kind appears, remembered on the server (`reached` already says which level is new). Files: `Goes.tsx`, `round.ts`, `KororaGame.tsx`, voice clips. Effort M. Impact: pre-readers meet halves and near doubles with a model.
6. **Longer ladder: more facts at each level and odd halves.** Problem: five facts a level, each asked twice; top level repeats. Change: halves of odd numbers with a leftover ("half of 7 is 3 and one left"), doubles of 11 to 15 (and x2), near doubles 9+10 and 3+4; bump the level share only when a fact has been right on two different days. Files: `round.ts` `LEVELS`, shared pack keys, `voiceLines.ts`, migration checks. Effort L. Impact: a term of days stays interesting.
7. **Stop replays moving the level.** Problem: same-day replays count. Change: record answers from a replay but only move `reached` on the day's first finish, as Hop's trap taught. Files: `shared/korora/server.ts`, `finishChallenge`. Effort S. Impact: level moves only on spaced, steady success.
8. **Tidy fair or not.** Problem: wordy and a weak third choice. Change: two choices (Fair / One left over) with one picture each; wrong-tap line says "Count the fish in one bowl". Files: `Goes.tsx` (fair parts), `FairPile.tsx`, `words.ts`, `round.ts` (`FAIR_CHOICES`). Effort M. Impact: clearer for 5 to 7 year olds and teaches odd and even better.

## Learning-design rules

| # | Rule | Result | Evidence |
|---|---|---|---|
| 1 | The maths is the move | partly | tapping the number of fish is the maths; tapping everything finishes a round; a full-help half is shared for the child (`Goes.tsx:157`) |
| 2 | One thing at a time, voice first | met | Bella clips, hear-again, 76 px+ pebbles, no timer; fair or not is heavier |
| 3 | Concrete, then picture, then number | met | fish and pebbles, rows of five, full, faint, then words only (`HELP_LADDER`) |
| 4 | Help arrives by itself | partly | why line, look together and hand (seen); only go 1 has a demo; nothing for a long pause |
| 5 | Help follows the child, not the calendar | met | per fact `helpForStats` with the kit's `helpForFact`; teacher setting; calendar only for stone colours and gold day |
| 6 | Progression | partly | order, 70% rule, 3 review goes, what's-next card to Weka; short levels; same-day replays move level; ladder ends at near doubles |
| 7 | Mistakes teach | met | tagged wrong kinds, one-line reason on the same picture, look together, now you try (seen); fair or not weaker |
| 8 | Fair timing | met | `JUNIOR_QUICK_MS` and the clock after the voice (`Goes.tsx:147-150`); the share animation is not on the clock for the answer |
| 9 | Record evidence a teacher can use | partly | per fact and per tap saved; kind not saved; level 5 missing from the teacher config; hardest ignores near doubles |
| 10 | Fun from the maths | partly | the maths is the action; stones turn for finishing, not for right |

**Shared game kit (`docs/plans/GAME-KIT-PLAN.md`), checked against the code.** Used: `shared/kit/help` (`helpForFact`, `helpWithSetting`, `STRUGGLE_GOES`), `shared/kit/mistakes` (`tagWrongs`, `atMostShareTell`, the two-tap flow `stepGo`, `LOOK_AT`), `src/kit/ShowWhy` (ShowWhy, LookTogether, NowYouTry), `src/kit/WhatsNext` (finish card), the teacher grid in `shared/kit/teacherGrid`, and `JUNIOR_QUICK_MS`. **Not used but could be:** `src/kit/HearAgain` and `PointingHand`/`useGuidedFirstGo` (the game has its own hear-again button, hand and guide timers in `Goes.tsx`), `src/kit/FirstTimeTip` for a demo of each new kind, `shared/kit/replay` (it has its own `play.ts`), `src/kit/TenFrame`/`DotPicture` (the fish rows of five are drawn by hand and do not match a ten-frame look), `shared/kit/dayArc` and `voiceLinesSuite` (unchecked here).
