# Bonkers Quest (working name): a wacky, streamlined Dragon Maths for younger pupils

**Status:** brainstorm and plan only, 27 Nov 2026. Nothing built. Waiting on James's answers (question cards in the project thread); the answers get written into section 10 and this plan becomes `docs/<ID>-PLAN.md` from `docs/game-guide/templates/plan.md` when the build starts.

James, 27 Nov 2026: "like dragon maths but simplified and streamlined for younger students ... entering an area to fight, slowly getting stronger, defeating a big monster after a set time, getting upgrades in gear, classes to choose from, crazy monsters to battle, trainer to defeat to level up ... more like sky isles with each set of goes being a linear process, eg start > daily quest at the inn > fight, fight, fight > trainer (if needed) > get awarded gear (if earned) ... graphics more fun and friendly, the game itself super weird and wacky, crazy weapons like rolling pins of doom and high heels of distraction."

## 1. The idea in one minute

- **One "adventure" a day, always the same steps in the same order** (the Sky Isles turn, not the Dragon Maths village menu). No menus to wander, no bank, no healer bill, no shop sums to get lost in.
- **The steps:** Wake up at the Wobbly Inn > pick up today's silly quest > into today's zone > fight, fight, fight > the trainer (only when you have enough stars) > the treasure chest (gear, only if earned) > home, see you tomorrow.
- **The maths is the move.** Every hit is a question (rule 1 of LEARNING-DESIGN.md). Right answer: a big daft hit. Wrong answer: a little bonk, the right answer shown with a picture, and the fight goes on. Nothing is ever lost.
- **Growing stronger you can see:** hero levels from trainers, wacky gear that changes your picture, and a big boss at the end of the week (or season).
- **Wacky everything:** a Grumpy Teapot, a Sock Goblin, a Jelly Knight who wobbles; weapons like the Rolling Pin of Doom, High Heels of Distraction, Spaghetti Whip, Rubber Chicken of Justice.
- **Voice first:** every line read by Bella, so a child who can't read yet can still play alone.

## 2. What we keep from Dragon Maths, and what changes

| Dragon Maths (Years 4 to 6) | Bonkers Quest (younger) |
|---|---|
| Village menu, 9 places, go anywhere | One fixed path of 5 or 6 steps a day, one choice per screen |
| 10 forest fights + 3 arena a day, saved-up turns | 1 adventure a day of about 4 to 6 fights (8 to 10 minutes) |
| Size it up on 1 fight in 3, maths at the shop, healer, bank | A question on every hit; nothing else asks maths |
| Gold, bank, healer, shop prices, selling gear | No money at all (or stickers only, see Q). Gear comes from the chest |
| HP that carries over, healer, soft losing | Full health every fight; you can't really lose, a "bonked" fight just ends with a smaller prize |
| 12 levels, a master between each, exp curve | About 8 to 10 levels; a trainer appears when your star bar is full |
| 3-stage Red Dragon at level 12, 35-day season | One big boss: weekly (Friday boss) or at the end of a short season (Q) |
| Knight, Mage, Trickster with skill uses | 3 or 4 silly classes, each with one special move (Q) |
| Arena, classmate clashes, Daily News | Probably none at first; maybe a class boss or see classmates' heroes (Q) |
| Way A maths from the focus (Years 3 to 6) | Junior route or the focus, depending on the ages (Q1) |
| Pixel / dark fantasy look | Bright, round, friendly cartoon (Q) |

## 3. A day's adventure, step by step (the "linear process")

Same steps, same order, every day, like the Sky Isles turn (`src/games/isles/TurnSteps.tsx`): one screen per step, a big Next button, greyed buttons say why.

