# S7: Pigeon: show the reason on the number line itself

**Game:** Pigeon's Number Line (and the kit NumberLine)
**What's wrong:** When a child taps the wrong place or card, the reason is a sentence and a thinking emoji. The gap is never drawn on the line. The line also jumps about 80px when the panel opens, and the "arrow" on read goes is a dot with a "?".
**What done looks like:** After the first wrong the child's own tap stays on the line as a ring and a short line says which way. After the second wrong the line itself shows the reason: jumps of ten counted from the child's mark to the right place, a real arrow on read goes, and the line does not move.
**Size:** M (two small PRs: one kit, one game)
**Impact on learning:** High
**Waits for:** nothing

## 1. The problem

- **The reason is not on the line.** `src/games/pigeon/Goes.tsx:216-222` shows `ShowWhy` with `picture={<span className="pg-why__icon">🤔</span>}`; the look-together at `:224-226` uses `👀`. The line only gets a ring where the child tapped (`wrongDot`, `:174`) and, on a place go, two marks either side of the right number (`lookMarksFor`, `:250-254`). The evaluator: "the reasons show as text with a thinking emoji beside the line, not on the line itself (e.g. the near-ten gap is not drawn)" (`docs/reviews/maths-review-2/games/pigeon.md`, criterion 6 and checklist item 17).
- **The line jumps.** `.pg-play` is a flex column with `justify-content: space-between` (`pigeon.css:93-96`) and `.pg-stage` is `flex: 1` and centred (`:101`). The panels (`Goes.tsx:213-228`) are siblings of the stage, so when one opens the stage shrinks and the line moves up about 80px. Checklist item 5: "panel appearance shifts the line."
- **No reason after the third wrong.** After the look, `gs.phase === 'redo'` shows only `NowYouTry` (`:228`). Another wrong tap on a card shows nothing new (evaluator, criterion 6).
- **The arrow is a dot.** `arrow = [{ value: go.n, label: '?' }]` (`Goes.tsx:176`) draws a solid dot with a "?" (kit `LinePoint.look` is only `'dot' | 'ring'`, `src/kit/NumberLine.tsx:27`). Read goes say "What number is at the arrow?" but there is no arrow.
- **The kit cannot hold still.** The kit works out the line's height from the arcs it is given: `top = Math.max(24, ...up.map(...))` (`NumberLine.tsx:177`). If arcs appear later, the whole line moves down. Arcs also draw only on the main line (`:206`), not in the zoom lens, but step 6 goes are on the lens.

## 2. The rule behind it

- Rule 7 (mistakes teach): the reason is shown on the same model the child used, the line, not on a different picture.
- Rule 1 (the maths is the move): the count of tens between the child's mark and the right place is the place-value idea, so it should be drawn as counting.
- Rule 3 (concrete, then picture, then number): the ring, the arcs and the real arrow come before any extra words.

## 3. The change

Two PRs, in order. Part 1 changes the kit and is its own small branch. Part 2 is the game.

### Kit part (Part 1)

All in `src/kit/NumberLine.tsx`. No game words. `src/kit` is browser code, so no `build:functions`.

1. **`look: 'arrow'` on `LinePoint`.** Draw a down-pointing arrow (a short stem and a head) above the line, tip on the value, with the label above it. It sits above the line, not on it. The `look` type becomes `'dot' | 'ring' | 'arrow'`.
2. **`room?: number` prop.** The height reserved above the line, in picture units. `top = Math.max(24, room ?? 0, ...arcs)`. A game that will draw arcs later passes the room now, so the line never moves. Same for the bottom: `roomBelow?: number` adds to `bottomMain`.
3. **Arcs on the lens.** Add `arcs?: readonly Arc[]` to `Lens`. Draw them on the lens line with the same code (pull the arc drawing at `:206-229` into a small `Arcs` helper used by both lines). Lens `room` and `roomBelow` work the same way and move `lensY` and `H` (`:182-184`). This is needed because step 6 goals are on the lens.
4. Extend the existing kit tests (do not add more than one): in `src/kit/kit.test.tsx` the "number line puts values in the right place" test (`:20`) checks an arrow point is drawn above the line, `room` makes the height the same with and without arcs, and a lens arc draws. (The kit test file has 4 tests today.)
5. Update `src/kit/README.md` (the NumberLine section): arrow look, `room`, `roomBelow`, lens arcs.

Branch name for the kit PR: `kit/number-line-arrow-room`. Merge it before Part 2.

### Game part (Part 2)

Branch: `fix/pigeon-line-reason`. All in `src/games/pigeon`. `shared/pigeon` is not changed, so no function rebuild.

