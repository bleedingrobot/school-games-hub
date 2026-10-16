# Tic-Tac-Toe: Power Clash
## Game Design and Build Specification

**Tagline:** Tiny board. Ridiculous powers. Absolutely no reason to trust your opponent.

## 1. Vision

Build a colourful, chaotic, local-multiplayer arcade game that turns familiar tic-tac-toe into a tactical party game full of reversals, ridiculous moments, and satisfying animations.

The goal is to make the game:

- Easy to learn in 30 seconds.
- Entertaining within one minute.
- Unpredictable until the final move.
- Simple to play with two people sharing one screen.
- Straightforward to build and host as a static website.

The key experience is a player celebrating what looks like a guaranteed win, only for their opponent to use a power and turn the board upside down.

## 2. Core Game

| Item | Specification |
|---|---|
| Players | Two local players on one device |
| Board | 3 × 3 grid |
| Win condition | Three symbols in a row, column, or diagonal |
| Typical match | Approximately 2–5 minutes |
| Main mode | Power Clash |
| Additional mode | Chaos Mode |
| Match format | Single round or best-of-five |
| Hosting | Static website, suitable for GitHub Pages |

### Turn flow

1. The active player chooses a legal action.
2. They may activate at most one power before making their normal placement.
3. They place their symbol in an empty square.
4. The game resolves the effect and checks for a winner.
5. If the round continues, the turn passes to the other player.

**Important:** Double Trouble grants one additional placement. The game checks for a winner after each board-changing action, and a completed winning line ends the round immediately.

## 3. Game Modes

### Power Clash
The standard mode. Players choose three different powers before the match. Each selected power can be used once per match.

### Chaos Mode
A more unpredictable mode with random events, more powerful effects, and additional surprises. Build this after the core mode is stable.

### Best of Five
Players compete across up to five rounds. Track the score and provide a quick rematch option. Players may optionally change their loadout between rounds.

## 4. Power-Up Arsenal

The first release should implement the first four powers. The remaining powers can be added once the core game is tested.

### 4.1 Double Trouble
**Type:** Offensive

Place one additional symbol in an empty square during the same turn.

- The bonus placement must be legal.
- Check for a winner after each placement.
- If the first placement wins the round, the bonus placement does not happen.
- Suggested animation: a lightning strike followed by the second symbol slamming into place.

### 4.2 Body Swap
**Type:** Disruption

Swap one of the active player's symbols with one of the opponent's symbols.

- Both target squares must contain symbols.
- Protected symbols cannot be swapped.
- Check for a winner immediately after the swap.
- Suggested animation: the symbols enter portals and reappear in each other's positions.

### 4.3 Freeze Ray
**Type:** Control

Freeze an empty square so the opponent cannot place a symbol there during their next turn.

- The target must be empty.
- A frozen square remains unavailable until the effect expires.
- Frozen squares do not contain symbols and cannot themselves win a line.
- Suggested animation: an icy beam encases the square in frost.

### 4.4 Board Wipe
**Type:** Disruption

Remove one unprotected symbol from the board.

- The target must contain a symbol.
- Protected symbols cannot be removed.
- Check for a winner after the removal, although removal itself should not create a winning line.
- Suggested animation: a cartoon explosion sends the symbol flying off the board.

### 4.5 Force Field
**Type:** Defence

Protect one of the active player's symbols from swapping or removal until that player's next turn.

- The target must be one of the active player's symbols.
- Protection blocks Body Swap and Board Wipe.
- Suggested animation: a shimmering energy dome forms around the symbol.

### 4.6 Portal Chaos
**Type:** Random disruption

Randomly exchange the symbols in two occupied squares selected by the player.

- Both squares must be occupied.
- The two squares must be different.
- Protected symbols cannot be selected.
- Suggested animation: swirling portals teleport the symbols, followed by a dramatic reveal.

### 4.7 Wild Card
**Type:** Random event

Trigger one random effect from a defined set of legal effects, such as:

- A bonus placement.
- A temporary freeze.
- A legal symbol swap.
- Removal of an unprotected symbol.

Rules:

- Random outcomes must be implemented in the game engine, not by animation code.
- Only include effects that have valid targets.
- Do not allow an effect to bypass protection or other core rules.
- Suggested animation: a roulette wheel spins before revealing the effect.

### 4.8 Time Heist
**Type:** Reversal

Undo the previous completed turn and restore the prior game state.

- Available only while the round is active.
- Once per match.
- Restore the board, power charges, frozen-square state, protection state, and active player.
- Prevent recursive or repeated undo loops.
- Suggested animation: the board rewinds and symbols fly back to their previous positions.

## 5. Core Rules and Balance

1. Each player chooses three distinct powers before the match.
2. Each selected power can be used once per match.
3. A player may activate at most one power per turn, before their normal placement.
4. Double Trouble grants one additional placement.
5. Check for a winner after every board-changing action.
6. A completed winning line ends the round immediately.
7. A full board without a winner is a draw.
8. Invalid power targets cannot be selected or activated.
9. Protected symbols cannot be swapped or removed.
10. If a power has no legal target, it must not activate or consume a charge.
11. Every power effect must have a clear, visible explanation.
12. Animations must never determine game outcomes; the game engine determines the state first.

### Recommended first-version decisions

- Do not include an energy economy in version one. Limited charges are easier to understand and make power use feel important.
- Do not let a player continue acting after a winning line is formed.
- Make the default rules consistent and predictable, even when the effects are chaotic.
- Keep Chaos Mode separate from the standard mode so players know what to expect.

## 6. User Interface and Visual Direction

### Overall style

Create a polished indie arcade aesthetic:

- Dark navy and purple background.
- Electric cyan identity for X.
- Hot magenta identity for O.
- Large, tactile board squares.
- Glowing symbols and animated power cards.
- Particle bursts, screen shake, and dramatic victory effects.
- Responsive layout for desktop and mobile.
- Large controls suitable for two people sharing a screen.

### Screen layout

#### Top bar
- Player X and Player O identities.
- Current-turn indicator.
- Match score.
- Best-of-five progress.

#### Centre board
- Large 3 × 3 grid.
- Animated symbols.
- Highlighted legal targets when a power is selected.
- Visible frozen squares.
- Visible protection effects.
- Animated winning line.

#### Power bar
- Three selected power cards per player.
- Power icon and name.
- Short description.
- Available/used status.
- Click a power to select it, then click a legal target on the board.

#### Feedback layer
Use short, punchy feedback messages, for example:

- “THAT WAS YOUR PLAN?!”
- “TIME CRIME!”
- “ABSOLUTE DISASTER.”
- “TACTICAL GENIUS. PROBABLY.”
- “YOU HAD ONE JOB.”

Keep feedback readable and brief. Avoid cluttering the board with long text.

### Accessibility and usability
- Support keyboard navigation.
- Provide visible focus indicators.
- Make controls usable without relying on colour alone.
- Include sound on/off controls.
- Include a reduced-motion option.
- Keep text readable against the background.
- Prevent double-clicks and invalid moves while animations are playing.

## 7. Animation and Sound Design

Animations should make each action satisfying without slowing the game down.

| Event | Suggested treatment |
|---|---|
| Normal placement | Symbol pops into place with a short glow |
| Double Trouble | Lightning flash, then bonus symbol slams down |
| Body Swap | Portal transition between the two squares |
| Freeze Ray | Ice beam, frost overlay, subtle crackling |
| Board Wipe | Cartoon explosion and symbol flying away |
| Force Field | Energy dome forms around the protected symbol |
| Portal Chaos | Swirling portals and dramatic symbol reveal |
| Wild Card | Spinning roulette-style reveal |
| Time Heist | Board rewind and reverse particle motion |
| Win | Glowing winning line, brief celebration, score update |
| Draw | Board-wide pulse and playful draw message |

Use CSS animations and SVG effects for most visuals. Use the Web Audio API for simple synthesised sound effects so the first version does not depend on external audio files.

Keep effects short. Provide settings for sound and reduced motion.

## 8. Technology Stack

### Recommended stack

- **React:** UI components and screen state.
- **TypeScript:** typed game state, power definitions, and action validation.
- **Vite:** development server and production build.
- **CSS:** layout, transitions, and most animations.
- **SVG:** winning lines and selected visual effects.
- **Web Audio API:** synthesised sound effects.
- **Vitest:** unit tests for the game engine.
- **GitHub Pages:** free static hosting.

