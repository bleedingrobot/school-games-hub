# S8: Pigeon: less help at the top, and four cards on "closer" goes

**Game:** Pigeon's Number Line
**What's wrong:** At the top help level every ten is written on the line, so placing a number is copying a numeral. "Which ten is it closer to?" has only two cards, so a guess is right half the time.
**What done looks like:** At the top help level the line writes only 0, the middle and 100 (the tens are drawn as unlabelled marks to count). "Closer" goes show four cards, and the two wrong "far" cards cannot be picked by looking at the last digit.
**Size:** S to M
**Impact on learning:** High
**Waits for:** S7 (same file, `src/games/pigeon/Goes.tsx`, and the look-together lines)

## 1. The problem

- **Top help is copying.** `marksFor` (`shared/pigeon/round.ts:343-355`): level 5 returns `named: every(unit)` (every ten named, ticks for every one, `:350`) and level 4 returns every ten named. A new child starts at level 5 (`docs/reviews/maths-review-2/games/pigeon.md` problem 1: "Placing with every number marked is copying a numeral, so a child may not learn size... Step 1 and level 5 always mark every ten."). Wrong taps also bring the line up to level 5 (`pictureFor`, `:362-370`: "the second brings every number marked").
- **Two cards, a coin toss.** The near go has `choices: posts` and one wrong card (`round.ts:304-309`). The test asserts it (`shared/pigeon/pigeon.test.ts:43-44`: `expect(go.choices).toHaveLength(2)`). Evaluator: "A guesser is right half the time, so a child can pass a step (8 of 10) with luck often enough" (problem 2).
- **The posts are drawn for free.** `lineFor` adds `go.posts` as labelled landmarks from the start (`Goes.tsx:55-56`), so on a near go the child never has to find the tens.
- **The three-wrong cut skips near goes.** `pictureFor` leaves near goes alone: `go.kind !== 'place' && go.kind !== 'near'` (`round.ts:378`). With four cards the cut can apply like the other card goes.

## 2. The rule behind it

- Rule 3 (concrete, then picture, then number): fewer written numbers means the child reads the picture, not the numerals.
- Rule 5 (help follows the child): the top level is full help for a new child and fades; it must still leave the child something to do.
- Rule 6 (progression): a step that can be passed by luck does not show steady success.
- Rule 1 (the maths is the move): choosing a post is estimating which ten is nearest. The wrong cards must be wrong for a reason, not for a last digit.

## 3. The change

`shared/pigeon` changes, so the edge function must be rebuilt (see section 5).

**A. Top help prints only the ends and the middle.**
1. `marksFor` (`shared/pigeon/round.ts:343`) returns a new `big` list: `{ named, ticks, big }`. `big` is marks that are drawn big but not written.
   - Level 5: `named = [lo, mid, hi]`, `big = every(unit)`, `ticks = unit >= 10 ? every(unit/10) : []` (as now).
   - Level 4: `named = [lo, mid, hi]`, `big = every(unit)`, `ticks = []`.
   - Levels 3, 2, 1, 0: as today, with `big = []`.
   - `unit` stays as now (10 on a 0 to 100 line, 100 on the 1000 line, 1 on a narrow lens, `width/10` between). On a narrow lens (10 wide or less) the marks are every one, so the middle and ends are named and each whole number is a mark to count.
   - Update the doc comment above it and above `pictureFor` ("the second brings every number marked" becomes "every ten marked, the middle and the ends named").
2. `lineFor` (`Goes.tsx:51`): add `big` as unlabelled landmarks: `mainMarks.big.map((value) => ({ value, label: null }))`, placed **before** the named landmarks so a named value wins in `dedupe` (`:70`, last wins). Do the same for the lens (`lensMarks.big`). The kit already draws `label: null` as a big mark with no text (`src/kit/NumberLine.tsx:142`, `Landmark.label: null`). No kit change.
3. The guided first go (`GUIDED_KEY = 'place100:t50'`, level 5) is unchanged in play: 50 is the middle and stays named.

