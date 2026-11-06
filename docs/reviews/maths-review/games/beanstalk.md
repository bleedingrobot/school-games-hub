# Kiwi's Beanstalk: evaluation

Evaluated 7 Nov 2026. Read all the code, plan, server function and migrations, and played the preview (port 5301) through day 1, day 11, day 21, day 30 and the first day of the 100 beanstalk. No game code was changed.

## How it works (summary)

A kiwi is stuck on a cloud at the top of a beanstalk. Each day the child plays one challenge: six leaves float in a tray, each showing a number and a ten-frame of dots. They tap two leaves that add to 10. A right pair flies up the stalk and the stalk grows; a wrong pair wobbles and stays, with no penalty and no explanation. Ten right pairs finish the challenge. The first finish each NZ day turns one of ten magic leaves bronze, then silver, then gold (30 days), then the child wins a Golden Egg and a new friend is stuck on a new beanstalk. The sum goes 10, then 100 (70 + 30), then 1000 (700 + 300), then round again. The game talks (a voice reads every line), has a Jack or Jill choice, and a hand guides the very first go.

## The maths

- **Question type:** only one: "tap two leaves that make N" (N = 10, 100 or 1000). Recognition of a bond, not recall: the answer is on screen.
- **Round shape** (`shared/beanstalk/round.ts:40-58`): each challenge uses 10 pairs: 1+9, 2+8, 3+7, 4+6 twice each, 5+5 once, and one extra pair from 1 to 4. 0+10 is left out (`round.ts:34`). Six leaves are on screen at once (`ON_SCREEN`, `round.ts:23`). When a pair is made, the next pair's two leaves float in.
- **Any two leaves that sum to N count** (`round.ts:99`), so 3 from one pair and 7 from another is fine.
- **Order of levels:** set only by days played, not by how the child is doing (`shared/beanstalk/progress.ts:22-46`). Days 1-10: full ten-frame dots. Days 11-20: small, faint dots. Days 21-30: no dots. Then `targetFor(eggs)` (`progress.ts:19`) moves to 100 on the second beanstalk, 1000 on the third, then 10, 100, 1000 again. The same 10-pair shape is used for every sum, scaled by `target / 10` (`round.ts:57`).
- **Next level is chosen by the calendar**, one day per NZ day (`finishChallenge`, `progress.ts:66`). Nothing reads mistakes, speed or which pairs are weak. A child who makes 40 mistakes a day and a child who makes none get the same next day.
- **Not used:** the hub's shared focus / Leitner "weak facts" system. `makeRound` ignores it (plan doc section 3 says it was checked and judged not to fit). Answers are only written to the records afterwards.

## Scores (1 to 4)

**1. Maths fidelity: 2.**
- It does teach "which two numbers make 10", with a ten-frame, and the pairs are right (`round.ts:49-58`).
- But winning does not need the maths. A wrong pair costs nothing, nothing is shown, and there are only 15 possible pairs among six leaves. I tapped blindly (random pairs, no thinking) and finished the challenge with 26 wrong and 8 right taps (about 3 wrong for each right). A child can finish every day this way and still get the leaf.
- At bronze level the dots can simply be counted ("is it 10 dots altogether?") rather than known. That is fine as a support, but nothing ever asks for the fact without it except after day 20.
- It is always "choose from what is on screen", never "what goes with 7?". Recall is never tested.
- Leaf numbers on the 100/1000 beanstalks are all multiples of 10 or 100 (`round.ts:57`), so those beanstalks are really "same bonds, bigger numbers". That is a sound idea, but the first day jumps from 3+7 to 30+70 with no bridging screen.

**2. Clarity: 3.**
- Very few words, a voice reads every line (`voiceLines.ts`, `words.ts`), a Voice off button, and a big pointing hand on the first go (`Round.tsx:105-107`). The hand follows the child and cannot get stuck.
- Targets are large (the plan and a test ask for 64px or more). The home screen is one Play button.
- Playing: the instruction "Tap two leaves that make 10" is only spoken and is a hidden heading (`bs-sr`, `Round.tsx:114`). No written "10" is on the play screen, so a child who misses the voice (muted tablet, Voice off) has nothing on screen to say what the target is. Also on the Choose screen the Jack/Jill buttons had no accessible name in the page tree (the name is in a span; check with a screen reader).
- "Pretend it is tomorrow" style reasoning is not needed by the child. "Day 1 of 30" and "Next leaf tomorrow" are fine.

