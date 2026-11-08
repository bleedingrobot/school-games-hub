# Kiwi's Beanstalk: second review (8 Nov 2026)

Blind evaluation. Played in the preview (`vite.beanstalk-preview.config.ts`, port 5301) in the Browser pane, plus all code read. Each evidence line is marked **(play)** seen in the preview or **(code)** read in code. The preview runs the same server rules as the live function (`shared/beanstalk/memoryServices.ts`), so play and code agree. Not tested: the real server, the teacher pages in a browser, and the real recorded voice (the preview voice could not be heard).

## How it works

A friend (Kiwi first) is stuck on a cloud at the top of a clay beanstalk. The child picks Jack or Jill, presses Play, and six floating leaves appear, each with a number and a ten-frame of dots. They tap two leaves that make the target ("Make 10"). A right pair flies up, a pip lights and the stalk grows. A wrong pair wobbles, shows a joined ten-frame with the extra or missing dots glowing and a short line ("2 and 6 make 8. Not enough."); a second wrong pair in the same go starts "Let's look together", which fills the first leaf's frame to the target, then "Now you try". Ten pairs finish the day. The first finish each NZ day turns one of ten magic leaves bronze, silver, then gold (30 days), then a Golden Egg and a new friend on a new beanstalk with a bigger sum. On three goes in each round (the 4th, 7th, 10th) one leaf is already picked and the child taps the missing partner ("2 + ? = 10").

## The maths

Four beanstalks in order, one per Golden Egg, then they repeat (`shared/beanstalk/round.ts:26`, `progress.ts:20`): bonds to 10, bonds to 20, bonds to 100 (tens), bonds to 1000 (hundreds). Each lasts 30 finished days (`progress.ts:13`).

- **To 10** (`round.ts:55-73`): ten pairs per day from 1+9 to 5+5 (0+10 left out). Pool is each of 1-4 pairs twice, 5+5 once, one extra of 1-4. Which leaf is first is random.
- **To 20** (`round.ts:79-87`): 1+19 to 9+11, each once plus one repeat; 10+10 and 0+20 left out. Two ten-frames (20 squares).
- **To 100 / 1000**: the same pairs scaled by 10 or 100 (`round.ts:70-71`); each dot is a ten or a hundred, labelled "10 each". The first challenge on a bigger beanstalk gets a bridge line ("Each dot is a ten. 6 tens and 4 tens make 10 tens.", `Round.tsx`, `words.ts` `bridge`) and the pointing hand.
- **Order of goes:** a fixed random shuffle from a server seed. Six leaves at once (`ON_SCREEN`, `round.ts:38`); no number is on screen twice except the two 5s (`round.ts:156-174`); the tray that fills to six must contain a near miss (e.g. 3 and 6 tempt 9) (`letIn`, `round.ts:169`).
- **Which sum next:** only by egg count (`targetFor`, `progress.ts:20`), i.e. after 30 finished days on a beanstalk, never by skill. A child who is secure at 10 in 5 days still spends 30 days on it. A child who is not secure still moves on at day 30.
- **Which help (dots):** per child, `placeAfter` (`progress.ts:100`) with `fadeAfter` (`shared/kit/help.ts:71`): two good days in a row (8 or more of 10 right at the first tap) takes the dots down one step (full, small, none); a hard day (4 or fewer) brings one back; a new sum starts at full. Only the day's first finish counts. Inside a round, three goes in a row with a wrong first tap bring full dots back for that round (`Round.tsx:203`, `kit/help.ts:16`).
- **What is scored:** one answer per go, its first tap only (`round.ts:201`). A wrong first tap is recorded against the first-tapped leaf's fact, e.g. `bond10:3+7` wrong. Bonds to 100 and 1000 each use a single key (`bond100:tens`, `bond1000:hundreds`, `round.ts:98-99`), so individual pairs cannot be told apart.

## Scores

| # | Criterion | Score |
|---|---|---|
| 1 | Maths fidelity | **3** |
| 2 | Clarity | **3** |
| 3 | Support and structure | **4** |
| 4 | Fading | **3** |
| 5 | Progression | **3** |
| 6 | Feedback | **3** |
| 7 | Progress recording | **2** |
| 8 | Engagement | **3** |

