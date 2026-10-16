# Making Gem Keep levels

Each level is one JSON file in `shared/gem-keep/levels/` (`level-01.json` to `level-10.json`).
You can edit them in any text editor. The campaign order is the list in
`shared/gem-keep/levels/index.ts`; to add an 11th level, copy a file, give it a new `id`, and add
it to that list.

After any change, check the levels:

```
npx vitest run shared/gem-keep/levels.test.ts
```

That checks every level is valid (and explains any problem in plain words), that the computer
player can win each one with the maths and loses without it, and that difficulty still rises
from level to level.

## A small example

```json
{
  "id": "level-11",
  "name": "Pebble Beach",
  "intro": "One line shown on the campaign map.",
  "toughness": 1.2,
  "startMana": 140,
  "map": [
    "................",
    "......^.........",
    "................",
    "..............~~",
    "................",
    "................",
    "................",
    "................",
    "................",
    "~~.............."
  ],
  "paths": [
    [[-1, 2], [6, 2], [6, 7], [13, 7], [13, 4]]
  ],
  "waves": [
    { "groups": [{ "kind": "walker", "count": 6, "gap": 1.2 }] },
    { "groups": [{ "kind": "walker", "count": 8, "gap": 1 }, { "kind": "runner", "count": 3, "gap": 1, "delay": 4 }] }
  ]
}
```

## The fields

| Field | What it is |
|---|---|
| `id` | A short name with no spaces, e.g. `level-11`. Must be different for every level, and must never change once students have played it (progress is saved against it) |
| `name` | What students see on the map and above the game |
| `intro` | Optional. One short line, shown when you hover over the level on the map |
| `toughness` | Optional, default 1. Multiplies every enemy's health. This is the main dial for difficulty: 1.2 means 20% tougher |
| `startMana` | Optional, default 200. Mana at the start. 140 buys one tower and its first gem plus a little more |
| `map` | Exactly 10 rows of exactly 16 letters. `.` is grass (towers can go here), `^` is rocks and `~` is water (no towers). Draw the path as grass: it's worked out from `paths` |
| `paths` | One or two paths (more works too). Each path is a list of corners, `[column, row]`, counting from 0 at the top left. Corners are joined by straight lines across or down, never diagonally. The first corner may be one step off the map (`-1` or `16` for columns, `-1` or `10` for rows) so enemies walk in from the edge. **The last corner is the Keep**, and every path must end at the same Keep |
| `waves` | The waves, in order. 8 to 15 is a good number |

### Waves

Each wave is a list of groups. Every group in a wave starts when the wave starts.

| Field | What it is |
|---|---|
| `kind` | `walker` (normal), `runner` (fast, weak), `brute` (slow, very tough), `swarm` (lots of tiny ones) or `boss` |
| `count` | How many |
| `gap` | Seconds between each one |
| `delay` | Optional. Seconds after the wave starts before this group begins |
| `path` | Optional. Which path they walk: 0 is the first, 1 the second. Leave it out and they take turns |

A wave with a `boss` in it is a boss wave: students answer the Wave Gate's 3 questions before
it starts. Keep bosses on every 5th wave (and the last wave, if you like). Enemies get 15%
tougher every wave on top of the level's `toughness`, so later waves don't need much bigger numbers.

## Which times tables a level asks

The tables come from the level's **position** in the campaign, not from the file:
levels 1–2 ×2 ×5 ×10 (up to × 10 only), 3–4 add ×3 ×4, 5–6 add ×6 ×8, 7–8 add ×7 ×9,
9–10 add ×11 ×12. Change them in `shared/maths/config.ts` (`CAMPAIGN_STEPS`).

## How the 10 levels were made

The maps and paths were designed by hand. The waves were written by a small generator to give a
steady build-up (more enemies, closer together, runners, swarms and brutes joining in, bosses
every 5th wave and at the end of levels 6–10). Then each level's `toughness` was tuned with the
computer player, so the share of right answers it needs to win rises steadily: about 30% for
levels 1–2 up to about 65% for level 10. The generated numbers are only a starting point:
change anything, then run the check above.

Things that make a level harder: higher `toughness`, a shorter path, two paths, smaller gaps,
more brutes and bosses, less `startMana`. Things that make it easier: the opposite. Long paths
give towers more time, so they're kinder than they look.