6. **A reserved slot, so nothing moves.** Wrap the why, look and now-you-try panels (`Goes.tsx:213-228`) in one always-present `<div className="pg-reason">` with `min-height: 7.5rem` (`pigeon.css`, new rule near `.pg-why`, `:124`), `display: flex; align-items: center; justify-content: center`. It sits where the panels are now, so the space is already taken before the first wrong. The stage no longer changes size. (The cards row below is unaffected.)
7. **Pass `room` to the line.** In `lineFor` (`Goes.tsx:51`) add `room: 110` and `roomBelow: 40` to the props on every go that can show a reason (place, read, tens, near). 110 fits one row of arcs with labels and the arrow. Check at 375px width that the line is not too small (the SVG scales to width).
8. **Remove the emoji pictures.** Drop `picture={<span className="pg-why__icon">🤔</span>}` at `:220` and the `👀` at `:225`; pass `picture={null}` (the kit type is `ReactNode`, `src/kit/ShowWhy.tsx:14`, so null is allowed and no kit change is needed). The line above is the picture. Delete `.pg-why__icon` (`pigeon.css:128`).
9. **First wrong: keep the child's mark on the line.** The line already keeps `wrongDot` (a ring, `Goes.tsx:174`). Add the same for card goes: a ring at the value of the card tapped (`go.kind` read, tens, near: the card value, from `tapped`), so the line shows what the child chose. The existing slip line (`SLIP_LINES`, `PLACE_LINES`) says the short reason in the reserved slot. No change to those words.
10. **Second wrong ("Let's look together"): draw the reason on the line.** New pure function `reasonFor(go, tappedValue)` in a new file `src/games/pigeon/reason.ts` returning `{ points, arcs }` for `NumberLine`:
    - **Place:** the child's mark (ring), the right place (solid dot with its number, tone `landmark`), and arcs counted in jumps of the line's big unit from the lower end of the gap to the right place. The unit is 10 on the 0 to 100 line, 100 on the 1000 line, and 1 on a narrow lens (the same `size` rule as `lookMarksFor`, `:251`). Each jump arc is labelled `+10`; a last partial arc is labelled with its size (for example `+4`). Cap at 10 arcs. Jumps run from the nearest big mark below the right place, not from the child's mark, so the count matches the number name ("40 and 7").
    - **Read:** the real arrow (`look: 'arrow'`, no label) at `go.n`, the child's card as a ring, and arcs counted from the nearest big mark below `go.n` up to the arrow.
    - **Tens (ten more / less):** an arc from `go.n` to `go.answer` above, labelled `+10` or `-10` (use `side: 'above'`), the child's card as a ring and, if it is on the line, a second arc below from `go.n` to the child's card labelled with its own jump (`+1`, `+100`, ...), so the child sees two different-size jumps.
    - **Near:** arcs from `go.n` to each post, labelled with the gaps (for example `3` and `7`), the nearer one in the main arc tone and the other on `side: 'below'`.
    The kit `colors` prop already holds `arc` for these.
11. **The read arrow, always.** On read goes replace `arrow = [{ value: go.n, label: '?' }]` (`:176`) with `[{ value: go.n, look: 'arrow' }]` (no `?`, the question already asks).
12. **Look-together text (fixed lines, one per go kind, read by clips).** `lookLine` (`voiceLines.ts:46-55`) stays for the default and changes to match the drawing:
    - place: `{n} is {low} and {k} more. Count the jumps.` (still per key, so the clips exist; `allVoiceLines` already loops over keys, `:81-89`)
    - read: `Count the little jumps up from the nearest big number.`
    - tens: `Ten more is one ten along. The other jump is a different size.` (ten less: `Ten less is one ten back. ...`)
    - near: `Count how far it is to each post. The nearer post wins.`
    Rewrite the clips: `WRITE_VOICE_LINES=1 npx vitest run src/games/pigeon/voiceLines.test.ts`, then `~/kokoro/.venv/bin/python -I scripts/voice-clips.py pigeon`.
13. **Wrong after the look (redo).** Keep the child's last ring on the line and say the slip line again in the reserved slot (`SLIP_LINES` or `PLACE_LINES`). Keep the arcs drawn (they stay for the rest of the go) so there is always a reason on screen. `NowYouTry` stays until the first wrong redo tap, then the slip line replaces it.
14. **First go, level 5 guide (`GUIDED_KEY = 'place100:t50'`):** unchanged. Reasons only draw after a wrong tap.
15. Do not draw `go.posts` until the reason (that belongs to S8).

## 4. Files affected

- Kit (own branch `kit/number-line-arrow-room`): `src/kit/NumberLine.tsx`, `src/kit/kit.test.tsx`, `src/kit/README.md`.
- Game (`fix/pigeon-line-reason`): `src/games/pigeon/Goes.tsx`, `src/games/pigeon/reason.ts` (new), `src/games/pigeon/voiceLines.ts`, `src/games/pigeon/words.ts` (if new words), `src/games/pigeon/pigeon.css`, `public/voice/pigeon/` (changed and new clips and `lines.json`), `shared/pigeon/pigeon.test.ts` or `src/games/pigeon/reason.test.ts` (one test).