### 1. Maths fidelity: 3
- The action is the maths: pick the two leaves whose numbers sum to the target; the ten-frame is the right model for bonds to 10/20 and each dot as a ten for 100 (play, `Leaf.tsx:32-55`).
- Guessing mostly fails at the start of a go: 15 possible pairs of six leaves, and a "near miss" is always present (code `round.ts:169`; play: tray 2,1,9,8,6,4 had 2+8, 1+9 as the only right pairs).
- Loophole 1, elimination (play): after one wrong pair the two leaves can no longer be tapped together (`Round.tsx:159`). Played the random tapper: with 1 picked I tapped 2, 6, 8, and every tried leaf greyed out, leaving only 9. A child can finish with no maths in at most five taps per go. Cost: that go's first tap is marked wrong (so a wrong is recorded) and nothing else; the pair still counts toward the ten and the leaf still turns.
- Loophole 2 (play): the missing-leaf goes are often free. The 10th go had only two leaves on screen, 6 and 4, one choice (play). The 4th go with 2 picked: 8 was the only leaf that fits among 8,4,5,5,6(greyed) so it takes little thought either.
- Loophole 3 (code): the tray at four leaves (`round.ts:171`) near the end has two pairs, i.e. a 1 in 3 chance per first tap.
- Item 3: ten-frame correct (play). On 100 and 1000 the "10 each" dot frames are correct but still show 10 squares for 100, so 70+30 is shown as 7 and 3 dots (play).

### 2. Clarity: 3
- A pre-reader can start (play): Jack/Jill with pictures, one big Play, then a pointing hand on the very first go, with "Make 10" always on screen, and a "Hear it again" button (`Round.tsx` bs-hear; voice on by default, `BeanstalkGame.tsx:28`). Voice lines are spoken, with recorded clips (`voiceLines.ts`). I could not hear them.
- One thing at a time (play): the play screen is the scene on top, a pip row, the badge and six leaves. The scene is large painted clay art that takes up about 60% of the screen but does not hide the maths. The why-panel sits on top of the scene, not the tray (play).
- Targets are big (play: leaves about 110 by 100 px at 800 wide; test asks for 64 px or more, `beanstalk.test.tsx`). No timer. A session is 10 pairs.
- Wobble: the why-panel fades in over the scene and for a moment overlapped the kiwi/child before settling (play, a screenshot caught it mid-fade).
- Cluttered moment: "1 and 1, 2, 3, 4, 5, 6, 7, 8, 9 more make 10." is a long number string for a 5-year-old (play); it is accurate but dense.
- The "Preview tools" and "Voice on" buttons are small. "Voice off" is the only way to stop the voice (play).

### 3. Support and structure: 4
- Model present from the start: ten-frame dots on every leaf (play, `Leaf.tsx:44`), at full strength on day 1.
- Automatic help after mistakes (play): first wrong, the joined frame and a line; second wrong, "Let's look together" filling the first leaf's frame to 10, then "Now you try: what goes with 1?" with the 1 still picked. No hint button needed.
- Worked example: the guided first go, hand pointing at a pair then at its partner (play, `Round.tsx:226`); it comes back on the first go of each new bigger beanstalk (`BeanstalkGame.tsx:152`), with a bridge line for the new sum (play, day 60: "Each dot is a ten. 6 tens and 4 tens make 10 tens. That is 100."). The missing-leaf goes get no introduction the first time they appear (play; they simply start on go 4).

### 4. Fading: 3
- Fades with success in steps (full, small, none) per child and not by calendar (`progress.ts:100`, `kit/help.ts:71`), and returns with struggle: a hard day (4 or fewer) steps back, and three wrong first taps in a row bring dots back inside the round (`Round.tsx:203`). That meets items 10 and 11 in code.
- Why not 4: fading is per child (not per fact), so a child secure at 3+7 but not at 4+6 gets one level for all pairs; the fade step is a whole day (two days in a row of good days to move one step, so three levels take at least four days); the "none" level means the leaf shows only the number, with no middle step such as "dots appear on tap".
- Item 12 (expertise reversal): partly. A fast child still has full dots on day 1 and 2 and cannot turn them off; a teacher can turn off dots only for the whole class. The "Make 10" badge, the "Hear it again" button and the voice line "Tap two leaves that make 10" play every go; the voice cannot be turned off for just the repeated lines (only on/off).
- Not seen in play: the fade across days (I used the preview tools to set the dots level; I did not play two good days).

