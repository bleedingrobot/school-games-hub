# S12: Show me first for each new kind, newer five

**Game:** Pigeon, Parrot, Lizard, Swamp Hen, Robin (the older seven get the same on later cards)
**What's wrong:** Every game has at most a guided first go on the very first round. When a new kind of go first appears later, nothing shows the child what to do.
**What done looks like:** The first time one of these kinds comes up, the pointing hand does one go with a voice (Pigeon zoom; Parrot true-or-false and take-away; Lizard Swap and Bundle; Swamp Hen mat, share and cut; Robin How many? and One more). A Skip button shows after 3 seconds. It never plays again for that child, on any computer.
**Size:** M
**Impact on learning:** High
**Waits for:** S11

The kit part must be general: no game words in it, so the older seven games (Hop, Penguin Pairs, Pipi, Tūī, Weka, Beanstalk, Quick looks) can use the same shell on later cards.

**Note on parts.** The brief asked for five parts (one per game). This plan has six: **Part 1 is a small kit shell** (its own branch and PR, because a kit part is never changed from a game branch), then Parts 2 to 6, one per game. Parts 2 to 6 can run in any order after Part 1.

## 1. The problem

- Only the very first round has any guide: Robin and Parrot `guide={state.daysDone === 0 && state.lastDay === null}` (`src/games/robin/RobinGame.tsx:128`, `src/games/parrot/ParrotGame.tsx:128`); Pigeon, Lizard and Swamp Hen `guided={state.daysDone === 0}` (`src/games/pigeon/PigeonGame.tsx:114`, `src/games/lizard/LizardGame.tsx:115`, `src/games/swamphen/SwamphenGame.tsx:123`). In the guided go only the pointing hand shows after a pause (`GUIDE_MS`, `src/kit/useGuidedFirstGo.ts:1-26`). It never speaks a demo.
- New kinds arrive by step, not by day:
  - Pigeon: zoom keys appear at steps 6 and 7 (`NEW_LINE_STEPS = [6, 7]`, `shared/pigeon/config.ts:28`); `kindOfKey` returns `'zoom'` for them (`shared/pigeon/round.ts:70`), and `Go.lens` is set (`shared/pigeon/round.ts:234, 294-300`).
  - Parrot: step 5 brings true-or-false (`tf`) and step 6 take-away (`sub`) (`shared/parrot/round.ts:44-45`; kinds `Kind = 'miss' | 'swap' | 'both' | 'sub' | 'tf'`, `shared/maths/skillPacks/equalsKeys.ts:9`).
  - Lizard: `Kind = 'build' | 'read' | 'bundle' | 'swap' | 'more'` (`shared/lizard/round.ts:28`, `kindOfKey` at 64).
  - Swamp Hen: `Kind = 'plant' | 'mat' | 'turn' | 'which' | 'share' | 'cut' | 'short'` (`shared/swamphen/round.ts:29`); step 3 is "Under the mat", 4 "Share them out", 5 "Cut the garden" (`shared/swamphen/round.ts:9, 32-36`).
  - Robin: `GoKind = 'give' | 'howmany' | 'counton'` (`shared/robin/round.ts:21`); "How many?" arrives at step 2 and "One more" at step 5 (`shared/robin/round.ts:56 and 59`).
- The evaluators called these cold starts: DECISIONS section 7, pattern 5 (`docs/reviews/maths-review-2/DECISIONS.md:143`), and Parrot's true-or-false and take-away, Swamp Hen's mat, share and cut, Pigeon's zoom, Lizard's Swap and Bundle, Robin's How many? and One more are named there.
- Nothing remembers who has seen what (S11).

## 2. The rule behind it

LEARNING-DESIGN rule 4 (`docs/LEARNING-DESIGN.md:85`): a demo the first time a new kind appears, with who has seen it from the server. Rule 2 (one thing at a time, voice first). Rule 5 item 1: anything new starts with full help. Rule 4's last bullet: help never gives the maths answer away before the child has tried, so the demo uses an example the real round cannot ask.

## 3. The change

