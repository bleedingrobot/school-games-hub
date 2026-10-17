# Mission Control maths: plan

*Times-table questions in Wormholes & Black Holes, with an on/off switch. Written 17 October 2026 for James.*

**Status: approved by James on 17 October 2026: "go with your suggestions" (every answer in section 9 is the suggestion). M.1 and M.2 done (section 10). Change from the plan: the Mission Boost charges every 5 turns, not 3 (section 10).**

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

## 10. Results so far

**M.1 Shared answers (17 Oct 2026).** Gem Keep now sends each answer (fact, right or wrong, time, when) in batches with their own id. The new database function `record_fact_answers()` (migration `20261017001200_fact_answers.sql`) adds them to the records in order, by the same rules as `shared/maths/leitner.ts` (a database test walks one fact through every rule with the numbers worked out by the game's own code). A batch sent twice counts once; batch ids are forgotten after 30 days or at a new season. Answers quicker than a quarter of a second are left out. Old "whole records" saves waiting on a device are still accepted. Checked in the browser on the local copy: 13 answers in a level and its Level Key all reached the records, offline answers too.

**M.2 Game rules (17 Oct 2026).** In `shared/space/engine.ts` with maths on:

- Wormhole: right = 3 squares further (as built before). Black hole: right = fall half as far (keeps your Escape Pod); wrong = as before (the Escape Pod works if you have one). A Force Field still blocks it with no question. A timeout counts as wrong.
- Mission Boost: a new action, before rolling, once charged. Right = +2 on this roll. Wrong = normal roll. Either way it's used up.
- Bots: Cadet answers right 60% of the time, Pilot 75%, Commander 90%. Pilot and Commander always take a charged boost, the Cadet half the time.
- With maths off nothing changes: the bots make exactly the same moves as before (tested), so games already being played aren't affected.

**Simulator (1,000 games a setting, bots at Pilot, Cosmic mode).** Minutes are the simulator's estimate, counting each question as 10 seconds.

| Nebula | Off | Maths on, boost every 3 turns | Maths on, boost every 5 turns |
|---|---|---|---|
| 4 rockets: minutes | 6.6 | 9.0 | 8.1 |
| 2 rockets: minutes | 3.9 | 5.4 | 4.9 |

Every board showed the same pattern: about +3 minutes for 4 rockets with the boost every 3 turns (Inner Solar System 6.8 → 9.7, Deep Space 6.2 → 9.3, Asteroid Belt 4.0 → 5.7). Most of the extra questions were boosts, so **the boost now charges every 5 turns** (one number, `BOOST_CHARGE_TURNS`). That adds about 1½ minutes to a 4-rocket game. Games take fewer turns with maths on, because right answers move rockets further, but each question takes time.

**How much knowing your tables helps** (one rocket that always or never answers right, against Pilots, boost every 5 turns, Nebula):

| | Fair share | Always right | Never right |
|---|---|---|---|
| 4 rockets: wins | 25% | 29% | 18% |
| 2 rockets: wins | 50% | 57% | 37% |

So maths matters, but luck still matters more: a student who gets everything wrong still wins about 1 game in 5 of 4-rocket games. Wrong answers never move you back; the gap comes from everyone else's right answers.

Next: M.3 (playing bots and pass-and-play with maths on, saving the answers).

