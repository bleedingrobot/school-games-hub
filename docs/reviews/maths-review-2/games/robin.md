# Robin's Berry Basket: second review (blind)

Method note. First pass was code only (browser tabs were not available). I then built the preview, served it on port 5312 and played it in my own tab on desktop and at phone width (375x812): first go with no adult, right answers, wrong taps, second wrong (redo), random tapping and several goes in a row. Evidence is marked **(seen)**, **(code)** or **(sim)**. Not seen in play: three wrong in a row (read in code only), and a later-day step change (needs several days; code and sim only). The tab was closed and the server stopped.

## How it works

A child gets 10 goes a day from the server. There are three kinds. **Give me N**: a scattered pile of berries (N plus 3 to 5 spares) and a basket; each tap on a berry moves it into the basket (slots numbered 1 to 10 at the top help level), the child presses a big "That's all" button, and the game never stops them, so stopping at N is the maths. **How many?**: a group of berries in rows, scattered or in a ring; the child can touch each berry (it dims and shows a number, depending on help level), then taps one of four number cards. **One more**: a plate under a cloth with a printed number, one berry added, pick the new total from four cards. After every right answer Robin says the model sentence ("Four berries.") and the game holds for 3.2 seconds. Each day's first finish turns one of ten baskets bronze, silver then gold; 30 days gives the Golden Berry Feast, then a friend's basket. Bella's voice reads every line, and there is a "Hear it again" button.

## The maths

Six steps, in order (`shared/robin/config.ts:34-41`, `shared/robin/round.ts:54-61`):

1. Give 1 to 5 (10 goes, all new).
2. How many, 1 to 5, in rows (10 goes).
3. Give 6 to 10 (7 new, 3 review of give 1 to 5 and how many 1 to 5).
4. How many, 6 to 10, scattered or ring (7 new, 3 review).
5. One more: counting on from a covered plate of 4 to 9 (7 new, 3 review).
6. Count to 20: give 11 to 20 (4 goes) and how many 11 to 20 in rows (3 goes), 3 review.

Keys are in `shared/maths/skillPacks/countingKeys.ts`. Within a step the weakest key (lowest Leitner box) comes first (`round.ts:131-138`). A child **starts everyone at step 1, help level 5** (`round.ts:73`), whatever their other records say.

**How the next step is chosen** (`shared/robin/progress.ts:46-53`, `config.ts:20-21`): a challenge with 8 or more of 10 right at the first tap is "good"; two good challenges at the same step pass it and the child never drops back. Only the first finish of the NZ day moves anything (`shared/robin/server.ts:167`), so play-again changes nothing. **Help level** (5 down to 0): two good challenges (7 or more of 10 right) in a row go down one; 4 or fewer goes up one; a new step puts help up two unless it just faded. Inside one go, a wrong tap lifts help one level and a second takes it to the top (`round.ts:245-252`); three first-tap-wrong goes in a row keep the top level for the round (`Goes.tsx:213-215`). The teacher can set Fade, Always (level 4) or Off (level 0).

## Scores (1 to 4, after play)

