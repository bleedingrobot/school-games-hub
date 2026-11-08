# S33: Hop, Weka, Penguin Pairs, Pipi, Tūī, Beanstalk: honest finish words and praise about the strategy

**Game:** Hop, Weka, Penguin Pairs (korora), Pipi, Tūī, Kiwi's Beanstalk
**What's wrong:** The finish screen says "Well done! A lily pad turned bronze!" (or the same with a stone, shell, flower or leaf) however the day went, even after 9 wrong of 10 in Hop and 23 wrong of 33 taps in Weka and Penguin Pairs. The level-up line praises ability ("You are so good at this!"). Pipi's finish never says what is next.
**What done looks like:** The finish words depend on how many goes were right at the first tap: one set for a strong day, one for a middle day, one for a tricky day. None says "Well done" or "so good at this". The pad, stone, shell, flower or leaf still turns on any finished day. A level-up line praises practice. Pipi points on to Kiwi's Beanstalk once its top level is secure.
**Size:** M (six small parts, one per game, plus one tiny kit part; each part is S)
**Impact on learning:** Med
**Waits for:** S15 (honest finish words for the five newer games). Use S15's three bands and the way it gives the first-tap count to the finish screen. If S15 is not merged yet, Part 1 below builds the same pieces; do not build them twice.

## 1. The problem

What a child and a teacher see now:

- **The same words for every day.** Every game builds one title from the reward alone: Hop `WORDS.padTurned` (`src/games/hop/words.ts:52`), Weka `stoneTurned` (`src/games/weka/words.ts:62`), Penguin Pairs `pebbleTurned` (`src/games/korora/words.ts:75`), Pipi `shellTurned` (`src/games/pipi/words.ts:37`), Tūī `flowerTurned` (`src/games/tui/words.ts:53`), Beanstalk `leafTurned` (`src/games/beanstalk/words.ts:83`). Each starts "Well done!". The same goes for the replay line `doneToday` in all six (`hop/words.ts:53`, `weka/words.ts:63`, `korora/words.ts:76`, `pipi/words.ts:38`, `tui/words.ts:54`, `beanstalk/words.ts:84`).
- **The words ignore the result by design.** Hop's finish screen picks its title from the reward only (`src/games/hop/HopGame.tsx:202`). The same line in Weka (`WekaGame.tsx:192`), Penguin Pairs (`KororaGame.tsx:216`), Pipi (`PipiGame.tsx:193`), Tūī (`TuiGame.tsx:214`) and Beanstalk (`BeanstalkGame.tsx:245`). The finish result has no accuracy in it for Hop, Weka, Penguin Pairs, Pipi or Beanstalk (`HopFinish` `src/games/hop/backend.ts:27-32`, `WekaFinish` `src/games/weka/backend.ts:23-27`, `PipiFinish` `src/games/pipi/backend.ts:25-29`). Tūī's result does carry `firstRight` (`src/games/tui/backend.ts:24-26`, set at `shared/tui/server.ts:166`) but its screen does not use it.
- **What the evaluators saw.** Hop: "Well done! A lily pad turned bronze" after 9 wrong of 10 (`docs/reviews/maths-review-2/games/hop.md:44`, `:124`). Weka: 33 taps, 23 wrong, bronze stone, and only 3 of 8 facts right (`games/weka.md:46`). Penguin Pairs: the same 33 taps, 23 wrong (`games/korora.md:111`). Tūī and Beanstalk: generic "Well done" (`games/tui.md:62`, `games/beanstalk.md:70`, `:126`).
- **Level-up praise is about ability.** "You are so good at this!" in Hop (`hop/words.ts:54`), Weka (`weka/words.ts:64`), Penguin Pairs (`korora/words.ts:77`), Pipi (`pipi/words.ts:39`) and Tūī (`tui/words.ts:55`).
- **Pipi says nothing about what is next.** Its finish panel is its own copy of a panel (`src/games/pipi/PipiGame.tsx:196-226`), not the kit's `WhatsNext`. Level 3 is the end of the ladder and the child stays there for ever (`shared/pipi/round.ts:67-73`; `games/pipi.md:13`, `:164`). Hop, Penguin Pairs, Tūī and Beanstalk already point on when their top is secure (Hop `HopGame.tsx:205`, Tūī `TuiGame.tsx:233`, Penguin Pairs `KororaGame.tsx:238`, Beanstalk `BeanstalkGame.tsx:276`).

