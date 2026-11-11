# Teacher progress review: what teachers can see, ladders and steps, and what we collect

Written 11 Nov 2026 from a read of `main` at 4401089 (every teacher page in `src/teacher/` and `src/pages/Teacher*.tsx`, the
`teacher_*` database functions, and every game's progress and rounds tables). Nothing in the site has changed yet. The step
by step plan, with a ready-to-paste prompt for each step, is in [docs/plans/teacher-progress/](plans/teacher-progress/HANDOVER.md).

Pictures are in the project files folder `teacher-progress/`. `now-*.png` shows the real teacher pages, filled with a made-up
class. `mock-*.png` shows the proposed design. The numbers in both are invented, so only the layout matters.

---

## 1. What a teacher can see now

### Where things are

The class header has the tabs **Today | Students | Maths | Games | Class set-up | Admin**. Maths has five sub-tabs: **Focus |
Skill map | Skipped questions | Hardest questions | Foundational skills**.

| Page | About each pupil | About the class |
|---|---|---|
| **Today** (`src/teacher/Today.tsx`) | Made-up names only, because it may be on a projector. | "Needs you": who is waiting to join, then one alert line per game such as "Robin: 4 pupils on the same step for 5 or more days (3 names and 1 more)". At most 5 Foundational lines, then "and 7 more". "This week": how many answered, questions and skips, how many active now, how many haven't played for 7 days, and the top 3 hardest questions. |
| **Students** (`Students.tsx`) | Last active, questions in the last 7 days, skip share, the furthest **maths ladder** skill, and the focus. | Sort and filter. |
| **Pupil page** (`StudentPage.tsx`) | Overview: "Level N · points" (the points level), maths ladder place, focus, and 7-day questions and skips. Then win/loss against bots and friends, and **one folded line per game**, for example "Robin's Berry Basket: 9 of 30 days done · Step 3 Give 6 to 10, help level 2 · usual slip: giving too many". Opening a line shows that game's panel (hardest facts, last goes). Also a Quick looks panel (stage, stages finished, % right, usual slip). | — |
| **Skill map** (`SkillMap.tsx`) | Maths ladder only: now, furthest and warm-up, plus one cell per **ladder stage** (Early number facts, Times tables, Place value, Rounding, Order of operations, Fractions). | Secure-or-fluent counts per stage. |
| **Foundational skills** (`foundational/`) | 13 "idea" columns (Seeing amounts, Bonds to 10 and so on), each with a Not started / Learning / Secure / Fluent mark from **fact mastery**, and a **Flags** column on the far right ("Hop: 6 days on Counting in fives", "3 of 9 right", "Not played for 10 school days"). | — |
| **Hardest questions** (`Hardest.tsx`) | — | Up to 3 hardest facts per game, with % right, times asked and pupils. |
| **Skipped questions** | Shown, skipped, and the place they skip most. | Skips per question kind. |
| **Games** (`Games.tsx`) | — | A row per game with its switch and a count line ("18 players · 64 feasts"). A drawer holds the settings. Only Sky Isles has a pupil table. |

### Doing well and finding hard, per game

- **The 11 Foundational games** (Robin, Pipi, Beanstalk, Penguin Pairs, Tūī, Weka, Parrot, Hop, Lizard, Pigeon, Swamp Hen)
  and **Quick looks** have the most detail: the step on the pupil page, the fact marks on the grid, stuck flags, Today alerts,
  and the 3 hardest facts. The usual slip shows for every game except **Lizard and Swamp Hen**, which don't save slips.
  Pipi, Hop and Beanstalk have no hardest-facts list on the pupil page.
- **Gem Keep, Maths Monsters, Dragon Maths, Clan Quest**: a class fact or topic table in the Games drawer, the class's
  hardest questions, and a panel on the pupil page.
- **Sky Isles, Diamond Drop, Bond Match, Star Trader**: a pupil panel with their island, level or stars, but no right/wrong.
- **Marble Rush, Mine Runner, Wormholes, Archery, Royal Decree, Kingdom Keeper**: switches and a count only. Their answers are
  saved (with the value given) but no teacher page reads them.
- **Toon Flap**: on no teacher page yet. Its teacher part is the next planned step in its own plan (F.5).
- **Chess, Checkers, 101, Power Clash**: win/loss on the pupil page only (they're not maths).

## 2. Ladders and steps: what is hard today

Goal: **a teacher sees at a glance where every pupil is on each game's steps, who is stuck, and who is ready to move on.**

1. **No page shows the step for the whole class.** A pupil's step in a game is only on the pupil page, inside a folded line.
   It takes 3 clicks per pupil per game, so a class of 24 in 6 games means about 430 clicks. (`now-3-pupil-laptop.png`)
2. **The Foundational grid answers a different question.** Its colours come from how secure the facts are, not which step the
   pupil is on, so a child can be on step 5 of Robin and still show "L". The step appears only inside a stuck flag.
   (`now-4-foundational-laptop.png`)
3. **The flags sit off screen.** The Flags column is the 14th column. On a laptop and on an iPad it is past the right edge, and
   a pupil with many flags makes their row very tall, so the grid has big gaps. (`now-4b-foundational-flags.png`,
   `now-5-foundational-ipad.png`)
4. **One idea, six words.** Robin, Tūī, Parrot, Lizard, Pigeon and Swamp Hen say "Step 3". Pipi, Weka, Penguin Pairs and Hop say
   "reached …" on the pupil page and "level" in alerts. Beanstalk says "sum" in alerts and "Bonds to 20" on the page. Quick
   looks and the skill map say "stage", and those are two different things. "Help level 2" (picture help) sits right after
   "Step 3", and the Overview's "Level 5" is a points level. A teacher can't tell which "level" means progress.
5. **"Ready to move on" isn't shown anywhere.** The games move a pupil up by themselves, so for a teacher "ready" means two
   things: *nearly at the next step* and *finished the top step, so ready for the next game*. The database knows how many good
   goes a pupil has at their step (`good_at_step`) and the top step, but no teacher page uses either.
6. **Alerts are counts, not a list.** Today says "4 pupils" with 3 names and a link to the grid. There's no single list of
   "who is stuck where".
7. **Wide tables on an iPad.** The grid, the skill map and the roster (`min-width: 720px`) all scroll sideways. Only the Games
   table turns into cards.

### Proposed design

**A new "Progress" tab beside Today** (the place is a decision for James, see section 4). It has three parts:

- **"Who needs a look" pills** at the top: *stuck (same step 5+ days)*, *nearly ready to move up*, *finished a game: ready for
  the next*, *gone quiet*. Tapping a pill filters the table to those pupils.
- **"Every game's steps" table** (`mock-1-progress-laptop.png`, `mock-4-progress-ipad-landscape.png`): one row per pupil and one
  column per game that is on for the class. Each cell is a small step bar (filled up to the pupil's step) plus the number.
  The colour gives the state: blue moving, green nearly ready (↑), red stuck (with "7d"), dark blue top step done (★), grey
  quiet. The name column stays put while the table scrolls. "Stuck first" sorts the worst to the top. Tapping a cell opens that
  pupil's page at that game.
- **The ladder board for one game** (`mock-2-board-laptop.png`): game pills across the top, then one column per step with its
  name (Step 3 "Give 6 to 10"). Each pupil is a chip in their step's column, showing days on the step and a red, green or blue
  border. On an iPad in portrait it turns into a real ladder, with the top step at the top (`mock-3-board-ipad-portrait.png`).

**On the pupil page**, a "Steps in each game" card at the top, not folded (`mock-5-pupil-laptop.png`). Each game gets a step
track, the step name, days on this step, and % right first try. The folded game lines stay below it for the detail.

**Words, everywhere:** a game's ladder is made of **steps** ("Step 3 of 6: Give 6 to 10"). "Stage" means only the maths ladder's
stages. "Picture help" replaces "help level", and "Points level" replaces "Level".

## 3. What we collect

### What is saved now

- **Shared maths record** (`gem_keep_facts`, written by `record_fact_answers`): one running row per pupil per fact, holding
  attempts, right, average time, Leitner box, last seen, and quick days. **Single answers are not kept**, so there's no wrong
  answer value, no time per question, no attempt number, and no help used. The season reset (`teacher_new_season`) wipes it.
- **Foundational games**: a `<game>_progress` row (days done, last day, step or level, `good_in_row`, `good_at_step`, picture
  help per kind) and `<game>_rounds` rows. Each round keeps **every tap with what was picked and how long it took**
  (`taps: [{pick, ms}]`), the mistakes, `first_right` (six games), and `slips` (all except Lizard and Swamp Hen). Rounds are
  deleted after 30 days.
- **Quick looks**: `training_answers` keeps each answer with the value given, the answer time and the typing time (newest 30 per
  fact).
- **Question log** (`question_log`): every question shown, skipped or not, the time on screen, and the place in the game. Kept
  60 days.
- **Other games**: Marble, Mine, Archery, Isles, Trader, Diamond and Toon Flap save each answer's value and whether it was right.

### Saved but never shown to a teacher

- The **wrong pick and time of every tap** in the 11 Foundational games. Only the count of taps is read.
- **`first_right`** (right first try) in Tūī, Pigeon, Parrot, Lizard, Swamp Hen and Robin.
- **`good_at_step`** and **`good_in_row`**, which would give "nearly ready to move up".
- Each round's **step**, which could give "moved up to step 4 on 6 Nov".
- **Answer and typing times** in Quick looks.
- **Time on screen** in the question log.
- **Every answer** in Marble, Mine, Archery, Isles, Trader, Diamond and Toon Flap.

### Not collected at all

- **Step history.** Only the current step is kept, so "when did they move up" and "how long did each step take" can only be
  guessed from the last 30 days of rounds. Beanstalk's rounds don't even save the stage.
- **Anything older than 30 days** for the Foundational games, so there's no progress over a term.
- **Wrong answers in the shared maths record**, for example "says 54 for 7 × 8".
- **Help used per go** (Show me first, picture help on that go). Only the current help level per kind is kept.
- **Slips for Lizard and Swamp Hen.**

## 4. The plan (priority order)

Each step has its own card with a ready-to-paste prompt in `docs/plans/teacher-progress/`.

| # | Change | What it gives the teacher | Size | Needs SQL |
|---|---|---|---|---|
| P1 | Same words everywhere | "Step 3 of 6: Give 6 to 10" in every game. No more mixed level, stage, reached and sum. | S | no |
| P2 | Progress tab: every game's steps | One table: every pupil, every game, the step and the state. | M | no |
| P3 | Progress tab: ladder board | One game: everyone on their step, laid out like a ladder (columns on a laptop, rungs on an iPad). | M | no |
| P4 | "Nearly ready" and "on this step since" | Green ↑ for nearly at the next step, and the right number of days on a step. | M | yes |
| P5 | "Who needs a look" and Today links | Pills that filter the table. Today's alerts open the right list. Flags move out of the far-right column. | S | no |
| P6 | Pupil page: steps in each game | Every game's step bar on one card at the top, not folded. | S | no |
| P7 | Usual slip for Lizard and Swamp Hen | The same slip line as the other nine games. | S | yes |
| P8 | Right first try and time per go | From the taps already saved: % right first try and how quick, per pupil and game. | M | yes |
| P9 | Step history | "Moved up to step 4 on 6 Nov", days per step, and a progress line over the term. | M | yes |
| P10 | Common wrong answers in maths facts | The skill map's fact table says "often answers 54 for 7 × 8". | M | yes (and an edge function) |
| P11 | Other games on the Progress tab | Gem Keep, Diamond Drop, Dragon Maths and Bond Match levels as extra columns. Toon Flap joins after its own F.5 step. | M | some |

P1 to P6 need nothing new from the database except P4's small change, so the main view can be built quickly. P7 to P10
collect or show new data. P11 can wait.

**Decisions for James** (asked on a card): where the Progress view lives (a new tab, recommended). Later steps assume a new tab.
