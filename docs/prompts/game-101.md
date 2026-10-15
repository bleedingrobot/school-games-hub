We're building **School Games Hub**: a games website for my Year 4–6 students at Douglas Park School. The project is in `~/projects/school-games-hub` (GitHub: bleedingrobot/school-games-hub, public). It's live at https://bleedingrobot.github.io/school-games-hub/.

This task adds a new game: **101**, a card game my family plays. It needs a **single-player** mode (against bots) and a **multiplayer** mode (against other students, 2 or more players).

I'm a teacher, not a developer. Please explain things in plain, simple words, and make the technical decisions yourself.

## Before doing anything, read these files

- `docs/BRIEF.md`: my original brief. Sections 8 (safety), 9 (design), 10 (technical quality) and 12 (how I want you to work) apply to this game too.
- `docs/PLAN.md`: the agreed architecture, decisions, the Stage 6 multiplayer design and the setup notes. Where it disagrees with the brief, PLAN.md wins. Check which stages are done.
- `README.md`: how the project runs, is tested and published, and how playing a friend works.
- `docs/prompts/stage-7-progression.md`: its **"Things to know"** section (Supabase access, server functions, local testing, Playwright, library versions) all applies here. Follow it.
- The code this builds on:
  - `src/games/registry.ts` and `src/games/types.ts`: how a game plugs into the hub
  - `src/games/checkers/`: the closest example of a game with our own rules, bots in a Web Worker, a bot game and a friend game
  - `shared/`: rules shared with the server, `shared/multiplayer.ts` and `shared/botGame.ts`
  - `supabase/migrations/`, `supabase/functions/save-bot-game/`, `supabase/functions/multiplayer/`
  - `src/multiplayer/`, `src/pages/Lobby.tsx`, `src/pages/FriendGamePage.tsx`

**Check where Stage 7 (points, ratings, leaderboards) is up to.** If it's in progress and not merged, stop and tell me before starting, so the two pieces of work don't collide. If it's done, 101 should fit into it (see "Points" below). If it hasn't started, save 101 results in a shape Stage 7 can use later, and note that in PLAN.md.

## The rules of 101

**Aim:** get the lowest hand each round. Scores add up across rounds. When someone reaches 101, the game ends and the lowest total wins.

**Deck:** one standard 52-card deck. 2 or more players.

**Setup (each round):**
1. Deal each player 4 cards face down in a 2×2 square.
2. Before play starts, each player looks at their **bottom two** cards (the two nearest them) once. After that they can't look again. They have to remember them.
3. The rest of the deck goes face down in the middle as the stack. Turn its top card face up beside it to start the discard pile.

**Your turn:**
1. Take either the top card of the **discard pile** or the top card of the **face-down stack**. (On the very first turn, that means the card turned up during setup or a face-down card.)
2. Choose to keep it or not:
   - Keep it: swap it for one of your four cards, face down. The card you replaced goes face up on the discard pile.
   - Don't keep it: put it face up on the discard pile.
3. Play passes to the next player.

Instead of taking a card, you can **knock** to end the round.

**Card values:**

| Card | Points |
|---|---|
| King | 0 |
| 3 | 0, and it also cancels your highest-value card (that card scores 0 too) |
| Ace | 1 |
| 2, 4–10 | Face value |
| Jack, Queen | 10 |

**Special scoring:**
- **Doubles:** two cards of the same rank cancel each other out and score 0.
- **Triples:** three cards of the same rank make your whole hand score 0.
- **3s:** see the table above.

**Ending a round:** after someone knocks, every other player gets one more turn. Then everyone turns their cards face up and totals their hand. The lowest hand wins the round. There's no penalty for the knocker if someone else ends up lower.

**Scoring and winning:** after each round, each player adds their hand total to their running score. Shuffle, deal and play another round. The game ends when a player reaches 101. The player with the lowest total wins.

### Rule questions: answer before you start

I've filled in the ones I know. Ask me about any left blank, all at once, before you write the rules code. Don't guess house rules.