**3. Support and structure: 3.**
- Every leaf shows a ten-frame of dots on days 1-20 (`Leaf.tsx:38-44`). This is the right model for bonds to 10, and on the 100 and 1000 beanstalks each dot is "10 each" or "100 each" (`Leaf.tsx:45`).
- Support is passive. There is no hint button, no "show me", no "what makes 10 with this?" and no partner highlighting (the hand only works on the first go). A stuck child just keeps guessing.
- Dots can be turned off for the class by the teacher (`teacher_set_beanstalk`), a good control.
- For 100/1000 the support is less good: a ten-frame of 7 filled dots labelled "10 each" is a lot of reading for a 6-year-old.

**4. Fading: 2.**
- Fading exists and is a good idea: full dots, then small dots, then none (`progress.ts:46`). I saw this working: day 11 had small faint dots (`bs-frame--small`), day 21 no dots at all.
- But it fades on a fixed clock (10 days each), not on success. A child still making many mistakes loses their dots on day 21 anyway; a child who knows all the bonds still gets 10 days of full dots.
- It never comes back for a struggling child. The only way dots return is a new beanstalk (day 1 of the 100 beanstalk shows full dots again with "10 each", which is a sensible reset).
- Good for a whole class with a shared schedule, weak as real adaptive fading.

**5. Progression: 2.**
- The order 10, 100, 1000 is on a sensible bonds path, and every pair 1+9 to 5+5 is in every round, but 5+5 is only once and the same set of facts is replayed for 30 days.
- There is no step towards recall: no "one missing" (3 + ? = 10), no "what is the partner of 6?", no bonds to 20, no subtraction link, no mixed-up targets. After the first few days nothing new is asked, so it becomes a 30-day repeat of an identical task.
- 5 + 5 can be made by the two 5 leaves only, but in tests the same number often appears twice on screen at the same time (day 21 I saw 2,8,6,4,6,4 on screen), which makes finding pairs easier by matching two of the same number.
- It adapts to nothing: no mistake rate, no response time, no weak facts used.
- 30 days is a long time before the sum changes. A confident child could be bored for 5 or 6 weeks.

**6. Feedback: 1.**
- A wrong pair wobbles and says "Try again!" (`Round.tsx:85-87`, `words.ts:22`). It never says why, never shows the two numbers' total, never highlights the gap, never shows the dots joined together. The plan chose this on purpose (decision 3 in plan section 9: "the dots are the help").
- A right pair says "3 and 7 make 10!" (`words.ts:19`), which is good and a useful reinforcement (the voice reads this for every pair).
- No consequence pattern is used: after repeated wrong taps in a row, nothing changes (no hint, no pointing hand).
- Because the wrong answer is not named, a child cannot learn "4 and 8 is 12, too many". The bonds learning is entirely left to the dots.

**7. Progress recording: 2.**
- Saved well on the server: one answer per tap into the hub's maths records (`shared/beanstalk/round.ts:84-86`, `server.ts:151-154`), so the child's bond10 fact record (attempts, correct, speed, Leitner box) gets updated. The finished taps and mistake count are also kept per round (`beanstalk_rounds.taps`, `mistakes`).
- But a teacher cannot see any of that. The teacher pages show only: the on/off switch, a Maths column line "Bonds to 10 · 3 playing · 1 Golden Egg" (`teacher.ts:17-24`), a drawer for dots on/off, and on each student's page "12 of 30 days done on this beanstalk · Golden Eggs". There are no mistakes, no stuck pupils and no pair-by-pair detail, and nothing on the Today page.
- The Maths column always says "Bonds to 10" even on the 100 and 1000 beanstalks (`teacher.ts:20-23`).
- A wrong pair is recorded against the first-tapped leaf's pair (`round.ts:93`), a reasonable guess but it can give "wrong" to a fact the child actually knew (they tapped 3 then a 9 by accident). On 100 and 1000 every pair is the same key (`bond100:tens`, `bond1000:hundreds`; `round.ts:67-71`), so the records cannot show which pair is weak.
- A teacher cannot tell the difference between a child who finishes with no mistakes and one who guesses their way through.