**1. Maths fidelity: 2.**
- Give goes are the real thing: the child produces the count and must stop; the pile is always N plus 3 to 5, so "take everything" is wrong; the basket's numbered slots are a correct count model (code: `round.ts:209-213`, `Goes.tsx:241-251`).
- But in every card go (steps 2, 4, 5 and most of 6) **the right answer is almost always the third card of four**. Wrong cards are always built as n+1, n-1, n-2 (how many, `round.ts:221`) or n, n+2 and 1 (one more, `round.ts:216`), and cards are sorted (`round.ts:217,222`), so the cards read [n-2, n-1, n, n+1] or [1, n, n+1, n+2]. In the sim, step 4 answer was the third card in 2275 of 2392 card goes (95%). A child who always taps the third card passes without counting (sim).
- Counting is never required in a "How many?" go: marking berries is optional at every level (`Goes.tsx:233-239`), so a child can tap a card at once. The "one more" plate prints the number on the cloth, so it is reading a numeral plus one; that is acceptable for counting on.
- Random tapper: cards grey out after each wrong tap, so tapping all four finishes the go with no maths; the cost is only that the go is recorded wrong (sim: first-card guessing gave 0 to 2 of 10).
- **Seen in play:** on How many? (3 or more) the right card was the third of four every time; on One more the cards were [1, n, n+1, n+2] and the answer was again third. Exceptions seen and read: n=1 cards [1,2,3,5], answer first; n=2 cards [1,2,3,6], answer second. Over 8 How many goes at step 2 the third card was right 5 times (the other 3 were n=1 and n=2 goes). Positions seen: third, third, third, third, third, first, second, third.
- Why not 3: the third-card tell means the card goes can be beaten with no maths in most of the game; why not 1: the give goes and the first-tap-only record are honest.

**2. Clarity: 3.**
- Voice on every line, "Hear it again" always on screen, a hand points the first go (code: `Goes.tsx:113,270`; `voiceLines.ts`; seen in play). "Give me N" is also written large on screen (`Goes.tsx:273`).
- One question and one action per screen; wrong-tap line and picture appear under the stage; "That's all" says why when nothing is in the basket with a picture, no words (`Goes.tsx:243-248`).
- **Seen in play (new problems):** the berries fade in about a second after the screen appears, so a quick child taps nothing for a moment. On How many? there is no written question, only the voice and "Hear it again" (a deaf or muted-device child has nothing). The "why" or "look together" panel sits at about y=731 to 743 in a 768 px high window, below the fold, so on a laptop or small tablet the help can be off screen until scrolled. Scattered and pile berries sometimes overlap (one pair on an 8-berry How many? screen, a cluster on a Give go), which makes counting them harder than the maths intends. At phone width (375x812) the "Preview tools" and "Voice on" buttons sit on top of the progress dots. Berries look a little like apples (painted clay style, otherwise nice). A reload mid-round loses the round.
- Targets are big: berry about 57x72 px, "That's all" about 278x84 px, number cards large. A 3.2 second hold after every right answer (`Goes.tsx:34`) is slowish; no timers.

**3. Support and structure: 3.**
- A model is present from the first go: numbered basket slots, dimming and numbering of counted berries, "Peek" at low levels (code: `art.tsx:142-159`, `config.ts:60-66`).
- Help arrives by itself after a wrong tap (why line, then "count together", then two cards).
- Only the very first go (a give go) has a guided demonstration (`round.ts:140-147`); the first "How many?" and the first "One more" have none, and there is no demonstration for a child who starts straight at step 5 (cannot happen, all start at step 1, but the first time each kind appears is unexplained). So not 4.

**4. Fading: 3.**
- Help fades in six levels on two good challenges and returns on a hard one or on a new step (code: `config.ts:20-21`, `progress.ts:46-53`) and inside a go (`round.ts:245`). A strong child reaches level 3 after two days. That is fade and return both.
- It is per child, not per skill: one level covers give, how many and one more alike, so a child strong at giving but weak at counting on gets the same help level. The step jump also adds help. So not 4.

**5. Progression: 3.**
- A research-sensible order: small before big, give before count, then count on, then 11 to 20 (code: `round.ts:54-61`). Mastery needs two good challenges (`progress.ts:49`); 3 goes in steps 3 to 6 revisit earlier kinds (`round.ts:138`); weakest keys first.
- Adapts per child by streaks, but the pass needs only 8 of 10 twice, and with the third-card tell that can be reached by pattern. Steps 1 and 2 have no review. Nothing on the way to 75 to 90 percent is measured directly. The step cannot go back. Everyone starts at step 1 even if they count well (they get there in two days).

