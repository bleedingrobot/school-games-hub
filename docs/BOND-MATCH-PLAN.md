# Bond Match: plan

**Bond Match** (name confirmed by James, 19 Oct 2026): a card-matching memory game where you don't match two *identical* cards, you match two cards that **make a number together**. Flip a 3, then find the 7 to make 10. Kids choose which bond they're practising: to 10, 20, 100, 1000, decimals to 1, fractions to 1, and more.
Written 19 October 2026 from James's request and a read of the hub on `main` (the maths ladder, skill packs, Gem Keep's saving, the game registry).
**Status (20 Oct 2026): M.1 to M.4 and M.6 done; M.4 is live. M.6 and the per-class switch are built and tested, NOT live (see "Stage M.6 results"). M.5 comes after go-live (James, 20 Oct 2026).** James answered every question on 19 Oct 2026 (section 11).

## The short version

- **We write our own game, not a copy.** The reference (doragrishaeva/react-memory-game, 4 stars) has **no licence**, which legally means "all rights reserved", so we can't reuse its code. It's also a plain match-two-identical-cards game, so there's little to reuse anyway: the cards, the flip, the move counter and the best score are an afternoon's work. The new part, and the point of the game, is the **bond decks**. We keep the reference's good ideas: modular card sets, several board sizes, and a best score kept in the browser.
- **No MobX.** The hub uses plain React. The game's rules live in a small pure TypeScript engine in `shared/bond-match/` (no network, no clock, no `Math.random`), so it can be tested hard and the server can check a finished game.
- **Kids pick the bond** on a "What are you practising?" screen: whole numbers, decimals, fractions (section 2). A **Mixed** option picks for them, and a teacher's maths focus (the hub's existing focus system) can choose for a class.
- **Calm, not stressful.** No game-over, no countdown. Your score is flips (fewer is better) and a time, with bronze/silver/gold stars. A wrong pair turns back over and shows the sum ("3 + 4 = 7, not 10") so every mistake teaches.
- **It feeds the maths ladder.** Bonds to 100 and 1000 are already on the ladder as "not built yet" stubs; this game and its question pack builds them (section 7).

## 1. How the game plays

1. Pick a bond (section 2) and a board size.
2. Cards lie face down. Flip two.
3. If they **add up to the target**, they stay face up with a tick, and glow in matching colours. If not, they flip back after a moment and the sum shows ("3 + 4 = 7").
4. Clear the board to finish. Stars come from how few flips it took (section 4).

**Any two cards that make the number match (James, 20 Oct 2026).** Any 3 matches any 7, any 5 matches any other 5. So a child who finds a right pair is never told it's wrong, and there are no colour sets or A/B marks on the cards. (Until 20 Oct the plan had "one partner per card" with two marked colour sets for repeated pairs; James found the marks cluttered.) A test checks every deck at every size can be cleared.