**8. Engagement: 3.**
- The clay art is warm and consistent, and the stalk growing and the ten magic leaves changing colour are a good, visible reward. The Golden Egg and new NZ friends (tūī, kererū, wētā, ruru, takahē) give a goal across a term. No points and no ranking suit the age.
- The reward is tied to showing up, not to the maths: the leaf turns even if the pairs were guessed. The loop is short (about 2 minutes) and the same each day, so over 30 days it can feel samey.
- The pieces are good fun to tap: the leaves bob, fly up, the stalk grows. The sounds follow the hub's sound setting.
- The long 30-day arc is a good motivator for a class who play 3 to 4 days a week, but a child who misses days feels no loss and no urgency (a deliberate choice).

## Problems found while playing

1. **Guessing wins.** Random pairs, no thinking, no cost: 26 wrong and 8 right taps to finish the day. There is no limit, no slowdown, and nothing changes after many wrong taps.
2. **The sum is never written on the play screen.** The only place it is said is the voice (and a hidden heading for screen readers). With Voice off a child cannot tell if it is 10, 100 or 1000.
3. **Duplicate numbers on screen.** E.g. 6,2,8,4,3,7 then 2,8,6,4,6,4. With two of the same number floating, a child can match "same looking" numbers and tick them off by elimination.
4. **A wrong pair gives no information.** It wobbles, "Try again!", and that is all. The wrong pair is not named, and the "try again" is read aloud for every wrong tap.
5. **Difficulty jumps at the egg.** On day 30 a child who has just reached the end of the 10 beanstalk starts the 100 beanstalk with 70 + 30 immediately (I saw 50, 80, 20, 90, 10, 50 with "10 each" under each). There is no bridging ("7 tens and 3 tens make 10 tens") and the dots go back to full.
6. **The home screen says "Next leaf tomorrow" and then repeats the long sentence "Come back tomorrow to change another leaf. You can play as much as you like, but only one leaf will change a day."** That is a lot of words for a 5-year-old, read aloud on every visit.
7. **The Choose buttons** (Jack and Jill) have no accessible name in the page tree (`BeanstalkGame.tsx:158-161`: the child's name is in a span, but the button's image has an empty alt). Worth checking with a screen reader.
8. **Preview only:** the first-go guide hand correctly followed my taps, and disappeared after the first right pair. A second tap on the same leaf deselected it, which worked.

## What is saved on the server

- **`beanstalk_progress`** (one row per pupil): `player`, `child` ('jack' or 'jill'), `days_done`, `last_leaf_day`, `version`, `updated_at` (`supabase/migrations/20261104000700_beanstalk.sql:20-27`). The leaf colours, eggs, friend, sum and dots level are all worked out from `days_done`.
- **`beanstalk_rounds`** (one row per challenge): `player`, `seed`, `open`, `taps` (jsonb array of `{a, b, ms}`), `mistakes`, `started_at`, `finished_at`. Finished rows over 30 days old are deleted. Each pupil can read none of it (RLS on, no grant).
- **The hub's fact records** via `record_fact_answers` (`supabase/functions/beanstalk/entry.ts:63`): rows in `gem_keep_facts` (`player`, `pack`, `fact_key` such as `bond10:3+7`, `attempts`, `correct`, `avg_ms`, `box`, `last_seen`, `quick_days`), plus the maths-focus results.
- **Achievements:** six Golden Egg achievements (`beanstalk-kiwi` to `beanstalk-takahe`), counted from `days_done / 30`.
- **What a teacher can see now:**
  - Games table: On/off, "Bonds to 10 · N playing · N Golden Eggs", and a dots drawer.
  - Student page: "N of 30 days done on this beanstalk", Jack or Jill, the leaf colours, the day of the last leaf, and eggs.
  - Today page: nothing for this game. No stuck-pupil alert.
  - Anything about mistakes, which pairs are weak, or how many tries a day took: nothing.

