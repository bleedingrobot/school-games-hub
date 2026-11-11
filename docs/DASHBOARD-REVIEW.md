# Dashboard review: the pupils' home page

*Review only, 11 November 2026, from `main` at 4d24fb4, the home preview (`preview/home`, made-up pupil, every class switch on) and read-only counts from the live database. No code was changed. Screenshots and mock-ups are in the project files folder `dashboard-review/`. The step-by-step plan with copy-ready prompts is also on the "Dashboard Plan" artifact page: https://claude.ai/artifact/JQ6WqLGiEMCiNsHG8pnSm6*

**One goal:** a child should find the right game and start playing in a couple of taps.

## Summary for James

- **The page is built for nobody in particular.** Every class sees the same 30 cards in the same order, with the 12 early-years games first. Room Riley (Year 6, 31 pupils, the only class with a year level) scrolls past all 12 to reach its games. The home page never reads the class's year level.
- **The kids have already voted.** 38 of the 45 pupils with a saved layout have pinned games. The most pinned are Dragon Maths (21), Archery (18) and Diamond Drop (13), which are also the most played in the last 14 days (Dragon Maths 634 goes, Archery 301, Sky Isles 284, Clan Quest 179). Without a pin, Dragon Maths is card 28: about 14 phone screens down.
- **The big Play button always starts Chess vs the Easy bot**, for everyone.
- **The page jumps while it loads** (layout shift 0.80; "poor" starts at 0.25) because each game's switch loads on its own and cards pop in one by one.
- **Mostly honest cards.** Moves left, unlimited days, next-part chips and switches all match the games. Three things don't: six games that are live for every class still say "In development" to pupils, Royal Decree shows Kingdom Keeper's picture, and Training is a plain box unlike every other card.
- **Heavy first load and a lot of copying to add a game.** The home page pulls in 107 script files (about 436 KB zipped), and a new game's card touches 5 to 7 files, including a copied 20-line switch hook (22 copies today).

**The plan (section 6), in order:** D1 honest labels, D2 a "My games" row in place of the big Play button, (D3 dropped), D4 games still going in one line, D5 no more jumping, D6 smaller cards on phones, D7 lighter first load, D8 adding a game in one place, D9 check it as a child would. James decided (11 Nov): the early-years games stay at the top for every class, and the big Play button is removed.

## 1. What's there now

Top to bottom, for a signed-in pupil (teachers see the same cards):

1. **Hero:** avatar (tap to change), "Kia ora, <name>", points level and bar, "How points work", rank badges for chess and checkers only, a big yellow **Play** (always the first game, Chess, vs the Easy bot, unless the pupil changed a bot level on a card this visit), and a **Class Warp** button.
2. **Training gate banner** (only when Training-first is on and today's session isn't done; cards look resting).
3. **Class Warp card:** "Join your class!" for a pupil not in a class yet.
4. **Games still going:** one full-width row per game with classmates (Power Clash, 101, Wormholes, up to 2 chess or checkers games), each with Carry on, then "N more... see them in the lobby".
5. **Game sections**, each with a Hide/Show fold and a count when folded, cards in a grid (300 px minimum width):
   - Pinned (only if something is pinned), in pin order.
   - Foundational skills: 11 early-years games plus Quick looks (placed after Robin): 12 cards.
   - Non-maths games: Chess, Checkers, 101, Power Clash (4). Hidden when the class has non-maths games off.
   - Training: one plain tile, "Multiplication and division training".
   - Easy maths games: Wormholes, Gem Keep, Marble Rush, Bond Match, Mine Runner, Archery, Diamond Drop, Sky Isles, Royal Decree, Toon Flap (10).
   - Complex maths games: the Clan Quest and Dragon Maths season strips, then Maths Monsters, Dragon Maths, Clan Quest, Star Trader (4).