## 2. The rule behind it

LEARNING-DESIGN **rule 7** (mistakes teach): kind words, "not yet", never shame, and praise the strategy, not cleverness. The same rule says the day still counts for under-8s, so the reward is still paid. Only the words change. It also serves **rule 10** (rewards celebrate real success) and **rule 6** (say what's next at the top of the ladder).

## 3. The change

### 3.1 How the screen knows how the day went

"Right" means a go right at the first tap, out of the ten goes. Every one of these games has exactly ten goes a round: Hop `HOPS_PER_ROUND = 10` (`shared/hop/round.ts:24`), Weka `shared/weka/round.ts:28`, Penguin Pairs `shared/korora/round.ts:28`, Pipi `shared/pipi/round.ts:23`, Tūī `shared/tui/round.ts:21`, Beanstalk `PAIRS_PER_ROUND = 10` (`shared/beanstalk/round.ts:21`).

The server already replays every tap, so it can count. Add `firstRight` to each game's finish reply (Tūī has it already):

- **Weka:** its replay is the kit's `replayTaps`, which already returns `firstRight` (`shared/kit/replay.ts:25-26`, `:55-56`; used at `shared/weka/play.ts:20`). Add `firstRight: played.firstRight` to the reply at `shared/weka/server.ts:173`.
- **Hop, Penguin Pairs, Pipi:** each has its own copy of the replay without `firstRight` (`shared/hop/play.ts:27-45`, `shared/korora/play.ts:28-50`, `shared/pipi/play.ts:27-45`). Add a `firstRight` counter in the same place as `mistakes` (count a go when the first tap of the go is right, not once per fact). Return it from the finish reply (`shared/hop/server.ts:166`, `shared/korora/server.ts:172`, `shared/pipi/server.ts:167`).
- **Beanstalk:** the server already counts it for the dots: `played.answers.filter((a) => a.correct).length` (`shared/beanstalk/server.ts:165`). Return that number as `firstRight` at `:174`. Beanstalk records one answer per go, so the count is out of ten.
- Add `firstRight: number` to each game's finish type: `src/games/hop/backend.ts`, `weka/backend.ts`, `korora/backend.ts`, `pipi/backend.ts`, `beanstalk/backend.ts`. The preview ("trial") backends run the same server code, so they get it too.

A reply from an older server without `firstRight` must still work: treat a missing number as the middle band (no tricky or strong words).

### 3.2 The three bands (thresholds)

Use the numbers already in the kit for "good round" and "hard round": `ROUND_OF_TEN = { good: 8, hard: 4 }` (`shared/kit/help.ts:58`). They are the same numbers the help rule uses (`fadeAfter`, `shared/kit/help.ts:71-83`), so the words match what the game does next.

| Band | Goes right at the first tap (of 10) |
|---|---|
| Strong | 8, 9 or 10 |
| Middle | 5, 6 or 7 |
| Tricky | 0, 1, 2, 3 or 4 |

### 3.3 The words

Each finish title is **band opening + reward tail**. Rules for every line: no "Well done", no "so good", no number in the spoken line (a number per line would need hundreds of recorded clips; the written chip can show "7 of 10 right the first time" on screen only), kind, honest, short.

The reward tail is what the game says now, minus "Well done!": "A lily pad turned bronze." on a pad day, or "Come back tomorrow to change another lily pad." on a replay day (`doneToday`). The prize days (Golden Glow Jar, Golden Picnic Basket, Golden Pearl, Golden Nest, Golden Egg, the penguin's shoes) keep their prize title as it is. It is true and it is for 30 finished days. The band sentence goes in the small chip under the title on those days.

| Game | Strong (8 to 10) | Middle (5 to 7) | Tricky (0 to 4) |
|---|---|---|---|
| Hop | You counted your hops carefully! | Some hops were tricky and you kept going. | Those were tricky hops. |
| Weka | You hopped to ten and then on! | Some were tricky and you kept going. | Those were tricky ones. |
| Penguin Pairs | You worked out your doubles and halves! | Some were tricky and you kept going. | Those were tricky ones. |
| Pipi | You found the hiding pipi! | Some were tricky and you kept going. | Those were tricky ones. |
| Tūī | You spotted the ten in each number! | Some were tricky and you kept going. | Those were tricky ones. |
| Beanstalk | You found the pairs that fit! | Some were tricky and you kept going. | Those were tricky ones. |

Example, Hop, tricky, pad day: "Those were tricky hops. A lily pad turned bronze." Example, Weka, strong, replay day: "You hopped to ten and then on! Come back tomorrow to change another stone."

**One extra line in the chip on a tricky day.** Hop, Weka, Penguin Pairs and Pipi keep help per fact. A wrong first tap drops the fact to box 1 and its full help comes back (`shared/hop/round.ts:146-151` and the `helpForFact` rule, `shared/kit/help.ts:37-42`; Penguin Pairs `shared/korora/round.ts:101-106`; Pipi `shared/pipi/round.ts:84-89`). So for these four the chip says: "The tricky ones will come back with more help." Tūī and Beanstalk move help one step for the child, and only on the first finish of a day (`shared/tui/server.ts:155`; Beanstalk `server.ts:165`, "on the day's first finish only"). A replay would not bring help back, so for those two the chip says: "Tricky ones are good practice. We will try again tomorrow."

**The level-up line** (shown when the level or step moved, `up` in each finish screen). Replace "You are so good at this!" with practice praise:

- Hop: "Your counting practice is paying off. Next time we count in {fives}." (the `wordOf(step)` already used at `hop/words.ts:54`)
- Weka: "Making ten first is paying off. Next time: {starting on 8}."
- Penguin Pairs: "Your practice is paying off. Next time: {halves to 10}."
- Pipi: "Your practice is paying off. Next time the pipi families are {6 and 7}."
- Tūī: "Your practice is paying off. Next time: {step name}."

Beanstalk has no level-up line to change.

### 3.4 Build steps (shared pieces first)

1. **A tiny kit part (own small branch).** New file `shared/kit/finishBand.ts`: `type FinishBand = 'strong' | 'middle' | 'tricky'` and `finishBand(firstRight: number | undefined): FinishBand`, built on `ROUND_OF_TEN` (`shared/kit/help.ts:58`); a missing number gives `'middle'`. No game words in it. It needs `npm run build:functions` only if a function imports it; the finish words are browser-side, so none does, but run `npm run build:functions` to be sure the bundle is unchanged. Skip this step if S15 already added the same function; reuse its name.
2. **For each game** (own branch each): add `firstRight` to the replay and the finish reply (3.1), add the band words to `words.ts` as a function `finishOpening(band)`, change the title and chip in the finish screen, update `voiceLines.ts` so `allVoiceLines()` lists every new combination (title by band by reward, the chip lines, the level-up lines), rewrite the clip list with `WRITE_VOICE_LINES=1 npx vitest run src/games/<game>/voiceLines.test.ts` and make the new clips on James's Mac with `scripts/voice-clips.py <game>` (`docs/GAME_DEVELOPMENT_GUIDE.md:47`). The voice test checks that every line has a clip and that no old clip is left (`src/kit/voiceLinesSuite.ts:35-60`), so delete the "Well done" clips.
3. **Pipi's what's next** (Part 5): add `topSecure` to the finish reply, as Penguin Pairs does (`shared/korora/round.ts:83`, returned at `shared/korora/server.ts:172`). For Pipi: `levelShare(stats, 3) >= STEP_SECURE_SHARE`, from `withAnswers(facts, answers)` (`shared/pipi/server.ts:102-107`, level share at `shared/pipi/round.ts:60-64`). Swap Pipi's own panel for the kit's `WhatsNext` with prefix `pp` (it needs `pp-panel`, `pp-chip`, `pp-play-button`, which Pipi's CSS already has at `src/games/pipi/pipi.css:92`, `:101`, `:102`). Copy Tūī's pattern for the card (`TuiGame.tsx:212-244`): read Kiwi's Beanstalk's class switch with `fetchBeanstalkEnabled` (`src/games/beanstalk/switch.ts:3`), show the card only when level 3 is secure, the child did not just move up and Beanstalk is on. Words: "You know your pairs to ten. Try Kiwi's Beanstalk." and the button "Try Kiwi's Beanstalk". The button goes to `/beanstalk` (routes come from the game id, `src/App.tsx:107`; Tūī does `navigate('/weka')` the same way, `src/games/tui/TuiPlay.tsx:11`). Add the two new lines to Pipi's `allVoiceLines()`.

## 4. Files affected

Shared kit (own small branch and PR): `shared/kit/finishBand.ts` (new), its test in `shared/kit/kit.test.ts`.

Per game (own folder only; a `shared/<game>` folder is the game's own):
- Hop: `shared/hop/play.ts`, `shared/hop/server.ts`, `src/games/hop/backend.ts`, `words.ts`, `HopGame.tsx`, `voiceLines.ts`, `public/voice/hop/*`, rebuilt `supabase/functions/hop/index.ts`.
- Weka: `shared/weka/server.ts`, `src/games/weka/backend.ts`, `words.ts`, `WekaGame.tsx`, `voiceLines.ts`, `public/voice/weka/*`, rebuilt `supabase/functions/weka/index.ts`.
- Penguin Pairs: `shared/korora/play.ts`, `server.ts`, `src/games/korora/backend.ts`, `words.ts`, `KororaGame.tsx`, `voiceLines.ts`, `public/voice/korora/*`, rebuilt `supabase/functions/korora/index.ts`.
- Pipi: `shared/pipi/play.ts`, `server.ts`, `round.ts` (a `topSecure`), `src/games/pipi/backend.ts`, `words.ts`, `PipiGame.tsx`, `PipiPlay.tsx`, `voiceLines.ts`, `public/voice/pipi/*`, rebuilt `supabase/functions/pipi/index.ts`.
- Tūī: `src/games/tui/words.ts`, `TuiGame.tsx`, `voiceLines.ts`, `public/voice/tui/*`. No server change (it already returns `firstRight`).
- Beanstalk: `shared/beanstalk/server.ts`, `src/games/beanstalk/backend.ts`, `words.ts`, `BeanstalkGame.tsx`, `voiceLines.ts`, `public/voice/beanstalk/*`, rebuilt `supabase/functions/beanstalk/index.ts`. Update `src/games/beanstalk/ladder.test.tsx:75`, which looks for the heading "Well done".

Never touch `shared/maths`, `src/maths`, `src/styles.css` or `src/components`.

## 5. Database / migration needs

None. Nothing new is saved: the first-tap count comes from the taps the server already replays. Functions are rebuilt per game with `npm run build:functions -- <game>`; they deploy when the PR merges (`docs/GAME_DEVELOPMENT_GUIDE.md:171`, `:342`).

## 6. Test steps

Inside the 8-per-game limit; add only what is listed.

- **Kit:** one test: `finishBand` gives strong for 8, 9, 10; middle for 5, 6, 7; tricky for 0 to 4; middle when missing.
- **Each game, two tests:** (1) the finish reply carries `firstRight` that matches a replay with a known mix of right and wrong first taps (tap-all gives 3 of 10, a clean round gives 10); (2) the finish screen shows the strong opening for 10, the tricky opening plus the chip for 3, and never "Well done" or "so good at this" (a pad day and a replay day).
- **Pipi, one more:** the card shows only when level 3 is secure and Beanstalk is on, and not on a level-up day.
- **Existing tests:** `src/games/beanstalk/ladder.test.tsx:75` and any test that reads the old title. Run `npx vitest run src/games/<game>` and the voice test.

By playing the preview (use the preview buttons for the day, as the evaluators did): tap the first choice every go and check the tricky words and the chip; answer all right and check the strong words; check that the pad still turns after the tricky day (rule 7: the day still counts); check that no "Well done" is heard or shown on any finish.

## 7. Size and impact

Each game is a small change to its words, its finish screen and one number in the reply, plus clips; Pipi adds a card. Med impact: it does not change the maths, but it stops the game telling a child who tapped everything that they did well, and it makes the teacher's gold row less misleading.

## 8. Session prompt (ready to paste)

Run the parts one after another, each in a fresh session. Part 1 first (skip if S15 is merged and already has the band function). Parts 2 to 7 can follow in any order.

### Part 1: the kit part (finish bands)

```text
Create a branch from origin/main called kit-finish-band (own small kit branch and PR; use a worktree). Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 7) and docs/plans/maths-review-2/S33-honest-finish-words-older-games.md. First check whether S15 (docs/plans/maths-review-2/S15-*.md) has already merged a finish-band function in shared/kit; if it has, stop and tell James.
Steps: 1) add shared/kit/finishBand.ts with type FinishBand = 'strong' | 'middle' | 'tricky' and finishBand(firstRight: number | undefined) built on ROUND_OF_TEN in shared/kit/help.ts (strong 8 to 10, middle 5 to 7, tricky 0 to 4, missing gives middle). No game words in it. 2) add one test in shared/kit/kit.test.ts. 3) run npm run build:functions and check no function bundle changed unexpectedly. 4) run npx vitest run shared/kit and npm run build.
Tests: one test for the three bands and the missing case.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Hop

```text
Create a branch from origin/main called finish-words-hop (use a worktree). Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 7 and 10) and docs/plans/maths-review-2/S33-honest-finish-words-older-games.md (sections 3.1 to 3.4 and the Hop column). Do not touch shared/maths, src/maths, src/styles.css or src/components. The kit file shared/kit/finishBand.ts must already be merged (S33 Part 1 or S15); if not, stop and tell James.
Steps: 1) in shared/hop/play.ts count firstRight (goes right at the first tap) beside mistakes; return it from the finish reply in shared/hop/server.ts; add firstRight to HopFinish in src/games/hop/backend.ts. 2) in src/games/hop/words.ts replace padTurned and doneToday with band openings plus tails (no "Well done"), add the tricky chip line, and change stepUp to "Your counting practice is paying off. Next time we count in {step}." 3) in HopGame.tsx build the title and chip from finishBand(result.firstRight); prize days keep the jar title and put the band line in the chip; keep the signpost. 4) update voiceLines.ts allVoiceLines for every new combination, run WRITE_VOICE_LINES=1 npx vitest run src/games/hop/voiceLines.test.ts, delete the old clips and make the new ones with scripts/voice-clips.py hop on James's Mac (ask James to run it if you cannot). 5) npm run build:functions -- hop.
Tests (inside the 8-per-game limit): the reply carries the right firstRight for a known mix of taps; the finish screen shows the strong words for 10, the tricky words and chip for 3, and never "Well done". Check by playing the preview that the pad still turns after a tricky day.
Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Weka

