# S15: Honest finish words: Pigeon, Parrot, Lizard, Swamp Hen, Robin

**Game:** Pigeon, Parrot, Lizard, Swamp Hen, Robin (the kit part must be general enough for the older games, which get it in S33)
**What's wrong:** Every finish screen says "Well done!" whether the child got 10 of 10 first go or guessed their way through. The words do not say how the round went.
**What done looks like:** After each round the finish screen says one honest line about how the round went (most right / some right / tricky today), about what the child did and not about the child. The day still counts and the reward still turns exactly as now.
**Size:** S to M
**Impact on learning:** Med
**Waits for:** S14 (so "right first go" does not include lucky stabs)

## 1. The problem

- The finish heading is chosen only from the reward: golden prize, or a thing that turned, or `doneToday`, e.g. `const main = result.goldenBell ? ... : changed ? WORDS.thingTurned(changed) : WORDS.doneToday` (`src/games/parrot/ParrotGame.tsx:245`; same shape at `src/games/pigeon/PigeonGame.tsx:197`, `src/games/lizard/LizardGame.tsx:198`, `src/games/swamphen/SwamphenGame.tsx:235`, `src/games/robin/RobinGame.tsx:248`).
- Those strings all start "Well done!" (`src/games/pigeon/words.ts:23-24`, `src/games/parrot/words.ts:75-76`, `src/games/lizard/words.ts:37-38`, `src/games/swamphen/words.ts:29-30`, `src/games/robin/words.ts:69-70`).
- The result already holds the number we need: every finish result has `firstRight` (`src/games/pigeon/backend.ts:27`, `src/games/parrot/backend.ts:28`, `src/games/lizard/backend.ts:27`, `src/games/swamphen/backend.ts:27`, `src/games/robin/backend.ts:28`). The server sends it back from the replay (`shared/robin/server.ts:175`). It is the count of goes right on the first tap.
- The only other thing the finish says about how it went is the "next time" note (new step, less help, more help, or same again), `src/games/robin/RobinGame.tsx:251-255`. That is about the plan, not the round.

## 2. The rule behind it

LEARNING-DESIGN rule 7 (mistakes teach; kind words, "not yet", never shame; praise the strategy, not cleverness; the day still counts for under-8s, `docs/LEARNING-DESIGN.md:127-128`) and rule 1 (guessing must not look like success). Praise that is the same for every outcome stops meaning anything.

## 3. The change

**The day still counts.** Nothing about saving, the day count or the reward changes: a finished round still turns the leaf, basket, cluster, bundle or reed row, and a golden day is still golden. Only a new line is added; `main` (the reward line) stays as it is.

**Three lines, picked by `firstRight`.** The cut-offs reuse the ones the help ladder already uses (`ROUND_OF_TEN = { good: 8, hard: 4, ... }`, `shared/kit/help.ts:58`): 8 or more is "most right", 4 or fewer is "tricky today", in between is "some right". The lines praise what the child did, never "you are clever" or "you are bad at it". Wording per game (nouns change; these are the words to record):

| Band | Pigeon | Parrot | Lizard | Swamp Hen | Robin |
|---|---|---|---|---|---|
| Most right (8+) | You looked carefully and it paid off. | You worked those out. | You worked those bundles out. | You counted carefully. | You counted those carefully. |
| Some right (5-7) | Some were quick and some were tricky. The tricky ones help you grow. | (same) | (same) | (same) | (same) |
| Tricky today (0-4) | That was tricky today. We will go slowly and look together. | (same) | (same) | (same) | (same) |

The session may polish the words with James; keep them short, plain and in the games' voice. No scores, no "you got 3". Order on the screen and aloud: reward line, then this line, then the next-time note.

