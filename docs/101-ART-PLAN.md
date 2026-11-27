# 101: graphics upgrade plan

*Written 28 Nov 2026 NZ for James ("plan a graphical upgrade of 101 … make a list of the art you need but don't paint it yet, you can do everything else, animations, effects etc, you can add different card backs kids can unlock, you might be able to reuse some Bond Match stuff"). James paints the final art on his gaming PC (ComfyUI) in the evening; the game runs on drawn stand-ins until then, and they stay as the fallback.*

**Status: U.1, U.2 live 28 Nov 2026 (PR #981). All 17 pictures painted on JamesGaming 28 Nov 2026 (one try each; repainted: 6 backs and the knock burst; Pāua and Matariki needed new edge-to-edge "phone wallpaper" prompts) and U.3 birds wired, in the follow-up PR. Weak spots: the Kea back is a whole kea on leaves (cute, not a pattern); the felt painted pale lime, so CSS washes it green.**

## Where it was

101 (`src/games/card101/`) still looked like October: a green felt box with a brown border inside the red hub page, plain purple "101" card backs, emoji everywhere, white side panels, and only small CSS pops when a card changed. It was not full window. The home card is already painted (cards fanned on a wooden table at a seaside bach), so the game didn't match its card.

## The idea: card night at the bach

Match the home card. 101 is James's family card game, so the whole game is a family card night at a seaside bach.

- **Setup:** the bach deck by day: sky, sea and sand behind, a wooden table in front, a fan of cards showing your card back, and the settings on a wooden board.
- **Table:** looking down at a wooden bach table with a green felt card mat. The side panels are a **score pad** (cream paper, blue lines, a pencil-red margin).
- **Bots are birds:** Kea, Tūī and Weka sit at the table (painted portraits replace the random avatars once painted).
- **Finish:** the deck at dusk with fairy lights, a real three-step podium and confetti.
- **Card backs you can unlock:** ten backs, each earned by a 101 achievement (already earned on the server, so nothing new to cheat), plus one Bond Match crossover. Your back is used for every face-down card you see.

## Stages

Each stage is one PR, merged when green, live on its own. No migration, no server change, no shared file: everything is in `src/games/card101/`, `preview/101/` and `docs/`.

| Stage | What | Art that makes it look finished |
| --- | --- | --- |
| **U.1 Full window + bach look + card backs** | `.c101-window` full-window layer with its own ⌂ Hub and sound buttons; bach-day scene behind the setup (CSS sky, sea, sand and deck stand-in); wooden table and felt mat (CSS wood grain and felt); score-pad side panels; setup on a wooden board with a fan of your cards. **Card backs:** 10 backs drawn in code, a picker on the setup screen (locked backs show how to earn them and progress like 3 of 10), your pick remembered on the device, a "New card back!" moment on the podium and a "New" dot on the picker. `art.ts` loader. | `back-bach-day`, `wood`, `felt`, the 8 painted backs |
| **U.2 Animations and effects** | Deal: cards fly from the stack to every seat one by one. Drawing: the card flies from the pile to you, flipping over. Swapping: the new card flies into the spot, the old one flies to the discard pile. Peek: your bottom two cards flip up and back down. Knock: the table thumps, rings spread out from the knocker and a big banner drops in. End of round: hands flip over one by one, stamps for "PAIR", "3 CANCELS" and "PERFECT ZERO", the score bars fill. Round win: sparkles (Bond Match's painted sparkle). Game end: a three-step podium with confetti and a trophy. All off with reduced motion. | `knock-burst`, `trophy-gold` (tints make silver and bronze), `back-bach-evening` |
| **U.3 Birds at the table** | Bots show their bird (Kea, Tūī, Weka) instead of a random avatar once painted; until then the avatar stays. Screens checked at phone, iPad and laptop. What's new line. | `bird-kea`, `bird-tui`, `bird-weka` |

## Card backs

The pupil's achievements come from `my_progress()` (server-earned), so the browser only decides which unlocked back to *show*. The chosen back is remembered on the device (`sgh-101-back`); a back that is no longer unlocked (new season) falls back to Classic. In the preview every back is unlocked for trying.

| Back | Unlocked by | Drawn stand-in | Painted? |
| --- | --- | --- | --- |
| Classic | everyone | purple, gold dots, "101" | `back-classic` |
| Sea Glass | 🃏 Finish your first game of 101 | **Bond Match's painted sea-glass tile** on a deep teal back | uses Bond Match art (no painting needed) |
| Pōhutukawa | 🏆 Win a game of 101 | red pōhutukawa flowers on dark green | `back-pohutukawa` |
| Koru | 🔟 Finish 10 games of 101 | green and teal koru spirals | `back-koru` |
| Kea Feathers | ✊ Knock and win the round | olive feathers, orange underwing | `back-kea` |
| Pāua | 🎰 Get three of a kind | blue, green and violet shimmer swirls | `back-paua` |
| Matariki | 0️⃣ A hand worth exactly 0 | night sky with the Matariki star cluster | `back-matariki` |
| Big Wave | 3️⃣ Play a 3 to cancel a 10-point card | blue curling waves | `back-wave` |
| Golden Crown | 👫 Win against classmates | gold sunburst with a crown | `back-golden` |
| Rock Pool | 🦀 Finish a game of Bond Match (`bond-first`) | **Bond Match's painted Pip the crab** in a rock pool | uses Bond Match art (no painting needed) |

The painted back is the art *inside* the card's white border: the code draws the rounded white frame and clips the painting to it, so every back has the same edge and the painted ones can be swapped in one by one.

## Reused from Bond Match

- The painted **sea-glass tile** and **Pip waving** (two of the card backs, so they look finished today).
- The painted **sparkle** glow for round wins.
- The full-window pattern (`.bm-window`), the `HubButtons` corner buttons and the `art.ts` loader (pictures found by name; anything not painted keeps its drawn look).
- The `prefers-reduced-motion` rule: every movement is off when it is on.

## Art to paint (17 pictures)

Style: bright flat storybook, the same look as the home card and Bond Match, so the game matches its card. Full prompts are in `docs/101-art/config.json`. Check: `python3 scripts/game_art.py 101 paint OUT --dry-run`.

| Group | Names | Kind | Where it shows |
| --- | --- | --- | --- |
| Places | `back-bach-day`, `back-bach-evening` | scene | setup; podium |
| Table | `wood` (bach table planks), `felt` (green card mat) | texture | around and under the cards |
| Card backs | `back-classic`, `back-pohutukawa`, `back-koru`, `back-kea`, `back-paua`, `back-matariki`, `back-wave`, `back-golden` | icon (portrait, kept whole) | every face-down card |
| Birds | `bird-kea`, `bird-tui`, `bird-weka` | cut | the bots' seats, scores and podium |
| Effects | `knock-burst` | glow | the knock |
| Rewards | `trophy-gold` (tidy makes silver and bronze) | cut | the podium |

Paint the places, table and backs first (they make U.1 look finished), 2 to 4 tries each:

```
python3 scripts/game_art.py 101 paint ~/dragon-art-inbox/101-art/set back-bach-day wood felt back-classic back-pohutukawa back-koru back-kea back-paua back-matariki back-wave back-golden --tries 3
```

Then record picks in `docs/101-art/picks.json` and a thread runs `tidy` into `src/games/card101/art/paint/`, adds `CREDITS.md`, and checks each painted back reads well at the smallest size (the bots' cards on a phone are about 30 px wide).

## Things to be careful of

- **Card faces stay drawn in code.** Ranks and suits must be crisp and readable at 30 px; only backs, places and birds are painted.
- **No numbers or writing in any painting** (the Classic back's "101" is drawn on top in code).
- **Backs must read as "face down" at a glance:** busy patterns are fine, but each back keeps its white frame, and face-up cards stay white.
- **Readability:** the felt stays calm and darker than the cards; text on the felt keeps 4.5:1.
- **The table fits:** on a 1366 × 768 Chromebook the whole table and the score pad fit without scrolling; on phones nothing scrolls sideways.
- **Classmates games:** each pupil sees *their own* chosen back on every face-down card (nothing is sent to the server).
