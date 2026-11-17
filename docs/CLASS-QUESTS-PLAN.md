# Weekly class quests

**Status:** stage 1 being built (18 Nov 2026), branch `claude/class-quests`. Migration `20261118000100_class_quests.sql`.

James (18 Nov 2026): a teacher sets a weekly class quest; pupils must play a game properly on 5 days out of 7. A quest tracker
bar on the home page when the class has one. Teachers track every pupil. Achievements for 1, 5, 10, 15 and 20 quests done.
More quest kinds will follow, so a quest kind is one entry in one list.

## James's answers (question card, 18 Nov 2026)

| Question | Answer |
|---|---|
| How a quest week runs | **One-off week.** The teacher starts a quest; it runs 7 days (the day it starts is day 1), then ends. The teacher starts the next one. |
| Days needed | **Always 5** out of the 7. |
| Rewards | **Achievements** at 1, 5, 10, 15, 20 quests done (all kinds together) **+ painted "Questing Hero" trophy**: bronze at 5, silver at 10, gold at 20. |
| What pupils see of classmates | **Own bar + class count** ("9 heroes finished"), no names. |

## The first three quests

A **quest day** is a New Zealand day on which the pupil used up all of that game's daily turns (whatever the teacher set as turns a day).

| Kind | Game | A day counts when | Bar words |
|---|---|---|---|
| `trader` | Star Trader | jumps left reaches 0 | "Use all your jumps" |
| `lord` | Dragon Maths | forest fights left reaches 0 | "Use all your forest fights" |
| `clans` | Clan Quest | mine fights left reaches 0 | "Use all your mine fights" |

The list lives in `shared/quests/kinds.ts` (name, game, words, art, the "left today" number from the home page's moves).
A new kind later = a list entry + a watcher on that game's table + a painting.

## How it counts (all on the server)

- **`quest_days`** (player, kind, NZ date). Written only by small watchers (triggers) on each game's own table
  (`trader_games`, `lord_heroes`, `clans`) when the turns-left number drops to 0 in a save. The games' own code is not
  changed, and a watcher error never loses a save (same pattern as the trophy watchers, `20261112001700`). Days are kept
  whether or not a quest is running, so a day earlier on the day a quest starts still counts.
  - Turns left drops to 0 = old value above 0 (or a new game day) and new value 0. Opening the game next morning before the
    day rolls over can't count.
  - Teacher's "unlimited turns today": the count still reaches 0 on the normal last turn, so the day counts once.
- **`class_quests`**: id, class, kind, `starts_on`, `ends_on` (= starts_on + 6), started by, stopped at. One running quest per
  class. Started and stopped only through `teacher_start_class_quest` / `teacher_stop_class_quest` (teacher of that class).
- **`quest_wins`** (quest, player): written by the `quest_days` watcher the moment a pupil in that class has 5 quest days inside
  the quest's dates. Then: `game_progress_changed(player, 'quests')` (achievements), and the trophy step if it is 5, 10 or 20.
- **Hub hooks** (`hub_games` row `quests`, no switch, `keep_achievements` true): measure `quests_done`; achievements
  First Quest (1), Quest Seeker (5), Quest Knight (10), Quest Champion (15), Quest Legend (20). Trophy `quest-hero`,
  repeat `steps` (step 1 = bronze at 5, 2 = silver at 10, 3 = gold at 20).
- Quest wins stay through a New Season (they are a record of weeks played, not points).
- No points (James chose achievements + trophy).

## Pupil home page: the quest bar

Shown under the welcome strip while the class has a quest running, and for 2 days after it ends ("Quest over").
`my_class_quest()` answers: the quest (kind, dates), my 7 days (done / missed / today / still to come), whether I've won,
how many classmates have won (a number only), and my quests done in total.

- The quest's **painting fills the bar**, title in a slim strip on top ("Weekly quest · Star Trader: Every Jump").
- **Seven day-stones** across the painting. A done day is lit (gold flame for Dragon, star burst for Trader, torch for Clans);
  today's stone pulses; missed days are dark; days to come are faint. `3 of 5 days · 4 days left`.
- Today line: "6 jumps left today" (from the moves the home page already reads) and a **Play** button to the game.
  When today is done: "Today done! ✓".
- Small chip: "🏅 9 heroes finished" (class count, no names).
- **Quest won:** the stones flare one by one, a gold banner "Quest complete!" sweeps in with confetti, and the trophy rises if
  this win reached a new metal. Shown once per quest (remembered in the browser; nothing depends on it).
- A day ticks over to lit the next time the home page opens after the last turn.

## Teacher: new "Quests" tab

- **Start a quest:** three painted cards (one per kind). Greyed out with a note if that game is switched off for the class.
  Pick one → "Start this week's quest" → runs today plus 6 days.
- **Running quest:** title, dates, "11 of 26 finished", and a table: pupil, seven dots (done / missed / today / to come),
  days out of 5, ✓ finished, quests done in total. Sorted so pupils who still need days are easy to spot.
- **Stop quest** (asks first). Stopped quests give no new wins; wins already made stay.
- **Past quests:** date, kind, finished count; tap for that week's table.

## Art (painted in ComfyUI on this PC, `docs/quests-art/config.json`)

| Painting | Use |
|---|---|
| `quest-trader` (wide scene) | Star Trader quest bar + teacher card: a little trading starship leaping between glowing jump lanes |
| `quest-lord` (wide scene) | Dragon Maths quest: a young hero facing a forest beast in a misty enchanted forest |
| `quest-clans` (wide scene) | Clan Quest quest: clan warriors with torches at a glowing mine entrance in the hills |
| `questing-hero` bronze, silver, gold (icon) | The Questing Hero trophy: a hero's compass-shield with a banner |

## Animation

- Bar: slow drift on the painting, day-stones light with a spark burst and glow ring; today's stone pulses.
- Quest complete: stones flare in a wave, banner sweep, confetti, trophy rise. Respects reduced motion.
- Teacher table: none beyond the dots.

## Stages

1. **Everything above** in one PR: migration, watchers, rules, home bar, teacher tab, art, achievements and trophy.
2. Later: more quest kinds (James will send ideas), maybe quests needing other things than "all turns".

## Privacy

Stored: per pupil, which NZ days they used all of a game's turns, and which class quests they finished. Pupils see only their
own days and a class count. Teachers see their own class. Nothing about maths results.
