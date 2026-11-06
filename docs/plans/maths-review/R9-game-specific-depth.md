# R9. Game-specific depth (Hop, Penguin Pairs, Weka, Tūī)

Status: plan only, nothing built. Written 7 Nov 2026. One change per game, each from that game's evaluation.

## 1. The problem

Four games each have one place where the game lets a child get through without the real idea.

- **Hop:** counting back appears only on gold days (`BACK_HOPS = 3`, `shared/hop/round.ts:22-23`; gold is round 2 of a pond, `progress.ts`). A child who is secure going forward waits weeks for the other direction.
- **Penguin Pairs:** "Fair or not?" is a two-choice question with fish icons on the buttons (`Goes.tsx:222-224`), so a child can guess and be right half the time. There is no real pile to share, and the count-together is skipped for "fair" (`Goes.tsx:147`).
- **Weka:** the pebble step ends the moment the first ten-frame is full (`Pebbles.tsx`, `done = go.big + moved >= 10`). The child drags until the frame is full, so the frame does the thinking and the child never decides how many make ten.
- **Tūī:** the nine facts `tenand:1` to `tenand:9` are asked four ways (10 + n, n + 10, 10 + ? = 1n, 1n minus 10) but share one record key (`earlyFacts.ts:74-84`). A child who knows 10 + 4 and not 14 minus 10 shows as secure.

## 2. The research behind it

- Counting back is a separate skill from counting on and is the root of subtraction by counting (Gersten, NZ Number Framework stage 3).
- Fair sharing needs an actual collection to be split; equal-looking pictures encourage answering by appearance (Piaget conservation, and Kiwi classroom practice of "share the pile").
- Making ten is a decision. If the frame stops the child at ten, the child learns to keep dragging, not to know ten (Weka eval candidate 2).
- Inverse facts are separate memories at this age. Recording them together hides the gap (Baroody; Tūī eval candidate 4).

## 3. The change

### 3.1 Hop: counting back earlier

- Counting-back hops appear from the first day the child is secure going forward on a step (70 percent of the forward facts at box 2 or more), not from gold days. 1 back hop in each round at first, 2 once back hops are at box 2, 3 after that.
- Back hops use their own fact keys so they have their own records; if the key already carries direction, reuse it.
- Labels for back hops follow the same help rule as forward hops (R6).
- Gold days still add the extra back hops.

### 3.2 Penguin Pairs: "Fair or not?" with a real pile

- Show a pile of fish (6 to 20). The child taps fish out two at a time into two penguin bowls, or drags them. The question is then asked: "Fair or not?" with three choices: "Fair", "One too many", "One too few"; for halves, a leftover fish is the "not fair" case.
- After the second wrong choice, a hint: the fish pair off one by one so the leftover is shown.
- Count-together is shown for fair as well as unfair.
- Bronze: the game shares the first pairs, the child finishes. Silver: child shares all. Gold: child shares and picks.

### 3.3 Weka: the pebble step where the child decides

- The pebble step becomes a real choice: the child drags as many silver pebbles as they think are needed to make ten (no automatic stop). A "Check" button, or releasing after the last drag, counts them.
- Result lines: right ("10 is full. 2 gone, 3 left."), too few ("Not full yet, one more space."), too many ("That is more than ten: 1 too many, put it back.").
- A go with a wrong first try is not counted right first time. Bronze (help full) still allows the hint hand.
- After two wrong tries show the answer by moving the right number across.

### 3.4 Tūī: keys 10 + n and n minus 10 separately

- Give the forms separate fact keys: `tenand:n` for 10 + n and n + 10, and a new key (for example `tenless:n`) for n minus 10 and 10 + ? = 1n. Records for existing children stay on `tenand:n`; new keys start empty, so the minus forms appear as new facts.
- This is a **shared maths change** (`shared/maths/skillPacks/earlyFacts.ts` and the `packIdOfKey` regex in `shared/maths/ladder.ts:285`), so it needs James's OK and should be done on a branch that only touches shared maths first, then Tūī's own folder.
- Tūī's rounds read the right key per way of asking; the ladder skill `ten-and` counts both.
- Existing "secure" Tūī children will see some facts drop back to "learning" until the minus facts are known. Say so on the teacher page tooltip (R7 owns that page) and tell James before merging.

## 4. Files affected

- Hop: `shared/hop/round.ts`, `progress.ts`, `src/games/hop/Hops.tsx`, words, voice lines.
- Penguin Pairs: `src/games/korora/Goes.tsx`, new pile component in the same folder, `shared/korora/round.ts`, words, voice lines.
- Weka: `src/games/weka/Pebbles.tsx`, `shared/weka/round.ts`, words, voice lines.
- Tūī: own folder plus **SHARED, needs James's OK:** `shared/maths/skillPacks/earlyFacts.ts`, `shared/maths/ladder.ts`, possibly `src/maths` labels.
- Voice clips via `scripts/voice-clips.py <game>`.

## 5. Database / migration needs

