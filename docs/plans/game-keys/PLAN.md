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

1. **K1: the helper** (`useGameKeys`, `KeyBadge`, one kit test). This PR.
2. **K2: every game** marked up, in the same PR, game by game (table below).
3. **K3: How to play** lines in each game where there is room (later, as each game is next touched).

## Games

Filled in as each game is done. Goblin Storm has its own card keys (PR #668); Sky Isles has its own (`src/games/isles/keys.ts`, PR #655).

| Game | Enter | 1 to 9 | Esc | Notes |
|---|---|---|---|---|
