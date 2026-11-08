# Weka's Stepping Stones: second review (8 Nov 2026)

Blind rerun: I did not read the first review, its scores, `docs/plans/maths-review/R*.md` or git history. Every line of evidence is marked **(play)** for what I saw in the preview, or **(code)** for what I read. One slip in order: I read `docs/LEARNING-DESIGN.md` after my play session but before writing this file (the instructions say after the scores). Its text did not change a score; the scores come from play and code.

Play notes: preview on port 5306, own tab, browser-only trial backend. The browser pane was hidden for part of the session, so animations and timers ran slowly and I could not hear the voice. All voice judgements are **code only** (clip names and lines read in `voiceLines.ts`). I played the guided first go by hand, made one, two and then three wrong taps in a row, tapped every choice in turn for a whole round (the random tapper), and then seeded the pretend pupil's records to see round 2 with faded help.

## How it works

Each day a child helps Weka (a painted bird) cross a stream on 20 numbered stepping stones, with a big rock at 10. A day is 10 goes. A go is an adding fact that crosses ten ("9 + 8", or "5 + 8" on silver and gold days, or "13 − 5" hopping back on gold days). Depending on the help level for that fact, the child first taps how many hops to the big rock (help only, never saved), then taps where Weka lands from four numbers. After a right answer Weka hops the whole journey, then (on full or split help) the child drags silver pebbles between two ten-frames to fill the first ten, then fills in a part-whole split (for example 8 into 1 and 7), then moves on. A finished day turns one of ten far-bank stones bronze, silver, then gold; 30 finished days win a Golden Picnic Basket and a new bird friend. The voice reads every line, there is a "Hear it again" button, and a pointing hand guides the very first go.

## The maths

Only one idea: add within 20 by making ten. Twenty facts: both numbers 9 or less, total 11 to 18 (`shared/weka/round.ts:43-48, 88-96`; the question text and variants come from the shared `addSubPack`, `round.ts:279, 303-308`).

Levels, in order (`round.ts:43-48`):
1. Starting on 9 (8 facts, 9 + 2 to 9 + 9)
2. Starting on 8 (6 facts)
3. Starting on 7 and 6 (6 facts)
4. All 20 mixed

How the level is chosen: `levelFor` (`round.ts:115-119`) gives the first level at or above the furthest reached where fewer than 70% of its facts are in Leitner box 2 or higher (`STEP_SECURE_SHARE = 0.7`, `shared/maths/selector.ts:60`). Box 2 means two quick right first answers in a row (`shared/maths/leitner.ts:54-65`; quick is under 10 s for juniors, `shared/juniorQuick.ts:6`). The server keeps the furthest level and never drops it (`shared/weka/server.ts:131-134`).

Which goes make a round (`round.ts:199-223`): every fact of the level once (weakest first), then the weakest again to make 10; from level 2 up, 3 of the 10 goes are the weakest facts from earlier levels; no fact twice in a row. Kinds: bronze days all "big + small"; silver and gold days put the smaller number first about 30% of the time ("5 + 8", start on the bigger); gold days end with two hop-backs ("13 − 5") (`round.ts:50-54, 226-229`). The kind of day comes from the day count, not from the child's skill.

Help per fact (`round.ts:131-147`): full (every stone numbered, two steps, then pebbles and split) until box 2 and quick on 2 different days; split-first (child splits the number, then answers, then pebbles) until box 4 and 8 right; faint (every fifth stone, one tap) until 12 right; then none (sum only). A wrong first answer drops the fact to box 1 and full help comes back (`shared/kit/help.ts`, `leitner.ts:55-58`). Three goes in a row with a wrong first tap give full help for the rest of the round (`Goes.tsx:154, 273-276`). The teacher can set help to fade, always, or off (`Goes.tsx:63`).

Wrong choices are built from mistakes (`round.ts:328-350`): stopped at the rock (10), the whole small number added after ten ("10 + 5"), "part" (8 + 3, never reaching the rock), one stone out, and for hop-backs "went up the line".

## Scores