1. **Wake up at the Wobbly Inn.** Your hero yawns, the innkeeper (a talking moose? a pigeon in an apron?) says hello by name. Shows the star bar and "3 more stars to meet the trainer".
2. **Today's quest board.** One silly quest a day, picked by the server, e.g. "The Mayor's false teeth have run off. Bonk 5 Sock Goblins in the Laundry Swamp." The quest names today's zone and gives a bonus (extra stars or a chest key). Maybe pick 1 of 2 quests (Q).
3. **Into the zone.** A short walk-in animation to today's zone (Laundry Swamp, Custard Caves, Toilet Roll Towers?, Bouncy Castle Ruins, Volcano of Slight Annoyance).
4. **Fight, fight, fight.** 4 to 6 fights (Q). Each fight: monster pops in with a silly line (voiced), you answer a question, your hero does a ridiculous attack with your weapon, the monster says "OW, my dignity!" A fight takes 2 to 4 questions. Stars and maybe a monster sticker for the monster book.
5. **The trainer (only if your star bar is full).** A wacky trainer per level (Coach Crumpet, Granny Kickflip, Sir Reginald the Very Tall Snail). A slightly harder fight with a little twist. Win: level up, bigger hero, new title. Lose: try again tomorrow, keep everything.
6. **The treasure chest (only if earned).** Quest done or trainer beaten: open the chest, get a new piece of gear (weapon, hat, shoes, cape, pet). Gear goes on straight away and shows on the hero.
7. **Home time.** "See you tomorrow!" Tomorrow's teaser ("The Custard Caves are wobbling..."). Boss countdown ("Big Boss in 2 days").

