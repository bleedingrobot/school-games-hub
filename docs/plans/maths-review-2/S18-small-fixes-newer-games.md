# S18: Lizard, Pigeon, Robin, Swamp Hen: small fixes found in play

**Game:** Lizard, Pigeon, Robin, Swamp Hen (one part each; Parrot and the others have nothing small left in this review)
**What's wrong:** A handful of small bugs and rough edges the evaluators saw: Lizard's raft tip shows on a go with no raft; Pigeon's "arrow" is a dot; Robin's help box is off the screen on a laptop and berries overlap; Swamp Hen's cards give clues by their shape and one question is faint.
**What done looks like:** Play each game and the thing is gone: no raft tip on a Swap go, a real arrow on Pigeon's read go, Robin's help always in view with no overlapping berries, and Swamp Hen's four cards look alike with a clear question.
**Size:** S (each part is under half a day, and they are separate branches)
**Impact on learning:** Low to Med
**Waits for:** nothing (Pigeon part: skip it if card S7 already covers the arrow, see its part)

## 1. The problem

Each part is checked against the code. "Seen" means an evaluator saw it in play in `docs/reviews/maths-review-2/games/<game>.md`.

**Lizard**
- Raft tip on a Swap go with no raft. `src/games/lizard/Goes.tsx:178` tests `go.n >= 100 || go.answer >= 100`. For Bundle and Swap goes the stored answer is not a number of sticks: it is bundles x 100 + sticks (`shared/lizard/round.ts:273-274`: Bundle `t * 100 + o`, Swap `(t - 1) * 100 + o + 10`). So a Swap go for 29 has answer 119 and the tip "Ten bundles tied together make a raft: a hundred." pops up on step 4 with no raft in sight (seen, `lizard.md:35`). It shows again each go until the child presses Got it (the "seen" flag is saved only on close, `Goes.tsx:192-198`).
- The finish screen never says how many were right (seen, `lizard.md:121`). `LizardFinish` already has `firstRight` (`src/games/lizard/backend.ts:25-27`) but `Finish` (`src/games/lizard/LizardGame.tsx:189-209`) does not use it.
- Step 1 asks the same five tens, each twice (`shared/lizard/round.ts:184-186`, five keys in `STEP_KEYS[1]`, `:49`). `spreadOut` (`:156-164`) keeps the same key from coming twice in a row, so it is not a bug; there are only five tens keys. A real fix needs new keys in `shared/maths`, which a game branch may not touch, so this part leaves it and says so.
- Raft art (seen, `lizard.md:122`: "rafts are drawn like small bundles at help 3"). In the 3-column mat the raft is 64 x 42 px and a bundle 34 x 36 (`src/games/lizard/lizard.css:159-161`). Not proved wrong by the code: check by playing step 6 first.

**Pigeon**
- "What number is at the arrow?" (`src/games/pigeon/voiceLines.ts:19`) points at a plain dot with a "?" beside it: the "arrow" is a `LinePoint` with label "?" (`src/games/pigeon/Goes.tsx:176`) drawn by the kit's `NumberLine` as a dot (seen, `pigeon.md:36`). The line also jumps up about 80 px when the reason panel opens (play only, `DECISIONS.md` section 7, item 12).
- Card S7 may already cover the arrow. At the time of writing there is no S7 plan file in `docs/plans/maths-review-2/`. The session must check first (step 1 of the part).