```text
Create a branch from origin/main called finish-words-weka (use a worktree). Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 7 and 10) and docs/plans/maths-review-2/S33-honest-finish-words-older-games.md (sections 3.1 to 3.4 and the Weka column). Do not touch shared/maths, src/maths, src/styles.css or src/components. shared/kit/finishBand.ts must already be merged; if not, stop and tell James.
Steps: 1) return firstRight: played.firstRight from the finish reply in shared/weka/server.ts (the kit replay already counts it); add it to WekaFinish in src/games/weka/backend.ts. 2) in src/games/weka/words.ts replace stoneTurned and doneToday with band openings plus tails (no "Well done"), add the tricky chip line ("The tricky ones will come back with more help."), and change levelUp to "Making ten first is paying off. Next time: {level words, lower case}." 3) in WekaGame.tsx build the title and chip from finishBand(result.firstRight); the Golden Picnic Basket day keeps its title and shows the band line in the chip. 4) update voiceLines.ts finishLine and allVoiceLines (it loops mains by level-ups, around line 84), rewrite lines.json with WRITE_VOICE_LINES=1, delete old clips, make new clips with scripts/voice-clips.py weka on James's Mac. 5) npm run build:functions -- weka.
Tests: the reply carries firstRight for a tap-all round (3 of 10) and a clean round (10); the finish screen shows strong and tricky words and never "Well done". Check by playing the preview that the stone still turns after a tricky day.
Stop and tell James before any live step. Open a PR when done.
```