### 5. Progression: 3
- Sensible research order: 10, then 20, then 100 (tens), then 1000 (`round.ts:26`). Small parts before bigger. Dots first, then small, then none. Near-miss trays. The missing-leaf goes bring 7+?=10 and "10 take 7 is 3" (play, `words.ts` `takeAway`).
- Per-child adaptation is only the dots level. The sum, the pairs and the number of pairs are the same for every child (30 days at each sum). The pairs are all ten, with no weighting to the child's weak pairs (`round.ts:61-63`).
- No mastery gate: the next sum comes at day 30 whatever the child's accuracy. There is no spacing back to the earlier sums (once on the 100 beanstalk, no bonds to 10 appear) and no mixing of sums. One exception: the Weka card on the finish screen (`signpost.ts:23`) shows when the sum is secure, so a fast child has somewhere to go.
- No "weakest facts first" selection, although the facts are tracked (`gem_keep_facts`).

### 6. Feedback: 3
- Every first wrong pair gets a reason on the same ten-frame picture (play: "2 and 6 make 8. Not enough." with 8 filled and two yellow glowing empty squares); the kind of error is classified (over, under, close, digit) (`round.ts:146`) and the line changes with it ("Just one more would make 10." in play after 1+8).
- Another go with help: yes, "Now you try" after the second wrong (play).
- Gaps: right answers get "Well done!" (play: "Well done! A leaf turned bronze!"). That is praise for the result, not for effort or a strategy ("you made ten"). After a right pair the line "7 and 3 make 10!" is fine. Tone of wrongs is kind (never "wrong" in the copy, `words.ts:63-79`).
- The "Let's look together" panel counts 1 to 9 aloud for 1+9; that is a lot of reading for a child at a hard moment (play).
- After a third and later wrong pairs in the "Now you try" go (the redo), wrong pairs still get the why line but not another look (`kit/mistakes.ts:88`). Good, but the elimination loophole is how those go ends.

### 7. Progress recording: 2
- Server saves per child: `beanstalk_progress` (child, `days_done`, `last_leaf_day`, `help`, `good_in_row`, version) and `beanstalk_rounds` (seed, taps jsonb, mistakes, started/finished) (code: migrations `20261104000700`, `20261107000300`).
- Per-fact attempts and correct are saved in `gem_keep_facts` (attempts, correct, avg_ms, box, last_seen, quick_days) via `record_fact_answers`, one answer per go (code `round.ts:201`, `server.ts:172`).
- The wrong choice that was tapped is not saved as a fact: only "wrong, against the first leaf's pair" (code `round.ts:121-127`). The taps are saved as leaf indexes in `beanstalk_rounds.taps`, from which the numbers could be rebuilt by replaying the seed, but not by plain SQL. The kind of mistake (over, under, close, digit) is not saved anywhere.
- Help level is saved only as the child's current level, not per round; the dots boost inside a round is not saved.
- Bonds to 100 and 1000 are one key each, so a teacher cannot see which pair is hard.
- Teacher view exists: the Foundational grid with an idea column "Bonds to 10" and "Bonds to 100 and 1000", stuck flags and a "!" with words (`src/teacher/foundational/*`), Hardest right now via `gameKeys`, and a Games table line (class players and Golden Eggs, `teacher.ts:36`). Not seen in a browser.

### 8. Engagement: 3
- Fun from the maths: the tap-a-pair-and-it-flies motion, the stalk growing and the clay art (play) are tied to correct pairs, and rewards (leaf colours, egg) are for finishing a day, not for taps. No points, nothing for tapping (`words.ts`, plan s.9).
- Choice: Jack or Jill once; nothing else (no choice of friend or sum). Visible growth: 10 magic leaves, Day N of 30, egg shelf (play). No social features, so nothing unkind.
- Because the finish needs ten right pairs and a leaf turns even after wrong taps and the elimination path, a child can earn leaves with little maths (code `round.ts:202`). Risk is moderate: the reward is calendar-based (one leaf a day), so there is little to gain by rushing.
- Clear learning goal: "Make 10" on the badge always (play). "How did you know?" is easy to ask in class ("what goes with 7?").