1. Doubles: any two matching cards anywhere in the hand, or only a pair in the same column? → 
2. Four of a kind: what does it score? → 
3. When special rules overlap (two 3s; a 3 whose "highest card" is part of a pair; a pair of 3s), what happens? → 
4. If you take the top of the discard pile, can you put it straight back, or must you swap it in? → 
5. What happens when the stack runs out? → 
6. Can someone knock on their very first turn? → 
7. Ties: for the lowest hand in a round, and for the lowest total at the end? → 
8. Does the game end at 101 **or more**, or exactly 101? → 
9. Most players in one game: → 

Write the final agreed rules into a new file, `docs/101-RULES.md`, in plain words, and use it for the in-game "How to play" panel.

## What's different about 101 (please read carefully)

Chess and checkers have no secrets: both players see the whole board, so `mp_games` lets each player read the whole game. **101 is a hidden-card game.** That changes the design:

- **No browser may ever receive a card its player isn't allowed to see.** That means other players' face-down cards, the order of the stack, your own cards after the opening peek, and a card someone else drew from the stack until it's discarded. This has to hold for every route: table reads, database functions, server function replies and Realtime messages. Checking "it isn't shown on screen" is not enough.
- **The shuffle happens on the server**, using proper cryptographic randomness, never in the browser.
- **The peek:** at the start of each round, the server shows each player their bottom two cards once (for example, for a few seconds or until they press "I'm ready"), then never again. Asking again shows nothing.
- **More than two players:** the existing friend games are strictly two-player. Decide whether to extend `mp_games` and the `multiplayer` function or add a new table and function for card games. Whichever you choose, **chess and checkers must keep working exactly as they do now**. Explain the choice.
- **Live updates:** a likely pattern is a secret game-state table students can't read, plus a small readable row (or Realtime message) that only says "something changed" so each browser asks the server for its own view. Choose what's simplest and safest, and explain it.
- **Lobby and codes:** keep the same game codes and lobby. The creator picks how many players. Decide whether the game starts when it's full or when the creator presses Start.
- **Someone walks away:** the 2-minute "claim the win" rule doesn't fit a game of 3 or more. Pick a fair, simple rule (for example, the others can skip a player who hasn't moved in 2 minutes, and a player skipped several times is out). Leaving counts as a loss for the leaver and earns nothing; the others carry on if at least 2 remain. Draw offers don't apply.
- **Reconnecting:** reloading, closing the Chromebook lid or losing Wi-Fi must not lose the game, as with chess and checkers. A rejoining player must *not* get to see their cards again.

## What's already out there (I've looked)

I checked for existing code to reuse. Nothing fits as-is, so write the rules ourselves, with tests, like checkers. But learn from these:

- **boardgame.io** (MIT) is a well-known turn-based game framework with "secret state" (`playerView`) for hiding cards. It needs its own always-running Node server, which doesn't fit GitHub Pages + Supabase, and its last release was November 2022. **Borrow its ideas, not the code:** each player gets a filtered view of the game, and all randomness happens on the server. One known trap from its issues: the full *starting* state (the dealt hands) was sent to every player, so deal *after* the game starts and filter that too.
- **Open-source Cambio/Golf games** (for example `dotslashsimran/cambio`) use 4 face-down cards and a 2-card peek like 101, but they run their own Socket.IO servers and have different rules (power cards, snapping). Glance at their turn flow and UI if useful; don't copy the rules.
- **`gridatek/throne`** is a Love Letter card game on the same stack as ours (Supabase + Realtime). It's a warning, not a model: its deck sits in a table anyone can read, and its hands table lets anyone do anything. That's exactly the leak 101 must not have.

## Single player (against bots)