**Part 1: the kit shell (`src/kit/useKindDemo.ts` and `src/kit/DemoBar.tsx`, no game words).**
- `useKindDemo({ kind, seen, mark, steps, say })` where `steps` is a list of `{ line: string; holdMs: number; target?: string }`. If `seen.has(kind)` it does nothing. Otherwise it runs: for each step, `say(line, onEnd)`, then waits `holdMs` (default 900), then goes on. It returns `{ playing, step, canSkip, skip, replay }`.
- `canSkip` turns true 3 seconds after the demo starts (same number as "Let's look together": `SKIP_AFTER_MS = 3000`, `src/kit/ShowWhy.tsx:69`; follow its timing code, `useLookTogether`, `src/kit/ShowWhy.tsx:98-145`). It gives up after 20 seconds in case a voice never ends. When it ends or is skipped, it calls `mark([kind])` once.
- `DemoBar({ prefix, skipLabel, replayLabel, canSkip, onSkip })`: a small bar with the Skip button (shown only when `canSkip`) in line, never covering a choice; Escape also skips. The game's CSS styles `<prefix>-demo`.
- The pointing hand is the existing `PointingHand` (`src/kit/PointingHand.tsx`), drawn by the game inside the thing it points at, as in `src/games/robin/Goes.tsx:292`.
- While a demo plays, the game's choices are not tappable and **no tap is added to the round's `taps`** (the demo is not an answer; nothing is saved).
- One test (`src/kit/kitJunior.test.tsx`): skip is not there before 3 seconds; skip or the last step calls `mark` once with the kind; a seen kind never starts.
- Kit rules: own branch `kit-kind-demo`, README entry in `src/kit/README.md`, `npm run build:functions` (the part is browser-only, so expect no change).