## The 25-item checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Maths action is the game | yes | tap two leaves that sum (play) |
| 2 | Cannot win by guessing/tapping everything | partly | tried-pair greying lets one leaf be found by elimination (play) |
| 3 | Representation right | yes | ten-frames, 20 as two frames, "10 each" (play) |
| 4 | Pre-reader can start alone | yes | pictures, hand, voice, Hear again (play; voice not heard) |
| 5 | One question, one action | yes | one badge and one tray (play); long why-panel over the scene |
| 6 | Big targets, no timer, short | yes | leaves large; 10 pairs; no timer (play) |
| 7 | Model available when new | yes | dots on every leaf at start (play) |
| 8 | Help automatic after mistakes | yes | why line, then look together (play) |
| 9 | Worked example first time | partly | hand on first go and on new sums; none for missing-leaf goes (play) |
| 10 | Support reduced stepwise | yes | full, small, none (code `progress.ts:100`); not seen across days |
| 11 | Support returns on struggle | yes | hard day steps back, 3 wrong first taps give dots (code) |
| 12 | Experts not slowed | partly | fade takes 4+ days; badge/voice/Hear-again stay; class-only dots switch |
| 13 | Sensible difficulty order | yes | 10, 20, 100, 1000 (code) |
| 14 | Adapts to 75-90% success | no | only dots adapt; pairs and sum are fixed; no target rate |
| 15 | Older skills return, mixing | no | no review of earlier sums; no mixing (code `round.ts`) |
| 16 | Move-up needs mastery | no | sum changes at day 30 regardless; dots need two good days (partly for dots) |
| 17 | Mistake shows what and why, same model | yes | joined frame with glowing dots (play) |
| 18 | Another go with help | yes | Now you try (play) |
| 19 | Praise effort, "not yet" | partly | kind words; praise is "Well done" for result (play) |
| 20 | Server saves per child, per skill | yes | `gem_keep_facts`, `beanstalk_progress` (code) |
| 21 | Actual wrong answer saved | partly | only taps as leaf indexes in `beanstalk_rounds.taps`; no kind, no number (code) |
| 22 | Teacher sees stuck/not played | partly | Foundational grid and flags exist (code, not seen in a browser) |
| 23 | Fun from maths, rewards decorate | yes | pair flies, stalk grows; leaf per day (play) |
| 24 | Real choices, visible growth, kind social | partly | Jack/Jill, leaves and eggs; no other choice |
| 25 | Clear goal, active thinking | yes | "Make 10", missing-leaf goes (play) |

## Problems found, ranked by harm to learning

1. **Elimination wins goes with no maths.** Steps: start, pick any leaf, tap each other leaf in turn. Each wrong pair greys its partner out (`Round.tsx:159`), so after at most 4 taps only the right partner remains. Seen in play with the 1: tapped 2, 6, 8 and only 9 was left. Cost to the child: one recorded wrong for that go (first tap only), which also puts the fact back to Leitner box 1. A random tapper's record would look like 100% wrong at the first tap but the leaf still turns. Teachers will see a pupil stuck, but the game itself will not stop them.
2. **No mastery gate on sums and no review.** The sum changes only by egg count (`progress.ts:20`). A child who still gets 6+4 wrong moves to 20 at day 30; a child who knew all of it on day 3 spends 27 more days on 10. Nothing from earlier sums comes back.
3. **Bonds to 100 and 1000 are one key each** (`round.ts:98-99`), so a teacher cannot see which pair (e.g. 40+60) is hard, and the game cannot pick the weak pair next time.
4. **Pairs are not chosen by weakness.** The ten pairs are a fixed pool from the seed (`round.ts:61`). The facts are tracked but not used to choose the day's pairs.
5. **The missing-leaf goes can be trivial.** In the 10th go only two leaves remain (play: 6 and 4), and the missing-leaf go has no first-time explanation. The 7+?=10 form is the best part of the game, but it is the easiest to bypass.
6. **Wrong choice and its kind are not saved**, so a teacher cannot see, for instance, a "tens slip" on the 100 beanstalk (`mistakeKind` is computed on the server but only `correct` is stored).
7. **Praise is "Well done!"** (`words.ts:83`), outcome praise, never about the strategy.
8. **Long "look together" line** counts up to 9 for 1+9; dense for a 5-year-old (play).
9. **Voice cannot be partly muted:** the badge and the same opening line repeat every go for a child who no longer needs them.
10. **Why-panel overlaps the scene while fading in** (play, brief).

## Saved per child on the server