**Boss day:** on boss day (or when the season's timer runs out) step 4 becomes the big boss fight: the Dragon of Mild Inconvenience, a giant Toaster Dragon, the Big Cheese.

## 4. The maths

There are two honest routes, and the choice is James's (Q1):

- **A. Junior route (ages 5 to 8, Foundational group).** Copy Weka/Beanstalk: the game's own rounds from the early-facts records (`shared/maths/skillPacks/earlyFacts.ts`), 3 or 4 big picture choices, no typing, every line voiced, first tap counts, max 2 wrong taps then show why, `JUNIOR_QUICK_MS`. The monster fight is the "go". Teacher sees a Foundational Progress column. More work (show-why pictures for each kind of fact).
- **B. Ladder route (Years 2 to 4).** Way A from the pupil's maths focus (`makeFocusPack`, ladder from their own place), shown in the shared `QuestionModal` with 4 big choices on by default. Less new maths work, and a Year 2 pupil gets Year 2 questions because the ladder follows them. An "Other games" Progress column with one number.

Either way: the hit is the answer (right = big hit, wrong = little bonk + the right answer with a reason), no timers on screen, no speed bonus, the server makes and marks every question, and it records every answer.

**Stopping guessing:** a fight is won by right answers, not taps. A wrong answer still lets the fight carry on, but the monster only goes down after enough right answers; the prize for a fight is smaller when it took lots of wrong ones. With the junior route, the Beanstalk tap cap applies.

## 5. Heroes, classes and gear

**Classes (ideas, pick 3 or 4):**

| Class | Look | Special move (once a fight) |
|---|---|---|
| Kitchen Knight | saucepan helmet, apron | **Rolling Pin of Doom**: next hit is a triple bonk |
| Disco Diva / Dazzler | sparkly cape, platform shoes | **High Heels of Distraction**: the monster is so distracted it skips a hit |
| Garden Gnome Wizard | pointy hat, watering can | **Sprout Spell**: grows a vine, heals you |
| Pirate Granny | eye patch, knitting needles | **Wool Whirlwind**: ties the monster up for a turn |
| Bin Ninja | bin-lid shield | **Banana Peel**: the monster slips and falls over |

**Gear (wacky, shows on the hero):** weapon (Rolling Pin of Doom, Spaghetti Whip, Rubber Chicken of Justice, Baguette Sword, Fish Slapper, Pool Noodle of Power), hat (Teapot Helmet, Traffic Cone Crown), shoes (High Heels of Distraction, Jet-Powered Slippers, Clown Shoes of Stomping), cape (Shower Curtain Cape, Bath Towel of Bravery), pet (a Duck in a Hat, a Very Small Dragon). Each piece has a simple "power" number going up, plus a silly line.

**Getting stronger:** level (from trainers) + gear power. Simple numbers a 6-year-old can read: "Power 12". No defence, strength and HP sums.

## 6. Monsters (wacky, friendly, never scary)

Zones of 5 or 6 monsters each, e.g.:
- **Laundry Swamp:** Sock Goblin, Lint Monster, Angry Pegs, The Odd Sock King.
- **Custard Caves:** Jelly Knight, Grumpy Teapot, Sprinkle Bat, Biscuit Golem.
- **Bouncy Castle Ruins:** Balloon Ogre, Trampoline Troll, Party Popper Imp.
- **Supermarket of Doom:** Trolley Beast, Shouty Banana, Frozen Pea Swarm.
- **Volcano of Slight Annoyance:** Toaster Dragon, Lava Lamp, Hot Sauce Hydra.

Bosses: the Dragon of Mild Inconvenience, Big Cheese, Mega Moth Who Ate the Curtains.

Kept out (same as Dragon Maths): gore, romance, real-world brands, toilet humour beyond a gentle chuckle (Q), anything scary.

## 7. What we can reuse

- **Dragon Maths** (`shared/lord/`): the tier-power curve idea, master = trainer, seeded fights the server replays, the season road (`SeasonRoad.tsx`), achievements and points rules, Hall of Heroes idea, trial backend for previews.
- **Sky Isles** (`src/games/isles/TurnSteps.tsx`, `shared/isles/nextStep.ts`): the fixed-step turn, one choice per screen, "why not" greyed buttons, Pip's next-step line (our innkeeper does the same job).
- **Maths Monsters:** a question on each attack, battle animations, the monster book idea.
- **The game kit** (`src/kit/`), `QuestionModal`, `useQuestionKeys`, Help me, hub points and achievements, Bella voice clips (`scripts/voice-clips.py`), the art pipeline (ComfyUI on JamesGaming, `docs/<id>-art/config.json`).
- **Junior route parts** if Q1 picks it: Weka's round/replay/progress shape and Beanstalk's show-why flow.

## 8. Art and sound

- Bright, round, friendly cartoon. Thick outlines, big eyes, pastel and candy colours. Painted by James's ComfyUI setup; drawn stand-ins first, then paint straight away when it goes live (James, 26 Nov).
- Paint list (first pass): 1 inn, 5 zone backdrops, ~25 monsters, 3 to 4 bosses, 4 classes x 2 to 3 looks, ~30 gear icons, trainers (one per level), chest, home card.
- Gear on the hero: either layered pieces painted separately (flexible, harder to make look right) or a few painted hero looks per class that change at levels (easier, less dress-up) (Q).
- Bella reads everything. Silly sound effects (boing, honk, squelch). Bouncy music per zone.

## 9. Stages (rough, once the answers are in)

1. **Rules + simulator:** `shared/<id>/` config, fight, levels, gear, quest, boss; a sim to check the pace (every day vs 2 days a week still meet the boss).
2. **Server + database:** adventure start/step/finish, server-made questions, saves, points and achievements.
3. **Screens:** the step path, fight screen with drawn stand-ins, inn, chest, home. Full window from the start.
4. **Guide + voice:** guided first adventure, innkeeper next-step line, Bella clips.
5. **Teacher:** Progress column, settings (turns, boss day), unlimited-today switch.
6. **Art:** paint everything on JamesGaming.
7. **Go live + switch on.**

## 10. Questions for James

Asked on question cards in the project thread, 27 Nov 2026. Answers go here.

1. Which ages? **Years 2 to 4** (James, 27 Nov): the ladder route (way A from the focus, 4 big choices, voice), with the older games.
2. One game of its own, or a "junior mode" of Dragon Maths? **Its own game** (James, 27 Nov): own card, heroes, look and saves.
3. How long is a day's adventure? **1 adventure, 4 to 6 fights** (James, 27 Nov): about 8 to 10 minutes, then tomorrow.
4. When's the big boss? **Weekly plus season boss** (James, 27 Nov): a mini boss every Friday and a mega boss at season end.
5. Can you lose a fight? **Nothing lost, smaller prize** (James, 27 Nov): a comic fall-over and fewer stars; never lose stars, gear or turns.
6. How many classes, and can you swap? **4 classes, kept all season** (James, 27 Nov): swap at a new season. Which four: follow-up card.
7. Where does gear come from? **Chest plus a sticker shop** (James, 27 Nov): main gear from the chest; fights earn stickers for fun extras (hats, pets).
8. Classmates in it? **Class boss together** (James, 27 Nov): the class's right answers chip away at a shared Friday boss's health bar; never ranks pupils by maths.
9. Art style?
10. How wacky? **Full bonkers, mild toilet** (James, 27 Nov): gentle burp, smelly sock and Toilet Roll Towers jokes are in; still no gore, romance or anything scary.
11. Name? **Bonkers Quest** (James, 27 Nov). Suggested id `bonkers`.
12. Daily quest: one, or pick from two? **Pick 1 of 2** (James, 27 Nov): two zones or monsters on the board each morning.