| Criterion | Score |
|---|---|
| 1 Maths fidelity | 3 |
| 2 Clarity | 3 |
| 3 Support and structure | 3 |
| 4 Fading | 3 |
| 5 Progression | 3 |
| 6 Feedback | 3 |
| 7 Progress recording | 3 |
| 8 Engagement | 3 |
| **Total** | **24 / 32** |

### 1 Maths fidelity: 3
- Hopping to the big rock then on is exactly the make-ten strategy; the number line with a rock at 10 and the two ten-frames are correct models. Seen in play: 9 + 2 shows "9 + 1 = 10, then + 1", pebbles fill the first frame to 10 (play).
- Wrong choices are real mistakes, not answer ± 1: "10" (stopped at the rock) was a choice in 9 + 2, and the why-line said "That is where Weka is. 1 more hop." (play; `round.ts:328-350`).
- Loophole 1: there is no cost to tapping. Four choices, a wrong one greys out, and after the second wrong tap "Let's look together" shows the whole make-ten sentence, then the choices come back. I finished a full round by tapping the first enabled choice every time: 33 taps, 23 wrong, 10 goes done, a bronze stone won (play; `weka-preview-pupil` saved round, mistakes = 23). So a round can be finished with no maths.
- Loophole 2: the pebble step can be brute-forced. Press Check twice wrong and the right number moves across by itself (`Pebbles.tsx:104-111`). It is help only, so it does not change the record, but it can be skipped through (play, code).
- First tap guess is 25% right and counts fully. A guessed right first tap also counts as "quick" (29 ms recorded in my random-tap round) and moves a fact up a box (play; `leitner.ts:60-64`, there is no minimum time).

### 2 Clarity: 3
- Voice on every line, "Hear it again" button always at the top, one question in the middle, four big choice stones at the bottom (screenshots, play; voice code only, `voiceLines.ts`).
- A pointing hand and "try this one" label guides the first go; the first go never lets a child get lost (play).
- No timer visible; the answer clock starts after the voice (`Goes.tsx:128-135`) (code).
- Fiddly moments: one go on full help is four screens (hops to ten, where Weka lands, pebbles, split) so a child meets a lot of different layouts per go (play). On the pebble screen the count labels ("9", "2") sit below the frames, away from the frames, and the question appears as a pill floating between them (screenshot, play). With no help the stones are faint on the water and easy to miss (screenshot of the first screen, play).

### 3 Support and structure: 3
- Model always on while a fact is new (numbered stones, two-colour hops, pebbles, bond) (play; `Goes.tsx:460-470`).
- Automatic help: wrong tap 1 gives a why-line, wrong tap 2 the "look together" walk-through, three wrong goes bring full help back, a pointing hand after wrong taps and a 7 s hand on the pebbles (play; `Goes.tsx:268-288, 427`; `Pebbles.tsx:51`).
- Demonstration: only the very first go (9 + 2, with the hand) is guided. The new kinds of go (smaller first on silver days, hop-back on gold days) get no demonstration; a child meets "13 − 5" cold, after 20 days of adding (code; `round.ts:226-229`, `Goes.tsx:152`).

### 4 Fading: 3
- Four-step ladder per fact: full, split-first, faint, none, driven by that fact's own record (`round.ts:131-147`). In my seeded test, round 2 showed full on new facts and faint and none on the facts I had given long records (play; saved round `full / faint / full / faint / none ...`).
- Returns on struggle: a wrong answer drops the fact to box 1 (back to full) and three wrong goes in a row switch full help on for the rest of the round (code).
- Weakness: it does not respond to expertise early. A fact stays on full help, including the pebbles and the bond after every right answer, until it has been right and quick on two different days; a child who already knows 9 + x still sits through the whole routine each day for at least two days (code; `round.ts:140`). And a single slip after 12 correct sends a fact straight back to full, which is a large jump. I am scoring this 3, not 4, for item 12.

