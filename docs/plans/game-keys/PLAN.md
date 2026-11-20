# Keyboard keys in every game

James, 20 Nov 2026: "Plan and do the keys in all the games." Started from Goblin Storm's level-up cards (PR #668) and
Sky Isles' keys (PR #655).

## The same keys everywhere

| Key | Presses | Mark the button with |
|---|---|---|
| Enter | the main "go on" button on the screen: Start, Play, Next, Continue, Play again, Done, Got it | `data-key="enter"` |
| 1 to 9 | the 1st to 9th choice in a row of choices: cards, heroes, maps, modes, levels, shop tabs | `data-key="1"` ... and a `<KeyBadge k="1" />` inside |
| Esc | Back, Close, Not now, Cancel | `data-key="esc"` |

Rules:
- One shared helper, `useGameKeys(rootRef, on)` in `src/kit/useGameKeys.ts`. A key only presses a button already on
  screen, so it can't do anything a tap can't, and greyed-out or hidden buttons are skipped.
- Keys never fire while typing in a box, on a held key, within 0.35 s of the last key, or while the maths question
  (or another pop-up outside the game) is open. Inside a game's own pop-up only that pop-up's buttons count.
- Enter on a focused button keeps doing what the browser does (presses that button).
- Only one button per screen gets `enter`. Never put `enter` on anything that spends gold, ends a run early or deletes.
- The maths question keeps its own keys (digits type the answer; Enter checks). Number keys are never added to
  answer choices, because "3" would be confusing next to an answer of 3.
- Games that already move with arrows, WASD or Space during play keep those; `useGameKeys` is turned off during play
  where it would clash.
- Number badges show on computers and hide on touch-only screens (`.kit-key` in `styles.css`).

## Stages

1. **K1: the helper** (`useGameKeys`, `KeyBadge`, one kit test). Done 20 Nov 2026.
2. **K2: every game** marked up, in the same PR (table below). Done 20 Nov 2026.
3. **K3: How to play** lines in each game where there is room (later, as each game is next touched).

## Games

Filled in as each game is done. Goblin Storm has its own card keys (PR #668); Sky Isles has its own (`src/games/isles/keys.ts`, PR #655).

| Game | Enter | 1 to 9 | Esc | Notes |
|---|---|---|---|---|
| Kiwi's Beanstalk | Play / Play again, OK | Jack / Jill | Home (not mid-round) | |
| Hop's Glow-worm Pond | Play / Play again, finish OK | — | Home (not mid-round) | finish OK is the kit's `WhatsNext` (enter added there) |
| Pipi's Hidden Shells | Play / Play again, finish OK | — | Home (not mid-round) | |
| Penguin Pairs | Play / Play again, finish OK | — | Home (not mid-round) | |
| Weka's Stepping Stones | Play / Play again, Next / Finish, finish OK | — | Home (not mid-round) | Check has no key (it marks an answer) |
| Tūī's Ten Tree | Play / Play again, finish OK | — | Home (not mid-round) | |
| Pigeon | Play / Play again, finish OK | — | Home | keys off during play (taps only) |
| Parrot | Play / Play again, finish OK | — | Home | same |
| Lizard | Play / Play again, finish OK | — | Home | same |
| Swamp Hen | Play / Play again, finish OK | — | Home | same |
| Robin | Play / Play again, finish OK | — | Home | same |
| Glyph Gates | Light the runes, guide Next, Next temple (or Try again) | the six temples | Back, Map | tiles and glyphs not numbered |
| Order Up | example Next / Let's go, Next level (or Again) | levels 1 to 7 on the road | Home, Back to road | keys off in the bag (it has its own digits) |
| Quick looks | Start looking, Next / Finish, Back to my garden | — | Back to Training | its own digits answer the pictures; Finish for now has no key |
| Star Trader | own keys (#667): Enter jumps / goes on, T S B M screens, Y / N on deals | | | left as it is |
| Royal Decree | Begin / Carry on your reign, Rule again, Next, On we go, riddle Help / Next, tour Next, tip Got it, Try again | 1 = No, 2 = Yes on the request card (arrows still work) | Back, riddle Not now | |
| Gem Keep | Next wave / Boss wave, end-of-level button, Play level N | level stops 1 to 9 on the map | — | Esc already cancels a selection in a level |
| Maths Monsters | Start walking, Try again | — | — | map and battles already have 1 to 4, Esc, M and Enter; keys off there |
| Dragon Maths | Try again, Continue / Have a go, Size it up / Fight!, Go in, ceremony Next / Done, arena Fight!, Practise again | — | — | already has letter keys, 1 to 9 for skills and Esc back to the village |
| Chess | Start game, Play again, prize "Use it now" | — | Look at the board, Keep playing, prize Later | no keys on Resign or New game; moves stay mouse/tap |
| Checkers | Start game, Play again | — | Look at the board, Keep playing | same |
| Clan Quest | Go to the Mines, Carry on, Read on, Keep training, Start the adventure, Fight! / Next round, OK on notices, Try again, Duel again | duel orders 1 to 3; practice clans | Back / Close on every side screen | keys off on Mines and fights (own keys); nothing on Duel!, Give up or buying |
| Wormholes & Black Holes | Launch!, Play again | — | — | in-game keys unchanged; hook only on settings and after the game |
| Card 101 | Deal the cards, I've remembered them, Scores, Next round / See who won, Play again | — | — | own S, D, K, T, Esc kept |
| Power Clash | Start the clash, Next round, Rematch | set-up: two players / bot / Normal / Chaos | — | powers not numbered; live game digits are board squares |
| Basic facts training | Today's session / Facts check, Done, Start the check, Back to Training | — | Back on the facts map | off while typing answers |
| Toon Flap | Next level, Fly again, Dash again, Try again | map levels 1 to 9 | Map, Back | keys off while flying |
| Marble Rush | Keep rolling, Roll again | course Play buttons 1 to 8 | How to play Back | keys off while rolling |
| Mine Runner | Resume, Fly it again / Try again | practice 1, mines 2 on | Back | keys off during a run except pause and finish |
| Diamond Drop | Play, On to the shop, Start | level tiles 1 to 4, shop tabs 1 to 2 | Back, Level map | keys off while playing |
| Archery | Play, Next, Fight!, Accept, OK, Open the chest, Another round, Try again | worlds, armory shelves | Leave, Back | no key on "Say no" to a classmate |
| Bond Match | Play again | bond sets 1 to 9 | Play another | |
| Goblin Storm | Play again (menus); level-up cards have their own keys (#668) | heroes, maps, level-up cards | Back, Change hero | keys off during a run |
| Sky Isles | own keys (#655) | | | |
