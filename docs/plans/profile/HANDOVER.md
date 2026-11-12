# Profile and trophies plan: handover

The reasons are in [../../PROFILE-REVIEW.md](../../PROFILE-REVIEW.md). The cards and copy-ready prompts are in [PLAN.md](PLAN.md) and on the "Profile and Trophies Plan" artifact page (https://claude.ai/artifact/1tJJiKP48gJBaitmQwUizW). Run the cards in order. P1, P2 and P3 don't wait for anything. P4 should be live before Dragon Maths season 2 starts (about 22 November 2026).

## To do

- [ ] P2 Plan and paint the art (size M). Waits for: nothing. Needs ComfyUI running on the gaming PC.
- [ ] P3 The trophy system (size L, database). Waits for: nothing.
- [ ] P4 Dragon Maths: the first five and the Dragon Heads (size M, database). Waits for: P3.
- [ ] P6 Retire levels and show trophies around the hub (size M). Waits for: P5. Not alongside dashboard card D2.
- [ ] P7 part 1: Clan Quest, Sky Isles, Royal Decree, Maths Monsters (size L, database). Waits for: P3.
- [ ] P7 part 2: Star Trader, Diamond Drop, Toon Flap, Gem Keep, Mine Runner. Waits for: P3.
- [ ] P8 part 1: Chess, Checkers, 101, Power Clash, Wormholes, Archery (size L, database). Waits for: P3.
- [ ] P8 part 2: Marble Rush, Bond Match, Mine Runner hard, Royal Decree, Training. Waits for: P3.
- [ ] P9 The early-years games (size M, database). Waits for: P3.
- [ ] P10 Coming back, two-game rewards and the school hall of fame (size M, database). Waits for: P4.
- [ ] P11 Earn your own name (size L, database and privacy). Waits for: P3 and P5.
- [ ] P12 Teacher tools, the yearly rollover and a last check (size M). Waits for: P4 to P11.

## Done and live

- [x] P1 Tidy the profile page (#439, 12 Nov 2026): top card with Sign out, closed folds, avatar maker behind "Change my look", achievements as earned plus the three nearest. A theme now saves when tapped. Styles are in `src/pages/profile.css`; P5 fills the My trophies fold.
- [x] P5 The trophy cabinet and the "New trophy!" moment (#454, 12 Nov 2026): a lit shelf of trophies in their metals (favourites first, up to three, saved on the server), a plaque with how and when each was won, three grey next-to-win spots from games the class can see, earned pictures in "Change my look", and a once-only full-screen "New trophy!" on hub pages. Stand-in cups until P2's paintings.

## Decisions

- Adding new achievements to games is fine (James, 12 Nov 2026).
- Some of the best rewards should need two games, to vary play (James, 12 Nov 2026). In P10; the Name Scroll needs gold in two different games.

- Levels: retire the number and bar, keep points (James, 12 Nov 2026). Done in P6.

- Trophy seasons run on the hub's own clock (35 days to start, James can change or pause it), not the Dragon Maths clock. Dragon Maths trophies follow the dragon's own season (James, 12 Nov 2026).
- The five season-1 dragon slayers get the bronze Dragon Heads (James, 12 Nov 2026).

## Still James's call (the plan uses the first answer unless he says otherwise)

- Name Scroll: gold in two games or three pictures (recommended), or teacher-given only.
- Typed names: on for every class with teacher approval (recommended), or a per-class switch that starts off.
