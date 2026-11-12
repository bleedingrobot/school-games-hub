# Profile and trophies plan (P1 to P12)

The reasons are in [../../PROFILE-REVIEW.md](../../PROFILE-REVIEW.md). Run the cards in order unless a card says it waits for nothing. Each card below has what to build and one copy-ready prompt.

Every prompt assumes these standing rules, so they are not repeated in full each time:

- Reply to James in short, plain words.
- Work in your own worktree on a new branch from `origin/main`. Never commit to `main`.
- Read `docs/game-guide/README.md` and the parts it points to before changing anything.
- The server decides everything that counts. The browser never awards a trophy, a picture or a name.
- Never show a pupil's maths results or year level to classmates, and never rank pupils by maths.
- New features go live switched on. Open a PR, and merge it once the checks pass. Ask James before running a migration on the live database by hand or deleting anything.
- Don't wait for art: use the placeholder named in the card, and swap the painting in when it lands.

## Shared design (read before P3 to P12)

- **Hub season:** the hub's own clock, not the Dragon Maths one (James, 12 Nov 2026). New school-level settings `hub_season_start` (first value 2026-10-18), `hub_season_days` (35) and `hub_paused_since`; P3 adds `hub_season(school)` reading them. Every trophy uses it except the Dragon Maths ones (`dm-first-five`, `dm-slayer`), which use the dragon's own season number from `lord_hall.season`. P12 gives James a small admin panel to see the season, change its length and pause it.
- **Tables (P3):** `trophy_types(id, game, name, how, kind 'trophy'|'picture', repeat 'season'|'year'|'once'|'steps', art, sort)` and `trophies(player, trophy, season int, year int, earned_at, seen_at, detail jsonb, primary key (player, trophy, season, year))`. Never touched by `teacher_new_season`. Rows go when the pupil's account goes.
- **Tier:** bronze, silver, gold by how many rows the pupil has for that trophy (1, 2, 3 or more). "Steps" trophies (Garden Cup) get their tier from the step reached.
- **Awarding:** `award_trophy(who, trophy, detail)` is `security definer`, never callable by pupils. Games call it from the same place they already call `game_progress_changed`, or from a per-game check function.
- **Pictures:** the avatar jsonb gains `pic` (a trophy id). `save_my_avatar` refuses a `pic` the pupil has not won. `AvatarImage` shows the painting with a bronze, silver or gold ring when `pic` is set; every other place gets it for free.
- **No hub points** from trophies.

**As built by P3** (migration `20261112000800_trophies.sql`, test `supabase/tests/database/trophies.test.sql`):

