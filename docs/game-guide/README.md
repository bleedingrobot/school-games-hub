# Building a game for School Games Hub

For a Claude thread building one game, from an empty branch to live, while other threads build other games. Read this file first, then only the parts the checklist sends you to.

**Who you work for:** James, a Year 4–6 teacher at Douglas Park School. Reply in short, plain words: no jargon, file paths or commit hashes unless he asks. Merging and going live are **pre-approved**: work right through to live without stopping between stages. Ask him on a question card only before deleting anything, a destructive database change, or removing pupils' data ([8-going-live.md](8-going-live.md)). A choice that changes his goal goes on a question card with your recommendation; keep building on the recommendation meanwhile.

**Keep this guide true.** If what you build shows a rule here is wrong, missing or out of date, fix it in the same PR, in the file for that topic. Say each rule once; link to it from elsewhere.

## Never

- Commit to `main`, or `git push` where the upstream might be `origin/main`.
- Change from a game branch: `shared/maths/`, `src/maths/`, `src/styles.css`, `src/components/`, `src/auth/`, `supabase/functions/_shared/`, the game kit (`shared/kit/`, `src/kit/`), other games' files, or any migration already on `main` ([3-files-and-clashes.md](3-files-and-clashes.md)).
- Re-create a shared database function, or write to a shared table except through its function.
- Let the browser decide anything that counts (an answer, a time, a score, a reward): the server marks or replays it ([5-server-and-saving.md](5-server-and-saving.md)).
- Make your own maths questions for an older-pupil game, or work out a pupil's focus yourself ([4-maths.md](4-maths.md)).
- `supabase db reset`, or save test data in the live project.
- Show a pupil's maths results or year level to classmates, or rank pupils by maths.
- Wait for art, voice clips or James's approval of screenshots.

## Two routes

| | Junior game (ages 5 to 8, Foundational skills) | Older-pupil game (Years 3 to 6) |
|---|---|---|
| Copy | Weka's Stepping Stones (`weka`), Lizard's Bundles (`lizard`) | Toon Flap (`toonflap`), Marble Rush (`marble`) |
| Maths | own rounds from early-facts records; server replays the taps; `JUNIOR_QUICK_MS` | the shared focus: `makeFocusPack`, made and marked on the server (way A) |
| Pace | steps, move up on good goes or Secure facts | levels or runs; maybe a daily allowance or one new level a day |
| Teacher | a Progress tab column with steps, stuck and nearly ready | an "Other games" column with one number |
| Card group | `'foundational'` | `'easy-maths'`, `'complex-maths'` or `'no-maths'` |
| Learning design | [LEARNING-DESIGN.md](../LEARNING-DESIGN.md) section 5 | LEARNING-DESIGN.md if there is maths |

## Start-to-live checklist

Do these in order. Each line says what, then where. Tags: **J** junior only, **O** older only.

