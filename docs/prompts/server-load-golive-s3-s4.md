Server load: put S.3 live, then (only when James says) S.4. Read docs/SERVER-LOAD-PLAN.md first: the "Go-live rehearsal (19 Oct 2026)", "Stage S.3 results" and "Stage S.4 results" sections. Do part A, stop for James, then part B only if he says go.

Where things are (written 19 Oct 2026, evening):
- **S.1 and S.2 are LIVE.** James pasted `20261019000700_my_home_page.sql` into the Supabase SQL Editor (checked live: identical to the file, runs as the pupil, signed-in users only). The merge of `server-load` into `main` (commit e7c2e4e) was pushed to GitHub; the "Test and publish" action passed and the site is published (https://bleedingrobot.github.io/school-games-hub/).
- **S.3** is built and tested on branch `server-load-s3` (worktree ~/projects/school-games-hub-server-load-s3): calmer checks inside games with classmates. Screen only: no migration, no server functions. It contains S.1 and S.2.
- **S.4** is built and tested on branch `server-load-s4` (worktree ~/projects/school-games-hub-server-load-s4), which starts from S.3: the lobby asks once per refresh. It needs its migration `supabase/migrations/20261019000800_lobby.sql` applied live BEFORE its merge.
- Both branches merged cleanly into GitHub's `main` on 19 Oct evening. Check again: `git fetch origin` and `git merge-tree --write-tree origin/main origin/server-load-s3`.

How to merge and push (learned on 19 Oct):
- **Don't touch the main checkout** (~/projects/school-games-hub): other sessions keep unsaved work there. Its local `main` is behind GitHub's (it is an ancestor of e7c2e4e) and that's fine; don't move it unless James asks. Never use bare `git stash`, careful with `pkill -f`.
- Build the merge without a working folder: `tree=$(git merge-tree --write-tree origin/main origin/<branch>)`, then `git commit-tree $tree -p origin/main -p origin/<branch> -m "..."`, check `git merge-base --is-ancestor origin/main <commit>`, then `git push origin <commit>:refs/heads/main`. Never a bare `git push`, never force.
- Pushing `main` publishes the site, so Claude Code's safety check refuses it in auto mode. James switches to manual mode and approves the push. Don't look for another way round the check. The same goes for anything that changes the live database: James pastes migrations into the SQL Editor himself.
- After pushing, watch the action with `gh run list --branch main --limit 2` and `gh run watch <id> --exit-status`. Green: the site is out. Red: nothing was published; tell James what failed.
- Read-only checks on the live database work with `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file.sql>`. Timing queries as a pupil was refused by the safety check: don't try it.

## Part A: S.3 live

1. Before anything, read the live request records (read only, `extensions.pg_stat_statements`) for the home page's jobs and `my_home_page`, and tell James in plain words whether the home page is now asking once (calls to `my_home_page` going up; `my_class`, `my_moves_left`, `my_maths_focus` and so on no longer called from the home page). If something looks wrong, stop and tell him before going on.
2. Tell James in plain words what S.3 changes (from "Stage S.3 results": when live updates break, checks wait 4, 8, 16, then 30 seconds instead of every 4; up to 30 seconds for an opponent's move to show then; no checks in hidden tabs) and ask him to say go.
3. On go: merge `server-load-s3` into GitHub's `main` as above, James approves the push, watch the action.
4. Check the published site has the new code (look in the published JS files for something only S.3 has, e.g. from `src/multiplayer/useGameChecks.ts`).
5. Tell James what to check: a game with a classmate (chess, checkers, space, 101 or Power Clash) works as before, moves show straight away. How to undo: revert the merge on `main` and push (James approves), or GitHub's Revert button.
6. Add a short "S.1 to S.3 went live (date)" note to the plan (what was applied and merged, when, the merge commits, what was checked), commit it to `server-load-s4` and push that branch only. Update the memory note. **Stop for James.**

## Part B: S.4 live (only when James says go, in words, in this session)

1. Tell James what S.4 changes and the one difference in how it fails (from "Stage S.4 results"), and that its timing was only measured on the local copy.
2. James pastes the whole of `20261019000800_lobby.sql` into the SQL Editor (from github.com/bleedingrobot/school-games-hub/blob/server-load-s4/supabase/migrations/20261019000800_lobby.sql, then Raw) and presses Run. He should see "Success. No rows returned". He says "done".
3. Check it read only: `lobby` exists, returns json, is plpgsql and `security invoker`, signed-in users can call it and `anon` can't, and its text is exactly the file's (compare the text itself, not an md5 from the shell). If anything differs, stop.
4. Merge `server-load-s4` into GitHub's `main` as above (it contains S.3, so if part A hasn't happened, it takes S.3 live too: tell James first). James approves the push; watch the action; check the published files ask for `lobby`.
5. Tell James what to check (the lobby lists open games and his own games as before; starting and joining work) and how to undo (revert the merge; the job can stay).
6. Note it in the plan, commit to `server-load-s4`, push that branch only, update the memory note. After S.1 to S.3 (or S.4) are live, offer to copy section 1's numbers and the new ones into the plan and then clear the request counts (James's answer 5): ask first, clearing needs his OK.

Don't start S.5 or S.6.
