# Foundational maths games review 2

**Date:** 8 November 2026. **Reader:** James. **Games reviewed:** the seven from the first review (Tūī, Weka, Hop, Penguin Pairs (Kororā), Pipi, Kiwi's Beanstalk, Quick looks) and five of the six newer games (Pigeon's Number Line, Parrot's See-saw, Lizard's Bundles, Swamp Hen's Reed Rows, Robin's Berry Basket). **Kingfisher's Dairy is not built yet, so it is not scored** (card S20 reviews it once it is live).

First review: `docs/reviews/fundamental-maths-review.md` (7 November 2026). Comparison page: https://claude.ai/artifact/KyXiMPb56SjiRfaAVwNDGS. Working files for this review: `docs/reviews/maths-review-2/` (game files, `DECISIONS.md`, `issues-a.json`, `issues-b.json`). Fix plans: `docs/plans/maths-review-2/`, tracked on the fix plan page https://claude.ai/artifact/XQDGyC5rytsfNV2dAUi8Rd (one card per fix, with its session prompt).

## 1. One-page summary

**Did the work improve the games? Yes, clearly, for the seven older games.** Their total went from 148 to 167 out of 224 (average 21.1 to 23.9 out of 32). Before, only Weka reached the go-live bar (a 3 on every line). Now six of the seven do; only Kiwi's Beanstalk is still under it (Progression 2). Of the 125 issues the first review raised, 56 are fixed, 17 partly fixed and 52 not fixed. None got worse.

**But read the rise with care.** About 15 of the 21 points gained come from real changes (mistakes that teach, help per fact that fades and comes back, longer ladders, the teacher grid). About 6 come partly from this review reading "one or two loopholes are allowed at a 3" more kindly than the first did (for example, tapping every choice is now one loophole, not a 2). Two points were lost by a stricter reading, not by worse games: Weka's and Tūī's Support fell from 4 to 3 because this review wanted a demo for each new kind of go.

**The five newer games are new, with no earlier score.** Four reach the bar (24). Robin's Berry Basket does not (Maths 2): the right answer is nearly always the third card.

**What still matters most:**
1. **Robin's cards can be beaten by a pattern.** Tapping the third card is right about 95% of the time and passes the step without counting (`shared/robin/round.ts:216-222`). It is the only game where guessing moves a child on.
2. **The fixes made one new problem everywhere: "Now you try" can be copied.** The look-together shows the answer, then the redo asks the same question with the same cards (in Robin and Parrot the right card is even marked). The redo is not saved, so records are honest, but the child can copy rather than think.
3. **Children still do not get a demo the first time a new kind of go appears**, in any of the twelve games, and the five newer games are missing from the teacher's class grid and Today alerts. The kit cannot yet remember which kinds a child has seen, so that comes first (card S11).

Also: day rewards and "Well done!" still come for finishing, not for right answers (9 wrong out of 10 in Hop still says "Well done! A lily pad turned bronze!"); Beanstalk still moves on by the calendar; same-day replays still move the level in Pipi, Penguin Pairs and Hop; and the teacher view did not keep up with the longer ladders (Hop steps 3, 4 and 200 and Penguin Pairs level 5 have no names).

**Can the data show the fixes worked? Not yet.** Most fixes went live over the weekend of 7 and 8 November. No class has played since, and the five newer games have only test plays. Section 6 has a snapshot to compare against later.

## 2. Scores

Same 8 criteria, same 1 to 4 rubric (`docs/reviews/maths-review/research-design.md`), same go-live bar.

| Game | Maths | Clarity | Support | Fading | Progression | Feedback | Recording | Engagement | Total /32 | First review | Change |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Weka's Stepping Stones | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 24 | 0 |
| Quick looks | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 23 | +1 |
| Tūī's Ten Tree | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 22 | +2 |
| Pipi's Hidden Shells | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 21 | +3 |
| Penguin Pairs (Kororā) | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 20 | +4 |
| Hop's Glow-worm Pond | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | 19 | +5 |
| Kiwi's Beanstalk | 3 | 3 | 3 | 3 | **2** | 3 | 3 | 3 | 23 | 19 | +4 |
| Pigeon's Number Line | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | new | |
| Parrot's See-saw | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | new | |
| Lizard's Bundles | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | new | |
| Swamp Hen's Reed Rows | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 24 | new | |
| Robin's Berry Basket | **2** | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 23 | new | |
| Kingfisher's Dairy | not built | | | | | | | | unscored | new | |