### 5 Progression: 3
- Order follows the usual teaching order: 9 first (the easiest rock to reach, one hop for 9 + 2), then 8, then 7 and 6, then mixed (`round.ts:43-48`).
- Adapts per child: the weakest facts first, level by 70% in box 2 or above, never drops (code). Three review goes from earlier levels per round (code, `REVIEW_GOES`).
- Weak points: nothing aims for 75 to 90% success. A fact appears twice in a level-1 round, so a round of 10 had only 8 different facts and 2 repeats (play: 9 + 8 and 7 + 9 each came twice). Move-up needs box 2, which a lucky guess can reach, because the first tap counts as quick with no minimum time. Once the child is at level 4 the ladder is flat: the same 20 facts for the rest of the 30 days and beyond (code). Silver and gold kinds come from the calendar, not from the child.

### 6 Feedback: 3
- A wrong tap greys the number and a short line says what that tap means: "That is where Weka is. 1 more hop." and a bond picture for the "10 + small" slip (play; `words.ts`, `Goes.tsx:505-512`).
- The second wrong tap shows the whole make-ten sentence on the pebbles, then "Now you try" gives the same question again (play; `Goes.tsx:224-248`).
- Right answers say the strategy: "13! 10 and 3 make 13." (code; `voiceLines.ts`). The end screen says "You are so good at this!" on a level-up, which praises the child rather than the strategy (code; `words.ts`).
- Gaps: wrong taps on the split bond and the "how many hops" step get only "Try again!" after the first miss (`Goes.tsx:360-376, 398-403`). The "now you try" after the walk-through follows the demonstration so closely that a child can copy it.

### 7 Progress recording: 3
- Per fact per child (`gem_keep_facts`): attempts, correct, average time, box, last seen, quick days. Per round (`weka_rounds`): seed, level, day type, the ten goes with each fact, how it was asked and its help level, and, once finished, every answer tap with its time and the mistake count (`20261105000600_weka.sql`). So the wrong number chosen and the help level are in the database (code).
- But the wrong pick is not saved as its own thing and no screen shows it; the per-fact record has no date per answer, only a last-seen date. Finished rounds over 30 days old are deleted on the child's next start (code). The pretend pupil showed the same data in the browser (play, localStorage).
- Teacher view: pupil page line with days, level, last played and 3 hardest facts (`teacher_weka_student`); class grid and "Needs you" alerts through the Foundational view (`teacher_foundational_class`, `src/teacher/foundational/alerts.ts`) with the last 10 rounds' wrong-tap counts (code).

### 8 Engagement: 3
- The fun is mostly the maths: hopping, filling the ten-frame, a painted friend who cheers (play).
- Rewards decorate: a stone changes colour for a finished day whatever the accuracy (my random-tap round got a bronze stone). Thirty days to a basket is a long reward cycle (play, code).
- Choice is thin: one game a day, no choice of friend or what to practise, but growth is visible (ten stones, baskets shelf). Each right go is followed by a pebble task and a bond task that are extra steps rather than choices (code).

## The 25-item checklist

