# Smash Quest (was Bonkers Quest): plan

**XP, not stars (James, 28 Nov 2026):** the screens show experience: each star the rules count is 10 XP (`xp()` in src/games/bonkers/words.ts). Level 10 is now "Smash Legend".

**Longer fights, more hits, monster hearts (James, 28 Nov 2026: "twice as long", "still needs to get hit more", "hearts for monster health"):** 4 to 8 hero smashes before each question, the monster swings back after every second one (2 a question, a heart each, never the last), a wrong answer costs 2 hearts; hero 10 hearts (trainers 13), so 3 wrong answers still lose a fight (4 against a trainer). Monster health is 10 purple hearts.

**The monster hits back (James, 28 Nov 2026: "they never seem to get hit", "hearts"):** while the hero smashes before each question the monster swings back once and knocks off a heart (never the last; not while tied up by Wool Whirlwind), shown one blow at a time. Hearts 5 (trainers 7), so 3 wrong answers still lose a fight (4 against a trainer).

**One question a fight, monsters with double HP (James, 27 Nov 2026 evening):** the hero's own smashes wear the monster down until the question's boosted smash finishes it (`autoSmash` in engine.ts), so a right answer always wins; a wrong one brings another question. Sim: 1.1 to 1.7 questions a fight, same level pace.

**Renamed Smash Quest by James, 27 Nov 2026.** The id, tables, function and folders keep the name `bonkers`. Teachers always get unlimited adventures (the function checks `profiles.role`), so James can test without the daily limit.

