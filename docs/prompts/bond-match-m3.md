Bond Match stage M.3: teaching touches and polish, ready for a playtest. M.1 (engine) and M.2 (picker, board, finish, preview) are done and pushed.

Where things are:
- School Games Hub repo. Work in the worktree ~/projects/school-games-hub-bond-match on branch `bond-match`. Run `git status` and `git branch` first. Don't merge to main.
- Read docs/BOND-MATCH-PLAN.md (sections 2, 3, 4, 9, 10), then the M.2 code in src/games/bond-match/ and shared/bond-match/.
- James's answers after M.2: keep the size-first picker; keep the "wrong colour set" rule as it is (it gets playtested); keep Large at 4 across by 5 down. No hint button (plan answer 5), so the "hint" in the M.3 row of the plan is dropped.
- M.2 already did: the mismatch "3 + 4 = 7" line, reduced motion, keyboard play, sounds (flip, match, finish), and fixed-place decimals. Don't redo these; only fix what you find wrong.

Build in `src/games/bond-match/` (still NOT in src/games/registry.ts, nothing reachable from the live app):
1. Fraction pictures: an optional small pie or bar on fraction cards (a hint of how big the fraction is). A "Show pictures" toggle on the board, remembered in localStorage (try/catch), on by default for fractions. The picture must not be the only information, and must not make a card under 64px unreadable. Cards also say the fraction aloud as now.
2. Decimal help: on decimal decks, a small place-value cue is NOT needed; just check that 0.05 and 0.50 are easy to tell apart at phone width and fix the layout if not.
3. Wrong-colour-set message: reword it for a 9 year old, shorter, and show the two marks (e.g. "● A with ● A") as well as the words. Keep the engine's sumsToTarget rule unchanged.
4. Star tuning aid: put the star thresholds (STAR_CONFIG) on the finish screen as a small "How stars work" line (gold within 1.5x the fewest flips, silver within 2.5x). Don't change the numbers.
5. Playtest kit: a `docs/BOND-MATCH-PLAYTEST.md` for James: how to run the preview, 8 short things to try with kids (each bond shelf, each size, a phone, keyboard only, reduced motion on, sound on), and what to write down (stuck points, confusing messages, whether stars feel fair).
6. Preview: update it if needed, rescreenshot at phone and desktop width: fractions with pictures, the new wrong-set message, finish with the stars line. Save in ~/bond-match-screenshots/m3/ and tell me the path.
7. Tests for each new thing, then the whole suite (npm run test:all), the type check and `npm run build`.

Don't build: the bot, two-player, hints, server function, database, migration, points, Mixed or Auto, or anything touching shared/maths/ or the registry. Don't change shared/bond-match/ unless you find a real bug; if you do, say so clearly.

Commit as you go with clear messages and push `bond-match`.

When done, stop and report in plain, simple words: what you built, where the screenshots are, anything awkward, and decisions you need from me. Then wait for my go-ahead before M.4 (that one needs my yes to apply a migration and deploy).
