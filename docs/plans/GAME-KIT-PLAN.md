# Game kit: one place for shared learning parts and resources

Status: K1 built (results below); K2 to K6 are plans. Written 7 Nov 2026. Goes with [docs/LEARNING-DESIGN.md](../LEARNING-DESIGN.md) (the rules) and [docs/GAME_DEVELOPMENT_GUIDE.md](../GAME_DEVELOPMENT_GUIDE.md) (how to build and go live).

## 1. The problem

Each new game copies the last one. The six Foundational games are clones of Hop with names swapped, so a fix (R1 to R8 in `docs/plans/maths-review/`) has to be made six times, and a new game copies whatever the last one got wrong.

What a code sweep found on 7 Nov 2026:

| Piece | Copies | How alike |
|---|---|---|
| Day arc (bronze, silver, gold, golden reward), `progress.ts` | Hop, Penguin Pairs, Pipi, Tūī, Weka (Beanstalk its own) | Near-identical; only nouns differ (`PADS`, `STONES`, `SHELLS`…). Hop's header says "share one file later". |
| Tap replay, first tap counts, `play.ts` | Hop, Penguin Pairs, Pipi, Tūī, Weka | Near-identical |
| Round scaffolding (`MAX_SEED`, `isSeed`, level share) in `round.ts` | all six | Near-identical scaffolding, game-specific questions |
| Load, start, finish, `server.ts` (~175 lines) and `src/data/<game>.ts` | all six | Same pattern, different code |
| Help levels and the fade / always / off setting | Weka (`helpForStats`), Tūī (`placeAfter`, 6 levels), Hop / Penguin Pairs / Pipi (`full`/`faint`/`none` by calendar), Quick looks (flash time) | Same idea, different code |
| Wrong choices | Beanstalk (`mistakeKind`, `hasNearMiss`, R5), Tūī (`reversalOf`), `earlyFacts.ts` (answer ± 1), Pipi | Same idea, different code |
| Ten-frames, number lines, dots | Tūī `art.tsx`, Weka `Pebbles.tsx`, Beanstalk `Leaf.tsx`, Quick looks `PictureSvg.tsx`, Hop `Hops.tsx` | Each draws its own |
| Hear it again, pointing hand, guided first go | each `Goes.tsx` (`kr-hand`, `wk-hand`, `tui-hand`, `pp-hand`…) | Same idea, different code |
| Next-step line / coach | Star Trader `coach/`, Clan Quest `nextStep.ts` | Two separate versions |
| `voiceLines.test.ts` (unique slugs, lines.json up to date, a clip per line, no spare clips) | all six + Quick looks | Near-identical |
| `teacher.ts` (26 lines) | all six | Near-identical |
| `scripts/<game>-art.py` (250 to 340 lines), `art.ts` loader | 6 junior + many others | Near-identical ("copied from korora-art.py"); junior games have no `art.test.ts` or `CREDITS.md` |

Already shared and working: `src/speech.ts` (`speak` with `onEnd`), `scripts/voice-clips.py`, `shared/juniorQuick.ts`, `shared/maths/leitner.ts`, `shared/maths/skillPacks/earlyFacts.ts`, `src/teacher/Hardest.tsx`, `src/components/NextPartChip.tsx`, `src/components/Progress.tsx`.

## 2. The idea

A **game kit**: shared parts a game imports instead of copying, so a better "show why" or a fairer help rule reaches every game at once, and a new game starts with the learning rules built in.

- **`shared/kit/`**, pure rules used by the browser, the server and the preview's trial backend:
  - `dayArc`: metals, days per metal, golden reward, `nzDate` days, `finishChallenge`.
  - `replay`: taps, first tap counts, the server replay check.
  - `help`: a help ladder (game names its own steps), the fade-and-return rule from LEARNING-DESIGN rule 5 (per fact like Weka, or per child like Tūī), the in-round struggle boost, the teacher override.
  - `mistakes`: wrong choices with a `kind`, the "at most 2 share the tell" check, the near-miss check, and the two-tap cap flow as a small state machine (tap 1 grey + why, tap 2 look together, redo).
  - `mastery`: "is this level secure" (70 percent of facts at box 2 or more) for moving up and for what's next.
