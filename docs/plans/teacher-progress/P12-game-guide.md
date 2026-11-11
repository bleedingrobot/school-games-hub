# P12. Game development guide matches the Progress tab

**Size:** S · **SQL:** no · **Waits for:** nothing (keep it current after each card)

**Why.** New games and activities should fit the teacher's Progress tab from day one: the same step words, a column on the
table, a place on the ladder board, and the data behind "stuck", "nearly ready" and "usual slip". Asked for by James,
11 Nov 2026.

**What done looks like.** `docs/GAME_DEVELOPMENT_GUIDE.md` has a section 1b, "Steps and the teacher's Progress tab": the words,
the seven things a Foundational game adds (config entry, what the progress row and each round save, its block in
`teacher_foundational_class`, nearly ready, the server slip, a test), what any other game with levels plans for, and the
cards still to come. Quick start item 15, section 1a's "What the teacher needs" and the go-live checklist point to it.

**After this.** Every later card (P8 to P11) that changes what a new game must do also updates section 1b in its own PR.

## Session prompt (ready to paste)

```text
You are keeping the Games Hub game development guide in step with the teacher progress plan (card P12).

Read docs/GAME_DEVELOPMENT_GUIDE.md section 1b and docs/plans/teacher-progress/HANDOVER.md. For each card marked done and live
since section 1b was last updated, check the code on main and update section 1b so a new game does what that card needs
(what to save, what to add to which file, which migration is the pattern). Keep it short and plain. Docs only: open a PR to
main, wait for green checks, merge it (pre-approved), and note it in HANDOVER.md.
```