### Part 4: Penguin Pairs

```text
Create a branch from origin/main called finish-words-korora (use a worktree). Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 7 and 10) and docs/plans/maths-review-2/S33-honest-finish-words-older-games.md (sections 3.1 to 3.4 and the Penguin Pairs column). Do not touch shared/maths, src/maths, src/styles.css or src/components. shared/kit/finishBand.ts must already be merged; if not, stop and tell James.
Steps: 1) in shared/korora/play.ts count firstRight (goes right at the first tap, not once per fact) beside mistakes; return it from the finish reply at shared/korora/server.ts (the line that returns level, levelBefore and topSecure); add firstRight to KororaFinish in src/games/korora/backend.ts. 2) in src/games/korora/words.ts replace pebbleTurned and doneToday with band openings plus tails (no "Well done"), add the tricky chip line, and change levelUp to "Your practice is paying off. Next time: {level words, lower case}." 3) in KororaGame.tsx build the title and chip from finishBand(result.firstRight); the shoes and golden-fish days keep their titles and show the band line in the chip; keep the Weka card. 4) update voiceLines.ts, rewrite lines.json with WRITE_VOICE_LINES=1, delete old clips, make new clips with scripts/voice-clips.py korora on James's Mac. 5) npm run build:functions -- korora.
Tests: the reply carries firstRight for a tap-all round (3 of 10) and a clean round (10); the finish screen shows strong and tricky words and never "Well done". Check by playing the preview that the stone still turns after a tricky day.
Stop and tell James before any live step. Open a PR when done.
```

