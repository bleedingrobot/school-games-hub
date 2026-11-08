# S31: Older games: Show me first for each new kind
**Game:** Weka, Hop, Pipi, Penguin Pairs, Tūī, Beanstalk, Quick looks
**What's wrong:** A new kind of question (hop back, count back, "from 3", altogether, two tides, halves, near doubles, fair or not, ways, empty squares) turns up cold. The child gets no demo the first time. Only Weka's very first go has a guided hand.
**What done looks like:** The first time a child meets each new kind, the game shows how it works (a short demo or a guided first go with full help). The server remembers which kinds the child has seen. It never shows the demo again.
**Size:** M
**Impact on learning:** High
**Waits for:** S11 (kit: server-saved "seen kinds"), S12 (the demo pattern for new kinds in the newer games). S22 for Beanstalk (Part 6 only runs if S22 has not already done it).

## 1. The problem
Each game has "first go" help only for the very first round. After that, new kinds slip in with no warning. The kit already has `useGuidedFirstGo` (src/kit/README.md; only Weka uses it, src/games/weka/Goes.tsx:38,153) and `FirstTimeTip` (no older game uses it). DECISIONS.md pattern 5 names these cold starts.

Where the first-go help happens now, and where each new kind first appears:
- Weka: guided only when `daysDone===0 && lastStoneDay===null` (shared/weka/server.ts:130, src/games/weka/WekaGame.tsx:122). Go 0 only (Goes.tsx:151-154). Hop-backs are the last 2 goes (indices 8 and 9) on gold days only (shared/weka/round.ts:32, :229). Smaller-first goes are about 30% of goes on silver and gold days (round.ts:34, :229).
- Hop: guided when `daysDone===0 && lastPadDay===null` (src/games/hop/HopGame.tsx:131; hand at src/games/hop/Hops.tsx:188). Back hops are 1 to 3 goes at the end of the round (shared/hop/round.ts:26, :249, :254-258). The "from 3" goes sit just before the back hops, gold days only (round.ts:34, :253).
- Pipi: guided only when `played===0` (shared/pipi/server.ts:118,127; src/games/pipi/PipiGame.tsx:122; hand at src/games/pipi/Goes.tsx:236). Altogether goes (silver and gold) and two tides goes (gold only) land at random indices after go 0 (shared/pipi/round.ts:179-186).
- Penguin Pairs: guided only on the first round (shared/korora/server.ts:128-131; src/games/korora/Goes.tsx:132,153-156). Halves arrive when the level reaches 2, near doubles at level 5 (shared/korora/round.ts:34-40). Fair or not goes are the last 2 goes on gold days (round.ts:32, :224, :228).
- Tūī: guided only on go 0 of the first round, key `tenand:2` (shared/tui/server.ts:121-124; src/games/tui/Goes.tsx:86,108-111). New ways arrive with each step. Seven of ten goes use the newest way, in a shuffled order (shared/tui/round.ts `waysFor` and `STEPS`).
- Beanstalk: guided at round level only, first day or a new big stalk (src/games/beanstalk/BeanstalkGame.tsx:151). Missing-leaf goes are goes 4, 7 and 10 of every round from the start (shared/beanstalk/round.ts:35-36).
- Quick looks: one demo screen for stage 1 (src/subitising/SubitisingApp.tsx:185-196, `demoTrial` at :18-19). Empty squares is stage 6, mixed at stage 7 (shared/subitising/config.ts:44-52). Placement can start a child at any stage (shared/subitising/trials.ts).

## 2. The rule behind it
LEARNING-DESIGN rule 4: help arrives by itself, with a demo or guided go the first time a new kind appears, and who has seen it comes from the server. Rule 2 and rule 10 apply too: the demo shows, it does not test.

## 3. The change
The same rule for every part. It reuses S11 and S12 (names to be taken from those plans).
1. The child's saved list of "seen kinds" comes from the server with the round (S11). Each game picks its own short kind names, for example `weka:back`.
2. The round builder already fixes the go order at the start. The client finds the first go whose kind is not in the seen list.
3. On that go the game forces full help (as the guided go does, Weka Goes.tsx:154) and shows the demo or tip (S12 pattern) before the child answers.
4. When the go is finished, the kind is saved as seen. If the child quits early, they may see the demo again. That is fine.
5. A demo shows one worked example and is never scored.
No game words go in the kit. The kit gives "is this kind seen" and "mark it seen". Each game supplies the words, art and the example.

### Part 1: Weka (hop back, smaller first)
Kinds: `back` (shared/weka/round.ts:44, set at :298) and `turn` (smaller first). Hop-back first fires at index 8 or 9 on the first gold day. Smaller-first fires at its first random index on the first silver day. Show Weka doing the example with the existing guided hand (`useGuidedFirstGo`, Goes.tsx:153), then let the child take the real go.

### Part 2: Hop (counting back, "from 3")
Kinds: back (`:back:` key, shared/hop/round.ts:254-258, detected at src/games/hop/Hops.tsx:114) and offset (`o` key, parseSkip, shared/maths/skillPacks/earlyFacts.ts:209-212). Back first fires at one of the last 1 to 3 goes. "From 3" fires at its index, gold days only. The demo says plainly that Hop starts at the number said, and counts back or on.