First-review scores, same order (Maths, Clarity, Support, Fading, Progression, Feedback, Recording, Engagement): Weka 3,3,4,3,3,2,3,3; Quick looks 3,3,3,3,3,3,2,3; Tūī 3,3,4,2,2,2,3,3; Pipi 3,3,3,2,3,2,2,3; Penguin Pairs 2,3,3,2,2,2,3,3; Beanstalk 2,3,3,2,2,2,2,3; Hop 2,3,3,2,2,2,2,3.

**No game gets a 4 on any line.** A table of 3s hides real differences. Weakest first: Robin, Beanstalk, Lizard, Swamp Hen, Quick looks, Parrot, Pigeon, Hop and Pipi, Penguin Pairs, Tūī and Weka (`DECISIONS.md` section 5).

### 2.1 What moved, and why

| Game | Line | First → now | Why |
|---|---|---|---|
| Weka | Support | 4 → 3 | Stricter reading. No code change; this review asked for a demo for each new kind (hop-back, smaller-first). |
| Weka | Feedback | 2 → 3 | Real: why-lines and look-together (R5). |
| Tūī | Support | 4 → 3 | Stricter reading, as Weka. |
| Tūī | Fading | 2 → 3 | Real: the fading bug fixed (R1). Level 4 is still a floor on steps 2 to 4. |
| Tūī | Progression | 2 → 3 | Real: take-away and a longer ladder (R8, R9). |
| Tūī | Feedback | 2 → 3 | Real (R5). |
| Quick looks | Recording | 2 → 3 | Real: every answer saved, teacher sees stage (R3, R7). |
| Pipi | Fading | 2 → 3 | Real: per-fact help that returns (R6). |
| Pipi | Feedback | 2 → 3 | Real (R5). |
| Pipi | Recording | 2 → 3 | Mixed: the grid and alerts are new, but per-fact rows already existed. |
| Penguin Pairs | Maths | 2 → 3 | Mixed: the times-itself wrong answers are gone and the pile is real, but tap-all is now read as one loophole. |
| Penguin Pairs | Fading | 2 → 3 | Real (R6). |
| Penguin Pairs | Progression | 2 → 3 | Mixed: level 5 added, but the top is still short. |
| Penguin Pairs | Feedback | 2 → 3 | Real (R5, R9). |
| Beanstalk | Maths | 2 → 3 | Real: no repeated numbers, target on screen, bridge to 100 (R4). Elimination still there, counted as one loophole. |
| Beanstalk | Fading | 2 → 3 | Real: dots per child that fade and return. |
| Beanstalk | Feedback | 2 → 3 | Real (R5). |
| Beanstalk | Recording | 2 → 3 | Mixed: in the grid now; per-fact rows already existed; 100 and 1000 still share one key. |
| Hop | Maths | 2 → 3 | Mixed: the "endings" tell is gone, and tap-all is now read as one loophole. |
| Hop | Fading | 2 → 3 | Real (R6). |
| Hop | Progression | 2 → 3 | Real: counting back, steps 3, 4 and 200 (R8). Replays still move the step. |
| Hop | Feedback | 2 → 3 | Real (R5). |
| Hop | Recording | 2 → 3 | Mixed: grid and alerts are new; per-fact rows existed. |

Totals: 21 points up (15 real, 6 mixed), 2 down (both stricter reading). Beanstalk Progression stayed at 2.

## 3. Research summary

Unchanged from the first review (section 3 there), and `docs/LEARNING-DESIGN.md` now turns it into ten rules. This review scored against the rubric, not against those rules, and then checked each game against the rules afterwards (each game file ends with a rules table).

## 4. The games

Each game file in `docs/reviews/maths-review-2/games/` has the full evidence: how it works, the maths, scores with file and line, the 25-item checklist, problems, what is saved, and a rules table.

