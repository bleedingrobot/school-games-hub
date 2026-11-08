# S3: Swamp Hen's Reed Rows: always draw the first row and first column

**Game:** Swamp Hen's Reed Rows
**What's wrong:** Under the mat, and at help level 2, the garden is a bare rectangle with two numbers. The first row and first column of reeds are not drawn, so the child cannot see "rows times shoots in a row".
**What done looks like:** Every garden at help level 2 and above, and under the mat, shows at least the first row and the first column of reeds. Only the inside is faded or covered.
**Size:** S
**Impact on learning:** High
**Waits for:** nothing

## 1. The problem

- Help level to picture: `viewFor` gives `['plain','peek','edges','bars','rows','count'][level]` (`shared/swamphen/round.ts:293`). So level 2 is `edges`, level 3 is `bars`.
- `Garden` draws shoots only when `showShoots = view === 'count' || view === 'rows'` (`src/games/swamphen/art.tsx:144,164`). At `bars` (level 3) it draws coloured bands and at `edges` (level 2) only the outline and the two edge numbers (`art.tsx:150,163,196-201`). No shoot at all.
- The mat covers every row but the first and the whole width: `covered = mat && r > 0` (`art.tsx:160`) hides shoots in rows 1 and below, and the mat rectangle starts at `PAD + CELL` and is `cols * CELL` wide (`art.tsx:183-194`), so the first column below row 0 is covered too. At level 3 or 2 there are no shoots in row 0 either, so under the mat the child sees a brown bar and a woven mat.
- The evaluator played step 3 at level 2: "a mat covers all rows, the first row is not shown" and "a plain brown rectangle with 3 and 5" (`docs/reviews/maths-review-2/games/swamphen.md`, Maths fidelity and problem 2). The plan says the first row and column always show (`docs/SWAMPHEN-PLAN.md`).
- `plain` and `peek` (levels 0 and 1) draw a dim empty box on purpose (`art.tsx:153`): the end of the help ladder is the sum alone.

## 2. The rule behind it

Rule 3 (concrete, then picture, then number): the array model is the maths picture, and help should fade the inside, not remove the model. Rule 1: a child must be able to see "rows by shoots in a row" to do the idea. Rule 5: the last steps (levels 0 and 1) are the numbers-only end of the fade, so they stay as they are.

## 3. The change

All in `Garden` (`art.tsx:140-204`). No shared or server code.

1. Add a small pure helper in `art.tsx`, exported for the test:
   `cellMode(view, r, c, mat): 'full' | 'faint' | 'covered' | 'none'`
   - `view` `count` or `rows`: `'full'`, except `'covered'` when `mat` and `r > 0` and `c > 0`.
   - `view` `bars` or `edges`: `'full'` when `r === 0 || c === 0` (the first row and first column), else `'faint'` (inside cells), or `'covered'` when `mat` and `r > 0` and `c > 0`.
   - `view` `plain` or `peek` (levels 0 and 1): `'none'`. Unchanged on purpose. (Level 1's Peek button opens the level 3 picture, `Goes.tsx:78`, so Peek shows the first row and column too.)
2. Draw by `cellMode`: `full` is a reed as now. `faint` is a reed at 0.22 opacity, or a small dashed ring if the painted reed is missing. `covered` is not drawn (the mat is on top). `none` draws nothing.
3. Shrink the mat to the inside only: `x = x0 + CELL`, `y = PAD + CELL`, `width = (cols - 1) * CELL`, `height = (drawn - 1) * CELL` (`art.tsx:183-194`). Skip the mat when `cols < 2` or `drawn < 2`. The edge numbers and the outline stay.
4. At view `count`, the running totals beside rows (`art.tsx:177-179`) stay hidden under the mat (use `mat && r > 0` for the row, since the cells are no longer all covered).
5. At `bars` and `edges` the first row and column reeds sit on top of the band, which is kept as now (`art.tsx:163`). Keep the cut line, the `short` faded tenth row and `planted` (rows not yet planted at 0.15) as they are. A `short` garden's extra row is drawn with the same rule.
6. The small which-garden cards use view `rows` (`Goes.tsx:249`), so they do not change.
7. The reed art files stay: `reeds/green`, `reeds/amber` (`art.tsx:147-148`). The faint reeds use the same image at lower opacity.
8. No voice or word change.

## 4. Files affected

- `src/games/swamphen/art.tsx` (the `Garden`, a new exported `cellMode`).
- `src/games/swamphen/swamphen.css` only if a class is needed (the faint style can be an attribute).
- A small test (see section 6).
- S4 also edits `art.tsx` (the lanes). Ship S3 first (it is the smaller one) or expect small conflicts.

## 5. Database / migration needs

None. Browser only. No function rebuild, no live step beyond the normal deploy.

## 6. Test steps

Swamp Hen has 3 tests, so there is room. Add 1 test (`src/games/swamphen/art.test.ts`): `cellMode` for each view. `count` and `rows` full (and covered inside the mat), `bars` and `edges` full on row 0 and column 0 and faint inside, covered inside under the mat, `plain` and `peek` none.
Play the preview (`npm run swamphen:preview`): step 3 (Under the mat) at levels 5, 3, 2: the first row and first column of reeds show at every level, the mat covers only the inside, the edge numbers show. Step 1 (Plant) at level 2: a first row and column of reeds with a faint inside. Level 0 and 1: still the sum only; Peek opens level 3 and now shows the first row and column. Check a 2 x 2 and a 10 x 5 garden, a `short` garden (one row short) and a `cut` garden at 375 x 812.

## 7. Size and impact

S: one drawing function and one helper. High: the picture shows rows by columns at the levels where the child most needs to see the structure.

## 8. Session prompt (ready to paste)

```text
You are fixing Swamp Hen's Reed Rows in the School Games Hub repo.
Create branch fix/swamphen-array-edges from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 1, 3 and 5) and docs/plans/maths-review-2/S3-swamphen-array-edges.md first, then docs/reviews/maths-review-2/games/swamphen.md.

Goal: the garden always shows at least its first row and first column of reeds at help levels 2 and up and under the mat; only the inside fades or is covered.
Steps (details in the plan, section 3):
1. In src/games/swamphen/art.tsx add and export cellMode(view, r, c, mat) returning full, faint, covered or none: count and rows full (covered inside a mat); bars and edges full on row 0 and column 0, faint inside, covered inside under a mat; plain and peek none (levels 0 and 1 stay sum-only).
2. Use it in Garden: draw faint inside cells at about 22% opacity; shrink the mat to the inside only (x0 + CELL, PAD + CELL, (cols - 1) * CELL wide, (drawn - 1) * CELL high; skip when cols < 2 or drawn < 2); keep running totals hidden under the mat; keep cut, short, planted and the which-garden small cards as they are.
3. Add src/games/swamphen/art.test.ts with one test for cellMode. Swamp Hen has room (3 tests now, limit 8).
4. Play the preview (npm run swamphen:preview): step 3 at levels 5, 3, 2, step 1 at level 2, levels 0 and 1, a 2 x 2 and a 10 x 5 garden, short and cut gardens, at 375 px wide. npm test, npx tsc --noEmit, lint.
Do not touch shared/maths, src/maths, src/styles.css, src/components, kit files or shared/swamphen. No database change.
Stop and tell James before any live step. Open a PR when done.
```