| # | Item | Answer | Evidence |
|---|---|---|---|
| 1 | The maths action is the game | yes | Hops to ten and on are the sum (play) |
| 2 | Cannot win by guessing or tapping everything | partly | Tap-all finished a round, 23 wrong of 33 taps, stone still won (play) |
| 3 | Representation matches and is correct | yes | Number line with rock at 10, ten-frames, bond (play) |
| 4 | A pre-reader can start alone | yes | Voice, Hear it again, hand on first go (voice code only; hand play) |
| 5 | One question and one action at a time | partly | Four different screens per full-help go (play) |
| 6 | Big targets, no timer, short session | yes | Big stones, no timer; 10 goes (play) |
| 7 | A model available for new skills | yes | Full help on new facts (play) |
| 8 | Help appears automatically | yes | Why-line, look together, hand (play) |
| 9 | A worked example the first time | partly | First go only; no demo for smaller-first or hop-back (code) |
| 10 | Support reduced step by step | yes | Full, split, faint, none per fact (play, code) |
| 11 | Support returns if failing | yes | Wrong answer drops to box 1; three wrong goes give full help (code) |
| 12 | Experts not slowed | partly | Two quick days before help leaves; pebbles and bond every go (code) |
| 13 | Research order | yes | 9, then 8, then 7 and 6, then mixed (code) |
| 14 | Adapts toward 75 to 90% | partly | Weakest-first and level by 70%, no target rate (code) |
| 15 | Old skills return, kinds mixed | partly | 3 review goes; kinds by calendar (code) |
| 16 | Move-up needs steady success | partly | 70% of facts in box 2, but a lucky quick guess reaches box 2 (code) |
| 17 | Mistake shows what and why on same model | yes | Why-line and pictures (play) |
| 18 | Another go with help | yes | Look together, then now you try (play) |
| 19 | Praise about effort and strategy, no shame | partly | Strategy line on right answers; "so good at this" on level-up (code) |
| 20 | Server saves per child, per skill | yes | gem_keep_facts and weka_rounds (code) |
| 21 | Wrong answer actually chosen saved | partly | In round taps jsonb for 30 days, not surfaced (code) |
| 22 | Teacher sees stuck and not played | partly | Grid, alerts and pupil line exist; no wrong-pick view (code) |
| 23 | Fun from the maths; rewards decorate | partly | Stone turns on any finish, even random tapping (play) |
| 24 | Real choices, visible growth, kind social | partly | Growth yes, choices no; no social (code) |
| 25 | Clear goal and active thinking | yes | "How many hops to ten?" talkable (play) |

## Problems found

Ranked by harm to learning.

1. **Tapping everything finishes a round and earns the stone.** Steps: Play, then on every go tap the first live choice; after the second wrong the walk-through plays and the choices come back. Result seen: 10 goes done, 23 wrong taps, bronze stone, 3 of 8 facts "right" by luck. The day count and the reward do not care.
2. **A lucky guess counts as quick and secure.** The first tap on a go counts, with no minimum time. In my random round the recorded times were 9 to 82 ms, and 3 facts logged as right and quick. Two of those and a fact reaches box 2, which is what moves the level and fades help. A 25% guess chance per go makes this not rare across 20 days.
3. **The walk-through gives the answer, and the next question is the same.** After wrong tap 2, "Let's look together" shows the final answer, and "Now you try" repeats the question unchanged, so a child can copy. Steps: make two wrong taps on any go.
4. **A full-help go is long.** Four stages (hops to ten, answer, pebbles, split) each with their own pause: right answer hold 1.8 s plus the hop (`Goes.tsx:51, 330`). A child who knows the fact still does all four (full help stays for at least two quick days). Risk of rushing and dropping out.
5. **Hop-back and smaller-first kinds appear with no demonstration** (day 11 and day 21 on). Steps: set the preview to day 20 and play.
6. **Wrong taps on the split bond and the hops-to-ten step, after the first, say only "Try again!"** (`Goes.tsx:360-376, 398-403`). The child learns nothing from a second miss there.
7. **Repeats inside a round:** in my level-1 round 9 + 8 and 7 + 9 each came twice, so only 8 different facts appeared (play).
8. **Level-up praise is about ability** ("You are so good at this!", `words.ts`).
9. **Pebble labels sit away from the frames** and the floating question pill is hard to link to them (screenshot, play).

## Saved per child on the server

- `weka_progress` (one row per pupil): `days_done`, `last_stone_day`, `reached` (1 to 4), `version`, `updated_at`.
- `weka_rounds` (one row per challenge): `seed`, `level`, `day` (bronze, silver or gold), `goes` jsonb (for each go: fact key, `v` how asked, `h` help level), `taps` jsonb (each answer-step tap: number picked and milliseconds), `mistakes`, `started_at`, `finished_at`. The wrong choice and the help level are therefore saved. The hops-to-ten step, the pebbles and the bond are never sent. Finished rounds older than 30 days are deleted when the child starts a new one.
- `gem_keep_facts` (pack `add-sub`, keys `add:5+8`): attempts, correct, avg_ms, box, last_seen, quick_days. One answer per fact per round, the first tap (`shared/kit/replay.ts`, `oncePerFact`).
- What a teacher sees today: pupil page line (days done, level, last played, 3 hardest facts, `teacher_weka_student`), the Foundational class grid and Today "Needs you" line from the last 10 rounds' wrong-tap counts and level (`teacher_foundational_class`), the games table (players and baskets). Not seen anywhere: which wrong number a child picked, or the help level a child had.