**Robin**
- Help box below the fold: the "why" panel (`.rb-why`, `src/games/robin/robin.css:112-120`) comes after the berries and the cards inside a centred flex column, and was seen at y 731 to 743 in a 768 px window (`robin.md:37`; one window size, so check on a real laptop first).
- Berries fade in late: the whole stage fades in over 0.4 s (`.rb-stage`, `robin.css:92-93`), and the first guided hand waits `GUIDE_MS` 3000 ms (`src/games/robin/Goes.tsx:35-37`). Seen as about a second.
- Berries overlap: scattered berries are put in a 6 x 5 grid of cells with random wobble (`shared/robin/round.ts:185-186`: `x = ((c % 6) + 0.5) * (100 / 6) + (random() - 0.5) * 6`, `y = (floor(c / 6) + 0.5) * 20 + (random() - 0.5) * 6`). A berry button is `clamp(48px, 11%, 64px)` wide and square (`robin.css:167-169`), and the pile is at most 520 px wide and `30dvh` high with a 2:1 shape (`robin.css:166`). Rows are 20% of the height apart, which is about 52 px on a 260 px high pile, and a berry is up to 57 px high, so berries in neighbouring rows overlap, more with the wobble. That is the cause.
- Phone: "Preview tools" and "Voice on" sit on the progress dots at 375 px. Preview tools are shown only in the preview (`src/games/robin/RobinGame.tsx`; same pattern as Swamp Hen's `SwamphenGame.tsx:68`), so this is partly a preview-only problem. The real bar is `.rb-bar` (`robin.css:25`, left-aligned and wrapping at 640 px, `:141-145`) over a `padding-top: 64px` that is too short when the bar wraps to two rows.

**Swamp Hen**
- Cards give the answer away by shape (`swamphen.md:30` and `:111`). The wrong cards are the named slips first (`shared/swamphen/round.ts:236-241`): for plant, mat, turn and which goes they are `a + b`, `(a - 1) * b` and the two numbers joined side by side (`Number(`${a}${b}`)`, so 3 and 7 give 37). The joined number is nearly always the biggest card and looks like a different kind of number; `a + b` is always small. Only the fourth card is a plain neighbour. (Seen: 3 x 7 gave 10, 14, 21, 37.)
- The leftover card: after 3 wrong taps, `pictureFor` keeps the right card and one wrong card, and that wrong card is nearly always one already tried (`shared/swamphen/round.ts:310-313`: it picks an untried wrong card, but with three wrong taps on four cards all three have been tried, so it always falls back to a tried one). A child who remembers which they tried is left with a forced answer (`swamphen.md:111`). This is the same "elimination" pattern as the other games (`DECISIONS.md` section 7, item 4), so the part only makes the small change below and does not try to remove the pattern.
- Faint text: the evaluator saw the question on the "Which garden" go almost the same colour as the scene (`swamphen.md:39`, screenshot). In the code `.sh-ask` has a cream panel and dark ink (`src/games/swamphen/swamphen.css:94`, `--sh-panel` `#fffdf5`, `--sh-ink` `#1b2340`), so the faint text may be a different element (for example the picture cards at `opacity: 0.35`, `swamphen.css:111`, which is the "tried card" style, or the small garden pictures). It must be found in play before changing anything.

## 2. The rule behind it

Rule 2 (one thing at a time, voice first) and rule 3 (concrete, then picture, then number): a tip must be about what is on the screen, the help must be in view, and the question must be readable. Rule 7 (mistakes teach): a wrong card that is a number "joined" together teaches, but only when it looks like a real answer, not an odd one out. Rule 9 (evidence): the first-time-right count should be shown to the child kindly.

## 3. The change

### Part 1: Lizard
1. `src/games/lizard/Goes.tsx:178`: replace the test with one that knows the kind. Add a small helper `hasRaft(go)`: for `build`, `read` and `more` goes `go.n >= 100 || go.answer >= 100` (their answer is a plain number); for `bundle` and `swap` goes `go.n >= 100` only (their answer is bundles x 100 + sticks, `shared/lizard/round.ts:273-274`). Use it in the effect at `:177-185`. Pure function in `src/games/lizard/` (or exported from the game's own file), tested.
2. Finish result. In `Finish` (`LizardGame.tsx:189-209`) pass a line as `children` (not `note`, which is the "next time" line): `<p className="lz-chip">You got {result.firstRight} of 10 right first time.</p>` using `result.firstRight` (`backend.ts:27`). Use "of 10" from `GOES_PER_ROUND`. No word like "only"; show it whatever the number. Text only (no new voice clip: do not add it to the spoken line, so no clips need making). Add the text to `words.ts` as `WORDS.firstTime(n)`.
3. Step 1 repeats: leave as is (needs new keys in `shared/maths`). Write one line in the plan's PR description saying so.
4. Raft art: play step 6 at help 3 (preview buttons). If a raft and a bundle look alike, remove the 3-column override at `lizard.css:161` so a raft keeps 84 x 54 px, or draw a "100" label on a raft. If they already look clearly different, change nothing and say so.

### Part 2: Pigeon
1. Check `docs/plans/maths-review-2/` for an S7 plan. If it changes the "arrow" (the dot on a read go), do nothing in this part for the arrow and tell James; the layout-jump fix below can still be done.
2. If not covered, the smallest fix that needs no kit change: keep the dot but change the words, `voiceLines.ts:19`, to "What number is at the question mark?" (the dot already carries a "?" label, `Goes.tsx:176`). This changes one spoken line, so record the new clip: `~/kokoro/.venv/bin/python -I scripts/voice-clips.py pigeon` (it records only lines without a clip, `scripts/voice-clips.py` header). Also change the matching written line and the aria label at `Goes.tsx:182`. A drawn arrow needs `src/kit/NumberLine.tsx` (a kit change, its own small branch): note it in the PR as optional later.
3. Layout jump: reserve room for the reason panel under the line so the line does not move when `ShowWhy` appears (`src/games/pigeon/Goes.tsx:215-228`). Add an empty `min-height` slot around the three panels (why, look, redo) in `pigeon.css` (the `.pg-why` rule is at `:124-127`); start with `min-height: 5.5rem` and check by playing that nothing moves when a wrong tap shows the panel.

### Part 3: Robin
1. Help in view: in `src/games/robin/Goes.tsx` (where `ShowWhy` and `LookTogether` are drawn, `:345-348`), add an effect that scrolls the panel into view when it appears: `document.querySelector('.rb-why')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })`. Also lower the pile's `max-height` from `30dvh` to `26dvh` while a panel is open (a class on the stage, `rb-stage--help`) so it fits on a 768 px window without scrolling. Check on a 1366 x 768 laptop-size window (resize the preview).
2. Berries on the stage: drop the opacity fade on `.rb-stage` (`robin.css:92-93`): use `animation: rb-in 0.2s ease-out` and change the keyframe to move only (`translate`), no `opacity`, so berries are visible and tappable at once.
3. Overlap: change the scatter layout in `shared/robin/round.ts:185-186` to 6 columns by 4 rows (24 cells, enough for the most berries a pile shows, `MAX_PILE = 24` in `shared/robin/config.ts`... but check: a scatter shows at most 20 berries, `docs` and the `give` keys go to 20), with `y = ((floor(c / 6)) + 0.5) * 25 + (random() - 0.5) * 3` and `x = ((c % 6) + 0.5) * (100 / 6) + (random() - 0.5) * 3` (smaller wobble), and `shuffle(range(0, 23), random)`. Rows are then 25% of the height apart (65 px on a 260 px pile), more than a 57 px berry. If the pile can show more than 24 berries, keep 5 rows only for those. This is a server-side shared file, so existing open rounds re-lay out: that is harmless (berry positions are not part of the replay), but say so in the PR. Add one test: for n from 1 to 20 no two berry points are closer than the berry size (use 11% of the pile width and the pile aspect 2:1).
4. Phone bar: in the `max-width: 640px` rule (`robin.css:141-145`) raise `padding-top` from 64px to 104px so a wrapped bar never sits on the dots, and do not show "Preview tools" in the real game (check it is already hidden outside the preview).

### Part 4: Swamp Hen
1. Find first: play a "Which garden" go and a plant go at 1366 x 768 and take screenshots. Name the element with faint text. If it is `.sh-ask` or the pictures' labels, give them `color: var(--sh-ink)` and a solid panel; if it is the tried cards at `opacity: 0.35` (`swamphen.css:111`), raise it to `0.55` and add a line-through or a cross so it is not only faint. If nothing is faint in play, change nothing and say so.
2. Card shapes: in `shared/swamphen/round.ts:244-254` `wrongCards`, stop the "joined digits" card from always being present. Take at most one "joined" card and only when it has the same number of digits as the answer; fill the rest from the other named slips and the plain neighbours (`answer ± 1, 2, 3, 10`, line 246). Keep `atMostShareTell` as it is. Test: for 3 x 7 (answer 21) the four cards are all between 10 and 30 most of the time and `37` appears only when the digit count matches.
3. Leftover: in `pictureFor` (`round.ts:310-313`) when three wrong taps have been made, keep the right card and the untried-or-nearest named slip card, and also keep the two cards visible but greyed (do not hide any), so the child sees the cards that are out and the answer is not "the only one not tried". If this looks no different from today in play, leave it and say so. Do not spend more than an hour on this item.

## 4. Files affected

- Lizard: `src/games/lizard/Goes.tsx`, `LizardGame.tsx`, `words.ts`, `lizard.css`, a test.
- Pigeon: `src/games/pigeon/voiceLines.ts`, `Goes.tsx`, `pigeon.css`, new clip in `public/voice/pigeon/` (made on James's Mac with Kokoro). No kit file this time.
- Robin: `src/games/robin/Goes.tsx`, `robin.css`, `shared/robin/round.ts` (its own game folder, fine for a game branch), a test.
- Swamp Hen: `src/games/swamphen/swamphen.css`, `Goes.tsx` (maybe), `shared/swamphen/round.ts`, a test.
- Nothing in `shared/kit`, `shared/maths`, `src/components` or `src/styles.css`.

## 5. Database / migration needs

None. The Robin and Swamp Hen round code changes only how a round is made and shown; saved taps are the same. Deploying the two changed `shared/` files means redeploying that game's server function (`supabase/functions/robin`, `supabase/functions/swamphen`): a live step for James.

## 6. Test steps

Automated (each game stays within its 8):
- Lizard: `hasRaft` is false for a Swap go of 29 and a Bundle go of 23, true for a Build of 120 and a read of 305.
- Robin: no two scattered berries closer than a berry for every n from 1 to 20 over a few seeds.
- Swamp Hen: the joined-digits card appears only with the same digit count as the answer; the four cards for 3 x 7 stay within a narrow range.

By playing the preview (each game's own preview config, for example `npx vite --config vite.<game>-preview.config.ts`): Lizard step 4, play to a Swap go: no tip; finish a round: "You got N of 10 right first time". Pigeon step 2: wording matches the "?" and the line does not jump when a wrong tap opens the panel. Robin at 1366 x 768 and at 375 x 812: the help box and the berries are in view together, berries do not touch. Swamp Hen: cards for several multiplication goes look alike, the question is readable.

## 7. Size and impact

Size S each: one file or two, one test, no database. Impact Low to Med: none of these changes a score on its own, but the raft tip and the hidden help box confuse the exact children the games are for, and the Robin and Swamp Hen card changes make guessing a little less easy (`DECISIONS.md` section 7, item 1).

## 8. Session prompt (ready to paste)

A plan with parts that run one after another: do them in order, one branch and PR each.

### Part 1: Lizard

```text
You are building part 1 of card S18 (small fixes in the newer games) of the second Foundational maths review for the Games Hub: Lizard's Bundles.

Create your own branch and worktree from origin/main, named lizard-small-fixes. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S18-small-fixes-newer-games.md (Part 1: Lizard) first. Reply to James in plain, simple words.

Steps:
1. In src/games/lizard/Goes.tsx:178 the raft tip tests `go.n >= 100 || go.answer >= 100`, but for Bundle and Swap goes the answer is bundles x 100 + sticks (shared/lizard/round.ts:273-274). Add a small pure helper `hasRaft(go)`: build, read and more goes use `go.n >= 100 || go.answer >= 100`; bundle and swap goes use `go.n >= 100` only. Use it in the effect.
2. On the finish screen (src/games/lizard/LizardGame.tsx, Finish) add, as `children` of WhatsNext, a line "You got N of 10 right first time." using result.firstRight (src/games/lizard/backend.ts:27) and a WORDS.firstTime(n) in words.ts. Text only: do not change the spoken line, so no new voice clips.
3. Leave step 1's repeated tens alone (it needs new keys in shared/maths, which this branch may not touch). Say so in the PR.
4. Play step 6 at help 3 in the preview. If a raft looks like a bundle, remove the 3-column raft size override at src/games/lizard/lizard.css:161 (or label the raft 100). If they already look different, change nothing and say so.
Test (one): hasRaft is false for a Swap go of 29 and a Bundle go of 23, true for a Build of 120 and a read of 305. Run typecheck and the Lizard tests. Check in the preview.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Pigeon

```text
You are building part 2 of card S18 (small fixes in the newer games) of the second Foundational maths review for the Games Hub: Pigeon's Berry Branch.

Create your own branch and worktree from origin/main, named pigeon-small-fixes. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S18-small-fixes-newer-games.md (Part 2: Pigeon) first. Reply to James in plain, simple words.

Steps:
1. Look in docs/plans/maths-review-2/ for a card S7 plan. If it already makes the "arrow" on Pigeon's read go a real arrow (or changes that line), skip step 2 and tell James.
2. Otherwise change the read line in src/games/pigeon/voiceLines.ts:19 (and the written and aria text at src/games/pigeon/Goes.tsx:182) to "What number is at the question mark?", because the arrow is a dot with a "?" (Goes.tsx:176). Record the new clip: ~/kokoro/.venv/bin/python -I scripts/voice-clips.py pigeon (only lines without a clip are recorded; this needs Kokoro on James's Mac, so if it is not there say so and leave the clip to James). Do not change src/kit/NumberLine.tsx.
3. Stop the line jumping up about 80 px when the reason panel opens: reserve a min-height slot (start with 5.5rem) around the why, look and redo panels in src/games/pigeon/pigeon.css (the .pg-why rules are at :124-127). Check by playing a wrong tap on the preview that nothing moves.
Test (one, optional): the read go's written line says "question mark" and the voice-line test still passes. Run typecheck and the Pigeon tests.
Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Robin

```text
You are building part 3 of card S18 (small fixes in the newer games) of the second Foundational maths review for the Games Hub: Robin's Berry Basket.

Create your own branch and worktree from origin/main, named robin-small-fixes. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S18-small-fixes-newer-games.md (Part 3: Robin) first. Reply to James in plain, simple words.

Steps:
1. Help in view: in src/games/robin/Goes.tsx (ShowWhy and LookTogether, around :345-348) scroll the panel into view when it appears (`.rb-why`, block 'nearest', smooth). Lower the pile's max-height from 30dvh to 26dvh while a panel is open (a class on the stage). Check at a 1366 x 768 window in the preview that the help and the berries are both in view.
2. Berries on the stage: in src/games/robin/robin.css:92-93 stop the opacity fade (keep a short move only, 0.2 s) so berries are visible and tappable at once.
3. Overlap: in shared/robin/round.ts:185-186 change the scatter to a 6 x 4 grid of cells (24 cells) with rows 25% of the height apart and a wobble of about plus or minus 1.5, so neighbouring berries never touch (a berry is up to 11% of the pile width and square; the pile is 2:1). Check the largest scatter is 20 berries. If the pile can show more than 24, keep five rows only for those goes.
4. Phone: in the max-width 640px rule (src/games/robin/robin.css:141-145) raise padding-top from 64px to 104px so the wrapped top bar never sits on the progress dots. Check at 375 x 812 and say whether "Preview tools" is hidden in the real game.
Test (one): for n from 1 to 20 and a few seeds no two scattered berries are closer than a berry. Run typecheck and the Robin tests. Do not touch shared/kit or shared/maths.
Stop and tell James before any live step (the Robin server function must be redeployed because shared/robin/round.ts changed). Open a PR when done.
```

### Part 4: Swamp Hen

```text
You are building part 4 of card S18 (small fixes in the newer games) of the second Foundational maths review for the Games Hub: Swamp Hen's Reed Rows.

Create your own branch and worktree from origin/main, named swamphen-small-fixes. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S18-small-fixes-newer-games.md (Part 4: Swamp Hen) first. Reply to James in plain, simple words.

Steps:
1. Find the faint text first: in the preview play a "Which garden" go and a plant go at 1366 x 768 and take screenshots. If the question (.sh-ask, src/games/swamphen/swamphen.css:94) or a label is faint, give it the dark ink colour on a solid panel; if the faint thing is the tried cards (opacity 0.35, swamphen.css:111) raise it to 0.55 and add a cross. If nothing is faint, change nothing and say so.
2. Card shapes: in shared/swamphen/round.ts:244-254 (wrongCards) the first three wrong cards are a + b, (a - 1) x b and the two numbers joined (37 for 3 and 7). Make the joined card appear only when it has the same number of digits as the answer; fill the rest from the other named slips and the plain neighbours. Keep atMostShareTell.
3. Leftover card: in pictureFor (shared/swamphen/round.ts:310-313) after three wrong taps the one wrong card kept is nearly always one already tried. Keep all four cards visible with the tried ones greyed so the answer is not just "the one not tried". If it looks no different in play, leave it and say so. Do not spend more than an hour on this step.
Tests (at most two): the joined card appears only with the right digit count; the four cards for 3 x 7 stay in a narrow range. Run typecheck and the Swamp Hen tests. Do not touch shared/kit or shared/maths.
Stop and tell James before any live step (the Swamp Hen server function must be redeployed because shared/swamphen/round.ts changed). Open a PR when done.
```