**A kit part, own branch.** One small pure helper in `shared/kit` (new file `shared/kit/finishBand.ts`): `finishBand(firstRight: number, goes = 10): 'most' | 'some' | 'tricky'`, using `ROUND_OF_TEN`. No game words, nothing about berries or birds. Exported from `shared/kit/index.ts`. One test (`shared/kit/kit.test.ts`): 10, 8 -> most; 7, 5 -> some; 4, 0 -> tricky. The kit part is general: the older games use the same helper in S33. No rebuilt function is needed unless a function bundles `shared/kit` (check with `npm run build:functions`; if any `index.ts` changes, commit it in the same PR).

**The game part (five, one PR each or one PR for all five; they share no code).** Each game's `words.ts` gets a `how: { most, some, tricky }` object; each `*Game.tsx` finish picks `WORDS.how[finishBand(result.firstRight)]` and shows it as a line above the next-time note, and `finishLine` in each `voiceLines.ts` includes it. `allVoiceLines()` must list every combination (the existing loops build each main x each next, e.g. `src/games/pigeon/voiceLines.ts:72-73`; add the three band lines to those loops). Because the heading and the new line are read as one spoken string, the number of clips multiplies: keep the spoken string as heading + band line + note and let the clip script make them (it already does for the existing combinations).

**New clips.** New Kokoro `af_bella` clips for every new spoken string, made on this Mac with `scripts/voice-clips.py` (`VOICE = 'af_bella'`, line 22), committed with each game. `voiceLines.test.ts` in each game fails until every line has a clip.

**For James to decide (not part of this plan unless James says so).** James may also want the reward held back when a round was mostly guessed (for example, no leaf turns when `firstRight` is 0). This plan does not do that: rule 7 says the day still counts, and holding it back would punish the child for a hard day. If James wants it, it is a separate change to the server finish (the reward is decided in `shared/<game>/server.ts` around the `changed` result, e.g. `shared/robin/server.ts:167-175`), and the finish words would need a fourth line.

## 4. Files affected

- Kit: `shared/kit/finishBand.ts` (new), `shared/kit/index.ts`, `shared/kit/kit.test.ts`. Own branch `kit-finish-band`.
- Per game: `src/games/<game>/words.ts`, `src/games/<game>/<Game>Game.tsx` (the finish component), `src/games/<game>/voiceLines.ts`, the new clips under the game's clip folder, and its `voiceLines.test.ts` is unchanged (it checks the new lines automatically).
- Game branch for the five: `finish-words-newer-five` (no `shared/maths`, `src/maths`, `src/styles.css`, `src/components`, `supabase/functions/_shared`).

## 5. Database / migration needs

None. `firstRight` is already returned by the server.

## 6. Test steps

Kit: one test (above). Games: none added beyond what exists; the voice-line test covers the clips. By hand in a preview: finish a round with all first taps right, one with a mix, and one all wrong; each shows its own line and still turns the reward; the day count goes up each time.

## 7. Size and impact

S to M: a helper, three lines of words, and clips for five games. Medium impact: it does not change what the child learns on the screen, but the words stop calling a guessed round "well done" and tell the child honestly where they are.

## 8. Session prompt (ready to paste)

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 7) and docs/plans/maths-review-2/S15-honest-finish-words.md. Do this in two PRs. (1) Kit: branch kit-finish-band from origin/main in a new worktree; add shared/kit/finishBand.ts (finishBand(firstRight, goes = 10) -> 'most' | 'some' | 'tricky', cut-offs from ROUND_OF_TEN in shared/kit/help.ts), export it, add one test in shared/kit/kit.test.ts, run npm run build:functions and commit any changed index.ts. Merge it when checks pass. (2) Games: branch finish-words-newer-five from main after (1); add a `how` object of three lines to words.ts in Pigeon, Parrot, Lizard, Swamp Hen and Robin (wording in the plan), show WORDS.how[finishBand(result.firstRight)] on each finish screen above the next-time note, include it in finishLine and allVoiceLines, and make the new af_bella clips with scripts/voice-clips.py. The day and the reward must not change. Do not hold back the reward (the plan flags that for James). Typecheck, test:changed, build; open a PR.
```
