# Bond Match: graphics upgrade plan

Written 21 Nov 2026 for James. **Status: L.1 done 21 Nov 2026 (full window, painted beach, rock-pool picker). Also painted ahead for L.2: both pool backs, card-back (+ blue/violet tints) and card-stone. Next is L.2 (the cards).** Art list ready to paint: `docs/bond-match-art/config.json`.

## Where it is now

Bond Match (`src/games/bond-match/`) still looks like October: a white box inside the red hub page, teal-to-violet card
backs with a "+", plain white card faces, emoji for players (🙂 😃 🤖) and buttons (⏱️ 📊). It has **no painted art at
all** apart from its home card (glowing number stones in rock pools on a sunny beach). It is the only easy-maths game
that isn't full window.

## What the game guide says that matters here

- **Full window** is the default for every game (James, 18 Nov): one fixed layer over the hub bar, paintings edge to edge
  at `100dvh`, the game's own ⌂ Hub and sound buttons (`docs/game-guide/3-files-and-clashes.md`, copy `.cq-window`).
- **Drawn art first, kept as the fallback for good.** The game must look right before anything is painted, and anything
  not painted keeps its CSS look (`6-art-voice-cards.md`).
- **One art script:** `scripts/game_art.py bond-match …` with `docs/bond-match-art/config.json`. James paints on the
  gaming PC into the inbox, records picks in `picks.json`, a later thread runs `tidy` into `src/games/bond-match/art/paint/`
  and adds `CREDITS.md`; `src/games/art.test.ts` checks nothing is missing or spare.
- **No waiting** for art or screenshot approval: build with stand-ins, carry on to live.
- **Hub rules still hold inside the game:** own `.bm-` classes only, 44 px targets, 4.5:1 contrast, focus rings,
  reduced motion respected. A card stays at least 64 px.
- **Bella voice for every game** (`voiceLines.ts`, voice-lines test, Kokoro clips). Bond Match has none yet. Stage L.6
  below.
- **Game keys:** keep the arrow keys and Enter/Space on the board; add Esc = back and 1–3 on the picker if missing
  (kit `useGameKeys`, memory note game-keys).
- **What's new line** in `src/news/hubNews.ts` when pupils will notice it.
- Nothing here touches the server, the engine in `shared/bond-match/`, the database or shared files, so **no migration
  and no function rebuild**. All changes sit in `src/games/bond-match/` and `docs/`.

## The idea: the Rock Pool

Match the home card. The whole game is a sunny rock-pool beach.

- **Picker:** a wide painted beach. The three shelves become three rock pools (Whole numbers, Decimals, Fractions), each
  bond a smooth stone with its target painted in code on top. Board size and "Who's playing?" sit on a driftwood strip.
- **Board:** looking down into a big calm rock pool. **Card backs are painted sea-glass tiles** (one picture, tinted
  teal / blue / violet per shelf); **card faces are pale smooth beach stones** with the number drawn in code (never
  painted, so fractions and decimals stay sharp). A matched pair glows in its pair colour with a ripple, then settles.
- **Mismatch:** both stones give a small wobble and a splash; the "3 + 4 = 7, we need 10" line sits on a driftwood sign.
- **Finish:** stars become **gold, silver and bronze starfish** (one painting, tinted by `tidy`), on the pool's edge
  at sunset. Versus finish shows the winner's shell bucket.
- **A helper: Pip the crab**: waves on the picker, scuttles on a match, holds the finish sign,
  and is the computer player instead of 🤖. Never says or points at an answer.
- **Day and evening pools:** Large boards use the evening pool, so the bigger board feels like a step up.

## Stages

Each stage is one PR, merged when green, live on its own (switches on by default).