### 4.1 The seven older games

**Weka's Stepping Stones (24, was 24).** Still the steadiest. Why-lines and look-together are new and good. Not fixed: the stone is for finishing; four screens per go; help fades slowly (about 12 days); hop-backs come late. New from the fixes: the redo can be copied (R5); pebbles now need a Check tap (R9); a lucky guess in 9 to 82 ms counts as quick. Top fixes: S32, S25, S14.

**Quick looks (24, was 23).** Every answer saved now. Still the closest to "answer simply shown": a wrong answer reveals the groups at once, with no second try at the same picture. Voice is off by default (`src/speech.ts:11-17`). Placement uses two pictures per test, so a lucky guess places a child two stages up. Never got the "mistakes that teach" fix. Top fixes: S28, S29.

**Tūī's Ten Tree (24, was 22).** The fading bug is fixed and take-away is in. Level 4 is still a floor on steps 2 to 4, so a child who gets everything right sees full ten-frames for about 8 days. The start step and "secure" count only use the add facts (R9). The numbers are not voiced at the lowest help levels. Top fixes: S25, S30, S36.

**Pipi's Hidden Shells (24, was 21).** Help per fact and why-lines are big gains. Not fixed: no "Hear it again"; outlines show the answer before the first try; same-day replays move the level; no demo for altogether or two tides; only three levels and no what's next; finish praise is about ability. Top fixes: S24, S27, S30.

**Penguin Pairs (24, was 20).** The biggest real gain on Maths and Feedback. Still: new halves share themselves at full help, so the child watches; same-day replays move the level; the teacher config stops at level 4, so a child on level 5 can be flagged "same level too long" (`src/teacher/foundational/config.ts:46`). Top fixes: S23, S24, S26.

**Kiwi's Beanstalk (23, was 19).** Much clearer: the target is on screen, no repeated numbers, and a bridge to 100. But the sum still moves by the calendar (`shared/beanstalk/progress.ts:20`): 30 finished days per target, the same pairs for everyone, no review of old sums. That keeps it under the bar. The new missing-leaf goes arrive with no demo and the tenth is forced (R8). Top fixes: S21, S22.

**Hop's Glow-worm Pond (24, was 19).** The largest rise. Counting back, steps of 3 and 4 and to 200, why-lines and help per hop are all real. Still: no "Hear it again"; same-day "Play again" can move the step; the teacher grid knows only steps 10, 5 and 2 (`config.ts:45`); "Well done!" after 9 wrong of 10. Top fixes: S23, S24, S30.

### 4.2 The newer games (new, no earlier score)

**Pigeon's Number Line (24).** Honest number-line placing with six help levels. At full help many numerals are printed, so placing becomes matching; "near" goes have two cards (a coin toss); the reason is a text line and an emoji, and the line jumps when it opens; three wrong in a row does not bring help back (`STRUGGLE_GOES` unused). Top fixes: S7, S8, S13.

**Parrot's See-saw (24).** Stone goes are a strong model of equality. Card goes leave a 50% tell (wrong cards are the total and the two printed numbers, `shared/parrot/round.ts:211, 231`); the see-saw stays flat on false sums (`src/games/parrot/Goes.tsx:188`) and the why-picture stays still after a wrong true-or-false tap. Top fixes: S9, S10.

**Lizard's Bundles (24, the weakest 24).** The model is right, but tying ten sticks is only required in the guided first go (`src/games/lizard/Goes.tsx:326`); Build can be brute-forced by adding a bundle each try; a wrong attempt is wiped and the why-picture is an emoji. Small bug: the raft tip shows on Swap goes with no raft (`:178`). Top fixes: S5, S6.

**Swamp Hen's Reed Rows (24).** Counting rows is honest. "Share" has the child do nothing and "turn" cannot be answered wrongly, so the game's new ideas are watched, not done; under the mat the array can be a bare rectangle. Played by script only. Top fixes: S3, S4.

**Robin's Berry Basket (23).** Give goes are honest and good. Card goes are not: the right answer is almost always the third card, and marking berries is optional, so counting is never needed. The why-panel sat below the fold in a 768px-high window. Top fixes: S1, S2.

