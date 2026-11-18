# Full-window games

James, 18 Nov 2026: Star Trader "looks amazing because it takes up the entire screen". Every game with big paintings
should do the same: no hub bar, no red margins, no frame, the art edge to edge. This file says how, and which games
are still to do. One game per chat, one PR per game (the bird games can share one).

**New games are full window from the start:** the rules are in
[game-guide/3-files-and-clashes.md](game-guide/3-files-and-clashes.md) "Full window". This file is for converting
older games, and its steps 3 to 7 are the how-to for new ones too.

**Done:** Star Trader, Mine Runner, Archery Challenge (built that way), Dragon Maths (#564), Clan Quest (#565), Sky Isles.
Read those two PRs' diffs before starting. They are the pattern.

## What "full window" means

1. The game's outer box covers the whole browser window, over the hub's top bar.
2. No frame, border, rounded corners or `max-width` cap on that box.
3. The main painting fills the window: every fight, stage, map and place.
4. A **⌂ Hub** button and the **sound** switch sit on the painting, because the hub bar is hidden.
5. Phones keep working: nothing scrolls sideways, and nothing important is cut off.

Text screens (lists, tables, settings) don't need to stretch. They sit in a readable column in the middle of the
full-window box.

## How to do it, step by step

### 1. Set up

- Work in your own worktree from `origin/main` (other chats use the shared checkout):
  `git worktree add -b claude/<game>-full-window <path> origin/main`, then make `node_modules` a junction to the
  main checkout's.
- Add a preview entry for your worktree to `Games Hub/.claude/launch.json` (copy an existing one; the game's config
  is `vite.<id>-preview.config.ts`; use a free port). Start it with the preview tools.
- Look at the game at **1366×768** (the school Chromebooks) before you change anything. Note every screen with a painting.

### 2. Find the outer box

Each game has one root element with a short class prefix (`.lord`, `.cq`, `.si`, `.mb`, `.dd-root`, …) in
`src/games/<id>/<id>.css`. Find its `max-width`, `border`, `border-radius`, `box-shadow` and `margin` rules. Several
later rules may paint over the first one (Clans had three). Grep the class name.

### 3. Make it the full-window layer

Either restyle the root, as Dragon Maths did, or wrap it in a new div, as Clans did (`.cq-window`). Wrap it when the
root's padding and width are used all over the CSS. Add these rules at the **end** of the game's CSS so they win:

```css
.xx-window {                       /* or the root itself */
  position: fixed; inset: 0; z-index: 40;
  overflow-y: auto; overscroll-behavior: contain;
  background: <the game's darkest colour>;   /* nothing of the hub may show through */
}
.xx-window > .xx { --xx-pad: 14px; max-width: 1600px; min-height: 100%; margin: 0 auto;
  padding: 0 var(--xx-pad) 24px; border: 0; border-radius: 0; box-shadow: none; background: none; }
```

- Use `z-index: 40`, the same as Star Trader. The hub's own pop-ups (trophies, year question) already work above it.
  Check that the game's own pop-ups and question box still sit on top: they live inside the layer, so they usually do.
- An element inside that used `position: absolute` against the page (a blurred backdrop, say) may now need
  `position: fixed`.
- Anything that measured the hub bar (`calc(100dvh - 96px)`, `100dvh - 120px`, `--tf-chrome`, `useFitBelow`, …) should
  now use the full `100dvh`. Grep the game for `dvh`, `vh`, `innerHeight` and `getBoundingClientRect().top`.

### 4. Make the paintings fill the window

- **A stage with things standing on it** (fights, quests, places): `height` or `min-height: 100dvh`, width edge to
  edge, `object-fit: cover`. Remove its outline, border and radius.
- **Edge to edge from inside the column:** use negative margins equal to the column's padding:
  `width: calc(100% + 2 * var(--xx-pad)); margin-left: calc(-1 * var(--xx-pad)); margin-right: calc(-1 * var(--xx-pad));`
  **Don't use `100cqw`/`100vw` for this.** A container's `cqw` includes the scroll bar, so the painting sticks out by
  about 7px and the page scrolls sideways (this happened in Clans).
- **A map with labels at fixed spots** (place names in % of the picture): the labels must stay on their buildings, so
  never stretch it. Copy Dragon's `.lord-map__paper` or Clans' `.cq-town__paper`:
  - an inner "paper" box with `aspect-ratio: 16 / 9` (or the picture's own ratio), holding the picture and the labels;
  - `width: min(100cqw, 100cqh * 16 / 9 * 1.14)` inside a `container-type: size` box that is `100dvh` tall. This
    never cuts the sides, and on a wide window cuts at most about an eighth off the top and bottom;
  - `position: absolute; left: 50%; top: 85%; transform: translate(-50%, -85%)`, sitting low so what's cut is sky;
  - a second copy of the picture behind it, `object-fit: cover; filter: blur(24px) brightness(0.55)`, filling any
    edge the map doesn't reach;
  - then check every label's box at the window sizes in step 7. A label that sits right on the bottom edge
    (Dragon's "You") may need moving up a few %.
- Bump caps that were there to leave room for the hub bar, e.g. figure heights such as
  `clamp(130px, calc(100dvh - 330px), 340px)` → `clamp(130px, calc(100dvh - 290px), 480px)`.

### 5. Add the way back to the hub

Copy `src/games/lord/HubButtons.tsx` into the game's folder (a game branch mustn't change `src/components/`) and
restyle it with the game's own button class. It is a plain `<a href="#/">` link (the hub uses hash routing, and it
also works in the stand-alone preview) and a sound toggle from `useSound()`. Put it in the top bar of the main
screen (the map or title screen), next to the game's name. Fights and places don't need it: they already have a way
back to the main screen.

### 6. Phones

Below about 760px wide, keep the game's old phone rules: undo absolute positioning on map papers, let a map scroll
sideways (Dragon) or just fit the width (Clans), and use a smaller `--xx-pad`. Then check 375×812.

### 7. Check it in the preview

At **1366×768**, **1920×900**, **1024×768** and **375×812**, on every screen with a painting:

- no hub bar, no red margin, no frame; nothing scrolls sideways
  (`el.scrollWidth <= el.clientWidth` on the layer);
- every map label and button is fully on screen. Read their `getBoundingClientRect()`s with the JS tool; a scaled
  screenshot can look cropped when it isn't;
- the game's question box, pop-ups and end screens still show on top;
- the Hub button and sound switch work;
- no console errors.

Gotchas: a painting may fade in, so take the screenshot again before deciding it's black. If you add a new file
while the preview runs, Vite can keep a "failed to resolve import" error: restart the preview.

### 8. Tests, PR, live

- `TESTS=all npx vitest run src/games/<id>` plus any test that imports the game (grep), `npx tsc --noEmit -p tsconfig.json`
  (ignore Glyph's Art.ts/art.ts errors on Windows), and `npx vite build --config vite.<id>-preview.config.ts`.
- If a test checks the old layout, fix the test; don't add new ones (test budgets are full: `scripts/test-budget`).
- Commit only your files; PR titled "<Game> fills the whole window, like Star Trader"; `gh pr merge <n> --auto --squash`.
- After the merge: wait for "Test and publish" on main to succeed, then grep the live chunk
  (index → registry → `<Game>Play-*.js/css` on bleedingrobot.github.io/school-games-hub/assets/) for a new class name
  before telling James it's live.
- Tick the game off in the list below in the same PR.

## The list

Rough order: biggest win first. Each line is a prompt to paste into a new chat.

| Done | Game | Prompt for a new chat | Notes |
|---|---|---|---|
| ☑ | Sky Isles (`isles`, `.si`) | Make Sky Isles full window like Star Trader, following docs/FULL-WINDOW.md. | Already up to 1600px wide and partly `100dvh` (`.si--play`, `.si-isle --si-h`), so mostly the hub bar, frame and the `- 300px` style caps. Isles is at its test budget. |
| ☑ | Maths Monsters (`monsters`, `.mb`) | Make Maths Monsters full window like Star Trader, following docs/FULL-WINDOW.md. | Board height is capped at `min(100dvh, 640px)` (`--mb-height`): let it use the whole window so the monsters grow. Max width 900px. |
| ☑ | Diamond Drop (`diamond`, `.dd-root`) | Make Diamond Drop full window like Star Trader, following docs/FULL-WINDOW.md. | The digging field is sized `(100dvh - 170px) * 10 / 7`: drop the hub-bar part. Check its `.dd-overlay` pop-ups (z-index 5) still sit on top. **Done:** the root was already fixed, so the field now takes the full height with the blurred level painting round it, and Pause / Drop sit in the right-hand edge on wide windows. |
| ☑ | Royal Decree (`decree`, `.rd`) | Make Royal Decree full window like Star Trader, following docs/FULL-WINDOW.md. | Built like Dragon Maths was before #564 (980px frame, `min(100dvh - 120px, 600px)`), so copy #564 closely. **Done:** the start, throne room and endings have their painting filling the window behind them (on `.rd--art`), the panel at the foot; the album and how-to keep the sky. |
| ☑ | Toon Flap (`toonflap`, `.tf-root`) | Make Toon Flap full window like Star Trader, following docs/FULL-WINDOW.md. | Play height is `calc(100dvh - var(--tf-chrome))`: set the chrome to 0 inside the layer. Keep the fly controls reachable. **Done:** `.tf-window` wraps every screen; the run is exactly the window, the map and hangar paintings reach every edge with the trail in a centred column, and Hub + sound sit in the map's top bar (the old "Back to games" button is gone). |
| ☑ | The bird games: Kiwi's Beanstalk, Penguin Pairs, Tūī's Ten Tree, Weka's Stepping Stones, Parrot's Seesaw, Hop's Glowworm Pond, Lizard's Bundles, Pigeon's Number Line, Swamp Hen's Reed Rows, Robin's Berry Basket, Pipi's Hidden Shells | Make all the bird games (the junior games with `useFitBelow`) full window like Star Trader, following docs/FULL-WINDOW.md. | Each already has a `--cover` class (fixed, inset 0) that it only turns on when there's no room under the hub bar. Make cover always on, set `--xx-room` to `100dvh`, and lift the 700px (Lizard 800px) width cap so the scene grows. It's the same small change in 11 games' own files. Check each at 1366×768 and on an iPad (768×1024). One PR, or two if it gets big. **Done:** `--cover` is now always on (z-index 40, scrolls inside itself) and `useFitBelow` is gone, so every screen gets the whole window; a sound switch sits next to each game's Home button. There was no 700px width cap in the games themselves: the scenes already stretch. |
| ☐ | Marble Rush (`marble`) | Make Marble Rush full window like Star Trader, following docs/FULL-WINDOW.md. | Less art, 960px cap. Smaller win. |
| ☑ | Gem Keep (`gem-keep`) | Make Gem Keep full window like Star Trader, following docs/FULL-WINDOW.md. | Narrow (420px) campaign board. Smaller win; check the board doesn't just get blurry when bigger. **Done:** `.gk-window` wraps the map and every level with the painting blurred behind. On wide screens the campaign painting is the window (stops on a 16:9 `.gk-world__paper`, title bar with Hub + sound, level card and save note floating on it); a level's board grows to the full height (`--gk-chrome` 170px) and stays sharp, as the canvas redraws at its new size. |

Chess is full window too, with a painted hall behind the board and moves that slide, burst and celebrate
(docs/CHESS-LOOK-PLAN.md). Not worth doing (boards, cards or question screens with little painting): Checkers, 101, Wormholes & Black
Holes, Power Clash, Bond Match, Order Up, Glyph Gates.
