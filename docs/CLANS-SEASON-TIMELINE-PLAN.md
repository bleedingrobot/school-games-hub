# Clan Quest season timeline plan

A strip on the Clan Quest home screen that shows kids where they are in the season, what is coming next and how long they have.
Plan only: nothing is built yet. Asked for by James, 29 Oct 2026.

Mock-ups (made from a quick prototype with the game's own paintings, not the finished thing): `docs/clans-art/timeline-mockups/`
(day 16, day 24, day 31, and a phone on day 24).

Related: the whole-site home page timeline (docs/HOME-TIMELINE-PLAN.md, PR #91) is a separate plan for the hub's front page. The two
can share the same day list (section 4) so they never disagree. Built 29 Oct 2026 (PR #92): the site strip sits inside the
"Complex maths games" group, above the Clan Quest card's row (James moved it there from under the hero).

## 1. What kids see

Under the clan's name and banner, above the four member cards, a framed **"This season"** strip:

- **A heading line:** "Season 1 · day 24 of 35", then one countdown sentence that changes with the stage:
  - Days 1–21: "**13 days** until Grimmor the Storm Giant comes. 6 days to build before supplies go on sale."
  - Days 22–28: "Grimmor comes in **5 days**! Buy supplies in the Market and get strong."
  - Days 29–35: "**Monster week!** 5 days left to beat Grimmor. One try a day." (after a win: "You beat Grimmor! New season in 3 days.")
  - Day 35: "Last day of the season! Tomorrow your clan starts fresh. Your trophies stay forever."
- **A road with four round medallions**, joined by a glowing bar that fills up as the days pass:
  1. **Build** (days 1–21): grow your clan and village. Picture: the Training Hall painting.
  2. **Get ready** (days 22–28): supplies on sale, classmate raids rest, a sign of the monster each day. Picture: the Market painting.
  3. **Monster week** (days 29–35): one try a day. Picture: this season's monster portrait (Grimmor now; the golem and troll later), with a red rim.
  4. **New season**: fresh start, trophies stay. Picture: the victory painting.
- **Today's stage** is bigger, with a gold rim and glow. Stages already done are greyed. The bar's fill shows how far into the stage today is.
- **Tapping a medallion** opens a short "what happens" note (the same words as How to play), so kids can plan ahead.
- **Phone:** the medallions shrink and the small one-line descriptions hide, so the whole road still fits without sideways scrolling (see `phone-24`).
- **Clock off** (before Mon 2 Nov, or a school with no season): the strip is hidden, as the season line is now.
- It replaces the small "Season 1 · day 16 of 35" line and the new-season note under the gold line. The monster warning box (from day 22)
  stays where it is.

## 2. Fitting the look

- Uses the game's stone-and-iron frame (the same colours, fonts and edge as the scene painting and member cards). No new colours.
- Every picture already exists in the game (`art/buildings`, `art/scenes`, `art/season-monsters`), so it needs **no new art** to work.
- One gentle glow pulse on today's medallion when the screen opens, and none with reduced motion.
- Height about 210 px on a Chromebook, so the member cards still start on the first screen at 1366 × 768.

## 3. Optional: painted medallions

If James wants a more finished look, 3 small round badges can be painted in ComfyUI (the monster medallion keeps its portrait):

- **Build**: hammer and timber frame in front of a half-built hall.
- **Get ready**: a supply cart with arrows, a potion and a rolled net, under a stormy sky.
- **New season**: a sunrise over the village with the clan's trophies on a shelf.

Same style as the other Clan Quest paintings, 512 square, about 30 KB each as webp. James runs one command on his PC, like the giant.

## 4. How it's built

1. `shared/clans/season.ts`: a pure `seasonStages(clock, kind)` that returns the four stages (name, first and last day, state done/now/next),
   the countdown sentence, and the bar's fill. Built only from `CONFIG.season` (`warnFrom`, `monsterFrom`, `length`) so it can never disagree with
   the rules. The site home strip (PR #91) can use the same list.
2. `src/games/clans/SeasonRoad.tsx` and its CSS in `clans.css`, replacing `SeasonLine` on the home screen.
3. The art helpers already exist (`buildingArt`, `sceneArt`, `seasonMonsterArt`). If a picture is missing, the medallion shows an emoji.
4. Tests: every stage edge (days 1, 21, 22, 28, 29, 35), after a monster win, clock off, the phone layout, and screen reader labels
   ("Season 1, day 24 of 35. Now: Get ready. Next: Monster week in 5 days.").
5. Screenshots for James before merging.

No server or database change: the clock already comes with the clan. About half a day of work.

## 5. Questions for James

1. **Which front page?** James, 29 Oct 2026: **both**. The Clan Quest road is built first, then the site home strip (PR #91); both read one
   shared list of season days (section 4, step 1).
2. **Pictures:** James, 29 Oct 2026: **paint 3 new medallions** (section 3). Prompts are in scripts/clans-monster-art.py
   (`stage-build`, `stage-ready`, `stage-new-season`); the monster medallion keeps the monster's portrait.
   Painted 29 Oct 2026 (docs/clans-art/timeline-tries/, 3 tries each); picked try 2 of each (centred, read best in a circle).