- The student plays against 1 to 3 bots and picks the bot level: Very Easy, Easy or Medium (same labels as the other games).
- **Bots must play fair:** they only use what a player in their seat could know (their own peek, cards they've seen discarded or drawn). They never peek at the stack or other hands.
- Make the levels feel different, for example: Very Easy forgets what it has seen and knocks at random; Easy remembers some things; Medium remembers everything it has seen and knocks at sensible moments. Test that each level beats the one below it, like the checkers tests do.
- Run the bots so the page never freezes (a Web Worker if they need it).
- Save finished bot games through `save-bot-game`, which should replay the game to check every move was legal. Record whatever it needs to replay the deal (for example a seed). Bot games run in the browser, so like the other games they must earn only small, capped points and never count towards rankings.

## Points

If Stage 7 is done: decide how 101 earns points, and whether it gets a rating at all, since the Elo ratings are built for two-player games. Explain the choice in PLAN.md in words a 9-year-old could follow. Keep the existing rule that abandoned or very short games earn nothing, and decide what "very short" means for 101 (for example, fewer than 2 full rounds).

## Look and feel

- Match the rest of the hub: bright, friendly, big buttons, playful but restrained animation, sound only through the existing mute setting.
- **Card pictures:** use Adrian Kennard's public-domain (CC0) card faces, which the npm package `@letele/playing-cards` has as React SVG components. Copy the SVGs into the repo with a NOTICE file, the way the chess pieces are done, rather than depending on a small one-version package. Check the licence yourself first. Draw our own card back. If those faces are too fussy to read at Chromebook size, draw simple, big faces of our own instead. No outside fonts.
- Your 4 cards sit in a 2×2 square at the bottom. Other players' squares sit around the table with their avatar and player name. The stack and the discard pile are in the middle.
- Make it obvious whose turn it is, what you're holding, and when someone has knocked ("Last turn!").
- Running totals, and how close each player is to 101, are always visible.
- **End of round:** flip everyone's cards and show the scoring step by step: pairs cancelling, a 3 cancelling the highest card, the total. This is great maths practice for my students, so make it clear and a little celebratory.
- It must work with a mouse, a touchscreen and the keyboard, at Chromebook (1366×768) and tablet (768×1024) sizes. Cards need accessible names (for example "Your card, top left, face down").
- No chat and no free text, as everywhere else on the site.

## Tests

- **Rules:** every scoring rule and every combination from the rule questions, turn order, knocking and the last turns, reshuffling the stack, the end of the game at 101, and ties.
- **Hidden cards:** prove a student can't get another player's cards, the stack order, or their own cards after the peek, through table reads, database functions, server function replies or Realtime. Use pgTAP for the database side.
- **Server refereeing:** out-of-turn moves, illegal moves, double-taps, moves after the game ends, and joining a full or started game are all refused.
- **Bots:** they only make legal moves, never use hidden information, and each level beats the one below.
- **Interface:** the turn flow, the peek, knocking and the end-of-round scoring screen.

## Check your work

- Run the type check, tests, database tests and production build.
- In a real browser with local accounts: play full single-player games against each bot level, and full multiplayer games with **2 and with 3 players** (separate browser contexts), including a reload part-way, a knock, and a player walking away.
- Take screenshots at Chromebook and tablet sizes.
- Make sure chess and checkers (bots and friends) still play and save.
- Work out roughly what a 101 game costs against the free-tier limits in PLAN.md (server function calls per game, Realtime messages), and add it to PLAN.md.
- Tell me plainly what's tested and what isn't.

## Finish up

- Write a short design section for 101 in `docs/PLAN.md`, and add 101 to the README (how to play, how it's refereed, the walk-away rule).
- Apply any migration and deploy any changed server functions to the live project yourself, then check them from outside. Record the migration in the PLAN.md note about `supabase migration repair`.
- Commit with clear messages on a branch. Only merge to `main` once everything passes and the live database and functions are ready.
- Give me one short set of steps to try 101 on the live site with two real school accounts.

When you're done, give me a short plain-English summary: what was built, the 101 rules as you've coded them, anything I need to click (one clear set of steps at a time), what to try on the live site, and anything about cost, free-tier limits, privacy or licences I should know.
