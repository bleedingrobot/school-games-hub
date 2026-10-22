> **Done (checked 21 Oct 2026):** kept as a record; don't run it again. Fix 1 is built on branches `monsters-marking` and `dragon-maths` (live when each game goes live). Fix 2 is on `main` (682ba9d), fixes 3 and 4 are on `main` (Gem Keep marking, two-minute answer cap), fix 5 was decided by James (see the guide, section 4), and fix 6 is on `main` (b8dcfba).

Maths engine fixes: pick up the review of 20 Oct 2026 and do fix 1, then stop for James. Do the later fixes only when he says so, one at a time.

Where things are (written 20 Oct 2026):
- A full review of the maths question engine (`shared/maths/`) was done on 20 Oct. The engine itself is sound: all 918 maths tests passed, and a check script found no key owned by two ladder skills, no generated question type left off the ladder, and no whole-number question with a non-whole answer (so multiple choice can't hang). The problems are in how some games' servers mark answers, plus the year-level start.
- Full findings with file and line references: /home/james/.claude/plans/games-hub-can-you-effervescent-kay.md. Read it first.
- James approved the fix order, then said "pause" before any code was changed. Nothing has been edited, committed or deployed.

Working rules:
- Reply to James in plain words: no jargon, no file paths.
- Each fix goes on its own branch and worktree. **Don't touch the main checkout** (~/projects/school-games-hub): other sessions keep unsaved work there. Never use a bare `git stash` or a bare `git push`.
- Nothing goes live (migration, function deploy, push to `main`) unless James says so in words.

## Fix 1: times-table answers marked right when wrong (do this now)

**The bug.** For a missing-factor question, the server accepts either factor:
- Maths Monsters: `shared/monsters/save/verify.ts`, about line 70.
- Dragon Maths: `shared/lord/proof.ts`, about line 80. This also applies to `divide`.

So on "? × 8 = 56" typing 8 counts as right, and on "56 ÷ 8 = ?" (Dragon Maths) typing 8 counts as right. The browser marks these wrong, so the student sees "wrong" while their record goes up. The cause is that the browser sends only `kind`, not which number was the blank.

**The fix.**
1. In each game's browser report, also send the question's `parts`:
   - Monsters: `src/games/monsters/BattleScreen.tsx`, the `answered.current = {...}` block, for times tables.
   - Dragon Maths: `src/games/lord/useAsk.tsx`, the `proof` object.
2. On the server, mark with `solveQuestion(parts)` from `shared/maths/skillPacks/timesTables.ts`, which already reads × and ÷ questions with a blank anywhere.
   - Accept the question only if the key it gives equals the claimed key and the shape matches the claimed kind.
   - Then compare `given` with the answer it works out.
   - Keep the existing level/pool checks.
3. Old browsers that send no parts:
   - Monsters is live (switched off): keep the old check only when `parts` is missing, and say so in a comment.
   - Dragon Maths isn't live: require parts.
4. Tests. Add tests for:
   - "? × 8 = 56, typed 8 → wrong"
   - "? × 8 = 56, typed 7 → right"
   - "56 ÷ 8 = ?, typed 8 → wrong" (Dragon Maths)
   - parts that don't match the key → refused

   Run `npx vitest run shared/maths shared/monsters shared/lord supabase/functions` plus the touched screens' tests. If a server function's entry files change, rebuild its `index.ts`. For Dragon Maths use `node scripts/build-lord.mjs`, never `npm run build:functions` on that branch (it rewrites the stale monster/index.ts). The handler tests fail if a built file is stale.

**Where to do it.**
- Monsters: a new branch `monsters-marking` from `origin/main`, in a new worktree ~/projects/school-games-hub-monsters-marking.
- Dragon Maths: its own branch `dragon-maths` in ~/projects/school-games-hub-dragon-maths. That branch has never been pushed, and its upstream is origin/main, so never a bare push. It is 63 commits behind origin/main; don't rebase it unless James asks.

**Then stop.** Tell James in plain words what was wrong, what changed, and that nothing is live. Monsters going live means deploying the `monster` function and merging; that waits for his word. Update the memory note `maths-engine-review.md`.

## Later fixes (each only when James says go)

2. **Year level sets the start.** This is the TODO in memory `maths-focus-plan-on-hold.md`.
   - `yearStartRank` in `shared/maths/place.ts` currently puts Year 4 at "Pairs that make 100" (skipping ×2 ×5 ×10) and Year 6 at ×11 ×12.
   - `syncPlace` then saves that as "furthest", and it never goes back.
   - The placement warm-up starts there too.
   - The fix also needs a live clean-up of furthest places that only ever came from the year start. Use the existing empty worktree ~/projects/school-games-hub-no-year-start.
3. **Gem Keep trusts the browser.** `shared/gem-keep/save.ts` saves `{key, correct, ms, at}` with no question. Its old `facts` path still accepts whole records with the box set by the browser.
   - Send `parts`/`key`/`params` with each answer and re-mark with `solveClaim` (`shared/maths/claim.ts`), as the space solo game does in `shared/space/save.ts`.
   - Retire the `facts` path.
4. **Answer times.**
   - Gem Keep accepts up to 1 hour per answer. Use one shared cap instead (Dragon Maths uses 2 minutes).
   - Also `shared/maths/syncPlace.ts` skips updates within 30 s for a student, so the furthest place can lag a lesson behind.
5. **For James to decide.** Monsters, Dragon Maths and Clan Quest answers don't count towards the ladder place or focus results: only gem-keep, space-game and save-bot-game call `syncPlace` and `countForFocuses`.
6. **Tidy-ups:**
   - The pack list is hard-coded in migrations `20261019000300` and `20261019000400`. Add a test that it matches `FOCUS_PACKS`.
   - The times-table curriculum tags are still `TODO-…`.
   - "Hundreds that make 1000" has no curriculum tag.
   - A skill whose tables are all switched off is labelled "upcoming" in `ladderProgress`.
   - Training keeps separate times-table records.