**Kingfisher's Dairy (unscored).** No code or tables yet. S20 reviews it with the same blind method once it is live.

## 5. Patterns across games

Ranked by harm to learning (full list in `DECISIONS.md` section 7):
1. **A fixed pattern beats card goes**: Robin (95%), Parrot (50%), Pigeon near goes (50%).
2. **Day reward and "Well done!" are paid for finishing**: all eleven daily games. Records stay honest; the child's picture of what the game is for does not.
3. **"Look together" gives the answer and the redo can be copied**: every game with R5's help, and Robin and Parrot mark the right card. Caused by the R5 fix.
4. **Elimination forces the answer** after wrong taps: Beanstalk, Lizard, Pigeon, Swamp Hen, Robin, Tūī, Parrot.
5. **No demo the first time each new kind appears**: all twelve. Some of these kinds were added by the R8 and R9 fixes.
6. **Help moves once a day, one level for the whole child**, and three wrong in a row does not bring help back in Pigeon, Lizard and Swamp Hen. Full help can last too long on each fact (R6 ladder: box 2 and two quick days).
7. **Progression lacks a target success rate and review**; same-day replays move levels (Pipi, Penguin Pairs, Hop); Beanstalk moves by the calendar.
8. **The teacher view lags the games**: five newer games absent; longer ladders not named (caused by R8); wrong answers chosen never shown.
9. **The why-picture is not the child's own work** (Lizard, Pigeon, Swamp Hen, Robin, Parrot, Hop).
10. **The question cannot be heard again** (Hop, Pipi; Quick looks voice off; Tūī numbers at low levels; Robin no written question).
11. **Praise is about the child or the result, not the strategy.**
12. **A lucky fast guess counts as quick** and fades help (no minimum think time anywhere).

### 5.1 First-review issues, by status

| Game | Fixed | Partly | Not fixed | Worse |
|---|---|---|---|---|
| Kiwi's Beanstalk | 11 | 3 | 4 | 0 |
| Hop | 7 | 3 | 4 | 0 |
| Penguin Pairs | 8 | 5 | 4 | 0 |
| Tūī | 8 | 2 | 6 | 0 |
| Weka | 6 | 2 | 14 | 0 |
| Pipi | 5 | 1 | 11 | 0 |
| Quick looks | 7 | 0 | 9 | 0 |
| All games | 4 | 1 | 0 | 0 |
| **Total** | **56** | **17** | **52** | **0** |

