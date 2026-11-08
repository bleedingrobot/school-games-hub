# S20: Kingfisher's Dairy: review once it is live

**Game:** Kingfisher's Dairy
**What's wrong:** Nothing yet: the game has no code. It is the sixth new game from the first review (sketch: `docs/plans/maths-review/new-games/IDEAS.md`, "A. Kingfisher's Dairy"). Every other Foundational game has had the blind review; this one must too.
**What done looks like:** A blind score for Kingfisher's Dairy on the same rubric as the other games, a row for it on the review page, and a fix card for each real problem found.
**Size:** S to M
**Impact on learning:** Med
**Waits for:** Kingfisher's Dairy going live

## 1. The problem

The second review scored twelve games (`docs/reviews/maths-review-2/DECISIONS.md`). Kingfisher's Dairy was not built in time, so it has no score. A game that children play in class without a blind check can hide the same problems found elsewhere: lost help, guessing, hard-to-see pictures.

## 2. The rule behind it

Rule 9 (evidence): judge a game by what a child does in it, scored the same way every time, by someone who has not seen the design notes (blind). The method is in `docs/reviews/maths-review-2/EVAL-TASK.md`.

## 3. The change

No code and no migration. Steps, after the game is live:
1. A helper plays and scores the game following `docs/reviews/maths-review-2/EVAL-TASK.md` exactly. It is blind: it must not read the game's plan, the IDEAS sketch, or any other game's evaluation.
2. A second blind helper (the calibrator) checks the first score against the rubric in `docs/reviews/maths-review/research-design.md` and the twelve scores in `docs/reviews/maths-review-2/DECISIONS.md`, so the new score means the same as the others.
3. Add a row for Kingfisher's Dairy to `docs/reviews/fundamental-maths-review-2.md`.
4. For each real problem found, write a fix card (a plan file in `docs/plans/maths-review-2/` using `PLAN-TEMPLATE.md`, and an entry in a JSON file).

## 4. Files affected

`docs/reviews/maths-review-2/games/kingfishers-dairy.md` (new evaluation), `docs/reviews/fundamental-maths-review-2.md` (one row), new plan files and JSON for any fix cards. No game code.

## 5. Database / migration needs

None.

## 6. Test steps

No automated tests. Check by reading: the score uses the same scale as the twelve in DECISIONS.md, every problem cites what was seen in play, and the row appears on the review page.

## 7. Size and impact

S to M: one play-through and a calibration, plus fix cards if needed. Med: it makes sure the newest game is as good as the rest before more children use it.

## 8. Session prompt (ready to paste)

```text
You are running card S20 of the second Foundational maths review for the Games Hub: the blind review of Kingfisher's Dairy, which must be live first.

Create your own branch from origin/main, named review-kingfishers-dairy. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S20-review-kingfishers-dairy.md first. If Kingfisher's Dairy is not live yet, stop and tell James. Reply to James in plain, simple words.

Steps:
1. Start a helper to play and score the game blind, following docs/reviews/maths-review-2/EVAL-TASK.md exactly. Tell it not to read the game's plan, docs/plans/maths-review/new-games/IDEAS.md, or any other game's evaluation.
2. Start a second blind helper to calibrate the score against the rubric in docs/reviews/maths-review/research-design.md and the twelve scores in docs/reviews/maths-review-2/DECISIONS.md.
3. Write the evaluation to docs/reviews/maths-review-2/games/kingfishers-dairy.md and add a row for the game to docs/reviews/fundamental-maths-review-2.md.
4. For each real problem found, write a fix card plan in docs/plans/maths-review-2/ using docs/reviews/maths-review-2/PLAN-TEMPLATE.md, with a JSON entry.
This card changes no game code and adds no migration. Check that the score uses the same scale as the others and each problem cites what was seen in play.
Stop and tell James before any live step. Open a PR when done.
```
