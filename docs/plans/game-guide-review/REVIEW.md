# Review of the game development guide (11 Nov 2026)

Status: review and plan only. `docs/GAME_DEVELOPMENT_GUIDE.md` is unchanged. Checked against `main` at `4d24fb4` (after #399).

**Reader.** Only Claude reads the guide (James, 11 Nov 2026). So the test is: can a Claude session, often a cheaper model, build a new game from an empty branch to live by following it, without reading the whole repo and without being misled? Human-friendly prose, history and stories are cost, not value.

## Summary for James

- The guide is right on most of the hard rules (server marks, migration numbers, hooks not re-creating shared functions, the live deploy pipeline, section 1b).
- But it has **12 things that are wrong or out of date**, and some are rules Claude follows strictly: "James decides every live step" (he doesn't), "stop after each stage" (he doesn't want that), "at most 8 tests" (the newest junior games have 29 to 35), "copy `trader-art.py`" (there is now one shared art script), and "the kit doesn't exist yet" (it does).
- **About 9 lessons are missing** or only hinted at: Bella's voice everywhere, help that isn't too fast, placeholder art first, one-new-level-a-day, the cloud-thread way of working, and others.
- It is **10,500 words in one file**, with a date log at the top, history in section 10, and the same rule in up to four places. A model has to read all of it to find the one order of steps, and there is no single start-to-live checklist.
- The plan: fix the wrong rules first (small), then rebuild it as a short "rules and checklist" file plus reference sections, and update the stale "start a new game" prompt that still points at the old folder.

## 1. Is it true? (wrong, out of date or contradicted)

| # | Where | What the guide says | What is true | Evidence |
|---|---|---|---|---|
| T1 | §0 items 1, 7, 10; §8 intro | "He decides every live step", "Nothing live without James's words in this session", "Stop after each stage" | Merging and going live are pre-approved; work right through to live; ask only before deleting or destructive changes. §8 already says so, so the guide contradicts itself. | Project instructions; memory `going-live-approval` (28 Oct), 29 Oct note |
| T2 | §0 item 12, §7, §9 | A new game gets at most 8 tests | Penguin Pairs 35, Pipi 32, Weka 29, Lizard 11, Toon Flap 10 (`it(`/`test(` counts in its folders). Either the rule or the games are wrong; a model can't tell which to copy. | `grep` of `shared/<g> src/games/<g> supabase/functions/<g>` |
| T3 | §9 "Must be true" | "typecheck, `test:all`, build" | §7 says don't run `test:all` locally; the PR's Site checks run it. | §7 vs §9 |
| T4 | §9 "Must be true" | "Maths comes only from `makeFocusPack`" | Junior games (Weka, Pipi, Penguin Pairs, Tūī, Lizard) make their own rounds from early-facts records, as §4 itself says. A junior game can't pass this line. | §4 "Junior games" paragraph |
| T5 | §0 item 14, §2 "Reuse" | Kit parts are "planned … until they do, copy the best example" | `shared/kit/` (help, mistakes, slips, seen, replay, finishBand, dayArc, sister, teacherGrid) and `src/kit/` (TenFrame, NumberLine, DotPicture, HearAgain, PointingHand, WhatsNext, FirstTimeTip, useGuidedFirstGo, useKindDemo, DemoBar) exist. `src/kit/README.md` is the catalogue. | `ls shared/kit src/kit` |
| T6 | §2 "Painted art" | "There is no shared art pipeline … copy `scripts/trader-art.py`" | `scripts/game_art.py` + `docs/<game>-art/config.json` is the one art script since K6 (7 Nov); "do not write a new `<game>-art.py`". Weka and Lizard use it. Toon Flap (11 Nov) still wrote `toonflap-art.py`, because it followed the guide. | GAME-KIT-PLAN §8; `ls scripts docs/*-art` |
| T7 | §0 item 2, §6, §8 step 4 | Mac worktrees in `/Users/jriley/Games Hub`, `gh pr merge`, auto-mode note | Most work now runs in cloud project threads on a `claude/…` branch, with GitHub through the MCP tools (no `gh` except search). §6 mentions this in one line only. | This thread's setup |
| T8 | §8 steps 0 to 4 | Order: pre-flight, "goes live when PR merges", after-merge checks, check from outside, **then** "Merge to main" | The merge is step 4 but steps 1 to 3 already assume it. A model following the numbers will be confused. | §8 |
| T9 | §1 table, §0 last paragraph | "all 14 games before Star Trader" have cards; best examples Marble, Trader, Decree, Weka | Card count is stale. The newest finished examples (Toon Flap for older pupils, Lizard/Pipi/Penguin Pairs for junior) aren't named. Lists of games in prose drift every week. | §1, `gameCardArt.ts` |
| T10 | §8 step 8 "Mark it finished" | Update the plan's Status line at every merge | Rule is right but buried as step 8: `docs/TOON-FLAP-PLAN.md` still says "F.1 and F.2 built, not live" though Toon Flap went live 11 Nov (#388). | TOON-FLAP-PLAN line 5 |
| T11 | §10 | "Fixes for parallel development (20 Oct)" | All done. It is history; it costs ~900 words and holds one live to-do (Marble's own `seededRandom` copy) and one open item (Dragon Maths ladder steps, also in §4). | §10, §4 |
| T12 | `docs/prompts/new-game-template.md` (the guide's own starter prompt) | `~/projects/school-games-hub`, run `test:all`, stop for James, nothing live without words | The old path no longer exists; every other line contradicts T1 and T3. Any session started from it is misled before it opens the guide. | the file |

Also seen: `docs/plans/GAME-KIT-PLAN.md` has three different Status lines at the top (lines 3 to 5), left from merges. The guide links to it, so it needs one true line.

## 2. What's missing

| # | Lesson | Where it lives today | Gap in the guide |
|---|---|---|---|
| M1 | **Bella (Kokoro `af_bella`) is the read-aloud voice for every game**, not only junior ones; the voice-clips steps (`scripts/voice-clips.py --list`, `public/voice/<game>/lines.json`, run on James's Mac). Toon Flap has voice too. | memory (4 Nov), §1 table row | One table cell, says "every junior game". No steps, no "when to run it" (it needs James's Mac). |
| M2 | **Help that follows results and isn't too fast**: help fades with this child's success, comes back after struggle; don't hold the screen long after a right answer (Tūī's 3.4 s cost 45 s a round); clock starts after the voice. | LEARNING-DESIGN §5-6, Tūī plan | Covered in summary only; the pacing lesson (hold times) is missing. Fine to point to LEARNING-DESIGN with the 3 numbers that matter. |
| M3 | **Placeholder art first, ComfyUI painting later.** Threads build with drawn stand-ins and write the art plan + `config.json`; James paints in the evening on his gaming PC; picks go to an inbox. Threads don't wait for art or for James to approve screenshots. | memory (29 Oct, 4 Nov), TOON-FLAP-ART-PLAN | Guide implies painting is part of the build and screenshots are "for James". |
| M4 | **Home card art steps**: the card prompt goes in the game's `config.json` as kind `card`; ComfyUI start steps; `home-art-inbox`. | HOME-ART-PLAN, memory `home-art-plan` | Two places (§1a item 6, §2) with different details; no ComfyUI start steps link. |
| M5 | **One new level a day** (Toon Flap's `opensTomorrow`, Diamond's "new levels" in `UNLIMITED_GAMES`): a way to pace a game without a moves cap, and how unlimited turns lifts it. | `shared/toonflap/collection.ts`, `shared/unlimited.ts` | §1a item 3 offers only "daily allowance" or "no limit". |
| M6 | **Unlimited turns and teacher switches** as a checklist line (add to `UNLIMITED_GAMES` + `teacher_set_unlimited_today()`, show "Unlimited today", no hub points). | §1a item 3 (good text) | Not in the §9 checklist, so it is easy to skip. |
| M7 | **What to save per go** in one place for both kinds of game: first tap right, every tap with pick and ms, slips (`slipsOf`), wrong answer `given`, step at the time, help shown. | §1a item 8, §1b item 3, §4.1 rule 6 | Split across three sections with different lists. |
| M8 | **Server replay pattern for action games** (Toon Flap and Marble replay a run from the seed and inputs; `shared/kit/replay.ts`), and the database test checklist (42501 on server-only tables, own school, sent twice counts once). | §7 database bullet, `shared/kit/replay.ts` | Replay of runs isn't described; only marking of questions (§4.2). |
| M9 | **Screen checks at phone, iPad and laptop**: the guide says 1366×640 and 844×390. Recent work also checks iPad (1024×768 and portrait), and Playwright screenshots at those sizes are the norm in cloud threads. | quick-looks-art files, teacher-progress mocks | iPad missing; no ready Playwright snippet. |
| M10 | **The Prompts board and memory**: at start, block, pause and finish, update the Games Hub Prompts board and leave a copy-ready next-step prompt. | project instructions, memory `work-board` | Not mentioned (§8 step 7 says "update the memory note" only). |
| M11 | **Two game types, two paths**: a junior Foundational game (own rounds, steps, voice, kit, `teacher_foundational_class`) and an older-pupil game (way A focus pack, achievements, maybe seasons). | spread through §1a, §1b, §4 | Never laid out as two routes, so each model works it out again. |

## 3. Is it easy for Claude to follow?

- **Too long to hold.** 10,500 words, 456 lines; several lines are 300+ words. A model reads all of it to find one step, and long cells in tables (§3) are the hardest part to scan.
- **No single route.** The order is spread over §0 (15 rules), §1a (8 design questions), §1b (7 steps), §6, §7, §8 (9 steps) and §9 (two checklists). There is no "stage 0 → live" list with the command for each step.
- **History mixed with rules.** The date log at the top, "it went wrong twice", "Star Trader's PR failed on this", §10, and dated decisions inside rules. Useful as reasons, but each costs words and can be one short "why".
- **Repeated rules that drift.** Tests (§0, §7, §9), steps (§0, §1b, §9), off-limits files (§0 item 4, §2, §3), live approval (§0, §8). T1 to T4 are all cases where copies disagreed.
- **Copy-ready examples:** the §4.3 code is good; §1b has a ready trigger line. Missing: a plan skeleton with the 1a/1b questions as headings, a `hub_games` insert, a Foundational config entry, a `config.json` art stub, a go-live PR checklist.
- **Facts that go stale** (counts of games, lists of which game does what) should be replaced by a command that finds the truth (`grep -l … | tail -1`, as §1b already does well).
- **Good bits to keep:** the "never" rules, migration numbering, hooks instead of re-creating functions, §1b's precise steps, the live pipeline facts, the "keep this section current" rule.

## 4. The plan (in priority order)

The same cards, each with a copy-ready prompt and a shared status, are on the **Game Guide Plan** page: https://claude.ai/artifact/USV4sBk6rFm1FpcCcGK8uy

| Card | Change | Covers | Why | Size | Waits for | Done |
|---|---|---|---|---|---|---|
| G1 | Fix the rules that are wrong today, the starter prompt, and the Toon Flap and kit status lines | T1, T3-T8, T10, T12 | They actively mislead a model now | S | nothing | |
| G2 | One test rule, said once in TESTING.md | T2 | Biggest gap between rule and practice | S | James's choice | |
| G3 | Split into `docs/game-guide/` (README + one file per topic), each rule once, history cut | T9, T11, section 3 | A model reads only the part it needs; less drift | L | G1, G2, James's choice | |
| G4 | One start-to-live checklist at the top, junior and older routes tagged | M11, section 3 | One route to follow and tick | M | G3 | |
| G5 | Add the missing lessons | M1-M10 | Stops lessons being learnt again | M | G3 | |
| G6 | Copy-ready templates (plan, migration, Foundational entry, art config, go-live PR) | section 3 | Fewer small mistakes | M | G3 | |
| G7 | Keep it true: fix-the-guide-in-the-same-PR rule, a link check | T10 | Stops this review being needed again | S | G4, G5 | |

Two choices for James (asked on question cards): how strict the test rule is (recommended: 8 for an older game; a junior game may add the voice test and up to 4 screen tests), and the shape (recommended: a folder of short parts, with the old file as a pointer).
