# Home page timeline plan

A strip on the home page that shows kids what is coming up and how long they have. This is the plan only: nothing is built yet.
Status: waiting for James's answers to the questions in section 6.

## 1. What kids see

A **"This season" strip**, placed straight under the hero (above "Games still going"). It is one wide card, in the same style as
the other home page panels.

```
 This season · Season 3 · 12 days left                                          [ See all ]
 ──●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──
   🏁 Start      📍 You are here     👣 Giant warnings   ⚔️ Raids stop   👹 Monster week   🏆 Season ends
   Day 1         Day 23              Day 22              Day 22          Day 29 (in 6 days)  Day 35
```

- **A bar for the 35-day season**, split into 5 week sections. The part already gone is filled in with the theme's bar colour,
  and a "You are here" marker (the pupil's avatar head, small) sits on today.
- **Milestones** sit on the bar as round chips with an emoji and a short label: season start, giant warnings start (day 22),
  raids stop (day 22), monster week (days 29 to 35, shown as a shaded block, not a dot), season ends (day 35).
- **The next milestone is highlighted** and gets the countdown words: "The Storm Giant arrives in 6 days". This is the main
  line a kid reads; the rest is a picture of the season.
- **"Coming up this week" row** under the bar: up to 3 small chips for short-term things, soonest first:
  - Leaderboard resets: "Monday" (weekly, NZ time, `nz_week_start`).
  - Maths focus ends: "Fractions focus ends Friday" (from the running focus `endsAt`).
  - A classmate's archery challenge waiting: "Mia's challenge ends in 2 h" (from archery `asks`, with its `deadline`).
  - Your Clan Quest builds or Dragon Maths moves refill: "+2 builds tomorrow" (only if the pupil is at 0).
- **"See all"** opens the strip down to a simple list of every date this season, for kids who like to plan.
- **Holiday pause:** while a school admin has paused the season, the strip says "Season paused for the holidays" and the bar
  turns grey. No countdowns.
- **No season set yet:** the strip shows only the "Coming up this week" row, or hides itself if that is empty too.

Words stay short and plain ("in 6 days", "tomorrow", "today!"). Days are counted in NZ school days the same way the
seasons already are (`nz_day`).

## 2. Fitting the look

- Built only from the home page theme variables (`--h-box`, `--h-box-ink`, `--h-box-line`, `--h-bar-fill`, `--h-bar-track`,
  `--h-chip`, `--h-chip-done`, `--h-going`, `--h-label`, `--h-display`, `--h-r`, `--h-shadow`), so it looks right in all three
  themes: **Tidy school**, **Game menu** and **Soft and bright**, with no colours of its own.
- Emoji icons, like the game tiles and quick links already use. The monster week block can show the painted giant
  (`siege-giant`/Grimmor art) as a tiny round picture in the **Game menu** theme only; the other two keep the emoji.
- Small, gentle animation: the "next" chip pulses once when the page loads, and not again (it respects reduced motion).
- On a phone the bar scrolls sideways inside the card, with today kept in view; the "Coming up" chips wrap.

## 3. Where the dates come from

All of it is already in the database; nothing new needs storing.

- **The season** (start, paused since, number, days left): the school season row used by Dragon Maths and Clan Quest
  (`lord_school_season_row`). The Clan Quest day markers (22, 29, 35) come from one shared list in `shared/` so the game and the
  strip can't disagree.
- **This week's items:** maths focus `endsAt`, archery `asks`, the week start, and `movesLeft`, most of which the home page
  call already loads.
- **One change on the server:** add a `timeline` part to the existing home page call (`fetchMyHomePage`, `src/data/homePage.ts`),
  in a new migration, returning `{ season: { number, start, pausedSince, day, daysLeft } | null, soon: [...] }`. No extra
  request on page load.
- Only milestones for games the pupil can reach (and that are switched on for their class) are shown.

## 4. How it's built

1. `shared/season/timeline.ts`: a pure function that turns the season row plus "today" into the list of milestones and
   the next one. Unit tests for: day 1, day 22, day 28 (the eve), monster week, day 35, paused, no season, a class with Clan Quest off.
2. Migration: add `timeline` to the home page function (next free number after `20261029000600`).
3. `src/components/SeasonTimeline.tsx` plus its CSS in `styles.css`, next to `.panel`. It is lazy-loaded like the maths cards.
4. Put it into `Dashboard.tsx` under the hero. Add it to the fake home preview data (`homePageFake.ts`) so
   `preview/home` shows it in every theme.
5. Tests: the component on different days, all three themes in the preview, a phone-width check, screen reader labels
   ("Season 3, day 23 of 35. Next: monster week in 6 days").
6. Screenshots of the three themes for James before merging.

About 1 to 2 days of work. No student data changes.

## 5. Images

The plan doesn't need new pictures. Emoji fit the home page as it is. The optional extra is a few small round milestone
badges painted in ComfyUI (giant footprint, crossed swords, giant, trophy) for the Game menu theme. They can be painted
after James says yes.

## 6. Questions for James

1. **Where should it go?** Under the hero (Recommended) / at the very top, above the hero / as a panel beside "Recent games".
2. **What should be on it?** Season milestones and "Coming up this week" (Recommended) / season milestones only /
   "Coming up this week" only.
3. **Should teachers add their own dates** (e.g. "Maths quiz Friday", "Last day of term")? Not now, later (Recommended) /
   yes, in this first version.
4. **Painted badges for the Game menu theme?** Emoji only for now (Recommended) / paint the badges too.