### Part 5: Pipi (words and what's next)

```text
Create a branch from origin/main called finish-words-pipi (use a worktree). Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 6, 7 and 10) and docs/plans/maths-review-2/S33-honest-finish-words-older-games.md (sections 3.1 to 3.4 and the Pipi column). Do not touch shared/maths, src/maths, src/styles.css or src/components. shared/kit/finishBand.ts must already be merged; if not, stop and tell James.
Steps: 1) in shared/pipi/play.ts count firstRight beside mistakes; in shared/pipi/round.ts add topSecure(stats) = levelShare(stats, 3) >= STEP_SECURE_SHARE (as shared/korora/round.ts:83 does); return both from the finish reply in shared/pipi/server.ts (use withAnswers(facts, answers)); add them to PipiFinish in src/games/pipi/backend.ts. 2) in src/games/pipi/words.ts replace shellTurned and doneToday with band openings plus tails (no "Well done"), add the tricky chip line, change levelUp to "Your practice is paying off. Next time the pipi families are {level words}.", and add whatsNext "You know your pairs to ten. Try Kiwi's Beanstalk." and the button words "Try Kiwi's Beanstalk". 3) in PipiGame.tsx replace the hand-made panel (lines 196 to 226) with the kit's WhatsNext (src/kit/WhatsNext.tsx, prefix "pp"), copying the card pattern in TuiGame.tsx (fetchBeanstalkEnabled from src/games/beanstalk/switch.ts; the card shows only when level 3 is secure, the child did not just level up and Beanstalk is on); PipiPlay.tsx passes onOpenBeanstalk={() => navigate('/beanstalk')}. The Golden Pearl day keeps its title and shows the band line in the chip. 4) update voiceLines.ts, rewrite lines.json with WRITE_VOICE_LINES=1, delete old clips, make new clips with scripts/voice-clips.py pipi on James's Mac. 5) npm run build:functions -- pipi.
Tests: the reply carries firstRight; the finish screen shows strong and tricky words and never "Well done"; the Beanstalk card shows only when level 3 is secure and Beanstalk is on. Check by playing the preview that the shell still turns after a tricky day.
Stop and tell James before any live step. Open a PR when done.
```

