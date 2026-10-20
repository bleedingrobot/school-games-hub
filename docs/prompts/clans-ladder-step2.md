# Prompt: Clan Quest Battle Cry from the ladder, go-live step 2 (the database change)

Paste everything below the line into a new chat.

---
You are continuing the **Clan Quest "Battle Cry from the ladder"** go-live in James's School Games Hub (games for his Year 4-6 class). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things stand (20 Oct 2026)
- The work is on branch `clans-ladder`, in worktree `~/projects/school-games-hub-clans-ladder`. The merge commit is 66a8619, which merges `origin/main` at 079b1f6. Nothing is pushed: the branch has no upstream, so never run a bare `git push`. Background: `docs/CLANS-PLAN.md` "Battle Cry from the ladder", and the full steps in `docs/prompts/clans-ladder-golive.md`.
- **Step 1 (pre-flight) is done and all green.** 3,943 tests pass, the site builds, and the rebuilt `clans` and `marble` functions are unchanged. On a scratch copy the database tests pass: `clans_ladder` 13/13, plus `clans`, `clans_rewards`, `clans_village` and `clans_schools`. In `clans_fights`, only the two "scheduled for midnight" checks fail, and they always fail on a scratch copy. The live `load_clan` and `save_clan` match `20261018002600` exactly. The live `clan_fights` has no `questions` or `marks` columns yet. The live `clans` function equals `origin/main`'s build. The migration number `20261020000300` is free (next free is 000400).
- **Nothing is live yet.**

## This session: step 2 only (apply the migration)
1. **Quick re-check (nothing live):** `git fetch` in the worktree, then run `node scripts/migration-numbers.mjs`. Check that nothing new on `origin/main` touches `load_clan`, `save_clan` or `clan_fights` (`git diff 079b1f6 origin/main --stat -- supabase/migrations`). If something does, stop and tell James.
2. **Ask James, in plain words, before applying.** Say exactly this: it adds two empty fields to where open fights are kept, and the save and load steps learn to keep them. Children notice nothing. Fights in progress carry on. Undoing it is not needed: the fields stay empty until the new server part and website go live. **Only continue on his clear yes in this session.**
3. **Apply:** from the worktree,
   `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/20261020000300_clans_ladder.sql`
4. **Check it worked (read only):**
   - `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'clan_fights' and column_name in ('questions','marks');` gives both.
   - `pg_get_functiondef('public.save_clan'::regproc)` contains `questions = excluded.questions`, and `load_clan`'s contains `'questions', f.questions`.
   - `select count(*) from public.clan_fights;` works, and open fights are still there (compare with a count taken just before applying).
   - Look at the Supabase logs for the `clans` function for a few minutes (the Supabase `query_logs` tool, edge function logs) and check there are no new save errors (`clans: save_clan failed`).
5. **Record it:** add a line to `docs/CLANS-PLAN.md` under "Battle Cry from the ladder" ("Migration 20261020000300 applied live on <date and NZ time>; checks …"), and add the number to the `migration repair` note at the bottom of `docs/PLAN.md` if that note is there. Commit on `clans-ladder` (don't push). Update the memory note `clans-ladder.md` (and its line in `MEMORY.md`).
6. **Stop.** Tell James it's done, and that the next step is deploying the server part (step 3 of `docs/prompts/clans-ladder-golive.md`), which needs his separate yes. Also remind him of the suggested try-out after step 3: run the new page on this computer against the live server, and he plays one fight as his teacher account before the website goes live.

## Rules
- Only the migration in this session. No function deploy, no push, no merge.
- Never `supabase db reset`. Don't change anything else live.