**Status: B.1 LIVE for teachers 27 Nov 2026 (PR #942: migration 20261127191027_bonkers.sql applied, `bonkers` function deployed, tables empty, switch on for every class). Code switch OFF: only teachers can open `/#/bonkers` to test the gameplay (James, 27 Nov: "no art though, leave that till last and lets test some gameplay first"). No painting until James has played it and says go.**

**Change after James's first play (27 Nov, PR below): "a bit too much maths", aim for two questions a fight, "smash" not "bonk".** The hero now smashes on their own (2 to 4 small smashes before each question, never the finishing blow), and each question pops up with a surprise boost: DOUBLE (×2, most often), TRIPLE (×3) or ABSURD DAMAGE (×10, rare). A right answer smashes for that boost; a wrong one misses and the monster smashes back. Simulator: about 2.1 questions a fight (11 an adventure) for a steady pupil, 1.8 strong, 2.7 struggling. All game wording says smash; the achievement names below get the same change when B.2 builds them.

Brainstorm and all 22 of James's answers: [plans/bonkers-quest/PLAN.md](plans/bonkers-quest/PLAN.md) (section 10 wins where it differs). Style test (bouncy cartoon picked): [plans/bonkers-quest/style-test/](plans/bonkers-quest/style-test/).

## The short version

- A wacky, streamlined Dragon Maths for **Years 2 to 4**: one **adventure** a day on fixed rails, like a Sky Isles turn.
- **The path:** home (Granny Jetpack; was "the Wobbly Inn", renamed Home by James 28 Nov 2026) > pick 1 of 2 quests > 4 to 6 fights in that zone > the trainer (only when your star bar is full) > the treasure chest (only when earned) > back home.
- **Every hit is a maths question** (the shared focus, way A, 4 big choices). Right: a big daft hit. Wrong: a little bonk, the monster bonks you back, and the right answer is shown. You can't lose anything: a bonked fight just ends with fewer stars.
- **Four classes**, kept all season: Kitchen Knight, Disco Dazzler, Pirate Granny, Bin Ninja, each with a boy, girl or animal look and one special move a fight.
- **Getting stronger:** stars fill the bar, the trainer levels you up (10 levels, 9 trainers), the chest gives wacky gear that adds power.
- Teachers see the hero level in the Progress tab's "Other games" group.

## Decisions

All 22 are James's (27 Nov 2026), in the brainstorm's section 10. Calls I made while building, any of which James can change:

| Question | My call | Why |
|---|---|---|
| Typed or choices? | Always 4 choices (the pack's `multipleChoice: true`) | Years 2 to 4, quick on iPads; questions with picture labels still work |
| What the specials do | Knight: Rolling Pin of Doom, this hit ×3 if right. Dazzler: High Heels of Distraction, no bonk back this question and ×1.5 if right. Granny: Wool Whirlwind, the monster can't bonk you for 2 questions. Ninja: Banana Peel, ×2 if right and +2 stickers | Each is one tap, once a fight; every one rewards a right answer, so the maths still decides |
| Hearts | 3 per fight, full again every fight (4 for the trainer) | No healer sums; nothing carries over to worry about |
| Saved-up adventures | Weekdays only: Monday after a full week off gives 3, never more | A weekend isn't a missed day |
| Points | 2 a fight won, 3 for the quest done, 5 for beating a trainer, inside the 40-a-day cap | Like Dragon Maths: steady play, never maths results |

## Design (docs/game-guide/1-design.md)

1. **Big goal:** reach level 10 and beat the season's mega boss (stage B.3). An every-day pupil reaches level 10 in about week 4 (simulator: `npm run bonkers:sim`).
2. **Season game:** yes, 5 weeks (stage B.3). Until then progress simply builds up.
3. **Play a day:** an allowance of 1 adventure a school day, saved up to 3. In `UNLIMITED_GAMES` ("adventures").
4. **Progress bars:** the star bar to the trainer and the level road 1 to 10 on the inn screen.
5. **Achievements** (stage B.2):

   | Name | For | Measure | Number | Kept at New Season |
   |---|---|---|---|---|
   | First Bonk | Win your first fight. | `bonkers_fights` | 1 | yes |
   | Bonk Boss | Win 50 fights. | `bonkers_fights` | 50 | yes |
   | Trainer Tamer | Beat your first trainer. | `bonkers_level` | 2 | yes |
   | Halfway Hero | Reach level 5. | `bonkers_level` | 5 | yes |
   | Totally Bonkers | Reach level 10. | `bonkers_level` | 10 | yes |

6. **Home card:** the bouncy cartoon style, painted last (B.6).
7. **Guide for new players:** the inn is the guide: Granny Jetpack's one-line next step on every screen, and the first adventure explains each step as it comes (B.4).
8. **Learning design:** maths as the move: a fight is won only by right answers (each right is a big hit, each wrong lets the monster bonk you; 3 bonks end the fight). No speed bonus, no on-screen timer. A wrong answer shows the right one with its working (`QuestionModal`). Help me works as everywhere. Questions come from the pupil's own focus or ladder place, so Year 2 gets Year 2 maths.

## Stages

| Stage | What | Live? |
|---|---|---|
| B.1 | Rules, simulator, server function, database, screens with drawn stand-ins, teacher switch and Progress column. Teachers only (code switch off) | LIVE for teachers 27 Nov 2026 (PR #942) |
| B.2 | Sticker shop (hats and pets), achievements, monster book | |
| B.3 | The class's Friday boss (chipped all week), the 5-week season and the mega boss | Home-screen season timeline LIVE 28 Nov 2026 (`shared/bonkers/season.ts`: season = the school's hub season, 5 Fridays, last one the mega boss); the fights themselves not built |
| B.4 | Guide polish, Bella's voice lines | Granny Jetpack's tips through the first adventure and on the trainer screen, all her lines read by Bella (33 clips) |
| B.5 | Switch on for pupils | |
| B.6 | Paint everything on JamesGaming (bouncy cartoon) | |

## Server, data and cost

- Function `bonkers` (`supabase/functions/bonkers/`), rules in `shared/bonkers/`.
- Tables `bonkers_progress` (one row a pupil, versioned) and `bonkers_adventures` (one a day-ish: the quest, the monsters, the questions as the server made them, the marks).
- Requests: load 1, start 1, one per question (about 11 since the 27 Nov change), finish 1: about 14 an adventure, so 28 pupils is about 400 a lesson.
- Preview (no sign-in, trial backend in the browser): `npm run bonkers:preview` makes one HTML file.
