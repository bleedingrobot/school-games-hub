# Home page: graphics upgrade plan

How to make the pupils' home page (`src/pages/Dashboard.tsx`, `src/components/GameCard.tsx`) look like a games hub, in the same style as the Marble Rush course cards.
Written 29 October 2026 for James. **Status: LIVE 29 Oct 2026.** All 14 games have a painted card scene (painted on James's gaming PC, best of 2 tries each; the tries are on branch `home-art-inbox`). Wormholes & Black Holes and Mine Runner were repainted the same day with a starry space sky and a crystal cave.

## What James chose

The first three ideas (game shelf, village banner, island map) were turned down. James wants the home page game cards to look like the **Marble Rush course cards** (PR #90):

- A **painted landscape** across the top of each card (bright, flat, clean storybook style, soft sky, no text).
- A **white rounded panel** overlapping the bottom of the picture, with the game's name, tagline and moves left today.
- The **Play button carries the same picture**, faded dark on the left so "Play Chess" stays readable.
- A **soft blurred copy** of the picture fills the rest of the card, so the whole card feels like the place.
- Bot level buttons sit in the panel above Play, as now.

Mock-up (sketch, 29 Oct 2026): `/mnt/project-files/home-art/mk-*.png`. It uses in-game art for the six games that have some (Marble Rush, Dragon Maths, Clan Quest, Kingdom Keeper, Maths Monsters, Gem Keep) and a striped placeholder for the rest. The in-game art is darker and busier than the Marble Rush cards, so every game gets a **new scene painted for its card**.

## The card scenes to paint (14)

Painted with ComfyUI on James's gaming PC, in the same style and prompt base as the Marble Rush course pictures (`src/games/marble/art/`). Wide 16:9, about 1600x900, the subject in the middle and calm sky at the top. Two tries each; pushed to branch `home-art-inbox` (`art-inbox/home/`), never straight to `main`.

| Game | Scene |
|---|---|
| Chess | Giant chess pieces on a sunny chessboard lawn in a castle courtyard |
| Checkers | Red and black checkers stacked on a picnic-blanket board by a lake |
| 101 | Playing cards fanned on a table at a seaside bach |
| Tic-Tac-Toe: Power Clash | A glowing 3x3 board on a cliff top, lightning in a purple sky |
| Wormholes & Black Holes | A rocket racing to a space station past a swirling wormhole |
| Gem Keep | A crystal keep on a hill with a winding path and gems along it |
| Bond Match | Pairs of glowing number stones on a rock pool beach |
| Archery Challenge | Archery targets on a green range, flags and hills |
| Mine Runner | A little hover-ship flying through a glowing crystal mine |
| Maths Monsters | Friendly monsters in kauri bush beside a track |
| Dragon Maths | A red dragon over a small forest village (exciting, not scary) |
| Clan Quest | A clan village with a storm giant far away on the horizon |
| Kingdom Keeper | Riverstone city by a river, fields and a castle |
| Marble Rush | A glass marble on a chunky block track at Boulder Beach |
| Quick looks (Training) | Clay ladybird in a scarf waving in a flower garden. Painted 5 Nov 2026 with `scripts/quick-looks-card-art.py` (try 3 of 4, top 20% of sky cropped so the ladybird clears the panel; tries on `home-art-inbox`, `art-inbox/home/quick-looks/`) |

## Build

| Stage | What | Live on its own? |
|---|---|---|
| H.1 | Paint the 14 scenes, pick the best, save as WebP (big and `-small`, as Marble does) in `src/assets/home/`; `cardArt` on each game in the registry | No (files only) |
| H.2 | New `GameCard` in the Marble Rush style, in all three themes (dark panel in Game menu); season strips and "still going" lines unchanged. iPad, Chromebook and iMac screenshots | Yes |

- Pictures load lazily, small size on narrow screens, so the page stays fast on Chromebooks.
- A game with no picture yet falls back to its colour gradient (as a Marble course without art does), so a new game never breaks the page.
- "Less motion" turns off the hover lift. No database change, no migration.

Files: `src/components/GameCard.tsx`, `src/styles.css`, `src/games/types.ts`, `src/games/registry.ts` (or each game's `index.ts`), the dashboard tests and the home preview.

## Painted for the dashboard plan (12 Nov 2026)

Both scenes below are now painted (ComfyUI on James's PC, same clay settings as Weka and Quick looks) and live in `src/assets/home/`. The prompts are kept for repaints.

Two home cards still have no scene of their own. Paint them in the same clay style as the other cards (about 1600 × 800, subject in the middle third so the 2:1 crop keeps it), then add `<id>.webp` and `<id>-small.webp` to `src/assets/home/` and one line in `src/components/gameCardArt.ts`.

| Card id | Now shows | Prompt idea |
|---|---|---|
| `decree` (Royal Decree) | Kingdom Keeper's scene | A cosy clay throne room: a small wooden throne, a long scroll with a red wax seal on a table, banners, warm window light, soft pastel colours, no people, no text. |
| `training` (Multiplication and division training) | A band of blue colours | A clay classroom desk with a bright wooden abacus, a few times-table flash cards and a pencil pot, morning light, soft pastel colours, no text. |