- `beanstalk_progress` (one row per pupil): `player`, `child` (jack/jill), `days_done`, `last_leaf_day`, `help` (0 full, 1 small, 2 none), `good_in_row`, `version`, `updated_at`.
- `beanstalk_rounds` (one row per challenge): `player`, `seed`, `open`, `taps` jsonb (array of `{a, b, ms}`, leaf indexes, wrong taps included), `mistakes`, `started_at`, `finished_at`. Finished rounds over 30 days old are deleted (plan, Stage 3). The wrong pair as numbers is recoverable only by re-making the round from the seed in code.
- `gem_keep_facts` (pack, `fact_key`, attempts, correct, avg_ms, box, last_seen, quick_days), keys `bond10:a+b`, `bond20:a+b`, `bond100:tens`, `bond1000:hundreds`. The wrong choice and help level are not saved with these. Help level is saved only as `beanstalk_progress.help`.
- **What a teacher sees today (code, not opened in a browser):** the Foundational skills grid with Bonds to 10 and Bonds to 100/1000 columns, stuck flags and a "!" in words (`src/teacher/foundational/`), "Hardest right now" for the game (`gameKeys`, `ideas.ts:60`), the Games table line (class players and Golden Eggs), and the pupil's days done, last day and last 10 finished challenges with wrong count and tap count (`teacher_class_games` in migration `20261107000100`). Today's alerts and the class grid come through the same Foundational views.

Read-only queries for James (not run):

```sql
-- 1. Where each pupil is: days done, current sum, dots level, last day played
select p.player, p.child, p.days_done, p.days_done % 30 as day_in_stalk,
       (array[10,20,100,1000])[(p.days_done / 30) % 4 + 1] as sum_now, p.help, p.good_in_row, p.last_leaf_day
from public.beanstalk_progress p order by p.last_leaf_day nulls first;

-- 2. Error rate per bond for bonds to 10 (first-tap answers)
select fact_key, count(*) as pupils, sum(attempts) as attempts, sum(correct) as correct,
       round(100.0 * sum(correct) / nullif(sum(attempts), 0)) as pct_right
from public.gem_keep_facts
where fact_key like 'bond10:%' group by fact_key order by pct_right;

-- 3. Stuck pupils: finished rounds with 20+ wrong taps in the last 14 days
select r.player, count(*) as rounds, round(avg(r.mistakes), 1) as avg_wrong,
       max(r.mistakes) as worst
from public.beanstalk_rounds r
where r.finished_at > now() - interval '14 days'
group by r.player having avg(r.mistakes) >= 10 order by avg_wrong desc;
```

## Strengths

- Maths is the move; the ten-frame is the right model and carries to tens and hundreds.
- Best mistake handling of the junior games seen: reason on the same picture, "look together", "now you try" (play).
- Help follows the child (dots fade by success, return by struggle), not just by calendar (code).
- Server replays every tap and decides the day, leaf and help; nothing trusted from the browser (`server.ts`).
- Near-miss trays and no repeated numbers stop "same-looking" matching.
- Missing-leaf goes (7 + ? = 10) bring in the take-away form.
- Calm, short, no timer, painted art that supports the story.
- Bonds to 20 added, with two ten-frames, and a link to Weka at the top.

## Gaps

- Elimination (greyed tried pairs) lets a tapper find the partner.
- No mastery gate or review for sums; the same 30 days for everyone.
- Pairs are not picked by the child's weak facts; no 75-90% target.
- Wrong answer and kind not saved; bonds to 100/1000 are not per pair.
- Outcome praise only; no strategy praise.
- Missing-leaf goes are not introduced and can leave one choice.
- The expert cannot skip dots or voice lines within a class that has dots on.

## Candidate improvements