6. **Each card:** painted scene (all 30 have one), optional "In development" tag, a "📌 Pin to top" tick box, name, tagline, an optional note (Maths Monsters' spotted monster), an optional next-part chip (11 Foundational games), "Left today" chips (Dragon Maths, Clan Quest, Maths Monsters, Diamond Drop, Star Trader, Sky Isles), a bot level picker (chess, checkers, 101, Power Clash, Wormholes) and a "Play <name>" button carrying the picture.
7. **Quick links:** Play a friend, Leaderboard, See my stats.
8. **Panels:** Recent games (last 3 against bots and classmates only; single-player games like Dragon Maths never show here), My maths (focus and maths path), Achievements (next few, "N of M").

Measured in the preview (every switch on, 30 cards):

| Screen | Page height | Where Dragon Maths' Play button is |
|---|---|---|
| Phone 390 × 844 | 13,506 px | 11,741 px (about screen 14) |
| iPad 1024 × 768 | 5,910 px | 4,981 px (screen 7) |
| Laptop 1366 × 768 | 6,042 px | 5,125 px (screen 7) |

Pictures: `now-laptop-top.jpg`, `now-phone-top.jpg`, `now-laptop-cards.jpg`, `now-laptop-whole.jpg`.

**Young class vs older class.** Live has one real class with a year level (Riley, Year 6), a Starter class (104 pupils, 24 played in the last 14 days, no year level) and Teachers. Every switch is on for all of them, so a Year 1 pupil and a Year 6 pupil see exactly the same page. For a Year 1 pupil the order is right (Foundational first) but the Play button still starts Chess. For a Year 6 pupil the first 12 cards are for 5 to 8 year olds.

## 2. Is it easy for kids?

- **Too far to the right game.** See the table. On a phone a busy pupil scrolls 2 screens of "still going" rows before the first card.
- **Pins are a workaround, not a feature.** 38 of 45 layouts have pins. The rest of the page doesn't learn from what a child plays.
- **Order of sections.** Foundational first is right for juniors and wrong for Years 4 to 8. Training sits between Non-maths and Easy maths with a different look. The season strips (useful, "Grimmor comes in 5 days!") sit at the very bottom of the games, under the Complex maths heading.
- **Crowded cards.** Every card repeats "📌 Pin to top", and five cards carry a three-way bot level picker. On a phone each card is full width and about 300 px tall.
- **Easy to miss.** Recent games only covers bot and friend games, so it misses the games the class plays most. My maths is in the bottom panel row.
- **Art.** Every card has a painted scene in the same clay style except Training (a plain tile). Royal Decree reuses Kingdom Keeper's scene.
- **32 games.** Today there are 30 cards (28 games, Quick looks, Training; Kingdom Keeper is off in code). Two more fit, but each adds about 310 px on a phone. With D2 and D3 the length stops mattering much, because a child's own games are at the top.

## 3. Is it right?

Checked against the code (`src/data/movesLeft.ts`, `shared/unlimited.ts`, `src/data/nextParts.ts`, each game's switch).

| Card part | Right? | Notes |
|---|---|---|
| Turns left (6 games) | Yes | Rolls the day forward the way each game does (Dragon Maths' rollDay, Trader's jumps, Isles' saved turns). |
| Unlimited turns today | Yes | Exactly the 6 games in `UNLIMITED_GAMES`. Dragon Maths' master tries aren't lifted, which matches "lifts forest and arena fights". |
| Next-part chip (11 Foundational games) | Yes | One request, only when one of those games is showing. Quick looks has no chip. |
| Teacher switches | Yes, but slow to show | A card hides until its switch says on, so nothing flashes up, but cards arrive one by one (section 4). |
| Non-maths off | Yes | Hides that section, the still-going rows for those games, and moves the Play button to a maths game. |
| Kingdom Keeper | Fine | Off in code; one pupil's pin of it waits quietly. |
| "In development" tag | **No** | Shown to pupils on Robin, Parrot, Lizard, Pigeon, Swamp Hen and Toon Flap, all live and on for every class. |
| Royal Decree picture | **No** | Uses Kingdom Keeper's picture. |
| Hero Play | **Misleading** | "Chess vs Easy bot" for every pupil. |

## 4. Speed and upkeep

**Speed** (home preview, 1024 × 768, CPU slowed 4×, 10 Mbps, served without compression):

| Measure | Now |
|---|---|
| Script files on the home page | 107 |
| Script size | 1,270 KB (about 436 KB zipped) |
| Pictures | 701 KB for 39 pictures (lazy, small versions) |
| Hero shows | 3.0 s |
| First card shows | 3.3 s |
| Largest paint | 2.5 s |
| Layout shift | **0.80** (good is under 0.1) |

The biggest home-page scripts: the main bundle (511 KB), the maths ladder (116 KB), the games list (105 KB), plus a small file of rules for nearly every game. The pictures are fine.

**Upkeep.** Adding a game's card today touches: its `index.tsx`, a copied switch hook in `switch.ts` (22 near-identical copies), `registry.ts` (two imports and a GAMES entry), `registry.test.ts`, `gameCardArt.ts` (two imports and a line), `GAME_IDS` for a Foundational game, and Dashboard code for anything that isn't a registry game (Quick looks' `quickLooksAt`). Season strips are hand-written into the Dashboard and two database functions.

## 5. How the numbers were measured

1. Build the preview: `npm run home:preview`, serve `dist-preview-home/` (e.g. `python3 -m http.server 8811`). For a page like live, set every `*_enabled` column to true in the fake `app_settings` row in `preview/home/fakeSupabase.ts` (don't commit that).
2. Playwright: open `http://localhost:8811/index.html#/`, wait for network idle, read `.game-group` and `.game-card` positions, `document.body.scrollHeight`, and the Play button of `game-dragon-maths-title`.
3. Speed: a CDP session with `Network.emulateNetworkConditions` (latency 40 ms, 10 Mbps) and `Emulation.setCPUThrottlingRate` 4; times to `.hero h1` and `.game-card`, PerformanceObserver for `largest-contentful-paint` and `layout-shift`.
4. Live counts (read only): pins and folds from `home_layouts`, goes per game from `scored_games` for the last 14 days, classes and their `*_enabled` switches.

## Mock-ups

Made by changing the preview page in the browser, so they show real cards and art. `mock-laptop-my-games.jpg`, `mock-ipad-my-games.jpg`: games still going in one line (the Play button shown is now to be removed), My games row with chips, then the sections. `mock-phone-two-per-row.jpg`: two smaller cards per row on a phone. `compare-phone.jpg`: the first three phone screens, now and suggested. With all changes the phone page drops from 13,506 px to about 5,500 px and Dragon Maths' Play button moves from 11,741 px to about 990 px (the second screen).

## 6. The plan, in priority order

Each card is one PR. D2 is a database change. The prompts are on the Dashboard Plan artifact and the Games Hub Prompts board (dashboard-d1 to dashboard-d9).

| Card | What the pupil gets | Size | Database | Waits for |
|---|---|---|---|---|
| D1 | Labels that tell the truth; every card looks the same | S | no | nothing |
| D2 | Their own games at the top | M | yes | nothing (James chose to remove the Play button, 11 Nov 2026) |
| D3 | (dropped) | M | yes | Dropped: James chose to leave the early-years games at the top for every class |
| D4 | Games still going take one line, not five | S | no | nothing |
| D5 | No jumping cards while it loads | S | no | nothing |
| D6 | Half-length page on a phone | M | no | D2 |
| D7 | Faster first load on a school iPad | M | no | nothing (run before D8) |
| D8 | (For us) a new game card in one place | S | no | D5 and D7 |
| D9 | Checked with real accounts | S | no | D1 to D8 |

### D1. Honest labels and one card look (size S)

**What's wrong:** Six games that are live for every class (Robin, Parrot, Lizard, Pigeon, Swamp Hen, Toon Flap) still show pupils a yellow 'In development' tag. The Training tile is a plain white box, unlike every other card. Royal Decree shows Kingdom Keeper's picture, a game pupils no longer have.

**Done looks like:** Pupils never see 'In development' on a game that is on for their class (teachers still do, so they know it's new). Training is an ActivityCard like Quick looks, with its colours (a picture once James paints one). docs/HOME-ART-PLAN.md lists the two paintings still needed: Royal Decree and Training.

**Steps:**

1. src/components/GameCard.tsx: show `game-card__dev` only when `useAuth().profile?.role === 'teacher'` (pass a `teacher` prop from Dashboard rather than calling the hook inside the card). Leave each game's `inDevelopment` flag as it is.
2. src/pages/Dashboard.tsx: replace the Training `link-tile` with `<ActivityCard id="training" name="Times tables training" tagline="A few minutes a day to build your facts" to="/training" colours={['#2f6fb5', '#7fc4e8']} pinned... />` so it can be pinned too.
3. docs/HOME-ART-PLAN.md: add a 'Still to paint' list with a ComfyUI prompt for Royal Decree (a throne room with a scroll and wax seal, clay style like the others) and Training (an abacus on a classroom desk). Don't paint them; James does that on his PC.

**Files:** src/components/GameCard.tsx, src/pages/Dashboard.tsx, docs/HOME-ART-PLAN.md, GameCard.test.tsx

**Tests:** Update GameCard.test.tsx: a pupil doesn't see 'In development', a teacher does. Check DashboardHome tests still pass with the Training card.

**Waits for:** nothing

### D2. 'My games' at the top instead of the big Play button (size M, database change)

**What's wrong:** The big yellow Play button always starts Chess against the Easy bot, for every pupil. Room Riley's favourite, Dragon Maths, is the 28th card: about 14 phone screens down (y 11,700 px) and 6 laptop screens down. 38 of 45 pupils with a saved layout have pinned games to get round this.

**Done looks like:** Straight under the hero, a 'My games' row: the pupil's pinned games first, then the games they played most in the last 14 days, up to 4 cards (cards in this row hide the tagline and bot level picker to stay short). It replaces the Pinned section; the 📌 box still adds and removes. With nothing pinned or played it shows the class's 4 most played games, titled 'Popular in your class'. The big yellow Play button and its 'Chess vs Easy bot' hint are gone from the hero (James, 11 Nov 2026); Class Warp stays. The season strips sit under My games when Clan Quest or Dragon Maths is in it. Looks like mock-laptop-my-games and mock-phone-two-per-row, without the Play button.

**Steps:**

1. Migration `<next>_home_my_games.sql`: edit `public.my_home_page()` in place (its latest body is in supabase/migrations/20261102000300_home_chips.sql; check nothing newer defines it). Add `'myGames'`: the caller's game ids from `public.scored_games` with `finished_at > now() - interval '14 days'`, grouped by game, ordered by count desc, limit 4, and `'classGames'`: the same top 4 for the caller's class (`current_class_of(auth.uid())`, through class_members), for a pupil with no games yet.
2. src/data/homePage.ts: parse the two new parts (null-safe; an old database without them leaves the row as it is now).
3. src/pages/Dashboard.tsx: remove the hero's Play link, its hint line, and the `featured`/`featuredGame` state (cards still keep their own bot level). Build `myTiles` = pinned (in pin order) then myGames, without repeats, only games in `tiles`, max 4. Render it as the first GameGroup with id 'pinned' (keep the id so saved folds still work) and title 'My games'; add `className="game-grid game-grid--mine"`. A game shown in My games is NOT removed from its own section (only pinned ones are, as now).
4. Move the `season-strips` block so it renders under My games when clan-quest or dragon-maths is among myTiles; otherwise leave it in Complex maths.
5. CSS in src/styles.css (this is a shared-file card, so it's allowed here): `.game-grid--mine` columns `minmax(min(100%, 230px), 1fr)`, and inside it hide `.game-card__text > p:not(.game-card__note)` and the bot level picker.

**Files:** new migration; src/data/homePage.ts; src/pages/Dashboard.tsx; src/styles.css; src/pages/homePageFake.ts (add the parts to the fake answer); DashboardLayout.test.tsx

**Tests:** Two tests at most: My games orders pins then most played and stops at 4; the hero has no Play button. Scratch-DB check (scripts/scratch-db.sh) that myGames counts only the caller's games. RequestCount test: still one my_home_page request.

**Waits for:** nothing (James chose to remove the Play button, 11 Nov 2026)

### D3. Dropped: older classes see their own games first (James kept the early-years games at the top, 11 Nov) (size M, database change)

**What's wrong:** Every class sees the 12 Foundational (ages 5 to 8) games first. Room Riley is Year 6, so its pupils scroll past 12 junior games to reach theirs. The pupil home page never reads the class's year level, although every class has one.

**Done looks like:** For a class with year level 4 or more, Foundational skills moves to the bottom, folded, titled 'Foundational skills (for younger learners)' with '12 games' on the fold. Years 0 to 3 keep it at the top, open. A class with no year level (Starter) keeps today's order. A pupil who opens or folds it keeps their own choice (the saved layout wins).

**Steps:**

1. Migration `<next>_my_class_year.sql`: `create or replace function public.my_class()` (body in supabase/migrations/20261018002400_classes_and_warp.sql, check nothing newer defines it) adding `'yearLevel', (select c.year_level from public.classes c where c.id = public.current_class_of(auth.uid()))`. my_home_page already sends my_class() as `myClass`.
2. A tiny helper in src/data/homePage.ts: `yearLevelOf(home)` -> number | null.
3. src/pages/Dashboard.tsx: `GAME_GROUPS` order comes from a function `groupOrder(yearLevel)`; for >= 4, foundational goes last and is folded by default. In src/data/homeLayout.ts, let `isCollapsed(id, byDefault)` take a default so a saved choice still wins (a layout that never touched 'foundational' gets the default).
4. If James picked 'Hidden unless teacher turns on' instead, do that rather than step 3: hide the group for Year 4+ unless a new class setting `foundational_for_older boolean default false` is on (teacher_set function using require_settings_target(), shown on the teacher's Games tab).

**Files:** new migration; src/data/homePage.ts; src/data/homeLayout.ts; src/pages/Dashboard.tsx; DashboardLayout.test.tsx

**Tests:** One test: year 6 puts Foundational last and folded, year 2 first and open, null as today. Scratch-DB: my_class() returns yearLevel for a pupil in a Year 6 class.

**Waits for:** Dropped: James chose to leave the early-years games at the top for every class

### D4. Games still going in one line (size S)

**What's wrong:** Each game still going with classmates gets its own full-width yellow row with a Carry on button: up to 5 rows, plus a link. On a phone a busy pupil scrolls about 2 screens before reaching any game.

**Done looks like:** One yellow row: '6 games still going:' followed by a chip per game (emoji + short name, opponent's name for chess and checkers), each chip a link that carries on. More than 4 shows '+2 more', linking to the lobby. Chips wrap on a phone. Looks like the top of mock-laptop-my-games.

**Steps:**

1. src/pages/Dashboard.tsx: replace the `in-progress` section's GoingLine rows with one `<section className="in-progress in-progress--chips">` holding a label and up to 4 `<Link className="going-chip">`. Keep the same order (Power Clash, 101, Space, then friend games) and the same links.
2. src/styles.css: `.going-chip` as a pill (min-height 44px, the existing yellow), wrapping flex row.

**Files:** src/pages/Dashboard.tsx; src/styles.css; tests that look for 'Carry on'

**Tests:** Update the existing in-progress tests: one chip per game with the right link, '+N more' past 4.

**Waits for:** nothing

### D5. Stop the page jumping while it loads (size S)

**What's wrong:** Each game's teacher switch loads on its own, and a card stays hidden until its switch says yes, so cards pop in one by one and the page jumps. Measured layout shift on the home page is 0.80 (anything over 0.25 is 'poor'). A child who taps as the page settles can open the wrong game.

**Done looks like:** The cards appear together, once, from one settings read. While it loads the page shows the pupil's last list of cards (remembered on the device) or grey placeholders the same size as cards. Layout shift under 0.1 in the home preview.

**Steps:**

1. New `src/data/classSwitches.ts`: `useClassSwitches(columns: string[])` -> `Record<string, boolean> | null`, one `readSettings(columns)` call (it already shares one remembered request).
2. src/games/types.ts: add optional `switchColumn?: string` to GameDefinition and set it in each game with a switch (robin -> 'robin_enabled', etc.; the list is in the app_settings `*_enabled` columns). Keep `useTeacherSwitch` working for any game without `switchColumn` so nothing breaks.
3. src/pages/Dashboard.tsx `useShownGames`: use `useClassSwitches` for every game with a `switchColumn`; null means still loading. While loading, render the ids remembered in localStorage `home-cards:<profile id>` (try/catch), or 6 placeholder cards; save the shown ids once loaded.
4. Give `.game-card__moves` and the next-part chip a reserved min-height only where the game has chips (`game.nextPart` or a moves game), so chips arriving later don't push cards.

**Files:** new src/data/classSwitches.ts; src/games/types.ts; src/games/*/index.tsx (one line each); src/pages/Dashboard.tsx; src/styles.css

**Tests:** One test: with switches still loading, the remembered cards show and no card is added or removed when they arrive unchanged. Measure layout shift in the preview with a PerformanceObserver script and put the before/after number in the PR.

**Waits for:** nothing

### D6. Smaller cards on phones and iPads in portrait (size M)

**What's wrong:** On a phone each card is full width and about 300 px tall, so 30 cards make a page 13,500 px long. Every card repeats a 'Pin to top' label, and the bot level picker takes a row on chess, checkers, 101, Power Clash and Wormholes.

**Done looks like:** Under 700 px wide: two cards per row, picture 4:3, the name, any chips, and the Play button (tagline hidden). The pin box shows just 📌. The bot level picker becomes a small 'Easy ▾' chip on the card that opens the three levels. The phone page is about 40% as long. Looks like mock-phone-two-per-row.

**Steps:**

1. src/styles.css: a `@media (max-width: 700px)` block for `.game-grid` (2 columns, gap 8px), `.game-card__pic` (aspect-ratio 4/3), `.game-card__body` (tighter margin and padding), h3 0.95rem, hide `.game-card__text > p` except `.game-card__note`, and keep the Play button at least 44 px tall.
2. src/components/GameCard.tsx: the PinBox text is visually hidden on narrow screens (keep the aria-label). Replace the joined BotLevelPicker on narrow screens with a `<details>` chip showing the current level, holding the same picker.
3. Check the 'Soft and bright' and 'Game menu' themes (src/styles.css `[data-hub-theme=...]`) still look right.

**Files:** src/styles.css; src/components/GameCard.tsx; src/components/BotLevelPicker.tsx if needed

**Tests:** Clan Quest's Accessibility.test.tsx style: one test reading the CSS that the narrow Play button keeps 44 px. Screenshots at 390x844, 844x390 and 820x1180.

**Waits for:** D2

### D7. Lighter first load on a school iPad (size M)

**What's wrong:** Opening the home page downloads 107 JavaScript files, about 436 KB zipped (1.3 MB unzipped), because the games list imports every game's definition and with it rules, configs and the maths ladder (116 KB). With an iPad-like slow CPU and 10 Mbps the cards show after about 3.3 s.

**Done looks like:** The home page loads only what the cards need: names, taglines, colours, groups, icons, switch columns and chips. Each game's screens and rules load when the pupil presses Play. Home page JavaScript at least a third smaller, cards showing in under 2.5 s in the same test.

**Steps:**

1. Measure first: run the preview speed script described in docs/DASHBOARD-REVIEW.md section 5 (4x CPU slowdown, 10 Mbps, 1024x768) and note files, KB zipped and time to the first card.
2. Find what pulls rules onto the home page: build with `npx vite build --config vite.home-preview.config.ts` and look at which game modules land in the home chunks (each src/games/<id>/index.tsx imports its Play screen and teacher parts; make those `lazy()` where they aren't, and move any rules imports used only for the card's text into a small `card.ts`).
3. `MathsFocusCard` and `MathsPathCard` are lazy but the ladder still arrives early: check who imports shared/maths/ladder on the home path and lazy-load it.
4. Don't change what any card shows.

**Files:** src/games/*/index.tsx (lazy imports only); src/pages/Dashboard.tsx; src/data/movesLeft.ts if it pulls game rules (it imports shared/lord, shared/monsters, shared/diamond, shared/trader, shared/isles helpers: move the few small helpers it needs, or keep them if they're small)

**Tests:** No new tests. Put the before and after numbers in the PR. The full npm test must pass (some tests import games directly).

**Waits for:** nothing (run before D8)

### D8. Adding a game to the home page in one place (size S)

**What's wrong:** A new game's card touches 5 to 7 places: its index.tsx, a copied 20-line switch hook (22 copies today), registry.ts (two imports and a GAMES entry), registry.test.ts, two imports and a line in gameCardArt.ts, GAME_IDS in src/data/foundational.ts, and special code for Quick looks' place.

**Done looks like:** A new game needs: its GameDefinition (with group, switchColumn and an optional `after: '<game id>'` for its place), its line in registry.ts, and two picture files dropped into src/assets/home/ (found by name, no import lines). The guide says so.

**Steps:**

1. src/components/gameCardArt.ts: replace the imports with `import.meta.glob('../assets/home/*.webp', { eager: true, query: '?url', import: 'default' })`, pairing `<id>.webp` and `<id>-small.webp`; keep a small `FOCUS` map for crop positions and an `ALIAS` map (decree -> kingdom until its own picture exists).
2. Delete the copied switch hooks only where D5's `switchColumn` replaced them on the home page and nothing else imports them (search first; game pages may use them).
3. Quick looks: give ActivityCards an `after` id and place them with one generic function instead of `quickLooksAt`.
4. Update docs/GAME_DEVELOPMENT_GUIDE.md section 2 'Home page card picture' and the section 3 'Dashboard' row to the new way.

**Files:** src/components/gameCardArt.ts; src/pages/Dashboard.tsx; src/games/*/switch.ts (only if unused); docs/GAME_DEVELOPMENT_GUIDE.md

**Tests:** An art test: every game in GAMES has a picture or is on a short 'not painted yet' list, and there's no spare picture.

**Waits for:** D5 and D7

### D9. Check it as a child would, and close the review (size S)

**What's wrong:** The review was done on the home preview with made-up data. Nobody has checked the new home page with a real pupil account in each class type.

**Done looks like:** Screenshots of the live home page as a Year 6 pupil and as a Starter pupil (James's test accounts, or a teacher's Class view) on phone, iPad and laptop, in docs/DASHBOARD-REVIEW.md 'After' section; every card's chip checked against the game (moves left, next part, unlimited day). HANDOVER.md all ticked; project memory home-layout updated.

**Steps:**

1. Ask James on a question card for a pupil test account, or use the teacher's own home page (teachers see the same cards).
2. Re-run the section 5 speed and layout-shift measurement and the 'taps to Dragon Maths' count, and add the numbers next to the 'Before' ones.
3. Update the project memory file for the home page layout.

**Files:** docs/DASHBOARD-REVIEW.md; docs/plans/dashboard/HANDOVER.md

**Tests:** None new.

**Waits for:** D1 to D8

## Decisions (James, 11 Nov 2026)

1. Early-years games for Year 4+ classes: **leave them at the top**. D3 is dropped; My games (D2) is how older pupils reach their games quickly.
2. The big Play button: **remove it**. D2 puts My games in its place.