None for Hop, Penguin Pairs, Weka (all use existing saved facts and rounds). Tūī: no migration if the new key fits `gem_keep_facts`, which stores any key as text; confirm. If a key check exists, use a NEW migration.

## 6. Test steps

At most 8 tests per game.

Hop: (1) back hops appear once forward is secure, not before; (2) count goes 1, 2, 3 by box; (3) back hops land on the right numbers; (4) gold days still add extra.

Penguin Pairs: (1) pile sizes 6 to 20 and answers right; (2) fair, one too many and one too few all detected; (3) hint after second wrong; (4) count-together shows on fair; (5) bronze, silver, gold behave as described.

Weka: (1) dragging exactly the right number is right; (2) too few and too many give the right lines; (3) wrong first try not counted right first time; (4) two wrong tries shows the answer; (5) bronze hint hand still shows.

Tūī: (1) each way of asking reads the right key; (2) existing `tenand:n` records still count for 10 + n; (3) minus forms start as new facts; (4) skill map counts both.

Preview checks: play each change on a phone width; drag works with touch; read-aloud lines play; no layout jump on the new pile or the Check button.

## 7. Effort and impact

Effort M. Impact Medium. Weka and Hop are the smallest. Penguin Pairs is a new screen. Tūī needs James's OK for the shared maths change.

## 8. Session prompts (ready to paste, one per game, each its own branch)

Prompt 1 is the one in the JSON file.

### Prompt 1: Weka

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r9-weka-pebbles. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md and docs/plans/maths-review/R9-game-specific-depth.md (section 3.3).

Make Weka's pebble step a real choice:
1. In src/games/weka/Pebbles.tsx stop ending the step when the first ten-frame fills. The child drags as many silver pebbles as they think make ten, then taps Check (or the step counts when they stop for a moment, your call; keep it simple for a 6 year old).
2. Result lines in words.ts and voiceLines.ts: right ("10 is full. 2 gone, 3 left."), too few, too many (put one back). A wrong first try means the go is not counted right first time. After two wrong tries move the right number across to show it. Keep the hint hand for bronze help.
3. Run scripts/voice-clips.py weka for the new lines.
4. At most 8 tests. npm run build:functions -- weka if shared/weka changes. Typecheck, npm run test:changed, play the preview with touch.
Do not touch shared/maths, src/maths, src/styles.css or src/components. Stop and tell James before any live step. Open a PR when done.
```

### Prompt 2: Hop

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r9-hop-count-back. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md and docs/plans/maths-review/R9-game-specific-depth.md (section 3.1). Do R2 and R6 first if not merged.

In shared/hop/round.ts bring counting-back hops in once the child is secure going forward on a step (70 percent of the forward facts at box 2 or more), not only on gold days: 1 back hop per round, 2 when the back facts are at box 2, 3 after that. Back hops get their own fact records (reuse a direction in the key if one exists). Gold days still add the extra back hops. Update Hops.tsx labels to follow the help rule. At most 8 tests; npm run build:functions -- hop; typecheck; npm run test:changed; play the preview.
Stay inside Hop's folders. Stop and tell James before any live step. Open a PR when done.
```

### Prompt 3: Penguin Pairs

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r9-korora-fair-pile. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md and docs/plans/maths-review/R9-game-specific-depth.md (section 3.2).

Rebuild "Fair or not?" in src/games/korora with a real pile: a pile of 6 to 20 fish, the child taps or drags fish two at a time into two bowls, then picks from three choices (Fair, One too many, One too few). Hint at the second wrong choice (fish pair off to show the leftover). Show count-together for fair as well. Bronze shares the first pairs, silver the child shares all, gold shares and picks. New component in the game's own folder, words.ts and voiceLines.ts lines, scripts/voice-clips.py korora. At most 8 tests; npm run build:functions -- korora if shared/korora changes; typecheck; npm run test:changed; play the preview with touch.
Do not touch shared/maths, src/maths, src/styles.css or src/components. Stop and tell James before any live step. Open a PR when done.
```

### Prompt 4: Tūī (needs James's OK first)

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r9-tui-separate-keys. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md and docs/plans/maths-review/R9-game-specific-depth.md (section 3.4).

This changes shared maths. Before editing anything, tell James: existing Tūī children who count as secure may drop back to learning on the minus forms, and ask for his OK. Then:
1. In shared/maths/skillPacks/earlyFacts.ts keep tenand:n for 10 + n and n + 10, and add a new key (for example tenless:n) for n minus 10 and 10 + ? = 1n. Update the packIdOfKey regex in shared/maths/ladder.ts and make the ten-and skill count both.
2. In shared/tui/round.ts and src/games/tui read the right key for each way of asking. Existing tenand:n records stay.
3. Check gem_keep_facts accepts the new key text (no migration if so; otherwise a NEW migration).
4. At most 8 tests including old records still counting for 10 + n. npm run build:functions -- tui. Typecheck, npm run test:changed, play the preview.
Stop and tell James before any live step. Open a PR when done.
```
