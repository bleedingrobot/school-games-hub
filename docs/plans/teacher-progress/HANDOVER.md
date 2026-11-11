# Teacher progress plan: handover

The review behind this plan is [docs/TEACHER-PROGRESS-REVIEW.md](../../TEACHER-PROGRESS-REVIEW.md) (11 Nov 2026). Pictures of
the teacher pages today (`now-*.png`) and the mock-ups (`mock-*.png`) are in the project files folder `teacher-progress/`.

**Plan page with copy-ready prompts and shared status:** https://claude.ai/artifact/XVpd7cVC83aZGST9kfjQKA (collection `status`, one doc per card P1 to P11: `state` todo, started or done; `pr`; `updated`).
This file is the record of where things stand. Keep it current in each card's PR.

## The goal

A teacher sees at a glance where every pupil is on each game's steps, who is stuck, and who is ready to move on. Then we collect
the extra data that makes that sharper.

## How to run it

- One card per session (or per cheap helper). Each card ends with a **Session prompt (ready to paste)**.
- Do the cards in order. P7 and P10 wait for nothing, so they can run beside the others. They touch different files.
- Before a migration merges, check its number is free on main (`node scripts/migration-numbers.mjs`).
- Merging to main deploys migrations, edge functions and the site. Merging is pre-approved. Ask James before deleting anything.
- A card that changes what a new game must save or add also updates section 1b of `docs/GAME_DEVELOPMENT_GUIDE.md` in its own PR (James, 11 Nov 2026).

## Cards, in order

| # | Card | Size | SQL | Waits for |
|---|---|---|---|---|
| P1 | [Same words for steps everywhere](P1-same-words.md) | S | no | — |
| P2 | [Progress tab: every game's steps](P2-progress-table.md) | M | no | P1 |
| P3 | [Progress tab: the ladder board](P3-ladder-board.md) | M | no | P2 |
| P4 | ["Nearly ready" and "on this step since"](P4-nearly-and-since.md) | M | yes | P2 |
| P5 | ["Who needs a look", Today links, flags](P5-needs-a-look.md) | S | no | P2 (P4 for one pill) |
| P6 | [Pupil page: steps in each game](P6-pupil-steps-card.md) | S | no | P1, P2 |
| P7 | [Usual slip for Lizard and Swamp Hen](P7-lizard-swamphen-slips.md) | S | yes | — |
| P8 | [Right first try and time per go](P8-first-try-and-time.md) | M | yes | P2 |
| P9 | [Step history](P9-step-history.md) | M | yes | P2 |
| P10 | [Common wrong answers in maths facts](P10-common-wrong-answers.md) | M | yes | — |
| P11 | [Other games on the Progress tab](P11-other-games.md) | M | some | P2; Toon Flap after its F.5 |
| P12 | [Game development guide matches the Progress tab](P12-game-guide.md) | S | no | — (keep current after each card) |

## Done and live

- P1 Same words for steps: PR #393, 11 Nov 2026.
- P2 Progress tab, every game's steps: PR #394, 11 Nov 2026.
- P3 Ladder board: PR #395, 11 Nov 2026.
- P4, P5, P6 and P7 together: PR #396, 11 Nov 2026. P4 counts days on a step including today (on it since 6 Nov, today 11 Nov, is 6 days).
- P8 Right first try and time per go: PR #398, 11 Nov 2026. `f` comes from `first_right`, so only Tūī, Robin, Parrot, Lizard, Pigeon and Swamp Hen have it. Taps don't save the answer, so `ms` uses only rounds with no wrong taps.
- P9 Step history, P10 Common wrong answers and P11 Other games together: PR #399, 11 Nov 2026.
  - P9: `step_changes` starts from the rounds still kept (marked estimated). New Season does not clear it, because steps aren't cleared either. Clearing it at year end would need James's OK (a `season_fn` hook on the 11 games).
  - P10: games that send `given` are the shared question packs (QuestionModal), Gem Keep, Space, Monsters, Dragon Maths' banker, Diamond, Isles, Toon Flap, Royal Decree and Kingdom Keeper. The Foundational tap games, Archery and Trader don't yet. Gem Keep, Dragon Maths and Monsters' hardest rows don't show the class's wrong answer yet.
  - P11: one read, `teacher_progress_other_games`, for Gem Keep, Diamond Drop, Dragon Maths, Bond Match and Toon Flap.
- P12 Game development guide section 1b: PR #397, 11 Nov 2026.

## Decided

- James, 11 Nov 2026: the Progress view is a new top-level tab beside Today (route /teacher/:classId/progress). The Foundational grid stays under Maths.

## Waiting on James

Nothing.