**B. Near goes: four cards.**
4. In `showGo` (`round.ts:304-309`) make the near go four cards: four consecutive posts at the line's size (`size` 10, or 100 on the 1000 line). The two true posts (`low` and `low + size`) sit in the window at a random place:
   - `start = low - size * j` where `j` is seeded random from 0, 1 or 2, then clamped so `start >= 0` and `start + 3 * size <= max`. (Use `random()` from the go's seeded stream, as `wrongCards` does.)
   - `choices = [start, start + size, start + 2*size, start + 3*size]` (already ascending).
   - `answer` is as now (`n - low >= size / 2 ? posts[1] : posts[0]`).
   - `wrongs` are tagged: the other true post is `'near'`; the two outside posts are `'ten'` (a whole step away).
   - Why this tell works: neighbouring posts alternate odd and even tens, so exactly one other card shares the answer's tell (the same check as `atMostShareTell` at `shared/kit/mistakes.ts:39`, used for read and tens goes with `MAX_SHARE_TELL` at `config.ts`). No retry loop is needed. The answer's slot in the row is spread because `j` is random.
5. The question no longer names the posts (naming them makes the outer cards silly): `askLine` (`src/games/pigeon/voiceLines.ts:17-22`) for a near go becomes `Which ten is {n} nearest to?` and, on the 1000 line, `Which hundred is {n} nearest to?`. Add `max` to the `Said` type (`:14`) so it can choose. `allVoiceLines` (`:63-73`) already loops over every key, so the new lines are covered.
6. `lookLine` for near (`:52-55`): `Count how far {n} is from the ten below and the ten above. The nearer one wins.` ("hundred" on the 1000 line). This replaces "Count how far it is from each post." The numbers are in the line, so it is one clip per key (the loop above already makes one per key).
7. A near-go wrong card on an outer post: the slip word is `'ten'` (`SLIP_LINES.ten`, "That is a whole ten away. Look again.", `voiceLines.ts:27`). On the 1000 line it should say hundred. Add `NEAR_FAR_LINES = { ten: 'That one is too far away. Look at the nearest two.' }` used when `go.kind === 'near'`; the other true post keeps `near` ("Look at which post is nearer.", `:30`).
8. `Goes.tsx:55-56`: do not draw `go.posts` as landmarks while the child is choosing. Draw them (labelled) once `gs.phase` is `look` or `redo`, and when the go is solved. (S7's near arcs end at the posts, so they must be there then.) Remove `posts` from the landmark list otherwise.
9. `pictureFor` (`round.ts:378`): remove `&& go.kind !== 'near'` so the three-wrong cut applies to near goes too: only the answer and one untried wrong card stay (the same rule the read and tens goes use).
10. Update the file header comment at `Goes.tsx:7` ("Two cards" becomes "Four cards") and `round.ts:241`.

**C. Existing tests change (no new `it`).**
11. `shared/pigeon/pigeon.test.ts:43-44`: near goes have 4 choices, ascending, containing the answer and both posts, and at most two share parity of `card / size` with the answer. Move the `go.posts` assertion (`:45`) as is.
12. `pigeon.test.ts:73-75`: `marksFor(5, 0, 100).named` equals `[0, 50, 100]` and its `big` has length 11; `marksFor(0, 0, 100).named` equals `[0, 100]`; `marksFor(4, 0, 1000).named` equals `[0, 500, 1000]` and `big` has length 11.
13. Inside the existing "mistakes teach" or rounds test (`:36-52` loop over every key, level and seed), add one position check for near goes: over all near goes in the sweep the answer's slot is each of 0, 1, 2 and 3 at least 15% of the time and no slot more than 40%.

## 4. Files affected

- `shared/pigeon/round.ts` (`marksFor`, near go in `showGo`, `pictureFor`, comments)
- `shared/pigeon/pigeon.test.ts` (updated assertions, one position check, no new `it`)
- `src/games/pigeon/Goes.tsx` (`lineFor`, posts only at the reason, `NEAR_FAR_LINES`)
- `src/games/pigeon/voiceLines.ts` (`askLine`, `lookLine`, `NEAR_FAR_LINES`, `allVoiceLines`)
- `src/games/pigeon/words.ts` (only if a word moves)
- `public/voice/pigeon/` (new and changed clips, `lines.json`)
- `supabase/functions/pigeon/index.ts` (rebuilt; it bundles `shared/pigeon`)

No kit file changes.

## 5. Database / migration needs

No migration. The edge function bundles `shared/pigeon`, so after the change run `npm run build:functions -- pigeon` and commit the rebuilt `supabase/functions/pigeon/index.ts`. Deploying the function is a live step: ask James first. A round already in progress is replayed with the new `showGo`; answers and `placeRight` do not change, so saved taps still mark the same, only the near cards shown differ.

## 6. Test steps

Automated: the three updates in section 3 C (the pigeon file stays at 3 `it` calls; the limit is 8).

By playing the preview (use the preview step and help buttons):
- Step 1, level 5: the line names 0, 50 and 100 and shows ten marks with little marks for ones. The number must be found by counting. Wrong tap twice: same line plus the two marks either side named.
- Step 7 (1000 line): 0, 500, 1000 named, marks every hundred.
- Zoom lens (step 6): the lens names its ends and middle.
- Step 5, "Which ten is 64 nearest to?": four cards (for example 50, 60, 70, 80). Posts are not on the line yet. Tap a wrong far card: "That one is too far away." Two wrong taps: the posts appear, with S7's arcs when S7 is merged.
- A hundred line: "Which hundred is 640 nearest to?" with four hundreds.
- At the line ends (n = 4 and n = 96): four cards still, window clamped at 0 and 100.
- Third wrong: only the answer and one untried card left.
- Phone width (375px).

## 7. Size and impact

S to M: one pure function, one near-go change with a small window rule, four voice lines and a rebuild. High: top help stops being "match the numeral" and a clean pass of the "closer" step means something.

## 8. Session prompt (ready to paste)

```text
Create branch fix/pigeon-hints-cards from origin/main (own worktree). S7 (fix/pigeon-line-reason) must be merged first; if it is not, stop and tell James.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S8-pigeon-hints-cards.md first.
Do not touch shared/maths, src/kit, src/maths, src/styles.css or src/components. shared/pigeon is this game's own folder and is fine to change.

Steps:
1. shared/pigeon/round.ts marksFor: return { named, ticks, big }. Levels 5 and 4 name only [lo, mid, hi] and put every unit in big; level 5 keeps its ticks; levels 3 to 0 unchanged with big = []. Fix the doc comments.
2. src/games/pigeon/Goes.tsx lineFor: draw big as landmarks with label: null (before the named ones so named wins in dedupe), on the lens too. Draw go.posts only in the look and redo phases and once solved.
3. showGo near go: four consecutive posts at the line size, start = low - size*j with j seeded in 0..2, clamped to [0, max - 3*size]. Wrongs: the other true post is 'near', the two outside posts are 'ten'. pictureFor: remove the near exclusion at the three-wrong cut.
4. voiceLines.ts: askLine near = "Which ten is N nearest to?" ("hundred" on the 1000 line; add max to Said). New lookLine for near. NEAR_FAR_LINES for outside posts. Update allVoiceLines. Rewrite lines.json (WRITE_VOICE_LINES=1 npx vitest run src/games/pigeon/voiceLines.test.ts) and make clips with ~/kokoro/.venv/bin/python -I scripts/voice-clips.py pigeon.
5. Update shared/pigeon/pigeon.test.ts: near choices 4 (ascending, both posts, at most two share a parity tell), marksFor assertions (named [0,50,100], big 11), and an answer-slot spread check for near goes inside an existing test. Do not add more than 8 tests in total.
6. npm run build:functions -- pigeon (commit the rebuilt supabase/functions/pigeon/index.ts). Run npx vitest run shared/pigeon src/games/pigeon, npm run typecheck, npm run build. Play the preview as in the plan (levels 5 and 4, the 1000 line, a lens, near goes at the ends and middle, third wrong, phone width).
Stop and tell James before any live step (deploying the pigeon function). Open a PR when done.
```