**Board sizes:** Small (6 pairs, 12 cards, 3×4), Medium (8 pairs, 4×4), Large (10 pairs, 4×5). Bond sets with few possible pairs (bonds to 10 has only 5) **repeat pairs** to fill the board (James's pick). A pair never appears more than twice.

## 2. The bonds a student can choose

Grouped as three shelves on the picker screen. The first few are the ones James listed; the rest are cheap to add once the engine takes a "bond set" as data.

| Shelf | Bond sets | Example cards |
|---|---|---|
| **Whole numbers** | To 10 · to 20 · to 100 (tens: 30+70) · to 100 (any: 37+63) · to 1000 (hundreds: 400+600) · to 1000 (tens: 370+630) | 3 ↔ 7, 13 ↔ 7, 30 ↔ 70, 400 ↔ 600 |
| **Decimals** | To 1 (tenths: 0.3+0.7) · to 1 (hundredths: 0.35+0.65) · to 10 (3.4+6.6) · to 100 with a decimal (e.g. 45.5+54.5) | 0.3 ↔ 0.7, 0.35 ↔ 0.65, 3.4 ↔ 6.6 |
| **Fractions** | To 1 whole: halves · thirds (⅓+⅔) · quarters · fifths · sixths · eighths · tenths · **mixed denominators** | ⅓ ↔ ⅔, ⅜ ↔ ⅝ |
| **Mixed forms** (stretch) | Cards in different forms that make 1: ¼ ↔ 0.75, ½ ↔ 50%, ⅕ ↔ 0.8 | ¼ ↔ 0.75 |
| **Mixed** | A random set from the shelf the student is working in, or Auto (section 7) | |

Notes:
- **Fractions are drawn as real stacked fractions** (the hub's question screen already does this for `'3/4'`), with an optional tiny pie or bar picture on the card as a hint. Fractions use only *like* denominators to start: ⅓ pairs with ⅔ and nothing else, so there's no "two right answers".
- **Decimals** always show the same number of decimal places (0.30 and 0.70 in a hundredths deck) so the layout doesn't jump.
- **Pairs where two cards are the same** (5+5 to 10, ½+½ to 1) are kept: they're the "doubles" of the family. Both cards are identical and match each other.

## 3. Cards and screens

- **Cards:** big, rounded, a CSS 3D flip (turned off by "reduce motion"), good contrast for Chromebooks and projector use. Face-down back uses the hub's look. Each matched pair gets its own colour so you can see "these two made 10" after.
- **Screens:** picker → board → finish. The board shows flips and time (hideable, because some kids hate seeing a clock). The finish screen shows stars, a "your best" line, a **Play again** (new shuffle, same bond) and **Pick another bond**.
- **Mistake help:** the "3 + 4 = 7" line appears under the board for a moment. No hint button (James didn't pick one).
- **Sound:** the hub's existing sounds (flip, match, finish) with the mute button.
- **Accessibility:** every card is a real button with a spoken label ("card 3, face down"); play with the keyboard (arrows + Enter); matched pairs are shown by a tick as well as colour; no information is colour-only.
- **Phones and Chromebooks:** the grid scales to the screen; a card never goes under about 64 px.

## 4. Stars and scores

- **Flips**: one flip = turning over a pair. A perfect memory game on 8 pairs takes at least 8 flips and usually 14–20.
- **Stars** (starting numbers, tuned after a test with real kids): gold = within 1.5× the minimum, silver = within 2.5×, bronze = finished. 
- **Bests:** "fewest flips" and "fastest time" per bond set and board size, kept in the browser straight away and saved to the student's hub profile in M.4.
- **No leaderboards across kids** (same rule as Training: compete with yourself). Teachers can see each student's stars per bond.

## 5. Where it lives in the code

Follows the hub's existing pattern ("make a folder next to chess/, then add it in the registry"):

- `shared/bond-match/` — pure engine and data:
  - `bonds.ts`: the bond sets as data (target, how to make the pairs, how to draw each side). New bond = one entry.
  - `deck.ts`: builds a deck from a bond set, board size and a **seed** (uses the hub's `shared/seededRandom.ts`), and checks there's one partner per card.
  - `engine.ts`: `flip(state, cardIndex) → { state, events }`. Handles first/second flip, match, mismatch, finish.
  - `score.ts`: flips, time, stars.
  - `save.ts`: what the website sends the server and the checks it makes (like `shared/gem-keep/save.ts`).
  - `*.test.ts`: engine, deck, one-partner proof for every bond set, scoring.
- `src/games/bond-match/` — screens: `index.tsx` (the `GameDefinition`), `BondPicker.tsx`, `Board.tsx`, `Card.tsx`, `Finish.tsx`, `bond-match.css`, strings, sounds.
- `src/games/registry.ts` — one line, behind a `BOND_MATCH_ON` switch like the other new games.
- `supabase/functions/bond-match/` — only from M.4 (saving).
- A `vite.bond-match-preview.config.ts` + preview page, like the other games, to look at the game and screenshot it without logging in.

## 6. Saving and cheating

- **It can be replayed.** The deck comes from a seed and the engine is pure, so the browser sends *seed + bond + board size + the list of flips*, and the server rebuilds the game and checks it ends with the same flips and stars. Easy, unlike Gem Keep which couldn't be replayed.
- A game is saved **when it finishes** (and the browser queue re-sends if the Wi-Fi drops, with a run id so it saves once, the way Gem Keep does it).
- **Points (James said yes):** small taking-part points per finished game, capped per day (like the space game and Gem Keep), so grinding easy decks earns little. Bot and two-player games earn them too, at the same cap.
- The same plausibility check for time: a game faster than a human can flip is rejected.
- No class is ever blocked by this. If the server's down, the game still works and queues the save.

## 7. The maths ladder and teacher focus

This is the part that makes it more than a memory game.

- **Bond Match never writes to a student's fact record (James, 19 Oct 2026).** Many matches are guesses, so neither a match nor a mismatch counts. The game is practice and fun only. Stars, bests and points are the only things it saves.
- **The ladder still gets the new bonds**, through the other games: new bond fact keys (`bond100:30+70`, `bond1000:400+600`, `bondd1:0.3+0.7`, `bondf1:1/3+2/3`, next to the existing `bond10:` and `bond20:`) and a question pack for them, so Monsters, Space and Dragon Maths can ask them and those answers do build the records.
- **Ladder:** `bonds-100` and `bonds-1000` are existing stubs in `shared/maths/ladder.ts` (`built: false`). M.5 builds the question pack, adds the decimal and fraction bond skills where they belong on the ladder, and flips `built` to true. **That makes the new bonds appear in Auto for every other maths game too** (Monsters, Space, Dragon Maths), because they share the ladder. James said yes to this (19 Oct). It changes other games' behaviour once deployed, so it is still its own stage with its own go-ahead.
- **Teacher focus:** the existing focus system (teachers set what maths every game asks, per class or group, until Friday) gets "Bonds to 100" and so on as choices. Bond Match opens on the focused bond with a "Your teacher picked this week" label, and the student can still change it. Student's choice stays the default when no focus is set.
- **Auto:** picks the bond for the student's current rung. "Mixed" inside a shelf uses their weakest bond first.
- **Progress:** the "how far through am I" screens built in F.4 pick up the new skills automatically, from the other games' answers (not from Bond Match).

## 8. Two-player and bot (James said yes to both, 19 Oct 2026)

- **Pass-and-play** (2 players on one Chromebook): take turns, a match gives you another go, most pairs wins. Cheap, great for a lesson. M.6a.
- **Against a bot** (M.6b) with the hub's three levels: a bot *forgets* some cards and sometimes guesses wrong, scaled by level. Same engine; the bot only ever sees what's face up (a test proves it, the way the 101 bot is tested).
- **Live against a classmate** is possible but not planned. It would need the multiplayer tables and a lobby, and the game works well enough without it.

## 9. Stages (stop for James after each)

| Stage | What | Needs James? |
|---|---|---|
| **M.1** | Engine, bond sets, deck builder, one-partner proof, scoring, tests | No |
| **M.2** | Screens: picker, board, finish; browser-saved bests; preview page and screenshots | Looks at screenshots |
| **M.3** | Teaching touches: mismatch sum line, fraction pies, hundredths decks, hint, sounds, reduce-motion, keyboard play | Playtest |
| **M.4** | Saving: server function, replay check, points, per-bond stars on the student page, teacher view of stars | **Go to apply the migration and deploy** |
| **M.5** | Ladder and focus: bond question pack, flip the `bonds-100` / `bonds-1000` stubs, decimal and fraction bond skills, focus choices, Auto picking the bond | **Go (changes other games)** |
| **M.6** | M.6a pass-and-play, then M.6b bot | Playtest |
| **M.7** | Go-live: registry switch on, teacher guide paragraph, privacy summary line (no new personal data) | **Only when he says** |

M.1–M.3 can all be done and looked at without touching the database or any live game. Nothing goes live without James's yes at each point marked above.

## 10. Risks and how they're handled

- **Wrong-feeling decks.** A deck with two possible partners would feel unfair. The one-partner test runs on every bond set and every board size.
- **Too easy / too hard.** Bonds to 10 is only 5 pairs. Small boards and fewer decks keep it fair; the Mixed shelf and bigger bonds give the challenge. Star thresholds are tuned with real kids.
- **Memory vs maths.** A lucky or good-memory match isn't proof the child knows the bond, so Bond Match writes nothing to fact records. Only the other games' real questions do.
- **Fractions on a small card.** Stacked fractions can get tiny on a phone. Cards stay 64 px or more and the fraction text scales with the card.
- **Touching shared code.** Only M.5 touches `shared/maths/`, and it has the existing ladder, focus and pack tests plus new ones.
- **Cost.** One server call per finished game. A class playing a lesson a week is a few hundred calls a month against the 500,000 free.

## 11. James's answers (19 October 2026)

1. **Name:** Bond Match.
2. **Bond sets:** the list in section 2 stands (he didn't change it).
3. **Fact records:** **nothing Bond Match does counts towards a record**, because many matches are guesses (section 7).
4. **Small bond sets:** repeat pairs to fill the board (section 1).
5. **Hint button:** none picked, so none.
6. **Bot and two-player:** both yes (section 8).
7. **Ladder:** yes, link the new bonds to the shared ladder, through the other games (section 7).
8. **Points:** yes, small and capped.

## Stage M.4 results (19 Oct 2026)

**Built, tested, pushed on `bond-match`. APPLIED to the live database and the `bond-match` function DEPLOYED on 19 Oct 2026 (James approved). Not merged to main, game NOT on (M.7).**

- **Migration** `supabase/migrations/20261019001000_bond_match.sql`: tables `bond_match_games` and `bond_match_bests`, scoring into `scored_games` (new column `bond_match_game`), `record_bond_match_game()` (server only), `my_bond_match()`, `teacher_bond_match_student()` (own students only). `rebuild_progress`, `my_progress`, `teacher_students` and `teacher_new_season` are patched from their live definitions; each patch must find its text or the whole migration stops. A dry run on the live database (inside a transaction, rolled back) passed on 19 Oct 2026. *(Renumbered from `20261019000200` on 20 Oct 2026, because `main` already has `20261019000200_maths_auto.sql`. It was already applied live under the old name; renaming the file changes nothing live, so it must not be applied again.)*
- **Numbers chosen:** 2 points per finished game; only the first 10 games a New Zealand day earn points (so at most 20), inside the shared 40-a-day cap; a game faster than 0.5 seconds per card flip is refused; 100 games a day is the hard limit. Constants: `BOND_MATCH_SAVE` in `shared/bond-match/save.ts` and three small functions in the migration (keep them equal).
- **Server function** `supabase/functions/bond-match/` (rebuild with `node scripts/build-bond-match.mjs`): replays every game with the engine, ignores the browser's stars and flip count, saves once per run id, stops (keeping the queue) at the daily limit or when the database is busy.
- **Browser:** `src/data/bondMatch.ts` (queue in localStorage, send, load bests), finish screen "Saved / Will save when you are back online" with the points line, stars per bond on the picker, `BondMatchHub` (used by the game definition), teacher panel `src/pages/TeacherBondMatch.tsx` (shows nothing until a student has played).
- **Tests:** shared checks, SQL (`supabase/tests/database/bond_match.test.sql`, 36 checks, run on a scratch copy with the gem keep, security, monsters and lord SQL tests), handler, data, screens and teacher panel. Under load a few unrelated tests (101, Space, Training) time out; they pass when run alone.
- **Applied and checked live (19 Oct 2026):** the migration was applied in one transaction (after a rolled-back dry run); only the `bond-match` function was deployed. A call with no sign-in or a fake token gets 401. A test save for a real student account, run inside a transaction that was rolled back, saved once and earned 2 points; sending it again said "duplicate" and added nothing. The live tables are empty (0 games, 0 bests, 0 Bond Match scores), so nothing needed tidying. A save through the browser with a real sign-in has not been tried because the game is not reachable yet.
- **Still to do:** M.5 (needs James's go: it changes other games), then M.6 and M.7.

## Stage M.6 results (20 Oct 2026)

**James's order (20 Oct 2026): M.6, then go live with his class as the playtest, then M.5 (ladder and focus) as its own job.** Built, tested and pushed on `bond-match`. Nothing new is live.

- **Merged `origin/main`** (133 commits). Bond Match now follows the game guide: its student panel comes from its `GameDefinition`; `scripts/build-functions.mjs` lists it next to Marble.
- **Per-class switch** (migration `20261020000200_bond_match_switch.sql`): `app_settings.bond_match_enabled`, off everywhere; `teacher_set_bond_match(enabled, target_class)`; Bond Match's row in `hub_games` gets the switch and a How points work line ("Finish a game: 2 points, for your first 10 games each day."), shown only where it's on. The server function reads the switch (`settings_of`) and answers 403 while it is off, so nothing is saved and the website keeps its queue. The function also now uses `_shared/signIn.ts` (as the live copy already did since server-load S.5).
- **Two players and the computer:** a "Who's playing?" row on the picker: *Just me*, *Two players* (pass-and-play: a match goes again, a mismatch passes, most pairs wins) and *Me vs the computer* at Very Easy, Easy or Medium. The computer (`shared/bond-match/bot.ts`) only sees face-up cards, remembers 2, 5 or 8 of them and sometimes guesses (30%, 15%, 5%); it flips one card every 0.9 s, and waits 2.2 s after a child's mismatch so the sum can be read. A tap during its turn does nothing. These games are saved with `mode` 'pass' or 'bot', replayed by the server like any other, and earn the same capped points; they don't change bests or stars (a shared board isn't one person's memory). The finish screen says who won and the pairs each found.
- **Registry:** in `GAMES` (`BOND_MATCH_ON = true`, group "easy maths"), with `useTeacherSwitch`, so the card shows only where a teacher switched it on. Teacher page panel: the switch for the picked class.
- **Tests:** shared (bot plays every level to the end with legal flips that replay; more memory means fewer flips; turns and winner), server function (switch off → 403, settings unreadable → 503, modes), screens (players choice, two-player turns and winner, the computer playing by itself, taps ignored on its turn), registry. SQL: `bond_match_switch.test.sql` (18 checks) and the security list. Full run: typecheck, `test:all` (3,861) and build pass. On a scratch copy every database file passes except the three failures every copy has (two Clan Quest midnight-job checks, `maths_focus_results` check 42), which also fail without this migration.
- **Preview:** rebuilt and published as a private page for James.
- **Not done:** M.5 (after go-live); a playtest with real kids (James's class, at go-live).
- **Go-live:** `docs/prompts/bond-match-golive.md`: apply `20261020000200`, deploy `bond-match`, merge to main, then James switches it on for his class.

## New look and the matching rule (20 Oct 2026)

James said the picker was "really ugly" (the S/M/L pair counts meant nothing to him) and asked for a much better look. Redone: a banner with example cards; "Who's playing?" and "Board size" as big picture buttons (board sizes show a tiny grid and "12 cards"); bond tiles with the target in a coloured badge, an example sum and the stars for the chosen size; shelves in blue, teal and purple; a tidier game bar ("Make 10" badge, flips and time chips, round icon toggles); teal-to-violet card backs; matched pairs pop; the finish screen has stars that pop in and three number boxes, with "How do stars work?" folded away. The picker remembers the last board size. James: "it looks lovely". He then asked to **remove the A/B marks**: matching is now any two cards that make the target (`arePartners` in `shared/bond-match/deck.ts`); the game state records `pairedWith` and `matchNo` so each pair keeps its own colour. This needs the `bond-match` function redeployed (go-live step 2 does it); nothing was saved under the old rule (the live tables are empty).

## Going live (20 Oct 2026)

- **Step 1 done (James's yes):** `20261020000200_bond_match_switch.sql` applied to the live database. Checked: the switch is off for all 4 settings rows; `hub_games` has the switch and `bond_match_point_rules()`; `bond_match_games.mode` exists; teachers can call `teacher_set_bond_match`, signed-out users can't, pupils still can't save directly; `scored_games` still 412 rows, `bond_match_games` 0. Before applying, the live `record_bond_match_game` matched the repo's M.4 version (a copy was kept for undo).
- **Step 2 done (James's yes):** `bond-match` function deployed (version 3, Verify JWT off, `_shared/signIn.ts`, class-switch check, any-pair rule). Checked: signed out and a fake sign-in both get 401 "Please sign in again."; the browser check (OPTIONS) gets 204.
- **Next:** step 3, merge `bond-match` to `main` (publishes the site; Bond Match shows on the Teacher page, off).
