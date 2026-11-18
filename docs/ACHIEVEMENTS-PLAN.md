# Achievements review plan

Asked by James, 19 Nov 2026: "the achievements are not easy for kids to see what they have, how they earned them, what
they are missing and how to earn new ones." This plans a full review so a Year 4–6 pupil can open one place, see their
achievements as a lively, painted collection, and know exactly what to do next.

## 1. What we have today

- **About 280 achievements in about 40 groups** (every game, plus hub, homework and quests), all in the
  `achievement_types` table: `name`, `emoji`, `measure`, `goal`, `sort`. Earned ones are rows in `achievements`.
- **No "how to earn it" words.** The only text is the name. Some names say what to do ("Ride 25 wormholes", "Pass all
  10 Level Keys"), many don't: "Green Thumbs", "Firm Grip", "Loud and right", "Bracket builder", "Seasoned ruler",
  "Desert champion", "Kiwi's Golden Glow Jar". A pupil can't tell how to get those.
- **No "where" or "play now".** Nothing links an achievement to the game, let alone the right place in it.
- **Where pupils see them:**
  - Home page: an "Achievements" panel with the 3 nearest, as small emoji chips, "N of M", and "See them all".
  - Profile, "⭐ My achievements" fold: Earned (emoji chips), Nearly there (3 with bars), then Every game as a long text
    list, each behind its own "See all" button. Plain text and grey progress bars; no art.
  - Inside games: only Clan Quest (its own list with "how" words, and a small "New achievement!" line) and Diamond Drop
    (its own list, and a line on the level-end card). Their words live in game code, not the database, so they can drift.
- **Earning is silent almost everywhere.** Trophies have a big painted "new trophy" moment on hub pages
  (`NewTrophyMoment`); achievements have nothing outside Clans and Diamond. Most pupils never notice they earned one.
- **Badge achievements** (Silver, Gold, Champion in chess etc.) show "Not yet" with no idea what Silver needs.
- **Bars without numbers on the home page,** and goal-of-1 achievements show an empty bar that jumps straight to full.
- **Teachers** see only "N achievements" per game for each pupil.

## 2. What good looks like

A pupil can, in two taps from the home page:

1. **See what they have**: a painted collection, earned badges shining, with when they got each one.
2. **Understand how they got it**: every badge has a one-line "how" in kid words.
3. **See what's missing**: unearned badges show as dim silhouettes in the same places, never hidden.
4. **Know how to get the next one**: the badge card says what to do, shows progress ("7 of 10 wormholes"), and has a
   **Play** button that opens the game.
5. **Feel it when it happens**: a flashy earn moment, in the game and on the hub.

## 3. The plan, in stages

Each stage is its own PR, carried to live.

### Stage 1: words (database + one review pass)

**Built 19 Nov 2026** (migration `20261119000100_achievement_words.sql`): all 236 achievements have a `how` sentence and a
tier (45 easy, 97 medium, 94 hard), 64 unclear names got a short hint, `my_progress` returns both, and My achievements
shows the sentence under each name (the home page's small chips show it on hover). Clan Quest's and Diamond Drop's own
lists still keep their own words in code (`shared/clans/rewards.ts`, `shared/diamond/config.ts`), with the new names;
stage 4 swaps them for the shared panel. The early games' step achievements say "Reach step N": check in stage 2 that
pupils can see step numbers in those games.

- Add to `achievement_types`:
  - `how text not null`: one plain sentence, "Win 5 games against a bot on Easy." Written for every achievement.
  - `tier smallint` (1 easy, 2 medium, 3 hard): drives the badge frame (bronze, silver, gold) and sort.
- **Rename the unclear ones** so the name alone hints at the deed, keeping the fun ("Green Thumbs: 5 farms").
  Ids never change, so nothing earned is lost.
- Badge (`rank`) achievements get a `how` that says what the badge means ("Reach a Silver badge: win more than you lose
  against classmates…") and a link to How points work.
- `my_progress` (and `my_home_page`) return `how`, `tier`, and leave out games switched off for the pupil's class
  (check this; hide them, don't show them as missing).
- Clan Quest and Diamond Drop read their words from the same place, so there's one list.
- A test that every achievement has a `how`, so new games can't skip it (fold into an existing test; budgets are full).
- Game guide: "every new achievement needs a `how` and a `tier`".

### Stage 2: the Achievement Hall (new page, art-first)

**Built 19 Nov 2026** (`src/achievements/`): `/achievements`, full window over the hub bar with the painted hall
(`hall.webp`, and `hall-tall.webp` on portrait screens), Hub, sound and "My trophies" in a slim row on top. A top strip
with "N of M", a ring that fills as the Hall opens (the number counts up) and three "Next up" medallions; filter chips
(All · Earned · Nearly there · Not started) and a game picker, remembered per device (`localStorage`
`achievement-hall`), with a sparkle on change; one shelf per game with its home card painting as the banner, "5 of 12"
and a mini bar, each row of medallions standing on a painted plank. Medallions use painted bronze, silver and gold
frames by tier (earned: shine sweep and twinkles) and a stone frame with a progress ring in the tier's colour (not yet).
Tapping one zooms a badge card out of it: tier, name, `how`, "7 of 10" (badges and one-offs: Not yet / Earned), "Earned
on Tuesday 12 November" (NZ time), "+10 points", and a Play button (homework and class quests go to the home page).
Linked from the home panel's "See them all" and a painted button at the top of the Profile fold. Not in the top bar:
one more link there made the bar wider than a 1366px classroom laptop (teachers have a sixth link too). Reduced motion stops the drift, sweeps, twinkles, ring fills and zooms. Art: `docs/achievements-art/config.json`
(`scripts/game_art.py achievements`). The home preview (`preview/home`, `#/achievements`) shows the real list, made from
the migrations into `preview/home/achievements.json` by a one-off script.

Learned while building:
- Shelf order needs no new data: `my_home_page().topGames.mine` (most played, 14 days) goes first, then anything
  started, then untouched games.
- The early games (Robin, Pigeon, Parrot, Lizard, Swamp Hen) do show "Step N: name" in play, so "Reach step N" stays.
- The Profile fold's "Every game" list is still there; the Hall covers everything it shows (ask James before removing).
- The site has no dark mode of its own (only the three page themes); the Hall is a dark painting in every theme.

**What stage 3 needs** (the earn moment):
- Database: `seen_at timestamptz` on `achievements`, `my_new_achievements()` (unseen, newest first, with name, emoji,
  how, tier, game) and `mark_my_achievements_seen()`, both granted to `authenticated` and added to the allow-list in
  `security.test.sql`; the count in `progress_access.test.sql` if achievement types change.
- Which save functions already return what was just earned, and adding it where missing, so a game's result screen can
  show it straight away.
- A shared `AchievementPop` (reusing `Medallion` and the frames from `src/achievements/`): medallion slides in with a
  burst, name, "+10 points", "See it" to `/achievements`; swapped into Clans' and Diamond Drop's own lines first.
- A hub moment like `NewTrophyMoment` (same hub pages list), queuing several, then "and 3 more"; the medallion flies to
  its shelf when opened from the Hall. Paint a burst/sparks sheet; a short chime through the hub sound switch.

- **`/achievements`**, its own page (the Profile fold becomes a big button to it; "See them all" on home goes there).
- **Painted hall backdrop** filling the window (ComfyUI, painted for this): a grand hall of shelves or a starry trophy
  wall; Hub + sound in a slim top row, as in the full-window games.
- **Top strip**: "42 of 280", a big progress ring, and three "Next up" badges.
- **One shelf per game**, using the game's own card painting as the shelf's banner, with "5 of 12" and a mini bar.
  Games the pupil plays most come first; untouched games later.
- **Badges as medallions**: the emoji on a painted bronze/silver/gold frame (by tier). Earned ones shine and slowly
  twinkle; unearned ones are a dim silhouette with a progress ring round the edge.
- **Filters** as big chips: All · Earned · Nearly there · Not started, and a game picker.
- **Tap a badge → badge card** (pops up with a flourish): big medallion, name, the `how` sentence, progress in words
  ("7 of 10 wormholes"), earned date ("Earned on Tuesday 12 November"), bonus points, and **Play [game]**.
- Works on iPad and phone; reduced motion turns the twinkles off.

### Stage 3: the earn moment

- **In the game**: when a save returns new achievements, a shared `<AchievementPop>` slides a medallion in with a burst,
  name and "+10 points", and a "See it" link to the Hall. One shared component replaces the Clans and Diamond lines and
  goes into every game's result screen. The save functions report what was just earned (most `*_save` functions
  already know; add where missing).
- **On the hub**: like the trophy moment, unseen achievements (add `seen_at` to `achievements`) show once on hub pages:
  the medallion flies onto its shelf. Several at once queue up, then "and 3 more" so it never nags.
- Sound: a short chime, through the hub sound switch.

### Stage 4: achievements inside each game

- Each game's home/map screen gets a small **🏅 3 of 12** button that opens the Hall's shelf for that game in a panel,
  so pupils see a game's goals while they're playing it.
- Clan Quest and Diamond Drop's own lists are swapped for this.

### Stage 5: home page and teachers

- Home panel: "Next up" as three medallions with their `how` line and Play buttons, instead of small chips.
- Teacher pupil page: the pupil's shelves (read-only), so a teacher can say "you're 2 wins off Desert champion".
- A class view showing which achievements most of the class has, to spot ones nobody can reach (too hard or
  unclear words).

## 4. Art and animation

- Paint in ComfyUI on this PC, as part of each stage:
  - The Hall backdrop (1536×864, plus a portrait crop for phones).
  - Three medallion frames (bronze, silver, gold) and a locked/silhouette frame, as transparent PNGs.
  - A shelf/plinth strip to sit under each game's row.
- Animation: shine sweep on earned medallions, progress ring filling as the Hall opens, badge card zooming from its
  shelf, earn burst with sparks, medallion flying to its shelf.

## 5. James's answers (19 Nov 2026)

- **A. Secret achievements:** no. Every achievement is always visible, with how to earn it. (Drop the `secret` column.)
- **B. Trophies:** kept separate. The Hall is achievements only and links to the trophy cabinet.
- **C. Tiers:** yes. Easy/medium/hard set by goal size, shown as bronze/silver/gold frames; any can be changed later.
- **D. Renames:** yes. Unclear names change to hint at the deed, keeping the fun ("Green Thumbs: build 5 farms").
  Ids stay, so nothing earned is lost.
- **E. Teacher class view:** yes, in stage 5.

## 6. Order and size

1. Words (stage 1): one PR, mostly writing 280 `how` lines; nothing looks different yet except clearer names.
2. Hall (stage 2): biggest; painting + new page.
3. Earn moment (stage 3).
4. In-game buttons (stage 4), a few games per PR.
5. Home + teacher (stage 5).