**6. Feedback: 3.**
- Each wrong card has a named slip (double, skip, row, lots, same, again, one) with a plain line that never says the number (code: `words.ts why()`, `round.ts:222`). Give goes say "too many" or "not enough yet" with a row of the berries given (`Goes.tsx:53-60`).
- The second wrong tap runs "count together", then "Now you try" with only two cards and the right one marked with a hand and glow (`Goes.tsx:184-199,363`), which effectively shows the answer.
- The plan's own best idea, replaying the child's own touches with a skipped berry staying dark, is **not built**: for a wrong card the picture is a row of `pick` berries, not the actual group the child counted (`Goes.tsx:53`). Praise after a right answer is just the model sentence; no effort or strategy praise. Kind tone throughout.

**7. Progress recording: 3.**
- Per fact (`gem_keep_facts`): attempts, correct, average time, Leitner box, quick days, written with the junior quick time and first tap only (code: `server.ts:173`, `entry.ts:75`, `replay.ts:56`).
- Per challenge (`robin_rounds`): the full round with the help level per go, every tap with its time (so each wrong pick), the first-right count and the slip of each go's first wrong tap (`server.ts:169`, migration `20261108000100_robin.sql`).
- Teacher sees: a pupil page line with step, help level, days, the commonest slip and 3 hardest (`TeacherRobin.tsx:52-62`). I found **no** Today "Needs you" alerts and **no** class grid row for Robin in the code (only `TeacherRobin.tsx` and `teacher.ts`). So no stuck or inactive overview; not 4.

**8. Engagement: 3.**
- The give go is satisfying: tapping berries one by one into a basket and pressing That's all (code). Ten baskets turning bronze, silver, gold and a Feast give a clear long goal; children choose nothing except voice on and off, and the teacher's help choice is not the child's.
- A friend's basket after each Feast is a nice touch. Card goes are less satisfying because the maths is optional there. No social features, nothing ranked.

## The 25-item checklist

| # | Item | Answer | Evidence |
|---|---|---|---|
| 1 | Maths action is the game | partly | Give goes yes; card goes are a quiz after optional counting |
| 2 | Cannot win by guessing | no | Third card is right about 95% (sim) and was third in every n>=3 go I saw; cards grey out so tap-all finishes |
| 3 | Representation correct | yes | Numbered slots, fives in rows, dim and mark; plate for count on |
| 4 | Pre-reader can start alone | yes | Voice, hear again, hand on first go, "Give me N" large (code) |
| 5 | One question, one action | yes | One stage, labels next to things (code) |
| 6 | Big targets, no timer, short | yes | Seen: big targets, no timer, 10 goes; 3.2 s hold per right answer is slow; berries overlap in places |
| 7 | A model available | yes | Basket slots, berry marks, Peek |
| 8 | Help appears automatically | yes | Why line, count together, level lift in a go |
| 9 | Demo the first time of a new type | partly | Guided first go only for give; none for how many or one more |
| 10 | Support fades in steps | yes | Six levels, two good challenges per drop |
| 11 | Support returns on failing | yes | Hard challenge up one, new step up two, three wrong in a row, per go |
| 12 | Experts not slowed | partly | Everyone starts at level 5; two days to level 3; Off setting is the teacher's |
| 13 | Research-ordered difficulty | yes | Give, count, count on, to 20 |
| 14 | Adapts per child toward 75 to 90% | partly | Streak rules, not a target rate; step pass is fixed |
| 15 | Old skills return and mix | partly | 3 review goes from step 3; none in steps 1 and 2 |
| 16 | Move up needs steady success | yes | Two challenges of 8 or more (weakened by the third-card tell) |
| 17 | Mistake shown, same model | partly | Slip lines yes; picture is a generic row, not the child's own count |
| 18 | Another go with help | yes | Redo after count together, wrong recorded |
| 19 | Praise effort, never shame | partly | Kind words; praise is a model sentence only |
| 20 | Per child per skill saved | yes | `gem_keep_facts` plus round and help level per go |
| 21 | Wrong answer chosen saved | yes | Taps with picks in `robin_rounds`; slip kind saved |
| 22 | Teacher sees stuck and inactive at a glance | no | Only a pupil page line; no alerts or grid |
| 23 | Fun from the maths, rewards decorate | partly | Give yes; card goes less; rewards are days, not taps |
| 24 | Real choices, visible growth | partly | Ten baskets and friends; almost no child choices |
| 25 | Clear goal, active thinking | partly | "How did you know?" works for give; card goes can be guessed |