### Part 3: Pipi (altogether, two tides)
Kinds `altogether` and `twoTides` (shared/pipi/round.ts:38, :179-186). Each fires at its first random index after go 0. Two tides is gold only. The demo uses the pictures from `spotsFor` (src/games/pipi/Goes.tsx:66).

### Part 4: Penguin Pairs (halves, near doubles, fair or not)
Three kinds: halves (level 2, `pairUp` places a half just after its double, shared/korora/round.ts:34-40), near doubles (level 5), fair or not (last 2 goes on gold, round.ts:224-228). Halves already share themselves on full help (src/games/korora/Goes.tsx:155-156), so the demo uses that. Fair or not shows the pairing before sorting (Goes.tsx:280-308).

### Part 5: Tūī (ways)
The kinds are the four extra ways in `STEPS` (shared/tui/round.ts). A kind first fires at the first go built with that way. Tūī already sets help to at least `FRAMES_LEVEL=4` on a new step (`placeAfter`). The demo adds a worked example of the new way, using the frames.

### Part 6: Beanstalk (missing leaf) - only if not in S22
First check S22. If S22 already gives a missing-leaf demo, do not run this part. Otherwise: the kind fires at go 4 of the first round (shared/beanstalk/round.ts:35-36). The demo uses `WORDS.missingAsk`, `missingSum` and `takeAway` (src/games/beanstalk/words.ts:48-50).

### Part 7: Quick looks (empty squares)
Kind: gap (stage 6 and the half-gap mix at stage 7, shared/subitising/trials.ts:81, config.ts:44-52). No migration is needed: "seen empty squares" is true when any saved answer key is a `gap` or `gaph` key (`isQuickKey`, `parseKey`, shared/subitising/keys.ts:36-41). Add a new demo screen next to `'demo'` (SubitisingApp.tsx:185-196) that uses `FlashRunner` with `guidedMode` and a gap `demoTrial`. Show it in `startSession` when the current stage is 6 or 7 and no gap answer is saved. A new voice clip is needed for the demo line (src/subitising/voiceLines.ts:13-21). Do not add a field to the saved settings: `unpackSettings` checks the exact key count (shared/subitising/saved.ts).

## 4. Files affected
- Each game: `shared/<game>/round.ts` (kind names and the "first unseen" lookup), `shared/<game>/server.ts` (read the seen list), `shared/<game>/progress.ts` if the list is saved there, `src/games/<game>/Goes.tsx`, `words.ts` and `voiceLines.ts` for the demo lines.
- Quick looks: src/subitising/SubitisingApp.tsx, src/subitising/FlashRunner.tsx, src/subitising/voiceLines.ts.
- The kit part is in S11, not here.

## 5. Database / migration needs
Games with a game table need one new migration (a new numbered file after the latest in supabase/migrations/) if S11 does not already give a column for "seen kinds". Check S11 first. Then run `npm run build:functions` in the same PR. Quick looks needs none.

## 6. Test steps
For each game (no more than 8):
1. A new child: the demo fires on the first go of each new kind and not before.
2. The same child, next round: no demo for a kind already seen.
3. Quit mid-demo: the kind is not saved, the demo shows again.
4. Full help is forced on the demo go.
5. The demo go still scores as a normal first tap only after the demo ends.
6. An old child with history: kinds they have already met do not replay.
7. `npm run build:functions` passes and the replay test still passes.
8. Read-aloud says the demo line.

## 7. Size and impact
Size M. Impact High: a child meets each new kind with a worked example, not cold.

## 8. Session prompt (ready to paste)

### Part 1: Weka
```text
Create branch s31-weka-show-me-first from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S31-show-me-first-older-games.md (Part for Weka).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Add the seen kinds `weka:back` and `weka:turn`. 2. Find the first unseen go and force full help with the guided hand. 3. Mark seen on finish. 4. Add the words.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Hop
```text
Create branch s31-hop-show-me-first from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S31-show-me-first-older-games.md (Part for Hop).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Add seen kinds for back and offset. 2. Find the first unseen go and force full help. 3. Demo says Hop starts at the number said. 4. Mark seen on finish.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Pipi
```text
Create branch s31-pipi-show-me-first from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S31-show-me-first-older-games.md (Part for Pipi).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Add seen kinds altogether and twoTides. 2. Demo on the first unseen go with the spotsFor picture. 3. Mark seen on finish.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 4: Penguin Pairs
```text
Create branch s31-penguin-show-me-first from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S31-show-me-first-older-games.md (Part for Penguin Pairs).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Add seen kinds half, near and fair. 2. Demo on the first unseen go (halves use the shared pile). 3. Mark seen on finish.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 5: Tūī
```text
Create branch s31-tui-show-me-first from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S31-show-me-first-older-games.md (Part for Tūī).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Add one seen kind per way. 2. Demo with the frames on the first go of a new way. 3. Mark seen on finish.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 6: Beanstalk
```text
Create branch s31-beanstalk-show-me-first from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S31-show-me-first-older-games.md (Part for Beanstalk).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
0. Check S22 first. If it already has a missing-leaf demo, stop and tell James. 1. Add the seen kind `beanstalk:missing`. 2. Demo on go 4 of the first round. 3. Mark seen on finish.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 7: Quick looks
```text
Create branch s31-quick-looks-show-me-first from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S31-show-me-first-older-games.md (Part for Quick looks).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Add a 'demoGap' screen. 2. Show it at stage 6 or 7 when no saved answer has a gap key. 3. Add the voice clip. 4. No saved-settings change.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```