| Stage | What | Art needed to look finished |
| --- | --- | --- |
| **L.1 Full window + beach** | `.bm-window` full-window layer, own ⌂ Hub and sound buttons, beach scene behind the picker with a CSS sky/sand stand-in, rock-pool shelves, driftwood setup strip; game bar restyled; board area sized from the full `100dvh` (the board must still fit 4×5 on a phone and a Chromebook without scrolling). `art.ts` loader (`import.meta.glob`, copy Penguin Pairs). | `back-beach` |
| **L.2 Cards** | Sea-glass backs (CSS gradient stand-in) and stone faces; per-shelf tints; matched-pair glow ring kept in the 10 pair colours (contrast checked); ripple on match, wobble on mismatch, all off with reduced motion. Board sits in the painted pool. | `back-pool-day`, `back-pool-evening`, `card-back`, `card-stone`, `ripple`, `sparkle` |
| **L.3 Finish** | Starfish stars that pop in one by one, painted sunset edge behind, new-best burst; versus finish with shell buckets and the winner's name. | `back-sunset`, `starfish-gold` (+ silver, bronze by tint), `bucket` |
| **L.4 Pip the crab** | Pip on picker, board corner and finish; replaces 🤖 as the computer; players get painted shell badges instead of 🙂 😃. | `pip-wave`, `pip-cheer`, `pip-think`, `shell-pink`, `shell-blue` |
| **L.5 Icons and polish** | Painted icons for the timer and fraction-picture toggles and the three shelves; keys check (Esc, 1–3); What's new line; screens checked at phone, iPad and laptop. | `icon-timer`, `icon-pictures`, `shelf-whole`, `shelf-decimal`, `shelf-fraction` |
| **L.6 Bella voice** | `voiceLines.ts` from `strings.ts`, the kit voice-lines test, clips. Reads the goal ("Make 10"), the mismatch line and the finish. Never reads a card's partner. | none |

L.1 and L.2 are the big visible change; L.3–L.5 are smaller. The art can be painted at any point: each picture shows up as
soon as it's tidied in.

## Art to paint (20 pictures)

Style: bright flat storybook, the same look as the home card and Marble Rush courses, so the game matches its card.
Full prompts are in `docs/bond-match-art/config.json`. Check: `python3 scripts/game_art.py bond-match paint OUT --dry-run`.

| Group | Names | Kind |
| --- | --- | --- |
| Places | `back-beach`, `back-pool-day`, `back-pool-evening`, `back-sunset` | scene |
| Cards | `card-back` (sea-glass tile), `card-stone` (blank pale stone) | cut |
| Effects | `ripple`, `sparkle` | glow |
| Rewards | `starfish-gold` (tidy makes silver and bronze), `bucket` | cut |
| Pip | `pip-wave`, `pip-cheer`, `pip-think` | cut |
| Players | `shell-pink`, `shell-blue` | cut |
| Icons | `icon-timer`, `icon-pictures`, `shelf-whole`, `shelf-decimal`, `shelf-fraction` | cut |

Paint Places and Cards first (they make L.1 and L.2 look finished), 2 to 4 tries each:

```
python3 scripts/game_art.py bond-match paint ~/dragon-art-inbox/bond-match-art/set back-beach back-pool-day card-back card-stone --tries 3
```

## Things to be careful of

- **Numbers stay crisp.** No number, fraction or writing is ever painted; card stones are blank and numbers sit on top in
  code. Fractions keep their stacked look and optional bar picture.
- **Readability on the projector and Chromebooks.** Card faces stay pale with dark numbers; the pool behind the board is
  calm in the middle; matched colours keep a dark ring so pairs are told apart by more than colour.
- **Board fits.** 20 cards (Large) must fit `100dvh` with the bar and the line under it, cards at least 64 px.
- **Picture weight.** Scenes load the 800 px copy on phones; only addresses are bundled.
- **Existing tests** in `src/games/bond-match/` and `src/teacher/Games.test.tsx` keep passing; add only what the guide's
  test budget allows (full-window layer renders, painted back falls back to the CSS one).

## James's choices (21 Nov 2026)

1. **Rock Pool look:** yes.
2. **Pip the crab:** yes, so L.4 is in.
3. **Bella voice:** yes, as the last stage (L.6).