Many "not fixed" items are small or were left on purpose by the plans (for example Weka's screen count). Each item, with where it stands and which plan touched it, is in `issues-a.json` and `issues-b.json`.

### 5.2 New issues caused by the fixes (18 entries; some repeat per game)

- **R5 (mistakes that teach):** the redo can be copied (all games); look-together is long and can be skipped only after 3 seconds; Tūī praises a redo like a first try; Tūī has dead picture-thinning code.
- **R6 (help follows the child):** full help can last too long on each fact.
- **R8 (longer ladders):** the teacher grid does not know Hop steps 3, 4 and 200, Penguin Pairs level 5 or Beanstalk bonds to 20; Beanstalk's missing-leaf goes arrive with no demo and the tenth is forced; more sums stretch Beanstalk's 30-day arc; Hop's counting back and "from 3" arrive with no demo.
- **R9 (game depth):** Penguin Pairs' new kinds arrive with no demo; Weka's pebbles need a Check tap; Tūī's start step uses only add facts.
- **R1 (Tūī fading):** ten-frames stay on for about 8 days for a child who gets everything right.
- **R3 (Quick looks):** guided mode never grows the garden.

## 6. Live data snapshot (8 November 2026, all time)

Fixes went live on 7 and 8 November, a weekend. So these numbers are a baseline, not a result.

| Game | Rounds | Pupils | Finished | Started since Fri 3pm |
|---|---|---|---|---|
| Kiwi's Beanstalk | 41 | 18 | 30 | 1 |
| Hop | 27 | 12 | 16 | 1 |
| Penguin Pairs | 16 | 10 | 12 | 0 |
| Pipi | 22 | 13 | 8 | 1 |
| Tūī | 6 | 3 | 3 | 2 |
| Weka | 13 | 4 | 2 | 0 |
| Pigeon | 4 | 1 | 2 | 4 |
| Parrot | 2 | 1 | 1 | 2 |
| Lizard | 2 | 1 | 1 | 2 |
| Robin, Swamp Hen | 0 | 0 | 0 | 0 |

- Beanstalk: 30 finished rounds, 3.2 wrong taps a round, 13% with 10 or more wrong (first review: 29, 3.2, 14%). Hop: 1.2 wrong a round (was 1.0).
- Quick looks: 403 counted answers from 21 pupils, 81% right (was 378, 81%); helped answers 73% (was 74%).
- Penguin Pairs levels reached: level 1: 4 pupils, 2: 2, 3: 2, 4: 2 (unchanged).
- Shared facts (pupils, attempts, % right): bonds to 10 48, 851, 84%; bonds to 20 28, 280, 86%; doubles 51, 514, 95%; halves 43, 445, 92%; ten-and 36, 500, 93%; skip 10s 20, 191, 94%.
- Worth watching: Pipi finishes only 8 of 22 rounds and Weka 2 of 13. Look again once classes have played a week.

## 7. Coverage and gaps

The coverage matrix in the first review (section 7) still holds for the older games. The five newer games fill gaps it named: number lines (Pigeon), equality (Parrot), place value with bundles (Lizard), arrays (Swamp Hen) and counting and one more (Robin). Kingfisher's Dairy (planned) is the last of that set.

## 8. Recommendations

The fix plan has 36 cards, newer games first, then by how much each helps children learn. It is a working page with a saved status and a copy-prompt button on each card; plans and prompts are in `docs/plans/maths-review-2/`. The first ten:

1. S1 Robin: the right answer can be in any place.
2. S2 Robin: count the berries before choosing; show the child's own count when wrong.
3. S3 Swamp Hen: always draw the first row and column.
4. S4 Swamp Hen: the child deals the shares and the turn can be wrong.
5. S5 Lizard: tie the bundles yourself on steps 1 to 3.
6. S6 Lizard: keep the child's attempt, cap tries, real why-picture.
7. S7 Pigeon: the reason drawn on the number line.
8. S8 Pigeon: fewer printed numbers; four cards on near goes.
9. S9 Parrot: the see-saw tilts when it is not equal.
10. S10 Parrot: no tell in the cards.

Then the kit's "seen kinds" memory (S11) and a demo for each new kind (S12), help back after three wrong (S13), no quick credit for a lucky guess (S14), honest finish words (S15), a sister question for "Now you try" (S16, which needs a small change to LEARNING-DESIGN rule 7), the five newer games in the teacher view (S17), small fixes (S18), help per kind (S19) and Kingfisher's review (S20). The older-game cards follow (S21 to S36), led by Beanstalk's progression (S21).

## 9. Limits of this review, and how it was kept fair

- **Blindness.** Scores were set before the first review's scores were read. One slip: early on, a list of the first review's headings showed each game's total (not the line scores) before scoring. To guard against it, a fresh calibrator who had not seen those totals re-scored every line from the rubric wording. Two helpers (Weka and Penguin Pairs) read `docs/LEARNING-DESIGN.md`, which mentions earlier results, before writing their drafts; their scores were re-argued from the rubric, not taken on trust.
- **What nobody could check.** The recorded voice (nobody heard it); fading across several real days (helpers used preview buttons to set levels); the real server and teacher pages in a real browser; real children.
- **Uneven play.** Swamp Hen was played by script; Parrot only days 1 and 2 plus preview buttons; Robin's below-the-fold panel was seen in one window size.
- **Issue check.** About a dozen first-review issues were marked from the plans or a quick code read, not re-checked on screen (marked "code only" or noted in the JSON files).
- **Kingfisher's Dairy** is unscored because it is not built.
- **No fixes were made.** This review changed no game code.

## Appendix

SQL for each game is in its file in `docs/reviews/maths-review-2/games/`, under "Saved per child on the server". The snapshot in section 6 used the same queries as the first review's appendix, with `started_at` for rounds.
