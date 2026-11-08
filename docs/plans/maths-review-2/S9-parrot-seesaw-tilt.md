# S9: Parrot: the see-saw tips toward the heavier side, and the words stop saying "equals"

**Game:** Parrot's See-saw
**What's wrong:** After a wrong answer on a true-or-false go the see-saw stays flat, so the picture never shows why. At level 4 it stays flat until Check. A plank that says "=" on its post while it is not level says the wrong thing, and a true-or-false go is read aloud as "is the same as", which gives the answer away. A wrong stone count gets a vague "Not quite" line.
**What done looks like:** A wrong answer makes the see-saw tip toward the heavier side, with the totals shown. The post shows "=" only when the plank is level, a "?" when nothing is judged yet. True-or-false asks "Is it the same?" and does not say "is the same as". A wrong stone count says "too many" or "not enough" (or the named slip).
**Size:** M
**Impact on learning:** High
**Waits for:** nothing

## 1. The problem

- **True-or-false stays flat.** `src/games/parrot/Goes.tsx:135-141` (`WhyPicture`): `tilt={tf ? 'rest' : leanWith(go, pick)}`, with the comment "A true or false go has no number to place, so it stays still." The picture after a wrong tap shows nothing about weight.
- **Level 4 stays flat until Check.** `Goes.tsx:315`: `tilt={live ? tilt : 'rest'}` with `live = level >= 5` (`:187`). After a wrong Check at level 4 the stone saw is still drawn flat, so the stones the child put on do not tip the see-saw.
- **The post always says "=".** `src/games/parrot/art.tsx:198`: a fixed `=` on the post, drawn whatever the tilt (`SeeSaw`, `:185`). A see-saw leaning left with an equals sign on it says two things at once. (DECISIONS pattern: the symbol must match the model.)
- **The equation is read as a fact.** `voiceLines.ts:26` `SAID = {'=': 'is the same as', ...}` and `:35` `eqLine`: a true-or-false go is read "Five plus three is the same as four plus two. Which way does it tip?" (`sayParts` on `go.parts`, which holds `=`, `round.ts:245-247`). That states the answer for the equal case and a falsehood for the others. `Equation` (`Goes.tsx:94-105`) also prints the `=`.
- **A wrong stone count gets a generic line.** `Goes.tsx:265`: `go.wrongs.find((w) => w.n === n)?.kind ?? 'near'`. Any stone count that is not one of the three wrong cards becomes `'near'`: "Not quite. Does it make both sides the same?" (`words.ts:49`). The same `?? 'near'` is in `shared/parrot/play.ts:33` (`slipsOf`), so the teacher page misses these too. A child who puts 11 stones on a 3 + ? side is told only "Not quite".

## 2. The rule behind it

- Rule 7 (mistakes teach): the wrong answer is shown on the same model, the see-saw, tipping the way the child's answer makes it.
- Rule 3 (concrete, then picture, then number): the weights and tilt come before the symbol; "=" is written only where it is true.
- Rule 2 (one thing at a time, voice first): the voice must not state the answer. "Is it the same?" asks; "is the same as" tells.

## 3. The change

`shared/parrot` changes, so the edge function must be rebuilt (section 5).

**A. The post shows what is true.**
1. `SeeSaw` (`art.tsx:185`): the post text comes from the tilt, no new prop:
   - `level` shows `=`;
   - `rest` shows `?`;
   - `left` or `right` shows nothing.
   Change the `<text>` at `:198` accordingly. The `=` and `?` use the same style as now. The `Tilt` type stays (`:118`).
2. `rest` is drawn as held, not balanced: when `tilt === 'rest'` draw two small props under the plank ends (two short rounded rects at the ends, down to the ground line, both in the unpainted and painted version), so a flat plank reads as "held still". They fade out (CSS opacity, 0.2s) when the tilt is anything else. Put the CSS in `src/games/parrot/parrot.css`.