- The hub clock is three columns on `public.schools`: `hub_season_start`, `hub_season_days`, `hub_paused_since`. Nothing changes them yet (P12's panel). `hub_season(school)` is server only.
- A card adds its trophies with `insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort)`. The id is at most 24 characters (lower-case letters, digits, hyphens). `game` is the home card id, or `'hub'`.
- `award_trophy(who, trophy, detail default '{}', season default null)` returns `{ won, trophy, tier, count }`; `won` is true only when the call added a row, so it is safe to call again. Leave `season` out to use the hub season; Dragon Maths passes `lord_hall.season`. A `'steps'` trophy needs `detail.step` (1, 2 or 3). To back-award an old win with its real date, call it, then set `earned_at` on the new row in the same migration.
- The ring is saved in the avatar as `picTier` by the server (`save_my_avatar` and `award_trophy`), so every screen that draws an avatar gets it with no extra request. The browser can't set it.
- Browser: `src/data/trophies.ts` (`fetchMyTrophies`, `fetchTrophiesOf`, `markMyTrophiesSeen`, `tierOf`). A picture's emoji and painting go in `EARNED_PICTURES` in `src/avatar/earnedPictures.ts`, one line per picture trophy; an unlisted one draws a cup on its metal disc.
- `my_trophies().next` is the first three unearned by `sort`, whatever the class has switched on: P5 can filter by the games the pupil sees.

**As built by P5** (migration `20261112002100_trophy_cabinet.sql`, test `supabase/tests/database/trophy_cabinet.test.sql`):

- `my_trophies().next` now gives up to twelve, and the page shows the first three from games the class can see (`nextSpots` in `src/trophies/cabinet.ts`). It also gives `favourites`.
- Favourites: `profiles.trophy_favourites` (up to three ids). `set_my_favourite_trophies(ids)` keeps only trophies the pupil holds and returns what it saved.
- The "New trophy!" moment: `my_new_trophies()` lists the unseen ones; `NewTrophyMoment` (in `Layout`) shows them on hub pages only and calls `mark_my_trophies_seen()` straight away, so each shows once. Sound only when it is on; still for reduced motion.
- A trophy's `game` can be a home-card art id (`lord`, `clans`, `card101`): `trophyGame()` maps them to the game. A new card with a different art id adds a line to `SAME_GAME` there.
- The cabinet draws a stand-in cup in the trophy's metal with the game's icon; P2's paintings can replace `TrophyArt` in `src/trophies/TrophyArt.tsx`.

---

## P1 Tidy the profile page

Size S. Waits for: nothing.

- Top card on the first screen: big avatar, player name, a **Sign out** button at the top right, and buttons "Change my look" and "Change my name".
- Below it, folds that start closed: My trophies (empty state for now), My achievements, My stats, Page theme.
- The avatar maker opens from "Change my look" as its own panel with one Save button (avatar and theme saved together).
- Achievements show what is earned plus the three nearest, with "See all" per game.
- Pupils with no saved avatar see a friendly "Make your avatar" nudge.
- Target at 1366×768: the whole page fits in two screens with folds closed, and Sign out is visible without scrolling.
- Add the first tests for the page.

```text
You are tidying the pupils' My profile page in the School Games Hub repo.
Read docs/game-guide/README.md, then docs/PROFILE-REVIEW.md (sections 1, 2) and docs/plans/profile/PLAN.md (the standing rules and card P1).
Create branch profile/p1-tidy from origin/main in your own worktree.
Build card P1: a top card with the avatar, name and Sign out at the top; closed folds for trophies (empty for now), achievements, stats and theme; the avatar maker behind "Change my look" with one Save; achievements showing earned plus the three nearest.
Check it in the home preview at 1366x768 and at phone size: Sign out must be on the first screen and the page no more than two screens with folds closed. Add tests for src/pages/Profile.tsx.
Open a PR, merge when the checks pass, then tick P1 in docs/plans/profile/HANDOVER.md.
```

## P2 Plan and paint the art

Size M. Waits for: nothing. Needs ComfyUI running on the gaming PC (started with `--listen 0.0.0.0`).

- Write `docs/PROFILE-ART-PLAN.md` and `docs/profile-art/config.json` for `scripts/game_art.py`, in the same shape as the other art plans.
- Paint, in this order so the most urgent land first:
  1. Dragon Head picture in bronze, silver and gold (a head-and-neck portrait of Scorchtail that reads at 44 px).
  2. Three picture rings (bronze, silver, gold) and the trophy cabinet shelf.
  3. The other earned pictures in the review's section 5 table (the bold ones). Reuse what is already painted where it fits: the Heart Diamond gem, the Rainbow Toon flyer, the early-years friends.
  4. One trophy shape per trophy in the table, each in bronze, silver and gold.
- Square, plain dark background, bold shapes, no words. Check each at 44 px and 96 px.
- Send James a review page of the paintings before any are committed.

```text
You are planning and painting the art for the profile trophies in the School Games Hub repo.
Read docs/game-guide/README.md and its art part, docs/PROFILE-REVIEW.md (sections 4, 5, 8) and docs/plans/profile/PLAN.md (card P2).
Create branch profile/p2-art from origin/main in your own worktree.
Write docs/PROFILE-ART-PLAN.md and docs/profile-art/config.json for scripts/game_art.py, listing every picture and trophy from the review's section 5 table, in the paint order on card P2 (Dragon Heads first).
All paintings go through ComfyUI on James's gaming PC, never code sketches. If ComfyUI does not answer, stop and ask James to start it. Reuse existing paintings where the card says so.
Check every painting at 44 px and 96 px, show James a review page, repaint what he turns down, then commit the approved art, open a PR and merge when the checks pass. Tick P2 in docs/plans/profile/HANDOVER.md.
```

## P3 The trophy system (database and avatar picture)

Size L. Database. Waits for: nothing.

- Migration: the hub's own season settings and `hub_season(school)`, `trophy_types`, `trophies`, `award_trophy`, `my_trophies()` (own trophies with tier, plus the nearest unearned), `trophies_of(player)` for classmates (trophy id and tier only), and a new `save_my_avatar` that checks `pic`.
- Confirm `teacher_new_season` leaves both tables alone, with a database test that proves it.
- `src/data/trophies.ts`, tier helper, and `AvatarImage` drawing a `pic` with its ring (placeholder: the game's emoji on a metal disc).
- Database tests: a pupil cannot call `award_trophy`, cannot save a `pic` they have not won, cannot read another pupil's `detail`.

```text
You are building the trophy system for the School Games Hub repo (database and data layer only, no new screens).
Read docs/game-guide/README.md and the parts on migrations and shared files, then docs/PROFILE-REVIEW.md (section 4) and docs/plans/profile/PLAN.md (Shared design and card P3).
Create branch profile/p3-trophies from origin/main in your own worktree.
Build card P3: hub_season(school) from the hub's own clock (its own settings, not the Dragon Maths ones); tables trophy_types and trophies that the yearly New Season never touches; award_trophy (server only); my_trophies and trophies_of; save_my_avatar refusing a pic the pupil has not won; src/data/trophies.ts; AvatarImage showing an earned picture with a bronze, silver or gold ring.
Write database tests for every rule on the card, including that teacher_new_season keeps trophies.
Open a PR, merge when the checks pass, follow the guide's going-live part for the migration, then tick P3 in docs/plans/profile/HANDOVER.md.
```

## P4 Dragon Maths: the first five and the Dragon Heads

Size M. Database. Waits for: P3. **Aim to be live before season 2 starts (about 22 November 2026).**

- Trophy types: `dm-first-five` (picture, each season) and `dm-slayer` (trophy, each season). Both use the dragon's own season (`lord_hall.season`), not the hub clock.
- In `lord_commit`, on a dragon win: award `dm-slayer`; award `dm-first-five` when the pupil's `lord_hall.first_at` is among the five earliest in their school for that season. Ties on the same instant all count.
- Back-award from `lord_hall` in the migration: the five season-1 slayers get bronze now.
- Dragon Maths shows "First five: 3 of 5 places left this season" on its season strip.
- Placeholder art: the existing Scorchtail picture, cropped.

**As built by P4** (migration `20261112002400_dragon_trophies.sql`, test `supabase/tests/database/lord_trophies.test.sql`):

- The trophies are given by a trigger on `lord_hall` (`lord_hall_trophies` → `lord_give_trophies(player, season)`), which fires inside `lord_commit` on every dragon win. `lord_commit` itself was not re-created. A failed award only logs a warning; the save still goes through.
- The first-five race is between pupils only: teachers and hidden pupils win the Slayer's Sword but never take a place. A pupil is in the first five when fewer than five schoolmates first slew the dragon strictly before them, so ties all count. `detail` keeps `dragonSeason` and `place`.
- `lord_first_five()` gives `{ season, left }` for the pupil's school; the season road shows "First five: N of 5 places left this season" (live game only, not the browser trial).
- Stand-in picture: Scorchtail's head, cropped, at `src/avatar/pictures/dragon-head-standin.webp`. When P2's painting lands, change the `dm-first-five` line in `EARNED_PICTURES` and delete the stand-in.
- Live on 12 Nov 2026 the season-1 Hall had four pupils and one teacher account, so four pupils got bronze heads and one season-1 place was still open.

```text
You are adding the first Dragon Maths trophies in the School Games Hub repo.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md (sections 4, 5) and docs/plans/profile/PLAN.md (Shared design and card P4). P3 must be merged first.
Create branch profile/p4-dragon-heads from origin/main in your own worktree.
Build card P4: trophy types dm-first-five (Dragon Head picture) and dm-slayer (Slayer's Sword); award both from lord_commit on a dragon win, first five by lord_hall.first_at per school per season; back-award everyone already in lord_hall; show how many first-five places are left in Dragon Maths.
Use the painted Dragon Heads from P2 if they are in the repo, otherwise the placeholder on the card.
Write database tests (sixth slayer gets the sword but not the head; a second season gives silver). Open a PR, merge when the checks pass, follow the guide's going-live part, then tick P4 in docs/plans/profile/HANDOVER.md.
```

## P5 The trophy cabinet, earned pictures and the "New trophy!" moment

Size M. Waits for: P1 and P3.

- "My trophies" on the profile, open by default: a painted shelf, each trophy with its metal and a count, tap for "how you won it" and the seasons.
- Up to three grey "next to win" spots with how to win them.
- "Change my look" gains a "My earned pictures" row above the avatar parts.
- Pick up to three favourite trophies (saved on the server).
- A full-screen "New trophy!" once per unseen trophy on any hub page (not inside a game), with sound that obeys the mute button.

```text
You are building the trophy cabinet on the pupils' profile in the School Games Hub repo.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md (sections 4, 7) and docs/plans/profile/PLAN.md (Shared design and card P5). P1 and P3 must be merged first.
Create branch profile/p5-cabinet from origin/main in your own worktree.
Build card P5: the My trophies shelf with metals, counts and "how you won it"; three grey next-to-win spots; earned pictures in "Change my look"; up to three favourites saved on the server; a once-only full-screen "New trophy!" on hub pages that obeys mute and reduced motion.
Check it in the home preview at 1366x768 and phone size with made-up trophies. Add tests.
Open a PR, merge when the checks pass, then tick P5 in docs/plans/profile/HANDOVER.md.
```

## P6 Retire levels and show trophies around the hub

Size M. Waits for: P5. Touches the home page's top strip: do not run alongside dashboard card D2.

- Remove the level number and bar from the profile, the home page top strip and the teacher's pupil page. Points and "points this week" stay.
- In their place: "N trophies" and the favourite three.
- Favourite trophies show beside the name on the Leaderboard and Lobby rows.
- Rewrite the "How points work" page: points, the daily cap, and how trophies are won.
- Leave `level_start` in the database unused; no destructive migration.

```text
You are retiring the points level and showing trophies around the School Games Hub.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md (section 3) and docs/plans/profile/PLAN.md (card P6). P5 must be merged first. Check docs/plans/dashboard/HANDOVER.md: if card D2 is in progress, wait for it.
Create branch profile/p6-levels from origin/main in your own worktree.
Build card P6: remove the level number and bar everywhere pupils and teachers see it; show the trophy count and favourite three instead; favourites beside names on the Leaderboard and Lobby; rewrite the How points work page. Keep points. No destructive database change.
Update the tests that mention levels. Open a PR, merge when the checks pass, then tick P6 in docs/plans/profile/HANDOVER.md.
```

## P7 Trophies for the games that already keep a record

Size L. Database. Waits for: P3. Two parts, one PR each.

Part 1: Clan Quest, Sky Isles, Royal Decree, Maths Monsters. Part 2: Star Trader, Diamond Drop, Toon Flap, Gem Keep, Mine Runner (plain gold only).

- Add each trophy from the review's section 5 table that is not marked "new", awarded where the game already writes its record (`clan_hall`, `isles_hall`, `decree_reigns`, `monster_saves`, `trader_moons`, `diamond_finds`, `toonflap_progress`, `gem_keep_progress`, `mine_bests`).
- Back-award from the records that exist today.
- Fix the Maths Monsters full-book achievement goal (54 should be 75).
- Each game shows a small "Trophy won!" line when it happens; the big moment is P5's.

### Part 1: Clan Quest, Sky Isles, Royal Decree, Maths Monsters

```text
You are adding trophies to four games in the School Games Hub repo: Clan Quest, Sky Isles, Royal Decree and Maths Monsters.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md (section 5) and docs/plans/profile/PLAN.md (Shared design and card P7). P3 must be merged first.
Create branch profile/p7a-trophies from origin/main in your own worktree.
For these four games, add every trophy in the review's section 5 table that is not marked "new": the trophy types, the award call where the game already writes its record, a back-award from today's records, and a small "Trophy won!" line in the game. Fix the Maths Monsters full-book goal (75, not 54).
Trophies give no hub points. Write a database test per trophy. Open a PR, merge when the checks pass, follow the guide's going-live part, then tick P7 part 1 in docs/plans/profile/HANDOVER.md.
```

### Part 2: Star Trader, Diamond Drop, Toon Flap, Gem Keep, Mine Runner

```text
You are adding trophies to five games in the School Games Hub repo: Star Trader, Diamond Drop, Toon Flap, Gem Keep and Mine Runner.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md (section 5) and docs/plans/profile/PLAN.md (Shared design and card P7). P3 must be merged first.
Create branch profile/p7b-trophies from origin/main in your own worktree.
For these five games, add every trophy in the review's section 5 table that is not marked "new": the trophy types, the award call where the game already writes its record, a back-award from today's records, and a small "Trophy won!" line in the game.
Trophies give no hub points. Write a database test per trophy. Open a PR, merge when the checks pass, follow the guide's going-live part, then tick P7 part 2 in docs/plans/profile/HANDOVER.md.
```

## P8 Trophies that need a new counter or achievement

Size L. Database. Waits for: P3. Two parts, one PR each.

Part 1: Chess, Checkers, 101, Power Clash, Wormholes, Archery. Part 2: Marble Rush, Bond Match, Mine Runner on hard, Royal Decree perfect reign, Training.

- New season counters kept in their own small table (`season_counts(player, game, season, year, key, n)`) so the yearly wipe of game tables doesn't lose them.
- Chess and Checkers top three: worked out once when the hub season rolls over, from wins against classmates in that season (not against bots). These are not maths games, so a top three is allowed.
- 101, Power Clash, Wormholes: a set number of wins against classmates, no ranking.
- Where the game has no achievements yet (Marble Rush, Bond Match), add two or three ordinary ones on the way to the trophy so there are steps to climb.

### Part 1: Chess, Checkers, 101, Power Clash, Wormholes, Archery

```text
You are adding season trophies to six games in the School Games Hub repo: Chess, Checkers, 101, Power Clash, Wormholes and Archery.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md (section 5) and docs/plans/profile/PLAN.md (Shared design and card P8). P3 must be merged first.
Create branch profile/p8a-trophies from origin/main in your own worktree.
Build card P8 part 1: a season_counts table the yearly New Season keeps; wins against classmates counted per hub season; the trophies for these six games from the review's section 5 table; the Chess and Checkers top three worked out by the server when the season rolls over; Archery's Hawk and Golden Bow feats.
Only game wins are counted or ranked, never maths results. Write database tests. Open a PR, merge when the checks pass, follow the guide's going-live part, then tick P8 part 1 in docs/plans/profile/HANDOVER.md.
```

### Part 2: Marble Rush, Bond Match, Mine Runner hard, Royal Decree, Training

```text
You are adding trophies and the achievements that lead to them in the School Games Hub repo: Marble Rush, Bond Match, Mine Runner on hard, Royal Decree's perfect reign and Training.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md (section 5) and docs/plans/profile/PLAN.md (Shared design and card P8). P3 must be merged first.
Create branch profile/p8b-trophies from origin/main in your own worktree.
Build card P8 part 2: the trophies marked "new" for these games in the review's section 5 table, each awarded by the server from the game's own records; two or three ordinary achievements on the way for Marble Rush and Bond Match, which have none today; Training's 20 sessions in a hub season.
Write database tests. Open a PR, merge when the checks pass, follow the guide's going-live part, then tick P8 part 2 in docs/plans/profile/HANDOVER.md.
```

## P9 The early-years games

Size M. Database. Waits for: P3.

- For each of the 11 games: when a friend's 30-day golden prize is finished, that friend becomes an earned profile picture (the `-cheer` painting, no new art).
- Garden Cup per game from `days_done`: bronze at 30, silver at 90, gold at 150.
- Quick looks: Garden Gate trophy for the full garden.
- Nothing from speed, steps or being first. No hub points. Follow `docs/LEARNING-DESIGN.md`: the reward celebrates real finished rounds.
- Back-award from today's `days_done` and prizes.
- The game's own friend tells the child ("You can wear me on your profile now!") with a Kokoro voice line.

**As built by P9** (migration `20261112002500_garden_trophies.sql`, test `supabase/tests/database/garden_trophies.test.sql`):

- Trophy ids: `<game>-cup` (Garden Cup, steps), `<game>-<friend>` (62 pictures, `once`), `quick-looks-gate` (once). Sorts 5000 to 5240.
- No game's finish function changed: a trigger on each `<game>_progress` calls `garden_rewards(who, game, days)` when `days_done` reaches a multiple of 30. Prize k is the friend at place `(k - 1) % n` of the game's picture rows by `sort`, which must match the game's `FRIENDS` (checked by `src/avatar/gardenPictures.test.ts`). A failed award only logs a warning; the child's finish still saves.
- Quick looks: a trigger on `training_students` gives the Garden Gate when `typing.q.f` reaches 7. That number is the game's own saved record (the browser sends it; the server keeps the larger), so the Gate is as trustworthy as the garden itself.
- Pictures: `src/avatar/gardenPictures.ts` (in `EARNED_PICTURES`), the friend's `-cheer` painting, or its `-sit` one where there is no cheer (most of Lizard's and Robin's friends) or Parrot's single pictures.
- In the games: the kit's `WhatsNext` takes `wearMe` and says `WEAR_ME_LINE` after the finish line on a golden-prize day (Beanstalk's own panel does the same). Each game lists the line in `allVoiceLines()`; one Bella clip copied into the 11 voice folders.

```text
You are adding profile rewards to the 11 early-years maths games and Quick looks in the School Games Hub repo.
Read docs/game-guide/README.md, docs/LEARNING-DESIGN.md, docs/PROFILE-REVIEW.md (sections 4, 5) and docs/plans/profile/PLAN.md (Shared design and card P9). P3 must be merged first.
Create branch profile/p9-early-years from origin/main in your own worktree.
Build card P9: each finished golden prize unlocks that friend's painted picture for the profile; a Garden Cup per game at 30, 90 and 150 days played; Quick looks' Garden Gate; back-award from today's records; the friend says so in the game with a Kokoro voice line.
Nothing may come from speed, step level or being first, and nothing here may show a maths level to classmates. Use the game kit where it fits rather than editing 11 games by hand. Write tests.
Open a PR, merge when the checks pass, follow the guide's going-live part, then tick P9 in docs/plans/profile/HANDOVER.md.
```

## P10 Rewards for coming back, two-game rewards and the school hall of fame

Size M. Database. Waits for: P4, and P7 to P9 for the two-game rewards (build the checker now; each pair starts working when both games' trophies exist).

- Two-game rewards: every "Two games" row in the review's section 5 table. One server check, run whenever a trophy is awarded, gives the pair reward when both halves are held (same season where the row says so).
- The cabinet shows a pair as two half-lit shapes, so a pupil with one half can see which other game to try.

- Season Regular: played on 15 different school days in a hub season (any game, a finished go).
- All-rounder picture: trophies from 5 different games.
- "Hall of fame" tab on the Leaderboard page: this season's first five dragon slayers and each past season's, plus this season's new picture winners. Made-up names and avatars only.
- When a season ends, pupils see a short "Season 2 has started: your trophies can go silver" note once.

```text
You are adding the coming-back rewards and the school hall of fame in the School Games Hub repo.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md (sections 4, 5, 7) and docs/plans/profile/PLAN.md (Shared design and card P10). P4 must be merged first.
Create branch profile/p10-seasons from origin/main in your own worktree.
Build card P10: the two-game rewards from the review's section 5 table (one server check run whenever a trophy is awarded, and half-lit pairs in the cabinet); the Season Regular trophy (15 different school days in a hub season), the All-rounder picture (trophies from 5 games), a Hall of fame tab on the Leaderboard with each season's first five dragon slayers and new picture winners, and a once-only "new season" note.
The hall shows game feats only, never maths results. Write tests. Open a PR, merge when the checks pass, follow the guide's going-live part, then tick P10 in docs/plans/profile/HANDOVER.md.
```

**As built by P10** (migration `20261112002700_trophy_seasons.sql`, test `supabase/tests/database/trophy_seasons.test.sql`):

- `trophy_pairs` lists each two-game reward and its two halves, with `within` 'season' (both since this hub season's first day, `hub_season_start_day`) or 'year'. Six pairs: Double Slayer (Slayer's Sword + Monster Tooth, season), Board Master (both Champion ranks), Treasure Keeper (Lighthouse + Heart Diamond), Adventurer's Badge (Hawk Feather + Miner's Lamp), Star Monarch (Royal Seal + Star Ring), Golden Wings (Marble Cup + Rainbow Toon). A pair whose half isn't built yet isn't listed: add its row in the card that builds the half.
- One check, `trophy_followups(player)`, runs from a trigger after every trophy insert (not for 'hub' trophies, so it never loops). It gives the pairs, the All-rounder picture (trophies from 5 different games, 'hub' not counted) and the Best Friends Cup (golden prizes in 2, 4 and 6 garden games). A failed check only warns: the trophy and the game's save stay.
- Season Regular: `season_regular_check` runs from a trigger on `scored_games`, only on a pupil's first finished go of a weekday; 15 different Monday-to-Friday days since this hub season started.
- Cabinet: `my_trophy_pairs()`; a pair with one half held shows half lit under "Half lit: win the other half", with the game still to win in (both games must be ones the class can see).
- Hall of fame: `hall_of_fame()`, the last choice on the Leaderboard's Game row. Each Dragon Maths season's first five, and this hub season's new pictures (not the Dragon Head, not garden pictures: those are maths progress). Pupils in my school only, never hidden ones; a name that isn't made up (P11's own names) shows as "A classmate".
- The new-season note: `my_season_note()` in `my_home_page` as `seasonNote`, for a pupil holding a trophy from before this season, once per season (`season_notes`); marked seen as soon as it shows.
- Back-award on the day it went live: Season Regular from the last 60 days of finished goes, the rest from trophies already held. Stand-in pictures (an emoji on its metal) in `earnedPictures.ts` until P2.

## P11 Earn your own name

Size L. Database and privacy. Waits for: P3 and P5.

- A Name Scroll is granted by the server when a pupil holds gold trophies in two different games, or their third earned picture, or by a teacher.
- `name_requests(id, player, class_id, wanted, status, created_at, answered_by, answered_at)`, one waiting request per pupil, copied from the Class Warp pattern (`warp_requests`, `WaitingToJoin.tsx`, the Today page's "Needs you").
- The typed name: 2 to 14 letters, one space allowed, checked on the server with the Clan Quest word list. Must not match another pupil's name.
- Relax the `display_name` check to allow an approved typed name; keep it unique.
- `name_history` for teachers; "Put the made-up name back" on the teacher's pupil page.
- Stop pupils shuffling a new made-up name more than once a day.
- Add the new line to `docs/PRIVACY-SUMMARY.md` and show James the wording before merging.

```text
You are building the earn-your-own-name reward in the School Games Hub repo.
Read docs/game-guide/README.md, docs/PRIVACY-SUMMARY.md, docs/PROFILE-REVIEW.md (section 6) and docs/plans/profile/PLAN.md (Shared design and card P11). P3 and P5 must be merged first.
Create branch profile/p11-names from origin/main in your own worktree.
Build card P11: Name Scrolls granted by the server; a typed name with the server's letter and rude-word checks; a teacher approval list copied from the Class Warp pattern, shown in "Needs you" on the Today page; the old name kept until the teacher says Yes; name history and "Put the made-up name back" for teachers; a once-a-day limit on made-up name changes.
Nothing typed is ever shown to another pupil before a teacher approves it. Add the new line to docs/PRIVACY-SUMMARY.md and ask James (on a card) to approve the wording before you merge.
Write database tests for every rule. Open a PR, merge when the checks pass and James has approved the wording, follow the guide's going-live part, then tick P11 in docs/plans/profile/HANDOVER.md.
```

## P12 Teacher tools, the yearly rollover and a last check

Size M. Waits for: P4 to P11.

- Admin: a small "Trophy season" panel showing the season number and days left, with length and pause.
- Teacher's pupil page: trophies list, "Reset avatar", "Give a Name Scroll".
- Today page: "New trophies this week" for class shout-outs.
- Year admin page: say plainly that trophies and earned pictures are kept at New Season.
- Add trophies to the players tracker query.
- Play as a child at Chromebook and phone size: a new pupil, a pupil with one bronze, a pupil with a gold and a typed name. Fix what's found.
- Update the review with what shipped and close the plan.

```text
You are finishing the profile and trophies plan in the School Games Hub repo.
Read docs/game-guide/README.md, docs/PROFILE-REVIEW.md and docs/plans/profile/PLAN.md (card P12) and HANDOVER.md. Cards P4 to P11 should be done; list any that are not and ask James whether to go on.
Create branch profile/p12-finish from origin/main in your own worktree.
Build card P12: the admin Trophy season panel (season number, days left, length, pause); trophies, "Reset avatar" and "Give a Name Scroll" on the teacher's pupil page; "New trophies this week" on Today; the year admin page saying trophies are kept; trophies in the players tracker.
Then check the whole thing as a child would at 1366x768 and phone size (new pupil, one bronze, a gold with a typed name), fix what you find, and write what shipped at the top of docs/PROFILE-REVIEW.md.
Open a PR, merge when the checks pass, then tick P12 in docs/plans/profile/HANDOVER.md.
```