1. **Branch.** Your `claude/…` branch, or a worktree on the Mac ([3-files-and-clashes.md](3-files-and-clashes.md)).
2. **Board.** Mark the prompt you started from `used` on the Games Hub Prompts board (memory note `work-board`).
3. **Read** the route's example game: its plan (`docs/<ID>-PLAN.md`), `shared/<id>/`, `supabase/functions/<id>/`.
4. **Migration number.** `git fetch && node scripts/migration-numbers.mjs`; write it in the plan.
5. **Plan.** `docs/<ID>-PLAN.md` from [templates/plan.md](templates/plan.md), answering [1-design.md](1-design.md) and [2-steps-and-progress.md](2-steps-and-progress.md), with stages. Choices for James on question cards.
6. **Rules.** Pure functions and one config file in `shared/<id>/`.
7. **Server.** `supabase/functions/<id>/` (`handler.ts`, `entry.ts`); marks or replays everything that counts; checks the teacher switch; `npm run build:functions -- <id>` ([5-server-and-saving.md](5-server-and-saving.md)).
8. **Maths.** **O:** way A from the focus ([4-maths.md](4-maths.md)). **J:** rounds from early-facts records, `recordMathsAnswers(…, JUNIOR_QUICK_MS)`.
9. **Database.** `supabase/migrations/<number>_<id>.sql` from [templates/migration.sql](templates/migration.sql): tables with RLS, `hub_games`, achievements, `record_<id>` functions, revoke/grant. Save everything in "What to save per go".
10. **Screens.** `src/games/<id>/` with kit parts first, your own prefixed CSS, How to play from the config.
11. **Guide for new players.** Guided first go, next-step line, first-time tips ([1-design.md](1-design.md) question 7).
12. **Voice.** `voiceLines.ts`, the voice-lines test, Bella clips ([6-art-voice-cards.md](6-art-voice-cards.md)).
13. **Art.** Drawn stand-ins; `docs/<ID>-ART-PLAN.md` and `docs/<id>-art/config.json` with the home card ([6-art-voice-cards.md](6-art-voice-cards.md)).
14. **Teacher.** The `teacher` part, settings through `teacher_set_<id>()`, `hardest`, `alerts`. **J:** the Foundational entry ([templates/foundational-entry.ts](templates/foundational-entry.ts)), `teacher_foundational_class` block, step-history trigger, `GOOD_TO_PASS` or `STEP_KEYS`. **O:** `progressColumns` and a `teacher_progress_other_games` block ([2-steps-and-progress.md](2-steps-and-progress.md)).
15. **Turns.** Limited turns or levels a day? Add the game to `UNLIMITED_GAMES` and `teacher_set_unlimited_today()` ([1-design.md](1-design.md) question 3).
16. **Tests.** Within [TESTING.md](../TESTING.md) "How many", plus `supabase/tests/database/<id>.test.sql` on a scratch copy ([7-testing.md](7-testing.md)).
17. **Screens checked** at phone, iPad and laptop sizes ([7-testing.md](7-testing.md)).
18. **Shared one-line edits** after merging `main`: registry, `FUNCTIONS`, `package.json` scripts, `shared/README.md`, `docs/PRIVACY-SUMMARY.md` ([3-files-and-clashes.md](3-files-and-clashes.md)).
19. **Ready check.** Every box in [templates/golive-pr.md](templates/golive-pr.md) ticked.
20. **PR and merge.** `typecheck`, `test:changed`, `build`; open the PR, merge when green; migrations and the function go live by themselves ([8-going-live.md](8-going-live.md)).
21. **After the merge.** Check the publish run, tables, the 401 from the function, refusals from outside; try it as a teacher.
22. **Switch on.** Code switch PR (`ON = true`, id in `src/games/registry.test.ts`), then the teacher switch.
23. **Write it down.** Plan's Status line (what is live, which PR), project memory, and the next part's copy-ready prompt on the Prompts board. Do this after **every** merge, not only the last.

## The parts

| File | What's in it |
|---|---|
| [1-design.md](1-design.md) | the pieces of a game; the design questions for the plan; learning design in short |
| [2-steps-and-progress.md](2-steps-and-progress.md) | step words; showing on the teacher's Progress tab |
| [3-files-and-clashes.md](3-files-and-clashes.md) | branches; your files; shared files and database rules; the game definition; reuse; the hub's look |
| [4-maths.md](4-maths.md) | the maths focus; way A and B; worked example |
| [5-server-and-saving.md](5-server-and-saving.md) | sign-in, school check, saving, cost, points and achievements, what to save per go, replay |
| [6-art-voice-cards.md](6-art-voice-cards.md) | painted art, the home card, Bella's voice |
| [7-testing.md](7-testing.md) | tests, previews, screen checks |
| [8-going-live.md](8-going-live.md) | the live pipeline, after-merge checks, switching on, rollback |
| [templates/](templates/) | plan, migration, Foundational entry, art config, go-live PR body |

Other rules this guide links to: [LEARNING-DESIGN.md](../LEARNING-DESIGN.md) (how games teach), [TESTING.md](../TESTING.md) (how many tests), [src/kit/README.md](../../src/kit/README.md) (the game kit).
