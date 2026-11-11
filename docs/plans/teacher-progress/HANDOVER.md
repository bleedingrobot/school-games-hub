# Teacher progress plan: handover

The review behind this plan is [docs/TEACHER-PROGRESS-REVIEW.md](../../TEACHER-PROGRESS-REVIEW.md) (11 Nov 2026). Pictures of
the teacher pages today (`now-*.png`) and the mock-ups (`mock-*.png`) are in the project files folder `teacher-progress/`.

**Plan page with copy-ready prompts:** the "Teacher Progress Plan" artifact (link in project memory, `teacher-progress-plan`).
This file is the record of where things stand. Keep it current in each card's PR.

## The goal

A teacher sees at a glance where every pupil is on each game's steps, who is stuck, and who is ready to move on. Then we collect
the extra data that makes that sharper.

## How to run it

- One card per session (or per cheap helper). Each card ends with a **Session prompt (ready to paste)**.
- Do the cards in order. P7 and P10 wait for nothing, so they can run beside the others. They touch different files.
- Before a migration merges, check its number is free on main (`node scripts/migration-numbers.mjs`).
- Merging to main deploys migrations, edge functions and the site. Merging is pre-approved. Ask James before deleting anything.

## Cards, in order

| # | Card | Size | SQL | Waits for |
|---|---|---|---|---|
| P1 | [Same words for steps everywhere](P1-same-words.md) | S | no | — |
| P2 | [Progress tab: every game's steps](P2-progress-table.md) | M | no | P1, where the tab lives |
| P3 | [Progress tab: the ladder board](P3-ladder-board.md) | M | no | P2 |
| P4 | ["Nearly ready" and "on this step since"](P4-nearly-and-since.md) | M | yes | P2 |
| P5 | ["Who needs a look", Today links, flags](P5-needs-a-look.md) | S | no | P2 (P4 for one pill) |
| P6 | [Pupil page: steps in each game](P6-pupil-steps-card.md) | S | no | P1, P2 |
| P7 | [Usual slip for Lizard and Swamp Hen](P7-lizard-swamphen-slips.md) | S | yes | — |
| P8 | [Right first try and time per go](P8-first-try-and-time.md) | M | yes | P2 |
| P9 | [Step history](P9-step-history.md) | M | yes | P2 |
| P10 | [Common wrong answers in maths facts](P10-common-wrong-answers.md) | M | yes | — |
| P11 | [Other games on the Progress tab](P11-other-games.md) | M | some | P2; Toon Flap after its F.5 |

## Done and live

Nothing yet.

## Waiting on James

- Where the Progress view lives: a new tab beside Today (recommended), a Maths sub-tab, or replacing the Foundational grid.
