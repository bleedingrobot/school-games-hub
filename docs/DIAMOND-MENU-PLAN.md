# Diamond Drop menu redesign

James, 25 Nov 2026: "plan and do a UI redesign of the Diamond Drop menu". His test phone showed the header chips and
pills taking most of the screen. The menu is the level map (`src/games/diamond/LevelMap.tsx`, `diamond.css`).

**Status:** M1-M4 built together and merged 25 Nov 2026 (PR "Diamond Drop menu redesign"). No new art: everything uses the
paintings already there.

## What was wrong (screenshots before, 25 Nov)

- **Phone:** title, 2-3 stat chips and Hub/sound took four rows. Play sat at the bottom of the first screen; the
  20-row level list (levels + Monster Dig) was two screens down, so picking a level meant a long scroll.
- **Phone on its side:** the first screen showed only the title and the chosen level; no Play button at all.
- **iPad (portrait):** the 20-row list ran off the bottom; the Monster Dig was below the fold.
- **Laptop:** fine overall, but the Monster Dig list was cut off at the bottom of the gauge.

## The new menu

- **M1 Slim top bar.** One row: ⌂ Hub, the title, coins, ⚙️ settings, sound. "Deepest" moves to the depth list's
  header; "Free boost waiting" becomes a "Free!" badge on the Shop tile.
- **M2 Depth list with tabs.** "Levels" / "Monster Dig" tabs (only once the Dig is open) so one list of 10 shows at a
  time and fits the height; it opens on the tab holding the chosen level. The header says your deepest.
- **M3 Phones and short screens.** The depth list becomes a strip of numbered stones you swipe sideways, sitting
  right above Play, so picking and playing a level fits the first screen. Nugget shrinks to a small head with a
  one-line bubble. The four tiles sit in one row. On its side: picture left, Play and tiles right.
- **M4 Settings in a pop-out.** ⚙️ opens the same settings (less motion, slower game, help, replay guide) in a panel,
  instead of a box at the bottom of the menu.

Kept as they were: keys (Enter plays, 1-4 tiles), "Show me" glow, the painting behind, the hero level, the 🎵
music button (bottom-left, from GamePage) and the sound switch, the Monster Dig gate picture.