## Problems found (worst for learning first)

1. **The answer is nearly always the third card.** Steps 2, 4, 5 and most of 6. See it: play step 4 or 5 and tap the third card every time; or `showRound(makeRound(seed, [], {step: 4, level: 5}))` and look at `choices.indexOf(answer)`. The wrong cards come from fixed offsets (`round.ts:216,221`) then sort. Fix by choosing offsets at random from the slips (e.g. skip one of double or skip, or put the answer at any place).
2. **Counting a group is never required.** In "How many?" a child may tap a card without touching any berry (`Goes.tsx:233-239,357`). Steps: start step 2, ignore the berries, tap a card. Combined with problem 1 the step can be passed by pattern.
3. **Tap-all finishes a go with no maths.** After a wrong tap the card greys; after two, the redo shows two cards with a hand on the right one (`Goes.tsx:184,363`). The cost is a wrong record and a lift in help, so a child who learns this still finishes the day and turns the basket.
4. **The "show why" picture is not the child's own count.** A wrong card shows a row of `pick` berries (`Goes.tsx:53-60`), not the group with the touched berries marked as planned (plan section 3 "Show the child's own count"). It misses the chance to show the skipped or doubled berry.
5. **No demonstration for the first "How many?" and "One more".** Only the first give go is guided (`round.ts:140`, `Goes.tsx:112`). A pre-reader meets "touch each berry" with no demo.
6. **Help level is one per child, not per kind of go.** A child who gives well but cannot count a scattered group gets the same help for both.
7. **Everyone starts at step 1 level 5** (`round.ts:73`): a child who counts to 20 spends about two days on 1 to 5 (needs 2 good challenges at step 1 and step 2 each, so about four days at least before step 3). Not a bug, but slow for strong children (read in code, not seen over days).
8. **"One more" always offers the card "1"** (`round.ts:216`), an easy card to rule out, which lowers the effort needed.
9. Slow rhythm: each right answer holds for 3.2 seconds (`Goes.tsx:34`), about 30 seconds a day of waiting.
10. **Help panel below the fold, overlapping berries, no on-screen words on How many?, controls over the progress dots on a phone, berries fade in late** (all seen in play; see Clarity).
11. The **Today "Needs you" alerts and class grid have nothing for Robin** (see saved data below).

## Saved per child on the server