No backend, database, login system, or paid API is required for the first release.

## 9. Architecture

Keep game rules separate from presentation and animation code.

Suggested project structure:

```text
power-clash/
├── public/
├── src/
│   ├── components/
│   │   ├── Board.tsx
│   │   ├── BoardCell.tsx
│   │   ├── PowerCard.tsx
│   │   ├── PlayerPanel.tsx
│   │   ├── MatchSummary.tsx
│   │   └── SettingsPanel.tsx
│   ├── game/
│   │   ├── types.ts
│   │   ├── initialState.ts
│   │   ├── reducer.ts
│   │   ├── winDetection.ts
│   │   ├── powerDefinitions.ts
│   │   ├── resolvePower.ts
│   │   ├── turnRules.ts
│   │   └── history.ts
│   ├── hooks/
│   ├── styles/
│   ├── audio/
│   ├── App.tsx
│   └── main.tsx
├── tests/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

The exact structure can change if the project already has an established layout.

### State management

Represent the game state explicitly. It should include at least:

- Board contents.
- Active player.
- Round status: active, X wins, O wins, or draw.
- Each player's selected powers and remaining charges.
- Frozen-square state and expiry.
- Protected-symbol state and expiry.
- Match score and round number.
- Turn history for Time Heist.
- Current UI interaction state, such as a selected power and highlighted targets.

Use typed, predictable state transitions. A reducer or similarly central action handler is a good fit.

### Keep logic and visuals separate

For example, `resolvePower()` should validate Body Swap and update the board. The animation layer should then display the resulting change. Do not make animation callbacks responsible for deciding who wins.

## 10. Build Plan

### Stage 1 — Playable classic game
Build:

- 3 × 3 board.
- X and O turn handling.
- Win and draw detection.
- Scorekeeping.
- Restart.
- Best-of-five matches.

**Deliverable:** a playable game with no powers.

### Stage 2 — Game engine
Build:

- Typed game state.
- Central action validation.
- Power definitions.
- Legal-target detection.
- Turn resolution.
- Win checks.
- Immutable history snapshots.

**Deliverable:** a rules engine that can be tested independently of the UI.

### Stage 3 — First four powers
Implement and test:

1. Double Trouble.
2. Body Swap.
3. Freeze Ray.
4. Board Wipe.

**Deliverable:** a complete first playable Power Clash mode.

### Stage 4 — Visual polish
Add:

- Power selection and target highlighting.
- Symbol transitions.
- Power-specific animations.
- Particle effects and screen shake.
- Sound effects.
- Funny messages.
- Victory and draw screens.
- Sound and reduced-motion settings.

**Deliverable:** a polished arcade experience.

### Stage 5 — Test and publish
Test edge cases, keyboard support, responsive layouts, power interactions, match resets, and production builds. Deploy to GitHub Pages and test the published site on the intended devices.

**Deliverable:** a shareable game URL.

### Stage 6 — Expansion
After the core game is reliable, add:

- Force Field.
- Portal Chaos.
- Wild Card.
- Time Heist.
- Chaos Mode.
- Optional AI opponent.
- Additional themes and cosmetic options.

Online multiplayer can be considered later; it requires networking and a different architecture from the local-only first release.

## 11. Testing Checklist

Write automated tests for:

- All eight possible winning-line patterns.
- Draw detection.
- Correct player turn order.
- Double Trouble's bonus placement.
- Body Swap with legal and illegal targets.
- Freeze Ray activation and expiry.
- Board Wipe target validation.
- Force Field protection and expiry.
- Portal Chaos target validation and random resolution.
- Wild Card legal outcomes.
- Time Heist restoring the complete previous state.
- Power charges being consumed only after a successful action.
- No moves after a round ends.
- A winning line ending the round immediately.
- Simultaneous winning lines and any defined tie-break rule.
- Full-board and no-legal-target situations.
- Restart and next-round state resets.
- Double clicks and actions during animations.

### Important unresolved rule: simultaneous wins

A power can potentially create a situation where both players have a winning line. Define a deterministic rule before implementing these interactions. A reasonable default is that the player who initiated the action wins if their action creates their own winning line, but the game should never silently resolve this differently in different situations.

## 12. Definition of Done for Version One

The first release is complete when:

- Two people can play on one device.
- The rules and power descriptions are understandable without external instructions.
- The first four powers work as specified.
- Invalid actions are blocked.
- Winning, draws, scorekeeping, and rematches work.
- Animations and sound effects can be disabled.
- The layout works at desktop and mobile sizes.
- The core game engine passes its automated tests.
- The production build succeeds.
- GitHub Pages deployment instructions have been verified.

## 13. Starter Prompt for an AI Coding Assistant

Use this prompt in VS Code with your coding assistant:

> Build a polished, chaotic, two-player local multiplayer browser game called **Tic-Tac-Toe: Power Clash**.
>
> ### Technology
> - React, TypeScript, and Vite.
> - CSS animations and SVG graphics.
> - Web Audio API for synthesised sound effects.
> - No backend, accounts, paid APIs, or database.
> - Deployable to GitHub Pages.
> - Use npm and provide clear setup instructions.
>
> ### Visual design
> Create a colourful, premium arcade aesthetic:
> - Dark navy and purple background.
> - Electric cyan X player versus hot magenta O player.
> - Large, tactile 3 × 3 board.
> - Glowing symbols and animated power buttons.
> - Particle effects, screen shake, and dramatic victory animations.
> - Responsive desktop and mobile layout.
> - Large controls suitable for two people sharing a screen.
> - Include sound and reduced-motion settings.
>
> ### Game rules
> - Two players share one device.
> - Standard objective: get three symbols in a row, column, or diagonal.
> - Players select three distinct powers before each match.
> - Each selected power can be used once per match.
> - A player may activate at most one power before their normal placement.
> - Double Trouble grants one additional placement.
> - Check for a winner after every board-changing action.
> - A winning line immediately ends the round.
> - A full board without a winner is a draw.
> - Validate every power target.
> - Implement best-of-five scoring and an instant rematch.
>
> ### Power-ups
> 1. Double Trouble: place an additional symbol.
> 2. Body Swap: swap one of your symbols with an opponent's symbol.
> 3. Freeze Ray: prevent placement in an empty square for one opponent turn.
> 4. Board Wipe: remove one unprotected symbol.
> 5. Force Field: protect one of your symbols from swapping or removal until your next turn.
> 6. Portal Chaos: randomly exchange the symbols in two occupied squares.
> 7. Wild Card: randomly select a defined, legal board-changing effect.
> 8. Time Heist: undo the previous completed turn, restoring the board, power charges, and protection state. Only available while the round is active.
>
> Implement the first four powers fully before adding the others.
>
> ### Engineering requirements
> - Separate game rules from UI and animation code.
> - Use typed state and predictable state transitions.
> - Validate every power target before applying an effect.
> - Implement undo using immutable game-state snapshots.
> - Track power charges, frozen squares, and protection durations in game state.
> - Prevent double clicks and invalid moves during animations.
> - Support keyboard navigation and accessible controls.
> - Add unit tests for win detection, draws, each power, turn order, undo, and power interactions.
> - Avoid unnecessary dependencies.
>
> ### Build process
> 1. Inspect the project directory before making changes.
> 2. Create the smallest working playable version.
> 3. Run the development server and explain how to test it.
> 4. Add the initial four powers and automated tests.
> 5. Polish the visual design and animations.
> 6. Add the remaining powers only after the core game passes its tests.
> 7. Provide GitHub Pages deployment instructions.
>
> Do not stop after generating a plan. Implement the first working version, run the available tests, fix errors, and report what remains incomplete. Do not claim anything was tested or deployed unless it actually was.

## 14. Recommended Development Approach

Build in small, testable increments. After each stage:

1. Run the game.
2. Test it manually with two players.
3. Run the automated tests.
4. Commit the working version to Git.
5. Move on to the next feature.

This makes it easier to identify which change caused a problem and to return to a known-good version.

**The guiding principle:** the rules should be reliable, even when the game feels chaotic.
