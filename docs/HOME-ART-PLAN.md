# Home page: graphics upgrade plan

How to make the pupils' home page (the "main dashboard", `src/pages/Dashboard.tsx`) look much more like a games hub, without making it slower on school Chromebooks or harder to read.
Written 29 October 2026 for James, after taking screenshots of the home preview (`preview/home`) on an iPad and a laptop.
**Status: plan only. Waiting for James to pick an option. Nothing is built yet.**

## The short version

- **Today the page is all boxes and emoji.** Every game is the same slim gradient card with a small line icon. Nothing is painted, so Marble Rush, Dragon Maths and Chess all look alike apart from their colour.
- **The upgrade is pictures and layout only.** No database change, no change to points, seasons, moves left or how a game starts.
- **Three options** (section 2). **Recommended: A, "Game shelf"**: a painted cover picture on every game card. It is the biggest change for the least work and suits all three themes.
- **Pictures come from ComfyUI on James's gaming PC**, the same way as the Clan Quest and Marble Rush backdrops. Mock-ups for this plan were painted there (section 5).
- **Fast on every device:** pictures are small WebP files (about 40-80 KB each), two sizes each so a Chromebook loads the small one, loaded only when they scroll into view.

## 1. What it looks like now (29 Oct 2026)

Screenshots: `/mnt/project-files/home-art/now-laptop.png` and `now-ipad.png`.

| Part | Now | What's weak |
|---|---|---|
| Top box ("Kia ora, Speedy Otter 27") | White box: avatar, level bar, rank badges, Play and Class Warp | Clean but plain; nothing says "games" |
| "Still going" lines | One yellow bar per game still going (up to 5 + "more") | A pupil with a few games going sees a tall yellow stack before any game |
| Game cards | Same gradient card for every game: small line icon, name, tagline, bot level and Play | Games all look alike; no picture of the game itself |
| Group labels | Small grey text and a thin line | Easy to miss |
| Season strips | Two white boxes with small round pictures (Clan Quest and Dragon Maths) | Good; already use painted art |
| Bottom (Recent games, My maths, Achievements) | Three white boxes | Fine |
| Background | Flat school red (Tidy), dark navy (Game menu), pastel (Soft and bright) | Flat |

What's already good and stays: the three themes, the clear group order (non-maths, training, easy maths, complex maths), big Play buttons, moves-left chips, the season strips, and that everything is readable on an iPad at arm's length.

## 2. The options

### Option A: Game shelf (recommended)

Each game card gets a **painted cover picture** across its top, like the tiles in a game console's store. The name sits on a dark band at the bottom of the picture; tagline, moves left, bot level and Play stay under it as now.

- Groups become **shelves**: a bigger heading with a small painted badge (chess piece, abacus, star).
- The "still going" bars fold into **one** yellow box with small avatar chips ("3 games still going: Chess with Brave Kiwi, 101, Wormholes") and one Carry on per chip.
- Background gets a soft pattern made in code (faint game shapes on Tidy and Soft, faint stars on Game menu). No download.
- Hover or tap: the picture zooms a tiny bit (off when "less motion" is on).
- **Art:** one cover per game (14 now), 1024x640, painted once. A new game just needs one more cover.
- **Work:** about 2 stages. Cards get taller (about 90 px), so the page is a bit longer on a phone; on an iPad and laptop three covers still fit per row.

### Option B: Village square

A **wide painted banner** across the top: a cheerful games village in a New Zealand landscape. The greeting, level bar and Play button sit over its calm left side; the pupil's avatar stands in the village.

- The banner **changes with the season**: day for Tidy school and Soft and bright, dusk with lanterns for Game menu; in monster week Grimmor looms on the horizon, in dragon week the dragon flies over.
- Game cards keep today's shape but swap the line icon for a **round painted badge** for each game.
- **Art:** 2 banners (day, dusk) plus 2-4 season extras, plus 14 small badges.
- **Work:** about 2 stages. Less change to the cards, more "wow" at the top. Text over a picture needs care so it stays readable (a soft fade behind the words).

### Option C: Adventure map

The games become **places on a painted island map**: the castle town is Kingdom Keeper, the volcano is Dragon Maths, the beach track is Marble Rush, the space dock is Wormholes. Tap a place and its card (bot level, moves left, Play) pops up.

- The most exciting and the most "game-like".
- **Risks:** harder to read at a glance (you hunt for a game instead of reading a list), harder for screen readers (needs a plain list too), the map must be re-painted when a game is added, and on a small screen it has to scroll sideways. A teacher switching a game off leaves an empty place.
- **Art:** one big map (painted in parts so places can light up), plus labels made in code.
- **Work:** about 4 stages.

### Mixing

A and B fit together: do A first, then add B's banner later as its own stage. C does not mix well with the others.

## 3. Devices (iPad, Chromebook, iMac)

- Pictures are WebP at two sizes (512 and 1024 wide) with `srcset`, so a Chromebook gets the small one and an iMac the sharp one. About 0.6-1 MB for all 14 covers at the big size, 0.3 MB at the small size, loaded lazily and cached after the first visit.
- Text never sits on a busy part of a picture without a dark band or fade behind it (contrast checked in each theme).
- No canvas or 3D on the home page; everything is plain images and CSS, so it stays as fast as today.

## 4. Stages (for option A)

| Stage | What | Goes live on its own? |
|---|---|---|
| H.1 | Paint the 14 covers on the gaming PC, pick the best of each, save as WebP in `src/assets/home/`; `cover` field on each game in `src/games/registry.ts` | No (just files) |
| H.2 | New game card with the cover picture, all three themes, iPad/Chromebook/iMac screenshots; folded "still going" box; shelf headings | Yes |
| H.3 (optional) | Option B's village banner on the top box, changing with the season | Yes |

Files touched: `src/components/GameCard.tsx`, `src/pages/Dashboard.tsx`, `src/styles.css`, `src/games/registry.ts`, `src/games/types.ts`, the home preview, and the dashboard tests. No migration.

## 5. Mock-ups

**These are rough sketches, not painted art.** ComfyUI wasn't running on James's gaming PC on 29 Oct 2026 (the PC answered over Tailscale, but nothing on port 8188), so the pictures are simple shapes and emoji standing in for the paintings, put into the real home preview to show the layout. Pictures: `/mnt/project-files/home-art/`.

- `option-a-shelf.png` (laptop, Tidy school) and `option-a-shelf-ipad-dark.png` (iPad, Game menu): game shelf, with the "still going" lines folded into one
- `option-b-village.png` (laptop, day) and `option-b-village-ipad-dusk.png` (iPad, Game menu, monster week): village banner
- `option-c-map.png`: adventure map, with a place's card popped up
- `now-laptop.png`, `now-ipad.png`: today, for comparison

Painting brief for the gaming PC (stage H.1, once ComfyUI is started with `--listen`): bright, friendly painted storybook art for ages 6-12, like the Clan Quest pictures, no text or logos, 2 tries each; pushed to branch `home-art-inbox` (`art-inbox/home/`), never to `main` directly.