Read-only queries James could run (not run by me):

```sql
-- 1. Levels reached
select reached, count(*) from public.weka_progress group by reached order by reached;

-- 2. Error rate by fact (add-sub pack, the 20 Weka facts)
select fact_key, sum(attempts) as tries, sum(correct) as right,
       round(1 - sum(correct)::numeric / nullif(sum(attempts), 0), 2) as miss_rate
from public.gem_keep_facts
where pack = 'add-sub' and attempts > 0
  and fact_key in (select 'add:' || s || '+' || b from generate_series(1,9) s, generate_series(1,9) b where s <= b and s + b > 10)
group by fact_key order by miss_rate desc;

-- 3. Stuck or tapping-everything pupils: last 14 days, many wrong taps a round
select p.player, count(*) as rounds, round(avg(r.mistakes), 1) as avg_wrong, max(r.level) as top_level
from public.weka_rounds r join public.weka_progress p on p.player = r.player
where r.finished_at > now() - interval '14 days'
group by p.player having count(*) >= 2 and avg(r.mistakes) >= 8 order by avg_wrong desc;
```

## Strengths

- The maths mechanic is honest: hopping to the big rock is the make-ten strategy, drawn on a real number line, with ten-frames and a part-whole bond as second and third views.
- Help follows each fact's record, in four steps, and comes back after a slip.
- Wrong choices come from real mistakes, with a why-line and a picture for each.
- Voice-first and no timers; the first go is guided.
- Server replays the taps; nothing that counts comes from the browser.
- Teacher can see the class on the Foundational grid and Today.

## Gaps

- No cost for tapping everything; the day still counts.
- A lucky quick guess moves a fact up, so the level and the fading can be fooled.
- A walk-through that gives the answer, followed by the same question.
- Each go on full help is long, and expert children cannot skip it.
- No demonstration for smaller-first or hop-back goes.
- The chosen wrong number is saved but never shown to the teacher.
- Flat ladder after level 4 (same 20 facts for the rest of the 30 days).

## Candidate improvements

