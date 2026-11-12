# Dashboard plan: handover

The plan and the full card text are in [../../DASHBOARD-REVIEW.md](../../DASHBOARD-REVIEW.md), section 6. Copy-ready prompts are on the Dashboard Plan artifact (https://claude.ai/artifact/JQ6WqLGiEMCiNsHG8pnSm6) and the Games Hub Prompts board (ids dashboard-d1 to dashboard-d9). Run the cards in order; D1, D4, D5 and D7 don't wait for anything.

## To do

- [ ] D1 One card look: Training card and the missing paintings (size S). Waits for: nothing.
- [x] D2 'My games' at the top instead of the big Play button (size M, database). Waits for: nothing.
- [x] ~~D3 Older classes see their own games first~~ Dropped: James kept the early-years games at the top (11 Nov 2026).
- [x] D4 Games still going in one line (size S). Waits for: nothing.
- [x] D5 Stop the page jumping while it loads (size S). Waits for: nothing.
- [x] D6 Smaller cards on phones and iPads in portrait (size M). Waits for: D2.
- [ ] D7 Lighter first load on a school iPad (size M). Waits for: nothing (run before D8).
- [ ] D8 Adding a game to the home page in one place (size S). Waits for: D5 and D7.
- [ ] D9 Check it as a child would, and close the review (size S). Waits for: D1 to D8.

## Done and live

(none yet)

## Decisions

- Early-years games for Year 4+ classes: leave them at the top (James, 11 Nov 2026). D3 dropped.
- Big Play button: remove it (James, 11 Nov 2026). Done in D2.
- 12 Nov 2026: keep the 'In development' tag for pupils; keep the old Pinned section and Play button in the code behind `MY_GAMES_ON` (D2).