**B. Tip toward the heavier side.**
3. `WhyPicture` (`Goes.tsx:135`): for a true-or-false go use `leanWith(go, 0)` (the go's own lean, from the weights, `Goes.tsx:81-85`) and draw the numbered weights with the pan totals written under each pan (for example 8 and 6, from `weightsOf`, `:68-78`). For the numbered goes nothing changes.
4. `CountingSaw` (`:117-133`): the tf branch already tilts after the first count; also write the pan totals when `filled >= 1`.
5. Level 4 wrong Check: change `Goes.tsx:315` to `tilt={live || why ? tilt : 'rest'}` (`why` is the state set at `:266` after a wrong answer). The saw tips with the child's stones and the props drop away. The next change (adding or removing a stone) returns it to `rest` until the next Check: set `why` to null on a stone change (the existing `setPlaced` handler).
6. A true-or-false go before any tap stays at `rest` (a tilt would give away the answer). The cards (`TipGlyph`, `art.tsx:232`) are unchanged.

**C. "Is it the same?" instead of "equals" on true-or-false.**
7. `Equation` (`Goes.tsx:94`): for `go.kind === 'tf'` replace the `=` token by a `?` chip (class `pr-eq__op pr-eq__ask`) with a visually hidden "is it the same as". After the go is solved show the matching `TipGlyph` in the chip's place. For the other kinds (8 = 5 + ?) the equation stays as printed: there the equals sign is the thing being taught.
8. Voice: `eqLine` (`voiceLines.ts:35`) for a tf go becomes `"{left parts}. {right parts}. Is it the same? Which way does it tip?"`, for example "Five plus three. Four plus two. Is it the same? Which way does it tip?". Build it by splitting `go.parts` at the `=` and saying each side with `sayParts`. `WORDS.promptTilt` (`words.ts:66`) stays for level 0 (`shortLine`, `:38`) and becomes "Is it the same? Which way does it tip?". `modelLine` (`:44-49`) is unchanged (it is after the answer).
9. `WORDS.sameQ = 'Is it the same?'` is written above the chip on tf goes (a small caption, large type). New clip lines come from `allVoiceLines` (`voiceLines.ts:83-100`, it loops every go via `everyGo`).

**D. Name the stone-count slip.**
10. New pure function in `shared/parrot/round.ts`: `slipOfPick(go: Go, n: number): ParrotKind | null`:
    - `null` when `n === go.answer`;
    - the go's own wrong card kind when `n` is one of `go.wrongs`;
    - else for a stone count: the same totals the wrongs use (`round.ts:205-240`): for a `miss` go `total = lg sum`, `copy = rg[0]`, `all = total + rg[0]`; for a `swap` go `dbl = 2 * answer` as well; each match gives that kind;
    - else `|n - answer| === 1` gives `'off1'`;
    - else `n > answer` gives `'more'` and `n < answer` gives `'less'`.
    Add `'more' | 'less'` to `ParrotKind` (`:20`).
11. Use it at `Goes.tsx:265` in place of `?? 'near'` and in `shared/parrot/play.ts:33` in place of `?? 'near'`, so the teacher data agrees with what the child saw. The teacher type `src/data/parrot.ts:83` lists only `'copy' | 'total' | 'all' | null`; keep that mapping and map `'more'`, `'less'`, `'off1'` and the rest to `null` there (check where `slipsOf` is turned into it).
12. New lines in `words.ts` `why(kind)` (`:41-52`): `more: 'That is too many stones. This side is too heavy now.'` and `less: 'That is not enough stones yet. This side is still lighter.'`. Add both to the kind list at `voiceLines.ts:93`. The default `near` line stays for the card goes.
13. `teacher.ts` (`PARROT_ABOUT`, `:29`): the sentence on the slip each student makes most is unchanged (copying, total, all). Add nothing.

**E. Clips.** `WRITE_VOICE_LINES=1 npx vitest run src/games/parrot/voiceLines.test.ts`, then `~/kokoro/.venv/bin/python -I scripts/voice-clips.py parrot`. Commit new clips and `lines.json`.

**F. Test (inside the existing "mistakes that teach" test, `shared/parrot/parrot.test.ts:86`, no new `it`; S10 needs the 8th):**
14. The replay test at `shared/parrot/parrot.test.ts:53` asserts `slipsOf(stones, [{ pick: 20 ... }])[0]` is `'near'`; with `slipOfPick` it becomes `'more'` (20 stones is far above the answer). Change that assertion.
15. For every go in the sweep and every `n` from 0 to `MAX_STONES * 2`: `slipOfPick(g, g.answer)` is null; a wrong card gives its own kind; a stone count that is not a card gives `'more'` or `'less'` by its side of the answer, `'total'`, `'copy'` or `'all'` when equal to those, or `'off1'`.

## 4. Files affected

- `src/games/parrot/art.tsx` (post text, props)
- `src/games/parrot/Goes.tsx` (`WhyPicture`, `CountingSaw`, `Equation`, level-4 tilt, `slipOfPick` call)
- `src/games/parrot/voiceLines.ts` (`eqLine`, kind list), `src/games/parrot/words.ts`, `src/games/parrot/parrot.css`
- `shared/parrot/round.ts` (`ParrotKind`, `slipOfPick`), `shared/parrot/play.ts` (`slipsOf`), `src/data/parrot.ts` (mapping, if needed)
- `shared/parrot/parrot.test.ts` (extend one test)
- `public/voice/parrot/` (clips, `lines.json`), `supabase/functions/parrot/index.ts` (rebuilt)

No kit file changes.

## 5. Database / migration needs

No migration. `shared/parrot` is bundled into the edge function: run `npm run build:functions -- parrot` and commit the rebuilt `supabase/functions/parrot/index.ts`. Deploying it is a live step: ask James first. Saved taps are unchanged; only the slip name derived from them can change for old rounds (more exact).

## 6. Test steps

Automated: the extended test in section 3 F (parrot stays at 7 `it` calls; the limit is 8).

By playing the preview:
- True-or-false at level 3: the question reads "Is it the same? Which way does it tip?" (no "is the same as"). The chip shows "?" and the see-saw is held flat with props.
- Tap the wrong card: the see-saw tips to the heavier side, totals under the pans, the post is blank. Second wrong: the count (as now) then the redo. A right tap shows the glyph and the post says "=" only if level.
- Stone goes at level 5: the post is "?" at rest, tips with each stone, "=" when level.
- Level 4: put stones on, Check wrong: the saw tips with the child's stones; props fall away. Change a stone: back to held.
- Stone count far too high (for example 11 on a 3 + ? side): "too many stones" line, never a number or the answer. Far too low: "not enough". Count equal to the total: the "whole amount" line.
- Card goes unchanged (numbered weights, flat, `Equation` with "=").
- Phone width (375px).
- Teacher page for Parrot still loads.

## 7. Size and impact

M: one art change, one picture change, one pure function, a few lines and clips, plus a function rebuild. High: the symbol now matches the model, and a wrong answer shows the weight difference, which is what "equal" means.

## 8. Session prompt (ready to paste)

```text
Create branch fix/parrot-seesaw-tilt from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S9-parrot-seesaw-tilt.md first.
Do not touch shared/maths, src/kit, src/maths, src/styles.css or src/components. shared/parrot is this game's own folder and is fine to change.

Steps:
1. src/games/parrot/art.tsx SeeSaw: post text from the tilt ("=" when level, "?" at rest, nothing when tipped). At rest draw two small props under the plank ends that fade out when it tips (CSS in parrot.css).
2. Goes.tsx WhyPicture: true-or-false uses leanWith(go, 0) with the numbered weights and the pan totals written under each pan. CountingSaw tf branch writes the totals too.
3. Goes.tsx level 4: after a wrong Check the saw tips with the child's stones (tilt={live || why ? tilt : 'rest'}); a stone change clears why.
4. Equation: for true-or-false replace "=" with a "?" chip (hidden text "is it the same as"); after solving show the TipGlyph. Add WORDS.sameQ = "Is it the same?" above it. Other kinds unchanged.
5. voiceLines.ts eqLine for tf: "{left}. {right}. Is it the same? Which way does it tip?". Update WORDS.promptTilt to "Is it the same? Which way does it tip?".
6. shared/parrot/round.ts: add slipOfPick(go, n) (null when right; the go's wrong kind; total/copy/all/dbl by the go's own sums; off1 when one away; else 'more' or 'less') and add 'more' | 'less' to ParrotKind. Use it at Goes.tsx (the ?? 'near' at about line 265) and shared/parrot/play.ts slipsOf. Keep the teacher mapping in src/data/parrot.ts to copy/total/all/null.
7. words.ts: why('more') and why('less'); add both to the kind list in voiceLines.ts. Rewrite lines.json (WRITE_VOICE_LINES=1 npx vitest run src/games/parrot/voiceLines.test.ts) and make clips with ~/kokoro/.venv/bin/python -I scripts/voice-clips.py parrot.
8. Extend the existing "mistakes that teach" test in shared/parrot/parrot.test.ts for slipOfPick over every go and every stone count 0..MAX_STONES*2. Do not add an it() (S10 needs the eighth).
9. npm run build:functions -- parrot (commit the rebuilt supabase/functions/parrot/index.ts). Run npx vitest run shared/parrot src/games/parrot, npm run typecheck, npm run build. Play the preview as in the plan (true-or-false, stone goes at levels 5 and 4, too many and too few stones, card goes, phone width, teacher page).
Stop and tell James before any live step (deploying the parrot function). Open a PR when done.
```