1. **Make a guess cost something.** Problem: tap-all finishes a round and earns the stone. Change: after the second wrong tap on a go, put the fact back at the end of the round (or into tomorrow's round) with a different question; show the day as "stone turned" only when at least 6 of 10 were right on the first tap (otherwise "stone half-turned, come back to finish"). Files: `shared/weka/round.ts`, `shared/weka/server.ts`, `src/games/weka/Goes.tsx`. Effort M. Impact: high (items 2, 23).
2. **Stop a lucky guess counting as quick.** Problem: a 29 ms right tap counts as quick and raises the box. Change: a minimum think time (for example 1 s after the voice) for a "quick" credit, and keep tapped-everything goes (taps within 1 s) out of the fact record. Files: `shared/kit/replay.ts`, `shared/maths/leitner.ts` call site in `server.ts`. Effort S. Impact: high for honest levels and fading.
3. **Change the question after the walk-through.** Problem: "Now you try" repeats the same fact. Change: after "look together" ask the same fact in a different form (the smaller-first variant, or the neighbour fact, for example 9 + 5 then 9 + 6) so the child has to apply it. Files: `Goes.tsx`, `round.ts`. Effort M. Impact: medium to high.
4. **Shorten help for children who already know it.** Problem: pebbles and the split after every right answer, for at least two days. Change: skip the pebbles and the bond on a go the child got right first time quickly, and keep them only after a wrong first tap or on facts with fewer than 2 right (the pebbles still show for the first 3 goes of a level). Files: `round.ts` (`pebblesFor`), `Goes.tsx`. Effort S to M. Impact: medium (less drop-out, honours expertise reversal).
5. **Demonstrate each new kind of go.** Problem: "5 + 8" and "13 − 5" arrive without a demonstration. Change: the first time a kind appears, the first go uses the guided mode with the hand (the same `useGuidedFirstGo`), recorded in the child's progress (needs one saved flag). Files: `round.ts`, `server.ts`, a small migration for the flag, `Goes.tsx`. Effort M. Impact: medium.
6. **Show the teacher which wrong number was picked.** Problem: the taps are stored but nobody can read them. Change: save the mistake kind (`rock`, `double`, `part`, `off1`) per first wrong tap (a column or jsonb on `weka_rounds`), show "mostly stops at the rock" on the pupil page, and add the help level to the pupil line. Files: a new migration, `shared/weka/play.ts`, `teacher_weka_student`, `src/teacher/foundational`. Effort M. Impact: medium for teaching.
7. **Better messages on the bond and the hops-to-ten step.** Problem: after the first miss it says "Try again!". Change: tell what that number is ("2 is how many we add. How many get to ten?") and show it on the bond picture. Files: `Goes.tsx`, `words.ts`, `voiceLines.ts` (and new Bella clips). Effort S to M. Impact: low to medium.
8. **A longer ladder at level 4.** Problem: the same 20 facts after the child is secure. Change: add subtraction across ten ("14 − 6") and "what makes ten" gap questions as a level 5, and a cheap gap-fill question so mixing continues. Files: `round.ts`, shared add-sub pack, words, voice. Effort L. Impact: medium (keeps a quick child busy for the 30 days).

## Learning-design rules

| Rule | Met? | Evidence |
|---|---|---|
| 1 Maths is the move; no winning without it | partly | The hops are the sum, but tap-all finishes a round and earns the stone; the wrong picks are free (play) |
| 2 One thing at a time, voice first | partly | Voice, Hear it again, big targets, no timer; but four stages per full go (play; voice code only) |
| 3 Concrete, then picture, then number | met | Pebbles in ten-frames, number line with rock, bond, fading to numbers (play, code) |
| 4 Help arrives by itself | partly | Why-lines, look together, hand, boost after 3 goes (play); only the first go has a demo (code) |
| 5 Help follows the child, not the calendar | met | `helpForStats` per fact, drops to full after a wrong answer (code); the calendar sets only the kinds of go |
| 6 Progression: order, 75 to 90%, mastery, spacing, what's next | partly | Good order and review goes; no target rate, lucky quick guess reaches box 2, flat after level 4, no next-game card (code) |
| 7 Mistakes teach | partly | Mistake-based wrong choices, why-line, look together, now you try (play); "Try again!" on bond and hop step; answer is shown then copied (code) |
| 8 Fair timing | met | Clock starts after the voice (`Goes.tsx:128-135`), 10 s quick for juniors (code) |
| 9 Record evidence a teacher can use | partly | Taps and help saved for 30 days; no wrong-pick kind, none shown to the teacher; grid and alerts exist (code) |
| 10 Fun from the maths; rewards celebrate success | partly | Fun is the hops and the pebbles; the stone turns for any finish (play) |

**Game kit parts used** (checked in the imports, `Goes.tsx:33-38`, `WekaGame.tsx:7-12`, `progress.ts:8`, `server.ts:22-27`): `shared/kit/help` (`helpForFact`, `helpWithSetting`, `STRUGGLE_GOES`), `shared/kit/mistakes` (wrong choices, `stepGo`), `shared/kit/replay`, `shared/kit/dayArc`, and the screens `ShowWhy`, `LookTogether`, `NowYouTry`, `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `WhatsNext`, and `voiceLinesSuite`. The Foundational teacher helpers (K5) also cover it.

**Kit parts it could use but doesn't:** the kit `TenFrame` and `NumberLine` (K3), because Weka draws its own ten-frames in `Pebbles.tsx` and its own stone path; `FirstTimeTip` (K4) for demonstrating the new kinds of go; a what's-next card to another game at the top of the ladder (R8 is not in this game's code).
