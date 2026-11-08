# S30: Hop, Pipi and Tūī: Hear the question again

**Game:** Hop (Glow-worm Pond), Pipi (Pipi's tide games) and Tūī's Ten Tree
**What's wrong:** Hop and Pipi have no "Hear it again" button, so a child who missed the voice cannot hear the question again. Tūī takes the voice off the numbers at its lowest help levels, so a child who cannot read the numbers is left with "How many?" and nothing else.
**What done looks like:** Hop and Pipi each show a "Hear it again" button that says the question again. Tūī says the full sum or story at every help level, and its button says it too.
**Size:** S
**Impact on learning:** High
**Waits for:** nothing

## 1. The problem

**Hop and Pipi.** The voice reads each hop or go once, when it appears. There is no way to hear it again. Six other games already have the kit button `HearAgain` (`src/kit/HearAgain.tsx`): Weka, Lizard, Pigeon, Swamp Hen, Robin and Parrot (for example `src/games/lizard/Goes.tsx:293`). Hop and Pipi do not. The second review found this in both: "No repeat-the-question button" (Pipi) and "No replay button" (Hop) in `docs/reviews/maths-review-2/issues-b.json`, both `not_fixed`. `docs/reviews/maths-review-2/DECISIONS.md:71` says it is the thing keeping them from a Clarity 4.

Where the voice is read now:
- Hop: `src/games/hop/Hops.tsx:93-108` says `hopLine(hops[at].spoken, guide && at === 0)` once per hop. A wrong tap says the why-line (`:163-165`).
- Pipi: `src/games/pipi/Goes.tsx:133-143` says `goes[at].spoken` once per go after the tide. The why-line is `whyLine(...)` (about `:275`).

**Tūī.** The voice for a go is `askLine(go)` (`src/games/tui/voiceLines.ts:40-42`): at level 5 and above the story, at levels 1 to 4 the sum ("Ten plus 3. How many?"), and at level 0 only `shortLine`, which is "How many?", "How many more?" or "How many are left?" (`:37`) with no numbers. The picture help fades with the level, and the voice fades with it. But the child who relies on the voice for the numbers is the child who still needs them. At level 0 the sum is shown large on screen (`src/games/tui/Goes.tsx:222`), so a sighted reader is fine, but a child who cannot yet read "13" has no way to hear it. Level 0 is also what the teacher's "Off" help setting gives (`shared/tui/round.ts:74`). The first review's Tūī candidate 6 asked for this ("Voice for numbers at levels 1 and 0", `docs/reviews/maths-review-2/games/tui.md:34`, `:117`, `:181`), and the file's own header comment (`voiceLines.ts:6-8`) says "Hear it again" should always read the sum, but the code uses `askLine`, so it does not. The button at `Goes.tsx:202` is a hand-made button, not the kit one.

## 2. The rule behind it

- **Rule 2, Voice first** (`docs/LEARNING-DESIGN.md`): every question can be heard, and "Hear it again" is always visible. This is the plain gap.
- **Rule 5, Help follows the child**: pictures can fade as a child grows, but the voice for the numbers is not a picture help. It is how a child who cannot read yet gets the question at all.
- Pattern 10 in `docs/reviews/maths-review-2/DECISIONS.md:148` (a Hear it again button on every game).

## 3. The change

No new maths and no new kit file. Not a kit part: it uses the existing `HearAgain`.

### Part 1: Hop and Pipi get "Hear it again"

For each game:
1. Add `hearAgain: 'Hear it again'` to the game's `WORDS` (`src/games/hop/words.ts`, `src/games/pipi/words.ts`).
2. Put `<HearAgain prefix="hp" label={WORDS.hearAgain} onHear={...} />` in Hop (`.hp-button` already exists, `src/games/hop/hop.css:25`) and `prefix="pp"` in Pipi (`.pp-button`, `src/games/pipi/pipi.css:31`).
3. Place it:
   - Hop: inside `.hp-top` (`hop.css:284`) next to the progress dots, in `Hops.tsx` near `:228-230`. Home and Voice sit in the absolute `.hp-bar` (`hop.css:24`, `HopGame.tsx:142`), so keep clear of them.
   - Pipi: next to the progress dots `.pp-progress` (`Goes.tsx` about `:237`). There is no top wrapper there, so add a small `.pp-top` row in `pipi.css` that holds the dots and the button.
4. `onHear` does what Weka's and Lizard's do (`src/games/weka/Goes.tsx:454`):
   - Do nothing while the look-together step is on (`look` is set).
   - If a why-line is showing, say that line again.
   - Otherwise say the question: `hopLine(hop.spoken, false)` for Hop, `go.spoken` for Pipi (no "Let's do the first one together" intro).
   - After the voice ends, if the child has not tapped yet, restart the answer clock (`say(line, () => { if (!tappedYet.current) since.current = Date.now(); })`), as R2 did, so time spent listening does not count (Rule 8).
5. The button is silent when "Read the words out loud" is off, the same as Weka and Lizard (the game's `say` only runs the end function when voice is off).
6. No new Kokoro clips: every line is already in the game's `allVoiceLines` (Hop `src/games/hop/voiceLines.ts:32-67`, Pipi `src/games/pipi/voiceLines.ts`). Only the visible label is new, and labels are not spoken.

### Part 2: Tūī says the numbers at every level

1. In `src/games/tui/voiceLines.ts`, change `askLine` (`:40-42`) so every level says its numbers: `go.l >= 5 ? storyLine(go) : sumLine(go)`. Delete `shortLine` (`:37`) and its line in `allVoiceLines` (`:64`). Fix the header comment (`:6-8`) to say the numbers are said at every level.
2. `src/games/tui/Goes.tsx:105` (the first read) and `:202` (the button) both call `askLine`, so both now say the sum at level 0. Optional: swap the hand-made button at `:202` for the kit `<HearAgain prefix="tui" label={...} onHear={() => say(askLine(go))} />` (`.tui-button` exists, `src/games/tui/tui.css:26`). Do it only if it looks the same.
3. No new Kokoro clips. Every `sumLine` already has a clip, since levels 1 to 4 use them. Delete the three clips that no line uses now: `public/voice/tui/how-many.mp3`, `how-many-more.mp3`, `how-many-are-left.mp3` (the voice test fails on a clip with no line). Rewrite `public/voice/tui/lines.json` with `WRITE_VOICE_LINES=1 npx vitest run src/games/tui/voiceLines.test.ts` (it drops from 194 lines to 191). No Kokoro run is needed.
4. Update the voice-fade paragraph in `docs/TUI-PLAN.md:126-128` so the doc matches.

## 4. Files affected

- Hop: `src/games/hop/Hops.tsx`, `src/games/hop/words.ts`, `src/games/hop/hop.css` (only if spacing needs it), test `src/games/hop/hopGuide.test.tsx` or `hopMistakes.test.tsx`
- Pipi: `src/games/pipi/Goes.tsx`, `src/games/pipi/words.ts`, `src/games/pipi/pipi.css`, test `src/games/pipi/Goes.test.tsx`
- Tūī: `src/games/tui/voiceLines.ts`, `src/games/tui/Goes.tsx` (only if the button is swapped), `docs/TUI-PLAN.md`, `public/voice/tui/lines.json`, three clips removed
- Not touched: `src/kit/HearAgain.tsx`, `shared/maths`, `src/maths`, `src/styles.css`, `src/components`, any shared function code, the games' saved data.

## 5. Database / migration needs

None. No saved data, no function, no migration. `npm run build:functions` is not needed because no shared function code changes.

## 6. Test steps

Keep tests few (the guide allows 8 for a game; add at most 1 per game).
1. Hop: add one test to `hopGuide.test.tsx` or `hopMistakes.test.tsx`: render a hop with `say` as a mock, click "Hear it again", and expect `say` to be called with the question (and with the why-line when a why shows).
2. Pipi: add one test to `src/games/pipi/Goes.test.tsx` (it renders `<Goes ... say={vi.fn()} />`) in the same way.
3. Tūī: add one unit test that `askLine` at level 0 contains the number (it must not be "How many?" alone). The existing `voiceLines.test.ts` checks the clips and `lines.json`.
4. Run `npm test`, `npx tsc --noEmit` and lint.

Play it:
- Hop and Pipi: with voice on, the button is visible and says the question again; during "Let's do the first one together" it does nothing; after a wrong tap it says the why-line; with voice off it stays silent. At a narrow phone width it does not cover Home or Voice.
- Tūī: play at help Off (level 0): the voice says "Ten plus 3. How many?" (the numbers), and the button says it again.

## 7. Size and impact

S. Small, local changes and no new recordings. Impact is High: the button is the plain Rule 2 promise, and Tūī's change gives the numbers back to the children who need them most.

## 8. Session prompt (ready to paste)

### Part 1: Hop and Pipi get "Hear it again"

```text
You are adding a "Hear it again" button to Hop and Pipi in the School Games Hub repo (/Users/jriley/games-hub-trader-captains or a fresh worktree).
Create branch fix/hop-pipi-hear-again from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 2, 5 and 8) and docs/plans/maths-review-2/S30-hear-the-question-again.md (Part 1) first. Read src/kit/HearAgain.tsx and src/games/lizard/Goes.tsx:293 and src/games/weka/Goes.tsx:454 for the pattern.

Steps:
1. Add hearAgain: 'Hear it again' to src/games/hop/words.ts and src/games/pipi/words.ts.
2. Hop: in src/games/hop/Hops.tsx add <HearAgain prefix="hp" label={WORDS.hearAgain} onHear={...}/> inside .hp-top next to the progress dots. onHear: nothing while the look-together step is on; say the why-line if a why shows; otherwise say hopLine(hop.spoken, false) and restart the answer clock after the voice if the child has not tapped.
3. Pipi: in src/games/pipi/Goes.tsx add the same button with prefix "pp" beside the progress dots (add a small .pp-top row in pipi.css). onHear: nothing while look-together; the why-line if a why shows; otherwise say go.spoken, then restart the answer clock if the child has not tapped.
4. No new voice clips are needed (all lines are already in allVoiceLines). Do not change voiceLines.ts in either game.
5. Tests: add at most one test per game (click the button and check say was called with the question): hopGuide.test.tsx or hopMistakes.test.tsx, and Goes.test.tsx in pipi. Do not add more.
6. Run npm test, npx tsc --noEmit and lint. Play both games in the preview at phone width: the button shows with voice on, does not cover Home or Voice, is silent with voice off.
Do not touch src/kit, shared/maths, src/maths, src/styles.css or src/components. No migrations or function changes (so no npm run build:functions).
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Tūī says the numbers at every level

```text
You are fixing Tūī's Ten Tree so the voice says the numbers at every help level, in the School Games Hub repo (/Users/jriley/games-hub-trader-captains or a fresh worktree).
Create branch fix/tui-voice-numbers from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 2 and 5) and docs/plans/maths-review-2/S30-hear-the-question-again.md (Part 2) first.

Steps:
1. In src/games/tui/voiceLines.ts change askLine to: go.l >= 5 ? storyLine(go) : sumLine(go). Delete shortLine and its line in allVoiceLines. Fix the header comment (lines 6-8).
2. Optional: replace the hand-made button at src/games/tui/Goes.tsx:202 with the kit <HearAgain prefix="tui" .../> only if it looks the same.
3. Delete the three orphan clips public/voice/tui/how-many.mp3, how-many-more.mp3 and how-many-are-left.mp3. Rewrite the list with WRITE_VOICE_LINES=1 npx vitest run src/games/tui/voiceLines.test.ts. No new clips are needed, so no Kokoro run.
4. Update the voice-fade paragraph in docs/TUI-PLAN.md (lines 126-128).
5. Test: add at most one unit test that askLine at level 0 includes the number. Do not add more.
6. Run npm test, npx tsc --noEmit and lint. Play Tūī with help Off: the voice says the sum and Hear it again says it too.
Do not touch src/kit, shared/maths, src/maths, src/styles.css or src/components. No migrations or function changes.
Stop and tell James before any live step. Open a PR when done.
```