**Rules for every game (Parts 2 to 6):**
1. **The example is made up and fixed.** It is a `Go` the game builds from a key that is **not** in the game's own `KEYS` for that kind (or a smaller number than the step uses), so it can never be the answer to a real go. Build it with the game's own `showGo` or the code that draws a go, at the top help level (5), with the right card marked by the hand.
2. **One demo plays before the first go of each unseen kind**, between goes. At most **2 demos per round**; any others wait for the next round. A kind that the very first guided go already covers (go 0 of the first round) is marked seen when that go finishes.
3. **Mark a kind seen** when its demo ends or is skipped **or** when the child finishes any go of it (S11 rule 1). The marks go to the server through the new `seen` action.
4. **Server (each game's `shared/<game>/server.ts`):** `load` returns `seen: mergeSeen(saved, kindsFromFacts(facts, kindOfKey))` (so children who have played for weeks get no demo for what they already do). A new `seen` action takes `body.kinds`, reads it with `readKinds(body.kinds, ALLOWED)` and calls `services.markSeen`; wrong data gives the game's usual "unreadable" reply. `ALLOWED` is every kind the game has, not only the demoed ones. Add `seen` and `markSeen` to the game's `Services` type, to its `memoryServices.ts` (use `memorySeen`), and to `supabase/functions/<game>/entry.ts` (calls `kit_seen_get` and `kit_seen_mark` with the game name). `src/games/<game>/backend.ts` gets `markSeen`.
5. **Voice:** each demo line goes in the game's `voiceLines.ts` (`allVoiceLines`, as `src/games/pigeon/voiceLines.ts:54-75` does), so the voice test requires a clip. Record clips with Kokoro `af_bella` the way the existing clips are made: run `python3 scripts/voice-clips.py --list`, then `~/kokoro/.venv/bin/python -I scripts/voice-clips.py <game>` on the Mac (see the header of `scripts/voice-clips.py`), and commit the new `.mp3` files and `lines.json`. Do not say the answer of a real go.
6. **Words:** short, Bella-style, present tense, "Watch." first, "Now you try." last (use the game's existing `WORDS.nowYouTry`).
7. **Replay:** the game's existing "replay guide" button (Robin has one, `src/games/robin/RobinGame.tsx:229`) may replay the last demo; not required.
8. Max 8 tests per game, and only the few below.

**Part 2: Pigeon (`zoom`).** Kind id: `kindOfKey(key)` (`shared/pigeon/round.ts:70`) already gives `'zoom'`. Demo: a place go on a 0 to 100 line with the lens 40 to 50 (an example number the real zoom keys do not use). Steps: "Some numbers are in a tiny space." / "Tap the lens, to zoom in." (hand on the lens) / "Now find 47 on the zoomed line." (hand on the spot). Add all four kinds `place`, `read`, `tens`, `near` and `zoom` to `ALLOWED`; demo only `zoom`.

**Part 3: Parrot (`tf`, `sub`).** Kind id: `kindOfKey(key)` (`shared/parrot/round.ts:36`). `tf` demo: "Is this true or false?" with `4 + 2 = 7` on the see-saw (a made-up one not in `KEYS.tf`), the sides tilt, hand on False; "The sides do not match. It is false." `sub` demo: `9 = 5 − ?` style example the real `sub` keys do not use, hand moves the stones; "Take away to find the missing one." Allowed: `miss, swap, both, sub, tf`.

**Part 4: Lizard (`swap`, `bundle`).** Kind ids from `kindOfKey` (`shared/lizard/round.ts:64`). `swap` demo: "Swap: one bundle of ten for ten sticks." hand moves a bundle across the mat; `bundle` demo: "Ten sticks make a bundle." hand drags ten sticks into one bundle, a count under it. Use numbers the real keys cannot ask. Allowed: `build, read, bundle, swap, more`.

**Part 5: Swamp Hen (`mat`, `share`, `cut`).** Kind ids from `kindOfKey` (`shared/swamphen/round.ts:66`). `mat`: "The mat hides the garden. Count the rows you can see." hand on the visible rows, the mat lifts. `share`: "Share the plants into equal rows." hand drops one plant per row in turn. `cut`: "Cut the garden into two smaller gardens." hand draws the cut line. Use a size that is not in `KEYS`. Allowed: `plant, mat, turn, which, share, cut, short`.

**Part 6: Robin (`howmany`, `counton`).** Kind id: `goKindOf(key)` (`shared/robin/round.ts:39`). `howmany`: "Touch each berry as you count." hand touches each berry, the number grows; "Then pick the number." `counton`: "There are four under the cloth. One more comes. Count on: five." the hand adds one berry. Use numbers the step does not ask. Allowed: `give, howmany, counton`.

**Child-facing words are drafts**: the session may reword them, keeping them short and voice-first, and must not use the answer to a real go.

## 4. Files affected

- Part 1 (kit, own branch `kit-kind-demo` and PR): `src/kit/useKindDemo.ts`, `src/kit/DemoBar.tsx`, `src/kit/index.ts`, `src/kit/README.md`, `src/kit/kitJunior.test.tsx`.
- Each game part (own branch `demo-<game>`): `src/games/<game>/Goes.tsx` (play the demo before an unseen kind), `<Game>Game.tsx` (pass `seen` and `markSeen`), `backend.ts`, `words.ts`, `voiceLines.ts`, `<game>.css` (the `-demo` bar), `shared/<game>/server.ts`, `shared/<game>/memoryServices.ts`, `supabase/functions/<game>/entry.ts`, the rebuilt `supabase/functions/<game>/index.ts` (`npm run build:functions -- <game>`), the new clips under `public/voice/<game>/` and `lines.json`, and the game's test file.
- Not touched: `shared/kit` (S11 owns it), `shared/maths`, `src/styles.css`, `src/components`.

## 5. Database / migration needs

None here. It uses the table and functions from S11 (migration `kit_seen`), which must be live before any of these PRs merge. Each game's function calls `kit_seen_get` and `kit_seen_mark` through the server key.

## 6. Test steps

Per game, two tests at most (inside the 8-per-game limit): (1) the server `seen` action: a bad kind gives "unreadable", a good one is saved twice with no change, `load` returns the saved kinds plus the kinds from the child's facts; (2) the demo's example is not any key in the game's `KEYS` for that kind. The voice test (`voiceLines.test.ts`) must pass, so every new line has a clip.

By playing the preview (set the step with the preview buttons):
- A new child at the step with the new kind sees the demo once, with the voice; Skip appears after about 3 seconds; after Skip or the end the real go starts and the choices work.
- Play again or reload: no demo. Play on another browser as the same child: no demo.
- A child who already has facts of that kind (use a seeded record) sees no demo.
- Teacher help set to Off still shows the demo (it is a demo, not help).
- No console errors; the demo adds nothing to the saved taps (finish still works).

## 7. Size and impact

M: one kit shell (small), then about half a day for each game (a made-up example, a few lines of words, clips, server action). High: new kinds are where children get lost, and the cost is a one-off 10 to 15 seconds per kind.

## 8. Session prompts (ready to paste)

Use these in order. Part 1 first; Parts 2 to 6 only after S11 and Part 1 are merged.

### Part 1: kit shell

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 4) and docs/plans/maths-review-2/S12-show-me-first-newer-five.md (Part 1). S11 (the seen-kinds kit part) must already be on main; check. Create branch `kit-kind-demo` from origin/main in a new worktree.
Build src/kit/useKindDemo.ts and src/kit/DemoBar.tsx exactly as the plan says: no game words; steps with a line and a hold time; says each line with the game's say function and waits for its end; Skip after 3 seconds (copy the timing style of useLookTogether in src/kit/ShowWhy.tsx); gives up after 20 seconds; marks the kind seen once via the mark function it is given; does nothing when the kind is already seen. Export from src/kit/index.ts and add a short README entry. One test in src/kit/kitJunior.test.tsx. npm run build:functions (expect no change), typecheck, test:changed, build.
Do not touch any game folder. Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Pigeon

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S12-show-me-first-newer-five.md (Part 2 and the rules for every game). S11 and S12 Part 1 must be on main. Create branch `demo-pigeon` from origin/main in a new worktree.
Steps: (1) shared/pigeon/server.ts: `load` returns `seen` (mergeSeen of saved and kindsFromFacts with kindOfKey); add the `seen` action with readKinds and services.markSeen; add seen/markSeen to Services, memoryServices.ts and supabase/functions/pigeon/entry.ts. (2) src/games/pigeon: backend markSeen, a made-up zoom example not in KEYS, useKindDemo and DemoBar in Goes.tsx (max 2 demos a round, no demo taps in the saved taps, mark a kind seen when any go of it is finished, mark go 0's kind after the guided first go), words and voice lines in words.ts and voiceLines.ts, styles in pigeon.css. (3) Record the new clips with Kokoro af_bella (python3 scripts/voice-clips.py --list; ~/kokoro/.venv/bin/python -I scripts/voice-clips.py pigeon) and commit them with lines.json. (4) npm run build:functions -- pigeon.
Tests, two at most: the seen action; the example is not in KEYS. Play the preview at a step with zoom (step 6): demo once, Skip after 3 s, no demo on reload. Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Parrot

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S12-show-me-first-newer-five.md (Part 3 and the rules for every game). S11 and S12 Part 1 must be on main. Create branch `demo-parrot` from origin/main in a new worktree.
Do the same steps as Part 2 for Parrot: server `seen` action and `load` (shared/parrot/server.ts, memoryServices.ts, supabase/functions/parrot/entry.ts), backend markSeen, demos for true-or-false (tf) and take-away (sub) with made-up examples not in KEYS, words and voice lines, clips with Kokoro af_bella, npm run build:functions -- parrot. Allowed kinds: miss, swap, both, sub, tf.
Tests, two at most: the seen action; the examples are not in KEYS. Play the preview at steps 5 and 6. Stop and tell James before any live step. Open a PR when done.
```

### Part 4: Lizard

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S12-show-me-first-newer-five.md (Part 4 and the rules for every game). S11 and S12 Part 1 must be on main. Create branch `demo-lizard` from origin/main in a new worktree.
Do the same steps as Part 2 for Lizard: server `seen` action and `load` (shared/lizard/server.ts, memoryServices.ts, supabase/functions/lizard/entry.ts), backend markSeen, demos for Swap and Bundle with made-up examples not in KEYS, words and voice lines, clips with Kokoro af_bella, npm run build:functions -- lizard. Allowed kinds: build, read, bundle, swap, more.
Tests, two at most: the seen action; the examples are not in KEYS. Play the preview at the steps where Swap and Bundle first come. Stop and tell James before any live step. Open a PR when done.
```

### Part 5: Swamp Hen

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S12-show-me-first-newer-five.md (Part 5 and the rules for every game). S11 and S12 Part 1 must be on main. Create branch `demo-swamphen` from origin/main in a new worktree.
Do the same steps as Part 2 for Swamp Hen: server `seen` action and `load` (shared/swamphen/server.ts, memoryServices.ts, supabase/functions/swamphen/entry.ts), backend markSeen, demos for mat, share and cut with made-up examples not in KEYS, words and voice lines, clips with Kokoro af_bella, npm run build:functions -- swamphen. Allowed kinds: plant, mat, turn, which, share, cut, short.
Tests, two at most: the seen action; the examples are not in KEYS. Play the preview at steps 3, 4 and 5. Stop and tell James before any live step. Open a PR when done.
```

### Part 6: Robin

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S12-show-me-first-newer-five.md (Part 6 and the rules for every game). S11 and S12 Part 1 must be on main. Create branch `demo-robin` from origin/main in a new worktree.
Do the same steps as Part 2 for Robin: server `seen` action and `load` (shared/robin/server.ts, memoryServices.ts, supabase/functions/robin/entry.ts), backend markSeen, demos for How many? (howmany) and One more (counton) with made-up examples not in the step keys, words and voice lines, clips with Kokoro af_bella, npm run build:functions -- robin. Allowed kinds: give, howmany, counton (use goKindOf in shared/robin/round.ts).
Tests, two at most: the seen action; the examples are not in the keys. Play the preview at steps 2 and 5. Stop and tell James before any live step. Open a PR when done.
```
