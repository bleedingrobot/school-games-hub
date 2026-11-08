# S16: "Now you try" asks a sister question: Pigeon, Parrot, Lizard, Swamp Hen, Robin

**Game:** Pigeon, Parrot, Lizard, Swamp Hen, Robin (the kit part must be general enough for the older games, which get it in S32)
**What's wrong:** After "Let's look together", "Now you try" asks the same question with the choices reshuffled. A child can answer by remembering the position or the number they just saw, not by doing the maths.
**What done looks like:** "Now you try" asks a sister question: the same idea and the same kind of go, with the numbers changed by one or two, and no marked card. It is not saved as an answer. Rule 7 in LEARNING-DESIGN says so first.
**Size:** M
**Impact on learning:** High
**Waits for:** nothing (step 1 is a small docs PR James must OK before the game parts)

## 1. The problem

- The rule today: after the second wrong tap the picture works the answer through and then "Now you try: the same question again with choices reshuffled. The redo isn't saved as a fact answer" (`docs/LEARNING-DESIGN.md:127`).
- The kit's look-together flow is `useLookTogether` / `ShowWhy` in `src/kit/ShowWhy.tsx` (skip after 3 seconds, `SKIP_AFTER_MS = 3000` at line 69; the hook at line 98).
- Every game then returns to the very same go. The child has just been told the answer, so a right tap proves little, and with the choices shuffled a child can still pick "the one I saw glowing".

## 2. The rule behind it

LEARNING-DESIGN rule 7 and rule 1 (the maths has to be the move). Transfer to a nearby question is what shows the idea was understood. The rule text must change first because line 127 says "the same question again".

## 3. The change

**Step 1 (first, small, docs only): amend rule 7, line 127.** A small PR on its own branch `rule7-sister-question` that changes step 3 of the "show why" flow so "Now you try" is "a sister question: the same idea and the same kind of go, numbers changed by one or two, with no marked card; still not saved". Also change the matching words in `docs/plans/maths-review/R5-mistakes-that-teach.md` only if it quotes the same line (check first). James must OK the wording before merging; nothing in the other steps starts until James has. This is a docs-only PR with no code or tests.

**What a sister question is (applies to all five games).**
- Same key (same kind of go, so the same help and the same picture type). In each game the go is made from a `key` and a seed (for example `showGo({ seed }, 0, { key, l })`, as in `src/games/robin/voiceLines.ts:56-60`). The sister uses the same `key` with new numbers.
- Numbers shift by 1 or 2 (never 0, never negative, never outside the key's own range, and never the same as the original answer or any of the original wrong choices where the range allows).
- No marked card: the sister never shows the "right one" glow or pointer.
- Not saved: it is not sent as a tap or a fact answer. The server never sees the sister (replay only accepts taps that are in the go's `choices`, `shared/kit/replay.ts:52-55`, so a sister tap sent to the server would be rejected). The browser keeps it local.
- One go only. After a right tap on the sister the child goes on to the next go. After a wrong tap on the sister, the picture shows why once more (the first-wrong "why" line) and the child gets the original go's right answer marked, so nobody is stuck.
- The original go still ends the usual way: the final right pick of the original go is appended to the taps once the child is done, so server replay still works (the go ends on the right pick, `shared/kit/replay.ts`).

**Kit part (own branch `kit-sister-go`).** `shared/kit/sister.ts`: a pure helper `sisterNumber(n, seed, { min, max, avoid })` that returns a number within 1 or 2 of `n`, in range, not in `avoid` (use deterministic seeded choice so tests are stable), and `src/kit/useLookTogether.ts` (or the existing hook in `src/kit/ShowWhy.tsx:98`) gets one optional field, `sister`, so a game can pass a function that builds its sister go and the hook runs "now you try" on it. No game words. The helper must be general: the older games use it in S32. One test (`shared/kit/kit.test.ts`): the result is within 1 or 2, in range, avoids the listed numbers, and is stable for the same seed. Run `npm run build:functions` in the same PR; commit any rebuilt `index.ts`. A kit change is its own branch and PR, so it cannot be done from a game branch.

**One part per game (branches `sister-pigeon`, `sister-parrot`, `sister-lizard`, `sister-swamphen`, `sister-robin`).** In each game's `Goes.tsx` the "now you try" step builds the sister go from the go's key with `sisterNumber` on the numbers that define the go and shows it in the same layout, without the marker; it never calls the backend; it falls back to the old reshuffled go if no valid sister exists for the key (a short list of such keys goes in the PR). The five parts share no code and can be done in any order, one session each. Each game needs at most one new test (the sister is a different go from the original, has the same key, and is not in the saved taps); stay under 8 tests per game.

**Child-facing words.** "Now you try one like it." replaces the current line (new Kokoro `af_bella` clip per game, with `voiceLines.test.ts` updated). The line must not say "the same".

## 4. Files affected

- Step 1: `docs/LEARNING-DESIGN.md` (line 127 only).
- Kit: `shared/kit/sister.ts` (new), `shared/kit/index.ts`, `src/kit/ShowWhy.tsx`, `shared/kit/kit.test.ts`.
- Per game: `src/games/<game>/Goes.tsx`, `src/games/<game>/words.ts`, `src/games/<game>/voiceLines.ts`, the new clip, and (if the sister needs a per-key rule) `shared/<game>/round.ts`. No game branch touches `shared/maths`, `src/maths`, `src/styles.css`, `src/components` or `supabase/functions/_shared`.

## 5. Database / migration needs

None. The sister is never saved and the server is not involved.

## 6. Test steps

Kit: one test (above). Per game: at most one test (a sister has the same key and different numbers and is not in the saved taps). By hand in a preview: tap wrong twice on a go; after the look-together the "now you try" asks a nearby question with no glow; tapping it right moves on; the saved taps for the round (in the preview log or the network call) contain only the original go.

## 7. Size and impact

M: one docs PR, one kit PR and five game parts. High: it turns "Now you try" from remembering into showing the idea works on something nearby.

## 8. Session prompt (ready to paste)

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 7) and docs/plans/maths-review-2/S16-now-you-try-sister-question.md. Do only the part named below.
Step 1: branch rule7-sister-question from origin/main; amend docs/LEARNING-DESIGN.md line 127 (step 3 of the show-why flow) so "Now you try" is a sister question as the plan describes; open a docs-only PR and stop for James to OK the wording.
Step 2 (only after James says OK): branch kit-sister-go; add shared/kit/sister.ts (sisterNumber), extend the look-together hook in src/kit/ShowWhy.tsx with an optional sister go, one test in shared/kit/kit.test.ts, npm run build:functions. Then one game per session on its own branch sister-<game>: build the sister go from the same key in Goes.tsx, no marked card, not saved or sent to the server, fallback to the old reshuffle if no valid sister; new af_bella clip for "Now you try one like it."; at most one new test. Typecheck, test:changed, build; open a PR.
```