### SQL to try on the live database (not run)

```sql
-- 1. Where is everyone? Days done, beanstalk number, and when they last played.
select p.display_name, b.child, b.days_done,
       b.days_done / 30 as eggs, (b.days_done % 30) as day_on_this_beanstalk,
       (array[10,100,1000])[1 + (b.days_done / 30) % 3] as this_beanstalks_sum,
       b.last_leaf_day
from public.beanstalk_progress b
join public.profiles p on p.id = b.player
order by b.last_leaf_day nulls first, b.days_done;

-- 2. Mistakes per finished challenge, per pupil (are they guessing?). A pupil who needs 10 right pairs has
--    taps = 10 + mistakes; high mistakes per round, or lots of rounds under 20 seconds, means tapping.
select p.display_name,
       count(*) as rounds,
       round(avg(r.mistakes), 1) as avg_mistakes,
       max(r.mistakes) as worst_round,
       round(avg(extract(epoch from (r.finished_at - r.started_at))), 0) as avg_seconds
from public.beanstalk_rounds r
join public.profiles p on p.id = r.player
where r.finished_at is not null
group by p.display_name
order by avg_mistakes desc;

-- 3. Which bonds are weakest across the school (hub fact records for bond10).
select f.fact_key, count(*) as pupils, sum(f.attempts) as attempts,
       round(100.0 * sum(f.correct) / nullif(sum(f.attempts), 0), 0) as pct_right,
       round(avg(f.avg_ms)) as avg_ms
from public.gem_keep_facts f
where f.fact_key like 'bond10:%' or f.fact_key like 'bond100:%' or f.fact_key like 'bond1000:%'
group by f.fact_key
order by pct_right;
```

(Column name `display_name` on `profiles` is my guess; check it before running. "Stuck" pupils: those in query 1 with a `last_leaf_day` over 2 weeks old, or `days_done` unchanged across weeks.)

## Strengths

- Warm, consistent clay art and a clear story; low reading load, voice for every line, a Voice off button.
- Ten-frame dots on every leaf: the right model for bonds to 10, with a fading plan and a teacher switch to turn dots off.
- The first-go hand is simple and cannot get stuck.
- The server is strict: the seed, round, day and leaf come from the server, and the browser cannot cheat the leaf (`server.ts`). Finish is replayed and checked once.
- A sound long-term path (10, then 100, then 1000, then round again) and every pair is recorded in the hub's fact records.
- No ranks, no timers, no penalty: right for 5-year-olds.

## Gaps

- Guessing wins and costs nothing: nothing needs the maths to progress.
- Fading and progression run on the calendar, not on how the child is doing, and support never comes back.
- Feedback on mistakes is a wobble and "Try again!". No reasons, no hints, no change after repeated mistakes.
- Only one question type (recognise a pair among six). No recall, no missing-part, no link to subtraction or to 20.
- Teachers see only "days done" and eggs. Nothing about mistakes, stuck pupils, or weak pairs; the Maths column says "Bonds to 10" for all three beanstalks.
- The sum is never written on the play screen, and the 100/1000 jump has no bridge.

## Candidate improvements

1. **Make a wrong pair informative and make guessing cost something small.**
   - Problem: guessing wins; wrong taps teach nothing.
   - Change: after a wrong pair, show the two ten-frames joined for a moment (e.g. "4 and 8 make 12: too many"), then wobble back. After 3 wrong taps in a row, point the hand at a right pair and show its dots (the guide hand already exists). Optionally a tiny "leaf is picked up for a moment" pause so tapping all pairs is slower than thinking.
   - Files: `src/games/beanstalk/Round.tsx`, `Leaf.tsx`, `words.ts`, `voiceLines.ts` (and new voice clips), `beanstalk.css`.
   - Effort: M. Impact: high (changes it from a tapping game into a teaching one).

