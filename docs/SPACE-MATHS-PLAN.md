# Mission Control maths: plan

*Times-table questions in Wormholes & Black Holes, with an on/off switch. Written 17 October 2026 for James.*

**Status: approved by James on 17 October 2026: "go with your suggestions" (every answer in section 9 is the suggestion).**

## 1. The idea in one paragraph

At the most exciting moments of a space game (flying into a wormhole, falling into a black hole, and when the booster is charged), Mission Control radios a times-table question. **A right answer helps you. A wrong answer never hurts you:** you just move the normal way. It reuses Gem Keep's question engine and records, so the facts a student needs come up more often, and the teacher's 12 × 12 grid fills in from both games. It can be switched off by the teacher for everyone, and (if the teacher allows) by each student for their own games.

## 2. The three maths moments

| Moment | When | Right answer | Wrong answer (or no answer) |
|---|---|---|---|
| **Wormhole boost** | You land on a wormhole's mouth | You fly through and **3 squares further** (unless that lands on another wormhole or black hole: then just the normal exit) | You fly through as normal |
| **Black hole escape** | You land on a black hole | You fall only **half as far**, like an escape pod, without using one | You fall as normal. If you have an escape pod, it's used now, as it is today |
| **Booster** | Before you roll, once it's charged (it charges after every 3 of your turns, and shows on screen) | Optional: tap **Booster**, answer, and get **+2** on this roll | Your roll is normal, and the booster is used up |

Notes:

- A **force field** still blocks a black hole completely, so no question is asked.
- The wormhole boost is already in the game engine, waiting behind the "maths" setting (built with the game, never switched on). The black hole and booster are new.
- Each board has about 7 wormholes and 6–7 black holes, so a game asks roughly **3–6 questions per player**, plus the booster. The first stage measures this with the simulator and checks games don't get much longer (target: less than a minute extra for a 4-rocket game).
- **Bots answer too**, so maths doesn't simply make students beat bots. Cadet gets about 60% right, Pilot 75% and Commander 90%, decided by the game's seed so the server can replay it.

## 3. Switching it on and off

Two switches, so it's toggleable at both levels:

1. **Teacher switch** (Teacher page, school-wide, like emoji reactions). Three settings:
   - **Off**: no maths in space games for anyone. The game is exactly as it is now.
   - **Students choose**: a **Mission Control maths** on/off chip appears in the space game's settings.
   - **On for everyone**: maths is always on, with no chip.
2. **Student chip** (only with "Students choose"): in Settings, next to Classic/Cosmic. It's remembered on their device, like the other space settings.

Against classmates, the **host's** setting is used for the whole game, and the waiting room shows "Mission Control maths: on" so everyone knows before it starts.

## 4. Which questions

- **Times tables only** (multiplication, plus missing-number and division if the teacher has those on in the Gem Keep settings). The engine already exists, so this is the quickest. Other Year 4–6 maths (adding, doubling and halving) can be added later as new "skill packs" without changing the game.
- **Which tables:** the teacher's "times tables on" list from the Gem Keep settings applies here too. Within that, the question picker uses the student's own records, so the facts they're still learning come up most. A student who has never played Gem Keep starts on ×2, ×5 and ×10, and moves on as those become secure.
- **Answering:** the same number pad and question card as Gem Keep (typing or tapping, with multiple choice if the teacher has that on). Against bots and in pass-and-play there's no timer. Against classmates there's **20 seconds**; running out counts as "no answer" (you move normally, and it isn't recorded as wrong).

## 5. Privacy and kindness

- **Classmates never see your question or whether you got it wrong.** They only see the good news ("Brave Kiwi 7 powered up the wormhole! 🚀") or the normal move. No "wrong" message ever goes to anyone else's screen.
- Answers go into the same times-table records as Gem Keep (already in the privacy summary). The summary gets one line saying space games add to them.
- **Pass-and-play:** questions are asked, but nothing is recorded, because anyone could be holding the device.

## 6. Cheating and saving

- **Against bots:** the server already replays every bot game from its seed. The saved game will also carry each question and the answer typed, and the server checks every "right" really was right before saving. Space games only earn taking-part points (the same win or lose), so faking maths gains nothing anyway.
- **Against classmates:** the server picks the question and marks the answer itself (in the `space-game` function), so nothing can be faked.
- **One fix needed first:** today Gem Keep saves a student's records as "here are my totals now", and the server keeps whichever copy has more answers. With two games adding answers, a copy loaded earlier in one game could miss answers from the other. So both games will send **each answer** ("7 × 8, right, 3.2 seconds") instead, and the server adds them up. Old saves still waiting on a device are still accepted.

## 7. Points and achievements

- **No extra points for right answers.** Space points stay the same (taking part), so the game stays fair for students who find maths hard, and there's nothing to farm.
- **Three new space achievements** (10 points each, like the others): **Mission Control** (10 right answers in space games), **Wormhole booster** (power up a wormhole), **Great escape** (escape half a black hole with maths).
- The How points work page gets a line about them.

## 8. Stages (stop for James after each)

1. **M.1 Shared answers:** the "send each answer" saving format for both games; the server adds answers to the records. Gem Keep switches over (no visible change).
2. **M.2 Game rules:** black hole escape and booster in the engine; the "maths" setting becomes on/off plus the booster; bots answer at their level; simulator check of game length and fairness with maths on and off.
3. **M.3 Against bots and pass-and-play:** the settings chip, the question card in the game, saving and checking answers, records for the signed-in student.
4. **M.4 Against classmates:** server-picked questions with the 20-second timer, the waiting-room line, only good news shown to others.
5. **M.5 Teacher switch and finishing:** the three-way teacher switch, achievements, How points work, the How to play guide, privacy summary, accessibility check (keyboard, screen reader, phone and Chromebook sizes).
6. **Go live** (James's yes): one database change, deploy `save-bot-game`, `space-game` and `gem-keep`, then merge.

Rough size: a bit smaller than Gem Keep Phase 5. M.1–M.3 can be tried in a private preview link before anything goes live.

## 9. Questions for James (my suggestion first)

1. **The three moments:** all three (wormhole boost, black hole escape, booster)? *Suggestion: yes.*
2. **Teacher switch to start with:** Off, Students choose, or On for everyone? *Suggestion: Students choose.*
3. **Student chip:** on or off the first time a student opens settings? *Suggestion: on (they can switch it off).*
4. **Classmates timer:** 20 seconds? *Suggestion: yes.*
5. **Bots answering:** 60/75/90% right for Cadet/Pilot/Commander? *Suggestion: yes.*
6. **Booster:** +2 on the roll, charging every 3 turns? *Suggestion: yes. Easy to change after a class tries it.*
7. **Show "Brave Kiwi 7 powered up the wormhole!" to classmates** (good news only)? *Suggestion: yes.*