## 5. Database / migration needs

None. No taps or scores change.

## 6. Test steps

Automated:
1. Kit: extend one existing test (see Part 1 step 4).
2. Game: one test of `reasonFor`: place 47 on 0 to 100 gives 4 arcs of 10 and one of 7; place on the 1000 line uses jumps of 100; a lens narrower than 10 uses jumps of 1; read has an arrow and counted arcs; near has two arcs with gaps adding to the post gap; the answer in `reasonFor` for a card go is only drawn at the second wrong.

By playing the preview:
- Place 47: tap 33. A ring at 33 stays on the line, the short line "too early" is in the reserved slot, nothing moves. Wrong again: the arcs count 40, then 7. The line does not move when the panel opens. Then "Now you try". Do the same on the 1000 line (hundreds) and a zoom lens.
- Read go: a real arrow is above the line. Tap a wrong card twice: the child's card shows as a ring, the jump arcs show from the near big number to the arrow.
- Ten more: a wrong card shows its own jump below, the right jump above.
- Near: arcs to both posts with the gaps.
- Third wrong in the redo: the slip line shows again.
- Phone width (375px): labels on arcs do not overlap the ends; no horizontal scroll.

## 7. Size and impact

M: one small kit change (arrow, room, lens arcs) and one game change with a new pure drawing function and clips. High: the gap between the child's answer and the right one is the whole lesson of a number line, and it is currently only in words.

## 8. Session prompt (ready to paste)

### Part 1: kit NumberLine (arrow, room, lens arcs)

```text
Create branch kit/number-line-arrow-room from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S7-pigeon-line-reason.md first (the "Kit part (Part 1)" section).
This is a kit change: no game words in src/kit. src/kit is browser code so no build:functions is needed.

Steps in src/kit/NumberLine.tsx:
1. Add look: 'arrow' to LinePoint (a down-pointing arrow above the line, tip on the value, label above it).
2. Add room?: number and roomBelow?: number props; top = Math.max(24, room ?? 0, ...arc heights); bottomMain gets roomBelow too. A line with room and no arcs is the same height as with arcs.
3. Add arcs?: readonly Arc[] (plus room, roomBelow) to Lens; pull the arc drawing into a small Arcs helper used by both the main line and the lens; move lensY and H to match.
5. Extend (do not add) the existing test in src/kit/kit.test.tsx ("a number line puts values in the right place...") to check the arrow, room (same height with and without arcs) and a lens arc.
6. Update src/kit/README.md for the new props.
7. Run npx vitest run src/kit, npm run typecheck, npm run build.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Pigeon reason on the line

```text
Create branch fix/pigeon-line-reason from origin/main (own worktree). The kit PR (kit/number-line-arrow-room) must be merged first; if it is not, stop and tell James.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S7-pigeon-line-reason.md first.
Do not touch shared/, src/kit, src/maths, src/styles.css or src/components.

Steps (all in src/games/pigeon, browser only):
1. Goes.tsx: wrap the ShowWhy, LookTogether and NowYouTry panels in one always-present div.pg-reason with a min-height of 7.5rem (pigeon.css), so the line never moves when a panel opens. Pass room: 110 and roomBelow: 40 to the line in lineFor.
2. Remove the thinking and eyes emoji pictures from the panels and delete .pg-why__icon.
3. First wrong: keep a ring at the child's tap (place) or at the tapped card's value (read, tens, near).
4. New src/games/pigeon/reason.ts: reasonFor(go, tappedValue) returns points and arcs: place = child's ring, right dot, jump arcs in units of 10 (100 on the 1000 line, 1 on a narrow lens) from the big mark below the answer, with a last partial arc; read = real arrow + counted arcs; tens = the right jump above and the child's jump below; near = arcs to each post labelled with the gaps. Draw it at the second wrong (look together) and keep it for the rest of the go.
5. Replace the "?" dot on read goes with the kit arrow point look.
6. After the look, a wrong redo tap says the slip line again in the reserved slot.
7. Change lookLine to match the drawing (see the plan, step 12). Rewrite the clips: WRITE_VOICE_LINES=1 npx vitest run src/games/pigeon/voiceLines.test.ts, then ~/kokoro/.venv/bin/python -I scripts/voice-clips.py pigeon.
8. One test of reasonFor (place 47, the 1000 line, a narrow lens, read, near).
9. Run npx vitest run shared/pigeon src/games/pigeon, npm run typecheck, npm run build. Play the preview as in the plan (place 47 and tap 33, the 1000 line, a lens, read, ten more, near, third wrong, phone width). The line must not move when a panel opens.
Stop and tell James before any live step. Open a PR when done.
```
