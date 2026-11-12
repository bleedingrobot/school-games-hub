# Profile and trophies plan: handover

The reasons are in [../../PROFILE-REVIEW.md](../../PROFILE-REVIEW.md). The cards and copy-ready prompts are in [PLAN.md](PLAN.md) and on the "Profile and Trophies Plan" artifact page (https://claude.ai/artifact/1tJJiKP48gJBaitmQwUizW). Run the cards in order. P1, P2 and P3 don't wait for anything. P4 should be live before Dragon Maths season 2 starts (about 22 November 2026).

## To do

- [ ] P2 Plan and paint the art (size M). Waits for: nothing. Needs ComfyUI running on the gaming PC.
- [ ] P3 The trophy system (size L, database). Waits for: nothing.
- [x] P7 part 1: Clan Quest, Sky Isles, Royal Decree, Maths Monsters (size L, database). Done 12 Nov 2026: eight trophies, a watcher on each record, back-awards, "Trophy won!" line (`src/trophies/`), full book needs 75.
- [x] P7 part 2: Star Trader, Diamond Drop, Toon Flap, Gem Keep, Mine Runner. Done 12 Nov 2026: six once-a-year trophies (Star Ring, Black Hole, Heart Diamond, Rainbow Toon, Gem Crown, Miner's Lamp), watchers, back-awards, "Trophy won!" line in each game.
- [x] P8 part 1: Chess, Checkers, 101, Power Clash, Wormholes, Archery (size L, database). Done 12 Nov 2026: `season_counts` (kept by the New Season), classmate wins per hub season (wins that earned points), 15-win trophies, Chess/Checkers season top three crowned by the hourly `season-crowns` job, Champion rank trophies, Hawk Feather, Golden Bow (counts from today: arrows used weren't kept before).
- [x] P8 part 2: Marble Rush, Bond Match, Mine Runner hard, Royal Decree, Training. Done 12 Nov 2026: Marble Cup and Golden Marble (gold times copied into `marble_gold_steps`, kept in step by a test), Bond Star and Perfect Match, Golden Pickaxe, Royal Crown (all 8 riddles right in a full reign), Times Tables Shield (20 facts sessions in a hub season, in `season_counts`); Marble Rush and Bond Match got their first three achievements each.
- [ ] P11 Earn your own name (size L, database and privacy). Waits for: P3 and P5.
- [ ] P12 Teacher tools, the yearly rollover and a last check (size M). Waits for: P4 to P11.

## Done and live

- [x] P4 Dragon Maths: the first five and the Dragon Heads (#451, live 12 Nov 2026). Dragon Head picture and Slayer's Sword, both on the dragon's own season, given on every dragon win. The first-five race is between pupils only: teachers and hidden pupils get the sword but take no place. Checked live: the season-1 Hall had four pupils and one teacher account, so four pupils have bronze heads (places 1 to 4), all five have the sword, and one season-1 head is still open. The season road shows the places left. The picture is a stand-in (Scorchtail's head) until P2's painting lands: change the `dm-first-five` line in `src/avatar/earnedPictures.ts` and delete `src/avatar/pictures/dragon-head-standin.webp`.
- [x] P1 Tidy the profile page (#439, 12 Nov 2026): top card with Sign out, closed folds, avatar maker behind "Change my look", achievements as earned plus the three nearest. A theme now saves when tapped. Styles are in `src/pages/profile.css`; P5 fills the My trophies fold.
- [x] P5 The trophy cabinet and the "New trophy!" moment (#454, 12 Nov 2026): a lit shelf of trophies in their metals (favourites first, up to three, saved on the server), a plaque with how and when each was won, three grey next-to-win spots from games the class can see, earned pictures in "Change my look", and a once-only full-screen "New trophy!" on hub pages. Stand-in cups until P2's paintings.

- [x] P6 Retire levels and show trophies around the hub (#459, 12 Nov 2026): no level number or bar anywhere. The welcome strip shows the trophy count and favourite three, and favourites sit beside names on the Leaderboard and in the Lobby (`trophy_shelves`). "How points work" rewritten; points kept.
- [x] P10 Coming back, two-game rewards and the hall of fame (#460, 12 Nov 2026): six two-game rewards (half lit in the cabinet), Season Regular, All-rounder, Best Friends Cup, a Hall of fame on the Leaderboard and a once-only new-season note. See "As built by P10" in PLAN.md.

- [x] P9 The early-years games (#453, 12 Nov 2026): each finished 30-day golden prize gives that friend's painting as a profile picture (62 friends), a Garden Cup per game at 30, 90 and 150 days played, Quick looks' Garden Gate, back-awarded from that day's records. The friend says "You can wear me on your profile now!". Given by triggers, no game's finish function changed; see "As built by P9" in PLAN.md.

## Decisions

- Adding new achievements to games is fine (James, 12 Nov 2026).
- Some of the best rewards should need two games, to vary play (James, 12 Nov 2026). In P10; the Name Scroll needs gold in two different games.

- Levels: retire the number and bar, keep points (James, 12 Nov 2026). Done in P6.

- Trophy seasons run on the hub's own clock (35 days to start, James can change or pause it), not the Dragon Maths clock. Dragon Maths trophies follow the dragon's own season (James, 12 Nov 2026).
- The five season-1 dragon slayers get the bronze Dragon Heads (James, 12 Nov 2026).

## Still James's call (the plan uses the first answer unless he says otherwise)

- Name Scroll: gold in two games or three pictures (recommended), or teacher-given only.
- Typed names: on for every class with teacher approval (recommended), or a per-class switch that starts off.