2. **Make the sum visible on the play screen.**
   - Problem: the target is only spoken.
   - Change: a big "= 10" (or 100, 1000) badge with a small ten-frame / tens-frame picture on the cloud or tray, and a "hear it again" button.
   - Files: `Round.tsx`, `beanstalk.css`, `words.ts`.
   - Effort: S. Impact: medium (clarity, mute-safe, helps the 100 and 1000 beanstalks).

3. **Adapt dots and difficulty to the child, not the calendar.**
   - Problem: dots fade on a fixed 10-day clock and never come back.
   - Change: choose `dots` for each challenge from the child's recent mistakes per pair (from `beanstalk_rounds.mistakes` or the `bond10` fact records): fade after 2 clean rounds, bring back after a bad round. Keep the leaf and egg on days, so rewards are unchanged. The `start` call already makes the seed on the server, so it can also send the dots level.
   - Files: `shared/beanstalk/progress.ts`, `server.ts` (the start reply), `BeanstalkGame.tsx`, `backend.ts`, `memoryServices.ts`, rebuilt `supabase/functions/beanstalk/index.ts`, tests.
   - Effort: M. Impact: high.

4. **Add a second, recall question type that mixes in as the child improves.**
   - Problem: only "find the pair on screen". Never "7 and what makes 10?".
   - Change: a "missing leaf" round: one leaf shows 7, a gap shows "?", and the child picks the partner from three or four leaves (or a ten-frame to fill). Use it on gold-level days or when the pair is in the child's top Leitner box. Later add "7 + ? = 10" notation and a link to "10 take 7".
   - Files: new `shared/beanstalk/round.ts` variant, `Round.tsx`, server replay, tests.
   - Effort: L. Impact: high (progression and maths fidelity).

5. **Weight rounds towards weak pairs, and avoid two same numbers on screen.**
   - Problem: every round is the same 10 pairs; duplicates on screen make matching easy.
   - Change: build the 10 pairs from the child's own weak `bond10` facts (use `makeFocusPack` data or the facts table), keep one of each pair on screen where possible, and let 5+5 show as two separate leaves only in later days.
   - Files: `shared/beanstalk/round.ts`, `server.ts` (loading the child's facts into the round), tests.
   - Effort: M. Impact: medium.

6. **Give teachers a real view of the game.**
   - Problem: teachers see only days done and eggs.
   - Change: extend `teacher_beanstalk_class` / `teacher_beanstalk_student` to give mistakes per round, last 5 rounds, and weakest pairs; show a "not played for 10 school days" or "guessing (over 10 mistakes a round)" line on the class overview / Today page; make the Maths column say the right sum for each pupil's beanstalk (10, 100 or 1000).
   - Files: new migration, `src/games/beanstalk/teacher.ts`, `src/pages/TeacherBeanstalk.tsx`, the student panel, `src/data/beanstalk.ts`, Today page alert code.
   - Effort: M. Impact: high for the teacher (it answers "who is stuck?").

7. **Bridge the jump to 100 and 1000.**
   - Problem: day 1 of the 100 beanstalk goes straight to 70 + 30 with full dots, with only a line of words.
   - Change: a short guided first go on each new sum (hand and a tens-frame: "7 tens and 3 tens make 10 tens"), and a few days of 50+50, 20+80 type pairs first. Possibly also add bonds to 20 as a step before 100.
   - Files: `Round.tsx` (guide for new targets), `round.ts`, `BeanstalkGame.tsx`, `words.ts`, voice clips.
   - Effort: M. Impact: medium.

8. **Shorten the repeated home sentence and fix small accessibility points.**
   - Problem: the long "Come back tomorrow..." line is read out on every visit; the Jack/Jill buttons need names.
   - Change: shorter line ("Come back tomorrow!"), once-only long version; add `aria-label` to the Choose buttons.
   - Files: `words.ts`, `voiceLines.ts`, `BeanstalkGame.tsx`.
   - Effort: S. Impact: low to medium.