- **`robin_progress`** (one row a pupil): `days_done`, `last_day`, `step`, `level`, `good_in_row`, `good_at_step`, `version`, `updated_at`.
- **`robin_rounds`** (one row a challenge): `seed`, `round` (JSON: step, level, help, and each go's key and help level `l`), `open`, `taps` (JSON list of `{pick, ms}` for every tap including wrong ones), `mistakes`, `first_right`, `slips` (JSON list, one per go, the kind of the first wrong tap or null), `started_at`, `finished_at`. Rows over 30 days old are deleted when a new challenge starts.
- **`gem_keep_facts`** (shared with the other maths games): `fact_key` such as `give:n6`, `howmany:n6:ring`, `counton:5+1`, `across:n12`; `attempts`, `correct`, `avg_ms`, `box`, `last_seen`, `quick_days`. First tap only, one record per key per challenge.
- The wrong choice is saved (the picks in `taps` and the slip in `slips`); the help level is saved per go in `round`. It is not saved per fact in `gem_keep_facts`.
- Teacher today: the Games table row (on/off switch, players and feasts in the class), the help setting, and the pupil page line and panel (days, step, help level, commonest slip over the last 10 challenges, 3 hardest keys that have 2 or more attempts and box below 2). I found no Today alerts and no class grid for Robin.

Read-only SQL James could run (I did not run them):

```sql
-- Where is each pupil: step, help level, days
select p.player, p.step, p.level, p.days_done, p.last_day
from public.robin_progress p order by p.step desc, p.days_done desc;

-- Error rate by key (first tap), hardest first
select fact_key, count(*) pupils, sum(attempts) tries, round(100.0*(sum(attempts)-sum(correct))/nullif(sum(attempts),0)) pct_wrong
from public.gem_keep_facts
where fact_key ~ '^(give|howmany|counton|across):'
group by fact_key having sum(attempts) >= 10 order by pct_wrong desc limit 20;

-- Stuck: pupils with 6 or more finished days still on step 1 or 2, and slips in their last 10 challenges
select p.player, p.step, p.days_done,
  (select jsonb_object_agg(k, n) from (select s.kind k, count(*) n from (select r.slips from public.robin_rounds r where r.player=p.player and not r.open and r.slips is not null order by r.finished_at desc limit 10) l, lateral jsonb_array_elements_text(l.slips) s(kind) group by s.kind) x) slips
from public.robin_progress p where p.days_done >= 6 and p.step <= 2;
```

## Is it really switched on? (the "In development" sticker)

The sticker is only a label: `inDevelopment: true` in `src/games/robin/index.tsx` and drawn at `src/components/GameCard.tsx:93`. It does not hide the game. In code the game **is on for classes by default**: `ROBIN_ON = true` (`src/games/robin/switch.ts:9`), the registry adds it with `robinOn() ? [robinsBerryBasket]` (`src/games/registry.ts:73`), and the migration creates `app_settings.robin_enabled boolean not null default true` with a `hub_games` row (`supabase/migrations/20261108000100_robin.sql`). The pupil's card also shows only while `useRobinEnabled()` is true, and the function refuses with `game-off` otherwise (`shared/robin/server.ts:119`); if the migration were not applied on the live database the card would stay hidden (fetch fails to false). I cannot tell from code whether the migration has been pasted in live.

## Strengths

- The give goes are a real "give me N and stop" task; the pile always has spares, so nothing stops the child for them.
- Slots, fives and marks are a correct count model; help is six steps and follows the child; teacher can choose Fade, Always or Off.
- Server makes and replays every round; only the first tap counts; wrong picks and the slip kind are kept.
- Plain, kind words that never say the number; voice on every line, hear again always shown.
- A long goal (30 days, ten baskets, Feast, friends) that does not depend on guessing speed; play-again changes nothing.

## Gaps

- Card goes can be won by the third-card pattern and by skipping the counting.
- No demo for the first "How many?" or "One more".
- Replay of the child's own count not built.
- No Today alerts and no class grid for Robin.
- One help level for all kinds of go; no starting check.
- Not seen over several days: step passing, help fading over days, the Golden Berry Feast, a friend's basket, and the teacher page with real data.

## Candidate improvements

1. **Shuffle the wrong cards.** Problem: the answer is third of four about 95% of the time. Change: build wrong cards from a random pick of slips (some over, some under) with the answer in any place, never fixed offsets, and never always "1" in count-on. Files: `shared/robin/round.ts` (pickWrongs, showGo), `shared/robin/robin.test.ts`. Effort S. Impact: High (fixes the main loophole).
2. **Make counting count in "How many?".** Problem: a card is tappable with no berry touched. Change: cards stay greyed until every berry is touched (or at levels 3 to 0 until at least the number of touches matches a card), and the touch order is sent so the server knows if berries were skipped or doubled. Files: `src/games/robin/Goes.tsx`, `shared/robin/play.ts`, server taps. Effort M. Impact: High.
3. **Show the child's own count after a wrong card.** Problem: the picture is a generic row. Change: after a wrong "How many?" light the berries in the order touched, leave a skipped one dark and blink a doubled one (the plan's idea). Files: `Goes.tsx`, `art.tsx`, `words.ts`. Effort M. Impact: Med to High.
4. **Do not hand over the answer on the redo.** Problem: the redo marks the right card with a hand. Change: after "count together" re-ask with all cards (shuffled) and no hand, or pick one only after the child counts along. Files: `Goes.tsx`, `round.ts` (redoCards). Effort S. Impact: Med.
5. **Demo the first time of each kind.** Problem: only the first give go is guided. Change: a short guided go (hand on the berries, then the card) the first time a "How many?" and a "One more" appear, remembered on the server. Files: `Goes.tsx`, `shared/robin/server.ts`, migration for a seen flag. Effort M. Impact: Med.
6. **Help level per kind of go.** Problem: one level for give, count and count on. Change: keep a level per kind (or use the key's Leitner box to pick the level per go). Files: `shared/robin/round.ts`, `progress.ts`, migration columns. Effort M to L. Impact: Med.
7. **Show Robin to the teacher.** Problem: no stuck or inactive view. Change: add Robin to the Today alerts and the class grid (stuck at a step for 6 days, lots of slips of one kind, gone quiet). Files: teacher grid and alerts code (shared with other games; needs James's OK), `TeacherRobin.tsx`. Effort M. Impact: Med (teacher time).
8. **Let a strong child skip ahead.** Problem: everyone starts at step 1 level 5. Change: a quick starting check (two give goes and two counts) after the first day that can set the step. Files: `shared/robin/server.ts`, `round.ts startFor`. Effort M. Impact: Low to Med.

## Learning-design rules (read after scoring)

| Rule | Status | Evidence |
|---|---|---|
| 1. The maths is the move | partly | Give goes are the move; card goes can be guessed. At most two wrong taps then a redo: yes (`Goes.tsx:181-199`). The cards have a tell (third card), the opposite of "no give-away choices" |
| 2. One thing at a time, voice first | met | Bella clips for every line, Hear it again always, the goal ("Give me N") written on screen; the 3.2 s hold is longer than the rule suggests; target sizes not checked |
| 3. Concrete, picture, number | met | Berries and basket, numbered slots, then number above, then plain pile (`config.ts:60-66`) |
| 4. Help arrives by itself | partly | Why line, counting together, level up after three misses; demo only for the first give go |
| 5. Help follows the child | partly | Fade, return, teacher override, all met per child; not per fact, and a new step puts help up two |
| 6. Progression | partly | Research order, mastery of two good challenges, spacing from step 3; no 75 to 90 target; no "what's next" card seen; a ladder of 6 steps with 30 days, a quick child may finish steps early and repeat |
| 7. Mistakes teach | partly | Slip-based wrong cards and lines, count together, redo; the picture is not the child's own count; the redo marks the answer |
| 8. Fair timing | met | `JUNIOR_QUICK_MS` used (`entry.ts:75`); clock starts after the voice (`Goes.tsx:131`) |
| 9. Record evidence | partly | First tap, ms, key, slip, help per go saved; nothing on Today alerts or class grid |
| 10. Fun comes from the maths | partly | Give is satisfying; baskets and Feast reward days; card goes are quiz-like |

**Game kit parts used** (checked in code): `shared/kit/help` (STEP_RULES, fadeAfter, helpWithSetting), `shared/kit/replay` (replayTaps), `shared/kit/dayArc`, `shared/kit/mistakes` (tagWrongs, stepGo, NEW_GO) and the `ShowWhy`, `LookTogether`, `NowYouTry`, `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `WhatsNext` and `FirstTimeTip` screens, `shared/juniorQuick`, `recordMathsAnswers`.
**Kit parts it could use but doesn't:** `TenFrame` (the basket has its own two-row-of-five slots, and the plan named TenFrame for N5), `DotPicture`, `NumberLine` (not needed here), `shared/kit/teacherGrid` (K5, class grid rows and stuck flags) which would fix problem 10, and `voiceLinesSuite` is used only through its own test (`voiceLines.test.ts`).
