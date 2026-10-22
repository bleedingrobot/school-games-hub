Bond Match stage M.2: the screens (picker, board, finish) and a preview page. M.1 (the engine) is done and pushed.

Where things are:
- School Games Hub repo. Work in the worktree ~/projects/school-games-hub-bond-match on branch `bond-match` (already exists, M.1 is committed and pushed). Run `git status` and `git branch` first. Don't merge to main.
- Read docs/BOND-MATCH-PLAN.md first, especially sections 1 (how it plays), 2 (the bonds), 3 (cards and screens), 4 (stars) and 5 (where it lives). Then read the M.1 code in shared/bond-match/ (bonds.ts, deck.ts, engine.ts, score.ts, save.ts, exact.ts).
- Decisions made after M.1: (a) small fraction sets make smaller boards (halves/thirds 2 pairs, quarters/fifths 4, eighths 8 on Large), so the picker should show how many pairs a set will give on each size; (b) the next flip turns a showing mismatch back and starts a new turn, there is no separate clear step.
- Style guides: src/games/gem-keep/ and src/games/chess/ for the folder layout, the GameDefinition, strings and css; vite.gem-keep-preview.config.ts and its preview page for how a preview works without logging in.

Build M.2 in `src/games/bond-match/`:
1. `index.tsx`: the GameDefinition, written but NOT added to src/games/registry.ts (that is M.7). Nothing here may be reachable from the live app.
2. `BondPicker.tsx`: "What are you practising?" with the shelves (whole numbers, decimals, fractions), each bond set as a button showing its label, plus a board size choice (Small / Medium / Large with the pair count that set really gives). No Mixed or Auto yet.
3. `Board.tsx` and `Card.tsx`: a grid that scales to the screen (cards never under about 64px), each card a real button with a spoken label ("card 3, face down"), CSS 3D flip turned off by prefers-reduced-motion, fractions drawn stacked, decimals with fixed places, the colour set visible on every card including face down (a border or corner mark, and a shape or letter as well, never colour alone), matched pairs get their own colour plus a tick. Flips and time shown, with a button to hide them. Keyboard play (arrows + Enter).
4. The mismatch line ("3 + 4 = 7") under the board, using the engine's mismatch event. If sumsToTarget is true, say it makes the target but is the wrong colour. A mismatch stays up until the next flip (that flip turns it back), and also turns back by itself after a few seconds so nobody gets stuck.
5. `Finish.tsx`: stars (gold/silver/bronze with text, not colour only), flips, time, "your best" line, Play again (new seed, same bond) and Pick another bond.
6. Bests per bond set and board size (fewest flips, fastest time) in localStorage only, wrapped in try/catch. Nothing is sent to a server in this stage.
7. The seed for a new game comes from the caller (the screen), never from inside shared/bond-match/. Time is counted in the screen and passed in as whole seconds.
8. `strings.ts` for all text, and `bond-match.css` using the hub's existing look. Sounds: reuse src/games/sounds.ts for flip, match and finish with the existing mute; add no new sound files.
9. A preview: `vite.bond-match-preview.config.ts`, a preview page and an `npm run bond-match:preview` script, the same way the other games do it, so I can open it without logging in. Screenshot the picker, a board mid-game (with a mismatch showing), a decimal board, a fraction board and the finish screen at phone and desktop width, and save them somewhere I can find them (tell me the path).
10. Tests: component tests for the picker, a full game played through by clicking (use the perfect-player helper idea), the mismatch line, reduced motion, keyboard play, best score saving, and that the game is not in the registry. Run the whole suite, the type check and `npm run build`.

Don't build: the bot, two-player, hints, a server function, database, migration, points, or anything that touches shared/maths/ or the game registry. Don't change shared/bond-match/ unless you find a real bug in it; if you do, say so clearly in your report.

Commit as you go with clear messages and push `bond-match`.

When it's done, stop and report in plain, simple words: what you built, where the screenshots are and how to run the preview, anything awkward in the plan or the engine, and any decisions you need from me. Then wait for my go-ahead before M.3.
