# R1: Fix Tūī's fading bug

## 1. The problem
A child who is doing very well at Tūī's Ten Tree never gets the picture help taken away. Tūī has six help levels (5 = every berry counted in, down to 0 = numbers only). The help is meant to fade after two good challenges in a row. It does, but on the very same go the child also passes a step (two good challenges at a step pass it), and a new step brings two levels of help back. The two cancel out.

Evidence: `shared/tui/round.ts:87-106`, function `placeAfter`. With `GOOD_TO_FADE = 2` and `GOOD_TO_PASS = 2` (lines 26 and 28) a step pass and a fade always land on the same go. Line 92 fades (level − 1), then line 103 adds `NEW_STEP_HELP` (= 2, line 31) back, capped at `TOP_LEVEL` 5. Worked through for a child who gets 8 or more of 10 every day, starting on step 1, level 5:
- day 2: fades to 4, passes step 1, +2 = back to 5
- day 4: step 2 passed, back to 5
- day 6: step 3 passed, back to 5
- day 8: step 4 passed, back to 5. Now on step 5 (All mixed), still at level 5.
- day 10: first real fade, to 4.

So the strongest child sees every berry counted in for about ten school days, through steps 1 to 4. The Maths Review marked Tūī "Fading 2" for this (DECISIONS.md, pattern 2). The existing test at `shared/tui/tui.test.ts:64` even shows it as intended ("help drops a level, then two come back"), so the bug is hidden by a test that agrees with it.

## 2. The research behind it
Help should fade as the child shows they can do it, and come back when they struggle (research-design.md, scaffolding and fading; Weka is the model in this hub). A new kind of question is a fair moment to give a little help back, but it must not wipe out the progress made, or the child learns the pictures are never going away.

## 3. The change
Only `placeAfter` changes (and its comment, and the Teacher page words). Keep "help comes back a bit on a new step", but make it count only when the child did not just earn a fade.

New rule on a step pass (the `if (goodAtStep >= GOOD_TO_PASS && step < 5)` block):
1. Remember whether the fade happened on this go (`faded = true` inside the `goodInRow >= GOOD_TO_FADE` block).
2. If the fade just happened, the fade stands. The new step adds nothing.
3. If the fade did not happen (the child passed the step after a middling challenge broke the row), the new step adds `NEW_STEP_HELP`, now **1** (was 2).
4. In both cases the level never goes below `FRAMES_LEVEL` (4: ten-frames, so every new step still starts with the frames) and never above `TOP_LEVEL` (5).

In code terms the last line becomes:
`level = Math.max(FRAMES_LEVEL, Math.min(TOP_LEVEL, faded ? level : level + NEW_STEP_HELP))`

What the child now sees (8 or more of 10 every day): level 5 on step 1, level 4 from the second day (step 2), staying at 4 through steps 2 to 4 (that is the "ten-frames at least on a new step" floor, kept on purpose), then step 5 fades 4 → 3 → 2 → 1 → 0 every second good day. Help falls to the kete one day earlier than before and, more importantly, the berries-counted-in level is gone after the first step instead of after step 4. A child who struggles still gets +1 per hard challenge, unchanged. The hard rule, the "never goes back a step" rule, the teacher's Fades / Always / Off setting and `startFor` are all unchanged.

Decision for James (default is what is written above): the floor of 4 means steps 2 to 4 cannot go below the ten-frames. That is Tūī's existing design ("the kete comes only once a way of asking is going well") and this plan does not touch it.

Words: update `TUI_ABOUT` in `src/games/tui/teacher.ts:28` ("a new step brings ${NEW_STEP_HELP} back, always with the ten-frames") to: "a new step brings one back only if the help didn't just fade, always with the ten-frames". No child-facing words change, so no new voice clips.

## 4. Files affected
- `shared/tui/round.ts` (`NEW_STEP_HELP` 2 → 1, `placeAfter`, the comment at lines 80-86)
- `shared/tui/tui.test.ts` (one test changed, one added)
- `src/games/tui/teacher.ts` (the about text)
- `supabase/functions/tui/index.ts` (rebuilt with `npm run build:functions -- tui`)
- No shared maths file. `shared/tui` belongs to Tūī only, so this is a normal game branch.

## 5. Database / migration needs
None. A child's step, level and counters are already saved; they only change from the next finished challenge. The function is redeployed when the PR merges (guide section 4). Children who are on level 5 today stay there until their next fade, then fall normally.

## 6. Test steps
Automated (inside Tūī's limit of 8):
1. Change the existing test at `tui.test.ts:63-66`: a pass that coincides with a fade keeps the fade. `placeAfter(at({ step: 2, level: 3, goodInRow: 1, goodAtStep: 1 }), 10)` now gives `at({ step: 3, level: 4 })` (3 → 2 → floor 4: same as before), and `at({ step: 2, level: 4, goodInRow: 1, goodAtStep: 1 })` gives `at({ step: 3, level: 4 })` (before it gave 5).
2. New: a pass with no fade adds one, capped. `placeAfter(at({ step: 2, level: 4, goodInRow: 0, goodAtStep: 1 }), 9)` gives `at({ step: 3, level: 5, goodInRow: 0 })`, and from level 5 stays 5.
3. New (the bug itself): play a child who gets 10 right every time from `step 1, level 5` for 8 challenges. After challenge 8 the step is 5 and the level is 4 or lower (it was 5). After 8 more it is 0.

Play the preview: use the preview's day-skip to play several days at full marks and watch the berries: the "every berry counted in" picture should be gone after the second day, and the kete (level 3) should arrive around day 10. Then get 3 goes right or fewer on purpose and check the help comes back by one.

## 7. Effort and impact
S, High. A few lines and one test fix, but it changes how every strong child in Tūī experiences the whole game.

## 8. Session prompt (ready to paste)
```text
Work in /Users/jriley/games-hub-isles. Create a new branch and worktree from origin/main called fix/tui-fading. Read docs/GAME_DEVELOPMENT_GUIDE.md first, then docs/plans/maths-review/R1-tui-fading-bug.md and follow it. Steps: (1) in shared/tui/round.ts change NEW_STEP_HELP to 1 and change placeAfter so a step pass that happens on the same go as a fade keeps the fade (new step adds nothing), and a pass with no fade adds NEW_STEP_HELP, always floored at FRAMES_LEVEL and capped at TOP_LEVEL; update the comments. (2) Update shared/tui/tui.test.ts as the plan says: fix the existing step-pass expectations, add the no-fade-pass test and the 8-challenge strong-child test (step 5 reached at level 4 or lower). (3) Update the TUI_ABOUT text in src/games/tui/teacher.ts. (4) Rebuild only the tui function: npm run build:functions -- tui, and commit its index.ts. (5) Run the Tūī tests, typecheck and lint. Do not touch shared/maths, src/maths, src/styles.css or src/components. Stop and tell James before any live step; open a PR when done.
```