1. **Stop elimination.** Problem: tried pairs grey out. Change: after the second wrong pair in a go, show "Let's look together" (already) and keep all other leaves tappable but do not grey out tried leaves (only grey the leaf pair just tried for 1 second), and count wrong taps in the redo so three wrongs in the redo show the answer. Files: `Round.tsx`, `round.ts` (`tried`), `kit/mistakes.ts`. Effort S to M. Impact: high; removes the main way to win without maths.
2. **Pick pairs by the child's weak facts.** Problem: pool fixed by seed. Change: the server passes the child's weakest 2-3 facts (from `gem_keep_facts`) into `makeRound`, keeping 5+5 and the near-miss rule. Files: `round.ts`, `server.ts`, `handler.ts`, `entry.ts`. Effort M. Impact: high (aim at 75-90% success).
3. **Mastery gate and review for sums.** Problem: sum moves at day 30 for all. Change: move to the next sum when the current sum's facts are secure (the `factKeys` check already exists), and after that put 2 of 10 pairs from earlier sums in each round. Files: `progress.ts`, `round.ts`, `BeanstalkGame.tsx`. Effort L. Impact: high.
4. **Per-pair keys for 100 and 1000** (`bond100:30+70`) and save the wrong choice with its kind. Change: new keys plus a small `beanstalk_mistakes` table or a kind field in `taps`. Files: `round.ts` (`bondKey`), `server.ts`, a migration, `shared/maths/skillPacks/placeSkills.ts` (shared, needs James's OK), teacher `ideas.ts`. Effort M to L. Impact: medium to high for teachers.
5. **Introduce the missing-leaf go and make it fair.** Show a demo the first time (hand and "2 + ? = 10"), and on go 10 keep at least three leaves. Files: `Round.tsx`, `round.ts` (`MISSING_GOES`, `letIn`). Effort S. Impact: medium.
6. **Strategy praise.** Replace "Well done!" with lines such as "You made ten with 7 and 3!" or "You tried again and found it!". Files: `words.ts`, `voiceLines.ts`, clips (`scripts/voice-clips.py`). Effort S. Impact: low to medium.
7. **Shorter look-together.** Count the new dots only in the frame (no list of numbers), say "7 and 3 more make 10". Files: `words.ts` `fillUp`, clips. Effort S. Impact: low to medium.
8. **Faster fade for strong children.** Allow a first-day "none" for a child with 10 of 10 first-tap right in a go-by-go streak, and add an "I know these" skip for the badge and repeated voice. Files: `progress.ts`, `kit/help.ts` (shared kit, own branch), `Round.tsx`. Effort M. Impact: medium.

## Learning-design rules

Read after scoring.

| Rule | Result | Evidence |
|---|---|---|
| 1. The maths is the move | partly | Tap two leaves that sum (play); but tried-pair greying lets a child find the partner by elimination (play, `Round.tsx:159`) |
| 2. One thing at a time, voice first | met | Pictures, hand, voice, Hear again, Make N badge (play, `words.ts`); no timer |
| 3. Concrete, then picture, then number | met | Dots (full, small, none) with the number always shown; tens and hundreds via "10 each" (`Leaf.tsx`) |
| 4. Help arrives by itself | met | Why line, look together, now you try, guided first go and bridge on new sums (play). Missing-leaf go has no demo |
| 5. Help follows the child, not the calendar | met | `placeAfter` per child, hard-day step back, 3-wrong boost (`progress.ts:100`, `Round.tsx:203`). Per child not per fact |
| 6. Progression | partly | Research order, 30-day sums; no mastery gate, no review of old sums, no 75-90% targeting; what's next card to Weka exists (`signpost.ts`) |
| 7. Mistakes teach | met | Kinds over/under/close/digit; show why; look together; redo (play, `round.ts:146`, `kit/mistakes.ts`); wrong kind not saved |
| 8. Fair timing | partly | Clock starts after the opening line (`Round.tsx` `heard`); no timer; ms saved, but ms uses first tap only and a long voice line on the 100 beanstalk can still start the clock |
| 9. Record evidence a teacher can use | partly | Per-fact attempts and correct, taps jsonb; no wrong choice or kind; 100 and 1000 one key each; Foundational grid and flags exist |
| 10. Fun comes from the maths | met | Pair flies, stalk grows; one leaf a day, no points, no tap rewards (code) |

**Kit parts used (code):** `shared/kit/help.ts` (`fadeAfter`, `ROUND_OF_TEN`, `helpWithSetting`, `STRUGGLE_GOES`), `shared/kit/mistakes.ts` (`kindByUnits`, `hasNearMiss`, `stepGo`), `src/kit/ShowWhy` (`ShowWhy`, `LookTogether`, `NowYouTry`, `useLookTogether`), `src/kit/WhatsNext`, `shared/kit/teacherGrid` (through the teacher Foundational grid), `NextPartChip`.

**Kit parts it could use but doesn't:** `shared/kit/dayArc.ts` (Beanstalk has its own copy in `progress.ts`, with `nzDate` and `finishChallenge` duplicated), `shared/kit/replay.ts` (own `replay` in `round.ts`), `src/kit/TenFrame` (own frame in `Leaf.tsx` and `JoinedFrame`), `src/kit/HearAgain` and `PointingHand` and `useGuidedFirstGo` (own `bs-hear`, `bs-hand` and guide logic in `Round.tsx`), `src/kit/FirstTimeTip` (would suit the missing-leaf intro), `src/kit/voiceLinesSuite` (its own `voiceLines.test.ts`), `shared/kit/help.ts` `helpForFact` (per-fact help instead of per-child), and a `mastery` check (the plan lists `mastery`; not used for moving sums).