### Part 6: Tūī

```text
Create a branch from origin/main called finish-words-tui (use a worktree). Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 7 and 10) and docs/plans/maths-review-2/S33-honest-finish-words-older-games.md (sections 3.2 to 3.4 and the Tūī column). Do not touch shared/maths, src/maths, src/styles.css or src/components. shared/kit/finishBand.ts must already be merged; if not, stop and tell James.
Steps: 1) no server change: the finish reply already has firstRight (shared/tui/server.ts:166, TuiFinish in src/games/tui/backend.ts). 2) in src/games/tui/words.ts replace flowerTurned and doneToday with band openings plus tails (no "Well done"), add the tricky chip line "Tricky ones are good practice. We will try again tomorrow." (Tūī moves help for the child on the first finish of a day only), and change nextStep to "Your practice is paying off. Next time: {step name, lower case}". 3) in TuiGame.tsx build the title and chip from finishBand(result.firstRight); the Golden Nest day keeps its title and shows the band line in the chip; keep the Weka card. 4) update voiceLines.ts finishLine and allVoiceLines, rewrite lines.json with WRITE_VOICE_LINES=1, delete old clips, make new clips with scripts/voice-clips.py tui on James's Mac. Update src/games/tui/finishCard.test.tsx if it reads the old words.
Tests: the finish screen shows strong and tricky words and never "Well done"; the Weka card still shows when the top step is secure. Check by playing the preview that the flower still turns after a tricky day.
Stop and tell James before any live step. Open a PR when done.
```