- **`src/kit/`**, screens, each taking the game's own words, clip folder and CSS prefix:
  - Maths models in SVG: `TenFrame` (with highlighted, empty, extra and faint squares), `NumberLine` (arcs, labels, landmarks), `DotPicture`.
  - Junior bits: `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `ShowWhy` (plays the why line and highlights the model), `WhatsNext` card, `FirstTimeTip`.
  - A `voiceLinesSuite(game, allVoiceLines)` test helper that runs the four standard checks.
- **`docs/kit/README.md`**, the catalogue of resources: each kit part with a screenshot and which games use it; the voice-clip steps; the art pipeline; the **misconception bank** (one table per maths idea: misconception, kind tag, why line, what the picture does, from `research-maths.md` and LEARNING-DESIGN section 3); and a model gallery.
- **Tools:** one `scripts/game_art.py` that reads a per-game `docs/<game>-art/config.json` (picture list, prompts, sizes, cut-outs) instead of a new 300-line copy each time; `voice-clips.py` finds games from `public/voice/*/lines.json` instead of a hard-coded list.

## 3. Rules for the kit

- It's a shared area, like `shared/maths/`: **never changed from a game branch.** A change is its own small branch with its own PR.
- No game words inside it. Games pass their own lines, clip folder, colours and class prefix.
- One test per part at most (`docs/TESTING.md`), aimed at the rule (fade and step-up together, the cap, replay).
- Changing `shared/kit/` makes every server function that bundles it out of date: rebuild them all in the same PR (`npm run build:functions`) and check each "index.ts is up to date" test.
- No big-bang rewrite. A game moves onto a kit part when an R-plan or fix next touches it, and the move must change nothing the child sees unless that's the point of the PR.

## 4. Stages

Each stage is one branch, merged once checks pass (James's standing rule), with a "Stage K<n> results" note added here.

| Stage | What | Lifted from | First user | Size |
|---|---|---|---|---|
| **K1** | `shared/kit` `help`, `replay`, `dayArc` | Weka `helpForStats`, Tūī `placeAfter`, Hop `progress.ts` and `play.ts` | Weka moved onto it with no change seen; then R6 for Beanstalk, Hop, Penguin Pairs, Pipi | M |
| **K2** | `mistakes` + `ShowWhy` + misconception bank in `docs/kit/README.md` | Beanstalk R5 | Beanstalk moved over; then R5 for Hop, Penguin Pairs, Pipi, Tūī, Weka | M |
| **K3** | `TenFrame`, `NumberLine`, `DotPicture` | Tūī, Weka, Quick looks | New games N1 to N5 first; old games when next touched | M |
| **K4** | `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `WhatsNext`, `FirstTimeTip`, `voiceLinesSuite` | Weka, Penguin Pairs, Star Trader's `TipCard` | R8 (what's next) and new games | M |
| **K5** | Teacher Foundational helpers (class grid rows, stuck flags) | R7 plan | R7 | M, shared files (James's OK, as R7 says) |
| **K6** | `game_art.py` + config, `voice-clips.py` game list, `art.test.ts` and `CREDITS.md` for junior games | `korora-art.py`, `weka-art.py` | the next game painted | S |
| Later, maybe | A junior `server.ts` maker (load, start, finish) | the six `server.ts` | only after K1 and K2 prove the pattern | L, higher risk |

**Order with the maths-review plans:** K1 before R6, K2 before R5 for the other five games, K4 before R8, K5 is R7's first stage, K3 before N1. The R-plans and new-game plans carry a note pointing here.

## 5. What a new game does meanwhile

Until a kit part is merged, copy the best example named in LEARNING-DESIGN.md and write the piece so it could move into the kit later: pure functions with no game words inside, game words passed in.

## 6. Session prompt for K1 (ready to paste)

> Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 5) and docs/plans/GAME-KIT-PLAN.md. Build stage K1 of the game kit on a new branch `kit-help` from origin/main: `shared/kit/help.ts`, `replay.ts` and `dayArc.ts`, lifted from Weka's `helpForStats` (`shared/weka/round.ts`), Tūī's `placeAfter` (`shared/tui/round.ts`), and Hop's `progress.ts` and `play.ts`. Keep game words out (games pass their own step names and nouns). Then move Weka onto them with no change a child or teacher can see (same help per go on the same seeds: prove it with one test comparing old and new on many seeds, then drop the old code). At most 3 tests. Rebuild the functions that bundle the changed files. Typecheck, `test:changed`, build. Open a PR, merge once checks pass, add "Stage K1 results" to GAME-KIT-PLAN.md, and tell me in plain words what's ready and which game's R6 should use it next.

## 7. Stage K1 results (7 Nov 2026, branch `kit-help`)

**Built, `shared/kit/`:**
- `help.ts`: `helpForFact` (per fact: the game passes its own ladder, `FactRung`, with the numbers to pass each step), `fadeAfter` (per child, no steps; Beanstalk's R6 uses this) and `placeAfter` (per child, with steps), `helpWithSetting` (the teacher's fade, always, off), `STRUGGLE_GOES`, `ROUND_OF_TEN`.
- `replay.ts`: `replayTaps(goes, taps, { goesPerRound, oncePerFact })`. Weka and Tūī count a fact once a round (`oncePerFact: true`); Hop counts every hop (`false`). It also gives `firstRight`, for good and hard rounds.
- `dayArc.ts`: `arcAfter`, `finishDay`, `daysPerReward`, `nzDate`. The game keeps its own words (`streamAfter`, `lastStoneDay`) in a thin wrapper, because the saved columns and replies use them. Calendar help (Hop's `help`, `gold`) stays in the game until its R6.

**Decisions:**
- The boost and the teacher's setting went in although the prompt didn't name them: R6 uses both in all four games, and Weka now uses them too. Only the count and the rule are in the kit. Each game's screen still keeps its own streak.
- Levels run as Tūī's do: higher means more help. Beanstalk's R6 plan numbers its column the other way (0 full, 2 none), so it should convert, or number its column to match, when it uses `fadeAfter`.
- Weka's `Replay` now also has `firstRight`. Nothing sends it: the server reads only `done`, `answers` and `mistakes`.
- Not moved: Tūī, Hop and the others keep their own copies until an R-plan next touches them (section 3).

**Weka moved, nothing a child or teacher sees changes.** The old code was compared with the new before it was deleted: all 735 mixes of box, right count and quick days; 4,000 rounds on random records, days and levels (every go as shown, choices included); 16,000 runs of taps, including refused ones (same error words); 400 day counts with their finishes; and the NZ date. All the same. A digest of the old code's results stays in `shared/weka/weka.test.ts`.

**Tests: 3 new.** Help rules with fade and step-up together and every place a Tūī child can be (`shared/kit/kit.test.ts`); replay and day arc against Hop's and Tūī's own copies, so their moves are safe (same file); Weka's digest. Typecheck, `test:changed` (50 files, 585 tests) and the build pass. Only the `weka` function bundles the kit, so only it was rebuilt.

**Played in the preview:** with the teacher's help off on day 5, a full round to the finish (a stone turned bronze); then wrong first taps on three goes in a row, and on the third the pebbles came back (full help for the rest of the round). The guided first go still shows full help. No console errors.

**Next:** Hop's R6 is the best first user: it needs `helpForFact` with `full`, `faint`, `none`, and its `replayTaps` and `arcAfter` moves are already proved by the test. Then Penguin Pairs and Pipi. Beanstalk last, as it also needs a migration (and `fadeAfter`).
## 8. Stage K6 results (art tools, voice list, art checks)

Built 7 Nov 2026 on branch `kit-art-tools`. Nothing a child sees has changed, no picture was repainted and no old script was deleted.

**What is ready**
- **`scripts/game_art.py`**: one art script for every game. Run `python3 scripts/game_art.py <game> paint OUT_DIR [names]`, `... list` or (with rembg) `... tidy`. It reads `docs/<game>-art/config.json`: the style words, every picture's prompt, size and kind (`cut` = cut out of white, `scene` = kept whole with an 800 px copy, `card` = home page card), where each file goes, tints for recoloured copies (bronze and silver from gold), and the fixed seed rule. `--dry-run` on any command checks the config (names used twice, bad sizes, missing files, unknown tints) and prints the plan without contacting the gaming PC or writing a file. No game words are in the script.
- **Worked example: `docs/weka-art/config.json`**, converted from `scripts/weka-art.py`. Proved by comparing the old script's picture list with `game_art.py weka paint --dry-run --tries 3`: 27 pictures, same order, same prompts, sizes and seeds (81 of 81 tries identical), and every file `tidy` would write matches the 31 pictures already in the game plus the two home card files. `tidy` itself (cut-out with rembg) was only checked as a dry run here, because rembg is not installed on this computer: try `tidy --dry-run` and then a real `tidy` on a spare folder before relying on it.
- **`scripts/voice-clips.py`** now finds games from `public/voice/*/lines.json`. `--list` prints them (no Kokoro needed). It found the same nine games the old header listed (beanstalk, decree, hop, isles, korora, pipi, quick-looks, tui, weka) and no new ones. The old script never had a hard-coded list in code, only in its header, so recording behaviour is unchanged; a wrong name now says which games exist.
- **`src/games/art.test.ts`** (one test): every Foundational game's painted pictures are small `.webp` files and each art folder has a `CREDITS.md`. **`CREDITS.md`** added for Beanstalk, Hop, Penguin Pairs, Pipi, Tūī, Weka and Quick looks (Quick looks has no painted pictures in its art folder, only its home card), stating only what the repo shows. The image model's and rembg's licences are not recorded in the repo, so the files say so.
- No server function bundles any of these files, so no function rebuild was needed.

**What should use it next**: the next game painted (N1 to N5 or the next junior game). Copy `docs/weka-art/config.json` to `docs/<game>-art/config.json`, replace the style words, pictures and folders, run `--dry-run`, paint, pick, `tidy`. Do not write a new `<game>-art.py`. The old six junior scripts stay for now (`quick-looks-card-art.py` imports `weka-art.py`); move a game's settings across the next time its art is touched, as with every kit part.