### Part 7: Beanstalk

```text
Create a branch from origin/main called finish-words-beanstalk (use a worktree). Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 7 and 10) and docs/plans/maths-review-2/S33-honest-finish-words-older-games.md (sections 3.1 to 3.4 and the Beanstalk column). Do not touch shared/maths, src/maths, src/styles.css or src/components. shared/kit/finishBand.ts must already be merged; if not, stop and tell James.
Steps: 1) in shared/beanstalk/server.ts return firstRight (the count already worked out at line 165 for the dots: played.answers.filter((a) => a.correct).length) in the finish reply; add firstRight to FinishResult in src/games/beanstalk/backend.ts. 2) in src/games/beanstalk/words.ts replace leafTurned and doneToday with band openings plus tails (no "Well done"; keep the sentence "You can play as much as you like, but only one leaf will change a day."), and add the tricky chip line "Tricky ones are good practice. We will try again tomorrow." 3) in BeanstalkGame.tsx build the title and chip from finishBand(result.firstRight); the Golden Egg day keeps its title and shows the band line in the chip; keep the Weka card. 4) update voiceLines.ts, rewrite lines.json with WRITE_VOICE_LINES=1, delete old clips, make new clips with scripts/voice-clips.py beanstalk on James's Mac. 5) npm run build:functions -- beanstalk. Update src/games/beanstalk/ladder.test.tsx:75, which looks for the heading "Well done".
Tests: the reply carries firstRight; the finish screen shows strong and tricky words and never "Well done". Check by playing the preview that the leaf still turns after a tricky day.
Stop and tell James before any live step. Open a PR when done.
```
